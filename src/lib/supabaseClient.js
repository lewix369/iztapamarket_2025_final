import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client (frontend)
 * - Usa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
 * - NO fuerza el header Authorization (lo maneja la SDK)
 * - Añade `apikey` (anon) en headers globales para RLS
 * - Normaliza la URL y crea un singleton seguro para HMR
 */

// Variables de entorno (Vite)
const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validación defensiva para detectar .env sin cargar
if (!rawUrl || !anonKey) {
  console.error(
    "[supabaseClient] Faltan variables VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Revisa tu .env y reinicia Vite.",
    { urlPresent: !!rawUrl, anonKeyPresent: !!anonKey }
  );
  // En desarrollo, fallar duro para evitar estados inconsistentes
  if (import.meta.env?.DEV) {
    throw new Error(
      "[supabaseClient] Variables de entorno faltantes: VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY"
    );
  }
}

// Normaliza URL (sin barras finales)
const url = (rawUrl || "").replace(/\/+$/, "");

// Singleton explícito (previene múltiples instancias en HMR)
let _supabase;
export const supabase =
  _supabase ??
  (_supabase = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    global: {
      headers: {
        // No sobreescribas Authorization aquí; la SDK lo añade si hay sesión.
        apikey: anonKey,
      },
    },
  }));