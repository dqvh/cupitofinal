import { useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  Mail,
  Phone,
  Plus,
  UserRound,
  ArrowUpRight,
  MessageCircle,
  X,
} from "lucide-react";
import { fmtMoney, type Booking } from "../lib/store";
import { createWhatsAppUrl } from "../lib/phone";

export interface CustomerStats {
  name: string;
  phone: string;
  email?: string;
  count: number;
  visits: number;
  total: number;
  lastDate?: string;
}

const STATUS_LABELS: Record<string, string> = {
  pendiente: "Por confirmar",
  confirmada: "Confirmada",
  atendida: "Atendida",
  cancelada: "Cancelada",
  ausente: "No vino",
};

export function CustomerCards({
  customers,
  onOpen,
}: {
  customers: CustomerStats[];
  onOpen: (customer: CustomerStats) => void;
}) {
  return (
    <div className="customer-grid">
      {customers.map((customer) => (
        <button
          type="button"
          className="customer-card cursor-pointer"
          key={customer.phone + customer.name}
          onClick={() => onOpen(customer)}
        >
          <div className="customer-card-head">
            <span className="avatar">
              {customer.name
                .split(" ")
                .filter(Boolean)
                .map((s) => s[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </span>
            <div>
              <strong>{customer.name}</strong>
              <span>{customer.phone}</span>
            </div>
            <ArrowUpRight size={17} className="text-slate-400 ml-auto" />
          </div>
          <div className="customer-card-stats">
            <span>
              <b>{customer.count}</b> reservas
            </span>
            <span>
              <b>{customer.visits}</b> atendidas
            </span>
            <span>
              <b>{fmtMoney(customer.total)}</b> en total
            </span>
          </div>
          <span className="customer-card-link">
            Ver historial y contacto <ChevronRight size={14} />
          </span>
        </button>
      ))}
    </div>
  );
}

export function CustomerHistoryModal({
  customer,
  records,
  services,
  professionals,
  onOpenBooking,
  onNewBooking,
  onClose,
}: {
  customer: CustomerStats;
  records: Booking[];
  services?: import("../lib/store").Service[];
  professionals?: import("../lib/store").Professional[];
  onOpenBooking: (booking: Booking) => void;
  onNewBooking: () => void;
  onClose: () => void;
}) {
  const customerBookings = records
    .filter((b) => b.phone === customer.phone || b.client.toLowerCase() === customer.name.toLowerCase())
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));

  const waUrl = createWhatsAppUrl(
    customer.phone,
    `¡Hola ${customer.name.split(" ")[0]}! Te escribimos de nuestro local.`
  );

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 font-display font-bold text-base border border-emerald-200">
              {customer.name
                .split(" ")
                .filter(Boolean)
                .map((s) => s[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </span>
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">{customer.name}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {customer.count} reservas · {customer.visits} visitas completadas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Contact actions */}
        <div className="flex flex-wrap gap-2 pt-4">
          <a
            href={waUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-press inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
          >
            <MessageCircle size={15} /> WhatsApp
          </a>
          {customer.phone && (
            <a
              href={`tel:${customer.phone.replace(/[^+\d]/g, "")}`}
              className="btn-press inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <Phone size={14} /> Llamar
            </a>
          )}
          <button
            type="button"
            onClick={() => {
              onClose();
              onNewBooking();
            }}
            className="btn-press inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 ml-auto"
          >
            <Plus size={14} /> Nuevo turno
          </button>
        </div>

        {/* Total revenue */}
        <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
          <span className="text-xs font-medium text-emerald-900">Total en servicios atendidos</span>
          <strong className="font-display text-lg font-bold text-emerald-800">
            {fmtMoney(customer.total)}
          </strong>
        </div>

        {/* Bookings history */}
        <div className="mt-5">
          <h3 className="font-display text-sm font-bold text-slate-800 mb-3">Historial de turnos</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {customerBookings.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No hay registros de turnos.</p>
            ) : (
              customerBookings.map((b) => {
                const srv = services?.find((s) => s.id === b.serviceId);
                const pro = professionals?.find((p) => p.id === b.proId);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenBooking(b);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-left hover:bg-slate-100/80 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CalendarDays size={18} className="text-emerald-600 shrink-0" />
                      <div className="min-w-0 truncate">
                        <p className="text-xs font-bold text-slate-900 truncate">{srv?.name || "Servicio"}</p>
                        <p className="text-[11px] text-slate-500">
                          {b.date} · {b.time} {pro?.name ? `con ${pro.name}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={"badge " + b.status}>
                        {STATUS_LABELS[b.status] || b.status}
                      </span>
                      <ChevronRight size={15} className="text-slate-400" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
