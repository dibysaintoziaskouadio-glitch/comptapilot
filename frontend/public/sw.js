/**
 * Service worker de Comptapilot (application installée).
 * - /api/* : jamais mis en cache (calculs, comptes et codes toujours à jour) ;
 * - /assets/* : fichiers empreintés, servis depuis le cache puis rafraîchis ;
 * - pages : réseau d'abord, page en cache si le réseau est coupé (l'application s'ouvre, puis signale l'absence de connexion).
 */
const VERSION = 'comptapilot-v2';
const COQUILLE = ['/', '/manifest.webmanifest', '/brand/comptapilot.svg', '/brand/icone-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/brand/')) {
    e.respondWith(
      caches.open(VERSION).then(async (c) => {
        const enCache = await c.match(req);
        const reseau = fetch(req)
          .then((r) => (r.ok && c.put(req, r.clone()), r))
          .catch(() => enCache);
        return enCache || reseau;
      }),
    );
    return;
  }

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copie = r.clone();
          caches.open(VERSION).then((c) => c.put('/', copie));
          return r;
        })
        .catch(() => caches.match('/')),
    );
  }
});
