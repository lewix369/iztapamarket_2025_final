import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";

export default function PaySuccess() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // Query params que llegan de MP en back_urls (o del FREE redirect)
  const payment_id = params.get("payment_id") || "";
  const merchant_order_id = params.get("merchant_order_id") || "";
  // usar status o collection_status (MP puede mandar cualquiera)
  const url_status = (
    params.get("status") ||
    params.get("collection_status") ||
    ""
  ).toLowerCase();
  const preference_id = params.get("preference_id") || "";
  const emailParam = params.get("email") || "";
  const planParam = (params.get("plan") || "").toLowerCase();
  const tagParam = params.get("tag") || "";

  // También intentar extraer email/plan desde external_reference: email|plan|tag
  const external_reference = params.get("external_reference") || "";
  const [extEmail, extPlan] = React.useMemo(() => {
    if (!external_reference) return ["", ""];
    const [e = "", p = ""] = external_reference.split("|");
    return [e, (p || "").toLowerCase()];
  }, [external_reference]);

  // ¿Es FREE?
  const isFree =
    planParam === "free" ||
    extPlan === "free" ||
    url_status === "free" ||
    (payment_id === "" &&
      merchant_order_id === "" &&
      (planParam === "free" || url_status === "free"));

  // Base del backend (quita /api si viene de VITE_API_BASE)
  const BACKEND_ROOT = useMemo(() => {
    const api =
      import.meta.env.VITE_API_BASE || import.meta.env.VITE_MP_BASE || "";
    const trimmed = (api || "").replace(/\/$/, "");
    return trimmed.replace(/\/api$/, "");
  }, []);

  // Feature flag: auto-login via magic link after pago aprobado
  const AUTH_AUTO_LOGIN =
    (import.meta.env.VITE_AUTH_AUTO_LOGIN || "0").toString() === "1";

  // Feature flag: permitir omitir verificación en backend (útil en SANDBOX)
  const VERIFY_MP = (import.meta.env.VITE_VERIFY_MP || "1").toString() === "1";

  // Construye redirect_to para el magic link (vuelve a este front)
  function buildRedirectTo(nextPath) {
    try {
      const base = window.location.origin.replace(/\/$/, "");
      return `${base}/auth/callback?next=${encodeURIComponent(
        nextPath || "/mi-negocio"
      )}`;
    } catch {
      return "/auth/callback";
    }
  }

  // Supabase (frontend: SIEMPRE con anon key)
  const supabase = useMemo(() => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key, { auth: { persistSession: true } });
  }, []);

  // Pide magic link al backend y hace redirect si hay action_link
  async function tryAutoMagicLink(email, nextPath) {
    if (!email) return false;
    if (!BACKEND_ROOT) return false;
    try {
      // El endpoint diag vive en la raíz del backend (no en /api)
      const backendRoot = BACKEND_ROOT;
      const redirect = buildRedirectTo(nextPath);
      const url = `${backendRoot}/diag/magic-link?email=${encodeURIComponent(
        email
      )}&redirect=${encodeURIComponent(redirect)}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const j = await res.json().catch(() => ({}));
      if (j?.action_link) {
        // redirige a Supabase (volverá a /auth/callback?next=...)
        window.location.assign(j.action_link);
        return true;
      }
    } catch (e) {
      console.warn("tryAutoMagicLink error:", e);
    }
    return false;
  }

  // Estado de verificación real con el backend
  // now supports: "approved" | "pending" | "failed" | "error" | null
  const [verified, setVerified] = useState(null);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regMsg, setRegMsg] = useState(""); // mensaje corto del registro en supabase

  async function getJSON(url) {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error || data?.message || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // 0) Atajo FREE: no consultar backend/MP
  useEffect(() => {
    if (!isFree) return;
    // Simula un objeto "details" mínimo para el registro
    const fake = {
      id: `FREE-${tagParam || Date.now()}`,
      status: "approved",
      transaction_amount: 0,
      // FREE es anónimo: sin correo
      additional_info: {
        items: [{ title: "Plan FREE IztapaMarket" }],
        payer: { first_name: "FREE" },
      },
    };
    setDetails(fake);
    setVerified("approved");
    setLoading(false);
  }, [isFree, tagParam, emailParam, extEmail]);

  // Helpers de veredicto
  const WAIT_STATUSES = useMemo(
    () => new Set(["authorized", "in_process", "pending", "in_mediation"]),
    []
  );

  function verdictFromPayment(pmt) {
    const s = String(pmt?.status || "").toLowerCase();
    if (s === "approved") return "approved";
    if (WAIT_STATUSES.has(s)) return "pending";
    return "failed";
  }

  function verdictFromOrder(ord) {
    // Si hay pagos aprobados en la orden
    const hasApproved =
      Array.isArray(ord?.payments) &&
      ord.payments.some((p) => String(p?.status).toLowerCase() === "approved");
    if (hasApproved) return "approved";

    // ⚡ FIX: la orden a veces tarda en reflejar pagos.
    // Si venimos con payment_id y la URL trae approved, damos por aprobado.
    if (
      String(ord?.order_status || "").toLowerCase() === "payment_required" &&
      payment_id &&
      url_status === "approved"
    ) {
      return "approved";
    }

    // Si la orden sigue esperando pago
    const os = String(ord?.order_status || "").toLowerCase();
    if (os === "payment_required") return "pending";

    // Si el primer pago está en espera
    const firstStatus =
      Array.isArray(ord?.payments) && ord.payments[0]?.status
        ? String(ord.payments[0].status).toLowerCase()
        : "";
    if (WAIT_STATUSES.has(firstStatus)) return "pending";

    return "failed";
  }

  // 0.5) Atajo local: si la URL ya viene con approved/success, marcar aprobado al instante
  // (evita esperar el polling cuando MP ya nos redirigió con estado final)
  useEffect(() => {
    if (isFree) return; // FREE ya tiene su propio atajo arriba
    // Sólo al montar: si trae approved/success y al menos algún id de referencia, damos por bueno
    const urlApproved = url_status === "approved" || url_status === "success";
    const hasAnyRef = Boolean(payment_id || merchant_order_id || preference_id);
    if (urlApproved && hasAnyRef) {
      const minimal = {
        id: payment_id || merchant_order_id || preference_id || "url-approved",
        status: "approved",
        payer: { email: (emailParam || extEmail || "").toLowerCase() },
        additional_info: {
          items: [
            {
              title: `Plan ${
                (planParam || extPlan || "").toLowerCase().includes("premium")
                  ? "premium"
                  : planParam || extPlan || "pro"
              }`,
            },
          ],
          payer: { email: (emailParam || extEmail || "").toLowerCase() },
        },
      };
      setDetails(minimal);
      setVerified("approved");
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // 1) Verificación de pago en backend (resiliente + polling corto)
  useEffect(() => {
    // FREE no verifica con MP; y si VERIFY_MP=0 (sandbox), saltamos verificación
    if (isFree || !VERIFY_MP) return;
    let cancelled = false;

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    function fmtDate(d) {
      const iso = new Date(d).toISOString();
      return iso.replace(/\.\d{3}Z$/, "Z");
    }

    // fetch que distingue 404 para poder “caer” a otras rutas
    async function getMaybe(url) {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (res.status === 404) return { notFound: true };
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(
          data?.error || data?.message || `HTTP ${res.status}`
        );
        err.status = res.status;
        throw err;
      }
      return { data };
    }

    // reintentos exponenciales para errores (excepto 404)
    async function tryWithBackoff(fn, { tries = 5, baseDelay = 500 } = {}) {
      let lastErr;
      for (let i = 0; i < tries; i++) {
        try {
          const out = await fn();
          if (out?.notFound) return out; // 404: corta y deja caer al siguiente plan
          return out; // ok
        } catch (e) {
          lastErr = e;
          if (e?.status === 404) return { notFound: true }; // corta
          await sleep(baseDelay * Math.pow(2, i)); // 500,1000,2000,4000,8000
        }
      }
      if (lastErr) throw lastErr;
    }

    // Poll cuando exista respuesta pero no esté aprobada aún
    async function pollUntilStable(fetchFn, readVerdict, { tries, delay }) {
      let lastRes = null;
      for (let i = 0; i < tries; i++) {
        const res = await fetchFn();
        if (res?.notFound) return res;
        lastRes = res;

        const v = readVerdict(res.data);
        if (v === "approved" || v === "failed") return res; // terminal
        // pending → esperar y volver a preguntar
        await sleep(delay);
      }
      // se agotó el polling: devolver lo último (puede seguir pending)
      return lastRes || (await fetchFn());
    }

    (async () => {
      try {
        setLoading(true);
        const base = BACKEND_ROOT || window.location.origin;

        // 1) Directo por payment_id (con polling si no está approved aún)
        if (payment_id) {
          const paymentCall = () =>
            getMaybe(`${base}/mp/payment/${encodeURIComponent(payment_id)}`);

          const res = await pollUntilStable(
            () => tryWithBackoff(paymentCall, { tries: 2, baseDelay: 700 }),
            verdictFromPayment,
            { tries: 6, delay: 1200 } // ~6–8s en total
          );
          if (cancelled) return;

          if (res?.data) {
            const data = res.data;
            setDetails(data);
            setVerified(verdictFromPayment(data));
            setLoading(false);
            return;
          }
          // si 404, continuar
        }

        // 2) Por merchant_order_id (con polling buscando pagos aprobados)
        if (merchant_order_id) {
          const orderCall = () =>
            getMaybe(
              `${base}/mp/order/${encodeURIComponent(merchant_order_id)}`
            );

          const res = await pollUntilStable(
            () => tryWithBackoff(orderCall, { tries: 2, baseDelay: 700 }),
            verdictFromOrder,
            { tries: 6, delay: 1200 }
          );
          if (cancelled) return;

          if (res?.data) {
            const order = res.data;
            setDetails(order);
            setVerified(verdictFromOrder(order));
            setLoading(false);
            return;
          }
        }

        // 3) Fallback: buscar por external_reference (últimos 7 días)
        if (external_reference) {
          const now = new Date();
          const begin = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

          const qs = new URLSearchParams({
            external_reference,
            range: "date_created",
            begin_date: fmtDate(begin),
            end_date: fmtDate(now),
            sort: "date_created",
            criteria: "desc",
            limit: "1",
            offset: "0",
          }).toString();

          const searchCall = () => getMaybe(`${base}/mp/payments/search?${qs}`);
          const res = await pollUntilStable(
            () => tryWithBackoff(searchCall, { tries: 2, baseDelay: 800 }),
            // results[0] es un payment
            (d) => verdictFromPayment((d?.results || [])[0]),
            { tries: 5, delay: 1300 }
          );
          if (cancelled) return;

          const payment =
            res?.data && Array.isArray(res.data?.results)
              ? res.data.results[0]
              : null;

          if (payment) {
            setDetails(payment);
            setVerified(verdictFromPayment(payment));
            setLoading(false);
            return;
          }
        }

        // 4) Sin forma de verificar
        setVerified("error");
        setLoading(false);
      } catch (err) {
        console.error("Verificación de pago (resiliente+polling) falló:", err);
        if (!cancelled) {
          setVerified("error");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [BACKEND_ROOT, payment_id, merchant_order_id, external_reference, isFree]);

  // 2) Registro/Upsert en Supabase + redirección al formulario
  useEffect(() => {
    let cancelled = false;

    async function upsertProfileAndRedirect({ plan, email, paidFlag }) {
      // FREE: sin login, sin supabase, sin email; redirige directo al formulario
      if (String(plan).toLowerCase() === "free") {
        navigate(`/registro?plan=free`, { replace: true });
        return;
      }
      if (!supabase) return;
      if (!email) return;
      const now = new Date().toISOString();
      try {
        await supabase
          .from("profiles")
          .upsert(
            { email: email.toLowerCase(), plan_type: plan, updated_at: now },
            { onConflict: "email" }
          );
      } catch (e) {
        console.warn("profiles upsert warn:", e?.message || e);
      }

      // Guardar por si el usuario regresa
      try {
        localStorage.setItem("reg_email", email.toLowerCase());
        localStorage.setItem("reg_plan", plan);
      } catch {}

      // Si está habilitado el autologin y NO hay usuario autenticado:
      // ⚠️ FREE NUNCA debe iniciar sesión automáticamente.
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (AUTH_AUTO_LOGIN && !user && String(plan).toLowerCase() !== "free") {
          const nextPath = `/registro?plan=${encodeURIComponent(
            plan
          )}&email=${encodeURIComponent(email)}${
            paidFlag ? `&paid=${encodeURIComponent(paidFlag)}` : ""
          }`;
          const launched = await tryAutoMagicLink(email, nextPath);
          if (launched) return; // dejamos que redirija hacia Supabase
        }
      } catch {}

      const qs = new URLSearchParams({ plan, email });
      if (paidFlag) qs.set("paid", paidFlag);
      // Nota: usamos replace para no dejar al usuario en /pago/success al volver atrás
      navigate(`/registro?${qs.toString()}`, { replace: true });
    }

    async function run() {
      if (verified !== "approved") return; // solo actuamos con pago/aprobado/free
      if (!supabase) {
        setRegMsg("Supabase no configurado en el frontend.");
        return;
      }

      // Resolver email
      const payerEmail = (
        emailParam ||
        extEmail ||
        localStorage.getItem("reg_email") ||
        localStorage.getItem("correo_negocio") ||
        details?.payer?.email ||
        details?.additional_info?.payer?.email ||
        ""
      )
        .trim()
        .toLowerCase();

      // Resolver plan
      const title0 = details?.additional_info?.items?.[0]?.title || "";
      const inferredFromTitle = title0.toLowerCase().includes("premium")
        ? "premium"
        : "pro";
      const planDetected = isFree
        ? "free"
        : (planParam || extPlan || inferredFromTitle || "pro").toLowerCase();

      // FREE => upsert inmediato + redirect sin paid
      if (isFree) {
        setRegMsg("¡Plan FREE activado!");
        if (!cancelled) {
          await upsertProfileAndRedirect({ plan: "free" });
        }
        return;
      }

      // PRO/PREMIUM => upsert inmediato + redirect con paid=approved
      try {
        setRegMsg("Pago confirmado. Activando plan en tu cuenta…");
        if (!cancelled) {
          await upsertProfileAndRedirect({
            plan: planDetected === "premium" ? "premium" : "pro",
            email: payerEmail,
            paidFlag: "approved",
          });
        }
      } catch (e) {
        console.error("Upsert/redirect error:", e);
        setRegMsg("No se pudo activar el plan automáticamente.");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [
    verified,
    details,
    planParam,
    emailParam,
    supabase,
    extEmail,
    extPlan,
    isFree,
    navigate,
  ]);

  // Helper: vincula propietario logueado a negocio (idempotente)
  async function linkOwnerIfLoggedIn(supabase, negocioId) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // ¿Ya existe el vínculo?
      const { data: exists } = await supabase
        .from("negocio_propietarios")
        .select("id")
        .eq("user_id", user.id)
        .eq("negocio_id", negocioId)
        .maybeSingle();
      if (exists) return;

      await supabase
        .from("negocio_propietarios")
        .insert([{ user_id: user.id, negocio_id: negocioId }]);
    } catch (e) {
      console.warn("linkOwnerIfLoggedIn error:", e);
    }
  }

  const headerText = isFree
    ? "¡Plan FREE activado!"
    : verified === "approved"
    ? "¡Pago aprobado!"
    : verified === "pending"
    ? "Pago en proceso"
    : verified === "failed"
    ? "No pudimos confirmar tu pago"
    : verified === "error"
    ? "Error al verificar tu pago"
    : "Verificando pago…";

  const headerColor =
    isFree || verified === "approved"
      ? "text-green-600"
      : verified === "pending"
      ? "text-amber-600"
      : verified === "failed"
      ? "text-amber-600"
      : verified === "error"
      ? "text-red-600"
      : "text-gray-600";

  const emailToShow =
    emailParam ||
    extEmail ||
    localStorage.getItem("reg_email") ||
    localStorage.getItem("correo_negocio") ||
    "";

  return (
    <div className="max-w-lg mx-auto p-6 bg-white shadow rounded mt-10">
      <h1 className={`text-2xl font-bold ${headerColor}`}>{headerText}</h1>
      <p className="mt-3 text-gray-700">
        {isFree
          ? "Tu plan FREE fue activado sin necesidad de pago."
          : loading
          ? "Consultando con el sistema de pagos…"
          : verified === "approved"
          ? "Tu pago se registró correctamente."
          : verified === "pending"
          ? "Recibimos la redirección y tu pago está en proceso. Si ya te cargó, se reflejará en breve."
          : verified === "failed"
          ? "Recibimos la redirección, pero tu pago no aparece aprobado. Si ya te cargó, se reflejará en unos minutos."
          : verified === "error"
          ? "Ocurrió un problema al validar el pago. Intenta más tarde o contáctanos."
          : "Procesando…"}
      </p>

      {regMsg && (
        <div className="mt-2 text-sm">
          <b>Registro:</b> {regMsg}
        </div>
      )}

      <div className="mt-4 text-sm text-gray-600 space-y-1">
        <div>
          <b>Status (URL):</b> {url_status || "(sin dato)"}
          {(isFree || verified) && (
            <span>
              {" "}
              — verificado: <b>{isFree ? "free" : verified}</b>
            </span>
          )}
        </div>
        {payment_id && !isFree && (
          <div>
            <b>Payment ID:</b> {payment_id}
          </div>
        )}
        {merchant_order_id && !isFree && (
          <div>
            <b>Merchant Order ID:</b> {merchant_order_id}
          </div>
        )}
        {preference_id && !isFree && (
          <div>
            <b>Preference ID:</b> {preference_id}
          </div>
        )}
        {external_reference && (
          <div>
            <b>External reference:</b> {external_reference}
          </div>
        )}
        {!isFree && emailToShow && (
          <div>
            <b>Email:</b> {emailToShow}
          </div>
        )}
        {(planParam || extPlan || isFree) && (
          <div>
            <b>Plan:</b> {isFree ? "free" : planParam || extPlan}
          </div>
        )}
        {isFree && tagParam && (
          <div>
            <b>Tag:</b> {tagParam}
          </div>
        )}
      </div>

      {details && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm underline">
            Ver respuesta del backend
          </summary>
          <pre className="mt-2 bg-gray-50 p-3 rounded text-xs overflow-auto">
            {JSON.stringify(details, null, 2)}
          </pre>
        </details>
      )}

      <div className="mt-6 flex gap-3">
        <Link
          to="/mi-negocio"
          className="px-4 py-2 bg-black text-white rounded"
        >
          Ir a mi negocio
        </Link>
        <Link to="/" className="px-4 py-2 border rounded">
          Inicio
        </Link>
      </div>
    </div>
  );
}
