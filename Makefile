.DEFAULT_GOAL := help

MAKEFLAGS += --no-print-directory

.PHONY: help selftest routes replay-latest replay-by-id replay-from-url replay-from-success replay-mo

help:
	@echo "Targets disponibles y ejemplos de uso:";
	@echo "";
	@echo "  make selftest";
	@echo "    Verifica credenciales y salud del backend.";
	@echo "";
	@echo "  make routes";
	@echo "    Lista las rutas expuestas por el backend.";
	@echo "";
	@echo "  make replay-latest";
	@echo "    Repite el último pago registrado en el sandbox.";
	@echo "";
	@echo "  make replay-by-id ID=<PAY_ID>";
	@echo "    Repite un pago específico por su payment_id.";
	@echo "";
	@echo "  make replay-from-url URL='<SUCCESS_URL>'";
	@echo "    Extrae payment_id/collection_id y reenvía el evento.";
	@echo "";
	@echo "  make replay-from-success URL='<SUCCESS_URL>'";
	@echo "    Repite el pago intentando con payment_id y fallbacks (merchant_order/external_reference).";
	@echo "";
	@echo "  make replay-mo MO=<MERCHANT_ORDER_ID>";
	@echo "    Consulta y muestra detalles de una merchant_order.";

selftest:
	@curl -sS http://localhost:3000/diag/mp/selftest | jq
	@curl -sS http://localhost:3000/health | jq
	@curl -sS http://localhost:3000/diag/env | jq

routes:
	@curl -sS http://localhost:3000/diag/routes | jq

replay-latest:
	@export MP_ACCESS_TOKEN="$$(grep -E '^MP_ACCESS_TOKEN=' .env.sandbox | sed -E 's/.*= *"?([^"]*)"?/\1/' | tr -d '\r\n')" ;\
	PAY_ID=$$(curl -sS -H "Authorization: Bearer $$MP_ACCESS_TOKEN" \
	  "https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=1" \
	  | jq -r '.results[0].id'); \
	jq -n --argjson id "$$PAY_ID" '{type:"payment",data:{id:$$id}}' \
	| curl -sS -X POST "http://localhost:3000/webhook_mp" -H "Content-Type: application/json" -d @- \
	| jq

replay-by-id:
	@if [ -z "$(ID)" ]; then echo "Uso: make replay-by-id ID=<PAY_ID>"; exit 1; fi
	@jq -n --argjson id "$(ID)" '{type:"payment",data:{id:$$id}}' \
	| curl -sS -X POST "http://localhost:3000/webhook_mp" -H "Content-Type: application/json" -d @- \
	| jq

replay-from-url:
	@if [ -z "$(URL)" ]; then echo "Uso: make replay-from-url URL='<SUCCESS_URL>'"; exit 1; fi ;\
	PAY_ID=$$(printf '%s\n' "$(URL)" | sed -n 's/.*[?&]payment_id=\([^&]*\).*/\1/p; s/.*[?&]collection_id=\([^&]*\).*/\1/p' | tr -cd '0-9' | head -n1); \
	if [ -z "$$PAY_ID" ]; then echo "No se encontró payment_id/collection_id en la URL"; exit 1; fi ;\
	jq -n --argjson id "$$PAY_ID" '{type:"payment",data:{id:$$id}}' \
	| curl -sS -X POST "http://localhost:3000/webhook_mp" -H "Content-Type: application/json" -d @- \
	| jq

replay-from-success:
	@if [ -z "$(URL)" ]; then echo "Uso: make replay-from-success URL='<SUCCESS_URL>'"; exit 1; fi ;\
	CLEAN_URL="$(URL)"; \
	CLEAN_URL=$$(printf '%s' "$$CLEAN_URL" | sed -E "s/^[[:space:]]*[<\"']?//; s/[>\"']?[[:space:]]*$$//"); \
	if printf '%s' "$$CLEAN_URL" | grep -Eq '(LA_SUCCESS_URL_COMPLETA|\.\.{3})'; then \
	  echo "❌ URL inválida: Debes pegar la URL COMPLETA de success (con payment_id y merchant_order_id reales, sin '...' ni '< >')."; \
	  exit 2; \
	fi; \
	PAY_ID=$$(printf '%s\n' "$$CLEAN_URL" | sed -n 's/.*[?&]payment_id=\([^&]*\).*/\1/p; s/.*[?&]collection_id=\([^&]*\).*/\1/p' | tr -cd '0-9' | head -n1); \
	MO_ID=$$(printf '%s\n' "$$CLEAN_URL" | sed -n 's/.*[?&]merchant_order_id=\([^&]*\).*/\1/p' | tr -cd '0-9' | head -n1); \
	EXTREF_RAW=$$(printf '%s\n' "$$CLEAN_URL" | sed -n 's/.*[?&]external_reference=\([^&]*\).*/\1/p'); \
	EXTREF=$$(printf '%s' "$$EXTREF_RAW" | sed 's/%7C/|/g; s/%40/@/g'); \
	if [ -n "$$PAY_ID" ]; then \
		echo "→ Intentando con payment_id=$$PAY_ID"; \
		jq -n --argjson id "$$PAY_ID" '{type:"payment",data:{id:$$id}}' \
		| curl -sS -X POST "http://localhost:3000/webhook_mp" -H "Content-Type: application/json" -d @- \
		| tee /tmp/webhook_try1.json | jq ;\
		if jq -e '.reason=="payment_not_fetched"' >/dev/null 2>&1 </tmp/webhook_try1.json ; then \
			echo "⚠️  v1/payments no encontró $$PAY_ID. Probando fallbacks..."; \
		else \
			exit 0; \
		fi ;\
	fi ;\
	if [ -n "$$MO_ID" ]; then \
		echo "\n→ Fallback A: consultar merchant_order $$MO_ID"; \
		MP_ACCESS_TOKEN="$$(grep -E '^MP_ACCESS_TOKEN=' .env.sandbox | sed -E 's/.*= *"?([^"]*)"?/\1/' | tr -d '\r\n')" ;\
		FOUND_ID=$$(curl -sS -H "Authorization: Bearer $$MP_ACCESS_TOKEN" "https://api.mercadopago.com/merchant_orders/$$MO_ID" \
			| jq -r '.payments[]?.id' | head -n1) ;\
		if printf '%s' "$$FOUND_ID" | grep -Eq '^[0-9]+$$'; then \
			echo "→ Encontrado payment.id=$$FOUND_ID en merchant_order. Reproduciendo..."; \
			jq -n --argjson id "$$FOUND_ID" '{type:"payment",data:{id:$$id}}' \
			| curl -sS -X POST "http://localhost:3000/webhook_mp" -H "Content-Type: application/json" -d @- \
			| jq ;\
			exit 0; \
		else \
			echo "⚠️  merchant_order no tiene payments[].id"; \
		fi ;\
	fi ;\
	if [ -n "$$EXTREF" ]; then \
		echo "\n→ Fallback B: buscar por external_reference=$$EXTREF (últimas 24h)"; \
		MP_ACCESS_TOKEN="$$(grep -E '^MP_ACCESS_TOKEN=' .env.sandbox | sed -E 's/.*= *"?([^"]*)"?/\1/' | tr -d '\r\n')" ;\
		END="$$(date -u +"%Y-%m-%dT%H:%M:%SZ")"; \
		BEGIN="$$(date -u -v-24H +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -r $$(($$(date -u +%s)-24*3600)) +"%Y-%m-%dT%H:%M:%SZ")"; \
		EXTREF_ENC="$$(printf '%s' "$$EXTREF" | jq -sRr @uri)"; \
		FOUND_ID=$$(curl -sS -H "Authorization: Bearer $$MP_ACCESS_TOKEN" \
		  "https://api.mercadopago.com/v1/payments/search?external_reference=$$EXTREF_ENC&range=date_created&begin_date=$$BEGIN&end_date=$$END&sort=date_created&criteria=desc&limit=5" \
		  | jq -r '(.results // [])[0]?.id'); \
		if printf '%s' "$$FOUND_ID" | grep -Eq '^[0-9]+$$'; then \
			echo "→ Encontrado payment.id=$$FOUND_ID por external_reference. Reproduciendo..."; \
			jq -n --argjson id "$$FOUND_ID" '{type:"payment",data:{id:$$id}}' \
			| curl -sS -X POST "http://localhost:3000/webhook_mp" -H "Content-Type: application/json" -d @- \
			| jq ;\
			exit 0; \
		else \
			echo "❌ No pude resolver un payment válido desde la URL dada (no hay id numérico en search)."; \
			exit 2; \
		fi ;\
	else \
		echo "❌ No hay external_reference en la URL y fallaron los otros métodos. Verifica que pegaste la URL COMPLETA."; \
		exit 2; \
	fi

replay-mo:
	@if [ -z "$(MO)" ]; then echo "Uso: make replay-mo MO=<MERCHANT_ORDER_ID>"; exit 1; fi
	@export MP_ACCESS_TOKEN="$$(grep -E '^MP_ACCESS_TOKEN=' .env.sandbox | sed -E 's/.*= *"?([^"]*)"?/\1/' | tr -d '\r\n')" ;\
	curl -sS -H "Authorization: Bearer $$MP_ACCESS_TOKEN" \
	  "https://api.mercadopago.com/merchant_orders/$(MO)" \
	| jq '{id,order_status,paid_amount,total_amount,payments:[.payments[]?|{id,status,transaction_amount,date_created}]}'
