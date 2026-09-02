import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

/* ================= tipos ================= */

export type Plan = "semilla" | "crece" | "escala";
export type PaymentMethod = "tarjeta" | "transferencia" | "billetera";

export interface Service { id: string; name: string; price: number; duration: number }
export interface Product { id: string; name: string; price: number; desc: string }
export interface Review { id: string; client: string; rating: number; text: string; date: string }
export interface Coupon { id: string; code: string; pct: number; active: boolean }
export interface Professional { id: string; name: string; role: string; color: string }
export interface WaitlistEntry { id: string; date: string; serviceId: string; client: string; phone: string; createdAt: number }

export type BookingStatus = "pendiente" | "confirmada" | "atendida" | "cancelada";
export interface Booking {
  id: string;
  serviceId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  client: string;
  phone: string;
  status: BookingStatus;
  source: "online" | "manual";
  items?: { productId: string; qty: number }[];
  proId?: string;
  paidDeposit?: boolean;
  paymentMethod?: PaymentMethod;
  depositClaim?: { txId: string; sentAt: number }; // comprobante pendiente de verificación
  reviewRequested?: boolean;
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
  headerBg: string; // Tailwind background for header/hero
  headerText: string;
  accentText: string;
  accentBg: string;
  badgeBg: string;
  badgeText: string;
  borderAccent: string;
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
    borderAccent: "border-[#cdf463]",
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
    borderAccent: "border-[#38bdf8]",
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
    borderAccent: "border-[#f472b6]",
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
    borderAccent: "border-[#34d399]",
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
}

export interface BizData {
  services: Service[];
  bookings: Booking[];
  products: Product[];
  reviews: Review[];
  coupons: Coupon[];
  professionals: Professional[];
  waitlist: WaitlistEntry[];
  settings: BizSettings;
}

export interface UserSubscription {
  billing: "mensual" | "anual";
  activeSince: number;
  nextRenewal: number;
  autoRenew: boolean;
  status: "activa" | "cancelada";
}

export interface User {
  id: string;
  name: string;
  business: string;
  email: string;
  password: string;
  slug: string;
  plan: Plan;
  createdAt: number;
  subscription?: UserSubscription;
}

export const PLAN_META: Record<Plan, { name: string; price: string }> = {
  semilla: { name: "Semilla", price: "$0" },
  crece: { name: "Crece", price: "$9.900/mes" },
  escala: { name: "Escala", price: "$23.000/mes" },
};
export const isPaid = (u: User) => u.plan !== "semilla";
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
const dataKey = (uid: string) => `cupito_data_${uid}`;

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
export function slugify(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "mi-negocio";
}

/* Horarios según configuración del día (intervalos 45 min), con corte opcional */
export function slotsForDay(h: DayHours | undefined): string[] {
  if (!h || !h.open) return [];
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
    professionals: Array.isArray(p.professionals) ? p.professionals : d.professionals,
    waitlist: Array.isArray(p.waitlist) ? p.waitlist : d.waitlist,
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
    },
  };
}

/* ================= persistencia ================= */

let users: User[] = (() => {
  try {
    const raw = safeGet(USERS_KEY);
    const parsed = raw ? (JSON.parse(raw) as User[]) : [];
    return parsed.map((u) => ({ ...u, plan: u.plan ?? "semilla" }));
  } catch { return []; }
})();
let sessionUserId: string | null = safeGet(SESSION_KEY);
let storeVersion = 0;
const listeners = new Set<() => void>();
function emit() { storeVersion++; listeners.forEach((l) => l()); }

function saveUsers(list: User[]) { users = list; safeSet(USERS_KEY, JSON.stringify(list)); }
function saveSession(id: string | null) {
  sessionUserId = id;
  if (id) safeSet(SESSION_KEY, id); else safeRemove(SESSION_KEY);
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
}

/* ================= store ================= */

interface StoreApi {
  users: User[];
  sessionUserId: string | null;
  toast: (text: string, kind?: "ok" | "warn") => void;
  register(input: { name: string; business: string; email: string; password: string }): string | null;
  login(email: string, password: string): string | null;
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
  cancelSubscription(): void;
  resumeSubscription(): void;
  addReview(r: Omit<Review, "id">): void;
  addCoupon(c: { code: string; pct: number }): string | null;
  updateCoupon(id: string, patch: Partial<Omit<Coupon, "id">>): void;
  removeCoupon(id: string): void;
  addProfessional(name: string, role: string): string | null;
  updateProfessional(id: string, patch: Partial<Omit<Professional, "id">>): void;
  removeProfessional(id: string): void;
  addWaitlist(e: { date: string; serviceId: string; client: string; phone: string }): string | null;
  removeWaitlist(id: string): void;
  requestReview(bookingId: string): void;
  addBooking(b: { client: string; phone: string; serviceId: string; date: string; time: string; source: Booking["source"]; items?: Booking["items"]; proId?: string }): { ok: true; id: string } | { ok: false; error: string };
  addBookingFor(ownerId: string, b: { client: string; phone: string; serviceId: string; date: string; time: string; source: Booking["source"]; items?: Booking["items"]; proId?: string; paidDeposit?: boolean; paymentMethod?: PaymentMethod; status?: BookingStatus; depositClaim?: Booking["depositClaim"] }): { ok: true; id: string } | { ok: false; error: string };
  setStatus(id: string, status: BookingStatus): void;
  removeBooking(id: string): void;
  markDepositPaid(id: string, method: PaymentMethod): void;
  rejectDeposit(id: string): void;
  setBookingPro(id: string, proId: string | undefined): void;
}

const api: Omit<StoreApi, "toast" | "users" | "sessionUserId"> = {
  register({ name, business, email, password }) {
    const em = email.trim().toLowerCase();
    if (users.some((u) => u.email === em)) return "Ya existe una cuenta con ese email. ¿Querés iniciar sesión?";
    const user: User = {
      id: uid(),
      name: name.trim(),
      business: business.trim(),
      email: em,
      password,
      slug: slugify(business),
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
    if (!u) return "No encontramos ninguna cuenta con ese email.";
    if (u.password !== password) return "La contraseña no coincide. Probá de nuevo.";
    saveSession(u.id);
    emit();
    return null;
  },
  loginDemo() {
    const existing = users.find((u) => u.email === "demo@cupito.app");
    const demo: User = existing ?? {
      id: uid(),
      name: "Caro Méndez",
      business: "Studio Nails",
      email: "demo@cupito.app",
      password: "demo123",
      slug: "studio-nails",
      plan: "crece",
      createdAt: Date.now(),
    };
    saveUsers(existing ? users.map((u) => (u.id === demo.id ? demo : u)) : [...users, demo]);
    saveSession(demo.id);
    seedDemoExtras(demo.id);
    emit();
  },
  logout() { saveSession(null); emit(); },
  deleteAccount() {
    if (!sessionUserId) return;
    const id = sessionUserId;
    saveUsers(users.filter((u) => u.id !== id));
    saveSession(null);
    safeRemove(dataKey(id));
    emit();
  },
  saveProfile(business, name) {
    if (!sessionUserId) return;
    saveUsers(users.map((u) =>
      u.id === sessionUserId
        ? { ...u, business: business.trim() || u.business, name: name.trim() || u.name, slug: slugify(business) || u.slug }
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
  },
  adminDeleteUser(userId) {
    saveUsers(users.filter((u) => u.id !== userId));
    if (sessionUserId === userId) { saveSession(null); ssRemove(IMPERSONATION_KEY); }
    safeRemove(dataKey(userId));
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
  addCoupon({ code, pct }) {
    if (!sessionUserId) return "Necesitás una cuenta.";
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
  addProfessional(name, role) {
    if (!sessionUserId) return "Necesitás una cuenta.";
    const data = loadData(sessionUserId);
    const owner = users.find((u) => u.id === sessionUserId);
    const limit = PRO_LIMIT[owner?.plan ?? "semilla"];
    if (data.professionals.length >= limit)
      return `Tu plan ${PLAN_META[owner?.plan ?? "semilla"].name} permite hasta ${limit} profesional${limit === 1 ? "" : "es"}.`;
    if (name.trim().length < 2) return "Poné un nombre.";
    data.professionals = [...data.professionals, { id: uid(), name: name.trim(), role: role.trim() || "Profesional", color: PRO_COLORS[data.professionals.length % PRO_COLORS.length] }];
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
  addWaitlist({ date, serviceId, client, phone }) {
    if (!sessionUserId) return "Necesitás una cuenta.";
    const data = loadData(sessionUserId);
    if (client.trim().length < 2) return "Poné un nombre.";
    if (phone.replace(/\D/g, "").length < 8) return "Necesitamos un teléfono válido para avisarte.";
    if (data.waitlist.some((w) => w.date === date && w.phone.replace(/\D/g, "") === phone.replace(/\D/g, "")))
      return "Ya estás en la lista de espera para ese día 😉";
    data.waitlist = [...data.waitlist, { id: uid(), date, serviceId, client: client.trim(), phone: phone.trim(), createdAt: Date.now() }];
    saveData(sessionUserId, data);
    emit();
    return null;
  },
  removeWaitlist(id) {
    if (!sessionUserId) return;
    const data = loadData(sessionUserId);
    data.waitlist = data.waitlist.filter((w) => w.id !== id);
    saveData(sessionUserId, data);
    emit();
  },
  requestReview(bookingId) {
    if (!sessionUserId) return;
    const data = loadData(sessionUserId);
    data.bookings = data.bookings.map((b) => (b.id === bookingId ? { ...b, reviewRequested: true } : b));
    saveData(sessionUserId, data);
    emit();
  },
  addBooking({ client, phone, serviceId, date, time, source, items, proId }) {
    if (!sessionUserId) return { ok: false, error: "Necesitás una cuenta para crear reservas." };
    const data = loadData(sessionUserId);
    const clash = data.bookings.find((b) => b.date === date && b.time === time && b.status !== "cancelada");
    if (clash) return { ok: false, error: `El horario ${time} ya fue tomado por ${clash.client}.` };
    const id = uid();
    data.bookings = [...data.bookings, { id, client: client.trim(), phone: phone.trim(), serviceId, date, time, status: "confirmada", source, items, proId }];
    saveData(sessionUserId, data);
    emit();
    return { ok: true, id };
  },
  addBookingFor(ownerId, { client, phone, serviceId, date, time, source, items, proId, paidDeposit, paymentMethod, status, depositClaim }) {
    const data = loadData(ownerId);
    const clash = data.bookings.find((b) => b.date === date && b.time === time && b.status !== "cancelada");
    if (clash) return { ok: false, error: `El horario ${time} ya fue tomado por ${clash.client}.` };
    let pro = proId;
    if (!pro && data.professionals.length > 0) {
      const dayCount = data.bookings.filter((b) => b.date === date).length;
      pro = data.professionals[dayCount % data.professionals.length].id;
    }
    const id = uid();
    data.bookings = [...data.bookings, { id, client: client.trim(), phone: phone.trim(), serviceId, date, time, status: status ?? "confirmada", source, items, proId: pro, paidDeposit, paymentMethod, depositClaim }];
    saveData(ownerId, data);
    emit();
    return { ok: true, id };
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
    const data = loadData(sessionUserId);
    data.bookings = data.bookings.filter((b) => b.id !== id);
    saveData(sessionUserId, data);
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
  setBookingPro(id, proId) {
    if (!sessionUserId) return;
    const data = loadData(sessionUserId);
    data.bookings = data.bookings.map((b) => (b.id === id ? { ...b, proId } : b));
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
    const user = users.find((u) => u.slug === slug) ?? null;
    if (!user) return null;
    const pageData = loadData(user.id);
    return { user, ["data"]: pageData };
  }, [version, slug]);
}

/* ============ demo ============ */
export function ensureDemo(): void {
  const existing = users.find((u) => u.email === "demo@cupito.app");
  if (!existing) {
    const demo: User = {
      id: uid(),
      name: "Caro Méndez",
      business: "Studio Nails",
      email: "demo@cupito.app",
      password: "demo123",
      slug: "studio-nails",
      plan: "crece",
      createdAt: Date.now(),
    };
    saveUsers([...users, demo]);
    loadData(demo.id);
    seedDemoExtras(demo.id);
    return;
  }
  seedDemoExtras(existing.id);
}
try {
  ensureDemo();
} catch (e) {
  console.warn("[Cupito] No se pudo sembrar la demo:", e);
}
