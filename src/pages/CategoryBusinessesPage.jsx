import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Link } from "react-router-dom";

const CategoryBusinessesPage = () => {
  const { slug } = useParams();
  if (!slug) {
    return <div className="p-6 text-red-500">Slug de categoría no válido.</div>;
  }
  const [negocios, setNegocios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNegocios = async () => {
      const { data, error } = await supabase
        .from("negocios")
        .select("*")
        .eq("slug_categoria", slug)
        .eq("is_deleted", false)
        .eq("is_approved", true);

      if (error) {
        console.error("Error al obtener negocios por categoría:", error);
      } else {
        setNegocios(data);
      }
      setLoading(false);
    };

    fetchNegocios();
  }, [slug]);

  if (loading) return <div className="p-6">Cargando negocios...</div>;

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
          content={`https://iztapamarket.com/categorias/${slug}`}
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
            {negocios.map((negocio) => (
              <Link
                key={negocio.id}
                to={`/negocio/${negocio.slug}`}
                className="block border rounded-lg overflow-hidden shadow hover:shadow-lg transition"
              >
                <img
                  src={negocio.imagen_url}
                  alt={negocio.nombre}
                  className="w-full h-48 object-cover"
                />
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
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default CategoryBusinessesPage;
