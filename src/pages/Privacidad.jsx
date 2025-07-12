import React from "react";
import { motion } from "framer-motion";

const Privacidad = () => {
  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl text-gray-800">
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-4xl font-extrabold text-orange-500 mb-8 text-center"
      >
        Política de Privacidad
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="mb-6 text-lg leading-relaxed"
      >
        En <span className="font-semibold text-blue-700">IztapaMarket</span>{" "}
        respetamos tu privacidad. Solo recolectamos la información necesaria
        para el funcionamiento del directorio y no compartimos tus datos con
        terceros sin tu consentimiento.
      </motion.p>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="mb-6 text-lg leading-relaxed"
      >
        Puedes solicitar la eliminación de tu cuenta y datos personales en
        cualquier momento escribiéndonos a{" "}
        <a
          href="mailto:info@iztapamarket.com"
          className="text-orange-600 font-semibold underline underline-offset-2"
        >
          info@iztapamarket.com
        </a>
        .
      </motion.p>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.6 }}
        className="mb-6 text-lg leading-relaxed"
      >
        Al usar esta plataforma, aceptas nuestra política de privacidad vigente.
      </motion.p>
    </div>
  );
};

export default Privacidad;
