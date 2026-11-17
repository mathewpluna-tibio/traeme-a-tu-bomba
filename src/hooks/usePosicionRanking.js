import { useEffect, useState } from "react";
import { collection, getCountFromServer, query, where } from "firebase/firestore";
import { db } from "../firebase/config";

/**
 * Estadística con la que se ordena el ranking global de cada modalidad
 * (la misma que abre por defecto la vista de Rankings, RQF-RAN-02).
 */
export const CAMPO_RANKING_GLOBAL = {
  estandar: "elo",
  venenosas: "elo",
  elementales: "casillasMarcadas",
};

/**
 * Posición del jugador en el ranking global de una modalidad (RQF-PER-06).
 * Cuenta en el servidor cuántos jugadores tienen un valor mayor con
 * getCountFromServer() (no descarga los documentos) y suma 1.
 * Devuelve null mientras carga o si el jugador no tiene esa estadística.
 */
export function usePosicionRanking(estadisticas, modalidad) {
  const campo = CAMPO_RANKING_GLOBAL[modalidad];
  const valor = campo ? estadisticas?.[modalidad]?.[campo] : undefined;
  const [resultado, setResultado] = useState({ clave: null, posicion: null });
  const clave = campo && typeof valor === "number" ? `${modalidad}:${valor}` : null;

  useEffect(() => {
    if (!clave) return;
    let cancelado = false;
    const q = query(
      collection(db, "usuarios"),
      where(`estadisticas.${modalidad}.${campo}`, ">", valor)
    );
    getCountFromServer(q)
      .then((snap) => {
        if (!cancelado) setResultado({ clave, posicion: snap.data().count + 1 });
      })
      .catch((err) => {
        console.error("No se pudo calcular la posición en el ranking:", err);
      });
    return () => {
      cancelado = true;
    };
  }, [clave, modalidad, campo, valor]);

  return resultado.clave === clave ? resultado.posicion : null;
}