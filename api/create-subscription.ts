/**
 * POST /api/create-subscription
 * Crea una suscripción (preapproval) en MercadoPago y devuelve la URL de checkout.
 *
 * Variables de entorno en Vercel (Settings → Environment Variables):
 *   MP_ACCESS_TOKEN = tu token de MercadoPago (APP_USR-... en producción, TEST-... en sandbox)
 *   PUBLIC_URL      = https://cupito.app (tu dominio o la URL de Vercel)
 *
 * Si falta el token, responde { demo: true }. El frontend NO activa el plan.
 */

export const config = { runtime: "edge" };

const PLANS = {
  crece: { mensual: 9900, anual: 112800 }, // 9.400/mes × 12
  escala: { mensual: 23000, anual: 220800 }, // 18.400/mes × 12
} as const;

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  let body: { plan?: keyof typeof PLANS; billing?: "mensual" | "anual"; email?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const plan = body.plan;
  const billing = body.billing === "anual" ? "anual" : "mensual";
  if (!plan || !(plan in PLANS)) return json({ error: "Plan inválido" }, 400);

  const TOKEN = process.env.MP_ACCESS_TOKEN;
  if (!TOKEN) return json({ demo: true, reason: "Falta MP_ACCESS_TOKEN en Vercel → modo demo." });

  const originHeader = req.headers.get("origin") || req.headers.get("referer");
  let origin = "";
  if (originHeader) {
    try {
      const u = new URL(originHeader);
      origin = `${u.protocol}//${u.host}`;
    } catch { /* ignore */ }
  }

  const PUBLIC_URL = process.env.PUBLIC_URL || origin || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://cupito.app");
  const amount = PLANS[plan][billing];

  const payload: Record<string, unknown> = {
    reason: `Cupito — Plan ${plan === "crece" ? "Crece" : "Escala"} (${billing})`,
    external_reference: `${body.email || "anon"}::${plan}::${billing}`,
    back_url: `${PUBLIC_URL}/#/app`,
    status: "pending",
    auto_recurring: {
      frequency: billing === "mensual" ? 1 : 12,
      frequency_type: "months",
      transaction_amount: amount,
      currency_id: "ARS",
    },
  };

  if (body.email && /^\S+@\S+\.\S+$/.test(body.email)) {
    payload.payer_email = body.email;
  }

  try {
    const res = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify(payload),
    });

    const d = await res.json();
    const url = d.init_point || d.sandbox_init_point;
    if (!res.ok || !url) return json({ demo: false, error: d.message || d.cause?.[0]?.description || "MercadoPago rechazó la suscripción." }, 400);

    return json({ init_point: url, sandbox_init_point: d.sandbox_init_point ?? null });
  } catch {
    return json({ demo: false, error: "No se pudo conectar con MercadoPago." }, 500);
  }
}
