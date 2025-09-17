// src/hooks/useUserPlan.js
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export function useUserPlan(email) {
  const [plan, setPlan] = useState(null); // 'free' | 'premium' | 'pro' | null
  const [loading, setLoading] = useState(true);

  const emailKey = useMemo(() => (email ?? "").toLowerCase().trim(), [email]);

  useEffect(() => {
    let sub;
    let alive = true;

    async function load() {
      if (!emailKey) {
        setPlan(null);
        setLoading(false);
        return;
      }
      setLoading(true);

      // 1) Lectura inicial
      const { data, error } = await supabase
        .from("profiles")
        .select("plan_type")
        .eq("email", emailKey)
        .maybeSingle();

      if (!alive) return;

      if (error) console.error("useUserPlan fetch error:", error.message);
      setPlan(data?.plan_type ?? null);
      setLoading(false);

      // 2) Realtime: escuchar cambios en esa fila
      sub = supabase
        .channel(`realtime:profiles:${emailKey}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "profiles",
            filter: `email=eq.${emailKey}`,
          },
          (payload) => {
            const next =
              payload?.new?.plan_type ?? payload?.old?.plan_type ?? null;
            setPlan(next);
          }
        )
        .subscribe();
    }

    load();

    return () => {
      alive = false;
      if (sub) supabase.removeChannel(sub);
    };
  }, [emailKey]);

  return { plan, loading, isPremium: plan === "premium" || plan === "pro" };
}
