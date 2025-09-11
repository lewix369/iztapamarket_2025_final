// sube versión para invalidar SW viejo
const CACHE_NAME = "iztapamarket-cache-v3";
const PRECACHE_URLS = ["/", "/index.html", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.map((n) => (n !== CACHE_NAME ? caches.delete(n) : null))
        )
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // 👇 SPA: para navegaciones, devolver siempre el app shell
  if (event.request.mode === "navigate") {
    event.respondWith(
      caches.match("/index.html").then((cached) => {
        return (
          cached ||
          fetch("/index.html").catch(
            () =>
              new Response("", { status: 504, statusText: "Gateway Timeout" })
          )
        );
      })
    );
    return;
  }

  // assets y API: cache-first simple
  event.respondWith(
    caches.match(event.request).then((response) => {
      return (
        response ||
        fetch(event.request).catch(() =>
          event.request.destination === "document"
            ? caches.match("/index.html")
            : undefined
        )
      );
    })
  );
});
