import React, { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import RegisterBusinessPage from "@/pages/RegisterBusinessPage";

/**
 * Registro.jsx
 * - Página de registro después del pago
 * - Lee los parámetros de la URL (plan, status, email, etc.)
 * - Opcional: los guarda en localStorage para que otras páginas los lean
 */

const Registro = () => {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    try {
      const data = Object.fromEntries(searchParams.entries());
      if (Object.keys(data).length > 0) {
        window.localStorage.setItem(
          "iztapa_postpay_registro",
          JSON.stringify(data)
        );
      }
    } catch (e) {
      console.warn("[Registro] No se pudo guardar postpay en localStorage", e);
    }
  }, [searchParams]);

  return <RegisterBusinessPage />;
};

export default Registro;
