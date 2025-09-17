// src/components/TransportButtons.jsx
import React from "react";

/**
 * Botonera de transporte reutilizable
 * - Deeplinks a Google Maps, Waze, Uber y DiDi
 * - Acepta lat/lng o address (texto). Con coords es más preciso.
 *
 * Props:
 *  - lat?: number
 *  - lng?: number
 *  - address?: string
 *  - className?: string
 */
const TransportButtons = ({ lat, lng, address = "", className = "" }) => {
  const hasLatLng =
    Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));

  const destQuery = hasLatLng
    ? `${Number(lat)},${Number(lng)}`
    : encodeURIComponent(String(address || "").trim());

  // URLs
  const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${destQuery}`;

  const wazeUrl = hasLatLng
    ? `https://waze.com/ul?ll=${Number(lat)},${Number(lng)}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;

  const uberUrl = hasLatLng
    ? `https://m.uber.com/ul/?action=setPickup&dropoff[latitude]=${Number(
        lat
      )}&dropoff[longitude]=${Number(lng)}`
    : "https://m.uber.com/ul/";

  // Con address “a veces” DiDi da 404; con coords sí funciona.
  const didiUrl = hasLatLng
    ? `https://m.didiglobal.com/passenger/destination?dropoff_latitude=${Number(
        lat
      )}&dropoff_longitude=${Number(lng)}`
    : "https://m.didiglobal.com/passenger/";

  const canCopy = (address && String(address).trim().length > 0) || hasLatLng;

  // UI helpers
  const base =
    "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium shadow-sm transition active:translate-y-px focus:outline-none focus:ring-2 focus:ring-offset-1";
  const IconBubble = ({ children }) => (
    <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-white/20 text-[11px] font-bold">
      {children}
    </span>
  );

  const copyToClipboard = async () => {
    try {
      const text =
        address && String(address).trim().length > 0 ? address : destQuery;
      await navigator.clipboard.writeText(text);
      // En tu página este alert se reemplaza por toast automáticamente
      alert("Dirección copiada");
    } catch {
      alert("No se pudo copiar. Inténtalo de nuevo.");
    }
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-2 md:gap-3 ${className}`}
      role="group"
      aria-label="Abrir rutas en apps de transporte"
    >
      <a
        href={googleUrl}
        target="_blank"
        rel="noreferrer"
        className={`${base} bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-400`}
        title="Abrir en Google Maps"
      >
        <IconBubble>G</IconBubble>
        Google Maps
      </a>

      <a
        href={wazeUrl}
        target="_blank"
        rel="noreferrer"
        className={`${base} bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-400`}
        title="Abrir en Waze"
      >
        <IconBubble>W</IconBubble>
        Waze
      </a>

      <a
        href={uberUrl}
        target="_blank"
        rel="noreferrer"
        className={`${base} bg-black text-white hover:opacity-90 focus:ring-black`}
        title="Abrir en Uber"
      >
        <IconBubble>U</IconBubble>
        Uber
      </a>

      <a
        href={didiUrl}
        target="_blank"
        rel="noreferrer"
        className={`${base} bg-orange-500 text-white hover:bg-orange-600 focus:ring-orange-300`}
        title="Abrir en DiDi"
      >
        <IconBubble>D</IconBubble>
        DiDi
      </a>

      <button
        type="button"
        onClick={copyToClipboard}
        disabled={!canCopy}
        className={`${base} border bg-white text-gray-800 hover:bg-gray-50 focus:ring-gray-300 ${
          canCopy ? "" : "opacity-50 cursor-not-allowed"
        }`}
        title="Copiar dirección"
        aria-disabled={!canCopy}
      >
        <IconBubble>📋</IconBubble>
        Copiar dirección
      </button>
    </div>
  );
};

export default TransportButtons;
