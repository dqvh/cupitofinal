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
  return fetch(`${supabaseUrl}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
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
  const res = await rest(`/${table}?onConflict=${onConflict}`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Supabase upsert ${res.status}: ${txt.slice(0, 200)}`);
  }
}

function mapUser(u: any): User {
  return {
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
      password: user.password,
      slug: user.slug,
      plan: user.plan,
      created_at: user.createdAt,
      subscription: user.subscription || null,
    }, "id");

    if (data) {
      await upsert("cupito_data", {
        user_id: user.id,
        data,
        updated_at: Date.now(),
      }, "user_id");
    }
    return true;
  } catch (err) {
    console.warn("[Cupito Supabase] Error en syncUserToRemote:", err);
    return false;
  }
}

/**
 * Busca un negocio por email (para login multi-dispositivo).
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
