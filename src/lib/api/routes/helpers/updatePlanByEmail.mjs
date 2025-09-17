// src/lib/api/helpers/updatePlanByEmail.mjs
export default async function updatePlanByEmail(supabase, email, plan) {
  const { data, error } = await supabase
    .from("negocios")
    .upsert(
      { email, plan_type: plan }, // si no existe: crea; si existe: actualiza
      { onConflict: "email" } // requiere UNIQUE(email)
    )
    .select("*");

  if (error) {
    console.error("updatePlanByEmail error:", error);
  } else {
    console.log("updatePlanByEmail ok:", data?.[0]);
  }
  return { data, error };
}
