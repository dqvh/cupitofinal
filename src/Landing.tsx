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
} from "lucide-react";
import LandingTour from "./components/LandingTour";
import { useStore } from "./lib/store";
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

const names = [
  "Lucía Fernández",
  "Tomás Ramírez",
  "Camila López",
  "Nicolás Pérez",
  "Martina Gómez",
  "Sofía Martínez",
];

const plans = [
  {
    name: "Gratis",
    price: "0",
    intro: "Para dar el primer paso.",
    cta: "Empezar gratis",
    key: "semilla",
    features: [
      "Hasta 30 turnos por mes",
      "Tu página de reservas",
      "1 local y 1 profesional",
      "Agenda y clientes en un lugar",
      "Personalización básica",
    ],
  },
  {
    name: "Crecer",
    price: "9.990",
    intro: "Para hacer de esto tu día a día.",
    cta: "Quiero Crecer",
    key: "crece",
    features: [
      "Hasta 500 turnos por mes",
      "Tu logo, colores y textos",
      "Tienda de productos integrada",
      "Señas por transferencia",
      "Estadísticas de tu negocio",
      "Hasta 3 profesionales",
    ],
  },
  {
    name: "Expandir",
    price: "19.990",
    intro: "Para un negocio que va por más.",
    cta: "Conocer Expandir",
    key: "escala",
    features: [
      "Hasta 2.000 turnos por mes",
      "Todo lo del plan Crecer",
      "Hasta 5 sucursales",
      "Hasta 15 profesionales por local",
      "Estadísticas por sucursal",
      "Canal de soporte prioritario",
    ],
  },
];

export default function Landing() {
  const { user } = useStore();
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
    window.location.hash = "#/felipeprueba";
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
          <img src="/cupito-logo.png" width="39" height="39" alt="Cupito Logo" />
          <span>
            cupito<span className="lp-logo-dot">.</span>
          </span>
        </a>
        <nav
          id="landing-navigation"
          className={mobile ? "lp-nav open" : "lp-nav"}
          aria-label="Navegación principal"
        >
          <a href="#producto" onClick={() => setMobile(false)}>
            Producto
          </a>
          <a href="#tu-marca" onClick={() => setMobile(false)}>
            Tu marca
          </a>
          <a href="#como-funciona" onClick={() => setMobile(false)}>
            Cómo funciona
          </a>
          <a href="#precios" onClick={() => setMobile(false)}>
            Precios
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
              Tu negocio, en orden.
              <br />
              <span>Tu tiempo, de vuelta.</span>
            </h1>
            <p>
              Tus clientes reservan. Tu agenda se organiza. Y vos volvés a enfocarte en lo que más
              te gusta de tu negocio.
            </p>
            <div className="lp-hero-buttons">
              <a
                className="lp-button lime"
                href="#/registro"
                onClick={goToRegister()}
              >
                Empezá gratis <ArrowUpRight size={19} />
              </a>
              <a
                className="lp-button ghost"
                href="#/felipeprueba"
                onClick={goToDemo}
              >
                <Play size={14} fill="currentColor" />
                Explorá la demo
              </a>
            </div>
            <div className="lp-under-cta">
              <span>
                <Check size={13} /> Sin tarjeta
              </span>
              <span>
                <Check size={13} /> A tu ritmo
              </span>
              <span>
                <Check size={13} /> Hecho en Argentina
              </span>
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
                    <img src="/cupito-logo.png" alt="" />
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
                      <h3>
                        ¡Buen día, Sofi! <span>☀</span>
                      </h3>
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
            </div>
            <div className="lp-floating-booking" key={tick}>
              <span className="lp-float-icon">
                <Check size={22} />
              </span>
              <div>
                <strong>¡Entró una nueva reserva!</strong>
                <p>
                  {names[tick % names.length].split(" ")[0]} · {services[industry]}
                </p>
              </div>
              <span className="lp-float-now">Ahora</span>
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

        {/* BENTO FEATURES */}
        <section id="producto" className="lp-features lp-reveal">
          <div className="lp-section-heading">
            <div>
              <span className="lp-kicker">TODO CONECTADO. TODO MÁS SIMPLE.</span>
              <h2>
                Una herramienta menos.
                <br />
                <span>Un montón de cosas resueltas.</span>
              </h2>
            </div>
            <p>
              Desde el primer turno hasta el cierre del día.
              <br />
              Cupito acompaña la forma en que trabajás.
            </p>
          </div>
          <div className="lp-feature-grid">
            <article className="lp-feature-card feature-wide">
              <span className="lp-feature-icon">
                <CalendarDays />
              </span>
              <h3>Tu agenda respira.</h3>
              <p>
                Disponibilidad actualizada para todos. Cuando entra un turno, ese espacio deja de
                estar libre.
              </p>
              <div className="lp-feature-schedule">
                <div>
                  <span>09:00</span>
                  <b>
                    <i /> Lucía · Corte
                  </b>
                  <Check size={13} />
                </div>
                <div>
                  <span>10:00</span>
                  <em>Este espacio puede ser tuyo</em>
                  <Plus size={13} />
                </div>
                <div>
                  <span>11:00</span>
                  <b>
                    <i /> Tomás · Perfilado
                  </b>
                  <Check size={13} />
                </div>
              </div>
            </article>
            <article className="lp-feature-card">
              <span className="lp-feature-icon">
                <Palette />
              </span>
              <h3>Se ve como vos.</h3>
              <p>
                Tu logo, tus colores y tu forma de contar lo que hacés. Una página que se siente
                tuya.
              </p>
              <div className="lp-color-preview">
                <i />
                <i />
                <i />
                <span>
                  Tu marca acá <MousePointer2 size={19} />
                </span>
              </div>
            </article>
            <article className="lp-feature-card">
              <span className="lp-feature-icon">
                <Store />
              </span>
              <h3>Un turno. Algo más.</h3>
              <p>
                Sumá tus productos a la reserva. El cliente elige y los retira cuando te visita.
              </p>
              <span className="lp-feature-tag">EN PLANES PAGOS</span>
            </article>
            <article className="lp-feature-card">
              <span className="lp-feature-icon">
                <Wallet />
              </span>
              <h3>Cobrá a tu manera.</h3>
              <p>
                Señas por transferencia y productos con Mercado Pago al conectar la cuenta de tu
                negocio.
              </p>
              <span className="lp-feature-tag">CONEXIÓN CON MERCADO PAGO</span>
            </article>
            <article className="lp-feature-card">
              <span className="lp-feature-icon">
                <ChartNoAxesCombined />
              </span>
              <h3>Números que se entienden.</h3>
              <p>
                Qué servicios eligen más, cómo viene la semana y cuánto generás. Sin planillas
                complicadas.
              </p>
              <div className="lp-feature-chart">
                {[26, 40, 33, 54, 46, 72, 89].map((n, i) => (
                  <i key={i} style={{ height: n / 2 }} />
                ))}
              </div>
            </article>
            <article className="lp-feature-card">
              <span className="lp-feature-icon">
                <Bell />
              </span>
              <h3>Que no se les pase.</h3>
              <p>
                Recordatorios y avisos inteligentes por WhatsApp para reducir ausencias y clientes que
                se olvidan.
              </p>
              <span className="lp-feature-tag upcoming">INCLUIDO EN TU PLAN</span>
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
          <a className="lp-inline-link" href="#/felipeprueba" onClick={goToDemo}>
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

        {/* MERCADO PAGO / CONFIANZA */}
        <section className="lp-trust lp-reveal">
          <span>
            <ShieldCheck size={25} />
            <b>Tus cobros, por Mercado Pago.</b>
          </span>
          <p>
            Al conectar tu cuenta, el pago de productos y señas se gestiona de forma segura con
            Mercado Pago.
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
                "El plan Gratis (Semilla) está pensado para empezar sin pagar, con hasta 30 turnos al mes. No se te pide tarjeta de crédito para crear tu cuenta.",
              ],
              [
                "¿Puedo cobrar una seña o vender productos?",
                "Sí. Los planes Crece y Escala permiten solicitar señas por transferencia bancaria (con alias/CBU) o cobrar con Mercado Pago de forma automática.",
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
            <a className="lp-logo" href="#/">
              <img src="/cupito-logo.png" alt="Cupito Logo" width="36" height="36" />
              cupito<span className="lp-logo-dot">.</span>
            </a>
            <p>Más tiempo para lo que hacés bien.</p>
          </div>
          <div className="lp-footer-links">
            <a href="#producto">Producto</a>
            <a href="#precios">Precios</a>
            <a href="#como-funciona">Cómo funciona</a>
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
            >
              <Instagram size={16} />
              @cupitoapp <ArrowUpRight size={13} />
            </a>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <span>© {new Date().getFullYear()} Cupito.app</span>
          <span>
            Hecho con ganas, en Argentina. <span>↗</span>
          </span>
        </div>
      </footer>

      {/* MODAL DE TÉRMINOS / PRIVACIDAD */}
      {legalDoc && <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />}
    </div>
  );
}
