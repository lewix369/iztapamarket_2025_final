// api/test_upsert.mjs
export const config = { runtime: "nodejs" };

import { upsertBusinessByEmail } from "@/lib/supabaseAdmin.mjs";

export default async function handler(req, res) {
  try {
    const email = req.query.email || "";
    const plan = req.query.plan || "premium";

    if (!email) {
      res.status(400).json({ ok: false, error: "Falta ?email=" });
      return;
    }

    const data = await upsertBusinessByEmail(email, plan);

    res.status(200).json({
      ok: true,
      message: `Negocio creado/actualizado para ${email}`,
      data,
    });
  } catch (e) {
    console.error("❌ Error en test_upsert:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
}