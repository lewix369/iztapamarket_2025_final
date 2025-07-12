import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const BusinessDetailPage = () => {
  const { slug } = useParams();
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState(null);
  const [promociones, setPromociones] = useState([]);

  useEffect(() => {
    const fetchBusiness = async () => {
      console.log("📥 Cargando negocio con slug:", slug);
      const { data, error } = await supabase
        .from("negocios")
        .select("*")
        .eq("slug", slug)
        .eq("is_deleted", false)
        .maybeSingle();

      if (error) {
        console.error("❌ Error al obtener el negocio:", error.message);
      } else {
        setBusiness(data);
        const plan = data?.plan_type?.toLowerCase();
        setPlan(plan);
        console.log("📦 Datos recibidos del negocio:", data);
      }

      setLoading(false);
    };

    if (slug) fetchBusiness();
    console.log("🔍 Slug recibido:", slug);
  }, [slug]);

  // Cargar promociones activas del negocio
  useEffect(() => {
    const cargarPromociones = async () => {
      if (!business?.id) return;

      const { data, error } = await supabase
        .from("promociones")
        .select("*")
        .eq("negocio_id", business.id)
        .gte("fecha_fin", new Date().toISOString());

      if (error) {
        console.error("❌ Error al cargar promociones:", error);
      } else {
        setPromociones(data);
      }
    };

    cargarPromociones();
  }, [business?.id]);

  if (loading) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold">Cargando negocio...</h2>
      </div>
    );
  }

  if (!business || Object.keys(business).length === 0) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold">Negocio no encontrado</h2>
      </div>
    );
  }

  // Formatea el enlace de WhatsApp según reglas mejoradas
  const formatWhatsAppLink = (whatsapp) => {
    if (!whatsapp) return null;

    const raw = whatsapp.trim();
    const isFullURL = raw.startsWith("http");

    if (isFullURL) {
      // Extrae el número del enlace completo si es necesario
      const match = raw.match(/wa\.me\/(\d+)/);
      return match ? `https://wa.me/${match[1]}` : raw;
    }

    // Limpia el número de símbolos y espacios
    const cleaned = raw.replace(/[^0-9]/g, "");
    return `https://wa.me/${cleaned}`;
  };
  // Validación visual para el número de WhatsApp

  // No hay botones para obtener coordenadas en este archivo.
  // Si quieres cambiar los textos de botones de ubicación, por favor proporciona el archivo del formulario de registro o edición del negocio.

  console.log("🧠 Renderizando vista con datos:", business);
  return (
    <>
      <Helmet>
        <title>{business.nombre} | IztapaMarket</title>
        <meta
          name="description"
          content={business.descripcion?.slice(0, 150)}
        />
        <meta property="og:title" content={business.nombre} />
        <meta
          property="og:description"
          content={business.descripcion?.slice(0, 150)}
        />
        <meta
          property="og:image"
          content={business.logo_url || business.imagen_url}
        />
        <meta property="og:type" content="business.business" />
        <meta
          property="og:url"
          content={`https://iztapamarket.com/negocio/${business.slug}`}
        />
        <meta name="robots" content="index, follow" />
        <meta name="author" content="IztapaMarket" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={business.nombre} />
        <meta
          name="twitter:description"
          content={business.descripcion?.slice(0, 150)}
        />
        <meta
          name="twitter:image"
          content={business.logo_url || business.imagen_url}
        />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            name: business?.nombre || "",
            description: business?.descripcion || "",
            image: business?.logo_url || business?.imagen_url || "",
            telephone: business?.telefono || "",
            address: {
              "@type": "PostalAddress",
              streetAddress: business?.direccion || "",
              addressLocality: "Iztapalapa",
              addressRegion: "CDMX",
              postalCode: "09000",
              addressCountry: "MX",
            },
            url: `https://iztapamarket.com/negocio/${business?.slug}`,
            sameAs: [
              business?.facebook,
              business?.instagram,
              business?.web,
            ].filter(Boolean),
          })}
        </script>
      </Helmet>
      <div className="container mx-auto px-4 py-10">
        <div className="mb-6">
          {business.logo_url && (
            <img
              src={business.logo_url}
              alt={`Logo de ${business.nombre}`}
              className="h-16 mb-4"
            />
          )}
          <h1 className="text-4xl font-bold mb-2">{business.nombre}</h1>
          <Badge variant="outline">{business.categoria}</Badge>
          {plan === "pro" && (
            <Badge className="bg-blue-100 text-blue-800 border border-blue-300 ml-2">
              Pro
            </Badge>
          )}
          {plan === "free" && (
            <Badge className="bg-gray-100 text-gray-800 border border-gray-300 ml-2">
              Free
            </Badge>
          )}
          {plan === "premium" && (
            <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-300 ml-2">
              Premium
            </Badge>
          )}
        </div>
        {plan === "premium" && (
          <>
            {business.imagen_url && (
              <img
                src={business.imagen_url}
                alt={business.nombre}
                className="w-full max-h-96 object-cover rounded-lg mb-6"
              />
            )}
            {Array.isArray(business.gallery_images) &&
              business.gallery_images.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                  {business.gallery_images.slice(0, 10).map((imgUrl, index) => (
                    <img
                      key={index}
                      src={imgUrl}
                      alt={`Foto ${index + 1} de ${business.nombre}`}
                      className="w-full h-40 object-cover rounded-lg"
                    />
                  ))}
                </div>
              )}

            <p className="text-gray-700 mb-4">{business.descripcion}</p>
            <p className="text-sm text-gray-500 mb-2">
              Dirección: {business.direccion}
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Teléfono: {business.telefono}
            </p>

            <div className="flex flex-col gap-3 mt-4">
              <Button asChild>
                <a href={`tel:${business.telefono}`}>Llamar al negocio</a>
              </Button>
              {business.whatsapp && (
                <Button
                  asChild
                  className="bg-[#25D366] text-white hover:bg-[#1ebe5d]"
                >
                  <a
                    href={formatWhatsAppLink(business.whatsapp)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Contactar por WhatsApp
                  </a>
                </Button>
              )}
            </div>
            {business.whatsapp &&
              !/^\+?\d{7,15}$/.test(
                business.whatsapp.replace(/[^0-9]/g, "")
              ) && (
                <p className="text-sm text-red-500 mt-2">
                  ⚠️ El número de WhatsApp no parece válido. Verifica que
                  contenga solo números con lada internacional.
                </p>
              )}

            {business.mapa_embed_url && (
              <div className="mt-6">
                <iframe
                  src={business.mapa_embed_url}
                  title="Ubicación del negocio"
                  className="w-full h-64 rounded-lg border"
                  allowFullScreen
                  loading="lazy"
                ></iframe>
              </div>
            )}

            {business.video_embed_url && (
              <div className="my-6">
                <h3 className="text-xl font-semibold mb-2">Video</h3>
                <div className="aspect-w-16 aspect-h-9">
                  <iframe
                    src={business.video_embed_url}
                    title="Video del negocio"
                    frameBorder="0"
                    allowFullScreen
                    className="w-full h-64"
                  ></iframe>
                </div>
              </div>
            )}

            {(business.instagram || business.facebook || business.web) && (
              <div className="my-6 space-y-2">
                <h3 className="text-xl font-semibold mb-2">Síguenos</h3>
                <div className="flex flex-wrap gap-2">
                  {business.instagram && (
                    <a
                      href={business.instagram}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block bg-pink-600 text-white px-4 py-2 rounded hover:bg-pink-700"
                    >
                      Instagram
                    </a>
                  )}
                  {business.facebook && (
                    <a
                      href={business.facebook}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-800"
                    >
                      Facebook
                    </a>
                  )}
                  {business.web && (
                    <a
                      href={business.web}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                    >
                      Visitar sitio web
                    </a>
                  )}
                </div>
              </div>
            )}

            <div className="bg-green-50 border-l-4 border-green-500 text-green-800 p-4 rounded mt-6">
              Este negocio cuenta con un plan <strong>Premium</strong>. Disfruta
              de todos los beneficios: video, contacto directo, redes sociales y
              más.
            </div>

            {Array.isArray(business.services) &&
              business.services.length > 0 && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 p-4 rounded mt-6">
                  <h3 className="text-lg font-semibold mb-2">
                    Servicios que ofrecemos:
                  </h3>
                  <ul className="list-disc list-inside text-sm text-gray-700">
                    {business.services.map((service, idx) => (
                      <li key={idx}>{service}</li>
                    ))}
                  </ul>
                </div>
              )}

            {business.estadisticas && (
              <div className="bg-gray-50 border-l-4 border-gray-400 text-gray-800 p-4 rounded mt-6">
                <h3 className="text-lg font-semibold mb-2">Estadísticas</h3>
                <p className="text-sm">{business.estadisticas}</p>
              </div>
            )}
          </>
        )}
        {plan === "free" && (
          <>
            {business.imagen_url && (
              <img
                src={business.imagen_url}
                alt={business.nombre}
                className="w-full max-h-96 object-cover rounded-lg mb-6"
              />
            )}

            {/* Advertencia si no hay descripción */}
            {!business.descripcion && (
              <p className="text-sm text-red-500">
                ⚠️ Este negocio aún no tiene descripción cargada.
              </p>
            )}
            <p className="text-gray-700 mb-4">{business.descripcion}</p>
            {/* Mostrar horarios aunque el plan sea free */}
            {business.hours ? (
              <p className="text-sm text-gray-500 mb-2">
                🕒 Horarios: {business.hours}
              </p>
            ) : (
              <p className="text-sm text-red-500 mb-2">
                ⚠️ Este negocio aún no tiene horarios cargados.
              </p>
            )}
            <p className="text-sm text-gray-500 mb-2">
              Dirección: {business.direccion}
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Teléfono: {business.telefono}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <Button asChild>
                <a href={`tel:${business.telefono}`}>Llamar al negocio</a>
              </Button>
            </div>
            {business.whatsapp &&
              !/^\+?\d{7,15}$/.test(
                business.whatsapp.replace(/[^0-9]/g, "")
              ) && (
                <p className="text-sm text-red-500 mt-2">
                  ⚠️ El número de WhatsApp no parece válido. Verifica que
                  contenga solo números con lada internacional.
                </p>
              )}

            {business.mapa_embed_url && (
              <div className="mt-6">
                <iframe
                  src={business.mapa_embed_url}
                  title="Ubicación del negocio"
                  className="w-full h-64 rounded-lg border"
                  allowFullScreen
                  loading="lazy"
                ></iframe>
              </div>
            )}

            <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-800 p-4 rounded mt-6">
              ¿Eres el dueño?{" "}
              <a href="/planes" className="underline font-medium">
                Mejora tu plan
              </a>{" "}
              y destaca tu marca con contacto por WhatsApp, video y más
              beneficios.
            </div>
          </>
        )}
        {plan === "pro" && (
          <>
            {business.imagen_url && (
              <img
                src={business.imagen_url}
                alt={business.nombre}
                className="w-full max-h-96 object-cover rounded-lg mb-6"
              />
            )}

            <p className="text-gray-700 mb-4">{business.descripcion}</p>
            <p className="text-sm text-gray-500 mb-2">
              Dirección: {business.direccion}
            </p>
            {business.hours && (
              <p className="text-sm text-gray-500 mb-2">
                🕒 Horarios: {business.hours}
              </p>
            )}
            <p className="text-sm text-gray-500 mb-4">
              Teléfono: {business.telefono}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <Button asChild>
                <a href={`tel:${business.telefono}`}>Llamar al negocio</a>
              </Button>
              {business.whatsapp && (
                <Button
                  asChild
                  className="bg-[#25D366] text-white hover:bg-[#1ebe5d]"
                >
                  <a
                    href={formatWhatsAppLink(business.whatsapp)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Contactar por WhatsApp
                  </a>
                </Button>
              )}
            </div>
            {business.whatsapp &&
              !/^\+?\d{7,15}$/.test(
                business.whatsapp.replace(/[^0-9]/g, "")
              ) && (
                <p className="text-sm text-red-500 mt-2">
                  ⚠️ El número de WhatsApp no parece válido. Verifica que
                  contenga solo números con lada internacional.
                </p>
              )}

            {business.mapa_embed_url && (
              <div className="mt-6">
                <iframe
                  src={business.mapa_embed_url}
                  title="Ubicación del negocio"
                  className="w-full h-64 rounded-lg border"
                  allowFullScreen
                  loading="lazy"
                ></iframe>
              </div>
            )}

            {Array.isArray(business.gallery_images) &&
              business.gallery_images.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                  {business.gallery_images.slice(0, 5).map((imgUrl, index) => (
                    <img
                      key={index}
                      src={imgUrl}
                      alt={`Foto ${index + 1} de ${business.nombre}`}
                      className="w-full h-40 object-cover rounded-lg"
                    />
                  ))}
                </div>
              )}

            <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 p-4 rounded mt-6">
              ¿Quieres destacar más?{" "}
              <a href="/planes" className="underline font-medium">
                Mejora a Premium
              </a>{" "}
              para agregar video, redes sociales y más beneficios.
            </div>
            {Array.isArray(business.services) &&
              business.services.length > 0 && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 p-4 rounded mt-6">
                  <h3 className="text-lg font-semibold mb-2">
                    Servicios que ofrecemos:
                  </h3>
                  <ul className="list-disc list-inside text-sm text-gray-700">
                    {business.services.map((service, idx) => (
                      <li key={idx}>{service}</li>
                    ))}
                  </ul>
                </div>
              )}
            {business.estadisticas && (
              <div className="bg-gray-50 border-l-4 border-gray-400 text-gray-800 p-4 rounded mt-6">
                <h3 className="text-lg font-semibold mb-2">Estadísticas</h3>
                <p className="text-sm">{business.estadisticas}</p>
              </div>
            )}
          </>
        )}
        {/* Promociones: bloque visible si hay promociones activas */}
        {promociones.length > 0 && (
          <section className="mt-4">
            <h2 className="text-xl font-bold text-orange-600">Promociones</h2>
            {promociones.map((promo) => (
              <div
                key={promo.id}
                className="border p-4 mt-2 rounded-lg shadow-sm"
              >
                <h3 className="font-semibold">{promo.titulo}</h3>
                <p>{promo.descripcion}</p>
                {promo.imagen_url && (
                  <img
                    src={promo.imagen_url}
                    alt={promo.titulo}
                    className="w-full max-w-xs mt-2 rounded-md"
                  />
                )}
                <p className="text-sm text-gray-500">
                  Vigencia: {promo.fecha_inicio} a {promo.fecha_fin}
                </p>
              </div>
            ))}
          </section>
        )}
      </div>
    </>
  );
};

export default BusinessDetailPage;
