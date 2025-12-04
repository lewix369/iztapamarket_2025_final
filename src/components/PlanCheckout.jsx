import React, { useState } from "react";
import { createAndPickCheckoutUrl } from "@/lib/mpCheckout";

export default function PlanCheckout() {
  const [email, setEmail] = useState("");
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [error, setError] = useState("");

  const isValidEmail = (str) => /\S+@\S+\.\S+/.test(String(str || "").trim());

  const handleBuy = async (plan) => {
    try {
      setError("");
      setLoadingPlan(plan);

      const emailClean = String(email || "").trim().toLowerCase();
      if (!isValidEmail(emailClean)) {
        throw new Error("Ingresa un email válido.");
      }

      const payload = {
        title: plan === "premium" ? "IztapaMarket Premium" : "IztapaMarket Pro",
        price: plan === "premium" ? 500 : 300,
        quantity: 1,
        currency_id: "MXN",
        email: emailClean,
        payer_email: emailClean,
        payer: { email: emailClean },
        plan,
        metadata: {
          contact_email: emailClean,
          plan_type: plan,
          email: emailClean,
          plan,
        },
        binary_mode: true,
        external_reference: `${emailClean}|${plan}|web`,
      };

      const url = await createAndPickCheckoutUrl(payload);
      window.location.href = url;
    } catch (e) {
      setError(e.message || "Error al crear la preferencia.");
      setLoadingPlan(null);
    }
  };

  const emailOk = isValidEmail(email);

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", fontFamily: "system-ui" }}>
      <h2>Elige tu plan</h2>

      <label style={{ display: "block", marginBottom: 8 }}>
        Email para el recibo:
      </label>
      <input
        type="email"
        placeholder="tu.email@dominio.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{
          width: "100%",
          padding: "10px 12px",
          marginBottom: 16,
          border: "1px solid #ddd",
          borderRadius: 8,
          fontSize: 16,
        }}
      />

      <div style={{ display: "grid", gap: 12 }}>
        <button
          onClick={() => handleBuy("pro")}
          disabled={!emailOk || loadingPlan !== null}
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            border: "none",
            fontSize: 16,
            cursor: loadingPlan ? "not-allowed" : "pointer",
          }}
        >
          {loadingPlan === "pro" ? "Redirigiendo…" : "Comprar Plan Pro (MXN $300)"}
        </button>

        <button
          onClick={() => handleBuy("premium")}
          disabled={!emailOk || loadingPlan !== null}
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            border: "none",
            fontSize: 16,
            cursor: loadingPlan ? "not-allowed" : "pointer",
          }}
        >
          {loadingPlan === "premium" ? "Redirigiendo…" : "Comprar Plan Premium (MXN $500)"}
        </button>
      </div>

      {error && <p style={{ color: "crimson", marginTop: 12 }}>❌ {error}</p>}
    </div>
  );
}