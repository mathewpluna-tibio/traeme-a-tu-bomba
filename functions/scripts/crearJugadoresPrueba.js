
const fs = require("fs");
const path = require("path");
const { initializeApp, cert, applicationDefault } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { getDatabase } = require("firebase-admin/database");
const { determinarRango } = require("../elo");
const { MISIONES_DIARIAS } = require("../misionesCatalogo");
const { CATALOGO_TIENDA } = require("../tienda");

const PROYECTO_POR_DEFECTO = "traeme-bomba"; // .firebaserc
const MODALIDADES = ["estandar", "venenosas", "elementales"];
const ELOS_POR_RANGO = [150, 500, 850, 1050, 1200];
const DOMINIO = "traeme.test";

function leerArgs() {
  const args = process.argv.slice(2);
  const valor = (nombre, porDefecto) => {
    const i = args.indexOf(nombre);
    return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : porDefecto;
  };
  return {
    rutaClave: valor("--clave", process.env.GOOGLE_APPLICATION_CREDENTIALS),
    elos: valor("--elos", null),
    cantidad: parseInt(valor("--cantidad", "1"), 10),
    modalidad: valor("--modalidad", "todas"),
    coronas: parseInt(valor("--coronas", "1000"), 10),
    password: valor("--password", "Prueba#123"),
    prefijo: valor("--prefijo", "prueba").toLowerCase().replace(/[^a-z0-9_]/g, ""),
    cosmeticos: args.includes("--cosmeticos"),
    listar: args.includes("--listar"),
    borrar: args.includes("--borrar"),
  };
}

function iniciarFirebase(rutaClave) {
  const clave = JSON.parse(fs.readFileSync(rutaClave, "utf8"));
  const projectId = clave.project_id || PROYECTO_POR_DEFECTO;
  initializeApp({
    credential: clave.private_key ? cert(clave) : applicationDefault(),
    projectId,
    databaseURL: leerDatabaseURL(projectId),
  });
}

// La URL de Realtime Database está en el .env.local del proyecto
// (VITE_FIREBASE_DATABASE_URL); si no, se usa la URL por defecto.
function leerDatabaseURL(projectId) {
  try {
    const env = fs.readFileSync(path.join(__dirname, "..", "..", ".env.local"), "utf8");
    const linea = env.split(/\r?\n/).find((l) => l.startsWith("VITE_FIREBASE_DATABASE_URL="));
    if (linea) return linea.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
  } catch {
    /* sin .env.local */
  }
  return `https://${projectId}-default-rtdb.firebaseio.com`;
}

function fechaDeHoy() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}

function misionesDelDia() {
  return [...MISIONES_DIARIAS]
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map((m) => ({ ...m, progreso: 0, completada: false }));
}

// Estadísticas creíbles para un Elo dado. `indice` varía las victorias y
// derrotas entre jugadores con el mismo Elo, para probar los desempates.
function estadisticasPara(elo, indice) {
  const victorias = Math.max(0, Math.round(elo / 30) + indice * 2);
  const derrotas = Math.max(0, Math.round(victorias * 0.6) - indice);
  const partidas = victorias + derrotas;
  return {
    elo,
    rango: determinarRango(elo),
    victorias,
    derrotas,
    vidasPerdidas: Math.round(partidas * 1.2 * 2) / 2,
    vidasQuitadas: Math.round(partidas * 1.6 * 2) / 2,
    vidasConservadas: Math.round(partidas * 1.4 * 2) / 2,
    partidasSinPerderVida: Math.round(victorias / 4),
  };
}

function estadisticasElementales(elo, indice) {
  const base = estadisticasPara(elo, indice);
  return {
    elo,
    rango: base.rango,
    victorias: base.victorias,
    derrotas: base.derrotas,
    empates: Math.round(base.victorias / 6),
    casillasMarcadas: (base.victorias + base.derrotas) * 22 + indice,
    bombasHieloUsadas: Math.round(base.victorias / 2),
  };
}

function estadisticasCompletas(elo, indice, modalidad) {
  const ceros = { elo: 0, rango: determinarRango(0) };
  const estadisticas = {};
  for (const m of MODALIDADES) {
    const conElo = modalidad === "todas" || modalidad === m;
    if (m === "elementales") {
      estadisticas[m] = conElo
        ? estadisticasElementales(elo, indice)
        : { ...ceros, victorias: 0, derrotas: 0, empates: 0, casillasMarcadas: 0, bombasHieloUsadas: 0 };
    } else {
      estadisticas[m] = conElo
        ? estadisticasPara(elo, indice)
        : { ...ceros, victorias: 0, derrotas: 0, vidasPerdidas: 0, vidasQuitadas: 0, vidasConservadas: 0, partidasSinPerderVida: 0 };
    }
  }
  return estadisticas;
}

function todosLosCosmeticos() {
  const ids = (tipo) => CATALOGO_TIENDA.filter((c) => c.tipo === tipo).map((c) => c.id);
  return {
    marcosComprados: [...ids("marco"), "007"],
    bannersComprados: [...ids("banner"), "007"],
    titulosObtenidos: ids("titulo"),
  };
}

const ETIQUETA_RANGO = {
  "Cadetes Bomberos": "cadete",
  "Entusiastas de las Explosiones": "entus",
  "Genios Explosivos": "genio",
  "Señor de las Bombas": "senor",
};
const LARGO_MAXIMO = 20; // mismo límite que el registro

async function crearOActualizar(opciones, elo, indice) {
  const auth = getAuth();
  const firestore = getFirestore();
  const etiqueta = ETIQUETA_RANGO[determinarRango(elo)];
  // El nombre siempre conserva rango, Elo y número; si no cabe, se acorta el prefijo.
  const resto = `_${etiqueta}_${elo}${indice > 0 ? `_${indice + 1}` : ""}`;
  const username = `${opciones.prefijo.slice(0, Math.max(1, LARGO_MAXIMO - resto.length))}${resto}`;
  const email = `${username}@${DOMINIO}`;

  let usuario;
  let nuevo = false;
  try {
    usuario = await auth.getUserByEmail(email);
    await auth.updateUser(usuario.uid, { password: opciones.password, displayName: username, disabled: false });
  } catch (err) {
    if (err.code !== "auth/user-not-found") throw err;
    usuario = await auth.createUser({ email, password: opciones.password, displayName: username });
    nuevo = true;
  }

  const perfil = {
    username,
    email,
    esPrueba: true,
    coronas: opciones.coronas,
    fotoPerfil: "",
    marcoActivo: "Default",
    bannerActivo: "Default",
    tituloActivo: "",
    baneado: false,
    estadisticas: estadisticasCompletas(elo, indice, opciones.modalidad),
    misionesDiarias: { fecha: fechaDeHoy(), lista: misionesDelDia() },
    ...(opciones.cosmeticos ? todosLosCosmeticos() : {}),
  };
  if (nuevo) perfil.createdAt = new Date().toISOString();

  await firestore.collection("usuarios").doc(usuario.uid).set(perfil, { merge: true });
  return { username, email, elo, rango: determinarRango(elo), nuevo };
}

async function listar() {
  const snap = await getFirestore().collection("usuarios").where("esPrueba", "==", true).get();
  if (snap.empty) {
    console.log("No hay jugadores de prueba.");
    return;
  }
  const filas = snap.docs
    .map((d) => d.data())
    .sort((a, b) => (b.estadisticas?.estandar?.elo || 0) - (a.estadisticas?.estandar?.elo || 0))
    .map((u) => ({
      usuario: u.username,
      correo: u.email,
      "Elo estándar": u.estadisticas?.estandar?.elo ?? 0,
      "Elo venenosas": u.estadisticas?.venenosas?.elo ?? 0,
      "Elo elementales": u.estadisticas?.elementales?.elo ?? 0,
      rango: u.estadisticas?.estandar?.rango,
      coronas: u.coronas,
    }));
  console.table(filas);
}

async function borrar() {
  const firestore = getFirestore();
  const auth = getAuth();
  const rtdb = getDatabase();
  const snap = await firestore.collection("usuarios").where("esPrueba", "==", true).get();
  if (snap.empty) {
    console.log("No hay jugadores de prueba que borrar.");
    return;
  }
  const uids = snap.docs.map((d) => d.id);

  for (const d of snap.docs) {
    const amigos = await d.ref.collection("amigos").get();
    await Promise.all(amigos.docs.map((a) => a.ref.delete()));
    await d.ref.delete();
    await firestore.collection("preferencias").doc(d.id).delete();
  }
  const resultado = await auth.deleteUsers(uids);

  // Limpia la cola, la sesión y las notificaciones en Realtime Database.
  const updates = {};
  for (const uid of uids) {
    updates[`sesionActiva/${uid}`] = null;
    updates[`notificacionesPartida/${uid}`] = null;
    updates[`invitaciones/${uid}`] = null;
    for (const m of MODALIDADES) updates[`colaEspera/${m}/${uid}`] = null;
  }
  try {
    await rtdb.ref().update(updates);
  } catch (err) {
    console.warn("Aviso: no se pudo limpiar Realtime Database:", err.message);
  }

  console.log(`Borrados ${uids.length} jugadores de prueba (${resultado.failureCount} fallos en Authentication).`);
}

async function main() {
  const opciones = leerArgs();
  if (!opciones.rutaClave) {
    console.error("Falta la clave de servicio. Usa --clave ruta\\clave.json (ver instrucciones en el archivo).");
    process.exit(1);
  }
  if (opciones.modalidad !== "todas" && !MODALIDADES.includes(opciones.modalidad)) {
    console.error("--modalidad debe ser estandar, venenosas, elementales o todas.");
    process.exit(1);
  }
  iniciarFirebase(opciones.rutaClave);

  if (opciones.listar) return listar();
  if (opciones.borrar) return borrar();

  const elos = opciones.elos
    ? opciones.elos.split(",").map((e) => parseInt(e.trim(), 10)).filter((e) => Number.isFinite(e) && e >= 0)
    : ELOS_POR_RANGO;
  if (elos.length === 0) {
    console.error("--elos debe ser una lista de números, por ejemplo --elos 300,650,1150");
    process.exit(1);
  }
  const cantidad = Number.isFinite(opciones.cantidad) && opciones.cantidad > 0 ? Math.min(opciones.cantidad, 20) : 1;

  const creados = [];
  for (const elo of elos) {
    for (let i = 0; i < cantidad; i++) {
      creados.push(await crearOActualizar(opciones, elo, i));
    }
  }

  console.table(
    creados.map((c) => ({ usuario: c.username, correo: c.email, Elo: c.elo, rango: c.rango, estado: c.nuevo ? "creado" : "actualizado" }))
  );
  console.log(`Contraseña de todas las cuentas: ${opciones.password}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Error:", e.message);
    process.exit(1);
  });