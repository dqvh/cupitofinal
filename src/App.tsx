import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { StoreProvider, useStore } from "./lib/store";
import Landing from "./Landing";
import Auth from "./components/Auth";
import Dashboard from "./components/Dashboard";
import PublicPage from "./components/PublicPage";
import AdminPanel from "./components/AdminPanel";
import { LogoMark } from "./components/kit";

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

function parseRoute(): { name: "landing" | "auth" | "app" | "b" | "admin"; query: string; slug?: string } {
  const h = window.location.hash || "#/";
  if (h.startsWith("#/auth")) return { name: "auth", query: h };
  if (h.startsWith("#/app")) return { name: "app", query: h };
  if (h.startsWith("#/central")) return { name: "admin", query: h };
  if (h.startsWith("#/b/")) return { name: "b", query: h, slug: h.slice(4).split("?")[0] };
  return { name: "landing", query: h };
}

function Router() {
  const [route, setRoute] = useState(parseRoute);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("preapproval_id") || params.get("preapprovalId") || params.get("preapproval")) {
      if (!window.location.hash.startsWith("#/app")) {
        window.location.hash = "#/app";
      }
    }
    const onHash = () => {
      setRoute(parseRoute());
      if (!window.location.hash.startsWith("#/")) {
        /* anclas internas: no scrollear al tope */
        return;
      }
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (route.name === "auth") {
    const mode = route.query.includes("modo=login") ? "login" : "registro";
    return <Auth initialMode={mode} />;
  }

  if (route.name === "admin") return <AdminPanel />;

  if (route.name === "b") return <PublicPage slug={route.slug || "studio-nails"} />;

  if (route.name === "app") return <Dashboard />;

  return <Landing />;
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
