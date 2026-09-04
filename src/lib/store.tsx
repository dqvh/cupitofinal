import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  isSupabaseConfigured,
  fetchRemoteUserBySlug,
  fetchRemoteUserByEmail,
  fetchRemoteUserByAuthId,
  fetchAllRemoteUsers,
  syncUserToRemote,
  deleteUserFromRemote,
  deleteRemoteWaitlist,
  deleteRemoteBooking,
  fetchRemoteBizData,
  saveRemoteBooking,
  saveRemoteWaitlist,
  sbSignUp,
  sbSignIn,
  sbSignOut,
  sbValidateSession,
  sbHasSession,
  sbGetAccessToken,
  takeForbiddenUser,
  clearRemoteForbidden,
} from "./supabase";
import { sendReviewRequestEmail } from "./email";

/* ================= tipos ================= */

export type Plan = "semilla" | "crece" | "escala";
export type PaymentMethod = "tarjeta" | "transferencia" | "billetera";

export interface Service { id: string; name: string; price: number; duration: number }
export interface Product { id: string; name: string; price: number; desc: string }
export interface Review { id: string; client: string; rating: number; text: string; date: string }
export interface Coupon { id: string; code: string; pct: number; active: boolean }
export interface Professional { id: string; name: string; role: string; color: string; hours?: DayHours[] }
export interface WaitlistEntry { id: string; date: string; serviceId: string; client: string; phone: string; createdAt: number }

export type BookingStatus = "pendiente" | "confirmada" | "atendida" | "cancelada" | "ausente";
export interface Booking {
  id: string;
  serviceId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  client: string;
  phone: string;
  email?: string; // para confirmación y recordatorio 24 h antes
  status: BookingStatus;
  source: "online" | "manual";
  createdAt?: number; // cuándo se creó (para no mandar recordatorio si se reservó <24 h antes)
  reminderSentAt?: number; // cuándo se envió el recordatorio (evita duplicados del cron)
  items?: { productId: string; qty: number }[];
  proId?: string;
  paidDeposit?: boolean;
  paymentMethod?: PaymentMethod;
  depositClaim?: { txId: string; sentAt: number }; // comprobante pendiente de verificación
  reviewRequested?: boolean;
  cancelReason?: string;
}

export interface BlockedSlot {
  id: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  endTime?: string;
  proId?: string;
  reason: string;
}

export interface DayHours {
  open: boolean;
  from: string;
  to: string;
  from2?: string; // horario partido (corte al mediodía)
  to2?: string;
}

export type ThemeId = "evergreen" | "midnight" | "coral" | "rose" | "obsidian" | "ocean";

export interface ColorTheme {
  id: ThemeId;
  name: string;
  headerBg: string;
  headerText: string;
  accentText: string;
  accentBg: string;
  badgeBg: string;
  badgeText: string;
  borderAccent: string;
  cardHeaderBg: string;
  cardHeaderText: string;
  primaryBtn: string;
  primaryBtnText: string;
  activeBadge: string;
  activeSlot: string;
  progressBar: string;
  ratingStar: string;
  sampleGradient: string;
}

export const THEMES: Record<ThemeId, ColorTheme> = {
  evergreen: {
    id: "evergreen",
    name: "Verde Bosque & Lima",
    headerBg: "bg-[#082b22]",
    headerText: "text-[#fbf9f4]",
    accentText: "text-[#cdf463]",
    accentBg: "bg-[#cdf463]",
    badgeBg: "bg-[#cdf463]",
    badgeText: "text-[#082b22]",
    borderAccent: "border-[#082b22]",
    cardHeaderBg: "bg-[#082b22]",
    cardHeaderText: "text-[#fbf9f4]",
    primaryBtn: "bg-[#082b22] text-[#cdf463] hover:bg-[#0f3d32]",
    primaryBtnText: "text-[#cdf463]",
    activeBadge: "bg-[#082b22] text-[#cdf463]",
    activeSlot: "border-[#082b22] bg-[#082b22] text-[#cdf463] shadow-[3px_3px_0_rgba(205,244,99,0.5)]",
    progressBar: "bg-[#082b22]",
    ratingStar: "text-[#8cb829]",
    sampleGradient: "from-[#082b22] to-[#cdf463]",
  },
  midnight: {
    id: "midnight",
    name: "Azul Medianoche & Celeste",
    headerBg: "bg-[#0f172a]",
    headerText: "text-[#f8fafc]",
    accentText: "text-[#38bdf8]",
    accentBg: "bg-[#38bdf8]",
    badgeBg: "bg-[#38bdf8]",
    badgeText: "text-[#0f172a]",
    borderAccent: "border-[#0f172a]",
    cardHeaderBg: "bg-[#0f172a]",
    cardHeaderText: "text-[#f8fafc]",
    primaryBtn: "bg-[#0f172a] text-[#38bdf8] hover:bg-[#1e293b]",
    primaryBtnText: "text-[#38bdf8]",
    activeBadge: "bg-[#0f172a] text-[#38bdf8]",
    activeSlot: "border-[#0f172a] bg-[#0f172a] text-[#38bdf8] shadow-[3px_3px_0_rgba(56,189,248,0.5)]",
    progressBar: "bg-[#0f172a]",
    ratingStar: "text-[#38bdf8]",
    sampleGradient: "from-[#0f172a] to-[#38bdf8]",
  },
  coral: {
    id: "coral",
    name: "Sunset Coral & Carbón",
    headerBg: "bg-[#27171a]",
    headerText: "text-[#fff5f5]",
    accentText: "text-[#ff7a59]",
    accentBg: "bg-[#ff7a59]",
    badgeBg: "bg-[#ff7a59]",
    badgeText: "text-white",
    borderAccent: "border-[#ff7a59]",
    cardHeaderBg: "bg-[#27171a]",
    cardHeaderText: "text-[#fff5f5]",
    primaryBtn: "bg-[#ff7a59] text-white hover:bg-[#e05b38]",
    primaryBtnText: "text-white",
    activeBadge: "bg-[#ff7a59] text-white",
    activeSlot: "border-[#ff7a59] bg-[#ff7a59] text-white shadow-[3px_3px_0_rgba(255,122,89,0.4)]",
    progressBar: "bg-[#ff7a59]",
    ratingStar: "text-[#ff7a59]",
    sampleGradient: "from-[#27171a] to-[#ff7a59]",
  },
  rose: {
    id: "rose",
    name: "Rosa Estética & Violeta",
    headerBg: "bg-[#3b0764]",
    headerText: "text-[#fdf2f8]",
    accentText: "text-[#f472b6]",
    accentBg: "bg-[#f472b6]",
    badgeBg: "bg-[#f472b6]",
    badgeText: "text-[#3b0764]",
    borderAccent: "border-[#3b0764]",
    cardHeaderBg: "bg-[#3b0764]",
    cardHeaderText: "text-[#fdf2f8]",
    primaryBtn: "bg-[#3b0764] text-[#f472b6] hover:bg-[#581c87]",
    primaryBtnText: "text-[#f472b6]",
    activeBadge: "bg-[#3b0764] text-[#f472b6]",
    activeSlot: "border-[#3b0764] bg-[#3b0764] text-[#f472b6] shadow-[3px_3px_0_rgba(244,114,182,0.4)]",
    progressBar: "bg-[#3b0764]",
    ratingStar: "text-[#f472b6]",
    sampleGradient: "from-[#3b0764] to-[#f472b6]",
  },
  obsidian: {
    id: "obsidian",
    name: "Obsidiana & Oro",
    headerBg: "bg-[#18181b]",
    headerText: "text-[#fafaf9]",
    accentText: "text-[#fbbf24]",
    accentBg: "bg-[#fbbf24]",
    badgeBg: "bg-[#fbbf24]",
    badgeText: "text-[#18181b]",
    borderAccent: "border-[#fbbf24]",
    cardHeaderBg: "bg-[#18181b]",
    cardHeaderText: "text-[#fafaf9]",
    primaryBtn: "bg-[#18181b] text-[#fbbf24] hover:bg-[#27272a]",
    primaryBtnText: "text-[#fbbf24]",
    activeBadge: "bg-[#18181b] text-[#fbbf24]",
    activeSlot: "border-[#18181b] bg-[#18181b] text-[#fbbf24] shadow-[3px_3px_0_rgba(251,191,36,0.4)]",
    progressBar: "bg-[#18181b]",
    ratingStar: "text-[#fbbf24]",
    sampleGradient: "from-[#18181b] to-[#fbbf24]",
  },
  ocean: {
    id: "ocean",
    name: "Océano Calmo & Esmeralda",
    headerBg: "bg-[#064e3b]",
    headerText: "text-[#ecfdf5]",
    accentText: "text-[#34d399]",
    accentBg: "bg-[#34d399]",
    badgeBg: "bg-[#34d399]",
    badgeText: "text-[#064e3b]",
    borderAccent: "border-[#064e3b]",
    cardHeaderBg: "bg-[#064e3b]",
    cardHeaderText: "text-[#ecfdf5]",
    primaryBtn: "bg-[#064e3b] text-[#34d399] hover:bg-[#065f46]",
    primaryBtnText: "text-[#34d399]",
    activeBadge: "bg-[#064e3b] text-[#34d399]",
    activeSlot: "border-[#064e3b] bg-[#064e3b] text-[#34d399] shadow-[3px_3px_0_rgba(52,211,153,0.4)]",
    progressBar: "bg-[#064e3b]",
    ratingStar: "text-[#34d399]",
    sampleGradient: "from-[#064e3b] to-[#34d399]",
  },
};

export interface BizSettings {
  depositEnabled: boolean;
  depositPct: number;
  hours: DayHours[]; // índice = getDay() (0 domingo)
  description: string;
  address: string;
  whatsapp: string;
  instagram: string;
  mapsUrl: string;
  transferAlias: string;
  transferCBU: string;
  transferHolder: string;
  setupDismissed: boolean;
  theme?: ThemeId;
  maxAdvanceDays?: number;
  closedDates?: string[]; // ej ["2026-12-25", "2027-01-01"]
  clientNotes?: Record<string, string>; // phone -> nota privada
}

export interface BizData {
  services: Service[];
  bookings: Booking[];
  products: Product[];
  reviews: Review[];
  coupons: Coupon[];
  professionals: Professional[];
  waitlist: WaitlistEntry[];
  blockedSlots?: BlockedSlot[];
  settings: BizSettings;
}

export interface UserSubscription {
  billing: "mensual" | "anual";
  activeSince: number;
  nextRenewal: number;
  autoRenew: boolean;
  status: "activa" | "cancelada";
  mpPreapprovalId?: string; // id de la suscripción en Mercado Pago (para cancelarla de verdad)
}

export interface User {
  id: string;
  name: string;
  business: string;
  email: string;
  password: string; // legacy (cuentas viejas sin migrar). Las nuevas guardan "".
  auth_id?: string; // vínculo con Supabase Auth: solo el dueño escribe sus filas
  slug: string;
  plan: Plan;
  createdAt: number;
  subscription?: UserSubscription;
  deleted?: boolean;
}

export const PLAN_META: Record<Plan, { name: string; price: string }> = {
  semilla: { name: "Semilla", price: "$0" },
  crece: { name: "Crece", price: "$9.500/mes" },
  escala: { name: "Escala", price: "$22.000/mes" },
};
/* Límite del plan gratuito: reservas activas por mes calendario */
export const SEMILLA_MONTHLY_LIMIT = 25;
export function monthBookingCount(data: Pick<BizData, "bookings">, ref = new Date()): number {
  const prefix = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
  return (data.bookings || []).filter((b) => b.date.startsWith(prefix) && b.status !== "cancelada").length;
}
export function semillaLimitReached(owner: Pick<User, "plan"> | undefined, data: Pick<BizData, "bookings">): boolean {
  if (!owner || owner.plan !== "semilla") return false;
  return monthBookingCount(data) >= SEMILLA_MONTHLY_LIMIT;
}
/* Estado inteligente de suscripción: Mercado Pago automático vs Pago manual / transferencia */
export type SubStatusKind =
  | "free"
  | "mp_active"
  | "mp_cancelled"
  | "manual_active"
  | "manual_expiring_soon"
  | "manual_grace_period"
  | "expired";

export function getSubscriptionStatus(u: Pick<User, "plan" | "subscription"> | undefined | null): {
  kind: SubStatusKind;
  daysRemaining: number;
  isExpired: boolean;
  isGracePeriod: boolean;
  isExpiringSoon: boolean;
  hasMpAutoDebit: boolean;
} {
  if (!u || u.plan === "semilla") {
    return {
      kind: "free",
      daysRemaining: 0,
      isExpired: false,
      isGracePeriod: false,
      isExpiringSoon: false,
      hasMpAutoDebit: false,
    };
  }

  const sub = u.subscription;
  const hasMpAutoDebit = Boolean(sub?.mpPreapprovalId);
  const now = Date.now();
  const nextRenewal = sub?.nextRenewal ?? (now + 30 * 86400000);
  const diffDays = Math.ceil((nextRenewal - now) / (1000 * 60 * 60 * 24));

  if (hasMpAutoDebit) {
    if (sub?.status === "cancelada") {
      const isExpired = now > nextRenewal;
      return {
        kind: isExpired ? "expired" : "mp_cancelled",
        daysRemaining: Math.max(0, diffDays),
        isExpired,
        isGracePeriod: false,
        isExpiringSoon: diffDays <= 5 && !isExpired,
        hasMpAutoDebit: true,
      };
    }
    return {
      kind: "mp_active",
      daysRemaining: Math.max(0, diffDays),
      isExpired: false,
      isGracePeriod: false,
      isExpiringSoon: false,
      hasMpAutoDebit: true,
    };
  }

  // Suscripción manual / transferencia
  const GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000;
  const isPastRenewal = now > nextRenewal;
  const isPastGrace = now > (nextRenewal + GRACE_PERIOD_MS);

  if (isPastGrace) {
    return {
      kind: "expired",
      daysRemaining: 0,
      isExpired: true,
      isGracePeriod: false,
      isExpiringSoon: false,
      hasMpAutoDebit: false,
    };
  }

  if (isPastRenewal) {
    return {
      kind: "manual_grace_period",
      daysRemaining: 0,
      isExpired: false,
      isGracePeriod: true,
      isExpiringSoon: false,
      hasMpAutoDebit: false,
    };
  }

  if (diffDays <= 5) {
    return {
      kind: "manual_expiring_soon",
      daysRemaining: Math.max(0, diffDays),
      isExpired: false,
      isGracePeriod: false,
      isExpiringSoon: true,
      hasMpAutoDebit: false,
    };
  }

  return {
    kind: "manual_active",
    daysRemaining: Math.max(0, diffDays),
    isExpired: false,
    isGracePeriod: false,
    isExpiringSoon: false,
    hasMpAutoDebit: false,
  };
}

export const isPaid = (u: User) => {
  if (u.plan === "semilla") return false;
  const status = getSubscriptionStatus(u);
  return !status.isExpired;
};

/* La cuenta demo vive solo en cada dispositivo: jamás se sube ni se trae de la nube */
export const DEMO_EMAIL = "demo@cupito.app";
export const DEMO_SLUG = "cupito-demo";
export const isDemoUser = (u: Pick<User, "email"> | undefined | null) => !!u && u.email === DEMO_EMAIL;
export const PRO_LIMIT: Record<Plan, number> = { semilla: 1, crece: 3, escala: 99 };
export const PRO_COLORS = ["#cdf463", "#ff7a59", "#93e6c3", "#b7e33f", "#f4b863"];

/* ============ storage seguro ============ */

const memory: Record<string, string> = {};
function safeGet(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return memory[key] ?? null; }
}
function safeSet(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch { memory[key] = value; }
}
function safeRemove(key: string) {
  try { window.localStorage.removeItem(key); } catch { delete memory[key]; }
}
function ssGet(key: string): string | null {
  try { return window.sessionStorage.getItem(key); } catch { return null; }
}
function ssSet(key: string, value: string) {
  try { window.sessionStorage.setItem(key, value); } catch { /* noop */ }
}
function ssRemove(key: string) {
  try { window.sessionStorage.removeItem(key); } catch { /* noop */ }
}

const USERS_KEY = "cupito_users";
const SESSION_KEY = "cupito_session";
const ADMIN_HASH_KEY = "cupito_admin_hash";
const ADMIN_SESSION_KEY = "cupito_admin_session";
const IMPERSONATION_KEY = "cupito_impersonation";
const DELETED_USERS_KEY = "cupito_deleted_users";
const DEMO_DELETED_KEY = "cupito_demo_deleted";
const TOMBSTONE_WAITLIST_KEY = "cupito_tombstones_waitlist";
const TOMBSTONE_BOOKING_KEY = "cupito_tombstones_booking";
const dataKey = (uid: string) => `cupito_data_${uid}`;

function getTombstones(key: string): Set<string> {
  try {
    const raw = safeGet(key);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function addTombstone(key: string, id: string) {
  try {
    const s = getTombstones(key);
    s.add(id);
    // acotar a los últimos 500 para no crecer sin límite
    const arr = Array.from(s).slice(-500);
    safeSet(key, JSON.stringify(arr));
  } catch { /* noop */ }
}

function getDeletedUserIds(): Set<string> {
  try {
    const raw = safeGet(DELETED_USERS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function markUserDeleted(id: string) {
  const s = getDeletedUserIds();
  s.add(id);
  safeSet(DELETED_USERS_KEY, JSON.stringify(Array.from(s)));
}

function unmarkUserDeleted(id: string) {
  const s = getDeletedUserIds();
  if (s.has(id)) {
    s.delete(id);
    safeSet(DELETED_USERS_KEY, JSON.stringify(Array.from(s)));
  }
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

async function hashPasscode(code: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`cupito::${code}`));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ================= helpers ================= */

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export const dayOfWeek = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
};
export function fmtLong(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const s = new Date(y, m - 1, d).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function fmtDateHuman(isoOrDate: string | number | Date | undefined): string {
  if (!isoOrDate) return "";
  try {
    const d = typeof isoOrDate === "string" || typeof isoOrDate === "number" ? new Date(isoOrDate) : isoOrDate;
    if (isNaN(d.getTime())) return String(isoOrDate);
    return d.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return String(isoOrDate);
  }
}
export function fmtMoney(n: number): string {
  return "$" + n.toLocaleString("es-AR");
}
export const RESERVED_SLUGS = new Set([
  "admin", "central", "auth", "login", "registro", "app", "dashboard",
  "precios", "problema", "solucion", "faq", "terms", "privacy", "terminos",
  "privacidad", "api", "assets", "static", "favicon", "robots", "sitemap"
]);

export function slugify(s: string): string {
  const base = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "mi-negocio";
  if (RESERVED_SLUGS.has(base)) {
    return `${base}-negocio`;
  }
  return base;
}

/* Lista de espera inteligente (Plan Escala): los clientes recurrentes van
   primero y a igualdad de condición vale el orden de llegada. El resto de
   los planes usa FIFO puro (orden de llegada). */
export function isRecurrentClient(w: Pick<WaitlistEntry, "phone">, bookings: Pick<Booking, "phone" | "status">[]): boolean {
  const digits = w.phone.replace(/\D/g, "");
  if (digits.length < 8) return false;
  const tail = digits.slice(-8);
  return bookings.some(
    (b) => b.status !== "cancelada" && b.phone.replace(/\D/g, "").endsWith(tail)
  );
}

export function sortWaitlist(waitlist: WaitlistEntry[], bookings: Booking[], plan: Plan): WaitlistEntry[] {
  const list = [...waitlist];
  if (plan === "escala") {
    const rec = new Map<string, boolean>();
    list.forEach((w) => rec.set(w.id, isRecurrentClient(w, bookings)));
    list.sort((a, b) => {
      const pa = rec.get(a.id) ? 0 : 1;
      const pb = rec.get(b.id) ? 0 : 1;
      if (pa !== pb) return pa - pb; // recurrentes primero
      return a.createdAt - b.createdAt; // después, orden de llegada
    });
    return list;
  }
  list.sort((a, b) => a.createdAt - b.createdAt);
  return list;
}

/* Horarios según configuración del día (intervalos 45 min), con corte opcional */
export function slotsForDay(h: DayHours | undefined): string[] {  if (!h || !h.open) return [];
  const block = (from?: string, to?: string): string[] => {
    if (!from || !to) return [];
    const [fh, fm] = from.split(":").map(Number);
    const [th, tm] = to.split(":").map(Number);
    const start = fh * 60 + fm;
    const end = th * 60 + tm;
    if (!(end > start)) return [];
    const out: string[] = [];
    for (let t = start; t + 45 <= end; t += 45) {
      out.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
    }
    return out;
  };
  return [...block(h.from, h.to), ...block(h.from2, h.to2)];
}

export function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function serviceDurationOf(services: Pick<Service, "id" | "duration">[], id: string): number {
  return services.find((s) => s.id === id)?.duration ?? 45;
}

/* ¿El turno nuevo pisa algún turno existente? Compara intervalos reales
   (hora + duración del servicio), no solo la hora exacta. Antes un servicio
   de 90 min a las 10:00 dejaba reservar otro a las 10:45 encimado. */
export function findOverlap(
  slot: { date: string; time: string; dur: number; proId?: string },
  list: Pick<Booking, "id" | "date" | "time" | "status" | "proId" | "serviceId" | "client">[],
  services: Pick<Service, "id" | "duration">[]
): Booking | undefined {
  const s = toMinutes(slot.time);
  const e = s + slot.dur;
  return list.find((b) => {
    if (b.date !== slot.date || b.status === "cancelada") return false;
    if (b.proId && slot.proId && b.proId !== slot.proId) return false;
    const bs = toMinutes(b.time);
    const be = bs + serviceDurationOf(services, b.serviceId);
    return s < be && bs < e;
  }) as Booking | undefined;
}

export function isSlotBlocked(
  slots: Pick<BlockedSlot, "date" | "time" | "endTime" | "proId">[],
  date: string,
  time: string,
  proId?: string
): boolean {
  return slots.some((bs) => {
    if (bs.date !== date) return false;
    if (bs.proId && proId && bs.proId !== proId) return false;
    if (bs.proId && !proId) return false;
    if (!bs.time) return true;
    if (!bs.endTime) return bs.time === time;
    const t = toMinutes(time);
    return t >= toMinutes(bs.time) && t < toMinutes(bs.endTime);
  });
}

/**
 * Retorna los horarios a usar para un profesional (sus propios horarios si los tiene, o los del negocio como fallback).
 */
export function getProHours(pro: Professional | undefined, bizHours: DayHours[]): DayHours[] {
  if (pro?.hours && Array.isArray(pro.hours) && pro.hours.length === 7) {
    return pro.hours;
  }
  return bizHours;
}

/**
 * ¿El profesional atiende y está libre en (date, time, dur)?
 */
export function isProAvailable(
  pro: Professional,
  date: string,
  time: string,
  dur: number,
  bizHours: DayHours[],
  blockedSlots: BlockedSlot[],
  bookings: Pick<Booking, "id" | "date" | "time" | "status" | "proId" | "serviceId" | "client">[],
  services: Pick<Service, "id" | "duration">[]
): boolean {
  const proHours = getProHours(pro, bizHours);
  const dayH = proHours[dayOfWeek(date)];
  if (!dayH || !dayH.open) return false;

  const s = toMinutes(time);
  const e = s + dur;

  const inShift1 = dayH.from && dayH.to && s >= toMinutes(dayH.from) && e <= toMinutes(dayH.to);
  const inShift2 = dayH.from2 && dayH.to2 && s >= toMinutes(dayH.from2) && e <= toMinutes(dayH.to2);
  if (!inShift1 && !inShift2) return false;

  if (isSlotBlocked(blockedSlots, date, time, pro.id)) return false;

  const overlap = findOverlap({ date, time, dur, proId: pro.id }, bookings, services);
  if (overlap) return false;

  return true;
}

/**
 * Retorna la lista de profesionales disponibles en (date, time, dur).
 */
export function getAvailablePros(
  pros: Professional[],
  date: string,
  time: string,
  dur: number,
  bizHours: DayHours[],
  blockedSlots: BlockedSlot[],
  bookings: Pick<Booking, "id" | "date" | "time" | "status" | "proId" | "serviceId" | "client">[],
  services: Pick<Service, "id" | "duration">[]
): Professional[] {
  return pros.filter((p) =>
    isProAvailable(p, date, time, dur, bizHours, blockedSlots, bookings, services)
  );
}

export function defaultHours(): DayHours[] {
  // [dom, lun, mar, mié, jue, vie, sáb]
  return [
    { open: false, from: "09:00", to: "13:00" },
    { open: true, from: "09:00", to: "20:00" },
    { open: true, from: "09:00", to: "20:00" },
    { open: true, from: "09:00", to: "20:00" },
    { open: true, from: "09:00", to: "20:00" },
    { open: true, from: "09:00", to: "20:00" },
    { open: true, from: "09:00", to: "14:00" },
  ];
}
export function defaultSettings(): BizSettings {
  return {
    depositEnabled: false,
    depositPct: 20,
    hours: defaultHours(),
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
  };
}

/* ================= seeds ================= */

function seedServices(): Service[] {
  return [
    { id: uid(), name: "Manicura clásica", price: 12000, duration: 40 },
    { id: uid(), name: "Kapping + esmaltado", price: 22000, duration: 75 },
    { id: uid(), name: "Soft gel", price: 30000, duration: 90 },
    { id: uid(), name: "Nail art por uña", price: 1500, duration: 15 },
  ];
}
function seedProducts(): Product[] {
  return [
    { id: uid(), name: "Aceite de cutículas", price: 6500, desc: "Hidratación profunda con vitamina E." },
    { id: uid(), name: "Esmalte semipermanente", price: 9000, desc: "Colores de temporada, duración 21 días." },
    { id: uid(), name: "Kit de cuidado en casa", price: 15000, desc: "Lima, aceite y base fortalecedora." },
  ];
}
function seedReviews(): Review[] {
  const today = new Date();
  const mk = (off: number, client: string, rating: number, text: string): Review => ({
    id: uid(), client, rating, text, date: dateKey(addDays(today, -off)),
  });
  return [
    mk(2, "Lucía Méndez", 5, "Reservé a las 2 AM y a la mañana ya tenía mi turno confirmado. Un lujo."),
    mk(5, "Sofía Ríos", 5, "Cero mensajes, cero espera. Pagué la seña y listo, me encantó."),
    mk(9, "Fer Peralta", 4, "Muy fácil de usar. Me llegó el recordatorio al calendario y no me lo olvidé."),
    mk(13, "Ana Torres", 5, "Pude sumar el esmalte al turno y me lo dejaron preparado. Vuelvo seguro."),
  ];
}
function seedCoupons(): Coupon[] {
  return [
    { id: uid(), code: "MARTES20", pct: 20, active: true },
    { id: uid(), code: "BIENVENIDA10", pct: 10, active: true },
  ];
}
function seedBookings(services: Service[]): Booking[] {
  const today = new Date();
  const mk = (off: number, time: string, client: string, phone: string, sIdx: number, status: BookingStatus, source: Booking["source"]): Booking => ({
    id: uid(), serviceId: services[sIdx].id, date: dateKey(addDays(today, off)), time, client, phone, status, source,
  });
  return [
    mk(0, "10:30", "Lucía Méndez", "11 5555-2031", 1, "confirmada", "online"),
    mk(0, "11:15", "Sofía Ríos", "11 6210-8842", 0, "confirmada", "online"),
    mk(0, "12:45", "Fer Peralta", "11 3345-9017", 2, "pendiente", "manual"),
    mk(0, "15:30", "Ana Torres", "11 7788-1204", 1, "confirmada", "online"),
    mk(1, "09:45", "Carla Benítez", "11 4432-7789", 0, "pendiente", "online"),
    mk(1, "14:00", "Micaela Duarte", "11 9902-3341", 2, "confirmada", "online"),
    mk(1, "17:00", "Rocío Salas", "11 2210-6675", 1, "pendiente", "online"),
    mk(2, "11:15", "Julieta Paz", "11 8876-4520", 3, "confirmada", "online"),
    mk(3, "16:15", "Valen Ortiz", "11 5101-2298", 0, "pendiente", "online"),
  ];
}

/* Registro nuevo: todo vacío, sin datos falsos */
function defaultData(): BizData {
  return {
    services: [],
    bookings: [],
    products: [],
    reviews: [],
    coupons: [],
    professionals: [],
    waitlist: [],
    settings: defaultSettings(),
  };
}

/* La cuenta demo se autopuebla como ejemplo para mostrar */
function seedDemoExtras(userId: string) {
  const data = loadData(userId);
  let changed = false;
  if (data.services.length === 0) {
    data.services = seedServices();
    data.bookings = seedBookings(data.services);
    changed = true;
  }
  if (data.products.length === 0) { data.products = seedProducts(); changed = true; }
  if (data.reviews.length === 0) { data.reviews = seedReviews(); changed = true; }
  if (data.coupons.length === 0) { data.coupons = seedCoupons(); changed = true; }
  if (data.professionals.length === 0) {
    data.professionals = [
      { id: uid(), name: "Caro Méndez", role: "Nail artist", color: "#cdf463" },
      { id: uid(), name: "Maru Lopez", role: "Manicura", color: "#ff7a59" },
    ];
    changed = true;
  }
  if (!data.settings.depositEnabled) { data.settings.depositEnabled = true; changed = true; }
  if (!data.settings.description) {
    data.settings = {
      ...data.settings,
      description: "Manicura, kapping y nail art con productos de primera. Más de 5 años cuidando tus uñas.",
      address: "Av. Corrientes 1234, CABA",
      whatsapp: "1155551234",
      instagram: "studionails.ok",
      mapsUrl: "https://www.google.com/maps/search/?api=1&query=Studio+Nails+Av.+Corrientes+CABA",
      transferAlias: "STUDIONAILS.CBU",
      transferCBU: "0110012330001234567890",
      transferHolder: "Carolina Méndez",
      theme: "evergreen",
    };
    changed = true;
  }
  if (!data.settings.setupDismissed) { data.settings.setupDismissed = true; changed = true; }
  if (changed) saveData(userId, data);
}

/* Migra datos guardados en versiones anteriores */
function normalizeData(p: Partial<BizData>): BizData {
  const d = defaultData();
  const s = (p.settings ?? {}) as Partial<BizSettings>;
  return {
    services: Array.isArray(p.services) ? p.services : d.services,
    bookings: Array.isArray(p.bookings) ? p.bookings : [],
    products: Array.isArray(p.products) ? p.products : d.products,
    reviews: Array.isArray(p.reviews) ? p.reviews : d.reviews,
    coupons: Array.isArray(p.coupons) ? p.coupons : d.coupons,
    professionals: Array.isArray(p.professionals)
      ? p.professionals.map((pro: any) => ({
          ...pro,
          hours: Array.isArray(pro.hours) && pro.hours.length === 7 ? pro.hours : undefined,
        }))
      : d.professionals,
    waitlist: Array.isArray(p.waitlist) ? p.waitlist : d.waitlist,
    blockedSlots: Array.isArray(p.blockedSlots) ? p.blockedSlots : [],
    settings: {
      ...d.settings,
      depositEnabled: typeof s.depositEnabled === "boolean" ? s.depositEnabled : d.settings.depositEnabled,
      depositPct: typeof s.depositPct === "number" ? s.depositPct : d.settings.depositPct,
      hours: Array.isArray(s.hours) && s.hours.length === 7 ? (s.hours as DayHours[]) : d.settings.hours,
      description: typeof s.description === "string" ? s.description : "",
      address: typeof s.address === "string" ? s.address : "",
      whatsapp: typeof s.whatsapp === "string" ? s.whatsapp : "",
      instagram: typeof s.instagram === "string" ? s.instagram : "",
      mapsUrl: typeof s.mapsUrl === "string" ? s.mapsUrl : "",
      transferAlias: typeof s.transferAlias === "string" ? s.transferAlias : "",
      transferCBU: typeof s.transferCBU === "string" ? s.transferCBU : "",
      transferHolder: typeof s.transferHolder === "string" ? s.transferHolder : "",
      setupDismissed: typeof s.setupDismissed === "boolean" ? s.setupDismissed : false,
      theme: (s.theme && THEMES[s.theme as ThemeId] ? s.theme : "evergreen") as ThemeId,
      maxAdvanceDays: typeof s.maxAdvanceDays === "number" ? s.maxAdvanceDays : 30,
      closedDates: Array.isArray(s.closedDates) ? s.closedDates : [],
      clientNotes: typeof s.clientNotes === "object" && s.clientNotes !== null ? s.clientNotes : {},
    },
  };
}

/* ================= persistencia ================= */

let users: User[] = (() => {
  try {
    const deleted = getDeletedUserIds();
    const raw = safeGet(USERS_KEY);
    const parsed = raw ? (JSON.parse(raw) as User[]) : [];
    return parsed
      .filter((u) => !deleted.has(u.id))
      .map((u) => ({ ...u, plan: u.plan ?? "semilla" }));
  } catch { return []; }
})();
let sessionUserId: string | null = safeGet(SESSION_KEY);
let storeVersion = 0;
const listeners = new Set<() => void>();
function emit() { storeVersion++; listeners.forEach((l) => l()); }

function saveUsers(list: User[]) {
  users = list;
  safeSet(USERS_KEY, JSON.stringify(list));
  if (isSupabaseConfigured) {
    list.forEach((u) => {
      if (isDemoUser(u)) return; // la demo no sale de este dispositivo
      syncUserToRemote(u).catch(() => {});
    });
  }
}

function saveSession(id: string | null) {
  sessionUserId = id;
  if (id) {
    unmarkUserDeleted(id);
    safeSet(SESSION_KEY, id);
  } else {
    safeRemove(SESSION_KEY);
  }
}

/* Marca que la cuenta se creó recién (para mostrarle elegir plan al entrar).
   Se consume una sola vez. */
const FRESH_KEY = "cupito_fresh_signup";
export function setFreshSignup() {
  safeSet(FRESH_KEY, "1");
}
export function consumeFreshSignup(): boolean {
  try {
    if (safeGet(FRESH_KEY) === "1") {
      safeRemove(FRESH_KEY);
      return true;
    }
  } catch { /* noop */ }
  return false;
}

export function getSessionUser(): User | null {
  return users.find((u) => u.id === sessionUserId) ?? null;
}

/* Clave de la Central para operar la nube (queda en sessionStorage del navegador) */
const ADMIN_KEY_KEY = "cupito_admin_key";
export function getAdminKey(): string {
  try {
    return window.sessionStorage.getItem(ADMIN_KEY_KEY) || "";
  } catch {
    return "";
  }
}
export function setAdminKey(k: string) {
  try {
    if (k) window.sessionStorage.setItem(ADMIN_KEY_KEY, k);
    else window.sessionStorage.removeItem(ADMIN_KEY_KEY);
  } catch { /* noop */ }
}

/* Llamada en segundo plano a /api/admin (no bloquea la UI; ya se aplicó local) */
function pushAdmin(payload: Record<string, unknown>) {
  if (!isSupabaseConfigured || typeof window === "undefined") return;
  const adminKey = getAdminKey();
  if (!adminKey) {
    console.warn("[Cupito] Sin clave de Central: el cambio quedó solo local (cargala en el modal de nube).");
    return;
  }
  fetch("/api/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, adminKey }),
  }).then((r) => {
    if (!r.ok) console.warn("[Cupito] /api/admin respondió", r.status);
  }).catch(() => {});
}

/* Importa una cuenta traída de la nube a este dispositivo (login/registro
   en otro aparato, o migración a Auth): reemplaza duplicados por email,
   guarda datos e inicia sesión. */
function importRemoteAccount(remote: { user: User; data: BizData | null }) {
  const withoutDup = users.filter((u) => u.id !== remote.user.id && u.email !== remote.user.email);
  users = [...withoutDup, remote.user];
  safeSet(USERS_KEY, JSON.stringify(users));
  if (remote.data) {
    safeSet(dataKey(remote.user.id), JSON.stringify(normalizeData(remote.data)));
  } else {
    loadData(remote.user.id);
  }
  saveSession(remote.user.id);
  emit();
  if (isSupabaseConfigured) api.syncUserDataFromCloud(remote.user.id).catch(() => {});
}

/* Llama al endpoint público (/api/public) para escrituras de invitados.
   Devuelve null si no hay nube o la red falló (el caller usa la vía local). */
async function callPublicApi(
  payload: Record<string, unknown>
): Promise<{ ok: true; id?: string; data?: BizData } | { ok: false; error: string } | null> {
  if (!isSupabaseConfigured || typeof window === "undefined") return null;
  try {
    const res = await fetch("/api/public", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    // Sin JSON no hay API (ej: dev local) → vía local
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return null;
    const r = await res.json().catch(() => ({}));
    if (!res.ok || r.error) return { ok: false, error: String(r.error || "Error de red.") };
    return { ok: true, id: r.id, data: r.data as BizData | undefined };
  } catch {
    return null;
  }
}

/* Adopta la cuenta del dueño logueado en Auth: la busca local por auth_id,
   si no está la trae de la nube, y si tampoco existe pero hay un registro
   pendiente (confirmó el email después), crea el negocio. Devuelve null si
   ok, o mensaje de error. */
async function adoptAuthAccount(authId: string): Promise<string | null> {
  const deleted = getDeletedUserIds();
  const hit = users.find((u) => u.auth_id === authId && !deleted.has(u.id));
  if (hit) {
    saveSession(hit.id);
    emit();
    if (isSupabaseConfigured) api.syncUserDataFromCloud(hit.id).catch(() => {});
    return null;
  }
  const remote = await fetchRemoteUserByAuthId(authId).catch(() => null);
  if (remote && !deleted.has(remote.user.id)) {
    importRemoteAccount(remote);
    return null;
  }
  // Sin fila: ¿venía de un registro con email por confirmar?
  const pending = loadPendingBiz();
  if (pending && pending.authId === authId) {
    const created = await createBizRowFromPending(pending);
    if (created) return null;
  }
  // Login válido pero sin negocio (ej: confirmó el email en otro dispositivo).
  // No cerramos sesión: la UI pide nombre+negocio y lo crea (NEEDS_SETUP).
  return "NEEDS_SETUP";
}

/* Registro que quedó pendiente de confirmación de email */
interface PendingBiz { authId: string; name: string; business: string; email: string }
const PENDING_BIZ_KEY = "cupito_pending_biz";
function savePendingBiz(p: PendingBiz) {
  safeSet(PENDING_BIZ_KEY, JSON.stringify(p));
}
function loadPendingBiz(): PendingBiz | null {
  try {
    const raw = safeGet(PENDING_BIZ_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingBiz;
    if (!p.authId || !p.business || !p.email) return null;
    return p;
  } catch {
    return null;
  }
}
function clearPendingBiz() {
  safeRemove(PENDING_BIZ_KEY);
}

async function ensureUniqueSlug(base: string): Promise<string> {
  let slug = base;
  let i = 1;
  while (users.some((u) => u.slug === slug)) slug = `${base}-${i++}`;
  if (isSupabaseConfigured) {
    while (await fetchRemoteUserBySlug(slug).catch(() => null)) slug = `${base}-${i++}`;
  }
  return slug;
}

/* Crea el negocio cuando el login es válido pero no hay fila (NEEDS_SETUP).
   Pasa si se confirmó el email en otro dispositivo. */
async function completeBizSetupCore(name: string, business: string): Promise<string | null> {
  try {
    const sess = await sbValidateSession().catch(() => null);
    if (!sess) return "Tu sesión venció. Entrá de nuevo.";
    const deleted = getDeletedUserIds();
    const hit = users.find((u) => u.auth_id === sess.authId && !deleted.has(u.id));
    if (hit) {
      saveSession(hit.id);
      emit();
      return null;
    }
    const remote = await fetchRemoteUserByAuthId(sess.authId).catch(() => null);
    if (remote && !deleted.has(remote.user.id)) {
      importRemoteAccount(remote);
      return null;
    }
    if (name.trim().length < 2) return "Contanos tu nombre.";
    if (business.trim().length < 2) return "¿Cómo se llama tu negocio?";
    const em = sess.email.toLowerCase().trim();
    const slug = await ensureUniqueSlug(slugify(business));
    const user: User = {
      id: sess.authId,
      auth_id: sess.authId,
      name: name.trim(),
      business: business.trim(),
      email: em,
      password: "",
      slug,
      plan: "semilla",
      createdAt: Date.now(),
      deleted: false,
    };
    unmarkUserDeleted(user.id);
    const withoutDup = users.filter((u) => u.email !== em && u.id !== user.id);
    saveUsers([...withoutDup, user]);
    saveSession(user.id);
    const fresh = defaultData();
    saveData(user.id, fresh);
    clearPendingBiz();
    setFreshSignup();
    await syncUserToRemote(user, fresh).catch(() => {});
    emit();
    return null;
  } catch {
    return "No pudimos crear tu negocio. Escribinos a hola@cupito.app y lo resolvemos.";
  }
}
/* Crea la fila del negocio para un registro pendiente ya confirmado */
async function createBizRowFromPending(pending: PendingBiz): Promise<boolean> {
  try {
    const slug = await ensureUniqueSlug(slugify(pending.business));
    const user: User = {
      id: pending.authId,
      auth_id: pending.authId,
      name: pending.name.trim(),
      business: pending.business.trim(),
      email: pending.email,
      password: "",
      slug,
      plan: "semilla",
      createdAt: Date.now(),
      deleted: false,
    };
    unmarkUserDeleted(user.id);
    const withoutDup = users.filter((u) => u.email !== pending.email && u.id !== user.id);
    saveUsers([...withoutDup, user]);
    saveSession(user.id);
    const fresh = defaultData();
    saveData(user.id, fresh);
    clearPendingBiz();
    setFreshSignup();
    await syncUserToRemote(user, fresh).catch(() => {});
    emit();
    return true;
  } catch {
    return false;
  }
}

/* Migra una cuenta legacy (password en texto plano) a Supabase Auth.
   Devuelve null si migró e inició sesión, o string con el error. */
async function migrateLegacyAccount(em: string, password: string): Promise<string | null> {
  // 1) La fila tiene que existir (local o nube) y coincidir el password
  const local = users.find((x) => x.email === em);
  const remote = await fetchRemoteUserByEmail(em).catch(() => null);
  const row = local ?? remote?.user;
  if (!row) return "No encontramos ninguna cuenta con ese email.";
  if ((row.password || "") !== password) return "La contraseña no coincide. Probá de nuevo.";
  if (isDemoUser(row)) {
    saveSession(row.id);
    emit();
    return null;
  }
  // 2) Migrar en el servidor (verifica password y crea el auth user)
  let res: any = null;
  try {
    const r = await fetch("/api/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "migrate", email: em, password }),
    });
    res = await r.json().catch(() => ({}));
  } catch {
    return "No pudimos conectar con el servidor. Revisá tu internet.";
  }
  if (!res?.ok) {
    if (res?.error === "NEED_SIGNIN") {
      const s = await sbSignIn(em, password);
      if (s.ok) return adoptAuthAccount(s.authId);
    }
    return typeof res?.error === "string" && res.error
      ? res.error
      : "No pudimos migrar tu cuenta. Escribinos a hola@cupito.app.";
  }
  // 3) Iniciar sesión en Auth y traer la fila vinculada
  const s = await sbSignIn(em, password);
  if (!s.ok) return "Cuenta migrada ✓ Entrá de nuevo con tu email y contraseña.";
  const fresh = await fetchRemoteUserByEmail(em).catch(() => null);
  if (fresh) {
    importRemoteAccount(fresh);
    return null;
  }
  return adoptAuthAccount(s.authId);
}

function loadData(userId: string): BizData {
  try {
    const raw = safeGet(dataKey(userId));
    if (raw) return normalizeData(JSON.parse(raw) as Partial<BizData>);
  } catch { /* datos corruptos → re-seed */ }
  const seeded = defaultData();
  safeSet(dataKey(userId), JSON.stringify(seeded));
  return seeded;
}

function saveData(userId: string, data: BizData) {
  safeSet(dataKey(userId), JSON.stringify(data));
  if (isSupabaseConfigured) {
    const u = users.find((x) => x.id === userId);
    if (u && !isDemoUser(u)) {
      // Encadenar los upserts por usuario para que dos guardados rápidos
      // (ej: crear turno + borrar de lista de espera) no se pisen entre sí.
      // Sin esto, el upsert viejo podía terminar último y "resucitar" la entrada borrada.
      const prev = remoteSaveQueue.get(userId) ?? Promise.resolve();
      const next = prev
        .then(() => syncUserToRemote(u, data))
        .catch(() => {});
      remoteSaveQueue.set(userId, next);
    }
  }
}

// Cola de guardados remotos por usuario (evita condiciones de carrera)
const remoteSaveQueue = new Map<string, Promise<unknown>>();

// Sincronización automática inicial desde Supabase para traer negocios creados en otros dispositivos
if (typeof window !== "undefined" && isSupabaseConfigured) {
  fetchAllRemoteUsers().then((remoteUsers) => {
    const deleted = getDeletedUserIds();
    const prevUsers = users;
    const prevSession = sessionUserId;
    const remoteByEmail = new Map<string, User>();
    (remoteUsers || []).forEach((u) => {
      if (u.deleted === false) {
        unmarkUserDeleted(u.id);
        deleted.delete(u.id);
      }
      if (!deleted.has(u.id) && !isDemoUser(u)) remoteByEmail.set(u.email, u);
    });
    const map = new Map<string, User>();
    prevUsers.forEach((u) => {
      if (!deleted.has(u.id)) map.set(u.id, u);
    });
    // Si el mismo email existe local (vacío, creado sin conexión) y en la nube,
    // gana la versión de la nube y se descarta el duplicado local.
    Array.from(map.keys()).forEach((id) => {
      const u = map.get(id);
      const r = u ? remoteByEmail.get(u.email) : undefined;
      if (u && r && r.id !== id) map.delete(id);
    });
    (remoteUsers || []).forEach((u) => {
      if (!deleted.has(u.id) && !isDemoUser(u)) map.set(u.id, u);
    });
    const combined = Array.from(map.values());
    const remoteIds = new Set((remoteUsers || []).map((u) => u.id));
    users = combined;
    safeSet(USERS_KEY, JSON.stringify(combined));
    // Si la sesión apuntaba a un duplicado descartado, moverla a la cuenta real
    if (prevSession && !map.has(prevSession)) {
      const old = prevUsers.find((u) => u.id === prevSession);
      const real = old ? remoteByEmail.get(old.email) : undefined;
      saveSession(real ? real.id : null);
    }
    emit();
    // Subir a la nube las cuentas creadas en este dispositivo cuando no había
    // conexión (si no, la compu nunca aparece en el celu y viceversa).
    // Solo filas con auth_id: con RLS+Auth el servidor rechaza las demás
    // (se suben solas al migrar/iniciar sesión).
    combined.forEach((u) => {
      if (!remoteIds.has(u.id) && !deleted.has(u.id) && !isDemoUser(u) && u.auth_id) {
        try {
          syncUserToRemote(u, loadData(u.id)).catch(() => {});
        } catch { /* noop */ }
      }
    });
  }).catch((e) => console.warn("[Cupito] Error en sync inicial de Supabase:", e));

  // Restaurar sesión de Supabase Auth: si hay JWT válido pero la sesión local
  // apunta a otro lado (u otro dispositivo), adoptar la cuenta del dueño.
  sbValidateSession().then((sess) => {
    if (!sess) return;
    const deleted = getDeletedUserIds();
    const hit = users.find((u) => u.auth_id === sess.authId && !deleted.has(u.id));
    if (hit) {
      if (sessionUserId !== hit.id) {
        saveSession(hit.id);
        emit();
      }
      return;
    }
    fetchRemoteUserByAuthId(sess.authId).then((remote) => {
      if (remote && !deleted.has(remote.user.id)) importRemoteAccount(remote);
    }).catch(() => {});
  }).catch(() => {});
}

/* ================= store ================= */

interface StoreApi {
  users: User[];
  sessionUserId: string | null;
  toast: (text: string, kind?: "ok" | "warn") => void;
  register(input: { name: string; business: string; email: string; password: string }): string | null;
  login(email: string, password: string): string | null;
  loginAsync(email: string, password: string): Promise<string | null>;
  registerAsync(input: { name: string; business: string; email: string; password: string }): Promise<string | null>;
  completeBizSetup(input: { name: string; business: string }): Promise<string | null>;
  loginDemo(): void;
  logout(): void;
  deleteAccount(): void;
  saveProfile(business: string, name: string): void;
  getData(userId: string): BizData;
  /* admin central */
  adminHasPasscode(): boolean;
  adminSetPasscode(code: string): Promise<void>;
  adminLogin(code: string): Promise<boolean>;
  adminLogout(): void;
  loginAs(userId: string): void;
  stopImpersonating(): void;
  adminSetPlan(userId: string, plan: Plan): void;
  adminUpdateUser(userId: string, updates: Partial<User>): void;
  adminAddUser(data: { name: string; business: string; email: string; password: string; plan: Plan; billing?: "mensual" | "anual"; durationDays?: number }): Promise<{ ok: boolean; error?: string; user?: User; warning?: string }>;
  adminAddUserLocal(data: { name: string; business: string; email: string; password: string; plan: Plan; billing?: "mensual" | "anual"; durationDays?: number }): User;
  adminDeleteUser(userId: string): void;
  /* negocio */
  addService(s: Omit<Service, "id">): void;
  updateService(id: string, patch: Partial<Omit<Service, "id">>): void;
  removeService(id: string): void;
  addProduct(p: Omit<Product, "id">): void;
  updateProduct(id: string, patch: Partial<Omit<Product, "id">>): void;
  removeProduct(id: string): void;
  updateSettings(patch: Partial<BizSettings>): void;
  setPlan(plan: Plan): void;
  saveMpPreapprovalId(id: string): void;
  cancelSubscription(): void;
  cancelSubscriptionAsync(): Promise<{ ok: true } | { ok: false; error: string }>;
  resumeSubscription(): void;
  addReview(r: Omit<Review, "id">): void;
  removeReview(id: string): void;
  addReviewFor(ownerId: string, r: Omit<Review, "id">): Promise<void>;
  addCoupon(c: { code: string; pct: number }): string | null;
  updateCoupon(id: string, patch: Partial<Omit<Coupon, "id">>): void;
  removeCoupon(id: string): void;
  addProfessional(name: string, role: string, hours?: DayHours[]): string | null;
  updateProfessional(id: string, patch: Partial<Omit<Professional, "id">>): void;
  removeProfessional(id: string): void;
  addWaitlist(e: { date: string; serviceId: string; client: string; phone: string }, ownerId?: string): Promise<string | null>;
  removeWaitlist(id: string): void;  createBookingFromWaitlist(waitlistId: string, b: { client: string; phone: string; serviceId: string; date: string; time: string; source: Booking["source"]; items?: Booking["items"]; proId?: string }): { ok: true; id: string } | { ok: false; error: string };
  requestReview(bookingId: string): "sent" | "noemail";
  addBooking(b: { client: string; phone: string; email?: string; serviceId: string; date: string; time: string; source: Booking["source"]; items?: Booking["items"]; proId?: string }): { ok: true; id: string } | { ok: false; error: string };
  addBookingFor(ownerId: string, b: { client: string; phone: string; email?: string; serviceId: string; date: string; time: string; source: Booking["source"]; items?: Booking["items"]; proId?: string; paidDeposit?: boolean; paymentMethod?: PaymentMethod; status?: BookingStatus; depositClaim?: Booking["depositClaim"] }): Promise<{ ok: true; id: string } | { ok: false; error: string }>;
  rescheduleBooking(id: string, newDate: string, newTime: string, newProId?: string): { ok: boolean; error?: string };
  setStatus(id: string, status: BookingStatus): void;
  removeBooking(id: string): void;
  markDepositPaid(id: string, method: PaymentMethod): void;
  rejectDeposit(id: string): void;
  releaseExpiredClaims(): number;
  setBookingPro(id: string, proId: string | undefined): void;
  addBlockedSlot(slot: Omit<BlockedSlot, "id">): void;
  removeBlockedSlot(id: string): void;
  saveClientNote(phone: string, note: string): void;
  cancelBookingByClient(ownerId: string, bookingId: string, reason?: string, phone?: string): Promise<{ ok: boolean; error?: string }>;
  addClosedDate(dateStr: string): void;
  removeClosedDate(dateStr: string): void;
  /* sincronización nube */
  isCloudSyncActive: boolean;
  fetchPageRemote(slug: string): Promise<boolean>;
  syncUserDataFromCloud(userId: string): Promise<boolean>;
}

const api: Omit<StoreApi, "toast" | "users" | "sessionUserId"> = {
  isCloudSyncActive: isSupabaseConfigured,
  async fetchPageRemote(slug: string) {
    if (!isSupabaseConfigured) return false;
    const remote = await fetchRemoteUserBySlug(slug);
    if (!remote || isDemoUser(remote.user)) return false;
    unmarkUserDeleted(remote.user.id);
    // Si hay un duplicado local con el mismo email, lo reemplaza la nube.
    const currentUsers = users.filter((u) => u.id !== remote.user.id && u.email !== remote.user.email);
    users = [...currentUsers, remote.user];
    safeSet(USERS_KEY, JSON.stringify(users));
    if (remote.data) {
      const local = loadData(remote.user.id);
      const localHasStuff = (local.services?.length || 0) + (local.bookings?.length || 0) > 0;
      const remoteHasStuff = ((remote.data.services?.length || 0) + (remote.data.bookings?.length || 0)) > 0;
      if (remoteHasStuff || !localHasStuff) {
        safeSet(dataKey(remote.user.id), JSON.stringify(remote.data));
      } else {
        // La nube está vacía y este dispositivo tiene los datos posta: subir, no pisar.
        syncUserToRemote(remote.user, local).catch(() => {});
      }
    }
    emit();
    await api.syncUserDataFromCloud(remote.user.id).catch(() => {});
    return true;
  },
  async syncUserDataFromCloud(userId: string) {
    if (!isSupabaseConfigured) return false;
    const me = users.find((u) => u.id === userId);
    if (me && isDemoUser(me)) return false; // la demo es 100% local
    const remoteData = await fetchRemoteBizData(userId);
    if (!remoteData) {
      // La nube no tiene fila para este negocio (cuenta creada sin conexión):
      // subir lo local en vez de rendirse.
      try {
        const local = loadData(userId);
        const hasStuff =
          (local.services || []).length > 0 ||
          (local.bookings || []).length > 0 ||
          (local.waitlist || []).length > 0;
        const owner = users.find((u) => u.id === userId);
        if (owner && hasStuff) {
          await syncUserToRemote(owner, local).catch(() => {});
          return true;
        }
      } catch { /* noop */ }
      return false;
    }

    const tombWait = getTombstones(TOMBSTONE_WAITLIST_KEY);
    const tombBook = getTombstones(TOMBSTONE_BOOKING_KEY);
    const localData = loadData(userId);

    // Merge: lo local gana ante el mismo id (así un cambio de estado hecho
    // en esta compu no lo pisa el dato viejo de la nube), y los ids borrados
    // (tombstones) nunca resucitan aunque sigan dando vueltas en la nube.
    const bookingMap = new Map<string, Booking>();
    (remoteData.bookings || []).forEach((b) => {
      if (!tombBook.has(b.id)) bookingMap.set(b.id, b);
    });
    (localData.bookings || []).forEach((b) => {
      if (!tombBook.has(b.id)) bookingMap.set(b.id, b);
    });

    const waitlistMap = new Map<string, WaitlistEntry>();
    (remoteData.waitlist || []).forEach((w) => {
      if (!tombWait.has(w.id)) waitlistMap.set(w.id, w);
    });
    (localData.waitlist || []).forEach((w) => {
      if (!tombWait.has(w.id)) waitlistMap.set(w.id, w);
    });

    const finalMerged: BizData = {
      services: (remoteData.services?.length ? remoteData.services : localData.services) ?? [],
      bookings: Array.from(bookingMap.values()),
      products: remoteData.products?.length ? remoteData.products : localData.products,
      reviews: [...new Map([...(localData.reviews || []), ...(remoteData.reviews || [])].map((r) => [r.id, r])).values()],
      coupons: remoteData.coupons ?? localData.coupons,
      professionals: remoteData.professionals?.length ? remoteData.professionals : localData.professionals,
      waitlist: Array.from(waitlistMap.values()),
      blockedSlots: remoteData.blockedSlots ?? localData.blockedSlots ?? [],
      settings: remoteData.settings ?? localData.settings,
    };

    safeSet(dataKey(userId), JSON.stringify(finalMerged));
    emit();

    // Subir a la nube lo que este dispositivo tiene y la nube no (servicios
    // cargados en la compu, reservas locales, etc.). Solo AGREGA, nunca borra:
    // los borrados se propagan por deleteRemoteWaitlist/deleteRemoteBooking.
    try {
      const remoteBookingIds = new Set((remoteData.bookings || []).map((b) => b.id));
      const remoteWaitlistIds = new Set((remoteData.waitlist || []).map((w) => w.id));
      const remoteReviewIds = new Set((remoteData.reviews || []).map((r) => r.id));
      const missingBookings = (localData.bookings || []).filter((b) => !remoteBookingIds.has(b.id));
      const missingWaitlist = (localData.waitlist || []).filter((w) => !remoteWaitlistIds.has(w.id));
      const missingReviews = (localData.reviews || []).filter((r) => !remoteReviewIds.has(r.id));
      const needServices = (remoteData.services || []).length === 0 && (localData.services || []).length > 0;
      const needPros = (remoteData.professionals || []).length === 0 && (localData.professionals || []).length > 0;
      const needProducts = (remoteData.products || []).length === 0 && (localData.products || []).length > 0;
      const needCoupons = (remoteData.coupons || []).length === 0 && (localData.coupons || []).length > 0;
      if (missingBookings.length > 0 || missingWaitlist.length > 0 || missingReviews.length > 0 || needServices || needPros || needProducts || needCoupons) {
        const pushed: BizData = {
          ...remoteData,
          services: needServices ? localData.services : remoteData.services,
          bookings: [...(remoteData.bookings || []), ...missingBookings],
          products: needProducts ? localData.products : remoteData.products,
          reviews: [...(remoteData.reviews || []), ...missingReviews],
          coupons: needCoupons ? localData.coupons : remoteData.coupons,
          professionals: needPros ? localData.professionals : remoteData.professionals,
          waitlist: [...(remoteData.waitlist || []), ...missingWaitlist],
          blockedSlots: remoteData.blockedSlots ?? localData.blockedSlots ?? [],
          settings: remoteData.settings ?? localData.settings,
        };
        const owner = users.find((u) => u.id === userId);
        if (owner) syncUserToRemote(owner, pushed).catch(() => {});
      }
    } catch { /* noop */ }
    return true;
  },
  register({ name, business, email, password }) {
    const em = email.trim().toLowerCase();
    if (users.some((u) => u.email === em)) return "Ya existe una cuenta con ese email. ¿Querés iniciar sesión?";
    // Slug único: dos negocios con el mismo nombre no pueden compartir link
    // (si no, la página pública muestra los datos del equivocado).
    let slug = slugify(business);
    const base = slug;
    let i = 1;
    while (users.some((u) => u.slug === slug)) slug = `${base}-${i++}`;
    const user: User = {
      id: uid(),
      name: name.trim(),
      business: business.trim(),
      email: em,
      password,
      slug,
      plan: "semilla",
      createdAt: Date.now(),
    };
    saveUsers([...users, user]);
    saveSession(user.id);
    loadData(user.id);
    emit();
    return null;
  },
  login(email, password) {
    const em = email.trim().toLowerCase();
    const u = users.find((x) => x.email === em);
    if (!u) {
      // Si la nube está activa, puede que la cuenta exista pero aún no se haya
      // sincronizado a este dispositivo. Avisamos para que la UI intente loginAsync.
      if (isSupabaseConfigured) return "BUSCANDO_EN_NUBE";
      return "No encontramos ninguna cuenta con ese email.";
    }
    if (u.password !== password) return "La contraseña no coincide. Probá de nuevo.";
    saveSession(u.id);
    emit();
    // Traer datos frescos de la nube en segundo plano
    if (isSupabaseConfigured) api.syncUserDataFromCloud(u.id).catch(() => {});
    return null;
  },
  async loginAsync(email, password) {
    const em = email.trim().toLowerCase();
    // 1) Camino real: Supabase Auth
    if (isSupabaseConfigured) {
      const s = await sbSignIn(em, password).catch(() => ({ ok: false, reason: "error", error: "No pudimos conectar." }) as const);
      if (s.ok) {
        const err = await adoptAuthAccount(s.authId);
        if (err) return err;
        // Cuenta recién creada (confirmó el email y entra por primera vez): elegir plan
        if (consumeFreshSignup()) return "FRESH_PICK_PLAN";
        return null;
      }
      if (s.reason === "confirm") {
        return "Tu email todavía no está confirmado. Revisá tu bandeja (y spam) y después entrá.";
      }
      if (s.error !== "invalid") return s.error;
      // Credenciales inválidas en Auth: puede ser cuenta legacy sin migrar → migrar
      const mig = await migrateLegacyAccount(em, password);
      if (mig !== null) return mig;
      return "La contraseña no coincide. Probá de nuevo.";
    }
    // 2) Sin nube: comparación local legacy
    const local = users.find((x) => x.email === em);
    if (!local) return "No encontramos ninguna cuenta con ese email.";
    if (local.password !== password) return "La contraseña no coincide. Probá de nuevo.";
    saveSession(local.id);
    emit();
    return null;
  },
  async registerAsync({ name, business, email, password }) {
    const em = email.trim().toLowerCase();
    if (users.some((u) => u.email === em)) return "Ya existe una cuenta con ese email. ¿Querés iniciar sesión?";
    // Sin nube: cuenta local legacy
    if (!isSupabaseConfigured) {
      return api.register({ name, business, email, password });
    }
    // No crear duplicados: si el email ya existe en la nube, ir a login
    const remote = await fetchRemoteUserByEmail(em).catch(() => null);
    if (remote) return "Ya existe una cuenta con ese email. ¿Querés iniciar sesión?";

    // 1) Registro en el servidor mediante /api/account (Service Role):
    // Crea el Auth user con email pre-confirmado, genera el slug único y
    // graba de inmediato en cupito_users y cupito_data en Supabase sin bloqueos de RLS.
    try {
      const res = await fetch("/api/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          name: name.trim(),
          business: business.trim(),
          email: em,
          password,
        }),
      });
      const r = await res.json().catch(() => ({}));
      if (res.ok && r.ok && r.user) {
        const user: User = {
          id: r.user.id,
          auth_id: r.user.auth_id || r.user.id,
          name: r.user.name,
          business: r.user.business,
          email: r.user.email,
          password: "",
          slug: r.user.slug,
          plan: r.user.plan || "semilla",
          createdAt: Number(r.user.created_at || Date.now()),
          subscription: r.user.subscription || undefined,
          deleted: false,
        };
        unmarkUserDeleted(user.id);
        const withoutDup = users.filter((u) => u.email !== em && u.id !== user.id);
        users = [...withoutDup, user];
        safeSet(USERS_KEY, JSON.stringify(users));
        saveSession(user.id);
        // Conectar la sesión ANTES de guardar: sin JWT la nube rechaza
        // el primer guardado (RLS) y aparece "La nube rechazó el guardado".
        await sbSignIn(em, password).catch(() => {});
        clearRemoteForbidden(user.id);
        const fresh = defaultData();
        fresh.services = [
          { id: "srv-1", name: "Atención General", duration: 30, price: 0 },
        ];
        saveData(user.id, fresh);
        setFreshSignup();

        emit();
        return null;
      }
      if (res.status === 409 || r.error?.includes("Ya existe")) {
        return "Ya existe una cuenta con ese email. ¿Querés iniciar sesión?";
      }
      if (r.error && !r.error.includes("Falta configuración")) {
        return r.error;
      }
    } catch {
      // Fallback a cliente
    }

    // 2) Fallback directo en cliente con Supabase Auth
    const s = await sbSignUp(em, password);
    if (!s.ok) {
      if (s.reason === "exists") return "Ya existe una cuenta con ese email. ¿Querés iniciar sesión?";
      if (s.reason === "confirm") {
        if (s.authId) savePendingBiz({ authId: s.authId, name: name.trim(), business: business.trim(), email: em });
        setFreshSignup();
        return "Te enviamos un email de confirmación. Abrilo para activar tu cuenta y después entrá.";
      }
      return s.error;
    }
    const slug = await ensureUniqueSlug(slugify(business));
    const user: User = {
      id: s.authId,
      auth_id: s.authId,
      name: name.trim(),
      business: business.trim(),
      email: em,
      password: "",
      slug,
      plan: "semilla",
      createdAt: Date.now(),
      deleted: false,
    };
    unmarkUserDeleted(user.id);
    const withoutDup = users.filter((u) => u.email !== em && u.id !== user.id);
    users = [...withoutDup, user];
    safeSet(USERS_KEY, JSON.stringify(users));
    saveSession(user.id);
    const fresh = defaultData();
    saveData(user.id, fresh);
    setFreshSignup();
    await syncUserToRemote(user, fresh).catch(() => {});
    emit();
    return null;
  },
  async completeBizSetup(input) {
    return completeBizSetupCore(input.name, input.business);
  },
  loginDemo() {
    const existing = users.find((u) => u.email === "demo@cupito.app");
    // Migración: la demo vieja usaba slug studio-nails y tapaba el ejemplo
    // real en cada celular. La demo ahora vive en cupito-demo.
    if (existing && (existing as User).slug === "studio-nails") {
      (existing as User).slug = DEMO_SLUG;
    }
    const demo: User = existing ?? {
      id: uid(),
      name: "Caro Méndez",
      business: "Studio Nails (demo local)",
      email: "demo@cupito.app",
      password: "demo123",
      slug: DEMO_SLUG,
      plan: "crece",
      createdAt: Date.now(),
    };
    saveUsers(existing ? users.map((u) => (u.id === demo.id ? demo : u)) : [...users, demo]);
    saveSession(demo.id);
    seedDemoExtras(demo.id);
    emit();
  },
  logout() {
    saveSession(null);
    if (isSupabaseConfigured) sbSignOut().catch(() => {});
    emit();
  },
  deleteAccount() {
    if (!sessionUserId) return;
    const id = sessionUserId;
    markUserDeleted(id);
    const targetUser = users.find((u) => u.id === id);
    if (targetUser?.email === "demo@cupito.app") {
      safeSet(DEMO_DELETED_KEY, "1");
    }
    const filtered = users.filter((u) => u.id !== id);
    users = filtered;
    safeSet(USERS_KEY, JSON.stringify(filtered));
    saveSession(null);
    safeRemove(dataKey(id));
    if (isSupabaseConfigured) {
      // Borrado lógico (RLS ya no permite DELETE físico) + borrado del login en Auth
      deleteUserFromRemote(id).catch(() => {});
      sbGetAccessToken().then((t) => {
        if (!t) return sbSignOut().catch(() => {});
        return fetch("/api/account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", accessToken: t }),
        }).catch(() => {}).finally(() => sbSignOut().catch(() => {}));
      }).catch(() => {});
    }
    emit();
  },
  saveProfile(business, name) {
    if (!sessionUserId) return;
    // El slug es el link público impreso en QRs: no cambia solo por renombrar el negocio.
    // Si el dueño quiere cambiar su link, lo hace desde Ajustes con verificación de unicidad.
    saveUsers(users.map((u) =>
      u.id === sessionUserId
        ? { ...u, business: business.trim() || u.business, name: name.trim() || u.name }
        : u
    ));
    emit();
  },
  getData(userId) { return loadData(userId); },

  /* ------- admin central ------- */
  adminHasPasscode() { return !!safeGet(ADMIN_HASH_KEY); },
  async adminSetPasscode(code) {
    safeSet(ADMIN_HASH_KEY, await hashPasscode(code));
    ssSet(ADMIN_SESSION_KEY, "1");
    emit();
  },
  async adminLogin(code) {
    const stored = safeGet(ADMIN_HASH_KEY);
    if (!stored) return false;
    const ok = (await hashPasscode(code)) === stored;
    if (ok) ssSet(ADMIN_SESSION_KEY, "1");
    emit();
    return ok;
  },
  adminLogout() {
    ssRemove(ADMIN_SESSION_KEY);
    ssRemove(IMPERSONATION_KEY);
    saveSession(null);
    if (isSupabaseConfigured) sbSignOut().catch(() => {});
    emit();
  },
  loginAs(userId) {
    if (!users.some((u) => u.id === userId)) return;
    saveSession(userId);
    ssSet(IMPERSONATION_KEY, userId);
    loadData(userId);
    emit();
  },
  stopImpersonating() {
    ssRemove(IMPERSONATION_KEY);
    saveSession(null);
    emit();
  },
  adminSetPlan(userId, plan) {
    saveUsers(users.map((u) => (u.id === userId ? { ...u, plan } : u)));
    emit();
    pushAdmin({ action: "set-plan", userId, plan });
  },
  adminUpdateUser(userId, updates) {
    saveUsers(
      users.map((u) => {
        if (u.id !== userId) return u;
        // La demo es local y vive atada a demo@cupito.app: cambiarle el email
        // rompe el login (busca en la nube donde la demo nunca existe).
        const safeUpdates = { ...updates };
        if (isDemoUser(u) && typeof safeUpdates.email === "string" && safeUpdates.email.toLowerCase().trim() !== DEMO_EMAIL) {
          delete (safeUpdates as Partial<User>).email;
        }
        const updated = { ...u, ...safeUpdates };
        if (safeUpdates.business && !safeUpdates.slug) {
          updated.slug = slugify(safeUpdates.business);
        }
        return updated;
      })
    );
    emit();
    pushAdmin({ action: "update-user", userId, updates });
  },
  async adminAddUser(data) {
    const em = data.email.trim().toLowerCase();
    if (users.some((u) => u.email === em)) {
      return { ok: false, error: "Ya existe un negocio registrado con ese email." } as const;
    }
    // 1. Con clave de Central: provisionar mediante /api/admin
    if (isSupabaseConfigured && getAdminKey()) {
      try {
        const res = await fetch("/api/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "provision",
            adminKey: getAdminKey(),
            name: data.name.trim(),
            business: data.business.trim(),
            email: em,
            password: data.password || "cupito123",
            plan: data.plan,
            billing: data.billing ?? "mensual",
            durationDays: data.durationDays,
          }),
        });
        const r = await res.json().catch(() => ({}));
        if (res.ok && r.ok && r.user) {
          const remoteUser = {
            ...r.user,
            subscription: r.user.subscription || undefined,
            deleted: false,
          } as User;
          unmarkUserDeleted(remoteUser.id);
          saveUsers([...users.filter((u) => u.email !== em && u.id !== remoteUser.id), remoteUser]);
          loadData(remoteUser.id);
          emit();
          return { ok: true, user: remoteUser } as const;
        }
        if (res.status === 403) {
          return { ok: false, error: "Clave de Central incorrecta o sin configurar (ver modal de nube)." } as const;
        }
      } catch {}
    }

    // 2. Si no hay adminKey en el navegador, provisionar mediante /api/account (Service Role)
    if (isSupabaseConfigured) {
      try {
        const res = await fetch("/api/account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "register",
            name: data.name.trim(),
            business: data.business.trim(),
            email: em,
            password: data.password || "cupito123",
            plan: data.plan,
            billing: data.billing ?? "mensual",
            durationDays: data.durationDays,
          }),
        });
        const r = await res.json().catch(() => ({}));
        if (res.ok && r.ok && r.user) {
          const remoteUser = {
            ...r.user,
            subscription: r.user.subscription || undefined,
            deleted: false,
          } as User;
          unmarkUserDeleted(remoteUser.id);
          saveUsers([...users.filter((u) => u.email !== em && u.id !== remoteUser.id), remoteUser]);
          loadData(remoteUser.id);
          emit();
          return { ok: true, user: remoteUser } as const;
        }
      } catch {}
    }

    const local = api.adminAddUserLocal(data);
    unmarkUserDeleted(local.id);
    return { ok: true, user: local } as const;
  },
  adminAddUserLocal(data) {
    const em = data.email.trim().toLowerCase();
    const business = data.business.trim();
    let baseSlug = slugify(business) || "negocio";
    let slug = baseSlug;
    let counter = 1;
    while (users.some((u) => u.slug === slug)) {
      slug = `${baseSlug}-${counter++}`;
    }
    const now = Date.now();
    const billing = data.billing ?? "mensual";
    const days = data.durationDays ?? (billing === "anual" ? 365 : 30);
    const nextRenewal = now + days * 24 * 3600 * 1000;
    const newUser: User = {
      id: uid(),
      name: data.name.trim(),
      business,
      email: em,
      password: data.password || "cupito123",
      slug,
      plan: data.plan,
      createdAt: now,
      subscription: data.plan !== "semilla" ? {
        billing,
        activeSince: now,
        nextRenewal,
        autoRenew: true,
        status: "activa",
      } : undefined,
      deleted: false,
    };
    unmarkUserDeleted(newUser.id);
    saveUsers([...users.filter((u) => u.email !== em && u.id !== newUser.id), newUser]);
    const fresh = defaultData();
    saveData(newUser.id, fresh);
    if (isSupabaseConfigured) {
      syncUserToRemote(newUser, fresh).catch(() => {});
    }
    emit();
    return newUser;
  },
  adminDeleteUser(userId) {
    markUserDeleted(userId);
    const targetUser = users.find((u) => u.id === userId);
    if (targetUser?.email === "demo@cupito.app") {
      safeSet(DEMO_DELETED_KEY, "1");
    }
    const filtered = users.filter((u) => u.id !== userId);
    users = filtered;
    safeSet(USERS_KEY, JSON.stringify(filtered));
    if (sessionUserId === userId) { saveSession(null); ssRemove(IMPERSONATION_KEY); }
    safeRemove(dataKey(userId));
    if (isSupabaseConfigured) {
      deleteUserFromRemote(userId).catch(() => {});
      pushAdmin({ action: "delete-user", userId });
    }
    emit();
  },

  /* ------- negocio ------- */
  addService(s) {
    if (!sessionUserId) return;
    const data = loadData(sessionUserId);
    data.services = [...data.services, { ...s, id: uid() }];
    saveData(sessionUserId, data);
    emit();
  },
  updateService(id, patch) {
    if (!sessionUserId) return;
    const data = loadData(sessionUserId);
    data.services = data.services.map((s) => (s.id === id ? { ...s, ...patch } : s));
    saveData(sessionUserId, data);
    emit();
  },
  removeService(id) {
    if (!sessionUserId) return;
    const data = loadData(sessionUserId);
    data.services = data.services.filter((s) => s.id !== id);
    data.bookings = data.bookings.filter((b) => b.serviceId !== id);
    saveData(sessionUserId, data);
    emit();
  },
  addProduct(p) {
    if (!sessionUserId) return;
    const data = loadData(sessionUserId);
    data.products = [...data.products, { ...p, id: uid() }];
    saveData(sessionUserId, data);
    emit();
  },
  updateProduct(id, patch) {
    if (!sessionUserId) return;
    const data = loadData(sessionUserId);
    data.products = data.products.map((p) => (p.id === id ? { ...p, ...patch } : p));
    saveData(sessionUserId, data);
    emit();
  },
  removeProduct(id) {
    if (!sessionUserId) return;
    const data = loadData(sessionUserId);
    data.products = data.products.filter((p) => p.id !== id);
    saveData(sessionUserId, data);
    emit();
  },
  updateSettings(patch) {
    if (!sessionUserId) return;
    const data = loadData(sessionUserId);
    data.settings = { ...data.settings, ...patch };
    saveData(sessionUserId, data);
    emit();
  },
  setPlan(plan) {
    if (!sessionUserId) return;
    saveUsers(users.map((u) => {
      if (u.id !== sessionUserId) return u;
      return {
        ...u,
        plan,
        subscription: plan === "semilla" ? undefined : {
          billing: "mensual",
          activeSince: Date.now(),
          nextRenewal: Date.now() + 30 * 24 * 3600 * 1000,
          autoRenew: true,
          status: "activa",
        },
      };
    }));
    emit();
  },
  saveMpPreapprovalId(id: string) {
    if (!sessionUserId) return;
    saveUsers(users.map((u) => {
      if (u.id !== sessionUserId) return u;
      const sub = u.subscription || {
        billing: "mensual" as const,
        activeSince: u.createdAt,
        nextRenewal: Date.now() + 30 * 24 * 3600 * 1000,
        autoRenew: true,
        status: "activa" as const,
      };
      return { ...u, subscription: { ...sub, mpPreapprovalId: id } };
    }));
    emit();
  },
  cancelSubscription() {
    if (!sessionUserId) return;
    saveUsers(users.map((u) => {
      if (u.id !== sessionUserId) return u;
      const sub = u.subscription || {
        billing: "mensual",
        activeSince: u.createdAt,
        nextRenewal: Date.now() + 30 * 24 * 3600 * 1000,
        autoRenew: true,
        status: "activa",
      };
      return {
        ...u,
        subscription: { ...sub, autoRenew: false, status: "cancelada" },
      };
    }));
    emit();
  },
  async cancelSubscriptionAsync() {
    if (!sessionUserId) return { ok: false, error: "Necesitás una cuenta." } as const;
    const me = users.find((u) => u.id === sessionUserId);
    if (!me) return { ok: false, error: "Necesitás una cuenta." } as const;
    try {
      const res = await fetch("/api/cancel-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: me.subscription?.mpPreapprovalId, email: me.email }),
      });
      const r = await res.json().catch(() => ({}));
      if (!res.ok || r.error || !r.ok) {
        return { ok: false, error: String(r.error || "Mercado Pago no confirmó la cancelación.") } as const;
      }
    } catch {
      return { ok: false, error: "No pudimos conectar con Mercado Pago. Probá de nuevo." } as const;
    }
    // Cancelada de verdad en MP: recién ahí la marcamos local.
    api.cancelSubscription();
    return { ok: true } as const;
  },
  resumeSubscription() {
    if (!sessionUserId) return;
    saveUsers(users.map((u) => {
      if (u.id !== sessionUserId) return u;
      const sub = u.subscription || {
        billing: "mensual",
        activeSince: u.createdAt,
        nextRenewal: Date.now() + 30 * 24 * 3600 * 1000,
        autoRenew: false,
        status: "cancelada",
      };
      return {
        ...u,
        subscription: { ...sub, autoRenew: true, status: "activa" },
      };
    }));
    emit();
  },
  addReview(r) {
    if (!sessionUserId) return;
    const data = loadData(sessionUserId);
    data.reviews = [{ ...r, id: uid() }, ...data.reviews];
    saveData(sessionUserId, data);
    emit();
  },
  removeReview(id) {
    if (!sessionUserId) return;
    const data = loadData(sessionUserId);
    data.reviews = data.reviews.filter((r) => r.id !== id);
    saveData(sessionUserId, data);
    emit();
  },
  async addReviewFor(ownerId, r) {
    const reviewOwner = users.find((u) => u.id === ownerId);
    if (!isDemoUser(reviewOwner) && isSupabaseConfigured) {
      const res = await callPublicApi({ action: "review", ownerId, review: r });
      if (res) {
        if (res.ok && res.data) {
          safeSet(dataKey(ownerId), JSON.stringify(normalizeData(res.data)));
          emit();
        }
        return;
      }
    }
    const data = loadData(ownerId);
    data.reviews = [{ ...r, id: uid() }, ...data.reviews];
    saveData(ownerId, data);
    emit();
  },
  addCoupon({ code, pct }) {
    if (!sessionUserId) return "Necesitás una cuenta.";
    const owner = users.find((u) => u.id === sessionUserId);
    if (owner && !isPaid(owner)) return "Los cupones son del plan Crece. Subí de plan para crearlos.";
    const clean = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{3,14}$/.test(clean)) return "El código debe tener 3-14 letras o números (sin espacios).";
    const data = loadData(sessionUserId);
    if (data.coupons.some((c) => c.code === clean)) return "Ya existe un cupón con ese código.";
    data.coupons = [{ id: uid(), code: clean, pct, active: true }, ...data.coupons];
    saveData(sessionUserId, data);
    emit();
    return null;
  },
  updateCoupon(id, patch) {
    if (!sessionUserId) return;
    const data = loadData(sessionUserId);
    data.coupons = data.coupons.map((c) => (c.id === id ? { ...c, ...patch } : c));
    saveData(sessionUserId, data);
    emit();
  },
  removeCoupon(id) {
    if (!sessionUserId) return;
    const data = loadData(sessionUserId);
    data.coupons = data.coupons.filter((c) => c.id !== id);
    saveData(sessionUserId, data);
    emit();
  },
  addProfessional(name, role, hours) {
    if (!sessionUserId) return "Necesitás una cuenta.";
    const data = loadData(sessionUserId);
    const owner = users.find((u) => u.id === sessionUserId);
    const limit = PRO_LIMIT[owner?.plan ?? "semilla"];
    if (data.professionals.length >= limit)
      return `Tu plan ${PLAN_META[owner?.plan ?? "semilla"].name} permite hasta ${limit} profesional${limit === 1 ? "" : "es"}.`;
    if (name.trim().length < 2) return "Poné un nombre.";
    data.professionals = [
      ...data.professionals,
      {
        id: uid(),
        name: name.trim(),
        role: role.trim() || "Profesional",
        color: PRO_COLORS[data.professionals.length % PRO_COLORS.length],
        hours: Array.isArray(hours) && hours.length === 7 ? hours : undefined,
      },
    ];
    saveData(sessionUserId, data);
    emit();
    return null;
  },
  updateProfessional(id, patch) {
    if (!sessionUserId) return;
    const data = loadData(sessionUserId);
    data.professionals = data.professionals.map((p) => (p.id === id ? { ...p, ...patch } : p));
    saveData(sessionUserId, data);
    emit();
  },
  removeProfessional(id) {
    if (!sessionUserId) return;
    const data = loadData(sessionUserId);
    data.professionals = data.professionals.filter((p) => p.id !== id);
    data.bookings = data.bookings.map((b) => (b.proId === id ? { ...b, proId: undefined } : b));
    saveData(sessionUserId, data);
    emit();
  },
  async addWaitlist({ date, serviceId, client, phone }, ownerId) {
    const targetId = ownerId || sessionUserId;
    if (!targetId) return "No se encontró el negocio.";
    const targetOwner = users.find((u) => u.id === targetId);
    const targetIsDemo = isDemoUser(targetOwner);
    // Con nube: el servidor valida y guarda (los invitados no pueden escribir directo con RLS+Auth).
    // La demo es 100% local: nunca va a la nube (su id no existe en Supabase).
    if (!targetIsDemo && isSupabaseConfigured) {
      const r = await callPublicApi({ action: "waitlist", ownerId: targetId, entry: { date, serviceId, client, phone } });
      if (r) {
        if (r.ok && r.data) {
          safeSet(dataKey(targetId), JSON.stringify(normalizeData(r.data)));
          emit();
        }
        return r.ok ? null : r.error;
      }
      // sin red: vía local
    }
    const data = loadData(targetId);
    if (client.trim().length < 2) return "Poné tu nombre completo.";
    if (phone.replace(/\D/g, "").length < 8) return "Necesitamos un teléfono válido para avisarte.";
    const cleanPhone = phone.replace(/\D/g, "");
    if (data.waitlist.some((w) => w.date === date && w.phone.replace(/\D/g, "") === cleanPhone))
      return "Ya estás en la lista de espera para ese día 😉";
    const entry: WaitlistEntry = { id: uid(), date, serviceId, client: client.trim(), phone: phone.trim(), createdAt: Date.now() };
    data.waitlist = [...data.waitlist, entry];
    saveData(targetId, data);
    if (!targetIsDemo) saveRemoteWaitlist(targetId, entry).catch(() => {});
    emit();
    return null;
  },
  removeWaitlist(id) {
    if (!sessionUserId) return;
    addTombstone(TOMBSTONE_WAITLIST_KEY, id);
    const data = loadData(sessionUserId);
    data.waitlist = data.waitlist.filter((w) => w.id !== id);
    saveData(sessionUserId, data);
    // Propagar el borrado a la nube para que no resucite en el próximo pull
    if (isSupabaseConfigured && sessionUserId) {
      deleteRemoteWaitlist(sessionUserId, id).catch(() => {});
    }
    emit();
  },
  createBookingFromWaitlist(waitlistId, { client, phone, serviceId, date, time, source, items, proId }) {
    if (!sessionUserId) return { ok: false, error: "Necesitás una cuenta para crear reservas." } as const;
    addTombstone(TOMBSTONE_WAITLIST_KEY, waitlistId);
    const data = loadData(sessionUserId);
    const owner = users.find((u) => u.id === sessionUserId);
    if (semillaLimitReached(owner, data))
      return { ok: false, error: `Llegaste a las ${SEMILLA_MONTHLY_LIMIT} reservas del mes del plan Semilla. Subí a Crece para reservas ilimitadas.` } as const;
    const isClosedDate = (data.settings.closedDates || []).includes(date);
    if (isClosedDate) return { ok: false, error: "El negocio está cerrado en esa fecha (feriado o no laborable)." } as const;
    if (isSlotBlocked(data.blockedSlots || [], date, time, proId)) return { ok: false, error: "Este horario se encuentra bloqueado por el negocio." } as const;
    const clash = findOverlap({ date, time, dur: serviceDurationOf(data.services, serviceId), proId }, data.bookings, data.services);
    if (clash) return { ok: false, error: clash.time === time ? `El horario ${time} ya fue tomado por ${clash.client}.` : `Se superpone con el turno de ${clash.client} (${clash.time}).` } as const;
    const id = uid();
    const newBooking: Booking = { id, client: client.trim(), phone: phone.trim(), serviceId, date, time, status: "confirmada", source, items, proId, createdAt: Date.now() };
    // UN solo guardado atómico: crea el turno Y borra de la lista juntos.
    // Antes eran dos guardados separados y el sync a la nube los pisaba → turnos infinitos.
    data.bookings = [...data.bookings, newBooking];
    data.waitlist = data.waitlist.filter((w) => w.id !== waitlistId);
    saveData(sessionUserId, data);
    if (isSupabaseConfigured && sessionUserId) {
      saveRemoteBooking(sessionUserId, newBooking).catch(() => {});
      deleteRemoteWaitlist(sessionUserId, waitlistId).catch(() => {});
    }
    emit();
    return { ok: true, id } as const;
  },
  requestReview(bookingId) {
    if (!sessionUserId) return "noemail" as const;
    const data = loadData(sessionUserId);
    const target = data.bookings.find((b) => b.id === bookingId);
    data.bookings = data.bookings.map((b) => (b.id === bookingId ? { ...b, reviewRequested: true } : b));
    saveData(sessionUserId, data);
    emit();
    // Pedido real: si hay email, se manda de verdad. Si no, el dueño avisa por WhatsApp.
    const owner = users.find((u) => u.id === sessionUserId);
    const toEmail = (target?.email || "").trim();
    if (owner && toEmail.includes("@") && target) {
      const svc = data.services.find((s) => s.id === target.serviceId);
      sendReviewRequestEmail({
        toEmail,
        clientName: target.client,
        businessName: owner.business,
        serviceName: svc?.name || "atención",
        slug: owner.slug,
      }).catch(() => {});
      return "sent" as const;
    }
    return "noemail" as const;
  },
  addBooking({ client, phone, serviceId, date, time, source, items, proId }) {
    if (!sessionUserId) return { ok: false, error: "Necesitás una cuenta para crear reservas." };
    const data = loadData(sessionUserId);
    const owner = users.find((u) => u.id === sessionUserId);
    if (semillaLimitReached(owner, data))
      return { ok: false, error: `Llegaste a las ${SEMILLA_MONTHLY_LIMIT} reservas del mes del plan Semilla. Subí a Crece para reservas ilimitadas.` };
    const isClosedDate = (data.settings.closedDates || []).includes(date);
    if (isClosedDate) return { ok: false, error: "El negocio está cerrado en esa fecha (feriado o no laborable)." };
    const dur = serviceDurationOf(data.services, serviceId);

    let pro = proId;
    if (!pro && data.professionals.length > 0) {
      const available = getAvailablePros(
        data.professionals,
        date,
        time,
        dur,
        data.settings.hours,
        data.blockedSlots || [],
        data.bookings,
        data.services
      );
      if (available.length === 0) {
        return { ok: false, error: "No hay ningún profesional disponible en ese horario." };
      }
      available.sort((a, b) => {
        const ca = data.bookings.filter((x) => x.date === date && x.proId === a.id && x.status !== "cancelada").length;
        const cb = data.bookings.filter((x) => x.date === date && x.proId === b.id && x.status !== "cancelada").length;
        return ca - cb;
      });
      pro = available[0].id;
    } else if (pro && data.professionals.length > 0) {
      const targetPro = data.professionals.find((p) => p.id === pro);
      if (targetPro && !isProAvailable(targetPro, date, time, dur, data.settings.hours, data.blockedSlots || [], data.bookings, data.services)) {
        return { ok: false, error: `${targetPro.name} ya no está disponible en ese horario.` };
      }
    } else {
      if (isSlotBlocked(data.blockedSlots || [], date, time)) return { ok: false, error: "Este horario se encuentra bloqueado por el negocio." };
      const clash = findOverlap({ date, time, dur }, data.bookings, data.services);
      if (clash) return { ok: false, error: clash.time === time ? `El horario ${time} ya fue tomado por ${clash.client}.` : `Se superpone con el turno de ${clash.client} (${clash.time}).` };
    }

    const id = uid();
    const newBooking: Booking = { id, client: client.trim(), phone: phone.trim(), serviceId, date, time, status: "confirmada", source, items, proId: pro, createdAt: Date.now() };
    data.bookings = [...data.bookings, newBooking];
    saveData(sessionUserId, data);
    saveRemoteBooking(sessionUserId, newBooking).catch(() => {});
    emit();
    return { ok: true, id };
  },
  async addBookingFor(ownerId, { client, phone, email, serviceId, date, time, source, items, proId, paidDeposit, paymentMethod, status, depositClaim }) {
    const bookingOwner = users.find((u) => u.id === ownerId);
    const bookingIsDemo = isDemoUser(bookingOwner);
    // Con nube: el servidor valida y guarda (los invitados no pueden escribir directo con RLS+Auth).
    // La demo es 100% local: su id no existe en Supabase y el servidor diría "ya no está disponible".
    if (!bookingIsDemo && isSupabaseConfigured) {
      const r = await callPublicApi({
        action: "book", ownerId,
        booking: { client, phone, email, serviceId, date, time, items, proId, paidDeposit, paymentMethod, status, depositClaim },
      });
      if (r) {
        if (r.ok && r.data) {
          safeSet(dataKey(ownerId), JSON.stringify(normalizeData(r.data)));
          emit();
        }
        return r.ok ? { ok: true, id: r.id! } : { ok: false, error: r.error };
      }
      // sin red: vía local
    }
    const data = loadData(ownerId);
    const owner = users.find((u) => u.id === ownerId);
    if (semillaLimitReached(owner, data))
      return { ok: false, error: "Este negocio alcanzó el límite de reservas online de este mes. Anotate en la lista de espera y te avisamos si se libera un lugar." };
    const isClosedDate = (data.settings.closedDates || []).includes(date);
    if (isClosedDate) return { ok: false, error: "El negocio está cerrado en esa fecha (feriado o no laborable)." };
    const dur = serviceDurationOf(data.services, serviceId);

    let pro = proId;
    if (!pro && data.professionals.length > 0) {
      const available = getAvailablePros(
        data.professionals,
        date,
        time,
        dur,
        data.settings.hours,
        data.blockedSlots || [],
        data.bookings,
        data.services
      );
      if (available.length === 0) {
        return { ok: false, error: "No hay ningún profesional disponible en ese horario." };
      }
      available.sort((a, b) => {
        const ca = data.bookings.filter((x) => x.date === date && x.proId === a.id && x.status !== "cancelada").length;
        const cb = data.bookings.filter((x) => x.date === date && x.proId === b.id && x.status !== "cancelada").length;
        return ca - cb;
      });
      pro = available[0].id;
    } else if (pro && data.professionals.length > 0) {
      const targetPro = data.professionals.find((p) => p.id === pro);
      if (targetPro && !isProAvailable(targetPro, date, time, dur, data.settings.hours, data.blockedSlots || [], data.bookings, data.services)) {
        return { ok: false, error: `${targetPro.name} ya no está disponible en ese horario.` };
      }
    } else {
      if (isSlotBlocked(data.blockedSlots || [], date, time)) return { ok: false, error: "Este horario se encuentra bloqueado por el negocio." };
      const clash = findOverlap({ date, time, dur }, data.bookings, data.services);
      if (clash) return { ok: false, error: clash.time === time ? `El horario ${time} ya fue tomado por ${clash.client}.` : `Se superpone con el turno de ${clash.client} (${clash.time}).` };
    }
    const id = uid();
    const cleanEmail = (email || "").trim();
    const newBooking: Booking = { id, client: client.trim(), phone: phone.trim(), email: cleanEmail || undefined, serviceId, date, time, status: status ?? "confirmada", source, items, proId: pro, paidDeposit, paymentMethod, depositClaim, createdAt: Date.now() };
    data.bookings = [...data.bookings, newBooking];
    saveData(ownerId, data);
    if (!bookingIsDemo) saveRemoteBooking(ownerId, newBooking).catch(() => {});
    emit();
    return { ok: true, id };
  },
  rescheduleBooking(id, newDate, newTime, newProId) {
    if (!sessionUserId) return { ok: false, error: "Necesitás una cuenta." };
    const data = loadData(sessionUserId);
    const target = data.bookings.find((b) => b.id === id);
    if (!target) return { ok: false, error: "No se encontró el turno." };
    const newPro = newProId !== undefined ? newProId : target.proId;
    const clash = findOverlap(
      { date: newDate, time: newTime, dur: serviceDurationOf(data.services, target.serviceId), proId: newPro },
      data.bookings.filter((b) => b.id !== id),
      data.services
    );
    if (clash) return { ok: false, error: clash.time === newTime ? `El horario ${newTime} del ${newDate} ya está ocupado por ${clash.client}.` : `Se superpone con el turno de ${clash.client} (${clash.time}).` };

    data.bookings = data.bookings.map((b) => {
      if (b.id !== id) return b;
      return {
        ...b,
        date: newDate,
        time: newTime,
        proId: newProId !== undefined ? newProId : b.proId,
        status: b.status === "cancelada" ? "confirmada" : b.status,
        reminderSentAt: undefined, // cambió el día: el recordatorio viejo ya no sirve
      };
    });
    saveData(sessionUserId, data);
    emit();
    return { ok: true };
  },
  setStatus(id, status) {
    if (!sessionUserId) return;
    const data = loadData(sessionUserId);
    data.bookings = data.bookings.map((b) => (b.id === id ? { ...b, status } : b));
    saveData(sessionUserId, data);
    emit();
  },
  removeBooking(id) {
    if (!sessionUserId) return;
    addTombstone(TOMBSTONE_BOOKING_KEY, id);
    const data = loadData(sessionUserId);
    data.bookings = data.bookings.filter((b) => b.id !== id);
    saveData(sessionUserId, data);
    if (isSupabaseConfigured && sessionUserId) {
      deleteRemoteBooking(sessionUserId, id).catch(() => {});
    }
    emit();
  },
  markDepositPaid(id, method) {
    if (!sessionUserId) return;
    const data = loadData(sessionUserId);
    data.bookings = data.bookings.map((b) => (b.id === id ? { ...b, paidDeposit: true, paymentMethod: method, depositClaim: undefined } : b));
    saveData(sessionUserId, data);
    emit();
  },
  rejectDeposit(id) {
    if (!sessionUserId) return;
    const data = loadData(sessionUserId);
    data.bookings = data.bookings.map((b) => (b.id === id ? { ...b, depositClaim: undefined } : b));
    saveData(sessionUserId, data);
    emit();
  },
  /* Libera turnos con comprobante de seña sin verificar por más de 24 h.
     Devuelve cuántos liberó. Se corre al abrir el panel. */
  releaseExpiredClaims() {
    if (!sessionUserId) return 0;
    const data = loadData(sessionUserId);
    const now = Date.now();
    let released = 0;
    data.bookings = data.bookings.map((b) => {
      if (
        b.status !== "cancelada" &&
        b.depositClaim &&
        !b.paidDeposit &&
        now - b.depositClaim.sentAt > 24 * 3600 * 1000
      ) {
        released++;
        return { ...b, status: "cancelada" as BookingStatus, depositClaim: undefined, cancelReason: "Seña no verificada en 24 h (liberado automático)" };
      }
      return b;
    });
    if (released > 0) {
      saveData(sessionUserId, data);
      emit();
    }
    return released;
  },
  setBookingPro(id, proId) {
    if (!sessionUserId) return;
    const data = loadData(sessionUserId);
    data.bookings = data.bookings.map((b) => (b.id === id ? { ...b, proId } : b));
    saveData(sessionUserId, data);
    emit();
  },
  addBlockedSlot(slot) {
    if (!sessionUserId) return;
    const data = loadData(sessionUserId);
    const newSlot: BlockedSlot = { ...slot, id: uid() };
    data.blockedSlots = [...(data.blockedSlots || []), newSlot];
    saveData(sessionUserId, data);
    emit();
  },
  removeBlockedSlot(id) {
    if (!sessionUserId) return;
    const data = loadData(sessionUserId);
    data.blockedSlots = (data.blockedSlots || []).filter((b) => b.id !== id);
    saveData(sessionUserId, data);
    emit();
  },
  saveClientNote(phone, note) {
    if (!sessionUserId) return;
    const data = loadData(sessionUserId);
    const cleanPhone = phone.replace(/\D/g, "");
    data.settings.clientNotes = {
      ...(data.settings.clientNotes || {}),
      [cleanPhone]: note.trim(),
    };
    saveData(sessionUserId, data);
    emit();
  },
  async cancelBookingByClient(ownerId, bookingId, reason, phone) {
    const cancelOwner = users.find((u) => u.id === ownerId);
    if (!isDemoUser(cancelOwner) && isSupabaseConfigured) {
      const r = await callPublicApi({ action: "cancel", ownerId, bookingId, reason, phone });
      if (r) {
        if (r.ok) {
          if (r.data) safeSet(dataKey(ownerId), JSON.stringify(normalizeData(r.data)));
          else {
            // Sin data en respuesta: marcar local para feedback inmediato
            const data = loadData(ownerId);
            data.bookings = data.bookings.map((b) =>
              b.id === bookingId ? { ...b, status: "cancelada" as BookingStatus, cancelReason: reason || "Cancelado por el cliente" } : b
            );
            safeSet(dataKey(ownerId), JSON.stringify(data));
          }
          emit();
          return { ok: true };
        }
        return { ok: false, error: r.error };
      }
      // sin red: vía local
    }
    const data = loadData(ownerId);
    const target = data.bookings.find((b) => b.id === bookingId);
    if (!target) return { ok: false, error: "No se encontró el turno." };
    // Política 24 h: dentro de las 24 h previas el cliente no puede cancelar solo
    // (la seña no se devuelve y el hueco ya no se repone). Tiene que hablar con el local.
    try {
      const [y, m, d] = target.date.split("-").map(Number);
      const [hh, mm] = target.time.split(":").map(Number);
      const appt = new Date(y, m - 1, d, hh, mm).getTime();
      if (appt - Date.now() < 24 * 3600 * 1000) {
        return { ok: false, error: "FALTA_MENOS_24H" };
      }
    } catch { /* si no se puede calcular, se permite cancelar */ }
    data.bookings = data.bookings.map((b) =>
      b.id === bookingId
        ? { ...b, status: "cancelada" as BookingStatus, cancelReason: reason || "Cancelado por el cliente" }
        : b
    );
    saveData(ownerId, data);
    emit();
    return { ok: true };
  },
  addClosedDate(dateStr) {
    if (!sessionUserId) return;
    const data = loadData(sessionUserId);
    const current = data.settings.closedDates || [];
    if (!current.includes(dateStr)) {
      data.settings.closedDates = [...current, dateStr];
      saveData(sessionUserId, data);
      emit();
    }
  },
  removeClosedDate(dateStr) {
    if (!sessionUserId) return;
    const data = loadData(sessionUserId);
    data.settings.closedDates = (data.settings.closedDates || []).filter((d) => d !== dateStr);
    saveData(sessionUserId, data);
    emit();
  },
};

/* ================= contexto ================= */

export interface ToastMsg { id: number; text: string; kind: "ok" | "warn" }

interface StoreCtx extends StoreApi {
  user: User | null;
  data: BizData | null;
  isAdmin: boolean;
  impersonating: boolean;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const subscribe = useCallback((cb: () => void) => {
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  }, []);
  const version = useSyncExternalStore(subscribe, () => storeVersion);

  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const toast = useCallback((text: string, kind: "ok" | "warn" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3400);
  }, []);

  const memo = useMemo(() => {
    void version;
    const user = users.find((u) => u.id === sessionUserId) ?? null;
    return {
      ...api,
      users,
      sessionUserId,
      toast,
      user,
      data: user ? loadData(user.id) : null,
      isAdmin: ssGet(ADMIN_SESSION_KEY) === "1",
      impersonating: ssGet(IMPERSONATION_KEY) !== null,
    } as StoreCtx;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, toast]);

  useEffect(() => {
    safeSet(USERS_KEY, JSON.stringify(users));
    if (sessionUserId) safeSet(SESSION_KEY, sessionUserId);
  }, [memo]);

  // Sincronización continua de datos frescos desde Supabase para el negocio logueado
  useEffect(() => {
    if (!sessionUserId || !isSupabaseConfigured) return;
    const uid = sessionUserId;
    forbiddenNoticedFor.current = null;
    const checkForbidden = () => {
      const f = takeForbiddenUser();
      if (f && f.userId === uid && forbiddenNoticedFor.current !== uid) {
        forbiddenNoticedFor.current = uid;
        toast(
          f.status === 400
            ? "La nube rechazó el guardado: corré el SQL nuevo en Supabase y después tocá algo para reintentar"
            : "La nube rechazó el guardado: cerrá sesión y volvé a entrar para reconectar 🔄",
          "warn"
        );
      }
    };
    api.syncUserDataFromCloud(uid);
    const interval = setInterval(() => {
      api.syncUserDataFromCloud(uid);
      checkForbidden();
    }, 6000);
    const onFocus = () => api.syncUserDataFromCloud(uid);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [sessionUserId]);

  // Si hay sesión local vieja pero no hay JWT, las escrituras no llegan a la nube:
  // avisar una vez que hay que volver a entrar (la sesión Auth expira o se cerró en otro lado).
  const reloginNoticed = useRef(false);
  const forbiddenNoticedFor = useRef<string | null>(null);
  useEffect(() => {
    if (reloginNoticed.current || !memo.user || isDemoUser(memo.user)) return;
    if (!isSupabaseConfigured || sbHasSession()) return;
    reloginNoticed.current = true;
    const t = setTimeout(() => {
      if (!sbHasSession()) toast("Cerrá sesión y volvé a entrar para reconectar la nube 🔄", "warn");
    }, 5000);
    return () => clearTimeout(t);
  }, [memo.user, toast]);

  return (
    <Ctx.Provider value={memo}>
      {children}
      <div className="pointer-events-none fixed bottom-5 left-1/2 z-[90] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-in pointer-events-auto flex items-center gap-2.5 rounded-full border-2 px-4 py-2.5 text-sm font-semibold shadow-block-ink ${t.kind === "ok" ? "border-ink/10 bg-evergreen text-paper" : "border-coral/40 bg-card text-coral"}`}>
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${t.kind === "ok" ? "bg-lime text-ink" : "bg-coral/15"}`}>
              {t.kind === "ok" ? "✓" : "!"}
            </span>
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useStore(): StoreCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore debe usarse dentro de <StoreProvider>");
  return ctx;
}

/* ============ página pública de un negocio ============ */
export function usePublicPage(slug: string): ({ user: User } & Record<"data", BizData>) | null {
  const subscribe = useCallback((cb: () => void) => {
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  }, []);
  const version = useSyncExternalStore(subscribe, () => storeVersion);
  return useMemo(() => {
    void version;
    const target = (slug || "").toLowerCase().trim();
    const matches = users.filter((u) => u.slug.toLowerCase().trim() === target);
    // Si hay colisión (demo vieja + negocio real con mismo slug), gana el real.
    const user = matches.find((u) => !isDemoUser(u)) ?? matches[0] ?? null;
    if (!user) return null;
    const pageData = loadData(user.id);
    return { user, ["data"]: pageData };
  }, [version, slug]);
}

/* ============ demo ============ */
export function ensureDemo(): void {
  if (safeGet(DEMO_DELETED_KEY) === "1") return;
  const deleted = getDeletedUserIds();
  const existing = users.find((u) => u.email === "demo@cupito.app");
  if (existing && deleted.has(existing.id)) return;
  if (!existing) {
    const demo: User = {
      id: uid(),
      name: "Caro Méndez",
      business: "Studio Nails (demo local)",
      email: "demo@cupito.app",
      password: "demo123",
      slug: DEMO_SLUG,
      plan: "crece",
      createdAt: Date.now(),
    };
    saveUsers([...users, demo]);
    loadData(demo.id);
    seedDemoExtras(demo.id);
    return;
  }
  // Migración: demo vieja con slug studio-nails tapaba el ejemplo real.
  if ((existing as User).slug === "studio-nails") {
    (existing as User).slug = DEMO_SLUG;
    safeSet(USERS_KEY, JSON.stringify(users));
  }
  seedDemoExtras(existing.id);
}
try {
  ensureDemo();
} catch (e) {
  console.warn("[Cupito] No se pudo sembrar la demo:", e);
}
