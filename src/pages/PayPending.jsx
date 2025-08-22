import { Link } from "react-router-dom";

export default function PayPending() {
  return (
    <main className="container mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-amber-600 mb-4">Pago pendiente</h1>
      <p className="mb-6">Mercado Pago está procesando tu transacción.</p>

      <Link
        to="/"
        className="inline-block px-4 py-2 bg-gray-800 text-white rounded"
      >
        Ir al inicio
      </Link>
    </main>
  );
}
