import type { Plan } from "./store";

export type BillingCycle = "mensual" | "anual";

export const PAID_PLANS = ["crece", "escala"] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];
export const isPaidPlan = (p: Plan): p is PaidPlan => p === "crece" || p === "escala";

export const PLAN_AMOUNTS: Record<PaidPlan, Record<BillingCycle, number>> = {
  crece: { mensual: 9900, anual: 9400 },
  escala: { mensual: 23000, anual: 18400 },
};

const PENDING_KEY = "cupito_mp_pending";

export function requestCheckout(plan: Plan) {
  window.dispatchEvent(new CustomEvent("cupito-checkout", { detail: plan }));
}

export function savePendingCheckout(plan: PaidPlan, billing: BillingCycle) {
  try { sessionStorage.setItem(PENDING_KEY, JSON.stringify({ plan, billing, at: Date.now() })); } catch { /* noop */ }
}

export function readPendingCheckout(): { plan: PaidPlan; billing: BillingCycle } | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { plan?: PaidPlan; billing?: BillingCycle };
    if (p.plan === "crece" || p.plan === "escala") {
      return { plan: p.plan, billing: p.billing === "anual" ? "anual" : "mensual" };
    }
  } catch { /* noop */ }
  return null;
}

export function clearPendingCheckout() {
  try { sessionStorage.removeItem(PENDING_KEY); } catch { /* noop */ }
}

/** MercadoPago puede devolver el id en search (?preapproval_id=) o en el hash (#/app?preapproval_id=). */
export function getPreapprovalIdFromUrl(): string | null {
  const search = new URLSearchParams(window.location.search);
  const fromSearch = search.get("preapproval_id") || search.get("preapprovalId") || search.get("preapproval");
  const hash = window.location.hash || "";
  const q = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  const fromHash = new URLSearchParams(q).get("preapproval_id")
    || new URLSearchParams(q).get("preapprovalId")
    || new URLSearchParams(q).get("preapproval");
  return fromSearch || fromHash || null;
}

export function getHashParam(name: string): string | null {
  const hash = window.location.hash || "";
  const q = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  return new URLSearchParams(q).get(name);
}

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export async function createMercadoPagoCheckout(opts: {
  plan: PaidPlan;
  billing: BillingCycle;
  email?: string;
}): Promise<CheckoutResult> {
  try {
    const res = await fetch("/api/create-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: opts.plan, billing: opts.billing, email: opts.email }),
    });
    const r = await res.json().catch(() => ({}));
    if (r.demo) {
      return { ok: false, error: "Mercado Pago no tiene configurado MP_ACCESS_TOKEN en Vercel (Settings → Environment Variables). Agregá tu token para habilitar los pagos reales." };
    }
    if (!res.ok || r.error) {
      return { ok: false, error: String(r.error || "Mercado Pago rechazó la solicitud de suscripción. Por favor intentá nuevamente.") };
    }
    const url = r.init_point || r.sandbox_init_point || r.sandbox;
    if (!url) return { ok: false, error: "Mercado Pago no devolvió el link de pago." };
    return { ok: true, url };
  } catch {
    return { ok: false, error: "No pudimos conectar con el servidor de Mercado Pago. Revisá tu conexión a internet." };
  }
}

export async function confirmMercadoPago(preapprovalId: string): Promise<{
  authorized: boolean;
  plan: PaidPlan | null;
  status: string;
  error?: string;
}> {
  try {
    const res = await fetch("/api/confirm-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: preapprovalId }),
    });
    const r = await res.json().catch(() => ({}));
    if (!res.ok) return { authorized: false, plan: null, status: "error", error: r.error || "No se pudo confirmar el pago." };
    const plan: PaidPlan | null = r.plan === "escala" ? "escala" : r.plan === "crece" ? "crece" : null;
    return { authorized: r.authorized === true, plan, status: String(r.status || "") };
  } catch {
    return { authorized: false, plan: null, status: "error", error: "No se pudo confirmar el pago con MercadoPago." };
  }
}
