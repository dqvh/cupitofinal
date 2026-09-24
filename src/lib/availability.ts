/* Motor único de disponibilidad.
   Lo usan el panel, la página pública y la API (/api/public), así que no
   importa React ni el store: solo tipos mínimos y funciones puras. */

export interface AvDay { open: boolean; from: string; to: string; from2?: string; to2?: string }
export interface AvService { id: string; duration: number; price?: number }
export interface AvPro { id: string; name?: string; hours?: AvDay[]; proDurations?: Record<string, number> }
export interface AvBooking { id: string; date: string; time: string; status: string; serviceId: string; extraServiceIds?: string[]; proId?: string; client?: string }
export interface AvBlock { id?: string; date: string; time?: string; endTime?: string; proId?: string; reason?: string }
export interface AvSettings {
  hours: AvDay[];
  specialHours?: Record<string, AvDay>;
  closedDates?: string[];
  bufferMinutes?: number;
  slotInterval?: number;
  maxAdvanceDays?: number;
  minNoticeHours?: number;
}
export interface AvBiz {
  settings: AvSettings;
  services: AvService[];
  professionals: AvPro[];
  bookings: AvBooking[];
  blockedSlots?: AvBlock[];
}

export const DEFAULT_SLOT_INTERVAL = 30;

export const toMin = (t: string): number => {
  const [h, m] = String(t || "").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
export const fromMin = (n: number): string => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

const dow = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
};

const shifts = (h: AvDay | undefined): [number, number][] => {
  if (!h || !h.open) return [];
  const out: [number, number][] = [];
  if (h.from && h.to && toMin(h.to) > toMin(h.from)) out.push([toMin(h.from), toMin(h.to)]);
  if (h.from2 && h.to2 && toMin(h.to2) > toMin(h.from2)) out.push([toMin(h.from2), toMin(h.to2)]);
  return out;
};

/** Horario del local para una fecha: feriado > horario especial > semana. */
export function businessHoursOn(settings: AvSettings, date: string): AvDay | undefined {
  if ((settings.closedDates || []).includes(date)) return { open: false, from: "09:00", to: "18:00" };
  const special = settings.specialHours?.[date];
  if (special) return special;
  return settings.hours?.[dow(date)];
}

/** Horario de un profesional para una fecha. El horario especial del local manda para todos. */
export function proHoursOn(settings: AvSettings, pro: AvPro | undefined, date: string): AvDay | undefined {
  const biz = businessHoursOn(settings, date);
  if (!pro) return biz;
  if (!biz?.open) return biz;
  if (settings.specialHours?.[date]) return biz;
  if (pro.hours && pro.hours.length === 7) return pro.hours[dow(date)];
  return biz;
}

export function durationOf(biz: Pick<AvBiz, "services">, serviceIds: string[], pro?: AvPro): number {
  const total = serviceIds.filter(Boolean).reduce((sum, id) => {
    const custom = pro?.proDurations?.[id];
    return sum + (custom !== undefined ? custom : biz.services.find((s) => s.id === id)?.duration ?? 45);
  }, 0);
  return total || 45;
}

export function bookingDuration(biz: Pick<AvBiz, "services" | "professionals">, b: Pick<AvBooking, "serviceId" | "extraServiceIds" | "proId">): number {
  const pro = biz.professionals.find((p) => p.id === b.proId);
  return durationOf(biz, [b.serviceId, ...(b.extraServiceIds || [])], pro);
}

/** Bloqueos que pisan [start, start+dur) para un profesional (o el local). */
export function blockAt(biz: Pick<AvBiz, "blockedSlots" | "settings">, date: string, time: string, dur: number, proId?: string): AvBlock | undefined {
  const step = biz.settings.slotInterval || DEFAULT_SLOT_INTERVAL;
  const s = toMin(time);
  const e = s + Math.max(1, dur);
  return (biz.blockedSlots || []).find((bs) => {
    if (bs.date !== date) return false;
    if (bs.proId && proId && bs.proId !== proId) return false;
    if (!bs.time) return true;
    const bs0 = toMin(bs.time);
    const be = bs.endTime ? toMin(bs.endTime) : bs0 + step;
    return s < be && bs0 < e;
  });
}

/** Turno existente que se superpone (considera duración real y buffer). */
export function clashAt(
  biz: Pick<AvBiz, "bookings" | "services" | "professionals" | "settings">,
  date: string,
  time: string,
  dur: number,
  proId?: string,
  excludeId?: string
): AvBooking | undefined {
  const buf = Math.max(0, biz.settings.bufferMinutes || 0);
  const s = toMin(time);
  const e = s + dur;
  return biz.bookings.find((b) => {
    if (b.id === excludeId || b.date !== date || b.status === "cancelada") return false;
    if (b.proId && proId && b.proId !== proId) return false;
    const bs = toMin(b.time);
    const be = bs + bookingDuration(biz, b);
    return s < be + buf && bs < e + buf;
  });
}

const fitsHours = (h: AvDay | undefined, time: string, dur: number) =>
  shifts(h).some(([a, b]) => toMin(time) >= a && toMin(time) + dur <= b);

export type SlotCheck = { ok: true; proId?: string } | { ok: false; error: string; reason: "closed" | "hours" | "blocked" | "taken" | "past" | "advance" };

/**
 * ¿Se puede dar este turno? Si hay equipo y no se eligió profesional, asigna
 * el que tenga menos turnos ese día.
 */
export function checkSlot(
  biz: AvBiz,
  q: { date: string; time: string; serviceIds: string[]; proId?: string; excludeId?: string; ignoreHours?: boolean; now?: Date; online?: boolean }
): SlotCheck {
  const { date, time } = q;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { ok: false, error: "Elegí un día y un horario válidos.", reason: "hours" };
  if ((biz.settings.closedDates || []).includes(date)) return { ok: false, error: "El local está cerrado ese día.", reason: "closed" };
  if (q.online) {
    const now = q.now || new Date();
    const appt = new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), Math.floor(toMin(time) / 60), toMin(time) % 60);
    const notice = Math.max(0, biz.settings.minNoticeHours || 0) * 3600000;
    if (appt.getTime() <= now.getTime() + notice) return { ok: false, error: notice ? `Los turnos se reservan con al menos ${biz.settings.minNoticeHours} h de anticipación.` : "Elegí un horario futuro.", reason: "past" };
    const adv = biz.settings.maxAdvanceDays ?? 30;
    if (adv > 0 && appt.getTime() > now.getTime() + (adv + 1) * 86400000) return { ok: false, error: "La fecha supera la anticipación permitida por el local.", reason: "advance" };
  }
  const pros = biz.professionals || [];
  const tryPro = (pro: AvPro | undefined): SlotCheck => {
    const dur = durationOf(biz, q.serviceIds, pro);
    if (!q.ignoreHours) {
      const h = proHoursOn(biz.settings, pro, date);
      if (!h?.open) return { ok: false, error: pro?.name ? `${pro.name} no atiende ese día.` : "El local no abre ese día.", reason: "closed" };
      if (!fitsHours(h, time, dur)) return { ok: false, error: "El turno tiene que terminar dentro del horario de atención.", reason: "hours" };
    }
    if (blockAt(biz, date, time, dur, pro?.id)) return { ok: false, error: "Ese horario está bloqueado en la agenda.", reason: "blocked" };
    const clash = clashAt(biz, date, time, dur, pro?.id, q.excludeId);
    if (clash) {
      const who = clash.client ? ` con ${clash.client}` : "";
      return { ok: false, error: clash.time === time ? `Ese horario ya está ocupado${who}.` : `Se superpone con el turno de las ${clash.time}${who}.`, reason: "taken" };
    }
    return { ok: true, proId: pro?.id };
  };
  if (!pros.length) return tryPro(undefined);
  if (q.proId) {
    const pro = pros.find((p) => p.id === q.proId);
    if (!pro) return { ok: false, error: "Ese profesional ya no está disponible.", reason: "closed" };
    return tryPro(pro);
  }
  const load = (id: string) => biz.bookings.filter((b) => b.date === date && b.proId === id && b.status !== "cancelada").length;
  let firstError: SlotCheck | null = null;
  for (const pro of [...pros].sort((a, b) => load(a.id) - load(b.id))) {
    const r = tryPro(pro);
    if (r.ok) return r;
    firstError ||= r;
  }
  return firstError && !firstError.ok && firstError.reason === "taken"
    ? { ok: false, error: "No hay profesionales libres en ese horario.", reason: "taken" }
    : firstError || { ok: false, error: "No hay disponibilidad.", reason: "closed" };
}

/** Horarios candidatos (grilla) para un día, sin evaluar ocupación. */
export function gridFor(biz: AvBiz, date: string, dur: number, proId?: string): string[] {
  const step = biz.settings.slotInterval || DEFAULT_SLOT_INTERVAL;
  const pros = biz.professionals || [];
  const list = proId ? pros.filter((p) => p.id === proId) : pros.length ? pros : [undefined];
  const set = new Set<number>();
  for (const pro of list) {
    for (const [a, b] of shifts(proHoursOn(biz.settings, pro, date))) {
      for (let t = a; t + dur <= b; t += step) set.add(t);
    }
  }
  return [...set].sort((x, y) => x - y).map(fromMin);
}

export interface SlotInfo { time: string; free: boolean; proId?: string }

/** Horarios de un día con su estado (libre/ocupado) listos para mostrar. */
export function slotsFor(
  biz: AvBiz,
  q: { date: string; serviceIds: string[]; proId?: string; online?: boolean; now?: Date; excludeId?: string }
): SlotInfo[] {
  const pro = biz.professionals.find((p) => p.id === q.proId);
  const dur = durationOf(biz, q.serviceIds, pro);
  return gridFor(biz, q.date, dur, q.proId).map((time) => {
    const r = checkSlot(biz, { ...q, time });
    return { time, free: r.ok, proId: r.ok ? r.proId : undefined };
  });
}

/** Primer día (desde `from`) con al menos un horario libre. */
export function nextFreeDay(
  biz: AvBiz,
  q: { from: string; serviceIds: string[]; proId?: string; online?: boolean; days?: number; now?: Date }
): { date: string; time: string } | null {
  const [y, m, d] = q.from.split("-").map(Number);
  const base = new Date(y, m - 1, d);
  for (let i = 0; i < (q.days ?? 60); i++) {
    const dt = new Date(base);
    dt.setDate(dt.getDate() + i);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    const hit = slotsFor(biz, { ...q, date: key }).find((s) => s.free);
    if (hit) return { date: key, time: hit.time };
    if (q.online && (biz.settings.maxAdvanceDays ?? 30) > 0 && i > (biz.settings.maxAdvanceDays ?? 30)) break;
  }
  return null;
}
