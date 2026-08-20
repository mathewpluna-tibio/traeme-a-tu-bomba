const MODALIDADES = [
  { id: "estandar", nombre: "Estándar" },
  { id: "venenosas", nombre: "Bombas Venenosas" },
  { id: "caos", nombre: "Caos" },
];

export default function SeleccionModalidad({ onSeleccionar, onCancelar }) {
  return (
    <div className="seleccion-modalidad">
      <h3>Elige la modalidad</h3>
      <div className="opciones">
        {MODALIDADES.map((m) => (
          <button key={m.id} onClick={() => onSeleccionar(m.id)}>
            {m.nombre}
          </button>
        ))}
      </div>
      <button className="btn-volver" onClick={onCancelar}>
        Cancelar
      </button>
    </div>
  );
}