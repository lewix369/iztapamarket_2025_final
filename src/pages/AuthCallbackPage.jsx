// src/pages/AuthCallbackPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";

/** Lee el destino deseado desde query, hash o localStorage */
function readRedirectFromLocation() {
  try {
    // 1) Query param (?redirect=...)
    const sp = new URLSearchParams(window.location.search);
    let r = sp.get("redirect");
    if (r) return r;

    // 2) HashRouter case: /#/auth/callback?redirect=...
    const hash = window.location.hash || "";
    const idx = hash.indexOf("?");
    if (idx >= 0) {
      const hsp = new URLSearchParams(hash.slice(idx + 1));
      r = hsp.get("redirect");
      if (r) return r;
    }

    // 3) Fallback: localStorage
    const stored = localStorage.getItem("post_login_redirect");
    if (stored) return stored;
  } catch (_) {}

  // 4) Final fallback
  return "/mi-negocio";
}

/** Parsea el hash (#...) para extraer tokens si vienen en formato fragment */
function readTokensFromHash() {
  try {
    const raw = window.location.hash || ""; // ej: #access_token=...&refresh_token=...&type=magiclink
    if (!raw || raw.length < 2) return null;
    const q = raw.startsWith("#") ? raw.substring(1) : raw;
    // Soporta "route?params" y también "route&access_token=..."
    const parts = q.split("?").pop() || "";
    const usp = new URLSearchParams(parts);

    const access_token = usp.get("access_token") || "";
    const refresh_token = usp.get("refresh_token") || "";
    const token_type = usp.get("token_type") || "";
    const expires_in = usp.get("expires_in") || "";
    const type = usp.get("type") || ""; // magiclink / recovery, etc.

    if (!access_token) return null;

    return {
      access_token,
      refresh_token,
      token_type,
      expires_in: expires_in ? Number(expires_in) : undefined,
      type,
      // también útiles:
      rawParams: usp,
    };
  } catch {
    return null;
  }
}

/** Elimina el hash de la URL sin perder los query params visibles */
function removeHashFromUrl() {
  try {
    const url = new URL(window.location.href);
    url.hash = "";
    window.history.replaceState({}, document.title, url.toString());
  } catch {}
}

const AuthCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [msg, setMsg] = useState("Procesando autenticación…");

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const redirect = readRedirectFromLocation();
        console.log("[AuthCallback] href:", window.location.href);
        console.log("[AuthCallback] resolved redirect:", redirect);

        // --- (A) ¿YA HAY SESIÓN ACTIVA?
        const { data: s1 } = await supabase.auth.getSession();
        if (mounted && s1?.session) {
          // Limpiamos el hash si hubiera quedado
          removeHashFromUrl();
          navigate(redirect, { replace: true });
          try { localStorage.removeItem("post_login_redirect"); } catch {}
          return;
        }

        // --- (B) ¿VIENEN TOKENS EN EL HASH? (#access_token=...&refresh_token=...)
        const hashTokens = readTokensFromHash();
        if (hashTokens?.access_token) {
          setMsg("Estableciendo sesión…");
          try {
            // setSession requiere access_token y refresh_token; si no hay refresh, igual probamos
            const { access_token, refresh_token } = hashTokens;
            if (refresh_token) {
              const { data: setData, error: setErr } = await supabase.auth.setSession({
                access_token,
                refresh_token,
              });
              if (setErr) {
                console.warn("[AuthCallback] setSession error:", setErr.message);
              } else {
                console.log("[AuthCallback] setSession OK:", !!setData?.session);
              }
            } else {
              // Caso raro: sin refresh token. Intento fallback: exchangeCodeForSession (no hará nada si no hay code)
              console.warn("[AuthCallback] no refresh_token en hash; intento fallback exchangeCodeForSession()");
              try { await supabase.auth.exchangeCodeForSession(); } catch {}
            }
          } catch (e) {
            console.warn("[AuthCallback] setSession threw:", e?.message || e);
          }

          // Checamos de nuevo la sesión tras setSession
          const { data: s2 } = await supabase.auth.getSession();
          if (mounted && s2?.session) {
            // Limpia URL (quita el # con tokens)
            removeHashFromUrl();
            navigate(redirect, { replace: true });
            try { localStorage.removeItem("post_login_redirect"); } catch {}
            return;
          }
          // Si no hay sesión todavía, seguimos al paso C
        }

        // --- (C) INTENTA EXCHANGE CODE (para el caso ?code=...)
        setMsg("Confirmando sesión…");
        try {
          await supabase.auth.exchangeCodeForSession();
        } catch (e) {
          console.warn("[AuthCallback] exchangeCodeForSession:", e?.message);
        }

        // --- (D) ¿YA TENEMOS SESIÓN TRAS EL INTERCAMBIO?
        const { data: s3 } = await supabase.auth.getSession();
        if (mounted && s3?.session) {
          removeHashFromUrl();
          navigate(redirect, { replace: true });
          try { localStorage.removeItem("post_login_redirect"); } catch {}
          return;
        }

        // --- (E) FALLBACK: MANDAR A LOGIN CONSERVANDO DESTINO
        setMsg("No se pudo iniciar sesión automáticamente. Redirigiendo al login…");
        try { localStorage.setItem("post_login_redirect", redirect); } catch {}
        navigate(`/login?redirect=${encodeURIComponent(redirect)}`, { replace: true });
      } catch (err) {
        console.error("[AuthCallback] Error:", err);
        const fallback = searchParams.get("redirect") || "/mi-negocio";
        try { localStorage.setItem("post_login_redirect", fallback); } catch {}
        navigate(`/login?redirect=${encodeURIComponent(fallback)}`, { replace: true });
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [navigate, searchParams]);

  return (
    <div className="max-w-md mx-auto mt-16 p-6 bg-white shadow rounded text-center">
      <p className="text-sm text-gray-700">{msg}</p>
    </div>
  );
};

export default AuthCallbackPage;