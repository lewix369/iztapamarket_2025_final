import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { SupabaseProvider } from "./contexts/SupabaseContext";
import { SessionProvider } from "./contexts/SessionContext";

ReactDOM.createRoot(document.getElementById("root")).render(
  // {/* <React.StrictMode> */}
  <SupabaseProvider>
    <SessionProvider>
      <App />
    </SessionProvider>
  </SupabaseProvider>
  // {/* </React.StrictMode> */}
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((registration) => {
        console.log("✅ Service Worker registrado:", registration);
      })
      .catch((error) => {
        console.error("❌ Error al registrar el Service Worker:", error);
      });
  });
}
