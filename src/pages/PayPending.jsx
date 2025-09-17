import React from "react";
import { useSearchParams, Link } from "react-router-dom";

export default function PayPending() {
  const [params] = useSearchParams();
  const email = params.get("email") || "";
  const plan = (params.get("plan") || "").toLowerCase();

  return (
    <div className="max-w-lg mx-auto p-6 bg-white shadow rounded mt-10">
      <h1 className="text-2xl font-bold text-amber-600">Pago pendiente</h1>
      <p className="mt-3 text-gray-700">
        Tu pago quedó en revisión o pendiente de confirmación.
      </p>

      {(email || plan) && (
        <div className="mt-4 text-sm text-gray-600 space-y-1">
          {email && (
            <div>
              <b>Email:</b> {email}
            </div>
          )}
          {plan && (
            <div>
              <b>Plan:</b> {plan}
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <Link
          to="/mi-negocio"
          className="px-4 py-2 bg-black text-white rounded"
        >
          Ir a mi negocio
        </Link>
        <Link to="/" className="px-4 py-2 border rounded">
          Inicio
        </Link>
      </div>
    </div>
  );
}
