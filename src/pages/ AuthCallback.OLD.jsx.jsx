// src/pages/AuthCallback.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";

const ADMIN_EMAIL = "luis.carrillo.laguna@gmail.com";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Verificando sesión…");
  const redirectedRef = useRef(false);

  // Limpia el fragmento (?code=… o #access_token=…) para no dejar tokens en la URL
  const cleanUrl = () => {
    try {
      const url = new URL(window.location.href);
      url.hash = "";
      // Conserva query “de estado” si la trajiste (opcional)
      window.history.replaceState({}, document.title, url.toString());
    } catch {}
  };

  // Lógica de a dónde enviar al usuario una vez “logueado”
  const goNext = async () => {
    if (redirectedRef.current) return;
    redirectedRef.current = true;

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;

    if (!user) {
      setMessage(
        "No se pudo obtener la sesión. Intenta de nuevo desde tu correo."
      );
      redirectedRef.current = false;
      return;
    }

    // Admin → /admin
    if ((user.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      navigate("/admin", { replace: true });
      return;
    }

    // ¿Tiene negocio?
    const { data: negocios, error } = await supabase
      .from("negocios")
      .select("id, plan_type")
      .eq("user_id", user.id);

    if (error) {
      console.error("Error consultando negocios:", error);
      setMessage("Ocurrió un error consultando tu negocio. Intenta de nuevo.");
      redirectedRef.current = false;
      return;
    }

    if (negocios && negocios.length > 0) {
      navigate("/mi-negocio", { replace: true });
    } else {
      // Sin negocio aún → a registro (dejas que elija plan o puedes recordar el último)
      navigate("/registro", { replace: true });
    }
  };

  useEffect(() => {
    cleanUrl();

    // 1) Revisa si ya hay sesión cargada
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) return goNext();
    })();

    // 2) Escucha el evento de autenticación (cuando Supabase “consume” el link)
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        goNext();
      } else if (event === "TOKEN_REFRESHED" && session) {
        goNext();
      } else if (event === "USER_UPDATED" && session) {
        goNext();
      }
    });

    // 3) Timeout de cortesía por si algo falla
    const t = setTimeout(() => {
      setMessage(
        "Estamos tardando más de lo normal. Si no avanza, vuelve a hacer clic en el enlace de tu correo."
      );
    }, 6000);

    return () => {
      sub?.subscription?.unsubscribe?.();
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-2">Conectando con tu cuenta…</h1>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
}
