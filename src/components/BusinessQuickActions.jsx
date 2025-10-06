import React from "react";
import { Button } from "@/components/ui/button";
import { Phone, MessageCircle, MapPin, Truck } from "lucide-react";

const isPaidPlan = (plan) =>
  ["pro", "premium"].includes((plan || "").toLowerCase());
const isValidUrl = (u) => /^https?:\/\//i.test(u || "");
const ensureTel = (t) => (t ? `tel:${t.replace(/\s+/g, "")}` : "");
const ensureWa = (w) => (w ? `https://wa.me/${w.replace(/\D/g, "")}` : "");

export default function BusinessQuickActions({ business }) {
  const {
    telefono,
    whatsapp,
    direccion,
    mapa_embed_url,
    plan_type,
    delivery_url,
  } = business || {};

  const goMaps = () => {
    // Si tienes coords/iframe, abre Google Maps con la dirección/coords
    const q = encodeURIComponent(direccion || "");
    const url = `https://www.google.com/maps/search/?api=1&query=${q}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleDeliveryClick = () => {
    try {
      window.gtag?.("event", "click_delivery", {
        business_id: business?.id,
        plan_type,
      });
    } catch {}
  };

  return (
    <div className="flex flex-wrap gap-2">
      {/* Llamar */}
      {telefono && (
        <a href={ensureTel(telefono)} aria-label="Llamar">
          <Button variant="secondary" className="gap-2">
            <Phone className="w-4 h-4" />
            Llamar
          </Button>
        </a>
      )}

      {/* WhatsApp */}
      {whatsapp && (
        <a
          href={ensureWa(whatsapp)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WhatsApp"
        >
          <Button variant="secondary" className="gap-2">
            <MessageCircle className="w-4 h-4" />
            WhatsApp
          </Button>
        </a>
      )}

      {/* Cómo llegar */}
      {(direccion || mapa_embed_url) && (
        <Button
          variant="secondary"
          className="gap-2"
          onClick={goMaps}
          aria-label="Cómo llegar"
        >
          <MapPin className="w-4 h-4" />
          Cómo llegar
        </Button>
      )}

      {/* 🔥 Entrega (solo PRO/PREMIUM + URL válida) */}
      {isPaidPlan(plan_type) && isValidUrl(delivery_url) && (
        <a
          href={delivery_url}
          target="_blank"
          rel="noopener nofollow noreferrer"
          aria-label="Entrega a domicilio"
          onClick={handleDeliveryClick}
        >
          <Button className="gap-2">
            <Truck className="w-4 h-4" />
            Entrega
          </Button>
        </a>
      )}
    </div>
  );
}
