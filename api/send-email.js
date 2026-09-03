export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('RESEND_API_KEY no configurada en Vercel.');
    return res.status(500).json({ error: 'Falta configurar RESEND_API_KEY en las variables de entorno de Vercel' });
  }

  try {
    const { to, subject, html, from } = req.body || {};
    if (!to || !subject || !html) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos: to, subject, html' });
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: from || 'Cupito <hola@cupito.app>',
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Error desde Resend:', data);
      return res.status(response.status).json({ error: data });
    }

    return res.status(200).json({ ok: true, id: data.id });
  } catch (err) {
    console.error('Error enviando email:', err);
    return res.status(500).json({ error: err.message || 'Error interno del servidor' });
  }
}
