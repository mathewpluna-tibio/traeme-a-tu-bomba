import { useEffect, useRef, useState } from "react";
import { ref, onValue, onDisconnect } from "firebase/database";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { rtdb, db, functions } from "../../firebase/config";
import { reproducirAlerta } from "../gameplay/efectos/sonidos";
import { buscarModo, buscarClase } from "../menu/buscarPartidaConfig";
import { PanelBuscar, VisualBomba } from "../menu/BuscarPartidaUI";
import "./Lobby.css";

const cancelarLobbyCallable = httpsCallable(functions, "cancelarLobby");
const expirarRetoCallable = httpsCallable(functions, "expirarReto");

async function nombreJugador(uid) {
  try {
    const snap = await getDoc(doc(db, "usuarios", uid));
    return snap.exists() ? snap.data().username || "Jugador" : "Invitado";
  } catch {
    return "Jugador";
  }
}

export default function LobbyEspera({ lobbyId, esReto, modalidad, clase, onCancelar, onCerrado }) {
  const [copiado, setCopiado] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const enlace = `${window.location.origin}/?lobby=${lobbyId}`;

  const [expiraEn, setExpiraEn] = useState(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const [rival, setRival] = useState(null); // nombre del rival que está eligiendo clase
  const rivalUidRef = useRef(null);

  useEffect(() => {
    const estadoRef = ref(rtdb, `lobbies/${lobbyId}/estado`);

    // Si el creador se desconecta, el lobby se cancela solo (así el enlace
    // y el reto dejan de servir).
    const alDesconectar = onDisconnect(estadoRef);
    alDesconectar.set("cancelada");

    const desuscribir = onValue(ref(rtdb, `lobbies/${lobbyId}`), (snap) => {
      const lobby = snap.val();
      if (!lobby) return;
      if (lobby.estado === "cancelada" || lobby.estado === "expirada") {
        onCerrado(lobby.estado);
        return;
      }
      setExpiraEn(lobby.expiraEn || null);

      // RQF-MEN-06D: aviso de rival encontrado mientras elige su clase.
      const uidRival = lobby.rivalEligiendo?.uid || null;
      if (uidRival !== rivalUidRef.current) {
        rivalUidRef.current = uidRival;
        if (uidRival) {
          reproducirAlerta("rival");
          setRival("...");
          nombreJugador(uidRival).then((n) => {
            if (rivalUidRef.current === uidRival) setRival(n);
          });
        } else {
          setRival(null);
        }
      }
    });

    return () => {
      desuscribir();
      alDesconectar.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbyId]);

  // RQF-AMI-02B: cuenta regresiva del reto; al llegar a cero se pide al
  // servidor que lo marque como expirado (RQNF-AMI-02).
  useEffect(() => {
    if (!expiraEn) return;
    const id = setInterval(() => setAhora(Date.now()), 500);
    return () => clearInterval(id);
  }, [expiraEn]);

  const segundosRestantes = expiraEn ? Math.max(0, Math.ceil((expiraEn - ahora) / 1000)) : null;
  const vencido = segundosRestantes === 0;

  useEffect(() => {
    if (!vencido) return;
    expirarRetoCallable({ lobbyId }).catch((err) => console.error("Error al expirar el reto:", err));
    // Si el servidor aún no lo da por vencido (diferencia de reloj), reintenta.
    const id = setInterval(() => {
      expirarRetoCallable({ lobbyId }).catch(() => {});
    }, 3000);
    return () => clearInterval(id);
  }, [vencido, lobbyId]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt("Copia el enlace:", enlace);
    }
  };

  const cancelar = async () => {
    setCancelando(true);
    try {
      await cancelarLobbyCallable({ lobbyId });
    } catch (err) {
      console.error("Error al cancelar lobby:", err);
    }
    onCancelar();
  };

  const modo = buscarModo(modalidad);
  const claseBomba = buscarClase(clase);
  const visual = claseBomba || modo;

  return (
    <PanelBuscar titulo="Crear lobby privado" paso="busqueda" conClase={!!modo?.tieneClase}>
      <div className="sm-status">
        <div className="sm-status-visual sm-status-visual--pulse">{visual && <VisualBomba item={visual} />}</div>
        <h2 className="sm-status-title">
          {rival ? "Rival encontrado" : esReto ? "Reto enviado" : "Lobby creado"}
        </h2>
        <p className="sm-status-text">
          {rival
            ? `${rival} está eligiendo su clase de bomba. La partida inicia en cuanto confirme.`
            : esReto
              ? "Esperando a que el jugador acepte el reto..."
              : "Comparte el enlace con tu rival. La partida inicia cuando se una y elija su clase."}
        </p>
        {esReto && segundosRestantes != null && !rival && (
          <p className="sm-status-text lobby-cuenta">
            El reto expira en <strong>{segundosRestantes} s</strong>
          </p>
        )}

        <div className="sm-chips">
          {[modo, claseBomba].filter(Boolean).map((i) => (
            <span key={i.id} className="sm-chip">{i.nombre}</span>
          ))}
        </div>

        <div className="sm-invite">
          <input className="sm-invite-input" type="text" readOnly value={enlace} onFocus={(e) => e.target.select()} />
          <button className="sm-btn sm-btn--secondary" onClick={copiar}>
            {copiado ? "¡Copiado!" : "Copiar"}
          </button>
        </div>

        <p className="sm-status-text">El enlace deja de funcionar cuando inicia la partida o cancelas el lobby.</p>

        <button className="sm-btn sm-btn--danger" onClick={cancelar} disabled={cancelando}>
          Cancelar lobby
        </button>
      </div>
    </PanelBuscar>
  );
}