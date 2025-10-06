// src/pages/Checkout.jsx
import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const CONTACT_PHONE = import.meta.env.VITE_CONTACT_PHONE || "+52 56 5306 9259";

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

  const whatsappLink = `https://wa.me/${CONTACT_PHONE.replace(
    /\D+/g,
    ""
  )}?text=${encodeURIComponent(
    `Hola, quiero pagar el plan ${plan} para ${email} (IztapaMarket).`
  )}`;

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
        {/* Placeholder temporal mientras se integra MPWalletButton */}
        <div className="space-y-3 rounded-md border border-yellow-500 p-4 bg-yellow-50 text-yellow-900">
          <p className="text-sm">
            Falta el componente <code>MPWalletButton</code> o su alias. Puedes
            completar el pago contactándonos por WhatsApp.
          </p>
          <a
            href={whatsappLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
          >
            Abrir WhatsApp
          </a>
        </div>
      </div>
    </main>
  );
};

export default Checkout;
