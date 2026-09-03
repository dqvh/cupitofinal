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

import { createClient } from "@supabase/supabase-js";

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

    const sUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const sKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (sUrl && sKey) {
      const supabase = createClient(sUrl, sKey);
      if (status === "authorized") {
        await supabase.from("cupito_users").update({ plan: planId }).eq("email", email);
        // Bienvenida por email (cubre al que pagó y cerró la pestaña sin volver).
        // El flujo normal ya la manda desde el front; acá es respaldo.
        const resendKey = process.env.RESEND_API_KEY;
        if (resendKey && email.includes("@")) {
          const benefits =
            planId === "escala"
              ? ["Todo lo del plan Crece", "Profesionales ilimitados", "Lista de espera con prioridad", "Estadísticas avanzadas y Excel", "Soporte preferencial"]
              : ["Reservas ilimitadas", "Hasta 3 profesionales", "Seña por transferencia", "Tienda y cupones", "Página con tus colores", "Confirmación y recordatorio por email"];
          const planName = planId === "escala" ? "Escala" : "Crece";
          try {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: process.env.RESEND_FROM || "Cupito <hola@cupito.app>",
                to: [email],
                subject: `Tu suscripción a Cupito ${planName} está activa 🚀`,
                html: `<!DOCTYPE html><html lang="es"><body style="margin:0;padding:0;background-color:#f4f4f5;font-family:sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 16px;"><tr><td align="center"><table width="100%" style="max-width:520px;background-color:#ffffff;border-radius:20px;padding:32px 36px;" cellpadding="0" cellspacing="0"><tr><td><h1 style="font-size:22px;color:#09090b;">¡Suscripción confirmada! 🎉</h1><p style="font-size:14.5px;color:#52525b;">Tu plan <strong>${planName}</strong> ya está activo. Entrá a tu panel: <a href="https://cupito.app/#/app">cupito.app/#/app</a></p><p style="font-size:13px;font-weight:700;color:#71717a;">LO QUE SE ACTIVA:</p><ul style="font-size:13.5px;color:#3f3f46;">${benefits.map((b) => `<li>${b}</li>`).join("")}</ul></td></tr></table></td></tr></table></body></html>`,
              }),
            });
          } catch {
            /* el plan ya quedó activo; el email es cortesía */
          }
        }
      } else if (status === "paused" || status === "cancelled") {
        await supabase.from("cupito_users").update({ plan: "semilla" }).eq("email", email);
      }
    }
  } catch (err) {
    console.error("[Cupito] Error procesando webhook:", err);
  }

  // Siempre 200, si no MercadoPago reintenta el aviso muchas veces.
  return new Response("ok", { status: 200 });
}
