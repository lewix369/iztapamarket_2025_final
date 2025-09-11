// src/pages/RegistroPremiumSuccess.jsx
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function RegistroPremiumSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    // Clona todos los parámetros que vengan de Mercado Pago (email, payment_id, status, etc.)
    const params = new URLSearchParams(searchParams);

    // Asegura plan=premium (por si no vino)
    if (!params.get("plan")) params.set("plan", "premium");

    // Normaliza estado de éxito por compatibilidad (status / collection_status)
    if (!params.get("status") && !params.get("collection_status")) {
      params.set("status", "success");
    }

    // Redirige al formulario oficial de registro, donde se valida la sesión y
    // (si hay sesión) se inserta el negocio con user_id.
    navigate(`/registro?${params.toString()}`, { replace: true });
  }, [navigate, searchParams]);

  // UI mínima mientras ocurre la redirección
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
      <h1 className="text-2xl font-semibold mb-2">Procesando compra…</h1>
      <p className="text-gray-600">Redirigiendo al formulario de registro.</p>
    </main>
  );
}
