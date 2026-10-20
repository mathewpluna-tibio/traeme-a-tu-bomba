import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../firebase/config";
import contenidoLocal from "../modules/guia/guiaContenido.json";

// RQNF-SOP-03: el contenido de la guía se carga desde Firestore (`guias`).
// Si la colección está vacía o no se puede leer, se usa la copia incluida en
// la app para que la guía nunca quede en blanco.
export function useGuia() {
  const [secciones, setSecciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [desdeFirestore, setDesdeFirestore] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, "guias"), orderBy("orden")));
        if (cancelado) return;
        if (snap.empty) {
          setSecciones(contenidoLocal);
        } else {
          setSecciones(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          setDesdeFirestore(true);
        }
      } catch (err) {
        console.error("No se pudo cargar la guía desde Firestore:", err);
        if (!cancelado) setSecciones(contenidoLocal);
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  return { secciones, cargando, desdeFirestore };
}