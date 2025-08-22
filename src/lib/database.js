// src/lib/database.js

// ---------------- Reseñas ----------------
export const createReview = async (supabase, businessId, reviewText) => {
  const { error } = await supabase
    .from("reviews")
    .insert([{ negocio_id: businessId, texto: reviewText }]);

  if (error) {
    console.error("Error al crear reseña:", error);
    throw error;
  }
};

// ---------------- Aprobación ----------------
export const updateApprovalStatus = async (supabase, businessId, status) => {
  const patch =
    status === true
      ? { is_approved: true, is_deleted: false }
      : { is_approved: false, is_deleted: true };

  const { error } = await supabase
    .from("negocios")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", businessId); // return=minimal

  if (error) {
    console.error("Error al actualizar estado de aprobación:", error);
    return { data: null, error };
  }
  return { data: { id: businessId, ...patch }, error: null };
};

// ---------------- Búsquedas (público) ----------------
export const searchBusinesses = async (supabase, query, planType, category) => {
  let q = supabase
    .from("negocios")
    .select("*")
    .eq("is_deleted", false)
    .eq("is_approved", true);

  if (planType) q = q.eq("plan_type", String(planType).toLowerCase().trim());
  if (category) q = q.eq("categoria", category);

  if (query) {
    const p = `%${query}%`;
    q = q.or(
      [
        `nombre.ilike.${p}`,
        `descripcion.ilike.${p}`,
        `categoria.ilike.${p}`,
        `slug.ilike.${p}`,
      ].join(",")
    );
  }

  const { data, error } = await q.order("created_at", { ascending: false });

  if (error) {
    console.error("Error al buscar negocios:", error);
    return [];
  }

  return data || [];
};

// ---------------- Categorías (público) ----------------
export const getDistinctCategories = async (supabase) => {
  const { data, error } = await supabase
    .from("negocios")
    .select("categoria")
    .eq("is_deleted", false)
    .eq("is_approved", true);

  if (error) {
    console.error("Error al obtener categorías distintas:", error);
    return [];
  }

  return [
    ...new Set(
      (data || [])
        .map((r) => (r?.categoria || "").toLowerCase().trim())
        .filter(Boolean)
    ),
  ];
};

// ---------------- Crear / Actualizar / Eliminar ----------------
export const createBusiness = async (supabase, businessData) => {
  const payload = { ...businessData };
  delete payload.id;
  delete payload.created_at;
  delete payload.updated_at;

  const { data, error } = await supabase
    .from("negocios")
    .insert([payload])
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
  return data;
};

// Soft delete
export const softDeleteBusiness = async (supabase, businessId) => {
  const { error } = await supabase
    .from("negocios")
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .eq("id", businessId);

  if (error) {
    console.error("Error en soft delete:", error);
    throw error;
  }
};

// Hard delete
export const deleteBusiness = async (supabase, businessId) => {
  const { error } = await supabase
    .from("negocios")
    .delete()
    .eq("id", businessId);
  if (error) {
    console.error("Error al hacer hard delete:", error);
    throw error;
  }
};

// ---------------- Destacados ----------------
export const getFeaturedBusinesses = async (supabase) => {
  const { data, error } = await supabase
    .from("negocios")
    .select("*")
    .eq("is_deleted", false)
    .eq("is_approved", true)
    .eq("is_featured", true);

  if (error) console.error("Error al obtener negocios destacados:", error);
  return data || [];
};

// ---------------- Listados (admin/KPIs) ----------------
export const getBusinesses = async (supabase) => {
  const { data, error } = await supabase
    .from("negocios")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error al obtener negocios:", error);
    return [];
  }
  return data || [];
};

// 🔧 UPDATE robusto: return=minimal + select aparte + logs claros
export const updateBusiness = async (supabase, businessId, updatedData) => {
  const payload = { ...updatedData };
  delete payload.id;
  delete payload.created_at;
  delete payload.updated_at;

  console.log("▶️ PATCH negocios", { id: businessId, payload });

  const { error } = await supabase
    .from("negocios")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", businessId); // return=minimal por defecto

  if (error) {
    console.error("❌ PostgREST UPDATE error", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      payload,
    });
    throw error;
  }

  const { data, error: fetchError } = await supabase
    .from("negocios")
    .select("*")
    .eq("id", businessId)
    .single();

  if (fetchError) {
    console.warn(
      "⚠️ Update OK, pero falló el SELECT de confirmación:",
      fetchError
    );
    return { id: businessId, ...payload };
  }
  return data;
};

// Todos sin filtros
export const getAllBusinesses = async (supabase) => {
  const { data, error } = await supabase
    .from("negocios")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error al obtener todos los negocios:", error);
    return [];
  }
  return data || [];
};
