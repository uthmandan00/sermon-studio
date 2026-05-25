const CACHE_NAME = "sermon-studio-shell-v1";
const APP_SHELL = [
  "/",
  "/index.html",
  "/sermons/index.html",
  "/sermons/sermon-editor.html",
  "/sermons/sermon-view.html",
  "/series/index.html",
  "/series/series-view.html",
  "/calendar/index.html",
  "/settings/index.html",
  "/manifest.webmanifest",
  "/assets/icons/icon.svg",
  "/assets/css/style.css",
  "/assets/css/dashboard.css",
  "/assets/css/sermons.css",
  "/assets/css/editor.css",
  "/assets/js/app.js",
  "/assets/js/storage.js",
  "/assets/js/utils.js",
  "/assets/js/search.js",
  "/assets/js/dashboard.js",
  "/assets/js/sermons.js",
  "/assets/js/series.js",
  "/assets/js/editor.js",
  "/assets/js/calendar.js",
  "/assets/js/settings.js",
  "/assets/data/sample-data.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("/index.html")))
  );
});
