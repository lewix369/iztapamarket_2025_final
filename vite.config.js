import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  base: "/",
  appType: "spa",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    // Proxy /api calls to the local backend during development
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
        // optional: rewrite: (path) => path, // leave as-is
      },
    },
    allowedHosts: [
      "localhost",
      "127.0.0.1",
      ".ngrok-free.app",
      ".trycloudflare.com", // ← permite cualquier subdominio de Cloudflare Tunnel
    ],
    headers: { "ngrok-skip-browser-warning": "true" },
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
