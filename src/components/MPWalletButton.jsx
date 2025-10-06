// src/components/MPWalletButton.jsx
import React, { useEffect, useRef, useState } from "react";

const MP_PUBLIC_KEY = import.meta.env.VITE_MP_PUBLIC_KEY; // tu public key
const PREFERRED_URL = import.meta.env.VITE_CREATE_PREF_URL;
const CREATE_PREF_URLS = [
  PREFERRED_URL,
  "/api/mp/create-preference",
  "/api/create-preference",
  "/api/mercadopago/create-preference",
].filter(Boolean);

function loadMPScript() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      return reject(
        new Error("MercadoPago SDK requires a browser environment")
      );
    }
    if (window.MercadoPago) return resolve(window.MercadoPago);
    const s = document.createElement("script");
    s.src = "https://sdk.mercadopago.com/js/v2";
    s.async = true;
    s.onload = () => resolve(window.MercadoPago);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function createPreference(payload) {
  // Probamos varias rutas conocidas de tu backend hasta que una responda 200 con { id }
  for (const url of CREATE_PREF_URLS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.id) return data.id;
    } catch (_) {
      /* siguiente URL */
    }
  }
  throw new Error(
    "No se pudo crear la preferencia (revisa la ruta del backend)."
  );
}

export default function MPWalletButton({ plan, email, userId }) {
  const [status, setStatus] = useState("idle"); // idle | creating | ready | error
  const [errorMsg, setErrorMsg] = useState("");
  const brickRef = useRef(null);
  const mpRef = useRef(null);

  useEffect(() => {
    let cleanup = () => {};
    (async () => {
      try {
        if (!MP_PUBLIC_KEY) {
          throw new Error(
            "Falta VITE_MP_PUBLIC_KEY en tus variables de entorno."
          );
        }
        setStatus("creating");

        // 1) Cargar SDK
        const MP = await loadMPScript();
        mpRef.current = new MP(MP_PUBLIC_KEY, { locale: "es-MX" });

        // 2) Crear preferencia en tu backend
        const preferenceId = await createPreference({ plan, email, userId });

        // 3) Render Wallet Brick
        const bricksBuilder = mpRef.current.bricks();
        const { destroy } = await bricksBuilder.create(
          "wallet",
          "mp-wallet-container",
          {
            initialization: { preferenceId },
            customization: {
              texts: { valueProp: "smart_option" },
              checkout: {
                theme: { elementsColor: "#0ea5e9", headerColor: "#0ea5e9" },
              },
            },
            callbacks: {
              onReady: () => setStatus("ready"),
              onError: (err) => {
                // eslint-disable-next-line no-console
                console.error("MP Wallet error:", err);
                setErrorMsg("Hubo un problema al inicializar el pago.");
                setStatus("error");
              },
            },
          }
        );
        cleanup = destroy;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        setErrorMsg(err.message || "Error inicializando el pago.");
        setStatus("error");
      }
    })();
    return () => cleanup();
  }, [plan, email, userId]);

  if (status === "creating") {
    return (
      <div className="rounded-md border border-sky-500 bg-sky-50 px-4 py-3 text-sky-800">
        Preparando pago de <b>{plan}</b> para <b>{email}</b>…
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="space-y-3 rounded-md border border-red-500 bg-red-50 p-4 text-red-800">
        <p className="text-sm font-medium">
          No pude inicializar el botón de pago.
        </p>
        <p className="text-xs opacity-80">{errorMsg}</p>
        <p className="text-xs">
          Revisa que:
          <br />• <code>VITE_MP_PUBLIC_KEY</code> esté definido.
          <br />• La ruta del backend (create preference) sea correcta y
          responda <code>{"{ id }"}</code>.
        </p>
      </div>
    );
  }

  return <div id="mp-wallet-container" ref={brickRef} />;
}
