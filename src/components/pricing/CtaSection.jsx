import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, CreditCard } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const CtaSection = ({ onSelectFreePlan }) => {
  const { toast } = useToast();
  
  return (
    <section className="py-20 bg-gradient-to-r from-blue-600 via-blue-700 to-orange-600 text-white">
      <div className="container mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto space-y-8"
        >
          <h2 className="text-4xl md:text-5xl font-bold">¿Listo para Hacer Crecer tu Negocio?</h2>
          <p className="text-xl text-blue-100 leading-relaxed">Únete a cientos de negocios que ya confían en IztapaMarket para aumentar su visibilidad.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={onSelectFreePlan}
              size="lg"
              className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-3 shadow-lg"
            >
              Comenzar Gratis <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              onClick={() => toast({
                title: "🚧 Esta función no está implementada aún",
                description: "¡Pero no te preocupes! ¡Puedes solicitarla en tu próximo prompt! 🚀",
              })}
              variant="outline"
              size="lg"
              className="border-white text-white hover:bg-white hover:text-blue-600 px-8 py-3"
            >
              <CreditCard className="mr-2 h-5 w-5" /> Ver Demo
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CtaSection;