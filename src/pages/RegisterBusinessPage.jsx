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

const GOOGLE_API_KEY = "AIzaSyA1yCFzlUpn3Kr38gjt6N4dm2XNHy1eBG8";

const getGoogleMapsEmbedUrl = async (nombre, direccion) => {
  const fullQuery = encodeURIComponent(`${nombre}, ${direccion}`);
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${fullQuery}&inputtype=textquery&fields=place_id&key=${GOOGLE_API_KEY}`
    );
    const data = await response.json();
    const placeId = data?.candidates?.[0]?.place_id;

    if (placeId) {
      return `https://www.google.com/maps/embed/v1/place?key=${GOOGLE_API_KEY}&q=place_id:${placeId}`;
    } else {
      return "";
    }
  } catch (error) {
    console.error("Error al obtener place_id de Google:", error);
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

    if (!photoRef) return "";

    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=600&photo_reference=${photoRef}&key=${GOOGLE_API_KEY}`;
  } catch (error) {
    console.error("Error al obtener imagen de Google:", error);
    return "";
  }
};

const RegisterBusinessPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const selectedPlan = searchParams.get("plan")?.toLowerCase() || "free";
  const isPaid = searchParams.get("paid") === "true";

  useEffect(() => {
    if ((selectedPlan === "pro" || selectedPlan === "premium") && !isPaid) {
      navigate(`/registro?plan=${selectedPlan}`);
    }
  }, [selectedPlan, isPaid, navigate]);

  const [formData, setFormData] = useState({
    nombre: "",
    categoria: "",
    telefono: "",
    direccion: "",
    imagen_url: "",
    slug_categoria: "",
    mapa_embed_url: "",
    descripcion: "", // ✅ nuevo campo
  });

  const [categories, setCategories] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      const { data, error } = await supabase.storage
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
    } catch (err) {
      console.error("Error al subir imagen:", err);
      toast({
        title: "❌ Error",
        description: "No se pudo conectar al servidor.",
        variant: "destructive",
      });
    }
  };

  const generarSlug = (texto) =>
    texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^\w\-]+/g, "")
      .replace(/\-\-+/g, "-")
      .replace(/^-+/, "")
      .replace(/-+$/, "");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    if (!formData.imagen_url) {
      formData.imagen_url =
        "https://via.placeholder.com/300x200.png?text=Ejemplo";
    }

    if (
      !formData.nombre ||
      !formData.categoria ||
      !formData.telefono ||
      !formData.direccion ||
      !formData.slug_categoria
    ) {
      toast({
        title: "❌ Campos requeridos",
        description: "Completa todos los campos obligatorios.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    if ((selectedPlan === "pro" || selectedPlan === "premium") && !isPaid) {
      toast({
        title: "❌ Pago requerido",
        description: "Debes completar el pago antes de registrar tu negocio.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    if (
      (selectedPlan === "pro" || selectedPlan === "premium") &&
      !formData.imagen_url
    ) {
      formData.imagen_url = await getGooglePlaceImage(
        formData.nombre,
        formData.direccion
      );
    }

    if (
      (selectedPlan === "pro" || selectedPlan === "premium") &&
      !formData.mapa_embed_url
    ) {
      formData.mapa_embed_url = await getGoogleMapsEmbedUrl(
        formData.nombre,
        formData.direccion
      );
    }

    if (selectedPlan === "free") {
      formData.slug = generarSlug(formData.nombre);

      const datosNegocio = {
        nombre: formData.nombre,
        categoria: formData.categoria,
        slug_categoria: formData.slug_categoria,
        telefono: formData.telefono,
        direccion: formData.direccion,
        imagen_url:
          formData.imagen_url ||
          "https://via.placeholder.com/300x200.png?text=Ejemplo",
        descripcion: formData.descripcion || "",
        mapa_embed_url: formData.mapa_embed_url || "",
        menu: "",
        instagram: "",
        facebook: "",
        hours: "",
        services: [],
        video_embed_url: "",
        whatsapp: "",
        web: "",
        gallery_images: [],
        logo_url: "",
        plan_type: selectedPlan,
        is_featured: false,
        is_deleted: false,
        estadisticas: "",
        promociones: "",
        estado_pago: "n/a",
        latitud: "",
        longitud: "",
        user_id: null,
      };

      console.log("🔍 Datos enviados a Supabase:", datosNegocio);

      try {
        const { data: newBusiness, error } = await supabase
          .from("negocios")
          .insert([datosNegocio]);

        if (error) throw error;

        toast({
          title: "¡Registro exitoso!",
          description: "Tu negocio fue enviado para aprobación.",
        });
        navigate("/registro-exitoso");
      } catch (error) {
        toast({
          title: "❌ Error",
          description: error.message || "Ocurrió un error.",
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
      }

      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      toast({
        title: "❌ Error de sesión",
        description: "Debes iniciar sesión para registrar tu negocio.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    const datosNegocio = {
      nombre: formData.nombre,
      categoria: formData.categoria,
      slug_categoria: formData.slug_categoria,
      telefono: formData.telefono,
      direccion: formData.direccion,
      imagen_url:
        formData.imagen_url ||
        "https://via.placeholder.com/300x200.png?text=Ejemplo",
      descripcion: formData.descripcion || "",
      mapa_embed_url: formData.mapa_embed_url || "",
      menu: "",
      instagram: "",
      facebook: "",
      hours: "",
      services: [],
      video_embed_url: "",
      whatsapp: "",
      web: "",
      gallery_images: [],
      logo_url: "",
      plan_type: selectedPlan,
      is_featured: false,
      is_deleted: false,
      estadisticas: "",
      promociones: "",
      estado_pago: isPaid ? "pagado" : "pendiente",
      latitud: "",
      longitud: "",
      user_id: user.id,
    };

    console.log("🔍 Datos enviados a Supabase:", datosNegocio);

    try {
      const { data: newBusiness, error } = await supabase
        .from("negocios")
        .insert([datosNegocio])
        .select()
        .single();
      if (error) throw error;

      toast({
        title: "¡Registro exitoso!",
        description: "Tu negocio fue enviado para aprobación.",
      });
      navigate(`/negocios?plan=${selectedPlan}`);
    } catch (error) {
      toast({
        title: "❌ Error",
        description: error.message || "Ocurrió un error.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex-grow container mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
        Registrar Negocio – {selectedPlan}
      </h1>

      <form
        onSubmit={handleSubmit}
        className="max-w-2xl mx-auto space-y-6 bg-white p-6 shadow rounded-lg"
      >
        <div>
          <label className="block mb-1 text-sm font-medium text-gray-700">
            Nombre del negocio
          </label>
          <Input
            type="text"
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium text-gray-700">
            Categoría
          </label>
          <Select onValueChange={handleCategoryChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona una categoría" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat, idx) => (
                <SelectItem key={idx} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium text-gray-700">
            Teléfono
          </label>
          <Input
            type="tel"
            name="telefono"
            value={formData.telefono}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium text-gray-700">
            Dirección
          </label>
          <Textarea
            name="direccion"
            value={formData.direccion}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium text-gray-700">
            Descripción del negocio
          </label>
          <Textarea
            name="descripcion"
            value={formData.descripcion}
            onChange={handleChange}
            placeholder="Ejemplo: Cafetería local con repostería artesanal..."
            required
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium text-gray-700">
            Imagen del negocio
          </label>
          <label className="cursor-pointer bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2 rounded-md">
            Subir Imagen
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
          {formData.imagen_url && (
            <img
              src={formData.imagen_url}
              alt="Vista previa"
              className="mt-2 h-32 object-contain border rounded-md"
            />
          )}
        </div>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-lg"
        >
          {isSubmitting ? "Registrando..." : "Registrar Negocio"}
        </Button>
      </form>
    </main>
  );
};

export default RegisterBusinessPage;
