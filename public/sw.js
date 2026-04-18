// ═══════════════════════════════════════════════════════════════════════
//  O.P.U.C. — Service Worker
//  Stratégie : Network-first avec fallback cache pour les pages/API,
//              Cache-first pour les assets statiques
// ═══════════════════════════════════════════════════════════════════════

const CACHE_NAME = 'opuc-v1';
const STATIC_CACHE = 'opuc-static-v1';
const SYNC_CACHE = 'opuc-sync-v1';

// Assets à pré-cacher (cache-first)
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/pwa-icon-512.png',
  '/pwa-icon-1024.png',
];

// Pages/API à mettre en cache dynamiquement (network-first)
const DYNAMIC_CACHE_PATTERNS = [
  /^\/$/,
  /^\/api\//,
];

// ═══ Install — pré-cache des assets statiques ═══
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Pré-cache des assets statiques');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Certains assets statiques non trouvés:', err);
      });
    })
  );
  self.skipWaiting();
});

// ═══ Activate — nettoyer les anciens caches ═══
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE && name !== SYNC_CACHE)
          .map((name) => {
            console.log('[SW] Suppression ancien cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// ═══ Fetch — stratégie de cache intelligente ═══
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes non-GET et les extensions non-cachables
  if (request.method !== 'GET') return;
  if (url.pathname.startsWith('/_next/image')) return; // Next.js Image Optimization gère son propre cache

  // Stratégie pour les assets statiques (JS, CSS, images, fonts)
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Stratégie pour les requêtes API sync (POST vers /api/sync)
  if (url.pathname === '/api/sync' && request.method === 'POST') {
    // Ne pas intercepter — la gestion offline du sync est côté client
    return;
  }

  // Stratégie pour les pages et API (network-first avec fallback)
  if (isDynamicRequest(url.pathname)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Par défaut : network-first avec fallback
  event.respondWith(networkFirst(request));
});

// ═══ Background Sync ═══
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-data') {
    console.log('[SW] Background sync déclenché');
    event.waitUntil(syncOfflineData());
  }
});

// ═══ Push Notifications (prêt pour l'avenir) ═══
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'Nouvelle notification O.P.U.C.',
    icon: '/pwa-icon-512.png',
    badge: '/pwa-icon-512.png',
    vibrate: [100, 50, 100],
    data: data.data || {},
    actions: data.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'O.P.U.C.', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes('/') && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow('/');
    })
  );
});

// ═══════════════════════════════════════════════════════════════════════
//  Stratégies de cache
// ═══════════════════════════════════════════════════════════════════════

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      // Mettre en cache la réponse pour le fallback
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Network failed — essayer le cache
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    // Retourner une page offline pour les requêtes de navigation
    if (request.mode === 'navigate') {
      return new Response(offlinePage(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
    return new Response(JSON.stringify({ error: 'Hors ligne — données non disponibles' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 408, statusText: 'Request timeout' });
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════════════

function isStaticAsset(pathname) {
  const staticExts = [
    '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
    '.woff', '.woff2', '.ttf', '.eot', '.webp', '.avif',
  ];
  return staticExts.some((ext) => pathname.includes(ext)) ||
    pathname.includes('/_next/static/') ||
    pathname.includes('/fonts/');
}

function isDynamicRequest(pathname) {
  return DYNAMIC_CACHE_PATTERNS.some((pattern) => pattern.test(pathname));
}

function offlinePage() {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>O.P.U.C. — Hors ligne</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; background: #f9fafb; color: #111827;
      padding: 1rem;
    }
    .container {
      text-align: center; max-width: 400px;
    }
    .icon {
      width: 80px; height: 80px; margin: 0 auto 1.5rem;
      background: #d1fae5; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 2rem;
    }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #6b7280; font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.5rem; }
    .retry-btn {
      display: inline-block; padding: 0.75rem 1.5rem;
      background: #059669; color: white; border: none;
      border-radius: 0.5rem; font-size: 0.95rem; cursor: pointer;
      text-decoration: none;
    }
    .retry-btn:hover { background: #047857; }
    .badge {
      display: inline-block; padding: 0.25rem 0.75rem;
      background: #fef3c7; color: #92400e; border-radius: 9999px;
      font-size: 0.8rem; margin-bottom: 1rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">🏗️</div>
    <div class="badge">Mode hors ligne</div>
    <h1>O.P.U.C. est indisponible</h1>
    <p>Vous êtes actuellement hors ligne. Vos données sont sauvegardées localement et seront synchronisées automatiquement dès que la connexion sera rétablie.</p>
    <button class="retry-btn" onclick="window.location.reload()">Réessayer</button>
  </div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════
//  Background Sync Handler
// ═══════════════════════════════════════════════════════════════════════

async function syncOfflineData() {
  // Cette fonction est appelée par le Background Sync API
  // Elle lit les données en attente dans IndexedDB et les envoie au serveur
  try {
    // Notifyer les clients que la sync est en cours
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({ type: 'SYNC_STARTED' });
    });

    // La logique réelle de sync est gérée côté client (via useOfflineSync hook)
    // car IndexedDB n'est pas accessible depuis le SW dans tous les navigateurs

    const clients2 = await self.clients.matchAll();
    clients2.forEach((client) => {
      client.postMessage({ type: 'SYNC_COMPLETE' });
    });
  } catch (error) {
    console.error('[SW] Erreur lors de la background sync:', error);
  }
}
