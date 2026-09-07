import { useState } from "react";
import { Check, ChevronDown, Sparkles, ArrowRight, X } from "lucide-react";
import { useStore, defaultHours, type Plan } from "../lib/store";
import type { DashboardView } from "./Sidebar";

interface SetupGuideProps {
  onGo: (v: DashboardView) => void;
  onCheckout: (p: Plan) => void;
}

export default function SetupGuide({ onGo, onCheckout }: SetupGuideProps) {
  const { user, data, updateSettings } = useStore();
  const [collapsed, setCollapsed] = useState(false);

  if (!user || !data || data.settings.setupDismissed) return null;

  const steps = [
    {
      id: "servicio",
      done: data.services.length > 0,
      title: "1. Cargá tu primer servicio",
      hint: "Nombre, precio y duración.",
      go: () => onGo("servicios"),
    },
    {
      id: "horarios",
      done: JSON.stringify(data.settings.hours) !== JSON.stringify(defaultHours()),
      title: "2. Confirmá días y horarios",
      hint: "Configurá cuándo abrís tu local.",
      go: () => onGo("ajustes"),
    },
    {
      id: "pagina",
      done: !!(data.settings.whatsapp || data.settings.description || data.settings.address),
      title: "3. Completá tu página",
      hint: "WhatsApp, dirección o descripción.",
      go: () => onGo("ajustes"),
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-black/[0.06] bg-white p-4 sm:p-5 shadow-xs transition-all">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-[#1D1D1F]">
            <Sparkles size={16} className="text-[#16A34A]" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-bold text-[#1D1D1F]">
                Guía de inicio ({doneCount}/3 completados)
              </h3>
            </div>
            <p className="text-xs text-[#6E6E73]">Completá estos 3 pasos para recibir reservas.</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expandir guía" : "Colapsar guía"}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#6E6E73] hover:bg-neutral-100 transition-colors"
          >
            <ChevronDown size={16} className={`transition-transform ${collapsed ? "-rotate-90" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => updateSettings({ setupDismissed: true })}
            aria-label="Descartar guía"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#6E6E73] hover:bg-neutral-100 transition-colors"
            title="Ocultar guía"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="mt-4 grid gap-2 sm:grid-cols-3 pt-3 border-t border-black/[0.04]">
          {steps.map((step) => (
            <button
              key={step.id}
              type="button"
              onClick={step.go}
              className={`group flex items-start justify-between gap-3 rounded-xl p-3 text-left transition-all ${
                step.done
                  ? "bg-neutral-50/80 text-neutral-400"
                  : "bg-[#F5F5F7] hover:bg-neutral-200/60 active:scale-[0.99]"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-bold leading-tight ${step.done ? "line-through text-neutral-400" : "text-[#1D1D1F]"}`}>
                  {step.title}
                </p>
                <p className="mt-1 text-[11px] text-[#6E6E73]">{step.hint}</p>
              </div>
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  step.done ? "bg-[#16A34A] text-white" : "border border-neutral-300 bg-white text-transparent group-hover:border-black"
                }`}
              >
                {step.done ? <Check size={12} strokeWidth={3} /> : null}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
