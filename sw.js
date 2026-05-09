// Hobart Hub Service Worker — Offline Support
const CACHE_NAME = 'hobart-hub-20260510b';
const APP_SHELL = [
    './',
    './index.html',
    './style.css',
    './bwi-logo.png',
    './manifest.json',
    // Tier 1: Core
    './core.js',
    './auth.js',
    './venues.js',
    './tanda.js',
    './lightspeed.js',
    './storage.js',
    './nav.js',
    './notifications.js',
    // Tier 2: Operations
    './inventory.js',
    './recipes.js',
    './menu-engineering.js',
    './ordering.js',
    './depletion.js',
    './invoices.js',
    './stocktake.js',
    // Tier 3: Management
    './analytics.js',
    './staff.js',
    './compliance.js',
    './documents.js',
    './dashboard.js',
    './engagement.js'
];

// Install: cache app shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(APP_SHELL);
        }).then(() => self.skipWaiting())
    );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
            );
        }).then(() => self.clients.claim())
    );
});

// Message handler — version query + skip waiting
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_NAME });
    }
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Fetch: cache-first for app shell, network-first for API calls
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Network-first for Firebase, Tanda, Gemini API calls
    if (url.hostname.includes('firestore.googleapis.com') ||
        url.hostname.includes('firebase') ||
        url.hostname.includes('tanda.co') ||
        url.hostname.includes('kounta.com') ||
        url.hostname.includes('generativelanguage.googleapis.com')) {
        event.respondWith(
            fetch(event.request).catch(() => {
                return new Response(JSON.stringify({ error: 'offline' }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            })
        );
        return;
    }

    // Cache-first for app shell and static assets
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((response) => {
                // Cache successful responses for fonts and CDN resources
                if (response.ok && (url.hostname.includes('fonts.googleapis.com') ||
                    url.hostname.includes('fonts.gstatic.com') ||
                    url.hostname.includes('cdnjs.cloudflare.com'))) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => {
                // Offline fallback — return cached index for navigation requests
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
                return new Response('Offline', { status: 503 });
            });
        })
    );
});
