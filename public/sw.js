/* Team Timesheets: offline helper for the installed phone app.
   Only the "You're offline" page and its styles are stored. Timesheet pages and data are never cached. */
const CACHE = "tt-offline-v1";
const OFFLINE = "/offline";

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const res = await fetch(OFFLINE, { cache: "reload" });
    if (!res.ok) return;
    const html = await res.clone().text();
    await cache.put(OFFLINE, res);
    const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)]+\.(?:css|js|woff2)/g) || [])];
    await Promise.all([...assets, "/icon-192.png"].map((u) => cache.add(u).catch(() => {})));
  })());
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    // Always the live page; the offline page only when the network is down
    e.respondWith(fetch(req).catch(async () => (await caches.match(OFFLINE)) || Response.error()));
    return;
  }
  const path = new URL(req.url).pathname;
  if (path.startsWith("/_next/static/") || path === "/icon-192.png") {
    e.respondWith(fetch(req).catch(async () => (await caches.match(req)) || Response.error()));
  }
});
