import { SEMILLA_MONTHLY_LIMIT } from "../src/lib/plans";
import { checkSlot } from "../src/lib/availability";
/**
 * POST /api/public
 * Escrituras de INVITADOS (sin login) con service role + validación en servidor.
 * Necesario porque con RLS+Auth los anónimos ya no pueden escribir directo.
 *
 * { action: "book", ownerId, booking: {client,phone,email?,serviceId,date,time,items?,proId?} }
 * { action: "waitlist", ownerId, entry: {date,serviceId,client,phone} }
 * { action: "cancel", ownerId, bookingId, reason? }
 * { action: "review", ownerId, review: {client,rating,text} }
 *
 * Responde { ok, id?, data? } o { error } (FALTA_MENOS_24H para cancel tardía).
 * Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (o SECRET).
 */

export const config = { runtime: "edge" };

const DAY_MS = 24 * 3600 * 1000;
const SEMILLA_LIMIT = SEMILLA_MONTHLY_LIMIT;

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
}

function uid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

function sanitizeBizForPublic(data: any) {
  if (!data) return data;
  return {
    ...data,
    bookings: (data.bookings || []).map((b: any) => ({
      id: b.id,
      date: b.date,
      time: b.time,
      serviceId: b.serviceId,
      extraServiceIds: b.extraServiceIds,
      proId: b.proId,
      status: b.status,
    })),
    waitlist: [],
  };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const url = process.env.SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
  if (!url || !serviceKey) return json({ error: "Falta configuración en el servidor." }, 500);

  const H = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };

  try {
    const ownerId = String(body.ownerId || "");
    if (!ownerId) return json({ error: "Falta el negocio." }, 400);

    // Dueño (no borrado)
    const uRes = await fetch(`${url}/rest/v1/cupito_users?select=*&id=eq.${encodeURIComponent(ownerId)}`, { headers: H });
    if (!uRes.ok) return json({ error: "No se pudo leer el negocio." }, 500);
    const uRows = (await uRes.json()) as any[];
    const owner = Array.isArray(uRows) ? uRows[0] : null;
    if (!owner || owner.deleted) return json({ error: "Este negocio ya no está disponible." }, 404);

    // Datos
    const dRes = await fetch(`${url}/rest/v1/cupito_data?select=data&user_id=eq.${encodeURIComponent(ownerId)}`, { headers: H });
    const dRow = ((await dRes.json().catch(() => [])) as any[])[0];
    const data = dRow?.data;
    if (!data) return json({ error: "Este negocio todavía no cargó sus datos." }, 404);

    const save = async (next: any) => {
      const w = await fetch(`${url}/rest/v1/cupito_data?user_id=eq.${encodeURIComponent(ownerId)}`, {
        method: "PATCH",
        headers: H,
        body: JSON.stringify({ data: next, updated_at: Date.now() }),
      });
      if (!w.ok) throw new Error("save");
      return next;
    };

    const monthPrefix = new Date().toISOString().slice(0, 7);
    const monthCount = (data.bookings || []).filter((b: any) => String(b.date || "").startsWith(monthPrefix) && b.status !== "cancelada").length;

    /* ---------------- RESERVAR ---------------- */
    if (body.action === "book") {
      const b = body.booking || {};
      const client = String(b.client || "").trim().slice(0, 60);
      const phone = String(b.phone || "").trim().slice(0, 30);
      const email = String(b.email || "").trim().slice(0, 80);
      const serviceId = String(b.serviceId || "");
      const date = String(b.date || "");
      const time = String(b.time || "");
      if (client.length < 2) return json({ error: "Poné tu nombre para confirmar." }, 400);
      if (phone.replace(/\D/g, "").length < 8) return json({ error: "Ingresá un celular válido." }, 400);
      if (!serviceId || !date || !time) return json({ error: "Falta elegir servicio, día y hora." }, 400);
      if (owner.plan === "semilla" && monthCount >= SEMILLA_LIMIT) {
        return json({ error: "Este negocio alcanzó el límite de reservas online de este mes. Anotate en la lista de espera." }, 403);
      }
      if ((data.settings?.closedDates || []).includes(date)) {
        return json({ error: "El negocio está cerrado en esa fecha." }, 400);
      }
      const service = (data.services || []).find((item: any) => item.id === serviceId);
      if (!service) return json({ error: "Este servicio ya no está disponible." }, 400);
      const appointment = new Date(date + "T" + time + ":00-03:00");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !Number.isFinite(appointment.getTime()) || appointment.getTime() <= Date.now()) return json({ error: "Elegí una fecha y un horario futuros válidos." }, 400);
      const advance = data.settings?.maxAdvanceDays ?? 30;
      const maxDay = new Date(Date.now() - 3 * 3600000 + advance * DAY_MS).toISOString().slice(0, 10);
      if (advance > 0 && date > maxDay) return json({ error: "La fecha supera la anticipación permitida por el local." }, 400);
      // Hora de Argentina expresada como "hora local" para el motor de disponibilidad.
      const nowAr = new Date(Date.now() - 3 * 3600000);
      const extraServiceIds = Array.isArray(b.extraServiceIds)
        ? b.extraServiceIds.map(String).filter((x: string) => x !== serviceId && (data.services || []).some((sv: any) => sv.id === x)).slice(0, 5)
        : [];
      const check = checkSlot(
        { settings: data.settings || { hours: [] }, services: data.services || [], professionals: data.professionals || [], bookings: (data.bookings || []).map(({ client: _c, ...rest }: any) => rest), blockedSlots: data.blockedSlots || [] },
        { date, time, serviceIds: [serviceId, ...extraServiceIds], proId: b.proId ? String(b.proId) : undefined, online: true, now: nowAr }
      );
      if (!check.ok) return json({ error: check.error }, check.reason === "taken" || check.reason === "blocked" ? 409 : 400);
      const pro = check.proId;
      const id = uid();
      const status = owner.plan !== "semilla" && data.settings?.depositEnabled && data.settings?.depositPct > 0 && service.price > 0 ? "pendiente" : "confirmada";
      const claimTx = b.depositClaim && typeof b.depositClaim.txId === "string" ? b.depositClaim.txId.slice(0, 60) : "";
      const booking = {
        id, client, phone, email: email || undefined, notes: String(b.notes || "").trim().slice(0, 300) || undefined, serviceId,
        extraServiceIds: extraServiceIds.length ? extraServiceIds : undefined, date, time,
        status, source: b.source === "manual" ? "manual" : "online",
        items: Array.isArray(b.items) ? b.items.slice(0, 10) : undefined,
        proId: pro, createdAt: Date.now(),
        paidDeposit: false,
        paymentMethod: ["tarjeta", "transferencia", "billetera"].includes(b.paymentMethod) ? b.paymentMethod : undefined,
        depositClaim: claimTx ? { txId: claimTx, sentAt: Date.now() } : undefined,
        events: [{ at: Date.now(), type: "creada", by: "cliente" }],
      };
      const next = { ...data, bookings: [...(data.bookings || []), booking] };
      await save(next);
      return json({ ok: true, id, data: sanitizeBizForPublic(next) });
    }

    /* ---------------- LISTA DE ESPERA ---------------- */
    if (body.action === "waitlist") {
      const e = body.entry || {};
      const client = String(e.client || "").trim().slice(0, 60);
      const phone = String(e.phone || "").trim().slice(0, 30);
      const date = String(e.date || "");
      const serviceId = String(e.serviceId || "");
      if (client.length < 2) return json({ error: "Poné tu nombre completo." }, 400);
      if (phone.replace(/\D/g, "").length < 8) return json({ error: "Necesitamos un teléfono válido para avisarte." }, 400);
      const cleanPhone = phone.replace(/\D/g, "");
      if ((data.waitlist || []).some((w: any) => w.date === date && String(w.phone || "").replace(/\D/g, "") === cleanPhone)) {
        return json({ error: "Ya estás en la lista de espera para ese día 😉" }, 409);
      }
      const entry = { id: uid(), date, serviceId, client, phone, createdAt: Date.now() };
      const next = { ...data, waitlist: [...(data.waitlist || []), entry] };
      await save(next);
      return json({ ok: true, id: entry.id });
    }

    /* ---------------- CANCELAR ---------------- */
    if (body.action === "cancel") {
      const bookingId = String(body.bookingId || "");
      const target = (data.bookings || []).find((x: any) => x.id === bookingId);
      if (!target) return json({ error: "No se encontró el turno." }, 404);
      // Verificar que quien cancela es el titular (últimos 8 dígitos del teléfono)
      if (body.phone) {
        const a = String(body.phone).replace(/\D/g, "").slice(-8);
        const b = String(target.phone || "").replace(/\D/g, "").slice(-8);
        if (!a || !b || a !== b) return json({ error: "Ese turno no coincide con tu número." }, 403);
      }
      try {
        const [y, m, d] = String(target.date).split("-").map(Number);
        const [hh, mm] = String(target.time).split(":").map(Number);
        const appt = new Date(y, m - 1, d, hh, mm).getTime();
        if (appt - Date.now() < DAY_MS) return json({ error: "FALTA_MENOS_24H" }, 403);
      } catch { /* permitir */ }
      const next = {
        ...data,
        bookings: (data.bookings || []).map((x: any) =>
          x.id === bookingId
            ? { ...x, status: "cancelada", cancelReason: String(body.reason || "Cancelado por el cliente").slice(0, 200), events: [...(x.events || []), { at: Date.now(), type: "cancelada", by: "cliente" }].slice(-20) }
            : x
        ),
      };
      await save(next);
      return json({ ok: true, data: sanitizeBizForPublic(next) });
    }

    /* ---------------- REPROGRAMAR (cliente) ---------------- */
    if (body.action === "reschedule") {
      const bookingId = String(body.bookingId || "");
      const date = String(body.date || "");
      const time = String(body.time || "");
      const target = (data.bookings || []).find((x: any) => x.id === bookingId);
      if (!target || target.status === "cancelada") return json({ error: "No se encontró el turno." }, 404);
      const a = String(body.phone || "").replace(/\D/g, "").slice(-8);
      const bPhone = String(target.phone || "").replace(/\D/g, "").slice(-8);
      if (!a || a !== bPhone) return json({ error: "Ese turno no coincide con tu número." }, 403);
      const current = new Date(String(target.date) + "T" + String(target.time) + ":00-03:00").getTime();
      if (current - Date.now() < DAY_MS) return json({ error: "FALTA_MENOS_24H" }, 403);
      const nowAr = new Date(Date.now() - 3 * 3600000);
      const check = checkSlot(
        { settings: data.settings || { hours: [] }, services: data.services || [], professionals: data.professionals || [], bookings: (data.bookings || []).map(({ client: _c, ...rest }: any) => rest), blockedSlots: data.blockedSlots || [] },
        { date, time, serviceIds: [target.serviceId, ...(target.extraServiceIds || [])], proId: target.proId, excludeId: bookingId, online: true, now: nowAr }
      );
      if (!check.ok) return json({ error: check.error }, 409);
      const next = {
        ...data,
        bookings: (data.bookings || []).map((x: any) =>
          x.id === bookingId
            ? { ...x, date, time, proId: check.proId ?? x.proId, reminderSentAt: undefined, events: [...(x.events || []), { at: Date.now(), type: "reprogramada", by: "cliente", detail: `Antes: ${x.date} ${x.time}` }].slice(-20) }
            : x
        ),
      };
      await save(next);
      return json({ ok: true, data: sanitizeBizForPublic(next) });
    }

    /* ---------------- RESEÑA ---------------- */
    if (body.action === "review") {
      const r = body.review || {};
      const client = String(r.client || "").trim().slice(0, 40);
      const text = String(r.text || "").trim().slice(0, 500);
      const rating = Math.min(5, Math.max(1, Number(r.rating) || 5));
      if (client.length < 2) return json({ error: "Poné tu nombre." }, 400);
      if (text.length < 5) return json({ error: "Escribí un breve comentario." }, 400);
      const review = { id: uid(), client, rating, text, date: new Date().toISOString().slice(0, 10) };
      const next = { ...data, reviews: [review, ...(data.reviews || [])].slice(0, 200) };
      await save(next);
      return json({ ok: true, data: sanitizeBizForPublic(next) });
    }

    /* ---------------- CONSULTAR TURNOS PROPIOS (MIS TURNOS) ---------------- */
    if (body.action === "lookup") {
      const phoneDigits = String(body.phone || "").replace(/\D/g, "");
      if (phoneDigits.length < 8) {
        return json({ error: "Ingresá un número de teléfono válido para consultar tus turnos." }, 400);
      }
      const last8 = phoneDigits.slice(-8);
      const myBookings = (data.bookings || [])
        .filter((b: any) => String(b.phone || "").replace(/\D/g, "").slice(-8) === last8)
        .map((b: any) => ({
          id: b.id,
          serviceId: b.serviceId,
          extraServiceIds: b.extraServiceIds,
          proId: b.proId,
          date: b.date,
          time: b.time,
          status: b.status,
          client: b.client,
          notes: b.notes,
          phone: b.phone,
        }));
      return json({ ok: true, bookings: myBookings });
    }

    return json({ error: "Acción inválida." }, 400);
  } catch {
    return json({ error: "Error interno del servidor." }, 500);
  }
}
