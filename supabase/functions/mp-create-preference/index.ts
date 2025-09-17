// Supabase Edge Function: mp-create-preference
// Creates a Mercado Pago checkout preference and returns init_point
// Expected JSON body: { email: string, plan: 'pro' | 'premium' }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") ?? "";
const SUCCESS_URL = Deno.env.get("REGISTRO_SUCCESS_URL") ?? "";
const FAILURE_URL = Deno.env.get("REGISTRO_FAILURE_URL") ?? "";
const PENDING_URL = Deno.env.get("REGISTRO_PENDING_URL") ?? "";

const MP_API = "https://api.mercadopago.com/checkout/preferences";

// Prices in MXN — adjust as needed
const PLAN_PRICES: Record<string, number> = {
  pro: 300,
  premium: 500,
};

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers || {}) },
  });
}

Deno.serve(async (req) => {
  if (req.method === "GET") {
    return json({ ok: true, message: "mp-create-preference up" });
  }

  if (req.method !== "POST") {
    return json({ error: "Method Not Allowed" }, { status: 405 });
  }

  try {
    const { email, plan = "premium" } = (await req
      .json()
      .catch(() => ({}))) as { email?: string; plan?: string };

    if (!MP_ACCESS_TOKEN)
      return json({ error: "Missing MP_ACCESS_TOKEN" }, { status: 500 });
    if (!SUCCESS_URL || !FAILURE_URL || !PENDING_URL)
      return json({ error: "Missing redirect URLs in env" }, { status: 500 });

    if (!email) return json({ error: "Email requerido" }, { status: 400 });

    const normalizedPlan = String(plan).toLowerCase();
    const unit_price = PLAN_PRICES[normalizedPlan] ?? PLAN_PRICES.premium;

    const body = {
      items: [
        {
          title: `Plan ${normalizedPlan} IztapaMarket`,
          quantity: 1,
          currency_id: "MXN",
          unit_price,
        },
      ],
      payer: { email },
      back_urls: {
        success: `${SUCCESS_URL}?plan=${normalizedPlan}&email=${encodeURIComponent(
          email
        )}`,
        failure: `${FAILURE_URL}?plan=${normalizedPlan}&email=${encodeURIComponent(
          email
        )}`,
        pending: `${PENDING_URL}?plan=${normalizedPlan}&email=${encodeURIComponent(
          email
        )}`,
      },
      auto_return: "approved",
      metadata: { email, plan: normalizedPlan, source: "supabase-fn" },
      statement_descriptor: "IZTAPAMARKET",
    };

    const mpRes = await fetch(MP_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await mpRes.json();
    if (!mpRes.ok) {
      console.error("MercadoPago error:", data);
      return json(
        { error: data?.message || "MercadoPago error" },
        { status: 502 }
      );
    }

    const init_point = data.init_point || data.sandbox_init_point;
    return json({ id: data.id, init_point });
  } catch (e) {
    console.error("mp-create-preference internal error", e);
    return json({ error: "Internal error" }, { status: 500 });
  }
});
