// src/lib/api/create_preference.mjs
import express from "express";
import mercadopago from "mercadopago";

console.log("🔔 create_preference VERSION=2025-09-08_02");

const router = express.Router();

/* ── Mercado Pago SDK ────────────────────────────────────────── */
if (!process.env.MP_ACCESS_TOKEN) {
  console.warn(
    "⚠️ MP_ACCESS_TOKEN no definido: no se podrá crear una preferencia."
  );
}
mercadopago.configure({ access_token: process.env.MP_ACCESS_TOKEN });

/* ── Helpers ─────────────────────────────────────────────────── */
function isValidEmail(s) {
  if (typeof s !== "string") return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(s.trim());
}

function normalizePlan(p) {
  const v = String(p || "premium")
    .trim()
    .toLowerCase();
  if (["premium", "pro", "basico", "básico", "basic", "free"].includes(v)) {
    if (v === "básico" || v === "basic") return "basico";
    return v;
  }
  return "premium";
}

/* ── Diagnóstico ─────────────────────────────────────────────── */
router.get("/__version", (_req, res) => {
  res.json({ version: "2025-09-08_02" });
});

/* ── Crear preferencia de pago ───────────────────────────────── */
router.post("/", async (req, res) => {
  try {
    const body = req.body || {};
    const plan = normalizePlan(body.plan || body.plan_type);
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const action = String(body.action || "")
      .trim()
      .toLowerCase();

    // Si el cliente envía explícitamente otra acción, ignórala
    if (action && action !== "create_preference") {
      return res.status(200).json({ ok: true, ignored_action: { action } });
    }

    if (!email || !isValidEmail(email)) {
      return res
        .status(400)
        .json({ ok: false, error: "Email inválido o faltante" });
    }

    // Construir external_reference para poder recuperar email/plan en el webhook
    const external_reference = `${email}|${plan}|web`;

    const back_urls = {
      success: process.env.REGISTRO_SUCCESS_URL,
      failure: process.env.REGISTRO_FAILURE_URL,
      pending: process.env.REGISTRO_PENDING_URL,
    };

    const notification_url = process.env.MP_WEBHOOK_URL;

    // Items simples para sandbox; el precio puede variar por plan si lo necesitas
    const unit_price_by_plan = { premium: 99, pro: 59, basico: 29, free: 0 };
    const unit_price =
      unit_price_by_plan[plan] ?? unit_price_by_plan["premium"];

    const preference = {
      items: [
        {
          title: `Suscripción ${plan}`,
          quantity: 1,
          unit_price,
          currency_id: "MXN",
        },
      ],
      metadata: { email, plan, external_reference },
      external_reference,
      back_urls,
      notification_url,
      auto_return: "approved",
    };

    if (!mercadopago.preferences || !mercadopago.preferences.create) {
      console.error("❌ SDK de MP sin preferences.create");
      return res.status(500).json({ ok: false, error: "mp_sdk_unavailable" });
    }

    const resp = await mercadopago.preferences.create(preference);
    const pref = resp?.body || resp;

    return res.status(200).json({
      ok: true,
      preference_id: pref?.id || pref?.response?.id || null,
      init_point:
        pref?.init_point ||
        pref?.sandbox_init_point ||
        pref?.response?.init_point ||
        null,
      site_id: pref?.site_id || null,
      external_reference,
    });
  } catch (err) {
    console.error("❌ create_preference error:", err);
    return res
      .status(500)
      .json({ ok: false, error: err?.message || String(err) });
  }
});

export default router;
