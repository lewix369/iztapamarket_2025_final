import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import RegisterBusinessPage from "@/components/RegisterBusinessPage";

/**
 * Registro.jsx
 * - Unifica el flujo con PaySuccess.jsx
 * - Genera la preferencia desde el backend v2 ENVIANDO email/plan
 * - Marca pago aprobado cuando paid=approved o mp_status=approved
 * - Persiste nombre/email en localStorage para que PaySuccess/Registro lean esos datos
 */
const Registro = () => {
  const [searchParams] = useSearchParams();

  // UI state
  const [mpUrl, setMpUrl] = useState(null);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState(searchParams.get("email") || "");

  const plan = searchParams.get("plan")?.toLowerCase();
  const paidParam = (searchParams.get("paid") || "").toLowerCase();
  const mpStatus = (searchParams.get("mp_status") || "").toLowerCase();

  // Acepta múltiples variantes para "aprobado"
  const paymentApproved = useMemo(() => {
    const truthy = new Set(["true", "1", "yes", "approved", "ok"]);
    return truthy.has(paidParam) || mpStatus === "approved";
  }, [paidParam, mpStatus]);

  // Helper: base del backend para llamar /api/create_preference_v2
  const API_BASE = useMemo(() => {
    // VITE_MP_BASE puede apuntar a dominio (sin /api)
    const b = (import.meta.env.VITE_MP_BASE || "").replace(/\/$/, "");
    return b || "";
  }, []);

  // Guarda progreso para que PaySuccess/Registro puedan leerlo
  useEffect(() => {
    try {
      if (email) localStorage.setItem("correo_negocio", email.toLowerCase());
      if (nombre) localStorage.setItem("nombre_negocio", nombre);
      if (plan) localStorage.setItem("reg_plan", plan);
    } catch {}
  }, [email, nombre, plan]);

  // Genera enlace de pago SOLO para pro/premium y si aún no está aprobado
  useEffect(() => {
    let cancelled = false;

    async function iniciarPago() {
      if (plan !== "pro" && plan !== "premium") return;
      if (paymentApproved) return;

      if (!nombre || !email) {
        setMpUrl(null);
        return;
      }

      try {
        // Precio por plan (puedes ajustar; el backend también puede sobrescribir)
        const unit_price = 10; // TEMP: precio de prueba MXN 10 (revertir a 149/299 para producción)

        // Usa el endpoint del backend que ya validamos por curl
        const url = `${API_BASE}/api/create_preference_v2`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            email,
            plan,
            unit_price,
            title: `Suscripción ${plan}`,
            quantity: 1,
          }),
        });

        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j?.init_point) {
          console.error("❌ Error creando preferencia:", j);
          setMpUrl(null);
          return;
        }

        if (!cancelled) setMpUrl(j.init_point);
        console.log("🧾 init_point:", j.init_point);
      } catch (error) {
        console.error("❌ Error generando preferencia de pago:", error);
        setMpUrl(null);
      }
    }

    iniciarPago();
    return () => {
      cancelled = true;
    };
  }, [API_BASE, plan, nombre, email, paymentApproved]);

  // UX: log del enlace
  useEffect(() => {
    if (mpUrl) console.log("✅ mpUrl actualizada:", mpUrl);
  }, [mpUrl]);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-4 text-center capitalize">
        Registro de Plan: {plan || "(sin plan)"}
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
      {(plan === "pro" || plan === "premium") && !paymentApproved && (
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
            <p className="text-gray-500">Generando enlace de pago…</p>
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
      {(plan === "pro" || plan === "premium") && paymentApproved && (
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
