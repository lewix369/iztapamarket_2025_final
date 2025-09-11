// src/lib/api/routes/createPreferenceRouter.mjs
import express from "express";
import mercadopago from "mercadopago";

const router = express.Router();

// Configura SDK con tu token sandbox
mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN,
});

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

    // Marca opcional para identificar redirecciones en pruebas
    const tag = Date.now().toString();

    // Construcción de preferencia
    const preference = {
      items: [
        {
          title: itemTitle,
          quantity: resolvedQuantity,
          unit_price: resolvedPrice,
          currency_id: "MXN",
        },
      ],
      payer: { email }, // aunque el webhook toma metadata como fuente de verdad

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
      notification_url: process.env.MP_WEBHOOK_URL,

      // 👇 Imprescindible para que tu webhook identifique y actualice en Supabase
      metadata: { email, plan: normalizedPlan },
    };

    // Log previo
    console.log("🧭 MP preference about to send:", {
      back_urls: preference.back_urls,
      notification_url: preference.notification_url,
      metadata: preference.metadata,
      payer: preference.payer,
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
      console.log("⚠️ No pude leer la preferencia con el SDK:", e?.message || e);
    }

    // Respuesta al cliente
    return res.json({
      id: body.id,
      init_point: body.init_point,
      sandbox_init_point: body.sandbox_init_point,
      tag, // útil para confirmar que el redirect viene de esta preferencia
    });
  } catch (err) {
    console.error("❌ create_preference failed:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;