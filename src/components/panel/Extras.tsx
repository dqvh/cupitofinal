import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Check, Download, Printer, Share2, Smartphone, CalendarDays, MessageCircle, Plus, ArrowRight } from "lucide-react";
import { useStore, defaultHours, type DayHours, type Plan } from "../../lib/store";
import { validateHours } from "../../lib/scheduling";
import { Button, Callout, Field, Segmented, Sheet } from "./ui";
import { usePanel } from "./context";
import HoursEditor from "./HoursEditor";
import { createWhatsAppUrl } from "../../lib/phone";

export type ExtraKind = { kind: "calendar"; proId?: string } | { kind: "share" } | { kind: "install" } | { kind: "setup" };

export default function Extras({ extra, onClose, onPlan }: { extra: ExtraKind; onClose: () => void; onPlan: (p: Plan) => void }) {
  if (extra.kind === "calendar") return <CalendarSync proId={extra.proId} onClose={onClose} />;
  if (extra.kind === "share") return <ShareSheet onClose={onClose} />;
  if (extra.kind === "install") return <InstallSheet onClose={onClose} />;
  return <QuickSetup onClose={onClose} onPlan={onPlan} />;
}

function useCopy() {
  const store = useStore();
  const [copied, setCopied] = useState<string | null>(null);
  return {
    copied,
    copy: (text: string, id = text, msg = "Copiado") => {
      const done = () => { setCopied(id); store.toast(msg); setTimeout(() => setCopied(null), 1800); };
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => store.toast("No se pudo copiar: mantené apretado el texto para copiarlo", "warn"));
      else store.toast("Tu navegador no permite copiar automáticamente", "warn");
    },
  };
}

export function useQr(url: string, width = 480) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { width, margin: 1, color: { dark: "#0d2a1f", light: "#ffffff" } }).then((d) => alive && setSrc(d)).catch(() => {});
    return () => { alive = false; };
  }, [url, width]);
  return src;
}

/** Abre una ventana solo con el cartel y lo imprime (antes se imprimía todo el panel). */
export function printPoster(business: string, slug: string, qr: string) {
  const w = window.open("", "_blank", "width=720,height=960");
  if (!w) return false;
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Cartel · ${esc(business)}</title>
  <style>@page{size:A4;margin:18mm}body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0d2a1f;text-align:center;margin:0}
  .box{border:3px solid #0d2a1f;border-radius:28px;padding:48px 36px;max-width:520px;margin:40px auto}
  small{letter-spacing:.2em;text-transform:uppercase;font-weight:700;font-size:13px;color:#146c48}
  h1{font-size:40px;margin:10px 0 28px;line-height:1.1}img{width:300px;height:300px}
  p{font-size:18px;margin:18px 0 4px;font-weight:600}.url{font-size:20px;font-weight:700;margin-top:22px;padding-top:18px;border-top:2px dashed #cfd8d3}
  ol{text-align:left;display:inline-block;font-size:16px;line-height:1.8;margin:18px 0 0}</style></head>
  <body><div class="box"><small>Reservá tu turno online</small><h1>${esc(business)}</h1><img src="${qr}" alt="QR"/>
  <p>Escaneá con la cámara de tu celular</p><ol><li>Elegí el servicio y el horario</li><li>Dejá tu nombre y celular</li><li>¡Listo! Te llega la confirmación</li></ol>
  <div class="url">cupito.app/${esc(slug)}</div></div><script>window.onload=function(){setTimeout(function(){window.print()},250)}</script></body></html>`);
  w.document.close();
  return true;
}

/* ---------- compartir ---------- */

function ShareSheet({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const { user } = usePanel();
  const url = `https://cupito.app/${user.slug}`;
  const qr = useQr(url);
  const { copied, copy } = useCopy();
  const templates = [
    { id: "wa", title: "Respuesta automática de WhatsApp Business", text: `¡Hola! Gracias por escribir a ${user.business}. Podés ver servicios, precios y reservar tu turno cuando quieras acá:\n${url}\n\nSi tenés una consulta, escribinos y te respondemos.` },
    { id: "ig", title: "Bio de Instagram", text: `${user.business}\nReservá tu turno online 👇\n${url}` },
    { id: "story", title: "Historia o estado", text: `¡Abrimos la agenda de la semana en ${user.business}! Reservá tu lugar acá: ${url}` },
  ];
  const nativeShare = async () => {
    try {
      await navigator.share({ title: user.business, text: `Reservá tu turno en ${user.business}`, url });
    } catch { /* cancelado */ }
  };
  return (
    <Sheet onClose={onClose} title="Compartir tu página" subtitle="Cuantos más lugares tengan tu link, menos consultas por chat.">
      <div className="space-y-5">
        <div className="flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-2 pl-3">
          <span className="min-w-0 flex-1 truncate text-[14px] font-medium">cupito.app/{user.slug}</span>
          <Button size="sm" variant="primary" icon={copied === "url" ? <Check /> : <Copy />} onClick={() => { copy(url, "url", "Link copiado"); try { localStorage.setItem(`cupito_shared_${user.id}`, "1"); } catch { /* noop */ } }}>{copied === "url" ? "Copiado" : "Copiar"}</Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <a className="c-btn c-btn--secondary" href={`https://wa.me/?text=${encodeURIComponent(`Reservá tu turno en ${user.business}: ${url}`)}`} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a>
          {typeof navigator !== "undefined" && "share" in navigator ? (
            <Button icon={<Share2 />} onClick={nativeShare}>Más opciones</Button>
          ) : (
            <a className="c-btn c-btn--secondary" href={qr || "#"} download={`qr-${user.slug}.png`}><Download /> Descargar QR</a>
          )}
        </div>
        <section>
          <p className="c-eyebrow mb-2">Textos listos para pegar</p>
          <div className="space-y-2.5">
            {templates.map((t) => (
              <div key={t.id} className="rounded-[var(--r-md)] border border-[var(--line)]">
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <p className="text-[13px] font-medium">{t.title}</p>
                  <Button size="sm" variant="ghost" icon={copied === t.id ? <Check /> : <Copy />} onClick={() => copy(t.text, t.id, "Texto copiado")}>{copied === t.id ? "Copiado" : "Copiar"}</Button>
                </div>
                <p className="whitespace-pre-line border-t border-[var(--line)] px-3 py-2 text-[12.5px] text-[var(--text-2)]">{t.text}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="flex items-center gap-4 rounded-[var(--r-md)] border border-[var(--line)] p-3">
          {qr ? <img src={qr} alt={`QR de ${url}`} className="h-24 w-24 rounded" /> : <div className="c-skel h-24 w-24" />}
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-medium">QR para el mostrador</p>
            <p className="text-[12.5px] text-[var(--text-3)]">Los que esperan en el local reservan su próximo turno solos.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {qr && <a className="c-btn c-btn--secondary c-btn--sm" href={qr} download={`qr-${user.slug}.png`}><Download /> PNG</a>}
              {qr && <Button size="sm" icon={<Printer />} onClick={() => { if (!printPoster(user.business, user.slug, qr)) store.toast("Permití las ventanas emergentes para imprimir", "warn"); }}>Imprimir cartel</Button>}
            </div>
          </div>
        </section>
      </div>
    </Sheet>
  );
}

/* ---------- calendario del celular ---------- */

function CalendarSync({ proId, onClose }: { proId?: string; onClose: () => void }) {
  const { user, data } = usePanel();
  const [who, setWho] = useState(proId || "");
  const pro = data.professionals.find((p) => p.id === who);
  const param = pro ? `&proId=${encodeURIComponent(pro.id)}` : "";
  const httpUrl = `https://cupito.app/api/calendar?id=${encodeURIComponent(user.id)}${param}`;
  const webcal = `webcal://cupito.app/api/calendar?id=${encodeURIComponent(user.id)}${param}`;
  const gcal = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;
  const { copied, copy } = useCopy();
  const msg = `Hola${pro ? ` ${pro.name}` : ""}! Para ver los turnos de ${user.business} en el calendario de tu celular:\n\niPhone: ${webcal}\nAndroid / Google: ${gcal}\n\nSe actualiza solo con cada reserva.`;
  return (
    <Sheet onClose={onClose} title="Turnos en el calendario del celular" subtitle="Te suscribís una vez y cada reserva o cambio aparece solo.">
      <div className="space-y-4">
        {data.professionals.length > 0 && (
          <Field label="¿La agenda de quién?">
            <select className="c-select" value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="">Todo el negocio</option>
              {data.professionals.map((p) => <option key={p.id} value={p.id}>Solo {p.name}</option>)}
            </select>
          </Field>
        )}
        <div className="grid gap-2">
          <a className="c-pick" href={webcal}>
            <Smartphone className="h-5 w-5 text-[var(--text-3)]" />
            <span className="min-w-0 flex-1"><span className="block text-[13.5px] font-medium">iPhone / Mac</span><span className="block text-[12px] text-[var(--text-3)]">Abre Calendario y tocás “Suscribirse”</span></span>
            <ArrowRight className="h-4 w-4 text-[var(--text-3)]" />
          </a>
          <a className="c-pick" href={gcal} target="_blank" rel="noreferrer">
            <CalendarDays className="h-5 w-5 text-[var(--text-3)]" />
            <span className="min-w-0 flex-1"><span className="block text-[13.5px] font-medium">Google Calendar / Android</span><span className="block text-[12px] text-[var(--text-3)]">Se agrega a tu cuenta de Google</span></span>
            <ArrowRight className="h-4 w-4 text-[var(--text-3)]" />
          </a>
        </div>
        <Field label="Link de suscripción (otras apps)">
          <div className="flex gap-2">
            <input className="c-input" readOnly value={httpUrl} onFocus={(e) => e.currentTarget.select()} />
            <Button icon={copied === "u" ? <Check /> : <Copy />} onClick={() => copy(httpUrl, "u", "Link copiado")} aria-label="Copiar link" />
          </div>
        </Field>
        {pro?.phone && (
          <a className="c-btn c-btn--soft" href={createWhatsAppUrl(pro.phone, msg)} target="_blank" rel="noreferrer">
            <MessageCircle /> Mandárselo a {pro.name} por WhatsApp
          </a>
        )}
        {pro && !pro.phone && <p className="text-[12.5px] text-[var(--text-3)]">Cargá el WhatsApp de {pro.name} en Equipo para mandarle este link directo.</p>}
      </div>
    </Sheet>
  );
}

/* ---------- instalar ---------- */

function InstallSheet({ onClose }: { onClose: () => void }) {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent || "");
  return (
    <Sheet side="center" size="narrow" onClose={onClose} title="Tener Cupito como app">
      <ol className="list-decimal space-y-2 pl-5 text-[13.5px] text-[var(--text-2)]">
        {ios ? (
          <>
            <li>Abrí Cupito en <strong>Safari</strong>.</li>
            <li>Tocá el botón <strong>Compartir</strong> (el cuadrado con la flecha).</li>
            <li>Elegí <strong>“Agregar a inicio”</strong>.</li>
          </>
        ) : (
          <>
            <li>Abrí Cupito en <strong>Chrome</strong>.</li>
            <li>Tocá el menú <strong>⋮</strong> arriba a la derecha.</li>
            <li>Elegí <strong>“Instalar app”</strong> o “Agregar a la pantalla principal”.</li>
          </>
        )}
      </ol>
      <p className="mt-3 text-[12.5px] text-[var(--text-3)]">Se abre a pantalla completa, sin barra del navegador.</p>
    </Sheet>
  );
}

/* ---------- configuración rápida (usuarios nuevos) ---------- */

function QuickSetup({ onClose, onPlan }: { onClose: () => void; onPlan: (p: Plan) => void }) {
  const store = useStore();
  const { data, user, go } = usePanel();
  const [step, setStep] = useState(0);
  const [hours, setHours] = useState<DayHours[]>(() => (data.settings.hours || defaultHours()).map((h) => ({ ...h })));
  const [svc, setSvc] = useState({ name: "", duration: 30, price: "" });
  const [wa, setWa] = useState(data.settings.whatsapp || "");
  const [error, setError] = useState<string | null>(null);
  const { copied, copy } = useCopy();
  const url = `https://cupito.app/${user.slug}`;

  const next = () => {
    setError(null);
    if (step === 0) {
      if (svc.name.trim().length >= 2) {
        store.addService({ name: svc.name.trim(), duration: svc.duration, price: Number(svc.price) || 0 });
      } else if (!data.services.length) return setError("Escribí el nombre de tu servicio principal (después sumás más).");
      setStep(1);
    } else if (step === 1) {
      const err = validateHours(hours);
      if (err) return setError(err);
      store.updateSettings({ hours, hoursConfirmed: true });
      setStep(2);
    } else {
      store.updateSettings({ whatsapp: wa.replace(/\D/g, ""), setupDismissed: true });
      store.toast("¡Listo! Tu página ya recibe reservas");
      onClose();
    }
  };

  const titles = ["¿Qué servicio ofrecés?", "¿Cuándo atendés?", "Tu link está listo"];
  return (
    <Sheet
      onClose={() => { store.updateSettings({ setupDismissed: true }); onClose(); }}
      title={titles[step]}
      subtitle={`Paso ${step + 1} de 3 · lo podés cambiar cuando quieras`}
      size="wide"
      footer={
        <>
          {step > 0 && <Button variant="ghost" onClick={() => setStep(step - 1)}>Atrás</Button>}
          <Button variant="primary" onClick={next} iconRight={step < 2 ? <ArrowRight /> : undefined}>{step < 2 ? "Siguiente" : "Terminar"}</Button>
        </>
      }
    >
      <div className="mb-4 flex gap-1.5" aria-hidden="true">
        {[0, 1, 2].map((i) => <span key={i} className="h-1 flex-1 rounded-full" style={{ background: i <= step ? "var(--brand)" : "var(--surface-3)" }} />)}
      </div>
      {step === 0 && (
        <div className="space-y-4">
          {data.services.length > 0 && <Callout tone="brand" icon={<Check />}>Ya tenés {data.services.length} servicio(s). Podés sumar otro o seguir.</Callout>}
          <Field label="Nombre" htmlFor="qs-n"><input id="qs-n" data-autofocus className="c-input" placeholder="Ej: Corte de pelo, Manicura, Consulta" value={svc.name} onChange={(e) => setSvc({ ...svc, name: e.target.value })} /></Field>
          <Field label="Duración">
            <Segmented value={String(svc.duration)} onChange={(v) => setSvc({ ...svc, duration: Number(v) })} options={[15, 30, 45, 60, 90].map((d) => ({ value: String(d), label: `${d}′` }))} />
          </Field>
          <Field label="Precio" htmlFor="qs-p"><input id="qs-p" className="c-input" inputMode="numeric" placeholder="$ 10000" value={svc.price} onChange={(e) => setSvc({ ...svc, price: e.target.value.replace(/\D/g, "") })} /></Field>
        </div>
      )}
      {step === 1 && <HoursEditor hours={hours} onChange={setHours} compact />}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--brand-line)] bg-[var(--brand-soft)] p-2 pl-3">
            <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[var(--brand-ink)]">cupito.app/{user.slug}</span>
            <Button size="sm" icon={copied === "l" ? <Check /> : <Copy />} onClick={() => copy(url, "l", "Link copiado")}>{copied === "l" ? "Copiado" : "Copiar"}</Button>
          </div>
          <p className="text-[13px] text-[var(--text-2)]">Pegalo en tu bio de Instagram y en la respuesta automática de WhatsApp: tus clientes reservan solos, sin chatear.</p>
          <Field label="WhatsApp del local (opcional)" htmlFor="qs-wa" hint="Aparece en tu página para consultas."><input id="qs-wa" className="c-input" type="tel" placeholder="11 5555 1234" value={wa} onChange={(e) => setWa(e.target.value)} /></Field>
          {user.plan === "semilla" && (
            <p className="text-[12.5px] text-[var(--text-3)]">Estás en el plan gratis (hasta 25 reservas por mes). <button type="button" className="font-medium text-[var(--brand)] underline" onClick={() => onPlan("crece")}>Ver plan Crece</button></p>
          )}
          <button type="button" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--brand)]" onClick={() => { store.updateSettings({ whatsapp: wa.replace(/\D/g, ""), setupDismissed: true }); onClose(); go("servicios"); }}>
            <Plus className="h-3.5 w-3.5" /> Prefiero cargar más servicios ahora
          </button>
        </div>
      )}
      {error && <p className="c-error mt-3" role="alert">{error}</p>}
    </Sheet>
  );
}
