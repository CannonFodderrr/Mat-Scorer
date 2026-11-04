/* MatScorer persistence release. Application records remain in IndexedDB. */
const CACHE_PREFIX = "matscorer-offline-";
const CACHE_NAME = CACHE_PREFIX + "v35-persist-always";
const SHELL = ["./", "./index.html", "./MatScorer.html", "./matscorer-icon-180.png", "./matscorer-icon-192.png", "./matscorer-icon-512.png", "./matscorer-icon-512-maskable.png"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => Promise.all(
    SHELL.map(url => cache.add(new Request(new URL(url, self.registration.scope), {cache:"reload"})).catch(() => {}))
  )));
  // Do not force replacement of the worker while an existing scoring window is open.
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin ||
      !url.href.startsWith(self.registration.scope)) return;
  // HTML navigations: network-first so updates are not stuck behind old cache
  const isNav = request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html");
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    if (isNav) {
      try {
        const response = await fetch(request, { cache: "no-store" });
        if (response && response.ok) {
          try { await cache.put(request, response.clone()); } catch (e) {}
          return response;
        }
      } catch (e) {}
      const cached = await cache.match(request) ||
        await cache.match(new URL("./index.html", self.registration.scope).href) ||
        await cache.match(new URL("./MatScorer.html", self.registration.scope).href);
      return cached || new Response("MatScorer offline and not cached yet.", {
        status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
    try {
      const response = await fetch(request);
      if (response.ok) {
        try { await cache.put(request, response.clone()); } catch (error) { console.warn("Cache update", error); }
        return response;
      }
      if (response.status < 500) return response;
      const cached = await cache.match(request);
      return cached || response;
    } catch (error) {
      const cached = await cache.match(request);
      return cached || new Response("MatScorer is not cached yet. Connect once and reopen the app.", {
        status:503, headers:{"Content-Type":"text/plain; charset=utf-8"}
      });
    }
  })());
});
