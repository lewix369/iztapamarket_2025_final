import React from "react";

const Soporte = () => {
  return (
    <div className="min-h-screen bg-white py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-blue-800 mb-4">
            Centro de Soporte
          </h1>
          <p className="text-gray-600 text-lg">
            ¿Tienes preguntas, dudas o necesitas ayuda? Estamos aquí para ti.
          </p>
        </div>

        <div className="bg-gradient-to-r from-blue-700 to-orange-500 rounded-lg shadow-xl p-8 text-white">
          <p className="text-lg mb-4">Puedes escribirnos a:</p>
          <p className="text-xl font-semibold mb-2">📧 info@iztapamarket.com</p>
          <p className="text-xl font-semibold mb-4">
            💬 WhatsApp: +52 55 3069 8200
          </p>
          <p className="text-md">
            Horario de atención: <br />
            <span className="font-semibold">
              Lunes a Viernes, de 9:00 a 18:00 h.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Soporte;
