import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Store,
  Mail,
  Phone,
  MapPin,
  Facebook,
  Instagram,
  Twitter,
} from "lucide-react";

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
                href="https://www.facebook.com/share/1MY6fYQhRV/?mibextid=wwXIfr"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-blue-600 rounded-full hover:bg-blue-700 transition-colors"
              >
                <Facebook className="h-4 w-4" />
              </a>
              <div className="p-2 bg-pink-600 rounded-full hover:bg-pink-700 transition-colors cursor-pointer">
                <Instagram className="h-4 w-4" />
              </div>
              <a
                href="https://www.tiktok.com/@iztapamarket"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-black rounded-full hover:bg-gray-800 transition-colors"
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
                <span className="text-gray-300 text-sm">+52 55 3069 8200</span>
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
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-gray-400 text-sm">
              © {new Date().getFullYear()} IztapaMarket™. Todos los derechos
              reservados.
            </p>
            <div className="flex space-x-6 text-sm">
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
