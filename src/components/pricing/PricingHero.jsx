import React from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

const PricingHero = ({ children }) => {
  return (
    <section className="bg-gradient-to-br from-blue-600 via-blue-700 to-orange-600 text-white py-20">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6 max-w-4xl mx-auto"
        >
          <Badge className="bg-orange-500 text-white px-4 py-2 text-sm font-semibold">
            💰 Planes y Precios
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight">
            Elige el Plan Perfecto
            <span className="block text-orange-300">para tu Negocio</span>
          </h1>
          <p className="text-xl text-blue-100 leading-relaxed max-w-2xl mx-auto">
            Desde listados gratuitos hasta soluciones premium con IA. 
            Encuentra el plan que mejor se adapte a tus necesidades.
          </p>
          {children}
        </motion.div>
      </div>
    </section>
  );
};

export default PricingHero;