import React, { useEffect, useState } from "react";
import axios from "axios";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";

const RegistroSuccess = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("Verificando...");
  const [details, setDetails] = useState(null);
  const navigate = useNavigate();

  const isSimulado = (id) => id?.toUpperCase().includes("SIMULADO");

  useEffect(() => {
    const paymentId = searchParams.get("payment_id");

    if (!paymentId) {
      setStatus("No se encontró el ID de pago.");
      return;
    }

    const checkPaymentStatus = async () => {
      // Simulación de pago si el payment_id contiene "SIMULADO"
      if (paymentId && paymentId.toUpperCase().includes("SIMULADO")) {
        const simulatedData = {
          id: "SIMULADO123",
          status: "approved",
          transaction_amount: 199,
          payer: { email: "prueba@correo.com" },
          additional_info: {
            payer: { first_name: "Negocio Simulado" },
            items: [{ title: "Plan Premium" }],
          },
        };

        setStatus("✅ Pago aprobado. (Simulado)");
        setDetails(simulatedData);
        registrarNegocioEnSupabase(simulatedData);
        return;
      }
      try {
        const { data } = await axios.get(
          `https://api.mercadopago.com/v1/payments/${paymentId}`,
          {
            headers: {
              Authorization: `Bearer ${import.meta.env.VITE_MP_ACCESS_TOKEN}`,
              "Content-Type": "application/json",
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

    const registrarNegocioEnSupabase = async (data) => {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_KEY
        );

        const correoNegocio =
          localStorage.getItem("correo_negocio") || data.payer?.email || "";

        const { data: existing, error: lookupError } = await supabase
          .from("negocios")
          .select("*")
          .eq("email", correoNegocio)
          .eq("pago_id", data.id)
          .single();

        if (existing) {
          console.log("Negocio ya registrado previamente:", existing);
          toast.success("Negocio previamente registrado. Redirigiendo...");
          setTimeout(() => navigate("/mi-negocio"), 2000);
          return;
        }
        if (lookupError && lookupError.code !== "PGRST116") throw lookupError;

        const { data: supabaseData, error } = await supabase
          .from("negocios")
          .insert([
            {
              nombre:
                localStorage.getItem("nombre_negocio") ||
                data.additional_info?.payer?.first_name ||
                "Negocio test",
              descripcion: localStorage.getItem("descripcion_negocio") || "",
              categoria: localStorage.getItem("categoria_negocio") || "",
              telefono: localStorage.getItem("telefono_negocio") || "",
              direccion: localStorage.getItem("direccion_negocio") || "",
              imagen_url: localStorage.getItem("imagen_url") || "",
              mapa_embed_url: localStorage.getItem("mapa_embed_url") || "",
              menu: localStorage.getItem("menu") || "",
              instagram: localStorage.getItem("instagram") || "",
              facebook: localStorage.getItem("facebook") || "",
              hours: localStorage.getItem("hours") || "",
              services: localStorage.getItem("services") || "",
              logo_url: localStorage.getItem("logo_url") || "",
              web: localStorage.getItem("web") || "",
              video_embed_url: localStorage.getItem("video_embed_url") || "",
              whatsapp: localStorage.getItem("whatsapp") || "",
              pago_id: data.id,
              email: correoNegocio,
              monto: data.transaction_amount || 0,
              plan: data.additional_info?.items?.[0]?.title
                ?.toLowerCase()
                .includes("premium")
                ? "premium"
                : "pro",
              status_pago: data.status,
            },
          ]);

        if (error) throw error;

        // Verifica si existe un usuario autenticado
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          console.error("No se pudo obtener el usuario autenticado.");
          throw userError || new Error("Usuario no autenticado.");
        }

        const negocioId = supabaseData?.[0]?.id;

        if (!negocioId) {
          throw new Error("No se obtuvo el ID del negocio recién creado.");
        }

        // Inserta en negocio_propietarios sólo si no existe ya esa relación
        const { data: propietarioExistente, error: lookupPropError } =
          await supabase
            .from("negocio_propietarios")
            .select("*")
            .eq("user_id", user.id)
            .eq("negocio_id", negocioId)
            .maybeSingle();

        if (!propietarioExistente) {
          const { error: propietarioError } = await supabase
            .from("negocio_propietarios")
            .insert([
              {
                user_id: user.id,
                negocio_id: negocioId,
              },
            ]);
          if (propietarioError) throw propietarioError;
        }

        localStorage.removeItem("correo_negocio");
        localStorage.removeItem("nombre_negocio");
        localStorage.removeItem("descripcion_negocio");
        localStorage.removeItem("categoria_negocio");
        localStorage.removeItem("telefono_negocio");
        localStorage.removeItem("direccion_negocio");
        localStorage.removeItem("imagen_url");
        localStorage.removeItem("mapa_embed_url");
        localStorage.removeItem("menu");
        localStorage.removeItem("instagram");
        localStorage.removeItem("facebook");
        localStorage.removeItem("hours");
        localStorage.removeItem("services");
        localStorage.removeItem("logo_url");
        localStorage.removeItem("web");
        localStorage.removeItem("video_embed_url");
        localStorage.removeItem("whatsapp");
        console.log("Negocio registrado en Supabase:", supabaseData);
        toast.success("¡Negocio registrado con éxito! Redirigiendo...");
        setTimeout(() => navigate("/mi-negocio"), 2000);
      } catch (error) {
        console.error("Error al registrar en Supabase:", error);
      }
    };

    checkPaymentStatus();
  }, [searchParams, navigate]);

  return (
    <div style={{ padding: "2rem" }}>
      <h2>{status}</h2>
      {details && (
        <pre style={{ background: "#f4f4f4", padding: "1rem" }}>
          {JSON.stringify(details, null, 2)}
        </pre>
      )}
      <button
        onClick={() => navigate("/mi-negocio")}
        style={{ marginTop: "1rem" }}
      >
        Ir a Mi Negocio
      </button>
    </div>
  );
};

export default RegistroSuccess;
