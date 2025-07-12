import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { createPreference } from "@/services/createPreference";
import RegisterBusinessPage from "@/components/RegisterBusinessPage";

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
    <main className="flex flex-col items-center justify-center min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-4 text-center capitalize">
        Registro de Plan: {plan}
      </h1>

      {plan === "free" && (
        <>
          <p className="mb-4 text-gray-700 text-center">
            Completa el siguiente formulario para registrar tu negocio con el
            plan gratuito.
          </p>
          <div className="w-full max-w-4xl border p-4 rounded-md shadow-md bg-white">
            <RegisterBusinessPage plan="free" />
          </div>
        </>
      )}

      {(plan === "pro" || plan === "premium") && (
        <>
          {mpUrl ? (
            <a
              href={mpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
            >
              Ir al pago de Mercado Pago
            </a>
          ) : (
            <p className="text-gray-500">Generando enlace de pago...</p>
          )}
        </>
      )}

      {!plan && (
        <p className="text-red-600 mt-4">
          ❌ No se especificó un plan válido. Usa <code>?plan=free</code>,{" "}
          <code>?plan=pro</code> o <code>?plan=premium</code>.
        </p>
      )}
    </main>
  );
};

export default Registro;
