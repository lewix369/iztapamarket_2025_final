// src/components/PrivateRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <p className="text-white text-center p-10">Cargando...</p>; // Puedes mejorar el diseño luego
  }

  return isAuthenticated ? children : <Navigate to="/ingresar" replace />;
};

export default PrivateRoute;
