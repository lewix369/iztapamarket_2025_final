// scripts/generate-sitemap.mjs
// Carga variables de entorno (.env.local, .env.production, etc.)
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// --- Variables de entorno (acepta VITE_* o sin prefijo) ---
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const RAW_SITE_URL =
  process.env.SITE_URL ||
  process.env.PUBLIC_BASE_URL ||
  "http://localhost:5173";
const SITE_URL = RAW_SITE_URL.replace(/\/+$/, ""); // sin slash al final

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "Faltan VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY (o SUPABASE_URL/SUPABASE_ANON_KEY)"
  );
  process.exit(1);
}

// --- Cliente Supabase (anon-key, sin persistir sesión) ---
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

// --- Utils ---
function xmlEscape(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Une segmentos y evita // en el path (sin romper https://)
function normalizeUrl(base, ...parts) {
  const joined = [base, ...parts].join("/");
  return joined.replace(/([^:]\/)\/+/g, "$1");
}

function isoOrNow(value) {
  const d = value ? new Date(value) : new Date();
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

// --- Data fetch ---
async function fetchData() {
  // Categorías (slugs únicos, válidos)
  const { data: catRows, error: catErr } = await supabase
    .from("negocios")
    .select("slug_categoria")
    .eq("is_deleted", false)
    .eq("is_approved", true);

  if (catErr) throw catErr;
  const categories = [
    ...new Set((catRows || []).map((r) => r?.slug_categoria).filter(Boolean)),
  ];

  // Negocios con slug y updated_at
  const { data: bizRows, error: bizErr } = await supabase
    .from("negocios")
    .select("slug, updated_at")
    .eq("is_deleted", false)
    .eq("is_approved", true);

  if (bizErr) throw bizErr;

  // Dedup por slug y filtra vacíos
  const seen = new Set();
  const businesses = [];
  for (const row of bizRows || []) {
    if (!row?.slug) continue;
    if (seen.has(row.slug)) continue;
    seen.add(row.slug);
    businesses.push({ slug: row.slug, updated_at: row.updated_at });
  }

  return { categories, businesses };
}

// --- Build sitemap XML ---
function buildSitemap({ categories, businesses }) {
  const entries = [];

  // Home
  entries.push({
    loc: normalizeUrl(SITE_URL, ""),
    lastmod: isoOrNow(),
    priority: "1.0",
  });

  // Página de listado de negocios
  entries.push({
    loc: normalizeUrl(SITE_URL, "negocios"),
    lastmod: isoOrNow(),
    priority: "0.8",
  });

  // Categorías (lastmod genérico)
  for (const slug of categories) {
    entries.push({
      loc: normalizeUrl(SITE_URL, "categorias", encodeURIComponent(slug)),
      lastmod: isoOrNow(),
      priority: "0.7",
    });
  }

  // Negocios (lastmod individual si existe)
  for (const { slug, updated_at } of businesses) {
    entries.push({
      loc: normalizeUrl(SITE_URL, "negocio", encodeURIComponent(slug)),
      lastmod: isoOrNow(updated_at),
      priority: "0.7",
    });
  }

  // Orden estable por URL
  entries.sort((a, b) => a.loc.localeCompare(b.loc));

  const urlset = entries
    .map(
      ({ loc, lastmod, priority }) => `
  <url>
    <loc>${xmlEscape(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlset}
</urlset>`;
}

// --- Main ---
async function main() {
  try {
    const { categories, businesses } = await fetchData();
    const xml = buildSitemap({ categories, businesses });

    const outDir = path.resolve("public");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const outPath = path.join(outDir, "sitemap.xml");
    fs.writeFileSync(outPath, xml, "utf8");

    console.log(
      `✅ sitemap.xml generado en ${outPath} (${categories.length} categorías, ${businesses.length} negocios) [SITE_URL=${SITE_URL}]`
    );
  } catch (e) {
    console.error("❌ Error generando sitemap:", e);
    process.exit(1);
  }
}

main();
