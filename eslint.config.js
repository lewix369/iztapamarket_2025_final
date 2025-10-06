// eslint.config.js (Flat Config)
import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  // Ignore build artifacts
  {
    ignores: [
      "dist/**",
      "build/**",
      ".vercel/**",
      "node_modules/**",
      // Backups/old/test artifacts that shouldn't block lint
      "src/**/*.bak.*",
      "src/**/* test.*",
      "src/**/webhook_mp test.mjs",
      "src/pages/*OLD*",
      "src/pages/*OLD*.jsx*",
    ],
  },

  // Include ESLint's recommended rules
  js.configs.recommended,

  // Include React plugin flat recommended configs (this is an array)
  react.configs.flat.recommended,

  // Project-specific tweaks
  {
    files: ["**/*.{js,mjs,cjs,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: { react, "react-hooks": reactHooks },
    settings: { react: { version: "detect" } },
    rules: {
      // Consola permitida solo para warn/error
      "no-console": ["warn", { allow: ["warn", "error"] }],

      // Evita bloques vacíos (pero permite catch vacío si así lo deseas)
      "no-empty": ["error", { allowEmptyCatch: true }],

      // Variables no usadas: ignora las que empiecen con _
      "no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // Seguridad en target=_blank
      "react/jsx-no-target-blank": [
        "error",
        { allowReferrer: true, enforceDynamicLinks: "always" },
      ],

      // Hooks de React (recomendado)
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/exhaustive-deps": "warn",
      // Relax escapes & unescaped entities to warnings (will be addressed later)
      "no-useless-escape": "warn",
      "no-constant-condition": ["warn", { checkLoops: false }],
      "react/no-unescaped-entities": "warn",

      // Permitir props personalizadas usadas por styled-jsx o casos especiales
      // (si luego migras, puedes quitar estas excepciones)
      "react/no-unknown-property": [
        "error",
        { ignore: ["jsx", "global", "fetchpriority"] },
      ],

      // Reglas habituales de React
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
    },
  },
];
