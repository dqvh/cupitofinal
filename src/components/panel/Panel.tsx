import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Lock, Clock, Users } from "lucide-react";
import "./panel.css";
import {
  useStore,
  getSubscriptionStatus,
  PLAN_META,
  fmtDateHuman,
  type Plan,
} from "../../lib/store";
import { sound } from "../../lib/audio";
import { sendSubscriptionWelcomeEmail } from "../../lib/email";
import {
  clearPendingCheckout,
  confirmMercadoPago,
  getPreapprovalIdFromUrl,
  readPendingCheckout,
  PLAN_BENEFITS,
} from "../../lib/billing";
import { PlanCheckout } from "../PlanCheckout";
import { Button, Skeleton } from "./ui";
import { PanelCtx, readRoute, routeHash, VIEW_TITLES, type BlockPrefill, type NewBookingPrefill, type PanelApi, type SettingsTab, type View } from "./context";
import Shell from "./Shell";
import HomeView from "./HomeView";
import BookingDrawer from "./BookingDrawer";
import BookingForm from "./BookingForm";
import { ClientDrawer } from "./ClientsView";
import BlockSheet from "./BlockSheet";
import CommandPalette from "./CommandPalette";
import { dayLabel } from "./helpers";

/* Vistas menos frecuentes: se cargan al abrirlas. */
const AgendaView = lazy(() => import("./AgendaView"));
const BookingsView = lazy(() => import("./BookingsView"));
const ClientsView = lazy(() => import("./ClientsView"));
const WaitlistView = lazy(() => import("./WaitlistView"));
const CatalogViews = lazy(() => import("./CatalogViews"));
const ScheduleView = lazy(() => import("./ScheduleView"));
const PageView = lazy(() => import("./PageView"));
const StatsView = lazy(() => import("./StatsView"));
const SettingsView = lazy(() => import("./SettingsView"));
const Extras = lazy(() => import("./Extras"));

function ViewFallback() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Cargando">
      <Skeleton style={{ height: 28, width: 220 }} />
      <Skeleton style={{ height: 14, width: 320 }} />
      <Skeleton style={{ height: 320, borderRadius: 14 }} />
    </div>
  );
}

export default function Panel() {
  const store = useStore();
  const { user, data } = store;
  if (!user || !data) {
    return (
      <div className="cp grid min-h-screen place-items-center px-6 text-center">
        <div className="max-w-sm">
          <img src="/cupito-logo.png" width={40} height={40} alt="" className="mx-auto rounded-[10px]" />
          <h1 className="c-h1 mt-4">Ingresá para ver tu agenda</h1>
          <p className="c-sub mt-1">Necesitás una cuenta de Cupito para usar el panel.</p>
          <div className="mt-5 flex justify-center gap-2">
            <a className="c-btn c-btn--secondary" href="#/login">Ingresar</a>
            <a className="c-btn c-btn--primary" href="#/registro">Crear cuenta gratis</a>
          </div>
        </div>
      </div>
    );
  }
  return <PanelInner />;
}

function PanelInner() {
  const store = useStore();
  const user = store.user!;
  const data = store.data!;
  const [route, setRoute] = useState(readRoute);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [clientKey, setClientKey] = useState<string | null>(null);
  const [newPrefill, setNewPrefill] = useState<NewBookingPrefill | null>(null);
  const [blockPrefill, setBlockPrefill] = useState<BlockPrefill | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null);
  const [extra, setExtra] = useState<null | { kind: "calendar"; proId?: string } | { kind: "share" } | { kind: "install" } | { kind: "setup" }>(null);
  const deferredPrompt = useRef<(Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> }) | null>(null);

  /* ---------- ruteo ---------- */
  useEffect(() => {
    const on = () => setRoute(readRoute());
    window.addEventListener("popstate", on);
    window.addEventListener("hashchange", on);
    return () => { window.removeEventListener("popstate", on); window.removeEventListener("hashchange", on); };
  }, []);

  const go = useCallback<PanelApi["go"]>((view, opts) => {
    const hash = routeHash(view, view === "ajustes" ? opts?.tab : undefined, opts?.params);
    if (hash !== window.location.hash) window.history.pushState(null, "", hash);
    setRoute(readRoute());
    window.scrollTo({ top: 0 });
  }, []);

  const setParams = useCallback<PanelApi["setParams"]>((patch) => {
    const r = readRoute();
    const next: Record<string, string | undefined> = Object.fromEntries(r.params.entries());
    Object.assign(next, patch);
    window.history.replaceState(null, "", routeHash(r.view, r.tab, next));
    setRoute(readRoute());
  }, []);

  useEffect(() => {
    document.title = `${VIEW_TITLES[route.view]} · ${user.business} · Cupito`;
  }, [route.view, user.business]);

  /* ---------- checkout, onboarding y Mercado Pago ---------- */
  useEffect(() => {
    let cancelled = false;
    const p = route.params;
    const checkout = p.get("checkout");
    if (checkout === "crece" || checkout === "escala" || checkout === "semilla") setCheckoutPlan(checkout);
    const onboarding = p.get("onboarding") === "1" || p.get("setup") === "1";
    const empty = data.services.length === 0 && data.bookings.length === 0 && !data.settings.setupDismissed;
    if (onboarding && empty && !checkout) setExtra({ kind: "setup" });
    if (checkout || p.get("onboarding") || p.get("setup")) {
      try { window.history.replaceState({}, "", "#/app"); } catch { /* noop */ }
    }
    const preapprovalId = getPreapprovalIdFromUrl();
    if (preapprovalId) {
      void confirmMercadoPago(preapprovalId).then((result) => {
        if (cancelled) return;
        if (result.authorized) {
          const plan = result.plan || readPendingCheckout()?.plan || "crece";
          store.setPlan(plan);
          store.saveMpPreapprovalId(preapprovalId);
          clearPendingCheckout();
          store.toast(`Pago confirmado. Ya estás en el plan ${PLAN_META[plan].name}`);
          if (user.email) {
            sendSubscriptionWelcomeEmail({ toEmail: user.email, ownerName: user.name, businessName: user.business, planName: PLAN_META[plan].name, planPrice: PLAN_META[plan].price, slug: user.slug, benefits: PLAN_BENEFITS[plan] }).catch(() => {});
          }
        } else if (result.error) store.toast(result.error, "warn");
        else store.toast("Mercado Pago todavía no autorizó el pago. Si ya pagaste, recargá en un momento.", "warn");
        try {
          const url = new URL(window.location.href);
          ["preapproval_id", "preapprovalId", "preapproval"].forEach((k) => url.searchParams.delete(k));
          window.history.replaceState({}, "", url.pathname + ((window.location.hash || "").split("?")[0] || "#/app"));
        } catch { /* noop */ }
      });
    }
    const onCheckout = (e: Event) => {
      const plan = (e as CustomEvent<Plan>).detail;
      if (plan === "semilla" || plan === "crece" || plan === "escala") setCheckoutPlan(plan);
    };
    window.addEventListener("cupito-checkout", onCheckout);
    return () => { cancelled = true; window.removeEventListener("cupito-checkout", onCheckout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Señas vencidas: liberan el turno solas.
  useEffect(() => {
    const n = store.releaseExpiredClaims();
    if (n > 0) store.toast(`Se liberaron ${n} turno${n === 1 ? "" : "s"} con seña sin verificar por más de 24 h`, "warn");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // PWA
  useEffect(() => {
    const on = (e: Event) => { e.preventDefault(); deferredPrompt.current = e as never; };
    window.addEventListener("beforeinstallprompt", on);
    return () => window.removeEventListener("beforeinstallprompt", on);
  }, []);
  useEffect(() => {
    const on = () => void install();
    window.addEventListener("cupito-install", on);
    return () => window.removeEventListener("cupito-install", on);
  });
  const install = async () => {
    const ev = deferredPrompt.current;
    if (ev) {
      try {
        ev.prompt();
        const choice = await ev.userChoice;
        if (choice.outcome === "accepted") { deferredPrompt.current = null; store.toast("Cupito quedó en tu pantalla de inicio"); return; }
      } catch { /* sigue con instrucciones */ }
    }
    setExtra({ kind: "install" });
  };

  /* ---------- aviso en vivo de reservas nuevas desde la página ---------- */
  const knownIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    const ids = new Set(data.bookings.map((b) => b.id));
    if (knownIds.current) {
      const fresh = data.bookings.filter((b) => !knownIds.current!.has(b.id) && b.source === "online" && (b.createdAt || 0) > Date.now() - 10 * 60000);
      fresh.forEach((b) => {
        store.toast(`Nueva reserva: ${b.client} · ${dayLabel(b.date)} ${b.time}`, "ok", { label: "Ver", onClick: () => setBookingId(b.id) }, 9000);
      });
      let soundOn = true;
      try { soundOn = localStorage.getItem("cupito_sound") !== "0"; } catch { /* noop */ }
      if (fresh.length && soundOn) { try { sound.playSuccess(); } catch { /* sin audio */ } }
    }
    knownIds.current = ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.bookings]);

  /* ---------- atajos de teclado ---------- */
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearchOpen((o) => !o); return; }
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.closest("input, textarea, select, [contenteditable], [role=dialog]")) return;
      if (document.querySelector(".c-sheet")) return;
      if (e.key === "n" || e.key === "N") { e.preventDefault(); setNewPrefill({}); }
      if (e.key === "/") { e.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  const api = useMemo<PanelApi>(
    () => ({
      user,
      data,
      view: route.view,
      params: route.params,
      go,
      setParams,
      openBooking: (id) => { setClientKey(null); setBookingId(id); },
      openClient: (key) => { setBookingId(null); setClientKey(key); },
      newBooking: (p) => { setBookingId(null); setClientKey(null); setNewPrefill(p || {}); },
      blockTime: (p) => setBlockPrefill(p || {}),
      checkout: (plan) => setCheckoutPlan(plan),
      openSearch: () => setSearchOpen(true),
      openCalendarSync: (proId) => setExtra({ kind: "calendar", proId }),
      openShare: () => setExtra({ kind: "share" }),
    }),
    [user, data, route, go, setParams]
  );

  const settingsTab = (route.tab || "negocio") as SettingsTab;
  const view: View = route.view;

  return (
    <PanelCtx.Provider value={api}>
      <div className="cp">
        <Shell onLogout={() => { store.logout(); window.location.hash = "#/"; }} onInstall={install} banner={<Banners onCheckout={setCheckoutPlan} />}>
          {view === "inicio" ? (
            <HomeView />
          ) : (
            <Suspense fallback={<ViewFallback />}>
              {view === "agenda" && <AgendaView />}
              {view === "reservas" && <BookingsView />}
              {view === "clientes" && <ClientsView />}
              {view === "espera" && <WaitlistView />}
              {(view === "servicios" || view === "equipo" || view === "tienda" || view === "cupones") && <CatalogViews view={view} />}
              {view === "horarios" && <ScheduleView />}
              {view === "pagina" && <PageView />}
              {view === "stats" && <StatsView />}
              {view === "ajustes" && <SettingsView tab={settingsTab} />}
            </Suspense>
          )}
        </Shell>

        {bookingId && <BookingDrawer key={bookingId} id={bookingId} onClose={() => setBookingId(null)} />}
        {clientKey && <ClientDrawer key={clientKey} clientKey={clientKey} onClose={() => setClientKey(null)} />}
        {newPrefill && <BookingForm prefill={newPrefill} onClose={() => setNewPrefill(null)} />}
        {blockPrefill && <BlockSheet prefill={blockPrefill} onClose={() => setBlockPrefill(null)} />}
        {searchOpen && <CommandPalette onClose={() => setSearchOpen(false)} />}
        {extra && (
          <Suspense fallback={null}>
            <Extras extra={extra} onClose={() => setExtra(null)} onPlan={(p) => { setExtra(null); setCheckoutPlan(p); }} />
          </Suspense>
        )}
      </div>
      {checkoutPlan && <PlanCheckout plan={checkoutPlan} onClose={() => setCheckoutPlan(null)} />}
    </PanelCtx.Provider>
  );
}

/* ---------- avisos de suscripción y modo soporte ---------- */

function Banners({ onCheckout }: { onCheckout: (p: Plan) => void }) {
  const store = useStore();
  const user = store.user!;
  const s = getSubscriptionStatus(user);
  const items: { tone: "danger" | "warn" | "info"; icon: JSX.Element; text: string; action?: { label: string; run: () => void } }[] = [];
  if (store.impersonating) {
    items.push({ tone: "info", icon: <Users className="h-4 w-4" />, text: `Modo soporte: estás dentro de ${user.business}. Los cambios afectan su cuenta.`, action: { label: "Salir", run: () => { store.stopImpersonating(); window.location.hash = "#/central"; } } });
  }
  if (s.isExpired) {
    items.push({ tone: "danger", icon: <Lock className="h-4 w-4" />, text: `Tu período del plan ${PLAN_META[user.plan].name} terminó y la cuenta pasó a Semilla. Activá el débito automático para recuperar tus funciones.`, action: { label: "Activar", run: () => onCheckout(user.plan === "semilla" ? "crece" : user.plan) } });
  } else if (s.isGracePeriod) {
    items.push({ tone: "warn", icon: <AlertTriangle className="h-4 w-4" />, text: `Tu plan ${PLAN_META[user.plan].name} venció: tenés 3 días de gracia para renovarlo sin cortes.`, action: { label: "Renovar", run: () => onCheckout(user.plan) } });
  } else if (s.isExpiringSoon && !s.hasMpAutoDebit) {
    items.push({ tone: "warn", icon: <Clock className="h-4 w-4" />, text: `Tu plan vence en ${s.daysRemaining} días (${fmtDateHuman(new Date(user.subscription?.nextRenewal || Date.now()).toISOString())}). Con débito automático se renueva solo.`, action: { label: "Activar débito", run: () => onCheckout(user.plan) } });
  }
  if (!items.length) return null;
  return (
    <div className="px-3.5 pt-3 lg:px-6">
      {items.map((it, i) => (
        <div key={i} className={`c-callout c-callout--${it.tone} mx-auto mb-2 max-w-[1180px] items-center`}>
          {it.icon}
          <p className="min-w-0 flex-1">{it.text}</p>
          {it.action && <Button size="sm" onClick={it.action.run}>{it.action.label}</Button>}
        </div>
      ))}
    </div>
  );
}
