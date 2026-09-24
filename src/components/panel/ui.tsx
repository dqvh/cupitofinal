import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X, MoreHorizontal } from "lucide-react";
import type { BookingStatus } from "../../lib/store";

/* ---------- Botones ---------- */

type Variant = "primary" | "secondary" | "ghost" | "soft" | "danger" | "danger-solid";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon, iconRight, loading, block, className = "", children, disabled, type = "button", ...rest },
  ref
) {
  const cls = [
    "c-btn",
    `c-btn--${variant}`,
    size !== "md" ? `c-btn--${size}` : "",
    block ? "c-btn--block" : "",
    !children ? "c-btn--icon" : "",
    className,
  ].filter(Boolean).join(" ");
  return (
    <button ref={ref} type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <span className="c-spin" aria-hidden="true" /> : icon}
      {children}
      {iconRight}
    </button>
  );
});

export function IconButton({ label, children, size = "md", variant = "ghost", ...rest }: Omit<ButtonProps, "children" | "icon"> & { label: string; children: ReactNode }) {
  return (
    <Button aria-label={label} title={label} size={size} variant={variant} icon={children} {...rest} />
  );
}

/* ---------- Badges ---------- */

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pendiente: "Por confirmar",
  confirmada: "Confirmado",
  atendida: "Atendido",
  cancelada: "Cancelado",
  ausente: "No vino",
};

export function StatusBadge({ status, className = "" }: { status: BookingStatus; className?: string }) {
  return (
    <span className={`c-badge c-badge--${status} ${className}`}>
      <span className="c-dot" aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Badge({ tone = "neutral", children, className = "" }: { tone?: "neutral" | "brand" | "warn" | "danger" | "info"; children: ReactNode; className?: string }) {
  return <span className={`c-badge c-badge--${tone} ${className}`}>{children}</span>;
}

/* ---------- Avatar ---------- */

export function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || "")
      .join("") || "?"
  );
}

export function Avatar({ name, color, size = "md" }: { name: string; color?: string; size?: "sm" | "md" | "lg" }) {
  const style = color ? { background: `${color}22`, color: shade(color) } : undefined;
  return (
    <span className={`c-avatar ${size !== "md" ? `c-avatar--${size}` : ""}`} style={style} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

/** Oscurece un color hex para usarlo como texto sobre su versión clara. */
export function shade(hex: string, amt = 0.45) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return "#0d4d33";
  const n = parseInt(m[1], 16);
  const r = Math.round(((n >> 16) & 255) * (1 - amt));
  const g = Math.round(((n >> 8) & 255) * (1 - amt));
  const b = Math.round((n & 255) * (1 - amt));
  return `rgb(${r}, ${g}, ${b})`;
}

/* ---------- Formularios ---------- */

export function Field({ label, hint, error, children, htmlFor, className = "" }: { label?: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <div className={`c-field ${className}`}>
      {label && <label className="c-label" htmlFor={htmlFor}>{label}</label>}
      {children}
      {error ? <p className="c-error" role="alert">{error}</p> : hint ? <p className="c-hint">{hint}</p> : null}
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className="c-toggle"
      onClick={() => onChange(!checked)}
    />
  );
}

export function Segmented<T extends string>({ value, onChange, options, block, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; icon?: ReactNode }[]; block?: boolean; label?: string }) {
  return (
    <div className={`c-seg ${block ? "c-seg--block" : ""}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Estados ---------- */

export function Empty({ icon, title, text, children }: { icon?: ReactNode; title: string; text?: ReactNode; children?: ReactNode }) {
  return (
    <div className="c-empty">
      {icon && <div className="c-empty-icon">{icon}</div>}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children && <div className="c-empty-actions">{children}</div>}
    </div>
  );
}

export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`c-skel ${className}`} style={style} aria-hidden="true" />;
}

export function Callout({ tone = "neutral", icon, children, className = "" }: { tone?: "neutral" | "warn" | "danger" | "brand" | "info"; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`c-callout ${tone !== "neutral" ? `c-callout--${tone}` : ""} ${className}`}>
      {icon}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/* ---------- Capa (portal que hereda tokens) ---------- */

export function Layer({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(<div className="cp cp-layer">{children}</div>, document.body);
}

/* Bloquea el scroll del body mientras haya al menos una hoja abierta. */
let lockCount = 0;
function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lockCount++;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      lockCount--;
      if (lockCount <= 0) document.body.style.overflow = prev;
    };
  }, [active]);
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/* ---------- Sheet: drawer lateral en desktop, hoja inferior en mobile ---------- */

export function Sheet({
  open = true,
  onClose,
  title,
  subtitle,
  headerExtra,
  children,
  footer,
  side = "right",
  size,
  labelledBy,
  initialFocus = true,
  full,
}: {
  open?: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  headerExtra?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  side?: "right" | "center";
  size?: "narrow" | "wide";
  labelledBy?: string;
  initialFocus?: boolean;
  full?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = panel.current;
    if (el && initialFocus) {
      const target = el.querySelector<HTMLElement>("[data-autofocus]") || el;
      requestAnimationFrame(() => target.focus({ preventScroll: true }));
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Solo la hoja de arriba se cierra.
        const layers = document.querySelectorAll(".c-sheet");
        if (layers[layers.length - 1] === panel.current) {
          e.stopPropagation();
          onClose();
        }
      }
      if (e.key === "Tab" && panel.current) {
        const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (prev && document.contains(prev)) prev.focus({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  return (
    <Layer>
      <div className="c-overlay" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? labelledBy || titleId : undefined}
        tabIndex={-1}
        className={`c-sheet c-sheet--${side} ${size ? `c-sheet--${size}` : ""} ${full ? "c-sheet--full" : ""}`}
        style={{ outline: "none" }}
      >
        <div className="c-sheet-grip" aria-hidden="true" />
        {(title || headerExtra) && (
          <div className="c-sheet-head">
            <div className="min-w-0 flex-1">
              {title && <h2 id={labelledBy || titleId}>{title}</h2>}
              {subtitle && <p>{subtitle}</p>}
            </div>
            {headerExtra}
            <IconButton label="Cerrar" size="sm" onClick={onClose}>
              <X />
            </IconButton>
          </div>
        )}
        <div className="c-sheet-body">{children}</div>
        {footer && <div className="c-sheet-foot">{footer}</div>}
      </div>
    </Layer>
  );
}

/* ---------- Confirmación ---------- */

export function Confirm({
  title,
  text,
  confirmLabel = "Confirmar",
  cancelLabel = "Volver",
  danger,
  onConfirm,
  onClose,
}: {
  title: string;
  text?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet
      side="center"
      size="narrow"
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button onClick={onClose}>{cancelLabel}</Button>
          <Button data-autofocus variant={danger ? "danger-solid" : "primary"} onClick={() => { onConfirm(); onClose(); }}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {text && <div className="text-[13.5px] text-[var(--text-2)]">{text}</div>}
    </Sheet>
  );
}

/* ---------- Menú contextual ---------- */

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect?: () => void;
  href?: string;
  danger?: boolean;
  hidden?: boolean;
  separator?: boolean;
}

export function Menu({ items, label = "Más acciones", trigger, align = "right" }: { items: MenuItem[]; label?: string; trigger?: (p: { onClick: () => void; "aria-expanded": boolean; "aria-haspopup": "menu" }) => ReactNode; align?: "right" | "left" }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLSpanElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const place = useCallback(() => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const w = 220;
    const left = align === "right" ? Math.max(8, r.right - w) : Math.min(window.innerWidth - w - 8, r.left);
    const below = r.bottom + 6;
    const estH = Math.min(320, items.filter((i) => !i.hidden).length * 36 + 12);
    const top = below + estH > window.innerHeight - 8 ? Math.max(8, r.top - estH - 6) : below;
    setPos({ top, left });
  }, [align, items]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (menu.current?.contains(t) || btn.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); setOpen(false); btn.current?.querySelector("button")?.focus(); }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const els = Array.from(menu.current?.querySelectorAll<HTMLElement>(".c-menu-item") || []);
        const i = els.indexOf(document.activeElement as HTMLElement);
        els[(i + (e.key === "ArrowDown" ? 1 : -1) + els.length) % els.length]?.focus();
      }
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    requestAnimationFrame(() => menu.current?.querySelector<HTMLElement>(".c-menu-item")?.focus());
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const toggle = () => setOpen((o) => !o);
  const visible = items.filter((i) => !i.hidden);

  return (
    <>
      <span ref={btn} className="inline-flex" onClick={(e) => e.stopPropagation()}>
        {trigger ? (
          trigger({ onClick: toggle, "aria-expanded": open, "aria-haspopup": "menu" })
        ) : (
          <IconButton label={label} size="sm" onClick={toggle} aria-expanded={open} aria-haspopup="menu">
            <MoreHorizontal />
          </IconButton>
        )}
      </span>
      {open && pos && (
        <Layer>
          <div ref={menu} role="menu" className="c-menu" style={{ position: "fixed", top: pos.top, left: pos.left, width: 220 }} onClick={(e) => e.stopPropagation()}>
            {visible.map((it, i) =>
              it.separator ? (
                <div key={`sep-${i}`} className="c-menu-sep" role="separator" />
              ) : it.href ? (
                <a
                  key={it.label}
                  role="menuitem"
                  href={it.href}
                  target="_blank"
                  rel="noreferrer"
                  className={`c-menu-item ${it.danger ? "c-menu-item--danger" : ""}`}
                  onClick={() => setOpen(false)}
                >
                  {it.icon}
                  {it.label}
                </a>
              ) : (
                <button
                  key={it.label}
                  role="menuitem"
                  type="button"
                  className={`c-menu-item ${it.danger ? "c-menu-item--danger" : ""}`}
                  onClick={() => { setOpen(false); it.onSelect?.(); }}
                >
                  {it.icon}
                  {it.label}
                </button>
              )
            )}
          </div>
        </Layer>
      )}
    </>
  );
}

/* ---------- Encabezado de página ---------- */

export function PageHead({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="cp-page-head">
      <div className="min-w-0">
        <h1 className="c-h1">{title}</h1>
        {sub && <p className="c-sub">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, sub, action, children, className = "", bodyClass = "c-card-body", id }: { title?: ReactNode; sub?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClass?: string; id?: string }) {
  return (
    <section className={`c-card ${className}`} id={id} aria-label={typeof title === "string" ? title : undefined}>
      {(title || action) && (
        <div className="c-card-head">
          <div className="min-w-0">
            {title && <h2 className="c-h2">{title}</h2>}
            {sub && <p className="c-sub">{sub}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

/* ---------- Hooks ---------- */

export function useMediaQuery(q: string) {
  const [m, setM] = useState(() => (typeof window !== "undefined" ? window.matchMedia(q).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener("change", on);
    on();
    return () => mq.removeEventListener("change", on);
  }, [q]);
  return m;
}

/** Re-render cada minuto para relojes ("ahora", "en 20 min"). */
export function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
