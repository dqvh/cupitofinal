/**
 * POST /api/admin
 * Acciones del panel Central (super-admin) con service role.
 * Guard: body.adminKey debe coincidir con CUPITO_ADMIN_KEY (env en Vercel).
 * La clave se carga una vez en la Central y queda en sessionStorage del navegador.
 *
 * { action: "provision", adminKey, name, business, email, password, plan, billing?, durationDays? }
 *   Da de alta un negocio: crea auth user + fila cupito_users + fila cupito_data.
 *   Responde { ok, user }.
 * { action: "set-plan", adminKey, userId, plan }
 * { action: "update-user", adminKey, userId, updates: {name?,business?,slug?,plan?} }
 * { action: "delete-user", adminKey, userId }  (soft-delete: deleted=true)
 *
 * Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (o SECRET), CUPITO_ADMIN_KEY.
 */

export const config = { runtime: "edge" };

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
}

function slugify(s: string): string {
  return (
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") ||
    "mi-negocio"
  );
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const url = process.env.SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
  const adminKey = process.env.CUPITO_ADMIN_KEY || "";
  if (!url || !serviceKey) return json({ error: "Falta configuración de Supabase en el servidor." }, 500);
  if (!adminKey) return json({ error: "Falta configurar CUPITO_ADMIN_KEY en Vercel." }, 500);
  if (body.adminKey !== adminKey) return json({ error: "Clave de Central incorrecta." }, 403);

  const H = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };

  try {
    /* ---------------- PROVISION ---------------- */
    if (body.action === "provision") {
      const name = String(body.name || "").trim().slice(0, 60);
      const business = String(body.business || "").trim().slice(0, 80);
      const email = String(body.email || "").toLowerCase().trim();
      const password = String(body.password || "");
      const plan = body.plan === "escala" ? "escala" : body.plan === "crece" ? "crece" : "semilla";
      if (name.length < 2 || business.length < 2) return json({ error: "Faltan datos." }, 400);
      if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: "Email inválido." }, 400);
      if (password.length < 6) return json({ error: "La contraseña necesita 6+ caracteres." }, 400);

      // Email único
      const exRes = await fetch(`${url}/rest/v1/cupito_users?select=id&email=eq.${encodeURIComponent(email)}`, { headers: H });
      const exRows = (await exRes.json().catch(() => [])) as any[];
      if (Array.isArray(exRows) && exRows.length > 0) {
        return json({ error: "Ya existe un negocio con ese email." }, 409);
      }

      // Auth user
      const createRes = await fetch(`${url}/auth/v1/admin/users`, {
        method: "POST",
        headers: H,
        body: JSON.stringify({ email, password, email_confirm: true }),
      });
      const created = await createRes.json().catch(() => ({}));
      if (!createRes.ok || !created?.id) {
        return json({ error: "No se pudo crear el login (¿email ya usado en Auth?)." }, 400);
      }
      const authId = String(created.id);

      // Slug único
      let slug = slugify(business);
      const base = slug;
      let i = 1;
      for (;;) {
        const sRes = await fetch(`${url}/rest/v1/cupito_users?select=id&slug=eq.${encodeURIComponent(slug)}`, { headers: H });
        const sRows = (await sRes.json().catch(() => [])) as any[];
        if (!Array.isArray(sRows) || sRows.length === 0) break;
        slug = `${base}-${i++}`;
        if (i > 50) break;
      }

      const now = Date.now();
      const billing = body.billing === "anual" ? "anual" : "mensual";
      const days = Number(body.durationDays) || (billing === "anual" ? 365 : 30);
      const user = {
        id: authId,
        auth_id: authId,
        name,
        business,
        email,
        password: null,
        slug,
        plan,
        created_at: now,
        subscription:
          plan !== "semilla"
            ? { billing, activeSince: now, nextRenewal: now + days * 24 * 3600 * 1000, autoRenew: true, status: "activa" }
            : null,
      };
      const ins = await fetch(`${url}/rest/v1/cupito_users`, {
        method: "POST",
        headers: { ...H, Prefer: "return=representation" },
        body: JSON.stringify(user),
      });
      if (!ins.ok) {
        // rollback auth user para no dejar basura
        await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(authId)}`, { method: "DELETE", headers: H }).catch(() => {});
        return json({ error: "No se pudo crear el negocio." }, 500);
      }
      const emptyData = {
        services: [],
        bookings: [],
        products: [],
        reviews: [],
        coupons: [],
        professionals: [],
        waitlist: [],
        blockedSlots: [],
        settings: {
          depositEnabled: false, depositPct: 20, hours: [], description: "", address: "",
          whatsapp: "", instagram: "", mapsUrl: "", transferAlias: "", transferCBU: "",
          transferHolder: "", setupDismissed: false, theme: "evergreen", maxAdvanceDays: 30,
        },
      };
      await fetch(`${url}/rest/v1/cupito_data`, {
        method: "POST",
        headers: H,
        body: JSON.stringify({ user_id: authId, data: emptyData, updated_at: Date.now() }),
      }).catch(() => {});

      return json({ ok: true, user: { ...user, createdAt: now, subscription: user.subscription || undefined } });
    }

    /* ---------------- SET PLAN ---------------- */
    if (body.action === "set-plan") {
      const userId = String(body.userId || "");
      const plan = body.plan === "escala" ? "escala" : body.plan === "crece" ? "crece" : "semilla";
      if (!userId) return json({ error: "Falta userId." }, 400);
      const r = await fetch(`${url}/rest/v1/cupito_users?id=eq.${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: H,
        body: JSON.stringify({ plan }),
      });
      if (!r.ok) return json({ error: "No se pudo actualizar el plan." }, 500);
      return json({ ok: true });
    }

    /* ---------------- UPDATE USER ---------------- */
    if (body.action === "update-user") {
      const userId = String(body.userId || "");
      const u = body.updates || {};
      if (!userId) return json({ error: "Falta userId." }, 400);
      const patch: Record<string, unknown> = {};
      if (typeof u.name === "string") patch.name = u.name.slice(0, 60);
      if (typeof u.business === "string") patch.business = u.business.slice(0, 80);
      if (typeof u.slug === "string") patch.slug = slugify(u.slug);
      if (u.plan === "semilla" || u.plan === "crece" || u.plan === "escala") patch.plan = u.plan;
      if (Object.keys(patch).length === 0) return json({ error: "Nada para actualizar." }, 400);
      const r = await fetch(`${url}/rest/v1/cupito_users?id=eq.${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: H,
        body: JSON.stringify(patch),
      });
      if (!r.ok) return json({ error: "No se pudo actualizar." }, 500);
      return json({ ok: true });
    }

    /* ---------------- DELETE (soft) ---------------- */
    if (body.action === "delete-user") {
      const userId = String(body.userId || "");
      if (!userId) return json({ error: "Falta userId." }, 400);
      await fetch(`${url}/rest/v1/cupito_data?user_id=eq.${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: H,
        body: JSON.stringify({ deleted: true }),
      });
      await fetch(`${url}/rest/v1/cupito_users?id=eq.${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: H,
        body: JSON.stringify({ deleted: true }),
      });
      return json({ ok: true });
    }

    return json({ error: "Acción inválida." }, 400);
  } catch {
    return json({ error: "Error interno del servidor." }, 500);
  }
}
