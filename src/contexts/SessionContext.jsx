// src/contexts/SessionContext.jsx
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export const SessionContext = createContext(null);

export const SessionProvider = ({ children }) => {
  const [user, setUser] = useState(undefined);   // undefined => cargando
  const [session, setSession] = useState(undefined);
  const [loading, setLoading] = useState(true);

  // Evita redirecciones duplicadas (React 18 StrictMode monta efectos 2 veces en dev)
  const didRedirectRef = useRef(false);

  const getRedirectSignal = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const fromQuery = params.get("redirect");
      const fromStorage = localStorage.getItem("post_login_redirect");
      return { fromQuery, fromStorage };
    } catch {
      return { fromQuery: null, fromStorage: null };
    }
  };

  const doPostLoginRedirect = () => {
    if (didRedirectRef.current) return; // ya redirigimos
    didRedirectRef.current = true;

    try {
      const { fromQuery, fromStorage } = getRedirectSignal();
      const target = fromStorage || fromQuery;

      // Si no hay señal de redirect, no hagas nada para evitar parpadeo
      if (!target) return;

      // limpiar storage para no re-redirigir
      localStorage.removeItem("post_login_redirect");

      // reemplaza el historial (evita volver con "atrás")
      window.location.replace(target);
    } catch {
      /* noop */
    }
  };

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (error) console.error("Error obteniendo sesión:", error);

      if (!isMounted) return;

      setUser(session?.user || null);
      setSession(session || null);

      // ⚠️ IMPORTANTE: solo redirige si hay bandera de redirect
      const { fromQuery, fromStorage } = getRedirectSignal();
      if (session && (fromQuery || fromStorage)) {
        doPostLoginRedirect();
      }

      setLoading(false);
    };

    init();

    // Escuchar cambios de auth
    const { data: { subscription } = { subscription: null } } =
      supabase.auth.onAuthStateChange((event, session) => {
        if (!isMounted) return;

        console.log("🔄 Cambio de sesión:", event, session);
        setUser(session?.user || null);
        setSession(session || null);
        setLoading(false);

        // Redirige solo cuando realmente se acaba de iniciar sesión
        if (event === "SIGNED_IN") {
          const { fromQuery, fromStorage } = getRedirectSignal();
          if (fromQuery || fromStorage) doPostLoginRedirect();
        }
      });

    return () => {
      isMounted = false;
      // ✅ forma correcta en supabase-js v2
      subscription?.unsubscribe?.();
    };
  }, []);

  const value = {
    user,
    session,
    loading,
    isAuthenticated: !!user && !!session,
  };

  // ⛳️ Evita pintar la app hasta conocer el estado de sesión
  // (quita el parpadeo de vistas protegidas/redirects)
  if (loading) {
    return (
      <div className="w-full h-screen grid place-items-center text-gray-600">
        Cargando…
      </div>
    );
  }

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
};

export const useSession = () => {
  const ctx = useContext(SessionContext);
  if (!ctx)
    throw new Error("useSession debe usarse dentro de SessionProvider");
  return ctx;
};