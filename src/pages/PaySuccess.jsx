import { useEffect, useMemo } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";

export default function PaySuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  // Construimos la URL de destino una sola vez
  const nextUrl = useMemo(() => {
    const plan = (params.get("plan") || "premium").toLowerCase();
    const email = (params.get("email") || "").trim();
    const q = new URLSearchParams({ plan, paid: "true" });
    if (email) q.set("email", email);
    return `/registro?${q.toString()}`;
  }, [params]);

  useEffect(() => {
    const status = (
      params.get("collection_status") ||
      params.get("status") ||
      ""
    )
      .toString()
      .toLowerCase();

    // Mercado Pago suele devolver "approved"; añadimos un alias por si regresa "success"
    if (status === "approved" || status === "success") {
      navigate(nextUrl, { replace: true });
    }
  }, [params, navigate, nextUrl]);

  return (
    <main className="container mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-green-700 mb-4">
        ¡Pago aprobado!
      </h1>
      <p className="mb-6">
        Gracias por tu compra. Ahora puedes completar tu registro.
      </p>
      <Link
        to={nextUrl}
        className="inline-block px-4 py-2 bg-blue-600 text-white rounded"
      >
        Continuar con el registro
      </Link>
    </main>
  );
}
