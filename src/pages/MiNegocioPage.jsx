import React, { useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Mail } from "lucide-react";
const MiNegocioPage = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (data?.user) {
        setUser(data.user);
        console.log("✅ Usuario autenticado:", data.user);
      } else {
        console.warn("❌ No se encontró usuario autenticado", error);
      }
    };
    fetchUser();
  }, []);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nombre: "",
    descripcion: "",
    telefono: "",
    whatsapp: "",
    direccion: "",
    instagram: "",
    facebook: "",
    web: "",
    latitud: "", // nuevo
    longitud: "", // nuevo
    plan_type: "Free",
    promocionTitulo: "",
    promocionDescripcion: "",
    promocionImagenUrl: "",
    promocionFechaInicio: "",
    promocionFechaFin: "",
  });
  const [negocioId, setNegocioId] = useState(null);

  const [isSaving, setIsSaving] = useState(false);
  const [wasSaved, setWasSaved] = useState(false);

  const [promociones, setPromociones] = useState([]);
  // Nueva variable de estado para edición de promociones
  const [promoEditandoId, setPromoEditandoId] = useState(null);

  const fetchPromos = async () => {
    if (!negocioId) return;
    const { data, error } = await supabase
      .from("promociones")
      .select("*")
      .eq("negocio_id", negocioId)
      .order("created_at", { ascending: false });
    if (!error) setPromociones(data);
  };

  useEffect(() => {
    if (negocioId) {
      fetchPromos();
    }
  }, [negocioId]);

  useEffect(() => {
    if (!user?.id) return;

    const fetchBusiness = async () => {
      try {
        const { data: relData, error: relError } = await supabase
          .from("negocio_propietarios")
          .select("negocio_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (relError || !relData?.negocio_id) {
          console.warn("No se encontró relación con negocio", relError);
          toast({
            title: "Negocio no encontrado",
            description:
              "Tu usuario aún no está vinculado a ningún negocio. Contacta a soporte.",
          });
          return;
        }

        setNegocioId(relData.negocio_id);

        const { data: negocio, error: errorNegocio } = await supabase
          .from("negocios")
          .select("*")
          .eq("id", relData.negocio_id)
          .single();

        if (errorNegocio || !negocio) {
          toast({
            title: "Error",
            description: "No se pudo cargar la información del negocio.",
          });
          return;
        }

        setForm({
          nombre: negocio.nombre || "",
          descripcion: negocio.descripcion || "",
          telefono: negocio.telefono || "",
          whatsapp: negocio.whatsapp || "",
          direccion: negocio.direccion || "",
          instagram: negocio.instagram || "",
          facebook: negocio.facebook || "",
          web: negocio.web || "",
          latitud: negocio.latitud || "",
          longitud: negocio.longitud || "",
          plan_type: negocio.plan_type || "Free",
          promocionTitulo: "",
          promocionDescripcion: "",
          promocionImagenUrl: "",
          promocionFechaInicio: "",
          promocionFechaFin: "",
        });
      } catch (err) {
        console.error("❌ Error general al cargar negocio:", err);
        toast({
          title: "Error inesperado",
          description: "Ocurrió un problema al cargar los datos del negocio.",
        });
      }
    };

    fetchBusiness();
  }, [user]);

  if (user === undefined) {
    return (
      <div className="text-center mt-10 text-blue-500">Cargando sesión...</div>
    );
  }

  if (!user) {
    return (
      <div className="text-center mt-10 text-red-500">
        No has iniciado sesión. Por favor, vuelve al login.
      </div>
    );
  }

  if (!negocioId) {
    return (
      <div className="text-center mt-10 text-orange-500">
        Aún no se ha asociado tu negocio. Si acabas de registrarte, espera unos
        segundos o contacta a soporte.
      </div>
    );
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user || !negocioId) {
      toast({
        title: "Error",
        description: "No estás logueado o no tienes negocio asignado",
      });
      return;
    }

    setIsSaving(true);
    setWasSaved(false);

    const formStringified = {
      nombre: String(form.nombre),
      descripcion: String(form.descripcion),
      telefono: String(form.telefono),
      whatsapp: String(form.whatsapp),
      direccion: String(form.direccion),
      instagram: String(form.instagram),
      facebook: String(form.facebook),
      web: String(form.web),
      latitud: String(form.latitud),
      longitud: String(form.longitud),
    };

    const { error } = await supabase
      .from("negocios")
      .update({
        ...formStringified,
      })
      .eq("id", negocioId);

    if (error) {
      toast({ title: "Error", description: "No se pudo guardar" });
    } else {
      toast({
        title: "✅ Cambios guardados",
        description:
          "La información de tu negocio ha sido actualizada correctamente.",
      });
      setWasSaved(true);
      setTimeout(() => setWasSaved(false), 4000);
    }

    setIsSaving(false);
  };

  const generarDescripcionIA = () => {
    const nuevaDescripcion = `Con más de 15 años de tradición en ${
      form.direccion || "Iztapalapa"
    }, ${
      form.nombre
    } ofrece tacos auténticos con atención cálida y sabor casero.`;
    setForm((prev) => ({ ...prev, descripcion: nuevaDescripcion }));
    toast({
      title: "🎉 Descripción generada",
      description: "Puedes ajustarla si deseas antes de guardar.",
    });
  };

  const obtenerCoordenadasDesdeDireccion = async () => {
    try {
      const response = await fetch(
        `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(
          form.direccion
        )}&key=${import.meta.env.VITE_OPENCAGE_API_KEY}`
      );
      const data = await response.json();

      if (data.results.length > 0) {
        const { lat, lng } = data.results[0].geometry;
        setForm((prev) => ({
          ...prev,
          latitud: lat.toString(),
          longitud: lng.toString(),
        }));
        toast({
          title: "✅ Coordenadas obtenidas",
          description: `Lat: ${lat}, Lng: ${lng}`,
        });
      } else {
        toast({
          title: "No se encontraron coordenadas",
          description: "Revisa que la dirección sea válida.",
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Error al obtener coordenadas",
        description: "Verifica tu conexión o clave de API.",
      });
    }
  };

  // --- Estadísticas: hooks deben ir aquí arriba (antes de cualquier return o condicional) ---
  // Si quieres agregar lógica de estadísticas, declara aquí los hooks:
  // const [stats, setStats] = useState([]);
  // useEffect(() => { ... }, []);

  const handleSubmitPromo = async (e) => {
    e.preventDefault();
    if (!form.promocionTitulo || !form.promocionDescripcion || !negocioId) {
      console.error("❌ Datos faltantes al enviar promo:", {
        titulo: form.promocionTitulo,
        descripcion: form.promocionDescripcion,
        negocioId,
      });
      toast({
        title: "Error",
        description: "Faltan datos necesarios o el negocio no está vinculado.",
      });
      return;
    }

    const payload = {
      negocio_id: negocioId,
      titulo: form.promocionTitulo,
      descripcion: form.promocionDescripcion,
      imagen_url: form.promocionImagenUrl,
      fecha_inicio: form.promocionFechaInicio,
      fecha_fin: form.promocionFechaFin,
    };

    console.log("📤 Enviando promoción a Supabase:", payload);

    let error;

    if (promoEditandoId) {
      ({ error } = await supabase
        .from("promociones")
        .update(payload)
        .eq("id", promoEditandoId));
    } else {
      ({ error } = await supabase.from("promociones").insert([payload]));
    }

    if (error) {
      toast({ title: "Error", description: "No se pudo guardar la promoción" });
    } else {
      toast({
        title: promoEditandoId ? "✅ Promoción actualizada" : "🎉 Publicado",
        description: promoEditandoId
          ? "La promoción fue actualizada correctamente."
          : "Promoción agregada",
      });
      setWasSaved(true);
      setTimeout(() => setWasSaved(false), 4000);
      setForm((prev) => ({
        ...prev,
        promocionTitulo: "",
        promocionDescripcion: "",
        promocionImagenUrl: "",
        promocionFechaInicio: "",
        promocionFechaFin: "",
      }));
      setPromoEditandoId(null);
      fetchPromos();
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Editar Negocio</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>Nombre</Label>
          <Input name="nombre" value={form.nombre} onChange={handleChange} />
        </div>
        <div>
          <Label>Descripción</Label>
          <Input
            name="descripcion"
            value={form.descripcion}
            onChange={handleChange}
          />
          <Button
            type="button"
            className="mt-2 text-sm bg-orange-500 text-white hover:bg-orange-600"
            onClick={generarDescripcionIA}
          >
            Generar con IA
          </Button>
          <p className="text-xs text-gray-500 mt-1">
            La IA genera una propuesta, pero puedes modificarla antes de
            guardar.
          </p>
        </div>
        <div>
          <Label>Teléfono</Label>
          <Input
            name="telefono"
            value={form.telefono}
            onChange={handleChange}
          />
        </div>
        <div>
          <Label>WhatsApp</Label>
          <Input
            name="whatsapp"
            value={form.whatsapp}
            onChange={handleChange}
          />
        </div>
        <div>
          <Label>Dirección</Label>
          <Input
            name="direccion"
            value={form.direccion}
            onChange={handleChange}
          />
          <div className="flex flex-col sm:flex-row sm:space-x-3 mt-2">
            <Button
              disabled
              className="mb-2 sm:mb-0 sm:mt-0 mt-0 text-sm bg-gray-400 text-white"
              type="button"
            >
              Usar mi ubicación actual (próximamente)
            </Button>
            <Button
              type="button"
              className="sm:mt-0 mt-2 text-sm bg-orange-500 text-white hover:bg-orange-600"
              onClick={obtenerCoordenadasDesdeDireccion}
            >
              Buscar ubicación en el mapa
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Puedes buscar la ubicación en el mapa usando la dirección, o
            próximamente usar tu ubicación actual.
          </p>
          {form.latitud && form.longitud && (
            <div className="mt-2 text-green-600 text-sm">
              ✅ Coordenadas detectadas automáticamente.
            </div>
          )}
        </div>
        <div>
          <Label>Instagram</Label>
          <Input
            name="instagram"
            value={form.instagram}
            onChange={handleChange}
          />
        </div>
        <div>
          <Label>Facebook</Label>
          <Input
            name="facebook"
            value={form.facebook}
            onChange={handleChange}
          />
        </div>
        <div>
          <Label>Web</Label>
          <Input name="web" value={form.web} onChange={handleChange} />
        </div>
        <div className="hidden">
          <Input name="latitud" value={form.latitud} readOnly />
        </div>
        <div className="hidden">
          <Input name="longitud" value={form.longitud} readOnly />
        </div>
        {form.latitud && form.longitud && (
          <div className="mt-6">
            <Label className="block mb-1">Ubicación en el mapa:</Label>
            <iframe
              width="100%"
              height="200"
              frameBorder="0"
              className="rounded border"
              src={`https://www.google.com/maps?q=${form.latitud},${form.longitud}&z=16&output=embed`}
              allowFullScreen
            ></iframe>
          </div>
        )}
        <Button
          type="submit"
          className="mt-4"
          disabled={
            !negocioId ||
            form.nombre.trim() === "" ||
            form.descripcion.trim() === "" ||
            form.telefono.trim() === "" ||
            form.direccion.trim() === "" ||
            isSaving
          }
        >
          {isSaving
            ? "⏳ Guardando..."
            : wasSaved
            ? "✅ Cambios guardados"
            : "💾 Guardar cambios"}
        </Button>
        {wasSaved && (
          <p className="text-green-600 text-sm mt-2">
            ✅ La información fue actualizada con éxito.
          </p>
        )}
      </form>
      {form.plan_type === "pro" || form.plan_type === "premium" ? (
        <div className="mt-10 border-t pt-6">
          <h2 className="text-lg font-semibold mb-4 text-orange-600">
            🛠️ Herramientas Premium
          </h2>
          <ul className="space-y-3 text-sm text-gray-700">
            <li>
              🔍 Estadísticas personalizadas (clics, visitas, interacción)
            </li>
            <li>🎯 Promociones visibles en ficha pública</li>
            <li>🧠 Generación de contenido con IA</li>
            <li>📸 Administración de galería multimedia</li>
            <li>📍 Geolocalización automática</li>
            <li>🔔 Alertas de vencimiento de plan</li>
          </ul>
          <p className="mt-4 text-xs text-gray-500">
            Estas herramientas están disponibles para los negocios con plan Pro
            o Premium.
          </p>
        </div>
      ) : null}

      {["pro", "premium"].includes(form.plan_type) && (
        <div className="mt-10 border-t pt-6">
          <h2 className="text-lg font-semibold mb-4 text-orange-600">
            🎯 Promociones Activas
          </h2>
          <form onSubmit={handleSubmitPromo} className="space-y-2 mb-6">
            <Input
              placeholder="Título de la promoción"
              value={form.promocionTitulo || ""}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  promocionTitulo: e.target.value,
                }))
              }
            />
            <Input
              placeholder="Descripción"
              value={form.promocionDescripcion || ""}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  promocionDescripcion: e.target.value,
                }))
              }
            />
            <Input
              placeholder="URL de imagen"
              value={form.promocionImagenUrl || ""}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  promocionImagenUrl: e.target.value,
                }))
              }
            />
            <div className="flex space-x-2">
              <Input
                type="date"
                value={form.promocionFechaInicio || ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    promocionFechaInicio: e.target.value,
                  }))
                }
              />
              <Input
                type="date"
                value={form.promocionFechaFin || ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    promocionFechaFin: e.target.value,
                  }))
                }
              />
            </div>
            <Button
              type="submit"
              className="bg-orange-500 text-white hover:bg-orange-600"
            >
              {promoEditandoId ? "Actualizar promoción" : "Publicar Promoción"}
            </Button>
            {wasSaved && (
              <p className="text-green-600 text-sm mt-2">
                {promoEditandoId
                  ? "✅ ¡Promoción actualizada con éxito!"
                  : "✅ ¡Promoción publicada con éxito!"}
              </p>
            )}
          </form>

          <div>
            <h3 className="font-semibold text-sm mb-2">
              Promociones Publicadas:
            </h3>
            <ul className="space-y-2 text-sm">
              {promociones.map((promo) => (
                <li key={promo.id} className="border p-3 rounded">
                  <div className="font-semibold">{promo.titulo}</div>
                  <div>{promo.descripcion}</div>
                  {promo.imagen_url && (
                    <img
                      src={promo.imagen_url}
                      alt={promo.titulo}
                      className="mt-1 rounded max-h-32"
                    />
                  )}
                  <div className="text-xs text-gray-500 mt-1">
                    Vigencia: {promo.fecha_inicio} a {promo.fecha_fin}
                  </div>
                  <button
                    onClick={async () => {
                      const confirmed = window.confirm(
                        "¿Estás seguro de eliminar esta promoción?"
                      );
                      if (!confirmed) return;
                      const { error } = await supabase
                        .from("promociones")
                        .delete()
                        .eq("id", promo.id);
                      if (error) {
                        console.error(
                          "❌ Error al eliminar la promoción:",
                          error.message
                        );
                        toast({
                          title: "Error",
                          description: "No se pudo eliminar la promoción.",
                        });
                      } else {
                        setPromociones((prev) =>
                          prev.filter((p) => p.id !== promo.id)
                        );
                        toast({
                          title: "✅ Eliminada",
                          description:
                            "La promoción fue eliminada exitosamente.",
                        });
                      }
                    }}
                    className="mt-2 text-sm text-red-600 hover:underline"
                  >
                    Eliminar promoción
                  </button>
                  <button
                    onClick={() => {
                      setForm((prev) => ({
                        ...prev,
                        promocionTitulo: promo.titulo,
                        promocionDescripcion: promo.descripcion,
                        promocionImagenUrl: promo.imagen_url,
                        promocionFechaInicio: promo.fecha_inicio,
                        promocionFechaFin: promo.fecha_fin,
                      }));
                      setPromoEditandoId(promo.id);
                    }}
                    className="ml-4 text-sm text-blue-600 hover:underline"
                  >
                    Editar promoción
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <div className="flex items-center space-x-3 mt-6">
        <Mail className="h-4 w-4 text-orange-500 flex-shrink-0" />
        <span className="text-gray-300 text-sm">contacto@iztapamarket.com</span>
      </div>
    </div>
  );
};

export default MiNegocioPage;
