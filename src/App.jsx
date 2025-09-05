import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  Navigate,
  useParams,
} from "react-router-dom";

import Home from "@/pages/Home";
import BusinessListPage from "@/pages/BusinessListPage";
import BusinessDetailPage from "@/pages/BusinessDetailPage";
import Precios from "@/pages/Precios";
import RegisterBusinessPage from "@/pages/RegisterBusinessPage";
import AdminPage from "@/pages/AdminPage";
import RegistroSuccess from "@/services/RegistroSuccess";
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

function RedirectRegisterBusiness() {
  // Mantén todos los query params (plan, email, status, etc.)
  const q = window.location.search || "";
  return <Navigate to={`/registro${q}`} replace />;
}

function RedirectRegisterTier() {
  // e.g. /registro/free -> /registro?plan=free (preserva otros query params)
  const { tier } = useParams();
  const q = new URLSearchParams(window.location.search);
  if (!q.get("plan") && tier) q.set("plan", tier.toLowerCase());
  const qs = q.toString();
  return <Navigate to={`/registro${qs ? `?${qs}` : ""}`} replace />;
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
          <Route path="/" element={<Home />} />
          <Route path="/negocios" element={<BusinessListPage />} />
          <Route path="/negocios/:slug" element={<CategoryBusinessesPage />} />
          <Route path="/negocio/:slug" element={<BusinessDetailPage />} />
          <Route path="/precios" element={<Precios />} />
          <Route path="/planes" element={<Precios />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/pago/success" element={<PaySuccess />} />
          <Route path="/pago/failure" element={<PayFailure />} />
          <Route path="/pago/pending" element={<PayPending />} />

          {/* RUTA DE REGISTRO OFICIAL */}
          <Route path="/registro" element={<RegisterBusinessPage />} />

          <Route path="/registro/:tier" element={<RedirectRegisterTier />} />

          {/* COMPATIBILIDAD: redirigimos la vieja ruta */}
          <Route
            path="/register-business"
            element={<RedirectRegisterBusiness />}
          />

          <Route path="/registro-success" element={<RegistroSuccess />} />
          <Route path="/registro-exitoso" element={<PaySuccess />} />
          <Route path="/registro-error" element={<PayFailure />} />
          <Route path="/registro-pendiente" element={<PayPending />} />
          {/* Aliases para callbacks directos de Mercado Pago */}
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

          <Route
            path="/categorias/:slug"
            element={<CategoryBusinessesPage />}
          />
          <Route
            path="/negocios/categoria/:slug"
            element={<CategoryBusinessesPage />}
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
        </Routes>
      </main>
      {!shouldHide && <Footer />}
      <ToastContainer position="top-center" autoClose={3000} />
    </>
  );
}

export default App;
