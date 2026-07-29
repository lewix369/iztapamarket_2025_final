// src/pages/AdminPage.jsx

// ---- Helpers YouTube ----
const convertEmbedToYoutubeUrl = (embedUrl) => {
  if (!embedUrl) return "";
  const regex = /embed\/([^\?&"]+)/;
  const match = embedUrl.match(regex);
  if (match && match[1]) return `https://www.youtube.com/watch?v=${match[1]}`;
  return embedUrl;
};

const convertYouTubeUrlToEmbed = (url) => {
  if (!url) return "";
  const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^\s&]+)/;
  const match = url.match(regex);
  if (match && match[1]) return `https://www.youtube.com/embed/${match[1]}`;
  return url;
};

import { supabase } from "@/lib/supabaseClient";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { MessageSquare, Plus, Search, Store } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

import {
  createBusiness,
  updateBusiness,
  updateApprovalStatus,
  getDistinctCategories,
  getAdminBusinessStats,
  searchAdminBusinesses,
  getAdminBusinessById,
  getAdminBusinessReviews,
  updateBusinessReviewStatus,
} from "@/lib/database";

import AdminStats from "@/components/admin/AdminStats";
import BusinessForm from "@/components/admin/BusinessForm";
import AdminBusinessTable from "@/components/admin/AdminBusinessTable";

// ---- Utils ----
const toStringArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value))
    return value.map((v) => String(v ?? "").trim()).filter(Boolean);
  if (typeof value === "string")
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  return [];
};

const prune = (obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => {
      if (v === undefined || v === null) return false;
      if (typeof v === "string" && v.trim() === "") return false;
      if (Array.isArray(v) && v.length === 0) return false;
      return true;
    })
  );

const AdminPage = () => {
  // 🔒 Protección simple por clave
  const [authorized, setAuthorized] = useState(false);
  useEffect(() => {
    if (import.meta.env.PROD) {
      const clave = localStorage.getItem("admin_access");
      if (clave === "soyadmin2025") setAuthorized(true);
      else {
        const input = prompt("🔒 Área protegida. Ingresa tu clave:");
        if (input === "soyadmin2025") {
          localStorage.setItem("admin_access", "soyadmin2025");
          setAuthorized(true);
        } else {
          window.location.href = "/";
        }
      }
    } else setAuthorized(true); // desarrollo
  }, []);

  // ---- Estado general
  const [filteredBusinesses, setFilteredBusinesses] = useState([]);
  const [adminStats, setAdminStats] = useState(null);
  const [totalBusinesses, setTotalBusinesses] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 50;
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("all");
  const [selectedPlanFilter, setSelectedPlanFilter] = useState("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState(null);
  const [allCategories, setAllCategories] = useState([]);
  const [adminReviews, setAdminReviews] = useState([]);
  const [adminReviewsCount, setAdminReviewsCount] = useState(0);
  const [reviewStatusFilter, setReviewStatusFilter] = useState("published");
  const [loadingReviews, setLoadingReviews] = useState(false);
  const businessPageRequestRef = useRef(0);
  const { toast } = useToast();

  const planOptions = [
    { value: "all", label: "Todos los planes" },
    { value: "premium", label: "Premium" },
    { value: "pro", label: "Profesional" },
    { value: "free", label: "Gratis" },
  ];

  const statusOptions = [
    { value: "all", label: "Todos los estados" },
    { value: "approved", label: "Aprobado" },
    { value: "pending", label: "Pendiente" },
    { value: "rejected", label: "Rechazado" },
    { value: "eliminado", label: "Eliminado" },
  ];

  // ---- Resumen estable: no se repite al buscar o cambiar de página
  const loadOverviewData = useCallback(async () => {
    const [statsData, categoriesData] = await Promise.all([
      getAdminBusinessStats(supabase),
      getDistinctCategories(supabase),
    ]);

    setAdminStats(statsData);
    setAllCategories(["all", ...Array.from(new Set(categoriesData))]);
  }, []);

  // ---- Página visible: esta es la única lista de negocios del administrador
  const loadBusinessPage = useCallback(async () => {
    const requestId = ++businessPageRequestRef.current;
    const pageData = await searchAdminBusinesses(supabase, {
      search: debouncedSearchTerm,
      category: selectedCategoryFilter,
      plan: selectedPlanFilter,
      status: selectedStatusFilter,
      page: currentPage,
      pageSize,
    });

    // Si el administrador cambió filtros mientras esta consulta estaba en
    // curso, una respuesta anterior no debe reemplazar el resultado vigente.
    if (requestId !== businessPageRequestRef.current) return;

    const allBusinessesData = (pageData.data || []).map((biz) => ({
      ...biz,
      is_approved:
        typeof biz.is_approved === "boolean" ? biz.is_approved : null,
    }));

    setFilteredBusinesses(allBusinessesData);
    setTotalBusinesses(pageData.count || 0);
  }, [
    debouncedSearchTerm,
    selectedCategoryFilter,
    selectedPlanFilter,
    selectedStatusFilter,
    currentPage,
  ]);

  useEffect(() => {
    loadOverviewData();
  }, [loadOverviewData]);

  useEffect(() => {
    loadBusinessPage();
  }, [loadBusinessPage]);

  const loadAdminReviews = useCallback(async () => {
    setLoadingReviews(true);
    try {
      const result = await getAdminBusinessReviews(supabase, {
        status: reviewStatusFilter,
        pageSize: 20,
      });
      setAdminReviews(result.data);
      setAdminReviewsCount(result.count);
    } catch (error) {
      console.error("Error cargando moderación de reseñas:", error);
      setAdminReviews([]);
      setAdminReviewsCount(0);
    } finally {
      setLoadingReviews(false);
    }
  }, [reviewStatusFilter]);

  useEffect(() => {
    loadAdminReviews();
  }, [loadAdminReviews]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(0);
  }, [
    debouncedSearchTerm,
    selectedCategoryFilter,
    selectedPlanFilter,
    selectedStatusFilter,
  ]);

  const refreshData = async () => {
    await Promise.all([
      loadOverviewData(),
      loadBusinessPage(),
      loadAdminReviews(),
    ]);
  };

  const handleReviewStatus = async (reviewId, status) => {
    try {
      await updateBusinessReviewStatus(supabase, reviewId, status);
      await loadAdminReviews();
      toast({
        title: status === "hidden" ? "Reseña ocultada" : "Reseña publicada",
      });
    } catch (error) {
      toast({
        title: "No se pudo moderar la reseña",
        description: error?.message || "Inténtalo nuevamente.",
        variant: "destructive",
      });
    }
  };

  // ---- Crear/Editar
  const handleFormSubmit = async (formData) => {
    // Normalizar arrays desde el formulario
    const serviciosArr = toStringArray(formData.services);
    const galleryArr = toStringArray(formData.gallery_images);

    // Video → embed
    let video_embed_url;
    if (formData.video_url && typeof formData.video_url === "string") {
      const embed = convertYouTubeUrlToEmbed(formData.video_url.trim());
      if (embed) video_embed_url = embed;
    } else if (formData.video_embed_url) {
      video_embed_url = formData.video_embed_url;
    }

    // ⚠️ Lista blanca de columnas válidas
    // CREATE: enviamos todo (incluidos arrays)
    const baseCreate = prune({
      nombre: formData.nombre,
      descripcion: formData.descripcion,
      direccion: formData.direccion,
      telefono: formData.telefono,
      whatsapp: formData.whatsapp,
      categoria: formData.categoria,
      hours: formData.hours,
      imagen_url: formData.imagen_url,
      portada_url: formData.portada_url,
      logo_url: formData.logo_url,
      web: formData.web,
      facebook: formData.facebook,
      instagram: formData.instagram,
      mapa_embed_url: formData.mapa_embed_url,
      menu: formData.menu,
      seo_keywords: formData.seo_keywords,
      is_featured: !!formData.is_featured,
      ...(serviciosArr.length > 0 && { services: serviciosArr }),
      ...(galleryArr.length > 0 && { gallery_images: galleryArr }),
      ...(video_embed_url && { video_embed_url }),
    });

    // UPDATE: por seguridad NO enviamos arrays aquí (aislamos el 400)
    const baseUpdate = prune({
      nombre: formData.nombre,
      descripcion: formData.descripcion,
      direccion: formData.direccion,
      telefono: formData.telefono,
      whatsapp: formData.whatsapp,
      categoria: formData.categoria,
      hours: formData.hours,
      imagen_url: formData.imagen_url,
      portada_url: formData.portada_url,
      logo_url: formData.logo_url,
      web: formData.web,
      facebook: formData.facebook,
      instagram: formData.instagram,
      mapa_embed_url: formData.mapa_embed_url,
      menu: formData.menu,
      seo_keywords: formData.seo_keywords,
      is_featured: !!formData.is_featured,
      ...(serviciosArr.length > 0 && { services: serviciosArr }),
      ...(galleryArr.length > 0 && { gallery_images: galleryArr }),
      ...(video_embed_url && { video_embed_url }),
    });

    try {
      if (editingBusiness) {
        console.log("🟡 PATCH payload:", baseUpdate);
        await updateBusiness(supabase, editingBusiness.id, baseUpdate);

        // TODO (opcional): si más adelante quieres permitir editar arrays,
        // haz un segundo update SÓLO con { servicios, gallery_images } y lo probamos.
        // console.log("🟠 PATCH arrays:", { servicios: serviciosArr, gallery_images: galleryArr });
        // await updateBusiness(supabase, editingBusiness.id, prune({
        //   ...(serviciosArr.length > 0 && { servicios: serviciosArr }),
        //   ...(galleryArr.length > 0 && { gallery_images: galleryArr }),
        // }));

        toast({
          title: "✅ Negocio actualizado",
          description: `${
            formData?.nombre || "El negocio"
          } ha sido actualizado.`,
        });
      } else {
        console.log("🟢 INSERT payload:", baseCreate);
        const created = await createBusiness(supabase, baseCreate);
        toast({
          title: "✅ Negocio agregado",
          description: `${created?.nombre || "El negocio"} ha sido agregado.`,
        });
      }

      await refreshData();
      setIsFormOpen(false);
      setEditingBusiness(null);
    } catch (err) {
      console.error("❌ Error al guardar negocio:", {
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code,
        cause: err,
      });
      toast({
        title: "❌ Error al guardar",
        description:
          (err?.message || "Error desconocido") +
          (err?.details ? ` — ${err.details}` : "") +
          (err?.hint ? ` — ${err.hint}` : ""),
        variant: "destructive",
      });
    }
  };

  const handleEdit = async (business) => {
    const fullBusiness = await getAdminBusinessById(supabase, business.id);
    if (!fullBusiness) {
      toast({
        title: "❌ No se pudo abrir el negocio",
        description:
          "No fue posible consultar el registro completo. Intenta nuevamente.",
        variant: "destructive",
      });
      return;
    }

    setEditingBusiness(fullBusiness);
    setIsFormOpen(true);
  };

  // ---- Aprobar/Rechazar
  const doToggleApproval = async (id, approved, source = "tabla") => {
    try {
      console.info(
        `[${source}] Cambiando estado id=${id} →`,
        approved ? "APROBADO" : "RECHAZADO"
      );

      // UI optimista
      setFilteredBusinesses((prev) =>
        Array.isArray(prev)
          ? prev.map((n) =>
              n.id === id
                ? {
                    ...n,
                    is_approved: approved,
                    status: approved,
                    estado: approved ? "aprobado" : "rechazado",
                    is_deleted: approved ? false : n.is_deleted,
                  }
                : n
            )
          : prev
      );
      const { error } = await updateApprovalStatus(supabase, id, approved);
      if (error) {
        // rollback
        setFilteredBusinesses((prev) =>
          Array.isArray(prev)
            ? prev.map((n) =>
                n.id === id ? { ...n, is_approved: !approved } : n
              )
            : prev
        );
        toast({
          title: "❌ Error",
          description:
            error.message || "No se pudo actualizar el estado de aprobación.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: approved ? "✅ Aprobado" : "⚠️ Rechazado",
        description: approved
          ? "El negocio ha sido aprobado."
          : "El negocio ha sido marcado como rechazado.",
      });

      await refreshData();
    } catch (err) {
      console.error("toggle approval error:", err);
      toast({
        title: "❌ Error",
        description: err.message || "No se pudo actualizar el estado.",
        variant: "destructive",
      });
    }
  };

  const handleApprove = (id) => doToggleApproval(id, true, "tabla");
  const handleReject = (id) => doToggleApproval(id, false, "tabla");

  // ---- Eliminación permanente
  const handleSoftDelete = async (id) => {
    if (!window.confirm("¿Eliminar PERMANENTEMENTE este negocio?")) return;

    const { error } = await supabase.from("negocios").delete().eq("id", id);
    if (error) {
      toast({
        title: "❌ Error",
        description: "No se pudo eliminar el negocio.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "🗑️ Eliminado",
      description: "El negocio ha sido eliminado.",
    });
    await refreshData();
  };

  if (!authorized) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                Gestión de Negocios
              </h1>
              <p className="text-gray-500 mt-1">
                Administra, aprueba y edita los negocios de IztapaMarket.
              </p>
            </div>
            <Button
              onClick={() => {
                setEditingBusiness(null);
                setIsFormOpen(true);
              }}
              className="mt-4 md:mt-0 bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" /> Agregar Negocio
            </Button>
          </div>
        </motion.div>

        <AdminStats stats={adminStats} />

        <Card className="mt-8">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-orange-100 p-2 text-orange-700">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    Moderación de reseñas
                  </h2>
                  <p className="text-sm text-gray-500">
                    {adminReviewsCount} reseña
                    {adminReviewsCount === 1 ? "" : "s"} en esta vista
                  </p>
                </div>
              </div>
              <Select
                value={reviewStatusFilter}
                onValueChange={setReviewStatusFilter}
              >
                <SelectTrigger className="w-full sm:w-52">
                  <SelectValue placeholder="Estado de reseña" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="published">Publicadas</SelectItem>
                  <SelectItem value="hidden">Ocultas</SelectItem>
                  <SelectItem value="all">Todas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loadingReviews ? (
              <p className="py-8 text-sm text-gray-500">
                Cargando reseñas...
              </p>
            ) : adminReviews.length === 0 ? (
              <p className="py-8 text-sm text-gray-500">
                No hay reseñas en este estado.
              </p>
            ) : (
              <div className="mt-5 divide-y rounded-xl border">
                {adminReviews.map((review) => (
                  <article key={review.id} className="p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-gray-900">
                            {review.author_name}
                          </strong>
                          <span className="text-yellow-500">
                            {"★".repeat(review.rating)}
                            <span className="text-gray-300">
                              {"★".repeat(Math.max(0, 5 - review.rating))}
                            </span>
                          </span>
                          <Badge
                            variant={
                              review.status === "published"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {review.status === "published"
                              ? "Publicada"
                              : "Oculta"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm font-medium text-blue-700">
                          {review.negocios?.nombre || "Negocio"}
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">
                          {review.comment || "Sin comentario escrito."}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {typeof review.would_return === "boolean" && (
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                review.would_return
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {review.would_return
                                ? "Sí volvería"
                                : "No volvería"}
                            </span>
                          )}
                          {(review.tags || []).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-800"
                            >
                              {tag.replaceAll("_", " ")}
                            </span>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-gray-400">
                          {new Intl.DateTimeFormat("es-MX", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(new Date(review.created_at))}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() =>
                          handleReviewStatus(
                            review.id,
                            review.status === "published"
                              ? "hidden"
                              : "published"
                          )
                        }
                      >
                        {review.status === "published"
                          ? "Ocultar"
                          : "Volver a publicar"}
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Filtros + única lista paginada */}
        <Card className="mt-8">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Buscar por nombre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full text-black"
                />
              </div>

              <Select
                value={selectedCategoryFilter}
                onValueChange={setSelectedCategoryFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  {allCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category === "all" ? "Todas las categorías" : category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={selectedPlanFilter}
                onValueChange={setSelectedPlanFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Plan" />
                </SelectTrigger>
                <SelectContent>
                  {planOptions.map((plan) => (
                    <SelectItem key={plan.value} value={plan.value}>
                      {plan.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={selectedStatusFilter}
                onValueChange={setSelectedStatusFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingBusiness
                      ? "Editar Negocio"
                      : "Agregar Nuevo Negocio"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingBusiness
                      ? "Modifica la información del negocio"
                      : "Completa la información del nuevo negocio"}
                    {editingBusiness ? (
                      <span className="mt-2 block text-xs text-gray-500">
                        slug: {editingBusiness.slug || "—"} · id:{" "}
                        {editingBusiness.id}
                      </span>
                    ) : null}
                  </DialogDescription>
                </DialogHeader>

                {console.log(
                  "🛠️ Datos negocio para editar (Admin):",
                  editingBusiness
                )}
                <BusinessForm
                  adminMode
                  initialData={
                    editingBusiness
                      ? {
                          ...editingBusiness,
                          video_url: convertEmbedToYoutubeUrl(
                            editingBusiness.video_embed_url
                          ),
                          video_embed_url:
                            editingBusiness.video_embed_url || "",
                        }
                      : null
                  }
                  onSubmit={handleFormSubmit}
                  onCancel={() => {
                    setIsFormOpen(false);
                    setEditingBusiness(null);
                  }}
                  categoriesList={allCategories.filter((cat) => cat !== "all")}
                  renderExtraFields={(business) => {
                    const safeBusiness = business || {};
                    return (
                      <>
                        {safeBusiness && safeBusiness.video_url ? (
                          <div className="mt-4">
                            <iframe
                              width="100%"
                              height="315"
                              src={safeBusiness.video_url.replace(
                                "watch?v=",
                                "embed/"
                              )}
                              title="Video del negocio"
                              frameBorder="0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              className="rounded-md"
                            ></iframe>
                          </div>
                        ) : null}

                        {safeBusiness.menu &&
                          safeBusiness.menu.includes("drive.google.com") && (
                            <div className="mt-4">
                              <p className="text-sm font-medium text-gray-700 mb-1">
                                Vista previa del Menú:
                              </p>
                              <iframe
                                src={safeBusiness.menu.replace(
                                  "/view?usp=sharing",
                                  "/preview"
                                )}
                                className="w-full h-[480px] rounded-md border"
                                allow="autoplay"
                              ></iframe>
                            </div>
                          )}

                        {safeBusiness.menu &&
                          safeBusiness.menu.endsWith(".pdf") && (
                            <div className="mt-2">
                              <iframe
                                src={safeBusiness.menu}
                                width="100%"
                                height="400px"
                                title="Vista previa del menú"
                                className="rounded border"
                              ></iframe>
                            </div>
                          )}
                      </>
                    );
                  }}
                />
              </DialogContent>
            </Dialog>

            {filteredBusinesses.length > 0 ? (
              <>
                <div className="mb-4 flex flex-col gap-2 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Mostrando {filteredBusinesses.length} de {totalBusinesses} negocios
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      disabled={currentPage === 0}
                      onClick={() => setCurrentPage((page) => Math.max(0, page - 1))}
                    >
                      Anterior
                    </Button>
                    <span>Página {currentPage + 1}</span>
                    <Button
                      variant="outline"
                      disabled={(currentPage + 1) * pageSize >= totalBusinesses}
                      onClick={() => setCurrentPage((page) => page + 1)}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
                <AdminBusinessTable
                  businesses={filteredBusinesses}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onDelete={handleSoftDelete}
                  onEdit={handleEdit}
                />
              </>
            ) : (
              <div className="text-center py-16">
                <Store className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700">
                  No se encontraron negocios
                </h3>
                <p className="text-gray-500 mt-2">
                  Intenta ajustar tus filtros o agregar un nuevo negocio.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
};

export default AdminPage;
