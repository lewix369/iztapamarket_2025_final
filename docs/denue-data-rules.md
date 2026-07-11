# Reglas de datos DENUE

## Estado efectivo

El estado visible del negocio se deriva en este orden:

1. **Reclamado:** `user_id` u `owner_user_id` tiene valor. La información del propietario nunca se sobrescribe desde DENUE.
2. **Revisado por IztapaMarket:** no tiene propietario y `review_status = 'reviewed'`.
3. **DENUE sin reclamar:** no tiene propietario, `source_type = 'denue'` y `review_status = 'pending'`.
4. **Manual pendiente:** cualquier otro registro pendiente.

`external_reference` no identifica la fuente: se conserva para pagos y planes.

## Sincronización

- DENUE solo puede actualizar registros con `source_type = 'denue'`, sin propietario y pendientes.
- Un registro revisado puede recibir propuestas, pero no cambios automáticos.
- Un registro reclamado nunca recibe cambios automáticos.
- Las altas nuevas se guardan primero para revisión; no se publican automáticamente.
- `source_id` debe guardar el Id/CLEE estable después de conciliar el registro.

## Clasificación de imágenes

La clasificación usa primero el nombre y después la actividad DENUE. Una actividad múltiple no basta para elegir un pool específico.

Prioridad:

1. Nutrición: términos explícitos de nutrición en el nombre o una actividad exclusivamente nutricional.
2. Tacos: tacos, taquería o pastor identificados claramente.
3. Pizzas: pizza o pizzería en el nombre. Una actividad que agrupe pizzas con hamburguesas, hot dogs o pollo no es suficiente.
4. Cafetería: café, cafetería, coffee, Starbucks, nevería, helados, crepas, jugos, licuados, aguas frescas, fuente de sodas o refresquería en el nombre.
5. Alimentos y bebidas: fallback para cualquier caso alimenticio ambiguo.

La selección del archivo dentro del pool debe seguir siendo estable mediante hash del `slug`; si no existe, mediante nombre y dirección normalizados.
