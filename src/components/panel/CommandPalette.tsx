import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Search, Plus, CalendarDays, Users, Ban, Globe, Clock, Settings, CreditCard, Briefcase, CornerDownLeft, User as UserIcon, CalendarCheck } from "lucide-react";
import { Layer, StatusBadge } from "./ui";
import { usePanel, VIEW_TITLES, type SettingsTab, type View } from "./context";
import { buildClients, dayLabel, serviceLabel, todayKey } from "./helpers";
import { formatArgentinaPhone } from "../../lib/phone";

type Item = { id: string; group: string; label: string; sub?: string; icon: ReactNode; right?: ReactNode; run: () => void };

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default function CommandPalette({ onClose }: { onClose: () => void }) {
  const p = usePanel();
  const { data } = p;
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const clients = useMemo(() => buildClients(data), [data]);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    input.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
      if (prev && document.contains(prev)) prev.focus({ preventScroll: true });
    };
  }, [onClose]);

  const items = useMemo<Item[]>(() => {
    const nq = norm(q.trim());
    const digits = q.replace(/\D/g, "");
    const run = (fn: () => void) => () => { onClose(); fn(); };
    const actions: Item[] = [
      { id: "a-new", group: "Acciones", label: "Nuevo turno", sub: "Agendar a un cliente", icon: <Plus />, run: run(() => p.newBooking()) },
      { id: "a-block", group: "Acciones", label: "Bloquear horario", sub: "Descanso, trámite o vacaciones", icon: <Ban />, run: run(() => p.blockTime()) },
      { id: "a-today", group: "Acciones", label: "Ver la agenda de hoy", icon: <CalendarDays />, run: run(() => p.go("agenda", { params: { d: todayKey(), v: "dia" } })) },
      { id: "a-page", group: "Acciones", label: "Abrir mi página de reservas", icon: <Globe />, run: run(() => window.open(`/${p.user.slug}`, "_blank")) },
    ];
    const sections: Item[] = (Object.keys(VIEW_TITLES) as View[]).map((v) => ({
      id: `v-${v}`, group: "Secciones", label: VIEW_TITLES[v], icon: <CornerDownLeft />, run: run(() => p.go(v)),
    }));
    const settings: [SettingsTab, string, ReactNode, string][] = [
      ["negocio", "Datos del negocio", <Settings key="n" />, "dirección whatsapp instagram descripción"],
      ["reservas", "Reglas de reserva", <CalendarCheck key="r" />, "anticipación intervalo buffer descanso entre turnos"],
      ["pagos", "Seña y datos de cobro", <CreditCard key="p" />, "alias cbu transferencia pagos"],
      ["notificaciones", "Notificaciones y recordatorios", <Clock key="no" />, "email recordatorio sonido calendario"],
      ["apariencia", "Colores de mi página", <Globe key="a" />, "tema color marca"],
      ["plan", "Plan y suscripción", <CreditCard key="pl" />, "mercado pago pagar suscripción"],
      ["cuenta", "Cuenta y sesión", <UserIcon key="c" />, "cerrar sesión eliminar"],
    ];
    const settingItems: Item[] = [
      { id: "s-hours", group: "Ajustes", label: "Horarios de atención", sub: "Días, cortes, feriados y bloqueos", icon: <Clock />, run: run(() => p.go("horarios")) },
      { id: "s-services", group: "Ajustes", label: "Servicios y precios", icon: <Briefcase />, run: run(() => p.go("servicios")) },
      ...settings.map(([tab, label, icon, kw]) => ({ id: `s-${tab}`, group: "Ajustes", label, sub: kw, icon, run: run(() => p.go("ajustes", { tab })) })),
    ];

    if (!nq) {
      const today = todayKey();
      const upcoming = data.bookings
        .filter((b) => b.date === today && b.status !== "cancelada")
        .sort((a, b) => a.time.localeCompare(b.time))
        .slice(0, 4)
        .map<Item>((b) => ({ id: `b-${b.id}`, group: "Hoy", label: `${b.time} · ${b.client}`, sub: serviceLabel(data, b), icon: <CalendarDays />, right: <StatusBadge status={b.status} />, run: run(() => p.openBooking(b.id)) }));
      return [...actions, ...upcoming, ...sections.slice(0, 6)];
    }

    const match = (s: string) => norm(s).includes(nq);
    const cl: Item[] = clients
      .filter((c) => match(c.name) || (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits)))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6)
      .map((c) => ({ id: `c-${c.key}`, group: "Clientes", label: c.name, sub: `${c.phone ? formatArgentinaPhone(c.phone) : "Sin teléfono"} · ${c.visits} visita${c.visits === 1 ? "" : "s"}`, icon: <Users />, run: run(() => p.openClient(c.key)) }));
    const today = todayKey();
    const bk: Item[] = data.bookings
      .filter((b) => match(b.client) || match(serviceLabel(data, b)) || (digits.length >= 3 && b.phone.replace(/\D/g, "").includes(digits)))
      .sort((a, b) => {
        const fa = a.date >= today ? 0 : 1;
        const fb = b.date >= today ? 0 : 1;
        if (fa !== fb) return fa - fb;
        return fa === 0 ? (a.date + a.time).localeCompare(b.date + b.time) : (b.date + b.time).localeCompare(a.date + a.time);
      })
      .slice(0, 6)
      .map((b) => ({ id: `b-${b.id}`, group: "Turnos", label: `${b.client} · ${dayLabel(b.date)} ${b.time}`, sub: serviceLabel(data, b), icon: <CalendarDays />, right: <StatusBadge status={b.status} />, run: run(() => p.openBooking(b.id)) }));
    const rest = [...actions, ...settingItems, ...sections].filter((i) => match(i.label) || (i.sub && match(i.sub)));
    return [...cl, ...bk, ...rest].slice(0, 30);
  }, [q, data, clients, p, onClose]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    list.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  let lastGroup = "";
  return (
    <Layer>
      <div className="c-overlay" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label="Buscar en el panel" className="c-sheet" style={{ top: "12vh", left: "50%", transform: "translateX(-50%)", width: "min(600px, calc(100vw - 24px))", maxHeight: "min(560px, 76vh)", borderRadius: 16, animation: "c-pop .14s var(--ease) both" }}>
        <div className="flex items-center gap-2.5 px-4" style={{ borderBottom: "1px solid var(--line)", height: 52 }}>
          <Search className="h-[18px] w-[18px] text-[var(--text-3)]" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Buscar clientes, turnos o secciones"
            placeholder="Buscá un cliente, un teléfono, un turno o una sección…"
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
              if (e.key === "Enter" && items[active]) { e.preventDefault(); items[active].run(); }
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls="cp-cmd-list"
            aria-activedescendant={items[active] ? `cmd-${items[active].id}` : undefined}
          />
          <span className="c-kbd">Esc</span>
        </div>
        <div ref={list} id="cp-cmd-list" role="listbox" className="flex-1 overflow-y-auto p-1.5">
          {items.length === 0 && <p className="px-3 py-8 text-center text-[13px] text-[var(--text-3)]">Sin resultados para “{q}”. Probá con un nombre, un teléfono o “horarios”.</p>}
          {items.map((it, i) => {
            const head = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            return (
              <div key={it.id}>
                {head && <p className="px-2.5 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">{head}</p>}
                <button
                  id={`cmd-${it.id}`}
                  data-idx={i}
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  onMouseMove={() => setActive(i)}
                  onClick={it.run}
                  className="flex w-full items-center gap-3 rounded-[8px] px-2.5 py-2 text-left"
                  style={{ background: i === active ? "var(--surface-3)" : undefined }}
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[7px] border border-[var(--line)] bg-[var(--surface)] text-[var(--text-3)] [&>svg]:h-[15px] [&>svg]:w-[15px]">{it.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">{it.label}</span>
                    {it.sub && it.group !== "Ajustes" && <span className="block truncate text-[12px] text-[var(--text-3)]">{it.sub}</span>}
                  </span>
                  {it.right}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 px-4 py-2 text-[11.5px] text-[var(--text-3)]" style={{ borderTop: "1px solid var(--line)" }}>
          <span><span className="c-kbd">↑</span> <span className="c-kbd">↓</span> moverse</span>
          <span><span className="c-kbd">Enter</span> abrir</span>
          <span className="ml-auto hidden sm:inline">Atajo: <span className="c-kbd">N</span> nuevo turno</span>
        </div>
      </div>
    </Layer>
  );
}
