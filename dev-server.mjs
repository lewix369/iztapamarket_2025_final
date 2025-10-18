// dev-server.mjs
import dotenv from 'dotenv';
dotenv.config({ path: '.env.sandbox' });

import express from 'express';
import webhookHandler from './api/webhook_mp.mjs';
import createPrefHandler from './api/create_preference.mjs';
import diagHandler from './api/diag.mjs';

const app = express();

// Necesario para que req.body exista en tus handlers (POST JSON)
app.use(express.json());
// (opcional) soportar x-www-form-urlencoded si algún cliente lo usa
app.use(express.urlencoded({ extended: true }));

// Rutas que redirigen a tus handlers estilo Vercel
// ✅ FIX: usar app.use() para cubrir /webhook_mp y subrutas
app.use('/webhook_mp', (req, res) => webhookHandler(req, res));
app.all('/api/create_preference', (req, res) => createPrefHandler(req, res));
app.all('/api/diag', (req, res) => diagHandler(req, res));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[dev] IztapaMarket backend sandbox corriendo en http://127.0.0.1:${PORT}`);
  console.log(`[dev] MP_ENV=${process.env.MP_ENV}`);
  console.log(`[dev] MP_WEBHOOK_URL=${process.env.MP_WEBHOOK_URL}`);
});