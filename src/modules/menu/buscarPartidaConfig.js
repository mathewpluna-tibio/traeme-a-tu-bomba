import imgVenenosa from "../../assets/bombas/venenosa.png";
import imgElectrica from "../../assets/bombas/electrica.png";
import imgMinibomba from "../../assets/bombas/minibomba.png";
import imgBomba from "../../assets/bombas/bomba.png";
import imgBombota from "../../assets/bombas/bombota.png";

const iconoAleatoria =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><circle cx="60" cy="64" r="44" fill="#23242f" stroke="#ffd166" stroke-width="5"/><text x="60" y="84" font-family="Arial, sans-serif" font-size="64" font-weight="800" text-anchor="middle" fill="#ffd166">?</text><path d="M78 24 q12 -14 24 -8" fill="none" stroke="#ff9633" stroke-width="5" stroke-linecap="round"/></svg>`
  );

// RQF-MEN-02: modalidades. La imagen de la bomba es la portada del modo.
// `tieneClase`: tras elegirla se pide la clase de bomba (RQF-MEN-03, solo Estándar).
export const MODOS = [
  {
    id: "estandar",
    nombre: "Estándar",
    desc: "El clásico duelo de bombas y vidas.",
    imagen: imgBomba,
    emoji: "💣",
    tieneClase: true,
  },
  {
    id: "venenosas",
    nombre: "Bombas Venenosas",
    desc: "Las bombas dejan veneno que sigue haciendo daño.",
    imagen: imgVenenosa,
    emoji: "☠️",
    tieneClase: false,
  },
  {
    id: "elementales",
    nombre: "Bombas Elementales",
    desc: "Conquista el tablero con bombas de elementos.",
    imagen: imgElectrica,
    emoji: "⚡",
    tieneClase: false,
  },
];

// RQNF-MEN-03: cada clase tiene un id único. `detalle` = Ronda 1.
export const CLASES_BOMBA = [
  { id: "minibomba", nombre: "MiniBomba", desc: "Muchas bombas, poco daño.", detalle: "8 bombas · -0.5 vidas", imagen: imgMinibomba, emoji: "🔸" },
  { id: "bomba", nombre: "Bomba", desc: "El equilibrio perfecto.", detalle: "5 bombas · -1 vida", imagen: imgBomba, emoji: "💣" },
  { id: "bombota", nombre: "Bombota", desc: "Pocas bombas, daño devastador.", detalle: "3 bombas · -1.5 vidas", imagen: imgBombota, emoji: "🧨" },
  // Sin ilustración propia todavía: ícono "?" dibujado en SVG.
  { id: "aleatoria", nombre: "Aleatoria", desc: "Que decida la suerte.", detalle: "Se asigna al azar", imagen: iconoAleatoria, emoji: "?" },
];

export const buscarModo = (id) => MODOS.find((m) => m.id === id);
export const buscarClase = (id) => CLASES_BOMBA.find((c) => c.id === id);