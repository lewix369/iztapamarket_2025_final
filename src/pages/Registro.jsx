import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { createPreference } from "@/services/createPreference";
import RegisterBusinessPage from "@/components/RegisterBusinessPage";

const Registro = () => {
  const [searchParams] = useSearchParams();
  const [mpUrl, setMpUrl] = useState(null);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const plan = searchParams.get("plan")?.toLowerCase();
  const paid = searchParams.get("paid");

  useEffect(() => {
    const iniciarPago = async () => {
      if (plan !== "pro" && plan !== "premium") return;
      if (paid === "true") return;

      if (!nombre || !email) {
        setMpUrl(null);
        return;
      }

      try {
        const preferenceUrl = await createPreference(
          `Plan ${plan}`,
          plan === "premium" ? 299 : 149,
          1
        );
        setMpUrl(preferenceUrl);
        console.log(preferenceUrl);
      } catch (error) {
        console.error("❌ Error generando preferencia de pago:", error);
        setMpUrl(null);
      }
    };
    iniciarPago();
  }, [plan, nombre, email, paid]);

  useEffect(() => {
    console.log("✅ mpUrl actualizada:", mpUrl);
  }, [mpUrl]);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-4 text-center capitalize">
        Registro de Plan: {plan}
      </h1>

      {/* PLAN FREE */}
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

      {/* PLAN PRO o PREMIUM — PASO 1: IR AL PAGO */}
      {(plan === "pro" || plan === "premium") && paid !== "true" && (
        <div className="w-full max-w-2xl bg-white p-6 rounded shadow-md">
          <label className="block mb-2 font-medium">Nombre del Negocio</label>
          <input
            type="text"
            className="w-full border p-2 rounded mb-4"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Taquería El Fogón"
          />

          <label className="block mb-2 font-medium">Correo Electrónico</label>
          <input
            type="email"
            className="w-full border p-2 rounded mb-4"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ejemplo@correo.com"
          />
          {(!nombre || !email) && (
            <p className="text-sm text-red-600">
              ⚠️ Ingresa nombre y correo para generar el enlace de pago.
            </p>
          )}

          {!nombre || !email ? (
            <button
              disabled
              className="bg-gray-300 text-white px-6 py-3 rounded-lg block text-center w-full cursor-not-allowed"
            >
              Completa nombre y correo
            </button>
          ) : !mpUrl ? (
            <>
              <p className="text-gray-500">Generando enlace de pago...</p>
              {mpUrl && (
                <p className="text-green-600 break-all text-sm mt-2">
                  URL generada: {mpUrl}
                </p>
              )}
            </>
          ) : (
            <a
              href={mpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition block text-center"
            >
              Ir al pago de Mercado Pago
            </a>
          )}
        </div>
      )}

      {/* PLAN PRO o PREMIUM — PASO 2: FORMULARIO DESPUÉS DEL PAGO */}
      {(plan === "pro" || plan === "premium") && paid === "true" && (
        <div className="w-full max-w-4xl border p-4 rounded-md shadow-md bg-white my-6">
          <RegisterBusinessPage plan={plan} />
        </div>
      )}

      {/* PLAN INVÁLIDO */}
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
