import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, Plus, Ban, Eye, EyeOff } from "lucide-react";
import { useStore, type Booking, type BlockedSlot } from "../../lib/store";
import { businessHoursOn, proHoursOn, toMin, fromMin } from "../../lib/availability";
import { Button, Confirm, IconButton, Segmented, useMediaQuery, useNow } from "./ui";
import { usePanel } from "./context";
import { BookingItem } from "./BookingsView";
import { dayLabel, durOf, endOf, keyOf, longDate, monthTitle, parseKey, serviceLabel, shiftKey, todayKey, weekStartOf } from "./helpers";

type Mode = "dia" | "semana" | "mes" | "lista";

interface Col {
  key: string;
  date: string;
  proId?: string;
  kind: "all" | "pro" | "unassigned";
  label: string;
  sub?: string;
  color?: string;
  isToday: boolean;
}

const SNAP = 15;

function lanes(items: { id: string; s: number; e: number }[]) {
  // Agrupa turnos superpuestos y los reparte en carriles lado a lado.
  const sorted = [...items].sort((a, b) => a.s - b.s || b.e - a.e);
  const out = new Map<string, { lane: number; of: number }>();
  let cluster: { id: string; s: number; e: number; lane: number }[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const n = Math.max(1, ...cluster.map((c) => c.lane + 1));
    cluster.forEach((c) => out.set(c.id, { lane: c.lane, of: n }));
    cluster = [];
  };
  for (const it of sorted) {
    if (it.s >= clusterEnd && cluster.length) flush();
    const used = new Set(cluster.filter((c) => c.e > it.s).map((c) => c.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    cluster.push({ ...it, lane });
    clusterEnd = Math.max(clusterEnd, it.e);
  }
  if (cluster.length) flush();
  return out;
}

export default function AgendaView() {
  const store = useStore();
  const { data, params, setParams, newBooking, blockTime } = usePanel();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const now = useNow(60000);
  const today = todayKey();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get("d") || "") ? params.get("d")! : today;
  const rawMode = (params.get("v") as Mode) || "dia";
  const mode: Mode = !desktop && rawMode === "semana" ? "lista" : desktop && rawMode === "lista" ? "semana" : rawMode;
  const proFilter = params.get("pro") || "";
  const [showCancelled, setShowCancelled] = useState(false);
  const [unblock, setUnblock] = useState<BlockedSlot | null>(null);
  const pros = data.professionals;
  const dateInput = useRef<HTMLInputElement>(null);

  const setDate = (d: string) => setParams({ d: d === today ? undefined : d });
  const setMode = (m: Mode) => setParams({ v: m === "dia" ? undefined : m });
  const step = (dir: number) => {
    if (mode === "dia") setDate(shiftKey(date, dir));
    else if (mode === "mes") {
      const d = parseKey(date);
      d.setDate(1);
      d.setMonth(d.getMonth() + dir);
      setDate(keyOf(d));
    } else setDate(shiftKey(date, 7 * dir));
  };

  // atajos: T hoy, ← → navegar, D/S/M vistas
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.closest("input, textarea, select, [contenteditable], [role=dialog]")) return;
      if (e.key === "t" || e.key === "T") setDate(today);
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "d" || e.key === "D") setMode("dia");
      else if ((e.key === "s" || e.key === "S") && desktop) setMode("semana");
      else if (e.key === "m" || e.key === "M") setMode("mes");
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  });

  const title = (() => {
    if (mode === "dia") return longDate(date);
    if (mode === "mes") return monthTitle(date);
    const ws = mode === "semana" ? weekStartOf(date) : date;
    const we = shiftKey(ws, mode === "semana" ? 6 : 13);
    const a = parseKey(ws);
    const b = parseKey(we);
    const fmt = (d: Date, withMonth: boolean) => d.toLocaleDateString("es-AR", withMonth ? { day: "numeric", month: "short" } : { day: "numeric" }).replace(".", "");
    return `${fmt(a, a.getMonth() !== b.getMonth())} – ${fmt(b, true)}`;
  })();

  const isCurrent = mode === "mes" ? date.slice(0, 7) === today.slice(0, 7) : mode === "dia" ? date === today : mode === "semana" ? weekStartOf(date) === weekStartOf(today) : date === today;

  return (
    <div>
      <div className="ag-toolbar">
        <Button size="sm" onClick={() => setDate(today)} disabled={isCurrent} aria-label="Ir a hoy">Hoy</Button>
        <div className="flex items-center">
          <IconButton label="Anterior" size="sm" onClick={() => step(-1)}><ChevronLeft /></IconButton>
          <IconButton label="Siguiente" size="sm" onClick={() => step(1)}><ChevronRight /></IconButton>
        </div>
        <button
          type="button"
          className="ag-title-btn relative"
          onClick={() => { const el = dateInput.current; if (el) { try { el.showPicker(); } catch { el.focus(); el.click(); } } }}
          aria-label="Elegir fecha"
        >
          <h1 className="ag-title">{title}</h1>
          <input ref={dateInput} type="date" tabIndex={-1} aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-0" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {pros.length > 0 && (
            <select className="c-select" style={{ height: 32, width: "auto", fontSize: 13 }} aria-label="Filtrar por profesional" value={proFilter} onChange={(e) => setParams({ pro: e.target.value || undefined })}>
              <option value="">Todo el equipo</option>
              {pros.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <Segmented<Mode>
            label="Vista"
            value={mode}
            onChange={setMode}
            options={desktop ? [{ value: "dia", label: "Día" }, { value: "semana", label: "Semana" }, { value: "mes", label: "Mes" }] : [{ value: "dia", label: "Día" }, { value: "lista", label: "Lista" }, { value: "mes", label: "Mes" }]}
          />
          {desktop && (
            <>
              <IconButton label={showCancelled ? "Ocultar cancelados" : "Mostrar cancelados"} size="sm" onClick={() => setShowCancelled((v) => !v)}>
                {showCancelled ? <EyeOff /> : <Eye />}
              </IconButton>
              <Button size="sm" icon={<Ban />} onClick={() => blockTime({ date: mode === "dia" ? date : today, proId: proFilter || undefined })}>Bloquear</Button>
            </>
          )}
        </div>
      </div>

      {mode === "dia" && !desktop && <WeekStrip date={date} onPick={setDate} proFilter={proFilter} />}

      {(mode === "dia" || mode === "semana") && (
        <TimeGrid
          mode={mode}
          date={date}
          proFilter={proFilter}
          showCancelled={showCancelled}
          now={now}
          onUnblock={setUnblock}
          onDay={(d) => setParams({ d, v: undefined })}
        />
      )}
      {mode === "mes" && <MonthGrid date={date} proFilter={proFilter} onDay={(d) => setParams({ d, v: undefined })} />}
      {mode === "lista" && <AgendaList date={date} proFilter={proFilter} />}

      {pros.length > 0 && (mode === "dia" || mode === "semana") && (
        <div className="ag-legend" aria-hidden="true">
          {pros.map((p) => <span key={p.id}><i style={{ background: p.color }} />{p.name}</span>)}
          <span><i style={{ background: "#fff3db", border: "1px dashed #e0b35e" }} />Por confirmar</span>
          <span><i style={{ background: "repeating-linear-gradient(-45deg,#eceeea 0 3px,#e1e4df 3px 6px)" }} />Bloqueado / cerrado</span>
          {desktop && <span className="ml-auto">Clic en un espacio libre para agendar · arrastrá un turno para moverlo</span>}
        </div>
      )}
      {!desktop && mode !== "mes" && (
        <div className="mt-3 flex gap-2">
          <Button block icon={<Ban />} onClick={() => blockTime({ date, proId: proFilter || undefined })}>Bloquear horario</Button>
          <Button block variant="primary" icon={<Plus />} onClick={() => newBooking({ date, proId: proFilter || undefined })}>Turno</Button>
        </div>
      )}

      {unblock && (
        <Confirm
          title="¿Desbloquear este horario?"
          text={<>{dayLabel(unblock.date, { long: true })}{unblock.time ? ` · ${unblock.time}${unblock.endTime ? `–${unblock.endTime}` : ""}` : " · todo el día"}{unblock.reason ? ` · ${unblock.reason}` : ""}. Vuelve a estar disponible para reservas.</>}
          confirmLabel="Desbloquear"
          onConfirm={() => {
            const copy = { ...unblock };
            store.removeBlockedSlot(unblock.id);
            store.toast("Horario desbloqueado", "ok", { label: "Deshacer", onClick: () => store.addBlockedSlot({ date: copy.date, time: copy.time, endTime: copy.endTime, proId: copy.proId, reason: copy.reason }) }, 6000);
          }}
          onClose={() => setUnblock(null)}
        />
      )}
    </div>
  );
}

/* ---------- tira de semana (mobile) ---------- */

function WeekStrip({ date, onPick, proFilter }: { date: string; onPick: (d: string) => void; proFilter: string }) {
  const { data } = usePanel();
  const ws = weekStartOf(date);
  const today = todayKey();
  return (
    <div className="mb-2 grid grid-cols-7 gap-1" role="group" aria-label="Semana">
      {Array.from({ length: 7 }, (_, i) => shiftKey(ws, i)).map((k) => {
        const d = parseKey(k);
        const n = data.bookings.filter((b) => b.date === k && b.status !== "cancelada" && (!proFilter || b.proId === proFilter)).length;
        const closed = !businessHoursOn(data.settings, k)?.open;
        return (
          <button
            key={k}
            type="button"
            onClick={() => onPick(k)}
            aria-pressed={k === date}
            aria-label={`${dayLabel(k, { long: true })}, ${n} turnos`}
            className="flex flex-col items-center gap-0.5 rounded-[10px] py-1.5 aria-[pressed=true]:bg-[var(--text)] aria-[pressed=true]:text-white"
            style={{ opacity: closed && k !== date ? 0.5 : 1 }}
          >
            <span className="text-[10.5px] font-medium uppercase opacity-70">{d.toLocaleDateString("es-AR", { weekday: "narrow" })}</span>
            <span className={`grid h-7 w-7 place-items-center rounded-full text-[14px] font-semibold ${k === today && k !== date ? "text-[var(--brand)]" : ""}`}>{d.getDate()}</span>
            <span className="h-1 w-1 rounded-full" style={{ background: n ? (k === date ? "#fff" : "var(--brand)") : "transparent" }} />
          </button>
        );
      })}
    </div>
  );
}

/* ---------- grilla horaria ---------- */

function TimeGrid({
  mode,
  date,
  proFilter,
  showCancelled,
  now,
  onUnblock,
  onDay,
}: {
  mode: "dia" | "semana";
  date: string;
  proFilter: string;
  showCancelled: boolean;
  now: Date;
  onUnblock: (b: BlockedSlot) => void;
  onDay: (d: string) => void;
}) {
  const store = useStore();
  const { data, openBooking, newBooking } = usePanel();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const today = todayKey();
  const pros = data.professionals;
  const box = useRef<HTMLDivElement>(null);
  const colRefs = useRef(new Map<string, HTMLDivElement>());
  const suppressClick = useRef(false);
  const [drag, setDrag] = useState<{ id: string; colKey: string; start: number; dur: number } | null>(null);

  const visible = (b: Booking) => (showCancelled || b.status !== "cancelada");

  const cols: Col[] = useMemo(() => {
    if (mode === "semana") {
      const ws = weekStartOf(date);
      return Array.from({ length: 7 }, (_, i) => {
        const k = shiftKey(ws, i);
        const d = parseKey(k);
        const n = data.bookings.filter((b) => b.date === k && b.status !== "cancelada" && (!proFilter || b.proId === proFilter)).length;
        return { key: k, date: k, kind: proFilter ? "pro" : "all", proId: proFilter || undefined, label: d.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", ""), sub: `${d.getDate()}|${n}`, isToday: k === today } as Col;
      });
    }
    if (!pros.length) return [{ key: "all", date, kind: "all", label: "Agenda", isToday: date === today }];
    const list = proFilter ? pros.filter((p) => p.id === proFilter) : pros;
    const out: Col[] = list.map((p) => {
      const n = data.bookings.filter((b) => b.date === date && b.proId === p.id && b.status !== "cancelada").length;
      const h = proHoursOn(data.settings, p, date);
      return { key: p.id, date, proId: p.id, kind: "pro", label: p.name, color: p.color, sub: h?.open ? `${n} turno${n === 1 ? "" : "s"}` : "No atiende", isToday: date === today };
    });
    if (!proFilter && data.bookings.some((b) => b.date === date && !b.proId && visible(b))) {
      out.push({ key: "none", date, kind: "unassigned", label: "Sin asignar", isToday: date === today });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, date, proFilter, pros, data.bookings, data.settings, today, showCancelled]);

  const colBookings = (c: Col) =>
    data.bookings.filter((b) => {
      if (b.date !== c.date || !visible(b)) return false;
      if (c.kind === "pro") return b.proId === c.proId;
      if (c.kind === "unassigned") return !b.proId;
      return !proFilter || b.proId === proFilter;
    });
  const colHours = (c: Col) => {
    const pro = c.proId ? pros.find((p) => p.id === c.proId) : undefined;
    if (pro) return proHoursOn(data.settings, pro, c.date);
    if (c.kind === "all" && pros.length && mode === "semana") {
      // Semana sin filtro: abierto si abre el local.
      return businessHoursOn(data.settings, c.date);
    }
    return businessHoursOn(data.settings, c.date);
  };
  const colBlocks = (c: Col) =>
    (data.blockedSlots || []).filter((bs) => bs.date === c.date && (!bs.proId || c.kind === "all" || bs.proId === c.proId));

  // rango horario visible
  const [startMin, endMin] = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const c of cols) {
      const h = colHours(c);
      if (h?.open) {
        lo = Math.min(lo, toMin(h.from));
        hi = Math.max(hi, toMin(h.to2 && h.from2 ? h.to2 : h.to));
      }
      for (const b of colBookings(c)) {
        lo = Math.min(lo, toMin(b.time));
        hi = Math.max(hi, toMin(b.time) + durOf(data, b));
      }
    }
    if (!Number.isFinite(lo)) { lo = 9 * 60; hi = 19 * 60; }
    return [Math.max(0, Math.floor(lo / 60) * 60), Math.min(24 * 60, Math.ceil(hi / 60) * 60)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols, data]);

  const hourH = desktop ? 64 : 60;
  const ppm = hourH / 60;
  const height = (endMin - startMin) * ppm;
  const hours = Array.from({ length: (endMin - startMin) / 60 + 1 }, (_, i) => startMin + i * 60);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // al abrir: scrollear hasta la hora actual (o el primer turno)
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const firstBooking = cols.flatMap(colBookings).map((b) => toMin(b.time)).sort((a, b) => a - b)[0];
    const target = cols.some((c) => c.isToday) && nowMin > startMin && nowMin < endMin ? nowMin - 60 : firstBooking !== undefined ? firstBooking - 30 : startMin;
    el.scrollTop = Math.max(0, (target - startMin) * ppm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, mode]);

  const minuteAt = (col: HTMLDivElement, clientY: number) => {
    const r = col.getBoundingClientRect();
    return startMin + (clientY - r.top) / ppm;
  };
  const snap = (m: number) => Math.max(startMin, Math.min(endMin - SNAP, Math.floor(m / SNAP) * SNAP));

  const onColClick = (c: Col, e: React.MouseEvent<HTMLDivElement>) => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    const t = e.target as HTMLElement;
    if (t.closest(".ag-ev, .ag-block")) return;
    const m = snap(minuteAt(e.currentTarget, e.clientY));
    newBooking({ date: c.date, time: fromMin(m), proId: c.kind === "pro" ? c.proId : undefined });
  };
  const onColMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const hover = e.currentTarget.querySelector<HTMLDivElement>(".ag-hover");
    if (!hover) return;
    if (drag || (e.target as HTMLElement).closest(".ag-ev, .ag-block")) { hover.style.display = "none"; return; }
    const m = snap(minuteAt(e.currentTarget, e.clientY));
    hover.style.display = "block";
    hover.style.top = `${(m - startMin) * ppm}px`;
    hover.style.height = `${Math.max(22, 30 * ppm)}px`;
    hover.textContent = `+ ${fromMin(m)}`;
  };
  const onColLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    const hover = e.currentTarget.querySelector<HTMLDivElement>(".ag-hover");
    if (hover) hover.style.display = "none";
  };

  const startDrag = (e: React.PointerEvent, b: Booking, c: Col) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || b.status === "cancelada") return;
    const col = colRefs.current.get(c.key);
    if (!col) return;
    const grab = minuteAt(col, e.clientY) - toMin(b.time);
    const dur = durOf(data, b);
    const x0 = e.clientX;
    const y0 = e.clientY;
    let moved = false;
    let target: { colKey: string; start: number } | null = null;
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
      moved = true;
      let hit: [string, HTMLDivElement] | undefined;
      for (const entry of colRefs.current) {
        const r = entry[1].getBoundingClientRect();
        if (ev.clientX >= r.left && ev.clientX < r.right) { hit = entry; break; }
      }
      if (!hit) return;
      const m = Math.max(startMin, Math.min(endMin - dur, Math.round((minuteAt(hit[1], ev.clientY) - grab) / SNAP) * SNAP));
      target = { colKey: hit[0], start: m };
      setDrag({ id: b.id, colKey: hit[0], start: m, dur });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDrag(null);
      if (!moved) return;
      suppressClick.current = true;
      setTimeout(() => { suppressClick.current = false; }, 50);
      if (!target) return;
      const col = cols.find((x) => x.key === target!.colKey);
      if (!col) return;
      const newTime = fromMin(target.start);
      const newPro = col.kind === "pro" ? col.proId : col.kind === "unassigned" ? "" : b.proId || "";
      if (col.date === b.date && newTime === b.time && (newPro || "") === (b.proId || "")) return;
      const r = store.rescheduleBooking(b.id, col.date, newTime, newPro ?? undefined, true);
      if (!r.ok) store.toast(r.error || "No se pudo mover el turno", "warn");
      else store.toast(`${b.client}: ${dayLabel(col.date)} ${newTime}`, "ok", { label: "Deshacer", onClick: () => store.rescheduleBooking(b.id, b.date, b.time, b.proId || "", true) }, 7000);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const gutterW = desktop ? 56 : 44;
  const minColW = mode === "semana" ? 110 : cols.length > 1 ? (desktop ? 180 : 150) : 0;
  const gridTemplate = `${gutterW}px repeat(${cols.length}, minmax(${minColW}px, 1fr))`;

  return (
    <div className="ag-box" ref={box}>
      <div className="ag-grid" style={{ gridTemplateColumns: gridTemplate }}>
        {/* encabezado */}
        <div className="ag-corner" style={{ gridColumn: 1, gridRow: 1 }} />
        {cols.map((c, i) => {
          const [num, count] = (c.sub || "").split("|");
          const inner = mode === "semana" ? (
            <>
              <b><span className="capitalize text-[var(--text-3)]" style={{ fontWeight: 500 }}>{c.label}</span> <span className="ag-head-day">{num}</span></b>
              <small>{Number(count) ? `${count} turno${count === "1" ? "" : "s"}` : businessHoursOn(data.settings, c.date)?.open ? "Libre" : "Cerrado"}</small>
            </>
          ) : (
            <>
              <b>{c.color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />}{c.label}</b>
              {c.sub && <small>{c.sub}</small>}
            </>
          );
          return mode === "semana" ? (
            <button key={c.key} type="button" onClick={() => onDay(c.date)} className={`ag-head ag-head-cell ${c.isToday ? "is-today" : ""}`} style={{ gridColumn: i + 2, gridRow: 1 }} aria-label={`Ver el ${dayLabel(c.date, { long: true })}`}>
              {inner}
            </button>
          ) : (
            <div key={c.key} className={`ag-head ag-head-cell ${c.isToday ? "is-today" : ""}`} style={{ gridColumn: i + 2, gridRow: 1 }}>{inner}</div>
          );
        })}

        {/* horas */}
        <div className="ag-gutter" style={{ gridColumn: 1, gridRow: 2, height }}>
          {hours.slice(1, -1).map((h) => <span key={h} style={{ top: (h - startMin) * ppm }}>{fromMin(h)}</span>)}
        </div>

        {/* columnas */}
        {cols.map((c, i) => {
          const h = colHours(c);
          const closed: [number, number][] = [];
          if (!h?.open) closed.push([startMin, endMin]);
          else {
            const shifts: [number, number][] = [[toMin(h.from), toMin(h.to)]];
            if (h.from2 && h.to2) shifts.push([toMin(h.from2), toMin(h.to2)]);
            let cur = startMin;
            for (const [a, z] of shifts.sort((x, y) => x[0] - y[0])) {
              if (a > cur) closed.push([cur, a]);
              cur = Math.max(cur, z);
            }
            if (cur < endMin) closed.push([cur, endMin]);
          }
          const list = colBookings(c);
          const lay = lanes(list.map((b) => ({ id: b.id, s: toMin(b.time), e: toMin(b.time) + durOf(data, b) })));
          const blocks = colBlocks(c);
          const colStyle: CSSProperties = {
            gridColumn: i + 2,
            gridRow: 2,
            height,
            backgroundImage: `linear-gradient(to bottom, var(--line) 1px, transparent 1px), linear-gradient(to bottom, #f1f3f0 1px, transparent 1px)`,
            backgroundSize: `100% ${hourH}px, 100% ${hourH / 2}px`,
          };
          return (
            <div
              key={c.key}
              ref={(el) => { if (el) colRefs.current.set(c.key, el); else colRefs.current.delete(c.key); }}
              className={`ag-col ${c.isToday ? "is-today" : ""}`}
              style={colStyle}
              onClick={(e) => onColClick(c, e)}
              onMouseMove={desktop ? onColMove : undefined}
              onMouseLeave={desktop ? onColLeave : undefined}
              role="presentation"
            >
              {closed.map(([a, z]) => <div key={`cl-${a}`} className="ag-closed" style={{ top: (a - startMin) * ppm, height: (z - a) * ppm }} />)}
              {blocks.map((bs) => {
                const a = bs.time ? toMin(bs.time) : startMin;
                const z = bs.time ? (bs.endTime ? toMin(bs.endTime) : a + (data.settings.slotInterval || 30)) : endMin;
                return (
                  <button
                    key={bs.id}
                    type="button"
                    className="ag-block"
                    style={{ top: (Math.max(a, startMin) - startMin) * ppm, height: Math.max(18, (Math.min(z, endMin) - Math.max(a, startMin)) * ppm - 2) }}
                    onClick={(e) => { e.stopPropagation(); onUnblock(bs); }}
                    title="Bloqueado · tocá para desbloquear"
                  >
                    <b className="font-medium">{bs.reason || "Bloqueado"}</b>
                    {bs.time && <span className="ml-1 tnum">{bs.time}{bs.endTime ? `–${bs.endTime}` : ""}</span>}
                  </button>
                );
              })}
              {list.map((b) => {
                const s = toMin(b.time);
                const dur = durOf(data, b);
                const l = lay.get(b.id) || { lane: 0, of: 1 };
                const pro = pros.find((p) => p.id === b.proId);
                const hPx = Math.max(20, dur * ppm - 2);
                const compact = hPx < 40;
                const width = `calc(${100 / l.of}% - 4px)`;
                const left = `calc(${(100 / l.of) * l.lane}% + 2px)`;
                return (
                  <button
                    key={b.id}
                    type="button"
                    className={`ag-ev ag-ev--${b.status} ${compact ? "ag-ev--compact" : ""} ${drag?.id === b.id ? "is-dragging" : ""}`}
                    style={{ top: (s - startMin) * ppm + 1, height: hPx, left, width, ["--ev" as string]: pro?.color || "#146c48" }}
                    onPointerDown={(e) => startDrag(e, b, c)}
                    onClick={(e) => { e.stopPropagation(); if (suppressClick.current) return; openBooking(b.id); }}
                    aria-label={`${b.time} ${b.client}, ${serviceLabel(data, b)}`}
                  >
                    {compact ? (
                      <><span className="ag-ev-time">{b.time}</span> <b>{b.client}</b></>
                    ) : (
                      <>
                        <span className="ag-ev-time">{b.time}–{endOf(data, b)}</span>
                        <b>{b.client}</b>
                        {hPx > 54 && <span>{serviceLabel(data, b)}</span>}
                        {hPx > 72 && mode === "semana" && pro && <span>{pro.name}</span>}
                      </>
                    )}
                  </button>
                );
              })}
              {drag && drag.colKey === c.key && (
                <div className="ag-ghost" style={{ top: (drag.start - startMin) * ppm, height: Math.max(20, drag.dur * ppm - 2), left: 2, right: 2 }}>
                  {fromMin(drag.start)}–{fromMin(drag.start + drag.dur)}
                </div>
              )}
              {c.date === today && nowMin >= startMin && nowMin <= endMin && <div className="ag-now" style={{ top: (nowMin - startMin) * ppm }} />}
              {desktop && <div className="ag-hover" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- mes ---------- */

function MonthGrid({ date, proFilter, onDay }: { date: string; proFilter: string; onDay: (d: string) => void }) {
  const { data } = usePanel();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const today = todayKey();
  const first = parseKey(date);
  first.setDate(1);
  const start = weekStartOf(keyOf(first));
  const month = first.getMonth();
  const days = Array.from({ length: 42 }, (_, i) => shiftKey(start, i));
  const byDay = useMemo(() => {
    const m = new Map<string, Booking[]>();
    for (const b of data.bookings) {
      if (b.status === "cancelada" || (proFilter && b.proId !== proFilter)) continue;
      const l = m.get(b.date) || [];
      l.push(b);
      m.set(b.date, l);
    }
    m.forEach((l) => l.sort((a, b) => a.time.localeCompare(b.time)));
    return m;
  }, [data.bookings, proFilter]);
  const heads = Array.from({ length: 7 }, (_, i) => parseKey(shiftKey(start, i)).toLocaleDateString("es-AR", { weekday: desktop ? "short" : "narrow" }).replace(".", ""));
  const rows = days.slice(35).every((k) => parseKey(k).getMonth() !== month) ? days.slice(0, 35) : days;
  return (
    <div className="ag-month" role="grid" aria-label={monthTitle(date)}>
      {heads.map((h, i) => <div key={i} className="ag-month-h" role="columnheader">{h}</div>)}
      {rows.map((k) => {
        const list = byDay.get(k) || [];
        const out = parseKey(k).getMonth() !== month;
        const closed = !businessHoursOn(data.settings, k)?.open;
        return (
          <button key={k} type="button" role="gridcell" onClick={() => onDay(k)} className={`ag-mcell ${out ? "is-out" : ""} ${k === today ? "is-today" : ""} ${closed ? "is-closed" : ""}`} aria-label={`${dayLabel(k, { long: true })}: ${list.length} turnos`}>
            <span className="flex items-center justify-between">
              <span className="ag-mnum">{parseKey(k).getDate()}</span>
              {list.length > 0 && <span className="text-[11px] font-medium text-[var(--text-3)]">{list.length}</span>}
            </span>
            {desktop ? (
              <>
                {list.slice(0, 3).map((b) => (
                  <span key={b.id} className={`ag-mchip ${b.status === "pendiente" ? "pend" : ""}`} style={{ ["--ev" as string]: data.professionals.find((p) => p.id === b.proId)?.color || "#146c48" }}>
                    <span className="tnum text-[var(--text-3)]">{b.time}</span> {b.client}
                  </span>
                ))}
                {list.length > 3 && <span className="ag-mmore">+{list.length - 3} más</span>}
              </>
            ) : (
              <span className="ag-mdots">
                {list.slice(0, 6).map((b) => <i key={b.id} style={{ ["--ev" as string]: data.professionals.find((p) => p.id === b.proId)?.color || "#146c48" }} />)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- lista (mobile) ---------- */

function AgendaList({ date, proFilter }: { date: string; proFilter: string }) {
  const { data, newBooking } = usePanel();
  const days = Array.from({ length: 14 }, (_, i) => shiftKey(date, i));
  return (
    <div className="space-y-4">
      {days.map((k) => {
        const list = data.bookings.filter((b) => b.date === k && b.status !== "cancelada" && (!proFilter || b.proId === proFilter)).sort((a, b) => a.time.localeCompare(b.time));
        const open = businessHoursOn(data.settings, k)?.open;
        return (
          <section key={k} aria-label={dayLabel(k, { long: true })}>
            <div className="mb-1.5 flex items-center justify-between px-1">
              <h2 className="text-[13px] font-semibold">{dayLabel(k, { long: true })}</h2>
              <span className="text-[12px] text-[var(--text-3)]">{list.length ? `${list.length} turno${list.length === 1 ? "" : "s"}` : open ? "" : "Cerrado"}</span>
            </div>
            {list.length ? (
              <div className="c-card c-divide overflow-hidden">
                {list.map((b) => <BookingItem key={b.id} b={b} showDate={false} />)}
              </div>
            ) : open ? (
              <button type="button" onClick={() => newBooking({ date: k })} className="w-full rounded-[var(--r-lg)] border border-dashed border-[var(--line-2)] px-3 py-2.5 text-left text-[12.5px] text-[var(--text-3)]">
                Sin turnos · <span className="font-medium text-[var(--brand)]">agendar</span>
              </button>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
