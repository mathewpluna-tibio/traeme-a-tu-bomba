// Animaciones de las bombas en el tablero (RQF-TAB-03 / RQNF-TAB-03: anime.js).
//
// Las animaciones que necesitan elementos extra (bomba flotante, destello,
// partículas) se dibujan en una capa `.gp-fx` que React no administra,
// colocada encima del tablero. Así no se mezclan con los nodos de React.
import { animate, createTimeline, stagger } from "animejs";

const COLOR_ELEMENTO = {
  electrica: "#59c8ff",
  hielo: "#bdf2ff",
  lianas: "#7fd858",
};

function rectRelativo(celda, capa) {
  const c = celda.getBoundingClientRect();
  const l = capa.getBoundingClientRect();
  return { x: c.left - l.left, y: c.top - l.top, w: c.width, h: c.height };
}

function crearNodo(capa, clase, r) {
  const n = document.createElement("div");
  n.className = clase;
  n.style.left = `${r.x}px`;
  n.style.top = `${r.y}px`;
  n.style.width = `${r.w}px`;
  n.style.height = `${r.h}px`;
  capa.appendChild(n);
  return n;
}

function crearImagen(capa, src, r, escala = 0.9) {
  const caja = crearNodo(capa, "gp-fx-bomba", r);
  const img = document.createElement("img");
  img.src = src;
  img.alt = "";
  img.style.height = `${Math.round(r.h * escala)}px`;
  caja.appendChild(img);
  return caja;
}

function crearParticulas(capa, r, cantidad, color) {
  const lista = [];
  for (let i = 0; i < cantidad; i++) {
    const p = crearNodo(capa, "gp-fx-particula", {
      x: r.x + r.w / 2 - 6,
      y: r.y + r.h / 2 - 6,
      w: 12,
      h: 12,
    });
    p.style.background = color;
    lista.push(p);
  }
  return lista;
}

function lanzarParticulas(particulas, alcance, duracion = 700) {
  particulas.forEach((p, i) => {
    const angulo = (Math.PI * 2 * i) / particulas.length + Math.random() * 0.4;
    const distancia = alcance * (0.6 + Math.random() * 0.5);
    animate(p, {
      x: { to: Math.cos(angulo) * distancia },
      y: { to: Math.sin(angulo) * distancia },
      scale: { from: 1.2, to: 0 },
      opacity: { from: 1, to: 0.2 },
      duration: duracion,
      ease: "outExpo",
      onComplete: () => p.remove(),
    });
  });
}

/** Colocación: la bomba cae en la casilla y rebota. */
export function animarColocacion(celda) {
  if (!celda) return;
  const img = celda.querySelector(".gp-cell-bomba");
  if (img) {
    animate(img, {
      y: { from: -38, to: 0 },
      scale: { from: 0.3, to: 1 },
      opacity: { from: 0, to: 1 },
      duration: 600,
      ease: "outBack(2)",
    });
  }
  animate(celda, {
    scale: [
      { to: 0.88, duration: 120, delay: 260, ease: "inQuad" },
      { to: 1, duration: 420, ease: "outElastic(1, .5)" },
    ],
  });
}

/** Activación de una casilla segura: se hunde, rebota y deja un aro verde. */
export function animarActivacion(celda, capa) {
  if (!celda) return;
  animate(celda, {
    scale: [
      { to: 0.8, duration: 110, ease: "inQuad" },
      { to: 1.08, duration: 180, ease: "outQuad" },
      { to: 1, duration: 260, ease: "outBack" },
    ],
  });
  if (!capa) return;
  const anillo = crearNodo(capa, "gp-fx-anillo gp-fx-anillo--seguro", rectRelativo(celda, capa));
  animate(anillo, {
    scale: { from: 0.7, to: 1.6 },
    opacity: { from: 0.9, to: 0 },
    duration: 650,
    ease: "outQuad",
    onComplete: () => anillo.remove(),
  });
}

/**
 * Detonación: la bomba aparece y tiembla (activación), se hincha y explota
 * con destello, partículas y sacudida del tablero.
 */
export function animarDetonacion(celda, capa, tablero, imagenBomba) {
  if (!celda || !capa) return;
  const r = rectRelativo(celda, capa);
  const bomba = crearImagen(capa, imagenBomba, r);
  const destello = crearNodo(capa, "gp-fx-destello", r);
  const particulas = crearParticulas(capa, r, 16, "#ffd27a");

  const tl = createTimeline({ onComplete: () => bomba.remove() });
  tl.add(bomba, { scale: { from: 0, to: 1.15 }, opacity: { from: 0, to: 1 }, duration: 300, ease: "outBack(2)" })
    .add(bomba, {
      rotate: [
        { to: -14, duration: 90 },
        { to: 14, duration: 90 },
        { to: -10, duration: 90 },
        { to: 10, duration: 90 },
        { to: -6, duration: 80 },
        { to: 0, duration: 80 },
      ],
    })
    .add(bomba, { scale: { to: 1.55 }, duration: 260, ease: "inQuad" })
    .add(bomba, { scale: { to: 2.2 }, opacity: { to: 0 }, duration: 160, ease: "outQuad" })
    .call(() => {
      animate(destello, {
        scale: { from: 0.3, to: 3.4 },
        opacity: { from: 1, to: 0 },
        duration: 650,
        ease: "outExpo",
        onComplete: () => destello.remove(),
      });
      lanzarParticulas(particulas, r.w * 1.6, 800);
      if (tablero) {
        animate(tablero, {
          x: [
            { to: -9, duration: 50 },
            { to: 9, duration: 60 },
            { to: -7, duration: 60 },
            { to: 6, duration: 60 },
            { to: -3, duration: 60 },
            { to: 0, duration: 60 },
          ],
        });
      }
      animate(celda, {
        scale: [
          { to: 1.15, duration: 120 },
          { to: 1, duration: 380, ease: "outElastic(1, .5)" },
        ],
      });
    });
}

/** Marca de territorio en Bombas Elementales. */
export function animarMarca(celda) {
  if (!celda) return;
  animate(celda, {
    scale: { from: 0.55, to: 1 },
    duration: 420,
    ease: "outBack(2)",
  });
}

/**
 * Bomba elemental: la bomba aparece sobre la casilla objetivo y estalla con
 * el color de su elemento. `extras` son casillas afectadas (cruz de la
 * eléctrica, casillas bloqueadas por lianas) que destellan en cadena.
 */
export function animarBombaElemental(tipo, celda, capa, imagenBomba, extras = []) {
  if (!celda || !capa) return;
  const color = COLOR_ELEMENTO[tipo] || "#ffd166";
  const r = rectRelativo(celda, capa);
  const bomba = crearImagen(capa, imagenBomba, r, 1.1);
  const anillo = crearNodo(capa, "gp-fx-anillo", r);
  anillo.style.borderColor = color;
  anillo.style.boxShadow = `0 0 18px ${color}`;
  const particulas = crearParticulas(capa, r, 12, color);

  const tl = createTimeline({ onComplete: () => bomba.remove() });
  tl.add(bomba, {
    y: { from: -30, to: -6 },
    scale: { from: 0, to: 1.2 },
    opacity: { from: 0, to: 1 },
    duration: 420,
    ease: "outBack(2)",
  })
    .add(bomba, {
      scale: { to: 1, duration: 360 },
      rotate: [{ to: -8, duration: 120 }, { to: 8, duration: 120 }, { to: 0, duration: 120 }],
    })
    .add(bomba, { scale: { to: 1.8 }, opacity: { to: 0 }, duration: 220, ease: "inQuad" })
    .call(() => {
      animate(anillo, {
        scale: { from: 0.4, to: 2.6 },
        opacity: { from: 1, to: 0 },
        duration: 700,
        ease: "outExpo",
        onComplete: () => anillo.remove(),
      });
      lanzarParticulas(particulas, r.w * 1.4, 750);
      const objetivos = [celda, ...extras.filter(Boolean)];
      animate(objetivos, {
        scale: [
          { to: 1.18, duration: 140 },
          { to: 1, duration: 420, ease: "outElastic(1, .5)" },
        ],
        delay: stagger(70),
      });
    });
}

/**
 * Ocultamiento: pasados 3 segundos la bomba se esconde. Se dibuja una copia
 * de la bomba que se encoge girando y se desvanece con un poco de polvo, y
 * la casilla da un pequeño pulso.
 */
export function animarOcultar(celda, capa, imagenBomba) {
  if (!celda || !capa) return;
  const r = rectRelativo(celda, capa);
  const bomba = crearImagen(capa, imagenBomba, r, 0.74);
  const polvo = crearParticulas(capa, r, 8, "rgba(255,255,255,0.75)");

  animate(bomba, {
    scale: { from: 1, to: 0.15 },
    rotate: { from: 0, to: 200 },
    opacity: { from: 1, to: 0 },
    duration: 520,
    ease: "inBack(1.6)",
    onComplete: () => bomba.remove(),
  });
  lanzarParticulas(polvo, r.w * 0.7, 520);
  animate(celda, {
    scale: [
      { to: 0.92, duration: 160, delay: 380 },
      { to: 1, duration: 300, ease: "outBack" },
    ],
  });
}