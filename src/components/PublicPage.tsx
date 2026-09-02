import { usePublicPage, fmtLong, fmtMoney, isPaid, type BizData } from "../lib/store";
import PublicBooking from "./PublicBooking";
import { Reveal, LogoMark, IconCheck, IconClock, IconCalendar, IconBag, IconStar, IconWhatsApp, IconChat, IconChevron, IconBell } from "./kit";

/* Página pública de reservas: cupito.app/{slug} — la ve cualquier cliente */
export default function PublicPage({ slug }: { slug: string }) {
  const page = usePublicPage(slug);

  if (!page) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-evergreen px-6 text-center text-paper">
        <LogoMark className="h-14 w-14 text-fern" />
        <p className="font-display text-3xl font-extrabold sm:text-4xl">Ese negocio todavía no tiene su página <span className="text-lime">:(</span></p>
        <p className="max-w-sm text-paper/70">Probá con la página de ejemplo para ver cómo funciona.</p>
        <a href="#/b/studio-nails" className="rounded-full bg-lime px-7 py-3.5 font-display text-base font-bold text-ink transition-all duration-200 hover:-translate-y-0.5 hover:bg-limedeep">Ver página de ejemplo</a>
        <a href="#/" className="text-sm text-paper/50 underline-offset-4 transition-colors hover:text-lime hover:underline">← Volver al inicio</a>
      </div>
    );
  }

  const { user } = page;
  const biz: BizData = page.data;
  const s = biz.settings;
  const paid = isPaid(user);
  const avg = biz.reviews.length > 0 ? biz.reviews.reduce((a, r) => a + r.rating, 0) / biz.reviews.length : null;

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b-2 border-ink/10 bg-evergreen text-paper">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3.5 sm:px-8">
          <a href="#/" className="group flex items-center gap-2">
            <LogoMark className="h-8 w-8 text-fern transition-transform duration-300 group-hover:-rotate-6" />
            <span className="font-display text-xl font-bold tracking-tight">cupito<span className="text-lime">.</span></span>
          </a>
          <span className="rounded-full bg-paper/10 px-3.5 py-1.5 text-xs font-bold text-paper/80">cupito.app/{user.slug}</span>
        </div>
      </header>

      {/* hero del negocio */}
      <section className="relative overflow-hidden bg-evergreen pb-16 pt-12 text-paper">
        <div className="gridlines absolute inset-0" aria-hidden="true" />
        <div className="absolute -top-24 left-1/2 h-72 w-[560px] -translate-x-1/2 rounded-full opacity-20 blur-3xl" style={{ background: "radial-gradient(circle, #cdf463 0%, transparent 65%)" }} aria-hidden="true" />
        <div className="relative mx-auto max-w-3xl px-5 text-center sm:px-8">
          <h1 className="mx-auto max-w-2xl font-display text-[clamp(2.4rem,6vw,4rem)] font-extrabold leading-[1.02] tracking-[-0.02em]">{user.business}</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-paper/70">
            {s.description || "Reservá tu cupito en menos de un minuto. Sin llamadas, sin apps, sin esperar respuesta."}
          </p>

          {avg !== null && (
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-lime/30 bg-lime/10 px-4 py-1.5">
              <span className="flex gap-0.5 text-lime">
                {[...Array(5)].map((_, i) => <IconStar key={i} className={`h-3.5 w-3.5 ${i < Math.round(avg) ? "" : "opacity-25"}`} />)}
              </span>
              <span className="text-sm font-bold text-paper">{avg.toFixed(1)} · {biz.reviews.length} reseña{biz.reviews.length === 1 ? "" : "s"}</span>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-paper/60">
            <span className="inline-flex items-center gap-2"><IconClock className="h-4 w-4 text-lime" /> Abierto 24/7 para reservar</span>
            <span className="inline-flex items-center gap-2"><IconCalendar className="h-4 w-4 text-lime" /> Confirmación al instante</span>
            {s.address && <span className="inline-flex items-center gap-2"><IconCalendar className="h-4 w-4 text-lime" /> {s.address}</span>}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {s.whatsapp && (
              <a href={`https://wa.me/54${s.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-lime px-5 py-2.5 font-display text-sm font-bold text-ink transition-all hover:-translate-y-0.5 hover:bg-limedeep">
                <IconWhatsApp className="h-4 w-4" /> Escribinos por WhatsApp
              </a>
            )}
            {s.instagram && (
              <a href={`https://instagram.com/${s.instagram}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border-2 border-paper/25 px-5 py-2.5 font-display text-sm font-bold text-paper transition-all hover:border-lime hover:text-lime">
                <IconChat className="h-4 w-4" /> @{s.instagram}
              </a>
            )}
            {s.mapsUrl && (
              <>
                <a href={s.mapsUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border-2 border-paper/25 px-5 py-2.5 font-display text-sm font-bold text-paper transition-all hover:border-lime hover:text-lime">
                  📍 Cómo llegar
                </a>
                <a href={s.mapsUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border-2 border-paper/25 px-5 py-2.5 font-display text-sm font-bold text-paper transition-all hover:border-lime hover:text-lime">
                  <IconStar className="h-4 w-4 text-lime" /> Dejanos tu opinión en Google
                </a>
              </>
            )}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-5xl px-5 py-12 sm:px-8">
        <div id="reservar" className="grid items-start gap-10 scroll-mt-24 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <p className="inline-flex items-center gap-2 rounded-full bg-fern/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-fern">Así de fácil</p>
            <h2 className="mt-4 font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.02em] text-ink">
              Tu cupito en <span className="text-coral">60 segundos</span>.
            </h2>

            {/* ticket perforado */}
            <div className="mt-7 rounded-[20px] border-2 border-ink/12 bg-card shadow-block-ink">
              <div className="flex items-center justify-between gap-3 border-b-2 border-dashed border-ink/12 px-5 py-3">
                <p className="font-display text-[11px] font-extrabold uppercase tracking-[0.2em] text-inkmute">Ticket de reserva · {user.business}</p>
                <span className="rotate-2 rounded-md bg-lime px-2 py-0.5 font-display text-[10px] font-extrabold uppercase tracking-wider text-ink">≈ 1 min</span>
              </div>
              <div className="grid sm:grid-cols-3">
                {[
                  { icon: <IconCalendar className="h-4 w-4" />, t: "Elegí tu momento", d: "Servicio, día y hora libres, en tiempo real." },
                  { icon: <IconCheck className="h-4 w-4" />, t: "Confirmá tu cupito", d: "Nombre y teléfono. Si hay seña, la transferís al toque." },
                  { icon: <IconBell className="h-4 w-4" />, t: "Nos vemos ahí", d: "Recordatorio al calendario 24 h y 1 h antes. Sin olvidos." },
                ].map((st, i) => (
                  <div key={st.t} className={`relative p-5 ${i > 0 ? "border-t-2 border-dashed border-ink/12 sm:border-t-0" : ""}`}>
                    {i > 0 && (
                      <>
                        <div className="absolute inset-y-0 left-0 hidden border-l-2 border-dashed border-ink/12 sm:block" aria-hidden="true" />
                        <span className="absolute left-0 top-0 hidden h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink/12 bg-paper sm:block" aria-hidden="true" />
                        <span className="absolute bottom-0 left-0 hidden h-5 w-5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-ink/12 bg-paper sm:block" aria-hidden="true" />
                      </>
                    )}
                    <span className={`inline-flex h-10 w-10 -rotate-3 items-center justify-center rounded-xl font-display text-lg font-extrabold transition-transform duration-300 hover:rotate-3 ${i === 1 ? "bg-coral text-white" : "bg-evergreen text-lime"}`}>
                      {i + 1}
                    </span>
                    <p className="mt-3 font-display text-[15px] font-extrabold text-ink">{st.t}</p>
                    <p className="mt-1 flex items-start gap-1.5 text-[13px] leading-snug text-inkmute">
                      <span className="mt-0.5 text-fern">{st.icon}</span>{st.d}
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

          <Reveal delay={140}>
            <PublicBooking owner={page} />
          </Reveal>
        </div>

        {/* tienda */}
        {paid && biz.products.length > 0 && (
          <Reveal className="mt-20">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full bg-fern/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-fern">
                  <IconBag className="h-4 w-4" /> Nuestra tienda
                </p>
                <h2 className="mt-4 font-display text-4xl font-extrabold tracking-[-0.02em] text-ink">Llevate algo más que un turno.</h2>
                <p className="mt-2 max-w-xl text-inkmute">Sumá productos a tu reserva y retirá todo junto cuando vengas.</p>
              </div>
              <a href="#reservar" className="inline-flex items-center gap-2 rounded-full bg-evergreen px-5 py-3 font-display text-sm font-bold text-lime transition-all hover:-translate-y-0.5 hover:bg-pine">
                Reservar y agregar productos <IconChevron className="h-4 w-4" />
              </a>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {biz.products.map((p) => (
                <div key={p.id} className="card card-hover flex flex-col p-5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-lime/40 text-fern"><IconBag className="h-5 w-5" /></span>
                  <p className="mt-3 font-display text-[15px] font-extrabold text-ink">{p.name}</p>
                  <p className="mt-1 flex-1 text-xs leading-snug text-inkmute">{p.desc}</p>
                  <p className="mt-3 font-display text-xl font-extrabold text-fern">{fmtMoney(p.price)}</p>
                </div>
              ))}
            </div>
          </Reveal>
        )}

        {/* reseñas */}
        {biz.reviews.length > 0 && (
          <Reveal delay={120} className="mt-20">
            <div className="rounded-[24px] border-2 border-ink/10 bg-card p-7 shadow-block-ink sm:p-9">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-4xl font-extrabold text-ink">{avg?.toFixed(1)}</span>
                    <span className="flex gap-0.5 text-limedeep">
                      {[...Array(5)].map((_, i) => <IconStar key={i} className={`h-4 w-4 ${avg !== null && i < Math.round(avg) ? "" : "opacity-25"}`} />)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-inkmute">{biz.reviews.length} reseña{biz.reviews.length === 1 ? "" : "s"} de clientes reales</p>
                </div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-inkmute">Opiniones verificadas</p>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {biz.reviews.slice(0, 4).map((r) => (
                  <figure key={r.id} className="rounded-2xl border-2 border-ink/8 bg-white/60 p-5 transition-all duration-200 hover:-translate-y-1 hover:border-evergreen hover:shadow-block-ink">
                    <div className="flex gap-0.5 text-limedeep">
                      {[...Array(5)].map((_, i) => <IconStar key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "" : "opacity-25"}`} />)}
                    </div>
                    <blockquote className="mt-3 text-[15px] leading-snug text-ink">“{r.text}”</blockquote>
                    <figcaption className="mt-3 flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-fern font-display text-[10px] font-bold text-lime">
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
            </div>
          </Reveal>
        )}

        <p className="mt-10 text-center text-sm text-inkmute">
          ¿Tenés un negocio y querés una página así?{" "}
          <a href="#/auth" className="font-display font-bold text-fern underline decoration-limedeep decoration-2 underline-offset-4 transition-colors hover:text-evergreen">
            Creala gratis en 10 minutos →
          </a>
        </p>
      </main>

      <footer className="border-t-2 border-ink/10 bg-card py-6 text-center text-xs text-inkmute">
        <span className="inline-flex items-center gap-1.5">
          <IconCheck className="h-3.5 w-3.5 text-fern" /> Hecho con <a href="#/" className="font-display font-bold text-ink">cupito.</a> — reservas online para negocios con turno
        </span>
      </footer>
    </div>
  );
}
