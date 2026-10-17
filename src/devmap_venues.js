// v605 - INSIDE THIS CENTRE on the Developers-by-area page (Kendall, 16 Oct 2026: "build the centre venue block"): for each of the five Dubai 2040 centres, how many restaurants, parks, gyms, schools,
// supermarkets and clinics are inside the area we group into it, and the 2027 pipeline (projects and planned homes with a register end date in 2027, by the register's own status).
// The data (KV img_devmap_venues, built offline by scripts/build_devmap_venues.py in the market-pulse repo from the lake table lk_centre_venues, read through MotherDuck) holds per centre a list of
// tiles {k, n, src, also, alt}: n is the figure shown; src is "google" (operating Google places, each counted once over the centre's polygon, on the date given) or "register" (points in our own
// register: OpenStreetMap and Dubai Municipality); also is a short list of related Google counts shown under the figure (cafes and bars under restaurants); alt is Google's own count for the same
// type where it is a much wider net than our register (shown so nobody reads the register count as everything Google lists).
// The route (GET /developers_map_api?what=venues) returns the stored value when it has the shape the page needs, otherwise {} and the page shows no block. Nothing here writes KV.
// On the page the block sits in the RIGHT panel (#detail) under the bedroom-price boxes when a centre is chosen; a narrow screen has no right panel, so the centre card in the left sheet carries a
// copy (class vnside, hidden above 1100 px so a wide screen never shows it twice). There is no block for an area or for all of Dubai: the figures are per centre.
// String.raw, no substitutions and no backticks (the rule src/devmap_page.js keeps); checked with node --check by test/test_v605_venues.mjs.
export const VENUES_KV_NAME = "devmap_venues";             // read through kvJson(env, "devmap_venues") = KV key img_devmap_venues

export function cleanVenues(d) {
  if (!d || typeof d !== "object" || d.v !== 1) return null;
  if (!d.centres || typeof d.centres !== "object" || Array.isArray(d.centres)) return null;
  return d;
}

export const VENUES_CSS = String.raw`
.vncard .vnh{margin:10px 0 4px;font-size:11.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}
.vng{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.vnb{border:1px solid var(--line);border-radius:8px;padding:7px;background:var(--raise);min-width:0;overflow-wrap:anywhere}
.vnb small{display:block;color:var(--muted);font-size:11px}
.vnb b{display:block;font-family:Fraunces,Georgia,serif;font-size:15px;line-height:1.2;margin:2px 0}
.vnb .vnn{display:block;color:var(--muted);font-size:10.5px}
.vncard.vnside{display:none}
@media(max-width:1100px){.vncard.vnside{display:block}}
@media(max-width:480px){.vng{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;

export const VENUES_JS = String.raw`
var VENUES=(function(){
var D=null,MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
var LAB={restaurants:"Restaurants",parks:"Parks",gyms:"Gyms",schools:"Schools",supermarkets:"Supermarkets",clinics:"Clinics"};
var PST=[["active","Active"],["not_started","Not started"],["pending","Pending"]];
function X(t){return String(t==null?"":t).replace(/[&<>"]/g,function(m){return({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[m]})}
function fm(n){return Math.round(n).toLocaleString("en-US")}
function dd(s){var p=String(s||"").split("-");return p.length===3?Number(p[2])+" "+MON[Number(p[1])-1]+" "+p[0]:""}
function load(d){D=(d&&d.v===1&&d.centres&&typeof d.centres==="object")?d:null;return !!D}
function has(){return !!D}
function cen(key){var c=D&&D.centres[key];return c&&c.tiles&&c.tiles.length?c:null}
function tile(t,sc){
  var src=t.src==="google"?"operating, Google":"in our register";
  var also=t.also&&t.also.length?'<span class=vnn>plus '+t.also.map(function(a){return fm(a[1])+" "+X(a[0])}).join(", ")+'</span>':'';
  var alt=t.alt?'<span class=vnn>Google lists '+fm(t.alt)+', a wider net</span>':'';
  var a=(typeof PLACES!=="undefined"&&PLACES&&PLACES.has())?PLACES.attrs(sc,t.k):"";
  var inner='<small>'+X(LAB[t.k]||t.k)+'</small><b>'+fm(t.n)+'</b><span class=vnn>'+src+'</span>'+also+alt;
  return a?'<button'+a+'>'+inner+'<span class=vnt>Show on map</span></button>':'<div class=vnb>'+inner+'</div>'}
function pbox(label,x){
  if(!x||!x.p)return '<div class=vnb><small>'+label+'</small><b>0</b><span class=vnn>no projects</span></div>';
  return '<div class=vnb><small>'+label+'</small><b>'+fm(x.u)+'</b><span class=vnn>planned homes</span><span class=vnn>'+fm(x.p)+' project'+(x.p===1?'':'s')+'</span></div>'}
function pipe(c){
  var p=c.pipeline;if(!p)return "";
  var tp=0,tu=0;PST.forEach(function(s){var x=p[s[0]];if(x){tp+=x.p||0;tu+=x.u||0}});
  if(!tp)return '<p class=vnh>Pipeline: due in '+X(p.year)+'</p><p class=note style="margin:0">No project in the register has an end date in '+X(p.year)+' here.</p>';
  return '<p class=vnh>Pipeline: register end date in '+X(p.year)+'</p><p class=note style="margin:0 0 6px"><b>'+fm(tp)+' projects, '+fm(tu)+' planned homes.</b></p>'
   +'<div class=vng>'+PST.map(function(s){return pbox(s[1],p[s[0]])}).join("")+'</div>'}
function block(key,name,extra){
  if(!D)return "";var c=cen(key);if(!c)return "";
  return '<div class="card vncard'+(extra?' '+extra:'')+'"><p class=label>Inside this centre</p>'
   +'<p class=note style="margin:0"><b dir=auto>'+X(name)+'</b>: the '+fm(c.communities||0)+' communities we group into it, about '+fm(c.km2||0)+' km².</p>'
   +'<p class=vnh>Places and facilities</p><div class=vng>'+c.tiles.map(function(t){return tile(t,"c:"+key)}).join("")+'</div>'
   +pipe(c)
   +'<p class=note style="margin:8px 0 0">Restaurants and gyms are Google places that are operating, each counted once inside the area, on '+X(dd(D.google_date))+'; cafes and bars are counted separately. Parks, schools, supermarkets and clinics are points in our own register (OpenStreetMap and Dubai Municipality). “Google lists” is Google’s count for the same type, a wider net that takes in small or loosely typed places. The communities are our grouping (core, adjacent and peripheral), not the plan’s boundaries. A register end date is not a handover, and the status is the Land Department’s own.'+(typeof PLACES!=="undefined"&&PLACES&&PLACES.has()?' Tap a tile marked “Show on map” to see where those places are. Restaurants, cafes, bars and gyms are mapped so far in '+(typeof PLACES!=="undefined"&&PLACES&&PLACES.sweptNames?fm(PLACES.sweptNames().length):"a few")+' neighbourhoods: open one of them to see those places.':'')+'</p></div>'}
return {load:load,has:has,block:block}
})();
`;
