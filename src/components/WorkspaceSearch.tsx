import { useEffect, useRef, useState } from "react";
import { ArrowRight, Plus, Search, X } from "lucide-react";

export default function WorkspaceSearch({ items, onSelect, onNew, onClose }: {
  items: { id: string; label: string; group: string }[];
  onSelect: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const filtered = items.filter(item => normalize(item.label + " " + item.group).includes(normalize(query.trim())));
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return <dialog ref={dialog} className="workspace-search" aria-label="Buscar en el panel" onCancel={onClose} onClick={event => { if (event.target === dialog.current) onClose(); }}>
    <div className="workspace-search-input">
      <Search size={21} aria-hidden="true" />
      <input autoFocus aria-label="Buscar sección o acción" placeholder="¿Qué necesitás hacer?" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => {
        if (event.key === "ArrowDown") { event.preventDefault(); dialog.current?.querySelector<HTMLButtonElement>(".workspace-search-results button")?.focus(); }
        if (event.key === "Enter" && filtered.length) { onSelect(filtered[0].id); onClose(); }
      }} />
      <button type="button" onClick={onClose} aria-label="Cerrar búsqueda"><X size={20} /></button>
    </div>
    <div className="workspace-search-results" onKeyDown={event => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      event.preventDefault();
      buttons[(index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
    }}>
      {!query && <button type="button" onClick={() => { onNew(); onClose(); }}><span className="workspace-search-icon"><Plus size={19} /></span><span><strong>Nueva reserva</strong><small>Agendá un turno para tu cliente</small></span><ArrowRight size={17} /></button>}
      {filtered.map(item => <button type="button" key={item.id} onClick={() => { onSelect(item.id); onClose(); }}><span><strong>{item.label}</strong><small>{item.group}</small></span><ArrowRight size={17} /></button>)}
      {!filtered.length && <p>No encontramos esa sección. Probá con “horarios”, “clientes” o “reservas”.</p>}
    </div>
    <div className="workspace-search-footer">↑ ↓ para moverte · Enter para abrir · Esc para cerrar</div>
  </dialog>;
}
