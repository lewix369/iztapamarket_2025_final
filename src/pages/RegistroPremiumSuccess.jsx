// src/pages/RegistroPremiumSuccess.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useSearchParams } from "react-router-dom";

const RegistroPremiumSuccess = () => {
  const [descripcion, setDescripcion] = useState("");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const paymentId = searchParams.get("payment_id");

  useEffect(() => {
    if (!paymentId) {
      toast.error("ID de pago no encontrado.");
      return navigate("/planes");
    }

    const email = searchParams.get("email");
    console.log("Email recibido tras pago Premium:", email);

    if (!email) {
      toast.error("⚠️ Sesión no encontrada. Por favor inicia sesión.");
      return navigate("/ingresar");
    }

    const generarDescripcion = async () => {
      try {
        const negocios = await fetch(
          `${
            import.meta.env.VITE_SUPABASE_URL
          }/rest/v1/negocios?email=eq.${email}&select=*`,
          {
            headers: {
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
          }
        ).then((res) => res.json());

        if (!Array.isArray(negocios)) {
          toast.error("Respuesta inválida del servidor.");
          return;
        }

        // ✅ Actualiza o crea el negocio con upsert
        const upsertResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/negocios`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              Prefer: "resolution=merge-duplicates,return=representation",
            },
            body: JSON.stringify({
              nombre: "Negocio de prueba premium",
              email,
              categoria: "alimentos y bebidas",
              servicios: "Ejemplo de servicios",
              telefono: "5555555555",
              direccion: "Dirección de ejemplo",
              whatsapp: "5555555555",
              plan_type: "premium",
            }),
          }
        );

        if (!upsertResponse.ok) {
          toast.error("No se pudo registrar o actualizar el negocio.");
          return;
        }

        const retryData = await upsertResponse.json();
        const negocio = retryData[0];

        const { nombre, categoria, servicios } = negocio;

        if (!nombre || !categoria || !servicios) return;

        const response = await fetch(
          "http://127.0.0.1:54321/functions/v1/generate-description",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ nombre, categoria, servicios }),
          }
        );

        const result = await response.json();

        const updateResponse = await fetch(
          `${
            import.meta.env.VITE_SUPABASE_URL
          }/rest/v1/negocios?email=eq.${email}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              Prefer: "return=representation",
            },
            body: JSON.stringify({
              descripcion: result.descripcion,
              plan_type: "premium",
            }),
          }
        );

        const updateResult = await updateResponse.json();
        console.log("Resultado del update:", updateResult);

        if (!updateResponse.ok) {
          toast.error("❌ Error al actualizar la ficha del negocio.");
          return;
        }

        setDescripcion(
          result.descripcion || "No se pudo generar la descripción."
        );
        toast.success("¡Registro exitoso! Redirigiendo al panel...");
        setTimeout(() => navigate("/app/mi-negocio", { replace: true }), 2000);
      } catch (error) {
        console.error("Error al generar descripción:", error);
        setDescripcion("Error al generar la descripción.");
      }
    };

    generarDescripcion();
  }, []);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-6 bg-white text-center">
      <h1 className="text-3xl font-bold text-yellow-600 mb-4">
        🌟 ¡Bienvenido al Plan Premium!
      </h1>
      <p className="text-gray-700 mb-6">
        Tu negocio ha sido registrado con todos los beneficios premium. Pronto
        verás reflejada tu ficha optimizada en el directorio.
      </p>
      {descripcion && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 p-4 mb-4 max-w-xl">
          <p className="font-semibold">Descripción generada:</p>
          <p>{descripcion}</p>
        </div>
      )}
      <Link
        to="/app/mi-negocio"
        className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition"
      >
        Continuar con el registro
      </Link>
    </main>
  );
};

export default RegistroPremiumSuccess;
