const CACHE='memeradar-shell-v7';
const SHELL=['/','/style.css?v=7','/app.js?v=7','/wallet.js?v=4','/manifest.webmanifest','/favicon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(url.origin!==location.origin||url.pathname.startsWith('/api/'))return;event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;}).catch(()=>caches.match('/'))));});
