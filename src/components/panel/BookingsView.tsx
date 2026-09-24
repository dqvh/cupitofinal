import { useMemo, useState } from "react";
import { Check, CheckCheck, Download, MessageCircle, Plus, Search, X, ListChecks, Wallet } from "lucide-react";
import { useStore, type Booking, type BookingStatus } from "../../lib/store";
import { Button, Empty, PageHead, Segmented, StatusBadge, STATUS_LABEL } from "./ui";
import { usePanel } from "./context";
import { useBookingActions } from "./BookingDrawer";
import { dayLabel, downloadCsv, endOf, hasPhone, money, nowHHMM, priceOf, serviceLabel, todayKey, waLink, waMessage } from "./helpers";
import { formatArgentinaPhone } from "../../lib/phone";

/* Fila compacta de turno, reutilizada en Agenda (lista) y Clientes. */
export function BookingItem({ b, showDate = true, showActions = true }: { b: Booking; showDate?: boolean; showActions?: boolean }) {
  const { data, user, openBooking } = usePanel();
  const { setStatus } = useBookingActions();
  const pro = data.professionals.find((p) => p.id === b.proId);
  const today = todayKey();
  const past = b.date < today || (b.date === today && endOf(data, b) <= nowHHMM());
  const claim = !!b.depositClaim && !b.paidDeposit && b.status !== "cancelada";
  const cancelled = b.status === "cancelada";
  return (
    <div className="c-list-row" style={{ opacity: cancelled ? 0.6 : 1 }}>
      <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => openBooking(b.id)}>
        <span className="w-[52px] shrink-0">
          {showDate && <span className="block text-[11.5px] text-[var(--text-3)]">{dayLabel(b.date)}</span>}
          <span className="block text-[13.5px] font-semibold tnum">{b.time}</span>
          {!showDate && <span className="block text-[11.5px] text-[var(--text-3)] tnum">{endOf(data, b)}</span>}
        </span>
        <span className="h-9 w-[3px] shrink-0 rounded-full" style={{ background: pro?.color || "var(--line-2)" }} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[13.5px] font-medium ${cancelled ? "line-through" : ""}`}>{b.client}</span>
          <span className="block truncate text-[12px] text-[var(--text-3)]">
            {serviceLabel(data, b)}{pro ? ` · ${pro.name}` : ""}
            <span className="hidden md:inline">{b.phone ? ` · ${formatArgentinaPhone(b.phone)}` : ""}</span>
          </span>
        </span>
        <span className="hidden w-20 shrink-0 text-right text-[13px] tnum text-[var(--text-2)] md:block">{money(priceOf(data, b))}</span>
      </button>
      {claim ? (
        <span className="c-badge c-badge--warn"><Wallet className="h-3 w-3" /> Seña</span>
      ) : (
        <StatusBadge status={b.status} className="hidden sm:inline-flex" />
      )}
      {showActions && (
        <span className="flex shrink-0 items-center gap-1">
          {b.status === "pendiente" && !claim && (
            <Button size="sm" variant="soft" icon={<Check />} onClick={() => setStatus(b, "confirmada")} aria-label={`Confirmar turno de ${b.client}`}>
              <span className="hidden sm:inline">Confirmar</span>
            </Button>
          )}
          {b.status === "confirmada" && past && (
            <Button size="sm" icon={<CheckCheck />} onClick={() => setStatus(b, "atendida")} aria-label={`Marcar atendido a ${b.client}`}>
              <span className="hidden sm:inline">Atendido</span>
            </Button>
          )}
          {b.status === "confirmada" && !past && hasPhone(b.phone) && (
            <a className="c-btn c-btn--ghost c-btn--sm c-btn--icon" href={waLink(b.phone, waMessage("recordatorio", { business: user.business, b, data }))} target="_blank" rel="noreferrer" aria-label={`WhatsApp a ${b.client}`} title="Enviar recordatorio por WhatsApp">
              <MessageCircle />
            </a>
          )}
          {b.status !== "pendiente" && b.status !== "confirmada" && <StatusBadge status={b.status} className="sm:hidden" />}
        </span>
      )}
    </div>
  );
}

type Range = "proximos" | "pasados" | "todos";
const FILTERS: ("todos" | BookingStatus)[] = ["todos", "pendiente", "confirmada", "atendida", "ausente", "cancelada"];

export default function BookingsView() {
  const store = useStore();
  const { data, user, params, setParams, newBooking } = usePanel();
  const status = (params.get("estado") as BookingStatus | "todos") || "todos";
  const range = (params.get("rango") as Range) || (status === "pendiente" ? "todos" : "proximos");
  const proFilter = params.get("pro") || "";
  const [q, setQ] = useState(params.get("q") || "");
  const [limit, setLimit] = useState(60);
  const today = todayKey();
  const now = nowHHMM();

  const base = useMemo(() => {
    const nq = q.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return data.bookings.filter((b) => {
      const upcoming = b.date > today || (b.date === today && b.time >= now) || (b.date === today && b.status === "confirmada");
      if (range === "proximos" && !upcoming) return false;
      if (range === "pasados" && upcoming) return false;
      if (proFilter && b.proId !== proFilter) return false;
      if (nq && !(b.client.toLowerCase().includes(nq) || serviceLabel(data, b).toLowerCase().includes(nq) || (digits.length >= 3 && b.phone.replace(/\D/g, "").includes(digits)))) return false;
      return true;
    });
  }, [data, q, range, proFilter, today, now]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: base.length };
    for (const b of base) c[b.status] = (c[b.status] || 0) + 1;
    return c;
  }, [base]);

  const list = useMemo(() => {
    const l = base.filter((b) => status === "todos" || b.status === status);
    return l.sort((a, b) => (range === "pasados" ? (b.date + b.time).localeCompare(a.date + a.time) : (a.date + a.time).localeCompare(b.date + b.time)));
  }, [base, status, range]);

  const groups = useMemo(() => {
    const m = new Map<string, Booking[]>();
    for (const b of list.slice(0, limit)) {
      const l = m.get(b.date) || [];
      l.push(b);
      m.set(b.date, l);
    }
    return [...m.entries()];
  }, [list, limit]);

  const pendingShown = list.filter((b) => b.status === "pendiente" && !(b.depositClaim && !b.paidDeposit));

  const exportCsv = () => {
    downloadCsv(
      `reservas-${user.slug}-${today}`,
      ["Fecha", "Hora", "Fin", "Cliente", "Teléfono", "Email", "Servicio", "Profesional", "Estado", "Origen", "Precio", "Seña", "Cobrado", "Nota interna", "Nota del cliente", "Motivo de cancelación"],
      list.map((b) => [
        b.date, b.time, endOf(data, b), b.client, b.phone, b.email || "", serviceLabel(data, b),
        data.professionals.find((p) => p.id === b.proId)?.name || "", STATUS_LABEL[b.status], b.source === "online" ? "Online" : "Manual",
        priceOf(data, b), b.paidDeposit ? "Sí" : "No", b.paymentStatus === "total_pagado" ? b.paidAmount || priceOf(data, b) : "", b.internalNote || "", b.notes || "", b.cancelReason || "",
      ])
    );
    store.toast(`${list.length} reservas exportadas (CSV para Excel)`);
  };

  return (
    <div>
      <PageHead
        title="Reservas"
        sub="Todos los turnos, con búsqueda y filtros. Tocá uno para ver el detalle."
        actions={
          <>
            <Button icon={<Download />} onClick={exportCsv} disabled={!list.length} className="hidden sm:inline-flex">Exportar</Button>
            <Button variant="primary" icon={<Plus />} onClick={() => newBooking()} className="hidden lg:inline-flex">Nuevo turno</Button>
          </>
        }
      />

      <div className="mb-3 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="c-input-wrap min-w-[200px] flex-1 sm:max-w-sm">
            <Search />
            <input className="c-input" placeholder="Buscar por cliente, teléfono o servicio" aria-label="Buscar reservas" value={q} onChange={(e) => setQ(e.target.value)} />
            {q && (
              <button type="button" className="c-input-suffix grid h-6 w-6 place-items-center rounded text-[var(--text-3)] hover:bg-[var(--surface-3)]" onClick={() => setQ("")} aria-label="Borrar búsqueda">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Segmented<Range>
            label="Período"
            value={range}
            onChange={(v) => setParams({ rango: v === "proximos" ? undefined : v })}
            options={[{ value: "proximos", label: "Próximos" }, { value: "pasados", label: "Pasados" }, { value: "todos", label: "Todos" }]}
          />
          {data.professionals.length > 0 && (
            <select className="c-select" style={{ width: "auto", height: 32, fontSize: 13 }} aria-label="Profesional" value={proFilter} onChange={(e) => setParams({ pro: e.target.value || undefined })}>
              <option value="">Todo el equipo</option>
              {data.professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </div>
        <div className="c-chip-row" role="group" aria-label="Estado">
          {FILTERS.map((f) => (
            <button key={f} type="button" className="c-chip" aria-pressed={status === f} onClick={() => setParams({ estado: f === "todos" ? undefined : f })}>
              {f === "todos" ? "Todos" : STATUS_LABEL[f]}
              <span className="c-chip-count">{counts[f] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {pendingShown.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[var(--r-lg)] border border-[var(--st-pend-line)] bg-[var(--st-pend-bg)] px-3.5 py-2.5 text-[13px] text-[#6e3f05]">
          <span>{pendingShown.length} turnos esperan tu confirmación.</span>
          <Button
            size="sm"
            variant="primary"
            icon={<CheckCheck />}
            onClick={() => {
              const ids = pendingShown.map((b) => b.id);
              ids.forEach((id) => store.setStatus(id, "confirmada"));
              store.toast(`${ids.length} turnos confirmados`, "ok", { label: "Deshacer", onClick: () => ids.forEach((id) => store.setStatus(id, "pendiente")) }, 7000);
            }}
          >
            Confirmar todos
          </Button>
        </div>
      )}

      {list.length === 0 ? (
        <div className="c-card">
          <Empty
            icon={<ListChecks />}
            title={q ? `No encontramos “${q}”` : data.bookings.length ? "No hay reservas con estos filtros" : "Todavía no hay reservas"}
            text={q ? "Probá con otro nombre, un teléfono o cambiá el período." : data.bookings.length ? "Cambiá el período o el estado para ver más." : "Cuando tus clientes reserven desde tu link (o las cargues vos) van a aparecer acá."}
          >
            {(q || status !== "todos" || range !== "todos") && data.bookings.length > 0 && (
              <Button onClick={() => { setQ(""); setParams({ estado: undefined, rango: "todos", pro: undefined }); }}>Ver todas</Button>
            )}
            <Button variant="primary" icon={<Plus />} onClick={() => newBooking()}>Nuevo turno</Button>
          </Empty>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(([d, items]) => (
            <section key={d} aria-label={dayLabel(d, { long: true })}>
              <div className="mb-1.5 flex items-baseline justify-between px-1">
                <h2 className="text-[13px] font-semibold">{dayLabel(d, { long: true })}</h2>
                <span className="text-[12px] text-[var(--text-3)]">{items.length} turno{items.length === 1 ? "" : "s"}</span>
              </div>
              <div className="c-card c-divide overflow-hidden">
                {items.map((b) => <BookingItem key={b.id} b={b} showDate={false} />)}
              </div>
            </section>
          ))}
          {list.length > limit && (
            <div className="flex justify-center">
              <Button onClick={() => setLimit((l) => l + 60)}>Ver más ({list.length - limit} restantes)</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
