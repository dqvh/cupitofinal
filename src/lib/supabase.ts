import type { User, BizData, Booking, WaitlistEntry } from "./store";

/**
 * Cliente liviano de Supabase vía REST (fetch directo, sin la librería
 * @supabase/supabase-js que pesaba ~120KB en el bundle inicial).
 * No usa realtime ni auth: solo PostgREST con la key pública (anon).
 */

const pickEnv = (...keys: string[]): string => {
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env ?? {};
  for (const k of keys) {
    const v = env[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
};

// Acepta todos los nombres que crea la integración de Vercel + Supabase:
// VITE_*, NEXT_PUBLIC_* y SUPABASE_* (ver envPrefix en vite.config.js).
const supabaseUrl = pickEnv(
  "VITE_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_URL"
);

const supabaseAnonKey = pickEnv(
  "VITE_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY"
);

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes("your-project") &&
    supabaseUrl.startsWith("https://")
);

/** Diagnóstico para mostrar en el Dashboard por qué no conecta (sin exponer la key). */
export function getSupabaseStatus(): { ok: boolean; reason: string } {
  if (isSupabaseConfigured) return { ok: true, reason: "conectado" };
  if (!supabaseUrl && !supabaseAnonKey)
    return { ok: false, reason: "sin variables en el build (hay que hacer Redeploy en Vercel después de agregarlas)" };
  if (!supabaseUrl) return { ok: false, reason: "falta la URL (SUPABASE_URL / VITE_SUPABASE_URL)" };
  if (!supabaseAnonKey) return { ok: false, reason: "falta la key pública (NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_PUBLISHABLE_KEY)" };
  if (!supabaseUrl.startsWith("https://"))
    return { ok: false, reason: `la URL no es https:// (vale "${supabaseUrl.slice(0, 20)}…")` };
  return { ok: false, reason: "config inválida" };
}

if (typeof window !== "undefined" && !isSupabaseConfigured) {
  console.warn("[Cupito Supabase] Nube NO configurada:", getSupabaseStatus().reason);
}

async function rest(path: string, init?: RequestInit): Promise<Response> {
  // Si hay sesión de Supabase Auth, las escrituras van con el JWT del dueño
  // (las políticas RLS solo dejan escribir al dueño). Si no, key pública.
  const token = await sbGetAccessToken().catch(() => "");
  return fetch(`${supabaseUrl}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token || supabaseAnonKey}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
}

async function selectOne<T>(path: string): Promise<T | null> {
  const res = await rest(path);
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
  const arr = (await res.json()) as T[];
  return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
}

async function upsert(table: "cupito_users" | "cupito_data", row: Record<string, unknown>, onConflict: string): Promise<void> {
  const res = await rest(`/${table}?on_conflict=${onConflict}`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    // 401/403 = RLS rechazó la escritura (sesión vieja o sin JWT).
    // 400 = pedido mal formado (casi siempre: falta correr el SQL nuevo).
    // Se registra para avisar en pantalla en vez de fallar en silencio.
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      const uid = row.id ?? row.user_id;
      if (uid) noteRemoteForbidden(String(uid), res.status);
    }
    const err = new Error(`Supabase upsert ${res.status}: ${txt.slice(0, 200)}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  } else {
    const uid = row.id ?? row.user_id;
    if (uid) clearRemoteForbidden(String(uid));
  }
}

/* Cola de escrituras rechazadas por la nube (para toast de diagnóstico) */
const forbiddenQueue: { userId: string; status: number }[] = [];
export function noteRemoteForbidden(userId: string, status = 0) {
  if (forbiddenQueue.length < 10 && !forbiddenQueue.some((f) => f.userId === userId)) {
    forbiddenQueue.push({ userId, status });
  }
}
export function clearRemoteForbidden(userId: string) {
  const idx = forbiddenQueue.findIndex((f) => f.userId === userId);
  if (idx >= 0) forbiddenQueue.splice(idx, 1);
}
export function takeForbiddenUser(): { userId: string; status: number } | null {
  return forbiddenQueue.shift() ?? null;
}

function mapUser(u: any): User {
  const user: User = {
    id: u.id,
    name: u.name,
    business: u.business,
    email: u.email,
    password: u.password,
    slug: u.slug,
    plan: u.plan,
    createdAt: Number(u.created_at || Date.now()),
    subscription: u.subscription || undefined,
  };
  (user as User & { auth_id?: string }).auth_id = u.auth_id || undefined;
  return user;
}

/**
 * Busca un negocio y toda su información directamente en Supabase por su slug.
 * Permite que cualquier celular o computadora vea el negocio en tiempo real.
 */
export async function fetchRemoteUserBySlug(
  slug: string
): Promise<{ user: User; data: BizData } | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const userData = await selectOne<any>(`/cupito_users?select=*&slug=eq.${encodeURIComponent(slug.toLowerCase().trim())}`);
    if (!userData) return null;
    const user = mapUser(userData);

    const rowData = await selectOne<{ data: BizData }>(
      `/cupito_data?select=data&user_id=eq.${encodeURIComponent(user.id)}`
    );
    if (!rowData?.data) {
      return { user, data: null as unknown as BizData };
    }
    return { user, data: rowData.data as BizData };
  } catch (err) {
    console.warn("[Cupito Supabase] Error consultando negocio por slug:", err);
    return null;
  }
}

/**
 * Obtiene todos los negocios registrados en Supabase para sincronización.
 */
export async function fetchAllRemoteUsers(): Promise<User[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const res = await rest(`/cupito_users?select=*&order=created_at.desc`);
    if (!res.ok) return [];
    const data = (await res.json()) as any[];
    if (!Array.isArray(data)) return [];
    return data.map(mapUser);
  } catch (err) {
    console.warn("[Cupito Supabase] Error obteniendo usuarios remotos:", err);
    return [];
  }
}

/**
 * Sincroniza un usuario y su información con Supabase.
 */
export async function syncUserToRemote(user: User, data?: BizData): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    await upsert("cupito_users", {
      id: user.id,
      name: user.name,
      business: user.business,
      email: user.email,
      password: user.password || null,
      slug: user.slug,
      plan: user.plan,
      created_at: user.createdAt,
      subscription: user.subscription || null,
      auth_id: (user as User & { auth_id?: string }).auth_id || null,
      deleted: false,
    }, "id");

    if (data) {
      await upsert("cupito_data", {
        user_id: user.id,
        data,
        updated_at: Date.now(),
        deleted: false,
      }, "user_id");
    }
    return true;
  } catch (err) {
    console.warn("[Cupito Supabase] Error en syncUserToRemote:", err);
    return false;
  }
}

/**
 * Busca un negocio por su auth_id (dueño logueado con Supabase Auth).
 */
export async function fetchRemoteUserByAuthId(
  authId: string
): Promise<{ user: User; data: BizData | null } | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const userData = await selectOne<any>(`/cupito_users?select=*&auth_id=eq.${encodeURIComponent(authId)}`);
    if (!userData) return null;
    const user = mapUser(userData);

    const rowData = await selectOne<{ data: BizData }>(
      `/cupito_data?select=data&user_id=eq.${encodeURIComponent(user.id)}`
    );
    if (!rowData?.data) {
      return { user, data: null as unknown as BizData };
    }
    return { user, data: rowData.data as BizData };
  } catch (err) {
    console.warn("[Cupito Supabase] Error consultando negocio por auth_id:", err);
    return null;
  }
}

/**
 * Busca un negocio por email (para login multi-dispositivo y migración).
 */
export async function fetchRemoteUserByEmail(
  email: string
): Promise<{ user: User; data: BizData | null } | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const userData = await selectOne<any>(`/cupito_users?select=*&email=eq.${encodeURIComponent(email.toLowerCase().trim())}`);
    if (!userData) return null;
    const user = mapUser(userData);

    const rowData = await selectOne<{ data: BizData }>(
      `/cupito_data?select=data&user_id=eq.${encodeURIComponent(user.id)}`
    );
    return { user, data: (rowData?.data as BizData) ?? null };
  } catch (err) {
    console.warn("[Cupito Supabase] Error consultando negocio por email:", err);
    return null;
  }
}

/* ================= Supabase Auth (email + password) =================
   Implementado con fetch directo a GoTrue para no sumar ~120KB al bundle.
   La sesión (access/refresh token) vive en localStorage.
   "Confirm email" va DESACTIVADO (entran directo). Anti-bots opcional
   con Turnstile (ver abajo). */

export interface SbSession {
  access_token: string;
  refresh_token: string;
  expires_at: number; // ms
  user_id: string;
  email: string;
}

const SB_SESSION_KEY = "cupito_sb_session";

function sbLoadSession(): SbSession | null {
  try {
    const raw = window.localStorage.getItem(SB_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SbSession;
    if (!s.access_token || !s.user_id) return null;
    return s;
  } catch {
    return null;
  }
}

function sbSaveSession(s: SbSession) {
  try {
    window.localStorage.setItem(SB_SESSION_KEY, JSON.stringify(s));
  } catch { /* noop */ }
}

export function sbClearSession() {
  try {
    window.localStorage.removeItem(SB_SESSION_KEY);
  } catch { /* noop */ }
}

function toSession(data: any): SbSession | null {
  const at = data?.access_token;
  const rt = data?.refresh_token;
  const u = data?.user;
  if (!at || !u?.id) return null;
  return {
    access_token: at,
    refresh_token: rt || "",
    expires_at: Date.now() + Number(data?.expires_in || 3600) * 1000,
    user_id: String(u.id),
    email: String(u.email || ""),
  };
}

async function authFetch(
  path: string,
  body: Record<string, unknown>,
  opts?: { bearer?: string; captcha?: string }
): Promise<any> {
  const res = await fetch(`${supabaseUrl}/auth/v1${path}`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      "Content-Type": "application/json",
      ...(opts?.bearer ? { Authorization: `Bearer ${opts.bearer}` } : {}),
      ...(opts?.captcha ? { "x-captcha-token": opts.captcha } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = String(data.msg || data.message || data.error || `Auth ${res.status}`);
    const code = `${res.status} ${msg}`;
    throw new Error(code);
  }
  return data;
}

/* ---------- Captcha invisible (Cloudflare Turnstile, opcional) ----------
   Si configurás VITE_TURNSTILE_SITEKEY (Vercel) + el secreto en Supabase
   Auth → CAPTCHA, cada signup/signin lleva token anti-bots sin molestar
   al usuario. Sin sitekey, no hace nada. */

export function turnstileSitekey(): string {
  return pickEnv("VITE_TURNSTILE_SITEKEY", "NEXT_PUBLIC_TURNSTILE_SITEKEY");
}
let turnstileLoading: Promise<any> | null = null;
function loadTurnstile(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  if ((window as any).turnstile) return Promise.resolve((window as any).turnstile);
  if (turnstileLoading) return turnstileLoading;
  turnstileLoading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () =>
      (window as any).turnstile ? resolve((window as any).turnstile) : reject(new Error("no widget"));
    script.onerror = () => reject(new Error("load"));
    document.head.appendChild(script);
    setTimeout(() => reject(new Error("timeout")), 10000);
  });
  turnstileLoading.catch(() => {
    turnstileLoading = null;
  });
  return turnstileLoading;
}

export async function getCaptchaToken(): Promise<string> {
  const sitekey = turnstileSitekey();
  if (!sitekey || !isSupabaseConfigured || typeof window === "undefined") return "";
  try {
    const t = await loadTurnstile();
    return await new Promise<string>((resolve) => {
      let done = false;
      const finish = (tok: string) => {
        if (!done) {
          done = true;
          resolve(tok);
        }
      };
      const timer = setTimeout(() => finish(""), 10000);
      try {
        // Off-screen visible (NO display:none: Turnstile falla en contenedores ocultos)
        const holder = document.createElement("div");
        holder.style.position = "fixed";
        holder.style.left = "-9999px";
        holder.style.top = "0";
        holder.style.width = "30px";
        holder.style.height = "30px";
        holder.style.opacity = "0";
        holder.style.pointerEvents = "none";
        holder.setAttribute("aria-hidden", "true");
        document.body.appendChild(holder);
        const wid = t.render(holder, {
          sitekey,
          size: "invisible",
          callback: (tok: string) => {
            clearTimeout(timer);
            holder.remove();
            finish(tok || "");
          },
          "error-callback": () => {
            clearTimeout(timer);
            holder.remove();
            finish("");
          },
          "expired-callback": () => {
            clearTimeout(timer);
            holder.remove();
            finish("");
          },
        });
        t.execute(wid);
      } catch {
        clearTimeout(timer);
        finish("");
      }
    });
  } catch {
    return "";
  }
}

/** ¿Hay sesión válida (aunque sea por expirar)? */
export function sbHasSession(): boolean {
  if (!isSupabaseConfigured || typeof window === "undefined") return false;
  return !!sbLoadSession();
}

/** Access token vigente; refresca solo si falta poco para vencer. */
export async function sbGetAccessToken(): Promise<string> {
  if (!isSupabaseConfigured || typeof window === "undefined") return "";
  const s = sbLoadSession();
  if (!s) return "";
  if (Date.now() < s.expires_at - 60 * 1000) return s.access_token;
  // Refrescar
  if (!s.refresh_token) {
    sbClearSession();
    return "";
  }
  try {
    const data = await authFetch("/token?grant_type=refresh_token", { refresh_token: s.refresh_token });
    const next = toSession({ ...data, user: data.user || { id: s.user_id, email: s.email } });
    if (!next || !next.refresh_token) throw new Error("refresh");
    sbSaveSession({ ...next, refresh_token: next.refresh_token || s.refresh_token });
    return next.access_token;
  } catch {
    sbClearSession();
    return "";
  }
}

export type SbSignUpResult =
  | { ok: true; authId: string; email: string }
  | { ok: false; reason: "exists" | "confirm" | "error"; error: string; authId?: string };

export async function sbSignUp(email: string, password: string): Promise<SbSignUpResult> {
  const em = email.toLowerCase().trim();
  let captchaSent = false;
  try {
    const captcha = await getCaptchaToken();
    captchaSent = !!captcha;
    if (turnstileSitekey() && !captchaSent) {
      console.warn("[Cupito] Turnstile no generó token (¿adblock? ¿dominio no autorizado en Cloudflare? ¿falta redeploy del sitekey?). Se intenta igual sin token.");
    }
    const data = await authFetch("/signup", { email: em, password }, captcha ? { captcha } : undefined);
    const session = toSession(data);
    if (session) {
      sbSaveSession(session);
      return { ok: true, authId: session.user_id, email: session.email || em };
    }
    // Sin sesión: quedó pendiente de confirmación (Confirm email activado)
    // o el email ya estaba registrado.
    const u = data?.user as any;
    const pendingId = u?.id ? String(u.id) : undefined;
    const identities = u?.identities;
    if (Array.isArray(identities) && identities.length === 0) {
      return { ok: false, reason: "exists", error: "exists" };
    }
    return { ok: false, reason: "confirm", error: "confirm", authId: pendingId };
  } catch (e) {
    const msg = String((e as Error).message || "");
    console.warn("[Cupito] signup falló:", msg);
    if (/captcha/i.test(msg)) {
      if (turnstileSitekey() && !captchaSent) {
        return { ok: false, reason: "error", error: "El captcha no cargó en tu navegador. Probá en incógnito sin adblock y verificá el dominio en Cloudflare." };
      }
      return { ok: false, reason: "error", error: "La verificación anti-bots falló. Recargá la página e intentá de nuevo." };
    }
    if (/422|already registered|already exists|exists/i.test(msg)) {
      return { ok: false, reason: "exists", error: "exists" };
    }
    if (/429|rate|too many/i.test(msg)) {
      return { ok: false, reason: "error", error: "Demasiados intentos. Esperá un minuto y probá de nuevo." };
    }
    if (/password|weak|short/i.test(msg)) {
      return { ok: false, reason: "error", error: "La contraseña es muy débil o corta (mínimo 6 caracteres)." };
    }
    return { ok: false, reason: "error", error: "No pudimos crear la cuenta. Revisá tu conexión." };
  }
}

export async function sbSignIn(email: string, password: string): Promise<SbSignUpResult> {
  const em = email.toLowerCase().trim();
  let captchaSent = false;
  try {
    const captcha = await getCaptchaToken();
    captchaSent = !!captcha;
    if (turnstileSitekey() && !captchaSent) {
      console.warn("[Cupito] Turnstile no generó token (¿adblock? ¿dominio no autorizado en Cloudflare? ¿falta redeploy del sitekey?). Se intenta igual sin token.");
    }
    const data = await authFetch("/token?grant_type=password", { email: em, password }, captcha ? { captcha } : undefined);
    const session = toSession(data);
    if (!session) throw new Error("session");
    sbSaveSession(session);
    return { ok: true, authId: session.user_id, email: session.email || em };
  } catch (e) {
    const msg = String((e as Error).message || "");
    console.warn("[Cupito] signin falló:", msg);
    if (/captcha/i.test(msg)) {
      if (turnstileSitekey() && !captchaSent) {
        return { ok: false, reason: "error", error: "El captcha no cargó en tu navegador. Probá en incógnito sin adblock y verificá el dominio en Cloudflare." };
      }
      return { ok: false, reason: "error", error: "La verificación anti-bots falló. Recargá la página e intentá de nuevo." };
    }
    if (/400|401|invalid|credentials|grant/i.test(msg)) {
      return { ok: false, reason: "error", error: "invalid" };
    }
    if (/confirm|verif/i.test(msg)) {
      return { ok: false, reason: "confirm", error: "confirm" };
    }
    return { ok: false, reason: "error", error: "No pudimos entrar. Revisá tu conexión." };
  }
}

export async function sbSignOut(): Promise<void> {  const s = typeof window !== "undefined" ? sbLoadSession() : null;
  sbClearSession();
  if (!isSupabaseConfigured || !s) return;
  try {
    await authFetch("/logout", {}, { bearer: s.access_token });
  } catch { /* noop */ }
}

/** Reenvía el email de confirmación (ej: el primer link vino con Site URL roto). */
export async function sbResendConfirmation(email: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const captcha = await getCaptchaToken();
    await authFetch(
      "/resend",
      { type: "signup", email: email.toLowerCase().trim() },
      captcha ? { captcha } : undefined
    );
    return true;
  } catch (e) {
    console.warn("[Cupito] resend falló:", String((e as Error).message || ""));
    return false;
  }
}

/** Valida la sesión contra el servidor (para el arranque). */export async function sbValidateSession(): Promise<{ authId: string; email: string } | null> {
  const token = await sbGetAccessToken();
  if (!token) return null;
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("invalid");
    const u = await res.json();
    return { authId: String(u.id), email: String(u.email || "") };
  } catch {
    sbClearSession();
    return null;
  }
}

/**
 * Elimina una entrada de lista de espera directamente en Supabase.
 * Necesario para que el borrado se propague y no "resucite" en otros dispositivos.
 */
export async function deleteRemoteWaitlist(userId: string, waitlistId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const row = await selectOne<{ data: BizData }>(
      `/cupito_data?select=data&user_id=eq.${encodeURIComponent(userId)}`
    );
    if (!row?.data) return true; // nada que borrar
    const currentData = row.data as BizData;
    const updatedWaitlist = (currentData.waitlist || []).filter((w) => w.id !== waitlistId);
    if (updatedWaitlist.length === (currentData.waitlist || []).length) return true;

    await upsert("cupito_data", {
      user_id: userId,
      data: { ...currentData, waitlist: updatedWaitlist },
      updated_at: Date.now(),
    }, "user_id");
    return true;
  } catch (err) {
    console.warn("[Cupito Supabase] Error eliminando waitlist remota:", err);
    return false;
  }
}

/**
 * Elimina una reserva directamente en Supabase (para que no resucite con el merge).
 */
export async function deleteRemoteBooking(userId: string, bookingId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const row = await selectOne<{ data: BizData }>(
      `/cupito_data?select=data&user_id=eq.${encodeURIComponent(userId)}`
    );
    if (!row?.data) return true;
    const currentData = row.data as BizData;
    const updated = (currentData.bookings || []).filter((b) => b.id !== bookingId);
    if (updated.length === (currentData.bookings || []).length) return true;

    await upsert("cupito_data", {
      user_id: userId,
      data: { ...currentData, bookings: updated },
      updated_at: Date.now(),
    }, "user_id");
    return true;
  } catch (err) {
    console.warn("[Cupito Supabase] Error eliminando booking remoto:", err);
    return false;
  }
}

/**
 * Borrado lógico de un usuario: marca deleted=true en ambas tablas.
 * Con las políticas RLS nuevas la key pública ya no puede hacer DELETE físico,
 * así que borrar = ocultar (las lecturas filtran deleted=false en el servidor).
 */
export async function deleteUserFromRemote(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const patch = async (table: string, filter: string) => {
      const res = await rest(`/${table}?${filter}`, {
        method: "PATCH",
        body: JSON.stringify({ deleted: true }),
      });
      if (!res.ok) console.warn(`[Cupito Supabase] Error marcando ${table} como borrado:`, res.status);
      return res.ok;
    };
    const okData = await patch("cupito_data", `user_id=eq.${encodeURIComponent(userId)}`);
    const okUser = await patch("cupito_users", `id=eq.${encodeURIComponent(userId)}`);
    return okUser && okData;
  } catch (err) {
    console.warn("[Cupito Supabase] Error en deleteUserFromRemote:", err);
    return false;
  }
}

/**
 * Obtiene la información completa (BizData) de un negocio desde Supabase.
 */
export async function fetchRemoteBizData(userId: string): Promise<BizData | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const row = await selectOne<{ data: BizData }>(
      `/cupito_data?select=data&user_id=eq.${encodeURIComponent(userId)}`
    );
    if (!row?.data) return null;
    return row.data as BizData;
  } catch (err) {
    console.warn("[Cupito Supabase] Error obteniendo BizData remoto:", err);
    return null;
  }
}

/**
 * Guarda una reserva creada por un cliente desde su celular en Supabase.
 */
export async function saveRemoteBooking(userId: string, booking: Booking): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const row = await selectOne<{ data: BizData }>(
      `/cupito_data?select=data&user_id=eq.${encodeURIComponent(userId)}`
    );

    let currentData = (row?.data as BizData) || null;
    if (!currentData) {
      currentData = {
        services: [],
        bookings: [booking],
        products: [],
        reviews: [],
        coupons: [],
        professionals: [],
        waitlist: [],
        settings: {
          depositEnabled: false,
          depositPct: 20,
          hours: [],
          description: "",
          address: "",
          whatsapp: "",
          instagram: "",
          mapsUrl: "",
          transferAlias: "",
          transferCBU: "",
          transferHolder: "",
          setupDismissed: false,
        },
      };
    } else {
      const existing = currentData.bookings || [];
      const filtered = existing.filter((b) => b.id !== booking.id);
      currentData = {
        ...currentData,
        bookings: [booking, ...filtered],
      };
    }

    await upsert("cupito_data", {
      user_id: userId,
      data: currentData,
      updated_at: Date.now(),
    }, "user_id");
    return true;
  } catch (err) {
    console.warn("[Cupito Supabase] Error guardando reserva remota:", err);
    return false;
  }
}

/**
 * Guarda una entrada en la lista de espera en Supabase.
 */
export async function saveRemoteWaitlist(userId: string, entry: WaitlistEntry): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const row = await selectOne<{ data: BizData }>(
      `/cupito_data?select=data&user_id=eq.${encodeURIComponent(userId)}`
    );
    if (!row?.data) return false;
    const currentData = row.data as BizData;
    const existing = currentData.waitlist || [];
    const updatedWaitlist = [entry, ...existing.filter((w) => w.id !== entry.id)];

    await upsert("cupito_data", {
      user_id: userId,
      data: { ...currentData, waitlist: updatedWaitlist },
      updated_at: Date.now(),
    }, "user_id");
    return true;
  } catch (err) {
    console.warn("[Cupito Supabase] Error guardando waitlist remota:", err);
    return false;
  }
}
