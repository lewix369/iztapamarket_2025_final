import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const SuccessPage = () => {
  const [status, setStatus] = useState("Verificando pago...");

  useEffect(() => {
    const verifyPayment = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const paymentId = urlParams.get("payment_id");

      if (!paymentId) {
        setStatus("No se encontró el ID de pago.");
        return;
      }

      try {
        const res = await fetch(
          `https://api.mercadopago.com/v1/payments/${paymentId}`,
          {
            headers: {
              Authorization: `Bearer ${import.meta.env.VITE_MP_ACCESS_TOKEN}`,
            },
          }
        );

        const data = await res.json();

        console.log("Respuesta de MercadoPago:", data);

        if (data.status === "approved") {
          const negocioId = urlParams.get("external_reference");
          if (!negocioId) {
            setStatus("No se encontró el ID del negocio.");
            return;
          }
          const { error } = await supabase
            .from("negocios")
            .update({ estado_pago: "aprobado" })
            .eq("id", negocioId);

          if (error) throw error;
          setStatus("Pago verificado y negocio activado correctamente.");
        } else {
          setStatus("El pago no fue aprobado.");
        }
      } catch (err) {
        console.error("Error verificando pago:", err);
        setStatus("Hubo un error al verificar el pago.");
      }
    };

    verifyPayment();
  }, []);

  return <div style={{ padding: "2rem" }}>{status}</div>;
};

export default SuccessPage;
