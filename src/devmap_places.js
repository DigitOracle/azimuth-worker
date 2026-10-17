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
// v607 - SHADED AREAS (Kendall, 17 Oct 2026: "color the areas by how many of each kind they hold"): tapping a card of a register kind also shades every neighbourhood on the map in that kind's colour, darker
// for more (square-root steps, so one very large count does not wash out the rest), writes the count on each neighbourhood, and puts a small scale (0 to the largest count) in the chip; a Shade button in the
// chip turns the shading off and leaves the dots. All of Dubai now has its own block of cards ("Places across Dubai": the totals over the neighbourhoods) whose taps only shade, because dots for all of Dubai
// would be thousands. Choosing a centre or a neighbourhood keeps the same kind on where the new view has a card for it. Google kinds are never shaded: only Business Bay is mapped, so a shade would mislead.
// The shade is a fill layer over the page's own "areas" source (above its colours, under its outlines and names); the counts are a small point source at a label point inside each neighbourhood (acen), each on a dark badge ringed in the kind's colour so the number stays readable over the page's own names.
// String.raw, no substitutions and no backticks (the rule src/devmap_page.js keeps); checked with node --check by test/test_v606_places.mjs and test/test_v607_shade.mjs.
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
#plchip i.pld{display:inline-block;width:9px;height:9px;border-radius:50%;flex:none}
#plchip .plsc{display:inline-flex;align-items:center;gap:6px;color:var(--muted);font-size:11.5px;flex:none}
#plchip i.plg{display:inline-block;width:64px;height:8px;border-radius:4px}
#plchip button.pltx{width:auto;height:26px;padding:0 10px;border-radius:999px;font:inherit;font-size:12px}
#plchip button.pltx[aria-pressed=true]{color:var(--gold);border-color:var(--gold)}
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
var D=null,CNT={},ACT=null,CH=null,MAP=null,POP=null,SH=null,SHADE=true;
var EMPTY={type:"FeatureCollection",features:[]};
var ORDER=["parks","schools","supermarkets","clinics","pharmacies","hospitals","malls","metros","beaches","ev","fuel","restaurants","cafes","bars","gyms"];
var COL={parks:"#5fb36b",schools:"#e0b04a",supermarkets:"#4fa3d9",clinics:"#e5736f",pharmacies:"#c58be0",hospitals:"#ff5d5d",malls:"#f0a050",metros:"#7fd1c8",beaches:"#6fc3f0",ev:"#b6e04a",fuel:"#a0a8a6",restaurants:"#ff9f6b",cafes:"#d9a77a",bars:"#c77dff",gyms:"#f4d35e"};
function X(t){return String(t==null?"":t).replace(/[&<>"]/g,function(m){return({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[m]})}
function fm(n){return Math.round(n).toLocaleString("en-US")}
function bump(sc,k){var o=CNT[sc]||(CNT[sc]={});o[k]=(o[k]||0)+1}
function load(d){
  if(!(d&&d.v===1&&d.kinds&&typeof d.kinds==="object"&&Array.isArray(d.areas)&&d.alias&&typeof d.alias==="object")){D=null;CNT={};return false}
  D=d;CNT={};
  Object.keys(d.kinds).forEach(function(k){(d.kinds[k].pts||[]).forEach(function(p){if(p[3])bump("c:"+p[3],k);if(p[4]>=0&&d.areas[p[4]]){bump("a:"+d.areas[p[4]],k);bump("d:all",k)}})});
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
function reg(k){return !!D&&!!D.kinds[k]&&D.kinds[k].src==="register"}
function ctile(k){
  var K=D.kinds[k];
  return '<button'+attrs("d:all",k)+'><small>'+X(K.label)+'</small><b>'+fm(n("d:all",k))+'</b><span class=vnn>in our register</span><span class=vnt>Shade the map</span></button>'}
function cityBlock(){
  if(!D)return "";var ks=ORDER.filter(function(k){return reg(k)&&can("d:all",k)});if(!ks.length)return "";
  return '<div class="card vncard"><p class=label>Places across Dubai</p><p class=note style="margin:0">What we hold inside the '+fm(D.areas.length)+' neighbourhoods on this map. Tap a card to shade every neighbourhood by how many it holds, darker for more.</p>'
   +'<div class=vng style="margin-top:8px">'+ks.map(ctile).join("")+'</div>'
   +'<p class=note style="margin:8px 0 0">Our register is OpenStreetMap and Dubai Municipality entries, so a place that is missing is one we do not hold, not proof that it does not exist. A place outside every neighbourhood on the map is not counted here.</p></div>'}
function pts(sc,k){
  if(sc.charAt(0)==="d")return [];
  var K=D&&D.kinds[k];if(!K)return [];var c=sc.charAt(0)==="c",id=sc.slice(2),ai=c?-1:D.areas.indexOf(id),ci=c?Number(id):0;
  return (K.pts||[]).filter(function(p){return c?p[3]===ci:p[4]===ai})}
function mp(){return (MAP&&MAP.getSource)?MAP:null}
function closePop(){if(POP){try{POP.remove()}catch(e){}POP=null}}
function lowerSheet(){var s=document.getElementById("side"),g=document.getElementById("grab");if(s&&s.classList)s.classList.remove("max");if(g){g.setAttribute("aria-expanded","false");g.textContent="Tap to expand"}}
function hexA(h,a){var v=parseInt(String(h).slice(1),16);return "rgba("+((v>>16)&255)+","+((v>>8)&255)+","+(v&255)+","+a+")"}
function counts(k){var o={},mx=0;D.areas.forEach(function(s){var c=n("a:"+s,k);if(c>0){o[s]=c;if(c>mx)mx=c}});return {o:o,max:mx}}
function unshade(){
  SH=null;var m=mp();if(!m)return;
  try{if(m.getLayer&&m.getLayer("pl-shade"))m.setPaintProperty("pl-shade","fill-color","rgba(0,0,0,0)")}catch(e){}
  var s=m.getSource("plcnt");if(s)s.setData(EMPTY)}
function shade(k){
  var m=mp();if(!m||!SHADE||!reg(k)||!m.getLayer||!m.getLayer("pl-shade")){unshade();return}
  var c=counts(k);if(!c.max){unshade();return}
  var ex=["match",["get","slug"]],fs=[];
  Object.keys(c.o).forEach(function(s){
    var col=hexA(COL[k],Math.round((0.14+0.7*Math.sqrt(c.o[s]/c.max))*100)/100);
    ex.push(s,col);Object.keys(D.alias).forEach(function(a){if(D.alias[a]===s)ex.push(a,col)});
    var p=D.acen&&D.acen[s];if(p)fs.push({type:"Feature",geometry:{type:"Point",coordinates:p},properties:{t:fm(c.o[s]),c:COL[k]}})});
  ex.push("rgba(0,0,0,0)");
  m.setPaintProperty("pl-shade","fill-color",ex);
  var s=m.getSource("plcnt");if(s)s.setData({type:"FeatureCollection",features:fs});
  SH={max:c.max}}
function setShade(on){SHADE=!!on;if(ACT){shade(ACT.k);chip(ACT.np)}}
function sync(){
  var any=false,alt=null;
  [].forEach.call(document.querySelectorAll(".vnk"),function(b){var k=b.getAttribute("data-k"),sc=b.getAttribute("data-sc"),on=!!ACT&&k===ACT.k&&sc===ACT.sc;b.setAttribute("aria-pressed",on?"true":"false");if(on)any=true;else if(ACT&&k===ACT.k&&!alt)alt=b});
  if(ACT&&!any){if(alt)show(alt.getAttribute("data-sc"),ACT.k,true);else clear()}}
function chip(np){
  if(!CH){var m=document.getElementById("map");if(!m)return;CH=document.createElement("div");CH.id="plchip";CH.setAttribute("role","status");m.appendChild(CH)}
  if(!ACT){CH.style.display="none";CH.innerHTML="";return}
  var K=D.kinds[ACT.k],city=ACT.sc==="d:all",r=reg(ACT.k),col=COL[ACT.k]||"#9aa9a5",tot=(K.partial&&K.totals&&ACT.sc.charAt(0)==="a")?K.totals[ACT.sc.slice(2)]:0;
  var txt=city?K.label+" by neighbourhood":K.label+': '+fm(np)+(tot?' of '+fm(tot)+' on Google':'')+' shown';
  var leg=(r&&SH)?'<span class=plsc>0<i class=plg style="background:linear-gradient(90deg,'+hexA(col,0.14)+','+hexA(col,0.84)+')"></i>'+fm(SH.max)+'</span>':'';
  var tg=r?'<button type=button id=plsh class=pltx aria-pressed="'+(SHADE?"true":"false")+'" title="Shade the neighbourhoods by how many they hold">Shade</button>':'';
  CH.innerHTML='<i class=pld style="background:'+col+'"></i><span>'+X(txt)+'</span>'+leg+tg+'<button type=button id=plx aria-label="Hide these places" title="Hide these places"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>';
  CH.style.display="flex";
  var x=document.getElementById("plx");if(x)x.onclick=function(){clear()};
  var g=document.getElementById("plsh");if(g)g.onclick=function(){setShade(!SHADE)}}
function fit(P){
  var m=mp();if(!m||!P.length)return;var x0=180,x1=-180,y0=90,y1=-90;
  P.forEach(function(p){x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1])});
  if(P.length===1||(x1-x0<0.0004&&y1-y0<0.0004)){m.easeTo({center:[(x0+x1)/2,(y0+y1)/2],zoom:15,duration:600});return}
  var ph=innerWidth<=760;
  m.fitBounds([[x0,y0],[x1,y1]],{padding:{top:70,bottom:ph?Math.round(innerHeight*0.32):50,left:40,right:40},maxZoom:15.5,duration:600})}
function show(sc,k,quiet){
  var m=mp();if(!D||!D.kinds[k]||!m)return;var src=m.getSource("plpts");if(!src)return;
  var P=pts(sc,k);closePop();
  src.setData({type:"FeatureCollection",features:P.map(function(p){return {type:"Feature",geometry:{type:"Point",coordinates:[p[0],p[1]]},properties:{n:p[2]||"",c:COL[k]||"#9aa9a5",r:p[5]||0,k:k}}})});
  ACT={sc:sc,k:k,np:P.length};shade(k);chip(P.length);if(!quiet)fit(P);sync();
  if(!quiet&&innerWidth<=760)lowerSheet()}
function clear(){
  var m=mp(),src=m&&m.getSource("plpts");if(src)src.setData(EMPTY);
  ACT=null;unshade();chip(0);closePop();
  [].forEach.call(document.querySelectorAll(".vnk"),function(b){b.setAttribute("aria-pressed","false")})}
function toggle(sc,k){if(ACT&&ACT.sc===sc&&ACT.k===k)clear();else show(sc,k)}
function addLayers(m,font){
  MAP=m;
  try{
    if(m.getSource("areas")){
      m.addLayer({id:"pl-shade",type:"fill",source:"areas",paint:{"fill-color":"rgba(0,0,0,0)","fill-opacity":1}},"a-line");
      m.addSource("plcnt",{type:"geojson",data:EMPTY});
      m.addLayer({id:"pl-cntbg",type:"circle",source:"plcnt",paint:{"circle-radius":["+",8,["*",3,["length",["get","t"]]]],"circle-color":"rgba(11,15,15,0.88)","circle-stroke-color":["get","c"],"circle-stroke-width":1.6}});
      m.addLayer({id:"pl-cnt",type:"symbol",source:"plcnt",layout:{"text-field":["get","t"],"text-font":font,"text-size":14,"text-allow-overlap":true,"text-ignore-placement":true},paint:{"text-color":"#ffffff","text-halo-color":"#0b0f0f","text-halo-width":1.6}})
    }
  }catch(e){}
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
return {load:load,has:has,can:can,attrs:attrs,areaBlock:areaBlock,cityBlock:cityBlock,setShade:setShade,addLayers:addLayers,sync:sync,clear:clear,toggle:toggle,hit:hit,init:init,state:function(){return ACT?{sc:ACT.sc,k:ACT.k}:null}}
})();
`;
