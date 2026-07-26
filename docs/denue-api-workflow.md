# Flujo seguro para la API DENUE

Este conector sirve para descubrir establecimientos de distintos giros en
Iztapalapa sin escribir directamente en `public.negocios`.

## Alcance

- Área geográfica: Iztapalapa, Ciudad de México (`09007`).
- Fuente: API oficial del DENUE de INEGI.
- Operación predeterminada: conteo por sector.
- Operación opcional: descarga de un sector a CSV y JSON para revisión.
- Operaciones de Supabase: ninguna.

## Configuración local

Obtén un token personal en el portal del INEGI y agrega esta línea únicamente
al archivo local `.env.local`:

```text
INEGI_DENUE_TOKEN=tu-token
```

El token no debe agregarse a Git ni a variables que empiecen con `VITE_`.

## Inventario de giros

```bash
npm run denue:auditar
```

Genera:

- `reports/denue/conteo-sectores-iztapalapa.csv`
- `reports/denue/conteo-sectores-iztapalapa.json`

## Descargar candidatos de un sector

Ejemplo para salud y asistencia social:

```bash
npm run denue:auditar -- --descargar-sector=62
```

La descarga genera archivos de revisión. No deben importarse directamente a
`public.negocios`.

## Comparar contra el directorio actual

```bash
npm run denue:comparar -- reports/denue/candidatos-sector-62-iztapalapa.json
```

La comparación utiliza la llave pública y realiza únicamente consultas de
lectura. Clasifica coincidencias por `source_id`, nombre y dirección, o nombre
y proximidad geográfica. Los candidatos sin coincidencia quedan marcados como
`nuevo_candidato`; eso todavía no autoriza su importación.

## Reglas antes de una futura importación

1. Comparar primero por `source_id` usando CLEE o Id DENUE.
2. Comparar también nombre y dirección normalizados para detectar registros
   históricos sin `source_id`.
3. Excluir todo negocio con `user_id` u `owner_user_id`.
4. Excluir registros con `review_status = 'reviewed'`.
5. Preparar las altas nuevas con `source_type = 'denue'`,
   `review_status = 'pending'` y sin publicación automática.
6. Asignar categorías e imágenes únicamente después de revisar cada giro.
7. Generar respaldo, simulación y SQL reversible antes de escribir.

No debe existir una sincronización que haga `upsert` automático sobre negocios
publicados o reclamados.
