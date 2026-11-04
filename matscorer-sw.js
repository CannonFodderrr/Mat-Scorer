/* MatScorer service worker.
 * Application data lives in IndexedDB / localStorage inside the page — this worker only caches the app shell,
 * so updating or replacing it can never touch saved rosters, events or scores. */
const CACHE_PREFIX = "matscorer-offline-";
const CACHE_NAME = CACHE_PREFIX + "v47-boot-fix";
const SHELL = ["./", "./index.html", "./index22.html", "./MatScorer.html", "./matscorer-icon-180.png", "./matscorer-icon-192.png", "./matscorer-icon-512.png", "./matscorer-icon-512-maskable.png"];
// If the network has not answered within this time and we have a cached copy, open the cached app instead.
const NAV_NETWORK_TIMEOUT_MS = 3000;

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => Promise.all(
    SHELL.map(url => cache.add(new Request(new URL(url, self.registration.scope), { cache: "reload" })).catch(() => {}))
  )));
  // Safe to activate immediately: the worker holds no app data, and an already-open page is not reloaded.
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

function offlineResponse(text) {
  return new Response(text, { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin ||
      !url.href.startsWith(self.registration.scope)) return;

  const isNav = request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html");

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    if (isNav) {
      // Cached copy of this page (ignoring ?query), or any known shell page.
      const cached = await cache.match(request, { ignoreSearch: true }) ||
        await cache.match(new URL("./index.html", self.registration.scope).href) ||
        await cache.match(new URL("./index22.html", self.registration.scope).href) ||
        await cache.match(new URL("./MatScorer.html", self.registration.scope).href);

      // Always try the network (so updates arrive) and refresh the cache with the result.
      const networkFetch = fetch(request, { cache: "no-store" }).then(async response => {
        if (response && response.ok) {
          try { await cache.put(request, response.clone()); } catch (e) {}
        }
        return response;
      });

      if (cached) {
        // Never let a slow / flaky connection hang app launch: fall back to the cached app after a short wait.
        const timeout = new Promise(resolve => setTimeout(() => resolve(null), NAV_NETWORK_TIMEOUT_MS));
        const winner = await Promise.race([networkFetch.catch(() => null), timeout]);
        if (winner && winner.ok) return winner;
        event.waitUntil(networkFetch.catch(() => {})); // let the cache refresh finish in the background
        return cached;
      }
      try {
        const response = await networkFetch;
        if (response) return response;
      } catch (e) {}
      return offlineResponse("MatScorer offline and not cached yet. Connect once and reopen the app.");
    }

    // Other same-origin files (icons etc.): network first, cache fallback.
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
      return cached || offlineResponse("MatScorer is not cached yet. Connect once and reopen the app.");
    }
  })());
});
