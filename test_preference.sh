set -euo pipefail

: "${MP_ACCESS_TOKEN:?MP_ACCESS_TOKEN requerido}"

EMAIL="${1:-TESTUSER4168631680794990658@testuser.com}"
PLAN="${2:-premium}"
TITLE="${3:-Suscripción premium IztapaMarket}"
QTY="${4:-1}"
PRICE="${5:-199}"

RESP=$(curl -sS -X POST "http://localhost:3000/create_preference" \
  -H "Content-Type: application/json" \
  -d "{\"plan\":\"$PLAN\",\"email\":\"$EMAIL\",\"title\":\"$TITLE\",\"quantity\":$QTY,\"unit_price\":$PRICE}")

echo "$RESP" | jq . || true

PREF_ID=$(echo "$RESP" | jq -r '.id')
OPEN_URL=$(echo "$RESP" | jq -r '.sandbox_init_point // .init_point')
TAG=$(echo "$RESP" | jq -r '.tag // empty')

if [[ -z "${PREF_ID:-}" || -z "${OPEN_URL:-}" ]]; then
  echo "❌ No llegó PREF_ID/OPEN_URL. Respuesta cruda:"
  echo "$RESP"
  exit 1
fi

echo
echo "PREF_ID=$PREF_ID"
echo "TAG=$TAG"
echo "Abre el checkout:"
echo "$OPEN_URL"

if command -v open >/dev/null 2>&1; then
  open "$OPEN_URL"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$OPEN_URL"
fi

echo
echo "Pega aquí la URL completa de success y Enter:"
read -r SUCCESS_URL

QS_JSON=$(python3 - <<'PY' "$SUCCESS_URL"
import sys, json, urllib.parse
u=sys.argv[1].strip()
qs=urllib.parse.urlparse(u).query
pairs=urllib.parse.parse_qs(qs)
print(json.dumps({k:v[0] for k,v in pairs.items()}))
PY
)

if [ -z "$QS_JSON" ] || [ "$QS_JSON" = "null" ]; then
  echo "❌ No se pudieron parsear parámetros."
  echo "$SUCCESS_URL"
  exit 1
fi

echo "$QS_JSON" | jq .

PAY_ID=$(echo "$QS_JSON" | jq -r '.payment_id // .collection_id // empty')
MO_ID=$(echo "$QS_JSON" | jq -r '.merchant_order_id // empty')
EXTREF=$(echo "$QS_JSON" | jq -r '.external_reference // empty')
STATUS=$(echo "$QS_JSON" | jq -r '.status // empty')

echo
echo "→ Extraído:"
echo "payment_id=$PAY_ID"
echo "merchant_order_id=$MO_ID"
echo "status=$STATUS"
echo "external_reference=$EXTREF"

if [[ -n "${PAY_ID:-}" ]]; then
  echo
  echo "🔎 /v1/payments/$PAY_ID"
  curl -sS -H "Authorization: Bearer $MP_ACCESS_TOKEN" \
       -H "Accept: application/json" \
       "https://api.mercadopago.com/v1/payments/$PAY_ID" \
  | jq '{id,status,status_detail,transaction_amount,payment_type_id,external_reference,payer:{email:.payer.email}}'
else
  echo "⚠️ No hay payment_id en la URL"
fi

if [[ -n "${MO_ID:-}" ]]; then
  echo
  echo "🔎 /merchant_orders/$MO_ID"
  curl -sS -H "Authorization: Bearer $MP_ACCESS_TOKEN" \
       "https://api.mercadopago.com/merchant_orders/$MO_ID" \
  | jq '{id, order_status, paid_amount, total_amount, payments: [.payments[]? | {id,status,transaction_amount,date_created}]}'
else
  echo "⚠️ No hay merchant_order_id en la URL"
fi

if [[ -n "${EXTREF:-}" ]]; then
  END=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  BEGIN=$(date -u -r $(( $(date -u +%s) - 24*3600 )) +"%Y-%m-%dT%H:%M:%SZ")
  EXTREF_ENC=$(python3 - <<PY "$EXTREF"
import urllib.parse,sys
print(urllib.parse.quote(sys.argv[1], safe=''))
PY
)
  echo
  echo "🔎 /v1/payments/search por external_reference"
  curl -sS -H "Authorization: Bearer $MP_ACCESS_TOKEN" \
    "https://api.mercadopago.com/v1/payments/search?external_reference=$EXTREF_ENC&range=date_created&begin_date=$BEGIN&end_date=$END&sort=date_created&criteria=desc&limit=5" \
  | jq '.results | map({id,status,external_reference,transaction_amount,payment_type_id,payer:{email:.payer.email}})'
fi

echo
echo "✅ Listo."
