// src/lib/CreatePreference.js
// Devuelve SIEMPRE un string URL (init_point) listo para redirigir.
// Acepta (plan, email). Soporta respuestas JSON { init_point } y también string.

export const createPreference = async (plan, email) => {
  try {
    if (
      !plan ||
      typeof plan !== "string" ||
      !email ||
      typeof email !== "string"
    ) {
      console.error("❌ Parámetros inválidos para crear preferencia:", {
        plan,
        email,
      });
      return null;
    }

    // Normaliza el plan a "pro" | "premium"
    const cleanPlanRaw = plan.toLowerCase().trim();
    const cleanPlan =
      cleanPlanRaw === "premium"
        ? "premium"
        : cleanPlanRaw === "pro" || cleanPlanRaw === "profesional"
        ? "pro"
        : cleanPlanRaw; // deja pasar "free" si algún día se usa, pero en pagos será "pro"/"premium"

    const payload = {
      plan: cleanPlan,
      email: email.trim(),
    };

    // Endpoints según entorno
    const ENDPOINT =
      (typeof import.meta !== "undefined" &&
        import.meta?.env?.VITE_CREATE_PREFERENCE_URL) ||
      (typeof process !== "undefined" &&
        process?.env?.VITE_CREATE_PREFERENCE_URL) ||
      (typeof window !== "undefined" &&
      window?.location?.hostname === "localhost"
        ? "http://localhost:3000/create_preference"
        : "/api/createPreference");

    const resp = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(
        `Servidor ${resp.status}: ${text || "Error al crear preferencia"}`
      );
    }

    const data = await resp.json().catch(() => ({}));

    // Prioriza init_point (producción). Si no, sandbox_init_point. Si el backend devuelve string, úsalo.
    let url =
      typeof data === "string"
        ? data
        : data?.init_point || data?.sandbox_init_point || "";

    if (!url || !/^https?:\/\//i.test(url)) {
      throw new Error("Respuesta sin init_point válido.");
    }

    // ⚠️ Opcional: Propagar email/plan en la URL de MP (solo para debugging/consistencia visual).
    // Esto NO afecta los back_urls (los define el backend).
    try {
      const u = new URL(url);
      if (!u.searchParams.get("email"))
        u.searchParams.set("email", email.trim());
      if (!u.searchParams.get("plan")) u.searchParams.set("plan", cleanPlan);
      url = u.toString();
    } catch {
      // Si falla URL(), no pasa nada — usamos la URL tal cual vino
    }

    console.log("🟢 URL de pago generada:", url);
    return url;
  } catch (err) {
    console.error("❌ Error en createPreference:", err);
    return null;
  }
};
