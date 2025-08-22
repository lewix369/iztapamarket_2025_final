// supabase/functions/mp-webhook/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MP_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WEBHOOK_TOKEN = Deno.env.get("WEBHOOK_TOKEN") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

function mapEstado(status: string | null | undefined) {
  switch (status) {
    case "approved":
      return "aprobado";
    case "rejected":
      return "rechazado";
    case "in_process":
    case "pending":
      return "pendiente";
    default:
      return status ?? "desconocido";
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // Seguridad por token en query (?token=XYZ)
    const url = new URL(req.url);
    if (WEBHOOK_TOKEN && url.searchParams.get("token") !== WEBHOOK_TOKEN) {
      return new Response("Forbidden", { status: 403 });
    }

    const body = await req.json().catch(() => null);
    console.log("[mp-webhook] incoming:", body);

    const type = body?.type ?? body?.action ?? body?.topic ?? "";
    const id =
      body?.data?.id ??
      body?.id ??
      (typeof body?.resource === "string"
        ? body.resource.split("/").pop()
        : undefined);

    if (!id) {
      return json({ ok: true, skip: "missing id" });
    }

    // Solo manejamos eventos de pago aquí
    if (!String(type).toLowerCase().includes("payment")) {
      console.log("[mp-webhook] non-payment event:", type);
      return json({ ok: true, skip: type });
    }

    // Consulta el pago en MP
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: { Authorization: `Bearer ${MP_TOKEN}` },
    });
    const payment = await mpRes.json();
    console.log("[mp-webhook] payment lookup:", payment);

    if (!mpRes.ok) {
      console.error("[mp-webhook] mp error:", payment);
      return json({ ok: false, mp_error: payment }, 200);
    }

    const estado_pago = mapEstado(payment?.status);
    const email =
      payment?.metadata?.email ??
      payment?.external_reference ??
      payment?.payer?.email ??
      null;
    const plan_type = payment?.metadata?.plan ?? null;

    if (!email) {
      console.warn("[mp-webhook] payment without email/external_reference");
      return json({ ok: true, warn: "payment without email" });
    }

    const updates: Record<string, unknown> = {
      estado_pago,
      updated_at: new Date().toISOString(),
    };
    if (plan_type) updates.plan_type = plan_type;

    const { data, error } = await supabase
      .from("negocios")
      .update(updates)
      .eq("email", email)
      .select("id,email,plan_type,estado_pago")
      .limit(1);

    if (error) {
      console.error("[mp-webhook] supabase update error:", error);
      return json({ ok: false, error }, 200);
    }

    return json({ ok: true, updated: data?.[0] ?? null });
  } catch (e) {
    console.error("[mp-webhook] crash:", e);
    return json({ ok: false, crash: String(e) }, 200);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    headers: { "content-type": "application/json" },
    status,
  });
}
