import { useMemo, useState, type FormEvent } from "react";
import { Check, Plus, AlertTriangle, Clock, Search } from "lucide-react";
import { useStore } from "../../lib/store";
import { slotsFor, durationOf } from "../../lib/availability";
import { formatArgentinaPhone } from "../../lib/phone";
import { Button, Callout, Field, Sheet } from "./ui";
import { usePanel, type NewBookingPrefill } from "./context";
import { buildClients, dayLabel, hasPhone, money, nowHHMM, parseKey, shiftKey, todayKey, waLink, waMessage } from "./helpers";

export function DayStrip({ value, onChange, from, days = 14, hasFree }: { value: string; onChange: (k: string) => void; from?: string; days?: number; hasFree?: (k: string) => boolean }) {
  const start = from || todayKey();
  const list = Array.from({ length: days }, (_, i) => shiftKey(start, i));
  return (
    <div className="c-days" role="group" aria-label="Elegir día">
      {list.map((k) => {
        const d = parseKey(k);
        const lbl = k === todayKey() ? "hoy" : d.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", "");
        const free = hasFree ? hasFree(k) : true;
        return (
          <button key={k} type="button" className="c-day" aria-pressed={value === k} onClick={() => onChange(k)} aria-label={`${dayLabel(k, { long: true })}${free ? "" : ", sin lugar"}`}>
            <small>{lbl}</small>
            <b>{d.getDate()}</b>
            <i className={free ? "" : "off"} />
          </button>
        );
      })}
    </div>
  );
}

export function SlotGrid({ slots, value, onChange, showTaken = false }: { slots: { time: string; free: boolean }[]; value: string; onChange: (t: string) => void; showTaken?: boolean }) {
  const visible = showTaken ? slots : slots.filter((s) => s.free);
  const groups: [string, typeof visible][] = [
    ["Mañana", visible.filter((s) => s.time < "12:00")],
    ["Tarde", visible.filter((s) => s.time >= "12:00" && s.time < "19:00")],
    ["Noche", visible.filter((s) => s.time >= "19:00")],
  ];
  return (
    <div className="space-y-3">
      {groups.filter(([, l]) => l.length).map(([label, list]) => (
        <div key={label}>
          <p className="mb-1.5 text-[11.5px] font-medium text-[var(--text-3)]">{label}</p>
          <div className="c-slots">
            {list.map((s) => (
              <button key={s.time} type="button" className="c-slot" disabled={!s.free} aria-pressed={value === s.time} onClick={() => onChange(s.time)}>
                {s.time}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function BookingForm({ prefill, onClose }: { prefill?: NewBookingPrefill; onClose: () => void }) {
  const store = useStore();
  const { data, user, go, openBooking } = usePanel();
  const clients = useMemo(() => buildClients(data), [data]);

  const [name, setName] = useState(prefill?.client || "");
  const [phone, setPhone] = useState(prefill?.phone || "");
  const [showSuggest, setShowSuggest] = useState(false);
  const [serviceIds, setServiceIds] = useState<string[]>(() => {
    if (prefill?.serviceId && data.services.some((s) => s.id === prefill.serviceId)) return [prefill.serviceId];
    return data.services.length === 1 ? [data.services[0].id] : [];
  });
  const [proId, setProId] = useState(prefill?.proId || "");
  const [date, setDate] = useState(prefill?.date && prefill.date >= todayKey() ? prefill.date : prefill?.date || todayKey());
  const [time, setTime] = useState(prefill?.time || "");
  const [manual, setManual] = useState(false);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pro = data.professionals.find((p) => p.id === proId);
  const dur = serviceIds.length ? durationOf(data, serviceIds, pro) : 0;
  const price = serviceIds.reduce((a, id) => a + (data.services.find((s) => s.id === id)?.price || 0), 0);

  const slots = useMemo(() => {
    if (!serviceIds.length) return [];
    const list = slotsFor(data, { date, serviceIds, proId: proId || undefined });
    const now = nowHHMM();
    return date === todayKey() ? list.filter((s) => s.time > now || s.time === time) : list;
  }, [data, date, serviceIds, proId, time]);

  // Si el horario precargado (ej: clic en la grilla) no está en la lista, se trata como horario manual.
  const timeInGrid = !time || slots.some((s) => s.time === time && s.free);
  const isManual = manual || (!!time && !timeInGrid);

  const freeByDay = useMemo(() => {
    const m = new Map<string, boolean>();
    if (!serviceIds.length) return m;
    const now = nowHHMM();
    for (let i = 0; i < 14; i++) {
      const k = shiftKey(todayKey(), i);
      const l = slotsFor(data, { date: k, serviceIds, proId: proId || undefined });
      m.set(k, l.some((s) => s.free && (k !== todayKey() || s.time > now)));
    }
    return m;
  }, [data, serviceIds, proId]);

  const q = name.trim().toLowerCase();
  const digits = phone.replace(/\D/g, "");
  const suggestions = useMemo(() => {
    if (q.length < 2 && digits.length < 3) return [];
    return clients
      .filter((c) => (q.length >= 2 && c.name.toLowerCase().includes(q)) || (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits)))
      .filter((c) => !(c.name === name && c.phone === phone))
      .slice(0, 5);
  }, [clients, q, digits, name, phone]);
  const known = clients.find((c) => c.phone && c.phone.replace(/\D/g, "").slice(-8) === digits.slice(-8) && digits.length >= 8);

  const toggleService = (id: string) => {
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setError(null);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (name.trim().length < 2) return setError("Escribí el nombre del cliente.");
    if (!serviceIds.length) return setError("Elegí al menos un servicio.");
    if (!time) return setError("Elegí un horario.");
    setBusy(true);
    const res = prefill?.waitlistId
      ? store.createBookingFromWaitlist(prefill.waitlistId, { client: name, phone, serviceId: serviceIds[0], date, time, source: "manual", proId: proId || undefined })
      : store.addBooking({ client: name, phone, serviceId: serviceIds[0], extraServiceIds: serviceIds.slice(1), date, time, source: "manual", proId: proId || undefined, internalNote: note, force: isManual });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    const created = { id: res.id, client: name.trim(), phone: phone.trim(), serviceId: serviceIds[0], extraServiceIds: serviceIds.slice(1), date, time, status: "confirmada" as const, source: "manual" as const };
    store.toast(
      `Turno creado · ${dayLabel(date)} ${time}`,
      "ok",
      hasPhone(phone)
        ? { label: "Avisar por WhatsApp", onClick: () => window.open(waLink(phone, waMessage("confirmacion", { business: user.business, b: created, data })), "_blank") }
        : { label: "Ver", onClick: () => openBooking(res.id) },
      7000
    );
    onClose();
  };

  if (!data.services.length) {
    return (
      <Sheet onClose={onClose} title="Nuevo turno">
        <Callout tone="warn" icon={<AlertTriangle />}>
          Para agendar necesitás al menos un servicio (nombre, duración y precio).
        </Callout>
        <Button variant="primary" className="mt-4" icon={<Plus />} onClick={() => { onClose(); go("servicios", { params: { nuevo: "1" } }); }}>
          Crear mi primer servicio
        </Button>
      </Sheet>
    );
  }

  return (
    <Sheet
      onClose={onClose}
      title={prefill?.waitlistId ? "Dar turno desde la lista de espera" : "Nuevo turno"}
      subtitle={time ? `${dayLabel(date, { long: true })} · ${time} hs${dur ? ` · ${dur} min` : ""}${price ? ` · ${money(price)}` : ""}` : "Completá los datos y elegí un horario libre"}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" form="c-new-booking" loading={busy} icon={<Check />}>
            Crear turno
          </Button>
        </>
      }
    >
      <form id="c-new-booking" onSubmit={submit} className="space-y-5" noValidate>
        {/* cliente */}
        <div>
          <p className="c-section-title">Cliente</p>
          <div className="grid gap-2 sm:grid-cols-[1.3fr_1fr]">
            <div className="relative">
              <div className="c-input-wrap">
                <Search />
                <input
                  data-autofocus
                  className="c-input"
                  placeholder="Nombre y apellido"
                  aria-label="Nombre del cliente"
                  value={name}
                  autoComplete="off"
                  onChange={(e) => { setName(e.target.value); setShowSuggest(true); setError(null); }}
                  onFocus={() => setShowSuggest(true)}
                  onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
                />
              </div>
              {showSuggest && suggestions.length > 0 && (
                <div className="c-suggest" role="listbox" aria-label="Clientes existentes">
                  {suggestions.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      role="option"
                      aria-selected="false"
                      className="c-menu-item h-auto py-2"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setName(c.name); setPhone(c.phone); setShowSuggest(false); if (!serviceIds.length && c.bookings.length) { const last = c.bookings[c.bookings.length - 1]; if (data.services.some((s) => s.id === last.serviceId)) setServiceIds([last.serviceId]); } }}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{c.name}</span>
                        <span className="block truncate text-[12px] text-[var(--text-3)]">{c.phone ? formatArgentinaPhone(c.phone) : "Sin teléfono"} · {c.visits} visita{c.visits === 1 ? "" : "s"}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input className="c-input" type="tel" inputMode="tel" placeholder="Celular (opcional)" aria-label="Celular del cliente" value={phone} onChange={(e) => { setPhone(e.target.value); setShowSuggest(true); }} onBlur={() => setTimeout(() => setShowSuggest(false), 150)} />
          </div>
          {known && (
            <p className="mt-1.5 text-[12px] text-[var(--text-3)]">
              Cliente conocido · {known.visits} visita{known.visits === 1 ? "" : "s"}{known.noShows ? ` · ${known.noShows} ausencia${known.noShows === 1 ? "" : "s"}` : ""}{known.favorite ? ` · suele pedir ${known.favorite}` : ""}
            </p>
          )}
        </div>

        {/* servicios */}
        <div>
          <p className="c-section-title">
            <span>Servicio</span>
            {serviceIds.length > 1 && <span className="font-normal text-[var(--text-3)]">{serviceIds.length} combinados · {dur} min</span>}
          </p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {data.services.map((s) => {
              const on = serviceIds.includes(s.id);
              return (
                <button key={s.id} type="button" className="c-pick" aria-pressed={on} onClick={() => { toggleService(s.id); setTime(""); }}>
                  <span className="c-pick-check">{on && <Check />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">{s.name}</span>
                    <span className="block text-[12px] text-[var(--text-3)]">{(pro?.proDurations?.[s.id] ?? s.duration)} min · {money(s.price)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* profesional */}
        {data.professionals.length > 0 && (
          <div>
            <p className="c-section-title">Profesional</p>
            <div className="c-chip-row flex-wrap">
              <button type="button" className="c-chip" aria-pressed={!proId} onClick={() => { setProId(""); setTime(""); }}>Cualquiera</button>
              {data.professionals.map((p) => (
                <button key={p.id} type="button" className="c-chip" aria-pressed={proId === p.id} onClick={() => { setProId(p.id); setTime(""); }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* día y hora */}
        <div>
          <p className="c-section-title">
            <span>Día y horario</span>
            <input type="date" className="c-input" style={{ width: 150, height: 30, fontSize: 12.5 }} aria-label="Elegir otra fecha" value={date} onChange={(e) => { if (e.target.value) { setDate(e.target.value); setTime(""); } }} />
          </p>
          <DayStrip value={date} onChange={(k) => { setDate(k); setTime(""); }} hasFree={serviceIds.length ? (k) => freeByDay.get(k) ?? true : undefined} />
          <div className="mt-3">
            {!serviceIds.length ? (
              <p className="rounded-[var(--r-md)] border border-dashed border-[var(--line-2)] px-3 py-4 text-center text-[13px] text-[var(--text-3)]">Elegí un servicio para ver los horarios libres.</p>
            ) : slots.filter((s) => s.free).length === 0 && !isManual ? (
              <div className="rounded-[var(--r-md)] border border-dashed border-[var(--line-2)] px-3 py-4 text-center text-[13px] text-[var(--text-3)]">
                No quedan horarios libres el {dayLabel(date).toLowerCase()}.
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {(() => {
                    const next = Array.from({ length: 13 }, (_, i) => shiftKey(date, i + 1)).find((k) => freeByDay.get(k));
                    return next ? <Button size="sm" onClick={() => setDate(next)}>Ir al {dayLabel(next).toLowerCase()}</Button> : null;
                  })()}
                  <Button size="sm" variant="ghost" icon={<Clock />} onClick={() => setManual(true)}>Agendar igual (sobreturno)</Button>
                </div>
              </div>
            ) : (
              <SlotGrid slots={slots} value={isManual ? "" : time} onChange={(t) => { setTime(t); setManual(false); setError(null); }} />
            )}
          </div>
          {serviceIds.length > 0 && (
            <div className="mt-3">
              {!isManual ? (
                <button type="button" className="text-[12.5px] font-medium text-[var(--brand)] hover:underline" onClick={() => setManual(true)}>
                  + Otro horario (fuera de grilla o sobreturno)
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <Field label="Horario manual" htmlFor="c-manual-time">
                    <input id="c-manual-time" type="time" step={300} className="c-input" style={{ width: 130 }} value={time} onChange={(e) => setTime(e.target.value)} />
                  </Field>
                  <p className="mt-5 flex-1 text-[12px] text-[var(--text-3)]">Se agenda aunque esté fuera del horario de atención. Igual avisamos si pisa otro turno.</p>
                  <Button size="sm" variant="ghost" className="mt-5" onClick={() => { setManual(false); setTime(""); }}>Usar grilla</Button>
                </div>
              )}
            </div>
          )}
        </div>

        {!prefill?.waitlistId && (
          <div>
            {showNote ? (
              <Field label="Nota interna" hint="Solo la ves vos. Ej: trae su propio producto, prefiere a Lucas." htmlFor="c-note">
                <textarea id="c-note" className="c-textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
              </Field>
            ) : (
              <button type="button" className="text-[12.5px] font-medium text-[var(--text-2)] hover:text-[var(--text)]" onClick={() => setShowNote(true)}>
                + Agregar nota interna
              </button>
            )}
          </div>
        )}

        {error && <Callout tone="danger" icon={<AlertTriangle />}><span role="alert">{error}</span></Callout>}
      </form>
    </Sheet>
  );
}

