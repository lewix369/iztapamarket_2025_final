// src/lib/api/routes/diag_verify.mjs
import express from "express";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

// Usa la Service Role (SOLO backend)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// GET /diag/verify?email=...
router.get("/verify", async (req, res) => {
  try {
    const raw = String(req.query.email || "")
      .trim()
      .toLowerCase();
    if (!raw)
      return res.status(400).json({ ok: false, error: "email requerido" });

    // 1) profiles
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("email, plan_type, updated_at")
      .eq("email", raw)
      .maybeSingle();

    // 2) negocios (el más reciente por owner_email)
    const { data: negocioRows, error: nErr } = await supabase
      .from("negocios")
      .select(
        "id, owner_email, plan_type, status, external_reference, created_at, updated_at"
      )
      .eq("owner_email", raw)
      .order("updated_at", { ascending: false })
      .limit(1);

    const negocio = (negocioRows && negocioRows[0]) || null;

    return res.json({
      ok: true,
      email: raw,
      profile: pErr
        ? { ok: false, error: pErr.message }
        : { ok: !!profile, data: profile },
      negocio: nErr
        ? { ok: false, error: nErr.message }
        : { ok: !!negocio, data: negocio },
      summary: {
        hasProfile: !!profile,
        hasBusiness: !!negocio,
        isPremium: (profile?.plan_type || negocio?.plan_type) === "premium",
        businessActive: negocio?.status === "active",
      },
    });
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, error: err?.message || String(err) });
  }
});

export default router;
