import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { User, BizData, Booking, WaitlistEntry } from "./store";

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

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    })
  : null;

/**
 * Busca un negocio y toda su informaci�n directamente en Supabase por su slug.
 * Permite que cualquier celular o computadora vea el negocio en tiempo real.
 */
export async function fetchRemoteUserBySlug(
  slug: string
): Promise<{ user: User; data: BizData } | null> {
  if (!supabase) return null;
  try {
    const { data: userData, error: userErr } = await supabase
      .from("cupito_users")
      .select("*")
      .eq("slug", slug.toLowerCase().trim())
      .maybeSingle();

    if (userErr || !userData) return null;

    const user: User = {
      id: userData.id,
      name: userData.name,
      business: userData.business,
      email: userData.email,
      password: userData.password,
      slug: userData.slug,
      plan: userData.plan,
      createdAt: Number(userData.created_at || Date.now()),
      subscription: userData.subscription || undefined,
    };

    const { data: rowData, error: dataErr } = await supabase
      .from("cupito_data")
      .select("data")
      .eq("user_id", user.id)
      .maybeSingle();

    if (dataErr || !rowData?.data) {
      return { user, data: null as unknown as BizData };
    }

    return { user, data: rowData.data as BizData };
  } catch (err) {
    console.warn("[Cupito Supabase] Error consultando negocio por slug:", err);
    return null;
  }
}

/**
 * Obtiene todos los negocios registrados en Supabase para sincronizaci�n.
 */
export async function fetchAllRemoteUsers(): Promise<User[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("cupito_users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data.map((u) => ({
      id: u.id,
      name: u.name,
      business: u.business,
      email: u.email,
      password: u.password,
      slug: u.slug,
      plan: u.plan,
      createdAt: Number(u.created_at || Date.now()),
      subscription: u.subscription || undefined,
    }));
  } catch (err) {
    console.warn("[Cupito Supabase] Error obteniendo usuarios remotos:", err);
    return [];
  }
}

/**
 * Sincroniza un usuario y su informaci�n con Supabase.
 */
export async function syncUserToRemote(user: User, data?: BizData): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error: uErr } = await supabase.from("cupito_users").upsert({
      id: user.id,
      name: user.name,
      business: user.business,
      email: user.email,
      password: user.password,
      slug: user.slug,
      plan: user.plan,
      created_at: user.createdAt,
      subscription: user.subscription || null,
    });

    if (uErr) {
      console.warn("[Cupito Supabase] Error guardando usuario:", uErr);
      return false;
    }

    if (data) {
      const { error: dErr } = await supabase.from("cupito_data").upsert({
        user_id: user.id,
        data,
        updated_at: Date.now(),
      });
      if (dErr) {
        console.warn("[Cupito Supabase] Error guardando datos del negocio:", dErr);
        return false;
      }
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
  if (!supabase) return null;
  try {
    const { data: userData, error: userErr } = await supabase
      .from("cupito_users")
      .select("*")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (userErr || !userData) return null;

    const user: User = {
      id: userData.id,
      name: userData.name,
      business: userData.business,
      email: userData.email,
      password: userData.password,
      slug: userData.slug,
      plan: userData.plan,
      createdAt: Number(userData.created_at || Date.now()),
      subscription: userData.subscription || undefined,
    };

    const { data: rowData } = await supabase
      .from("cupito_data")
      .select("data")
      .eq("user_id", user.id)
      .maybeSingle();

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
  if (!supabase) return false;
  try {
    const { data: row } = await supabase
      .from("cupito_data")
      .select("data")
      .eq("user_id", userId)
      .maybeSingle();

    if (!row?.data) return true; // nada que borrar
    const currentData = row.data as BizData;
    const updatedWaitlist = (currentData.waitlist || []).filter((w) => w.id !== waitlistId);
    if (updatedWaitlist.length === (currentData.waitlist || []).length) return true;

    const { error } = await supabase.from("cupito_data").upsert({
      user_id: userId,
      data: { ...currentData, waitlist: updatedWaitlist },
      updated_at: Date.now(),
    });
    return !error;
  } catch (err) {
    console.warn("[Cupito Supabase] Error eliminando waitlist remota:", err);
    return false;
  }
}

/**
 * Elimina una reserva directamente en Supabase (para que no resucite con el merge).
 */
export async function deleteRemoteBooking(userId: string, bookingId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data: row } = await supabase
      .from("cupito_data")
      .select("data")
      .eq("user_id", userId)
      .maybeSingle();

    if (!row?.data) return true;
    const currentData = row.data as BizData;
    const updated = (currentData.bookings || []).filter((b) => b.id !== bookingId);
    if (updated.length === (currentData.bookings || []).length) return true;

    const { error } = await supabase.from("cupito_data").upsert({
      user_id: userId,
      data: { ...currentData, bookings: updated },
      updated_at: Date.now(),
    });
    return !error;
  } catch (err) {
    console.warn("[Cupito Supabase] Error eliminando booking remoto:", err);
    return false;
  }
}
/**
 * Elimina un usuario y su información asociada de Supabase.
 */
export async function deleteUserFromRemote(userId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error: dErr } = await supabase
      .from("cupito_data")
      .delete()
      .eq("user_id", userId);
    if (dErr) console.warn("[Cupito Supabase] Error eliminando cupito_data remoto:", dErr);

    const { error: uErr } = await supabase
      .from("cupito_users")
      .delete()
      .eq("id", userId);
    if (uErr) console.warn("[Cupito Supabase] Error eliminando cupito_users remoto:", uErr);

    return !uErr;
  } catch (err) {
    console.warn("[Cupito Supabase] Error en deleteUserFromRemote:", err);
    return false;
  }
}

/**
 * Obtiene la información completa (BizData) de un negocio desde Supabase.
 */
export async function fetchRemoteBizData(userId: string): Promise<BizData | null> {
  if (!supabase) return null;
  try {
    const { data: row, error } = await supabase
      .from("cupito_data")
      .select("data")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !row?.data) return null;
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
  if (!supabase) return false;
  try {
    const { data: row } = await supabase
      .from("cupito_data")
      .select("data")
      .eq("user_id", userId)
      .maybeSingle();

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

    const { error } = await supabase.from("cupito_data").upsert({
      user_id: userId,
      data: currentData,
      updated_at: Date.now(),
    });

    if (error) {
      console.warn("[Cupito Supabase] Error upserting remote booking:", error);
      return false;
    }
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
  if (!supabase) return false;
  try {
    const { data: row } = await supabase
      .from("cupito_data")
      .select("data")
      .eq("user_id", userId)
      .maybeSingle();

    if (!row?.data) return false;
    const currentData = row.data as BizData;
    const existing = currentData.waitlist || [];
    const updatedWaitlist = [entry, ...existing.filter((w) => w.id !== entry.id)];

    const { error } = await supabase.from("cupito_data").upsert({
      user_id: userId,
      data: { ...currentData, waitlist: updatedWaitlist },
      updated_at: Date.now(),
    });

    return !error;
  } catch (err) {
    console.warn("[Cupito Supabase] Error guardando waitlist remota:", err);
    return false;
  }
}
