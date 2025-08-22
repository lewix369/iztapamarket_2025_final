// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // ✅ Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // ✅ Solo permitimos POST (además de OPTIONS)
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const { nombre, categoria, servicios } = await req.json();
    console.log("✅ Solicitud recibida:", { nombre, categoria, servicios });

    // Validar campos obligatorios
    if (!nombre || !categoria || !servicios) {
      console.warn("⚠️ Faltan campos obligatorios");
      return new Response(
        JSON.stringify({ error: "Faltan campos obligatorios." }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Descripción generada
    const descripcionGenerada = `${nombre} es una marca reconocida en el sector de ${categoria}. Su propuesta de valor se basa en ofrecer ${servicios}, diferenciándose por su atención personalizada, enfoque en la experiencia del cliente y soluciones innovadoras. Ideal para quienes buscan calidad, confianza y un servicio pensado desde una visión profesional y estratégica.`;

    console.log("🧠 Descripción generada:", descripcionGenerada);

    return new Response(JSON.stringify({ descripcion: descripcionGenerada }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error("❌ Error al procesar:", error);
    return new Response(
      JSON.stringify({ error: "No se pudo procesar la solicitud" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
});
