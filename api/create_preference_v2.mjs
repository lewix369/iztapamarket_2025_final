// api/create_preference_v2.mjs
// Versión FINAL: Checkout Pro + auto_return, back_urls garantizadas y webhook correcto.

export default async function createPreferenceV2(accessToken, body, diag, res) {
  try {
    console.log("💳 [v2] Create Preference V2 (FINAL)");

    if (!accessToken) {
      console.error("[v2] ERROR: Falta ACCESS TOKEN");
      return res.status(500).json({
        ok: false,
        error: "no_access_token",
        message: "Access token de Mercado Pago no configurado",
      });
    }

    // ----------------------------
    // Normalización de datos
    // ----------------------------
    const rawPlan = String(body.plan || body.plan_type || "").toLowerCase().trim();

    const plan =
      rawPlan === "premium"
        ? "premium"
        : rawPlan === "pro" || rawPlan === "profesional"
        ? "pro"
        : null;

    const email = String(body.email || body.payer_email || body.buyer_email || "")
      .trim()
      .toLowerCase();

    if (!plan) {
      return res.status(400).json({
        ok: false,
        error: "invalid_plan",
        message: `Plan inválido: ${rawPlan}`,
      });
    }

    if (!email) {
      return res.status(400).json({
        ok: false,
        error: "invalid_email",
        message: "Email del pagador es obligatorio",
      });
    }

    const PRICE_BY_PLAN = { pro: 300, premium: 500 };
    const unitPrice = PRICE_BY_PLAN[plan];

    const title = `Plan ${plan === "pro" ? "Pro" : "Premium"} - IztapaMarket`;

    const externalReference = `${email}|${plan}|web`;

    // ----------------------------
    // Webhook
    // ----------------------------

    const notificationUrl =
      process.env.MP_WEBHOOK_URL ||
      diag?.mp?.webhook ||
      "http://localhost:3001/webhook_mp";

    // ----------------------------
    // back_urls + auto_return
    // ----------------------------
    const baseUrl = process.env.PUBLIC_BASE_URL || "http://localhost:3001";
    const isHttps = baseUrl.startsWith("https://"); // 👈 SOLO aquí decidimos auto_return

    const backUrls = {
      success: `${baseUrl}/pago/success`,
      failure: `${baseUrl}/pago/failure`,
      pending: `${baseUrl}/pago/pending`,
    };

    console.log("🔗 [v2] back_urls:", backUrls, "isHttps:", isHttps);

    // ----------------------------
    // Payload FINAL a MP
    // ----------------------------
    const preferencePayload = {
      items: [
        {
          title,
          quantity: 1,
          unit_price: unitPrice,
          currency_id: "MXN",
        },
      ],

      payer: { email },

      external_reference: externalReference,
      notification_url: notificationUrl,

      back_urls: backUrls,
    };

    // ⚠️ IMPORTANTE:
    // En LOCAL (http://localhost:3001) NO mandamos auto_return porque MP se queja.
    // En NGROK / PRODUCCIÓN (https://...) SÍ lo mandamos.
    if (isHttps) {
      preferencePayload.auto_return = "approved"; // << CLAVE PARA SALIR DEL CHECKOUT
    }

    console.log("📦 [v2] Payload enviado a MP:", preferencePayload);

    // ----------------------------
    // Llamada a Mercado Pago
    // ----------------------------
    const mpResp = await fetch(
      "https://api.mercadopago.com/checkout/preferences",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(preferencePayload),
      }
    );

    const data = await mpResp.json().catch(() => null);

    if (!mpResp.ok) {
      console.error("❌ [v2] ERROR MP:", data);
      return res.status(mpResp.status).json({
        ok: false,
        error: "mp_error",
        details: data,
      });
    }

    console.log("✅ [v2] Preferencia creada:", {
      id: data?.id,
      init_point: data?.init_point,
    });

    return res.status(201).json({
      ok: true,
      id: data.id,
      init_point: data.init_point,
      sandbox_init_point: data.sandbox_init_point,
    });
  } catch (err) {
    console.error("🔥 [v2] EXCEPTION:", err);
    return res.status(500).json({
      ok: false,
      error: "exception",
      message: err.message,
    });
  }
}