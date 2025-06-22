import React, { useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient'; 
import { getBusinessBySlug } from '@/lib/database';

const SeoUpdater = () => {
  const location = useLocation();
  const params = useParams();

  useEffect(() => {
    const updateMetaTags = async (title, description) => {
      document.title = title;
      
      let metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute('content', description);
      } else {
        metaDescription = document.createElement('meta');
        metaDescription.name = 'description';
        metaDescription.content = description;
        document.head.appendChild(metaDescription);
      }

      let ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) {
        ogTitle.setAttribute('content', title);
      } else {
        ogTitle = document.createElement('meta');
        ogTitle.property = 'og:title';
        ogTitle.content = title;
        document.head.appendChild(ogTitle);
      }

      let ogDescription = document.querySelector('meta[property="og:description"]');
      if (ogDescription) {
        ogDescription.setAttribute('content', description);
      } else {
        ogDescription = document.createElement('meta');
        ogDescription.property = 'og:description';
        ogDescription.content = description;
        document.head.appendChild(ogDescription);
      }
    };

    const path = location.pathname;
    let title = "IztapaMarket - Directorio de Negocios";
    let description = "Encuentra los mejores negocios locales en Iztapa. Servicios, productos y más.";

    if (path === '/') {
      title = "IztapaMarket - Inicio | Directorio de Negocios en Iztapa";
      description = "Descubre y conecta con los mejores negocios locales en Iztapa, Guatemala. Restaurantes, hoteles, servicios y más.";
    } else if (path === '/negocios') {
      title = "Directorio de Negocios en Iztapa | IztapaMarket";
      description = "Explora todos los negocios en Iztapa. Filtra por categoría, servicios y encuentra lo que necesitas.";
    } else if (path.startsWith('/negocios/categoria/')) {
      const categorySlug = params.categorySlug;
      const categoryName = categorySlug ? categorySlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Categoría';
      title = `${categoryName} en Iztapa | IztapaMarket`;
      description = `Encuentra los mejores negocios de ${categoryName} en Iztapa. Actualizado y completo.`;
    } else if (path.startsWith('/negocio/')) {
      const businessSlug = params.slug;
      if (businessSlug) {
        getBusinessBySlug(businessSlug).then(business => {
          if (business) {
            const businessTitle = `${business.nombre} | IztapaMarket`;
            const businessDescription = business.descripcion ? business.descripcion.substring(0, 160) : `Información sobre ${business.nombre} en Iztapa.`;
            updateMetaTags(businessTitle, businessDescription);
          }
        });
        return; 
      }
    } else if (path === '/planes') {
      title = "Planes y Precios para Negocios | IztapaMarket";
      description = "Elige el plan perfecto para tu negocio en Iztapa. Desde listados gratuitos hasta opciones premium.";
    } else if (path === '/admin') {
      title = "Panel de Administración | IztapaMarket";
      description = "Gestiona tu cuenta y listados de negocios en IztapaMarket.";
    }

    updateMetaTags(title, description);

  }, [location, params]);

  return null;
};

export default SeoUpdater;