/* Online-first. NEVER cache private HTML, API responses, financial payloads or Supabase requests. */
const CACHE = 'meu-norte-public-v1';
const PUBLIC_ASSETS = ['/offline.html','/icons/icon-192.png','/icons/icon-512.png','/icons/apple-touch-icon.png','/icons/maskable-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PUBLIC_ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('meu-norte-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(request.mode==='navigate'){
   event.respondWith(fetch(request).catch(()=>caches.match('/offline.html')));
   return;
 }
 // Exact public allowlist: no API/auth routes, no RSC requests, no user-generated files.
 if(PUBLIC_ASSETS.includes(url.pathname)&&!url.search){event.respondWith(caches.match(url.pathname).then(cached=>cached||fetch(request)));}
});
