import { MARCOS, BANNERS } from "../../data/cosmeticos";

// Objetivos que puede medir una misión de evento. Los ids son los mismos
// "tipos" que ya cuentan las misiones diarias y los logros (functions/eventos.js).
export const TIPOS_EVENTO = [
  { id: "victoria", label: "Ganar partidas" },
  { id: "partida_jugada_estandar", label: "Jugar partidas en Estándar" },
  { id: "partida_jugada_venenosas", label: "Jugar partidas en Venenosas" },
  { id: "partida_jugada_elementales", label: "Jugar partidas en Elementales" },
  { id: "victoria_elementales", label: "Ganar partidas de Bombas Elementales" },
  { id: "victoria_sin_perder_vida", label: "Ganar partidas sin perder una sola vida" },
  { id: "bomba_colocada", label: "Colocar bombas" },
  { id: "casilla_segura_descubierta", label: "Descubrir casillas seguras" },
  { id: "casilla_marcada_elemental", label: "Marcar casillas en Elementales" },
  { id: "bomba_hielo_usada", label: "Usar la Bomba de Hielo" },
  { id: "bomba_elemental_usada", label: "Usar bombas elementales" },
  { id: "partida_con_bombota", label: "Jugar partidas con la Bombota" },
];

export const etiquetaTipo = (id) => TIPOS_EVENTO.find((t) => t.id === id)?.label || id;

/** Marcos/banners que NO se venden en la Tienda y pueden ser exclusivos de
 * evento. Para sumar uno nuevo basta registrarlo en data/cosmeticos.js con
 * `precio: null` y aparece aquí solo (la imagen sí hay que agregarla). */
export function cosmeticosDeEvento(tipo) {
  const catalogo = tipo === "marco" ? MARCOS : BANNERS;
  return Object.values(catalogo).filter((c) => c.precio == null && c.id !== "Default");
}

export function nombreCosmetico(c) {
  if (!c) return "";
  if (c.tipo === "titulo") return c.id;
  const catalogo = c.tipo === "marco" ? MARCOS : BANNERS;
  return catalogo[c.id]?.nombre || c.id;
}

export const ETIQUETA_COSMETICO = { marco: "Marco", banner: "Banner", titulo: "Título" };

/** "2 d 4 h", "3 h 12 min", "5 min" */
export function formatoRestante(ms) {
  if (ms <= 0) return "0 min";
  const min = Math.floor(ms / 60000);
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  return `${Math.max(1, m)} min`;
}

export function formatoFecha(ms) {
  return new Date(ms).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
}

/** Estado de un evento según la hora actual. */
export function estadoEvento(evento, ahora) {
  if (ahora < evento.inicio) return "programado";
  if (ahora < evento.fin) return "activo";
  return "concluido";
}