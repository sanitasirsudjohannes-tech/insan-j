const CACHE_NAME = 'insan-j-cache-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/img/Icon.webp',
  '/img/logo.webp',
  '/img/logo_provinsi.png'
];

const getAppShellAssets = async () => {
  const [response, manifestResponse] = await Promise.all([
    fetch('/index.html', { cache: 'no-store' }),
    fetch('/offline-assets.json', { cache: 'no-store' }),
  ]);
  if (!response.ok || !manifestResponse.ok) {
    throw new Error(`Gagal memuat aset aplikasi untuk cache offline: ${response.status}/${manifestResponse.status}`);
  }

  const [html, manifest] = await Promise.all([response.text(), manifestResponse.json()]);
  const assets = new Set(ASSETS_TO_CACHE);
  const assetPattern = /<(?:script|link)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']+)["'][^>]*>/gi;

  for (const match of html.matchAll(assetPattern)) {
    const assetUrl = new URL(match[1], self.location.origin);
    if (assetUrl.origin === self.location.origin && assetUrl.pathname.startsWith('/assets/')) {
      assets.add(`${assetUrl.pathname}${assetUrl.search}`);
    }
  }

  for (const entry of Object.values(manifest)) {
    const entryAssets = [entry.file, ...(entry.css || [])].filter(Boolean);
    for (const asset of entryAssets) {
      const assetUrl = new URL(asset, `${self.location.origin}/`);
      if (assetUrl.origin === self.location.origin && assetUrl.pathname.startsWith('/assets/')) {
        assets.add(`${assetUrl.pathname}${assetUrl.search}`);
      }
    }
  }

  return [...assets];
};

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const assets = await getAppShellAssets();
    await cache.addAll(assets);
    await self.skipWaiting();
  })());
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((cache) => cache !== CACHE_NAME)
        .map((cache) => caches.delete(cache))
    );
    await self.clients.claim();
  })());
});

// Fetch Event (Network First, Fallback to Cache)
self.addEventListener('fetch', (event) => {
  // Biarkan request non-GET (seperti API Supabase) langsung lewat
  if (event.request.method !== 'GET') return;
  
  // Jangan cache request API Supabase atau Vercel Cron
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api') || url.hostname.includes('supabase.co')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Simpan salinan di cache untuk penggunaan offline
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/index.html');
          }
        });
      })
  );
});
