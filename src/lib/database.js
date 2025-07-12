export const createReview = async (supabase, businessId, reviewText) => {
  const { error } = await supabase
    .from("reviews")
    .insert([{ negocio_id: businessId, texto: reviewText }]);

  if (error) {
    console.error("Error al crear reseña:", error);
    throw error;
  }
};

export const updateApprovalStatus = async (supabase, businessId, status) => {
  const { error } = await supabase
    .from("negocios")
    .update({ is_approved: status })
    .eq("id", businessId)
    .select();

  if (error) {
    console.error("Error al actualizar estado de aprobación:", error);
    throw error;
  }

  console.log("✅ Estado de aprobación actualizado:", { businessId, status });
};

export const searchBusinesses = async (supabase, query, planType, category) => {
  let request = supabase
    .from("negocios")
    .select("*")
    .eq("is_deleted", false)
    .eq("is_approved", true);

  if (query) {
    request = request.ilike("nombre", `%${query}%`);
  }

  if (planType) {
    request = request.eq("plan_type", planType);
  }

  if (category) {
    request = request.eq("categoria", category);
  }

  const { data, error } = await request;

  if (error) {
    console.error("Error al buscar negocios:", error);
    return [];
  }

  console.log("Resultados de búsqueda:", data);

  return data;
};

export const getDistinctCategories = async (supabase) => {
  const { data, error } = await supabase
    .from("negocios")
    .select("categoria", { count: "exact", distinct: true })
    .eq("is_deleted", false);

  if (error) {
    console.error("Error al obtener categorías distintas:", error);
    return [];
  }

  return data.map((item) => item.categoria);
};

export const createBusiness = async (supabase, businessData) => {
  const { data, error } = await supabase
    .from("negocios")
    .insert([{ ...businessData, is_approved: true }])
    .select()
    .single();

  if (error) {
    console.error(
      "❌ Error al crear negocio:",
      error.message,
      error.details || error.hint || error.code
    );
    return null;
  }

  console.log("✅ Negocio creado con éxito:", data);
  return data;
};

export const softDeleteBusiness = async (supabase, businessId) => {
  console.log("🗑 Eliminando definitivamente negocio con ID:", businessId);
  const { error } = await supabase
    .from("negocios")
    .delete()
    .eq("id", businessId);

  if (error) {
    console.error("Error al hacer hard delete:", error);
    throw error;
  }

  console.log("✅ Negocio eliminado completamente de la base de datos.");
};

export const getFeaturedBusinesses = async (supabase) => {
  const { data, error } = await supabase
    .from("negocios")
    .select("*")
    .eq("is_deleted", false)
    .eq("is_approved", true)
    .eq("is_featured", true);

  if (error) {
    console.error("Error al obtener negocios destacados:", error);
    return [];
  }

  return data;
};

export const getBusinesses = async (supabase) => {
  const { data, error } = await supabase
    .from("negocios")
    .select("*", { count: "exact" })
    .eq("is_deleted", false)
    .eq("is_approved", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error al obtener negocios:", error);
    return [];
  }

  console.log(data);
  return data;
};

export const updateBusiness = async (supabase, businessId, updatedData) => {
  const { data, error } = await supabase
    .from("negocios")
    .update(updatedData)
    .eq("id", businessId)
    .select()
    .single();

  if (error) {
    console.error("❌ Error al actualizar negocio:", error.message);
    throw error;
  }

  console.log("✅ Negocio actualizado con éxito:", data);
  return data;
};

export const getAllBusinesses = async (supabase) => {
  const { data, error } = await supabase
    .from("negocios")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error al obtener todos los negocios:", error);
    return [];
  }

  return data;
};

export const deleteBusiness = async (supabase, businessId) => {
  console.log("🗑 Eliminando definitivamente negocio con ID:", businessId);
  const { error } = await supabase
    .from("negocios")
    .delete()
    .eq("id", businessId);

  if (error) {
    console.error("Error al hacer hard delete:", error);
    throw error;
  }

  console.log("✅ Negocio eliminado completamente de la base de datos.");
};
