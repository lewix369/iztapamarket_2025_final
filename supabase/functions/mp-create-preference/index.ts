import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";

export default function RegistroPremiumSuccess() {
  const [searchParams] = useSearchParams();
  const paymentId =
    searchParams.get("payment_id") || searchParams.get("collection_id") || null;
  const plan = (searchParams.get("plan") || "").toLowerCase();
  const emailFromQuery = (searchParams.get("email") || "").toLowerCase();

  const navigate = useNavigate();

  useEffect(() => {
    // El paymentId puede no venir en todos los flujos; no bloqueamos por eso.
    if (!emailFromQuery) {
      toast.error("⚠️ No recibimos tu correo. Por favor inicia sesión.");
      return navigate("/ingresar");
    }
    console.log(
      "Email recibido tras pago:",
      emailFromQuery,
      "plan:",
      plan,
      "paymentId:",
      paymentId
    );
    const email = emailFromQuery;

    (async () => {
      try {
        // Obtener descripción generada desde función remota
        const response = await fetch(
          `${import.meta.env.VITE_FUNCTIONS_URL}/generate-description`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, plan }),
          }
        );

        if (!response.ok) {
          throw new Error("Error fetching description");
        }

        const { description } = await response.json();

        // Guardar negocio en supabase
        const res = await fetch("/rest/v1/negocios", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            email,
            plan_type: plan || "premium",
            description,
          }),
        });

        if (!res.ok) {
          throw new Error("Error saving business");
        }

        toast.success("Negocio guardado correctamente");
        setTimeout(() => navigate("/mi-negocio"), 2000);
      } catch (error) {
        toast.error("Error al guardar negocio");
      }
    })();
  }, [emailFromQuery, navigate, plan, paymentId]);

  return (
    <div>
      <h1>Registro Premium Exitoso</h1>
      <p>Gracias por tu compra.</p>
    </div>
  );
}
