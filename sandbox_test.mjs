// sandbox_test.mjs
import express from "express";
import mercadopago from "mercadopago";
import "dotenv/config";

const app = express();
app.use(express.json());

// Configura el SDK con tu token de prueba MX
mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN, // 👈 debe ser el de sandbox (APP_USR...)
});

// Healthcheck
app.get("/health", (_req, res) => res.json({ ok: true }));

// Crear preferencia mínima
app.post("/create_preference", async (req, res) => {
  try {
    const preference = {
      items: [
        {
          title: "Plan Premium Test",
          quantity: 1,
          unit_price: 499, // Monto de prueba
          currency_id: "MXN",
        },
      ],
      payer: {
        email: "TESTUSER16368732@testuser.com", // 👈 comprador de prueba
      },
      back_urls: {
        success: "http://localhost:5173/pago/success",
        failure: "http://localhost:5173/pago/failure",
        pending: "http://localhost:5173/pago/pending",
      },
      auto_return: "approved",
    };

    const { body } = await mercadopago.preferences.create(preference);

    return res.json({
      id: body.id,
      init_point: body.init_point,
      sandbox_init_point: body.sandbox_init_point,
    });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`🟢 Sandbox test server en http://localhost:${PORT}`);
});