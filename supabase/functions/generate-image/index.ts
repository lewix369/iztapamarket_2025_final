// Edge Function: generate-image (Deno)
// Generates a cover or a logo with OpenAI and saves it to Supabase Storage.

// Type defs for Supabase Edge Runtime APIs (autocomplete, types)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Use Deno std http server style helper
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
// Supabase admin client (ESM shim for Deno)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Helper: base64 -> Uint8Array
function base64ToUint8Array(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  try {
    // 1) Env vars (Deno)
    const SUPABASE_URL =
      Deno.env.get("SB_URL") ||
      Deno.env.get("PROJECT_URL") ||
      Deno.env.get("SUPABASE_URL");

    const SERVICE_ROLE_KEY =
      Deno.env.get("SB_SERVICE_ROLE_KEY") ||
      Deno.env.get("SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Faltan variables de entorno." }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Cast after validation so TS knows these are strings
    const SUPABASE_URL_SAFE = SUPABASE_URL as string;
    const SERVICE_ROLE_KEY_SAFE = SERVICE_ROLE_KEY as string;
    const OPENAI_API_KEY_SAFE = OPENAI_API_KEY as string;

    // 2) Body
    type ImagePayload = {
      businessId?: string;
      kind?: "cover" | "logo" | string;
      prompt?: string;
    };
    const { businessId, kind, prompt } = (await req
      .json()
      .catch(() => ({}))) as ImagePayload;
    if (
      !businessId ||
      typeof kind !== "string" ||
      !["cover", "logo"].includes(kind)
    ) {
      return new Response(
        JSON.stringify({
          error:
            "Parámetros inválidos. Se requiere { businessId, kind: 'cover'|'logo' }",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // 3) Supabase admin
    const admin = createClient(SUPABASE_URL_SAFE, SERVICE_ROLE_KEY_SAFE);

    // 4) Get business
    const { data: negocio, error: negocioErr } = await admin
      .from("negocios")
      .select(
        "id, user_id, nombre, categoria, plan_type, ai_portada_used, ai_logo_used"
      )
      .eq("id", businessId)
      .single();

    if (negocioErr || !negocio) {
      return new Response(JSON.stringify({ error: "Negocio no encontrado." }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // 5) Rules
    if (negocio.plan_type !== "premium") {
      return new Response(JSON.stringify({ error: "Plan no permitido." }), {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
    if (kind === "cover" && negocio.ai_portada_used === true) {
      return new Response(
        JSON.stringify({
          error: "La portada con IA ya fue generada para este negocio.",
          code: "AI_COVER_ALREADY_USED",
        }),
        {
          status: 409,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }
    if (kind === "logo" && negocio.ai_logo_used === true) {
      return new Response(
        JSON.stringify({
          error: "El logo con IA ya fue generado para este negocio.",
          code: "AI_LOGO_ALREADY_USED",
        }),
        {
          status: 409,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // 6) Prompt
    const defaultCoverPrompt = `Wide photo-style banner for small business "${
      negocio.nombre
    }" in category "${
      negocio.categoria ?? "negocio local"
    }". Clean composition, friendly, vibrant, readable space for title. No text in the image.`;
    const defaultLogoPrompt = `Minimal, modern logo for "${negocio.nombre}". Flat vector style, solid background or transparent, balanced icon. No text inside the logo image.`;
    const finalPrompt: string =
      prompt?.toString().trim() ||
      (kind === "cover" ? defaultCoverPrompt : defaultLogoPrompt);

    // 7) OpenAI Images
    const genRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY_SAFE}`,
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: finalPrompt,
        size: kind === "cover" ? "1536x1024" : "1024x1024",
      }),
    });

    if (!genRes.ok) {
      const t = await genRes.text();
      return new Response(
        JSON.stringify({ error: "OpenAI error", details: t }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const genJson = await genRes.json();
    const b64: string | undefined = genJson?.data?.[0]?.b64_json;
    if (!b64) {
      return new Response(
        JSON.stringify({ error: "No se recibió imagen de OpenAI." }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const bytes = base64ToUint8Array(b64);

    // 8) Upload to Storage
    const bucket = kind === "cover" ? "portadas" : "logos";
    const fileName = `${negocio.user_id}/${kind}-ai-${Date.now()}.png`;

    const { error: upErr } = await admin.storage
      .from(bucket)
      .upload(fileName, bytes, {
        contentType: "image/png",
        upsert: false,
      });
    if (upErr) {
      return new Response(
        JSON.stringify({
          error: "No se pudo subir a Storage.",
          details: upErr,
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const { data: pub } = admin.storage.from(bucket).getPublicUrl(fileName);
    const publicUrl: string | undefined = pub?.publicUrl;

    // 9) Update business flags
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (kind === "cover") {
      patch.portada_url = publicUrl ?? null;
      patch.ai_portada_used = true;
    } else {
      patch.logo_url = publicUrl ?? null;
      patch.ai_logo_used = true;
    }

    const { error: upBizErr } = await admin
      .from("negocios")
      .update(patch)
      .eq("id", negocio.id);
    if (upBizErr) {
      return new Response(
        JSON.stringify({
          error: "Imagen generada pero no se pudo actualizar el negocio.",
          details: upBizErr,
          url: publicUrl,
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    return new Response(JSON.stringify({ ok: true, url: publicUrl }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
