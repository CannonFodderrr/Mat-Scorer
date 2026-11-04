/* MatScorer persistence release. Application records remain in IndexedDB. */
const CACHE_PREFIX = "matscorer-offline-";
const CACHE_NAME = CACHE_PREFIX + "v32-drive-file-persist";
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
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
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
      let cached = await cache.match(request);
      if (!cached && request.mode === "navigate") {
        for (const path of ["./", "./index.html", "./MatScorer.html"]) {
          cached = await cache.match(new URL(path, self.registration.scope).href);
          if (cached) break;
        }
      }
      return cached || new Response("MatScorer is not cached yet. Connect once and reopen the app.", {
        status:503, headers:{"Content-Type":"text/plain; charset=utf-8"}
      });
    }
  })());
});
