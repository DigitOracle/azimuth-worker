// DEVELOPERS MAP (v301, 4 Oct 2026) - "a map with the same interface as the nationality map, by area".
// Click an area: the developers there, grouped into four price bands (Top / Upper / Middle / Entry band), each with its median price
// per sq ft (and per sq m), the number of sales it rests on and its homes. Per realtor: MY DEVELOPERS (the shortlist, stored per client key),
// WHERE (the map shaded by how many of my developers are active), THE CLIENT MEETING (BUYER / RENTAL: a budget -> my developers that fit,
// by location). Plus DEVELOPER VIEW (where a target price lands, the area's tier mix, the competitors) and a two-area compare.
//
// DATA: Land Department register only (settled sales; Ejari contracts for the rental side). No owner data, no DEWA, no listing portal.
// It is built by scripts/build_devmap_index.mjs and published as KV img_devmap_index (the page reads it; nothing here writes it).
// THE ONLY WRITE this module ever makes is the realtor's own shortlist: KV devmap_shortlist_<hash of the client key>, through
// POST /developers_map_api?what=shortlist (needs a valid key; the key itself is never stored, only a hash).
//
// Wiring in src/index.js: one import, one marked dispatch after /brief, the two paths on CLIENT_PATHS, one card on /start.
// The page script is a String.raw block with no substitutions and no backticks (the rule src/brief_page.js keeps), checked with node --check.
import { DEVMAP_CORE_JS } from "./devmap_core.js";
import { COMMUNITY_LABELS, labelledName } from "./community_labels.js";   // v307 - community name next to the Land Department name
import { kvJson } from "./brief.js";

export const DEVMAP_PATHS = ["/developers_map", "/developers_map_api"];
const JSON_HDR = { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" };
const J = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: JSON_HDR });
export const SHORTLIST_MAX = 60;
// NAJJUKO'S TEN: the default shortlist (step 1 of the developers map) when a key has no saved list. MULTI-REALTOR FUTURE: this one constant is applied
// to EVERY key today because the only users are Kendall and Najjuko; when other realtors arrive, the default must come per key (a saved list still wins).
// ids are the developer_crosswalk brand ids (src/devcross_data.js); the page shows them ordered by sales, developers with no area yet last.
export const DEFAULT_SHORTLIST = [{ id: "omniyat", name: "Omniyat" }, { id: "nakheel", name: "Nakheel" }, { id: "meraas", name: "Meraas" }, { id: "emaar", name: "Emaar" }, { id: "imtiaz", name: "Imtiaz" }, { id: "zaya", name: "Zaya" }, { id: "ellington", name: "Ellington" }, { id: "select-group", name: "Select Group" }, { id: "damac", name: "DAMAC" }, { id: "mered", name: "Mered" }];

// the realtor's slot: a hash of the key they hold, never the key
export async function shortlistName(key) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("devmap|" + String(key || "")));
  return "devmap_shortlist_" + Array.from(new Uint8Array(buf)).slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
}
export function cleanShortlist(devs) {
  if (!Array.isArray(devs)) return null;
  const out = [];
  for (const d of devs) { const s = String(d == null ? "" : d).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60); if (s && !out.includes(s)) out.push(s); if (out.length >= SHORTLIST_MAX) break; }
  return out;
}

// deps: { clientOk, keyTier, najNav, NAJ_NAV_CSS, NAJ_FONTS, clientResp } from index.js. Returns null for any other path.
export async function devmapRoutes(request, env, url, deps) {
  const p = url.pathname;
  if (p !== "/developers_map" && p !== "/developers_map_api") return null;
  const isShortlistPost = p === "/developers_map_api" && url.searchParams.get("what") === "shortlist" && request.method === "POST";
  if (request.method !== "GET" && !isShortlistPost) return new Response("method", { status: 405 });   // before the key: a client key on a POST gets exactly what no key gets (v156); the one write is the shortlist
  if (!deps.clientOk(env, url)) return new Response("not authorised", { status: 401, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
  const key = url.searchParams.get("key") || "";
  if (p === "/developers_map") {
    return new Response(devmapHtml(key, deps), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" } });
  }
  const what = url.searchParams.get("what") || "index";
  if (what === "index") {
    const idx = await kvJson(env, "devmap_index");
    if (!idx || !idx.areas) return J({ error: "the developers index (KV img_devmap_index) is not on file yet" }, 503);
    return J(idx);
  }
  if (what === "geo") {
    const g = await kvJson(env, "district_polygons");                       // optional: the DM community boundaries per district
    return J(g && g.features ? g : { type: "FeatureCollection", features: [] });
  }
  if (what === "shortlist") {
    const name = await shortlistName(key);
    if (request.method === "POST") {
      let body = null; try { body = await request.json(); } catch (e) {}
      const devs = cleanShortlist(body && body.devs);
      if (!devs) return J({ error: "send {\"devs\": [developer keys]}" }, 400);
      await env.MEETINGS.put(name, JSON.stringify({ devs, at: new Date().toISOString() }));
      return J({ ok: true, devs });
    }
    let v = null; try { v = JSON.parse((await env.MEETINGS.get(name)) || "null"); } catch (e) {}
    return J({ devs: (v && v.devs) || [], at: (v && v.at) || null });
  }
  return J({ error: "unknown request" }, 400);
}

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const DEVMAP_FOOTER = "Curated by Najjuko · Dubai Decoded · WhatsApp +971 56 548 4397";

const CSS = String.raw`
:root{--ground:#0e1413;--panel:#151d1c;--raise:#1b2524;--ink:#e8eeec;--muted:#9aa9a5;--line:#26312f;--teal:#2f8a7f;--gold:#c5a56a}
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:var(--ground);color:var(--ink);font:14px/1.45 "IBM Plex Sans","Segoe UI",system-ui,-apple-system,sans-serif}
#map{position:fixed;top:0;bottom:0;left:340px;right:400px}
#side{position:fixed;top:0;bottom:0;left:0;width:340px;overflow:auto;background:var(--panel);border-right:1px solid var(--line);padding:14px;z-index:3}
#detail{position:fixed;top:0;bottom:0;right:0;width:400px;overflow:auto;background:var(--panel);border-left:1px solid var(--line);padding:14px}
h1{margin:0;font-family:Fraunces,Georgia,serif;font-size:18px;font-weight:600}
h2{margin:0;font-family:Fraunces,Georgia,serif;font-size:18px}
.sub,.note{color:var(--muted);font-size:12px;margin:6px 0 0}
.card{margin-top:14px}
.label{font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);margin:0 0 8px}
.seg{display:flex;border:1px solid var(--line);border-radius:6px;overflow:hidden}
.seg button{flex:1;border:0;background:var(--raise);color:var(--ink);padding:8px 2px;font:inherit;font-size:12.5px;cursor:pointer}
.seg button+button{border-left:1px solid var(--line)}
.seg button[aria-pressed="true"]{background:var(--gold);color:#1d1608;font-weight:700}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{border:1px solid var(--line);background:var(--raise);color:var(--ink);border-radius:999px;padding:4px 10px;font:inherit;font-size:12.5px;cursor:pointer}
.chip[aria-pressed="true"]{background:var(--gold);border-color:var(--gold);color:#1d1608;font-weight:600}
input,select{width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:6px;background:var(--raise);color:var(--ink);font:inherit}
.two{display:grid;grid-template-columns:1fr 1fr;gap:8px}
button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
.list{margin:0 -4px}
.row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:7px 6px;border-bottom:1px solid var(--line);cursor:pointer}
.row:hover,.row.sel{background:var(--raise)}
.row .n{font-weight:600;font-size:13px}.row .m{color:var(--muted);font-size:11.5px}
.tag{font-size:11.5px;padding:1px 7px;border-radius:4px;color:#0b1211;white-space:nowrap;align-self:center;font-weight:600}
.btn{border:1px solid var(--line);background:var(--raise);color:var(--ink);border-radius:6px;padding:4px 9px;font:inherit;font-size:12px;cursor:pointer;align-self:center}
.big{font-family:Fraunces,Georgia,serif;font-size:26px;line-height:1.1}
.mix{display:flex;height:12px;border-radius:3px;overflow:hidden;margin:4px 0 2px;background:#26312f}.mix i{display:block}
.th{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:baseline;margin-top:14px;padding:6px 8px;border-radius:6px;background:var(--raise);border-left:4px solid var(--gold)}
.th b{font-size:12.5px;letter-spacing:.6px}.th span{color:var(--muted);font-size:11.5px}
.bnd{margin:4px 0 2px}.bnd b{font-size:14px}.bnd small{display:block;color:var(--muted);font-size:11px;margin-top:1px}
.pg{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:6px 0}.pc{background:var(--raise);border-radius:6px;padding:5px 8px;border-top:3px solid var(--gold);min-width:0}.pc small{display:block;color:var(--muted);font-size:10.5px}.pc b{display:block;font-size:14px;white-space:nowrap}
.dn{grid-column:2/-1;display:flex;align-items:center;gap:10px;margin-top:2px}.dn svg{flex:none;display:block}.dn text{fill:var(--ink);font-size:11px;font-weight:600;font-family:inherit}.dn .lg{display:flex;flex-wrap:wrap;gap:2px 10px;font-size:11px;color:var(--muted)}.dn .lg span{white-space:nowrap}.dn .lg i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px}
.sh{border-left:3px solid var(--gold);padding:1px 0 1px 8px;margin:0 0 6px}.sh p{margin:0;font-size:12px}.sh small{color:var(--muted);font-size:10.5px}
.tcs{display:flex;flex-wrap:wrap;gap:4px;margin-top:3px}.tc{border:1px solid var(--gold);border-radius:9px;padding:0 6px;font-size:10px;color:var(--muted)}
.chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 6px}.chip{background:var(--raise);border-radius:11px;padding:2px 9px;font-size:11.5px}.chips small{color:var(--muted);font-size:10.5px}
.dv{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;padding:7px 4px;border-bottom:1px solid var(--line);align-items:center}
.dv.out{opacity:.45}.dv .nm{font-weight:600;font-size:13px}.dv .ms{color:var(--muted);font-size:11.5px}.dv .pr{text-align:right;font-size:13px;font-weight:600}.dv .pr small{display:block;color:var(--muted);font-weight:400;font-size:11px}
.star{border:0;background:none;color:var(--muted);font-size:18px;cursor:pointer;padding:0 2px}.star[aria-pressed="true"]{color:var(--gold)}
.box{border:1px solid var(--line);border-radius:8px;padding:10px;margin-top:12px;background:#121a19}
.cmp{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.lc{border:1px solid var(--line);border-radius:10px;padding:10px;margin-top:10px;background:var(--raise);cursor:pointer}.lh{display:flex;justify-content:space-between;align-items:center;gap:8px}.lh b{font-family:Fraunces,Georgia,serif;font-size:15px}.badge{background:var(--gold);color:#1d1608;border-radius:999px;min-width:22px;text-align:center;padding:0 7px;font-size:12px;font-weight:700}
.dg2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}@media(max-width:340px){.dg2{grid-template-columns:1fr}}
.dc{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:8px;min-width:0}.dcn{font-weight:600;font-size:13px}.dcm{color:var(--gold);font-size:11px}.dcb{font-family:Fraunces,Georgia,serif;font-size:16px;line-height:1.15;margin-top:4px;overflow-wrap:anywhere}.dcs{color:var(--muted);font-size:11.5px}.dce{color:var(--muted);font-size:10.5px;margin-top:2px}.rb{position:relative;height:3px;border-radius:2px;background:var(--line);margin-top:8px}.rb i{position:absolute;top:-3px;width:9px;height:9px;margin-left:-4px;border-radius:50%;background:var(--gold)}
.qn{color:var(--gold);font-size:11.5px}
.ev{font-size:12.5px;margin:6px 0;padding-left:8px;border-left:3px solid var(--line)}.ev b{margin-right:4px}.evt{display:block;font-size:10.5px;color:var(--gold)}
.dlink{color:inherit;text-decoration:underline dotted var(--gold);text-underline-offset:3px;cursor:pointer}
.pt{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:6px}.pt th{text-align:left;color:var(--muted);font-weight:400;font-size:11px;padding:3px 4px;border-bottom:1px solid var(--line)}.pt td{padding:5px 4px;border-bottom:1px solid var(--line)}.pt .r{text-align:right}
.src{color:var(--muted);font-size:11.5px;margin-top:14px;border-top:1px solid var(--line);padding-top:8px}
.foot{color:var(--muted);font-size:11px;margin-top:6px}
.picks{display:grid;gap:4px}
.pk{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;align-items:center;padding:6px 4px;border-bottom:1px solid var(--line);cursor:pointer;font-size:13px}
.pk input{width:auto}
.maplibregl-popup-content{background:var(--panel);color:var(--ink);border:1px solid var(--line);padding:7px 10px;font:12.5px/1.35 "IBM Plex Sans","Segoe UI",system-ui,sans-serif}
.maplibregl-popup-tip{display:none}
.evtab{width:100%;border-collapse:collapse;font-size:11.5px;margin:6px 0}.evtab th{text-align:left;color:var(--muted);font-weight:400}.evtab td,.evtab th{padding:2px 6px 2px 0;border-bottom:1px solid var(--line);vertical-align:top}
.evl{color:var(--gold);font-size:12px}.evbox h3{margin:2px 0 4px;font-size:13px}.evbox svg text{fill:var(--ink);font-size:10px;font-family:inherit}.evbox svg .ax{fill:var(--muted)}
.evbox .cl{background:var(--raise);border-left:3px solid var(--gold);padding:5px 8px;margin:8px 0;font-size:12px;border-radius:0 6px 6px 0}.evbox .why{margin:6px 0;font-size:12px}
.wnote{color:var(--muted);font-size:11.5px;margin:6px 0 0}
#grab{display:none}.dwrap{display:none}
@media(max-width:1100px){#detail{display:none}#map{right:0}#side .dwrap{display:block}}
@media(max-width:760px){
#map{left:0;right:0;bottom:0}
#side{top:auto;left:0;right:0;width:auto;height:46vh;border-right:0;border-top:1px solid var(--line);border-radius:14px 14px 0 0;box-shadow:0 -8px 24px rgba(0,0,0,.45);padding:0 14px 18px;transition:height .25s ease}
#side.max{height:88vh}
#grab{display:block;position:sticky;top:0;z-index:2;background:var(--panel);margin:0 -14px 4px;padding:8px 14px 6px;border:0;width:calc(100% + 28px);text-align:center;color:var(--muted);font:inherit;font-size:11.5px;cursor:pointer}
#grab::before{content:"";display:block;width:40px;height:4px;border-radius:2px;background:#3a4a48;margin:0 auto 5px}
}
`;

// the page script. String.raw, no substitutions, no backticks. The shared logic (DM) is injected ahead of it.
const PAGE_JS = String.raw`
(function(){
var KEY=new URLSearchParams(location.search).get("key")||"";
var $=function(id){return document.getElementById(id)};
function esc(t){return String(t==null?"":t).replace(/[&<>"]/g,function(c){return({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]})}
function api(what,opt){return fetch("/developers_map_api?what="+what+"&key="+encodeURIComponent(KEY),Object.assign({cache:"no-store",referrerPolicy:"no-referrer"},opt||{})).then(function(r){return r.ok?r.json():null})}
var TC=["#c5a56a","#2f8a7f","#3987e5","#8a9a96"];
var IDX=null,GEO=null,map=null;
window.__devmap={get map(){return map},get idx(){return IDX},get state(){return S},select:function(s){select(s,true)}};   // a handle for the preview and the tests; reads only
var S={win:"all",drawer:null,drill:null,prof:null,screen:1,mode:"buy",unit:"sqft",sel:null,onlyMine:null,mine:{},isDefault:false,bud:{mode:"sqft",min:null,max:null,beds:null},filterBud:false,named:"",dv:{ppsm:null,tier:null},cmp:null,q:""};
function fmt(n){return n==null?"-":Math.round(n).toLocaleString("en-US")}
function pu(ppsm){return ppsm==null?null:(S.unit==="sqft"?Math.round(ppsm/DM.SQFT):Math.round(ppsm))}
function pul(){return S.unit==="sqft"?"per sq ft":"per sq m"}
function other(ppsm){return S.unit==="sqft"?fmt(ppsm)+" per sq m":fmt(Math.round(ppsm/DM.SQFT))+" per sq ft"}
(function(){var b=new URLSearchParams(location.search).get("bounds");if(b){var a=b.split(",").map(Number);if(a.length===3&&a.every(isFinite)&&a[0]>a[1]&&a[1]>a[2])DM.TIER_CFG.bounds=a}})();
// ---- the shortlist: the server holds it per client key; localStorage is only a cache ----
function cacheGet(){try{return JSON.parse(localStorage.getItem("devmap_sl")||"null")}catch(e){return null}}
function cachePut(a){try{localStorage.setItem("devmap_sl",JSON.stringify(a))}catch(e){}}
var saveT=null;
function mineList(){return Object.keys(S.mine).filter(function(k){return S.mine[k]})}
function saveMine(){cachePut(mineList());clearTimeout(saveT);saveT=setTimeout(function(){api("shortlist",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({devs:mineList()})})},400)}
function toggleMine(k){S.mine[k]=!S.mine[k];if(!S.mine[k])delete S.mine[k];saveMine();renderAll()}
// ---- the areas ----
var STATS={},IXC={};
// v322 - the WINDOW. "l12" (the default when the index carries evidence) swaps each developer's building cells for the register's last-12-month cells (c12); "all" is the old view, untouched.
function hasEv(a){return !!(a&&a.ev&&a.ev.all)}
function ixOf(win){
  if(win!=="l12"||!IDX.ev)return IDX;
  if(IXC.l12)return IXC.l12;
  var o={},k,dl={},fb=[];for(k in IDX)o[k]=IDX[k];o.areas={};
  Object.keys(IDX.areas).forEach(function(s){var a=IDX.areas[s];
    if(!hasEv(a)){o.areas[s]=a;fb.push(a.name);return}
    var b={},f;for(f in a)b[f]=a[f];b.devs={};
    Object.keys(a.devs).forEach(function(dk){var d=a.devs[dk],e={},g;for(g in d)e[g]=d[g];e.c=d.c12||[];e.q=d.q12||null;e.b=d.b12!==undefined?d.b12:(d.b||[]);if(!e.c.length&&!(d.r||[]).length)return;b.devs[dk]=e});
    o.areas[s]=b});
  // v323 - the developer list, project counts and scale cut-offs for the window, so a profile never mixes a 12-month count with all-years cut-offs
  Object.keys(o.areas).forEach(function(s){var ds=o.areas[s].devs;Object.keys(ds).forEach(function(dk){if(dk==="_")return;var d=ds[dk];if(!d.c.length&&!(d.r||[]).length)return;
    var e=dl[dk]||(dl[dk]={name:d.n,areas:0,n:0,profile:{projects:0,homes:0}});e.areas++;e.profile.projects+=d.c.length?(d.b||[]).length:0;e.profile.homes+=d.h||0;d.c.forEach(function(c){e.n+=c[0]})})});
  o.devs=dl;o.scale=DM.scaleCuts({devs:dl});o.window_say=typeof dsay==="function"?winTxt():"";o.fellBack=fb;
  IXC.l12=o;return o}
function winTxt(){var M=IDX&&IDX.ev;if(S.win==="l12"&&M)return 'Sales settled '+dsay(M.l12_from)+' to '+dsay(M.l12_to)+' (the last 12 months).';return M?'Every settled sale since '+dsay(M.since)+' (all years).':'Every settled sale on record (all years).'}
function stats(slug,win){win=win||S.win;if(win==="l12"&&!IDX.ev)win="all";var key=win+":"+slug;if(!STATS[key]){var ix=ixOf(win),a=ix.areas[slug];STATS[key]=a?DM.areaStats(a,ix):null}return STATS[key]}
function features(){
  var sh=shading(),feats=[];
  if(GEO&&GEO.features&&GEO.features.length){GEO.features.forEach(function(f){var s=f.properties.slug;if(!IDX.areas[s])return;feats.push({type:"Feature",geometry:f.geometry,properties:{slug:s,label:IDX.areas[s].name,v:sh[s]||0,sel:S.sel===s,dim:dimOf(s)}})})}
  Object.keys(IDX.areas).forEach(function(s){if(GEO&&GEO.features&&GEO.features.some(function(f){return f.properties.slug===s}))return;var b=IDX.areas[s].bbox;if(!b)return;feats.push({type:"Feature",geometry:{type:"Polygon",coordinates:[[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]],[b[0],b[1]]]]},properties:{slug:s,label:IDX.areas[s].name,v:sh[s]||0,sel:S.sel===s,dim:dimOf(s)}})});
  return {type:"FeatureCollection",features:feats}}
// what the shading means: screen 1 = the area's typical tier; WHERE / CLIENT = how many of my developers are there (or fit)
function shading(){var o={},s;
  if(S.screen===1){for(s in IDX.areas){var st=stats(s);o[s]=st&&st.enough?4-DM.tierOf(st.median,st.bounds):0}return o}
  if(S.screen===3&&S.meeting){S.meeting.forEach(function(a){o[a.slug]=a.devs.length});return o}
  return DM.whereMine(ixOf(S.win),S.mine)}
function legendHtml(){
  if(S.screen===1)return TC.map(function(c,i){return '<div><span class=sw style="display:inline-block;width:14px;height:10px;border-radius:2px;margin-right:7px;background:'+c+'"></span>'+DM.TIER_NAMES[i]+'</div>'}).join("")+'<p class=note>Shading: the price band the area’s median price per sq m falls in.</p>';
  return '<p class=note>Shading: the more of '+(S.screen===3?'your developers fit the budget':'your developers are active')+' in an area, the stronger the colour. Grey: none.</p>'}
function refreshMap(){if(map&&map.getSource&&map.getSource("areas"))map.getSource("areas").setData(features())}
// ---- the screens (side panel) ----
function sideHtml(){
  var tabs='<div class=seg id=tabs><button data-s=1>1 MY DEVELOPERS</button><button data-s=2>2 WHERE</button><button data-s=3>3 CLIENT MEETING</button></div>';
  var body="";
  if(S.screen===1){
    var q=S.q.toLowerCase().trim(),mn=mineList().map(function(k){var d=IDX.devs[k];return{k:k,name:d?d.name:(DEFAULT_NAMES[k]||k),n:d?d.n:0,areas:d?d.areas:0}});
    mn.sort(function(a,b){return (b.areas>0)-(a.areas>0)||b.n-a.n});
    var chosenH=mn.map(function(x){var t=x.areas>0?devTier(x.k):-1;return '<div class=pk><span><a href="#" class=dlink data-k="'+esc(x.k)+'">'+esc(x.name)+'</a><span class=note style="display:block;margin:0">'+pickNote(x.k,x)+'</span></span>'+(t>=0?'<span class=tag style="background:'+TC[t]+'">'+tagText(x.k)+'</span>':'')+'<button type=button class="rm btn" data-k="'+esc(x.k)+'" aria-label="remove '+esc(x.name)+'">remove</button></div>'}).join("");
    var res=q?Object.keys(IDX.devs).filter(function(k){return !S.mine[k]&&(IDX.devs[k].name.toLowerCase().indexOf(q)>=0||k.indexOf(q)>=0)}).sort(function(a,b){return IDX.devs[b].n-IDX.devs[a].n}).slice(0,20):[];
    var resH=q?(res.length?res.map(function(k){var x=IDX.devs[k],t=devTier(k);return '<label class=pk><input type=checkbox data-k="'+esc(k)+'"><span>'+esc(x.name)+'<span class=note style="display:block;margin:0">add - '+pickNote(k,x)+' - <a href="#" class=dlink data-k="'+esc(k)+'">profile</a></span></span>'+(t>=0?'<span class=tag style="background:'+TC[t]+'">'+tagText(k)+'</span>':'')+'</label>'}).join(""):'<p class=note>No developer matches.</p>'):'';
    body='<div class=card><p class=label>My developers</p><p class=note id=cnt></p><div class=picks id=chosen>'+chosenH+'</div><button type=button id=reset class=btn style="margin-top:8px">Reset to Najjuko\'s ten</button></div><div class=card><p class=label>Add another developer</p><input type=search id=q placeholder="Type a developer name" value="'+esc(S.q)+'"><div class=picks id=picks>'+resH+'</div></div><p class=note>Your list is saved for your key, so it is the same on every device you open this link on. The tag is the market view where one is set, otherwise the price band most of its projects sit in. Price bands describe homes, not developers. Tap a name for its profile. Counts follow the window set on an area or a profile (now: '+(S.win==="l12"&&IDX.ev?'last 12 months':'all years')+').</p>';
  }else if(S.screen===2){
    var m=mineList();
    body='<div class=card><p class=label>Where your developers are</p>'+(m.length?'<p class=note>'+m.length+' developer'+(m.length===1?'':'s')+' chosen. Tap an area: your developers there, by price band, with price per sq ft.</p>':'<p class=note>Choose your developers on screen 1 first.</p>')+'<div class=card id=legend>'+legendHtml()+'</div></div>';
  }else{
    var b=S.bud;
    body='<div class=card><div class=seg id=modeseg><button data-m=buy>BUYER</button><button data-m=rent>RENTAL</button></div></div>'
     +'<div class=card><p class=label>Budget</p>'
     +(S.mode==="buy"?'<select id=bmode><option value=sqft>per sq ft</option><option value=sqm>per sq m</option><option value=total>total price</option></select>':'<p class=note>Yearly rent in AED</p>')
     +'<div class=two style="margin-top:8px"><input id=bmin inputmode=numeric placeholder="from (optional)" value="'+(b.min==null?'':b.min)+'"><input id=bmax inputmode=numeric placeholder="up to" value="'+(b.max==null?'':b.max)+'"></div>'
     +'<select id=bbeds style="margin-top:8px"><option value="">any bedrooms</option><option value=0>studio</option><option value=1>1 bedroom</option><option value=2>2 bedrooms</option><option value=3>3 bedrooms</option><option value=4>4 bedrooms</option><option value=5>5+ bedrooms</option></select></div>'
     +'<div class=card><p class=label>The client names a developer</p><input id=named list=devlist placeholder="Developer name" value="'+esc(S.named)+'"><datalist id=devlist>'+Object.keys(IDX.devs).map(function(k){return '<option value="'+esc(IDX.devs[k].name)+'">'}).join("")+'</datalist><div id=namedout class=note></div></div>'
     +'<div class=card><p class=label id=mh></p><p class=note id=msub style="margin:0 0 6px"></p><div class=list id=mlist></div></div>';
  }
  return tabs+body;
}
var DRILLSET=null;
function drillSet(){DRILLSET=null;var dr=S.drill;if(dr){DRILLSET={};DM.drillProjects(ixOf(S.win),dr.k,dr.t,dr.ar).forEach(function(g){DRILLSET[g.slug]=1})}}
function setDrill(dr){S.drill=dr;drillSet();renderDetail();refreshMap()}
function dimOf(s){return S.drill&&DRILLSET&&!DRILLSET[s]?1:0}
// v321 - tap a doughnut segment: the projects behind that share, grouped by location
function drillHtml(){var dr=S.drill;if(!dr)return '';var nm=(IDX.devs[dr.k]||{}).name||DEFAULT_NAMES[dr.k]||dr.k,g=DM.drillProjects(ixOf(S.win),dr.k,dr.t,dr.ar),np=0;g.forEach(function(x){np+=x.projects.length});
  var h='<div class=box style="margin-bottom:12px"><p class=label>'+esc(nm)+': projects in the '+DM.TIER_WORDS[dr.t].toLowerCase()+(dr.ar&&IDX.areas[dr.ar]?', in '+esc(IDX.areas[dr.ar].name):', by location')+'</p>';
  if(!g.length)h+='<p class=note style="margin:0">'+(DM.hasProjects(ixOf(S.win))?'No project sits in this price band here.':'The project list is not in the data yet; it arrives with the next data update.')+'</p>';
  else{h+='<p class=note style="margin:0">'+np+' project'+(np===1?'':'s')+' in '+g.length+' place'+(g.length===1?'':'s')+'. Shaded on the map.</p>';
    g.forEach(function(x){h+='<div style="margin-top:8px"><b>'+esc(x.name)+'</b> <span class=note>AED '+fmt(pu(x.ppsm))+' '+pul()+' · '+fmt(x.n)+' sales</span>'+x.projects.map(function(p){return '<div class=ms>'+(p.name?esc(p.name):'name not in the data yet')+' · AED '+fmt(pu(p.ppsm))+' '+pul()+' · '+p.n+' sale'+(p.n===1?'':'s')+'</div>'}).join("")+'</div>'})}
  return h+'<button type=button class=btn id=dclear style="margin-top:10px">Clear and show the whole map</button><p class=note>A project is a building with settled sales on record, placed by its median price per sq m. '+esc(winTxt())+' Dubai Land Department settled sales register, to '+esc(IDX.as_of||"")+'.</p></div>'}
function bandKey(bounds){return '<div class=sh style="border-left-color:var(--line)"><p class=label style="margin:0 0 4px">Price bands (per '+(S.unit==="sqft"?'sq ft':'sq m')+')</p>'+[0,1,2,3].map(function(i){return '<p><i style="display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;background:'+TC[i]+'"></i><b>'+DM.TIER_NAMES[i]+'</b>: '+esc(DM.bandLine(i,bounds,S.unit))+'</p>'}).join("")+'<small>Price bands are cut from all Dubai settled sales so that each holds about a quarter of the money spent; they describe homes, not developers.</small></div>'}
function evidenceHtml(k){var f=DM.devFactors(ixOf(S.win),k),h='<div class=card><p class=label>Positioning evidence</p><p class=note style="margin:0 0 6px">Each factor is a number, shown as it is. There is no hidden score. “Data” comes from the sales register; “Curated judgement” would be set by a person.</p>';
  function row(tag,name,txt){return '<div class=ev><span class=evt>'+tag+'</span><b>'+name+'</b> '+txt+'</div>'}
  var pl=f.priceLevel,pr=f.premium,iv=f.inventory,um=f.unitMix,lo=f.location;
  h+=row('Data','Price level',pl?'Median AED '+fmt(pu(pl.medianSqm))+' '+pul()+', '+Math.abs(Math.round(100*(pl.ratio-1)))+'% '+(pl.ratio>=1?'above':'below')+' the Dubai-wide median of AED '+fmt(pu(pl.dubaiSqm))+'. Priced higher than '+pl.pctBelow+' in every 100 developers (rank '+pl.rank+' of '+pl.total+' from the lowest).':'Not enough settled sales (under 3).');
  h+=row('Data','Price against its surroundings',pr?'Across '+pr.areas+' area'+(pr.areas===1?'':'s')+' where it has 3 or more sales, its median is '+(Math.abs(Math.round(100*(pr.ratio-1)))===0?'level with':Math.abs(Math.round(100*(pr.ratio-1)))+'% '+(pr.ratio>=1?'above':'below'))+' the median of the other developers in the same areas (weighted by its sales).':'No area where it and the other developers each have 3 or more sales.');
  h+=row('Data','Inventory and scale',iv.projects!=null?iv.projects+' project'+(iv.projects===1?'':'s')+', '+fmt(iv.sales)+' settled sales, '+iv.areas+' area'+(iv.areas===1?'':'s')+', about '+fmt(iv.salesPerProject)+' sales per project'+(iv.homesPerProject?' (about '+fmt(iv.homesPerProject)+' registered homes per project)':'')+'.':fmt(iv.sales)+' settled sales in '+iv.areas+' area'+(iv.areas===1?'':'s')+'; project counts are not in the data yet.');
  h+=row('Data','Unit mix',um?um.studioOne+'% of sales are studios and one-bedrooms, '+um.shares[2]+'% two-bedrooms, '+um.shares[3]+'% three bedrooms or more. Median home size '+fmt(um.medianSqft)+' sq ft.':'No sales.');
  h+=row('Data','Location mix',lo?lo.primePct+'% of its sales are in coastal and prime areas, '+lo.inlandPct+'% elsewhere. The coastal and prime list: '+DM.PRIME_AREAS.map(function(s){return esc((IDX.areas[s]||{}).name||s)}).join(', ')+'.':'No sales.');
  h+=row('Data','Delivery record','Not in this data yet: it needs the register’s planned and actual completion dates.');
  h+=row('Curated judgement','Quality, finish, design partners, branded residences',f.quality?esc(f.quality.note)+' <span class=note>Source: '+esc(f.quality.source)+', '+esc(f.quality.date)+'.</span>':'Not filled in. These are in no register; a note needs its source and date.');
  return h+'</div>'}
function talkHtml(k){var tp=DM.talkingPoint(ixOf(S.win),k,S.unit);
  return '<div class=card><p class=label>Talking point</p><div class=box id=tptext style="margin-top:0">'+tp.lines.map(function(l){return '<p style="margin:0 0 6px">'+esc(l)+'</p>'}).join("")+'</div><button type=button class=btn id=tcopy data-t="'+esc(tp.text)+'" style="margin-top:8px">Copy</button><p class=note>Facts come from the register, with the date. Remember: adverts need the permit number.</p></div>'}
var PPOS={};
function pricePosHtml(k){var pk=S.win+":"+k,pp=PPOS[pk]||(PPOS[pk]=DM.pricePosition(ixOf(S.win),k)),h='<p class=label style="margin-top:12px">Price position</p>';
  if(!pp.ranked)return h+'<p class=note style="margin:0">'+esc(pp.limit)+'.</p>';
  function d(x){return esc(x.name)+' (AED '+fmt(pu(x.ppsm))+' '+pul()+')'}
  var say=pp.below&&pp.above?'Priced between '+d(pp.below)+' and '+d(pp.above):pp.below?'Priced above '+d(pp.below)+'; no developer is priced higher':pp.above?'Priced below '+d(pp.above)+'; no developer is priced lower':'No other well-known developer has a price to set it beside';
  h+='<p style="margin:0"><b>'+say+'.</b></p><p class=note style="margin:2px 0 0">Its own median is AED '+fmt(pu(pp.self.ppsm))+' '+pul()+' across Dubai, ranked among '+pp.total+' developers with 3 or more settled sales. Neighbours and peers are named only from a list of well-known developers ('+pp.rankedKnown+' of them have prices here).</p>';
  if(pp.peers.length)h+='<p class=note style="margin:6px 0 2px">Closest to compare with, by number of projects and by how their projects split across the four price bands:</p>'+pp.peers.map(function(x){return '<div class=ms>'+esc(x.name)+' · '+(x.headline>=0?DM.brandLabel(x.headline)+' (market view) · ':'')+(x.scale?lc(x.scale):'')+(x.projects?' · '+x.projects+' project'+(x.projects===1?'':'s'):'')+'</div>'}).join("");
  return h}
var PROFS={};
function prof(k){var pk=S.win+":"+k;if(!PROFS[pk])PROFS[pk]=DM.devProfile(ixOf(S.win),k);return PROFS[pk]}
function lc(s){return String(s||"").toLowerCase()}
// v321 - the picker line: '10 projects · boutique · 3 areas · 312 sales', or 'no sales on the map yet'
function pickNote(k,x){var wd=ixOf(S.win).devs[k],x0=x;if(!(wd&&wd.areas>0))return S.win==="l12"&&x&&x.areas>0?'no sales in the last 12 months':'no sales on the map yet';x=wd;if(!(x.n>0))return S.win==="l12"&&x0&&x0.n>0?'no sales in the last 12 months':'rental contracts only';var p=prof(k),a=[];
  if(p.projects!=null)a.push(p.projects+' project'+(p.projects===1?'':'s')+(p.scale?' · '+lc(p.scale):''));
  a.push(x.areas+' area'+(x.areas===1?'':'s'));a.push(fmt(x.n)+' sales');return a.join(' · ')}
// v321 - under a developer's name in an area: the brand tier first, then the tier it sits in here
function brandLine(d){var p=prof(d.k);if(!p)return '';return '<div class=ms>'+(p.market>=0?'<b>'+DM.brandLabel(p.market)+'</b> (market view) · ':'')+'sells in the '+DM.TIER_WORDS[d.tier]+' here</div>'}
function tagText(k){var p=prof(k);return p.market>=0?DM.brandLabel(p.market):(p.brandTier>=0?'Mostly '+DM.TIER_WORDS[p.brandTier]:'')}
function openProf(k){S.prof=k;renderDetail();if(innerWidth<=760)setSheet(true)}
function profileHtml(k){
  var p=DM.devProfile(ixOf(S.win),k);if(!p.known)p.name=DEFAULT_NAMES[k]||k;
  var back=S.sel&&IDX.areas[S.sel]?'Back to '+esc(IDX.areas[S.sel].name):'Close';
  var h='<p class=label>Developer profile</p><h2>'+esc(p.name)+'</h2><button type=button class=btn id=pback style="margin-top:8px">'+back+'</button>';
  if(!p.areas)return h+'<p class=note>'+esc(p.name)+': no sales on the map yet.</p>'+profSrc();
  h+=wsegProf();
  h+='<div class=seg style="margin-top:10px" id=useg><button data-u=sqft>per sq ft</button><button data-u=sqm>per sq m</button></div>';
  h+='<div class=card>'+(p.market>=0?'<span class=tag style="background:'+TC[p.market]+'">'+DM.brandLabel(p.market)+' (market view)</span>':'')+'<p style="margin:10px 0 0"><b>Market view:</b> '+(p.market>=0?DM.brandLabel(p.market)+', as the market names it.':'not set yet.')+'</p><p style="margin:4px 0 0"><b>Where its projects sit on price:</b> '+esc(DM.dataLine(p))+'.</p><p class=note style="margin:4px 0 0">The market view is how people name the brand, and is set by a person. Price alone does not say whether a developer is luxury: design, quality, who it is built for and how few homes it builds in each place all matter, so no class is given from price. The evidence below shows each factor as a number.</p><p style="margin:10px 0 0">'+esc(DM.profileSentence(p,S.unit))+'</p>'+pricePosHtml(k)+'</div>'+bandKey(DM.boundsOf(IDX))+evidenceHtml(k)+talkHtml(k);
  h+='<div class=card><p class=label>Its projects by price band</p>';
  if(p.basis==="projects"){
    h+=donut(p.mixProjects,k,'').replace('Sales by price band:','Projects by price band:')+'<p class=note style="margin:6px 0 0">'+[0,1,2,3].filter(function(i){return p.tierProjects[i]>0}).map(function(i){return DM.TIER_WORDS[i]+' '+p.tierProjects[i]}).join(' · ')+' (of '+p.projects+' project'+(p.projects===1?'':'s')+')</p>'}
  else h+='<p class=note style="margin:0">Project counts are not in the data yet. Its sales split like this:</p>'+donut(p.mixSales,k,'');
  h+='<p class=note style="margin:10px 0 0">A project is a building with settled sales on record, placed in a price band by that building’s median price per sq m.</p>';
  h+='<p class=note style="margin:8px 0 0">By number of sales</p>'+bar(p.mixSales,DM.TIER_WORDS)+'<p class=note style="margin:6px 0 0">By value</p>'+bar(p.mixValue,DM.TIER_WORDS)+'</div>';
  h+='<div class=card><p class=label>Scale</p><div class=big style="font-size:20px">'+(p.projects!=null?p.projects+' project'+(p.projects===1?'':'s')+' · ':'')+p.areas+' area'+(p.areas===1?'':'s')+'</div>'+(p.scale?'<p style="margin:6px 0 0"><b>'+p.scale+'</b></p><p class=note style="margin:2px 0 0">'+esc(DM.scaleSay(p.cuts))+'</p>':'')+'</div>';
  h+='<div class=card><p class=label>Price by area (3 or more settled sales; '+(S.win==="l12"&&IDX.ev?'last 12 months':'all years')+')</p>';
  if(p.priced.length){h+='<table class=pt><tr><th>Area</th><th class=r>Median price '+pul()+'</th><th class=r>Sales</th><th>Price band here</th></tr>'+p.priced.map(function(a){return '<tr><td>'+esc(a.name)+'</td><td class=r>AED '+fmt(pu(a.medianSqm))+'</td><td class=r>'+fmt(a.n)+'</td><td>'+DM.TIER_WORDS[a.tierHere]+'</td></tr>'}).join("")+'</table>';
    h+='<p class=note>Highest first. The same price in the other unit: '+(S.unit==="sqft"?'multiply by 10.76 for per sq m.':'divide by 10.76 for per sq ft.')+'</p>'}
  else h+='<p class=note style="margin:0">No area has 3 or more settled sales yet.</p>';
  if(p.thin.length)h+='<p class=note>Also sold in, but under 3 sales so no price: '+p.thin.map(function(a){return esc(a.name)+' ('+a.n+')'}).join(', ')+'.</p>';
  h+='</div>';
  if(p.limits.length)h+='<div class=box><b>Limits.</b> '+p.limits.map(esc).join(' ')+'</div>';
  return h+profSrc()}
function wsegProf(){if(!IDX.ev)return '';var fb=ixOf(S.win).fellBack||[];return '<div class=seg style="margin-top:10px" id=wseg><button data-w=l12>Last 12 months</button><button data-w=all>All years</button></div><p class=wnote>'+esc(winTxt())+' Project counts, price bands, prices by area and the talking point all follow this window.'+(S.win==="l12"&&fb.length?' Areas with no yearly record show all years: '+esc(fb.join(', '))+'.':'')+(S.win==="l12"?' In the last 12 months a project counts when 3 or more of its sales settled in the window.':'')+'</p>'}
function profSrc(){return '<div class=src>Source: Dubai Land Department settled sales to '+esc(IDX.as_of||"")+'. Price bands are cut from all Dubai settled sales so that each holds about a quarter of the money spent; they describe homes, not developers. Medians weigh each building’s median price per sq m by the sales behind it.<div class=foot>__FOOT__</div></div>'}
function devTier(k){return prof(k).brandTier}
function mny(x){return x>=1e6?'AED '+(Math.round(x/1e5)/10)+'m':'AED '+fmt(Math.round(x/1e3))+'k'}
// v321 - the client meeting results as cards: one card per location, one small card per developer inside it. fig(d) -> {v: the figure it is placed by, big, small, ev}
function locCards(areas,fig){return areas.map(function(a){var f=a.devs.map(fig),vs=f.map(function(x){return x.v}),lo=Math.min.apply(null,vs),hi=Math.max.apply(null,vs);
  return '<div class=lc data-s="'+a.slug+'"><div class=lh><b>'+esc(a.name)+'</b><span class=badge title="how many of your developers are here">'+a.devs.length+'</span></div><div class=dg2>'+a.devs.map(function(d,i){var x=f[i],pf=prof(d.k),pos=hi>lo?Math.round(100*(x.v-lo)/(hi-lo)):null;
    return '<div class=dc><div class=dcn>'+esc(d.name)+'</div>'+(pf&&pf.market>=0?'<div class=dcm>'+DM.brandLabel(pf.market)+'</div>':'')+'<div class=dcb>'+x.big+'</div><div class=dcs>'+x.small+'</div><div class=dce>'+x.ev+'</div>'+(pos==null?'':'<div class=rb role=img aria-label="Placed '+pos+' in 100 of the way from the cheapest to the dearest of your developers here"><i style="left:'+pos+'%"></i></div>')+'</div>'}).join("")+'</div></div>'}).join("")}
function runMeeting(){
  var b=S.bud,q={mode:b.mode,min:b.min,max:b.max,beds:b.beds};
  if(S.mode==="buy"){var r=DM.clientMeeting(ixOf(S.win),S.mine,q,S.named);S.meeting=r.areas;S.namedRes=r.named;
    $("mh").textContent=r.areas.length?"Your developers that fit, by location":"";
    $("msub").textContent=winTxt()+" Prices follow the window chosen on an area.";$("mlist").innerHTML=locCards(r.areas,function(d){var v=d.basis==="total"&&d.fitMedian?d.fitMedian:d.aed;return {v:v,big:mny(v),small:'AED '+fmt(pu(d.median))+' '+pul(),ev:fmt(d.n)+' sale'+(d.n===1?'':'s')}})||'<p class=note>'+(b.max==null&&b.min==null?'Enter a budget.':'None of your developers fit this budget with enough sales (3+).')+'</p>';
  }else{var rr=DM.clientMeetingRent(ixOf(S.win),S.mine,{min:b.min,max:b.max,beds:b.beds});S.meeting=rr;S.namedRes=S.named?DM.clientMeeting(ixOf(S.win),S.mine,{mode:"sqft"},S.named).named:null;
    $("mh").textContent=rr.length?"Your developers’ buildings that fit, by location":"";$("msub").textContent=rr.length?"Registered rental contracts (the Dubai rent register), community level":"";
    $("mlist").innerHTML=locCards(rr,function(d){return {v:d.rent,big:'AED '+fmt(d.rent)+' a year',small:'AED '+fmt(S.unit==="sqft"?d.rpsf:d.rpsf*DM.SQFT)+' '+pul(),ev:fmt(d.n)+' registered rental contracts'}})||'<p class=note>None of your developers’ buildings fit, with 3 or more registered rental contracts.</p>'}
  var n=S.namedRes;$("namedout").innerHTML=n?(n.mine?esc(n.name)+' is one of your developers.':(n.known?'<b>'+esc(n.name)+' is not one of your developers.</b> You can refer the client to another agent.':'<b>'+esc(n.name)+' is not one of your developers</b>, and is not in the register data here.')):"";
  [].forEach.call($("mlist").querySelectorAll(".lc"),function(r){r.onclick=function(){select(r.getAttribute("data-s"),true)}});
  refreshMap();
}
function wireSide(){
  [].forEach.call($("tabs").querySelectorAll("button"),function(b){b.setAttribute("aria-pressed",Number(b.getAttribute("data-s"))===S.screen?"true":"false");b.onclick=function(){S.screen=Number(b.getAttribute("data-s"));if(S.screen!==3)S.meeting=null;S.onlyMine=null;renderAll()}});
  if(S.screen===1){[].forEach.call(document.querySelectorAll("#sidebody .dlink"),function(a){a.onclick=function(e){e.preventDefault();e.stopPropagation();openProf(a.getAttribute("data-k"))}});var q=$("q");q.oninput=function(){S.q=q.value;var pos=q.selectionStart;renderSide();var q2=$("q");q2.focus();q2.setSelectionRange(pos,pos)};
    [].forEach.call(document.querySelectorAll("#picks input"),function(c){c.onchange=function(){S.mine[c.getAttribute("data-k")]=true;S.q="";S.isDefault=false;saveMine();renderAll()}});
    [].forEach.call(document.querySelectorAll(".rm"),function(b){b.onclick=function(){delete S.mine[b.getAttribute("data-k")];S.isDefault=false;saveMine();renderAll()}});
    var rs=$("reset");if(rs)rs.onclick=function(){S.mine={};DEFAULT_SL.forEach(function(k){S.mine[k]=true});S.q="";S.isDefault=false;saveMine();renderAll()};
    $("cnt").textContent=mineList().length+" chosen"}
  if(S.screen===3){
    [].forEach.call($("modeseg").querySelectorAll("button"),function(b){b.setAttribute("aria-pressed",b.getAttribute("data-m")===S.mode?"true":"false");b.onclick=function(){S.mode=b.getAttribute("data-m");S.bud.mode=S.mode==="buy"?"sqft":"total";renderAll()}});
    var bm=$("bmode");if(bm){bm.value=S.bud.mode;bm.onchange=function(){S.bud.mode=bm.value;runMeeting();renderDetail()}}
    var num=function(id){var v=$(id).value.replace(/[^0-9.]/g,"");return v===""?null:Number(v)};
    var ch=function(){S.bud.min=num("bmin");S.bud.max=num("bmax");var bd=$("bbeds").value;S.bud.beds=bd===""?null:Number(bd);S.named=$("named").value;runMeeting();renderDetail()};
    ["bmin","bmax","bbeds","named"].forEach(function(id){$(id).onchange=ch;$(id).oninput=id==="bbeds"?null:ch});
    $("bbeds").value=S.bud.beds==null?"":String(S.bud.beds);runMeeting()}
}
// ---- the area panel: tiers with developers, shown at once ----
function bar(arr,names){names=names||DM.TIER_NAMES;return '<div class=mix>'+arr.map(function(v,i){return v?'<i style="width:'+v+'%;background:'+TC[i]+'" title="'+names[i]+' '+v+'%"></i>':''}).join("")+'</div><div class=note style="margin:0">'+arr.map(function(v,i){return names[i]+' '+v+'%'}).join(' · ')+'</div>'}
// v318 - inline SVG doughnut of a developer's sales split across the four tiers. No library, no network. Returns '' for missing or zero data.
function winSay(){var w=IDX.cuts&&IDX.cuts.shares&&IDX.cuts.shares.window,M=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function d(x){var m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(x||""));return m?Number(m[3])+' '+M[Number(m[2])-1]+' '+m[1]:''}
  var p=Array.isArray(w)?w:(w&&typeof w==="object"?[w.from||w.start,w.to||w.end]:(typeof w==="string"?w.split(/\s+to\s+|\s*\/\s*/):[])),x=d(p[0]),y=d(p[1]);return x&&y?x+' to '+y:'last 12 months'}
function donut(ts,dk,ar){
  var tierWord=function(k){var n=String(DM.TIER_NAMES[k]||'');return n.charAt(0).toUpperCase()+n.slice(1).toLowerCase()};   // v320 - the tier spelled out, never an initial
  if(!ts)return '';var v=[0,1,2,3].map(function(i){var x=Number(ts[i]);return isFinite(x)&&x>0?x:0}),tot=v[0]+v[1]+v[2]+v[3];if(!(tot>0))return '';
  var R=20,C=2*Math.PI*R,live=v.filter(function(x){return x>0}).length,gap=live>1?1.6:0,off=0,segs='',top=0,i;
  for(i=0;i<4;i++){if(v[i]>v[top])top=i}
  for(i=0;i<4;i++){if(!(v[i]>0))continue;var len=v[i]/tot*C;segs+='<circle cx=26 cy=26 r='+R+' fill=none stroke="'+TC[i]+'" stroke-width=6 data-tier='+i+' data-p='+v[i]+(dk?' class=dseg style="cursor:pointer" data-dk="'+esc(dk)+'" data-ar="'+esc(ar||'')+'"':'')+' stroke-dasharray="'+Math.max(len-gap,0.01).toFixed(2)+' '+(C-Math.max(len-gap,0.01)).toFixed(2)+'" stroke-dashoffset="'+(-off).toFixed(2)+'"></circle>';off+=len}
  var split=[0,1,2,3].filter(function(k){return v[k]>0}).sort(function(a,b){return v[b]-v[a]}).map(function(k){return DM.TIER_NAMES[k]+' '+v[k]+'%'}).join(', ');
  var lg=[0,1,2,3].filter(function(k){return v[k]>=5}).sort(function(a,b){return v[b]-v[a]}),one=lg.length===1;
  return '<div class=dn title="'+esc(split)+'"><svg width=48 height=48 viewBox="0 0 52 52" role=img aria-label="Sales by price band: '+esc(split)+'"><title>'+esc(split)+'</title><g transform="rotate(-90 26 26)">'+segs+'</g><text x=26 y=30 text-anchor=middle>'+Math.round(v[top])+'%</text></svg><div class=lg>'+lg.map(function(k){return '<span'+(dk?' class=dseg style="cursor:pointer" data-tier='+k+' data-dk="'+esc(dk)+'" data-ar="'+esc(ar||'')+'"':'')+'><i style="background:'+TC[k]+'"></i>'+tierWord(k)+' '+v[k]+'%</span>'}).join("")+'</div></div>'}
// v325 - HOW SURE is the developer? q = [sales the Land Department register confirms, sales matched by project name]. Absent (an older index) or all confirmed: no note.
function qNote(e){var q=e&&e.q;if(!q||!(q[1]>0))return '';var t=q[0]+q[1];return ' · <span class=qn title="The register does not name this developer for these sales. The project name or the developer sheet does.">'+(q[0]===0?'developer matched by project name':Math.round(100*q[0]/t)+'% confirmed by the register, the rest matched by project name')+'</span>'}
function devRow(d,area,st){
  var fit=null,entry=area.devs[d.k];
  if(S.screen===3||S.filterBud){if(S.mode==="buy"){fit=DM.budgetFit(entry,d,{mode:S.bud.mode,min:S.bud.min,max:S.bud.max,beds:S.bud.beds},st.bounds)}else{fit=DM.rentFit(entry,{min:S.bud.min,max:S.bud.max,beds:S.bud.beds})}}
  if(S.filterBud&&fit&&fit.fit===false&&(S.bud.max!=null||S.bud.min!=null))return "";
  var out=fit&&fit.fit===false&&(S.bud.max!=null||S.bud.min!=null);
  var price,sub,hasD=false;
  if(S.mode==="rent"){var rs=DM.rentStats(entry);price=rs.enough?'AED '+fmt(S.unit==="sqft"?rs.rpsf:rs.rpsm)+'<small>'+pul()+' a year</small>':'<small>not enough contracts</small>';sub=(rs.enough?'typical rent AED '+fmt(rs.rent)+' a year · '+rs.n+' contracts':'under 3 contracts');}
  else{price='AED '+fmt(pu(d.median))+'<small>'+pul()+' · '+other(d.median).replace(/^/,'')+'</small>';var rawd=IDX.areas[S.sel]&&IDX.areas[S.sel].devs[d.k];hasD=!!(rawd&&rawd.ev);sub=d.n+' sales'+(function(n){return n?' across '+n+' project'+(n===1?'':'s'):''})((entry.b||[]).length)+(hasEv(IDX.areas[S.sel])&&st.median?' · area AED '+fmt(pu(st.median)):'')+qNote(entry)+(hasD?' · <a href="#" class=evl data-k="'+esc(d.k)+'">Show the sales behind this number</a>':'')}
  var chips=S.mode!=="rent"?donut(d.tierShare,d.k,S.sel):'';   // v318 - the split of its sales across tiers as a doughnut, in tier colours (was pills)
  return '<div class="dv'+(out?' out':'')+'"><button class=star type=button data-k="'+esc(d.k)+'" aria-pressed="'+(S.mine[d.k]?'true':'false')+'" title="my developer">'+(S.mine[d.k]?'★':'☆')+'</button><div><div class=nm><a href="#" class=dlink data-k="'+esc(d.k)+'">'+esc(d.name)+'</a>'+(out?' <span class=ms>(outside budget)</span>':'')+'</div>'+brandLine(d)+'<div class=ms>'+sub+'</div></div><div class=pr>'+price+'</div>'+chips+'</div>'+(S.drawer===d.k&&hasD&&S.mode!=="rent"?evHtml(S.sel,d.k):'')}
// ---- v322 - THE SALES BEHIND THE NUMBER (reads index data only; nothing here is computed from anywhere else) ----
var MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function dsay(x){var m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(x||""));return m?Number(m[3])+' '+MON[Number(m[2])-1]+' '+m[1]:''}
function pq(x){return x?'AED '+fmt(pu(x)):null}
function wcell(W,i){var n=W&&W[i],m=W&&W[i+1];return !n?'none':fmt(n)+' sales · '+(m?'AED '+fmt(pu(m)):'under 3 sales, no figure')}
function sizeSay(W){if(!W||!W[11])return '';var f=function(x){return fmt(S.unit==="sqft"?x*DM.SQFT:x)},u=S.unit==="sqft"?'sq ft':'sq m';return '<p class=why>Home sizes: the middle 80% are between '+f(W[10])+' and '+f(W[12])+' '+u+' (typical '+f(W[11])+' '+u+').</p>'}
function barsSvg(ys,nm){
  var pts=ys.map(function(y){return{y:y[0],n:y[1],v:y[2]?pu(y[2]):null}}),mx=0;pts.forEach(function(p){if(p.v>mx)mx=p.v});if(!pts.length||!mx)return '';
  var w=300,top=16,base=104,step=(w-8)/pts.length,bw=14,s='';
  pts.forEach(function(p,i){var x=4+i*step+(step-bw)/2,cx=x+bw/2;
    if(p.v){var h=Math.max(2,(p.v/mx)*(base-top-4)),yy=base-h;s+='<rect x="'+x.toFixed(1)+'" y="'+yy.toFixed(1)+'" width="'+bw+'" height="'+h.toFixed(1)+'" rx="3" fill="#2f8a7f"'+(i===pts.length-1?' fill-opacity="0.65"':'')+'><title>'+p.y+': '+fmt(p.n)+' sales, median '+fmt(p.v)+' '+pul()+'</title></rect><text x="'+cx.toFixed(1)+'" y="'+(yy-3).toFixed(1)+'" text-anchor="middle">'+fmt(p.v)+'</text>'}
    else s+='<text class=ax x="'+cx.toFixed(1)+'" y="'+(base-4)+'" text-anchor="middle">under 3</text>';
    s+='<text class=ax x="'+cx.toFixed(1)+'" y="'+(base+12)+'" text-anchor="middle">'+p.y+(i===pts.length-1?'*':'')+'</text>'});
  return '<svg viewBox="0 0 '+w+' 124" width="100%" role=img aria-label="'+esc(nm)+': median price '+pul()+' by year"><line x1=4 x2='+(w-4)+' y1='+base+' y2='+base+' stroke="#26312f"/>'+s+'</svg>'}
function evWhy(E,AE,isA,mi){ // mi: index into the window block (0 = all years, 1 = last 12 months)
  var W=mi?E.l12:E.all,AW=mi?AE.l12:AE.all,out=[];
  if(isA||!W||!AW||!W[1]||!AW[1])return '';
  var r=W[1]/AW[1];if(Math.abs(r-1)<0.2)return '<p class=why>This developer is within 20% of its area, so no further explanation is needed.</p>';
  var off=W[0]?Math.round(100*W[4]/W[0]):0,aoff=AW[0]?Math.round(100*AW[4]/AW[0]):0;
  if(Math.abs(off-aoff)>=20)out.push(off+'% of its sales here are off-plan, against '+aoff+'% for the area');
  if(W[11]&&AW[11]&&(W[11]/AW[11]>=1.3||W[11]/AW[11]<=0.77))out.push('its homes are typically '+fmt(S.unit==="sqft"?W[11]*DM.SQFT:W[11])+' '+(S.unit==="sqft"?'sq ft':'sq m')+', against '+fmt(S.unit==="sqft"?AW[11]*DM.SQFT:AW[11])+' for the area');
  var vs=W[0]?Math.round(100*W[8]/W[0]):0,avs=AW[0]?Math.round(100*AW[8]/AW[0]):0;if(Math.abs(vs-avs)>=20)out.push(vs+'% of its sales are villas, against '+avs+'% for the area');
  if(!mi&&AE.all[1]&&AE.l12[1]&&Math.abs(AE.l12[1]/AE.all[1]-1)>=0.1)out.push('the area’s all-years figure includes older sales at lower prices (AED '+fmt(pu(AE.all[1]))+' over all years, AED '+fmt(pu(AE.l12[1]))+' in the last 12 months)');
  if(W[0]<30)out.push('only '+fmt(W[0])+' sale'+(W[0]===1?'':'s')+' stand behind it, so one project can move it');
  return '<p class=why><b>Why it is '+Math.round(Math.abs(r-1)*100)+'% '+(r>1?'above':'below')+' its area.</b> '+(out.length?'What the register shows: '+out.join('; ')+'. These are the differences we can see; we cannot say how much of the gap each one explains.':'The register shows no clear difference in timing, off-plan share, size or villas, so the gap may come from where the buildings stand inside the area.')+'</p>'}
function evHtml(slug,k){
  var A=IDX.areas[slug],isA=k==="__area",D=isA?null:A.devs[k],E=isA?A.ev:(D&&D.ev),M=IDX.ev||{};
  if(!E)return '<div class="box evbox"><b>The sales behind this number</b><p class=note>The register holds fewer than 10 sales for this developer here, so there is no yearly view.</p></div>';
  var nm=isA?A.name:D.n,mi=S.win==="l12"?1:0,W=E.all,L=E.l12,AE=A.ev,h='<div class="box evbox"><p class=label>The sales behind this number</p><h3>'+esc(nm)+': median price '+pul()+' by year</h3>';
  h+=barsSvg(E.y||[],nm);
  if(E.y&&E.y.length){h+='<table class=evtab><tr><th>Year<th>Sales<th>Median '+pul()+'</tr>'+E.y.map(function(y){return '<tr><td>'+y[0]+(y===E.y[E.y.length-1]?' (to '+dsay(M.l12_to)+')':'')+'<td>'+fmt(y[1])+'<td>'+(y[2]?'AED '+fmt(pu(y[2])):'under 3 sales')+'</tr>'}).join("")+'</table>'}
  else h+='<p class=note>No year-by-year view for this developer (under 50 sales on record).</p>';
  h+='<table class=evtab><tr><th><th>Last 12 months<th>All years</tr>'+[["All sales",0],["Ready",2],["Off-plan",4],["Apartments",6],["Villas",8]].map(function(r){return '<tr><td>'+r[0]+'<td>'+wcell(L,r[1])+'<td>'+wcell(W,r[1])+'</tr>'}).join("")+'</table>';
  h+=sizeSay(W);
  var as=stats(slug,"all"),al=stats(slug,"l12");
  if(isA){h+='<div class=cl>The list shows <b>AED '+fmt(pu(as&&as.median))+'</b> '+pul()+' (all years) and <b>AED '+fmt(pu(al&&al.median))+'</b> (last 12 months), both the middle of building medians. The middle of the individual sales in the register is '+pq(W[1])+' (all years, '+fmt(W[0])+' sales) and '+pq(L[1])+' (last 12 months, '+fmt(L[0])+' sales).</div>'}
  else{h+='<div class=cl>This developer '+(L[1]?'<b>'+pq(L[1])+'</b> '+pul()+' in the last 12 months':'has no figure for the last 12 months')+(W[1]?' ('+pq(W[1])+' over all years)':'')+'; its area '+(as&&as.median?'<b>'+pq(as.median)+'</b> (all years)':'')+(al&&al.median?' / <b>'+pq(al.median)+'</b> (last 12 months)':'')+'.</div>'+evWhy(E,AE,false,mi)}
  if(E.top&&E.top.length){h+='<p class=label style="margin-top:10px">Its biggest projects here</p>'+E.top.map(function(t){
      var own=t[4]?pq(t[4])+' '+pul()+' (last 12 months, '+fmt(t[3])+' sales)':pq(t[2])+' '+pul()+' (all years, '+fmt(t[1])+' sales)';
      return '<div class=why><b>'+esc(t[0]||'Project name not recorded')+'</b><br>This project '+own+'; its area '+(as&&as.median?pq(as.median)+' (all years)':'')+(al&&al.median?' / '+pq(al.median)+' (last 12 months)':'')+'.'+(t[3]?' '+Math.round(100*t[5]/t[3])+'% of its last-12-month sales are off-plan.':'')+'</div>'}).join("")}
  h+='<p class=why><b>Dates.</b> Sales settled from '+dsay(isA?AE.first:M.since)+' to '+dsay(M.l12_to)+' (the register itself runs to '+dsay(M.source_as_of)+'; the last part month is left out so every month is whole). “Last 12 months” means '+dsay(M.l12_from)+' to '+dsay(M.l12_to)+'. *The latest year is partial.</p>';
  h+='<p class=why><b>How the figures are worked out.</b> Each sale is its price divided by its size. A year’s figure is the middle sale of that year: half the sales cost less per '+(S.unit==="sqft"?'sq ft':'sq m')+', half cost more. It is never shown when fewer than 3 sales stand behind it. These come from every settled home sale the register holds here; '+esc(M.filters||'')+' The figure in the list is different on purpose: it takes the middle of building medians, weighted by the sales behind each building, so a big building counts more and a building with no record in our building cards is missing.'+(isA&&AE.shared?' This register area is shared with another map area (Golden Symphony, one tower), so these figures cover the whole register area.':'')+'</p>';
  return h+'</div>'}
function wsegHtml(area){if(!hasEv(area))return '';var M=IDX.ev||{};
  return '<div class=seg style="margin-top:10px" id=wseg><button data-w=l12>Last 12 months</button><button data-w=all>All years</button></div><p class=wnote>'+(S.win==="l12"?'Showing sales settled '+esc(dsay(M.l12_from))+' to '+esc(dsay(M.l12_to))+': what a buyer pays today. This is the default.':'Showing every settled sale since '+esc(dsay(M.since))+' from the building records: old and new prices mixed together.')+'</p>'}
function areaHtml(slug){
  var area=ixOf(S.win).areas[slug],st=stats(slug);if(!st)return '<p class=note>Tap an area on the map.</p>';
  var onlyMine=S.onlyMine==null?(mineList().length>0):S.onlyMine;
  var view=onlyMine&&mineList().length?DM.shortlistFilter(st,S.mine,area):st;
  // v314 - a thin area is a DATA GAP, never a market fact: fewer than 100 sales loaded, or the developer missing on most of them
  var thin=st.enough&&(st.n<100||(st.unknown&&st.unknown.n>=st.n*0.5));
  var opNote=area.offplan&&area.offplan.note?'<div class=box><b>Off-plan sales included.</b> '+esc(area.offplan.note)+'</div>':'';
  var reg=(S.win==="l12"&&hasEv(area)&&area.register_sales_12m!=null)?area.register_sales_12m:(area.register_sales_all_time||0), partial=!!(reg&&st.n<reg*0.7);                       // v314 - loaded vs the register's own count
  var shown=0;view.tiers.forEach(function(t){shown+=t.devs.length});
  var filtered=!!(onlyMine&&mineList().length&&st.devCount>shown);
  var mineHides=!!(onlyMine&&mineList().length&&st.devCount>0&&shown===0&&!view.notEnough.length);
  var h='<p class=label>Area</p><h2>'+esc(area.name)+'</h2>'+wsegHtml(area);
  if(!st.enough)return h+'<p class=note>Not enough sales: fewer than 3 settled sales with a price and a size in this area on the register.</p>'+src();
  h+='<div class=seg style="margin-top:10px" id=useg><button data-u=sqft>per sq ft</button><button data-u=sqm>per sq m</button></div>';
  h+='<div class=card><div class=big>AED '+fmt(pu(st.median))+' <span style="font-size:13px;color:var(--muted)">'+pul()+' median'+(hasEv(area)?', '+(S.win==="l12"?'last 12 months':'all years'):'')+'</span></div><div class=note>'+other(st.median)+' · middle half of sales: AED '+fmt(pu(st.q1))+' to '+fmt(pu(st.q3))+' · '+fmt(st.n)+' settled sales'+(thin&&!st.devCount?'':' · '+st.devCount+' developer'+(st.devCount===1?'':'s'))+(st.unknown?' · '+fmt(st.unknown.n)+' sale'+(st.unknown.n===1?'':'s')+' where the developer is not recorded yet':'')+'</div>'+(hasEv(area)?'<p style="margin:8px 0 0"><a href="#" class=evl data-k="__area">Show the sales behind this number</a></p>':'')+'</div>'+(S.drawer==="__area"&&hasEv(area)?evHtml(slug,"__area"):'')+((thin||partial)?'<div class=box><b>This view is not complete yet.</b> '+(partial?fmt(st.n)+' of about '+fmt(reg)+' settled sales in this area are loaded'+(st.unknown&&st.unknown.n>=st.n*0.3?', and the developer is not recorded on '+fmt(st.unknown.n)+' of them':'')+'. Read the figures below as a first look, not as the whole market.':st.n<100?'Only '+fmt(st.n)+' sale'+(st.n===1?' is':'s are')+' loaded for this area so far (the register holds many more)'+(st.unknown&&st.unknown.n>=st.n*0.5?', and the developer is not recorded on most of them':'')+'. Read the figures below as a first look, not as the market.':'The developer is not recorded on '+fmt(st.unknown.n)+' of the '+fmt(st.n)+' sales here, so the developer figures below are partial. Read them as a first look, not as the whole market.')+'</div>':'')+opNote+(mineHides?'<div class=box>None of your '+mineList().length+' have 3 or more recorded sales here yet'+(st.devCount?'; '+st.devCount+' other developer'+(st.devCount===1?' is':'s are')+' hidden by your filter':'')+'. <a href="#" id=showall>Show all developers here</a></div>':filtered?'<div class=box><b>'+shown+' of your '+mineList().length+' here</b>; '+(st.devCount-shown)+' other developer'+(st.devCount-shown===1?'':'s')+' hidden by your filter. <a href="#" id=showall>Show all developers here</a></div>':'');
  h+='<div class=card><p class=label>Price band mix of settled sales</p><p class=note style="margin:0">by number of sales</p>'+bar(st.mixN)+'<p class=note style="margin:6px 0 0">by value</p>'+bar(st.mixValue)+'</div>';
  h+='<div class=box><label style="display:flex;gap:8px;align-items:center;font-size:12.5px"><input type=checkbox id=onlymine style="width:auto"'+(onlyMine?' checked':'')+'> only my developers ('+mineList().length+')</label>'
   +'<label style="display:flex;gap:8px;align-items:center;font-size:12.5px;margin-top:6px"><input type=checkbox id=fbud style="width:auto"'+(S.filterBud?' checked':'')+'> drop developers outside the budget'+(S.bud.max!=null||S.bud.min!=null?'':' (set it on screen 3)')+'</label></div>';
  function tierHead(t){var e=t.edges,o='';
    if(e){var f=function(u,x){return Math.round(u==="sqft"?x/DM.SQFT:x).toLocaleString("en-US")},say=function(u){return (e.lo==null?'under AED '+f(u,e.hi):e.hi==null?'AED '+f(u,e.lo)+' and above':'AED '+f(u,e.lo)+' to '+f(u,e.hi))+(u==="sqft"?' per sq ft':' per sq m')},o2=S.unit==="sqft"?"sqm":"sqft";
      o+='<div class=bnd><b>'+say(S.unit)+'</b><small>'+say(o2)+'</small></div>'}
    if(t.cards&&t.cards.length)o+='<div class=pg style="--gold:'+TC[t.tier]+'">'+t.cards.map(function(c){return '<div class=pc><small>'+esc(c[0])+'</small><b>'+esc(c[1])+'</b></div>'}).join("")+'</div>';
    if(t.shares)o+='<div class=sh style="border-left-color:'+TC[t.tier]+'"><p>'+t.shares.n+' in every 100 Dubai sales are in this price band</p><p>together they are '+t.shares.money+'% of all money spent</p><small>All Dubai sales, '+winSay()+'</small></div>';
    return o}
  h+='<p class=note style="margin:10px 0 0">Each developer sits in the price band where most of its sales here fall (by number of sales). The doughnut shows how its sales split across the four bands; tap a segment to see the projects behind it. Under each name: its brand position, then the band it sells in here. Tap a name for its profile.</p>';
  view.tiers.forEach(function(t){
    h+='<div class=th style="border-left-color:'+TC[t.tier]+'"><b>'+t.name+'</b><span>'+(t.nDevs||!(thin||mineHides||filtered||(st.unknownTier&&st.unknownTier[t.tier]>0))?t.nDevs+' developer'+(t.nDevs===1?'':'s'):'')+(t.median?' · median AED '+fmt(pu(t.median))+' '+pul():'')+'</span></div>'+tierHead(t);
    var rows=t.devs.map(function(d){return devRow(d,area,st)}).join("");
    h+=rows||(st.unknownTier&&st.unknownTier[t.tier]>0?'<p class=note>Sales in this price band ('+fmt(st.unknownTier[t.tier])+') have no developer recorded.</p>':(thin||mineHides?'':filtered?'<p class=note>None of your developers have 3 or more sales in this price band here.</p>':'<p class=note>No developer with 3+ sales sits in this price band here.</p>'))});
  if(view.notEnough.length)h+='<p class=label style="margin-top:14px">Not enough sales (under 3)</p>'+view.notEnough.map(function(d){return '<div class=dv><button class=star type=button data-k="'+esc(d.k)+'" aria-pressed="'+(S.mine[d.k]?'true':'false')+'">'+(S.mine[d.k]?'★':'☆')+'</button><div class=nm>'+esc(d.name)+'</div><div class=ms>'+d.n+' sale'+(d.n===1?'':'s')+'</div></div>'}).join("");
  h+='<p class=note style="margin-top:10px">A developer sits in the price band where most of its sales in this area fall. Medians weigh each building’s median price per sq m by the sales behind it. Price bands are cut from all Dubai settled sales so that each holds about a quarter of the money spent; they describe homes, not developers.</p>';
  h+='<div class=box><p class=label>Developer view: where would a price land here?</p><div class=two><input id=dvp inputmode=numeric placeholder="AED '+pul()+'" value="'+(S.dv.ppsm==null?'':pu(S.dv.ppsm))+'"><select id=dvt><option value="">or pick a price band</option>'+DM.TIER_NAMES.map(function(n,i){return '<option value='+i+(S.dv.tier===i?' selected':'')+'>'+n+'</option>'}).join("")+'</select></div><div id=dvout></div>'
   +'<p class=label style="margin-top:12px">Compare with another area</p><select id=cmps><option value="">choose an area</option>'+Object.keys(IDX.areas).filter(function(s){return s!==slug}).sort(function(a,b){return IDX.areas[a].name.localeCompare(IDX.areas[b].name)}).map(function(s){return '<option value="'+s+'"'+(S.cmp===s?' selected':'')+'>'+esc(IDX.areas[s].name)+'</option>'}).join("")+'</select><div id=cmpout></div></div>';
  h+=src();return h}
function src(){return '<div class=src>Sources: Dubai Land Department sales register, '+esc(IDX.as_of||"")+(S.mode==="rent"?'; registered rental contracts (the Dubai rent register, community level, 3 or more contracts)':'')+'.<div class=foot>__FOOT__</div></div>'}
function dvHtml(st,name){var tg=S.dv.tier!=null?{tier:S.dv.tier}:(S.dv.ppsm!=null?{ppsm:S.dv.ppsm}:null);if(!tg)return '';var v=DM.developerView(st,tg);if(!v.ok)return '<p class=note>'+esc(v.why)+'</p>';
  return '<p style="margin:8px 0 2px"><b>'+(name?esc(name)+': ':'')+v.tierName+'</b> · '+esc(v.band)+'</p><p class=note style="margin:0">'+esc(v.say)+'</p>'+v.competitors.map(function(d){return '<div class=ms>'+esc(d.name)+' · AED '+fmt(pu(d.median))+' '+pul()+' · '+d.n+' sales'+'</div>'}).join("")}
function wireDetail(el,slug){
  [].forEach.call(el.querySelectorAll(".dseg"),function(g){g.onclick=function(){var tr=Number(g.getAttribute("data-tier"));setDrill({k:g.getAttribute("data-dk"),ar:g.getAttribute("data-ar")||null,t:tr})}});var tc=el.querySelector("#tcopy");if(tc)tc.onclick=function(){var x=tc.getAttribute("data-t");try{navigator.clipboard.writeText(x);tc.textContent="Copied"}catch(e){tc.textContent="Select the text above to copy"}};var dc=el.querySelector("#dclear");if(dc)dc.onclick=function(){setDrill(null)};
  [].forEach.call(el.querySelectorAll(".dlink"),function(a){a.onclick=function(e){e.preventDefault();openProf(a.getAttribute("data-k"))}});var pb=el.querySelector("#pback");if(pb)pb.onclick=function(){S.prof=null;renderDetail()};
  [].forEach.call(el.querySelectorAll(".star"),function(b){b.onclick=function(){toggleMine(b.getAttribute("data-k"))}});
  [].forEach.call(el.querySelectorAll(".evl"),function(b){b.onclick=function(e){e.preventDefault();var k=b.getAttribute("data-k");S.drawer=S.drawer===k?null:k;renderDetail()}});
  var ws=el.querySelector("#wseg");if(ws)[].forEach.call(ws.querySelectorAll("button"),function(b){b.setAttribute("aria-pressed",b.getAttribute("data-w")===S.win?"true":"false");b.onclick=function(){S.win=b.getAttribute("data-w");drillSet();renderAll()}});
  var u=el.querySelector("#useg");if(u)[].forEach.call(u.querySelectorAll("button"),function(b){b.setAttribute("aria-pressed",b.getAttribute("data-u")===S.unit?"true":"false");b.onclick=function(){S.unit=b.getAttribute("data-u");renderAll()}});
  var om=el.querySelector("#onlymine");if(om)om.onchange=function(){S.onlyMine=om.checked;renderDetail()};var sa=el.querySelector("#showall");if(sa)sa.onclick=function(e){e.preventDefault();S.onlyMine=false;renderDetail()};
  var fb=el.querySelector("#fbud");if(fb)fb.onchange=function(){S.filterBud=fb.checked;renderDetail()};
  var st=stats(slug);if(!st||!st.enough)return;
  var dvp=el.querySelector("#dvp"),dvt=el.querySelector("#dvt"),dvo=el.querySelector("#dvout"),cs=el.querySelector("#cmps"),co=el.querySelector("#cmpout");
  function upd(){dvo.innerHTML=dvHtml(st,IDX.areas[slug].name);var cmp=S.cmp&&stats(S.cmp);co.innerHTML=cmp&&(S.dv.ppsm!=null||S.dv.tier!=null)?'<div class=cmp><div>'+dvHtml(st,IDX.areas[slug].name)+'</div><div>'+dvHtml(cmp,IDX.areas[S.cmp].name)+'</div></div>':(cmp?'<p class=note>Enter a price or pick a price band to compare.</p>':'')}
  dvp.oninput=function(){var v=dvp.value.replace(/[^0-9.]/g,"");S.dv.ppsm=v===""?null:(S.unit==="sqft"?Number(v)*DM.SQFT:Number(v));if(v!=="")S.dv.tier=null,dvt.value="";upd()};
  dvt.onchange=function(){S.dv.tier=dvt.value===""?null:Number(dvt.value);if(S.dv.tier!=null){S.dv.ppsm=null;dvp.value=""}upd()};
  cs.onchange=function(){S.cmp=cs.value||null;upd()};upd()}
function renderDetail(){var h=S.prof?profileHtml(S.prof):S.sel?areaHtml(S.sel):'<p class=note>Tap an area on the map: the developers there, grouped by price band.</p>'+src();
  if(S.drill)h=drillHtml()+h;$("detail").innerHTML=h;$("detail2").innerHTML=(S.sel||S.prof)?h:"";$("detail2").style.display=(S.sel||S.prof)?"":"none";wireDetail($("detail"),S.sel);wireDetail($("detail2"),S.sel)}
function renderSide(){$("sidebody").innerHTML=sideHtml();wireSide()}
function renderAll(){renderSide();renderDetail();refreshMap()}
function select(slug,fly){S.sel=slug;S.prof=null;S.cmp=null;S.drawer=null;if(S.drill&&S.drill.ar&&S.drill.ar!==slug){S.drill=null;DRILLSET=null}S.onlyMine=null;renderDetail();refreshMap();if(innerWidth<=760)setSheet(false);
  if(fly&&map){var b=IDX.areas[slug]&&IDX.areas[slug].bbox;if(b)map.fitBounds([[b[0],b[1]],[b[2],b[3]]],{padding:innerWidth<=760?{top:40,left:30,right:30,bottom:Math.round(innerHeight*0.46)+20}:60,maxZoom:13.5,duration:600})}}
function setSheet(max){var s=$("side"),g=$("grab");s.classList.toggle("max",!!max);g.setAttribute("aria-expanded",max?"true":"false");g.textContent=max?"Tap to see more of the map":"Tap to expand"}
$("grab").onclick=function(){setSheet(!$("side").classList.contains("max"))};
function startMap(){
  map=new maplibregl.Map({container:"map",style:"https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",center:[55.2,25.08],zoom:9.6,attributionControl:{compact:true}});
  map.addControl(new maplibregl.NavigationControl({showCompass:false}),"top-right");
  map.on("load",function(){
    var layers=map.getStyle().layers,fs=(layers.find(function(l){return l.type==="symbol"})||{}).id;
    var font=((layers.find(function(l){return l.type==="symbol"&&l.layout&&l.layout["text-font"]})||{}).layout||{})["text-font"]||["Open Sans Regular"];
    map.addSource("areas",{type:"geojson",data:features()});
    map.addLayer({id:"a-fill",type:"fill",source:"areas",paint:{"fill-color":["match",["get","v"],0,"#6f7a78",1,"#2f8a7f",2,"#3987e5",3,"#c98500","#c5a56a"],"fill-opacity":["case",["==",["get","dim"],1],0.04,["==",["get","v"],0],0.12,0.55]}},fs);
    map.addLayer({id:"a-line",type:"line",source:"areas",paint:{"line-color":["case",["==",["get","dim"],1],"rgba(197,165,106,0.1)",["get","sel"],"#c5a56a","rgba(197,165,106,0.45)"],"line-width":["case",["get","sel"],2.6,0.8]}},fs);
    map.addLayer({id:"a-label",type:"symbol",source:"areas",layout:{"text-field":["get","label"],"text-font":font,"text-size":11.5,"text-max-width":9},paint:{"text-color":"#f5efe2","text-halo-color":"#0b0f0f","text-halo-width":1.4}});
    var pop=new maplibregl.Popup({closeButton:false,closeOnClick:false,offset:12});
    map.on("mousemove","a-fill",function(e){map.getCanvas().style.cursor="pointer";pop.setLngLat(e.lngLat).setHTML("<b>"+esc(e.features[0].properties.label)+"</b>").addTo(map)});
    map.on("mouseleave","a-fill",function(){map.getCanvas().style.cursor="";pop.remove()});
    map.on("click","a-fill",function(e){select(e.features[0].properties.slug,false)})})}
// ---- start ----
Promise.all([api("index"),api("geo"),api("shortlist")]).then(function(r){
  IDX=r[0];GEO=r[1];
  if(IDX&&IDX.ev)S.win="l12";   // v322 - prices a realtor quotes today: the last 12 months, unless the index carries no evidence yet
  if(IDX&&IDX.areas)Object.keys(IDX.areas).forEach(function(s){var l=IDX.areas[s].label||CL[s];if(l)IDX.areas[s].name=l;IDX.areas[s].name=IDX.areas[s].name.replace(/\bJLT\b/g,"Jumeirah Lakes Towers")});   // v321 - an area is never shown as an initial
  if(!IDX||!IDX.areas){$("sidebody").innerHTML='<p class=note>The developers data is not on file yet.</p>';return}
  var saved=r[2]&&r[2].at&&r[2].devs?r[2].devs:null,cg=cacheGet(),sl=saved||(cg&&cg.length?cg:null);if(!sl){sl=DEFAULT_SL.slice();S.isDefault=true}var sl0=sl.join("|");sl=DM.resolveSaved(IDX,sl);sl.forEach(function(k){S.mine[k]=true});if(!S.isDefault&&sl.join("|")!==sl0)saveMine();   // v326 - ids saved before the developer crosswalk ("select", "damac ( )") are moved to today's id, so they list their projects and show on the map
  $("source").textContent="Land Department sales register, "+(IDX.as_of||"")+". Price bands: "+IDX.cuts.rule;
  if(DM.TIER_CFG.bounds)$("source").textContent="Land Department sales register, "+(IDX.as_of||"")+". Price bands (cut from all Dubai settled sales so each holds about a quarter of the money spent; they describe homes, not developers): "+DM.TIER_CFG.bounds.join(" / ")+" AED per sq m.";
  if(mineList().length&&!S.isDefault)S.screen=2;
  var pa=new URLSearchParams(location.search).get("area");if(pa&&IDX.areas[pa])S.sel=pa;var pdr=new URLSearchParams(location.search).get("evidence");if(pdr&&S.sel)S.drawer=pdr;var pw=new URLSearchParams(location.search).get("window");if(pw==="all"||pw==="l12")S.win=pw;   // v314 - a link can open one area (also used by scripts/devmap_preview.mjs); v322 - and the evidence drawer and the window
  var pq=new URLSearchParams(location.search);if(pq.get("prof"))S.prof=pq.get("prof");var dq=pq.get("drill");if(dq){var q2=dq.split(":");S.drill={k:q2[0],t:Number(q2[1]),ar:q2[2]||null}}if(pq.get("meet")){S.screen=3;S.mode=pq.get("meet")==="rent"?"rent":"buy";S.bud.mode=S.mode==="buy"?"sqft":"total"}   // v321 - a link can open a profile, a drill-down or the client meeting (used by scripts/devmap_preview.mjs and the tests)
  renderAll();if(S.drill)setDrill(S.drill);if(pq.get("sheet")==="max")setSheet(true);
  if(window.maplibregl)startMap();else $("map").innerHTML='<p class=note style="padding:16px">The map could not load. The lists still work.</p>';
}).catch(function(){$("sidebody").innerHTML='<p class=note>The developers data did not load.</p>'});
})();
`;

export function devmapHtml(key, deps) {
  const nav = deps && deps.NAJ_FONTS ? deps.NAJ_FONTS : "";
  const js = DEVMAP_CORE_JS + "var DEFAULT_SL=" + JSON.stringify(DEFAULT_SHORTLIST.map((d) => d.id)) + ",DEFAULT_NAMES=" + JSON.stringify(Object.fromEntries(DEFAULT_SHORTLIST.map((d) => [d.id, d.name]))) + ";var CL=" + JSON.stringify(Object.fromEntries(Object.keys(COMMUNITY_LABELS).map((s) => [s, labelledName(s)]))).replace(/</g, "\\u003c") + ";" + PAGE_JS.replace(/__FOOT__/g, esc(DEVMAP_FOOTER));
  return '<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name=referrer content=no-referrer><meta name=robots content="noindex,nofollow"><title>Najma - developers by area</title><link rel=icon href=/naj_icon.svg><meta name=theme-color content="#0e1413">' + nav
    + '<link rel=stylesheet href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css"><style>' + CSS + '</style></head><body>'
    + '<div id=map role=region aria-label="Map of Dubai areas: developers and prices"></div>'
    + '<aside id=side><button id=grab aria-expanded=false>Tap to expand</button><h1>Developers by area</h1><div class=sub id=source>Loading...</div>'
    + '<div id=sidebody></div><div class="card dwrap" id=detail2 style="display:none"></div></aside><aside id=detail></aside>'
    + '<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script><script>' + js + '</script></body></html>';
}

// the START card: one tap into the page (same look as the other START cards)
export function devmapStartCard(key) {
  return '<a class=ejin href="/developers_map?key=' + esc(encodeURIComponent(key || "")) + '" style="display:block;text-decoration:none;color:inherit">'
    + '<div class="ejc suc"><div class=ejh><div class="ic suic">&#128205;</div><div><b>Developers by area</b><span>Tap an area: its developers by price band, and the price per sq ft</span></div></div></div></a>';
}
