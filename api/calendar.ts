/**
 * GET /api/calendar?id=USER_ID o GET /api/calendar?slug=SLUG
 * Feed de calendario en vivo en formato iCalendar (.ics / webcal).
 * Permite que los dueños de negocio sincronicen sus turnos en tiempo real
 * con la app de Calendario de su celular (Apple Calendar en iPhone, Google Calendar en Android, etc.).
 */

export const config = { runtime: "edge" };

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toUtcIcal(dateStr: string, timeStr: string, durMin: number): { start: string; end: string } {
  // Fechas en Cupito son hora argentina (UTC-3)
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = (timeStr || "10:00").split(":").map(Number);
  // UTC sumando 3 horas para la diferencia horaria argentina
  const startMs = Date.UTC(y, m - 1, d, hh + 3, mm, 0);
  const endMs = startMs + Math.max(durMin, 15) * 60 * 1000;

  const fmt = (ms: number) => {
    const dt = new Date(ms);
    return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}00Z`;
  };

  return { start: fmt(startMs), end: fmt(endMs) };
}

function escapeIcal(text: string): string {
  return (text || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("id") || "";
  const slug = searchParams.get("slug") || "";

  if (!userId && !slug) {
    return new Response("Falta parámetro id o slug del negocio", { status: 400 });
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    "";

  if (!url || !key) {
    return new Response("Nube no configurada en el servidor", { status: 500 });
  }

  const H = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };

  try {
    // 1. Obtener usuario
    const userFilter = userId ? `id=eq.${encodeURIComponent(userId)}` : `slug=eq.${encodeURIComponent(slug)}`;
    const uRes = await fetch(`${url}/rest/v1/cupito_users?select=id,business,slug,deleted&${userFilter}&limit=1`, { headers: H });
    if (!uRes.ok) return new Response("Negocio no encontrado", { status: 404 });
    const users = (await uRes.json()) as any[];
    if (!users || users.length === 0 || users[0].deleted) {
      return new Response("Negocio no disponible", { status: 404 });
    }
    const user = users[0];

    // 2. Obtener datos (servicios y turnos)
    const dRes = await fetch(`${url}/rest/v1/cupito_data?select=data&user_id=eq.${encodeURIComponent(user.id)}&limit=1`, { headers: H });
    const dRows = (await dRes.json().catch(() => [])) as any[];
    const bizData = dRows?.[0]?.data || {};
    const services = Array.isArray(bizData.services) ? bizData.services : [];
    const bookings = Array.isArray(bizData.bookings) ? bizData.bookings : [];
    const pros = Array.isArray(bizData.professionals) ? bizData.professionals : [];

    const now = new Date();
    const nowUtc = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}00Z`;

    const activeBookings = bookings.filter((b: any) => b && b.date && b.status !== "cancelada");

    const events: string[] = [];
    for (const b of activeBookings) {
      const srv = services.find((s: any) => s.id === b.serviceId);
      const srvName = srv?.name || "Turno";
      const srvDur = Number(srv?.duration || 45);
      const pro = pros.find((p: any) => p.id === b.proId);

      const { start, end } = toUtcIcal(b.date, b.time, srvDur);

      const summary = `${srvName} - ${b.client || "Cliente"}`;
      const descLines = [
        `Cliente: ${b.client || "Sin nombre"}`,
        `Teléfono: ${b.phone || "No indicado"}`,
        `Servicio: ${srvName}`,
        srv?.price ? `Precio: $${Number(srv.price).toLocaleString("es-AR")}` : "",
        pro?.name ? `Profesional: ${pro.name}` : "",
        b.notes ? `Notas: ${b.notes}` : "",
        `Estado: ${b.status === "confirmada" ? "Confirmada ✓" : "Pendiente de seña"}`,
        "Gestionado con Cupito (https://cupito.app)",
      ].filter(Boolean);

      events.push([
        "BEGIN:VEVENT",
        `UID:cupito-${b.id || Math.random().toString(36)}@cupito.app`,
        `DTSTAMP:${nowUtc}`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${escapeIcal(summary)}`,
        `DESCRIPTION:${escapeIcal(descLines.join("\n"))}`,
        b.status === "confirmada" ? "STATUS:CONFIRMED" : "STATUS:TENTATIVE",
        "END:VEVENT",
      ].join("\r\n"));
    }

    const ical = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Cupito//Cupito Reservas//ES",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:Cupito - ${escapeIcal(user.business || "Mi Agenda")}`,
      "X-WR-TIMEZONE:America/Argentina/Buenos_Aires",
      "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
      "X-PUBLISHED-TTL:PT15M",
      ...events,
      "END:VCALENDAR",
    ].join("\r\n");

    return new Response(ical, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `inline; filename="cupito-${user.slug || "agenda"}.ics"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: any) {
    return new Response(`Error generando calendario: ${err?.message || err}`, { status: 500 });
  }
}
