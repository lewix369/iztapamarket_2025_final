
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { sendWelcomeEmail as sendWelcomeEmailApi } from "@/lib/emailClient";

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
  const emailParam = (params.get("email") || "").toLowerCase();
  const planParam = (params.get("plan") || "").toLowerCase();
  const tagParam = params.get("tag") || "";
  const external_reference = params.get("external_reference") || "";

  const urlApproved = url_status === "approved" || url_status === "success";
  const urlLooksApproved = urlApproved;

  // ✅ Permitir pruebas manuales SOLO en local/dev (evita bypass en producción)
  const ALLOW_MANUAL_SUCCESS = useMemo(() => {
    const flag = (import.meta.env.VITE_ALLOW_MANUAL_SUCCESS || "0").toString() === "1";
    if (flag) return true;
    if (typeof window === "undefined") return false;
    const h = window.location.hostname;
    return h === "localhost" || h === "127.0.0.1" || h.endsWith(".local");
  }, []);

  // email|plan|tag desde external_reference (normaliza también el email a minúsculas)
  const [extEmail, extPlan] = useMemo(() => {
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

  // ¿La URL trae alguna referencia real de MP?
  const hasAnyRef = useMemo(
    () =>
      Boolean(
        (payment_id && payment_id !== "") ||
          (merchant_order_id && merchant_order_id !== "") ||
          (preference_id && preference_id !== "") ||
          (external_reference && external_reference !== "")
      ),
    [payment_id, merchant_order_id, preference_id, external_reference]
  );

  // Base del backend (acepta relativo o absoluto) — con fallback local robusto
  const API_BASE = useMemo(() => {
    let api =
      (import.meta.env.VITE_API_BASE || import.meta.env.VITE_MP_BASE || "").trim();

    // Caso Vercel: viene "/api" → lo tratamos como no configurado,
    // así forzamos usar directamente el backend de Render en producción.
    if (api === "/api") {
      api = "";
    }

    // 1) Si viene algo en env, lo normalizamos
    if (api) {
      if (/^https?:\/\//i.test(api)) return api.replace(/\/$/, "");
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      return `${origin.replace(/\/$/, "")}${
        api.startsWith("/") ? "" : "/"
      }${api}`.replace(/\/$/, "");
    }

    // 2) Si estamos en dominio público, apuntamos directo al backend de Render
    if (
      typeof window !== "undefined" &&
      window.location.hostname.includes("iztapamarket.com")
    ) {
      return "https://iztapamarket-2025-final.onrender.com/api";
    }

    // 3) Fallback para desarrollo local
    return "http://127.0.0.1:3001/api";
  }, []);

  // 🔔 Helper para enviar email de bienvenida (pro/premium) usando emailClient
  const sendWelcomeEmail = useCallback(
    async ({ email }) => {
      if (!email) return;
      try {
        const result = await sendWelcomeEmailApi({ to: email });

        if (!result?.ok) {
          console.error("[WelcomeEmail] Error al enviar correo:", result);
        } else {
          console.log("[WelcomeEmail] ✅ Enviado a", email);
        }
      } catch (e) {
        console.warn("[WelcomeEmail] ❌ Excepción enviando correo:", e);
      }
    },
    [sendWelcomeEmailApi]
  );

  // Feature flags
  const AUTH_AUTO_LOGIN =
    (import.meta.env.VITE_AUTH_AUTO_LOGIN || "0").toString() === "1";
  const VERIFY_MP =
    (import.meta.env.VITE_VERIFY_MP || "1").toString() === "1";

  // Supabase (frontend)
  const supabase = useMemo(() => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key, { auth: { persistSession: true } });
  }, []);

  const tryAutoMagicLink = useCallback(
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

  const safeNavigate = useCallback(
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

  const verdictFromOrder = useCallback(
    (ord) => {
      const hasApproved =
        Array.isArray(ord?.payments) &&
        ord.payments.some(
          (p) => String(p?.status).toLowerCase() === "approved"
        );
      if (hasApproved) return "approved";

      const os = String(ord?.order_status || "").toLowerCase();
      if (os === "payment_required") return "pending";

      const firstStatus =
        Array.isArray(ord?.payments) && ord.payments[0]?.status
          ? String(ord.payments[0].status).toLowerCase()
          : "";
      if (WAIT_STATUSES.has(firstStatus)) return "pending";

      return "failed";
    },
    [WAIT_STATUSES]
  );

  // 0.5) Si la URL ya vino con approved/success
  useEffect(() => {
    if (isFree) return;

    // Si no viene status approved/success, no hacemos nada
    if (!urlLooksApproved) return;

    // 🔒 Seguridad: si NO hay referencias reales de MP en la URL,
    // NO debemos marcar como aprobado ni activar plan.
    // Esto evita que alguien pegue /pago/success a mano y vea/active cosas.
    if (!hasAnyRef) {
      // Modo prueba manual: solo permitido en local/dev o con flag explícito
      if (ALLOW_MANUAL_SUCCESS) {
        const rawPlan = (planParam || extPlan || localStorage.getItem("reg_plan") || "pro")
          .toString()
          .toLowerCase();
        const planF = rawPlan.includes("premium") ? "premium" : rawPlan || "pro";

        const emailF = (emailParam || extEmail || localStorage.getItem("reg_email") || "")
          .toString()
          .trim()
          .toLowerCase();

        if (!emailF) {
          setDetails(null);
          setVerified("error");
          setLoading(false);
          setRegMsg("Falta el email en la URL. Agrega &email=... para continuar (modo prueba)." );
          return;
        }

        // Guardamos para que /registro lo use
        try {
          localStorage.setItem("reg_email", emailF);
          localStorage.setItem("reg_plan", planF);
        } catch {}

        // Detalles fake solo para UI
        const fakeTitle = planF === "premium" ? "Plan PREMIUM IztapaMarket" : "Plan PRO IztapaMarket";
        const fake = {
          status: "approved",
          additional_info: { items: [{ title: fakeTitle }], payer: { email: emailF } },
          payer: { email: emailF },
        };

        setDetails(fake);
        setVerified("approved");
        setLoading(false);
        setRegMsg("✅ Pago aprobado (modo prueba local). Redirigiendo al registro…");

        const qs = new URLSearchParams({ plan: planF, email: emailF, paid: "approved" });
        safeNavigate(`/registro?${qs.toString()}`);
        return;
      }

      // 🔒 Producción: sin referencias reales NO se activa nada.
      setDetails(null);
      setVerified("error");
      setLoading(false);
      setRegMsg(
        "Esta URL no trae datos de pago (payment_id / merchant_order_id / preference_id). Si acabas de pagar, vuelve a intentar desde el botón de pago o espera el redireccionamiento de Mercado Pago."
      );
      return;
    }

    // Si SÍ hay referencias reales => no hacemos nada aquí.
    // El efecto de verificación + upsert se encargará.
  }, [
    isFree,
    urlLooksApproved,
    hasAnyRef,
    planParam,
    extPlan,
    emailParam,
    extEmail,
    ALLOW_MANUAL_SUCCESS,
    safeNavigate,
  ]);

  // 1) Verificación real con backend (polling corto)
  useEffect(() => {
    // En FREE o en pruebas sin referencias, NO verificamos contra backend
    if (isFree || !VERIFY_MP || !hasAnyRef) return;
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
        const err = new Error(
          data?.error || data?.message || `HTTP ${res.status}`
        );
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
  }, [
    API_BASE,
    payment_id,
    merchant_order_id,
    external_reference,
    isFree,
    VERIFY_MP,
    hasAnyRef,
    verdictFromOrder,
    verdictFromPayment,
  ]);

  // 🚀 Opción 3: autologin local si es correo de prueba (testuser) y pago aprobado
  useEffect(() => {
    const email =
      (emailParam || extEmail || details?.payer?.email || "").toLowerCase();

    const approved = verified === "approved" || (urlLooksApproved && hasAnyRef);

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
  }, [
    verified,
    urlApproved,
    emailParam,
    extEmail,
    details,
    planParam,
    extPlan,
    navigate,
    hasAnyRef,
    urlLooksApproved,
  ]);

  // 2) Upsert en Supabase + redirección al formulario
  useEffect(() => {
    async function upsertProfileAndRedirect({ plan, email, paidFlag }) {
      // Si es FREE, siempre mandamos directo al formulario FREE
      if (String(plan).toLowerCase() === "free") {
        safeNavigate(`/registro?plan=free`);
        return;
      }

      if (!supabase || !email) return;

      const now = new Date().toISOString();
      const normalizedEmail = email.toLowerCase();

      // 1) Actualizar/crear profile
      try {
        await supabase
          .from("profiles")
          .upsert(
            { email: normalizedEmail, plan_type: plan, updated_at: now },
            { onConflict: "email" }
          );
      } catch (e) {
        console.warn("profiles upsert warn:", e?.message || e);
      }

      // 2) Guardar en localStorage
      try {
        localStorage.setItem("reg_email", normalizedEmail);
        localStorage.setItem("reg_plan", plan);
      } catch {}

      // 3) Enviar correo de bienvenida solo para planes de pago (pro/premium)
      try {
        if (plan && String(plan).toLowerCase() !== "free" && normalizedEmail) {
          await sendWelcomeEmail({ email: normalizedEmail });
        }
      } catch (e) {
        console.warn("sendWelcomeEmail warn:", e?.message || e);
      }

      // 4) (Opcional) intentar autologin con magic link,
      // SIEMPRE mandando al formulario de registro
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (AUTH_AUTO_LOGIN && !user && String(plan).toLowerCase() !== "free") {
          const nextPath = `/registro?plan=${encodeURIComponent(
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

      // 5) Redirect FINAL: siempre al formulario de registro
      const qs = new URLSearchParams({ plan, email: normalizedEmail });
      if (paidFlag) qs.set("paid", paidFlag);

      safeNavigate(`/registro?${qs.toString()}`);
    }

    async function run() {
      // ✅ NUEVO canProceed:
      // - approved real
      // - o URL approved + refs aunque verificación sea error o failed (caso producción)
      const canProceed =
        verified === "approved" ||
        (hasAnyRef && urlLooksApproved && (verified === "error" || verified === "failed"));

      if (!canProceed) return;

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
        ]
          .find(Boolean)
          ?.toString()
          .trim()
          .toLowerCase() || "";

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
        setRegMsg(
          verified === "approved"
            ? "Pago confirmado. Activando plan en tu cuenta…"
            : "Pago aprobado por URL. Activando tu plan…"
        );
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
    // No cleanup needed
  }, [
    verified,
    urlApproved,
    details,
    planParam,
    emailParam,
    supabase,
    extEmail,
    extPlan,
    isFree,
    AUTH_AUTO_LOGIN,
    safeNavigate,
    tryAutoMagicLink,
    sendWelcomeEmail,
  ]);

  // --- UI ---
  const headerText = isFree
    ? "¡Plan FREE activado!"
    : verified === "approved"
    ? "¡Pago aprobado!"
    : verified === "pending"
    ? "Pago en proceso"
    : verified === "failed"
    ? (urlLooksApproved && hasAnyRef)
      ? "Pago aprobado (validación parcial)"
      : "No pudimos confirmar tu pago"
    : verified === "error"
    ? (urlLooksApproved && hasAnyRef)
      ? "Pago aprobado (validación parcial)"
      : "Error al verificar tu pago"
    : "Verificando pago…";

  const headerColor =
    isFree ||
    verified === "approved" ||
    (hasAnyRef && urlLooksApproved && (verified === "error" || verified === "failed"))
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
          : loading && verified === null
          ? "Consultando con el sistema de pagos…"
          : verified === "approved"
          ? "Tu pago se registró correctamente."
          : verified === "pending"
          ? "Recibimos la redirección y tu pago está en proceso. Si ya se te cargó, se reflejará en breve."
          : verified === "failed" && !urlLooksApproved
          ? "Recibimos la redirección, pero tu pago no aparece aprobado. Si ya se te cargó, se reflejará en unos minutos."
          : verified === "error" && urlLooksApproved && hasAnyRef
          ? "Detectamos que la URL viene como aprobada. Tu plan se activará con validación parcial."
          : verified === "failed" && urlLooksApproved && hasAnyRef
          ? "Detectamos que la URL viene como aprobada. Tu plan se activará con validación parcial."
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
              — verificado:{" "}
              <b>{isFree ? "free" : verified || "(pendiente)"}</b>
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
            <b>Plan:</b> {isFree ? "free" : planParam || extPlan || "pro"}
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