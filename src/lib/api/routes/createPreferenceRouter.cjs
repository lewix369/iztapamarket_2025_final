const express = require("express");
const mercadopago = require("mercadopago");
require("dotenv").config();
if (!process.env.MP_ACCESS_TOKEN) {
  console.error("❌ MP_ACCESS_TOKEN NO DEFINIDO. Verifica el archivo .env");
}

const router = express.Router();
console.log("🛠️ createPreferenceRouter cargado correctamente");

router.get(["/", ""], (req, res) => {
  res.status(200).json({ message: "Ruta GET /create_preference activa" });
});

mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN,
});
console.log("ACCESS TOKEN:", process.env.MP_ACCESS_TOKEN);
if (!process.env.MP_ACCESS_TOKEN) {
  console.error("❌ MP_ACCESS_TOKEN NO DEFINIDO. Verifica el archivo .env");
}

// Middleware para debug de solicitudes entrantes
router.use((req, res, next) => {
  console.log(
    "📡 Solicitud recibida en createPreferenceRouter:",
    req.method,
    req.url
  );
  next();
});

router.post("/", async (req, res) => {
  const { plan, email } = req.body;
  const planTitle =
    typeof plan === "string" ? plan.trim().toLowerCase() : undefined;
  console.log("RAW plan recibido:", plan);
  console.log("planTitle procesado:", planTitle, typeof planTitle);
  console.log("📨 Datos recibidos en POST /create_preference:", {
    plan,
    email,
  });
  if (!email || typeof email !== "string") {
    console.warn("⚠️ Email no recibido o formato inválido:", email);
    return res.status(400).json({ error: "Email faltante o inválido." });
  }
  if (!plan || typeof plan !== "string") {
    console.warn("⚠️ Plan no recibido o formato inválido:", plan);
    return res.status(400).json({ error: "Plan faltante o inválido." });
  }
  console.log("🧾 Plan recibido:", planTitle);
  if (planTitle === undefined) {
    console.warn("⚠️ planTitle quedó undefined. Payload recibido:", req.body);
  }

  const PLANES = {
    pro: {
      title: "Plan Pro IztapaMarket",
      unit_price: 300,
      quantity: 1,
    },
    premium: {
      title: "Plan Premium IztapaMarket",
      unit_price: 500,
      quantity: 1,
    },
  };

  const selectedPlan = PLANES[planTitle];

  if (!selectedPlan) {
    return res.status(400).json({ error: "Plan no válido." });
  }

  if (
    !selectedPlan.title ||
    typeof selectedPlan.unit_price !== "number" ||
    typeof selectedPlan.quantity !== "number"
  ) {
    console.error("❌ Plan mal definido:", selectedPlan);
    return res.status(400).json({ error: "Plan incompleto o inválido." });
  }

  try {
    const { REGISTRO_SUCCESS_URL, REGISTRO_FAILURE_URL, REGISTRO_PENDING_URL } =
      process.env;

    console.log("🌐 URLs desde .env:", {
      REGISTRO_SUCCESS_URL,
      REGISTRO_FAILURE_URL,
      REGISTRO_PENDING_URL,
    });

    if (
      !REGISTRO_SUCCESS_URL ||
      !REGISTRO_FAILURE_URL ||
      !REGISTRO_PENDING_URL
    ) {
      console.error("❌ Alguna URL de retorno no está definida en .env:");
      console.error({
        REGISTRO_SUCCESS_URL,
        REGISTRO_FAILURE_URL,
        REGISTRO_PENDING_URL,
      });
      return res
        .status(500)
        .json({ error: "Faltan URLs de retorno en archivo .env" });
    }

    const preference = {
      items: [
        {
          title: selectedPlan.title,
          unit_price: selectedPlan.unit_price,
          quantity: selectedPlan.quantity,
          currency_id: "MXN",
        },
      ],
      payer: {
        email: email,
      },
      back_urls: {
        success: REGISTRO_SUCCESS_URL,
        failure: REGISTRO_FAILURE_URL,
        pending: REGISTRO_PENDING_URL,
      },
      auto_return: "approved",
      notification_url: "https://webhook.site/test-iztapamarket",
      metadata: {
        email,
        plan: planTitle,
      },
    };

    console.log("✅ URL success:", preference.back_urls.success);
    console.log("📦 Preferencia enviada a Mercado Pago:", preference);
    console.log("🎯 PREFERENCE FINAL:", JSON.stringify(preference, null, 2));
    // Validación robusta de back_urls antes de llamar a Mercado Pago
    if (
      !preference.back_urls ||
      typeof preference.back_urls.success !== "string" ||
      typeof preference.back_urls.failure !== "string" ||
      typeof preference.back_urls.pending !== "string"
    ) {
      console.error(
        "❌ back_urls incompletos o con valores no válidos:",
        preference.back_urls
      );
      return res.status(500).json({
        error: "URLs de retorno inválidas o no definidas como texto.",
        preference,
      });
    }
    console.log("⏳ Llamando a mercadopago.preferences.create...");
    try {
      const response = await mercadopago.preferences.create(preference);
      res.json({ init_point: response.body.init_point });
    } catch (mpError) {
      console.error("❌ Error específico en Mercado Pago:");
      console.error("Status:", mpError.response?.status);
      console.error("Mensaje:", mpError.response?.data?.message);
      console.error("Causa:", mpError.response?.data?.cause);
      console.error(
        "Error completo:",
        mpError.response?.data || mpError.message
      );
      if (!mpError.response) {
        console.error(
          "🧨 Error sin respuesta de Mercado Pago:",
          mpError.message
        );
      }
      return res.status(500).json({
        error: "Fallo en Mercado Pago",
        status: mpError.response?.status || "N/A",
        message: mpError.response?.data?.message || mpError.message,
        cause: mpError.response?.data?.cause || [],
        details: mpError.response?.data || mpError.message,
        request_id: mpError.response?.headers?.["x-request-id"] || "N/A",
      });
    }
  } catch (error) {
    console.error("❌ Error al crear preferencia:");
    if (error.response) {
      console.error("📡 Detalles del error:", {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
      });
    } else {
      console.error("🧨 Error general:", error.message);
    }
    res.status(500).json({
      error: "Error al crear preferencia.",
      details: error.message,
      stack: error.stack,
      response: error.response?.data || null,
      body: req.body,
      tokenStatus: process.env.MP_ACCESS_TOKEN
        ? "Token definido"
        : "Token NO definido",
    });
  }
});

router.get("/test", (req, res) => {
  res.json({
    message: "🧪 Ruta de prueba activa desde createPreferenceRouter",
  });
});

router.post("/test", (req, res) => {
  res.status(200).json({
    message: "📨 POST a /create_preference/test recibido correctamente",
    body: req.body,
  });
});

router.post("/test_direct", (req, res) => {
  res.status(200).json({
    message: "📨 POST directo a /create_preference/test_direct activo",
    body: req.body,
  });
});

module.exports = router;
