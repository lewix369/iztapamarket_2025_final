import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Store } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  getBusinesses as fetchAllBusinesses,
  createBusiness,
  updateBusiness,
  softDeleteBusiness,
  updateApprovalStatus,
  getDistinctCategories,
} from "@/lib/database";
import { supabase } from "@/lib/supabaseClient";
import AdminStats from "@/components/admin/AdminStats";
import BusinessForm from "@/components/admin/BusinessForm";
import AdminBusinessTable from "@/components/admin/AdminBusinessTable";

const AdminPage = () => {
  const [allBusinesses, setAllBusinesses] = useState([]);
  const [filteredBusinesses, setFilteredBusinesses] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("all");
  const [selectedPlanFilter, setSelectedPlanFilter] = useState("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState(null);
  const { toast } = useToast();
  const [allCategories, setAllCategories] = useState([]);

  const planOptions = [
    { value: "all", label: "Todos los planes" },
    { value: "Premium", label: "Premium" },
    { value: "Pro", label: "Profesional" },
    { value: "Free", label: "Gratis" },
  ];

  const statusOptions = [
    { value: "all", label: "Todos los estados" },
    { value: "approved", label: "Aprobado" },
    { value: "pending", label: "Pendiente" },
    { value: "rejected", label: "Rechazado" },
  ];

  const loadInitialData = useCallback(async () => {
    const [allBusinessesData, categoriesData] = await Promise.all([
      fetchAllBusinesses(supabase),
      getDistinctCategories(supabase),
    ]);
    setAllBusinesses(allBusinessesData);
    setAllCategories(["all", ...categoriesData]);
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const applyFilters = useCallback(() => {
    let businessesToFilter = [...allBusinesses];

    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      businessesToFilter = businessesToFilter.filter(
        (business) =>
          business.nombre.toLowerCase().includes(lowercasedTerm) ||
          business.categoria.toLowerCase().includes(lowercasedTerm)
      );
    }

    if (selectedCategoryFilter !== "all") {
      businessesToFilter = businessesToFilter.filter(
        (business) => business.categoria === selectedCategoryFilter
      );
    }

    if (selectedPlanFilter !== "all") {
      businessesToFilter = businessesToFilter.filter(
        (business) => business.plan_type === selectedPlanFilter
      );
    }

    if (selectedStatusFilter !== "all") {
      businessesToFilter = businessesToFilter.filter((business) => {
        if (selectedStatusFilter === "approved")
          return business.is_approved === true;
        if (selectedStatusFilter === "rejected")
          return business.is_approved === false;
        if (selectedStatusFilter === "pending")
          return business.is_approved === null;
        return true;
      });
    }

    setFilteredBusinesses(businessesToFilter);
  }, [
    allBusinesses,
    searchTerm,
    selectedCategoryFilter,
    selectedPlanFilter,
    selectedStatusFilter,
  ]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const refreshData = async () => {
    await loadInitialData();
    applyFilters();
  };

  const handleFormSubmit = async (formData) => {
    let result;
    if (editingBusiness) {
      result = await updateBusiness(supabase, editingBusiness.id, formData);
      toast({
        title: "✅ Negocio actualizado",
        description: `${result.nombre} ha sido actualizado.`,
      });
    } else {
      result = await createBusiness(supabase, formData);
      toast({
        title: "✅ Negocio agregado",
        description: `${result.nombre} ha sido agregado.`,
      });
    }

    if (result) {
      await refreshData();
      setIsFormOpen(false);
      setEditingBusiness(null);
    } else {
      toast({
        title: "❌ Error",
        description: "Hubo un problema al guardar el negocio.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (business) => {
    setEditingBusiness(business);
    setIsFormOpen(true);
  };

  const handleApprove = async (id) => {
    await updateApprovalStatus(supabase, id, true);
    toast({
      title: "✅ Aprobado",
      description: "El negocio ha sido aprobado.",
    });
    await refreshData();
  };

  const handleReject = async (id) => {
    await updateApprovalStatus(supabase, id, false);
    toast({
      title: "⚠️ Rechazado",
      description: "El negocio ha sido marcado como rechazado.",
    });
    await refreshData();
  };

  const handleSoftDelete = async (id) => {
    if (
      window.confirm(
        "¿Estás seguro de que quieres eliminar este negocio? Esta acción es reversible."
      )
    ) {
      await softDeleteBusiness(supabase, id);
      toast({
        title: "🗑️ Eliminado",
        description: "El negocio ha sido movido a la papelera.",
      });
      await refreshData();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                Gestión de Negocios
              </h1>
              <p className="text-gray-500 mt-1">
                Administra, aprueba y edita los negocios de IztapaMarket.
              </p>
            </div>
            <Button
              onClick={() => {
                setEditingBusiness(null);
                setIsFormOpen(true);
              }}
              className="mt-4 md:mt-0 bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" /> Agregar Negocio
            </Button>
          </div>
        </motion.div>

        <AdminStats businesses={allBusinesses} />

        <Card className="mt-8">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Buscar por nombre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full text-black"
                />
              </div>
              <Select
                value={selectedCategoryFilter}
                onValueChange={setSelectedCategoryFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  {allCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category === "all" ? "Todas las categorías" : category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedPlanFilter}
                onValueChange={setSelectedPlanFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Plan" />
                </SelectTrigger>
                <SelectContent>
                  {planOptions.map((plan) => (
                    <SelectItem key={plan.value} value={plan.value}>
                      {plan.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedStatusFilter}
                onValueChange={setSelectedStatusFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingBusiness
                      ? "Editar Negocio"
                      : "Agregar Nuevo Negocio"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingBusiness
                      ? "Modifica la información del negocio"
                      : "Completa la información del nuevo negocio"}
                  </DialogDescription>
                </DialogHeader>
                <BusinessForm
                  initialData={editingBusiness}
                  onSubmit={handleFormSubmit}
                  onCancel={() => {
                    setIsFormOpen(false);
                    setEditingBusiness(null);
                  }}
                  categoriesList={allCategories.filter((cat) => cat !== "all")}
                />
              </DialogContent>
            </Dialog>

            {filteredBusinesses.length > 0 ? (
              <AdminBusinessTable
                businesses={filteredBusinesses}
                onApprove={handleApprove}
                onReject={handleReject}
                onDelete={handleSoftDelete}
                onEdit={handleEdit}
              />
            ) : (
              <div className="text-center py-16">
                <Store className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700">
                  No se encontraron negocios
                </h3>
                <p className="text-gray-500 mt-2">
                  Intenta ajustar tus filtros o agregar un nuevo negocio.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default AdminPage;
