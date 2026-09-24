import { useMemo, useState } from "react";
import { Download, Star, Trash2, Lock, Sparkles } from "lucide-react";
import { useStore, type Booking } from "../../lib/store";
import { Button, Card, Confirm, Empty, PageHead, Segmented } from "./ui";
import { usePanel } from "./context";
import { buildClients, dayLabel, downloadCsv, incomeOf, money, parseKey, priceOf, serviceLabel, shiftKey, todayKey } from "./helpers";

type Period = "7" | "30" | "90";

function pct(n: number, d: number) {
  return d ? Math.round((n / d) * 100) : 0;
}

export default function StatsView() {
  const store = useStore();
  const { data, user, checkout } = usePanel();
  const [period, setPeriod] = useState<Period>("30");
  const [delReview, setDelReview] = useState<string | null>(null);
  const days = Number(period);
  const today = todayKey();
  const from = shiftKey(today, -(days - 1));
  const prevFrom = shiftKey(from, -days);
  const escala = user.plan === "escala";

  const inRange = (b: Booking, a: string, z: string) => b.date >= a && b.date <= z;
  const cur = useMemo(() => data.bookings.filter((b) => inRange(b, from, today)), [data.bookings, from, today]);
  const prev = useMemo(() => data.bookings.filter((b) => inRange(b, prevFrom, shiftKey(from, -1))), [data.bookings, prevFrom, from]);

  const summary = (list: Booking[]) => {
    const active = list.filter((b) => b.status !== "cancelada");
    const income = list.reduce((a, b) => a + incomeOf(data, b), 0);
    const attended = list.filter((b) => b.status === "atendida");
    const noShow = list.filter((b) => b.status === "ausente").length;
    const cancelled = list.filter((b) => b.status === "cancelada").length;
    return { active: active.length, income, attended: attended.length, avg: attended.length ? Math.round(attended.reduce((a, b) => a + priceOf(data, b), 0) / attended.length) : 0, noShowRate: pct(noShow, attended.length + noShow), cancelRate: pct(cancelled, list.length), online: pct(list.filter((b) => b.source === "online").length, list.length) };
  };
  const s = summary(cur);
  const p = summary(prev);
  const clients = useMemo(() => buildClients(data), [data]);
  const newClients = clients.filter((c) => c.firstDate >= from && c.firstDate <= today).length;
  const returning = clients.filter((c) => c.bookings.some((b) => inRange(b, from, today)) && c.firstDate < from).length;

  const delta = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : null);
  const tiles = [
    { label: "Ingresos", value: money(s.income), d: delta(s.income, p.income), hint: "Atendidos y cobrados" },
    { label: "Turnos", value: String(s.active), d: delta(s.active, p.active), hint: `${s.online}% reservados online` },
    { label: "Ticket promedio", value: money(s.avg), d: delta(s.avg, p.avg), hint: "Por turno atendido" },
    { label: "Ausencias", value: `${s.noShowRate}%`, d: null, hint: `Cancelaciones: ${s.cancelRate}%`, bad: s.noShowRate >= 15 },
    { label: "Clientes nuevos", value: String(newClients), d: null, hint: `${returning} volvieron` },
  ];

  // barras por día (o por semana en 90 días)
  const bars = useMemo(() => {
    const step = days > 30 ? 7 : 1;
    const out: { key: string; label: string; n: number; tip: string }[] = [];
    for (let i = 0; i < days; i += step) {
      const a = shiftKey(from, i);
      const z = shiftKey(a, step - 1);
      const n = cur.filter((b) => b.status !== "cancelada" && b.date >= a && b.date <= z).length;
      const d = parseKey(a);
      out.push({ key: a, label: step === 1 ? String(d.getDate()) : d.toLocaleDateString("es-AR", { day: "numeric", month: "short" }).replace(".", ""), n, tip: step === 1 ? `${dayLabel(a)}: ${n} turno${n === 1 ? "" : "s"}` : `Semana del ${dayLabel(a).toLowerCase()}: ${n} turnos` });
    }
    return out;
  }, [cur, days, from]);
  const maxBar = Math.max(1, ...bars.map((b) => b.n));

  const topServices = useMemo(() => {
    const m = new Map<string, { n: number; income: number }>();
    cur.filter((b) => b.status !== "cancelada").forEach((b) => {
      [b.serviceId, ...(b.extraServiceIds || [])].forEach((id) => {
        const e = m.get(id) || { n: 0, income: 0 };
        e.n++;
        e.income += b.status === "atendida" ? data.services.find((x) => x.id === id)?.price || 0 : 0;
        m.set(id, e);
      });
    });
    return [...m.entries()].map(([id, v]) => ({ name: data.services.find((x) => x.id === id)?.name || "Servicio eliminado", ...v })).sort((a, b) => b.n - a.n).slice(0, 6);
  }, [cur, data.services]);
  const maxSvc = Math.max(1, ...topServices.map((x) => x.n));

  // mapa de calor día × hora
  const heat = useMemo(() => {
    const order = [1, 2, 3, 4, 5, 6, 0];
    const hours = Array.from({ length: 14 }, (_, i) => 8 + i);
    const grid = order.map(() => hours.map(() => 0));
    cur.filter((b) => b.status !== "cancelada").forEach((b) => {
      const r = order.indexOf(parseKey(b.date).getDay());
      const c = Number(b.time.slice(0, 2)) - 8;
      if (r >= 0 && c >= 0 && c < hours.length) grid[r][c]++;
    });
    return { order, hours, grid, max: Math.max(1, ...grid.flat()) };
  }, [cur]);

  const proRows = data.professionals.map((pro) => {
    const l = cur.filter((b) => b.proId === pro.id);
    return { pro, n: l.filter((b) => b.status !== "cancelada").length, income: l.reduce((a, b) => a + incomeOf(data, b), 0) };
  });

  const avgRating = data.reviews.length ? data.reviews.reduce((a, r) => a + r.rating, 0) / data.reviews.length : 0;

  const exportCsv = () => {
    downloadCsv(`reporte-${user.slug}-${from}-a-${today}`, ["Fecha", "Hora", "Cliente", "Teléfono", "Servicio", "Profesional", "Estado", "Origen", "Precio", "Ingreso"], cur.map((b) => [b.date, b.time, b.client, b.phone, serviceLabel(data, b), data.professionals.find((x) => x.id === b.proId)?.name || "", b.status, b.source, priceOf(data, b), incomeOf(data, b)]));
    store.toast("Reporte descargado");
  };

  return (
    <div>
      <PageHead
        title="Estadísticas"
        sub="Cómo viene tu negocio, comparado con el período anterior."
        actions={
          <>
            <Segmented label="Período" value={period} onChange={setPeriod} options={[{ value: "7", label: "7 días" }, { value: "30", label: "30 días" }, { value: "90", label: "90 días" }]} />
            {escala && <Button icon={<Download />} onClick={exportCsv}>Exportar</Button>}
          </>
        }
      />

      <section className="c-card mb-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" aria-label="Indicadores">
        {tiles.map((t, i) => (
          <div key={t.label} className={`px-4 py-3.5 ${i ? "border-l border-[var(--line)]" : ""} ${i === 2 ? "max-sm:border-l-0" : ""} ${i >= 2 ? "max-sm:border-t" : ""} ${i >= 3 ? "sm:max-lg:border-t" : ""} ${i === 3 ? "sm:max-lg:border-l-0" : ""} border-[var(--line)]`}>
            <p className="text-[12.5px] text-[var(--text-3)]">{t.label}</p>
            <p className={`mt-0.5 text-[22px] font-semibold tracking-tight tnum ${t.bad ? "text-[var(--warn)]" : ""}`}>{t.value}</p>
            <p className="truncate text-[12px] text-[var(--text-3)]">
              {t.d !== null && <span className={t.d >= 0 ? "text-[var(--brand)]" : "text-[var(--danger)]"}>{t.d >= 0 ? "▲" : "▼"} {Math.abs(t.d)}% </span>}
              {t.hint}
            </p>
          </div>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card title={days > 30 ? "Turnos por semana" : "Turnos por día"} sub={`${s.active} en total`}>
          {s.active === 0 ? (
            <p className="py-10 text-center text-[13px] text-[var(--text-3)]">Todavía no hay turnos en este período.</p>
          ) : (
            <div>
              <div className="flex h-44 items-end gap-[2px]" role="img" aria-label={`Gráfico de turnos: máximo ${maxBar} en un día`}>
                {bars.map((b) => (
                  <div key={b.key} className="group relative flex h-full flex-1 items-end" title={b.tip}>
                    <div className="w-full rounded-t-[4px] transition-colors" style={{ height: `${b.n ? Math.max(4, (b.n / maxBar) * 100) : 1.5}%`, background: b.key === today ? "var(--brand)" : b.n ? "#6fb392" : "var(--line)" }} />
                    <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-[6px] bg-[var(--text)] px-2 py-1 text-[11.5px] text-white group-hover:block">{b.tip}</span>
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex gap-[2px] text-[10.5px] text-[var(--text-3)]">
                {bars.map((b, i) => <span key={b.key} className="flex-1 text-center">{bars.length <= 14 || i % Math.ceil(bars.length / 10) === 0 ? b.label : ""}</span>)}
              </div>
            </div>
          )}
        </Card>
        <Card title="Servicios más pedidos">
          {topServices.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-[var(--text-3)]">Sin datos en este período.</p>
          ) : (
            <ul className="space-y-3">
              {topServices.map((x) => (
                <li key={x.name}>
                  <div className="flex justify-between gap-2 text-[13px]"><span className="truncate">{x.name}</span><span className="tnum text-[var(--text-2)]">{x.n} · {money(x.income)}</span></div>
                  <div className="mt-1 h-2 rounded-full bg-[var(--surface-3)]"><div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${(x.n / maxSvc) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card title="Días y horarios más pedidos" sub="Para decidir cuándo abrir más o lanzar un cupón">
          {escala ? (
            <div className="overflow-x-auto">
              <table className="w-full border-separate text-[11px]" style={{ borderSpacing: 2 }}>
                <thead>
                  <tr><th />{heat.hours.map((h) => <th key={h} className="font-normal text-[var(--text-3)]">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {heat.order.map((d, r) => (
                    <tr key={d}>
                      <th className="pr-1 text-left font-normal text-[var(--text-3)]">{["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][d]}</th>
                      {heat.grid[r].map((n, c) => (
                        <td key={c} title={`${["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"][d]} ${heat.hours[c]} h: ${n} turnos`} className="h-6 min-w-[18px] rounded-[3px]" style={{ background: n ? `rgba(20,108,72,${0.12 + (n / heat.max) * 0.78})` : "var(--surface-3)" }} />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon={<Lock />} title="Disponible en el plan Escala" text="Mapa de calor por día y hora, rendimiento por profesional y exportación a Excel.">
              <Button variant="primary" icon={<Sparkles />} onClick={() => checkout("escala")}>Ver Escala</Button>
            </Empty>
          )}
        </Card>
        <Card title="Por profesional" bodyClass={proRows.length ? "c-divide" : "c-card-body"}>
          {!proRows.length ? (
            <p className="text-[13px] text-[var(--text-3)]">Sumá tu equipo para comparar rendimiento.</p>
          ) : !escala ? (
            <p className="px-4 py-4 text-[13px] text-[var(--text-3)]">Incluido en el plan Escala.</p>
          ) : (
            proRows.map((r) => (
              <div key={r.pro.id} className="c-list-row" style={{ minHeight: 44 }}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.pro.color }} />
                <span className="flex-1 text-[13.5px]">{r.pro.name}</span>
                <span className="text-[13px] tnum text-[var(--text-2)]">{r.n} turnos · {money(r.income)}</span>
              </div>
            ))
          )}
        </Card>
      </div>

      <Card className="mt-4" title="Reseñas" sub={data.reviews.length ? `${avgRating.toFixed(1)} ★ promedio en ${data.reviews.length} reseña${data.reviews.length === 1 ? "" : "s"}` : "Aparecen en tu página. Pedilas al marcar un turno como atendido."} bodyClass={data.reviews.length ? "c-divide" : "c-card-body"}>
        {data.reviews.length === 0 ? (
          <p className="text-[13px] text-[var(--text-3)]">Todavía no hay reseñas.</p>
        ) : (
          data.reviews.slice(0, 20).map((r) => (
            <div key={r.id} className="c-list-row items-start">
              <span className="flex shrink-0 gap-0.5 pt-0.5 text-[#d9901a]" aria-label={`${r.rating} de 5`}>{Array.from({ length: 5 }, (_, i) => <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-current" : "opacity-25"}`} />)}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px]">“{r.text}”</span>
                <span className="block text-[12px] text-[var(--text-3)]">{r.client} · {dayLabel(r.date)}</span>
              </span>
              <button type="button" className="grid h-7 w-7 place-items-center rounded text-[var(--text-3)] hover:bg-[var(--surface-3)] hover:text-[var(--danger)]" aria-label={`Eliminar reseña de ${r.client}`} onClick={() => setDelReview(r.id)}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))
        )}
      </Card>
      {delReview && <Confirm title="¿Eliminar esta reseña?" text="Deja de mostrarse en tu página." confirmLabel="Eliminar" danger onConfirm={() => { store.removeReview(delReview); store.toast("Reseña eliminada"); }} onClose={() => setDelReview(null)} />}
    </div>
  );
}
