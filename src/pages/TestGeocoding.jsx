// src/pages/TestGeocoding.jsx
import React, { useState } from "react";
import { getCoordsFromAddress } from "@/lib/geocoding"; // o ajusta ruta si es diferente

const TestGeocoding = () => {
  const [coords, setCoords] = useState(null);
  const [address, setAddress] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await getCoordsFromAddress(address);
    setCoords(result);
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold">Test Geolocalización</h2>
      <form onSubmit={handleSubmit} className="mt-4">
        <input
          className="border p-2 w-full"
          placeholder="Escribe una dirección..."
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <button
          type="submit"
          className="mt-2 bg-blue-600 text-white px-4 py-2 rounded"
        >
          Obtener coordenadas
        </button>
      </form>

      {coords && (
        <div className="mt-4">
          <p>
            <strong>Latitud:</strong> {coords.lat}
          </p>
          <p>
            <strong>Longitud:</strong> {coords.lng}
          </p>
        </div>
      )}
    </div>
  );
};

export default TestGeocoding;
