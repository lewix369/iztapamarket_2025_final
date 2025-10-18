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
  // Vercel entrega `req.body` ya parseado si el content-type es JSON.
  // Pero si llegó como string, intentar parsear.
  let b = req.body;
  if (typeof b === "string") {
    try {
      b = JSON.parse(b);
    } catch {
      // deja como string
    }
  }
  return b || {};
}

function pickPaymentIdFromBody(body) {
  // Compat: MP puede mandar distintos formatos
  // {type:"payment", data:{ id }}, {action:"payment.updated", data:{id}},
  // {resource:"https://api.mercadopago.com/v1/payments/123"}, {id: 123}
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
  // Formato esperado (cuando lo seteamos nosotros): "email|plan|project"
  // Ser robustos si viene en otro formato o es null
  const s = (extRef || "").split("|");
  return {
    email: s[0] || null,
    plan: s[1] || null,
    project: s[2] || null,
  };
}

function buildSupabaseClients() {
  const url =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || null;

  const anon =
    process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || null;

  const service =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    null;

  // Cliente público por si lo necesitáramos (no lo usamos para writes)
  const supabase =
    url && anon ? createClient(url, anon) : null;

  // Cliente admin para writes (RLS bypass)
  const supabaseAdmin =
    url && service
      ? createClient(url, service, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : null;

  return { supabase, supabaseAdmin, url, anon, service };
}

async function fetchPaymentFromMP(paymentId) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) {
    return { ok: false, reason: "mp_access_token_missing" };
  }
  const url = `https://api.mercadopago.com/v1/payments/${encodeURIComponent(
    paymentId
  )}`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const rawText = await r.text();
  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    data = { raw: rawText };
  }

  if (!r.ok) {
    return { ok: false, reason: "mp_fetch_failed", status: r.status, data };
  }
  return { ok: true, data };
}

async function persistNotification(supabaseAdmin, body) {
  if (!supabaseAdmin) return { ok: false, reason: "no_admin_client" };
  try {
    // No conocemos todas las columnas del esquema actual, así que insertamos mínimos seguros:
    // - topic (string) si existe
    // - payload (json)
    const payload = {
      topic: body?.topic || body?.type || "payment",
      payload: body,
    };

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
      id: payment?.id ?? null, // payment_id (PK bigint)
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
      metadata_email:
        payment?.metadata?.email_for_backoffice ??
        payment?.metadata?.email ??
        null,
      email: parts.email,
      plan: parts.plan,
      project: parts.project,
      raw: payment ?? null,
      // updated_at: lo maneja trigger o default NOW() si existe
    };

    // upsert por PK (id)
    const { error } = await supabaseAdmin
      .from("mp_payments")
      .upsert([row], { onConflict: "id", ignoreDuplicates: false });

    if (error) return { ok: false, reason: "upsert_payment_failed", error };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "upsert_payment_exception", error: String(e) };
  }
}

// ---------- Handler ----------
export default async function handler(req, res) {
  // Acepta GET para health
  if (req.method === "GET") {
    const env = {
      hasAccessToken: !!process.env.MP_ACCESS_TOKEN,
      webhookUrl: process.env.MP_WEBHOOK_URL || null,
      supabaseUrl:
        process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || null,
      hasServiceRole:
        !!process.env.SUPABASE_SERVICE_ROLE || !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    };
    return sendJson(res, 200, { ok: true, webhook: "alive", env });
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
  }

  const body = parseBody(req);
  const paymentId =
    req.query?.id || pickPaymentIdFromBody(body) || null;

  // Guardar notificación cruda "best effort" (no fallar el webhook si no existe la tabla)
  const { supabaseAdmin } = buildSupabaseClients();
  await persistNotification(supabaseAdmin, body);

  if (!paymentId) {
    // No hay ID, nada que buscar: 200 para que MP no repita infinitamente,
    // pero explica el motivo
    return sendJson(res, 200, {
      ok: false,
      reason: "missing_payment_id",
      received: body,
    });
  }

  // Traer el pago real desde MP
  const fetched = await fetchPaymentFromMP(paymentId);
  if (!fetched.ok) {
    return sendJson(res, 200, {
      ok: false,
      reason: fetched.reason || "payment_not_fetched",
      status: fetched.status || null,
    });
  }

  // Persistir pago en Supabase
  const persisted = await persistPayment(supabaseAdmin, fetched.data);
  if (!persisted.ok) {
    return sendJson(res, 200, {
      ok: false,
      reason: persisted.reason || "payment_not_saved",
    });
  }

  return sendJson(res, 200, {
    ok: true,
    saved: true,
    payment_id: paymentId,
    status: fetched?.data?.status || null,
  });
}