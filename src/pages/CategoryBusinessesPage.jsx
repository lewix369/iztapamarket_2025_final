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

const SITE_URL = "https://iztapamarket.com";

function humanizeSlug(slug = "") {
  return String(slug)
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function planRank(plan) {
  const p = String(plan || "").toLowerCase();
  if (p === "premium") return 0;
  if (p === "pro") return 1;
  return 2; // free/empty/unknown
}

function planLabel(plan) {
  const p = String(plan || "").toLowerCase();
  if (p === "premium") return "Premium";
  if (p === "pro") return "Pro";
  return "";
}

export default function CategoryBusinessesPage() {
  const { slug } = useParams();
  if (!slug) {
    return <div className="p-6 text-red-500">Slug de categoría no válido.</div>;
  }

  const prettyCategory = humanizeSlug(slug);
  const seoTitle = `${prettyCategory} en Iztapalapa | IztapaMarket`;
  const seoDescription = `Encuentra ${prettyCategory} en Iztapalapa: negocios locales por categoría, teléfonos, dirección y contacto por WhatsApp. Descubre opciones cerca de ti en IztapaMarket.`;
  const canonicalUrl = `${SITE_URL}/categorias/${slug}`;

  const [negocios, setNegocios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchNegocios = async () => {
      setLoading(true);

      const categoriaHuman = decodeURIComponent(slug).replace(/-/g, " ").trim();

      const selectCols =
        "id,nombre,slug,descripcion,direccion,portada_url,imagen_url,logo_url,plan_type,is_approved,is_deleted,slug_categoria,categoria,telefono,hours";

      // 1) Por slug_categoria (normalizado)
      const bySlug = await supabase
        .from("negocios")
        .select(selectCols)
        .eq("slug_categoria", slug)
        .eq("is_deleted", false)
        .eq("is_approved", true);

      // 2) Fallback por categoria (texto), para casos donde slug_categoria está vacío/null
      const byCategoria = await supabase
        .from("negocios")
        .select(selectCols)
        .ilike("categoria", `%${categoriaHuman}%`)
        .eq("is_deleted", false)
        .eq("is_approved", true);

      const error = bySlug.error || byCategoria.error;

      // Unir + deduplicar por id
      const merged = [...(bySlug.data || []), ...(byCategoria.data || [])];
      const seen = new Set();
      const data = merged.filter((n) => {
        const id = n?.id;
        if (!id) return false;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });

      if (!cancelled) {
        if (error) {
          console.error("Error al obtener negocios por categoría:", error);
          setNegocios([]);
        } else {
          const sorted = [...(data || [])].sort((a, b) => {
            const ra = planRank(a?.plan_type);
            const rb = planRank(b?.plan_type);
            if (ra !== rb) return ra - rb;
            // fallback estable: nombre
            return String(a?.nombre || "").localeCompare(String(b?.nombre || ""), "es", {
              sensitivity: "base",
            });
          });
          setNegocios(sorted);
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
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <link rel="canonical" href={canonicalUrl} />

        <meta name="robots" content="index, follow" />

        <meta property="og:type" content="website" />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:url" content={canonicalUrl} />

        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDescription} />
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
                  className={`block border rounded-lg overflow-hidden shadow hover:shadow-lg transition ${
                    planRank(negocio?.plan_type) < 2
                      ? "border-[#f97316]/60"
                      : "border-gray-200"
                  }`}
                >
                  <div className="relative w-full h-48 overflow-hidden bg-gray-100">
                    {planRank(negocio?.plan_type) < 2 && (
                      <div className="absolute top-3 left-3 z-10">
                        <span className="inline-flex items-center rounded-full bg-[#f97316] px-3 py-1 text-xs font-semibold text-white shadow">
                          {planLabel(negocio?.plan_type)}
                        </span>
                      </div>
                    )}
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