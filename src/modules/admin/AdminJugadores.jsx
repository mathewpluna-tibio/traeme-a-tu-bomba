import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, limit, orderBy, query, startAfter, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../firebase/config";

const banearCallable = httpsCallable(functions, "banearUsuario");
const renombrarCallable = httpsCallable(functions, "forzarCambioNombre");

function Fila({ jugador, onCambio }) {
  const [renombrando, setRenombrando] = useState(false);
  const [nombre, setNombre] = useState(jugador.username || "");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");

  const ejecutar = async (fn) => {
    setOcupado(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      console.error(err);
      setError(err.message || "No se pudo completar la acción.");
    } finally {
      setOcupado(false);
    }
  };

  const alternarBaneo = () => {
    const banear = !jugador.baneado;
    let motivo = "";
    if (banear) {
      if (!window.confirm(`¿Banear a "${jugador.username}"? No podrá volver a entrar a la plataforma.`)) return;
      motivo = window.prompt("Motivo del baneo (opcional):") || "";
    }
    ejecutar(async () => {
      await banearCallable({ uid: jugador.id, baneado: banear, motivo });
      onCambio({ ...jugador, baneado: banear });
    });
  };

  const guardarNombre = (e) => {
    e.preventDefault();
    ejecutar(async () => {
      await renombrarCallable({ uid: jugador.id, username: nombre });
      onCambio({ ...jugador, username: nombre.trim() });
      setRenombrando(false);
    });
  };

  return (
    <article className="ad-card ad-jugador">
      <div className="ad-card-top">
        <div>
          <h3 className="ad-h3">
            {jugador.username || "(sin nombre)"}{" "}
            {jugador.baneado && <span className="ad-badge ad-badge--baneado">Baneado</span>}
          </h3>
          <span className="ad-muted">{jugador.email || "sin correo"}</span>
          <br />
          <code className="ad-uid">{jugador.id}</code>
        </div>
        <div className="ad-actions">
          <button type="button" className="ad-btn ad-btn--ghost ad-btn--sm" disabled={ocupado} onClick={() => setRenombrando((v) => !v)}>
            Cambiar nombre
          </button>
          <button
            type="button"
            className={"ad-btn ad-btn--sm " + (jugador.baneado ? "ad-btn--primary" : "ad-btn--danger")}
            disabled={ocupado}
            onClick={alternarBaneo}
          >
            {jugador.baneado ? "Desbanear" : "Banear"}
          </button>
        </div>
      </div>

      {renombrando && (
        <form className="ad-row ad-rename" onSubmit={guardarNombre}>
          <input className="ad-input" value={nombre} minLength={3} maxLength={20} onChange={(e) => setNombre(e.target.value)} required />
          <button type="submit" className="ad-btn ad-btn--primary ad-btn--sm" disabled={ocupado}>Guardar</button>
        </form>
      )}
      {jugador.baneado && jugador.motivoBaneo && <p className="ad-muted">Motivo: {jugador.motivoBaneo}</p>}
      {error && <p className="ad-error">{error}</p>}
    </article>
  );
}

const POR_PAGINA = 25;
const FIN_RANGO = "\uf8ff";

export default function AdminJugadores() {
  const [termino, setTermino] = useState("");
  const [lista, setLista] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(false);

  const t = termino.trim();
  const filtrando = t.length >= 2;

  // Sin búsqueda: todos los jugadores (paginados). Con búsqueda (2+ letras): filtrados.
  useEffect(() => {
    let cancelado = false;
    const id = setTimeout(async () => {
      setCargando(true);
      try {
        const base = [collection(db, "usuarios"), orderBy("username")];
        if (filtrando) base.push(where("username", ">=", t), where("username", "<=", t + FIN_RANGO));
        const snap = await getDocs(query(...base, limit(filtrando ? 20 : POR_PAGINA)));
        let datos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (filtrando && t.length >= 20) {
          const porId = await getDoc(doc(db, "usuarios", t));
          if (porId.exists() && !datos.some((j) => j.id === porId.id)) datos = [{ id: porId.id, ...porId.data() }, ...datos];
        }
        if (cancelado) return;
        setLista(datos);
        setCursor(snap.docs[snap.docs.length - 1] || null);
        setHayMas(!filtrando && snap.docs.length === POR_PAGINA);
      } catch (err) {
        console.error("Error al cargar jugadores:", err);
      } finally {
        if (!cancelado) setCargando(false);
      }
    }, filtrando || t === "" ? 300 : 0);
    return () => {
      cancelado = true;
      clearTimeout(id);
    };
  }, [t, filtrando]);

  const cargarMas = async () => {
    if (!cursor) return;
    setCargando(true);
    try {
      const snap = await getDocs(query(collection(db, "usuarios"), orderBy("username"), startAfter(cursor), limit(POR_PAGINA)));
      setLista((l) => [...l, ...snap.docs.map((d) => ({ id: d.id, ...d.data() }))]);
      setCursor(snap.docs[snap.docs.length - 1] || cursor);
      setHayMas(snap.docs.length === POR_PAGINA);
    } catch (err) {
      console.error("Error al cargar más jugadores:", err);
    } finally {
      setCargando(false);
    }
  };

  const actualizar = (j) => setLista((l) => l.map((x) => (x.id === j.id ? j : x)));

  return (
    <section>
      <h2 className="ad-h2">Jugadores</h2>
      <input
        className="ad-input ad-search"
        placeholder="Filtrar por nombre de usuario o por ID"
        value={termino}
        onChange={(e) => setTermino(e.target.value)}
      />
      {t.length === 1 && <p className="ad-muted">Escribe al menos 2 letras para filtrar.</p>}
      {cargando && lista.length === 0 && <p className="ad-muted">Cargando...</p>}
      {!cargando && lista.length === 0 && <p className="ad-muted">{filtrando ? "Sin resultados." : "Aún no hay jugadores."}</p>}
      <div className="ad-list">
        {lista.map((j) => (
          <Fila key={j.id} jugador={j} onCambio={actualizar} />
        ))}
      </div>
      {hayMas && (
        <button type="button" className="ad-btn ad-btn--ghost" disabled={cargando} onClick={cargarMas}>
          {cargando ? "Cargando..." : "Cargar más"}
        </button>
      )}
    </section>
  );
}