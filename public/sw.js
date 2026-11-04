// Minimal service worker so KinCare can be installed to the home screen.
// It does not cache data: care information must always be live.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
