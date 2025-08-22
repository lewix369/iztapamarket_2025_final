import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const LoginPage = () => {
  const [searchParams] = useSearchParams();
  const defaultEmail = searchParams.get("email") || "";
  const [email, setEmail] = useState(defaultEmail);
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
      // Mostrar el user_id autenticado por consola
      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      if (userData?.user?.id) {
        console.log("✅ user_id:", userData.user.id);
      } else {
        console.error("❌ No se pudo obtener el user_id", userError);
      }
      const userId = String(userData?.user?.id).trim();
      if (!userId) {
        console.error("❌ userId no disponible");
        alert("No se pudo autenticar correctamente.");
        return;
      }
      // Log explícito tras obtener el userId
      console.log("🧩 userId obtenido tras login:", userId);
      alert("✅ Inicio de sesión exitoso");
      if (userId) {
        const ADMIN_EMAIL = "luis.carrillo.laguna@gmail.com";
        if (email === ADMIN_EMAIL) {
          navigate("/admin");
        } else {
          // Depuración del tipo de userId
          console.log("🔎 Tipo de userId:", typeof userId);
          // Consulta de negocios con logs extendidos
          const { data: negocios, error: negocioError } = await supabase
            .from("negocios")
            .select("*")
            .eq("user_id", userId);
          // Validación y logs para comparar userId vs user_id
          if (negocios && negocios.length > 0) {
            console.log("✅ user_id negocio:", negocios[0].user_id);
            console.log("🧩 Comparando con:", userId);
          }

          console.log("🧠 userId:", userId);
          console.log("📦 Resultado negocios:", negocios);
          console.log("🐞 Error en negocios:", negocioError);

          if (negocioError) {
            console.error("❌ Error al obtener el negocio:", negocioError);
            alert("❌ Error en la consulta de negocios.");
            navigate("/");
            return;
          }

          if (!negocios || negocios.length === 0) {
            console.warn(
              "⚠️ No se encontró ningún negocio asociado al user_id:",
              userId
            );
            alert("❌ No tienes un negocio registrado todavía.");
            navigate("/");
            return;
          }

          const negocio = negocios[0];
          console.log("✅ Negocio encontrado:", negocio);
          const plan = negocio.plan_type;

          if (plan === "pro" || plan === "premium") {
            navigate("/mi-negocio");
          } else {
            alert("Tu plan actual no tiene acceso a esta sección.");
            navigate("/");
          }
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
