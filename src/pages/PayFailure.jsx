import React from "react";
import { useSearchParams, Link } from "react-router-dom";

export default function PayFailure() {
  const [params] = useSearchParams();
  const reason = params.get("reason") || "";
  const email = params.get("email") || "";
  const plan = (params.get("plan") || "").toLowerCase();

  return (
    <div className="max-w-lg mx-auto p-6 bg-white shadow rounded mt-10">
      <h1 className="text-2xl font-bold text-red-600">Pago rechazado</h1>
      <p className="mt-3 text-gray-700">
        Tu pago no se pudo completar.{" "}
        {reason && (
          <>
            Motivo: <b>{reason}</b>.
          </>
        )}
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
        <Link to="/precios" className="px-4 py-2 bg-black text-white rounded">
          Intentar nuevamente
        </Link>
        <Link to="/" className="px-4 py-2 border rounded">
          Inicio
        </Link>
      </div>
    </div>
  );
}
