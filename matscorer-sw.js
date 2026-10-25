/* SW MatScorer — minimal service worker for Android install / standalone */
self.addEventListener("install", function (event) {
  self.skipWaiting();
});
self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});
self.addEventListener("fetch", function (event) {
  event.respondWith(fetch(event.request));
});
