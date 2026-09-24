import { useEffect, useMemo, useState } from "react";
import { Search, X, Users, Download, MessageCircle, Phone, Plus, ChevronRight, Mail, CalendarDays } from "lucide-react";
import { useStore } from "../../lib/store";
import { formatArgentinaPhone } from "../../lib/phone";
import { Avatar, Badge, Button, Empty, Field, PageHead, Sheet, StatusBadge } from "./ui";
import { usePanel } from "./context";
import { buildClients, dayLabel, downloadCsv, hasPhone, money, relTime, serviceLabel, shiftKey, todayKey, waLink, waMessage, type Client } from "./helpers";

type Seg = "todos" | "frecuentes" | "nuevos" | "inactivos" | "riesgo";
type Sort = "recientes" | "visitas" | "nombre" | "gasto";

const SEGS: { id: Seg; label: string; hint: string }[] = [
  { id: "todos", label: "Todos", hint: "" },
  { id: "frecuentes", label: "Frecuentes", hint: "3 visitas o más" },
  { id: "nuevos", label: "Nuevos", hint: "Primer turno en los últimos 30 días" },
  { id: "inactivos", label: "Para recuperar", hint: "Sin venir hace más de 60 días y sin turno" },
  { id: "riesgo", label: "Con ausencias", hint: "Faltaron sin avisar al menos una vez" },
];

export default function ClientsView() {
  const store = useStore();
  const { data, user, openClient, params, setParams } = usePanel();
  const clients = useMemo(() => buildClients(data), [data]);
  const [q, setQ] = useState("");
  const seg = (params.get("seg") as Seg) || "todos";
  const [sort, setSort] = useState<Sort>("recientes");
  const [limit, setLimit] = useState(80);
  const today = todayKey();
  const d30 = shiftKey(today, -30);
  const d60 = shiftKey(today, -60);

  const inSeg = (c: Client, s: Seg) => {
    if (s === "frecuentes") return c.visits >= 3;
    if (s === "nuevos") return c.firstDate >= d30;
    if (s === "inactivos") return !c.nextBooking && !!c.lastVisit && c.lastVisit < d60;
    if (s === "riesgo") return c.noShows > 0;
    return true;
  };

  const list = useMemo(() => {
    const nq = q.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return clients
      .filter((c) => inSeg(c, seg))
      .filter((c) => !nq || c.name.toLowerCase().includes(nq) || (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits)))
      .sort((a, b) => {
        if (sort === "visitas") return b.visits - a.visits || b.total - a.total;
        if (sort === "nombre") return a.name.localeCompare(b.name, "es");
        if (sort === "gasto") return b.spent - a.spent;
        const la = a.bookings[a.bookings.length - 1];
        const lb = b.bookings[b.bookings.length - 1];
        return (lb.date + lb.time).localeCompare(la.date + la.time);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, q, seg, sort]);

  const exportCsv = () => {
    downloadCsv(`clientes-${user.slug}-${today}`, ["Nombre", "Teléfono", "Email", "Turnos", "Visitas", "Cancelaciones", "Ausencias", "Gastado", "Última visita", "Próximo turno", "Servicio favorito", "Nota"], list.map((c) => [
      c.name, c.phone, c.email || "", c.total, c.visits, c.cancelled, c.noShows, c.spent, c.lastVisit || "", c.nextBooking ? `${c.nextBooking.date} ${c.nextBooking.time}` : "", c.favorite || "", data.settings.clientNotes?.[c.phone.replace(/\D/g, "")] || "",
    ]));
    store.toast(`${list.length} clientes exportados`);
  };

  return (
    <div>
      <PageHead
        title="Clientes"
        sub={`${clients.length} cliente${clients.length === 1 ? "" : "s"} · se crean solos con cada reserva`}
        actions={<Button icon={<Download />} onClick={exportCsv} disabled={!list.length} className="hidden sm:inline-flex">Exportar</Button>}
      />
      <div className="mb-3 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="c-input-wrap min-w-[200px] flex-1 sm:max-w-sm">
            <Search />
            <input className="c-input" placeholder="Buscar por nombre o teléfono" aria-label="Buscar clientes" value={q} onChange={(e) => setQ(e.target.value)} />
            {q && (
              <button type="button" className="c-input-suffix grid h-6 w-6 place-items-center rounded text-[var(--text-3)] hover:bg-[var(--surface-3)]" onClick={() => setQ("")} aria-label="Borrar búsqueda">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <select className="c-select" style={{ width: "auto", height: 32, fontSize: 13 }} aria-label="Ordenar" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="recientes">Más recientes</option>
            <option value="visitas">Más visitas</option>
            <option value="gasto">Mayor gasto</option>
            <option value="nombre">Nombre (A–Z)</option>
          </select>
        </div>
        <div className="c-chip-row" role="group" aria-label="Segmento">
          {SEGS.map((s) => (
            <button key={s.id} type="button" className="c-chip" aria-pressed={seg === s.id} onClick={() => setParams({ seg: s.id === "todos" ? undefined : s.id })} title={s.hint}>
              {s.label}
              <span className="c-chip-count">{clients.filter((c) => inSeg(c, s.id)).length}</span>
            </button>
          ))}
        </div>
        {seg !== "todos" && <p className="text-[12.5px] text-[var(--text-3)]">{SEGS.find((s) => s.id === seg)?.hint}{seg === "inactivos" ? ". Escribiles para que vuelvan: un mensaje simple recupera turnos." : ""}</p>}
      </div>

      {list.length === 0 ? (
        <div className="c-card">
          <Empty icon={<Users />} title={q ? `No hay clientes que coincidan con “${q}”` : clients.length ? "No hay clientes en este grupo" : "Todavía no tenés clientes"} text={clients.length ? undefined : "Cada vez que alguien reserva (o cargás un turno), su ficha se crea sola con el historial."} />
        </div>
      ) : (
        <div className="c-card overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,1.6fr)_90px_120px_minmax(0,1fr)_100px] gap-3 border-b border-[var(--line)] bg-[var(--surface-2)] px-4 py-2 text-[11.5px] font-medium text-[var(--text-3)] md:grid">
            <span>Cliente</span><span className="text-right">Visitas</span><span>Última visita</span><span>Próximo turno</span><span className="text-right">Gastado</span>
          </div>
          <div className="c-divide">
            {list.slice(0, limit).map((c) => (
              <button key={c.key} type="button" className="c-list-row md:grid md:grid-cols-[minmax(0,1.6fr)_90px_120px_minmax(0,1fr)_100px] md:gap-3" onClick={() => openClient(c.key)}>
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={c.name} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[13.5px] font-medium">{c.name}</span>
                      {c.visits >= 5 && <Badge tone="brand">Frecuente</Badge>}
                      {c.noShows > 0 && <Badge tone="warn">{c.noShows} ausencia{c.noShows === 1 ? "" : "s"}</Badge>}
                    </span>
                    <span className="block truncate text-[12px] text-[var(--text-3)]">
                      {c.phone ? formatArgentinaPhone(c.phone) : "Sin teléfono"}
                      <span className="md:hidden"> · {c.visits} visita{c.visits === 1 ? "" : "s"}{c.nextBooking ? ` · próximo ${dayLabel(c.nextBooking.date).toLowerCase()}` : ""}</span>
                    </span>
                  </span>
                </span>
                <span className="hidden text-right text-[13px] tnum md:block">{c.visits}</span>
                <span className="hidden text-[13px] text-[var(--text-2)] md:block">{c.lastVisit ? dayLabel(c.lastVisit) : "—"}</span>
                <span className="hidden truncate text-[13px] md:block">{c.nextBooking ? `${dayLabel(c.nextBooking.date)} ${c.nextBooking.time}` : <span className="text-[var(--text-3)]">—</span>}</span>
                <span className="hidden text-right text-[13px] tnum md:block">{money(c.spent)}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-3)] md:hidden" />
              </button>
            ))}
          </div>
          {list.length > limit && (
            <div className="border-t border-[var(--line)] p-2 text-center">
              <Button variant="ghost" onClick={() => setLimit((l) => l + 80)}>Ver más ({list.length - limit})</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- ficha del cliente ---------- */

export function ClientDrawer({ clientKey, onClose }: { clientKey: string; onClose: () => void }) {
  const store = useStore();
  const { data, user, openBooking, newBooking } = usePanel();
  const c = useMemo(() => buildClients(data).find((x) => x.key === clientKey), [data, clientKey]);
  const noteKey = (c?.phone || "").replace(/\D/g, "");
  const saved = noteKey ? data.settings.clientNotes?.[noteKey] || "" : "";
  const [note, setNote] = useState(saved);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(c?.name || "");
  const [phone, setPhone] = useState(c?.phone || "");
  useEffect(() => setNote(saved), [saved]);

  if (!c) {
    return (
      <Sheet onClose={onClose} title="Cliente no encontrado">
        <p className="text-[13.5px] text-[var(--text-2)]">Puede que se hayan eliminado sus turnos.</p>
      </Sheet>
    );
  }
  const history = [...c.bookings].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const upcoming = history.filter((b) => (b.status === "pendiente" || b.status === "confirmada") && b.date >= todayKey()).reverse();
  const past = history.filter((b) => !upcoming.includes(b));

  const saveNote = () => {
    if (!noteKey || note.trim() === saved) return;
    store.saveClientNote(noteKey, note);
    store.toast("Nota guardada");
  };
  const saveEdit = () => {
    if (name.trim().length < 2) return;
    c.bookings.forEach((b) => store.updateBooking(b.id, { client: name.trim(), phone: phone.trim() }));
    if (noteKey && saved && phone.replace(/\D/g, "") !== noteKey) store.saveClientNote(phone, saved);
    store.toast("Datos del cliente actualizados en todos sus turnos");
    setEditing(false);
  };

  return (
    <Sheet
      onClose={onClose}
      title={
        <span className="flex items-center gap-2.5">
          <Avatar name={c.name} size="lg" />
          <span className="min-w-0">
            <span className="block truncate">{c.name}</span>
            <span className="block text-[12.5px] font-normal text-[var(--text-3)]">Cliente desde {dayLabel(c.firstDate).toLowerCase()}</span>
          </span>
        </span>
      }
      headerExtra={<Button size="sm" variant="ghost" onClick={() => { setName(c.name); setPhone(c.phone); setEditing(true); }}>Editar</Button>}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon={<Plus />} onClick={() => newBooking({ client: c.name, phone: c.phone, serviceId: c.bookings[c.bookings.length - 1]?.serviceId })}>Nuevo turno</Button>
          {hasPhone(c.phone) && (
            <>
              <a className="c-btn c-btn--soft" href={waLink(c.phone, waMessage("libre", { business: user.business, name: c.name }))} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a>
              <a className="c-btn c-btn--secondary" href={`tel:${c.phone.replace(/[^+\d]/g, "")}`}><Phone /> Llamar</a>
            </>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--line)] sm:grid-cols-4">
          {[
            ["Visitas", String(c.visits)],
            ["Gastado", money(c.spent)],
            ["Cancelaciones", String(c.cancelled)],
            ["No vino", String(c.noShows)],
          ].map(([k, v]) => (
            <div key={k} className="bg-[var(--surface)] px-3 py-2.5">
              <dt className="text-[11.5px] text-[var(--text-3)]">{k}</dt>
              <dd className="text-[17px] font-semibold tnum">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="space-y-1 text-[13px] text-[var(--text-2)]">
          <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-[var(--text-3)]" />{c.phone ? formatArgentinaPhone(c.phone) : "Sin teléfono"}</p>
          {c.email && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-[var(--text-3)]" />{c.email}</p>}
          {c.favorite && <p className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 text-[var(--text-3)]" />Suele pedir {c.favorite}{c.lastVisit ? ` · última visita ${dayLabel(c.lastVisit).toLowerCase()}` : ""}</p>}
        </div>

        {noteKey ? (
          <Field label="Nota privada" hint="Preferencias, alergias, cómo le gusta el corte… Solo la ves vos." htmlFor="c-cnote">
            <textarea id="c-cnote" className="c-textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} onBlur={saveNote} maxLength={800} />
          </Field>
        ) : (
          <p className="text-[12.5px] text-[var(--text-3)]">Agregale un teléfono para guardar notas privadas.</p>
        )}

        {upcoming.length > 0 && (
          <section>
            <p className="c-eyebrow mb-1.5">Próximos turnos</p>
            <div className="c-card c-divide overflow-hidden">
              {upcoming.map((b) => (
                <button key={b.id} type="button" className="c-list-row" onClick={() => openBooking(b.id)}>
                  <span className="w-24 shrink-0 text-[13px] font-medium">{dayLabel(b.date)} <span className="tnum">{b.time}</span></span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-2)]">{serviceLabel(data, b)}</span>
                  <StatusBadge status={b.status} />
                </button>
              ))}
            </div>
          </section>
        )}

        <section>
          <p className="c-eyebrow mb-1.5">Historial ({past.length})</p>
          {past.length === 0 ? (
            <p className="text-[13px] text-[var(--text-3)]">Todavía no tiene turnos pasados.</p>
          ) : (
            <div className="c-card c-divide overflow-hidden">
              {past.slice(0, 40).map((b) => (
                <button key={b.id} type="button" className="c-list-row" onClick={() => openBooking(b.id)}>
                  <span className="w-24 shrink-0 text-[13px] text-[var(--text-2)]">{new Date(b.date + "T12:00").toLocaleDateString("es-AR", { day: "numeric", month: "short", year: b.date.slice(0, 4) !== todayKey().slice(0, 4) ? "2-digit" : undefined })}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px]">{serviceLabel(data, b)}</span>
                  <StatusBadge status={b.status} />
                </button>
              ))}
            </div>
          )}
        </section>
        {c.bookings.some((b) => b.createdAt) && <p className="text-[12px] text-[var(--text-3)]">Última reserva creada {relTime(Math.max(...c.bookings.map((b) => b.createdAt || 0)))}.</p>}
      </div>

      {editing && (
        <Sheet side="center" size="narrow" onClose={() => setEditing(false)} title="Editar cliente" footer={<><Button onClick={() => setEditing(false)}>Cancelar</Button><Button variant="primary" onClick={saveEdit}>Guardar</Button></>}>
          <div className="space-y-3">
            <Field label="Nombre" htmlFor="c-cl-n"><input id="c-cl-n" data-autofocus className="c-input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Celular" htmlFor="c-cl-p" hint="Se actualiza en todos sus turnos."><input id="c-cl-p" className="c-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          </div>
        </Sheet>
      )}
    </Sheet>
  );
}
