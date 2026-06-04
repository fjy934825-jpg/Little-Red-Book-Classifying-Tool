const CACHE_NAME = "xhs-content-organizer-v9";
const ASSETS = ["./manifest.webmanifest", "./icon.svg"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  const isNavigation = event.request.mode === "navigate";
  const isHtml = requestUrl.pathname.endsWith("/") || requestUrl.pathname.endsWith("/index.html");

  if (isNavigation || isHtml) {
    event.respondWith(
      fetch(event.request)
        .then((response) => response)
        .catch(() => caches.match("./index.html")),
    );
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
