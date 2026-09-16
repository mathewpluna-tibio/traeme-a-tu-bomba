import { useState, useEffect } from "react";
import { useServerTimeOffset } from "../../hooks/useServerTimeOffset";
import "./CargasVeneno.css";

const TICK_MS = 10000;

export default function CargasVeneno({ cargas = [] }) {
  const offset = useServerTimeOffset();
  const [, forzarRender] = useState(0);

  useEffect(() => {
    const intervalo = setInterval(() => forzarRender((n) => n + 1), 500);
    return () => clearInterval(intervalo);
  }, []);

  if (cargas.length === 0) return null;

  const ahora = Date.now() + offset;
  const dañoTotalPorTick = (cargas.length * 0.25).toFixed(2);

  return (
    <div className="cargas-veneno">
      <div className="cargas-veneno-header">
        <span className="cargas-veneno-icono">☠️</span>
        <span>
          {cargas.length} {cargas.length === 1 ? "carga activa" : "cargas activas"} (-{dañoTotalPorTick} vida total por golpe)
        </span>
      </div>

      <div className="cargas-veneno-lista">
        {cargas.map((carga, index) => {
          const proximoTick = carga.ultimoTick + TICK_MS;
          const segundosRestantes = Math.max(0, Math.ceil((proximoTick - ahora) / 1000));
          return (
            <div key={index} className="carga-individual">
              <span className="carga-individual-icono">🧪</span>
              <span className="carga-individual-timer">{segundosRestantes}s</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}