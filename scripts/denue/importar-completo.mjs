import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const args = new Set(process.argv.slice(2));
const apply = args.has("--aplicar");
const publish = args.has("--publicar");
const auditDir = path.resolve(
  process.env.DENUE_AUDIT_DIR ||
    "/Users/luiscarrillo/Documents/Codex/2026-07-23/referenced-chatgpt-conversation-this-is-untrusted/work/denue-auditoria-oficial"
);
const missingPath = path.join(
  auditDir,
  "reconciliacion-completa-faltantes.json"
);
const matchesPath = path.join(
  auditDir,
  "reconciliacion-completa-coincidencias.json"
);
const stalePath = path.join(
  auditDir,
  "reconciliacion-completa-no-vigentes.json"
);
const publicPoolDir = path.resolve("public/business-pool");
const batchSize = 250;

const supabaseUrl =
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "";

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Faltan URL o SUPABASE_SERVICE_ROLE en el entorno.");
}
if (publish && !apply) {
  throw new Error("--publicar requiere también --aplicar.");
}

const client = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const categoryDefinitions = [
  {
    nombre: "Industria y Mayoreo",
    slug_categoria: "industria-y-mayoreo",
    descripcion: "Fabricación, producción y comercio al por mayor",
    icono: "🏭",
    color: "from-slate-500 to-gray-700",
  },
  {
    nombre: "Hogar y Construcción",
    slug_categoria: "hogar-y-construccion",
    descripcion: "Construcción, mantenimiento y servicios para el hogar",
    icono: "🏗️",
    color: "from-amber-500 to-orange-600",
  },
  {
    nombre: "Transporte y Logística",
    slug_categoria: "transporte-y-logistica",
    descripcion: "Transporte, mensajería, almacenamiento y logística",
    icono: "🚚",
    color: "from-cyan-500 to-blue-600",
  },
  {
    nombre: "Finanzas e Inmuebles",
    slug_categoria: "finanzas-e-inmuebles",
    descripcion: "Servicios financieros, seguros y bienes raíces",
    icono: "🏦",
    color: "from-emerald-500 to-teal-600",
  },
  {
    nombre: "Servicios Profesionales",
    slug_categoria: "servicios-profesionales",
    descripcion: "Servicios profesionales, administrativos y empresariales",
    icono: "💼",
    color: "from-blue-500 to-indigo-600",
  },
  {
    nombre: "Entretenimiento y Cultura",
    slug_categoria: "entretenimiento-y-cultura",
    descripcion: "Cultura, deporte, recreación y entretenimiento",
    icono: "🎭",
    color: "from-purple-500 to-pink-600",
  },
  {
    nombre: "Servicios",
    slug_categoria: "servicios",
    descripcion: "Servicios personales y de apoyo cerca de ti",
    icono: "🧰",
    color: "from-zinc-500 to-slate-600",
  },
  {
    nombre: "Gobierno y Comunidad",
    slug_categoria: "gobierno-y-comunidad",
    descripcion: "Instituciones públicas, asociaciones y servicios comunitarios",
    icono: "🏛️",
    color: "from-sky-500 to-indigo-600",
  },
];

const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const slugify = (value) => normalize(value).replace(/\s+/g, "-") || "negocio";
const textOf = (candidate) =>
  normalize(`${candidate.Nombre} ${candidate.Clase_actividad}`);
const has = (text, pattern) => pattern.test(text);
const stableNumber = (value) =>
  Number.parseInt(createHash("sha256").update(String(value)).digest("hex").slice(0, 8), 16);

const categoryFor = (candidate) => {
  const sector = String(candidate.__sector || candidate.SECTOR_ACTIVIDAD_ID || "");
  const text = textOf(candidate);
  if (
    has(text, /\b(taco|torteria|restaurante|cocina|antojito|pizzeria|pizza|cafeteria|fond[ao]|comedor|bar|cantina|pozole|birria|marisco|hamburguesa|tamale|churro)\b/)
  ) return ["Restaurantes", "restaurantes"];
  if (
    has(text, /\b(abarrote|miscelanea|fruta|verdura|carniceria|panaderia|pasteleria|dulceria|tortilleria|alimento|bebida|cerveza|vinateria|polleria|pescaderia|cremeria|semilla|molino)\b/)
  ) return ["Alimentos y Bebidas", "alimentos-y-bebidas"];
  if (has(text, /\b(estetica|belleza|peluquer|barber|unas|manicure|spa|cosmet)\b/))
    return ["Belleza", "belleza"];
  if (
    has(text, /\b(taller mecan|automotriz|auto ?parte|refaccion|vulcaniz|hojalateria|vehiculo|motocicleta|lavado de auto|estacionamiento)\b/)
  ) return ["Automotriz", "automotriz"];
  if (
    has(text, /\b(computador|software|internet|telefonia|celular|electronica|tecnolog|reparacion de equipo)\b/) ||
    sector === "51"
  ) return ["Tecnología", "tecnologia"];
  if (sector === "61") return ["Educación", "educacion"];
  if (sector === "62" || has(text, /\b(medic|dental|dentista|farmacia|hospital|clinica|laboratorio|salud|consultorio|psicolog|terapia)\b/))
    return ["Salud", "salud"];
  if (["11", "21", "22", "31", "32", "33", "43"].includes(sector))
    return ["Industria y Mayoreo", "industria-y-mayoreo"];
  if (sector === "23") return ["Hogar y Construcción", "hogar-y-construccion"];
  if (["48", "49"].includes(sector))
    return ["Transporte y Logística", "transporte-y-logistica"];
  if (["52", "53"].includes(sector))
    return ["Finanzas e Inmuebles", "finanzas-e-inmuebles"];
  if (["54", "55", "56"].includes(sector))
    return ["Servicios Profesionales", "servicios-profesionales"];
  if (sector === "71")
    return ["Entretenimiento y Cultura", "entretenimiento-y-cultura"];
  if (sector === "93")
    return ["Gobierno y Comunidad", "gobierno-y-comunidad"];
  if (sector === "81") return ["Servicios", "servicios"];
  if (sector === "72") return ["Restaurantes", "restaurantes"];
  return ["Moda y Tiendas", "moda-y-tiendas"];
};

const poolFor = (candidate, categorySlug) => {
  const text = textOf(candidate);
  const specific = [
    [/\bpizza|pizzeria\b/, "pizzas"],
    [/\btaco|taquer/, "tacos"],
    [/\bcafeter|cafe\b/, "cafeteria"],
    [/\babarrote|miscelanea\b/, "abarrotes"],
    [/\bfarmacia\b/, "farmacia"],
    [/\bdental|dentista\b/, "medicina-general"],
    [/\bmedic|clinica|consultorio|hospital\b/, "salud-y-bienestar"],
    [/\bestetica|belleza|peluquer|barber\b/, "salon-belleza"],
    [/\bescuela|colegio|educacion|academia\b/, "escuela"],
    [/\bcomputador|software|internet|electronica\b/, "reparacion-computadoras"],
    [/\btaller mecan|automotriz|hojalateria\b/, "taller-mecanico"],
    [/\bropa|calzado|boutique|vestir\b/, "moda"],
  ];
  for (const [pattern, pool] of specific) {
    if (pattern.test(text)) return pool;
  }
  const byCategory = {
    "alimentos-y-bebidas": "abarrotes",
    restaurantes: "alimentos-y-bebidas",
    salud: "salud-y-bienestar",
    belleza: "salon-belleza",
    educacion: "escuela",
    tecnologia: "reparacion-computadoras",
    automotriz: "taller-mecanico",
    "moda-y-tiendas": "moda",
    "industria-y-mayoreo": "industria-y-mayoreo",
    "hogar-y-construccion": "hogar-y-construccion",
    "transporte-y-logistica": "transporte-y-logistica",
    "finanzas-e-inmuebles": "servicios-profesionales",
    "servicios-profesionales": "servicios-profesionales",
    "entretenimiento-y-cultura": "comunidad-y-cultura",
    servicios: "servicios-profesionales",
    "gobierno-y-comunidad": "comunidad-y-cultura",
  };
  return byCategory[categorySlug] || "servicios-profesionales";
};

const poolCache = new Map();
const imageFor = async (candidate, categorySlug, sourceId) => {
  const pool = poolFor(candidate, categorySlug);
  if (!poolCache.has(pool)) {
    const dir = path.join(publicPoolDir, pool);
    let files = [];
    try {
      files = (await fs.readdir(dir))
        .filter((file) => /\.(webp|png|jpe?g)$/i.test(file))
        .sort();
    } catch {
      files = [];
    }
    if (!files.length) {
      throw new Error(`El pool de imágenes está vacío: ${pool}`);
    }
    poolCache.set(pool, files);
  }
  const files = poolCache.get(pool);
  return `/business-pool/${pool}/${files[stableNumber(sourceId) % files.length]}`;
};

const addressFor = (candidate) =>
  [
    candidate.Tipo_vialidad,
    candidate.Calle,
    candidate.Num_Exterior && `#${candidate.Num_Exterior}`,
    candidate.Num_Interior && `Int. ${candidate.Num_Interior}`,
    candidate.numero_local && `Local ${candidate.numero_local}`,
    candidate.Colonia && `Col. ${candidate.Colonia}`,
    "Iztapalapa, CDMX",
    candidate.CP && `CP ${String(candidate.CP).padStart(5, "0")}`,
  ]
    .filter(Boolean)
    .join(", ");

const loadAll = async (table, columns = "*") => {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
};

const retry = async (work, label, attempts = 4) => {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 750));
      }
    }
  }
  throw new Error(`${label}: ${lastError?.message || lastError}`);
};

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(auditDir, "respaldos", timestamp);
const missingPayload = JSON.parse(await fs.readFile(missingPath, "utf8"));
const matches = JSON.parse(await fs.readFile(matchesPath, "utf8"));
const stale = JSON.parse(await fs.readFile(stalePath, "utf8"));
const currentBusinesses = await loadAll("negocios");
const currentCategories = await loadAll("categorias");
const currentSourceIds = new Set(
  currentBusinesses
    .filter((row) => row.source_type === "denue" && row.source_id)
    .map((row) => String(row.source_id))
);
const usedSlugs = new Set(currentBusinesses.map((row) => row.slug).filter(Boolean));
const usedEmails = new Set(
  currentBusinesses
    .map((row) => normalize(row.email))
    .filter(Boolean)
);
const usedFreeNameAddress = new Set(
  currentBusinesses
    .filter((row) => ["free", "gratis"].includes(normalize(row.plan_type)))
    .map((row) => `${normalize(row.nombre)}|${normalize(row.direccion)}`)
);
const missingCandidates = missingPayload.candidatos || [];

const rows = [];
for (const candidate of missingCandidates) {
  const sourceId = String(candidate.CLEE || candidate.Id || "").trim();
  if (!sourceId || currentSourceIds.has(sourceId)) continue;
  const [category, categorySlug] = categoryFor(candidate);
  const suffix = createHash("sha1").update(sourceId).digest("hex").slice(0, 8);
  let slug = slugify(candidate.Nombre);
  if (usedSlugs.has(slug)) slug = `${slug}-${suffix}`;
  usedSlugs.add(slug);
  const candidateEmail = String(candidate.Correo_e || "").trim();
  const normalizedEmail = normalize(candidateEmail);
  const email =
    normalizedEmail && !usedEmails.has(normalizedEmail) ? candidateEmail : null;
  if (email) usedEmails.add(normalizedEmail);
  const baseAddress = addressFor(candidate);
  const baseFreeKey = `${normalize(candidate.Nombre)}|${normalize(baseAddress)}`;
  const address = usedFreeNameAddress.has(baseFreeKey)
    ? `${baseAddress}, Ref. DENUE ${String(candidate.Id || sourceId).trim()}`
    : baseAddress;
  usedFreeNameAddress.add(
    `${normalize(candidate.Nombre)}|${normalize(address)}`
  );
  const activity = String(candidate.Clase_actividad || "actividad local").trim();
  const lat = Number.parseFloat(candidate.Latitud);
  const lng = Number.parseFloat(candidate.Longitud);
  rows.push({
    nombre: String(candidate.Nombre || "Negocio local").trim(),
    descripcion: `${String(candidate.Nombre || "Este establecimiento").trim()} es un establecimiento de ${activity.toLowerCase()} registrado en el DENUE de Iztapalapa. Consulta su ubicación y datos disponibles en IztapaMarket.`,
    categoria: category.toLowerCase(),
    slug_categoria: categorySlug,
    telefono: String(candidate.Telefono || "").trim() || null,
    direccion: address,
    imagen_url: await imageFor(candidate, categorySlug, sourceId),
    // DENUE no entrega horarios. Se fuerza null para impedir que el valor
    // predeterminado de la tabla publique un horario no verificado.
    hours: null,
    plan_type: "free",
    is_featured: false,
    whatsapp: null,
    web: String(candidate.Sitio_internet || "").trim() || null,
    email,
    gallery_images: [],
    services: [],
    servicios: [],
    slug,
    is_approved: publish,
    is_deleted: false,
    ai_portada_used: false,
    ai_logo_used: false,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    latitud: Number.isFinite(lat) ? lat : null,
    longitud: Number.isFinite(lng) ? lng : null,
    visitas: 0,
    clics: 0,
    claim_token: randomUUID(),
    nombre_norm: normalize(candidate.Nombre),
    // La tabla impide dos planes gratuitos con el mismo nombre/dirección.
    // DENUE sí puede tener varias unidades en una plaza o mercado; el sufijo
    // solo vive en la clave interna y no cambia la dirección visible.
    direccion_norm: `${normalize(address)} denue ${normalize(sourceId)}`,
    source_type: "denue",
    source_id: sourceId,
    review_status: publish ? "reviewed" : "pending",
    source_synced_at: new Date().toISOString(),
    image_classification_version: 2,
    seo_keywords: [
      String(candidate.Nombre || "").trim(),
      activity,
      category,
      "Iztapalapa",
      "CDMX",
    ].filter(Boolean).join(", "),
  });
}

const report = {
  generado_en: new Date().toISOString(),
  modo: apply ? (publish ? "aplicar_y_publicar" : "aplicar_pendientes") : "simulacion",
  candidatos_faltantes: missingCandidates.length,
  filas_preparadas: rows.length,
  coincidencias_existentes: matches.length,
  registros_mal_clasificados_para_manual: stale.length,
  total_actual: currentBusinesses.length,
  denue_actual:
    currentBusinesses.filter((row) => row.source_type === "denue").length,
  denue_objetivo:
    currentBusinesses.filter((row) => row.source_type === "denue").length +
    rows.length,
  categorias_nuevas: categoryDefinitions.map((row) => row.slug_categoria),
  distribucion_categorias: Object.fromEntries(
    [...new Set(rows.map((row) => row.slug_categoria))]
      .sort()
      .map((slug) => [slug, rows.filter((row) => row.slug_categoria === slug).length])
  ),
  distribucion_imagenes: Object.fromEntries(
    [...new Set(rows.map((row) => row.imagen_url.split("/")[2]))]
      .sort()
      .map((pool) => [pool, rows.filter((row) => row.imagen_url.includes(`/${pool}/`)).length])
  ),
};
await fs.writeFile(
  path.join(auditDir, "importacion-completa-simulacion.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8"
);
console.log(JSON.stringify(report, null, 2));

if (!apply) {
  console.log("Simulación terminada. No se modificó Supabase.");
  process.exit(0);
}

await fs.mkdir(backupDir, { recursive: true });
await Promise.all([
  fs.writeFile(
    path.join(backupDir, "negocios-antes.json"),
    `${JSON.stringify(currentBusinesses, null, 2)}\n`,
    "utf8"
  ),
  fs.writeFile(
    path.join(backupDir, "categorias-antes.json"),
    `${JSON.stringify(currentCategories, null, 2)}\n`,
    "utf8"
  ),
  fs.writeFile(
    path.join(backupDir, "filas-importadas.json"),
    `${JSON.stringify(rows, null, 2)}\n`,
    "utf8"
  ),
]);
console.log(`Respaldo escrito en ${backupDir}`);

const existingCategorySlugs = new Set(
  currentCategories.map((row) => row.slug_categoria)
);
const missingCategories = categoryDefinitions.filter(
  (row) => !existingCategorySlugs.has(row.slug_categoria)
);
if (missingCategories.length) {
  const { error: categoryError } = await client
    .from("categorias")
    .insert(missingCategories);
  if (categoryError) throw categoryError;
}

const staleIds = stale.map((row) => row.id).filter(Boolean);
if (staleIds.length) {
  const { error } = await client
    .from("negocios")
    .update({
      source_type: "manual",
      source_id: null,
      source_synced_at: null,
    })
    .in("id", staleIds);
  if (error) throw error;
}

const currentById = new Map(currentBusinesses.map((row) => [row.id, row]));
const matchUpdates = matches
  .map((match) => {
    const business = currentById.get(match.negocio_id);
    if (!business || business.user_id || business.owner_user_id) return null;
    const sourceId = String(match.clee || match.denue_id || "").trim();
    if (!sourceId || business.source_id === sourceId) return null;
    const { plan_rank: _planRank, sort_name: _sortName, ...upsertable } =
      business;
    return {
      ...upsertable,
      source_type: "denue",
      source_id: sourceId,
      source_synced_at: new Date().toISOString(),
    };
  })
  .filter(Boolean);

for (let index = 0; index < matchUpdates.length; index += batchSize) {
  const batch = matchUpdates.slice(index, index + batchSize);
  await retry(async () => {
    const { error } = await client
      .from("negocios")
      .upsert(batch, { onConflict: "id" });
    if (error) throw error;
  }, `Conciliación ${index / batchSize + 1}`);
  console.log(`Conciliados ${Math.min(index + batchSize, matchUpdates.length)} / ${matchUpdates.length}`);
}

for (let index = 0; index < rows.length; index += batchSize) {
  const batch = rows.slice(index, index + batchSize);
  await retry(async () => {
    const { error } = await client.from("negocios").insert(batch);
    if (error) throw error;
  }, `Lote ${index / batchSize + 1}`);
  console.log(`Importados ${Math.min(index + batchSize, rows.length)} / ${rows.length}`);
}

const after = await loadAll(
  "negocios",
  "id,source_type,source_id,is_approved,is_deleted,review_status,imagen_url"
);
const denueAfter = after.filter(
  (row) => row.source_type === "denue" && !row.is_deleted
);
const sourceIdSet = new Set(denueAfter.map((row) => row.source_id).filter(Boolean));
const importedSourceIds = new Set(rows.map((row) => row.source_id));
const verification = {
  verificado_en: new Date().toISOString(),
  total_fisico: after.length,
  denue_no_eliminados: denueAfter.length,
  denue_source_id_unicos: sourceIdSet.size,
  denue_sin_source_id: denueAfter.filter((row) => !row.source_id).length,
  denue_sin_imagen: denueAfter.filter((row) => !row.imagen_url).length,
  nuevos_publicados: after.filter(
    (row) => importedSourceIds.has(row.source_id) && row.is_approved
  ).length,
  respaldo: backupDir,
};
await fs.writeFile(
  path.join(auditDir, "importacion-completa-verificacion.json"),
  `${JSON.stringify(verification, null, 2)}\n`,
  "utf8"
);
console.log(JSON.stringify(verification, null, 2));

if (
  denueAfter.length !== 88581 ||
  sourceIdSet.size !== 88581 ||
  denueAfter.some((row) => !row.imagen_url)
) {
  throw new Error("La verificación final no coincide con los 88,581 DENUE esperados.");
}
console.log("Importación DENUE completa y verificada.");
