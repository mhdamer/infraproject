/**
 * service-worker.js — Service Worker لمشروع الشارعين
 * v1.2 — تخزين آمن للطلبات مع دعم التحديثات
 */

const CACHE_NAME = 'sharaeen-cache-v22';
const RUNTIME_CACHE = 'sharaeen-runtime-v2';

function canCacheRequest(request) {
  return request && (request.url.startsWith('http://') || request.url.startsWith('https://'));
}

async function putInCache(cacheName, request, response) {
  if (!canCacheRequest(request)) return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response);
}

const CORE_ASSETS = [
  './', './index.html', './assets/app.js', './assets/index.css', './manifest.json', './icon-192.png', './icon-512.png', './js/css/styles.css',
  './js/core/config.js',
  './js/core/storage.js', './js/core/state.js', './js/core/utils.js', './js/core/api.js',
  './js/core/auth.js', './js/core/ui-events.js', './js/core/main.js', './js/core/pwa.js',
  './js/templates/templates-core.js',
  './js/templates/templates-panel-contractors.js',
  './js/templates/templates-panel-summary.js',
  './js/templates/templates-modals.js',
  './js/templates/inject-templates.js',
  './js/render/render-main.js', './js/render/render-tabs.js', './js/render/render-table.js',
  './js/render/render-metrics.js', './js/render/render-panels.js',
  './js/modules/row-editor.js',
  './js/modules/general-ledger.js', './js/modules/contractors.js',
  './js/modules/advances.js', './js/modules/withdrawals.js',
  './js/modules/summary.js', './js/modules/debts.js',
  './js/modules/project-advances.js',
  './js/features/ui-icons.js', './js/features/smart-filters.js', './js/features/audit-log.js',
  './js/features/excel-io.js', './js/features/print.js',
  './js/features/attachments.js', './images/receipt-template.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(CORE_ASSETS).catch(err => console.warn('SW install partial fail:', err))
    )
  );
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
  event.waitUntil(
    caches.keys().then(names => Promise.all(
      names.map(n => (n !== CACHE_NAME && n !== RUNTIME_CACHE) ? caches.delete(n) : null)
    ))
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

const NETWORK_FIRST = [/\.html$/, /\.js$/, /\/$/];
function isNetworkFirst(url) { return NETWORK_FIRST.some(p => p.test(url.pathname)); }
function isApi(url) {
  return url.pathname.startsWith('/api/') || url.hostname === 'script.google.com' || url.hostname === 'script.googleusercontent.com';
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (isApi(url)) return;

  if (isNetworkFirst(url)) {
    event.respondWith(
      fetch(event.request).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          putInCache(CACHE_NAME, event.request, clone).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  if (url.hostname !== self.location.hostname) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          const fetchPromise = fetch(event.request).then(res => {
            if (res && res.status === 200) putInCache(RUNTIME_CACHE, event.request, res.clone()).catch(() => {});
            return res;
          }).catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(res => {
      if (res && res.status === 200 && res.type === 'basic') {
        const clone = res.clone();
        putInCache(CACHE_NAME, event.request, clone).catch(() => {});
      }
      return res;
    }))
  );
});
