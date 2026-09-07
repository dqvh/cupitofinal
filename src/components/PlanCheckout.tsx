import { PLAN_FEATURES, checkoutAmount } from "../lib/plans";
import { useState } from "react";
import { PLAN_META, type Plan, useStore } from "../lib/store";
import { sendSubscriptionWelcomeEmail } from "../lib/email";
import {
  PLAN_AMOUNTS,
  PLAN_BENEFITS,
  createMercadoPagoCheckout,
  isPaidPlan,
  savePendingCheckout,
  type BillingCycle,
  type PaidPlan,
} from "../lib/billing";
import { IconArrow, IconCheck } from "./kit";

const FEATURES = PLAN_FEATURES;

export function PlanCheckout({
  plan,
  onClose,
}: {
  plan: Plan;
  onClose: () => void;
}) {
  const { user, setPlan, toast, cancelSubscriptionAsync } = useStore();
  const [billing, setBilling] = useState<BillingCycle>("mensual");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickFree = async () => {
    if (processing) return;
    if (user?.subscription?.mpPreapprovalId && user.subscription.status !== "cancelada") {
      setProcessing(true);
      const result = await cancelSubscriptionAsync();
      setProcessing(false);
      if (!result.ok) { setError(result.error); return; }
    }
    setPlan("semilla");
    toast("Quedaste en el plan Semilla, gratis. Podés subir cuando quieras.");
    onClose();
  };

  const pay = async (target: PaidPlan) => {
    if (!user) {
      window.location.hash = "#/auth?plan=" + target;
      return;
    }
    setProcessing(true);
    setError(null);
    const r = await createMercadoPagoCheckout({ plan: target, billing, email: user.email });
    if (!r.ok) {
      setProcessing(false);
      setError(r.error);
      return;
    }
    savePendingCheckout(target, billing);
    toast("Te llevamos a Mercado Pago para pagar la suscripción…");
    window.location.href = r.url;
  };

  if (!isPaidPlan(plan)) {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/60 p-4 backdrop-blur-[2px]" onClick={onClose}>
        <div className="pop-in w-full max-w-md rounded-[22px] border-2 border-ink/15 bg-card p-6 text-ink shadow-block sm:p-7" onClick={(e) => e.stopPropagation()}>
          <h3 className="font-display text-2xl font-extrabold">Plan Semilla</h3>
          <p className="mt-2 text-sm text-inkmute">Gratis para siempre: 25 reservas al mes, 1 profesional y tu link. Sin tarjeta.</p>
          <p className="mt-3 text-sm text-inkmute">Si tenés débito automático, primero cancelamos la suscripción en Mercado Pago para detener los próximos cobros.</p>
          {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
          <button disabled={processing} onClick={pickFree} className="mt-6 w-full rounded-full bg-slate-900 hover:bg-slate-800 py-4 font-display text-base font-bold text-white transition-all hover:-translate-y-0.5 shadow-sm">
            {processing ? "Cancelando suscripción…" : "Quedarme en Semilla"}
          </button>
          <button onClick={onClose} className="mt-3 w-full text-center text-sm font-bold text-inkmute hover:text-ink">Cancelar</button>
        </div>
      </div>
    );
  }

  const price = PLAN_AMOUNTS[plan][billing];
  const yearlySave = (PLAN_AMOUNTS[plan].mensual - PLAN_AMOUNTS[plan].anual) * 12;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/60 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div className="pop-in w-full max-w-md rounded-[22px] border-2 border-ink/15 bg-card p-6 text-ink shadow-block sm:p-7" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-2xl font-extrabold">Plan {PLAN_META[plan].name}</h3>
            <p className="mt-1 text-sm text-inkmute">El cobro lo hace MercadoPago. El plan se activa cuando el pago queda autorizado, no antes.</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ink/15 text-inkmute transition-colors hover:border-coral hover:text-coral">✕</button>
        </div>

        <div className="relative mt-5 inline-flex w-full rounded-full border-2 border-ink/12 bg-paper p-1">
          <span className={`absolute bottom-1 top-1 w-[calc(50%-4px)] rounded-full bg-slate-900 transition-transform duration-300 ${billing === "mensual" ? "translate-x-0" : "translate-x-full"}`} style={{ left: 4 }} aria-hidden="true" />
          {(["mensual", "anual"] as const).map((b) => (
            <button key={b} type="button" onClick={() => setBilling(b)}
              className={`relative z-10 flex-1 rounded-full py-2 font-display text-xs font-bold uppercase tracking-wider transition-colors ${billing === b ? "text-white" : "text-ink/60"}`}>
              {b}{b === "anual" ? " · ahorro anual" : ""}
            </button>
          ))}
        </div>

        <p className="mt-5 font-display text-4xl font-extrabold text-fern">${price.toLocaleString("es-AR")}<span className="text-base font-bold text-inkmute"> ARS / mes</span></p>
        <p className="mt-1 text-xs text-inkmute">
          {billing === "anual" ? `Se cobran ${checkoutAmount(plan, billing).toLocaleString("es-AR")} ARS en un pago anual. Ahorrás ${yearlySave.toLocaleString("es-AR")} al año.` : "Facturado mes a mes. Cancelás cuando quieras."}
        </p>

        <ul className="mt-5 space-y-2">
          {FEATURES[plan].map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm text-ink/80">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800"><IconCheck className="h-3 w-3" /></span>{f}
            </li>
          ))}
        </ul>

        {error && (
          <div className="mt-4 rounded-xl border-2 border-coral/40 bg-coral/10 p-3 text-xs text-coral">
            <p className="font-semibold">{error}</p>
            {error.includes("MP_ACCESS_TOKEN") && (
              <div className="mt-3 border-t border-coral/20 pt-2.5">
                <p className="text-inkmute">
                  Los pagos todavía no están configurados en este entorno. Si sos el dueño, agregá MP_ACCESS_TOKEN en Vercel.
                </p>
                {(typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) && (
                  <button
                    type="button"
                    onClick={() => {
                      setPlan(plan);
                      toast(`Plan ${PLAN_META[plan].name} activado en modo demo local ✓`);
                      if (user?.email) {
                        sendSubscriptionWelcomeEmail({
                          toEmail: user.email,
                          ownerName: user.name,
                          businessName: user.business,
                          planName: PLAN_META[plan].name,
                          planPrice: PLAN_META[plan].price,
                          slug: user.slug,
                          benefits: PLAN_BENEFITS[plan],
                        }).catch(() => {});
                      }
                      onClose();
                    }}
                    className="mt-2 rounded-lg bg-coral/20 px-3 py-1.5 font-bold text-coral transition-colors hover:bg-coral hover:text-white"
                  >
                    Activar {PLAN_META[plan].name} solo en local (demo)
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <button onClick={() => pay(plan)} disabled={processing}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-700 py-4 font-display text-base font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-60 shadow-md shadow-emerald-900/20">
          {processing ? (<><span className="blinkdot h-2.5 w-2.5 rounded-full bg-white" /> Conectando con Mercado Pago…</>) : (<>Pagar con Mercado Pago <IconArrow className="h-4 w-4" /></>)}
        </button>
        <p className="mt-3 text-center text-[11px] leading-snug text-inkmute">
          Tu suscripción se procesa en el sitio seguro de Mercado Pago.
        </p>
      </div>
    </div>
  );
}
