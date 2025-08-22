import React from "react";

/**
 * MenuSection
 * Renderiza el campo `menu` de un negocio al final de la ficha pública.
 * - Visible sólo para plan "premium"
 * - Visible sólo para categorías de alimentos/bebidas (por slug o por keywords)
 * - Acepta texto multilinea (1 platillo por línea) o un enlace (PDF/Drive/Web)
 *
 * Uso:
 *   <MenuSection
 *     menu={negocio.menu}
 *     planType={negocio.plan_type}
 *     categoria={negocio.categoria}
 *     slugCategoria={negocio.slug_categoria}
 *   />
 */
const FOOD_SLUGS = new Set([
  "alimentos-bebidas",
  "alimentos",
  "bebidas",
  "comida",
  "comida-bebidas",
  "food-drink",
]);

const FOOD_KEYWORDS = [
  "taquer",
  "restaura",
  "jugos",
  "bar",
  "café",
  "cafeter",
  "pizzer",
  "marisc",
  "antoj",
  "tacos",
  "tortas",
  "hambur",
  "sushi",
  "cocina",
  "pasteler",
  "panader",
  "helad",
  "birria",
];

const isFoodCategory = (categoria = "", slug = "") => {
  const s = (slug || "").toLowerCase().trim();
  const c = (categoria || "").toLowerCase().trim();
  if (FOOD_SLUGS.has(s)) return true;
  return FOOD_KEYWORDS.some((k) => c.includes(k));
};

const isUrl = (str = "") => /^https?:\/\//i.test(str.trim());
const isPdfUrl = (str = "") => isUrl(str) && /\.pdf(\?.*)?$/i.test(str.trim());

const normalizeLines = (text = "") =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

const MenuList = ({ lines = [] }) => (
  <ul className="mt-2 space-y-2 list-disc list-inside text-gray-800">
    {lines.map((line, idx) => (
      <li key={idx} className="leading-relaxed">
        {line}
      </li>
    ))}
  </ul>
);

const MenuLink = ({ href }) => {
  const safeHref = (href || "").trim();
  // Para PDFs usamos el visor de Google (mejor compatibilidad)
  const viewerURL = `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(
    safeHref
  )}`;
  const showEmbed = isPdfUrl(safeHref) || safeHref.includes("drive.google.com");

  return (
    <div className="mt-3">
      <a
        href={safeHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-orange-500 text-white hover:bg-orange-600"
      >
        Ver menú completo
        <span aria-hidden>↗</span>
      </a>

      {showEmbed && (
        <div className="mt-4 border rounded-md overflow-hidden">
          <iframe
            src={viewerURL}
            title="Menú"
            width="100%"
            height="480"
            style={{ border: 0 }}
          />
        </div>
      )}
    </div>
  );
};

const MenuSection = ({ menu, planType, categoria, slugCategoria }) => {
  const plan = (planType || "").toLowerCase();
  if (plan !== "premium") return null; // Sólo Premium

  if (!isFoodCategory(categoria, slugCategoria)) return null;

  const value = (menu || "").trim();
  if (!value) return null;

  const showAsLink = isUrl(value);

  return (
    <section id="menu" className="mt-10">
      <h2 className="text-xl font-semibold text-gray-900">Menú</h2>
      <p className="text-sm text-gray-500 mt-1">
        {showAsLink
          ? "Abre tu menú desde el enlace o vista previa."
          : "Un platillo por línea, con precio si quieres (ejemplo: Tacos al pastor — $45)."}
      </p>

      {showAsLink ? (
        <MenuLink href={value} />
      ) : (
        <MenuList lines={normalizeLines(value)} />
      )}
    </section>
  );
};

export default MenuSection;
