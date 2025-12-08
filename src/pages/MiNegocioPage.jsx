import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import PromoCard from "@/components/PromoCard";
import { useSession } from "@/contexts/SessionContext";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload } from "lucide-react";
import { mapPromo } from "@/utils/mapPromo";
import { getSessionAndProfile } from "@/lib/useUserProfile";
import BusinessForm from "@/components/admin/BusinessForm";

/* =========================
   Utilidad: YouTube a /embed/
   ========================= */
const convertYouTubeUrlToEmbed = (url) => {
  if (!url) return "";
  const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^\s&]+)/;
  const match = url.match(regex);
  if (match && match[1]) return `https://www.youtube.com/embed/${match[1]}`;
  return url;
};

// UUID v4 seguro con fallback
const uuidv4 = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback simple
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// --- Utilidad local: comprimir a WebP antes de subir (sin dependencias)
const compressToWebP = async (
  file,
  { maxWidth = 1600, maxKB = 300, minQuality = 0.5, step = 0.05 } = {}
) => {
  if (!file || !file.type || !file.type.startsWith("image/")) {
    throw new Error("Archivo de imagen inválido");
  }

  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = URL.createObjectURL(file);
  });

  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;
  if (width > maxWidth) {
    const ratio = maxWidth / width;
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.9;
  let blob = await new Promise((res) =>
    canvas.toBlob(res, "image/webp", quality)
  );
  while (blob && blob.size / 1024 > maxKB && quality > minQuality) {
    quality = Math.max(minQuality, quality - step);
    blob = await new Promise((res) =>
      canvas.toBlob(res, "image/webp", quality)
    );
  }

  const base = (file.name || "imagen").replace(/\.[^.]+$/, "");
  const filename = `${base}-${Date.now()}.webp`;

  URL.revokeObjectURL(img.src);
  return { blob, filename };
};

const MiNegocioPage = () => {
  // === Quick badge plan loader (non-invasive) ===
  const [badgeLoading, setBadgeLoading] = useState(true);
  const [badgeNegocio, setBadgeNegocio] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [canEditBusiness, setCanEditBusiness] = useState(false);
  const [showMinimalForm, setShowMinimalForm] = useState(false);

  async function loadBusinessBadge() {
    setBadgeLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) { setBadgeLoading(false); return; }

    const { data, error } = await supabase
      .from('negocios')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) console.error('[MiNegocio] Error cargando negocio', error);
    if (!error) setBadgeNegocio(data || null);
    setBadgeLoading(false);
  }

  useEffect(() => {
    loadBusinessBadge();
  }, []);

  // Si vienes del flujo de pago con ?status=approved, refetch para ver el upgrade (solo para el badge)
  useEffect(() => {
    const usp = new URLSearchParams(window.location.search);
    const isApproved =
      usp.get("status") === "approved" ||
      usp.get("collection_status") === "approved";
    if (isApproved) loadBusinessBadge();
  }, []);
  
  const navigate = useNavigate();
    // === Plan del usuario (no rompe flujos existentes) ===
  const [sessEmail, setSessEmail] = useState(null);
  const [plan, setPlan] = useState({ type: null, status: null, expiresAt: null });
  const [loadingPlan, setLoadingPlan] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { user, profile, needsLogin, error } = await getSessionAndProfile("auto");
        if (!alive) return;

        if (needsLogin || !user?.email) {
          setSessEmail(null);
          setPlan({ type: null, status: null, expiresAt: null });
          setLoadingPlan(false);
          return;
        }

        setSessEmail(user.email ?? null);
        setPlan({
          type: profile?.plan_type ?? null,
          status: profile?.plan_status ?? null,
          expiresAt: profile?.plan_expires_at ?? null,
        });

        if (error) console.warn("[MiNegocioPage] perfil warning:", error);
      } catch (e) {
        console.error("[MiNegocioPage] perfil error:", e);
      } finally {
        if (alive) setLoadingPlan(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const SUPPORT_URL =
    "https://wa.me/525569006664?text=Hola%20necesito%20reactivar%20mi%20IA";

  // --- Estado promos (flujo legacy breve)
  const [promocionTitulo, setPromocionTitulo] = useState("");
  const [promocionInicio, setPromocionInicio] = useState("");
  const [promocionVigencia, setPromocionVigencia] = useState("");
  const [promocionImagen, setPromocionImagen] = useState(null);
  const [promoImagePreview, setPromoImagePreview] = useState(null);

  // Galería (previews seleccionadas antes de subir)
  const [selectedImages, setSelectedImages] = useState([]);
  const handleGallerySelection = (event) => {
    const files = Array.from(event.target.files);
    const previews = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setSelectedImages((prev) => [...prev, ...previews]);
  };

  // Subir galería a Storage y actualizar negocio
  const { toast } = useToast();
  const session = useSession();
  const user = session?.user;

  // 📌 Query params de la URL (ej. ?plan=premium&email=xxx)
  const [params] = useSearchParams();

  // 📌 Estado de auth/URL (para evitar crash cuando no hay sesión)
  const [authChecked, setAuthChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [sessionEmail, setSessionEmail] = useState(null);
  const [shouldShowLoginCta, setShouldShowLoginCta] = useState(false);
  const [profilePlan, setProfilePlan] = useState("");

  const [business, setBusiness] = useState({
    id: "",
    nombre: "",
    descripcion: "",
    servicios: "", // UI como string, se normaliza a array al guardar
    telefono: "",
    whatsapp: "",
    direccion: "",
    mapa_embed_url: "",
    instagram: "",
    facebook: "",
    tiktok: "",
    web: "",
    portada_url: "",
    logo_url: "",
    video_url: "",
    video_embed_url: "",
    palabras_clave: "",
    menu: "",
    gallery_images: [],
  });

  const ensureCanEdit = () => {
    if (!currentUserId || !business?.id) {
      alert("Necesitas iniciar sesión para administrar tu negocio.");
      return false;
    }

    if (!canEditBusiness) {
      alert(
        "Solo los negocios con Plan Pro o Premium, ligados a tu cuenta, pueden editar desde aquí. Si crees que es un error, contáctanos por WhatsApp."
      );
      return false;
    }

    return true;
  };

  const handleUploadGallery = async () => {
    if (!business?.id || selectedImages.length === 0) return;
    if (!ensureCanEdit()) return;
    try {
      const uploadedUrls = [];
      for (const img of selectedImages) {
        // Comprimir cada imagen de galería (tamaño moderado)
        const { blob, filename } = await compressToWebP(img.file, {
          maxWidth: 1200,
          maxKB: 300,
        });

        const path = `gallery/${filename}`;
        const { error: uploadError } = await supabase.storage
          .from("negocios")
          .upload(path, blob, { contentType: "image/webp", upsert: true });
        if (uploadError) throw uploadError;

        const { data: pub } = supabase.storage
          .from("negocios")
          .getPublicUrl(path);
        uploadedUrls.push(pub.publicUrl);
      }

      const updatedGallery = [
        ...(business.gallery_images || []),
        ...uploadedUrls,
      ];
      const { error: updateError } = await supabase
        .from("negocios")
        .update({ gallery_images: updatedGallery })
        .eq("id", business.id);
      if (updateError) throw updateError;

      setBusiness((prev) => ({ ...prev, gallery_images: updatedGallery }));
      setSelectedImages([]);
      toast({ title: "Imágenes de galería guardadas correctamente." });
    } catch (error) {
      console.error("Error al subir galería:", error.message);
      toast({
        title: "Error al subir galería",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // ---- unified plan source ----
  // Prioridad: negocio (incluye cambios tras pago) > badgeNegocio > perfil > URL > free
  const rawUrlPlan = (params.get("plan") || "").toLowerCase();
  const negocioPlan = (
    business?.plan_type ||
    badgeNegocio?.plan_type ||
    ""
  ).toLowerCase();
  const profilePlanSafe = (profilePlan || "").toLowerCase();

  const planName =
    negocioPlan ||
    profilePlanSafe ||
    rawUrlPlan ||
    "free";

  const isPremiumPlan = planName === "premium";

  // debug interno (no uses window._planName)
  // console.log("[MiNegocioPage DEBUG]", { planName, isPremiumPlan, from: {
  //   plan_type: plan?.type ?? null,
  //   profilePlan: profilePlan ?? null,
  //   business_plan_type: business?.plan_type ?? null,
  // }});
  const [aiCoverPrompt, setAiCoverPrompt] = useState("");
  const [aiLogoPrompt, setAiLogoPrompt] = useState("");
  const [loadingCover, setLoadingCover] = useState(false);
  const [loadingLogo, setLoadingLogo] = useState(false);
  const [useSimpleCover, setUseSimpleCover] = useState(true);
  const [useSimpleLogo, setUseSimpleLogo] = useState(true);
  // Loading: generación de descripción con IA
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);

  // Campos simples para IA
  const [coverStyle, setCoverStyle] = useState("Moderno");
  const [coverLight, setCoverLight] = useState("Natural");
  const [coverColors, setCoverColors] = useState("");
  const [coverElements, setCoverElements] = useState("");
  const [logoType, setLogoType] = useState("Isotipo");
  const [logoIcon, setLogoIcon] = useState("");
  const [logoShape, setLogoShape] = useState("Circular");
  const [logoColors, setLogoColors] = useState("");
  const [logoBg, setLogoBg] = useState("Transparente");
  const [logoDetail, setLogoDetail] = useState("Minimalista");
  const [selectedCoverPreset, setSelectedCoverPreset] = useState("");
  const [selectedLogoPreset, setSelectedLogoPreset] = useState("");

  const portadaEjemplos = [
    {
      label: "Portada Tradicional",
      prompt:
        "Banner horizontal fotográfico para negocio de comida mexicana, mesa rústica con tortillas, guacamole y aguas frescas de colores vivos. Fondo cálido, estilo acogedor, iluminación natural, alta resolución.",
    },
    {
      label: "Portada Minimalista",
      prompt:
        "Banner horizontal limpio y moderno para negocio de comida, plato minimalista con tortillas y guacamole, colores naranja y verde, fondo blanco liso, iluminación de estudio, enfoque en el producto.",
    },
    {
      label: "Portada Estilo Gourmet",
      prompt:
        "Banner horizontal tipo fotografía editorial, presentación gourmet de tortillas artesanales con guacamole y jugo natural, fondo oscuro para resaltar colores, iluminación dramática y elegante.",
    },
  ];

  const logoEjemplos = [
    {
      label: "Logo Tradicional Mexicano",
      prompt:
        "Isotipo circular con taco y guacamole, colores verde, rojo y amarillo, estilo plano, fondo transparente, diseño simple pero con identidad mexicana.",
    },
    {
      label: "Logo Minimalista Moderno",
      prompt:
        "Isotipo minimalista con forma circular, ícono de nopal y vaso de jugo, colores negro y naranja, fondo transparente, líneas limpias y modernas.",
    },
    {
      label: "Logo Creativo Ilustrado",
      prompt:
        "Logo circular estilo ilustración vectorial, ícono de taco con hojas de nopal y bebida, colores vibrantes (verde, naranja, crema), fondo transparente, detalles divertidos y llamativos.",
    },
  ];

  const coverPresetsByCategory = {
    taquería: [
      "Foto cálida con mesa de madera, tacos al pastor, salsas y limones, luz natural",
      "Trompo de pastor y plancha al fondo, estilo moderno, fondo desenfocado",
      "Rústico con tortillas, guacamole y refrescos, colores naranja y verde",
    ],
    jugos: [
      "Frutas frescas y vasos de jugo con hielo, fondo claro, luz natural",
      "Barra de jugos con licuadora y vasos, estilo moderno, limpio",
      "Close-up de naranjas, zanahorias y betabel, tonos vibrantes",
    ],
    barbería: [
      "Sillón de barbero, herramientas metálicas, luz dramática, look vintage",
      "Corte a navaja con toalla caliente, ambiente cálido",
      "Mostrador con tijeras y peines, estilo minimalista y limpio",
    ],
    gimnasio: [
      "Pesas y mancuernas en primer plano, fondo de sala de entrenamiento",
      "Persona atando agujetas sobre piso de goma, luz de estudio",
      "Barras y discos, estilo moderno, tonos oscuros",
    ],
  };
  const logoPresetsByCategory = {
    taquería: [
      {
        sample: "Isotipo minimalista de taco, fondo transparente, verde y rojo",
        icon: "taco",
        colors: "verde y rojo",
      },
      {
        sample: "Símbolo circular con nopal, estilo plano, verde y crema",
        icon: "nopal",
        colors: "verde y crema",
      },
      {
        sample: "Imagotipo con trompo de pastor, fondo sólido claro",
        icon: "trompo de pastor",
        colors: "naranja y café",
      },
    ],
    jugos: [
      {
        sample: "Isotipo de vaso con popote y fruta, fondo transparente",
        icon: "vaso de jugo",
        colors: "naranja y verde",
      },
      {
        sample: "Símbolo circular con naranja rebanada, estilo plano",
        icon: "naranja rebanada",
        colors: "naranja y blanco",
      },
      {
        sample: "Imagotipo con licuadora sencilla, fondo sólido claro",
        icon: "licuadora",
        colors: "verde y amarillo",
      },
    ],
    barbería: [
      {
        sample: "Isotipo de navaja barbera, fondo transparente",
        icon: "navaja barbera",
        colors: "negro y plata",
      },
      {
        sample: "Símbolo circular con peine y tijeras, estilo plano",
        icon: "peine y tijeras",
        colors: "negro y dorado",
      },
      {
        sample: "Imagotipo con columna de barbería, fondo sólido",
        icon: "columna de barbería",
        colors: "rojo, azul y blanco",
      },
    ],
    gimnasio: [
      {
        sample: "Isotipo de mancuerna minimalista, fondo transparente",
        icon: "mancuerna",
        colors: "gris y negro",
      },
      {
        sample: "Símbolo circular con barra y discos, estilo plano",
        icon: "barra con discos",
        colors: "negro y rojo",
      },
      {
        sample: "Imagotipo con silueta corriendo, fondo sólido",
        icon: "silueta corriendo",
        colors: "azul y negro",
      },
    ],
  };

  const normalizeCategory = (str) => (str || "").toLowerCase().trim();
  const currentCat = normalizeCategory(business?.categoria);
  const coverChips =
    coverPresetsByCategory[currentCat] || coverPresetsByCategory.taquería || [];
  const logoChips =
    logoPresetsByCategory[currentCat] || logoPresetsByCategory.taquería || [];

  const buildCoverPrompt = () => {
    const nombre = business?.nombre || "tu negocio";
    const categoria = business?.categoria || "negocio local";
    const elementos =
      coverElements?.trim() || "productos/servicios principales";
    const colores = coverColors?.trim() || "colores coherentes con la marca";
    return `Banner horizontal estilo fotográfico para el negocio "${nombre}" (categoría: ${categoria}). Mostrar: ${elementos}. Estilo: ${coverStyle}. Iluminación: ${coverLight}. Colores principales: ${colores}. Composición limpia, espacio para título, sin texto dentro de la imagen. Alta resolución.`;
  };

  const buildLogoPrompt = () => {
    const nombre = business?.nombre || "tu negocio";
    const icono = logoIcon?.trim() || "símbolo relacionado al negocio";
    const colores = logoColors?.trim() || "colores de marca";
    return `Logo ${logoDetail.toLowerCase()} tipo ${logoType.toLowerCase()} para "${nombre}". Ícono principal: ${icono}. Forma: ${logoShape.toLowerCase()}. Colores: ${colores}. Fondo ${logoBg.toLowerCase()}. Estilo plano, legible incluso a 128×128, sin texto dentro del gráfico.`;
  };

  const coverPlaceholder = `Banner horizontal estilo fotográfico para el negocio “${
    business?.nombre || "tu negocio"
  }” (categoría: ${
    business?.categoria || "negocio local"
  }). Mostrar productos/servicios principales. Estilo: [cálido | moderno | rústico]. Iluminación: [natural | estudio]. Colores: [principal 1, 2]. Composición limpia, espacio para título, sin texto dentro de la imagen. Alta resolución.`;

  const logoPlaceholder = `Logo [moderno | minimalista | vintage] para “${
    business?.nombre || "tu negocio"
  }”. Ícono: [describe el ícono principal]. Forma: [círculo | cuadrado | isotipo]. Colores: [primarios]. Fondo [transparente | sólido]. Evitar texto dentro del gráfico. Estilo plano, legible incluso a 128×128.`;

  // ===== Estado Promos (nuevo flujo con tabla promociones)
  const [promociones, setPromociones] = useState([]);
  const [promoActiva, setPromoActiva] = useState(null);

  // 🔒 control anti-doble click + UI
  const [isSavingPromotion, setIsSavingPromotion] = useState(false);
  const [promoSaveStep, setPromoSaveStep] = useState(""); // "Subiendo imagen…" / "Guardando…"
  const [pendingPromoId, setPendingPromoId] = useState(null);

  const [promo, setPromo] = useState({
    titulo: "",
    descripcion: "",
    fecha_inicio: "",
    fecha_fin: "",
    imagen_file: null,
    imagen_url: null,
  });
  const [previewImage, setPreviewImage] = useState(null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState(null);
  // Modal edición promoción
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [imagenActual, setImagenActual] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Cierra el modal cuando se sale del modo edición
  useEffect(() => {
    if (!modoEdicion && editingPromotion === null) {
      setIsEditOpen(false);
    }
  }, [modoEdicion, editingPromotion]);

  const removePromoImage = () => {
    if (promoImagePreview?.preview)
      URL.revokeObjectURL(promoImagePreview.preview);
    setPromoImagePreview(null);
    setPromocionImagen(null);
  };

  const handleEliminarImagenGaleria = async (url) => {
    if (!ensureCanEdit()) return;
    const nuevasUrls = (business.gallery_images || []).filter(
      (img) => img !== url
    );
    const { error } = await supabase
      .from("negocios")
      .update({ gallery_images: nuevasUrls })
      .eq("id", business.id);
    if (error) {
      console.error("❌ Error al eliminar imagen de galería:", error.message);
    } else {
      setBusiness((prev) => ({ ...prev, gallery_images: nuevasUrls }));
      toast({ title: "Imagen eliminada de la galería" });
    }
  };

  // ------ Promos: actualizar (también con loading para evitar dobles clics)
  const [isUpdatingPromotion, setIsUpdatingPromotion] = useState(false);
  const actualizarPromocion = async () => {
    if (isUpdatingPromotion) return;
    if (!ensureCanEdit()) {
      setIsUpdatingPromotion(false);
      return;
    }
    setIsUpdatingPromotion(true);

    let nuevaImagenUrl = promo.imagen_url;

    if (!editingPromotion) {
      toast({
        title: "Error",
        description: "No hay promoción seleccionada para editar.",
        variant: "destructive",
      });
      setIsUpdatingPromotion(false);
      return;
    }

    try {
      if (promo.imagen_file) {
        setPromoSaveStep("Subiendo imagen…");
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("promociones")
          .upload(`imagen_${Date.now()}`, promo.imagen_file, {
            cacheControl: "3600",
            upsert: false,
          });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("promociones")
          .getPublicUrl(uploadData.path);
        nuevaImagenUrl = urlData.publicUrl;
      }

      setPromoSaveStep("Guardando…");
      const { error: updateError } = await supabase
        .from("promociones")
        .update({
          titulo: promo.titulo,
          descripcion: promo.descripcion,
          fecha_inicio: promo.fecha_inicio,
          fecha_fin: promo.fecha_fin,
          imagen_url: nuevaImagenUrl,
        })
        .eq("id", editingPromotion);

      if (updateError) throw updateError;

      toast({
        title: "✅ Promoción actualizada",
        description: "Se guardaron los cambios correctamente.",
      });

      setModoEdicion(false);
      setEditingPromotion(null);
      setPromo({
        titulo: "",
        descripcion: "",
        fecha_inicio: "",
        fecha_fin: "",
        imagen_file: null,
        imagen_url: null,
      });
      setPreviewImage(null);

      await fetchPromocionesActivas();
      await fetchPromociones();
    } catch (error) {
      console.error("❌ Error al actualizar promoción:", error.message);
      toast({
        title: "Error al actualizar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setPromoSaveStep("");
      setIsUpdatingPromotion(false);
    }
  };

  // ============================
  // Cargar negocio (SAFE) + plan
  // ============================
  useEffect(() => {
    const run = async () => {
      try {
        // 1) Query params del retorno de Mercado Pago
        const planFromUrl = (params.get("plan") || "").toLowerCase(); // pro | premium
        const paidSuccess =
          (params.get("paid") || "").toLowerCase() === "success";
        const emailFromUrl = params.get("email") || null;

        // 2) Checar sesión de forma segura (sin lanzar error)
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData?.session || null;
        const userId = session?.user?.id || null;
        const userEmail = session?.user?.email || null;
        setCurrentUserId(userId || null);

        setHasSession(!!session);
        setSessionEmail(userEmail || null);

        // 3.1) Traer plan desde profiles (prioridad para la UI)
        if (session && userId) {
          try {
            const { data: prof, error: profErr } = await supabase
              .from("profiles")
              .select("plan_type")
              .eq("id", userId)
              .single();
            if (!profErr) {
              setProfilePlan(String(prof?.plan_type || ""));
            } else {
              setProfilePlan("");
            }
          } catch {
            setProfilePlan("");
          }
        } else {
          setProfilePlan("");
        }

        // 3) Si no hay sesión y regresamos de pago → CTA login
        if (!session) {
          if (paidSuccess && emailFromUrl) setShouldShowLoginCta(true);
          setAuthChecked(true);
          return;
        }

        // 4) Con sesión: buscar el negocio por user_id de forma segura
        let negocio = null;

        if (userId) {
          const { data, error } = await supabase
            .from("negocios")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle();

          if (error) {
            console.error("[MiNegocio] Error cargando negocio por user_id", error);
          } else {
            negocio = data || null;
          }
        }

        // 5) Si no se encontró por user_id, intentar por email (URL > sesión)
        if (!negocio) {
          const emailLookup = (emailFromUrl || userEmail || "").toLowerCase().trim();

          if (emailLookup) {
            const { data: byEmail, error: emailErr } = await supabase
              .from("negocios")
              .select("*")
              .eq("email", emailLookup)
              .maybeSingle();

            if (emailErr) {
              console.error("[MiNegocio] Error cargando negocio por email", emailErr);
            } else if (byEmail) {
              negocio = byEmail;

              // Si el negocio es PRO/PREMIUM y aún no tiene user_id, lo ligamos
              const planLowerEmail = (byEmail.plan_type || "").toLowerCase();
              const isPaidPlanEmail =
                planLowerEmail === "pro" || planLowerEmail === "premium";

              if (isPaidPlanEmail && userId && !byEmail.user_id) {
                try {
                  await supabase
                    .from("negocios")
                    .update({ user_id: userId })
                    .eq("id", byEmail.id);

                  negocio.user_id = userId;
                } catch (linkErr) {
                  console.error(
                    "[MiNegocio] Error ligando negocio a user_id por email",
                    linkErr
                  );
                }
              }
            }
          }
        }


        // 6) Aplicar plan si venía en la URL (y difiere)
        if (negocio && (planFromUrl === "pro" || planFromUrl === "premium")) {
          if ((negocio.plan_type || "").toLowerCase() !== planFromUrl) {
            const { data: updated, error: upErr } = await supabase
              .from('negocios')
              .update({
                plan_type: planFromUrl,
                updated_at: new Date().toISOString(),
              })
              .eq('id', negocio.id)
              .select()
              .single();
            if (!upErr && updated) {
              negocio = updated;
            }
          }
        }

        // 7) Normalizar negocio + asegurar dueño PRO/PREMIUM
        if (negocio) {
          const planLower = (negocio.plan_type || "").toLowerCase();

          // Solo si es PRO/PREMIUM y falta user_id, lo ligamos al usuario actual
          if (
            (planLower === "pro" || planLower === "premium") &&
            userId &&
            !negocio.user_id
          ) {
            await supabase
              .from('negocios')
              .update({ user_id: userId })
              .eq('id', negocio.id);
            negocio.user_id = userId;
          }

          const ownerId = negocio.user_id || negocio.owner_user_id || null;
          const isPaidPlan = planLower === "pro" || planLower === "premium";

          const isOwner = ownerId && userId && ownerId === userId;
          const isUnclaimed = !ownerId;
          const isPaidOwner = isPaidPlan && isOwner;

          // Solo el dueño de un plan Pro/Premium puede editar
          setCanEditBusiness(!!isPaidOwner);

          setBusiness({
            id: negocio.id,
            ...negocio,
            servicios: Array.isArray(negocio.servicios)
              ? negocio.servicios.join(", ")
              : negocio.servicios || "",
            video_url: negocio.video_embed_url || negocio.video_url || "",
            video_embed_url: negocio.video_embed_url || "",
          });
        } else {
          // No hay negocio asociado al usuario autenticado
          setCanEditBusiness(false);
        }

        // 8) Limpia la URL si venías de pago
        if (paidSuccess) {
          const clean = new URL(window.location.href);
          clean.searchParams.delete("paid");
          clean.searchParams.delete("plan");
          clean.searchParams.delete("email");
          window.history.replaceState({}, "", clean.toString());
        }
      } catch (e) {
        console.warn("fetch negocio (safe) error:", e);
      } finally {
        setAuthChecked(true);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // ------- Promoción activa (última)
  const [promocion, setPromocion] = useState(null);
  useEffect(() => {
    const fetchPromocion = async () => {
      if (!business?.id) return;
      const { data, error } = await supabase
        .from("promociones")
        .select("*")
        .eq("negocio_id", business.id)
        .order("fecha_inicio", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && data) setPromocion(data);
      else setPromocion(null);
    };
    if (business?.id) fetchPromocion();
  }, [business?.id]);

  // ------- Listas promociones (USAR business.id)
  const fetchPromociones = async () => {
    if (!business?.id) return;
    const { data, error } = await supabase
      .from("promociones")
      .select("*")
      .eq("negocio_id", business.id)
      .order("fecha_inicio", { ascending: false });
    if (error) {
      console.error("Error al cargar promociones:", error.message);
      return;
    }
    setPromociones((data || []).map(mapPromo));
    if (data && data.length > 0) setPromoActiva(data[0]);
    else setPromoActiva(null);
  };
  useEffect(() => {
    if (business?.id) fetchPromociones();
  }, [business?.id]);

  const [promocionesActivas, setPromocionesActivas] = useState([]);
  const fetchPromocionesActivas = async () => {
    if (!business?.id) return;
    const { data, error } = await supabase
      .from("promociones")
      .select("*")
      .eq("negocio_id", business.id);
    if (!error) setPromocionesActivas((data || []).map(mapPromo));
  };
  useEffect(() => {
    if (business?.id) fetchPromocionesActivas();
  }, [business?.id]);

  // Guardar promoción (tabla promociones) — con bloqueo y upsert por id
  const subirImagenPromocion = async (file) => {
    const { blob, filename } = await compressToWebP(file, {
      maxWidth: 1200,
      maxKB: 300,
    });

    const path = `promociones/${filename}`;
    const { error: uploadError } = await supabase.storage
      .from("promociones")
      .upload(path, blob, { contentType: "image/webp", upsert: true });
    if (uploadError) throw uploadError;

    const { data: publicURL } = supabase.storage
      .from("promociones")
      .getPublicUrl(path);
    return publicURL.publicUrl;
  };

  const handleSavePromocion = async () => {
    if (isSavingPromotion) return;
    if (!business?.id) {
      toast({
        title: "Sin negocio",
        description: "No se encontró el ID del negocio.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (!promo?.titulo || !promo?.fecha_inicio || !promo?.fecha_fin) {
        toast({
          title: "Campos incompletos",
          description: "Faltan título o fechas",
          variant: "destructive",
        });
        return;
      }

      setIsSavingPromotion(true);
      setPromoSaveStep(promo.imagen_file ? "Subiendo imagen…" : "Guardando…");

      const promoId = pendingPromoId || uuidv4();
      if (!pendingPromoId) setPendingPromoId(promoId);

      let imageUrl = promo.imagen_url || null;
      if (promo.imagen_file) {
        imageUrl = await subirImagenPromocion(promo.imagen_file);
      }

      setPromoSaveStep("Guardando…");

      if (!ensureCanEdit()) {
        setIsSavingPromotion(false);
        setPromoSaveStep("");
        return;
      }

      const { error } = await supabase.from("promociones").upsert(
        [
          {
            id: promoId,
            negocio_id: business.id,
            titulo: promo.titulo,
            descripcion: promo.descripcion,
            fecha_inicio: promo.fecha_inicio,
            fecha_fin: promo.fecha_fin,
            imagen_url: imageUrl,
          },
        ],
        { onConflict: "id" }
      );

      if (error) throw error;

      toast({ title: "✅ Promoción guardada correctamente" });
      setPromo({
        titulo: "",
        descripcion: "",
        fecha_inicio: "",
        fecha_fin: "",
        imagen_file: null,
        imagen_url: null,
      });
      setPreviewImage(null);
      setPendingPromoId(null);
      setPromoSaveStep("");

      fetchPromocionesActivas();
      fetchPromociones();
    } catch (error) {
      console.error("❌ Error:", error.message);
      toast({
        title: "Error al guardar promoción",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSavingPromotion(false);
      setPromoSaveStep("");
    }
  };

  // Editar y eliminar promos
  const handleEditPromo = (p) => {
    setModoEdicion(true);
    setEditingPromotion(p.id);
    setPromo({
      titulo: p.titulo || p.promocion_titulo || "",
      descripcion: p.descripcion || p.promocion_descripcion || "",
      fecha_inicio: p.fecha_inicio || p.promocion_inicio || "",
      fecha_fin: p.fecha_fin || p.promocion_vigencia || "",
      imagen_file: null,
      imagen_url: p.imagen_url || p.promocion_imagen || null,
    });
    setPreviewImage(p.imagen_url || p.promocion_imagen || null);
    setIsEditOpen(true);
  };

  const closeEdit = () => {
    setIsEditOpen(false);
    setModoEdicion(false);
    setEditingPromotion(null);
    setPromo({
      titulo: "",
      descripcion: "",
      fecha_inicio: "",
      fecha_fin: "",
      imagen_file: null,
      imagen_url: null,
    });
    setPreviewImage(null);
  };

  const handleDeletePromocion = async (promocionId) => {
    if (!ensureCanEdit()) return;
    try {
      const { error } = await supabase
        .from("promociones")
        .delete()
        .eq("id", promocionId);
      if (error) throw error;
      fetchPromocionesActivas();
      fetchPromociones();
      toast({ title: "Promoción eliminada correctamente." });
    } catch (error) {
      console.error("Error al eliminar promoción:", error.message);
      toast({
        title: "Error al eliminar la promoción.",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Eliminar promoción del negocio (campo plano en negocios)
  const handleDeletePromotion = async () => {
    if (!ensureCanEdit()) return;
    try {
      const { error } = await supabase
        .from("negocios")
        .update({
          promocion_titulo: "",
          promocion_imagen: "",
          promocion_vigencia: "",
          promocion_descripcion: "",
        })
        .eq("id", business.id);
      if (error) throw error;

      setBusiness((prev) => ({
        ...prev,
        promocion_titulo: "",
        promocion_imagen: "",
        promocion_vigencia: "",
        promocion_descripcion: "",
      }));
      toast({
        title: "Promoción eliminada",
        description: "La promoción activa fue borrada correctamente.",
      });
    } catch (error) {
      console.error("Error al eliminar promoción:", error);
      toast({
        title: "Error al eliminar promoción",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Guardar cambios (update directo por user_id) — USAR getSession SAFE
  const handleSubmit = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) {
      alert("Usuario no autenticado.");
      return;
    }
    if (!business.id) {
      alert("No se encontró el ID del negocio.");
      return;
    }

    const serviciosArrayForSave = Array.isArray(business.servicios)
      ? business.servicios
      : typeof business.servicios === "string"
      ? business.servicios
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const { data, error } = await supabase
      .from('negocios')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) console.error('[MiNegocio] Error cargando negocio', error);
    if (error || !data) {
      alert("Error al actualizar negocio.");
      return;
    }

    // Aquí deberías proceder con la actualización si necesario, este bloque solo muestra cómo obtener el negocio de forma segura.
    setBusiness(data);
    alert("Negocio actualizado correctamente");
  };

  // Subida de portada/logo
  const handleUpload = async (e, campo) => {
    const file = e.target.files[0];
    if (!file || !user) return;
    if (!ensureCanEdit()) return;

    const isLogo = campo === "logo_url";
    const { blob, filename } = await compressToWebP(file, {
      maxWidth: isLogo ? 512 : 1600,
      maxKB: isLogo ? 200 : 400,
    });

    const filePath = `${user.id}/${filename}`;
    const bucketName = isLogo ? "logos" : "portadas";

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, blob, { contentType: "image/webp", upsert: true });
    if (uploadError) {
      console.error("❌ Error al subir imagen:", uploadError.message);
      return;
    }

    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);
    const urlFinal = urlData.publicUrl;

    const { error: updateError } = await supabase
      .from("negocios")
      .update({ [campo]: urlFinal })
      .eq("id", business.id);

    if (updateError) {
      console.error(`❌ Error al actualizar ${campo}:`, updateError.message);
    } else {
      setBusiness((prev) => ({ ...prev, [campo]: urlFinal }));
    }
  };

  // Eliminar portada/logo
  const handleDeletePortada = async () => {
    if (!business.id) return;
    try {
      if (!ensureCanEdit()) return;
      const { error: updateError } = await supabase
        .from("negocios")
        .update({ portada_url: null })
        .eq("id", business.id);
      if (updateError) throw updateError;
      setBusiness((prev) => ({ ...prev, portada_url: "" }));
      toast({ title: "Portada eliminada correctamente." });
    } catch (error) {
      console.error("Error al eliminar la portada:", error.message);
      toast({ title: "Error al eliminar la portada.", variant: "destructive" });
    }
  };
  const handleDeleteLogo = async () => {
    if (!business.id) return;
    try {
      if (!ensureCanEdit()) return;
      const { error: updateError } = await supabase
        .from("negocios")
        .update({ logo_url: null })
        .eq("id", business.id);
      if (updateError) throw updateError;
      setBusiness((prev) => ({ ...prev, logo_url: "" }));
      toast({ title: "Logo eliminado correctamente." });
    } catch (error) {
      console.error("Error al eliminar el logo:", error.message);
      toast({ title: "Error al eliminar el logo.", variant: "destructive" });
    }
  };

  // IA descripción (Edge function) mejorada: autoguarda en Supabase la descripción generada
  const handleGenerateAI = async () => {
    if (isGeneratingDesc) return;
    if (!ensureCanEdit()) return;
    // Verificación estricta: IA solo para plan Premium
    if (planName !== "premium") {
      toast({
        title: "Función Premium",
        description:
          "La generación con IA de la descripción solo está disponible en el Plan Premium.",
        variant: "destructive",
      });
      return;
    }

    // Solo requerimos nombre; servicios es opcional
    if (!business.nombre) {
      toast({
        title: "Falta el nombre",
        description:
          "Completa el campo 'Nombre' antes de generar la descripción.",
        variant: "destructive",
      });
      return;
    }

    console.log("[IA] Click en Generar descripción con IA", {
      nombre: business.nombre,
      categoria: business.categoria,
      servicios: business.servicios,
    });

    setIsGeneratingDesc(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "generate-description",
        {
          body: {
            nombre: business.nombre,
            categoria: business.categoria || "negocio local",
            servicios: business.servicios || "",
          },
        }
      );

      if (error) {
        console.error("Edge Function error:", error);
        toast({
          title: "Error al generar",
          description: error.message || "No se pudo generar la descripción.",
          variant: "destructive",
        });
        return;
      }

      const descripcion = (data?.descripcion || "").trim();
      if (!descripcion) {
        toast({
          title: "Error al generar",
          description: "La función no devolvió una descripción.",
          variant: "destructive",
        });
        return;
      }

      // 1) Reflejar en UI
      setBusiness((prev) => ({ ...prev, descripcion }));

      // 2) Guardar de inmediato en la base de datos
      if (business?.id) {
        const { error: updateError } = await supabase
          .from("negocios")
          .update({ descripcion })
          .eq("id", business.id);

        if (updateError) {
          console.error(
            "❌ No se pudo guardar automáticamente:",
            updateError.message
          );
          toast({
            title: "Descripción generada",
            description:
              "Se rellenó el texto, pero no se pudo guardar automáticamente. Da clic en “Guardar cambios”.",
            variant: "destructive",
          });
          return;
        }
      }

      toast({
        title: "Descripción generada",
        description: "Guardada en tu negocio ✅",
      });
    } catch (err) {
      console.error("Fetch error:", err);
      toast({
        title: "Error de comunicación",
        description: "No se pudo contactar la función de Supabase.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingDesc(false);
    }
  };

  // IA imágenes (Edge function)
  const callImageGenerator = async (kind, prompt) => {
    if (!["cover", "logo"].includes(kind)) {
      toast({
        title: "Tipo de generación inválido",
        description: "Tipo de generación inválido.",
        variant: "destructive",
      });
      return;
    }
    if (!ensureCanEdit()) return;
    if (planName !== "premium") {
      toast({
        title: "Función Premium",
        description:
          "La generación con IA de portada y logo solo está disponible para el Plan Premium.",
        variant: "destructive",
      });
      return;
    }
    if (!business?.id) {
      toast({
        title: "Sin ID de negocio",
        description: "No se encontró el ID del negocio.",
        variant: "destructive",
      });
      return;
    }

    try {
      const payload = { businessId: business.id, kind, prompt: prompt || "" };

      const { data, error } = await supabase.functions.invoke(
        "generate-image",
        {
          body: payload,
        }
      );

      if (error) {
        throw new Error(
          data?.error || error.message || "No se pudo generar la imagen."
        );
      }

      if (kind === "cover") {
        setBusiness((prev) => ({
          ...prev,
          portada_url: data?.url || prev.portada_url,
        }));
        toast({
          title: "Portada generada",
          description: "Se actualizó la portada del negocio.",
        });
      } else {
        setBusiness((prev) => ({
          ...prev,
          logo_url: data?.url || prev.logo_url,
        }));
        toast({
          title: "Logo generado",
          description: "Se actualizó el logo del negocio.",
        });
      }
    } catch (e) {
      console.error("invoke(generate-image) error:", e);
      toast({
        title: "Error al generar imagen",
        description:
          e.message || "Error al comunicar con el generador de imágenes.",
        variant: "destructive",
      });
    }
  };

  const handleGenerateCoverAI = async () => {
    const preset = (selectedCoverPreset || "").trim();
    const prompt = preset
      ? preset
      : useSimpleCover
      ? buildCoverPrompt()
      : (aiCoverPrompt || "").trim();
    try {
      setLoadingCover(true);
      await callImageGenerator("cover", prompt);
    } finally {
      setLoadingCover(false);
    }
  };
  const handleGenerateLogoAI = async () => {
    const preset = (selectedLogoPreset || "").trim();
    const prompt = preset
      ? preset
      : useSimpleLogo
      ? buildLogoPrompt()
      : (aiLogoPrompt || "").trim();
    try {
      setLoadingLogo(true);
      await callImageGenerator("logo", prompt);
    } finally {
      setLoadingLogo(false);
    }
  };

  // Ubicación actual
  const handleSetCurrentLocation = () => {
    if (!ensureCanEdit()) return;
    if (!navigator.geolocation) {
      alert("Tu navegador no soporta geolocalización.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const embedUrl = `https://www.google.com/maps?q=${latitude},${longitude}&hl=es&z=14&output=embed`;
        await supabase
          .from("negocios")
          .update({ mapa_embed_url: embedUrl })
          .eq("id", business.id);
        setBusiness({ ...business, mapa_embed_url: embedUrl });
        alert("Ubicación actual guardada correctamente.");
      },
      (error) => {
        if (error.code === 1) {
          alert("Debes permitir acceso a tu ubicación.");
        } else {
          alert("Error al obtener la ubicación.");
        }
      }
    );
  };

  // Helpers mapa: extraer lat/lng y abrir direcciones
  // ——— WhatsApp helpers (normalizar/validar y link de vista previa) ———
  const normalizeWhats = (s = "") => {
    const digits = String(s).replace(/\D/g, "");
    if (!digits) return "";
    // si son 10 dígitos, asumimos MX y anteponemos +52
    if (digits.length === 10) return "+52" + digits;
    if (
      digits.startsWith("52") &&
      (digits.length === 12 || digits.length === 13)
    )
      return "+" + digits.replace(/^\+/, "");
    return digits.startsWith("+") ? digits : "+" + digits;
  };
  const isValidWhats = (s = "") =>
    /^(?:\+)?\d{7,15}$/.test(String(s).replace(/\s/g, ""));
  const toWaLink = (s = "") => {
    const normalized = normalizeWhats(s);
    const onlyDigits = normalized.replace(/\D/g, "");
    return onlyDigits ? `https://wa.me/${onlyDigits}` : null;
  };
  const extractLatLngFromEmbed = (url = "") => {
    try {
      // Formatos soportados:
      // 1) https://www.google.com/maps?q=LAT,LNG&... (o &amp;)
      // 2) https://www.google.com/maps/@LAT,LNG,ZOOMz...
      const decoded = decodeURIComponent(url).replace(/&amp;/g, "&");
      let m = decoded.match(/maps\?q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i);
      if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
      m = decoded.match(/maps\/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i);
      if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
      return null;
    } catch {
      return null;
    }
  };

  const buildDirectionsUrl = () => {
    const coords = extractLatLngFromEmbed(business?.mapa_embed_url || "");
    if (coords) {
      const dest = `${coords.lat},${coords.lng}`;
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        dest
      )}`;
    }
    if (business?.direccion) {
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        business.direccion
      )}`;
    }
    return null;
  };

  const buildExternalMapLinks = () => {
    const coords = extractLatLngFromEmbed(business?.mapa_embed_url || "");
    const address = (business?.direccion || "").trim();
    const name = (business?.nombre || "Destino").trim();

    // Uber deep link builder
    const uberFromCoords = (lat, lng) =>
      `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${lat}&dropoff[longitude]=${lng}&dropoff[nickname]=${encodeURIComponent(
        name
      )}`;
    const uberFromAddress = (addr) =>
      `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=${encodeURIComponent(
        addr
      )}&dropoff[nickname]=${encodeURIComponent(name)}`;

    // Didi (universal fallback). Intentará abrir la app; si no, redirige a landing.
    const didiFromCoords = (lat, lng) =>
      `https://page.didiglobal.com/passenger/landing?dropoff_latitude=${lat}&dropoff_longitude=${lng}&utm_source=iztapamarket`;
    const didiFromAddress = (addr) =>
      `https://page.didiglobal.com/passenger/landing?dropoff_address=${encodeURIComponent(
        addr
      )}&utm_source=iztapamarket`;

    if (coords) {
      const { lat, lng } = coords;
      return {
        google: `https://www.google.com/maps/dir/?api=1&destination=${lat}%2C${lng}`,
        waze: `https://waze.com/ul?ll=${lat}%2C${lng}&navigate=yes`,
        uber: uberFromCoords(lat, lng),
        didi: didiFromCoords(lat, lng),
      };
    }

    if (address) {
      const q = encodeURIComponent(address);
      return {
        google: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
        waze: `https://waze.com/ul?q=${q}&navigate=yes`,
        uber: uberFromAddress(address),
        didi: didiFromAddress(address),
      };
    }

    return { google: null, waze: null, uber: null, didi: null };
  };

  const copyAddressToClipboard = async () => {
    const text =
      (business?.direccion || "").trim() ||
      (extractLatLngFromEmbed(business?.mapa_embed_url || "")
        ? `${extractLatLngFromEmbed(business.mapa_embed_url).lat},${
            extractLatLngFromEmbed(business.mapa_embed_url).lng
          }`
        : "");
    if (!text) {
      alert("No hay dirección o coordenadas para copiar.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      alert("Dirección copiada al portapapeles.");
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      alert("Dirección copiada al portapapeles.");
    }
  };

  const handleClearMap = async () => {
    try {
      if (!ensureCanEdit()) return;
      await supabase
        .from("negocios")
        .update({ mapa_embed_url: "" })
        .eq("id", business.id);
      setBusiness((prev) => ({ ...prev, mapa_embed_url: "" }));
      alert("Mapa eliminado.");
    } catch (e) {
      console.error("No se pudo eliminar el mapa:", e?.message || e);
      alert("Error al eliminar el mapa.");
    }
  };

  // Eliminar negocio
  const handleDeleteBusiness = async () => {
    const confirmDelete = confirm(
      "⚠️ ¿Estás seguro de que deseas eliminar permanentemente este negocio? Esta acción no se puede deshacer."
    );
    if (!confirmDelete) return;
    if (!ensureCanEdit()) return;
    const { error } = await supabase
      .from("negocios")
      .delete()
      .eq("id", business.id);
    if (!error) {
      alert("Negocio eliminado permanentemente.");
      window.location.href = "/negocios";
    } else {
      alert("Error al eliminar el negocio.");
    }
  };

  // Guardar cambios (upsert con slug)
  const handleSave = async () => {
    try {
      const { data: s } = await supabase.auth.getSession();
      const userData = s?.session?.user || null;
      if (!userData) {
        console.error("❌ No se pudo obtener el usuario");
        alert("No se pudo obtener el usuario.");
        return;
      }
      if (!ensureCanEdit()) return;

      const safeBusiness = {
        ...business,
        id: business.id ?? "",
        categoria: business.categoria ?? "",
      };

      let slugGenerado = safeBusiness.slug;
      if (!safeBusiness.slug || safeBusiness.slug.trim() === "") {
        slugGenerado = safeBusiness.nombre
          .toLowerCase()
          .replace(/\s+/g, "-")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
      }

      const serviciosArrayForSave = Array.isArray(safeBusiness.servicios)
        ? safeBusiness.servicios
        : typeof safeBusiness.servicios === "string"
        ? safeBusiness.servicios
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      const updates = {
        nombre: safeBusiness.nombre || "",
        descripcion: safeBusiness.descripcion || "",
        servicios: serviciosArrayForSave,
        telefono: safeBusiness.telefono || "",
        whatsapp: safeBusiness.whatsapp || "",
        direccion: safeBusiness.direccion || "",
        mapa_embed_url: safeBusiness.mapa_embed_url || "",
        instagram: safeBusiness.instagram || "",
        facebook: safeBusiness.facebook || "",
        tiktok: safeBusiness.tiktok || "",
        web: safeBusiness.web || "",
        portada_url: safeBusiness.portada_url || "",
        logo_url: safeBusiness.logo_url || "",
        video_embed_url: safeBusiness.video_embed_url || "",
        promocion_imagen: safeBusiness.promocion_imagen || "",
        promocion_titulo: safeBusiness.promocion_titulo || "",
        promocion_fecha: safeBusiness.promocion_fecha || "",
        visitas: safeBusiness.visitas || 0,
        clics: safeBusiness.clics || 0,
        categoria: safeBusiness.categoria || "",
        slug_categoria: safeBusiness.categoria
          ? safeBusiness.categoria.toLowerCase().replace(/\s+/g, "-")
          : "",
        plan_type: safeBusiness.plan_type || "free",
        gallery_images: safeBusiness.gallery_images || [],
        services: safeBusiness.services || [],
        imagen_url: safeBusiness.imagen_url || "",
        menu: safeBusiness.menu || "",
        email: safeBusiness.email || "",
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("negocios")
        .upsert({ ...safeBusiness, ...updates, slug: slugGenerado })
        .eq("user_id", userData.id)
        .select();

      if (error) {
        console.error("❌ Error al guardar cambios:", error.message);
        alert("No se pudieron guardar los cambios");
      } else {
        alert("✅ Cambios guardados exitosamente.");
      }
    } catch (err) {
      console.error("❌ Error inesperado:", err);
      alert("Ocurrió un error inesperado.");
    }
  };

  // Update negocio (payload limpio) — USAR getSession SAFE
  const handleUpdateBusiness = async () => {
    const { data: s } = await supabase.auth.getSession();
    const userObj = s?.session?.user || null;
    if (!userObj) {
      alert("Usuario no autenticado.");
      return;
    }
    if (!business.id) {
      alert("No se encontró el ID del negocio.");
      return;
    }
    if (!ensureCanEdit()) return;

    const serviciosArray = business.servicios
      ? business.servicios
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    let updateObj = {
      nombre: business.nombre,
      descripcion: business.descripcion,
      servicios: serviciosArray,
      telefono: business.telefono,
      whatsapp: business.whatsapp,
      direccion: business.direccion,
      mapa_embed_url: business.mapa_embed_url,
      instagram: business.instagram,
      facebook: business.facebook,
      tiktok: business.tiktok,
      web: business.web,
      portada_url: business.portada_url,
      logo_url: business.logo_url,
      video_embed_url: business.video_embed_url,
      promocion_imagen: business.promocion_imagen,
      promocion_titulo: business.promocion_titulo,
      promocion_fecha: business.promocion_fecha,
      visitas: business.visitas,
      clics: business.clics,
      categoria: business.categoria,
      slug_categoria: business.categoria
        ? business.categoria.toLowerCase().replace(/\s+/g, "-")
        : "",
      plan_type: business.plan_type,
      gallery_images: business.gallery_images,
      services: business.services,
      imagen_url: business.imagen_url,
      menu: business.menu,
      email: business.email,
    };
    Object.keys(updateObj).forEach((key) => {
      if (updateObj[key] === undefined) delete updateObj[key];
    });

    try {
      const { error } = await supabase
        .from("negocios")
        .update(updateObj)
        .eq("id", business.id);
      if (error) {
        console.error("Error al actualizar negocio:", error.message);
        alert("Error al actualizar negocio.");
        return;
      }
      const { data: updatedBusiness, error: fetchError } = await supabase
        .from("negocios")
        .select("*")
        .eq("id", business.id)
        .single();
      if (fetchError) {
        alert("Negocio actualizado pero no se pudo refrescar el formulario.");
        return;
      }
      if (updatedBusiness) {
        setBusiness({
          ...updatedBusiness,
          servicios: Array.isArray(updatedBusiness.servicios)
            ? updatedBusiness.servicios.join(", ")
            : updatedBusiness.servicios || "",
          portada_url: updatedBusiness.portada_url || "",
          logo_url: updatedBusiness.logo_url || "",
          video_url:
            updatedBusiness.video_embed_url || updatedBusiness.video_url || "",
          video_embed_url: updatedBusiness.video_embed_url || "",
        });
      }
      alert("Negocio actualizado correctamente");
    } catch (err) {
      console.error("Error inesperado:", err);
      alert("Ocurrió un error inesperado.");
    }
  };

  // =========================
  // Menú (Premium + Alimentos/Bebidas)
  // =========================
  const FOOD_KEYWORDS = [
    "alimentos y bebidas",
    "alimentos",
    "bebidas",
    "comida",
    "comidas",
    "restaurante",
    "restaurant",
    "taquería",
    "taqueria",
    "cafetería",
    "cafe",
    "bar",
    "jugos",
    "pastelería",
    "pizzeria",
    "pizzería",
  ];
  const isFoodCategory =
    FOOD_KEYWORDS.some((k) =>
      normalizeCategory(business?.categoria).includes(normalizeCategory(k))
    ) || (business?.slug_categoria || "").includes("alimentos-y-bebidas");

  const [isSavingMenu, setIsSavingMenu] = useState(false);
  const isLikelyUrl = (txt) => {
    if (!txt) return false;
    try {
      const u = new URL(txt.trim());
      return !!u.protocol && !!u.host;
    } catch {
      return false;
    }
  };
  const handleSaveMenu = async () => {
    if (!business?.id) {
      toast({
        title: "Sin negocio",
        description: "No se encontró el ID del negocio.",
        variant: "destructive",
      });
      return;
    }
    if (!ensureCanEdit()) {
      setIsSavingMenu(false);
      return;
    }
    setIsSavingMenu(true);
    try {
      const { error } = await supabase
        .from("negocios")
        .update({ menu: business.menu || "" })
        .eq("id", business.id);
      if (error) throw error;
      toast({ title: "Menú guardado correctamente." });
    } catch (e) {
      toast({
        title: "Error al guardar el menú",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setIsSavingMenu(false);
    }
  };

  // Video YouTube
  const [isSavingVideo, setIsSavingVideo] = useState(false);
  const handleSaveVideo = async () => {
    if (!ensureCanEdit()) return;
    if (!business.id || !business.video_url) return;
    setIsSavingVideo(true);
    try {
      const embedUrl = convertYouTubeUrlToEmbed(business.video_url.trim());
      const { error } = await supabase
        .from("negocios")
        .update({ video_embed_url: embedUrl })
        .eq("id", business.id);
      if (error) throw error;
      setBusiness((prev) => ({
        ...prev,
        video_url: business.video_url,
        video_embed_url: embedUrl,
      }));
      toast({ title: "Video guardado correctamente." });
    } catch (error) {
      console.error("Error al guardar el video:", error.message);
      toast({ title: "Error al guardar el video.", variant: "destructive" });
    } finally {
      setIsSavingVideo(false);
    }
  };
  const extractYouTubeId = (url) => {
    const regex = /(?:youtube\.com.*(?:\?|&)v=|youtu\.be\/)([^;&#\s]+)/;
    const match = url.match(regex);
    return match ? match[1] : "";
  };
  const getYouTubeEmbedSrc = (url) => {
    if (!url) return "";
    if (url.includes("/embed/")) return url;
    const id = extractYouTubeId(url);
    return id ? `https://www.youtube.com/embed/${id}` : "";
  };

 
  // Si el usuario tiene sesión pero aún no tiene negocio creado,
  // mostramos un CTA claro para ir al formulario de registro (cualquier plan)
  if (
    authChecked &&
    hasSession &&
    !business.id &&
    !showMinimalForm
  ) {
    const planSafe = (planName || "free").toUpperCase();
    return (
      <div className="p-6 max-w-3xl mx-auto bg-white shadow-lg rounded-lg border border-gray-200">
        <h1 className="text-2xl font-bold mb-4 text-gray-800">Mi negocio</h1>
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-green-800">
          <p className="font-semibold">
            Tu plan <span className="uppercase">{planSafe}</span> ya está listo. ✅
          </p>
          <p>
            Solo falta que registres los datos de tu negocio para aparecer en IztapaMarket.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowMinimalForm(true)}
          className="inline-flex items-center px-4 py-2 rounded-lg bg-orange-500 text-white font-semibold hover:bg-orange-600"
        >
          Crear mi negocio ahora
        </button>
        <p className="mt-3 text-xs text-gray-500">
          Si ya tenías un negocio y no aparece, escríbenos a WhatsApp para ayudarte.
        </p>
      </div>
    );
  }

  // Construir URL de login preservando plan/paid/email
  const emailParam = params.get("email") || "";
  const planParam = params.get("plan") || "";
  const paidParam = params.get("paid") || "";

  const redirectSearch = new URLSearchParams();
  if (planParam) redirectSearch.set("plan", planParam);
  if (paidParam) redirectSearch.set("paid", paidParam);
  if (emailParam) redirectSearch.set("email", emailParam);

  const redirectTarget = redirectSearch.toString()
    ? `/mi-negocio?${redirectSearch.toString()}`
    : "/mi-negocio";

  const loginUrl = `/login?redirect=${encodeURIComponent(
    redirectTarget
  )}&email=${encodeURIComponent(emailParam)}`;
 
  return (
    <div className="p-6 max-w-3xl mx-auto bg-white shadow-lg rounded-lg border border-gray-200">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">
        Mi negocio: {business.nombre}
      </h1>
      {/* ✨ Sello rápido del plan (no invasivo) */}
      {(() => {
        if (badgeLoading) return null;

        const plan = (planName || badgeNegocio?.plan_type || "free").toLowerCase();
        const isPro = plan === "pro";
        const isPremium = plan === "premium";

        if (isPremium) {
          return (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
              ✨ Estás en <b>Plan Premium</b>. Ya puedes usar todas las funciones.
            </div>
          );
        }

        if (isPro) {
          return (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-blue-800">
              ⭐ Estás en <b>Plan Pro</b>. Algunas funciones avanzadas requieren Premium.
            </div>
          );
        }

        return (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
            🆓 Estás en <b>Plan Free</b>. Para promociones y video, mejora a Premium.
          </div>
        );
      })()}

      {/* Mensaje cuando volvemos de Mercado Pago sin sesión */}
      {authChecked && shouldShowLoginCta && !hasSession && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded mb-4">
          <p className="mb-2">
            Acabas de completar tu pago. Para habilitar tu formulario, inicia
            sesión con el correo <strong>{params.get("email")}</strong>.
          </p>
          <a
            href={loginUrl}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Iniciar sesión
          </a>
        </div>
      )}

      {/* Mensajes por plan */}
      {planName === "free" && (
        <div className="bg-yellow-100 border border-yellow-300 text-yellow-800 px-4 py-2 rounded mb-4">
          Estás en el <strong>Plan Gratuito</strong>. Tu negocio aparece como ficha básica de gancho.
          Para administrar galería, promociones, IA y más, actualiza a <strong>Pro</strong> o <strong>Premium</strong>.
        </div>
      )}
      {planName === "pro" && (
        <div className="bg-blue-100 border border-blue-300 text-blue-800 px-4 py-2 rounded mb-4">
          Estás en el <strong>Plan Pro</strong>. Tienes acceso a redes sociales,
          galería de imágenes y descripción de tu negocio (sin IA).
        </div>
      )}
      {planName === "premium" && (
        <div className="bg-green-100 border border-green-300 text-green-800 px-4 py-2 rounded mb-4">
          Estás en el <strong>Plan Premium</strong>. Tienes acceso completo:
          redes sociales, galería, video, promociones y generación con IA
          (descripción, portada y logo).
        </div>
      )}

      {/* Guard rails de edición: explica por qué no puede editar (solo si ya hay negocio) */}
      {authChecked && business.id && !canEditBusiness && (() => {
        const ownerId = business?.user_id || business?.owner_user_id || null;
        const hasOwner = !!ownerId;
        const isFree = planName === "free";

        // Caso 1: negocio free sin dueño → solo lectura amigable
        if (isFree && !hasOwner) {
          return (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <p className="font-semibold">
                Este negocio está en plan gratuito y en modo solo lectura.
              </p>
              <p>
                Para administrarlo desde aquí y desbloquear más opciones, puedes
                contratar un plan Pro o Premium.
              </p>
            </div>
          );
        }

        // Caso 2: hay dueño distinto al usuario actual → mensaje rojo
        if (hasOwner && hasSession) {
          return (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <p className="font-semibold">Solo el dueño puede editar este perfil.</p>
              <p>
                Estás conectado como <strong>{sessionEmail}</strong>, pero este negocio
                está ligado a otra cuenta. Si crees que es un error o deseas reclamarlo,
                contáctanos por WhatsApp y lo revisamos contigo.
              </p>
            </div>
          );
        }

        // Caso 3: sin sesión → pedir login
        if (!hasSession) {
          return (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <p className="font-semibold">Inicia sesión para administrar tu negocio.</p>
              <p>
                Usa la misma cuenta con la que contrataste tu plan Pro o Premium. Si ya
                hiciste tu pago y no puedes acceder, contáctanos por WhatsApp.
              </p>
            </div>
          );
        }

        return null;
      })()}

      {/* Información general */}
      {["free", "pro", "premium"].includes(planName) && (
        <>
          <h2 className="text-xl font-semibold text-gray-900 mt-4">
            Información general
          </h2>
          <div className="h-px bg-gray-200 my-3" />

          {showMinimalForm ? (
            <BusinessForm
              plan={planName || "free"}
              mode="minimal"
            />
          ) : (
            <>
              <label>Nombre</label>
              <Input
                type="text"
                name="nombre"
                value={business.nombre || ""}
                onChange={(e) =>
                  setBusiness({ ...business, nombre: e.target.value })
                }
              />

              <label>Dirección</label>
              <Input
                type="text"
                name="direccion"
                value={business.direccion || ""}
                onChange={(e) =>
                  setBusiness({ ...business, direccion: e.target.value })
                }
              />

              <label>Teléfono</label>
              <Input
                type="text"
                name="telefono"
                value={business.telefono || ""}
                onChange={(e) =>
                  setBusiness({ ...business, telefono: e.target.value })
                }
              />
              {/* WhatsApp (opcional) */}
              <label className="mt-2 block">WhatsApp (opcional)</label>
              <Input
                type="tel"
                name="whatsapp"
                placeholder="+52 55 1234 5678"
                value={business.whatsapp || ""}
                onChange={(e) =>
                  setBusiness({ ...business, whatsapp: e.target.value })
                }
                onBlur={(e) => {
                  const v = normalizeWhats(e.target.value);
                  if (v && v !== business.whatsapp)
                    setBusiness((prev) => ({ ...prev, whatsapp: v }));
                }}
              />
              <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                <span>
                  Ingresa tu número con lada internacional. Si dejas vacío, solo se
                  mostrará el botón de llamada.
                </span>
                {isValidWhats(business.whatsapp) && (
                  <a
                    href={toWaLink(business.whatsapp)}
                    target="_blank"
                    rel="noreferrer"
                    className="underline text-green-700"
                    title="Probar enlace de WhatsApp"
                  >
                    Probar WhatsApp
                  </a>
                )}
              </div>

              {/* Mapa / Ubicación (solo Pro y Premium) */}
              {(planName === "pro" || planName === "premium") && (
                <>
                  <h2 className="text-xl font-semibold text-gray-900 mt-6">
                    Mapa y ubicación
                  </h2>
                  <div className="h-px bg-gray-200 my-3" />

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={handleSetCurrentLocation}
                      className="bg-green-600 text-white hover:bg-green-700"
                    >
                      Usar mi ubicación actual
                    </Button>
                    {(() => {
                      const links = buildExternalMapLinks();
                      return (
                        <>
                          {links.google && (
                            <a
                              href={links.google}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-3 py-2 rounded border text-blue-700 border-blue-300 hover:bg-blue-50"
                              title="Abrir indicaciones en Google Maps"
                            >
                              Google Maps
                            </a>
                          )}
                          {links.waze && (
                            <a
                              href={links.waze}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-3 py-2 rounded border text-purple-700 border-purple-300 hover:bg-purple-50"
                              title="Abrir en Waze"
                            >
                              Waze
                            </a>
                          )}
                          {links.uber && (
                            <a
                              href={links.uber}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-3 py-2 rounded border text-black border-gray-300 hover:bg-gray-50"
                              title="Pedir Uber"
                            >
                              Uber
                            </a>
                          )}
                          {links.didi && (
                            <a
                              href={links.didi}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-3 py-2 rounded border text-orange-700 border-orange-300 hover:bg-orange-50"
                              title="Abrir DiDi (beta)"
                            >
                              DiDi
                            </a>
                          )}
                          {(links.google ||
                            links.waze ||
                            links.uber ||
                            links.didi) && (
                            <Button
                              type="button"
                              onClick={copyAddressToClipboard}
                              variant="outline"
                              className="text-gray-700"
                              title="Copiar dirección o coordenadas"
                            >
                              Copiar dirección
                            </Button>
                          )}
                        </>
                      );
                    })()}
                    {business.mapa_embed_url && (
                      <Button
                        type="button"
                        onClick={handleClearMap}
                        variant="destructive"
                        className="text-white"
                        title="Quitar mapa embebido"
                      >
                        Quitar mapa
                      </Button>
                    )}
                  </div>

                  {/* Preview del mapa si existe */}
                  {business.mapa_embed_url ? (
                    <div className="mt-3 rounded-lg overflow-hidden border">
                      <iframe
                        src={(business.mapa_embed_url || "").replace(/&amp;/g, "&")}
                        title="Mapa del negocio"
                        className="w-full"
                        style={{ height: 320 }}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-gray-500">
                      Aún no hay mapa embebido. Pulsa "Usar mi ubicación actual" o
                      guarda tu dirección y usa "Abrir en Google Maps".
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}

      {/* Descripción */}
      {(planName === "pro" || planName === "premium") && (
        <>
          <h2 className="text-xl font-semibold text-gray-900 mt-6">
            Descripción del negocio
          </h2>
          <div className="h-px bg-gray-200 my-3" />
          <Textarea
            placeholder="Describe tu negocio, productos o servicios..."
            value={business.descripcion || ""}
            onChange={(e) =>
              setBusiness((prev) => ({ ...prev, descripcion: e.target.value }))
            }
          />
          {/* Campo de servicios para habilitar IA */}
          <label className="mt-3 block text-sm font-medium text-gray-700">
            Servicios (separados por coma)
          </label>
          <Input
            type="text"
            placeholder="tacos al pastor, alambres, aguas frescas"
            value={business.servicios || ""}
            onChange={(e) =>
              setBusiness((prev) => ({ ...prev, servicios: e.target.value }))
            }
          />
          {planName === "premium" && (
            <>
              <Button
                id="ai-generate"
                type="button"
                className="mt-2 bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
                onClick={handleGenerateAI}
                disabled={isGeneratingDesc}
                aria-busy={isGeneratingDesc ? "true" : "false"}
              >
                {isGeneratingDesc
                  ? "Generando..."
                  : "Generar descripción con IA"}
              </Button>
              <p className="text-xs text-gray-500 mt-1">
                Disponible solo en el <strong>Plan Premium</strong>
              </p>
            </>
          )}
        </>
      )}

      {/* Redes + Galería */}
      {(planName === "pro" || planName === "premium") && (
        <>
          <h2 className="text-xl font-semibold text-gray-900 mt-8">
            Redes sociales
          </h2>
          <div className="h-px bg-gray-200 my-3" />
          <label>Instagram</label>
          <Input
            type="text"
            name="instagram"
            value={business.instagram || ""}
            onChange={(e) =>
              setBusiness({ ...business, instagram: e.target.value })
            }
          />
          <label>Facebook</label>
          <Input
            type="text"
            name="facebook"
            value={business.facebook || ""}
            onChange={(e) =>
              setBusiness({ ...business, facebook: e.target.value })
            }
          />
          <label>TikTok</label>
          <Input
            type="text"
            name="tiktok"
            value={business.tiktok || ""}
            onChange={(e) =>
              setBusiness({ ...business, tiktok: e.target.value })
            }
          />
          <label>Web</label>
          <Input
            type="text"
            name="web"
            value={business.web || ""}
            onChange={(e) => setBusiness({ ...business, web: e.target.value })}
          />

          {/* Galería (única) */}
          <h2 className="text-xl font-semibold text-gray-900 mt-8">Galería</h2>
          <div className="h-px bg-gray-200 my-3" />
          <div className="mb-4">
            <Label className="font-semibold mb-2 block">
              Galería de imágenes
            </Label>
            <input
              id="gallery-files"
              type="file"
              accept="image/*"
              multiple
              onChange={handleGallerySelection}
              className="hidden"
            />
            <label
              htmlFor="gallery-files"
              aria-describedby="gallery-status"
              className="inline-flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-md cursor-pointer hover:bg-orange-600"
            >
              <Upload className="w-4 h-4" />
              Elegir archivos
            </label>
            <p id="gallery-status" className="mt-2 text-xs text-gray-500">
              {selectedImages.length > 0
                ? `${selectedImages.length} seleccionada(s)`
                : "Sin archivos seleccionados"}
            </p>
            {selectedImages.length > 0 && (
              <div className="flex flex-wrap gap-4 mt-4">
                {selectedImages.map((img, index) => (
                  <div key={index} className="relative">
                    <img
                      src={img.preview}
                      alt={`preview-${index}`}
                      className="w-32 h-32 object-cover rounded border"
                    />
                  </div>
                ))}
              </div>
            )}
            <Button
              type="button"
              onClick={handleUploadGallery}
              className="mt-2"
            >
              Guardar imágenes seleccionadas
            </Button>
            <div className="flex flex-wrap mt-2">
              {(business.gallery_images || []).map((url, index) => (
                <div
                  key={index}
                  className="relative inline-block m-2 border rounded overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => handleEliminarImagenGaleria(url)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full px-2 z-10"
                  >
                    ❌
                  </button>
                  <img
                    src={url}
                    alt={`Galería ${index}`}
                    className="w-32 h-32 object-cover rounded"
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ========================= */}
      {/* Menú (solo Premium + food/drink) */}
      {/* ========================= */}
      {planName === "premium" && isFoodCategory && (
        <>
          <h2 className="text-xl font-semibold text-gray-900 mt-8">Menú</h2>
          <div className="h-px bg-gray-200 my-3" />
          <p className="text-xs text-gray-600 mb-2">
            Pega tu menú como texto (un platillo por línea) o coloca un enlace a
            tu menú (PDF, Google Drive, web).
          </p>
          <Textarea
            placeholder={
              "Ej.:\nTacos al pastor — $30\nAgua de horchata — $25\nhttps://tu-sitio.com/menu.pdf"
            }
            value={business.menu || ""}
            onChange={(e) => setBusiness({ ...business, menu: e.target.value })}
          />
          <div className="mt-2 flex gap-2 items-center">
            <Button onClick={handleSaveMenu} disabled={isSavingMenu}>
              {isSavingMenu ? "Guardando..." : "Guardar menú"}
            </Button>
            {isLikelyUrl(business.menu) && (
              <a
                href={business.menu}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline text-sm"
              >
                Abrir menú en nueva pestaña
              </a>
            )}
          </div>
          {/* Preview básico */}
          <div className="mt-3">
            {!isLikelyUrl(business.menu) ? (
              <ul className="list-disc list-inside text-sm text-gray-700 bg-gray-50 p-3 rounded">
                {(business.menu || "")
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
              </ul>
            ) : (
              <div className="text-xs text-gray-500">
                Detecté un enlace. El visor embebido puede no funcionar para
                enlaces privados; de ser así, usa el botón “Abrir menú”.
              </div>
            )}
          </div>
        </>
      )}

      {/* Video (único, solo Premium) */}
      {planName === "premium" && (
        <>
          <h2 className="text-xl font-semibold text-gray-900 mt-8">Video</h2>
          <div className="h-px bg-gray-200 my-3" />
          <div className="mt-4">
            <div className="space-y-2">
              <Label
                htmlFor="youtube_video_url"
                className="text-base font-semibold text-gray-700"
              >
                Enlace de video de YouTube (embed)
              </Label>
              <Input
                id="youtube_video_url"
                type="text"
                placeholder="https://www.youtube.com/embed/tu-video"
                value={business.video_url || ""}
                onChange={(e) =>
                  setBusiness({ ...business, video_url: e.target.value })
                }
              />
              {/* Preview del video usando video_embed_url */}
              {business.video_embed_url && (
                <div className="aspect-video mt-4 rounded-md overflow-hidden border shadow-sm">
                  <iframe
                    src={business.video_embed_url}
                    title={`Video de ${business.nombre}`}
                    className="w-full h-full"
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              )}
              <Button
                className="mt-2"
                onClick={handleSaveVideo}
                disabled={isSavingVideo}
              >
                {isSavingVideo ? "Guardando..." : "Guardar video"}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Imágenes (portada/logo + IA) */}
      <h2 className="text-xl font-semibold text-gray-900 mt-8">Imágenes</h2>
      <div className="h-px bg-gray-200 my-3" />
      <div className="flex gap-8 mb-4 items-end">
        {/* Portada */}
        <div>
          <label>Portada</label>
          {business.portada_url ? (
            <img
              src={`${business.portada_url}?t=${Date.now()}`}
              alt="portada"
              className="w-full max-w-xs border rounded"
            />
          ) : (
            <p className="text-sm text-orange-500 italic">No hay imagen</p>
          )}
          <input
            type="file"
            accept="image/*"
            id="portadaInput"
            style={{ display: "none" }}
            onChange={(e) => handleUpload(e, "portada_url")}
          />
          <Button
            className="mt-2 bg-orange-500 text-white hover:bg-orange-600"
            onClick={() => document.getElementById("portadaInput").click()}
          >
            Cambiar portada
          </Button>

          {planName === "premium" && (
            <details className="mt-2 border border-gray-200 rounded-lg">
              <summary className="px-4 py-2 bg-orange-500 text-white font-medium rounded-md cursor-pointer hover:bg-orange-600 select-none">
                Opciones de portada (IA)
              </summary>
              <div className="px-3 pb-3 pt-2">
                <Label className="mt-3 block text-sm">
                  Personaliza tu imagen (opcional)
                </Label>
                <div className="flex items-center gap-2 text-xs text-gray-600 mt-1">
                  <input
                    id="cover-advanced"
                    type="checkbox"
                    checked={!useSimpleCover}
                    onChange={(e) => setUseSimpleCover(!e.target.checked)}
                  />
                  <label
                    htmlFor="cover-advanced"
                    style={{ display: "flex", alignItems: "center" }}
                  >
                    Modo avanzado (texto libre){" "}
                    <span
                      style={{ marginLeft: 5, cursor: "help", fontSize: 13 }}
                    >
                      ❓
                    </span>
                  </label>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Modo simple: llena los campos y yo armo el prompt. Modo
                  avanzado: escribe tu idea libremente.
                </p>

                {useSimpleCover ? (
                  <div className="mt-2 space-y-2">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label className="text-xs">Estilo</Label>
                        <select
                          className="w-full border rounded p-1 text-sm"
                          value={coverStyle}
                          onChange={(e) => setCoverStyle(e.target.value)}
                        >
                          <option>Moderno</option>
                          <option>Cálido</option>
                          <option>Rústico</option>
                          <option>Minimalista</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs">Iluminación</Label>
                        <select
                          className="W-full border rounded p-1 text-sm"
                          value={coverLight}
                          onChange={(e) => setCoverLight(e.target.value)}
                        >
                          <option>Natural</option>
                          <option>Estudio</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label className="text-xs">
                          Colores (coma separados)
                        </Label>
                        <Input
                          className="text-sm"
                          placeholder="naranja, verde"
                          value={coverColors}
                          onChange={(e) => setCoverColors(e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Elementos a mostrar</Label>
                      <Input
                        className="text-sm"
                        placeholder="tacos, jugos, mostrador"
                        value={coverElements}
                        onChange={(e) => setCoverElements(e.target.value)}
                      />
                    </div>
                    <p className="text-[11px] text-gray-500">
                      Sugerencias para:{" "}
                      <strong>{business?.categoria || "general"}</strong>
                    </p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {coverChips.map((ex, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="text-xs px-2 py-1 rounded border hover:bg-orange-50"
                          onClick={() => setCoverElements(ex)}
                          title={`Sugerencia de portada para ${
                            business?.categoria || "tu negocio"
                          }`}
                        >
                          {ex}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2">
                      <Label className="text-xs">
                        Elegir sugerencia rápida
                      </Label>
                      <select
                        className="w-full border rounded p-1 text-sm"
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v) setCoverElements(v);
                        }}
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Selecciona un ejemplo
                        </option>
                        {coverChips.map((ex, idx) => (
                          <option key={idx} value={ex}>
                            {ex}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-2">
                      <Label className="text-xs">
                        Plantilla rápida (portada)
                      </Label>
                      <select
                        className="w-full border rounded p-1 text-sm"
                        value={selectedCoverPreset}
                        onChange={(e) => {
                          const v = e.target.value;
                          setSelectedCoverPreset(v);
                          if (v) {
                            setUseSimpleCover(false);
                            setAiCoverPrompt(v);
                          } else {
                            setUseSimpleCover(true);
                            setAiCoverPrompt("");
                          }
                        }}
                      >
                        <option value="">— Sin plantilla —</option>
                        {portadaEjemplos.map((p, i) => (
                          <option key={i} value={p.prompt}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <>
                    <Textarea
                      rows={2}
                      placeholder={coverPlaceholder}
                      value={aiCoverPrompt}
                      onChange={(e) => setAiCoverPrompt(e.target.value)}
                    />
                    <p className="text-[11px] text-gray-500 mt-1">
                      Tip: escribe estilo, colores y elementos. Evita pedir
                      texto dentro de la imagen.
                    </p>
                  </>
                )}

                <Button
                  variant="outline"
                  className="mt-2 ml-2"
                  onClick={handleGenerateCoverAI}
                  disabled={
                    loadingCover ||
                    !isPremiumPlan ||
                    !!business?.ai_portada_used
                  }
                  title={
                    !isPremiumPlan
                      ? "Disponible solo en plan Premium"
                      : business?.ai_portada_used
                      ? "La generación de portada con IA ya fue utilizada para este negocio"
                      : "Generar portada con IA"
                  }
                >
                  {loadingCover ? "Generando..." : "Generar portada (IA)"}
                </Button>

                {business?.ai_portada_used ? (
                  <div className="mt-1 text-xs text-red-600 flex items-center gap-2">
                    <span>
                      🚫 Ya usaste tu generación de <strong>portada</strong> con
                      IA (Usos restantes: 0 de 1)
                    </span>
                    <a
                      href={SUPPORT_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline"
                    >
                      Contactar soporte
                    </a>
                  </div>
                ) : (
                  <div className="mt-1 text-xs text-green-600">
                    ✅ Usos IA restantes: 1 de 1
                  </div>
                )}

                <Button
                  variant="destructive"
                  className="mt-1 text-white"
                  onClick={handleDeletePortada}
                >
                  Eliminar portada
                </Button>
              </div>
            </details>
          )}
        </div>

        {/* Logo */}
        <div>
          <label>Logo</label>
          {business.logo_url ? (
            <img
              src={`${business.logo_url}?t=${Date.now()}`}
              alt="logo"
              className="w-20 border rounded"
            />
          ) : (
            <p className="text-sm text-orange-500 italic">No hay imagen</p>
          )}
          <input
            type="file"
            accept="image/*"
            id="logoInput"
            style={{ display: "none" }}
            onChange={(e) => handleUpload(e, "logo_url")}
          />
          <Button
            className="mt-2 bg-orange-500 text-white hover:bg-orange-600"
            onClick={() => document.getElementById("logoInput").click()}
          >
            Cambiar logo
          </Button>

          {planName === "premium" && (
            <details className="mt-2 border border-gray-200 rounded-lg">
              <summary className="px-4 py-2 bg-orange-500 text-white font-medium rounded-md cursor-pointer hover:bg-orange-600 select-none">
                Opciones de logo (IA)
              </summary>
              <div className="px-3 pb-3 pt-2">
                <Label className="mt-3 block text-sm">
                  Personaliza tu logo (opcional)
                </Label>
                <div className="flex items-center gap-2 text-xs text-gray-600 mt-1">
                  <input
                    id="logo-advanced"
                    type="checkbox"
                    checked={!useSimpleLogo}
                    onChange={(e) => setUseSimpleLogo(!e.target.checked)}
                  />
                  <label
                    htmlFor="logo-advanced"
                    style={{ display: "flex", alignItems: "center" }}
                  >
                    Modo avanzado (texto libre){" "}
                    <span
                      style={{ marginLeft: 5, cursor: "help", fontSize: 13 }}
                    >
                      ❓
                    </span>
                  </label>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Modo simple: elige tipo, forma e ícono y yo armo el prompt.
                  Modo avanzado: escribe tu idea.
                </p>

                {useSimpleLogo ? (
                  <div className="mt-2 space-y-2">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label className="text-xs">Tipo de logo</Label>
                        <select
                          className="w-full border rounded p-1 text-sm"
                          value={logoType}
                          onChange={(e) => setLogoType(e.target.value)}
                        >
                          <option>Isotipo</option>
                          <option>Imagotipo</option>
                          <option>Símbolo</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs">Forma</Label>
                        <select
                          className="w-full border rounded p-1 text-sm"
                          value={logoShape}
                          onChange={(e) => setLogoShape(e.target.value)}
                        >
                          <option>Circular</option>
                          <option>Cuadrado</option>
                          <option>Libre</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label className="text-xs">Ícono principal</Label>
                        <Input
                          className="text-sm"
                          placeholder="taco, nopal, jugo"
                          value={logoIcon}
                          onChange={(e) => setLogoIcon(e.target.value)}
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs">Colores</Label>
                        <Input
                          className="text-sm"
                          placeholder="negro y naranja"
                          value={logoColors}
                          onChange={(e) => setLogoColors(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label className="text-xs">Fondo</Label>
                        <select
                          className="w-full border rounded p-1 text-sm"
                          value={logoBg}
                          onChange={(e) => setLogoBg(e.target.value)}
                        >
                          <option>Transparente</option>
                          <option>Sólido</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs">Detalle</Label>
                        <select
                          className="w-full border rounded p-1 text-sm"
                          value={logoDetail}
                          onChange={(e) => setLogoDetail(e.target.value)}
                        >
                          <option>Minimalista</option>
                          <option>Medio</option>
                        </select>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-500">
                      Sugerencias para:{" "}
                      <strong>{business?.categoria || "general"}</strong>
                    </p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {logoChips.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="text-xs px-2 py-1 rounded border hover:bg-orange-50"
                          onClick={() => {
                            setLogoIcon(p.icon);
                            setLogoColors(p.colors);
                          }}
                          title={`Sugerencia de logo para ${
                            business?.categoria || "tu negocio"
                          }`}
                        >
                          {p.sample}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2">
                      <Label className="text-xs">
                        Elegir sugerencia rápida
                      </Label>
                      <select
                        className="w-full border rounded p-1 text-sm"
                        onChange={(e) => {
                          const idx = e.target.value;
                          if (idx !== "") {
                            const p = logoChips[Number(idx)];
                            if (p) {
                              setLogoIcon(p.icon);
                              setLogoColors(p.colors);
                            }
                          }
                        }}
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Selecciona un ejemplo
                        </option>
                        {logoChips.map((p, idx) => (
                          <option key={idx} value={idx}>
                            {p.sample}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-2">
                      <Label className="text-xs">Plantilla rápida (logo)</Label>
                      <select
                        className="w-full border rounded p-1 text-sm"
                        value={selectedLogoPreset}
                        onChange={(e) => {
                          const v = e.target.value;
                          setSelectedLogoPreset(v);
                          if (v) {
                            setUseSimpleLogo(false);
                            setAiLogoPrompt(v);
                          } else {
                            setUseSimpleLogo(true);
                            setAiLogoPrompt("");
                          }
                        }}
                      >
                        <option value="">— Sin plantilla —</option>
                        {logoEjemplos.map((p, i) => (
                          <option key={i} value={p.prompt}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <>
                    <Textarea
                      rows={2}
                      placeholder={logoPlaceholder}
                      value={aiLogoPrompt}
                      onChange={(e) => setAiLogoPrompt(e.target.value)}
                    />
                    <p className="text-[11px] text-gray-500 mt-1">
                      Tip: describe ícono, forma, colores y fondo. Evita texto
                      dentro del logo.
                    </p>
                  </>
                )}

                <Button
                  variant="outline"
                  className="mt-2 ml-2"
                  onClick={handleGenerateLogoAI}
                  disabled={
                    loadingLogo || !isPremiumPlan || !!business?.ai_logo_used
                  }
                  title={
                    !isPremiumPlan
                      ? "Disponible solo en plan Premium"
                      : business?.ai_logo_used
                      ? "La generación de logo con IA ya fue utilizada para este negocio"
                      : "Generar logo con IA"
                  }
                >
                  {loadingLogo ? "Generando..." : "Generar logo (IA)"}
                </Button>

                {business?.ai_logo_used ? (
                  <div className="mt-1 text-xs text-red-600 flex items-center gap-2">
                    <span>
                      🚫 Ya usaste tu generación de <strong>logo</strong> con IA
                      (Usos restantes: 0 de 1)
                    </span>
                    <a
                      href={SUPPORT_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline"
                    >
                      Contactar soporte
                    </a>
                  </div>
                ) : (
                  <div className="mt-1 text-xs text-green-600">
                    ✅ Usos IA restantes: 1 de 1
                  </div>
                )}

                <Button
                  variant="destructive"
                  className="mt-1 text-white"
                  onClick={handleDeleteLogo}
                >
                  Eliminar logo
                </Button>
              </div>
            </details>
          )}
        </div>
      </div>

      {/* ============================== */}
      {/* Promociones: alta/edición */}
      {/* ============================== */}
      <div className="h-px bg-gray-200 my-6" />
      <h2 className="text-lg font-bold mt-8 text-orange-500">
        🎁 Nueva Promoción
      </h2>
      {planName !== "premium" && (
        <div className="my-3 p-3 rounded bg-yellow-50 border border-yellow-200 text-sm text-yellow-800">
          Las promociones están disponibles solo en el{" "}
          <strong>Plan Premium</strong>. Actualiza tu plan para habilitar este
          formulario.
          <div className="mt-2">
            <a
              href="/precios"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-orange-600 text-white hover:bg-orange-700"
            >
              Mejorar al Plan Premium
            </a>
          </div>
        </div>
      )}

      <div
        className={`mt-2 mb-6 border p-4 rounded-lg bg-orange-50 space-y-4 ${
          isSavingPromotion || planName !== "premium"
            ? "opacity-60 pointer-events-none"
            : ""
        }`}
        aria-disabled={isSavingPromotion || planName !== "premium"}
        title={
          planName !== "premium" ? "Disponible solo en Plan Premium" : undefined
        }
      >
        <div>
          <Label htmlFor="promo-titulo" className="font-semibold block">
            Título de la promoción
          </Label>
          <Input
            id="promo-titulo"
            placeholder="Título de la promoción"
            value={promo?.titulo || ""}
            onChange={(e) =>
              setPromo((prev) => ({ ...prev, titulo: e.target.value }))
            }
            disabled={isSavingPromotion || planName !== "premium"}
          />
        </div>

        <div>
          <Label htmlFor="promo-desc" className="font-semibold block">
            Descripción de la promoción
          </Label>
          <Textarea
            id="promo-desc"
            placeholder="Descripción de la promoción"
            value={promo?.descripcion || ""}
            onChange={(e) =>
              setPromo((prev) => ({ ...prev, descripcion: e.target.value }))
            }
            disabled={isSavingPromotion || planName !== "premium"}
          />
        </div>

        <div>
          <Label htmlFor="promo-img" className="font-semibold block">
            Imagen de la promoción
          </Label>
          <input
            id="promo-img"
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files[0];
              setPromo((prev) => ({ ...prev, imagen_file: file }));
              if (file) setPreviewImage(URL.createObjectURL(file));
            }}
            className="mt-1"
            disabled={isSavingPromotion || planName !== "premium"}
          />
        </div>

        {previewImage && (
          <img
            src={previewImage}
            alt="Vista previa de la promoción"
            className="mt-3 max-h-64 rounded-md shadow"
          />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="promo-fecha-inicio" className="font-semibold block">
              Fecha de inicio
            </Label>
            <Input
              id="promo-fecha-inicio"
              type="date"
              value={promo?.fecha_inicio || ""}
              onChange={(e) =>
                setPromo((prev) => ({ ...prev, fecha_inicio: e.target.value }))
              }
              disabled={isSavingPromotion || planName !== "premium"}
            />
          </div>

          <div>
            <Label htmlFor="promo-fecha-fin" className="font-semibold block">
              Fecha de fin
            </Label>
            <Input
              id="promo-fecha-fin"
              type="date"
              value={promo?.fecha_fin || ""}
              onChange={(e) =>
                setPromo((prev) => ({ ...prev, fecha_fin: e.target.value }))
              }
              disabled={isSavingPromotion || planName !== "premium"}
            />
          </div>
        </div>

        <div className="pt-4 flex items-center gap-3">
          {modoEdicion ? (
            <Button
              type="button"
              onClick={actualizarPromocion}
              className="bg-yellow-500 hover:bg-yellow-600 text-white disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={isUpdatingPromotion || planName !== "premium"}
              title={
                planName !== "premium"
                  ? "Disponible solo en Plan Premium"
                  : undefined
              }
              aria-busy={isUpdatingPromotion}
            >
              {isUpdatingPromotion ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      opacity="0.25"
                    />
                    <path
                      d="M22 12a10 10 0 0 1-10 10"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                  </svg>
                  Guardando…
                </span>
              ) : (
                "Actualizar promoción"
              )}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSavePromocion}
              className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={isSavingPromotion || planName !== "premium"}
              title={
                planName !== "premium"
                  ? "Disponible solo en Plan Premium"
                  : undefined
              }
              aria-busy={isSavingPromotion}
            >
              {isSavingPromotion ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      opacity="0.25"
                    />
                    <path
                      d="M22 12a10 10 0 0 1-10 10"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                  </svg>
                  {promoSaveStep || "Guardando…"}
                </span>
              ) : (
                "Guardar promoción"
              )}
            </Button>
          )}

          {isSavingPromotion && (
            <span className="text-sm text-gray-600">{promoSaveStep}</span>
          )}
        </div>
      </div>

      {/* Lista de promociones activas */}
      <div className="h-px bg-gray-200 my-6" />
      <h2 className="text-xl font-bold mt-10 mb-2 text-red-600">
        ❤️ Promociones Activas
      </h2>
      <div className="space-y-4">
        {promocionesActivas.length === 0 ? (
          <p className="text-gray-500">
            No hay promociones activas registradas.
          </p>
        ) : (
          promocionesActivas.map((p) => (
            <PromoCard
              key={p.id}
              promo={p}
              canDelete={canEditBusiness}
              onDelete={handleDeletePromocion}
              onEdit={handleEditPromo}
            />
          ))
        )}
      </div>

      {isEditOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        >
          <div className="w-full max-w-lg rounded-lg bg-white p-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">Editar promoción</h3>
              <button
                onClick={closeEdit}
                className="text-gray-500 hover:text-gray-800"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium">Título</label>
                <Input
                  value={promo.titulo || ""}
                  onChange={(e) =>
                    setPromo((prev) => ({ ...prev, titulo: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Descripción</label>
                <Textarea
                  value={promo.descripcion || ""}
                  onChange={(e) =>
                    setPromo((prev) => ({
                      ...prev,
                      descripcion: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium">
                    Fecha inicio
                  </label>
                  <Input
                    type="date"
                    value={promo.fecha_inicio || ""}
                    onChange={(e) =>
                      setPromo((prev) => ({
                        ...prev,
                        fecha_inicio: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Fecha fin</label>
                  <Input
                    type="date"
                    value={promo.fecha_fin || ""}
                    onChange={(e) =>
                      setPromo((prev) => ({
                        ...prev,
                        fecha_fin: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              {/* Imagen actual / carga nueva */}
              <div className="space-y-2">
                {previewImage && (
                  <img
                    src={previewImage}
                    alt="Imagen de la promoción"
                    className="w-full max-h-56 object-contain rounded border"
                  />
                )}
                <div>
                  <label className="block text-sm font-medium">
                    Cambiar imagen (opcional)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setPromo((prev) => ({ ...prev, imagen_file: file }));
                      if (file) {
                        const url = URL.createObjectURL(file);
                        setPreviewImage(url);
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={closeEdit}>
                Cancelar
              </Button>
              <Button
                onClick={actualizarPromocion}
                disabled={isUpdatingPromotion}
                className="bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
              >
                {isUpdatingPromotion
                  ? promoSaveStep || "Guardando…"
                  : "Guardar cambios"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Extras UI */}
      {planName === "premium" && (
        <>
          <h2 className="text-xl font-semibold text-gray-900 mt-8">
            Herramientas Premium
          </h2>
          <div className="h-px bg-gray-200 my-3" />
          <div className="mt-8 bg-orange-50 p-4 rounded shadow">
            <h3 className="text-md font-semibold text-orange-600 mb-2">
              Herramientas Premium
            </h3>
            <ul className="text-sm list-disc list-inside text-gray-800">
              <li>✅ SEO keywords personalizadas</li>
              <li>✅ Paquete de marketing</li>
              <li>✅ Video promocional</li>
            </ul>
          </div>
        </>
      )}

      {(planName === "pro" || planName === "premium") && (
        <>
          <h2 className="text-xl font-semibold text-gray-900 mt-8">
            Estadísticas
          </h2>
          <div className="h-px bg-gray-200 my-3" />
          <div className="mt-4 text-sm text-gray-700">
            <p>
              📍 <strong>{business.visitas}</strong> visitas
            </p>
            <p>
              🖱️ <strong>{business.clics}</strong> clics
            </p>
            <p className="text-gray-500 text-xs">
              Disponibles en planes Pro y Premium
            </p>
          </div>
        </>
      )}

      {canEditBusiness && (
        <div className="mt-6 flex flex-col sm:flex-row gap-3 items-start">
          <Button
            onClick={handleUpdateBusiness}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Guardar cambios de negocio
          </Button>
          <Button
            variant="destructive"
            className="text-white"
            onClick={handleDeleteBusiness}
          >
            Eliminar negocio permanentemente
          </Button>
        </div>
      )}
    </div>
  );
};

export default MiNegocioPage;

// Consulta auxiliar (opcional)
export const fetchPromocionByNegocioId = async (negocioId) => {
  const { data, error } = await supabase
    .from("promociones")
    .select("*")
    .eq("negocio_id", negocioId)
    .single();

  if (error) {
    console.error("Error al obtener promoción:", error.message);
    return null;
  }
  return data;
};
