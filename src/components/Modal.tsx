import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

export interface ModalProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
  className?: string;
}

export default function Modal({
  title,
  subtitle,
  onClose,
  children,
  maxWidth = "max-w-lg",
  className = "",
}: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="cupito-modal-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-md sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        className={`cupito-modal pop-in w-full ${maxWidth} overflow-hidden rounded-[24px] border border-black/5 bg-white p-6 text-[#1D1D1F] shadow-2xl sm:p-7 ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || subtitle) && (
          <div className="flex items-start justify-between gap-3 pb-4 border-b border-black/[0.06]">
            <div>
              {title && (
                <h2 className="font-display text-[20px] font-bold tracking-tight text-[#1D1D1F] leading-snug">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="mt-0.5 text-xs text-[#6E6E73]">{subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[#6E6E73] transition-colors hover:bg-neutral-200 hover:text-[#1D1D1F] active:scale-95 focus:outline-none"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}
