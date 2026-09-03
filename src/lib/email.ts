/**
 * Servicio de envío de emails transaccionales para Cupito vía /api/send-email (Resend).
 * Plantillas con diseño ultra moderno, limpio y profesional estilo Linear/Stripe/Vercel.
 */

interface BookingEmailParams {
  toEmail: string;
  clientName: string;
  businessName: string;
  serviceName: string;
  dateStr: string;
  timeStr: string;
  proName?: string;
  priceStr: string;
  depositStr?: string;
  address?: string;
  slug: string;
  gCalUrl?: string;
}

interface SubscriptionEmailParams {
  toEmail: string;
  ownerName: string;
  businessName: string;
  planName: string;
  planPrice: string;
  slug: string;
}

interface WelcomeAccountEmailParams {
  toEmail: string;
  ownerName: string;
  businessName: string;
  slug: string;
}

/**
 * 1. Email de Confirmación de Turno para el Cliente
 */
export async function sendBookingConfirmationEmail(params: BookingEmailParams) {
  if (!params.toEmail || !params.toEmail.includes("@")) return;

  const subject = `Turno confirmado en ${params.businessName} — ${params.dateStr}`;
  const lookupUrl = `https://cupito.app/${params.slug}?buscar=1`;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background-color:#ffffff;border-radius:20px;border:1px solid #e4e4e7;box-shadow:0 10px 30px rgba(0,0,0,0.04);overflow:hidden;" cellspacing="0" cellpadding="0">
          
          <!-- Header minimalista -->
          <tr>
            <td style="padding:32px 36px 20px;border-bottom:1px solid #f4f4f5;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="left">
                    <img src="https://cupito.app/icon.png" width="28" height="28" style="display:inline-block;vertical-align:middle;border-radius:6px;margin-right:8px;" alt="Cupito" /><span style="font-size:20px;font-weight:900;letter-spacing:-0.5px;color:#0c241c;vertical-align:middle;">cupito<span style="color:#10b981;">.</span></span>
                  </td>
                  <td align="right">
                    <span style="display:inline-block;background-color:#ecfdf5;color:#059669;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;letter-spacing:0.3px;border:1px solid #a7f3d0;">
                      ✓ Confirmado
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Contenido -->
          <tr>
            <td style="padding:32px 36px;">
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#09090b;letter-spacing:-0.4px;">
                ¡Hola ${escapeHtml(params.clientName.trim().split(" ")[0])}!
              </h1>
              <p style="margin:0 0 24px;font-size:14.5px;line-height:1.6;color:#52525b;">
                Tu turno en <strong style="color:#09090b;">${escapeHtml(params.businessName)}</strong> quedó confirmado. A continuación tenés el resumen:
              </p>

              <!-- Tarjeta de Detalles limpia -->
              <table role="presentation" width="100%" style="background-color:#fafafa;border:1px solid #e4e4e7;border-radius:14px;margin-bottom:24px;" cellspacing="0" cellpadding="16">
                <tr>
                  <td>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="6">
                      <tr>
                        <td style="font-size:12px;font-weight:600;color:#71717a;width:35%;">Servicio</td>
                        <td style="font-size:14px;font-weight:700;color:#09090b;">${escapeHtml(params.serviceName)}</td>
                      </tr>
                      ${params.proName ? `
                      <tr>
                        <td style="font-size:12px;font-weight:600;color:#71717a;">Profesional</td>
                        <td style="font-size:14px;font-weight:600;color:#09090b;">${escapeHtml(params.proName)}</td>
                      </tr>` : ""}
                      <tr>
                        <td style="font-size:12px;font-weight:600;color:#71717a;">Fecha y hora</td>
                        <td style="font-size:14px;font-weight:800;color:#047857;">${escapeHtml(params.dateStr)} · ${escapeHtml(params.timeStr)} hs</td>
                      </tr>
                      <tr>
                        <td style="font-size:12px;font-weight:600;color:#71717a;">Total</td>
                        <td style="font-size:14px;font-weight:700;color:#09090b;">${escapeHtml(params.priceStr)}</td>
                      </tr>
                      ${params.depositStr ? `
                      <tr>
                        <td style="font-size:12px;font-weight:600;color:#71717a;">Seña previa</td>
                        <td style="font-size:13px;font-weight:700;color:#047857;">${escapeHtml(params.depositStr)} (verificada ✓)</td>
                      </tr>` : ""}
                      ${params.address ? `
                      <tr>
                        <td style="font-size:12px;font-weight:600;color:#71717a;">Dirección</td>
                        <td style="font-size:13px;color:#09090b;">${escapeHtml(params.address)}</td>
                      </tr>` : ""}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Botones de Acción -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:20px;">
                ${params.gCalUrl ? `
                <tr>
                  <td align="center" style="padding-bottom:10px;">
                    <a href="${params.gCalUrl}" target="_blank" style="display:inline-block;width:100%;box-sizing:border-box;background-color:#0c241c;color:#ffffff;text-decoration:none;font-size:13.5px;font-weight:700;padding:13px 20px;border-radius:12px;text-align:center;">
                      📅 Guardar en Google Calendar
                    </a>
                  </td>
                </tr>` : ""}
                <tr>
                  <td align="center">
                    <a href="${lookupUrl}" target="_blank" style="display:inline-block;width:100%;box-sizing:border-box;background-color:#ffffff;color:#18181b;text-decoration:none;font-size:13px;font-weight:600;padding:11px 20px;border-radius:12px;text-align:center;border:1px solid #d4d4d8;">
                      Gestionar o cancelar mi turno
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:12px;color:#71717a;line-height:1.5;text-align:center;">
                Si tenés alguna consulta, contactate directamente con <strong>${escapeHtml(params.businessName)}</strong>.
              </p>
            </td>
          </tr>

          <!-- Footer minimalista -->
          <tr>
            <td style="padding:20px 36px;background-color:#fafafa;border-top:1px solid #f4f4f5;text-align:center;">
              <p style="margin:0;font-size:11px;color:#a1a1aa;">
                Organizado mediante <a href="https://cupito.app" style="color:#52525b;text-decoration:none;font-weight:600;">Cupito</a> · Sistema de reservas online
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  return sendViaApi({ to: params.toEmail, subject, html });
}

/**
 * 2. Email de Bienvenida cuando el Dueño Registra su Cuenta
 */
export async function sendWelcomeAccountEmail(params: WelcomeAccountEmailParams) {
  if (!params.toEmail || !params.toEmail.includes("@")) return;

  const subject = `Bienvenido a Cupito — Tu página para ${params.businessName} está lista`;
  const adminUrl = "https://cupito.app/#/app";
  const publicUrl = `https://cupito.app/${params.slug}`;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background-color:#ffffff;border-radius:20px;border:1px solid #e4e4e7;box-shadow:0 10px 30px rgba(0,0,0,0.04);overflow:hidden;" cellspacing="0" cellpadding="0">
          
          <!-- Header -->
          <tr>
            <td style="padding:32px 36px 20px;border-bottom:1px solid #f4f4f5;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="left">
                    <img src="https://cupito.app/icon.png" width="28" height="28" style="display:inline-block;vertical-align:middle;border-radius:6px;margin-right:8px;" alt="Cupito" /><span style="font-size:20px;font-weight:900;letter-spacing:-0.5px;color:#0c241c;vertical-align:middle;">cupito<span style="color:#10b981;">.</span></span>
                  </td>
                  <td align="right">
                    <span style="display:inline-block;background-color:#f4f4f5;color:#52525b;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;letter-spacing:0.3px;">
                      Cuenta lista
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Contenido -->
          <tr>
            <td style="padding:32px 36px;">
              <h1 style="margin:0 0 10px;font-size:22px;font-weight:800;color:#09090b;letter-spacing:-0.4px;">
                ¡Hola ${escapeHtml(params.ownerName.trim().split(" ")[0] || params.businessName)}!
              </h1>
              <p style="margin:0 0 24px;font-size:14.5px;line-height:1.6;color:#52525b;">
                Tu cuenta para <strong style="color:#09090b;">${escapeHtml(params.businessName)}</strong> ya está creada. Tus clientes ya pueden reservar sin que tengas que coordinar nada a mano.
              </p>

              <!-- Tarjeta de tu Link Oficial -->
              <table role="presentation" width="100%" style="background-color:#0c241c;border-radius:14px;margin-bottom:28px;" cellspacing="0" cellpadding="20">
                <tr>
                  <td>
                    <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:1px;">Tu link oficial de reservas</p>
                    <a href="${publicUrl}" target="_blank" style="display:block;font-size:15px;font-weight:700;color:#cdf463;text-decoration:none;word-break:break-all;">${publicUrl}</a>
                  </td>
                </tr>
              </table>

              <!-- 3 Pasos Clave -->
              <p style="margin:0 0 14px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#71717a;">3 pasos para empezar:</p>
              
              <table role="presentation" width="100%" cellspacing="0" cellpadding="10" style="margin-bottom:28px;">
                <tr>
                  <td style="vertical-align:top;width:28px;padding-left:0;">
                    <div style="width:24px;height:24px;border-radius:50%;background-color:#f4f4f5;color:#18181b;font-weight:700;font-size:12px;text-align:center;line-height:24px;">1</div>
                  </td>
                  <td style="font-size:13.5px;color:#3f3f46;line-height:1.5;">
                    <strong style="color:#09090b;">Personalizá tus servicios y precios</strong> desde la pestaña «Servicios» de tu panel.
                  </td>
                </tr>
                <tr>
                  <td style="vertical-align:top;width:28px;padding-left:0;">
                    <div style="width:24px;height:24px;border-radius:50%;background-color:#f4f4f5;color:#18181b;font-weight:700;font-size:12px;text-align:center;line-height:24px;">2</div>
                  </td>
                  <td style="font-size:13.5px;color:#3f3f46;line-height:1.5;">
                    <strong style="color:#09090b;">Pegá tu link</strong> en la bio de tu Instagram y en tu mensaje de WhatsApp Business.
                  </td>
                </tr>
                <tr>
                  <td style="vertical-align:top;width:28px;padding-left:0;">
                    <div style="width:24px;height:24px;border-radius:50%;background-color:#f4f4f5;color:#18181b;font-weight:700;font-size:12px;text-align:center;line-height:24px;">3</div>
                  </td>
                  <td style="font-size:13.5px;color:#3f3f46;line-height:1.5;">
                    <strong style="color:#09090b;">Imprimí tu cartel con código QR</strong> en A4 con un clic para exhibir en tu mostrador o espejo.
                  </td>
                </tr>
              </table>

              <!-- Botón Ir al Panel -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <a href="${adminUrl}" target="_blank" style="display:inline-block;width:100%;box-sizing:border-box;background-color:#0c241c;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 24px;border-radius:12px;text-align:center;">
                      Entrar a mi panel de control →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:12.5px;color:#71717a;line-height:1.5;text-align:center;">
                ¿Tenés alguna duda o necesitás ayuda configurando? Escribinos por WhatsApp al <strong>+54 9 11 3199-6205</strong> o respondé directamente a este correo.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px;background-color:#fafafa;border-top:1px solid #f4f4f5;text-align:center;">
              <p style="margin:0;font-size:11px;color:#a1a1aa;">
                Cupito · Hecho en Argentina 🇦🇷 · <a href="https://cupito.app" style="color:#52525b;text-decoration:none;font-weight:600;">cupito.app</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  return sendViaApi({ to: params.toEmail, subject, html });
}

/**
 * 3. Email de Activación de Suscripción Paga
 */
export async function sendSubscriptionWelcomeEmail(params: SubscriptionEmailParams) {
  if (!params.toEmail || !params.toEmail.includes("@")) return;

  const subject = `Tu suscripción a Cupito ${params.planName} está activa 🚀`;
  const adminUrl = "https://cupito.app/#/app";
  const publicUrl = `https://cupito.app/${params.slug}`;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background-color:#ffffff;border-radius:20px;border:1px solid #e4e4e7;box-shadow:0 10px 30px rgba(0,0,0,0.04);overflow:hidden;" cellspacing="0" cellpadding="0">
          
          <!-- Header -->
          <tr>
            <td style="padding:32px 36px 20px;border-bottom:1px solid #f4f4f5;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="left">
                    <img src="https://cupito.app/icon.png" width="28" height="28" style="display:inline-block;vertical-align:middle;border-radius:6px;margin-right:8px;" alt="Cupito" /><span style="font-size:20px;font-weight:900;letter-spacing:-0.5px;color:#0c241c;vertical-align:middle;">cupito<span style="color:#10b981;">.</span></span>
                  </td>
                  <td align="right">
                    <span style="display:inline-block;background-color:#ecfdf5;color:#059669;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;letter-spacing:0.3px;border:1px solid #a7f3d0;">
                      Plan ${escapeHtml(params.planName)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Contenido -->
          <tr>
            <td style="padding:32px 36px;">
              <h1 style="margin:0 0 10px;font-size:22px;font-weight:800;color:#09090b;letter-spacing:-0.4px;">
                ¡Suscripción confirmada!
              </h1>
              <p style="margin:0 0 24px;font-size:14.5px;line-height:1.6;color:#52525b;">
                Hola <strong style="color:#09090b;">${escapeHtml(params.ownerName.trim().split(" ")[0] || params.businessName)}</strong>, te confirmamos que tu suscripción al plan <strong style="color:#09090b;">${escapeHtml(params.planName)} (${escapeHtml(params.planPrice)})</strong> para <strong style="color:#09090b;">${escapeHtml(params.businessName)}</strong> ya está activa.
              </p>

              <!-- Tarjeta de tu Link Oficial -->
              <table role="presentation" width="100%" style="background-color:#0c241c;border-radius:14px;margin-bottom:28px;" cellspacing="0" cellpadding="20">
                <tr>
                  <td>
                    <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:1px;">Tu link de reservas oficial</p>
                    <a href="${publicUrl}" target="_blank" style="display:block;font-size:15px;font-weight:700;color:#cdf463;text-decoration:none;word-break:break-all;">${publicUrl}</a>
                  </td>
                </tr>
              </table>

              <!-- Botón Ir al Panel -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <a href="${adminUrl}" target="_blank" style="display:inline-block;width:100%;box-sizing:border-box;background-color:#0c241c;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 24px;border-radius:12px;text-align:center;">
                      Ir a mi panel de control →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:12.5px;color:#71717a;line-height:1.5;text-align:center;">
                ¿Necesitás ayuda o tenés alguna duda? Respondé a este email o contactanos por WhatsApp al <strong>+54 9 11 3199-6205</strong>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px;background-color:#fafafa;border-top:1px solid #f4f4f5;text-align:center;">
              <p style="margin:0;font-size:11px;color:#a1a1aa;">
                Cupito · Hecho en Argentina 🇦🇷 · <a href="https://cupito.app" style="color:#52525b;text-decoration:none;font-weight:600;">cupito.app</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  return sendViaApi({ to: params.toEmail, subject, html });
}

async function sendViaApi(body: { to: string; subject: string; html: string; from?: string }) {
  try {
    const res = await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn("No se pudo enviar el email:", err);
      return { ok: false, error: err };
    }
    const data = await res.json();
    return { ok: true, id: data.id };
  } catch (err) {
    console.warn("Fallo en la llamada a /api/send-email:", err);
    return { ok: false, error: err };
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

