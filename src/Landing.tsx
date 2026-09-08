import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  ChevronRight,
  CalendarDays,
  Clock,
  Scissors,
  Stethoscope,
  Dumbbell,
  Palette,
  Users,
  Store,
  Link,
  Wallet,
  BarChart3 as ChartNoAxesCombined,
  Bell,
  ShieldCheck,
  Globe,
  Menu,
  X,
  Play,
  Camera as Instagram,
  Mail,
  Plus,
  CheckCheck,
  MousePointer2,
  Pause,
  Sun,
} from "lucide-react";
import LandingTour from "./components/LandingTour";
import { PLAN_META, PLAN_AMOUNTS, PLAN_FEATURES, type Plan } from "./lib/plans";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "./components/Accordion";
import { LegalModal, TERMS_DOC, PRIVACY_DOC } from "./components/kit";
import "./styles/landing.css";
import "./styles/landing-light.css";
import "./styles/landing-refinement.css";
import "./styles/landing-polish.css";

const names = [
  "Lucía Fernández",
  "Tomás Ramírez",
  "Camila López",
  "Nicolás Pérez",
  "Martina Gómez",
  "Sofía Martínez",
];

const PLAN_PROFILES: Record<Plan, string> = {
  semilla: "Trabajás solo",
  crece: "Equipo de hasta 3",
  escala: "Equipo grande y reportes",
};

const plans = (["semilla", "crece", "escala"] as Plan[]).map((key) => ({
  key,
  name: PLAN_META[key].name,
  profile: PLAN_PROFILES[key],
  price: key === "semilla" ? "0" : PLAN_AMOUNTS[key].mensual.toLocaleString("es-AR"),
  intro: key === "semilla" ? "Para dar el primer paso." : key === "crece" ? "Para organizar tu día a día." : "Para conocer mejor tu negocio.",
  cta: key === "semilla" ? "Empezar gratis" : "Elegir " + PLAN_META[key].name,
  features: PLAN_FEATURES[key],
}));

export default function Landing() {
  const [user, setUser] = useState(false);
  useEffect(() => {
    const sync = () => { try { setUser(!!localStorage.getItem("cupito_session")); } catch { /* navegación pública sin almacenamiento */ } };
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const [mobile, setMobile] = useState(false);
  const [tick, setTick] = useState(0);
  const [running, setRunning] = useState(true);
  const [industry, setIndustry] = useState(0);
  const [legalDoc, setLegalDoc] = useState<{ title: string; body: string[] } | null>(null);

  useEffect(() => {
    if (!running || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setTick((v) => (v + 1) % 12), 6500);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const targets = document.querySelectorAll(".lp-reveal");
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.08 }
    );
    targets.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!mobile) return;
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobile(false);
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [mobile]);

  const services = [
    "Corte + brushing",
    "Consulta inicial",
    "Entrenamiento",
    "Sesión de estudio",
    "Reserva de cancha",
  ];

  const sectors = [
    ["Belleza", Scissors],
    ["Salud", Stethoscope],
    ["Bienestar", Dumbbell],
    ["Estudios", Palette],
    ["Deportes", CalendarDays],
  ] as const;

  const goToLogin = (e: React.MouseEvent) => {
    e.preventDefault();
    window.location.hash = "#/login";
  };

  const goToRegister = (planKey?: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    window.location.hash = planKey ? `#/registro?plan=${planKey}` : "#/registro";
  };

  const goToDemo = (e: React.MouseEvent) => {
    e.preventDefault();
    window.location.hash = "#/reservar/studio-nails";
  };

  return (
    <div className={"lp " + (!running ? "lp-paused" : "")}>
      <div className="lp-scroll-progress" />
      <a className="skip-link" href="#landing-main">
        Saltar al contenido
      </a>

      {/* HEADER */}
      <header className="lp-header">
        <a className="lp-logo" href="#/" aria-label="Cupito, inicio">
          <picture>
            <source srcSet="/cupito-logo.webp" type="image/webp" />
            <img src="/cupito-logo.png" width="39" height="39" alt="Cupito Logo" decoding="async" />
          </picture>
          <span>
            cupito<span className="lp-logo-dot">.</span>
          </span>
        </a>
        <nav
          id="landing-navigation"
          className={mobile ? "lp-nav open" : "lp-nav"}
          aria-label="Navegación principal"
        >
          <a href="#beneficios" onClick={() => setMobile(false)}>
            Beneficios
          </a>
          <a href="#como-funciona" onClick={() => setMobile(false)}>
            Cómo funciona
          </a>
          <a href="#precios" onClick={() => setMobile(false)}>
            Precios
          </a>
          <a href="#tu-marca" onClick={() => setMobile(false)}>
            Tu marca
          </a>
          <a href="#faq" onClick={() => setMobile(false)}>
            Preguntas
          </a>
          {user && (
            <a
              href="#/app"
              onClick={(e) => {
                e.preventDefault();
                setMobile(false);
                window.location.hash = "#/app";
              }}
              className="font-bold text-lime"
            >
              Mi panel →
            </a>
          )}
        </nav>
        <div className="lp-header-actions">
          {user ? (
            <a
              className="lp-button lime compact"
              href="#/app"
              onClick={(e) => {
                e.preventDefault();
                window.location.hash = "#/app";
              }}
            >
              Mi panel <ArrowRight size={15} />
            </a>
          ) : (
            <>
              <a className="lp-login" href="#/login" onClick={goToLogin}>
                Ingresar
              </a>
              <a
                className="lp-button lime compact"
                href="#/registro"
                onClick={goToRegister()}
              >
                Probar gratis <ArrowUpRight size={15} />
              </a>
            </>
          )}
          <button
            className="lp-menu"
            aria-controls="landing-navigation"
            aria-expanded={mobile}
            aria-label={mobile ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setMobile(!mobile)}
          >
            {mobile ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      {/* MAIN */}
      <main id="landing-main">
        {/* HERO SECTION */}
        <section className="lp-hero">
          <div className="lp-hero-glow" />
          <div className="lp-hero-copy">
            <a href="#como-funciona" className="lp-eyebrow">
              <span className="lp-tiny-icon">
                <CalendarDays size={13} />
              </span>{" "}
              MENOS IDAS Y VUELTAS. MÁS CUPITO. <ChevronRight size={13} />
            </a>
            <h1>
              Menos mensajes.
              <br />
              <span>Más turnos.</span>
            </h1>
            <p>
              Tu página de reservas, agenda y clientes en un solo lugar. Compartí un enlace, dejá que elijan su horario y recuperá tiempo todos los días.
            </p>
            <div className="lp-hero-buttons">
              <a
                className="lp-button lime"
                href="#/registro"
                onClick={goToRegister()}
              >
                Crear mi página gratis <ArrowUpRight size={19} />
              </a>
              <a
                className="lp-button ghost"
                href="#/reservar/studio-nails"
                onClick={goToDemo}
              >
                <Play size={14} fill="currentColor" />
                Ver demo en vivo
              </a>
            </div>
            <div className="lp-under-cta flex flex-wrap items-center justify-center gap-4 text-xs">
              <span className="inline-flex items-center gap-1.5 text-[#1D1D1F] font-medium">
                <Check size={14} className="stroke-[2.5] text-[#15803D]" /> Sin tarjeta de crédito
              </span>
              <span className="inline-flex items-center gap-1.5 text-[#1D1D1F] font-medium">
                <Check size={14} className="stroke-[2.5] text-[#15803D]" /> Configuración en 2 minutos
              </span>
              <span className="inline-flex items-center gap-1.5 text-[#1D1D1F] font-medium">
                <Check size={14} className="stroke-[2.5] text-[#15803D]" /> Plan gratuito para siempre
              </span>
            </div>
            <div className="lp-hero-proof" aria-label="Ventajas de Cupito">
              <span><ShieldCheck size={15} /><strong>Sin app</strong><small>para tus clientes</small></span>
              <span><Clock size={15} /><strong>24/7</strong><small>reservas abiertas</small></span>
              <span><Palette size={15} /><strong>Tu marca</strong><small>en cada detalle</small></span>
            </div>
          </div>

          {/* VISTA PREVIA INTERACTIVA DE AGENDA */}
          <div
            className="lp-product-visual"
            aria-label="Demostración animada de la agenda de Cupito"
          >
            <div className="lp-orbit-label">
              <span />
              TU DÍA, DE UN VISTAZO
            </div>
            <div className="lp-demo-window">
              <div className="lp-demo-top">
                <div className="lp-window-dots">
                  <i />
                  <i />
                  <i />
                </div>
                <span>
                  <ShieldCheck size={11} /> Tu espacio en Cupito
                </span>
                <ArrowUpRight size={13} />
              </div>
              <div className="lp-demo-body">
                <aside className="lp-demo-sidebar">
                  <div className="lp-demo-brand">
                    <img src="/cupito-logo.webp" alt="" width="20" height="20" loading="lazy" decoding="async" />
                    cupito.
                  </div>
                  <div className="lp-demo-store">
                    <span>EB</span>
                    <div>
                      Estudio Bloom<small>Mi negocio</small>
                    </div>
                  </div>
                  {[
                    [ChartNoAxesCombined, "Resumen"],
                    [CalendarDays, "Agenda"],
                    [Users, "Clientes"],
                    [Scissors, "Servicios"],
                    [Globe, "Mi página"],
                  ].map(([Icon, label]: any, i) => (
                    <div
                      key={label}
                      className={"lp-demo-nav " + (!i ? "selected" : "")}
                    >
                      <Icon size={13} />
                      {label}
                    </div>
                  ))}
                  <div className="lp-demo-bottom">Hecho para tu día a día.</div>
                </aside>
                <div className="lp-demo-main">
                  <div className="lp-demo-heading">
                    <div>
                      <span>MIÉRCOLES, 16 DE SEPTIEMBRE</span>
                      <p className="lp-demo-heading-title font-display text-lg font-bold text-[#254c36] flex items-center gap-1">
                        ¡Buen día, Sofi! <Sun size={16} className="text-amber-500 inline" />
                      </p>
                      <p>Tu agenda se ocupa. Vos, de lo tuyo.</p>
                    </div>
                    <div className="lp-demo-avatar">SF</div>
                  </div>
                  <div className="lp-demo-stats">
                    <div>
                      <small>Turnos del día</small>
                      <strong key={tick}>
                        {18 + tick}
                        <span>+{3 + tick} hoy</span>
                      </strong>
                      <div className="lp-stat-dash" />
                    </div>
                    <div>
                      <small>Ocupación</small>
                      <strong>
                        {68 + tick}%<ChartNoAxesCombined size={23} />
                      </strong>
                      <div className="lp-demo-bars">
                        {[35, 53, 43, 68, 47, 80, 62, 90, 75, 100, 87, 75].map((n, i) => (
                          <i
                            key={i}
                            style={{ height: (n + ((tick + i) % 4) * 3) / 5 }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="lp-demo-agenda-title">
                    <b>Próximos turnos</b>
                    <span>
                      <i /> Agenda al día
                    </span>
                  </div>
                  <div className="lp-demo-days">
                    {["L 14", "M 15", "M 16", "J 17", "V 18", "S 19"].map((x, i) => (
                      <span className={i === 2 ? "active" : ""} key={i}>
                        {x.split(" ")[0]}
                        <b>{x.split(" ")[1]}</b>
                      </span>
                    ))}
                  </div>
                  <div className="lp-demo-rows" key={"rows" + tick}>
                    {[0, 1, 2].map((i) => (
                      <div className="lp-demo-row" key={i}>
                        <time>{14 + i}:00</time>
                        <span className={"lp-initials tone" + i}>
                          {names[(tick + i) % names.length]
                            .split(" ")
                            .map((x) => x[0])
                            .join("")}
                        </span>
                        <div>
                          <b>{names[(tick + i) % names.length]}</b>
                          <small>
                            {i === 0
                              ? services[industry]
                              : i === 1
                              ? "Servicio personalizado"
                              : "Primera visita"}
                          </small>
                        </div>
                        <span className="lp-status">
                          <Check size={9} />
                          Confirmado
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="lp-demo-footer">
                    <span>Tu agenda, sin mensajes pendientes.</span>
                    <CheckCheck size={14} />
                  </div>
                </div>
              </div>
              {/* Floating Preview Toast */}
              <div className="lp-floating-booking absolute right-4 bottom-4 overflow-hidden shadow-lg z-20" key={tick}>
                <span className="lp-float-icon">
                  <Check size={20} />
                </span>
                <div>
                  <strong>¡Entró una nueva reserva!</strong>
                  <p>
                    {names[tick % names.length].split(" ")[0]} · {services[industry]}
                  </p>
                </div>
                <span className="lp-float-now">Ahora</span>
              </div>
            </div>
            <div className="lp-floating-link">
              <Link size={15} />
              <span>Tu negocio. Tu propio link.</span>
              <ArrowUpRight size={14} />
            </div>
            <div className="lp-simulation">
              <span>Vista ilustrativa · datos simulados</span>
              <button
                type="button"
                onClick={() => setRunning(!running)}
                aria-label={running ? "Pausar demostración" : "Reanudar demostración"}
              >
                {running ? <Pause size={12} /> : <Play size={12} />}
              </button>
            </div>
          </div>
        </section>

        {/* 3 BENEFICIOS CUANTIFICABLES */}
        <section id="beneficios" className="lp-benefits-quantifiable lp-reveal">
          <div className="lp-benefits-heading">
            <span className="lp-kicker">VALOR REAL PARA TU DÍA A DÍA</span>
            <h2>Resultados concretos desde la primera semana</h2>
            <p>Pensado para profesionales y locales que quieren recuperar tiempo y ordenar su atención.</p>
          </div>
          <div className="lp-benefits-grid">
            <article className="lp-benefit-card">
              <div className="lp-benefit-icon">
                <Clock size={22} />
              </div>
              <span className="lp-benefit-metric">+15 hs</span>
              <span className="lp-benefit-kicker">Semanales recuperadas</span>
              <p className="lp-benefit-desc">
                Menos idas y vueltas por WhatsApp preguntando "¿a qué hora tenés?". Tu disponibilidad se actualiza en tiempo real y tus clientes reservan solos.
              </p>
            </article>

            <article className="lp-benefit-card">
              <div className="lp-benefit-icon">
                <Bell size={22} />
              </div>
              <span className="lp-benefit-metric">0</span>
              <span className="lp-benefit-kicker">Mensajes perdidos</span>
              <p className="lp-benefit-desc">
                Tus clientes eligen horario en cualquier momento, incluso mientras atendés o fuera del horario comercial, sin esperas ni chats sin responder.
              </p>
            </article>

            <article className="lp-benefit-card">
              <div className="lp-benefit-icon">
                <CheckCheck size={22} />
              </div>
              <span className="lp-benefit-metric">100%</span>
              <span className="lp-benefit-kicker">Turnos organizados</span>
              <p className="lp-benefit-desc">
                Recordatorios directos, cobro de seña opcional por transferencia y políticas de cancelación claras para que tu agenda respire sin ausencias.
              </p>
            </article>
          </div>
        </section>

        {/* CÓMO FUNCIONA */}
        <section id="como-funciona" className="lp-how lp-reveal">
          <span className="lp-kicker">ARRANCAR ES LA PARTE FÁCIL</span>
          <h2>
            Tres pasos.
            <br />
            Y el próximo turno ya puede llegar.
          </h2>
          <div className="lp-steps-grid">
            {[
              [
                "01",
                "Dale tu toque.",
                "Poné el nombre de tu negocio, tus servicios y los horarios en los que atendés.",
                Palette,
              ],
              [
                "02",
                "Compartí tu link.",
                "En tu Instagram, en WhatsApp o donde te encuentren tus clientes.",
                Link,
              ],
              [
                "03",
                "Dejá que reserven.",
                "Ellos eligen su momento. Vos lo ves en tu agenda y seguís con tu día.",
                CalendarDays,
              ],
            ].map(([n, title, desc, Icon]: any) => (
              <article key={n}>
                <div className="lp-step-top">
                  <span>{n}</span>
                  <Icon size={24} />
                </div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </article>
            ))}
          </div>
          <a className="lp-inline-link" href="#/reservar/studio-nails" onClick={goToDemo}>
            Probalo como si fueras tu cliente <ArrowRight size={16} />
          </a>
        </section>

        {/* PRECIOS */}
        <section id="precios" className="lp-pricing lp-reveal">
          <div className="lp-pricing-heading">
            <span className="lp-kicker">CRECÉ A TU RITMO</span>
            <h2>
              Empezá simple.
              <br />
              <span>Sumá más cuando lo necesites.</span>
            </h2>
            <p>Planes en pesos argentinos. Sin vueltas.</p>
          </div>
          <div className="lp-price-grid">
            {plans.map((p, i) => (
              <article
                className={"lp-price-card " + (i === 1 ? "recommended" : "")}
                key={p.key}
              >
                {i === 1 && <span className="lp-recommended">PARA EL DÍA A DÍA</span>}
                <div className="lp-plan-name">
                  {p.name}
                  <span>
                    {i === 0 ? <Globe size={20} /> : i === 1 ? <Store size={20} /> : <Users size={20} />}
                  </span>
                </div>
                <div className="lp-plan-profile">
                  <Users size={12} />
                  <span>{p.profile}</span>
                </div>
                <p>{p.intro}</p>
                <div className="lp-price">
                  $ {p.price}
                  <small>ARS / mes</small>
                </div>
                <a
                  className={"lp-button " + (i === 1 ? "lime" : "outlined")}
                  href={`#/registro?plan=${p.key}`}
                  onClick={goToRegister(p.key)}
                >
                  {p.cta}
                  <ArrowUpRight size={17} />
                </a>
                <div className="lp-price-rule" />
                {p.features.map((f) => (
                  <div className="lp-plan-feature" key={f}>
                    <Check size={15} />
                    {f}
                  </div>
                ))}
              </article>
            ))}
          </div>
          <p className="lp-pricing-note">
            Precios en pesos argentinos. Podés cambiar de plan o cancelar en cualquier momento desde
            tu panel.
          </p>
        </section>

        {/* PERSONALIZADOR INTERACTIVO */}
        <section className="lp-reveal" id="tu-marca">
          {/* SELECTOR DE INDUSTRIAS */}
          <section className="lp-industries">
            <p>
              SI TU NEGOCIO TIENE TURNOS,
              <br />
              <b>TIENE LUGAR EN CUPITO.</b>
            </p>
            <div>
              {sectors.map(([name, Icon], i) => (
                <button
                  type="button"
                  className={industry === i ? "active" : ""}
                  key={name}
                  aria-pressed={industry === i}
                  onClick={() => setIndustry(i)}
                >
                  <Icon size={19} />
                  {name}
                </button>
              ))}
            </div>
          </section>

          {/* TOUR INTERACTIVO DE MARCA */}
          <LandingTour />
        </section>

        {/* MERCADO PAGO / CONFIANZA */}
        <section className="lp-trust lp-reveal">
          <span>
            <ShieldCheck size={25} />
            <b>Tu suscripción, por Mercado Pago.</b>
          </span>
          <p>
            Pagás tu plan de Cupito con Mercado Pago. Las señas de tus clientes se transfieren directamente a la cuenta de tu negocio.
            <br />
            Cupito no recibe ni guarda los datos de las tarjetas.
          </p>
          <a href="mailto:hola@cupito.app">
            ¿Tenés una pregunta? Hablemos <ArrowUpRight size={14} />
          </a>
        </section>

        {/* FAQ ACCORDION */}
        <section className="lp-faq lp-reveal">
          <div>
            <span className="lp-kicker">SIN DUDAS, MEJOR.</span>
            <h2>
              Lo que quizás
              <br />
              te estás preguntando.
            </h2>
            <p>
              Y si falta algo, escribinos.
              <br />
              Del otro lado hay una persona.
            </p>
          </div>
          <Accordion type="single" collapsible className="lp-accordion">
            {[
              [
                "¿Necesito saber de tecnología?",
                "No. Elegís el nombre del negocio, cargás tus servicios y horarios, y compartís tu enlace. Todo se configura desde el panel en pocos toques, sin escribir código.",
              ],
              [
                "¿Mis clientes tienen que descargar una app?",
                "No, para nada. Tus clientes reservan directamente desde cualquier navegador (Chrome, Safari, etc.) entrando a tu link personalizado (ej. cupito.app/tu-negocio).",
              ],
              [
                "¿Puedo usar Cupito desde el celular?",
                "Sí, está 100% optimizado para celulares tanto para vos como para tus clientes. Incluso podés instalarlo como app en tu pantalla de inicio en 1 toque.",
              ],
              [
                "¿El plan gratis tiene vencimiento?",
                "El plan Gratis (Semilla) está pensado para empezar sin pagar, con hasta 25 reservas activas por mes. No se te pide tarjeta de crédito para crear tu cuenta.",
              ],
              [
                "¿Puedo cobrar una seña o vender productos?",
                "Sí. Con Crece y Escala podés pedir señas por transferencia y ofrecer productos al reservar. El local verifica la transferencia. Mercado Pago se usa para pagar tu suscripción a Cupito.",
              ],
            ].map(([q, a], i) => (
              <AccordionItem value={String(i)} key={q}>
                <AccordionTrigger>{q}</AccordionTrigger>
                <AccordionContent>{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* FINAL CALL TO ACTION */}
        <section className="lp-final lp-reveal">
          <div className="lp-final-glow" />
          <span className="lp-kicker">HACÉ LUGAR PARA LO QUE IMPORTA</span>
          <h2>
            Vos hacé lo tuyo.
            <br />
            <span>Cupito organiza los turnos.</span>
          </h2>
          <p>Tu próximo cliente puede estar buscando un horario ahora.</p>
          <a
            className="lp-button lime"
            href="#/registro"
            onClick={goToRegister()}
          >
            Dale lugar a tu negocio <ArrowUpRight size={20} />
          </a>
          <span className="lp-final-note">Gratis para empezar. Sin tarjeta. Sin complicarte.</span>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="lp-footer-top">
          <div>
            <a className="lp-logo" href="#/" aria-label="Cupito, inicio">
              <picture>
                <source srcSet="/cupito-logo.webp" type="image/webp" />
                <img src="/cupito-logo.png" alt="Cupito Logo" width="36" height="36" loading="lazy" decoding="async" />
              </picture>
              cupito<span className="lp-logo-dot">.</span>
            </a>
            <p>Más tiempo para lo que hacés bien.</p>
          </div>
          <div className="lp-footer-links">
            <a href="#beneficios">Beneficios</a>
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#precios">Precios</a>
            <a href="#tu-marca">Tu marca</a>
            {user ? (
              <a
                href="#/app"
                onClick={(e) => {
                  e.preventDefault();
                  window.location.hash = "#/app";
                }}
              >
                Mi panel
              </a>
            ) : (
              <a href="#/login" onClick={goToLogin}>
                Ingresar
              </a>
            )}
            <button
              type="button"
              onClick={() => setLegalDoc(TERMS_DOC)}
              className="text-left cursor-pointer hover:underline"
            >
              Términos del Servicio
            </button>
            <button
              type="button"
              onClick={() => setLegalDoc(PRIVACY_DOC)}
              className="text-left cursor-pointer hover:underline"
            >
              Privacidad
            </button>
          </div>
          <div className="lp-footer-contact">
            <a href="mailto:hola@cupito.app">
              <Mail size={16} />
              hola@cupito.app
            </a>
            <a
              href="https://www.instagram.com/cupitoapp/"
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram de Cupito @cupitoapp"
            >
              <Instagram size={16} />
              @cupitoapp <ArrowUpRight size={13} />
            </a>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <span>&copy; {new Date().getFullYear()} Cupito.app</span>
          <span className="inline-flex items-center gap-1">
            Hecho con ganas, en Argentina. <ArrowUpRight size={13} />
          </span>
        </div>
      </footer>

      {/* MODAL DE TÉRMINOS / PRIVACIDAD */}
      {legalDoc && <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />}
    </div>
  );
}
