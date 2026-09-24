import { Copy, Scissors, X } from "lucide-react";
import type { DayHours } from "../../lib/store";
import { Toggle } from "./ui";

export const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export function hoursSummary(hours: DayHours[]) {
  const open = ORDER.filter((i) => hours[i]?.open);
  if (!open.length) return "Cerrado toda la semana";
  const label = (h: DayHours) => `${h.from}–${h.to}${h.from2 && h.to2 ? ` y ${h.from2}–${h.to2}` : ""}`;
  const groups: { days: number[]; label: string }[] = [];
  for (const i of open) {
    const l = label(hours[i]);
    const last = groups[groups.length - 1];
    const prevIdx = last ? ORDER.indexOf(last.days[last.days.length - 1]) : -2;
    if (last && last.label === l && ORDER.indexOf(i) === prevIdx + 1) last.days.push(i);
    else groups.push({ days: [i], label: l });
  }
  const short = (i: number) => DAY_NAMES[i].slice(0, 3);
  return groups.map((g) => `${g.days.length > 2 ? `${short(g.days[0])} a ${short(g.days[g.days.length - 1])}` : g.days.map(short).join(" y ")} ${g.label}`).join(" · ");
}

export default function HoursEditor({ hours, onChange, compact }: { hours: DayHours[]; onChange: (h: DayHours[]) => void; compact?: boolean }) {
  const set = (i: number, patch: Partial<DayHours>) => onChange(hours.map((h, idx) => (idx === i ? { ...h, ...patch } : h)));
  const copyToAll = (i: number, weekdaysOnly: boolean) => {
    const src = hours[i];
    onChange(hours.map((h, idx) => (idx === i || (weekdaysOnly && (idx === 0 || idx === 6)) ? h : { ...src })));
  };
  return (
    <div className="c-divide rounded-[var(--r-lg)] border border-[var(--line)]">
      {ORDER.map((i) => {
        const h = hours[i];
        const split = h.from2 !== undefined && h.from2 !== "";
        const time = (label: string, value: string, onChange: (v: string) => void) => (
          <input aria-label={label} type="time" className="c-input min-w-0 flex-1 sm:flex-none" style={{ height: 34, maxWidth: 132 }} value={value} onChange={(e) => onChange(e.target.value)} />
        );
        return (
          <div key={i} className={`grid grid-cols-1 gap-2 px-3 sm:grid-cols-[132px_minmax(0,1fr)] sm:items-center ${compact ? "py-2" : "py-2.5"}`} style={{ background: h.open ? undefined : "var(--surface-2)" }}>
            <div className="flex items-center gap-2.5">
              <Toggle checked={h.open} onChange={(v) => set(i, { open: v })} label={`Abrir ${DAY_NAMES[i]}`} />
              <span className={`text-[13.5px] ${h.open ? "font-medium" : "text-[var(--text-3)]"}`}>{DAY_NAMES[i]}</span>
              {!h.open && <span className="ml-auto text-[13px] text-[var(--text-3)] sm:hidden">Cerrado</span>}
            </div>
            {h.open ? (
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                <span className="flex min-w-0 flex-1 items-center gap-1.5 sm:flex-none">
                  {time(`${DAY_NAMES[i]}: apertura`, h.from, (v) => set(i, { from: v }))}
                  <span className="text-[12px] text-[var(--text-3)]">a</span>
                  {time(`${DAY_NAMES[i]}: cierre`, h.to, (v) => set(i, { to: v }))}
                </span>
                {split && (
                  <span className="flex min-w-0 basis-full items-center gap-1.5 sm:basis-auto">
                    <span className="text-[12px] text-[var(--text-3)]">y</span>
                    {time(`${DAY_NAMES[i]}: reapertura`, h.from2 || "", (v) => set(i, { from2: v }))}
                    <span className="text-[12px] text-[var(--text-3)]">a</span>
                    {time(`${DAY_NAMES[i]}: segundo cierre`, h.to2 || "20:00", (v) => set(i, { to2: v }))}
                    <button type="button" className="grid h-7 w-7 shrink-0 place-items-center rounded text-[var(--text-3)] hover:bg-[var(--surface-3)]" aria-label={`Quitar corte del ${DAY_NAMES[i]}`} onClick={() => set(i, { from2: undefined, to2: undefined })}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                )}
                <span className="flex basis-full items-center gap-1 sm:ml-auto sm:basis-auto">
                  {!split && (
                    <button type="button" className="mr-auto inline-flex items-center gap-1 rounded px-1.5 py-1 text-[12.5px] font-medium text-[var(--text-2)] hover:text-[var(--brand)] sm:mr-2" onClick={() => set(i, { to: h.to > "13:00" ? "13:00" : h.to, from2: "15:00", to2: h.to > "15:00" ? h.to : "20:00" })}>
                      <Scissors className="h-3.5 w-3.5" /> Agregar corte
                    </button>
                  )}
                  <button type="button" className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[12px] text-[var(--text-3)] hover:bg-[var(--surface-3)] hover:text-[var(--text)]" onClick={() => copyToAll(i, true)} title="Copiar este horario de lunes a viernes">
                    <Copy className="h-3.5 w-3.5" /> Lun–Vie
                  </button>
                  <button type="button" className="rounded px-1.5 py-1 text-[12px] text-[var(--text-3)] hover:bg-[var(--surface-3)] hover:text-[var(--text)]" onClick={() => copyToAll(i, false)} title="Copiar a todos los días">
                    Todos
                  </button>
                </span>
              </div>
            ) : (
              <span className="hidden text-[13px] text-[var(--text-3)] sm:block">Cerrado</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
