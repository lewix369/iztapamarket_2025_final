#!/usr/bin/env bash
set -euo pipefail
if [[ $# -lt 2 ]]; then
  echo "Uso: TOKEN='APP_USR-...' ./mp_verify_url.sh 'https://tu.site/pago/success?...' [sandbox|prod]"
  exit 1
fi
TOKEN="${TOKEN:-}"; URL="$1"; ENV="$2"
if [[ -z "$TOKEN" ]]; then echo "❌ Falta TOKEN"; exit 1; fi
Q=$(python3 - <<PY
import sys, urllib.parse, json
u=urllib.parse.urlparse(sys.argv[1]); print(json.dumps(urllib.parse.parse_qs(u.query)))
PY
"$URL")
get(){ python3 - <<PY
import json,sys
q=json.loads(sys.argv[1]); k=sys.argv[2]
v=q.get(k,[]); print(v[0] if isinstance(v,list) and v else "")
PY
"$Q" "$1"; }
MO=$(get merchant_order_id); [[ -z "$MO" ]] && MO=$(get merchant_order)
PID=$(get payment_id); [[ -z "$PID" ]] && PID=$(get collection_id)
PREF=$(get preference_id)
MP=https://api.mercadopago.com
echo "Entorno: $ENV"
echo "merchant_order_id: ${MO:-}"; echo "payment_id: ${PID:-}"; echo "preference_id: ${PREF:-}"; echo
if [[ -n "$MO" ]]; then
  curl -fsS "$MP/merchant_orders/$MO" -H "Authorization: Bearer $TOKEN" | jq .
  exit 0
elif [[ -n "$PID" ]]; then
  curl -fsS "$MP/v1/payments/$PID" -H "Authorization: Bearer $TOKEN" | jq .
  exit 0
elif [[ -n "$PREF" ]]; then
  curl -fsS "$MP/v1/payments/search?preference_id=$PREF&limit=10" -H "Authorization: Bearer $TOKEN" | jq .
  exit 0
fi
echo "❌ No hay IDs en la URL."
