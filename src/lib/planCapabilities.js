const PLAN_ALIASES = Object.freeze({
  free: "free",
  gratis: "free",
  pro: "pro",
  profesional: "pro",
  professional: "pro",
  intermedio: "pro",
  premium: "premium",
});

export const normalizePlan = (value) => {
  const key = String(value || "")
    .trim()
    .toLowerCase();

  return PLAN_ALIASES[key] || "free";
};

export const PLAN_CAPABILITIES = Object.freeze({
  free: Object.freeze({
    key: "free",
    label: "Free",
    galleryLimit: 0,
    hours: true,
    whatsapp: false,
    map: false,
    logo: false,
    cover: false,
    services: false,
    social: false,
    website: false,
    stats: false,
    video: false,
    menu: false,
    promotions: false,
    seo: false,
    ai: false,
  }),
  pro: Object.freeze({
    key: "pro",
    label: "Pro",
    galleryLimit: 3,
    hours: true,
    whatsapp: true,
    map: true,
    logo: true,
    cover: true,
    services: true,
    social: true,
    website: true,
    stats: true,
    video: false,
    menu: false,
    promotions: false,
    seo: false,
    ai: false,
  }),
  premium: Object.freeze({
    key: "premium",
    label: "Premium",
    galleryLimit: 6,
    hours: true,
    whatsapp: true,
    map: true,
    logo: true,
    cover: true,
    services: true,
    social: true,
    website: true,
    stats: true,
    video: true,
    menu: true,
    promotions: true,
    seo: true,
    ai: true,
  }),
});

export const getPlanCapabilities = (value) =>
  PLAN_CAPABILITIES[normalizePlan(value)];

export const canUsePlanFeature = (plan, feature) =>
  Boolean(getPlanCapabilities(plan)?.[feature]);
