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
export const PUBLIC_BUSINESS_LIST_FIELDS = [
  "id",
  "nombre",
  "slug",
  "descripcion",
  "direccion",
  "portada_url",
  "imagen_url",
  "logo_url",
  "plan_type",
  "is_approved",
  "is_deleted",
  "categoria",
  "telefono",
  "hours",
  "lat",
  "lng",
  "plan_rank",
  "sort_name",
].join(",");

const applyPublicBusinessFilters = (q, query, planType, category) => {
  let filtered = q;

  if (planType) {
    filtered = filtered.eq(
      "plan_type",
      String(planType).toLowerCase().trim()
    );
  }
  if (category) filtered = filtered.eq("categoria", category);

  if (query) {
    const p = `%${query}%`;
    filtered = filtered.or(
      [
        `nombre.ilike.${p}`,
        `descripcion.ilike.${p}`,
        `categoria.ilike.${p}`,
        `slug.ilike.${p}`,
      ].join(",")
    );
  }

  return filtered;
};

export const searchBusinesses = async (
  supabase,
  query,
  planType,
  category,
  { page = 0, pageSize = 24 } = {}
) => {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("negocios")
    .select(PUBLIC_BUSINESS_LIST_FIELDS, { count: "exact" })
    .eq("is_deleted", false)
    .eq("is_approved", true);

  q = applyPublicBusinessFilters(q, query, planType, category);

  const { data, error, count } = await q
    .order("plan_rank", { ascending: true })
    .order("sort_name", { ascending: true })
    .order("id", { ascending: true })
    .range(from, to);

  if (error) {
    console.error("Error al buscar negocios:", error);
    return { data: [], count: 0, hasMore: false, error };
  }

  const rows = data || [];
  const total = count || 0;

  return {
    data: rows,
    count: total,
    hasMore: from + rows.length < total,
    error: null,
  };
};

// "Cerca de mí" necesita el conjunto global para ordenar correctamente por
// distancia. Se carga únicamente al activar esa función y solo con las columnas
// mínimas de las tarjetas.
export const getBusinessesForNearby = async (
  supabase,
  query,
  planType,
  category
) => {
  const batchSize = 1000;
  const allRows = [];

  for (let from = 0; ; from += batchSize) {
    let q = supabase
      .from("negocios")
      .select(PUBLIC_BUSINESS_LIST_FIELDS)
      .eq("is_deleted", false)
      .eq("is_approved", true)
      .not("lat", "is", null)
      .not("lng", "is", null);

    q = applyPublicBusinessFilters(q, query, planType, category);

    const { data, error } = await q
      .order("plan_rank", { ascending: true })
      .order("sort_name", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + batchSize - 1);

    if (error) {
      console.error("Error al cargar negocios para cercanía:", error);
      return { data: [], error };
    }

    const rows = data || [];
    allRows.push(...rows);

    if (rows.length < batchSize) break;
  }

  return { data: allRows, error: null };
};

// ---------------- Categorías (público) ----------------
// La función SQL devuelve únicamente los valores distintos. El resultado se
// comparte entre páginas para no repetir la misma consulta durante la sesión.
let distinctCategoriesCache = null;
let distinctCategoriesRequest = null;

export const getDistinctCategories = async (supabase) => {
  if (distinctCategoriesCache) return distinctCategoriesCache;
  if (distinctCategoriesRequest) return distinctCategoriesRequest;

  distinctCategoriesRequest = (async () => {
    const { data, error } = await supabase.rpc(
      "get_distinct_business_categories"
    );

    if (error) {
      console.error("Error al obtener categorías distintas:", error);
      return [];
    }

    distinctCategoriesCache = (data || [])
      .map((row) =>
        String(
          typeof row === "string" ? row : row?.categoria || ""
        )
          .toLowerCase()
          .trim()
      )
      .filter(Boolean);

    return distinctCategoriesCache;
  })();

  try {
    return await distinctCategoriesRequest;
  } finally {
    distinctCategoriesRequest = null;
  }
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
    .eq("is_featured", true)
    .order("plan_rank", { ascending: true })
    .order("sort_name", { ascending: true })
    .limit(8);

  if (error) console.error("Error al obtener negocios destacados:", error);

  const featured = data || [];
  if (featured.length >= 4) return featured;

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("negocios")
    .select("*")
    .eq("is_deleted", false)
    .eq("is_approved", true)
    .order("plan_rank", { ascending: true })
    .order("sort_name", { ascending: true })
    .limit(8);

  if (fallbackError) {
    console.error("Error al completar negocios destacados:", fallbackError);
    return featured;
  }

  const seen = new Set(featured.map((b) => b.id));
  const fallback = (fallbackData || []).filter((b) => !seen.has(b.id));
  return [...featured, ...fallback].slice(0, 8);
};

// ---------------- Listados (admin/KPIs) ----------------
const ADMIN_BUSINESS_FIELDS = [
  "id",
  "nombre",
  "slug",
  "categoria",
  "plan_type",
  "is_approved",
  "is_deleted",
  "telefono",
  "created_at",
].join(",");

const applyAdminBusinessFilters = (q, { search, category, plan, status }) => {
  let filtered = q;

  if (search?.trim()) {
    const p = `%${search.trim()}%`;
    filtered = filtered.or(
      [`nombre.ilike.${p}`, `categoria.ilike.${p}`, `slug.ilike.${p}`].join(
        ","
      )
    );
  }

  if (category && category !== "all") {
    filtered = filtered.eq("categoria", category);
  }

  if (plan && plan !== "all") {
    filtered = filtered.eq("plan_type", String(plan).toLowerCase().trim());
  }

  if (status === "approved") {
    filtered = filtered.eq("is_approved", true).eq("is_deleted", false);
  } else if (status === "rejected") {
    filtered = filtered.eq("is_approved", false).eq("is_deleted", false);
  } else if (status === "pending") {
    filtered = filtered.is("is_approved", null).eq("is_deleted", false);
  } else if (status === "eliminado") {
    filtered = filtered.eq("is_deleted", true);
  } else {
    filtered = filtered.eq("is_deleted", false);
  }

  return filtered;
};

const countAdminBusinesses = async (supabase, filters) => {
  let q = supabase
    .from("negocios")
    .select("id", { count: "exact", head: true });

  q = applyAdminBusinessFilters(q, filters);

  const { count, error } = await q;
  if (error) {
    console.error("Error al contar negocios admin:", error);
    return 0;
  }

  return count || 0;
};

export const getAdminBusinessStats = async (supabase) => {
  const [total, free, premium, pro] = await Promise.all([
    countAdminBusinesses(supabase, { status: "all" }),
    countAdminBusinesses(supabase, { status: "all", plan: "free" }),
    countAdminBusinesses(supabase, { status: "all", plan: "premium" }),
    countAdminBusinesses(supabase, { status: "all", plan: "pro" }),
  ]);

  return { total, free, premium, pro };
};

export const getAdminBusinessById = async (supabase, id) => {
  const { data, error } = await supabase
    .from("negocios")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Error al obtener negocio completo admin:", error);
    return null;
  }

  return data || null;
};

export const searchAdminBusinesses = async (
  supabase,
  {
    search = "",
    category = "all",
    plan = "all",
    status = "all",
    page = 0,
    pageSize = 50,
  } = {}
) => {
  const safePage = Math.max(0, Number(page) || 0);
  const safePageSize = Math.max(1, Number(pageSize) || 50);
  const from = safePage * safePageSize;
  const to = from + safePageSize - 1;

  let q = supabase
    .from("negocios")
    .select(ADMIN_BUSINESS_FIELDS, { count: "exact" });

  q = applyAdminBusinessFilters(q, { search, category, plan, status });

  const { data, error, count } = await q
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("Error al buscar negocios admin:", error);
    return { data: [], count: 0, page: safePage, pageSize: safePageSize };
  }

  return {
    data: data || [],
    count: count || 0,
    page: safePage,
    pageSize: safePageSize,
  };
};

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

// 🔧 UPDATE estricto: exige que Supabase devuelva la fila actualizada.
// Si RLS, ID equivocado o alguna regla impide actualizar, no mostramos éxito falso.
export const updateBusiness = async (supabase, businessId, updatedData) => {
  const payload = { ...updatedData };
  delete payload.id;
  delete payload.created_at;
  delete payload.updated_at;

  console.log("▶️ PATCH negocios", { id: businessId, payload });

  const { data, error } = await supabase
    .from("negocios")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", businessId)
    .select("*")
    .single();

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

  if (!data?.id) {
    const noRowError = new Error(
      "Supabase no devolvió ninguna fila actualizada. Puede ser RLS, ID incorrecto o una regla de permisos."
    );
    console.error("❌ UPDATE sin fila confirmada", {
      id: businessId,
      payload,
    });
    throw noRowError;
  }

  console.log("✅ UPDATE confirmado", {
    id: data.id,
    telefono: data.telefono,
    direccion: data.direccion,
    updated_at: data.updated_at,
  });

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
