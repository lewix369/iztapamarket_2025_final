// 🔒 VERSIÓN DE PRODUCCIÓN — Lista para iztapamarket.com (misma lógica, pequeños fixes seguros)
import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
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
import { useToast } from "@/components/ui/use-toast";
import { toast as toastify } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// --- Mercado Pago Device ID helper (from security.js) ---
function getMpDeviceId() {
  try {
    if (typeof window !== "undefined" && window.__MP_DEVICE_ID) {
      return window.__MP_DEVICE_ID;
    }
    const g =
      (typeof window !== "undefined" &&
        (window.MP_DEVICE_SESSION_ID || window.deviceId)) ||
      "";
    if (g && typeof window !== "undefined") {
      window.__MP_DEVICE_ID = g;
      return g;
    }
    const el =
      typeof document !== "undefined"
        ? document.getElementById("deviceID")
        : null;
    const v = el && el.value ? String(el.value) : "";
    if (v && typeof window !== "undefined") {
      window.__MP_DEVICE_ID = v;
      return v;
    }
    return "";
  } catch {
    return "";
  }
}

const GOOGLE_API_KEY = "AIzaSyA1yCFzlUpn3Kr38gjt6N4dm2XNHy1eBG8";
const FUNCTIONS_URL =
  import.meta.env.VITE_FUNCTIONS_URL ||
  "https://qjuytjpthaxabjedqoez.functions.supabase.co";

// 🔌 Selector de proveedor para crear preferencia (local backend vs Supabase Function)
const MP_PROVIDER = import.meta.env.VITE_MP_PROVIDER || "local";

// Toggle: require login after payment to finish registration (defaults to true)
const REQUIRE_LOGIN_AFTER_PAYMENT =
  (import.meta.env.VITE_REQUIRE_LOGIN_AFTER_PAYMENT ?? "true")
    .toString()
    .toLowerCase() === "true";

const MP_BASE = import.meta.env.VITE_MP_BASE || "http://127.0.0.1:3001/api";

// (No usadas ahora, pero ok tenerlas)
const getGoogleMapsEmbedUrl = async (nombre, direccion) => {
  const fullQuery = encodeURIComponent(`${nombre}, ${direccion}`);
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${fullQuery}&inputtype=textquery&fields=place_id&key=${GOOGLE_API_KEY}`
    );
    const data = await response.json();
    const placeId = data?.candidates?.[0]?.place_id;
    return placeId
      ? `https://www.google.com/maps/embed/v1/place?key=${GOOGLE_API_KEY}&q=place_id:${placeId}`
      : "";
  } catch {
    return "";
  }
};

const getGooglePlaceImage = async (nombre, direccion) => {
  const fullQuery = encodeURIComponent(`${nombre}, ${direccion}`);
  try {
    const placeRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${fullQuery}&inputtype=textquery&fields=place_id&key=${GOOGLE_API_KEY}`
    );
    const placeData = await placeRes.json();
    const placeId = placeData?.candidates?.[0]?.place_id;
    if (!placeId) return "";

    const detailsRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${GOOGLE_API_KEY}`
    );
    const detailsData = await detailsRes.json();
    const photoRef = detailsData?.result?.photos?.[0]?.photo_reference;
    return photoRef
      ? `https://maps.googleapis.com/maps/api/photo?maxwidth=600&photo_reference=${photoRef}&key=${GOOGLE_API_KEY}`
      : "";
  } catch {
    return "";
  }
};

const normalizePlan = (raw) => {
  const v = (raw || "").toLowerCase();
  if (v === "pro" || v === "premium" || v === "free") return v;
  return "free";
};

const RegisterBusinessPage = () => {
  const [imagenNegocio, setImagenNegocio] = useState(null);
  const [searchParams] = useSearchParams();

  // ✅ Plan y estado de pago (normalizado)
  const savedPlan = (typeof window !== "undefined" && window.localStorage)
    ? (localStorage.getItem("reg_plan") || "")
    : "";
  const selectedPlan = normalizePlan(
    searchParams.get("plan") || savedPlan || "free"
  );
  const rawStatus = (
    searchParams.get("collection_status") ||
    searchParams.get("status") ||
    ""
  )
    .toString()
    .toLowerCase();

  const paidParam = (searchParams.get("paid") || "").toString().toLowerCase();
  const hasPaymentId = !!(
    searchParams.get("payment_id") || searchParams.get("preference_id")
  );
  const isApproved = rawStatus === "approved" || rawStatus === "success";
  const isPaid =
    paidParam === "true" ||
    paidParam === "1" ||
    paidParam === "approved" ||
    paidParam === "success" ||
    isApproved ||
    (hasPaymentId &&
      rawStatus !== "failure" &&
      rawStatus !== "rejected" &&
      rawStatus !== "cancelled");

  // 🆕 Auto-disparo de pago: ?auto=1|true|yes
  const autoParam = (searchParams.get("auto") || "").toLowerCase();
  const autoPay =
    autoParam === "1" || autoParam === "true" || autoParam === "yes";

  const emailFromUrl = (searchParams.get("email") || "").trim();
  const localEmail = (typeof window !== "undefined" && window.localStorage)
    ? (localStorage.getItem("reg_email") || "")
    : "";

  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nombre: "",
    categoria: "",
    telefono: "",
    direccion: "",
    imagen_url: "",
    slug_categoria: "",
    mapa_embed_url: "",
    descripcion: "",
    hours: "",
    services: [],
    gallery_images: [], // <- agregado para evitar undefined
    whatsapp: "",
    email: "",
  });
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState("");

  const [categories, setCategories] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [authUser, setAuthUser] = useState(null);
  const [autoTriggered, setAutoTriggered] = useState(false); // 🆕 evita múltiples disparos

  // 🎯 Corrección: si el email de sesión NO coincide con el email del checkout, avisar y permitir cambiar de cuenta
  const intendedEmail = (
    (formData.email || emailFromUrl || localEmail || "").toString().trim().toLowerCase()
  );
  const sessionEmail = (authUser?.email || "").toString().trim().toLowerCase();
  const emailMismatch = Boolean(intendedEmail && sessionEmail && intendedEmail !== sessionEmail);

  const switchAccountToIntended = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    const dest = `${location.pathname}${location.search || ""}`;
    navigate(`/login?redirect=${encodeURIComponent(dest)}${intendedEmail ? `&email=${encodeURIComponent(intendedEmail)}` : ""}`);
  };

  useEffect(() => {
    // Log básico para verificar flags/endpoint y device id (solo en dev)
    function resolveCreatePrefUrlForLog() {
      const envUrl = (import.meta.env.VITE_CREATE_PREFERENCE_URL || "").trim();
      const mpBase = (import.meta.env.VITE_MP_BASE || "").replace(/\/$/, "");
      const isAbs = /^https?:\/\//i.test(envUrl);
      if (isAbs) return envUrl;
      if (mpBase) return `${mpBase}/create_preference`;
      if (envUrl) {
        const base = (
          typeof window !== "undefined" ? window.location.origin : ""
        ).replace(/\/$/, "");
        return `${base}${envUrl.startsWith("/") ? "" : "/"}${envUrl}`;
      }
      const base = (
        typeof window !== "undefined" ? window.location.origin : ""
      ).replace(/\/$/, "");
      return `${base}/api/create_preference`;
    }
    console.debug("[Registro] mount", {
      selectedPlan,
      isPaid,
      autoPay,
      VITE_CREATE_PREFERENCE_URL: import.meta.env.VITE_CREATE_PREFERENCE_URL,
      VITE_MP_BASE: import.meta.env.VITE_MP_BASE,
      resolved_endpoint: resolveCreatePrefUrlForLog(),
      mp_device_id: getMpDeviceId(),
    });
  }, [selectedPlan, isPaid, autoPay]);

  useEffect(() => {
    // Obtener el usuario actual al montar
    supabase.auth.getUser().then(({ data }) => setAuthUser(data?.user || null));

    // Suscribirse a cambios de sesión (login/logout)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user || null);
    });

    return () => {
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    setCategories([
      "Alimentos y Bebidas",
      "Belleza y Cuidado Personal",
      "Servicios del Hogar",
      "Moda y Tiendas",
      "Mascotas y Veterinarias",
      "Salud y Bienestar",
      "Educación y Escuelas",
      "Autos y Talleres",
      "Tecnología y Electrónica",
      "Otros Negocios",
    ]);
  }, []);

  // Prefill email si vino en la URL o está en localStorage (guardando valores inválidos)
  useEffect(() => {
    const candidate = (emailFromUrl || localEmail || "").trim();
    if (candidate && candidate !== "null" && candidate !== "undefined") {
      setFormData((prev) => ({ ...prev, email: candidate }));
    }
  }, [emailFromUrl, localEmail]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // ⛔️ (El guard de forzar /crear-cuenta fue quitado intencionalmente)

  // 🔗 Navegación centralizada post-registro (premium/pro): ir a /mi-negocio o forzar login con redirect
  const goToBusiness = (emailMaybe) => {
    const fallbackLocal =
      (typeof window !== "undefined" && window.localStorage)
        ? (localStorage.getItem("reg_email") || "")
        : "";
    let emailFinal = (
      (emailMaybe ?? formData.email ?? emailFromUrl ?? fallbackLocal ?? "")
    ).toString().trim();

    if (emailFinal === "null" || emailFinal === "undefined") {
      emailFinal = "";
    }

    if (authUser?.id) {
      navigate("/mi-negocio");
    } else {
      navigate(
        `/login?redirect=${encodeURIComponent("/mi-negocio")}${
          emailFinal ? `&email=${encodeURIComponent(emailFinal)}` : ""
        }`
      );
    }
  };

  // 🆕 Auto-inicio de Mercado Pago si venimos de crear-cuenta con ?auto=1
  // 🔐 Gate: pago aprobado pero sin sesión
  const mustLoginToFinish =
    REQUIRE_LOGIN_AFTER_PAYMENT &&
    (selectedPlan === "pro" || selectedPlan === "premium") &&
    isPaid &&
    !authUser;

  const goLoginToFinish = () => {
    const shouldGoToBusiness = (selectedPlan === "pro" || selectedPlan === "premium") && isPaid;
    const dest = shouldGoToBusiness ? "/mi-negocio" : `${location.pathname}${location.search || ""}`;
    const e = (formData.email || localEmail || "").trim();
    const safeEmail = e && e !== "null" && e !== "undefined" ? e : "";
    navigate(
      `/login?redirect=${encodeURIComponent(dest)}${
        safeEmail ? `&email=${encodeURIComponent(safeEmail)}` : ""
      }`
    );
  };
  // ⛳️ Auto-redirect suave si venimos de pago aprobado sin sesión
  useEffect(() => {
    if (mustLoginToFinish) {
      const t = setTimeout(() => goLoginToFinish(), 0);
      return () => clearTimeout(t);
    }
  }, [mustLoginToFinish]);

  // 🔎 Si ya hay sesión + pago aprobado, verifica si ya existe negocio y redirige al panel
  useEffect(() => {
    const run = async () => {
      if (!authUser) return;
      if (!(selectedPlan === "pro" || selectedPlan === "premium")) return;
      if (!isPaid) return;

      try {
        const effectiveEmail = (formData.email || emailFromUrl || authUser?.email || "").trim().toLowerCase();
        let existing = null;

        // Busca por user_id primero
        const byUser = await supabase
          .from("negocios")
          .select("id")
          .eq("user_id", authUser.id)
          .maybeSingle();
        if (byUser?.data?.id) existing = byUser.data;

        // Si no lo encontró por user_id, intenta por email
        if (!existing && effectiveEmail) {
          const byEmail = await supabase
            .from("negocios")
            .select("id")
            .eq("email", effectiveEmail)
            .maybeSingle();
          if (byEmail?.data?.id) existing = byEmail.data;
        }

        // Si ya existe, manda directo al panel
        if (existing) {
          navigate("/mi-negocio");
        }
      } catch (e) {
        console.debug("[registro] skip auto-goToBusiness check:", e?.message || e);
      }
    };
    run();
  }, [authUser, isPaid, selectedPlan]);
  useEffect(() => {
    if (
      !autoTriggered &&
      autoPay &&
      (selectedPlan === "pro" || selectedPlan === "premium") &&
      !isPaid
    ) {
      const emailToUse =
        formData.email || emailFromUrl || authUser?.email || "";

      if (!emailToUse) return; // falta email; no dispares
      if (formData.email !== emailToUse) {
        setFormData((prev) => ({ ...prev, email: emailToUse }));
      }
      setAutoTriggered(true);
      setTimeout(() => handleCreatePreference(), 100);
    }
  }, [
    autoPay,
    autoTriggered,
    selectedPlan,
    isPaid,
    formData.email,
    emailFromUrl,
    authUser,
  ]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCategoryChange = (value) => {
    const slug = value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-");
    setFormData((prev) => ({
      ...prev,
      categoria: value,
      slug_categoria: slug,
    }));
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const fileNameSanitized = file.name.replace(/\s+/g, "_");
    const filePath = `${Date.now()}_${fileNameSanitized}`;

    try {
      const { error } = await supabase.storage
        .from("negocios")
        .upload(filePath, file, { cacheControl: "3600", upsert: false });

      if (error) {
        toast({
          title: "❌ Error",
          description: "No se pudo subir la imagen.",
          variant: "destructive",
        });
        return;
      }

      const { data: urlData } = supabase.storage
        .from("negocios")
        .getPublicUrl(filePath);
      setFormData((prev) => ({ ...prev, imagen_url: urlData?.publicUrl }));
    } catch {
      toast({
        title: "❌ Error",
        description: "No se pudo conectar al servidor.",
        variant: "destructive",
      });
    }
  };

  const handleImageUpload = async (e, fieldName, bucketName) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileExt = file.name.split(".").pop();
    const filePath = `${fieldName}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      alert("Error al subir la imagen.");
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucketName).getPublicUrl(filePath);

    setFormData((prev) => ({ ...prev, [fieldName]: publicUrl }));
  };

  const generateSlug = (text) =>
    text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\w\-]+/g, "");

  const getUniqueSlug = async (baseSlug) => {
    let slug = baseSlug;
    let count = 1;
    while (true) {
      const { data, error } = await supabase
        .from("negocios")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (error) break;
      if (!data) break;
      slug = `${baseSlug}-${count}`;
      count++;
    }
    return slug;
  };

  const handleCreatePreference = async () => {
    const email = (formData.email || "").trim();
    if (!email) {
      toastify.error("Por favor ingresa un correo antes de continuar.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toastify.error("Ingresa un correo válido.");
      return;
    }

    try {
      // 📍 Resolver robusto del endpoint (sin _v2)
      function resolveCreatePrefUrl() {
        const envUrl = (
          import.meta.env.VITE_CREATE_PREFERENCE_URL || ""
        ).trim();
        const mpBase = (import.meta.env.VITE_MP_BASE || "").replace(/\/$/, "");

        // absoluta => usar tal cual
        if (/^https?:\/\//i.test(envUrl)) return envUrl;

        // si hay MP_BASE => /create_preference
        if (mpBase) return `${mpBase}/create_preference`;

        // relativa => resolver contra origin
        if (envUrl) {
          const base = (
            typeof window !== "undefined" ? window.location.origin : ""
          ).replace(/\/$/, "");
          return `${base}${envUrl.startsWith("/") ? "" : "/"}${envUrl}`;
        }

        // fallback final
        const base = (
          typeof window !== "undefined" ? window.location.origin : ""
        ).replace(/\/$/, "");
        return `${base}/api/create_preference`;
      }

      const endpoint = resolveCreatePrefUrl();
      console.debug("[MP] create_preference endpoint =>", endpoint);

      try {
        localStorage.setItem("reg_plan", selectedPlan);
        localStorage.setItem("reg_email", email);
      } catch {}

      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          // Enviar Device ID para mejorar aprobación (MP antifraude)
          "X-meli-session-id": getMpDeviceId() || "",
        },
        body: JSON.stringify({
          email,
          plan: selectedPlan,
          userId: authUser?.id || null,
        }),
      });

      const data = await resp.json().catch(() => ({}));

      // Elegir SIEMPRE el init_point normal (flujo prod-like MX)
      const checkoutUrl =
        data?.init_point ||
        data?.checkout_url ||
        data?.sandbox_init_point ||
        data?.sandbox_checkout_url;

      console.debug("[MP] checkoutUrl (init_point-first) =", checkoutUrl);

      if (!resp.ok || !checkoutUrl) {
        const msg =
          data?.error ||
          data?.message ||
          "No se pudo iniciar el pago. Inténtalo más tarde.";
        toast({
          title: "No se pudo iniciar el pago",
          description: msg,
          variant: "destructive",
        });
        console.error("[MP] create_preference error:", data);
        return;
      }

      console.log("[MP] Redirigiendo a:", checkoutUrl);
      try {
        sessionStorage.setItem("last_checkout_url", checkoutUrl);
      } catch {}
      window.location.replace(checkoutUrl);
      return;
    } catch (error) {
      console.error("[MP] Error al iniciar el pago:", error);
      toast({
        title: "❌ Error al iniciar el pago",
        description: error.message || "Inténtalo más tarde.",
        variant: "destructive",
      });
    }
  };

  // Envío
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError("");
      setIsSubmitting(true);
      // 🔐 Si es PRO/PREMIUM y venimos con pago confirmado pero sin sesión,
      // bloquea el submit y manda a login preservando el destino.
      if (
        REQUIRE_LOGIN_AFTER_PAYMENT &&
        (selectedPlan === "pro" || selectedPlan === "premium") &&
        isPaid &&
        !authUser
      ) {
        const dest = `${location.pathname}${location.search || ""}`;
        setIsSubmitting(false);
        toast({
          title: "Inicia sesión para finalizar",
          description: "Usa el mismo correo con el que realizaste el pago.",
        });
        {
          const e = (formData.email || localEmail || "").trim();
          const safeEmail =
            e && e !== "null" && e !== "undefined" ? e : "";
          navigate(
            `/login?redirect=${encodeURIComponent(dest)}${
              safeEmail ? `&email=${encodeURIComponent(safeEmail)}` : ""
            }`
          );
        }
        return;
      }

      // Construye payload sin mutar formData
      const services = Array.isArray(formData.services)
        ? formData.services
        : typeof formData.services === "string"
        ? formData.services.split(",").map((s) => s.trim())
        : [];

      const gallery_images = Array.isArray(formData.gallery_images)
        ? formData.gallery_images
        : (formData.gallery_images || "")
            .split(",")
            .map((img) => img.trim())
            .filter((img) => img.length > 0);

      let imagenUrl = formData.imagen_url;
      if (!imagenUrl) {
        imagenUrl = "https://via.placeholder.com/300x200.png?text=Ejemplo";
      }

      if (imagenNegocio) {
        const imageFileName = `${Date.now()}-${imagenNegocio.name}`;
        const { error: uploadError } = await supabase.storage
          .from("negocios")
          .upload(`imagenes/${imageFileName}`, imagenNegocio);

        if (uploadError) {
          setIsSubmitting(false);
          return;
        }

        const { data: urlData } = supabase.storage
          .from("negocios")
          .getPublicUrl(`imagenes/${imageFileName}`);
        imagenUrl = urlData.publicUrl;
      }

      if (selectedPlan === "free") {
        const baseSlug = generateSlug(formData.nombre);
        const slug = await getUniqueSlug(baseSlug);
        const newBusiness = {
          nombre: formData.nombre,
          descripcion: formData.descripcion,
          categoria: formData.categoria,
          telefono: formData.telefono,
          direccion: formData.direccion,
          imagen_url: imagenUrl,
          plan_type: "free",
          slug,
          services,
          gallery_images,
          is_approved: true,
        };

        // Intento normal de inserción
        const { data: row, error } = await supabase
          .from("negocios")
          .insert([newBusiness])
          .select("id, slug")
          .single();

        // Si inserta sin problemas, navegamos directo
        if (!error && row) {
          toast({
            title: "Registro exitoso",
            description: "Tu negocio ha sido registrado correctamente.",
          });
          navigate(`/registro/exitoso?slug=${encodeURIComponent(row.slug)}`);
          return;
        }

        // ⚠️ Duplicado por índice único de FREE (nombre + dirección)
        const isDup =
          error && (
            error.code === "409" ||
            error.code === "23505" ||
            /duplicate key value/i.test(error.message || "") ||
            /negocios_free_name_addr_uidx/i.test(error.message || "")
          );

        if (isDup) {
          // Buscar el registro existente por nombre/dirección/plan_type
          const { data: existing } = await supabase
            .from("negocios")
            .select("id, slug")
            .eq("plan_type", "free")
            .ilike("nombre", formData.nombre)
            .ilike("direccion", formData.direccion)
            .maybeSingle();

          if (existing?.slug) {
            toastify.success("✅ Ya existía un registro con ese nombre y dirección.");
            navigate(`/registro/exitoso?slug=${encodeURIComponent(existing.slug)}`);
            return;
          }

          // Fallback: si no se pudo localizar por nombre/dirección, intentamos por slug recién calculado
          const { data: bySlug } = await supabase
            .from("negocios")
            .select("id, slug")
            .eq("slug", slug)
            .maybeSingle();

          if (bySlug?.slug) {
            toastify.success("✅ Ya existía un registro coincidente.");
            navigate(`/registro/exitoso?slug=${encodeURIComponent(bySlug.slug)}`);
            return;
          }

        }

        // Si no fue duplicado (u otro error), propagamos al catch general
        if (error) throw error;
      } else if (selectedPlan === "pro" || selectedPlan === "premium") {
        const userId = authUser?.id ?? null; // null si no hay sesión

        const effectiveEmail = (
          formData.email ||
          emailFromUrl ||
          authUser?.email ||
          ""
        )
          .trim()
          .toLowerCase();

        const baseSlug = generateSlug(formData.nombre || "");
        const uniqueSlug = await getUniqueSlug(
          baseSlug ||
            (typeof crypto !== "undefined"
              ? crypto.randomUUID().slice(0, 8)
              : `${Date.now()}`)
        );

        // 🚫 Si hay sesión pero no corresponde con el correo del pago, bloquea y pide cambiar de cuenta
        if (authUser && emailMismatch) {
          setIsSubmitting(false);
          toast({
            title: "Cambia a la cuenta del pago",
            description: "Inicia sesión con el mismo correo que usaste para pagar (se mostrará prellenado).",
            variant: "destructive",
          });
          switchAccountToIntended();
          return;
        }

        const newBusiness = {
          nombre: formData.nombre,
          descripcion: formData.descripcion,
          categoria: formData.categoria,
          telefono: formData.telefono,
          direccion: formData.direccion,
          imagen_url: imagenUrl,
          plan_type: selectedPlan,
          slug: uniqueSlug,
          email: effectiveEmail || null,
          user_id: userId, // null si no hay sesión
          services,
          gallery_images,
          is_approved: true,
        };

        const normalizedEffectiveEmail =
          (effectiveEmail || "").toLowerCase() || null;

        // 🚧 Bloquea inserciones sin sesión (RLS exige usuario autenticado)
        if (!userId) {
          setIsSubmitting(false);
          toast({
            title: "Inicia sesión para finalizar",
            description: "Tu pago fue aprobado. Debes iniciar sesión con el mismo correo para crear/ligar tu negocio.",
          });
          goLoginToFinish();
          return;
        }

        // ⏮️ PRE-CHECK: si ya existe un negocio ligado a este usuario, actualízalo en lugar de intentar INSERT
        if (userId) {
          const existingUserBiz = await supabase
            .from("negocios")
            .select("id, slug")
            .eq("user_id", userId)
            .maybeSingle();

          if (existingUserBiz?.data?.id) {
            const updExisting = await supabase
              .from("negocios")
              .update({
                ...newBusiness,
                email: normalizedEffectiveEmail,
                user_id: userId,
              })
              .eq("id", existingUserBiz.data.id)
              .select()
              .single();

            if (updExisting.error) throw updExisting.error;

            toastify.success("✅ Negocio actualizado.");
            navigate("/mi-negocio");
            return;
          }
        }

        // 🔐 RLS-safe write (sin upsert onConflict: no hay índice único en user_id)
        // 1) Intento INSERT directo
        const insertRes = await supabase
          .from("negocios")
          .insert([{ ...newBusiness, email: normalizedEffectiveEmail, user_id: userId }])
          .select()
          .maybeSingle();

        if (insertRes?.data && !insertRes.error) {
          // Insert OK
          toastify.success("✅ Negocio creado.");
          navigate("/mi-negocio");
          return;
        } else {
          const dup =
            insertRes?.error &&
            (insertRes.error.code === "409" ||
              insertRes.error.code === "23505" ||
              /duplicate key value|already exists|unique constraint/i.test(
                insertRes.error.message || ""
              ));

          // Si no es duplicado, propaga el error
          if (!dup) {
            throw insertRes?.error || new Error("Insert failed");
          }

          // Buscar existente por user_id o por email y actualizar
          let existingId = null;

          if (userId) {
            const byUser = await supabase
              .from("negocios")
              .select("id, slug")
              .eq("user_id", userId)
              .maybeSingle();
            if (byUser?.data?.id) existingId = byUser.data.id;
          }

          if (!existingId && normalizedEffectiveEmail) {
            const byEmail = await supabase
              .from("negocios")
              .select("id, slug")
              .eq("email", normalizedEffectiveEmail)
              .maybeSingle();
            if (byEmail?.data?.id) existingId = byEmail.data.id;
          }

          if (existingId) {
            const upd = await supabase
              .from("negocios")
              .update({
                ...newBusiness,
                email: normalizedEffectiveEmail,
                user_id: userId,
              })
              .eq("id", existingId)
              .select()
              .single();

            if (upd.error) throw upd.error;
            toastify.success("✅ Negocio actualizado.");
            navigate("/mi-negocio");
            return;
          }

          // Si no localizamos registro (poco probable), redirige al panel y deja que el usuario lo vea.
          toastify.info("ℹ️ Ya tenías un registro previo. Te llevamos a tu panel.");
          navigate("/mi-negocio");
          return;
        }
      } // <-- Close the else block for selectedPlan === "pro" || "premium"
    } catch (err) {
      console.error("Error al registrar negocio:", err?.message || err);
      if (
        err?.code === "409" ||
        err?.code === "23505" ||
        /duplicate key value/i.test(err?.message || "")
      ) {
        try {
          const normalizedEmail = (
            formData.email || emailFromUrl || authUser?.email || ""
          ).toLowerCase();
          const fetchRes = await supabase
            .from("negocios")
            .select("*")
            .eq("email", normalizedEmail)
            .maybeSingle();

          if (fetchRes?.data && !fetchRes.error) {
            toastify.success(
              "✅ Ya existe un negocio con ese correo. Usaremos ese registro."
            );
            goToBusiness(normalizedEmail);
            return;
          }
        } catch (readErr) {
          console.error(
            "Error leyendo negocio existente tras duplicado:",
            readErr
          );
        }
      }
      // FREE: si falló por duplicado (nombre+dirección), redirige a exitoso usando el existente
      if (
        selectedPlan === "free" &&
        (err?.code === "409" || err?.code === "23505" || /negocios_free_name_addr_uidx|duplicate key value/i.test(err?.message || ""))
      ) {
        try {
          const { data: existing } = await supabase
            .from("negocios")
            .select("id, slug")
            .eq("plan_type", "free")
            .ilike("nombre", formData.nombre)
            .ilike("direccion", formData.direccion)
            .maybeSingle();

          if (existing?.slug) {
            toastify.success("✅ Ya existía un registro con ese nombre y dirección.");
            navigate(`/registro/exitoso?slug=${encodeURIComponent(existing.slug)}`);
            return;
          }
        } catch (e2) {
          console.error("FREE duplicate fallback read failed:", e2);
        }
      }
      setError("Ocurrió un error al registrar el negocio.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex-grow container mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
        Registrar Negocio – {selectedPlan}
      </h1>

      {(selectedPlan === "pro" || selectedPlan === "premium") && !isPaid && (
        <div className="max-w-xl mx-auto bg-white p-6 shadow rounded-lg text-center space-y-4 mb-6">
          <p className="text-lg font-semibold text-gray-800">
            Para continuar con el registro, primero ingresa el correo
            electrónico de contacto y luego contrata tu plan {selectedPlan}.
          </p>
          <div className="mb-2">
            <Input
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="Ejemplo: contacto@negocio.com"
              type="email"
            />
          </div>
          <Button
            className="bg-blue-950 text-white"
            onClick={(event) => {
              event.preventDefault();
              handleCreatePreference();
            }}
            disabled={isSubmitting}
          >
            Contratar Plan{" "}
            {selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)}
          </Button>
          {authUser?.email && (
            <p className="text-xs text-gray-500">
              Sesión activa como <strong>{authUser.email}</strong>.
              {emailMismatch && intendedEmail ? (
                <> &nbsp;(<span className="text-yellow-700">El pago es para {intendedEmail}</span>)</>
              ) : null}
            </p>
          )}
        </div>
      )}

      {/* ⚠️ Banner de advertencia si hay sesión activa, pago aprobado y desajuste de correo */}
      {(selectedPlan === "pro" || selectedPlan === "premium") && isPaid && authUser && emailMismatch && (
        <div className="max-w-xl mx-auto bg-yellow-50 border border-yellow-300 p-4 rounded-md mb-6 text-center">
          <p className="text-sm text-yellow-900">
            Estás autenticado como <strong>{sessionEmail}</strong>, pero el pago pertenece a <strong>{intendedEmail}</strong>. 
            Para finalizar correctamente, cambia a la cuenta del pago.
          </p>
          <div className="mt-3">
            <Button className="bg-yellow-600 hover:bg-yellow-700 text-white" onClick={switchAccountToIntended}>
              Cambiar de cuenta
            </Button>
          </div>
        </div>
      )}

      {mustLoginToFinish && (
        <div className="max-w-xl mx-auto bg-white p-6 shadow rounded-lg text-center space-y-4 mb-6">
          <p className="text-lg font-semibold text-gray-800">
            Tu pago fue aprobado. Para finalizar y administrar tu negocio,
            <strong> inicia sesión</strong> con el mismo correo de la compra.
          </p>
          <Button className="bg-blue-600 text-white" onClick={goLoginToFinish}>
            Iniciar sesión para continuar
          </Button>
        </div>
      )}

      {!mustLoginToFinish && (
        (((selectedPlan === "pro" || selectedPlan === "premium") && isPaid) ||
          selectedPlan === "free") && (
          <form
            onSubmit={handleSubmit}
            className="max-w-2xl mx-auto space-y-6 bg-white p-6 shadow rounded-lg"
          >
            {/* FREE */}
            {selectedPlan === "free" && (
              <>
                <label className="font-semibold text-sm mb-1 block">
                  Nombre del negocio
                </label>
                <Input
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleChange}
                  required
                  placeholder="Ejemplo: Taquería El Buen Sabor"
                />
                <label className="font-semibold text-sm mb-1 block">
                  Categoría
                </label>
                <Select
                  name="categoria"
                  value={formData.categoria}
                  onValueChange={handleCategoryChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label className="font-semibold text-sm mb-1 block">
                  Teléfono
                </label>
                <Input
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleChange}
                  required
                  placeholder="Ejemplo: 555-123-4567"
                />
                <label className="font-semibold text-sm mb-1 block">
                  Dirección
                </label>
                <Textarea
                  name="direccion"
                  value={formData.direccion}
                  onChange={handleChange}
                  required
                  placeholder="Ejemplo: Av. Juárez 123, Iztapalapa"
                />
                <label className="font-semibold text-sm mb-1 block">
                  Descripción del negocio
                </label>
                <Textarea
                  name="descripcion"
                  value={formData.descripcion}
                  onChange={handleChange}
                  placeholder="Describe tu negocio brevemente"
                />
                <div>
                  <label className="font-semibold text-sm mb-1 block">
                    Imagen del negocio
                  </label>
                  {previewUrl && (
                    <div className="mt-4">
                      <p className="text-sm text-gray-500 mb-1">Vista previa:</p>
                      <img
                        src={previewUrl}
                        alt="Vista previa"
                        className="w-40 h-auto rounded-md border"
                      />
                    </div>
                  )}
                  <input
                    type="file"
                    name="imagen"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      setImagenNegocio(file);
                      const localUrl = URL.createObjectURL(file);
                      setPreviewUrl(localUrl);

                      try {
                        const fileExt = file.name.split(".").pop();
                        const fileName = `${Date.now()}.${fileExt}`;
                        const filePath = `negocios/${fileName}`;

                        const { error } = await supabase.storage
                          .from("negocios")
                          .upload(filePath, file, {
                            cacheControl: "3600",
                            upsert: false,
                          });

                        if (error) {
                          toastify.error("❌ No se pudo subir la imagen.");
                          return;
                        }

                        const { data: urlData } = supabase.storage
                          .from("negocios")
                          .getPublicUrl(filePath);

                        setFormData((prev) => ({
                          ...prev,
                          imagen_url: urlData?.publicUrl || "",
                        }));
                      } catch (err) {
                        console.error("Error al subir imagen:", err);
                        toastify.error("❌ No se pudo subir la imagen.");
                      }
                    }}
                    className="block w-full text-sm text-gray-700
                             file:mr-4 file:py-2 file:px-4
                             file:rounded-full file:border-0
                             file:text-sm file:font-semibold
                             file:bg-orange-500 file:text-white
                             hover:file:bg-orange-400"
                  />
                </div>
              </>
            )}

            {/* PRO / PREMIUM */}
            {(selectedPlan === "pro" || selectedPlan === "premium") && (
              <>
                <div>
                  <label className="block font-medium mb-1">
                    Nombre del negocio
                  </label>
                  <Input
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleChange}
                    required
                    placeholder="Ejemplo: Taquería El Buen Sabor"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Categoría</label>
                  <Select
                    value={formData.categoria}
                    onValueChange={handleCategoryChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Teléfono</label>
                  <Input
                    name="telefono"
                    value={formData.telefono}
                    onChange={handleChange}
                    required
                    placeholder="Ejemplo: 555-123-4567"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Dirección</label>
                  <Textarea
                    name="direccion"
                    value={formData.direccion}
                    onChange={handleChange}
                    required
                    placeholder="Ejemplo: The Business Address"
                  />
                </div>
              </>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-lg flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    ></path>
                  </svg>
                  Registrando...
                </>
              ) : (
                "Registrar Negocio"
              )}
            </Button>
          </form>
        )
      )}
    </main>
  );
};

export default RegisterBusinessPage;