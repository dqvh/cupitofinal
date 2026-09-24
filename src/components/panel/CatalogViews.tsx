import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Copy, Briefcase, UserCheck, ShoppingBag, Ticket, CalendarClock, Lock, Sparkles } from "lucide-react";
import { useStore, isPaid, PRO_LIMIT, PLAN_META, PRO_COLORS, type Service, type Professional, type Product, type Coupon, type DayHours } from "../../lib/store";
import { formatArgentinaPhone } from "../../lib/phone";
import { Avatar, Badge, Button, Callout, Confirm, Empty, Field, Menu, PageHead, Segmented, Sheet, Toggle } from "./ui";
import { usePanel, type View } from "./context";
import HoursEditor, { hoursSummary } from "./HoursEditor";
import { money, shiftKey, todayKey } from "./helpers";
import { validateHours } from "../../lib/scheduling";

export default function CatalogViews({ view }: { view: View }) {
  if (view === "equipo") return <TeamView />;
  if (view === "tienda") return <ShopView />;
  if (view === "cupones") return <CouponsView />;
  return <ServicesView />;
}

/* ---------- plan bloqueado ---------- */

export function Locked({ title, text, plan = "crece" }: { title: string; text: string; plan?: "crece" | "escala" }) {
  const { checkout } = usePanel();
  return (
    <div className="c-card">
      <Empty icon={<Lock />} title={title} text={text}>
        <Button variant="primary" icon={<Sparkles />} onClick={() => checkout(plan)}>Activar plan {PLAN_META[plan].name}</Button>
      </Empty>
    </div>
  );
}

/* ================= SERVICIOS ================= */

const DURATIONS = [15, 30, 45, 60, 90, 120];

function ServiceSheet({ service, onClose }: { service?: Service; onClose: () => void }) {
  const store = useStore();
  const { data } = usePanel();
  const [name, setName] = useState(service?.name || "");
  const [price, setPrice] = useState(service ? String(service.price) : "");
  const [duration, setDuration] = useState(service?.duration || 30);
  const [desc, setDesc] = useState(service?.desc || "");
  const [proDur, setProDur] = useState<Record<string, string>>(() =>
    Object.fromEntries(data.professionals.map((p) => [p.id, service && p.proDurations?.[service.id] !== undefined ? String(p.proDurations[service.id]) : ""]))
  );
  const [showPro, setShowPro] = useState(Object.values(proDur).some(Boolean));
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const p = Number(price.replace(/\./g, "").replace(",", "."));
    if (name.trim().length < 2) return setError("Poné un nombre al servicio.");
    if (!Number.isFinite(p) || p < 0) return setError("Revisá el precio.");
    if (!(duration >= 5 && duration <= 600)) return setError("La duración tiene que estar entre 5 y 600 minutos.");
    const payload = { name: name.trim(), price: Math.round(p), duration: Math.round(duration), desc: desc.trim() || undefined };
    let id = service?.id;
    if (service) store.updateService(service.id, payload);
    else {
      store.addService(payload);
      id = undefined;
    }
    // Duración por profesional (opcional): se guarda en cada profesional.
    const svcId = id || store.getData(store.user!.id).services.slice(-1)[0]?.id;
    if (svcId && data.professionals.length) {
      data.professionals.forEach((pro) => {
        const v = Number(proDur[pro.id]);
        const next = { ...(pro.proDurations || {}) };
        if (showPro && v >= 5) next[svcId] = Math.round(v);
        else delete next[svcId];
        if (JSON.stringify(next) !== JSON.stringify(pro.proDurations || {})) store.updateProfessional(pro.id, { proDurations: next });
      });
    }
    store.toast(service ? "Servicio actualizado" : `“${payload.name}” ya está en tu página`);
    onClose();
  };

  return (
    <Sheet
      onClose={onClose}
      title={service ? "Editar servicio" : "Nuevo servicio"}
      subtitle="Así lo ven tus clientes al reservar."
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" type="submit" form="c-svc">{service ? "Guardar" : "Crear servicio"}</Button></>}
    >
      <form id="c-svc" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Nombre" htmlFor="c-svc-n">
          <input id="c-svc-n" data-autofocus className="c-input" placeholder="Ej: Corte + barba" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </Field>
        <Field label="Duración" hint="Define cuánto lugar ocupa en la agenda.">
          <div className="flex flex-wrap items-center gap-1.5">
            {DURATIONS.map((d) => (
              <button key={d} type="button" className="c-chip" aria-pressed={duration === d} onClick={() => setDuration(d)}>
                {d < 60 ? `${d} min` : d % 60 ? `${Math.floor(d / 60)} h ${d % 60}` : `${d / 60} h`}
              </button>
            ))}
            <span className="flex items-center gap-1.5">
              <input aria-label="Duración en minutos" type="number" min={5} step={5} className="c-input" style={{ width: 84, height: 30 }} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
              <span className="text-[12.5px] text-[var(--text-3)]">min</span>
            </span>
          </div>
        </Field>
        <Field label="Precio" htmlFor="c-svc-p" hint="Poné 0 si es a consultar.">
          <div className="c-input-wrap">
            <span className="pointer-events-none absolute left-3 text-[14px] text-[var(--text-3)]">$</span>
            <input id="c-svc-p" className="c-input" style={{ paddingLeft: 24 }} inputMode="numeric" placeholder="15000" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.,]/g, ""))} />
          </div>
        </Field>
        <Field label="Descripción (opcional)" htmlFor="c-svc-d">
          <textarea id="c-svc-d" className="c-textarea" rows={2} placeholder="Qué incluye, para quién es…" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={160} />
        </Field>
        {data.professionals.length > 0 && (
          <div className="rounded-[var(--r-md)] border border-[var(--line)] p-3">
            <label className="flex items-center justify-between gap-3">
              <span>
                <span className="block text-[13.5px] font-medium">Duración distinta según profesional</span>
                <span className="block text-[12px] text-[var(--text-3)]">Si alguien lo hace más rápido o más lento</span>
              </span>
              <Toggle checked={showPro} onChange={setShowPro} label="Duración por profesional" />
            </label>
            {showPro && (
              <div className="mt-3 space-y-2">
                {data.professionals.map((p) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                    <span className="flex-1 text-[13px]">{p.name}</span>
                    <input aria-label={`Duración para ${p.name}`} type="number" min={5} step={5} className="c-input" style={{ width: 90, height: 32 }} placeholder={String(duration)} value={proDur[p.id] || ""} onChange={(e) => setProDur({ ...proDur, [p.id]: e.target.value })} />
                    <span className="text-[12px] text-[var(--text-3)]">min</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {error && <p className="c-error" role="alert">{error}</p>}
      </form>
    </Sheet>
  );
}

function ServicesView() {
  const store = useStore();
  const { data, user, params, setParams } = usePanel();
  const [edit, setEdit] = useState<{ service?: Service } | null>(params.get("nuevo") === "1" ? {} : null);
  const [del, setDel] = useState<Service | null>(null);
  useEffect(() => { if (params.get("nuevo")) setParams({ nuevo: undefined }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const services = data.services.filter((s) => !s.archived);
  const from = shiftKey(todayKey(), -30);
  const usage = useMemo(() => {
    const m = new Map<string, number>();
    data.bookings.forEach((b) => b.status !== "cancelada" && b.date >= from && [b.serviceId, ...(b.extraServiceIds || [])].forEach((id) => m.set(id, (m.get(id) || 0) + 1)));
    return m;
  }, [data.bookings, from]);
  const future = (id: string) => data.bookings.filter((b) => (b.serviceId === id || (b.extraServiceIds || []).includes(id)) && b.date >= todayKey() && b.status !== "cancelada").length;

  return (
    <div>
      <PageHead
        title="Servicios"
        sub={<>Lo que ofrecés, cuánto dura y cuánto cuesta. Se publica al instante en <a className="underline" href={`/${user.slug}`} target="_blank" rel="noreferrer">cupito.app/{user.slug}</a></>}
        actions={<Button variant="primary" icon={<Plus />} onClick={() => setEdit({})}>Nuevo servicio</Button>}
      />
      {services.length === 0 ? (
        <div className="c-card">
          <Empty icon={<Briefcase />} title="Todavía no cargaste servicios" text="Es lo primero que ven tus clientes. Con nombre, duración y precio alcanza.">
            <Button variant="primary" icon={<Plus />} onClick={() => setEdit({})}>Crear el primero</Button>
          </Empty>
        </div>
      ) : (
        <div className="c-card c-divide overflow-hidden">
          {services.map((s, i) => (
            <div key={s.id} className="c-list-row">
              <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setEdit({ service: s })}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{s.name}</span>
                  <span className="block truncate text-[12.5px] text-[var(--text-3)]">
                    {s.duration} min{data.professionals.some((p) => p.proDurations?.[s.id] !== undefined) ? " (varía por profesional)" : ""}
                    {s.desc ? ` · ${s.desc}` : ""}
                  </span>
                </span>
                <span className="hidden text-[12.5px] text-[var(--text-3)] sm:block">{usage.get(s.id) || 0} en 30 días</span>
                <span className="w-24 text-right text-[14px] font-semibold tnum">{s.price ? money(s.price) : "A consultar"}</span>
              </button>
              <Menu
                items={[
                  { label: "Editar", icon: <Pencil />, onSelect: () => setEdit({ service: s }) },
                  { label: "Duplicar", icon: <Copy />, onSelect: () => { store.addService({ name: `${s.name} (copia)`, price: s.price, duration: s.duration, desc: s.desc }); store.toast("Servicio duplicado"); } },
                  { label: "Subir", icon: <ArrowUp />, onSelect: () => store.moveService(s.id, -1), hidden: i === 0 },
                  { label: "Bajar", icon: <ArrowDown />, onSelect: () => store.moveService(s.id, 1), hidden: i === services.length - 1 },
                  { separator: true, label: "s" },
                  { label: "Eliminar", icon: <Trash2 />, danger: true, onSelect: () => setDel(s) },
                ]}
              />
            </div>
          ))}
        </div>
      )}
      {services.length > 1 && <p className="mt-2 px-1 text-[12px] text-[var(--text-3)]">El orden es el mismo que ven tus clientes. Usá “Subir” y “Bajar” desde el menú de cada servicio.</p>}
      {edit && <ServiceSheet service={edit.service} onClose={() => setEdit(null)} />}
      {del && (
        <Confirm
          title={`¿Eliminar “${del.name}”?`}
          text={future(del.id) ? `Tiene ${future(del.id)} turno(s) próximos: se mantienen, pero nadie más va a poder reservarlo.` : "Deja de aparecer en tu página. El historial de turnos se conserva."}
          confirmLabel="Eliminar"
          danger
          onConfirm={() => { store.removeService(del.id); store.toast(`“${del.name}” eliminado`, "ok", { label: "Deshacer", onClick: () => store.updateService(del.id, { archived: false }) }, 6000); }}
          onClose={() => setDel(null)}
        />
      )}
    </div>
  );
}

/* ================= EQUIPO ================= */

function ProSheet({ pro, onClose }: { pro?: Professional; onClose: () => void }) {
  const store = useStore();
  const { data } = usePanel();
  const [name, setName] = useState(pro?.name || "");
  const [role, setRole] = useState(pro?.role || "");
  const [phone, setPhone] = useState(pro?.phone || "");
  const [color, setColor] = useState(pro?.color || PRO_COLORS[data.professionals.length % PRO_COLORS.length]);
  const [mode, setMode] = useState<"local" | "propio">(pro?.hours?.length === 7 ? "propio" : "local");
  const [hours, setHours] = useState<DayHours[]>(() => (pro?.hours?.length === 7 ? pro.hours : data.settings.hours).map((h) => ({ ...h })));
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError("Poné un nombre.");
    if (mode === "propio") {
      const err = validateHours(hours);
      if (err) return setError(err);
    }
    const h = mode === "propio" ? hours : undefined;
    if (pro) {
      store.updateProfessional(pro.id, { name: name.trim(), role: role.trim() || "Profesional", phone: phone.replace(/\D/g, ""), color, hours: h });
      store.toast(`${name.trim()} actualizado`);
    } else {
      const err = store.addProfessional(name, role, h, phone);
      if (err) return setError(err);
      const created = store.getData(store.user!.id).professionals.slice(-1)[0];
      if (created && created.color !== color) store.updateProfessional(created.id, { color });
      store.toast(`${name.trim()} se sumó al equipo`);
    }
    onClose();
  };

  return (
    <Sheet
      onClose={onClose}
      size="wide"
      title={pro ? `Editar a ${pro.name}` : "Nuevo profesional"}
      subtitle="Cada profesional tiene su columna en la agenda y tus clientes pueden elegirlo."
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" type="submit" form="c-pro">{pro ? "Guardar" : "Agregar al equipo"}</Button></>}
    >
      <form id="c-pro" onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre" htmlFor="c-pro-n"><input id="c-pro-n" data-autofocus className="c-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Caro Méndez" /></Field>
          <Field label="Especialidad" htmlFor="c-pro-r"><input id="c-pro-r" className="c-input" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Ej: Colorista" /></Field>
          <Field label="WhatsApp" htmlFor="c-pro-p" hint="Para mandarle su calendario al celular."><input id="c-pro-p" className="c-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="11 5555 1234" /></Field>
          <Field label="Color en la agenda">
            <div className="flex flex-wrap gap-1.5">
              {PRO_COLORS.map((c) => (
                <button key={c} type="button" aria-label={`Color ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} className="h-7 w-7 rounded-full" style={{ background: c, boxShadow: color === c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : undefined }} />
              ))}
            </div>
          </Field>
        </div>
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="c-label">Horario de trabajo</p>
            <Segmented value={mode} onChange={setMode} options={[{ value: "local", label: "El del local" }, { value: "propio", label: "Propio" }]} />
          </div>
          {mode === "local" ? (
            <p className="rounded-[var(--r-md)] bg-[var(--surface-2)] px-3 py-2.5 text-[13px] text-[var(--text-2)]">{hoursSummary(data.settings.hours)}</p>
          ) : (
            <HoursEditor hours={hours} onChange={setHours} compact />
          )}
        </div>
        {error && <p className="c-error" role="alert">{error}</p>}
      </form>
    </Sheet>
  );
}

function TeamView() {
  const store = useStore();
  const { data, user, openCalendarSync, checkout } = usePanel();
  const [edit, setEdit] = useState<{ pro?: Professional } | null>(null);
  const [del, setDel] = useState<Professional | null>(null);
  const limit = PRO_LIMIT[user.plan];
  const full = data.professionals.length >= limit;
  const today = todayKey();

  return (
    <div>
      <PageHead
        title="Equipo"
        sub={`Tu plan ${PLAN_META[user.plan].name} incluye ${limit === 1 ? "1 profesional" : `hasta ${limit} profesionales`} · usás ${data.professionals.length}`}
        actions={<Button variant="primary" icon={<Plus />} disabled={full} onClick={() => setEdit({})}>Agregar profesional</Button>}
      />
      {full && user.plan !== "escala" && (
        <Callout tone="info" icon={<Sparkles />} className="mb-3">
          Llegaste al máximo de tu plan. <button type="button" className="font-medium underline" onClick={() => checkout(user.plan === "semilla" ? "crece" : "escala")}>Subí de plan</button> para sumar más gente.
        </Callout>
      )}
      {data.professionals.length === 0 ? (
        <div className="c-card">
          <Empty icon={<UserCheck />} title="Trabajás solo/a por ahora" text="Si atienden varias personas, agregalas: cada una tiene su agenda, sus horarios y tus clientes eligen con quién.">
            <Button variant="primary" icon={<Plus />} onClick={() => setEdit({})} disabled={full}>Agregar profesional</Button>
          </Empty>
        </div>
      ) : (
        <div className="c-card c-divide overflow-hidden">
          {data.professionals.map((p) => {
            const upcoming = data.bookings.filter((b) => b.proId === p.id && b.date >= today && b.status !== "cancelada").length;
            return (
              <div key={p.id} className="c-list-row">
                <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setEdit({ pro: p })}>
                  <Avatar name={p.name} color={p.color} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{p.name} <span className="font-normal text-[var(--text-3)]">· {p.role}</span></span>
                    <span className="block truncate text-[12.5px] text-[var(--text-3)]">{p.hours?.length === 7 ? hoursSummary(p.hours) : "Horario del local"}{p.phone ? ` · ${formatArgentinaPhone(p.phone)}` : ""}</span>
                  </span>
                  <Badge className="hidden sm:inline-flex">{upcoming} próximos</Badge>
                </button>
                <Menu
                  items={[
                    { label: "Editar datos y horario", icon: <Pencil />, onSelect: () => setEdit({ pro: p }) },
                    { label: "Calendario en su celular", icon: <CalendarClock />, onSelect: () => openCalendarSync(p.id) },
                    { separator: true, label: "s" },
                    { label: "Quitar del equipo", icon: <Trash2 />, danger: true, onSelect: () => setDel(p) },
                  ]}
                />
              </div>
            );
          })}
        </div>
      )}
      {edit && <ProSheet pro={edit.pro} onClose={() => setEdit(null)} />}
      {del && (
        <Confirm
          title={`¿Quitar a ${del.name}?`}
          text={(() => {
            const n = data.bookings.filter((b) => b.proId === del.id && b.date >= today && b.status !== "cancelada").length;
            return n ? `Tiene ${n} turno(s) próximos que van a quedar “sin asignar”. Podés reasignarlos desde la agenda.` : "Deja de aparecer en tu página y en la agenda.";
          })()}
          confirmLabel="Quitar"
          danger
          onConfirm={() => { store.removeProfessional(del.id); store.toast(`${del.name} salió del equipo`, "ok"); }}
          onClose={() => setDel(null)}
        />
      )}
    </div>
  );
}

/* ================= TIENDA ================= */

function ProductSheet({ product, onClose }: { product?: Product; onClose: () => void }) {
  const store = useStore();
  const [name, setName] = useState(product?.name || "");
  const [desc, setDesc] = useState(product?.desc || "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [error, setError] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const p = Number(price);
    if (name.trim().length < 2) return setError("Poné un nombre.");
    if (!(p > 0)) return setError("El precio tiene que ser mayor a 0.");
    if (product) store.updateProduct(product.id, { name: name.trim(), desc: desc.trim(), price: p });
    else store.addProduct({ name: name.trim(), desc: desc.trim(), price: p });
    store.toast(product ? "Producto actualizado" : `“${name.trim()}” agregado a la tienda`);
    onClose();
  };
  return (
    <Sheet onClose={onClose} side="center" title={product ? "Editar producto" : "Nuevo producto"} footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" type="submit" form="c-prod">Guardar</Button></>}>
      <form id="c-prod" onSubmit={submit} className="space-y-3" noValidate>
        <Field label="Nombre" htmlFor="c-pr-n"><input id="c-pr-n" data-autofocus className="c-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Cera mate" /></Field>
        <Field label="Descripción" htmlFor="c-pr-d"><input id="c-pr-d" className="c-input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Opcional" /></Field>
        <Field label="Precio" htmlFor="c-pr-p"><input id="c-pr-p" className="c-input" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} placeholder="8000" /></Field>
        {error && <p className="c-error" role="alert">{error}</p>}
      </form>
    </Sheet>
  );
}

function ShopView() {
  const store = useStore();
  const { data, user } = usePanel();
  const [edit, setEdit] = useState<{ product?: Product } | null>(null);
  if (!isPaid(user)) return (<><PageHead title="Tienda" /><Locked title="Vendé productos al reservar" text="Tus clientes suman productos a su turno y los retiran en el local. Incluido en el plan Crece." /></>);
  const sold = (id: string) => data.bookings.filter((b) => b.status !== "cancelada").reduce((a, b) => a + (b.items || []).filter((it) => it.productId === id).reduce((x, it) => x + it.qty, 0), 0);
  return (
    <div>
      <PageHead title="Tienda" sub="Productos que el cliente puede sumar a su reserva y retirar en el local." actions={<Button variant="primary" icon={<Plus />} onClick={() => setEdit({})}>Nuevo producto</Button>} />
      {data.products.length === 0 ? (
        <div className="c-card"><Empty icon={<ShoppingBag />} title="No hay productos" text="Sumá los que vendés en el local: aparecen como opcionales al final de la reserva."><Button variant="primary" icon={<Plus />} onClick={() => setEdit({})}>Agregar producto</Button></Empty></div>
      ) : (
        <div className="c-card c-divide overflow-hidden">
          {data.products.map((p) => (
            <div key={p.id} className="c-list-row">
              <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setEdit({ product: p })}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{p.name}</span>
                  <span className="block truncate text-[12.5px] text-[var(--text-3)]">{p.desc || "Sin descripción"} · {sold(p.id)} vendidos</span>
                </span>
                <span className="text-[14px] font-semibold tnum">{money(p.price)}</span>
              </button>
              <Menu items={[{ label: "Editar", icon: <Pencil />, onSelect: () => setEdit({ product: p }) }, { label: "Eliminar", icon: <Trash2 />, danger: true, onSelect: () => { store.removeProduct(p.id); store.toast(`“${p.name}” eliminado`, "ok", { label: "Deshacer", onClick: () => store.addProduct({ name: p.name, desc: p.desc, price: p.price }) }, 6000); } }]} />
            </div>
          ))}
        </div>
      )}
      {edit && <ProductSheet product={edit.product} onClose={() => setEdit(null)} />}
    </div>
  );
}

/* ================= CUPONES ================= */

function CouponsView() {
  const store = useStore();
  const { data, user } = usePanel();
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [pct, setPct] = useState(10);
  const [error, setError] = useState<string | null>(null);
  if (!isPaid(user)) return (<><PageHead title="Cupones" /><Locked title="Llená los horarios flojos con descuentos" text="Creá códigos para tus historias o WhatsApp. Se aplican solos al reservar, incluso en la seña. Incluido en el plan Crece." /></>);
  const create = (e: FormEvent) => {
    e.preventDefault();
    const err = store.addCoupon({ code, pct });
    if (err) return setError(err);
    store.toast(`Cupón ${code.trim().toUpperCase()} creado`);
    setCreating(false);
    setCode("");
  };
  return (
    <div>
      <PageHead title="Cupones" sub={`Tus clientes los ingresan al reservar en cupito.app/${user.slug}.`} actions={<Button variant="primary" icon={<Plus />} onClick={() => { setError(null); setCreating(true); }}>Nuevo cupón</Button>} />
      {data.coupons.length === 0 ? (
        <div className="c-card"><Empty icon={<Ticket />} title="No hay cupones" text="Ideal para los martes flojos o para premiar a tus clientes frecuentes." /></div>
      ) : (
        <div className="c-card c-divide overflow-hidden">
          {data.coupons.map((c: Coupon) => (
            <div key={c.id} className="c-list-row">
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold tracking-wide">{c.code}</span>
                <span className="block text-[12.5px] text-[var(--text-3)]">{c.pct}% de descuento · {c.active ? "activo" : "pausado"}</span>
              </span>
              <Toggle checked={c.active} onChange={(v) => { store.updateCoupon(c.id, { active: v }); store.toast(v ? `Cupón ${c.code} activado` : `Cupón ${c.code} pausado`); }} label={`Activar cupón ${c.code}`} />
              <Menu items={[{ label: "Copiar código", icon: <Copy />, onSelect: () => navigator.clipboard?.writeText(c.code).then(() => store.toast("Código copiado")) }, { label: "Eliminar", icon: <Trash2 />, danger: true, onSelect: () => { store.removeCoupon(c.id); store.toast(`Cupón ${c.code} eliminado`); } }]} />
            </div>
          ))}
        </div>
      )}
      {creating && (
        <Sheet side="center" size="narrow" onClose={() => setCreating(false)} title="Nuevo cupón" footer={<><Button onClick={() => setCreating(false)}>Cancelar</Button><Button variant="primary" type="submit" form="c-cp">Crear cupón</Button></>}>
          <form id="c-cp" onSubmit={create} className="space-y-3">
            <Field label="Código" htmlFor="c-cp-c" hint="Sin espacios. Ej: MARTES20"><input id="c-cp-c" data-autofocus className="c-input uppercase" value={code} onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))} maxLength={20} /></Field>
            <Field label={`Descuento: ${pct}%`}>
              <div className="flex flex-wrap gap-1.5">
                {[10, 15, 20, 25, 30, 50].map((v) => <button key={v} type="button" className="c-chip" aria-pressed={pct === v} onClick={() => setPct(v)}>{v}%</button>)}
              </div>
            </Field>
            {error && <p className="c-error" role="alert">{error}</p>}
          </form>
        </Sheet>
      )}
    </div>
  );
}
