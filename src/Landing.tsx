import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CalendarDays,
  Clock,
  Bell,
  Wallet,
  Palette,
  Users,
  Hourglass,
  Smartphone,
  Link2,
  Sparkles,
  ShieldCheck,
  Menu,
  X,
  Play,
  Mail,
  Camera as Instagram,
  MessageCircle,
  Plus,
  Search,
} from "lucide-react";
import { PLAN_META, PLAN_AMOUNTS, PLAN_FEATURES, type Plan, type BillingCycle } from "./lib/plans";
import { LegalModal, TERMS_DOC, PRIVACY_DOC } from "./components/kit";
import "./styles/landing.css";

const ROTATING = ["peluquerías", "barberías", "consultorios", "centros de estética", "canchas de pádel", "estudios de tatuaje"];

const SECTORS = [
  "Peluquerías", "Barberías", "Uñas y pestañas", "Centros de estética", "Consultorios", "Psicología", "Kinesiología",
  "Nutrición", "Entrenadores", "Yoga y pilates", "Canchas de pádel", "Estudios de tatuaje", "Veterinarias", "Clases particulares",
];

const PLAN_PROFILE: Record<Plan, string> = {
  semilla: "Para empezar solo/a",
  crece: "Para el día a día de un local",
  escala: "Para equipos y reportes",
};

const SWATCHES = ["#146c48", "#0369a1", "#6d28d9", "#be185d", "#c2410c", "#1f2937"];

const FAQ: [string, string][] = [
  ["¿Mis clientes tienen que descargar una app?", "No. Entran a tu link (cupito.app/tu-negocio) desde cualquier celular o compu, eligen servicio y horario, y listo. Sin cuentas ni contraseñas."],
  ["¿Necesito saber de tecnología?", "No. Cargás tus servicios y horarios en unos minutos y compartís el link. Todo se maneja desde el panel, también desde el celular."],
  ["¿Cómo se evitan los turnos superpuestos?", "Cupito calcula los horarios libres con la duración real de cada servicio, la pausa entre turnos, los bloqueos y el horario de cada profesional. Nadie puede reservar un hueco que no existe."],
  ["¿Puedo cobrar seña?", "Sí, en los planes Crece y Escala. El cliente transfiere a tu cuenta y vos confirmás la seña desde el panel. Cupito nunca toca ese dinero."],
  ["¿Qué pasa si un cliente quiere cancelar o cambiar el turno?", "Lo hace solo desde “Mis turnos” hasta 24 h antes y el horario se libera al instante. Dentro de las 24 h te tiene que escribir a vos."],
  ["¿El plan gratis vence?", "No. Semilla es gratis para siempre, con hasta 25 reservas por mes y sin tarjeta. Cuando necesites más, cambiás de plan desde el panel."],
];

function go(hash: string) {
  return (e: MouseEvent) => {
    e.preventDefault();
    window.location.hash = hash;
  };
}

/* ---------- escena del hero: el cliente reserva → aparece en tu agenda ---------- */

function HeroScene() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia("(pointer: fine)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - (r.left + r.width / 2)) / r.width;
        const y = (e.clientY - (r.top + r.height / 2)) / r.height;
        // Paralaje 2D en píxeles enteros: sin 3D, el texto se mantiene nítido.
        el.style.setProperty("--px", `${Math.round(x * 18)}px`);
        el.style.setProperty("--py", `${Math.round(y * 12)}px`);
        el.style.setProperty("--ax", `${Math.round(-x * 8)}px`);
        el.style.setProperty("--ay", `${Math.round(-y * 6)}px`);
      });
    };
    const reset = () => { for (const k of ["--px", "--py", "--ax", "--ay"]) el.style.setProperty(k, "0px"); };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", reset);
    return () => { window.removeEventListener("pointermove", onMove); document.removeEventListener("pointerleave", reset); cancelAnimationFrame(raf); };
  }, []);

  return (
    <div className="lp-scene" ref={ref} aria-label="Animación: un cliente reserva desde el celular y el turno aparece en la agenda del negocio" role="img">
      <div className="lp-scene-tilt">
        {/* agenda del negocio */}
        <div className="lp-agenda">
          <div className="lp-agenda-top">
            <span className="lp-dots"><i /><i /><i /></span>
            <span className="lp-agenda-title">Agenda · jueves 24</span>
            <span className="lp-agenda-chip">Hoy</span>
          </div>
          <div className="lp-agenda-cols">
            <span><i style={{ background: "#0ea5e9" }} />Lucas</span>
            <span><i style={{ background: "#f59e0b" }} />Sofi</span>
          </div>
          <div className="lp-agenda-grid">
            {["14:00", "15:00", "16:00", "17:00", "18:00"].map((h, i) => (
              <div key={h} className="lp-agenda-hour" style={{ top: i * 56 }}><span>{h}</span></div>
            ))}
            <div className="lp-ev" style={{ top: 6, height: 44, left: "14%", ["--c" as string]: "#0ea5e9" } as CSSProperties}><b>Martín G.</b><small>Corte · 14:00</small></div>
            <div className="lp-ev" style={{ top: 34, height: 70, left: "57%", ["--c" as string]: "#f59e0b" } as CSSProperties}><b>Camila R.</b><small>Color · 14:30</small></div>
            <div className="lp-ev" style={{ top: 118, height: 44, left: "14%", ["--c" as string]: "#0ea5e9" } as CSSProperties}><b>Nico P.</b><small>Barba · 16:00</small></div>
            <div className="lp-ev lp-ev-new" style={{ top: 146, height: 50, left: "57%", ["--c" as string]: "#146c48" } as CSSProperties}><b>Lucía F.</b><small>Corte + brushing · 16:30</small></div>
            <div className="lp-ev" style={{ top: 230, height: 44, left: "14%", ["--c" as string]: "#0ea5e9" } as CSSProperties}><b>Tomás R.</b><small>Corte · 18:00</small></div>
            <div className="lp-now" style={{ top: 96 }} />
          </div>
        </div>

        {/* celular del cliente */}
        <div className="lp-phone">
          <div className="lp-phone-notch" />
          <div className="lp-phone-screen">
            <div className="lp-ph-head">
              <span className="lp-ph-logo">EB</span>
              <div><b>Estudio Bloom</b><small>Palermo · abierto hoy</small></div>
            </div>
            <div className="lp-ph-service"><span>Corte + brushing</span><small>45 min · $18.000</small></div>
            <div className="lp-ph-days">
              {[["jue", "24"], ["vie", "25"], ["sáb", "26"], ["lun", "28"]].map(([d, n], i) => (
                <span key={n} className={i === 0 ? "on" : ""}><small>{d}</small>{n}</span>
              ))}
            </div>
            <div className="lp-ph-slots">
              {["11:00", "12:30", "15:00", "16:30", "17:00", "18:30"].map((t) => (
                <span key={t} className={t === "16:30" ? "lp-ph-target" : ""}>{t}</span>
              ))}
              <i className="lp-tap" />
            </div>
            <div className="lp-ph-cta">Confirmar turno</div>
            <div className="lp-ph-foot"><ShieldCheck size={12} /> Recordatorio 24 h antes</div>
            <div className="lp-ph-done">
              <span className="lp-ph-check"><Check size={22} strokeWidth={3} /></span>
              <b>¡Listo, Lucía!</b>
              <small>Jueves 24 · 16:30 hs</small>
            </div>
          </div>
        </div>

        {/* aviso en tiempo real */}
        <div className="lp-toast">
          <span className="lp-toast-dot"><Bell size={14} /></span>
          <div><b>Nueva reserva</b><small>Lucía F. · hoy 16:30</small></div>
          <span className="lp-toast-time">ahora</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- bloques del bento con micro‑animaciones ---------- */

function MiniCalendar() {
  return (
    <div className="lp-mini-cal" aria-hidden="true">
      {[0, 1, 2].map((c) => (
        <div key={c} className="lp-mini-col">
          {[0, 1, 2, 3, 4, 5].map((r) => <i key={r} />)}
        </div>
      ))}
      <span className="lp-mb" style={{ ["--c" as string]: "#0ea5e9", left: "3%", top: "6%", height: "26%" } as CSSProperties}>Martín · 10:00</span>
      <span className="lp-mb" style={{ ["--c" as string]: "#f59e0b", left: "36%", top: "22%", height: "34%" } as CSSProperties}>Camila · 11:00</span>
      <span className="lp-mb" style={{ ["--c" as string]: "#8b5cf6", left: "69%", top: "10%", height: "22%" } as CSSProperties}>Nico · 10:30</span>
      <span className="lp-mb lp-mb-drag" style={{ ["--c" as string]: "#146c48", left: "3%", top: "60%", height: "24%" } as CSSProperties}>Lucía · 14:00</span>
      <span className="lp-cursor" />
    </div>
  );
}

function ReminderStack() {
  return (
    <div className="lp-rem" aria-hidden="true">
      {[
        ["Recordatorio enviado", "Martín · mañana 10:00"],
        ["Confirmó asistencia", "Camila · mañana 11:30"],
        ["Recordatorio enviado", "Sofía · mañana 16:00"],
      ].map(([a, b], i) => (
        <div key={i} className="lp-rem-item" style={{ ["--i" as string]: i } as CSSProperties}>
          <span><MessageCircle size={13} /></span>
          <div><b>{a}</b><small>{b}</small></div>
        </div>
      ))}
    </div>
  );
}

function ColorCycle() {
  return (
    <div className="lp-cc" aria-hidden="true">
      <div className="lp-cc-card">
        <b>Tu negocio</b>
        <div className="lp-cc-slots"><i /><i className="on" /><i /></div>
        <span className="lp-cc-btn">Reservar</span>
      </div>
      <div className="lp-cc-sw">{SWATCHES.slice(0, 5).map((c) => <i key={c} style={{ background: c }} />)}</div>
    </div>
  );
}

/* ---------- personalizador ---------- */

function Customizer() {
  const [name, setName] = useState("Estudio Bloom");
  const [color, setColor] = useState(SWATCHES[0]);
  const [slot, setSlot] = useState("16:30");
  const slug = (name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tu-negocio").slice(0, 28);
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "TN";
  return (
    <div className="lp-custom">
      <div className="lp-custom-controls">
        <label className="lp-field">
          <span>Nombre de tu negocio</span>
          <input value={name} maxLength={32} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="lp-field">
          <span>Color de tu marca</span>
          <div className="lp-swatches" role="group" aria-label="Color de tu marca">
            {SWATCHES.map((c) => (
              <button key={c} type="button" aria-label={`Color ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} style={{ ["--sw" as string]: c } as CSSProperties} />
            ))}
          </div>
        </div>
        <div className="lp-url"><Link2 size={15} />cupito.app/<b>{slug}</b></div>
        <a className="lp-btn lp-btn-primary" href="#/registro" onClick={go("#/registro")}>
          Crear esta página gratis <ArrowRight size={17} />
        </a>
      </div>
      <div className="lp-custom-preview" style={{ ["--brand" as string]: color } as CSSProperties}>
        <div className="lp-phone lp-phone-static">
          <div className="lp-phone-notch" />
          <div className="lp-phone-screen">
            <div className="lp-ph-head">
              <span className="lp-ph-logo" style={{ background: color }}>{initials}</span>
              <div><b>{name || "Tu negocio"}</b><small>Reservá tu turno online</small></div>
            </div>
            <div className="lp-ph-service lp-ph-service-sel"><span>Corte + brushing</span><small>45 min · $18.000</small></div>
            <div className="lp-ph-days">
              {[["jue", "24"], ["vie", "25"], ["sáb", "26"], ["lun", "28"]].map(([d, n], i) => (
                <span key={n} className={i === 1 ? "on" : ""}><small>{d}</small>{n}</span>
              ))}
            </div>
            <div className="lp-ph-slots">
              {["11:00", "12:30", "15:00", "16:30", "17:00", "18:30"].map((t) => (
                <button type="button" key={t} className={t === slot ? "sel" : ""} onClick={() => setSlot(t)}>{t}</button>
              ))}
            </div>
            <div className="lp-ph-cta lp-ph-cta-live">Confirmar {slot} hs</div>
            <div className="lp-ph-foot"><ShieldCheck size={12} /> Recordatorio 24 h antes</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- landing ---------- */

export default function Landing() {
  const [user, setUser] = useState(false);
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [billing, setBilling] = useState<BillingCycle>("mensual");
  const [legal, setLegal] = useState<{ title: string; body: string[] } | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = () => { try { setUser(!!localStorage.getItem("cupito_session")); } catch { /* sin almacenamiento */ } };
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  // header con fondo al scrollear + barra de progreso
  useEffect(() => {
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setScrolled(window.scrollY > 8);
        const max = document.documentElement.scrollHeight - innerHeight;
        root.current?.style.setProperty("--progress", String(max > 0 ? window.scrollY / max : 0));
      });
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => { window.removeEventListener("scroll", on); cancelAnimationFrame(raf); };
  }, []);

  // revelado al scrollear (sin JS todo queda visible)
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const items = Array.from(el.querySelectorAll<HTMLElement>(".lp-rv"));
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      items.forEach((i) => i.classList.add("is-in"));
      return;
    }
    items.forEach((i) => { if (i.getBoundingClientRect().top < innerHeight * 0.92) i.classList.add("is-in"); });
    el.classList.add("lp-js");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } }),
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );
    items.forEach((i) => !i.classList.contains("is-in") && io.observe(i));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!menu) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [menu]);

  const price = (p: Plan) => (p === "semilla" ? "0" : PLAN_AMOUNTS[p][billing].toLocaleString("es-AR"));

  return (
    <div className={`lp ${menu ? "lp-menu-open" : ""}`} ref={root}>
      <div className="lp-progress" aria-hidden="true" />
      <a className="lp-skip" href="#contenido">Saltar al contenido</a>

      <header className={`lp-header ${scrolled ? "is-scrolled" : ""}`}>
        <div className="lp-header-inner">
          <a className="lp-logo" href="#/" aria-label="Cupito, inicio">
            <picture>
              <source srcSet="/cupito-logo.webp" type="image/webp" />
              <img src="/cupito-logo.png" width="30" height="30" alt="" decoding="async" />
            </picture>
            <b>cupito<i>.</i></b>
          </a>
          <nav id="lp-nav" className="lp-nav" aria-label="Navegación principal">
            <a href="#producto" onClick={() => setMenu(false)}>Producto</a>
            <a href="#tu-pagina" onClick={() => setMenu(false)}>Tu página</a>
            <a href="#precios" onClick={() => setMenu(false)}>Precios</a>
            <a href="#faq" onClick={() => setMenu(false)}>Preguntas</a>
            <div className="lp-nav-mobile-cta">
              {user ? (
                <a className="lp-btn lp-btn-primary" href="#/app" onClick={go("#/app")}>Ir a mi panel <ArrowRight size={16} /></a>
              ) : (
                <>
                  <a className="lp-btn lp-btn-primary" href="#/registro" onClick={go("#/registro")}>Probar gratis <ArrowRight size={16} /></a>
                  <a className="lp-btn lp-btn-ghost" href="#/login" onClick={go("#/login")}>Ingresar</a>
                </>
              )}
            </div>
          </nav>
          <div className="lp-header-actions">
            {user ? (
              <a className="lp-btn lp-btn-primary lp-btn-sm" href="#/app" onClick={go("#/app")}>Mi panel <ArrowRight size={15} /></a>
            ) : (
              <>
                <a className="lp-login" href="#/login" onClick={go("#/login")}>Ingresar</a>
                <a className="lp-btn lp-btn-primary lp-btn-sm" href="#/registro" onClick={go("#/registro")}>Probar gratis <ArrowRight size={15} /></a>
              </>
            )}
            <button type="button" className="lp-burger" aria-controls="lp-nav" aria-expanded={menu} aria-label={menu ? "Cerrar menú" : "Abrir menú"} onClick={() => setMenu(!menu)}>
              {menu ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      <main id="contenido">
        {/* ============ HERO ============ */}
        <section className="lp-hero">
          <div className="lp-hero-bg" aria-hidden="true"><i className="lp-orb lp-orb-a" /><i className="lp-orb lp-orb-b" /><i className="lp-grid" /></div>
          <div className="lp-hero-copy">
            <a className="lp-pill" href="#producto">
              <span className="lp-pill-new">Nuevo</span> Agenda con arrastrar y soltar <ArrowRight size={13} />
            </a>
            <h1 className="lp-h1">
              <span className="lp-line"><span>Tu agenda</span></span>
              <span className="lp-line"><span className="lp-accent">se llena sola.</span></span>
            </h1>
            <p className="lp-lead">
              Página de reservas con tu nombre, agenda clara y recordatorios que bajan las ausencias. Hecho para{" "}
              <span className="lp-rotator" aria-label="negocios con turnos">
                <span className="lp-rotator-track" aria-hidden="true">
                  {[...ROTATING, ROTATING[0]].map((w, i) => <span key={i}>{w}</span>)}
                </span>
              </span>
            </p>
            <div className="lp-cta-row">
              <a className="lp-btn lp-btn-primary lp-btn-lg" href="#/registro" onClick={go("#/registro")}>
                Crear mi página gratis <ArrowRight size={18} />
              </a>
              <a className="lp-btn lp-btn-ghost lp-btn-lg" href="#/reservar/studio-nails" onClick={go("#/reservar/studio-nails")}>
                <span className="lp-play"><Play size={11} fill="currentColor" /></span> Ver demo en vivo
              </a>
            </div>
            <ul className="lp-checks">
              <li><Check size={15} /> Gratis hasta 25 reservas por mes</li>
              <li><Check size={15} /> Sin tarjeta</li>
              <li><Check size={15} /> Listo en 5 minutos</li>
            </ul>
          </div>
          <HeroScene />
        </section>

        {/* ============ SECTORES ============ */}
        <section className="lp-marquee" aria-label="Rubros que usan Cupito">
          <p>Para cualquier negocio que trabaja con turnos</p>
          <div className="lp-marquee-mask">
            <div className="lp-marquee-track">
              {[...SECTORS, ...SECTORS].map((s, i) => <span key={i} aria-hidden={i >= SECTORS.length}>{s}</span>)}
            </div>
          </div>
        </section>


        {/* ============ BENTO ============ */}
        <section className="lp-section" id="producto">
          <div className="lp-head lp-rv">
            <span className="lp-kicker">Producto</span>
            <h2 className="lp-h2">Todo lo que necesita un negocio con turnos.<br /><span>Nada que sobre.</span></h2>
          </div>
          <div className="lp-bento">
            <article className="lp-tile lp-tile-xl lp-rv">
              <div className="lp-tile-copy">
                <span className="lp-tile-icon"><CalendarDays size={18} /></span>
                <h3>Una agenda que se entiende en segundos</h3>
                <p>Columnas por profesional, huecos libres a la vista y turnos que se mueven arrastrando.</p>
              </div>
              <MiniCalendar />
            </article>
            <article className="lp-tile lp-rv" style={{ ["--d" as string]: "80ms" } as CSSProperties}>
              <span className="lp-tile-icon"><Bell size={18} /></span>
              <h3>Recordatorios que bajan las ausencias</h3>
              <p>Email automático 24 h antes y WhatsApp listo para enviar.</p>
              <ReminderStack />
            </article>
            <article className="lp-tile lp-rv" style={{ ["--d" as string]: "160ms" } as CSSProperties}>
              <span className="lp-tile-icon"><Palette size={18} /></span>
              <h3>Tu página, tu marca</h3>
              <p>Tu nombre, tu color y tu link para Instagram y WhatsApp.</p>
              <ColorCycle />
            </article>
            <article className="lp-tile lp-rv">
              <span className="lp-tile-icon"><Wallet size={18} /></span>
              <h3>Seña por transferencia</h3>
              <p>Asegurá el turno con un anticipo que va directo a tu cuenta.</p>
              <div className="lp-deposit" aria-hidden="true">
                <div><small>Seña 30%</small><b>$5.400</b></div>
                <span className="lp-deposit-state"><Check size={13} /> Acreditada</span>
              </div>
            </article>
            <article className="lp-tile lp-rv" style={{ ["--d" as string]: "80ms" } as CSSProperties}>
              <span className="lp-tile-icon"><Users size={18} /></span>
              <h3>Clientes con historial</h3>
              <p>Visitas, ausencias, notas y el servicio que siempre piden.</p>
              <div className="lp-clients" aria-hidden="true">
                {[["LF", "Lucía F.", "12 visitas"], ["MG", "Martín G.", "8 visitas"], ["CR", "Camila R.", "Nueva"]].map(([a, n, v], i) => (
                  <div key={n} style={{ ["--i" as string]: i } as CSSProperties}><span>{a}</span><b>{n}</b><small>{v}</small></div>
                ))}
              </div>
            </article>
            <article className="lp-tile lp-rv" style={{ ["--d" as string]: "160ms" } as CSSProperties}>
              <span className="lp-tile-icon"><Hourglass size={18} /></span>
              <h3>Lista de espera</h3>
              <p>Si se libera un lugar, se lo ofrecés a quien estaba esperando en un toque.</p>
              <div className="lp-wait" aria-hidden="true"><span>Se liberó 17:00</span><ArrowRight size={14} /><b>Avisar a Sofía</b></div>
            </article>
          </div>
          <div className="lp-mini-features lp-rv">
            {[
              [Smartphone, "Panel pensado para el celular"],
              [Search, "Buscador de clientes y turnos"],
              [Sparkles, "Estadísticas claras"],
              [ShieldCheck, "Tus datos, solo tuyos"],
            ].map(([Icon, t]) => {
              const I = Icon as typeof Smartphone;
              return <span key={t as string}><I size={16} />{t as string}</span>;
            })}
          </div>
        </section>

        {/* ============ PERSONALIZADOR ============ */}
        <section className="lp-section lp-brand" id="tu-pagina">
          <div className="lp-head lp-rv">
            <span className="lp-kicker">Tu página</span>
            <h2 className="lp-h2">Probá cómo se vería la tuya.</h2>
            <p className="lp-p">Escribí el nombre de tu negocio y elegí un color. Así la ven tus clientes desde el celular.</p>
          </div>
          <ol className="lp-flow lp-rv" id="como-funciona" aria-label="Cómo funciona">
            {[
              ["Creá tu cuenta", "Sin tarjeta", Plus],
              ["Cargá servicios y horarios", "Duración y precio", Clock],
              ["Compartí tu link", "Instagram, WhatsApp o QR", Link2],
            ].map(([t, d, Icon], i) => {
              const I = Icon as typeof Plus;
              return (
                <li key={t as string} style={{ ["--i" as string]: i } as CSSProperties}>
                  <span className="lp-flow-n"><I size={16} /></span>
                  <div><b>{i + 1}. {t as string}</b><small>{d as string}</small></div>
                </li>
              );
            })}
          </ol>
          <div className="lp-rv"><Customizer /></div>
        </section>

        {/* ============ PRECIOS ============ */}
        <section className="lp-section lp-pricing" id="precios">
          <div className="lp-head lp-rv">
            <span className="lp-kicker">Precios</span>
            <h2 className="lp-h2">Empezá gratis.<br /><span>Crecé cuando lo necesites.</span></h2>
            <div className="lp-billing" role="group" aria-label="Frecuencia de pago">
              <button type="button" aria-pressed={billing === "mensual"} onClick={() => setBilling("mensual")}>Mensual</button>
              <button type="button" aria-pressed={billing === "anual"} onClick={() => setBilling("anual")}>Anual <em>−17%</em></button>
              <i className="lp-billing-pill" style={{ transform: `translateX(${billing === "anual" ? "100%" : "0"})` }} />
            </div>
          </div>
          <div className="lp-prices">
            {(["semilla", "crece", "escala"] as Plan[]).map((p, i) => (
              <article key={p} className={`lp-price-card lp-rv ${p === "crece" ? "is-featured" : ""}`} style={{ ["--d" as string]: `${i * 90}ms` } as CSSProperties}>
                {p === "crece" && <span className="lp-price-badge">El más elegido</span>}
                <h3>{PLAN_META[p].name}</h3>
                <p className="lp-price-profile">{PLAN_PROFILE[p]}</p>
                <div className="lp-price">
                  <span className="lp-price-cur">$</span>
                  <span className="lp-price-num" key={billing + p}>{price(p)}</span>
                  <span className="lp-price-per">/mes</span>
                </div>
                <p className="lp-price-note">{p === "semilla" ? "Gratis para siempre" : billing === "anual" ? "Facturado anualmente" : "Cancelás cuando quieras"}</p>
                <a className={`lp-btn ${p === "crece" ? "lp-btn-primary" : "lp-btn-outline"} lp-btn-block`} href={`#/registro?plan=${p}`} onClick={go(`#/registro?plan=${p}`)}>
                  {p === "semilla" ? "Empezar gratis" : `Elegir ${PLAN_META[p].name}`} <ArrowRight size={16} />
                </a>
                <ul>
                  {PLAN_FEATURES[p].map((f) => <li key={f}><Check size={15} />{f}</li>)}
                </ul>
              </article>
            ))}
          </div>
          <p className="lp-fine lp-rv">Precios en pesos argentinos. La suscripción se paga con Mercado Pago; las señas de tus clientes van directo a tu cuenta.</p>
        </section>

        {/* ============ FAQ ============ */}
        <section className="lp-section lp-faq" id="faq">
          <div className="lp-faq-side lp-rv">
            <span className="lp-kicker">Preguntas</span>
            <h2 className="lp-h2">Lo que seguro te estás preguntando.</h2>
            <p className="lp-p">¿Falta algo? Escribinos a <a href="mailto:hola@cupito.app">hola@cupito.app</a>. Del otro lado hay una persona.</p>
          </div>
          <div className="lp-faq-list lp-rv">
            {FAQ.map(([q, a], i) => (
              <details key={q} open={i === 0}>
                <summary>{q}<span className="lp-faq-icon" aria-hidden="true" /></summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ============ CTA FINAL ============ */}
        <section className="lp-final">
          <div className="lp-final-card lp-rv">
            <i className="lp-final-orb" aria-hidden="true" />
            <i className="lp-final-grid" aria-hidden="true" />
            <span className="lp-kicker lp-kicker-light">Tu próximo cliente está buscando horario</span>
            <h2 className="lp-h2">Dale un lugar para reservar.</h2>
            <p>Creá tu página en minutos. Gratis, sin tarjeta y sin complicarte.</p>
            <div className="lp-cta-row">
              <a className="lp-btn lp-btn-light lp-btn-lg" href="#/registro" onClick={go("#/registro")}>Crear mi página gratis <ArrowRight size={18} /></a>
              <a className="lp-btn lp-btn-ghost-light lp-btn-lg" href="#/reservar/studio-nails" onClick={go("#/reservar/studio-nails")}>Ver una página de ejemplo</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-brand">
            <a className="lp-logo" href="#/" aria-label="Cupito, inicio">
              <img src="/cupito-logo.png" width="28" height="28" alt="" loading="lazy" decoding="async" />
              <b>cupito<i>.</i></b>
            </a>
            <p>Reservas online para negocios con turnos. Hecho en Argentina.</p>
          </div>
          <div className="lp-footer-cols">
            <div>
              <b>Producto</b>
              <a href="#producto">Funciones</a>
              <a href="#precios">Precios</a>
              <a href="#/reservar/studio-nails" onClick={go("#/reservar/studio-nails")}>Demo</a>
            </div>
            <div>
              <b>Cuenta</b>
              {user ? <a href="#/app" onClick={go("#/app")}>Mi panel</a> : <a href="#/login" onClick={go("#/login")}>Ingresar</a>}
              <a href="#/registro" onClick={go("#/registro")}>Crear cuenta</a>
            </div>
            <div>
              <b>Contacto</b>
              <a href="mailto:hola@cupito.app"><Mail size={14} /> hola@cupito.app</a>
              <a href="https://www.instagram.com/cupitoapp/" target="_blank" rel="noreferrer"><Instagram size={14} /> @cupitoapp <ArrowUpRight size={12} /></a>
            </div>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <span>© {new Date().getFullYear()} Cupito</span>
          <span>
            <button type="button" onClick={() => setLegal(TERMS_DOC)}>Términos</button>
            <button type="button" onClick={() => setLegal(PRIVACY_DOC)}>Privacidad</button>
          </span>
        </div>
      </footer>

      {legal && <LegalModal doc={legal} onClose={() => setLegal(null)} />}
    </div>
  );
}
