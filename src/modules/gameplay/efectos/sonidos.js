import sBomba from "../../../assets/sonidos/bomba.mp3";
import sMinibomba from "../../../assets/sonidos/minibomba.mp3";
import sBombota from "../../../assets/sonidos/bombota.mp3";
import sElectrica from "../../../assets/sonidos/electrica.mp3";
import sHielo from "../../../assets/sonidos/hielo.mp3";
import sLianas from "../../../assets/sonidos/lianas.mp3";

// Los sonidos se reproducen con Web Audio API: se decodifican una sola vez y
// cada disparo es instantáneo y puede solaparse con otro. Con <audio> normal
// había retrasos al clonar el elemento y Safari/Firefox bloqueaban los
// sonidos lanzados desde un cambio de la base de datos (no de un clic).
const SONIDOS = {
  bomba: sBomba,
  minibomba: sMinibomba,
  bombota: sBombota,
  veneno: sBomba, // Bombas Venenosas usa el sonido de bomba
  electrica: sElectrica,
  hielo: sHielo,
  lianas: sLianas,
};

// Duración máxima (s) que se reproduce de cada sonido; el resto se corta con
// un fundido corto. Eléctrica: hasta el segundo 2. Hielo y lianas: 3 s.
const DURACION_MAX_S = { electrica: 2, hielo: 3, lianas: 3 };
const FUNDIDO_S = 0.2;

// Preferencia de efectos de sonido (RQF-CFG-02). El módulo de configuración
// la ajustará con `setEfectosActivos`.
let efectosActivos = true;
export function setEfectosActivos(activo) {
  efectosActivos = activo !== false;
}

let contexto = null;
const buffers = {};
let precargando = false;

function obtenerContexto() {
  if (contexto) return contexto;
  const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  contexto = new AC();
  return contexto;
}

// Los navegadores dejan el audio en pausa hasta que el jugador toca la
// página; en cuanto hay un clic o tecla se reactiva. Además se reproduce un
// instante de silencio dentro del gesto (Safari lo exige para desbloquear).
function desbloquear() {
  const c = obtenerContexto();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch((err) => console.warn("[sonido] no se pudo reactivar el audio:", err));
  try {
    const silencio = c.createBufferSource();
    silencio.buffer = c.createBuffer(1, 1, 22050);
    silencio.connect(c.destination);
    silencio.start(0);
  } catch {
    /* sin efecto */
  }
}

export function precargarSonidos() {
  if (precargando) return;
  precargando = true;
  const c = obtenerContexto();
  if (!c) return;
  ["pointerdown", "keydown", "touchstart"].forEach((ev) =>
    window.addEventListener(ev, desbloquear, { passive: true })
  );
  Object.entries(SONIDOS).forEach(async ([tipo, src]) => {
    try {
      const datos = await (await fetch(src)).arrayBuffer();
      buffers[tipo] = await c.decodeAudioData(datos);
    } catch (err) {
      console.error(`No se pudo cargar el sonido "${tipo}":`, err);
    }
  });
}

function reproducirConAudioHtml(tipo, volumen) {
  const audio = new Audio(SONIDOS[tipo]);
  audio.volume = volumen;
  audio.play().catch(() => {});
  const max = DURACION_MAX_S[tipo];
  if (max) setTimeout(() => audio.pause(), max * 1000);
}

export function reproducirSonido(tipo, volumen = 0.9) {
  if (!SONIDOS[tipo]) {
    console.warn(`[sonido] tipo desconocido: "${tipo}"`);
    return;
  }
  if (!efectosActivos) return;
  const c = obtenerContexto();
  const buffer = buffers[tipo];
  console.info(`[sonido] ${tipo} · audio=${c ? c.state : "no disponible"} · decodificado=${!!buffer}`);
  // Respaldo: si aún no se decodificó (primer sonido muy temprano) o no hay
  // Web Audio, se usa <audio> normal.
  if (!c || !buffer) {
    reproducirConAudioHtml(tipo, volumen);
    return;
  }
  desbloquear();

  const duracion = Math.min(buffer.duration, DURACION_MAX_S[tipo] ?? buffer.duration);
  const fuente = c.createBufferSource();
  fuente.buffer = buffer;
  const ganancia = c.createGain();
  const inicio = c.currentTime;
  ganancia.gain.setValueAtTime(volumen, inicio);
  if (duracion < buffer.duration) {
    ganancia.gain.setValueAtTime(volumen, inicio + duracion - FUNDIDO_S);
    ganancia.gain.linearRampToValueAtTime(0, inicio + duracion);
  }
  fuente.connect(ganancia).connect(c.destination);
  fuente.start(inicio, 0, duracion);
}

// Para probar desde la consola del navegador (F12): probarSonido("bomba"),
// probarSonido("electrica"), etc. Muestra si el audio funciona sin jugar.
if (typeof window !== "undefined") window.probarSonido = reproducirSonido;