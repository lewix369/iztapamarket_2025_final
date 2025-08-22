import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import PromoCard from "@/components/PromoCard";

const BusinessDetailPage = () => {
  const { slug } = useParams();
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState(null);
  if (!plan) {
    console.warn(
      "⚠️ Plan no definido aún. Ocultando contenido condicional temporalmente."
    );
  }
  const [promociones, setPromociones] = useState([]);

  useEffect(() => {
    const fetchBusiness = async () => {
      // Solo mostrar negocios PUBLICOS: aprobados y no eliminados
      console.log("📥 Cargando negocio con slug:", slug);
      const { data, error } = await supabase
        .from("negocios")
        .select("*")
        .eq("slug", slug)
        .eq("is_deleted", false) // ocultar eliminados
        .eq("is_approved", true) // mostrar solo aprobados
        .maybeSingle();

      console.log("🔎 Resultado:", data);

      if (error) {
        console.error("❌ Error al obtener el negocio:", error.message);
      } else if (!data) {
        console.warn("⚠️ Negocio no encontrado para slug:", slug);
        setBusiness(null);
      } else {
        // Normaliza plan a minúsculas SIN renombrar ("profesional" se queda como "profesional") y garantiza que gallery_images sea un arreglo
        const normalizedPlan = (data?.plan_type || "").toLowerCase().trim();

        const galleryField = data?.gallery_images;
        const normalizedGallery = Array.isArray(galleryField)
          ? galleryField
          : typeof galleryField === "string"
          ? galleryField
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [];

        setBusiness({
          ...data,
          gallery_images: normalizedGallery,
          plan_type: normalizedPlan,
          video_embed_url: data.video_embed_url || data.video || "",
        });
        setPlan(normalizedPlan);
        console.log("📦 Datos recibidos del negocio:", data);
      }

      setLoading(false);
    };
    if (slug) fetchBusiness();
  }, [slug]);

  // Promociones activas (solo cuando el negocio aprobado está cargado)
  useEffect(() => {
    const fetchPromociones = async () => {
      if (!business?.id) return;

      const { data: promocionesData, error: promocionesError } = await supabase
        .from("promociones")
        .select("*")
        .eq("negocio_id", business.id);

      if (promocionesError) {
        console.error("❌ Error cargando promociones:", promocionesError);
        return;
      }

      setPromociones(promocionesData || []);
    };

    fetchPromociones();
  }, [business?.id]);

  const promocionesArray = Array.isArray(promociones)
    ? promociones
    : promociones
    ? [promociones]
    : [];

  const formatDate = (date) =>
    new Date(date).toLocaleDateString("es-MX", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

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

  // WhatsApp
  const formatWhatsAppLink = (whatsapp) => {
    if (!whatsapp) return null;
    const raw = whatsapp.trim();
    const isFullURL = raw.startsWith("http");
    if (isFullURL) {
      const match = raw.match(/wa\.me\/(\d+)/);
      return match ? `https://wa.me/${match[1]}` : raw;
    }
    const cleaned = raw.replace(/[^0-9]/g, "");
    return `https://wa.me/${cleaned}`;
  };

  // Helpers visuales
  const prettyCategory = (cat) => {
    if (!cat || typeof cat !== "string") return cat || "";
    return cat
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");
  };

  // Extraer ID de YouTube para el embed del video
  const extractYouTubeId = (url) => {
    const match = (url || "").match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    return match ? match[1] : "";
  };

  // ---------- Lógica para mostrar Menú (ya implementada) ----------
  const rawCat = (business?.slug_categoria || business?.categoria || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // sin acentos

  const isFoodCategory =
    rawCat.includes("alimentos") ||
    rawCat.includes("bebidas") ||
    rawCat.includes("restauran") ||
    rawCat.includes("taquer") ||
    rawCat.includes("antojito") ||
    rawCat.includes("pizzer") ||
    rawCat.includes("cafeter") ||
    rawCat.includes("bar") ||
    rawCat.includes("pasteler") ||
    rawCat.includes("jugos");

  const menuStr = (business?.menu || "").trim();
  const hasMenu = menuStr.length > 0;
  const looksLikeURL = /^https?:\/\//i.test(menuStr);

  const renderMenuBlock = () => {
    if (!hasMenu) return null;

    // Caso PDF/Google Drive
    if (looksLikeURL) {
      const isPDF = /\.pdf(\?|$)/i.test(menuStr);
      const isDrive = /drive\.google\.com/i.test(menuStr);
      const toDrivePreview = (url) => {
        const m1 = url.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
        if (m1) return `https://drive.google.com/file/d/${m1[1]}/preview`;
        const m2 = url.match(/drive\.google\.com\/open\?id=([^&]+)/i);
        if (m2) return `https://drive.google.com/file/d/${m2[1]}/preview`;
        return url;
      };
      const googleViewer = (url) =>
        `https://drive.google.com/viewerng/viewer?embedded=1&amp;url=${encodeURIComponent(
          url
        )}`;
      const embedSrc = isDrive
        ? toDrivePreview(menuStr)
        : isPDF
        ? googleViewer(menuStr)
        : null;
      return (
        <section className="mt-10">
          <div className="bg-orange-50 border-l-4 border-orange-500 text-orange-900 p-4 rounded">
            <h2 className="text-2xl font-bold mb-3">Menú</h2>
            <p className="mb-3">Consulta el menú actualizado del negocio.</p>
            <div className="mb-4">
              <a
                href={menuStr}
                target="_blank"
                rel="noreferrer"
                className="inline-block bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700"
              >
                Abrir menú en nueva pestaña
              </a>
            </div>
            {embedSrc && (
              <div className="rounded-lg overflow-hidden border bg-white">
                <iframe
                  src={embedSrc}
                  title="Menú"
                  className="w-full"
                  style={{ height: 680 }}
                  allow="autoplay"
                />
              </div>
            )}
          </div>
        </section>
      );
    }
    // Caso texto plano
    const clean = (l = "") =>
      l
        .replace(/^[•\-\*\u2022]+\s*/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
    const isHeader = (line) => {
      if (!line) return false;
      const noPrice = !/\$\s?\d/.test(line);
      const looksHeader =
        /[:：]$/.test(line) ||
        (line === line.toUpperCase() &&
          /[A-ZÁÉÍÓÚÑ]/.test(line) &&
          line.length > 2);
      return noPrice && looksHeader;
    };
    const splitNamePrice = (line) => {
      const m = line.match(/\$\s?\d+(?:[.,]\d{2})?/g);
      if (!m) return { name: clean(line), price: "" };
      const last = m[m.length - 1];
      const idx = line.lastIndexOf(last);
      const name = clean(line.slice(0, idx).replace(/[–—-]\s*$/, ""));
      return { name: name || clean(line), price: last.trim() };
    };
    const lines = menuStr
      .split(/\r?\n/)
      .map((l) => clean(l))
      .filter(Boolean);
    const sections = [];
    let current = { title: "Menú", items: [] };
    for (const line of lines) {
      if (isHeader(line)) {
        if (current.items.length || current.title !== "Menú")
          sections.push(current);
        current = { title: line.replace(/[:：]$/, ""), items: [] };
        continue;
      }
      const { name, price } = splitNamePrice(line);
      current.items.push({ name, price });
    }
    if (current.items.length || current.title !== "Menú")
      sections.push(current);
    return (
      <section className="mt-10">
        <div className="bg-orange-50 border-l-4 border-orange-500 text-orange-900 p-4 rounded">
          <h2 className="text-2xl font-bold mb-3">Menú</h2>
          <p className="mb-3">
            Precios y platillos proporcionados por el negocio.
          </p>
          <div className="rounded-lg border bg-white">
            <div className="p-5">
              {sections.map((sec, idx) => (
                <div key={idx} className="mb-6 last:mb-0">
                  {sec.title && (
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">
                      {sec.title}
                    </h3>
                  )}
                  <ul className="divide-y">
                    {sec.items.map((it, i) => (
                      <li
                        key={i}
                        className="flex items-baseline justify-between py-2"
                      >
                        <span className="text-gray-800 pr-4">{it.name}</span>
                        {it.price ? (
                          <span className="font-semibold tabular-nums">
                            {it.price}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  };
  const shouldShowMenu = plan === "premium" && isFoodCategory && hasMenu;
  // ---------------------------------------------------------------

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
          <Badge variant="outline">{prettyCategory(business.categoria)}</Badge>
          {plan === "profesional" && (
            <Badge className="bg-blue-100 text-blue-800 border border-blue-300 ml-2">
              Profesional
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

        {/* Promoción destacada */}
        {business.promocion_imagen && (
          <div className="w-full max-w-md mx-auto my-6">
            <img
              src={business.promocion_imagen}
              alt="Promoción"
              className="w-full h-auto rounded-xl shadow-lg"
            />
          </div>
        )}
        {business.promocion_vigencia && (
          <p className="text-center text-muted-foreground text-sm mb-4">
            Vigencia: {business.promocion_vigencia}
          </p>
        )}

        {business.portada_url && (
          <div className="mt-8 mb-6">
            <img
              src={business.portada_url}
              alt="Portada del negocio"
              className="w-full rounded-lg"
            />
          </div>
        )}

        {/* Estadísticas */}
        {business?.visitas && (
          <p className="text-sm text-gray-600">👁️ {business.visitas} visitas</p>
        )}
        {business?.clicks && (
          <p className="text-sm text-gray-600">👆 {business.clicks} clics</p>
        )}

        {/* Contenido por plan */}
        {plan === "premium" && (
          <>
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

            <div className="bg-green-50 border-l-4 border-green-500 text-green-800 p-4 rounded mb-4">
              <p className="text-gray-700 pl-1 mb-2">
                {business.descripcion ||
                  "Sin descripción disponible por el momento."}
              </p>
              <p className="text-sm text-gray-500 pl-1 mb-1">
                Dirección: {business.direccion}
              </p>
              <p className="text-sm text-gray-500 pl-1">
                Teléfono: {business.telefono}
              </p>
            </div>

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

            {business?.plan_type === "premium" && business.video_embed_url && (
              <div className="my-6">
                <h3 className="text-xl font-semibold mb-2">Video</h3>
                <div className="aspect-w-16 aspect-h-9">
                  <iframe
                    src={`https://www.youtube.com/embed/${extractYouTubeId(
                      business.video_embed_url
                    )}`}
                    title="Video del negocio"
                    frameBorder="0"
                    allowFullScreen
                    loading="lazy"
                    className="w-full h-64"
                  ></iframe>
                </div>
              </div>
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

            {(business.instagram ||
              business.facebook ||
              business.web ||
              business.tiktok) && (
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
                  {business.tiktok && (
                    <a
                      href={business.tiktok}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block bg-black text-white px-4 py-2 rounded hover:opacity-90"
                    >
                      TikTok
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
            {!business.descripcion && (
              <p className="text-sm text-red-500">
                ⚠️ Este negocio aún no tiene descripción cargada.
              </p>
            )}
            <p className="text-gray-700 mb-4">
              {business.descripcion ||
                "Sin descripción disponible por el momento."}
            </p>
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

            {business?.plan_type === "premium" && business.video_embed_url && (
              <div className="my-6">
                <h3 className="text-xl font-semibold mb-2">Video</h3>
                <div className="aspect-w-16 aspect-h-9">
                  <iframe
                    src={`https://www.youtube.com/embed/${extractYouTubeId(
                      business.video_embed_url
                    )}`}
                    title="Video del negocio"
                    frameBorder="0"
                    allowFullScreen
                    loading="lazy"
                    className="w-full h-64"
                  ></iframe>
                </div>
              </div>
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

        {plan === "profesional" && (
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
            {(business.plan_type === "profesional" ||
              business.plan_type === "premium") &&
              business.promociones && (
                <div className="mt-8 p-4 rounded-lg bg-orange-100 border border-orange-300 shadow">
                  <h3 className="text-xl font-semibold text-orange-800 mb-2">
                    🎁 Promoción Especial
                  </h3>
                  <p className="text-gray-900">{business.promociones}</p>
                </div>
              )}
          </>
        )}

        {/* Promociones activas (sección única) */}
        <section className="mt-10">
          <h2 className="text-xl font-bold mt-10 mb-2 text-red-600">
            🎉 Promociones activas
          </h2>
          <div className="flex flex-wrap gap-4">
            {promocionesArray.length === 0 ? (
              <p className="text-gray-500 w-full">
                No hay promociones activas registradas.
              </p>
            ) : (
              promocionesArray.map((promo) => (
                <div
                  key={promo.id}
                  className="w-full sm:w-1/2 md:w-1/3 lg:w-1/4"
                >
                  <PromoCard promo={promo} contexto="detalle" />
                </div>
              ))
            )}
          </div>
        </section>

        {/* -------- NUEVO: Menú (al final) -------- */}
        {shouldShowMenu && renderMenuBlock()}
        {/* --------------------------------------- */}

        {plan === "premium" && (
          <div className="bg-green-50 border-l-4 border-green-500 text-green-800 p-4 rounded mt-10">
            Este negocio cuenta con un plan <strong>Premium</strong>. Disfruta
            de todos los beneficios: video, contacto directo, redes sociales y
            más.
          </div>
        )}
      </div>
    </>
  );
};

export default BusinessDetailPage;
