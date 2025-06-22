import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Edit, Trash2 } from "lucide-react";

const BusinessListItem = ({
  business,
  index,
  onEdit,
  onDelete,
  onApprove,
  onReject,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className="hover:shadow-lg transition-shadow">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h3 className="text-xl font-semibold text-gray-900">
                  {business.nombre}
                </h3>
                <Badge
                  variant={
                    business.plan_type === "Premium"
                      ? "orange"
                      : business.plan_type === "Pro"
                      ? "blue"
                      : "secondary"
                  }
                >
                  {business.plan_type}
                </Badge>
                {business.is_featured && (
                  <Badge
                    variant="outline"
                    className="text-yellow-600 border-yellow-600"
                  >
                    Destacado
                  </Badge>
                )}
              </div>
              <p className="text-orange-600 font-medium mb-2">
                {business.categoria}
              </p>
              <p className="text-gray-600 mb-3 text-sm truncate max-w-md">
                {business.descripcion}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-xs text-gray-500">
                <div>
                  <span className="font-medium">Dirección:</span>{" "}
                  {business.direccion || "N/A"}
                </div>
                <div>
                  <span className="font-medium">Teléfono:</span>{" "}
                  {business.telefono || "N/A"}
                </div>
                <div>
                  <span className="font-medium">Horarios:</span>{" "}
                  {business.hours || "N/A"}
                </div>
              </div>
            </div>

            <div className="flex space-x-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(`/negocio/${business.slug}`, "_blank")
                }
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(business)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(business.id)}
                className="text-red-600 hover:text-red-700 hover:border-red-300"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              {business.is_approved ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-yellow-600 hover:text-yellow-700 hover:border-yellow-300"
                  onClick={() => {
                    console.log(
                      "🔴 Click en botón Rechazar para negocio ID:",
                      business.id
                    );
                    alert("Botón Rechazar presionado para " + business.nombre);
                    if (typeof onReject === "function") {
                      onReject(business.id);
                    } else {
                      console.warn(
                        "onReject no está definido o no es una función"
                      );
                    }
                  }}
                >
                  Rechazar
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-green-600 hover:text-green-700 hover:border-green-300"
                  onClick={() => {
                    console.log(
                      "🟢 Click en botón Aprobar para negocio ID:",
                      business.id
                    );
                    alert("Botón Aprobar presionado para " + business.nombre);
                    if (typeof onApprove === "function") {
                      onApprove(business.id);
                    } else {
                      console.warn(
                        "onApprove no está definido o no es una función"
                      );
                    }
                  }}
                >
                  Aprobar
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => console.log("⚙️ Prueba OK", business.id)}
              >
                Test
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default BusinessListItem;
