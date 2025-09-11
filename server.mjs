// server.mjs
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";

// 1) Carga el archivo de entorno indicado (default: .env.production)
const myEnv = dotenv.config({
  path: process.env.DOTENV_CONFIG_PATH || ".env.production",
});

// 2) Expande variables anidadas: VITE_MP_BASE=${CLOUD_TUNNEL_BASE}, etc.
dotenvExpand.expand(myEnv);

import express from "express";
import cors from "cors";

// Routers propios (usar import dinámico para que .env ya esté cargado antes)
const { default: createPreferenceRouter } = await import(
  "./src/lib/api/create_preference.mjs"
);
// 👇 Usa el router completo (lookup en MP + upsert en Supabase)
const { default: webhookMPRouter } = await import(
  "./src/lib/api/routes/webhook_mp.mjs"
);

/* ================================
   fetch compatible (Node 18+ trae fetch)
================================ */
let fetchFn = globalThis.fetch;
if (typeof fetchFn !== "function") {
  const { default: nodeFetch } = await import("node-fetch");
  fetchFn = nodeFetch;
}

/* ================================
   Boot logs
================================ */
console.log("🧭 SERVER START MARK v2 @", new Date().toISOString());
console.log(
  "🧪 dotenv path:",
  process.env.DOTENV_CONFIG_PATH || ".env.production"
);
console.log("🧪 MP_ENV:", process.env.MP_ENV || "(not set)");

/* ================================
   Validación de entorno crítico (fail-fast)
================================ */
function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`❌ Falta variable de entorno: ${name}`);
    process.exit(1);
  }
  return v;
}

requireEnv("MP_ACCESS_TOKEN");
requireEnv("MP_ENV");
requireEnv("MP_WEBHOOK_URL");
requireEnv("REGISTRO_SUCCESS_URL");
requireEnv("REGISTRO_FAILURE_URL");
requireEnv("REGISTRO_PENDING_URL");

/* ================================
   App & Middlewares
================================ */
const app = express();

// CORS: permite solo orígenes listados en CORS_ORIGIN
app.use(
  cors({
    origin: (process.env.CORS_ORIGIN || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    credentials: true,
  })
);

// JSON global (tu router de webhook puede usar raw internamente si lo necesita)
app.use(express.json());

// Logger simple por request
app.use((req, _res, next) => {
  console.log("👉", req.method, req.originalUrl);
  next();
});

/* ================================
   Healthcheck
================================ */
app.get("/health", (_req, res) => res.json({ ok: true }));

/* ================================
   Diagnóstico de versión/env
================================ */
app.get("/diag/version", (_req, res) => {
  res.json({
    from: "server",
    version: "2025-08-28_04",
    success: process.env.REGISTRO_SUCCESS_URL,
    failure: process.env.REGISTRO_FAILURE_URL,
    pending: process.env.REGISTRO_PENDING_URL,
    notification_url: process.env.MP_WEBHOOK_URL,
    frontend_url: process.env.FRONTEND_URL || "http://localhost:5173",
  });
});

// Variables críticas (sin exponer valores completos)
app.get("/diag/env", (_req, res) => {
  const keys = [
    "MP_ACCESS_TOKEN",
    "MP_ENV",
    "REGISTRO_SUCCESS_URL",
    "REGISTRO_FAILURE_URL",
    "REGISTRO_PENDING_URL",
    "MP_WEBHOOK_URL",
    "FRONTEND_URL",
    "CORS_ORIGIN",
  ];
  const envDiag = {};
  for (const k of keys) {
    const val = process.env[k] || "";
    envDiag[k] = { starts: val.slice(0, 8), len: val.length };
  }
  res.json({
    env: envDiag,
    dotenv_path: process.env.DOTENV_CONFIG_PATH || ".env.production",
    mp_env: process.env.MP_ENV || null,
    ts: new Date().toISOString(),
  });
});

// Lista rápida de rutas montadas (debug)
app.get("/diag/routes", (_req, res) => {
  const routes = [];
  app._router?.stack?.forEach((m) => {
    if (m.route?.path) {
      routes.push({
        method: Object.keys(m.route.methods)[0]?.toUpperCase(),
        path: m.route.path,
      });
    } else if (m.name === "router" && m.handle?.stack) {
      m.handle.stack.forEach((h) => {
        if (h.route?.path) {
          routes.push({
            method: Object.keys(h.route.methods)[0]?.toUpperCase(),
            path: h.route.path,
          });
        }
      });
    }
  });
  res.json(routes);
});

/* ================================
   Webhook logger (no rompe tu router)
   - Loguea headers/query/body cuando POSTean a /webhook_mp
   - Guarda el último evento en memoria para diagnóstico
================================ */
let lastWebhookEvent = null;

app.use("/webhook_mp", (req, _res, next) => {
  if (req.method === "POST") {
    try {
      const xSig = req.header("x-signature") || "";
      const xReqId = req.header("x-request-id") || "";
      const topic =
        req.query?.topic ||
        req.body?.type ||
        req.body?.action ||
        req.query?.type ||
        "unknown";
      const dataId = req.query?.["data.id"] || req.body?.data?.id || null;

      lastWebhookEvent = {
        ts: new Date().toISOString(),
        headers: {
          "x-request-id": xReqId,
          "x-signature": xSig,
          "content-type": req.header("content-type") || "",
          "user-agent": req.header("user-agent") || "",
        },
        query: req.query,
        body: req.body,
        topic,
        dataId,
      };

      console.log("🛎️  [WEBHOOK_MP] >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
      console.log("🔹 date:", lastWebhookEvent.ts);
      console.log("🔹 x-request-id:", xReqId);
      console.log("🔹 x-signature:", xSig);
      console.log("🔹 topic:", topic, " data.id:", dataId);
      console.log("🔹 query:", req.query);
      console.log("🔹 body:", JSON.stringify(req.body));
    } catch (e) {
      console.error("🛎️  [WEBHOOK_MP] logger error:", e?.message || e);
    }
  }
  next();
});

// Diagnóstico: último webhook recibido (no expone secretos)
app.get("/diag/webhook/last", (_req, res) => {
  res.json({
    ok: true,
    last: lastWebhookEvent || null,
  });
});

/* ================================
   Monta routers reales
================================ */
app.use("/create_preference", createPreferenceRouter);
app.use("/webhook_mp", webhookMPRouter);

/* ================================
   Log del token para validar .env
   (Usa MP_ENV para etiquetar SANDBOX/PRODUCCION)
================================ */
const mpToken = process.env.MP_ACCESS_TOKEN || "";
const envType =
  (process.env.MP_ENV || "").toUpperCase() === "SANDBOX"
    ? "SANDBOX"
    : "PRODUCCION";
console.log(
  `🔐 MP_ACCESS_TOKEN (${envType}) inicia:`,
  mpToken.slice(0, 10),
  "len:",
  mpToken.length
);

/* ================================
   Proxy: merchant order por ID
   GET /mp/order/:id -> https://api.mercadopago.com/merchant_orders/:id
================================ */
app.get("/mp/order/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!id)
      return res.status(400).json({ error: "merchant_order_id requerido" });

    const token = process.env.MP_ACCESS_TOKEN || "";
    if (!token)
      return res.status(500).json({ error: "MP_ACCESS_TOKEN faltante" });

    const url = `https://api.mercadopago.com/merchant_orders/${encodeURIComponent(
      id
    )}`;
    const r = await fetchFn(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const data = await r.json();
    if (!r.ok) {
      return res
        .status(r.status)
        .json({ error: data?.message || "MP error", raw: data });
    }
    return res.status(200).json(data);
  } catch (e) {
    console.error("❌ /mp/order error:", e?.message || e);
    return res.status(500).json({ error: "Fallo consultando MP" });
  }
});

/* ================================
   Proxy: consulta de un pago por ID
   GET /mp/payment/:id -> https://api.mercadopago.com/v1/payments/:id
================================ */
app.get("/mp/payment/:id", async (req, res) => {
  try {
    const token = process.env.MP_ACCESS_TOKEN || "";
    if (!token)
      return res.status(500).json({ error: "MP_ACCESS_TOKEN faltante" });

    const url = `https://api.mercadopago.com/v1/payments/${encodeURIComponent(
      req.params.id
    )}`;
    const r = await fetchFn(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const data = await r.json();
    if (!r.ok) {
      return res
        .status(r.status)
        .json({ error: data?.message || "MP error", raw: data });
    }
    return res.json(data);
  } catch (e) {
    console.error("❌ /mp/payment/:id error:", e?.message || e);
    return res.status(500).json({ error: "Fallo consultando MP" });
  }
});

/* ================================
   Proxy: búsqueda de pagos
   GET /mp/payments/search?external_reference=...&status=...&date_created_from=...
   (Nota: este endpoint NO acepta preference_id, usa external_reference)
================================ */
app.get("/mp/payments/search", async (req, res) => {
  try {
    const token = process.env.MP_ACCESS_TOKEN || "";
    if (!token)
      return res.status(500).json({ error: "MP_ACCESS_TOKEN faltante" });

    const qs = new URLSearchParams(req.query).toString();
    const url = `https://api.mercadopago.com/v1/payments/search${
      qs ? `?${qs}` : ""
    }`;

    const r = await fetchFn(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const data = await r.json();
    if (!r.ok) {
      return res
        .status(r.status)
        .json({ error: data?.message || "MP error", raw: data });
    }
    return res.status(200).json(data);
  } catch (e) {
    console.error("❌ /mp/payments/search error:", e?.message || e);
    return res.status(500).json({ error: "Fallo consultando MP" });
  }
});

/* ================================
   Diagnóstico: Self-test de credenciales MP
================================ */
app.get("/diag/mp/selftest", async (_req, res) => {
  try {
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token)
      return res
        .status(500)
        .json({ ok: false, error: "MP_ACCESS_TOKEN faltante" });
    const r = await fetchFn("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const me = await r.json();
    return res.status(r.ok ? 200 : r.status).json({
      ok: r.ok,
      status: r.status,
      user_id: me?.id,
      nickname: me?.nickname,
      site_id: me?.site_id,
      env: process.env.MP_ENV,
    });
  } catch (e) {
    return res
      .status(500)
      .json({ error: "selftest failed", message: e?.message || e });
  }
});

/* ================================
   Redirect /pago/* -> FRONTEND_URL
   (para que el retorno de MP llegue al frontend con los mismos query params)
================================ */
const FRONT = process.env.FRONTEND_URL || "http://localhost:5173";
app.get(["/pago/success", "/pago/failure", "/pago/pending"], (req, res) => {
  const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.redirect(302, `${FRONT}${req.path}${qs}`);
});

/* ================================
   404 para rutas no definidas (debe ir DESPUÉS de tus rutas)
================================ */
app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.originalUrl });
});

/* ================================
   Manejo de errores Express (cualquier throw llega aquí)
================================ */
app.use((err, _req, res, _next) => {
  console.error("🧨 Uncaught error:", err?.stack || err);
  res.status(500).json({ error: "Internal Server Error" });
});

/* ================================
   Arranque del servidor
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🟢----------------------------");
  console.log(`🟢 Backend activo en: http://localhost:${PORT}`);
  console.log("🟢----------------------------");
});

/* ================================
   Hardening de proceso (global)
================================ */
process.on("unhandledRejection", (r) =>
  console.error("🧨 unhandledRejection", r)
);
process.on("uncaughtException", (e) =>
  console.error("🧨 uncaughtException", e)
);
