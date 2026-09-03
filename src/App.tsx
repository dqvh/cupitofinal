import { Component, Suspense, lazy, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { StoreProvider, useStore } from "./lib/store";
import { LogoMark } from "./components/kit";

/* Code splitting por ruta: cada pantalla se descarga solo cuando se visita.
   Antes todo (panel + landing + librerías pesadas) iba en un solo JS de ~800KB. */
const Landing = lazy(() => import("./Landing"));
const Auth = lazy(() => import("./components/Auth"));
const Dashboard = lazy(() => import("./components/Dashboard"));
const PublicPage = lazy(() => import("./components/PublicPage"));
const AdminPanel = lazy(() => import("./components/AdminPanel"));

function RouteLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-evergreen px-6 text-center text-paper">
      <LogoMark className="h-14 w-14 animate-pulse text-lime" />
      <p className="font-display text-xl font-extrabold">Cargando Cupito…</p>
    </div>
  );
}

/* Si algo explota en tiempo de ejecución, mostramos esto en vez de pantalla en blanco */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Cupito] Error de render:", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-evergreen px-6 text-center text-paper">
        <LogoMark className="h-14 w-14 text-fern" />
        <p className="font-display text-3xl font-extrabold">Algo se rompió <span className="text-coral">:(</span></p>
        <p className="max-w-md text-sm text-paper/70">
          Recargá la página. Si el problema sigue, este es el error técnico (copialo y mandanoslo):
        </p>
        <code className="max-w-md rounded-xl border border-paper/20 bg-pine/70 px-4 py-3 text-left text-xs text-coral">{String(this.state.error)}</code>
        <button onClick={() => window.location.reload()} className="rounded-full bg-lime px-7 py-3 font-display font-bold text-ink transition-all hover:-translate-y-0.5 hover:bg-limedeep">
          Recargar Cupito
        </button>
      </div>
    );
  }
}

/* Barra de progreso de scroll */
function ScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setP(max > 0 ? (h.scrollTop / max) * 100 : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return <div className="fixed inset-x-0 top-0 z-[95] h-1 bg-lime transition-[width] duration-150" style={{ width: `${p}%` }} aria-hidden="true" />;
}

export const RESERVED_PATHS = new Set([
  "",
  "admin",
  "central",
  "auth",
  "login",
  "registro",
  "app",
  "dashboard",
  "precios",
  "problema",
  "solucion",
  "faq",
  "terms",
  "privacy",
  "terminos",
  "privacidad",
  "api",
  "assets",
  "static",
  "favicon",
  "robots.txt",
  "sitemap.xml",
]);

function parseRoute(): { name: "landing" | "auth" | "app" | "b" | "admin"; query: string; slug?: string } {
  const h = window.location.hash || "";
  const p = window.location.pathname || "/";

  // Usar hash si existe (ej. #/studio-nails), o pathname limpio (ej. /studio-nails)
  const raw = h.startsWith("#/") ? h.slice(2) : p.startsWith("/") ? p.slice(1) : p;
  const clean = raw.split("?")[0].split("#")[0].trim();
  const path = clean.toLowerCase();
  const query = h || window.location.search;

  if (path === "admin" || path === "central" || path.startsWith("admin/") || path.startsWith("central/")) {
    return { name: "admin", query };
  }
  if (path === "auth" || path === "login" || path === "registro" || path.startsWith("auth/")) {
    return { name: "auth", query };
  }
  if (path === "app" || path === "dashboard" || path.startsWith("app/")) {
    return { name: "app", query };
  }

  // Compatibilidad hacia atrás: si tiene el prefijo legacy /b/slug
  if (path.startsWith("b/")) {
    const slug = clean.slice(2).trim();
    return { name: "b", query, slug };
  }

  // Si es un slug de negocio directo en la raíz (ej: cupito.app/studio-nails)
  const rootSlug = clean.split("/")[0].trim();
  if (rootSlug && !RESERVED_PATHS.has(rootSlug.toLowerCase())) {
    return { name: "b", query, slug: rootSlug };
  }

  return { name: "landing", query };
}

function Router() {
  const [route, setRoute] = useState(parseRoute);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("preapproval_id") || params.get("preapprovalId") || params.get("preapproval")) {
      if (!window.location.hash.startsWith("#/app") && window.location.pathname !== "/app") {
        window.location.hash = "#/app";
      }
    }
    const onNav = () => {
      setRoute(parseRoute());
      if (window.location.hash && !window.location.hash.startsWith("#/")) {
        /* anclas internas: no scrollear al tope */
        return;
      }
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onNav);
    window.addEventListener("popstate", onNav);
    return () => {
      window.removeEventListener("hashchange", onNav);
      window.removeEventListener("popstate", onNav);
    };
  }, []);

  if (route.name === "auth") {
    const mode = route.query.includes("modo=login") ? "login" : "registro";
    return (
      <Suspense fallback={<RouteLoader />}>
        <Auth initialMode={mode} />
      </Suspense>
    );
  }

  if (route.name === "admin") {
    return (
      <Suspense fallback={<RouteLoader />}>
        <AdminPanel />
      </Suspense>
    );
  }

  if (route.name === "b") {
    return (
      <Suspense fallback={<RouteLoader />}>
        <PublicPage slug={route.slug || "studio-nails"} />
      </Suspense>
    );
  }

  if (route.name === "app") {
    return (
      <Suspense fallback={<RouteLoader />}>
        <Dashboard />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<RouteLoader />}>
      <Landing />
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <div className="min-h-screen overflow-x-clip bg-paper font-body text-ink antialiased">
          <div className="noise" aria-hidden="true" />
          <ScrollProgress />
          <Router />
        </div>
      </StoreProvider>
    </ErrorBoundary>
  );
}
