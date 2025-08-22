import React from "react";
import { motion } from "framer-motion";
import {
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  Clock,
  Edit,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const AdminBusinessTable = ({
  businesses = [],
  onApprove = () => {},
  onReject = () => {},
  onDelete = () => {},
  onEdit = () => {},
}) => {
  const getStatus = (business) => {
    if (business?.is_deleted) {
      return (
        <Badge variant="destructive" className="italic">
          Eliminado
        </Badge>
      );
    }

    const approved =
      business?.is_approved === true ||
      business?.status === true ||
      (typeof business?.estado === "string" &&
        business.estado.toLowerCase() === "aprobado");

    const rejected =
      business?.is_approved === false ||
      business?.status === false ||
      (typeof business?.estado === "string" &&
        business.estado.toLowerCase() === "rechazado");

    if (approved) {
      return (
        <Badge
          variant="outline"
          className="text-green-600 border-green-600 bg-green-50"
        >
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Aprobado
        </Badge>
      );
    }

    if (rejected) {
      return (
        <Badge variant="destructive">
          <XCircle className="mr-1 h-3 w-3" />
          Rechazado
        </Badge>
      );
    }

    return (
      <Badge variant="secondary">
        <Clock className="mr-1 h-3 w-3" />
        Pendiente
      </Badge>
    );
  };

  const getPlanVariant = (plan) => {
    switch (plan?.toLowerCase()) {
      case "premium":
        return "orange";
      case "pro":
        return "blue";
      default:
        return "secondary";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead className="hidden md:table-cell">Categoría</TableHead>
              <TableHead className="hidden lg:table-cell">Plan</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden md:table-cell">Teléfono</TableHead>
              <TableHead className="hidden lg:table-cell">
                Fecha Registro
              </TableHead>
              <TableHead>
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(Array.isArray(businesses)
              ? businesses.filter((b) => !b.is_deleted)
              : []
            ).map((business) => (
              <TableRow key={business.id} className={""}>
                <TableCell className="font-medium">{business.nombre}</TableCell>
                <TableCell className="hidden md:table-cell">
                  {business.categoria}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <Badge variant={getPlanVariant(business?.plan_type)}>
                    {business?.plan_type || "—"}
                  </Badge>
                </TableCell>
                <TableCell>{getStatus(business)}</TableCell>
                <TableCell className="hidden md:table-cell">
                  {business.telefono || "N/A"}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {business?.created_at
                    ? new Date(business.created_at).toLocaleDateString()
                    : "—"}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button aria-haspopup="true" size="icon" variant="ghost">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Toggle menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {!business.is_deleted ? (
                        <>
                          <DropdownMenuItem
                            onClick={() => onApprove(business.id)}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                            Aprobar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onReject(business.id)}
                          >
                            <XCircle className="mr-2 h-4 w-4 text-yellow-500" />
                            Rechazar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEdit(business)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => {
                              // Hard delete del negocio
                              onDelete(business.id); // HARD DELETE
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </>
                      ) : (
                        <DropdownMenuItem
                          disabled
                          className="italic text-gray-400"
                        >
                          Ya eliminado
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </motion.div>
  );
};

export default AdminBusinessTable;
