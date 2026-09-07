import { useState, type ReactNode } from "react";
import {
  Clock,
  Calendar,
  Users,
  Globe,
  MoreHorizontal,
  ChevronDown,
  Briefcase,
  UserCheck,
  ShoppingBag,
  Ticket,
  BarChart2,
  Settings,
  Sparkles,
  ExternalLink,
  LogOut,
} from "lucide-react";
import type { User, Plan } from "../lib/store";
import { PLAN_META } from "../lib/plans";

export type DashboardView =
  | "hoy"
  | "reservas"
  | "clientes"
  | "lista"
  | "stats"
  | "servicios"
  | "equipo"
  | "tienda"
  | "promos"
  | "pagina"
  | "suscripcion"
  | "ajustes";

interface SidebarProps {
  view: DashboardView;
  onViewChange: (view: DashboardView) => void;
  user: User;
  todayCount: number;
  waitlistCount: number;
  onSearchOpen: () => void;
  onLogout: () => void;
}

const MORE_VIEWS: { id: DashboardView; label: string; icon: typeof Clock }[] = [
  { id: "servicios", label: "Servicios", icon: Briefcase },
  { id: "equipo", label: "Equipo", icon: UserCheck },
  { id: "tienda", label: "Tienda", icon: ShoppingBag },
  { id: "promos", label: "Cupones", icon: Ticket },
  { id: "lista", label: "Lista de espera", icon: Users },
  { id: "stats", label: "Estadísticas", icon: BarChart2 },
  { id: "suscripcion", label: "Plan", icon: Sparkles },
  { id: "ajustes", label: "Ajustes", icon: Settings },
];

export default function Sidebar({
  view,
  onViewChange,
  user,
  todayCount,
  waitlistCount,
  onSearchOpen,
  onLogout,
}: SidebarProps) {
  const isMoreActive = MORE_VIEWS.some((item) => item.id === view);
  const [moreExpanded, setMoreExpanded] = useState(true);

  const primaryNav: {
    id: DashboardView;
    label: string;
    icon: typeof Clock;
    badge?: number;
  }[] = [
    { id: "hoy", label: "Hoy", icon: Clock, badge: todayCount > 0 ? todayCount : undefined },
    { id: "reservas", label: "Reservas", icon: Calendar },
    { id: "clientes", label: "Clientes", icon: Users },
    { id: "pagina", label: "Mi página", icon: Globe },
  ];

  return (
    <aside className="sticky top-0 z-40 hidden h-screen w-60 shrink-0 flex-col border-r border-black/[0.06] bg-white text-[#1D1D1F] lg:flex select-none">
      {/* Brand & Workspace */}
      <div className="p-4 pb-3 border-b border-black/[0.04]">
        <button
          type="button"
          onClick={() => onViewChange("hoy")}
          className="flex items-center gap-2.5 text-left group focus:outline-none"
          title="Ir a Hoy"
        >
          <img
            src="/cupito-logo.png"
            width="30"
            height="30"
            alt=""
            className="rounded-lg transition-transform group-hover:scale-105"
          />
          <span className="font-display text-lg font-bold tracking-tight text-[#1D1D1F]">
            cupito<span className="text-[#16A34A]">.</span>
          </span>
        </button>

        <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-[#F5F5F7] p-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-black text-white font-display text-xs font-bold">
            {user.business.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <span className="block truncate font-display text-xs font-bold text-[#1D1D1F] leading-tight">
              {user.business}
            </span>
            <span className="block text-[10px] text-[#6E6E73] font-medium">
              Plan {PLAN_META[user.plan]?.name || "Semilla"}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Search */}
      <div className="px-3 pt-3">
        <button
          type="button"
          onClick={onSearchOpen}
          aria-label="Buscar en el panel"
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-black/[0.08] bg-[#F5F5F7] px-3 py-2 text-xs font-medium text-[#6E6E73] transition-colors hover:bg-neutral-200/70 hover:text-[#1D1D1F]"
        >
          <span>Buscar en el panel</span>
          <kbd className="rounded border border-black/10 bg-white px-1.5 py-0.5 text-[10px] font-mono text-[#6E6E73]">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* 5 Primary Navigation Items */}
      <nav aria-label="Navegación principal" className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {primaryNav.map((item) => {
          const active = view === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => onViewChange(item.id)}
              className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                active
                  ? "bg-black text-white shadow-sm font-bold"
                  : "text-[#6E6E73] hover:bg-black/5 hover:text-[#1D1D1F]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon size={16} className={active ? "!text-white" : "text-[#6E6E73] group-hover:text-[#1D1D1F]"} />
                <span className={active ? "!text-white font-bold" : ""}>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span
                  className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                    active ? "bg-white/20 !text-white" : "bg-neutral-200 text-[#1D1D1F]"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* 5th Item: Más */}
        <div className="pt-1">
          <button
            type="button"
            aria-expanded={moreExpanded}
            onClick={() => setMoreExpanded(!moreExpanded)}
            className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
              isMoreActive
                ? "bg-neutral-100 text-[#1D1D1F] font-bold"
                : "text-[#6E6E73] hover:bg-black/5 hover:text-[#1D1D1F]"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <MoreHorizontal size={16} />
              <span>Más</span>
            </div>
            <ChevronDown
              size={14}
              className={`text-[#6E6E73] transition-transform duration-200 ${
                moreExpanded ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Submenu for "Más" */}
          {moreExpanded && (
            <div data-submenu className="mt-1 ml-3 pl-3 border-l border-black/[0.08] space-y-0.5">
              {MORE_VIEWS.map((sub) => {
                const active = view === sub.id;
                const SubIcon = sub.icon;
                const waitlistBadge = sub.id === "lista" && waitlistCount > 0 ? waitlistCount : null;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    aria-current={active ? "page" : undefined}
                    onClick={() => onViewChange(sub.id)}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                      active
                        ? "bg-black text-white font-bold"
                        : "text-[#6E6E73] hover:bg-black/5 hover:text-[#1D1D1F]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <SubIcon size={14} className={active ? "!text-white" : "text-[#6E6E73]"} />
                      <span className={active ? "!text-white font-bold" : ""}>{sub.label}</span>
                    </div>
                    {waitlistBadge !== null && (
                      <span
                        className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                          active ? "bg-white/20 !text-white" : "bg-neutral-200 text-[#1D1D1F]"
                        }`}
                      >
                        {waitlistBadge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      {/* Footer Profile & Page Link */}
      <div className="border-t border-black/[0.04] p-3 space-y-2">
        <a
          href={`/${user.slug}`}
          target="_blank"
          rel="noreferrer"
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-black/[0.08] bg-white py-2 text-xs font-semibold text-[#1D1D1F] transition-all hover:bg-[#F5F5F7] active:scale-98"
        >
          <Globe size={13} className="text-[#16A34A]" />
          <span>Ver mi página</span>
          <ExternalLink size={11} className="text-[#6E6E73]" />
        </a>

        <div className="flex items-center justify-between rounded-xl bg-[#F5F5F7] px-2.5 py-2">
          <div className="min-w-0 flex-1 pr-2">
            <span className="block truncate text-xs font-bold text-[#1D1D1F]">{user.name}</span>
            <span className="block truncate text-[10px] text-[#6E6E73]">{user.email}</span>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-lg p-1 text-[#6E6E73] hover:bg-black/5 hover:text-[#1D1D1F] transition-colors"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
