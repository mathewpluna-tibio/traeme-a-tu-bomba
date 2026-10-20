import { useEffect, useLayoutEffect, useRef } from "react";
import { IMAGEN_BOMBA, bombaMasFuerte } from "../bombasAssets";
import { vecinosOrtogonales } from "../elementalesUtils";
import { precargarSonidos, reproducirSonido } from "./sonidos";
import {
  animarActivacion,
  animarBombaElemental,
  animarColocacion,
  animarDetonacion,
  animarMarca,
} from "./animaciones";

/**
 * Compara cada snapshot de la partida con el anterior y dispara las
 * animaciones y sonidos de lo que acaba de pasar. Como se basa en el estado
 * sincronizado de Realtime Database, ambos jugadores ven y oyen lo mismo.
 *
 * `contenedorRef` apunta al elemento que contiene el tablero (`.gp-board`)
 * y la capa de efectos (`.gp-fx`).
 */
export function useEfectosPartida(partida, contenedorRef) {
  const anteriorRef = useRef(null);

  useEffect(() => {
    precargarSonidos();
  }, []);

  // useLayoutEffect: la animación arranca antes de pintar el nuevo estado,
  // así la bomba recién colocada no "parpadea" en su posición final.
  useLayoutEffect(() => {
    const anterior = anteriorRef.current;
    anteriorRef.current = partida;
    const contenedor = contenedorRef.current;
    if (!anterior || !partida || !contenedor) return;
    // Cambio de ronda: el tablero es nuevo, no hay nada que comparar.
    if (anterior.ronda !== partida.ronda) return;

    const capa = contenedor.querySelector(".gp-fx");
    const tablero = contenedor.querySelector(".gp-board-grid");
    const celda = (clave) => contenedor.querySelector(`[data-casilla="${clave}"]`);
    const antes = anterior.casillas || {};
    const ahora = partida.casillas || {};
    const esElementales = partida.modalidad === "elementales";

    // --- Bombas Elementales: uso de bomba ---
    const bomba = partida.ultimaBomba;
    if (esElementales && bomba && bomba.en !== anterior.ultimaBomba?.en) {
      let extras = [];
      if (bomba.tipo === "electrica") {
        extras = vecinosOrtogonales(bomba.casilla, partida).map(celda);
      } else if (bomba.tipo === "lianas") {
        extras = Object.keys(ahora)
          .filter((k) => ahora[k]?.bloqueadaHastaTurno != null && antes[k]?.bloqueadaHastaTurno == null)
          .map(celda);
      }
      // El sonido va primero y la animación en try/catch: si una falla no tumba a la otra.
      reproducirSonido(bomba.tipo);
      try {
        animarBombaElemental(bomba.tipo, celda(bomba.casilla), capa, IMAGEN_BOMBA[bomba.tipo], extras);
      } catch (err) {
        console.error("Error en la animación de la bomba elemental:", err);
      }
    }

    for (const clave of Object.keys(ahora)) {
      const a = antes[clave] || {};
      const n = ahora[clave] || {};

      if (esElementales) {
        // Las casillas del relleno final las anima TableroElemental, una por una.
        if (partida.relleno?.casillas?.includes(clave)) continue;
        if (n.marcadaPor && n.marcadaPor !== a.marcadaPor && clave !== bomba?.casilla) {
          animarMarca(celda(clave));
        }
        continue;
      }

      // Colocación (fase de preparación)
      if ((n.bombas?.length || 0) > (a.bombas?.length || 0)) {
        animarColocacion(celda(clave));
      }
      // Activación de casilla segura
      if (n.segura === true && a.segura !== true) {
        animarActivacion(celda(clave), capa);
      }
      // Detonación
      if (n.detonada === true && a.detonada !== true) {
        const tipo = bombaMasFuerte(n.bombas) || "bomba";
        reproducirSonido(partida.modalidad === "venenosas" ? "veneno" : tipo);
        try {
          animarDetonacion(celda(clave), capa, tablero, IMAGEN_BOMBA[tipo] || IMAGEN_BOMBA.bomba);
        } catch (err) {
          console.error("Error en la animación de detonación:", err);
        }
      }
    }
  }, [partida, contenedorRef]);
}