import { createClient } from "@supabase/supabase-js";

// ⚠️ Verificación básica de variables de entorno. En producción podrías lanzar un error para prevenir ejecución sin credenciales.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("❌ Supabase credentials are missing. Check your .env file.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: {
      Accept: "application/json",
    },
  },
  // 📌 FUTURO: Si una función Edge necesita headers personalizados (Authorization, Content-Type), agrégalos directamente en esa llamada en lugar de aquí.
});
