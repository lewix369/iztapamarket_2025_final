import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Store, Mail, Phone, MapPin, Facebook, Instagram } from "lucide-react";

const CONTACT_PHONE = import.meta.env.VITE_CONTACT_PHONE || "+52 56 5306 9259";
const CONTACT_PHONE_DIGITS = CONTACT_PHONE.replace(/\D+/g, "");
const WHATSAPP_LINK = `https://wa.me/${CONTACT_PHONE_DIGITS}?text=${encodeURIComponent(
  "Hola, vengo de IztapaMarket"
)}`;

const Footer = () => {
  return (
    <footer className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="space-y-4"
          >
            <div className="flex items-center space-x-2">
              <Store className="h-8 w-8 text-orange-500" />
              <span className="text-xl font-bold">IztapaMarket</span>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed">
              IztapaMarket: el directorio local que impulsa tu negocio.
              Promoción, diseño, video y marketing digital en un solo lugar.
            </p>
            <div className="flex space-x-4">
              <a
                href="https://www.facebook.com/iztapamarket"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-blue-600 rounded-full hover:bg-blue-700 transition-colors"
                aria-label="Facebook de IztapaMarket"
              >
                <Facebook className="h-4 w-4" />
              </a>
              <a
                href="https://www.instagram.com/iztapamarket"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-pink-600 rounded-full hover:bg-pink-700 transition-colors"
                aria-label="Instagram de IztapaMarket"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href="https://www.tiktok.com/@iztapamarket"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-black rounded-full hover:bg-gray-800 transition-colors"
                aria-label="TikTok de IztapaMarket"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="white"
                  viewBox="0 0 448 512"
                  className="h-4 w-4"
                >
                  <path d="M448,209.2v125.8c0,30.9-25.1,56-56,56H56c-30.9,0-56-25.1-56-56V209.2H0V176h448v33.2H448z M233.7,103.5l-38.6,49.4h38.6V103.5z M368,320c0,52.9-43.1,96-96,96s-96-43.1-96-96s43.1-96,96-96S368,267.1,368,320z" />
                </svg>
              </a>
            </div>
          </motion.div>

          {/* Quick Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
          >
            <span className="text-lg font-semibold text-orange-500">
              Enlaces Rápidos
            </span>
            <nav className="space-y-2">
              <Link
                to="/"
                className="block text-gray-300 hover:text-white transition-colors"
              >
                Inicio
              </Link>
              <Link
                to="/negocios"
                className="block text-gray-300 hover:text-white transition-colors"
              >
                Directorio
              </Link>
              <Link
                to="/planes"
                className="block text-gray-300 hover:text-white transition-colors"
              >
                Planes y Precios
              </Link>
              <Link
                to="/admin"
                className="block text-gray-300 hover:text-white transition-colors"
              >
                Panel Admin
              </Link>
            </nav>
          </motion.div>

          {/* Categories */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            <span className="text-lg font-semibold text-orange-500">
              Categorías
            </span>
            <nav className="space-y-2">
              <span className="block text-gray-300 hover:text-white transition-colors cursor-pointer">
                Restaurantes
              </span>
              <span className="block text-gray-300 hover:text-white transition-colors cursor-pointer">
                Servicios
              </span>
              <span className="block text-gray-300 hover:text-white transition-colors cursor-pointer">
                Comercios
              </span>
              <span className="block text-gray-300 hover:text-white transition-colors cursor-pointer">
                Entretenimiento
              </span>
            </nav>
          </motion.div>

          {/* Contact Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="space-y-4"
          >
            <span className="text-lg font-semibold text-orange-500">
              Contacto
            </span>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <MapPin className="h-4 w-4 text-orange-500 flex-shrink-0" />
                <span className="text-gray-300 text-sm">
                  Iztapalapa, Ciudad de México
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <Phone className="h-4 w-4 text-orange-500 flex-shrink-0" />
                <a
                  href={`tel:${CONTACT_PHONE.replace(/\s+/g, "")}`}
                  className="text-gray-300 text-sm hover:text-white transition-colors"
                >
                  {CONTACT_PHONE}
                </a>
              </div>
              <div className="flex items-center space-x-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 448 512"
                  className="h-4 w-4 text-green-500 flex-shrink-0"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M380.9 97.1C339-3 224.8-32.8 137.5 24.7 50.2 82.2 20.5 196.4 77.9 283.7l-20.7 75.8c-2.1 7.8 5.2 15.1 13 13l75.8-20.7c87.2 57.5 201.5 27.8 258.9-59.5 57.5-87.3 27.8-201.5-24-195.2zm-127 269.6c-36.5 0-72.3-10.6-103-30.7l-7.4-4.8-45 12.3 12.1-44.3-4.9-7.5c-40.6-61.9-27.8-144.7 29.6-191.9 57.4-47.2 141.3-40.3 191.2 15.4 49.9 55.7 47.2 140.4-6.2 192.7-18.7 18.7-41.8 32.1-67 39.7-9.9 3-20.2 4.7-30.4 4.8zm60.8-92.2c-3.3-1.6-19.5-9.6-22.5-10.7-3-1.1-5.2-1.6-7.4 1.6s-8.5 10.7-10.4 12.9c-1.9 2.2-3.7 2.4-6.9.8-3.3-1.6-13.7-5.1-26-16.3-9.6-8.6-16-19.2-17.9-22.4-1.9-3.3-.2-5.1 1.4-6.7 1.4-1.4 3.3-3.7 4.9-5.5 1.6-1.9 2.2-3.3 3.3-5.5 1.1-2.2.6-4.1-.3-5.7-.9-1.6-7.4-17.9-10.1-24.6-2.6-6.2-5.3-5.4-7.4-5.5-1.9-.1-4.1-.1-6.3-.1s-5.7.8-8.7 4.1c-3 3.3-11.5 11.2-11.5 27.3s11.8 31.6 13.4 33.8c1.6 2.2 23.2 35.4 56.2 49.6 7.9 3.4 14.1 5.4 18.9 6.9 7.9 2.5 15.1 2.1 20.8 1.3 6.3-.9 19.5-8 22.3-15.7 2.8-7.7 2.8-14.3 1.9-15.7-.8-1.4-3-2.2-6.3-3.8z"
                  />
                </svg>
                <a
                  href={WHATSAPP_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-300 text-sm hover:text-white transition-colors"
                  aria-label="Abrir chat de WhatsApp"
                >
                  WhatsApp
                </a>
              </div>
              <div className="flex items-center space-x-3">
                <Mail className="h-4 w-4 text-orange-500 flex-shrink-0" />
                <span className="text-gray-300 text-sm">
                  contacto@iztapamarket.com
                </span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bottom Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-12 pt-8 border-t border-gray-700"
        >
          <div className="flex flex-col justify-center items-center space-y-2 text-center">
            <p className="text-gray-400 text-sm">
              © {new Date().getFullYear()} IztapaMarket™. Todos los derechos
              reservados.
            </p>
            <p className="text-gray-400 text-sm">
              Desarrollado por{" "}
              <a
                href="https://levelcreativelab.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
                aria-label="Desarrollado por Level Creative Lab (se abre en una nueva pestaña)"
              >
                Level Creative Lab
              </a>
            </p>
            <div className="flex space-x-6 text-sm mt-2">
              <Link
                to="/terminos"
                className="text-gray-400 hover:text-white transition-colors"
              >
                Términos de Uso
              </Link>
              <Link
                to="/privacidad"
                className="text-gray-400 hover:text-white transition-colors"
              >
                Política de Privacidad
              </Link>
              <Link
                to="/soporte"
                className="text-gray-400 hover:text-white transition-colors"
              >
                Soporte
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </footer>
  );
};

export default Footer;
