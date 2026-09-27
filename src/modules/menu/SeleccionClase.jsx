import { useState, useRef } from "react";
import { ref, set } from "firebase/database";
import { rtdb } from "../../firebase/config";
import { useAuth } from "../../context/AuthContext";
import { unirseACola } from "./matchmaking";

// RQNF-MEN-03: identificador único por clase
const CLASES = [
  { id: "minibomba", nombre: "MiniBomba" },
  { id: "bomba", nombre: "Bomba" },
  { id: "bombota", nombre: "Bombota" },
  { id: "aleatoria", nombre: "Aleatoria" },
];

export default function SeleccionClase({ tipoAccion, modalidad, onConfirmar, onCancelar }) {
  const [confirmando, setConfirmando] = useState(false);
  const yaConfirmado = useRef(false); // evita que se busque dos veces partida
  const { user } = useAuth();

  const handleConfirmar = async (claseId) => {
    if (yaConfirmado.current) return; // ignora cualquier segundo disparo
    yaConfirmado.current = true;
    setConfirmando(true);

    console.log("Clase confirmada:", claseId, "Modalidad:", modalidad, "Acción:", tipoAccion);

    if (tipoAccion === "buscar") {
      await unirseACola(modalidad, user.uid, claseId, user.isAnonymous);
    } else {
      // RQF-MEN-05: generar enlace de invitación irrepetible (pendiente)
      console.log("Creando lobby privado...");
    }

    onConfirmar(claseId);
  };

  return (
    <div className="seleccion-clase">
      <h3>Elige tu clase de bomba</h3>
      <div className="opciones-clases">
        {CLASES.map((c) => (
          <button
            key={c.id}
            data-clase-id={c.id}
            onClick={() => handleConfirmar(c.id)}
            disabled={confirmando}
          >
            {c.nombre}
          </button>
        ))}
      </div>
      <button className="btn-volver" onClick={onCancelar} disabled={confirmando}>
        Cancelar
      </button>
    </div>
  );
}