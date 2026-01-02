import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";

// ✅ Fallback interno (sin dependencias externas) — consistente con IztapaMarket
const FALLBACK_IMAGE_DATA_URI =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='800'>
  <defs>
    <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='#003366'/>
      <stop offset='100%' stop-color='#0b2b55'/>
    </linearGradient>
  </defs>
  <rect width='100%' height='100%' fill='url(#g)'/>
  <circle cx='120' cy='120' r='70' fill='#f97316' opacity='0.95'/>
  <text x='220' y='135' font-family='Arial, Helvetica, sans-serif' font-size='64' fill='white' font-weight='700'>IztapaMarket</text>
  <text x='220' y='205' font-family='Arial, Helvetica, sans-serif' font-size='28' fill='rgba(255,255,255,0.85)'>Imagen pendiente</text>
  <text x='60' y='740' font-family='Arial, Helvetica, sans-serif' font-size='22' fill='rgba(255,255,255,0.75)'>Súbela para que se vea en tu ficha</text>
</svg>`);

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

      const categoriaHuman = decodeURIComponent(slug).replace(/-/g, " ").trim();

      const selectCols =
        "id,nombre,slug,descripcion,direccion,portada_url,imagen_url,logo_url,is_approved,is_deleted";

      let { data, error } = await supabase
        .from("negocios")
        .select(selectCols)
        .eq("slug_categoria", slug)
        .eq("is_deleted", false)
        .eq("is_approved", true);

      if (!error && (data?.length ?? 0) === 0) {
        const fallback = await supabase
          .from("negocios")
          .select(selectCols)
          .ilike("categoria", categoriaHuman)
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
                (negocio.portada_url && negocio.portada_url.trim()) ||
                (negocio.imagen_url && negocio.imagen_url.trim()) ||
                (negocio.logo_url && negocio.logo_url.trim()) ||
                FALLBACK_IMAGE_DATA_URI;

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
                        // evita loop infinito si la imagen falla
                        if (e.currentTarget.src !== FALLBACK_IMAGE_DATA_URI) {
                          e.currentTarget.src = FALLBACK_IMAGE_DATA_URI;
                        }
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