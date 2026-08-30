import { useMachine } from "@xstate/react";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../context/AuthContext";
import { unirseACola } from "./matchmaking";
import { useNotificacionPartida } from "../../hooks/useNotificacionPartida";
import { menuMachine } from "./menuMachine";
import SeleccionModalidad from "./SeleccionModalidad";
import SeleccionClase from "./SeleccionClase";
import PartidaScreen from "../gameplay/PartidaScreen";
import { useEffect } from "react";
import "./MenuPrincipal.css";

export default function MenuPrincipal() {
  const { user } = useAuth();
  const { partidaId, limpiarNotificacion } = useNotificacionPartida();
  const [state, send] = useMachine(menuMachine);

  useEffect(() => {
    console.log("[MenuPrincipal] partidaId cambió a:", partidaId, "| estado actual de la máquina:", state.value);
    if (partidaId) {
      send({ type: "PARTIDA_ENCONTRADA", partidaId });
    }
  }, [partidaId, send]);

  const iniciarFlujo = (accion) => {
    send({ type: "INICIAR_FLUJO", accion });
  };

  const onModalidadSeleccionada = async (modalidad) => {
    if (modalidad === "estandar") {
      send({ type: "SELECCIONAR_MODALIDAD_ESTANDAR" });
    } else {
      if (state.context.tipoAccion === "buscar") {
        await unirseACola(modalidad, user.uid, null, user.isAnonymous);
      }
      send({ type: "SELECCIONAR_MODALIDAD_OTRA", modalidad });
    }
  };

  const onClaseConfirmada = () => {
    send({ type: "CLASE_CONFIRMADA" });
  };

  const cancelarFlujo = () => {
    send({ type: "CANCELAR" });
  };

  const volverAlMenuDesdePartida = async () => {
    await limpiarNotificacion();
    send({ type: "VOLVER_AL_MENU" });
  };

  const jugarDeNuevo = async () => {
    await limpiarNotificacion();

    const prefRef = doc(db, "preferencias", user.uid);
    const prefSnap = await getDoc(prefRef);
    const ultimaModalidad = prefSnap.exists() ? prefSnap.data().ultimaModalidad : "estandar";
    const ultimaClase = prefSnap.exists() ? prefSnap.data().ultimaClase : "aleatoria";

    await unirseACola(ultimaModalidad, user.uid, ultimaClase, user.isAnonymous);
    send({ type: "JUGAR_DE_NUEVO", modalidad: ultimaModalidad });
  };

  if (state.matches("en_partida")) {
    return (
      <PartidaScreen
        partidaId={state.context.partidaId}
        onVolverAlMenu={volverAlMenuDesdePartida}
        onJugarDeNuevo={jugarDeNuevo}
      />
    );
  }

  if (state.matches("modalidad")) {
    return <SeleccionModalidad onSeleccionar={onModalidadSeleccionada} onCancelar={cancelarFlujo} />;
  }

  if (state.matches("clase")) {
    return (
      <SeleccionClase
        tipoAccion={state.context.tipoAccion}
        modalidad={state.context.modalidad}
        onConfirmar={onClaseConfirmada}
        onCancelar={cancelarFlujo}
      />
    );
  }

  if (state.matches("buscando")) {
    return (
      <div>
        <p>Buscando partida en modalidad: {state.context.modalidad}...</p>
        <button onClick={() => send({ type: "CANCELAR_BUSQUEDA" })}>Cancelar búsqueda</button>
      </div>
    );
  }

  return (
    <div className="menu-principal">
      <button className="btn-principal" onClick={() => iniciarFlujo("buscar")}>
        Buscar Partida
      </button>
      <button className="btn-principal" onClick={() => iniciarFlujo("lobby")}>
        Crear Lobby Privado
      </button>
    </div>
  );
}