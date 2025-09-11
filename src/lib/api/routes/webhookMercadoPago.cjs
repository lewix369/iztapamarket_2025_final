// routes/webhook_mp.cjs (unificado y robusto)
import express from "express";
import fetch from "node-fetch";
import { supabaseAdmin } from "../lib/supabaseAdmin.cjs";

const router = express.Router();
const DEBUG = !!process.env.DEBUG_WEBHOOK;

/* ── Seguridad opcional via token ───────────────────────────── */
router.use((req, res, next) => {
  const required = process.env.MP_WEBHOOK_SECRET || "";
  if (!required) return next();
  const tok = req.query?.token || req.headers["x-webhook-token"];
  if (tok !== required)
    return res.status(401).json({ ok: false, error: "unauthorized" });
  next();
});

/* ── Helpers ────────────────────────────────────────────────── */
const isEmail = (s) =>
  typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
function normalizeUUID(raw) {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  const re =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return re.test(v) ? v : null;
}
function parseExternalRefString(refStr) {
  // formatos: email|plan|tag  ó  email|plan|tag|negocio_uuid
  if (typeof refStr !== "string" || !refStr.includes("|")) {
    return { email: null, plan: null, tag: null, negocio_id: null };
  }
  const [rawEmail, rawPlan, rawTag, rawNegocio] = refStr.split("|");
  const email = isEmail(rawEmail) ? rawEmail.trim().toLowerCase() : null;
  const p = String(rawPlan || "").toLowerCase();
  const valid = ["premium", "pro", "free", "basico", "básico", "basic"];
  let plan = valid.includes(p) ? p : null;
  if (plan === "básico" || plan === "basic") plan = "basico";
  const tag = rawTag ? String(rawTag).trim() : null;
  const negocio_id = normalizeUUID(rawNegocio);
  return { email, plan, tag, negocio_id };
}

/* ── DB helpers ─────────────────────────────────────────────── */
async function updateProfilePlan(email, plan) {
  const now = new Date().toISOString();
  const payload = {
    email: email.toLowerCase(),
    plan_type: String(plan || "premium").toLowerCase(),
    updated_at: now,
  };
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .upsert(payload, { onConflict: "email" })
    .select("email, plan_type, updated_at")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

// busca negocio por owner_email (sin requerir UNIQUE)
async function upsertBusinessByEmail({ email, plan, external_reference }) {
  const owner_email = String(email || "").toLowerCase();
  const plan_type = String(plan || "premium").toLowerCase();
  const now = new Date().toISOString();
  if (!owner_email) return { ok: false, error: "owner_email faltante" };

  const { data: existing, error: qErr } = await supabaseAdmin
    .from("negocios")
    .select("id")
    .eq("owner_email", owner_email)
    .limit(1)
    .maybeSingle();
  if (qErr) return { ok: false, error: qErr.message };

  if (existing?.id) {
    const { data, error } = await supabaseAdmin
      .from("negocios")
      .update({
        plan_type,
        external_reference: external_reference || null,
        status: "active",
        updated_at: now,
      })
      .eq("id", existing.id)
      .select(
        "id, owner_email, plan_type, external_reference, status, updated_at"
      )
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, mode: "update", data };
  }

  const { data, error } = await supabaseAdmin
    .from("negocios")
    .insert({
      owner_email,
      plan_type,
      external_reference: external_reference || null,
      status: "active",
      created_at: now,
      updated_at: now,
    })
    .select(
      "id, owner_email, plan_type, external_reference, status, created_at, updated_at"
    )
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, mode: "insert", data };
}

async function updateBusinessById({
  negocio_id,
  plan,
  external_reference,
  owner_email,
}) {
  const id = normalizeUUID(negocio_id);
  if (!id) return { ok: false, error: "negocio_id inválido" };
  const now = new Date().toISOString();
  const payload = {
    plan_type: String(plan || "premium").toLowerCase(),
    external_reference: external_reference || null,
    status: "active",
    updated_at: now,
  };
  if (owner_email) payload.owner_email = String(owner_email).toLowerCase();

  const { data, error } = await supabaseAdmin
    .from("negocios")
    .update(payload)
    .eq("id", id)
    .select(
      "id, owner_email, plan_type, external_reference, status, updated_at"
    )
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, mode: "update_by_id", data };
}

async function handleApproved({ email, plan, external_reference, negocio_id }) {
  const owner_email = String(email || "").toLowerCase();
  const tasks = [updateProfilePlan(owner_email, plan)];
  if (normalizeUUID(negocio_id)) {
    tasks.push(
      updateBusinessById({ negocio_id, plan, external_reference, owner_email })
    );
  } else {
    tasks.push(
      upsertBusinessByEmail({ email: owner_email, plan, external_reference })
    );
  }
  const [uProfile, uBusiness] = await Promise.all(tasks);
  return { uProfile, uBusiness };
}

/* ── Pings de prueba ────────────────────────────────────────── */
router.all("/__version", (_req, res) =>
  res.json({ version: "webhook_mp.cjs 2025-09-07" })
);

router.all("/", express.json(), async (req, res, next) => {
  if (req.query?.test) {
    const { data } = req.body || {};
    if (data?.status && data?.metadata?.email) {
      const status = String(data.status).toLowerCase();
      const email = data.metadata.email;
      const plan = (data.metadata.plan || "premium").toLowerCase();
      const external_reference =
        data.external_reference || data.metadata?.external_reference || null;
      const parsed = parseExternalRefString(external_reference || "");
      const negocio_id =
        normalizeUUID(data?.metadata?.negocio_id) || parsed.negocio_id || null;
      if (status === "approved") {
        const out = await handleApproved({
          email,
          plan,
          external_reference,
          negocio_id,
        });
        return res
          .status(200)
          .json({ ok: true, via: "test_inline_metadata", ...out });
      }
      return res
        .status(200)
        .json({ ok: true, via: "test_ping", ignored_status: status });
    }
    return res.status(200).send("OK_TEST");
  }
  next();
});

/* ── Webhook principal ──────────────────────────────────────── */
router.post("/", express.json(), async (req, res) => {
  try {
    const { type, action, data } = req.body || {};

    // 1) Inline metadata directa
    if (data?.status && data?.metadata?.email) {
      const status = String(data.status || "").toLowerCase();
      const email = data.metadata.email;
      const plan = (data.metadata.plan || "premium").toLowerCase();
      const external_reference =
        data.external_reference || data.metadata?.external_reference || null;
      const parsed = parseExternalRefString(external_reference || "");
      const negocio_id =
        normalizeUUID(data?.metadata?.negocio_id) || parsed.negocio_id || null;
      if (status === "approved") {
        const out = await handleApproved({
          email,
          plan,
          external_reference,
          negocio_id,
        });
        return res
          .status(200)
          .json({ ok: true, via: "inline_metadata", ...out });
      }
      return res.status(200).json({ ok: true, ignored_status: status });
    }

    // 2) Notificación con payment id o merchant_order id (ambos formatos)
    const looksPayment =
      String(type || "").includes("payment") ||
      String(action || "").includes("payment") ||
      req.query?.topic === "payment";

    const looksMO =
      String(type || "").includes("merchant_order") ||
      String(action || "").includes("merchant_order") ||
      req.query?.topic === "merchant_order";

    // intenta obtener ids desde diferentes estilos de payload
    const paymentId =
      data?.id || data?.payment_id || req.body?.id || req.query?.id || null;

    const merchantOrderId =
      data?.merchant_order_id ||
      (looksMO ? data?.id || req.body?.id || req.query?.id || null : null);

    // helper local para extraer email/plan y procesar
    const processPaymentObject = async (payment) => {
      if (!payment) return { ok: false, reason: "empty_payment" };

      const status = String(payment.status || "").toLowerCase();
      const external_reference = payment.external_reference || null;
      const parsed = parseExternalRefString(external_reference || "");
      const email =
        parsed.email ||
        payment?.metadata?.email ||
        payment?.payer?.email ||
        null;
      const plan = (
        parsed.plan ||
        payment?.metadata?.plan ||
        "premium"
      ).toLowerCase();
      const negocio_id =
        parsed.negocio_id ||
        normalizeUUID(payment?.metadata?.negocio_id) ||
        null;

      if (DEBUG)
        console.log("🔎 MP resolved payment", {
          paymentId: payment?.id,
          status,
          email,
          plan,
          external_reference,
        });

      if (status === "approved" && email) {
        const out = await handleApproved({
          email,
          plan,
          external_reference,
          negocio_id,
        });
        return { ok: true, via: "payment_lookup", ...out };
      }
      return { ok: true, ignored: { status, haveEmail: !!email } };
    };

    // 2a) Si nos notifican un pago directo
    if (looksPayment && paymentId) {
      const url = `https://api.mercadopago.com/v1/payments/${paymentId}`;
      let payment = null;
      try {
        const mpResp = await fetch(url, {
          headers: {
            Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
            Accept: "application/json",
          },
        });
        if (mpResp.ok) payment = await mpResp.json();
      } catch (e) {
        console.error("❌ Error consultando MP payment:", e?.message || e);
      }

      if (!payment) {
        return res
          .status(202)
          .json({ ok: false, reason: "payment_not_fetched" });
      }

      const result = await processPaymentObject(payment);
      return res.status(200).json(result);
    }

    // 2b) Formato IPN/merchant_order: obtener MO, luego su primer pago (si existe)
    if (looksMO && (merchantOrderId || req.query?.resource)) {
      let moId = merchantOrderId;

      // algunos envían `resource=https://api.mercadopago.com/merchant_orders/{id}`
      if (!moId && req.query?.resource) {
        const m = String(req.query.resource).match(/merchant_orders\/(\d+)/);
        if (m) moId = m[1];
      }

      if (moId) {
        try {
          const moResp = await fetch(
            `https://api.mercadopago.com/merchant_orders/${moId}`,
            {
              headers: {
                Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
                Accept: "application/json",
              },
            }
          );
          if (moResp.ok) {
            const mo = await moResp.json();
            const firstPayment = Array.isArray(mo?.payments)
              ? mo.payments.find((p) => p.id)
              : null;

            if (!firstPayment?.id) {
              if (DEBUG) console.log("ℹ️ merchant_order sin payments", moId);
              return res
                .status(200)
                .json({ ok: true, via: "merchant_order", payments: [] });
            }

            // traer el pago real y procesar
            const pResp = await fetch(
              `https://api.mercadopago.com/v1/payments/${firstPayment.id}`,
              {
                headers: {
                  Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
                  Accept: "application/json",
                },
              }
            );
            if (pResp.ok) {
              const payment = await pResp.json();
              const result = await processPaymentObject(payment);
              result.via = "merchant_order_lookup";
              return res.status(200).json(result);
            }

            return res
              .status(202)
              .json({
                ok: false,
                reason: "payment_from_mo_not_fetched",
                moId,
                payment_id: firstPayment.id,
              });
          }
        } catch (e) {
          console.error(
            "❌ Error consultando merchant_order:",
            e?.message || e
          );
        }
      }

      // si no logramos nada, confirmar recepción para evitar reintentos eternos
      return res.status(200).json({ ok: true, via: "merchant_order_ignore" });
    }

    return res.status(200).json({ ok: true, ignored_action: { type, action } });
  } catch (e) {
    console.error("❌ Webhook exception:", e);
    return res.status(200).json({ ok: false, error: e?.message || String(e) });
  }
});

export default router;
