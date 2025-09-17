// src/pages/AuthCallbackPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";

function readRedirectFromLocation() {
  try {
    // 1) Normal query param (?redirect=...)
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

    // 3) Fallback: localStorage guard
    const stored = localStorage.getItem("post_login_redirect");
    if (stored) return stored;
  } catch (_) {}

  // 4) Final fallback
  return "/mi-negocio";
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

        // 1) ¿ya hay sesión?
        const { data: s1 } = await supabase.auth.getSession();
        if (mounted && s1?.session) {
          navigate(redirect, { replace: true });
          try {
            localStorage.removeItem("post_login_redirect");
          } catch {}
          return;
        }

        // 2) Intercambiar el código del enlace (si aplica)
        setMsg("Confirmando sesión…");
        try {
          await supabase.auth.exchangeCodeForSession();
        } catch (e) {
          console.warn("[AuthCallback] exchangeCodeForSession:", e?.message);
        }

        // 3) Sesión final → redirigir a where=redirect
        const { data: s2 } = await supabase.auth.getSession();
        if (mounted && s2?.session) {
          navigate(redirect, { replace: true });
          try {
            localStorage.removeItem("post_login_redirect");
          } catch {}
          return;
        }

        // 4) Si no hay sesión, mandar a login conservando redirect
        setMsg(
          "No se pudo iniciar sesión automáticamente. Redirigiendo al login…"
        );
        try {
          localStorage.setItem("post_login_redirect", redirect);
        } catch {}
        navigate(`/login?redirect=${encodeURIComponent(redirect)}`, {
          replace: true,
        });
      } catch (err) {
        console.error("[AuthCallback] Error:", err);
        const fallback = searchParams.get("redirect") || "/mi-negocio";
        console.error(
          "[AuthCallback] falling back to login with redirect:",
          fallback
        );
        try {
          localStorage.setItem("post_login_redirect", fallback);
        } catch {}
        navigate(`/login?redirect=${encodeURIComponent(fallback)}`, {
          replace: true,
        });
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
