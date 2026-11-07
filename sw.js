// СКиПП: изолированный офлайн-кэш версии 4.4
const CACHE = 'skipp-v49';
const PREFIX = 'skipp-v';
const CORE = ['./', 'index.html', 'manifest.json', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'styles.css', 'app.js'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
async function refresh(req, key) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const response = await fetch(req, {signal:ctl.signal, cache:'no-cache'});
    if (response && response.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(key || req, response.clone());
    }
    return response;
  } catch (error) { return null; }
  finally { clearTimeout(timer); }
}
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') {
    event.respondWith(caches.match('index.html').then(hit => {
      const update = refresh(req, 'index.html');
      if (hit) { event.waitUntil(update); return hit; }
      return update.then(response => response || caches.match('./')).then(response => response || new Response('Нет сети и сохранённой копии', {status:503, headers:{'Content-Type':'text/plain; charset=utf-8'}}));
    }));
    return;
  }
  if (url.origin === location.origin && CORE.some(path => new URL(path, self.registration.scope).pathname === url.pathname)) {
    event.respondWith(caches.match(req).then(hit => {
      const update = refresh(req);
      if (hit) { event.waitUntil(update); return hit; }
      return update.then(response => response || Response.error());
    }));
    return;
  }
  if (/fonts\.(googleapis|gstatic)\.com/.test(url.host)) {
    event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(async response => {
      if (response && (response.ok || response.type === 'opaque')) {
        const cache = await caches.open(CACHE);
        await cache.put(req, response.clone());
      }
      return response;
    }).catch(() => Response.error())));
  }
});
