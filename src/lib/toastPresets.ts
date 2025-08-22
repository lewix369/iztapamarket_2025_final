// src/lib/toastPresets.ts
// Pequeño helper para unificar estilos/mensajes de toast.
// No importa ni usa `useToast` aquí. Solo devuelve el payload que espera `toast()`.

type ToastPayload = {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
};

export const toastPresets = {
  info(description: string, title = "Información"): ToastPayload {
    return { title, description };
  },

  success(description: string, title = "Listo"): ToastPayload {
    return { title, description };
  },

  error(description: string, title = "Error"): ToastPayload {
    return { title, description, variant: "destructive" };
  },
};
