import React, { useEffect, useState } from "react";
import axios from "axios";
import { useSearchParams } from "react-router-dom";

const RegistroSuccess = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("Verificando...");
  const [details, setDetails] = useState(null);

  useEffect(() => {
    const paymentId = searchParams.get("payment_id");

    if (!paymentId) {
      setStatus("No se encontró el ID de pago.");
      return;
    }

    const checkPaymentStatus = async () => {
      try {
        const { data } = await axios.get(
          `https://api.mercadopago.com/v1/payments/${paymentId}`,
          {
            headers: {
              Authorization: `Bearer ${import.meta.env.VITE_MP_ACCESS_TOKEN}`,
            },
          }
        );

        if (data.status === "approved") {
          setStatus("✅ Pago aprobado. Gracias por tu compra.");
          setDetails(data);
          registrarNegocioEnSupabase(data);
        } else {
          setStatus(`⚠️ Pago con estado: ${data.status}`);
        }
      } catch (error) {
        console.error("Error al verificar pago:", error);
        setStatus("❌ Error al verificar el pago.");
      }
    };

    checkPaymentStatus();
  }, [searchParams]);

  return (
    <div style={{ padding: "2rem" }}>
      <h2>{status}</h2>
      {details && (
        <pre style={{ background: "#f4f4f4", padding: "1rem" }}>
          {JSON.stringify(details, null, 2)}
        </pre>
      )}
    </div>
  );
};

const registrarNegocioEnSupabase = async (data) => {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_KEY
    );

    const { data: supabaseData, error } = await supabase
      .from("negocios")
      .insert([
        {
          nombre: data.additional_info?.payer?.first_name || "Negocio test",
          pago_id: data.id,
          email: data.payer?.email || "",
          plan:
            data.additional_info?.items?.[0]?.title
              ?.split(" ")[1]
              ?.toLowerCase() || "pro",
          monto: data.transaction_amount || 0,
          status_pago: data.status,
        },
      ]);

    if (error) throw error;
    console.log("Negocio registrado en Supabase:", supabaseData);
  } catch (error) {
    console.error("Error al registrar en Supabase:", error);
  }
};

export default RegistroSuccess;
