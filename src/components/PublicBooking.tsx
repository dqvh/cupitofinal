import { useEffect, useMemo, useState } from "react";
import {
  useStore, dateKey, addDays, fmtMoney, fmtLong, slotsForDay, dayOfWeek, isPaid,
  type User, type BizData, type BizSettings, type Coupon,
} from "../lib/store";
import { IconCheck, IconCalendar, IconChevron, IconBag, IconTicket, IconPlus, IconUsers, IconWhatsApp, LogoMark } from "./kit";

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
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Cupito//Reservas//ES", "BEGIN:VEVENT", `UID:${Date.now()}@cupito.app`, `DTSTART:${toLocalStamp(start)}`, `DTEND:${toLocalStamp(end)}`, `SUMMARY:${o.title}`, `DESCRIPTION:${o.desc}`, "BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", "DESCRIPTION:Recordatorio de tu turno", "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
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
function MonthPicker({ cursor, setCursor, selected, onSelect, isClosed }: {
  cursor: Date; setCursor: (d: Date) => void; selected: string | null; onSelect: (k: string) => void; isClosed: (k: string) => boolean;
}) {
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const now = new Date();
  const nowMonth = now.getFullYear() * 12 + now.getMonth();
  const curMonth = year * 12 + month;
  const pad = (new Date(year, month, 1).getDay() + 6) % 7;
  const total = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array.from({ length: pad }, () => null), ...Array.from({ length: total }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const label = cursor.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  return (
    <div>
      <div className="flex items-center justify-between">
        <button type="button" disabled={curMonth <= nowMonth} onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="Mes anterior"
          className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink/12 bg-white/60 text-ink transition-all enabled:hover:-translate-x-0.5 enabled:hover:border-evergreen enabled:hover:text-evergreen disabled:opacity-30">
          <IconChevron className="h-4 w-4 rotate-180" />
        </button>
        <p className="font-display text-base font-extrabold capitalize text-ink">{label}</p>
        <button type="button" disabled={curMonth >= nowMonth + 2} onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="Mes siguiente"
          className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink/12 bg-white/60 text-ink transition-all enabled:hover:translate-x-0.5 enabled:hover:border-evergreen enabled:hover:text-evergreen disabled:opacity-30">
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
          const closed = isClosed(key);
          const sel = key === selected;
          const disabled = past || closed;
          return (
            <button type="button" key={key} disabled={disabled} onClick={() => onSelect(key)}
              className={`relative flex aspect-square items-center justify-center rounded-lg border-2 font-display text-sm font-bold transition-all duration-150 ${sel ? "border-evergreen bg-evergreen text-lime shadow-[3px_3px_0_rgba(205,244,99,0.5)]" : disabled ? "cursor-not-allowed border-transparent bg-ink/[0.04] text-ink/25" : "border-ink/10 bg-white/60 text-ink hover:-translate-y-0.5 hover:border-evergreen"}`}>
              {d}
              {closed && !past && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-coral/60" />}
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
export default function PublicBooking({ owner }: { owner?: ({ user: User } & Record<"data", BizData>) | null } = {}) {
  const store = useStore();
  const user = owner ? owner.user : store.user;
  const biz = owner ? owner.data : store.data;
  const { addBookingFor, addWaitlist, toast } = store;

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
  const [claimed, setClaimed] = useState(false);
  const [wlClient, setWlClient] = useState("");
  const [wlPhone, setWlPhone] = useState("");
  const [wlDone, setWlDone] = useState(false);
  const [wlError, setWlError] = useState<string | null>(null);
  const [showWlForm, setShowWlForm] = useState(false);

  if (!user || !biz) return null;

  const paid = isPaid(user);
  const settings = biz.settings;
  const hasPros = biz.professionals.length > 0;
  const depositOn = paid && settings.depositEnabled && settings.depositPct > 0;
  const service = biz.services.find((s) => s.id === serviceId);
  const pro = biz.professionals.find((p) => p.id === proId);

  const hoursFor = (key: string) => settings.hours[dayOfWeek(key)];
  const isClosed = (key: string) => !hoursFor(key).open;
  const slots = selectedDate ? slotsForDay(hoursFor(selectedDate)) : [];
  const takenTimes = (key: string) => biz.bookings.filter((b) => b.date === key && b.status !== "cancelada").map((b) => b.time);
  const allTaken = slots.length > 0 && slots.every((t) => takenTimes(selectedDate ?? "").includes(t));
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
    const err = addWaitlist({ date: selectedDate, serviceId, client: wlClient, phone: wlPhone });
    if (err) return setWlError(err);
    setWlError(null);
    setWlDone(true);
    if (owner === undefined) toast(`Nueva persona en lista de espera: ${wlClient.trim()} 👀`);
  };

  const confirm = () => {
    if (client.trim().length < 2) return setError("Poné tu nombre para confirmar.");
    if (phone.replace(/\D/g, "").length < 8) return setError("Necesitamos un teléfono válido para coordinar.");
    if (email.trim() !== "" && !/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Ese email no parece válido (o dejalo vacío).");
    if (!serviceId || !selectedDate || !time) return setError("Falta elegir servicio, día y hora.");
    setError(null);
    if (depositOn && deposit > 0) setShowPay(true);
    else finish({});
  };

  const finish = (opts: { claimTx?: string }) => {
    if (!serviceId || !selectedDate || !time) return;
    const res = addBookingFor(user.id, {
      client, phone, serviceId, date: selectedDate, time, source: "online",
      items: bookingItems.length ? bookingItems : undefined,
      proId: proId ?? undefined,
      status: opts.claimTx ? "pendiente" : undefined,
      depositClaim: opts.claimTx ? { txId: opts.claimTx, sentAt: Date.now() } : undefined,
    });
    if (!res.ok) { setShowPay(false); return setError(res.error); }
    setShowPay(false);
    setClaimed(!!opts.claimTx);
    setDone(true);
    if (owner === undefined)
      toast(opts.claimTx ? `Nueva reserva de ${client.trim()} — seña pendiente de verificación 💸` : `¡Nueva reserva de ${client.trim()}! Ya está en tu agenda 🎉`);
  };

  const reset = () => {
    setStep(0); setServiceId(null); setProId(null); setSelectedDate(null); setTime(null);
    setClient(""); setPhone(""); setEmail(""); setItems({}); setError(null); setDone(false);
    setCouponInput(""); setCoupon(null); setCouponMsg(null); setShowPay(false); setClaimed(false);
    setWlClient(""); setWlPhone(""); setWlDone(false); setWlError(null); setShowWlForm(false);
  };

  const stepNum = step === 0 ? 1 : step === 1 ? 2 : step === 2 ? (hasPros ? 3 : 2) : hasPros ? 4 : 3;
  const totalSteps = hasPros ? 4 : 3;

  return (
    <div className="overflow-hidden rounded-[22px] border-2 border-ink/15 bg-card text-ink shadow-block-ink">
      {/* cabecera */}
      <div className="relative bg-evergreen px-5 pb-8 pt-5 text-paper sm:px-6">
        <div className="gridlines absolute inset-0" aria-hidden="true" />
        <div className="relative flex items-center justify-between gap-2">
          <span className="inline-flex min-w-0 items-center gap-2 rounded-full bg-paper/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-lime">
            <LogoMark className="h-4 w-4 shrink-0 text-lime" />
            <span className="truncate">cupito.app/{user.slug}</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-bold text-paper/70">
            <span className="blinkdot h-1.5 w-1.5 rounded-full bg-lime" /> Abierto 24/7
          </span>
        </div>
        <h3 className="relative mt-4 font-display text-2xl font-extrabold">{user.business}</h3>
        <p className="relative text-sm text-paper/65">Reservá tu cupito en menos de un minuto · sin llamadas</p>
      </div>

      <div className="px-4 py-5 sm:px-6">
        {/* progreso */}
        {!done && (
          <div className="mb-4 flex items-center gap-1.5" aria-hidden="true">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10">
                <div className="h-full rounded-full bg-evergreen transition-all duration-500" style={{ width: i + 1 < stepNum ? "100%" : i + 1 === stepNum ? "45%" : "0%" }} />
              </div>
            ))}
          </div>
        )}

        {/* 1 · servicio */}
        {!done && step === 0 && (
          <div className="pop-in grid gap-2.5">
            <p className="text-xs font-bold uppercase tracking-wider text-inkmute">1 · Elegí un servicio</p>
            {biz.services.length === 0 && <p className="rounded-xl border-2 border-dashed border-ink/15 p-4 text-sm text-inkmute">Este negocio todavía no cargó sus servicios.</p>}
            {biz.services.map((s) => (
              <button key={s.id} onClick={() => { setServiceId(s.id); setStep(hasPros ? 1 : 2); }}
                className="group flex items-center justify-between gap-3 rounded-xl border-2 border-ink/10 bg-white/60 px-4 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-evergreen hover:shadow-[4px_4px_0_rgba(12,36,28,0.1)]">
                <span>
                  <span className="block font-display text-[15px] font-bold">{s.name}</span>
                  <span className="text-xs text-inkmute">{s.duration} min</span>
                </span>
                <span className="shrink-0 font-display text-[15px] font-bold text-fern">{fmtMoney(s.price)}</span>
              </button>
            ))}
          </div>
        )}

        {/* 2 · profesional */}
        {!done && step === 1 && hasPros && (
          <div className="pop-in grid gap-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-inkmute">2 · ¿Con quién?</p>
              <button onClick={() => setStep(0)} className="rounded-lg px-2 py-1 text-xs font-bold text-inkmute transition-colors hover:text-evergreen">← Servicio</button>
            </div>
            {biz.professionals.map((p) => (
              <button key={p.id} onClick={() => { setProId(p.id); setStep(2); }}
                className="group flex items-center gap-3 rounded-xl border-2 border-ink/10 bg-white/60 px-4 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-evergreen hover:shadow-[4px_4px_0_rgba(12,36,28,0.1)]">
                <span className="flex h-10 w-10 items-center justify-center rounded-full font-display text-sm font-extrabold text-ink" style={{ background: p.color }}>
                  {p.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                </span>
                <span>
                  <span className="block font-display text-[15px] font-bold">{p.name}</span>
                  <span className="text-xs text-inkmute">{p.role}</span>
                </span>
                <IconChevron className="ml-auto h-4 w-4 text-ink/30 transition-transform group-hover:translate-x-1 group-hover:text-evergreen" />
              </button>
            ))}
          </div>
        )}

        {/* fecha */}
        {!done && step === 2 && (
          <div className="pop-in">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-inkmute">{stepNum} · Elegí el día</p>
              <button onClick={() => setStep(hasPros ? 1 : 0)} className="rounded-lg px-2 py-1 text-xs font-bold text-inkmute transition-colors hover:text-evergreen">← {hasPros ? "Profesional" : "Servicio"}</button>
            </div>
            <MonthPicker cursor={cursor} setCursor={setCursor} selected={selectedDate}
              onSelect={(key) => { setSelectedDate(key); setTime(null); setWlDone(false); setShowWlForm(false); setStep(3); }}
              isClosed={isClosed} />
          </div>
        )}

        {/* hora + datos */}
        {!done && step === 3 && selectedDate && (
          <div className="pop-in">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-inkmute">
                {stepNum} · Horario para el <span className="text-evergreen">{fmtLong(selectedDate)}</span>
              </p>
              <button onClick={() => setStep(2)} className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-inkmute transition-colors hover:text-evergreen">← Día</button>
            </div>

            {slots.length === 0 ? (
              <p className="rounded-xl border-2 border-dashed border-coral/40 bg-coral/5 p-4 text-sm text-inkmute">
                Ese día <strong className="text-ink">{user.business}</strong> no atiende. Elegí otro día en el calendario.
              </p>
            ) : (
              <>
                {hasBreak && breakInfo ? (
                  <div className="space-y-3">
                    <div>
                      <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-widest text-inkmute">☀ Mañana · hasta el corte</p>
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
                      <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-widest text-inkmute">🌙 Tarde · después del corte</p>
                      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                        {slots.filter((t) => t >= (breakInfo.to ?? "99:99")).map((t) => slotBtn(t))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">{slots.map((t) => slotBtn(t))}</div>
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
                  <input className="field" type="tel" placeholder="Tu teléfono *" value={wlPhone} onChange={(e) => setWlPhone(e.target.value)} />
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
                <p className="mt-1 text-sm text-inkmute">Te avisamos al <strong className="text-fern">{wlPhone}</strong> si se libera un lugar el {fmtLong(selectedDate)}.</p>
              </div>
            )}

            {time && (
              <div className="pop-in mt-4 space-y-3.5">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-inkmute">Tu nombre *</label>
                  <input className="field" placeholder="Ana Torres" value={client} onChange={(e) => setClient(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-inkmute">Teléfono *</label>
                  <input className="field" type="tel" placeholder="11 5555-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  <p className="mt-1 text-[11px] text-inkmute">Te avisamos por ahí si hay algún cambio con tu turno.</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-inkmute">Email <span className="normal-case text-ink/40">(opcional, para el recordatorio)</span></label>
                  <input className="field" type="email" placeholder="ana@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>

                {/* tienda */}
                {paid && biz.products.length > 0 && (
                  <button type="button" onClick={() => setShowShop(true)}
                    className="group flex w-full items-center justify-between gap-3 rounded-xl border-2 border-limedeep/60 bg-lime/10 px-4 py-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-limedeep hover:bg-lime/20">
                    <span className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-evergreen text-lime"><IconBag className="h-4 w-4" /></span>
                      <span>
                        <span className="block font-display text-[15px] font-extrabold text-ink">¿Querés agregar algo a tu turno?</span>
                        <span className="block text-xs text-inkmute">
                          {itemCount > 0 ? `${itemCount} producto${itemCount === 1 ? "" : "s"} · ${fmtMoney(productsTotal)}` : `${biz.products.length} productos disponibles · tocá para ver la tienda`}
                        </span>
                      </span>
                    </span>
                    <span className="flex items-center gap-2 font-display text-sm font-bold text-fern">
                      {itemCount > 0 && <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-fern px-1.5 text-xs text-lime">{itemCount}</span>}
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
                      <button type="button" onClick={applyCoupon} className="shrink-0 rounded-xl bg-evergreen px-4 font-display text-sm font-bold text-lime transition-all hover:-translate-y-0.5 hover:bg-pine">Aplicar</button>
                    </div>
                    {couponMsg && <p className={`mt-1.5 text-xs font-semibold ${couponMsg.ok ? "text-fern" : "text-coral"}`}>{couponMsg.text}</p>}
                  </div>
                )}

                {/* resumen */}
                <div className="space-y-1.5 rounded-xl border-2 border-dashed border-limedeep/70 bg-lime/15 px-4 py-3 text-sm">
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
                      Pagás ahora una <strong className="text-fern">seña del {settings.depositPct}% ({fmtMoney(deposit)})</strong> por transferencia y el resto en el local. Si cancelás con 24 h de anticipación, se devuelve.
                    </p>
                  ) : (
                    <p className="pt-1 text-xs text-ink/70">Pagás en el local. Sin seña, sin sorpresas.</p>
                  )}
                </div>

                {error && <p className="shake rounded-lg border-2 border-coral/40 bg-coral/10 px-3 py-2 text-xs font-semibold text-coral">{error}</p>}
                <button onClick={confirm} className="w-full rounded-xl bg-coral py-3.5 font-display text-base font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[5px_6px_0_rgba(255,122,89,0.35)] active:translate-y-0">
                  {depositOn ? `Confirmar y pagar seña (${fmtMoney(deposit)}) →` : "Confirmar turno →"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* éxito */}
        {done && selectedDate && time && service && (
          <div className="pop-in py-2 text-center">
            <svg viewBox="0 0 56 56" className="mx-auto h-14 w-14">
              <circle cx="28" cy="28" r="25" fill="none" stroke="#cdf463" strokeWidth="4" className="circle-draw" strokeLinecap="round" transform="rotate(-90 28 28)" />
              <path d="M18 29l7 7 13-14" fill="none" stroke="#082b22" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" className="check-draw" />
            </svg>
            <h4 className="mt-2 font-display text-xl font-extrabold">
              {claimed ? "¡Turno reservado!" : "¡Tu cupito está asegurado!"}
            </h4>
            <p className="mt-1 text-sm text-inkmute">
              {service.name} · {fmtLong(selectedDate)} a las {time}
              {pro && ` · con ${pro.name.split(" ")[0]}`}
              {itemCount > 0 && ` · ${itemCount} producto${itemCount === 1 ? "" : "s"} agregado${itemCount === 1 ? "" : "s"}`}
            </p>
            {claimed && (
              <p className="mx-auto mt-2 max-w-sm rounded-xl border-2 border-limedeep/60 bg-lime/15 px-3 py-2 text-xs font-semibold text-ink/80">
                Tu comprobante ya está con {user.business}. Apenas verifique la transferencia, tu turno queda confirmado y te avisamos.
              </p>
            )}
            <div className="mt-4 space-y-2 text-left">
              <button onClick={() => {
                downloadIcs(icsContent({ title: `${service.name} — ${user.business}`, date: selectedDate, time, duration: service.duration, desc: `Turno en ${user.business}, reservado con Cupito.` }));
                toast("Archivo de calendario descargado — abrílo para sumar tu turno");
              }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-evergreen py-3 font-display text-[15px] font-bold text-lime transition-all duration-200 hover:-translate-y-0.5 hover:bg-pine hover:shadow-[4px_5px_0_rgba(205,244,99,0.4)] active:translate-y-0">
                <IconCalendar className="h-4 w-4" /> Agregar a mi calendario
              </button>
              <a href={gcalUrl({ title: `${service.name} — ${user.business}`, date: selectedDate, time, duration: service.duration })} target="_blank" rel="noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-ink/15 py-2.5 text-sm font-bold text-ink/70 transition-all hover:border-fern hover:text-fern">
                Abrir en Google Calendar ↗
              </a>
              {user.slug === "studio-nails" && settings.whatsapp && (
                <a href={`https://wa.me/54${settings.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola! Soy ${client}. Acabo de reservar ${service.name} para el ${fmtLong(selectedDate)} a las ${time} 🙌`)}`} target="_blank" rel="noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-fern/30 py-2.5 text-sm font-bold text-fern transition-all hover:-translate-y-0.5 hover:bg-fern/10">
                  <IconWhatsApp className="h-4 w-4" /> Avisar por WhatsApp (opcional)
                </a>
              )}
              <button onClick={reset} className="w-full rounded-xl py-2 text-sm font-bold text-ink/50 transition-colors hover:text-evergreen">
                Reservar otro turno
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="border-t-2 border-dashed border-ink/10 px-6 py-3 text-center text-[11px] font-semibold text-inkmute">
        ⚡ Hecho con Cupito — reservás en 60 segundos, sin app y sin llamadas
      </p>

      {showShop && (
        <ShopOverlay products={biz.products} items={items} setQty={(id, q) => setItems((prev) => { const n = { ...prev }; if (q <= 0) delete n[id]; else n[id] = q; return n; })}
          total={productsTotal} count={itemCount} onClose={() => setShowShop(false)} />
      )}
      {showPay && (
        <TransferModal amount={deposit} settings={settings} business={user.business} onClose={() => setShowPay(false)} onSent={(txId) => finish({ claimTx: txId })} />
      )}
    </div>
  );

  function slotBtn(t: string) {
    const busy = takenTimes(selectedDate ?? "").includes(t);
    return (
      <button key={t} disabled={busy} onClick={() => { setTime(t); setError(null); }}
        className={`rounded-lg border-2 py-2 font-display text-sm font-bold transition-all duration-150 ${busy ? "cursor-not-allowed border-ink/8 bg-ink/5 text-ink/25 line-through" : time === t ? "border-evergreen bg-evergreen text-lime shadow-[3px_3px_0_rgba(205,244,99,0.5)]" : "border-ink/10 bg-white/60 hover:-translate-y-0.5 hover:border-evergreen"}`}>
        {t}
      </button>
    );
  }
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
