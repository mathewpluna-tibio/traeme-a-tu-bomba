import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from "firebase/firestore";
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

export default function AdminJugadores() {
  const [termino, setTermino] = useState("");
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    const t = termino.trim();
    if (t.length < 2) {
      setResultados([]);
      return;
    }
    let cancelado = false;
    const id = setTimeout(async () => {
      setBuscando(true);
      try {
        const porNombre = await getDocs(
          query(collection(db, "usuarios"), orderBy("username"), where("username", ">=", t), where("username", "<=", t + ""), limit(20))
        );
        let lista = porNombre.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (t.length >= 20) {
          const porId = await getDoc(doc(db, "usuarios", t));
          if (porId.exists() && !lista.some((j) => j.id === porId.id)) lista = [{ id: porId.id, ...porId.data() }, ...lista];
        }
        if (!cancelado) setResultados(lista);
      } catch (err) {
        console.error("Error al buscar jugadores:", err);
      } finally {
        if (!cancelado) setBuscando(false);
      }
    }, 300);
    return () => {
      cancelado = true;
      clearTimeout(id);
    };
  }, [termino]);

  const actualizar = (j) => setResultados((lista) => lista.map((x) => (x.id === j.id ? j : x)));

  return (
    <section>
      <h2 className="ad-h2">Jugadores</h2>
      <input
        className="ad-input ad-search"
        placeholder="Buscar por nombre de usuario o por ID"
        value={termino}
        onChange={(e) => setTermino(e.target.value)}
      />
      {buscando && <p className="ad-muted">Buscando...</p>}
      {!buscando && termino.trim().length >= 2 && resultados.length === 0 && <p className="ad-muted">Sin resultados.</p>}
      <div className="ad-list">
        {resultados.map((j) => (
          <Fila key={j.id} jugador={j} onCambio={actualizar} />
        ))}
      </div>
    </section>
  );
}