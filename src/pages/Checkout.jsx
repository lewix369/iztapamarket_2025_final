// src/pages/Checkout.jsx
import React, { useEffect } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";

/**
 * Página mínima de checkout.
 * - Toma plan y email de la URL o de localStorage.
 * - Si no hay email, manda a login con redirect de vuelta a /checkout.
 * - Llama a nuestro backend para crear la preferencia.
 * - Redirige a Mercado Pago usando init_point (o id como fallback).
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

    const createPreference = async () => {
      try {
        const { data } = await axios.post(
          "http://localhost:3000/create_preference",
          {
            plan,
            email,
            userId,
          }
        );

        // Preferimos init_point, si no viene usamos el id para armar la URL
        const initPoint =
          data?.init_point ||
          (data?.id
            ? `https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=${data.id}`
            : null);

        if (initPoint) {
          window.location.href = initPoint;
        } else {
          alert("Error al generar el enlace de pago.");
          navigate("/planes", { replace: true });
        }
      } catch (error) {
        console.error(
          "❌ Error al crear preferencia:",
          error?.response?.data || error.message
        );
        alert("No se pudo iniciar el pago.");
        navigate("/planes", { replace: true });
      }
    };

    createPreference();
  }, [plan, email, userId, navigate]);

  return (
    <main className="flex items-center justify-center h-screen">
      <p className="text-xl">Redirigiendo a Mercado Pago…</p>
    </main>
  );
};

export default Checkout;
