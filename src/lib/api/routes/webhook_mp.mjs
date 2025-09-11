// src/lib/api/routes/webhook_mp.mjs
import express from "express";
import mercadopago from "mercadopago";
import { createClient } from "@supabase/supabase-js";

console.log("🔔 webhook_mp VERSION=2025-09-08_01");

const router = express.Router();

/* ── Seguridad opcional: shared secret ───────────────────────── */
router.use((req, res, next) => {
  const required = process.env.MP_WEBHOOK_SECRET || "";
  if (!required) return next(); // desactivado si no se define
  const tok = req.query?.token || req.headers["x-webhook-token"];
  if (tok !== required)
    return res.status(401).json({ ok: false, error: "unauthorized" });
  next();
});

/* ── Mercado Pago SDK ────────────────────────────────────────── */
if (!process.env.MP_ACCESS_TOKEN) {
  console.warn(
    "⚠️ MP_ACCESS_TOKEN no definido: el webhook aceptará (200) pero no podrá consultar pagos vía SDK; se intentará fallback HTTP."
  );
} else {
  try {
    mercadopago.configure({ access_token: process.env.MP_ACCESS_TOKEN });
  } catch (e) {
    console.error("❌ Error configurando Mercado Pago SDK:", e?.message || e);
  }
}

/* ── Supabase (Service Role – SOLO backend) ──────────────────── */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

/* ── Helpers de base de datos ────────────────────────────────── */
async function updatePlanByEmail(email, plan) {
  if (!email || !plan) return { ok: false, error: "email/plan faltan" };
  const payload = {
    email: String(email).toLowerCase(),
    plan_type: String(plan).toLowerCase(),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "email" })
    .select("email, plan_type, updated_at")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

// Crea/actualiza negocio por email SIN requerir UNIQUE(owner_email)
async function upsertBusinessByEmail({ email, plan, external_reference }) {
  const owner_email = String(email || "").toLowerCase();
  const plan_type = String(plan || "premium").toLowerCase();
  const now = new Date().toISOString();
  if (!owner_email) return { ok: false, error: "owner_email faltante" };

  // 1) buscar si ya existe
  const { data: existing, error: qErr } = await supabase
    .from("negocios")
    .select("id, owner_email")
    .eq("owner_email", owner_email)
    .limit(1)
    .maybeSingle();
  if (qErr) return { ok: false, error: qErr.message };

  if (existing?.id) {
    // 2) actualizar
    const { data, error } = await supabase
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

  // 3) insertar
  const { data, error } = await supabase
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

// Acción común cuando el pago quedó aprobado
async function handleApproved({ email, plan, external_reference }) {
  const [uProfile, uBusiness] = await Promise.all([
    updatePlanByEmail(email, plan),
    upsertBusinessByEmail({ email, plan, external_reference }),
  ]);
  return { uProfile, uBusiness };
}

/* ── Otros helpers ───────────────────────────────────────────── */
function isPaymentEvent(type, action) {
  const t = String(type || "");
  const a = String(action || "");
  return t.includes("payment") || a.includes("payment");
}

// Extrae paymentId de body/query/resource
function extractPaymentId(reqBody = {}, reqQuery = {}) {
  const fromBody = reqBody?.data?.id || reqBody?.id || null;
  const fromQuery =
    reqQuery?.id || reqQuery?.["data.id"] || reqQuery?.["data.id[]"] || null;

  // Formato viejo: ?topic=payment&id=123
  if (reqQuery?.topic?.includes?.("payment") && fromQuery)
    return String(fromQuery);

  // Recurso como URL: { resource: "https://api.mercadopago.com/v1/payments/123" }
  const resource = reqBody?.resource || reqQuery?.resource || "";
  const m = String(resource).match(/\/v1\/payments\/(\d+)/);
  const fromResource = m ? m[1] : null;

  return String(fromBody || fromQuery || fromResource || "").trim() || null;
}

function extractExternalReference(body = {}, mpPayment = null) {
  return (
    mpPayment?.external_reference ||
    body?.data?.external_reference ||
    body?.external_reference ||
    null
  );
}

function isValidEmail(s) {
  if (typeof s !== "string") return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(s.trim());
}

function parseExternalRefString(refStr) {
  // expected format: email|plan|tag
  if (typeof refStr !== "string" || !refStr.includes("|")) {
    return { email: null, plan: null, tag: null };
  }
  const [rawEmail, rawPlan, rawTag] = refStr.split("|");
  const email = isValidEmail(rawEmail) ? rawEmail.trim().toLowerCase() : null;
  const p = String(rawPlan || "").toLowerCase();
  const validPlans = ["premium", "pro", "basico", "básico", "basic"]; // accept accents & alias
  const plan = validPlans.includes(p) ? (p === "básico" ? "basico" : p) : null;
  const tag = rawTag ? String(rawTag).trim() : null;
  return { email, plan, tag };
}

/* ── Diagnóstico ─────────────────────────────────────────────── */
router.all("/__version", (_req, res) => {
  res.json({ version: "2025-08-28_07" });
});

/* ── Ping / prueba manual (?test=1) ──────────────────────────── */
router.all("/", async (req, res, next) => {
  if (req.query?.test) {
    const { data } = req.body || {};
    if (data?.status && data?.metadata?.email) {
      const status = String(data.status).toLowerCase();
      const email = data.metadata.email;
      const plan = (data.metadata.plan || "premium").toLowerCase();
      const external_reference =
        data.external_reference || data.metadata?.external_reference || null;

      if (status === "approved") {
        const out = await handleApproved({ email, plan, external_reference });
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
  return next();
});

/* ── Webhook principal de Mercado Pago ───────────────────────── */
router.post("/", express.json(), async (req, res) => {
  try {
    const { type, action, data } = req.body || {};

    const topicQ = String(
      req.query?.topic || req.body?.topic || ""
    ).toLowerCase();
    const typeL = String(type || req.body?.type || "").toLowerCase();
    const actionL = String(action || req.body?.action || "").toLowerCase();

    if (process.env.DEBUG_WEBHOOK) {
      console.log("📬 MP webhook hit", {
        method: req.method,
        query: req.query,
        topicQ,
        type: typeL,
        action: actionL,
        hasBody: !!req.body,
      });
    }

    const __diag = { topicQ, type: typeL, action: actionL, query: req.query };

    // 1) “Inline metadata”: todo viene en el body ya resuelto
    if (data?.status && data?.metadata?.email) {
      const status = String(data.status || "").toLowerCase();
      const email = data.metadata.email;
      const plan = (data.metadata.plan || "premium").toLowerCase();
      const external_reference =
        data.external_reference || data.metadata?.external_reference || null;

      if (status === "approved") {
        const out = await handleApproved({ email, plan, external_reference });
        return res
          .status(200)
          .json({ ok: true, via: "inline_metadata", ...out });
      }
      return res.status(200).json({ ok: true, ignored_status: status });
    }

    // 2) Notificación tipo merchant_order (topic=merchant_order o resource=.../merchant_orders/{id})
    const looksLikeMerchantOrder =
      topicQ === "merchant_order" ||
      typeL.includes("merchant_order") ||
      (req.body?.resource &&
        String(req.body.resource).includes("/merchant_orders/"));

    if (looksLikeMerchantOrder) {
      // ID puede venir en query (?id=...), body.data.id, o dentro de resource URL
      let moId =
        (req.query?.id ??
          data?.id ??
          (req.body?.resource
            ? (String(req.body.resource).match(/merchant_orders\/(\d+)/) ||
                [])[1]
            : null)) ||
        null;
      if (moId != null) moId = String(moId).trim();

      if (!moId) {
        return res.status(202).json({ ok: false, reason: "mo_id_missing" });
      }

      try {
        const moUrl = `https://api.mercadopago.com/merchant_orders/${moId}`;
        const moResp = await fetch(moUrl, {
          headers: {
            Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
            Accept: "application/json",
          },
        });

        if (!moResp.ok) {
          return res.status(202).json({
            ok: false,
            reason: "mo_fetch_failed",
            status: moResp.status,
          });
        }

        const mo = await moResp.json();

        // Tomar un pago aprobado si existe; si no, el primero
        const paymentRef =
          (mo.payments || []).find(
            (p) => String(p?.status || "").toLowerCase() === "approved"
          ) || (mo.payments || [])[0];

        if (!paymentRef?.id) {
          return res.status(202).json({
            ok: false,
            via: "merchant_order",
            reason: "mo_no_payments",
          });
        }

        // Lookup del pago para reutilizar la misma lógica
        const payUrl = `https://api.mercadopago.com/v1/payments/${paymentRef.id}`;
        const payResp = await fetch(payUrl, {
          headers: {
            Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
            Accept: "application/json",
          },
        });

        if (!payResp.ok) {
          return res.status(202).json({
            ok: false,
            via: "merchant_order",
            reason: "payment_fetch_failed",
            status: payResp.status,
          });
        }

        const payment = await payResp.json();

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

        if (process.env.DEBUG_WEBHOOK) {
          console.log("🔎 MO lookup", {
            moId,
            paymentId: paymentRef.id,
            status,
            email,
            plan,
            external_reference,
          });
        }

        if (status === "approved" && email) {
          const out = await handleApproved({
            email,
            plan,
            external_reference,
          });
          return res
            .status(200)
            .json({ ok: true, via: "merchant_order_lookup", ...out });
        }

        return res.status(200).json({
          ok: true,
          via: "merchant_order_lookup",
          ignored: { status, haveEmail: !!email },
        });
      } catch (err) {
        console.error("❌ MO branch exception:", err);
        return res.status(200).json({
          ok: false,
          via: "merchant_order",
          error: String(err?.message || err),
        });
      }
    }

    // 3) Camino usual: notificación con ID de pago (más robusto)
    const looksLikePayment =
      topicQ === "payment" || isPaymentEvent(typeL, actionL);
    const paymentId = extractPaymentId(req.body, req.query);

    if (looksLikePayment && paymentId) {
      if (!mercadopago.payment) {
        console.error("❌ MP SDK sin método payment.* disponible");
        return res
          .status(202)
          .json({ ok: false, reason: "mp_sdk_unavailable" });
      }

      let mpPayment = null;
      try {
        if (mercadopago.payment.findById) {
          const resp = await mercadopago.payment.findById(paymentId);
          mpPayment = resp?.body || resp?.response || resp || null;
        } else if (mercadopago.payment.get) {
          const resp = await mercadopago.payment.get(paymentId);
          mpPayment = resp?.body || resp?.response || resp || null;
        }
      } catch (e) {
        console.error("❌ Error leyendo pago en MP:", e?.message || e);
      }

      if (!mpPayment) {
        // Fallback a HTTP directo si el SDK no devolvió cuerpo
        try {
          const payUrl = `https://api.mercadopago.com/v1/payments/${paymentId}`;
          const payResp = await fetch(payUrl, {
            headers: {
              Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
              Accept: "application/json",
            },
          });
          if (payResp.ok) {
            mpPayment = await payResp.json();
          }
        } catch (e) {
          console.error(
            "❌ Fallback HTTP payment lookup error:",
            e?.message || e
          );
        }
      }

      if (!mpPayment) {
        // 202 = acepto pero no pude procesar; MP reintentará
        return res
          .status(202)
          .json({ ok: false, reason: "payment_not_fetched" });
      }

      const status = String(mpPayment.status || "").toLowerCase();
      let email = null;
      let plan = null;
      const external_reference = extractExternalReference(req.body, mpPayment);

      // Prefer values parsed from external_reference, then fall back to MP metadata
      const parsed = parseExternalRefString(external_reference);
      email =
        parsed.email ||
        mpPayment?.metadata?.email ||
        mpPayment?.payer?.email ||
        null;
      plan = (
        parsed.plan ||
        mpPayment?.metadata?.plan ||
        "premium"
      ).toLowerCase();

      if (process.env.DEBUG_WEBHOOK) {
        console.log("🔎 parsed ext_ref", {
          external_reference,
          parsed,
          email,
          plan,
          status,
        });
      }

      if (status === "approved" && email) {
        const out = await handleApproved({ email, plan, external_reference });
        return res
          .status(200)
          .json({ ok: true, via: "payment_lookup", ...out });
      }

      return res
        .status(200)
        .json({ ok: true, ignored: { status, haveEmail: !!email } });
    }

    // 3) Otras acciones de MP (merchant_orders, subscriptions, etc.)
    if (process.env.DEBUG_WEBHOOK) {
      return res.status(200).json({
        ok: true,
        why: "no_branch_taken",
        ...__diag,
        ignored_action: { type, action },
      });
    }
    return res.status(200).json({ ok: true, ignored_action: { type, action } });
  } catch (err) {
    console.error("❌ webhook_mp error:", err);
    // 200 para no generar reintentos infinitos por errores propios
    return res
      .status(200)
      .json({ ok: false, error: err?.message || String(err) });
  }
});

export default router;
