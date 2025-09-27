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
    const cleanPlanRaw = plan.toLowerCase().trim();
    const cleanPlan =
      cleanPlanRaw === "premium"
        ? "premium"
        : cleanPlanRaw === "pro" || cleanPlanRaw === "profesional"
        ? "pro"
        : cleanPlanRaw; // deja pasar "free" si algún día se usa

    // Precios (ajusta si cambian)
    const PRICE_BY_PLAN = { pro: 300, premium: 500 };
    const price = PRICE_BY_PLAN[cleanPlan];
    if (!price) {
      throw new Error(`Plan inválido o sin precio configurado: ${cleanPlan}`);
    }

    // Endpoint según entorno (usa override por env si existe)
    const ENDPOINT =
      (typeof import.meta !== "undefined" &&
        import.meta?.env?.VITE_CREATE_PREFERENCE_URL) ||
      (typeof process !== "undefined" &&
        process?.env?.VITE_CREATE_PREFERENCE_URL) ||
      (typeof window !== "undefined" &&
      window?.location?.hostname === "localhost"
        ? "http://localhost:3000/api/create_preference"
        : "/api/create_preference"); // <-- CORRECTO

    const payload = {
      title: `Plan ${cleanPlan === "pro" ? "Pro" : "Premium"}`,
      price,
      payer_email: email.trim(),
      plan: cleanPlan,
      // opcional, ayuda al webhook:
      external_reference: `${email.trim()}|${cleanPlan}|web`,
      // opcional: si quisieras forzar sandbox/producción desde el server, usa binary_mode en el backend
    };

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
      throw new Error(
        `Servidor ${resp.status}: ${text || "Error al crear preferencia"}`
      );
    }

    const data = await resp.json().catch(() => ({}));

    // Prioriza init_point (producción) y si no, sandbox_init_point (dev)
    let url =
      typeof data === "string"
        ? data
        : data?.init_point || data?.sandbox_init_point || "";

    if (!url || !/^https?:\/\//i.test(url)) {
      throw new Error("Respuesta sin init_point válido.");
    }

    // Opcional: agrega email/plan en query para tracking visual
    try {
      const u = new URL(url);
      if (!u.searchParams.get("email"))
        u.searchParams.set("email", email.trim());
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
