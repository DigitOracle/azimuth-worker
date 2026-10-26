// v630 - MOMO WORK - JOBS tile, phase 2 (Kendall 26 Oct 2026: the job-search app becomes one more icon inside Momo Work).
// Read-only. The daily scanner publishes public job listings to a static jobs.json; this worker fetches that file, keeps a copy in KV and shows it as cards.
// Gate: Najjuko's key OR Kendall's (any insider key) - one shared tile; the work LOG itself stays hers alone (workRoute's own gate).
// Spec: Client_Engagements/RealEstateBroker/02_Execution/JOB_TILE_MOMO_SPEC.md (phase 3, the shared application record, is not built here).
export const JOBS_FEED_URL = "https://jobsearch-command-centre-digitalchemys-projects.vercel.app/jobs.json";
export const JOBS_CACHE_KEY = "jobs_feed_cache";
const FRESH_MS = 3 * 3600 * 1000, KV_TTL = 7 * 86400;

export function cleanFeed(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  const jobs = (Array.isArray(o.jobs) ? o.jobs : []).slice(0, 400).map((j) => ({
    c: String((j && j.c) || "").slice(0, 120), t: String((j && j.t) || "").slice(0, 200),
    u: /^https?:\/\//i.test(String((j && j.u) || "")) ? String(j.u).slice(0, 500) : "",
    k: String((j && j.k) || "").slice(0, 40), d: String((j && j.d) || "").slice(0, 10), n: j && j.n ? 1 : 0, s: String((j && j.s) || "").slice(0, 20),
  })).filter((j) => j.t);
  return { updated: String(o.updated || "").slice(0, 10), total: jobs.length, new: jobs.filter((j) => j.n).length, jobs };
}

export async function jobsFeed(env, fetchFn) {
  let cached = null; try { cached = JSON.parse(await env.MEETINGS.get(JOBS_CACHE_KEY)); } catch (e) {}
  const age = cached && cached.fetchedAt ? Date.now() - Date.parse(cached.fetchedAt) : Infinity;
  if (cached && cached.feed && age < FRESH_MS) return Object.assign({}, cached.feed, { stale: false, fetchedAt: cached.fetchedAt });
  try {
    const r = await (fetchFn || fetch)(JOBS_FEED_URL, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error("status " + r.status);
    const feed = cleanFeed(await r.json()), fetchedAt = new Date().toISOString();
    await env.MEETINGS.put(JOBS_CACHE_KEY, JSON.stringify({ fetchedAt, feed }), { expirationTtl: KV_TTL });
    return Object.assign({}, feed, { stale: false, fetchedAt });
  } catch (e) {
    if (cached && cached.feed) return Object.assign({}, cached.feed, { stale: true, fetchedAt: cached.fetchedAt });
    return { updated: "", total: 0, new: 0, jobs: [], stale: true, fetchedAt: "" };
  }
}

export const JOBS_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2"/></svg>';

const JOBS_CSS = '<style>.jf{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 14px}.jf button{border:1px solid #CFE0D2;background:#fff;color:#2F5D3F;border-radius:999px;padding:7px 12px;font:600 .8rem "IBM Plex Sans",sans-serif;cursor:pointer}.jf button.on{background:#2F5D3F;color:#fff;border-color:#2F5D3F}'
  + '.jc{display:block;background:#fff;border:1px solid #E3EBE4;border-radius:14px;padding:12px 14px;margin:0 0 10px;text-decoration:none;color:#1C2321}.jc b{display:block;font-size:.95rem;line-height:1.3}.jc span.co{color:#5F6B66;font-size:.82rem}'
  + '.jc .row{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;align-items:center}.jc i{font-style:normal;font-size:.7rem;font-weight:600;border-radius:999px;padding:3px 8px;background:#EAF2EC;color:#2F5D3F}.jc i.new{background:#2F5D3F;color:#fff}.jc i.d{background:#F3F0E8;color:#5F6B66}'
  + '.jh{color:#5F6B66;font-size:.8rem;margin:0 0 4px}.je{padding:30px 0;text-align:center;color:#5F6B66}</style>';

export const JOBS_BODY = JOBS_CSS + '<a class=back href="/momo/work" id=jback>&#8592; Work</a><div class=tag>MOMO</div><h1>Jobs</h1><p class=jh id=jhead>Loading...</p><div class=jf id=jfil></div><div id=jlist></div>';

export const JOBS_JS = `(function(){var KEY=new URLSearchParams(location.search).get("key")||"",F="All",D=null;
var $=function(i){return document.getElementById(i)};$("jback").href="/momo/work?key="+encodeURIComponent(KEY);
function src(j){return j.s==="LinkedIn"?"LinkedIn":j.s==="Bayt"?"Bayt":"Company site"}
function draw(){var js=D.jobs.filter(function(j){return F==="All"||src(j)===F});var cnt={All:D.jobs.length,LinkedIn:0,Bayt:0,"Company site":0};D.jobs.forEach(function(j){cnt[src(j)]++});
var fl=$("jfil");fl.textContent="";["All","LinkedIn","Bayt","Company site"].forEach(function(n){var b=document.createElement("button");b.type="button";b.textContent=n+" "+cnt[n];if(n===F)b.className="on";b.onclick=function(){F=n;draw()};fl.appendChild(b)});
var l=$("jlist");l.textContent="";if(!js.length){var e=document.createElement("div");e.className="je";e.textContent="No roles here yet.";l.appendChild(e);return}
js.forEach(function(j){var a=document.createElement(j.u?"a":"div");a.className="jc";if(j.u){a.href=j.u;a.target="_blank";a.rel="noopener noreferrer"}
var t=document.createElement("b");t.textContent=j.t;a.appendChild(t);var c=document.createElement("span");c.className="co";c.textContent=j.c;a.appendChild(c);
var r=document.createElement("div");r.className="row";function chip(x,k){if(!x)return;var i=document.createElement("i");if(k)i.className=k;i.textContent=x;r.appendChild(i)}
if(j.n)chip("NEW","new");chip(src(j));chip(j.k.replace(/\\//g," / "));chip(j.d,"d");a.appendChild(r);l.appendChild(a)})}
fetch("/momo/work/jobs/feed?key="+encodeURIComponent(KEY)).then(function(r){return r.json()}).then(function(d){D=d;
$("jhead").textContent=d.total?(d.total+" roles, "+d.new+" new. Updated "+d.updated+(d.stale?" (last saved copy)":"")+". The scan runs every morning."):"No roles yet. The scan runs every morning.";draw()}).catch(function(){$("jhead").textContent="Could not load the roles. Try again in a minute."})})();`;

export async function jobsRoute(request, env, url, deps) {
  const p = url.pathname, key = url.searchParams.get("key") || "", rk = url.searchParams.get("rk") || "";
  const J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (!deps.isAny(env, url)) return new Response("not found", { status: 404 });
  if (p === "/momo/work/jobs/feed" && request.method === "GET") return J(await jobsFeed(env, deps.fetch));
  if (p === "/momo/work/jobs" && request.method === "GET") return new Response(deps.page(key, rk, JOBS_BODY + "<script>" + JOBS_JS + "</script>"), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  return null;
}
