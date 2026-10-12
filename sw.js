/* ATMÓS — cache de la aplicación, no intercepta datos meteorológicos de terceros. */
'use strict';
const NAME='atmos-app-shell-motion-v3';
const ASSETS=['./','./index.html','./instalar.html','./manifest.webmanifest','./icons/favicon.svg',
'./icons/atmos-180.png','./icons/atmos-192.png','./icons/atmos-large.svg','./widget/ATMOS-Widget.js'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(NAME).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('atmos-')&&k!==NAME).map(k=>caches.delete(k)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  if(req.mode==='navigate'){
    event.respondWith(fetch(req).then(response=>{
      if(response.ok){const copy=response.clone();caches.open(NAME).then(c=>c.put(req,copy)).catch(()=>{});}
      return response;
    }).catch(async()=>{
      const cache=await caches.open(NAME);
      return await cache.match(req,{ignoreSearch:true})||await cache.match('./index.html')||Response.error();
    }));
  }else event.respondWith(caches.match(req).then(hit=>hit||fetch(req)));
});