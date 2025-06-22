import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const BusinessDetailPage = () => {
  const { slug } = useParams();
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBusiness = async () => {
      const { data, error } = await supabase
        .from("negocios")
        .select("*")
        .eq("slug", slug)
        .eq("is_deleted", false)
        .single();

      if (error) {
        console.error("Error al cargar negocio:", error);
      } else {
        setBusiness(data);
      }

      setLoading(false);
    };

    if (slug) fetchBusiness();
  }, [slug]);

  if (loading) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold">Cargando negocio...</h2>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold">Negocio no encontrado</h2>
      </div>
    );
  }

  return (
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
        {business.plan_type === "pro" && (
          <Badge className="bg-blue-100 text-blue-800 border border-blue-300 ml-2">
            Pro
          </Badge>
        )}
        {business.plan_type === "free" && (
          <Badge className="bg-gray-100 text-gray-800 border border-gray-300 ml-2">
            Free
          </Badge>
        )}
        {business.plan_type === "premium" && (
          <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-300 ml-2">
            Premium
          </Badge>
        )}
      </div>
      {business.plan_type === "premium" && (
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
          {business.hours && (
            <p className="text-sm text-gray-500 mb-2">
              🕒 Horarios: {business.hours}
            </p>
          )}
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
                  href={`https://wa.me/${business.whatsapp}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Contactar por WhatsApp
                </a>
              </Button>
            )}
          </div>

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

          {Array.isArray(business.services) && business.services.length > 0 && (
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

          {business.promociones && (
            <div className="bg-purple-50 border-l-4 border-purple-400 text-purple-800 p-4 rounded mt-6">
              <h3 className="text-lg font-semibold mb-2">
                Promociones del mes
              </h3>
              <p className="text-sm">{business.promociones}</p>
            </div>
          )}
        </>
      )}
      {business.plan_type === "free" && (
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
          </div>

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
      {business.plan_type === "pro" && (
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
                  href={`https://wa.me/${business.whatsapp}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Contactar por WhatsApp
                </a>
              </Button>
            )}
          </div>

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
          {Array.isArray(business.services) && business.services.length > 0 && (
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

          {business.promociones && (
            <div className="bg-purple-50 border-l-4 border-purple-400 text-purple-800 p-4 rounded mt-6">
              <h3 className="text-lg font-semibold mb-2">
                Promociones del mes
              </h3>
              <p className="text-sm">{business.promociones}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BusinessDetailPage;
