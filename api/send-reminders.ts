/**
 * GET /api/send-reminders
 * Cron diario (Vercel Cron): envía por email el recordatorio de los turnos de MAÑANA.
 *
 * Reglas:
 *  - Solo turnos con status "confirmada", con email cargado y fecha = mañana (ART).
 *  - Si el turno se reservó a menos de 24 h de la cita, NO se manda (ya tuvo confirmación).
 *  - Marca reminderSentAt en la reserva para no duplicar en reintentos.
 *  - Tope de 250 emails por ejecución.
 *
 * Env vars en Vercel:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (o SECRET/PUBLISHABLE/ANON),
 *   RESEND_API_KEY, RESEND_FROM (opcional), CRON_SECRET (opcional pero recomendado).
 *
 * Vercel Cron manda `Authorization: Bearer <CRON_SECRET>` solo si CRON_SECRET existe.
 * También acepta ?key=<CRON_SECRET> para probarlo a mano.
 */

export const config = { runtime: "edge" };

const DAY_MS = 24 * 3600 * 1000;
const MAX_SEND = 250;

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
}

function artDateKey(d: Date): string {
  // YYYY-MM-DD en America/Argentina/Buenos_Aires
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return parts; // en-CA => YYYY-MM-DD
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtLongEs(key: string): string {
  try {
    const [y, m, d] = key.split("-").map(Number);
    const s = new Date(y, m - 1, d).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch {
    return key;
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") return json({ error: "Método no permitido" }, 405);

  const url = new URL(req.url);
  const CRON_SECRET = process.env.CRON_SECRET || "";
  if (CRON_SECRET) {
    const auth = req.headers.get("authorization") || "";
    const key = url.searchParams.get("key") || "";
    if (auth !== `Bearer ${CRON_SECRET}` && key !== CRON_SECRET) {
      return json({ error: "No autorizado" }, 401);
    }
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || "";
  const SB_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";
  const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
  const RESEND_FROM = process.env.RESEND_FROM || "Cupito <hola@cupito.app>";

  if (!SUPABASE_URL || !SB_KEY) return json({ error: "Falta SUPABASE_URL o key de Supabase en Vercel." }, 500);
  if (!RESEND_API_KEY) return json({ error: "Falta RESEND_API_KEY en Vercel." }, 500);

  const headers = {
    apikey: SB_KEY,
    Authorization: `Bearer ${SB_KEY}`,
    "Content-Type": "application/json",
  };

  try {
    const [usersRes, dataRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/cupito_users?select=id,business,slug`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/cupito_data?select=user_id,data`, { headers }),
    ]);
    if (!usersRes.ok) return json({ error: "No se pudieron leer los usuarios de Supabase." }, 500);
    if (!dataRes.ok) return json({ error: "No se pudieron leer los datos de Supabase." }, 500);

    const users = (await usersRes.json()) as { id: string; business: string; slug: string }[];
    const rows = (await dataRes.json()) as { user_id: string; data: any }[];
    const dataByUser = new Map(rows.map((r) => [r.user_id, r.data]));

    const tomorrow = artDateKey(new Date(Date.now() + DAY_MS));
    let sent = 0;
    let skippedRecent = 0;
    let skippedNoEmail = 0;
    const errors: string[] = [];

    for (const u of users) {
      if (sent >= MAX_SEND) break;
      const data = dataByUser.get(u.id);
      if (!data) continue;
      const bookings = Array.isArray(data.bookings) ? data.bookings : [];
      const services = Array.isArray(data.services) ? data.services : [];
      const professionals = Array.isArray(data.professionals) ? data.professionals : [];
      let rowDirty = false;

      for (const b of bookings) {
        if (sent >= MAX_SEND) break;
        if (!b || b.date !== tomorrow || b.status !== "confirmada" || b.reminderSentAt) continue;
        const toEmail = String(b.email || "").trim();
        if (!toEmail || !toEmail.includes("@")) {
          skippedNoEmail++;
          continue;
        }
        // Si se reservó a menos de 24 h de la cita, solo vale la confirmación.
        try {
          const appt = new Date(`${b.date}T${b.time}:00-03:00`).getTime();
          if (b.createdAt && appt - Number(b.createdAt) < DAY_MS) {
            b.reminderSentAt = Date.now();
            rowDirty = true;
            skippedRecent++;
            continue;
          }
        } catch {
          /* si no se puede calcular, se manda igual */
        }

        const svc = services.find((s: any) => s.id === b.serviceId);
        const pro = professionals.find((p: any) => p.id === b.proId);
        const firstName = esc(String(b.client || "Hola").trim().split(" ")[0]);
        const lookupUrl = `https://cupito.app/${esc(u.slug)}?buscar=1`;
        const subject = `Recordatorio: tu turno en ${u.business} es mañana — ${b.time} hs`;
        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${esc(subject)}</title></head><body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;padding:40px 16px;"><tr><td align="center"><table role="presentation" width="100%" style="max-width:520px;background-color:#ffffff;border-radius:20px;border:1px solid #e4e4e7;overflow:hidden;" cellspacing="0" cellpadding="0"><tr><td style="padding:32px 36px;"><h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#09090b;">¡Hola ${firstName}, te recordamos tu turno!</h1><p style="margin:0 0 24px;font-size:14.5px;line-height:1.6;color:#52525b;">Mañana te esperamos en <strong>${esc(u.business)}</strong>:</p><table role="presentation" width="100%" style="background-color:#fafafa;border:1px solid #e4e4e7;border-radius:14px;margin-bottom:24px;" cellspacing="0" cellpadding="16"><tr><td><p style="margin:0;font-size:14px;color:#09090b;"><strong>${esc(svc?.name || "Turno")}</strong>${pro ? ` con ${esc(pro.name)}` : ""}</p><p style="margin:8px 0 0;font-size:14px;font-weight:800;color:#047857;">${esc(fmtLongEs(String(b.date)))} · ${esc(String(b.time))} hs</p></td></tr></table><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center"><a href="${lookupUrl}" style="display:inline-block;width:100%;box-sizing:border-box;background-color:#0c241c;color:#ffffff;text-decoration:none;font-size:13.5px;font-weight:700;padding:13px 20px;border-radius:12px;text-align:center;">Ver o cancelar mi turno</a><p style="margin:8px 0 0;font-size:11.5px;color:#71717a;">Se abre directo en «Mis turnos»: si no podés venir, cancelá desde ahí.</p></td></tr></table></td></tr><tr><td style="padding:20px 36px;background-color:#fafafa;text-align:center;"><p style="margin:0;font-size:11px;color:#a1a1aa;">Organizado mediante Cupito · Sistema de reservas online</p></td></tr></table></td></tr></table></body></html>`;

        try {
          const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: RESEND_FROM, to: [toEmail], subject, html }),
          });
          if (!r.ok) {
            errors.push(`${u.slug}/${b.id}: Resend ${r.status}`);
            continue;
          }
          b.reminderSentAt = Date.now();
          rowDirty = true;
          sent++;
        } catch (e) {
          errors.push(`${u.slug}/${b.id}: ${(e as Error).message || "fetch"}`);
        }
      }

      if (rowDirty) {
        try {
          await fetch(`${SUPABASE_URL}/rest/v1/cupito_data?user_id=eq.${encodeURIComponent(u.id)}`, {
            method: "PATCH",
            headers: { ...headers, Prefer: "return=minimal" },
            body: JSON.stringify({ data, updated_at: Date.now() }),
          });
        } catch {
          /* el mail ya salió; el flag local evita duplicados la próxima */
        }
      }
    }

    return json({ ok: true, tomorrow, sent, skippedRecent, skippedNoEmail, errors: errors.slice(0, 10) });
  } catch (e) {
    return json({ error: (e as Error).message || "Error interno" }, 500);
  }
}
