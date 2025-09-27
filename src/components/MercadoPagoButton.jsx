import { useEffect, useState } from "react";
import { initMercadoPago, Wallet } from "@mercadopago/sdk-react";

// Inicializa Mercado Pago con tu Public Key y locale
initMercadoPago(import.meta.env.VITE_MP_PUBLIC_KEY, { locale: "es-MX" });

export default function MercadoPagoButton({
  email = "TESTUSER16368732@testuser.com", // usa el buyer de pruebas
  plan = "premium",
  title = "Suscripción premium",
  unit_price = 10,
  quantity = 1,
}) {
  const [preferenceId, setPreferenceId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError("");
        const resp = await fetch(import.meta.env.VITE_CREATE_PREFERENCE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, plan, title, unit_price, quantity }),
        });
        const data = await resp.json();
        if (!resp.ok || !data?.id) {
          throw new Error(data?.error || "No se pudo crear la preferencia");
        }
        setPreferenceId(data.id);
      } catch (e) {
        setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [email, plan, title, unit_price, quantity]);

  if (loading) return <p>Generando preferencia…</p>;
  if (error) return <p style={{ color: "crimson" }}>Error: {error}</p>;
  if (!preferenceId) return null;

  return (
    <div style={{ width: 320 }}>
      {/* Wallet renderiza el botón amarillo y redirige a MP */}
      <Wallet initialization={{ preferenceId }} />
    </div>
  );
}
