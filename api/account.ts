/**
 * POST /api/account
 * Acciones sobre la cuenta del dueño (requieren service role, corre en servidor).
 *
 * { action: "migrate", email, password }
 *   Migra una cuenta legacy (email+password en texto plano) a Supabase Auth:
 *   1. Lee la fila por email (service role, saltea RLS) y verifica password.
 *   2. Crea el usuario en Auth (email ya confirmado).
 *   3. Vincula la fila: auth_id + password en NULL (no se guarda más).
 *   Responde { ok, authId, userId }.
 *
 * { action: "delete", accessToken }
 *   Elimina DEFINITIVO: verifica el token, borra el auth user (Admin API)
 *   y marca deleted=true en ambas tablas.
 *   Responde { ok }.
 *
 * Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (o SECRET).
 */

export const config = { runtime: "edge" };

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
}

function sbEnv(): { url: string; serviceKey: string } {
  const url = process.env.SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
  return { url, serviceKey };
}

function svcHeaders(serviceKey: string, extra?: Record<string, string>) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    ...(extra || {}),
  };
}

function slugify(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const { url, serviceKey } = sbEnv();
  if (!url || !serviceKey) return json({ error: "Falta configuración de Supabase en el servidor." }, 500);

  try {
    /* ---------------- REGISTRAR CUENTA ---------------- */
    if (body.action === "register") {
      const name = String(body.name || "").trim().slice(0, 60);
      const business = String(body.business || "").trim().slice(0, 80);
      const email = String(body.email || "").toLowerCase().trim();
      const password = String(body.password || "");
      if (name.length < 2 || business.length < 2) return json({ error: "Faltan datos." }, 400);
      if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: "Email inválido." }, 400);
      if (password.length < 6) return json({ error: "La contraseña necesita 6+ caracteres." }, 400);

      // 1. Verificar si ya existe en cupito_users (activo)
      const exRes = await fetch(`${url}/rest/v1/cupito_users?select=id,deleted&email=eq.${encodeURIComponent(email)}`, { headers: svcHeaders(serviceKey) });
      const exRows = (await exRes.json().catch(() => [])) as any[];
      if (Array.isArray(exRows) && exRows.length > 0 && !exRows[0].deleted) {
        return json({ error: "Ya existe una cuenta con ese email. ¿Querés iniciar sesión?" }, 409);
      }

      // 2. Crear o reutilizar usuario en Supabase Auth con email_confirm: true
      let authId = "";
      const createRes = await fetch(`${url}/auth/v1/admin/users`, {
        method: "POST",
        headers: svcHeaders(serviceKey),
        body: JSON.stringify({ email, password, email_confirm: true }),
      });
      const created = await createRes.json().catch(() => ({}));
      if (created?.id) {
        authId = String(created.id);
      } else {
        // Si ya existía en Auth (ej: intento previo), actualizar password y confirmar
        const listRes = await fetch(`${url}/auth/v1/admin/users`, { headers: svcHeaders(serviceKey) });
        if (listRes.ok) {
          const listed = await listRes.json().catch(() => ({}));
          const found = (listed?.users || []).find((u: any) => String(u.email || "").toLowerCase() === email);
          if (found?.id) {
            authId = String(found.id);
            await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(authId)}`, {
              method: "PUT",
              headers: svcHeaders(serviceKey),
              body: JSON.stringify({ password, email_confirm: true }),
            });
          }
        }
      }

      if (!authId) {
        return json({ error: "No pudimos crear el usuario en la nube." }, 500);
      }

      // 3. Generar slug único en la nube
      let slug = slugify(business) || "negocio";
      const base = slug;
      let i = 1;
      for (;;) {
        const sRes = await fetch(`${url}/rest/v1/cupito_users?select=id&slug=eq.${encodeURIComponent(slug)}&id=neq.${encodeURIComponent(authId)}`, { headers: svcHeaders(serviceKey) });
        const sRows = (await sRes.json().catch(() => [])) as any[];
        if (!Array.isArray(sRows) || sRows.length === 0) break;
        slug = `${base}-${i++}`;
        if (i > 50) break;
      }

      const now = Date.now();
      const plan = body.plan === "escala" ? "escala" : body.plan === "crece" ? "crece" : "semilla";
      const billing = body.billing === "anual" ? "anual" : "mensual";
      const days = typeof body.durationDays === "number" ? body.durationDays : (billing === "anual" ? 365 : 30);
      const nextRenewal = now + days * 24 * 3600 * 1000;
      const subscription = plan !== "semilla" ? {
        billing,
        activeSince: now,
        nextRenewal,
        autoRenew: true,
        status: "activa",
      } : null;

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
        subscription,
        deleted: false,
      };

      // 4. Guardar en cupito_users (upsert)
      const uRes = await fetch(`${url}/rest/v1/cupito_users?on_conflict=id`, {
        method: "POST",
        headers: { ...svcHeaders(serviceKey), Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(user),
      });
      if (!uRes.ok) {
        const t = await uRes.text().catch(() => "");
        return json({ error: `Error guardando negocio: ${t}` }, 500);
      }

      // 5. Guardar en cupito_data (upsert datos default)
      const defaultData = {
        services: [
          { id: "srv-1", name: "Atención General", duration: 30, price: 0, active: true },
        ],
        professionals: [],
        bookings: [],
        products: [],
        reviews: [],
        coupons: [],
        waitlist: [],
        blockedSlots: [],
        settings: {
          depositEnabled: false,
          depositPct: 20,
          hours: [
            { open: false, from: "09:00", to: "13:00" },
            { open: true, from: "09:00", to: "20:00" },
            { open: true, from: "09:00", to: "20:00" },
            { open: true, from: "09:00", to: "20:00" },
            { open: true, from: "09:00", to: "20:00" },
            { open: true, from: "09:00", to: "20:00" },
            { open: true, from: "09:00", to: "14:00" },
          ],
          description: "",
          address: "",
          whatsapp: "",
          instagram: "",
          mapsUrl: "",
          transferAlias: "",
          transferCBU: "",
          transferHolder: "",
          setupDismissed: false,
          theme: "evergreen",
          maxAdvanceDays: 30,
        },
      };

      await fetch(`${url}/rest/v1/cupito_data?on_conflict=user_id`, {
        method: "POST",
        headers: { ...svcHeaders(serviceKey), Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({
          user_id: authId,
          data: defaultData,
          updated_at: now,
          deleted: false,
        }),
      });

      return json({ ok: true, user, slug });
    }

    /* ---------------- MIGRAR ---------------- */
    if (body.action === "migrate") {
      const email = String(body.email || "").toLowerCase().trim();
      const password = String(body.password || "");
      if (!email || !password) return json({ error: "Faltan datos." }, 400);

      // 1. Leer fila legacy
      const rowRes = await fetch(
        `${url}/rest/v1/cupito_users?select=*&email=eq.${encodeURIComponent(email)}`,
        { headers: svcHeaders(serviceKey) }
      );
      if (!rowRes.ok) return json({ error: "No se pudo leer la cuenta." }, 500);
      const rows = (await rowRes.json()) as any[];
      const row = Array.isArray(rows) ? rows[0] : null;
      if (!row || row.deleted) return json({ error: "No encontramos ninguna cuenta con ese email." }, 404);

      // Ya migrada: devolver vínculo existente
      if (row.auth_id) {
        return json({ ok: true, authId: row.auth_id, userId: row.id, already: true });
      }

      // 2. Verificar password legacy (texto plano, solo esta vez)
      if (!row.password || row.password !== password) {
        return json({ error: "La contraseña no coincide. Probá de nuevo." }, 401);
      }

      // 3. Crear usuario en Auth (email pre-confirmado)
      const createRes = await fetch(`${url}/auth/v1/admin/users`, {
        method: "POST",
        headers: svcHeaders(serviceKey),
        body: JSON.stringify({ email, password, email_confirm: true }),
      });
      const created = await createRes.json().catch(() => ({}));
      let authId = created?.id ? String(created.id) : "";

      // Si ya existía en Auth (ej: se registró dos veces), buscarlo
      if (!authId) {
        const listRes = await fetch(`${url}/auth/v1/admin/users`, { headers: svcHeaders(serviceKey) });
        // GoTrue admin list no filtra por email en todas las versiones: fallback a signup+login cliente.
        // En ese caso devolvemos señal para que el front haga signIn directo.
        if (listRes.ok) {
          const listed = await listRes.json().catch(() => ({}));
          const found = (listed?.users || []).find((u: any) => String(u.email || "").toLowerCase() === email);
          if (found?.id) authId = String(found.id);
        }
        if (!authId) {
          return json({ error: "NEED_SIGNIN" }, 409);
        }
      }

      // 4. Vincular fila + borrar password en plano
      await fetch(`${url}/rest/v1/cupito_users?id=eq.${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: svcHeaders(serviceKey),
        body: JSON.stringify({ auth_id: authId, password: null }),
      });

      return json({ ok: true, authId, userId: row.id });
    }

    /* ---------------- ELIMINAR ---------------- */
    if (body.action === "delete") {
      const accessToken = String(body.accessToken || "");
      if (!accessToken) return json({ error: "Falta sesión." }, 401);

      // Verificar quién es
      const meRes = await fetch(`${url}/auth/v1/user`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${accessToken}` },
      });
      if (!meRes.ok) return json({ error: "Sesión inválida." }, 401);
      const me = await meRes.json();
      const authId = String(me.id || "");
      if (!authId) return json({ error: "Sesión inválida." }, 401);

      // Borrar auth user (Admin API)
      await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(authId)}`, {
        method: "DELETE",
        headers: svcHeaders(serviceKey),
      });

      // Soft-delete de filas (por si el admin delete falló, los datos quedan ocultos igual)
      const rowsRes = await fetch(
        `${url}/rest/v1/cupito_users?select=id&auth_id=eq.${encodeURIComponent(authId)}`,
        { headers: svcHeaders(serviceKey) }
      );
      const rows = (await rowsRes.json().catch(() => [])) as any[];
      const ids: string[] = Array.isArray(rows) ? rows.map((r) => String(r.id)) : [];
      for (const id of ids) {
        await fetch(`${url}/rest/v1/cupito_users?id=eq.${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: svcHeaders(serviceKey),
          body: JSON.stringify({ deleted: true }),
        });
        await fetch(`${url}/rest/v1/cupito_data?user_id=eq.${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: svcHeaders(serviceKey),
          body: JSON.stringify({ deleted: true }),
        });
      }

      return json({ ok: true });
    }

    return json({ error: "Acción inválida." }, 400);
  } catch {
    return json({ error: "Error interno del servidor." }, 500);
  }
}
