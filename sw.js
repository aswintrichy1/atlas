/* =====================================================================
   The Atlas Collection · hub service worker
   Caches only the hub's OWN root-level files. It deliberately never
   touches the three sub-apps (each ships its own service worker with a
   more specific scope), so it cannot interfere with their caching.
   ===================================================================== */
const CACHE = "atlas-hub-v1";
const CORE = [
  "./",
  "./index.html",
  "./icon.svg",
  "./manifest.webmanifest"
];
// Sub-app directories the hub must never intercept.
const SUBAPPS = /\/(hld-lld-academy|cyber-academy|data-eng-academy)\//;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
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
  if (url.origin !== self.location.origin) return;       // never touch cross-origin
  if (SUBAPPS.test(url.pathname)) return;                 // leave sub-apps to their own SW
  // Cache-first for the hub's own assets.
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
