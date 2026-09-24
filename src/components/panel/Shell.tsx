import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Home,
  CalendarDays,
  ListChecks,
  Users,
  Hourglass,
  Briefcase,
  UserCheck,
  Clock,
  ShoppingBag,
  Ticket,
  Globe,
  BarChart3,
  Settings,
  Search,
  Plus,
  Bell,
  LogOut,
  ExternalLink,
  Copy,
  Smartphone,
  CalendarClock,
  MoreHorizontal,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { PLAN_META, type User } from "../../lib/store";
import { Button, IconButton, Layer, Menu, Sheet, useMediaQuery } from "./ui";
import { VIEW_TITLES, usePanel, type View } from "./context";
import { dayLabel, relTime, serviceLabel } from "./helpers";

type NavItem = { id: View; label: string; icon: ReactNode; count?: number; alert?: boolean };

export function useNavGroups() {
  const { data } = usePanel();
  const pending = data.bookings.filter((b) => b.status === "pendiente" || (b.depositClaim && !b.paidDeposit && b.status !== "cancelada")).length;
  return useMemo<{ label?: string; items: NavItem[] }[]>(
    () => [
      {
        items: [
          { id: "inicio", label: "Inicio", icon: <Home /> },
          { id: "agenda", label: "Agenda", icon: <CalendarDays /> },
          { id: "reservas", label: "Reservas", icon: <ListChecks />, count: pending || undefined, alert: pending > 0 },
          { id: "clientes", label: "Clientes", icon: <Users /> },
          { id: "espera", label: "Lista de espera", icon: <Hourglass />, count: data.waitlist.length || undefined },
        ],
      },
      {
        label: "Negocio",
        items: [
          { id: "servicios", label: "Servicios", icon: <Briefcase /> },
          { id: "equipo", label: "Equipo", icon: <UserCheck /> },
          { id: "horarios", label: "Horarios", icon: <Clock /> },
          { id: "tienda", label: "Tienda", icon: <ShoppingBag /> },
          { id: "cupones", label: "Cupones", icon: <Ticket /> },
        ],
      },
      {
        label: "Crecer",
        items: [
          { id: "pagina", label: "Mi página", icon: <Globe /> },
          { id: "stats", label: "Estadísticas", icon: <BarChart3 /> },
        ],
      },
    ],
    [pending, data.waitlist.length]
  );
}

function Wordmark({ small }: { small?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <img src="/cupito-logo.png" width={small ? 22 : 24} height={small ? 22 : 24} alt="" className="rounded-[6px]" />
      <span style={{ fontFamily: '"Bricolage Grotesque", var(--font)', fontWeight: 700, fontSize: small ? 16 : 17, letterSpacing: "-0.02em" }}>
        cupito<span style={{ color: "var(--brand)" }}>.</span>
      </span>
    </span>
  );
}

function useCopyLink() {
  const { user } = usePanel();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const url = `https://cupito.app/${user.slug}`;
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1800); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done, done);
    else done();
  };
  return { copied, copy };
}

function UserMenu({ user, onLogout, onInstall, compact }: { user: User; onLogout: () => void; onInstall: () => void; compact?: boolean }) {
  const { go, openCalendarSync } = usePanel();
  return (
    <Menu
      align={compact ? "right" : "left"}
      items={[
        { label: "Ver mi página", icon: <ExternalLink />, href: `/${user.slug}` },
        { label: "Calendario del celular", icon: <CalendarClock />, onSelect: () => openCalendarSync() },
        { label: "Instalar app", icon: <Smartphone />, onSelect: onInstall },
        { label: "Ajustes", icon: <Settings />, onSelect: () => go("ajustes") },
        { separator: true, label: "sep" },
        { label: "Cerrar sesión", icon: <LogOut />, onSelect: onLogout, danger: true },
      ]}
      trigger={(p) =>
        compact ? (
          <button type="button" className="c-avatar" style={{ width: 32, height: 32 }} aria-label="Tu cuenta" {...p}>
            {user.name.trim().charAt(0).toUpperCase() || "?"}
          </button>
        ) : (
          <button type="button" className="cp-user w-full text-left" aria-label="Tu cuenta" {...p}>
            <span className="c-avatar c-avatar--sm" style={{ width: 28, height: 28, fontSize: 11 }}>{user.name.trim().charAt(0).toUpperCase() || "?"}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">{user.name}</span>
              <span className="block truncate text-[11.5px] text-[var(--text-3)]">{user.email}</span>
            </span>
            <ChevronDown className="h-4 w-4 text-[var(--text-3)]" />
          </button>
        )
      }
    />
  );
}

/* ---------- actividad: reservas online, cancelaciones y reprogramaciones del cliente ---------- */

const SEEN_KEY = "cupito_activity_seen";

export function useActivity() {
  const { data } = usePanel();
  return useMemo(() => {
    const items: { id: string; at: number; bookingId: string; text: string; kind: "nueva" | "cancelada" | "reprogramada" | "seña" }[] = [];
    for (const b of data.bookings) {
      if (b.source === "online" && b.createdAt) items.push({ id: `${b.id}-n`, at: b.createdAt, bookingId: b.id, kind: "nueva", text: `${b.client} reservó ${serviceLabel(data, b)} · ${dayLabel(b.date)} ${b.time}` });
      for (const e of b.events || []) {
        if (e.by !== "cliente" || e.type === "creada") continue;
        if (e.type === "cancelada") items.push({ id: `${b.id}-c-${e.at}`, at: e.at, bookingId: b.id, kind: "cancelada", text: `${b.client} canceló su turno de ${dayLabel(b.date)} ${b.time}` });
        if (e.type === "reprogramada") items.push({ id: `${b.id}-r-${e.at}`, at: e.at, bookingId: b.id, kind: "reprogramada", text: `${b.client} reprogramó para ${dayLabel(b.date)} ${b.time}` });
      }
      if (b.depositClaim && !b.paidDeposit && b.status !== "cancelada") items.push({ id: `${b.id}-s`, at: b.depositClaim.sentAt, bookingId: b.id, kind: "seña", text: `${b.client} envió el comprobante de la seña` });
    }
    return items.sort((a, b) => b.at - a.at).slice(0, 30);
  }, [data]);
}

function ActivityBell() {
  const { openBooking } = usePanel();
  const items = useActivity();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(() => {
    try { return Number(localStorage.getItem(SEEN_KEY)) || 0; } catch { return 0; }
  });
  const unread = items.filter((i) => i.at > seen).length;
  const btn = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const toggle = () => {
    const r = btn.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
    setOpen((o) => !o);
    if (!open) {
      const now = Date.now();
      try { localStorage.setItem(SEEN_KEY, String(now)); } catch { /* sin storage */ }
      setTimeout(() => setSeen(now), 1500);
    }
  };
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest?.(".cp-activity") && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); window.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <>
      <span ref={btn} className="relative inline-flex">
        <IconButton label={unread ? `Actividad: ${unread} nuevas` : "Actividad"} onClick={toggle} aria-expanded={open}>
          <Bell />
        </IconButton>
        {unread > 0 && <span className="c-count c-count--alert absolute -right-0.5 -top-0.5 pointer-events-none" style={{ height: 16, minWidth: 16, fontSize: 10 }}>{unread > 9 ? "9+" : unread}</span>}
      </span>
      {open && (
        <Layer>
          <div className="cp-activity c-menu" style={{ position: "fixed", top: pos.top, right: pos.right, width: 340, padding: 0, maxHeight: "70vh", overflow: "auto" }} role="dialog" aria-label="Actividad reciente">
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--line)" }}>
              <p className="c-h3">Actividad de tus clientes</p>
            </div>
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-[var(--text-3)]">Cuando alguien reserve, cancele o reprograme desde tu página, lo vas a ver acá.</p>
            ) : (
              <div className="c-divide">
                {items.map((i) => (
                  <button key={i.id} type="button" className="c-list-row items-start" onClick={() => { setOpen(false); openBooking(i.bookingId); }}>
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: i.kind === "cancelada" ? "var(--danger)" : i.kind === "seña" ? "var(--warn)" : i.kind === "reprogramada" ? "var(--info)" : "var(--brand)", opacity: i.at > seen ? 1 : 0.35 }} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] leading-snug">{i.text}</span>
                      <span className="block text-[11.5px] text-[var(--text-3)]">{relTime(i.at)}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Layer>
      )}
    </>
  );
}

/* ---------- shell ---------- */

export default function Shell({
  children,
  onLogout,
  onInstall,
  banner,
}: {
  children: ReactNode;
  onLogout: () => void;
  onInstall: () => void;
  banner?: ReactNode;
}) {
  const { user, view, go, newBooking, openSearch } = usePanel();
  const groups = useNavGroups();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [moreOpen, setMoreOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { copied, copy } = useCopyLink();
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const allItems = groups.flatMap((g) => g.items);
  const pendingCount = allItems.find((i) => i.id === "reservas")?.count;
  const inMore = !["inicio", "agenda", "reservas"].includes(view);

  const nav = (id: View) => {
    go(id);
    setMoreOpen(false);
  };

  return (
    <div className="cp-app">
      {desktop && (
        <aside className="cp-side" aria-label="Navegación">
          <div className="cp-side-brand">
            <button type="button" onClick={() => go("inicio")} aria-label="Ir al inicio"><Wordmark /></button>
          </div>
          <button type="button" className="cp-biz text-left" onClick={() => go("ajustes", { tab: "negocio" })} title="Datos del negocio">
            <span className="cp-biz-mark">{user.business.trim().slice(0, 1).toUpperCase() || "C"}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold">{user.business}</span>
              <span className="block text-[11.5px] text-[var(--text-3)]">Plan {PLAN_META[user.plan]?.name || "Semilla"}</span>
            </span>
          </button>
          <button type="button" className="cp-side-search" onClick={openSearch} aria-label="Buscar">
            <Search />
            <span className="flex-1 text-left">Buscar</span>
            <span className="c-kbd">{isMac ? "⌘" : "Ctrl"} K</span>
          </button>
          <nav className="cp-nav" aria-label="Secciones">
            {groups.map((g, gi) => (
              <div key={gi}>
                {g.label && <p className="cp-nav-label">{g.label}</p>}
                {g.items.map((it) => (
                  <button key={it.id} type="button" className="cp-nav-item" aria-current={view === it.id ? "page" : undefined} onClick={() => go(it.id)}>
                    {it.icon}
                    <span className="truncate">{it.label}</span>
                    {it.count ? <span className={`c-count ${it.alert ? "c-count--alert" : ""}`}>{it.count}</span> : null}
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <div className="cp-side-foot">
            {user.plan === "semilla" && (
              <button type="button" className="cp-nav-item" onClick={() => go("ajustes", { tab: "plan" })}>
                <Sparkles />
                <span>Mejorar plan</span>
              </button>
            )}
            <button type="button" className="cp-nav-item" aria-current={view === "ajustes" ? "page" : undefined} onClick={() => go("ajustes")}>
              <Settings />
              <span>Ajustes</span>
            </button>
            <UserMenu user={user} onLogout={onLogout} onInstall={onInstall} />
          </div>
        </aside>
      )}

      <div className="cp-main">
        {desktop ? (
          <header className={`cp-top ${scrolled ? "is-scrolled" : ""}`}>
            <button type="button" onClick={openSearch} className="flex h-9 w-full max-w-[420px] items-center gap-2 rounded-[var(--r)] border border-[var(--line)] bg-[var(--surface)] px-3 text-[13px] text-[var(--text-3)] hover:border-[var(--line-2)]" aria-label="Buscar clientes, turnos o secciones">
              <Search className="h-4 w-4" />
              <span className="flex-1 text-left">Buscar clientes, turnos o secciones…</span>
              <span className="c-kbd">{isMac ? "⌘" : "Ctrl"} K</span>
            </button>
            <div className="ml-auto flex items-center gap-1.5">
              <Button variant="ghost" size="sm" icon={<Copy />} onClick={copy} title={`cupito.app/${user.slug}`}>
                {copied ? "¡Copiado!" : "Copiar mi link"}
              </Button>
              <a className="c-btn c-btn--ghost c-btn--sm" href={`/${user.slug}`} target="_blank" rel="noreferrer">
                <ExternalLink /> Ver página
              </a>
              <ActivityBell />
              <Button variant="primary" icon={<Plus />} onClick={() => newBooking()}>
                Nuevo turno
              </Button>
            </div>
          </header>
        ) : (
          <header className="cp-mobile-top">
            <button type="button" onClick={() => go("inicio")} aria-label="Ir al inicio" className="shrink-0"><Wordmark small /></button>
            <span className="min-w-0 truncate text-[13px] font-medium text-[var(--text-3)]">· {view === "inicio" ? user.business : VIEW_TITLES[view]}</span>
            <div className="ml-auto flex items-center gap-0.5">
              <IconButton label="Buscar" onClick={openSearch}><Search /></IconButton>
              <ActivityBell />
              <UserMenu user={user} onLogout={onLogout} onInstall={onInstall} compact />
            </div>
          </header>
        )}

        {banner}
        <main id="contenido" className={`cp-content ${view === "agenda" ? "cp-content--wide" : ""}`}>
          <div key={view} className="cp-enter">{children}</div>
        </main>
      </div>

      {!desktop && (
        <nav className="cp-tabbar" aria-label="Navegación principal">
          <button type="button" className="cp-tab" aria-current={view === "inicio" ? "page" : undefined} onClick={() => nav("inicio")}>
            <Home /> Inicio
          </button>
          <button type="button" className="cp-tab" aria-current={view === "agenda" ? "page" : undefined} onClick={() => nav("agenda")}>
            <CalendarDays /> Agenda
          </button>
          <button type="button" className="cp-tab cp-tab-new" onClick={() => newBooking()} aria-label="Nuevo turno">
            <span><Plus /></span>
          </button>
          <button type="button" className="cp-tab" aria-current={view === "reservas" ? "page" : undefined} onClick={() => nav("reservas")}>
            <ListChecks /> Reservas
            {pendingCount ? <span className="c-count c-count--alert">{pendingCount}</span> : null}
          </button>
          <button type="button" className="cp-tab" aria-current={inMore ? "page" : undefined} onClick={() => setMoreOpen(true)} aria-haspopup="dialog">
            <MoreHorizontal /> Más
          </button>
        </nav>
      )}

      {moreOpen && (
        <Sheet onClose={() => setMoreOpen(false)} title="Más secciones" side="center">
          <div className="grid grid-cols-3 gap-2">
            {[...allItems.filter((i) => !["inicio", "agenda", "reservas"].includes(i.id)), { id: "ajustes" as View, label: "Ajustes", icon: <Settings /> } as NavItem].map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => nav(it.id)}
                aria-current={view === it.id ? "page" : undefined}
                className="relative flex flex-col items-center gap-1.5 rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface-2)] px-2 py-3.5 text-[12.5px] font-medium text-[var(--text-2)] aria-[current=page]:border-[var(--brand-line)] aria-[current=page]:bg-[var(--brand-soft)] aria-[current=page]:text-[var(--brand-ink)] [&>svg]:h-5 [&>svg]:w-5"
              >
                {it.icon}
                <span className="text-center leading-tight">{it.label}</span>
                {it.count ? <span className="c-count c-count--brand absolute right-1.5 top-1.5">{it.count}</span> : null}
              </button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button icon={<Copy />} onClick={copy}>{copied ? "¡Copiado!" : "Copiar mi link"}</Button>
            <a className="c-btn c-btn--secondary" href={`/${user.slug}`} target="_blank" rel="noreferrer"><ExternalLink /> Ver mi página</a>
          </div>
        </Sheet>
      )}
    </div>
  );
}
