set -euo pipefail

TUNNEL="${1:-${NEW_TUNNEL:-}}"
EMAIL="${2:-testbuyer@example.com}"
if [[ -z "${TUNNEL}" ]]; then
  echo "Uso: ./pago_test.sh https://<tu-tunel>.trycloudflare.com [email@test.com]"
  exit 1
fi
if [[ "${TUNNEL}" != https://* ]]; then
  echo "Error: el TUNNEL debe iniciar con https://"
  exit 1
fi

echo "Túnel: ${TUNNEL}"
echo "Email: ${EMAIL}"
BODY=$(jq -n \
  --arg title "Plan Premium IztapaMarket" \
  --arg plan "premium" \
  --arg email "${EMAIL}" \
  --argjson quantity 1 \
  --argjson unit_price 199 \
  '{title:$title, quantity:$quantity, unit_price:$unit_price, plan:$plan, email:$email, payer:{email:$email}}')
RESP=$(curl -sS -X POST "${TUNNEL}/create_preference" \
  -H "Content-Type: application/json" \
  -d "${BODY}")

echo "${RESP}" | tee /tmp/pref.json >/dev/null

LINK=$(echo "${RESP}" | jq -r '.sandbox_init_point // empty')
if [[ -z "${LINK}" ]]; then
  echo "No se obtuvo sandbox_init_point. Respuesta completa:"
  echo "${RESP}"
  exit 1
fi

echo "sandbox_init_point: ${LINK}"
