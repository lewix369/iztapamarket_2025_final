import { createClient } from "@supabase/supabase-js";

// Lee variables del entorno de Vite
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validación defensiva para detectar .env sin cargar
if (!url || !anonKey) {
  // Log claro en consola del navegador (no rompe la app en prod)
  // Si prefieres fallar duro, lanza un Error en lugar de console.error
  console.error(
    "[supabaseClient] Faltan variables VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Revisa tu .env y reinicia Vite.",
    { urlPresent: !!url, anonKeyPresent: !!anonKey }
  );
}

// Crea el cliente con headers globales para evitar 401 por falta de API key
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  },
});
