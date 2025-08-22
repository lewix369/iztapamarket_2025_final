export function mapPromo(row = {}) {
  const id = row.id ?? row.promocion_id ?? null;
  const titulo = row.titulo ?? row.promocion_titulo ?? "Promoción sin título";
  const descripcion =
    row.descripcion ?? row.promocion_descripcion ?? "Sin descripción";
  const imagen_url = row.imagen_url ?? row.promocion_imagen ?? null;
  const fecha_inicio = row.fecha_inicio ?? row.promocion_inicio ?? null;
  const fecha_fin = row.fecha_fin ?? row.promocion_vigencia ?? null;

  return {
    id,
    titulo,
    descripcion,
    imagen_url,
    fecha_inicio,
    fecha_fin,
    _raw: row,
  };
}
