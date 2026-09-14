const CACHE = "brugapp-v5";
const PRECACHE = ["/", "/terneuzen", "/schedule", "/about", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // Never intercept Next internals, HMR, workers, or hashed assets.
  if (url.pathname.startsWith("/_next/")) return;
  if (url.pathname.includes("webpack-hmr")) return;
  if (url.pathname.includes("turbopack")) return;
  if (url.pathname === "/sw.js") return;
  if (request.headers.get("upgrade") === "websocket") return;

  const destination = request.destination;
  if (
    destination === "script" ||
    destination === "worker" ||
    destination === "sharedworker" ||
    destination === "style" ||
    destination === "font" ||
    destination === "image" ||
    destination === "audio" ||
    destination === "video"
  ) {
    return;
  }

  const isNavigation = request.mode === "navigate";
  const isApi = url.pathname.startsWith("/api/");
  const isPrecache = PRECACHE.includes(url.pathname);

  if (!isNavigation && !isApi && !isPrecache) return;

  if (isApi) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return (
      cached ??
      new Response(JSON.stringify({ error: "offline" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      })
    );
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached ?? network;
}
