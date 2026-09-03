import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
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
  isPaid,
  PLAN_META,
  PRO_LIMIT,
  defaultHours,
  THEMES,
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
import {
  clearPendingCheckout,
  confirmMercadoPago,
  getHashParam,
  getPreapprovalIdFromUrl,
  readPendingCheckout,
  requestCheckout,
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
  const [view, setView] = useState<View>("hoy");
  const [selDate, setSelDate] = useState(dateKey(new Date()));
  const [weekStart, setWeekStart] = useState(0);
  const [showNew, setShowNew] = useState(false);
  const [rescheduling, setRescheduling] = useState<Booking | null>(null);
  const [prefill, setPrefill] = useState<{ client: string; phone: string; serviceId?: string; waitlistId?: string } | null>(null);
  const [serviceModal, setServiceModal] = useState<{ open: boolean; id?: string }>({ open: false });
  const [filter, setFilter] = useState<"todas" | BookingStatus>("todas");
  const [proFilter, setProFilter] = useState<string>("todos");
  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [reservasMode, setReservasMode] = useState<"lista" | "grilla">("lista");
  const [gridDate, setGridDate] = useState(dateKey(new Date()));
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockPrefillTime, setBlockPrefillTime] = useState<string | undefined>(undefined);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const checkout = getHashParam("checkout");
      if (checkout === "crece" || checkout === "escala" || checkout === "semilla") {
        setCheckoutPlan(checkout);
      }

      const onboardingParam = getHashParam("onboarding") || getHashParam("setup");
      if (onboardingParam === "1" || (data && data.services.length === 0 && !data.settings.setupDismissed)) {
        setShowOnboarding(true);
      }

      const preapprovalId = getPreapprovalIdFromUrl();
      if (!preapprovalId) return;
      const result = await confirmMercadoPago(preapprovalId);
      if (cancelled) return;
      if (result.authorized) {
        const plan = result.plan || readPendingCheckout()?.plan || "crece";
        store.setPlan(plan);
        clearPendingCheckout();
        store.toast(`Pago confirmado. Ya estás en el plan ${PLAN_META[plan].name} ✓`);
        if (user.email) {
          sendSubscriptionWelcomeEmail({
            toEmail: user.email,
            ownerName: user.name,
            businessName: user.business,
            planName: PLAN_META[plan].name,
            planPrice: PLAN_META[plan].price,
            slug: user.slug,
          }).catch(() => {});
        }
      } else if (result.error) {
        store.toast(result.error, "warn");
      } else {
        store.toast("Mercado Pago todavía no autorizó el pago. Si ya pagaste, recargá en un momento.", "warn");
      }
      if (window.location.search.includes("preapproval")) {
        const url = new URL(window.location.href);
        url.searchParams.delete("preapproval_id");
        url.searchParams.delete("preapprovalId");
        url.searchParams.delete("preapproval");
        window.history.replaceState({}, "", url.pathname + url.hash.split("?")[0]);
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

  const dayIncome = dayBookings
    .filter((b) => b.status === "confirmada" || b.status === "atendida")
    .reduce((acc, b) => acc + (data.services.find((s) => s.id === b.serviceId)?.price ?? 0), 0);

  const daySlots = slotsForDay(data.settings.hours[dayOfWeek(selDate)]);
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

  const serviceOf = (id: string) => data.services.find((s) => s.id === id);

  const title: Record<View, [string, string]> = {
    hoy: ["Agenda del día", "Lo que pasa hoy en tu negocio, en una mirada."],
    reservas: ["Todas las reservas", "Próximos turnos, ordenados y filtrables."],
    clientes: ["Ficha de Clientes", "Historial consolidado, datos de contacto y notas privadas."],
    lista: ["Lista de espera", "Clientes que quieren venir pero encontraron el día lleno."],
    stats: ["Estadísticas", "Cómo le va a tu negocio, en tiempo real."],
    servicios: ["Servicios", "Lo que ofrecés y cuánto cobrás."],
    equipo: ["Tu equipo", "Los profesionales que atienden en tu negocio."],
    tienda: ["Tienda de productos", "Vendé tus productos junto con cada turno."],
    promos: ["Cupones", "Descuentos opcionales para llenar tus horarios."],
    pagina: ["Mi página de reservas", "Tu link público. Compartilo donde quieras."],
    suscripcion: ["Plan y suscripción", "Tu plan actual y cómo lo pagás."],
    ajustes: ["Ajustes", "Tu negocio, tu cuenta, tus reglas."],
  };

  const viewTitle = title[view] || ["Panel de Control", "Administrá tu negocio."];

  const sectionOf = (v: View) => SECTIONS.find((s) => s.items.some((i) => i.id === v))?.label ?? "";

  return (
    <div className="app-bg flex min-h-screen flex-col">
      {!store.isCloudSyncActive && (
        <div className="sticky top-0 z-50 flex w-full items-center justify-center gap-3 bg-amber-400 px-4 py-2 text-center text-ink">
          <p className="text-sm font-bold">⚠️ Estás en modo local (nube no conectada: {getSupabaseStatus().reason}). Lo que cargues acá NO se ve en el celu. Hacé Redeploy en Vercel después de agregar las variables.</p>
        </div>
      )}
      {impersonating && (
        <div className="sticky top-0 z-50 flex w-full items-center justify-center gap-3 bg-coral px-4 py-2 text-center text-white">
          <IconUsers className="h-4 w-4 shrink-0" />
          <p className="text-sm font-bold">Modo soporte: estás dentro de <strong>{user.business}</strong>. Los cambios afectan su cuenta.</p>
          <button onClick={() => { stopImpersonating(); window.location.hash = "#/central"; }} className="shrink-0 rounded-full bg-white px-3.5 py-1 text-xs font-bold text-coral transition-all hover:-translate-y-0.5">Salir</button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* ---------- sidebar ---------- */}
        <aside className="sticky top-0 z-40 hidden h-screen w-64 shrink-0 flex-col bg-evergreen text-paper lg:flex">
          <a href="#/" className="flex items-center gap-2.5 px-6 pb-5 pt-7">
            <LogoMark className="h-9 w-9 text-fern" />
            <span className="font-display text-2xl font-bold tracking-tight">cupito<span className="text-lime">.</span></span>
          </a>
          <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
            {SECTIONS.map((sec) => (
              <div key={sec.label}>
                <p className="px-4 pb-1.5 text-[10px] font-extrabold uppercase tracking-[0.2em] text-paper/35">{sec.label}</p>
                <div className="space-y-0.5">
                  {sec.items.map((n) => {
                    const active = view === n.id;
                    return (
                      <button key={n.id} onClick={() => setView(n.id)}
                        className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition-all duration-200 ${active ? "bg-lime text-ink shadow-[3px_3px_0_rgba(205,244,99,0.25)]" : "text-paper/65 hover:bg-paper/10 hover:text-paper"}`}>
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${active ? "bg-evergreen text-lime" : "bg-paper/10 text-paper/70"}`}>{n.icon({ className: "h-4 w-4" })}</span>
                        <span className="min-w-0 flex-1 truncate">{n.label}</span>
                        {n.id === "lista" && data.waitlist.length > 0 && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-coral px-1.5 text-[10px] font-extrabold text-white">{data.waitlist.length}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
          <div className="border-t border-paper/10 p-4">
            <a href={`/${user.slug}`} target="_blank" rel="noreferrer" className="mb-2 flex w-full items-center justify-center gap-2 rounded-full bg-lime py-2.5 font-display text-sm font-bold text-ink transition-all hover:-translate-y-0.5 hover:bg-limedeep">
              <IconLink className="h-4 w-4" /> Ver mi página
            </a>
            <div className="flex items-center gap-3 rounded-xl bg-pine/70 p-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lime font-display text-xs font-bold text-ink">
                {user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-display text-sm font-bold">{user.business}</span>
                <span className="block truncate text-xs text-paper/50">Plan {PLAN_META[user.plan].name}</span>
              </span>
            </div>
          </div>
        </aside>

        {/* ---------- main ---------- */}
        <div className="min-w-0 flex-1">
          {/* topbar mobile */}
          <div className="sticky top-0 z-40 border-b border-ink/10 bg-evergreen text-paper lg:hidden">
            <div className="flex items-center justify-between px-5 py-3">
              <a href="#/" className="flex items-center gap-2">
                <LogoMark className="h-8 w-8 text-fern" />
                <span className="font-display text-xl font-bold">cupito<span className="text-lime">.</span></span>
              </a>
              <a href={`/${user.slug}`} className="rounded-full bg-lime px-4 py-1.5 font-display text-xs font-bold text-ink">Mi página</a>
            </div>
            <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-3">
              {SECTIONS.flatMap((s) => s.items).map((n) => (
                <button key={n.id} onClick={() => setView(n.id)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${view === n.id ? "bg-lime text-ink" : "bg-paper/10 text-paper/70"}`}>
                  {n.label}
                  {n.id === "lista" && data.waitlist.length > 0 && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-coral px-1 text-[9px] font-extrabold text-white">{data.waitlist.length}</span>}
                </button>
              ))}
            </div>
          </div>

          <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/10 pb-6">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-ink/35">Panel · {sectionOf(view)}</p>
                  <CopyButton
                    text={`https://cupito.app/${user.slug}`}
                    label="Copiar mi link"
                    copiedLabel="¡Link copiado!"
                    className="border border-ink/15 shadow-none hover:border-ink/40"
                  />
                </div>
                <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{viewTitle[0]}</h1>
                <p className="mt-1 text-sm text-inkmute">{viewTitle[1]}</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/${user.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-press hidden sm:inline-flex items-center gap-1.5 rounded-full border-2 border-ink/15 bg-white/70 px-4 py-2 font-display text-xs font-bold text-ink hover:bg-white hover:border-ink/40"
                >
                  <IconLink className="h-3.5 w-3.5" /> Ver mi página ↗
                </a>
                <button
                  onClick={() => { setPrefill(null); setShowNew(true); }}
                  className="btn-press group inline-flex items-center gap-2 rounded-full bg-coral px-5 py-2.5 font-display text-sm font-bold text-white shadow-block-coral hover:bg-coral/90 active:translate-y-0"
                >
                  <IconPlus className="h-4 w-4" /> Nueva reserva
                </button>
              </div>
            </div>

            {view === "hoy" && <SetupGuide onGo={(v) => setView(v)} onCheckout={(p) => setCheckoutPlan(p)} onOpenOnboarding={() => setShowOnboarding(true)} />}

            {pendingClaims > 0 && (
              <div className="pop-in mt-6 flex items-center gap-3 rounded-xl border-2 border-coral/40 bg-coral/10 px-4 py-3">
                <IconBell className="h-5 w-5 shrink-0 text-coral" />
                <p className="flex-1 text-sm font-semibold text-ink">
                  {pendingClaims} seña{pendingClaims === 1 ? "" : "s"} esperando tu verificación — revisá tu homebanking y acreditá o rechazá desde Reservas.
                </p>
              </div>
            )}

            {/* ============ HOY ============ */}
            {view === "hoy" && (
              <div className="pop-in mt-8">
                <div className="flex items-center gap-2">
                  <button onClick={() => setWeekStart((w) => w - 7)} aria-label="Semana anterior" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ink/12 bg-card text-ink transition-all hover:-translate-x-0.5 hover:border-evergreen"><IconChevron className="h-4 w-4 rotate-180" /></button>
                  <div className="no-scrollbar flex flex-1 gap-2 overflow-x-auto py-1">
                    {week.map((d) => {
                      const k = dateKey(d);
                      const count = data.bookings.filter((b) => b.date === k && b.status !== "cancelada").length;
                      const isSel = selDate === k;
                      return (
                        <button key={k} onClick={() => setSelDate(k)}
                          className={`flex min-w-[72px] flex-col items-center rounded-xl border-2 px-3 py-2.5 transition-all duration-200 ${isSel ? "border-evergreen bg-evergreen text-lime shadow-[4px_4px_0_rgba(205,244,99,0.35)]" : "border-ink/12 bg-card text-ink hover:-translate-y-0.5 hover:border-evergreen"}`}>
                          <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{k === today ? "Hoy" : d.toLocaleDateString("es-ES", { weekday: "short" }).slice(0, 3)}</span>
                          <span className="font-display text-xl font-extrabold leading-tight">{d.getDate()}</span>
                          <span className={`mt-0.5 rounded-full px-2 text-[10px] font-bold ${isSel ? "bg-lime text-ink" : count > 0 ? "bg-lime/60 text-ink" : "bg-ink/8 text-ink/40"}`}>{count} turno{count === 1 ? "" : "s"}</span>
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={() => setWeekStart((w) => w + 7)} aria-label="Semana siguiente" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ink/12 bg-card text-ink transition-all hover:translate-x-0.5 hover:border-evergreen"><IconChevron className="h-4 w-4" /></button>
                </div>
                <button onClick={() => { setWeekStart(0); setSelDate(today); }} className="mt-1 text-xs font-bold text-fern underline-offset-4 hover:underline">Ir a hoy</button>

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <StatCard label="Turnos del día" value={String(dayBookings.filter((b) => b.status !== "cancelada").length)} icon={<IconClock className="h-5 w-5" />} />
                  <StatCard label="Ingresos asegurados" value={fmtMoney(dayIncome)} icon={<IconWallet className="h-5 w-5" />} accent />
                  <StatCard label="Ocupación" value={`${occupancy}%`} icon={<IconChart className="h-5 w-5" />} />
                </div>

                {data.professionals.length > 0 && (
                  <div className="mt-6 flex flex-wrap gap-2">
                    <button onClick={() => setProFilter("todos")} className={`rounded-full border-2 px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${proFilter === "todos" ? "border-evergreen bg-evergreen text-lime" : "border-ink/12 bg-card text-inkmute hover:border-evergreen"}`}>Todos</button>
                    {data.professionals.map((p) => (
                      <button key={p.id} onClick={() => setProFilter(p.id)} className={`rounded-full border-2 px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${proFilter === p.id ? "border-evergreen bg-evergreen text-lime" : "border-ink/12 bg-card text-inkmute hover:border-evergreen"}`}>{p.name}</button>
                    ))}
                  </div>
                )}

                <p className="mt-8 font-display text-lg font-bold text-ink">
                  {fmtLong(selDate)}
                  <span className="ml-2 text-sm font-semibold text-inkmute">{dayBookings.length === 0 ? "· sin turnos todavía" : `· ${dayBookings.length} reserva${dayBookings.length === 1 ? "" : "s"}`}</span>
                </p>

                {dayBookings.length === 0 ? (
                  <EmptyState text="Nadie reservó este día… todavía." sub="Creá una reserva manual o compartí tu link para que lleguen solas."
                    action={<button onClick={() => { setPrefill(null); setShowNew(true); }} className="inline-flex items-center gap-2 rounded-full bg-evergreen px-5 py-2.5 font-display text-sm font-bold text-lime transition-all hover:-translate-y-0.5"><IconPlus className="h-4 w-4" /> Crear reserva</button>} />
                ) : (
                  <div className="mt-4 space-y-3">
                    {dayBookings.map((b) => (
                      <BookingRow key={b.id} b={b} service={serviceOf(b.serviceId)} pro={data.professionals.find((p) => p.id === b.proId)} products={data.products} businessName={user.business}
                        onStatus={(id, s) => {
                          setStatus(id, s);
                          if (s === "atendida") { requestReview(id); toast("Turno atendido · le enviamos el link de reseña a su email 💌"); }
                          else toast(s === "cancelada" ? "Turno cancelado. El hueco quedó libre." : "Turno confirmado.");
                        }}
                        onDelete={(id) => { removeBooking(id); toast("Reserva eliminada.", "warn"); }}
                        onVerify={(id) => { store.markDepositPaid(id, "transferencia"); sound.playSuccess(); toast("Seña acreditada ✓"); }}
                        onReject={(id) => { store.rejectDeposit(id); toast("Comprobante rechazado. El cliente puede reenviarlo.", "warn"); }}
                        onReschedule={(b) => setRescheduling(b)}
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
              </div>
            )}

            {/* ============ RESERVAS ============ */}
            {/* ============ RESERVAS ============ */}
            {view === "reservas" && (
              <div className="pop-in mt-8 space-y-6">
                {/* Barra de herramientas operativa */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex rounded-xl border border-ink/12 bg-card p-1 shadow-sm">
                      <button
                        type="button"
                        onClick={() => setReservasMode("lista")}
                        className={`rounded-lg px-3 py-1.5 font-display text-xs font-bold transition-all ${
                          reservasMode === "lista"
                            ? "bg-evergreen text-lime shadow-sm"
                            : "text-inkmute hover:text-ink"
                        }`}
                      >
                        📋 Lista
                      </button>
                      <button
                        type="button"
                        onClick={() => setReservasMode("grilla")}
                        className={`rounded-lg px-3 py-1.5 font-display text-xs font-bold transition-all ${
                          reservasMode === "grilla"
                            ? "bg-evergreen text-lime shadow-sm"
                            : "text-inkmute hover:text-ink"
                        }`}
                      >
                        📊 Grilla Horaria
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setBlockPrefillTime(undefined);
                        setShowBlockModal(true);
                      }}
                      className="btn-press flex items-center gap-1.5 rounded-xl border border-ink/15 bg-card px-3 py-1.5 font-display text-xs font-bold text-ink hover:border-coral hover:text-coral transition-colors"
                    >
                      🚫 Bloquear horario
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
                      className="btn-press flex items-center gap-1.5 rounded-xl border border-ink/15 bg-card px-3 py-1.5 font-display text-xs font-bold text-ink hover:border-evergreen hover:text-evergreen transition-colors"
                      title="Exportar todas las reservas con formato compatible con Excel"
                    >
                      📥 Exportar Excel (.csv)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPrefill(null);
                        setShowNew(true);
                      }}
                      className="btn-press flex items-center gap-1.5 rounded-xl bg-evergreen px-3.5 py-1.5 font-display text-xs font-bold text-lime shadow-sm hover:bg-pine"
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
                        <span className="text-xs font-bold uppercase tracking-wider text-inkmute">Día:</span>
                        <input
                          type="date"
                          className="field !w-auto !py-1.5 !text-xs font-semibold"
                          value={gridDate}
                          onChange={(e) => setGridDate(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setGridDate(today)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-bold ${gridDate === today ? "bg-evergreen text-lime" : "bg-ink/8 text-inkmute hover:text-ink"}`}
                        >
                          Hoy
                        </button>
                        <button
                          type="button"
                          onClick={() => setGridDate(dateKey(addDays(new Date(), 1)))}
                          className="rounded-lg bg-ink/8 px-2.5 py-1 text-xs font-bold text-inkmute hover:text-ink"
                        >
                          Mañana
                        </button>
                      </div>
                      <p className="font-display text-sm font-bold text-ink">{fmtLong(gridDate)}</p>
                    </div>

                    <TimeGridView
                      date={gridDate}
                      bookings={data.bookings}
                      blockedSlots={data.blockedSlots || []}
                      services={data.services}
                      pros={data.professionals}
                      hours={data.settings.hours}
                      onBookSlot={() => {
                        setPrefill(null);
                        setSelDate(gridDate);
                        setShowNew(true);
                      }}
                      onBlockSlot={(timeSlot) => {
                        setBlockPrefillTime(timeSlot);
                        setShowBlockModal(true);
                      }}
                      onUnblockSlot={(id) => {
                        removeBlockedSlot(id);
                        toast("Horario desbloqueado ✓");
                      }}
                      onReschedule={(b) => setRescheduling(b)}
                      businessName={user.business}
                    />
                  </div>
                ) : (
                  <div>
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                      <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
                        {(["todas", "pendiente", "confirmada", "atendida", "cancelada"] as const).map((f) => {
                          const count = f === "todas" ? data.bookings.length : data.bookings.filter((b) => b.status === f).length;
                          return (
                            <button
                              key={f}
                              onClick={() => setFilter(f)}
                              className={`btn-press whitespace-nowrap rounded-full border-2 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${filter === f ? "border-evergreen bg-evergreen text-lime" : "border-ink/12 bg-card text-inkmute hover:border-evergreen"}`}
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
                            className="inline-flex items-center gap-2 rounded-full bg-evergreen px-5 py-2.5 font-display text-sm font-bold text-lime transition-all hover:-translate-y-0.5"
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
                                      requestReview(id);
                                      toast("Turno atendido · link de reseña enviado 💌");
                                    } else toast("Estado actualizado.");
                                  }}
                                  onDelete={(id) => {
                                    removeBooking(id);
                                    toast("Reserva eliminada.", "warn");
                                  }}
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
              <ClientsCRMView
                bookings={data.bookings}
                services={data.services}
                clientNotes={data.settings.clientNotes || {}}
                onSaveNote={(phone, note) => {
                  saveClientNote(phone, note);
                  toast("Nota privada guardada ✓");
                }}
                businessName={user.business}
              />
            )}

            {/* ============ LISTA DE ESPERA ============ */}
            {view === "lista" && (
              <div className="pop-in mt-8">
                {data.waitlist.length === 0 ? (
                  <EmptyState text="No hay nadie en lista de espera." sub="Cuando un cliente no encuentre horario, se va a anotar acá y te aparece con el número en el menú." />
                ) : (
                  <div className="space-y-6">
                    {Object.entries([...data.waitlist].sort((a, b) => a.date.localeCompare(b.date)).reduce<Record<string, typeof data.waitlist>>((acc, w) => { (acc[w.date] ||= []).push(w); return acc; }, {})).map(([d, list]) => (
                      <div key={d}>
                        <p className="font-display text-base font-bold text-ink">{fmtLong(d)}<span className="ml-2 text-sm font-semibold text-inkmute">{list.length} esperando</span></p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {list.map((w) => (
                            <div key={w.id} className="card flex items-center justify-between gap-3 p-4">
                              <div>
                                <p className="font-display text-[15px] font-bold text-ink">{w.client}</p>
                                <p className="text-xs text-inkmute">{w.phone} · {serviceOf(w.serviceId)?.name ?? "Servicio"}</p>
                              </div>
                              <div className="flex shrink-0 gap-1.5">
                                <button onClick={() => { setPrefill({ client: w.client, phone: w.phone, serviceId: w.serviceId, waitlistId: w.id }); setShowNew(true); }}
                                  className="rounded-full bg-evergreen px-4 py-2 font-display text-xs font-bold text-lime transition-all hover:-translate-y-0.5 hover:bg-pine">Darle turno</button>
                                <button onClick={() => { store.removeWaitlist(w.id); toast("Quitado de la lista.", "warn"); }} aria-label="Quitar"
                                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink/15 text-inkmute transition-colors hover:border-coral hover:text-coral"><IconTrash className="h-3.5 w-3.5" /></button>
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
                        <div className="flex gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                          <button onClick={() => setServiceModal({ open: true, id: s.id })} aria-label={`Editar ${s.name}`} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink/15 text-inkmute transition-colors hover:border-evergreen hover:text-evergreen"><IconPencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => { store.removeService(s.id); toast(`"${s.name}" eliminado.`, "warn"); }} aria-label={`Eliminar ${s.name}`} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink/15 text-inkmute transition-colors hover:border-coral hover:text-coral"><IconTrash className="h-3.5 w-3.5" /></button>
                        </div>
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
            {view === "equipo" && <TeamView />}

            {/* ============ TIENDA ============ */}
            {view === "tienda" && (
              <div className="pop-in mt-8">
                {!isPaid(user) ? (
                  <LockedFeature icon={<IconBag className="h-7 w-7" />} title="La tienda es parte del plan Crece"
                    desc="Tus clientes ven tus productos justo cuando reservan: el momento de mayor intención de compra. En promedio, un 20% agrega algo al turno."
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
                <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
                  <div>
                    <div className="rounded-2xl border-2 border-ink/12 bg-evergreen p-6 text-paper shadow-block">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-lime">Tu link de reservas</p>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-lime px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-ink">
                          <span className="blinkdot h-1.5 w-1.5 rounded-full bg-fern" /> En línea
                        </span>
                      </div>
                      <p className="mt-4 break-all font-display text-2xl font-extrabold text-lime sm:text-3xl">cupito.app/{user.slug}</p>
                      <div className="mt-5 flex flex-wrap gap-2.5">
                        <button onClick={() => { const url = `https://cupito.app/${user.slug}`; navigator.clipboard?.writeText(url).then(() => toast("Link copiado 📋"), () => toast(url, "warn")); }}
                          className="rounded-full bg-lime px-5 py-2.5 font-display text-sm font-bold text-ink transition-all hover:-translate-y-0.5 hover:bg-limedeep">Copiar link</button>
                        <button
                          onClick={() => setShowShareModal(true)}
                          className="rounded-full border-2 border-lime bg-lime/15 px-4 py-2.5 font-display text-sm font-bold text-lime transition-all hover:bg-lime hover:text-ink"
                        >
                          💬 Mensajes WhatsApp / Instagram
                        </button>
                        <a href={`/${user.slug}`} target="_blank" rel="noreferrer" className="rounded-full border-2 border-paper/25 px-5 py-2.5 font-display text-sm font-bold text-paper transition-all hover:border-lime hover:text-lime">Abrir mi página ↗</a>
                      </div>
                    </div>
                    <div className="card mt-5 p-5">
                      <p className="font-display text-base font-extrabold text-ink">QR para tu mostrador</p>
                      <p className="mt-1 text-sm text-inkmute">Imprimilo en hoja A4: los que esperan reservan la próxima en el momento.</p>
                      <div className="mt-3"><QrBlock url={`https://cupito.app/${user.slug}`} onPrint={() => setShowPrintModal(true)} /></div>
                    </div>
                  </div>
                  <div>
                    <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-inkmute">
                      <IconSpark className="h-4 w-4 text-coral" /> Así lo ven tus clientes — probalo en vivo
                    </p>
                    <PublicBooking />
                    <p className="mt-4 rounded-xl bg-ink/5 px-4 py-3 text-sm text-inkmute">
                      💡 Reservá un turno acá y mirá cómo aparece <strong className="text-ink">al instante</strong> en tu Agenda del día.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ============ SUSCRIPCIÓN ============ */}
            {view === "suscripcion" && (
              <SubscriptionView current={user.plan} user={user} onSelect={(p) => setCheckoutPlan(p)} />
            )}

            {/* ============ AJUSTES ============ */}
            {view === "ajustes" && (
              <SettingsView user={user} settings={data.settings} onSaveProfile={(b, n) => { saveProfile(b, n); toast("Perfil actualizado ✓"); }} onSelectPlan={(p) => setCheckoutPlan(p)} />
            )}
          </main>
        </div>
      </div>

      {showNew && <BookingModal initialDate={selDate} initialClient={prefill?.client} initialPhone={prefill?.phone} initialServiceId={prefill?.serviceId} waitlistId={prefill?.waitlistId} onClose={() => { setShowNew(false); setPrefill(null); }} />}
      {serviceModal.open && <ServiceModal service={serviceModal.id ? data.services.find((s) => s.id === serviceModal.id) : undefined} onClose={() => setServiceModal({ open: false })} />}
      {checkoutPlan && <PlanCheckout plan={checkoutPlan} onClose={() => setCheckoutPlan(null)} />}
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
              toast(`Turno de ${rescheduling.client} reprogramado para el ${fmtLong(newDate)} a las ${newTime} hs 🎉`);
              setRescheduling(null);
            }
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

      {/* Botón flotante móvil para agendar turno rápido */}
      <div className="fixed bottom-5 right-5 z-40 sm:hidden pop-in">
        <button
          onClick={() => { setPrefill(null); setShowNew(true); sound.playPop(); }}
          className="btn-press flex items-center gap-2 rounded-full bg-evergreen px-4 py-3 font-display text-xs font-black text-lime shadow-xl shadow-evergreen/40 border-2 border-lime/30 active:scale-95"
          aria-label="Nuevo turno rápido"
        >
          <IconPlus className="h-4 w-4" />
          <span>+ Turno</span>
        </button>
      </div>
    </div>
  );
}

/* ================= subcomponentes ================= */

function StatCard({ label, value, icon, accent = false }: { label: string; value: string; icon: ReactNode; accent?: boolean }) {
  return (
    <div className={`card card-hover flex items-center gap-4 p-5 ${accent ? "!border-limedeep/70 !bg-lime/25" : ""}`}>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent ? "bg-evergreen text-lime" : "bg-ink/8 text-fern"}`}>{icon}</span>
      <span>
        <span className="block text-xs font-bold uppercase tracking-wider text-inkmute">{label}</span>
        <span className="font-display text-2xl font-extrabold text-ink">{value}</span>
      </span>
    </div>
  );
}

function EmptyState({ text, sub, action }: { text: string; sub: string; action?: ReactNode }) {
  return (
    <div className="mt-5 flex flex-col items-center rounded-2xl border-2 border-dashed border-ink/20 bg-card/60 px-6 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink/8 text-ink/40"><IconCalendar className="h-7 w-7" /></span>
      <p className="mt-4 font-display text-xl font-extrabold text-ink">{text}</p>
      <p className="mt-1 max-w-sm text-sm text-inkmute">{sub}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function SetupGuide({ onGo, onCheckout, onOpenOnboarding }: { onGo: (v: View) => void; onCheckout: (p: Plan) => void; onOpenOnboarding: () => void }) {
  const { user, data, updateSettings } = useStore();
  if (!user || !data || data.settings.setupDismissed) return null;

  const steps: { id: string; done: boolean; title: string; hint: string; go: () => void }[] = [
    { id: "servicio", done: data.services.length > 0, title: "Cargá tu primer servicio", hint: "Nombre, precio y duración. Es lo que ven tus clientes.", go: () => onGo("servicios") },
    { id: "horarios", done: JSON.stringify(data.settings.hours) !== JSON.stringify(defaultHours()), title: "Confirmá días y horarios", hint: "Los turnos se arman solos con esto según cuándo abras.", go: () => onGo("ajustes") },
    { id: "pagina", done: !!(data.settings.whatsapp || data.settings.description || data.settings.address), title: "Completá tu página", hint: "WhatsApp, dirección o una descripción corta.", go: () => onGo("ajustes") },
    { id: "plan", done: user.plan !== "semilla", title: "Elegí un plan", hint: user.plan === "semilla" ? "Estás en Semilla (gratis). Crece y Escala se pagan con Mercado Pago." : `Plan activo: ${PLAN_META[user.plan].name}.`, go: () => onCheckout("crece") },
  ];
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;

  return (
    <div className="pop-in mt-8 overflow-hidden rounded-[22px] border-2 border-evergreen bg-evergreen text-paper shadow-block">
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 pt-6">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-lime/20 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.2em] text-lime">
            <IconSpark className="h-3.5 w-3.5" /> Primeros pasos
          </span>
          <h2 className="mt-2 font-display text-2xl font-extrabold">Tu local está listo para configurarse</h2>
          <p className="mt-1 text-sm text-paper/70">En pocos minutos tenés tus servicios, horarios y tu link listo para compartir.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onOpenOnboarding} className="rounded-full bg-lime px-4 py-2 font-display text-xs font-bold text-ink transition-all hover:bg-limedeep shadow-sm">
            ✨ Abrir Asistente
          </button>
          <button type="button" onClick={() => updateSettings({ setupDismissed: true })} className="text-xs font-bold text-paper/50 underline-offset-4 hover:text-lime hover:underline">Ocultar</button>
        </div>
      </div>
      <div className="mt-3 px-6 pb-2">
        <div className="h-1.5 overflow-hidden rounded-full bg-paper/15">
          <div className="h-full rounded-full bg-lime transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
        </div>
        <p className="mt-2 text-xs font-bold text-paper/55">{done} de {steps.length} listos</p>
      </div>
      <ul className="divide-y divide-paper/10">
        {steps.map((s, i) => (
          <li key={s.id}>
            <button type="button" onClick={s.go} className="flex w-full items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-paper/8">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${s.done ? "bg-lime text-ink" : "bg-paper/10 text-paper"}`}>
                {s.done ? <IconCheck className="h-4 w-4" /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block font-display text-sm font-bold ${s.done ? "text-paper/50 line-through" : "text-paper"}`}>{s.title}</span>
                <span className="block text-xs text-paper/55">{s.hint}</span>
              </span>
              {!s.done && <IconArrow className="h-4 w-4 shrink-0 text-lime" />}
            </button>
          </li>
        ))}
      </ul>
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
    toast("¡Felicitaciones! Tu agenda ya está lista para recibir reservas 🎉");
    onClose();
  };

  const copyLink = () => {
    void navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast("Link copiado al portapapeles 📋");
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-ink/65 p-4 backdrop-blur-[3px]" onClick={onClose}>
      <div className="pop-in max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[24px] border-2 border-ink/15 bg-card p-6 text-ink shadow-block sm:p-8" onClick={(e) => e.stopPropagation()}>
        {/* Header con pasos */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-lime/25 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-evergreen">
              🚀 Configuración inicial · Paso {step + 1} de 3
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
                  <div key={dayIdx} className={`flex items-center justify-between rounded-xl border-2 p-3 transition-colors ${h.open ? "border-ink/12 bg-white/70" : "border-ink/8 bg-ink/[0.03] opacity-60"}`}>
                    <div className="flex items-center gap-3">
                      <Toggle
                        on={h.open}
                        onChange={(v) => {
                          const next = [...hours];
                          next[dayIdx] = { ...next[dayIdx], open: v };
                          setHours(next);
                        }}
                        label={`Abrir ${DAY_NAMES[dayIdx]}`}
                      />
                      <span className={`font-display text-xs font-bold sm:text-sm ${h.open ? "text-ink" : "text-inkmute"}`}>
                        {DAY_NAMES[dayIdx]}
                      </span>
                    </div>
                    {h.open ? (
                      <div className="flex items-center gap-1.5 text-xs">
                        <input
                          type="time"
                          className="field !h-8 !w-auto !py-1 !text-xs"
                          value={h.from}
                          onChange={(e) => {
                            const next = [...hours];
                            next[dayIdx] = { ...next[dayIdx], from: e.target.value };
                            setHours(next);
                          }}
                        />
                        <span className="text-inkmute">a</span>
                        <input
                          type="time"
                          className="field !h-8 !w-auto !py-1 !text-xs"
                          value={h.to}
                          onChange={(e) => {
                            const next = [...hours];
                            next[dayIdx] = { ...next[dayIdx], to: e.target.value };
                            setHours(next);
                          }}
                        />
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-inkmute">Cerrado</span>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={saveHoursAndNext}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-evergreen py-4 font-display text-base font-bold text-lime transition-all hover:-translate-y-0.5 hover:bg-pine shadow-block-ink"
            >
              Guardar horarios y continuar <IconArrow className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Paso 1: Primer Servicio */}
        {step === 1 && (
          <div className="pop-in mt-6 space-y-4">
            <div>
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
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Precio (ARS)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-inkmute">$</span>
                  <input
                    type="number"
                    className="field !pl-8"
                    placeholder="10000"
                    value={servicePrice}
                    onChange={(e) => setServicePrice(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Duración</label>
                <select
                  className="field cursor-pointer"
                  value={serviceDuration}
                  onChange={(e) => setServiceDuration(e.target.value)}
                >
                  <option value="15">15 minutos</option>
                  <option value="30">30 minutos</option>
                  <option value="45">45 minutos</option>
                  <option value="60">60 minutos (1 h)</option>
                  <option value="90">90 minutos (1.5 h)</option>
                  <option value="120">120 minutos (2 h)</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={saveServiceAndNext}
                disabled={!serviceName.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-evergreen py-4 font-display text-base font-bold text-lime transition-all hover:-translate-y-0.5 hover:bg-pine disabled:opacity-50 shadow-block-ink"
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
            <div className="rounded-2xl border-2 border-evergreen/30 bg-lime/20 p-4">
              <p className="text-xs font-extrabold uppercase tracking-wider text-evergreen">Tu link de reservas online</p>
              <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-white p-2.5 border-2 border-ink/10">
                <span className="truncate text-xs font-bold text-ink font-mono sm:text-sm">{publicUrl}</span>
                <button
                  type="button"
                  onClick={copyLink}
                  className="shrink-0 rounded-lg bg-evergreen px-3 py-1.5 text-xs font-bold text-lime hover:bg-pine"
                >
                  {copied ? "¡Copiado! ✓" : "Copiar link"}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-inkmute">
                💡 Pegá este link en tu biografía de Instagram o mandáselo a tus clientes por WhatsApp.
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
                  <p className="text-xs text-inkmute">¿Querés reservas ilimitadas y cobrar seña?</p>
                </div>
                {user.plan === "semilla" && (
                  <button
                    type="button"
                    onClick={() => onGoToPlan("crece")}
                    className="rounded-full bg-lime px-4 py-2 font-display text-xs font-bold text-ink hover:bg-limedeep"
                  >
                    Ver Plan Crece
                  </button>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={finishOnboarding}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-evergreen py-4 font-display text-base font-bold text-lime transition-all hover:-translate-y-0.5 hover:bg-pine shadow-block-ink"
            >
              ¡Terminar y empezar a recibir turnos! 🎉
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

function BookingRow({ b, service, pro, products, businessName, onStatus, onDelete, onVerify, onReject, onReschedule }: {
  b: Booking;
  service?: Service;
  pro?: { id: string; name: string; color: string };
  products: Product[];
  businessName?: string;
  onStatus: (id: string, s: BookingStatus) => void;
  onDelete: (id: string) => void;
  onVerify: (id: string) => void;
  onReject: (id: string) => void;
  onReschedule: (b: Booking) => void;
}) {
  const st = STATUS[b.status];
  const claimPending = !!b.depositClaim && !b.paidDeposit && b.status !== "cancelada";
  const cancelled = b.status === "cancelada";
  return (
    <div className={`card card-hover flex flex-wrap items-center gap-x-5 gap-y-3 p-4 ${cancelled ? "opacity-60" : ""}`}>
      <span className={`flex h-14 w-16 flex-col items-center justify-center rounded-xl font-display ${cancelled ? "bg-ink/8 text-ink/40" : "bg-evergreen text-lime"}`}>
        <span className="text-lg font-extrabold leading-none">{b.time}</span>
        <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wider opacity-70">{service?.duration ?? 30}′</span>
      </span>
      <span className="min-w-36 flex-1">
        <span className={`block font-display text-base font-extrabold text-ink ${cancelled ? "line-through" : ""}`}>{b.client}</span>
        <span className="block text-sm text-inkmute">{service ? `${service.name} · ${fmtMoney(service.price)}` : "Servicio eliminado"}{pro ? ` · con ${pro.name}` : ""}</span>
        <span className="block text-xs text-ink/50">{b.phone || "sin contacto"}</span>
        {claimPending && <span className="block text-xs font-semibold text-coral">Comprobante: {b.depositClaim!.txId}</span>}
        {b.items && b.items.length > 0 && (
          <span className="mt-1.5 flex flex-wrap gap-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-lime/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-fern"><IconBag className="h-3 w-3" /> Tienda</span>
            {b.items.map((it) => { const p = products.find((x) => x.id === it.productId); return <span key={it.productId} className="rounded-full bg-ink/8 px-2 py-0.5 text-[10px] font-bold text-ink/70">{it.qty}× {p?.name ?? "Producto"}</span>; })}
          </span>
        )}
      </span>
      <span className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${b.source === "online" ? "bg-fern/15 text-fern" : "bg-ink/10 text-ink/60"}`}>{b.source === "online" ? "● Online" : "Manual"}</span>
        {b.reviewRequested && <span className="rounded-full bg-lime/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-fern">💌 Reseña pedida</span>}
        {claimPending && <span className="rounded-full bg-coral/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-coral">💸 Seña a verificar</span>}
        {b.paidDeposit && <span className="rounded-full bg-lime/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-fern">Seña cobrada</span>}
        <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${st.cls}`}>{st.label}</span>
      </span>
      <span className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onReschedule(b)}
          title="Reprogramar fecha u horario"
          className="btn-press flex h-8 items-center gap-1 rounded-full border border-ink/20 bg-paper px-2.5 text-xs font-bold text-ink transition-colors hover:border-evergreen hover:text-evergreen"
        >
          <IconCalendar className="h-3.5 w-3.5 text-fern" />
          <span className="hidden sm:inline">Reprogramar</span>
        </button>
        {b.phone && (
          <a
            href={`https://wa.me/54${b.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola ${b.client.split(" ")[0]}! Te escribimos de ${businessName || "nuestro negocio"} para recordarte tu turno de ${service?.name || "atención"} el ${fmtLong(b.date)} a las ${b.time} hs. ¡Te esperamos!`)}`}
            target="_blank"
            rel="noreferrer"
            title="Enviar recordatorio por WhatsApp"
            className="btn-press flex h-8 items-center gap-1 rounded-full border border-emerald-600/30 bg-emerald-50 px-2.5 text-xs font-bold text-emerald-800 transition-all hover:bg-emerald-100"
          >
            <IconWhatsApp className="h-3.5 w-3.5 text-emerald-600" />
            <span className="hidden sm:inline">WhatsApp</span>
          </a>
        )}
        {claimPending && (
          <>
            <button onClick={() => onVerify(b.id)} className="btn-press rounded-full bg-fern px-3.5 py-2 text-xs font-bold text-lime transition-all hover:bg-evergreen">Acreditar</button>
            <button onClick={() => onReject(b.id)} className="btn-press rounded-full border-2 border-coral/40 px-3.5 py-2 text-xs font-bold text-coral transition-colors hover:bg-coral hover:text-white">Rechazar</button>
          </>
        )}
        {b.status === "pendiente" && !claimPending && <button onClick={() => onStatus(b.id, "confirmada")} className="btn-press rounded-full bg-evergreen px-3.5 py-2 text-xs font-bold text-lime transition-all hover:bg-pine">Confirmar</button>}
        {b.status === "confirmada" && <button onClick={() => onStatus(b.id, "atendida")} className="btn-press rounded-full bg-fern px-3.5 py-2 text-xs font-bold text-lime transition-all hover:bg-evergreen">Atendida ✓</button>}
        {(b.status === "atendida" || b.status === "cancelada") && <button onClick={() => onStatus(b.id, "pendiente")} className="btn-press rounded-full border-2 border-ink/15 px-3.5 py-2 text-xs font-bold text-inkmute transition-colors hover:border-evergreen hover:text-evergreen">Restaurar</button>}
        {!cancelled && <button onClick={() => onStatus(b.id, "cancelada")} className="btn-press rounded-full border-2 border-coral/40 px-3.5 py-2 text-xs font-bold text-coral transition-colors hover:bg-coral hover:text-white">Cancelar</button>}
        <button onClick={() => onDelete(b.id)} aria-label="Eliminar reserva" className="flex h-8 w-8 items-center justify-center rounded-full text-ink/35 transition-colors hover:bg-coral/10 hover:text-coral"><IconTrash className="h-4 w-4" /></button>
      </span>
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
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/60 p-4 backdrop-blur-[2px] sm:items-center" onClick={onClose}>
      <div className="pop-in w-full max-w-md rounded-[22px] border-2 border-ink/15 bg-card p-6 text-ink shadow-block sm:p-7" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-2xl font-extrabold">{title}</h3>
          <button onClick={onClose} aria-label="Cerrar" className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink/15 text-inkmute transition-colors hover:border-coral hover:text-coral">✕</button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

function BookingModal({ initialDate, initialClient, initialPhone, initialServiceId, waitlistId, onClose }: { initialDate: string; initialClient?: string; initialPhone?: string; initialServiceId?: string; waitlistId?: string; onClose: () => void }) {
  const { data, addBooking, createBookingFromWaitlist, toast } = useStore();
  const [client, setClient] = useState(initialClient ?? "");
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [serviceId, setServiceId] = useState(initialServiceId ?? data?.services[0]?.id ?? "");
  const [proId, setProId] = useState<string>(data?.professionals[0]?.id ?? "");
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!data) return null;

  const dayHours = data.settings.hours[dayOfWeek(date)];
  const taken = data.bookings.filter((b) => b.date === date && b.status !== "cancelada").map((b) => b.time);
  const free = slotsForDay(dayHours).filter((t) => !taken.includes(t));

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
    toast(`Reserva creada: ${client.trim()} · ${date} ${time}`);
    onClose();
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
            <select className="field" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              {data.services.map((s) => <option key={s.id} value={s.id}>{s.name} · {fmtMoney(s.price)}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Fecha</label>
            <input type="date" className="field" value={date} min={dateKey(new Date())} onChange={(e) => { setDate(e.target.value); setTime(""); }} />
          </div>
        </div>
        {data.professionals.length > 0 && (
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Profesional</label>
            <select className="field" value={proId} onChange={(e) => setProId(e.target.value)}>
              {data.professionals.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.role}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Horario {time && <span className="text-fern">· {time}</span>}</label>
          <div className="grid max-h-40 grid-cols-4 gap-1.5 overflow-y-auto rounded-xl border-2 border-ink/10 bg-white/50 p-2">
            {free.length === 0 && <p className="col-span-4 py-3 text-center text-sm text-inkmute">{dayHours && !dayHours.open ? "Ese día el negocio no abre." : "No quedan horarios libres ese día."}</p>}
            {free.map((t) => (
              <button type="button" key={t} onClick={() => setTime(t)}
                className={`rounded-lg border-2 py-1.5 font-display text-sm font-bold transition-all ${time === t ? "border-evergreen bg-evergreen text-lime" : "border-ink/10 bg-white hover:border-evergreen"}`}>{t}</button>
            ))}
          </div>
        </div>
        {error && <p className="shake rounded-lg border-2 border-coral/40 bg-coral/10 px-3 py-2 text-xs font-semibold text-coral">{error}</p>}
        <button type="submit" className="w-full rounded-full bg-coral py-3.5 font-display text-base font-bold text-white transition-all hover:-translate-y-0.5 hover:shadow-[5px_6px_0_rgba(255,122,89,0.3)]">Crear reserva</button>
      </form>
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
            <select
              className="field !py-2.5"
              value={proId}
              onChange={(e) => setProId(e.target.value)}
            >
              <option value="">Cualquiera / Rotativo</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
              ))}
            </select>
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
            <span className="flex items-center gap-1.5">
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
            className="btn-press rounded-full bg-evergreen px-5 py-2.5 font-display text-xs font-bold text-lime hover:bg-pine shadow-sm"
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
            <select className="field" value={bProId} onChange={(e) => setBProId(e.target.value)}>
              <option value="">Todo el negocio / Todos</option>
              {pros.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
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
          <button type="submit" className="rounded-xl bg-evergreen px-5 py-2.5 font-display text-xs font-bold text-lime shadow-sm hover:bg-pine">
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
  onBookSlot: () => void;
  onBlockSlot: (time: string) => void;
  onUnblockSlot: (id: string) => void;
  onReschedule: (b: Booking) => void;
  businessName: string;
}) {
  const dayH = hours[dayOfWeek(date)];
  const daySlots = dayH.open ? slotsForDay(dayH) : [];

  return (
    <div className="mt-4 space-y-3">
      {!dayH.open ? (
        <div className="card p-8 text-center text-sm text-inkmute">
          El negocio está configurado como cerrado en este día de la semana.
        </div>
      ) : daySlots.length === 0 ? (
        <div className="card p-8 text-center text-sm text-inkmute">
          No hay horarios configurados para este día.
        </div>
      ) : (
        <div className="divide-y divide-ink/8 rounded-2xl border-2 border-ink/10 bg-white overflow-hidden shadow-sm">
          {daySlots.map((slotTime) => {
            const b = bookings.find((x) => x.date === date && x.time === slotTime && x.status !== "cancelada");
            const blocked = blockedSlots.find((bs) => bs.date === date && (!bs.time || bs.time === slotTime));
            const srv = b ? services.find((s) => s.id === b.serviceId) : null;
            const pro = b ? pros.find((p) => p.id === b.proId) : null;

            return (
              <div
                key={slotTime}
                className={`flex flex-wrap items-center justify-between gap-3 p-3.5 transition-colors ${
                  b
                    ? "bg-lime/10"
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
                        {srv?.name || "Servicio"} {pro ? `· con ${pro.name}` : ""} {b.phone ? `· ${formatArgentinaPhone(b.phone) || b.phone}` : ""}
                      </span>
                    </div>
                  ) : blocked ? (
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-ink/10 px-2.5 py-0.5 text-xs font-bold text-ink/70">
                        🚫 Bloqueado: {blocked.reason}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-ink/40">Disponible</span>
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
                        onClick={() => onBookSlot()}
                        className="btn-press rounded-lg bg-evergreen px-3 py-1 text-xs font-bold text-lime hover:bg-pine"
                      >
                        + Turno
                      </button>
                      <button
                        onClick={() => onBlockSlot(slotTime)}
                        className="btn-press rounded-lg border border-ink/15 px-2.5 py-1 text-xs font-bold text-inkmute hover:border-coral hover:text-coral"
                      >
                        Pausar
                      </button>
                    </div>
                  )}
                </div>
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
}: {
  bookings: Booking[];
  services: Service[];
  clientNotes: Record<string, string>;
  onSaveNote: (phone: string, note: string) => void;
  businessName: string;
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
                      📝 Nota privada del negocio
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
                          className="rounded-lg bg-evergreen px-3 py-1 text-xs font-bold text-lime shadow-sm hover:bg-pine"
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
      text: `¡Hola! 👋 Gracias por comunicarte con ${business}.\n\nPodés ver todos nuestros servicios, precios actualizados y reservar tu turno en el día y horario que prefieras desde acá:\n👉 ${url}\n\n¡Es súper fácil y rápido! Te esperamos.`,
    },
    {
      id: "ig-bio",
      title: "Texto para tu Bio de Instagram",
      subtitle: "Corto, claro y directo para el enlace de tu perfil",
      badge: "Instagram",
      text: `📍 ${business}\n🗓️ Reservá tu turno online las 24 hs 👇\n🔗 ${url}`,
    },
    {
      id: "stories",
      title: "Para Historias / Estados de WhatsApp",
      subtitle: "Para cuando abrís agenda y querés llenar los turnos de la semana",
      badge: "Difusión",
      text: `¡Abrimos la agenda para esta semana en ${business}! 🗓️✨\n\nElegí tu turno antes de que se agoten los lugares:\n👉 ${url}`,
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
                  navigator.clipboard?.writeText(t.text).then(() => toast("¡Mensaje copiado al portapapeles! 📋"));
                }}
                className="btn-press rounded-lg bg-evergreen px-4 py-1.5 font-display text-xs font-bold text-lime hover:bg-pine shadow-sm"
              >
                Copiar mensaje 📋
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
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-evergreen text-[9px] font-bold text-lime">1</span>
              <span>Elegí tu servicio y horario</span>
            </p>
            <p className="flex items-center gap-1.5">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-evergreen text-[9px] font-bold text-lime">2</span>
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
          <button onClick={handlePrint} className="rounded-xl bg-evergreen px-5 py-2 text-xs font-bold text-lime shadow-sm hover:bg-pine">
            🖨️ Imprimir cartel (A4)
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
    else { addService({ name: name.trim(), price: p, duration: d }); toast(`"${name.trim()}" ya está en tu página 🎉`); }
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
        <button type="submit" className="w-full rounded-full bg-evergreen py-3.5 font-display text-base font-bold text-lime transition-all hover:-translate-y-0.5 hover:bg-pine">{service ? "Guardar cambios" : "Publicar servicio"}</button>
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
  const monthBookings = db.bookings.filter((b) => b.date.startsWith(monthKey) && active(b));
  const revenue = monthBookings.reduce((acc, b) => acc + (db.services.find((s) => s.id === b.serviceId)?.price ?? 0), 0);
  const confirmed = db.bookings.filter((b) => b.status === "confirmada" || b.status === "atendida").length;
  const confirmRate = db.bookings.length ? Math.round((confirmed / db.bookings.length) * 100) : 0;
  const avgTicket = monthBookings.length ? Math.round(revenue / monthBookings.length) : 0;

  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const perDay = days.map((d) => {
    const k = dateKey(d);
    return { k, label: d.getDate(), count: db.bookings.filter((b) => b.date === k && active(b)).length };
  });
  const maxDay = Math.max(1, ...perDay.map((d) => d.count));

  const svcCount = db.services
    .map((s) => ({
      s,
      count: db.bookings.filter((b) => b.serviceId === s.id && active(b)).length,
      revenue: db.bookings.filter((b) => b.serviceId === s.id && active(b)).length * s.price,
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
            className="inline-flex items-center gap-2 rounded-full border-2 border-evergreen bg-evergreen/10 px-5 py-2.5 font-display text-xs font-bold text-evergreen transition-all hover:bg-evergreen hover:text-lime"
          >
            📊 Exportar reservas a Excel (CSV)
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className={`card card-hover p-5 ${k.accent ? "!border-limedeep/70 !bg-lime/25" : ""}`}>
            <div className="flex items-start justify-between">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${k.accent ? "bg-evergreen text-lime" : "bg-ink/8 text-fern"}`}>{k.icon}</span>
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

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Reveal className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-lg font-extrabold text-ink">Reservas · últimos 14 días</h3>
            <span className="rounded-full bg-lime/40 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-fern">{perDay.reduce((a, d) => a + d.count, 0)} turnos</span>
          </div>
          <div className="mt-6 flex gap-2">
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
                        <div className={`anim-bar-v w-full rounded-t-[5px] ${isToday ? "bg-lime ring-2 ring-limedeep/50" : "bg-fern"} transition-colors duration-200 group-hover:bg-limedeep`}
                          style={{ height: `${d.count === 0 ? 3 : Math.max(8, (d.count / maxDay) * 100)}%`, animationDelay: `${i * 45}ms` }} />
                        <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-center opacity-0 shadow-lg transition-all duration-200 group-hover:-translate-y-1 group-hover:opacity-100">
                          <p className="text-[10px] font-extrabold text-lime">{d.count} turno{d.count === 1 ? "" : "s"}</p>
                          <p className="text-[9px] font-semibold text-paper/70">{fmtLong(d.k)}{isToday ? " · hoy" : ""}</p>
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
              <h3 className="font-display text-lg font-extrabold text-ink">⏰ Horarios más concurridos</h3>
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
              <h3 className="font-display text-lg font-extrabold text-ink">👥 Fidelidad y Retención</h3>
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
                <span className="inline-flex items-center gap-1.5 rounded-full bg-evergreen px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-lime">
                  ⭐ Exclusivo Plan Escala
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
                className="inline-flex items-center gap-2 rounded-full bg-evergreen px-6 py-3 font-display text-xs font-bold text-lime shadow-block-ink transition-all hover:-translate-y-0.5 hover:bg-pine"
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
              <p className="mt-1 text-sm text-inkmute">Promedio de <strong className="text-fern">{avgRating.toFixed(1)} ★</strong> en {reviews.length} reseña{reviews.length === 1 ? "" : "s"} reales dejadas por tus clientes.</p>
            ) : (
              <p className="mt-1 text-sm text-inkmute">Tus clientes pueden dejar reseñas directamente desde tu página pública.</p>
            )}
          </div>
          <a
            href={`/${user?.slug}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border-2 border-ink/15 px-5 py-2 font-display text-xs font-bold text-ink transition-all hover:-translate-y-0.5 hover:border-evergreen hover:bg-evergreen hover:text-lime"
          >
            Ver en mi página pública ↗
          </a>
        </div>
        <p className="mt-4 rounded-xl border-2 border-dashed border-limedeep/60 bg-lime/10 px-4 py-3 text-sm text-ink/80">
          💡 Las reseñas provienen de clientes reales que visitan tu enlace público o completan su turno. Podés moderarlas o eliminarlas en cualquier momento.
        </p>
        {reviews.length > 0 ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((r) => (
              <div key={r.id} className="relative group rounded-xl border-2 border-ink/8 bg-white/60 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-ink/20">
                <div className="flex items-center justify-between">
                  <div className="flex gap-0.5 text-limedeep">{[...Array(5)].map((_, i) => <IconStar key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "" : "opacity-20"}`} />)}</div>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`¿Eliminar la reseña de ${r.client}?`)) {
                        removeReview(r.id);
                        toast("Reseña eliminada");
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold text-coral hover:underline"
                  >
                    Eliminar
                  </button>
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
function TeamView() {
  const { user, data, addProfessional, updateProfessional, removeProfessional, toast } = useStore();
  const [modal, setModal] = useState(false);
  if (!user || !data) return null;
  const limit = PRO_LIMIT[user.plan];

  return (
    <div className="pop-in mt-8">
      <p className="mb-4 text-sm text-inkmute">
        Tu plan <strong className="text-fern">{PLAN_META[user.plan].name}</strong> permite hasta <strong className="text-fern">{limit >= 99 ? "profesionales ilimitados" : `${limit} profesional${limit === 1 ? "" : "es"}`}</strong>. Usás {data.professionals.length}.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {data.professionals.map((p) => (
          <div key={p.id} className="group card card-hover flex items-center gap-4 p-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-display text-base font-extrabold text-ink" style={{ background: p.color }}>{p.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-extrabold text-ink">{p.name}</p>
              <p className="text-sm text-inkmute">{p.role}</p>
            </div>
            <button onClick={() => { removeProfessional(p.id); toast(`${p.name} salió del equipo.`, "warn"); }} aria-label="Quitar"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ink/15 text-inkmute opacity-0 transition-all hover:border-coral hover:text-coral group-hover:opacity-100"><IconTrash className="h-4 w-4" /></button>
          </div>
        ))}
        <button onClick={() => setModal(true)} disabled={data.professionals.length >= limit}
          className="flex min-h-28 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-ink/25 text-inkmute transition-all duration-200 enabled:hover:-translate-y-1 enabled:hover:border-evergreen enabled:hover:text-evergreen disabled:opacity-50">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ink/8"><IconPlus className="h-5 w-5" /></span>
          <span className="font-display text-base font-bold">{data.professionals.length >= limit ? "Límite del plan alcanzado" : "Agregar profesional"}</span>
        </button>
      </div>
      {data.professionals.length >= limit && (
        <p className="mt-4 text-sm text-inkmute">Necesitás más lugar? <button onClick={() => requestCheckout(user.plan === "semilla" ? "crece" : "escala")} className="font-bold text-fern underline decoration-limedeep decoration-2 underline-offset-4">Subí de plan</button> para sumar profesionales. Te llevamos a MercadoPago.</p>
      )}
      {modal && <ProModal onClose={() => setModal(false)} onSave={(n, r) => { const err = addProfessional(n, r); if (err) return err; toast(`${n} se sumó al equipo 🎉`); return null; }} />}
    </div>
  );
}

function ProModal({ onClose, onSave }: { onClose: () => void; onSave: (name: string, role: string) => string | null }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal title="Nuevo profesional" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); const err = onSave(name, role); if (err) return setError(err); onClose(); }} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Nombre *</label>
          <input className="field" placeholder="Caro Méndez" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Rol</label>
          <input className="field" placeholder="Nail artist" value={role} onChange={(e) => setRole(e.target.value)} />
        </div>
        {error && <p className="shake rounded-lg border-2 border-coral/40 bg-coral/10 px-3 py-2 text-xs font-semibold text-coral">{error}</p>}
        <button type="submit" className="w-full rounded-full bg-evergreen py-3.5 font-display text-base font-bold text-lime transition-all hover:-translate-y-0.5 hover:bg-pine">Agregar al equipo</button>
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
            <div className="flex gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <button onClick={() => setModal({ open: true, id: p.id })} aria-label="Editar" className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink/15 text-inkmute transition-colors hover:border-evergreen hover:text-evergreen"><IconPencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => { removeProduct(p.id); toast(`"${p.name}" eliminado de la tienda.`, "warn"); }} aria-label="Eliminar" className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink/15 text-inkmute transition-colors hover:border-coral hover:text-coral"><IconTrash className="h-3.5 w-3.5" /></button>
            </div>
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
    else { addProduct({ name: name.trim(), desc: desc.trim() || "Producto de tu tienda", price: p }); toast(`"${name.trim()}" ya está en tu tienda 🛍️`); }
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
        <button type="submit" className="w-full rounded-full bg-evergreen py-3.5 font-display text-base font-bold text-lime transition-all hover:-translate-y-0.5 hover:bg-pine">{product ? "Guardar cambios" : "Publicar producto"}</button>
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
            <button onClick={() => { removeCoupon(c.id); toast(`Cupón ${c.code} eliminado.`, "warn"); }} aria-label="Eliminar"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ink/15 text-inkmute opacity-0 transition-all hover:border-coral hover:text-coral group-hover:opacity-100"><IconTrash className="h-4 w-4" /></button>
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
      <form onSubmit={(e) => { e.preventDefault(); const err = addCoupon({ code, pct }); if (err) return setError(err); toast(`Cupón ${code.trim().toUpperCase()} creado 🎟️`); onClose(); }} className="space-y-4">
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
        <button type="submit" className="w-full rounded-full bg-evergreen py-3.5 font-display text-base font-bold text-lime transition-all hover:-translate-y-0.5 hover:bg-pine">Crear cupón</button>
      </form>
    </Modal>
  );
}

/* ============ SUSCRIPCIÓN ============ */
function SubscriptionView({ current, user, onSelect }: { current: Plan; user: NonNullable<ReturnType<typeof useStore>["user"]>; onSelect: (p: Plan) => void }) {
  const { cancelSubscription, resumeSubscription, toast } = useStore();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const sub = user.subscription;

  const plans: Plan[] = ["semilla", "crece", "escala"];
  const desc: Record<Plan, string[]> = {
    semilla: ["1 profesional", "25 reservas al mes", "Link web propio", "Recordatorios por email", "Horarios configurables"],
    crece: ["Reservas ilimitadas", "Hasta 3 profesionales", "Cobro de seña (Mercado Pago / Transferencia)", "Tienda de productos y cupones", "Horarios por día con corte"],
    escala: ["Todo lo de Crece", "Profesionales y equipos ilimitados", "Estadísticas avanzadas y exportación", "Paletas de colores exclusivas", "Soporte prioritario"],
  };

  const nextDateStr = fmtDateHuman(sub?.nextRenewal || new Date(Date.now() + 30 * 86400000).toISOString());

  return (
    <div className="pop-in mt-8 space-y-6">
      {/* Detalle de la suscripción actual si es de pago */}
      {current !== "semilla" && (
        <div className="card border-2 border-evergreen/30 bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-xl font-extrabold text-ink">
                  Suscripción {PLAN_META[current].name}
                </span>
                <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${sub?.status === "cancelada" ? "bg-coral/15 text-coral" : "bg-evergreen text-lime"}`}>
                  {sub?.status === "cancelada" ? "Cancelada (Vence pronto)" : "Activa con Mercado Pago ✓"}
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-inkmute">
                {sub?.status === "cancelada"
                  ? `Tu suscripción no se renovará. Vas a mantener los beneficios de ${PLAN_META[current].name} hasta el ${nextDateStr}.`
                  : `Próxima renovación automática: ${nextDateStr} · ${PLAN_META[current].price}`}
              </p>
            </div>

            <div>
              {sub?.status === "cancelada" ? (
                <button
                  type="button"
                  onClick={() => { resumeSubscription(); toast("Suscripción automática reactivada ✓"); }}
                  className="rounded-full bg-evergreen px-5 py-2.5 font-display text-xs font-bold text-lime shadow-sm transition-all hover:bg-pine"
                >
                  Reactivar renovación automática
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmCancel(true)}
                  className="rounded-full border-2 border-coral/40 px-5 py-2.5 font-display text-xs font-bold text-coral transition-all hover:bg-coral hover:text-white"
                >
                  Cancelar suscripción
                </button>
              )}
            </div>
          </div>

          {confirmCancel && (
            <div className="pop-in mt-5 rounded-2xl border-2 border-coral/30 bg-coral/5 p-4">
              <p className="font-display text-sm font-extrabold text-ink">¿Querés cancelar la renovación automática?</p>
              <p className="mt-1 text-xs text-inkmute leading-relaxed">
                Vas a poder seguir usando todas las funciones de tu plan <strong>{PLAN_META[current].name}</strong> hasta el <strong>{nextDateStr}</strong>. Llegada esa fecha, tu cuenta pasará automáticamente al plan gratuito Semilla.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => { cancelSubscription(); setConfirmCancel(false); toast("Suscripción cancelada. Estará activa hasta el vencimiento.", "warn"); }}
                  className="rounded-full bg-coral px-4 py-2 font-display text-xs font-bold text-white transition-all hover:bg-coral/90"
                >
                  Sí, cancelar renovación
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmCancel(false)}
                  className="rounded-full border-2 border-ink/20 px-4 py-2 font-display text-xs font-bold text-ink transition-colors hover:bg-ink/5"
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
            <div key={p} className={`card relative flex flex-col justify-between p-6 transition-all ${active ? "!border-limedeep !bg-lime/20 shadow-block-ink" : isPopular ? "border-fern/40 bg-card hover:border-evergreen shadow-sm" : "border-ink/12 bg-card hover:border-evergreen"}`}>
              {isPopular && !active && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-coral px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-sm">
                  ⭐ Recomendado
                </span>
              )}
              {active && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-evergreen px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-lime">
                  ✓ Tu plan actual
                </span>
              )}
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-display text-2xl font-extrabold text-ink">{PLAN_META[p].name}</h3>
                  {p === "semilla" && <span className="rounded-full bg-fern/15 px-2.5 py-0.5 text-xs font-bold text-fern">Gratis</span>}
                </div>
                <p className="mt-3 font-display text-3xl font-extrabold text-fern">{PLAN_META[p].price}</p>
                <p className="mt-1 text-xs text-inkmute">
                  {p === "semilla" ? "Sin tarjeta ni compromisos" : "Suscripción mensual o anual"}
                </p>

                <ul className="mt-5 space-y-2 border-t border-ink/10 pt-4">
                  {desc[p].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-ink/80 leading-snug">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-lime text-ink"><IconCheck className="h-2.5 w-2.5" /></span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 border-t border-ink/10 pt-4">
                {active ? (
                  <div className="flex items-center justify-center gap-2 rounded-full bg-evergreen/10 py-3 font-display text-xs font-bold text-evergreen">
                    <IconCheck className="h-4 w-4" /> Plan en uso
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelect(p)}
                    className={`flex w-full items-center justify-center gap-2 rounded-full py-3.5 font-display text-xs font-bold transition-all hover:-translate-y-0.5 ${p === "semilla" ? "border-2 border-ink/20 text-ink hover:border-evergreen hover:bg-evergreen hover:text-lime" : "bg-evergreen text-lime hover:bg-pine shadow-block-ink"}`}
                  >
                    {p === "semilla" ? "Bajar a Semilla (Gratis)" : `Pagar ${PLAN_META[p].name} con Mercado Pago`}
                    <IconArrow className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border-2 border-ink/10 bg-card p-5 text-sm text-inkmute">
        <p className="font-bold text-ink">💳 ¿Cómo funciona el cambio de plan?</p>
        <p className="mt-1 text-xs sm:text-sm leading-relaxed">
          Al tocar en <strong>Pagar con Mercado Pago</strong>, se abre la ventana de suscripción donde podés elegir pago mensual o anual con descuento. Una vez autorizado el pago en Mercado Pago, tu cuenta se actualiza automáticamente con todos los beneficios. Podés cancelar la suscripción automática en cualquier momento desde esta misma pestaña.
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
          <button onClick={onPrint} className="flex-1 rounded-xl bg-evergreen py-2.5 text-center font-display text-xs font-bold text-lime transition-all hover:bg-pine shadow-sm">
            🖨️ Imprimir cartel
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
      <button onClick={onUpgrade} className="mt-6 inline-flex items-center gap-2 rounded-full bg-lime px-7 py-3.5 font-display text-base font-bold text-ink transition-all hover:-translate-y-0.5 hover:bg-limedeep">
        Activar con el plan Crece <IconArrow className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ============ AJUSTES ============ */
type SettingsTab = "negocio" | "pagina" | "pagos" | "horarios" | "plan" | "cuenta";

function SettingsView({ user, settings, onSaveProfile, onSelectPlan }: { user: NonNullable<ReturnType<typeof useStore>["user"]>; settings: BizSettings; onSaveProfile: (b: string, n: string) => void; onSelectPlan: (p: Plan) => void }) {
  const [tab, setTab] = useState<SettingsTab>("negocio");
  const { updateSettings, cancelSubscription, resumeSubscription } = useStore();

  const tabs: { id: SettingsTab; label: string; icon: ReactNode }[] = [
    { id: "negocio", label: "Negocio", icon: <IconWallet className="h-4 w-4" /> },
    { id: "pagina", label: "Mi página", icon: <IconLink className="h-4 w-4" /> },
    { id: "pagos", label: "Pagos y seña", icon: <IconTicket className="h-4 w-4" /> },
    { id: "horarios", label: "Horarios", icon: <IconClock className="h-4 w-4" /> },
    { id: "plan", label: "Plan", icon: <IconStar className="h-4 w-4" /> },
    { id: "cuenta", label: "Cuenta", icon: <IconLogout className="h-4 w-4" /> },
  ];

  return (
    <div className="pop-in mt-8">
      <div className="no-scrollbar flex gap-1 overflow-x-auto border-b-2 border-ink/10">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`relative flex shrink-0 items-center gap-2 px-4 py-3 font-display text-sm font-bold transition-colors ${tab === t.id ? "text-evergreen" : "text-inkmute hover:text-ink"}`}>
            {t.icon}{t.label}
            {tab === t.id && <span className="absolute inset-x-2 -bottom-0.5 h-1 rounded-full bg-lime" />}
          </button>
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
            onCancelSub={cancelSubscription}
            onResumeSub={resumeSubscription}
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

  useEffect(() => {
    setBusiness(user.business);
    setName(user.name);
  }, [user]);

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
        <button onClick={() => onSave(business, name)} className="rounded-full bg-evergreen px-6 py-3 font-display text-sm font-bold text-lime transition-all hover:-translate-y-0.5 hover:bg-pine">Guardar cambios</button>
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

  useEffect(() => {
    setF({
      description: settings.description || "",
      address: settings.address || "",
      whatsapp: settings.whatsapp || "",
      instagram: settings.instagram || "",
      mapsUrl: settings.mapsUrl || "",
      theme: (settings.theme || "evergreen") as ThemeId,
    });
  }, [settings]);

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
            🎨 Paleta de colores de tu página
          </label>
          {!paid && (
            <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-900">
              🔒 Paletas exclusivas: Plan Crece
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
                    toast("🎨 Las paletas de colores exclusivas están disponibles en el plan Crece.", "warn");
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
                  {isLocked && !isSel && <span className="text-[10px]">🔒</span>}
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
        className="rounded-full bg-evergreen px-6 py-3 font-display text-sm font-bold text-lime transition-all hover:-translate-y-0.5 hover:bg-pine"
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

  useEffect(() => {
    setF({
      alias: settings.transferAlias || "",
      cbu: settings.transferCBU || "",
      holder: settings.transferHolder || "",
    });
  }, [settings]);

  if (!paid) {
    return (
      <LockedFeature icon={<IconTicket className="h-7 w-7" />} title="La seña es parte del plan Crece"
        desc="Cobrá un anticipo al reservar y bajá las ausencias hasta 68%. Vos elegís el porcentaje y tus datos de transferencia."
        onUpgrade={() => requestCheckout("crece")} />
    );
  }

  const handleSave = () => {
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
          <p className="text-sm text-inkmute">El cliente transfiere a tus datos y carga el comprobante. Vos lo verificás.</p>
        </div>
        <Toggle on={settings.depositEnabled} onChange={(v) => { onChange({ depositEnabled: v }); toast(v ? "Seña activada ✓" : "Seña desactivada."); }} label="Activar seña" />
      </div>
      {settings.depositEnabled && (
        <div className="pop-in mt-5 space-y-5">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Porcentaje de seña: <strong className="text-fern">{settings.depositPct}%</strong></label>
            <input type="range" min={10} max={50} step={5} value={settings.depositPct} onChange={(e) => onChange({ depositPct: Number(e.target.value) })} className="w-full accent-[#1e5c49]" />
            <div className="flex justify-between text-xs font-bold text-ink/40"><span>10%</span><span>50%</span></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Alias</label>
              <input className="field" placeholder="TU.NEGOCIO" value={f.alias} onChange={(e) => setF({ ...f, alias: e.target.value })} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">CBU / CVU</label>
              <input className="field" placeholder="0000003100012345678901" value={f.cbu} onChange={(e) => setF({ ...f, cbu: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Titular de la cuenta</label>
              <input className="field" placeholder="Nombre y apellido" value={f.holder} onChange={(e) => setF({ ...f, holder: e.target.value })} />
            </div>
          </div>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-full bg-evergreen px-6 py-3 font-display text-sm font-bold text-lime transition-all hover:-translate-y-0.5 hover:bg-pine"
          >
            Guardar datos de cobro
          </button>
        </div>
      )}
    </div>
  );
}

function HoursCard({
  hours,
  settings,
  onChange,
  onUpdateSettings,
}: {
  hours: DayHours[];
  settings: BizSettings;
  onChange: (hours: DayHours[]) => void;
  onUpdateSettings: (patch: Partial<BizSettings>) => void;
}) {
  const { toast } = useStore();
  const set = (i: number, patch: Partial<DayHours>) => {
    const next = hours.map((h, idx) => (idx === i ? { ...h, ...patch } : h));
    onChange(next);
    toast("Horarios actualizados ✓");
  };
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <div className="card p-6">
      <h3 className="font-display text-lg font-extrabold text-ink">Días y horarios de atención</h3>
      <p className="mt-1 text-sm text-inkmute">Los turnos disponibles se generan solos según esto. Podés agregar un corte al mediodía.</p>
      <div className="mt-5 space-y-3">
        {order.map((i) => {
          const h = hours[i];
          return (
            <div key={i} className={`rounded-xl border-2 p-4 transition-colors ${h.open ? "border-ink/12 bg-white/60" : "border-ink/8 bg-ink/[0.03]"}`}>
              <div className="flex flex-wrap items-center gap-3">
                <Toggle on={h.open} onChange={(v) => set(i, { open: v })} label={`Abrir ${DAY_NAMES[i]}`} />
                <span className={`w-24 font-display text-sm font-extrabold ${h.open ? "text-ink" : "text-ink/35"}`}>{DAY_NAMES[i]}</span>
                {h.open && (
                  <span className="flex items-center gap-2 text-sm">
                    <input type="time" className="field !w-auto" value={h.from} onChange={(e) => set(i, { from: e.target.value })} />
                    <span className="text-inkmute">a</span>
                    <input type="time" className="field !w-auto" value={h.to} onChange={(e) => set(i, { to: e.target.value })} />
                  </span>
                )}
                {h.open && !h.from2 && (
                  <button type="button" onClick={() => set(i, { from2: "15:00", to2: "20:00" })} className="ml-auto rounded-full border-2 border-coral/40 px-3 py-1.5 text-xs font-bold text-coral transition-colors hover:bg-coral hover:text-white">+ Corte al mediodía</button>
                )}
              </div>
              {h.open && h.from2 && (
                <div className="pop-in mt-3 flex flex-wrap items-center gap-2 border-t-2 border-dashed border-coral/30 pt-3 text-sm">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-coral">✂ Reabre</span>
                  <input type="time" className="field !w-auto" value={h.from2} onChange={(e) => set(i, { from2: e.target.value })} />
                  <span className="text-inkmute">a</span>
                  <input type="time" className="field !w-auto" value={h.to2 ?? "20:00"} onChange={(e) => set(i, { to2: e.target.value })} />
                  <button type="button" onClick={() => set(i, { from2: undefined, to2: undefined })} className="ml-auto text-xs font-bold text-inkmute underline-offset-4 hover:text-coral hover:underline">Quitar corte</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Anticipación máxima de reservas */}
      <div className="mt-8 border-t-2 border-dashed border-ink/10 pt-6">
        <label className="mb-1 block font-display text-sm font-extrabold text-ink">
          📅 ¿Con cuánta anticipación pueden reservar tus clientes?
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
                className={`btn-press rounded-xl border-2 py-2.5 px-3 text-center font-display text-xs font-bold transition-all ${
                  isSel
                    ? "border-evergreen bg-evergreen text-lime shadow-sm"
                    : "border-ink/12 bg-white text-ink hover:border-ink/40"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Días cerrados / Feriados */}
      <div className="mt-8 border-t-2 border-dashed border-ink/10 pt-6">
        <label className="mb-1 block font-display text-sm font-extrabold text-ink">
          🚫 Feriados y Días Cerrados (No Laborables)
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
            className="btn-press rounded-xl bg-evergreen px-4 py-2 text-xs font-bold text-lime shadow-sm hover:bg-pine"
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
  onCancelSub,
  onResumeSub,
}: {
  current: Plan;
  user: NonNullable<ReturnType<typeof useStore>["user"]>;
  onSelect: (p: Plan) => void;
  onCancelSub: () => void;
  onResumeSub: () => void;
}) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const sub = user.subscription;
  const plans: Plan[] = ["semilla", "crece", "escala"];
  const nextDateStr = fmtDateHuman(sub?.nextRenewal || new Date(Date.now() + 30 * 86400000).toISOString());

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
                onClick={onResumeSub}
                className="rounded-full bg-evergreen px-4 py-2 font-display text-xs font-bold text-lime hover:bg-pine"
              >
                Reactivar renovación
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
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => { onCancelSub(); setConfirmCancel(false); }}
                  className="rounded-full bg-coral px-3.5 py-1.5 font-display text-xs font-bold text-white hover:bg-coral/90"
                >
                  Sí, cancelar
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
                  {active && <span className="rounded-full bg-evergreen px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-lime">Activo</span>}
                </div>
                <p className="mt-0.5 text-xs text-inkmute">
                  {p === "semilla" ? "Gratis para siempre · 1 profesional · 25 reservas/mes" : p === "crece" ? "Reservas ilimitadas · hasta 3 profesionales · seña y cupones" : "Profesionales ilimitados · soporte prioritario"}
                </p>
              </div>
              {active ? (
                <span className="rounded-full bg-evergreen/10 px-4 py-2 font-display text-xs font-bold text-evergreen">✓ En uso</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect(p)}
                  className={`rounded-full px-4 py-2 font-display text-xs font-bold transition-all hover:-translate-y-0.5 ${p === "semilla" ? "border-2 border-ink/20 text-ink hover:bg-ink/5" : "bg-evergreen text-lime hover:bg-pine shadow-sm"}`}
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
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${on ? "bg-fern" : "bg-ink/20"}`}>
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${on ? "left-6" : "left-1"}`} />
    </button>
  );
}
