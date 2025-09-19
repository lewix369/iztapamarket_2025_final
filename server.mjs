// ================================
// server.mjs  —  Backend Express
// ================================

// 1) ENV (.env.production por defecto, sobreescribible con DOTENV_CONFIG_PATH)
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
const myEnv = dotenv.config({
  path: process.env.DOTENV_CONFIG_PATH || ".env.production",
});
try {
  dotenvExpand.expand(myEnv);
} catch (_) {
  // ignore
}

// 2) Deps de servidor
import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

// 3) Router del webhook (tu handler robusto ya vive ahí)
import webhookMpRouter from "./src/lib/api/routes/webhookMercadoPago.mjs";

// 4) App base
const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json()); // cuerpo JSON por defecto

// 5) Healthcheck
app.get("/health", (_req, res) => res.status(200).json({ ok: true }));

// 6) Supabase "anon" para sitemap (solo lectura)
//    *NO* es el Service Role; ese lo usa tu router del webhook internamente.
const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

// 7) Crear preferencia de Mercado Pago (server-side)
//    Usa la `notification_url` del body si viene (para túneles), si no usa env.
app.post("/api/create_preference", async (req, res) => {
  try {
    const {
      title = "Plan Premium",
      price = 199,
      quantity = 1,
      currency_id = "MXN",
      external_reference,
      notification_url: notificationUrlFromBody,
    } = req.body || {};
    const payer_email = req.body?.payer_email;
    const binary_mode = Boolean(req.body?.binary_mode);

    const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
    const NOTIF_URL = notificationUrlFromBody || process.env.MP_WEBHOOK_URL;
    const BACK_SUCCESS = process.env.REGISTRO_SUCCESS_URL || "";
    const BACK_FAILURE = process.env.REGISTRO_FAILURE_URL || "";
    const BACK_PENDING = process.env.REGISTRO_PENDING_URL || "";

    if (!MP_ACCESS_TOKEN) {
      return res
        .status(500)
        .json({ error: "MP_ACCESS_TOKEN ausente en el backend" });
    }
    if (!NOTIF_URL) {
      return res
        .status(400)
        .json({ error: "notification_url faltante (body o env)" });
    }

    const mpResp = await fetch(
      "https://api.mercadopago.com/checkout/preferences",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [
            {
              title,
              unit_price: Number(price),
              quantity: Number(quantity),
              currency_id,
            },
          ],
          back_urls: {
            success: BACK_SUCCESS,
            failure: BACK_FAILURE,
            pending: BACK_PENDING,
          },
          payer: payer_email ? { email: payer_email } : undefined,
          binary_mode,
          notification_url: NOTIF_URL,
          external_reference: external_reference || undefined,
          auto_return: "approved",
        }),
      }
    );

    const data = await mpResp.json();
    if (!mpResp.ok) {
      console.error("[MP create_preference] Error:", data);
      return res.status(502).json({
        error: "Mercado Pago no aceptó la preferencia",
        details: data,
      });
    }

    // Devolver tal cual, incluye init_point y sandbox_init_point
    return res.status(200).json(data);
  } catch (err) {
    console.error("[/api/create_preference] Exception:", err?.message || err);
    return res.status(500).json({ error: "Fallo al crear preferencia" });
  }
});

// 8) Sitemap dinámico (SEO) — usa Supabase anon si está configurado
app.get("/api/sitemap", async (req, res) => {
  try {
    const proto = (
      req.headers["x-forwarded-proto"] ||
      req.protocol ||
      "http"
    ).toString();
    const host = (
      req.headers["x-forwarded-host"] ||
      req.get("host") ||
      "localhost:3000"
    ).toString();
    const BASE_URL = `${proto}://${host}`.replace(/\/+$/, "");

    const xmlEscape = (s = "") =>
      String(s)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const today = new Date().toISOString().split("T")[0];

    const urls = [
      { path: "/", changefreq: "daily", priority: "1.0", lastmod: today },
      {
        path: "/negocios",
        changefreq: "daily",
        priority: "0.9",
        lastmod: today,
      },
      {
        path: "/categorias",
        changefreq: "weekly",
        priority: "0.7",
        lastmod: today,
      },
      {
        path: "/planes",
        changefreq: "monthly",
        priority: "0.8",
        lastmod: today,
      },
      {
        path: "/registro",
        changefreq: "monthly",
        priority: "0.7",
        lastmod: today,
      },
      {
        path: "/terminos",
        changefreq: "yearly",
        priority: "0.3",
        lastmod: today,
      },
      {
        path: "/privacidad",
        changefreq: "yearly",
        priority: "0.3",
        lastmod: today,
      },
    ];

    if (supabase) {
      try {
        // Categorías
        const { data: categorias, error: catErr } = await supabase
          .from("categorias")
          .select("slug, slug_categoria, nombre")
          .limit(2000);
        if (!catErr && Array.isArray(categorias)) {
          categorias.forEach((cat) => {
            const slug = (cat?.slug || cat?.slug_categoria || cat?.nombre || "")
              .toString()
              .trim();
            if (slug) {
              urls.push({
                path: `/categorias/${slug}`,
                changefreq: "weekly",
                priority: "0.7",
                lastmod: today,
              });
            }
          });
        }

        // Negocios
        const { data: negocios, error: bizErr } = await supabase
          .from("negocios")
          .select("slug, updated_at")
          .eq("is_deleted", false)
          .eq("is_approved", true)
          .limit(5000);
        if (!bizErr && Array.isArray(negocios)) {
          negocios.forEach((biz) => {
            if (biz?.slug) {
              urls.push({
                path: `/negocio/${biz.slug}`,
                changefreq: "weekly",
                priority: "0.6",
                lastmod: biz?.updated_at
                  ? new Date(biz.updated_at).toISOString().split("T")[0]
                  : today,
              });
            }
          });
        }
      } catch (e) {
        console.warn(
          "[sitemap] enriquecimiento dinámico falló:",
          e?.message || e
        );
      }
    }

    if (req.query.debug === "1") {
      return res.status(200).json({
        baseUrl: BASE_URL,
        total: urls.length,
        sample: urls.slice(0, 10),
      });
    }

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls
        .map((u) => {
          const loc = xmlEscape(`${BASE_URL}${u.path}`);
          const lastmod = xmlEscape(u.lastmod || today);
          return (
            `  <url>\n` +
            `    <loc>${loc}</loc>\n` +
            (u.changefreq
              ? `    <changefreq>${xmlEscape(u.changefreq)}</changefreq>\n`
              : "") +
            (u.priority
              ? `    <priority>${xmlEscape(u.priority)}</priority>\n`
              : "") +
            `    <lastmod>${lastmod}</lastmod>\n` +
            `  </url>`
          );
        })
        .join("\n") +
      `\n</urlset>`;

    res
      .status(200)
      .set("Content-Type", "application/xml; charset=utf-8")
      .set("Cache-Control", "public, max-age=3600")
      .send(xml);
  } catch (e) {
    console.error("❌ Error generando sitemap:", e?.message || e);
    res.status(500).send("Error generando sitemap");
  }
});

// Alias para crawlers
app.get("/sitemap.xml", (_req, res) => {
  res.redirect(301, "/api/sitemap");
});

// 9) Monta tu router del Webhook de Mercado Pago
//    (tu router ya hace express.json y toda la lógica robusta)
app.use("/webhook_mp", webhookMpRouter);

// 10) 404 (después de TODAS las rutas)
app.use((req, res) => res.status(404).json({ ok: false, error: "Not Found" }));

// 11) Arranque
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🟢 Backend activo en: http://localhost:${PORT}`);
});
