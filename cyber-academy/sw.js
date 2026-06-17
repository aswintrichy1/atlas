/* =====================================================================
   BLUEPRINT · Service worker
   Offline-first: precache the core shell + curriculum, then cache every
   same-origin asset (fonts, etc.) on first fetch. The whole app works
   with no network after the first visit.
   ===================================================================== */
const CACHE = "citadel-v17";
const CORE = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./css/track-reversing.css",
  "./css/attack-matrix.css",
  "./css/exam.css",
  "./css/pwa.css",
  "./js/widgets.js",
  "./js/widgets-crypto.js",
  "./js/widgets-ext.js",
  "./js/widgets-rev.js",
  "./js/widgets-attack-matrix.js",
  "./js/quizzes.js",
  "./js/quizzes-ext.js",
  "./js/quizzes-rev.js",
  "./js/curriculum-core.js",
  "./js/curriculum-crypto.js",
  "./js/curriculum-appsec.js",
  "./js/curriculum-defense.js",
  "./js/curriculum-offensive.js",
  "./js/curriculum-threats.js",
  "./js/curriculum-domains.js",
  "./js/curriculum-reversing.js",
  "./js/practice-content.js",
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
