import { useEffect, useMemo, useState } from "react";
import { Ban, CalendarX2, Plus, Trash2, Save, CalendarRange } from "lucide-react";
import { useStore, type DayHours } from "../../lib/store";
import { validateHours } from "../../lib/scheduling";
import { Button, Card, Field, PageHead, Segmented, Sheet } from "./ui";
import { usePanel } from "./context";
import HoursEditor, { hoursSummary } from "./HoursEditor";
import { dayLabel, shiftKey, todayKey } from "./helpers";

function WeeklyHours() {
  const store = useStore();
  const { data, user } = usePanel();
  const saved = data.settings.hours;
  const draftKey = `cupito_hours_draft_${user.id}`;
  const [hours, setHours] = useState<DayHours[]>(() => {
    try {
      const d = JSON.parse(sessionStorage.getItem(draftKey) || "null");
      if (Array.isArray(d) && d.length === 7 && d.every((x) => x && typeof x.open === "boolean")) return d;
    } catch { /* sin borrador */ }
    return saved.map((h) => ({ ...h }));
  });
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(hours) !== JSON.stringify(saved);

  useEffect(() => {
    try {
      if (dirty) sessionStorage.setItem(draftKey, JSON.stringify(hours));
      else sessionStorage.removeItem(draftKey);
    } catch { /* noop */ }
  }, [hours, dirty, draftKey]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = () => {
    const issue = validateHours(hours);
    setError(issue);
    if (issue) return;
    store.updateSettings({ hours, hoursConfirmed: true });
    store.toast("Horarios guardados");
  };

  return (
    <Card title="Días y horarios de atención" sub={dirty ? "Tenés cambios sin guardar" : hoursSummary(saved)} bodyClass="p-3 sm:p-4">
      <HoursEditor hours={hours} onChange={(h) => { setHours(h); setError(null); }} />
      <div className={`${dirty ? "sticky shadow-[var(--sh-sm)]" : ""} bottom-[calc(76px+env(safe-area-inset-bottom,0px))] z-10 mt-3 flex flex-wrap items-center gap-2 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] p-2.5 lg:bottom-3`}>
        {error && <p role="alert" className="c-error w-full">{error}</p>}
        <Button variant="primary" icon={<Save />} disabled={!dirty} onClick={save}>Guardar horarios</Button>
        {dirty ? (
          <Button variant="ghost" onClick={() => { setHours(saved.map((h) => ({ ...h }))); setError(null); }}>Descartar cambios</Button>
        ) : (
          <span role="status" className="text-[12.5px] text-[var(--text-3)]">Sin cambios pendientes</span>
        )}
        <span className="ml-auto hidden text-[12px] text-[var(--text-3)] sm:inline">Los turnos tienen que terminar antes del cierre.</span>
      </div>
    </Card>
  );
}

function SpecialDaySheet({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const { data } = usePanel();
  const [kind, setKind] = useState<"cerrado" | "especial">("cerrado");
  const [from, setFrom] = useState(todayKey());
  const [until, setUntil] = useState(todayKey());
  const [open, setOpen] = useState("10:00");
  const [close, setClose] = useState("14:00");
  const [error, setError] = useState<string | null>(null);
  const days = useMemo(() => {
    const out: string[] = [];
    for (let k = from; k <= (until < from ? from : until) && out.length < 92; k = shiftKey(k, 1)) out.push(k);
    return out;
  }, [from, until]);
  const affected = data.bookings.filter((b) => days.includes(b.date) && b.status !== "cancelada" && (kind === "cerrado" || b.time < open || b.time >= close)).length;

  const save = () => {
    if (kind === "especial" && close <= open) return setError("El cierre tiene que ser posterior a la apertura.");
    if (kind === "cerrado") {
      const set = new Set([...(data.settings.closedDates || []), ...days]);
      store.updateSettings({ closedDates: [...set].sort() });
    } else {
      const special = { ...(data.settings.specialHours || {}) };
      days.forEach((d) => { special[d] = { open: true, from: open, to: close }; });
      store.updateSettings({ specialHours: special, closedDates: (data.settings.closedDates || []).filter((d) => !days.includes(d)) });
    }
    store.toast(days.length > 1 ? `${days.length} días actualizados` : `${dayLabel(from)}: ${kind === "cerrado" ? "cerrado" : `${open}–${close}`}`);
    onClose();
  };

  return (
    <Sheet
      side="center"
      onClose={onClose}
      title="Día especial"
      subtitle="Feriados, vacaciones o un día con otro horario."
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={save}>Guardar</Button></>}
    >
      <div className="space-y-4">
        <Segmented block value={kind} onChange={setKind} options={[{ value: "cerrado", label: "Cerrado" }, { value: "especial", label: "Otro horario" }]} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Desde" htmlFor="c-sd-f"><input id="c-sd-f" type="date" className="c-input" min={todayKey()} value={from} onChange={(e) => { setFrom(e.target.value); if (until < e.target.value) setUntil(e.target.value); }} /></Field>
          <Field label="Hasta" htmlFor="c-sd-u" hint={days.length > 1 ? `${days.length} días` : "Un solo día"}><input id="c-sd-u" type="date" className="c-input" min={from} value={until} onChange={(e) => setUntil(e.target.value)} /></Field>
        </div>
        {kind === "especial" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Abre" htmlFor="c-sd-o"><input id="c-sd-o" type="time" className="c-input" value={open} onChange={(e) => setOpen(e.target.value)} /></Field>
            <Field label="Cierra" htmlFor="c-sd-c"><input id="c-sd-c" type="time" className="c-input" value={close} onChange={(e) => setClose(e.target.value)} /></Field>
          </div>
        )}
        {affected > 0 && <p className="c-callout c-callout--warn">Hay {affected} turno(s) agendados en esos días/horarios. No se cancelan: revisalos en la agenda.</p>}
        {error && <p className="c-error" role="alert">{error}</p>}
      </div>
    </Sheet>
  );
}

export default function ScheduleView() {
  const store = useStore();
  const { data, blockTime } = usePanel();
  const [special, setSpecial] = useState(false);
  const today = todayKey();

  const specials = useMemo(() => {
    const closed = (data.settings.closedDates || []).filter((d) => d >= today).map((d) => ({ date: d, label: "Cerrado", closed: true }));
    const other = Object.entries(data.settings.specialHours || {})
      .filter(([d]) => d >= today)
      .map(([d, h]) => ({ date: d, label: h.open ? `${h.from}–${h.to}${h.from2 && h.to2 ? ` y ${h.from2}–${h.to2}` : ""}` : "Cerrado", closed: false }));
    return [...closed, ...other].sort((a, b) => a.date.localeCompare(b.date));
  }, [data.settings, today]);

  const blocks = useMemo(() => (data.blockedSlots || []).filter((b) => b.date >= today).sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || ""))), [data.blockedSlots, today]);

  const removeSpecial = (date: string, closed: boolean) => {
    if (closed) store.updateSettings({ closedDates: (data.settings.closedDates || []).filter((d) => d !== date) });
    else {
      const next = { ...(data.settings.specialHours || {}) };
      delete next[date];
      store.updateSettings({ specialHours: next });
    }
    store.toast(`${dayLabel(date)} vuelve a su horario normal`);
  };

  return (
    <div>
      <PageHead title="Horarios" sub="Cuándo se puede reservar. Todo lo que cambies acá se refleja al instante en tu página." />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <WeeklyHours />
        <div className="space-y-4">
          <Card
            title="Feriados y días especiales"
            sub="Vacaciones, feriados o días con otro horario"
            bodyClass=""
            action={<Button size="sm" icon={<Plus />} onClick={() => setSpecial(true)}>Agregar</Button>}
          >
            {specials.length === 0 ? (
              <p className="px-4 py-4 text-[13px] text-[var(--text-3)]">No hay días especiales cargados.</p>
            ) : (
              <div className="c-divide">
                {specials.map((s) => (
                  <div key={s.date + s.label} className="c-list-row" style={{ minHeight: 44 }}>
                    <CalendarX2 className="h-4 w-4 shrink-0 text-[var(--text-3)]" />
                    <span className="min-w-0 flex-1 text-[13px]"><span className="font-medium">{dayLabel(s.date, { long: true })}</span> <span className="text-[var(--text-3)]">· {s.label}</span></span>
                    <button type="button" className="grid h-7 w-7 place-items-center rounded text-[var(--text-3)] hover:bg-[var(--surface-3)] hover:text-[var(--danger)]" aria-label={`Quitar ${dayLabel(s.date)}`} onClick={() => removeSpecial(s.date, s.closed)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card
            title="Bloqueos de agenda"
            sub="Descansos, trámites o ausencias puntuales"
            bodyClass=""
            action={<Button size="sm" icon={<Ban />} onClick={() => blockTime()}>Bloquear</Button>}
          >
            {blocks.length === 0 ? (
              <p className="px-4 py-4 text-[13px] text-[var(--text-3)]">No hay horarios bloqueados. También podés bloquear desde la agenda.</p>
            ) : (
              <div className="c-divide">
                {blocks.slice(0, 30).map((b) => (
                  <div key={b.id} className="c-list-row" style={{ minHeight: 44 }}>
                    <CalendarRange className="h-4 w-4 shrink-0 text-[var(--text-3)]" />
                    <span className="min-w-0 flex-1 text-[13px]">
                      <span className="font-medium">{dayLabel(b.date)}</span>{" "}
                      <span className="text-[var(--text-3)]">· {b.time ? `${b.time}${b.endTime ? `–${b.endTime}` : ""}` : "todo el día"}{b.proId ? ` · ${data.professionals.find((p) => p.id === b.proId)?.name || "profesional"}` : ""}{b.reason ? ` · ${b.reason}` : ""}</span>
                    </span>
                    <button type="button" className="grid h-7 w-7 place-items-center rounded text-[var(--text-3)] hover:bg-[var(--surface-3)] hover:text-[var(--danger)]" aria-label="Desbloquear" onClick={() => { store.removeBlockedSlot(b.id); store.toast("Horario desbloqueado", "ok", { label: "Deshacer", onClick: () => store.addBlockedSlot({ date: b.date, time: b.time, endTime: b.endTime, proId: b.proId, reason: b.reason }) }, 6000); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
      {special && <SpecialDaySheet onClose={() => setSpecial(false)} />}
    </div>
  );
}
