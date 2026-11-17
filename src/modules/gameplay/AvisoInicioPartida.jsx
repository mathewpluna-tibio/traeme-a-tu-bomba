import { useEffect, useState } from "react";
import { reproducirAlerta } from "./efectos/sonidos";

const DURACION_MS = 2800;

function yaAvisada(partidaId) {
  try {
    return sessionStorage.getItem(`avisoInicio:${partidaId}`) === "1";
  } catch {
    return false;
  }
}

function marcarAvisada(partidaId) {
  try {
    sessionStorage.setItem(`avisoInicio:${partidaId}`, "1");
  } catch {
    /* sin almacenamiento: el aviso puede repetirse al recargar */
  }
}

export default function AvisoInicioPartida({ partidaId, partida, nombreRival }) {
  // Se decide una sola vez, al montar (PartidaScreen ya tiene la partida).
  const [visible, setVisible] = useState(
    () =>
      !!partidaId &&
      !!partida &&
      partida.estado !== "finalizada" &&
      partida.estado !== "cancelada" &&
      !yaAvisada(partidaId)
  );

  useEffect(() => {
    if (!visible) return;
    marcarAvisada(partidaId);
    reproducirAlerta("inicio");
    const id = setTimeout(() => setVisible(false), DURACION_MS);
    return () => clearTimeout(id);
  }, []);

  if (!visible) return null;
  return (
    <div className="gp-aviso-inicio" role="status" aria-live="polite">
      <span className="gp-aviso-inicio-titulo">Rival encontrado</span>
      <span className="gp-aviso-inicio-texto">
        Juegas contra <strong>{nombreRival || "Invitado"}</strong>. La partida comienza.
      </span>
    </div>
  );
}