// ================================
// server.mjs — Backend Express IztapaMarket
// ================================

// 1) ENV (.env por defecto; sobreescribe con DOTENV_CONFIG_PATH)
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
const myEnv = dotenv.config({
  path: process.env.DOTENV_CONFIG_PATH || ".env",
  // Permite que el archivo .env pise variables exportadas si arrancas con DOTENV_CONFIG_OVERRIDE=1
  override: process.env.DOTENV_CONFIG_OVERRIDE === "1",
});
try {
  // en dotenv-expand se invoca como función
  dotenvExpand(myEnv);
} catch (_) {}

// ── Debug de fingerprints para detectar mezclas de ngrok/URLs ───────────────
const __fp = (v) => (v ? String(v).replace(/^https?:\/\//, "").slice(0, 28) : null);
console.log("[env] DOTENV_CONFIG_PATH:", process.env.DOTENV_CONFIG_PATH || ".env");
console.log("[env] MP webhook/backs:", {
  webhook: __fp(process.env.MP_WEBHOOK_URL),
  success: __fp(process.env.REGISTRO_SUCCESS_URL),
  failure: __fp(process.env.REGISTRO_FAILURE_URL),
  pending: __fp(process.env.REGISTRO_PENDING_URL),
});

// 2) Deps principales
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createClient } from "@supabase/supabase-js"; // fetch global Node18+

// Router del webhook (Mercado Pago)

// 3) App base
const app = express();
app.set("trust proxy", true); // 👈 importante para ngrok/https
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Log de arranque para confirmar token
console.log(
  "[env] MP_ACCESS_TOKEN?",
  process.env.MP_ACCESS_TOKEN ? "SET" : "MISSING"
);

// Helper: absolutizar URLs relativas (más robusto)
const makeAbsolute = (u, base) => {
  if (!u) return u;
  const s = String(u).trim();

  // Ya es URL absoluta con http/https
  if (s.startsWith("http://") || s.startsWith("https://")) {
    return s;
  }

  // Si viene algo como "localhost:3001/xxx" o "/pago/success",
  // lo pegamos sobre la base asegurando esquema + host.
  const safeBase = (base || "http://localhost:3001").replace(/\/+$/, "");

  if (s.startsWith("/")) {
    return `${safeBase}${s}`;
  }

  // Caso "localhost:3001/xxx" sin slash inicial
  return `${safeBase}/${s}`;
};

// 4) Healthcheck y versiones
app.get("/health", (_req, res) => res.status(200).json({ ok: true }));

app.get("/diag/version", (_req, res) => {
  res.json({
    env: process.env.NODE_ENV || "sandbox",
    ok: true,
    version: process.env.APP_VERSION || "dev",
  });
});

app.get("/webhook_mp/__version", (_req, res) => {
  res.json({ webhook: "ok", version: process.env.WEBHOOK_VERSION || "dev" });
});

// 5) Supabase (modo lectura)
const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

// --- Supabase Admin (para enviar Magic Links tras pago aprobado) ---
const SUPABASE_SERVICE_ROLE =
  process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

async function sendMagicLink(email, redirectPath = "/mi-negocio") {
  try {
    if (!supabaseAdmin) {
      console.warn("[Auth] ⚠️ Supabase admin no inicializado; no se puede enviar magic link.");
      return;
    }
    if (!email) {
      console.warn("[Auth] ⚠️ Email vacío para magic link.");
      return;
    }
    const base = (process.env.PUBLIC_BASE_URL || "http://localhost:5173").replace(/\/+$/, "");
    const emailRedirectTo = `${base}/auth/callback?redirect=${encodeURIComponent(redirectPath)}`;
    console.log("[Auth] Enviando magic link a:", email, "→", emailRedirectTo);
    const { error } = await supabaseAdmin.auth.signInWithOtp({
      email,
      options: { emailRedirectTo },
    });
    if (error) {
      console.error("[Auth] ❌ Error enviando magic link:", error);
    } else {
      console.log("[Auth] ✅ Magic link enviado a", email);
    }
  } catch (e) {
    console.error("[Auth] ❌ Excepción enviando magic link:", e?.message || e);
  }
}

// === RUTAS DE DIAGNÓSTICO ====================================================
function mpEnv() {
  return {
    hasAccessToken: Boolean(process.env.MP_ACCESS_TOKEN),
    env: process.env.MP_ENV || process.env.NODE_ENV || "sandbox",
    webhook: process.env.MP_WEBHOOK_URL || null,
    success: process.env.REGISTRO_SUCCESS_URL || null,
    failure: process.env.REGISTRO_FAILURE_URL || null,
    pending: process.env.REGISTRO_PENDING_URL || null,
  };
}

app.get(["/api/diag", "/diag"], (_req, res) => {
  res.json({
    ok: true,
    project: "IztapaMarket",
    version: process.env.APP_VERSION || "dev",
    mp: mpEnv(),
    site: { base: process.env.PUBLIC_BASE_URL || null },
  });
});

app.get(["/api/webhook_mp/__env", "/webhook_mp/__env"], (_req, res) => {
  res.json({
    ok: true,
    project: "IztapaMarket",
    version: process.env.WEBHOOK_VERSION || "dev",
    mp: mpEnv(),
  });
});

// 6) Crear preferencia de Mercado Pago
const createPreferenceHandler = async (req, res) => {
  try {
    const {
      title = "Plan Premium",
      price = 199,
      quantity = 1,
      currency_id = "MXN",
      external_reference,
      notification_url: notificationUrlFromBody,
      back_urls: backUrlsFromBody, // permitir override desde el body
      metadata,
    } = req.body || {};

    const payer_email = req.body?.payer_email;
    const binary_mode = Boolean(req.body?.binary_mode);

    const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

    // BASE_URL compatible con proxy/ngrok
    const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
    const host = req.headers["x-forwarded-host"] || req.get("host");

    // Si no viene por body ni env, usa el host actual del request (evita ngrok viejo)
    const NOTIF_URL =
      notificationUrlFromBody ||
      process.env.MP_WEBHOOK_URL ||
      `${proto}://${host}/webhook_mp`;
    const BASE_URL = (
      process.env.PUBLIC_BASE_URL || `${proto}://${host || "localhost:3001"}`
    ).replace(/\/+$/, "");

    const BACK_SUCCESS = process.env.REGISTRO_SUCCESS_URL || "";
    const BACK_FAILURE = process.env.REGISTRO_FAILURE_URL || "";
    const BACK_PENDING = process.env.REGISTRO_PENDING_URL || "";

    const BACK_SUCCESS_EFF = BACK_SUCCESS || `${BASE_URL}/pago/success`;
    const BACK_FAILURE_EFF = BACK_FAILURE || `${BASE_URL}/pago/failure`;
    const BACK_PENDING_EFF = BACK_PENDING || `${BASE_URL}/pago/pending`;

    // Si vienen back_urls en el body (con success), se respetan
    const BACK_URLS_EFF =
      backUrlsFromBody && backUrlsFromBody.success
        ? backUrlsFromBody
        : {
            success: BACK_SUCCESS_EFF,
            failure: BACK_FAILURE_EFF,
            pending: BACK_PENDING_EFF,
          };

    console.log("[MP base/public]", {
      BASE_URL,
      PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL,
      xfp: req.headers["x-forwarded-proto"],
      xfh: req.headers["x-forwarded-host"],
    });
    console.log("[MP back_urls.effective]", BACK_URLS_EFF);

    // Warn si el webhook/back_urls están apuntando a un ngrok distinto al host actual
    try {
      const currentHost = String(host || "").toLowerCase();
      const urlsToCheck = [
        ["webhook", NOTIF_URL],
        ["success", BACK_URLS_EFF?.success],
        ["failure", BACK_URLS_EFF?.failure],
        ["pending", BACK_URLS_EFF?.pending],
      ];
      for (const [label, u] of urlsToCheck) {
        if (typeof u === "string" && u.includes("ngrok-free.app")) {
          const uh = new URL(u).host.toLowerCase();
          if (currentHost && currentHost !== uh) {
            console.warn(`[MP] ⚠️ ${label} apunta a ngrok distinto (${uh}) vs actual (${currentHost}).`);
          }
        }
      }
    } catch {}

    // normaliza a URLs absolutas (evita rutas relativas)
    const BACK_URLS_ABS = {
      success: makeAbsolute(BACK_URLS_EFF.success, BASE_URL),
      failure: makeAbsolute(BACK_URLS_EFF.failure, BASE_URL),
      pending: makeAbsolute(BACK_URLS_EFF.pending, BASE_URL),
    };
    console.log("[MP back_urls.absolute]", BACK_URLS_ABS);

    // ✅ auto_return habilitado por defecto para enviar al usuario de vuelta al front.
    // Si necesitas apagarlo temporalmente, exporta MP_DISABLE_AUTO_RETURN=1
    const autoReturn = process.env.MP_DISABLE_AUTO_RETURN === "1" ? undefined : "approved";
    console.log("[MP auto_return]", autoReturn ? "ENABLED" : "DISABLED");

    if (!MP_ACCESS_TOKEN)
      return res
        .status(500)
        .json({ error: "MP_ACCESS_TOKEN ausente en el backend" });
    if (!NOTIF_URL)
      return res
        .status(400)
        .json({ error: "notification_url faltante (body o env)" });

    const payload = {
      items: [
        { title, unit_price: Number(price), quantity: Number(quantity), currency_id },
      ],
      back_urls: BACK_URLS_ABS,
      ...(autoReturn ? { auto_return: autoReturn } : {}),
      payer: payer_email ? { email: payer_email } : undefined,
      binary_mode,
      notification_url: makeAbsolute(NOTIF_URL, BASE_URL),
      external_reference: external_reference || undefined,
      metadata: metadata || undefined,
    };

    console.log("[MP payload]", JSON.stringify(payload, null, 2));

    const mpResp = await fetch(
      "https://api.mercadopago.com/checkout/preferences",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const raw = await mpResp.text();
    console.log("[MP status]", mpResp.status);
    console.log("[MP raw body]", raw);

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { raw };
    }

    if (!mpResp.ok) {
      console.error("[MP create_preference] Error:", data);
      return res.status(502).json({
        error: "Mercado Pago no aceptó la preferencia",
        details: data,
      });
    }

    // 🔧 Normalizar init_point (México usa checkout real incluso en sandbox)
    if (data?.sandbox_init_point && !data?.init_point) {
      try {
        const url = new URL(data.sandbox_init_point);
        url.hostname = "www.mercadopago.com.mx";
        data.init_point = url.toString();
        console.log("[MP] ⚙️ sandbox_init_point convertido a init_point (MX):", data.init_point);
      } catch (e) {
        console.warn("[MP] ⚠️ No se pudo normalizar sandbox_init_point:", e.message);
      }
    } else if (data?.init_point && data.init_point.includes("sandbox.")) {
      try {
        const url = new URL(data.init_point);
        url.hostname = "www.mercadopago.com.mx";
        data.init_point = url.toString();
        console.log("[MP] ⚙️ init_point sandbox normalizado (MX):", data.init_point);
      } catch (e) {
        console.warn("[MP] ⚠️ Error normalizando init_point:", e.message);
      }
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("[/api/create_preference] Exception:", err?.message || err);
    return res.status(500).json({ error: "Fallo al crear preferencia" });
  }
};

// Endpoints de preferencia (varios alias por compat)
app.post("/api/create_preference", createPreferenceHandler);
app.post("/api/create-preference", createPreferenceHandler);
app.post("/api/mp/create-preference", createPreferenceHandler);
app.post("/api/mercadopago/create-preference", createPreferenceHandler);
app.post("/mp/create", createPreferenceHandler); // alias corto legacy
app.post("/api/create_preference_v2", createPreferenceHandler);

// Proxies de verificación para el frontend (PaySuccess)
app.get(["/mp/payment/:id", "/api/mp/payment/:id"], async (req, res) => {
  try {
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) return res.status(500).json({ error: "MP_ACCESS_TOKEN faltante" });
    const r = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(
        req.params.id
      )}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const txt = await r.text();
    res.status(r.status).type("application/json").send(txt);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get(["/mp/order/:id", "/api/mp/order/:id"], async (req, res) => {
  try {
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) return res.status(500).json({ error: "MP_ACCESS_TOKEN faltante" });
    const r = await fetch(
      `https://api.mercadopago.com/merchant_orders/${encodeURIComponent(
        req.params.id
      )}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const txt = await r.text();
    res.status(r.status).type("application/json").send(txt);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get(
  ["/mp/payments/search", "/api/mp/payments/search"],
  async (req, res) => {
    try {
      const token = process.env.MP_ACCESS_TOKEN;
      if (!token)
        return res.status(500).json({ error: "MP_ACCESS_TOKEN faltante" });
      const qs = req.originalUrl.split("?")[1] || "";
      const url = `https://api.mercadopago.com/v1/payments/search${
        qs ? "?" + qs : ""
      }`;
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const txt = await r.text();
      res.status(r.status).type("application/json").send(txt);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  }
);

// ✅ leer preferencia por ID (proxy)
app.get(["/mp/preference/:id", "/api/mp/preference/:id"], async (req, res) => {
  try {
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) return res.status(500).json({ error: "MP_ACCESS_TOKEN faltante" });
    const url = `https://api.mercadopago.com/checkout/preferences/${encodeURIComponent(
      req.params.id
    )}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const txt = await r.text();
    res.status(r.status).type("application/json").send(txt);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// 7) Sitemap (SEO)
app.get("/api/sitemap", async (req, res) => {
  try {
    const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const BASE_URL = `${proto}://${host}`.replace(/\/+$/, "");
    const today = new Date().toISOString().split("T")[0];

    const urls = [
      { path: "/", changefreq: "daily", priority: "1.0", lastmod: today },
      { path: "/negocios", changefreq: "daily", priority: "0.9", lastmod: today },
      { path: "/categorias", changefreq: "weekly", priority: "0.7", lastmod: today },
      { path: "/planes", changefreq: "monthly", priority: "0.8", lastmod: today },
      { path: "/registro", changefreq: "monthly", priority: "0.7", lastmod: today },
      { path: "/terminos", changefreq: "yearly", priority: "0.3", lastmod: today },
      { path: "/privacidad", changefreq: "yearly", priority: "0.3", lastmod: today },
    ];

    if (supabase) {
      try {
        const { data: categorias } = await supabase
          .from("categorias")
          .select("slug, slug_categoria, nombre")
          .limit(2000);
        categorias?.forEach((cat) => {
          const slug = cat?.slug || cat?.slug_categoria || cat?.nombre;
          if (slug)
            urls.push({
              path: `/categorias/${slug}`,
              changefreq: "weekly",
              priority: "0.7",
              lastmod: today,
            });
        });

        const { data: negocios } = await supabase
          .from("negocios")
          .select("slug, updated_at")
          .eq("is_deleted", false)
          .eq("is_approved", true)
          .limit(5000);
        negocios?.forEach((biz) => {
          if (biz?.slug) {
            urls.push({
              path: `/negocio/${biz.slug}`,
              changefreq: "weekly",
              priority: "0.6",
              lastmod: biz.updated_at
                ? new Date(biz.updated_at).toISOString().split("T")[0]
                : today,
            });
          }
        });
      } catch (e) {
        console.warn("[sitemap] enriquecimiento dinámico falló:", e?.message);
      }
    }

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls
        .map(
          (u) =>
            `  <url>\n    <loc>${BASE_URL}${u.path}</loc>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n    <lastmod>${u.lastmod}</lastmod>\n  </url>`
        )
        .join("\n") +
      `\n</urlset>`;

    res
      .status(200)
      .set("Content-Type", "application/xml; charset=utf-8")
      .set("Cache-Control", "public, max-age=3600")
      .send(xml);
  } catch {
    res.status(500).send("Error generando sitemap");
  }
});

app.get("/sitemap.xml", (_req, res) => res.redirect(301, "/api/sitemap"));

// --- Supabase env normalization for webhook (ensure router sees correct keys) ---
try {
  // Prefer explicit server-side variables; fall back to VITE_* when missing
  if (!process.env.SUPABASE_URL && process.env.VITE_SUPABASE_URL) {
    process.env.SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  }

  // Consolidate possible service role env names into SUPABASE_SERVICE_ROLE
  if (
    !process.env.SUPABASE_SERVICE_ROLE &&
    (process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_API_KEY)
  ) {
    process.env.SUPABASE_SERVICE_ROLE =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_API_KEY;
  }

  // 🔐 In sandbox/testing we FORCE the router to use SRK for any write operations.
  const isSandbox =
    String(process.env.MP_ENV || process.env.NODE_ENV || "sandbox").toLowerCase() !== "production" ||
    process.env.MP_FORCE_SANDBOX === "1" ||
    process.env.VITE_FORCE_SANDBOX === "1";

  if (isSandbox) {
    // If we have a Service Role, propagate it to every alias the router might read.
    const SRK =
      process.env.SUPABASE_SERVICE_ROLE ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_API_KEY ||
      "";

    if (SRK) {
      // Force ANON to SRK so inserts/updates don't fail with "Invalid API key"
      process.env.SUPABASE_ANON_KEY = SRK;
      process.env.VITE_SUPABASE_ANON_KEY = SRK;

      // Also mirror into common alias envs some routers use
      process.env.SUPABASE_SERVICE_ROLE_KEY = SRK;
      process.env.SUPABASE_SERVICE_KEY = SRK;
      process.env.SUPABASE_API_KEY = SRK;
    }
  } else {
    // In production, only fall back to VITE_* if truly missing
    if (!process.env.SUPABASE_ANON_KEY) {
      process.env.SUPABASE_ANON_KEY =
        process.env.VITE_SUPABASE_ANON_KEY || "";
    }
  }

  console.log(
    "[env] SUPABASE_URL?",
    process.env.SUPABASE_URL ? "SET" : "MISSING",
    "| SUPABASE_SERVICE_ROLE?",
    process.env.SUPABASE_SERVICE_ROLE ? "SET" : "MISSING",
    "| SUPABASE_ANON_KEY?",
    process.env.SUPABASE_ANON_KEY ? "SET(SANDBOX->SRK)" : "MISSING"
  );
} catch (e) {
  console.warn("[env] Supabase env normalization failed:", e?.message || e);
}

// 8) Webhook Mercado Pago
const { default: webhookMpRouter } = await import("./src/lib/api/routes/webhook_mp.mjs");
app.use("/webhook_mp", webhookMpRouter);
app.use("/api/webhook_mp", webhookMpRouter);

// 9) Alias de /diag
app.get("/diag", (_req, res) => res.redirect(307, "/api/diag"));

// 10) Post-pago → front
console.log(
  "➡️  Postpay redirect routes mounted: /pago/success, /pago/failure, /pago/pending"
);
app.get(["/pago/success", "/pago/failure", "/pago/pending"], async (req, res) => {
  try {
    const FRONTEND = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");
    const target = req.path || "/";
    const url = new URL(FRONTEND + target);

    // Preserva todos los query params que llegan de MP
    Object.entries(req.query || {}).forEach(([k, v]) =>
      Array.isArray(v)
        ? v.forEach((vv) => url.searchParams.append(k, String(vv)))
        : url.searchParams.set(k, String(v))
    );

    // Si es success y el pago quedó aprobado, intenta disparar Magic Link
    const isSuccess = req.path === "/pago/success";
    const status =
      (req.query?.status || req.query?.collection_status || "").toString().toLowerCase();
    if (isSuccess && status === "approved") {
      // Candidatos de email: query param preferido; fallback a cookie si la tienes
      const emailCandidate =
        req.query?.email ||
        req.query?.contact ||
        req.query?.payer_email ||
        req.cookies?.registro_email ||
        "";

      if (emailCandidate) {
        await sendMagicLink(String(emailCandidate).trim(), "/mi-negocio");
      } else {
        console.warn("[PostPay] ⚠️ No se encontró email para enviar magic link (success).");
      }
    }

    return res.redirect(302, url.toString());
  } catch (e) {
    console.error("[postpay redirect] error:", e?.message);
    return res
      .status(500)
      .json({ ok: false, error: "postpay redirect failed" });
  }
});

// 11) 🔎 /__routes ultra robusto
app.get("/__routes", (_req, res) => {
  try {
    const seen = new Set();
    const routes = [];

    function pushRoute(path, methods) {
      const full = (path || "/").replace(/\/{2,}/g, "/");
      const key = (methods?.slice()?.sort()?.join(",") || "ALL") + " " + full;
      if (!seen.has(key)) {
        routes.push({ path: full, methods: methods?.length ? methods : ["ALL"] });
        seen.add(key);
      }
    }

    function walkStack(stack, prefix = "") {
      if (!Array.isArray(stack)) return;
      for (const layer of stack) {
        const route = layer?.route;
        if (route?.path !== undefined) {
          const paths = Array.isArray(route.path) ? route.path : [route.path];
          const methods = Object.keys(route.methods || {}).map((m) => m.toUpperCase());
          for (const p of paths) pushRoute((prefix + (p || "/")) || "/", methods);
        }
        const handle = layer?.handle;
        const subStack = handle?.stack;
        if (Array.isArray(subStack)) {
          const layerPrefix =
            typeof layer?.path === "string"
              ? layer.path
              : (layer?.regexp && layer.regexp.fast_slash) ? "/" : "";
          walkStack(subStack, (prefix + (layerPrefix || "")) || "");
        }
      }
    }

    const rootStack = app?._router?.stack || app?.router?.stack || null;

    if (!rootStack) {
      return res.json({
        ok: true,
        note:
          "Introspección no soportada en este build, devolviendo rutas conocidas.",
        routes: [
          { path: "/health", methods: ["GET"] },
          { path: "/diag", methods: ["GET"] },
          { path: "/api/diag", methods: ["GET"] },
          { path: "/webhook_mp/__env", methods: ["GET"] },
          { path: "/api/webhook_mp/__env", methods: ["GET"] },
          { path: "/webhook_mp/__version", methods: ["GET"] },
          { path: "/webhook_mp/__selftest", methods: ["GET"] },
          { path: "/api/webhook_mp/__selftest", methods: ["GET"] },
          { path: "/webhook_mp/__writeprobe", methods: ["POST"] },
          { path: "/api/webhook_mp/__writeprobe", methods: ["POST"] },
          { path: "/api/create_preference", methods: ["POST"] },
          { path: "/api/create-preference", methods: ["POST"] },
          { path: "/api/mp/create-preference", methods: ["POST"] },
          { path: "/api/mercadopago/create-preference", methods: ["POST"] },
          { path: "/mp/create", methods: ["POST"] },
          { path: "/mp/payment/:id", methods: ["GET"] },
          { path: "/api/mp/payment/:id", methods: ["GET"] },
          { path: "/mp/order/:id", methods: ["GET"] },
          { path: "/api/mp/order/:id", methods: ["GET"] },
          { path: "/mp/payments/search", methods: ["GET"] },
          { path: "/api/mp/payments/search", methods: ["GET"] },
          { path: "/mp/preference/:id", methods: ["GET"] },
          { path: "/api/mp/preference/:id", methods: ["GET"] },
          { path: "/api/sitemap", methods: ["GET"] },
          { path: "/sitemap.xml", methods: ["GET"] },
          { path: "/pago/success", methods: ["GET"] },
          { path: "/pago/failure", methods: ["GET"] },
          { path: "/pago/pending", methods: ["GET"] },
          { path: "/webhook_mp", methods: ["POST"] },
          { path: "/api/webhook_mp", methods: ["POST"] },
          { path: "/__routes", methods: ["GET"] },
        ],
      });
    }

    walkStack(rootStack, "");
    return res.json({ ok: true, total: routes.length, routes });
  } catch (e) {
    return res.status(200).json({
      ok: true,
      note: "Introspección falló; devolviendo rutas mínimas.",
      error: String(e?.message || e),
      routes: [
        { path: "/health", methods: ["GET"] },
        { path: "/diag", methods: ["GET"] },
        { path: "/api/diag", methods: ["GET"] },
        { path: "/webhook_mp/__env", methods: ["GET"] },
        { path: "/api/webhook_mp/__env", methods: ["GET"] },
        { path: "/webhook_mp/__version", methods: ["GET"] },
        { path: "/webhook_mp/__selftest", methods: ["GET"] },
        { path: "/api/webhook_mp/__selftest", methods: ["GET"] },
        { path: "/webhook_mp/__writeprobe", methods: ["POST"] },
        { path: "/api/webhook_mp/__writeprobe", methods: ["POST"] },
        { path: "/api/create_preference", methods: ["POST"] },
        { path: "/mp/create", methods: ["POST"] },
        { path: "/mp/preference/:id", methods: ["GET"] },
      ],
    });
  }
});

// 11.5) Self-tests para webhook / Supabase (server-level, nunca 404)
app.get(["/webhook_mp/__selftest", "/api/webhook_mp/__selftest"], async (_req, res) => {
  try {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || null;
    const hasSRK = !!process.env.SUPABASE_SERVICE_ROLE || !!process.env.SUPABASE_SERVICE_ROLE_KEY;

    let headOk = null;
    let headErr = null;
    let count = null;

    if (supabaseAdmin) {
      const { error, count: c } = await supabaseAdmin
        .from("profiles")
        .select("*", { head: true, count: "estimated" });
      headOk = !error;
      headErr = error ? (error.message || String(error)) : null;
      count = typeof c === "number" ? c : null;
    }

    const mask = (s) => {
      if (!s) return null;
      const v = String(s);
      if (v.length <= 12) return v;
      return `${v.slice(0, 6)}…${v.slice(-6)}`;
    };

    return res.status(200).json({
      ok: true,
      via: "server-proxy",
      mp: { hasAccessToken: !!process.env.MP_ACCESS_TOKEN },
      supabase: {
        url,
        hasServiceRole: hasSRK,
        adminReady: !!supabaseAdmin,
        headOk,
        count,
        error: headErr,
        keyMask: mask(process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || "")
      }
    });
  } catch (e) {
    return res.status(200).json({ ok: false, via: "server-proxy", error: String(e?.message || e) });
  }
});

app.post(["/webhook_mp/__writeprobe", "/api/webhook_mp/__writeprobe"], async (_req, res) => {
  try {
    if (!supabaseAdmin) return res.status(200).json({ ok: false, reason: "no_admin_client" });
    const payload = {
      topic: "probe",
      payload: { ts: new Date().toISOString(), from: "server.__writeprobe" }
    };
    const { error } = await supabaseAdmin.from("mp_notifications").insert([payload]);
    if (error) return res.status(200).json({ ok: false, error: error.message, code: error.code });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e?.message || e) });
  }
});

// 12) 404
app.use((req, res) => res.status(404).json({ ok: false, error: "Not Found" }));

// 13) Arranque
const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`🟢 Backend activo en: http://localhost:${PORT}`)
);