// api/sitemap.ts — Edge + Supabase REST (consultas relajadas) + debug
export const config = { runtime: "edge" };

type Diag = {
  baseUrl: string;
  haveSupabaseUrl: boolean;
  haveAnonKey: boolean;
  usingDynamic: boolean;
  counts: { static: number; categories: number; businesses: number };
  catErr: string | null;
  negErr: string | null;
  sample: { categorias?: string[]; negocios?: string[] };
};

function getBaseUrl(req: Request): string {
  const envUrl = (process.env.BASE_URL || "").replace(/\/+$/, "");
  if (envUrl) return envUrl;
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host =
    req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  return `${proto}://${host}`.replace(/\/+$/, "");
}

function xmlEscape(s: string) {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** fetch con timeout (Edge) */
async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  ms = 3000,
  label = "req"
) {
  const ctrl = new AbortController();
  const id = setTimeout(
    () => ctrl.abort(`timeout:${label}:${ms}ms` as any),
    ms
  );
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

export default async function handler(req: Request): Promise<Response> {
  try {
    const SUPABASE_URL =
      process.env.SUPABASE_URL || (process.env as any).VITE_SUPABASE_URL || "";
    const SUPABASE_ANON_KEY =
      process.env.SUPABASE_ANON_KEY ||
      (process.env as any).VITE_SUPABASE_ANON_KEY ||
      "";

    const canUseSupabase = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
    const BASE_URL = getBaseUrl(req);

    const url = new URL(req.url);
    const debug = url.searchParams.get("debug") === "1";

    // URLs estáticas mínimas
    const staticUrls = [
      "/",
      "/negocios",
      "/categorias",
      "/planes",
      "/registro",
      "/terminos",
      "/privacidad",
    ];

    let categoryUrls: string[] = [];
    let businessUrls: string[] = [];
    let catErr: string | null = null;
    let negErr: string | null = null;
    let catSample: string[] | undefined;
    let negSample: string[] | undefined;

    if (canUseSupabase) {
      try {
        // -------- CATEGORÍAS (usa slug_categoria; sin filtros extra) --------
        const catUrl = new URL(`${SUPABASE_URL}/rest/v1/categorias`);
        catUrl.searchParams.set("select", "slug_categoria,nombre");
        catUrl.searchParams.set("order", "nombre.asc");
        catUrl.searchParams.set("limit", "2000");

        const catRes = await fetchWithTimeout(
          catUrl,
          {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
          },
          3000,
          "categorias"
        );

        if (!catRes.ok) {
          catErr = `HTTP ${catRes.status} ${await catRes
            .text()
            .catch(() => "")}`.slice(0, 200);
        } else {
          const cats = (await catRes.json()) as Array<{
            slug_categoria?: string;
            nombre?: string;
          }>;
          categoryUrls = (cats || [])
            .map((c) => (c.slug_categoria || "").trim())
            .filter(Boolean)
            .map((slug) => `/categorias/${slug}`);
          if (cats?.length)
            catSample = cats.slice(0, 5).map((c) => c.slug_categoria || "");
        }

        // -------- NEGOCIOS (relajado: sin is_approved/is_deleted de inicio) --------
        const negUrl = new URL(`${SUPABASE_URL}/rest/v1/negocios`);
        negUrl.searchParams.set("select", "slug,updated_at");
        negUrl.searchParams.set("slug", "not.is.null");
        negUrl.searchParams.set("order", "updated_at.desc");
        negUrl.searchParams.set("limit", "5000");

        // Si ya confirmaste que EXISTEN estas columnas en tu DB,
        // descomenta estas dos líneas para filtrar:
        // negUrl.searchParams.set("is_approved", "eq.true");
        // negUrl.searchParams.set("is_deleted", "eq.false");

        const negRes = await fetchWithTimeout(
          negUrl,
          {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
          },
          3000,
          "negocios"
        );

        if (!negRes.ok) {
          negErr = `HTTP ${negRes.status} ${await negRes
            .text()
            .catch(() => "")}`.slice(0, 200);
        } else {
          const negs = (await negRes.json()) as Array<{
            slug?: string;
            updated_at?: string;
          }>;
          businessUrls = (negs || [])
            .filter((n) => n.slug)
            .map((n) => `/negocio/${n.slug}`);
          if (negs?.length)
            negSample = negs.slice(0, 5).map((n) => n.slug || "");
        }
      } catch (e: any) {
        const msg = e?.message || String(e);
        catErr = catErr || msg;
        negErr = negErr || msg;
      }
    } else {
      catErr = "Missing SUPABASE_URL/ANON_KEY";
      negErr = "Missing SUPABASE_URL/ANON_KEY";
    }

    // ---- DEBUG JSON (sin caché) ----
    if (debug) {
      const diag: Diag = {
        baseUrl: BASE_URL,
        haveSupabaseUrl: Boolean(SUPABASE_URL),
        haveAnonKey: Boolean(SUPABASE_ANON_KEY),
        usingDynamic: canUseSupabase,
        counts: {
          static: staticUrls.length,
          categories: categoryUrls.length,
          businesses: businessUrls.length,
        },
        catErr: catErr || null,
        negErr: negErr || null,
        sample: {},
      };
      if (catSample) diag.sample.categorias = catSample;
      if (negSample) diag.sample.negocios = negSample;

      return new Response(JSON.stringify(diag, null, 2), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-cache",
        },
      });
    }

    // ---- XML ----
    const urls = [...staticUrls, ...categoryUrls, ...businessUrls];
    const today = new Date().toISOString().slice(0, 10);
    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls
        .map((u) => {
          const loc = xmlEscape(`${BASE_URL}${u}`);
          // changefreq/priority aproximados por tipo de URL
          const freq =
            u === "/"
              ? "daily"
              : u.startsWith("/negocio/")
              ? "weekly"
              : u.startsWith("/categorias/")
              ? "weekly"
              : "monthly";
          const prio =
            u === "/"
              ? "1.0"
              : u === "/negocios"
              ? "0.9"
              : u.startsWith("/categorias/")
              ? "0.7"
              : u.startsWith("/negocio/")
              ? "0.6"
              : "0.6";

          return (
            `  <url>\n` +
            `    <loc>${loc}</loc>\n` +
            `    <lastmod>${today}</lastmod>\n` +
            `    <changefreq>${freq}</changefreq>\n` +
            `    <priority>${prio}</priority>\n` +
            `  </url>`
          );
        })
        .join("\n") +
      `\n</urlset>\n`;

    return new Response(xml, {
      status: 200,
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=0, must-revalidate",
      },
    });
  } catch (_e) {
    // Fallback siempre-200 con estáticos (para no romper crawlers)
    const BASE_URL = getBaseUrl(req);
    const today = new Date().toISOString().slice(0, 10);
    const staticUrls = [
      "/",
      "/negocios",
      "/categorias",
      "/planes",
      "/registro",
      "/terminos",
      "/privacidad",
    ];
    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      staticUrls
        .map(
          (u) =>
            `  <url>\n    <loc>${xmlEscape(
              `${BASE_URL}${u}`
            )}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`
        )
        .join("\n") +
      `\n</urlset>\n`;
    return new Response(xml, {
      status: 200,
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=0, must-revalidate",
      },
    });
  }
}
