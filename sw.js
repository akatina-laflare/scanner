// Scanner: funziona anche senza internet.
// La pagina viene presa dalla rete quando c'è (così arrivano gli aggiornamenti),
// altrimenti dalla copia salvata. Librerie e modelli scaricati una volta restano in memoria.
const CACHE = 'scanner-offline-v1';
const SHELL = ['./', './index.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin) {
    // App: prima la rete, poi la copia salvata
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) {
          const copy = res.clone(), c = await caches.open(CACHE);
          await c.put(req.mode === 'navigate' || url.pathname.endsWith('/') ? './' : req, copy);
        }
        return res;
      } catch (_) {
        const c = await caches.open(CACHE);
        return (await c.match(req, { ignoreSearch: true })) || (await c.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Librerie da CDN (PDF, zip, lettura testo): prima la copia salvata, poi la rete
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req, { ignoreVary: true });
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok || res.type === 'opaque') c.put(req, res.clone()).catch(() => {});
    return res;
  })());
});
