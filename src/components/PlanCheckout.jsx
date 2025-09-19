// src/components/PlanCheckout.jsx
import React, { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { createAndPickCheckoutUrl } from "@/lib/mpCheckout";

export default function PlanCheckout() {
  const [email, setEmail] = useState("");
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [error, setError] = useState("");
  const [freeLoading, setFreeLoading] = useState(false);
  const [okMsg, setOkMsg] = useState("");

  const handleBuy = async (plan) => {
    try {
      setError("");
      setLoadingPlan(plan);

      const emailClean = String(email || "").trim();
      if (!/\S+@\S+\.\S+/.test(emailClean)) {
        throw new Error("Ingresa un email válido.");
      }

      const payload = {
        title: plan === "premium" ? "IztapaMarket Premium" : "IztapaMarket Pro",
        price: plan === "premium" ? 500 : 300, // ajusta si cambian
        quantity: 1,
        currency_id: "MXN",
        payer_email: emailClean,
        plan,
        binary_mode: true,
        // opcional pero útil para callbacks y búsqueda:
        external_reference: `${emailClean}|${plan}|web`,
      };

      const url = await createAndPickCheckoutUrl(payload);
      window.location.href = url;
    } catch (e) {
      setError(e.message || "Error al crear la preferencia.");
      setLoadingPlan(null);
    }
  };

  const activateFree = async (emailArg) => {
    const emailClean = String(emailArg || "")
      .trim()
      .toLowerCase();
    if (!emailClean || !/\S+@\S+\.\S+/.test(emailClean)) {
      throw new Error("Ingresa un email válido.");
    }
    const now = new Date().toISOString();
    const { error: e1 } = await supabase
      .from("profiles")
      .upsert(
        { email: emailClean, plan_type: "free", updated_at: now },
        { onConflict: "email" }
      );
    if (e1) throw new Error(e1.message || "No se pudo activar el plan Free.");
    window.location.href = `/registro?plan=free&email=${encodeURIComponent(
      emailClean
    )}`;
  };

  const handleFree = async () => {
    try {
      setError("");
      setOkMsg("");
      setFreeLoading(true);
      await activateFree(email);
    } catch (e) {
      setError(e.message || "Error al activar el plan Free.");
    } finally {
      setFreeLoading(false);
    }
  };

  return (
    <div
      style={{ maxWidth: 420, margin: "40px auto", fontFamily: "system-ui" }}
    >
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
          onClick={handleFree}
          disabled={freeLoading || loadingPlan !== null}
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#f7f7f7",
            fontSize: 16,
            cursor: freeLoading ? "not-allowed" : "pointer",
          }}
        >
          {freeLoading ? "Activando…" : "Continuar con Plan Free"}
        </button>

        <button
          onClick={() => handleBuy("pro")}
          disabled={loadingPlan !== null}
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            border: "none",
            fontSize: 16,
            cursor: loadingPlan ? "not-allowed" : "pointer",
          }}
        >
          {loadingPlan === "pro"
            ? "Redirigiendo…"
            : "Comprar Plan Pro (MXN $300)"}
        </button>

        <button
          onClick={() => handleBuy("premium")}
          disabled={loadingPlan !== null}
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            border: "none",
            fontSize: 16,
            cursor: loadingPlan ? "not-allowed" : "pointer",
          }}
        >
          {loadingPlan === "premium"
            ? "Redirigiendo…"
            : "Comprar Plan Premium (MXN $500)"}
        </button>
      </div>

      {error && <p style={{ color: "crimson", marginTop: 12 }}>❌ {error}</p>}
      {okMsg && <p style={{ color: "green", marginTop: 8 }}>{okMsg}</p>}
    </div>
  );
}
