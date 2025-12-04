// Archivo de referencia para recordar el cambio hecho en server.mjs
// No se usa en runtime y se puede borrar cuando ya no lo necesites.
//
// En el archivo server.mjs, en el handler que atiende /api/create_preference_v2,
// se localiza el payload que se envía a https://api.mercadopago.com/checkout/preferences
// y se elimina cualquier propiedad auto_return, incluyendo spreads condicionales.
//
// Ejemplo del payload final (SOLO REFERENCIA, NO SE USA AQUÍ):
//
// const payload = {
//   items,
//   back_urls,
//   notification_url,
//   metadata,
//   external_reference,
// };
//
// Luego se hace la llamada fetch con:
// body: JSON.stringify(payload)