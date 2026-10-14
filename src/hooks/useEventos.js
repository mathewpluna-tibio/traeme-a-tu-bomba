import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase/config";

const aMs = (t) => (t?.toMillis ? t.toMillis() : Number(t) || 0);

/**
 * Eventos temporales en tiempo real (onSnapshot). Cualquier cambio del
 * administrador llega a todos los jugadores al instante (RQNF-ADM-02).
 */
export function useEventos() {
  const [eventos, setEventos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    const q = query(collection(db, "eventos"), orderBy("inicio", "desc"));
    return onSnapshot(
      q,
      (snap) => {
        setEventos(
          snap.docs.map((d) => {
            const x = d.data();
            return { ...x, id: d.id, inicio: aMs(x.inicio), fin: aMs(x.fin), misiones: x.misiones || [] };
          })
        );
        setCargando(false);
      },
      (err) => {
        console.error("Error al leer eventos:", err);
        setCargando(false);
      }
    );
  }, []);

  // Reloj liviano: reevalúa activo/concluido sin recargar nada.
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  const { activo, proximo } = useMemo(() => {
    const activo = eventos.find((e) => e.inicio <= ahora && ahora < e.fin) || null;
    const proximo =
      eventos.filter((e) => e.inicio > ahora).sort((a, b) => a.inicio - b.inicio)[0] || null;
    return { activo, proximo };
  }, [eventos, ahora]);

  return { eventos, cargando, ahora, activo, proximo };
}