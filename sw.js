/* NewBlue marketing site — offline service worker (v2).
   After the first online load, the whole site works offline — including videos.
   Videos are cached in full and served back to iOS's byte-range requests from cache. */
const CACHE = 'newblue-v2';

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
      .then(c => Promise.allSettled(PRECACHE.map(u => c.add(u))))
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

/* Cache a video in full, then satisfy byte-range requests by slicing the cached copy. */
async function handleVideo(req) {
  const cache = await caches.open(CACHE);
  let full = await cache.match(req.url);
  if (!full) {
    try {
      const res = await fetch(req.url);                 // full GET (no range)
      if (res && res.status === 200) {
        await cache.put(req.url, res.clone());
        full = res;
      } else {
        return fetch(req);                              // couldn't cache — passthrough
      }
    } catch (err) {
      return new Response('', { status: 504, statusText: 'Offline (video not cached yet)' });
    }
  }
  const range = req.headers.get('range');
  if (!range) return full;

  const buf = await full.clone().arrayBuffer();
  const size = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
  let start = m[1] ? parseInt(m[1], 10) : 0;
  let end = m[2] ? parseInt(m[2], 10) : size - 1;
  if (isNaN(start) || start < 0) start = 0;
  if (isNaN(end) || end >= size) end = size - 1;
  const body = buf.slice(start, end + 1);
  return new Response(body, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': (full.headers.get('Content-Type') || 'video/mp4'),
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes'
    }
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.pathname.endsWith('.mp4')) { e.respondWith(handleVideo(req)); return; }
  if (req.headers.has('range')) return;                 // other ranged requests → straight to network

  const isHTML = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('index.html');
  if (isHTML) {
    e.respondWith(
      fetch(req)
        .then(res => { caches.open(CACHE).then(c => c.put(req, res.clone())); return res; })
        .catch(() => caches.match(req).then(r => r || caches.match('index.html')))
    );
    return;
  }

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
