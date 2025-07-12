// src/components/RequireAdmin.jsx
import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "@/contexts/SessionContext";

const ADMIN_EMAIL = "luis.carrillo.laguna@gmail.com";

const RequireAdmin = ({ children }) => {
  const { session } = useSession();
  const location = useLocation();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setChecking(false);
    }, 3000); // máximo 3s para evitar bucle eterno

    if (session !== undefined) {
      setChecking(false);
      clearTimeout(timeout);
    }

    return () => clearTimeout(timeout);
  }, [session]);

  if (checking) {
    return <div className="text-center mt-10">Cargando sesión...</div>;
  }

  if (!session) {
    console.warn("🔒 Redirigiendo a login por falta de sesión o permiso");
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (session === null) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const userEmail = session.user?.email || "";
  console.log("👤 Usuario logueado:", userEmail);
  console.log("📦 Sesión completa:", session);

  if (userEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return (
      <div className="text-center mt-10 text-red-600">
        Acceso denegado. No eres el administrador autorizado.
      </div>
    );
  }

  console.log("✅ Acceso permitido como admin");
  return children;
};

export default RequireAdmin;
