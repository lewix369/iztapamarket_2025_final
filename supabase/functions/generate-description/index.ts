import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  try {
    const { nombre, categoria, servicios } = await req.json();

    const prompt = `Genera una descripción breve y atractiva para un negocio llamado "${nombre}", que pertenece a la categoría "${categoria}" y ofrece los siguientes servicios: ${servicios}. La descripción debe tener un máximo de 500 caracteres.`;

    const aiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
        },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [{ role: "user", content: prompt }],
        }),
      }
    );

    const aiData = await aiResponse.json();
    const textoGenerado = aiData.choices?.[0]?.message?.content?.trim();

    return new Response(JSON.stringify({ descripcion: textoGenerado }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error generando descripción:", error);
    return new Response(
      JSON.stringify({ error: "No se pudo generar la descripción" }),
      { status: 500 }
    );
  }
});
