import { lazy, Suspense, useState } from "react";
import { Copy, Check, Download, Printer, Share2, ExternalLink, CircleDashed, CheckCircle2, Eye, Palette } from "lucide-react";
import { useStore, isPaid } from "../../lib/store";
import { businessHoursOn } from "../../lib/availability";
import { Button, Card, PageHead, Skeleton } from "./ui";
import { usePanel } from "./context";
import { printPoster, useQr } from "./Extras";
import { shiftKey, todayKey } from "./helpers";

const PublicBooking = lazy(() => import("../PublicBooking"));

export default function PageView() {
  const store = useStore();
  const { user, data, go, openShare } = usePanel();
  const url = `https://cupito.app/${user.slug}`;
  const qr = useQr(url);
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState(false);
  const paid = isPaid(user);
  const openDays = Array.from({ length: 14 }, (_, i) => shiftKey(todayKey(), i)).filter((k) => businessHoursOn(data.settings, k)?.open).length;

  const checks = [
    { ok: data.services.some((s) => !s.archived), label: "Servicios con precio y duración", go: () => go("servicios") },
    { ok: openDays > 0, label: openDays ? `${openDays} días abiertos en las próximas 2 semanas` : "No hay días abiertos en las próximas 2 semanas", go: () => go("horarios") },
    { ok: !!data.settings.whatsapp, label: "WhatsApp para consultas", go: () => go("ajustes", { tab: "negocio" }) },
    { ok: !!data.settings.address, label: "Dirección del local", go: () => go("ajustes", { tab: "negocio" }) },
    { ok: !!data.settings.description, label: "Descripción del negocio", go: () => go("ajustes", { tab: "negocio" }) },
    { ok: paid && data.settings.depositEnabled, label: paid ? (data.settings.depositEnabled ? `Seña del ${data.settings.depositPct}%` : "Seña desactivada (opcional)") : "Seña (plan Crece)", go: () => go("ajustes", { tab: "pagos" }), optional: true },
  ];

  const copy = () => {
    navigator.clipboard?.writeText(url).then(() => { setCopied(true); store.toast("Link copiado"); setTimeout(() => setCopied(false), 1800); }, () => store.toast("No se pudo copiar", "warn"));
  };

  return (
    <div>
      <PageHead
        title="Mi página"
        sub="Tu link de reservas: compartilo y tus clientes reservan solos, las 24 h."
        actions={<a className="c-btn c-btn--secondary" href={`/${user.slug}`} target="_blank" rel="noreferrer"><ExternalLink /> Abrir</a>}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card title="Tu link">
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 truncate rounded-[var(--r)] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-[15px] font-semibold">cupito.app/{user.slug}</span>
              <Button variant="primary" icon={copied ? <Check /> : <Copy />} onClick={copy}>{copied ? "Copiado" : "Copiar"}</Button>
              <Button icon={<Share2 />} onClick={openShare}>Compartir</Button>
            </div>
          </Card>
          <Card title="¿Está completa?" sub="Una página completa genera más confianza y menos consultas." bodyClass="c-divide">
            {checks.map((c) => (
              <button key={c.label} type="button" className="c-list-row" onClick={c.go}>
                {c.ok ? <CheckCircle2 className="h-[18px] w-[18px] text-[var(--brand)]" /> : <CircleDashed className="h-[18px] w-[18px] text-[var(--text-3)]" />}
                <span className={`flex-1 text-[13.5px] ${c.ok ? "" : "text-[var(--text-2)]"}`}>{c.label}</span>
                {!c.ok && <span className="text-[12.5px] font-medium text-[var(--brand)]">{c.optional ? "Configurar" : "Completar"}</span>}
              </button>
            ))}
          </Card>
          <Card title="Así la ven tus clientes" action={<Button size="sm" variant="ghost" icon={<Palette />} onClick={() => go("ajustes", { tab: "apariencia" })}>Cambiar color</Button>}>
            {preview ? (
              <div className="mx-auto max-w-[420px] overflow-hidden rounded-[var(--r-lg)] border border-[var(--line)]">
                <Suspense fallback={<Skeleton style={{ height: 420 }} />}>
                  <PublicBooking isPreview />
                </Suspense>
              </div>
            ) : (
              <Button icon={<Eye />} onClick={() => setPreview(true)}>Mostrar vista previa</Button>
            )}
          </Card>
        </div>
        <Card title="QR para tu local" sub="Imprimilo y pegalo en el mostrador o el espejo.">
          <div className="flex flex-col items-center gap-3">
            {qr ? <img src={qr} alt={`Código QR de ${url}`} className="h-52 w-52 rounded-[var(--r-md)] border border-[var(--line)]" /> : <Skeleton style={{ width: 208, height: 208 }} />}
            <div className="flex w-full gap-2">
              <a className={`c-btn c-btn--secondary flex-1 ${qr ? "" : "pointer-events-none opacity-50"}`} href={qr || undefined} download={`qr-${user.slug}.png`}><Download /> Descargar</a>
              <Button className="flex-1" icon={<Printer />} disabled={!qr} onClick={() => { if (qr && !printPoster(user.business, user.slug, qr)) store.toast("Permití las ventanas emergentes para imprimir", "warn"); }}>Cartel A4</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
