import { useState, type CSSProperties } from "react";
import { ArrowUpRight, Check, Clock, Palette, CalendarDays } from "lucide-react";

const colors = [
  ["#16845f", "Verde"],
  ["#0f766e", "Esmeralda"],
  ["#315b8d", "Azul"],
  ["#855c92", "Violeta"],
];

export default function LandingTour() {
  const [name, setName] = useState("Estudio Bloom");
  const [color, setColor] = useState("#16845f");
  const [selected, setSelected] = useState("10:00");

  return (
    <section className="lp-tour" id="tu-marca">
      <div className="lp-tour-copy">
        <span className="lp-kicker">TU NEGOCIO TIENE SU PROPIA FORMA</span>
        <h2>
          Y tu página
          <br />
          también puede tenerla.
        </h2>
        <p>Un espacio con tu nombre, tus colores y tus horarios. Probá cómo se vería el tuyo.</p>
        <div className="lp-tour-controls">
          <label>
            Nombre de tu negocio
            <input
              maxLength={45}
              value={name}
              placeholder="El nombre de tu negocio"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <fieldset>
            <legend>Elegí un color</legend>
            <div className="lp-tour-colors">
              {colors.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-label={label}
                  aria-pressed={color === value}
                  style={{ background: value }}
                  onClick={() => setColor(value)}
                >
                  {color === value && <Check size={17} />}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        <span className="lp-tour-note">
          <Palette size={14} />
          Vista previa interactiva · no guarda cambios
        </span>
      </div>

      <div className="lp-tour-preview" style={{ "--tour-accent": color } as CSSProperties}>
        <div className="lp-tour-browser">
          <span>
            <i />
            <i />
            <i />
          </span>
          <span>Tu página de reservas</span>
          <CalendarDays size={14} />
        </div>
        <div className="lp-tour-page">
          <span className="lp-tour-monogram">
            {(name.trim() || "Tu negocio")
              .split(" ")
              .map((x) => x[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </span>
          <h3>{name.trim() || "Tu negocio"}</h3>
          <p>Un momento para vos. Elegí cuándo venir.</p>
          <div className="lp-tour-service">
            <span>
              <strong>Tu servicio favorito</strong>
              <small>
                <Clock size={12} />
                60 minutos
              </small>
            </span>
            <Check size={18} />
          </div>
          <div className="lp-tour-date">
            <span>Miércoles</span>
            <b>16 de septiembre</b>
            <small>Horarios de ejemplo</small>
          </div>
          <div className="lp-tour-slots">
            {["09:00", "10:00", "11:30", "14:00", "15:30", "17:00"].map((time) => (
              <button
                key={time}
                type="button"
                aria-pressed={selected === time}
                className={selected === time ? "chosen" : ""}
                onClick={() => setSelected(time)}
              >
                {time}
              </button>
            ))}
          </div>
          <a href="#/felipeprueba" className="lp-tour-cta">
            Abrir demo de reservas <ArrowUpRight size={17} />
          </a>
          <span className="lp-tour-powered">
            Reservas simples, con <b>cupito.</b>
          </span>
        </div>
      </div>
    </section>
  );
}
