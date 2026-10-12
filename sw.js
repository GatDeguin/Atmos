/* ATMÓS offline shell. Never cache weather APIs here: the UI owns data freshness. */
'use strict';
const PREFIX='atmos:'+new URL(self.registration.scope).pathname+':';
const CACHE=PREFIX+'2.0.0';
const FILES=['./','./index.html','./app.css?v=2.0.0','./model.js?v=2.0.0','./motion.js?v=2.0.0','./app.js?v=2.0.0','./manifest.webmanifest','./icons/favicon.svg','./icons/atmos-180.png','./icons/atmos-192.png','./icons/atmos-large.svg','./instalar.html','./widget/ATMOS-Widget.js'];
const absolute=p=>new URL(p,self.registration.scope).href;
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 await cache.addAll(FILES.map(p=>new Request(absolute(p),{cache:'reload'})));
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)));
 await self.clients.claim();
})()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url),scope=new URL(self.registration.scope);
 if(request.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
 if(request.mode==='navigate'){
  event.respondWith((async()=>{
   const cache=await caches.open(CACHE),ac=new AbortController(),timer=setTimeout(()=>ac.abort(),4000);
   try{const response=await fetch(request,{signal:ac.signal});if(!response.ok)throw Error('HTTP '+response.status);return response;}
   catch{const path=new URL(url.pathname,scope.origin).href;
    const saved=await cache.match(path)||(url.pathname===scope.pathname?await cache.match(absolute('./index.html')):null);
    return saved||new Response('ATMÓS: esta página no está guardada. Volvé al inicio y conectate para actualizar.',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});
   }finally{clearTimeout(timer);}
  })());return;
 }
 if(FILES.some(p=>absolute(p)===url.href))event.respondWith((async()=>{const cache=await caches.open(CACHE);return await cache.match(request)||fetch(request);})());
});
