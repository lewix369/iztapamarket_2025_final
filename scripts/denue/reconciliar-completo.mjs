import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const inputDir = path.resolve(process.argv[2] || "reports/denue");
const outputDir = path.resolve(process.argv[3] || inputDir);

const supabaseUrl =
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Faltan URL o credenciales de Supabase.");
}

const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\b(s\/n|sin numero)\b/g, " ")
    .replace(
      /\b(iztapalapa|ciudad de mexico|cdmx|distrito federal|mexico)\b/g,
      " "
    )
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

const toNumber = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const distanceMeters = (left, right) => {
  if (
    left.lat === null ||
    left.lng === null ||
    right.lat === null ||
    right.lng === null
  ) {
    return null;
  }
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const radius = 6371000;
  const deltaLat = radians(right.lat - left.lat);
  const deltaLng = radians(right.lng - left.lng);
  const lat1 = radians(left.lat);
  const lat2 = radians(right.lat);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(haversine));
};

const tokenSimilarity = (left, right) => {
  const leftTokens = new Set(normalize(left).split(" ").filter(Boolean));
  const rightTokens = new Set(normalize(right).split(" ").filter(Boolean));
  if (!leftTokens.size || !rightTokens.size) return 0;
  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }
  return intersection / new Set([...leftTokens, ...rightTokens]).size;
};

const candidateIds = (candidate) =>
  [candidate.CLEE, candidate.Id]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

const loadCandidates = async () => {
  const names = (await fs.readdir(inputDir))
    .filter((name) => /^candidatos-sector-\d+-iztapalapa\.json$/.test(name))
    .sort();
  const candidates = [];
  for (const name of names) {
    const parsed = JSON.parse(
      await fs.readFile(path.join(inputDir, name), "utf8")
    );
    for (const candidate of parsed.candidatos || []) {
      candidates.push({
        ...candidate,
        __sector: String(parsed.sector || candidate.Id_Sector || ""),
      });
    }
  }
  return candidates;
};

const loadBusinesses = async () => {
  const client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from("negocios")
      .select(
        "id,nombre,direccion,source_type,source_id,review_status,user_id,owner_user_id,lat,lng,is_deleted,is_approved"
      )
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
};

const candidates = await loadCandidates();
const businesses = await loadBusinesses();
const denueBusinesses = businesses.filter(
  (business) => business.source_type === "denue"
);

const matchedCandidate = new Set();
const matchedBusiness = new Set();
const matches = [];

const registerMatch = (candidateIndex, business, matchType, distance = null) => {
  if (matchedCandidate.has(candidateIndex) || matchedBusiness.has(business.id)) {
    return false;
  }
  matchedCandidate.add(candidateIndex);
  matchedBusiness.add(business.id);
  matches.push({
    candidate_index: candidateIndex,
    negocio_id: business.id,
    tipo: matchType,
    distancia_metros:
      distance === null ? null : Math.round(distance * 100) / 100,
  });
  return true;
};

const businessBySource = new Map();
for (const business of denueBusinesses) {
  const sourceId = String(business.source_id ?? "").trim();
  if (sourceId) businessBySource.set(sourceId, business);
}

for (let index = 0; index < candidates.length; index += 1) {
  const business = candidateIds(candidates[index])
    .map((id) => businessBySource.get(id))
    .find(Boolean);
  if (business) registerMatch(index, business, "source_id");
}

const remainingBusinessesByName = new Map();
for (const business of denueBusinesses) {
  if (matchedBusiness.has(business.id)) continue;
  const name = normalize(business.nombre);
  if (!name) continue;
  const group = remainingBusinessesByName.get(name) || [];
  group.push(business);
  remainingBusinessesByName.set(name, group);
}

const remainingCandidatesByName = new Map();
for (let index = 0; index < candidates.length; index += 1) {
  if (matchedCandidate.has(index)) continue;
  const name = normalize(candidates[index].Nombre);
  if (!name) continue;
  const group = remainingCandidatesByName.get(name) || [];
  group.push(index);
  remainingCandidatesByName.set(name, group);
}

for (const [name, candidateIndexes] of remainingCandidatesByName) {
  const nameBusinesses = remainingBusinessesByName.get(name) || [];
  if (!nameBusinesses.length) continue;

  const pairs = [];
  for (const candidateIndex of candidateIndexes) {
    const candidate = candidates[candidateIndex];
    const candidatePoint = {
      lat: toNumber(candidate.Latitud),
      lng: toNumber(candidate.Longitud),
    };
    for (const business of nameBusinesses) {
      const distance = distanceMeters(candidatePoint, {
        lat: toNumber(business.lat),
        lng: toNumber(business.lng),
      });
      const addressSimilarity = tokenSimilarity(
        candidateAddress(candidate),
        business.direccion
      );
      if (
        (distance !== null && distance <= 100) ||
        addressSimilarity >= 0.62
      ) {
        pairs.push({
          candidateIndex,
          business,
          distance,
          addressSimilarity,
          score:
            distance !== null
              ? distance
              : 1000 - Math.round(addressSimilarity * 100),
        });
      }
    }
  }

  pairs.sort(
    (left, right) =>
      left.score - right.score ||
      right.addressSimilarity - left.addressSimilarity
  );
  for (const pair of pairs) {
    registerMatch(
      pair.candidateIndex,
      pair.business,
      pair.distance !== null ? "nombre_proximidad" : "nombre_direccion",
      pair.distance
    );
  }
}

// Segunda pasada para registros históricos cuyo nombre comercial cambió
// ligeramente, pero conservan la misma ubicación DENUE. La combinación exige
// cercanía física y palabras compartidas; además mantiene la relación uno a uno.
const coordinatePairs = [];
const stillUnmatchedBusinesses = denueBusinesses.filter(
  (business) => !matchedBusiness.has(business.id)
);
for (let index = 0; index < candidates.length; index += 1) {
  if (matchedCandidate.has(index)) continue;
  const candidate = candidates[index];
  const candidatePoint = {
    lat: toNumber(candidate.Latitud),
    lng: toNumber(candidate.Longitud),
  };
  if (candidatePoint.lat === null || candidatePoint.lng === null) continue;

  for (const business of stillUnmatchedBusinesses) {
    const distance = distanceMeters(candidatePoint, {
      lat: toNumber(business.lat),
      lng: toNumber(business.lng),
    });
    if (distance === null || distance > 25) continue;
    const nameSimilarity = tokenSimilarity(candidate.Nombre, business.nombre);
    if (nameSimilarity < 0.25) continue;
    coordinatePairs.push({
      candidateIndex: index,
      business,
      distance,
      nameSimilarity,
      score: distance + (1 - nameSimilarity) * 10,
    });
  }
}
coordinatePairs.sort(
  (left, right) =>
    left.score - right.score || right.nameSimilarity - left.nameSimilarity
);
for (const pair of coordinatePairs) {
  registerMatch(
    pair.candidateIndex,
    pair.business,
    "ubicacion_nombre",
    pair.distance
  );
}

const unmatchedCandidates = candidates
  .map((candidate, index) => ({ ...candidate, __candidate_index: index }))
  .filter((candidate) => !matchedCandidate.has(candidate.__candidate_index));
const unmatchedBusinesses = denueBusinesses.filter(
  (business) => !matchedBusiness.has(business.id)
);

const matchRows = matches.map((match) => {
  const candidate = candidates[match.candidate_index];
  return {
    ...match,
    clee: candidate.CLEE || "",
    denue_id: candidate.Id || "",
    nombre_denue: candidate.Nombre || "",
    sector: candidate.__sector || candidate.Id_Sector || "",
  };
});

const summary = {
  generado_en: new Date().toISOString(),
  candidatos_oficiales: candidates.length,
  negocios_totales_consultados: businesses.length,
  negocios_denue_consultados: denueBusinesses.length,
  coincidencias_unicas: matches.length,
  coincidencias_source_id: matches.filter((row) => row.tipo === "source_id")
    .length,
  coincidencias_nombre_proximidad: matches.filter(
    (row) => row.tipo === "nombre_proximidad"
  ).length,
  coincidencias_nombre_direccion: matches.filter(
    (row) => row.tipo === "nombre_direccion"
  ).length,
  coincidencias_ubicacion_nombre: matches.filter(
    (row) => row.tipo === "ubicacion_nombre"
  ).length,
  candidatos_faltantes: unmatchedCandidates.length,
  negocios_denue_sin_coincidencia_oficial: unmatchedBusinesses.length,
};

await fs.mkdir(outputDir, { recursive: true });
await Promise.all([
  fs.writeFile(
    path.join(outputDir, "reconciliacion-completa-resumen.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8"
  ),
  fs.writeFile(
    path.join(outputDir, "reconciliacion-completa-coincidencias.json"),
    `${JSON.stringify(matchRows, null, 2)}\n`,
    "utf8"
  ),
  fs.writeFile(
    path.join(outputDir, "reconciliacion-completa-faltantes.json"),
    `${JSON.stringify(
      {
        fuente: "INEGI DENUE",
        area_geografica: "09007",
        generado_en: summary.generado_en,
        total: unmatchedCandidates.length,
        candidatos: unmatchedCandidates,
      },
      null,
      2
    )}\n`,
    "utf8"
  ),
  fs.writeFile(
    path.join(outputDir, "reconciliacion-completa-no-vigentes.json"),
    `${JSON.stringify(unmatchedBusinesses, null, 2)}\n`,
    "utf8"
  ),
]);

console.log(JSON.stringify(summary, null, 2));
console.log("Conciliación completa terminada. No se modificó Supabase.");
