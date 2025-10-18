// src/lib/api/routes/webhook_mp.mjs
import express from "express";
import mercadopago from "mercadopago";
import { createClient } from "@supabase/supabase-js";


console.log("🔔 webhook_mp VERSION=2025-09-18_02");
// Duraciones por plan (se pueden sobreescribir por ENV)
const PLAN_DAYS_DEFAULT = Number(process.env.PLAN_DURATION_DAYS || 30); // compatibilidad
const PLAN_DAYS_PREMIUM = Number(process.env.PLAN_DAYS_PREMIUM || process.env.PLAN_DURATION_DAYS_PREMIUM || 365);
const PLAN_DAYS_PRO = Number(process.env.PLAN_DAYS_PRO || process.env.PLAN_DURATION_DAYS_PRO || 365);
const PLAN_DAYS_BASICO = Number(process.env.PLAN_DAYS_BASICO || process.env.PLAN_DURATION_DAYS_BASICO || 0);

const router = express.Router();

/* ──────────────────────────── Utils ──────────────────────────── */
function maskKey(k) {
  if (!k) return null;
  const v = String(k);
  if (v.length <= 12) return v;
  return `${v.slice(0, 6)}…${v.slice(-6)}`;
}

// Resolve which env var we actually used for the Service Role key (for diagnostics)
function resolveServiceRoleKey() {
  const candidates = [
    ["SUPABASE_SERVICE_ROLE", process.env.SUPABASE_SERVICE_ROLE],
    ["SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY],
    ["SUPABASE_SERVICE_KEY", process.env.SUPABASE_SERVICE_KEY],
    ["SUPABASE_API_KEY", process.env.SUPABASE_API_KEY],
  ];
  for (const [name, val] of candidates) {
    if (val && String(val).trim().length > 0) {
      return { name, value: String(val) };
    }
  }
  return { name: null, value: "" };
}

/* ── Supabase (Service Role – SOLO backend) — lazy init ─ */
let __sb = null;
let __sbOnceLogged = false;

function getSupabase() {
  if (__sb) return __sb;

  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    "";

  // STRICTLY service-role style sources; do NOT use anon here
  const { name: keySource, value: key } = resolveServiceRoleKey();

  if (!url || !key) {
    if (!__sbOnceLogged) {
      console.warn(
        "[webhook_mp] ❗ SUPABASE_URL / Service Role key ausentes; no se escribirá en DB.",
        { hasUrl: !!url, hasServiceRole: !!key, keySource }
      );
      __sbOnceLogged = true;
    }
    return null;
  }

  try {
    __sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    if (!__sbOnceLogged) {
      console.log("[webhook_mp] ✅ Supabase admin listo", {
        urlHost: (() => { try { return new URL(url).host; } catch { return url; } })(),
        keySource,
        keyLen: key.length,
        keyMask: maskKey(key),
      });
      __sbOnceLogged = true;
    }
  } catch (e) {
    console.error("[webhook_mp] createClient error:", e?.message || e);
    __sb = null;
  }
  return __sb;
}

/* ── Body parser para TODO el router ─────────────────────────── */
router.use(express.json({ type: "*/*" }));

/* ── Seguridad opcional: shared secret ───────────────────────── */
router.use((req, res, next) => {
  const required = process.env.MP_WEBHOOK_SECRET || "";
  if (!required) return next(); // desactivado si no se define
  // Sources we accept for the token:
  // 1) query ?token=...
  // 2) header x-webhook-token
  // 3) Authorization: Bearer <token>
  let bearer = undefined;
  const auth = req.headers["authorization"];
  if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    bearer = auth.slice(7).trim();
  }
  const tok = req.query?.token || req.headers["x-webhook-token"] || bearer;

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

/* ─────────────────────── Helpers de negocio ─────────────────── */
async function updatePlanByEmail(email, plan, durationDays) {
  if (!email || !plan) return { ok: false, error: "email/plan faltan" };

  const sb = getSupabase();
  if (!sb) return { ok: false, error: "supabase_not_configured" };

  const emailLower = String(email).trim().toLowerCase();
  const planNorm = String(plan).trim().toLowerCase();
  const addDays =
    Number(durationDays) > 0
      ? Math.round(Number(durationDays))
      : getPlanDurationDays(planNorm);

  // 1) Leer perfil actual para calcular acumulación cuando corresponda
  const { data: existing, error: qErr } = await sb
    .from("profiles")
    .select("id, email, plan_type, plan_expires_at")
    .ilike("email", emailLower)
    .maybeSingle();

  if (qErr) return { ok: false, error: qErr.message };

  const now = new Date();

  // Si no hay días a sumar (planes no-pagados), dejamos expiración en NULL
  let expiresAt = null;
  if (addDays > 0) {
    const baseDate =
      existing?.plan_expires_at && new Date(existing.plan_expires_at) > now
        ? new Date(existing.plan_expires_at)
        : now;
    expiresAt = new Date(
      baseDate.getTime() + addDays * 24 * 60 * 60 * 1000
    ).toISOString();
  }

  if (existing?.id) {
    const { data, error } = await sb
      .from("profiles")
      .update({
        plan_type: planNorm,
        plan_expires_at: expiresAt, // puede ser null para basico/free
        updated_at: now.toISOString(),
      })
      .eq("id", existing.id)
      .select("id, email, plan_type, plan_expires_at, updated_at")
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, mode: "update", data };
  }

  const { data, error } = await sb
    .from("profiles")
    .upsert(
      {
        email: emailLower,
        plan_type: planNorm,
        plan_expires_at: expiresAt, // puede ser null
        updated_at: now.toISOString(),
      },
      { onConflict: "email" }
    )
    .select("id, email, plan_type, plan_expires_at, updated_at")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, mode: "insert", data };
}

async function upsertBusinessByEmail({ email, plan, external_reference }) {
  const owner_email = String(email || "").toLowerCase();
  const plan_type = String(plan || "premium").toLowerCase();
  const now = new Date().toISOString();
  if (!owner_email) return { ok: false, error: "owner_email faltante" };

  const sb = getSupabase();
  if (!sb) return { ok: false, error: "supabase_not_configured" };

  // 1) buscar si ya existe
  const { data: existing, error: qErr } = await sb
    .from("negocios")
    .select("id, owner_email")
    .eq("owner_email", owner_email)
    .limit(1)
    .maybeSingle();
  if (qErr) return { ok: false, error: qErr.message };

  if (existing?.id) {
    // 2) actualizar
    const { data, error } = await sb
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
  const { data, error } = await sb
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
async function handleApproved({ email, plan, external_reference, durationDays }) {
  const uProfile = await updatePlanByEmail(email, plan, durationDays);
  const uBusiness = await upsertBusinessByEmail({ email, plan, external_reference });
  return { uProfile, uBusiness, plan_duration_days: durationDays || getPlanDurationDays(plan) };
}

/* ───────────────────────── Otros helpers ────────────────────── */
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
  // Formats soportados:
  // 1) pipe-based:  email|plan|tag|durationDays
  // 2) query-like:  email=a@b.com&plan=premium&tag=foo&duration=365 | months=12 | years=1
  const out = { email: null, plan: null, tag: null, duration: null, months: null, years: null };
  if (typeof refStr !== "string" || !refStr.trim()) return out;
  const raw = refStr.trim();

  const toEmail = (s) => {
    if (typeof s !== "string") return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const v = s.trim().toLowerCase();
    return emailRegex.test(v) ? v : null;
  };
  const toPlan = (s) => {
    const p = String(s || "").toLowerCase();
    const valid = ["premium", "pro", "basico", "básico", "basic", "free", "gratuito"];
    if (!valid.includes(p)) return null;
    return p === "básico" || p === "basic" ? "basico" : p;
  };
  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  };

  // (A) pipe format
  if (raw.includes("|")) {
    const [rawEmail, rawPlan, rawTag, rawDuration] = raw.split("|");
    return {
      email: toEmail(rawEmail),
      plan: toPlan(rawPlan),
      tag: rawTag ? String(rawTag).trim() : null,
      duration: toNum(rawDuration),
      months: null,
      years: null,
    };
  }

  // (B) query-string-like format
  try {
    const qs = raw.startsWith("?") ? raw.slice(1) : raw;
    const params = new URLSearchParams(qs);
    const email = toEmail(params.get("email"));
    const plan = toPlan(params.get("plan"));
    const tag = params.get("tag") ? String(params.get("tag")).trim() : null;
    const duration = toNum(params.get("duration") || params.get("duration_days"));
    const months = toNum(params.get("months"));
    const years = toNum(params.get("years"));
    if (email || plan || tag || duration || months || years) {
      return { email, plan, tag, duration, months, years };
    }
  } catch {}

  return out;
}

function getPlanDurationDays(plan) {
  const p = String(plan || "").toLowerCase();
  if (p === "premium") return PLAN_DAYS_PREMIUM || PLAN_DAYS_DEFAULT;
  if (p === "pro") return PLAN_DAYS_PRO || PLAN_DAYS_DEFAULT;
  if (p === "basico" || p === "basic" || p === "free" || p === "gratuito") return PLAN_DAYS_BASICO || 0;
  return PLAN_DAYS_DEFAULT;
}

function coercePositiveInt(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function effectiveDurationDays(plan, parsed = {}, meta = {}) {
  // 1) Metadata explícita del pago
  let days =
    coercePositiveInt(meta?.duration_days) ||
    coercePositiveInt(meta?.duration) ||
    null;

  // 2) Hints en external_reference parseado
  if (!days) {
    days =
      coercePositiveInt(parsed?.duration) ||
      (parsed?.years ? coercePositiveInt(parsed.years * 365) : null) ||
      (parsed?.months ? coercePositiveInt(parsed.months * 30) : null) ||
      null;
  }

  // 3) Fallback por tipo de plan
  if (!days) days = getPlanDurationDays(plan);

  return days || getPlanDurationDays(plan);
}
function mpApi(path) {
  // Always use the public API host; account environment is defined by the access token.
  const base = "https://api.mercadopago.com";
  return `${base}${path.startsWith("/") ? path : "/" + path}`;
}

async function persistNotificationRaw(body) {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "no_admin_client" };
  try {
    const topic =
      body?.topic ||
      body?.type ||
      (typeof body?.action === "string" && body.action.includes("payment") ? "payment" : "unknown");

    const { error } = await sb
      .from("mp_notifications")
      .insert([{ topic, payload: body }]);

    if (error) return { ok: false, reason: "insert_notification_failed", error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "insert_notification_exception", error: String(e) };
  }
}

/* ───────────────────────── Diagnóstico ──────────────────────── */
router.all("/__version", (_req, res) => {
  res.json({ ok: true, version: "2025-09-18_02" });
});

// Diagnóstico rápido de ENVs en Vercel
router.get("/__env", (_req, res) => {
  const fp = (v = "") =>
    v ? `${String(v).slice(0, 6)}…${String(v).slice(-4)}` : null;
  res.json({
    ok: true,
    env: {
      MP_ACCESS_TOKEN: !!process.env.MP_ACCESS_TOKEN,
      SUPABASE_URL: !!(
        process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
      ),
      SUPABASE_SERVICE_ROLE: !!(
        process.env.SUPABASE_SERVICE_ROLE ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_KEY ||
        process.env.SUPABASE_API_KEY
      ),
      MP_WEBHOOK_SECRET: !!process.env.MP_WEBHOOK_SECRET,
      fingerprints: {
        MP_ACCESS_TOKEN: fp(process.env.MP_ACCESS_TOKEN || ""),
      },
    },
  });
});

// Deep self test for Supabase creds (read-only, head count)
router.get("/__selftest", async (_req, res) => {
  try {
    const url =
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      "";
    const { name: keySource, value: key } = resolveServiceRoleKey();

    const sb = getSupabase();
    if (!sb) {
      return res.status(200).json({
        ok: false,
        reason: "no_admin_client",
        urlPresent: !!url,
        keyPresent: !!key,
        keySource,
      });
    }

    // Lightweight call: ask for head count on a table we know exists
    const { error: headErr, count } = await sb
      .from("profiles")
      .select("*", { head: true, count: "estimated" });

    const diag = {
      ok: !headErr,
      keySource,
      urlHost: (() => { try { return new URL(url).host; } catch { return url; } })(),
      keyLen: key ? key.length : 0,
      keyMask: maskKey(key),
      count: typeof count === "number" ? count : null,
      error: headErr ? headErr.message : null,
      code: headErr ? headErr.code : null,
    };
    return res.status(200).json(diag);
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e?.message || e) });
  }
});

// Optional write probe into mp_notifications (safe payload) to catch "Invalid API key"
router.post("/__writeprobe", async (_req, res) => {
  try {
    const sb = getSupabase();
    if (!sb) return res.status(200).json({ ok: false, reason: "no_admin_client" });

    const payload = {
      topic: "probe",
      payload: { ts: new Date().toISOString(), from: "webhook_mp.__writeprobe" },
    };
    const { error } = await sb.from("mp_notifications").insert([payload]);
    if (error) return res.status(200).json({ ok: false, error: error.message, code: error.code });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e?.message || e) });
  }
});

/* ──────────────────────── Ping simple ───────────────────────── */
router.get("/", async (req, res) => {
  if (req.query?.test) {
    const { data } = req.body || {};
    if (data?.status && data?.metadata?.email) {
      const status = String(data.status).toLowerCase();
      const email = data.metadata.email;
      const plan = (data.metadata.plan || "premium").toLowerCase();
      const external_reference =
        data.external_reference || data.metadata?.external_reference || null;
      const parsed = parseExternalRefString(external_reference || "");
      const durationDays = effectiveDurationDays(plan, parsed, data?.metadata || req.body?.metadata || {});

      if (status === "approved") {
        const out = await handleApproved({ email, plan, external_reference, durationDays });
        return res
          .status(200)
          .json({ ok: true, via: "test_inline_metadata", ...out });
      }
      return res
        .status(200)
        .json({ ok: true, via: "test_ping", ignored_status: status });
    }
    return res.status(200).json({ ok: true, via: "OK_TEST" });
  }
  // si no es test, respondemos 200 para healthchecks (ngrok/MP)
  return res.status(200).json({ ok: true, route: "/webhook_mp" });
});

/* ─────────────── Webhook principal de Mercado Pago ───────────── */
router.post("/", async (req, res) => {
  try {
    const { type, action, data } = req.body || {};
    await persistNotificationRaw(req.body).catch(() => {});

    // --- Simulación local de APROBADO (sin pegarle a MP) ---
    if (
      process.env.NODE_ENV !== "production" &&
      req.body?.type === "test_approved"
    ) {
      const external_reference =
        req.body?.data?.external_reference ||
        req.body?.external_reference ||
        null;
      const email = req.body?.data?.email || req.body?.metadata?.email || null;
      const plan = (
        req.body?.data?.plan ||
        req.body?.metadata?.plan ||
        "premium"
      ).toLowerCase();
      const parsed = parseExternalRefString(external_reference || "");
      const durationDays = effectiveDurationDays(plan, parsed, req.body?.metadata || {});

      if (email) {
        const out = await handleApproved({ email, plan, external_reference, durationDays });
        return res.status(200).json({ ok: true, via: "sim_approved", ...out });
      }
      // No email provisto: aun así confirmamos recepción para pruebas de integración
      return res
        .status(200)
        .json({ ok: true, via: "sim_approved", note: "sin email" });
    }

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
      const parsed = parseExternalRefString(external_reference || "");
      const durationDays = effectiveDurationDays(plan, parsed, data?.metadata || {});

      if (status === "approved") {
        const out = await handleApproved({ email, plan, external_reference, durationDays });
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
        const moUrl = mpApi(`/merchant_orders/${moId}`);
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
        const payUrl = mpApi(`/v1/payments/${paymentRef.id}`);
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
          const durationDays = effectiveDurationDays(plan, parsed, payment?.metadata || {});
          const out = await handleApproved({
            email,
            plan,
            external_reference,
            durationDays,
          });
          return res
            .status(200)
            .json({ ok: true, via: "merchant_order_lookup", ...out });
        }

        if (process.env.DEBUG_WEBHOOK) {
          console.log("ℹ️ merchant_order_lookup ignored", { moId, paymentId: paymentRef.id, status, haveEmail: !!email, external_reference });
        }
        return res.status(200).json({ ok: true, via: "merchant_order_lookup", ignored: { status, haveEmail: !!email } });
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
          const payUrl = mpApi(`/v1/payments/${paymentId}`);
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
        const durationDays = effectiveDurationDays(plan, parsed, mpPayment?.metadata || {});
        const out = await handleApproved({ email, plan, external_reference, durationDays });
        return res
          .status(200)
          .json({ ok: true, via: "payment_lookup", ...out });
      }

      if (process.env.DEBUG_WEBHOOK) {
        console.log("ℹ️ payment_lookup ignored", { paymentId, status, haveEmail: !!email, external_reference });
      }
      return res.status(200).json({ ok: true, ignored: { status, haveEmail: !!email } });
    }

    // 4) Otras acciones de MP (merchant_orders, subscriptions, etc.)
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