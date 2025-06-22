import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import * as db from "@/lib/database";
import { Button } from "@/components/ui/button";

function AdminPage() {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchBusinesses = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("negocios")
      .select("*")
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error al cargar negocios:", error);
      setBusinesses([]);
    } else {
      const visibles = data.filter((b) => !b.is_deleted);
      setBusinesses(visibles);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBusinesses();
  }, []);

  const handleApprove = async (id) => {
    try {
      await db.updateApprovalStatus(supabase, id, true);
      console.log("✅ Negocio aprobado correctamente:", {
        businessId: id,
        status: true,
      });
      fetchBusinesses();
    } catch (error) {
      console.error("Error al aprobar negocio:", error);
    }
  };

  const handleReject = async (id) => {
    try {
      await db.updateApprovalStatus(supabase, id, false);
      console.log("❌ Negocio rechazado correctamente:", {
        businessId: id,
        status: false,
      });
      fetchBusinesses();
    } catch (error) {
      console.error("Error al rechazar negocio:", error);
    }
  };

  const handleDelete = async (id) => {
    try {
      console.log("🗑 Eliminando negocio con ID:", id);
      await db.softDeleteBusiness(supabase, id);
      setBusinesses((prev) => prev.filter((b) => b.id !== id));
    } catch (error) {
      console.error("Error al eliminar negocio:", error);
    }
  };

  if (loading) return <p className="p-6">Cargando negocios pendientes...</p>;

  if (businesses.length === 0)
    return <p className="p-6">No hay negocios pendientes.</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Panel de Administración</h1>
      <table className="w-full border">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left p-2">Nombre</th>
            <th className="text-left p-2">Categoría</th>
            <th className="text-left p-2">Teléfono</th>
            <th className="text-left p-2">Dirección</th>
            <th className="text-left p-2">Estado</th>
            <th className="text-left p-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {businesses.map((b) => (
            <tr
              key={b.id}
              className={`border-t ${
                b.is_deleted ? "bg-gray-200 text-gray-500 line-through" : ""
              }`}
            >
              <td className="p-2">{b.nombre}</td>
              <td className="p-2">{b.categoria}</td>
              <td className="p-2">{b.telefono}</td>
              <td className="p-2">{b.direccion}</td>
              <td className="p-2">
                {b.is_deleted
                  ? "Eliminado"
                  : b.is_approved === true
                  ? "Aprobado"
                  : b.is_approved === false
                  ? "Rechazado"
                  : "Pendiente"}
              </td>
              <td className="p-2 space-x-2">
                <Button
                  onClick={() => handleApprove(b.id)}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={b.is_deleted}
                >
                  Aprobar
                </Button>
                <Button
                  onClick={() => handleReject(b.id)}
                  variant="destructive"
                  disabled={b.is_deleted}
                >
                  Rechazar
                </Button>
                <Button
                  onClick={() => handleDelete(b.id)}
                  className="bg-red-600 hover:bg-red-700"
                  disabled={b.is_deleted}
                >
                  Eliminar
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AdminPage;
