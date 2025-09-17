// src/pages/CrearCuentaPage.jsx
import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { createPreference } from "@/lib/CreatePreference";

// Normaliza cualquier redirect para evitar mandar al Home
const normalizeRedirect = (value) => {
  const v = (value || "").trim();
  if (!v || v === "/" || v === "#/" || v === "#") return "/mi-negocio";
  return v;
};

// Extrae ?plan=... de un string de ruta tipo "/registro?..."
const getPlanFromNext = (nextStr) => {
  try {
    const q = nextStr.includes("?") ? nextStr.split("?")[1] : "";
    const p = new URLSearchParams(q).get("plan");
    return (p || "").toLowerCase();
  } catch {
    return "";
  }
};

const CrearCuentaPage = () => {
  const [searchParams] = useSearchParams();
  const emailDefault = (searchParams.get("email") || "").trim();
  const rawNext = searchParams.get("next") || "/mi-negocio";
  const next = normalizeRedirect(rawNext);

  const [email, setEmail] = useState(emailDefault);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();

    const emailClean = email.trim().toLowerCase();

    if (!emailClean || !password) {
      toast({ title: "Faltan campos por llenar" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Las contraseñas no coinciden" });
      return;
    }

    setLoading(true);
    try {
      // Callback de confirmación (detecta HashRouter según el `#` en la URL actual)
      const origin = window.location.origin;
      const usesHashRouter = window.location.hash !== ""; // si hay hash, usamos /#/auth/callback
      const callback = usesHashRouter
        ? `${origin}/#/auth/callback?redirect=${encodeURIComponent(next)}`
        : `${origin}/auth/callback?redirect=${encodeURIComponent(next)}`;
      console.log("[CrearCuenta] emailRedirectTo:", callback);

      try {
        localStorage.setItem("post_login_redirect", next);
      } catch {}

      const { error: signUpError } = await supabase.auth.signUp({
        email: emailClean,
        password,
        options: { emailRedirectTo: callback },
      });

      if (signUpError) {
        toast({
          title: "Error al crear cuenta",
          description: signUpError.message || "Inténtalo de nuevo.",
          variant: "destructive",
        });
        return;
      }

      // ¿El proyecto queda logueado inmediatamente?
      let { data: sessionData } = await supabase.auth.getSession();

      // ---------------- DEV ONLY: autologin si aún no hay sesión ----------------
      // En desarrollo, intenta iniciar sesión con la contraseña recién creada
      // para evitar depender del correo de confirmación/magic link.
      if (import.meta?.env?.DEV && !sessionData?.session) {
        try {
          const { error: lpError } = await supabase.auth.signInWithPassword({
            email: emailClean,
            password,
          });
          if (lpError) {
            console.warn(
              "[DEV autologin] signInWithPassword error:",
              lpError?.message || lpError
            );
          } else {
            ({ data: sessionData } = await supabase.auth.getSession());
          }
        } catch (e) {
          console.warn("[DEV autologin] exception:", e);
        }
      }
      // -------------------------------------------------------------------------

      const hasSession = !!sessionData?.session;

      if (hasSession) {
        toast({ title: "Cuenta creada y sesión iniciada" });

        // ¿Viene con plan? Si es pro/premium, abrimos checkout directo
        const plan = getPlanFromNext(next);
        if (plan === "pro" || plan === "premium") {
          try {
            const initUrl = await createPreference(plan, emailClean);
            if (initUrl && initUrl.startsWith("http")) {
              window.location.href = initUrl; // redirección a Mercado Pago
              return;
            }
            toast({
              title: "No se pudo iniciar el pago",
              description: "Intenta de nuevo o elige otro método.",
              variant: "destructive",
            });
          } catch (e) {
            toast({
              title: "Error al iniciar el pago",
              description: e?.message || "Inténtalo nuevamente.",
              variant: "destructive",
            });
          }
        }

        // Si no hay plan, o es free: sigue el flujo original
        let target = next;
        if (next.startsWith("/registro")) {
          const sep = next.includes("?") ? "&" : "?";
          target = `${next}${sep}email=${encodeURIComponent(
            emailClean
          )}&auto=1`;
        }
        navigate(target, { replace: true });
        return;
      }

      // Si requiere confirmar por correo
      toast({
        title: "Revisa tu correo para confirmar",
        description:
          "Te enviamos un enlace de confirmación. Después podrás continuar con el registro.",
      });

      // Opción de entrar con magic link (email precargado)
      try {
        localStorage.setItem("post_login_redirect", next);
      } catch {}
      navigate(
        `/login?redirect=${encodeURIComponent(next)}&email=${encodeURIComponent(
          emailClean
        )}`,
        { replace: true }
      );
    } catch (err) {
      toast({
        title: "Error inesperado",
        description: err?.message || "Inténtalo nuevamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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
          required
        />
        <Input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="Confirmar Contraseña"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creando..." : "Crear Cuenta"}
        </Button>
      </form>
      <p className="mt-3 text-xs text-gray-500">
        Al crear tu cuenta podrías recibir un correo para confirmarla. Después,
        te llevaremos automáticamente a continuar el registro.
      </p>
    </div>
  );
};

export default CrearCuentaPage;
