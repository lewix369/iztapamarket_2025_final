console.log("🔔 [api/webhook_mp] loaded");

export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      const body = req.body || {};

      if (req.query?.test === "1") {
        console.log("⚡ Test webhook:", body);
        return res.json({
          ok: true,
          via: "test",
          data: body.data || {},
        });
      }

      console.log("📩 Webhook recibido:", body);

      return res.json({ ok: true });
    } catch (err) {
      console.error("❌ Error en webhook_mp:", err);
      return res.status(500).json({ error: err.message });
    }
  } else if (req.method === "GET") {
    if (req.query?.test === "1") {
      return res.status(200).send("OK_TEST");
    }
    return res.json({ version: "api/webhook_mp v1" });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
