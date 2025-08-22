// ✅ RegistroFreeSuccess.jsx
import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { toast } from "react-hot-toast";

const RegistroFreeSuccess = () => {
  useEffect(() => {
    toast.success("¡Registro exitoso! Revisa tu publicación pronto.");
  }, []);

  return (
    <main className="flex-grow flex flex-col items-center justify-center px-4 py-10 text-center">
      <h1 className="text-3xl md:text-4xl font-bold text-green-600 mb-6">
        🎉 ¡Tu negocio ha sido registrado!
      </h1>
      <p className="text-gray-700 text-lg mb-6 max-w-xl">
        Gracias por confiar en <strong>IztapaMarket</strong>. Hemos recibido tu
        registro y será revisado para su publicación.
      </p>
      <Link to="/negocios">
        <Button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 text-lg">
          Ver negocios publicados
        </Button>
      </Link>
    </main>
  );
};

// Esta página es usada únicamente para el plan Free. No requiere lógica de pago.
export default RegistroFreeSuccess;
