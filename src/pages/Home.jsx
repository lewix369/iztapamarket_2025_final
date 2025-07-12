import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search,
  Star,
  MapPin,
  ArrowRight,
  Store,
  Users,
  Award,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useSupabase } from "@/contexts/SupabaseContext";
import { getFeaturedBusinesses } from "@/lib/database";

const HomePage = () => {
  const { supabase } = useSupabase();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [featuredBusinesses, setFeaturedBusinesses] = useState([]);
  const [heroSearchQuery, setHeroSearchQuery] = useState("");

  const loadFeaturedBusinesses = useCallback(async () => {
    const data = await getFeaturedBusinesses(supabase);
    const approved = Array.isArray(data)
      ? data.filter((b) => b.nombre && b.slug && b.imagen_url && b.is_approved)
      : [];
    setFeaturedBusinesses(approved);
  }, [supabase]);

  useEffect(() => {
    loadFeaturedBusinesses();
  }, [loadFeaturedBusinesses]);

  const handleHeroSearch = (e) => {
    e.preventDefault();
    if (heroSearchQuery.trim()) {
      navigate(`/negocios?q=${encodeURIComponent(heroSearchQuery.trim())}`);
    } else {
      toast({
        title: "⚠️ Campo vacío",
        description: "Por favor, ingresa un término de búsqueda.",
        variant: "destructive",
      });
    }
  };

  const stats = [
    { icon: Store, label: "Negocios Registrados", value: "150+" },
    { icon: Users, label: "Usuarios Activos", value: "2,500+" },
    { icon: Award, label: "Reseñas Positivas", value: "98%" },
    { icon: TrendingUp, label: "Crecimiento Mensual", value: "25%" },
  ];

  const isValidBusiness = (b) => b && b.nombre && b.slug && b.imagen_url;

  return (
    <div className="min-h-screen">
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
                <Badge className="bg-orange-500 text-white px-4 py-2 text-sm font-semibold">
                  🏆 #1 en Iztapa
                </Badge>
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
                  <Input
                    type="text"
                    placeholder="¿Qué negocio buscas?"
                    value={heroSearchQuery}
                    onChange={(e) => setHeroSearchQuery(e.target.value)}
                    className="pl-12 h-14 text-lg bg-white/90 border-0 shadow-lg text-black"
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
                {[
                  { name: "Restaurantes", slug: "alimentos-y-bebidas" },
                  { name: "Hoteles", slug: "hospedaje" },
                  { name: "Servicios", slug: "servicios-del-hogar" },
                  { name: "Comercios", slug: "moda-y-tiendas" },
                ].map(({ name, slug }) => (
                  <Link key={slug} to={`/negocios/categoria/${slug}`}>
                    <Badge
                      variant="outline"
                      className="bg-white/10 text-white border-white/30 hover:bg-white/20 cursor-pointer transition-colors"
                    >
                      {name}
                    </Badge>
                  </Link>
                ))}
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <div className="relative z-10 translate-x-0 lg:translate-x-[-4.5%]">
                <motion.div
                  className="relative w-full h-[28rem] flex justify-center items-center rounded-2xl shadow-2xl bg-gradient-to-b from-orange-500 via-orange-500 to-orange-400"
                  animate={{ y: [0, -5, 0] }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  {/* Botones solo visibles en escritorio */}
                  <div className="absolute top-[48%] left-[4%] transform -translate-y-1/2 w-full max-w-xs hidden lg:flex flex-col gap-3 items-start px-4">
                    <Link to="/registro?plan=free" className="w-full">
                      <Button className="bg-blue-700 hover:bg-blue-800 text-white font-bold px-5 py-2 rounded-full shadow-md w-full text-center">
                        Registrar Negocio
                      </Button>
                    </Link>
                    <Link to="/descargar" className="w-full">
                      <Button className="bg-white text-blue-700 hover:bg-gray-100 font-bold px-5 py-2 rounded-full shadow-md w-full text-center">
                        Descargar App
                      </Button>
                    </Link>
                  </div>

                  {/* Botones móviles ya existentes (no se tocan) */}
                  <motion.div
                    className="absolute bottom-[5%] left-[4%] w-[90%] sm:static sm:w-auto text-center px-4 sm:px-0 lg:hidden"
                    animate={{ y: [0, -5, 0] }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <p className="mb-3">
                      Registra tu negocio{" "}
                      <span className="text-blue-800 font-extrabold underline underline-offset-4">
                        GRATIS
                      </span>
                    </p>
                    <div className="flex flex-col gap-3">
                      <Link to="/registro?plan=free">
                        <Button className="bg-blue-700 hover:bg-blue-800 text-white font-bold px-5 py-2 rounded-full shadow-md w-full text-center">
                          Registrar Negocio
                        </Button>
                      </Link>
                      <Link to="/descargar">
                        <Button className="bg-white text-blue-700 hover:bg-gray-100 font-bold px-5 py-2 rounded-full shadow-md w-full text-center">
                          Descargar App
                        </Button>
                      </Link>
                    </div>
                  </motion.div>

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
                </motion.div>
              </div>
              <div className="absolute -top-4 -right-4 w-72 h-72 bg-orange-500/20 rounded-full blur-3xl"></div>
              <div className="absolute -bottom-4 -left-4 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl"></div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-12 bg-white">
        <div className="container mx-auto text-center">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">
            Negocios Destacados
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {featuredBusinesses.length > 0 ? (
              featuredBusinesses.map((b) => (
                <Card key={b.slug}>
                  <CardHeader>
                    <img
                      src={b.imagen_url}
                      alt={b.nombre}
                      className="w-full h-40 object-cover rounded-md"
                    />
                  </CardHeader>
                  <CardContent>
                    <CardTitle>{b.nombre}</CardTitle>
                    <CardDescription>{b.descripcion}</CardDescription>
                    <Link
                      to={`/negocio/${b.slug}`}
                      className="text-blue-600 mt-2 inline-block"
                    >
                      Ver más
                    </Link>
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-gray-500 col-span-full">
                No hay negocios destacados disponibles.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
