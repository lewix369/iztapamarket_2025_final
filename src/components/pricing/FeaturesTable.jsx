import React from 'react';
import { motion } from 'framer-motion';

const FeaturesTable = ({ plans }) => {
  const allFeatures = [
    { feature: "Listado en directorio", free: "✓", pro: "✓", premium: "✓" },
    { feature: "Fotos incluidas", free: "3", pro: "10", premium: "Ilimitadas" },
    { feature: "Posición destacada", free: "✗", pro: "✓", premium: "Premium" },
    { feature: "Analytics", free: "✗", pro: "Básicos", premium: "Avanzados" },
    { feature: "Promociones", free: "✗", pro: "Mensuales", premium: "Ilimitadas" },
    { feature: "Contenido con IA", free: "✗", pro: "✗", premium: "✓" },
    { feature: "Integración Mercado Pago", free: "✗", pro: "✗", premium: "✓" },
    { feature: "Página web incluida", free: "✗", pro: "✗", premium: "✓" },
    { feature: "Soporte", free: "Email", pro: "Prioritario", premium: "24/7" }
  ];
  
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center space-y-4 mb-16"
        >
          <h2 className="text-4xl font-bold text-gray-900">Comparación <span className="text-gradient">Detallada</span></h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">Encuentra las diferencias entre nuestros planes</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="overflow-x-auto"
        >
          <table className="w-full max-w-4xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
            <thead className="bg-gradient-to-r from-blue-600 to-orange-600 text-white">
              <tr>
                <th className="px-6 py-4 text-left">Características</th>
                {plans.map(plan => <th key={plan.name} className="px-6 py-4 text-center">{plan.name}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {allFeatures.map((row, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{row.feature}</td>
                  <td className="px-6 py-4 text-center text-gray-600">{row.free}</td>
                  <td className="px-6 py-4 text-center text-blue-600 font-medium">{row.pro}</td>
                  <td className="px-6 py-4 text-center text-orange-600 font-medium">{row.premium}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </section>
  );
};

export default FeaturesTable;