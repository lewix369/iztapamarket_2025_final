import React from "react";

const PromoCard = ({ promo, canDelete = false, onDelete, onEdit }) => {
  const formatDate = (date) => {
    if (!date) return "Sin fecha";
    return new Date(date).toLocaleDateString("es-MX", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const imagen = promo.promocion_imagen || promo.imagen_url;

  return (
    <div className="bg-white border border-gray-200 rounded-md p-4 mb-4">
      <h3 className="text-lg font-semibold text-orange-800 flex items-center gap-2">
        🎁 {promo.titulo || promo.promocion_titulo || "Promoción sin título"}
      </h3>

      <p className="text-gray-700">
        {promo.descripcion || promo.promocion_descripcion || "Sin descripción"}
      </p>

      {imagen && (
        <img
          src={imagen}
          alt="Imagen de la promoción"
          className="mt-2 rounded-md shadow max-h-64 object-contain w-full"
        />
      )}

      <p className="text-sm text-gray-500 mt-2">
        Vigencia: {formatDate(promo.fecha_inicio)} a{" "}
        {formatDate(promo.fecha_fin)}
      </p>

      {canDelete && (
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => onDelete?.(promo.id)}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
          >
            Eliminar promoción
          </button>
          <button
            onClick={() => onEdit?.(promo)}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition"
          >
            Editar promoción
          </button>
        </div>
      )}
    </div>
  );
};

export default PromoCard;
