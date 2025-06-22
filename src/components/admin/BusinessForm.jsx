import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';

const BusinessForm = ({ initialData, onSubmit, onCancel, categoriesList }) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    nombre: '',
    categoria: '',
    descripcion: '',
    direccion: '',
    telefono: '',
    hours: '',
    plan_type: 'Free',
    imagen_url: '',
    logo_url: '',
    web: '',
    facebook: '',
    instagram: '',
    whatsapp: '',
    mapa_embed_url: '',
    video_embed_url: '',
    services: [],
    gallery_images: [],
    is_featured: false,
  });
  const [isGeneratingAIContent, setIsGeneratingAIContent] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        nombre: initialData.nombre || '',
        categoria: initialData.categoria || '',
        descripcion: initialData.descripcion || '',
        direccion: initialData.direccion || '',
        telefono: initialData.telefono || '',
        hours: initialData.hours || '',
        plan_type: initialData.plan_type || 'Free',
        imagen_url: initialData.imagen_url || '',
        logo_url: initialData.logo_url || '',
        web: initialData.web || '',
        facebook: initialData.facebook || '',
        instagram: initialData.instagram || '',
        whatsapp: initialData.whatsapp || '',
        mapa_embed_url: initialData.mapa_embed_url || '',
        video_embed_url: initialData.video_embed_url || '',
        services: initialData.services || [],
        gallery_images: initialData.gallery_images || [],
        is_featured: initialData.is_featured || false,
      });
    } else {
      setFormData({
        nombre: '', categoria: '', descripcion: '', direccion: '', telefono: '',
        hours: '', plan_type: 'Free', imagen_url: '', logo_url: '', web: '',
        facebook: '', instagram: '', whatsapp: '', mapa_embed_url: '', video_embed_url: '',
        services: [], gallery_images: [], is_featured: false,
      });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSwitchChange = (name, checked) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleGenerateAIContent = async () => {
    if (!formData.nombre || !formData.categoria) {
      toast({
        title: "Información requerida",
        description: "Por favor, ingresa el nombre y la categoría del negocio para generar contenido con IA.",
        variant: "destructive",
      });
      return;
    }
    setIsGeneratingAIContent(true);
    toast({
      title: "⚙️ Generando contenido con IA...",
      description: "Esto podría tomar un momento."
    });

    try {
      // Simulación de llamada a la IA. Reemplazar con la llamada real.
      // const { data: aiData, error: aiError } = await supabase.functions.invoke('generate-business-content', {
      //   body: { name: formData.nombre, category: formData.categoria }
      // });
      // if (aiError) throw aiError;

      // Simulación de respuesta de IA
      await new Promise(resolve => setTimeout(resolve, 2000)); 
      const aiData = {
        titulo: `Increíble ${formData.categoria}: ${formData.nombre}`,
        descripcion: `Descubre ${formData.nombre}, el mejor lugar para ${formData.categoria.toLowerCase()} en Iztapa. Ofrecemos servicios de alta calidad y una experiencia inolvidable. ¡Visítanos!`,
        horarios: "Lunes a Viernes: 9 AM - 6 PM, Sábados: 10 AM - 4 PM",
        imagen_url: `https://source.unsplash.com/random/800x600/?${formData.categoria.toLowerCase()}`,
        logo_url: `https://source.unsplash.com/random/200x200/?logo,${formData.categoria.toLowerCase()}`
      };

      setFormData(prev => ({
        ...prev,
        nombre: aiData.titulo || prev.nombre,
        descripcion: aiData.descripcion || prev.descripcion,
        hours: aiData.horarios || prev.hours,
        imagen_url: aiData.imagen_url || prev.imagen_url,
        logo_url: aiData.logo_url || prev.logo_url,
      }));
      toast({
        title: "✅ Contenido generado",
        description: "El contenido sugerido por IA ha sido aplicado."
      });
    } catch (error) {
      console.error("Error generando contenido con IA:", error);
      toast({
        title: "❌ Error de IA",
        description: "No se pudo generar el contenido con IA. Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAIContent(false);
    }
  };


  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
      <Button type="button" onClick={handleGenerateAIContent} disabled={isGeneratingAIContent} className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white">
        {isGeneratingAIContent ? "Generando..." : "✨ Generar Contenido con IA"}
      </Button>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="nombre" className="block text-sm font-medium mb-1">Nombre del Negocio *</Label>
          <Input id="nombre" name="nombre" value={formData.nombre} onChange={handleChange} placeholder="Ej: Restaurante El Malecón" required />
        </div>
        <div>
          <Label htmlFor="categoria" className="block text-sm font-medium mb-1">Categoría *</Label>
          <Select value={formData.categoria} onValueChange={(value) => handleSelectChange('categoria', value)}>
            <SelectTrigger id="categoria"><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger>
            <SelectContent>
              {categoriesList.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
               <SelectItem value="Otra">Otra (especificar)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div>
        <Label htmlFor="descripcion" className="block text-sm font-medium mb-1">Descripción *</Label>
        <Textarea id="descripcion" name="descripcion" value={formData.descripcion} onChange={handleChange} placeholder="Describe el negocio..." required />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><Label htmlFor="direccion" className="block text-sm font-medium mb-1">Dirección</Label><Input id="direccion" name="direccion" value={formData.direccion} onChange={handleChange} /></div>
        <div><Label htmlFor="telefono" className="block text-sm font-medium mb-1">Teléfono</Label><Input id="telefono" name="telefono" value={formData.telefono} onChange={handleChange} /></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><Label htmlFor="hours" className="block text-sm font-medium mb-1">Horarios</Label><Input id="hours" name="hours" value={formData.hours} onChange={handleChange} /></div>
        <div>
          <Label htmlFor="plan_type" className="block text-sm font-medium mb-1">Plan</Label>
          <Select value={formData.plan_type} onValueChange={(value) => handleSelectChange('plan_type', value)}>
            <SelectTrigger id="plan_type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Free">Free</SelectItem>
              <SelectItem value="Pro">Pro</SelectItem>
              <SelectItem value="Premium">Premium</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><Label htmlFor="imagen_url" className="block text-sm font-medium mb-1">URL Imagen Principal</Label><Input id="imagen_url" name="imagen_url" value={formData.imagen_url} onChange={handleChange} /></div>
        <div><Label htmlFor="logo_url" className="block text-sm font-medium mb-1">URL Logo</Label><Input id="logo_url" name="logo_url" value={formData.logo_url} onChange={handleChange} /></div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><Label htmlFor="web" className="block text-sm font-medium mb-1">Sitio Web</Label><Input id="web" name="web" value={formData.web} onChange={handleChange} /></div>
        <div><Label htmlFor="whatsapp" className="block text-sm font-medium mb-1">WhatsApp</Label><Input id="whatsapp" name="whatsapp" value={formData.whatsapp} onChange={handleChange} placeholder="+50212345678" /></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><Label htmlFor="facebook" className="block text-sm font-medium mb-1">Facebook URL</Label><Input id="facebook" name="facebook" value={formData.facebook} onChange={handleChange} /></div>
        <div><Label htmlFor="instagram" className="block text-sm font-medium mb-1">Instagram URL</Label><Input id="instagram" name="instagram" value={formData.instagram} onChange={handleChange} /></div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><Label htmlFor="mapa_embed_url" className="block text-sm font-medium mb-1">URL Embed Mapa</Label><Input id="mapa_embed_url" name="mapa_embed_url" value={formData.mapa_embed_url} onChange={handleChange} /></div>
        <div><Label htmlFor="video_embed_url" className="block text-sm font-medium mb-1">URL Embed Video</Label><Input id="video_embed_url" name="video_embed_url" value={formData.video_embed_url} onChange={handleChange} /></div>
      </div>

      <div>
        <Label htmlFor="services" className="block text-sm font-medium mb-1">Servicios (separados por coma)</Label>
        <Input 
          id="services"
          name="services" 
          value={Array.isArray(formData.services) ? formData.services.join(',') : ''} 
          onChange={(e) => handleSelectChange('services', e.target.value.split(','))} 
        />
      </div>
      <div>
        <Label htmlFor="gallery_images" className="block text-sm font-medium mb-1">URLs Galería Imágenes (separadas por coma)</Label>
        <Textarea 
          id="gallery_images"
          name="gallery_images" 
          value={Array.isArray(formData.gallery_images) ? formData.gallery_images.join(',') : ''}
          onChange={(e) => handleSelectChange('gallery_images', e.target.value.split(','))} 
        />
      </div>
       <div className="flex items-center space-x-2">
        <Switch id="is_featured" checked={formData.is_featured} onCheckedChange={(checked) => handleSwitchChange('is_featured', checked)} />
        <Label htmlFor="is_featured" className="text-sm font-medium">Destacado</Label>
      </div>

      <div className="flex justify-end space-x-4 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700">{initialData ? 'Actualizar' : 'Agregar'} Negocio</Button>
      </div>
    </form>
  );
};

export default BusinessForm;