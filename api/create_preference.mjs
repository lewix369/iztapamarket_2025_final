// api/create_preference.js
export const config = { runtime: "nodejs" };

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

const trim = (s = "") => String(s || "").trim().replace(/\/+$/, "");
const isHttps = (u = "") => /^https:\/\//i.test(u);

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, "http://localhost");
    const sp = url.searchParams;
    const forceSandbox = sp.get("sandbox") === "1" || String(req.headers["x-force-sandbox"] || "").trim() === "1";

    if (req.method !== "POST") return send(res, 405, { ok: false, error: "Method Not Allowed" });

    const MP_ACCESS_TOKEN = trim(
      process.env.MP_ACCESS_TOKEN ||
        process.env.MP_PROD_ACCESS_TOKEN ||
        process.env.MP_SANDBOX_ACCESS_TOKEN ||
        ""
    );
    if (!MP_ACCESS_TOKEN) return send(res, 500, { ok: false, error: "MP_ACCESS_TOKEN missing" });

    const body = (() => {
      try { return JSON.parse(req.body || "{}"); } catch { return req.body || {}; }
    })();

    const {
      plan,
      email,
      title = `Suscripción ${plan || ""}`,
      quantity = 1,
      unit_price,
    } = body || {};

    if (!plan || !email) return send(res, 400, { ok: false, error: "Missing plan or email" });

    const TEST_BUYER = (process.env.MP_TEST_BUYER_EMAIL || "test_user_16368732@testuser.com").trim().toLowerCase();
    const payerEmail = forceSandbox ? TEST_BUYER : String(email).trim().toLowerCase();

    // precios por plan (ajusta a tu gusto)
    const PRICE = unit_price ?? ({ pro: 50, premium: 50 }[String(plan).toLowerCase()] ?? 0);

    // back_urls desde env (ya las dejaste en vercel sin www)
    const SUCC = trim(process.env.REGISTRO_SUCCESS_URL || "");
    const FAIL = trim(process.env.REGISTRO_FAILURE_URL || "");
    const PEND = trim(process.env.REGISTRO_PENDING_URL || "");

    // webhook
    const NOTIF = trim(process.env.MP_WEBHOOK_URL || "");

    // auto_return sólo si success es https (evita invalid_auto_return)
    const back_urls =
      SUCC || FAIL || PEND
        ? { ...(SUCC && { success: SUCC }), ...(FAIL && { failure: FAIL }), ...(PEND && { pending: PEND }) }
        : undefined;

    const allowAutoReturn = back_urls?.success && isHttps(back_urls.success);

    const payload = {
      items: [
        {
          id: `plan_${plan}`,
          title,
          quantity: Number(quantity) || 1,
          unit_price: Number(PRICE) || 0,
          currency_id: "MXN",
          category_id: "services",
        },
      ],
      payer: { email: payerEmail },
      ...(back_urls ? { back_urls } : {}),
      ...(allowAutoReturn ? { auto_return: "approved" } : {}),
      ...(NOTIF ? { notification_url: NOTIF } : {}),
      external_reference: `${String(email).trim()}|${String(plan).toLowerCase()}|web`,
      metadata: { plan, email, source: "iztapamarket:vercel" },
    };

    const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    const j = await r.json().catch(() => ({}));

    if (!r.ok) {
      return send(res, 502, {
        ok: false,
        error: "Mercado Pago error",
        status: r.status,
        detail: j?.message || j?.error || "mp_error",
        cause: j?.cause || null,
      });
    }

    return send(res, 201, {
      ok: true,
      id: j.id || null,
      init_point: j.init_point || null,
      sandbox_init_point: j.sandbox_init_point || null,
      debug: {
        back_urls: back_urls || null,
        notification_url: NOTIF || null,
        env: forceSandbox ? "sandbox" : "prod",
        payer_email: payerEmail,
      },
    });
  } catch (e) {
    return send(res, 500, { ok: false, error: String(e) });
  }
}