// src/pages/Checkout.jsx
import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import MPWalletButton from "@/components/MPWalletButton";

/**
 * Página mínima de checkout.
 * - Toma plan y email de la URL o de localStorage.
 * - Si no hay email, manda a login con redirect de vuelta a /checkout.
 * - Llama a nuestro backend para crear la preferencia.
 * - Renderiza el botón Wallet de Mercado Pago (frontend) para iniciar el pago.
 */
const Checkout = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const plan = (
    searchParams.get("plan") ||
    localStorage.getItem("reg_plan") ||
    "pro"
  ).toLowerCase();
  const email = (
    searchParams.get("email") ||
    localStorage.getItem("reg_email") ||
    ""
  ).trim();
  const userId = localStorage.getItem("reg_user_id") || null;

  useEffect(() => {
    // Si no hay email, regresamos a login con redirect a /checkout
    if (!email) {
      const redirect = encodeURIComponent(`/checkout?plan=${plan}`);
      navigate(`/login?redirect=${redirect}`, { replace: true });
      return;
    }

    // Guardamos contexto para /pago/success
    localStorage.setItem("reg_plan", plan);
    localStorage.setItem("reg_email", email);
  }, [plan, email, userId, navigate]);

  return (
    <main className="flex items-center justify-center h-screen">
      <div style={{ width: 320 }}>
        <h1 className="text-xl mb-4">Pagar suscripción {plan}</h1>
        <MPWalletButton plan={plan} email={email} userId={userId} />
      </div>
    </main>
  );
};

export default Checkout;
