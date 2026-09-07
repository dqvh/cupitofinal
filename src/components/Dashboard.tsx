import WorkspaceSearch from "./WorkspaceSearch";
import "../styles/workspace-ui.css";
import { validateHours, validateTransfer } from "../lib/scheduling";
import { PLAN_FEATURES } from "../lib/plans";
import { useEffect, useMemo, useState, useRef, type FormEvent, type ReactNode } from "react";
import QRCode from "qrcode";
import {
  useStore,
  dateKey,
  addDays,
  slotsForDay,
  dayOfWeek,
  fmtMoney,
  fmtLong,
  fmtDateHuman,
  fmtDateNatural,
  getDayHours,
  isPaid,
  getSubscriptionStatus,
  PLAN_META,
  PRO_LIMIT,
  defaultHours,
  THEMES,
  sortWaitlist,
  isRecurrentClient,
  SEMILLA_MONTHLY_LIMIT,
  monthBookingCount,
  serviceDurationOf,
  findOverlap,
  isSlotBlocked,
  getProHours,
  toMinutes,
  type User,
  type ThemeId,
  type Booking,
  type BookingStatus,
  type Service,
  type Product,
  type DayHours,
  type Plan,
  type BizSettings,
  type BizData,
  type BlockedSlot,
  type Professional,
} from "../lib/store";
import { createWhatsAppUrl, formatArgentinaPhone, cleanPhoneDigits } from "../lib/phone";
import { getSupabaseStatus } from "../lib/supabase";
import { sound } from "../lib/audio";
import { sendSubscriptionWelcomeEmail } from "../lib/email";
import PublicBooking from "./PublicBooking";
import { PlanCheckout } from "./PlanCheckout";
import CustomSelect from "./ui/CustomSelect";
import {
  clearPendingCheckout,
  confirmMercadoPago,
  getHashParam,
  getPreapprovalIdFromUrl,
  readPendingCheckout,
  requestCheckout,
  PLAN_BENEFITS,
} from "../lib/billing";
import {
  Reveal,
  CountUp,
  LogoMark,
  IconClock,
  IconCalendar,
  IconWallet,
  IconLink,
  IconChart,
  IconGear,
  IconBag,
  IconLock,
  IconTicket,
  IconUsers,
  IconStar,
  IconSpark,
  IconBell,
  IconChevron,
  IconPlus,
  IconTrash,
  IconPencil,
  IconLogout,
  IconCheck,
  IconArrow,
  IconWhatsApp,
  CopyButton,
  IconSearch,
  IconCopy,
  Badge,
} from "./kit";
import "../styles/dashboard.css";
import { AgendaWeek } from "./AgendaWeek";
import { CustomerHistoryModal, type CustomerStats } from "./CustomerCRM";
import { Sun, Download, MoreHorizontal, Smartphone, List, Calendar, Ban, Zap, Phone, ArrowUpRight, Star, Share2 } from "lucide-react";
import Sidebar from "./Sidebar";
import BookingRow from "./BookingRow";
import SetupGuide from "./SetupGuide";
import EmptyState from "./EmptyState";

function ItemActionMenu({
  onEdit,
  onDelete,
  deleteLabel = "Eliminar",
  editLabel = "Editar",
  ariaLabel = "Opciones",
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  editLabel?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        aria-label={ariaLabel}
        aria-expanded={open}
        className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 min-w-[140px] overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-lg ring-1 ring-black/5"
        >
          {onEdit && (
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onEdit();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <IconPencil className="h-3.5 w-3.5 text-slate-500" />
              <span>{editLabel}</span>
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onDelete();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <IconTrash className="h-3.5 w-3.5 text-rose-500" />
              <span>{deleteLabel}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

type View = "hoy" | "reservas" | "clientes" | "lista" | "stats" | "servicios" | "equipo" | "tienda" | "promos" | "pagina" | "suscripcion" | "ajustes";

const SECTIONS: { label: string; items: { id: View; label: string; icon: (p: { className?: string }) => ReactNode }[] }[] = [
  {
    label: "Gestión",
    items: [
      { id: "hoy", label: "Agenda del día", icon: (p) => <IconClock {...p} /> },
      { id: "reservas", label: "Reservas", icon: (p) => <IconCalendar {...p} /> },
      { id: "clientes", label: "Clientes", icon: (p) => <IconUsers {...p} /> },
      { id: "lista", label: "Lista de espera", icon: (p) => <IconUsers {...p} /> },
      { id: "stats", label: "Estadísticas", icon: (p) => <IconChart {...p} /> },
    ],
  },
  {
    label: "Negocio",
    items: [
      { id: "servicios", label: "Servicios", icon: (p) => <IconWallet {...p} /> },
      { id: "equipo", label: "Equipo", icon: (p) => <IconUsers {...p} /> },
      { id: "tienda", label: "Tienda", icon: (p) => <IconBag {...p} /> },
      { id: "promos", label: "Cupones", icon: (p) => <IconTicket {...p} /> },
    ],
  },
  {
    label: "Presencia",
    items: [{ id: "pagina", label: "Mi página", icon: (p) => <IconLink {...p} /> }],
  },
  {
    label: "Cuenta",
    items: [
      { id: "suscripcion", label: "Plan", icon: (p) => <IconStar {...p} /> },
      { id: "ajustes", label: "Ajustes", icon: (p) => <IconGear {...p} /> },
    ],
  },
];

const STATUS: Record<BookingStatus, { label: string; cls: string }> = {
  pendiente: { label: "Pendiente", cls: "border-2 border-coral/40 bg-coral/10 text-coral" },
  confirmada: { label: "Confirmada", cls: "border-2 border-limedeep/60 bg-lime/25 text-fern" },
  atendida: { label: "Atendida", cls: "border-2 border-fern/30 bg-fern/10 text-fern" },
  cancelada: { label: "Cancelada", cls: "border-2 border-ink/10 bg-ink/5 text-ink/40" },
  ausente: { label: "No vino", cls: "border-2 border-amber-500/40 bg-amber-50 text-amber-800" },
};

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default function Dashboard() {
  const store = useStore();
  const {
    user,
    data,
    toast,
    setStatus,
    removeBooking,
    saveProfile,
    stopImpersonating,
    impersonating,
    requestReview,
    rescheduleBooking,
    addBlockedSlot,
    removeBlockedSlot,
    saveClientNote,
    addClosedDate,
    removeClosedDate,
  } = store;
  const sessionUserId = store.sessionUserId;
  const [view, setView] = useState<View>("hoy");
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("negocio");
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [view, settingsTab]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(open => !open); }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  const [selDate, setSelDate] = useState(dateKey(new Date()));
  const [weekStart, setWeekStart] = useState(0);
  const [showNew, setShowNew] = useState(false);
  const [rescheduling, setRescheduling] = useState<Booking | null>(null);
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);
  const [prefill, setPrefill] = useState<{ date?: string; client?: string; phone?: string; serviceId?: string; waitlistId?: string; time?: string; proId?: string } | null>(null);
  const [serviceModal, setServiceModal] = useState<{ open: boolean; id?: string }>({ open: false });
  const [filter, setFilter] = useState<"todas" | BookingStatus>("todas");
  const [proFilter, setProFilter] = useState<string>("todos");
  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [pendingOnboarding, setPendingOnboarding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [reservasMode, setReservasMode] = useState<"lista" | "grilla">("lista");
  const [gridDate, setGridDate] = useState(dateKey(new Date()));
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockPrefillTime, setBlockPrefillTime] = useState<string | undefined>(undefined);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [notifyWl, setNotifyWl] = useState<{ client: string; phone: string; serviceName: string; date: string; time: string } | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarProId, setCalendarProId] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [agendaView, setAgendaView] = useState<"day" | "week">("day");
  const [crmCustomer, setCrmCustomer] = useState<CustomerStats | null>(null);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [showPreviewAccordion, setShowPreviewAccordion] = useState(false);

  const handleDeleteBookingWithUndo = (id: string) => {
    const bookingToDelete = data?.bookings.find((b) => b.id === id);
    if (!bookingToDelete) return;
    removeBooking(id);
    toast("Reserva eliminada.");
  };

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    const checkStandalone = () => {
      const isApp = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
      setIsStandalone(Boolean(isApp));
    };
    checkStandalone();
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const promptInstall = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice && choice.outcome === "accepted") {
          setDeferredPrompt(null);
          store.toast("¡Cupito agregado a tu pantalla de inicio!");
          return;
        }
      } catch {}
    }
    setShowInstallModal(true);
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const checkout = getHashParam("checkout");
      const paidCheckout = checkout === "crece" || checkout === "escala";
      if (checkout === "crece" || checkout === "escala" || checkout === "semilla") {
        setCheckoutPlan(checkout);
      }

      const onboardingParam = getHashParam("onboarding") || getHashParam("setup");
      // Solo auto-mostrar si el negocio está realmente vacío (sin servicios NI
      // turnos NI equipo). Antes bastaba con services===0, y en un login fresco
      // en otro celu los datos todavía no bajaron de la nube → el modal
      // aparecía siempre aunque el negocio ya estuviera configurado.
      const isTrulyNew = !!data && data.services.length === 0 && data.bookings.length === 0 && (data.professionals || []).length === 0 && !data.settings.setupDismissed;
      if (onboardingParam === "1" || isTrulyNew) {
        // Si viene a pagar un plan, el checkout va PRIMERO y el onboarding después.
        // Antes el onboarding (z-85) tapaba el checkout y parecía que nunca iba a Mercado Pago.
        if (paidCheckout) {
          setPendingOnboarding(true);
        } else {
          setShowOnboarding(true);
        }
      }

      // Limpiar los params del hash para que el checkout no se reabra solo
      // (ej: al volver de Mercado Pago ya pagado).
      if (checkout || onboardingParam) {
        try {
          window.history.replaceState({}, "", "#/app");
        } catch { /* noop */ }
      }

      const preapprovalId = getPreapprovalIdFromUrl();
      if (!preapprovalId) return;
      const result = await confirmMercadoPago(preapprovalId);
      if (cancelled) return;
      if (result.authorized) {
        const plan = result.plan || readPendingCheckout()?.plan || "crece";
        store.setPlan(plan);
        // Guardar el id para poder cancelar la suscripción en MP después
        if (preapprovalId) store.saveMpPreapprovalId(preapprovalId);
        clearPendingCheckout();
        store.toast(`Pago confirmado. Ya estás en el plan ${PLAN_META[plan].name} ✓`);
        if (user && user.email) {
          sendSubscriptionWelcomeEmail({
            toEmail: user.email,
            ownerName: user.name,
            businessName: user.business,
            planName: PLAN_META[plan].name,
            planPrice: PLAN_META[plan].price,
            slug: user.slug,
            benefits: PLAN_BENEFITS[plan],
          }).catch(() => {});
        }
      } else if (result.error) {
        store.toast(result.error, "warn");
      } else {
        store.toast("Mercado Pago todavía no autorizó el pago. Si ya pagaste, recargá en un momento.", "warn");
      }
      if (window.location.search.includes("preapproval") || window.location.hash.includes("preapproval")) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete("preapproval_id");
          url.searchParams.delete("preapprovalId");
          url.searchParams.delete("preapproval");
          const cleanHash = (window.location.hash || "").split("?")[0] || "#/app";
          window.history.replaceState({}, "", url.pathname + cleanHash);
        } catch { /* noop */ }
      }
    };
    void run();
    const onCheckout = (e: Event) => {
      const plan = (e as CustomEvent<Plan>).detail;
      if (plan === "semilla" || plan === "crece" || plan === "escala") setCheckoutPlan(plan);
    };
    window.addEventListener("cupito-checkout", onCheckout);
    return () => { cancelled = true; window.removeEventListener("cupito-checkout", onCheckout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si el onboarding se abrió por datos todavía no sincronizados (login fresco
  // en otro celu) y la nube trae un negocio ya configurado, cerrarlo solo.
  useEffect(() => {
    if (!showOnboarding || !data) return;
    if (data.settings.setupDismissed) { setShowOnboarding(false); return; }
    if (data.services.length > 0 && data.bookings.length > 0) setShowOnboarding(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.services.length, data?.bookings.length, data?.settings.setupDismissed]);

  // Barrido de señas vencidas: comprobantes sin verificar por más de 24 h
  // liberan el turno solos para no dejar huecos bloqueados para siempre.
  useEffect(() => {
    if (!sessionUserId) return;
    const n = store.releaseExpiredClaims();
    if (n > 0) {
      store.toast(`Se liberaron ${n} turno${n === 1 ? "" : "s"} con seña sin verificar por más de 24 h.`, "warn");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUserId]);

  const today = dateKey(new Date());
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(new Date(), weekStart + i)), [weekStart]);

  if (!user || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-6 text-center">
        <LogoMark className="h-12 w-12 text-fern" />
        <p className="font-display text-2xl font-extrabold text-ink">Necesitás una cuenta para ver el panel</p>
        <a href="#/auth" className="rounded-full bg-lime px-7 py-3 font-display font-bold text-ink transition-all hover:-translate-y-0.5 hover:bg-limedeep">Crear cuenta gratis</a>
      </div>
    );
  }

  const dayBookings = data.bookings
    .filter((b) => b.date === selDate)
    .filter((b) => proFilter === "todos" || b.proId === proFilter)
    .sort((a, b) => a.time.localeCompare(b.time));

  const nextBooking = dayBookings.find(booking => (booking.status === "confirmada" || booking.status === "pendiente") && (booking.date > today || (booking.date === today && booking.time >= new Date().toTimeString().slice(0, 5))));
  const pendingBookings = data.bookings.filter(booking => booking.status === "pendiente").length;
  const dayIncome = dayBookings
    .filter((b) => b.status === "atendida" || (b.status === "confirmada" && b.paymentStatus === "total_pagado"))
    .reduce((acc, b) => {
      const sPrice = data.services.find((s) => s.id === b.serviceId)?.price ?? 0;
      const extraPrice = (b.extraServiceIds || []).reduce((sum, sid) => sum + (data.services.find((s) => s.id === sid)?.price ?? 0), 0);
      return acc + (b.paidAmount || (sPrice + extraPrice));
    }, 0);

  const daySlots = slotsForDay(getDayHours(data.settings, selDate));
  const freeSlots = useMemo(() => {
    return daySlots.filter((slotTime) => {
      const sMin = toMinutes(slotTime);
      return !dayBookings.some((b) => {
        if (b.status === "cancelada") return false;
        if (proFilter !== "todos" && b.proId && b.proId !== proFilter) return false;
        const dur = serviceDurationOf(data.services, b.serviceId, data.professionals.find((p) => p.id === b.proId));
        const bStart = toMinutes(b.time);
        const bEnd = bStart + dur;
        return sMin >= bStart && sMin < bEnd;
      });
    });
  }, [daySlots, dayBookings, proFilter, data.services, data.professionals]);
  const occupancy = Math.min(100, Math.round((dayBookings.filter((b) => b.status !== "cancelada").length / Math.max(1, daySlots.length)) * 100));

  const upcoming = data.bookings
    .filter((b) => (filter === "todas" || b.status === filter))
    .filter((b) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const svc = data.services.find((s) => s.id === b.serviceId)?.name.toLowerCase() || "";
      return b.client.toLowerCase().includes(q) || b.phone.includes(q) || svc.includes(q);
    })
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));

  const pendingClaims = data.bookings.filter((b) => b.depositClaim && !b.paidDeposit && b.status !== "cancelada").length;
  const oldestClaimHrs = (() => {
    const times = data.bookings
      .filter((b) => b.depositClaim && !b.paidDeposit && b.status !== "cancelada")
      .map((b) => b.depositClaim!.sentAt);
    if (times.length === 0) return 0;
    return Math.max(0, Math.floor((Date.now() - Math.min(...times)) / 3600000));
  })();

  const serviceOf = (id: string) => data.services.find((s) => s.id === id);

  const title: Record<View, [string, string]> = {
    hoy: ["Agenda del día", "Acá ves quién viene hoy, clarito y paso a paso. Sin vueltas."],
    reservas: ["Todas las reservas", "Todos los turnos juntos. Tocá uno para confirmar, cambiarlo o avisar por WhatsApp."],
    clientes: ["Clientes", "Toda tu gente en un solo lugar: quién vino, cuándo y qué le gusta."],
    lista: ["Lista de espera", "Gente que quiere venir cuando estás lleno. Avisales cuando se libere un lugar."],
    stats: ["Estadísticas", "Cómo viene tu negocio, en números fáciles. Sin tecnicismos."],
    servicios: ["Servicios", "Lo que hacés y cuánto cobrás. Esto lo ven tus clientes al reservar."],
    equipo: ["Tu equipo", "Quiénes atienden con vos. Agregalos para que tengan su propia agenda."],
    tienda: ["Tienda de productos", "Lo que vendés además del turno. El cliente lo pide al reservar y lo retira en el local."],
    promos: ["Cupones", "Descuentos para llenar los horarios flojos. Solo si querés, no es obligatorio."],
    pagina: ["Mi página de reservas", "Tu link para compartir por WhatsApp o Instagram. Ahí reservan solitos."],
    suscripcion: ["Plan y suscripción", "Qué plan tenés, cuánto pagás y cuándo se renueva."],
    ajustes: ["Ajustes", "Todo lo importante de tu local en un solo lugar: horarios, pagos y tu cuenta."],
  };

  const viewTitle = title[view] || ["Panel de Control", "Administrá tu negocio."];

  const sectionOf = (v: View) => SECTIONS.find((s) => s.items.some((i) => i.id === v))?.label ?? "";

  return (
    <div className="workspace-app flex min-h-screen flex-col bg-[#F5F5F7] text-ink selection:bg-fern selection:text-white">
      {impersonating && (
        <div className="sticky top-0 z-50 flex w-full items-center justify-center gap-3 bg-coral px-4 py-2 text-center text-white">
          <IconUsers className="h-4 w-4 shrink-0" />
          <p className="text-sm font-bold">Modo soporte: estás dentro de <strong>{user.business}</strong>. Los cambios afectan su cuenta.</p>
          <button onClick={() => { stopImpersonating(); window.location.hash = "#/central"; }} className="shrink-0 rounded-full bg-white px-3.5 py-1 text-xs font-bold text-coral transition-all hover:-translate-y-0.5">Salir</button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* ---------- sidebar ---------- */}
        <Sidebar
          view={view}
          onViewChange={setView}
          user={user}
          todayCount={data.bookings.filter((b) => b.date === today && b.status !== "cancelada").length}
          waitlistCount={data.waitlist.length}
          onSearchOpen={() => setSearchOpen(true)}
          onLogout={store.logout}
        />

        {/* ---------- main ---------- */}
        <div className="min-w-0 flex-1">
          {/* topbar mobile */}
          <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 backdrop-blur-md px-3.5 sm:px-4 text-slate-800 lg:hidden">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              {/* Botón 3 líneas horizontales (Hamburguesa) */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition-transform active:scale-95 hover:bg-slate-200 focus:outline-hidden"
                aria-label="Abrir menú de navegación"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
                {data.waitlist.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-extrabold text-white animate-pulse shadow-xs">
                    {data.waitlist.length}
                  </span>
                )}
              </button>

              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => setView("hoy")}
                  className="flex items-center gap-1.5 shrink-0 text-left focus:outline-hidden"
                  title="Ir a la agenda del día"
                >
                  <img src="/cupito-logo.png" width="24" height="24" alt="" className="rounded-md" />
                  <span className="font-display text-base font-bold tracking-tight text-slate-900">cupito<span className="text-emerald-600">.</span></span>
                </button>
                <span className="text-slate-300">/</span>
                <span className="truncate text-xs font-bold text-emerald-800">
                  {viewTitle[0]}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={promptInstall}
                className="btn-press flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-display text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-100"
                title="Instalar app en tu celular"
              >
                <Smartphone size={13} />
                <span className="hidden xs:inline">{isStandalone ? "App lista" : "Instalar"}</span>
              </button>
              <a
                href={`/${user.slug}`}
                target="_blank"
                rel="noreferrer"
                className="btn-press flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 font-display text-xs font-bold text-white shadow-xs transition-colors hover:bg-emerald-500"
              >
                <span>Ver</span>
                <ArrowUpRight size={12} />
              </a>
            </div>
          </header>

          {/* Drawer sidebar mobile */}
          <div
            className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ease-out ${
              mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            }`}
            aria-hidden={!mobileMenuOpen}
            style={{ visibility: mobileMenuOpen ? "visible" : "hidden" }}
          >
            {/* Backdrop con blur */}
            <div
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300"
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Panel lateral deslizante */}
            <div
              className={`absolute inset-y-0 left-0 flex w-[84vw] max-w-xs flex-col bg-white text-slate-900 shadow-2xl border-r border-slate-200 transition-transform duration-300 ease-out transform ${
                mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
              }`}
            >
              {/* Header de la sidebar */}
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
                <div className="flex items-center gap-2.5">
                  <img src="/cupito-logo.png" width="28" height="28" alt="" className="rounded-lg" />
                  <div>
                    <span className="block font-display text-base font-bold tracking-tight text-slate-900 leading-tight">
                      cupito<span className="text-emerald-600">.</span>
                    </span>
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      {user.business}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors active:scale-95"
                  aria-label="Cerrar menú"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Navegación con todas las secciones */}
              <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
                {SECTIONS.map((sec) => (
                  <div key={sec.label}>
                    <p className="px-3 pb-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">
                      {sec.label}
                    </p>
                    <div className="space-y-0.5">
                      {sec.items.map((n) => {
                        const active = view === n.id;
                        return (
                          <button
                            key={n.id}
                            onClick={() => {
                              setView(n.id);
                              setMobileMenuOpen(false);
                            }}
                            className={`group flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-bold transition-all duration-150 ${
                              active
                                ? "bg-emerald-50 text-emerald-900 font-extrabold shadow-xs border border-emerald-200"
                                : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 active:bg-slate-100"
                            }`}
                          >
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                                active
                                  ? "bg-emerald-600 text-white font-bold shadow-xs shadow-emerald-600/30"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {n.icon({ className: "h-3.5 w-3.5" })}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{n.label}</span>
                            {active && <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />}
                            {n.id === "lista" && data.waitlist.length > 0 && (
                              <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-extrabold text-white">
                                {data.waitlist.length}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>

              {/* Footer mobile drawer */}
              <div className="border-t border-slate-200 p-3.5 space-y-2 bg-slate-50/50">
                <a
                  href={`/${user.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn-press flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 font-display text-xs font-bold text-white shadow-xs"
                >
                  <IconLink className="h-3.5 w-3.5" /> Ver mi página <ArrowUpRight size={12} className="inline ml-0.5" />
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    store.logout();
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  <IconLogout className="h-3.5 w-3.5 text-slate-500" /> Cerrar sesión
                </button>
              </div>
            </div>
          </div>

          <main className="workspace-content mx-auto max-w-5xl px-5 py-8 pb-28 sm:px-8">
            <div className="workspace-page-heading flex flex-wrap items-center justify-between gap-4 border-b border-black/[0.06] pb-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6E6E73]">
                    <button
                      type="button"
                      onClick={() => setView("hoy")}
                      className="hover:text-black font-bold transition-colors cursor-pointer"
                      title="Ir a la agenda de hoy"
                    >
                      Cupito
                    </button>
                    <span className="text-black/20">/</span>
                    <span className="text-[#6E6E73]">{sectionOf(view)}</span>
                    <span className="text-black/20">/</span>
                    <span className="text-[#1D1D1F] font-bold">{viewTitle[0]}</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#6E6E73] shadow-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A] animate-pulse" />
                    {store.isCloudSyncActive ? "Nube conectada" : "Este dispositivo"}
                  </span>
                  <CopyButton
                    text={`https://cupito.app/${user.slug}`}
                    label="Copiar mi link"
                    copiedLabel="¡Link copiado!"
                    className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[#1D1D1F] shadow-xs hover:border-black/30"
                  />
                </div>
                <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-[#1D1D1F] sm:text-3xl lg:text-4xl">{viewTitle[0]}</h1>
                <p className="mt-1 text-sm text-[#6E6E73]">{viewTitle[1]}</p>
              </div>
              <div className="flex items-center gap-2.5">
                <button type="button" className="workspace-nav-search" onClick={() => setSearchOpen(true)} aria-label="Buscar acciones">Buscar <span aria-hidden="true">⌕</span></button>
                <button
                  onClick={() => { setPrefill(null); setShowNew(true); }}
                  className="btn-press group inline-flex items-center gap-2 rounded-full bg-black px-5 py-2.5 font-display text-sm font-bold text-white shadow-sm hover:bg-neutral-800"
                >
                  <IconPlus className="h-4 w-4 text-[#16A34A]" /> Nueva reserva
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setHeaderMenuOpen(!headerMenuOpen)}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors"
                    aria-label="Más opciones"
                    aria-expanded={headerMenuOpen}
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  {headerMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-black/10 bg-white p-1.5 shadow-xl z-30 animate-in fade-in zoom-in-95">
                      <button
                        type="button"
                        onClick={() => { setShowCalendarModal(true); setHeaderMenuOpen(false); }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7]"
                      >
                        <IconCalendar className="h-4 w-4 text-[#16A34A]" /> Sincronizar calendario
                      </button>
                      <a
                        href={`/${user.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => setHeaderMenuOpen(false)}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7]"
                      >
                        <IconLink className="h-4 w-4 text-[#6E6E73]" /> Ver mi página <ArrowUpRight size={12} className="inline ml-0.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => { promptInstall(); setHeaderMenuOpen(false); }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7]"
                      >
                        <IconStar className="h-4 w-4 text-[#6E6E73]" /> {isStandalone ? "App instalada" : "Instalar app"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Smart Subscription Banners (Avisos inteligentes de vencimiento) */}
            {(() => {
              const subStatus = getSubscriptionStatus(user);
              if (subStatus.isExpired) {
                return (
                  <div className="pop-in mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50/90 p-4 shadow-sm text-rose-950">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-sm">
                        <IconLock className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="font-display text-sm font-bold">
                          Tu período del Plan {PLAN_META[user.plan].name} ha finalizado
                        </p>
                        <p className="text-xs text-rose-800">
                          Tu cuenta pasó a modo básico (Semilla). Activá el débito automático con Mercado Pago para reactivar las funciones de tu plan y las reservas sin tope.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCheckoutPlan(user.plan === "semilla" ? "crece" : user.plan)}
                      className="btn-press rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700"
                    >
                      Activar con Mercado Pago
                    </button>
                  </div>
                );
              }
              if (subStatus.isGracePeriod) {
                return (
                  <div className="pop-in mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50/90 p-4 shadow-sm text-amber-950">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
                        <IconBell className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="font-display text-sm font-bold">
                          Tu período de {PLAN_META[user.plan].name} venció · Estás en período de gracia de 3 días
                        </p>
                        <p className="text-xs text-amber-800">
                          Activá el débito automático con Mercado Pago para que tu negocio continúe operando sin cortes.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCheckoutPlan(user.plan)}
                      className="btn-press rounded-full bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-700"
                    >
                      Renovar con Mercado Pago
                    </button>
                  </div>
                );
              }
              if (subStatus.isExpiringSoon && !subStatus.hasMpAutoDebit) {
                return (
                  <div className="pop-in mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm text-amber-950">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
                        <IconClock className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="font-display text-sm font-bold">
                          Tu período manual de {PLAN_META[user.plan].name} vence en {subStatus.daysRemaining} días ({fmtDateHuman(new Date(user.subscription?.nextRenewal || Date.now()).toISOString())})
                        </p>
                        <p className="text-xs text-amber-800">
                          Activá el débito mensual en Mercado Pago para que se renueve solo y no tengas que transferir cada mes.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCheckoutPlan(user.plan)}
                      className="btn-press rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800"
                    >
                      Activar con Mercado Pago
                    </button>
                  </div>
                );
              }
              return null;
            })()}

            {view === "hoy" && <SetupGuide onGo={(v) => setView(v)} onCheckout={(p) => setCheckoutPlan(p)} />}

            {view === "hoy" && (
              <div className="workspace-greeting my-1 text-xs sm:text-sm">
                <Sun size={18} aria-hidden="true" />
                <p>Hola, {user.name.split(" ")[0]}. <span>Tenés {data.bookings.filter(booking => booking.date === today && booking.status !== "cancelada").length} turnos para hoy.</span></p>
              </div>
            )}

            {pendingClaims > 0 && (
              <div className="pop-in mt-3 sm:mt-6 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/70 px-4 py-2.5 shadow-xs">
                <IconBell className="h-5 w-5 shrink-0 text-rose-600" />
                <p className="flex-1 text-xs sm:text-sm font-semibold text-slate-900">
                  {pendingClaims} seña{pendingClaims === 1 ? "" : "s"} esperando tu verificación — revisá tu homebanking y acreditá o rechazá desde Reservas.
                  <span className="block text-xs font-normal text-slate-500">Se liberan solas si pasan 24 h sin verificar{oldestClaimHrs > 0 ? ` · la más vieja lleva ${oldestClaimHrs} h` : ""}.</span>
                </p>
              </div>
            )}

            {/* ============ HOY ============ */}
            {view === "hoy" && (
              <div className="pop-in mt-2 sm:mt-6">
                {/* Badges compactos de acciones pendientes y bloqueo rápido */}
                <section className="workspace-attention" aria-label="Acciones pendientes">
                  <h2 className="sr-only">Acciones pendientes</h2>
                  <button
                    type="button"
                    onClick={() => { setFilter("pendiente"); setSearchQuery(""); setProFilter("todos"); setView("reservas"); }}
                    className="workspace-badge"
                  >
                    <span>Turnos por confirmar</span>
                    <strong>{pendingBookings}</strong>
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("lista")}
                    className="workspace-badge"
                  >
                    <span>Lista de espera</span>
                    <strong>{data.waitlist.length}</strong>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBlockPrefillTime("12:00");
                      setShowBlockModal(true);
                    }}
                    className="workspace-badge-cta"
                  >
                    <IconLock className="h-3.5 w-3.5" />
                    <span>Bloquear horario</span>
                  </button>
                </section>

                {nextBooking && (
                  <div className="mb-2 sm:mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-xs text-emerald-950 shadow-xs">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
                        <IconClock className="h-3 w-3" />
                      </span>
                      <span>
                        <strong>Próximo turno:</strong> {nextBooking.time} hs · {nextBooking.client} ({data.services.find(s => s.id === nextBooking.serviceId)?.name || "Turno"})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetailBooking(nextBooking)}
                      className="font-bold text-emerald-800 underline hover:text-emerald-950 text-xs"
                    >
                      Ver detalle →
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button onClick={() => setWeekStart((w) => w - 7)} aria-label="Semana anterior" className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-xs transition-all hover:bg-slate-50 hover:border-slate-300"><IconChevron className="h-4 w-4 rotate-180" /></button>
                  <div className="no-scrollbar flex flex-1 gap-1.5 sm:gap-2 overflow-x-auto py-1">
                    {week.map((d) => {
                      const k = dateKey(d);
                      const count = data.bookings.filter((b) => b.date === k && b.status !== "cancelada").length;
                      const isSel = selDate === k;
                      return (
                        <button key={k} onClick={() => setSelDate(k)}
                          className={`flex min-w-[62px] sm:min-w-[78px] flex-col items-center rounded-2xl border px-2.5 sm:px-3.5 py-2 sm:py-3 transition-all duration-150 ${isSel ? "border-slate-900 bg-slate-900 text-white shadow-sm ring-2 ring-emerald-500/20" : "border-slate-200/80 bg-white text-slate-800 hover:border-slate-300 hover:shadow-xs"}`}>
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${isSel ? "text-slate-300" : "text-slate-400"}`}>{k === today ? "Hoy" : d.toLocaleDateString("es-ES", { weekday: "short" }).slice(0, 3)}</span>
                          <span className="font-display text-base sm:text-xl font-extrabold leading-tight mt-0.5">{d.getDate()}</span>
                          <span className={`mt-1 rounded-full px-2 py-0.5 text-[9px] sm:text-[10px] font-bold ${isSel ? "bg-emerald-500 text-slate-950" : count > 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60" : "bg-slate-100 text-slate-400"}`}>{count} turno{count === 1 ? "" : "s"}</span>
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={() => setWeekStart((w) => w + 7)} aria-label="Semana siguiente" className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-xs transition-all hover:bg-slate-50 hover:border-slate-300"><IconChevron className="h-4 w-4" /></button>
                </div>

                <div className="mt-2 sm:mt-4 flex flex-wrap items-center justify-between gap-2">
                  <button onClick={() => { setWeekStart(0); setSelDate(today); }} className="text-xs font-bold text-emerald-700 underline-offset-4 hover:underline">
                    ← Ir a hoy
                  </button>

                  <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100 p-0.5 sm:p-1 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setAgendaView("day")}
                      className={`rounded-lg px-2.5 sm:px-3 py-1 sm:py-1.5 transition-all ${
                        agendaView === "day"
                          ? "bg-white text-slate-900 shadow-xs font-extrabold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Día
                    </button>
                    <button
                      type="button"
                      onClick={() => setAgendaView("week")}
                      className={`rounded-lg px-2.5 sm:px-3 py-1 sm:py-1.5 transition-all ${
                        agendaView === "week"
                          ? "bg-white text-slate-900 shadow-xs font-extrabold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Semana
                    </button>
                  </div>
                </div>

                {agendaView === "week" ? (
                  <div className="mt-4 sm:mt-6">
                    <AgendaWeek
                      dates={week.map((d) => dateKey(d))}
                      records={data.bookings}
                      services={data.services}
                      professionals={data.professionals}
                      todayKey={today}
                      onDay={(k) => {
                        setSelDate(k);
                        setAgendaView("day");
                      }}
                      onSlotClick={(date, time) => {
                        setPrefill({ date, time, proId: proFilter !== "todos" ? proFilter : undefined });
                        setShowNew(true);
                      }}
                      onOpen={(b) => setRescheduling(b)}
                    />
                  </div>
                ) : (
                  <>
                    {data.professionals.length > 0 && (
                      <div className="mt-2.5 sm:mt-6 flex flex-wrap gap-1.5">
                        <button onClick={() => setProFilter("todos")} className={`rounded-full border px-3.5 py-1 text-xs font-semibold transition-all ${proFilter === "todos" ? "border-slate-900 bg-slate-900 text-white shadow-xs" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"}`}>Todos</button>
                        {data.professionals.map((p) => (
                          <button key={p.id} onClick={() => setProFilter(p.id)} className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs font-semibold transition-all ${proFilter === p.id ? "border-slate-900 bg-slate-900 text-white shadow-xs" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"}`}>
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color || "#10b981" }} />
                            {p.name}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 sm:mt-6 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="font-display text-base sm:text-xl font-extrabold text-slate-900 capitalize">
                          {fmtDateNatural(selDate)}
                        </h3>
                        <p className="text-xs font-semibold text-slate-500 mt-0.5">
                          {dayBookings.length === 0 ? "Sin turnos agendados todavía" : `${dayBookings.length} reserva${dayBookings.length === 1 ? "" : "s"}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPrefill({ date: selDate, proId: proFilter !== "todos" ? proFilter : undefined });
                          setShowNew(true);
                        }}
                        className="btn-press inline-flex items-center gap-1.5 rounded-full bg-[#245442] hover:bg-[#1C4335] text-white px-3.5 py-1.5 text-xs font-bold shadow-xs"
                      >
                        <IconPlus className="h-3.5 w-3.5 text-white" /> Nuevo turno
                      </button>
                    </div>

                    {/* Huecos libres interactivos para crear turno con 1 toque */}
                    {freeSlots.length > 0 && (
                      <details className="mt-2 sm:mt-3 rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-1.5 text-xs">
                        <summary className="cursor-pointer font-bold text-slate-600 flex items-center justify-between select-none py-0.5">
                          <span className="flex items-center gap-1.5">
                            <IconClock className="h-3.5 w-3.5 text-emerald-600" />
                            <span>{freeSlots.length} hueco{freeSlots.length === 1 ? "" : "s"} libre{freeSlots.length === 1 ? "" : "s"} hoy</span>
                          </span>
                          <span className="text-[11px] font-semibold text-emerald-700 underline">Tocar para agendar +</span>
                        </summary>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200/60">
                          {freeSlots.slice(0, 8).map((slotTime) => (
                            <button
                              key={slotTime}
                              type="button"
                              onClick={() => {
                                setPrefill({
                                  date: selDate,
                                  time: slotTime,
                                  proId: proFilter !== "todos" ? proFilter : undefined,
                                });
                                setShowNew(true);
                              }}
                              className="agenda-free-slot"
                              title="Tocar para agendar turno en este horario"
                            >
                              <IconPlus className="h-3 w-3" />
                              <span>{slotTime} hs</span>
                            </button>
                          ))}
                          {freeSlots.length > 8 && (
                            <button
                              type="button"
                              onClick={() => {
                                setPrefill({
                                  date: selDate,
                                  time: freeSlots[8],
                                  proId: proFilter !== "todos" ? proFilter : undefined,
                                });
                                setShowNew(true);
                              }}
                              className="text-xs font-bold text-emerald-700 hover:underline px-1.5"
                            >
                              +{freeSlots.length - 8} más
                            </button>
                          )}
                        </div>
                      </details>
                    )}

                    {dayBookings.length === 0 ? (
                      <EmptyState
                        text="Nadie reservó este día… todavía."
                        sub="Creá una reserva manual o compartí tu enlace para que lleguen solas."
                        action={
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setPrefill({ date: selDate, proId: proFilter !== "todos" ? proFilter : undefined });
                                setShowNew(true);
                              }}
                              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 font-display text-sm font-bold text-white shadow-sm hover:bg-emerald-700 transition-all hover:-translate-y-0.5"
                            >
                              <IconPlus className="h-4 w-4" /> Crear turno
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowShareModal(true)}
                              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 font-display text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50 transition-all hover:-translate-y-0.5"
                            >
                              <Share2 className="h-4 w-4 text-emerald-600" /> Compartir enlace
                            </button>
                          </div>
                        }
                      />
                    ) : (
                      <div className="mt-4 space-y-3">
                        {dayBookings.map((b) => (
                          <BookingRow key={b.id} b={b} service={serviceOf(b.serviceId)} pro={data.professionals.find((p) => p.id === b.proId)} products={data.products} businessName={user.business}
                            onStatus={(id, s) => {
                              setStatus(id, s);
                              if (s === "atendida") {
                                const r = requestReview(id);
                                toast(r === "sent" ? "Turno atendido · link de reseña enviado por email" : "Turno atendido · sin email del cliente: pedile la reseña por WhatsApp", r === "sent" ? "ok" : "warn");
                              }
                              else if (s === "ausente") { toast("Marcado como no vino. Cuenta en tu tasa de ausencias.", "warn"); }
                              else toast(s === "cancelada" ? "Turno cancelado. El hueco quedó libre." : "Turno confirmado.");
                            }}
                            onDelete={handleDeleteBookingWithUndo}
                            onVerify={(id) => { store.markDepositPaid(id, "transferencia"); sound.playSuccess(); toast("Seña acreditada ✓"); }}
                            onReject={(id) => { store.rejectDeposit(id); toast("Comprobante rechazado. El cliente puede reenviarlo.", "warn"); }}
                            onReschedule={(b) => setRescheduling(b)}
                            onOpenDetail={(b) => setDetailBooking(b)}
                          />
                        ))}
                      </div>
                    )}

                    {data.waitlist.length > 0 && (
                      <button onClick={() => setView("lista")} className="mt-6 flex w-full items-center justify-between gap-3 rounded-xl border-2 border-coral/30 bg-coral/5 px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-coral/60">
                        <span className="flex items-center gap-2.5">
                          <IconUsers className="h-5 w-5 text-coral" />
                          <span>
                            <span className="block font-display text-sm font-bold text-ink">{data.waitlist.length} cliente{data.waitlist.length === 1 ? "" : "s"} en lista de espera</span>
                            <span className="block text-xs text-inkmute">Tocá para ofrecerles un hueco.</span>
                          </span>
                        </span>
                        <IconChevron className="h-4 w-4 text-coral" />
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ============ RESERVAS ============ */}
            {/* ============ RESERVAS ============ */}
            {view === "reservas" && (
              <div className="pop-in mt-8 space-y-6">
                {/* Barra de herramientas operativa */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.06] pb-4">
                  <div className="hidden sm:flex items-center gap-2">
                    <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1 shadow-xs">
                      <button
                        type="button"
                        onClick={() => setReservasMode("lista")}
                        className={`inline-flex items-center rounded-lg px-3 py-1.5 font-display text-xs font-bold transition-all ${
                          reservasMode === "lista"
                            ? "bg-slate-900 text-white shadow-xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <List size={13} className="mr-1.5" /> Lista
                      </button>
                      <button
                        type="button"
                        onClick={() => setReservasMode("grilla")}
                        className={`inline-flex items-center rounded-lg px-3 py-1.5 font-display text-xs font-bold transition-all ${
                          reservasMode === "grilla"
                            ? "bg-slate-900 text-white shadow-xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <Calendar size={13} className="mr-1.5" /> Grilla Horaria
                      </button>
                    </div>
                  </div>

                  <div className="hidden sm:flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setBlockPrefillTime(undefined);
                        setShowBlockModal(true);
                      }}
                      className="btn-press flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-display text-xs font-bold text-slate-700 hover:border-coral hover:text-coral transition-colors shadow-xs"
                    >
                      <Ban size={13} /> Bloquear horario
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        exportBookingsToCSV(
                          data.bookings,
                          data.services,
                          data.professionals,
                          `reservas-${user.slug}-${dateKey(new Date())}`
                        );
                        toast("Archivo Excel (.csv) descargado ✓");
                      }}
                      className="btn-press flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-display text-xs font-bold text-slate-700 hover:border-emerald-600 hover:text-emerald-700 transition-colors shadow-xs"
                      title="Exportar todas las reservas con formato compatible con Excel"
                    >
                      <Download size={13} /> Exportar Excel (.csv)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPrefill(null);
                        setShowNew(true);
                      }}
                      className="btn-press flex items-center gap-1.5 rounded-xl bg-black px-3.5 py-1.5 font-display text-xs font-bold text-white shadow-xs hover:bg-neutral-800"
                    >
                      <IconPlus className="h-3.5 w-3.5" /> + Reserva
                    </button>
                  </div>
                </div>

                {reservasMode === "grilla" ? (
                  <div>
                    {/* Selector de fecha para Grilla Horaria */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Día:</span>
                        <input
                          type="date"
                          className="field !w-auto !py-1.5 !text-xs font-semibold"
                          value={gridDate}
                          onChange={(e) => setGridDate(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setGridDate(today)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-bold ${gridDate === today ? "bg-slate-900 text-white font-bold" : "bg-slate-100 text-slate-600 hover:text-slate-900"}`}
                        >
                          Hoy
                        </button>
                        <button
                          type="button"
                          onClick={() => setGridDate(dateKey(addDays(new Date(), 1)))}
                          className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-slate-900"
                        >
                          Mañana
                        </button>
                      </div>
                      <p className="font-display text-sm font-bold text-ink">{fmtLong(gridDate)}</p>
                    </div>

                    <div className="mt-4">
                      <AgendaWeek
                        dates={[gridDate]}
                        records={data.bookings}
                        services={data.services}
                        professionals={data.professionals}
                        todayKey={today}
                        onDay={(d) => setGridDate(d)}
                        onOpen={(b) => setDetailBooking(b)}
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Mobile minimal toolbar */}
                    <div className="space-y-3 sm:hidden mb-4">
                      <div className="relative w-full">
                        <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6E6E73]" />
                        <input
                          className="field !py-2 !pl-9 !pr-7 !text-xs !rounded-full !bg-white !border-black/10 w-full"
                          placeholder="Buscar por cliente o teléfono..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#6E6E73] hover:text-[#1D1D1F]"
                            title="Borrar búsqueda"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <div className="flex rounded-xl bg-[#F5F5F7] p-1 text-xs font-bold text-[#6E6E73]">
                        {(["todas", "pendiente", "confirmada"] as const).map((f) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setFilter(f)}
                            className={`flex-1 rounded-lg py-1.5 transition-all text-center ${
                              filter === f ? "bg-white text-[#1D1D1F] shadow-xs font-extrabold" : "hover:text-[#1D1D1F]"
                            }`}
                          >
                            {f === "todas" ? "Todas" : f === "pendiente" ? "Pendientes" : "Confirmadas"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Desktop filters toolbar */}
                    <div className="hidden sm:flex flex-row gap-3 items-center justify-between">
                      <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
                        {(["todas", "pendiente", "confirmada", "atendida", "cancelada"] as const).map((f) => {
                          const count = f === "todas" ? data.bookings.length : data.bookings.filter((b) => b.status === f).length;
                          return (
                            <button
                              key={f}
                              onClick={() => setFilter(f)}
                              className={`btn-press whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all ${filter === f ? "border-black bg-black text-white shadow-xs" : "border-black/10 bg-white text-[#6E6E73] hover:border-black/30 hover:text-[#1D1D1F]"}`}
                            >
                              {f === "todas" ? "Todas" : STATUS[f].label} ({count})
                            </button>
                          );
                        })}
                      </div>

                      <div className="relative min-w-[220px]">
                        <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-inkmute" />
                        <input
                          className="field !py-2 !pl-9 !pr-7 !text-xs !rounded-full"
                          placeholder="Buscar por cliente o teléfono..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-inkmute hover:text-ink"
                            title="Borrar búsqueda"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {upcoming.length === 0 ? (
                      <EmptyState
                        text={searchQuery ? "No hay reservas que coincidan con la búsqueda." : "No hay reservas con ese filtro."}
                        sub={searchQuery ? "Probá con otro término o limpiá el buscador." : "Probá con otro estado o creá una nueva."}
                        action={
                          <button
                            onClick={() => {
                              setPrefill(null);
                              setShowNew(true);
                            }}
                            className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-2.5 font-display text-sm font-bold text-white shadow-sm hover:bg-neutral-800 transition-all hover:-translate-y-0.5"
                          >
                            <IconPlus className="h-4 w-4" /> Nueva reserva
                          </button>
                        }
                      />
                    ) : (
                      <div className="mt-6 space-y-6">
                        {Object.entries(upcoming.reduce<Record<string, Booking[]>>((acc, b) => { (acc[b.date] ||= []).push(b); return acc; }, {})).map(([d, list]) => (
                          <div key={d}>
                            <p className="font-display text-base font-bold text-ink">
                              {d === today ? "Hoy · " : ""}{fmtLong(d)}
                              <span className="ml-2 text-sm font-semibold text-inkmute">{list.length} reserva{list.length === 1 ? "" : "s"}</span>
                            </p>
                            <div className="mt-3 space-y-3">
                              {list.map((b) => (
                                <BookingRow
                                  key={b.id}
                                  b={b}
                                  service={serviceOf(b.serviceId)}
                                  pro={data.professionals.find((p) => p.id === b.proId)}
                                  products={data.products}
                                  businessName={user.business}
                                  onStatus={(id, s) => {
                                    setStatus(id, s);
                                    if (s === "atendida") {
                                      const r = requestReview(id);
                                      toast(r === "sent" ? "Turno atendido · link de reseña enviado por email" : "Turno atendido · sin email del cliente: pedile la reseña por WhatsApp", r === "sent" ? "ok" : "warn");
                                    } else if (s === "ausente") {
                                      toast("Marcado como no vino. Cuenta en tu tasa de ausencias.", "warn");
                                    } else toast("Estado actualizado.");
                                  }}
                                  onDelete={handleDeleteBookingWithUndo}
                                  onVerify={(id) => {
                                    store.markDepositPaid(id, "transferencia");
                                    sound.playSuccess();
                                    toast("Seña acreditada ✓");
                                  }}
                                  onReject={(id) => {
                                    store.rejectDeposit(id);
                                    toast("Comprobante rechazado.", "warn");
                                  }}
                                  onReschedule={(b) => setRescheduling(b)}
                                  onOpenDetail={(b) => setDetailBooking(b)}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ============ CLIENTES (CRM) ============ */}
            {view === "clientes" && (
              <>
                <ClientsCRMView
                  bookings={data.bookings}
                  services={data.services}
                  clientNotes={data.settings.clientNotes || {}}
                  onSaveNote={(phone, note) => {
                    saveClientNote(phone, note);
                    toast("Nota privada guardada ✓");
                  }}
                  businessName={user.business}
                  onOpenCustomer={(c) => setCrmCustomer(c)}
                />
                {crmCustomer && (
                  <CustomerHistoryModal
                    customer={crmCustomer}
                    records={data.bookings}
                    services={data.services}
                    professionals={data.professionals}
                    onClose={() => setCrmCustomer(null)}
                    onOpenBooking={(b) => {
                      setCrmCustomer(null);
                      setRescheduling(b);
                    }}
                    onNewBooking={() => {
                      const cust = crmCustomer;
                      setCrmCustomer(null);
                      setPrefill({ client: cust.name, phone: cust.phone });
                      setShowNew(true);
                    }}
                  />
                )}
              </>
            )}

            {/* ============ LISTA DE ESPERA ============ */}
            {view === "lista" && (
              <div className="pop-in mt-8">
                {data.waitlist.length === 0 ? (
                  <EmptyState text="No hay nadie en lista de espera." sub="Cuando un cliente no encuentre horario, se va a anotar acá y te aparece con el número en el menú." />
                ) : (
                  <div className="space-y-6">
                    {isPaid(user) && user.plan === "escala" ? (
                      <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 shadow-xs">
                        <span className="rounded-full bg-emerald-700 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">Prioridad inteligente</span>
                        <p className="text-xs font-semibold text-emerald-950">Tus clientes recurrentes aparecen primero. Exclusivo de tu plan Escala.</p>
                      </div>
                    ) : (
                      <button onClick={() => setCheckoutPlan("escala")} className="flex w-full items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white/70 px-4 py-3 text-left transition-all hover:border-emerald-600/50">
                        <Zap size={15} className="text-amber-500 shrink-0" />
                        <p className="text-xs text-slate-500"><strong className="text-slate-900">Tip:</strong> en el plan Escala la lista se ordena sola: recurrentes primero. <span className="font-bold text-emerald-700 underline underline-offset-2">Ver Escala</span></p>
                      </button>
                    )}
                    {Object.entries(sortWaitlist(data.waitlist, data.bookings, user.plan).sort((a, b) => a.date.localeCompare(b.date)).reduce<Record<string, typeof data.waitlist>>((acc, w) => { (acc[w.date] ||= []).push(w); return acc; }, {})).map(([d, list]) => (
                      <div key={d}>
                        <p className="font-display text-base font-bold text-ink">{fmtLong(d)}<span className="ml-2 text-sm font-semibold text-inkmute">{list.length} esperando</span></p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {list.map((w) => (
                            <div key={w.id} className="card card-hover flex items-center justify-between gap-3 p-4">
                              <div className="min-w-0">
                                <p className="flex flex-wrap items-center gap-1.5 font-display text-[15px] font-bold text-ink">
                                  {w.client}
                                  {user.plan === "escala" && isRecurrentClient(w, data.bookings) && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300/80 px-2.5 py-0.5 text-[10px] font-bold text-amber-900 shadow-xs">
                                      <Star size={10} className="fill-amber-600 text-amber-600" /> Recurrente
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs text-inkmute">{w.phone} · {serviceOf(w.serviceId)?.name ?? "Servicio"}</p>
                              </div>
                              <div className="flex shrink-0 gap-1.5">
                                <button onClick={() => { setPrefill({ client: w.client, phone: w.phone, serviceId: w.serviceId, waitlistId: w.id }); setShowNew(true); }}
                                  className="rounded-full bg-emerald-600 px-4 py-2 font-display text-xs font-bold text-white shadow-xs transition-all hover:-translate-y-0.5 hover:bg-emerald-700">Darle turno</button>
                                <button onClick={() => { store.removeWaitlist(w.id); toast("Quitado de la lista.", "warn"); }} aria-label="Quitar"
                                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:border-coral hover:text-coral"><IconTrash className="h-3.5 w-3.5" /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ============ STATS ============ */}
            {view === "stats" && <StatsView db={data} />}

            {/* ============ SERVICIOS ============ */}
            {view === "servicios" && (
              <div className="pop-in mt-8">
                <div className="grid gap-4 sm:grid-cols-2">
                  {data.services.map((s) => (
                    <div key={s.id} className="group card card-hover p-6">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-display text-xl font-extrabold text-ink">{s.name}</h3>
                        <ItemActionMenu
                          ariaLabel={`Opciones de ${s.name}`}
                          onEdit={() => setServiceModal({ open: true, id: s.id })}
                          onDelete={() => { store.removeService(s.id); toast(`"${s.name}" eliminado.`, "warn"); }}
                        />
                      </div>
                      <p className="mt-3 font-display text-3xl font-extrabold text-fern">{fmtMoney(s.price)}</p>
                      <p className="mt-1 text-sm text-inkmute">{s.duration} minutos · anticipo sugerido {fmtMoney(Math.round(s.price * 0.2))}</p>
                    </div>
                  ))}
                  <button onClick={() => setServiceModal({ open: true })} className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-ink/25 text-inkmute transition-all duration-200 hover:-translate-y-1 hover:border-evergreen hover:text-evergreen">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ink/8"><IconPlus className="h-5 w-5" /></span>
                    <span className="font-display text-base font-bold">Agregar servicio</span>
                  </button>
                </div>
                <p className="mt-5 text-sm text-inkmute">Estos son los servicios que ven tus clientes en <strong className="text-fern">cupito.app/{user.slug}</strong>. Los cambios se publican al instante.</p>
              </div>
            )}

            {/* ============ EQUIPO ============ */}
            {view === "equipo" && (
              <TeamView
                onSyncCalendar={(proId) => {
                  setCalendarProId(proId);
                  setShowCalendarModal(true);
                }}
              />
            )}

            {/* ============ TIENDA ============ */}
            {view === "tienda" && (
              <div className="pop-in mt-8">
                {!isPaid(user) ? (
                  <LockedFeature icon={<IconBag className="h-7 w-7" />} title="La tienda es parte del plan Crece"
                    desc="Ofrecé tus productos al reservar. El cliente elige lo que necesita y lo retira cuando visita el local."
                    onUpgrade={() => setCheckoutPlan("crece")} />
                ) : (
                  <ShopAdmin />
                )}
              </div>
            )}

            {/* ============ CUPONES ============ */}
            {view === "promos" && <PromosView slug={user.slug} />}

            {/* ============ MI PÁGINA ============ */}
            {view === "pagina" && (
              <div className="pop-in mt-8">
                <div className="mb-8 grid gap-3 sm:grid-cols-3">
                  <StatusPill on={isPaid(user) && data.settings.depositEnabled} label={isPaid(user) && data.settings.depositEnabled ? `Seña del ${data.settings.depositPct}%` : "Sin seña"} sub={isPaid(user) ? "al reservar" : "activá en Ajustes"} />
                  <StatusPill on={isPaid(user) && data.products.length > 0} label={isPaid(user) && data.products.length > 0 ? `${data.products.length} productos` : "Tienda vacía"} sub={isPaid(user) ? "en tu tienda" : "plan Crece"} />
                  <StatusPill on={data.settings.hours.some((h) => h.open)} label={`${data.settings.hours.filter((h) => h.open).length} días abiertos`} sub="por semana" />
                </div>
                <div className="rounded-[24px] border border-black/[0.06] bg-white p-6 sm:p-8 shadow-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#6E6E73]">Tu link de reservas</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[11px] font-bold text-[#16A34A]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A] animate-pulse" /> En línea
                    </span>
                  </div>
                  <p className="mt-4 break-all font-display text-2xl font-bold text-[#1D1D1F] sm:text-3xl">cupito.app/{user.slug}</p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      onClick={() => { const url = `https://cupito.app/${user.slug}`; navigator.clipboard?.writeText(url).then(() => toast("Link copiado"), () => toast(url, "warn")); }}
                      className="rounded-full bg-black px-6 py-2.5 font-display text-sm font-bold text-white shadow-sm hover:bg-neutral-800 transition-all active:scale-95"
                    >
                      Copiar enlace
                    </button>
                    <button
                      onClick={() => setShowShareModal(true)}
                      className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-[#F5F5F7] px-5 py-2.5 font-display text-sm font-bold text-[#1D1D1F] transition-all hover:bg-neutral-200"
                    >
                      <IconWhatsApp className="h-4 w-4 text-[#16A34A]" /> Compartir por WhatsApp
                    </button>
                    <a
                      href={`/${user.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-5 py-2.5 font-display text-sm font-bold text-[#1D1D1F] transition-all hover:bg-[#F5F5F7]"
                    >
                      Abrir mi página <ArrowUpRight size={14} />
                    </a>
                  </div>
                </div>

                <div className="mt-6 rounded-[24px] border border-black/[0.06] bg-white p-6 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setShowPreviewAccordion(!showPreviewAccordion)}
                    className="flex w-full items-center justify-between text-left"
                    aria-expanded={showPreviewAccordion}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F5F5F7] text-[#16A34A]">
                        <IconSpark className="h-5 w-5" />
                      </span>
                      <div>
                        <h3 className="font-display text-base font-bold text-[#1D1D1F]">Vista previa en vivo y código QR</h3>
                        <p className="text-xs text-[#6E6E73]">Probá tu formulario tal como lo ven tus clientes o descargá el código QR.</p>
                      </div>
                    </div>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F5F5F7] text-[#6E6E73]">
                      <IconChevron className={`h-4 w-4 transition-transform duration-200 ${showPreviewAccordion ? "rotate-180" : ""}`} />
                    </span>
                  </button>

                  {showPreviewAccordion && (
                    <div className="mt-6 pt-6 border-t border-black/[0.06] grid gap-8 lg:grid-cols-[1fr_1.1fr]">
                      <div>
                        <p className="font-display text-base font-bold text-[#1D1D1F]">QR para tu mostrador</p>
                        <p className="mt-1 text-sm text-[#6E6E73]">Imprimilo en hoja A4: los clientes que esperan en el local reservan solos.</p>
                        <div className="mt-4"><QrBlock url={`https://cupito.app/${user.slug}`} onPrint={() => setShowPrintModal(true)} /></div>
                      </div>
                      <div className="flex flex-col items-center">
                        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#6E6E73] self-start">
                          Así lo ven tus clientes
                        </p>
                        <div className="w-full max-w-[440px] rounded-2xl border border-black/10 overflow-hidden shadow-md">
                          <PublicBooking isPreview={true} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ============ SUSCRIPCIÓN ============ */}
            {view === "suscripcion" && (
              <SubscriptionView current={user.plan} user={user} onSelect={(p) => setCheckoutPlan(p)} />
            )}

            {/* ============ AJUSTES ============ */}
            {view === "ajustes" && (
              <SettingsView initialTab={settingsTab} onTabChange={setSettingsTab} user={user} settings={data.settings} onSaveProfile={(b, n) => { saveProfile(b, n); toast("Perfil actualizado ✓"); }} onSelectPlan={(p) => setCheckoutPlan(p)} />
            )}
          </main>

          {/* Mobile Floating Action Button (FAB) 56px */}
          <button
            type="button"
            onClick={() => {
              setPrefill(null);
              setShowNew(true);
            }}
            className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-black text-white shadow-lg shadow-black/20 hover:scale-105 active:scale-95 transition-all lg:hidden"
            aria-label="Crear nuevo turno"
          >
            <IconPlus className="h-6 w-6 text-white" />
          </button>
        </div>
      </div>

      {showNew && (
        <BookingModal
          initialDate={prefill?.date || selDate}
          initialClient={prefill?.client}
          initialPhone={prefill?.phone}
          initialServiceId={prefill?.serviceId}
          initialTime={prefill?.time}
          initialProId={prefill?.proId}
          waitlistId={prefill?.waitlistId}
          onClose={() => { setShowNew(false); setPrefill(null); }}
          onCreated={(info) => setNotifyWl(info)}
        />
      )}
      {showInstallModal && (
        <InstallAppModal
          onClose={() => setShowInstallModal(false)}
          onPrompt={promptInstall}
          hasDeferred={Boolean(deferredPrompt)}
        />
      )}
      {showCalendarModal && (
        <CalendarSyncModal
          user={user}
          professionals={data.professionals}
          initialProId={calendarProId || undefined}
          onClose={() => {
            setShowCalendarModal(false);
            setCalendarProId(null);
          }}
        />
      )}
      {notifyWl && <WaitlistNotifyModal info={notifyWl} businessName={user.business} onClose={() => setNotifyWl(null)} />}
      {serviceModal.open && <ServiceModal service={serviceModal.id ? data.services.find((s) => s.id === serviceModal.id) : undefined} onClose={() => setServiceModal({ open: false })} />}
      {searchOpen && <WorkspaceSearch
        items={[...SECTIONS.flatMap(section => section.items.map(item => ({ id: item.id, label: item.label, group: section.label }))), { id: "settings:horarios", label: "Horarios de atención", group: "Ajustes" }, { id: "settings:pagos", label: "Datos de cobro y señas", group: "Ajustes" }]}
        onSelect={id => { if (id.startsWith("settings:")) { setSettingsTab(id.slice(9) as SettingsTab); setView("ajustes"); } else setView(id as View); }}
        onNew={() => { setPrefill(null); setShowNew(true); }}
        onClose={() => setSearchOpen(false)}
      />}
      {checkoutPlan && <PlanCheckout plan={checkoutPlan} onClose={() => {
        setCheckoutPlan(null);
        // El onboarding que habíamos diferido aparece recién ahora.
        if (pendingOnboarding) {
          setPendingOnboarding(false);
          setShowOnboarding(true);
        }
      }} />}
      {showOnboarding && <OnboardingModal onClose={() => setShowOnboarding(false)} onGoToPlan={(p) => { setShowOnboarding(false); setCheckoutPlan(p); }} />}
      {rescheduling && (
        <RescheduleModal
          b={rescheduling}
          service={serviceOf(rescheduling.serviceId)}
          professionals={data.professionals}
          businessName={user.business}
          onClose={() => setRescheduling(null)}
          onSave={(newDate, newTime, newProId) => {
            const res = rescheduleBooking(rescheduling.id, newDate, newTime, newProId);
            if (!res.ok) {
              toast(res.error || "No se pudo reprogramar el turno.", "warn");
            } else {
              toast(`Turno de ${rescheduling.client} reprogramado para el ${fmtLong(newDate)} a las ${newTime} hs`);
              setRescheduling(null);
            }
          }}
        />
      )}
      {detailBooking && (
        <BookingDetailModal
          b={detailBooking}
          service={serviceOf(detailBooking.serviceId)}
          allServices={data.services}
          pro={data.professionals.find((p) => p.id === detailBooking.proId)}
          products={data.products}
          businessName={user.business}
          businessAddress={data.settings.address}
          onClose={() => setDetailBooking(null)}
          onStatus={(id, s) => {
            const prevStatus = detailBooking.status;
            setStatus(id, s);
            if (s === "atendida") {
              const r = requestReview(id);
              toast(
                r === "sent"
                  ? "Turno atendido · link de reseña enviado por email"
                  : "Turno atendido · sin email del cliente: pedile la reseña por WhatsApp",
                r === "sent" ? "ok" : "warn",
                { label: "Deshacer", onClick: () => setStatus(id, prevStatus) },
                7000
              );
            } else if (s === "ausente") {
              toast("Marcado como no vino. Cuenta en tu tasa de ausencias.", "warn", { label: "Deshacer", onClick: () => setStatus(id, prevStatus) }, 7000);
            } else if (s === "cancelada") {
              toast("Turno cancelado. El hueco quedó libre.", "ok", { label: "Deshacer", onClick: () => setStatus(id, prevStatus) }, 7000);
            } else {
              toast("Turno confirmado.", "ok", { label: "Deshacer", onClick: () => setStatus(id, prevStatus) }, 7000);
            }
            setDetailBooking((prev) => (prev && prev.id === id ? { ...prev, status: s } : prev));
          }}
          onDelete={(id) => {
            const target = data.bookings.find((x) => x.id === id);
            removeBooking(id);
            setDetailBooking(null);
            toast("Reserva eliminada.", "warn", target ? { label: "Deshacer", onClick: () => store.restoreBooking(target) } : undefined, 7000);
          }}
          onVerify={(id) => {
            store.markDepositPaid(id, "transferencia");
            sound.playSuccess();
            toast("Seña acreditada ✓");
            setDetailBooking((prev) => (prev && prev.id === id ? { ...prev, paidDeposit: true } : prev));
          }}
          onReject={(id) => {
            store.rejectDeposit(id);
            toast("Comprobante rechazado. El cliente puede reenviarlo.", "warn");
            setDetailBooking((prev) => (prev && prev.id === id ? { ...prev, depositClaim: undefined } : prev));
          }}
          onReschedule={(b) => {
            setRescheduling(b);
            setDetailBooking(null);
          }}
          onPay={(id, method, amount) => {
            store.markBookingPaid(id, method, amount);
            toast("Cobro registrado ✓");
            setDetailBooking((prev) => (prev && prev.id === id ? { ...prev, paymentStatus: "total_pagado", paidAmount: amount } : prev));
          }}
        />
      )}
      {showBlockModal && (
        <BlockModal
          date={gridDate}
          time={blockPrefillTime}
          pros={data.professionals}
          onSave={(slot) => {
            addBlockedSlot(slot);
            toast("Horario bloqueado ✓");
          }}
          onClose={() => setShowBlockModal(false)}
        />
      )}
      {showShareModal && (
        <ShareTemplatesModal
          business={user.business}
          slug={user.slug}
          onClose={() => setShowShareModal(false)}
        />
      )}
      {showPrintModal && (
        <PrintPosterModal
          business={user.business}
          slug={user.slug}
          onClose={() => setShowPrintModal(false)}
        />
      )}

    </div>
  );
}

/* ================= subcomponentes ================= */

function StatCard({
  label,
  value,
  icon,
  accent = false,
  badge,
  trend,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  accent?: boolean;
  badge?: string;
  trend?: string;
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border p-5 transition-all duration-200 ${
        accent
          ? "border-emerald-200/80 bg-gradient-to-br from-emerald-50/50 via-white to-white shadow-xs hover:shadow-md hover:border-emerald-300"
          : "border-slate-200/80 bg-white shadow-xs hover:shadow-md hover:border-slate-300"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          {label}
        </span>
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
            accent
              ? "bg-emerald-600 text-white shadow-xs shadow-emerald-600/20"
              : "bg-slate-100 text-slate-700 group-hover:bg-slate-200/80"
          }`}
        >
          {icon}
        </span>
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <span className="font-display text-3xl font-extrabold tracking-tight text-slate-900">
          {value}
        </span>
        {badge && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide ${
              accent
                ? "bg-emerald-100 text-emerald-800"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {badge}
          </span>
        )}
      </div>

      <div className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-500">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
        <span>{trend || "Actualizado en tiempo real"}</span>
      </div>
    </div>
  );
}



/* ============ ASISTENTE DE INICIO (ONBOARDING) ============ */
function OnboardingModal({ onClose, onGoToPlan }: { onClose: () => void; onGoToPlan: (p: Plan) => void }) {
  const { user, data, addService, updateSettings, toast } = useStore();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  
  // Paso 0: Horarios
  const [hours, setHours] = useState<DayHours[]>(data?.settings.hours || defaultHours());
  
  // Paso 1: Primer Servicio
  const [serviceName, setServiceName] = useState("");
  const [servicePrice, setServicePrice] = useState("10000");
  const [serviceDuration, setServiceDuration] = useState("45");
  
  // Paso 2: Link y Contacto
  const [whatsapp, setWhatsapp] = useState(data?.settings.whatsapp || "");
  const [address, setAddress] = useState(data?.settings.address || "");
  const [copied, setCopied] = useState(false);

  if (!user || !data) return null;

  const publicUrl = `${window.location.origin}/${user.slug}`;

  const saveHoursAndNext = () => {
    updateSettings({ hours });
    setStep(1);
  };

  const saveServiceAndNext = () => {
    if (serviceName.trim()) {
      addService({
        name: serviceName.trim(),
        price: Number(servicePrice) || 0,
        duration: Number(serviceDuration) || 45,
      });
      toast("¡Primer servicio guardado! ✓");
    }
    setStep(2);
  };

  const finishOnboarding = () => {
    updateSettings({
      whatsapp: whatsapp.replace(/\D/g, ""),
      address: address.trim(),
      setupDismissed: true,
    });
    toast("¡Felicitaciones! Tu agenda ya está lista para recibir reservas");
    onClose();
  };

  const copyLink = () => {
    void navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast("Link copiado al portapapeles");
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-ink/65 p-4 backdrop-blur-[3px]" onClick={onClose}>
      <div className="pop-in max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[24px] border-2 border-ink/15 bg-card p-6 text-ink shadow-block sm:p-8" onClick={(e) => e.stopPropagation()}>
        {/* Header con pasos */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-lime/25 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-evergreen">
              Configuración inicial · Paso {step + 1} de 3
            </span>
            <h2 className="mt-2 font-display text-2xl font-extrabold text-ink sm:text-3xl">
              {step === 0 && "Días y horarios de atención"}
              {step === 1 && "Cargá tu primer servicio"}
              {step === 2 && "Tu link público y contacto"}
            </h2>
            <p className="mt-1 text-xs text-inkmute sm:text-sm">
              {step === 0 && "Tus clientes solo podrán reservar turnos dentro de estos días y horarios."}
              {step === 1 && "Definí qué ofrecés, cuánto cobrás y cuánto dura cada turno."}
              {step === 2 && "Este es el link que podés poner en tu Instagram, WhatsApp o bio."}
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ink/15 text-inkmute transition-colors hover:border-coral hover:text-coral">✕</button>
        </div>

        {/* Barra de progreso */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          {["Horarios", "Servicios", "Tu Link"].map((label, idx) => (
            <div key={label} className="space-y-1">
              <div className={`h-1.5 rounded-full transition-all ${idx <= step ? "bg-evergreen" : "bg-ink/10"}`} />
              <p className={`text-[10px] font-bold uppercase tracking-wider ${idx === step ? "text-evergreen" : "text-inkmute"}`}>{label}</p>
            </div>
          ))}
        </div>

        {/* Paso 0: Horarios */}
        {step === 0 && (
          <div className="pop-in mt-6 space-y-4">
            <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
              {[1, 2, 3, 4, 5, 6, 0].map((dayIdx) => {
                const h = hours[dayIdx];
                return (
                  <div key={dayIdx} className={`flex flex-col gap-2.5 rounded-2xl border-2 p-3 transition-all sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:p-3.5 ${h.open ? "border-fern/40 bg-white shadow-sm" : "border-ink/8 bg-ink/[0.03] opacity-70"}`}>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Toggle
                        on={h.open}
                        onChange={(v) => {
                          const next = [...hours];
                          next[dayIdx] = { ...next[dayIdx], open: v };
                          setHours(next);
                        }}
                        label={`Abrir ${DAY_NAMES[dayIdx]}`}
                      />
                      <span className={`truncate font-display text-sm font-bold sm:text-[15px] ${h.open ? "text-ink" : "text-inkmute"}`}>
                        {DAY_NAMES[dayIdx]}
                      </span>
                    </div>
                    {h.open ? (
                      <div className="flex items-center gap-1.5 text-xs">
                        <input
                          type="time"
                          className="field !h-10 min-w-0 flex-1 !px-1.5 !py-1 !text-[13px] font-bold sm:!h-11 sm:flex-none sm:!px-2 sm:!text-sm"
                          value={h.from}
                          onChange={(e) => {
                            const next = [...hours];
                            next[dayIdx] = { ...next[dayIdx], from: e.target.value };
                            setHours(next);
                          }}
                        />
                        <span className="shrink-0 font-bold text-inkmute">a</span>
                        <input
                          type="time"
                          className="field !h-10 min-w-0 flex-1 !px-1.5 !py-1 !text-[13px] font-bold sm:!h-11 sm:flex-none sm:!px-2 sm:!text-sm"
                          value={h.to}
                          onChange={(e) => {
                            const next = [...hours];
                            next[dayIdx] = { ...next[dayIdx], to: e.target.value };
                            setHours(next);
                          }}
                        />
                      </div>
                    ) : (
                      <span className="w-fit rounded-full bg-ink/8 px-3 py-1 text-xs font-bold text-inkmute">Cerrado</span>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={saveHoursAndNext}
              className="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-700 py-4 font-display text-base font-bold text-white transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] shadow-md shadow-emerald-900/20"
            >
              Guardar horarios y continuar <IconArrow className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Paso 1: Primer Servicio */}
        {step === 1 && (
          <div className="pop-in mt-6 space-y-4">
            <div className="rounded-2xl border-2 border-ink/10 bg-white/60 p-4">
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Nombre del servicio</label>
              <input
                className="field"
                placeholder="Ej: Corte clásico, Manicura semi, Consulta..."
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border-2 border-ink/10 bg-white/60 p-4">
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Precio (ARS)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-inkmute">$</span>
                  <input
                    type="number"
                    className="field !pl-8 font-display font-bold"
                    placeholder="10000"
                    value={servicePrice}
                    onChange={(e) => setServicePrice(e.target.value)}
                  />
                </div>
              </div>
              <div className="rounded-2xl border-2 border-ink/10 bg-white/60 p-4">
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Duración</label>
                <CustomSelect
                  value={serviceDuration}
                  onChange={(val) => setServiceDuration(val)}
                  options={[
                    { value: "15", label: "15 minutos" },
                    { value: "30", label: "30 minutos" },
                    { value: "45", label: "45 minutos" },
                    { value: "60", label: "60 minutos (1 h)" },
                    { value: "90", label: "90 minutos (1.5 h)" },
                    { value: "120", label: "120 minutos (2 h)" },
                  ]}
                  placeholder="Seleccionar duración"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={saveServiceAndNext}
                disabled={!serviceName.trim()}
                className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-700 py-4 font-display text-base font-bold text-white transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-50 shadow-md shadow-emerald-900/20"
              >
                {serviceName.trim() ? "Guardar servicio y continuar" : "Ingresá el nombre del servicio"} <IconArrow className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-center text-xs font-bold text-inkmute hover:text-ink"
              >
                Omitir por ahora (puedo crearlo después)
              </button>
            </div>
          </div>
        )}

        {/* Paso 2: Link público y contacto */}
        {step === 2 && (
          <div className="pop-in mt-6 space-y-5">
            <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-50/60 p-4">
              <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-950">Tu link de reservas online</p>
              <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-white p-2.5 border-2 border-ink/10">
                <span className="truncate text-xs font-bold text-ink font-mono sm:text-sm">{publicUrl}</span>
                <button
                  type="button"
                  onClick={copyLink}
                  className="shrink-0 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition-colors"
                >
                  {copied ? "¡Copiado! ✓" : "Copiar link"}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-inkmute">
                Pegá este link en tu biografía de Instagram o mandáselo a tus clientes por WhatsApp.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">WhatsApp del local</label>
                <input
                  className="field"
                  placeholder="Ej: 1155551234"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Dirección</label>
                <input
                  className="field"
                  placeholder="Ej: Av. Santa Fe 1234, CABA"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-2xl border-2 border-ink/10 bg-white/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-display text-sm font-bold text-ink">Plan actual: <span className="text-fern">{PLAN_META[user.plan].name}</span></p>
                  <p className="text-xs text-inkmute">{user.plan === "semilla" ? "El plan pago se activa solo cuando completes el pago en Mercado Pago." : "¿Querés reservas ilimitadas y cobrar seña?"}</p>
                </div>
                {user.plan === "semilla" && (
                  <button
                    type="button"
                    onClick={() => onGoToPlan("crece")}
                    className="rounded-full bg-emerald-600 hover:bg-emerald-700 px-4 py-2 font-display text-xs font-bold text-white shadow-sm transition-colors"
                  >
                    Ver Plan Crece
                  </button>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={finishOnboarding}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-700 py-4 font-display text-base font-bold text-white transition-all hover:-translate-y-0.5 shadow-md shadow-emerald-900/20"
            >
              ¡Terminar y empezar a recibir turnos!
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ on, label, sub }: { on: boolean; label: string; sub: string }) {
  return (
    <div className={`card flex items-center gap-3 p-4 ${on ? "" : "opacity-70"}`}>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${on ? "bg-lime text-ink" : "bg-ink/8 text-ink/40"}`}>
        {on ? <IconCheck className="h-4 w-4" /> : <IconLock className="h-4 w-4" />}
      </span>
      <span>
        <span className="block font-display text-sm font-extrabold text-ink">{label}</span>
        <span className="block text-xs text-inkmute">{sub}</span>
      </span>
    </div>
  );
}

function googleCalUrl(opts: { title: string; date: string; time: string; dur: number; details: string }): string {
  const [y, m, d] = opts.date.split("-").map(Number);
  const [hh, mm] = (opts.time || "10:00").split(":").map(Number);
  const startMs = Date.UTC(y, m - 1, d, hh + 3, mm, 0);
  const endMs = startMs + Math.max(opts.dur, 15) * 60 * 1000;
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (ms: number) => {
    const dt = new Date(ms);
    return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}00Z`;
  };
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(opts.title)}&dates=${fmt(startMs)}/${fmt(endMs)}&details=${encodeURIComponent(opts.details)}`;
}

function downloadBookingCalendar(
  booking: { id: string; date: string; time: string; duration?: number; service: string; name: string; professional?: string; status?: string },
  business: { name: string; address?: string }
) {
  const escapeText = (t: string) => t.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
  const foldLine = (line: string) => {
    const encoder = new TextEncoder();
    let bytes = 0, output = "";
    for (const ch of line) {
      const size = encoder.encode(ch).length;
      if (bytes + size > 75) {
        output += "\r\n ";
        bytes = 1;
      }
      output += ch;
      bytes += size;
    }
    return output;
  };
  const [y, m, d] = booking.date.split("-").map(Number);
  const [hh, mm] = (booking.time || "10:00").split(":").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, hh + 3, mm, 0));
  const duration = booking.duration || 45;
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const now = new Date();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cupito//Agenda//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeText(booking.id)}@cupito.app`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(new Date(start.getTime() + duration * 60000))}`,
    `SUMMARY:${escapeText(booking.service + " · " + business.name)}`,
    `DESCRIPTION:${escapeText("Cliente: " + booking.name + "\nProfesional: " + (booking.professional || "") + "\nTurno reservado en Cupito.")}`,
    `LOCATION:${escapeText(business.address || "")}`,
    `STATUS:${booking.status === "cancelada" ? "CANCELLED" : booking.status === "pendiente" ? "TENTATIVE" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const icsContent = lines.map(foldLine).join("\r\n") + "\r\n";
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cupito-turno-${booking.date}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function BookingDetailModal({
  b,
  service,
  allServices = [],
  pro,
  products,
  businessName,
  businessAddress,
  onClose,
  onStatus,
  onDelete,
  onVerify,
  onReject,
  onReschedule,
  onPay,
}: {
  b: Booking;
  service?: Service;
  allServices?: Service[];
  pro?: { id: string; name: string; color: string };
  products: Product[];
  businessName?: string;
  businessAddress?: string;
  onClose: () => void;
  onStatus: (id: string, s: BookingStatus) => void;
  onDelete: (id: string) => void;
  onVerify: (id: string) => void;
  onReject: (id: string) => void;
  onReschedule: (b: Booking) => void;
  onPay?: (id: string, method: "efectivo" | "tarjeta" | "transferencia", amount?: number) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const claimPending = !!b.depositClaim && !b.paidDeposit && b.status !== "cancelada";
  const cancelled = b.status === "cancelada";

  const extraServicesList = (b.extraServiceIds || [])
    .map((id) => allServices.find((s) => s.id === id))
    .filter(Boolean) as Service[];
  const mainServicePrice = service?.price || 0;
  const extraServicesPrice = extraServicesList.reduce((acc, s) => acc + s.price, 0);
  const totalServicesPrice = mainServicePrice + extraServicesPrice;

  const productsTotal = (b.items || []).reduce((acc, it) => {
    const p = products.find((x) => x.id === it.productId);
    return acc + (p?.price || 0) * it.qty;
  }, 0);

  const totalAmount = totalServicesPrice + productsTotal;
  const isFullyPaid = b.paymentStatus === "total_pagado";
  const depositPaidAmount = b.paidDeposit ? Math.round(totalServicesPrice * 0.2) : 0;
  const paidSoFar = isFullyPaid ? totalAmount : (b.paidAmount || depositPaidAmount);
  const balancePending = isFullyPaid ? 0 : Math.max(0, totalAmount - paidSoFar);

  const statusConfig: Record<BookingStatus, { label: string; bg: string; text: string }> = {
    pendiente: { label: "Por confirmar", bg: "bg-amber-50 border-amber-200", text: "text-amber-800" },
    confirmada: { label: "Confirmada", bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-800" },
    atendida: { label: "Atendida", bg: "bg-slate-100 border-slate-200", text: "text-slate-700" },
    cancelada: { label: "Cancelada", bg: "bg-rose-50 border-rose-200", text: "text-rose-700" },
    ausente: { label: "No vino / Ausente", bg: "bg-orange-50 border-orange-200", text: "text-orange-800" },
  };
  const sc = statusConfig[b.status] || statusConfig.pendiente;

  const initials =
    b.client
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "CL";

  return (
    <div
      className="cupito-modal-overlay"
      onClick={onClose}
    >
      <div
        className="cupito-modal w-full max-w-lg p-5 sm:p-6 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile bottom-sheet drag handle */}
        <div className="mx-auto -mt-1 mb-3 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden" />
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 font-display text-base font-bold shadow-xs">
              {initials}
            </span>
            <div>
              <h3 className="font-display text-lg sm:text-xl font-extrabold text-slate-900 leading-tight">
                {b.client}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Turno del {fmtLong(b.date)} a las <strong>{b.time} hs</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Status bar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 border border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Estado:</span>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${sc.bg} ${sc.text}`}>
              {sc.label}
            </span>
          </div>
          <span className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
            {b.source === "online" ? "Reserva Online" : "Reserva Manual"}
          </span>
        </div>

        {/* Info grid */}
        <div className="mt-4 space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Servicio</span>
              <span className="block font-bold text-slate-900 mt-0.5">{service?.name || "Servicio"}</span>
              <span className="block text-xs font-medium text-emerald-700 mt-0.5">
                {service ? fmtMoney(service.price) : "-"} · {service?.duration ?? 30} min
              </span>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Profesional</span>
              {pro ? (
                <div className="flex items-center gap-1.5 mt-1 font-bold text-slate-900">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: pro.color || "#10b981" }} />
                  <span>{pro.name}</span>
                </div>
              ) : (
                <span className="block text-xs text-slate-500 mt-1">General</span>
              )}
            </div>
          </div>

          {b.notes && <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
            <p className="text-xs font-bold text-emerald-900">Aclaraciones del cliente</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{b.notes}</p>
          </div>}
          {/* Contact details */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-3 space-y-2">
            <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Contacto del cliente</span>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800">
                {b.phone ? formatArgentinaPhone(b.phone) : "Sin teléfono registrado"}
              </span>
              {b.phone && (
                <div className="flex items-center gap-2">
                  <a
                    href={`tel:${cleanPhoneDigits(b.phone)}`}
                    className="btn-press inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
                  >
                    <Phone size={12} /> Llamar
                  </a>
                  <a
                    href={createWhatsAppUrl(
                      b.phone,
                      `Hola ${b.client.split(" ")[0]}! Te escribimos de ${businessName || "nuestro negocio"} respecto a tu turno de ${
                        service?.name || "atención"
                      } el ${fmtLong(b.date)} a las ${b.time} hs.`
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-press inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-100 shadow-xs"
                  >
                    <IconWhatsApp className="h-3.5 w-3.5 text-emerald-600" /> WhatsApp
                  </a>
                </div>
              )}
            </div>
            {b.email && (
              <p className="text-xs text-slate-500">
                Email: <span className="font-medium text-slate-700">{b.email}</span>
              </p>
            )}
          </div>

          {/* Seña info */}
          {claimPending && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-900">Comprobante de seña por verificar</span>
                <span className="text-xs font-mono font-bold text-rose-700">TX: {b.depositClaim?.txId}</span>
              </div>
              <p className="text-xs text-rose-800">
                Revisá en tu banco o billetera si ingresó el pago. Si entró, hacé clic en Acreditar para confirmar la seña.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { onVerify(b.id); }}
                  className="btn-press rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
                >
                  ✓ Acreditar seña
                </button>
                <button
                  type="button"
                  onClick={() => { onReject(b.id); }}
                  className="btn-press rounded-full border border-rose-300 bg-white px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50"
                >
                  Rechazar comprobante
                </button>
              </div>
            </div>
          )}

          {/* Resumen de cobro y saldo */}
          <div className="rounded-2xl border border-slate-200/90 bg-slate-50/80 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Resumen de cobro
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  isFullyPaid
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : b.paidDeposit
                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                    : "bg-slate-200/70 text-slate-700"
                }`}
              >
                {isFullyPaid ? "Total cobrado ✓" : b.paidDeposit ? "Seña acreditada" : "Pago pendiente"}
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-slate-700">
              <div className="flex items-center justify-between">
                <span>{service?.name || "Servicio"}</span>
                <span className="font-semibold text-slate-900">{fmtMoney(mainServicePrice)}</span>
              </div>
              {extraServicesList.map((es) => (
                <div key={es.id} className="flex items-center justify-between text-slate-600 pl-2 border-l-2 border-slate-300">
                  <span>+ {es.name}</span>
                  <span className="font-semibold text-slate-900">{fmtMoney(es.price)}</span>
                </div>
              ))}
              {b.items && b.items.length > 0 && b.items.map((it) => {
                const p = products.find((x) => x.id === it.productId);
                return (
                  <div key={it.productId} className="flex items-center justify-between text-slate-600 pl-2 border-l-2 border-slate-300">
                    <span>+ {it.qty}× {p?.name ?? "Producto"}</span>
                    <span className="font-semibold text-slate-900">{p ? fmtMoney(p.price * it.qty) : "-"}</span>
                  </div>
                );
              })}

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-bold text-slate-900">
                <span>Total</span>
                <span>{fmtMoney(totalAmount)}</span>
              </div>

              {b.paidDeposit && (
                <div className="flex items-center justify-between text-emerald-700 font-medium">
                  <span>Seña acreditada</span>
                  <span>- {fmtMoney(depositPaidAmount)}</span>
                </div>
              )}

              <div className="pt-1 flex items-center justify-between text-sm font-extrabold text-slate-900">
                <span>Saldo pendiente</span>
                <span className={balancePending > 0 ? "text-emerald-800 font-black" : "text-slate-500"}>
                  {fmtMoney(balancePending)}
                </span>
              </div>
            </div>

            {!isFullyPaid && balancePending > 0 && onPay && (
              <div className="pt-2.5 border-t border-slate-200">
                <span className="block text-[11px] font-bold text-slate-600 mb-2">Registrar cobro:</span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => onPay(b.id, "efectivo", totalAmount)}
                    className="btn-press rounded-xl border border-slate-200 bg-white py-2 px-2 text-xs font-bold text-slate-800 hover:bg-slate-100 hover:border-slate-300 shadow-xs text-center"
                  >
                    Efectivo
                  </button>
                  <button
                    type="button"
                    onClick={() => onPay(b.id, "transferencia", totalAmount)}
                    className="btn-press rounded-xl border border-slate-200 bg-white py-2 px-2 text-xs font-bold text-slate-800 hover:bg-slate-100 hover:border-slate-300 shadow-xs text-center"
                  >
                    Transferencia
                  </button>
                  <button
                    type="button"
                    onClick={() => onPay(b.id, "tarjeta", totalAmount)}
                    className="btn-press rounded-xl border border-slate-200 bg-white py-2 px-2 text-xs font-bold text-slate-800 hover:bg-slate-100 hover:border-slate-300 shadow-xs text-center"
                  >
                    Tarjeta
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons: Calendar & Tools */}
        <div className="mt-5 border-t border-slate-100 pt-4 space-y-2">
          <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">Herramientas</span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => { onReschedule(b); onClose(); }}
              className="btn-press flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-slate-800 shadow-xs hover:bg-slate-50 hover:border-slate-300"
            >
              <IconCalendar className="h-4 w-4 text-emerald-600" />
              Reprogramar turno
            </button>
            <a
              href={googleCalUrl({
                title: `${service?.name || "Turno"} - ${b.client}`,
                date: b.date,
                time: b.time,
                dur: service?.duration ?? 45,
                details: `Cliente: ${b.client}\nTeléfono: ${b.phone || "Sin teléfono"}\nServicio: ${service?.name || "Turno"}\nNegocio: ${businessName || "Cupito"}`,
              })}
              target="_blank"
              rel="noreferrer"
              className="btn-press inline-flex items-center justify-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 py-2 px-3 text-xs font-bold text-sky-800 hover:bg-sky-100 shadow-xs"
            >
              Google Cal <ArrowUpRight size={13} />
            </a>
            <button
              type="button"
              onClick={() => {
                try {
                  downloadBookingCalendar(
                    {
                      id: b.id,
                      date: b.date,
                      time: b.time,
                      duration: service?.duration || 45,
                      service: service?.name || "Turno",
                      name: b.client,
                      professional: pro?.name,
                      status: b.status,
                    },
                    { name: businessName || "Cupito", address: businessAddress }
                  );
                } catch (err: any) {
                  console.error(err);
                }
              }}
              className="btn-press inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs"
              title="Descargar archivo .ics para Apple Calendar u Outlook"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              .ics
            </button>
          </div>
        </div>

        {/* Change status actions */}
        <div className="mt-4 border-t border-slate-100 pt-4 space-y-2">
          <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Cambiar estado</span>
          <div className="flex flex-wrap items-center gap-2">
            {b.status !== "confirmada" && !claimPending && (
              <button
                type="button"
                onClick={() => { onStatus(b.id, "confirmada"); }}
                className="btn-press rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800"
              >
                Confirmar turno
              </button>
            )}
            {b.status !== "atendida" && b.status !== "cancelada" && (
              <button
                type="button"
                onClick={() => { onStatus(b.id, "atendida"); }}
                className="btn-press rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
              >
                Marcar atendida ✓
              </button>
            )}
            {b.status === "confirmada" && (
              <button
                type="button"
                onClick={() => { onStatus(b.id, "ausente"); }}
                className="btn-press rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
              >
                No vino (ausente)
              </button>
            )}
            {(b.status === "atendida" || b.status === "cancelada" || b.status === "ausente") && (
              <button
                type="button"
                onClick={() => { onStatus(b.id, "pendiente"); }}
                className="btn-press rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Restaurar a pendiente
              </button>
            )}
            {!cancelled && (
              <button
                type="button"
                onClick={() => { onStatus(b.id, "cancelada"); }}
                className="btn-press rounded-xl border border-rose-200 bg-rose-50/60 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
              >
                Cancelar turno
              </button>
            )}
          </div>
        </div>

        {/* Delete confirmation */}
        <div className="mt-5 border-t border-slate-100 pt-3 flex items-center justify-between text-xs">
          {confirmDelete ? (
            <div className="flex items-center gap-2 w-full justify-between bg-rose-50 p-2.5 rounded-xl border border-rose-200">
              <span className="font-bold text-rose-900">¿Eliminar permanentemente?</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-lg px-2.5 py-1 text-slate-600 hover:bg-slate-200/60 font-semibold"
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => { onDelete(b.id); }}
                  className="rounded-lg bg-rose-600 px-3 py-1 font-bold text-white hover:bg-rose-700"
                >
                  Sí, eliminar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-slate-400 hover:text-rose-600 text-xs font-medium flex items-center gap-1 ml-auto"
            >
              <IconTrash className="h-3.5 w-3.5" /> Eliminar reserva de la agenda
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="cupito-modal-overlay fixed inset-0 z-[80] flex items-end justify-center bg-ink/60 backdrop-blur-[2px] sm:items-center" role="presentation" onClick={onClose}>
      <div className="cupito-modal pop-in w-full max-w-md rounded-[22px] border-2 border-ink/15 bg-card p-6 text-ink shadow-block sm:p-7" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-2xl font-extrabold">{title}</h3>
          <button onClick={onClose} aria-label="Cerrar" className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink/15 text-inkmute transition-colors hover:border-coral hover:text-coral">✕</button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

/* ============ MODAL: INSTALAR APP ============ */
function InstallAppModal({ onClose, onPrompt, hasDeferred }: { onClose: () => void; onPrompt: () => void; hasDeferred: boolean }) {
  const isIos = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent || "");

  return (
    <Modal title="Instalar Cupito" onClose={onClose}>
      <div className="space-y-4 text-ink">
        <p className="text-sm text-inkmute">
          Instalá el panel de control en la pantalla de inicio de tu celular para entrar en 1 toque y anotar turnos sin abrir el navegador.
        </p>

        {hasDeferred && (
          <button
            onClick={() => { onPrompt(); onClose(); }}
            className="btn-press flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 py-3.5 font-display text-sm font-bold text-white shadow-md transition-colors"
          >
            <Smartphone size={16} /> Instalar en este celular ahora
          </button>
        )}

        {isIos ? (
          <div className="rounded-2xl border-2 border-ink/10 bg-paper p-4 space-y-2.5">
            <p className="font-display text-xs font-extrabold uppercase tracking-wider text-fern">
              Pasos para iPhone (Safari):
            </p>
            <ol className="list-decimal pl-5 space-y-2 text-xs leading-relaxed font-semibold text-ink">
              <li>
                Tocá el botón <strong>Compartir</strong> en la barra inferior de Safari (el cuadradito con la flechita hacia arriba ⎋).
              </li>
              <li>
                Deslizá hacia abajo y seleccioná <strong>"Agregar a pantalla de inicio"</strong> (o "Añadir a pantalla de inicio" +).
              </li>
              <li>
                Tocá <strong>"Agregar"</strong> arriba a la derecha.
              </li>
            </ol>
            <p className="text-[11px] text-inkmute">
              ¡Listo! Te quedará el ícono oficial de Cupito en tu pantalla como una app nativa.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-ink/10 bg-paper p-4 space-y-2.5">
            <p className="font-display text-xs font-extrabold uppercase tracking-wider text-fern">
              Pasos para Android (Chrome / Brave):
            </p>
            <ol className="list-decimal pl-5 space-y-2 text-xs leading-relaxed font-semibold text-ink">
              <li>
                Tocá los <strong>tres puntos ⋮</strong> arriba a la derecha en Chrome.
              </li>
              <li>
                Seleccioná <strong>"Instalar aplicación"</strong> o <strong>"Agregar a la pantalla principal"</strong>.
              </li>
              <li>
                Confirmá tocando <strong>"Instalar"</strong>.
              </li>
            </ol>
          </div>
        )}

        <div className="rounded-xl bg-lime/20 p-3 text-xs text-fern font-semibold flex items-center gap-2.5">
          <Zap size={15} className="shrink-0" />
          <span>Abre en pantalla completa sin barra de navegación, ultra liviana y rápida.</span>
        </div>
      </div>
    </Modal>
  );
}

/* ============ MODAL: SINCRONIZAR CALENDARIO ============ */
function CalendarSyncModal({
  user,
  professionals,
  initialProId,
  onClose,
}: {
  user: User;
  professionals?: Professional[];
  initialProId?: string;
  onClose: () => void;
}) {
  const pros = professionals || [];
  const [selectedProId, setSelectedProId] = useState<string>(initialProId || "todos");

  const selectedPro = pros.find((p) => p.id === selectedProId);
  const proParam = selectedPro ? `&proId=${encodeURIComponent(selectedPro.id)}` : "";

  const calUrl = `https://cupito.app/api/calendar?id=${encodeURIComponent(user.id)}${proParam}`;
  const webcalUrl = `webcal://cupito.app/api/calendar?id=${encodeURIComponent(user.id)}${proParam}`;
  const gcalUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`;

  const whatsappShareText = selectedPro
    ? `Hola ${selectedPro.name}! Te paso tu enlace personal para sincronizar tus turnos de Cupito en el calendario de tu celu:\n\nEn iPhone: abrí este link y tocá "Suscribirse":\n${webcalUrl}\n\nEn Android / Google Calendar:\n${gcalUrl}\n\n¡Cualquier turno nuevo o reprogramación se te actualiza solo!`
    : `Hola! Te paso el enlace para sincronizar los turnos de ${user.business} en el calendario de tu celu:\n\nEn iPhone: abrí este link y tocá "Suscribirse":\n${webcalUrl}\n\nEn Android / Google Calendar:\n${gcalUrl}`;

  return (
    <Modal title="Calendario del Celular" onClose={onClose}>
      <div className="space-y-4 text-ink">
        <p className="text-sm text-inkmute">
          Sincronizá los turnos en tiempo real con la app de Calendario de tu iPhone o Android. Cualquier reserva nueva o cambio se actualiza automáticamente en tu celu.
        </p>

        {/* Pestañas de selección: Todo el equipo o Profesional individual */}
        {pros.length > 0 && (
          <div className="rounded-2xl border border-ink/10 bg-paper p-3 space-y-2">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-inkmute">
              ¿De quién querés sincronizar la agenda?
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedProId("todos")}
                className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${
                  selectedProId === "todos"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-white border border-ink/10 text-inkmute hover:text-ink"
                }`}
              >
                Todo el negocio
              </button>
              {pros.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedProId(p.id)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all ${
                    selectedProId === p.id
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-white border border-ink/10 text-inkmute hover:text-ink"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                  Solo {p.name}
                </button>
              ))}
            </div>

            <p className="text-[11px] text-inkmute">
              {selectedPro
                ? `Mostrando únicamente los turnos asignados a ${selectedPro.name}. Ideal para que ${selectedPro.name} lo configure en su propio celular.`
                : "Mostrando todos los turnos del negocio. Ideal para el dueño o la recepción."}
            </p>
          </div>
        )}

        <div className="space-y-2.5">
          <a
            href={webcalUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-press flex w-full items-center justify-between gap-3 rounded-2xl border-2 border-ink/15 bg-white p-3.5 transition-all hover:border-slate-900 hover:shadow-sm"
          >
            <div className="flex items-center gap-3 text-left">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink/5">
                <Smartphone size={20} className="text-ink" />
              </span>
              <div>
                <p className="font-display text-sm font-bold text-ink">
                  iPhone (Apple Calendar) {selectedPro && <span className="text-fern font-normal">· {selectedPro.name}</span>}
                </p>
                <p className="text-[11px] text-inkmute">Abre la app Calendario y toca "Suscribirse"</p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1 text-xs font-bold text-white shadow-sm transition-colors">Conectar</span>
          </a>

          <a
            href={gcalUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-press flex w-full items-center justify-between gap-3 rounded-2xl border-2 border-ink/15 bg-white p-3.5 transition-all hover:border-slate-900 hover:shadow-sm"
          >
            <div className="flex items-center gap-3 text-left">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink/5">
                <Calendar size={20} className="text-ink" />
              </span>
              <div>
                <p className="font-display text-sm font-bold text-ink">
                  Google Calendar {selectedPro && <span className="text-fern font-normal">· {selectedPro.name}</span>}
                </p>
                <p className="text-[11px] text-inkmute">Para celulares Android o Gmail en la compu</p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1 text-xs font-bold text-white shadow-sm transition-colors">Conectar</span>
          </a>
        </div>

        <div className="rounded-2xl border border-ink/10 bg-paper p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-inkmute uppercase tracking-wider">
              Enlace iCal de suscripción {selectedPro && `(${selectedPro.name})`}:
            </span>
            <CopyButton text={calUrl} label="Copiar link" copiedLabel="✓ Copiado" className="!py-1 !px-2.5 !text-[11px]" />
          </div>
          <p className="font-mono text-[11px] text-ink/70 break-all bg-white p-2 rounded-lg border border-ink/10 select-all">
            {calUrl}
          </p>
          <p className="text-[11px] text-inkmute leading-relaxed">
            Podés pegar este enlace en cualquier app de calendario como "Suscripción a calendario" o "Añadir desde URL".
          </p>
        </div>

        <div className="flex justify-end">
          <a
            href={calUrl}
            download={`cupito-${user.slug}${selectedPro ? `-${selectedPro.name.toLowerCase().replace(/[^a-z0-9]/g, "")}` : ""}.ics`}
            className="btn-press inline-flex items-center gap-1.5 text-xs font-bold text-fern hover:underline"
          >
            <Download size={13} /> Descargar archivo .ics {selectedPro ? `de ${selectedPro.name}` : "completo"}
          </a>
        </div>
      </div>
    </Modal>
  );
}

function BookingModal({
  initialDate,
  initialClient,
  initialPhone,
  initialServiceId,
  initialTime,
  initialProId,
  waitlistId,
  onClose,
  onCreated,
}: {
  initialDate: string;
  initialClient?: string;
  initialPhone?: string;
  initialServiceId?: string;
  initialTime?: string;
  initialProId?: string;
  waitlistId?: string;
  onClose: () => void;
  onCreated?: (info: { client: string; phone: string; serviceName: string; date: string; time: string; fromWaitlist: boolean }) => void;
}) {
  const { data, user, addBooking, createBookingFromWaitlist, toast } = useStore();
  const [client, setClient] = useState(initialClient ?? "");
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [serviceId, setServiceId] = useState(initialServiceId ?? data?.services[0]?.id ?? "");
  const [proId, setProId] = useState<string>(initialProId ?? data?.professionals[0]?.id ?? "");
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime ?? "");
  const [error, setError] = useState<string | null>(null);
  if (!data) return null;

  const targetPro = data.professionals.find((p) => p.id === proId);
  const targetHours = getProHours(targetPro, data.settings.hours);
  const dayHours = targetHours[dayOfWeek(date)];
  const selPro = proId || undefined;
  const selDur = serviceDurationOf(data.services, serviceId);
  const free = dayHours && dayHours.open
    ? slotsForDay(dayHours).filter(
        (t) =>
          !isSlotBlocked(data.blockedSlots || [], date, t, selPro) &&
          !findOverlap({ date, time: t, dur: selDur, proId: selPro }, data.bookings, data.services)
      )
    : [];

  const availableSlots = useMemo(() => {
    const list = [...free];
    if (time && !list.includes(time)) {
      list.push(time);
      list.sort((a, b) => toMinutes(a) - toMinutes(b));
    }
    return list;
  }, [free, time]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (client.trim().length < 2) return setError("El nombre del cliente es obligatorio.");
    if (!serviceId) return setError("Elegí un servicio.");
    if (!time) return setError("Elegí un horario.");
    // Si viene de la lista de espera, crear el turno y borrar de la lista
    // en UNA sola operación atómica (si no, la entrada "resucita" y da turnos infinitos).
    const res = waitlistId
      ? createBookingFromWaitlist(waitlistId, { client, phone, serviceId, date, time, source: "manual", proId: proId || undefined })
      : addBooking({ client, phone, serviceId, date, time, source: "manual", proId: proId || undefined });
    if (!res.ok) return setError(res.error);
    const serviceName = data.services.find((s) => s.id === serviceId)?.name ?? "tu turno";
    if (waitlistId) {
      // Viene de lista de espera: avisar por WhatsApp con un cartel dedicado.
      onClose();
      onCreated?.({ client: client.trim(), phone: phone.trim(), serviceName, date, time, fromWaitlist: true });
    } else {
      toast(`Reserva creada: ${client.trim()} · ${date} ${time}`);
      onClose();
    }
  };

  return (
    <Modal title="Nueva reserva" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Cliente *</label>
          <input className="field" placeholder="Nombre y apellido" value={client} onChange={(e) => setClient(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Teléfono</label>
          <input className="field" placeholder="11 5555-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Servicio</label>
            <CustomSelect
              value={serviceId}
              onChange={(val) => setServiceId(val)}
              options={data.services.map((s) => ({
                value: s.id,
                label: s.name,
                sublabel: fmtMoney(s.price),
              }))}
              placeholder="Elegir servicio"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Fecha</label>
            <input type="date" className="field" value={date} min={dateKey(new Date())} onChange={(e) => { setDate(e.target.value); setTime(""); }} />
          </div>
        </div>
        {data.professionals.length > 0 && (
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Profesional</label>
            <CustomSelect
              value={proId}
              onChange={(val) => setProId(val)}
              options={data.professionals.map((p) => ({
                value: p.id,
                label: p.name,
                sublabel: p.role,
              }))}
              placeholder="Elegir profesional"
            />
          </div>
        )}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-inkmute">
              Horario {time && <span className="text-fern">· {time} hs</span>}
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-inkmute">Manual:</span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="rounded-lg border border-ink/15 bg-white px-2 py-0.5 text-xs font-mono font-bold text-ink"
              />
            </div>
          </div>
          <div className="grid max-h-40 grid-cols-4 gap-1.5 overflow-y-auto rounded-xl border-2 border-ink/10 bg-white/50 p-2">
            {availableSlots.length === 0 && (
              <p className="col-span-4 py-3 text-center text-sm text-inkmute">
                {dayHours && !dayHours.open ? "Ese día el negocio no abre." : "No quedan horarios libres ese día (podés escribir uno manual arriba)."}
              </p>
            )}
            {availableSlots.map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setTime(t)}
                className={`rounded-lg border-2 py-1.5 font-display text-sm font-bold transition-all ${
                  time === t ? "border-emerald-600 bg-emerald-600 text-white shadow-xs" : "border-slate-200 bg-white text-slate-800 hover:border-slate-400"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="shake rounded-lg border-2 border-coral/40 bg-coral/10 px-3 py-2 text-xs font-semibold text-coral">{error}</p>}
        <button type="submit" className="min-h-[52px] w-full rounded-full bg-coral py-3.5 font-display text-base font-bold text-white transition-all hover:-translate-y-0.5 hover:shadow-[5px_6px_0_rgba(255,122,89,0.3)] active:translate-y-0 active:scale-[0.98]">Crear reserva</button>
      </form>
    </Modal>
  );
}

/* Cartel post-asignación: avisar por WhatsApp a quien estaba en lista de espera */
function WaitlistNotifyModal({ info, businessName, onClose }: {
  info: { client: string; phone: string; serviceName: string; date: string; time: string };
  businessName: string;
  onClose: () => void;
}) {
  const firstName = info.client.split(" ")[0];
  const msg = `Hola ${firstName}! Te escribimos de ${businessName}. Se liberó un lugar y te asignamos tu turno de ${info.serviceName} para el ${fmtLong(info.date)} a las ${info.time} hs. Respondeme para confirmar que venís. ¡Te esperamos!`;
  const hasPhone = info.phone.replace(/\D/g, "").length >= 8;
  return (
    <Modal title="Turno asignado" onClose={onClose}>
      <div className="space-y-4 text-ink">
        <div className="rounded-2xl border-2 border-limedeep/50 bg-lime/15 p-4">
          <p className="font-display text-base font-extrabold">{info.client} ya salió de la lista de espera</p>
          <p className="mt-1 text-sm text-inkmute">{info.serviceName} · {fmtLong(info.date)} a las {info.time} hs</p>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-inkmute">Mensaje para {firstName}</p>
          <p className="rounded-xl border-2 border-ink/10 bg-white/70 p-3 text-sm leading-relaxed">{msg}</p>
        </div>
        {hasPhone ? (
          <a
            href={createWhatsAppUrl(info.phone, msg)}
            target="_blank"
            rel="noreferrer"
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 py-3.5 font-display text-base font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-emerald-700"
          >
            <IconWhatsApp className="h-5 w-5" /> Avisarle por WhatsApp
          </a>
        ) : (
          <p className="rounded-xl border-2 border-amber-500/30 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-900">
            No hay teléfono cargado para {firstName}, avisale por el medio que prefieras.
          </p>
        )}
        <button type="button" onClick={onClose} className="w-full text-center text-xs font-bold text-inkmute hover:text-ink">
          Cerrar sin avisar
        </button>
      </div>
    </Modal>
  );
}

function RescheduleModal({
  b,
  service,
  professionals,
  businessName,
  onClose,
  onSave,
}: {
  b: Booking;
  service?: Service;
  professionals: Professional[];
  businessName: string;
  onClose: () => void;
  onSave: (newDate: string, newTime: string, newProId?: string) => void;
}) {
  const [date, setDate] = useState(b.date);
  const [time, setTime] = useState(b.time);
  const [proId, setProId] = useState(b.proId || "");
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(true);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!date || !time) return;
    onSave(date, time, proId || undefined);

    if (notifyWhatsapp && b.phone) {
      const msg = `Hola ${b.client.split(" ")[0]}! Te escribimos de ${businessName}. Te confirmamos que tu turno de ${service?.name || "atención"} fue reprogramado para el ${fmtLong(date)} a las ${time} hs. ¡Te esperamos!`;
      const waUrl = createWhatsAppUrl(b.phone, msg);
      window.open(waUrl, "_blank");
    }
  };

  return (
    <Modal title="Reprogramar Turno" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4 text-ink">
        <div className="rounded-2xl border-2 border-ink/10 bg-paper p-3.5 text-xs">
          <p className="font-display font-extrabold text-sm text-ink">{b.client}</p>
          <p className="mt-0.5 text-inkmute">
            {service?.name || "Servicio"} · Horario actual: <strong className="text-ink font-bold">{fmtLong(b.date)} {b.time} hs</strong>
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Nueva fecha</label>
            <input
              type="date"
              className="field !py-2.5"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Nuevo horario</label>
            <input
              type="time"
              className="field !py-2.5 font-display font-bold text-sm"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
            />
          </div>
        </div>

        {professionals.length > 0 && (
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Profesional a cargo</label>
            <CustomSelect
              value={proId}
              onChange={(val) => setProId(val)}
              options={[
                { value: "", label: "Cualquiera / Rotativo" },
                ...professionals.map((p) => ({
                  value: p.id,
                  label: p.name,
                  sublabel: p.role,
                })),
              ]}
              placeholder="Elegir profesional"
            />
          </div>
        )}

        {b.phone && (
          <label className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-50/60 p-3 text-xs font-semibold text-emerald-900 cursor-pointer">
            <input
              type="checkbox"
              checked={notifyWhatsapp}
              onChange={(e) => setNotifyWhatsapp(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
      <span className="flex max-w-full flex-wrap items-center gap-1.5">
              <IconWhatsApp className="h-4 w-4 text-emerald-600" />
              Abrir WhatsApp para notificar al cliente el cambio de horario
            </span>
          </label>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-ink/10 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="btn-press rounded-full border-2 border-ink/15 px-4 py-2 font-display text-xs font-bold text-inkmute hover:text-ink"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-press rounded-full bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 font-display text-xs font-bold text-white shadow-sm transition-colors"
          >
            Guardar reprogramación →
          </button>
        </div>
      </form>
    </Modal>
  );
}

function exportBookingsToCSV(bookings: Booking[], services: Service[], pros: Professional[], filename: string) {
  const headers = ["ID", "Fecha", "Hora", "Cliente", "Teléfono", "Servicio", "Profesional", "Estado", "Origen", "Seña Cobrada", "Motivo Cancelación"];
  const rows = bookings.map((b) => {
    const s = services.find((srv) => srv.id === b.serviceId);
    const p = pros.find((pr) => pr.id === b.proId);
    return [
      b.id,
      b.date,
      b.time,
      `"${(b.client || "").replace(/"/g, '""')}"`,
      `"${(b.phone || "").replace(/"/g, '""')}"`,
      `"${(s?.name || "").replace(/"/g, '""')}"`,
      `"${(p?.name || "").replace(/"/g, '""')}"`,
      b.status,
      b.source,
      b.paidDeposit ? "Sí" : "No",
      `"${(b.cancelReason || "").replace(/"/g, '""')}"`,
    ].join(",");
  });
  const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function BlockModal({
  date,
  time,
  pros,
  onSave,
  onClose,
}: {
  date?: string;
  time?: string;
  pros: Professional[];
  onSave: (slot: { date: string; time?: string; endTime?: string; proId?: string; reason: string }) => void;
  onClose: () => void;
}) {
  const [bDate, setBDate] = useState(date || dateKey(new Date()));
  const [bTime, setBTime] = useState(time || "13:00");
  const [bEndTime, setBEndTime] = useState("");
  const [bProId, setBProId] = useState("");
  const [reason, setReason] = useState("");
  const [isFullDay, setIsFullDay] = useState(false);

  return (
    <Modal title="Bloquear horario / Descanso" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            date: bDate,
            time: isFullDay ? undefined : (bTime || undefined),
            endTime: isFullDay ? undefined : (bEndTime || undefined),
            proId: bProId || undefined,
            reason: reason.trim() || "Bloqueado por el negocio",
          });
          onClose();
        }}
        className="mt-4 space-y-4 text-sm"
      >
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-inkmute">Fecha *</label>
          <input type="date" className="field" value={bDate} onChange={(e) => setBDate(e.target.value)} required />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="full-day-block"
            checked={isFullDay}
            onChange={(e) => setIsFullDay(e.target.checked)}
            className="h-4 w-4 rounded border-ink/20 text-evergreen focus:ring-evergreen"
          />
          <label htmlFor="full-day-block" className="text-xs font-bold text-ink cursor-pointer">
            Bloquear el día completo (no disponible para nadie)
          </label>
        </div>

        {!isFullDay && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-inkmute">Hora inicio *</label>
              <input type="time" className="field" value={bTime} onChange={(e) => setBTime(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-inkmute">Hora fin (opcional)</label>
              <input type="time" className="field" value={bEndTime} onChange={(e) => setBEndTime(e.target.value)} />
            </div>
          </div>
        )}

        {pros.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-inkmute">Profesional afectado</label>
            <CustomSelect
              value={bProId}
              onChange={(val) => setBProId(val)}
              options={[
                { value: "", label: "Todo el negocio / Todos" },
                ...pros.map((p) => ({
                  value: p.id,
                  label: p.name,
                  sublabel: p.role,
                })),
              ]}
              placeholder="Elegir profesional"
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-inkmute">Motivo del bloqueo</label>
          <input
            className="field"
            placeholder="Ej: Almuerzo, Trámite personal, Médico, Mantenimiento..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div className="pt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-ink/15 px-4 py-2.5 font-display text-xs font-bold text-inkmute hover:text-ink">
            Cancelar
          </button>
          <button type="submit" className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 font-display text-xs font-bold text-white shadow-sm transition-colors">
            Guardar bloqueo
          </button>
        </div>
      </form>
    </Modal>
  );
}

function TimeGridView({
  date,
  bookings,
  blockedSlots,
  services,
  pros,
  hours,
  onBookSlot,
  onBlockSlot,
  onUnblockSlot,
  onReschedule,
  businessName,
}: {
  date: string;
  bookings: Booking[];
  blockedSlots: BlockedSlot[];
  services: Service[];
  pros: Professional[];
  hours: DayHours[];
  onBookSlot: (prefill?: { time?: string; proId?: string }) => void;
  onBlockSlot: (time: string, proId?: string) => void;
  onUnblockSlot: (id: string) => void;
  onReschedule: (b: Booking) => void;
  businessName: string;
}) {
  const [proFilter, setProFilter] = useState<string>("todos");
  const dIdx = dayOfWeek(date);

  const daySlots = useMemo(() => {
    const slotSet = new Set<string>();

    // 1. Horarios base del profesional seleccionado o de todo el equipo
    if (proFilter !== "todos") {
      const p = pros.find((x) => x.id === proFilter);
      const pH = getProHours(p, hours)[dIdx];
      if (pH?.open) {
        slotsForDay(pH).forEach((s) => slotSet.add(s));
      }
    } else if (pros.length > 0) {
      pros.forEach((p) => {
        const pH = getProHours(p, hours)[dIdx];
        if (pH?.open) {
          slotsForDay(pH).forEach((s) => slotSet.add(s));
        }
      });
      if (slotSet.size === 0 && hours[dIdx]?.open) {
        slotsForDay(hours[dIdx]).forEach((s) => slotSet.add(s));
      }
    } else {
      const dayH = hours[dIdx];
      if (dayH?.open) {
        slotsForDay(dayH).forEach((s) => slotSet.add(s));
      }
    }

    // 2. ¡IMPORTANTE! Agregar siempre todos los horarios que tengan reservas en esta fecha
    bookings.forEach((b) => {
      if (b.date === date && b.status !== "cancelada") {
        if (proFilter === "todos" || !b.proId || b.proId === proFilter) {
          slotSet.add(b.time);
        }
      }
    });

    // 3. Agregar horarios de bloqueos puntuales en este día
    blockedSlots.forEach((bs) => {
      if (bs.date === date && bs.time) {
        if (proFilter === "todos" || !bs.proId || bs.proId === proFilter) {
          slotSet.add(bs.time);
        }
      }
    });

    return Array.from(slotSet).sort((a, b) => toMinutes(a) - toMinutes(b));
  }, [date, proFilter, pros, hours, dIdx, bookings, blockedSlots]);

  return (
    <div className="mt-4 space-y-3">
      {/* Filtro por profesional si hay más de 1 */}
      {pros.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 pb-1">
          <button
            type="button"
            onClick={() => setProFilter("todos")}
            className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${
              proFilter === "todos"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-ink/8 text-inkmute hover:text-ink"
            }`}
          >
            Todo el equipo ({pros.length})
          </button>
          {pros.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setProFilter(p.id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all ${
                proFilter === p.id
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-ink/8 text-inkmute hover:text-ink"
              }`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              {p.name}
            </button>
          ))}
        </div>
      )}

      {daySlots.length === 0 ? (
        <div className="card p-8 text-center text-sm text-inkmute">
          {proFilter !== "todos"
            ? `${pros.find((p) => p.id === proFilter)?.name || "Este profesional"} no atiende en este día.`
            : "No hay horarios configurados o el negocio está cerrado en este día."}
        </div>
      ) : (
        <div className="divide-y divide-ink/8 rounded-2xl border-2 border-ink/10 bg-white overflow-hidden shadow-sm">
          {daySlots.map((slotTime) => {
            if (proFilter !== "todos") {
              const currentPro = pros.find((p) => p.id === proFilter);
              const b = bookings.find(
                (x) => x.date === date && x.time === slotTime && x.status !== "cancelada" && (x.proId === proFilter || (!x.proId && pros.length <= 1))
              );
              // Turno previo que sigue en curso en slotTime
              const ongoing = !b ? bookings.find((x) => {
                if (x.date !== date || x.status === "cancelada") return false;
                if (x.proId && x.proId !== proFilter) return false;
                const start = toMinutes(x.time);
                const end = start + serviceDurationOf(services, x.serviceId);
                const s = toMinutes(slotTime);
                return s > start && s < end;
              }) : null;
              const ongoingSrv = ongoing ? services.find((s) => s.id === ongoing.serviceId) : null;
              const ongoingEnd = ongoing ? `${String(Math.floor((toMinutes(ongoing.time) + serviceDurationOf(services, ongoing.serviceId)) / 60)).padStart(2, "0")}:${String((toMinutes(ongoing.time) + serviceDurationOf(services, ongoing.serviceId)) % 60).padStart(2, "0")}` : null;

              const blocked = blockedSlots.find(
                (bs) => bs.date === date && (!bs.time || bs.time === slotTime) && (!bs.proId || bs.proId === proFilter)
              );
              const srv = b ? services.find((s) => s.id === b.serviceId) : null;

              return (
                <div
                  key={slotTime}
                  className={`flex flex-wrap items-center justify-between gap-3 p-3.5 transition-colors ${
                    b
                      ? "bg-lime/10"
                      : ongoing
                      ? "bg-amber-500/[0.04]"
                      : blocked
                      ? "bg-ink/[0.04]"
                      : "hover:bg-ink/[0.02]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-extrabold text-ink w-14">
                      {slotTime}
                    </span>
                    {b ? (
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-display font-extrabold text-ink text-sm">{b.client}</span>
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            {b.status}
                          </span>
                        </div>
                        <span className="text-xs text-inkmute">
                          {srv?.name || "Servicio"} {b.phone ? `· ${formatArgentinaPhone(b.phone) || b.phone}` : ""}
                        </span>
                      </div>
                    ) : ongoing ? (
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                          ↳ En atención: <strong className="text-ink">{ongoing.client}</strong> ({ongoingSrv?.name || "Servicio"} hasta {ongoingEnd} hs)
                        </span>
                      </div>
                    ) : blocked ? (
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-ink/10 px-2.5 py-0.5 text-xs font-bold text-ink/70">
                          Bloqueado: {blocked.reason}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        Disponible con {currentPro?.name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {b ? (
                      <>
                        <button
                          onClick={() => onReschedule(b)}
                          className="btn-press rounded-lg border border-ink/15 bg-white px-2.5 py-1 text-xs font-bold text-ink hover:border-evergreen"
                        >
                          Reprogramar
                        </button>
                        {b.phone && (
                          <a
                            href={createWhatsAppUrl(b.phone, `Hola ${b.client}! Te escribimos de ${businessName} por tu turno hoy a las ${b.time} hs.`)}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-press rounded-lg border border-emerald-600/30 bg-emerald-50 p-1.5 text-emerald-800 hover:bg-emerald-100"
                            title="WhatsApp"
                          >
                            <IconWhatsApp className="h-3.5 w-3.5 text-emerald-600" />
                          </a>
                        )}
                      </>
                    ) : ongoing ? (
                      <span className="text-xs font-bold text-inkmute italic">En curso</span>
                    ) : blocked ? (
                      <button
                        onClick={() => onUnblockSlot(blocked.id)}
                        className="text-xs font-bold text-coral hover:underline"
                      >
                        Desbloquear
                      </button>
                    ) : (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => onBookSlot({ time: slotTime, proId: proFilter })}
                          className="btn-press rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1 text-xs font-bold text-white shadow-sm transition-colors"
                        >
                          + Turno
                        </button>
                        <button
                          onClick={() => onBlockSlot(slotTime, proFilter)}
                          className="btn-press rounded-lg border border-ink/15 px-2.5 py-1 text-xs font-bold text-inkmute hover:border-coral hover:text-coral"
                        >
                          Pausar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // Vista "todos" los profesionales
            const slotBookings = bookings.filter((x) => x.date === date && x.time === slotTime && x.status !== "cancelada");
            const slotBlocks = blockedSlots.filter((bs) => bs.date === date && (!bs.time || bs.time === slotTime));
            const isGlobalBlocked = slotBlocks.some((bs) => !bs.proId);

            const busyProIds = new Set(slotBookings.map((b) => b.proId).filter(Boolean));
            // Incluir profesionales que están en atención continua en slotTime
            bookings.forEach((x) => {
              if (x.date !== date || x.status === "cancelada" || !x.proId) return;
              const start = toMinutes(x.time);
              const end = start + serviceDurationOf(services, x.serviceId);
              const s = toMinutes(slotTime);
              if (s > start && s < end) {
                busyProIds.add(x.proId);
              }
            });

            const blockedProIds = new Set(slotBlocks.filter((bs) => bs.proId).map((bs) => bs.proId));

            const freePros = isGlobalBlocked
              ? []
              : pros.filter((p) => {
                  if (busyProIds.has(p.id) || blockedProIds.has(p.id)) return false;
                  const pH = getProHours(p, hours)[dIdx];
                  if (!pH || !pH.open) return false;
                  const s = toMinutes(slotTime);
                  const inS1 = pH.from && pH.to && s >= toMinutes(pH.from) && s < toMinutes(pH.to);
                  const inS2 = pH.from2 && pH.to2 && s >= toMinutes(pH.from2) && s < toMinutes(pH.to2);
                  return inS1 || inS2;
                });

            const hasActiveBookings = slotBookings.length > 0;

            return (
              <div
                key={slotTime}
                className={`p-3.5 transition-colors ${
                  hasActiveBookings
                    ? "bg-emerald-50/70"
                    : isGlobalBlocked
                    ? "bg-ink/[0.04]"
                    : "hover:bg-ink/[0.02]"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-extrabold text-ink w-14">
                      {slotTime}
                    </span>

                    {isGlobalBlocked ? (
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-ink/10 px-2.5 py-0.5 text-xs font-bold text-ink/70">
                          Bloqueado para todo el equipo: {slotBlocks[0]?.reason || "Pausado"}
                        </span>
                      </div>
                    ) : !hasActiveBookings ? (
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                        {pros.length > 0
                          ? `Disponible (${freePros.length} libre${freePros.length === 1 ? "" : "s"})`
                          : "Disponible"}
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-xs font-extrabold text-emerald-950">
                          {slotBookings.length} {slotBookings.length === 1 ? "turno" : "turnos simultáneos"}
                        </span>
                        {freePros.length > 0 && (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                            +{freePros.length} libre{freePros.length === 1 ? "" : "s"}
                          </span>
                        )}
                        {freePros.length === 0 && pros.length > 0 && (
                          <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[11px] font-bold text-ink/70">
                            Cupo completo
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isGlobalBlocked ? (
                      <button
                        onClick={() => onUnblockSlot(slotBlocks[0].id)}
                        className="text-xs font-bold text-coral hover:underline"
                      >
                        Desbloquear
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        {freePros.length > 0 || pros.length === 0 ? (
                          <button
                            onClick={() => onBookSlot({ time: slotTime })}
                            className="btn-press rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1 text-xs font-bold text-white shadow-sm transition-colors"
                          >
                            {hasActiveBookings ? "+ Turno simultáneo" : "+ Turno"}
                          </button>
                        ) : null}
                        {!hasActiveBookings && (
                          <button
                            onClick={() => onBlockSlot(slotTime)}
                            className="btn-press rounded-lg border border-ink/15 px-2.5 py-1 text-xs font-bold text-inkmute hover:border-coral hover:text-coral"
                          >
                            Pausar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Sub-tarjetas de reservas individuales para este horario */}
                {hasActiveBookings && (
                  <div className="mt-3 pl-14 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {slotBookings.map((b) => {
                      const srv = services.find((s) => s.id === b.serviceId);
                      const bPro = pros.find((p) => p.id === b.proId);

                      return (
                        <div
                          key={b.id}
                          className="flex flex-col justify-between gap-2 rounded-xl border border-ink/10 bg-white p-2.5 shadow-xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-display text-xs font-bold text-ink truncate">
                                  {b.client}
                                </span>
                                <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800 shrink-0">
                                  {b.status}
                                </span>
                              </div>
                              <p className="text-[11px] text-inkmute truncate">
                                {srv?.name || "Servicio"}
                              </p>
                              {bPro && (
                                <span
                                  className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold text-white"
                                  style={{ background: bPro.color }}
                                >
                                  {bPro.name}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {b.phone && (
                                <a
                                  href={createWhatsAppUrl(
                                    b.phone,
                                    `Hola ${b.client}! Te escribimos de ${businessName} por tu turno hoy a las ${b.time} hs.`
                                  )}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn-press rounded-lg border border-emerald-600/30 bg-emerald-50 p-1 text-emerald-800 hover:bg-emerald-100"
                                  title="WhatsApp"
                                >
                                  <IconWhatsApp className="h-3 w-3 text-emerald-600" />
                                </a>
                              )}
                              <button
                                onClick={() => onReschedule(b)}
                                className="btn-press rounded-lg border border-ink/15 bg-white px-2 py-1 text-[10px] font-bold text-ink hover:border-evergreen"
                              >
                                Reprogramar
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ClientsCRMView({
  bookings,
  services,
  clientNotes,
  onSaveNote,
  businessName,
  onOpenCustomer,
}: {
  bookings: Booking[];
  services: Service[];
  clientNotes: Record<string, string>;
  onSaveNote: (phone: string, note: string) => void;
  businessName: string;
  onOpenCustomer?: (customer: CustomerStats) => void;
}) {
  const [query, setQuery] = useState("");
  const [editingPhone, setEditingPhone] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState("");

  const clients = useMemo(() => {
    const map = new Map<string, {
      name: string;
      phone: string;
      cleanPhone: string;
      totalBookings: number;
      attended: number;
      cancelled: number;
      totalSpent: number;
      lastDate: string;
      lastService: string;
    }>();

    for (const b of bookings) {
      const clean = cleanPhoneDigits(b.phone);
      if (!clean) continue;
      const srv = services.find((s) => s.id === b.serviceId);
      const existing = map.get(clean);
      const price = srv?.price || 0;

      if (!existing) {
        map.set(clean, {
          name: b.client,
          phone: b.phone,
          cleanPhone: clean,
          totalBookings: 1,
          attended: b.status === "atendida" ? 1 : 0,
          cancelled: b.status === "cancelada" ? 1 : 0,
          totalSpent: b.status === "atendida" || b.status === "confirmada" ? price : 0,
          lastDate: b.date,
          lastService: srv?.name || "",
        });
      } else {
        existing.totalBookings += 1;
        if (b.status === "atendida") existing.attended += 1;
        if (b.status === "cancelada") existing.cancelled += 1;
        if (b.status === "atendida" || b.status === "confirmada") existing.totalSpent += price;
        if (b.date > existing.lastDate) {
          existing.lastDate = b.date;
          existing.lastService = srv?.name || "";
          existing.name = b.client;
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.lastDate.localeCompare(a.lastDate));
  }, [bookings, services]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) => c.name.toLowerCase().includes(q) || c.cleanPhone.includes(q)
    );
  }, [clients, query]);

  return (
    <div className="pop-in mt-8 space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-extrabold text-ink">Ficha y CRM de Clientes</h2>
          <p className="text-xs text-inkmute">Historial consolidado, datos de contacto y notas privadas de cada cliente.</p>
        </div>
        <div className="relative min-w-[240px]">
          <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-inkmute" />
          <input
            className="field !py-2 !pl-9 !text-xs !rounded-full"
            placeholder="Buscar por nombre o celular..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-inkmute hover:text-ink">✕</button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          text={query ? "No hay clientes que coincidan." : "Todavía no tenés clientes agendados."}
          sub={query ? "Probá con otro nombre o número." : "Apenas reserven o crees un turno, sus fichas se generarán automáticamente."}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((c) => {
            const currentNote = clientNotes[c.cleanPhone] || "";
            const isEditing = editingPhone === c.cleanPhone;
            return (
              <div key={c.cleanPhone} className="card p-5 space-y-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display text-base font-extrabold text-ink">{c.name}</h3>
                    <p className="font-mono text-xs font-semibold text-inkmute">{formatArgentinaPhone(c.cleanPhone)}</p>
                  </div>
                  <a
                    href={createWhatsAppUrl(c.phone, `Hola ${(c.name || "cliente").trim().split(" ")[0]}! Te escribimos de ${businessName}.`)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-press flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-600/30 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors"
                  >
                    <IconWhatsApp className="h-3.5 w-3.5 text-emerald-600" /> WhatsApp
                  </a>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-xl bg-ink/[0.03] p-2.5 text-center text-xs">
                  <div>
                    <span className="block font-display font-extrabold text-ink">{c.totalBookings}</span>
                    <span className="text-[10px] text-inkmute">Turnos</span>
                  </div>
                  <div>
                    <span className="block font-display font-extrabold text-emerald-700">{c.attended}</span>
                    <span className="text-[10px] text-inkmute">Atendidos</span>
                  </div>
                  <div>
                    <span className="block font-display font-extrabold text-fern">{fmtMoney(c.totalSpent)}</span>
                    <span className="text-[10px] text-inkmute">Total gastado</span>
                  </div>
                </div>

                <div className="text-xs text-inkmute">
                  Última visita: <strong className="text-ink">{fmtLong(c.lastDate)}</strong> {c.lastService ? `(${c.lastService})` : ""}
                </div>

                {/* Nota privada */}
                <div className="rounded-xl border border-dashed border-ink/15 bg-white/60 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-inkmute">
                      Nota privada del negocio
                    </span>
                    {!isEditing && (
                      <button
                        onClick={() => {
                          setEditingPhone(c.cleanPhone);
                          setDraftNote(currentNote);
                        }}
                        className="text-[11px] font-bold text-fern hover:underline"
                      >
                        {currentNote ? "Editar" : "+ Agregar nota"}
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        className="field text-xs !py-1.5 resize-none h-16"
                        placeholder="Ej: Prefiere turnos por la mañana, alergia a producto X..."
                        value={draftNote}
                        onChange={(e) => setDraftNote(e.target.value)}
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingPhone(null)}
                          className="rounded-lg px-2.5 py-1 text-xs font-bold text-inkmute hover:text-ink"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => {
                            onSaveNote(c.cleanPhone, draftNote);
                            setEditingPhone(null);
                          }}
                          className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1 text-xs font-bold text-white shadow-sm transition-colors"
                        >
                          Guardar
                        </button>
                      </div>
                    </div>
                  ) : currentNote ? (
                    <p className="text-xs text-ink/80 italic bg-ink/[0.02] p-2 rounded-lg">{currentNote}</p>
                  ) : (
                    <p className="text-[11px] text-ink/40 italic">Sin notas para este cliente.</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onOpenCustomer?.({
                    name: c.name,
                    phone: c.phone,
                    count: c.totalBookings,
                    visits: c.attended,
                    total: c.totalSpent,
                    lastDate: c.lastDate,
                  })}
                  className="btn-press flex items-center justify-center gap-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors"
                >
                  Ver historial completo de turnos <ArrowUpRight size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ShareTemplatesModal({ business, slug, onClose }: { business: string; slug: string; onClose: () => void }) {
  const { toast } = useStore();
  const url = `https://cupito.app/${slug}`;

  const templates = [
    {
      id: "wa-auto",
      title: "Respuesta automática para WhatsApp Business",
      subtitle: "Para configurar como saludo o mensaje de ausencia en WhatsApp",
      badge: "Recomendado",
      text: `¡Hola! Gracias por comunicarte con ${business}.\n\nPodés ver todos nuestros servicios, precios actualizados y reservar tu turno en el día y horario que prefieras desde acá:\n${url}\n\n¡Es súper fácil y rápido! Te esperamos.`,
    },
    {
      id: "ig-bio",
      title: "Texto para tu Bio de Instagram",
      subtitle: "Corto, claro y directo para el enlace de tu perfil",
      badge: "Instagram",
      text: `${business}\nReservá tu turno online las 24 hs:\n${url}`,
    },
    {
      id: "stories",
      title: "Para Historias / Estados de WhatsApp",
      subtitle: "Para cuando abrís agenda y querés llenar los turnos de la semana",
      badge: "Difusión",
      text: `¡Abrimos la agenda para esta semana en ${business}!\n\nElegí tu turno antes de que se agoten los lugares:\n${url}`,
    },
  ];

  return (
    <Modal title="Mensajes listos para compartir" onClose={onClose}>
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        <p className="text-xs text-inkmute">
          Copiá estos mensajes con un clic y pegalos en tus redes para que tus clientes empiecen a reservar solos sin consultarte por chat.
        </p>

        {templates.map((t) => (
          <div key={t.id} className="rounded-2xl border-2 border-ink/10 bg-paper p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-display text-xs font-extrabold text-ink">{t.title}</span>
              <span className="rounded-full bg-evergreen/10 px-2 py-0.5 text-[10px] font-bold text-evergreen">
                {t.badge}
              </span>
            </div>
            <p className="text-[11px] text-inkmute">{t.subtitle}</p>
            <div className="relative rounded-xl border border-ink/10 bg-white p-3 font-sans text-xs text-ink/85 whitespace-pre-line leading-relaxed select-all">
              {t.text}
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(t.text).then(() => toast("¡Mensaje copiado al portapapeles!"));
                }}
                className="btn-press rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-1.5 font-display text-xs font-bold text-white shadow-sm transition-colors"
              >
                Copiar mensaje
              </button>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function PrintPosterModal({ business, slug, onClose }: { business: string; slug: string; onClose: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const url = `https://cupito.app/${slug}`;

  useEffect(() => {
    QRCode.toDataURL(url, { width: 500, margin: 2, color: { dark: "#082b22", light: "#ffffff" } })
      .then((d) => setSrc(d))
      .catch(() => {});
  }, [url]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal title="Cartel de mostrador imprimible" onClose={onClose}>
      <div className="space-y-4 text-center">
        <p className="text-xs text-inkmute text-left">
          Imprimí este cartel en cualquier impresora común (hoja A4). Pegalo en tu mostrador o espejo para que tus clientes escaneen y agenden directamente.
        </p>

        {/* Poster preview container */}
        <div id="printable-poster" className="mx-auto max-w-xs rounded-2xl border-4 border-evergreen bg-white p-6 text-ink shadow-md">
          <div className="border-b-2 border-evergreen/15 pb-4">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-fern">Turnos Online</p>
            <h2 className="mt-1 font-display text-2xl font-black text-evergreen leading-tight">{business}</h2>
          </div>

          <div className="my-5 flex flex-col items-center">
            {src ? (
              <img src={src} alt={`QR para ${business}`} className="h-44 w-44 rounded-xl border border-ink/10" />
            ) : (
              <div className="h-44 w-44 animate-pulse bg-ink/5 rounded-xl" />
            )}
            <p className="mt-3 font-display text-xs font-bold uppercase tracking-wider text-ink">
              Escaneá con la cámara de tu celular
            </p>
          </div>

          <div className="space-y-1.5 rounded-xl bg-ink/[0.03] p-3 text-left text-[11px] font-medium text-ink/75">
            <p className="flex items-center gap-1.5">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-[9px] font-bold text-white">1</span>
              <span>Elegí tu servicio y horario</span>
            </p>
            <p className="flex items-center gap-1.5">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-[9px] font-bold text-white">2</span>
              <span>Confirmá tu turno al instante</span>
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-dashed border-ink/15 text-[11px] font-bold text-inkmute">
            {url.replace(/^https?:\/\//, "")}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-xl border border-ink/15 px-4 py-2 text-xs font-bold text-inkmute hover:text-ink">
            Cerrar
          </button>
          <button onClick={handlePrint} className="rounded-xl bg-slate-900 hover:bg-slate-800 px-5 py-2 text-xs font-bold text-white shadow-sm transition-colors">
            Imprimir cartel (A4)
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ServiceModal({ service, onClose }: { service?: Service; onClose: () => void }) {
  const { addService, updateService, toast } = useStore();
  const [name, setName] = useState(service?.name ?? "");
  const [price, setPrice] = useState(service ? String(service.price) : "");
  const [duration, setDuration] = useState(service ? String(service.duration) : "30");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const p = Number(price);
    const d = Number(duration);
    if (name.trim().length < 2) return setError("Poné un nombre al servicio.");
    if (!Number.isFinite(p) || p <= 0) return setError("El precio tiene que ser mayor a 0.");
    if (!Number.isFinite(d) || d < 5) return setError("La duración mínima es 5 minutos.");
    if (service) { updateService(service.id, { name: name.trim(), price: p, duration: d }); toast("Servicio actualizado ✓"); }
    else { addService({ name: name.trim(), price: p, duration: d }); toast(`"${name.trim()}" ya está en tu página`); }
    onClose();
  };

  return (
    <Modal title={service ? "Editar servicio" : "Nuevo servicio"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Nombre *</label>
          <input className="field" placeholder="Corte + barba" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Precio ($) *</label>
            <input className="field" type="number" min="1" placeholder="15000" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Duración (min) *</label>
            <input className="field" type="number" min="5" step="5" placeholder="45" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
        </div>
        {error && <p className="shake rounded-lg border-2 border-coral/40 bg-coral/10 px-3 py-2 text-xs font-semibold text-coral">{error}</p>}
        <button type="submit" className="min-h-[52px] w-full rounded-full bg-emerald-600 hover:bg-emerald-700 py-3.5 font-display text-base font-bold text-white transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] shadow-md shadow-emerald-900/20">{service ? "Guardar cambios" : "Publicar servicio"}</button>
      </form>
    </Modal>
  );
}

/* ============ ESTADÍSTICAS ============ */
function StatsView({ db }: { db: BizData }) {
  const { user, removeReview, toast } = useStore();
  const today = new Date();
  const monthKey = dateKey(today).slice(0, 7);
  const isEscala = user?.plan === "escala";

  const active = (b: Booking) => b.status !== "cancelada";
  const isIncome = (b: Booking) => b.status === "atendida" || (b.status === "confirmada" && b.paymentStatus === "total_pagado");
  const monthBookings = db.bookings.filter((b) => b.date.startsWith(monthKey) && active(b));
  const incomeBookings = db.bookings.filter((b) => b.date.startsWith(monthKey) && isIncome(b));
  const revenue = incomeBookings.reduce((acc, b) => {
    const sPrice = db.services.find((s) => s.id === b.serviceId)?.price ?? 0;
    const extraPrice = (b.extraServiceIds || []).reduce((sum, sid) => sum + (db.services.find((s) => s.id === sid)?.price ?? 0), 0);
    return acc + (b.paidAmount || (sPrice + extraPrice));
  }, 0);
  const confirmed = db.bookings.filter((b) => b.status === "confirmada" || b.status === "atendida").length;
  const confirmRate = db.bookings.length ? Math.round((confirmed / db.bookings.length) * 100) : 0;
  const avgTicket = incomeBookings.length ? Math.round(revenue / incomeBookings.length) : 0;

  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const perDay = days.map((d) => {
    const k = dateKey(d);
    return { k, label: d.getDate(), count: db.bookings.filter((b) => b.date === k && active(b)).length };
  });
  const maxDay = Math.max(1, ...perDay.map((d) => d.count));

  const svcCount = db.services
    .map((s) => ({
      s,
      count: db.bookings.filter((b) => (b.serviceId === s.id || (b.extraServiceIds || []).includes(s.id)) && active(b)).length,
      revenue: db.bookings.filter((b) => (b.serviceId === s.id || (b.extraServiceIds || []).includes(s.id)) && isIncome(b)).length * s.price,
    }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
  const maxSvc = Math.max(1, ...svcCount.map((x) => x.count));

  // Clientes recurrentes
  const clientMap: Record<string, number> = {};
  db.bookings.forEach((b) => {
    if (active(b)) {
      const key = b.phone.replace(/\D/g, "") || b.client.toLowerCase();
      clientMap[key] = (clientMap[key] || 0) + 1;
    }
  });
  const totalUniqueClients = Object.keys(clientMap).length;
  const repeatClients = Object.values(clientMap).filter((c) => c > 1).length;
  const retentionRate = totalUniqueClients > 0 ? Math.round((repeatClients / totalUniqueClients) * 100) : 0;

  // Franjas horarias más concurridas
  const timeSlots = [
    { label: "Mañana (09:00 - 12:00)", filter: (t: string) => t >= "09:00" && t < "12:00" },
    { label: "Mediodía (12:00 - 15:00)", filter: (t: string) => t >= "12:00" && t < "15:00" },
    { label: "Tarde (15:00 - 18:00)", filter: (t: string) => t >= "15:00" && t < "18:00" },
    { label: "Vespertino (18:00 - 21:00)", filter: (t: string) => t >= "18:00" && t <= "21:00" },
  ];
  const peakHours = timeSlots.map((ts) => ({
    label: ts.label,
    count: db.bookings.filter((b) => active(b) && ts.filter(b.time)).length,
  }));
  const maxPeak = Math.max(1, ...peakHours.map((p) => p.count));

  const reviews = db.reviews;
  const avgRating = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0;

  const curr7 = perDay.slice(7).reduce((a, d) => a + d.count, 0);
  const prev7 = perDay.slice(0, 7).reduce((a, d) => a + d.count, 0);
  const resDelta = prev7 > 0 ? Math.round(((curr7 - prev7) / prev7) * 100) : null;

  const noShows = db.bookings.filter((b) => b.status === "ausente").length;
  const withOutcome = db.bookings.filter((b) => b.status === "atendida" || b.status === "ausente").length;
  const noShowRate = withOutcome > 0 ? Math.round((noShows / withOutcome) * 100) : 0;

  const kpis = [
    { label: "Ingresos del mes", value: revenue, prefix: "$", icon: <IconWallet className="h-5 w-5" />, accent: true, delta: null as number | null },
    { label: "Reservas (7 días)", value: curr7, prefix: "", icon: <IconCalendar className="h-5 w-5" />, accent: false, delta: resDelta },
    { label: "Tasa de confirmación", value: confirmRate, suffix: "%", icon: <IconCheck className="h-5 w-5" />, accent: false, delta: null as number | null },
    { label: "Ticket promedio", value: avgTicket, prefix: "$", icon: <IconChart className="h-5 w-5" />, accent: false, delta: null as number | null },
  ];

  const exportCSV = () => {
    const headers = ["Fecha", "Hora", "Cliente", "Telefono", "Servicio", "Precio", "Estado", "Origen"];
    const rows = db.bookings.map((b) => {
      const svc = db.services.find((s) => s.id === b.serviceId);
      return [
        b.date,
        b.time,
        `"${b.client.replace(/"/g, '""')}"`,
        `"${b.phone}"`,
        `"${(svc?.name ?? "Servicio").replace(/"/g, '""')}"`,
        svc?.price ?? 0,
        b.status,
        b.source,
      ].join(",");
    });
    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reporte-reservas-${user?.slug || "cupito"}-${dateKey(new Date())}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast("Reporte CSV descargado correctamente ✓");
  };

  return (
    <div className="pop-in mt-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-extrabold text-ink">Estadísticas y Rendimiento</h2>
          <p className="text-sm text-inkmute">Métricas en tiempo real sobre tu facturación, turnos y clientes.</p>
        </div>
        {isEscala && (
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-2 rounded-full border-2 border-slate-900 bg-slate-900/5 px-5 py-2.5 font-display text-xs font-bold text-slate-900 transition-all hover:bg-slate-900 hover:text-white"
          >
            Exportar reservas a Excel (CSV)
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className={`card card-hover p-5 ${k.accent ? "!border-limedeep/70 !bg-lime/25" : ""}`}>
            <div className="flex items-start justify-between">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${k.accent ? "bg-emerald-600 text-white" : "bg-ink/8 text-fern"}`}>{k.icon}</span>
              {k.delta !== null && (
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${k.delta >= 0 ? "bg-fern/15 text-fern" : "bg-coral/15 text-coral"}`}>{k.delta >= 0 ? "▲" : "▼"} {Math.abs(k.delta)}%</span>
              )}
            </div>
            <p className="mt-3 font-display text-3xl font-extrabold text-ink">
              <CountUp to={k.value} prefix={k.prefix ?? ""} suffix={k.suffix ?? ""} duration={1200} />
            </p>
            <p className="mt-0.5 text-xs font-bold uppercase tracking-wider text-inkmute">{k.label}</p>
          </div>
        ))}
      </div>

      {withOutcome > 0 && (
        <div className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 ${noShowRate >= 20 ? "border-amber-500/40 bg-amber-50" : "border-ink/10 bg-white/60"}`}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 font-display text-sm font-extrabold text-amber-800">{noShowRate}%</span>
          <p className="text-xs text-inkmute">
            <strong className="text-ink">Tasa de ausencias: {noShows} de {withOutcome} turnos ({noShowRate}%)</strong>
            {noShowRate >= 20 ? " — alta. Activá la seña y los recordatorios para bajarla." : " — los recordatorios automáticos la mantienen baja."}
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Reveal className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-lg font-extrabold text-ink">Reservas · últimos 14 días</h3>
            <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[11px] font-bold text-emerald-800">{perDay.reduce((a, d) => a + d.count, 0)} turnos</span>
          </div>
          <div className="mt-8 pt-4 flex gap-2">
            <div className="flex h-44 w-7 flex-col justify-between text-right text-[9px] font-bold text-ink/35" aria-hidden="true">
              <span>{maxDay}</span><span>{Math.ceil(maxDay / 2)}</span><span>0</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="relative h-44">
                <div className="absolute inset-0 flex flex-col justify-between" aria-hidden="true">
                  <div className="border-t border-dashed border-ink/12" />
                  <div className="border-t border-dashed border-ink/12" />
                  <div className="border-t-2 border-ink/15" />
                </div>
                <div className="relative flex h-full items-end gap-1 sm:gap-1.5">
                  {perDay.map((d, i) => {
                    const isToday = i === perDay.length - 1;
                    return (
                      <div key={d.k} className="group relative flex h-full flex-1 items-end">
                        <div className={`anim-bar-v w-full rounded-t-[5px] ${isToday ? "bg-emerald-500 ring-2 ring-emerald-600/40" : "bg-emerald-700"} transition-colors duration-200 group-hover:bg-emerald-600`}
                          style={{ height: `${d.count === 0 ? 3 : Math.max(8, (d.count / maxDay) * 100)}%`, animationDelay: `${i * 45}ms` }} />
                        <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-slate-900 px-3 py-1.5 text-center opacity-0 shadow-xl transition-all duration-200 group-hover:-translate-y-1 group-hover:opacity-100">
                          <p className="text-xs font-bold text-white">{d.count} turno{d.count === 1 ? "" : "s"}</p>
                          <p className="text-[10px] font-medium text-slate-300">{fmtLong(d.k)}{isToday ? " · hoy" : ""}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-1.5 flex gap-1 sm:gap-1.5">
                {perDay.map((d, i) => (
                  <span key={d.k} className={`flex-1 text-center text-[9px] font-bold ${i === perDay.length - 1 ? "text-fern" : "text-ink/35"}`}>{d.label}</span>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-inkmute">La barra lima es hoy. Pasá el cursor por las barras para ver el detalle de cada día.</p>
        </Reveal>

        <Reveal delay={100} className="card p-6">
          <h3 className="font-display text-lg font-extrabold text-ink">Servicios más pedidos</h3>
          <div className="mt-5 space-y-4">
            {svcCount.length === 0 && <p className="text-sm text-inkmute">Todavía no hay reservas para graficar.</p>}
            {svcCount.slice(0, 4).map((x, i) => (
              <div key={x.s.id}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-display font-bold text-ink">{i + 1}. {x.s.name}</span>
                  <span className="font-display font-extrabold text-fern">{x.count}</span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-ink/8">
                  <div className="anim-bar-h h-full rounded-full bg-fern" style={{ width: `${(x.count / maxSvc) * 100}%`, animationDelay: `${i * 90}ms` }} />
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>

      {/* ============ SECCIÓN AVANZADA (PLAN ESCALA O PREVIEW) ============ */}
      {isEscala ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Reveal className="card p-6 border-2 border-evergreen/30 bg-card">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-lg font-extrabold text-ink">Horarios más concurridos</h3>
              <span className="rounded-full bg-evergreen/10 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-evergreen">Escala</span>
            </div>
            <p className="mt-1 text-xs text-inkmute">Distribución de turnos por franja del día para optimizar tu personal.</p>
            <div className="mt-5 space-y-3">
              {peakHours.map((ph) => (
                <div key={ph.label}>
                  <div className="flex justify-between text-xs font-bold text-ink">
                    <span>{ph.label}</span>
                    <span className="text-fern">{ph.count} turnos</span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-ink/8">
                    <div className="h-full rounded-full bg-limedeep transition-all" style={{ width: `${(ph.count / maxPeak) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={100} className="card p-6 border-2 border-evergreen/30 bg-card">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-lg font-extrabold text-ink">Fidelidad y Retención</h3>
              <span className="rounded-full bg-evergreen/10 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-evergreen">Escala</span>
            </div>
            <p className="mt-1 text-xs text-inkmute">Porcentaje de clientes que volvieron a reservar en tu negocio.</p>
            <div className="mt-6 flex items-center gap-6">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-4 border-limedeep bg-lime/20 font-display text-2xl font-extrabold text-ink">
                {retentionRate}%
              </div>
              <div className="space-y-1 text-xs text-inkmute">
                <p><strong className="text-ink">{totalUniqueClients}</strong> clientes únicos registrados.</p>
                <p><strong className="text-fern">{repeatClients}</strong> clientes reservaron 2 o más veces.</p>
                <p className="text-[11px] text-ink/60">Tener más de 40% de retención indica alta satisfacción de tus clientes.</p>
              </div>
            </div>
          </Reveal>
        </div>
      ) : (
        <Reveal delay={120}>
          <div className="card relative overflow-hidden border-2 border-evergreen/25 bg-gradient-to-br from-card via-lime/5 to-card p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div className="max-w-xl">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-700 px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                  Exclusivo Plan Escala
                </span>
                <h3 className="mt-2 font-display text-xl font-extrabold text-ink">
                  Estadísticas avanzadas, retención y exportación
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-inkmute leading-relaxed">
                  Conocé las franjas horarias pico, descubrí qué porcentaje de clientes vuelve a reservar, analizá la facturación por cada servicio y descargá reportes completos a Excel / CSV.
                </p>
              </div>
              <button
                type="button"
                onClick={() => requestCheckout("escala")}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-700 px-6 py-3 font-display text-xs font-bold text-white shadow-md shadow-emerald-900/20 transition-all hover:-translate-y-0.5"
              >
                Desbloquear con Plan Escala <IconArrow className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </Reveal>
      )}

      <Reveal delay={150} className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 font-display text-lg font-extrabold text-ink"><IconStar className="h-5 w-5 text-limedeep" /> Reseñas de tus clientes</h3>
            {reviews.length > 0 ? (
              <p className="mt-1 text-sm text-inkmute">Promedio de <strong className="text-fern">{avgRating.toFixed(1)}</strong> en {reviews.length} reseña{reviews.length === 1 ? "" : "s"} reales dejadas por tus clientes.</p>
            ) : (
              <p className="mt-1 text-sm text-inkmute">Tus clientes pueden dejar reseñas directamente desde tu página pública.</p>
            )}
          </div>
          <a
            href={`/${user?.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full border-2 border-ink/15 px-5 py-2 font-display text-xs font-bold text-ink transition-all hover:-translate-y-0.5 hover:border-slate-900 hover:bg-slate-900 hover:text-white"
          >
            Ver en mi página pública <ArrowUpRight size={13} />
          </a>
        </div>
        <p className="mt-4 rounded-xl border-2 border-dashed border-limedeep/60 bg-lime/10 px-4 py-3 text-sm text-ink/80">
          Las reseñas provienen de clientes reales que visitan tu enlace público o completan su turno. Podés moderarlas o eliminarlas en cualquier momento.
        </p>
        {reviews.length > 0 ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((r) => (
              <div key={r.id} className="relative group rounded-xl border-2 border-ink/8 bg-white/60 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-ink/20">
                <div className="flex items-center justify-between">
                  <div className="flex gap-0.5 text-limedeep">{[...Array(5)].map((_, i) => <IconStar key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "" : "opacity-20"}`} />)}</div>
                  <ItemActionMenu
                    ariaLabel={`Opciones de reseña de ${r.client}`}
                    onDelete={() => {
                      if (confirm(`¿Eliminar la reseña de ${r.client}?`)) {
                        removeReview(r.id);
                        toast("Reseña eliminada");
                      }
                    }}
                  />
                </div>
                <p className="mt-2 text-sm leading-snug text-ink">“{r.text}”</p>
                <p className="mt-2 font-display text-xs font-bold text-inkmute">{r.client} · {fmtLong(r.date)}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border-2 border-dashed border-ink/10 p-6 text-center text-sm text-inkmute">
            Aún no recibiste reseñas. A medida que tus clientes atiendan sus turnos u opinen en tu página pública, aparecerán acá.
          </div>
        )}
      </Reveal>
    </div>
  );
}

/* ============ EQUIPO ============ */
function TeamView({ onSyncCalendar }: { onSyncCalendar?: (proId: string) => void } = {}) {
  const { user, data, addProfessional, updateProfessional, removeProfessional, toast } = useStore();
  const [modal, setModal] = useState(false);
  const [editingPro, setEditingPro] = useState<Professional | null>(null);
  if (!user || !data) return null;
  const limit = PRO_LIMIT[user.plan];

  return (
    <div className="pop-in mt-8">
      <p className="mb-4 text-sm text-inkmute">
        Tu plan <strong className="text-fern">{PLAN_META[user.plan].name}</strong> permite hasta <strong className="text-fern">{`${limit} profesional${limit === 1 ? "" : "es"}`}</strong>. Usás {data.professionals.length}.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {data.professionals.map((p) => {
          const hasCustom = p.hours && Array.isArray(p.hours) && p.hours.length === 7;
          return (
            <div key={p.id} className="group card card-hover flex flex-col justify-between gap-3 p-5">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-display text-base font-extrabold text-ink shadow-xs" style={{ background: p.color }}>
                  {p.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-extrabold text-ink truncate">{p.name}</p>
                  <p className="text-sm text-inkmute">{p.role}</p>
                  {p.phone && <p className="mt-1 text-xs font-semibold text-emerald-700">WhatsApp · {formatArgentinaPhone(p.phone)}</p>}
                  <span className={`inline-block mt-2 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${hasCustom ? "bg-evergreen/10 text-evergreen border border-evergreen/20" : "bg-ink/5 text-inkmute border border-ink/10"}`}>
                    {hasCustom ? "Horarios propios" : "Horario del negocio"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {onSyncCalendar && (
                    <button
                      type="button"
                      onClick={() => onSyncCalendar(p.id)}
                      aria-label={`Sincronizar calendario de ${p.name}`}
                      title={`Sincronizar turnos de ${p.name} al celular`}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ink/15 text-inkmute transition-all hover:border-evergreen hover:text-evergreen hover:bg-evergreen/5"
                    >
                      <IconCalendar className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditingPro(p)}
                    aria-label={`Editar a ${p.name}`}
                    title="Editar datos y horarios"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ink/15 text-inkmute transition-all hover:border-evergreen hover:text-evergreen hover:bg-evergreen/5"
                  >
                    <IconPencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => { removeProfessional(p.id); toast(`${p.name} salió del equipo.`, "warn"); }}
                    aria-label={`Quitar a ${p.name}`}
                    title="Eliminar del equipo"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ink/15 text-inkmute opacity-80 transition-all hover:border-coral hover:text-coral hover:bg-coral/5"
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        <button onClick={() => { setEditingPro(null); setModal(true); }} disabled={data.professionals.length >= limit}
          className="flex min-h-28 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-ink/25 text-inkmute transition-all duration-200 enabled:hover:-translate-y-1 enabled:hover:border-evergreen enabled:hover:text-evergreen disabled:opacity-50">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ink/8"><IconPlus className="h-5 w-5" /></span>
          <span className="font-display text-base font-bold">{data.professionals.length >= limit ? "Límite del plan alcanzado" : "Agregar profesional"}</span>
        </button>
      </div>
      {data.professionals.length >= limit && (
        <p className="mt-4 text-sm text-inkmute">Necesitás más lugar? <button onClick={() => requestCheckout(user.plan === "semilla" ? "crece" : "escala")} className="font-bold text-fern underline decoration-limedeep decoration-2 underline-offset-4">Subí de plan</button> para sumar profesionales. Te llevamos a MercadoPago.</p>
      )}
      {(modal || editingPro) && (
        <ProModal
          initial={editingPro ?? undefined}
          bizHours={data.settings.hours}
          onClose={() => { setModal(false); setEditingPro(null); }}
          onSave={(payload) => {
            if (editingPro) {
              updateProfessional(editingPro.id, {
                name: payload.name,
                role: payload.role,
                phone: payload.phone,
                hours: payload.hours,
              });
              toast(`${payload.name} actualizado ✓`);
              return null;
            } else {
              const err = addProfessional(payload.name, payload.role, payload.hours, payload.phone);
              if (err) return err;
              toast(`${payload.name} se sumó al equipo`);
              return null;
            }
          }}
        />
      )}
    </div>
  );
}

function ProModal({
  initial,
  bizHours,
  onClose,
  onSave,
}: {
  initial?: Professional;
  bizHours: DayHours[];
  onClose: () => void;
  onSave: (payload: { name: string; role: string; phone: string; hours?: DayHours[] }) => string | null;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [role, setRole] = useState(initial?.role ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [useCustomHours, setUseCustomHours] = useState(
    !!(initial?.hours && Array.isArray(initial.hours) && initial.hours.length === 7)
  );
  const [hours, setHours] = useState<DayHours[]>(() => {
    if (initial?.hours && Array.isArray(initial.hours) && initial.hours.length === 7) {
      return initial.hours.map((h) => ({ ...h }));
    }
    return bizHours.map((h) => ({ ...h }));
  });
  const [error, setError] = useState<string | null>(null);

  const setDay = (i: number, patch: Partial<DayHours>) => {
    setHours((prev) => prev.map((h, idx) => (idx === i ? { ...h, ...patch } : h)));
  };

  const order = [1, 2, 3, 4, 5, 6, 0];

  return (
    <Modal title={initial ? `Editar a ${initial.name}` : "Nuevo profesional"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const err = onSave({
            name,
            role,
            phone,
            hours: useCustomHours ? hours : undefined,
          });
          if (err) return setError(err);
          onClose();
        }}
        className="space-y-4"
      >
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Nombre *</label>
          <input className="field" placeholder="Caro Méndez" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Rol o especialidad</label>
          <input className="field" placeholder="Nail artist, Barbero, Colorista..." value={role} onChange={(e) => setRole(e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Teléfono / WhatsApp</label>
          <input className="field" type="tel" inputMode="tel" autoComplete="tel" placeholder="11 5555 1234" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <p className="mt-1.5 text-[11px] leading-relaxed text-inkmute">Lo usamos para enviarle su enlace personal de calendario desde el panel.</p>
        </div>

        {/* Configuración de horarios */}
        <div className="rounded-2xl border-2 border-ink/10 bg-paper p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display text-sm font-bold text-ink">Horarios de atención</p>
              <p className="text-xs text-inkmute">
                {useCustomHours
                  ? "Este profesional tiene horarios propios."
                  : "Usa los mismos horarios configurados para el negocio."}
              </p>
            </div>
            <div className="flex rounded-xl border border-ink/12 bg-card p-1 shadow-sm shrink-0">
              <button
                type="button"
                onClick={() => setUseCustomHours(false)}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                  !useCustomHours
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-inkmute hover:text-ink"
                }`}
              >
                Del negocio
              </button>
              <button
                type="button"
                onClick={() => setUseCustomHours(true)}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                  useCustomHours
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-inkmute hover:text-ink"
                }`}
              >
                Propios
              </button>
            </div>
          </div>

          {useCustomHours && (
            <div className="pop-in space-y-2 pt-2 border-t border-ink/10 max-h-64 overflow-y-auto pr-1">
              <p className="text-[11px] font-semibold text-inkmute mb-1">
                Configurá los días y turnos en que atiende {name.trim() || "este profesional"}:
              </p>
              {order.map((i) => {
                const h = hours[i];
                return (
                  <div
                    key={i}
                    className={`rounded-xl border p-2.5 transition-colors text-xs ${
                      h.open ? "border-ink/12 bg-white" : "border-ink/8 bg-ink/[0.03]"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Toggle
                        on={h.open}
                        onChange={(v) => setDay(i, { open: v })}
                        label={`Abrir ${DAY_NAMES[i]}`}
                      />
                      <span className={`w-20 font-display font-bold ${h.open ? "text-ink" : "text-ink/35"}`}>
                        {DAY_NAMES[i]}
                      </span>
                      {h.open && (
                        <span className="flex items-center gap-1.5 text-xs">
                          <input
                            type="time"
                            className="field !w-auto !py-1 !px-2 !text-xs"
                            value={h.from}
                            onChange={(e) => setDay(i, { from: e.target.value })}
                          />
                          <span className="text-inkmute">a</span>
                          <input
                            type="time"
                            className="field !w-auto !py-1 !px-2 !text-xs"
                            value={h.to}
                            onChange={(e) => setDay(i, { to: e.target.value })}
                          />
                        </span>
                      )}
                      {h.open && !h.from2 && (
                        <button
                          type="button"
                          onClick={() => setDay(i, { from2: "15:00", to2: "20:00" })}
                          className="ml-auto rounded-full border border-coral/40 px-2 py-0.5 text-[10px] font-bold text-coral transition-colors hover:bg-coral hover:text-white"
                        >
                          + Corte
                        </button>
                      )}
                    </div>
                    {h.open && h.from2 && (
                      <div className="pop-in mt-2 flex flex-wrap items-center gap-1.5 border-t border-dashed border-coral/20 pt-1.5 text-xs">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-coral">Reabre</span>
                        <input
                          type="time"
                          className="field !w-auto !py-1 !px-2 !text-xs"
                          value={h.from2}
                          onChange={(e) => setDay(i, { from2: e.target.value })}
                        />
                        <span className="text-inkmute">a</span>
                        <input
                          type="time"
                          className="field !w-auto !py-1 !px-2 !text-xs"
                          value={h.to2 ?? "20:00"}
                          onChange={(e) => setDay(i, { to2: e.target.value })}
                        />
                        <button
                          type="button"
                          onClick={() => setDay(i, { from2: undefined, to2: undefined })}
                          className="ml-auto text-[11px] font-bold text-inkmute hover:text-coral hover:underline"
                        >
                          Quitar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {error && <p className="shake rounded-lg border-2 border-coral/40 bg-coral/10 px-3 py-2 text-xs font-semibold text-coral">{error}</p>}
        <button type="submit" className="min-h-[52px] w-full rounded-full bg-emerald-600 hover:bg-emerald-700 py-3.5 font-display text-base font-bold text-white transition-all hover:-translate-y-0.5 shadow-md shadow-emerald-900/20">
          {initial ? "Guardar cambios" : "Agregar al equipo"}
        </button>
      </form>
    </Modal>
  );
}

/* ============ TIENDA (admin) ============ */
function ShopAdmin() {
  const { data, removeProduct, toast } = useStore();
  const [modal, setModal] = useState<{ open: boolean; id?: string }>({ open: false });
  if (!data) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {data.products.map((p) => (
        <div key={p.id} className="group card card-hover p-6">
          <div className="flex items-start justify-between gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-lime/40 text-fern"><IconBag className="h-5 w-5" /></span>
            <ItemActionMenu
              ariaLabel={`Opciones de ${p.name}`}
              onEdit={() => setModal({ open: true, id: p.id })}
              onDelete={() => { removeProduct(p.id); toast(`"${p.name}" eliminado de la tienda.`, "warn"); }}
            />
          </div>
          <h3 className="mt-3 font-display text-xl font-extrabold text-ink">{p.name}</h3>
          <p className="mt-0.5 text-sm text-inkmute">{p.desc}</p>
          <p className="mt-2 font-display text-2xl font-extrabold text-fern">{fmtMoney(p.price)}</p>
        </div>
      ))}
      <button onClick={() => setModal({ open: true })} className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-ink/25 text-inkmute transition-all duration-200 hover:-translate-y-1 hover:border-evergreen hover:text-evergreen">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ink/8"><IconPlus className="h-5 w-5" /></span>
        <span className="font-display text-base font-bold">Agregar producto</span>
      </button>
      {modal.open && <ProductModal product={modal.id ? data.products.find((p) => p.id === modal.id) : undefined} onClose={() => setModal({ open: false })} />}
    </div>
  );
}

function ProductModal({ product, onClose }: { product?: Product; onClose: () => void }) {
  const { addProduct, updateProduct, toast } = useStore();
  const [name, setName] = useState(product?.name ?? "");
  const [desc, setDesc] = useState(product?.desc ?? "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const p = Number(price);
    if (name.trim().length < 2) return setError("Poné un nombre al producto.");
    if (!Number.isFinite(p) || p <= 0) return setError("El precio tiene que ser mayor a 0.");
    if (product) { updateProduct(product.id, { name: name.trim(), desc: desc.trim(), price: p }); toast("Producto actualizado ✓"); }
    else { addProduct({ name: name.trim(), desc: desc.trim() || "Producto de tu tienda", price: p }); toast(`"${name.trim()}" ya está en tu tienda`); }
    onClose();
  };

  return (
    <Modal title={product ? "Editar producto" : "Nuevo producto"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Nombre *</label>
          <input className="field" placeholder="Esmalte semipermanente" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Descripción</label>
          <input className="field" placeholder="Colores a elección" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Precio ($) *</label>
          <input className="field" type="number" min="1" placeholder="8000" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        {error && <p className="shake rounded-lg border-2 border-coral/40 bg-coral/10 px-3 py-2 text-xs font-semibold text-coral">{error}</p>}
        <button type="submit" className="min-h-[52px] w-full rounded-full bg-emerald-600 hover:bg-emerald-700 py-3.5 font-display text-base font-bold text-white transition-all hover:-translate-y-0.5 shadow-md shadow-emerald-900/20">{product ? "Guardar cambios" : "Publicar producto"}</button>
      </form>
    </Modal>
  );
}

/* ============ CUPONES ============ */
function PromosView({ slug }: { slug: string }) {
  const { user, data, updateCoupon, removeCoupon, toast } = useStore();
  const [modal, setModal] = useState(false);
  if (!user || !data) return null;

  if (!isPaid(user)) {
    return (
      <div className="pop-in mt-8">
        <LockedFeature icon={<IconTicket className="h-7 w-7" />} title="Los cupones son parte del plan Crece"
          desc="Creá códigos de descuento y compartilos en tus historias o por WhatsApp. Tus clientes los aplican al reservar y el descuento se calcula solo, incluso en la seña."
          onUpgrade={() => requestCheckout("crece")} />
      </div>
    );
  }

  return (
    <div className="pop-in mt-8">
      <div className="grid gap-4 sm:grid-cols-2">
        {data.coupons.map((c) => (
          <div key={c.id} className="group card card-hover flex items-center gap-4 p-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-lime/40 text-fern"><IconTicket className="h-6 w-6" /></span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-xl font-extrabold tracking-wide text-ink">{c.code}</p>
              <p className="text-sm text-inkmute"><strong className="text-fern">{c.pct}% de descuento</strong> · {c.active ? "activo" : "pausado"}</p>
            </div>
            <button onClick={() => { updateCoupon(c.id, { active: !c.active }); toast(c.active ? `Cupón ${c.code} pausado.` : `Cupón ${c.code} activado ✓`); }}
              aria-label="Pausar/activar" className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${c.active ? "bg-fern" : "bg-ink/20"}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${c.active ? "left-6" : "left-1"}`} />
            </button>
            <ItemActionMenu
              ariaLabel={`Opciones de cupón ${c.code}`}
              onDelete={() => { removeCoupon(c.id); toast(`Cupón ${c.code} eliminado.`, "warn"); }}
            />
          </div>
        ))}
        <button onClick={() => setModal(true)} className="flex min-h-28 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-ink/25 text-inkmute transition-all duration-200 hover:-translate-y-1 hover:border-evergreen hover:text-evergreen">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ink/8"><IconPlus className="h-5 w-5" /></span>
          <span className="font-display text-base font-bold">Crear cupón</span>
        </button>
      </div>
      <p className="mt-5 text-sm text-inkmute">Compartí el código en tus historias o por WhatsApp. Se usa al reservar en <strong className="text-fern">cupito.app/{slug}</strong>.</p>
      {modal && <CouponModal onClose={() => setModal(false)} />}
    </div>
  );
}

function CouponModal({ onClose }: { onClose: () => void }) {
  const { addCoupon, toast } = useStore();
  const [code, setCode] = useState("");
  const [pct, setPct] = useState(10);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal title="Nuevo cupón" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); const err = addCoupon({ code, pct }); if (err) return setError(err); toast(`Cupón ${code.trim().toUpperCase()} creado`); onClose(); }} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Código *</label>
          <input className="field uppercase placeholder:normal-case" placeholder="MARTES20" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Descuento: <strong className="text-fern">{pct}%</strong></label>
          <input type="range" min={5} max={90} step={5} value={pct} onChange={(e) => setPct(Number(e.target.value))} className="w-full accent-[#1e5c49]" />
          <div className="flex justify-between text-xs font-bold text-ink/40"><span>5%</span><span>90%</span></div>
        </div>
        {error && <p className="shake rounded-lg border-2 border-coral/40 bg-coral/10 px-3 py-2 text-xs font-semibold text-coral">{error}</p>}
        <button type="submit" className="min-h-[52px] w-full rounded-full bg-emerald-600 hover:bg-emerald-700 py-3.5 font-display text-base font-bold text-white transition-all hover:-translate-y-0.5 shadow-md shadow-emerald-900/20">Crear cupón</button>
      </form>
    </Modal>
  );
}

/* ============ SUSCRIPCIÓN ============ */
function SubscriptionView({ current, user, onSelect }: { current: Plan; user: NonNullable<ReturnType<typeof useStore>["user"]>; onSelect: (p: Plan) => void }) {
  const { toast, data, cancelSubscriptionAsync } = useStore();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const doCancel = async () => {
    setCancelling(true);
    setCancelError(null);
    const r = await cancelSubscriptionAsync();
    setCancelling(false);
    if (!r.ok) {
      setCancelError(`${r.error} Si ya lo cancelaste en Mercado Pago, escribinos a hola@cupito.app y lo resolvemos.`);
      return;
    }
    setConfirmCancel(false);
    toast("Suscripción cancelada en Mercado Pago. No se te cobra más ✓", "warn");
  };
  const sub = user.subscription;
  const subStatus = getSubscriptionStatus(user);
  const monthUsed = data ? monthBookingCount(data) : 0;
  const monthPct = Math.min(100, Math.round((monthUsed / SEMILLA_MONTHLY_LIMIT) * 100));

  const plans: Plan[] = ["semilla", "crece", "escala"];
  const desc = PLAN_FEATURES;

  const nextDateStr = fmtDateHuman(sub?.nextRenewal || new Date(Date.now() + 30 * 86400000).toISOString());

  return (
    <div className="pop-in mt-8 space-y-6">
      {/* Uso del plan gratuito */}
      {current === "semilla" && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-display text-base font-bold text-slate-900">Reservas de este mes: {monthUsed}/{SEMILLA_MONTHLY_LIMIT}</p>
              <p className="mt-0.5 text-xs text-slate-500">{monthUsed >= SEMILLA_MONTHLY_LIMIT ? "Llegaste al tope: las nuevas reservas se pausan hasta el mes que viene o subiendo a Crece." : "Al llegar al tope, las reservas online se pausan hasta el mes siguiente."}</p>
            </div>
            <button
              type="button"
              onClick={() => onSelect("crece")}
              className="btn-press rounded-full bg-slate-900 px-5 py-2.5 font-display text-xs font-bold text-white transition-all hover:bg-slate-800 shadow-xs"
            >
              Reservas ilimitadas con Crece
            </button>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full transition-all ${monthPct >= 100 ? "bg-rose-500" : "bg-emerald-500"}`} style={{ width: `${monthPct}%` }} />
          </div>
        </div>
      )}

      {/* Detalle de la suscripción actual si es de pago */}
      {current !== "semilla" && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-display text-xl font-extrabold text-slate-900">
                  Plan {PLAN_META[current].name}
                </span>
                {subStatus.hasMpAutoDebit ? (
                  <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${sub?.status === "cancelada" ? "bg-rose-50 border border-rose-200 text-rose-700" : "bg-emerald-50 border border-emerald-200 text-emerald-700"}`}>
                    {sub?.status === "cancelada" ? "Cancelada (Vence pronto)" : "● Débito automático en Mercado Pago"}
                  </span>
                ) : (
                  <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${
                    subStatus.isExpired
                      ? "bg-rose-50 border border-rose-200 text-rose-700"
                      : subStatus.isGracePeriod
                      ? "bg-amber-50 border border-amber-200 text-amber-800"
                      : "bg-blue-50 border border-blue-200 text-blue-700"
                  }`}>
                    {subStatus.isExpired
                      ? "Período vencido"
                      : subStatus.isGracePeriod
                      ? "Período de gracia (3 días)"
                      : "Pago manual / Transferencia"}
                  </span>
                )}
              </div>

              <p className="mt-1 text-xs sm:text-sm text-slate-600">
                {subStatus.hasMpAutoDebit ? (
                  sub?.status === "cancelada"
                    ? `Tu suscripción no se renovará. Vas a mantener los beneficios de ${PLAN_META[current].name} hasta el ${nextDateStr}.`
                    : `Próximo cobro automático en tu tarjeta: ${nextDateStr} · ${PLAN_META[current].price}`
                ) : subStatus.isExpired ? (
                  `Tu período abonado finalizó el ${nextDateStr}. Activá tu débito con Mercado Pago para reactivar todas tus funciones.`
                ) : (
                  `Vigente hasta el ${nextDateStr} · Quedan ${subStatus.daysRemaining} días.`
                )}
              </p>
            </div>

            <div>
              {subStatus.hasMpAutoDebit ? (
                sub?.status === "cancelada" ? (
                  <button
                    type="button"
                    onClick={() => onSelect(current)}
                    className="btn-press rounded-full bg-slate-900 px-5 py-2.5 font-display text-xs font-bold text-white shadow-xs transition-all hover:bg-slate-800"
                  >
                    Reanudar suscripción
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmCancel(true)}
                    className="btn-press rounded-full border border-rose-200 bg-white px-5 py-2.5 font-display text-xs font-bold text-rose-600 shadow-xs transition-all hover:bg-rose-50"
                  >
                    Cancelar suscripción
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect(current)}
                  className="btn-press rounded-full bg-emerald-600 px-5 py-2.5 font-display text-xs font-bold text-white shadow-xs transition-all hover:bg-emerald-700"
                >
                  Activar con Mercado Pago
                </button>
              )}
            </div>
          </div>

          {/* Tarjeta de transición a Débito Automático si fue pagado manual */}
          {!subStatus.hasMpAutoDebit && (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="max-w-xl">
                  <p className="font-display text-sm font-bold text-slate-900">
                    ¿Querés que tu plan no venza mes a mes?
                  </p>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Activá el débito automático con Mercado Pago. Ingresás tu tarjeta una sola vez y Mercado Pago renueva tu plan mes a mes de forma automática, sin que tengas que transferir a mano cada 30 días.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`mailto:hola@cupito.app?subject=${encodeURIComponent(`Hola! Quiero renovar mi plan ${PLAN_META[current].name} de ${user.business} por transferencia.`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-press rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Renovar por transferencia
                  </a>
                  <button
                    type="button"
                    onClick={() => onSelect(current)}
                    className="btn-press rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
                  >
                    Activar débito automático
                  </button>
                </div>
              </div>
            </div>
          )}

          {confirmCancel && (
            <div className="pop-in mt-5 rounded-2xl border border-rose-200 bg-rose-50/60 p-4">
              <p className="font-display text-sm font-bold text-slate-900">¿Querés cancelar la renovación automática?</p>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Se cancela en Mercado Pago: no se te cobrará más. Vas a poder seguir usando {PLAN_META[current].name} hasta el <strong>{nextDateStr}</strong> y luego tu cuenta volverá a Semilla.
              </p>
              {cancelError && <p className="mt-2 rounded-xl border border-rose-200 bg-rose-100/70 px-3 py-2 text-xs font-semibold text-rose-700">{cancelError}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={() => { void doCancel(); }}
                  className="rounded-full bg-rose-600 px-4 py-2 font-display text-xs font-bold text-white transition-all hover:bg-rose-700 disabled:opacity-60"
                >
                  {cancelling ? "Cancelando en Mercado Pago…" : "Sí, cancelar en Mercado Pago"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmCancel(false)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 font-display text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Mantener suscripción
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-3">
        {plans.map((p) => {
          const active = current === p;
          const isPopular = p === "crece";
          return (
            <div
              key={p}
              className={`relative flex flex-col justify-between rounded-2xl border p-6 transition-all duration-200 ${
                active
                  ? "border-2 border-emerald-500 bg-emerald-50/20 shadow-md ring-4 ring-emerald-500/10"
                  : isPopular
                  ? "border-slate-900 bg-white shadow-md hover:border-slate-950"
                  : "border-slate-200 bg-white shadow-xs hover:border-slate-300 hover:shadow-sm"
              }`}
            >
              {isPopular && !active && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-900 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-xs">
                  Más elegido
                </span>
              )}
              {active && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-xs">
                  ✓ Tu plan actual
                </span>
              )}
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-display text-2xl font-extrabold text-slate-900">{PLAN_META[p].name}</h3>
                  {p === "semilla" && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">Gratis</span>}
                </div>
                <p className="mt-3 font-display text-3xl font-extrabold text-slate-900">{PLAN_META[p].price}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {p === "semilla" ? "Sin tarjeta ni compromisos" : "Suscripción mensual o anual"}
                </p>

                <ul className="mt-5 space-y-2.5 border-t border-slate-100 pt-4">
                  {desc[p].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-xs text-slate-600 leading-snug">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <IconCheck className="h-2.5 w-2.5" />
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 border-t border-slate-100 pt-4">
                {active ? (
                  <div className="flex items-center justify-center gap-2 rounded-full bg-slate-100 py-3 font-display text-xs font-bold text-slate-700">
                    <IconCheck className="h-4 w-4 text-emerald-600" /> Plan en uso
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelect(p)}
                    className={`btn-press flex w-full items-center justify-center gap-2 rounded-full py-3.5 font-display text-xs font-bold transition-all ${
                      p === "semilla"
                        ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-xs"
                        : isPopular
                        ? "bg-slate-900 text-white hover:bg-slate-800 shadow-sm"
                        : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                    }`}
                  >
                    {p === "semilla" ? "Bajar a Semilla (Gratis)" : `Elegir ${PLAN_META[p].name} con Mercado Pago`}
                    <IconArrow className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-xs">
        <p className="font-bold text-slate-900">¿Cómo funciona el cobro de la suscripción?</p>
        <p className="mt-1 text-xs sm:text-sm leading-relaxed text-slate-500">
          Al tocar en <strong>Elegir con Mercado Pago</strong>, se abre el checkout oficial de Mercado Pago. Podés ingresar tu tarjeta de débito o crédito para que el cobro sea automático todos los meses. Si en algún momento querés cancelar o cambiar de plan, lo hacés con 1 clic desde este panel sin trámites ni llamadas.
        </p>
      </div>
    </div>
  );
}

/* ============ QR ============ */
function QrBlock({ url, onPrint }: { url: string; onPrint?: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { width: 320, margin: 1, color: { dark: "#082b22", light: "#ffffff" } })
      .then((d) => { if (alive) setSrc(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, [url]);
  if (!src) return null;
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-4">
      <img src={src} alt={`QR para reservar en ${url}`} className="h-40 w-40 rounded-lg shadow-sm" />
      <div className="flex w-full flex-col sm:flex-row gap-2">
        <a href={src} download="qr-cupito.png" className="flex-1 rounded-xl border-2 border-ink/12 bg-white py-2.5 text-center font-display text-xs font-bold text-ink transition-all hover:border-evergreen">
          Descargar QR
        </a>
        {onPrint && (
          <button onClick={onPrint} className="flex-1 rounded-xl bg-slate-900 hover:bg-slate-800 py-2.5 text-center font-display text-xs font-bold text-white transition-all shadow-sm">
            Imprimir cartel
          </button>
        )}
      </div>
    </div>
  );
}

function LockedFeature({ icon, title, desc, onUpgrade }: { icon: ReactNode; title: string; desc: string; onUpgrade: () => void }) {
  return (
    <div className="card mx-auto max-w-xl p-8 text-center">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-ink/8 text-ink/50">{icon}</span>
      <h3 className="mt-4 font-display text-2xl font-extrabold text-ink">{title}</h3>
      <p className="mt-2 leading-relaxed text-inkmute">{desc}</p>
      <button onClick={onUpgrade} className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-700 px-7 py-3.5 font-display text-base font-bold text-white transition-all hover:-translate-y-0.5 shadow-md shadow-emerald-900/20">
        Activar con el plan Crece <IconArrow className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ============ AJUSTES ============ */
type SettingsTab = "negocio" | "pagina" | "pagos" | "horarios" | "plan" | "cuenta";

function SettingsView({
  user,
  settings,
  onSaveProfile,
  onSelectPlan,
  initialTab = "negocio",
  onTabChange,
}: {
  initialTab?: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  user: NonNullable<ReturnType<typeof useStore>["user"]>;
  settings: BizSettings;
  onSaveProfile: (b: string, n: string) => void;
  onSelectPlan: (p: Plan) => void;
}) {
  const tab = initialTab;
  const setTab = onTabChange;
  const { updateSettings } = useStore();
  const [showLocalNotice, setShowLocalNotice] = useState(true);

  const mainGroups: {
    id: string;
    label: string;
    tabs: { id: SettingsTab; label: string; icon: ReactNode }[];
  }[] = [
    {
      id: "local",
      label: "Local",
      tabs: [
        { id: "negocio", label: "Negocio", icon: <IconWallet className="h-3.5 w-3.5" /> },
        { id: "horarios", label: "Horarios", icon: <IconClock className="h-3.5 w-3.5" /> },
      ],
    },
    {
      id: "reservas",
      label: "Reservas",
      tabs: [
        { id: "pagos", label: "Pagos y seña", icon: <IconTicket className="h-3.5 w-3.5" /> },
      ],
    },
    {
      id: "cuenta",
      label: "Cuenta",
      tabs: [
        { id: "plan", label: "Plan", icon: <IconStar className="h-3.5 w-3.5" /> },
        { id: "cuenta", label: "Cuenta", icon: <IconLogout className="h-3.5 w-3.5" /> },
      ],
    },
  ];

  return (
    <div className="pop-in mt-8">
      {/* Sutil aviso de modo local dentro de Ajustes */}
      {showLocalNotice && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-black/[0.08] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#F5F5F7] text-[#1D1D1F]">
              <IconGear className="h-4 w-4" />
            </span>
            <p className="text-xs text-[#6E6E73] leading-relaxed">
              <strong className="text-[#1D1D1F]">Modo local:</strong> los cambios se guardan sólo en este dispositivo. Para usar la agenda desde otros equipos, contactá a hola@cupito.app.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowLocalNotice(false)}
            className="shrink-0 rounded-lg p-1.5 text-[#6E6E73] hover:bg-black/5 hover:text-[#1D1D1F] transition-colors"
            aria-label="Cerrar aviso"
          >
            ✕
          </button>
        </div>
      )}

      {/* 3 Grupos de Ajustes: Local, Reservas, Cuenta */}
      <div className="flex flex-wrap items-center gap-2 border-b border-black/[0.06] pb-3">
        {mainGroups.map((group, idx) => (
          <div key={group.id} className="flex items-center gap-1.5">
            {idx > 0 && <span className="text-black/20 mx-1 hidden sm:inline">|</span>}
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6E6E73] mr-0.5">
              {group.label}:
            </span>
            <div className="flex items-center gap-1">
              {group.tabs.map((t) => {
                const isSel = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                      isSel
                        ? "bg-black text-white font-bold shadow-sm"
                        : "bg-[#F5F5F7] text-[#6E6E73] hover:bg-neutral-200/70 hover:text-[#1D1D1F]"
                    }`}
                  >
                    {t.icon}
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="pop-in mt-6 max-w-2xl" key={tab}>
        {tab === "negocio" && <BusinessTab user={user} onSave={onSaveProfile} />}
        {tab === "pagina" && <PersonalizationCard settings={settings} paid={isPaid(user)} onSave={(patch) => updateSettings(patch)} onRequestUpgrade={() => onSelectPlan("crece")} />}
        {tab === "pagos" && <DepositCard settings={settings} paid={isPaid(user)} onChange={(patch) => updateSettings(patch)} />}
        {tab === "horarios" && <HoursCard hours={settings.hours} settings={settings} onChange={(hours) => updateSettings({ hours })} onUpdateSettings={(patch) => updateSettings(patch)} />}
        {tab === "plan" && (
          <PlanTab
            current={user.plan}
            user={user}
            onSelect={onSelectPlan}
          />
        )}
        {tab === "cuenta" && <AccountTab />}
      </div>
    </div>
  );
}

function BusinessTab({ user, onSave }: { user: { business: string; name: string; email: string }; onSave: (b: string, n: string) => void }) {
  const [business, setBusiness] = useState(user.business);
  const [name, setName] = useState(user.name);

  // Solo resincronizar si el valor guardado cambió de verdad (no en cada
  // pulso de la nube cada 6s, que te borraba lo que estabas escribiendo).
  const savedKey = `${user.business}::${user.name}`;
  useEffect(() => {
    setBusiness(user.business);
    setName(user.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey]);

  return (
    <div className="card p-6">
      <h3 className="font-display text-lg font-extrabold text-ink">Tu negocio</h3>
      <div className="mt-4 space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Nombre del negocio</label>
          <input className="field" value={business} onChange={(e) => setBusiness(e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Tu nombre</label>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Email</label>
          <input className="field cursor-not-allowed bg-ink/5 text-inkmute" value={user.email} disabled />
        </div>
        <button onClick={() => onSave(business, name)} className="rounded-full bg-emerald-600 px-6 py-2.5 font-display text-sm font-bold text-white shadow-xs transition-all hover:-translate-y-0.5 hover:bg-emerald-700">Guardar cambios</button>
      </div>
    </div>
  );
}

function PersonalizationCard({ settings, paid, onSave, onRequestUpgrade }: { settings: BizSettings; paid: boolean; onSave: (patch: Partial<BizSettings>) => void; onRequestUpgrade: () => void }) {
  const { toast } = useStore();
  const [f, setF] = useState({
    description: settings.description || "",
    address: settings.address || "",
    whatsapp: settings.whatsapp || "",
    instagram: settings.instagram || "",
    mapsUrl: settings.mapsUrl || "",
    theme: (settings.theme || "evergreen") as ThemeId,
  });

  // Solo resincronizar si lo guardado cambió de verdad (no en cada
  // pulso de la nube, que te borraba lo que estabas escribiendo).
  const savedPageKey = JSON.stringify([
    settings.description || "",
    settings.address || "",
    settings.whatsapp || "",
    settings.instagram || "",
    settings.mapsUrl || "",
    settings.theme || "evergreen",
  ]);
  useEffect(() => {
    setF({
      description: settings.description || "",
      address: settings.address || "",
      whatsapp: settings.whatsapp || "",
      instagram: settings.instagram || "",
      mapsUrl: settings.mapsUrl || "",
      theme: (settings.theme || "evergreen") as ThemeId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedPageKey]);

  const handleSave = () => {
    onSave({
      description: f.description.trim(),
      address: f.address.trim(),
      whatsapp: f.whatsapp.replace(/\D/g, ""),
      instagram: f.instagram.trim().replace(/^@/, ""),
      mapsUrl: f.mapsUrl.trim(),
      theme: paid ? f.theme : "evergreen",
    });
    toast("Tu página se actualizó ✓");
  };

  return (
    <div className="card p-6 space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime/30 text-fern"><IconSpark className="h-5 w-5" /></span>
        <div>
          <h3 className="font-display text-lg font-extrabold text-ink">Tu página, con tu identidad</h3>
          <p className="text-sm text-inkmute">Esto es lo que ven tus clientes en tu link público.</p>
        </div>
      </div>

      {/* Paleta de colores */}
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-inkmute">
            Paleta de colores de tu página
          </label>
          {!paid && (
            <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-900">
              Paletas exclusivas: Plan Crece
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {(Object.keys(THEMES) as ThemeId[]).map((tid) => {
            const th = THEMES[tid];
            const isLocked = !paid && tid !== "evergreen";
            const isSel = f.theme === tid;
            return (
              <button
                key={tid}
                type="button"
                onClick={() => {
                  if (isLocked) {
                    toast("Las paletas de colores exclusivas están disponibles en el plan Crece.", "warn");
                    onRequestUpgrade();
                    return;
                  }
                  setF({ ...f, theme: tid });
                }}
                className={`relative flex items-center gap-2.5 rounded-xl border-2 p-3 text-left transition-all ${
                  isSel
                    ? "!border-evergreen !bg-evergreen/5 shadow-sm"
                    : isLocked
                    ? "border-ink/8 bg-ink/[0.02] opacity-75 hover:border-amber-500/40"
                    : "border-ink/10 bg-white hover:border-ink/30"
                }`}
              >
                <span className={`h-6 w-6 shrink-0 rounded-full bg-gradient-to-tr ${th.sampleGradient} shadow-inner flex items-center justify-center`}>
                  {isSel && <span className="h-2 w-2 rounded-full bg-white shadow" />}
                  {isLocked && !isSel && <IconLock className="h-3 w-3 text-white drop-shadow" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-ink">{th.name}</p>
                  {isLocked && <p className="text-[9px] font-bold text-amber-800">Plan Crece</p>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Descripción</label>
          <textarea className="field min-h-20 resize-none" placeholder="Ej: Manicura y nail art con productos de primera." value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Dirección</label>
          <input className="field" placeholder="Av. Corrientes 1234, CABA" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">WhatsApp (solo números)</label>
          <input className="field" placeholder="1155551234" value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Instagram (sin el @)</label>
          <input className="field" placeholder="studionails.ok" value={f.instagram} onChange={(e) => setF({ ...f, instagram: e.target.value })} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Link de Google Maps</label>
          <input className="field" placeholder="https://maps.app.goo.gl/..." value={f.mapsUrl} onChange={(e) => setF({ ...f, mapsUrl: e.target.value })} />
        </div>
      </div>
      <button
        type="button"
        onClick={handleSave}
        className="rounded-full bg-emerald-600 px-6 py-2.5 font-display text-sm font-bold text-white shadow-xs transition-all hover:-translate-y-0.5 hover:bg-emerald-700"
      >
        Guardar mi página
      </button>
    </div>
  );
}

function DepositCard({ settings, paid, onChange }: { settings: BizSettings; paid: boolean; onChange: (patch: Partial<BizSettings>) => void }) {
  const { toast } = useStore();
  const [f, setF] = useState({
    alias: settings.transferAlias || "",
    cbu: settings.transferCBU || "",
    holder: settings.transferHolder || "",
  });

  const savedPayKey = JSON.stringify([
    settings.transferAlias || "",
    settings.transferCBU || "",
    settings.transferHolder || "",
  ]);
  useEffect(() => {
    setF({
      alias: settings.transferAlias || "",
      cbu: settings.transferCBU || "",
      holder: settings.transferHolder || "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedPayKey]);

  if (!paid) {
    return (
      <LockedFeature icon={<IconTicket className="h-7 w-7" />} title="La seña es parte del plan Crece"
        desc="Pedí un anticipo al reservar. Elegís el porcentaje y verificás la transferencia desde tu panel."
        onUpgrade={() => requestCheckout("crece")} />
    );
  }

  const handleSave = () => {
    const error = validateTransfer(f.alias, f.cbu, f.holder);
    if (error) { toast(error, "warn"); return; }
    onChange({
      transferAlias: f.alias.trim(),
      transferCBU: f.cbu.replace(/\D/g, ""),
      transferHolder: f.holder.trim(),
    });
    toast("Datos de cobro guardados ✓");
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-extrabold text-ink">Seña al reservar</h3>
          <p className="text-sm text-inkmute">El cliente transfiere a tus datos y te envía el comprobante. Vos verificás el ingreso y confirmás el turno.</p>
        </div>
        <Toggle on={settings.depositEnabled} onChange={(v) => { if (v) {
            const error = validateTransfer(f.alias, f.cbu, f.holder);
            if (error) { toast(error, "warn"); return; }
          }
          onChange({ depositEnabled: v, transferAlias: f.alias.trim(), transferCBU: f.cbu.replace(/\s/g, ""), transferHolder: f.holder.trim() }); toast(v ? "Seña activada ✓" : "Seña desactivada."); }} label="Activar seña" />
      </div>
      {(
        <div className="pop-in mt-5 space-y-5">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Porcentaje de seña: <strong className="text-fern">{settings.depositPct}%</strong></label>
            <input aria-label="Porcentaje de seña" type="range" min={10} max={50} step={5} value={settings.depositPct} onChange={(e) => onChange({ depositPct: Number(e.target.value) })} className="w-full accent-[#1e5c49]" />
            <div className="flex justify-between text-xs font-bold text-ink/40"><span>10%</span><span>50%</span></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Alias</label>
              <input className="field" aria-label="Alias de transferencia" placeholder="TU.NEGOCIO" value={f.alias} onChange={(e) => setF({ ...f, alias: e.target.value })} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">CBU / CVU</label>
              <input className="field" aria-label="CBU o CVU" inputMode="numeric" maxLength={22} placeholder="0000003100012345678901" value={f.cbu} onChange={(e) => setF({ ...f, cbu: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Titular de la cuenta</label>
              <input className="field" aria-label="Titular de la cuenta" placeholder="Nombre y apellido" value={f.holder} onChange={(e) => setF({ ...f, holder: e.target.value })} />
            </div>
          </div>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-full bg-emerald-600 px-6 py-2.5 font-display text-sm font-bold text-white shadow-xs transition-all hover:-translate-y-0.5 hover:bg-emerald-700"
          >
            Guardar datos de cobro
          </button>
        </div>
      )}
    </div>
  );
}

function HoursCard({
  hours: savedHours,
  settings,
  onChange,
  onUpdateSettings,
}: {
  hours: DayHours[];
  settings: BizSettings;
  onChange: (hours: DayHours[]) => void;
  onUpdateSettings: (patch: Partial<BizSettings>) => void;
}) {
  const { toast, user } = useStore();
  const draftKey = "cupito_hours_draft_" + user?.id;
  const [hours, setHours] = useState<DayHours[]>(() => {
    try {
      const draft = JSON.parse(sessionStorage.getItem(draftKey) || "null");
      if (Array.isArray(draft) && draft.length === 7 && draft.every(day => day && typeof day.open === "boolean" && typeof day.from === "string" && typeof day.to === "string")) return draft;
    } catch { /* borrador no disponible */ }
    return savedHours.map((day) => ({ ...day }));
  });
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(hours) !== JSON.stringify(savedHours);
  useEffect(() => {
    try {
      if (dirty) sessionStorage.setItem(draftKey, JSON.stringify(hours));
      else sessionStorage.removeItem(draftKey);
    } catch { /* el formulario sigue disponible sin almacenamiento */ }
  }, [hours, dirty, draftKey]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const set = (i: number, patch: Partial<DayHours>) => {
    const next = hours.map((h, idx) => (idx === i ? { ...h, ...patch } : h));
    setHours(next);
    setError(null);
  };
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <div className="card p-6">
      <h3 className="font-display text-lg font-extrabold text-ink">Días y horarios de atención</h3>
      <p className="mt-1 text-sm text-inkmute">Definí tus horarios y guardá los cambios juntos. Los turnos deben terminar antes del cierre y respetar el corte al mediodía.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            const mon = hours[1];
            const next = hours.map((h, idx) => {
              if (idx >= 1 && idx <= 5) {
                return { ...h, open: mon.open, from: mon.from, to: mon.to, from2: mon.from2, to2: mon.to2 };
              }
              return h;
            });
            setHours(next);
            toast("Lunes copiado a días hábiles. Guardá para aplicar los cambios.");
          }}
          className="btn-press inline-flex items-center gap-1.5 rounded-xl border border-black/[0.08] bg-[#F5F5F7] px-3.5 py-1.5 text-xs font-semibold text-[#1D1D1F] hover:bg-neutral-200/70 shadow-xs"
        >
          <IconSpark className="h-3.5 w-3.5 text-[#16A34A]" />
          <span>Aplicar horario del lunes a días hábiles (Lun-Vie)</span>
        </button>
      </div>
      <div className="mt-5 space-y-3">
        {order.map((i) => {
          const h = hours[i];
          return (
            <div key={i} className={`rounded-xl border p-4 transition-colors ${h.open ? "border-black/[0.08] bg-white" : "border-black/[0.04] bg-[#F5F5F7]/50"}`}>
              <div className="flex flex-wrap items-center gap-3">
                <Toggle on={h.open} onChange={(v) => set(i, { open: v })} label={`Abrir ${DAY_NAMES[i]}`} />
                <span className={`w-24 font-display text-sm font-extrabold ${h.open ? "text-ink" : "text-ink/35"}`}>{DAY_NAMES[i]}</span>
                {h.open && (
                  <span className="flex items-center gap-2 text-sm">
                    <input aria-label={DAY_NAMES[i] + ": apertura"} type="time" className="field !w-auto" value={h.from} onChange={(e) => set(i, { from: e.target.value })} />
                    <span className="text-inkmute">a</span>
                    <input aria-label={DAY_NAMES[i] + ": cierre"} type="time" className="field !w-auto" value={h.to} onChange={(e) => set(i, { to: e.target.value })} />
                  </span>
                )}
                {h.open && !h.from2 && (
                  <button type="button" onClick={() => set(i, { to: "13:00", from2: "15:00", to2: "20:00" })} className="ml-auto rounded-full border border-black/10 px-3 py-1.5 text-xs font-bold text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7]">+ Corte al mediodía</button>
                )}
              </div>
              {h.open && h.from2 && (
                <div className="pop-in mt-3 flex flex-wrap items-center gap-2 border-t border-black/[0.06] pt-3 text-sm">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#16A34A]">Reabre</span>
                  <input aria-label={DAY_NAMES[i] + ": reapertura"} type="time" className="field !w-auto" value={h.from2} onChange={(e) => set(i, { from2: e.target.value })} />
                  <span className="text-inkmute">a</span>
                  <input aria-label={DAY_NAMES[i] + ": segundo cierre"} type="time" className="field !w-auto" value={h.to2 ?? "20:00"} onChange={(e) => set(i, { to2: e.target.value })} />
                  <button type="button" onClick={() => set(i, { from2: undefined, to2: undefined })} className="ml-auto text-xs font-bold text-inkmute underline-offset-4 hover:text-[#1D1D1F] hover:underline">Quitar corte</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-3 z-10 mt-5 rounded-2xl border border-black/[0.08] bg-white/95 backdrop-blur-md p-4 shadow-lg flex flex-wrap items-center justify-between gap-3">
        {error && <p role="alert" className="w-full text-xs font-semibold text-rose-600">{error}</p>}
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!dirty}
            className="rounded-full bg-black hover:bg-neutral-800 px-6 py-2.5 text-xs font-bold text-white shadow-sm disabled:opacity-40 transition-all active:scale-95"
            onClick={() => {
              const issue = validateHours(hours);
              setError(issue);
              if (issue) return;
              onChange(hours);
              toast("Horarios guardados ✓");
            }}
          >
            Guardar horarios
          </button>
          {dirty ? (
            <button
              type="button"
              className="rounded-full border border-black/10 bg-white px-4 py-2.5 text-xs font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors"
              onClick={() => {
                setHours(savedHours.map((day) => ({ ...day })));
                setError(null);
              }}
            >
              Descartar cambios
            </button>
          ) : (
            <span role="status" className="text-xs font-medium text-[#6E6E73]">
              Sin cambios pendientes
            </span>
          )}
        </div>
      </div>
      {/* Anticipación máxima de reservas */}
      <div className="mt-8 border-t border-black/[0.06] pt-6">
        <label className="mb-1 block font-display text-sm font-extrabold text-ink">
          ¿Con cuánta anticipación pueden reservar tus clientes?
        </label>
        <p className="mb-3 text-xs text-inkmute">
          Elegí el límite máximo de días hacia adelante en el calendario para que no saquen turnos con meses de anticipación.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { days: 7, label: "7 días (1 sem)" },
            { days: 14, label: "14 días (2 sem)" },
            { days: 30, label: "30 días (1 mes)" },
            { days: 60, label: "60 días (2 meses)" },
          ].map((opt) => {
            const isSel = (settings.maxAdvanceDays ?? 30) === opt.days;
            return (
              <button
                key={opt.days}
                type="button"
                onClick={() => {
                  onUpdateSettings({ maxAdvanceDays: opt.days });
                  toast(`Límite configurado a ${opt.label} ✓`);
                }}
                className={`btn-press rounded-xl border py-2.5 px-3 text-center font-display text-xs font-bold transition-all ${
                  isSel
                    ? "border-black bg-black text-white shadow-sm"
                    : "border-black/[0.08] bg-white text-ink hover:border-black/20"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Días cerrados / Feriados */}
      <div className="mt-8 border-t border-black/[0.06] pt-6">
        <label className="mb-1 block font-display text-sm font-extrabold text-ink">
          Feriados y Días Cerrados (No Laborables)
        </label>
        <p className="mb-3 text-xs text-inkmute">
          Fechas puntuales donde el negocio no abre. Esos días quedarán deshabilitados en el calendario público y nadie podrá reservar.
        </p>

        <div className="flex flex-wrap gap-2 items-center mb-4">
          <input
            type="date"
            id="closed-date-input"
            className="field !w-auto text-xs font-semibold"
            min={dateKey(new Date())}
          />
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById("closed-date-input") as HTMLInputElement;
              if (el && el.value) {
                const current = settings.closedDates || [];
                if (!current.includes(el.value)) {
                  onUpdateSettings({ closedDates: [...current, el.value].sort() });
                  toast(`Fecha ${fmtLong(el.value)} agregada como cerrada ✓`);
                  el.value = "";
                }
              }
            }}
            className="btn-press rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors"
          >
            + Agregar día cerrado
          </button>
        </div>

        {(settings.closedDates || []).length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {(settings.closedDates || []).map((dt) => (
              <span
                key={dt}
                className="inline-flex items-center gap-2 rounded-xl border border-coral/30 bg-coral/10 px-3 py-1.5 text-xs font-bold text-coral"
              >
                <span>{fmtLong(dt)}</span>
                <button
                  type="button"
                  onClick={() => {
                    const next = (settings.closedDates || []).filter((d) => d !== dt);
                    onUpdateSettings({ closedDates: next });
                    toast("Día cerrado removido.");
                  }}
                  className="hover:text-red-700 font-extrabold ml-1"
                  title="Eliminar"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs italic text-inkmute">No tenés feriados o días cerrados cargados.</p>
        )}
      </div>
    </div>
  );
}

function PlanTab({
  current,
  user,
  onSelect,
}: {
  current: Plan;
  user: NonNullable<ReturnType<typeof useStore>["user"]>;
  onSelect: (p: Plan) => void;
}) {
  const { toast, cancelSubscriptionAsync } = useStore();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const sub = user.subscription;
  const plans: Plan[] = ["semilla", "crece", "escala"];
  const nextDateStr = fmtDateHuman(sub?.nextRenewal || new Date(Date.now() + 30 * 86400000).toISOString());

  const doCancel = async () => {
    setCancelling(true);
    setCancelError(null);
    const r = await cancelSubscriptionAsync();
    setCancelling(false);
    if (!r.ok) {
      setCancelError(`${r.error} Si ya lo cancelaste en Mercado Pago, escribinos a hola@cupito.app y lo resolvemos.`);
      return;
    }
    setConfirmCancel(false);
    toast("Suscripción cancelada en Mercado Pago. No se te cobra más ✓", "warn");
  };

  return (
    <div className="card p-6 space-y-5">
      <div>
        <h3 className="font-display text-lg font-extrabold text-ink">Plan y suscripción de tu negocio</h3>
        <p className="mt-1 text-sm text-inkmute">
          Tu plan determina la cantidad de profesionales, reservas simultáneas y herramientas de cobro de seña.
        </p>
      </div>

      {current !== "semilla" && (
        <div className="rounded-2xl border-2 border-evergreen/30 bg-evergreen/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-display text-sm font-extrabold text-ink">
                Suscripción {PLAN_META[current].name} {sub?.status === "cancelada" ? "(Cancelada)" : "(Activa)"}
              </p>
              <p className="text-xs text-inkmute">
                {sub?.status === "cancelada"
                  ? `Vence el ${nextDateStr}. No se realizarán más cobros.`
                  : `Próxima renovación automática: ${nextDateStr}`}
              </p>
            </div>
            {sub?.status === "cancelada" ? (
              <button
                type="button"
                onClick={() => onSelect(current)}
                className="rounded-full bg-emerald-600 hover:bg-emerald-700 px-4 py-2 font-display text-xs font-bold text-white shadow-sm transition-colors"
              >
                Volver a suscribirme
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmCancel(true)}
                className="rounded-full border-2 border-coral/40 px-4 py-2 font-display text-xs font-bold text-coral hover:bg-coral hover:text-white"
              >
                Cancelar renovación
              </button>
            )}
          </div>

          {confirmCancel && (
            <div className="pop-in mt-3 border-t border-coral/20 pt-3">
              <p className="text-xs text-ink font-bold">¿Confirmás cancelar la renovación automática?</p>
              <p className="mt-1 text-[11px] text-inkmute">Se cancela en Mercado Pago: no se te cobra más. Mantenés el plan hasta el {nextDateStr}.</p>
              {cancelError && <p className="mt-2 rounded-xl border-2 border-coral/40 bg-coral/10 px-3 py-2 text-xs font-semibold text-coral">{cancelError}</p>}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={() => { void doCancel(); }}
                  className="rounded-full bg-coral px-3.5 py-1.5 font-display text-xs font-bold text-white hover:bg-coral/90 disabled:opacity-60"
                >
                  {cancelling ? "Cancelando…" : "Sí, cancelar en Mercado Pago"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmCancel(false)}
                  className="rounded-full border border-ink/20 px-3.5 py-1.5 font-display text-xs font-bold text-ink hover:bg-ink/5"
                >
                  Volver
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        {plans.map((p) => {
          const active = current === p;
          return (
            <div key={p} className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 p-4 transition-all ${active ? "!border-limedeep !bg-lime/20" : "border-ink/12 bg-white/60"}`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-base font-extrabold text-ink">{PLAN_META[p].name}</span>
                  <span className="font-display text-sm font-bold text-fern">{PLAN_META[p].price}</span>
                  {active && <span className="rounded-full bg-emerald-700 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-white">Activo</span>}
                </div>
                <p className="mt-0.5 text-xs text-inkmute">
                  {PLAN_FEATURES[p].join(" · ")}
                </p>
              </div>
              {active ? (
                <span className="rounded-full bg-evergreen/10 px-4 py-2 font-display text-xs font-bold text-evergreen">✓ En uso</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect(p)}
                  className={`rounded-full px-4 py-2 font-display text-xs font-bold transition-all hover:-translate-y-0.5 ${p === "semilla" ? "border-2 border-ink/20 text-ink hover:bg-ink/5" : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"}`}
                >
                  {p === "semilla" ? "Bajar a Semilla" : `Elegir ${PLAN_META[p].name} (Mercado Pago)`}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-inkmute">
        Al hacer clic en un plan pago, se abrirá la pasarela segura de Mercado Pago para procesar la suscripción mensual o anual.
      </p>
    </div>
  );
}

function AccountTab() {
  const { logout, deleteAccount, toast } = useStore();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="card border-2 border-coral/30 p-6">
      <h3 className="font-display text-lg font-extrabold text-ink">Zona de riesgo</h3>
      <p className="mt-1 text-sm text-inkmute">Estas acciones no se pueden deshacer.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button onClick={() => { logout(); window.location.hash = "#/"; }} className="inline-flex items-center gap-2 rounded-full border-2 border-ink/20 px-5 py-2.5 font-display text-sm font-bold text-ink transition-all hover:border-evergreen hover:text-evergreen">
          <IconLogout className="h-4 w-4" /> Cerrar sesión
        </button>
        {!confirm ? (
          <button onClick={() => setConfirm(true)} className="inline-flex items-center gap-2 rounded-full border-2 border-coral/50 px-5 py-2.5 font-display text-sm font-bold text-coral transition-all hover:bg-coral hover:text-white">
            <IconTrash className="h-4 w-4" /> Eliminar cuenta
          </button>
        ) : (
          <span className="inline-flex items-center gap-2">
            <button onClick={() => { deleteAccount(); toast("Cuenta eliminada. ¡Hasta pronto!", "warn"); window.location.hash = "#/"; }} className="rounded-full bg-coral px-5 py-2.5 font-display text-sm font-bold text-white transition-all hover:-translate-y-0.5">Sí, eliminar todo</button>
            <button onClick={() => setConfirm(false)} className="rounded-full border-2 border-ink/20 px-5 py-2.5 font-display text-sm font-bold text-inkmute transition-colors hover:text-ink">Mejor no</button>
          </span>
        )}
      </div>
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!on)} aria-label={label} aria-pressed={on}
      className={`relative h-8 w-[52px] shrink-0 rounded-full transition-colors duration-200 ${on ? "bg-fern shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)]" : "bg-ink/20"}`}>
      <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all duration-200 ${on ? "left-[22px]" : "left-1"}`} />
    </button>
  );
}
