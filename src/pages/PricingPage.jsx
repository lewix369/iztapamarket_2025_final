import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const plans = [
  {
    title: "Plan Gratuito",
    price: "$0",
    description: "Presencia básica en el directorio",
    features: [
      "Nombre y teléfono visible",
      "Dirección del negocio",
      "Aparece en búsquedas generales",
    ],
    highlight: false,
  },
  {
    title: "Plan Intermedio",
    price: "$149",
    description: "Mejor visibilidad y enlaces sociales",
    features: [
      "Incluye redes sociales",
      "1 imagen destacada",
      "Prioridad media en resultados",
    ],
    highlight: true,
  },
  {
    title: "Plan Premium",
    price: "$299",
    description: "Presencia destacada y contenido optimizado",
    features: [
      "Galería de imágenes",
      "Botón de WhatsApp y video",
      "Optimización SEO y posición destacada",
    ],
    highlight: false,
  },
];

const PricingPage = () => {
  const navigate = useNavigate();

  const handleSelectPlan = (planTitle) => {
    const planParam = encodeURIComponent(planTitle);
    navigate(`/registrar?plan=${planParam}`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-grow">
        <section className="py-20 bg-gradient-to-b from-white to-slate-50">
          <div className="container mx-auto px-4 text-center">
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl font-bold text-gray-900"
            >
              Elige el Plan Ideal para tu Negocio
            </motion.h1>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              Comparte tu negocio con más personas. Mejora tu visibilidad en
              IztapaMarket y accede a funciones exclusivas.
            </p>

            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
              {plans.map((plan, index) => (
                <motion.div
                  key={plan.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.2 }}
                  className={`border rounded-lg shadow-xl overflow-hidden p-6 flex flex-col justify-between ${
                    plan.highlight ? "border-blue-500" : "border-gray-200"
                  }`}
                >
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">
                      {plan.title}
                    </h2>
                    <p className="text-gray-500 mb-4">{plan.description}</p>
                    <div className="text-4xl font-extrabold text-orange-500 mb-4">
                      {plan.price}
                      <span className="text-base font-medium text-gray-600">
                        {" "}
                        /mes
                      </span>
                    </div>
                    <ul className="text-left space-y-2 mb-6">
                      {plan.features.map((feature, i) => (
                        <li
                          key={i}
                          className="text-green-600 flex items-center"
                        >
                          ✅{" "}
                          <span className="ml-2 text-gray-700">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Button
                    className="bg-orange-500 hover:bg-orange-600 text-white w-full"
                    onClick={() => handleSelectPlan(plan.title)}
                  >
                    Elegir Plan
                  </Button>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white py-16">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-6 text-gray-800">
              ¿Listo para Registrar tu Negocio?
            </h2>
            <p className="text-gray-600 mb-8 max-w-xl mx-auto">
              Empieza con el plan gratuito y sube de nivel cuando estés listo.
              ¡Tu visibilidad comienza hoy!
            </p>
            <Button
              variant="default"
              className="bg-blue-600 hover:bg-blue-700 text-white text-lg px-8 py-3"
              onClick={() => handleSelectPlan("Plan Gratuito")}
            >
              Registrar Negocio
            </Button>
          </div>
        </section>

        <section className="bg-gradient-to-r from-blue-700 via-blue-800 to-orange-600 text-white py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center space-y-6">
              <h3 className="text-2xl md:text-3xl font-semibold">
                ¿Cómo puedo pagar?
              </h3>
              <p className="text-lg text-blue-100">
                Aceptamos tarjetas de crédito y débito (Visa, Mastercard),
                transferencias bancarias y pagos en efectivo en OXXO. Al
                seleccionar tu plan te enviaremos las instrucciones de pago.
              </p>
              <h3 className="text-2xl md:text-3xl font-semibold">
                ¿Incluye soporte técnico?
              </h3>
              <p className="text-lg text-blue-100">
                Sí. Nuestro equipo te ayudará con la configuración de tu perfil,
                resolver dudas técnicas y ofrecerte orientación personalizada.
              </p>
              <h3 className="text-2xl md:text-3xl font-semibold">
                ¿Hay descuentos por pago anual?
              </h3>
              <p className="text-lg text-blue-100">
                ¡Sí! Ofrecemos un 15% de descuento si pagas por adelantado el
                año completo. Pregunta por nuestras promociones vigentes.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default PricingPage;
