// Crea o actualiza el plan para un email (sin duplicar filas)
export default async function updatePlanByEmail(supabase, email, plan) {
  const { data, error } = await supabase
    .from("negocios")
    .upsert(
      { email, plan_type: plan }, // si no existe: crea; si existe: actualiza
      { onConflict: "email" } // requiere UNIQUE(email) en la tabla
    )
    .select("*");

  if (error) {
    console.error("updatePlanByEmail error:", error);
  } else {
    console.log("updatePlanByEmail ok:", data?.[0]);
  }
  return { data, error };
}
