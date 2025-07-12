import React, { useState } from "react";
import { getCurrentPosition } from "../lib/getCurrentPosition";

const NearbyTest = () => {
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);

  const handleGetLocation = async () => {
    try {
      const position = await getCurrentPosition();
      setCoords(position);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold">Prueba: ¿Dónde estoy?</h2>
      <button
        onClick={handleGetLocation}
        className="mt-2 bg-green-600 text-white px-4 py-2 rounded"
      >
        Obtener mi ubicación
      </button>

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

      {error && <p className="text-red-600 mt-4">{error}</p>}
    </div>
  );
};

export default NearbyTest;
