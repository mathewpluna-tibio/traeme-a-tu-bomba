/**
 * Asigna (o quita) el rol de administrador a una cuenta (RQNF-ADM-01).
 *
 * Necesita una clave de servicio de Firebase (Consola de Firebase →
 * Configuración del proyecto → Cuentas de servicio → "Generar nueva clave
 * privada"). Guarda el .json FUERA del repositorio y nunca lo subas a git.
 *
 * Uso (desde la carpeta functions/):
 *   node scripts/asignarAdmin.js correo@ejemplo.com --clave C:\ruta\clave.json
 *   node scripts/asignarAdmin.js correo@ejemplo.com --clave C:\ruta\clave.json --quitar
 *
 * (En vez de --clave puedes definir la variable GOOGLE_APPLICATION_CREDENTIALS.)
 * La cuenta debe existir ya y tendrá que cerrar sesión y volver a entrar.
 */
const fs = require("fs");
const { initializeApp, cert, applicationDefault } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

const PROYECTO_POR_DEFECTO = "traeme-bomba"; // .firebaserc

async function main() {
  const args = process.argv.slice(2);
  const correo = args.find((a) => !a.startsWith("--") && a.includes("@"));
  const quitar = args.includes("--quitar");
  const i = args.indexOf("--clave");
  const rutaClave = i >= 0 ? args[i + 1] : process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!correo) {
    console.error("Uso: node scripts/asignarAdmin.js correo@ejemplo.com --clave ruta\\clave.json [--quitar]");
    process.exit(1);
  }
  if (!rutaClave) {
    console.error("Falta la clave de servicio. Usa --clave ruta\\clave.json (ver instrucciones en el archivo).");
    process.exit(1);
  }

  const clave = JSON.parse(fs.readFileSync(rutaClave, "utf8"));
  initializeApp({
    credential: clave.private_key ? cert(clave) : applicationDefault(),
    projectId: clave.project_id || PROYECTO_POR_DEFECTO,
  });

  const auth = getAuth();
  const usuario = await auth.getUserByEmail(correo);
  const claims = { ...(usuario.customClaims || {}) };
  if (quitar) delete claims.admin;
  else claims.admin = true;
  await auth.setCustomUserClaims(usuario.uid, claims);
  console.log(`${quitar ? "Rol admin QUITADO a" : "Rol admin ASIGNADO a"} ${correo} (${usuario.uid}).`);
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});