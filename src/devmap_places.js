// v606 - CLICKABLE PLACES on the Developers-by-area page (Kendall, 17 Oct 2026: "these amenities should appear in the right hand side as cards, clickeable, that then show the locations on the map, as a
// high level understanding for each neighborhood"). A card per kind of place (parks, schools, supermarkets, clinics, pharmacies, hospitals, malls, metro stations, beaches, EV charging, petrol stations,
// and for Business Bay restaurants, cafes, bars and gyms) in the right panel for a centre (the venue block's tiles become cards) and for a neighbourhood (a new "Around here" block). Tapping a card draws
// that kind's points on the map for that centre or neighbourhood, fits the map to them, and puts a chip on the map with the count and a button to hide them; tapping again, tapping another card, or
// choosing something else clears them. A dot opens a small popup with its name; a tap on a dot never selects the area under it.
// The data (KV img_devmap_places, built offline by scripts/build_devmap_places.py in the market-pulse repo, entirely from local files) holds per kind a list of points [lon, lat, name, centre, areaIndex, rating?],
// the list of neighbourhood slugs, and the alias map (jltnorth and jltsouth are althanyahfifth; sobhaheartland and goldensymphony are meydanone). Register kinds are mapped everywhere (our amenity register:
// OpenStreetMap and Dubai Municipality). Restaurants, cafes, bars and gyms exist as points only for Business Bay, from a Google sweep that returns at most 20 places per search circle, so each is flagged partial
// with Google's own total for the district and the card says "mapped N, Google counts M". The centre counts on the venue block equal the points here (the builder refuses to write if not).
// The route (GET /developers_map_api?what=places) returns the stored value when it has the shape the page needs, otherwise {} and the page shows no cards. Nothing here writes KV.
// String.raw, no substitutions and no backticks (the rule src/devmap_page.js keeps); checked with node --check by test/test_v606_places.mjs.
export const PLACES_KV_NAME = "devmap_places";             // read through kvJson(env, "devmap_places") = KV key img_devmap_places

export function cleanPlaces(d) {
  if (!d || typeof d !== "object" || d.v !== 1) return null;
  if (!d.kinds || typeof d.kinds !== "object" || Array.isArray(d.kinds) || !Array.isArray(d.areas) || !d.alias || typeof d.alias !== "object") return null;
  return d;
}

export const PLACES_CSS = String.raw`
button.vnk{width:100%;text-align:left;font:inherit;color:inherit;cursor:pointer}
button.vnk:hover,button.vnk:focus-visible{border-color:var(--gold);outline:0}
button.vnk[aria-pressed=true]{border-color:var(--gold);background:rgba(197,165,106,.14)}
.vnk small{display:flex;align-items:center;gap:5px}
.vnk small::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--kc,#9aa9a5);flex:none}
.vnk .vnt{display:block;margin-top:3px;color:var(--gold);font-size:10.5px}
#plchip{position:absolute;left:50%;bottom:34px;transform:translateX(-50%);z-index:4;display:none;align-items:center;gap:8px;max-width:calc(100% - 24px);padding:6px 8px 6px 12px;border:1px solid var(--line);border-radius:999px;background:rgba(14,20,19,.94);color:var(--ink);font-size:12.5px;white-space:nowrap}
#plchip i{display:inline-block;width:9px;height:9px;border-radius:50%;flex:none}
#plchip span{overflow:hidden;text-overflow:ellipsis}
#plchip button{display:flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border:1px solid var(--line);border-radius:50%;background:var(--raise);color:var(--muted);cursor:pointer;flex:none}
#plchip button:hover,#plchip button:focus-visible{color:var(--gold);border-color:var(--gold);outline:0}
#plchip svg{width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}
.plp .maplibregl-popup-content{background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-size:12.5px;line-height:1.35}
.plp .maplibregl-popup-tip{border-top-color:var(--panel);border-bottom-color:var(--panel)}
.plp .plsub{display:block;color:var(--muted);font-size:11px}
@media(max-width:760px){#plchip{bottom:calc(46vh + 12px)}}
`;

export const PLACES_JS = String.raw`
var PLACES=(function(){
var D=null,CNT={},ACT=null,CH=null,MAP=null,POP=null;
var EMPTY={type:"FeatureCollection",features:[]};
var ORDER=["parks","schools","supermarkets","clinics","pharmacies","hospitals","malls","metros","beaches","ev","fuel","restaurants","cafes","bars","gyms"];
var COL={parks:"#5fb36b",schools:"#e0b04a",supermarkets:"#4fa3d9",clinics:"#e5736f",pharmacies:"#c58be0",hospitals:"#ff5d5d",malls:"#f0a050",metros:"#7fd1c8",beaches:"#6fc3f0",ev:"#b6e04a",fuel:"#a0a8a6",restaurants:"#ff9f6b",cafes:"#d9a77a",bars:"#c77dff",gyms:"#f4d35e"};
function X(t){return String(t==null?"":t).replace(/[&<>"]/g,function(m){return({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[m]})}
function fm(n){return Math.round(n).toLocaleString("en-US")}
function bump(sc,k){var o=CNT[sc]||(CNT[sc]={});o[k]=(o[k]||0)+1}
function load(d){
  if(!(d&&d.v===1&&d.kinds&&typeof d.kinds==="object"&&Array.isArray(d.areas)&&d.alias&&typeof d.alias==="object")){D=null;CNT={};return false}
  D=d;CNT={};
  Object.keys(d.kinds).forEach(function(k){(d.kinds[k].pts||[]).forEach(function(p){if(p[3])bump("c:"+p[3],k);if(p[4]>=0&&d.areas[p[4]])bump("a:"+d.areas[p[4]],k)})});
  return true}
function has(){return !!D}
function canon(slug){return (D&&D.alias[slug])||slug}
function n(sc,k){return (CNT[sc]&&CNT[sc][k])||0}
function can(sc,k){return !!D&&!!D.kinds[k]&&n(sc,k)>0}
function attrs(sc,k){return can(sc,k)?' type=button class="vnb vnk" data-k="'+k+'" data-sc="'+X(sc)+'" aria-pressed=false style="--kc:'+(COL[k]||"#9aa9a5")+'"':''}
function ptile(sc,k,slug){
  var K=D.kinds[k],c=n(sc,k),tot=K.partial&&K.totals?K.totals[slug]:0;
  var line=K.src==="register"?"in our register":"mapped from Google";
  var more=tot?'<span class=vnn>Google counts '+fm(tot)+' here; the rest are not mapped yet</span>':'';
  return '<button'+attrs(sc,k)+'><small>'+X(K.label)+'</small><b>'+fm(c)+'</b><span class=vnn>'+line+'</span>'+more+'<span class=vnt>Show on map</span></button>'}
function areaBlock(slug,name){
  if(!D)return "";var s=canon(slug),sc="a:"+s;
  var ks=ORDER.filter(function(k){return can(sc,k)});if(!ks.length)return "";
  var g=ks.some(function(k){return D.kinds[k].src==="google"});
  return '<div class="card vncard"><p class=label>Around here</p><p class=note style="margin:0"><b dir=auto>'+X(name)+'</b>: the places we hold inside this neighbourhood. Tap a card to see them on the map.</p>'
   +'<div class=vng style="margin-top:8px">'+ks.map(function(k){return ptile(sc,k,s)}).join("")+'</div>'
   +'<p class=note style="margin:8px 0 0">Our register is OpenStreetMap and Dubai Municipality entries, so a place that is missing is one we do not hold, not proof that it does not exist.'+(g?' Restaurants, cafes, bars and gyms come from a Google sweep that returns at most 20 places per search circle, so it holds part of what Google lists; each card says how much.':'')+'</p></div>'}
function pts(sc,k){
  var K=D&&D.kinds[k];if(!K)return [];var c=sc.charAt(0)==="c",id=sc.slice(2),ai=c?-1:D.areas.indexOf(id),ci=c?Number(id):0;
  return (K.pts||[]).filter(function(p){return c?p[3]===ci:p[4]===ai})}
function mp(){return (MAP&&MAP.getSource)?MAP:null}
function closePop(){if(POP){try{POP.remove()}catch(e){}POP=null}}
function lowerSheet(){var s=document.getElementById("side"),g=document.getElementById("grab");if(s&&s.classList)s.classList.remove("max");if(g){g.setAttribute("aria-expanded","false");g.textContent="Tap to expand"}}
function sync(){
  var any=false;
  [].forEach.call(document.querySelectorAll(".vnk"),function(b){var on=!!ACT&&b.getAttribute("data-k")===ACT.k&&b.getAttribute("data-sc")===ACT.sc;b.setAttribute("aria-pressed",on?"true":"false");if(on)any=true});
  if(ACT&&!any)clear()}
function chip(P){
  if(!CH){var m=document.getElementById("map");if(!m)return;CH=document.createElement("div");CH.id="plchip";CH.setAttribute("role","status");m.appendChild(CH)}
  if(!ACT){CH.style.display="none";CH.innerHTML="";return}
  var K=D.kinds[ACT.k],tot=(K.partial&&K.totals&&ACT.sc.charAt(0)==="a")?K.totals[ACT.sc.slice(2)]:0;
  CH.innerHTML='<i style="background:'+(COL[ACT.k]||"#9aa9a5")+'"></i><span>'+X(K.label)+': '+fm(P.length)+(tot?' of '+fm(tot)+' on Google':'')+' shown</span><button type=button id=plx aria-label="Hide these places" title="Hide these places"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>';
  CH.style.display="flex";
  var x=document.getElementById("plx");if(x)x.onclick=function(){clear()}}
function fit(P){
  var m=mp();if(!m||!P.length)return;var x0=180,x1=-180,y0=90,y1=-90;
  P.forEach(function(p){x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1])});
  if(P.length===1||(x1-x0<0.0004&&y1-y0<0.0004)){m.easeTo({center:[(x0+x1)/2,(y0+y1)/2],zoom:15,duration:600});return}
  var ph=innerWidth<=760;
  m.fitBounds([[x0,y0],[x1,y1]],{padding:{top:70,bottom:ph?Math.round(innerHeight*0.32):50,left:40,right:40},maxZoom:15.5,duration:600})}
function show(sc,k){
  var m=mp();if(!D||!D.kinds[k]||!m)return;var src=m.getSource("plpts");if(!src)return;
  var P=pts(sc,k),K=D.kinds[k];closePop();
  src.setData({type:"FeatureCollection",features:P.map(function(p){return {type:"Feature",geometry:{type:"Point",coordinates:[p[0],p[1]]},properties:{n:p[2]||"",c:COL[k]||"#9aa9a5",r:p[5]||0,k:k}}})});
  ACT={sc:sc,k:k};chip(P);fit(P);sync();
  if(innerWidth<=760)lowerSheet()}
function clear(){
  var m=mp(),src=m&&m.getSource("plpts");if(src)src.setData(EMPTY);
  ACT=null;chip([]);closePop();
  [].forEach.call(document.querySelectorAll(".vnk"),function(b){b.setAttribute("aria-pressed","false")})}
function toggle(sc,k){if(ACT&&ACT.sc===sc&&ACT.k===k)clear();else show(sc,k)}
function addLayers(m,font){
  MAP=m;
  try{
    m.addSource("plpts",{type:"geojson",data:EMPTY});
    m.addLayer({id:"pl-halo",type:"circle",source:"plpts",paint:{"circle-radius":10,"circle-color":["get","c"],"circle-opacity":0.22}});
    m.addLayer({id:"pl-pts",type:"circle",source:"plpts",paint:{"circle-radius":5.5,"circle-color":["get","c"],"circle-stroke-color":"#0b0f0f","circle-stroke-width":1.3}});
    m.addLayer({id:"pl-lab",type:"symbol",source:"plpts",minzoom:14,layout:{"text-field":["get","n"],"text-font":font,"text-size":11,"text-offset":[0,1.1],"text-anchor":"top","text-max-width":9},paint:{"text-color":"#f5efe2","text-halo-color":"#0b0f0f","text-halo-width":1.3}});
    m.on("click","pl-pts",function(e){
      var f=e.features&&e.features[0];if(!f||typeof maplibregl==="undefined")return;
      var K=D&&D.kinds[f.properties.k];
      closePop();POP=new maplibregl.Popup({closeButton:false,offset:10,maxWidth:"230px",className:"plp"}).setLngLat(f.geometry.coordinates).setHTML('<b dir=auto>'+X(f.properties.n||"Unnamed")+'</b><span class=plsub>'+X(K?K.label:"")+(f.properties.r?', rated '+X(f.properties.r):'')+'</span>').addTo(m)});
    m.on("mouseenter","pl-pts",function(){m.getCanvas().style.cursor="pointer"});
    m.on("mouseleave","pl-pts",function(){m.getCanvas().style.cursor=""})
  }catch(e){}}
function hit(e){var m=mp();if(!m||!ACT||!e||!e.point)return false;try{return m.queryRenderedFeatures(e.point,{layers:["pl-pts"]}).length>0}catch(x){return false}}
function init(){if(typeof document==="undefined"||typeof document.addEventListener!=="function")return;document.addEventListener("click",function(e){var b=e.target&&e.target.closest?e.target.closest(".vnk"):null;if(!b)return;e.preventDefault();toggle(b.getAttribute("data-sc"),b.getAttribute("data-k"))})}
return {load:load,has:has,can:can,attrs:attrs,areaBlock:areaBlock,addLayers:addLayers,sync:sync,clear:clear,toggle:toggle,hit:hit,init:init,state:function(){return ACT?{sc:ACT.sc,k:ACT.k}:null}}
})();
`;
