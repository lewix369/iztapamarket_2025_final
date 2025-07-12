import React, { useState } from "react";
import { getCoordsFromAddress } from "../lib/geocoding";

const RegisterWithGeo = () => {
  const [formData, setFormData] = useState({
    nombre: "",
    direccion: "",
    lat: "",
    lng: "",
  });

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleGeocode = async () => {
    if (!formData.direccion) return;
    const coords = await getCoordsFromAddress(formData.direccion);
    if (coords) {
      setFormData((prev) => ({
        ...prev,
        lat: coords.lat,
        lng: coords.lng,
      }));
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Registro con Geolocalización</h2>

      <input
        type="text"
        name="nombre"
        placeholder="Nombre del negocio"
        value={formData.nombre}
        onChange={handleChange}
        className="border p-2 w-full mb-2"
      />

      <input
        type="text"
        name="direccion"
        placeholder="Dirección"
        value={formData.direccion}
        onChange={handleChange}
        className="border p-2 w-full mb-2"
      />

      <button
        onClick={handleGeocode}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Obtener coordenadas
      </button>

      {formData.lat && formData.lng && (
        <div className="mt-4">
          <p>
            <strong>Latitud:</strong> {formData.lat}
          </p>
          <p>
            <strong>Longitud:</strong> {formData.lng}
          </p>
        </div>
      )}
    </div>
  );
};

export default RegisterWithGeo;
