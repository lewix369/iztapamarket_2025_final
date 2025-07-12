import React from "react";

const Terminos = () => {
  return (
    <div className="container mx-auto px-4 py-12 text-gray-800">
      <div className="bg-white rounded-xl shadow-lg p-8 md:p-12">
        <h1 className="text-4xl font-bold text-blue-700 mb-6 border-b-4 border-orange-500 inline-block pb-2">
          Términos de Uso
        </h1>
        <p className="mb-6 leading-relaxed text-lg">
          Al utilizar{" "}
          <span className="font-semibold text-orange-600">IztapaMarket</span>,
          aceptas cumplir con estos términos. Nos reservamos el derecho de
          modificar cualquier contenido o funcionalidad en cualquier momento.
        </p>
        <p className="mb-6 leading-relaxed text-lg">
          No se permite usar la plataforma para fines ilegales ni para publicar
          contenido ofensivo, falso o que infrinja los derechos de terceros.
        </p>
        <p className="mb-6 leading-relaxed text-lg">
          La información proporcionada es responsabilidad de cada negocio.
          <span className="font-semibold text-orange-600">
            {" "}
            IztapaMarket
          </span>{" "}
          no garantiza la veracidad ni se hace responsable por servicios
          prestados por terceros.
        </p>
      </div>
    </div>
  );
};

export default Terminos;
