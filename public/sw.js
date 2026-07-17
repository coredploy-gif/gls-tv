/* GLS TV — minimal PWA service worker (cache shell only; streams stay network). */
// Increment this whenever the app shell changes. A stale HTML shell paired
// with a newer Next.js client bundle causes hydration recovery loops.
const CACHE = "gls-tv-shell-v5";
const PRECACHE = ["/", "/offline", "/browse", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Never cache API / HLS / auth / streaming
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/watch/") ||
    url.pathname.includes("m3u8") ||
    url.hostname !== self.location.hostname
  ) {
    return;
  }

  // HTML must always come from the network when possible. Next.js embeds
  // route-specific data in the document, so cache-first navigation can pair
  // yesterday's markup with today's JS after a deployment.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            void caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches
            .match(req)
            .then((cached) => cached || caches.match("/offline")),
        ),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok && url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
