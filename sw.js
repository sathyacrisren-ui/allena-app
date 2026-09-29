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
/* BUMPED v1 -> v2 (23 Sep 2026). `activate` deletes every cache whose name is not
   the current one, so renaming is how a stale page already sitting in the shell
   cache is thrown away rather than kept. A fix can be live, verified by curl, and
   still lose to a copy the phone is holding. */
/* v2 -> v3 (28 Sep 2026): throws away the query-string copies v2 kept.
   The install below re-stores the page before the old cache goes. */
const CACHE='allena-shell-v3';
/* THE FIRST OPEN IS KEPT TOO (audit F-22, 28 Sep 2026). The page that
   installed this worker loaded before the worker could see it, so it was
   never stored, and someone whose next open was offline got nothing. The
   page is fetched once at install; a failure here never blocks the
   install, it only means the first copy arrives on the next open. */
self.addEventListener('install',e=>{self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>fetch(new Request('./',{cache:'reload'})).then(r=>{if(r&&r.ok)return c.put('./',r)})).catch(()=>{}))});
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
/* ONE COPY PER PAGE, NOT PER QUERY STRING (audit F-22). A Strava return
   (?code=…&state=sv) or a ghost link (?ghost=…) was stored under its own
   URL, one more copy each time; the copy is keyed by the path alone. */
function keyOf(req){try{const u=new URL(req.url);const k=u.origin+u.pathname;return k===req.url?req:k}catch(e){return req}}
function fallback(req){
  return caches.match(keyOf(req)).then(hit=>hit||(req.mode==='navigate'?caches.match('./'):undefined))}
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(!cacheable(req))return;
  e.respondWith(pageFetch(req).then(res=>{
    if(res&&res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(keyOf(req),copy)).catch(()=>{});return res}
    /* a server that answers with an error is not a page: during a
       deploy or an outage GitHub Pages returns a 404 or a 5xx, and
       that used to win over the good copy held here (audit F-22) */
    if(req.mode==='navigate')return fallback(req).then(hit=>hit||res);
    return res}).catch(()=>fallback(req).then(hit=>hit||Response.error())))});
