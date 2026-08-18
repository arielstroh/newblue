/* NewBlue marketing site — offline service worker.
   After the first online load, the site (pages, logos, diagrams, catalog, images)
   works without a connection. Videos stream from the network when online; they are
   not force-cached because iOS limits large media caches. */
const CACHE = 'newblue-v1';

// Core UI assets precached on first visit so the whole site renders offline.
const PRECACHE = [
  './',
  'index.html',
  'images/newblue.png',
  'images/popup.png',
  'images/newsroom-diagram.png',
  'images/standalone-diagram.png',
  'images/logo-captivate.png',
  'images/logo-enterprise.png',
  'images/logo-totalfx.png',
  'images/logo-newsroom.png',
  'images/logo-fusion.png',
  'images/fusion.png',
  'images/data-driven.png',
  'images/PCR.jpg',
  'images/qr-jeff.png',
  'images/qr-ian.png',
  'catalog/index.html'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(PRECACHE.map(u => c.add(u))))  // don't fail install if one asset is missing
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.headers.has('range')) return;              // let the browser handle ranged (video) requests directly

  const url = new URL(req.url);
  const isHTML = req.mode === 'navigate' ||
                 url.pathname.endsWith('/') ||
                 url.pathname.endsWith('index.html');

  if (isHTML) {
    // Network-first for pages: newest content when online, cached fallback when offline.
    e.respondWith(
      fetch(req)
        .then(res => { caches.open(CACHE).then(c => c.put(req, res.clone())); return res; })
        .catch(() => caches.match(req).then(r => r || caches.match('index.html')))
    );
    return;
  }

  // Cache-first for assets; fetch and store on first use (runtime caching).
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          caches.open(CACHE).then(c => c.put(req, res.clone()));
        }
        return res;
      });
    })
  );
});
