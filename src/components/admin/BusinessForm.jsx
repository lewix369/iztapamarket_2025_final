import React, { useState, useEffect } from "react";
// --- Convertir URL de video de YouTube a embed
const convertToEmbedUrl = (url) => {
  if (!url) return "";
  const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^\s&]+)/;
  const match = url.match(youtubeRegex);
  return match ? `https://www.youtube.com/embed/${match[1]}` : url;
};
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";

// --- IA helper: invoca la Edge Function generate-description con anon key ---
const FUNCTIONS_URL =
  import.meta.env.VITE_FUNCTIONS_URL || "http://127.0.0.1:54321/functions/v1";
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function generarDescripcionAI({
  nombre,
  categoria,
  servicios,
  ciudad,
  tono,
}) {
  const resp = await fetch(`${FUNCTIONS_URL}/generate-description`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({
      nombre,
      categoria,
      servicios: servicios || "",
      ciudad: ciudad || "Iztapalapa, CDMX",
      tono: tono || "profesional y cercano",
    }),
  });
  if (!resp.ok) throw new Error(`AI ${resp.status}: ${await resp.text()}`);
  const { descripcion } = await resp.json();
  return descripcion || "";
}
// ---------------------------------------------------------------------------

// --- LabeledInput Helper Component ---
const LabeledInput = ({ label, name, value, onChange, placeholder }) => (
  <div>
    <label className="block text-sm font-medium mb-1" htmlFor={name}>
      {label}
    </label>
    <input
      id={name}
      name={name}
      value={value || ""}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full border rounded px-2 py-1"
    />
  </div>
);

// --- ImagePreview & GalleryPreview ---
const ImagePreview = ({ url, label }) =>
  url ? (
    <div className="mt-2">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <img
        src={url}
        alt={label}
        className="w-full max-h-48 object-cover rounded border"
      />
    </div>
  ) : null;

const GalleryPreview = ({ images }) => {
  if (!images) return null;
  const urls = images
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
  if (urls.length === 0) return null;
  return (
    <div className="mt-2">
      <p className="text-sm text-gray-500 mb-1">Vista previa de galería</p>
      <div className="grid grid-cols-3 gap-2">
        {urls.map((url, idx) => (
          <img
            key={idx}
            src={url}
            alt={`Galería ${idx + 1}`}
            className="w-full h-24 object-cover rounded border"
          />
        ))}
      </div>
    </div>
  );
};

const BusinessForm = ({ initialData, onSubmit, onCancel, categoriesList }) => {
  const { toast } = useToast();
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    nombre: "",
    categoria: "",
    descripcion: "",
    direccion: "",
    telefono: "",
    hours: "",
    plan_type: "Free",
    imagen_url: "",
    logo_url: "",
    web: "",
    facebook: "",
    instagram: "",
    whatsapp: "",
    mapa_embed_url: "",
    video_embed_url: "",
    services: "",
    gallery_images: "",
    is_featured: false,
    portada_url: "",
    video_url: "",
    menu: "",
    tiktok: "",
    seo_keywords: "",
    paquete_marketing: "",
  });
  const [isGeneratingAIContent, setIsGeneratingAIContent] = useState(false);
  const [descripcionGenerada, setDescripcionGenerada] = useState(false);
  const [logoPreview, setLogoPreview] = useState("");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const planFromURL = urlParams.get("plan");

    if (initialData && !descripcionGenerada) {
      const normalizedPlan =
        initialData.plan_type?.charAt(0).toUpperCase() +
        initialData.plan_type?.slice(1).toLowerCase();

      setFormData((prev) => ({
        ...prev,
        nombre: initialData.nombre || "",
        categoria: initialData.categoria || "",
        descripcion: prev.descripcion || initialData.descripcion || "",
        direccion: initialData.direccion || "",
        telefono: initialData.telefono || "",
        hours: initialData.hours || "",
        plan_type: normalizedPlan || "Free",
        imagen_url: initialData.imagen_url || "",
        logo_url: initialData.logo_url || "",
        web: initialData.web || "",
        facebook: initialData.facebook || "",
        instagram: initialData.instagram || "",
        whatsapp: initialData.whatsapp || "",
        mapa_embed_url: initialData.mapa_embed_url || "",
        // Always set embed url from video_url so it matches what user would see
        video_embed_url: convertToEmbedUrl(initialData.video_url || ""),
        services: Array.isArray(initialData.services)
          ? initialData.services.join(", ")
          : initialData.services || "",
        gallery_images: Array.isArray(initialData.gallery_images)
          ? initialData.gallery_images.join(", ")
          : initialData.gallery_images || "",
        is_featured: !!initialData.is_featured,
        portada_url: initialData.portada_url || "",
        video_url: initialData.video_url || "",
        menu: initialData.menu || "",
        tiktok: initialData.tiktok || "",
        seo_keywords: initialData.seo_keywords || "",
        paquete_marketing: initialData.paquete_marketing || "",
      }));
    } else {
      const normalizedPlan =
        typeof planFromURL === "string"
          ? planFromURL.charAt(0).toUpperCase() +
            planFromURL.slice(1).toLowerCase()
          : "Free";

      setFormData((prev) => ({
        ...prev,
        plan_type: normalizedPlan,
      }));
    }
  }, [initialData, descripcionGenerada]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSelectChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSwitchChange = (name, checked) => {
    setFormData((prev) => ({ ...prev, [name]: checked }));
  };

  // --- Manejo de carga de imágenes individuales y galería ---
  const handleSingleImageUpload = async (file, fieldName) => {
    if (!file) return;
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${fieldName}/${fileName}`;

    const { error: uploadError, data } = await supabase.storage
      .from("negocios")
      .upload(filePath, file);

    if (uploadError) {
      toast({
        title: "Error al subir imagen",
        description: uploadError.message,
        variant: "destructive",
      });
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("negocios")
      .getPublicUrl(filePath);

    setFormData((prev) => ({
      ...prev,
      [fieldName]: publicUrlData.publicUrl,
    }));
    if (fieldName === "logo_url") {
      setLogoPreview(publicUrlData.publicUrl);
    }

    toast({
      title: "Imagen subida",
      description: `Se actualizó el campo ${fieldName}`,
    });
  };

  const handleGalleryUpload = async (files) => {
    const urls = [];
    const plan = formData.plan_type.toLowerCase();
    const max = plan === "premium" ? 6 : 3;

    if (files.length > max) {
      toast({
        title: "Límite excedido",
        description: `Máximo permitido: ${max} imágenes.`,
        variant: "destructive",
      });
      return;
    }

    for (const file of files) {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `galeria/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("negocios")
        .upload(filePath, file);

      if (uploadError) {
        toast({
          title: "Error al subir una imagen",
          description: uploadError.message,
          variant: "destructive",
        });
        continue;
      }

      const { data: publicUrlData } = supabase.storage
        .from("negocios")
        .getPublicUrl(filePath);

      urls.push(publicUrlData.publicUrl);
    }

    setFormData((prev) => ({
      ...prev,
      gallery_images: urls.join(", "),
    }));

    toast({
      title: "Galería actualizada",
      description: `${urls.length} imágenes cargadas correctamente.`,
    });
  };

  // Genera un slug único si el base ya existe (agrega -2, -3, ...)
  async function getUniqueSlug(base) {
    let candidate = base;
    // ¿ya existe el slug base?
    let { data: exists } = await supabase
      .from("negocios")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();

    let n = 2;
    while (exists) {
      candidate = `${base}-${n}`;
      const { data: again } = await supabase
        .from("negocios")
        .select("id")
        .eq("slug", candidate)
        .maybeSingle();
      if (!again) break;
      exists = again;
      n++;
    }
    return candidate;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // --- Requisitos mínimos comunes ---
    if (!formData.nombre || !formData.telefono || !formData.direccion) {
      setError("Nombre, teléfono y dirección son obligatorios.");
      return;
    }

    // --- Validación por plan ---
    const plan_type = (formData.plan_type || "").trim().toLowerCase();
    const {
      instagram,
      facebook,
      logo_url,
      mapa_embed_url,
      video_embed_url,
      tiktok,
      seo_keywords,
      paquete_marketing,
    } = formData;

    if (plan_type === "pro") {
      if (!instagram || !facebook || !logo_url || !mapa_embed_url) {
        setError(
          "Instagram, Facebook, Logo y Mapa son obligatorios en el plan PRO."
        );
        return;
      }
    }

    if (plan_type === "premium") {
      if (
        !instagram ||
        !facebook ||
        !logo_url ||
        !mapa_embed_url ||
        !video_embed_url ||
        !tiktok ||
        !seo_keywords ||
        !paquete_marketing
      ) {
        setError(
          "Todos los campos multimedia y SEO son obligatorios en el plan PREMIUM."
        );
        return;
      }
    }

    // --- Normalización de datos antes de guardar (incluye slug) ---
    const slugify = (str) =>
      (str || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // elimina acentos
        .replace(/[^a-z0-9]+/g, "-") // cualquier secuencia no alfanumérica -> guion
        .replace(/-+/g, "-") // colapsa guiones consecutivos
        .replace(/(^-|-$)/g, ""); // quita guiones al inicio/fin

    const slug = slugify(formData.nombre);

    const normalizedData = {
      ...formData,
      id: initialData?.id || undefined,
      plan_type,
      categoria: (formData.categoria || "").trim().toLowerCase(),
      services: (formData.services || "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s !== ""),
      gallery_images: (formData.gallery_images || "")
        .split(",")
        .map((img) => img.trim())
        .filter((img) => img !== ""),
      // mantener menu explícito
      menu: formData.menu,
      // asegurar que guardamos el embed correcto aunque el usuario ponga la URL normal
      video_embed_url:
        formData.video_embed_url || convertToEmbedUrl(formData.video_url),
      slug,
    };

    // ✅ Eliminar is_approved si es free para permitir que el trigger actúe
    if (normalizedData.plan_type === "free") {
      delete normalizedData.is_approved;
    }

    // Persistir en localStorage por si se necesita después
    localStorage.setItem("nuevo_negocio", JSON.stringify(normalizedData));

    // --- Usuario actual ---
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (!user || userError) {
      toast({
        title: "Error",
        description: "No se pudo obtener el usuario. Inicia sesión nuevamente.",
        variant: "destructive",
      });
      return;
    }

    // --- Validar/ajustar slug (solo creación o si cambió el nombre) ---
    if (!initialData || !initialData.id || slug !== initialData?.slug) {
      let finalSlug = slug;
      try {
        const { data: exists } = await supabase
          .from("negocios")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();

        if (exists) {
          // si ya existe, genera siguiente disponible: base-2, base-3, ...
          finalSlug = await getUniqueSlug(slug);
        }
      } catch (e) {
        console.warn("Verificación de slug falló:", e?.message || e);
      }
      // Actualiza el slug normalizado que se usará en el insert/update
      normalizedData.slug = finalSlug;
    }

    // --- Crear o actualizar (UNA sola vez; evita duplicados y nulos) ---
    if (!initialData || !initialData.id) {
      // Crear
      const { data: negocioInsertado, error } = await supabase
        .from("negocios")
        .insert([{ ...normalizedData, user_id: user.id, email: user.email }])
        .select();

      if (error) {
        toast({
          title: "Error",
          description: "No se pudo registrar el negocio.",
          variant: "destructive",
        });
        return;
      }

      // Asociar propietario para Pro/Premium
      if (
        negocioInsertado &&
        negocioInsertado.length > 0 &&
        ["pro", "premium"].includes(normalizedData.plan_type)
      ) {
        const nuevoNegocioId = negocioInsertado[0].id;

        const { error: propietarioError } = await supabase
          .from("negocio_propietarios")
          .insert([
            {
              user_id: user.id,
              negocio_id: nuevoNegocioId,
            },
          ]);

        if (propietarioError) {
          toast({
            title: "Error",
            description:
              "El negocio fue creado, pero no se pudo asociar al propietario.",
            variant: "destructive",
          });
          console.error(
            "Error al asociar propietario:",
            propietarioError.message
          );
        }
      }
    } else {
      // Actualizar
      const { error: updateError } = await supabase
        .from("negocios")
        .update(normalizedData)
        .eq("id", initialData.id);

      if (updateError) {
        toast({
          title: "Error",
          description: "No se pudo actualizar el negocio.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "✅ Actualizado",
        description: "El negocio se actualizó correctamente.",
      });
    }

    // Callback final
    onSubmit(normalizedData);
  };

  // Mantener sincronizada la URL de embed cuando cambie video_url
  useEffect(() => {
    if (formData.video_url) {
      const embed = convertToEmbedUrl(formData.video_url);
      if (embed !== formData.video_embed_url) {
        setFormData((prev) => ({ ...prev, video_embed_url: embed }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.video_url]);

  const handleGenerateAIContent = async () => {
    const serviciosProcesados = Array.isArray(formData.services)
      ? formData.services.filter((s) => s.trim() !== "").join(", ")
      : typeof formData.services === "string"
      ? formData.services
      : "";

    const planNormalizado = (formData.plan_type || "").trim().toLowerCase();
    if (planNormalizado !== "pro" && planNormalizado !== "premium") {
      toast({
        title: "Función no disponible",
        description:
          "La generación con IA solo está disponible para Pro y Premium.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.nombre || !formData.categoria) {
      toast({
        title: "Información requerida",
        description:
          "Ingresa al menos nombre y categoría para generar la descripción.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "⚙️ Generando con IA...",
      description: "Esto puede tardar unos segundos.",
    });
    setIsGeneratingAIContent(true);
    try {
      const descripcion = await generarDescripcionAI({
        nombre: formData.nombre,
        categoria: formData.categoria,
        servicios: serviciosProcesados,
        ciudad: formData?.ciudad || undefined,
        tono: "profesional y cercano",
      });
      if (!descripcion || typeof descripcion !== "string") {
        throw new Error("La descripción generada es inválida.");
      }
      setFormData((prev) => ({ ...prev, descripcion }));
      setDescripcionGenerada(true);
      toast({
        title: "✅ Listo",
        description: "Descripción generada exitosamente.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "No se pudo generar la descripción.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAIContent(false);
    }
  };

  // --- Determinar el plan activo ---
  const searchParams = new URLSearchParams(window.location.search);
  const plan =
    formData.plan_type?.toLowerCase() ||
    searchParams.get("plan")?.toLowerCase() ||
    "free";

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 max-h-[80vh] overflow-y-auto p-4"
    >
      {/* Campos por plan */}
      {plan === "free" && (
        <>
          <LabeledInput
            label="Nombre del negocio"
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
          />
          <LabeledInput
            label="Teléfono"
            name="telefono"
            value={formData.telefono}
            onChange={handleChange}
          />
          <LabeledInput
            label="Dirección"
            name="direccion"
            value={formData.direccion}
            onChange={handleChange}
          />
          <LabeledInput
            label="Logo (subir imagen)"
            name="logo_url"
            value={formData.logo_url}
            onChange={handleChange}
            placeholder="Ej. subir archivo desde la app"
          />
          {formData.logo_url && (
            <ImagePreview
              url={formData.logo_url}
              label="Vista previa del logo"
            />
          )}
          <LabeledInput
            label="Imagen Principal (subir imagen)"
            name="portada_url"
            value={formData.portada_url}
            onChange={handleChange}
            placeholder="Ej. subir archivo desde la app"
          />
          {formData.portada_url && (
            <ImagePreview
              url={formData.portada_url}
              label="Vista previa de la imagen principal"
            />
          )}
          <LabeledInput
            label="Video de YouTube (embed)"
            name="video_url"
            value={formData.video_url || formData.video_embed_url}
            onChange={handleChange}
            placeholder="URL de video de YouTube"
          />
          {formData.video_embed_url && (
            <div className="mt-2 w-full aspect-video rounded-md overflow-hidden border">
              <iframe
                src={formData.video_embed_url}
                title="Video del negocio"
                className="w-full h-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          )}
          <LabeledInput
            label="Menú (texto o link a PDF)"
            name="menu"
            value={formData.menu}
            onChange={handleChange}
            placeholder="Texto del menú o enlace a PDF"
          />
          {formData.menu?.startsWith("http") && (
            <p className="text-sm text-green-700 mt-1">
              Vista previa:{" "}
              <a
                href={formData.menu}
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-blue-600"
              >
                Abrir menú
              </a>
            </p>
          )}
          <LabeledInput
            label="Imagen del negocio (URL)"
            name="imagen_url"
            value={formData.imagen_url}
            onChange={handleChange}
          />
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Descripción del negocio
            </label>
            <Textarea
              name="descripcion"
              value={formData.descripcion}
              onChange={handleChange}
              placeholder="Describe brevemente tu negocio (servicios, especialidades)."
              className="w-full"
            />
            <p className="text-xs text-gray-500">
              Recomendado: 300–400 caracteres.
            </p>
          </div>
        </>
      )}

      {plan === "pro" && (
        <>
          <LabeledInput
            label="Nombre del negocio"
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
          />
          <LabeledInput
            label="Teléfono"
            name="telefono"
            value={formData.telefono}
            onChange={handleChange}
          />
          <LabeledInput
            label="WhatsApp"
            name="whatsapp"
            value={formData.whatsapp}
            onChange={handleChange}
          />
          <LabeledInput
            label="Dirección"
            name="direccion"
            value={formData.direccion}
            onChange={handleChange}
          />
          <LabeledInput
            label="Logo (subir imagen)"
            name="logo_url"
            value={formData.logo_url}
            onChange={handleChange}
            placeholder="Ej. subir archivo desde la app"
          />
          {formData.logo_url && (
            <ImagePreview
              url={formData.logo_url}
              label="Vista previa del logo"
            />
          )}
          <LabeledInput
            label="Imagen Principal (subir imagen)"
            name="portada_url"
            value={formData.portada_url}
            onChange={handleChange}
            placeholder="Ej. subir archivo desde la app"
          />
          {formData.portada_url && (
            <ImagePreview
              url={formData.portada_url}
              label="Vista previa de la imagen principal"
            />
          )}
          <LabeledInput
            label="Video de YouTube (embed)"
            name="video_url"
            value={formData.video_url || formData.video_embed_url}
            onChange={handleChange}
            placeholder="URL de video de YouTube"
          />
          {formData.video_embed_url && (
            <div className="mt-2 w-full aspect-video rounded-md overflow-hidden border">
              <iframe
                src={formData.video_embed_url}
                title="Video del negocio"
                className="w-full h-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          )}
          <LabeledInput
            label="Menú (texto o link a PDF)"
            name="menu"
            value={formData.menu}
            onChange={handleChange}
            placeholder="Texto del menú o enlace a PDF"
          />
          {formData.menu?.startsWith("http") && (
            <p className="text-sm text-green-700 mt-1">
              Vista previa:{" "}
              <a
                href={formData.menu}
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-blue-600"
              >
                Abrir menú
              </a>
            </p>
          )}
          <LabeledInput
            label="Instagram"
            name="instagram"
            value={formData.instagram}
            onChange={handleChange}
          />
          <LabeledInput
            label="Facebook"
            name="facebook"
            value={formData.facebook}
            onChange={handleChange}
          />
          <LabeledInput
            label="Horario"
            name="hours"
            value={formData.hours}
            onChange={handleChange}
          />
          <LabeledInput
            label="Servicios (separados por coma)"
            name="services"
            value={formData.services}
            onChange={handleChange}
            placeholder="Ej. tacos al pastor, salsas, envío a domicilio"
          />
        </>
      )}

      {plan === "premium" && (
        <>
          <LabeledInput
            label="Nombre del negocio"
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
          />
          <LabeledInput
            label="Teléfono"
            name="telefono"
            value={formData.telefono}
            onChange={handleChange}
          />
          <LabeledInput
            label="WhatsApp"
            name="whatsapp"
            value={formData.whatsapp}
            onChange={handleChange}
          />
          <LabeledInput
            label="Dirección"
            name="direccion"
            value={formData.direccion}
            onChange={handleChange}
          />
          <LabeledInput
            label="Logo (subir imagen)"
            name="logo_url"
            value={formData.logo_url}
            onChange={handleChange}
            placeholder="Ej. subir archivo desde la app"
          />
          {formData.logo_url && (
            <ImagePreview
              url={formData.logo_url}
              label="Vista previa del logo"
            />
          )}
          <LabeledInput
            label="Imagen Principal (subir imagen)"
            name="portada_url"
            value={formData.portada_url}
            onChange={handleChange}
            placeholder="Ej. subir archivo desde la app"
          />
          {formData.portada_url && (
            <ImagePreview
              url={formData.portada_url}
              label="Vista previa de la imagen principal"
            />
          )}
          <LabeledInput
            label="Video de YouTube (embed)"
            name="video_url"
            value={formData.video_url || formData.video_embed_url}
            onChange={handleChange}
            placeholder="URL de video de YouTube"
          />
          {formData.video_embed_url && (
            <div className="mt-2 w-full aspect-video rounded-md overflow-hidden border">
              <iframe
                src={formData.video_embed_url}
                title="Video del negocio"
                className="w-full h-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          )}
          <LabeledInput
            label="Menú (texto o link a PDF)"
            name="menu"
            value={formData.menu}
            onChange={handleChange}
            placeholder="Texto del menú o enlace a PDF"
          />
          {formData.menu?.startsWith("http") && (
            <p className="text-sm text-green-700 mt-1">
              Vista previa:{" "}
              <a
                href={formData.menu}
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-blue-600"
              >
                Abrir menú
              </a>
            </p>
          )}
          <LabeledInput
            label="Instagram"
            name="instagram"
            value={formData.instagram}
            onChange={handleChange}
          />
          <LabeledInput
            label="Facebook"
            name="facebook"
            value={formData.facebook}
            onChange={handleChange}
          />
          <LabeledInput
            label="TikTok"
            name="tiktok"
            value={formData.tiktok}
            onChange={handleChange}
          />
          <LabeledInput
            label="Horario"
            name="hours"
            value={formData.hours}
            onChange={handleChange}
          />
          <LabeledInput
            label="Sitio Web"
            name="web"
            value={formData.web}
            onChange={handleChange}
          />
          <LabeledInput
            label="Palabras Clave (SEO)"
            name="seo_keywords"
            value={formData.seo_keywords}
            onChange={handleChange}
          />
          <LabeledInput
            label="Imágenes de galería (subir imágenes)"
            name="gallery_images"
            value={formData.gallery_images}
            onChange={handleChange}
          />
          {formData.gallery_images && (
            <GalleryPreview images={formData.gallery_images} />
          )}
          <LabeledInput
            label="Servicios (separados por coma)"
            name="services"
            value={formData.services}
            onChange={handleChange}
            placeholder="Ej. tacos al pastor, salsas, envío a domicilio"
          />
        </>
      )}

      {/* Otros campos del formulario que no interfieren con la lógica por plan */}
      <div className="flex items-center space-x-2">
        <Switch
          id="is_featured"
          checked={formData.is_featured}
          onCheckedChange={(checked) =>
            handleSwitchChange("is_featured", checked)
          }
        />
        <Label htmlFor="is_featured" className="text-sm font-medium">
          Destacado
        </Label>
      </div>

      {(plan === "pro" || plan === "premium") && (
        <div className="space-y-2 border rounded-md p-3">
          <label className="block text-sm font-medium">
            Descripción del negocio
          </label>
          <Textarea
            name="descripcion"
            value={formData.descripcion}
            onChange={handleChange}
            placeholder="Aquí aparecerá la descripción generada o escribe la tuya"
            className="w-full"
          />
          <Button
            type="button"
            onClick={handleGenerateAIContent}
            disabled={isGeneratingAIContent}
          >
            {isGeneratingAIContent
              ? "Generando..."
              : "Generar descripción con IA"}
          </Button>
        </div>
      )}

      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      <div className="flex justify-end space-x-4 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
          {initialData ? "Actualizar" : "Agregar"} Negocio
        </Button>
      </div>
    </form>
  );
};

export default BusinessForm;
