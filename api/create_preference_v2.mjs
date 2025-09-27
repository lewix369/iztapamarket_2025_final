import fetch from "node-fetch";

/**
 * Crea una preferencia de pago (MP Checkout v1).
 * - Usa MP_ACCESS_TOKEN del entorno (sandbox/prod según tu .env)
 * - Devuelve { ok:true, id, init_point, sandbox_init_point }
 */
export default async function createPreferenceV2(req, res) {
  try {
    // 1) Token (idéntico a /diag/mp-sanity)
    const rawToken = (
      process.env.MP_ACCESS_TOKEN ||
      process.env.MP_SANDBOX_ACCESS_TOKEN ||
      process.env.MP_PROD_ACCESS_TOKEN ||
      ""
    ).trim();

    if (!rawToken) {
      console.error("[MP:v2] missing MP access token");
      return res.status(500).json({
        ok: false,
        error: "MP token missing",
      });
    }

    // Log corto para verificar que es el mismo token que /diag
    console.log("[MP:v2] token sanity", {
      prefix: rawToken.slice(0, 8), // "TEST-USR" o "APP_USR-"
      suffix: rawToken.slice(-6),
      len: rawToken.length,
    });

    // === Env awareness (sandbox/prod) & default test buyer for sandbox ===
    const ENV = (String(process.env.MP_ENV || "") || "sandbox").toLowerCase();
    const TEST_BUYER = (
      process.env.MP_TEST_BUYER_EMAIL || "TESTUSER16368732@testuser.com"
    )
      .trim()
      .toLowerCase();

    // 2) Body (plan/email obligatorios)
    const {
      plan,
      email,
      userId,
      title = `Suscripción ${plan || ""}`,
      quantity = 1,
      unit_price, // opcional: si no viene, lo define el plan
    } = req.body || {};

    // En SANDBOX forzamos el comprador de prueba para que las tarjetas test (APRO) pasen.
    const payerEmail = (ENV === "sandbox" ? TEST_BUYER : String(email || ""))
      .trim()
      .toLowerCase();

    if (!plan || !email) {
      return res.status(400).json({
        ok: false,
        error: "Missing plan or email",
      });
    }

    // 3) Precio por plan (fallback)
    const PLAN_PRICES = {
      free: 0,
      pro: 300,
      premium: 500,
    };
    const price = Number(
      unit_price ?? PLAN_PRICES[String(plan).toLowerCase()] ?? 0
    );

    // 4) back_urls y webhook (mismo mecanismo que /diag)
    const trim = (s = "") => s.replace(/\/+$/, "");
    const FE = trim(process.env.FRONTEND_URL || "");
    const PB = trim(process.env.PUBLIC_BASE_URL || "");

    // Preferir FRONTEND_URL HTTPS para permitir auto_return; si no hay, caer a overrides/HTTP
    const isHttps = (u = "") => /^https:\/\//i.test(u);
    const pickUrl = (path) => {
      const fe = FE ? `${FE}${path}` : "";
      const pb = PB ? `${PB}${path}` : "";

      // 1) Si FRONTEND_URL es https, usarla primero
      if (isHttps(fe)) return fe;

      // 2) Si hay override explícito por env, usarlo (puede ser http en local)
      //    NOTA: para cada path se pasa la variable correspondiente más abajo
      return { fe, pb };
    };

    const successOverride = (process.env.REGISTRO_SUCCESS_URL || "").trim();
    const failureOverride = (process.env.REGISTRO_FAILURE_URL || "").trim();
    const pendingOverride = (process.env.REGISTRO_PENDING_URL || "").trim();

    const pickedSuccess = pickUrl("/pago/success");
    const pickedFailure = pickUrl("/pago/failure");
    const pickedPending = pickUrl("/pago/pending");

    const success = isHttps(pickedSuccess)
      ? pickedSuccess
      : successOverride || pickedSuccess.fe || pickedSuccess.pb || "";
    const failure = isHttps(pickedFailure)
      ? pickedFailure
      : failureOverride || pickedFailure.fe || pickedFailure.pb || "";
    const pending = isHttps(pickedPending)
      ? pickedPending
      : pendingOverride || pickedPending.fe || pickedPending.pb || "";

    const notification_url =
      process.env.MP_WEBHOOK_URL || (PB ? `${PB}/webhook_mp` : "") || undefined;

    // back_urls con email/plan para que PaySuccess resuelva sin polling
    const addParams = (u, extra = {}) => {
      if (!u) return "";
      try {
        const url = new URL(u);
        Object.entries(extra).forEach(([k, v]) => {
          if (v !== undefined && v !== null && String(v).trim() !== "") {
            url.searchParams.set(k, String(v));
          }
        });
        return url.toString();
      } catch {
        // fallback para URLs no absolutas
        const qs = new URLSearchParams(
          Object.fromEntries(
            Object.entries(extra).filter(
              ([, v]) =>
                v !== undefined && v !== null && String(v).trim() !== ""
            )
          )
        ).toString();
        return qs ? `${u}${u.includes("?") ? "&" : "?"}${qs}` : u;
      }
    };

    const successW = addParams(success, { email, plan });
    const failureW = addParams(failure, { email, plan });
    const pendingW = addParams(pending, { email, plan });

    const back_urls =
      successW || failureW || pendingW
        ? {
            ...(successW ? { success: successW } : {}),
            ...(failureW ? { failure: failureW } : {}),
            ...(pendingW ? { pending: pendingW } : {}),
          }
        : undefined;

    // Sólo habilitar auto_return si existe success HTTPS (sandbox/prod) para evitar "invalid_auto_return"
    const allowAutoReturn =
      !!(back_urls && back_urls.success) &&
      /^https:\/\//i.test(back_urls.success);

    console.log("[MP:v2] creating preference", {
      env: ENV,
      payer_email: payerEmail,
      item_id: `plan_${plan}`,
      category_id: "services",
      price,
      back_urls,
      allowAutoReturn,
      notification_url, // log the exact URL we are sending
    });

    // 5) Payload MP
    const payload = {
      items: [
        {
          id: `plan_${plan}`,
          title,
          description: `Plan ${plan} IztapaMarket`,
          quantity: Number(quantity) || 1,
          unit_price: price,
          currency_id: "MXN",
          category_id: "services",
        },
      ],
      payer: { email: payerEmail },
      ...(back_urls ? { back_urls } : {}),
      ...(allowAutoReturn ? { auto_return: "approved" } : {}),
      notification_url,
      external_reference: `${email}|${plan}|iztapa`,
      metadata: {
        plan,
        userId: userId || null,
        source: "iztapamarket:v2",
        email_for_backoffice: email,
      },
    };

    // 6) Llamada a MP (con Authorization: Bearer)
    const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${rawToken}`,
      },
      body: JSON.stringify(payload),
    });

    const j = await r.json().catch(() => ({}));

    try {
      if (j && (j.site_id || j.id)) {
        console.log("[MP:v2] preference created", {
          id: j.id || null,
          site_id: j.site_id || null,
          collector_id: j.collector_id || null,
          has_init_point: Boolean(j.init_point || j.sandbox_init_point),
        });
      }
    } catch {}

    if (!r.ok) {
      console.error("[MP:v2] MP error", {
        status: r.status,
        message: j.message,
        error: j.error,
        cause: j.cause,
      });
      return res.status(500).json({
        ok: false,
        error: "Error creando preferencia",
        detail: j.message || j.error || "mp_error",
        cause: j.cause || null,
      });
    }

    // 7) Respuesta compacta para el frontend Wallet
    return res.status(201).json({
      ok: true,
      id: j.id || null,
      site_id: j.site_id || null,
      collector_id: j.collector_id || null,
      init_point: j.init_point || null,
      sandbox_init_point: j.sandbox_init_point || null,
      debug: {
        notification_url: notification_url || null,
        back_urls: back_urls || null,
        env: ENV,
        price,
      },
    });
  } catch (e) {
    console.error("[MP:v2] exception", e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
