import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";

export default function PaySuccess() {
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

  // Base del backend (soporta túnel de Cloudflare vía Vite)
  const API_BASE = useMemo(
    () => (import.meta.env.VITE_MP_BASE || "").replace(/\/$/, ""),
    []
  );

  // Supabase (frontend: SIEMPRE con anon key)
  const supabase = useMemo(() => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key, { auth: { persistSession: true } });
  }, []);

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
      payer: { email: emailParam || extEmail || "" },
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

  // 1) Verificación de pago en backend (resiliente + polling corto)
  useEffect(() => {
    if (isFree) return; // FREE no verifica con MP
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
        const base = API_BASE || window.location.origin;

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
  }, [API_BASE, payment_id, merchant_order_id, external_reference, isFree]);

  // 2) Registro en Supabase (FREE => status_pago "free"; PRO/PREMIUM => "approved")
  useEffect(() => {
    let cancelled = false;

    async function register() {
      if (verified !== "approved") return;
      if (!supabase) {
        setRegMsg("Supabase no configurado en el frontend.");
        return;
      }

      try {
        // Derivar email / plan / monto desde múltiples fuentes
        const payerEmail =
          emailParam ||
          extEmail ||
          localStorage.getItem("correo_negocio") ||
          details?.payer?.email ||
          details?.additional_info?.payer?.email ||
          "";

        // Plan
        const title0 = details?.additional_info?.items?.[0]?.title || "";
        const inferredPlan = title0.toLowerCase().includes("premium")
          ? "premium"
          : "pro";
        const plan = isFree ? "free" : planParam || extPlan || inferredPlan;

        // monto
        const monto = isFree
          ? 0
          : Number.isFinite(
              details?.transaction_amount ??
                details?.payments?.[0]?.transaction_amount
            )
          ? Number(
              details?.transaction_amount ??
                details?.payments?.[0]?.transaction_amount
            )
          : Number(localStorage.getItem("monto_negocio") || 0) || 0;

        // pago_id
        const pagoId = isFree
          ? `FREE-${tagParam || Date.now()}`
          : details?.id ||
            details?.payments?.[0]?.id ||
            payment_id ||
            "DESCONOCIDO";

        // Evitar duplicados por pago_id
        {
          const { data: exists } = await supabase
            .from("negocios")
            .select("id, email, pago_id")
            .eq("pago_id", pagoId)
            .maybeSingle();

          if (exists) {
            setRegMsg("Negocio ya estaba registrado (pago_id existente).");
            await linkOwnerIfLoggedIn(supabase, exists.id);
            return;
          }
        }

        // Datos del negocio desde localStorage como respaldo
        const nombreLocal =
          localStorage.getItem("nombre_negocio") ||
          details?.additional_info?.payer?.first_name ||
          "Negocio test";
        const descripcionLocal =
          localStorage.getItem("descripcion_negocio") || "";
        const categoriaLocal = localStorage.getItem("categoria_negocio") || "";
        const telefonoLocal = localStorage.getItem("telefono_negocio") || "";
        const direccionLocal = localStorage.getItem("direccion_negocio") || "";
        const imagenUrlLocal = localStorage.getItem("imagen_url") || "";
        const mapaEmbedUrlLocal = localStorage.getItem("mapa_embed_url") || "";
        const menuLocal = localStorage.getItem("menu") || "";
        const instagramLocal = localStorage.getItem("instagram") || "";
        const facebookLocal = localStorage.getItem("facebook") || "";
        const hoursLocal = localStorage.getItem("hours") || "";
        const servicesLocal = localStorage.getItem("services") || "";
        const logoUrlLocal = localStorage.getItem("logo_url") || "";
        const webLocal = localStorage.getItem("web") || "";
        const videoEmbedUrlLocal =
          localStorage.getItem("video_embed_url") || "";
        const whatsappLocal = localStorage.getItem("whatsapp") || "";

        const insertPayload = {
          nombre: nombreLocal,
          descripcion: descripcionLocal,
          categoria: categoriaLocal,
          telefono: telefonoLocal,
          direccion: direccionLocal,
          imagen_url: imagenUrlLocal,
          mapa_embed_url: mapaEmbedUrlLocal,
          menu: menuLocal,
          instagram: instagramLocal,
          facebook: facebookLocal,
          hours: hoursLocal,
          services: servicesLocal,
          logo_url: logoUrlLocal,
          web: webLocal,
          video_embed_url: videoEmbedUrlLocal,
          whatsapp: whatsappLocal,
          pago_id: pagoId,
          email: payerEmail,
          monto,
          plan,
          status_pago: isFree ? "free" : "approved",
        };

        const { data: inserted, error: insertErr } = await supabase
          .from("negocios")
          .insert([insertPayload])
          .select("id")
          .single();

        if (insertErr) throw insertErr;

        const negocioId = inserted?.id;
        if (!negocioId) throw new Error("No se obtuvo id del negocio.");

        await linkOwnerIfLoggedIn(supabase, negocioId);

        // Limpiar localStorage
        [
          "correo_negocio",
          "nombre_negocio",
          "descripcion_negocio",
          "categoria_negocio",
          "telefono_negocio",
          "direccion_negocio",
          "imagen_url",
          "mapa_embed_url",
          "menu",
          "instagram",
          "facebook",
          "hours",
          "services",
          "logo_url",
          "web",
          "video_embed_url",
          "whatsapp",
          "monto_negocio",
        ].forEach((k) => localStorage.removeItem(k));

        setRegMsg(
          isFree ? "¡Plan FREE activado!" : "¡Negocio registrado con éxito!"
        );
      } catch (e) {
        console.error("Error al registrar en Supabase:", e);
        setRegMsg("No se pudo registrar el negocio.");
      }
    }

    register();
    return () => {
      cancelled = true;
    };
  }, [
    verified,
    details,
    planParam,
    emailParam,
    payment_id,
    supabase,
    extEmail,
    extPlan,
    isFree,
    tagParam,
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
    emailParam || extEmail || localStorage.getItem("correo_negocio") || "";

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
        {emailToShow && (
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
