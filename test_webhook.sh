set -euo pipefail
: "${NEW_TUNNEL:?Define NEW_TUNNEL=https://....trycloudflare.com}"

EMAIL="${1:-comprador@test.com}"
PLAN="${2:-premium}"
TAG="${3:-TAG123}"
NEGOCIO_ID="${4:-2035a4c2-0130-4d55-90e4-30644a110e47}"

curl -sS -X POST "$NEW_TUNNEL/webhook_mp?test=1" \
  -H "Content-Type: application/json" \
  -d "{\"data\":{\"status\":\"approved\",\"external_reference\":\"$EMAIL|$PLAN|$TAG|$NEGOCIO_ID\",\"metadata\":{\"email\":\"$EMAIL\",\"plan\":\"$PLAN\",\"negocio_id\":\"$NEGOCIO_ID\"}}}" \
| jq
