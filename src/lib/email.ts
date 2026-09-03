/**
 * Servicio de envío de emails transaccionales para Cupito vía /api/send-email (Resend).
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

/**
 * Envía email de confirmación de turno al cliente
 */
export async function sendBookingConfirmationEmail(params: BookingEmailParams) {
  if (!params.toEmail || !params.toEmail.includes("@")) return;

  const subject = `Tu turno en ${params.businessName} está confirmado 🎉`;
  const lookupUrl = `https://cupito.app/${params.slug}?buscar=1`;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f7f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0c241c;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f7f5f0;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:540px;background-color:#ffffff;border-radius:24px;border:2px solid rgba(12,36,28,0.08);box-shadow:0 12px 30px rgba(12,36,28,0.06);overflow:hidden;" cellspacing="0" cellpadding="0">
          
          <!-- Encabezado con marca -->
          <tr>
            <td style="background-color:#0c241c;padding:28px 32px;text-align:center;">
              <span style="display:inline-block;font-size:22px;font-weight:900;color:#cdf463;letter-spacing:-0.5px;">Cupito</span>
              <span style="display:block;font-size:12px;font-weight:600;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:2px;margin-top:4px;">Turno Confirmado</span>
            </td>
          </tr>

          <!-- Cuerpo -->
          <tr>
            <td style="padding:32px 32px 24px;">
              <h1 style="margin:0 0 12px;font-size:24px;font-weight:800;color:#0c241c;letter-spacing:-0.5px;">¡Hola ${escapeHtml(params.clientName.trim().split(" ")[0])}!</h1>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#4a6358;">
                Tu turno en <strong style="color:#0c241c;">${escapeHtml(params.businessName)}</strong> quedó agendado con éxito. Te esperamos en el horario indicado.
              </p>

              <!-- Tarjeta de Detalles del Turno -->
              <table role="presentation" width="100%" style="background-color:#fdfbf7;border:2px solid #ede7db;border-radius:18px;margin-bottom:24px;" cellspacing="0" cellpadding="16">
                <tr>
                  <td>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="6">
                      <tr>
                        <td style="font-size:12px;font-weight:700;color:#85998e;text-transform:uppercase;letter-spacing:1px;width:35%;">Servicio</td>
                        <td style="font-size:15px;font-weight:800;color:#0c241c;">${escapeHtml(params.serviceName)}</td>
                      </tr>
                      ${params.proName ? `
                      <tr>
                        <td style="font-size:12px;font-weight:700;color:#85998e;text-transform:uppercase;letter-spacing:1px;">Atiende</td>
                        <td style="font-size:14px;font-weight:700;color:#0c241c;">${escapeHtml(params.proName)}</td>
                      </tr>` : ""}
                      <tr>
                        <td style="font-size:12px;font-weight:700;color:#85998e;text-transform:uppercase;letter-spacing:1px;">Fecha y Hora</td>
                        <td style="font-size:15px;font-weight:800;color:#1e5c49;">${escapeHtml(params.dateStr)} · ${escapeHtml(params.timeStr)} hs</td>
                      </tr>
                      <tr>
                        <td style="font-size:12px;font-weight:700;color:#85998e;text-transform:uppercase;letter-spacing:1px;">Total</td>
                        <td style="font-size:15px;font-weight:800;color:#0c241c;">${escapeHtml(params.priceStr)}</td>
                      </tr>
                      ${params.depositStr ? `
                      <tr>
                        <td style="font-size:12px;font-weight:700;color:#85998e;text-transform:uppercase;letter-spacing:1px;">Seña abonada</td>
                        <td style="font-size:13px;font-weight:700;color:#1e5c49;">${escapeHtml(params.depositStr)} (verificada ✓)</td>
                      </tr>` : ""}
                      ${params.address ? `
                      <tr>
                        <td style="font-size:12px;font-weight:700;color:#85998e;text-transform:uppercase;letter-spacing:1px;">Lugar</td>
                        <td style="font-size:13px;color:#0c241c;">${escapeHtml(params.address)}</td>
                      </tr>` : ""}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Botones de Acción -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
                ${params.gCalUrl ? `
                <tr>
                  <td align="center" style="padding-bottom:12px;">
                    <a href="${params.gCalUrl}" target="_blank" style="display:inline-block;width:100%;box-sizing:border-box;background-color:#0c241c;color:#cdf463;text-decoration:none;font-size:14px;font-weight:800;padding:14px 20px;border-radius:14px;text-align:center;">
                      📅 Agregar a Google Calendar
                    </a>
                  </td>
                </tr>` : ""}
                <tr>
                  <td align="center">
                    <a href="${lookupUrl}" target="_blank" style="display:inline-block;width:100%;box-sizing:border-box;background-color:#ffffff;color:#0c241c;text-decoration:none;font-size:13px;font-weight:700;padding:12px 20px;border-radius:14px;text-align:center;border:2px solid rgba(12,36,28,0.15);">
                      🔍 Ver mis turnos o cancelar
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:12px;color:#85998e;line-height:1.5;text-align:center;">
                Si necesitás avisar algo a <strong>${escapeHtml(params.businessName)}</strong>, comunicate directo con ellos por WhatsApp.
              </p>
            </td>
          </tr>

          <!-- Pie -->
          <tr>
            <td style="background-color:#fdfbf7;border-top:1px solid #ede7db;padding:18px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#a3b2aa;">
                Organizado con <a href="https://cupito.app" style="color:#1e5c49;text-decoration:none;font-weight:700;">Cupito</a> · Turnos online sin vueltas
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
 * Envía email de bienvenida y confirmación de suscripción al dueño del negocio
 */
export async function sendSubscriptionWelcomeEmail(params: SubscriptionEmailParams) {
  if (!params.toEmail || !params.toEmail.includes("@")) return;

  const subject = `¡Tu suscripción a Cupito ${params.planName} está activa! 🚀`;
  const adminUrl = "https://cupito.app/#/admin";
  const publicUrl = `https://cupito.app/${params.slug}`;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f7f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0c241c;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f7f5f0;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:540px;background-color:#ffffff;border-radius:24px;border:2px solid rgba(12,36,28,0.08);box-shadow:0 12px 30px rgba(12,36,28,0.06);overflow:hidden;" cellspacing="0" cellpadding="0">
          
          <!-- Encabezado con marca -->
          <tr>
            <td style="background-color:#0c241c;padding:28px 32px;text-align:center;">
              <span style="display:inline-block;font-size:24px;font-weight:900;color:#cdf463;letter-spacing:-0.5px;">Cupito</span>
              <span style="display:block;font-size:12px;font-weight:700;color:#cdf463;background-color:rgba(205,244,99,0.15);padding:4px 12px;border-radius:20px;display:inline-block;margin-top:8px;">Plan ${escapeHtml(params.planName)} Activado</span>
            </td>
          </tr>

          <!-- Cuerpo -->
          <tr>
            <td style="padding:32px 32px 24px;">
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#0c241c;letter-spacing:-0.5px;">¡Hola ${escapeHtml(params.ownerName.trim().split(" ")[0] || params.businessName)}!</h1>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#4a6358;">
                Te confirmamos que tu suscripción al plan <strong style="color:#0c241c;">${escapeHtml(params.planName)} (${escapeHtml(params.planPrice)})</strong> para <strong style="color:#0c241c;">${escapeHtml(params.businessName)}</strong> ya está 100% activa.
              </p>

              <!-- Tarjeta de tu Link Oficial -->
              <table role="presentation" width="100%" style="background-color:#0c241c;border-radius:18px;margin-bottom:24px;" cellspacing="0" cellpadding="20">
                <tr>
                  <td>
                    <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:1.5px;">Tu link oficial de reservas</p>
                    <a href="${publicUrl}" target="_blank" style="display:block;font-size:16px;font-weight:800;color:#cdf463;text-decoration:none;word-break:break-all;">${publicUrl}</a>
                  </td>
                </tr>
              </table>

              <!-- 3 Pasos Clave -->
              <h3 style="margin:0 0 14px;font-size:15px;font-weight:800;color:#0c241c;">Los 3 pasos para poner a volar tu agenda:</h3>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="8" style="margin-bottom:24px;">
                <tr>
                  <td style="font-size:18px;vertical-align:top;width:28px;">1.</td>
                  <td style="font-size:14px;color:#4a6358;line-height:1.4;">
                    <strong style="color:#0c241c;">Copiá y pegá tu link</strong> en la bio de tu Instagram y en tu mensaje de bienvenida de WhatsApp Business.
                  </td>
                </tr>
                <tr>
                  <td style="font-size:18px;vertical-align:top;">2.</td>
                  <td style="font-size:14px;color:#4a6358;line-height:1.4;">
                    <strong style="color:#0c241c;">Imprimí tu cartel de mostrador</strong> con código QR desde tu panel con un solo clic.
                  </td>
                </tr>
                <tr>
                  <td style="font-size:18px;vertical-align:top;">3.</td>
                  <td style="font-size:14px;color:#4a6358;line-height:1.4;">
                    <strong style="color:#0c241c;">Tus clientes reservan solos</strong> y pagan la seña mientras vos atendés o descansás.
                  </td>
                </tr>
              </table>

              <!-- Botón Ir al Panel -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <a href="${adminUrl}" target="_blank" style="display:inline-block;width:100%;box-sizing:border-box;background-color:#0c241c;color:#cdf463;text-decoration:none;font-size:15px;font-weight:800;padding:15px 24px;border-radius:14px;text-align:center;">
                      Entrar a mi Panel de Control →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#85998e;line-height:1.5;">
                ¿Tenés alguna duda o necesitás una mano? Respondé directamente a este email o escribinos por WhatsApp al <strong>+54 9 11 3199-6205</strong>. ¡Estamos para ayudarte!
              </p>
            </td>
          </tr>

          <!-- Pie -->
          <tr>
            <td style="background-color:#fdfbf7;border-top:1px solid #ede7db;padding:18px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#a3b2aa;">
                Cupito · Hecho en Argentina 🇦🇷 · <a href="https://cupito.app" style="color:#1e5c49;text-decoration:none;">cupito.app</a>
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
      console.warn("No se pudo enviar el email (revisá RESEND_API_KEY en Vercel):", err);
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
