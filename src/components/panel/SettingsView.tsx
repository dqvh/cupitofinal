import { useEffect, useState, type ReactNode } from "react";
import { Store, CalendarCheck, CreditCard, Bell, Palette, Sparkles, UserRound, Save, Check, ExternalLink, LogOut, Trash2, CalendarClock, Smartphone, AlertTriangle } from "lucide-react";
import { useStore, isPaid, isDemoUser, PLAN_META, SEMILLA_MONTHLY_LIMIT, monthBookingCount, getSubscriptionStatus, fmtDateHuman, type Plan, type BizSettings } from "../../lib/store";
import { PLAN_FEATURES } from "../../lib/plans";
import { validateTransfer } from "../../lib/scheduling";
import { THEME_OPTIONS, BRAND_SWATCHES, themeAccent, contrastText } from "../../lib/theme";
import { Badge, Button, Callout, Card, Confirm, Field, PageHead, Segmented, Toggle } from "./ui";
import { usePanel, type SettingsTab } from "./context";
import { Locked } from "./CatalogViews";

const TABS: { id: SettingsTab; label: string; icon: ReactNode; hint: string }[] = [
  { id: "negocio", label: "Negocio", icon: <Store />, hint: "Nombre, contacto y dirección" },
  { id: "reservas", label: "Reservas", icon: <CalendarCheck />, hint: "Reglas y anticipación" },
  { id: "pagos", label: "Pagos y seña", icon: <CreditCard />, hint: "Seña por transferencia" },
  { id: "notificaciones", label: "Notificaciones", icon: <Bell />, hint: "Recordatorios y avisos" },
  { id: "apariencia", label: "Apariencia", icon: <Palette />, hint: "Color de tu página" },
  { id: "plan", label: "Plan", icon: <Sparkles />, hint: "Suscripción" },
  { id: "cuenta", label: "Cuenta", icon: <UserRound />, hint: "Sesión y seguridad" },
];

export default function SettingsView({ tab }: { tab: SettingsTab }) {
  const { go, user } = usePanel();
  const current = TABS.some((t) => t.id === tab) ? tab : "negocio";
  return (
    <div>
      <PageHead title="Ajustes" sub="Todo se guarda en la nube y se refleja al instante en tu página." />
      {isDemoUser(user) && <Callout tone="info" className="mb-4">Estás en la cuenta de demostración: los cambios quedan solo en este navegador. <a className="font-medium underline" href="#/registro">Creá tu cuenta gratis</a>.</Callout>}
      <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="Secciones de ajustes" className="c-chip-row lg:flex lg:flex-col lg:gap-0.5 lg:overflow-visible">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-current={current === t.id ? "page" : undefined}
              onClick={() => go("ajustes", { tab: t.id })}
              className="c-chip lg:!h-auto lg:!justify-start lg:!gap-2.5 lg:!rounded-[var(--r)] lg:!border-transparent lg:!bg-transparent lg:!px-2.5 lg:!py-2 lg:!text-[13.5px] lg:aria-[current=page]:!bg-[var(--surface)] lg:aria-[current=page]:!border-[var(--line)] lg:aria-[current=page]:!text-[var(--text)] aria-[current=page]:!bg-[var(--text)] aria-[current=page]:!text-white lg:aria-[current=page]:!shadow-[var(--sh-sm)] [&>svg]:h-4 [&>svg]:w-4 lg:[&>svg]:text-[var(--text-3)]"
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 max-w-[760px]" key={current}>
          {current === "negocio" && <BusinessTab />}
          {current === "reservas" && <RulesTab />}
          {current === "pagos" && <PaymentsTab />}
          {current === "notificaciones" && <NotificationsTab />}
          {current === "apariencia" && <AppearanceTab />}
          {current === "plan" && <PlanTab />}
          {current === "cuenta" && <AccountTab />}
        </div>
      </div>
    </div>
  );
}

function SaveBar({ dirty, onSave, onReset, label = "Guardar cambios" }: { dirty: boolean; onSave: () => void; onReset: () => void; label?: string }) {
  return (
    <div className={`${dirty ? "sticky shadow-[var(--sh-sm)]" : ""} bottom-[calc(76px+env(safe-area-inset-bottom,0px))] z-10 mt-4 flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] p-2.5 lg:bottom-3`}>
      <Button variant="primary" icon={<Save />} disabled={!dirty} onClick={onSave}>{label}</Button>
      {dirty ? <Button variant="ghost" onClick={onReset}>Descartar</Button> : <span role="status" className="text-[12.5px] text-[var(--text-3)]">Todo guardado</span>}
    </div>
  );
}

/* ---------- Negocio ---------- */

function BusinessTab() {
  const store = useStore();
  const { user, data } = usePanel();
  const initial = () => ({
    business: user.business,
    name: user.name,
    whatsapp: data.settings.whatsapp || "",
    instagram: data.settings.instagram || "",
    address: data.settings.address || "",
    mapsUrl: data.settings.mapsUrl || "",
    description: data.settings.description || "",
  });
  const [f, setF] = useState(initial);
  const savedKey = JSON.stringify(initial());
  useEffect(() => setF(initial()), [savedKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(f) !== savedKey;
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const save = () => {
    if (f.business.trim().length < 2) return setError("El nombre del negocio es obligatorio.");
    const wa = f.whatsapp.replace(/\D/g, "");
    if (wa && wa.length < 8) return setError("Revisá el WhatsApp: tiene muy pocos números.");
    setError(null);
    if (f.business.trim() !== user.business || f.name.trim() !== user.name) store.saveProfile(f.business.trim(), f.name.trim());
    store.updateSettings({ whatsapp: wa, instagram: f.instagram.trim().replace(/^@/, ""), address: f.address.trim(), mapsUrl: f.mapsUrl.trim(), description: f.description.trim() });
    store.toast("Datos del negocio guardados");
  };

  return (
    <>
      <Card title="Datos del negocio" sub="Aparecen en tu página de reservas y en los mensajes a clientes.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre del negocio" htmlFor="s-biz"><input id="s-biz" className="c-input" value={f.business} onChange={set("business")} /></Field>
          <Field label="Tu nombre" htmlFor="s-name"><input id="s-name" className="c-input" value={f.name} onChange={set("name")} /></Field>
          <Field label="WhatsApp del local" htmlFor="s-wa" hint="Tus clientes te escriben desde tu página."><input id="s-wa" className="c-input" type="tel" inputMode="tel" placeholder="11 5555 1234" value={f.whatsapp} onChange={set("whatsapp")} /></Field>
          <Field label="Instagram" htmlFor="s-ig"><input id="s-ig" className="c-input" placeholder="@tunegocio" value={f.instagram} onChange={set("instagram")} /></Field>
          <Field label="Dirección" htmlFor="s-addr" className="sm:col-span-2"><input id="s-addr" className="c-input" placeholder="Av. Corrientes 1234, CABA" value={f.address} onChange={set("address")} /></Field>
          <Field label="Link de Google Maps (opcional)" htmlFor="s-maps" className="sm:col-span-2"><input id="s-maps" className="c-input" type="url" placeholder="https://maps.app.goo.gl/…" value={f.mapsUrl} onChange={set("mapsUrl")} /></Field>
          <Field label="Descripción corta" htmlFor="s-desc" className="sm:col-span-2" hint={`${f.description.length}/240 · Qué hacés y por qué elegirte.`}>
            <textarea id="s-desc" className="c-textarea" rows={3} maxLength={240} value={f.description} onChange={set("description")} />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[var(--r-md)] bg-[var(--surface-2)] px-3 py-2.5 text-[13px]">
          <span className="text-[var(--text-3)]">Tu link:</span>
          <span className="font-medium">cupito.app/{user.slug}</span>
          <a className="ml-auto inline-flex items-center gap-1 text-[var(--brand)] hover:underline" href={`/${user.slug}`} target="_blank" rel="noreferrer">Ver <ExternalLink className="h-3.5 w-3.5" /></a>
        </div>
        <p className="mt-2 text-[12px] text-[var(--text-3)]">Email de la cuenta: {user.email}</p>
        {error && <p className="c-error mt-3" role="alert">{error}</p>}
      </Card>
      <SaveBar dirty={dirty} onSave={save} onReset={() => { setF(initial()); setError(null); }} />
    </>
  );
}

/* ---------- Reglas de reserva ---------- */

function OptionRow({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium">{title}</p>
        <p className="text-[12.5px] text-[var(--text-3)]">{hint}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function RulesTab() {
  const store = useStore();
  const { data } = usePanel();
  const s = data.settings;
  const upd = (patch: Partial<BizSettings>, msg: string) => { store.updateSettings(patch); store.toast(msg); };
  const sel = <T extends number>(label: string, value: T, options: [T, string][], onChange: (v: T) => void) => (
    <select className="c-select" style={{ width: 190 }} aria-label={label} value={value} onChange={(e) => onChange(Number(e.target.value) as T)}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
  return (
    <div className="space-y-4">
      <Card title="Cómo se ofrecen los horarios" bodyClass="c-divide">
        <OptionRow title="Intervalo entre horarios" hint="Cada cuánto aparece un horario disponible (10:00, 10:30…).">
          <Segmented label="Intervalo" value={String(s.slotInterval || 30)} onChange={(v) => upd({ slotInterval: Number(v) }, `Horarios cada ${v} minutos`)} options={[{ value: "15", label: "15′" }, { value: "30", label: "30′" }, { value: "45", label: "45′" }, { value: "60", label: "60′" }]} />
        </OptionRow>
        <OptionRow title="Tiempo entre turnos" hint="Para limpiar, preparar o descansar entre clientes.">
          {sel("Tiempo entre turnos", s.bufferMinutes || 0, [[0, "Sin pausa"], [5, "5 minutos"], [10, "10 minutos"], [15, "15 minutos"], [20, "20 minutos"], [30, "30 minutos"]], (v) => upd({ bufferMinutes: v }, v ? `${v} minutos entre turnos` : "Sin pausa entre turnos"))}
        </OptionRow>
      </Card>
      <Card title="Anticipación" bodyClass="c-divide">
        <OptionRow title="Reservar con al menos" hint="Evita turnos sorpresa a último momento.">
          {sel("Anticipación mínima", s.minNoticeHours || 0, [[0, "Sin mínimo"], [1, "1 hora antes"], [2, "2 horas antes"], [3, "3 horas antes"], [6, "6 horas antes"], [12, "12 horas antes"], [24, "1 día antes"], [48, "2 días antes"]], (v) => upd({ minNoticeHours: v }, "Anticipación mínima actualizada"))}
        </OptionRow>
        <OptionRow title="Reservar hasta" hint="Cuántos días hacia adelante se ve tu agenda.">
          {sel("Anticipación máxima", s.maxAdvanceDays ?? 30, [[7, "1 semana"], [14, "2 semanas"], [30, "1 mes"], [60, "2 meses"], [90, "3 meses"], [180, "6 meses"]], (v) => upd({ maxAdvanceDays: v }, "Anticipación máxima actualizada"))}
        </OptionRow>
      </Card>
      <Callout icon={<CalendarCheck />}>
        Tus clientes pueden cancelar o reprogramar solos desde “Mis turnos” hasta 24 h antes. Dentro de las 24 h tienen que escribirte.
      </Callout>
    </div>
  );
}

/* ---------- Pagos ---------- */

function PaymentsTab() {
  const store = useStore();
  const { user, data } = usePanel();
  const s = data.settings;
  const init = () => ({ alias: s.transferAlias || "", cbu: s.transferCBU || "", holder: s.transferHolder || "" });
  const [f, setF] = useState(init);
  const key = JSON.stringify(init());
  useEffect(() => setF(init()), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(f) !== key;
  if (!isPaid(user)) return <Locked title="Cobrá seña al reservar" text="Pedí un anticipo por transferencia para asegurar el turno y bajar las ausencias. Incluido en el plan Crece." />;

  const saveData = () => {
    const err = validateTransfer(f.alias, f.cbu, f.holder);
    if (err) { store.toast(err, "warn"); return false; }
    store.updateSettings({ transferAlias: f.alias.trim(), transferCBU: f.cbu.replace(/\D/g, ""), transferHolder: f.holder.trim() });
    return true;
  };
  return (
    <div className="space-y-4">
      <Card title="Seña al reservar" sub="El cliente transfiere y te avisa. Vos verificás y el turno queda confirmado.">
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-[13.5px] font-medium">Pedir seña</span>
            <span className="block text-[12.5px] text-[var(--text-3)]">{s.depositEnabled ? `Activa · ${s.depositPct}% del servicio` : "Desactivada: las reservas se confirman solas"}</span>
          </span>
          <Toggle
            label="Activar seña"
            checked={s.depositEnabled}
            onChange={(v) => {
              if (v && !saveData()) return;
              store.updateSettings({ depositEnabled: v });
              store.toast(v ? "Seña activada" : "Seña desactivada");
            }}
          />
        </label>
        <div className="mt-4">
          <p className="c-label mb-1.5">Porcentaje de la seña</p>
          <div className="flex flex-wrap gap-1.5">
            {[10, 20, 25, 30, 40, 50].map((p) => (
              <button key={p} type="button" className="c-chip" aria-pressed={s.depositPct === p} onClick={() => { store.updateSettings({ depositPct: p }); store.toast(`Seña del ${p}%`); }}>{p}%</button>
            ))}
          </div>
        </div>
      </Card>
      <Card title="Datos para la transferencia" sub="Se muestran al cliente al momento de pagar la seña.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Alias" htmlFor="p-alias"><input id="p-alias" aria-label="Alias de transferencia" className="c-input" placeholder="TU.NEGOCIO" value={f.alias} onChange={(e) => setF({ ...f, alias: e.target.value })} /></Field>
          <Field label="CBU / CVU" htmlFor="p-cbu"><input id="p-cbu" aria-label="CBU o CVU" className="c-input" inputMode="numeric" maxLength={22} placeholder="22 dígitos" value={f.cbu} onChange={(e) => setF({ ...f, cbu: e.target.value })} /></Field>
          <Field label="Titular de la cuenta" htmlFor="p-holder" className="sm:col-span-2"><input id="p-holder" aria-label="Titular de la cuenta" className="c-input" placeholder="Nombre y apellido" value={f.holder} onChange={(e) => setF({ ...f, holder: e.target.value })} /></Field>
        </div>
      </Card>
      <SaveBar dirty={dirty} onSave={() => { if (saveData()) store.toast("Datos de cobro guardados"); }} onReset={() => setF(init())} label="Guardar datos de cobro" />
    </div>
  );
}

/* ---------- Notificaciones ---------- */

function NotificationsTab() {
  const store = useStore();
  const { data, openCalendarSync } = usePanel();
  const [sound, setSound] = useState(() => { try { return localStorage.getItem("cupito_sound") !== "0"; } catch { return true; } });
  return (
    <div className="space-y-4">
      <Card title="Para tus clientes" bodyClass="c-divide">
        <OptionRow title="Recordatorio por email 24 h antes" hint="Se envía solo a quienes dejaron su email al reservar.">
          <Toggle label="Recordatorio por email" checked={data.settings.remindersEnabled !== false} onChange={(v) => { store.updateSettings({ remindersEnabled: v }); store.toast(v ? "Recordatorios automáticos activados" : "Recordatorios automáticos desactivados"); }} />
        </OptionRow>
        <OptionRow title="Recordatorios por WhatsApp" hint="Desde Inicio → “Recordale a tus clientes de mañana”, con el mensaje listo.">
          <Badge tone="brand">Incluido</Badge>
        </OptionRow>
      </Card>
      <Card title="Para vos" bodyClass="c-divide">
        <OptionRow title="Sonido al entrar una reserva" hint="Mientras tengas el panel abierto, en este dispositivo.">
          <Toggle label="Sonido de nuevas reservas" checked={sound} onChange={(v) => { setSound(v); try { localStorage.setItem("cupito_sound", v ? "1" : "0"); } catch { /* noop */ } store.toast(v ? "Sonido activado" : "Sonido desactivado"); }} />
        </OptionRow>
        <OptionRow title="Turnos en el calendario del celular" hint="Suscribite desde Google Calendar o iPhone: se actualiza solo.">
          <Button size="sm" icon={<CalendarClock />} onClick={() => openCalendarSync()}>Conectar</Button>
        </OptionRow>
        <OptionRow title="Cupito como app" hint="Agregalo a la pantalla de inicio para abrirlo en un toque.">
          <Button size="sm" icon={<Smartphone />} onClick={() => window.dispatchEvent(new Event("cupito-install"))}>Instalar</Button>
        </OptionRow>
      </Card>
    </div>
  );
}

/* ---------- Apariencia ---------- */

function AppearanceTab() {
  const store = useStore();
  const { data, user, checkout } = usePanel();
  const paid = isPaid(user);
  const [theme, setTheme] = useState(data.settings.theme || "evergreen");
  const [custom, setCustom] = useState(data.settings.brandColor || "");
  const accent = themeAccent({ theme, brandColor: custom });
  const dirty = theme !== (data.settings.theme || "evergreen") || custom !== (data.settings.brandColor || "");
  const valid = !custom || /^#[0-9a-f]{6}$/i.test(custom);
  return (
    <div className="space-y-4">
      {!paid && <Callout tone="info" icon={<Sparkles />}>Elegir color es parte del plan Crece. <button type="button" className="font-medium underline" onClick={() => checkout("crece")}>Ver planes</button></Callout>}
      <Card title="Color de tu página" sub="Se usa en botones y detalles de tu página de reservas.">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_240px]">
          <div className="space-y-4">
            <div>
              <p className="c-label mb-2">Paletas</p>
              <div className="grid grid-cols-3 gap-2">
                {THEME_OPTIONS.map((t) => (
                  <button key={t.id} type="button" disabled={!paid && t.id !== "evergreen"} aria-pressed={theme === t.id && !custom} onClick={() => { setTheme(t.id); setCustom(""); }} className="c-pick flex-col !items-start !gap-1.5 disabled:opacity-50">
                    <span className="h-5 w-full rounded" style={{ background: t.color }} />
                    <span className="text-[12.5px] font-medium">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="c-label mb-2">O tu propio color</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {BRAND_SWATCHES.map((c) => (
                  <button key={c} type="button" disabled={!paid} aria-label={`Color ${c}`} aria-pressed={custom.toLowerCase() === c} onClick={() => setCustom(c)} className="h-7 w-7 rounded-full disabled:opacity-40" style={{ background: c, boxShadow: custom.toLowerCase() === c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : undefined }} />
                ))}
                <input type="color" disabled={!paid} aria-label="Elegir color" value={custom || accent} onChange={(e) => setCustom(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-[var(--line-2)] bg-transparent disabled:opacity-40" />
                <input className="c-input" style={{ width: 110, height: 32 }} disabled={!paid} aria-label="Código de color" placeholder="#16845f" value={custom} onChange={(e) => setCustom(e.target.value.trim())} aria-invalid={!valid} />
              </div>
            </div>
          </div>
          <div className="rounded-[var(--r-lg)] border border-[var(--line)] p-4" aria-label="Vista previa">
            <p className="c-eyebrow mb-3">Vista previa</p>
            <p className="text-[15px] font-semibold">{user.business}</p>
            <p className="mb-3 text-[12px] text-[var(--text-3)]">Elegí tu servicio</p>
            <div className="mb-2 flex gap-1.5">
              {["10:00", "10:30", "11:00"].map((t, i) => (
                <span key={t} className="rounded-[7px] border px-2 py-1 text-[12px] font-medium" style={i === 1 ? { background: accent, borderColor: accent, color: contrastText(accent) } : { borderColor: "var(--line-2)" }}>{t}</span>
              ))}
            </div>
            <span className="mt-2 block rounded-[8px] py-2 text-center text-[13px] font-semibold" style={{ background: accent, color: contrastText(accent) }}>Confirmar turno</span>
          </div>
        </div>
      </Card>
      <SaveBar
        dirty={dirty && valid && paid}
        onSave={() => { store.updateSettings({ theme, brandColor: custom || undefined }); store.toast("Colores guardados"); }}
        onReset={() => { setTheme(data.settings.theme || "evergreen"); setCustom(data.settings.brandColor || ""); }}
      />
    </div>
  );
}

/* ---------- Plan ---------- */

function PlanTab() {
  const store = useStore();
  const { user, data, checkout } = usePanel();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sub = user.subscription;
  const st = getSubscriptionStatus(user);
  const used = monthBookingCount(data);
  const next = fmtDateHuman(sub?.nextRenewal || Date.now() + 30 * 86400000);
  const plans: Plan[] = ["semilla", "crece", "escala"];

  const cancel = async () => {
    setBusy(true);
    setError(null);
    const r = await store.cancelSubscriptionAsync();
    setBusy(false);
    if (!r.ok) { setError(`${r.error} Si ya la cancelaste en Mercado Pago, escribinos a hola@cupito.app.`); return; }
    store.toast("Suscripción cancelada en Mercado Pago. No se te cobra más.");
  };

  return (
    <div className="space-y-4">
      <Card title={`Plan ${PLAN_META[user.plan].name}`} sub={user.plan === "semilla" ? "Gratis para siempre" : `${PLAN_META[user.plan].price}`} action={user.plan !== "semilla" && <Badge tone={st.isExpired ? "danger" : st.isGracePeriod ? "warn" : "brand"}>{st.isExpired ? "Vencido" : st.isGracePeriod ? "En gracia" : sub?.status === "cancelada" ? "Cancelada" : st.hasMpAutoDebit ? "Débito automático" : "Activo"}</Badge>}>
        {user.plan === "semilla" ? (
          <>
            <div className="flex items-baseline justify-between text-[13px]">
              <span>Reservas de este mes</span>
              <span className="font-semibold tnum">{used} / {SEMILLA_MONTHLY_LIMIT}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-3)]">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, (used / SEMILLA_MONTHLY_LIMIT) * 100)}%`, background: used >= SEMILLA_MONTHLY_LIMIT ? "var(--danger)" : "var(--brand)" }} />
            </div>
            <p className="mt-2 text-[12.5px] text-[var(--text-3)]">{used >= SEMILLA_MONTHLY_LIMIT ? "Llegaste al tope: las reservas online se pausan hasta el mes que viene." : "Al llegar al tope, las reservas online se pausan hasta el mes siguiente."}</p>
          </>
        ) : (
          <div className="space-y-3 text-[13.5px]">
            <p className="text-[var(--text-2)]">
              {st.hasMpAutoDebit
                ? sub?.status === "cancelada"
                  ? `No se renueva. Mantenés ${PLAN_META[user.plan].name} hasta el ${next}.`
                  : `Próximo cobro automático: ${next}.`
                : st.isExpired
                  ? `Tu período terminó el ${next}.`
                  : `Vigente hasta el ${next} · quedan ${st.daysRemaining} días.`}
            </p>
            <div className="flex flex-wrap gap-2">
              {st.hasMpAutoDebit && sub?.status !== "cancelada" && <Button variant="danger" onClick={() => setConfirm(true)} loading={busy}>Cancelar suscripción</Button>}
              {(!st.hasMpAutoDebit || sub?.status === "cancelada") && <Button variant="primary" onClick={() => checkout(user.plan)}>{sub?.status === "cancelada" ? "Reanudar suscripción" : "Activar débito automático"}</Button>}
            </div>
            {error && <Callout tone="danger" icon={<AlertTriangle />}>{error}</Callout>}
          </div>
        )}
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        {plans.map((p) => {
          const active = user.plan === p;
          return (
            <div key={p} className="c-card flex flex-col p-4" style={active ? { borderColor: "var(--brand)", boxShadow: "0 0 0 1px var(--brand) inset" } : undefined}>
              <div className="flex items-center justify-between">
                <p className="text-[15px] font-semibold">{PLAN_META[p].name}</p>
                {active ? <Badge tone="brand">Tu plan</Badge> : p === "crece" ? <Badge>Más elegido</Badge> : null}
              </div>
              <p className="mt-1 text-[20px] font-semibold tracking-tight">{PLAN_META[p].price}</p>
              <ul className="mt-3 flex-1 space-y-1.5">
                {PLAN_FEATURES[p].map((f) => (
                  <li key={f} className="flex gap-2 text-[12.5px] text-[var(--text-2)]"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--brand)]" />{f}</li>
                ))}
              </ul>
              {!active && (
                <Button className="mt-4" block variant={p === "semilla" ? "secondary" : "primary"} onClick={() => checkout(p)}>
                  {p === "semilla" ? "Pasar a Semilla" : `Elegir ${PLAN_META[p].name}`}
                </Button>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[12.5px] text-[var(--text-3)]">Los planes pagos se cobran con Mercado Pago (tarjeta de débito o crédito). Podés cancelar cuando quieras desde acá.</p>
      {confirm && (
        <Confirm
          title="¿Cancelar la renovación automática?"
          text={`Se cancela en Mercado Pago y no se te cobra más. Seguís con ${PLAN_META[user.plan].name} hasta el ${next}; después la cuenta pasa a Semilla.`}
          confirmLabel="Sí, cancelar"
          cancelLabel="Mantener"
          danger
          onConfirm={() => { void cancel(); }}
          onClose={() => setConfirm(false)}
        />
      )}
    </div>
  );
}

/* ---------- Cuenta ---------- */

function AccountTab() {
  const store = useStore();
  const { user } = usePanel();
  const [del, setDel] = useState(false);
  const [typed, setTyped] = useState("");
  return (
    <div className="space-y-4">
      <Card title="Tu cuenta" bodyClass="c-divide">
        <OptionRow title={user.name} hint={user.email}>
          <Button icon={<LogOut />} onClick={() => { store.logout(); window.location.hash = "#/"; }}>Cerrar sesión</Button>
        </OptionRow>
        <OptionRow title="Contraseña" hint="Si la olvidaste, usá tu clave de recuperación desde la pantalla de ingreso.">
          <a className="c-btn c-btn--secondary" href="#/recuperar">Cambiar contraseña</a>
        </OptionRow>
      </Card>
      <Card title="Zona de riesgo" className="!border-[var(--st-canc-line)]">
        <p className="text-[13px] text-[var(--text-2)]">Eliminar la cuenta borra tu página, servicios, turnos y clientes. No se puede deshacer.</p>
        {!del ? (
          <Button className="mt-3" variant="danger" icon={<Trash2 />} onClick={() => setDel(true)}>Eliminar mi cuenta</Button>
        ) : (
          <div className="mt-3 space-y-2">
            <Field label={`Escribí “${user.business}” para confirmar`} htmlFor="a-del"><input id="a-del" className="c-input" value={typed} onChange={(e) => setTyped(e.target.value)} /></Field>
            <div className="flex gap-2">
              <Button variant="danger-solid" disabled={typed.trim() !== user.business.trim()} onClick={() => { store.deleteAccount(); store.toast("Cuenta eliminada", "warn"); window.location.hash = "#/"; }}>Eliminar definitivamente</Button>
              <Button variant="ghost" onClick={() => { setDel(false); setTyped(""); }}>Cancelar</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
