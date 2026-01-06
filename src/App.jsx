import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  Navigate,
  useParams,
  Link,
} from "react-router-dom";

import Home from "@/pages/Home";
import BusinessListPage from "@/pages/BusinessListPage";
import BusinessDetailPage from "@/pages/BusinessDetailPage";
import Precios from "@/pages/Precios";
import RegisterBusinessPage from "@/pages/RegisterBusinessPage";
import AdminPage from "@/pages/AdminPage";
// import RegistroSuccess from "@/services/RegistroSuccess";  // 🔴 Ya no lo usamos
import DownloadPage from "@/pages/DownloadPage";
import Terminos from "@/pages/Terminos";
import Privacidad from "@/pages/Privacidad";
import Soporte from "@/pages/Soporte";
import LoginPage from "@/pages/LoginPage";
import CrearCuentaPage from "@/pages/CrearCuentaPage";
import MiNegocioPage from "@/pages/MiNegocioPage";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RequireAdmin from "@/components/RequireAdmin";
import CategoryBusinessesPage from "@/pages/CategoryBusinessesPage";
import RegistroFreeSuccess from "@/pages/RegistroFreeSuccess";
import RegistroProSuccess from "@/pages/RegistroProSuccess";
import RegistroPremiumSuccess from "@/pages/RegistroPremiumSuccess";
import TestPago from "@/pages/TestPago";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import AuthCallbackPage from "@/pages/AuthCallbackPage";
import DebugUser from "@/components/DebugUser";
import PaySuccess from "@/pages/PaySuccess";
import PayFailure from "@/pages/PayFailure";
import PayPending from "@/pages/PayPending";
import Checkout from "@/pages/Checkout";
// import MagicLinkBridge from "@/pages/MagicLinkBridge"; // ← removido
import { categorias } from "@/data/negocios";

function RedirectRegisterBusiness() {
  const q = window.location.search || "";
  return <Navigate to={`/registro${q}`} replace />;
}

function RedirectRegisterTier() {
  const { tier } = useParams();
  const q = new URLSearchParams(window.location.search);
  if (!q.get("plan") && tier) q.set("plan", tier.toLowerCase());
  const qs = q.toString();
  return <Navigate to={`/registro${qs ? `?${qs}` : ""}`} replace />;
}

function RedirectToCategoriaSlug() {
  const { slug } = useParams();
  const q = window.location.search || "";
  return <Navigate to={`/categorias/${slug}${q}`} replace />;
}

function CategoriesIndexPage() {
  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-[#003366] mb-6">Categorías</h1>
      <p className="text-gray-600 mb-6">
        Explora negocios locales por categoría en Iztapalapa.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categorias.map((cat) => (
          <Link
            key={cat.slug}
            to={`/categorias/${cat.slug}`}
            className="group rounded-xl border bg-white p-5 hover:shadow-md transition"
          >
            <div className="flex items-center gap-3">
              <div className="text-3xl">{cat.icono}</div>
              <div>
                <div className="text-lg font-semibold text-[#003366] group-hover:underline">
                  {cat.nombre}
                </div>
                <div className="text-sm text-gray-500">{cat.descripcion}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function App() {
  console.log("Entorno:", import.meta.env);
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}

function Layout() {
  const location = useLocation();
  const hideHeaderFooterRoutes = ["/admin", "/auth/callback"];
  const shouldHide = hideHeaderFooterRoutes.some((p) =>
    location.pathname.startsWith(p)
  );

  return (
    <>
      {!shouldHide && <Header />}
      <main className="flex-grow">
        <Routes>
          {/* Home sin bridge (ya rediriges a /auth/callback desde el email) */}
          <Route path="/" element={<Home />} />

          <Route path="/negocios" element={<BusinessListPage />} />

          {/* 🔧 FIX: detalle de negocio por slug correcto */}
          <Route path="/negocios/:slug" element={<BusinessDetailPage />} />

          <Route path="/negocio/:slug" element={<BusinessDetailPage />} />
          <Route path="/precios" element={<Precios />} />
          <Route path="/planes" element={<Precios />} />
          <Route path="/checkout" element={<Checkout />} />

          {/* Callbacks de pago */}
          <Route path="/pago/success" element={<PaySuccess />} />
          <Route path="/pago/failure" element={<PayFailure />} />
          <Route path="/pago/pending" element={<PayPending />} />

          {/* RUTA DE REGISTRO OFICIAL */}
          <Route path="/registro" element={<RegisterBusinessPage />} />
          <Route path="/registro/:tier" element={<RedirectRegisterTier />} />

          {/* Compat: ruta vieja */}
          <Route
            path="/register-business"
            element={<RedirectRegisterBusiness />}
          />

          {/* Aliases adicionales / compat */}
          <Route path="/registro-success" element={<PaySuccess />} />
          <Route path="/registro-exitoso" element={<PaySuccess />} />
          <Route path="/registro-error" element={<PayFailure />} />
          <Route path="/registro-pendiente" element={<PayPending />} />
          {/* Alias adicional: éxito de registro con slash */}
          <Route path="/registro/exitoso" element={<RegistroFreeSuccess />} />
          <Route path="/pay-success" element={<PaySuccess />} />
          <Route path="/pay-failure" element={<PayFailure />} />
          <Route path="/pay-pending" element={<PayPending />} />

          <Route
            path="/registro-free-success"
            element={<RegistroFreeSuccess />}
          />
          <Route
            path="/registro-pro-success"
            element={<RegistroProSuccess />}
          />
          <Route
            path="/registro-premium-success"
            element={<RegistroPremiumSuccess />}
          />

          <Route path="/categorias" element={<CategoriesIndexPage />} />
          <Route path="/categorias/:slug" element={<CategoryBusinessesPage />} />

          {/* Legacy routes → canonical */}
          <Route
            path="/categorias-detalle/:slug"
            element={<RedirectToCategoriaSlug />}
          />
          <Route
            path="/negocios/categoria/:slug"
            element={<RedirectToCategoriaSlug />}
          />

          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminPage />
              </RequireAdmin>
            }
          />
          <Route path="/descargar" element={<DownloadPage />} />
          <Route path="/terminos" element={<Terminos />} />
          <Route path="/privacidad" element={<Privacidad />} />
          <Route path="/soporte" element={<Soporte />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/mi-negocio" element={<MiNegocioPage />} />
          <Route path="/crear-cuenta" element={<CrearCuentaPage />} />
          <Route path="/test-pago" element={<TestPago />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/debug-user" element={<DebugUser />} />

          {/* 🚧 Catch-all para rutas desconocidas */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!shouldHide && <Footer />}
      <ToastContainer position="top-center" autoClose={3000} />
    </>
  );
}

export default App;