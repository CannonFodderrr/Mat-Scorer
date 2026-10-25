/* SW MatScorer — offline-capable service worker
 * First visit online caches the app shell. Later opens work offline.
 * When online, HTML/assets refresh from the network and update the cache.
 */
const CACHE_NAME = "matscorer-offline-v2";
const PRECACHE_URLS = [
  "./",
  "./MatScorer.html",
  "./index.html",
  "./matscorer-sw.js",
  "./matscorer-icon-180.png",
  "./matscorer-icon-192.png",
  "./matscorer-icon-512.png",
  "./matscorer-icon-512-maskable.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(
        PRECACHE_URLS.map(function (url) {
          return cache.add(url).catch(function () {
            /* file may not exist under that name — ignore */
          });
        })
      );
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function isSameOrigin(url) {
  try {
    return new URL(url).origin === self.location.origin;
  } catch (e) {
    return false;
  }
}

function networkThenCache(request) {
  return fetch(request).then(function (response) {
    if (response && response.ok && request.method === "GET") {
      var copy = response.clone();
      caches.open(CACHE_NAME).then(function (cache) {
        cache.put(request, copy);
      });
    }
    return response;
  });
}

function cacheFallback(request) {
  return caches.match(request).then(function (cached) {
    if (cached) return cached;
    // Navigation fallbacks for common entry URLs
    if (request.mode === "navigate") {
      return caches.match("./MatScorer.html").then(function (a) {
        if (a) return a;
        return caches.match("./index.html").then(function (b) {
          if (b) return b;
          return caches.match("./");
        });
      });
    }
    return null;
  });
}

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;

  // Cross-origin (Google APIs, etc.): network only — not required for core scoring offline
  if (!isSameOrigin(request.url)) {
    event.respondWith(
      fetch(request).catch(function () {
        return new Response("", { status: 503, statusText: "Offline" });
      })
    );
    return;
  }

  // Same-origin: prefer network (so updates apply), fall back to cache offline
  event.respondWith(
    networkThenCache(request).catch(function () {
      return cacheFallback(request).then(function (cached) {
        if (cached) return cached;
        return new Response(
          "<!DOCTYPE html><html><body style=\"font-family:sans-serif;background:#1C1F1E;color:#ece8e0;padding:24px;\">" +
            "<h1>MatScorer offline</h1>" +
            "<p>No cached copy yet. Connect to the internet once, open MatScorer, then you can use it offline.</p>" +
            "</body></html>",
          { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
        );
      });
    })
  );
});
