import express from "express";
import "dotenv/config";
import cors from "cors";

// Routers
import createPreferenceRouter from "./src/lib/api/routes/createPreferenceRouter.mjs";
import webhookRouter from "./src/lib/api/routes/webhook_mp.mjs";

const app = express();

// Middlewares
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : true,
    credentials: true,
  })
);
app.use(express.json());

// --- Health ---
app.get("/healthz", (_req, res) => res.json({ ok: true }));

// --- Mercado Pago: create preference ---
app.use("/api/mp", createPreferenceRouter);

// Aliases legacy que usa el frontend/botón Wallet
app.use("/api/mp/create-preference", createPreferenceRouter);
app.use("/api/create-preference", createPreferenceRouter);
app.use("/api/mercadopago/create-preference", createPreferenceRouter);

// --- Webhook de Mercado Pago ---
app.use("/webhook_mp", webhookRouter);

// 404 genérico
app.use((req, res) => res.status(404).json({ ok: false, error: "Not Found" }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ API listening on http://localhost:${PORT}`);
});
