// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { SupabaseProvider } from "./contexts/SupabaseContext";
import { SessionProvider } from "./contexts/SessionContext";

// ✅ Mercado Pago
import { initMercadoPago } from "@mercadopago/sdk-react";

// Usa la Public Key sandbox desde .env (ej: VITE_MP_PUBLIC_KEY=TEST-xxxxxxxx)
const MP_PUBLIC_KEY = import.meta.env.VITE_MP_PUBLIC_KEY;

// Evita re‑inicializar MP en HMR
if (MP_PUBLIC_KEY) {
  try {
    if (!window.__mp_initialized) {
      initMercadoPago(MP_PUBLIC_KEY, { locale: "es-MX" });
      window.__mp_initialized = true;
      console.log("✅ Mercado Pago SDK inicializado (frontend)");
    }
  } catch (e) {
    console.error("❌ Error inicializando Mercado Pago SDK:", e);
  }
} else {
  console.warn(
    "⚠️ Falta VITE_MP_PUBLIC_KEY en tu .env (usa la Public Key TEST-... de sandbox)"
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  // {/* <React.StrictMode> */}
  <SupabaseProvider>
    <SessionProvider>
      <App />
    </SessionProvider>
  </SupabaseProvider>
  // {/* </React.StrictMode> */}
);

// 🧹 Dev: asegúrate de NO tener SW en dev (borra cualquier registro viejo y caches)
if (import.meta.env.DEV && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    if (regs.length) {
      console.log("🧹 Unregistering", regs.length, "service worker(s) in dev");
    }
    regs.forEach((r) => r.unregister());
  });
  if (window.caches?.keys) {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
  }
}

// 🛠️ Service Worker: solo en producción (en dev interfiere con los fetch del SDK de MP)
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((registration) => {
        console.log("✅ Service Worker registrado (prod):", registration);
      })
      .catch((error) => {
        console.error("❌ Error al registrar el Service Worker:", error);
      });
  });
}
