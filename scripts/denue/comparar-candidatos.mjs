import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const inputPath = process.argv[2];
if (!inputPath || process.argv.includes("--help")) {
  console.log(`
Compara candidatos DENUE contra public.negocios sin modificar Supabase.

Uso:
  node scripts/denue/comparar-candidatos.mjs RUTA_CANDIDATOS.json

Requiere en .env.local:
  VITE_SUPABASE_URL
  VITE_SUPABASE_ANON_KEY
`.trim());
  process.exit(inputPath ? 0 : 1);
}

const supabaseUrl =
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseAnonKey =
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Faltan la URL o la llave pública de Supabase.");
  process.exit(1);
}

const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\b(s\/n|sin numero)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const candidateAddress = (candidate) =>
  [
    candidate.Tipo_vialidad,
    candidate.Calle,
    candidate.Num_Exterior,
    candidate.Num_Interior,
    candidate.Colonia,
    candidate.CP,
  ]
    .filter(Boolean)
    .join(" ");

const sourceIds = (candidate) =>
  [candidate.CLEE, candidate.Id]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

const toNumber = (value) => {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : null;
};

const distanceMeters = (a, b) => {
  if (
    a.lat === null ||
    a.lng === null ||
    b.lat === null ||
    b.lng === null
  ) {
    return null;
  }

  const radians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
};

const loadExistingBusinesses = async () => {
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const rows = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from("negocios")
      .select(
        "id,nombre,direccion,source_type,source_id,review_status,user_id,owner_user_id,lat,lng"
      )
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Supabase: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  return rows;
};

const csvValue = (value) =>
  `"${String(value ?? "")
    .replaceAll("\r", " ")
    .replaceAll("\n", " ")
    .replaceAll('"', '""')}"`;

const parsed = JSON.parse(await fs.readFile(inputPath, "utf8"));
const candidates = parsed.candidatos || [];
const existing = await loadExistingBusinesses();

const existingBySource = new Map();
const existingByNameAddress = new Map();
const existingByName = new Map();

for (const business of existing) {
  const sourceId = String(business.source_id ?? "").trim();
  if (sourceId) existingBySource.set(sourceId, business);

  const name = normalize(business.nombre);
  const address = normalize(business.direccion);
  if (name && address) existingByNameAddress.set(`${name}|${address}`, business);
  if (name) {
    const group = existingByName.get(name) || [];
    group.push(business);
    existingByName.set(name, group);
  }
}

const results = candidates.map((candidate) => {
  const ids = sourceIds(candidate);
  const name = normalize(candidate.Nombre);
  const addressRaw = candidateAddress(candidate);
  const address = normalize(addressRaw);
  let match = ids.map((id) => existingBySource.get(id)).find(Boolean);
  let matchType = match ? "source_id" : "";
  let distance = null;

  if (!match && name && address) {
    match = existingByNameAddress.get(`${name}|${address}`);
    if (match) matchType = "nombre_direccion";
  }

  if (!match && name) {
    const sameName = existingByName.get(name) || [];
    const candidatePoint = {
      lat: toNumber(candidate.Latitud),
      lng: toNumber(candidate.Longitud),
    };
    const nearby = sameName
      .map((business) => ({
        business,
        distance: distanceMeters(candidatePoint, {
          lat: toNumber(business.lat),
          lng: toNumber(business.lng),
        }),
      }))
      .filter(
        (item) => item.distance !== null && item.distance <= 75
      )
      .sort((a, b) => a.distance - b.distance)[0];

    if (nearby) {
      match = nearby.business;
      matchType = "nombre_proximidad";
      distance = Math.round(nearby.distance);
    } else if (sameName.length === 1) {
      match = sameName[0];
      matchType = "nombre_revisar";
    }
  }

  return {
    clee: candidate.CLEE || "",
    denue_id: candidate.Id || "",
    nombre: candidate.Nombre || "",
    actividad: candidate.Clase_actividad || "",
    direccion: addressRaw,
    colonia: candidate.Colonia || "",
    cp: candidate.CP || "",
    latitud: candidate.Latitud || "",
    longitud: candidate.Longitud || "",
    resultado: match ? matchType : "nuevo_candidato",
    distancia_metros: distance ?? "",
    negocio_existente_id: match?.id || "",
    negocio_reclamado: Boolean(match?.user_id || match?.owner_user_id),
    negocio_revisado: match?.review_status === "reviewed",
  };
});

const summary = results.reduce(
  (accumulator, row) => {
    accumulator[row.resultado] =
      (accumulator[row.resultado] || 0) + 1;
    return accumulator;
  },
  {
    total_candidatos: results.length,
    negocios_existentes_consultados: existing.length,
  }
);

const outputDir = path.dirname(path.resolve(inputPath));
const sector = parsed.sector || "desconocido";
const outputBase = `comparacion-sector-${sector}-iztapalapa`;

await fs.writeFile(
  path.join(outputDir, `${outputBase}.json`),
  `${JSON.stringify(
    {
      fuente: "INEGI DENUE",
      generado_en: new Date().toISOString(),
      solo_revision: true,
      resumen: summary,
      resultados: results,
    },
    null,
    2
  )}\n`,
  "utf8"
);

const fields = Object.keys(results[0] || {});
const csv = [
  fields.join(","),
  ...results.map((row) => fields.map((field) => csvValue(row[field])).join(",")),
].join("\n");
await fs.writeFile(
  path.join(outputDir, `${outputBase}.csv`),
  `${csv}\n`,
  "utf8"
);

console.log(JSON.stringify(summary, null, 2));
console.log("Comparación terminada. No se modificó Supabase.");
