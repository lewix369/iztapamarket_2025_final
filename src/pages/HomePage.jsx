import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useSupabase } from "@/contexts/SupabaseContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

// Local fallback (no external requests like via.placeholder.com)
const FALLBACK_IMG =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(`
  <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1200\" height=\"675\">
    <rect width=\"100%\" height=\"100%\" fill=\"#f3f4f6\"/>
    <text x=\"50%\" y=\"50%\" dominant-baseline=\"middle\" text-anchor=\"middle\"
      fill=\"#9ca3af\" font-family=\"Arial\" font-size=\"40\">IztapaMarket</text>
  </svg>`);

function toSupabaseThumb(url, { width = 600, quality = 70 } = {}) {
  if (!url) return "";

  const s = String(url).trim();
  const low = s.toLowerCase();

  // Bloquea placeholders externos (se rompen por DNS / bloqueos y no aportan)
  if (
    low.includes("via.placeholder.com") ||
    low.includes("placehold.co") ||
    low.includes("placeholder.com")
  ) {
    return "";
  }

  const marker = "/storage/v1/object/public/";
  if (!s.includes(marker)) return s;
  const rendered = s.replace(marker, "/storage/v1/render/image/public/");
  const hasQuery = rendered.includes("?");
  const params = `width=${width}&quality=${quality}`;
  return hasQuery ? `${rendered}&${params}` : `${rendered}?${params}`;
}

const HomePage = () => {
  const [featuredBusinesses, setFeaturedBusinesses] = useState([]);
  const { supabase } = useSupabase();

  useEffect(() => {
    const fetchFeaturedBusinesses = async () => {
      const { data, error } = await supabase
        .from("negocios")
        .select("*")
        .or("plan_type.eq.premium,plan_type.eq.pro")
        .eq("is_featured", true);

      if (!error && data) {
        setFeaturedBusinesses(data);
      }
    };

    fetchFeaturedBusinesses();
  }, [supabase]);

  return (
    <>
      <Helmet>
        <title>Directorio de Negocios Locales | IztapaMarket</title>
        <meta
          name="description"
          content="Descubre los mejores negocios de Iztapalapa. Explora categorías como alimentos, moda, salud y más en un solo lugar."
        />
      </Helmet>
      <section className="container mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold mb-6 text-center">
          Negocios Destacados
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {featuredBusinesses.length > 0 ? (
            featuredBusinesses.map((business) => (
              <Card key={business.id}>
                <img
                  src={toSupabaseThumb(business.imagen_url, { width: 600, quality: 70 }) || FALLBACK_IMG}
                  alt={business.nombre}
                  className="w-full h-40 object-cover"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    e.currentTarget.src = FALLBACK_IMG;
                  }}
                />
                <CardHeader>
                  <CardTitle>{business.nombre}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-4">
                    {business.descripcion?.slice(0, 120) ||
                      "Sin descripción disponible."}
                  </p>
                  <Link to={`/negocio/${business.slug}`}>
                    <Button variant="outline">Ver más</Button>
                  </Link>
                </CardContent>
              </Card>
            ))
          ) : (
            <p className="col-span-full text-center text-gray-500">
              No hay negocios destacados disponibles por el momento.
            </p>
          )}
        </div>
      </section>
      {/* Aquí va el contenido principal de HomePage */}
    </>
  );
};

export default HomePage;
