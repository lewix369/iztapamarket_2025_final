// api/diag.mjs
export const config = { runtime: "nodejs" };

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}

export default async function handler(req, res) {
  try {
    return send(res, 200, {
      ok: true,
      project: "IztapaMarket",
      region: process.env.VERCEL_REGION || "local",
      mp: {
        hasAccessToken: !!process.env.MP_ACCESS_TOKEN,
        webhook: process.env.MP_WEBHOOK_URL || null
      },
      site: {
        base: process.env.PUBLIC_BASE_URL || process.env.SITE_BASE_URL || null
      }
    });
  } catch (e) {
    return send(res, 500, { ok: false, error: String(e) });
  }
}
