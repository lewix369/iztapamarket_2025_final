import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Check,
  Star,
  Crown,
  Gift,
  ArrowRight,
  Phone,
  MapPin,
  Camera,
  Globe,
  BarChart3,
  Megaphone,
  Headphones,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const Precios = () => {
  const { toast } = useToast();

  const handlePlanClick = (planName) => {
    if (planName === "Free") {
      // Redirigir al registro para plan gratuito
      window.location.href = "/registro?plan=free";
    } else if (planName === "Profesional") {
      window.location.href = "/registro?plan=pro";
    } else if (planName === "Premium") {
      window.location.href = "/registro?plan=premium";
    }
  };

  const planes = [
    {
      name: "Free",
      price: "Gratis",
      period: "para siempre",
      description: "Perfecto para empezar a dar a conocer tu negocio",
      icon: Gift,
      color: "from-gray-500 to-slate-600",
      buttonColor: "bg-gray-600 hover:bg-gray-700",
      popular: false,
      features: [
        "Nombre del negocio",
        "Dirección completa",
        "Número de teléfono",
        "1 imagen principal",
        "Categoría del negocio",
        "Horarios básicos",
        "Descripción corta (100 caracteres)",
      ],
      limitations: [
        "Sin redes sociales",
        "Sin galería de imágenes",
        "Sin mapa integrado",
        "Sin estadísticas",
        "Posicionamiento SEO básico",
      ],
    },
    {
      name: "Profesional",
      price: "$300",
      period: "/mes",
      description: "Ideal para negocios que buscan mayor visibilidad",
      icon: Star,
      color: "from-blue-500 to-indigo-600",
      buttonColor: "bg-blue-600 hover:bg-blue-700",
      popular: true,
      features: [
        "Todo lo del plan Free",
        "Hasta 5 fotografías",
        "Enlaces a redes sociales",
        "Horarios detallados",
        "Mapa integrado de Google",
        "Lista de servicios",
        "Estadísticas básicas",
        "Promociones mensuales",
        "Descripción extendida (500 caracteres)",
        "Logo del negocio",
      ],
      limitations: ["Sin videos", "Sin sitio web básico", "Soporte por email"],
    },
    {
      name: "Premium",
      price: "$500",
      period: "/mes",
      description: "La solución completa para negocios ambiciosos",
      icon: Crown,
      color: "from-orange-500 to-red-600",
      buttonColor:
        "bg-gradient-to-r from-[#f97316] to-[#ea580c] hover:from-[#ea580c] hover:to-[#f97316]",
      popular: false,
      features: [
        "Todo lo del plan Profesional",
        "Multimedia ilimitado",
        "Videos promocionales",
        "Optimización SEO on-page avanzada para mejorar la visibilidad en buscadores",
        "Página web básica (landing de 1 página)",
        "Incluye tus datos, fotos y contacto alojados por IztapaMarket",
        "Integración con redes sociales",
        "Crear logo con IA (incluido)",
        "Crear portada con IA (incluido)",
        "Estadísticas avanzadas",
        "Soporte 24/7",
        "Promociones ilimitadas",
        "Insignia de 'Destacado'",
        "Aparición en página principal",
        "Prioridad en búsquedas",
      ],
      limitations: [],
    },
  ];

  const beneficiosAdicionales = [
    {
      icon: BarChart3,
      title: "Estadísticas Detalladas",
      description: "Conoce cómo interactúan los usuarios con tu negocio",
    },
    {
      icon: Megaphone,
      title: "Promociones Destacadas",
      description: "Anuncia ofertas especiales y eventos",
    },
    {
      icon: Globe,
      title: "Presencia Digital",
      description: "Sitio web básico incluido en plan Premium",
    },
    {
      icon: Headphones,
      title: "Soporte Especializado",
      description: "Atención personalizada para hacer crecer tu negocio",
    },
  ];

  return (
    <div className="min-h-screen py-20">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-[#003366] via-[#1e40af] to-[#f97316] text-white py-20 overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Planes y Precios
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-blue-100 max-w-3xl mx-auto">
              Elige el plan perfecto para hacer crecer tu negocio en Iztapalapa
            </p>
            <div className="inline-flex items-center bg-white/10 backdrop-blur-md rounded-full px-6 py-3 text-white">
              <Star className="w-5 h-5 mr-2 text-[#f97316]" />
              <span className="font-semibold">
                Sin compromisos • Cancela cuando quieras
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Planes Section */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {planes.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className={`relative bg-white rounded-3xl shadow-xl overflow-hidden ${
                  plan.popular ? "ring-4 ring-[#f97316] scale-105" : ""
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-[#f97316] to-[#ea580c] text-white text-center py-3 font-bold">
                    🔥 MÁS POPULAR
                  </div>
                )}

                <div
                  className={`bg-gradient-to-br ${plan.color} p-8 text-white ${
                    plan.popular ? "pt-16" : ""
                  }`}
                >
                  <div className="flex items-center justify-center mb-4">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                      <plan.icon className="w-8 h-8" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-center mb-2">
                    {plan.name}
                  </h3>
                  <div className="text-center mb-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-lg opacity-90">{plan.period}</span>
                  </div>
                  <p className="text-center text-white/90">
                    {plan.description}
                  </p>
                </div>

                <div className="p-8">
                  <div className="mb-8">
                    <h4 className="font-bold text-[#003366] mb-4 flex items-center">
                      <Check className="w-5 h-5 mr-2 text-green-500" />
                      Incluye:
                    </h4>
                    <ul className="space-y-3">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start">
                          <Check className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-700">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {plan.limitations.length > 0 && (
                    <div className="mb-8">
                      <h4 className="font-bold text-gray-500 mb-4">
                        Limitaciones:
                      </h4>
                      <ul className="space-y-2">
                        {plan.limitations.map((limitation, idx) => (
                          <li key={idx} className="flex items-start">
                            <span className="w-5 h-5 text-gray-400 mr-3 mt-0.5">
                              •
                            </span>
                            <span className="text-gray-500 text-sm">
                              {limitation}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <Button
                    onClick={() => handlePlanClick(plan.name)}
                    className={`w-full ${plan.buttonColor} text-white font-bold py-4 text-lg rounded-xl shadow-lg hover:shadow-xl transition-all duration-300`}
                  >
                    {plan.name === "Free" ? "Comenzar Gratis" : "Elegir Plan"}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>

                  {plan.name !== "Free" && (
                    <p className="text-center text-gray-500 text-sm mt-4">
                      Facturación mensual • Sin permanencia
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Beneficios Adicionales */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-[#003366] mb-4">
              Beneficios Adicionales
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Todas las herramientas que necesitas para hacer crecer tu negocio
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {beneficiosAdicionales.map((beneficio, index) => (
              <motion.div
                key={beneficio.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="text-center p-6 rounded-xl bg-gradient-to-br from-blue-50 to-orange-50 hover:shadow-lg transition-shadow"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-[#003366] to-[#f97316] rounded-full flex items-center justify-center mx-auto mb-4">
                  <beneficio.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-bold text-[#003366] mb-2">
                  {beneficio.title}
                </h3>
                <p className="text-gray-600">{beneficio.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparación de Planes */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-[#003366] mb-4">
              Comparación Detallada
            </h2>
            <p className="text-xl text-gray-600">
              Encuentra el plan que mejor se adapte a tus necesidades
            </p>
          </motion.div>

          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-[#003366] to-[#f97316] text-white">
                  <tr>
                    <th className="px-6 py-4 text-left font-bold">
                      Características
                    </th>
                    <th className="px-6 py-4 text-center font-bold">Free</th>
                    <th className="px-6 py-4 text-center font-bold">
                      Profesional
                    </th>
                    <th className="px-6 py-4 text-center font-bold">Premium</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      Número de imágenes
                    </td>
                    <td className="px-6 py-4 text-center">1</td>
                    <td className="px-6 py-4 text-center">5</td>
                    <td className="px-6 py-4 text-center">Ilimitadas</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      Redes sociales
                    </td>
                    <td className="px-6 py-4 text-center">❌</td>
                    <td className="px-6 py-4 text-center">✅</td>
                    <td className="px-6 py-4 text-center">✅</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      Mapa integrado
                    </td>
                    <td className="px-6 py-4 text-center">❌</td>
                    <td className="px-6 py-4 text-center">✅</td>
                    <td className="px-6 py-4 text-center">✅</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      Página web básica (landing de 1 página)
                    </td>
                    <td className="px-6 py-4 text-center">❌</td>
                    <td className="px-6 py-4 text-center">❌</td>
                    <td className="px-6 py-4 text-center">✅</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      Videos
                    </td>
                    <td className="px-6 py-4 text-center">❌</td>
                    <td className="px-6 py-4 text-center">❌</td>
                    <td className="px-6 py-4 text-center">✅</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      Logo con IA
                    </td>
                    <td className="px-6 py-4 text-center">❌</td>
                    <td className="px-6 py-4 text-center">❌</td>
                    <td className="px-6 py-4 text-center">✅</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      Portada con IA
                    </td>
                    <td className="px-6 py-4 text-center">❌</td>
                    <td className="px-6 py-4 text-center">❌</td>
                    <td className="px-6 py-4 text-center">✅</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      Estadísticas
                    </td>
                    <td className="px-6 py-4 text-center">❌</td>
                    <td className="px-6 py-4 text-center">Básicas</td>
                    <td className="px-6 py-4 text-center">Avanzadas</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      Posicionamiento SEO
                    </td>
                    <td className="px-6 py-4 text-center">Básico</td>
                    <td className="px-6 py-4 text-center">Mejorado</td>
                    <td className="px-6 py-4 text-center">Destacado</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      Soporte
                    </td>
                    <td className="px-6 py-4 text-center">Email</td>
                    <td className="px-6 py-4 text-center">Email</td>
                    <td className="px-6 py-4 text-center">24/7</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-[#003366] mb-4">
              Preguntas Frecuentes
            </h2>
            <p className="text-xl text-gray-600">
              Resolvemos tus dudas sobre nuestros planes
            </p>
          </motion.div>

          <div className="space-y-8">
            <div className="bg-gradient-to-br from-blue-50 to-orange-50 rounded-xl p-6">
              <h3 className="text-lg font-bold text-[#003366] mb-2">
                ¿Puedo cambiar de plan en cualquier momento?
              </h3>
              <p className="text-gray-700">
                Sí, puedes actualizar o degradar tu plan en cualquier momento.
                Los cambios se aplicarán en tu próximo ciclo de facturación.
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-orange-50 rounded-xl p-6">
              <h3 className="text-lg font-bold text-[#003366] mb-2">
                ¿Hay permanencia mínima?
              </h3>
              <p className="text-gray-700">
                No, no hay permanencia mínima. Puedes cancelar tu suscripción en
                cualquier momento sin penalizaciones.
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-orange-50 rounded-xl p-6">
              <h3 className="text-lg font-bold text-[#003366] mb-2">
                ¿Qué métodos de pago aceptan?
              </h3>
              <p className="text-gray-700">
                Aceptamos tarjetas de crédito y débito, transferencias bancarias
                y pagos en OXXO a través de Mercado Pago.
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-orange-50 rounded-xl p-6">
              <h3 className="text-lg font-bold text-[#003366] mb-2">
                ¿Ofrecen descuentos por pagos anuales?
              </h3>
              <p className="text-gray-700">
                Sí, ofrecemos 2 meses gratis al pagar anualmente. Contáctanos
                para más información sobre esta promoción.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 bg-gradient-to-br from-[#003366] to-[#f97316] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl font-bold mb-6">
              ¿Listo para Hacer Crecer tu Negocio?
            </h2>
            <p className="text-xl mb-8 text-blue-100">
              Únete a cientos de negocios que ya confían en IztapaMarket
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                asChild
                size="lg"
                className="bg-white text-[#003366] hover:bg-gray-100 font-semibold px-8 py-4 text-lg"
              >
                <Link to="/registro">
                  Comenzar Gratis
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="border-2 border-white text-white hover:bg-white hover:text-[#003366] font-semibold px-8 py-4 text-lg"
                onClick={() =>
                  toast({
                    title: "🚧 Esta funcionalidad aún no está implementada",
                    description:
                      "¡Pero no te preocupes! Puedes solicitarla en tu próximo mensaje! 🚀",
                    duration: 5000,
                  })
                }
              >
                <Phone className="w-5 h-5 mr-2" />
                Contactar Ventas
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Precios;
