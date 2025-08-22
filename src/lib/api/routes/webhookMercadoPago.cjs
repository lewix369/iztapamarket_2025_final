// src/lib/api/routes/webhookMercadoPago.cjs
const express = require("express");
const router = express.Router();

/**
 * Webhook de Mercado Pago
 * - Responde 200 inmediatamente (evita reintentos de MP).
 * - Loguea query/headers/body para depurar.
 * - Si llega un pago, consulta el detalle a la API de MP (modo lectura).
 * - NO actualiza BD todavía (lo dejamos para producción).
 */
router.post("/", async (req, res) => {
  try {
    // 1) Responder rápido a MP
    res.sendStatus(200);

    // 2) Logs útiles para depurar
    console.log("🛎️  MP Webhook HIT");
    console.log("🔎 query:", req.query);
    console.log("🔎 headers.x-request-id:", req.headers["x-request-id"]);
    console.log("🔎 body:", JSON.stringify(req.body));

    // 3) Detectar tipo e id del evento (formato clásico de MP)
    const type = req.query.type || req.body?.type;
    const paymentId = req.body?.data?.id || req.body?.id;

    if (type === "payment" && paymentId) {
      // 4) Consultar el pago en MP (sólo lectura)
      if (!process.env.MP_ACCESS_TOKEN) {
        console.warn(
          "⚠️ MP_ACCESS_TOKEN no definido; no puedo consultar el pago."
        );
        return;
      }
      const url = `https://api.mercadopago.com/v1/payments/${paymentId}`;
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
      });
      const payment = await r.json();
      console.log("💳 Detalle del pago:", {
        id: payment.id,
        status: payment.status,
        status_detail: payment.status_detail,
        email: payment?.metadata?.email,
        plan: payment?.metadata?.plan,
        external_reference: payment?.external_reference,
      });

      // 🔒 Aquí NO actualizamos BD. Lo haremos en el deploy final.
      // Ejemplo futuro:
      // if (payment.status === "approved") {
      //   // actualizar plan del usuario/negocio en Supabase...
      // }
    }
  } catch (err) {
    console.error("❌ Error en webhook MP:", err);
    // ya respondimos 200 arriba; no hacer más.
  }
});

module.exports = router;
