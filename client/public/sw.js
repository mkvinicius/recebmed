const CACHE_NAME = "recebmed-v2";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/favicon.png",
  "/apple-touch-icon.png",
  "/icon-512.png",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  console.log("[SW] Installing RecebMed service worker");
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log("[SW] Caching static assets");
        return cache.addAll(STATIC_ASSETS);
      })
      .catch((err) => console.error("[SW] Cache install failed:", err))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[SW] Activating RecebMed service worker");
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log("[SW] Deleting old cache:", key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() => new Response(JSON.stringify({ offline: true }), {
          status: 503,
          statusText: "Service Unavailable",
          headers: { "Content-Type": "application/json" },
        }))
    );
    return;
  }

  event.respondWith(
    caches.match(request)
      .then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            if (!response || response.status !== 200 || response.type === "error") {
              return response;
            }
            if (url.origin === self.location.origin) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => {
            if (request.destination === "document") {
              return caches.match("/");
            }
            return new Response("Offline", { status: 503 });
          });
      })
  );
});
