// src/pages/LoginPage.jsx
import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { supabase } from "@/lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const ADMIN_EMAIL = "luis.carrillo.laguna@gmail.com";

const safeDecodeURIComponent = (value) => {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const LoginPage = () => {
  const [searchParams] = useSearchParams();
  // Normaliza el destino: si viene vacío o apunta al Home, forzamos /mi-negocio
  const rawRedirect = searchParams.get("redirect") || "";
  const requestedRedirect = safeDecodeURIComponent(rawRedirect);
  const defaultEmail = searchParams.get("email") || "";
  const redirect =
    !requestedRedirect ||
    requestedRedirect === "/" ||
    requestedRedirect === "/#/"
      ? "/mi-negocio"
      : requestedRedirect;
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("magic"); // "magic" | "password"
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  // Guarda el destino deseado para después del login si viene en la URL
  useEffect(() => {
    if (redirect && typeof window !== "undefined") {
      localStorage.setItem("post_login_redirect", redirect);
    }
  }, [redirect]);

  // Si ya hay sesión activa al entrar al login, redirige de inmediato
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const hasSession = !!data?.session;
        if (!mounted || !hasSession) return;
        const stored =
          (typeof window !== "undefined" &&
            localStorage.getItem("post_login_redirect")) ||
          "";
        const dest = redirect || stored || "/mi-negocio";
        const normalized =
          !dest || dest === "/" || dest === "/#/" ? "/mi-negocio" : dest;
        try {
          localStorage.removeItem("post_login_redirect");
        } catch {}
        navigate(normalized, { replace: true });
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, [redirect, navigate]);

  const handleSendMagic = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const origin = window.location.origin;

      // Destino base post-login: primero lo que viene en ?redirect, luego lo guardado, luego /mi-negocio
      const storedRedirect =
        (typeof window !== "undefined" &&
          localStorage.getItem("post_login_redirect")) ||
        "";

      let after = redirect || storedRedirect || "/mi-negocio";
      if (!after || after === "/" || after === "/#/") {
        after = "/mi-negocio";
      }

      // En este punto `after` conserva TODO lo que venía de éxito de pago,
      // por ejemplo: /registro?plan=premium&email=...&paid=approved

      const callback = `${origin}/auth/callback?redirect=${encodeURIComponent(
        after
      )}`;  

      console.log("[Auth] emailRedirectTo:", callback);
      console.log(
        "[Auth] post_login_redirect (before send):",
        localStorage.getItem("post_login_redirect")
      );

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: callback,
          redirectTo: callback,
          shouldCreateUser: true,
        },
      });
      if (error) throw error;
      setSent(true);
      try {
        localStorage.setItem("post_login_redirect", after);
      } catch {}
    } catch (err) {
      setError(err.message || "No se pudo enviar el enlace.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      console.error("❌ Error login:", error);

      let msg = "No se pudo autenticar correctamente. Intenta de nuevo.";

      const raw = (error.message || "").toLowerCase();
      if (raw.includes("invalid login credentials")) {
        msg = "Correo o contraseña incorrectos o usuario no registrado.";
      } else if (raw.includes("failed to fetch")) {
        msg = "No se pudo contactar al servidor de autenticación. Revisa tu conexión o inténtalo de nuevo en unos minutos.";
      }

      setError(msg);
      alert(msg);
      return;
    }

    // Limpiar campos
    setEmail("");
    setPassword("");

    // Obtener user_id para decidir a dónde navegar
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (!userData?.user?.id || userError) {
      console.error("❌ No se pudo obtener el user_id", userError);
      const msg =
        userError?.message || "No se pudo autenticar correctamente.";
      setError(msg);
      alert(msg);
      return;
    }
    const userId = String(userData.user.id).trim();
    alert("✅ Inicio de sesión exitoso");

    // 1) Admin directo a /admin
    if (email.trim() === ADMIN_EMAIL) {
      try {
        localStorage.removeItem("post_login_redirect");
      } catch {}
      navigate("/admin");
      return;
    }

    // 2) Si venía ?redirect=... o hay uno guardado, respétalo
    const dest =
      redirect ||
      (typeof window !== "undefined" &&
        localStorage.getItem("post_login_redirect")) ||
      "/mi-negocio";
    const normalizedDest =
      !dest || dest === "/" || dest === "/#/" ? "/mi-negocio" : dest;
    if (normalizedDest) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("post_login_redirect");
      }
      navigate(normalizedDest, { replace: true });
      return;
    }

    // 3) Lógica existente: ver si tiene negocio y su plan
    const { data: negocios, error: negocioError } = await supabase
      .from("negocios")
      .select("*")
      .eq("user_id", userId);

    if (negocioError) {
      console.error("❌ Error al obtener el negocio:", negocioError);
      alert("❌ Error en la consulta de negocios.");
      navigate(
        redirect ||
          (typeof window !== "undefined" &&
            localStorage.getItem("post_login_redirect")) ||
          "/mi-negocio",
        { replace: true }
      );
      return;
    }

    if (!negocios || negocios.length === 0) {
      // Si no tiene negocio, lo mandamos a registrar
      navigate("/registro");
      return;
    }

    const plan = negocios[0].plan_type;
    if (plan === "pro" || plan === "premium") {
      navigate("/mi-negocio");
    } else {
      alert("Tu plan actual no tiene acceso a esta sección.");
      navigate(
        redirect ||
          (typeof window !== "undefined" &&
            localStorage.getItem("post_login_redirect")) ||
          "/mi-negocio",
        { replace: true }
      );
    }
  };

  return (
    <>
      <Helmet>
        <title>Iniciar Sesión - IztapaMarket</title>
      </Helmet>

      <div className="max-w-md mx-auto py-10">
        <h1 className="text-2xl font-bold mb-6">Iniciar Sesión</h1>

        {/* Toggle de modo: Magic link (sin contraseña) o con contraseña */}
        <div className="flex gap-2 mb-6">
          <Button
            type="button"
            variant={mode === "magic" ? "default" : "outline"}
            onClick={() => setMode("magic")}
          >
            Enlace por correo (sin contraseña)
          </Button>
          <Button
            type="button"
            variant={mode === "password" ? "default" : "outline"}
            onClick={() => setMode("password")}
          >
            Con contraseña
          </Button>
        </div>

        {mode === "magic" ? (
          sent ? (
            <div className="bg-green-50 border border-green-200 p-4 rounded">
              <p>
                Te enviamos un enlace de acceso a <strong>{email}</strong>. Abre
                tu correo y haz clic para entrar. Si no llega, revisa spam o
                intenta de nuevo.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSendMagic} className="space-y-4">
              <div>
                <Label htmlFor="email">Correo</Label>
                <Input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.trim())}
                  required
                />
              </div>
              {error && <p className="text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Enviando..." : "Enviar enlace de acceso"}
              </Button>
              <p className="text-xs text-gray-500">
                Recibirás un enlace de 1 uso que te llevará directamente a tu
                panel.
              </p>
            </form>
          )
        ) : (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <Label htmlFor="email">Correo</Label>
              <Input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Contraseña</Label>
              <Input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Ingresando..." : "Entrar"}
            </Button>
          </form>
        )}
      </div>
    </>
  );
};

export default LoginPage;