
import marcoDefault from "../assets/cosmeticos/marcos/Default.png";
import marcoMetal from "../assets/cosmeticos/marcos/Metal.png";
import marcoNat from "../assets/cosmeticos/marcos/Nat.png";
import marcoElectro from "../assets/cosmeticos/marcos/Electro.png";
import marco007 from "../assets/cosmeticos/marcos/007.png";
import marcoDino from "../assets/cosmeticos/marcos/Dino.png";
import marcoRangoEntusiastas from "../assets/cosmeticos/marcos/RangoEntusiastas.png";
import marcoRangoGenios from "../assets/cosmeticos/marcos/RangoGenios.png";
import marcoRangoSenor from "../assets/cosmeticos/marcos/RangoSenor.png";

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

export const MARCOS_RANGO = {
  "Cadetes Bomberos": { id: "rango_cadetes", nombre: "Marco de Cadete", imagen: marcoDefault, holeRatio: 0.747 },
  "Entusiastas de las Explosiones": { id: "rango_entusiastas", nombre: "Marco de Entusiasta", imagen: marcoRangoEntusiastas, holeRatio: 0.63 },
  "Genios Explosivos": { id: "rango_genios", nombre: "Marco de Genio", imagen: marcoRangoGenios, holeRatio: 0.59 },
  "Señor de las Bombas": { id: "rango_senor", nombre: "Marco de Señor", imagen: marcoRangoSenor, holeRatio: 0.52 },
};

/** Marco que corresponde al rango actual del jugador. */
export function marcoDeRango(profile) {
  const rango = profile?.estadisticas?.estandar?.rango || "Cadetes Bomberos";
  return MARCOS_RANGO[rango] || MARCOS_RANGO["Cadetes Bomberos"];
}

/**
 * Marco que se dibuja en el perfil y en la partida: el comprado que tenga
 * equipado o, si tiene el base (o un id antiguo), el de su rango.
 */
export function marcoDelPerfil(profile) {
  const id = profile?.marcoActivo;
  if (id && MARCOS[id] && id !== "Default") return MARCOS[id];
  return marcoDeRango(profile);
}

export function obtenerBanner(id) {
  return BANNERS[id] || BANNERS.Default;
}

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