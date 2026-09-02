/**
 * POST /api/mp-webhook
 *
 * ⚠️ ESTE ES EL WEBHOOK QUE CONFIGURÁS EN MERCADOPAGO:
 *    https://cupito.app/api/mp-webhook   (o https://TU-PROYECTO.vercel.app/api/mp-webhook)
 *
 * MercadoPago llama a esta URL automáticamente ante cada evento de la suscripción:
 * pago aprobado, pago rechazado, suscripción pausada o cancelada.
 *
 * En MercadoPago → Configuración → Notificaciones → Webhooks:
 *   URL:    https://cupito.app/api/mp-webhook
 *   Evento: "Suscripciones" (preapproval)
 */

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  // MercadoPago hace GET de verificación: respondemos 200 a todo.
  if (req.method !== "POST") return new Response("ok", { status: 200 });

  let body: { type?: string; data?: { id?: string } };
  try {
    body = await req.json();
  } catch {
    return new Response("ok", { status: 200 });
  }

  // Solo nos interesan los eventos de suscripción (preapproval)
  if (body.type !== "preapproval" || !body.data?.id) {
    return new Response("ok", { status: 200 });
  }

  try {
    // 1) Pedimos a MercadoPago el detalle completo de la suscripción
    const mp = await fetch(`https://api.mercadopago.com/preapproval/${body.data.id}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    });
    const sub = await mp.json();

    const ref = String(sub.external_reference ?? "");
    const email: string = (ref.split("::")[0] || sub.payer_email || "").trim();
    const status: string = sub.status ?? ""; // "authorized" | "paused" | "cancelled"
    const blob = `${sub.reason ?? ""} ${ref}`.toLowerCase();
    const planId = blob.includes("escala") ? "escala" : "crece";

    console.log(`[Cupito] Suscripción de ${email} → ${status} (plan ${planId})`);

    if (status === "authorized") {
      // 2) [SUPABASE] Pago aprobado → activar el plan del local:
      // await supabase.from("users").update({ plan: planId }).eq("email", email);
    } else if (status === "paused" || status === "cancelled") {
      // 2b) [SUPABASE] Pago rechazado o cancelado → bajar al plan gratis:
      // await supabase.from("users").update({ plan: "semilla" }).eq("email", email);
    }
  } catch (err) {
    console.error("[Cupito] Error procesando webhook:", err);
  }

  // Siempre 200, si no MercadoPago reintenta el aviso muchas veces.
  return new Response("ok", { status: 200 });
}
