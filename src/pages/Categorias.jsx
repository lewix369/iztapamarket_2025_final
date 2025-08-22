import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search,
  Filter,
  MapPin,
  Star,
  ArrowRight,
  Grid,
  List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { categorias } from "@/data/negocios";
import { supabase } from "@/lib/supabaseClient";

const Categorias = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [negocios, setNegocios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNegocios = async () => {
      const { data, error } = await supabase
        .from("negocios")
        .select("*")
        .eq("is_deleted", false)
        .eq("is_approved", true);

      if (error) {
        console.error("Error al cargar negocios:", error);
      } else {
        console.log("🧪 Negocios desde Supabase:", data);
        // Normaliza el plan ("pro" -> "profesional") y ordena premium &gt; profesional &gt; free
        const normalized = (data || []).map((n) => {
          const p = (n.plan_type || "").toLowerCase().trim();
          const plan_type = p === "pro" ? "profesional" : p;
          return { ...n, plan_type };
        });
        const orden = { premium: 1, profesional: 2, free: 3 };
        const ordenados = normalized.sort(
          (a, b) => (orden[a.plan_type] || 99) - (orden[b.plan_type] || 99)
        );
        setNegocios(ordenados);
      }
      setLoading(false);
    };

    fetchNegocios();
  }, []);

  const filteredNegocios = negocios.filter((negocio) => {
    const matchesSearch =
      negocio.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (negocio.descripcion || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === "" || negocio.slug_categoria === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getPlanBadge = (planType) => {
    switch (planType) {
      case "premium":
        return {
          text: "Premium",
          color: "bg-[#f97316] text-white",
          icon: <Star className="w-4 h-4" />,
        };
      case "profesional":
        return {
          text: "Profesional",
          color: "bg-blue-500 text-white",
          icon: null,
        };
      default:
        return { text: "Gratis", color: "bg-gray-500 text-white", icon: null };
    }
  };

  console.log("👀 Negocios filtrados para mostrar:", filteredNegocios);
  return (
    <div className="min-h-screen py-20">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-[#003366] via-[#1e40af] to-[#f97316] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Explora Todos los Negocios
            </h1>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              Descubre la diversidad de comercios y servicios en Iztapalapa
            </p>
          </motion.div>
        </div>
      </section>

      {/* Filtros y Búsqueda */}
      <section className="py-8 bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            {/* Búsqueda */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar negocios..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f97316] focus:border-transparent"
              />
            </div>

            {/* Filtro por categoría */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f97316] focus:border-transparent appearance-none bg-white"
                >
                  <option value="">Todas las categorías</option>
                  {categorias.map((categoria) => (
                    <option key={categoria.slug} value={categoria.slug}>
                      {categoria.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Modo de vista */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 rounded ${
                    viewMode === "grid" ? "bg-white shadow" : ""
                  }`}
                >
                  <Grid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 rounded ${
                    viewMode === "list" ? "bg-white shadow" : ""
                  }`}
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Resultados */}
          <div className="mt-4 text-gray-600">
            Mostrando {filteredNegocios.length} de {negocios.length} negocios
          </div>
        </div>
      </section>

      {/* Categorías Destacadas */}
      <section className="py-16 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-[#003366] mb-4">
              Categorías Principales
            </h2>
            <p className="text-lg text-gray-600">Explora por tipo de negocio</p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {categorias.map((categoria, index) => (
              <motion.div
                key={categoria.slug}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <Link
                  to={`/categorias/${categoria.slug}`}
                  className="block group"
                >
                  <div
                    className={`bg-gradient-to-br ${categoria.color} p-6 rounded-xl text-white hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl text-center`}
                  >
                    <div className="text-3xl mb-2">{categoria.icono}</div>
                    <h3 className="font-bold text-sm">{categoria.nombre}</h3>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Lista de Negocios */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {filteredNegocios.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-2xl font-bold text-gray-700 mb-2">
                No se encontraron negocios
              </h3>
              <p className="text-gray-500 mb-6">
                Intenta con otros términos de búsqueda o categorías
              </p>
              <Button
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategory("");
                }}
                className="bg-[#f97316] hover:bg-[#ea580c] text-white"
              >
                Limpiar filtros
              </Button>
            </div>
          ) : (
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
                  : "space-y-6"
              }
            >
              {filteredNegocios.map((negocio, index) => (
                <motion.div
                  key={negocio.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.05 }}
                  className="group"
                >
                  <Link to={`/negocio/${negocio.slug}`}>
                    {viewMode === "grid" ? (
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
                        </div>
                        <div className="p-6">
                          <h3 className="text-xl font-bold text-[#003366] mb-2">
                            {negocio.nombre}
                          </h3>
                          <p className="text-gray-600 mb-3 line-clamp-2">
                            {negocio.descripcion}
                          </p>
                          <div className="flex items-center text-gray-500 mb-3">
                            <MapPin className="w-4 h-4 mr-2" />
                            <span className="text-sm">{negocio.direccion}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[#f97316] font-semibold">
                              {negocio.categoria}
                            </span>
                            <ArrowRight className="w-5 h-5 text-[#003366] group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                        <div className="flex">
                          <div className="relative w-48 h-32 flex-shrink-0">
                            <img
                              src={negocio.imagen_url}
                              alt={negocio.nombre}
                              className="w-full h-full object-cover"
                            />
                            <div
                              className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-semibold flex items-center ${
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
                          </div>
                          <div className="flex-1 p-6">
                            <div className="flex justify-between items-start mb-2">
                              <h3 className="text-xl font-bold text-[#003366]">
                                {negocio.nombre}
                              </h3>
                              <span className="text-[#f97316] font-semibold text-sm">
                                {negocio.categoria}
                              </span>
                            </div>
                            <p className="text-gray-600 mb-3 line-clamp-2">
                              {negocio.descripcion}
                            </p>
                            <div className="flex items-center text-gray-500">
                              <MapPin className="w-4 h-4 mr-2" />
                              <span className="text-sm">
                                {negocio.direccion}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center pr-6">
                            <ArrowRight className="w-6 h-6 text-[#003366] group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </div>
                    )}
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
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
              ¿No Encuentras tu Negocio?
            </h2>
            <p className="text-xl mb-8 text-blue-100">
              Regístralo gratis y comienza a recibir más clientes hoy mismo
            </p>
            <Button
              asChild
              size="lg"
              className="bg-white text-[#003366] hover:bg-gray-100 font-semibold px-8 py-4 text-lg"
            >
              <Link to="/registro">
                Registrar Mi Negocio
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Categorias;
