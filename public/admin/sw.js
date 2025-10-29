/* public/sw.js */
const CACHE = "oasis-root-v6"; // bump to force update
const ADMIN_SCOPE = "/admin";
const OFFLINE_URL = "/admin/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const c = await caches.open(CACHE);
      await c.addAll([OFFLINE_URL]); // pre-cache offline shell
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Cache-first for Next static bits (safe everywhere)
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image")
  ) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // SWR images under admin scope
  if (req.destination === "image" && url.pathname.startsWith(ADMIN_SCOPE)) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // 🔑 Intercept ALL top-level navigations so we can show our offline shell
  if (req.mode === "navigate") {
    event.respondWith(handleNavigation(req));
    return;
  }

  // Admin subresources: network-first with offline fallback
  if (url.pathname.startsWith(ADMIN_SCOPE)) {
    event.respondWith(networkFirst(req, OFFLINE_URL));
    return;
  }
  // Everything else: pass-through (non-admin subresources)
});

/* ---------- helpers ---------- */
function isRedirect(res) {
  if (!res) return false;
  if (res.type === "opaqueredirect") return true;
  return [301, 302, 303, 307, 308].includes(res.status);
}
function resolveLocation(res) {
  const loc = res.headers.get("Location");
  if (!loc) return null;
  try {
    return new URL(loc, self.location.origin);
  } catch {
    return null;
  }
}
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function redirectShim(toUrl) {
  const safe = escapeHtml(toUrl);
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
     <title>Redirecting…</title><p>Redirecting…</p><script>location.href="${safe}";</script>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 200 }
  );
}

async function handleNavigation(req) {
  try {
    // Always prefer fresh network for navigations, and follow redirects manually
    let res = await fetch(req, {
      cache: "no-store",
      redirect: "manual",
      credentials: "include",
    });

    let hops = 0;
    while (isRedirect(res) && hops < 5) {
      const target = resolveLocation(res);
      if (!target) break;
      if (target.origin !== self.location.origin)
        return redirectShim(target.toString());
      res = await fetch(target.toString(), {
        cache: "no-store",
        redirect: "manual",
        credentials: "include",
      });
      hops++;
    }

    // Even 401/500 should render (don’t show offline unless we truly can’t fetch)
    if (res) return res;
    throw new Error("no response");
  } catch {
    // True offline or fetch failure → serve our offline shell (instead of Safari’s cached homepage)
    const cache = await caches.open(CACHE);
    const fallback = await cache.match(OFFLINE_URL);
    return (
      fallback ||
      new Response("Offline", {
        status: 503,
        headers: { "Content-Type": "text/plain" },
      })
    );
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
  const fetcher = fetch(req, { credentials: "include" })
    .then((res) => {
      if (res && res.ok && !isRedirect(res)) cache.put(req, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || fetcher;
}

async function networkFirst(req, fallbackUrl) {
  try {
    let res = await fetch(req, {
      cache: "no-store",
      redirect: "manual",
      credentials: "include",
    });
    if (isRedirect(res)) {
      const target = resolveLocation(res);
      if (target && target.origin !== self.location.origin)
        return redirectShim(target.toString());
      if (target)
        res = await fetch(target.toString(), {
          cache: "no-store",
          redirect: "manual",
          credentials: "include",
        });
    }
    return res;
  } catch {
    const cache = await caches.open(CACHE);
    const fallback = await cache.match(fallbackUrl);
    return (
      fallback ||
      new Response("Offline", {
        status: 503,
        headers: { "Content-Type": "text/plain" },
      })
    );
  }
}
