import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError("Correo o contraseña incorrectos.");
      console.error(error);
    } else {
      setEmail("");
      setPassword("");
      const userId = data.user?.id;
      alert("✅ Inicio de sesión exitoso");
      if (userId) {
        const ADMIN_EMAIL = "luis.carrillo.laguna@gmail.com";
        if (email === ADMIN_EMAIL) {
          navigate("/admin");
        } else {
          navigate("/mi-negocio");
        }
      }
    }
  };

  return (
    <>
      <Helmet>
        <title>Iniciar Sesión - IztapaMarket</title>
      </Helmet>
      <div className="max-w-md mx-auto py-10">
        <h1 className="text-2xl font-bold mb-6">Iniciar Sesión</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <Label htmlFor="email">Correo</Label>
            <Input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="password">Contraseña</Label>
            <Input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-red-500">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Ingresando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </>
  );
};

export default LoginPage;
