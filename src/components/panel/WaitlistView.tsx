import { useMemo } from "react";
import { Hourglass, MessageCircle, Trash2, CalendarPlus, Star } from "lucide-react";
import { useStore, sortWaitlist, isRecurrentClient } from "../../lib/store";
import { slotsFor } from "../../lib/availability";
import { formatArgentinaPhone } from "../../lib/phone";
import { Badge, Button, Callout, Empty, IconButton, PageHead } from "./ui";
import { usePanel } from "./context";
import { dayLabel, hasPhone, nowHHMM, relTime, todayKey, waLink, waMessage } from "./helpers";

export default function WaitlistView() {
  const store = useStore();
  const { data, user, newBooking, checkout } = usePanel();
  const today = todayKey();
  const sorted = useMemo(() => sortWaitlist(data.waitlist, data.bookings, user.plan).sort((a, b) => a.date.localeCompare(b.date)), [data.waitlist, data.bookings, user.plan]);
  const groups = useMemo(() => {
    const m = new Map<string, typeof sorted>();
    sorted.forEach((w) => m.set(w.date, [...(m.get(w.date) || []), w]));
    return [...m.entries()];
  }, [sorted]);

  const freeOn = (date: string, serviceId: string) => {
    if (date < today || !data.services.some((s) => s.id === serviceId)) return [];
    return slotsFor(data, { date, serviceIds: [serviceId] }).filter((s) => s.free && (date !== today || s.time > nowHHMM()));
  };

  return (
    <div>
      <PageHead title="Lista de espera" sub="Clientes que querían un día sin lugar. Cuando se libera un horario, ofrecéselo con un toque." />
      {user.plan !== "escala" && data.waitlist.length > 2 && (
        <Callout tone="info" icon={<Star />} className="mb-3">
          En el plan Escala la lista se ordena sola: tus clientes recurrentes primero.{" "}
          <button type="button" className="font-medium underline" onClick={() => checkout("escala")}>Ver Escala</button>
        </Callout>
      )}
      {groups.length === 0 ? (
        <div className="c-card">
          <Empty icon={<Hourglass />} title="Nadie en espera" text="Cuando un cliente no encuentre lugar en tu página, puede anotarse para un día y te aparece acá con su teléfono." />
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(([date, list]) => (
            <section key={date}>
              <div className="mb-1.5 flex items-baseline justify-between px-1">
                <h2 className="text-[13px] font-semibold">{dayLabel(date, { long: true })}</h2>
                <span className="text-[12px] text-[var(--text-3)]">{date < today ? "Ya pasó" : `${list.length} esperando`}</span>
              </div>
              <div className="c-card c-divide overflow-hidden">
                {list.map((w) => {
                  const svc = data.services.find((s) => s.id === w.serviceId);
                  const free = freeOn(w.date, w.serviceId);
                  const first = free[0];
                  return (
                    <div key={w.id} className="c-list-row flex-wrap sm:flex-nowrap">
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-medium">
                          {w.client}
                          {user.plan === "escala" && isRecurrentClient(w, data.bookings) && <Badge tone="brand">Recurrente</Badge>}
                        </p>
                        <p className="truncate text-[12px] text-[var(--text-3)]">
                          {formatArgentinaPhone(w.phone)} · {svc?.name || "Servicio"} · se anotó {relTime(w.createdAt)}
                        </p>
                        {date >= today && (
                          <p className={`mt-0.5 text-[12px] ${free.length ? "text-[var(--brand)]" : "text-[var(--text-3)]"}`}>
                            {free.length ? `${free.length} horario${free.length === 1 ? "" : "s"} libre${free.length === 1 ? "" : "s"} ese día · desde las ${first.time}` : "Ese día sigue completo"}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {hasPhone(w.phone) && first && (
                          <a className="c-btn c-btn--secondary c-btn--sm" href={waLink(w.phone, waMessage("hueco", { business: user.business, name: w.client, date: w.date, time: first.time }))} target="_blank" rel="noreferrer">
                            <MessageCircle /> Ofrecer {first.time}
                          </a>
                        )}
                        <Button size="sm" variant="primary" icon={<CalendarPlus />} onClick={() => newBooking({ client: w.client, phone: w.phone, serviceId: w.serviceId, date: w.date >= today ? w.date : today, time: first?.time, waitlistId: w.id })}>
                          Dar turno
                        </Button>
                        <IconButton
                          label={`Quitar a ${w.client} de la lista`}
                          size="sm"
                          onClick={() => {
                            store.removeWaitlist(w.id);
                            store.toast(`${w.client} salió de la lista de espera`, "ok");
                          }}
                        >
                          <Trash2 />
                        </IconButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
