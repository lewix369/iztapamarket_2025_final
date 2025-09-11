// api/sitemap.ts — Edge + Supabase REST + timeouts + fallback (no SDK imports)
export const config = { runtime: "edge" };

type Diag = {
  baseUrl: string;
  haveSupabaseUrl: boolean;
  haveAnonKey: boolean;
  usingDynamic: boolean;
  counts?: { static: number; categories: number; businesses: number };
  catErr?: string | null;
  negErr?: string | null;
  sample?: { categorias?: string[]; negocios?: string[] };
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

/** Small helper to fetch with timeout in Edge runtime */
async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  ms = 3000,
  label = "req"
) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(`timeout:${label}:${ms}ms`), ms);
  try {
    const res = await fetch(input, { ...init, signal: ctrl.signal });
    return res;
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

    const staticUrls = [
      "/",
      "/planes",
      "/registro",
      "/terminos",
      "/privacidad",
      "/negocios",
      "/categorias",
    ];

    let categoryUrls: string[] = [];
    let businessUrls: string[] = [];
    let catErr: string | null = null;
    let negErr: string | null = null;
    let catSample: string[] | undefined;
    let negSample: string[] | undefined;

    if (canUseSupabase) {
      try {
        // Categorías
        const catUrl = new URL(`${SUPABASE_URL}/rest/v1/categorias`);
        catUrl.searchParams.set("select", "slug_categoria,nombre");
        catUrl.searchParams.set("slug_categoria", "not.is.null");
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
            .map((c) => {
              const slug = (c.slug_categoria || c.nombre || "").trim();
              return slug ? `/categorias/${slug}` : "";
            })
            .filter(Boolean);
          if (cats?.length) {
            catSample = cats
              .slice(0, 5)
              .map((c) => c.slug_categoria || c.nombre || "");
          }
        }

        // Negocios
        const negUrl = new URL(`${SUPABASE_URL}/rest/v1/negocios`);
        negUrl.searchParams.set(
          "select",
          "slug,updated_at,is_approved,is_deleted"
        );
        negUrl.searchParams.set("is_approved", "eq.true");
        negUrl.searchParams.set("is_deleted", "eq.false");
        negUrl.searchParams.set("slug", "not.is.null");
        negUrl.searchParams.set("order", "updated_at.desc");
        negUrl.searchParams.set("limit", "5000");
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
          if (negs?.length) {
            negSample = negs.slice(0, 5).map((n) => n.slug || "");
          }
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

    if (debug) {
      const diag = {
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
        sample: {
          categorias: catSample,
          negocios: negSample,
        },
      };
      return new Response(JSON.stringify(diag, null, 2), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-cache",
        },
      });
    }

    const urls = [...staticUrls, ...categoryUrls, ...businessUrls];
    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls
        .map(
          (u) =>
            `  <url>\n    <loc>${xmlEscape(`${BASE_URL}${u}`)}</loc>\n  </url>`
        )
        .join("\n") +
      `\n</urlset>\n`;

    return new Response(xml, {
      status: 200,
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "no-cache",
      },
    });
  } catch (fatal: any) {
    // Static fallback — always 200 for crawlers
    const BASE_URL = getBaseUrl(req);
    const staticUrls = [
      "/",
      "/planes",
      "/registro",
      "/terminos",
      "/privacidad",
      "/negocios",
      "/categorias",
    ];
    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      staticUrls
        .map(
          (u) =>
            `  <url>\n    <loc>${xmlEscape(`${BASE_URL}${u}`)}</loc>\n  </url>`
        )
        .join("\n") +
      `\n</urlset>\n`;
    return new Response(xml, {
      status: 200,
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "no-cache",
      },
    });
  }
}
