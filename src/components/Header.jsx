import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Menu, X, Store, User, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const { toast } = useToast();

  const handleAuthClick = () => {
    toast({
      title: "🚧 Esta función no está implementada aún",
      description:
        "¡Pero no te preocupes! ¡Puedes solicitarla en tu próximo prompt! 🚀",
    });
  };

  const isActive = (path) => location.pathname === path;

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md shadow-lg"
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="relative">
              <Store className="h-8 w-8 text-blue-600" />
              <div className="absolute -top-1 -right-1 h-3 w-3 bg-orange-500 rounded-full animate-pulse" />
            </div>
            <span className="text-xl font-bold text-blue-700">
              IztapaMarket
            </span>
          </Link>

          {/* Navegación en escritorio */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              to="/"
              className={`font-medium ${
                isActive("/") ? "text-blue-600" : "text-gray-700"
              } hover:text-blue-600`}
            >
              Inicio
            </Link>
            <Link
              to="/negocios"
              className={`font-medium ${
                isActive("/negocios") ? "text-blue-600" : "text-gray-700"
              } hover:text-blue-600`}
            >
              Negocios
            </Link>
            <Link
              to="/planes"
              className={`font-medium ${
                isActive("/planes") ? "text-orange-600" : "text-gray-700"
              } hover:text-orange-600`}
            >
              Planes
            </Link>
          </nav>

          {/* Botones escritorio */}
          <div className="hidden md:flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAuthClick}
              className="text-gray-700 hover:text-blue-600"
            >
              <User className="h-4 w-4 mr-2" /> Ingresar
            </Button>
            <Link to="/admin">
              <Button
                variant="outline"
                size="sm"
                className="border-blue-200 text-blue-600 hover:bg-blue-50"
              >
                <Settings className="h-4 w-4 mr-2" /> Admin
              </Button>
            </Link>
            <Link to="/registro/free">
              <Button
                size="sm"
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                Registrar Negocio
              </Button>
            </Link>
          </div>

          {/* Botón menú móvil */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </Button>
        </div>

        {/* Menú móvil */}
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t bg-white/95 backdrop-blur-md"
          >
            <div className="px-4 py-6 space-y-4">
              <nav className="space-y-2">
                {[
                  { path: "/", label: "Inicio" },
                  { path: "/negocios", label: "Negocios" },
                  { path: "/planes", label: "Planes" },
                  { path: "/admin", label: "Panel Admin" },
                  { path: "/registro/free", label: "Registrar Negocio" },
                ].map(({ path, label }) => (
                  <Link
                    key={path}
                    to={path}
                    className={`block py-2 font-medium transition-colors ${
                      isActive(path)
                        ? path === "/planes"
                          ? "text-orange-600"
                          : "text-blue-600"
                        : "text-gray-700"
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
              <div className="pt-4 border-t">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleAuthClick}
                >
                  <User className="h-4 w-4 mr-2" /> Ingresar
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.header>
  );
};

export default Header;
