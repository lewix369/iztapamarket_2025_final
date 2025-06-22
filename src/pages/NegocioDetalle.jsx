import React from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  MapPin,
  Phone,
  Clock,
  Star,
  Globe,
  Instagram,
  Facebook,
  MessageCircle,
  Youtube,
  ExternalLink,
  Mail,
  Navigation,
  Share2,
  Heart,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { getNegocioPorSlug } from "@/data/negocios";

const NegocioDetalle = () => {
  const { slug } = useParams();
  const { toast } = useToast();
  const negocio = getNegocioPorSlug(slug);
  if (!negocio || negocio.is_deleted) return null;

  const handleContactClick = (type) => {
    if (type === "whatsapp" && negocio.whatsapp) {
      window.open(`https://wa.me/52${negocio.whatsapp}`, "_blank");
    } else if (type === "phone" && negocio.telefono) {
      window.open(`tel:${negocio.telefono}`, "_blank");
    } else {
      toast({
        title: "🚧 Esta funcionalidad aún no está implementada",
        description:
          "¡Pero no te preocupes! Puedes solicitarla en tu próximo mensaje! 🚀",
        duration: 5000,
      });
    }
  };

  const handleSocialClick = (platform) => {
    if (platform === "instagram" && negocio.instagram) {
      window.open(
        `https://instagram.com/${negocio.instagram.replace("@", "")}`,
        "_blank"
      );
    } else if (platform === "facebook" && negocio.facebook) {
      window.open(`https://facebook.com/${negocio.facebook}`, "_blank");
    } else if (platform === "web" && negocio.web) {
      window.open(negocio.web, "_blank");
    } else {
      toast({
        title: "🚧 Esta funcionalidad aún no está implementada",
        description:
          "¡Pero no te preocupes! Puedes solicitarla en tu próximo mensaje! 🚀",
        duration: 5000,
      });
    }
  };

  const getPlanBadge = (planType) => {
    switch (planType) {
      case "premium":
        return {
          text: "Premium",
          color: "bg-[#f97316] text-white",
          icon: <Star className="w-4 h-4" />,
        };
      case "profesional":
        return { text: "Pro", color: "bg-blue-500 text-white", icon: null };
      default:
        return { text: "Gratis", color: "bg-gray-500 text-white", icon: null };
    }
  };

  return (
    <div className="min-h-screen py-20">
      {/* Navegación */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <Link
          to={`/categorias/${negocio.slug_categoria}`}
          className="flex items-center text-gray-600 hover:text-[#f97316] transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Volver a {negocio.categoria}
        </Link>
      </div>

      {/* Hero Section */}
      <section className="relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Imagen principal */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <img
                src={negocio.imagen_url}
                alt={negocio.nombre}
                className="w-full h-96 object-cover rounded-2xl shadow-xl"
              />
              <div
                className={`absolute top-4 right-4 px-4 py-2 rounded-full text-sm font-semibold flex items-center ${
                  getPlanBadge(negocio.plan_type).color
                }`}
              >
                {getPlanBadge(negocio.plan_type).icon}
                {getPlanBadge(negocio.plan_type).icon && (
                  <span className="ml-2">
                    {getPlanBadge(negocio.plan_type).text}
                  </span>
                )}
                {!getPlanBadge(negocio.plan_type).icon &&
                  getPlanBadge(negocio.plan_type).text}
              </div>
              {negocio.is_featured && (
                <div className="absolute top-4 left-4 bg-yellow-500 text-white px-3 py-2 rounded-full text-sm font-bold flex items-center">
                  <Star className="w-4 h-4 mr-1" />
                  DESTACADO
                </div>
              )}
            </motion.div>

            {/* Información principal */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="space-y-6"
            >
              <div>
                <div className="flex items-center gap-3 mb-2">
                  {negocio.logo_url && (
                    <img
                      src={negocio.logo_url}
                      alt={`Logo de ${negocio.nombre}`}
                      className="w-12 h-12 object-cover rounded-full"
                    />
                  )}
                  <div>
                    <h1 className="text-3xl md:text-4xl font-bold text-[#003366]">
                      {negocio.nombre}
                    </h1>
                    <span className="text-[#f97316] font-semibold text-lg">
                      {negocio.categoria}
                    </span>
                  </div>
                </div>
                <p className="text-gray-700 text-lg leading-relaxed">
                  {negocio.descripcion}
                </p>
              </div>

              {/* Información de contacto */}
              <div className="space-y-3">
                <div className="flex items-center text-gray-600">
                  <MapPin className="w-5 h-5 mr-3 text-[#f97316]" />
                  <span>{negocio.direccion}</span>
                </div>

                {negocio.telefono && (
                  <div className="flex items-center text-gray-600">
                    <Phone className="w-5 h-5 mr-3 text-[#f97316]" />
                    <span>{negocio.telefono}</span>
                  </div>
                )}

                {negocio.hours && (
                  <div className="flex items-center text-gray-600">
                    <Clock className="w-5 h-5 mr-3 text-[#f97316]" />
                    <span>{negocio.hours}</span>
                  </div>
                )}
              </div>

              {/* Botones de acción */}
              <div className="flex flex-wrap gap-3">
                {negocio.whatsapp && (
                  <Button
                    onClick={() => handleContactClick("whatsapp")}
                    className="bg-green-500 hover:bg-green-600 text-white flex items-center"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    WhatsApp
                  </Button>
                )}

                {negocio.telefono && (
                  <Button
                    onClick={() => handleContactClick("phone")}
                    variant="outline"
                    className="border-[#003366] text-[#003366] hover:bg-[#003366] hover:text-white flex items-center"
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Llamar
                  </Button>
                )}

                <Button
                  onClick={() => handleContactClick("directions")}
                  variant="outline"
                  className="border-[#f97316] text-[#f97316] hover:bg-[#f97316] hover:text-white flex items-center"
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  Cómo llegar
                </Button>
              </div>

              {/* Redes sociales */}
              {(negocio.instagram || negocio.facebook || negocio.web) && (
                <div className="border-t pt-6">
                  <h3 className="font-semibold text-[#003366] mb-3">
                    Síguenos en:
                  </h3>
                  <div className="flex gap-3">
                    {negocio.instagram && (
                      <button
                        onClick={() => handleSocialClick("instagram")}
                        className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white hover:scale-110 transition-transform"
                      >
                        <Instagram className="w-5 h-5" />
                      </button>
                    )}

                    {negocio.facebook && (
                      <button
                        onClick={() => handleSocialClick("facebook")}
                        className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white hover:scale-110 transition-transform"
                      >
                        <Facebook className="w-5 h-5" />
                      </button>
                    )}

                    {negocio.web && (
                      <button
                        onClick={() => handleSocialClick("web")}
                        className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-white hover:scale-110 transition-transform"
                      >
                        <Globe className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Servicios */}
      {negocio.services && negocio.services.length > 0 && (
        <section className="py-16 bg-gradient-to-br from-gray-50 to-blue-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl font-bold text-[#003366] mb-8 text-center">
                Nuestros Servicios
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {negocio.services.map((service, index) => (
                  <div
                    key={index}
                    className="bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-[#f97316] rounded-full mr-3"></div>
                      <span className="font-medium text-gray-800">
                        {service}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Menú/Precios */}
      {negocio.menu && (
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl font-bold text-[#003366] mb-8 text-center">
                Menú y Precios
              </h2>
              <div className="bg-gradient-to-br from-blue-50 to-orange-50 p-8 rounded-2xl">
                <p className="text-gray-700 text-lg leading-relaxed whitespace-pre-line">
                  {negocio.menu}
                </p>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Galería de imágenes */}
      {negocio.gallery_images && negocio.gallery_images.length > 0 && (
        <section className="py-16 bg-gradient-to-br from-gray-50 to-blue-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl font-bold text-[#003366] mb-8 textcenter flex items-center">
                <Camera className="w-6 h-6 mr-2" />
                Galería de Fotos
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {negocio.gallery_images.map((image, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    className="group cursor-pointer"
                    onClick={() =>
                      toast({
                        title: "🚧 Esta funcionalidad aún no está implementada",
                        description:
                          "¡Pero no te preocupes! Puedes solicitarla en tu próximo mensaje! 🚀",
                        duration: 5000,
                      })
                    }
                  >
                    <img
                      src={image}
                      alt={`Galería ${negocio.nombre} ${index + 1}`}
                      className="w-full h-48 object-cover rounded-xl shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105"
                    />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Video */}
      {negocio.video_embed_url && (
        <section className="py-16 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl font-bold text-[#003366] mb-8 text-center flex items-center justify-center">
                <Youtube className="w-6 h-6 mr-2" />
                Video Promocional
              </h2>
              <div className="relative aspect-video rounded-2xl overflow-hidden shadow-xl">
                <iframe
                  src={negocio.video_embed_url}
                  title={`Video de ${negocio.nombre}`}
                  className="w-full h-full"
                  allowFullScreen
                ></iframe>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Mapa */}
      {negocio.mapa_embed_url && (
        <section className="py-16 bg-gradient-to-br from-gray-50 to-blue-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl font-bold text-[#003366] mb-8 text-center">
                Ubicación
              </h2>
              <div className="bg-white p-4 rounded-2xl shadow-xl">
                <div className="relative aspect-video rounded-xl overflow-hidden">
                  <iframe
                    src={negocio.mapa_embed_url}
                    title={`Ubicación de ${negocio.nombre}`}
                    className="w-full h-full"
                    allowFullScreen
                  ></iframe>
                </div>
                <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center text-gray-700">
                    <MapPin className="w-5 h-5 mr-3 text-[#f97316]" />
                    <span className="font-medium">{negocio.direccion}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Acciones adicionales */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl font-bold text-[#003366] mb-8">
              ¿Te gustó este negocio?
            </h2>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() =>
                  toast({
                    title: "🚧 Esta funcionalidad aún no está implementada",
                    description:
                      "¡Pero no te preocupes! Puedes solicitarla en tu próximo mensaje! 🚀",
                    duration: 5000,
                  })
                }
                className="bg-red-500 hover:bg-red-600 text-white flex items-center"
              >
                <Heart className="w-4 h-4 mr-2" />
                Agregar a Favoritos
              </Button>

              <Button
                onClick={() =>
                  toast({
                    title: "🚧 Esta funcionalidad aún no está implementada",
                    description:
                      "¡Pero no te preocupes! Puedes solicitarla en tu próximo mensaje! 🚀",
                    duration: 5000,
                  })
                }
                variant="outline"
                className="border-[#003366] text-[#003366] hover:bg-[#003366] hover:text-white flex items-center"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Compartir
              </Button>

              <Button
                onClick={() =>
                  toast({
                    title: "🚧 Esta funcionalidad aún no está implementada",
                    description:
                      "¡Pero no te preocupes! Puedes solicitarla en tu próximo mensaje! 🚀",
                    duration: 5000,
                  })
                }
                variant="outline"
                className="border-[#f97316] text-[#f97316] hover:bg-[#f97316] hover:text-white flex items-center"
              >
                <Mail className="w-4 h-4 mr-2" />
                Reportar Error
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-br from-[#003366] to-[#f97316] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl font-bold mb-4">
              ¿Tienes un Negocio en Iztapalapa?
            </h2>
            <p className="text-xl mb-8 text-blue-100">
              Únete a IztapaMarket y haz que más personas descubran tu negocio
            </p>
            <Button
              asChild
              size="lg"
              className="bg-white text-[#003366] hover:bg-gray-100 font-semibold px-8 py-4 text-lg"
            >
              <Link to="/registro">
                Registrar Mi Negocio
                <ExternalLink className="w-5 h-5 ml-2" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default NegocioDetalle;
