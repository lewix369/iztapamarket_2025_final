// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

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
    const { nombre, categoria, servicios, ciudad, tono } = await req.json();
    console.log("✅ Solicitud recibida:", {
      nombre,
      categoria,
      servicios,
      ciudad,
      tono,
    });

    // Validar campos obligatorios (solo nombre y categoría)
    if (!nombre || !categoria) {
      console.warn("⚠️ Faltan campos obligatorios: nombre/categoria");
      return new Response(
        JSON.stringify({
          error: "Faltan campos obligatorios: nombre y categoría.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Generación de descripción (OpenAI si hay API Key; si no, fallback determinístico)
    const ciudadSafe = ciudad || "Iztapalapa, CDMX";
    const tonoSafe = tono || "profesional y cercano";
    const serviciosSafe = servicios || "servicios de alta calidad";

    // Si no hay API KEY, usamos el texto determinístico actual como fallback
    async function fallbackDescripcion() {
      const texto = `${nombre} es una marca reconocida en el sector de ${categoria} en ${ciudadSafe}. Su propuesta de valor se basa en ofrecer ${serviciosSafe}, diferenciándose por su atención personalizada, enfoque en la experiencia del cliente y soluciones innovadoras. Ideal para quienes buscan calidad, confianza y un servicio pensado desde una visión ${tonoSafe}.`;
      return texto;
    }

    if (!OPENAI_API_KEY) {
      console.warn("⚠️ OPENAI_API_KEY no configurada, usando fallback.");
      const descripcion = await fallbackDescripcion();
      return new Response(JSON.stringify({ descripcion }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    // Build prompt
    const prompt = `
Genera una descripción breve (80-120 palabras) para un negocio llamado "${nombre}".
Categoría: ${categoria}. Ciudad: ${ciudadSafe}. Tono: ${tonoSafe}.
Servicios/énfasis: ${serviciosSafe}.
Enfatiza beneficios y propuesta de valor. No uses emojis ni precios. Devuelve solo el párrafo final.
    `.trim();

    try {
      const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "Eres un redactor de marketing local que escribe textos claros y persuasivos.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
        }),
      });

      if (!aiResp.ok) {
        const errText = await aiResp.text();
        console.error("❌ OpenAI error:", errText);
        const descripcion = await fallbackDescripcion();
        return new Response(
          JSON.stringify({ descripcion, warning: "openai_fallback" }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }

      const data = await aiResp.json();
      const descripcion =
        data?.choices?.[0]?.message?.content?.trim() ||
        (await fallbackDescripcion());

      console.log("🧠 Descripción generada:", descripcion);

      return new Response(JSON.stringify({ descripcion }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    } catch (e) {
      console.error("❌ Error llamando a OpenAI:", e);
      const descripcion = await fallbackDescripcion();
      return new Response(
        JSON.stringify({ descripcion, warning: "openai_error_fallback" }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }
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
