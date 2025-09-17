#!/usr/bin/env bash
set -euo pipefail

# === Config rápida (edita estas 3 líneas o expórtalas antes de correr) ===
DOMAIN="${DOMAIN:-https://TU_DOMINIO_BACKEND.com}"   # Backend en PROD (sin / al final)
EMAIL="${EMAIL:-comprador@tudominio.com}"            # email del comprador real
PLAN="${PLAN:-premium}"                               # pro | premium

# === Nada que editar abajo ===
CREATE_URL="${DOMAIN%/}${CREATE_PATH:-/api/createPreference}"

echo "➡️  Creando preferencia en: $CREATE_URL"
echo "   plan=$PLAN  email=$EMAIL"

RESP_JSON="$(curl -sS -X POST "$CREATE_URL" \
  -H "Content-Type: application/json" \
  -d "{\"plan\":\"$PLAN\",\"email\":\"$EMAIL\"}")"

echo "↩️  Respuesta:"
echo "$RESP_JSON" | jq . || echo "$RESP_JSON"

# intenta extraer URL (init_point o sandbox_init_point o string)
INIT_URL="$(echo "$RESP_JSON" | jq -r '.init_point // .sandbox_init_point // empty' 2>/dev/null || true)"
if [[ -z "${INIT_URL:-}" ]]; then
  # si la API devolvió string directo
  if [[ "$RESP_JSON" == http* ]]; then
    INIT_URL="$RESP_JSON"
  fi
fi

if [[ -z "${INIT_URL:-}" ]]; then
  echo "❌ No pude extraer init_point de la respuesta." >&2
  exit 1
fi

# propaga plan/email como query (por si tu backend/frontend los usa)
SEP='?'
if [[ "$INIT_URL" == *\?* ]]; then SEP='&'; fi
INIT_URL="${INIT_URL}${SEP}plan=${PLAN}&email=$(python3 - <<PY
import urllib.parse,os
print(urllib.parse.quote(os.environ.get("EMAIL","")))
PY
)"

echo "✅ URL del checkout:"
echo "$INIT_URL"

# abrir en el navegador (macOS 'open', Linux/WSL 'xdg-open', Windows 'start' si Git Bash)
if command -v open >/dev/null 2>&1; then
  open "$INIT_URL"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$INIT_URL"
else
  echo "📝 Abre la URL manualmente en el navegador."
fi

cat <<MSG

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sigue estos pasos en el navegador:
1) Completa el pago real para $PLAN.
2) Serás redirigido a /pago/success|failure|pending.
3) El webhook /webhook_mp actualizará tu plan en Supabase.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MSG
