import { useEffect, useState } from "react";

const PAUSA_INICIAL_MS = 700;

/**
 * Progreso (cuántas casillas ya se muestran) del relleno final de Bombas
 * Elementales. El servidor deja en `partida.relleno` la lista ordenada de
 * casillas y el ritmo; cada cliente las va revelando una a una. Si se abre o
 * recarga la partida a mitad del relleno, se retoma por donde va.
 */
export function useProgresoRelleno(relleno, offset = 0) {
  const total = relleno?.casillas?.length || 0;
  const paso = relleno?.pasoMs || 100;
  const en = relleno?.en;
  const [progreso, setProgreso] = useState(0);

  useEffect(() => {
    if (!total) {
      setProgreso(0);
      return;
    }
    const transcurrido = Date.now() + offset - en - PAUSA_INICIAL_MS;
    let actual = Math.min(total, Math.max(0, Math.floor(transcurrido / paso)));
    setProgreso(actual);
    if (actual >= total) return;

    let intervalo;
    const arrancar = () => {
      intervalo = setInterval(() => {
        actual += 1;
        setProgreso(actual);
        if (actual >= total) clearInterval(intervalo);
      }, paso);
    };
    // Pausa inicial para que se vea el tablero antes de empezar a rellenar.
    const espera = transcurrido < 0 ? -transcurrido : 0;
    const t = setTimeout(arrancar, espera);
    return () => {
      clearTimeout(t);
      clearInterval(intervalo);
    };
  }, [total, paso, en, offset]);

  return { rellenando: total > 0, progreso, total };
}