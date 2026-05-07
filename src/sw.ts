/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

declare let self: ServiceWorkerGlobalScope;

clientsClaim();
self.skipWaiting();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Purge the old 'navigate' runtime cache from previous SW versions.
// That cache may contain cached 404 responses for app routes that were
// fetched before vercel.json existed, causing stale failures for PWA users.
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(caches.delete('navigate'));
});

// Navigation fallback — always serve the precached index.html for every
// app route. createHandlerBoundToURL is the correct SPA pattern: it returns
// the precached index.html without hitting the network, so a missing server
// fallback can never produce a cached 404 here.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'))
);

// Exchange rate APIs — network-first with 8s timeout, 1h runtime cache.
registerRoute(
  ({ url }) => url.hostname.includes('open.er-api.com') || url.hostname.includes('frankfurter.app'),
  new NetworkFirst({
    cacheName: 'exchange-rates',
    networkTimeoutSeconds: 8,
  })
);
