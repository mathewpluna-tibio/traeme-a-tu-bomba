/**
 * Carga (o actualiza) el contenido de la guía del juego en Firestore
 * (colección `guias`, RQNF-SOP-03). El contenido sale de
 * src/modules/guia/guiaContenido.json; edita ese archivo y vuelve a ejecutar.
 *
 * Uso (desde la carpeta functions/), con la misma clave de servicio que
 * asignarAdmin.js (guardada FUERA del repo):
 *   node scripts/sembrarGuias.js --clave C:\ruta\clave.json
 *   node scripts/sembrarGuias.js --clave C:\ruta\clave.json --limpiar
 *
 * --limpiar borra antes las secciones que ya no estén en el archivo.
 */
const fs = require("fs");
const path = require("path");
const { initializeApp, cert, applicationDefault } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const PROYECTO_POR_DEFECTO = "traeme-bomba";

async function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf("--clave");
  const rutaClave = i >= 0 ? args[i + 1] : process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const limpiar = args.includes("--limpiar");

  let clave = null;
  if (rutaClave) clave = JSON.parse(fs.readFileSync(rutaClave, "utf8"));
  initializeApp({
    credential: clave ? cert(clave) : applicationDefault(),
    projectId: (clave && clave.project_id) || PROYECTO_POR_DEFECTO,
  });

  const archivo = path.join(__dirname, "..", "..", "src", "modules", "guia", "guiaContenido.json");
  const secciones = JSON.parse(fs.readFileSync(archivo, "utf8"));
  const db = getFirestore();
  const col = db.collection("guias");

  const batch = db.batch();
  const ids = new Set();
  for (const { id, ...datos } of secciones) {
    ids.add(id);
    batch.set(col.doc(id), datos);
  }
  if (limpiar) {
    const existentes = await col.get();
    existentes.forEach((d) => {
      if (!ids.has(d.id)) batch.delete(d.ref);
    });
  }
  await batch.commit();
  console.log(`Guía actualizada: ${secciones.length} secciones en la colección "guias".`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});