import { useMemo, useState } from "react";
import { useGuia } from "../../hooks/useGuia";
import "./Guia.css";

// Orden y nombre de las pestañas. Una categoría nueva en Firestore que no esté
// aquí se muestra al final con su propio nombre.
const CATEGORIAS = [
  { key: "basico", label: "Cómo jugar" },
  { key: "bombas", label: "Bombas" },
  { key: "tableros", label: "Tableros" },
  { key: "modos", label: "Modos de juego" },
  { key: "rangos", label: "Rangos" },
  { key: "tienda", label: "Tienda" },
  { key: "coronas", label: "Coronas" },
];

const nombreCategoria = (key) =>
  CATEGORIAS.find((c) => c.key === key)?.label || key.charAt(0).toUpperCase() + key.slice(1);

function Seccion({ item, abierta, onAlternar }) {
  return (
    <div className={"gu-card" + (abierta ? " gu-card--open" : "")}>
      <button type="button" className="gu-card-header" aria-expanded={abierta} onClick={onAlternar}>
        <span className="gu-card-title">{item.titulo}</span>
        <span className="gu-card-arrow" aria-hidden="true" />
      </button>
      {abierta && (
        <div className="gu-card-body">
          {String(item.cuerpo || "")
            .split("\n")
            .filter(Boolean)
            .map((p, i) => (
              <p key={i}>{p}</p>
            ))}
        </div>
      )}
    </div>
  );
}

export default function GuiaPage({ onVolver }) {
  const { secciones, cargando } = useGuia();
  const [categoria, setCategoria] = useState("basico");
  const [abierta, setAbierta] = useState(null);

  const categorias = useMemo(() => {
    const presentes = new Set(secciones.map((s) => s.categoria));
    const conocidas = CATEGORIAS.filter((c) => presentes.has(c.key)).map((c) => c.key);
    const extra = [...presentes].filter((k) => !CATEGORIAS.some((c) => c.key === k));
    return [...conocidas, ...extra];
  }, [secciones]);

  const activa = categorias.includes(categoria) ? categoria : categorias[0];
  const visibles = secciones.filter((s) => s.categoria === activa);

  return (
    <div className="gu-page">
      <div className="gu-container">
        {onVolver && (
          <button type="button" className="gu-back" onClick={onVolver}>
            ← Volver al menú
          </button>
        )}

        <header>
          <h2 className="gu-title">Guía del juego</h2>
          <p className="gu-subtitle">Reglas, mecánicas y modos de Traeme a tu bomba</p>
        </header>

        {cargando ? (
          <p className="gu-muted">Cargando guía...</p>
        ) : (
          <>
            <nav className="gu-tabs">
              {categorias.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={"gu-tab" + (activa === key ? " gu-tab--active" : "")}
                  onClick={() => {
                    setCategoria(key);
                    setAbierta(null);
                  }}
                >
                  {nombreCategoria(key)}
                </button>
              ))}
            </nav>

            <div className="gu-sections">
              {visibles.map((item) => (
                <Seccion
                  key={item.id}
                  item={item}
                  abierta={abierta === item.id}
                  onAlternar={() => setAbierta((a) => (a === item.id ? null : item.id))}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}