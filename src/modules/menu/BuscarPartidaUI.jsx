import { useState } from "react";
import "./BuscarPartida.css";

// Muestra la imagen de la bomba; si no hay o falla, usa el emoji de respaldo.
export function VisualBomba({ item }) {
  const [fallo, setFallo] = useState(false);
  if (!item.imagen || fallo) return <span className="sm-card-emoji">{item.emoji}</span>;
  return <img src={item.imagen} alt={item.nombre} onError={() => setFallo(true)} />;
}

export function TarjetaBomba({ item, seleccionada, onSeleccionar, deshabilitada }) {
  return (
    <button
      type="button"
      className={"sm-card" + (seleccionada ? " sm-card--selected" : "")}
      onClick={() => onSeleccionar(item.id)}
      disabled={deshabilitada}
      data-clase-id={item.id}
    >
      <div className="sm-card-image">
        <VisualBomba item={item} />
      </div>
      <span className="sm-card-name">{item.nombre}</span>
      <span className="sm-card-desc">{item.desc}</span>
      {item.detalle && <span className="sm-card-detail">{item.detalle}</span>}
    </button>
  );
}

const PASOS = [
  { key: "modo", label: "Modalidad", n: 1 },
  { key: "clase", label: "Clase", n: 2 },
  { key: "busqueda", label: "Búsqueda", n: 3 },
];

/**
 * Marco común del flujo Modalidad → Clase → Búsqueda (RQNF-MEN-02).
 * paso: "modo" | "clase" | "busqueda"
 */
export function PanelBuscar({ titulo, paso, conClase, onAtras, children, pie }) {
  const orden = PASOS.map((p) => p.key);
  return (
    <div className="sm-page">
      <div className="sm-panel">
        <header className="sm-header">
          {onAtras ? (
            <button type="button" className="sm-back" onClick={onAtras} aria-label="Volver">
              ←
            </button>
          ) : (
            <span className="sm-header-spacer" />
          )}
          <h1 className="sm-title">{titulo}</h1>
          <span className="sm-header-spacer" />
        </header>

        <ol className="sm-steps">
          {PASOS.filter((p) => p.key !== "clase" || conClase).map((p) => (
            <li
              key={p.key}
              className={
                "sm-step" +
                (p.key === paso ? " sm-step--active" : "") +
                (orden.indexOf(p.key) < orden.indexOf(paso) ? " sm-step--done" : "")
              }
            >
              <span className="sm-step-dot">{p.n}</span>
              {p.label}
            </li>
          ))}
        </ol>

        <section className="sm-view">{children}</section>

        {pie && <footer className="sm-footer">{pie}</footer>}
      </div>
    </div>
  );
}