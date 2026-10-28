/* =====================================================================
   The Atlas Collection · hub service worker
   Caches only the hub's OWN root-level files. It deliberately never
   touches the twenty-one sub-apps (each ships its own service worker with a
   more specific scope), so it cannot interfere with their caching.
   ===================================================================== */
const CACHE = "atlas-hub-v10";
const CACHE_PREFIX = "atlas-hub-";
const CORE = [
  "./",
  "./index.html",
  "./icon.svg",
  "./manifest.webmanifest"
];
// Sub-app directories the hub must never intercept.
const SUBAPPS = /\/(hld-lld-academy|dsa-patterns-academy|ml-ai-academy|behavioral-academy|cyber-academy|data-eng-academy|techno-managerial-academy|devsecops-academy|llm-academy|snowflake-academy|cloud-academy|sre-academy|db-internals-academy|linux-net-academy|java-backend-academy|salesforce-academy|frontend-academy|software-craft-academy|python-academy|certification-academy|streaming-academy)\//;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
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
