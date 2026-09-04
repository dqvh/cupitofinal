import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useStore, type Plan } from "./lib/store";
import { createMercadoPagoCheckout, isPaidPlan, savePendingCheckout } from "./lib/billing";
import {
  Reveal,
  LogoMark,
  IconArrow,
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
  IconBag,
  IconWhatsApp,
  IconMail,
  IconInstagram,
  LegalModal,
  TERMS_DOC,
  PRIVACY_DOC,
} from "./components/kit";

/* ================================================================
   LANDING CUPITO — REDISEÑO SAAS MODERNO & MINIMALISTA
   ================================================================ */

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#f8faf9] text-slate-900 antialiased selection:bg-emerald-500/20 selection:text-emerald-950">
      <Nav />
      <main>
        <Hero />
        <IndustriesBar />
        <BentoFeatures />
        <ComparisonSection />
        <RoiCalculator />
        <Pricing />
        <Testimonials />
        <Faq />
      </main>
      <StickyMobileBar />
      <LiveSocialProofToast />
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
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "#funciones", label: "Funciones" },
    { href: "#comparativa", label: "¿Por qué Cupito?" },
    { href: "#calculadora", label: "Calculadora" },
    { href: "#precios", label: "Precios" },
    { href: "#faq", label: "FAQ" },
  ];

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-slate-200/80 bg-white/85 py-3 shadow-sm backdrop-blur-md"
          : "bg-transparent py-5"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 sm:px-8">
        <a href="#inicio" className="group flex items-center gap-2.5">
          <LogoMark className="h-8 w-8 text-emerald-600 transition-transform duration-200 group-hover:scale-105" />
          <span className="font-display text-2xl font-extrabold tracking-tight text-slate-900">
            cupito<span className="text-emerald-600">.</span>
          </span>
        </a>

        <nav className="hidden items-center gap-7 lg:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              {l.label}
            </a>
          ))}
          <a
            href="/studio-nails"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 transition-colors hover:text-emerald-800"
          >
            Ver demo en vivo <span className="text-xs">↗</span>
          </a>
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <a
              href="#/app"
              className="group inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition-all duration-200 hover:bg-slate-800 shadow-sm"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 font-display text-[10px] font-bold text-slate-950">
                {user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
              </span>
              Mi panel
              <IconArrow className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </a>
          ) : (
            <>
              <a
                href="#/auth?modo=login"
                className="hidden rounded-full px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900 sm:block"
              >
                Iniciar sesión
              </a>
              <a
                href="#/auth"
                className="rounded-full bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition-all duration-200 hover:bg-emerald-700 hover:shadow-md hover:shadow-emerald-600/20 sm:px-5 sm:text-sm"
              >
                Crear cuenta gratis
              </a>
            </>
          )}

          <button
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            className="btn-press flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 lg:hidden"
          >
            <div className="flex h-3.5 w-4 flex-col justify-between">
              <span
                className={`h-0.5 w-full rounded-full bg-current transition-all duration-300 ${
                  open ? "translate-y-[6px] rotate-45 text-emerald-600" : ""
                }`}
              />
              <span
                className={`h-0.5 w-full rounded-full bg-current transition-all duration-200 ${
                  open ? "scale-0 opacity-0" : ""
                }`}
              />
              <span
                className={`h-0.5 w-full rounded-full bg-current transition-all duration-300 ${
                  open ? "-translate-y-[6px] -rotate-45 text-emerald-600" : ""
                }`}
              />
            </div>
          </button>
        </div>
      </div>

      {/* Menú desplegable móvil */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out lg:hidden ${
          open
            ? "grid-rows-[1fr] border-b border-slate-200/80 opacity-100 shadow-lg"
            : "pointer-events-none grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden bg-white/95 backdrop-blur-xl">
          <nav className="flex flex-col gap-1 px-5 py-4">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
              >
                <span>{l.label}</span>
                <span className="text-xs text-slate-400">→</span>
              </a>
            ))}
            <a
              href="/studio-nails"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
            >
              <span>Ver ejemplo en vivo 💅</span>
              <span className="text-xs">↗</span>
            </a>
            {!user && (
              <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                <a
                  href="#/auth?modo=login"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-center text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Iniciar sesión
                </a>
                <a
                  href="#/auth"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-center text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
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

/* ============ HERO SECTION ============ */
function Hero() {
  return (
    <section id="inicio" className="relative overflow-hidden pt-32 pb-16 sm:pt-40 sm:pb-24 lg:pt-44 lg:pb-28">
      {/* Resplandor radial suave de fondo (Estilo Optivize & Flowzy) */}
      <div className="pointer-events-none absolute inset-x-0 -top-40 flex justify-center overflow-hidden" aria-hidden="true">
        <div className="h-[650px] w-[900px] rounded-full bg-gradient-to-b from-emerald-100/70 via-emerald-50/40 to-transparent blur-3xl" />
      </div>
      <div className="pointer-events-none absolute inset-0 gridlines-dark opacity-40 [mask-image:radial-gradient(ellipse_at_top,black_40%,transparent_75%)]" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>La plataforma de reservas online más simple para tu negocio</span>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <h1 className="mt-6 font-display text-4xl sm:text-6xl lg:text-[66px] font-extrabold tracking-tight text-slate-900 leading-[1.06]">
              Llená tu agenda sin contestar{" "}
              <span className="relative inline-block text-emerald-600">
                un solo mensaje.
              </span>
            </h1>
          </Reveal>

          <Reveal delay={180}>
            <p className="mx-auto mt-6 max-w-2xl text-lg sm:text-xl text-slate-600 leading-relaxed">
              Dales a tus clientes un link para reservar en 3 clics, cobrar la seña con Mercado Pago y enviar recordatorios automáticos por WhatsApp. Vos solo te dedicás a atender.
            </p>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3.5 sm:gap-4">
              <a
                href="#/auth"
                className="group inline-flex items-center gap-2.5 rounded-full bg-emerald-600 px-7 py-4 font-display text-base font-bold text-white shadow-lg shadow-emerald-600/25 transition-all duration-200 hover:bg-emerald-700 hover:shadow-xl hover:shadow-emerald-600/30 hover:-translate-y-0.5 active:translate-y-0"
              >
                Crear mi página gratis
                <IconArrow className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </a>
              <a
                href="/studio-nails"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-4 font-display text-base font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:border-slate-300"
              >
                Ver ejemplo en vivo ↗
              </a>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <IconCheck className="h-4 w-4 text-emerald-600" /> Plan gratis para siempre
              </span>
              <span className="inline-flex items-center gap-1.5">
                <IconCheck className="h-4 w-4 text-emerald-600" /> Sin tarjeta de crédito
              </span>
              <span className="inline-flex items-center gap-1.5">
                <IconCheck className="h-4 w-4 text-emerald-600" /> Listo en 2 minutos
              </span>
            </div>
          </Reveal>
        </div>

        {/* Showcase de Producto / Maqueta Interactiva */}
        <Reveal delay={300} className="mt-14 sm:mt-16">
          <div className="relative mx-auto max-w-4xl">
            <BookingDemoWidget />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ============ WIDGET INTERACTIVO DE DEMO ============ */
const DEMO_SERVICES = [
  { name: "Corte tradicional / Fade", price: "$12.000", dur: "30 min" },
  { name: "Corte + perfilado de barba", price: "$18.000", dur: "45 min" },
  { name: "Color completo & nutrición", price: "$35.000", dur: "90 min" },
  { name: "Manicura spa & semipermanente", price: "$14.000", dur: "45 min" },
];
const DEMO_TIMES = ["09:00", "09:45", "10:30", "11:15", "12:00", "14:30", "15:15", "16:00", "16:45", "17:30", "18:15", "19:00"];
const DEMO_STEPS = ["1. Servicio", "2. Día", "3. Horario", "4. Confirmación"];

function BookingDemoWidget() {
  const [step, setStep] = useState(0);
  const [service, setService] = useState<number | null>(0);
  const [day, setDay] = useState<number | null>(1);
  const [time, setTime] = useState<string | null>("15:15");
  const [done, setDone] = useState(false);

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i + 1);
      return d;
    });
  }, []);

  const isBusy = (tIdx: number, dIdx: number) => (tIdx * 5 + dIdx * 3) % 4 === 0;

  const reset = () => {
    setStep(0);
    setService(0);
    setDay(1);
    setTime("15:15");
    setDone(false);
  };

  const dayLabel = day !== null ? `${days[day].toLocaleDateString("es-ES", { weekday: "short" })} ${days[day].getDate()}` : "";

  return (
    <div className="relative">
      {/* Tarjeta flotante 1: Turno confirmado */}
      <div className="absolute -left-6 -top-6 z-20 hidden items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/95 p-3.5 shadow-xl shadow-slate-200/50 backdrop-blur-md sm:flex">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 font-bold text-sm">
          ✓
        </span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Nuevo turno online</p>
          <p className="text-xs font-bold text-slate-800">Sofía M. · Manicura spa</p>
          <p className="text-[11px] text-slate-500">Sábado 15:30 hs · Seña paga</p>
        </div>
      </div>

      {/* Tarjeta flotante 2: Seña con Mercado Pago */}
      <div className="absolute -right-6 top-1/4 z-20 hidden items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/95 p-3.5 shadow-xl shadow-slate-200/50 backdrop-blur-md md:flex">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-sm">
          $
        </span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Mercado Pago</p>
          <p className="text-xs font-bold text-slate-900">+$5.000 seña acreditada</p>
          <p className="text-[11px] text-emerald-600 font-medium">Turno asegurado ✓</p>
        </div>
      </div>

      {/* Tarjeta flotante 3: WhatsApp automático */}
      <div className="absolute -left-4 -bottom-6 z-20 hidden items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/95 p-3.5 shadow-xl shadow-slate-200/50 backdrop-blur-md lg:flex">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 font-bold text-sm">
          <IconWhatsApp className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Recordatorio 24h antes</p>
          <p className="text-xs font-bold text-slate-800">«Hola Lucas, te esperamos mañana a las 11»</p>
          <p className="text-[11px] text-slate-500">Automático sin tocar el celular</p>
        </div>
      </div>

      {/* Marco de la App */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-200/60">
        {/* Barra superior de la ventana */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 font-display text-sm font-bold text-white shadow-sm">
              EN
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="font-display text-sm font-bold text-slate-900">Estudio Norte</p>
                <span className="text-xs text-emerald-600" title="Verificado">✓</span>
              </div>
              <p className="text-xs text-slate-500">cupito.app/estudio-norte · Responde en 0 seg</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Demo en vivo
          </span>
        </div>

        {/* Pasos */}
        {!done && (
          <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-3 bg-slate-50/40">
            {DEMO_STEPS.map((s, i) => (
              <div key={s} className="flex-1">
                <div className="h-1 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                    style={{ width: i < step ? "100%" : i === step ? "60%" : "0%" }}
                  />
                </div>
                <p className={`mt-1 text-[11px] font-semibold ${i <= step ? "text-slate-900" : "text-slate-400"}`}>
                  {s}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Contenido interactivo */}
        <div className="p-6 sm:p-8">
          {!done && step === 0 && (
            <div className="grid gap-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Elegí un servicio para probar:
              </p>
              {DEMO_SERVICES.map((s, i) => (
                <button
                  key={s.name}
                  onClick={() => {
                    setService(i);
                    setStep(1);
                  }}
                  className={`group flex items-center justify-between rounded-xl border p-4 text-left transition-all duration-200 ${
                    service === i
                      ? "border-emerald-600 bg-emerald-50/30 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                  }`}
                >
                  <div>
                    <span className="block font-display text-sm font-bold text-slate-900">{s.name}</span>
                    <span className="text-xs text-slate-500">{s.dur}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-display text-sm font-bold text-emerald-700">{s.price}</span>
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-slate-400 group-hover:border-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                      <IconCheck className="h-3 w-3" />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!done && step === 1 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Elegí el día:
                </p>
                <button onClick={() => setStep(0)} className="text-xs font-semibold text-emerald-700 hover:underline">
                  ← Cambiar servicio
                </button>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {days.map((d, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setDay(i);
                      setStep(2);
                    }}
                    className={`flex flex-col items-center rounded-xl border py-3 transition-all ${
                      day === i
                        ? "border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase opacity-80">
                      {d.toLocaleDateString("es-ES", { weekday: "short" }).slice(0, 3)}
                    </span>
                    <span className="font-display text-lg font-extrabold leading-tight mt-0.5">
                      {d.getDate()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!done && step === 2 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Horarios disponibles ({dayLabel}):
                </p>
                <button onClick={() => setStep(1)} className="text-xs font-semibold text-emerald-700 hover:underline">
                  ← Cambiar día
                </button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {DEMO_TIMES.map((t, i) => {
                  const busy = day !== null && isBusy(i, day);
                  return (
                    <button
                      key={t}
                      disabled={busy}
                      onClick={() => setTime(t)}
                      className={`rounded-xl border py-2.5 font-display text-sm font-bold transition-all ${
                        busy
                          ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300 line-through"
                          : time === t
                          ? "border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                <div className="text-xs text-slate-500">
                  Seña estimada: <strong className="text-slate-800">$3.000</strong> por Mercado Pago
                </div>
                <button
                  onClick={() => setDone(true)}
                  disabled={!time}
                  className="rounded-full bg-emerald-600 px-6 py-2.5 font-display text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-700 disabled:opacity-50"
                >
                  Confirmar turno →
                </button>
              </div>
            </div>
          )}

          {done && service !== null && (
            <div className="text-center py-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <IconCheck className="h-7 w-7" />
              </div>
              <h3 className="mt-4 font-display text-2xl font-extrabold text-slate-900">
                ¡Turno confirmado al instante!
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Sin responder mensajes, sin enviar alias por chat y con la seña acreditada.
              </p>

              <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-left space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Servicio:</span>
                  <span className="font-bold text-slate-900">{DEMO_SERVICES[service].name}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Horario:</span>
                  <span className="font-bold text-slate-900">{dayLabel} a las {time} hs</span>
                </div>
                <div className="flex justify-between text-xs border-t border-slate-200/60 pt-2">
                  <span className="text-slate-500">Seña Mercado Pago:</span>
                  <span className="font-bold text-emerald-700">Acreditada ✓</span>
                </div>
              </div>

              <div className="mt-6 flex justify-center gap-3">
                <button
                  onClick={reset}
                  className="rounded-full border border-slate-200 bg-white px-5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
                >
                  ↺ Probar de nuevo
                </button>
                <a
                  href="#/auth"
                  className="rounded-full bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm transition-colors"
                >
                  Crear para mi negocio →
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============ BARRA DE RUBROS / SOCIAL PROOF ============ */
const INDUSTRIES = [
  "Barberías",
  "Salones de Uñas",
  "Estética & Spa",
  "Peluquerías",
  "Odontología",
  "Kinesiología",
  "Tattoo Studios",
  "Consultorios",
  "Personal Trainers",
];

function IndustriesBar() {
  return (
    <section className="border-y border-slate-200/70 bg-white py-6">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <p className="text-center text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
          Hecho a medida para negocios con turnos en toda Latinoamérica
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {INDUSTRIES.map((ind) => (
            <span
              key={ind}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {ind}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============ BENTO GRID DE FUNCIONALIDADES (FLOWZY / OPTIVIZE STYLE) ============ */
function BentoFeatures() {
  return (
    <section id="funciones" className="scroll-mt-24 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-800">
            Todo lo que necesitás
          </div>
          <h2 className="mt-4 font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
            Una plataforma completa, <br className="hidden sm:inline" />
            <span className="text-emerald-600">sin parches ni complicaciones.</span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            Diseñado para que vos y tu equipo se enfoquen en brindar un gran servicio, mientras Cupito se encarga de la agenda, los cobros y los avisos.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Card 1: Link en Bio (Grande 2 cols en lg) */}
          <Reveal className="lg:col-span-2">
            <div className="card card-hover flex h-full flex-col justify-between p-8">
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                    <IconLink className="h-6 w-6" />
                  </span>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Sin instalar apps
                  </span>
                </div>
                <h3 className="mt-6 font-display text-2xl font-bold text-slate-900">
                  Tu link propio en Instagram y WhatsApp
                </h3>
                <p className="mt-2 max-w-xl text-slate-600 leading-relaxed">
                  Tus clientes entran directo desde el navegador de su celular con <strong className="font-semibold text-slate-900">cupito.app/tu-negocio</strong>. Eligen servicio, día y hora en 3 toques. No tienen que registrarse ni descargar nada.
                </p>
              </div>

              <div className="mt-8 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4">
                <div className="flex items-center gap-2 border-b border-slate-200/60 pb-3 text-xs text-slate-500">
                  <span className="h-2 w-2 rounded-full bg-red-400" />
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="ml-2 font-mono text-[11px] text-slate-600">cupito.app/tu-negocio</span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-600 text-white font-bold text-sm flex items-center justify-center">
                      TN
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Tu Salón o Estudio</p>
                      <p className="text-xs text-slate-500">Reservas abiertas 24/7</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm">
                    Reservar ahora
                  </span>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Card 2: Señas & Mercado Pago */}
          <Reveal delay={100}>
            <div className="card card-hover flex h-full flex-col justify-between p-8">
              <div>
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <IconWallet className="h-6 w-6" />
                </span>
                <h3 className="mt-6 font-display text-xl font-bold text-slate-900">
                  Cobro de señas con Mercado Pago
                </h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Definí un porcentaje o monto fijo de seña. El cliente paga al reservar o carga su comprobante. Se acabaron los huecos vacíos de último momento.
                </p>
              </div>
              <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-50/50 p-4">
                <span className="text-2xl font-extrabold text-emerald-700">−95%</span>
                <p className="text-xs font-semibold text-emerald-900 mt-0.5">reducción de ausencias sin aviso</p>
              </div>
            </div>
          </Reveal>

          {/* Card 3: Multi-profesionales */}
          <Reveal delay={150}>
            <div className="card card-hover flex h-full flex-col justify-between p-8">
              <div>
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <IconUsers className="h-6 w-6" />
                </span>
                <h3 className="mt-6 font-display text-xl font-bold text-slate-900">
                  Equipo y turnos simultáneos
                </h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Cada profesional con sus propios horarios, cortes de almuerzo y sincronización directa con el calendario de su propio celular (Google/Apple Calendar).
                </p>
              </div>
              <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-slate-500">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-bold">L</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-bold">M</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-bold">F</span>
                <span className="ml-1 text-emerald-700">Sincronizado en tiempo real</span>
              </div>
            </div>
          </Reveal>

          {/* Card 4: Recordatorios WhatsApp */}
          <Reveal delay={200}>
            <div className="card card-hover flex h-full flex-col justify-between p-8">
              <div>
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <IconBell className="h-6 w-6" />
                </span>
                <h3 className="mt-6 font-display text-xl font-bold text-slate-900">
                  Recordatorios automáticos
                </h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Confirmación inmediata y avisos automáticos por WhatsApp y Email 24h y 2h antes del turno. Nadie vuelve a decir «me olvidé».
                </p>
              </div>
              <div className="mt-6 rounded-2xl border border-slate-200/80 bg-slate-50 p-3.5 text-xs text-slate-600">
                💬 «Hola Camila! Mañana 15:30 te esperamos en Estudio Norte»
              </div>
            </div>
          </Reveal>

          {/* Card 5: Tienda & Extras */}
          <Reveal delay={250}>
            <div className="card card-hover flex h-full flex-col justify-between p-8">
              <div>
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <IconBag className="h-6 w-6" />
                </span>
                <h3 className="mt-6 font-display text-xl font-bold text-slate-900">
                  Tienda de productos & Promos
                </h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Vendé productos junto a cada reserva (cremas, ceras, esmaltes) y creá cupones de descuento para llenar los días u horarios más flojos.
                </p>
              </div>
              <div className="mt-6 flex items-center justify-between text-xs font-semibold text-slate-600">
                <span>Cupón: <strong className="text-emerald-700">VIERNES20</strong></span>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-emerald-800">20% OFF</span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ============ COMPARATIVA (SIN CUPITO VS CON CUPITO) ============ */
function ComparisonSection() {
  return (
    <section id="comparativa" className="scroll-mt-24 bg-white py-24 sm:py-32 border-y border-slate-200/70">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-800">
              Comparativa directa
            </div>
            <h2 className="mt-4 font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
              ¿Por qué dejar el cuaderno y el chat de WhatsApp?
            </h2>
            <p className="mt-4 text-base sm:text-lg text-slate-600">
              El costo oculto de coordinar turnos a mano es enorme. Mirá la diferencia desde el día 1:
            </p>
          </Reveal>
        </div>

        <Reveal delay={150} className="mt-16">
          <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-slate-200 shadow-sm bg-white">
            <div className="grid grid-cols-1 md:grid-cols-2">
              {/* Columna Tradicional */}
              <div className="border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50/50 p-8 sm:p-10">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100 text-red-600 font-bold text-xs">
                    ✕
                  </span>
                  <h3 className="font-display text-lg font-bold text-slate-800">El método tradicional</h3>
                </div>
                <ul className="mt-6 space-y-5 text-sm text-slate-600">
                  <li className="flex items-start gap-3">
                    <span className="text-red-500 mt-0.5">•</span>
                    <span><strong>40 mensajes al día:</strong> Respondés mientras atendés o a la medianoche con el celular pegado a la mano.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-red-500 mt-0.5">•</span>
                    <span><strong>Ausencias sin aviso:</strong> El cliente no aparece, el sillón queda vacío y ese dinero no se recupera.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-red-500 mt-0.5">•</span>
                    <span><strong>Turnos pisados:</strong> Anotás en cuadernos o no cruzás agendas y dos clientes caen al mismo horario.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-red-500 mt-0.5">•</span>
                    <span><strong>Sin cobro de señas:</strong> Mandar tu Alias por chat da pereza y la mitad no transfiere jamás.</span>
                  </li>
                </ul>
              </div>

              {/* Columna Cupito */}
              <div className="bg-emerald-50/20 p-8 sm:p-10">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white font-bold text-xs">
                    ✓
                  </span>
                  <h3 className="font-display text-lg font-bold text-emerald-950">Con Cupito</h3>
                </div>
                <ul className="mt-6 space-y-5 text-sm text-slate-700">
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-600 font-bold mt-0.5">✓</span>
                    <span><strong>Agenda en piloto automático:</strong> Tus clientes reservan solos las 24 horas desde tu link en bio.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-600 font-bold mt-0.5">✓</span>
                    <span><strong>Seña asegurada:</strong> Cobrás por Mercado Pago o transferencia bancaria antes de confirmar.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-600 font-bold mt-0.5">✓</span>
                    <span><strong>Calendario inteligente:</strong> Cada profesional tiene sus horarios y su sync de calendario al celular.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-600 font-bold mt-0.5">✓</span>
                    <span><strong>Recordatorios por WhatsApp:</strong> Avisos 24h y 2h antes para que nadie se olvide del turno.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ============ CALCULADORA ROI INTERACTIVA ============ */
function RoiCalculator() {
  const [weeklyBookings, setWeeklyBookings] = useState(35);
  const [ticketPrice, setTicketPrice] = useState(15000);

  const monthlyBookings = weeklyBookings * 4.2;
  const savedHoursMonth = Math.round((monthlyBookings * 7) / 60);
  const noShowsAvoided = Math.round(monthlyBookings * 0.15);
  const recoveredMoney = noShowsAvoided * ticketPrice;

  return (
    <section id="calculadora" className="scroll-mt-24 py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <Reveal className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-800">
            Calculadora interactiva
          </div>
          <h2 className="mt-4 font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
            ¿Cuánto tiempo y dinero te ahorrás por mes?
          </h2>
          <p className="mt-3 text-base sm:text-lg text-slate-600">
            Ajustá los números a la realidad de tu negocio y mirá el retorno instantáneo:
          </p>
        </Reveal>

        <Reveal delay={150} className="mt-14">
          <div className="card grid gap-8 p-8 sm:p-12 lg:grid-cols-2 lg:items-center">
            {/* Sliders */}
            <div className="space-y-7">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="font-display text-sm font-bold text-slate-800">
                    Turnos que atendés por semana
                  </label>
                  <span className="font-display text-lg font-extrabold text-emerald-700">
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
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-emerald-600"
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                  <span>10 turnos</span>
                  <span>60 turnos</span>
                  <span>120 turnos</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="font-display text-sm font-bold text-slate-800">
                    Precio promedio de tu servicio
                  </label>
                  <span className="font-display text-lg font-extrabold text-emerald-700">
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
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-emerald-600"
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                  <span>$5.000</span>
                  <span>$25.000</span>
                  <span>$50.000</span>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed border-t border-slate-100 pt-4">
                * Basado en 7 min promedio de coordinación manual por turno y un 15% de ausencias reducidas mediante seña previa.
              </p>
            </div>

            {/* Tarjetas de resultados */}
            <div className="grid gap-4">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50/50 p-6">
                <span className="block text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Tiempo recuperado
                </span>
                <p className="mt-2 font-display text-3xl sm:text-4xl font-extrabold text-slate-900">
                  ≈ {savedHoursMonth} horas <span className="text-base text-slate-500 font-sans">/ mes</span>
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Son casi <strong>{Math.round(savedHoursMonth / 8)} días enteros de trabajo</strong> que dejás de gastar contestando mensajes en WhatsApp.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Dinero asegurado en señas
                </span>
                <p className="mt-2 font-display text-3xl sm:text-4xl font-extrabold text-emerald-700">
                  +${recoveredMoney.toLocaleString("es-AR")} <span className="text-base text-slate-500 font-sans">/ mes</span>
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Turnos cobrados por adelantado que antes se perdían por ausencias sin aviso.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ============ PRECIOS ============ */
type Billing = "mensual" | "anual";
type Feature = { t: string; soon?: boolean };
type PlanDef = {
  id: Plan;
  name: string;
  tagline: string;
  monthly: number;
  yearly: number;
  cta: string;
  highlight: boolean;
  badge?: string;
  features: Feature[];
};

const PLANS: PlanDef[] = [
  {
    id: "semilla",
    name: "Semilla",
    tagline: "Para empezar a ordenar tu agenda gratis.",
    monthly: 0,
    yearly: 0,
    cta: "Empezar gratis",
    highlight: false,
    features: [
      { t: "1 profesional y 1 calendario" },
      { t: "Hasta 25 reservas por mes" },
      { t: "Tu link propio cupito.app/tu-negocio" },
      { t: "Confirmación y recordatorio por email" },
      { t: "Lista de espera básica" },
      { t: "Soporte inicial" },
    ],
  },
  {
    id: "crece",
    name: "Crece",
    tagline: "El plan favorito de profesionales y barberías.",
    monthly: 9500,
    yearly: 7900,
    cta: "Suscribirme a Crece",
    highlight: true,
    badge: "Más elegido",
    features: [
      { t: "Reservas ilimitadas" },
      { t: "Hasta 3 profesionales con horarios propios" },
      { t: "Cobro de señas por Mercado Pago & Transferencia" },
      { t: "Recordatorios por WhatsApp automáticos" },
      { t: "Tienda de productos junto al turno" },
      { t: "Cupones de descuento y promociones" },
      { t: "Sincronización con Google & Apple Calendar" },
    ],
  },
  {
    id: "escala",
    name: "Escala",
    tagline: "Para salones grandes, clínicas y franquicias.",
    monthly: 22000,
    yearly: 18300,
    cta: "Suscribirme a Escala",
    highlight: false,
    features: [
      { t: "Todo lo del plan Crece" },
      { t: "Profesionales y colaboradores ilimitados" },
      { t: "Horarios independientes por profesional" },
      { t: "Estadísticas avanzadas de ingresos y retención" },
      { t: "Exportación de clientes a Excel / CSV" },
      { t: "Lista de espera VIP con prioridad automática" },
      { t: "Soporte preferencial por WhatsApp" },
    ],
  },
];

function Pricing() {
  const [billing, setBilling] = useState<Billing>("anual");
  const [showCustom, setShowCustom] = useState(false);
  const [subscribing, setSubscribing] = useState<PlanDef | null>(null);
  const { user } = useStore();

  return (
    <section id="precios" className="scroll-mt-24 py-24 sm:py-32 bg-white border-y border-slate-200/70">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-800">
              Precios simples y transparentes
            </div>
            <h2 className="mt-4 font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
              Menos de lo que te cuesta un solo turno vacío.
            </h2>
            <p className="mt-4 text-base sm:text-lg text-slate-600">
              Un solo cliente recuperado al mes paga todo el plan. Precios en pesos argentinos, sin comisiones ocultas.
            </p>
          </Reveal>

          {/* Toggle Mensual / Anual */}
          <Reveal delay={100} className="mt-8 flex justify-center">
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100/80 p-1.5 shadow-inner">
              <button
                type="button"
                onClick={() => setBilling("mensual")}
                className={`rounded-full px-5 py-2 text-xs sm:text-sm font-bold transition-all ${
                  billing === "mensual"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Facturación mensual
              </button>
              <button
                type="button"
                onClick={() => setBilling("anual")}
                className={`flex items-center gap-1.5 rounded-full px-5 py-2 text-xs sm:text-sm font-bold transition-all ${
                  billing === "anual"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <span>Facturación anual</span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
                  2 meses gratis
                </span>
              </button>
            </div>
          </Reveal>
        </div>

        <div className="mx-auto mt-16 grid max-w-6xl items-stretch gap-8 lg:grid-cols-3">
          {PLANS.map((p, i) => {
            const price = billing === "mensual" ? p.monthly : p.yearly;
            return (
              <Reveal key={p.name} delay={i * 100} className="h-full">
                <div
                  className={`relative flex h-full flex-col rounded-3xl p-8 transition-all duration-200 ${
                    p.highlight
                      ? "border-2 border-emerald-600 bg-white shadow-xl shadow-emerald-950/5 ring-4 ring-emerald-600/5 lg:-my-3 lg:py-10"
                      : "border border-slate-200 bg-white shadow-sm hover:border-slate-300 hover:shadow-md"
                  }`}
                >
                  {p.highlight && (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm">
                      {p.badge}
                    </span>
                  )}

                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-2xl font-bold text-slate-900">{p.name}</h3>
                  </div>
                  <p className="mt-2 text-sm text-slate-500 min-h-[40px]">{p.tagline}</p>

                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="font-display text-5xl font-extrabold tracking-tight text-slate-900">
                      {price === 0 ? "$0" : `$${price.toLocaleString("es-AR")}`}
                    </span>
                    <span className="text-sm font-semibold text-slate-400">/ mes</span>
                  </div>

                  <p className="mt-1 text-xs text-slate-400">
                    {billing === "anual" && price > 0
                      ? `Facturado anual · ahorrás $${((p.monthly - p.yearly) * 12).toLocaleString("es-AR")} al año`
                      : price > 0
                      ? "Facturado mes a mes, cancelás cuando quieras"
                      : "Gratis para siempre. Sin tarjeta."}
                  </p>

                  <ul className="mt-8 flex-1 space-y-3.5 border-t border-slate-100 pt-6">
                    {p.features.map((f) => (
                      <li key={f.t} className="flex items-start gap-3 text-sm text-slate-700">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                          <IconCheck className="h-2.5 w-2.5" />
                        </span>
                        <span>{f.t}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8">
                    {p.monthly === 0 ? (
                      <a
                        href="#/auth"
                        className="group flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white py-3.5 text-sm font-bold text-slate-800 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300"
                      >
                        {p.cta}
                        <IconArrow className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </a>
                    ) : (
                      <button
                        onClick={() =>
                          user ? setSubscribing(p) : (window.location.hash = `#/auth?plan=${p.id}`)
                        }
                        className={`group flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold transition-all shadow-sm ${
                          p.highlight
                            ? "bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-emerald-600/25"
                            : "bg-slate-900 text-white hover:bg-slate-800"
                        }`}
                      >
                        {user ? p.cta : "Crear cuenta y " + p.cta.toLowerCase()}
                        <IconArrow className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </button>
                    )}
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={200} className="mt-14 text-center">
          <p className="text-sm text-slate-500">
            ¿Tenés múltiples sucursales o una franquicia?{" "}
            <button
              onClick={() => setShowCustom(true)}
              className="font-bold text-emerald-700 underline decoration-emerald-500/40 underline-offset-4 hover:text-emerald-800"
            >
              Armamos un plan a medida →
            </button>
          </p>
        </Reveal>
      </div>

      {showCustom && <CustomPlanModal onClose={() => setShowCustom(false)} />}
      {subscribing && (
        <SubscriptionModal plan={subscribing} billing={billing} onClose={() => setSubscribing(null)} />
      )}
    </section>
  );
}

/* Modal de Suscripción a Mercado Pago */
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
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="pop-in w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-7" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-2xl font-extrabold text-slate-900">Plan {plan.name}</h3>
            <p className="mt-1 text-sm text-slate-500">
              <strong className="text-emerald-700">${price.toLocaleString("es-AR")} ARS</strong> / mes · facturado {billing === "mensual" ? "mensualmente" : "anualmente"}
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            ✕
          </button>
        </div>
        <ul className="mt-5 space-y-2.5">
          {plan.features.slice(0, 5).map((f) => (
            <li key={f.t} className="flex items-start gap-2.5 text-sm text-slate-700">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <IconCheck className="h-2.5 w-2.5" />
              </span>
              {f.t}
            </li>
          ))}
        </ul>
        {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p>}
        <button
          onClick={subscribe}
          disabled={processing}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 py-3.5 font-display text-base font-bold text-white shadow-sm transition-all hover:bg-emerald-700 disabled:opacity-60"
        >
          {processing ? (
            <>
              <span className="h-2 w-2 rounded-full bg-white animate-ping" />
              <span>Conectando con Mercado Pago…</span>
            </>
          ) : (
            <>
              <span>Suscribirme con Mercado Pago</span>
              <IconArrow className="h-4 w-4" />
            </>
          )}
        </button>
        <p className="mt-3 text-center text-[11px] text-slate-400">
          Procesado de forma 100% segura por Mercado Pago. El plan se activa de inmediato y cancelás cuando quieras.
        </p>
      </div>
    </div>
  );
}

/* Modal Plan a Medida */
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
    } catch {
      /* continúa */
    }

    const text = `¡Hola! Soy ${form.nombre} de ${form.negocio} (${form.email}). ${form.sucursales ? `Tengo ${form.sucursales} sucursales. ` : ""}${form.mensaje ? `Necesito: ${form.mensaje}` : "Quiero un plan a medida."}`;
    setSending(false);
    setSent(true);
    window.open(`https://wa.me/5491131996205?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="pop-in w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-7" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-2xl font-extrabold text-slate-900">{sent ? "¡Gracias!" : "Plan a medida"}</h3>
          <button onClick={onClose} aria-label="Cerrar" className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-700">✕</button>
        </div>
        {sent ? (
          <div className="mt-5 text-center">
            <p className="text-lg font-bold text-emerald-700">¡Propuesta en camino! ✅</p>
            <p className="mt-2 text-sm text-slate-600">Se abrió tu WhatsApp con el mensaje listo. Te respondemos en menos de 24 horas.</p>
            <button onClick={onClose} className="mt-5 rounded-full bg-slate-900 px-6 py-2.5 text-sm font-bold text-white">Listo</button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-3.5">
            <p className="text-sm text-slate-500">Contanos sobre tu negocio y te armamos una propuesta especial.</p>
            <input required className="field" placeholder="Tu nombre *" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            <input required className="field" placeholder="Nombre del negocio *" value={form.negocio} onChange={(e) => setForm({ ...form, negocio: e.target.value })} />
            <input required type="email" className="field" placeholder="Email *" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="field" placeholder="¿Cuántas sucursales o profesionales son?" value={form.sucursales} onChange={(e) => setForm({ ...form, sucursales: e.target.value })} />
            <textarea className="field min-h-20 resize-none" placeholder="¿Qué necesitas que haga Cupito por vos?" value={form.mensaje} onChange={(e) => setForm({ ...form, mensaje: e.target.value })} />
            <button type="submit" disabled={sending} className="w-full rounded-full bg-emerald-600 py-3 font-display text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60">
              {sending ? "Enviando…" : "Pedir propuesta por WhatsApp →"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/* ============ TESTIMONIOS ============ */
const QUOTES = [
  {
    q: "Pasé de contestar 40 mensajes al día a cero. Las clientas reservan solas a las 2 AM y me entero al despertar. Me devolvió la tranquilidad.",
    name: "Caro Méndez",
    biz: "Studio Nails · Buenos Aires",
    initials: "CM",
  },
  {
    q: "La seña del 20% con Mercado Pago eliminó las ausencias. Antes se me caían 6 clientes por semana; ahora ese hueco ya está cobrado.",
    name: "Marcos Ledesma",
    biz: "Barbería La 9 · Córdoba",
    initials: "ML",
  },
  {
    q: "Con 3 profesionales en el local, la sincronización al calendario del celular nos ordenó la vida. Cada uno sabe exactamente sus turnos.",
    name: "Dra. Valentina Ruiz",
    biz: "Clínica Sonrisa · Rosario",
    initials: "VR",
  },
];

function Testimonials() {
  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-800">
            Opiniones reales
          </div>
          <h2 className="mt-4 font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
            Negocios que ya no pierden tiempo en WhatsApp.
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          {QUOTES.map((t, i) => (
            <Reveal key={t.name} delay={i * 100}>
              <div className="card card-hover flex h-full flex-col justify-between p-7 bg-white">
                <div>
                  <div className="flex gap-1 text-amber-400 mb-4">
                    {[...Array(5)].map((_, s) => (
                      <IconStar key={s} className="h-4 w-4" />
                    ))}
                  </div>
                  <p className="text-sm sm:text-base text-slate-700 leading-relaxed italic">
                    “{t.q}”
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 font-display text-xs font-bold text-emerald-800">
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-400">{t.biz}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============ PREGUNTAS FRECUENTES ============ */
const FAQS = [
  {
    q: "¿Mis clientes tienen que descargarse una app para reservar?",
    a: "No, para nada. Tus clientes tocan tu link (desde tu bio de Instagram, un estado de WhatsApp o escaneando un QR en tu local) y reservan directo en el navegador de su celular en 1 minuto. Sin descargas, sin ocupar memoria y sin contraseñas obligatorias.",
  },
  {
    q: "¿Es realmente gratis para empezar?",
    a: "Sí. El plan Semilla es gratuito para siempre (hasta 25 reservas al mes) y no te pide tarjeta de crédito. Cuando tu negocio crezca, podés pasar al plan Crece cuando quieras.",
  },
  {
    q: "¿Cómo funciona el cobro de la seña?",
    a: "Podés elegir cobrar una seña automática con Mercado Pago o por transferencia bancaria directa (a tu alias/CBU). Vos definís el porcentaje o monto fijo. El cliente realiza el pago al momento de reservar y el turno queda confirmado.",
  },
  {
    q: "¿Puedo tener múltiples profesionales con sus propios horarios?",
    a: "Sí, totalmente. Cada profesional puede tener sus propios días de atención, horarios de entrada y salida, cortes de almuerzo y sincronizar sus reservas directamente a su propio calendario de Google o Apple en su celular.",
  },
  {
    q: "¿Qué pasa si un cliente cancela o no puede ir?",
    a: "El cliente puede cancelar o reprogramar desde su confirmación con la anticipación que vos configures. El hueco se libera de inmediato en tu grilla horaria para que otro cliente lo ocupe.",
  },
  {
    q: "¿Necesito conocimientos técnicos para configurarlo?",
    a: "Ninguno. Si sabés usar WhatsApp o Instagram, podés manejar Cupito. Tu página ya viene lista para usar y podés personalizar tus servicios, precios y horarios en menos de 5 minutos.",
  },
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-24 py-24 sm:py-32 bg-white border-t border-slate-200/70">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <Reveal className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-800">
            Preguntas frecuentes
          </div>
          <h2 className="mt-4 font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
            Todo lo que querés saber antes de empezar.
          </h2>
        </Reveal>

        <div className="mt-12 space-y-3">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={f.q} delay={i * 50}>
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition-colors hover:border-slate-300">
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 p-5 text-left"
                    aria-expanded={isOpen}
                  >
                    <span className="font-display text-base sm:text-lg font-bold text-slate-900">
                      {f.q}
                    </span>
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-transform duration-200 ${
                        isOpen ? "rotate-90 text-emerald-600 bg-emerald-50" : ""
                      }`}
                    >
                      <IconChevron className="h-3.5 w-3.5" />
                    </span>
                  </button>
                  <div
                    className="grid transition-[grid-template-rows] duration-200 ease-out"
                    style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                  >
                    <div className="overflow-hidden">
                      <p className="px-5 pb-5 text-sm text-slate-600 leading-relaxed">
                        {f.a}
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* Caja de consulta directa por WhatsApp */}
        <Reveal delay={200} className="mt-12">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6 sm:p-7">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                <IconWhatsApp className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  ¿Tenés alguna otra pregunta?
                </h3>
                <p className="text-xs text-slate-500">
                  Escribinos tu consulta y te respondemos por WhatsApp en minutos:
                </p>
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
                className="field flex-1 text-sm"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 font-display text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors"
              >
                <span>Preguntar por WhatsApp</span>
                <IconArrow className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ============ FOOTER ============ */
function Footer() {
  const [legal, setLegal] = useState<"terms" | "privacy" | null>(null);

  return (
    <footer className="relative bg-slate-900 text-white overflow-hidden">
      {/* Banner CTA Final (Estilo Synchro & Flowzy) */}
      <div className="border-b border-slate-800">
        <div className="mx-auto max-w-5xl px-5 py-20 text-center sm:px-8 sm:py-28">
          <Reveal>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-400">
              Empezá hoy mismo
            </div>
            <h2 className="mx-auto mt-6 max-w-3xl font-display text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
              Tu próximo turno se agenda{" "}
              <span className="text-emerald-400">solo.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base sm:text-lg text-slate-400">
              En 2 minutos tenés tu link funcionando en Instagram y WhatsApp. Esta noche, mientras cenás o descansás, tus clientes pueden estar reservando con vos.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <a
                href="#/auth"
                className="group inline-flex items-center gap-2.5 rounded-full bg-emerald-500 px-8 py-4 font-display text-base font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 hover:-translate-y-0.5"
              >
                Crear mi página gratis
                <IconArrow className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
              <a
                href="/studio-nails"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-7 py-4 font-display text-base font-semibold text-white transition-colors hover:bg-slate-700"
              >
                Ver ejemplo en vivo ↗
              </a>
            </div>
            <p className="mt-5 text-xs text-slate-500">
              Plan gratis para siempre · Sin tarjeta · Cancelás cuando quieras
            </p>
          </Reveal>
        </div>
      </div>

      {/* Navegación y Links */}
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <a href="#inicio" className="flex items-center gap-2.5 text-white">
              <LogoMark className="h-8 w-8 text-emerald-400" />
              <span className="font-display text-2xl font-bold tracking-tight">
                cupito<span className="text-emerald-400">.</span>
              </span>
            </a>
            <p className="mt-4 max-w-sm text-sm text-slate-400 leading-relaxed">
              El sistema de reservas online para negocios que viven de sus turnos. Simple, rápido y sin complicaciones.
            </p>
            <div className="mt-6 flex gap-3">
              <a
                href="mailto:hola@cupito.app"
                aria-label="Email"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-800 text-slate-400 hover:border-emerald-400 hover:text-emerald-400 transition-colors"
              >
                <IconMail className="h-4 w-4" />
              </a>
              <a
                href="https://instagram.com/cupitoapp"
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-800 text-slate-400 hover:border-emerald-400 hover:text-emerald-400 transition-colors"
              >
                <IconInstagram className="h-4 w-4" />
              </a>
              <a
                href="https://wa.me/5491131996205?text=Hola!%20Quiero%20saber%20m%C3%A1s%20de%20Cupito"
                target="_blank"
                rel="noreferrer"
                aria-label="WhatsApp"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-800 text-slate-400 hover:border-emerald-400 hover:text-emerald-400 transition-colors"
              >
                <IconWhatsApp className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Producto</h4>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
                <li><a href="#funciones" className="hover:text-white transition-colors">Funciones</a></li>
                <li><a href="#comparativa" className="hover:text-white transition-colors">Comparativa</a></li>
                <li><a href="#precios" className="hover:text-white transition-colors">Precios</a></li>
                <li><a href="#faq" className="hover:text-white transition-colors">Preguntas frecuentes</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Rubros</h4>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
                <li><a href="#precios" className="hover:text-white transition-colors">Barberías & Peluquerías</a></li>
                <li><a href="#precios" className="hover:text-white transition-colors">Salones de Uñas & Estética</a></li>
                <li><a href="#precios" className="hover:text-white transition-colors">Clínicas & Consultorios</a></li>
                <li><a href="#precios" className="hover:text-white transition-colors">Tattoo Studios</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Contacto</h4>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
                <li><a href="mailto:hola@cupito.app" className="hover:text-white transition-colors">hola@cupito.app</a></li>
                <li><a href="https://wa.me/5491131996205" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">WhatsApp Soporte</a></li>
                <li><a href="#/auth" className="hover:text-white transition-colors">Ingresar a mi panel</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-800/80 pt-8 sm:flex-row text-xs text-slate-500">
          <p>© 2026 Cupito. Todos los derechos reservados.</p>
          <div className="flex gap-5">
            <button onClick={() => setLegal("terms")} className="hover:text-slate-300 transition-colors">
              Términos del servicio
            </button>
            <button onClick={() => setLegal("privacy")} className="hover:text-slate-300 transition-colors">
              Política de privacidad
            </button>
          </div>
        </div>
      </div>

      {legal && <LegalModal doc={legal === "terms" ? TERMS_DOC : PRIVACY_DOC} onClose={() => setLegal(null)} />}
    </footer>
  );
}

/* ============ BOTÓN FLOTANTE MÓVIL ============ */
function StickyMobileBar() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShow(window.scrollY > 450);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 z-40 md:hidden pop-in">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-3 shadow-xl shadow-slate-900/10 backdrop-blur-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <LogoMark className="h-6 w-6 text-emerald-600 shrink-0" />
          <div className="truncate">
            <p className="font-display text-xs font-bold text-slate-900 leading-tight">Cupito</p>
            <p className="text-[10px] text-slate-500 truncate">Creá tu página gratis en 2 min</p>
          </div>
        </div>
        <a
          href="#/auth"
          className="shrink-0 rounded-full bg-emerald-600 px-4 py-2 font-display text-xs font-bold text-white shadow-sm active:scale-95 transition-transform"
        >
          Empezar gratis →
        </a>
      </div>
    </div>
  );
}

/* ============ SOCIAL PROOF FLOTANTE (ESTILO SAAS MODERNO) ============ */
function LiveSocialProofToast() {
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const notifications = [
    { client: "Valen R.", service: "Corte Tradicional & Barba", business: "Barber Studio", time: "hace 2 min" },
    { client: "Sofía M.", service: "Semipermanente & Spa", business: "Nails Lounge", time: "hace 4 min" },
    { client: "Lucas B.", service: "Fade & Peinado", business: "Peluquería Central", time: "hace 6 min" },
    { client: "Martina D.", service: "Limpieza facial profunda", business: "Estética Sol", time: "hace 9 min" },
  ];

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!visible || dismissed) return;
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % notifications.length);
        setVisible(true);
      }, 500);
    }, 7000);
    return () => clearInterval(interval);
  }, [visible, dismissed, notifications.length]);

  if (dismissed || !visible) return null;
  const curr = notifications[index];

  return (
    <div className="pop-in fixed bottom-6 left-6 z-40 hidden md:flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-3 shadow-xl shadow-slate-900/5 backdrop-blur-md max-w-sm">
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xs font-bold text-emerald-700 border border-emerald-200/60">
        {curr.client[0]}
        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-slate-900 truncate">
          <strong>{curr.client}</strong> reservó <span className="text-emerald-700 font-medium">{curr.service}</span>
        </p>
        <p className="text-[10px] text-slate-500 truncate">
          en {curr.business} · <span className="text-slate-400">{curr.time}</span>
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Cerrar notificación"
        className="text-slate-400 hover:text-slate-600 p-1 text-xs"
      >
        ✕
      </button>
    </div>
  );
}
