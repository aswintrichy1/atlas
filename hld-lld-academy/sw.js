/* =====================================================================
   BLUEPRINT · Service worker
   Offline-first: precache the core shell + curriculum, then cache every
   same-origin asset (fonts, etc.) on first fetch. The whole app works
   with no network after the first visit.
   ===================================================================== */
const CACHE = "blueprint-v6";
const CORE = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./css/exam.css",
  "./css/pwa.css",
  "./fonts/fonts.css",
  "./js/widgets.js",
  "./js/widgets-dsa.js",
  "./js/widgets-patterns.js",
  "./js/quizzes.js",
  "./js/curriculum-hld.js",
  "./js/curriculum-lld.js",
  "./js/curriculum-dsa.js",
  "./js/curriculum-patterns.js",
  "./js/exam.js",
  "./js/pwa.js",
  "./js/app.js",
  "./icon.svg",
  "./manifest.webmanifest"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return; // never touch cross-origin

  // Cache-first, with runtime caching for anything not precached (e.g. fonts).
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => {
        // SPA fallback for navigations when offline and uncached
        if (req.mode === "navigate") return caches.match("./index.html");
        return new Response("", { status: 504, statusText: "offline" });
      });
    })
  );
});
