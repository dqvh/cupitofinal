import { useMemo, useState } from "react";
import {
  Check,
  CheckCheck,
  MessageCircle,
  ChevronRight,
  Plus,
  Share2,
  Copy,
  Wallet,
  Hourglass,
  BellRing,
  CalendarDays,
  Ban,
  Sparkles,
  CircleDashed,
  CheckCircle2,
  ArrowRight,
  Clock,
} from "lucide-react";
import { useStore, defaultHours, type Booking } from "../../lib/store";
import { businessHoursOn, toMin, fromMin } from "../../lib/availability";
import { Badge, Button, Card, Empty, Sheet, StatusBadge } from "./ui";
import { usePanel } from "./context";
import { useActivity } from "./Shell";
import { useBookingActions } from "./BookingDrawer";
import {
  dayLabel,
  durOf,
  endOf,
  hasPhone,
  incomeOf,
  isOpen,
  longDate,
  money,
  nowHHMM,
  priceOf,
  relTime,
  serviceLabel,
  shiftKey,
  todayKey,
  untilLabel,
  waLink,
  waMessage,
  weekStartOf,
} from "./helpers";

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return "Buenas noches";
  if (h < 13) return "Buen día";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

/* ---------- primeros pasos (onboarding liviano) ---------- */

function SetupChecklist() {
  const { data, user, go, openShare } = usePanel();
  const store = useStore();
  const shared = (() => { try { return localStorage.getItem(`cupito_shared_${user.id}`) === "1"; } catch { return false; } })();
  const steps = [
    { id: "negocio", done: !!(data.settings.whatsapp || data.settings.address), title: "Completá los datos del negocio", hint: "WhatsApp y dirección para que te encuentren", run: () => go("ajustes", { tab: "negocio" }) },
    { id: "servicios", done: data.services.length > 0, title: "Cargá tus servicios", hint: "Nombre, duración y precio", run: () => go("servicios", { params: data.services.length ? {} : { nuevo: "1" } }) },
    { id: "horarios", done: JSON.stringify(data.settings.hours) !== JSON.stringify(defaultHours()) || !!data.settings.hoursConfirmed, title: "Revisá tus horarios", hint: "Días y horas en que atendés", run: () => go("horarios") },
    { id: "link", done: shared || data.bookings.some((b) => b.source === "online"), title: "Compartí tu link de reservas", hint: `cupito.app/${user.slug}`, run: () => { try { localStorage.setItem(`cupito_shared_${user.id}`, "1"); } catch { /* noop */ } openShare(); } },
    { id: "reserva", done: data.bookings.length > 0, title: "Recibí tu primera reserva", hint: "Online o cargada por vos", run: () => go("agenda") },
  ];
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length || data.settings.onboardingHidden) return null;
  const next = steps.find((s) => !s.done);
  return (
    <section className="c-card mb-4 overflow-hidden" aria-label="Primeros pasos">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3.5" style={{ borderBottom: "1px solid var(--line)" }}>
        <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-[var(--brand-soft)] text-[var(--brand)]"><Sparkles className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="c-h2">Dejá tu agenda lista para recibir reservas</h2>
          <p className="c-sub">{done} de {steps.length} pasos · te lleva unos minutos</p>
        </div>
        <div className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-[var(--surface-3)] sm:block" aria-hidden="true">
          <div className="h-full rounded-full bg-[var(--brand)] transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
        </div>
        <button type="button" className="text-[12.5px] text-[var(--text-3)] hover:text-[var(--text)]" onClick={() => store.updateSettings({ onboardingHidden: true })}>Ocultar</button>
      </div>
      <ol className="c-divide">
        {steps.map((s) => (
          <li key={s.id}>
            <button type="button" className="c-list-row" onClick={s.run} disabled={s.done && s.id === "reserva"}>
              {s.done ? <CheckCircle2 className="h-[18px] w-[18px] shrink-0 text-[var(--brand)]" /> : <CircleDashed className="h-[18px] w-[18px] shrink-0 text-[var(--text-3)]" />}
              <span className="min-w-0 flex-1">
                <span className={`block text-[13.5px] ${s.done ? "text-[var(--text-3)] line-through" : "font-medium"}`}>{s.title}</span>
                {!s.done && <span className="block truncate text-[12px] text-[var(--text-3)]">{s.hint}</span>}
              </span>
              {s === next && <span className="c-btn c-btn--primary c-btn--sm">Empezar <ArrowRight /></span>}
              {s !== next && !s.done && <ChevronRight className="h-4 w-4 text-[var(--text-3)]" />}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ---------- recordatorios de mañana ---------- */

export function RemindersSheet({ date, onClose }: { date: string; onClose: () => void }) {
  const store = useStore();
  const { data, user, openBooking } = usePanel();
  const list = data.bookings.filter((b) => b.date === date && isOpen(b)).sort((a, b) => a.time.localeCompare(b.time));
  const pending = list.filter((b) => hasPhone(b.phone) && !b.waReminderAt).length;
  return (
    <Sheet onClose={onClose} title={`Recordatorios para ${dayLabel(date).toLowerCase()}`} subtitle={`${list.length} turno${list.length === 1 ? "" : "s"} · ${pending} sin avisar. Tocá “Enviar” y se abre WhatsApp con el mensaje listo.`}>
      {data.settings.remindersEnabled !== false && (
        <p className="mb-3 text-[12.5px] text-[var(--text-3)]">Los clientes con email ya reciben un recordatorio automático 24 h antes.</p>
      )}
      {list.length === 0 ? (
        <Empty icon={<BellRing />} title="No hay turnos para recordar" />
      ) : (
        <div className="c-card c-divide">
          {list.map((b) => (
            <div key={b.id} className="c-list-row">
              <span className="w-11 shrink-0 text-[13px] font-semibold tnum">{b.time}</span>
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openBooking(b.id)}>
                <span className="block truncate text-[13.5px] font-medium">{b.client}</span>
                <span className="block truncate text-[12px] text-[var(--text-3)]">{serviceLabel(data, b)}</span>
              </button>
              {!hasPhone(b.phone) ? (
                <span className="text-[12px] text-[var(--text-3)]">Sin celular</span>
              ) : b.waReminderAt ? (
                <Badge tone="brand"><Check className="h-3 w-3" /> Enviado</Badge>
              ) : (
                <a
                  className="c-btn c-btn--soft c-btn--sm"
                  href={waLink(b.phone, waMessage("recordatorio", { business: user.business, b, data }))}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => store.updateBooking(b.id, { waReminderAt: Date.now() })}
                >
                  <MessageCircle /> Enviar
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}

/* ---------- vista ---------- */

export default function HomeView() {
  const store = useStore();
  const { data, user, go, openBooking, newBooking, blockTime, openShare } = usePanel();
  const { setStatus } = useBookingActions();
  const [day, setDay] = useState<"hoy" | "manana">("hoy");
  const [reminders, setReminders] = useState<string | null>(null);
  const activity = useActivity();
  const today = todayKey();
  const tomorrow = shiftKey(today, 1);
  const now = nowHHMM();
  const shownDate = day === "hoy" ? today : tomorrow;

  const todays = useMemo(() => data.bookings.filter((b) => b.date === today && b.status !== "cancelada").sort((a, b) => a.time.localeCompare(b.time)), [data.bookings, today]);
  const shown = useMemo(() => data.bookings.filter((b) => b.date === shownDate).sort((a, b) => a.time.localeCompare(b.time)), [data.bookings, shownDate]);

  const inProgress = todays.find((b) => isOpen(b) && b.time <= now && endOf(data, b) > now);
  const next = todays.find((b) => isOpen(b) && b.time > now) || (!inProgress ? data.bookings.filter((b) => b.date > today && isOpen(b)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0] : undefined);

  /* métricas */
  const expectedToday = todays.filter((b) => b.status !== "ausente").reduce((a, b) => a + priceOf(data, b), 0);
  const collectedToday = data.bookings.filter((b) => b.date === today).reduce((a, b) => a + incomeOf(data, b), 0);
  const pendingList = data.bookings.filter((b) => b.status === "pendiente" && b.date >= today && !(b.depositClaim && !b.paidDeposit)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const claims = data.bookings.filter((b) => b.depositClaim && !b.paidDeposit && b.status !== "cancelada");
  const ws = weekStartOf(today);
  const inRange = (b: Booking, from: string, to: string) => b.date >= from && b.date <= to && b.status !== "cancelada";
  const weekCount = data.bookings.filter((b) => inRange(b, ws, shiftKey(ws, 6))).length;
  const lastWeekCount = data.bookings.filter((b) => inRange(b, shiftKey(ws, -7), shiftKey(ws, -1))).length;
  const cancels7 = data.bookings.filter((b) => (b.status === "cancelada" || b.status === "ausente") && b.date >= shiftKey(today, -6) && b.date <= today).length;
  const tomorrowOpen = data.bookings.filter((b) => b.date === tomorrow && isOpen(b));
  const toRemind = tomorrowOpen.filter((b) => hasPhone(b.phone) && !b.waReminderAt).length;
  const toClose = todays.filter((b) => b.status === "confirmada" && endOf(data, b) <= now);

  /* huecos libres (solo sin equipo o con 1 profesional: con más, la agenda los muestra mejor) */
  const gaps = useMemo(() => {
    if (data.professionals.length > 1) return [];
    const h = businessHoursOn(data.settings, shownDate);
    if (!h?.open) return [];
    const shifts: [number, number][] = [[toMin(h.from), toMin(h.to)]];
    if (h.from2 && h.to2) shifts.push([toMin(h.from2), toMin(h.to2)]);
    const busy = shown.filter((b) => b.status !== "cancelada").map((b) => [toMin(b.time), toMin(b.time) + durOf(data, b)] as [number, number]);
    const nowMin = shownDate === today ? toMin(now) : 0;
    const out: { from: string; to: string }[] = [];
    for (const [a, z] of shifts) {
      let cur = Math.max(a, nowMin);
      for (const [s, e] of busy.filter(([s, e]) => e > a && s < z).sort((x, y) => x[0] - y[0])) {
        if (s - cur >= 30) out.push({ from: fromMin(cur), to: fromMin(s) });
        cur = Math.max(cur, e);
      }
      if (z - cur >= 30) out.push({ from: fromMin(cur), to: fromMin(z) });
    }
    return out;
  }, [data, shown, shownDate, today, now]);

  const timeline = useMemo(() => {
    const rows: ({ kind: "b"; b: Booking; at: string } | { kind: "gap"; from: string; to: string; at: string })[] = [
      ...shown.map((b) => ({ kind: "b" as const, b, at: b.time })),
      ...gaps.map((g) => ({ kind: "gap" as const, ...g, at: g.from })),
    ];
    return rows.sort((a, b) => a.at.localeCompare(b.at));
  }, [shown, gaps]);

  const attention = pendingList.length + claims.length + toClose.length + data.waitlist.length + (toRemind ? 1 : 0);
  const firstName = user.name.trim().split(/\s+/)[0] || "";

  const spotlight = inProgress || next;

  return (
    <div>
      <div className="cp-page-head">
        <div className="min-w-0">
          <h1 className="c-h1">{greeting()}{firstName ? `, ${firstName}` : ""}</h1>
          <p className="c-sub">
            {longDate(today)} · {todays.length === 0 ? "sin turnos hoy" : `${todays.length} turno${todays.length === 1 ? "" : "s"} hoy`}
            {attention > 0 ? ` · ${attention} cosa${attention === 1 ? "" : "s"} para resolver` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={<Ban />} onClick={() => blockTime({ date: today })}>Bloquear horario</Button>
          <Button icon={<CalendarDays />} onClick={() => go("agenda")} className="hidden sm:inline-flex">Abrir agenda</Button>
        </div>
      </div>

      <SetupChecklist />

      {/* métricas del día */}
      <section className="c-card mb-4 grid grid-cols-2 lg:grid-cols-4" aria-label="Resumen">
        {[
          { label: "Turnos hoy", value: String(todays.length), sub: todays.length ? `${todays.filter((b) => b.status === "atendida").length} atendidos · ${todays.filter((b) => isOpen(b) && b.time > now).length} por venir` : "Agenda libre", onClick: () => go("agenda", { params: { d: today, v: "dia" } }) },
          { label: "Ingresos de hoy", value: money(expectedToday), sub: collectedToday ? `${money(collectedToday)} ya cobrado` : "Estimado según turnos", onClick: () => go("stats") },
          { label: "Por confirmar", value: String(pendingList.length + claims.length), sub: claims.length ? `${claims.length} con seña por verificar` : pendingList.length ? "Confirmalos en un toque" : "Nada pendiente", onClick: () => go("reservas", { params: { estado: "pendiente" } }), alert: pendingList.length + claims.length > 0 },
          { label: "Esta semana", value: String(weekCount), sub: lastWeekCount ? `${weekCount >= lastWeekCount ? "+" : ""}${weekCount - lastWeekCount} vs. semana pasada` : cancels7 ? `${cancels7} cancelaciones/ausencias en 7 días` : "turnos agendados", onClick: () => go("agenda", { params: { v: "semana" } }) },
        ].map((k, i) => (
          <button
            key={k.label}
            type="button"
            onClick={k.onClick}
            className={`px-4 py-3.5 text-left transition-colors hover:bg-[var(--surface-2)] ${i % 2 ? "border-l border-[var(--line)]" : ""} ${i > 1 ? "border-t border-[var(--line)] lg:border-t-0" : ""} ${i === 2 ? "lg:border-l" : ""} ${i === 0 ? "rounded-l-[var(--r-lg)]" : ""}`}
          >
            <span className="block text-[12.5px] text-[var(--text-3)]">{k.label}</span>
            <span className={`mt-0.5 block text-[22px] font-semibold tracking-tight tnum ${k.alert ? "text-[var(--warn)]" : ""}`}>{k.value}</span>
            <span className="block truncate text-[12px] text-[var(--text-3)]">{k.sub}</span>
          </button>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          {/* próximo turno */}
          {spotlight && (
            <section className="c-card p-4" aria-label={inProgress ? "Turno en curso" : "Próximo turno"}>
              <div className="flex items-start gap-3">
                <div className="grid h-12 w-14 shrink-0 place-items-center rounded-[var(--r-md)] bg-[var(--brand-soft)] text-[var(--brand-ink)]">
                  <span className="text-[15px] font-semibold tnum">{spotlight.time}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="c-eyebrow" style={{ color: inProgress ? "var(--brand)" : undefined }}>
                    {inProgress ? "En curso" : spotlight.date === today ? `Próximo turno · ${untilLabel(spotlight.date, spotlight.time)}` : `Próximo turno · ${dayLabel(spotlight.date)}`}
                  </p>
                  <button type="button" className="mt-0.5 block max-w-full truncate text-left text-[16px] font-semibold hover:underline" onClick={() => openBooking(spotlight.id)}>{spotlight.client}</button>
                  <p className="truncate text-[13px] text-[var(--text-3)]">
                    {serviceLabel(data, spotlight)} · {spotlight.time}–{endOf(data, spotlight)}
                    {data.professionals.find((p) => p.id === spotlight.proId) ? ` · con ${data.professionals.find((p) => p.id === spotlight.proId)!.name}` : ""}
                  </p>
                </div>
                <StatusBadge status={spotlight.status} className="hidden sm:inline-flex" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {spotlight.status === "pendiente" && <Button size="sm" variant="primary" icon={<Check />} onClick={() => setStatus(spotlight, "confirmada")}>Confirmar</Button>}
                {inProgress && <Button size="sm" variant="primary" icon={<CheckCheck />} onClick={() => setStatus(spotlight, "atendida")}>Terminar y marcar atendido</Button>}
                {hasPhone(spotlight.phone) && (
                  <a className="c-btn c-btn--secondary c-btn--sm" target="_blank" rel="noreferrer" href={waLink(spotlight.phone, waMessage("recordatorio", { business: user.business, b: spotlight, data }))}>
                    <MessageCircle /> Escribirle
                  </a>
                )}
                <Button size="sm" variant="ghost" onClick={() => openBooking(spotlight.id)}>Ver detalle</Button>
              </div>
            </section>
          )}

          {/* agenda del día */}
          <Card
            title={day === "hoy" ? "Agenda de hoy" : "Agenda de mañana"}
            sub={`${shown.filter((b) => b.status !== "cancelada").length} turnos${gaps.length ? ` · ${gaps.length} hueco${gaps.length === 1 ? "" : "s"} libre${gaps.length === 1 ? "" : "s"}` : ""}`}
            bodyClass=""
            action={
              <div className="flex items-center gap-1.5">
                <div className="c-seg" role="group" aria-label="Día">
                  <button type="button" aria-pressed={day === "hoy"} onClick={() => setDay("hoy")}>Hoy</button>
                  <button type="button" aria-pressed={day === "manana"} onClick={() => setDay("manana")}>Mañana</button>
                </div>
                <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => newBooking({ date: shownDate })} aria-label="Nuevo turno este día" className="hidden sm:inline-flex">Turno</Button>
              </div>
            }
          >
            {timeline.length === 0 ? (
              <Empty
                icon={<CalendarDays />}
                title={businessHoursOn(data.settings, shownDate)?.open === false ? `El ${dayLabel(shownDate).toLowerCase()} el local está cerrado` : `Todavía no hay turnos ${day === "hoy" ? "hoy" : "mañana"}`}
                text="Cargá uno vos o compartí tu link para que tus clientes reserven solos."
              >
                <Button variant="primary" icon={<Plus />} onClick={() => newBooking({ date: shownDate })}>Nuevo turno</Button>
                <Button icon={<Share2 />} onClick={openShare}>Compartir link</Button>
              </Empty>
            ) : (
              <ol className="c-divide">
                {timeline.map((row) =>
                  row.kind === "gap" ? (
                    <li key={`g-${row.from}`}>
                      <button type="button" className="c-list-row group" style={{ minHeight: 40 }} onClick={() => newBooking({ date: shownDate, time: row.from })}>
                        <span className="w-12 shrink-0 text-[12.5px] text-[var(--text-3)] tnum">{row.from}</span>
                        <span className="flex-1 rounded-[var(--r)] border border-dashed border-[var(--line-2)] px-2.5 py-1 text-[12.5px] text-[var(--text-3)] group-hover:border-[var(--brand)] group-hover:text-[var(--brand)]">
                          Libre hasta las {row.to} · <span className="font-medium">agendar</span>
                        </span>
                      </button>
                    </li>
                  ) : (
                    <li key={row.b.id}>
                      <TimelineRow b={row.b} past={shownDate === today && endOf(data, row.b) <= now} onOpen={() => openBooking(row.b.id)} />
                    </li>
                  )
                )}
              </ol>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          {/* necesita atención */}
          <Card title="Para resolver" sub={attention ? undefined : "Todo al día"} bodyClass="">
            {attention === 0 ? (
              <div className="flex items-center gap-2.5 px-4 py-4 text-[13px] text-[var(--text-3)]">
                <CheckCircle2 className="h-4 w-4 text-[var(--brand)]" /> No hay nada pendiente. ¡Bien ahí!
              </div>
            ) : (
              <div className="c-divide">
                {claims.map((b) => (
                  <div key={b.id} className="c-list-row">
                    <Wallet className="h-4 w-4 shrink-0 text-[var(--warn)]" />
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openBooking(b.id)}>
                      <span className="block truncate text-[13px] font-medium">Seña de {b.client}</span>
                      <span className="block truncate text-[12px] text-[var(--text-3)]">{dayLabel(b.date)} {b.time} · verificá la transferencia</span>
                    </button>
                    <Button size="sm" onClick={() => openBooking(b.id)}>Revisar</Button>
                  </div>
                ))}
                {pendingList.slice(0, 5).map((b) => (
                  <div key={b.id} className="c-list-row">
                    <Clock className="h-4 w-4 shrink-0 text-[var(--warn)]" />
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openBooking(b.id)}>
                      <span className="block truncate text-[13px] font-medium">{b.client}</span>
                      <span className="block truncate text-[12px] text-[var(--text-3)]">{dayLabel(b.date)} {b.time} · {serviceLabel(data, b)}</span>
                    </button>
                    <Button size="sm" variant="soft" icon={<Check />} onClick={() => setStatus(b, "confirmada")}>Confirmar</Button>
                  </div>
                ))}
                {pendingList.length > 5 && (
                  <button type="button" className="c-list-row text-[12.5px] font-medium text-[var(--brand)]" style={{ minHeight: 40 }} onClick={() => go("reservas", { params: { estado: "pendiente" } })}>
                    Ver los {pendingList.length} por confirmar <ChevronRight className="h-4 w-4" />
                  </button>
                )}
                {toClose.length > 0 && (
                  <div className="c-list-row">
                    <CheckCheck className="h-4 w-4 shrink-0 text-[var(--text-3)]" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium">{toClose.length} turno{toClose.length === 1 ? "" : "s"} de hoy sin cerrar</span>
                      <span className="block text-[12px] text-[var(--text-3)]">Marcalos como atendidos para tus estadísticas</span>
                    </span>
                    <Button size="sm" onClick={() => { toClose.forEach((b) => store.setStatus(b.id, "atendida")); store.toast(`${toClose.length} turno${toClose.length === 1 ? "" : "s"} marcados como atendidos`, "ok", { label: "Deshacer", onClick: () => toClose.forEach((b) => store.setStatus(b.id, "confirmada")) }, 7000); }}>
                      Marcar todos
                    </Button>
                  </div>
                )}
                {toRemind > 0 && (
                  <div className="c-list-row">
                    <BellRing className="h-4 w-4 shrink-0 text-[var(--info)]" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium">Recordale a {toRemind} cliente{toRemind === 1 ? "" : "s"} de mañana</span>
                      <span className="block text-[12px] text-[var(--text-3)]">Baja las ausencias. Un toque por cliente.</span>
                    </span>
                    <Button size="sm" onClick={() => setReminders(tomorrow)}>Enviar</Button>
                  </div>
                )}
                {data.waitlist.length > 0 && (
                  <button type="button" className="c-list-row" onClick={() => go("espera")}>
                    <Hourglass className="h-4 w-4 shrink-0 text-[var(--text-3)]" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium">{data.waitlist.length} en lista de espera</span>
                      <span className="block text-[12px] text-[var(--text-3)]">Ofreceles los huecos que se liberen</span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-[var(--text-3)]" />
                  </button>
                )}
              </div>
            )}
          </Card>

          {/* actividad */}
          <Card title="Actividad reciente" bodyClass="">
            {activity.length === 0 ? (
              <p className="px-4 py-4 text-[13px] text-[var(--text-3)]">Acá vas a ver las reservas, cancelaciones y cambios que hagan tus clientes desde tu página.</p>
            ) : (
              <div className="c-divide">
                {activity.slice(0, 6).map((a) => (
                  <button key={a.id} type="button" className="c-list-row items-start" onClick={() => openBooking(a.bookingId)}>
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: a.kind === "cancelada" ? "var(--danger)" : a.kind === "seña" ? "var(--warn)" : a.kind === "reprogramada" ? "var(--info)" : "var(--brand)" }} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] leading-snug">{a.text}</span>
                      <span className="block text-[11.5px] text-[var(--text-3)]">{relTime(a.at)}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* link */}
          <section className="c-card p-4" aria-label="Tu link de reservas">
            <p className="c-eyebrow">Tu link de reservas</p>
            <p className="mt-1 truncate text-[15px] font-semibold">cupito.app/{user.slug}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" icon={<Copy />} onClick={() => { navigator.clipboard?.writeText(`https://cupito.app/${user.slug}`).then(() => store.toast("Link copiado"), () => store.toast("No se pudo copiar", "warn")); }}>Copiar</Button>
              <Button size="sm" icon={<Share2 />} onClick={openShare}>Compartir</Button>
              <Button size="sm" variant="ghost" onClick={() => go("pagina")}>QR y más</Button>
            </div>
          </section>
        </div>
      </div>

      {reminders && <RemindersSheet date={reminders} onClose={() => setReminders(null)} />}
    </div>
  );
}

function TimelineRow({ b, past, onOpen }: { b: Booking; past: boolean; onOpen: () => void }) {
  const { data, user } = usePanel();
  const { setStatus } = useBookingActions();
  const pro = data.professionals.find((p) => p.id === b.proId);
  const cancelled = b.status === "cancelada";
  return (
    <div className="c-list-row" style={{ opacity: cancelled ? 0.55 : past && b.status !== "confirmada" ? 0.75 : 1 }}>
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="w-12 shrink-0">
          <span className="block text-[13.5px] font-semibold tnum">{b.time}</span>
          <span className="block text-[11.5px] text-[var(--text-3)] tnum">{endOf(data, b)}</span>
        </span>
        <span className="h-9 w-[3px] shrink-0 rounded-full" style={{ background: pro?.color || "var(--brand)" }} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[13.5px] font-medium ${cancelled ? "line-through" : ""}`}>{b.client}</span>
          <span className="block truncate text-[12px] text-[var(--text-3)]">{serviceLabel(data, b)}{pro ? ` · ${pro.name}` : ""}</span>
        </span>
      </button>
      <StatusBadge status={b.status} className="hidden sm:inline-flex" />
      {b.status === "pendiente" && <Button size="sm" variant="soft" icon={<Check />} onClick={() => setStatus(b, "confirmada")} aria-label={`Confirmar turno de ${b.client}`}><span className="hidden sm:inline">Confirmar</span></Button>}
      {b.status === "confirmada" && past && <Button size="sm" icon={<CheckCheck />} onClick={() => setStatus(b, "atendida")} aria-label={`Marcar atendido a ${b.client}`}><span className="hidden sm:inline">Atendido</span></Button>}
      {b.status === "confirmada" && !past && hasPhone(b.phone) && (
        <a className="c-btn c-btn--ghost c-btn--sm c-btn--icon" href={waLink(b.phone, waMessage("recordatorio", { business: user.business, b, data }))} target="_blank" rel="noreferrer" aria-label={`WhatsApp a ${b.client}`} title="WhatsApp">
          <MessageCircle />
        </a>
      )}
      {(b.status === "atendida" || b.status === "ausente" || b.status === "cancelada") && <StatusBadge status={b.status} className="sm:hidden" />}
    </div>
  );
}
