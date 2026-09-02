/**
 * POST /api/confirm-subscription
 * El usuario vuelve de MercadoPago; verificamos si la suscripción quedó autorizada.
 *
 * Variables: MP_ACCESS_TOKEN
 */

export const config = { runtime: "edge" };

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
}

function planFromReason(reason: string, ref: string): "crece" | "escala" {
  const blob = `${reason} ${ref}`.toLowerCase();
  return blob.includes("escala") ? "escala" : "crece";
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const id = String(body.id || "").trim();
  if (!id) return json({ error: "Falta el id de la suscripción." }, 400);

  const TOKEN = process.env.MP_ACCESS_TOKEN;
  if (!TOKEN) return json({ error: "Falta MP_ACCESS_TOKEN." }, 500);

  try {
    const mp = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const sub = await mp.json();
    if (!mp.ok) return json({ error: sub.message || "MercadoPago no encontró la suscripción." }, 400);

    const status = String(sub.status ?? "");
    const plan = planFromReason(String(sub.reason ?? ""), String(sub.external_reference ?? ""));
    return json({
      authorized: status === "authorized",
      status,
      plan,
      email: sub.payer_email ?? null,
    });
  } catch {
    return json({ error: "No se pudo conectar con MercadoPago." }, 500);
  }
}
