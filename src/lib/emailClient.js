// src/lib/api/emailClient.js
export async function sendWelcomeEmail({ to, businessName, businessSlug }) {
  try {
    const base = import.meta.env.VITE_API_BASE || "http://localhost:3001/api";

    const resp = await fetch(`${base}/send-welcome-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, businessName, businessSlug }),
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok || data.ok === false) {
      console.error("[sendWelcomeEmail] fallo", data);
      return { ok: false, error: data.error || "Error enviando email" };
    }

    console.log("[sendWelcomeEmail] ok");
    return { ok: true };
  } catch (e) {
    console.error("[sendWelcomeEmail] exception", e);
    return { ok: false, error: String(e) };
  }
}