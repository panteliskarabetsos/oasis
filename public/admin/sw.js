/* public/admin/sw.js */
const CACHE = "oasis-admin-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) =>
      c.addAll([
        "/admin", // entry
        "/admin/offline", // offline shell
      ])
    )
  );
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
        )
      )
  );
  self.clients.claim();
});

// Cache strategy: assets = cache-first; pages = network-first with offline fallback
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (!url.pathname.startsWith("/admin")) return;

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image")
  ) {
    event.respondWith(cacheFirst(req));
    return;
  }
  if (req.destination === "image") {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }
  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req, "/admin/offline"));
  }
});

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}
async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const fetcher = fetch(req).then((res) => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  });
  return hit || fetcher;
}
async function networkFirst(req, fallbackPath) {
  try {
    const res = await fetch(req, { cache: "no-store" });
    if (res.ok) return res;
    throw new Error("network fail");
  } catch {
    const cache = await caches.open(CACHE);
    return (
      (await cache.match(fallbackPath)) ||
      new Response("Offline", { status: 503 })
    );
  }
}
