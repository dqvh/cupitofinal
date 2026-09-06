import { useState, createContext, useContext, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface AccordionContextType {
  openItem: string | null;
  toggleItem: (value: string) => void;
}

const AccordionContext = createContext<AccordionContextType>({
  openItem: null,
  toggleItem: () => {},
});

export function Accordion({
  children,
  className = "",
}: {
  type?: "single";
  collapsible?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [openItem, setOpenItem] = useState<string | null>(null);

  const toggleItem = (value: string) => {
    setOpenItem((prev) => (prev === value ? null : value));
  };

  return (
    <AccordionContext.Provider value={{ openItem, toggleItem }}>
      <div data-slot="accordion" className={className}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

const ItemContext = createContext<{ value: string; isOpen: boolean }>({
  value: "",
  isOpen: false,
});

export function AccordionItem({
  value,
  className = "",
  children,
}: {
  value: string;
  className?: string;
  children: ReactNode;
}) {
  const { openItem } = useContext(AccordionContext);
  const isOpen = openItem === value;

  return (
    <ItemContext.Provider value={{ value, isOpen }}>
      <div
        data-slot="accordion-item"
        data-state={isOpen ? "open" : "closed"}
        className={`border-b last:border-b-0 ${className}`}
      >
        {children}
      </div>
    </ItemContext.Provider>
  );
}

export function AccordionTrigger({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const { toggleItem } = useContext(AccordionContext);
  const { value, isOpen } = useContext(ItemContext);

  return (
    <div className="flex">
      <button
        type="button"
        data-slot="accordion-trigger"
        data-state={isOpen ? "open" : "closed"}
        onClick={() => toggleItem(value)}
        className={`flex flex-1 items-start justify-between gap-4 py-4 text-left font-medium transition-all outline-hidden cursor-pointer ${className}`}
        aria-expanded={isOpen}
      >
        <span>{children}</span>
        <ChevronDown
          size={18}
          className={`shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
    </div>
  );
}

export function AccordionContent({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const { isOpen } = useContext(ItemContext);

  if (!isOpen) return null;

  return (
    <div
      data-slot="accordion-content"
      data-state="open"
      className={`overflow-hidden text-sm pb-4 ${className}`}
    >
      {children}
    </div>
  );
}
