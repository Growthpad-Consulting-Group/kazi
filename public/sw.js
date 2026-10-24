// Kazi is data-heavy and authenticated, so we only cache install assets. All
// application routes and APIs remain network-only to avoid stale private data.
const CACHE_NAME = "kazi-install-v2";
const INSTALL_ASSETS = [
  "/manifest.webmanifest",
  "/favicon.ico",
  "/favicon.png",
  "/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(INSTALL_ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/")) return;

  // App pages always go to the server. Cached responses only provide a fallback
  // for the icons and manifest needed by an installed shell.
  if (!INSTALL_ASSETS.includes(url.pathname)) return;
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
