/* public/admin/sw.js */
const CACHE = "oasis-admin-v3";
const APP_SCOPE = "/admin";
const OFFLINE_URL = "/admin/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll([OFFLINE_URL]);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (!url.pathname.startsWith(APP_SCOPE)) return;

  // Next static assets
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/_next/image")) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // images: SWR
  if (req.destination === "image") {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // navigations: follow redirects so Safari never sees a redirected SW response
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(handleNavigation(req));
    return;
  }

  event.respondWith(networkFirst(req, OFFLINE_URL));
});

/* helpers */
function isRedirect(res) {
  if (!res) return false;
  if (res.type === "opaqueredirect") return true;
  return [301, 302, 303, 307, 308].includes(res.status);
}

async function followRedirectOnce(res) {
  const loc = res.headers.get("Location");
  if (!loc) return res;
  const finalUrl = new URL(loc, self.location.origin).toString();
  return fetch(finalUrl, { cache: "no-store", credentials: "include" });
}

async function handleNavigation(req) {
  try {
    let res = await fetch(req, { cache: "no-store", redirect: "manual", credentials: "include" });
    let hops = 0;
    while (isRedirect(res) && hops < 5) {
      res = await followRedirectOnce(res);
      hops++;
    }
    if (res && res.ok && !isRedirect(res)) return res;
    throw new Error("navigation failed");
  } catch {
    const cache = await caches.open(CACHE);
    const fallback = await cache.match(OFFLINE_URL);
    return fallback || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req, { credentials: "include" });
  if (res && res.ok && !isRedirect(res)) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req, { ignoreSearch: true });
  const fetcher = fetch(req).then((res) => {
    if (res && res.ok && !isRedirect(res)) cache.put(req, res.clone());
    return res;
  }).catch(() => hit);
  return hit || fetcher;
}

async function networkFirst(req, fallbackUrl) {
  try {
    let res = await fetch(req, { cache: "no-store", redirect: "manual", credentials: "include" });
    if (isRedirect(res)) res = await followRedirectOnce(res);
    if (res && res.ok && !isRedirect(res)) return res;
    throw new Error("network fail");
  } catch {
    const cache = await caches.open(CACHE);
    const fallback = await cache.match(fallbackUrl);
    return fallback || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}
