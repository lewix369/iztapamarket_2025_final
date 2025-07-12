// src/lib/geocoding.js
export async function getCoordsFromAddress(address) {
  const apiKey = import.meta.env.VITE_OPENCAGE_API_KEY;
  const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(
    address
  )}&key=${apiKey}&language=es&countrycode=mx`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      const { lat, lng } = data.results[0].geometry;
      return { lat, lng };
    } else {
      throw new Error("No se encontraron coordenadas.");
    }
  } catch (error) {
    console.error("Error al obtener coordenadas:", error);
    return null;
  }
}
