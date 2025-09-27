import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";

const PLACEHOLDER =
  "https://images.unsplash.com/photo-1613243555978-636c48dc653c";

export default function CategoryBusinessesPage() {
  const { slug } = useParams();
  if (!slug) {
    return <div className="p-6 text-red-500">Slug de categoría no válido.</div>;
  }

  const [negocios, setNegocios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchNegocios = async () => {
      setLoading(true);

      // Normaliza el slug a la forma almacenada en la BD (p. ej. "alimentos y bebidas")
      const categoriaHuman = decodeURIComponent(slug).replace(/-/g, " ").trim();

      // Columnas a seleccionar en ambas consultas
      const selectCols =
        "id,nombre,slug,descripcion,direccion,portada_url,imagen_url,logo_url,is_approved,is_deleted";

      // 1) Primero: buscar por slug_categoria (ruta canónica)
      let { data, error } = await supabase
        .from("negocios")
        .select(selectCols)
        .eq("slug_categoria", slug)
        .eq("is_deleted", false)
        .eq("is_approved", true);

      // 2) Si no hay resultados y no hubo error, hacemos fallback por nombre de categoría
      if (!error && (data?.length ?? 0) === 0) {
        const fallback = await supabase
          .from("negocios")
          .select(selectCols)
          .ilike("categoria", categoriaHuman) // ej. "alimentos y bebidas"
          .eq("is_deleted", false)
          .eq("is_approved", true);

        data = fallback.data;
        error = fallback.error;
      }

      if (!cancelled) {
        if (error) {
          console.error("Error al obtener negocios por categoría:", error);
          setNegocios([]);
        } else {
          setNegocios(data || []);
        }
        setLoading(false);
      }
    };

    fetchNegocios();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading)
    return <div className="p-6">Cargando negocios de la categoría...</div>;

  return (
    <>
      <Helmet>
        <title>{`Negocios en ${slug.replace(/-/g, " ")} | IztapaMarket`}</title>
        <meta
          name="description"
          content={`Explora negocios locales en la categoría ${slug.replace(
            /-/g,
            " "
          )} dentro de IztapaMarket.`}
        />
        <meta name="robots" content="index, follow" />
        <meta property="og:type" content="website" />
        <meta
          property="og:title"
          content={`Negocios en ${slug.replace(/-/g, " ")} | IztapaMarket`}
        />
        <meta
          property="og:description"
          content={`Explora negocios locales en la categoría ${slug.replace(
            /-/g,
            " "
          )} dentro de IztapaMarket.`}
        />
        <meta
          property="og:url"
          content={`https://iztapamarket.com/negocios/${slug}`}
        />
        <meta name="twitter:card" content="summary" />
        <meta
          name="twitter:title"
          content={`Negocios en ${slug.replace(/-/g, " ")} | IztapaMarket`}
        />
        <meta
          name="twitter:description"
          content={`Explora negocios locales en la categoría ${slug.replace(
            /-/g,
            " "
          )} dentro de IztapaMarket.`}
        />
      </Helmet>

      <div className="max-w-6xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-[#003366] mb-6 capitalize">
          Negocios en categoría: {slug.replace(/-/g, " ")}
        </h1>

        {negocios.length === 0 ? (
          <p className="text-gray-600">
            No se encontraron negocios en esta categoría.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {negocios.map((negocio) => {
              const cover =
                negocio.portada_url ||
                negocio.imagen_url ||
                negocio.logo_url ||
                PLACEHOLDER;

              return (
                <Link
                  key={negocio.id}
                  to={`/negocio/${negocio.slug}`}
                  className="block border rounded-lg overflow-hidden shadow hover:shadow-lg transition"
                >
                  <div className="w-full h-48 overflow-hidden bg-gray-100">
                    <img
                      src={cover}
                      alt={negocio.nombre || "Negocio"}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.src = PLACEHOLDER;
                      }}
                    />
                  </div>
                  <div className="p-4">
                    <h2 className="font-bold text-lg text-[#003366]">
                      {negocio.nombre}
                    </h2>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {negocio.descripcion}
                    </p>
                    <p className="text-sm text-[#f97316] mt-2">
                      {negocio.direccion}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
