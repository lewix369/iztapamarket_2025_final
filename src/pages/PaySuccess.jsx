import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";

export default function PaySuccess() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // --- Params que llegan en back_urls / redirects de MP ---
  const payment_id =
    params.get("payment_id") || params.get("collection_id") || "";
  const merchant_order_id = params.get("merchant_order_id") || "";
  const url_status = (
    params.get("status") || params.get("collection_status") || ""
  ).toLowerCase();
  const preference_id = params.get("preference_id") || "";
  const emailParam = params.get("email") || "";
  const planParam = (params.get("plan") || "").toLowerCase();
  const tagParam = params.get("tag") || "";
  const external_reference = params.get("external_reference") || "";

  // email|plan|tag desde external_reference (normaliza también el email a minúsculas)
  const [extEmail, extPlan] = React.useMemo(() => {
    if (!external_reference) return ["", ""];
    const [e = "", p = ""] = external_reference.split("|");
    return [e.toLowerCase(), (p || "").toLowerCase()];
  }, [external_reference]);

  // ¿Es FREE?
  const isFree =
    planParam === "free" ||
    extPlan === "free" ||
    url_status === "free" ||
    (payment_id === "" &&
      merchant_order_id === "" &&
      (planParam === "free" || url_status === "free"));

  // Base del backend (acepta relativo o absoluto) — con fallback local robusto
  const API_BASE = useMemo(() => {
    const api = (import.meta.env.VITE_API_BASE || import.meta.env.VITE_MP_BASE || "").trim();
    if (!api) {
      // Fallback seguro para dev local si no vienen variables
      return "http://127.0.0.1:3001/api";
    }
    if (/^https?:\/\//i.test(api)) return api.replace(/\/$/, "");
    const origin = (typeof window !== "undefined" ? window.location.origin : "").replace(/\/$/, "");
    return `${origin}${api.startsWith("/") ? "" : "/"}${api}`.replace(/\/$/, "");
  }, []);

  // Feature flags
  const AUTH_AUTO_LOGIN =
    (import.meta.env.VITE_AUTH_AUTO_LOGIN || "0").toString() === "1";
  const VERIFY_MP = (import.meta.env.VITE_VERIFY_MP || "1").toString() === "1";

  // Supabase (frontend)
  const supabase = useMemo(() => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key, { auth: { persistSession: true } });
  }, []);

  const tryAutoMagicLink = React.useCallback(
    async (email, nextPath) => {
      if (!email || !API_BASE) return false;
      try {
        const base = window.location.origin.replace(/\/$/, "");
        const redirect = `${base}/auth/callback?next=${encodeURIComponent(
          nextPath || "/mi-negocio"
        )}`;
        const cacheBuster = `ts=${Date.now()}`;
        const url =
          `${API_BASE}/diag/magic-link?email=${encodeURIComponent(email)}` +
          `&redirect=${encodeURIComponent(redirect)}&__sw_bypass=1&${cacheBuster}`;

        const res = await fetch(url, {
          headers: { Accept: "application/json" },
          cache: "no-store",
          credentials: "omit",
        });

        const contentType = res.headers.get("content-type") || "";
        const body = contentType.includes("application/json")
          ? await res.json().catch(() => ({}))
          : await res.text();

        if (typeof body === "string") return false;
        if (body?.action_link) {
          window.location.assign(body.action_link);
          return true;
        }
      } catch (e) {
        console.warn("tryAutoMagicLink error:", e);
      }
      return false;
    },
    [API_BASE]
  );

  // --- Estado de verificación ---
  const [verified, setVerified] = useState(null); // "approved" | "pending" | "failed" | "error" | null
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regMsg, setRegMsg] = useState("");

  const safeNavigate = React.useCallback(
    (path) => {
      try {
        window.__ps_redirected = true;
        if (window.__ps_timer) {
          clearTimeout(window.__ps_timer);
          window.__ps_timer = null;
        }
      } catch {}
      navigate(path, { replace: true });
    },
    [navigate]
  );

  // 0) Atajo FREE
  useEffect(() => {
    if (!isFree) return;
    const fake = {
      id: `FREE-${tagParam || Date.now()}`,
      status: "approved",
      transaction_amount: 0,
      additional_info: {
        items: [{ title: "Plan FREE IztapaMarket" }],
        payer: { first_name: "FREE" },
      },
    };
    setDetails(fake);
    setVerified("approved");
    setLoading(false);
  }, [isFree, tagParam]);

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

  const verdictFromOrder = React.useCallback((ord) => {
    const hasApproved =
      Array.isArray(ord?.payments) &&
      ord.payments.some((p) => String(p?.status).toLowerCase() === "approved");
    if (hasApproved) return "approved";

    const os = String(ord?.order_status || "").toLowerCase();
    if (os === "payment_required") return "pending";

    const firstStatus =
      Array.isArray(ord?.payments) && ord.payments[0]?.status
        ? String(ord.payments[0].status).toLowerCase()
        : "";
    if (WAIT_STATUSES.has(firstStatus)) return "pending";

    return "failed";
  }, [WAIT_STATUSES]);

  // 0.5) Si la URL ya vino con approved/success, redirigir de inmediato a /registro con plan/email saneados
  useEffect(() => {
    if (isFree) return;

    const urlApproved = url_status === "approved" || url_status === "success";
    const hasAnyRef = Boolean(
      payment_id || merchant_order_id || preference_id || external_reference
    );
    if (!urlApproved || !hasAnyRef) return;

    // Recupera y normaliza plan/email desde URL o localStorage (fallback)
    const rawPlan =
      (planParam || extPlan || localStorage.getItem("reg_plan") || "pro").toLowerCase();
    const planF = rawPlan.includes("premium") ? "premium" : rawPlan || "pro";

    const emailF = (
      emailParam ||
      extEmail ||
      localStorage.getItem("reg_email") ||
      ""
    )
      .toString()
      .trim()
      .toLowerCase();

    // Toma todos los parámetros actuales y fuerza los que necesitamos
    const q = new URLSearchParams(window.location.search);
    q.set("plan", planF);
    if (emailF) q.set("email", emailF);
    q.set("paid", "approved");

    // Evitar bucles de navegación
    try {
      if (window.__ps_redirected) return;
      window.__ps_redirected = true;
      if (window.__ps_timer) {
        clearTimeout(window.__ps_timer);
        window.__ps_timer = null;
      }
    } catch {}

    // Redirección inmediata al formulario
    safeNavigate(`/registro?${q.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isFree,
    url_status,
    payment_id,
    merchant_order_id,
    preference_id,
    external_reference,
    emailParam,
    extEmail,
    planParam,
    extPlan,
    navigate,
  ]);

  // 1) Verificación real con backend (polling corto)
  useEffect(() => {
    if (isFree || !VERIFY_MP) return;
    let cancelled = false;

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    function fmtDate(d) {
      const iso = new Date(d).toISOString();
      return iso.replace(/\.\d{3}Z$/, "Z");
    }

    async function getMaybe(url) {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (res.status === 404) return { notFound: true };
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(data?.error || data?.message || `HTTP ${res.status}`);
        err.status = res.status;
        throw err;
      }
      return { data };
    }

    async function tryWithBackoff(fn, { tries = 5, baseDelay = 500 } = {}) {
      let lastErr;
      for (let i = 0; i < tries; i++) {
        try {
          const out = await fn();
          if (out?.notFound) return out;
          return out;
        } catch (e) {
          lastErr = e;
          if (e?.status === 404) return { notFound: true };
          await sleep(baseDelay * Math.pow(2, i));
        }
      }
      if (lastErr) throw lastErr;
    }

    async function pollUntilStable(fetchFn, readVerdict, { tries, delay }) {
      let lastRes = null;
      for (let i = 0; i < tries; i++) {
        const res = await fetchFn();
        if (res?.notFound) return res;
        lastRes = res;

        const v = readVerdict(res.data);
        if (v === "approved" || v === "failed") return res;
        await sleep(delay);
      }
      return lastRes || (await fetchFn());
    }

    (async () => {
      try {
        setLoading(true);
        const base = API_BASE || window.location.origin;

        // 1) payment_id directo
        if (payment_id) {
          const paymentCall = () =>
            getMaybe(`${base}/mp/payment/${encodeURIComponent(payment_id)}`);

          const res = await pollUntilStable(
            () => tryWithBackoff(paymentCall, { tries: 2, baseDelay: 700 }),
            verdictFromPayment,
            { tries: 6, delay: 1200 }
          );
          if (cancelled) return;

          if (res?.data) {
            const data = res.data;
            setDetails(data);
            setVerified(verdictFromPayment(data));
            setLoading(false);
            return;
          }
        }

        // 2) merchant_order_id
        if (merchant_order_id) {
          const orderCall = () =>
            getMaybe(`${base}/mp/order/${encodeURIComponent(merchant_order_id)}`);

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

        // 3) fallback por external_reference
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

        setVerified("error");
        setLoading(false);
      } catch (err) {
        console.error("Verificación de pago falló:", err);
        if (!cancelled) {
          setVerified("error");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [API_BASE, payment_id, merchant_order_id, external_reference, isFree, VERIFY_MP, verdictFromOrder, verdictFromPayment]);

  // 🚀 Opción 3: autologin local si es correo de prueba (testuser) y pago aprobado
  useEffect(() => {
    const email =
      (emailParam || extEmail || details?.payer?.email || "").toLowerCase();

    const approvedByUrl =
      url_status === "approved" || url_status === "success";
    const approved = approvedByUrl || verified === "approved";

    if (!approved || !email) return;

    if (email.includes("testuser")) {
      try {
        localStorage.setItem("auth_email", email);
        localStorage.setItem("reg_email", email);
        localStorage.setItem(
          "reg_plan",
          (planParam || extPlan || "pro").toLowerCase()
        );
      } catch {}

      try {
        window.__ps_redirected = true;
        if (window.__ps_timer) {
          clearTimeout(window.__ps_timer);
          window.__ps_timer = null;
        }
      } catch {}

      navigate("/mi-negocio", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verified, url_status, emailParam, extEmail, details, planParam, extPlan, navigate]);

  // 2) Upsert en Supabase + redirección al formulario/mi-negocio
  useEffect(() => {
    async function upsertProfileAndRedirect({ plan, email, paidFlag }) {
      if (String(plan).toLowerCase() === "free") {
        safeNavigate(`/registro?plan=free`);
        return;
      }
      if (!supabase || !email) return;
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

      try {
        localStorage.setItem("reg_email", email.toLowerCase());
        localStorage.setItem("reg_plan", plan);
      } catch {}

      let hasBusiness = false;
      const normalizedEmail = email.toLowerCase();
      try {
        const { data: negociosRows, error: negociosErr } = await supabase
          .from("negocios")
          .select("id")
          .eq("email", normalizedEmail)
          .limit(1);
        if (!negociosErr && Array.isArray(negociosRows) && negociosRows.length > 0) {
          hasBusiness = true;
        }
      } catch (e) {
        console.warn("check negocio by email warn:", e?.message || e);
      }

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (AUTH_AUTO_LOGIN && !user && String(plan).toLowerCase() !== "free") {
          const nextPath = hasBusiness
            ? "/mi-negocio"
            : `/registro?plan=${encodeURIComponent(
                plan
              )}&email=${encodeURIComponent(normalizedEmail)}${
                paidFlag ? `&paid=${encodeURIComponent(paidFlag)}` : ""
              }`;
          const launched = await tryAutoMagicLink(email, nextPath);
          if (launched) {
            try {
              window.__ps_redirected = true;
              if (window.__ps_timer) {
                clearTimeout(window.__ps_timer);
                window.__ps_timer = null;
              }
            } catch {}
            return;
          }
        }
      } catch {}

      const qs = new URLSearchParams({ plan, email: normalizedEmail });
      if (paidFlag) qs.set("paid", paidFlag);

      if (hasBusiness) {
        safeNavigate("/mi-negocio");
      } else {
        safeNavigate(`/registro?${qs.toString()}`);
      }
    }

    async function run() {
      if (verified !== "approved") return;
      if (!supabase) {
        setRegMsg("Supabase no configurado en el frontend.");
        return;
      }

      // 🔒 Normalización única y ordenada del email del pagador
      const payerEmail =
        [
          emailParam,
          extEmail,
          details?.payer?.email,
          details?.additional_info?.payer?.email,
          localStorage.getItem("reg_email"),
          localStorage.getItem("correo_negocio"),
        ].find(Boolean)?.toString().trim().toLowerCase() || "";

      const title0 = details?.additional_info?.items?.[0]?.title || "";
      const inferredFromTitle =
        title0.toLowerCase().includes("premium") ? "premium" : "pro";
      const planDetected = isFree
        ? "free"
        : (planParam || extPlan || inferredFromTitle || "pro").toLowerCase();

      if (isFree) {
        setRegMsg("¡Plan FREE activado!");
        await upsertProfileAndRedirect({ plan: "free" });
        return;
      }

      try {
        setRegMsg("Pago confirmado. Activando plan en tu cuenta…");
        await upsertProfileAndRedirect({
          plan: planDetected === "premium" ? "premium" : "pro",
          email: payerEmail,
          paidFlag: "approved",
        });
      } catch (e) {
        console.error("Upsert/redirect error:", e);
        setRegMsg("No se pudo activar el plan automáticamente.");
      }
    }

    run();
    // No cleanup needed since there is no cancellation logic
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
    AUTH_AUTO_LOGIN,
    safeNavigate,
    tryAutoMagicLink,
  ]);

  // --- UI ---
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

      <div className="mt-6 flex gap-3">
        <Link
          to="/mi-negocio"
          onClick={() => {
            try {
              window.__ps_redirected = true;
              if (window.__ps_timer) {
                clearTimeout(window.__ps_timer);
                window.__ps_timer = null;
              }
            } catch {}
          }}
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