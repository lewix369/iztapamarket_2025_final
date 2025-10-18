import { useEffect } from "react";

export default function MagicLinkBridge() {
  useEffect(() => {
    const { search, hash } = window.location;

    const hasTokens =
      (hash && (hash.includes("access_token=") || hash.includes("refresh_token="))) ||
      (hash && hash.includes("type=magiclink"));

    if (hasTokens) {
      // 🔧 Extraemos cualquier redirect que venga por parámetro (por si Supabase lo envió)
      const redirectParam = new URLSearchParams(search).get("redirect") || "/mi-negocio";

      // 🔗 Reconstruimos la URL de destino con los tokens y redirect
      const dest = `/auth/callback?redirect=${redirectParam}${hash}`;
      console.log("🔁 Redirigiendo a:", dest);
      window.location.replace(dest);
    }
  }, []);

  return null;
}