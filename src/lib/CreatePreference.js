export const createPreference = async (plan, email) => {
  try {
    if (
      !plan ||
      typeof plan !== "string" ||
      !email ||
      typeof email !== "string"
    ) {
      console.error("❌ Parámetros inválidos para crear preferencia:", {
        plan,
        email,
      });
      return null;
    }
    console.log("🧪 Debug - Valor recibido de plan:", plan, typeof plan);
    console.log("🧪 Debug - Valor recibido de email:", email, typeof email);
    const payload = {
      plan: plan.toLowerCase(),
      email: email.trim(),
    };

    console.log("📤 Enviando preferencia al backend:", payload);

    const response = await fetch("http://localhost:3000/create_preference", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(
        `Error del servidor: ${response.status} - ${errorDetails}`
      );
    }

    const data = await response.json();
    console.log("📦 Data cruda de respuesta JSON:", data);
    console.log("✅ Respuesta del backend:", data);

    if (!data.init_point) {
      throw new Error(
        "❌ init_point no está definido en la respuesta del backend."
      );
    }

    return `${data.init_point}?email=${encodeURIComponent(
      email
    )}&plan=${encodeURIComponent(plan)}`;
  } catch (error) {
    console.error("❌ Error al crear preferencia:", error.message || error);
    return null;
  }
};
