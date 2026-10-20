import imgMinibomba from "../../assets/bombas/minibomba.png";
import imgBomba from "../../assets/bombas/bomba.png";
import imgBombota from "../../assets/bombas/bombota.png";
import imgVenenosa from "../../assets/bombas/venenosa.png";
import imgElectrica from "../../assets/bombas/electrica.png";
import imgHielo from "../../assets/bombas/hielo.png";
import imgLianas from "../../assets/bombas/lianas.png";

// Imagen de cada tipo de bomba. Las claves coinciden con `bomba.tipo` en la
// base de datos (clase del jugador, o "veneno" en Bombas Venenosas) y con
// los tipos de bomba elemental.
export const IMAGEN_BOMBA = {
  minibomba: imgMinibomba,
  bomba: imgBomba,
  bombota: imgBombota,
  veneno: imgVenenosa,
  electrica: imgElectrica,
  hielo: imgHielo,
  lianas: imgLianas,
};

export const NOMBRE_BOMBA = {
  minibomba: "MiniBomba",
  bomba: "Bomba",
  bombota: "Bombota",
  veneno: "Bomba venenosa",
  electrica: "Eléctrica",
  hielo: "Hielo",
  lianas: "Lianas",
};

// De la más débil a la más fuerte: en una casilla con varias bombas se
// muestra (y suena) la más fuerte.
const ORDEN_FUERZA = ["minibomba", "veneno", "bomba", "bombota"];

export function bombaMasFuerte(bombas = []) {
  let mejor = null;
  for (const b of bombas) {
    if (!mejor || ORDEN_FUERZA.indexOf(b.tipo) > ORDEN_FUERZA.indexOf(mejor)) mejor = b.tipo;
  }
  return mejor;
}