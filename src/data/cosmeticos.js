/**
 * Catálogo de cosméticos (marcos y banners de perfil).
 *
 * Esto es la base que usan tanto la Tienda como el Inventario (mismos ids,
 * mismas imágenes).
 *
 * `rareza` (comun | raro | epico | legendario) solo cambia el color/etiqueta
 * de la tarjeta en Tienda e Inventario.
 *
 * `precio` es en coronas y es solo para MOSTRAR el precio en la Tienda —
 * la Cloud Function `comprarCosmetico` (functions/tienda.js) nunca confía
 * en este archivo ni en nada que mande el cliente, tiene su propia copia
 * de precios como fuente de verdad. Si cambias un precio aquí, cámbialo
 * también allá.
 *
 * `precio: null` quiere decir que NO se vende en la Tienda:
 * - "Default" ya lo tiene todo mundo desde que se crea el perfil.
 * - "007" es exclusivo del logro "Maestro del Territorio" (gana 30
 *   partidas de Bombas Elementales).
 *
 * `holeRatio` es qué tan ancho es el hueco transparente del aro respecto
 * al lienzo cuadrado ya recortado de cada imagen (medido directamente
 * sobre cada PNG). Cada diseño tiene un borde de grosor distinto (el de
 * "007" o "Dino" es mucho más grueso que el de "Default"), así que la
 * foto de perfil no puede tener un tamaño fijo: se calcula a partir de
 * este valor para que SIEMPRE quede dentro del aro, sin importar cuál
 * esté equipado.
 */

import marcoDefault from "../assets/cosmeticos/marcos/Default.png";
import marcoMetal from "../assets/cosmeticos/marcos/Metal.png";
import marcoNat from "../assets/cosmeticos/marcos/Nat.png";
import marcoElectro from "../assets/cosmeticos/marcos/Electro.png";
import marco007 from "../assets/cosmeticos/marcos/007.png";
import marcoDino from "../assets/cosmeticos/marcos/Dino.png";

import bannerDefault from "../assets/cosmeticos/banners/Default.jpg";
import bannerMetal from "../assets/cosmeticos/banners/Metal.jpg";
import bannerNat from "../assets/cosmeticos/banners/Nat.jpg";
import bannerElectro from "../assets/cosmeticos/banners/Electro.png";
import banner007 from "../assets/cosmeticos/banners/007.png";
import bannerDino from "../assets/cosmeticos/banners/Dino.jpg";


export const MARCOS = {
  Default: { id: "Default", nombre: "Default", imagen: marcoDefault, holeRatio: 0.747, rareza: "comun", precio: null },
  Metal: { id: "Metal", nombre: "Metal", imagen: marcoMetal, holeRatio: 0.739, rareza: "raro", precio: 75 },
  Nat: { id: "Nat", nombre: "Naturaleza", imagen: marcoNat, holeRatio: 0.654, rareza: "comun", precio: 50 },
  Electro: { id: "Electro", nombre: "Electro", imagen: marcoElectro, holeRatio: 0.695, rareza: "epico", precio: 100 },
  "007": { id: "007", nombre: "007", imagen: marco007, holeRatio: 0.541, rareza: "legendario", precio: null },
  Dino: { id: "Dino", nombre: "Dino", imagen: marcoDino, holeRatio: 0.584, rareza: "epico", precio: 100 },
};

export const BANNERS = {
  Default: { id: "Default", nombre: "Default", imagen: bannerDefault, rareza: "comun", precio: null },
  Metal: { id: "Metal", nombre: "Metal", imagen: bannerMetal, rareza: "raro", precio: 75 },
  Nat: { id: "Nat", nombre: "Naturaleza", imagen: bannerNat, rareza: "comun", precio: 50 },
  Electro: { id: "Electro", nombre: "Electro", imagen: bannerElectro, rareza: "epico", precio: 100 },
  "007": { id: "007", nombre: "007", imagen: banner007, rareza: "legendario", precio: null },
  Dino: { id: "Dino", nombre: "Dino", imagen: bannerDino, rareza: "epico", precio: 100 },
};


export function obtenerMarco(id) {
  return MARCOS[id] || MARCOS.Default;
}

export function obtenerBanner(id) {
  return BANNERS[id] || BANNERS.Default;
}

/**
 * Títulos de la Tienda. El id ES el texto del título (así se guarda en
 * `titulosObtenidos` / `tituloActivo`). Los agrupa el tema del cosmético
 * al que pertenecen (007, Dino, Electro, Metal, Naturaleza).
 *
 * El título por defecto de todo jugador NO está aquí: es su rango actual
 * (`estadisticas.estandar.rango`) y cambia solo cuando sube de rango —
 * se guarda `tituloActivo: ""` y la UI muestra el rango del momento.
 *
 * Precios: fuente de verdad en functions/tienda.js (mantener sincronizado).
 */
export const TITULOS = [
  { id: "Agente Doble", tema: "007", rareza: "legendario", precio: 100 },
  { id: "Licencia para Ganar", tema: "007", rareza: "legendario", precio: 100 },
  { id: "As Bajo la Manga", tema: "007", rareza: "legendario", precio: 100 },
  { id: "Rey del Jurásico", tema: "Dino", rareza: "epico", precio: 75 },
  { id: "Depredador Alfa", tema: "Dino", rareza: "epico", precio: 75 },
  { id: "Fósil Viviente", tema: "Dino", rareza: "epico", precio: 75 },
  { id: "Sobrecarga", tema: "Electro", rareza: "epico", precio: 75 },
  { id: "Circuito Maestro", tema: "Electro", rareza: "epico", precio: 75 },
  { id: "Alto Voltaje", tema: "Electro", rareza: "epico", precio: 75 },
  { id: "Riesgo Nuclear", tema: "Metal", rareza: "raro", precio: 50 },
  { id: "Guardián del Bosque", tema: "Nat", rareza: "comun", precio: 25 },
  { id: "Espíritu Silvestre", tema: "Nat", rareza: "comun", precio: 25 },
];

export const RANGO_INICIAL = "Cadetes Bomberos";

/** Título que se muestra: el equipado, o el rango actual si no hay ninguno. */
export function tituloVisible(profile) {
  return profile?.tituloActivo || profile?.estadisticas?.estandar?.rango || RANGO_INICIAL;
}