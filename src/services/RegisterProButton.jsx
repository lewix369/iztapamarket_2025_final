import { useState } from "react";
import { createPreference } from "../services/createPreference";

function RegisterProButton() {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const initPoint = await createPreference();
      window.location.href = initPoint;
    } catch (error) {
      alert("Error al generar el enlace de pago.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600"
      disabled={loading}
    >
      {loading ? "Redirigiendo a pago..." : "Pagar Plan PRO $149"}
    </button>
  );
}

export default RegisterProButton;
