import { calcularDimensiones } from "./tableroUtils";

export default function Tablero({ casillas = {}, onCasillaClick, deshabilitado }) {
  const { filas, columnas } = calcularDimensiones(casillas);

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

      // Cuántas bombas propias hay en esta casilla (solo para mostrarte a ti
      // mismo durante la preparación, nunca las del rival - eso lo resolvemos
      // más adelante con el "ocultamiento a los 3 segundos", RQNF-GAM-03B)
      const cantidadBombas = casilla.bombas?.length || 0;

      celdas.push(
        <button
          key={clave}
          className={`casilla ${claseEstado}`}
          data-casilla={clave}
          disabled={deshabilitado}
          onClick={() => onCasillaClick(clave)}
        >
          {cantidadBombas > 0 && (
            <span className="indicador-bomba">{cantidadBombas}</span>
          )}
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