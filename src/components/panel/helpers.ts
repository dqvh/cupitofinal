import { bookingDuration, fromMin, toMin } from "../../lib/availability";
import { cleanPhoneDigits, createWhatsAppUrl } from "../../lib/phone";
import type { BizData, Booking, BookingStatus, Service } from "../../lib/store";

export const pad = (n: number) => String(n).padStart(2, "0");
export const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseKey = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const shiftKey = (k: string, days: number) => {
  const d = parseKey(k);
  d.setDate(d.getDate() + days);
  return keyOf(d);
};
export const todayKey = () => keyOf(new Date());
export const nowHHMM = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
/** Lunes de la semana de `k`. */
export const weekStartOf = (k: string) => {
  const d = parseKey(k);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return keyOf(d);
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Hoy", "Mañana", "Ayer" o "Jue 24 sep". */
export function dayLabel(k: string, opts: { long?: boolean } = {}) {
  const t = todayKey();
  if (k === t) return "Hoy";
  if (k === shiftKey(t, 1)) return "Mañana";
  if (k === shiftKey(t, -1)) return "Ayer";
  const d = parseKey(k);
  if (opts.long) return cap(d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" }));
  return cap(d.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, ""));
}

export function longDate(k: string) {
  return cap(parseKey(k).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" }));
}

export function monthTitle(k: string) {
  return cap(parseKey(k).toLocaleDateString("es-AR", { month: "long", year: "numeric" }));
}

export function relTime(ts?: number) {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const m = Math.round(diff / 60000);
  if (m < 1) return "recién";
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 7) return `hace ${d} d`;
  return new Date(ts).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

/** "en 25 min", "en 2 h", "ahora". */
export function untilLabel(date: string, time: string, now = new Date()) {
  const d = parseKey(date);
  d.setHours(Math.floor(toMin(time) / 60), toMin(time) % 60, 0, 0);
  const m = Math.round((d.getTime() - now.getTime()) / 60000);
  if (m <= 0 && m > -60) return "ahora";
  if (m < 0) return "";
  if (m < 60) return `en ${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h < 24) return r ? `en ${h} h ${r} min` : `en ${h} h`;
  return "";
}

export const money = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");

/* ---------- turnos ---------- */

export function durOf(data: BizData, b: Booking) {
  return bookingDuration(data, b);
}
export function endOf(data: BizData, b: Booking) {
  return fromMin(toMin(b.time) + durOf(data, b));
}
export function servicesOf(data: BizData, b: Booking): Service[] {
  return [b.serviceId, ...(b.extraServiceIds || [])].map((id) => data.services.find((s) => s.id === id)).filter(Boolean) as Service[];
}
export function serviceLabel(data: BizData, b: Booking) {
  const list = servicesOf(data, b);
  if (!list.length) return "Servicio eliminado";
  return list.map((s) => s.name).join(" + ");
}
export function priceOf(data: BizData, b: Booking) {
  const svc = servicesOf(data, b).reduce((a, s) => a + s.price, 0);
  const prod = (b.items || []).reduce((a, it) => a + (data.products.find((p) => p.id === it.productId)?.price || 0) * (it.qty || 1), 0);
  return svc + prod;
}
export function depositOf(data: BizData, b: Booking) {
  const svc = servicesOf(data, b).reduce((a, s) => a + s.price, 0);
  return Math.round((svc * (data.settings.depositPct || 0)) / 100);
}
/** Ingreso que cuenta en caja: cobrado o atendido. */
export function incomeOf(data: BizData, b: Booking) {
  if (b.status === "cancelada" || b.status === "ausente") return b.paidDeposit ? depositOf(data, b) : 0;
  if (b.paymentStatus === "total_pagado") return b.paidAmount || priceOf(data, b);
  if (b.status === "atendida") return priceOf(data, b);
  return 0;
}
export const isActive = (b: Booking) => b.status !== "cancelada";
export const isOpen = (b: Booking) => b.status === "pendiente" || b.status === "confirmada";
export const sortByTime = (a: Booking, b: Booking) => (a.date + a.time).localeCompare(b.date + b.time);

export function needsAttention(b: Booking) {
  return b.status === "pendiente" || (!!b.depositClaim && !b.paidDeposit && b.status !== "cancelada");
}

/* ---------- clientes ---------- */

export interface Client {
  key: string; // últimos 8 dígitos del teléfono (o nombre si no hay)
  name: string;
  phone: string;
  email?: string;
  bookings: Booking[];
  total: number; // turnos
  visits: number; // atendidos
  cancelled: number;
  noShows: number;
  spent: number;
  lastVisit?: string;
  nextBooking?: Booking;
  firstDate: string;
  favorite?: string; // servicio más pedido
}

export const clientKeyOf = (phone: string, name = "") => {
  const d = cleanPhoneDigits(phone || "");
  return d.length >= 6 ? d.slice(-8) : `n:${name.trim().toLowerCase()}`;
};

export function buildClients(data: BizData): Client[] {
  const map = new Map<string, Client>();
  const today = todayKey();
  const now = nowHHMM();
  const sorted = [...data.bookings].sort(sortByTime);
  for (const b of sorted) {
    const key = clientKeyOf(b.phone, b.client);
    let c = map.get(key);
    if (!c) {
      c = { key, name: b.client, phone: b.phone, email: b.email, bookings: [], total: 0, visits: 0, cancelled: 0, noShows: 0, spent: 0, firstDate: b.date };
      map.set(key, c);
    }
    c.bookings.push(b);
    c.total++;
    c.name = b.client || c.name; // el más reciente gana
    if (b.phone) c.phone = b.phone;
    if (b.email) c.email = b.email;
    if (b.status === "atendida") { c.visits++; c.lastVisit = b.date; }
    if (b.status === "cancelada") c.cancelled++;
    if (b.status === "ausente") c.noShows++;
    c.spent += incomeOf(data, b);
    if (!c.nextBooking && isOpen(b) && (b.date > today || (b.date === today && b.time >= now))) c.nextBooking = b;
  }
  for (const c of map.values()) {
    const counts = new Map<string, number>();
    c.bookings.forEach((b) => b.status !== "cancelada" && counts.set(b.serviceId, (counts.get(b.serviceId) || 0) + 1));
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    c.favorite = top ? data.services.find((s) => s.id === top[0])?.name : undefined;
    if (!c.lastVisit) {
      const past = c.bookings.filter((b) => b.date < today && b.status !== "cancelada").pop();
      c.lastVisit = past?.date;
    }
  }
  return [...map.values()];
}

/* ---------- mensajes ---------- */

const first = (name: string) => (name || "").trim().split(/\s+/)[0] || "";

export type WaKind = "recordatorio" | "confirmacion" | "reprogramado" | "cancelado" | "resena" | "libre" | "hueco";

export function waMessage(kind: WaKind, o: { business: string; b?: Booking; data?: BizData; slug?: string; name?: string; date?: string; time?: string }) {
  const name = first(o.b?.client || o.name || "");
  const hola = name ? `Hola ${name}!` : "Hola!";
  const svc = o.b && o.data ? serviceLabel(o.data, o.b) : "tu turno";
  const when = o.b ? `${dayLabel(o.b.date, { long: true }).toLowerCase()} a las ${o.b.time} hs` : o.date && o.time ? `${longDate(o.date).toLowerCase()} a las ${o.time} hs` : "";
  const link = o.slug ? `https://cupito.app/${o.slug}` : "";
  switch (kind) {
    case "recordatorio":
      return `${hola} Te recordamos tu turno de ${svc} en ${o.business}: ${when}. Si no podés venir, avisanos así liberamos el lugar 🙌`;
    case "confirmacion":
      return `${hola} Tu turno de ${svc} en ${o.business} quedó confirmado para el ${when}. ¡Te esperamos!`;
    case "reprogramado":
      return `${hola} Te escribimos de ${o.business}: tu turno de ${svc} quedó para el ${when}. Si no te queda bien, respondé este mensaje.`;
    case "cancelado":
      return `${hola} Te escribimos de ${o.business}: tuvimos que cancelar tu turno de ${svc} del ${when}. Podés elegir otro horario acá: ${link}`;
    case "resena":
      return `${hola} Gracias por venir a ${o.business}. Si te gustó la atención, nos ayuda mucho tu opinión: ${link}?resena=1`;
    case "hueco":
      return `${hola} Se liberó un lugar en ${o.business} el ${when}. ¿Lo querés? Respondé este mensaje y te lo reservamos.`;
    default:
      return `${hola} Te escribimos de ${o.business}.`;
  }
}

export function waLink(phone: string, text: string) {
  return createWhatsAppUrl(phone, text);
}

export const hasPhone = (p?: string) => cleanPhoneDigits(p || "").length >= 8;

/* ---------- exportar ---------- */

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = "﻿" + [headers, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const STATUS_ORDER: BookingStatus[] = ["pendiente", "confirmada", "atendida", "ausente", "cancelada"];
