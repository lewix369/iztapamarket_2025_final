import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const apply = process.argv.includes("--aplicar");
const auditDir = path.resolve(
  process.env.DENUE_AUDIT_DIR ||
    "/Users/luiscarrillo/Documents/Codex/2026-07-23/referenced-chatgpt-conversation-this-is-untrusted/work/denue-auditoria-oficial"
);
const sourcePath = path.join(
  auditDir,
  "reconciliacion-completa-faltantes.json"
);
const supabaseUrl =
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "";
const batchSize = 250;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Faltan URL o SUPABASE_SERVICE_ROLE en el entorno.");
}

const client = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const payload = JSON.parse(await fs.readFile(sourcePath, "utf8"));
const sourceIds = [
  ...new Set(
    (payload.candidatos || [])
      .map((row) => String(row.CLEE || row.Id || "").trim())
      .filter(Boolean)
  ),
];

const targetRows = [];
for (let index = 0; index < sourceIds.length; index += batchSize) {
  const batch = sourceIds.slice(index, index + batchSize);
  const { data, error } = await client
    .from("negocios")
    .select(
      "id,source_id,nombre,slug,is_approved,is_deleted,review_status,imagen_url"
    )
    .eq("source_type", "denue")
    .in("source_id", batch);
  if (error) throw error;
  targetRows.push(...(data || []));
}

const sourceIdSet = new Set(targetRows.map((row) => row.source_id));
const preflight = {
  generado_en: new Date().toISOString(),
  modo: apply ? "publicacion" : "simulacion",
  identificadores_objetivo: sourceIds.length,
  registros_encontrados: targetRows.length,
  identificadores_unicos_encontrados: sourceIdSet.size,
  eliminados: targetRows.filter((row) => row.is_deleted).length,
  sin_imagen: targetRows.filter((row) => !row.imagen_url).length,
  ya_aprobados: targetRows.filter((row) => row.is_approved).length,
  pendientes: targetRows.filter((row) => !row.is_approved).length,
};
console.log(JSON.stringify(preflight, null, 2));

if (
  sourceIds.length !== 77794 ||
  targetRows.length !== 77794 ||
  sourceIdSet.size !== 77794 ||
  preflight.eliminados !== 0 ||
  preflight.sin_imagen !== 0
) {
  throw new Error("La validación previa no permite publicar el lote.");
}

await fs.writeFile(
  path.join(auditDir, "publicacion-completa-simulacion.json"),
  `${JSON.stringify(preflight, null, 2)}\n`,
  "utf8"
);

if (!apply) {
  console.log("Simulación terminada. No se modificó Supabase.");
  process.exit(0);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(auditDir, "respaldos", `publicacion-${timestamp}`);
await fs.mkdir(backupDir, { recursive: true });
await fs.writeFile(
  path.join(backupDir, "estados-antes.json"),
  `${JSON.stringify(targetRows, null, 2)}\n`,
  "utf8"
);
console.log(`Respaldo de publicación escrito en ${backupDir}`);

for (let index = 0; index < sourceIds.length; index += batchSize) {
  const batch = sourceIds.slice(index, index + batchSize);
  const { error } = await client
    .from("negocios")
    .update({ is_approved: true, review_status: "reviewed" })
    .eq("source_type", "denue")
    .eq("is_deleted", false)
    .in("source_id", batch);
  if (error) throw error;
  if ((index / batchSize) % 20 === 0 || index + batchSize >= sourceIds.length) {
    console.log(
      `Publicados ${Math.min(index + batchSize, sourceIds.length)} / ${sourceIds.length}`
    );
  }
}

let approved = 0;
let hidden = 0;
for (let index = 0; index < sourceIds.length; index += batchSize) {
  const batch = sourceIds.slice(index, index + batchSize);
  const { data, error } = await client
    .from("negocios")
    .select("source_id,is_approved,is_deleted,imagen_url")
    .eq("source_type", "denue")
    .in("source_id", batch);
  if (error) throw error;
  approved += (data || []).filter(
    (row) => row.is_approved && !row.is_deleted && row.imagen_url
  ).length;
  hidden += (data || []).filter(
    (row) => !row.is_approved || row.is_deleted
  ).length;
}

const verification = {
  verificado_en: new Date().toISOString(),
  lote_aprobado_visible_con_imagen: approved,
  lote_oculto_o_eliminado: hidden,
  respaldo: backupDir,
};
await fs.writeFile(
  path.join(auditDir, "publicacion-completa-verificacion.json"),
  `${JSON.stringify(verification, null, 2)}\n`,
  "utf8"
);
console.log(JSON.stringify(verification, null, 2));

if (approved !== 77794 || hidden !== 0) {
  throw new Error("La verificación posterior a la publicación no coincide.");
}
console.log("Publicación DENUE completa y verificada.");
