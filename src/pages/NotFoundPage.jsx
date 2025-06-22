import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Search, ArrowLeft } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';

const NotFoundPage = () => {
  return (
    <div className="min-h-screen">
      <Header />
      
      <section className="py-20 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-8 max-w-2xl mx-auto"
          >
            {/* 404 Animation */}
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="relative"
            >
              <div className="text-8xl md:text-9xl font-bold text-gradient mb-4">
                404
              </div>
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                className="absolute -top-4 -right-4 text-4xl"
              >
                🔍
              </motion.div>
            </motion.div>

            {/* Content */}
            <div className="space-y-4">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
                ¡Oops! Página no encontrada
              </h1>
              <p className="text-xl text-gray-600 leading-relaxed">
                La página que buscas no existe o ha sido movida. 
                Pero no te preocupes, te ayudamos a encontrar lo que necesitas.
              </p>
            </div>

            {/* Suggestions */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="bg-white rounded-2xl p-8 shadow-lg border"
            >
              <h3 className="text-xl font-semibold text-gray-900 mb-6">
                ¿Qué puedes hacer?
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                    <Home className="h-8 w-8 text-blue-600" />
                  </div>
                  <h4 className="font-semibold">Ir al Inicio</h4>
                  <p className="text-sm text-gray-600">
                    Regresa a la página principal
                  </p>
                </div>
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
                    <Search className="h-8 w-8 text-orange-600" />
                  </div>
                  <h4 className="font-semibold">Buscar Negocios</h4>
                  <p className="text-sm text-gray-600">
                    Explora nuestro directorio
                  </p>
                </div>
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <ArrowLeft className="h-8 w-8 text-green-600" />
                  </div>
                  <h4 className="font-semibold">Volver Atrás</h4>
                  <p className="text-sm text-gray-600">
                    Regresa a la página anterior
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link to="/">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-orange-600 hover:from-blue-700 hover:to-orange-700 text-white px-8 py-3 shadow-lg"
                >
                  <Home className="mr-2 h-5 w-5" />
                  Ir al Inicio
                </Button>
              </Link>
              <Link to="/negocios">
                <Button
                  variant="outline"
                  size="lg"
                  className="border-blue-200 text-blue-600 hover:bg-blue-50 px-8 py-3"
                >
                  <Search className="mr-2 h-5 w-5" />
                  Ver Negocios
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="lg"
                onClick={() => window.history.back()}
                className="text-gray-600 hover:text-gray-900 px-8 py-3"
              >
                <ArrowLeft className="mr-2 h-5 w-5" />
                Volver Atrás
              </Button>
            </motion.div>

            {/* Fun Element */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="text-center pt-8"
            >
              <p className="text-gray-500 text-sm">
                💡 <strong>Tip:</strong> Usa la barra de búsqueda en el header para encontrar negocios específicos
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default NotFoundPage;