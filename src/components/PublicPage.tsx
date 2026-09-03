import { useEffect, useState } from "react";
import { usePublicPage, useStore, fmtLong, fmtMoney, isPaid, THEMES, dateKey, type BizData } from "../lib/store";
import PublicBooking from "./PublicBooking";
import { Reveal, LogoMark, IconCheck, IconClock, IconCalendar, IconBag, IconStar, IconWhatsApp, IconChat, IconChevron, IconBell, CopyButton } from "./kit";

/* Página pública de reservas: cupito.app/{slug} — la ve cualquier cliente */
export default function PublicPage({ slug }: { slug: string }) {
  const page = usePublicPage(slug);
  const { addReviewFor, toast, fetchPageRemote, sessionUserId } = useStore();
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [loadingRemote, setLoadingRemote] = useState(!page);

  // Los emails traen ?buscar=1 para abrir directo «Mis turnos» (ver/cancelar).
  const autoOpenLookup = (() => {
    try {
      if ((window.location.search || "").includes("buscar=1")) return true;
      const h = window.location.hash || "";
      if (h.includes("buscar=1")) return true;
    } catch { /* noop */ }
    return false;
  })();

  useEffect(() => {
    // Si estoy viendo mi propia página logueado, lo local ya es lo más fresco.
    if (page && sessionUserId && page.user.id === sessionUserId) {
      setLoadingRemote(false);
      return;
    }
    // En cualquier otro caso (ej: cliente desde el celu), refrescar de la nube
    // aunque haya algo en local: lo local puede ser un duplicado vacío y viejo.
    let cancelled = false;
    if (!page) setLoadingRemote(true);
    fetchPageRemote(slug).catch(() => {}).finally(() => {
      if (!cancelled) {
        setLoadingRemote(false);
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  if (loadingRemote) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-evergreen px-6 text-center text-paper">
        <LogoMark className="h-16 w-16 animate-pulse text-lime" />
        <div className="space-y-1">
          <p className="font-display text-2xl font-extrabold sm:text-3xl">Buscando {slug}...</p>
          <p className="text-xs text-paper/60">Cargando agenda en vivo desde la nube ☁️</p>
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-evergreen px-6 text-center text-paper">
        <LogoMark className="h-14 w-14 text-fern" />
        <p className="font-display text-3xl font-extrabold sm:text-4xl">Ese negocio todavía no tiene su página <span className="text-lime">:(</span></p>
        <p className="max-w-sm text-paper/70">Probá con la página de ejemplo para ver cómo funciona.</p>
        <a href="/studio-nails" className="rounded-full bg-lime px-7 py-3.5 font-display text-base font-bold text-ink transition-all duration-200 hover:-translate-y-0.5 hover:bg-limedeep">Ver página de ejemplo</a>
        <a href="#/" className="text-sm text-paper/50 underline-offset-4 transition-colors hover:text-lime hover:underline">← Volver al inicio</a>
      </div>
    );
  }

  const { user } = page;
  const biz: BizData = page.data;
  const s = biz.settings;
  const paid = isPaid(user);
  const activeThemeId = paid ? (s.theme ?? "evergreen") : "evergreen";
  const theme = THEMES[activeThemeId] ?? THEMES.evergreen;
  const avg = biz.reviews.length > 0 ? biz.reviews.reduce((a, r) => a + r.rating, 0) / biz.reviews.length : null;

  return (
    <div className="min-h-screen bg-paper">
      <header className={`border-b-2 border-ink/10 ${theme.headerBg} ${theme.headerText}`}>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3.5 sm:px-8">
          <a href="#/" className="group flex items-center gap-2">
            <LogoMark className={`h-8 w-8 ${theme.accentText} transition-transform duration-300 group-hover:-rotate-6`} />
            <span className="font-display text-xl font-bold tracking-tight">cupito<span className={theme.accentText}>.</span></span>
          </a>
          <span className="rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-bold opacity-80">cupito.app/{user.slug}</span>
        </div>
      </header>

      {/* hero del negocio */}
      <section className={`relative overflow-hidden ${theme.headerBg} pb-16 pt-12 ${theme.headerText}`}>
        <div className="gridlines absolute inset-0 opacity-30" aria-hidden="true" />
        <div className="absolute -top-24 left-1/2 h-72 w-[560px] -translate-x-1/2 rounded-full opacity-20 blur-3xl bg-gradient-to-tr" style={{ background: "radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 65%)" }} aria-hidden="true" />
        <div className="relative mx-auto max-w-3xl px-5 text-center sm:px-8">
          <h1 className="mx-auto max-w-2xl font-display text-[clamp(2.4rem,6vw,4rem)] font-extrabold leading-[1.02] tracking-[-0.02em]">{user.business}</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg opacity-80">
            {s.description || "Reservá tu cupito en menos de un minuto. Sin llamadas, sin apps, sin esperar respuesta."}
          </p>

          {avg !== null && (
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 backdrop-blur-sm">
              <span className={`flex gap-0.5 ${theme.ratingStar}`}>
                {[...Array(5)].map((_, i) => <IconStar key={i} className={`h-3.5 w-3.5 ${i < Math.round(avg) ? "" : "opacity-25"}`} />)}
              </span>
              <span className="text-sm font-bold">{avg.toFixed(1)} · {biz.reviews.length} reseña{biz.reviews.length === 1 ? "" : "s"}</span>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm opacity-75">
            <span className="inline-flex items-center gap-2"><IconClock className={`h-4 w-4 ${theme.accentText}`} /> Abierto 24/7 para reservar</span>
            <span className="inline-flex items-center gap-2"><IconCalendar className={`h-4 w-4 ${theme.accentText}`} /> Confirmación al instante</span>
            {s.address && <span className="inline-flex items-center gap-2">📍 {s.address}</span>}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {s.whatsapp && (
              <a href={`https://wa.me/54${s.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                className={`inline-flex items-center gap-2 rounded-full ${theme.accentBg} ${theme.badgeText} px-5 py-2.5 font-display text-sm font-bold transition-all hover:-translate-y-0.5 shadow-sm`}>
                <IconWhatsApp className="h-4 w-4" /> Escribinos por WhatsApp
              </a>
            )}
            {s.instagram && (
              <a href={`https://instagram.com/${s.instagram}`} target="_blank" rel="noreferrer"
                className={`inline-flex items-center gap-2 rounded-full border-2 border-white/30 px-5 py-2.5 font-display text-sm font-bold transition-all hover:border-white hover:${theme.accentText}`}>
                <IconChat className="h-4 w-4" /> @{s.instagram}
              </a>
            )}
            {s.mapsUrl && (
              <a href={s.mapsUrl} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border-2 border-white/30 px-5 py-2.5 font-display text-sm font-bold transition-all hover:border-white">
                📍 Cómo llegar
              </a>
            )}
            <CopyButton
              text={typeof window !== "undefined" ? window.location.origin + "/" + user.slug : `https://cupito.app/${user.slug}`}
              label="Compartir link"
              copiedLabel="¡Link copiado!"
              className="border-2 border-white/30 !bg-white/10 !text-white hover:!bg-white/25 px-5 py-2.5 font-display text-sm font-bold"
            />
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-5xl px-5 py-12 sm:px-8">
        <div id="reservar" className="grid items-start gap-10 scroll-mt-24 lg:grid-cols-[0.9fr_1.1fr]">
          {/* Widget de reserva: en celulares va primero (order-1) para que el cliente no tenga que scrollear */}
          <div className="order-1 lg:order-2">
            <Reveal delay={140}>
              <PublicBooking owner={page} initialLookupOpen={autoOpenLookup} />
            </Reveal>
          </div>

          {/* Información y Ticket explicativo: en celular va abajo (order-2) */}
          <div className="order-2 lg:order-1">
            <Reveal>
              <p className={`inline-flex items-center gap-2 rounded-full ${theme.badgeBg} ${theme.badgeText} px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em]`}>
                Así de fácil
              </p>
              <h2 className="mt-4 font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.02em] text-ink">
                Tu cupito en <span className="text-coral">60 segundos</span>.
              </h2>

              {/* ticket perforado */}
              <div className="mt-7 rounded-[20px] border-2 border-ink/12 bg-card shadow-block-ink">
                <div className="flex items-center justify-between gap-3 border-b-2 border-dashed border-ink/12 px-5 py-3">
                  <p className="font-display text-[11px] font-extrabold uppercase tracking-[0.2em] text-inkmute">Ticket de reserva · {user.business}</p>
                  <span className={`rotate-2 rounded-md ${theme.badgeBg} ${theme.badgeText} px-2 py-0.5 font-display text-[10px] font-extrabold uppercase tracking-wider`}>≈ 1 min</span>
                </div>
                <div className="grid sm:grid-cols-3">
                  {[
                    { icon: <IconCalendar className="h-4 w-4" />, t: "Elegí tu momento", d: "Servicio, día y hora libres, en tiempo real." },
                    { icon: <IconCheck className="h-4 w-4" />, t: "Confirmá tu cupito", d: "Nombre y teléfono. Si hay seña, la transferís al toque." },
                    { icon: <IconBell className="h-4 w-4" />, t: "Nos vemos ahí", d: "Guardalo en tu calendario y recibí recordatorio. Sin olvidos." },
                  ].map((st, i) => (
                    <div key={st.t} className={`relative p-5 ${i > 0 ? "border-t-2 border-dashed border-ink/12 sm:border-t-0" : ""}`}>
                      {i > 0 && (
                        <>
                          <div className="absolute inset-y-0 left-0 hidden border-l-2 border-dashed border-ink/12 sm:block" aria-hidden="true" />
                          <span className="absolute left-0 top-0 hidden h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink/12 bg-paper sm:block" aria-hidden="true" />
                          <span className="absolute bottom-0 left-0 hidden h-5 w-5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-ink/12 bg-paper sm:block" aria-hidden="true" />
                        </>
                      )}
                      <span className={`inline-flex h-10 w-10 -rotate-3 items-center justify-center rounded-xl font-display text-lg font-extrabold transition-transform duration-300 hover:rotate-3 ${theme.cardHeaderBg} ${theme.accentText}`}>
                        {i + 1}
                      </span>
                      <p className="mt-3 font-display text-[15px] font-extrabold text-ink">{st.t}</p>
                      <p className="mt-1 flex items-start gap-1.5 text-[13px] leading-snug text-inkmute">
                        <span className="mt-0.5 text-ink/70">{st.icon}</span>{st.d}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {biz.services.slice(0, 4).map((sv) => (
                  <span key={sv.id} className="rounded-full border-2 border-ink/10 bg-card px-3.5 py-1.5 text-xs font-bold text-ink/70">
                    {sv.name} · {fmtMoney(sv.price)}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>
        </div>

        {/* tienda */}
        {paid && biz.products.length > 0 && (
          <Reveal className="mt-20">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className={`inline-flex items-center gap-2 rounded-full ${theme.badgeBg} ${theme.badgeText} px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em]`}>
                  <IconBag className="h-4 w-4" /> Nuestra tienda
                </p>
                <h2 className="mt-4 font-display text-4xl font-extrabold tracking-[-0.02em] text-ink">Llevate algo más que un turno.</h2>
                <p className="mt-2 max-w-xl text-inkmute">Sumá productos a tu reserva y retirá todo junto cuando vengas.</p>
              </div>
              <a href="#reservar" className={`inline-flex items-center gap-2 rounded-full ${theme.primaryBtn} px-5 py-3 font-display text-sm font-bold transition-all hover:-translate-y-0.5 shadow-sm`}>
                Reservar y agregar productos <IconChevron className="h-4 w-4" />
              </a>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {biz.products.map((p) => (
                <div key={p.id} className="card card-hover flex flex-col p-5">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${theme.badgeBg} ${theme.badgeText}`}><IconBag className="h-5 w-5" /></span>
                  <p className="mt-3 font-display text-[15px] font-extrabold text-ink">{p.name}</p>
                  <p className="mt-1 flex-1 text-xs leading-snug text-inkmute">{p.desc}</p>
                  <p className="mt-3 font-display text-xl font-extrabold text-ink">{fmtMoney(p.price)}</p>
                </div>
              ))}
            </div>
          </Reveal>
        )}

        {/* reseñas reales */}
        <Reveal delay={120} className="mt-20">
          <div className="rounded-[24px] border-2 border-ink/10 bg-card p-7 shadow-block-ink sm:p-9">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink/10 pb-6">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-4xl font-extrabold text-ink">{avg ? avg.toFixed(1) : "5.0"}</span>
                  <span className={`flex gap-0.5 ${theme.ratingStar}`}>
                    {[...Array(5)].map((_, i) => <IconStar key={i} className={`h-4 w-4 ${avg !== null && i < Math.round(avg) ? "" : "opacity-25"}`} />)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-inkmute">
                  {biz.reviews.length > 0 ? `${biz.reviews.length} reseña${biz.reviews.length === 1 ? "" : "s"} de clientes reales` : "Todavía no hay reseñas. ¡Sé el primero en opinar!"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReviewModal(true)}
                className={`inline-flex items-center gap-2 rounded-full ${theme.primaryBtn} px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider transition-all hover:-translate-y-0.5 shadow-sm`}
              >
                ⭐ Dejar una reseña
              </button>
            </div>

            {biz.reviews.length > 0 ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {biz.reviews.map((r) => (
                  <figure key={r.id} className="rounded-2xl border-2 border-ink/8 bg-white/60 p-5 transition-all duration-200 hover:-translate-y-1 hover:border-ink/30 hover:shadow-block-ink">
                    <div className={`flex gap-0.5 ${theme.ratingStar}`}>
                      {[...Array(5)].map((_, i) => <IconStar key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "" : "opacity-25"}`} />)}
                    </div>
                    <blockquote className="mt-3 text-[15px] leading-snug text-ink">“{r.text}”</blockquote>
                    <figcaption className="mt-3 flex items-center gap-2.5">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full ${theme.cardHeaderBg} font-display text-[10px] font-bold ${theme.accentText}`}>
                        {r.client.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                      </span>
                      <span>
                        <span className="block font-display text-sm font-bold text-ink">{r.client}</span>
                        <span className="block text-xs text-inkmute">{fmtLong(r.date)}</span>
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : null}
          </div>
        </Reveal>

        <p className="mt-10 text-center text-sm text-inkmute">
          ¿Tenés un negocio y querés una página así?{" "}
          <a href="#/auth" className="font-display font-bold text-ink underline decoration-2 underline-offset-4 transition-colors hover:opacity-75">
            Creala gratis en 10 minutos →
          </a>
        </p>
      </main>

      <footer className="border-t-2 border-ink/10 bg-card py-6 text-center text-xs text-inkmute">
        <span className="inline-flex items-center gap-1.5">
          <IconCheck className="h-3.5 w-3.5 text-emerald-600" /> Hecho con <a href="#/" className="font-display font-bold text-ink">cupito.</a> — reservas online para negocios con turno
        </span>
      </footer>

      {showReviewModal && (
        <LeaveReviewModal
          businessName={user.business}
          theme={theme}
          onClose={() => setShowReviewModal(false)}
          onSubmit={(rev) => {
            addReviewFor(user.id, rev);
            toast("¡Gracias por tu reseña! Ya está visible en la página ⭐");
            setShowReviewModal(false);
          }}
        />
      )}
    </div>
  );
}

/* Modal para que un cliente real deje una reseña */
function LeaveReviewModal({
  businessName,
  theme,
  onClose,
  onSubmit,
}: {
  businessName: string;
  theme: any;
  onClose: () => void;
  onSubmit: (r: { client: string; rating: number; text: string; date: string }) => void;
}) {
  const [client, setClient] = useState("");
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (client.trim().length < 2) return setError("Por favor ingresá tu nombre.");
    if (text.trim().length < 5) return setError("Por favor escribí un breve comentario sobre tu experiencia.");
    onSubmit({
      client: client.trim(),
      rating,
      text: text.trim(),
      date: dateKey(new Date()),
    });
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="pop-in max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border-2 border-ink/15 bg-paper p-6 shadow-2xl text-ink" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-ink/10 pb-3">
          <h3 className="font-display text-lg font-extrabold text-ink">Dejar reseña para {businessName}</h3>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-inkmute hover:bg-ink/5 hover:text-ink">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-inkmute">Tu nombre o apodo *</label>
            <input
              className="field"
              placeholder="Ej. Sofía Gómez"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-inkmute">Calificación</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setRating(star)}
                  className="rounded-xl border-2 border-ink/10 bg-white p-2.5 transition-all hover:scale-110 active:scale-95"
                >
                  <IconStar className={`h-6 w-6 ${star <= rating ? theme.ratingStar : "text-ink/20"}`} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-inkmute">Tu opinión / comentario *</label>
            <textarea
              className="field min-h-[90px]"
              placeholder="Contanos cómo fue tu experiencia..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-xs font-semibold text-coral">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full border-2 border-ink/15 py-3 font-display text-sm font-bold text-ink hover:bg-ink/5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`flex-1 rounded-full ${theme.primaryBtn} py-3 font-display text-sm font-bold shadow-md transition-all hover:-translate-y-0.5`}
            >
              Publicar reseña
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
