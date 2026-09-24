import { createContext, useContext } from "react";
import type { BizData, Plan, User } from "../../lib/store";

export type View =
  | "inicio"
  | "agenda"
  | "reservas"
  | "clientes"
  | "espera"
  | "servicios"
  | "equipo"
  | "horarios"
  | "tienda"
  | "cupones"
  | "pagina"
  | "stats"
  | "ajustes";

export type SettingsTab = "negocio" | "reservas" | "pagos" | "notificaciones" | "apariencia" | "plan" | "cuenta";

export const VIEW_TITLES: Record<View, string> = {
  inicio: "Inicio",
  agenda: "Agenda",
  reservas: "Reservas",
  clientes: "Clientes",
  espera: "Lista de espera",
  servicios: "Servicios",
  equipo: "Equipo",
  horarios: "Horarios",
  tienda: "Tienda",
  cupones: "Cupones",
  pagina: "Mi página",
  stats: "Estadísticas",
  ajustes: "Ajustes",
};

const LEGACY: Record<string, View> = {
  hoy: "inicio",
  lista: "espera",
  promos: "cupones",
  suscripcion: "ajustes",
};

export interface NewBookingPrefill {
  date?: string;
  time?: string;
  proId?: string;
  client?: string;
  phone?: string;
  serviceId?: string;
  waitlistId?: string;
}

export interface BlockPrefill {
  date?: string;
  time?: string;
  endTime?: string;
  proId?: string;
}

export interface PanelApi {
  user: User;
  data: BizData;
  view: View;
  go: (view: View, opts?: { tab?: SettingsTab; params?: Record<string, string> }) => void;
  params: URLSearchParams;
  setParams: (p: Record<string, string | undefined>) => void;
  openBooking: (id: string) => void;
  openClient: (key: string) => void;
  newBooking: (prefill?: NewBookingPrefill) => void;
  blockTime: (prefill?: BlockPrefill) => void;
  checkout: (plan: Plan) => void;
  openSearch: () => void;
  openCalendarSync: (proId?: string) => void;
  openShare: () => void;
}

export const PanelCtx = createContext<PanelApi | null>(null);

export function usePanel(): PanelApi {
  const c = useContext(PanelCtx);
  if (!c) throw new Error("usePanel fuera del panel");
  return c;
}

/** Lee la vista desde el hash: #/app/agenda?d=2026-09-24 */
export function readRoute(): { view: View; tab?: SettingsTab; params: URLSearchParams } {
  const raw = (typeof window !== "undefined" ? window.location.hash : "") || "";
  const clean = raw.replace(/^#\/?/, "");
  const [path, query = ""] = clean.split("?");
  const parts = path.split("/").filter(Boolean); // ["app", "agenda", ...]
  const seg = (parts[1] || "").toLowerCase();
  const view = (LEGACY[seg] || (seg in VIEW_TITLES ? seg : "inicio")) as View;
  const params = new URLSearchParams(query);
  const tab = (parts[2] as SettingsTab | undefined) || (seg === "suscripcion" ? "plan" : undefined);
  return { view, tab, params };
}

export function routeHash(view: View, tab?: string, params?: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => v !== undefined && v !== "" && q.set(k, v));
  const qs = q.toString();
  return `#/app${view === "inicio" ? "" : `/${view}`}${tab ? `/${tab}` : ""}${qs ? `?${qs}` : ""}`;
}
