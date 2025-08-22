const express = require("express");
const cors = require("cors");
// const bodyParser = require("body-parser"); // Ya no se necesita
require("dotenv").config({ path: ".env" });

const requiredBackUrls = [
  "REGISTRO_SUCCESS_URL",
  "REGISTRO_FAILURE_URL",
  "REGISTRO_PENDING_URL",
];

const app = express();
const PORT = 3000;

// Importa el router correctamente
const createPreferenceRouter = require("./src/lib/api/routes/createPreferenceRouter.cjs");
const webhookMPRouter = require("./src/lib/api/routes/webhookMercadoPago.cjs");

app.use(cors());
app.use(express.json()); // ✅ Middleware moderno para parsear JSON

// Log de cada solicitud entrante
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url}`);
  next();
});

// Validación de variables de entorno críticas antes de montar el router
if (!process.env.MP_ACCESS_TOKEN) {
  console.warn("⚠️ MP_ACCESS_TOKEN no está definido en .env");
}
requiredBackUrls.forEach((key) => {
  if (!process.env[key]) {
    console.warn(`⚠️ ${key} no está definido en .env`);
  }
});

// Mostrar las URLs de entorno antes de montar el router
console.log("🌐 URLs desde .env:", {
  success: process.env.REGISTRO_SUCCESS_URL,
  failure: process.env.REGISTRO_FAILURE_URL,
  pending: process.env.REGISTRO_PENDING_URL,
});
// Endpoint de prueba
app.get("/ping", (req, res) => {
  res.status(200).json({ message: "🏓 Pong desde backend" });
});
// Ruta para crear preferencias
console.log("🚀 Montando router /create_preference...");
app.use("/create_preference", createPreferenceRouter);
// Webhook de Mercado Pago (solo lectura en local; responde 200 inmediato)
console.log("🔔 Montando router /webhook_mp...");
app.use("/webhook_mp", webhookMPRouter);

// Middleware de manejo de errores (opcional)
app.use((err, req, res, next) => {
  console.error("❌ Error no manejado:", err.message);
  console.error("🪵 Detalle completo del error:", err);
  res.status(500).json({ error: "Error interno del servidor" });
});

app.listen(PORT, () => {
  console.log("🟢----------------------------");
  console.log(`🟢 Backend activo en: http://localhost:${PORT}`);
  console.log("🟢----------------------------");
});
