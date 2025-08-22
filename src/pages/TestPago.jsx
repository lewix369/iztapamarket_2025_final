import React from "react";
import { createPreference } from "@/lib/CreatePreference";

function TestPago() {
  const handleClick = async (plan) => {
    const initPoint = await createPreference(plan);

    if (initPoint) {
      window.location.href = initPoint;
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <button
        onClick={() => handleClick("premium")}
        className="px-6 py-3 bg-orange-600 text-white rounded-lg"
      >
        Probar pago Premium
      </button>
      <button
        onClick={() => handleClick("pro")}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg"
      >
        Probar pago Pro
      </button>
    </div>
  );
}

export default TestPago;
