// src/lib/useUserProfile.js
import { supabase } from "./supabaseClient";

/**
 * Normaliza correos para comparaciones consistentes en BD.
 * - trim + toLowerCase
 */
function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

/**
 * Lee un perfil de plan por email desde la fuente indicada.
 * @param {string} email
 * @param {'user_profiles'|'v_profiles_plans'} source
 * @returns {Promise<{data: any, error: import('@supabase/supabase-js').PostgrestError|null}>}
 */
export async function getProfileByEmail(email, source = "user_profiles") {
  const norm = normalizeEmail(email);

  // Importante: incluir columnas explícitas para evitar 406 de PostgREST.
  return await supabase
    .from(source)
    .select("email, plan_type, plan_status, plan_expires_at, last_payment_status")
    .eq("email", norm)
    .maybeSingle();
}

/**
 * Obtiene el usuario logueado y su perfil de plan.
 * Intenta primero en `user_profiles` y opcionalmente en `v_profiles_plans` si no hay match.
 *
 * @param {'user_profiles'|'v_profiles_plans'|'auto'} source
 *   - 'user_profiles' (default): consulta solo esa tabla
 *   - 'v_profiles_plans': consulta solo esa vista
 *   - 'auto': intenta user_profiles y, si no hay fila, intenta v_profiles_plans
 *
 * @returns {Promise<{ user: any, profile: any, needsLogin: boolean, error: any }>}
 */
export async function getSessionAndProfile(source = "user_profiles") {
  try {
    // 1) Sesión/usuario actual
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) {
      return { user: null, profile: null, needsLogin: true, error: userErr };
    }

    const user = userData?.user || null;
    const email = normalizeEmail(user?.email);

    if (!email) {
      return { user: null, profile: null, needsLogin: true, error: null };
    }

    // 2) Perfil/plan
    let profile = null;
    let lastError = null;

    if (source === "auto") {
      // a) intenta en user_profiles
      {
        const { data, error } = await getProfileByEmail(email, "user_profiles");
        if (error) lastError = error;
        if (data) profile = data;
      }
      // b) si no hubo fila, intenta en la vista
      if (!profile) {
        const { data, error } = await getProfileByEmail(email, "v_profiles_plans");
        if (error) lastError = error;
        if (data) profile = data;
      }
    } else {
      const { data, error } = await getProfileByEmail(email, source);
      if (error) lastError = error;
      if (data) profile = data;
    }

    return { user: userData.user, profile, needsLogin: false, error: lastError };
  } catch (e) {
    // Falla segura: no rompe el flujo del caller
    console.error("[useUserProfile] getSessionAndProfile error:", e);
    return { user: null, profile: null, needsLogin: false, error: e };
  }
}