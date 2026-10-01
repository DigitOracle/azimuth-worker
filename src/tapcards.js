// v280 - TAP ANY BUILDING, GET ITS CARD (Kendall's go, 1 Oct 2026).
//
// Every footprint the blocks draw now answers a tap with what the registers know about it. The data is the DDA session's
// interim tap-card table, slimmed by naj-market-pulse scripts/push_tapcards.py into one payload per district:
//
//   /img/tapcard_<slug>   {v, slug, as_of, o:[lon0,lat0], q, tol, c0, communities:{comm_num:{n,pop,mi,bus,par,rb,ru,dmb}}, rows:{i: ...}}
//     a community-tier row is [kx, ky] or [kx, ky, comm_num]; a building / project / plot row is {t:"b"|"p"|"l", k:[kx,ky], ...card}
//     kx, ky = the card's own footprint centroid, in q-ths of a degree from o
//
// Three places tap blocks, and all three use the same client code (TAPCARD_JS, below):
//   (a) /blocks                      src/blocks_page.js - the existing tap card is upgraded in place
//   (b) the /map blocks layer        src/twin_blocks.js MAP_BLOCKS_JS - a tap shows the card; the card carries the hand-over
//   (c) the twin's blocks-first view src/twin_blocks.js TWIN_BLOCKS_JS - a tap on a block (before the tile lands) shows the card
//
// The rules (Kendall's brief):
//   building / project tier  name, developer, floors, height ("estimate" where the height source says so), units, completion,
//                            use, and a "Building page" link where the app has one
//   community tier           the community's name and its facts in one or two plain lines, each labelled as the COMMUNITY's,
//                            and the building's own height. Community facts are never presented as the building's.
//   confidence               in words only, and only where it is low: "likely" under 0.8
//   fallback                 no payload, no row, or a footprint that has moved (the centroid checksum disagrees): today's
//                            name + height card
//
// The card logic is a set of plain functions (tcCentroid ... tcHtml). The page script carries their source verbatim
// (Function.toString), so test/test_v280_tapcards.mjs runs the same code the pages run, against a real slimmed JVC payload.
// Every page script is a plain string with no template holes. Phone-first.

export const TC_LIKELY = 0.8;

// ---- the card logic (shared verbatim with the pages) ---------------------------------------------------------------------------
// the area-weighted centroid of a Polygon / MultiPolygon, holes subtracted - the centroid build_tapcards.py measured (shapely)
export function tcCentroid(g) {
  if (!g || !g.coordinates) return null;
  var polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
  var ox = null, oy = null, A = 0, X = 0, Y = 0;
  polys.forEach(function (p) {
    (p || []).forEach(function (ring, ri) {
      if (!ring || ring.length < 4) return;
      if (ox === null) { ox = ring[0][0]; oy = ring[0][1]; }
      var a = 0, cx = 0, cy = 0;
      for (var k = 0; k < ring.length - 1; k++) {
        var x0 = ring[k][0] - ox, y0 = ring[k][1] - oy, x1 = ring[k + 1][0] - ox, y1 = ring[k + 1][1] - oy, cr = x0 * y1 - x1 * y0;
        a += cr; cx += (x0 + x1) * cr; cy += (y0 + y1) * cr;
      }
      if (!a) return;
      var w = Math.abs(a) / 2 * (ri === 0 ? 1 : -1);
      X += w * cx / (3 * a); Y += w * cy / (3 * a); A += w;
    });
  });
  if (!A) return null;
  return [ox + X / A, oy + Y / A];
}
// the checksum: does the footprint the page drew sit where the card's footprint sat?
export function tcCheck(T, k, geom) {
  if (!T || !T.o || !k || k.length < 2) return false;
  var c = tcCentroid(geom); if (!c) return false;
  var q = T.q || 100000, tol = T.tol == null ? 3 : T.tol;
  return Math.abs((c[0] - T.o[0]) * q - k[0]) <= tol && Math.abs((c[1] - T.o[1]) * q - k[1]) <= tol;
}
export function tcEsc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
// SHOUTED REGISTER NAMES read as names; anything already mixed-case is left alone
export function tcTidy(n) {
  n = String(n == null ? "" : n).replace(/\s+/g, " ").trim();
  if (n === n.toUpperCase() && /[A-Z]{3}/.test(n)) n = n.toLowerCase().replace(/(^|[\s\-(\/&.])([a-z])/g, function (a, b, c) { return b + c.toUpperCase(); }).replace(/\b(L\.?l\.?c|Fze|Fzco|Pjsc|Llc)\b/g, function (x) { return x.toUpperCase(); });
  return n.replace(/\s+-\s*|\s*-\s+/g, " - ").replace(/ - $/, "");
}
export function tcN(v) { var n = +v; return isFinite(n) ? Math.round(n).toLocaleString("en") : String(v); }
export function tcMonth(d) {
  var m = /^(\d{4})-(\d{2})/.exec(String(d || "")); if (!m) return "";
  return ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][(+m[2] - 1) % 12] + " " + m[1];
}
// the height in words: measured, an estimate, or not known (hs is the blocks' height source)
export function tcHeight(h, hs, measured) {
  if (measured != null && +measured > 0) return Math.round(+measured) + " m tall";
  hs = String(hs || "");
  if (!(+h > 0) || hs === "unknown" || hs === "default12") return "Height not yet known";
  if (/^(community_median|typical_|small_footprint_cap|dld_floors|register_dld_floors)/.test(hs) || hs.indexOf("*") >= 0)
    return "About " + Math.round(+h) + " m tall (an estimate, not measured)";
  return Math.round(+h) + " m tall";
}
export function tcDone(cd, st, today) {
  var when = tcMonth(cd); st = String(st || "").toUpperCase();
  var fut = cd && String(cd).slice(0, 10) > String(today || "").slice(0, 10);
  var words = { ACTIVE: "Under construction", NOT_STARTED: "Not started", PENDING: "Pending", CONDITIONAL_ACTIVATING: "Awaiting activation" }[st];
  if (!when) return words || (st === "FINISHED" ? "Completed" : "");
  if (st === "FINISHED" || (!words && !fut)) return "Completed " + when;
  if (fut) return (words ? words + ", due " : "Due ") + when;
  return (words || "Status unclear") + " (completion date on record: " + when + ")";
}
// the card for footprint i. blk = the blocks file's own {n, h, hs, a} for it; geom = the footprint the page drew.
// Returns {kind: "building"|"project"|"plot"|"community", title, likely, lines:[[cls, text]], i} or {kind:"fallback", why}.
export function tcModel(T, i, blk, geom, today) {
  if (!T || !T.rows) return { kind: "fallback", why: "none" };
  var r = T.rows[String(i)];
  if (r == null) return { kind: "fallback", why: "none" };
  var o = Array.isArray(r) ? { t: "c", k: [r[0], r[1]], c: r.length > 2 ? r[2] : T.c0 } : r;
  if (!tcCheck(T, o.k, geom)) return { kind: "fallback", why: "moved" };
  blk = blk || {};
  var name = tcTidy(o.fn != null ? o.fn : blk.n), h = o.fh != null ? o.fh : blk.h, hs = o.fs != null ? o.fs : blk.hs;
  var cn = ("c" in o) ? o.c : T.c0, CM = cn != null && T.communities ? T.communities[String(cn)] : null;
  var commName = CM && CM.n ? tcTidy(CM.n) : "";
  var L = [], t = o.t;
  var likely = o.cf != null && +o.cf < 0.8;
  var mine = tcHeight(h, hs, t === "b" ? o.h : null);
  var commLines = function () {
    if (!CM) return;
    var lead = CM.pop ? "home to about " + tcN(CM.pop >= 1000 ? Math.round(CM.pop / 100) * 100 : CM.pop) + " people" : "", p = [];
    if (CM.rb) p.push(tcN(CM.rb) + " registered buildings");
    if (CM.ru) p.push(tcN(CM.ru) + " registered units");
    if (lead || p.length) L.push(["cm", "The community: " + (lead && p.length ? lead + ", with " + p.join(" and ") : lead || p.join(" and ")) + "."]);
    if (CM.bus != null) L.push(["cm", "Bus coverage across the community: " + Math.round(+CM.bus) + "%."]);
  };
  if (t === "c") {
    if (!CM) return { kind: "fallback", why: "nofacts" };
    if (name) L.push(["in", "In " + commName]);
    commLines();
    L.push(["ht", "This building: " + mine.charAt(0).toLowerCase() + mine.slice(1)]);
    return { kind: "community", title: name || commName, community: commName, likely: false, lines: L, i: i };
  }
  var title = tcTidy(o.n) || name;
  if (t === "b") {
    if (o.pj) L.push(["f", "Project: " + tcTidy(o.pj)]);
    if (o.d) L.push(["f", "Developer: " + tcTidy(o.d)]);
    L.push(["ht", (o.fl ? tcN(o.fl) + " floors · " : "") + mine]);
    if (o.u) {
      var mix = [];
      if (+o.uf) mix.push(tcN(o.uf) + " flats"); if (+o.uo) mix.push(tcN(o.uo) + " offices"); if (+o.us) mix.push(tcN(o.us) + " shops");
      L.push(["f", tcN(o.u) + " units" + (mix.length ? " (" + mix.join(", ") + ")" : "")]);
    }
    var dn = tcDone(o.cd, o.st, today); if (dn) L.push(["f", dn]);
    if (o.use) L.push(["f", "Use: " + tcTidy(o.use)]);
    if (o.ty) L.push(["f", "Type: " + tcTidy(o.ty)]);
    if (commName) L.push(["in", "In " + commName]);
    return { kind: "building", title: title || "A registered building", likely: likely, lines: L, i: i };
  }
  if (t === "p") {
    L.push(["nt", "One of several buildings in " + tcTidy(o.pj || o.n || "this project") + ". The figures below are for the whole project, not this building alone."]);
    if (o.d) L.push(["f", "Developer: " + tcTidy(o.d)]);
    if (o.u) L.push(["f", "Units in the project: " + tcN(o.u)]);
    var dp = tcDone(o.cd, o.st, today); if (dp) L.push(["f", "Project: " + dp.charAt(0).toLowerCase() + dp.slice(1)]);
    L.push(["ht", "This building: " + mine.charAt(0).toLowerCase() + mine.slice(1)]);
    if (commName) L.push(["in", "In " + commName]);
    return { kind: "project", title: title || tcTidy(o.pj) || "A building in a registered project", likely: likely, lines: L, i: i };
  }
  // plot tier: what the plot holds, never a guessed building
  var pb = o.pbd || o.pbm, pp = [];
  if (pb) pp.push(tcN(pb) + " registered buildings"); if (o.pu) pp.push(tcN(o.pu) + " units");
  L.push(["nt", "This building shares its plot with others" + (pp.length ? ". The plot holds " + pp.join(" and ") : "") + (o.pl ? " (" + String(o.pl).toLowerCase() + " land)" : "") + "."]);
  if (o.pj) L.push(["f", "Project on the plot: " + tcTidy(o.pj)]);
  if (o.d) L.push(["f", "Developer: " + tcTidy(o.d)]);
  L.push(["ht", "This building: " + mine.charAt(0).toLowerCase() + mine.slice(1)]);
  if (commName) L.push(["in", "In " + commName]);
  return { kind: "plot", title: title || "A building on a shared plot", likely: likely, lines: L, i: i };
}
// today's card, for the fallback: the name (or address) and the height
export function tcPlain(blk) {
  blk = blk || {};
  var nm = tcTidy(blk.n);
  var L = [["ht", tcHeight(blk.h, blk.hs, null)]];
  if (nm && blk.a) L.push(["nt", String(blk.a)]);
  return { kind: "plain", title: nm || (blk.a ? String(blk.a) : "A building without a name on our map"), likely: false, lines: L };
}
// the card's inner HTML. o: {badge: html before the title, page: href|"" , preview: bool, extra: html at the end}
export function tcHtml(m, o) {
  o = o || {};
  var s = '<div class="tc-nm">' + (o.badge || "") + "<b>" + tcEsc(m.title) + "</b>" + (m.likely ? '<span class="tc-lk" title="our best reading of the records for this outline">likely</span>' : "") + "</div>";
  (m.lines || []).forEach(function (l) { s += '<p class="tc-' + l[0] + '">' + tcEsc(l[1]) + "</p>"; });
  if (o.page) s += o.preview ? '<span class="pill go tc-go" title="Opens in the app">Building page</span>' : '<a class="pill go tc-go" href="' + tcEsc(o.page) + '">Building page</a>';
  return s + (o.extra || "");
}

const SHARED = [tcCentroid, tcCheck, tcEsc, tcTidy, tcN, tcMonth, tcHeight, tcDone, tcModel, tcPlain, tcHtml].map((f) => f.toString()).join("\n");

// ---- the client: one payload fetch per district, one building-page list per district -------------------------------------------
// window.__tapcards.card(slug, i, geom, blk, key) -> Promise<model>; model.page = true where the app has a building page.
export const TAPCARD_JS = String.raw`
/* v280 - tap any building, get its card (src/tapcards.js) */
window.__tapcards=window.__tapcards||(function(){
"use strict";
` + SHARED + String.raw`
var C={},P={};
function load(slug){if(!C[slug])C[slug]=fetch("/img/tapcard_"+slug).then(function(r){return r.ok?r.json():null}).catch(function(){return null});return C[slug]}
function pages(slug,key){if(!P[slug])P[slug]=fetch("/tapcards/pages?district="+encodeURIComponent(slug)+"&key="+encodeURIComponent(key||"")).then(function(r){return r.ok?r.json():null}).then(function(j){var s={};((j&&j.ids)||[]).forEach(function(i){s[i]=1});return s}).catch(function(){return {}});return P[slug]}
function card(slug,i,geom,blk,key){return Promise.all([load(slug),pages(slug,key)]).then(function(r){var m=tcModel(r[0],i,blk,geom,new Date().toISOString());m.page=m.kind!=="fallback"&&!!(r[1]||{})[i];return m})}
return {load:load,pages:pages,card:card,model:tcModel,plain:tcPlain,html:tcHtml,check:tcCheck,centroid:tcCentroid};
})();
`;

// the card's own lines, for the light /blocks page and the dark /map and twin
export const TAPCARD_CSS_LIGHT = `.tc-nm{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding-right:30px}.tc-nm b{font-size:1.06rem;color:#0A4F4A;line-height:1.25}
.tc-lk{font:600 .7rem/1 "IBM Plex Sans",Arial,sans-serif;color:#7A6230;background:#F3EAD6;border:1px solid #E2D2AC;border-radius:999px;padding:3px 7px}
.tc-ht{margin:8px 0 0;font-size:.95rem}.tc-f{margin:4px 0 0;font-size:.88rem;line-height:1.35}.tc-in{margin:8px 0 0;font-size:.8rem;color:#6E6A5F}
.tc-cm{margin:4px 0 0;font-size:.84rem;line-height:1.4;color:#2B2A26}.tc-nt{margin:6px 0 0;font-size:.8rem;color:#6E6A5F;line-height:1.4}.tc-go{margin-top:12px}`;
export const TAPCARD_CSS_DARK = `#tcard{position:fixed;left:12px;right:12px;bottom:calc(84px + env(safe-area-inset-bottom));max-width:430px;margin:auto;z-index:45;background:rgba(19,31,29,.97);color:#E8E4D8;border:1px solid rgba(197,165,106,.5);border-radius:14px;padding:14px 16px 16px;box-shadow:0 8px 28px rgba(0,0,0,.45);font-family:"IBM Plex Sans",system-ui,-apple-system,"Segoe UI",Arial,sans-serif;max-height:60vh;overflow:auto}
#tcard[hidden]{display:none}#tcard .tcx{position:absolute;right:6px;top:4px;border:0;background:none;color:#B9B3A3;font-size:1.5rem;line-height:1;padding:6px 10px;cursor:pointer}
#tcard .tc-nm{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding-right:30px}#tcard .tc-nm b{font-size:1.04rem;color:#C5A56A;line-height:1.25}
#tcard .tc-lk{font:600 .68rem/1 "IBM Plex Sans",Arial,sans-serif;color:#C5A56A;border:1px solid rgba(197,165,106,.6);border-radius:999px;padding:3px 7px}
#tcard p{margin:4px 0 0;font-size:.86rem;line-height:1.38}#tcard .tc-ht{margin-top:8px;font-size:.93rem;color:#fff}#tcard .tc-in,#tcard .tc-nt{color:#A9A493;font-size:.8rem}#tcard .tc-in{margin-top:8px}
#tcard .tcb{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}#tcard .pill,#tcard .tcb button{display:inline-block;border:1px solid rgba(197,165,106,.75);background:rgba(12,20,19,.92);color:#C5A56A;font:600 .76rem/1 "IBM Plex Sans",Arial,sans-serif;padding:9px 13px;border-radius:999px;text-decoration:none;cursor:pointer;-webkit-tap-highlight-color:transparent}
#tcard .tc-go{margin:0}`;

// the dark card on /map and in the twin: one element, made on first use. show(html) / hide().
export const TAPCARD_DARK_JS = String.raw`
window.__tcPanel=window.__tcPanel||(function(){
var el=null;
function mk(){if(el)return el;var st=document.createElement("style");st.textContent=` + JSON.stringify(TAPCARD_CSS_DARK) + String.raw`;document.head.appendChild(st);
  el=document.createElement("section");el.id="tcard";el.hidden=true;el.setAttribute("role","dialog");el.setAttribute("aria-label","Building card");
  el.innerHTML='<button type=button class=tcx aria-label=Close>×</button><div class=tcbody></div>';el.querySelector(".tcx").onclick=function(){hide()};
  ["pointerdown","pointerup","click","touchstart","wheel"].forEach(function(ev){el.addEventListener(ev,function(e){e.stopPropagation()},{passive:true})});
  document.body.appendChild(el);return el}
function show(h){mk().querySelector(".tcbody").innerHTML=h;el.hidden=false}
function hide(){if(el)el.hidden=true}
return {show:show,hide:hide,el:function(){return mk()}};
})();
`;

// ---- the route: which footprints in a district have an app building page ------------------------------------------------------
// /tapcards/pages?district=<slug>&key=<app key>  ->  {slug, ids:[...]}. The building page needs the district's stack and a
// unit-mix record for the id (building_page.js answers 404 without them) - the same test /blocks makes for its gold set.
export const tcSlug = (s) => String(s || "").replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 40);
export async function tapcardsRoute(request, env, url, h) {
  if (url.pathname !== "/tapcards/pages") return null;
  if (!h.clientOk(env, url)) return new Response("unauthorized", { status: 401 });
  const slug = tcSlug(url.searchParams.get("district"));
  let ids = [];
  if (slug) {
    try {
      const st = await env.MEETINGS.list({ prefix: "img_stack_" + slug });
      if ((st.keys || []).some((k) => k.name === "img_stack_" + slug)) {
        const um = JSON.parse((await env.MEETINGS.get("img_unitmix_" + slug)) || "null");
        ids = Object.keys((um && um.buildings_by_id) || {}).filter((k) => /^\d{1,6}$/.test(k)).map(Number).sort((a, b) => a - b);
      }
    } catch (e) { ids = []; }
  }
  return new Response(JSON.stringify({ slug, ids }), { headers: { "Content-Type": "application/json", "Cache-Control": "private, max-age=600", "X-Robots-Tag": "noindex" } });
}
