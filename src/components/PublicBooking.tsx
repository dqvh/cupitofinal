import { useEffect, useMemo, useState } from "react";
import {
  useStore, dateKey, addDays, fmtMoney, fmtLong, slotsForDay, dayOfWeek, isPaid,
  THEMES, SEMILLA_MONTHLY_LIMIT, monthBookingCount, findOverlap, isSlotBlocked,
  type User, type BizData, type BizSettings, type Coupon, type ColorTheme,
} from "../lib/store";
import {
  IconCheck, IconCalendar, IconChevron, IconBag, IconTicket, IconPlus, IconUsers,
  IconWhatsApp, LogoMark, IconSun, IconMoon, CopyButton, ConfettiBurst, Badge, IconSearch,
} from "./kit";
import { normalizeArgentinaPhone, cleanPhoneDigits, createWhatsAppUrl } from "../lib/phone";
import { sound } from "../lib/audio";
import { sendBookingConfirmationEmail } from "../lib/email";

/* ---------- helpers .ics / Google Calendar ---------- */
function toLocalStamp(dt: Date) {
  return `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, "0")}${String(dt.getDate()).padStart(2, "0")}T${String(dt.getHours()).padStart(2, "0")}${String(dt.getMinutes()).padStart(2, "0")}00`;
}
function buildDates(date: string, time: string, duration: number) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const start = new Date(y, m - 1, d, hh, mm);
  return { start, end: new Date(start.getTime() + duration * 60000) };
}
function icsContent(o: { title: string; date: string; time: string; duration: number; desc: string }) {
  const { start, end } = buildDates(o.date, o.time, o.duration);
  // Dos alarmas: 24 h antes y 1 h antes (Apple Calendar / Outlook las respetan solas).
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Cupito//Reservas//ES", "BEGIN:VEVENT", `UID:${Date.now()}@cupito.app`, `DTSTART:${toLocalStamp(start)}`, `DTEND:${toLocalStamp(end)}`, `SUMMARY:${o.title}`, `DESCRIPTION:${o.desc}`, "BEGIN:VALARM", "TRIGGER:-PT24H", "ACTION:DISPLAY", "DESCRIPTION:Tu turno es mañana", "END:VALARM", "BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", "DESCRIPTION:Recordatorio de tu turno", "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
}
function downloadIcs(content: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "mi-turno-cupito.ics";
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
function gcalUrl(o: { title: string; date: string; time: string; duration: number }) {
  const { start, end } = buildDates(o.date, o.time, o.duration);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(o.title)}&dates=${toLocalStamp(start)}/${toLocalStamp(end)}&details=${encodeURIComponent("Turno reservado con Cupito. ¡Te esperamos!")}`;
}

/* ---------- calendario mensual ---------- */
function MonthPicker({ cursor, setCursor, selected, onSelect, isClosed, theme, maxAdvanceDays = 30 }: {
  cursor: Date; setCursor: (d: Date) => void; selected: string | null; onSelect: (k: string) => void; isClosed: (k: string) => boolean; theme: ColorTheme; maxAdvanceDays?: number;
}) {
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const now = new Date();
  const nowMonth = now.getFullYear() * 12 + now.getMonth();
  const curMonth = year * 12 + month;
  const maxMonths = maxAdvanceDays > 0 ? Math.max(1, Math.ceil(maxAdvanceDays / 30)) : 12;
  const pad = (new Date(year, month, 1).getDay() + 6) % 7;
  const total = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array.from({ length: pad }, () => null), ...Array.from({ length: total }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const label = cursor.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  return (
    <div>
      <div className="flex items-center justify-between">
        <button type="button" disabled={curMonth <= nowMonth} onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="Mes anterior"
          className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink/12 bg-white/60 text-ink transition-all enabled:hover:-translate-x-0.5 enabled:hover:border-ink enabled:hover:bg-white disabled:opacity-30">
          <IconChevron className="h-4 w-4 rotate-180" />
        </button>
        <p className="font-display text-base font-extrabold capitalize text-ink">{label}</p>
        <button type="button" disabled={curMonth >= nowMonth + maxMonths} onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="Mes siguiente"
          className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink/12 bg-white/60 text-ink transition-all enabled:hover:translate-x-0.5 enabled:hover:border-ink enabled:hover:bg-white disabled:opacity-30">
          <IconChevron className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center">
        {["L", "M", "X", "J", "V", "S", "D"].map((d) => <span key={d} className="py-1 text-[11px] font-bold uppercase tracking-wider text-ink/40">{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <span key={`x${i}`} />;
          const key = dateKey(new Date(year, month, d));
          const past = key < dateKey(now);
          const maxDate = maxAdvanceDays > 0 ? dateKey(addDays(now, maxAdvanceDays)) : "9999-99-99";
          const tooFar = key > maxDate;
          const closed = isClosed(key);
          const sel = key === selected;
          const disabled = past || tooFar || closed;
          return (
            <button type="button" key={key} disabled={disabled} onClick={() => onSelect(key)}
              title={tooFar ? `Solo podés reservar hasta con ${maxAdvanceDays} días de anticipación` : undefined}
              className={`relative flex aspect-square items-center justify-center rounded-lg border-2 font-display text-sm font-bold transition-all duration-150 ${sel ? theme.activeSlot : disabled ? "cursor-not-allowed border-transparent bg-ink/[0.04] text-ink/25" : "border-ink/10 bg-white/60 text-ink hover:-translate-y-0.5 hover:border-ink/40"}`}>
              {d}
              {closed && !past && !tooFar && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-coral/60" />}
            </button>
          );
        })}
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-inkmute">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-coral/60" /> días sin atención
      </p>
    </div>
  );
}

/* ---------- widget principal ---------- */
export default function PublicBooking({ owner, initialLookupOpen }: { owner?: ({ user: User } & Record<"data", BizData>) | null; initialLookupOpen?: boolean } = {}) {
  const store = useStore();
  const user = owner ? owner.user : store.user;
  const biz = owner ? owner.data : store.data;
  const { addBookingFor, addWaitlist, cancelBookingByClient, toast } = store;

  const [step, setStep] = useState(0); // 0 servicio · 1 profesional · 2 fecha · 3 hora+datos
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [proId, setProId] = useState<string | null>(null);
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [client, setClient] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [items, setItems] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showShop, setShowShop] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [showCalHelp, setShowCalHelp] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [wlClient, setWlClient] = useState("");
  const [wlPhone, setWlPhone] = useState("");
  const [wlDone, setWlDone] = useState(false);
  const [wlError, setWlError] = useState<string | null>(null);
  const [showWlForm, setShowWlForm] = useState(false);
  const [showAllSlots, setShowAllSlots] = useState(false);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const [cancelFeedback, setCancelFeedback] = useState<string | null>(null);
  const [cancelBlocked, setCancelBlocked] = useState(false);
  const [showLookupModal, setShowLookupModal] = useState(!!initialLookupOpen);
  const [lookupPhone, setLookupPhone] = useState("");
  const [lookupFeedback, setLookupFeedback] = useState<string | null>(null);
  const [serviceSearch, setServiceSearch] = useState("");

  const phoneVal = useMemo(() => normalizeArgentinaPhone(phone), [phone]);
  const wlPhoneVal = useMemo(() => normalizeArgentinaPhone(wlPhone), [wlPhone]);
  const lookupVal = useMemo(() => normalizeArgentinaPhone(lookupPhone), [lookupPhone]);

  const filteredServices = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase();
    if (!q) return biz.services;
    return biz.services.filter((s) => s.name.toLowerCase().includes(q));
  }, [biz.services, serviceSearch]);

  useEffect(() => {
    if (done) {
      // Auto-scroll centrado suave para ver la confirmación sin tener que scrollear
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
        const el = document.getElementById("booking-confirmed-ticket");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 50);
    }
  }, [done]);

  if (!user || !biz) return null;

  const paid = isPaid(user);
  const settings = biz.settings;
  const activeThemeId = paid ? (settings.theme ?? "evergreen") : "evergreen";
  const theme = THEMES[activeThemeId] ?? THEMES.evergreen;
  const maxAdvanceDays = settings.maxAdvanceDays ?? 30;
  const hasPros = biz.professionals.length > 0;
  const depositOn = paid && settings.depositEnabled && settings.depositPct > 0;
  const service = biz.services.find((s) => s.id === serviceId);
  const pro = biz.professionals.find((p) => p.id === proId);

  const now = new Date();
  const todayKey = dateKey(now);
  const currentHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const hoursFor = (key: string) => settings.hours[dayOfWeek(key)];
  const isClosed = (key: string) => {
    if (!hoursFor(key).open) return true;
    if ((settings.closedDates || []).includes(key)) return true;
    if ((biz.blockedSlots || []).some((bs) => bs.date === key && !bs.time && (!bs.proId || !proId || bs.proId === proId))) return true;
    if (key === todayKey) {
      const todaySlots = slotsForDay(hoursFor(key));
      if (todaySlots.length > 0 && todaySlots.every((t) => t <= currentHHMM)) return true;
    }
    return false;
  };
  const rawSlots = selectedDate ? slotsForDay(hoursFor(selectedDate)) : [];
  const busyTimes = (key: string) => {
    const h = hoursFor(key);
    if (!h.open) return [] as string[];
    const dur = service?.duration ?? 45;
    const pro = proId ?? undefined;
    return slotsForDay(h).filter(
      (t) =>
        isSlotBlocked(biz.blockedSlots || [], key, t, pro) ||
        !!findOverlap({ date: key, time: t, dur, proId: pro }, biz.bookings, biz.services)
    );
  };
  const takenTimes = busyTimes;
  const slots = (selectedDate === todayKey ? rawSlots.filter((t) => t > currentHHMM) : rawSlots)
    .filter((t) => !takenTimes(selectedDate ?? "").includes(t));
  const allTaken = rawSlots.length > 0 && slots.every((t) => takenTimes(selectedDate ?? "").includes(t));
  const monthLimitReached = !paid && monthBookingCount(biz) >= SEMILLA_MONTHLY_LIMIT;
  const hasBreak = selectedDate ? !!hoursFor(selectedDate).from2 : false;
  const breakInfo = selectedDate ? { to: hoursFor(selectedDate).to, from2: hoursFor(selectedDate).from2 } : null;

  const productsTotal = Object.entries(items).reduce((acc, [pid, qty]) => acc + (biz.products.find((p) => p.id === pid)?.price ?? 0) * qty, 0);
  const itemCount = Object.values(items).reduce((a, b) => a + b, 0);
  const totalBase = (service?.price ?? 0) + productsTotal;
  const discount = coupon ? Math.round((totalBase * coupon.pct) / 100) : 0;
  const total = Math.max(0, totalBase - discount);
  const deposit = depositOn ? Math.round((total * settings.depositPct) / 100) : 0;

  const bookingItems = Object.entries(items).map(([productId, qty]) => ({ productId, qty }));

  const applyCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return setCouponMsg({ ok: false, text: "Escribí un código." });
    const found = biz.coupons.find((c) => c.code === code && c.active);
    if (!found) { setCoupon(null); return setCouponMsg({ ok: false, text: "Ese cupón no existe o ya no está activo." }); }
    setCoupon(found);
    setCouponMsg({ ok: true, text: `¡Listo! ${found.pct}% de descuento aplicado.` });
  };

  const joinWaitlist = () => {
    if (!selectedDate || !serviceId) return;
    const err = addWaitlist({ date: selectedDate, serviceId, client: wlClient, phone: wlPhone }, user.id);
    if (err) return setWlError(err);
    setWlError(null);
    setWlDone(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (owner === undefined) toast(`Nueva persona en lista de espera: ${wlClient.trim()} 👀`);
  };

  const confirm = () => {
    if (client.trim().length < 2) return setError("Poné tu nombre para confirmar.");
    if (!phoneVal.isValid) return setError("Ingresá un número de celular válido de Argentina (ej. 11 5555-0000).");
    if (email.trim() !== "" && !/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Ese email no parece válido (o dejalo vacío).");
    if (!serviceId || !selectedDate || !time) return setError("Falta elegir servicio, día y hora.");
    setError(null);
    if (depositOn && deposit > 0) setShowPay(true);
    else finish({});
  };

  const finish = (opts: { claimTx?: string }) => {
    if (!serviceId || !selectedDate || !time) return;
    const res = addBookingFor(user.id, {
      client, phone, email: email.trim() || undefined, serviceId, date: selectedDate, time, source: "online",
      items: bookingItems.length ? bookingItems : undefined,
      proId: proId ?? undefined,
      status: opts.claimTx ? "pendiente" : undefined,
      depositClaim: opts.claimTx ? { txId: opts.claimTx, sentAt: Date.now() } : undefined,
    });
    if (!res.ok) { setShowPay(false); return setError(res.error); }
    setShowPay(false);
    setClaimed(!!opts.claimTx);
    setConfirmedId(res.id);
    setCancelFeedback(null);
    setCancelBlocked(false);
    setDone(true);
    sound.playSuccess();

    if (email.trim()) {
      const gcal = gcalUrl({
        title: `${service?.name || "Turno"} en ${user.business}`,
        date: selectedDate,
        time,
        duration: service?.duration ?? 30,
      });
      sendBookingConfirmationEmail({
        toEmail: email.trim(),
        clientName: client.trim(),
        businessName: user.business,
        serviceName: service?.name || "Servicio",
        dateStr: fmtLong(selectedDate),
        timeStr: time,
        proName: pro?.name,
        priceStr: fmtMoney(total),
        depositStr: depositOn ? fmtMoney(deposit) : undefined,
        address: settings.address,
        slug: user.slug,
        gCalUrl: gcal,
      }).catch(() => {});
    }

    if (owner === undefined)
      toast(opts.claimTx ? `Nueva reserva de ${client.trim()} — seña pendiente de verificación 💸` : `¡Nueva reserva de ${client.trim()}! Ya está en tu agenda 🎉`);
  };

  const reset = () => {
    setStep(0); setServiceId(null); setProId(null); setSelectedDate(null); setTime(null);
    setClient(""); setPhone(""); setEmail(""); setItems({}); setError(null); setDone(false);
    setConfirmedId(null); setCancelFeedback(null); setCancelBlocked(false);
    setCouponInput(""); setCoupon(null); setCouponMsg(null); setShowPay(false); setClaimed(false);
    setWlClient(""); setWlPhone(""); setWlDone(false); setWlError(null); setShowWlForm(false);
    setShowAllSlots(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const stepNum = step === 0 ? 1 : step === 1 ? 2 : step === 2 ? (hasPros ? 3 : 2) : hasPros ? 4 : 3;
  const totalSteps = hasPros ? 4 : 3;

  return (
    <div className="overflow-hidden rounded-[22px] border-2 border-ink/15 bg-card text-ink shadow-block-ink">
      {/* cabecera temática */}
      <div className={`relative ${theme.cardHeaderBg} px-5 pb-8 pt-5 ${theme.cardHeaderText} sm:px-6`}>
        <div className="gridlines absolute inset-0 opacity-30" aria-hidden="true" />
        <div className="relative flex items-center justify-between gap-2">
          <span className={`inline-flex min-w-0 items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${theme.accentText}`}>
            <LogoMark className={`h-4 w-4 shrink-0 ${theme.accentText}`} />
            <span className="truncate">cupito.app/{user.slug}</span>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowLookupModal(true)}
              className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold transition-all hover:bg-white/25 active:scale-95"
            >
              🔍 Mis turnos
            </button>
            <span className="hidden items-center gap-1.5 text-[11px] font-bold opacity-80 sm:inline-flex">
              <span className={`blinkdot h-1.5 w-1.5 rounded-full ${theme.accentBg}`} /> Abierto 24/7
            </span>
          </div>
        </div>
        <h3 className="relative mt-4 font-display text-2xl font-extrabold">{user.business}</h3>
        <p className="relative text-sm opacity-80">Reservá tu cupito en menos de un minuto · sin llamadas</p>
      </div>

      <div className="px-4 py-5 sm:px-6">
        {/* progreso */}
        {!done && (
          <div className="mb-4 flex items-center gap-1.5" aria-hidden="true">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10">
                <div className={`h-full rounded-full ${theme.progressBar} transition-all duration-500`} style={{ width: i + 1 < stepNum ? "100%" : i + 1 === stepNum ? "45%" : "0%" }} />
              </div>
            ))}
          </div>
        )}

        {/* 1 · servicio */}
        {!done && step === 0 && (
          <div className="pop-in grid gap-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-inkmute">1 · Elegí un servicio</p>
              {biz.services.length > 0 && (
                <span className="text-[11px] font-bold text-inkmute">
                  {filteredServices.length} de {biz.services.length} servicio{biz.services.length === 1 ? "" : "s"}
                </span>
              )}
            </div>

            {biz.services.length > 4 && (
              <div className="relative">
                <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-inkmute" />
                <input
                  type="text"
                  placeholder="Buscar servicio (ej: corte, uñas, masaje)..."
                  className="field !py-2 !pl-8 !text-xs !rounded-xl"
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                />
                {serviceSearch && (
                  <button
                    type="button"
                    onClick={() => setServiceSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-inkmute hover:text-ink"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}

            {biz.services.length === 0 ? (
              <p className="rounded-xl border-2 border-dashed border-ink/15 p-4 text-sm text-inkmute">
                Este negocio todavía no cargó sus servicios.
              </p>
            ) : filteredServices.length === 0 ? (
              <div className="rounded-xl border border-dashed border-ink/15 p-4 text-center">
                <p className="text-xs font-bold text-ink">No se encontró "{serviceSearch}"</p>
                <button
                  type="button"
                  onClick={() => setServiceSearch("")}
                  className="mt-1 text-xs font-bold text-evergreen hover:underline"
                >
                  Ver todos los servicios
                </button>
              </div>
            ) : (
              filteredServices.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setServiceId(s.id);
                    setStep(hasPros ? 1 : 2);
                  }}
                  className="group flex items-center justify-between gap-3 rounded-xl border-2 border-ink/10 bg-white/60 px-4 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-ink/50 hover:bg-white hover:shadow-sm"
                >
                  <span>
                    <span className="block font-display text-[15px] font-bold">{s.name}</span>
                    <span className="text-xs text-inkmute">{s.duration} min</span>
                  </span>
                  <span className="shrink-0 font-display text-[15px] font-bold text-ink">{fmtMoney(s.price)}</span>
                </button>
              ))
            )}
          </div>
        )}

        {/* 2 · profesional */}
        {!done && step === 1 && hasPros && (
          <div className="pop-in grid gap-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-inkmute">2 · ¿Con quién?</p>
              <button onClick={() => setStep(0)} className="rounded-lg px-2 py-1 text-xs font-bold text-inkmute transition-colors hover:text-ink">← Servicio</button>
            </div>
            {biz.professionals.map((p) => (
              <button key={p.id} onClick={() => { setProId(p.id); setStep(2); }}
                className="group flex items-center gap-3 rounded-xl border-2 border-ink/10 bg-white/60 px-4 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-ink/50 hover:bg-white hover:shadow-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-full font-display text-sm font-extrabold text-ink" style={{ background: p.color }}>
                  {p.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                </span>
                <span>
                  <span className="block font-display text-[15px] font-bold">{p.name}</span>
                  <span className="text-xs text-inkmute">{p.role}</span>
                </span>
                <IconChevron className="ml-auto h-4 w-4 text-ink/30 transition-transform group-hover:translate-x-1 group-hover:text-ink" />
              </button>
            ))}
          </div>
        )}

        {/* fecha */}
        {!done && step === 2 && (
          <div className="pop-in">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-inkmute">{stepNum} · Elegí el día</p>
              <button onClick={() => setStep(hasPros ? 1 : 0)} className="rounded-lg px-2 py-1 text-xs font-bold text-inkmute transition-colors hover:text-ink">← {hasPros ? "Profesional" : "Servicio"}</button>
            </div>

            {/* Atajos rápidos de fecha */}
            <div className="mb-4">
              <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-inkmute">⚡ Atajos rápidos</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Hoy", date: dateKey(new Date()) },
                  { label: "Mañana", date: dateKey(addDays(new Date(), 1)) },
                  { label: "Pasado mañana", date: dateKey(addDays(new Date(), 2)) },
                ].map((s) => {
                  const closed = isClosed(s.date);
                  return (
                    <button
                      key={s.label}
                      type="button"
                      disabled={closed}
                      onClick={() => {
                        setSelectedDate(s.date);
                        setTime(null);
                        setWlDone(false);
                        setShowWlForm(false);
                        setStep(3);
                      }}
                      className={`btn-press flex flex-col items-center justify-center rounded-xl border-2 p-2.5 text-center transition-all ${
                        closed
                          ? "opacity-35 cursor-not-allowed border-ink/10 bg-ink/5 text-inkmute"
                          : selectedDate === s.date
                          ? theme.activeSlot
                          : "border-ink/12 bg-white/70 hover:border-ink/50 hover:bg-white hover:shadow-sm"
                      }`}
                    >
                      <span className="font-display text-xs font-bold leading-tight">{s.label}</span>
                      <span className="mt-0.5 text-[10px] text-inkmute">{closed ? (s.date === todayKey ? "Finalizado" : "Cerrado") : s.date.slice(8) + "/" + s.date.slice(5, 7)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-dashed border-ink/10">
              <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-inkmute">📅 O elegí en el calendario</p>
              <MonthPicker cursor={cursor} setCursor={setCursor} selected={selectedDate}
                onSelect={(key) => { setSelectedDate(key); setTime(null); setWlDone(false); setShowWlForm(false); setStep(3); }}
                isClosed={isClosed}
                theme={theme}
                maxAdvanceDays={maxAdvanceDays} />
            </div>
          </div>
        )}

        {/* hora + datos */}
        {!done && step === 3 && selectedDate && (
          <div className="pop-in">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-inkmute">
                {stepNum} · Horario para el <span className="font-bold text-ink">{fmtLong(selectedDate)}</span>
              </p>
              <button onClick={() => setStep(2)} className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-inkmute transition-colors hover:text-ink">← Día</button>
            </div>

            {slots.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-coral/30 bg-coral/5 p-4 text-center">
                <p className="font-display text-sm font-bold text-ink">
                  {selectedDate === todayKey
                    ? "Por hoy ya no quedan turnos disponibles (finalizó el horario de atención o ya pasaron las horas)."
                    : `Ese día ${user.business} no atiende.`}
                </p>
                <p className="mt-1 text-xs text-inkmute">
                  Elegí mañana u otra fecha en el calendario para reservar con tranquilidad.
                </p>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="mt-3 btn-press inline-flex items-center gap-1.5 rounded-full bg-evergreen px-4 py-2 font-display text-xs font-bold text-lime hover:bg-pine"
                >
                  ← Elegir otro día en el calendario
                </button>
              </div>
            ) : time && !showAllSlots ? (
              <div className="flex items-center justify-between rounded-2xl border-2 border-fern/30 bg-fern/10 p-3.5 text-ink shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-14 flex-col items-center justify-center rounded-xl bg-evergreen text-lime font-display font-extrabold text-sm leading-none shadow-sm">
                    {time}
                    <span className="mt-0.5 text-[9px] uppercase tracking-wider text-lime/70 font-semibold">{service?.duration ?? 30}m</span>
                  </span>
                  <div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-fern">
                      <IconCheck className="h-3.5 w-3.5" /> Horario elegido
                    </span>
                    <p className="font-display text-sm font-bold text-ink">{fmtLong(selectedDate)} a las {time} hs</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAllSlots(true)}
                  className="btn-press rounded-full border border-ink/20 bg-white px-3 py-1.5 font-display text-xs font-bold text-ink hover:border-ink hover:bg-ink/5 shadow-sm"
                >
                  Cambiar horario
                </button>
              </div>
            ) : (
              <>
                {time && showAllSlots && (
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-inkmute">Elegí otro horario:</span>
                    <button
                      type="button"
                      onClick={() => setShowAllSlots(false)}
                      className="text-xs font-bold text-fern hover:underline"
                    >
                      Mantener {time} hs ✕
                    </button>
                  </div>
                )}
                {hasBreak && breakInfo ? (
                  <div className="space-y-3">
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest text-inkmute">
                          <IconSun className="h-3.5 w-3.5 text-amber-500" /> Mañana · hasta el corte
                        </span>
                        <span className="text-[10px] font-bold text-inkmute">
                          {slots.filter((t) => t < (breakInfo.to ?? "99:99") && !takenTimes(selectedDate ?? "").includes(t)).length} disponibles
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                        {slots.filter((t) => t < (breakInfo.to ?? "99:99")).map((t) => slotBtn(t))}
                      </div>
                    </div>
                    <p className="flex items-center gap-3 text-center text-[11px] font-extrabold uppercase tracking-widest text-coral">
                      <span className="h-px flex-1 bg-coral/40" />
                      ✂ Corte · {breakInfo.to} a {breakInfo.from2}
                      <span className="h-px flex-1 bg-coral/40" />
                    </p>
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest text-inkmute">
                          <IconMoon className="h-3.5 w-3.5 text-indigo-500" /> Tarde · después del corte
                        </span>
                        <span className="text-[10px] font-bold text-inkmute">
                          {slots.filter((t) => t >= (breakInfo.to ?? "99:99") && !takenTimes(selectedDate ?? "").includes(t)).length} disponibles
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                        {slots.filter((t) => t >= (breakInfo.to ?? "99:99")).map((t) => slotBtn(t))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase tracking-widest text-inkmute">Horarios disponibles</span>
                      <span className="text-[10px] font-bold text-inkmute">
                        {slots.filter((t) => !takenTimes(selectedDate ?? "").includes(t)).length} libres
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">{slots.map((t) => slotBtn(t))}</div>
                  </div>
                )}
              </>
            )}

            {/* lista de espera */}
            {!allTaken && !showWlForm && !wlDone && slots.length > 0 && (
              <button onClick={() => setShowWlForm(true)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink/20 py-2.5 text-sm font-bold text-inkmute transition-all duration-200 hover:border-coral hover:text-coral">
                <IconUsers className="h-4 w-4" /> ¿Ningún horario te sirve? Anotate en la lista de espera
              </button>
            )}
            {(allTaken || showWlForm) && !wlDone && (
              <div className="pop-in mt-4 rounded-xl border-2 border-coral/40 bg-coral/5 p-4">
                <p className="flex items-center gap-2 font-display text-[15px] font-extrabold text-ink">
                  <IconUsers className="h-4 w-4 text-coral" /> {allTaken ? "Ese día está completo 😅" : "Lista de espera"}
                </p>
                <p className="mt-1 text-sm text-inkmute">
                  {allTaken ? "Dejanos tus datos y te avisamos apenas se libere un cupito." : `Dejanos tus datos para el ${fmtLong(selectedDate)} y te avisamos apenas se libere un cupito.`}
                </p>
                <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  <input className="field" placeholder="Tu nombre *" value={wlClient} onChange={(e) => setWlClient(e.target.value)} />
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-extrabold text-ink/40">
                      🇦🇷 +54 9
                    </span>
                    <input
                      className="field !pl-16 font-mono text-sm font-semibold"
                      type="tel"
                      inputMode="numeric"
                      placeholder="11 5555-0000 (sin 0 ni 15) *"
                      value={wlPhoneVal.formatted || wlPhone}
                      onChange={(e) => setWlPhone(cleanPhoneDigits(e.target.value))}
                    />
                  </div>
                </div>
                {wlError && <p className="mt-2 text-xs font-semibold text-coral">{wlError}</p>}
                <button onClick={joinWaitlist} className="mt-3 w-full rounded-xl bg-coral py-3 font-display text-sm font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[5px_6px_0_rgba(255,122,89,0.3)]">
                  Anotarme en la lista de espera
                </button>
              </div>
            )}
            {(allTaken || showWlForm) && wlDone && (
              <div className="pop-in mt-4 rounded-xl border-2 border-limedeep/60 bg-lime/15 p-4 text-center">
                <p className="font-display text-[15px] font-extrabold text-ink">¡Listo! Estás en la lista 🎉</p>
                <p className="mt-1 text-sm text-inkmute">Te avisamos al <strong className="text-ink font-bold">{wlPhoneVal.formatted || wlPhone}</strong> si se libera un lugar el {fmtLong(selectedDate)}.</p>
              </div>
            )}

            {time && monthLimitReached && (
              <div className="pop-in mt-4 rounded-2xl border-2 border-amber-500/40 bg-amber-50 p-5 text-center">
                <p className="font-display text-base font-extrabold text-ink">Este mes el local completó sus reservas online</p>
                <p className="mt-1 text-sm text-inkmute">Anotate en la lista de espera y te avisamos si se libera un lugar.</p>
                <button
                  type="button"
                  onClick={() => { setShowWlForm(true); setWlClient(client); setWlPhone(phone); }}
                  className="mt-3 w-full rounded-xl bg-evergreen py-3 font-display text-sm font-bold text-lime transition-all hover:-translate-y-0.5 hover:bg-pine"
                >
                  Anotarme en la lista de espera
                </button>
              </div>
            )}

            {time && !monthLimitReached && (
              <div id="booking-client-form" className="pop-in mt-4 space-y-3.5">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-inkmute">Tu nombre *</label>
                  <input className="field" placeholder="Ana Torres" value={client} onChange={(e) => setClient(e.target.value)} />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase tracking-wider text-inkmute">
                      Teléfono celular <span className="normal-case font-semibold text-ink/60">(sin 0 ni 15)</span> *
                    </label>
                    {phoneVal.badgeType === "valid" ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        WhatsApp listo ✓
                      </span>
                    ) : phoneVal.badgeType === "warning" ? (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                        {phoneVal.hint}
                      </span>
                    ) : null}
                  </div>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-extrabold text-ink/40">
                      🇦🇷 +54 9
                    </span>
                    <input
                      className="field !pl-20 font-mono text-sm font-semibold tracking-wide"
                      type="tel"
                      inputMode="numeric"
                      placeholder="11 5555-0000"
                      value={phoneVal.formatted || phone}
                      onChange={(e) => {
                        const clean = cleanPhoneDigits(e.target.value);
                        setPhone(clean);
                      }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-inkmute">
                    {phoneVal.badgeType === "empty" ? "Ingresá tu código de área sin 0 (ej. 11 para Bs As, 351 para Córdoba) y celular sin 15." : phoneVal.hint}
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-inkmute">Email <span className="normal-case text-ink/40">(te confirma + te recuerda 24 h antes)</span></label>
                  <input className="field" type="email" placeholder="ana@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>

                {/* tienda */}
                {paid && biz.products.length > 0 && (
                  <button type="button" onClick={() => setShowShop(true)}
                    className="group flex w-full items-center justify-between gap-3 rounded-xl border-2 border-ink/15 bg-white px-4 py-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-ink/40 hover:shadow-sm">
                    <span className="flex items-center gap-2.5">
                      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${theme.badgeBg} ${theme.badgeText}`}><IconBag className="h-4 w-4" /></span>
                      <span>
                        <span className="block font-display text-[15px] font-extrabold text-ink">¿Querés agregar algo a tu turno?</span>
                        <span className="block text-xs text-inkmute">
                          {itemCount > 0 ? `${itemCount} producto${itemCount === 1 ? "" : "s"} · ${fmtMoney(productsTotal)}` : `${biz.products.length} productos disponibles · tocá para ver la tienda`}
                        </span>
                      </span>
                    </span>
                    <span className="flex items-center gap-2 font-display text-sm font-bold text-ink">
                      {itemCount > 0 && <span className={`flex h-6 min-w-6 items-center justify-center rounded-full ${theme.badgeBg} ${theme.badgeText} px-1.5 text-xs font-bold`}>{itemCount}</span>}
                      Ver tienda <IconChevron className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                    </span>
                  </button>
                )}

                {/* cupón */}
                {paid && biz.coupons.some((c) => c.active) && (
                  <div className="rounded-xl border-2 border-ink/10 bg-white/60 p-4">
                    <label className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-inkmute">
                      <IconTicket className="h-4 w-4 text-coral" /> ¿Tenés un cupón? <span className="normal-case text-ink/40">(opcional)</span>
                    </label>
                    <div className="flex gap-2">
                      <input className="field flex-1 uppercase placeholder:normal-case" placeholder="MARTES20" value={couponInput} onChange={(e) => setCouponInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyCoupon(); } }} />
                      <button type="button" onClick={applyCoupon} className={`shrink-0 rounded-xl ${theme.primaryBtn} px-4 font-display text-sm font-bold transition-all hover:-translate-y-0.5 shadow-sm`}>Aplicar</button>
                    </div>
                    {couponMsg && <p className={`mt-1.5 text-xs font-semibold ${couponMsg.ok ? "text-fern" : "text-coral"}`}>{couponMsg.text}</p>}
                  </div>
                )}

                {/* resumen */}
                <div className="space-y-1.5 rounded-xl border-2 border-dashed border-ink/20 bg-ink/[0.03] px-4 py-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-inkmute">{service?.name}{pro ? ` · con ${pro.name.split(" ")[0]}` : ""}</span>
                    <span className="font-display font-bold">{service ? fmtMoney(service.price) : ""}</span>
                  </div>
                  {productsTotal > 0 && (
                    <div className="flex justify-between gap-3">
                      <span className="text-inkmute">Productos ({itemCount})</span>
                      <span className="font-display font-bold">{fmtMoney(productsTotal)}</span>
                    </div>
                  )}
                  {discount > 0 && coupon && (
                    <div className="flex justify-between gap-3 text-fern">
                      <span className="flex items-center gap-1.5"><IconTicket className="h-3.5 w-3.5" /> Cupón {coupon.code} (−{coupon.pct}%)</span>
                      <span className="font-display font-bold">−{fmtMoney(discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-3 border-t border-ink/10 pt-1.5">
                    <span className="font-bold text-ink">{fmtLong(selectedDate)} · {time}</span>
                    <span className="font-display font-extrabold">{fmtMoney(total)}</span>
                  </div>
                  {depositOn ? (
                    <p className="pt-1 text-xs text-ink/70">
                      Pagás ahora una <strong className="text-ink font-bold">seña del {settings.depositPct}% ({fmtMoney(deposit)})</strong> por transferencia y el resto en el local. Si cancelás con 24 h de anticipación, se devuelve.
                    </p>
                  ) : (
                    <p className="pt-1 text-xs text-ink/70">Pagás en el local. Sin seña, sin sorpresas.</p>
                  )}
                </div>

                {error && <p className="shake rounded-lg border-2 border-coral/40 bg-coral/10 px-3 py-2 text-xs font-semibold text-coral">{error}</p>}
                <button onClick={confirm} className={`w-full rounded-xl ${theme.primaryBtn} py-3.5 font-display text-base font-bold transition-all duration-200 hover:-translate-y-0.5 shadow-md active:translate-y-0`}>
                  {depositOn ? `Confirmar y pagar seña (${fmtMoney(deposit)}) →` : "Confirmar turno →"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* éxito */}
        {done && selectedDate && time && service && (
          <div id="booking-confirmed-ticket" className="pop-in relative py-3 text-center">
            <ConfettiBurst />

            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 shadow-sm">
              <IconCheck className="h-8 w-8 stroke-[3]" />
            </div>

            <h4 className="font-display text-2xl font-extrabold text-ink">
              {claimed ? "¡Turno reservado!" : "¡Tu turno está confirmado!"}
            </h4>
            <p className="mt-1 text-xs text-inkmute">
              Te esperamos en <strong className="text-ink font-bold">{user.business}</strong>
            </p>
            {email.trim() !== "" && (
              <p className="mx-auto mt-2 max-w-sm rounded-full bg-fern/10 px-3 py-1.5 text-[11px] font-semibold text-fern">
                📩 Confirmación enviada a {email.trim()} + recordatorio 24 h antes
              </p>
            )}

            {/* Tarjeta de comprobante limpio */}
            <div className="mx-auto mt-4 max-w-sm rounded-2xl border-2 border-dashed border-ink/15 bg-white p-4 text-left shadow-sm">
              <div className="flex items-center justify-between gap-2 border-b border-ink/10 pb-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 font-display text-[11px] font-extrabold uppercase tracking-wider text-emerald-800">
                  <IconCheck className="h-3 w-3 stroke-[3]" /> Turno agendado
                </span>
                <CopyButton
                  text={`Turno en ${user.business}: ${service.name} para ${client} el ${fmtLong(selectedDate)} a las ${time} hs.`}
                  label="Copiar datos"
                  copiedLabel="Copiado ✓"
                />
              </div>

              <div className="mt-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-inkmute">Servicio</span>
                  <span className="font-bold text-ink">{service.name}</span>
                </div>
                {pro && (
                  <div className="flex items-center justify-between">
                    <span className="text-inkmute">Profesional</span>
                    <span className="font-bold text-ink">{pro.name}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-inkmute">Día y horario</span>
                  <span className="font-bold text-ink">{fmtLong(selectedDate)} · {time} hs</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-inkmute">Cliente</span>
                  <span className="font-bold text-ink">{client}</span>
                </div>
                <div className="flex items-center justify-between border-t border-ink/10 pt-2 font-display text-sm font-extrabold">
                  <span>Total</span>
                  <span className="text-emerald-700">{fmtMoney(total)}</span>
                </div>
              </div>
            </div>

            {claimed && (
              <p className="mx-auto mt-3 max-w-sm rounded-xl border border-amber-500/30 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                Tu comprobante de seña está en revisión por {user.business}. Apenas se acredite, te avisamos por WhatsApp.
              </p>
            )}

            {/* Acciones principales limpias */}
            <div className="mx-auto mt-5 max-w-sm space-y-2.5">
              {settings.whatsapp && (
                <a
                  href={createWhatsAppUrl(settings.whatsapp, `Hola! Soy ${client}. Acabo de reservar ${service.name} para el ${fmtLong(selectedDate)} a las ${time} hs 🙌`)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-press flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-display text-sm font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors"
                >
                  <IconWhatsApp className="h-4 w-4" /> Abrir WhatsApp con el local
                </a>
              )}

              {/* Botones de Calendario: Google + Apple */}
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={gcalUrl({
                    title: `${service.name} — ${user.business}`,
                    date: selectedDate,
                    time,
                    duration: service.duration,
                  })}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-press flex items-center justify-center gap-1.5 rounded-xl border-2 border-ink/15 bg-white py-2.5 font-display text-xs font-bold text-ink shadow-sm hover:border-ink/40 transition-colors"
                >
                  <IconCalendar className="h-4 w-4 text-blue-600" /> Google Calendar
                </a>
                <button
                  type="button"
                  onClick={() => {
                    downloadIcs(icsContent({ title: `${service.name} — ${user.business}`, date: selectedDate, time, duration: service.duration, desc: `Turno en ${user.business}, reservado con Cupito.` }));
                    toast("Turno descargado para tu calendario 📅");
                  }}
                  className="btn-press flex items-center justify-center gap-1.5 rounded-xl border-2 border-ink/15 bg-white py-2.5 font-display text-xs font-bold text-ink shadow-sm hover:border-ink/40 transition-colors"
                >
                  <IconCalendar className="h-4 w-4 text-emerald-600" /> Apple (.ics)
                </button>
              </div>

              {/* Auto-cancelación por el cliente */}
              {!cancelFeedback ? (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("¿Seguro que deseás cancelar este turno? Liberaremos el horario para otra persona.")) {
                      if (confirmedId) {
                        const r = cancelBookingByClient(user.id, confirmedId, "Cancelado por el cliente desde el comprobante");
                        if (r.ok) {
                          setCancelFeedback("Tu turno ha sido cancelado con éxito. ¡Gracias por avisar con tiempo!");
                          toast("Turno cancelado ✓");
                        } else if (r.error === "FALTA_MENOS_24H") {
                          setCancelBlocked(true);
                        } else {
                          setError(r.error || "No se pudo cancelar. Probá de nuevo.");
                        }
                      }
                    }
                  }}
                  className="block w-full pt-1 text-center text-xs font-bold text-coral/80 hover:text-coral underline underline-offset-4 transition-colors"
                >
                  ¿No vas a poder asistir? Cancelá tu turno acá <span className="no-underline text-ink/40">(gratis hasta 24 h antes)</span>
                </button>
              ) : (
                <div className="rounded-xl border border-coral/30 bg-coral/10 p-3 text-xs font-bold text-coral text-center">
                  {cancelFeedback}
                </div>
              )}
              {cancelBlocked && !cancelFeedback && (
                <div className="rounded-xl border-2 border-amber-500/40 bg-amber-50 p-3 text-center">
                  <p className="text-xs font-bold text-amber-900">Faltan menos de 24 h: ya no se puede cancelar online y la seña no se devuelve.</p>
                  {settings.whatsapp ? (
                    <a href={createWhatsAppUrl(settings.whatsapp, `Hola! Soy ${client} y tengo turno el ${fmtLong(selectedDate || "")} a las ${time} hs. Necesito cambiarlo o cancelarlo 🙏`)} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 font-display text-xs font-bold text-white">
                      <IconWhatsApp className="h-3.5 w-3.5" /> Hablar con el local
                    </a>
                  ) : (
                    <p className="mt-1 text-[11px] text-amber-800">Comunicate directamente con {user.business}.</p>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={reset}
                className="w-full pt-2 font-display text-xs font-bold text-inkmute hover:text-ink transition-colors"
              >
                ← Reservar otro turno
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="border-t-2 border-dashed border-ink/10 px-6 py-3 text-center text-[11px] font-semibold text-inkmute">
        ⚡ Hecho con Cupito — reservás en 60 segundos, sin app y sin llamadas
      </p>

      {showCalHelp && (
        <CalendarHelpModal onClose={() => setShowCalHelp(false)} />
      )}

      {showShop && (
        <ShopOverlay products={biz.products} items={items} setQty={(id, q) => setItems((prev) => { const n = { ...prev }; if (q <= 0) delete n[id]; else n[id] = q; return n; })}
          total={productsTotal} count={itemCount} onClose={() => setShowShop(false)} />
      )}
      {showPay && (
        <TransferModal amount={deposit} settings={settings} business={user.business} onClose={() => setShowPay(false)} onSent={(txId) => finish({ claimTx: txId })} />
      )}
      {showLookupModal && (
        <LookupBookingsModal
          businessName={user.business}
          bookings={biz.bookings}
          services={biz.services}
          professionals={biz.professionals}
          whatsapp={settings.whatsapp}
          onCancelBooking={(bId) => {
            const r = cancelBookingByClient(user.id, bId, "Cancelado por el cliente desde Mis Turnos");
            if (r.ok) toast("Turno cancelado ✓ El horario fue liberado.");
            return r;
          }}
          onClose={() => setShowLookupModal(false)}
        />
      )}
    </div>
  );

  function slotBtn(t: string) {
    const busy = takenTimes(selectedDate ?? "").includes(t);
    return (
      <button key={t} disabled={busy} onClick={() => { setTime(t); setError(null); }}
        className={`rounded-lg border-2 py-2 font-display text-sm font-bold transition-all duration-150 ${busy ? "cursor-not-allowed border-ink/8 bg-ink/5 text-ink/25 line-through" : time === t ? theme.activeSlot : "border-ink/10 bg-white/60 hover:-translate-y-0.5 hover:border-ink/40"}`}>
        {t}
      </button>
    );
  }
}

/* Modal explicativo de sincronización con calendario del celular */
function CalendarHelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="pop-in max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border-2 border-ink/15 bg-paper p-6 shadow-2xl text-ink" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-ink/10 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-evergreen text-lime">
              <IconCalendar className="h-5 w-5" />
            </span>
            <h3 className="font-display text-lg font-extrabold text-ink">Cómo guardar tu turno en el celular</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-inkmute hover:bg-ink/5 hover:text-ink">
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-4 text-sm leading-relaxed">
          {/* Opción iPhone */}
          <div className="rounded-2xl border-2 border-ink/10 bg-white p-4">
            <p className="flex items-center gap-2 font-display text-base font-extrabold text-ink">
              🍏 En iPhone / iPad (Apple Calendar)
            </p>
            <ol className="mt-2 space-y-1.5 pl-5 list-decimal text-xs sm:text-sm text-ink/80">
              <li>Tocá el botón <strong>«Agregar a Apple Calendar (.ics)»</strong>.</li>
              <li>Tu iPhone abrirá la vista previa del evento con la fecha, hora y dirección del negocio.</li>
              <li>Tocá <strong>«Añadir a Calendario»</strong> (arriba a la derecha).</li>
              <li>¡Listo! El turno quedará guardado con alarmas 24 h y 1 h antes.</li>
            </ol>
          </div>

          {/* Opción Android */}
          <div className="rounded-2xl border-2 border-ink/10 bg-white p-4">
            <p className="flex items-center gap-2 font-display text-base font-extrabold text-ink">
              🤖 En Android / Google Calendar
            </p>
            <ol className="mt-2 space-y-1.5 pl-5 list-decimal text-xs sm:text-sm text-ink/80">
              <li>Tocá el botón <strong>«Abrir en Google Calendar»</strong>.</li>
              <li>Se abrirá la app o web de Google Calendar con todos los datos cargados.</li>
              <li>Tocá <strong>«Guardar»</strong> en la esquina superior.</li>
              <li>¡Listo! Tip: agregale notificación 24 h y 1 h antes así no te lo olvidás.</li>
            </ol>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-full bg-evergreen py-3 font-display text-sm font-bold text-lime hover:bg-pine transition-all"
        >
          Entendido, cerrar
        </button>
      </div>
    </div>
  );
}

/* ---------- tienda (pantalla completa) ---------- */
function ShopOverlay({ products, items, setQty, total, count, onClose }: {
  products: { id: string; name: string; price: number; desc: string }[];
  items: Record<string, number>;
  setQty: (id: string, q: number) => void;
  total: number;
  count: number;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q ? products.filter((p) => p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q)) : products;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[85] flex flex-col bg-ink/60 backdrop-blur-[3px]" onClick={onClose}>
      <div className="pop-in mx-auto flex h-full w-full max-w-2xl flex-col overflow-hidden bg-paper sm:my-6 sm:h-[calc(100%-3rem)] sm:rounded-[24px] sm:border-2 sm:border-ink/15" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b-2 border-dashed border-ink/10 bg-white px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-evergreen text-lime"><IconBag className="h-4 w-4" /></span>
            <div>
              <p className="font-display text-lg font-extrabold leading-tight text-ink">Nuestra tienda</p>
              <p className="text-xs text-inkmute">Sumalos a tu turno y retirá todo junto</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar tienda" className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink/15 text-inkmute transition-colors hover:border-coral hover:text-coral">✕</button>
        </div>
        <div className="border-b border-ink/8 bg-white px-5 py-3">
          <input className="field" placeholder={`Buscar entre ${products.length} productos…`} value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-inkmute">No encontramos nada con “{query}”. Probá con otra palabra.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filtered.map((p) => {
                const qty = items[p.id] ?? 0;
                return (
                  <div key={p.id} className={`card card-hover flex flex-col p-4 ${qty > 0 ? "!border-fern" : ""}`}>
                    <p className="font-display text-[15px] font-extrabold text-ink">{p.name}</p>
                    <p className="mt-0.5 flex-1 text-xs leading-snug text-inkmute">{p.desc}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="font-display text-lg font-extrabold text-fern">{fmtMoney(p.price)}</span>
                      {qty === 0 ? (
                        <button onClick={() => setQty(p.id, 1)} className="flex items-center gap-1.5 rounded-full bg-evergreen px-4 py-2 font-display text-xs font-bold text-lime transition-all hover:-translate-y-0.5 hover:bg-pine">
                          <IconPlus className="h-3.5 w-3.5" /> Agregar
                        </button>
                      ) : (
                        <span className="flex items-center gap-2">
                          <button onClick={() => setQty(p.id, qty - 1)} aria-label={`Quitar ${p.name}`} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink/15 font-display text-base font-bold text-ink transition-all hover:border-coral hover:text-coral">−</button>
                          <span className="w-5 text-center font-display text-base font-extrabold text-fern">{qty}</span>
                          <button onClick={() => setQty(p.id, qty + 1)} aria-label={`Agregar más ${p.name}`} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink/15 font-display text-base font-bold text-ink transition-all hover:border-evergreen hover:bg-evergreen hover:text-lime">+</button>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t-2 border-ink/10 bg-evergreen px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-paper/60">{count} producto{count === 1 ? "" : "s"} en tu turno</p>
            <p className="font-display text-2xl font-extrabold text-lime">{fmtMoney(total)}</p>
          </div>
          <button onClick={onClose} className="rounded-full bg-lime px-6 py-3 font-display text-sm font-bold text-ink transition-all hover:-translate-y-0.5 hover:bg-limedeep">
            {count > 0 ? "Listo, seguir con mi turno" : "Volver a la reserva"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- seña por transferencia ---------- */
function TransferModal({ amount, settings, business, onClose, onSent }: {
  amount: number; settings: BizSettings; business: string; onClose: () => void; onSent: (txId: string) => void;
}) {
  const [txId, setTxId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const hasData = !!(settings.transferAlias || settings.transferCBU);

  const send = () => {
    if (txId.trim().length < 4) return setErr("Pegá el número de comprobante de tu transferencia.");
    onSent(txId.trim());
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-ink/60 p-4 backdrop-blur-[2px] sm:items-center" onClick={onClose}>
      <div className="pop-in w-full max-w-md rounded-[22px] border-2 border-ink/15 bg-card p-6 text-ink shadow-block sm:p-7" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-2xl font-extrabold">Pagar seña</h3>
            <p className="mt-1 text-sm text-inkmute">{business} · <strong className="text-fern">{fmtMoney(amount)}</strong></p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink/15 text-inkmute transition-colors hover:border-coral hover:text-coral">✕</button>
        </div>

        <div className="mt-5 space-y-4">
          {hasData ? (
            <div className="rounded-xl border-2 border-dashed border-limedeep/70 bg-lime/15 p-4 text-sm">
              <p className="font-display text-[15px] font-extrabold text-ink">1 · Transferí el monto exacto a:</p>
              {settings.transferAlias && <p className="mt-2 text-ink/85">Alias: <strong className="font-mono font-bold">{settings.transferAlias}</strong></p>}
              {settings.transferCBU && <p className="text-ink/85">CBU/CVU: <strong className="font-mono">{settings.transferCBU}</strong></p>}
              {settings.transferHolder && <p className="text-ink/85">Titular: <strong>{settings.transferHolder}</strong></p>}
              <p className="mt-2 text-xs font-semibold text-fern">Monto exacto: {fmtMoney(amount)}</p>
            </div>
          ) : (
            <div className="rounded-xl border-2 border-coral/40 bg-coral/5 p-4 text-sm text-ink/80">
              {business} todavía no cargó sus datos de transferencia en Cupito. Escribiles para coordinar la seña.
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-inkmute">2 · Pegá el Nº de comprobante de tu transferencia *</label>
            <input className="field font-mono" placeholder="Ej: 0023-458912-7" value={txId} onChange={(e) => setTxId(e.target.value)} disabled={!hasData} />
            <p className="mt-1 text-[11px] leading-snug text-inkmute">
              Lo encontrás en el detalle de la transferencia, en tu app del banco. {business} verifica que el dinero haya llegado y confirma tu turno.
            </p>
          </div>

          {err && <p className="shake rounded-lg border-2 border-coral/40 bg-coral/10 px-3 py-2 text-xs font-semibold text-coral">{err}</p>}
          <button onClick={send} disabled={!hasData}
            className="w-full rounded-xl bg-coral py-3.5 font-display text-base font-bold text-white transition-all enabled:hover:-translate-y-0.5 enabled:hover:shadow-[5px_6px_0_rgba(255,122,89,0.3)] disabled:cursor-not-allowed disabled:opacity-50">
            Ya transferí — enviar comprobante
          </button>
          <p className="text-center text-[11px] leading-snug text-inkmute">Tu turno queda reservado como «pendiente» hasta que el negocio verifique la transferencia.</p>
        </div>
      </div>
    </div>
  );
}

function LookupBookingsModal({
  businessName,
  bookings,
  services,
  professionals,
  whatsapp,
  onCancelBooking,
  onClose,
}: {
  businessName: string;
  bookings: Booking[];
  services: Service[];
  professionals: Professional[];
  whatsapp?: string;
  onCancelBooking: (id: string) => { ok: boolean; error?: string };
  onClose: () => void;
}) {
  const [inputPhone, setInputPhone] = useState("");
  const [blockedMsg, setBlockedMsg] = useState(false);
  const phoneVal = normalizeArgentinaPhone(inputPhone);
  const nowKey = dateKey(new Date());

  const matched = useMemo(() => {
    if (phoneVal.cleanDigits.length < 6) return [];
    const queryDigits = phoneVal.cleanDigits.slice(-8);
    return bookings.filter(
      (b) =>
        b.phone.replace(/\D/g, "").endsWith(queryDigits) &&
        b.date >= nowKey &&
        b.status !== "cancelada"
    );
  }, [bookings, phoneVal.cleanDigits, nowKey]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/65 p-4 backdrop-blur-[3px]" onClick={onClose}>
      <div className="pop-in w-full max-w-md rounded-[22px] border-2 border-ink/15 bg-card p-6 text-ink shadow-block sm:p-7" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-ink/10 pb-4">
          <div>
            <h3 className="font-display text-xl font-extrabold text-ink">Mis turnos en {businessName}</h3>
            <p className="mt-0.5 text-xs text-inkmute">Consultá tus próximas citas o cancelá gratis hasta 24 h antes.</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="flex h-8 w-8 items-center justify-center rounded-full border border-ink/15 text-inkmute hover:border-coral hover:text-coral transition-colors">✕</button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-inkmute">
              Ingresá tu número de celular <span className="normal-case font-semibold text-ink/60">(sin 0 ni 15)</span>
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-extrabold text-ink/40">
                🇦🇷 +54 9
              </span>
              <input
                className="field !pl-20 font-mono text-sm font-semibold"
                type="tel"
                inputMode="numeric"
                placeholder="11 5555-0000"
                value={phoneVal.formatted || inputPhone}
                onChange={(e) => setInputPhone(cleanPhoneDigits(e.target.value))}
                autoFocus
              />
            </div>
            <p className="mt-1 text-[11px] text-inkmute">
              {phoneVal.cleanDigits.length < 6 ? "Ingresá al menos tu número (ej: 11 4567-8901) para buscar tus turnos." : phoneVal.hint}
            </p>
          </div>

          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
            {phoneVal.cleanDigits.length >= 6 && matched.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-ink/10 bg-white/60 p-5 text-center text-xs text-inkmute">
                No encontramos turnos activos para este número en {businessName}.
              </div>
            ) : null}

            {matched.map((b) => {
              const srv = services.find((s) => s.id === b.serviceId);
              const pro = professionals.find((p) => p.id === b.proId);
              return (
                <div key={b.id} className="rounded-xl border-2 border-ink/10 bg-white p-3.5 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm font-bold text-ink">{srv?.name || "Servicio"}</span>
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-800">Confirmado</span>
                  </div>
                  <div className="text-xs text-inkmute flex flex-wrap justify-between gap-1">
                    <span>📅 {fmtLong(b.date)} a las <strong>{b.time} hs</strong></span>
                    {pro && <span>con {pro.name}</span>}
                  </div>
                  <div className="pt-2 border-t border-ink/8 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm("¿Seguro que deseás cancelar este turno?")) {
                          const r = onCancelBooking(b.id);
                          if (!r.ok && r.error === "FALTA_MENOS_24H") setBlockedMsg(true);
                        }
                      }}
                      className="rounded-lg border border-coral/30 bg-coral/10 px-3 py-1.5 font-display text-xs font-bold text-coral hover:bg-coral hover:text-white transition-all"
                    >
                      Cancelar turno
                    </button>
                  </div>
                </div>
              );
            })}
            {blockedMsg && (
              <div className="rounded-xl border-2 border-amber-500/40 bg-amber-50 p-3 text-center">
                <p className="text-xs font-bold text-amber-900">Faltan menos de 24 h: la cancelación online está cerrada.</p>
                {whatsapp ? (
                  <a href={createWhatsAppUrl(whatsapp, `Hola! Soy cliente de ${businessName} y necesito cambiar o cancelar un turno 🙏`)} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 font-display text-xs font-bold text-white">
                    Hablar con el local
                  </a>
                ) : (
                  <p className="mt-1 text-[11px] text-amber-800">Comunicate directamente con el local.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
