// src/components/MercadoPagoButton.jsx
import { useState, useMemo } from "react";
import { createPreference } from "@/lib/CreatePreference";

export default function MercadoPagoButton({ nombre, plan = "premium", email }) {
  const [loading, setLoading] = useState(false);

  // Normaliza "pro" | "premium"
  const normalizedPlan = useMemo(() => {
    const p = typeof plan === "string" ? plan.trim().toLowerCase() : "premium";
    return p === "pro" || p === "premium" ? p : "premium";
  }, [plan]);

  async function handlePago() {
    if (loading) return;
    setLoading(true);
    try {
      const finalEmail = (
        email ||
        localStorage.getItem("reg_email") ||
        ""
      ).trim();
      if (!finalEmail) {
        alert("Falta el correo para continuar con el pago.");
        return;
      }

      // Guarda para success/callback
      localStorage.setItem("reg_plan", normalizedPlan);
      localStorage.setItem("reg_email", finalEmail);
      if (nombre) localStorage.setItem("reg_nombre", nombre);

      // 👇 Llama con (plan, email) — lo que tu backend espera
      const pref = await createPreference(normalizedPlan, finalEmail);

      // Guarda el tag para correlacionar (webhook / success)
      if (pref?.tag) localStorage.setItem("reg_tag", String(pref.tag));

      const initPoint =
        typeof pref === "string" ? pref : pref?.initPoint || pref?.freeRedirect;

      if (typeof initPoint === "string" && initPoint.startsWith("http")) {
        window.location.href = initPoint;
      } else {
        console.error("Respuesta inesperada de createPreference:", pref);
        alert("No se pudo iniciar el pago. Intenta nuevamente.");
      }
    } catch (e) {
      console.error("❌ Error al iniciar pago:", e);
      alert("Ocurrió un error al procesar el pago.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handlePago}
      disabled={loading}
      className={`px-4 py-2 rounded text-white ${
        loading ? "bg-gray-400" : "bg-orange-500 hover:bg-orange-600"
      }`}
    >
      {loading ? "Redirigiendo..." : "Pagar con Mercado Pago"}
    </button>
  );
}
