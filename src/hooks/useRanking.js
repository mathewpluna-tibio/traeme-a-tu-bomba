import { useState, useEffect } from "react";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";

export function useRanking(modalidad, categoria) {
  const [jugadores, setJugadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      setLoading(true);
      setError("");
      try {
        const campo = `estadisticas.${modalidad}.${categoria}`;
        const q = query(collection(db, "usuarios"), orderBy(campo, "desc"), limit(100));
        const snapshot = await getDocs(q);
        if (cancelado) return;

        const resultados = snapshot.docs.map((doc, index) => {
          const data = doc.data();
          return {
            posicion: index + 1,
            uid: doc.id,
            username: data.username,
            fotoPerfil: data.fotoPerfil || "",
            rango: data.estadisticas?.[modalidad]?.rango || "Cadetes Bomberos",
            valor: data.estadisticas?.[modalidad]?.[categoria] ?? 0,
          };
        });

        setJugadores(resultados);
      } catch (err) {
        console.error("Error cargando ranking:", err);
        if (!cancelado) setError("No se pudo cargar el ranking.");
      } finally {
        if (!cancelado) setLoading(false);
      }
    }

    cargar();
    return () => { cancelado = true; };
  }, [modalidad, categoria]);

  return { jugadores, loading, error };
}