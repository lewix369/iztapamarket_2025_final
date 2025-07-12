// src/pages/RegistroPro.jsx

import React, { useEffect, useState } from "react";
import { createPreference } from "@/services/createPreference";

const RegistroPro = () => {
  const [mpUrl, setMpUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const iniciarPago = async () => {
      try {
        const preferenceUrl = await createPreference({
          title: "Plan Pro",
          price: 149,
        });
        setMpUrl(preferenceUrl);
      } catch (err) {
        console.error("Error al generar preferencia:", err);
        setError("❌ No se pudo generar el enlace de pago. Intenta más tarde.");
      }
    };

    iniciarPago();
  }, []);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-4 text-center">
        Registro: Plan Pro
      </h1>

      {error && <p className="text-red-600">{error}</p>}

      {mpUrl ? (
        <a
          href={mpUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
        >
          Ir al pago con Mercado Pago
        </a>
      ) : !error ? (
        <p className="text-gray-500">Generando enlace de pago...</p>
      ) : null}
    </main>
  );
};

export default RegistroPro;
