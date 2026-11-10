// Service worker: app shell em cache para funcionar offline.
// Estratégia stale-while-revalidate: responde do cache na hora e atualiza em segundo plano.
// Ao publicar mudanças grandes, aumente VERSAO para descartar o cache antigo.

const VERSAO = 'tpc-v1';
const ARQUIVOS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './store.js',
  './sync.js',
  './manifest.webmanifest',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Só o próprio app; chamadas ao Apps Script (POST, outro domínio) passam direto.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  const chave = req.mode === 'navigate' ? './index.html' : req;
  e.respondWith(
    caches.open(VERSAO).then(async (cache) => {
      const emCache = await cache.match(chave, { ignoreSearch: true });
      const daRede = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(chave, res.clone());
          return res;
        })
        .catch(() => emCache);
      if (emCache) {
        e.waitUntil(daRede);
        return emCache;
      }
      return daRede;
    }),
  );
});
