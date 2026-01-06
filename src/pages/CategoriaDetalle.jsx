import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  MapPin,
  Star,
  ArrowRight,
  Phone,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { categorias } from "@/data/negocios";
import { supabase } from "@/lib/supabaseClient";

const CategoriaDetalle = () => {
  const { slug } = useParams();
  const categoria = categorias.find((cat) => cat.slug === slug);
  const [negocios, setNegocios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNegocios = async () => {
      const { data, error } = await supabase
        .from("negocios")
        .select("*")
        .eq("slug_categoria", slug)
        .eq("is_deleted", false);

      if (error) {
        console.error("Error al cargar negocios:", error);
      } else {
        setNegocios(data);
      }
      setLoading(false);
    };

    if (slug) {
      fetchNegocios();
    }
  }, [slug]);

  if (!categoria) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-700 mb-4">
            Categoría no encontrada
          </h1>
          <Link to="/categorias" className="text-[#f97316] hover:underline">
            Volver a categorías
          </Link>
        </div>
      </div>
    );
  }

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

  // Ordenar negocios por plan (Premium primero)
  const negociosOrdenados = negocios.sort((a, b) => {
    const orden = { premium: 1, profesional: 2, free: 3 };
    return orden[a.plan_type] - orden[b.plan_type];
  });

  return (
    <>
      <Helmet>
        <title>{categoria.nombre} | IztapaMarket</title>
        <meta
          name="description"
          content={`Negocios de ${categoria.nombre} en Iztapalapa.`}
        />
        <meta
          property="og:title"
          content={`${categoria.nombre} | IztapaMarket`}
        />
        <meta
          property="og:description"
          content={`Explora negocios de ${categoria.nombre} en Iztapalapa.`}
        />
        <meta
          property="og:url"
          content={`https://iztapamarket.com/categorias/${slug}`}
        />
      </Helmet>
      <div className="min-h-screen py-20">
        {/* Hero Section */}
        <section
          className={`bg-gradient-to-br ${categoria.color} text-white py-16`}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="flex items-center mb-6">
                <Link
                  to="/categorias"
                  className="flex items-center text-white/80 hover:text-white transition-colors mr-4"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Volver a categorías
                </Link>
              </div>

              <div className="flex items-center mb-6">
                <div className="text-6xl mr-6">{categoria.icono}</div>
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold mb-4">
                    {categoria.nombre}
                  </h1>
                  <p className="text-xl text-white/90 mb-4">
                    {categoria.descripcion}
                  </p>
                  <div className="text-white/80">
                    {negocios.length}{" "}
                    {negocios.length === 1
                      ? "negocio encontrado"
                      : "negocios encontrados"}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Lista de Negocios */}
        <section className="py-16 bg-gradient-to-br from-gray-50 to-blue-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {negocios.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">{categoria.icono}</div>
                <h3 className="text-2xl font-bold text-gray-700 mb-2">
                  Aún no hay negocios en esta categoría
                </h3>
                <p className="text-gray-500 mb-6">
                  Sé el primero en registrar tu negocio en {categoria.nombre}
                </p>
                <Button
                  asChild
                  className="bg-[#f97316] hover:bg-[#ea580c] text-white"
                >
                  <Link to="/registro">Registrar Mi Negocio</Link>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {negociosOrdenados.map((negocio, index) => (
                  <motion.div
                    key={negocio.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    className="group"
                  >
                    <Link to={`/negocio/${negocio.slug}`}>
                      <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group-hover:scale-105">
                        <div className="relative">
                          <img
                            src={negocio.imagen_url}
                            alt={negocio.nombre}
                            className="w-full h-48 object-cover"
                          />
                          <div
                            className={`absolute top-4 right-4 px-3 py-1 rounded-full text-sm font-semibold flex items-center ${
                              getPlanBadge(negocio.plan_type).color
                            }`}
                          >
                            {getPlanBadge(negocio.plan_type).icon}
                            {getPlanBadge(negocio.plan_type).icon && (
                              <span className="ml-1">
                                {getPlanBadge(negocio.plan_type).text}
                              </span>
                            )}
                            {!getPlanBadge(negocio.plan_type).icon &&
                              getPlanBadge(negocio.plan_type).text}
                          </div>
                          {negocio.is_featured && (
                            <div className="absolute top-4 left-4 bg-yellow-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                              ⭐ DESTACADO
                            </div>
                          )}
                        </div>

                        <div className="p-6">
                          <h3 className="text-xl font-bold text-[#003366] mb-2">
                            {negocio.nombre}
                          </h3>
                          <p className="text-gray-600 mb-3 line-clamp-2">
                            {negocio.descripcion}
                          </p>

                          <div className="space-y-2 mb-4">
                            <div className="flex items-center text-gray-500">
                              <MapPin className="w-4 h-4 mr-2 flex-shrink-0" />
                              <span className="text-sm">
                                {negocio.direccion}
                              </span>
                            </div>

                            {negocio.telefono && (
                              <div className="flex items-center text-gray-500">
                                <Phone className="w-4 h-4 mr-2 flex-shrink-0" />
                                <span className="text-sm">
                                  {negocio.telefono}
                                </span>
                              </div>
                            )}

                            {negocio.hours && (
                              <div className="flex items-center text-gray-500">
                                <Clock className="w-4 h-4 mr-2 flex-shrink-0" />
                                <span className="text-sm">{negocio.hours}</span>
                              </div>
                            )}
                          </div>

                          {negocio.services && negocio.services.length > 0 && (
                            <div className="mb-4">
                              <div className="flex flex-wrap gap-1">
                                {negocio.services
                                  .slice(0, 3)
                                  .map((service, idx) => (
                                    <span
                                      key={idx}
                                      className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full"
                                    >
                                      {service}
                                    </span>
                                  ))}
                                {negocio.services.length > 3 && (
                                  <span className="text-gray-500 text-xs px-2 py-1">
                                    +{negocio.services.length - 3} más
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between">
                            <span className="text-[#f97316] font-semibold">
                              Ver detalles
                            </span>
                            <ArrowRight className="w-5 h-5 text-[#003366] group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl font-bold text-[#003366] mb-4">
                ¿Tienes un negocio de {categoria.nombre}?
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                Regístralo en IztapaMarket y llega a más clientes en tu zona
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  asChild
                  size="lg"
                  className="bg-gradient-to-r from-[#003366] to-[#f97316] hover:from-[#f97316] hover:to-[#003366] text-white font-semibold px-8 py-4"
                >
                  <Link to="/registro">
                    Registrar Mi Negocio
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="border-2 border-[#003366] text-[#003366] hover:bg-[#003366] hover:text-white font-semibold px-8 py-4"
                >
                  <Link to="/precios">Ver Planes y Precios</Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    </>
  );
};

export default CategoriaDetalle;
