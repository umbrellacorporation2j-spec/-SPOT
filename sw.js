const V='spot-v6',SHELL=['./','./index.html','./manifest.json','./matches.json','./firebase-config.js','./icon-192.png','./icon-512.png','https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>Promise.all(SHELL.map(u=>c.add(u).catch(()=>{})))));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);
 if(!(u.origin===location.origin||u.host==='cdn.jsdelivr.net'))return;
 e.respondWith(fetch(r).then(res=>{const cp=res.clone();caches.open(V).then(c=>c.put(r,cp));return res}).catch(()=>caches.match(r).then(m=>m||caches.match('./index.html'))))});
