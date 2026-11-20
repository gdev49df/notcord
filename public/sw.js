// earth's network — service worker: оболочка приложения в кэше, api/ws/файлы всегда из сети
const CACHE = 'earths-v5';
const SHELL = ['/', '/style.css', '/app.js', '/feed.js', '/extras.js', '/settings.js', '/more.js', '/clips.js', '/start.js', '/icon.svg', '/manifest.webmanifest'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || /^\/(api|ws|files)\//.test(u.pathname)) return;
  // сначала сеть (чтобы обновления доезжали сразу), кэш — на случай оффлайна
  e.respondWith(fetch(e.request).then((r) => {
    const copy = r.clone();
    if (r.ok) caches.open(CACHE).then((c) => c.put(e.request, copy));
    return r;
  }).catch(() => caches.match(e.request).then((m) => m || caches.match('/'))));
});
