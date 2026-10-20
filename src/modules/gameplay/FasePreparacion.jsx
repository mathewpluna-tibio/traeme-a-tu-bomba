import { useState, useEffect, useRef } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase/config";
import { useAuth } from "../../context/AuthContext";
import { useServerTimeOffset } from "../../hooks/useServerTimeOffset";
import Tablero from "./Tablero";
import HudPartida from "./HudPartida";
import { IMAGEN_BOMBA, NOMBRE_BOMBA } from "./bombasAssets";

const colocarBombaCallable = httpsCallable(functions, "colocarBomba");
const finalizarTurnoCallable = httpsCallable(functions, "finalizarTurnoColocacion");
const verificarTimeoutCallable = httpsCallable(functions, "verificarTimeoutColocacion");

function ExtraBombas({ tipo, cantidad }) {
  return (
    <div className="gp-extra" title={`${NOMBRE_BOMBA[tipo] || "Bomba"}: ${cantidad} disponibles`}>
      <img className="gp-extra-img" src={IMAGEN_BOMBA[tipo] || IMAGEN_BOMBA.bomba} alt="" />
      <span className="gp-extra-num">×{cantidad}</span>
    </div>
  );
}

export default function FasePreparacion({ partidaId, partida, perfiles = {} }) {
  const { user } = useAuth();
  const [colocando, setColocando] = useState(false);
  const [error, setError] = useState("");
  const [segundosRestantes, setSegundosRestantes] = useState(null);
  const yaFinalizoTurno = useRef(false);
  const offset = useServerTimeOffset();

  const rivalUid = Object.keys(partida.jugadores || {}).find((id) => id !== user.uid);
  const miInfo = partida.jugadores?.[user.uid];
  const rivalInfo = partida.jugadores?.[rivalUid];
  const bombasRestantes = miInfo?.bombasDisponibles ?? 0;
  const esMiTurno = partida.turnoColocacion?.uidActivo === user.uid;
  const finalizaEn = partida.turnoColocacion?.finalizaEn;
  const tipoBomba = partida.modalidad === "venenosas" ? "veneno" : miInfo?.clase || "bomba";

  // Cierre voluntario al agotar bombas
  useEffect(() => {
    if (esMiTurno && bombasRestantes === 0 && !yaFinalizoTurno.current) {
      yaFinalizoTurno.current = true;
      finalizarTurnoCallable({ partidaId }).catch((err) => {
        console.error("Error al finalizar turno:", err);
        yaFinalizoTurno.current = false;
      });
    }
  }, [esMiTurno, bombasRestantes, partidaId]);

  useEffect(() => {
    if (!esMiTurno) yaFinalizoTurno.current = false;
  }, [esMiTurno]);

  // Cuenta regresiva visible para ambos; solo quien tiene el turno pide el timeout.
  useEffect(() => {
    if (!finalizaEn) {
      setSegundosRestantes(null);
      return;
    }
    const tick = () => {
      const restante = Math.max(0, Math.ceil((finalizaEn - (Date.now() + offset)) / 1000));
      setSegundosRestantes(restante);
      if (restante === 0 && esMiTurno) {
        verificarTimeoutCallable({ partidaId }).catch((err) =>
          console.error("Error verificando timeout:", err)
        );
      }
    };
    tick();
    const intervalo = setInterval(tick, 1000);
    return () => clearInterval(intervalo);
  }, [finalizaEn, partidaId, esMiTurno, offset]);

  const handleCasillaClick = async (casillaClave) => {
    if (colocando || !esMiTurno || bombasRestantes <= 0) return;
    setColocando(true);
    setError("");
    try {
      await colocarBombaCallable({ partidaId, casillaClave });
    } catch (err) {
      console.error("Error al colocar bomba:", err);
      setError(err.message || "No se pudo colocar la bomba.");
    } finally {
      setColocando(false);
    }
  };

  return (
    <>
      <HudPartida
        titulo={`Ronda ${partida.ronda}`}
        fase="Preparación"
        segundos={segundosRestantes}
        yo={{
          perfil: perfiles[user.uid],
          vidas: miInfo?.vidas,
          enTurno: esMiTurno,
          extra: <ExtraBombas tipo={tipoBomba} cantidad={bombasRestantes} />,
        }}
        rival={{ perfil: perfiles[rivalUid], vidas: rivalInfo?.vidas, enTurno: !esMiTurno }}
      />

      <div className={"gp-status" + (esMiTurno ? " gp-status--activo" : "")}>
        {esMiTurno
          ? bombasRestantes > 0
            ? "Tu turno: coloca tus bombas en el tablero"
            : "Listo, esperando..."
          : "El rival está colocando sus bombas"}
      </div>
      {error && <p className="gp-error">{error}</p>}

      <Tablero
        casillas={partida.casillas}
        onCasillaClick={handleCasillaClick}
        deshabilitado={!esMiTurno || colocando || bombasRestantes <= 0}
      />
    </>
  );
}