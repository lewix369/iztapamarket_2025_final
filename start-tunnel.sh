#!/bin/zsh
set -e

# 1) Levantar túnel y capturar URL (una sola vez)
TUNNEL_URL=$(cloudflared tunnel --url http://localhost:3000 --loglevel info 2>&1 \
  | grep -o "https://[a-zA-Z0-9.-]*trycloudflare.com" | head -n1)

if [ -z "$TUNNEL_URL" ]; then
  echo "❌ No se pudo obtener la URL del túnel"
  exit 1
fi

echo "🌐 Túnel generado: $TUNNEL_URL"

# 2) Actualizar MP_WEBHOOK_URL en ambos .env (el backend usa .env.production)
sed -i "" "s#^MP_WEBHOOK_URL=.*#MP_WEBHOOK_URL=$TUNNEL_URL/webhook_mp#" .env.production
sed -i "" "s#^MP_WEBHOOK_URL=.*#MP_WEBHOOK_URL=$TUNNEL_URL/webhook_mp#" .env.local || true
echo "✅ MP_WEBHOOK_URL actualizado a: $TUNNEL_URL/webhook_mp"

# 3) Reiniciar backend con esa config
pkill -f "node server.mjs" || true
DOTENV_CONFIG_PATH=.env.production node server.mjs &

sleep 1
echo "🟢 Backend reiniciado en background"

# 4) Pequeña verificación
echo "🔎 Verificando..."
curl -s http://localhost:3000/diag/version | jq '{notification_url, success, failure, pending}'
curl -s "$TUNNEL_URL/webhook_mp/__version" | jq .
