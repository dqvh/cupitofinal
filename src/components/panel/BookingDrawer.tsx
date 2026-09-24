import { useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckCheck,
  UserX,
  XCircle,
  CalendarClock,
  RotateCcw,
  MessageCircle,
  Phone,
  Mail,
  Trash2,
  CalendarPlus,
  Download,
  AlertTriangle,
  ChevronRight,
  Wallet,
  Globe,
  PencilLine,
} from "lucide-react";
import { useStore, type Booking, type BookingStatus } from "../../lib/store";
import { slotsFor } from "../../lib/availability";
import { formatArgentinaPhone } from "../../lib/phone";
import { Avatar, Button, Callout, Confirm, Field, Menu, Sheet, StatusBadge, STATUS_LABEL } from "./ui";
import { usePanel } from "./context";
import {
  buildClients,
  clientKeyOf,
  dayLabel,
  depositOf,
  durOf,
  endOf,
  hasPhone,
  longDate,
  money,
  priceOf,
  relTime,
  serviceLabel,
  servicesOf,
  todayKey,
  nowHHMM,
  waLink,
  waMessage,
  type WaKind,
} from "./helpers";
import { DayStrip, SlotGrid } from "./BookingForm";

/* ---------- exportar a calendario ---------- */

function toUtcStamp(date: string, time: string, addMin = 0) {
  // Argentina: UTC-3 fijo.
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const ms = Date.UTC(y, m - 1, d, hh + 3, mm) + addMin * 60000;
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function googleCalUrl(title: string, date: string, time: string, dur: number, details: string) {
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${toUtcStamp(date, time)}/${toUtcStamp(date, time, dur)}&details=${encodeURIComponent(details)}`;
}

export function downloadIcs(o: { id: string; title: string; date: string; time: string; dur: number; details: string; location?: string; status?: BookingStatus }) {
  const esc = (t: string) => t.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Cupito//Agenda//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:${esc(o.id)}@cupito.app`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`,
    `DTSTART:${toUtcStamp(o.date, o.time)}`,
    `DTEND:${toUtcStamp(o.date, o.time, o.dur)}`,
    `SUMMARY:${esc(o.title)}`,
    `DESCRIPTION:${esc(o.details)}`,
    `LOCATION:${esc(o.location || "")}`,
    `STATUS:${o.status === "cancelada" ? "CANCELLED" : o.status === "pendiente" ? "TENTATIVE" : "CONFIRMED"}`,
    "END:VEVENT", "END:VCALENDAR",
  ];
  const blob = new Blob([lines.join("\r\n") + "\r\n"], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `turno-${o.date}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- acciones de estado con deshacer (compartidas con listas) ---------- */

export function useBookingActions() {
  const store = useStore();
  const { data, user } = usePanel();
  const setStatus = (b: Booking, status: BookingStatus) => {
    const prev = b.status;
    store.setStatus(b.id, status);
    const undo = { label: "Deshacer", onClick: () => store.setStatus(b.id, prev) };
    if (status === "atendida") {
      const r = store.requestReview(b.id);
      store.toast(r === "sent" ? `${b.client}: atendido · le pedimos una reseña por email` : `${b.client}: atendido`, "ok", undo, 6000);
    } else if (status === "confirmada") store.toast(`Turno de ${b.client} confirmado`, "ok", hasPhone(b.phone) && prev === "pendiente" ? { label: "Avisar por WhatsApp", onClick: () => window.open(waLink(b.phone, waMessage("confirmacion", { business: user.business, b, data })), "_blank") } : undo, 6000);
    else if (status === "cancelada") store.toast(`Turno de ${b.client} cancelado. El horario quedó libre.`, "ok", undo, 7000);
    else if (status === "ausente") store.toast(`${b.client} marcado como “no vino”`, "warn", undo, 6000);
    else store.toast("Estado actualizado", "ok", undo, 5000);
  };
  return { setStatus };
}

/* ---------- reprogramar ---------- */

function ReschedulePanel({ b, onDone, onCancel }: { b: Booking; onDone: () => void; onCancel: () => void }) {
  const store = useStore();
  const { data, user } = usePanel();
  const [date, setDate] = useState(b.date >= todayKey() ? b.date : todayKey());
  const [time, setTime] = useState("");
  const [proId, setProId] = useState(b.proId || "");
  const [notify, setNotify] = useState(hasPhone(b.phone));
  const [manual, setManual] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const serviceIds = [b.serviceId, ...(b.extraServiceIds || [])];
  const slots = useMemo(() => {
    const list = slotsFor(data, { date, serviceIds, proId: proId || undefined, excludeId: b.id });
    return date === todayKey() ? list.filter((s) => s.time > nowHHMM()) : list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, date, proId, b.id]);

  const save = () => {
    if (!time) return setError("Elegí el nuevo horario.");
    const r = store.rescheduleBooking(b.id, date, time, proId || undefined, manual);
    if (!r.ok) return setError(r.error || "No se pudo reprogramar.");
    const moved = { ...b, date, time };
    store.toast(`Turno movido a ${dayLabel(date)} ${time}`, "ok", { label: "Deshacer", onClick: () => store.rescheduleBooking(b.id, b.date, b.time, b.proId || "", true) }, 7000);
    if (notify && hasPhone(b.phone)) window.open(waLink(b.phone, waMessage("reprogramado", { business: user.business, b: moved, data })), "_blank");
    onDone();
  };

  return (
    <div className="space-y-3 rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface-2)] p-3">
      <div className="flex items-center justify-between">
        <p className="c-h3">Reprogramar</p>
        <span className="text-[12px] text-[var(--text-3)]">Ahora: {dayLabel(b.date)} {b.time}</span>
      </div>
      {data.professionals.length > 0 && (
        <div className="c-chip-row flex-wrap">
          {data.professionals.map((p) => (
            <button key={p.id} type="button" className="c-chip" aria-pressed={proId === p.id} onClick={() => { setProId(p.id); setTime(""); }}>
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              {p.name}
            </button>
          ))}
        </div>
      )}
      <DayStrip value={date} onChange={(k) => { setDate(k); setTime(""); }} />
      {manual ? (
        <Field label="Horario manual" htmlFor="c-rs-time">
          <input id="c-rs-time" type="time" className="c-input" style={{ width: 130 }} value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      ) : slots.some((s) => s.free) ? (
        <SlotGrid slots={slots} value={time} onChange={(t) => { setTime(t); setError(null); }} />
      ) : (
        <p className="py-2 text-center text-[13px] text-[var(--text-3)]">Sin horarios libres ese día.</p>
      )}
      <button type="button" className="text-[12.5px] font-medium text-[var(--brand)] hover:underline" onClick={() => { setManual(!manual); setTime(""); }}>
        {manual ? "Ver horarios libres" : "+ Otro horario (manual)"}
      </button>
      {hasPhone(b.phone) && (
        <label className="flex items-center gap-2 text-[13px] text-[var(--text-2)]">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
          Avisarle por WhatsApp al guardar
        </label>
      )}
      {error && <p className="c-error" role="alert">{error}</p>}
      <div className="flex gap-2">
        <Button variant="primary" onClick={save} icon={<Check />}>Guardar cambio</Button>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}

/* ---------- drawer ---------- */

const EVENT_LABEL: Record<string, string> = {
  creada: "Turno creado",
  confirmada: "Confirmado",
  pendiente: "Volvió a pendiente",
  atendida: "Marcado como atendido",
  cancelada: "Cancelado",
  ausente: "Marcado como “no vino”",
  reprogramada: "Reprogramado",
  cobro: "Cobro registrado",
  seña: "Seña acreditada",
};

export default function BookingDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const store = useStore();
  const { data, user, openClient } = usePanel();
  const { setStatus } = useBookingActions();
  const b = data.bookings.find((x) => x.id === id);
  const [rescheduling, setRescheduling] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [note, setNote] = useState(b?.internalNote || "");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(b?.client || "");
  const [editPhone, setEditPhone] = useState(b?.phone || "");
  const [editEmail, setEditEmail] = useState(b?.email || "");

  useEffect(() => { setNote(b?.internalNote || ""); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [b?.id]);

  const client = useMemo(() => (b ? buildClients(data).find((c) => c.key === clientKeyOf(b.phone, b.client)) : undefined), [data, b]);

  if (!b) {
    return (
      <Sheet onClose={onClose} title="Turno no encontrado">
        <p className="text-[13.5px] text-[var(--text-2)]">Puede que se haya eliminado desde otro dispositivo.</p>
      </Sheet>
    );
  }

  const pro = data.professionals.find((p) => p.id === b.proId);
  const svcs = servicesOf(data, b);
  const total = priceOf(data, b);
  const deposit = b.paidDeposit ? depositOf(data, b) : 0;
  const paidFull = b.paymentStatus === "total_pagado";
  const balance = paidFull ? 0 : Math.max(0, total - deposit);
  const claim = !!b.depositClaim && !b.paidDeposit && b.status !== "cancelada";
  const isPast = b.date < todayKey() || (b.date === todayKey() && b.time <= nowHHMM());
  const open = b.status === "pendiente" || b.status === "confirmada";
  const products = (b.items || []).map((it) => ({ it, p: data.products.find((x) => x.id === it.productId) }));

  const wa = (kind: WaKind) => waLink(b.phone, waMessage(kind, { business: user.business, b, data, slug: user.slug }));
  const saveNote = () => {
    if ((b.internalNote || "") === note.trim()) return;
    store.updateBooking(b.id, { internalNote: note.trim() || undefined });
    store.toast("Nota guardada");
  };
  const calTitle = `${serviceLabel(data, b)} · ${b.client}`;
  const calDetails = `Cliente: ${b.client}\nTeléfono: ${b.phone || "-"}\nServicio: ${serviceLabel(data, b)}${pro ? `\nProfesional: ${pro.name}` : ""}`;

  /* acción principal según el momento del turno */
  const primary = (() => {
    if (claim) return null;
    if (b.status === "pendiente") return <Button variant="primary" icon={<Check />} onClick={() => setStatus(b, "confirmada")}>Confirmar turno</Button>;
    if (b.status === "confirmada" && isPast) return <Button variant="primary" icon={<CheckCheck />} onClick={() => setStatus(b, "atendida")}>Marcar atendido</Button>;
    if (b.status === "cancelada" || b.status === "ausente") return <Button variant="secondary" icon={<RotateCcw />} onClick={() => setStatus(b, "confirmada")}>Reactivar turno</Button>;
    return null;
  })();

  return (
    <>
      <Sheet
        onClose={onClose}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {b.client}
            <StatusBadge status={b.status} />
          </span>
        }
        subtitle={`${dayLabel(b.date, { long: true })} · ${b.time}–${endOf(data, b)} hs`}
        headerExtra={
          <Menu
            items={[
              { label: "Editar datos del cliente", icon: <PencilLine />, onSelect: () => setEditing(true) },
              { label: "Agregar a Google Calendar", icon: <CalendarPlus />, href: googleCalUrl(calTitle, b.date, b.time, durOf(data, b), calDetails) },
              { label: "Descargar .ics", icon: <Download />, onSelect: () => downloadIcs({ id: b.id, title: calTitle, date: b.date, time: b.time, dur: durOf(data, b), details: calDetails, location: data.settings.address, status: b.status }) },
              { separator: true, label: "s" },
              { label: "Volver a “por confirmar”", icon: <RotateCcw />, onSelect: () => setStatus(b, "pendiente"), hidden: b.status === "pendiente" },
              { label: "Eliminar turno", icon: <Trash2 />, danger: true, onSelect: () => setConfirmDelete(true) },
            ]}
          />
        }
      >
        <div className="space-y-5">
          {claim && (
            <Callout tone="warn" icon={<Wallet />}>
              <p className="font-medium">El cliente avisó que pagó la seña{b.depositClaim?.txId ? ` (op. ${b.depositClaim.txId})` : ""}.</p>
              <p className="mt-0.5 text-[12.5px]">Revisá tu cuenta y confirmá. Si no lo verificás en 24 h, el turno se libera solo.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="primary" icon={<Check />} onClick={() => { store.markDepositPaid(b.id, "transferencia"); store.setStatus(b.id, "confirmada"); store.toast("Seña acreditada y turno confirmado"); }}>Acreditar seña</Button>
                <Button size="sm" onClick={() => { store.rejectDeposit(b.id); store.toast("Comprobante rechazado", "warn"); }}>No llegó</Button>
              </div>
            </Callout>
          )}

          {/* acciones rápidas */}
          {!rescheduling && (primary || open) && (
            <div className="flex flex-wrap gap-2">
              {primary}
              {open && <Button icon={<CalendarClock />} onClick={() => setRescheduling(true)}>Reprogramar</Button>}
              {b.status === "confirmada" && isPast && <Button icon={<UserX />} onClick={() => setStatus(b, "ausente")}>No vino</Button>}
              {b.status === "confirmada" && !isPast && <Button variant="ghost" icon={<CheckCheck />} onClick={() => setStatus(b, "atendida")}>Atendido</Button>}
              {open && <Button variant="danger" icon={<XCircle />} onClick={() => setConfirmCancel(true)}>Cancelar</Button>}
            </div>
          )}
          {rescheduling && <ReschedulePanel b={b} onDone={() => setRescheduling(false)} onCancel={() => setRescheduling(false)} />}

          {/* detalle */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13.5px]">
            <div className="col-span-2">
              <dt className="c-eyebrow">Servicio</dt>
              <dd className="mt-0.5 font-medium">{svcs.length ? svcs.map((s) => s.name).join(" + ") : "Servicio eliminado"}</dd>
            </div>
            <div>
              <dt className="c-eyebrow">Horario</dt>
              <dd className="mt-0.5 tnum">{b.time}–{endOf(data, b)} · {durOf(data, b)} min</dd>
            </div>
            <div>
              <dt className="c-eyebrow">Profesional</dt>
              <dd className="mt-0.5">
                {data.professionals.length ? (
                  <select
                    className="c-select"
                    style={{ height: 32 }}
                    aria-label="Profesional asignado"
                    value={b.proId || ""}
                    onChange={(e) => {
                      const r = store.rescheduleBooking(b.id, b.date, b.time, e.target.value, true);
                      if (!r.ok) store.toast(r.error || "No se pudo reasignar", "warn");
                      else store.toast(`Asignado a ${data.professionals.find((p) => p.id === e.target.value)?.name || "sin profesional"}`);
                    }}
                  >
                    <option value="">Sin asignar</option>
                    {data.professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                ) : (
                  <span className="text-[var(--text-3)]">—</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="c-eyebrow">Origen</dt>
              <dd className="mt-0.5 flex items-center gap-1.5">{b.source === "online" ? <><Globe className="h-3.5 w-3.5 text-[var(--brand)]" /> Reservó online</> : "Cargado por el negocio"}</dd>
            </div>
            <div>
              <dt className="c-eyebrow">Creado</dt>
              <dd className="mt-0.5">{b.createdAt ? relTime(b.createdAt) : "—"}</dd>
            </div>
          </dl>

          {/* cliente */}
          <section className="rounded-[var(--r-lg)] border border-[var(--line)]">
            <button type="button" className="c-list-row rounded-t-[var(--r-lg)]" onClick={() => openClient(clientKeyOf(b.phone, b.client))}>
              <Avatar name={b.client} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{b.client}</span>
                <span className="block truncate text-[12.5px] text-[var(--text-3)]">
                  {client ? `${client.visits} visita${client.visits === 1 ? "" : "s"}${client.noShows ? ` · ${client.noShows} ausencia${client.noShows === 1 ? "" : "s"}` : ""}${client.cancelled ? ` · ${client.cancelled} cancelación${client.cancelled === 1 ? "" : "es"}` : ""}` : "Cliente nuevo"}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 text-[var(--text-3)]" />
            </button>
            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] px-3 py-2.5">
              {hasPhone(b.phone) ? (
                <>
                  <Menu
                    align="left"
                    items={[
                      { label: "Recordatorio del turno", icon: <MessageCircle />, href: wa("recordatorio") },
                      { label: "Confirmación", icon: <MessageCircle />, href: wa("confirmacion") },
                      { label: "Aviso de cambio de horario", icon: <MessageCircle />, href: wa("reprogramado") },
                      { label: "Pedir una reseña", icon: <MessageCircle />, href: wa("resena") },
                      { label: "Mensaje libre", icon: <MessageCircle />, href: wa("libre") },
                    ]}
                    trigger={(p) => <Button size="sm" variant="soft" icon={<MessageCircle />} {...p}>WhatsApp</Button>}
                  />
                  <a className="c-btn c-btn--secondary c-btn--sm" href={`tel:${b.phone.replace(/[^+\d]/g, "")}`}><Phone /> Llamar</a>
                  <span className="text-[12.5px] text-[var(--text-3)] tnum">{formatArgentinaPhone(b.phone)}</span>
                </>
              ) : (
                <button type="button" className="text-[12.5px] text-[var(--brand)] hover:underline" onClick={() => setEditing(true)}>+ Agregar teléfono</button>
              )}
              {b.email && <a className="flex items-center gap-1 text-[12.5px] text-[var(--text-3)] hover:text-[var(--text)]" href={`mailto:${b.email}`}><Mail className="h-3.5 w-3.5" />{b.email}</a>}
            </div>
          </section>

          {b.notes && (
            <div>
              <p className="c-eyebrow mb-1">Lo que escribió el cliente</p>
              <p className="whitespace-pre-wrap rounded-[var(--r-md)] bg-[var(--surface-2)] px-3 py-2 text-[13.5px] text-[var(--text-2)]">{b.notes}</p>
            </div>
          )}

          <Field label="Nota interna" hint="Solo la ves vos. Se guarda al salir del campo." htmlFor="c-bnote">
            <textarea id="c-bnote" className="c-textarea" rows={2} placeholder="Ej: viene con su hija, quiere probar color nuevo…" value={note} onChange={(e) => setNote(e.target.value)} onBlur={saveNote} maxLength={500} />
          </Field>

          {/* cobro */}
          <section>
            <p className="c-eyebrow mb-1.5">Cobro</p>
            <div className="rounded-[var(--r-lg)] border border-[var(--line)] text-[13.5px]">
              <div className="space-y-1.5 px-3 py-2.5">
                {svcs.map((s) => (
                  <div key={s.id} className="flex justify-between gap-2"><span className="text-[var(--text-2)]">{s.name}</span><span className="tnum">{money(s.price)}</span></div>
                ))}
                {products.map(({ it, p }) => (
                  <div key={it.productId} className="flex justify-between gap-2"><span className="text-[var(--text-2)]">{it.qty}× {p?.name || "Producto"}</span><span className="tnum">{money((p?.price || 0) * it.qty)}</span></div>
                ))}
                {b.paidDeposit && <div className="flex justify-between gap-2 text-[var(--brand)]"><span>Seña recibida</span><span className="tnum">−{money(deposit)}</span></div>}
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] px-3 py-2.5">
                <span className="font-medium">{paidFull ? "Cobrado" : "Saldo a cobrar"}</span>
                <span className="font-semibold tnum">{money(paidFull ? b.paidAmount || total : balance)}</span>
              </div>
              {!paidFull && b.status !== "cancelada" && total > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--line)] px-3 py-2.5">
                  <span className="mr-1 text-[12.5px] text-[var(--text-3)]">Registrar cobro:</span>
                  {(["efectivo", "transferencia", "tarjeta"] as const).map((m) => (
                    <Button key={m} size="sm" onClick={() => { store.markBookingPaid(b.id, m, total); if (b.status === "confirmada" && isPast) store.setStatus(b.id, "atendida"); store.toast(`Cobro de ${money(total)} registrado (${m})`); }}>
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </Button>
                  ))}
                </div>
              )}
              {paidFull && b.finalPaymentMethod && <p className="border-t border-[var(--line)] px-3 py-2 text-[12.5px] text-[var(--text-3)]">Pagado en {b.finalPaymentMethod}.</p>}
            </div>
          </section>

          {b.cancelReason && b.status === "cancelada" && <Callout icon={<AlertTriangle />}>Motivo: {b.cancelReason}</Callout>}

          {/* historial */}
          {(b.events?.length || b.createdAt) && (
            <section>
              <p className="c-eyebrow mb-1.5">Historial</p>
              <ol className="relative space-y-2.5 border-l border-[var(--line-2)] pl-4">
                {(b.events?.length ? b.events : [{ at: b.createdAt || 0, type: "creada" as const, by: b.source === "online" ? ("cliente" as const) : ("negocio" as const) }])
                  .slice()
                  .reverse()
                  .map((e, i) => (
                    <li key={i} className="text-[13px]">
                      <span className="absolute -left-[4.5px] mt-1.5 h-2 w-2 rounded-full bg-[var(--line-2)]" />
                      <span className="text-[var(--text)]">{EVENT_LABEL[e.type] || e.type}</span>
                      {e.by === "cliente" && <span className="text-[var(--text-3)]"> · por el cliente</span>}
                      {e.detail && <span className="text-[var(--text-3)]"> · {e.detail}</span>}
                      <span className="block text-[11.5px] text-[var(--text-3)]">{e.at ? `${relTime(e.at)} · ${new Date(e.at).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}</span>
                    </li>
                  ))}
              </ol>
            </section>
          )}
          <p className="text-[12px] text-[var(--text-3)]">{longDate(b.date)} · {STATUS_LABEL[b.status]}</p>
        </div>
      </Sheet>

      {editing && (
        <Sheet
          side="center"
          size="narrow"
          onClose={() => setEditing(false)}
          title="Datos del cliente"
          footer={
            <>
              <Button onClick={() => setEditing(false)}>Cancelar</Button>
              <Button variant="primary" onClick={() => {
                if (editName.trim().length < 2) return;
                store.updateBooking(b.id, { client: editName.trim(), phone: editPhone.trim(), email: editEmail.trim() || undefined });
                store.toast("Datos actualizados");
                setEditing(false);
              }}>Guardar</Button>
            </>
          }
        >
          <div className="space-y-3">
            <Field label="Nombre" htmlFor="c-ed-n"><input id="c-ed-n" data-autofocus className="c-input" value={editName} onChange={(e) => setEditName(e.target.value)} /></Field>
            <Field label="Celular" htmlFor="c-ed-p"><input id="c-ed-p" className="c-input" type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} /></Field>
            <Field label="Email" hint="Para enviarle el recordatorio automático" htmlFor="c-ed-e"><input id="c-ed-e" className="c-input" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} /></Field>
          </div>
        </Sheet>
      )}
      {confirmCancel && (
        <Confirm
          title="¿Cancelar este turno?"
          text={<>El horario de {b.client} ({dayLabel(b.date)} {b.time}) queda libre para otra reserva.{hasPhone(b.phone) && <> Después podés avisarle por WhatsApp.</>}</>}
          confirmLabel="Sí, cancelar turno"
          cancelLabel="No, mantener"
          danger
          onConfirm={() => {
            setStatus(b, "cancelada");
            if (hasPhone(b.phone)) setTimeout(() => store.toast("¿Le avisás al cliente?", "ok", { label: "Enviar WhatsApp", onClick: () => window.open(wa("cancelado"), "_blank") }, 8000), 400);
          }}
          onClose={() => setConfirmCancel(false)}
        />
      )}
      {confirmDelete && (
        <Confirm
          title="¿Eliminar el turno?"
          text="Se borra de la agenda y del historial del cliente. Si solo no va a venir, mejor cancelalo."
          confirmLabel="Eliminar"
          danger
          onConfirm={() => {
            const copy = { ...b };
            store.removeBooking(b.id);
            onClose();
            store.toast("Turno eliminado", "warn", { label: "Deshacer", onClick: () => store.restoreBooking(copy) }, 7000);
          }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}
