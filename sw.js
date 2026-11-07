// Increment this revision whenever any cached runtime file changes.
const REVISION='v0.3.0-1';
// Scope-specific prefix prevents interference with other games on the same Pages origin.
const PREFIX=`quickscoper:${self.registration.scope}:`;
const CACHE=PREFIX+REVISION;
const FILES=['./','./index.html','./style.css','./icon.svg','./manifest.webmanifest','./src/app.js','./src/math.js','./src/world.js','./src/game.js','./src/renderer.js','./src/audio.js','./src/controller.js','./src/music.js','./src/navigation.js','./src/skins.js','./src/frame-gate.js'];
const SKIN_FILES=['./assets/skins/rifle-yard.svg','./assets/skins/rifle-ivory.svg','./assets/skins/rifle-ember.svg','./assets/skins/rifle-chrome.svg','./assets/skins/rifle-jade.svg','./assets/skins/rifle-tiger.svg','./assets/skins/bots-training.svg','./assets/skins/bots-chrome.svg','./assets/skins/bots-nightshift.svg','./assets/skins/bots-hazard.svg'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES.concat(SKIN_FILES))));
  // Let an existing game finish. Updates activate after all old game tabs close.
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url),scope=new URL(self.registration.scope);
  if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
  event.respondWith(caches.open(CACHE).then(async cache=>{
    if(event.request.mode==='navigate'&&(url.pathname===scope.pathname||url.pathname===scope.pathname+'index.html')){
      return (await cache.match(new URL('./index.html',scope).href))||fetch(event.request);
    }
    return (await cache.match(event.request,{ignoreSearch:true}))||fetch(event.request);
  }));
});
