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
const SEMILLA_LIMIT = 25;

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
}

function toMin(t: string): number {
  const [h, m] = String(t || "").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function durOf(services: any[], id: string): number {
  return services.find((s) => s.id === id)?.duration ?? 45;
}

function uid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
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
      let pro = b.proId ? String(b.proId) : undefined;
      const dur = durOf(data.services || [], serviceId);
      const s = toMin(time);
      const e = s + dur;
      const pros = data.professionals || [];

      if (!pro && pros.length > 0) {
        // Opción "Cualquiera": Encontrar profesionales disponibles
        const available = pros.filter((p: any) => {
          const pHours = (p.hours && Array.isArray(p.hours) && p.hours.length === 7) ? p.hours : (data.settings?.hours || []);
          const [y, m, d] = String(date || "").split("-").map(Number);
          const dayIdx = new Date(y, m - 1, d).getDay();
          const dayH = pHours[dayIdx];
          if (!dayH || !dayH.open) return false;
          const inS1 = dayH.from && dayH.to && s >= toMin(dayH.from) && e <= toMin(dayH.to);
          const inS2 = dayH.from2 && dayH.to2 && s >= toMin(dayH.from2) && e <= toMin(dayH.to2);
          if (!inS1 && !inS2) return false;

          const isBlocked = (data.blockedSlots || []).some((bs: any) => {
            if (bs.date !== date) return false;
            if (bs.proId && bs.proId !== p.id) return false;
            if (!bs.time) return true;
            if (!bs.endTime) return bs.time === time;
            const t = toMin(time);
            return t >= toMin(bs.time) && t < toMin(bs.endTime);
          });
          if (isBlocked) return false;

          const clash = (data.bookings || []).find((x: any) => {
            if (x.date !== date || x.status === "cancelada") return false;
            if (x.proId && x.proId !== p.id) return false;
            const bs = toMin(x.time);
            const be = bs + durOf(data.services || [], x.serviceId);
            return s < be && bs < e;
          });
          return !clash;
        });

        if (available.length === 0) {
          return json({ error: "No hay ningún profesional disponible en ese horario." }, 409);
        }

        // Balancear carga: asignar al profesional disponible con menos turnos hoy
        available.sort((p1: any, p2: any) => {
          const c1 = (data.bookings || []).filter((x: any) => x.date === date && x.proId === p1.id && x.status !== "cancelada").length;
          const c2 = (data.bookings || []).filter((x: any) => x.date === date && x.proId === p2.id && x.status !== "cancelada").length;
          return c1 - c2;
        });
        pro = available[0].id;
      } else if (pro && pros.length > 0) {
        // Profesional específico
        const targetPro = pros.find((p: any) => p.id === pro);
        if (targetPro) {
          const pHours = (targetPro.hours && Array.isArray(targetPro.hours) && targetPro.hours.length === 7) ? targetPro.hours : (data.settings?.hours || []);
          const [y, m, d] = String(date || "").split("-").map(Number);
          const dayIdx = new Date(y, m - 1, d).getDay();
          const dayH = pHours[dayIdx];
          if (!dayH || !dayH.open) return json({ error: `${targetPro.name} no atiende en esa fecha.` }, 409);
          const inS1 = dayH.from && dayH.to && s >= toMin(dayH.from) && e <= toMin(dayH.to);
          const inS2 = dayH.from2 && dayH.to2 && s >= toMin(dayH.from2) && e <= toMin(dayH.to2);
          if (!inS1 && !inS2) return json({ error: `${targetPro.name} no atiende en ese horario.` }, 409);

          const isBlocked = (data.blockedSlots || []).some((bs: any) => {
            if (bs.date !== date) return false;
            if (bs.proId && bs.proId !== pro) return false;
            if (!bs.time) return true;
            if (!bs.endTime) return bs.time === time;
            const t = toMin(time);
            return t >= toMin(bs.time) && t < toMin(bs.endTime);
          });
          if (isBlocked) return json({ error: "Este horario se encuentra bloqueado." }, 409);

          const clash = (data.bookings || []).find((x: any) => {
            if (x.date !== date || x.status === "cancelada") return false;
            if (x.proId && x.proId !== pro) return false;
            const bs = toMin(x.time);
            const be = bs + durOf(data.services || [], x.serviceId);
            return s < be && bs < e;
          });
          if (clash) {
            return json({ error: clash.time === time ? `${targetPro.name} ya tiene un turno a las ${time}.` : `Se superpone con otro turno de ${targetPro.name}.` }, 409);
          }
        }
      } else {
        // Negocio sin profesionales cargados (un solo dueño)
        const blocked = (data.blockedSlots || []).some((bs: any) => {
          if (bs.date !== date) return false;
          if (bs.proId && pro && bs.proId !== pro) return false;
          if (!bs.time) return true;
          if (!bs.endTime) return bs.time === time;
          const t = toMin(time);
          return t >= toMin(bs.time) && t < toMin(bs.endTime);
        });
        if (blocked) return json({ error: "Este horario se encuentra bloqueado por el negocio." }, 409);
        const clash = (data.bookings || []).find((x: any) => {
          if (x.date !== date || x.status === "cancelada") return false;
          if (x.proId && pro && x.proId !== pro) return false;
          const bs = toMin(x.time);
          const be = bs + durOf(data.services || [], x.serviceId);
          return s < be && bs < e;
        });
        if (clash) {
          return json({ error: clash.time === time ? `El horario ${time} ya fue tomado.` : `Se superpone con otro turno (${clash.time}).` }, 409);
        }
      }
      const id = uid();
      const status = b.status === "pendiente" ? "pendiente" : "confirmada";
      const claimTx = b.depositClaim && typeof b.depositClaim.txId === "string" ? b.depositClaim.txId.slice(0, 60) : "";
      const booking = {
        id, client, phone, email: email || undefined, serviceId, date, time,
        status, source: b.source === "manual" ? "manual" : "online",
        items: Array.isArray(b.items) ? b.items.slice(0, 10) : undefined,
        proId: pro, createdAt: Date.now(),
        paidDeposit: b.paidDeposit === true ? true : undefined,
        paymentMethod: ["tarjeta", "transferencia", "billetera"].includes(b.paymentMethod) ? b.paymentMethod : undefined,
        depositClaim: claimTx ? { txId: claimTx, sentAt: Date.now() } : undefined,
      };
      const next = { ...data, bookings: [...(data.bookings || []), booking] };
      await save(next);
      return json({ ok: true, id, data: next });
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
      return json({ ok: true, id: entry.id, data: next });
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
          x.id === bookingId ? { ...x, status: "cancelada", cancelReason: String(body.reason || "Cancelado por el cliente") } : x
        ),
      };
      await save(next);
      return json({ ok: true, data: next });
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
      return json({ ok: true, data: next });
    }

    return json({ error: "Acción inválida." }, 400);
  } catch {
    return json({ error: "Error interno del servidor." }, 500);
  }
}
