// src/pages/RegistroProSuccess.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { supabase } from "@/lib/supabaseClient";

const RegistroProSuccess = () => {
  const [searchParams] = useSearchParams();
  const paidParam = searchParams.get("paid");
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [descripcion, setDescripcion] = useState("");

  // Modo sandbox con ?paid=true para pruebas
  if (paidParam === "true") {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen p-6 bg-white text-center">
        <h1 className="text-3xl font-bold text-green-600 mb-4">
          ✅ ¡Gracias por contratar el Plan Pro!
        </h1>
        <p className="text-gray-700 mb-6">
          Tu negocio ha sido registrado exitosamente. Esta es una vista de
          prueba usando ?paid=true
        </p>
        <Link
          to="/mi-negocio"
          className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition"
        >
          Ir al panel
        </Link>
      </main>
    );
  }

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        console.log("Cambio de sesión detectado:", session);
        setSession(session);
      }
    );

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("Error al obtener sesión:", error.message);
      } else {
        console.log("Sesión obtenida (inicial):", data.session);
        setSession(data.session);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user?.email) return;

    const nombre = localStorage.getItem("nombre");
    const categoria = localStorage.getItem("categoria");
    const servicios = localStorage.getItem("servicios");

    const registrarNegocio = async () => {
      try {
        // Verificar si ya hay un negocio para ese email
        const { data: existentes, error: fetchError } = await supabase
          .from("negocios")
          .select("*")
          .eq("email", session.user.email);

        if (fetchError) {
          console.error("Error al buscar negocio existente:", fetchError);
          toast.error("Error al verificar negocio.");
          return;
        }

        // Generar descripción con IA
        const result = await fetch(
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

        const { descripcion } = await result.json();
        const finalDescripcion = descripcion || "Descripción no generada.";
        setDescripcion(finalDescripcion);

        // Insertar o actualizar negocio con plan PRO
        const { error } = await supabase.from("negocios").upsert(
          {
            nombre,
            categoria,
            servicios,
            descripcion: finalDescripcion,
            plan_type: "pro",
            email: session.user.email,
          },
          { onConflict: "email" }
        );

        if (error) {
          console.error("Error al crear negocio:", error);
          toast.error("Hubo un problema al registrar tu negocio.");
          return;
        }

        toast.success("¡Registro exitoso! Redirigiendo al panel...");
        setTimeout(() => navigate("/mi-negocio"), 2000);
      } catch (err) {
        console.error("Error en la generación de descripción:", err);
        toast.error("No se pudo generar la descripción.");
      }
    };

    registrarNegocio();
  }, [navigate, session]);

  if (!session) {
    return (
      <main className="flex items-center justify-center min-h-screen p-6 bg-white text-center">
        <p className="text-gray-500 text-lg">Cargando datos de tu cuenta...</p>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-6 bg-white text-center">
      <h1 className="text-3xl font-bold text-green-600 mb-4">
        ✅ ¡Gracias por contratar el Plan Pro!
      </h1>
      <p className="text-gray-700 mb-6">
        Tu negocio ha sido registrado exitosamente con beneficios avanzados. En
        unos segundos serás redirigido automáticamente al panel para comenzar a
        gestionarlo, o puedes esperar nuestra verificación.
      </p>
      {descripcion && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-800 p-4 mb-4 max-w-xl">
          <p className="font-semibold">Descripción generada:</p>
          <p>{descripcion}</p>
        </div>
      )}
      <Link
        to="/"
        className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition"
      >
        Ir al inicio
      </Link>
    </main>
  );
};

export default RegistroProSuccess;
