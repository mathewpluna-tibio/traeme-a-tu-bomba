export default function MarcoPerfil({ marco, className }) {
  const brillo = marco.color
    ? { filter: `drop-shadow(0 0 2px ${marco.color}) drop-shadow(0 0 6px ${marco.color})` }
    : undefined;
  return (
    <img
      className={className}
      src={marco.imagen}
      alt=""
      aria-hidden="true"
      title={marco.color ? marco.nombre : undefined}
      style={brillo}
    />
  );
}