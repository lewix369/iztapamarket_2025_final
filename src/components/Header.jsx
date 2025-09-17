import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, Store, User, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/use-toast";
import { useSession } from "@/contexts/SessionContext";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { user } = useSession();
  const isAdmin =
    user?.email?.toLowerCase() === "luis.carrillo.laguna@gmail.com" &&
    (import.meta.env.DEV || import.meta.env.VITE_SHOW_ADMIN === "true");

  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = () => {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (deferredPrompt && !isIOS) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === "accepted") {
          console.log("Usuario aceptó instalar la app");
        } else {
          console.log("Usuario canceló la instalación");
        }
        setDeferredPrompt(null);
      });
    } else {
      navigate("/descargar");
      toast({
        title: "ℹ️ Cómo instalar IztapaMarket",
        description: isIOS
          ? "En iPhone/iPad: toca Compartir → 'Añadir a pantalla de inicio'."
          : "Si tu navegador no muestra el diálogo, sigue los pasos en la página.",
      });
    }
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md shadow-lg">
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

          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  const { error } = await supabase.auth.signOut();
                  if (!error) {
                    window.location.href = "/";
                  }
                }}
                className="text-gray-700 hover:text-red-600"
              >
                <User className="h-4 w-4 mr-2" /> Cerrar sesión
              </Button>
            ) : (
              <Link to="/login">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-700 hover:text-blue-600"
                >
                  <User className="h-4 w-4 mr-2" /> Ingresar
                </Button>
              </Link>
            )}

            {isAdmin && (
              <Link to="/admin">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-blue-200 text-blue-600 hover:bg-blue-50"
                >
                  <Settings className="h-4 w-4 mr-2" /> Admin
                </Button>
              </Link>
            )}

            {/* ✅ Fix: usar asChild para que el Link sea el elemento clickeable */}
            <Button
              asChild
              size="sm"
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Link to="/registro/free" aria-label="Registrar Negocio">
                Registrar Negocio
              </Link>
            </Button>

            <Button
              size="sm"
              onClick={handleInstallClick}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              title="Instalar la app en tu dispositivo"
            >
              Descargar App
            </Button>
          </div>

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

        {isMenuOpen && (
          <div className="md:hidden border-t bg-white/95 backdrop-blur-md">
            <div className="px-4 py-6 space-y-4">
              <nav className="space-y-2">
                {[
                  { path: "/", label: "Inicio" },
                  { path: "/negocios", label: "Negocios" },
                  { path: "/planes", label: "Planes" },
                  ...(isAdmin
                    ? [{ path: "/admin", label: "Panel Admin" }]
                    : []),
                  { path: "/registro/free", label: "Registrar Negocio" },
                  { path: "/descargar", label: "Descargar App" },
                ].map(({ path, label }) => {
                  if (path === "/descargar") {
                    return (
                      <button
                        key={path}
                        type="button"
                        className={`block w-full text-left py-2 font-medium transition-colors ${
                          isActive(path) ? "text-blue-600" : "text-gray-700"
                        }`}
                        onClick={() => {
                          setIsMenuOpen(false);
                          handleInstallClick();
                        }}
                        title="Instalar la app en tu dispositivo"
                      >
                        {label}
                      </button>
                    );
                  }
                  return (
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
                  );
                })}
              </nav>

              <div className="pt-4 border-t">
                {user ? (
                  <Button
                    variant="outline"
                    className="w-full justify-start text-red-600"
                    onClick={async () => {
                      const { error } = await supabase.auth.signOut();
                      if (!error) {
                        window.location.href = "/";
                      }
                    }}
                  >
                    <User className="h-4 w-4 mr-2" /> Cerrar sesión
                  </Button>
                ) : (
                  <Link to="/login">
                    <Button variant="outline" className="w-full justify-start">
                      <User className="h-4 w-4 mr-2" /> Ingresar
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
