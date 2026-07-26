import React, { useState, useEffect, useCallback, useRef } from "react";
import { Helmet } from "react-helmet";
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

// Elige la mejor imagen disponible para mostrar (evita que no salgan los destacados)
const pickImage = (b) =>
  b?.portada_url ||
  b?.imagen_url ||
  b?.cover_image_url ||
  b?.business_cover_url ||
  b?.logo_url ||
  b?.image_url ||
  null;

// Estilos del CTA "Ver más" según el plan del negocio
const getCtaClass = (plan) => {
  const p = (plan || "").toLowerCase().trim();
  if (p === "premium") return "bg-orange-500 hover:bg-orange-600";
  if (p === "profesional" || p === "professional")
    return "bg-blue-600 hover:bg-blue-700";
  return "bg-gray-700 hover:bg-gray-800";
};

// Normaliza y construye enlace de WhatsApp si el negocio lo tiene
const normalizeWhatsapp = (wa) => {
  if (!wa) return "";
  const s = String(wa).trim();
  if (s.startsWith("http")) {
    const m = s.match(/wa\.me\/(\d+)/);
    return m ? `https://wa.me/${m[1]}` : s;
  }
  const digits = s.replace(/[^0-9]/g, "");
  return digits ? `https://wa.me/${digits}` : "";
};

const HomePage = () => {
  const { supabase } = useSupabase();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [featuredBusinesses, setFeaturedBusinesses] = useState([]);
  const [heroSearchQuery, setHeroSearchQuery] = useState("");
  const featuredCarouselRef = useRef(null);

  const loadFeaturedBusinesses = useCallback(async () => {
    const data = await getFeaturedBusinesses(supabase);
    const approved = Array.isArray(data)
      ? data.filter((b) => b && b.is_approved && b.nombre && b.slug)
      : [];
    setFeaturedBusinesses(approved);
  }, [supabase]);

  useEffect(() => {
    loadFeaturedBusinesses();
  }, [loadFeaturedBusinesses]);

  useEffect(() => {
    const carousel = featuredCarouselRef.current;
    if (!carousel || featuredBusinesses.length <= 1) return;

    const isDesktop = () =>
      window.matchMedia("(min-width: 768px)").matches;

    const timer = window.setInterval(() => {
      if (isDesktop()) return;

      const firstCard = carousel.querySelector("[data-featured-card]");
      const cardGap = 16;
      const step = firstCard
        ? firstCard.getBoundingClientRect().width + cardGap
        : carousel.clientWidth * 0.82;
      const maxScrollLeft = carousel.scrollWidth - carousel.clientWidth;

      if (maxScrollLeft <= 0) return;

      const nextLeft = carousel.scrollLeft + step;
      carousel.scrollTo({
        left: nextLeft >= maxScrollLeft - 8 ? 0 : nextLeft,
        behavior: "smooth",
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [featuredBusinesses.length]);

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

  const goNearby = () => {
    navigate("/negocios?sort=nearby");
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
      <Helmet>
        <title>IztapaMarket - Directorio Local de Iztapalapa</title>
        <meta
          name="description"
          content="IztapaMarket: el directorio local de Iztapalapa, CDMX. Encuentra restaurantes, tiendas, servicios y negocios cerca de ti con información confiable."
        />
        <link rel="canonical" href="https://iztapamarket.com/" />
        <meta property="og:url" content="https://iztapamarket.com/" />
      </Helmet>

      <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-orange-600 text-white">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative container mx-auto px-4 py-12 md:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-8"
            >
              <div className="space-y-4">
                <Badge className="bg-orange-500 text-white px-4 py-2 text-sm font-semibold">
                  🏆 #1 Directorio Local en Iztapalapa
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
              <div className="flex items-center gap-3 mt-2">
                <Button
                  type="button"
                  onClick={goNearby}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-semibold shadow-lg"
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  Cerca de mí
                </Button>
                <span className="text-sm text-white/90">
                  A 1 km a la redonda
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
                <Link to="/registro?plan=free">
                  <Button className="h-12 w-full rounded-xl bg-orange-500 text-base font-bold text-white shadow-lg hover:bg-orange-600">
                    Registrar Negocio
                  </Button>
                </Link>
                <Link to="/descargar">
                  <Button className="h-12 w-full rounded-xl bg-white text-base font-bold text-blue-700 shadow-lg hover:bg-gray-100">
                    Descargar App
                  </Button>
                </Link>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative hidden lg:block"
            >
              <div className="relative z-10 translate-x-0 lg:translate-x-[-4.5%]">
                <motion.div
                  className="relative w-full h-[18rem] sm:h-[22rem] lg:h-[28rem] flex justify-center items-start lg:items-center overflow-hidden rounded-2xl shadow-2xl bg-gradient-to-b from-orange-500 via-orange-500 to-orange-400"
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

                  {/* CTA compacto para móvil */}
                  <motion.div
                    className="absolute bottom-5 left-1/2 z-20 w-[86%] -translate-x-1/2 text-center lg:hidden"
                    animate={{ y: [0, -5, 0] }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <p className="mb-3 text-white drop-shadow-sm">
                      Registra tu negocio{" "}
                      <span className="font-extrabold underline underline-offset-4">
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
                    src="/iztapamarket-cover.png"
                    alt="Avatar IztapaMarket"
                    className="mt-3 h-[62%] object-contain object-top sm:h-[70%] lg:mt-0 lg:h-[90%]"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = "/iztapamarket-cover.png";
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
          {featuredBusinesses.length > 1 && (
            <p className="mb-4 text-sm text-gray-500 md:hidden">
              Desliza hacia los lados para ver más negocios.
            </p>
          )}
          <div
            ref={featuredCarouselRef}
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-4 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0 md:pb-0"
          >
            {featuredBusinesses.length > 0 ? (
              featuredBusinesses.map((b) => (
                <Card
                  key={b.slug}
                  data-featured-card
                  className="w-[82vw] min-w-[82vw] snap-center shrink-0 md:w-auto md:min-w-0 md:snap-none"
                >
                  <CardHeader>
                    <div className="relative">
                      <img
                        src={pickImage(b) || "/placeholder-card.png"}
                        alt={b.nombre}
                        className="w-full h-40 object-cover rounded-md"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = "/iztapamarket-cover.png";
                        }}
                      />
                      {/* Badge Premium sobre la portada */}
                      {String(b.plan_type).toLowerCase() === "premium" && (
                        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/55 backdrop-blur px-2 py-1 shadow-sm ring-1 ring-white/10">
                          {[0, 1, 2, 3, 4].map((i) => (
                            <Star
                              key={i}
                              aria-hidden="true"
                              className="w-4 h-4 text-yellow-400 fill-yellow-400"
                            />
                          ))}
                          <span className="ml-1 text-[11px] text-white/90 font-semibold">
                            Premium
                          </span>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Título */}
                    <CardTitle className="text-center">{b.nombre}</CardTitle>

                    {/* Descripción */}
                    <CardDescription className="mt-2 text-sm text-gray-600 line-clamp-4 text-justify">
                      {b.descripcion}
                    </CardDescription>

                    {/* Acciones */}
                    <div className="mt-4 flex items-center justify-center gap-2">
                      {normalizeWhatsapp(b.whatsapp) &&
                        ["premium", "profesional", "professional"].includes(
                          String(b.plan_type || "")
                            .toLowerCase()
                            .trim()
                        ) && (
                          <Button
                            asChild
                            size="sm"
                            className="h-9 px-4 text-sm rounded-md bg-[#25D366] hover:bg-[#1ebe5d] text-white font-semibold shadow min-w-[92px]"
                            title="Contactar por WhatsApp"
                          >
                            <a
                              href={normalizeWhatsapp(b.whatsapp)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              WhatsApp
                            </a>
                          </Button>
                        )}
                      <Button
                        asChild
                        size="sm"
                        className={`h-9 px-4 text-sm rounded-md ${getCtaClass(
                          b.plan_type
                        )} text-white font-semibold shadow min-w-[92px]`}
                        title="Ver más detalles"
                      >
                        <Link to={`/negocio/${b.slug}`}>Ver más</Link>
                      </Button>
                    </div>
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
