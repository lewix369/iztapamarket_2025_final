import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const API_BASE =
  "https://www.inegi.org.mx/app/api/denue/v1/consulta";
const IZTAPALAPA_AREA = "09007";
const IZTAPALAPA_ENTITY = "09";
const IZTAPALAPA_MUNICIPALITY = "007";
const DEFAULT_OUTPUT_DIR = "reports/denue";
const DEFAULT_PAGE_SIZE = 500;

const SECTORS = [
  ["11", "Agricultura, cría y aprovechamiento animal"],
  ["21", "Minería"],
  ["22", "Generación y distribución de energía, agua y gas"],
  ["23", "Construcción"],
  ["31", "Industrias manufactureras (31)"],
  ["32", "Industrias manufactureras (32)"],
  ["33", "Industrias manufactureras (33)"],
  ["43", "Comercio al por mayor"],
  ["46", "Comercio al por menor"],
  ["48", "Transportes, correos y almacenamiento (48)"],
  ["49", "Transportes, correos y almacenamiento (49)"],
  ["51", "Información en medios masivos"],
  ["52", "Servicios financieros y de seguros"],
  ["53", "Servicios inmobiliarios y de alquiler"],
  ["54", "Servicios profesionales, científicos y técnicos"],
  ["55", "Corporativos"],
  ["56", "Servicios de apoyo a los negocios y manejo de residuos"],
  ["61", "Servicios educativos"],
  ["62", "Servicios de salud y asistencia social"],
  ["71", "Servicios de esparcimiento, culturales y deportivos"],
  ["72", "Servicios de alojamiento y preparación de alimentos"],
  ["81", "Otros servicios, excepto actividades gubernamentales"],
  ["93", "Actividades gubernamentales"],
];

const args = process.argv.slice(2);
const hasArg = (name) => args.includes(name);
const valueArg = (name) => {
  const prefix = `${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
};

if (hasArg("--help")) {
  console.log(`
Auditoría DENUE para Iztapalapa (09007)

Uso:
  npm run denue:auditar
  npm run denue:auditar -- --descargar-sector=62

Opciones:
  --descargar-sector=XX   Descarga candidatos de un sector específico.
  --salida=RUTA           Carpeta de salida (predeterminada: reports/denue).
  --tamano-pagina=N       Registros por solicitud (predeterminado: 500).
  --maximo=N              Límite de seguridad para una descarga.
  --help                  Muestra esta ayuda.

Variable requerida:
  INEGI_DENUE_TOKEN       Token personal de la API DENUE.

Este script es de solo lectura. No se conecta a Supabase ni modifica negocios.
`.trim());
  process.exit(0);
}

const token =
  process.env.INEGI_DENUE_TOKEN ||
  process.env.DENUE_TOKEN ||
  process.env.DENUE ||
  "";

if (!token) {
  console.error(
    "Falta INEGI_DENUE_TOKEN. Agrega el token solo a tu entorno local y vuelve a ejecutar."
  );
  process.exit(1);
}

const outputDir = path.resolve(valueArg("--salida") || DEFAULT_OUTPUT_DIR);
const pageSize = Math.max(
  1,
  Number.parseInt(valueArg("--tamano-pagina") || DEFAULT_PAGE_SIZE, 10)
);
const maxRecords = Math.max(
  pageSize,
  Number.parseInt(valueArg("--maximo") || "50000", 10)
);
const requestedSector = valueArg("--descargar-sector");

const apiGet = async (segments) => {
  const url = `${API_BASE}/${segments
    .map((part) => encodeURIComponent(String(part)))
    .join("/")}/${encodeURIComponent(token)}`;

  const response = await fetch(url, {
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`DENUE respondió HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("DENUE devolvió una respuesta inesperada");
  }

  return data;
};

const readTotal = (row) => {
  const knownKeys = [
    "Total",
    "total",
    "Total_establecimientos",
    "total_establecimientos",
  ];

  for (const key of knownKeys) {
    const value = Number.parseInt(row?.[key], 10);
    if (Number.isFinite(value)) return value;
  }

  const numericCandidates = Object.entries(row || {})
    .filter(([key]) => !/actividad|area|estrato|clave|id/i.test(key))
    .map(([, value]) => Number.parseInt(value, 10))
    .filter(Number.isFinite);

  if (numericCandidates.length === 1) return numericCandidates[0];
  throw new Error(
    `No fue posible identificar el total en: ${JSON.stringify(row)}`
  );
};

const auditSectorCounts = async () => {
  const rows = [];

  for (const [sector, nombre] of SECTORS) {
    const response = await apiGet([
      "Cuantificar",
      sector,
      IZTAPALAPA_AREA,
      "0",
    ]);
    const total = response.reduce((sum, row) => sum + readTotal(row), 0);
    rows.push({ sector, nombre, total });
    console.log(`${sector} · ${nombre}: ${total}`);
  }

  rows.sort((a, b) => b.total - a.total || a.sector.localeCompare(b.sector));
  const grandTotal = rows.reduce((sum, row) => sum + row.total, 0);
  const generatedAt = new Date().toISOString();

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(
    path.join(outputDir, "conteo-sectores-iztapalapa.json"),
    `${JSON.stringify(
      {
        fuente: "INEGI DENUE",
        area_geografica: IZTAPALAPA_AREA,
        generado_en: generatedAt,
        total_sectorizado: grandTotal,
        sectores: rows,
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  const csv = [
    "sector,nombre,total",
    ...rows.map(
      ({ sector, nombre, total }) =>
        `${sector},"${nombre.replaceAll('"', '""')}",${total}`
    ),
  ].join("\n");
  await fs.writeFile(
    path.join(outputDir, "conteo-sectores-iztapalapa.csv"),
    `${csv}\n`,
    "utf8"
  );

  console.log(
    `\nInventario guardado en ${path.relative(process.cwd(), outputDir)}`
  );
};

const csvValue = (value) =>
  `"${String(value ?? "")
    .replaceAll("\r", " ")
    .replaceAll("\n", " ")
    .replaceAll('"', '""')}"`;

const downloadSector = async (sector) => {
  const sectorInfo = SECTORS.find(([key]) => key === sector);
  if (!sectorInfo) {
    throw new Error(`Sector inválido: ${sector}`);
  }

  const records = [];
  let start = 1;

  while (records.length < maxRecords) {
    const end = Math.min(start + pageSize - 1, maxRecords);
    const page = await apiGet([
      "BuscarAreaAct",
      IZTAPALAPA_ENTITY,
      IZTAPALAPA_MUNICIPALITY,
      "0",
      "0",
      "0",
      sector,
      "0",
      "0",
      "0",
      "0",
      start,
      end,
      "0",
    ]);

    records.push(...page);
    console.log(`Sector ${sector}: ${records.length} candidatos descargados`);
    if (page.length < end - start + 1) break;
    start = end + 1;
  }

  const unique = new Map();
  for (const record of records) {
    const sourceId = String(record.CLEE || record.Id || "").trim();
    if (sourceId && !unique.has(sourceId)) unique.set(sourceId, record);
  }

  const candidates = [...unique.values()];
  const fields = [
    "CLEE",
    "Id",
    "Nombre",
    "Razon_social",
    "Clase_actividad",
    "Id_actividad",
    "Id_Sector",
    "Id_Subsector",
    "Id_Rama",
    "Estrato",
    "Tipo_vialidad",
    "Calle",
    "Num_Exterior",
    "Num_Interior",
    "Colonia",
    "CP",
    "Ubicacion",
    "Telefono",
    "Correo_e",
    "Sitio_internet",
    "Tipo",
    "Longitud",
    "Latitud",
  ];

  await fs.mkdir(outputDir, { recursive: true });
  const baseName = `candidatos-sector-${sector}-iztapalapa`;
  await fs.writeFile(
    path.join(outputDir, `${baseName}.json`),
    `${JSON.stringify(
      {
        fuente: "INEGI DENUE",
        sector,
        nombre_sector: sectorInfo[1],
        area_geografica: IZTAPALAPA_AREA,
        generado_en: new Date().toISOString(),
        solo_revision: true,
        total: candidates.length,
        candidatos: candidates,
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  const csv = [
    fields.join(","),
    ...candidates.map((record) =>
      fields.map((field) => csvValue(record[field])).join(",")
    ),
  ].join("\n");
  await fs.writeFile(
    path.join(outputDir, `${baseName}.csv`),
    `${csv}\n`,
    "utf8"
  );

  console.log(
    `\n${candidates.length} candidatos únicos guardados para revisión.`
  );
  console.log("No se modificó Supabase.");
};

try {
  if (requestedSector) {
    await downloadSector(requestedSector);
  } else {
    await auditSectorCounts();
  }
} catch (error) {
  console.error(`Error de auditoría DENUE: ${error.message}`);
  process.exitCode = 1;
}
