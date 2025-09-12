/* ================================
   404 para rutas no definidas (debe ir DESPUÉS de tus rutas)
================================ */
/* ================================
   Sitemap dinámico (SEO)
=============================== */
// IMPORTANTE: esta ruta debe declararse DESPUÉS de `const app = express()`
// y ANTES del middleware 404.
// --- IMPORTS (deben ir hasta arriba) ---
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import express from "express"; // <— IMPORTA EXPRESS ANTES DE USAR app
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

// .env
const myEnv = dotenv.config({
  path: process.env.DOTENV_CONFIG_PATH || ".env.production",
});
dotenvExpand.expand(myEnv);

// --- CREA LA APP (después de los imports) ---
const app = express();
// Middlewares básicos
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Supabase (solo lectura para sitemap)
const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

// Healthcheck rápido
app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/api/sitemap", async (req, res) => {
  try {
    // Base URL dinámica (respeta proxies / prod)
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

    // util: escapar entidades XML
    const xmlEscape = (s = "") =>
      String(s)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const today = new Date().toISOString().split("T")[0];

    // páginas estáticas mínimas
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

    // Enriquecimiento dinámico desde Supabase si el cliente está disponible
    if (supabase) {
      try {
        // Categorías (tolerante a distintos esquemas: slug, slug_categoria o nombre)
        const { data: categorias, error: catErr } = await supabase
          .from("categorias")
          .select("slug, slug_categoria, nombre")
          .limit(2000);

        if (catErr) {
          console.warn("[sitemap] categorias error:", catErr.message);
        } else {
          (categorias || []).forEach((cat) => {
            const slug = (cat?.slug || cat?.slug_categoria || cat?.nombre || "")
              .toString()
              .trim();
            if (!slug) return;
            urls.push({
              path: `/categorias/${slug}`,
              changefreq: "weekly",
              priority: "0.7",
              lastmod: today,
            });
          });
        }

        // Negocios aprobados y no eliminados
        const { data: negocios, error: bizErr } = await supabase
          .from("negocios")
          .select("slug, updated_at")
          .eq("is_deleted", false)
          .eq("is_approved", true)
          .limit(5000);

        if (bizErr) {
          console.warn("[sitemap] negocios error:", bizErr.message);
        } else {
          (negocios || []).forEach((biz) => {
            if (!biz?.slug) return;
            urls.push({
              path: `/negocio/${biz.slug}`,
              changefreq: "weekly",
              priority: "0.6",
              lastmod: biz?.updated_at
                ? new Date(biz.updated_at).toISOString().split("T")[0]
                : today,
            });
          });
        }
      } catch (dynErr) {
        console.warn(
          "[sitemap] fallo al enriquecer dinámicamente:",
          dynErr?.message || dynErr
        );
      }
    }

    // Soporta modo debug opcional para inspección rápida
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

// Alias clásico para crawlers
app.get("/sitemap.xml", (_req, res) => {
  res.redirect(301, "/api/sitemap");
});
/* ================================
   END Sitemap dinámico (SEO)
=============================== */
/* ================================
   Arranque del servidor
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🟢 Backend activo en: http://localhost:${PORT}`);
});
