import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import PromoCard from "@/components/PromoCard";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { FaInstagram, FaFacebook, FaGlobe } from "react-icons/fa";
import { FaTiktok } from "react-icons/fa6";
import TransportButtons from "@/components/TransportButtons";
import { useSession } from "@/contexts/SessionContext";
import {
  getPlanCapabilities,
  normalizePlan,
} from "@/lib/planCapabilities";
import {
  deleteBusinessReview,
  getBusinessReviews,
  getBusinessReviewSummaries,
  getReviewHelpfulSummaries,
  getPublicBusinessImage,
  getPublicBusinessName,
  PUBLIC_EXCLUDED_CATEGORY,
  saveBusinessReview,
  setReviewHelpful,
} from "@/lib/database";

/* ---------------------- Optimización de imágenes ---------------------- */
/** Devuelve la URL tal cual, sin transformaciones que rompan en local o en Supabase */
const optimizeImage = (url) => {
  if (!url || typeof url !== "string") return url;
  return url;
};

/* -------------------- Resolución de URL pública Storage -------------------- */
/** Convierte un path de Storage a URL pública. Si ya es URL completa, la regresa. */
const resolvePublicUrl = (pathOrUrl) => {
  if (!pathOrUrl) return null;
  if (typeof pathOrUrl !== "string") return null;

  // Si ya es URL absoluta, devolver tal cual
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;

  // Los paths que comienzan con "/" pertenecen a public/ y Vercel los sirve
  // desde el mismo dominio. No deben convertirse en rutas de Supabase Storage.
  if (pathOrUrl.startsWith("/")) return pathOrUrl;

  try {
    const clean = pathOrUrl.replace(/^\/+/, "");
    const [maybeBucket, ...rest] = clean.split("/");
    const hasBucket = rest.length > 0;
    const filePath = hasBucket ? rest.join("/") : clean;

    // Si el path tiene bucket explícito, probamos ese bucket
    const bucketsToTry = hasBucket
      ? [maybeBucket]
      : [
          "negocios",
          "logos",
          "portadas",
          "promociones",
          "gallery",
          "business_assets",
        ];

    for (const bucket of bucketsToTry) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
      if (data?.publicUrl) return data.publicUrl;
    }
    return null;
  } catch {
    return null;
  }
};

/* ---------------------- Galería Premium con Lightbox ---------------------- */
const LightboxGallery = ({ images = [], title = "Galería" }) => {
  const [open, setOpen] = React.useState(false);
  const [index, setIndex] = React.useState(0);

  if (!Array.isArray(images) || images.length === 0) return null;

  const openAt = (i) => {
    setIndex(i);
    setOpen(true);
  };
  const close = () => setOpen(false);
  const prev = (e) => {
    e?.stopPropagation?.();
    setIndex((i) => (i - 1 + images.length) % images.length);
  };
  const next = (e) => {
    e?.stopPropagation?.();
    setIndex((i) => (i + 1) % images.length);
  };

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  React.useEffect(() => {
    // Lock body scroll when lightbox is open (and avoid layout shift)
    if (!open) return;

    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;

    // Width of the scrollbar to avoid layout shift when hiding it
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (scrollbar > 0) {
      body.style.paddingRight = `${scrollbar}px`;
    }

    // Optional: block touch scroll on mobile (iOS/Android)
    const stopScroll = (e) => e.preventDefault();
    window.addEventListener("touchmove", stopScroll, { passive: false });
    window.addEventListener("wheel", stopScroll, { passive: false });

    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
      window.removeEventListener("touchmove", stopScroll);
      window.removeEventListener("wheel", stopScroll);
    };
  }, [open]);

  return (
    <section className="mt-6">
      {/* Thumbnails */}
      {/* Mobile: carrusel horizontal 1x con snap */}
      <div className="md:hidden mb-6 -mx-4 px-4">
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-1">
          {images.map((imgUrl, i) => {
            const resolved = resolvePublicUrl(imgUrl) || imgUrl;
            const thumb = optimizeImage(resolved);
            return (
              <button
                key={i}
                type="button"
                onClick={() => openAt(i)}
                className="snap-center shrink-0 w-full max-w-[88%] sm:max-w-[85%] relative focus:outline-none"
                aria-label={`Abrir imagen ${i + 1} de ${images.length}`}
              >
                <img
                  src={thumb}
                  alt={`Foto ${i + 1} de ${title}`}
                  className="w-full h-60 object-cover rounded-2xl shadow-md cursor-pointer object-center aspect-video bg-gray-100"
                  width="800"
                  height="600"
                  loading={i < 2 ? "eager" : "lazy"}
                  fetchpriority={i === 0 ? "high" : "auto"}
                  decoding="async"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop/Tablet: grid de miniaturas como antes */}
      <div className="hidden md:grid md:grid-cols-3 gap-4 mb-6">
        {images.map((imgUrl, i) => {
          const resolved = resolvePublicUrl(imgUrl) || imgUrl;
          const thumb = optimizeImage(resolved);
          return (
            <button
              key={i}
              type="button"
              onClick={() => openAt(i)}
              className="group relative block focus:outline-none"
              aria-label={`Abrir imagen ${i + 1} de ${images.length}`}
            >
              <img
                src={thumb}
                alt={`Foto ${i + 1} de ${title}`}
                className="w-full h-40 object-cover rounded-lg aspect-video bg-gray-100"
                width="640"
                height="360"
                loading={i < 2 ? "eager" : "lazy"}
                fetchpriority={i === 0 ? "high" : "auto"}
                decoding="async"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
              <span className="absolute inset-0 rounded-lg ring-0 group-hover:ring-4 ring-white/70 transition" />
            </button>
          );
        })}
      </div>

      {/* Lightbox */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Visor de imágenes"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
            className="absolute top-4 right-4 md:top-6 md:right-6 text-white/90 hover:text-white text-2xl"
            aria-label="Cerrar"
          >
            ✕
          </button>

          <button
            type="button"
            onClick={prev}
            className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 text-white text-3xl select-none p-4 md:p-3 bg-black/40 rounded-full hover:bg-black/60"
            aria-label="Anterior"
          >
            ‹
          </button>

          <figure
            className="max-w-[95vw] max-h-[85vh] px-6"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const resolved = resolvePublicUrl(images[index]) || images[index];
              const big = optimizeImage(resolved);
              return (
                <img
                  src={big}
                  alt={`Imagen ${index + 1} de ${title}`}
                  className="w-auto h-auto max-h-[85vh] max-w-[92vw] rounded-2xl shadow-lg object-contain aspect-[16/9]"
                  width="1600"
                  height="900"
                  loading="eager"
                  decoding="async"
                />
              );
            })()}
            <figcaption className="mt-3 text-center text-white/80 text-sm">
              {index + 1} / {images.length}
            </figcaption>
          </figure>

          <button
            type="button"
            onClick={next}
            className="absolute right-4 md:right-6 top-1/2 -translate-y-1/2 text-white text-3xl select-none p-4 md:p-3 bg-black/40 rounded-full hover:bg-black/60"
            aria-label="Siguiente"
          >
            ›
          </button>
        </div>
      )}
    </section>
  );
};

/* --------------------------- Carrusel de Promos --------------------------- */
const PromoCarousel = ({ promos = [] }) => {
  const listRef = React.useRef(null);

  if (!Array.isArray(promos) || promos.length < 2) return null;

  const scrollByAmount = (dir = 1) => {
    const el = listRef.current;
    if (!el) return;
    const first = el.querySelector("[data-slide]");
    const step = first ? first.clientWidth + 16 : el.clientWidth * 0.9;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  return (
    <section className="mt-10 relative">
      <h2 className="text-xl font-bold mt-10 mb-2 text-red-600">
        🎉 Promociones activas
      </h2>

      <div className="relative">
        {/* Botones */}
        <div className="flex justify-end gap-2 mb-2">
          <button
            type="button"
            onClick={() => scrollByAmount(-1)}
            className="rounded-full border px-3 py-1 text-sm hover:bg-gray-50"
            aria-label="Promos anterior"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => scrollByAmount(1)}
            className="rounded-full border px-3 py-1 text-sm hover:bg-gray-50"
            aria-label="Promos siguiente"
          >
            ›
          </button>
        </div>

        {/* Lista horizontal con snap */}
        <div
          ref={listRef}
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2"
        >
          {promos.map((promo) => (
            <div
              key={promo.id}
              data-slide
              className="snap-start shrink-0 w-[280px] sm:w-[320px]"
            >
              <PromoCard promo={promo} contexto="detalle" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const REVIEW_TAG_OPTIONS = [
  { value: "buen_servicio", label: "Buen servicio" },
  { value: "precio_justo", label: "Precio justo" },
  { value: "rapido", label: "Rápido" },
  { value: "limpio", label: "Limpio" },
  { value: "recomendado", label: "Recomendado" },
];

const getReviewTagLabel = (value) =>
  REVIEW_TAG_OPTIONS.find((option) => option.value === value)?.label || value;

const ReviewStars = ({
  value,
  onChange,
  readOnly = false,
  size = "text-2xl",
}) => (
  <div className="flex items-center gap-1" aria-label={`${value} de 5 estrellas`}>
    {[1, 2, 3, 4, 5].map((star) =>
      readOnly ? (
        <span
          key={star}
          className={`${size} ${
            star <= Math.round(Number(value) || 0)
              ? "text-yellow-500"
              : "text-gray-300"
          }`}
          aria-hidden="true"
        >
          ★
        </span>
      ) : (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`${size} leading-none transition ${
            star <= value ? "text-yellow-500" : "text-gray-300"
          } hover:text-yellow-400`}
          aria-label={`${star} estrella${star === 1 ? "" : "s"}`}
        >
          ★
        </button>
      )
    )}
  </div>
);

const BusinessReviews = ({ business }) => {
  const { user } = useSession();
  const { toast } = useToast();
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState({ rating: 0, reviews_count: 0 });
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [wouldReturn, setWouldReturn] = useState(null);
  const [selectedTags, setSelectedTags] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [savingReview, setSavingReview] = useState(false);

  const ownReview = reviews.find((review) => review.user_id === user?.id);
  const userEmail = String(user?.email || "").toLowerCase();
  const isBusinessOwner =
    Boolean(user?.id) &&
    (String(business?.user_id || "") === String(user.id) ||
      String(business?.owner_user_id || "") === String(user.id) ||
      (userEmail &&
        String(business?.owner_email || "").toLowerCase() === userEmail));

  const loadReviews = React.useCallback(async () => {
    if (!business?.id) return;
    setLoadingReviews(true);
    try {
      const [reviewRows, summaries] = await Promise.all([
        getBusinessReviews(supabase, business.id),
        getBusinessReviewSummaries(supabase, [business.id]),
      ]);
      const helpfulSummaries = await getReviewHelpfulSummaries(
        supabase,
        reviewRows.map((review) => review.id)
      );
      setReviews(
        reviewRows.map((review) => ({
          ...review,
          helpful_count:
            helpfulSummaries[review.id]?.helpful_count || 0,
          viewer_has_voted:
            helpfulSummaries[review.id]?.viewer_has_voted || false,
        }))
      );
      setSummary(
        summaries[business.id] || { rating: 0, reviews_count: 0 }
      );
    } catch (error) {
      console.error("Error cargando reseñas:", error);
    } finally {
      setLoadingReviews(false);
    }
  }, [business?.id]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  useEffect(() => {
    if (ownReview) {
      setRating(ownReview.rating);
      setComment(ownReview.comment || "");
      setWouldReturn(
        typeof ownReview.would_return === "boolean"
          ? ownReview.would_return
          : null
      );
      setSelectedTags(ownReview.tags || []);
    } else {
      setRating(0);
      setComment("");
      setWouldReturn(null);
      setSelectedTags([]);
    }
  }, [
    ownReview?.id,
    ownReview?.rating,
    ownReview?.comment,
    ownReview?.would_return,
    ownReview?.tags,
  ]);

  const handleSaveReview = async (event) => {
    event.preventDefault();
    if (!user) return;
    if (rating < 1 || rating > 5) {
      toast({
        title: "Selecciona una calificación",
        description: "Elige entre 1 y 5 estrellas.",
        variant: "destructive",
      });
      return;
    }
    if (typeof wouldReturn !== "boolean") {
      toast({
        title: "Cuéntanos si volverías",
        description: "Selecciona Sí o No antes de publicar.",
        variant: "destructive",
      });
      return;
    }

    setSavingReview(true);
    try {
      const metadataName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        String(user.email || "").split("@")[0];
      await saveBusinessReview(supabase, {
        id: ownReview?.id,
        businessId: business.id,
        rating,
        comment,
        authorName: metadataName,
        wouldReturn,
        tags: selectedTags,
      });
      await loadReviews();
      toast({
        title: ownReview ? "Reseña actualizada" : "Reseña publicada",
        description: "Gracias por compartir tu experiencia.",
      });
    } catch (error) {
      console.error("Error guardando reseña:", error);
      const duplicate = error?.code === "23505";
      const blocked = error?.code === "42501";
      toast({
        title: "No se pudo guardar la reseña",
        description: duplicate
          ? "Ya existe una reseña tuya para este negocio."
          : blocked
          ? "No tienes permiso para reseñar este negocio."
          : error?.message || "Inténtalo nuevamente.",
        variant: "destructive",
      });
    } finally {
      setSavingReview(false);
    }
  };

  const handleDeleteReview = async () => {
    if (!ownReview || !window.confirm("¿Eliminar tu reseña?")) return;
    setSavingReview(true);
    try {
      await deleteBusinessReview(supabase, ownReview.id);
      await loadReviews();
      toast({ title: "Reseña eliminada" });
    } catch (error) {
      toast({
        title: "No se pudo eliminar",
        description: error?.message || "Inténtalo nuevamente.",
        variant: "destructive",
      });
    } finally {
      setSavingReview(false);
    }
  };

  const rememberReturnPath = () => {
    try {
      localStorage.setItem(
        "post_login_redirect",
        `${window.location.pathname}${window.location.search}`
      );
    } catch {
      // El enlace sigue funcionando aunque el navegador bloquee storage.
    }
  };

  const toggleReviewTag = (tag) => {
    setSelectedTags((current) => {
      if (current.includes(tag)) {
        return current.filter((value) => value !== tag);
      }
      if (current.length >= 3) {
        toast({
          title: "Máximo tres etiquetas",
          description: "Elige las tres que mejor describan tu experiencia.",
        });
        return current;
      }
      return [...current, tag];
    });
  };

  const handleHelpfulVote = async (review) => {
    if (!user) {
      rememberReturnPath();
      window.location.href = "/login";
      return;
    }
    if (review.user_id === user.id) return;

    try {
      await setReviewHelpful(
        supabase,
        review.id,
        !review.viewer_has_voted
      );
      await loadReviews();
    } catch (error) {
      toast({
        title: "No se pudo registrar tu voto",
        description: error?.message || "Inténtalo nuevamente.",
        variant: "destructive",
      });
    }
  };

  const visibleReviews = reviews.filter(
    (review) => review.status === "published"
  );
  const topTags = Object.entries(
    visibleReviews.reduce((counts, review) => {
      (review.tags || []).forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
      return counts;
    }, {})
  )
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3);

  return (
    <section className="mt-12 rounded-2xl border bg-white p-5 shadow-sm md:p-7">
      <div className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Reseñas</h2>
          <p className="text-sm text-gray-500">
            Experiencias compartidas por usuarios de IztapaMarket.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ReviewStars value={summary.rating} readOnly size="text-xl" />
          <div>
            <strong className="text-xl">{summary.rating || "0.0"}</strong>
            <span className="ml-2 text-sm text-gray-500">
              ({summary.reviews_count} reseña
              {summary.reviews_count === 1 ? "" : "s"})
            </span>
          </div>
        </div>
      </div>

      {(summary.would_return_percentage != null || topTags.length > 0) && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {summary.would_return_percentage != null && (
            <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">
              {summary.would_return_percentage}% volvería
            </span>
          )}
          {topTags.map(([tag, count]) => (
            <span
              key={tag}
              className="rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-800"
            >
              {getReviewTagLabel(tag)} · {count}
            </span>
          ))}
        </div>
      )}

      {!user ? (
        <div className="my-6 rounded-xl bg-blue-50 p-4 text-blue-900">
          <p className="font-medium">Inicia sesión para dejar una reseña.</p>
          <a
            href="/login"
            onClick={rememberReturnPath}
            className="mt-3 inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Iniciar sesión
          </a>
        </div>
      ) : isBusinessOwner ? (
        <div className="my-6 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
          Los propietarios no pueden reseñar su propio negocio.
        </div>
      ) : (
        <form
          onSubmit={handleSaveReview}
          className="my-6 rounded-xl bg-gray-50 p-4"
        >
          <h3 className="font-semibold">
            {ownReview ? "Edita tu reseña" : "Comparte tu experiencia"}
          </h3>
          {ownReview?.status === "hidden" && (
            <p className="mt-2 text-sm text-orange-700">
              Esta reseña fue ocultada por moderación. Puedes editarla, pero
              permanecerá oculta hasta una nueva revisión.
            </p>
          )}
          <div className="mt-3">
            <ReviewStars value={rating} onChange={setRating} />
          </div>
          <fieldset className="mt-5">
            <legend className="font-medium text-gray-800">
              ¿Volverías a este negocio?
            </legend>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setWouldReturn(true)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                  wouldReturn === true
                    ? "border-green-600 bg-green-600 text-white"
                    : "border-gray-300 bg-white text-gray-700"
                }`}
              >
                Sí, volvería
              </button>
              <button
                type="button"
                onClick={() => setWouldReturn(false)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                  wouldReturn === false
                    ? "border-gray-700 bg-gray-700 text-white"
                    : "border-gray-300 bg-white text-gray-700"
                }`}
              >
                No volvería
              </button>
            </div>
          </fieldset>
          <fieldset className="mt-5">
            <legend className="font-medium text-gray-800">
              ¿Qué destacó?{" "}
              <span className="font-normal text-gray-500">
                Elige hasta 3
              </span>
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {REVIEW_TAG_OPTIONS.map((option) => {
                const selected = selectedTags.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleReviewTag(option.value)}
                    className={`rounded-full border px-3 py-1.5 text-sm ${
                      selected
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-gray-300 bg-white text-gray-700 hover:border-blue-400"
                    }`}
                    aria-pressed={selected}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value.slice(0, 1000))}
            rows={4}
            placeholder="Cuéntanos cómo fue tu experiencia (opcional)"
            className="mt-4 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none"
          />
          <div className="mt-2 text-right text-xs text-gray-400">
            {comment.length}/1000
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="submit" disabled={savingReview}>
              {savingReview
                ? "Guardando..."
                : ownReview
                ? "Actualizar reseña"
                : "Publicar reseña"}
            </Button>
            {ownReview && (
              <Button
                type="button"
                variant="outline"
                disabled={savingReview}
                onClick={handleDeleteReview}
              >
                Eliminar mi reseña
              </Button>
            )}
          </div>
        </form>
      )}

      {loadingReviews ? (
        <p className="py-6 text-sm text-gray-500">Cargando reseñas...</p>
      ) : visibleReviews.length === 0 ? (
        <p className="py-6 text-sm text-gray-500">
          Este negocio todavía no tiene reseñas. Sé la primera persona en
          compartir su experiencia.
        </p>
      ) : (
        <div className="divide-y">
          {visibleReviews.map((review) => (
            <article key={review.id} className="py-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {review.author_name}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {new Intl.DateTimeFormat("es-MX", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    }).format(new Date(review.created_at))}
                  </p>
                </div>
                <ReviewStars value={review.rating} readOnly size="text-lg" />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {typeof review.would_return === "boolean" && (
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      review.would_return
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {review.would_return ? "Sí volvería" : "No volvería"}
                  </span>
                )}
                {(review.tags || []).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-800"
                  >
                    {getReviewTagLabel(tag)}
                  </span>
                ))}
              </div>
              {review.comment && (
                <p className="mt-3 whitespace-pre-wrap text-gray-700">
                  {review.comment}
                </p>
              )}
              <button
                type="button"
                onClick={() => handleHelpfulVote(review)}
                disabled={review.user_id === user?.id}
                className={`mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                  review.viewer_has_voted
                    ? "border-blue-600 bg-blue-50 font-semibold text-blue-700"
                    : "border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-700"
                } disabled:cursor-not-allowed disabled:opacity-50`}
                title={
                  review.user_id === user?.id
                    ? "No puedes votar tu propia reseña"
                    : "Indica que esta reseña te sirvió"
                }
              >
                👍 Me sirvió
                {review.helpful_count > 0 && (
                  <span>{review.helpful_count}</span>
                )}
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

/* --------------------------- Página de negocio --------------------------- */
const BusinessDetailPage = () => {
  const { slug } = useParams();
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState(null);
  const [showPromo, setShowPromo] = useState(false);
  const [promociones, setPromociones] = useState([]);
  const [coverImageFailed, setCoverImageFailed] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    setCoverImageFailed(false);
  }, [business?.id, business?.portada_url]);

  // === Reemplazo suave de window.alert por toast (solo mientras esta página está montada)
  const originalAlertRef = React.useRef(window.alert);
  useEffect(() => {
    const alertAsToast = (message) => {
      if (typeof message === "string") {
        toast({ title: message, duration: 2500 });
      } else {
        toast({ title: "Aviso", description: String(message), duration: 2500 });
      }
    };

    // Sustituir alert por toast localmente
    window.alert = alertAsToast;

    // Restaurar al salir de la página
    return () => {
      window.alert = originalAlertRef.current;
    };
  }, [toast]);

  // Detecta móvil vs escritorio
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(
    navigator.userAgent || ""
  );

  // En desktop: copiar al portapapeles en lugar de abrir FaceTime
  const handleCallClick = (e) => {
    if (isMobile) return; // en móvil, dejamos que el enlace `tel:` abra el marcador
    e.preventDefault();
    const tel = business?.telefono || "";
    if (!tel) return;
    navigator.clipboard
      .writeText(tel)
      .then(() => {
        toast({
          title: "Número copiado",
          description: "Se copió al portapapeles.",
          duration: 2000,
        });
      })
      .catch(() => {
        toast({
          title: "No se pudo copiar",
          description: "Copia el número manualmente: " + tel,
          variant: "destructive",
        });
      });
  };

  useEffect(() => {
    const fetchBusiness = async () => {
      console.log("📥 Cargando negocio con slug:", slug);
      const { data, error } = await supabase
        .from("negocios")
        .select("*")
        .eq("slug", slug)
        .eq("is_deleted", false)
        .eq("is_approved", true)
        .neq("categoria", PUBLIC_EXCLUDED_CATEGORY)
        .maybeSingle();

      if (error) {
        console.error("❌ Error al obtener el negocio:", error.message);
        setBusiness(null);
      } else if (!data) {
        console.warn("⚠️ Negocio no encontrado para slug:", slug);
        setBusiness(null);
      } else {
        // Normaliza plan
        const normalizedPlan = normalizePlan(data?.plan_type);

        // Normaliza galería (acepta string[], {publicUrl|url|path}[])
        const galleryField = data?.gallery_images;
        let normalizedGallery = [];

        if (Array.isArray(galleryField)) {
          normalizedGallery = galleryField
            .map((g) => {
              if (typeof g === "string") return g;
              if (g && typeof g === "object") {
                if (g.publicUrl) return g.publicUrl;
                if (g.url) return g.url;
                if (g.path) {
                  const { data: pub } = supabase.storage
                    .from("negocios")
                    .getPublicUrl(g.path);
                  return pub?.publicUrl || g.path;
                }
              }
              return null;
            })
            .filter(Boolean);
        } else if (typeof galleryField === "string") {
          const trimmed = galleryField.trim();
          if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
            try {
              const parsed = JSON.parse(trimmed);
              if (Array.isArray(parsed)) {
                normalizedGallery = parsed
                  .map((g) => {
                    if (typeof g === "string") return g;
                    if (g && typeof g === "object") {
                      return g.publicUrl || g.url || g.path || null;
                    }
                    return null;
                  })
                  .filter(Boolean);
              }
            } catch {
              normalizedGallery = trimmed
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
            }
          } else {
            normalizedGallery = trimmed
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
          }
        }

        setBusiness({
          ...data,
          gallery_images: normalizedGallery,
          plan_type: normalizedPlan,
          video_embed_url: data.video_embed_url || data.video || "",
        });
        setPlan(normalizedPlan);
      }

      setLoading(false);
    };
    if (slug) fetchBusiness();
  }, [slug]);

  // Promociones
  useEffect(() => {
    const fetchPromociones = async () => {
      if (!business?.id) return;
      const { data: promocionesData, error } = await supabase
        .from("promociones")
        .select("*")
        .eq("negocio_id", business.id);

      if (error) {
        console.error("❌ Error cargando promociones:", error);
        return;
      }
      setPromociones(promocionesData || []);
    };
    fetchPromociones();
  }, [business?.id]);

  useEffect(() => {
    setShowPromo(Boolean(business?.promocion_imagen));
  }, [business?.promocion_imagen]);

  const promocionesArray = Array.isArray(promociones)
    ? promociones
    : promociones
    ? [promociones]
    : [];

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
    if (raw.startsWith("http")) {
      const match = raw.match(/wa\.me\/(\d+)/);
      return match ? `https://wa.me/${match[1]}` : raw;
    }
    const cleaned = raw.replace(/[^0-9]/g, "");
    return `https://wa.me/${cleaned}`;
  };

  const prettyCategory = (cat) => {
    if (!cat || typeof cat !== "string") return cat || "";
    return cat
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");
  };

  const extractYouTubeId = (url) => {
    const match = (url || "").match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    return match ? match[1] : "";
  };

  // ---- Normalizador de texto SOLO para este negocio ----
  const prettyService = (txt) => {
    if (!txt || typeof txt !== "string") return txt;
    let s = txt.trim();

    // Reemplazos rápidos de caracteres/separadores comunes
    s = s.replace(/[_\-]+/g, " "); // underscores y guiones a espacios
    s = s.replace(/\s{2,}/g, " "); // espacios repetidos

    // Correcciones de acentos/errores frecuentes
    s = s.replace(/\bcampanas\b/gi, "campañas");
    s = s.replace(/\bdiseno\b/gi, "diseño");
    s = s.replace(/\bvideo marketing\b/gi, "video marketing");
    s = s.replace(/\bautomatizaciones ia\b/gi, "automatizaciones IA");
    s = s.replace(/\bia\b/gi, "IA"); // asegurar IA en mayúsculas
    s = s.replace(/\bseo\b/gi, "SEO"); // si aparece

    // Title Case básico
    s = s
      .toLowerCase()
      .split(" ")
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
      .join(" ");

    // Mantener acrónimos en mayúsculas
    s = s.replace(/\bIa\b/g, "IA").replace(/\bSeo\b/g, "SEO");

    return s;
  };

  // Aplicar SOLO a este negocio (por slug)
  const onlyPrettyThisBiz = business?.slug === "level-creative-lab";

  /* ------------------------- Mapa y geolocalización ------------------------- */
  // Normaliza posibles &amp; en URLs copiadas desde CMS
  const decodeHtmlEntities = (str = "") =>
    str.replaceAll("&amp;", "&").replaceAll("&quot;", '"').trim();

  // Construye un src de mapa embebido sin API key.
  // Prioridad: mapa_embed_url limpio → lat/lng → dirección.
  const getMapEmbedSrc = (b) => {
    if (!b) return null;

    if (b.mapa_embed_url && typeof b.mapa_embed_url === "string") {
      return decodeHtmlEntities(b.mapa_embed_url);
    }

    const lat = Number(b.lat ?? b.latitud ?? b.latitude);
    const lng = Number(b.lng ?? b.longitud ?? b.longitude);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      return `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
    }

    const addr =
      b.direccion ||
      b.address ||
      `${b.nombre || ""} ${b.categoria || ""} Iztapalapa CDMX` ||
      "";
    if (addr) {
      return `https://maps.google.com/maps?q=${encodeURIComponent(
        addr
      )}&z=15&output=embed`;
    }

    return null;
  };

  // Construye link "Cómo llegar" para abrir Google Maps
  const getDirectionsUrl = (b) => {
    if (!b) return null;
    const lat = Number(b.lat ?? b.latitud ?? b.latitude);
    const lng = Number(b.lng ?? b.longitud ?? b.longitude);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    }
    const addr = b.direccion || b.address || "";
    if (addr) {
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        addr
      )}`;
    }
    return null;
  };

  // Bloque reutilizable de mapa (botón único con menú pro)
  const MapBlock = ({ business }) => {
    const { toast } = useToast();
    const src = getMapEmbedSrc(business);
    const directions = getDirectionsUrl(business);
    if (!src) return null;

    // Helpers para destinos
    const getDestParts = (b) => {
      if (!b) return { type: "query", value: "" };

      // 1) Campos directos en DB
      const lat = Number(b?.lat ?? b?.latitud ?? b?.latitude);
      const lng = Number(b?.lng ?? b?.longitud ?? b?.longitude);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        return { type: "latlng", value: `${lat},${lng}`, lat, lng };
      }

      // 2) Intentar extraer de mapa_embed_url si trae coordenadas en el parámetro q=
      if (typeof b?.mapa_embed_url === "string") {
        const cleaned = decodeHtmlEntities(b.mapa_embed_url);
        // Ejemplos soportados:
        // https://maps.google.com/maps?q=19.4326,-99.1332&z=15&output=embed
        // https://www.google.com/maps?q=19.4326,-99.1332&...
        let m = cleaned.match(/[?&]q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i);
        if (!m) {
          // Variante con @lat,lng en la URL
          m = cleaned.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i);
        }
        if (m) {
          const plat = Number(m[1]);
          const plng = Number(m[2]);
          if (!Number.isNaN(plat) && !Number.isNaN(plng)) {
            return {
              type: "latlng",
              value: `${plat},${plng}`,
              lat: plat,
              lng: plng,
            };
          }
        }
      }

      // 3) Fallback a dirección textual
      const addr = b?.direccion || b?.address || "";
      return { type: "query", value: addr };
    };

    const dest = getDestParts(business);

    const openGoogleWithGeo = () => {
      if (!navigator?.geolocation) {
        window.open(directions, "_blank", "noopener,noreferrer");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const origin = `${pos.coords.latitude},${pos.coords.longitude}`;
          const destParam =
            dest.type === "latlng"
              ? dest.value
              : encodeURIComponent(dest.value);
          const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destParam}`;
          window.open(url, "_blank", "noopener,noreferrer");
        },
        () => {
          // Fallback si el usuario deniega permisos o falla geolocalización
          window.open(directions, "_blank", "noopener,noreferrer");
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    };

    return (
      <section className="mt-6">
        <div className="rounded-lg overflow-hidden border bg-white">
          <iframe
            src={src}
            title="Ubicación del negocio"
            className="w-full h-64 md:h-72"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>

        {/* Botones de transporte reutilizables */}
        {(() => {
          const latProp = dest.type === "latlng" ? dest.lat : null;
          const lngProp = dest.type === "latlng" ? dest.lng : null;
          const addrProp = dest.type === "query" ? dest.value : "";

          // En plan Free no mostramos botones de transporte
          if (plan === "free") return null;

          return (
            <div className="mt-3">
              <TransportButtons
                lat={latProp}
                lng={lngProp}
                address={addrProp}
                planType={plan}
              />
            </div>
          );
        })()}
      </section>
    );
  };

  // --- Bloque único de redes sociales (para evitar duplicados) ---
  const SocialLinks = ({ b }) => {
    if (!(b?.instagram || b?.facebook || b?.web || b?.tiktok)) return null;
    return (
      <div className="my-6 space-y-2">
        <h3 className="text-xl font-semibold mb-2">Síguenos</h3>
        <div className="flex flex-wrap gap-2">
          {b.instagram && (
            <a
              href={b.instagram}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 bg-pink-600 text-white px-3 py-2 rounded-md hover:bg-pink-700 text-sm"
            >
              <FaInstagram className="w-4 h-4" />
              Instagram
            </a>
          )}
          {b.facebook && (
            <a
              href={b.facebook}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 bg-blue-700 text-white px-3 py-2 rounded-md hover:bg-blue-800 text-sm"
            >
              <FaFacebook className="w-4 h-4" />
              Facebook
            </a>
          )}
          {b.tiktok && (
            <a
              href={b.tiktok}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 bg-black text-white px-3 py-2 rounded-md hover:opacity-90 text-sm"
            >
              <FaTiktok className="w-4 h-4" />
              TikTok
            </a>
          )}
          {b.web && (
            <a
              href={b.web}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-3 py-2 rounded-md hover:bg-indigo-700 text-sm"
            >
              <FaGlobe className="w-4 h-4" />
              Sitio web
            </a>
          )}
        </div>
      </div>
    );
  };
  // ---------- Menú ----------
  const rawCat = (business?.slug_categoria || business?.categoria || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

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

      // 👇 Importante: usar '&' normal, NO '&amp;'
      const googleViewer = (url) =>
        `https://drive.google.com/viewerng/viewer?embedded=1&url=${encodeURIComponent(
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

    // Texto plano
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

  const planCapabilities = getPlanCapabilities(plan);
  const shouldShowMenu =
    planCapabilities.menu && isFoodCategory && hasMenu;

  // URL segura para el logo
  const logoSrc = resolvePublicUrl(business?.logo_url);
  const publicBusinessImage = getPublicBusinessImage(business);

  // --- SEO helpers (no UI impact) ---
  const canonicalUrl = `https://iztapamarket.com/negocio/${business?.slug}`;

  // Prefer logo, then portada, then imagen_url; always try to resolve to an absolute URL
  const resolvedSeoImage =
    optimizeImage(
        resolvePublicUrl(business?.logo_url) ||
        resolvePublicUrl(business?.portada_url) ||
        resolvePublicUrl(publicBusinessImage) ||
        business?.logo_url ||
        business?.portada_url ||
        publicBusinessImage ||
        ""
    ) || "";
  const seoImage = resolvedSeoImage.startsWith("/")
    ? `https://iztapamarket.com${resolvedSeoImage}`
    : resolvedSeoImage;

  const publicBusinessName = getPublicBusinessName(business);
  const seoTitle =
    business?.metaTitle || `${publicBusinessName} | IztapaMarket`;
  const seoDescription =
    business?.metaDescription ||
    (business?.descripcion ? business.descripcion.slice(0, 160) : "");

  return (
    <>
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:image" content={seoImage} />
        <meta property="og:type" content="business.business" />
        <meta property="og:url" content={canonicalUrl} />
        <meta name="robots" content="index, follow" />
        <meta name="author" content="IztapaMarket" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDescription} />
        <meta name="twitter:image" content={seoImage} />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            name: publicBusinessName,
            description: business?.descripcion || "",
            image: seoImage,
            telephone: business?.telefono || "",
            address: {
              "@type": "PostalAddress",
              streetAddress: business?.direccion || "",
              addressLocality: "Iztapalapa",
              addressRegion: "CDMX",
              postalCode: "09000",
              addressCountry: "MX",
            },
            url: canonicalUrl,
            sameAs: [
              business?.facebook,
              business?.instagram,
              business?.tiktok,
              business?.web,
            ].filter(Boolean),
          })}
        </script>
      </Helmet>

      <div className="container mx-auto px-4 py-10">
        <div className="mb-6">
          {logoSrc && (
            <img
              src={logoSrc}
              alt={`Logo de ${publicBusinessName}`}
              className="h-24 md:h-28 lg:h-32 w-auto mb-4"
              width="512"
              height="512"
              decoding="async"
              loading="lazy"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          )}
          <h1 className="text-4xl font-bold mb-2">{publicBusinessName}</h1>
          <Badge variant="outline">{prettyCategory(business.categoria)}</Badge>
          {plan === "pro" && (
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
        {showPromo && (
          <div className="w-full max-w-md mx-auto my-6">
            <img
              src={
                resolvePublicUrl(business.promocion_imagen) ||
                business.promocion_imagen
              }
              alt=""
              className="w-full h-auto rounded-xl shadow-lg"
              onError={() => setShowPromo(false)}
              loading="lazy"
            />
          </div>
        )}
        {showPromo && business.promocion_vigencia && (
          <p className="text-center text-muted-foreground text-sm mb-4">
            Vigencia: {business.promocion_vigencia}
          </p>
        )}

          {business.portada_url && !coverImageFailed && (
            <div className="mt-8 mb-6">
              <img
              src={
                resolvePublicUrl(business.portada_url) || business.portada_url
              }
              alt="Portada del negocio"
              className="w-full rounded-lg object-cover max-h-[450px] md:max-h-[350px] sm:max-h-[260px]"
                width="1600"
                height="600"
                loading="lazy"
                decoding="async"
                onError={() => setCoverImageFailed(true)}
              />
            </div>
          )}

        {/* Galería con Lightbox */}
        {(() => {
          const galleryLimit = planCapabilities.galleryLimit;

          const hasGallery =
            Array.isArray(business.gallery_images) &&
            business.gallery_images.length > 0 &&
            galleryLimit > 0;

          if (!hasGallery) return null;

          return (
            <section className="mt-10">
              <h2 className="text-2xl font-bold mb-2">📸 Galería</h2>
              <p className="text-sm text-gray-500 mb-4">
                Toca una imagen para verla en grande.
              </p>

              <LightboxGallery
                images={business.gallery_images.slice(0, galleryLimit)}
                title={publicBusinessName}
              />
            </section>
          );
        })()}

        {/* Estadísticas */}
        {Number(business?.visitas) > 0 && (
          <p className="text-sm text-gray-600">👁️ {business.visitas} visitas</p>
        )}
        {Number(business?.clicks) > 0 && (
          <p className="text-sm text-gray-600">👆 {business.clicks} clics</p>
        )}

        {/* Contenido por plan */}
        {plan === "premium" && (
          <>
            <div className="bg-green-50 border-l-4 border-green-500 text-green-800 p-4 rounded mb-4">
              <h3 className="text-lg font-semibold mb-2">Información</h3>
              <p className="text-gray-700 pl-1 mb-2">
                {business.descripcion ||
                  "Sin descripción disponible por el momento."}
              </p>
              <p className="text-sm text-gray-500 pl-1 mb-1">
                Dirección: {business.direccion}
              </p>
              {business.hours && (
                <p className="text-sm text-gray-500 pl-1 mb-1">
                  🕒 Horarios: {business.hours}
                </p>
              )}
              <p className="text-sm text-gray-500 pl-1">
                Teléfono: {business.telefono}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              {business.telefono && (
                <Button asChild>
                  <a
                    href={`tel:${business.telefono}`}
                    onClick={handleCallClick}
                  >
                    Llamar al negocio
                  </a>
                </Button>
              )}
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

            {planCapabilities.video && business.video_embed_url && (
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

            <MapBlock business={business} />

            {Array.isArray(business.services) &&
              business.services.length > 0 && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 p-4 rounded mt-6">
                  <h3 className="text-lg font-semibold mb-2">
                    Servicios que ofrecemos:
                  </h3>
                  <ul className="list-disc list-inside text-sm text-gray-700">
                    {business.services.map((service, idx) => (
                      <li key={idx}>
                        {onlyPrettyThisBiz ? prettyService(service) : service}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            <SocialLinks b={business} />
          </>
        )}

        {plan === "free" && (
          <>
            {publicBusinessImage && (
              <img
                src={
                  resolvePublicUrl(publicBusinessImage) || publicBusinessImage
                }
                alt={publicBusinessName}
                className="w-full max-h-96 object-cover rounded-lg mb-6"
                onError={(e) => (e.currentTarget.style.display = "none")}
                loading="lazy"
              />
            )}
            {/* Badge verde para plan Free */}
            <div className="bg-green-50 border-l-4 border-green-500 text-green-800 p-4 rounded mb-4">
              <h3 className="text-lg font-semibold mb-2">Información</h3>
            </div>
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
              {business.telefono && (
                <Button asChild>
                  <a
                    href={`tel:${business.telefono}`}
                    onClick={handleCallClick}
                  >
                    Llamar al negocio
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
            {publicBusinessImage && (
              <img
                src={
                  resolvePublicUrl(publicBusinessImage) || publicBusinessImage
                }
                alt={publicBusinessName}
                className="w-full max-h-96 object-cover rounded-lg mb-6"
                onError={(e) => (e.currentTarget.style.display = "none")}
                loading="lazy"
              />
            )}

            <div className="bg-green-50 border-l-4 border-green-500 text-green-800 p-4 rounded mb-4">
              <h3 className="text-lg font-semibold mb-2">Información</h3>
              <p className="text-gray-700 pl-1 mb-2">{business.descripcion}</p>
              <p className="text-sm text-gray-500 pl-1 mb-1">
                Dirección: {business.direccion}
              </p>
              {business.hours && (
                <p className="text-sm text-gray-500 pl-1 mb-1">
                  🕒 Horarios: {business.hours}
                </p>
              )}
              <p className="text-sm text-gray-500 pl-1">
                Teléfono: {business.telefono}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              {business.telefono && (
                <Button asChild>
                  <a
                    href={`tel:${business.telefono}`}
                    onClick={handleCallClick}
                  >
                    Llamar al negocio
                  </a>
                </Button>
              )}
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

            <MapBlock business={business} />

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
                      <li key={idx}>
                        {onlyPrettyThisBiz ? prettyService(service) : service}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            <SocialLinks b={business} />

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

        {/* Promociones activas */}
        {plan === "premium" && promocionesArray.length > 0 && (
          <>
            {/* Si hay entre 2 y 4 promos, usamos carrusel horizontal compacto.
                Si hay 1 o más de 4, usamos el grid normal para no saturar. */}
            {promocionesArray.length >= 2 && promocionesArray.length <= 4 ? (
              <PromoCarousel promos={promocionesArray} />
            ) : (
              <section className="mt-10">
                <h2 className="text-xl font-bold mt-10 mb-2 text-red-600">
                  🎉 Promociones activas
                </h2>
                <div className="flex flex-wrap gap-4">
                  {promocionesArray.map((promo) => (
                    <div
                      key={promo.id}
                      className="w-full sm:w-1/2 md:w-1/3 lg:w-1/4"
                    >
                      <PromoCard promo={promo} contexto="detalle" />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* Menú (al final) */}
        {shouldShowMenu && renderMenuBlock()}

        <BusinessReviews business={business} />

        {plan === "premium" && (
          <div className="bg-green-50 border-l-4 border-green-500 text-green-800 p-4 rounded mt-10">
            Este negocio cuenta con un plan <strong>Premium</strong>. La
            información mostrada corresponde a los datos proporcionados por el
            negocio.
          </div>
        )}
      </div>
      <Toaster />
    </>
  );
};

export default BusinessDetailPage;
