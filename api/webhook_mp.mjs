// api/webhook_mp.mjs
// ✅ Mercado Pago webhook (Vercel runtime, Node.js)
// - Acepta POSTs de Mercado Pago
// - Obtiene el pago real con MP_ACCESS_TOKEN
// - Guarda/actualiza en Supabase: mp_payments
// - Guarda la notificación cruda en mp_notifications (si existe)
// - Siempre responde 200 para evitar reintentos infinitos, pero reporta "ok:false" en el JSON cuando algo falla.

export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

// ---------- Utils ----------
function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj, null, 2));
}

function parseBody(req) {
  let b = req.body;
  if (typeof b === "string") {
    try { b = JSON.parse(b); } catch { /* leave as string */ }
  }
  return b || {};
}

function pickPaymentIdFromBody(body) {
  const fromData = body?.data?.id || body?.id;
  if (fromData) return String(fromData);
  const resUrl = body?.resource || body?.data?.resource;
  if (resUrl && typeof resUrl === "string") {
    const last = resUrl.split("/").pop();
    if (last) return String(last);
  }
  return null;
}

function splitExternalReference(extRef) {
  const s = (extRef || "").split("|");
  return { email: s[0] || null, plan: s[1] || null, project: s[2] || null };
}

function deriveEmailAndPlanFromPayment(payment) {
  const parts = splitExternalReference(payment?.external_reference);
  const md = payment?.metadata || {};
  const fromMetadata =
    md.contact_email ||
    md.email_for_backoffice ||
    md.email ||
    null;

  const fromPayer = payment?.payer?.email || null;

  const email =
    (fromMetadata ||
      parts.email ||
      fromPayer ||
      null);

  const plan =
    md.plan_type ||
    parts.plan ||
    (payment?.description && payment.description.toLowerCase().includes("premium")
      ? "premium"
      : null) ||
    "premium";

  return {
    email: email ? String(email).toLowerCase() : null,
    plan_type: plan,
    raw: { parts, md, fromPayer },
  };
}

function buildSupabaseClients() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || null;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || null;
  const service =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    null;

  const supabase = url && anon ? createClient(url, anon) : null;
  const supabaseAdmin =
    url && service ? createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } }) : null;

  return { supabase, supabaseAdmin, url, anon, service };
}

async function fetchPaymentFromMP(paymentId) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return { ok: false, reason: "mp_access_token_missing" };

  const r = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const rawText = await r.text();
  let data;
  try { data = JSON.parse(rawText); } catch { data = { raw: rawText }; }

  if (!r.ok) return { ok: false, reason: "mp_fetch_failed", status: r.status, data };
  return { ok: true, data };
}

async function persistNotification(supabaseAdmin, body) {
  if (!supabaseAdmin) return { ok: false, reason: "no_admin_client" };
  try {
    const payload = { topic: body?.topic || body?.type || "payment", payload: body };
    const { error } = await supabaseAdmin.from("mp_notifications").insert([payload]);
    if (error) return { ok: false, reason: "insert_notification_failed", error };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "insert_notification_exception", error: String(e) };
  }
}

async function persistPayment(supabaseAdmin, payment) {
  if (!supabaseAdmin) return { ok: false, reason: "no_admin_client" };
  try {
    const parts = splitExternalReference(payment?.external_reference);
    const row = {
      id: payment?.id ?? null,
      status: payment?.status ?? null,
      status_detail: payment?.status_detail ?? null,
      live_mode: payment?.live_mode ?? null,
      transaction_amount: payment?.transaction_amount ?? null,
      currency_id: payment?.currency_id ?? null,
      payment_type_id: payment?.payment_type_id ?? null,
      payment_method_id: payment?.payment_method_id ?? null,
      external_reference: payment?.external_reference ?? null,
      preference_id: payment?.preference_id ?? null,
      order_id: payment?.order?.id ?? payment?.order_id ?? null,
      payer_email: payment?.payer?.email ?? null,
      metadata_email: payment?.metadata?.email_for_backoffice ?? payment?.metadata?.email ?? null,
      email: parts.email,
      plan: parts.plan,
      project: parts.project,
      raw: payment ?? null,
    };

    const { error } = await supabaseAdmin
      .from("mp_payments")
      .upsert([row], { onConflict: "id", ignoreDuplicates: false });

    if (error) return { ok: false, reason: "upsert_payment_failed", error };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "upsert_payment_exception", error: String(e) };
  }
}

async function persistBusinessPago(supabaseAdmin, payment) {
  if (!supabaseAdmin) {
    return { ok: false, reason: "no_admin_client" };
  }

  const { email, plan_type } = deriveEmailAndPlanFromPayment(payment);

  if (!email) {
    return { ok: false, reason: "no_email_for_pago" };
  }

  const row = {
    payment_id: String(payment.id),
    status: payment.status || null,
    amount: payment.transaction_amount ?? null,
    plan_pago: plan_type || null,
    email,
  };

  try {
    const { data, error } = await supabaseAdmin
      .from("pagos")
      .upsert(row, { onConflict: "payment_id" })
      .select("id, negocio_id")
      .single();

    if (error) {
      console.error("webhook_mp: pagos upsert error", error);
      return { ok: false, reason: "pagos_upsert_failed", error };
    }

    return {
      ok: true,
      pago_id: data?.id || null,
      negocio_id: data?.negocio_id || null,
    };
  } catch (e) {
    console.error("webhook_mp: pagos upsert exception", e);
    return { ok: false, reason: "pagos_upsert_exception", error: String(e) };
  }
}

async function syncProfileAndBusiness(supabaseAdmin, payment) {
  if (!supabaseAdmin) {
    return { ok: false, reason: "no_admin_client" };
  }

  const { email, plan_type } = deriveEmailAndPlanFromPayment(payment);

  if (!email) {
    return { ok: false, reason: "no_email_for_payment" };
  }

  const wantsPaid = ["pro", "premium"].includes(plan_type);

  // 1) Buscar profile por email
  let user_id = null;
  let profileId = null;

  try {
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email, plan_type")
      .eq("email", email)
      .maybeSingle();

    if (profileErr) {
      console.error("webhook_mp: profile lookup error", profileErr);
    }

    if (profile) {
      profileId = profile.id;
      user_id = profile.id;
      // asegurar plan_type premium/pro si aplica
      if (wantsPaid && profile.plan_type !== plan_type) {
        const { error: updProfileErr } = await supabaseAdmin
          .from("profiles")
          .update({ plan_type })
          .eq("id", profile.id);
        if (updProfileErr) {
          console.error("webhook_mp: profile plan_type update error", updProfileErr);
        }
      }
    }
  } catch (e) {
    console.error("webhook_mp: profile lookup exception", e);
  }

  // 2) Buscar negocio existente por owner_email
  let negocio = null;
  try {
    const { data: negocios, error: negErr } = await supabaseAdmin
      .from("negocios")
      .select("id, owner_email, owner_user_id, user_id, plan_type, status, estado_pago")
      .eq("owner_email", email)
      .order("created_at", { ascending: false })
      .limit(1);

    if (negErr) {
      console.error("webhook_mp: negocios lookup error", negErr);
    } else if (negocios && negocios.length > 0) {
      negocio = negocios[0];
    }
  } catch (e) {
    console.error("webhook_mp: negocios lookup exception", e);
  }

  const updatePayload = {
    estado_pago: payment.status || "approved",
    status: "active",
    payment_id: payment.id || null,
    external_reference: payment.external_reference || null,
    preference_id: payment.preference_id || null,
    merchant_order_id:
      (payment.order && payment.order.id) ||
      payment.order_id ||
      null,
  };

  // Respetar constraint: premium/pro requieren user_id, free requiere user_id NULL.
  if (wantsPaid && user_id) {
    updatePayload.plan_type = plan_type;
    updatePayload.user_id = user_id;
    updatePayload.owner_user_id = user_id;
  } else if (!wantsPaid) {
    updatePayload.plan_type = "free";
    updatePayload.user_id = null;
    updatePayload.owner_user_id = null;
  }

  // 3) Si ya existe negocio → actualizarlo
  if (negocio && negocio.id) {
    // Si quiere plan de pago pero no hay user_id, NO rompas el constraint: solo guarda pago y estado.
    if (wantsPaid && !user_id) {
      const safePayload = {
        estado_pago: updatePayload.estado_pago,
        status: updatePayload.status,
        payment_id: updatePayload.payment_id,
        external_reference: updatePayload.external_reference,
        preference_id: updatePayload.preference_id,
        merchant_order_id: updatePayload.merchant_order_id,
      };
      const { error: updNoUserErr } = await supabaseAdmin
        .from("negocios")
        .update(safePayload)
        .eq("id", negocio.id);
      if (updNoUserErr) {
        console.error("webhook_mp: negocios update (no user) error", updNoUserErr);
        return { ok: false, reason: "negocio_update_no_user_failed" };
      }
      return {
        ok: true,
        mode: "updated_without_user",
        negocioId: negocio.id,
        wantsPaid,
        hasUser: false,
      };
    }

    const { error: updErr } = await supabaseAdmin
      .from("negocios")
      .update(updatePayload)
      .eq("id", negocio.id);

    if (updErr) {
      console.error("webhook_mp: negocios update error", updErr);
      return { ok: false, reason: "negocio_update_error" };
    }

    return {
      ok: true,
      mode: "updated",
      negocioId: negocio.id,
      email,
      plan_type: updatePayload.plan_type || negocio.plan_type,
    };
  }

  // 4) Si no hay negocio previo y tenemos user_id y plan de pago → crearlo premium
  if (wantsPaid && user_id) {
    const insertPayload = {
      nombre: `Negocio ${email}`,
      owner_email: email,
      user_id,
      owner_user_id: user_id,
      plan_type: plan_type,
      status: "active",
      estado_pago: payment.status || "approved",
      is_approved: true,
      payment_id: payment.id || null,
      external_reference: payment.external_reference || null,
      preference_id: payment.preference_id || null,
      merchant_order_id:
        (payment.order && payment.order.id) ||
        payment.order_id ||
        null,
    };

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("negocios")
      .insert(insertPayload)
      .select("id")
      .single();

    if (insErr) {
      console.error("webhook_mp: negocios insert error", insErr);
      return { ok: false, reason: "negocio_insert_error" };
    }

    return {
      ok: true,
      mode: "created",
      negocioId: inserted.id,
      email,
      plan_type,
    };
  }

  // 5) Sin negocio y sin user_id: no forzamos nada para no violar constraint
  return {
    ok: true,
    mode: "noop",
    reason: "no_negocio_or_user_for_paid_plan",
    email,
    plan_type,
  };
}

// ---------- Handler ----------
async function webhookMpHandler(req, res) {
  if (req.method === "GET") {
    const env = {
      hasAccessToken: !!process.env.MP_ACCESS_TOKEN,
      webhookUrl: process.env.MP_WEBHOOK_URL || null,
      supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || null,
      hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE || !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    };
    return sendJson(res, 200, { ok: true, webhook: "alive", env });
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
  }

  const body = parseBody(req);
  const paymentId = req.query?.id || pickPaymentIdFromBody(body) || null;

  const { supabaseAdmin } = buildSupabaseClients();
  await persistNotification(supabaseAdmin, body);

  if (!paymentId) {
    return sendJson(res, 200, { ok: false, reason: "missing_payment_id", received: body });
  }

  const fetched = await fetchPaymentFromMP(paymentId);
  if (!fetched.ok) {
    return sendJson(res, 200, { ok: false, reason: fetched.reason || "payment_not_fetched", status: fetched.status || null });
  }

  const persisted = await persistPayment(supabaseAdmin, fetched.data);
  if (!persisted.ok) {
    return sendJson(res, 200, {
      ok: false,
      reason: persisted.reason || "payment_not_saved",
      payment_id: paymentId,
      status: fetched?.data?.status || null,
    });
  }

  let sync = { ok: false, reason: "not_run" };
  let pago = { ok: false, reason: "not_run" };

  if (fetched?.data?.status === "approved") {
    try {
      pago = await persistBusinessPago(supabaseAdmin, fetched.data);
    } catch (e) {
      console.error("webhook_mp: persistBusinessPago exception", e);
      pago = { ok: false, reason: "pagos_exception", error: String(e) };
    }

    try {
      sync = await syncProfileAndBusiness(supabaseAdmin, fetched.data);
    } catch (e) {
      console.error("webhook_mp: syncProfileAndBusiness exception", e);
      sync = { ok: false, reason: "sync_exception", error: String(e) };
    }
  }

  return sendJson(res, 200, {
    ok: true,
    saved: true,
    payment_id: paymentId,
    status: fetched?.data?.status || null,
    pago,
    sync,
  });
}

export default webhookMpHandler;