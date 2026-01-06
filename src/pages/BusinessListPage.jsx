// src/pages/BusinessListPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Helmet } from "react-helmet";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Star, MapPin, Clock, Grid, List, FilterX } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  searchBusinesses as fetchBusinessesFromDb,
  getDistinctCategories,
} from "@/lib/database";
import { supabase } from "@/lib/supabaseClient";

// ---------- util imágenes ----------
const FALLBACK_IMG =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675">
      <rect width="100%" height="100%" fill="#f3f4f6"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
        fill="#9ca3af" font-family="Arial" font-size="40">IztapaMarket</text>
    </svg>
  `);

const isPlaceholderUrl = (url) =>
  typeof url === "string" &&
  /via\.placeholder\.com|placeholder\.com|300x200|text=Ejemplo/i.test(url);

const pickImage = (b) => {
  const url =
    b?.portada_url ||
    b?.imagen_url ||
    b?.cover_image_url ||
    b?.business_cover_url ||
    b?.logo_url ||
    b?.image_url;

  if (!url) return FALLBACK_IMG;
  if (isPlaceholderUrl(url)) return FALLBACK_IMG;
  return url;
};

// Convierte URL pública de Supabase Storage a thumbnail usando Image Transform
// - Si ya viene como render/image, la deja
// - Si es externa (http(s) fuera de Supabase), la deja
const toSupabaseThumb = (url, { width = 800, quality = 70 } = {}) => {
  if (!url || typeof url !== "string") return url;

  // ya es endpoint de render
  if (url.includes("/storage/v1/render/image/")) return url;

  // intenta convertir object/public -> render/image/public
  const marker = "/storage/v1/object/public/";
  if (url.includes(marker)) {
    const [base, query = ""] = url.split("?");
    const renderUrl = base.replace(
      "/storage/v1/object/public/",
      "/storage/v1/render/image/public/"
    );

    const params = new URLSearchParams(query);
    // parámetros típicos de supabase image transform
    params.set("width", String(width));
    params.set("quality", String(quality));
    params.set("resize", params.get("resize") || "cover");

    const qs = params.toString();
    return qs ? `${renderUrl}?${qs}` : renderUrl;
  }

  return url;
};

// ---------- helpers ubicación ----------
const toFloat = (v) =>
  v === null || v === undefined || v === "" ? null : parseFloat(v);

const getLatLng = (b) => {
  const lat = toFloat(b?.lat ?? b?.latitud);
  const lng = toFloat(b?.lng ?? b?.longitud);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
};

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ---------- querystring ----------
function useQueryString() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

const BusinessListPage = () => {
  const navigate = useNavigate();
  const locationQuery = useQueryString();
  const reactRouterLocation = useLocation();

  const [businesses, setBusinesses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState([]);

  const [searchTerm, setSearchTerm] = useState(locationQuery.get("q") || "");
  const [selectedPlan, setSelectedPlan] = useState(
    locationQuery.get("plan") || "all"
  );
  const [selectedCategory, setSelectedCategory] = useState(
    locationQuery.get("category") || "all"
  );

  const [viewMode, setViewMode] = useState("grid");
  const [userLoc, setUserLoc] = useState(null); // {lat, lng}
  const [sortMode, setSortMode] = useState(
    locationQuery.get("sort") || "default"
  ); // "default" | "nearby"
  const [isLocating, setIsLocating] = useState(false); // NUEVO

  const planOptions = useMemo(
    () => [
      { value: "all", label: "Todos los planes" },
      { value: "premium", label: "Premium" },
      { value: "pro", label: "Profesional" },
      { value: "free", label: "Gratis" },
    ],
    []
  );

  // Convierte a string seguro antes de normalizar (evita fallos cuando viene null/undefined)
  const labelize = (s) =>
    String(s ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/-/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase());

  // ---------- carga principal (respeta filtros actuales) ----------
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);

    const termToFetch =
      searchTerm.trim() === "" ? undefined : searchTerm.trim();
    const planValueToFetch =
      selectedPlan === "all" ? undefined : selectedPlan.toLowerCase();
    const categoryValueToFetch =
      selectedCategory === "all" ? undefined : selectedCategory;

    const [businessData, categoriesData] = await Promise.all([
      fetchBusinessesFromDb(
        supabase,
        termToFetch,
        planValueToFetch,
        categoryValueToFetch
      ),
      getDistinctCategories(supabase),
    ]);

    // 🔒 BLINDAJE EN CLIENTE: sólo mostrar aprobados y no eliminados
    const sanitized = (businessData || []).filter(
      (b) => b?.is_approved === true && b?.is_deleted !== true
    );

    setBusinesses(sanitized);

    const rawCats = (Array.isArray(categoriesData) ? categoriesData : []).map(
      (c) => {
        if (typeof c === "string") return c;
        if (c && typeof c === "object") {
          return c.categoria ?? c.slug_categoria ?? "";
        }
        return "";
      }
    );

    const uniqueCategories = [
      "all",
      ...Array.from(
        new Set(rawCats.map((c) => c.trim().toLowerCase()).filter(Boolean))
      ),
    ];
    setCategories(uniqueCategories);

    setIsLoading(false);
  }, [searchTerm, selectedPlan, selectedCategory]);

  // Carga inicial
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // ---------- URL <-> estado ----------
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchTerm.trim()) params.set("q", searchTerm.trim());
    if (selectedPlan && selectedPlan !== "all")
      params.set("plan", selectedPlan);
    if (selectedCategory && selectedCategory !== "all")
      params.set("category", selectedCategory);
    if (sortMode === "nearby") params.set("sort", "nearby");

    const queryString = params.toString();
    const current = `${reactRouterLocation.pathname}${reactRouterLocation.search}`;
    const target = queryString ? `/negocios?${queryString}` : `/negocios`;

    if (current !== target) navigate(target, { replace: true });
  }, [
    searchTerm,
    selectedPlan,
    selectedCategory,
    sortMode,
    navigate,
    reactRouterLocation,
  ]);

  // ---------- 🔴 Realtime: refresca cuando admin cambia negocios ----------
  useEffect(() => {
    let t = null;
    const channel = supabase
      .channel("negocios-public-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "negocios" },
        () => {
          clearTimeout(t);
          t = setTimeout(() => {
            loadInitialData();
          }, 250);
        }
      )
      .subscribe();

    return () => {
      clearTimeout(t);
      supabase.removeChannel(channel);
    };
  }, [loadInitialData]);

  // ---------- acciones UI ----------
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadInitialData();
  };

  const handlePlanChange = (value) => setSelectedPlan(value || "all");
  const handleCategoryChange = (value) => setSelectedCategory(value || "all");

  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedPlan("all");
    setSelectedCategory("all");
    setSortMode("default");
    setUserLoc(null);
  };

  // Toggle cercanía con estado de “Ubicando…”
  const toggleNearby = () => {
    if (sortMode === "nearby") {
      setSortMode("default");
      setUserLoc(null);
      return;
    }
    if (!("geolocation" in navigator)) {
      alert("Tu navegador no permite geolocalización.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUserLoc({ lat: coords.latitude, lng: coords.longitude });
        setSortMode("nearby");
        setIsLocating(false);
      },
      (err) => {
        console.error("Geoloc error:", err);
        alert("No se pudo obtener tu ubicación.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // ---------- datos listos para pintar (con distancia/orden por cercanía) ----------
  const businessesForView = useMemo(() => {
    const normalizePlan = (p) => String(p ?? "").trim().toLowerCase();

    // Ranking: Premium (0) -> Pro (1) -> Free/Gratis (2) -> Otros/Desconocidos (3)
    const planRank = (b) => {
      const p = normalizePlan(b?.plan_type);
      if (p === "premium") return 0;
      if (["pro", "profesional", "professional"].includes(p)) return 1;
      if (["free", "gratis"].includes(p)) return 2;
      return 3;
    };

    const nameKey = (b) => String(b?.nombre ?? "").trim().toLowerCase();

    const withDistance = businesses.map((b) => {
      if (userLoc) {
        const ll = getLatLng(b);
        const d = ll
          ? haversineKm(userLoc.lat, userLoc.lng, ll.lat, ll.lng)
          : null;
        return { ...b, __distance_km: d };
      }
      return { ...b, __distance_km: null };
    });

    // 1) Si está activo "Cerca de mí": distancia primero, luego plan, luego nombre
    if (sortMode === "nearby" && userLoc) {
      withDistance.sort((a, b) => {
        const da = a.__distance_km ?? Number.POSITIVE_INFINITY;
        const db = b.__distance_km ?? Number.POSITIVE_INFINITY;
        if (da !== db) return da - db;

        const ra = planRank(a);
        const rb = planRank(b);
        if (ra !== rb) return ra - rb;

        return nameKey(a).localeCompare(nameKey(b), "es");
      });
      return withDistance;
    }

    // 2) Default: Premium/Pro arriba, luego Gratis, luego nombre (estable)
    withDistance.sort((a, b) => {
      const ra = planRank(a);
      const rb = planRank(b);
      if (ra !== rb) return ra - rb;
      return nameKey(a).localeCompare(nameKey(b), "es");
    });

    return withDistance;
  }, [businesses, userLoc, sortMode]);

  // ---------- render ----------
  return (
    <div className="min-h-screen">
      <Helmet>
        <title>Directorio de Negocios | IztapaMarket</title>
        <meta
          name="description"
          content="Explora todos los negocios registrados en Iztapalapa. Filtra por categoría, plan o nombre en IztapaMarket."
        />
      </Helmet>

      <section className="bg-gradient-to-r from-blue-600 to-orange-600 text-white py-16">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-6"
          >
            <h1 className="text-4xl md:text-5xl font-bold">
              Directorio de Negocios
            </h1>
            <p className="text-xl text-blue-100 max-w-2xl mx-auto">
              Explora todos los negocios registrados en IztapaMarket
            </p>
          </motion.div>
        </div>
      </section>

      <section className="bg-white border-b z-40 md:sticky md:top-16">
        <div className="container mx-auto px-4 py-4 sm:py-6">
          <div className="space-y-4">
            <form
              onSubmit={handleSearchSubmit}
              className="flex flex-col md:flex-row gap-4 items-center"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Buscar por nombre, descripción o categoría..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-12 text-black"
                />
              </div>
              <Button
                type="submit"
                className="h-12 px-6 bg-blue-600 hover:bg-blue-700 hidden md:inline-flex"
              >
                Buscar
              </Button>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end auto-rows-min">
              <div>
                <label
                  htmlFor="category-filter"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Categoría
                </label>
                <Select
                  value={selectedCategory}
                  onValueChange={handleCategoryChange}
                  id="category-filter"
                >
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category === "all"
                          ? "Todas las categorías"
                          : labelize(category)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label
                  htmlFor="plan-filter"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Plan
                </label>
                <Select
                  value={selectedPlan}
                  onValueChange={handlePlanChange}
                  id="plan-filter"
                >
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {planOptions.map((plan) => (
                      <SelectItem key={plan.value} value={plan.value}>
                        {plan.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-1 md:col-span-2 lg:col-span-1 flex items-end">
                <Button
                  onClick={handleClearFilters}
                  variant="outline"
                  className="h-10 w-full"
                >
                  <FilterX className="h-4 w-4 mr-2" />
                  Limpiar Filtros
                </Button>
              </div>

              <div className="col-span-1 md:col-span-2 lg:col-span-1 flex flex-wrap items-center gap-2 justify-between md:justify-end w-full">
                <Button
                  type="button"
                  onClick={toggleNearby}
                  aria-pressed={sortMode === "nearby"}
                  disabled={isLocating}
                  className={`h-10 px-3 whitespace-nowrap min-w-[140px] ${
                    sortMode === "nearby"
                      ? "bg-orange-600 hover:bg-orange-700 text-white"
                      : "bg-orange-500 hover:bg-orange-600 text-white"
                  }`}
                  title="Ordenar por negocios cercanos"
                >
                  <span className="inline-flex items-center gap-2">
                    {isLocating ? "Ubicando…" : "Cerca de mí"}
                    {sortMode === "nearby" && userLoc && !isLocating && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs"
                        aria-live="polite"
                      >
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        ON
                      </span>
                    )}
                  </span>
                </Button>
                <div className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap min-w-[140px]">
                  <span>{businessesForView.length} resultados</span>
                  {sortMode === "nearby" && userLoc && !isLocating && (
                    <span className="inline-flex items-center gap-1 text-green-700">
                      • <span>Ordenado por cercanía</span>
                    </span>
                  )}
                </div>
                <div className="flex border rounded-lg shrink-0">
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className="rounded-r-none"
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className="rounded-l-none"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="container mx-auto px-4">
          {isLoading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <div className="text-6xl mb-4 animate-spin">⚙️</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Cargando negocios...
              </h3>
            </motion.div>
          ) : businessesForView.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                No se encontraron resultados
              </h3>
              <p className="text-gray-600 mb-6">
                Intenta ajustar tus filtros o términos de búsqueda
              </p>
              <Button onClick={handleClearFilters} variant="outline">
                Limpiar filtros
              </Button>
            </motion.div>
          ) : (
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
                  : "space-y-6"
              }
            >
              {businessesForView.map((business, index) => (
                <motion.div
                  key={business.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  {viewMode === "grid" ? (
                    <Card className="group hover:shadow-2xl transition-all duration-300 border-0 shadow-lg overflow-hidden">
                      <div className="relative">
                        <img
                          alt={`${business.nombre} - ${business.descripcion}`}
                          className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                          src={
                            toSupabaseThumb(pickImage(business), {
                              width: 900,
                              quality: 70,
                            })
                          }
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = FALLBACK_IMG;
                          }}
                        />
                        <div className="absolute top-4 left-4">
                          <Badge
                            variant={
                              String(business.plan_type).toLowerCase() ===
                              "premium"
                                ? "orange"
                                : [
                                    "pro",
                                    "profesional",
                                    "professional",
                                  ].includes(
                                    String(business.plan_type).toLowerCase()
                                  )
                                ? "blue"
                                : "secondary"
                            }
                            className="shadow-lg"
                          >
                            {business.plan_type}
                          </Badge>
                        </div>
                        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 flex items-center space-x-1">
                          <Star className="h-4 w-4 text-yellow-500 fill-current" />
                          <span className="text-sm font-semibold">
                            {business.rating || 0}
                          </span>
                        </div>
                      </div>
                      <CardHeader>
                        <CardTitle className="text-xl group-hover:text-blue-600 transition-colors">
                          {business.nombre}
                        </CardTitle>
                        <CardDescription className="text-orange-600 font-medium">
                          {labelize(business.categoria)}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-gray-600 mb-4 text-sm truncate">
                          {business.descripcion || "Sin descripción disponible"}
                        </p>
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                          <span>📞</span>
                          <span>
                            {business.telefono || "Teléfono no disponible"}
                          </span>
                        </div>
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center space-x-2 text-sm text-gray-500">
                            <MapPin className="h-4 w-4" />
                            <span>{business.direccion || "N/A"}</span>
                          </div>
                          {business.__distance_km != null && (
                            <div className="inline-flex items-center text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                              {business.__distance_km.toFixed(1)} km
                            </div>
                          )}
                          <div className="flex items-center space-x-2 text-sm text-gray-500">
                            <Clock className="h-4 w-4" />
                            <span>{business.hours || "N/A"}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-500">
                            {business.reviews_count || 0} reseñas
                          </div>
                          <Link to={`/negocio/${business.slug}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="group-hover:bg-blue-600 group-hover:text-white transition-colors"
                            >
                              Ver Detalles
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="group hover:shadow-lg transition-all duration-300">
                      <div className="flex flex-col md:flex-row">
                        <div className="relative md:w-64 h-48 md:h-auto">
                          <img
                            alt={`${business.nombre} - ${business.descripcion}`}
                            className="w-full h-full object-cover"
                            src={
                              toSupabaseThumb(pickImage(business), {
                                width: 900,
                                quality: 70,
                              })
                            }
                            loading="lazy"
                            decoding="async"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = FALLBACK_IMG;
                            }}
                          />
                          <div className="absolute top-4 left-4">
                            <Badge
                              variant={
                                String(business.plan_type).toLowerCase() ===
                                "premium"
                                  ? "orange"
                                  : [
                                      "pro",
                                      "profesional",
                                      "professional",
                                    ].includes(
                                      String(business.plan_type).toLowerCase()
                                    )
                                  ? "blue"
                                  : "secondary"
                              }
                            >
                              {business.plan_type}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex-1 p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="text-2xl font-bold group-hover:text-blue-600 transition-colors">
                                {business.nombre}
                              </h3>
                              <p className="text-orange-600 font-medium">
                                {labelize(business.categoria)}
                              </p>
                            </div>
                            <div className="flex items-center space-x-1 bg-yellow-50 px-3 py-1 rounded-full">
                              <Star className="h-4 w-4 text-yellow-500 fill-current" />
                              <span className="font-semibold">
                                {business.rating || 0}
                              </span>
                              <span className="text-sm text-gray-500">
                                ({business.reviews_count || 0})
                              </span>
                            </div>
                          </div>
                          <p className="text-gray-600 mb-4 text-sm">
                            {business.descripcion ||
                              "Sin descripción disponible"}
                          </p>
                          <div className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
                            <span>📞</span>
                            <span>
                              {business.telefono || "Teléfono no disponible"}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="flex items-center space-x-2 text-sm text-gray-500">
                              <MapPin className="h-4 w-4" />
                              <span>{business.direccion || "N/A"}</span>
                            </div>
                            {business.__distance_km != null && (
                              <div className="inline-flex items-center text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                                {business.__distance_km.toFixed(1)} km
                              </div>
                            )}
                            <div className="flex items-center space-x-2 text-sm text-gray-500">
                              <Clock className="h-4 w-4" />
                              <span>{business.hours || "N/A"}</span>
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <Link to={`/negocio/${business.slug}`}>
                              <Button className="bg-blue-600 hover:bg-blue-700">
                                Ver Detalles
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </Card>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default BusinessListPage;
