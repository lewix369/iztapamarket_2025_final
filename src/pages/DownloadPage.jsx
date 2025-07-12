import React from "react";
import phoneImage from "@/assets/iztapamarket-phone.png";

const DownloadPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#003366] to-orange-400 text-white flex items-center justify-center px-4">
      <div className="relative max-w-6xl w-full flex flex-col md:flex-row items-center justify-between gap-10 p-10 rounded-3xl bg-white/10 backdrop-blur-xl shadow-xl border border-white/30">
        {/* INSTRUCCIONES */}
        <div className="flex-1 space-y-6 text-center md:text-left">
          <h1 className="text-3xl font-bold text-white">
            📱 Instala <span className="text-orange-300">IztapaMarket</span>
          </h1>
          <p className="text-md text-gray-200">
            Y lleva el directorio en tu celular
          </p>
          <div className="border border-white/30 rounded-xl p-4 bg-white/20 backdrop-blur-sm shadow-md text-white">
            <ul className="space-y-4">
              <li className="flex items-center">
                <span className="bg-indigo-200 text-indigo-800 rounded-full p-2 mr-3">
                  🔗
                </span>
                <span>
                  <strong>1.</strong> Toca en “Compartir” en el navegador
                </span>
              </li>
              <li className="flex items-center">
                <span className="bg-blue-200 text-blue-800 rounded-full p-2 mr-3">
                  ➕
                </span>
                <span>
                  <strong>2.</strong> Selecciona “Agregar a pantalla de inicio”
                </span>
              </li>
              <li className="flex items-center">
                <span className="bg-green-200 text-green-800 rounded-full p-2 mr-3">
                  ✅
                </span>
                <span>
                  <strong>3.</strong> Confirma la instalación
                </span>
              </li>
            </ul>
          </div>
          <p className="text-sm text-gray-300">
            Compatible con Android y iOS usando Chrome o Safari.
          </p>
          <a
            href="/"
            className="inline-block mt-4 bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-full transition"
          >
            Volver al inicio
          </a>
        </div>

        {/* IMAGEN */}
        <div className="flex-1">
          <img
            src={phoneImage}
            alt="IztapaMarket app en celular"
            className="w-full max-w-sm mx-auto md:mx-0 drop-shadow-2xl rounded-2xl"
          />
        </div>
      </div>
    </div>
  );
};

export default DownloadPage;
