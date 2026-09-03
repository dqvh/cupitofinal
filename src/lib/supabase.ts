import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { User, BizData, Booking, WaitlistEntry } from "./store";

const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string) ||
  (import.meta.env.SUPABASE_URL as string) ||
  (import.meta.env.NEXT_PUBLIC_SUPABASE_URL as string) ||
  "";

const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
  (import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string) ||
  (import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string) ||
  (import.meta.env.SUPABASE_PUBLISHABLE_KEY as string) ||
  (import.meta.env.SUPABASE_ANON_KEY as string) ||
  "";

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes("your-project") &&
    supabaseUrl.startsWith("https://")
);

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
