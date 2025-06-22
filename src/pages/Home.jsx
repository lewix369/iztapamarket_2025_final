import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, ArrowRight, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { categorias } from "@/data/negocios";
import { supabase } from "@/lib/supabaseClient";

const Home = () => {
  const [negociosDestacados, setNegociosDestacados] = useState([]);

  useEffect(() => {
    const fetchDestacados = async () => {
      const { data, error } = await supabase
        .from("negocios")
        .select("*")
        .eq("is_featured", true)
        .eq("is_approved", true)
        .eq("is_deleted", false);

      if (error) {
        console.error("Error al cargar negocios destacados:", error);
      } else {
        setNegociosDestacados(data);
      }
    };

    fetchDestacados();
  }, []);

  const [heroSearchQuery, setHeroSearchQuery] = useState("");
  const navigate = useNavigate();

  const handleHeroSearch = (e) => {
    e.preventDefault();
    if (heroSearchQuery.trim()) {
      navigate(`/negocios?q=${encodeURIComponent(heroSearchQuery.trim())}`);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-orange-600 text-white">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative container mx-auto px-4 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-8"
            >
              <div className="space-y-4">
                <span className="inline-block bg-orange-500 text-white px-4 py-2 rounded-full text-sm font-semibold">
                  🏆 #1 en Iztapa
                </span>
                <h1 className="text-4xl md:text-6xl font-bold leading-tight">
                  Todo lo que buscas está en{" "}
                  <span className="text-orange-300">IztapaMarket</span>
                </h1>
              </div>
              <form
                onSubmit={handleHeroSearch}
                className="flex flex-col sm:flex-row gap-4"
              >
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="¿Qué negocio buscas?"
                    value={heroSearchQuery}
                    onChange={(e) => setHeroSearchQuery(e.target.value)}
                    className="pl-12 h-14 text-lg bg-white/90 border-0 shadow-lg text-black w-full rounded-md"
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="h-14 px-8 bg-orange-500 hover:bg-orange-600 text-white font-semibold shadow-lg"
                >
                  Buscar <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </form>
              <div className="flex flex-wrap gap-3">
                {["Restaurantes", "Hoteles", "Servicios", "Comercios"].map(
                  (category) => (
                    <span
                      key={category}
                      className="bg-white/10 text-white border border-white/30 px-3 py-1 rounded-full text-sm"
                    >
                      {category}
                    </span>
                  )
                )}
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <div className="relative z-10">
                <div className="relative w-full h-[28rem] flex justify-center items-center rounded-2xl shadow-2xl bg-gradient-to-b from-orange-500 via-orange-500 to-orange-400">
                  <div className="absolute top-[34%] left-[12%] transform -translate-y-1/2 text-white text-justify text-xl font-semibold z-20">
                    <p className="mb-3">
                      Registra tu negocio{" "}
                      <span className="text-blue-800 font-extrabold underline underline-offset-4">
                        GRATIS
                      </span>
                    </p>
                    <div className="flex flex-col gap-3">
                      <Link to="/registro/free">
                        <Button className="bg-blue-700 hover:bg-blue-800 text-white font-bold px-5 py-2 rounded-full shadow-md w-full text-center">
                          Registrar Negocio
                        </Button>
                      </Link>
                      <a
                        href="#"
                        className="bg-white text-blue-700 hover:bg-gray-100 font-bold px-5 py-2 rounded-full shadow-md w-full text-center"
                      >
                        Descargar App
                      </a>
                    </div>
                  </div>
                  <img
                    src="/iztapamarket%20cover.png"
                    alt="Avatar IztapaMarket"
                    className="h-[90%] object-contain"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src =
                        "https://raw.githubusercontent.com/lewix369/iztapamarket_directorio_2025/main/public/iztapamarket%20cover.png";
                    }}
                  />
                </div>
              </div>
              <div className="absolute -top-4 -right-4 w-72 h-72 bg-orange-500/20 rounded-full blur-3xl"></div>
              <div className="absolute -bottom-4 -left-4 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl"></div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Negocios Destacados */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-[#003366] mb-4">
              Negocios Destacados
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Conoce algunos de los negocios que están marcando la diferencia en
              Iztapalapa
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {negociosDestacados.map((negocio, index) => (
              <motion.div
                key={negocio.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-xl transition-all duration-300">
                  <img
                    src={negocio.imagen_url}
                    alt={negocio.nombre}
                    className="h-40 w-full object-cover rounded-lg mb-4"
                  />
                  <h3 className="text-xl font-bold text-[#003366] mb-2">
                    {negocio.nombre}
                  </h3>
                  <p className="text-gray-600 mb-4 line-clamp-2">
                    {negocio.descripcion}
                  </p>
                  <Link
                    to={`/negocio/${negocio.slug}`}
                    className="text-orange-600 font-semibold hover:underline"
                  >
                    Ver detalles
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
