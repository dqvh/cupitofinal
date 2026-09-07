import { useState, useRef, useEffect, type ReactNode } from "react";
import { MoreHorizontal, Check, CheckCircle2, XCircle, UserX, MessageCircle, Trash2, Eye, Clock, UserCheck } from "lucide-react";
import type { Booking, BookingStatus, Service, Product, Professional } from "../lib/store";
import { fmtMoney, fmtLong } from "../lib/store";
import { createWhatsAppUrl } from "../lib/phone";

interface BookingRowProps {
  b: Booking;
  service?: Service;
  pro?: Professional;
  products?: Product[];
  businessName?: string;
  onStatus: (id: string, status: BookingStatus) => void;
  onDelete: (id: string) => void;
  onVerify?: (id: string) => void;
  onReject?: (id: string) => void;
  onReschedule?: (b: Booking) => void;
  onOpenDetail: (b: Booking) => void;
}

const STATUS_CONFIG: Record<
  BookingStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  pendiente: {
    label: "Pendiente",
    bg: "bg-amber-50 border-amber-200/80",
    text: "text-amber-800",
    dot: "bg-amber-500",
  },
  confirmada: {
    label: "Confirmada",
    bg: "bg-emerald-50 border-emerald-200/80",
    text: "text-emerald-800",
    dot: "bg-emerald-500",
  },
  atendida: {
    label: "Atendida",
    bg: "bg-neutral-100 border-neutral-200",
    text: "text-neutral-700",
    dot: "bg-neutral-400",
  },
  cancelada: {
    label: "Cancelada",
    bg: "bg-rose-50 border-rose-200/80",
    text: "text-rose-700",
    dot: "bg-rose-500",
  },
  ausente: {
    label: "No vino",
    bg: "bg-neutral-100 border-neutral-200",
    text: "text-neutral-600",
    dot: "bg-neutral-400",
  },
};

export default function BookingRow({
  b,
  service,
  pro,
  products = [],
  businessName = "nuestro local",
  onStatus,
  onDelete,
  onVerify,
  onReject,
  onReschedule,
  onOpenDetail,
}: BookingRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const sc = STATUS_CONFIG[b.status] || STATUS_CONFIG.pendiente;
  const isCancelled = b.status === "cancelada";

  const whatsAppUrl = b.phone
    ? createWhatsAppUrl(
        b.phone,
        `Hola ${b.client.split(" ")[0]}! Te escribimos de ${businessName} para recordarte tu turno de ${
          service?.name || "atención"
        } el ${fmtLong(b.date)} a las ${b.time} hs. ¡Te esperamos!`
      )
    : null;

  // Precios y extras
  const servicesPrice = service?.price || 0;
  const productsTotal = (b.items || []).reduce((sum, it) => {
    const p = products.find((x) => x.id === it.productId);
    return sum + (p?.price || 0) * (it.qty || 1);
  }, 0);
  const totalAmount = servicesPrice + productsTotal;
  const productsCount = (b.items || []).reduce((sum, it) => sum + (it.qty || 1), 0);

  const renderDropdownItems = () => (
    <div className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-xl border border-black/[0.08] bg-white p-1 shadow-xl">
      <button
        type="button"
        onClick={() => {
          setMenuOpen(false);
          onOpenDetail(b);
        }}
        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[#1D1D1F] hover:bg-neutral-100 transition-colors"
      >
        <Eye size={14} className="text-[#6E6E73]" />
        <span>Ver detalle</span>
      </button>

      {whatsAppUrl && (
        <a
          href={whatsAppUrl}
          target="_blank"
          rel="noreferrer"
          onClick={() => setMenuOpen(false)}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[#16A34A] hover:bg-emerald-50 transition-colors"
        >
          <MessageCircle size={14} />
          <span>WhatsApp</span>
        </a>
      )}

      {b.status !== "atendida" && !isCancelled && (
        <button
          type="button"
          onClick={() => {
            setMenuOpen(false);
            onStatus(b.id, "atendida");
          }}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[#1D1D1F] hover:bg-neutral-100 transition-colors"
        >
          <CheckCircle2 size={14} className="text-[#16A34A]" />
          <span>Marcar atendida</span>
        </button>
      )}

      {b.status === "confirmada" && (
        <button
          type="button"
          onClick={() => {
            setMenuOpen(false);
            onStatus(b.id, "ausente");
          }}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[#1D1D1F] hover:bg-neutral-100 transition-colors"
        >
          <UserX size={14} className="text-amber-600" />
          <span>No vino (ausente)</span>
        </button>
      )}

      {!isCancelled && (
        <button
          type="button"
          onClick={() => {
            setMenuOpen(false);
            onStatus(b.id, "cancelada");
          }}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
        >
          <XCircle size={14} />
          <span>Cancelar turno</span>
        </button>
      )}

      <div className="my-1 border-t border-black/[0.06]" />

      <button
        type="button"
        onClick={() => {
          setMenuOpen(false);
          onDelete(b.id);
        }}
        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
      >
        <Trash2 size={14} />
        <span>Eliminar</span>
      </button>
    </div>
  );

  return (
    <div
      onClick={() => onOpenDetail(b)}
      className={`group relative flex flex-col rounded-2xl border border-black/[0.08] bg-white p-3.5 sm:p-4 shadow-xs transition-all hover:border-black/[0.14] hover:shadow-sm cursor-pointer select-none ${
        isCancelled ? "opacity-55 bg-neutral-50/60" : ""
      }`}
    >
      {/* Fila principal: Hora + Info de cliente + Acciones en Desktop */}
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start sm:items-center gap-3">
          {/* Badge de Horario */}
          <div className="flex h-12 w-14 sm:h-12 sm:w-15 shrink-0 flex-col items-center justify-center rounded-xl bg-[#F5F5F7] font-display border border-black/[0.04]">
            <span className="text-sm sm:text-base font-extrabold text-[#1D1D1F] leading-none">{b.time}</span>
            <span className="mt-0.5 text-[10px] font-semibold text-[#6E6E73]">{service?.duration ?? 30}′</span>
          </div>

          {/* Información del Cliente, Estado y Servicio */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`font-display text-sm sm:text-base font-bold text-[#1D1D1F] truncate ${
                  isCancelled ? "line-through text-[#6E6E73]" : ""
                }`}
              >
                {b.client}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${sc.bg} ${sc.text}`}
              >
                {b.status === "pendiente" && <Clock size={11} className="shrink-0 text-amber-700" />}
                {b.status === "confirmada" && <CheckCircle2 size={11} className="shrink-0 text-emerald-700" />}
                {b.status === "atendida" && <UserCheck size={11} className="shrink-0 text-neutral-600" />}
                {b.status === "cancelada" && <XCircle size={11} className="shrink-0 text-rose-600" />}
                {b.status === "ausente" && <UserX size={11} className="shrink-0 text-neutral-500" />}
                <span>{sc.label}</span>
              </span>
            </div>

            {/* Metadatos ordenados: Servicio, profesional, precio y productos */}
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#6E6E73]">
              <span className="font-semibold text-[#1D1D1F]">{service ? service.name : "Servicio"}</span>
              {pro && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-600">
                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: pro.color || "#10b981" }} />
                  {pro.name}
                </span>
              )}
              {totalAmount > 0 && (
                <span className="font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded-md text-[11px] border border-emerald-200/60">
                  {fmtMoney(totalAmount)}
                </span>
              )}
              {productsCount > 0 && (
                <span className="text-neutral-600 bg-neutral-100 px-1.5 py-0.5 rounded-md text-[11px] font-medium">
                  +{productsCount} prod.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Acciones para pantalla Desktop (sm y superior) */}
        <div
          className="hidden sm:flex shrink-0 items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {b.status === "pendiente" && (
            <button
              type="button"
              onClick={() => onStatus(b.id, "confirmada")}
              className="flex items-center gap-1 rounded-full bg-black px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-neutral-800 active:scale-95"
            >
              <Check size={13} className="text-[#16A34A]" />
              <span>Confirmar</span>
            </button>
          )}

          {whatsAppUrl && (
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noreferrer"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80 transition-colors"
              title="Escribir por WhatsApp"
            >
              <MessageCircle size={15} />
            </a>
          )}

          <button
            type="button"
            onClick={() => onOpenDetail(b)}
            className="flex h-8 items-center gap-1 rounded-full border border-black/10 bg-[#F5F5F7] px-2.5 text-xs font-semibold text-[#1D1D1F] hover:bg-neutral-200 transition-colors"
          >
            <span>Detalles</span>
            <span className="text-neutral-400 text-[10px]">→</span>
          </button>

          {/* Menú Contextual (···) */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Más opciones"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F5F5F7] text-[#1D1D1F] transition-colors hover:bg-neutral-200 active:scale-95 focus:outline-none"
            >
              <MoreHorizontal size={16} />
            </button>
            {menuOpen && renderDropdownItems()}
          </div>
        </div>
      </div>

      {/* Barra de acciones dedicada para Mobile (evita colisiones y amontonamientos) */}
      <div
        className="mt-2.5 pt-2 border-t border-black/[0.04] flex sm:hidden items-center justify-between gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5">
          {b.status === "pendiente" && (
            <button
              type="button"
              onClick={() => onStatus(b.id, "confirmada")}
              className="inline-flex items-center gap-1 rounded-lg bg-black px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-neutral-800 active:scale-95"
            >
              <Check size={13} className="text-[#16A34A]" />
              <span>Confirmar</span>
            </button>
          )}
          {whatsAppUrl && (
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
            >
              <MessageCircle size={13} className="text-[#16A34A]" />
              <span>WhatsApp</span>
            </a>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onOpenDetail(b)}
            className="inline-flex items-center gap-0.5 rounded-lg px-2 py-1 text-xs font-semibold text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-neutral-100 transition-colors"
          >
            <span>Detalles</span>
            <span className="text-[10px] text-neutral-400">→</span>
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Más opciones"
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F5F5F7] text-[#1D1D1F] hover:bg-neutral-200 transition-colors"
            >
              <MoreHorizontal size={14} />
            </button>
            {menuOpen && renderDropdownItems()}
          </div>
        </div>
      </div>
    </div>
  );
}
