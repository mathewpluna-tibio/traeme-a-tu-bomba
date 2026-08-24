import { useState, useEffect } from "react";
import { calcularDimensiones, bombaEsVisible } from "./tableroUtils";

export default function Tablero({ casillas = {}, onCasillaClick, deshabilitado }) {
  const { filas, columnas } = calcularDimensiones(casillas);

  // "Reloj" que se actualiza cada 500ms para que las bombas del rival
  // desaparezcan visualmente justo al cumplirse los 3 segundos
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => {
    const intervalo = setInterval(() => setAhora(Date.now()), 500);
    return () => clearInterval(intervalo);
  }, []);

  const celdas = [];
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < columnas; c++) {
      const clave = `${f}_${c}`;
      const casilla = casillas[clave];

      if (!casilla) {
        celdas.push(<div key={clave} className="casilla casilla-hueco" />);
        continue;
      }

      const claseEstado = casilla.segura === true
        ? "casilla-segura"
        : "casilla-sin-activar";

      const bombasVisibles = (casilla.bombas || []).filter((b) =>
        bombaEsVisible(b, ahora)
      );

      const tieneAlgoVisible = bombasVisibles.length > 0;

      // Sin número de cantidad, solo presencia (Fomento de la Memoria)
      celdas.push(
        <button
          key={clave}
          className={`casilla ${claseEstado}`}
          data-casilla={clave}
          disabled={deshabilitado}
          onClick={() => onCasillaClick(clave)}
        >
          {tieneAlgoVisible && <span className="indicador-bomba">●</span>}
        </button>
      );
    }
  }

  return (
    <div
      className="tablero-grid"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columnas}, 1fr)`,
        gap: "4px",
      }}
    >
      {celdas}
    </div>
  );
}