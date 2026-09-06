import { useState, useRef, useEffect, type ReactNode } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  disabled?: boolean;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
  icon?: ReactNode;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Seleccionar opción",
  className = "",
  buttonClassName = "",
  disabled = false,
  icon,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`flex w-full items-center justify-between gap-2.5 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-left text-sm font-medium text-slate-900 shadow-xs transition-all duration-150 hover:border-emerald-600/40 hover:bg-slate-50/50 focus:border-emerald-600 focus:outline-hidden focus:ring-3 focus:ring-emerald-600/15 disabled:cursor-not-allowed disabled:opacity-50 ${buttonClassName}`}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {icon && <span className="text-slate-400 shrink-0">{icon}</span>}
          {selectedOption ? (
            <span className="truncate">
              {selectedOption.label}
              {selectedOption.sublabel && (
                <span className="ml-1.5 text-xs text-slate-500 font-normal">
                  · {selectedOption.sublabel}
                </span>
              )}
            </span>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-emerald-600" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute z-50 mt-1.5 max-h-60 w-full min-w-[200px] overflow-auto rounded-xl border border-slate-200/90 bg-white/95 p-1.5 shadow-xl shadow-slate-900/10 backdrop-blur-md transition-all animate-in fade-in zoom-in-95 duration-100"
        >
          {options.length === 0 ? (
            <div className="py-2.5 px-3 text-center text-xs text-slate-400">
              No hay opciones disponibles
            </div>
          ) : (
            options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={opt.disabled}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`group flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    isSelected
                      ? "bg-emerald-50 font-semibold text-emerald-800"
                      : "text-slate-700 hover:bg-slate-100/80 hover:text-slate-900"
                  } ${opt.disabled ? "cursor-not-allowed opacity-40" : ""}`}
                >
                  <div className="min-w-0 truncate">
                    <div className="truncate">{opt.label}</div>
                    {opt.sublabel && (
                      <div
                        className={`text-xs ${
                          isSelected ? "text-emerald-600/80" : "text-slate-400 group-hover:text-slate-500"
                        }`}
                      >
                        {opt.sublabel}
                      </div>
                    )}
                  </div>
                  {isSelected && (
                    <Check size={16} className="shrink-0 text-emerald-600" />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default CustomSelect;
