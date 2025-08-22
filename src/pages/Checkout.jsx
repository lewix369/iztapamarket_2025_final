// src/pages/Checkout.jsx
import React, { useEffect } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";

const Checkout = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const plan = searchParams.get("plan") || "pro";

  useEffect(() => {
    const createPreference = async () => {
      try {
        const response = await axios.post(
          "http://localhost:3000/create_preference",
          {
            plan: plan,
          }
        );

        if (response.data && response.data.id) {
          window.location.href = `https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=${response.data.id}`;
        } else {
          alert("Error al generar el enlace de pago.");
          navigate("/planes");
        }
      } catch (error) {
        console.error("Error al crear preferencia:", error);
        alert("No se pudo iniciar el pago.");
        navigate("/planes");
      }
    };

    createPreference();
  }, [plan, navigate]);

  return (
    <main className="flex items-center justify-center h-screen">
      <p className="text-xl">Redirigiendo a Mercado Pago...</p>
    </main>
  );
};

export default Checkout;
