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
