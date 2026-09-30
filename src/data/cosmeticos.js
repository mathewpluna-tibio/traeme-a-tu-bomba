/**
 * Catálogo de cosméticos (marcos y banners de perfil).
 *
 * Esto es la base que también usará la Tienda/Inventario más adelante
 * (mismos ids, mismas imágenes). Por ahora `precio` no está definido
 * todavía — se agrega cuando confirmemos los precios en coronas.
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
  Default: { id: "Default", nombre: "Default", imagen: marcoDefault, holeRatio: 0.747 },
  Metal: { id: "Metal", nombre: "Metal", imagen: marcoMetal, holeRatio: 0.739 },
  Nat: { id: "Nat", nombre: "Naturaleza", imagen: marcoNat, holeRatio: 0.654 },
  Electro: { id: "Electro", nombre: "Electro", imagen: marcoElectro, holeRatio: 0.695 },
  "007": { id: "007", nombre: "007", imagen: marco007, holeRatio: 0.541 },
  Dino: { id: "Dino", nombre: "Dino", imagen: marcoDino, holeRatio: 0.584 },
};

export const BANNERS = {
  Default: { id: "Default", nombre: "Default", imagen: bannerDefault },
  Metal: { id: "Metal", nombre: "Metal", imagen: bannerMetal },
  Nat: { id: "Nat", nombre: "Naturaleza", imagen: bannerNat },
  Electro: { id: "Electro", nombre: "Electro", imagen: bannerElectro },
  "007": { id: "007", nombre: "007", imagen: banner007 },
  Dino: { id: "Dino", nombre: "Dino", imagen: bannerDino },
};


export function obtenerMarco(id) {
  return MARCOS[id] || MARCOS.Default;
}

export function obtenerBanner(id) {
  return BANNERS[id] || BANNERS.Default;
}