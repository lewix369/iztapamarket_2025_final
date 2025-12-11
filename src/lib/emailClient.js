// src/lib/emailClient.js

const API_BASE =
  // Producción: dominio público en Vercel → backend en Render
  (typeof window !== "undefined" &&
    window.location.origin.includes("iztapamarket.com"))
    ? "https://iztapamarket-2025-final.onrender.com/api"
    // Local / otros entornos
    : import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";

console.log("[emailClient] API_BASE para welcome-email:", API_BASE);

export async function sendWelcomeEmail(payload) {
  try {
    const res = await fetch(`${API_BASE}/send-welcome-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text().catch(() => "");

    if (!res.ok) {
      console.error(
        "[emailClient] ❌ sendWelcomeEmail fallo",
        res.status,
        text
      );
      return { ok: false, status: res.status, error: text || "Request failed" };
    }

    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }

    console.log("[emailClient] ✅ sendWelcomeEmail OK", data);
    return { ok: true, ...data };
  } catch (err) {
    console.error("[emailClient] ❌ sendWelcomeEmail exception", err);
    return { ok: false, error: String(err) };
  }
}