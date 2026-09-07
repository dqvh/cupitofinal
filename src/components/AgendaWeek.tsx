import { Clock, ChevronRight } from "lucide-react";
import { type Booking, type Service, type Professional } from "../lib/store";

const STATUS_LABELS: Record<string, string> = {
  pendiente: "Por confirmar",
  confirmada: "Confirmada",
  atendida: "Atendida",
  cancelada: "Cancelada",
  ausente: "No vino",
};

export function AgendaWeek({
  dates,
  records,
  services,
  professionals,
  onDay,
  onOpen,
  onSlotClick,
  todayKey,
}: {
  dates: string[];
  records: Booking[];
  services?: Service[];
  professionals?: Professional[];
  onDay: (date: string) => void;
  onOpen: (booking: Booking) => void;
  onSlotClick?: (date: string, time?: string) => void;
  todayKey: string;
}) {
  return (
    <div className="agenda-week">
      {dates.map((date) => {
        const rows = records
          .filter((x) => x.date === date && x.status !== "cancelada")
          .sort((a, b) => a.time.localeCompare(b.time));

        const isToday = date === todayKey;

        // Parse date for day name
        const [y, m, d] = date.split("-").map(Number);
        const dateObj = new Date(y, m - 1, d);
        const weekdayName = dateObj
          .toLocaleDateString("es-AR", { weekday: "short" })
          .replace(".", "")
          .toUpperCase();

        return (
          <section key={date} className={"week-day " + (isToday ? "is-today" : "")}>
            <button
              type="button"
              className="week-day-header"
              onClick={() => onDay(date)}
            >
              <span>{weekdayName}</span>
              <strong>{d}</strong>
              <span>
                {rows.length} turno{rows.length === 1 ? "" : "s"}
              </span>
            </button>
            <div className="week-day-entries">
              {rows.length ? (
                rows.map((booking) => {
                  const srv = services?.find((s) => s.id === booking.serviceId);
                  const pro = professionals?.find((p) => p.id === booking.proId);
                  return (
                    <button
                      key={booking.id}
                      type="button"
                      className={"week-booking " + booking.status}
                      onClick={() => onOpen(booking)}
                    >
                      <span className="week-time">
                        <Clock size={12} />
                        {booking.time}
                      </span>
                      <strong>{booking.client}</strong>
                      <small>{srv?.name || "Servicio"}</small>
                      {pro?.name && (
                        <small className="text-emerald-700 font-medium">
                          con {pro.name}
                        </small>
                      )}
                      <span className={"badge " + booking.status}>
                        {STATUS_LABELS[booking.status] || booking.status}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="week-empty">
                  <span>Sin turnos</span>
                  <div className="flex flex-col gap-1 mt-1">
                    {onSlotClick && (
                      <button
                        type="button"
                        onClick={() => onSlotClick(date)}
                        className="text-xs font-bold text-emerald-800 hover:text-emerald-950 py-1"
                      >
                        + Agendar turno
                      </button>
                    )}
                    <button type="button" onClick={() => onDay(date)}>
                      Ver día <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
