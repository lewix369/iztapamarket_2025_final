// 🔒 VERSIÓN DE PRODUCCIÓN — Esta versión está lista para usarse en iztapamarket.com
import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useNavigate, useSearchParams } from "react-router-dom";
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

const GOOGLE_API_KEY = "AIzaSyA1yCFzlUpn3Kr38gjt6N4dm2XNHy1eBG8";
const FUNCTIONS_URL =
  import.meta.env.VITE_FUNCTIONS_URL ||
  "https://qjuytjpthaxabjedqoez.functions.supabase.co";

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

const RegisterBusinessPage = () => {
  const [imagenNegocio, setImagenNegocio] = useState(null);
  const [searchParams] = useSearchParams();

  // ✅ ÚNICA FUENTE DE VERDAD — incluye fallback por collection_status/status
  const selectedPlan = (searchParams.get("plan") || "free").toLowerCase();

  const rawStatus = (
    searchParams.get("collection_status") ||
    searchParams.get("status") ||
    ""
  )
    .toString()
    .toLowerCase();

  const isPaid =
    (searchParams.get("paid") || "").toLowerCase() === "true" ||
    rawStatus === "approved" ||
    rawStatus === "success";

  const emailFromUrl = (searchParams.get("email") || "").trim();

  const navigate = useNavigate();
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
    whatsapp: "",
    email: "",
  });
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState("");

  const [categories, setCategories] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingAIContent, setIsGeneratingAIContent] = useState(false);

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

  // Prefill email si vino en la URL
  useEffect(() => {
    if (emailFromUrl) {
      setFormData((prev) => ({ ...prev, email: emailFromUrl }));
    }
  }, [emailFromUrl]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

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
    const email = formData.email;
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
      const resp = await fetch(`${FUNCTIONS_URL}/mp-create-preference`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, plan: selectedPlan }),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.init_point) {
        toast({
          title: "No se pudo iniciar el pago",
          description: data?.error || "Inténtalo más tarde.",
          variant: "destructive",
        });
        return;
      }
      window.location.href = data.init_point;
    } catch (error) {
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

      formData.services = Array.isArray(formData.services)
        ? formData.services
        : typeof formData.services === "string"
        ? formData.services.split(",").map((s) => s.trim())
        : [];

      formData.gallery_images = Array.isArray(formData.gallery_images)
        ? formData.gallery_images
        : (formData.gallery_images || "")
            .split(",")
            .map((img) => img.trim())
            .filter((img) => img.length > 0);

      if (!formData.imagen_url) {
        formData.imagen_url =
          "https://via.placeholder.com/300x200.png?text=Ejemplo";
      }

      let imagenUrl = formData.imagen_url;
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
        };

        const { error } = await supabase.from("negocios").insert([newBusiness]);
        if (error) throw error;

        toast({
          title: "Registro exitoso",
          description: "Tu negocio ha sido registrado correctamente.",
        });
        navigate("/registro-exitoso");
      } else if (selectedPlan === "pro" || selectedPlan === "premium") {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError) {
          console.warn("No se pudo obtener el usuario autenticado:", userError);
        }

        const effectiveEmail = (formData.email || emailFromUrl || "").trim();
        if (!user && !effectiveEmail) {
          setIsSubmitting(false);
          toastify.error("Inicia sesión o indica un email para continuar.");
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
          email: effectiveEmail || null,
          ...(user ? { user_id: user.id } : {}),
        };

        const { error } = await supabase.from("negocios").insert([newBusiness]);
        if (error) throw error;

        toast({
          title: "Registro exitoso",
          description: "Tu negocio ha sido registrado correctamente.",
        });
        navigate("/mi-negocio");
      } else {
        const encodedPlan = encodeURIComponent(selectedPlan);
        navigate(`/test-pago?plan=${encodedPlan}`);
      }
    } catch (err) {
      console.error("Error al registrar negocio:", err?.message || err);
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
        </div>
      )}

      {(((selectedPlan === "pro" || selectedPlan === "premium") && isPaid) ||
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

              {selectedPlan === "pro" && (
                <>
                  <div>
                    <label className="block font-medium mb-1">
                      Horario de atención
                    </label>
                    <Input
                      name="hours"
                      value={formData.hours}
                      onChange={handleChange}
                      placeholder="Ejemplo: Lunes a Viernes de 9 a 18 hrs"
                    />
                  </div>
                  <div>
                    <label className="block font-medium mb-1">
                      Mapa (embed URL)
                    </label>
                    <Input
                      name="mapa_embed_url"
                      value={formData.mapa_embed_url}
                      onChange={handleChange}
                      placeholder="https://www.google.com/maps/embed?..."
                    />
                  </div>
                </>
              )}
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
      )}
    </main>
  );
};

export default RegisterBusinessPage;
