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
import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Store } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
  getBusinesses as fetchAllBusinesses,
  createBusiness,
  updateBusiness,
  updateApprovalStatus,
  getDistinctCategories,
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
  const [allBusinesses, setAllBusinesses] = useState([]);
  const [filteredBusinesses, setFilteredBusinesses] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("all");
  const [selectedPlanFilter, setSelectedPlanFilter] = useState("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState(null);
  const [allCategories, setAllCategories] = useState([]);
  const { toast } = useToast();

  // ---- Aprobación rápida
  const [negocios, setNegocios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const fetchNegocios = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("negocios")
      .select("id,nombre,slug,categoria,is_approved,is_deleted,created_at")
      .order("created_at", { ascending: false });

    if (error) console.error("Error al cargar negocios:", error.message);
    setNegocios(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNegocios();
  }, [fetchNegocios]);

  const listaFiltrada = negocios.filter((n) =>
    [n.nombre, n.categoria, n.slug].some((v) =>
      String(v || "")
        .toLowerCase()
        .includes(busqueda.toLowerCase())
    )
  );

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

  // ---- Carga inicial
  const loadInitialData = useCallback(async () => {
    const [allBusinessesDataRaw, categoriesData] = await Promise.all([
      fetchAllBusinesses(supabase),
      getDistinctCategories(supabase),
    ]);

    const allBusinessesData = (allBusinessesDataRaw || []).map((biz) => ({
      ...biz,
      is_approved:
        typeof biz.is_approved === "boolean"
          ? biz.is_approved
          : typeof biz.status === "boolean"
          ? biz.status
          : biz.estado
          ? String(biz.estado).toLowerCase() === "aprobado"
          : null,
    }));

    setAllBusinesses(allBusinessesData);
    setAllCategories(["all", ...Array.from(new Set(categoriesData))]);
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // ---- Filtros
  const applyFilters = useCallback(() => {
    let businessesToFilter = [...allBusinesses];

    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      businessesToFilter = businessesToFilter.filter(
        (business) =>
          business.nombre.toLowerCase().includes(lowercasedTerm) ||
          business.categoria.toLowerCase().includes(lowercasedTerm)
      );
    }

    if (selectedCategoryFilter !== "all") {
      businessesToFilter = businessesToFilter.filter(
        (business) =>
          business.categoria?.toLowerCase().trim() ===
          selectedCategoryFilter.toLowerCase().trim()
      );
    }

    if (selectedPlanFilter !== "all") {
      businessesToFilter = businessesToFilter.filter(
        (business) =>
          business.plan_type?.toLowerCase().trim() ===
          selectedPlanFilter.toLowerCase().trim()
      );
    }

    if (selectedStatusFilter === "approved") {
      businessesToFilter = businessesToFilter.filter(
        (business) =>
          business.is_approved === true && business.is_deleted !== true
      );
    } else if (selectedStatusFilter === "rejected") {
      businessesToFilter = businessesToFilter.filter(
        (business) =>
          business.is_approved === false && business.is_deleted !== true
      );
    } else if (selectedStatusFilter === "pending") {
      businessesToFilter = businessesToFilter.filter(
        (business) =>
          business.is_approved === null && business.is_deleted !== true
      );
    } else if (selectedStatusFilter === "eliminado") {
      businessesToFilter = businessesToFilter.filter(
        (business) => business.is_deleted === true
      );
    } else {
      businessesToFilter = businessesToFilter.filter(
        (business) => business.is_deleted !== true
      );
    }

    setFilteredBusinesses(businessesToFilter);
  }, [
    allBusinesses,
    searchTerm,
    selectedCategoryFilter,
    selectedPlanFilter,
    selectedStatusFilter,
  ]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters, allBusinesses]);

  const refreshData = async () => {
    await loadInitialData();
    setSearchTerm("");
    setSelectedStatusFilter("all");
  };

  // ---- Crear/Editar
  const handleFormSubmit = async (formData) => {
    // Normalizar arrays desde el formulario
    const serviciosArr = toStringArray(formData.servicios);
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
      categoria: formData.categoria,
      seo_keywords: formData.keywords,
      is_featured: !!formData.is_featured,
      ...(serviciosArr.length > 0 && { servicios: serviciosArr }),
      ...(galleryArr.length > 0 && { gallery_images: galleryArr }),
      ...(video_embed_url && { video_embed_url }),
      ...(formData.menu && { menu: formData.menu }),
    });

    // UPDATE: por seguridad NO enviamos arrays aquí (aislamos el 400)
    const baseUpdate = prune({
      nombre: formData.nombre,
      descripcion: formData.descripcion,
      direccion: formData.direccion,
      telefono: formData.telefono,
      categoria: formData.categoria,
      seo_keywords: formData.keywords,
      is_featured: !!formData.is_featured,
      ...(video_embed_url && { video_embed_url }),
      ...(formData.menu && { menu: formData.menu }),
    });

    try {
      if (editingBusiness) {
        console.log("🟡 PATCH payload (sin arrays):", baseUpdate);
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

  const handleEdit = (business) => {
    setEditingBusiness(business);
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
      setAllBusinesses((prev) =>
        prev.map((n) =>
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
      );
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
      setNegocios((prev) =>
        prev.map((n) =>
          n.id === id
            ? {
                ...n,
                is_approved: approved,
                is_deleted: approved ? false : n.is_deleted,
              }
            : n
        )
      );

      const { error } = await updateApprovalStatus(supabase, id, approved);
      if (error) {
        // rollback
        setAllBusinesses((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_approved: !approved } : n))
        );
        setFilteredBusinesses((prev) =>
          Array.isArray(prev)
            ? prev.map((n) =>
                n.id === id ? { ...n, is_approved: !approved } : n
              )
            : prev
        );
        setNegocios((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_approved: !approved } : n))
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

      await Promise.all([fetchNegocios(), refreshData()]);
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
    await Promise.all([fetchNegocios(), refreshData()]);
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

        <AdminStats
          businesses={allBusinesses.map((biz) => ({
            ...biz,
            plan_type: biz.plan_type?.toLowerCase().trim(),
          }))}
        />

        {/* Aprobación rápida */}
        <Card className="mt-8">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center gap-3 mb-4">
              <Input
                placeholder="Buscar negocio..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full md:w-80"
              />
              <Button
                variant="secondary"
                onClick={fetchNegocios}
                disabled={loading}
              >
                {loading ? "Actualizando..." : "Refrescar"}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(listaFiltrada.length ? listaFiltrada : negocios).map((n) => (
                <Card key={n.id} className="border">
                  <CardContent className="p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{n.nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          {n.categoria} · {n.slug}
                        </p>
                      </div>
                      {n.is_approved ? (
                        <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-700">
                          Aprobado
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700">
                          Pendiente/Rechazado
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => doToggleApproval(n.id, true, "rapido")}
                        disabled={n.is_approved === true}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                      >
                        Aprobar
                      </Button>

                      <Button
                        onClick={() => doToggleApproval(n.id, false, "rapido")}
                        disabled={n.is_approved === false}
                        variant="destructive"
                        className="text-white disabled:opacity-50"
                      >
                        Rechazar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Filtros + Tabla */}
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
                  </DialogDescription>
                </DialogHeader>

                {console.log(
                  "🛠️ Datos negocio para editar (Admin):",
                  editingBusiness
                )}
                <BusinessForm
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
              <AdminBusinessTable
                businesses={filteredBusinesses}
                onApprove={handleApprove}
                onReject={handleReject}
                onDelete={handleSoftDelete}
                onEdit={handleEdit}
              />
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
