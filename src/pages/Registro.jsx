import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { createPreference } from "@/services/createPreference";

const Registro = () => {
  const [searchParams] = useSearchParams();
  const [mpUrl, setMpUrl] = useState(null);
  const plan = searchParams.get("plan")?.toLowerCase();

  useEffect(() => {
    const iniciarPago = async () => {
      if (plan === "pro" || plan === "premium") {
        const preferenceUrl = await createPreference({
          title: `Plan ${plan}`,
          price: plan === "pro" ? 149 : 249,
        });
        setMpUrl(preferenceUrl);
      }
    };
    iniciarPago();
  }, [plan]);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-10">
      <h1 className="text-3xl font-bold mb-4">Registro de Plan: {plan}</h1>

      {plan === "free" ? (
        <>
          <p className="text-gray-600 mb-4">
            Este plan no requiere pago. Continúa con el registro.
          </p>
          <a
            href="/registro-confirmado?plan=free"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-lg"
          >
            Ir al formulario
          </a>
        </>
      ) : (plan === "pro" || plan === "premium") && mpUrl ? (
        <>
          <p className="text-gray-700 mb-4">
            Haz clic en el botón para completar tu pago. Una vez realizado,
            serás redirigido al formulario.
          </p>
          <a
            href={mpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg text-lg"
          >
            Ir a pagar con Mercado Pago
          </a>
          <p className="text-sm text-gray-500 mt-2">
            Una vez que hayas realizado el pago, continúa el registro aquí:{" "}
            <a
              href={`/registro-confirmado?plan=${plan}`}
              className="text-blue-600 underline"
            >
              Ir al formulario
            </a>
          </p>
        </>
      ) : (
        <p className="text-red-500">Plan no válido.</p>
      )}
    </main>
  );
};

export default Registro;
