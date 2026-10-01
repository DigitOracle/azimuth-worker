// BLOCKS - the middle layer between the map (buildings are dots) and the twin (full detail). Kendall approved it on 30 Sep 2026.
//
// LOD 100: every footprint raised to its real height with a flat roof. Other buildings are pale grey; the chosen ones are
// gold with teal numbered badges, in the order the link gives them. The look is the static JVC one-bedroom map Kendall liked
// (JVC_1BR_65K_sheets/map/make_map.py): teal #0A4F4A, gold #C5A56A, background #F6F4EE, white streets. It is LIVE: MapLibre
// (the library /map already loads) with fill-extrusion, opening oblique from the south, and the user can turn and zoom it.
//
//   /blocks?district=jumeirahvillagecircle&gold=1503,892,...&key=<app key>
//
// gold is a comma list, numbered in the order given:
//   1503                         a footprint index (the id the twin, the anchors, the unit-mix register and /building/ all use)
//   approx=55.1969305,25.0556349 a building with no footprint yet: an indicative block at that lon,lat, drawn lighter and dashed.
//                                May be followed by h=<metres>, s=<side in metres>, n=<name>.
// No gold parameter: the district's default set (JVC: the ten from make_map.py). gold= (empty): nothing gold.
//
// Data: /img/blocks_<slug>, one compact GeoJSON per district (footprints with heights and names, plus streets), built and
// published by naj-market-pulse scripts/build_blocks.py. The route checks it is on file; the page fetches it.
//
// The page script is a plain string (no template holes) so it can be `node --check`ed on its own - test/test_blocks_page.mjs.

export const BLOCKS_DEFAULT_DISTRICT = "jumeirahvillagecircle";

// The ten from make_map.py, numbers matching the one-sheet cards. 7 and 8 have no footprint: their positions come from a public
// map listing (see that README), so they draw as indicative blocks. Heights for 7 and 8 are floors x 3.4 m, as the static map.
export const BLOCKS_DEFAULT_GOLD = {
  jumeirahvillagecircle: "1503,892,893,1490,1502,1499," +
    "approx=55.1969305,25.0556349,h=23.8,s=55,n=Elysee III by Pantheon," +
    "approx=55.2129071,25.0588611,h=132.6,s=34,n=Binghatti Gardenia," +
    "1489,1137",
};

import { TAPCARD_JS, TAPCARD_CSS_LIGHT } from "./tapcards.js";   // v280 - tap any building, get its card

const DISTRICT_NAMES = { jumeirahvillagecircle: "Jumeirah Village Circle" };
const DISTRICT_SHORT = { jumeirahvillagecircle: "JVC" };
// a few named main streets, labelled on the view (the static map labels the same four)
const STREET_LABELS = {
  jumeirahvillagecircle: ["Sheikh Mohammed Bin Zayed Road", "Al Khail Road", "Hessa Street", "Al Khamila Street"],
};
const MAX_GOLD = 30;

const num = (s) => /^-?\d+(?:\.\d+)?$/.test(s);

// the gold list -> [{num, i}] or [{num, approx:[lon,lat], h, s, name}]. Anything it cannot read is skipped, never guessed.
export function parseGold(raw) {
  const t = String(raw == null ? "" : raw).split(",").map((x) => x.trim()).filter(Boolean);
  const out = [];
  for (let k = 0; k < t.length && out.length < MAX_GOLD; k++) {
    const tok = t[k];
    if (/^\d{1,6}$/.test(tok)) {
      const i = parseInt(tok, 10);
      if (!out.some((o) => o.i === i)) out.push({ i });
      continue;
    }
    const m = /^approx=(-?\d+(?:\.\d+)?)$/i.exec(tok);
    if (m && k + 1 < t.length && num(t[k + 1])) {
      const lon = parseFloat(m[1]), lat = parseFloat(t[++k]);
      const it = { approx: [lon, lat], h: 20, s: 30, name: "" };
      while (k + 1 < t.length && /^[hsn]=/i.test(t[k + 1])) {
        const kv = t[++k], key = kv[0].toLowerCase(), val = kv.slice(2).trim();
        if (key === "h" && num(val)) it.h = Math.min(900, Math.max(1, parseFloat(val)));
        else if (key === "s" && num(val)) it.s = Math.min(300, Math.max(5, parseFloat(val)));
        else if (key === "n") it.name = val.replace(/[<>"'`\\]/g, "").slice(0, 80);
      }
      if (lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90) out.push(it);
    }
  }
  return out.map((o, ix) => Object.assign({ num: ix + 1 }, o));
}

export const blocksSlug = (s) => String(s || "").replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 40);

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// JSON safe inside a <script>: no "</script" and no "<!--" (U+2028/2029 are legal in script strings since ES2019)
const jsonInScript = (o) => JSON.stringify(o).replace(/</g, "\\u003c");

// ---- the route --------------------------------------------------------------------------------------------------------------
// Returns a Response for /blocks, or null for any other path so the worker carries on. h = { clientOk, clientResp } from index.js.
export async function blocksRoute(request, env, url, h) {
  if (url.pathname !== "/blocks") return null;
  if (!h.clientOk(env, url)) return new Response("unauthorized", { status: 401 });
  const slug = blocksSlug(url.searchParams.get("district")) || BLOCKS_DEFAULT_DISTRICT;
  const key = url.searchParams.get("key") || "";
  const gold = parseGold(url.searchParams.has("gold") ? url.searchParams.get("gold") : (BLOCKS_DEFAULT_GOLD[slug] || ""));
  let have = false;
  try { have = !!(await env.MEETINGS.get("img_ct_blocks_" + slug)) || !!(await env.MEETINGS.get("img_blocks_" + slug, "arrayBuffer")); } catch (e) {}
  // which of the gold buildings have a building page: the page needs the district's stack and a unit-mix record for the id
  // (buildingData in building_page.js returns null without one, and /building/ answers 404)
  const pages = [];
  const ids = gold.filter((g) => g.i != null).map((g) => g.i);
  if (have && ids.length) {
    try {
      const st = await env.MEETINGS.list({ prefix: "img_stack_" + slug });
      if ((st.keys || []).some((k) => k.name === "img_stack_" + slug)) {
        const um = JSON.parse((await env.MEETINGS.get("img_unitmix_" + slug)) || "null");
        const by = (um && um.buildings_by_id) || {};
        for (const i of ids) if (by[String(i)]) pages.push(i);
      }
    } catch (e) {}
  }
  let name = DISTRICT_NAMES[slug] || "";
  if (!name) {
    try { const d = JSON.parse((await env.MEETINGS.get("mkt_latest")) || "null");
      for (const x of ((d && d.areaIntel && d.areaIntel.areas) || [])) if (String(x.area || "").toLowerCase().replace(/[^a-z0-9]/g, "") === slug) { name = x.area; break; } } catch (e) {}
  }
  const html = blocksPageHtml({ slug, name: name || slug, short: DISTRICT_SHORT[slug] || name || slug, key, gold, pages, have });
  return h.clientResp(env, url, html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}

// ---- the page ---------------------------------------------------------------------------------------------------------------
// o: { slug, name, short, key, gold, pages, have, data?, preview? }. data = the blocks GeoJSON inlined (the standalone preview);
// without it the page fetches /img/blocks_<slug>.
export function blocksPageHtml(o) {
  const slug = blocksSlug(o.slug) || BLOCKS_DEFAULT_DISTRICT;
  const cfg = {
    slug, name: o.name || slug, short: o.short || o.name || slug, key: o.key || "",
    gold: o.gold || [], pages: o.pages || [], have: !!(o.have || o.data), preview: !!o.preview,
    dataUrl: "/img/blocks_" + slug, labels: STREET_LABELS[slug] || [],
  };
  const title = cfg.short + " in blocks";
  return '<!doctype html><html lang=en><head><meta charset=utf-8>'
    + '<meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">'
    + '<meta name=robots content="noindex,nofollow"><meta name=theme-color content="#F6F4EE">'
    + '<title>' + esc(title) + ' · Najma</title>'
    + '<link rel=preconnect href="https://fonts.googleapis.com"><link rel=stylesheet href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap">'
    + '<link rel=stylesheet href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css">'
    + '<style>' + BLOCKS_CSS + TAPCARD_CSS_LIGHT + '</style></head><body>'
    + '<div id=m aria-label="3D blocks view of ' + esc(cfg.name) + '"></div>'
    + '<svg id=lead aria-hidden=true></svg><div id=badges></div><div id=slabels aria-hidden=true></div>'
    + '<header id=top><div class=tt><h1>' + esc(title) + '</h1><p>' + esc(cfg.name) + ' · tap any block for its card</p></div>'
    + '<a id=back class=pill href="/map' + (cfg.key ? '?key=' + encodeURIComponent(cfg.key) : '') + '">Map</a></header>'
    + '<div id=tools><button id=north type=button aria-label="Point north"><svg viewBox="0 0 40 40"><g id=narrow><path d="M20 5 L27 22 L20 18 L13 22 Z" fill="#0A4F4A"/><path d="M20 35 L27 22 L20 26 L13 22 Z" fill="#C9C6BB"/></g><text x=20 y=13.2 text-anchor=middle font-size=7.5 font-weight=700 fill="#fff" font-family="IBM Plex Sans,Arial">N</text></svg></button>'
    + '<button id=reset type=button class=pill>Reset view</button>'
    + (cfg.gold.length ? '<button id=listb type=button class=pill>The ' + cfg.gold.length + '</button>' : '') + '</div>'
    + '<div id=key><span><i class=kg></i>Chosen</span>' + (cfg.gold.some((g) => g.approx) ? '<span><i class=ka></i>Approximate position</span>' : '') + '<span><i class=kc></i>Other buildings</span><span><i class=ku></i>Height not yet known</span></div>'
    + '<div id=attr>Footprints and streets © OpenStreetMap contributors · heights: district model</div>'
    + '<section id=card hidden><button id=cx type=button aria-label=Close>×</button><div id=cb></div></section>'
    + '<section id=list hidden><div class=lh><b>The chosen buildings</b><button id=lx type=button aria-label=Close>×</button></div><ol id=lo></ol></section>'
    + '<div id=msg hidden></div>'
    + '<script>window.__BLOCKS_CFG__=' + jsonInScript(cfg) + ';</script>'
    + (o.data ? '<script>window.__BLOCKS_DATA__=' + jsonInScript(o.data) + ';</script>' : '')
    + '<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>'
    + '<script>' + TAPCARD_JS + '</script>'   // v280 - the tap-card client (src/tapcards.js), before the page script
    + '<script>' + BLOCKS_JS + '</script>'
    + '</body></html>';
}

export const BLOCKS_CSS = `
:root{--teal:#0A4F4A;--gold:#C5A56A;--bg:#F6F4EE;--ink:#2B2A26;--mute:#6E6A5F;--line:#E2DED3}
*{box-sizing:border-box}html,body{margin:0;height:100%;background:var(--bg);color:var(--ink);font-family:"IBM Plex Sans",system-ui,-apple-system,"Segoe UI",Arial,sans-serif;-webkit-text-size-adjust:100%}
#m{position:fixed;inset:0;background:var(--bg)}
#lead{position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2}
#badges,#slabels{position:fixed;inset:0;pointer-events:none;z-index:3;overflow:hidden}
.bdg{position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;background:var(--teal);border:2px solid var(--gold);color:#fff;font:700 13px/26px "IBM Plex Sans",Arial,sans-serif;text-align:center;pointer-events:auto;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.25);-webkit-tap-highlight-color:transparent;padding:0}
.bdg.ap{background:#fff;color:var(--teal);border:2px dashed var(--teal)}
.bdg.on{transform:scale(1.18);box-shadow:0 0 0 3px rgba(197,165,106,.55),0 1px 4px rgba(0,0,0,.3)}
.sl{position:absolute;white-space:nowrap;font:italic 500 11px/1 "IBM Plex Sans",Arial,sans-serif;color:#8C887C;background:rgba(246,244,238,.85);padding:2px 5px;border-radius:3px;transform-origin:center}
#top{position:fixed;left:0;right:0;top:0;z-index:5;display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:calc(10px + env(safe-area-inset-top)) 16px 18px;background:linear-gradient(var(--bg) 62%,rgba(246,244,238,0));pointer-events:none}
#top .tt{min-width:0}
#top h1{margin:0;font-size:1.28rem;line-height:1.2;color:var(--teal);font-weight:700}
#top p{margin:3px 0 0;font-size:.84rem;color:var(--mute)}
.pill{pointer-events:auto;display:inline-block;border:1px solid var(--line);background:#fff;color:var(--teal);font:600 .8rem/1 "IBM Plex Sans",Arial,sans-serif;padding:9px 13px;border-radius:999px;text-decoration:none;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.06);-webkit-tap-highlight-color:transparent;white-space:nowrap}
#tools{position:fixed;right:12px;top:calc(76px + env(safe-area-inset-top));z-index:5;display:flex;flex-direction:column;align-items:flex-end;gap:8px}
#north{width:46px;height:46px;border-radius:50%;border:1px solid var(--line);background:#fff;padding:3px;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.1)}
#north svg{width:100%;height:100%;display:block}
#key{position:fixed;left:12px;bottom:calc(24px + env(safe-area-inset-bottom));z-index:4;display:flex;flex-wrap:wrap;gap:6px 12px;max-width:calc(100% - 24px);background:rgba(255,255,255,.92);border:1px solid var(--line);border-radius:10px;padding:7px 10px;font-size:.74rem;color:var(--ink)}
#key span{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
#key i{display:inline-block;width:16px;height:11px;border-radius:2px}
.kg{background:var(--gold);border:1px solid #7A6230}.ka{background:#E6D6B2;border:1px dashed #7A6230}.kc{background:#E4E4DE;border:1px solid #BFC1BA}.ku{background:#EFEEE8;border:1px solid #DAD8D0}
#card,#list{position:fixed;left:12px;right:12px;bottom:calc(22px + env(safe-area-inset-bottom));z-index:6;background:#fff;border:1px solid var(--line);border-radius:14px;box-shadow:0 6px 24px rgba(0,0,0,.14);padding:14px 16px 16px;max-width:460px}
#card[hidden],#list[hidden],#msg[hidden],#key[hidden]{display:none}
#cx,#lx{position:absolute;right:8px;top:6px;border:0;background:none;font-size:1.5rem;line-height:1;color:var(--mute);cursor:pointer;padding:6px 10px}
#cb .nm{display:flex;align-items:center;gap:10px;padding-right:30px}
#cb .nm b{font-size:1.06rem;color:var(--teal);line-height:1.25}
#cb .n{flex:0 0 auto;width:30px;height:30px;border-radius:50%;background:var(--teal);border:2px solid var(--gold);color:#fff;font:700 13px/26px "IBM Plex Sans",Arial,sans-serif;text-align:center}
#cb .n.ap{background:#fff;color:var(--teal);border:2px dashed var(--teal)}
#cb .ht{margin:8px 0 0;font-size:.95rem}
#cb .nt{margin:6px 0 0;font-size:.8rem;color:var(--mute);line-height:1.4}
#cb .go{margin-top:12px;display:inline-block;background:var(--teal);color:#fff;border-color:var(--teal)}
#list{max-height:62vh;overflow:auto;padding-bottom:10px}
#list .lh{padding-right:30px;color:var(--teal);font-size:1rem;margin-bottom:6px}
#lo{list-style:none;margin:0;padding:0}
#lo li{display:flex;align-items:center;gap:10px;padding:8px 2px;border-top:1px solid #F0EDE5;cursor:pointer;font-size:.92rem}
#lo li .n{flex:0 0 auto;width:26px;height:26px;border-radius:50%;background:var(--teal);border:2px solid var(--gold);color:#fff;font:700 12px/22px "IBM Plex Sans",Arial,sans-serif;text-align:center}
#lo li .n.ap{background:#fff;color:var(--teal);border:2px dashed var(--teal)}
#lo li small{color:var(--mute)}
#msg{position:fixed;left:16px;right:16px;top:40%;z-index:7;text-align:center;color:var(--teal);font-size:1rem}
#attr{position:fixed;right:8px;bottom:calc(4px + env(safe-area-inset-bottom));z-index:4;font-size:10px;color:#8C887C;background:rgba(246,244,238,.85);padding:1px 5px;border-radius:3px;max-width:calc(100% - 16px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media (max-width:559px){#tools{flex-direction:row;align-items:center;right:12px;left:12px;justify-content:flex-end;top:calc(70px + env(safe-area-inset-top))}#north{width:40px;height:40px}#top p{font-size:.8rem}#key{bottom:calc(22px + env(safe-area-inset-bottom))}}
@media (min-width:760px){#card,#list{left:auto;right:16px;bottom:26px;width:380px}#top h1{font-size:1.5rem}#key{font-size:.8rem}}
`;

// The page script. A plain string with no template holes: test/test_blocks_page.mjs runs node --check on it as served.
export const BLOCKS_JS = String.raw`(function(){
"use strict";
var CFG=window.__BLOCKS_CFG__||{};
var TEAL="#0A4F4A",GOLD="#C5A56A",GOLD_SEL="#E2BE72",APPROX="#E6D6B2",GOLD_EDGE="#7A6230";
var CTX="#E4E4DE",CTX_UNK="#EFEEE8",CTX_SEL="#A9C4BF",BG="#F6F4EE",STREET="#FFFFFF",STREET_CASE="#D9D5CA";
var PITCH=(window.innerWidth<560&&window.innerHeight>window.innerWidth)?50:55,M_LAT=110540;   // a portrait phone opens at 50 (a little more from above) so the district fills more of the tall screen
var $=function(id){return document.getElementById(id)};
function msg(t){var e=$("msg");e.textContent=t;e.hidden=!t}
function mLon(lat){return 111320*Math.cos(lat*Math.PI/180)}
function fmtH(h){return Math.round(h)+" m tall"}
function unknownH(hs){return hs==="unknown"||hs==="default12"}
function estH(hs){hs=String(hs||"");return hs==="community_median"||hs.indexOf("typical_")===0}
function htLine(h,hs){return unknownH(hs)?"Height not yet known (drawn at "+Math.round(h)+" m)":estH(hs)?"About "+Math.round(h)+" m - an estimate ("+(hs==="community_median"?"typical for this area":"typical for this kind of building")+"), not measured":fmtH(h)}
function keyQ(){return CFG.key?"?key="+encodeURIComponent(CFG.key):""}
function tidy(n){n=String(n||"");return n===n.toUpperCase()&&/[A-Z]{3}/.test(n)?n.toLowerCase().replace(/(^|[\s\-(\/])([a-z])/g,function(a,b,c){return b+c.toUpperCase()}):n}

// ---- geometry helpers ----
function outer(g){return g.type==="Polygon"?[g.coordinates[0]]:g.type==="MultiPolygon"?g.coordinates.map(function(p){return p[0]}):[]}
function centroid(g){var r=outer(g),best=null,ba=-1;r.forEach(function(ring){var a=Math.abs(area(ring));if(a>ba){ba=a;best=ring}});
  if(!best)return null;var n=best.length-1,x=0,y=0;for(var k=0;k<n;k++){x+=best[k][0];y+=best[k][1]}return [x/n,y/n]}
function area(r){var s=0;for(var k=0;k<r.length-1;k++)s+=r[k][0]*r[k+1][1]-r[k+1][0]*r[k][1];return s/2}
function square(ll,side){var dx=side/2/mLon(ll[1]),dy=side/2/M_LAT;
  return {type:"Polygon",coordinates:[[[ll[0]-dx,ll[1]-dy],[ll[0]+dx,ll[1]-dy],[ll[0]+dx,ll[1]+dy],[ll[0]-dx,ll[1]+dy],[ll[0]-dx,ll[1]-dy]]]}}
function extend(b,g){outer(g).forEach(function(r){r.forEach(function(c){if(c[0]<b[0])b[0]=c[0];if(c[1]<b[1])b[1]=c[1];if(c[0]>b[2])b[2]=c[0];if(c[1]>b[3])b[3]=c[1]})})}

// ---- data -> the layers' sources ----
var BLD={},GOLDS=[],SEL=null,map=null,LBL={};
function prepare(fc){
  var ctx=[],gold=[],approx=[],streets=[],pageSet={};
  (CFG.pages||[]).forEach(function(i){pageSet[i]=1});
  var gi={};(CFG.gold||[]).forEach(function(g){if(g.i!=null)gi[g.i]=g});
  (fc.features||[]).forEach(function(f){var p=f.properties||{};
    if(p.k==="s"){streets.push(f);if(p.nm&&CFG.labels.indexOf(p.nm)>=0)(LBL[p.nm]=LBL[p.nm]||[]).push(f.geometry.coordinates);return}
    if(p.k!=="b")return;
    BLD[p.i]={i:p.i,h:p.h,hs:p.hs||"",n:p.n||"",a:p.a||"",geom:f.geometry};
    var g=gi[p.i];
    if(g){gold.push({type:"Feature",id:p.i,properties:{i:p.i,h:p.h,num:g.num},geometry:f.geometry})}
    else ctx.push({type:"Feature",id:p.i,properties:{i:p.i,h:p.h,u:unknownH(p.hs)?1:0},geometry:f.geometry});
  });
  (CFG.gold||[]).forEach(function(g){
    if(g.approx){var geom=square(g.approx,g.s);
      approx.push({type:"Feature",id:100000+g.num,properties:{num:g.num,h:g.h},geometry:geom});
      GOLDS.push({num:g.num,ap:true,name:g.name||"",h:g.h,s:g.s,c:g.approx,geom:geom});}
    else if(BLD[g.i]){var b=BLD[g.i];GOLDS.push({num:g.num,i:g.i,name:tidy(b.n),addr:b.a,h:b.h,hs:b.hs,c:centroid(b.geom),geom:b.geom,page:!!pageSet[g.i]})}
    else GOLDS.push({num:g.num,i:g.i,missing:true});
  });
  return {ctx:ctx,gold:gold,approx:approx,streets:streets};
}

function fc(a){return {type:"FeatureCollection",features:a}}
var W=["interpolate",["exponential",1.6],["zoom"],12,0.4,15,1,17,3.5,19,11];
// "zoom" must be the top-level interpolate's input, so the class width goes inside each stop
function streetW(add){var cls=["match",["get","hw"],"motorway",5,"trunk",4.4,"primary",4,"secondary",3.2,"tertiary",2.2,"motorway_link",1.8,"primary_link",1.8,"secondary_link",1.8,"trunk_link",1.8,"tertiary_link",1.4,1];
  var e=["interpolate",["exponential",1.6],["zoom"]];[[12,0.35],[15,1],[17,3],[19,9]].forEach(function(s){e.push(s[0],["+",["*",cls,s[1]],add])});return e}

function build(data){
  var S=prepare(data);
  if(!window.maplibregl){msg("The map library did not load. Check the connection and reload.");return}
  var style={version:8,sources:{
      st:{type:"geojson",data:fc(S.streets)},
      ctx:{type:"geojson",data:fc(S.ctx)},
      gold:{type:"geojson",data:fc(S.gold)},
      approx:{type:"geojson",data:fc(S.approx)}},
    light:{anchor:"map",color:"#ffffff",intensity:0.45,position:[1.3,200,38]},
    layers:[
      {id:"bg",type:"background",paint:{"background-color":BG}},
      {id:"st-case",type:"line",source:"st",layout:{"line-cap":"round","line-join":"round"},paint:{"line-color":STREET_CASE,"line-width":streetW(1.2)}},
      {id:"st",type:"line",source:"st",layout:{"line-cap":"round","line-join":"round"},paint:{"line-color":STREET,"line-width":streetW(0)}},
      {id:"approx-ground",type:"line",source:"approx",paint:{"line-color":GOLD_EDGE,"line-width":1.6,"line-dasharray":[2,1.5]}},
      {id:"ctx",type:"fill-extrusion",source:"ctx",paint:{"fill-extrusion-color":["case",["boolean",["feature-state","sel"],false],CTX_SEL,["==",["get","u"],1],CTX_UNK,CTX],"fill-extrusion-height":["get","h"],"fill-extrusion-base":0,"fill-extrusion-opacity":1,"fill-extrusion-vertical-gradient":false}},
      {id:"gold",type:"fill-extrusion",source:"gold",paint:{"fill-extrusion-color":["case",["boolean",["feature-state","sel"],false],GOLD_SEL,GOLD],"fill-extrusion-height":["get","h"],"fill-extrusion-base":0,"fill-extrusion-opacity":1,"fill-extrusion-vertical-gradient":false}},
      {id:"approx",type:"fill-extrusion",source:"approx",paint:{"fill-extrusion-color":["case",["boolean",["feature-state","sel"],false],GOLD_SEL,APPROX],"fill-extrusion-height":["get","h"],"fill-extrusion-base":0,"fill-extrusion-opacity":0.88,"fill-extrusion-vertical-gradient":false}}
    ]};
  map=new maplibregl.Map({container:"m",style:style,center:start().center,zoom:start().zoom,pitch:PITCH,bearing:0,maxPitch:70,minZoom:11,maxZoom:19.5,
    attributionControl:false,dragRotate:true,touchPitch:true,pitchWithRotate:true,fadeDuration:0,preserveDrawingBuffer:true});
  window.__blocksMap=map;
  map.on("load",function(){home(false);overlay();window.__blocksReady=true;
    var hn=/[#&]n=(\d+)/.exec(location.hash);if(hn&&goldBy(+hn[1]))select({kind:"gold",num:+hn[1]},true)});   // #n=4 opens with building 4 chosen
  map.on("render",overlay);
  map.on("rotate",northArrow);
  map.on("click",function(e){
    var pad=8,box=[[e.point.x-pad,e.point.y-pad],[e.point.x+pad,e.point.y+pad]];
    var fs=map.queryRenderedFeatures(box,{layers:["gold","approx","ctx"]});
    if(!fs.length){select(null);return}
    var f=fs[0],p=f.properties||{};
    if(f.layer.id==="ctx")select({kind:"ctx",i:p.i});
    else select({kind:"gold",num:p.num});
  });
  var cur=function(on){map.getCanvas().style.cursor=on?"pointer":""};
  ["gold","approx","ctx"].forEach(function(l){map.on("mouseenter",l,function(){cur(1)});map.on("mouseleave",l,function(){cur(0)})});
  badges();list();
}

// the opening camera: every gold block in view, from the south, 55 degrees down
function goldBounds(){var b=[999,999,-999,-999],n=0;GOLDS.forEach(function(g){if(g.geom){extend(b,g.geom);n++}});return n?b:null}
function start(){var b=goldBounds()||(window.__BLOCKS_BBOX__)||[55.19,25.045,55.225,25.075];
  return {center:[(b[0]+b[2])/2,(b[1]+b[3])/2],zoom:14.6}}
// The frame is fitted on SCREEN, not on the ground: pitched, the near (south) side draws wider than the far side, and the badges
// stand above the roofs, so a ground-bounds fit leaves the edge badges cut off on a phone and half the screen empty. Start
// from the ground fit, then measure where the footprints and badges actually land and correct zoom and centre a few times.
function frameRect(){var W=window.innerWidth,H=window.innerHeight,t=$("top").getBoundingClientRect().bottom,tl=$("tools").getBoundingClientRect();
  var narrow=W<560;return {l:14,r:W-(narrow?14:tl.width+24),t:Math.max(t,narrow?tl.bottom:0)+4,b:H-(narrow?64:56)}}
function framePts(){var pts=[];GOLDS.forEach(function(g){if(!g.geom)return;
    outer(g.geom).forEach(function(r){r.forEach(function(c){pts.push(map.project(c))})});
    if(g.c){var r=roofPt(g.c,g.h);pts.push({x:r.x,y:r.y-50},{x:r.x-16,y:r.y-34},{x:r.x+16,y:r.y-34})}});return pts}
function home(anim){
  var b=goldBounds()||DATA_BBOX;if(!b)return;
  var single=GOLDS.filter(function(g){return g.geom}).length===1;
  var before={center:map.getCenter(),zoom:map.getZoom(),pitch:map.getPitch(),bearing:map.getBearing()};
  var cam=map.cameraForBounds([[b[0],b[1]],[b[2],b[3]]],{padding:40,bearing:0});
  if(!cam)return;
  map.jumpTo({center:cam.center,zoom:single?Math.min(16,cam.zoom):cam.zoom,pitch:PITCH,bearing:0});
  var R=frameRect(),W=window.innerWidth,H=window.innerHeight;
  for(var it=0;it<5;it++){var P=framePts();if(!P.length)break;
    var x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;P.forEach(function(p){x0=Math.min(x0,p.x);y0=Math.min(y0,p.y);x1=Math.max(x1,p.x);y1=Math.max(y1,p.y)});
    var f=Math.min((R.r-R.l)/Math.max(1,x1-x0),(R.b-R.t)/Math.max(1,y1-y0));
    var z=map.getZoom()+Math.max(-2,Math.min(2,Math.log(f)/Math.LN2*0.9));if(single)z=Math.min(z,16.8);
    var c=map.unproject([W/2+((x0+x1)/2-(R.l+R.r)/2),H/2+((y0+y1)/2-(R.t+R.b)/2)]);
    map.jumpTo({center:c,zoom:z})}
  var fin={center:map.getCenter(),zoom:map.getZoom(),pitch:PITCH,bearing:0};
  if(anim){map.jumpTo(before);map.easeTo(Object.assign({duration:900},fin))}
}
var DATA_BBOX=null;

// ---- overlay: numbered badges on the roofs, and the street names ----
// A roof's screen point: the ground point, lifted by the building's height at the local scale. The local scale is what one
// metre across the screen measures at that spot; a vertical metre shows as that times sin(pitch).
function roofPt(ll,h){
  var p=map.project(ll),b=map.getBearing()*Math.PI/180,step=20;
  var dE=Math.cos(b)*step,dN=-Math.sin(b)*step;
  var q=map.project([ll[0]+dE/mLon(ll[1]),ll[1]+dN/M_LAT]);
  var s=Math.sqrt((q.x-p.x)*(q.x-p.x)+(q.y-p.y)*(q.y-p.y))/step;
  return {x:p.x,y:p.y-h*s*Math.sin(map.getPitch()*Math.PI/180),s:s};
}
var BEL={},BPOS=[];
function badges(){
  var host=$("badges");host.innerHTML="";
  GOLDS.forEach(function(g){if(!g.c)return;
    var d=document.createElement("button");d.type="button";d.className="bdg"+(g.ap?" ap":"");d.textContent=g.num;
    d.setAttribute("aria-label",(g.name||("Building "+g.num))+(g.ap?" (approximate position)":""));
    d.onclick=function(ev){ev.stopPropagation();select({kind:"gold",num:g.num},true)};
    host.appendChild(d);BEL[g.num]=d});
}
var raf=0;
function overlay(){if(raf)return;raf=requestAnimationFrame(function(){raf=0;drawBadges();drawLabels()})}
function drawBadges(){
  if(!map)return;
  var W=window.innerWidth,H=window.innerHeight,R=15,pts=[];
  GOLDS.forEach(function(g){if(!g.c||!BEL[g.num])return;var r=roofPt(g.c,g.h);
    var vis=r.x>-40&&r.x<W+40&&r.y>-40&&r.y<H+40;
    pts.push({g:g,rx:r.x,ry:r.y,x:r.x,y:r.y-34,vis:vis})});
  var live=pts.filter(function(p){return p.vis});
  for(var it=0;it<60;it++){var moved=false;
    for(var a=0;a<live.length;a++)for(var b=a+1;b<live.length;b++){var A=live[a],B=live[b];
      var dx=B.x-A.x,dy=B.y-A.y,d=Math.sqrt(dx*dx+dy*dy)||0.01,min=2*R+6;
      if(d<min){var push=(min-d)/2+0.5,ux=dx/d,uy=dy/d;if(d<0.02){ux=1;uy=0}A.x-=ux*push;A.y-=uy*push;B.x+=ux*push;B.y+=uy*push;moved=true}}
    if(!moved)break}
  var svg="";BPOS=[];
  pts.forEach(function(p){var el=BEL[p.g.num];
    if(!p.vis){el.style.display="none";return}
    BPOS.push([p.x,p.y],[p.rx,p.ry]);el.style.display="";el.style.left=p.x+"px";el.style.top=p.y+"px";el.classList.toggle("on",SEL&&SEL.kind==="gold"&&SEL.num===p.g.num);
    svg+='<line x1="'+p.rx.toFixed(1)+'" y1="'+p.ry.toFixed(1)+'" x2="'+p.x.toFixed(1)+'" y2="'+(p.y+R-1).toFixed(1)+'" stroke="'+TEAL+'" stroke-width="1.4"'+(p.g.ap?' stroke-dasharray="3 2"':'')+'/>'
      +'<circle cx="'+p.rx.toFixed(1)+'" cy="'+p.ry.toFixed(1)+'" r="3" fill="'+TEAL+'"/>'});
  $("lead").innerHTML=svg;
}
function drawLabels(){
  var host=$("slabels");if(!map||!CFG.labels.length){return}
  var W=window.innerWidth,H=window.innerHeight,out=[],used=[];
  CFG.labels.forEach(function(nm){var lines=LBL[nm]||[],best=null;
    lines.forEach(function(cs){var vis=[];cs.forEach(function(c){var p=map.project(c);if(p.x>50&&p.x<W-50&&p.y>110&&p.y<H-70)vis.push(p)});
      if(vis.length<2)return;var a=vis[0],z=vis[vis.length-1],L=Math.sqrt((z.x-a.x)*(z.x-a.x)+(z.y-a.y)*(z.y-a.y));
      if(L>90&&(!best||L>best.L))best={L:L,a:a,z:z,m:vis[Math.floor(vis.length/2)]}});
    if(!best)return;
    var ang=Math.atan2(best.z.y-best.a.y,best.z.x-best.a.x)*180/Math.PI;if(ang>90)ang-=180;if(ang<-90)ang+=180;
    var mx=(best.a.x+best.z.x)/2,my=(best.a.y+best.z.y)/2;
    if(used.some(function(u){return Math.abs(u[0]-mx)<120&&Math.abs(u[1]-my)<24}))return;
    if(BPOS.some(function(b){return Math.abs(b[0]-mx)<70&&Math.abs(b[1]-my)<34}))return;   // never under a badge
    used.push([mx,my]);
    out.push('<div class="sl" style="left:'+mx.toFixed(0)+'px;top:'+my.toFixed(0)+'px;transform:translate(-50%,-50%) rotate('+ang.toFixed(1)+'deg)">'+esc(nm)+'</div>')});
  host.innerHTML=out.join("");
}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function northArrow(){var g=document.getElementById("narrow");if(g)g.setAttribute("transform","rotate("+(-map.getBearing()).toFixed(1)+" 20 20)")}

// ---- selection and the card ----
function setState(kind,id,on){try{map.setFeatureState({source:kind,id:id},{sel:on})}catch(e){}}
function clearSel(){if(!SEL)return;
  if(SEL.kind==="ctx")setState("ctx",SEL.i,false);
  else{var g=goldBy(SEL.num);if(g)setState(g.ap?"approx":"gold",g.ap?100000+g.num:g.i,false)}}
function goldBy(n){for(var k=0;k<GOLDS.length;k++)if(GOLDS[k].num===n)return GOLDS[k];return null}
function select(s,fly){
  clearSel();SEL=s;
  if(!s){$("card").hidden=true;$("key").hidden=false;overlay();return}
  $("list").hidden=true;
  var html="";
  if(s.kind==="ctx"){var b=BLD[s.i];if(!b){SEL=null;return}setState("ctx",s.i,true);
    var nm=tidy(b.n);
    html='<div class=nm><b>'+esc(nm||(b.a?b.a:"A building without a name on our map"))+'</b></div>'
      +'<p class=ht>'+htLine(b.h,b.hs)+'</p>'
      +(nm&&b.a?'<p class=nt>'+esc(b.a)+'</p>':'')
      +'<p class=nt>Grey blocks are the other buildings around the chosen ones.</p>';
  }else{var g=goldBy(s.num);if(!g){SEL=null;return}
    if(g.missing){html='<div class=nm><span class=n>'+g.num+'</span><b>Building '+g.num+'</b></div><p class=nt>This building is not in the district outlines, so it cannot be drawn.</p>'}
    else{setState(g.ap?"approx":"gold",g.ap?100000+g.num:g.i,true);
      html='<div class=nm><span class="n'+(g.ap?' ap':'')+'">'+g.num+'</span><b>'+esc(g.name||(g.addr?g.addr:"Building "+g.num))+'</b></div>'
        +'<p class=ht>'+(g.ap?"About "+fmtH(g.h):htLine(g.h,g.hs))+'</p>'
        +(g.ap?'<p class=nt>Approximate position. This building has no surveyed outline on our map yet, so the block is indicative: about '+Math.round(g.s)+' m across, placed from a public map listing.</p>':'')
        +(g.page?(CFG.preview?'<span class="pill go" title="Opens in the app">Open the building page</span>':'<a class="pill go" href="/building/'+CFG.slug+'/'+g.i+keyQ()+'">Open the building page</a>'):'')
        +(!g.ap&&!g.page?'<p class=nt>No building page for this one yet.</p>':'');
      if(fly&&g.c){var z=Math.max(map.getZoom(),16);map.easeTo({center:g.c,zoom:z,duration:700,offset:[0,-60]})}}
  }
  $("cb").innerHTML=html;$("card").hidden=false;$("key").hidden=true;overlay();
  // v280 - the tap card: today's card shows at once; the register card replaces it when the district's tap cards are in
  if(s.kind==="ctx")tapcard(s.i,"",false);
  else{var gg=goldBy(s.num);if(gg&&!gg.ap&&!gg.missing)tapcard(gg.i,'<span class=n>'+gg.num+'</span>',gg.page)}
}
function tapcard(i,badge,goldPage){var b=BLD[i],my=SEL;if(!b||!window.__tapcards)return;
  window.__tapcards.card(CFG.slug,i,b.geom,{n:b.n,h:b.h,hs:b.hs,a:b.a},CFG.key).then(function(m){window.__lastTapcard=m;
    if(SEL!==my||m.kind==="fallback")return;   // another tap since, or no card for this footprint: today's card stands
    $("cb").innerHTML=window.__tapcards.html(m,{badge:badge,page:(m.page||goldPage)?"/building/"+CFG.slug+"/"+i+keyQ():"",preview:CFG.preview});
  }).catch(function(){})}
function list(){var ol=$("lo");if(!ol)return;ol.innerHTML="";
  GOLDS.forEach(function(g){var li=document.createElement("li");
    li.innerHTML='<span class="n'+(g.ap?' ap':'')+'">'+g.num+'</span><span>'+esc(g.name||(g.missing?"Not in the district outlines":"Building "+g.num))+(g.ap?' <small>(approximate position)</small>':'')+'</span>';
    li.onclick=function(){select({kind:"gold",num:g.num},true)};ol.appendChild(li)})}

// ---- wiring ----
$("north").onclick=function(){if(map)map.easeTo({bearing:0,pitch:PITCH,duration:600})};
$("reset").onclick=function(){select(null);if(map)home(true)};
$("cx").onclick=function(){select(null)};
if($("listb"))$("listb").onclick=function(){select(null);$("list").hidden=!$("list").hidden};
$("lx").onclick=function(){$("list").hidden=true};
window.addEventListener("resize",overlay);
window.__blocksSelect=select;

if(!CFG.have){msg("The blocks for this district are not ready yet.");return}
var got=window.__BLOCKS_DATA__?Promise.resolve(window.__BLOCKS_DATA__):fetch(CFG.dataUrl).then(function(r){if(!r.ok)throw new Error("status "+r.status);return r.json()});
got.then(function(d){DATA_BBOX=(d.meta&&d.meta.bbox)||null;build(d)}).catch(function(){msg("The blocks could not be loaded. Reload to try again.")});
})();`;
