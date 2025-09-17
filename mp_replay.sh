#!/usr/bin/env bash
set -euo pipefail
PAY_ID="${1:-}"
if [[ -z "$PAY_ID" ]]; then
  echo "Uso: $0 <PAY_ID_numérico>"; exit 1
fi
jq -n --argjson id "$PAY_ID" '{type:"payment", data:{id:$id}}' \
| curl -sS -X POST "http://localhost:3000/webhook_mp" \
    -H "Content-Type: application/json" -d @- \
| jq
