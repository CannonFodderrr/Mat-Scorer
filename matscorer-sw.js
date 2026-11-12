/* MatScorer SW v2.2-full — network-first HTML; does not touch IndexedDB/localStorage */
var CACHE = "matscorer-shell-v2.2-full";
self.addEventListener("message", function (event) {
  if (event && event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE && String(k).indexOf("matscorer") === 0) return caches.delete(k);
        return null;
      }));
    }).then(function () { return self.clients.claim(); })
  );
});
self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (!req || req.method !== "GET") return;
  var accept = req.headers.get("accept") || "";
  var isNav = req.mode === "navigate" || accept.indexOf("text/html") !== -1;
  if (isNav) {
    event.respondWith(
      fetch(req).then(function (res) {
        try { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {}); } catch (e) {}
        return res;
      }).catch(function () {
        return caches.match(req).then(function (cached) { return cached || caches.match("./") || Response.error(); });
      })
    );
    return;
  }
  event.respondWith(
    caches.match(req).then(function (cached) {
      var network = fetch(req).then(function (res) {
        try { if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {}); } } catch (e) {}
        return res;
      }).catch(function () { return cached; });
      return cached || network;
    })
  );
});
