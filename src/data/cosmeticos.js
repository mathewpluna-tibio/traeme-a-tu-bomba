/**
 * Catálogo de cosméticos (marcos y banners de perfil).
 *
 * Esto es la base que usan tanto la Tienda como el Inventario (mismos ids,
 * mismas imágenes).
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
  Default: { id: "Default", nombre: "Default", imagen: marcoDefault, holeRatio: 0.747, precio: null },
  Metal: { id: "Metal", nombre: "Metal", imagen: marcoMetal, holeRatio: 0.739, precio: 100 },
  Nat: { id: "Nat", nombre: "Naturaleza", imagen: marcoNat, holeRatio: 0.654, precio: 100 },
  Electro: { id: "Electro", nombre: "Electro", imagen: marcoElectro, holeRatio: 0.695, precio: 100 },
  "007": { id: "007", nombre: "007", imagen: marco007, holeRatio: 0.541, precio: null },
  Dino: { id: "Dino", nombre: "Dino", imagen: marcoDino, holeRatio: 0.584, precio: 100 },
};

export const BANNERS = {
  Default: { id: "Default", nombre: "Default", imagen: bannerDefault, precio: null },
  Metal: { id: "Metal", nombre: "Metal", imagen: bannerMetal, precio: 100 },
  Nat: { id: "Nat", nombre: "Naturaleza", imagen: bannerNat, precio: 100 },
  Electro: { id: "Electro", nombre: "Electro", imagen: bannerElectro, precio: 100 },
  "007": { id: "007", nombre: "007", imagen: banner007, precio: null },
  Dino: { id: "Dino", nombre: "Dino", imagen: bannerDino, precio: 100 },
};


export function obtenerMarco(id) {
  return MARCOS[id] || MARCOS.Default;
}

export function obtenerBanner(id) {
  return BANNERS[id] || BANNERS.Default;
}