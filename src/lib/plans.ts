/** Catálogo compartido por la web, el panel y el cobro de suscripciones. */
export type Plan = "semilla" | "crece" | "escala";
export type BillingCycle = "mensual" | "anual";
export const PAID_PLANS = ["crece", "escala"] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];
export const SEMILLA_MONTHLY_LIMIT = 25;
export const PRO_LIMIT: Record<Plan, number> = { semilla: 1, crece: 3, escala: 99 };
// Anual expresa el equivalente mensual; el checkout cobra doce meses juntos.
export const PLAN_AMOUNTS: Record<PaidPlan, Record<BillingCycle, number>> = {
  crece: { mensual: 9500, anual: 7900 },
  escala: { mensual: 22000, anual: 18300 },
};
export const PLAN_META = {
  semilla: { name: "Semilla", price: "$0" },
  crece: { name: "Crece", price: `$${PLAN_AMOUNTS.crece.mensual.toLocaleString("es-AR")}/mes` },
  escala: { name: "Escala", price: `$${PLAN_AMOUNTS.escala.mensual.toLocaleString("es-AR")}/mes` },
};
export const PLAN_FEATURES: Record<Plan, string[]> = {
  semilla: [
    `Hasta ${SEMILLA_MONTHLY_LIMIT} reservas activas por mes`, "1 profesional",
    "Página y enlace de reservas", "Agenda y clientes en un lugar", "Horarios y días cerrados configurables",
  ],
  crece: [
    "Reservas ilimitadas", `Hasta ${PRO_LIMIT.crece} profesionales`,
    "Señas por transferencia, verificadas por el local", "Tienda de productos y cupones",
    "Colores y descripción de tu página", "Horarios por profesional",
  ],
  escala: [
    "Todo lo de Crece", `Hasta ${PRO_LIMIT.escala} profesionales`,
    "Estadísticas avanzadas", "Exportación de reportes en CSV para Excel",
    "Lista de espera: clientes recurrentes primero",
  ],
};
export const PLAN_BENEFITS: Record<PaidPlan, string[]> = { crece: PLAN_FEATURES.crece, escala: PLAN_FEATURES.escala };
export const isPaidPlan = (p: Plan): p is PaidPlan => p === "crece" || p === "escala";
export const checkoutAmount = (plan: PaidPlan, cycle: BillingCycle) => PLAN_AMOUNTS[plan][cycle] * (cycle === "anual" ? 12 : 1);
