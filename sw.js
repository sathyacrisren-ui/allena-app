/* Allena service worker (17 Sep 2026, redesign research T1, corrected).
   THE ORIGIN IS THE ACCOUNT. Every user's training record lives in
   localStorage under https://sathyacrisren-ui.github.io — a copy of the
   page bundled inside the app would load from a different origin and
   open to an empty account, which is the data-loss class this repo
   exists to prevent. So offline is done HERE, at the same origin:
   NETWORK FIRST for the page (a deploy still lands on the next open —
   the instant-fix channel is untouched), CACHE FALLBACK when the network
   is gone (a throttled App Review network, a gym basement). Nothing
   cross-origin is ever cached: Supabase, Anthropic and Strava calls pass
   straight through. */
const CACHE='allena-shell-v1';
self.addEventListener('install',e=>{self.skipWaiting()});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
function sameOrigin(req){try{return new URL(req.url).origin===self.location.origin}catch(e){return false}}
function cacheable(req){
  /* the page and its two icons; never a query-string cache-buster, never
     the sandbox (a demo must not shadow the real page on the same origin) */
  if(req.method!=='GET'||!sameOrigin(req))return false;
  const p=new URL(req.url).pathname;
  if(p.indexOf('/sandbox/')>=0)return false;
  return req.mode==='navigate'||/\.(png|html)$/.test(p)||/\/$/.test(p)}
/* ══ NETWORK FIRST IS NOT FRESH FIRST (22 Sep 2026) ═══════════════════
   GitHub Pages serves the page with `cache-control: max-age=600`, so a
   plain fetch() can be answered out of the HTTP cache for ten minutes
   after a deploy — and the wrapper hands back the SAME build it had,
   through a force-quit, with nothing saying why. A fix can be live and
   verified by curl and still not reach the one person testing it.
   The page is the one thing that must never come from a stale cache:
   a navigation goes to the network with `cache:'reload'`, which skips
   the HTTP cache on the way out and still revalidates properly. The
   CACHE FALLBACK below is untouched, so offline is unaffected. */
function pageFetch(req){
  if(req.mode!=='navigate')return fetch(req);
  try{return fetch(new Request(req,{cache:'reload'}))}catch(e){}
  return fetch(req)}                       // no Request constructor: behave exactly as before
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(!cacheable(req))return;
  e.respondWith(pageFetch(req).then(res=>{
    if(res&&res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{})}
    return res}).catch(()=>caches.match(req).then(hit=>hit||(req.mode==='navigate'?caches.match('./'):undefined)).then(hit=>hit||Response.error())))});
