/**
 * POST /api/cancel-subscription
 * Cancela la suscripción en MercadoPago de verdad (deja de cobrar).
 *
 * Body: { id?: preapprovalId, email?: payerEmail }
 *  - Si viene id, cancela directo: PUT /preapproval/:id { status: "cancelled" }.
 *  - Si no, busca por payer_email y cancela la primera autorizada/pendiente.
 *
 * Variables: MP_ACCESS_TOKEN
 */

export const config = { runtime: "edge" };

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  let body: { id?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const TOKEN = process.env.MP_ACCESS_TOKEN;
  if (!TOKEN) return json({ error: "Falta MP_ACCESS_TOKEN en Vercel." }, 500);

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` };
  let targetId = String(body.id || "").trim();

  try {
    // Fallback: buscar la suscripción por email del pagador
    if (!targetId && body.email) {
      const s = await fetch(
        `https://api.mercadopago.com/preapproval/search?payer_email=${encodeURIComponent(body.email.trim())}&sort=id:desc`,
        { headers }
      );
      const d = await s.json();
      const found = (d.results || []).find((r: any) => r.status === "authorized" || r.status === "pending" || r.status === "paused");
      if (found?.id) targetId = String(found.id);
    }

    if (!targetId) {
      return json({ error: "No encontramos una suscripción activa en Mercado Pago para esta cuenta." }, 404);
    }

    const cancel = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(targetId)}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ status: "cancelled" }),
    });
    const c = await cancel.json().catch(() => ({}));
    if (!cancel.ok) {
      return json({ error: c.message || "Mercado Pago rechazó la cancelación." }, 400);
    }

    return json({ ok: true, id: targetId, status: c.status || "cancelled" });
  } catch {
    return json({ error: "No se pudo conectar con MercadoPago." }, 500);
  }
}
