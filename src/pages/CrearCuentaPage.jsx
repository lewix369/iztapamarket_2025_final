// src/pages/CrearCuentaPage.jsx
import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const CrearCuentaPage = () => {
  const [searchParams] = useSearchParams();
  const emailDefault = searchParams.get("email") || "";
  const [email, setEmail] = useState(emailDefault);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      toast({ title: "Faltan campos por llenar" });
      return;
    }

    if (password !== confirmPassword) {
      toast({ title: "Las contraseñas no coinciden" });
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      toast({ title: "Error al crear cuenta", description: error.message });
    } else {
      toast({ title: "Cuenta creada con éxito" });
      navigate("/mi-negocio");
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-4 bg-white shadow rounded">
      <h2 className="text-xl font-semibold mb-4">Crear Cuenta</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input
          type="password"
          placeholder="Confirmar Contraseña"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <Button type="submit" className="w-full">
          Crear Cuenta
        </Button>
      </form>
    </div>
  );
};

export default CrearCuentaPage;
