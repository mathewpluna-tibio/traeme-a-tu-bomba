import { calcularDimensionesElemental, casillaBloqueada } from "./elementalesUtils";

export default function TableroElemental({
  partida,
  colorPorUid,
  casillasResaltadas = [],
  casillasSeleccionadas = [],
  onCasillaClick,
  deshabilitado,
  casillaEnProceso = null,
}) {
  const { filas, columnas } = calcularDimensionesElemental(partida);
  const resaltadas = new Set(casillasResaltadas);
  const seleccionadas = new Set(casillasSeleccionadas);

  const celdas = [];
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < columnas; c++) {
      const clave = `${f}_${c}`;
      const casilla = partida.casillas[clave];

      if (!casilla) {
        celdas.push(<div key={clave} className="casilla-elemental casilla-hueco" />);
        continue;
      }

      const color = casilla.marcadaPor ? colorPorUid[casilla.marcadaPor] : null;
      const bloqueada = casillaBloqueada(clave, partida);
      const esResaltada = resaltadas.has(clave);
      const esSeleccionada = seleccionadas.has(clave);

      const clases = ["casilla-elemental"];
      if (color) clases.push(`casilla-elemental-${color}`);
      if (bloqueada) clases.push("casilla-elemental-bloqueada");
      if (esResaltada) clases.push("casilla-elemental-jugable");
      if (esSeleccionada) clases.push("casilla-elemental-seleccionada");
      const enProceso = casillaEnProceso === clave;
      if (enProceso) clases.push("casilla-elemental-procesando");

      celdas.push(
        <button
          key={clave}
          className={clases.join(" ")}
          data-casilla={clave}
          disabled={deshabilitado || (!esResaltada && !esSeleccionada && !enProceso)}
          onClick={() => onCasillaClick(clave)}
          title={bloqueada ? "Bloqueada por Lianas" : undefined}
        >
          {enProceso && <span className="spinner-mini" />}
          {bloqueada && <span className="icono-elemental">🌿</span>}
        </button>
      );
    }
  }

  return (
    <div
      className="tablero-elemental-grid"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columnas}, 1fr)`,
        gap: "3px",
      }}
    >
      {celdas}
    </div>
  );
}