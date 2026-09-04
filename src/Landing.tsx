import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useStore, type Plan } from "./lib/store";
import { createMercadoPagoCheckout, isPaidPlan, savePendingCheckout } from "./lib/billing";
import {
  Reveal,
  LogoMark,
  IconArrow,
  IconPlay,
  IconSpark,
  IconStar,
  IconCheck,
  IconChevron,
  IconChat,
  IconClock,
  IconCalendar,
  IconWallet,
  IconLink,
  IconBell,
  IconUsers,
  IconChart,
  IconBag,
  IconWhatsApp,
  IconMail,
  IconInstagram,
  LegalModal,
  TERMS_DOC,
  PRIVACY_DOC,
} from "./components/kit";

/* ================================================================
   LANDING CUPITO
   ================================================================ */

export default function Landing() {
  return (
    <div className="bg-paper">
      <Nav />
      <main>
        <Hero />
        <Solution />
        <RoiCalculator />
        <Pricing />
        <Features />
        <Faq />
      </main>
      <StickyMobileBar />
      <Footer />
    </div>
  );
}

/* ============ NAV ============ */
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { user } = useStore();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "#solucion", label: "¿Cómo funciona?" },
    { href: "#precios", label: "Precios" },
    { href: "#beneficios", label: "Funciones" },
    { href: "#faq", label: "FAQ" },
  ];

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? "bg-evergreen/95 py-2.5 shadow-lg shadow-black/20 backdrop-blur" : "bg-transparent py-4"}`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 sm:px-8">
        <a href="#inicio" className="group flex items-center gap-2.5 text-paper">
          <LogoMark className="h-9 w-9 text-fern transition-transform duration-300 group-hover:-rotate-6" />
          <span className="font-display text-2xl font-bold tracking-tight">cupito<span className="text-lime">.</span></span>
        </a>
        <nav className="hidden items-center gap-7 lg:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-sm font-semibold text-paper/70 transition-colors duration-200 hover:text-lime">{l.label}</a>
          ))}
          <a href="/studio-nails" target="_blank" rel="noreferrer" className="text-sm font-semibold text-lime/80 transition-colors duration-200 hover:text-lime">Ver ejemplo</a>
        </nav>
        <div className="flex items-center gap-3">
          {user ? (
            <a href="#/app" className="group inline-flex items-center gap-2 rounded-full bg-lime px-5 py-2.5 text-sm font-bold text-ink transition-all duration-200 hover:-translate-y-0.5 hover:bg-limedeep hover:shadow-[0_10px_30px_rgba(205,244,99,0.35)]">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-evergreen font-display text-[10px] text-lime">
                {user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
              </span>
              Mi panel
              <IconArrow className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </a>
          ) : (
            <>
              <a href="#/auth?modo=login" className="hidden rounded-full border-2 border-paper/25 px-5 py-2.5 text-sm font-bold text-paper transition-all duration-200 hover:border-lime hover:text-lime sm:block">Entrar</a>
              <a href="#/auth" className="rounded-full bg-lime px-3.5 py-2.5 text-xs font-bold text-ink transition-all duration-200 hover:-translate-y-0.5 hover:bg-limedeep hover:shadow-[0_10px_30px_rgba(205,244,99,0.35)] sm:px-5 sm:text-sm">
                <span className="sm:hidden">Crear cuenta</span>
                <span className="hidden sm:inline">Crear cuenta gratis</span>
              </a>
            </>
          )}
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            className="btn-press relative flex h-10 w-10 items-center justify-center rounded-full border-2 border-paper/30 bg-evergreen/80 text-paper transition-all hover:border-lime active:scale-95 lg:hidden"
          >
            <div className="flex h-3.5 w-4 flex-col justify-between">
              <span
                className={`h-0.5 w-full rounded-full bg-current transition-all duration-300 ${
                  open ? "translate-y-[6px] rotate-45 bg-lime" : ""
                }`}
              />
              <span
                className={`h-0.5 w-full rounded-full bg-current transition-all duration-200 ${
                  open ? "scale-0 opacity-0" : ""
                }`}
              />
              <span
                className={`h-0.5 w-full rounded-full bg-current transition-all duration-300 ${
                  open ? "-translate-y-[6px] -rotate-45 bg-lime" : ""
                }`}
              />
            </div>
          </button>
        </div>
      </div>

      {/* Menú desplegable fluido para celular */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out lg:hidden ${
          open ? "grid-rows-[1fr] opacity-100 border-b-2 border-paper/15 shadow-2xl" : "grid-rows-[0fr] opacity-0 pointer-events-none"
        }`}
      >
        <div className="overflow-hidden bg-evergreen/98 backdrop-blur-md">
          <nav className="flex flex-col gap-1.5 px-5 py-4">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="btn-press flex items-center justify-between rounded-xl px-4 py-3 font-display text-base font-bold text-paper transition-colors hover:bg-paper/10 hover:text-lime"
              >
                <span>{l.label}</span>
                <span className="text-xs text-paper/30 font-mono">→</span>
              </a>
            ))}
            <a
              href="/studio-nails"
              onClick={() => setOpen(false)}
              className="btn-press flex items-center justify-between rounded-xl bg-lime/10 px-4 py-3 font-display text-base font-bold text-lime transition-colors hover:bg-lime/20"
            >
              <span>Ver ejemplo en vivo 💅</span>
              <span className="text-xs">↗</span>
            </a>
            {!user && (
              <div className="mt-2 flex gap-2 border-t border-paper/10 pt-3">
                <a
                  href="#/auth?modo=login"
                  onClick={() => setOpen(false)}
                  className="btn-press flex-1 rounded-full border-2 border-paper/25 py-2.5 text-center font-display text-xs font-bold text-paper transition-all hover:border-lime hover:text-lime"
                >
                  Entrar
                </a>
                <a
                  href="#/auth"
                  onClick={() => setOpen(false)}
                  className="btn-press flex-1 rounded-full bg-lime py-2.5 text-center font-display text-xs font-bold text-ink transition-all hover:bg-limedeep shadow-sm"
                >
                  Crear cuenta gratis
                </a>
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}

/* ============ WIDGET DEMO ============ */
const DEMO_SERVICES = [
  { name: "Corte clásico", price: "$12.000", dur: "30 min" },
  { name: "Corte + barba", price: "$18.000", dur: "45 min" },
  { name: "Color completo", price: "$35.000", dur: "90 min" },
  { name: "Manicura spa", price: "$10.000", dur: "40 min" },
];
const DEMO_TIMES = ["09:00", "09:45", "10:30", "11:15", "12:00", "14:00", "14:45", "15:30", "16:15", "17:00", "18:30", "19:15"];
const DEMO_STEPS = ["Servicio", "Día", "Hora", "Listo"];

function BookingDemo() {
  const [step, setStep] = useState(0);
  const [service, setService] = useState<number | null>(null);
  const [day, setDay] = useState<number | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [toasts, setToasts] = useState(0);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i + 1); return d; }), []);
  const isBusy = (tIdx: number, dIdx: number) => (tIdx * 5 + dIdx * 3) % 4 === 0;

  useEffect(() => {
    if (!done) return;
    setToasts(0);
    const t1 = setTimeout(() => setToasts(1), 700);
    const t2 = setTimeout(() => setToasts(2), 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [done]);

  const reset = () => { setStep(0); setService(null); setDay(null); setTime(null); setDone(false); setToasts(0); };
  const dayLabel = day !== null ? `${days[day].toLocaleDateString("es-ES", { weekday: "long" })} ${days[day].getDate()}` : "";

  return (
    <div className="relative">
      {/* Burbuja 1: Reserva nueva */}
      <div
        className="floaty absolute -left-7 -top-8 z-20 hidden items-start gap-2.5 rounded-2xl border-2 border-ink/10 bg-white/95 p-3 text-xs font-semibold text-ink shadow-xl shadow-evergreen/10 backdrop-blur-md sm:flex"
        style={{ "--tilt": "-4deg" } as React.CSSProperties}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-lime text-ink font-bold text-xs">✓</span>
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">Nueva reserva online</p>
          <p className="font-display font-bold text-xs text-ink">Sofía M. · Uñas semi</p>
          <p className="text-[10px] text-inkmute">Sábado 15:30 hs · Seña pagada</p>
        </div>
      </div>

      {/* Burbuja 2: Seña acreditada */}
      <div
        className="floaty absolute -right-6 top-1/4 z-20 hidden items-start gap-2.5 rounded-2xl border-2 border-lime/40 bg-evergreen p-3 text-xs font-semibold text-paper shadow-2xl md:flex"
        style={{ "--tilt": "4deg", animationDelay: "1.4s" } as React.CSSProperties}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-lime/20 text-lime font-bold text-xs">💸</span>
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-lime">Seña acreditada</p>
          <p className="font-display font-bold text-xs text-paper">+$5.000 asegurados</p>
          <p className="text-[10px] text-paper/70">Caja y agenda garantizada</p>
        </div>
      </div>

      {/* Burbuja 3: Recordatorio WhatsApp */}
      <div
        className="floaty absolute -left-5 -bottom-7 z-20 hidden items-start gap-2.5 rounded-2xl border-2 border-ink/10 bg-white/95 p-3 text-xs font-semibold text-ink shadow-xl backdrop-blur-md lg:flex"
        style={{ "--tilt": "-2deg", animationDelay: "2.8s" } as React.CSSProperties}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 font-bold text-xs">💬</span>
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">Recordatorio enviado</p>
          <p className="font-display font-bold text-xs text-ink">«Hola Lucas, mañana 11 hs te esperamos»</p>
          <p className="text-[10px] text-inkmute">Automático por WhatsApp</p>
        </div>
      </div>

      <div className="relative rounded-[22px] border-2 border-ink/15 bg-card text-ink shadow-block">
        <div className="flex items-center justify-between border-b-2 border-dashed border-ink/15 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-evergreen font-display text-sm font-bold text-lime">EN</div>
            <div>
              <p className="font-display text-[15px] font-bold leading-tight">Estudio Norte</p>
              <p className="text-xs text-inkmute">Belleza & barbería · Responde en 0 min</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-lime">
            <span className="blinkdot h-1.5 w-1.5 rounded-full bg-lime" /> Demo viva
          </span>
        </div>

        {!done && (
          <div className="flex items-center gap-1.5 px-5 pt-4 sm:px-6">
            {DEMO_STEPS.map((s, i) => (
              <div key={s} className="flex-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-ink/10">
                  <div className="h-full rounded-full bg-evergreen transition-all duration-500" style={{ width: i < step ? "100%" : i === step ? "45%" : "0%" }} />
                </div>
                <p className={`mt-1 text-[10px] font-bold uppercase tracking-wider ${i <= step ? "text-evergreen" : "text-ink/30"}`}>{s}</p>
              </div>
            ))}
          </div>
        )}

        <div className="px-5 py-5 sm:px-6">
          {!done && step === 0 && (
            <div className="pop-in grid gap-2.5">
              {DEMO_SERVICES.map((s, i) => (
                <button key={s.name} onClick={() => { setService(i); setStep(1); }}
                  className={`group flex items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-evergreen hover:shadow-[4px_4px_0_rgba(12,36,28,0.12)] ${service === i ? "border-evergreen bg-paper" : "border-ink/12 bg-white/60"}`}>
                  <span>
                    <span className="block font-display text-[15px] font-bold">{s.name}</span>
                    <span className="text-xs text-inkmute">{s.dur}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-display text-[15px] font-bold text-fern">{s.price}</span>
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink/8 text-ink/50 transition-all group-hover:bg-lime group-hover:text-ink">
                      <IconCheck className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {!done && step === 1 && (
            <div className="pop-in">
              <div className="grid grid-cols-7 gap-1.5">
                {days.map((d, i) => (
                  <button key={i} onClick={() => { setDay(i); setTime(null); setStep(2); }}
                    className={`flex flex-col items-center rounded-lg border-2 py-2 transition-all duration-150 ${day === i ? "border-evergreen bg-evergreen text-lime shadow-[3px_3px_0_rgba(205,244,99,0.5)]" : "border-ink/12 bg-white/60 hover:-translate-y-0.5 hover:border-evergreen"}`}>
                    <span className="text-[10px] font-bold uppercase opacity-70">{d.toLocaleDateString("es-ES", { weekday: "short" }).slice(0, 3)}</span>
                    <span className="font-display text-base font-extrabold leading-tight">{d.getDate()}</span>
                  </button>
                ))}
              </div>
              <BackBtn onBack={() => setStep(0)} />
            </div>
          )}

          {!done && step === 2 && (
            <div className="pop-in">
              <p className="mb-2.5 text-xs font-bold uppercase tracking-wider text-inkmute">
                Horarios para el <span className="text-evergreen">{dayLabel}</span>
              </p>
              <div className="grid grid-cols-4 gap-2">
                {DEMO_TIMES.map((t, i) => {
                  const busy = day !== null && isBusy(i, day);
                  return (
                    <button key={t} disabled={busy} onClick={() => setTime(t)}
                      className={`rounded-lg border-2 py-2 font-display text-sm font-bold transition-all duration-150 ${busy ? "cursor-not-allowed border-ink/8 bg-ink/5 text-ink/25 line-through" : time === t ? "border-evergreen bg-evergreen text-lime shadow-[3px_3px_0_rgba(205,244,99,0.5)]" : "border-ink/12 bg-white/60 hover:-translate-y-0.5 hover:border-evergreen"}`}>
                      {t}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-inkmute">Los tachados ya fueron reservados por otros clientes.</p>
              <div className="mt-4 flex items-center gap-3">
                <BackBtn onBack={() => setStep(1)} />
                <button onClick={() => setDone(true)} disabled={time === null}
                  className={`flex-1 rounded-xl px-4 py-3 font-display text-[15px] font-bold transition-all duration-200 ${time !== null ? "bg-evergreen text-lime hover:-translate-y-0.5 hover:shadow-[5px_6px_0_rgba(205,244,99,0.45)] active:translate-y-0" : "cursor-not-allowed bg-ink/8 text-ink/30"}`}>
                  {time !== null ? `Confirmar ${dayLabel} · ${time}` : "Elegí una hora"}
                </button>
              </div>
            </div>
          )}

          {done && service !== null && (
            <div className="pop-in text-center">
              <svg viewBox="0 0 56 56" className="mx-auto h-16 w-16">
                <circle cx="28" cy="28" r="25" fill="none" stroke="#cdf463" strokeWidth="4" className="circle-draw" strokeLinecap="round" transform="rotate(-90 28 28)" />
                <path d="M18 29l7 7 13-14" fill="none" stroke="#082b22" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" className="check-draw" />
              </svg>
              <h3 className="mt-3 font-display text-xl font-extrabold">¡Turno confirmado!</h3>
              <p className="mt-1 text-sm text-inkmute">Sin mandar un solo mensaje. Sin esperar respuesta.</p>
              <div className="mt-4 space-y-2 rounded-xl border-2 border-dashed border-ink/15 bg-paper/70 p-4 text-left">
                <DemoRow k="Servicio" v={DEMO_SERVICES[service].name} />
                <DemoRow k="Cuándo" v={`${dayLabel} · ${time}`} />
                <DemoRow k="Anticipo (20%)" v={`${DEMO_SERVICES[service].price} → cobrado`} accent />
              </div>
              <button onClick={reset} className="mt-4 w-full rounded-xl border-2 border-ink/15 py-2.5 text-sm font-bold text-ink/70 transition-all hover:border-evergreen hover:text-evergreen">
                ↺ Reservar otro turno (es una demo, dale)
              </button>
            </div>
          )}
        </div>

        <div className="pointer-events-none absolute -bottom-5 left-1/2 z-20 w-[92%] -translate-x-1/2 space-y-2">
          {toasts >= 1 && (
            <div className="toast-in flex items-center gap-2.5 rounded-xl border-2 border-ink/10 bg-white px-3.5 py-2.5 shadow-block-ink">
              <IconBell className="h-5 w-5 text-fern" />
              <p className="text-xs font-semibold text-ink">Recordatorio por email 24 h antes + alarmas de calendario</p>
            </div>
          )}
          {toasts >= 2 && (
            <div className="toast-in flex items-center gap-2.5 rounded-xl border-2 border-ink/10 bg-evergreen px-3.5 py-2.5 shadow-[6px_8px_0_rgba(205,244,99,0.3)]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-lime text-ink"><IconCheck className="h-3 w-3" /></span>
              <p className="text-xs font-semibold text-paper">Turno agendado en tu calendario <span className="text-paper/60">· sin que muevas un dedo</span></p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DemoRow({ k, v, accent = false }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-inkmute">{k}</span>
      <span className={`font-display font-bold ${accent ? "text-fern" : "text-ink"}`}>{v}</span>
    </div>
  );
}

function BackBtn({ onBack }: { onBack: () => void }) {
  return <button onClick={onBack} className="mt-3 self-start rounded-lg px-2 py-1.5 text-xs font-bold text-inkmute transition-colors hover:text-evergreen">← Volver</button>;
}

/* ============ HERO ============ */
const FIELDS = ["Barberías", "Nails & estética", "Odontología", "Tattoo", "Peluquerías", "Depilación", "Kinesiología", "Personal training"];

function Hero() {
  return (
    <section id="inicio" className="relative overflow-hidden bg-evergreen text-paper">
      <div className="gridlines absolute inset-0" aria-hidden="true" />
      <div className="absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full opacity-25 blur-3xl" style={{ background: "radial-gradient(circle, #cdf463 0%, transparent 60%)" }} aria-hidden="true" />
      <div className="absolute bottom-0 left-[-12%] h-[420px] w-[420px] rounded-full opacity-15 blur-3xl" style={{ background: "radial-gradient(circle, #ff7a59 0%, transparent 60%)" }} aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl px-5 pb-16 pt-32 sm:px-8 lg:pb-20 lg:pt-40">
        <div className="grid items-center gap-14 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="inline-flex items-center gap-2.5 rounded-full border border-lime/30 bg-lime/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-lime">
              <span className="blinkdot h-2 w-2 rounded-full bg-lime" /> Reservas online para negocios con turno
            </p>
            <h1 className="mt-6 font-display text-[clamp(3rem,7vw,5.4rem)] font-extrabold leading-[0.96] tracking-[-0.03em]">
              <span className="mask-line"><span style={{ animationDelay: "0.05s" }}>Tu agenda</span></span>
              <span className="mask-line"><span style={{ animationDelay: "0.18s" }}>se llena</span></span>
              <span className="mask-line">
                <span style={{ animationDelay: "0.31s" }}>
                  <span className="relative inline-block text-lime">
                    sola.
                    <svg className="squiggle absolute -bottom-1 left-0 w-full" viewBox="0 0 200 12" fill="none" aria-hidden="true">
                      <path d="M3 9c40-6 80-6 97-3s60 4 97-2" stroke="#ff7a59" strokeWidth="5" strokeLinecap="round" />
                    </svg>
                  </span>
                </span>
              </span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-paper/70">
              Cupito le da a tus clientes un link para <strong className="font-semibold text-paper">reservar, pagar la seña y recibir recordatorios</strong>. Vos solo trabajás: cero mensajes a las 3 AM, cero turnos pisados.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <a href="#/auth" className="group btn-glow-lime inline-flex items-center gap-2.5 rounded-full bg-lime px-7 py-4 font-display text-lg font-bold text-ink transition-all duration-200 hover:-translate-y-1 hover:bg-limedeep active:translate-y-0">
                Crear mi página gratis
                <IconArrow className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1.5" />
              </a>
              <a href="#precios" className="group inline-flex items-center gap-2.5 rounded-full border-2 border-paper/25 px-6 py-[14px] font-display text-base font-bold text-paper transition-all duration-200 hover:border-lime hover:text-lime">
                Ver planes y precios ↓
              </a>
            </div>
            <p className="mt-4 text-sm text-paper/60">
              ¿Querés ver la página que reciben tus clientes?{" "}
              <a href="/studio-nails" target="_blank" rel="noreferrer" className="font-display font-bold text-lime underline decoration-limedeep/60 decoration-2 underline-offset-4 transition-colors hover:text-limedeep">Mirá el ejemplo en vivo →</a>
            </p>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-paper/60">
              <span className="inline-flex items-center gap-2"><IconCheck className="h-4 w-4 text-lime" /> Plan gratis para siempre</span>
              <span className="inline-flex items-center gap-2"><IconCheck className="h-4 w-4 text-lime" /> Sin tarjeta</span>
              <span className="inline-flex items-center gap-2"><IconCheck className="h-4 w-4 text-lime" /> Listo en 10 minutos</span>
            </div>
          </div>
          <Reveal delay={250} className="relative">
            <div className="absolute -inset-6 rounded-[32px] bg-lime/10 blur-2xl" aria-hidden="true" />
            <BookingDemo />
          </Reveal>
        </div>
      </div>

      <div className="marquee relative z-10 -rotate-[1.2deg] scale-[1.02] border-y-2 border-lime/25 bg-pine py-3.5">
        <div className="marquee-track items-center">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex items-center gap-8 pr-8" aria-hidden={dup === 1}>
              {FIELDS.map((f) => (
                <span key={f} className="flex items-center gap-8">
                  <span className="whitespace-nowrap font-display text-sm font-bold uppercase tracking-[0.22em] text-paper/70">{f}</span>
                  <IconSpark className="h-3.5 w-3.5 shrink-0 text-lime" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============ PROBLEMA ============ */
const PAINS = [
  { icon: IconChat, title: "El caos del WhatsApp", desc: "«¿Tenés lugar el jueves?» × 40 veces por día. Respondés entre cliente y cliente, y siempre se te pasa alguno.", tag: "Cada mensaje es un turno en riesgo" },
  { icon: IconClock, title: "Horas que nadie paga", desc: "Coordinar turnos a mano te come entre 5 y 8 horas por semana. Eso es un día de trabajo al mes… gratis.", tag: "≈ 6 h/semana perdidas" },
  { icon: IconCalendar, title: "Ausencias sin aviso", desc: "«Uy, me olvidé». El hueco queda vacío, nadie lo ocupa y ese dinero no vuelve. La seña por chat jamás llega.", tag: "1 de cada 3 no confirma" },
  { icon: IconWallet, title: "Turnos pisados y doble agenda", desc: "El cuaderno dice una cosa, tu cabeza otra y la agenda de Google una tercera. Alguien siempre pierde su turno.", tag: "3 turnos dobles al mes, promedio" },
];

function Problem() {
  return (
    <section id="problema" className="relative scroll-mt-24 overflow-hidden bg-paper py-24 lg:py-32">
      <div className="gridlines-dark absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-16 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <Reveal>
              <p className="inline-flex items-center gap-2 rounded-full bg-coral/15 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-coral">
                <span className="blinkdot h-2 w-2 rounded-full bg-coral" /> El problema
              </p>
              <h2 className="mt-5 font-display text-[clamp(2.2rem,4.5vw,3.6rem)] font-extrabold leading-[1.02] tracking-[-0.02em] text-ink">
                Tu negocio pierde plata<br />
                <span className="relative inline-block text-coral">
                  por WhatsApp.
                  <svg className="squiggle absolute -bottom-2 left-0 w-full" viewBox="0 0 220 12" fill="none" aria-hidden="true">
                    <path d="M3 8c45-5 90-5 108-2s66 4 106-3" stroke="#0c241c" strokeOpacity="0.25" strokeWidth="5" strokeLinecap="round" />
                  </svg>
                </span>
              </h2>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-inkmute">
                Si coordinás turnos por chat, cuaderno o memoria, estas escenas te van a sonar dolorosamente familiares. Y cada una tiene un costo que nadie te repone.
              </p>
            </Reveal>
            <div className="mt-10 space-y-4">
              {PAINS.map((p, i) => (
                <Reveal key={p.title} delay={i * 80}>
                  <div className="group flex gap-5 rounded-2xl border-2 border-ink/10 bg-card p-6 transition-all duration-200 hover:-translate-y-1 hover:border-coral/50 hover:shadow-block-coral">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-coral/15 text-coral transition-all duration-300 group-hover:-rotate-6 group-hover:bg-coral group-hover:text-white">
                      <p.icon className="h-6 w-6" />
                    </span>
                    <div>
                      <p className="font-display text-[11px] font-extrabold tracking-[0.18em] text-ink/35">DOLOR {String(i + 1).padStart(2, "0")}</p>
                      <h3 className="mt-1 font-display text-xl font-bold text-ink">{p.title}</h3>
                      <p className="mt-2 leading-relaxed text-inkmute">{p.desc}</p>
                      <p className="mt-3 inline-block rounded-full bg-coral/10 px-3 py-1 text-xs font-bold text-coral">{p.tag}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          <Reveal delay={120} className="lg:sticky lg:top-28 lg:self-start">
            <div className="relative mx-auto max-w-sm">
              <div className="absolute -inset-4 rounded-[40px] bg-coral/10 blur-2xl" aria-hidden="true" />
              <div className="relative rotate-[2deg] rounded-[36px] border-[6px] border-ink bg-evergreen p-4 shadow-block-coral transition-transform duration-300 hover:rotate-0">
                <div className="mb-3 flex items-center justify-between rounded-xl bg-pine px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-lime font-display text-[10px] font-bold text-ink">TN</span>
                    <div>
                      <p className="font-display text-sm font-bold text-paper">Turnos · Estudio Norte</p>
                      <p className="text-[10px] text-paper/50">23 mensajes sin responder</p>
                    </div>
                  </div>
                  <IconWhatsApp className="h-5 w-5 text-lime" />
                </div>
                <div className="space-y-2.5 rounded-2xl bg-[#e7e0d2] p-3.5">
                  <p className="mx-auto w-fit rounded-full bg-ink/10 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink/50">Hoy</p>
                  {[
                    { text: "Holaa, ¿tenés turno para mañana? 💅", time: "02:47" },
                    { text: "¿Y el viernes a la tarde?", time: "02:48" },
                    { text: "???", time: "11:20" },
                  ].map((c) => (
                    <div key={c.time} className="flex justify-start">
                      <div className="max-w-[80%] rounded-xl rounded-tl-sm bg-white px-3 py-2 text-[13px] leading-snug text-ink shadow-sm">
                        {c.text}<span className="ml-2 inline-block whitespace-nowrap text-[9px] font-semibold text-ink/40">{c.time}</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-xl rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-[13px] leading-snug text-ink shadow-sm">
                      ¡Hola! Queda 15:30 o 17:00 😊<span className="ml-2 inline-block whitespace-nowrap text-[9px] font-semibold text-ink/40">13:05 ✓</span>
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-xl rounded-tl-sm bg-white px-3 py-2 text-[13px] leading-snug text-ink shadow-sm">
                      Uy ya fue, reservé en otro lado<span className="ml-2 inline-block whitespace-nowrap text-[9px] font-semibold text-ink/40">15:42</span>
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-center text-[11px] font-semibold text-paper/60">Tu competencia responde en 0 segundos. Vos, cuando podés.</p>
              </div>
            </div>
          </Reveal>
        </div>

        {/* Comparativa visual Sin Cupito vs Con Cupito */}
        <Reveal delay={160} className="mt-16">
          <div className="rounded-[28px] border-2 border-ink/10 bg-card p-6 shadow-block-ink sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-ink/10 pb-4 mb-6">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-coral">Comparativa en tu día a día</p>
                <h3 className="font-display text-2xl font-extrabold text-ink">¿Por qué cambiar el cuaderno o el chat?</h3>
              </div>
              <span className="w-fit rounded-full bg-lime/30 px-3 py-1 text-xs font-bold text-ink">
                Resultados desde el día 1
              </span>
            </div>
            <div className="grid gap-3 sm:gap-4">
              {[
                {
                  sin: "Cancelan o te clavan el visto a último momento y el sillón queda vacío toda la tarde.",
                  con: "Cobrás seña previa al reservar o el próximo de la lista entra automático. Silla llena.",
                },
                {
                  sin: "Respondés mensajes de turnos a las 2 AM o con las manos ocupadas mientras atendés.",
                  con: "Tus clientes reservan solos las 24 horas desde tu link. Vos solo trabajás tranquilo.",
                },
                {
                  sin: "Turnos pisados por anotar en cuadernos de papel o no cruzar agendas con tu equipo.",
                  con: "Calendario inteligente en tiempo real que no pisa jamás a ningún profesional.",
                },
                {
                  sin: "«Uy, me re olvidé». Clientes que faltan sin avisar y esa plata no vuelve nunca más.",
                  con: "Confirmación y recordatorio por email 24 h antes, más invitación a Google/Apple Calendar.",
                },
              ].map((row, idx) => (
                <div key={idx} className="grid md:grid-cols-2 gap-3 rounded-2xl border border-ink/8 bg-paper/60 p-4 transition-all hover:bg-paper">
                  <div className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-coral/15 font-display text-xs font-black text-coral">✕</span>
                    <div>
                      <span className="font-display text-xs font-extrabold uppercase tracking-wider text-coral">Sin Cupito</span>
                      <p className="mt-0.5 text-xs sm:text-sm text-inkmute leading-relaxed">{row.sin}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 border-t border-ink/8 pt-3 md:border-t-0 md:border-l md:border-ink/8 md:pl-4 md:pt-0">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-fern/15 font-display text-xs font-black text-fern">✓</span>
                    <div>
                      <span className="font-display text-xs font-extrabold uppercase tracking-wider text-fern">Con Cupito</span>
                      <p className="mt-0.5 text-xs sm:text-sm font-semibold text-ink leading-relaxed">{row.con}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ============ SOLUCIÓN ============ */
const AGENDA = [
  { hora: "10:30", cliente: "Lucía M.", servicio: "Corte + brushing", chips: [["Confirmada", "bg-lime/20 text-lime"], ["Anticipo ✓", "bg-mint/20 text-mint"]] },
  { hora: "11:15", cliente: "Sofía R.", servicio: "Color completo", chips: [["Confirmada", "bg-lime/20 text-lime"], ["Recordatorio enviado", "bg-paper/15 text-paper/80"]] },
  { hora: "12:00", cliente: "Fer P.", servicio: "Barba clásica", chips: [["En agenda", "bg-paper/15 text-paper/80"]] },
  { hora: "14:45", cliente: "Ana T.", servicio: "Manicura spa", chips: [["Confirmada", "bg-lime/20 text-lime"], ["Anticipo ✓", "bg-mint/20 text-mint"]] },
];

function Solution() {
  const [mode, setMode] = useState<"antes" | "cupo">("cupo");
  return (
    <section id="solucion" className="relative scroll-mt-24 overflow-hidden bg-evergreen py-24 text-paper lg:py-32">
      <div className="gridlines absolute inset-0" aria-hidden="true" />
      <div className="absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full opacity-15 blur-3xl" style={{ background: "radial-gradient(circle, #cdf463 0%, transparent 65%)" }} aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="inline-flex items-center gap-2 rounded-full border border-lime/30 bg-lime/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-lime">
              <span className="blinkdot h-2 w-2 rounded-full bg-lime" /> La solución
            </p>
            <h2 className="mt-5 font-display text-[clamp(2.2rem,4.5vw,3.6rem)] font-extrabold leading-[1.02] tracking-[-0.02em]">
              Cupito atiende por vos.<br /><span className="text-lime">Incluso a las 3 AM.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-paper/70">Tocá el interruptor y mirá la diferencia entre coordinar turnos a mano y tener un sistema que lo hace solo.</p>
          </Reveal>
          <Reveal delay={120} className="mt-9">
            <div className="relative mx-auto inline-flex rounded-full border-2 border-paper/20 bg-pine p-1.5">
              <span className={`absolute bottom-1.5 top-1.5 w-[calc(50%-6px)] rounded-full bg-lime transition-transform duration-300 ease-out ${mode === "antes" ? "translate-x-0" : "translate-x-full"}`} style={{ left: 6 }} aria-hidden="true" />
              {(["antes", "cupo"] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)}
                  className={`relative z-10 rounded-full px-6 py-2.5 font-display text-sm font-bold uppercase tracking-wider transition-colors duration-300 sm:px-10 ${mode === m ? "text-ink" : "text-paper/60 hover:text-paper"}`}>
                  {m === "antes" ? "Así es hoy" : "Con Cupito"}
                </button>
              ))}
            </div>
          </Reveal>
        </div>

        <Reveal delay={200} className="mx-auto mt-12 max-w-4xl">
          <div className="rounded-[24px] border-2 border-paper/15 bg-pine/60 p-5 sm:p-8">
            {mode === "antes" ? (
              <div key="antes" className="pop-in grid gap-6 md:grid-cols-[1fr_auto]">
                <div className="space-y-3">
                  {[
                    ["02:47", "¿Tenés lugar mañana? (sin responder hasta las 11)"],
                    ["09:15", "¿El de las 15 sigue en pie? (ya le diste el turno a otro)"],
                    ["13:40", "Finalmente no voy 😅 (el hueco quedó vacío, sin cobrar)"],
                  ].map(([h, m]) => (
                    <div key={h} className="flex items-start gap-3 rounded-xl border border-coral/30 bg-evergreen/70 p-4">
                      <IconWhatsApp className="mt-0.5 h-5 w-5 shrink-0 text-coral" />
                      <div>
                        <p className="text-sm leading-snug text-paper/85">{m}</p>
                        <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-coral">{h}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-row items-center justify-around gap-4 md:w-44 md:flex-col md:justify-center">
                  <div className="text-center"><p className="font-display text-4xl font-extrabold text-coral">40%</p><p className="text-xs text-paper/60">no confirma a tiempo</p></div>
                  <div className="text-center"><p className="font-display text-4xl font-extrabold text-coral">3×</p><p className="text-xs text-paper/60">turnos pisados al mes</p></div>
                  <div className="text-center"><p className="font-display text-4xl font-extrabold text-coral">$0</p><p className="text-xs text-paper/60">cobrado por ausencias</p></div>
                </div>
              </div>
            ) : (
              <div key="cupo" className="pop-in">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-display text-xl font-extrabold">Agenda de hoy</p>
                    <p className="text-sm text-paper/60">9 turnos · 0 huecos · 0 mensajes respondidos por vos</p>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-lime px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-ink"><IconCheck className="h-3.5 w-3.5" /> Todo automático</span>
                </div>
                <div className="grid gap-2.5">
                  {AGENDA.map((a, i) => (
                    <div key={a.hora} className="pop-in flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-paper/10 bg-evergreen/70 px-4 py-3.5 transition-colors duration-200 hover:border-lime/40" style={{ animationDelay: `${i * 90}ms` }}>
                      <span className="w-14 font-display text-lg font-extrabold text-lime">{a.hora}</span>
                      <span className="min-w-28 flex-1">
                        <span className="block font-display text-[15px] font-bold">{a.cliente}</span>
                        <span className="text-xs text-paper/55">{a.servicio}</span>
                      </span>
                      <span className="flex flex-wrap gap-1.5">
                        {a.chips.map(([label, cls]) => <span key={label} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${cls}`}>{label}</span>)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex items-center gap-3 rounded-xl border-2 border-dashed border-lime/30 bg-lime/5 px-4 py-3">
                  <IconBell className="h-5 w-5 shrink-0 text-lime" />
                  <p className="text-sm text-paper/80"><strong className="font-semibold text-paper">18:30:</strong> Cupito le avisó a Ana por email: “¡Te esperamos mañana a las 14:45!” — Ana no faltó.</p>
                </div>
              </div>
            )}
          </div>
        </Reveal>

        <div className="relative mx-auto mt-20 grid max-w-5xl gap-10 md:grid-cols-3 md:gap-8">
          <div className="absolute left-[16%] right-[16%] top-7 hidden border-t-2 border-dashed border-paper/20 md:block" aria-hidden="true" />
          {[
            { n: "01", icon: IconLink, title: "Compartí tu link", desc: "cupito.app/tu-negocio en tu bio de Instagram, en Google y en tu vidriera con un QR. Se configura en 10 minutos." },
            { n: "02", icon: IconWallet, title: "Ellos reservan y pagan", desc: "Tu cliente elige servicio, día y hora disponible, y deja una seña por transferencia. Cupito confirma al instante, a cualquier hora." },
            { n: "03", icon: IconBell, title: "Vos solo trabajás", desc: "Recordatorios automáticos por email y calendario bajan las ausencias hasta 68%. El hueco ya está cobrado y agendado." },
          ].map((s, i) => (
            <Reveal key={s.n} delay={i * 130} className="relative">
              <div className="group text-center md:text-left">
                <div className="relative z-10 mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-lime/50 bg-evergreen text-lime transition-all duration-300 group-hover:-rotate-6 group-hover:bg-lime group-hover:text-ink md:mx-0">
                  <s.icon className="h-6 w-6" />
                </div>
                <p className="mt-5 font-display text-sm font-extrabold tracking-[0.2em] text-lime/70">PASO {s.n}</p>
                <h3 className="mt-2 font-display text-2xl font-bold">{s.title}</h3>
                <p className="mt-2.5 leading-relaxed text-paper/65">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============ CALCULADORA INTERACTIVA ROI ============ */
function RoiCalculator() {
  const [weeklyBookings, setWeeklyBookings] = useState(35);
  const [ticketPrice, setTicketPrice] = useState(15000);

  const monthlyBookings = weeklyBookings * 4.2;
  const savedHoursMonth = Math.round((monthlyBookings * 7) / 60);
  const noShowsAvoided = Math.round(monthlyBookings * 0.15);
  const recoveredMoney = noShowsAvoided * ticketPrice;

  return (
    <section className="relative overflow-hidden bg-pine py-20 text-paper">
      <div className="gridlines absolute inset-0 opacity-20" aria-hidden="true" />
      <div className="relative mx-auto max-w-5xl px-5 sm:px-8">
        <Reveal className="text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-lime/30 bg-lime/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-lime">
            Calculadora interactiva
          </p>
          <h2 className="mt-4 font-display text-[clamp(2rem,4vw,3.2rem)] font-extrabold leading-tight">
            ¿Cuánto tiempo y dinero te <span className="text-lime">ahorrás</span> por mes?
          </h2>
          <p className="mt-3 text-paper/70">
            Ajustá los números a la realidad de tu negocio y mirá el impacto directo.
          </p>
        </Reveal>

        <div className="mt-12 grid items-center gap-8 rounded-3xl border-2 border-lime/20 bg-evergreen/90 p-6 sm:p-10 lg:grid-cols-2">
          {/* Sliders */}
          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="font-display text-sm font-bold text-paper/90">
                  Turnos que atendés por semana
                </label>
                <span className="font-display text-lg font-extrabold text-lime">
                  {weeklyBookings} turnos
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="120"
                step="5"
                value={weeklyBookings}
                onChange={(e) => setWeeklyBookings(Number(e.target.value))}
                className="h-2.5 w-full cursor-pointer appearance-none rounded-full bg-paper/20 accent-lime"
              />
              <div className="flex justify-between text-[11px] text-paper/50 mt-1">
                <span>10 turnos</span>
                <span>60 turnos</span>
                <span>120 turnos</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="font-display text-sm font-bold text-paper/90">
                  Precio promedio de tu servicio
                </label>
                <span className="font-display text-lg font-extrabold text-lime">
                  ${ticketPrice.toLocaleString("es-AR")}
                </span>
              </div>
              <input
                type="range"
                min="5000"
                max="50000"
                step="2500"
                value={ticketPrice}
                onChange={(e) => setTicketPrice(Number(e.target.value))}
                className="h-2.5 w-full cursor-pointer appearance-none rounded-full bg-paper/20 accent-lime"
              />
              <div className="flex justify-between text-[11px] text-paper/50 mt-1">
                <span>$5.000</span>
                <span>$25.000</span>
                <span>$50.000</span>
              </div>
            </div>

            <p className="text-xs text-paper/60 leading-relaxed border-t border-paper/10 pt-4">
              * Basado en un promedio de 7 minutos de coordinación por turno vía WhatsApp y una tasa del 15% de ausencias reducidas mediante seña previa.
            </p>
          </div>

          {/* Metric cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-2xl border border-lime/30 bg-lime/10 p-5">
              <span className="block text-xs font-bold uppercase tracking-wider text-lime">Tiempo recuperado</span>
              <p className="mt-1 font-display text-3xl font-extrabold text-paper sm:text-4xl">
                ≈ {savedHoursMonth} horas <span className="text-base text-paper/60 font-sans">/ mes</span>
              </p>
              <p className="mt-1 text-xs text-paper/70">
                Es casi <strong>{Math.round(savedHoursMonth / 8)} días enteros de trabajo</strong> que dejás de gastar pegado al celular respondiendo mensajes.
              </p>
            </div>

            <div className="rounded-2xl border border-coral/30 bg-coral/10 p-5">
              <span className="block text-xs font-bold uppercase tracking-wider text-coral">Dinero asegurado en señas</span>
              <p className="mt-1 font-display text-3xl font-extrabold text-paper sm:text-4xl">
                +${recoveredMoney.toLocaleString("es-AR")} <span className="text-base text-paper/60 font-sans">/ mes</span>
              </p>
              <p className="mt-1 text-xs text-paper/70">
                Turnos cobrados por adelantado que antes se perdían por ausencias sin aviso.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <a
            href="#precios"
            className="btn-press inline-flex items-center gap-2 rounded-full bg-lime px-7 py-3.5 font-display text-base font-bold text-ink hover:bg-limedeep shadow-lg"
          >
            Empezá a ahorrar tiempo hoy →
          </a>
        </div>
      </div>
    </section>
  );
}

/* ============ FEATURES ============ */
function Features() {
  return (
    <section id="beneficios" className="relative scroll-mt-24 bg-card py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full bg-fern/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-fern">Todo lo que necesitás</p>
          <h2 className="mt-5 font-display text-[clamp(2.2rem,4.5vw,3.6rem)] font-extrabold leading-[1.02] tracking-[-0.02em] text-ink">
            Un sistema completo, <span className="text-fern">nada de parches</span>.
          </h2>
        </Reveal>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          <Reveal className="md:col-span-2">
            <div className="card card-hover h-full p-7">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-2xl font-extrabold text-ink">Tu página, con tu marca</h3>
                <span className="rounded-full bg-lime/40 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-fern">Incluida</span>
              </div>
              <p className="mt-2 max-w-md text-inkmute">Un link propio con tus servicios, precios y horarios. Descripción, dirección, WhatsApp, Instagram y Google Maps.</p>
              <div className="mt-6 rounded-2xl border-2 border-ink/10 bg-paper p-4">
                <div className="flex items-center gap-1.5 border-b-2 border-dashed border-ink/10 pb-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-coral/70" /><span className="h-2.5 w-2.5 rounded-full bg-lime/80" /><span className="h-2.5 w-2.5 rounded-full bg-fern/60" />
                  <span className="ml-3 flex-1 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-inkmute">cupito.app/estudio-norte</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="col-span-2 h-16 rounded-lg bg-evergreen" />
                  <div className="h-16 rounded-lg bg-lime/50" />
                  <div className="h-8 rounded-lg bg-ink/8" /><div className="h-8 rounded-lg bg-ink/8" /><div className="h-8 rounded-lg bg-fern/30" />
                </div>
              </div>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="card card-hover flex h-full flex-col p-7">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-coral/15 text-coral"><IconBell className="h-6 w-6" /></span>
              <h3 className="mt-4 font-display text-xl font-extrabold text-ink">Recordatorios automáticos</h3>
              <p className="mt-2 flex-1 text-inkmute">Confirmación por email al reservar, recordatorio 24 h antes y alarmas de calendario 24 h y 1 h antes. Sin que acuerdes nada con nadie.</p>
              <p className="mt-4 inline-block w-fit rounded-full bg-coral/10 px-3 py-1 text-xs font-bold text-coral">−68% de ausencias</p>
            </div>
          </Reveal>
          <Reveal delay={150}>
            <div className="card card-hover flex h-full flex-col p-7">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-fern/15 text-fern"><IconWallet className="h-6 w-6" /></span>
              <h3 className="mt-4 font-display text-xl font-extrabold text-ink">Seña al reservar</h3>
              <p className="mt-2 flex-1 text-inkmute">El cliente transfiere a tu alias o CBU y carga el comprobante. Vos lo verificás con un clic desde el panel.</p>
              <p className="mt-4 inline-block w-fit rounded-full bg-fern/10 px-3 py-1 text-xs font-bold text-fern">Plan Crece</p>
            </div>
          </Reveal>
          <Reveal delay={200}>
            <div className="card card-hover flex h-full flex-col p-7">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-lime/40 text-fern"><IconBag className="h-6 w-6" /></span>
              <h3 className="mt-4 font-display text-xl font-extrabold text-ink">Tienda de productos</h3>
              <p className="mt-2 flex-1 text-inkmute">Vendé tus productos junto con cada turno: el cliente los agrega a la reserva y los retira cuando viene.</p>
              <p className="mt-4 inline-block w-fit rounded-full bg-fern/10 px-3 py-1 text-xs font-bold text-fern">Plan Crece</p>
            </div>
          </Reveal>
          <Reveal delay={250} className="md:col-span-2">
            <div className="card card-hover h-full p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-display text-2xl font-extrabold text-ink">Agenda por equipo</h3>
                <span className="rounded-full bg-fern/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-fern">Hasta 3 en Crece · ilimitados en Escala</span>
              </div>
              <p className="mt-2 max-w-md text-inkmute">Cada profesional con su calendario y sus horarios. El cliente elige con quién, y Cupito reparte los turnos sin pisar a nadie.</p>
              <div className="mt-6 flex items-end gap-2">
                {[40, 65, 50, 80, 72, 95].map((h, i) => (
                  <div key={i} className="flex h-24 flex-1 items-end overflow-hidden rounded-t-md bg-ink/8">
                    <div className={`bar-v w-full rounded-t-md ${i === 5 ? "bg-lime" : "bg-fern"}`} style={{ height: `${h}%`, transitionDelay: `${i * 90}ms` }} />
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal delay={300}>
            <div className="card card-hover flex h-full flex-col p-7">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink/8 text-ink"><IconUsers className="h-6 w-6" /></span>
              <h3 className="mt-4 font-display text-xl font-extrabold text-ink">Lista de espera inteligente</h3>
              <p className="mt-2 flex-1 text-inkmute">Día completo? Tus clientes se anotan solos. Se libera un hueco, le das el turno con un clic y le avisás por WhatsApp. En Escala, tus recurrentes van primeros solos.</p>
              <p className="mt-4 inline-block w-fit rounded-full bg-ink/8 px-3 py-1 text-xs font-bold text-ink/60">Todos los planes</p>
            </div>
          </Reveal>
          <Reveal delay={350}>
            <div className="card card-hover flex h-full flex-col p-7">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-coral/15 text-coral"><IconTicketIcon /></span>
              <h3 className="mt-4 font-display text-xl font-extrabold text-ink">Cupones y promos</h3>
              <p className="mt-2 flex-1 text-inkmute">Creá códigos de descuento para llenar los horarios más flojos. Se aplican solos al reservar.</p>
              <p className="mt-4 inline-block w-fit rounded-full bg-fern/10 px-3 py-1 text-xs font-bold text-fern">Plan Crece</p>
            </div>
          </Reveal>
          <Reveal delay={400} className="md:col-span-2">
            <div className="card card-hover flex h-full flex-col justify-between gap-4 p-7 sm:flex-row sm:items-center">
              <div>
                <h3 className="font-display text-2xl font-extrabold text-ink">Fácil de verdad</h3>
                <p className="mt-2 max-w-md text-inkmute">Si sabés usar Instagram, sabés usar Cupito. Sin manuales, sin técnicos, sin vueltas.</p>
              </div>
              <a href="#/auth" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-evergreen px-6 py-3.5 font-display text-base font-bold text-lime transition-all hover:-translate-y-0.5 hover:bg-pine">
                Probarlo gratis <IconArrow className="h-4 w-4" />
              </a>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function IconTicketIcon() {
  return (
    <svg viewBox="0 0 28 28" className="h-6 w-6" fill="none" aria-hidden="true">
      <path d="M4 9a2 2 0 012-2h16a2 2 0 012 2v2a3 3 0 000 6v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2a3 3 0 000-6V9z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M17 7v14" stroke="currentColor" strokeWidth="2" strokeDasharray="2.5 3" strokeLinecap="round" />
    </svg>
  );
}

/* ============ TESTIMONIOS ============ */
const QUOTES = [
  { q: "Pasé de responder 40 mensajes por día a literalmente cero. Las clientas reservan solas a las 2 AM y yo me entero al despertar. Me cambió la vida y el humor.", name: "Caro Méndez", biz: "Studio Nails · Buenos Aires", initials: "CM", avatar: "bg-coral text-white", tilt: "-rotate-2", tape: "bg-lime/80 -rotate-6" },
  { q: "La seña del 20% eliminó las ausencias de un plumazo. En un mes pasé de 8 no-shows semanales a uno solo. Ese hueco ahora siempre está cobrado.", name: "Marcos Ledesma", biz: "Barbería La 9 · Córdoba", initials: "ML", avatar: "bg-fern text-lime", tilt: "rotate-1", tape: "bg-mint/80 rotate-3" },
  { q: "Con 3 odontólogas y 2 boxes, la agenda compartida terminó con los turnos pisados para siempre. Cada una ve su día; yo veo todo el estudio en una pantalla.", name: "Dra. Valentina Ruiz", biz: "Clínica Sonrisa · Rosario", initials: "VR", avatar: "bg-lime text-ink", tilt: "rotate-2", tape: "bg-coral/70 rotate-6" },
  { q: "Facturo 30% más desde que vendo productos con la tienda. La gente agrega el esmalte al turno y lo retira cuando viene. Win-win total.", name: "Leo Fuentes", biz: "Ink & Co Tattoo · Mendoza", initials: "LF", avatar: "bg-mint text-ink", tilt: "-rotate-1", tape: "bg-lime/80 rotate-2" },
];

function Testimonials() {
  return (
    <section className="relative overflow-hidden bg-pine py-24 text-paper lg:py-32">
      <div className="gridlines absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-lime/30 bg-lime/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-lime">Ejemplos ilustrativos</p>
          <h2 className="mt-5 font-display text-[clamp(2.2rem,4.5vw,3.6rem)] font-extrabold leading-[1.02] tracking-[-0.02em]">
            Negocios que dejarían de <span className="text-coral">mendigar</span> confirmaciones.
          </h2>
          <p className="mt-3 text-sm text-paper/60">Testimonios de ejemplo para mostrar el potencial. Se reemplazan por reseñas reales de tus primeros clientes.</p>
        </Reveal>
        <div className="mt-16 grid gap-x-8 gap-y-12 sm:grid-cols-2">
          {QUOTES.map((t, i) => (
            <Reveal key={t.name} delay={i * 110} className={i % 2 === 1 ? "sm:translate-y-10" : ""}>
              <figure className={`relative rounded-[20px] border-2 border-ink/15 bg-card p-7 text-ink shadow-block-ink transition-all duration-300 hover:rotate-0 hover:scale-[1.02] hover:shadow-block ${t.tilt}`}>
                <span className={`absolute -top-3.5 left-1/2 h-7 w-24 -translate-x-1/2 rounded-sm opacity-90 ${t.tape}`} aria-hidden="true" />
                <div className="flex gap-1 text-limedeep">{[...Array(5)].map((_, s) => <IconStar key={s} className="h-4 w-4" />)}</div>
                <blockquote className="mt-4 font-display text-lg font-semibold leading-snug">“{t.q}”</blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-full font-display text-sm font-bold ${t.avatar}`}>{t.initials}</span>
                  <span>
                    <span className="block font-display text-[15px] font-bold">{t.name}</span>
                    <span className="block text-xs text-inkmute">{t.biz}</span>
                  </span>
                  <span className="ml-auto rounded-full bg-evergreen px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-lime">Ejemplo</span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
        <Reveal delay={200} className="mt-20 text-center sm:mt-24">
          <div className="inline-flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {[["68%", "menos ausencias"], ["10 min", "configuración media"], ["$0", "para empezar"], ["24/7", "reservas abiertas"]].map(([big, small]) => (
              <div key={small} className="text-center">
                <p className="font-display text-4xl font-extrabold text-lime">{big}</p>
                <p className="mt-1 text-sm text-paper/60">{small}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ============ PRECIOS ============ */
type Billing = "mensual" | "anual";
type Feature = { t: string; soon?: boolean };
type PlanDef = { id: Plan; name: string; tagline: string; monthly: number; yearly: number; cta: string; highlight: boolean; badge?: string; features: Feature[] };

const PLANS: PlanDef[] = [
  {
    id: "semilla", name: "Semilla", tagline: "Para probar el agua sin mojarte.", monthly: 0, yearly: 0, cta: "Empezar gratis", highlight: false,
    features: [{ t: "1 calendario y 1 profesional" }, { t: "25 reservas al mes" }, { t: "Tu link propio cupito.app/tu-negocio" }, { t: "Confirmación y recordatorio por email" }, { t: "Lista de espera" }, { t: "Guía de configuración paso a paso" }, { t: "Estadísticas básicas" }],
  },
  {
    id: "crece", name: "Crece", tagline: "El favorito de los que viven de sus turnos.", monthly: 9500, yearly: 7900, cta: "Suscribirme", highlight: true, badge: "Más elegido",
    features: [
      { t: "Reservas ilimitadas" }, { t: "Hasta 3 profesionales" }, { t: "Cobro de seña configurable por transferencia" },
      { t: "Paletas de colores exclusivas para tu página" }, { t: "Tienda de productos: vendé en cada reserva" },
      { t: "Cupones de descuento y promociones" }, { t: "Límite de anticipación de reservas y cortes de horario" },
    ],
  },
  {
    id: "escala", name: "Escala", tagline: "Para estudios, clínicas y equipos grandes.", monthly: 22000, yearly: 18300, cta: "Suscribirme", highlight: false,
    features: [
      { t: "Todo lo de Crece" },
      { t: "Profesionales y colaboradores ilimitados" },
      { t: "Estadísticas avanzadas con análisis de retención e ingresos" },
      { t: "Exportación de clientes y reservas a Excel / CSV" },
      { t: "Lista de espera inteligente con prioridad (recurrentes primero)" },
      { t: "Soporte preferencial" },
    ],
  },
];

function Pricing() {
  const [billing, setBilling] = useState<Billing>("anual");
  const [showCustom, setShowCustom] = useState(false);
  const [subscribing, setSubscribing] = useState<PlanDef | null>(null);
  const { user } = useStore();

  return (
    <section id="precios" className="relative scroll-mt-24 bg-paper py-24 lg:py-32">
      <div className="gridlines-dark absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <p className="inline-flex items-center gap-2 rounded-full bg-fern/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-fern">Precios</p>
            <h2 className="mt-5 font-display text-[clamp(2.2rem,4.5vw,3.6rem)] font-extrabold leading-[1.02] tracking-[-0.02em] text-ink">
              Menos de lo que te cuesta <span className="text-coral">un no-show</span>.
            </h2>
            <p className="mt-5 text-lg text-inkmute">Un solo turno recuperado al mes paga todo el plan. Precios en pesos argentinos, pensados para negocios de barrio.</p>
          </Reveal>
          <Reveal delay={120} className="mt-8 flex justify-center">
            <div className="inline-flex items-center rounded-full border-2 border-ink/15 bg-card p-1.5 shadow-sm">
              <button
                type="button"
                onClick={() => setBilling("mensual")}
                className={`rounded-full px-6 py-2.5 font-display text-sm font-bold uppercase tracking-wider transition-all duration-200 sm:px-8 ${
                  billing === "mensual" ? "bg-evergreen text-lime shadow-sm" : "text-ink/50 hover:text-ink"
                }`}
              >
                Mensual
              </button>
              <button
                type="button"
                onClick={() => setBilling("anual")}
                className={`flex items-center gap-2 rounded-full px-6 py-2.5 font-display text-sm font-bold uppercase tracking-wider transition-all duration-200 sm:px-8 ${
                  billing === "anual" ? "bg-evergreen text-lime shadow-sm" : "text-ink/50 hover:text-ink"
                }`}
              >
                <span>Anual</span>
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold transition-colors ${
                  billing === "anual" ? "bg-lime text-ink" : "bg-fern/15 text-fern"
                }`}>
                  2 meses gratis
                </span>
              </button>
            </div>
          </Reveal>
        </div>

        <div className="mx-auto mt-14 grid max-w-6xl items-stretch gap-6 lg:grid-cols-3">
          {PLANS.map((p, i) => {
            const price = billing === "mensual" ? p.monthly : p.yearly;
            return (
              <Reveal key={p.name} delay={i * 110} className="h-full">
                <div className={`relative flex h-full flex-col rounded-[24px] border-2 p-8 transition-all duration-300 hover:-translate-y-2 ${p.highlight ? "border-lime bg-evergreen text-paper shadow-block lg:-my-4 lg:py-12" : "border-ink/12 bg-card text-ink hover:border-ink hover:shadow-block-ink"}`}>
                  {p.highlight && (
                    <span className="absolute -top-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-coral px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-block-ink">
                      <IconSpark className="h-3.5 w-3.5" /> {p.badge}
                    </span>
                  )}
                  <div className="flex items-baseline justify-between">
                    <h3 className={`font-display text-2xl font-extrabold ${p.highlight ? "text-lime" : "text-ink"}`}>{p.name}</h3>
                    {p.highlight && <span className="rounded-full bg-lime/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-lime">El más elegido</span>}
                  </div>
                  <p className={`mt-2 text-sm ${p.highlight ? "text-paper/65" : "text-inkmute"}`}>{p.tagline}</p>
                  <div className="mt-6 flex items-end gap-2">
                    <span key={billing} className="price-pop font-display text-6xl font-extrabold tracking-tight">{price === 0 ? "$0" : `$${price.toLocaleString("es-AR")}`}</span>
                    <span className={`pb-2 text-sm font-semibold ${p.highlight ? "text-paper/60" : "text-inkmute"}`}>ARS / mes</span>
                  </div>
                  <p className={`mt-1 text-xs ${p.highlight ? "text-paper/50" : "text-inkmute"}`}>
                    {billing === "anual" && price > 0 ? `Facturado anual · ahorrás $${((p.monthly - p.yearly) * 12).toLocaleString("es-AR")} al año` : price > 0 ? "Facturado mes a mes, cancelás cuando quieras" : "Para siempre gratis. Sin tarjeta."}
                  </p>
                  <ul className="mt-7 flex-1 space-y-3">
                    {p.features.map((f) => (
                      <li key={f.t} className="flex items-start gap-3">
                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${p.highlight ? "bg-lime text-ink" : "bg-fern/15 text-fern"}`}><IconCheck className="h-3 w-3" /></span>
                        <span className={`text-sm leading-snug ${p.highlight ? "text-paper/85" : "text-ink/80"}`}>
                          {f.t}
                          {f.soon && <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${p.highlight ? "bg-paper/15 text-paper/70" : "bg-ink/8 text-ink/50"}`}>Próximamente</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {p.monthly === 0 ? (
                    <a href="#/auth" className="group mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-ink/20 px-6 py-4 font-display text-base font-bold text-ink transition-all duration-200 hover:-translate-y-0.5 hover:border-evergreen hover:bg-evergreen hover:text-lime">
                      {p.cta} <IconArrow className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                    </a>
                  ) : (
                    <button onClick={() => (user ? setSubscribing(p) : (window.location.hash = `#/auth?plan=${p.id}`))}
                      className={`group mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 font-display text-base font-bold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 ${p.highlight ? "bg-lime text-ink hover:bg-limedeep hover:shadow-[0_14px_35px_rgba(205,244,99,0.4)]" : "border-2 border-ink/20 text-ink hover:border-evergreen hover:bg-evergreen hover:text-lime"}`}>
                      {user ? p.cta : "Crear cuenta y " + p.cta.toLowerCase()}
                      <IconArrow className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                    </button>
                  )}
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={250} className="mt-12 text-center">
          <p className="text-sm text-inkmute">
            ¿Tenés una cadena o una franquicia?{" "}
            <button onClick={() => setShowCustom(true)} className="font-bold text-fern underline decoration-limedeep decoration-2 underline-offset-4 transition-colors hover:text-evergreen">Armamos un plan a medida →</button>
          </p>
        </Reveal>
      </div>
      {showCustom && <CustomPlanModal onClose={() => setShowCustom(false)} />}
      {subscribing && <SubscriptionModal plan={subscribing} billing={billing} onClose={() => setSubscribing(null)} />}
    </section>
  );
}

function SubscriptionModal({ plan, billing, onClose }: { plan: PlanDef; billing: Billing; onClose: () => void }) {
  const { user, toast } = useStore();
  const price = billing === "mensual" ? plan.monthly : plan.yearly;
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subscribe = async () => {
    if (plan.id === "semilla") {
      window.location.hash = "#/auth";
      return;
    }
    if (!user) {
      window.location.hash = `#/auth?plan=${plan.id}`;
      return;
    }
    setProcessing(true);
    setError(null);
    if (!isPaidPlan(plan.id)) return;
    const r = await createMercadoPagoCheckout({ plan: plan.id, billing, email: user.email });
    if (!r.ok) {
      setProcessing(false);
      setError(r.error);
      return;
    }
    savePendingCheckout(plan.id, billing);
    toast("Te llevamos al checkout de MercadoPago…");
    window.location.href = r.url;
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/60 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div className="pop-in w-full max-w-md rounded-[22px] border-2 border-ink/15 bg-card p-6 text-ink shadow-block sm:p-7" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-2xl font-extrabold">Plan {plan.name}</h3>
            <p className="mt-1 text-sm text-inkmute"><strong className="text-fern">${price.toLocaleString("es-AR")} ARS</strong> / mes · facturado {billing === "mensual" ? "mensualmente" : "anualmente"}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink/15 text-inkmute transition-colors hover:border-coral hover:text-coral">✕</button>
        </div>
        <ul className="mt-5 space-y-2">
          {plan.features.slice(0, 5).map((f) => (
            <li key={f.t} className="flex items-start gap-2.5 text-sm text-ink/80">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lime text-ink"><IconCheck className="h-3 w-3" /></span>{f.t}
            </li>
          ))}
        </ul>
        {error && <p className="mt-4 rounded-xl border-2 border-coral/40 bg-coral/10 px-3 py-2 text-xs font-semibold text-coral">{error}</p>}
        <button onClick={subscribe} disabled={processing}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-lime py-4 font-display text-base font-bold text-ink transition-all duration-200 hover:-translate-y-0.5 hover:bg-limedeep disabled:opacity-60">
          {processing ? (<><span className="blinkdot h-2.5 w-2.5 rounded-full bg-ink" /> Conectando con MercadoPago…</>) : (<>Suscribirme con MercadoPago <IconArrow className="h-4 w-4" /></>)}
        </button>
        <p className="mt-3 text-center text-[11px] leading-snug text-inkmute">
          El cobro lo hace MercadoPago de forma segura. El plan se activa cuando el pago queda autorizado. Cancelás cuando quieras.
        </p>
      </div>
    </div>
  );
}

function CustomPlanModal({ onClose }: { onClose: () => void }) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ nombre: "", negocio: "", email: "", sucursales: "", mensaje: "" });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSending(true);
    const lines = [
      `Nombre: ${form.nombre}`,
      `Negocio: ${form.negocio}`,
      `Email: ${form.email}`,
      form.sucursales ? `Sucursales: ${form.sucursales}` : null,
      form.mensaje ? `Necesidad: ${form.mensaje}` : null,
    ].filter(Boolean);
    // 1) Te llega a tu email para que quede registro
    try {
      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: "hola@cupito.app",
          subject: `Plan a medida: ${form.negocio} (${form.nombre})`,
          html: `<h2>Nuevo pedido de plan a medida</h2><ul>${lines.map((l) => `<li>${l}</li>`).join("")}</ul>`,
        }),
      });
    } catch { /* igual seguimos al paso 2 */ }
    // 2) Se abre tu WhatsApp con la propuesta lista para enviar
    const text = `¡Hola! Soy ${form.nombre} de ${form.negocio} (${form.email}). ${form.sucursales ? `Tengo ${form.sucursales} sucursales. ` : ""}${form.mensaje ? `Necesito: ${form.mensaje}` : "Quiero un plan a medida."}`;
    setSending(false);
    setSent(true);
    window.open(`https://wa.me/5491131996205?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/60 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div className="pop-in w-full max-w-md rounded-[22px] border-2 border-ink/15 bg-card p-6 text-ink shadow-block sm:p-7" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-2xl font-extrabold">{sent ? "¡Gracias!" : "Plan a medida"}</h3>
          <button onClick={onClose} aria-label="Cerrar" className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink/15 text-inkmute transition-colors hover:border-coral hover:text-coral">✕</button>
        </div>
        {sent ? (
          <div className="pop-in mt-5 text-center">
            <p className="text-lg font-bold text-fern">¡Propuesta en camino! ✅</p>
            <p className="mt-2 text-sm text-inkmute">Se abrió tu WhatsApp con el mensaje listo{form.nombre ? `, ${form.nombre.split(" ")[0]}` : ""}. Envialo y te respondemos en menos de 24 h. También nos llegó a nuestro email.</p>
            <button onClick={onClose} className="mt-5 rounded-full bg-evergreen px-6 py-2.5 font-display text-sm font-bold text-lime transition-all hover:-translate-y-0.5">Listo</button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-3.5">
            <p className="text-sm text-inkmute">Contanos de tu negocio y te preparamos una propuesta.</p>
            <input required className="field" placeholder="Tu nombre *" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            <input required className="field" placeholder="Nombre del negocio *" value={form.negocio} onChange={(e) => setForm({ ...form, negocio: e.target.value })} />
            <input required type="email" className="field" placeholder="Email *" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="field" placeholder="¿Cuántas sucursales tenés?" value={form.sucursales} onChange={(e) => setForm({ ...form, sucursales: e.target.value })} />
            <textarea className="field min-h-20 resize-none" placeholder="¿Qué necesitás que haga Cupito por vos?" value={form.mensaje} onChange={(e) => setForm({ ...form, mensaje: e.target.value })} />
            <button type="submit" disabled={sending} className="w-full rounded-full bg-coral py-3.5 font-display text-base font-bold text-white transition-all hover:-translate-y-0.5 hover:shadow-[5px_6px_0_rgba(255,122,89,0.3)] disabled:opacity-60">{sending ? "Enviando…" : "Pedir mi propuesta →"}</button>
            <p className="text-center text-[11px] text-inkmute">Te llega directo a nuestro WhatsApp y email.</p>
          </form>
        )}
      </div>
    </div>
  );
}

/* ============ FAQ ============ */
const FAQS = [
  {
    q: "¿Mis clientes tienen que descargarse una app para reservar?",
    a: "Jamás. Tus clientes tocan tu link (desde tu bio de Instagram, un estado de WhatsApp o escaneando el cartel con QR en tu local) y reservan directo en el navegador de su celular en 1 minuto. No instalan nada, no ocupa espacio y no tienen que crearse contraseñas obligatorias para reservar.",
  },
  {
    q: "¿Es realmente gratis para empezar?",
    a: "El plan Semilla es gratuito para siempre (hasta 25 reservas al mes) y no pide tarjeta. Si tu negocio crece, pasás al plan Crece cuando quieras.",
  },
  {
    q: "¿Cómo funciona la seña por transferencia?",
    a: "Vos definís el porcentaje (por ejemplo, 20% o 50%). Al reservar, el cliente ve tu Alias o CBU bancario, realiza la transferencia y adjunta el número de comprobante. Vos acreditás la seña con un solo clic desde tu panel y el turno queda confirmado.",
  },
  {
    q: "¿Qué pasa cuando un cliente cancela su turno?",
    a: "Cupito gestiona el hueco automáticamente: el cliente puede cancelar con anticipación desde el botón «Mis turnos» y el horario se libera solo. Además, la lista de espera te permite reasignar el lugar al instante para que nunca te quede un sillón vacío.",
  },
  {
    q: "¿Puedo configurar horarios distintos por día y corte al mediodía?",
    a: "Sí, totalmente. Podés elegir qué días abrís, a qué hora abrís y cerrás cada día, y agregar cortes de almuerzo (por ejemplo, de 13:00 a 15:00). Los turnos disponibles para tus clientes se calculan automáticamente.",
  },
  {
    q: "¿Necesito saber de tecnología para configurarlo?",
    a: "Para nada. Si sabés usar WhatsApp o Instagram, podés manejar Cupito. Tu página ya viene lista para usar y podés personalizar tus servicios, precios y fotos en menos de 5 minutos.",
  },
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="relative scroll-mt-24 bg-card py-24 lg:py-32">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <Reveal className="text-center">
          <p className="inline-flex items-center gap-2 rounded-full bg-fern/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-fern">Preguntas frecuentes</p>
          <h2 className="mt-5 font-display text-[clamp(2.2rem,4.5vw,3.2rem)] font-extrabold leading-[1.02] tracking-[-0.02em] text-ink">Lo que todos preguntan antes de dar el salto.</h2>
        </Reveal>
        <div className="mt-12 space-y-3.5">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={f.q} delay={i * 60}>
                <div className={`overflow-hidden rounded-2xl border-2 transition-all duration-300 ${isOpen ? "border-evergreen bg-paper shadow-block-ink" : "border-ink/10 bg-paper/60 hover:border-ink/30"}`}>
                  <button onClick={() => setOpen(isOpen ? null : i)} className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left" aria-expanded={isOpen}>
                    <span className="font-display text-lg font-bold text-ink">{f.q}</span>
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 ${isOpen ? "rotate-90 border-evergreen bg-evergreen text-lime" : "border-ink/20 text-ink/50"}`}>
                      <IconChevron className="h-3.5 w-3.5" />
                    </span>
                  </button>
                  <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}>
                    <div className="overflow-hidden"><p className="px-6 pb-6 leading-relaxed text-inkmute">{f.a}</p></div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* Box interactivo para preguntar por WhatsApp directo */}
        <Reveal delay={200} className="mt-14">
          <div className="mx-auto max-w-xl rounded-3xl border-2 border-evergreen/15 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-evergreen text-lime shadow-sm">
                <IconWhatsApp className="h-6 w-6" />
              </span>
              <div>
                <h3 className="font-display text-lg font-extrabold text-ink leading-tight">¿Te quedaste con alguna duda?</h3>
                <p className="text-xs text-inkmute">Escribí tu consulta acá y te respondemos por WhatsApp en minutos:</p>
              </div>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const input = form.elements.namedItem("faqQuery") as HTMLInputElement;
                const q = input?.value?.trim();
                if (!q) return;
                const text = `¡Hola! Vengo de la página de Cupito y quería consultarles: ${q}`;
                window.open(`https://wa.me/5491131996205?text=${encodeURIComponent(text)}`, "_blank");
              }}
              className="mt-4 flex flex-col sm:flex-row gap-2"
            >
              <input
                name="faqQuery"
                type="text"
                placeholder="Ej: ¿Puedo usarlo si tengo 3 profesionales en el local?"
                required
                className="field flex-1 text-sm bg-ink/[0.02]"
              />
              <button
                type="submit"
                className="btn-press btn-glow-lime inline-flex items-center justify-center gap-2 rounded-xl bg-evergreen px-5 py-3 font-display text-xs font-bold text-lime hover:bg-pine"
              >
                <span>Consultar por WhatsApp</span>
                <IconArrow className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </Reveal>

        <Reveal delay={250} className="mt-10 text-center">
          <a href="#/auth" className="inline-flex items-center gap-2 rounded-full border-2 border-ink/20 px-6 py-3 font-display font-bold text-ink transition-all duration-200 hover:-translate-y-0.5 hover:border-evergreen hover:bg-evergreen hover:text-lime">
            Probar Cupito gratis <IconArrow className="h-4 w-4" />
          </a>
        </Reveal>
      </div>
    </section>
  );
}

/* ============ FOOTER ============ */
function Footer() {
  const [legal, setLegal] = useState<"terms" | "privacy" | null>(null);
  return (
    <footer className="relative overflow-hidden bg-evergreen text-paper">
      <div className="relative border-b border-paper/10">
        <div className="gridlines absolute inset-0" aria-hidden="true" />
        <div className="absolute left-1/2 top-1/2 h-[380px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-3xl" style={{ background: "radial-gradient(circle, #cdf463 0%, transparent 65%)" }} aria-hidden="true" />
        <div className="relative mx-auto max-w-5xl px-5 py-24 text-center sm:px-8 lg:py-32">
          <Reveal>
            <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-lime/30 bg-lime/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-lime">
              <span className="blinkdot h-2 w-2 rounded-full bg-lime" /> Tu competencia ya está online
            </p>
            <h2 className="mx-auto mt-6 max-w-3xl font-display text-[clamp(2.6rem,6.5vw,5rem)] font-extrabold leading-[0.98] tracking-[-0.03em]">
              Tu próximo turno se agenda <span className="text-lime">solo</span>.
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg text-paper/70">En 10 minutos tenés tu link funcionando. Esta noche, mientras cenás, alguien puede estar reservando con vos.</p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <a href="#/auth" className="group inline-flex items-center gap-3 rounded-full bg-lime px-9 py-5 font-display text-xl font-bold text-ink transition-all duration-200 hover:-translate-y-1 hover:bg-limedeep hover:shadow-[0_20px_50px_rgba(205,244,99,0.4)] active:translate-y-0">
                Crear mi agenda gratis <IconArrow className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1.5" />
              </a>
              <a href="/studio-nails" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border-2 border-paper/25 px-7 py-[18px] font-display text-base font-bold text-paper transition-all duration-200 hover:border-lime hover:text-lime">
                Ver el ejemplo en vivo ↗
              </a>
            </div>
            <p className="mt-7 text-sm text-paper/50">Plan gratis para siempre · Sin tarjeta · Cancelás cuando quieras · Tus datos son tuyos</p>
          </Reveal>
        </div>
      </div>
      <div className="relative mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <a href="#inicio" className="flex items-center gap-2.5 text-paper">
              <LogoMark className="h-9 w-9 text-fern" />
              <span className="font-display text-2xl font-bold tracking-tight">cupito<span className="text-lime">.</span></span>
            </a>
            <p className="mt-4 max-w-xs leading-relaxed text-paper/60">El sistema de reservas online para negocios que viven de sus turnos. Hecho en Latinoamérica, para Latinoamérica.</p>
            <div className="mt-6 flex gap-3">
              <a href="mailto:hola@cupito.app" aria-label="Escribinos a hola@cupito.app" title="hola@cupito.app" className="flex h-10 w-10 items-center justify-center rounded-full border border-paper/20 text-paper/70 transition-all duration-200 hover:-translate-y-1 hover:border-lime hover:bg-lime hover:text-ink"><IconMail className="h-4 w-4" /></a>
              <a href="https://instagram.com/cupitoapp" target="_blank" rel="noreferrer" aria-label="Cupito en Instagram" title="@cupitoapp" className="flex h-10 w-10 items-center justify-center rounded-full border border-paper/20 text-paper/70 transition-all duration-200 hover:-translate-y-1 hover:border-lime hover:bg-lime hover:text-ink"><IconInstagram className="h-4 w-4" /></a>
              <a href="https://wa.me/5491131996205?text=Hola!%20Quiero%20saber%20m%C3%A1s%20de%20Cupito" target="_blank" rel="noreferrer" aria-label="Cupito en WhatsApp" title="WhatsApp" className="flex h-10 w-10 items-center justify-center rounded-full border border-paper/20 text-paper/70 transition-all duration-200 hover:-translate-y-1 hover:border-lime hover:bg-lime hover:text-ink"><IconWhatsApp className="h-4 w-4" /></a>
            </div>
            <p className="mt-4 text-sm text-paper/60">Soporte: <a href="mailto:hola@cupito.app" className="font-bold text-lime hover:underline">hola@cupito.app</a></p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {[
              { title: "Producto", links: [{ t: "Funciones", h: "#beneficios" }, { t: "Precios", h: "#precios" }, { t: "Preguntas", h: "#faq" }, { t: "Crear cuenta", h: "#/auth" }] },
              { title: "Rubros", links: [{ t: "Barberías", h: "#precios" }, { t: "Clínicas y consultorios", h: "#precios" }, { t: "Estética", h: "#precios" }, { t: "Tattoo", h: "#precios" }] },
              { title: "Empresa", links: [{ t: "Contacto", h: "mailto:hola@cupito.app" }, { t: "Instagram", h: "https://instagram.com/cupitoapp" }, { t: "WhatsApp", h: "https://wa.me/5491131996205" }] },
            ].map((col) => (
              <div key={col.title}>
                <h3 className="font-display text-sm font-bold uppercase tracking-[0.18em] text-lime">{col.title}</h3>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => <li key={l.t}><a href={l.h} {...(l.h.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})} className="text-sm text-paper/60 transition-colors duration-200 hover:text-lime">{l.t}</a></li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-paper/10 pt-8 sm:flex-row">
          <p className="text-sm text-paper/45">© 2026 Cupito. Todos los cupitos reservados.</p>
          <div className="flex gap-6 text-sm text-paper/45">
            <button onClick={() => setLegal("terms")} className="transition-colors hover:text-lime">Términos</button>
            <button onClick={() => setLegal("privacy")} className="transition-colors hover:text-lime">Privacidad</button>
          </div>
        </div>
      </div>
      {legal && <LegalModal doc={legal === "terms" ? TERMS_DOC : PRIVACY_DOC} onClose={() => setLegal(null)} />}
      <p className="pointer-events-none select-none whitespace-nowrap text-center font-display text-[19vw] font-extrabold leading-[0.72] tracking-tighter text-paper/[0.04]" aria-hidden="true">cupito.</p>
    </footer>
  );
}

function StickyMobileBar() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShow(window.scrollY > 480);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-3 inset-x-3 z-40 md:hidden pop-in">
      <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-lime/30 bg-evergreen/95 px-4 py-3 text-paper shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <LogoMark className="h-7 w-7 text-lime shrink-0" />
          <div className="truncate">
            <p className="font-display text-xs font-extrabold text-paper leading-tight">Cupito</p>
            <p className="text-[10px] text-paper/70 truncate">Creá tu página gratis en 2 min</p>
          </div>
        </div>
        <a
          href="#/auth"
          className="btn-press btn-glow-lime shrink-0 rounded-full bg-lime px-4 py-2 font-display text-xs font-extrabold text-ink shadow-sm active:scale-95"
        >
          Empezar gratis →
        </a>
      </div>
    </div>
  );
}
