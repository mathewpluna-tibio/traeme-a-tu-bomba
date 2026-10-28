// Música de fondo del juego (RQF-CFG-03). Es independiente de los efectos de
// sonido. Busca cualquier .mp3 dentro de src/assets/musica/ (si la carpeta
// está vacía no pasa nada: simplemente no hay música que reproducir).
const PISTAS = Object.values(
  import.meta.glob("../../../assets/musica/*.mp3", { eager: true, query: "?url", import: "default" })
);

const VOLUMEN = 0.3;
let activa = true;
let audio = null;
let escuchando = false;

function crearAudio() {
  if (audio || PISTAS.length === 0) return audio;
  audio = new Audio(PISTAS[0]);
  audio.loop = true;
  audio.volume = VOLUMEN;
  return audio;
}

function intentarReproducir() {
  if (!activa) return;
  const a = crearAudio();
  if (!a || !a.paused) return;
  a.play().catch(() => {
    /* el navegador exige un gesto del jugador; se reintenta en el siguiente */
  });
}

function alPrimerGesto() {
  intentarReproducir();
}

// Los navegadores bloquean el audio hasta que el jugador interactúa con la
// página. Al leer las preferencias del jugador se intenta iniciar y, si el navegador la
// bloquea, arranca sola con el primer clic, toque o tecla (también tras
// recargar). El permiso se queda activo hasta que suene.
function escucharGesto() {
  if (escuchando || typeof window === "undefined") return;
  escuchando = true;
  const eventos = ["pointerdown", "keydown", "touchstart", "click"];
  const manejar = () => {
    intentarReproducir();
    if (audio && !audio.paused) eventos.forEach((ev) => window.removeEventListener(ev, manejar));
  };
  eventos.forEach((ev) => window.addEventListener(ev, manejar, { passive: true }));
}

export function setMusicaActiva(valor) {
  activa = valor !== false;
  escucharGesto();
  if (activa) intentarReproducir();
  else if (audio) audio.pause();
}