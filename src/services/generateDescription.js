import axios from "axios";

const EDGE_URL =
  import.meta.env.VITE_SUPABASE_EDGE_URL || "http://127.0.0.1:54321";

export const generarDescripcion = async ({ nombre, categoria, servicios }) => {
  try {
    const res = await axios.post(
      `${EDGE_URL}/functions/v1/generate-description`,
      { nombre, categoria, servicios }
    );
    return res?.data?.descripcion ?? null;
  } catch (error) {
    console.error(
      "Error al generar descripción:",
      error?.response?.data || error.message
    );
    return null;
  }
};
