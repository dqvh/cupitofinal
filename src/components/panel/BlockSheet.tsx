import { useMemo, useState } from "react";
import { AlertTriangle, Ban } from "lucide-react";
import { useStore } from "../../lib/store";
import { toMin } from "../../lib/availability";
import { Button, Callout, Field, Sheet, Toggle } from "./ui";
import { usePanel, type BlockPrefill } from "./context";
import { dayLabel, durOf, shiftKey, todayKey } from "./helpers";

const REASONS = ["Almuerzo", "Trámite", "Turno médico", "Capacitación", "Vacaciones"];

export default function BlockSheet({ prefill, onClose }: { prefill?: BlockPrefill; onClose: () => void }) {
  const store = useStore();
  const { data, openBooking } = usePanel();
  const [date, setDate] = useState(prefill?.date || todayKey());
  const [until, setUntil] = useState(prefill?.date || todayKey());
  const [allDay, setAllDay] = useState(!prefill?.time);
  const [from, setFrom] = useState(prefill?.time || "13:00");
  const [to, setTo] = useState(prefill?.endTime || (prefill?.time ? `${String(Math.min(23, Number(prefill.time.slice(0, 2)) + 1)).padStart(2, "0")}:${prefill.time.slice(3)}` : "14:00"));
  const [proId, setProId] = useState(prefill?.proId || "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const days = useMemo(() => {
    if (!allDay || until <= date) return [date];
    const out: string[] = [];
    for (let k = date; k <= until && out.length < 62; k = shiftKey(k, 1)) out.push(k);
    return out;
  }, [allDay, date, until]);

  const affected = useMemo(
    () =>
      data.bookings.filter((b) => {
        if (!days.includes(b.date) || b.status === "cancelada") return false;
        if (proId && b.proId && b.proId !== proId) return false;
        if (allDay) return true;
        const s = toMin(b.time);
        const e = s + durOf(data, b);
        return s < toMin(to) && toMin(from) < e;
      }),
    [data, days, proId, allDay, from, to]
  );

  const save = () => {
    if (!allDay && toMin(to) <= toMin(from)) return setError("La hora de fin tiene que ser posterior al inicio.");
    days.forEach((d) =>
      store.addBlockedSlot({ date: d, time: allDay ? undefined : from, endTime: allDay ? undefined : to, proId: proId || undefined, reason: reason.trim() || (allDay ? "No disponible" : "Bloqueado") })
    );
    store.toast(days.length > 1 ? `${days.length} días bloqueados` : `Horario bloqueado · ${dayLabel(date)}${allDay ? "" : ` ${from}–${to}`}`);
    onClose();
  };

  return (
    <Sheet
      side="center"
      onClose={onClose}
      title="Bloquear horario"
      subtitle="Nadie va a poder reservar en ese rango. Los turnos que ya existen no se tocan."
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" icon={<Ban />} onClick={save}>Bloquear{days.length > 1 ? ` ${days.length} días` : ""}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="c-chip-row flex-wrap">
          {REASONS.map((r) => (
            <button key={r} type="button" className="c-chip" aria-pressed={reason === r} onClick={() => { setReason(reason === r ? "" : r); if (r === "Vacaciones") setAllDay(true); if (r === "Almuerzo") { setAllDay(false); setFrom("13:00"); setTo("14:00"); } }}>
              {r}
            </button>
          ))}
        </div>
        <label className="flex items-center justify-between gap-3 rounded-[var(--r-md)] border border-[var(--line)] px-3 py-2.5">
          <span>
            <span className="block text-[13.5px] font-medium">Todo el día</span>
            <span className="block text-[12px] text-[var(--text-3)]">Ideal para feriados personales o vacaciones</span>
          </span>
          <Toggle checked={allDay} onChange={setAllDay} label="Bloquear todo el día" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={allDay ? "Desde el día" : "Día"} htmlFor="c-bl-d">
            <input id="c-bl-d" type="date" className="c-input" value={date} onChange={(e) => { setDate(e.target.value); if (until < e.target.value) setUntil(e.target.value); }} />
          </Field>
          {allDay ? (
            <Field label="Hasta el día" htmlFor="c-bl-u" hint={days.length > 1 ? `${days.length} días` : "Mismo día"}>
              <input id="c-bl-u" type="date" className="c-input" min={date} value={until} onChange={(e) => setUntil(e.target.value)} />
            </Field>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Desde" htmlFor="c-bl-f"><input id="c-bl-f" type="time" className="c-input" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
              <Field label="Hasta" htmlFor="c-bl-t"><input id="c-bl-t" type="time" className="c-input" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
            </div>
          )}
        </div>
        {data.professionals.length > 0 && (
          <Field label="¿Para quién?" htmlFor="c-bl-p">
            <select id="c-bl-p" className="c-select" value={proId} onChange={(e) => setProId(e.target.value)}>
              <option value="">Todo el negocio</option>
              {data.professionals.map((p) => <option key={p.id} value={p.id}>Solo {p.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Motivo (opcional)" htmlFor="c-bl-r" hint="Solo lo ves vos en la agenda.">
          <input id="c-bl-r" className="c-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: almuerzo, trámite, vacaciones" maxLength={60} />
        </Field>
        {affected.length > 0 && (
          <Callout tone="warn" icon={<AlertTriangle />}>
            <p className="font-medium">Ya hay {affected.length} turno{affected.length === 1 ? "" : "s"} en ese rango.</p>
            <p className="text-[12.5px]">No se cancelan solos: reprogramalos o avisales.</p>
            <ul className="mt-1.5 space-y-0.5 text-[12.5px]">
              {affected.slice(0, 5).map((b) => (
                <li key={b.id}>
                  <button type="button" className="underline" onClick={() => openBooking(b.id)}>{dayLabel(b.date)} {b.time} · {b.client}</button>
                </li>
              ))}
            </ul>
          </Callout>
        )}
        {error && <p className="c-error" role="alert">{error}</p>}
      </div>
    </Sheet>
  );
}
