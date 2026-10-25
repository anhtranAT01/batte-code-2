const CACHE='battlecode-app-__BUILD_ID__';
const ASSETS=__ASSETS__;
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['/index.html']))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  await self.clients.claim();
  const old=(await caches.keys()).filter(key=>key.startsWith('battlecode-app-')&&key!==CACHE);
  await Promise.all(old.slice(0,-1).map(key=>caches.delete(key)));
})()));
// Explicit opt-in downloads all lazy views; never caches API, user data or tokens.
self.addEventListener('message',event=>{
  if(event.data?.type==='CACHE_APP')event.waitUntil((async()=>{
    try{const cache=await caches.open(CACHE);await cache.addAll(ASSETS);event.ports[0]?.postMessage({ok:true});}
    catch{event.ports[0]?.postMessage({ok:false,error:'Chưa tải đủ giao diện ngoại tuyến. Hãy thử lại khi có mạng.'});}
  })());
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/socket.io'))return;
  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4000);
      try{const response=await fetch(request,{signal:controller.signal});if(response.ok){const cache=await caches.open(CACHE);await cache.put('/index.html',response.clone());}return response;}
      catch{return (await caches.open(CACHE)).match('/index.html');}finally{clearTimeout(timer);}
    })());return;
  }
  if(!ASSETS.includes(url.pathname)&&!url.pathname.startsWith('/assets/')&&url.pathname!=='/offline-engine.js')return;
  event.respondWith(caches.open(CACHE).then(async cache=>{
    const saved=await caches.match(request);if(saved)return saved;
    const response=await fetch(request);if(response.ok)await cache.put(request,response.clone());return response;
  }));
});
