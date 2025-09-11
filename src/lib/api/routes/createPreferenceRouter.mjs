// src/lib/api/routes/createPreferenceRouter.mjs
import express from "express";
import mercadopago from "mercadopago";

console.log("🔖 createPreferenceRouter VERSION=2025-08-28_04");

const router = express.Router();

// Configura SDK con tu token sandbox
mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN,
});

// ──────────────────────────────────────────────────────────────────
// Diagnóstico: traza toda request que entra al router
router.use((req, _res, next) => {
  console.log("↪️  createPreferenceRouter HIT:", req.method, req.originalUrl);
  next();
});

// Diagnóstico: ping simple del router
router.get("/ping", (_req, res) => {
  res.json({ ok: true, where: "create_preference router" });
});

// Diagnóstico: versión + URLs que el proceso está leyendo
router.get("/__version", (_req, res) => {
  res.json({
    version: "2025-08-28_04",
    success: process.env.REGISTRO_SUCCESS_URL,
    failure: process.env.REGISTRO_FAILURE_URL,
    pending: process.env.REGISTRO_PENDING_URL,
    notification_url: process.env.MP_WEBHOOK_URL,
  });
});
// ──────────────────────────────────────────────────────────────────

router.post("/", async (req, res) => {
  try {
    const { plan, email, title, unit_price, quantity } = req.body || {};

    // Validaciones mínimas
    if (!email || !plan) {
      return res.status(400).json({ error: "Faltan plan o email" });
    }

    const normalizedPlan = ["pro", "premium", "free"].includes(
      String(plan).trim().toLowerCase()
    )
      ? String(plan).trim().toLowerCase()
      : "premium";

    // Precio: permite override por body.unit_price para pruebas, o usa MP_TEST_PRICE/env
    const resolvedPrice =
      typeof unit_price === "number" && unit_price > 0
        ? unit_price
        : normalizedPlan === "pro"
        ? 99
        : process.env.MP_TEST_PRICE
        ? parseFloat(process.env.MP_TEST_PRICE)
        : 199;

    const resolvedQuantity =
      typeof quantity === "number" && quantity > 0 ? quantity : 1;

    const itemTitle = title || `Suscripción ${normalizedPlan}`;

    // Marca para distinguir redirecciones (ayuda a detectar prefs viejas)
    const tag = Date.now().toString();

    // En sandbox, el payer DEBE ser un comprador de prueba (buyer) válido de MP
    const buyerEmail =
      String(process.env.MP_ENV || "").toLowerCase() === "sandbox" &&
      process.env.MP_TEST_BUYER
        ? process.env.MP_TEST_BUYER
        : email;
    const sandboxBuyerOverridden = buyerEmail !== email;

    const preference = {
      items: [
        {
          title: itemTitle,
          quantity: resolvedQuantity,
          unit_price: resolvedPrice,
          currency_id: "MXN",
        },
      ],
      // El webhook toma metadata como fuente de verdad
      // En sandbox usamos el test buyer; en producción usamos el email real
      payer: { email: buyerEmail },

      // Back URLs desde .env; agregamos ?tag= para distinguir prefs
      back_urls: {
        success: `${process.env.REGISTRO_SUCCESS_URL}${
          process.env.REGISTRO_SUCCESS_URL?.includes("?") ? "&" : "?"
        }tag=${tag}`,
        failure: `${process.env.REGISTRO_FAILURE_URL}${
          process.env.REGISTRO_FAILURE_URL?.includes("?") ? "&" : "?"
        }tag=${tag}`,
        pending: `${process.env.REGISTRO_PENDING_URL}${
          process.env.REGISTRO_PENDING_URL?.includes("?") ? "&" : "?"
        }tag=${tag}`,
      },
      auto_return: "approved",

      // Webhook público actual
      notification_url: process.env.MP_WEBHOOK_URL,

      // 👇 Imprescindible para que tu webhook identifique y actualice en Supabase
      metadata: { email, plan: normalizedPlan },
    };

    // Log previo (confirma que el proceso está leyendo el .env correcto)
    console.log("🧭 MP preference about to send:", {
      back_urls: preference.back_urls,
      notification_url: preference.notification_url,
      metadata: preference.metadata,
      payer: preference.payer,
      sandboxBuyerOverridden,
      original_email: email,
      item_title: preference.items?.[0]?.title,
      price: preference.items?.[0]?.unit_price,
      quantity: preference.items?.[0]?.quantity,
    });

    // Crear preferencia
    const { body } = await mercadopago.preferences.create(preference);

    console.log("📦 MP preference created:", {
      id: body.id,
      sandbox_init_point: body.sandbox_init_point,
      init_point: body.init_point,
    });

    // Confirmar con el MISMO SDK lo que quedó guardado
    try {
      const getResp = await mercadopago.preferences.get({ id: body.id });
      console.log("🔍 Pref confirmada en MP:", {
        id: getResp.body.id,
        back_urls: getResp.body.back_urls,
        notification_url: getResp.body.notification_url,
        metadata: getResp.body.metadata,
      });
    } catch (e) {
      console.log(
        "⚠️ No pude leer la preferencia con el SDK:",
        e?.message || e
      );
    }

    // Respuesta al cliente
    return res.json({
      id: body.id,
      init_point: body.init_point,
      sandbox_init_point: body.sandbox_init_point,
      tag,
    });
  } catch (err) {
    console.error("❌ create_preference failed:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
