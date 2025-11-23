/* public/admin/sw.js */
const CACHE = "oasis-admin-v4";
const APP_SCOPE = "/admin";
const OFFLINE_URL = "/admin/offline.html"; // static 200 page

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const c = await caches.open(CACHE);
      await c.addAll([OFFLINE_URL]);
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
  if (!url.pathname.startsWith(APP_SCOPE)) return;

  // Next.js static assets
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image")
  ) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // images: SWR
  if (req.destination === "image") {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // navigations (HTML): follow redirects, allow non-200s (e.g., login pages)
  if (
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html")
  ) {
    event.respondWith(handleNavigation(req));
    return;
  }

  // default: network-first
  event.respondWith(networkFirst(req, OFFLINE_URL));
});

/* ---------------- helpers ---------------- */
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

// For cross-origin redirects in navigations, return a small HTML shim that navigates client-side.
// This avoids returning a redirected Response (which iOS hates).
function redirectShim(toUrl) {
  const safe = escapeHtml(toUrl);
  return new Response(
    `<!doctype html><meta charset="utf-8">
     <meta name="viewport" content="width=device-width,initial-scale=1">
     <title>Redirecting…</title>
     <p>Redirecting…</p>
     <script>location.href="${safe}";</script>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 200 }
  );
}

async function handleNavigation(req) {
  try {
    let res = await fetch(req, {
      cache: "no-store",
      redirect: "manual", // detect redirects
      credentials: "include",
    });

    let hops = 0;
    while (isRedirect(res) && hops < 5) {
      const target = resolveLocation(res);
      if (!target) break;

      // Cross-origin redirect (e.g., OAuth) — return a JS redirect shim.
      if (target.origin !== self.location.origin) {
        return redirectShim(target.toString());
      }

      // Same-origin: follow manually (still "manual" to keep detecting chains)
      res = await fetch(target.toString(), {
        cache: "no-store",
        redirect: "manual",
        credentials: "include",
      });
      hops++;
    }

    // At this point, res is final (not a redirect). IMPORTANT:
    // Return it even if it's 401/403/500 so you see login/error instead of offline.html.
    if (res) return res;

    throw new Error("no response");
  } catch {
    // Only show offline shell when fetch truly fails (network error)
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
  const fetcher = fetch(req)
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
      if (target && target.origin !== self.location.origin) {
        return redirectShim(target.toString());
      }
      if (target) {
        res = await fetch(target.toString(), {
          cache: "no-store",
          redirect: "manual",
          credentials: "include",
        });
      }
    }
    // For non-navigation requests we *can* return non-OK; callers decide what to do.
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
