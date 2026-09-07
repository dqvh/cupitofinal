import { useEffect, useState } from "react";
import { usePublicPage, useStore } from "../lib/store";
import PublicBooking from "./PublicBooking";
import { LogoMark } from "./kit";
import { RotateCw } from "lucide-react";

/* Página pública de reservas: cupito.app/{slug} o cupito.app/reservar/{slug} */
export default function PublicPage({ slug }: { slug: string }) {
  const page = usePublicPage(slug);
  const { fetchPageRemote, sessionUserId } = useStore();

  // Los emails traen ?buscar=1 para abrir directo «Mis turnos» (ver/cancelar).
  // El pedido de reseña trae ?resena=1 para abrir directo el formulario de opiniones.
  const autoOpenLookup = (() => {
    try {
      if ((window.location.search || "").includes("buscar=1")) return true;
      const h = window.location.hash || "";
      if (h.includes("buscar=1")) return true;
    } catch { /* noop */ }
    return false;
  })();

  const autoOpenReview = (() => {
    try {
      if ((window.location.search || "").includes("resena=1")) return true;
      const h = window.location.hash || "";
      if (h.includes("resena=1")) return true;
    } catch { /* noop */ }
    return false;
  })();

  const [loadingRemote, setLoadingRemote] = useState(!page);

  useEffect(() => {
    // Si estoy viendo mi propia página logueado, lo local ya es lo más fresco.
    if (page && sessionUserId && page.user.id === sessionUserId) {
      setLoadingRemote(false);
      return;
    }

    // En cualquier otro caso (ej: cliente desde el celu), refrescar de la nube
    let cancelled = false;
    if (!page) setLoadingRemote(true);
    fetchPageRemote(slug).then(async (ok) => {
      if (!ok && !cancelled) {
        // Reintentar tras un breve delay por si recién se registró en otro dispositivo
        await new Promise((r) => setTimeout(r, 800));
        if (!cancelled) await fetchPageRemote(slug).catch(() => {});
      }
    }).catch(() => {}).finally(() => {
      if (!cancelled) {
        setLoadingRemote(false);
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  if (loadingRemote) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#edf8f2] px-6 text-center text-[#1e4530]">
        <LogoMark className="h-14 w-14 animate-pulse text-[#16845f]" />
        <div className="space-y-1">
          <p className="font-display text-2xl font-bold sm:text-3xl">Cargando {slug}...</p>
          <p className="text-xs text-[#527963]">Consultando disponibilidad en vivo</p>
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#edf8f2] px-6 text-center text-[#1e4530]">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#dcebe2] text-[#16845f]">
          <LogoMark className="h-10 w-10 text-[#16845f]" />
        </div>
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl text-[#1e4530]">
          Este negocio todavía no tiene su página
        </h1>
        <p className="max-w-sm text-sm text-[#527963]">
          Verificá que el link esté bien escrito o probá con la página de ejemplo para ver el funcionamiento.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href="#/reservar/studio-nails"
            className="btn primary"
            style={{ borderRadius: 999, padding: "12px 24px" }}
          >
            Ver página de ejemplo
          </a>
          <button
            type="button"
            onClick={() => {
              setLoadingRemote(true);
              fetchPageRemote(slug).finally(() => setLoadingRemote(false));
            }}
            className="btn inline-flex items-center gap-1.5"
            style={{ borderRadius: 999, padding: "12px 20px" }}
          >
            <RotateCw className="h-4 w-4" /> Reintentar
          </button>
        </div>
        <a href="#/" className="text-link" style={{ fontSize: 13, marginTop: 12 }}>
          ← Volver al inicio de Cupito
        </a>
      </div>
    );
  }

  return (
    <PublicBooking
      owner={page}
      initialLookupOpen={autoOpenLookup}
      initialReviewOpen={autoOpenReview}
    />
  );
}
