#!/usr/bin/env node
// geocodificar_existentes.cjs
// ============================================================
// IztapaMarket — Geocodificador de negocios sin coordenadas
// ============================================================
// Contexto real del proyecto:
//   Tabla    : public.negocios
//   Escribe  : lat, lng          ← columnas activas
//   Ignora   : latitud, longitud ← columnas legacy vacías, NO se tocan
//   API      : OpenCage (la misma que usa src/lib/geocoding.js)
//   Fallback : Nominatim (OpenStreetMap) si OpenCage falla o no hay key
//
// Uso:
//   node geocodificar_existentes.cjs --dry-run
//   node geocodificar_existentes.cjs --limit 10
//   node geocodificar_existentes.cjs
//
// Variables de entorno (.env en raíz del proyecto):
//   SUPABASE_URL=https://xxxx.supabase.co
//   SUPABASE_SERVICE_KEY=eyJ...
//   VITE_OPENCAGE_API_KEY=xxxx   (opcional — si existe, usa OpenCage)
// ============================================================

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Cargar .env manualmente (sin dotenv para evitar dependencia) ──
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const i = t.indexOf('=');
    if (i === -1) return;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, ''); // quitar comillas
    if (k && !process.env[k]) process.env[k] = v;
  });
}

// ── Credenciales ──────────────────────────────────────────────
const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const OPENCAGE_KEY         = process.env.VITE_OPENCAGE_API_KEY
                          || process.env.OPENCAGE_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('\n❌  Faltan variables de entorno en .env:\n');
  console.error('    SUPABASE_URL=https://xxxx.supabase.co');
  console.error('    SUPABASE_SERVICE_KEY=eyJ...\n');
  process.exit(1);
}

if (!OPENCAGE_KEY) {
  console.warn('⚠️  VITE_OPENCAGE_API_KEY no encontrada — usando Nominatim como fallback');
}

// ── Flags CLI ─────────────────────────────────────────────────
const args    = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT   = (() => {
  const i = args.indexOf('--limit');
  return i !== -1 ? parseInt(args[i + 1], 10) : Infinity;
})();

// ── Config ────────────────────────────────────────────────────
const DELAY_MS  = 1100;  // >= 1 seg entre requests (respeta ambas APIs)
const TIMEOUT   = 9000;  // ms por request
const LOG_PATH  = path.join(__dirname, 'geocodificacion.log.json');

// Bounding box de Iztapalapa + margen — rechaza coords fuera de área
const BBOX = { latMin: 19.25, latMax: 19.50, lngMin: -99.20, lngMax: -98.90 };

// ── Supabase (fetch nativo, sin SDK para no requerir npm install) ──
const SB_HEADERS = {
  'apikey':        SUPABASE_SERVICE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type':  'application/json',
  'Prefer':        'return=minimal',
};

async function sbGet(path, params = {}) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { headers: SB_HEADERS });
  if (!res.ok) throw new Error(`Supabase GET error ${res.status}: ${await res.text()}`);
  return res.json();
}

async function sbPatch(table, id, body) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`;
  const res  = await fetch(url, {
    method:  'PATCH',
    headers: SB_HEADERS,
    body:    JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase PATCH error ${res.status}: ${await res.text()}`);
}

// ── Helpers ───────────────────────────────────────────────────
const esperar = ms => new Promise(r => setTimeout(r, ms));

function dentroDeIztapalapa(lat, lng) {
  return lat > BBOX.latMin && lat < BBOX.latMax
      && lng > BBOX.lngMin && lng < BBOX.lngMax;
}

function construirDireccion(direccion) {
  const base = (direccion || '').trim()
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ');
  // Si ya menciona Iztapalapa o CDMX, no duplicar
  if (/iztapalapa|ciudad de méxico|cdmx/i.test(base)) return base;
  return `${base}, Iztapalapa, Ciudad de México, México`;
}

// ── Geocodificadores ──────────────────────────────────────────

async function geocodificarOpenCage(direccion) {
  const url = `https://api.opencagedata.com/geocode/v1/json?` +
    new URLSearchParams({
      q:           direccion,
      key:         OPENCAGE_KEY,
      language:    'es',
      countrycode: 'mx',
      limit:       '1',
    });

  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), TIMEOUT);

  try {
    const res  = await fetch(url, { signal: ctrl.signal });
    clearTimeout(tid);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!data.results?.length) return null;
    const { lat, lng } = data.results[0].geometry;
    if (!dentroDeIztapalapa(lat, lng)) return null;
    return { lat, lng, api: 'opencage' };
  } catch (err) {
    clearTimeout(tid);
    if (err.name === 'AbortError') throw new Error('TIMEOUT_opencage');
    throw err;
  }
}

async function geocodificarNominatim(direccion) {
  const url = `https://nominatim.openstreetmap.org/search?` +
    new URLSearchParams({
      q:            direccion,
      format:       'json',
      limit:        '1',
      countrycodes: 'mx',
    });

  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), TIMEOUT);

  try {
    const res  = await fetch(url, {
      signal:  ctrl.signal,
      headers: { 'User-Agent': 'IztapaMarket/1.0 (contacto@iztapamarket.com)' },
    });
    clearTimeout(tid);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!data?.length) return null;
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (!dentroDeIztapalapa(lat, lng)) return null;
    return { lat, lng, api: 'nominatim' };
  } catch (err) {
    clearTimeout(tid);
    if (err.name === 'AbortError') throw new Error('TIMEOUT_nominatim');
    throw err;
  }
}

// Intenta OpenCage → Nominatim → null
async function geocodificar(nombre, direccionRaw) {
  const dir = construirDireccion(direccionRaw);
  const intentos = [dir];

  // Si la dirección es muy corta o genérica, agregar el nombre del negocio
  if (dir.split(',').length < 3) {
    intentos.push(`${nombre}, ${dir}`);
  }

  for (const intento of intentos) {
    // 1. OpenCage (si hay API key)
    if (OPENCAGE_KEY) {
      try {
        const r = await geocodificarOpenCage(intento);
        if (r) return { ...r, direccionUsada: intento };
      } catch (err) {
        if (err.message.includes('TIMEOUT')) {
          console.log(' [opencage timeout]');
        }
      }
    }

    // 2. Nominatim como fallback
    try {
      const r = await geocodificarNominatim(intento);
      if (r) return { ...r, direccionUsada: intento };
    } catch (err) {
      if (err.message.includes('TIMEOUT')) {
        console.log(' [nominatim timeout]');
      }
    }
  }

  return null;
}

// ── MAIN ──────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('━'.repeat(60));
  console.log('🗺️  IztapaMarket — Geocodificador de negocios existentes');
  console.log(`   Tabla    : public.negocios`);
  console.log(`   Escribe  : lat, lng  (NO toca latitud/longitud)`);
  console.log(`   API      : ${OPENCAGE_KEY ? 'OpenCage → Nominatim (fallback)' : 'Nominatim (OpenCage no configurada)'}`);
  if (DRY_RUN)          console.log('   ⚠️  MODO DRY-RUN — no escribe en Supabase');
  if (LIMIT < Infinity)  console.log(`   ⚠️  LÍMITE: ${LIMIT} negocios`);
  console.log('━'.repeat(60));

  // ── 1. Cargar negocios sin lat O sin lng ─────────────────────
  // Filtro exacto: WHERE (lat IS NULL OR lng IS NULL)
  // No toca los que ya tienen ambos campos completos
  const params = {
    select:      'id,nombre,direccion',
    is_deleted:  'eq.false',
    is_approved: 'eq.true',
    or:          '(lat.is.null,lng.is.null)',
    order:       'nombre.asc',
  };

  let sinCoords;
  try {
    sinCoords = await sbGet('negocios', params);
  } catch (err) {
    console.error('❌  Error consultando Supabase:', err.message);
    process.exit(1);
  }

  const conDireccion = sinCoords.filter(n => n.direccion?.trim());
  const sinDireccion = sinCoords.filter(n => !n.direccion?.trim());
  const aAtender    = conDireccion.slice(0, LIMIT === Infinity ? conDireccion.length : LIMIT);
  const minutos     = Math.ceil(aAtender.length * DELAY_MS / 60_000);

  console.log('');
  console.log('📊 Estado inicial:');
  console.log(`   Con lat IS NULL OR lng IS NULL : ${sinCoords.length}`);
  console.log(`   Con dirección (geocodificables) : ${conDireccion.length}`);
  console.log(`   Sin dirección (no se pueden)   : ${sinDireccion.length}`);
  console.log(`   A procesar ahora               : ${aAtender.length}`);
  console.log(`   Tiempo estimado                : ~${minutos} min`);
  console.log('');

  if (!aAtender.length) {
    console.log('✅  Sin negocios a geocodificar.');
    return;
  }

  // ── 2. Geocodificar ───────────────────────────────────────────
  const exitosos = [];
  const fallidos = [];
  const sinDir   = sinDireccion.map(n => ({ id: n.id, nombre: n.nombre, razon: 'sin dirección' }));
  let   ultimaLlamada = 0;

  for (let i = 0; i < aAtender.length; i++) {
    const neg    = aAtender[i];
    const prefix = `[${String(i + 1).padStart(3, '0')}/${aAtender.length}]`;

    // Throttle: asegurar >= DELAY_MS entre requests
    const ahora  = Date.now();
    const espera = DELAY_MS - (ahora - ultimaLlamada);
    if (espera > 0) await esperar(espera);
    ultimaLlamada = Date.now();

    const coords = await geocodificar(neg.nombre, neg.direccion);

    if (coords) {
      if (!DRY_RUN) {
        try {
          // Escribe SOLO en lat y lng — latitud/longitud no se tocan
          await sbPatch('negocios', neg.id, {
            lat:        coords.lat,
            lng:        coords.lng,
            updated_at: new Date().toISOString(),
          });
        } catch (err) {
          console.log(`${prefix} ❌ ERROR escribiendo: ${neg.nombre.substring(0, 35)}`);
          console.log(`          ${err.message}`);
          fallidos.push({ id: neg.id, nombre: neg.nombre, razon: err.message, direccion: neg.direccion });
          continue;
        }
      }

      const tag = DRY_RUN ? '[DRY]' : '✅';
      console.log(
        `${prefix} ${tag} [${coords.api}] ` +
        `${neg.nombre.substring(0, 28).padEnd(28)} ` +
        `→ ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
      );
      exitosos.push({
        id:            neg.id,
        nombre:        neg.nombre,
        lat:           coords.lat,
        lng:           coords.lng,
        api:           coords.api,
        direccionUsada: coords.direccionUsada,
      });

    } else {
      console.log(`${prefix} ⚠️  Sin resultado: ${neg.nombre.substring(0, 45)}`);
      fallidos.push({
        id:        neg.id,
        nombre:    neg.nombre,
        razon:     'Nominatim/OpenCage sin resultado en bbox Iztapalapa',
        direccion: neg.direccion,
      });
    }
  }

  // ── 3. Log JSON ───────────────────────────────────────────────
  const log = {
    fecha:              new Date().toISOString(),
    dryRun:             DRY_RUN,
    columnaEscrita:     'lat, lng  (latitud/longitud NO tocadas)',
    api:                OPENCAGE_KEY ? 'OpenCage + Nominatim fallback' : 'Nominatim',
    totalSinCoords:     sinCoords.length,
    procesados:         aAtender.length,
    exitosos:           exitosos.length,
    fallidos:           fallidos.length,
    sinDireccion:       sinDir.length,
    detalle: {
      exitosos,
      fallidos,
      sinDireccion: sinDir,
    },
  };
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));

  // ── 4. Resumen final ──────────────────────────────────────────
  console.log('');
  console.log('━'.repeat(60));
  console.log(DRY_RUN ? '✅  DRY-RUN completado — nada escrito' : '✅  GEOCODIFICACIÓN COMPLETADA');
  console.log(`   Exitosos     : ${exitosos.length}`);
  console.log(`   Fallidos     : ${fallidos.length}`);
  console.log(`   Sin dirección: ${sinDir.length}`);
  console.log(`   Log          : ${LOG_PATH}`);
  console.log('━'.repeat(60));

  if (!DRY_RUN && exitosos.length > 0) {
    console.log('');
    console.log('📋 Verificar en Supabase SQL Editor:');
    console.log('');
    console.log('   SELECT');
    console.log('     COUNT(*)                                AS total,');
    console.log('     COUNT(*) FILTER (WHERE lat IS NOT NULL) AS con_lat,');
    console.log('     COUNT(*) FILTER (WHERE lat IS NULL)     AS sin_lat');
    console.log('   FROM negocios');
    console.log('   WHERE is_deleted = false AND is_approved = true;');
    console.log('');
    console.log('   -- Confirmar que latitud/longitud siguen vacías (no se tocaron):');
    console.log('   SELECT COUNT(*) FILTER (WHERE latitud IS NOT NULL) AS latitud_con_dato');
    console.log('   FROM negocios;');
    console.log('   -- Debe devolver: 0');
  }

  if (fallidos.length > 0) {
    console.log('');
    console.log(`💡 ${fallidos.length} negocios sin resultado.`);
    console.log('   Causas comunes:');
    console.log('   • Dirección incompleta o sin número (ej: "Calle sin número")');
    console.log('   • Colonia no reconocida por el geocodificador');
    console.log('   • Coordenadas resultantes fuera del bbox de Iztapalapa');
    console.log(`   Ver detalle en: ${LOG_PATH}`);
  }
  console.log('');
}

main().catch(err => {
  console.error('\n❌  Error fatal:', err.message);
  process.exit(1);
});
