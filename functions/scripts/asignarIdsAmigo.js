
const fs = require("fs");
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const args = process.argv.slice(2);
const i = args.indexOf("--clave");
const rutaClave = i >= 0 ? args[i + 1] : process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!rutaClave) {
  console.error('Falta la clave de servicio. Usa --clave "ruta\\clave.json".');
  process.exit(1);
}
const clave = JSON.parse(fs.readFileSync(rutaClave, "utf8"));
initializeApp({ credential: cert(clave), projectId: clave.project_id });

// Se carga después de initializeApp para que use esta conexión.
const { asignarIdAmigo } = require("../social");

(async () => {
  const snap = await getFirestore().collection("usuarios").get();
  const sinId = snap.docs.filter((d) => !d.data().idAmigo);
  console.log(`${snap.size} cuentas, ${sinId.length} sin ID de amigo.`);
  const filas = [];
  for (const d of sinId) {
    const idAmigo = await asignarIdAmigo(d.id);
    filas.push({ usuario: d.data().username || "(sin nombre)", "ID de amigo": idAmigo });
  }
  if (filas.length) console.table(filas);
  console.log("Listo.");
  process.exit(0);
})().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});