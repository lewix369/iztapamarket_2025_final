import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const LabeledInput = ({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
}) => (
  <div className="mb-4">
    <label className="block mb-1 text-sm font-medium text-gray-700">
      {label}
    </label>
    <Input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
    />
  </div>
);

const LabeledTextarea = ({ label, name, value, onChange, placeholder }) => (
  <div className="mb-4">
    <label className="block mb-1 text-sm font-medium text-gray-700">
      {label}
    </label>
    <Textarea
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
    />
  </div>
);

const PlanFields = ({ plan, formData, handleChange }) => {
  if (plan !== "pro" && plan !== "premium") return null;

  return (
    <>
      <LabeledInput
        label="Nombre del negocio"
        name="nombre"
        value={formData.nombre || ""}
        onChange={handleChange}
        placeholder="Ej. Taquería El Fogón"
      />

      <LabeledInput
        label="Categoría"
        name="categoria"
        value={formData.categoria || ""}
        onChange={handleChange}
        placeholder="Ej. Alimentos y bebidas"
      />

      <LabeledInput
        label="Teléfono"
        name="telefono"
        value={formData.telefono || ""}
        onChange={handleChange}
        placeholder="Ej. 5512345678"
      />

      <LabeledTextarea
        label="Dirección"
        name="direccion"
        value={formData.direccion || ""}
        onChange={handleChange}
        placeholder="Calle, colonia, alcaldía, CDMX"
      />

      <LabeledInput
        label="Correo electrónico"
        name="email"
        value={formData.email || ""}
        onChange={handleChange}
        placeholder="ejemplo@correo.com"
        type="email"
      />
    </>
  );
};

export default PlanFields;
