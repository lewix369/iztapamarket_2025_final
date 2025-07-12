import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useSupabase } from "@/contexts/SupabaseContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

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
  }, []);

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
                  src={
                    business.imagen_url || "https://via.placeholder.com/400x200"
                  }
                  alt={business.nombre}
                  className="w-full h-40 object-cover"
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
