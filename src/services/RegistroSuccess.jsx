import React, { useEffect, useState } from "react";
import axios from "axios";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";

const RegistroSuccess = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("Verificando...");
  const [details, setDetails] = useState(null);
  const navigate = useNavigate();

  // Helper: intenta extraer plan de external_reference (formato "email|plan|tag")
  const planFromExternalRef = (externalRef) => {
    if (!externalRef) return null;
    const parts = String(externalRef).split("|");
    return parts[1] ? String(parts[1]).toLowerCase() : null;
  };

  useEffect(() => {
    const paymentId = searchParams.get("payment_id");
    const urlStatus = (searchParams.get("status") || "").toLowerCase();
    const externalRef = searchParams.get("external_reference");

    // Mensaje inmediato si la URL ya dice approved (mejor UX)
    if (urlStatus === "approved") {
      setStatus("✅ Pago aprobado. Procesando registro...");
    }

    if (!paymentId) {
      setStatus("No se encontró el ID de pago.");
      return;
    }

    const checkPaymentStatus = async () => {
      // 💡 Modo simulación (si el ID contiene SIMULADO)
      if (paymentId.toUpperCase().includes("SIMULADO")) {
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
        // 👉 Llamamos a nuestro backend, NO a la API pública de MP
        const base = import.meta.env.VITE_MP_BASE || "";
        const { data } = await axios.get(`${base}/mp/payment/${paymentId}`);

        if (data.status === "approved") {
          setStatus("✅ Pago aprobado. Gracias por tu compra.");
          setDetails(data);
          registrarNegocioEnSupabase(data);
        } else {
          setStatus(`⚠️ Pago con estado: ${data.status}`);
          setDetails(data);
        }
      } catch (error) {
        console.error(
          "Error al verificar pago:",
          error?.response?.data || error
        );
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
          localStorage.getItem("correo_negocio") || data?.payer?.email || "";

        // Evita duplicados por (email, pago_id)
        const { data: existing, error: lookupError } = await supabase
          .from("negocios")
          .select("*")
          .eq("email", correoNegocio)
          .eq("pago_id", data.id)
          .single();

        if (existing) {
          console.log("Negocio ya registrado previamente:", existing);
          toast.success("Negocio previamente registrado. Redirigiendo...");
          setTimeout(() => navigate("/mi-negocio"), 1500);
          return;
        }
        if (lookupError && lookupError.code !== "PGRST116") throw lookupError;

        // Determinar plan con fallback: additional_info -> external_reference -> "pro"
        const planInferido = (data?.additional_info?.items?.[0]?.title || "")
          .toLowerCase()
          .includes("premium")
          ? "premium"
          : planFromExternalRef(externalRef) || "pro";

        const { data: supData, error } = await supabase
          .from("negocios")
          .insert([
            {
              nombre:
                localStorage.getItem("nombre_negocio") ||
                data?.additional_info?.payer?.first_name ||
                "Negocio",
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
              plan: planInferido,
              status_pago: data.status,
            },
          ])
          .select();

        if (error) throw error;

        // Intenta asociar propietario si hay sesión; si no, no frenes el flujo
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        const negocioId = supData?.[0]?.id;

        if (user && negocioId) {
          const { data: existente, error: lookupPropError } = await supabase
            .from("negocio_propietarios")
            .select("*")
            .eq("user_id", user.id)
            .eq("negocio_id", negocioId)
            .maybeSingle();

          if (!existente) {
            const { error: propietarioError } = await supabase
              .from("negocio_propietarios")
              .insert([{ user_id: user.id, negocio_id: negocioId }]);
            if (propietarioError)
              console.warn("propietario error:", propietarioError);
          }
        } else {
          console.warn(
            "No hay usuario autenticado; se omitió relación propietario."
          );
        }

        // Limpia el “wizard”
        [
          "correo_negocio",
          "nombre_negocio",
          "descripcion_negocio",
          "categoria_negocio",
          "telefono_negocio",
          "direccion_negocio",
          "imagen_url",
          "mapa_embed_url",
          "menu",
          "instagram",
          "facebook",
          "hours",
          "services",
          "logo_url",
          "web",
          "video_embed_url",
          "whatsapp",
        ].forEach(localStorage.removeItem.bind(localStorage));

        console.log("Negocio registrado en Supabase:", supData);
        toast.success("¡Negocio registrado con éxito! Redirigiendo…");
        setTimeout(() => navigate("/mi-negocio"), 1500);
      } catch (error) {
        console.error("Error al registrar en Supabase:", error);
        toast.error("No se pudo registrar el negocio.");
      }
    };

    // Log útil para depurar redirecciones
    console.log("🔎 query params:", Object.fromEntries(searchParams.entries()));

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
