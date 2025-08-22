import { useState } from "react";
import { createPreference } from "@/lib/CreatePreference";

export default function MercadoPagoButton({ nombre, plan, email }) {
  const [loading, setLoading] = useState(false);

  const handlePago = async () => {
    setLoading(true);

    try {
      const initPoint = await createPreference({ nombre, plan, email });

      if (initPoint) {
        window.location.href = initPoint;
      } else {
        alert("No se pudo iniciar el pago. Intenta nuevamente.");
      }
    } catch (error) {
      console.error("❌ Error al redirigir a Mercado Pago:", error);
      alert("Ocurrió un error al procesar el pago.");
    } finally {
      setLoading(false);
    }
  };

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