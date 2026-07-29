// src/lib/database.js

// ---------------- Reseñas ----------------
const normalizeReview = (review) => ({
  ...review,
  rating: Number(review?.rating) || 0,
  tags: Array.isArray(review?.tags) ? review.tags : [],
  helpful_count: Number(review?.helpful_count) || 0,
  viewer_has_voted: Boolean(review?.viewer_has_voted),
});

export const getBusinessReviewSummaries = async (supabase, businessIds) => {
  const ids = Array.from(new Set((businessIds || []).filter(Boolean)));
  if (ids.length === 0) return {};

  const { data, error } = await supabase.rpc(
    "get_business_review_summaries",
    { p_business_ids: ids }
  );

  if (error) {
    console.error("Error al cargar resumen de reseñas:", error);
    return {};
  }

  return Object.fromEntries(
    (data || []).map((row) => [
      row.negocio_id,
      {
        rating: Number(row.rating) || 0,
        reviews_count: Number(row.reviews_count) || 0,
        would_return_percentage:
          row.would_return_percentage == null
            ? null
            : Number(row.would_return_percentage),
      },
    ])
  );
};

export const getBusinessReviews = async (supabase, businessId) => {
  const { data, error } = await supabase
    .from("business_reviews")
    .select(
      "id,negocio_id,user_id,author_name,rating,comment,would_return,tags,status,created_at,updated_at"
    )
    .eq("negocio_id", businessId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(normalizeReview);
};

export const getReviewHelpfulSummaries = async (supabase, reviewIds) => {
  const ids = Array.from(new Set((reviewIds || []).filter(Boolean)));
  if (ids.length === 0) return {};

  const { data, error } = await supabase.rpc(
    "get_review_helpful_summaries",
    { p_review_ids: ids }
  );
  if (error) throw error;

  return Object.fromEntries(
    (data || []).map((row) => [
      row.review_id,
      {
        helpful_count: Number(row.helpful_count) || 0,
        viewer_has_voted: Boolean(row.viewer_has_voted),
      },
    ])
  );
};

export const saveBusinessReview = async (
  supabase,
  {
    id,
    businessId,
    rating,
    comment,
    authorName,
    wouldReturn,
    tags,
  }
) => {
  const payload = {
    negocio_id: businessId,
    rating: Number(rating),
    comment: String(comment || "").trim() || null,
    author_name: String(authorName || "").trim() || "Usuario de IztapaMarket",
    would_return:
      typeof wouldReturn === "boolean" ? wouldReturn : null,
    tags: Array.from(new Set(Array.isArray(tags) ? tags : [])).slice(0, 3),
  };

  const query = id
    ? supabase
        .from("business_reviews")
        .update(payload)
        .eq("id", id)
    : supabase.from("business_reviews").insert([payload]);

  const { data, error } = await query
    .select(
      "id,negocio_id,user_id,author_name,rating,comment,would_return,tags,status,created_at,updated_at"
    )
    .single();

  if (error) throw error;
  return normalizeReview(data);
};

export const setReviewHelpful = async (
  supabase,
  reviewId,
  shouldVote
) => {
  if (shouldVote) {
    const { error } = await supabase
      .from("review_helpful_votes")
      .insert([{ review_id: reviewId }]);
    if (error && error.code !== "23505") throw error;
    return true;
  }

  const { error } = await supabase
    .from("review_helpful_votes")
    .delete()
    .eq("review_id", reviewId);
  if (error) throw error;
  return false;
};

export const deleteBusinessReview = async (supabase, reviewId) => {
  const { error } = await supabase
    .from("business_reviews")
    .delete()
    .eq("id", reviewId);
  if (error) throw error;
};

export const getAdminBusinessReviews = async (
  supabase,
  { status = "all", page = 0, pageSize = 20 } = {}
) => {
  const from = Math.max(0, Number(page) || 0) * pageSize;
  const to = from + pageSize - 1;
  let query = supabase
    .from("business_reviews")
    .select(
      "id,negocio_id,user_id,author_name,rating,comment,would_return,tags,status,created_at,negocios(nombre,slug)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status && status !== "all") query = query.eq("status", status);

  const { data, error, count } = await query;
  if (error) throw error;
  return {
    data: (data || []).map(normalizeReview),
    count: Number(count) || 0,
  };
};

export const updateBusinessReviewStatus = async (
  supabase,
  reviewId,
  status
) => {
  const { data, error } = await supabase
    .from("business_reviews")
    .update({ status })
    .eq("id", reviewId)
    .select("id,status")
    .single();
  if (error) throw error;
  return data;
};

// ---------------- Aprobación ----------------
export const updateApprovalStatus = async (supabase, businessId, status) => {
  const patch =
    status === true
      ? { is_approved: true, is_deleted: false, review_status: "reviewed" }
      : { is_approved: false, is_deleted: true, review_status: "reviewed" };

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
  "source_type",
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

export const PUBLIC_EXCLUDED_CATEGORY = "gobierno y comunidad";

const PUBLIC_SEARCH_ALIASES = [
  {
    pattern: /\b(taco|tacos|taqueria)\b/,
    terms: ["taco", "tacos", "taqueria", "taquería"],
  },
  {
    pattern: /\b(torta|tortas|torteria)\b/,
    terms: ["torta", "tortas", "torteria", "tortería", "loncheria", "lonchería"],
  },
  {
    pattern: /\b(dentista|dental|odontologo|odontologia)\b/,
    terms: ["dentista", "dental", "odontologo", "odontología", "ortodoncia"],
  },
  {
    pattern: /\b(mecanico|mecanica|automotriz)\b/,
    terms: ["mecanico", "mecánico", "mecanica", "automotriz", "taller mecanico"],
  },
  {
    pattern: /\b(plomero|plomeria|fontanero)\b/,
    terms: ["plomero", "plomeria", "plomería", "fontanero", "hidraulica"],
  },
  {
    pattern: /\b(abogado|legal|juridico)\b/,
    terms: ["abogado", "legal", "juridico", "jurídico", "despacho juridico"],
  },
  {
    pattern: /\b(psicologo|psicologia|terapia)\b/,
    terms: ["psicologo", "psicólogo", "psicologia", "terapia psicologica"],
  },
  {
    pattern: /\b(computadora|computadoras|computo|informatica)\b/,
    terms: [
      "computadora",
      "computadoras",
      "computo",
      "cómputo",
      "informatica",
      "soporte tecnico",
    ],
  },
  {
    pattern: /\b(electricista|electricidad)\b/,
    terms: ["electricista", "electricidad", "instalacion electrica"],
  },
  {
    pattern: /\b(estetica|belleza|peluqueria|barberia)\b/,
    terms: ["estetica", "estética", "belleza", "peluqueria", "barberia"],
  },
  {
    pattern: /\b(medico|doctor|doctora|clinica)\b/,
    terms: ["medico", "médico", "doctor", "doctora", "consultorio", "clinica"],
  },
  {
    pattern: /\b(hospital|hospitales|sanatorio|urgencias)\b/,
    terms: [
      "hospital",
      "hospitales",
      "sanatorio",
      "urgencias",
    ],
  },
  {
    pattern: /\b(veterinario|veterinaria|mascota|mascotas)\b/,
    terms: [
      "veterinario",
      "veterinaria",
      "clinica veterinaria",
      "clínica veterinaria",
    ],
  },
  {
    pattern: /\b(optica|optico|lentes|oftalmologo|oftalmologia)\b/,
    terms: [
      "optica",
      "óptica",
      "optico",
      "óptico",
      "lentes",
      "oftalmologo",
      "oftalmólogo",
      "examen de la vista",
    ],
  },
  {
    pattern: /\b(laboratorio|analisis clinicos|estudios medicos)\b/,
    terms: [
      "laboratorio",
      "analisis clinicos",
      "análisis clínicos",
      "estudios medicos",
      "estudios médicos",
    ],
  },
  {
    pattern: /\b(fisioterapia|fisioterapeuta|rehabilitacion|terapia fisica)\b/,
    terms: [
      "fisioterapia",
      "fisioterapeuta",
      "rehabilitacion",
      "rehabilitación",
      "terapia fisica",
      "terapia física",
    ],
  },
  {
    pattern: /\b(cerrajero|cerrajeria|llaves)\b/,
    terms: ["cerrajero", "cerrajeria", "cerrajería"],
  },
  {
    pattern: /\b(albanil|albanileria|remodelacion)\b/,
    terms: [
      "albanil",
      "albañil",
      "albanileria",
      "albañilería",
    ],
  },
  {
    pattern: /\b(carpintero|carpinteria|muebles)\b/,
    terms: [
      "carpintero",
      "carpinteria",
      "carpintería",
    ],
  },
  {
    pattern: /\b(papeleria|utiles escolares|copias|impresiones)\b/,
    terms: [
      "papeleria",
      "papelería",
      "utiles escolares",
      "útiles escolares",
    ],
  },
  {
    pattern: /\b(farmacia|medicamento|medicamentos)\b/,
    terms: ["farmacia", "medicamento", "medicamentos"],
  },
  {
    pattern: /\b(pan|panaderia|pasteleria)\b/,
    terms: ["pan", "panaderia", "panadería", "pasteleria", "pastelería"],
  },
];

const normalizePublicSearchTerm = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const getPublicSearchTerms = (query) => {
  const raw = String(query || "").trim();
  const normalized = normalizePublicSearchTerm(raw);
  if (!normalized) return [];

  const terms = new Set([raw, normalized]);
  normalized
    .split(" ")
    .filter((term) => term.length >= 3)
    .forEach((term) => terms.add(term));

  PUBLIC_SEARCH_ALIASES.forEach(({ pattern, terms: aliases }) => {
    if (pattern.test(normalized)) aliases.forEach((term) => terms.add(term));
  });

  return [...terms].slice(0, 12);
};

const buildPublicSearchExpression = (query) =>
  getPublicSearchTerms(query)
    .flatMap((term) => {
      const escaped = term.replace(/[,%().]/g, " ").trim();
      if (!escaped) return [];
      const pattern = `%${escaped}%`;
      return [
        `nombre.ilike.${pattern}`,
        `descripcion.ilike.${pattern}`,
        `categoria.ilike.${pattern}`,
        `slug.ilike.${pattern}`,
      ];
    })
    .join(",");

const toPublicTitleCase = (value) =>
  String(value || "")
    .toLocaleLowerCase("es-MX")
    .replace(/(^|[\s-])([a-záéíóúüñ])/g, (_, separator, letter) =>
      `${separator}${letter.toLocaleUpperCase("es-MX")}`
    )
    .replace(/\b(De|Del|La|Las|Los|Y|En)\b/g, (word, offset) =>
      offset === 0 ? word : word.toLocaleLowerCase("es-MX")
    );

const getPublicNeighborhood = (address) => {
  const match = String(address || "").match(
    /(?:^|,\s*)Col\.?\s+([^,]+)/i
  );
  return match?.[1] ? toPublicTitleCase(match[1].trim()) : "";
};

const getPublicCategoryLabel = (category) => {
  const value = String(category || "").trim();
  return value ? toPublicTitleCase(value) : "Negocio local";
};

export const getPublicBusinessName = (business) => {
  const explicitName = String(business?.display_name || "").trim();
  const officialName = explicitName || String(business?.nombre || "").trim();
  let publicName = officialName;

  if (
    business?.source_type === "denue" &&
    /^0\d{2,5}\s+\S/.test(publicName)
  ) {
    publicName = publicName.replace(/^0\d{2,5}\s+/, "").trim();
  }

  if (
    business?.source_type === "denue" &&
    /(?:\s+|^)sin nombre\s*$/i.test(publicName)
  ) {
    const activity = publicName
      .replace(/(?:\s+|^)sin nombre\s*$/i, "")
      .trim();
    const neighborhood = getPublicNeighborhood(business?.direccion);
    const baseName =
      activity || `Negocio de ${getPublicCategoryLabel(business?.categoria)}`;

    return neighborhood ? `${baseName} en ${neighborhood}` : baseName;
  }

  return publicName;
};

const stablePublicImageIndex = (value, size) => {
  let hash = 2166136261;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % size;
};

export const getPublicBusinessImage = (business) => {
  const cover = String(business?.portada_url || "").trim();
  const isManagedCover = cover.startsWith("/business-pool/");
  if (cover && !isManagedCover) return cover;

  const assignedImage = String(
    cover ||
      business?.imagen_url ||
      business?.cover_image_url ||
      business?.business_cover_url ||
      business?.image_url ||
      ""
  ).trim();
  const isManagedPoolImage =
    !assignedImage || assignedImage.startsWith("/business-pool/");
  const searchableText = normalizePublicSearchTerm(
    `${business?.nombre || ""} ${business?.descripcion || ""} ${
      business?.categoria || business?.category || ""
    }`
  );
  const isDenuePoolImage =
    business?.source_type === "denue" && isManagedPoolImage;
  const imagePool = /\b(dental|dentista|odontolog|ortodoncia)\b/.test(
    searchableText
  )
    ? { name: "dentista", size: 5 }
    : /\b(albanil|albanileria)\b/.test(searchableText)
    ? { name: "albanileria", size: 5 }
    : /\b(veterinari|mascota)\b/.test(searchableText)
    ? { name: "veterinaria", size: 74 }
    : /\b(hospital|medic|clinica|consultorio)\b/.test(
        searchableText
      )
    ? { name: "salud-y-bienestar", size: 58 }
    : null;

  if (isDenuePoolImage && imagePool) {
    const imageNumber =
      stablePublicImageIndex(
        business?.source_id || business?.id || business?.slug,
        imagePool.size
      ) + 1;
    return `/business-pool/${imagePool.name}/${imagePool.name}-${String(
      imageNumber
    ).padStart(3, "0")}.webp`;
  }

  return assignedImage || String(business?.logo_url || "").trim();
};

const decoratePublicBusinesses = (rows) =>
  (rows || []).map((business) => ({
    ...business,
    display_name: getPublicBusinessName(business),
  }));

const applyPublicBusinessFilters = (
  q,
  query,
  planType,
  category,
  { expandSearch = true } = {}
) => {
  let filtered = q.neq("categoria", PUBLIC_EXCLUDED_CATEGORY);

  if (planType) {
    filtered = filtered.eq(
      "plan_type",
      String(planType).toLowerCase().trim()
    );
  }
  if (category) filtered = filtered.eq("categoria", category);

  if (query) {
    const pattern = `%${String(query).trim()}%`;
    const expression = expandSearch
      ? buildPublicSearchExpression(query)
      : [
          `nombre.ilike.${pattern}`,
          `descripcion.ilike.${pattern}`,
          `categoria.ilike.${pattern}`,
          `slug.ilike.${pattern}`,
        ].join(",");
    if (expression) filtered = filtered.or(expression);
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

  if (query) {
    const { data: searchResult, error: searchError } = await supabase.rpc(
      "search_public_businesses",
      {
        p_query: query,
        p_plan: planType || null,
        p_category: category || null,
        p_offset: from,
        p_limit: pageSize,
      }
    );

    if (!searchError && searchResult) {
      const rows = decoratePublicBusinesses(
        Array.isArray(searchResult.data) ? searchResult.data : []
      );
      const total = Number(searchResult.count) || 0;
      return {
        data: rows,
        count: total,
        hasMore: from + rows.length < total,
        error: null,
      };
    }

    // Compatibilidad temporal mientras una migración nueva se propaga.
    console.error(
      "Error en búsqueda pública optimizada:",
      JSON.stringify(searchError)
    );
  }

  let dataQuery = supabase
    .from("negocios")
    .select(PUBLIC_BUSINESS_LIST_FIELDS)
    .eq("is_deleted", false)
    .eq("is_approved", true);

  let countQuery = supabase
    .from("negocios")
    .select("id", { count: "exact", head: true })
    .eq("is_deleted", false)
    .eq("is_approved", true);

  dataQuery = applyPublicBusinessFilters(
    dataQuery,
    query,
    planType,
    category
  );
  countQuery = applyPublicBusinessFilters(
    countQuery,
    query,
    planType,
    category
  );

  // El conteo exacto y la lectura ordenada usan planes distintos en Postgres.
  // En categorías pueden ejecutarse en paralelo gracias a sus índices. En una
  // búsqueda de texto se ejecutan en secuencia para no competir por el límite
  // de tiempo del servicio cuando el directorio tiene decenas de miles de filas.
  const orderedDataQuery = dataQuery
    .order("plan_rank", { ascending: true })
    .order("sort_name", { ascending: true })
    .order("id", { ascending: true })
    .range(from, to);

  let dataResult;
  let countResult;
  if (query) {
    dataResult = await orderedDataQuery;
    countResult = dataResult.error
      ? { count: 0, error: null }
      : await countQuery;
  } else {
    [dataResult, countResult] = await Promise.all([
      orderedDataQuery,
      countQuery,
    ]);
  }

  const error = dataResult.error || countResult.error;
  if (error) {
    // En la ruta de compatibilidad, el conteo exacto puede agotar el tiempo
    // aunque la página solicitada ya haya llegado correctamente. No descartamos
    // esos negocios: devolvemos un mínimo progresivo hasta que el RPC indexado
    // esté disponible.
    if (!dataResult.error) {
      const uncountedRows = decoratePublicBusinesses(dataResult.data);
      const hasMore = uncountedRows.length === pageSize;
      return {
        data: uncountedRows,
        count: from + uncountedRows.length + (hasMore ? 1 : 0),
        hasMore,
        error: null,
      };
    }

    if (query) {
      let literalDataQuery = supabase
        .from("negocios")
        .select(PUBLIC_BUSINESS_LIST_FIELDS)
        .eq("is_deleted", false)
        .eq("is_approved", true);
      let literalCountQuery = supabase
        .from("negocios")
        .select("id", { count: "exact", head: true })
        .eq("is_deleted", false)
        .eq("is_approved", true);

      literalDataQuery = applyPublicBusinessFilters(
        literalDataQuery,
        query,
        planType,
        category,
        { expandSearch: false }
      );
      literalCountQuery = applyPublicBusinessFilters(
        literalCountQuery,
        query,
        planType,
        category,
        { expandSearch: false }
      );

      const literalDataResult = await literalDataQuery
        .order("plan_rank", { ascending: true })
        .order("sort_name", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to);
      const literalCountResult = literalDataResult.error
        ? { count: 0, error: literalDataResult.error }
        : await literalCountQuery;

      if (!literalDataResult.error) {
        const literalRows = decoratePublicBusinesses(literalDataResult.data);
        const literalHasMore =
          literalCountResult.error && literalRows.length === pageSize;
        const literalTotal = literalCountResult.error
          ? from + literalRows.length + (literalHasMore ? 1 : 0)
          : literalCountResult.count || 0;
        return {
          data: literalRows,
          count: literalTotal,
          hasMore: literalCountResult.error
            ? literalHasMore
            : from + literalRows.length < literalTotal,
          error: null,
        };
      }
    }

    console.error("Error al buscar negocios:", JSON.stringify(error));
    return { data: [], count: 0, hasMore: false, error };
  }

  const rows = decoratePublicBusinesses(dataResult.data);
  const total = countResult.count || 0;

  return {
    data: rows,
    count: total,
    hasMore: from + rows.length < total,
    error: null,
  };
};

// "Cerca de mí" consulta únicamente el recuadro del radio solicitado y pagina
// después de calcular la distancia exacta; nunca descarga el directorio entero.
export const getBusinessesForNearby = async (
  supabase,
  query,
  planType,
  category,
  {
    lat,
    lng,
    radiusKm = 1,
    page = 0,
    pageSize = 24,
  } = {}
) => {
  const centerLat = Number(lat);
  const centerLng = Number(lng);
  const safeRadiusKm = Math.min(10, Math.max(0.25, Number(radiusKm) || 1));
  const safePage = Math.max(0, Number(page) || 0);
  const safePageSize = Math.min(100, Math.max(1, Number(pageSize) || 24));
  const from = safePage * safePageSize;

  if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) {
    return { data: [], count: 0, hasMore: false, error: null };
  }

  const { data: nearbyResult, error: nearbyError } = await supabase.rpc(
    "search_nearby_businesses",
    {
      p_lat: centerLat,
      p_lng: centerLng,
      p_radius_m: Math.round(safeRadiusKm * 1000),
      p_query: query || null,
      p_plan: planType || null,
      p_category: category || null,
      p_offset: from,
      p_limit: safePageSize,
    }
  );

  if (!nearbyError && nearbyResult) {
    const rows = decoratePublicBusinesses(
      Array.isArray(nearbyResult.data) ? nearbyResult.data : []
    ).map((business) => ({
      ...business,
      __distance_km: Number(business.distance_km),
    }));
    const total = Number(nearbyResult.count) || 0;
    return {
      data: rows,
      count: total,
      hasMore: from + rows.length < total,
      error: null,
    };
  }

  // Compatibilidad mientras la migración geográfica se despliega: limita la
  // descarga a un recuadro alrededor del usuario y aplica el radio exacto aquí.
  console.error(
    "Error en búsqueda cercana optimizada:",
    JSON.stringify(nearbyError)
  );
  const latDelta = safeRadiusKm / 110.574;
  const lngScale = Math.max(
    0.1,
    Math.cos((centerLat * Math.PI) / 180)
  );
  const lngDelta = safeRadiusKm / (111.32 * lngScale);
  const batchSize = 1000;
  const allRows = [];

  for (let batchFrom = 0; ; batchFrom += batchSize) {
    let q = supabase
      .from("negocios")
      .select(PUBLIC_BUSINESS_LIST_FIELDS)
      .eq("is_deleted", false)
      .eq("is_approved", true)
      .gte("lat", centerLat - latDelta)
      .lte("lat", centerLat + latDelta)
      .gte("lng", centerLng - lngDelta)
      .lte("lng", centerLng + lngDelta);

    q = applyPublicBusinessFilters(q, query, planType, category);

    const { data, error } = await q
      .order("id", { ascending: true })
      .range(batchFrom, batchFrom + batchSize - 1);

    if (error) {
      console.error("Error al cargar negocios para cercanía:", error);
      return { data: [], error };
    }

    const rows = data || [];
    allRows.push(...rows);

    if (rows.length < batchSize) break;
  }

  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const withDistance = decoratePublicBusinesses(allRows)
    .map((business) => {
      const businessLat = Number(business.lat);
      const businessLng = Number(business.lng);
      const dLat = toRadians(businessLat - centerLat);
      const dLng = toRadians(businessLng - centerLng);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(centerLat)) *
          Math.cos(toRadians(businessLat)) *
          Math.sin(dLng / 2) ** 2;
      const distanceKm =
        6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return { ...business, __distance_km: distanceKm };
    })
    .filter((business) => business.__distance_km <= safeRadiusKm)
    .sort(
      (left, right) =>
        left.__distance_km - right.__distance_km ||
        Number(left.plan_rank ?? 3) - Number(right.plan_rank ?? 3) ||
        String(left.sort_name || "").localeCompare(
          String(right.sort_name || ""),
          "es"
        )
    );

  const rows = withDistance.slice(from, from + safePageSize);
  return {
    data: rows,
    count: withDistance.length,
    hasMore: from + rows.length < withDistance.length,
    error: null,
  };
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
      // Compatibilidad para entornos donde la migración RPC aún no se ha
      // aplicado: usa el catálogo pequeño de categorías, nunca la tabla
      // completa de negocios.
      const { data: fallback, error: fallbackError } = await supabase
        .from("categorias")
        .select("nombre,slug_categoria")
        .order("nombre", { ascending: true });

      if (fallbackError) {
        console.error(
          "Error al obtener el catálogo de categorías:",
          fallbackError
        );
        return [];
      }

      distinctCategoriesCache = (fallback || [])
        .map((row) =>
          String(row?.nombre || row?.slug_categoria || "")
            .toLowerCase()
            .trim()
        )
        .filter(
          (category) =>
            Boolean(category) && category !== PUBLIC_EXCLUDED_CATEGORY
        );
      return distinctCategoriesCache;
    }

    distinctCategoriesCache = (data || [])
      .map((row) =>
        String(
          typeof row === "string" ? row : row?.categoria || ""
        )
          .toLowerCase()
          .trim()
      )
      .filter(
        (category) =>
          Boolean(category) && category !== PUBLIC_EXCLUDED_CATEGORY
      );

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
    .neq("categoria", PUBLIC_EXCLUDED_CATEGORY)
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
    .neq("categoria", PUBLIC_EXCLUDED_CATEGORY)
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

const toAdminSearchSlug = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const applyAdminBusinessFilters = (q, { search, category, plan, status }) => {
  let filtered = q;

  if (search?.trim()) {
    filtered = filtered.ilike("nombre", `%${search.trim()}%`);
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
    throw error;
  }

  return Number(count) || 0;
};

export const getAdminBusinessStats = async (supabase) => {
  const [free, premium, pro] = await Promise.all([
    countAdminBusinesses(supabase, { status: "all", plan: "free" }),
    countAdminBusinesses(supabase, { status: "all", plan: "premium" }),
    countAdminBusinesses(supabase, { status: "all", plan: "pro" }),
  ]);

  // El conteo general sin filtro puede agotar el statement timeout de
  // PostgREST. Los tres planes cubren todo el catálogo y sus índices permiten
  // obtener el mismo total de forma estable sin cargar filas en el navegador.
  const total = free + premium + pro;

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

  let dataQuery = supabase
    .from("negocios")
    .select(ADMIN_BUSINESS_FIELDS);
  let countQuery = supabase
    .from("negocios")
    .select("id", { count: "exact", head: true });

  const filters = { search, category, plan, status };
  dataQuery = applyAdminBusinessFilters(dataQuery, filters);
  countQuery = applyAdminBusinessFilters(countQuery, filters);

  // Con casi 90 mil filas, combinar el listado, el orden por created_at y el
  // conteo exacto en una sola consulta puede exceder el statement timeout de
  // PostgREST. La PK mantiene una paginación estable y ambas operaciones se
  // resuelven de forma independiente sobre todos los registros filtrados.
  const orderedDataQuery = dataQuery
    .order("id", { ascending: false })
    .range(from, to);

  let dataResult;
  let countResult;
  if (search?.trim()) {
    // ILIKE debe recorrer los nombres. Ejecutarlo a la vez que su conteo hace
    // que ambas consultas compitan por el statement timeout del proyecto.
    dataResult = await orderedDataQuery;
    countResult = dataResult.error
      ? { count: 0, error: null }
      : await countQuery;
  } else {
    [dataResult, countResult] = await Promise.all([
      orderedDataQuery,
      countQuery,
    ]);
  }

  const error = dataResult.error || countResult.error;
  if (error) {
    // Los nombres completos normalmente corresponden al inicio del slug. Esta
    // ruta usa su índice y rescata la búsqueda cuando ILIKE agota el tiempo,
    // sin cargar el catálogo completo en el navegador.
    const slugPrefix = toAdminSearchSlug(search);
    if (slugPrefix) {
      const fallbackFilters = { category, plan, status };
      let fallbackDataQuery = applyAdminBusinessFilters(
        supabase.from("negocios").select(ADMIN_BUSINESS_FIELDS),
        fallbackFilters
      );
      let fallbackCountQuery = applyAdminBusinessFilters(
        supabase
          .from("negocios")
          .select("id", { count: "exact", head: true }),
        fallbackFilters
      );

      fallbackDataQuery = fallbackDataQuery.like(
        "slug",
        `${slugPrefix}%`
      );
      fallbackCountQuery = fallbackCountQuery.like(
        "slug",
        `${slugPrefix}%`
      );

      const [fallbackDataResult, fallbackCountResult] = await Promise.all([
        fallbackDataQuery
          .order("id", { ascending: false })
          .range(from, to),
        fallbackCountQuery,
      ]);

      if (
        !fallbackDataResult.error &&
        !fallbackCountResult.error &&
        fallbackCountResult.count > 0
      ) {
        return {
          data: fallbackDataResult.data || [],
          count: fallbackCountResult.count,
          page: safePage,
          pageSize: safePageSize,
          error: null,
        };
      }
    }

    console.error("Error al buscar negocios admin:", error);
    return {
      data: [],
      count: 0,
      page: safePage,
      pageSize: safePageSize,
      error,
    };
  }

  return {
    data: dataResult.data || [],
    count: countResult.count || 0,
    page: safePage,
    pageSize: safePageSize,
    error: null,
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
  delete payload.plan_type;
  delete payload.user_id;
  delete payload.owner_user_id;
  delete payload.owner_email;

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
