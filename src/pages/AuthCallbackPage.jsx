// src/pages/AuthCallbackPage.jsx
import React, { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useNavigate } from "react-router-dom";

const AuthCallbackPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthRedirect = async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(
        window.location.href
      );
      if (error) {
        console.error("Error al autenticar:", error);
        return;
      }
      navigate("/mi-negocio");
    };

    handleAuthRedirect();
  }, [navigate]);

  return <p>Verificando acceso, por favor espera...</p>;
};

export default AuthCallbackPage;
