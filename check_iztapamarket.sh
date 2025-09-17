#!/usr/bin/env bash
set -euo pipefail

BASE="${1:-}"
if [[ -z "$BASE" ]]; then
  echo "Uso: $0 https://www.iztapamarket.com"
  exit 1
fi

VERIFY_FILE="google3a072cd80aefa66d.html"
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

ok(){ echo -e "${GREEN}✔ $1${NC}"; }
warn(){ echo -e "${YELLOW}⚠ $1${NC}"; }
fail(){ echo -e "${RED}✘ $1${NC}"; exit 1; }

check_url() {
  local url="$1"
  local name="$2"
  if curl -fsS "$url" >/dev/null; then
    ok "$name disponible: $url"
  else
    fail "$name no encontrado: $url"
  fi
}

echo "🔍 Verificando $BASE ..."

check_url "$BASE/$VERIFY_FILE" "Archivo de verificación"
check_url "$BASE/robots.txt" "robots.txt"
check_url "$BASE/sitemap.xml" "sitemap.xml"
check_url "$BASE/manifest.json" "manifest.json"

echo "✅ Todo verificado correctamente."
