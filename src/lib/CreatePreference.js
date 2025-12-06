// src/lib/CreatePreference.js
// Devuelve SIEMPRE un string URL (init_point/sandbox_init_point) listo para redirigir.

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

    // Normaliza plan
    const cleanPlanRaw = String(plan).toLowerCase().trim();
    const cleanPlan =
      cleanPlanRaw === "premium"
        ? "premium"
        : cleanPlanRaw === "pro" || cleanPlanRaw === "profesional"
        ? "pro"
        : cleanPlanRaw; // deja pasar "free" si algún día se usa

    // Precios (ajusta si cambian)
    const PRICE_BY_PLAN = { pro: 50, premium: 50 };
    const price = PRICE_BY_PLAN[cleanPlan];
    if (!price) {
      throw new Error(`Plan inválido o sin precio configurado: ${cleanPlan}`);
    }

    // === Selección de ENDPOINT ===
    // Prioridades:
    // 1) VITE_CREATE_PREFERENCE_URL (si lo definiste directo, por ejemplo http://localhost:3001/api/create_preference_v2)
    // 2) VITE_FUNCTIONS_URL + "/api/create_preference_v2" (cuando lo definas como base de funciones)
    // 3) Si estamos en el dominio productivo, usamos ruta relativa "/api/create_preference_v2" (Vercel)
    // 4) Fallback local al backend Express en 3001 (ruta v2)
    const FN_BASE =
      (typeof import.meta !== "undefined" && import.meta?.env?.VITE_FUNCTIONS_URL) ||
      (typeof process !== "undefined" && process?.env?.VITE_FUNCTIONS_URL) ||
      "";

    const CFG_ENDPOINT =
      (typeof import.meta !== "undefined" && import.meta?.env?.VITE_CREATE_PREFERENCE_URL) ||
      (typeof process !== "undefined" && process?.env?.VITE_CREATE_PREFERENCE_URL) ||
      "";

    const onBrowser = typeof window !== "undefined" && typeof window.location !== "undefined";
    const origin = onBrowser ? window.location.origin : "";

    const ENDPOINT = (
      CFG_ENDPOINT
        ? CFG_ENDPOINT.replace(/\/+$/, "")
        : FN_BASE
        ? `${FN_BASE.replace(/\/+$/, "")}/api/create_preference_v2`
        : onBrowser && origin.includes("iztapamarket.com")
        ? "/api/create_preference_v2" // relativo para Vercel en prod
        : "http://localhost:3001/api/create_preference_v2" // dev local
    );

    console.log("🔧 [CreatePreference] ENDPOINT =", ENDPOINT);

    const payload = {
      title: `Plan ${cleanPlan === "pro" ? "Pro" : "Premium"}`,
      price,
      payer_email: String(email).trim(),
      plan: cleanPlan,
      // opcional, ayuda al webhook:
      external_reference: `${String(email).trim()}|${cleanPlan}|web`,
    };

    console.log("📡 Creando preferencia en:", ENDPOINT, "Payload:", payload);

    const resp = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`Servidor ${resp.status}: ${text || "Error al crear preferencia"}`);
    }

    // Algunas veces el server podría responder texto plano (init_point). Intentamos primero JSON.
    let data = null;
    try {
      data = await resp.json();
    } catch (_) {
      // si no es JSON, caemos a texto plano
      data = await resp.text();
    }

    // Siempre preferimos init_point; sandbox_init_point solo como respaldo
    let url;
    if (typeof data === "string") {
      url = data;
    } else {
      url = data?.init_point || data?.sandbox_init_point || "";
    }

    if (!url || !/^https?:\/\//i.test(url)) {
      throw new Error("Respuesta sin init_point válido.");
    }

    // Opcional: agrega email/plan en query para tracking visual
    try {
      const u = new URL(url);
      if (!u.searchParams.get("email")) u.searchParams.set("email", String(email).trim());
      if (!u.searchParams.get("plan")) u.searchParams.set("plan", cleanPlan);
      url = u.toString();
    } catch {
      /* ignore */
    }

    console.log("🟢 URL de pago generada:", url);
    return url;
  } catch (err) {
    console.error("❌ Error en createPreference:", err);
    return null;
  }
};
