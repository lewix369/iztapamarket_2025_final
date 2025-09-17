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

/**
 * Ahora muestra SIEMPRE los campos base (sirve para FREE también).
 * Si luego quieres campos extra para pro/premium, usa plan === 'pro' || 'premium'
 * dentro del JSX para agregarlos condicionalmente.
 */
const PlanFields = ({ plan = "free", formData, handleChange }) => {
  // Campos comunes a todos los planes (incluido FREE)
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

      {/* Ejemplo de campos SOLO para planes de pago, por si luego los quieres:
      {(plan === "pro" || plan === "premium") && (
        <>
          <LabeledInput
            label="Horario detallado"
            name="horario"
            value={formData.horario || ""}
            onChange={handleChange}
            placeholder="Lun-Dom 9:00–18:00"
          />
        </>
      )}
      */}
    </>
  );
};

export default PlanFields;
