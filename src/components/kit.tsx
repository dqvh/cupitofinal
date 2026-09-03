import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

interface IconProps { className?: string }

function S({ className = "w-6 h-6", d, filled = false }: IconProps & { d: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill={filled ? "currentColor" : "none"} />
    </svg>
  );
}

/* Marca Cupito: nuevo logo oficial */
export function LogoMark({ className = "w-8 h-8" }: IconProps) {
  return (
    <img
      src="/icon.png"
      alt="Cupito"
      className={`${className} object-contain rounded-[22%] shadow-sm inline-block shrink-0`}
      loading="eager"
    />
  );
}

export const IconArrow = ({ className }: IconProps) => <S className={className} d="M4 12h15m0 0l-6-6m6 6l-6 6" />;
export const IconCheck = ({ className }: IconProps) => <S className={className} d="M4.5 12.5l5 5L19.5 7" />;
export const IconPlus = ({ className }: IconProps) => <S className={className} d="M12 5v14M5 12h14" />;
export const IconChevron = ({ className }: IconProps) => <S className={className} d="M9 5l7 7-7 7" />;
export const IconClock = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none" />
    <path d="M12 7v5.5l3.5 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);
export const IconCalendar = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="16" rx="3.5" stroke="currentColor" strokeWidth="2" fill="none" />
    <path d="M8 3v4M16 3v4M3.5 10h17M8 14h2.5M8 17.5h2.5M13 14h2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
export const IconWallet = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11a1.25 1.25 0 0 1 0 2.5H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    <rect x="4" y="7.5" width="16.5" height="12" rx="3" stroke="currentColor" strokeWidth="2" fill="none" />
    <circle cx="15.5" cy="13.5" r="1.5" fill="currentColor" />
  </svg>
);
export const IconLink = ({ className }: IconProps) => <S className={className} d="M10 14a4 4 0 005.7 0l3-3a4 4 0 10-5.7-5.6l-1.2 1.2M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 105.7 5.6l1.2-1.2" />;
export const IconMail = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="2" fill="none" />
    <path d="M4 7.5l8 6 8-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);
export const IconInstagram = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" strokeWidth="2" fill="none" />
    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" fill="none" />
    <circle cx="17.2" cy="6.8" r="1.4" fill="currentColor" />
  </svg>
);
export const IconChart = ({ className }: IconProps) => <S className={className} d="M4 20V10m5.3 10V4m5.4 16v-7m5.3 7v-4M2 20h20" />;
export const IconGear = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
    <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M18.7 5.3L17 7M7 17l-1.7 1.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
export const IconBag = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d="M5.5 8h13l-1 11a2.5 2.5 0 01-2.5 2.3H9A2.5 2.5 0 016.5 19L5.5 8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" />
    <path d="M9 10V6.8a3 3 0 016 0V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
  </svg>
);
export const IconLock = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <rect x="5" y="10.5" width="14" height="10" rx="2.5" stroke="currentColor" strokeWidth="2" fill="none" />
    <path d="M8 10.5V8a4 4 0 018 0v2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    <circle cx="12" cy="15" r="1.5" fill="currentColor" />
  </svg>
);
export const IconTicket = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d="M3 8a2 2 0 012-2h14a2 2 0 012 2v1.5a2.5 2.5 0 000 5V16a2 2 0 01-2 2H5a2 2 0 01-2-2v-1.5a2.5 2.5 0 000-5V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" />
    <path d="M14 6v12" stroke="currentColor" strokeWidth="2" strokeDasharray="2.5 2.5" strokeLinecap="round" />
  </svg>
);
export const IconUsers = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <circle cx="9" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" fill="none" />
    <path d="M2.8 20c.5-3.8 2.9-6 6.2-6s5.7 2.2 6.2 6M15.5 4.9a3.5 3.5 0 010 6.2M17.7 14.6c2 .8 3.2 2.7 3.5 5.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
  </svg>
);
export const IconStar = ({ className }: IconProps) => (
  <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
    <path d="M10 1.8l2.4 5 5.5.7-4 3.8 1 5.4L10 14.1l-4.9 2.6 1-5.4-4-3.8 5.5-.7z" fill="currentColor" />
  </svg>
);
export const IconSpark = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d="M12 1c.8 5.5 4.5 9.2 10 10-5.5.8-9.2 4.5-10 10-.8-5.5-4.5-9.2-10-10 5.5-.8 9.2-4.5 10-10z" fill="currentColor" />
  </svg>
);
export const IconPlay = ({ className }: IconProps) => (
  <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
    <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
  </svg>
);
export const IconBell = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d="M12 3a6.5 6.5 0 00-6.5 6.5c0 4.3-1.7 5.7-1.7 5.7h16.4s-1.7-1.4-1.7-5.7A6.5 6.5 0 0012 3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" />
    <path d="M9.8 18.5a2.3 2.3 0 004.4 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
  </svg>
);
export const IconLogout = ({ className }: IconProps) => <S className={className} d="M9 3.5H6a2 2 0 00-2 2v13a2 2 0 002 2h3M15 8l4 4-4 4M19 12H9" />;
export const IconTrash = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d="M4 6.5h16M9.5 4h5M6 6.5l.9 12.2A2 2 0 008.9 20.5h6.2a2 2 0 002-1.8L18 6.5M10 10.5v6M14 10.5v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);
export const IconPencil = ({ className }: IconProps) => <S className={className} d="M16.5 3.5l4 4L8 20l-5 1.2L4.2 16 16.5 3.5zM14 6l4 4" />;
export const IconWhatsApp = ({ className }: IconProps) => (
  <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
    <path d="M10 1.8a8.2 8.2 0 00-7 12.4L1.8 18l3.9-1.2A8.2 8.2 0 1010 1.8zm3.7 11.7c-.2.5-1.1 1-1.6 1s-.9.1-3.4-.9c-2.6-1.1-4.2-3.6-4.3-3.8-.1-.2-1-1.4-1-2.7s.7-1.9.9-2.2c.2-.2.5-.3.7-.3h.5c.2 0 .4-.1.6.5l.8 2c.1.2.1.4 0 .6l-.4.6c-.1.2-.2.4 0 .7a7.6 7.6 0 001.4 1.8 8.7 8.7 0 002 1.3c.3.1.4.1.6-.1l.6-.7c.2-.2.4-.2.7-.1l1.9.9c.3.1.5.2.5.4 0 .1 0 .6-.2 1z" fill="currentColor" />
  </svg>
);
export const IconChat = ({ className }: IconProps) => (
  <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
    <path d="M4 8a4 4 0 014-4h12a4 4 0 014 4v8a4 4 0 01-4 4H11l-5.4 4.4A1 1 0 014 23.6V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" />
    <circle cx="10" cy="12" r="1.5" fill="currentColor" />
    <circle cx="14.5" cy="12" r="1.5" fill="currentColor" />
    <circle cx="19" cy="12" r="1.5" fill="currentColor" />
  </svg>
);
export const IconMoon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d="M20 14.5A8.5 8.5 0 119.5 4a7 7 0 0010.5 10.5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" />
  </svg>
);
export const IconSun = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" fill="none" />
    <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
export const IconSearch = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
    <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
export const IconCopy = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
  </svg>
);
export const IconFilter = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d="M3 4h18l-7 8.5V19l-4 2v-8.5L3 4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

/* ---------- botón para copiar texto con feedback visual ---------- */
export function CopyButton({ text, label = "Copiar link", copiedLabel = "¡Copiado!", className = "" }: { text: string; label?: string; copiedLabel?: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback si no hay permisos de portapapeles
      const input = document.createElement("input");
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`btn-press inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
        copied
          ? "bg-emerald-600 text-white shadow-sm"
          : "bg-white/80 text-ink hover:bg-white hover:shadow-sm"
      } ${className}`}
      title="Copiar al portapapeles"
    >
      {copied ? <IconCheck className="h-3.5 w-3.5" /> : <IconCopy className="h-3.5 w-3.5 text-ink/70" />}
      <span>{copied ? copiedLabel : label}</span>
    </button>
  );
}

/* ---------- badge pill estilizado ---------- */
export function Badge({
  children,
  variant = "neutral",
  size = "md",
  className = "",
}: {
  children: ReactNode;
  variant?: "success" | "warning" | "danger" | "info" | "neutral" | "lime";
  size?: "sm" | "md";
  className?: string;
}) {
  const variantStyles = {
    success: "bg-emerald-50 text-emerald-800 border-emerald-200",
    warning: "bg-amber-50 text-amber-900 border-amber-200",
    danger: "bg-rose-50 text-rose-800 border-rose-200",
    info: "bg-sky-50 text-sky-800 border-sky-200",
    neutral: "bg-ink/5 text-ink/70 border-ink/10",
    lime: "bg-lime text-ink border-limedeep/60",
  };
  const sizeStyles = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-xs",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-bold uppercase tracking-wider ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
}

/* ---------- confeti ligero de celebración ---------- */
export function ConfettiBurst() {
  const particles = [
    { color: "#cdf463", x: -40, y: -50, delay: 0 },
    { color: "#ff7a59", x: 40, y: -45, delay: 50 },
    { color: "#1e5c49", x: -60, y: -20, delay: 80 },
    { color: "#93e6c3", x: 60, y: -25, delay: 120 },
    { color: "#ffd166", x: -25, y: -70, delay: 60 },
    { color: "#06d6a0", x: 25, y: -65, delay: 100 },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden" aria-hidden="true">
      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute h-2.5 w-2.5 rounded-full pop-in"
          style={{
            backgroundColor: p.color,
            transform: `translate(${p.x}px, ${p.y}px)`,
            animationDuration: "0.6s",
            animationDelay: `${p.delay}ms`,
          }}
        />
      ))}
    </div>
  );
}

/* ---------- scroll reveal ---------- */
export function Reveal({ children, className = "", delay = 0, style }: { children: ReactNode; className?: string; delay?: number; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) { setInView(true); obs.disconnect(); }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${inView ? "is-in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms`, ...style }}>
      {children}
    </div>
  );
}

/* ---------- contador animado ---------- */
export function CountUp({ to, duration = 1500, prefix = "", suffix = "", className = "" }: { to: number; duration?: number; prefix?: string; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || started.current) return;
        started.current = true;
        const t0 = performance.now();
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / duration);
          setValue(Math.round(to * (1 - Math.pow(1 - p, 3))));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        obs.disconnect();
      },
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [to, duration]);
  return <span ref={ref} className={className}>{prefix}{value.toLocaleString("es-AR")}{suffix}</span>;
}

/* ---------- switch ---------- */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${on ? "bg-fern" : "bg-ink/20"}`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${on ? "left-6" : "left-1"}`} />
    </button>
  );
}
