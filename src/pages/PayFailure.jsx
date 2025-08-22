import { Link } from "react-router-dom";

export default function PayFailure() {
  return (
    <main className="container mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-red-700 mb-4">Pago rechazado</h1>
      <p className="mb-6">
        Tu pago no se completó. Puedes intentar nuevamente.
      </p>

      <Link
        to="/register-business?plan=premium"
        className="inline-block px-4 py-2 bg-blue-600 text-white rounded"
      >
        Volver a intentar
      </Link>
    </main>
  );
}
