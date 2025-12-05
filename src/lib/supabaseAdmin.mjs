// src/lib/supabaseAdmin.mjs
import { createClient } from "@supabase/supabase-js";

// Inicialización perezosa para evitar fallar en import si aún no hay .env cargado
let _admin = null;

function _init() {
  if (_admin) return _admin;

  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL || // por si viene con prefijo VITE_
    "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!url || !key) {
    // No inicializar ni mostrar warnings aquí
    return null;
  }

  _admin = createClient(url, key);
  return _admin;
}

// Obtén SIEMPRE el cliente a través de esta función
export function getSupabaseAdmin() {
  const c = _init();
  if (!c) {
    throw new Error(
      "Supabase no está configurado aún (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY faltan)."
    );
  }
  return c;
}

// No inicializar automáticamente en import para evitar warnings tempranos
export default null;

// ---------------------------------------------------------
// Funciones administrativas (auto-upsert de negocios)
// ---------------------------------------------------------

/**
 * Obtiene el user_id desde Auth (admin) usando el email
 */
export async function getUserIdByEmail(email) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.auth.admin.getUserByEmail(email);

  if (error || !data?.user) {
    console.error("❌ No se encontró usuario con email:", email, error);
    return null;
  }

  return data.user.id;
}

/**
 * Crea o actualiza automáticamente el negocio de un usuario
 * según su email y el plan pagado (free, pro, premium)
 */
export async function upsertBusinessByEmail(email, planType = "free") {
  const supabase = getSupabaseAdmin();

  // 1) Buscar user_id por email
  const userId = await getUserIdByEmail(email);
  if (!userId) {
    throw new Error(`No existe un usuario para el correo: ${email}`);
  }

  // 2) Crear slug automático
  const slug = `negocio-${userId}`.toLowerCase();

  // 3) Upsert para negocio
  const { data, error } = await supabase
    .from("negocios")
    .upsert(
      {
        user_id: userId,
        nombre: "Negocio De Prueba",
        descripcion: "Descripción generada automáticamente.",
        categoria: "sin-categoria",
        telefono: "",
        direccion: "",
        plan_type: planType,
        slug,
        created_at: new Date().toISOString()
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) {
    console.error("❌ Error en upsert de negocio:", error);
    throw error;
  }

  console.log(`✅ Negocio actualizado/creado para ${email} → plan: ${planType}`);
  return data;
}
