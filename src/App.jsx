import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import Home from "@/pages/Home";
import BusinessListPage from "@/pages/BusinessListPage";
import BusinessDetailPage from "@/pages/BusinessDetailPage";
import Precios from "@/pages/Precios";
import RegisterBusinessPage from "@/pages/RegisterBusinessPage";
import AdminPage from "@/pages/AdminPage";
import SuccessPage from "@/pages/SuccessPage";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

function App() {
  return (
    <Router>
      <Layout />
    </Router>
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
          <Route path="/success" element={<SuccessPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </main>
      {!hideHeaderFooterRoutes.includes(location.pathname) && <Footer />}
    </>
  );
}

export default App;
