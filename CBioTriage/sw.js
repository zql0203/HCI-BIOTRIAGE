const CACHE='cmubiotrage-v10', TILES='cmubiotrage-tiles';
const FILES=['./','index.html','styles.css','app.js','data.json','manifest.json','icons/icon.svg','assets/bg.svg','lib/leaflet.js','lib/leaflet.css','lib/images/marker-icon.png','lib/images/marker-icon-2x.png','lib/images/marker-shadow.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x.startsWith('cmubiotrage-')&&x!==CACHE&&x!==TILES).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
 const r=e.request; if(r.method!=='GET')return;
 const u=new URL(r.url);
 if(u.hostname==='tile.openstreetmap.org'){ // map tiles seen online are kept for offline use
  e.respondWith(caches.open(TILES).then(c=>c.match(r).then(hit=>hit||fetch(r).then(res=>{c.put(r,res.clone());return res}).catch(()=>Response.error()))));return;}
 if(u.origin!==location.origin || u.pathname.includes('/api/'))return;
 e.respondWith(caches.match(r,{ignoreSearch:true}).then(x=>x||fetch(r).catch(()=>caches.match('index.html'))))});
