// DEVELOPERS MAP (v301, 4 Oct 2026) - "a map with the same interface as the nationality map, by area".
// Click an area: the developers there, grouped into four price tiers (ULTRA-LUXURY / LUXURY / PREMIUM / BUDGET), each with its median price
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
import { kvJson } from "./brief.js";

export const DEVMAP_PATHS = ["/developers_map", "/developers_map_api"];
const JSON_HDR = { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" };
const J = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: JSON_HDR });
export const SHORTLIST_MAX = 60;

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
.big{font-family:Fraunces,Georgia,serif;font-size:26px;line-height:1.1}
.mix{display:flex;height:12px;border-radius:3px;overflow:hidden;margin:4px 0 2px;background:#26312f}.mix i{display:block}
.th{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:baseline;margin-top:14px;padding:6px 8px;border-radius:6px;background:var(--raise);border-left:4px solid var(--gold)}
.th b{font-size:12.5px;letter-spacing:.6px}.th span{color:var(--muted);font-size:11.5px}
.dv{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;padding:7px 4px;border-bottom:1px solid var(--line);align-items:center}
.dv.out{opacity:.45}.dv .nm{font-weight:600;font-size:13px}.dv .ms{color:var(--muted);font-size:11.5px}.dv .pr{text-align:right;font-size:13px;font-weight:600}.dv .pr small{display:block;color:var(--muted);font-weight:400;font-size:11px}
.star{border:0;background:none;color:var(--muted);font-size:18px;cursor:pointer;padding:0 2px}.star[aria-pressed="true"]{color:var(--gold)}
.box{border:1px solid var(--line);border-radius:8px;padding:10px;margin-top:12px;background:#121a19}
.cmp{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.src{color:var(--muted);font-size:11.5px;margin-top:14px;border-top:1px solid var(--line);padding-top:8px}
.foot{color:var(--muted);font-size:11px;margin-top:6px}
.picks{display:grid;gap:4px}
.pk{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;align-items:center;padding:6px 4px;border-bottom:1px solid var(--line);cursor:pointer;font-size:13px}
.pk input{width:auto}
.maplibregl-popup-content{background:var(--panel);color:var(--ink);border:1px solid var(--line);padding:7px 10px;font:12.5px/1.35 "IBM Plex Sans","Segoe UI",system-ui,sans-serif}
.maplibregl-popup-tip{display:none}
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
var S={screen:1,mode:"buy",unit:"sqft",sel:null,onlyMine:null,mine:{},bud:{mode:"sqft",min:null,max:null,beds:null},filterBud:false,named:"",dv:{ppsm:null,tier:null},cmp:null,q:""};
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
var STATS={};
function stats(slug){if(!STATS[slug]){var a=IDX.areas[slug];STATS[slug]=a?DM.areaStats(a,IDX):null}return STATS[slug]}
function features(){
  var sh=shading(),feats=[];
  if(GEO&&GEO.features&&GEO.features.length){GEO.features.forEach(function(f){var s=f.properties.slug;if(!IDX.areas[s])return;feats.push({type:"Feature",geometry:f.geometry,properties:{slug:s,label:IDX.areas[s].name,v:sh[s]||0,sel:S.sel===s}})})}
  Object.keys(IDX.areas).forEach(function(s){if(GEO&&GEO.features&&GEO.features.some(function(f){return f.properties.slug===s}))return;var b=IDX.areas[s].bbox;if(!b)return;feats.push({type:"Feature",geometry:{type:"Polygon",coordinates:[[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]],[b[0],b[1]]]]},properties:{slug:s,label:IDX.areas[s].name,v:sh[s]||0,sel:S.sel===s}})});
  return {type:"FeatureCollection",features:feats}}
// what the shading means: screen 1 = the area's typical tier; WHERE / CLIENT = how many of my developers are there (or fit)
function shading(){var o={},s;
  if(S.screen===1){for(s in IDX.areas){var st=stats(s);o[s]=st&&st.enough?4-DM.tierOf(st.median,st.bounds):0}return o}
  if(S.screen===3&&S.meeting){S.meeting.forEach(function(a){o[a.slug]=a.devs.length});return o}
  return DM.whereMine(IDX,S.mine)}
function legendHtml(){
  if(S.screen===1)return TC.map(function(c,i){return '<div><span class=sw style="display:inline-block;width:14px;height:10px;border-radius:2px;margin-right:7px;background:'+c+'"></span>'+DM.TIER_NAMES[i]+'</div>'}).join("")+'<p class=note>Shading: the tier the area’s median price per sq m falls in.</p>';
  return '<p class=note>Shading: the more of '+(S.screen===3?'your developers fit the budget':'your developers are active')+' in an area, the stronger the colour. Grey: none.</p>'}
function refreshMap(){if(map&&map.getSource&&map.getSource("areas"))map.getSource("areas").setData(features())}
// ---- the screens (side panel) ----
function sideHtml(){
  var tabs='<div class=seg id=tabs><button data-s=1>1 MY DEVELOPERS</button><button data-s=2>2 WHERE</button><button data-s=3>3 CLIENT MEETING</button></div>';
  var body="";
  if(S.screen===1){
    var all=Object.keys(IDX.devs).map(function(k){return{k:k,d:IDX.devs[k]}}).sort(function(a,b){return b.d.n-a.d.n});
    var q=S.q.toLowerCase();
    body='<div class=card><p class=label>Choose your developers (about ten)</p><input type=search id=q placeholder="Search a developer" value="'+esc(S.q)+'"><p class=note id=cnt></p><div class=picks id=picks>'+all.filter(function(x){return !q||x.d.name.toLowerCase().indexOf(q)>=0||x.k.indexOf(q)>=0}).slice(0,200).map(function(x){var t=devTier(x.k);return '<label class=pk><input type=checkbox data-k="'+esc(x.k)+'"'+(S.mine[x.k]?' checked':'')+'><span>'+esc(x.d.name)+'<span class=note style="display:block;margin:0">'+x.d.areas+' area'+(x.d.areas===1?'':'s')+' · '+fmt(x.d.n)+' sales</span></span>'+(t>=0?'<span class=tag style="background:'+TC[t]+'">'+DM.TIER_NAMES[t]+'</span>':'')+'</label>'}).join("")+'</div></div><p class=note>Your list is saved for your key, so it is the same on every device you open this link on. The tier shown is where most of the developer’s sales across Dubai fall.</p>';
  }else if(S.screen===2){
    var m=mineList();
    body='<div class=card><p class=label>Where your developers are</p>'+(m.length?'<p class=note>'+m.length+' developer'+(m.length===1?'':'s')+' chosen. Tap an area: your developers there, by tier, with price per sq ft.</p>':'<p class=note>Choose your developers on screen 1 first.</p>')+'<div class=card id=legend>'+legendHtml()+'</div></div>';
  }else{
    var b=S.bud;
    body='<div class=card><div class=seg id=modeseg><button data-m=buy>BUYER</button><button data-m=rent>RENTAL</button></div></div>'
     +'<div class=card><p class=label>Budget</p>'
     +(S.mode==="buy"?'<select id=bmode><option value=sqft>per sq ft</option><option value=sqm>per sq m</option><option value=total>total price</option></select>':'<p class=note>Yearly rent in AED</p>')
     +'<div class=two style="margin-top:8px"><input id=bmin inputmode=numeric placeholder="from (optional)" value="'+(b.min==null?'':b.min)+'"><input id=bmax inputmode=numeric placeholder="up to" value="'+(b.max==null?'':b.max)+'"></div>'
     +'<select id=bbeds style="margin-top:8px"><option value="">any bedrooms</option><option value=0>studio</option><option value=1>1 bedroom</option><option value=2>2 bedrooms</option><option value=3>3 bedrooms</option><option value=4>4 bedrooms</option><option value=5>5+ bedrooms</option></select></div>'
     +'<div class=card><p class=label>The client names a developer</p><input id=named list=devlist placeholder="Developer name" value="'+esc(S.named)+'"><datalist id=devlist>'+Object.keys(IDX.devs).map(function(k){return '<option value="'+esc(IDX.devs[k].name)+'">'}).join("")+'</datalist><div id=namedout class=note></div></div>'
     +'<div class=card><p class=label id=mh></p><div class=list id=mlist></div></div>';
  }
  return tabs+body;
}
function devTier(k){var c=[],s,a;for(s in IDX.areas){a=IDX.areas[s].devs[k];if(a)c=c.concat(a.c||[])}if(DM.devStats({k:k,n:"",c:c},DM.boundsOf(IDX)).enough)return DM.devStats({k:k,n:"",c:c},DM.boundsOf(IDX)).tier;return -1}
function runMeeting(){
  var b=S.bud,q={mode:b.mode,min:b.min,max:b.max,beds:b.beds};
  if(S.mode==="buy"){var r=DM.clientMeeting(IDX,S.mine,q,S.named);S.meeting=r.areas;S.namedRes=r.named;
    $("mh").textContent=r.areas.length?"Your developers that fit, by location":"";
    $("mlist").innerHTML=r.areas.map(function(a){return '<div class=row data-s="'+a.slug+'"><div><div class=n>'+esc(a.name)+'</div>'+a.devs.map(function(d){return '<div class=m>'+esc(d.name)+' · '+DM.TIER_NAMES[d.tier]+' · AED '+fmt(pu(d.median))+' '+pul()+(d.basis==="total"?' (median AED '+fmt(d.fitMedian)+')':'')+'</div>'}).join("")+'</div><span class=tag style="background:#c5a56a">'+a.devs.length+'</span></div>'}).join("")||'<p class=note>'+(b.max==null&&b.min==null?'Enter a budget.':'None of your developers fit this budget with enough sales (3+).')+'</p>';
  }else{var rr=DM.clientMeetingRent(IDX,S.mine,{min:b.min,max:b.max,beds:b.beds});S.meeting=rr;S.namedRes=S.named?DM.clientMeeting(IDX,S.mine,{mode:"sqft"},S.named).named:null;
    $("mh").textContent=rr.length?"Your developers’ buildings that fit, by location (Ejari contracts, community level)":"";
    $("mlist").innerHTML=rr.map(function(a){return '<div class=row data-s="'+a.slug+'"><div><div class=n>'+esc(a.name)+'</div>'+a.devs.map(function(d){return '<div class=m>'+esc(d.name)+' · typical AED '+fmt(d.rent)+' a year · AED '+fmt(S.unit==="sqft"?d.rpsf:d.rpsf*DM.SQFT)+' '+pul()+' a year · '+d.n+' contracts</div>'}).join("")+'</div><span class=tag style="background:#c5a56a">'+a.devs.length+'</span></div>'}).join("")||'<p class=note>None of your developers’ buildings fit, with 3+ contracts.</p>'}
  var n=S.namedRes;$("namedout").innerHTML=n?(n.mine?esc(n.name)+' is one of your developers.':(n.known?'<b>'+esc(n.name)+' is not one of your developers.</b> You can refer the client to another agent.':'<b>'+esc(n.name)+' is not one of your developers</b>, and is not in the register data here.')):"";
  [].forEach.call($("mlist").querySelectorAll(".row"),function(r){r.onclick=function(){select(r.getAttribute("data-s"),true)}});
  refreshMap();
}
function wireSide(){
  [].forEach.call($("tabs").querySelectorAll("button"),function(b){b.setAttribute("aria-pressed",Number(b.getAttribute("data-s"))===S.screen?"true":"false");b.onclick=function(){S.screen=Number(b.getAttribute("data-s"));if(S.screen!==3)S.meeting=null;S.onlyMine=null;renderAll()}});
  if(S.screen===1){var q=$("q");q.oninput=function(){S.q=q.value;var pos=q.selectionStart;renderSide();var q2=$("q");q2.focus();q2.setSelectionRange(pos,pos)};
    [].forEach.call(document.querySelectorAll("#picks input"),function(c){c.onchange=function(){var k=c.getAttribute("data-k");if(c.checked)S.mine[k]=true;else delete S.mine[k];saveMine();$("cnt").textContent=mineList().length+" chosen";refreshMap();renderDetail()}});$("cnt").textContent=mineList().length+" chosen"}
  if(S.screen===3){
    [].forEach.call($("modeseg").querySelectorAll("button"),function(b){b.setAttribute("aria-pressed",b.getAttribute("data-m")===S.mode?"true":"false");b.onclick=function(){S.mode=b.getAttribute("data-m");S.bud.mode=S.mode==="buy"?"sqft":"total";renderAll()}});
    var bm=$("bmode");if(bm){bm.value=S.bud.mode;bm.onchange=function(){S.bud.mode=bm.value;runMeeting();renderDetail()}}
    var num=function(id){var v=$(id).value.replace(/[^0-9.]/g,"");return v===""?null:Number(v)};
    var ch=function(){S.bud.min=num("bmin");S.bud.max=num("bmax");var bd=$("bbeds").value;S.bud.beds=bd===""?null:Number(bd);S.named=$("named").value;runMeeting();renderDetail()};
    ["bmin","bmax","bbeds","named"].forEach(function(id){$(id).onchange=ch;$(id).oninput=id==="bbeds"?null:ch});
    $("bbeds").value=S.bud.beds==null?"":String(S.bud.beds);runMeeting()}
}
// ---- the area panel: tiers with developers, shown at once ----
function bar(arr){return '<div class=mix>'+arr.map(function(v,i){return v?'<i style="width:'+v+'%;background:'+TC[i]+'" title="'+DM.TIER_NAMES[i]+' '+v+'%"></i>':''}).join("")+'</div><div class=note style="margin:0">'+arr.map(function(v,i){return DM.TIER_NAMES[i]+' '+v+'%'}).join(' · ')+'</div>'}
function devRow(d,area,st){
  var fit=null,entry=area.devs[d.k];
  if(S.screen===3||S.filterBud){if(S.mode==="buy"){fit=DM.budgetFit(entry,d,{mode:S.bud.mode,min:S.bud.min,max:S.bud.max,beds:S.bud.beds},st.bounds)}else{fit=DM.rentFit(entry,{min:S.bud.min,max:S.bud.max,beds:S.bud.beds})}}
  if(S.filterBud&&fit&&fit.fit===false&&(S.bud.max!=null||S.bud.min!=null))return "";
  var out=fit&&fit.fit===false&&(S.bud.max!=null||S.bud.min!=null);
  var price,sub;
  if(S.mode==="rent"){var rs=DM.rentStats(entry);price=rs.enough?'AED '+fmt(S.unit==="sqft"?rs.rpsf:rs.rpsm)+'<small>'+pul()+' a year</small>':'<small>not enough contracts</small>';sub=(rs.enough?'typical rent AED '+fmt(rs.rent)+' a year · '+rs.n+' contracts':'under 3 contracts');}
  else{price='AED '+fmt(pu(d.median))+'<small>'+pul()+' · '+other(d.median).replace(/^/,'')+'</small>';sub=d.n+' sales · '+(d.homes?fmt(d.homes)+' homes':'homes not on record')+(d.second?' · also '+d.second.share+'% '+DM.TIER_NAMES[d.second.tier]:'')}
  return '<div class="dv'+(out?' out':'')+'"><button class=star type=button data-k="'+esc(d.k)+'" aria-pressed="'+(S.mine[d.k]?'true':'false')+'" title="my developer">'+(S.mine[d.k]?'★':'☆')+'</button><div><div class=nm>'+esc(d.name)+(out?' <span class=ms>(outside budget)</span>':'')+'</div><div class=ms>'+sub+'</div></div><div class=pr>'+price+'</div></div>'}
function areaHtml(slug){
  var area=IDX.areas[slug],st=stats(slug);if(!st)return '<p class=note>Tap an area on the map.</p>';
  var onlyMine=S.onlyMine==null?(S.screen===2&&mineList().length>0):S.onlyMine;
  var view=onlyMine&&mineList().length?DM.shortlistFilter(st,S.mine,area):st;
  var h='<p class=label>Area</p><h2>'+esc(area.name)+'</h2>';
  if(!st.enough)return h+'<p class=note>Not enough sales: fewer than 3 settled sales with a price and a size in this area on the register.</p>'+src();
  h+='<div class=seg style="margin-top:10px" id=useg><button data-u=sqft>per sq ft</button><button data-u=sqm>per sq m</button></div>';
  h+='<div class=card><div class=big>AED '+fmt(pu(st.median))+' <span style="font-size:13px;color:var(--muted)">'+pul()+' median</span></div><div class=note>'+other(st.median)+' · middle half of sales: AED '+fmt(pu(st.q1))+' to '+fmt(pu(st.q3))+' · '+fmt(st.n)+' settled sales · '+st.devCount+' developer'+(st.devCount===1?'':'s')+(st.unknown?' · '+fmt(st.unknown.n)+' sales with the developer not recorded':'')+'</div></div>';
  h+='<div class=card><p class=label>Tier mix of settled sales</p><p class=note style="margin:0">by number of sales</p>'+bar(st.mixN)+'<p class=note style="margin:6px 0 0">by value</p>'+bar(st.mixValue)+'</div>';
  h+='<div class=box><label style="display:flex;gap:8px;align-items:center;font-size:12.5px"><input type=checkbox id=onlymine style="width:auto"'+(onlyMine?' checked':'')+'> only my developers ('+mineList().length+')</label>'
   +'<label style="display:flex;gap:8px;align-items:center;font-size:12.5px;margin-top:6px"><input type=checkbox id=fbud style="width:auto"'+(S.filterBud?' checked':'')+'> drop developers outside the budget'+(S.bud.max!=null||S.bud.min!=null?'':' (set it on screen 3)')+'</label></div>';
  view.tiers.forEach(function(t){
    h+='<div class=th style="border-left-color:'+TC[t.tier]+'"><b>'+t.name+'</b><span>'+t.nDevs+' developer'+(t.nDevs===1?'':'s')+(t.median?' · median AED '+fmt(pu(t.median))+' '+pul():'')+'</span></div><div class=note style="margin:2px 0 4px">'+esc(t.band)+'</div><div class=note style="margin:0 0 4px">'+esc(t.prices||'')+(t.share?' · '+esc(t.share):'')+'</div>';
    var rows=t.devs.map(function(d){return devRow(d,area,st)}).join("");
    h+=rows||'<p class=note>No developer with 3+ sales sits in this tier here.</p>'});
  if(view.notEnough.length)h+='<p class=label style="margin-top:14px">Not enough sales (under 3)</p>'+view.notEnough.map(function(d){return '<div class=dv><button class=star type=button data-k="'+esc(d.k)+'" aria-pressed="'+(S.mine[d.k]?'true':'false')+'">'+(S.mine[d.k]?'★':'☆')+'</button><div class=nm>'+esc(d.name)+'</div><div class=ms>'+d.n+' sale'+(d.n===1?'':'s')+'</div></div>'}).join("");
  h+='<p class=note style="margin-top:10px">A developer sits in the tier where most of its sales in this area fall; when a second tier holds 20% or more, it is shown beside it. Medians weigh each building’s median price per sq m by the sales behind it. Tiers are price bands from all Dubai settled sales, not a view of any developer.</p>';
  h+='<div class=box><p class=label>Developer view: where would a price land here?</p><div class=two><input id=dvp inputmode=numeric placeholder="AED '+pul()+'" value="'+(S.dv.ppsm==null?'':pu(S.dv.ppsm))+'"><select id=dvt><option value="">or pick a tier</option>'+DM.TIER_NAMES.map(function(n,i){return '<option value='+i+(S.dv.tier===i?' selected':'')+'>'+n+'</option>'}).join("")+'</select></div><div id=dvout></div>'
   +'<p class=label style="margin-top:12px">Compare with another area</p><select id=cmps><option value="">choose an area</option>'+Object.keys(IDX.areas).filter(function(s){return s!==slug}).sort(function(a,b){return IDX.areas[a].name.localeCompare(IDX.areas[b].name)}).map(function(s){return '<option value="'+s+'"'+(S.cmp===s?' selected':'')+'>'+esc(IDX.areas[s].name)+'</option>'}).join("")+'</select><div id=cmpout></div></div>';
  h+=src();return h}
function src(){return '<div class=src>Sources: Dubai Land Department sales register, '+esc(IDX.as_of||"")+(S.mode==="rent"?'; Ejari tenancy contracts (community level, 3+ contracts)':'')+'.<div class=foot>__FOOT__</div></div>'}
function dvHtml(st,name){var tg=S.dv.tier!=null?{tier:S.dv.tier}:(S.dv.ppsm!=null?{ppsm:S.dv.ppsm}:null);if(!tg)return '';var v=DM.developerView(st,tg);if(!v.ok)return '<p class=note>'+esc(v.why)+'</p>';
  return '<p style="margin:8px 0 2px"><b>'+(name?esc(name)+': ':'')+v.tierName+'</b> · '+esc(v.band)+'</p><p class=note style="margin:0">'+esc(v.say)+'</p>'+v.competitors.map(function(d){return '<div class=ms>'+esc(d.name)+' · AED '+fmt(pu(d.median))+' '+pul()+' · '+d.n+' sales'+(d.homes?' · '+fmt(d.homes)+' homes':'')+'</div>'}).join("")}
function wireDetail(el,slug){
  [].forEach.call(el.querySelectorAll(".star"),function(b){b.onclick=function(){toggleMine(b.getAttribute("data-k"))}});
  var u=el.querySelector("#useg");if(u)[].forEach.call(u.querySelectorAll("button"),function(b){b.setAttribute("aria-pressed",b.getAttribute("data-u")===S.unit?"true":"false");b.onclick=function(){S.unit=b.getAttribute("data-u");renderAll()}});
  var om=el.querySelector("#onlymine");if(om)om.onchange=function(){S.onlyMine=om.checked;renderDetail()};
  var fb=el.querySelector("#fbud");if(fb)fb.onchange=function(){S.filterBud=fb.checked;renderDetail()};
  var st=stats(slug);if(!st||!st.enough)return;
  var dvp=el.querySelector("#dvp"),dvt=el.querySelector("#dvt"),dvo=el.querySelector("#dvout"),cs=el.querySelector("#cmps"),co=el.querySelector("#cmpout");
  function upd(){dvo.innerHTML=dvHtml(st,IDX.areas[slug].name);var cmp=S.cmp&&stats(S.cmp);co.innerHTML=cmp&&(S.dv.ppsm!=null||S.dv.tier!=null)?'<div class=cmp><div>'+dvHtml(st,IDX.areas[slug].name)+'</div><div>'+dvHtml(cmp,IDX.areas[S.cmp].name)+'</div></div>':(cmp?'<p class=note>Enter a price or pick a tier to compare.</p>':'')}
  dvp.oninput=function(){var v=dvp.value.replace(/[^0-9.]/g,"");S.dv.ppsm=v===""?null:(S.unit==="sqft"?Number(v)*DM.SQFT:Number(v));if(v!=="")S.dv.tier=null,dvt.value="";upd()};
  dvt.onchange=function(){S.dv.tier=dvt.value===""?null:Number(dvt.value);if(S.dv.tier!=null){S.dv.ppsm=null;dvp.value=""}upd()};
  cs.onchange=function(){S.cmp=cs.value||null;upd()};upd()}
function renderDetail(){var h=S.sel?areaHtml(S.sel):'<p class=note>Tap an area on the map: the developers there, grouped by tier.</p>'+src();
  $("detail").innerHTML=h;$("detail2").innerHTML=S.sel?h:"";$("detail2").style.display=S.sel?"":"none";wireDetail($("detail"),S.sel);wireDetail($("detail2"),S.sel)}
function renderSide(){$("sidebody").innerHTML=sideHtml();wireSide()}
function renderAll(){renderSide();renderDetail();refreshMap()}
function select(slug,fly){S.sel=slug;S.cmp=null;S.onlyMine=null;renderDetail();refreshMap();if(innerWidth<=760)setSheet(false);
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
    map.addLayer({id:"a-fill",type:"fill",source:"areas",paint:{"fill-color":["match",["get","v"],0,"#6f7a78",1,"#2f8a7f",2,"#3987e5",3,"#c98500","#c5a56a"],"fill-opacity":["case",["==",["get","v"],0],0.12,0.55]}},fs);
    map.addLayer({id:"a-line",type:"line",source:"areas",paint:{"line-color":["case",["get","sel"],"#c5a56a","rgba(197,165,106,0.45)"],"line-width":["case",["get","sel"],2.6,0.8]}},fs);
    map.addLayer({id:"a-label",type:"symbol",source:"areas",layout:{"text-field":["get","label"],"text-font":font,"text-size":11.5,"text-max-width":9},paint:{"text-color":"#f5efe2","text-halo-color":"#0b0f0f","text-halo-width":1.4}});
    var pop=new maplibregl.Popup({closeButton:false,closeOnClick:false,offset:12});
    map.on("mousemove","a-fill",function(e){map.getCanvas().style.cursor="pointer";pop.setLngLat(e.lngLat).setHTML("<b>"+esc(e.features[0].properties.label)+"</b>").addTo(map)});
    map.on("mouseleave","a-fill",function(){map.getCanvas().style.cursor="";pop.remove()});
    map.on("click","a-fill",function(e){select(e.features[0].properties.slug,false)})})}
// ---- start ----
Promise.all([api("index"),api("geo"),api("shortlist")]).then(function(r){
  IDX=r[0];GEO=r[1];
  if(!IDX||!IDX.areas){$("sidebody").innerHTML='<p class=note>The developers data is not on file yet.</p>';return}
  var sl=r[2]&&r[2].devs&&r[2].devs.length?r[2].devs:(cacheGet()||[]);sl.forEach(function(k){S.mine[k]=true});
  $("source").textContent="Land Department sales register, "+(IDX.as_of||"")+". Tier bands: "+IDX.cuts.rule;
  if(DM.TIER_CFG.bounds)$("source").textContent="Land Department sales register, "+(IDX.as_of||"")+". Tier bands (value-weighted: each tier holds about a quarter of the money spent): "+DM.TIER_CFG.bounds.join(" / ")+" AED per sq m.";
  if(mineList().length)S.screen=2;
  renderAll();
  if(window.maplibregl)startMap();else $("map").innerHTML='<p class=note style="padding:16px">The map could not load. The lists still work.</p>';
}).catch(function(){$("sidebody").innerHTML='<p class=note>The developers data did not load.</p>'});
})();
`;

export function devmapHtml(key, deps) {
  const nav = deps && deps.NAJ_FONTS ? deps.NAJ_FONTS : "";
  const js = DEVMAP_CORE_JS + PAGE_JS.replace(/__FOOT__/g, esc(DEVMAP_FOOTER));
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
    + '<div class="ejc suc"><div class=ejh><div class="ic suic">&#128205;</div><div><b>Developers by area</b><span>Tap an area: its developers by tier, and the price per sq ft</span></div></div></div></a>';
}
