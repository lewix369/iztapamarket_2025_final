import React from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
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
import MiNegocioPage from "@/pages/MiNegocioPage";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RequireAdmin from "@/components/RequireAdmin";
import CategoryBusinessesPage from "@/pages/CategoryBusinessesPage";
import RegistroFreeSuccess from "@/pages/RegistroFreeSuccess";

function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}

function Layout() {
  const location = useLocation();
  const hideHeaderFooterRoutes = ["/admin"];

  return (
    <>
      {!hideHeaderFooterRoutes.includes(location.pathname) && <Header />}
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/negocios" element={<BusinessListPage />} />
          <Route path="/negocio/:slug" element={<BusinessDetailPage />} />
          <Route path="/planes" element={<Precios />} />
          <Route path="/registro" element={<RegisterBusinessPage />} />
          <Route path="/registro/:plan" element={<RegisterBusinessPage />} />
          <Route path="/success" element={<RegistroSuccess />} />
          <Route path="/registro-exitoso" element={<RegistroFreeSuccess />} />
          <Route
            path="/categorias/:slug"
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
        </Routes>
      </main>
      {!hideHeaderFooterRoutes.includes(location.pathname) && <Footer />}
    </>
  );
}

export default App;
