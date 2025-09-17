// src/components/PlanCheckout.jsx
import { useUserPlan } from "@/hooks/useUserPlan";
import React, { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// O usa tu helper si ya lo tienes:
// import { createPreference } from "../lib/CreatePreference";
async function createPreference(plan, email) {
  const ENDPOINT =
    import.meta?.env?.VITE_CREATE_PREFERENCE_URL ||
    (window?.location?.hostname === "localhost"
      ? "http://localhost:3000/create_preference"
      : "/api/createPreference");

  const resp = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, email }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Servidor ${resp.status}: ${txt}`);
  }

  const data = await resp.json();
  const url =
    typeof data === "string"
      ? data
      : data?.init_point || data?.sandbox_init_point || "";

  if (!url || !url.startsWith("http")) {
    throw new Error("Respuesta sin init_point válido.");
  }

  // Agrega email y plan al query (opcional, útil para tus callbacks)
  const u = new URL(url);
  if (!u.searchParams.get("email")) u.searchParams.set("email", email);
  if (!u.searchParams.get("plan")) u.searchParams.set("plan", plan);
  return u.toString();
}

async function activateFree(email) {
  const emailClean = String(email || "")
    .trim()
    .toLowerCase();
  if (!emailClean || !/\S+@\S+\.\S+/.test(emailClean)) {
    throw new Error("Ingresa un email válido.");
  }
  const now = new Date().toISOString();

  // Upsert del perfil como FREE
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
  return { ok: true };
}

export default function PlanCheckout() {
  const [email, setEmail] = useState("");
  const [loadingPlan, setLoadingPlan] = useState(null); // "pro" | "premium" | null
  const [error, setError] = useState("");
  const [freeLoading, setFreeLoading] = useState(false);
  const [okMsg, setOkMsg] = useState("");

  const handleBuy = async (plan) => {
    try {
      setError("");
      setLoadingPlan(plan);
      if (!email || !/\S+@\S+\.\S+/.test(email)) {
        throw new Error("Ingresa un email válido.");
      }
      const url = await createPreference(plan, email);
      window.location.href = url; // redirige al checkout
    } catch (e) {
      setError(e.message || "Error al crear la preferencia.");
      setLoadingPlan(null);
    }
  };

  const handleFree = async () => {
    try {
      setError("");
      setOkMsg("");
      setFreeLoading(true);

      await activateFree(email);
      // Redirecciona ya dentro de activateFree, no es necesario setOkMsg aquí
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
