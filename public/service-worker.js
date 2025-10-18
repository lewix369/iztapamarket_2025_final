// Service Worker – robust app shell strategy to avoid white screens after deploys
// Bump this to invalidate old caches
const CACHE_NAME = "iztapamarket-cache-v5";
const APP_SHELL = "/index.html";
const PRECACHE_URLS = ["/", APP_SHELL, "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE_URLS);
    })()
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.map((n) => (n !== CACHE_NAME ? caches.delete(n) : undefined))
      );
      // Enable navigation preload when available to speed up navigations
      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.enable();
        } catch {}
      }
    })()
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const sameOrigin = url.origin === self.location.origin;

  // --- 1) Navigations → NETWORK-FIRST for the app shell ---
  // This prevents serving a stale index.html that points to non-existent hashed assets
  if (event.request.mode === "navigate") {
    // ⛔ Do NOT app-shell navigations for JSON/API endpoints
    // These paths must return their real network responses (e.g., /api/diag/magic-link)
    if (
      sameOrigin &&
      (url.pathname.startsWith("/api/") ||
        url.pathname.startsWith("/diag/") ||
        url.pathname.startsWith("/auth/"))
    ) {
      event.respondWith(fetch(event.request, { cache: "no-store" }));
      return;
    }
    event.respondWith(
      (async () => {
        try {
          // Try network first with no-store so we always get the fresh HTML after deploys
          const networkResp = await fetch(APP_SHELL, { cache: "no-store" });
          const cache = await caches.open(CACHE_NAME);
          cache.put(APP_SHELL, networkResp.clone());
          return networkResp;
        } catch (e) {
          // Fallback to cached shell if offline
          const cached = await caches.match(APP_SHELL);
          return (
            cached ||
            new Response("", { status: 504, statusText: "Gateway Timeout" })
          );
        }
      })()
    );
    return;
  }

  // Only handle same-origin assets; let cross-origin requests pass through untouched
  if (!sameOrigin) return;

  // --- 2) Static assets with hashed names → CACHE-FIRST ---
  // Styles, scripts, fonts, images usually have content hashes; cache-first is ideal
  const dest = event.request.destination;
  if (["style", "script", "font", "image"].includes(dest)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        try {
          const resp = await fetch(event.request);
          // Avoid caching 404/opaque error responses
          if (resp && resp.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request, resp.clone());
          }
          return resp;
        } catch (e) {
          // No cached asset and network failed
          return new Response("", {
            status: 504,
            statusText: "Gateway Timeout",
          });
        }
      })()
    );
    return;
  }

  // --- 3) Documents fetched as subrequests (rare) → fallback to app shell ---
  if (dest === "document") {
    event.respondWith(
      (async () => {
        try {
          const resp = await fetch(event.request, { cache: "no-store" });
          return resp;
        } catch (e) {
          const cached = await caches.match(APP_SHELL);
          return (
            cached ||
            new Response("", { status: 504, statusText: "Gateway Timeout" })
          );
        }
      })()
    );
    return;
  }

  // --- 4) Other same-origin GET requests (JSON, API, etc.) → network first with fallback ---
  event.respondWith(
    (async () => {
      try {
        return await fetch(event.request);
      } catch (e) {
        const cached = await caches.match(event.request);
        return (
          cached ||
          new Response("", { status: 504, statusText: "Gateway Timeout" })
        );
      }
    })()
  );
});
