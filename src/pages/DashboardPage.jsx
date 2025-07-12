import React from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { LogOut, Settings, BarChart3, Package } from 'lucide-react';

const DashboardPage = () => {
  const { user, logout } = useAuth();
  const { toast } = useToast();

  const handleLogout = () => {
    logout();
    toast({
      title: "Sesión cerrada",
      description: "Has cerrado sesión correctamente.",
    });
  };

  const handleFeatureClick = () => {
    toast({
      title: "🚧 Función en desarrollo",
      description: "¡Esta característica estará disponible pronto!",
    });
  };

  return (
    <>
      <Helmet>
        <title>Dashboard - IztapaMarket</title>
        <meta name="description" content="Panel de control administrativo." />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900 text-white">
        <header className="bg-white/5 backdrop-blur-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <BarChart3 className="h-8 w-8 text-purple-400" />
                </div>
                <div className="ml-4">
                  <h1 className="text-xl font-bold">Dashboard</h1>
                  <p className="text-sm text-gray-400">Bienvenido, {user?.email}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="text-gray-300 hover:bg-white/10 hover:text-white"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </header>

        <main>
          <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <motion.div
              className="px-4 py-6 sm:px-0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <Card className="bg-white/10 backdrop-blur-lg border-white/20">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Package className="text-purple-400" />
                      <span>Gestionar Productos</span>
                    </CardTitle>
                    <CardDescription className="text-gray-300">
                      Añade, edita y elimina productos de tu catálogo.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={handleFeatureClick} className="w-full bg-purple-600 hover:bg-purple-700">Ir a Productos</Button>
                  </CardContent>
                </Card>

                <Card className="bg-white/10 backdrop-blur-lg border-white/20">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <BarChart3 className="text-purple-400" />
                      <span>Ver Analíticas</span>
                    </CardTitle>
                    <CardDescription className="text-gray-300">
                      Revisa el rendimiento de tus ventas y visitas.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={handleFeatureClick} className="w-full bg-purple-600 hover:bg-purple-700">Ver Reportes</Button>
                  </CardContent>
                </Card>

                <Card className="bg-white/10 backdrop-blur-lg border-white/20">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Settings className="text-purple-400" />
                      <span>Configuración</span>
                    </CardTitle>
                    <CardDescription className="text-gray-300">
                      Ajusta la configuración de tu cuenta y tienda.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={handleFeatureClick} className="w-full bg-purple-600 hover:bg-purple-700">Ajustar</Button>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          </div>
        </main>
      </div>
    </>
  );
};

export default DashboardPage;