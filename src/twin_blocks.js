// v278 - TWIN BLOCKS (Kendall, 1 Oct 2026): the blocks stay until she is ready for detail.
//
// Kendall: "map, zoom into a district. There's this super quick transition: when you're in map and go to a district, it zooms
// into that district but then automatically jumps and takes you into the twin. Why can't I stay in that format with the
// blocks until I'm ready to zoom in? ... I still want the super high level of detail - when I go into the Palm I can see
// every single building - but I don't want that super fast transition."
//
// Three pieces, all here; src/index.js carries one import and a handful of marked `// v278` lines:
//
//   1. /map (MAP_BLOCKS_JS, runs inside the map chrome's scope): when the view reaches a district that has blocks on file
//      (/img/blocks_<slug>, the data /blocks draws), its blocks rise in place as a MapLibre fill-extrusion layer - pale grey,
//      paler where the height is not known, to-scale heights, the map pitched oblique. Loaded lazily per district as the
//      view reaches it, unloaded when it is far away. Dots and prices above district zoom are untouched. No page change.
//   2. Detail on demand: tapping a block, zooming past TB_ZOOM_DETAIL, or the small "Detail" pill opens the district twin
//      WITH THE CAMERA in the URL (c=lon,lat  z=zoom  br=bearing  p=pitch, MapLibre's own terms) so the twin opens looking at
//      the same spot. The same hand-over serves the all-Dubai twin (/skyline?all=1, the city of blocks): the fly-then-jump
//      after a search is gone; the district stays lit with its "open the twin" link, and zooming right in hands over.
//   3. The district twin (TWIN_BLOCKS_JS): opens with the district's blocks drawn in the twin's own three.js frame within a
//      second or two, placed by the camera from the URL (or, with none, from the south like /blocks), while the detailed tile
//      streams in exactly as before. When the tile lands, the blocks go and the camera is carried across by the difference
//      between the two models' footprints, so nothing jumps. Nothing in the detailed model changes. A district with no
//      blocks key behaves as today.
//
// Frames. The blocks file is lon/lat. The twin works in metres: CityEngine's frame is UTM zone 40 N (EPSG:32640), x = easting,
// y = up, z = -northing, and the loaded tile is then centred on its own bounding box (onSky). The blocks are drawn around an
// origin of their own (the blocks' bounding-box centre in UTM) and the hand-over measures where the tile actually landed, so
// no origin ever has to be guessed - the anchors' glb_center, the v5 origin and the v276 najma_origin_ce_xyz all describe the
// same ground and none of them is needed to line the two up. llToUtm40 / utm40ToLl are the Kruger series (sub-millimetre in
// zone); the page scripts carry their source verbatim (Function.toString), so the tests exercise the same code the page runs.
//
// Every page script is a plain string with no template holes: test/test_v278_twin_blocks.mjs runs node --check on each as
// served. Phone-first: Naj uses it on her phone.

import { TAPCARD_JS, TAPCARD_DARK_JS } from "./tapcards.js";   // v280 - tap any building, get its card

export const TB_ZOOM_BLOCKS = 12.8;   // blocks draw from here (the /map rail's fitBounds on a district lands around 13-14)
export const TB_ZOOM_DETAIL = 17;     // zooming past this on /map hands over to the twin (a few blocks wide on a phone)
export const TB_CITY_HANDOVER_M = 1700;   // the city of blocks hands over when the camera comes this close (its minDistance is 1500)

// ---- geodesy: WGS84 lon/lat <-> UTM zone 40 N metres (EPSG:32640) ---------------------------------------------------------
export function llToUtm40(lon, lat) {
  var a = 6378137, f = 1 / 298.257223563, k0 = 0.9996, lon0 = 57 * Math.PI / 180;
  var n = f / (2 - f), n2 = n * n, n3 = n2 * n, A = a / (1 + n) * (1 + n2 / 4 + n2 * n2 / 64);
  var a1 = n / 2 - 2 * n2 / 3 + 5 * n3 / 16, a2 = 13 * n2 / 48 - 3 * n3 / 5, a3 = 61 * n3 / 240;
  var phi = lat * Math.PI / 180, dl = lon * Math.PI / 180 - lon0, s2n = 2 * Math.sqrt(n) / (1 + n), sp = Math.sin(phi);
  var t = Math.sinh(Math.atanh(sp) - s2n * Math.atanh(s2n * sp));
  var xi = Math.atan2(t, Math.cos(dl)), eta = Math.atanh(Math.sin(dl) / Math.sqrt(1 + t * t));
  var E = 500000 + k0 * A * (eta + a1 * Math.cos(2 * xi) * Math.sinh(2 * eta) + a2 * Math.cos(4 * xi) * Math.sinh(4 * eta) + a3 * Math.cos(6 * xi) * Math.sinh(6 * eta));
  var N = k0 * A * (xi + a1 * Math.sin(2 * xi) * Math.cosh(2 * eta) + a2 * Math.sin(4 * xi) * Math.cosh(4 * eta) + a3 * Math.sin(6 * xi) * Math.cosh(6 * eta));
  return [E, N];
}
export function utm40ToLl(E, N) {
  var a = 6378137, f = 1 / 298.257223563, k0 = 0.9996, lon0 = 57 * Math.PI / 180;
  var n = f / (2 - f), n2 = n * n, n3 = n2 * n, A = a / (1 + n) * (1 + n2 / 4 + n2 * n2 / 64);
  var b1 = n / 2 - 2 * n2 / 3 + 37 * n3 / 96, b2 = n2 / 48 + n3 / 15, b3 = 17 * n3 / 480;
  var d1 = 2 * n - 2 * n2 / 3 - 2 * n3, d2 = 7 * n2 / 3 - 8 * n3 / 5, d3 = 56 * n3 / 15;
  var xi = N / (k0 * A), eta = (E - 500000) / (k0 * A);
  var xp = xi - (b1 * Math.sin(2 * xi) * Math.cosh(2 * eta) + b2 * Math.sin(4 * xi) * Math.cosh(4 * eta) + b3 * Math.sin(6 * xi) * Math.cosh(6 * eta));
  var ep = eta - (b1 * Math.cos(2 * xi) * Math.sinh(2 * eta) + b2 * Math.cos(4 * xi) * Math.sinh(4 * eta) + b3 * Math.cos(6 * xi) * Math.sinh(6 * eta));
  var chi = Math.asin(Math.sin(xp) / Math.cosh(ep));
  var phi = chi + d1 * Math.sin(2 * chi) + d2 * Math.sin(4 * chi) + d3 * Math.sin(6 * chi);
  var lam = lon0 + Math.atan2(Math.sinh(ep), Math.cos(xp));
  return [lam * 180 / Math.PI, phi * 180 / Math.PI];
}

// ---- the camera, in MapLibre's terms, carried between the pages ------------------------------------------------------------
// A MapLibre view at zoom z over latitude lat shows 156543.03*cos(lat)/2^z metres per CSS pixel at the centre; a three.js
// camera with a 48-degree vertical field of view sees the same extent at a distance of 1.123 x (viewport height in px) x that.
export function tbMetresPerPx(zoom, lat) { return 156543.03 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom); }
export function tbDistForZoom(zoom, lat, heightPx) { return 1.123 * heightPx * tbMetresPerPx(zoom, lat); }
export function tbZoomForDist(dist, lat, heightPx) { return Math.log(156543.03 * Math.cos(lat * Math.PI / 180) * 1.123 * heightPx / dist) / Math.LN2; }
// c=lon,lat  z=zoom  br=bearing (clockwise from north, degrees)  p=pitch (from straight down, degrees). Anything unreadable is dropped.
export function tbCamFromParams(q) {
  var get = function (k) { return q && typeof q.get === "function" ? q.get(k) : (q ? q[k] : null); };
  var c = String(get("c") || "").split(","), lon = parseFloat(c[0]), lat = parseFloat(c[1]);
  if (!(isFinite(lon) && isFinite(lat) && lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90)) return null;
  var z = parseFloat(get("z")), br = parseFloat(get("br")), p = parseFloat(get("p"));
  return { lon: lon, lat: lat, zoom: isFinite(z) ? Math.min(22, Math.max(8, z)) : 15.5, bearing: isFinite(br) ? ((br % 360) + 360) % 360 : 0, pitch: isFinite(p) ? Math.min(85, Math.max(0, p)) : 55 };
}
export function tbCamToQuery(cam) {
  return "&c=" + cam.lon.toFixed(6) + "," + cam.lat.toFixed(6) + "&z=" + cam.zoom.toFixed(2) + "&br=" + cam.bearing.toFixed(1) + "&p=" + cam.pitch.toFixed(1);
}

// the geodesy and camera helpers, verbatim, for the page scripts (the same functions the tests run in Node)
const SHARED_JS = [llToUtm40, utm40ToLl, tbMetresPerPx, tbDistForZoom, tbZoomForDist, tbCamFromParams, tbCamToQuery].map((f) => f.toString()).join("\n") + "\n";

export const tbSlug = (s) => String(s || "").replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 40);
const jsonInScript = (o) => JSON.stringify(o).replace(/</g, "\\u003c");

// the districts with blocks on file: every img_blocks_<slug> key (img_ct_blocks_ keys carry the content type and do not match)
export async function tbHaveList(env) {
  try { const l = await env.MEETINGS.list({ prefix: "img_blocks_" }); return (l.keys || []).map((k) => k.name.slice(11)).filter((s) => /^[a-z0-9]{1,40}$/.test(s)); } catch (e) { return []; }
}
export async function tbHave(env, slug) {
  const s = tbSlug(slug); if (!s) return false;
  try { const l = await env.MEETINGS.list({ prefix: "img_blocks_" + s }); return (l.keys || []).some((k) => k.name === "img_blocks_" + s); } catch (e) { return false; }
}

// ---- 1 + 2. the blocks layer on /map -------------------------------------------------------------------------------------------
// Runs inside renderMapBasic's chrome scope (map arrives as window.__najmap2 once the basemap style is chosen; D = districts_geo
// with each district's bbox; KEY = the page's key). window.__BLOCKS_HAVE lists the districts with blocks on file.
export const MAP_BLOCKS_JS = TAPCARD_JS + TAPCARD_DARK_JS + String.raw`
/* v278 - blocks on the map: a district's blocks rise in place, the twin only on request */
(function(){
"use strict";
var HAVE=window.__BLOCKS_HAVE||[];if(!HAVE.length)return;
` + SHARED_JS + String.raw`
var ZB=` + TB_ZOOM_BLOCKS + String.raw`,ZD=` + TB_ZOOM_DETAIL + String.raw`,CTX="#E4E4DE",CTX_UNK="#EFEEE8";
var ST={},mp=null,PITCHED=false,NAV=false,BTN=null,GEO={},TAP=0;   /* v280 - GEO[slug][i]: the footprint as drawn, for the tap card checksum */
function dist(s){var DD=(typeof D!=="undefined"&&D&&D.districts)||[];for(var k=0;k<DD.length;k++)if(DD[k].slug===s)return DD[k];return null}
function slugBox(s){var st=ST[s];if(st&&st.bbox)return st.bbox;var d=dist(s);return (d&&d.bbox)||null}
function view(){var b=mp.getBounds();return [b.getWest(),b.getSouth(),b.getEast(),b.getNorth()]}
function hits(bb,V,pad){var w=(V[2]-V[0])*pad,h=(V[3]-V[1])*pad;return bb[0]<=V[2]+w&&bb[2]>=V[0]-w&&bb[1]<=V[3]+h&&bb[3]>=V[1]-h}
function inside(bb,c){return c[0]>=bb[0]&&c[0]<=bb[2]&&c[1]>=bb[1]&&c[1]<=bb[3]}
function unknownH(hs){return hs==="unknown"||hs==="default12"}
function extend(b,g){var rings=g.type==="Polygon"?[g.coordinates[0]]:g.type==="MultiPolygon"?g.coordinates.map(function(p){return p[0]}):[];
  rings.forEach(function(r){r.forEach(function(c){if(c[0]<b[0])b[0]=c[0];if(c[1]<b[1])b[1]=c[1];if(c[0]>b[2])b[2]=c[0];if(c[1]>b[3])b[3]=c[1]})})}
function centroid(g){var r=g.type==="Polygon"?g.coordinates[0]:g.type==="MultiPolygon"?g.coordinates[0][0]:null;if(!r||r.length<2)return null;
  var n=r.length-1,x=0,y=0;for(var k=0;k<n;k++){x+=r[k][0];y+=r[k][1]}return [x/n,y/n]}
function keyQ(){return "?key="+encodeURIComponent(typeof KEY!=="undefined"?KEY:"")+(window.__RKQ||"")}
function camNow(c){var ce=c||mp.getCenter();return {lon:ce.lng!=null?ce.lng:ce[0],lat:ce.lat!=null?ce.lat:ce[1],zoom:mp.getZoom(),bearing:mp.getBearing(),pitch:mp.getPitch()}}
// the hand-over: the district twin, opened looking at this spot (c/z/br/p are read by the twin's blocks-first loader)
function go(s,extra,c){if(NAV)return;NAV=true;var cam=camNow(c);if(cam.zoom<14.5)cam.zoom=14.5;
  location.href="/skyline/"+encodeURIComponent(s)+keyQ()+tbCamToQuery(cam)+(extra||"")}
function load(s){ST[s]={state:"loading",bbox:slugBox(s)};
  fetch("/img/blocks_"+s).then(function(r){return r.ok?r.json():null}).then(function(fc){
    if(!fc||!fc.features){ST[s]={state:"none"};return}
    var feats=[],bb=[999,999,-999,-999],G=GEO[s]={};
    fc.features.forEach(function(f){var p=f.properties||{};if(p.k!=="b"||!f.geometry)return;extend(bb,f.geometry);G[p.i]={geom:f.geometry,n:p.n||"",h:p.h,hs:p.hs||"",a:p.a||""};
      feats.push({type:"Feature",id:p.i,properties:{i:p.i,h:p.h||12,u:unknownH(p.hs)?1:0,n:p.n||""},geometry:f.geometry})});
    ST[s]={state:"on",bbox:(fc.meta&&fc.meta.bbox)||bb,n:feats.length};
    if(!mp.getSource("tb-"+s)){mp.addSource("tb-"+s,{type:"geojson",data:{type:"FeatureCollection",features:feats}});
      var before=["sel-halo","sub-bub","plot-dot","home-dot","vid-dot"].filter(function(id){return mp.getLayer(id)})[0];
      mp.addLayer({id:"tb-"+s,type:"fill-extrusion",source:"tb-"+s,minzoom:ZB,paint:{"fill-extrusion-color":["case",["==",["get","u"],1],CTX_UNK,CTX],"fill-extrusion-height":["get","h"],"fill-extrusion-base":0,"fill-extrusion-opacity":1,"fill-extrusion-vertical-gradient":false}},before);
      mp.on("click","tb-"+s,function(e){var f=e.features&&e.features[0];if(!f)return;var p=f.properties||{};TAP=Date.now();tapCard(s,p,f)});   /* v280 - a tap shows the building's card; the card carries the hand-over */
      mp.on("mouseenter","tb-"+s,function(){mp.getCanvas().style.cursor="pointer"});mp.on("mouseleave","tb-"+s,function(){mp.getCanvas().style.cursor=""});}
    oblique();tick();
  }).catch(function(){ST[s]={state:"none"}})}
/* v280 - the tap card. Today's name + height at once, the register card when the district's tap cards are in; its button opens
   the detailed twin at that building, as the tap used to. */
function tapCard(s,p,f){var g=(GEO[s]||{})[p.i]||{geom:f.geometry,n:p.n,h:p.h,hs:""},TC=window.__tapcards,DK=window.__tcPanel;if(!TC||!DK)return;
  var blk={n:g.n,h:g.h,hs:g.hs,a:g.a},my=TAP,c=centroid(g.geom);
  var twin=function(){go(s,p.i!=null?"&b="+encodeURIComponent(p.i):"",c)};
  var paint=function(m,page){DK.show(TC.html(m,{page:page?"/building/"+encodeURIComponent(s)+"/"+p.i+keyQ():"",extra:'<div class=tcb><button type=button class=tctw>Open the twin here</button></div>'}));
    var b=DK.el().querySelector(".tctw");if(b)b.onclick=twin;window.__lastTapcard=m};
  paint(TC.plain(blk),false);
  TC.card(s,p.i,g.geom,blk,typeof KEY!=="undefined"?KEY:"").then(function(m){if(my!==TAP||m.kind==="fallback"){window.__lastTapcard=m;return}paint(m,m.page)}).catch(function(){})}
function unload(s){try{if(mp.getLayer("tb-"+s))mp.removeLayer("tb-"+s);if(mp.getSource("tb-"+s))mp.removeSource("tb-"+s)}catch(e){}ST[s]={state:"idle",bbox:ST[s]&&ST[s].bbox}}
// the first blocks in view tilt the map (a portrait phone a little more from above); zooming back out lays it flat again
function oblique(){if(PITCHED||mp.getPitch()>=20)return;PITCHED=true;mp.easeTo({pitch:(innerWidth<560&&innerHeight>innerWidth)?50:55,duration:700})}
function here(){var c=mp.getCenter(),cc=[c.lng,c.lat],best=null,bd=1e9;HAVE.forEach(function(s){var st=ST[s];if(!st||st.state!=="on")return;if(inside(st.bbox,cc)){best=s;bd=-1;return}
  if(bd<0)return;var d=Math.pow((st.bbox[0]+st.bbox[2])/2-cc[0],2)+Math.pow((st.bbox[1]+st.bbox[3])/2-cc[1],2);if(d<bd){bd=d;best=s}});return best}
var READY=false;   // the style is in (isStyleLoaded flickers false while tiles stream, so it is not the guard)
function tick(){if(!mp||!READY)return;var z=mp.getZoom(),V=view(),on=false;
  HAVE.forEach(function(s){var st=ST[s]||(ST[s]={state:"idle"});var bb=slugBox(s);
    if(z>=ZB-0.3){if(!bb){if(st.state==="idle")load(s);return}
      if(hits(bb,V,0.35)){if(st.state==="idle")load(s);if(st.state==="on"&&hits(bb,V,0))on=true}
      else if(st.state==="on"&&!hits(bb,V,2.5))unload(s)}
    else if(st.state==="on"&&!hits(bb,V,2.5))unload(s)});
  if(BTN)BTN.hidden=!(on&&z>=ZB);
  if(on&&z>=ZD){var s=here();if(s)go(s,"")}
  if(!on&&PITCHED&&z<ZB-0.3){PITCHED=false;mp.easeTo({pitch:0,duration:500})}}
function button(){BTN=document.createElement("button");BTN.type="button";BTN.id="tbdetail";BTN.hidden=true;
  BTN.setAttribute("aria-label","Open the detailed twin here");BTN.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 12l9-5M12 12v10M12 12L3 7"/></svg> Detail';
  BTN.style.cssText="position:fixed;left:50%;bottom:calc(104px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:36;display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(197,165,106,.75);background:rgba(12,20,19,.92);color:#C5A56A;font:600 .72rem/1 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;padding:9px 14px;border-radius:999px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.35);-webkit-tap-highlight-color:transparent";
  BTN.onclick=function(){var s=here();if(s)go(s,"")};document.body.appendChild(BTN)}
function arm(){mp=window.__najmap2;if(!mp){setTimeout(arm,250);return}button();
  mp.on("click",function(){if(Date.now()-TAP>300&&window.__tcPanel)window.__tcPanel.hide()});   /* v280 - a tap off the blocks puts the card away */
  mp.on("moveend",tick);mp.on("zoomend",tick);mp.on("load",function(){READY=true;tick()});if(mp.isStyleLoaded()||mp.loaded()){READY=true;tick()}}
window.__tbMap={state:function(){return ST},tick:tick,go:go,tap:tapCard};
arm();
})();
`;

// ---- 3. the district twin opens with blocks ------------------------------------------------------------------------------------
// A plain script served before the twin's module. The module hands over its scene once (window.__twinBlocksMount) and asks the
// hand-over question when the tile lands (window.__twinBlocks.tileArrived). cfg: { slug, have, key }.
export function twinBlocksTag(cfg) {
  const c = { slug: tbSlug(cfg && cfg.slug), have: !!(cfg && cfg.have), key: (cfg && cfg.key) || "" };
  return '<script>window.__TWIN_BLOCKS_CFG__=' + jsonInScript(c) + ';' + TWIN_BLOCKS_JS + '<\/script>';
}
export const TWIN_BLOCKS_JS = TAPCARD_JS + TAPCARD_DARK_JS + String.raw`
/* v278 - the twin opens with the district's blocks; the detailed tile replaces them as it arrives, the camera carried across */
(function(){
"use strict";
var CFG=window.__TWIN_BLOCKS_CFG__||{};
` + SHARED_JS + String.raw`
var CTX=0xE4E4DE,CTX_UNK=0xEFEEE8,GROUND=0x16211E;
var S={state:CFG.have?"waiting":"off",group:null,ground:null,box:null,held:false,cam:null,tap:0};
function unknownH(hs){return hs==="unknown"||hs==="default12"}
function rings(g){return g.type==="Polygon"?[g.coordinates[0]]:g.type==="MultiPolygon"?g.coordinates.map(function(p){return p[0]}):[]}
// the blocks' own frame: metres east / south of the blocks' bounding-box centre in UTM 40 N (x east, y up, z south)
function frameOf(fc){var b=(fc.meta&&fc.meta.bbox)||null;if(!b){b=[999,999,-999,-999];fc.features.forEach(function(f){rings(f.geometry||{}).forEach(function(r){r.forEach(function(c){if(c[0]<b[0])b[0]=c[0];if(c[1]<b[1])b[1]=c[1];if(c[0]>b[2])b[2]=c[0];if(c[1]>b[3])b[3]=c[1]})})})}
  var o=llToUtm40((b[0]+b[2])/2,(b[1]+b[3])/2);return {E0:o[0],N0:o[1],lat:(b[1]+b[3])/2,bbox:b}}
function toScene(F,lon,lat){var u=llToUtm40(lon,lat);return [u[0]-F.E0,F.N0-u[1]]}
// one BufferGeometry for the whole district: flat-roofed prisms, walls with outward flat normals, a colour per building
function build(THREE,fc,F){
  var pos=[],nor=[],col=[],cg=new THREE.Color(CTX),cu=new THREE.Color(CTX_UNK),n=0,spans=[],byI={};   /* v280 - spans: [first vertex, end, i] per building, for the tap */
  function tri(a,b,c,nx,ny,nz,C){pos.push(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2]);for(var k=0;k<3;k++){nor.push(nx,ny,nz);col.push(C.r,C.g,C.b)}}
  fc.features.forEach(function(f){var p=f.properties||{};if(p.k!=="b"||!f.geometry)return;var h=Math.max(1,+p.h||12),C=unknownH(p.hs)?cu:cg,v0=pos.length/3;byI[p.i]=f;
    rings(f.geometry).forEach(function(r){var pts=[],cx=0,cz=0;for(var k=0;k<r.length-1;k++){var s=toScene(F,r[k][0],r[k][1]);pts.push(s);cx+=s[0];cz+=s[1]}
      var m=pts.length;if(m<3)return;cx/=m;cz/=m;
      for(var i=0;i<m;i++){var a=pts[i],b=pts[(i+1)%m],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.sqrt(dx*dx+dz*dz);if(L<0.01)continue;
        var nx=dz/L,nz=-dx/L;if(nx*((a[0]+b[0])/2-cx)+nz*((a[1]+b[1])/2-cz)<0){nx=-nx;nz=-nz}
        tri([a[0],0,a[1]],[b[0],0,b[1]],[b[0],h,b[1]],nx,0,nz,C);tri([a[0],0,a[1]],[b[0],h,b[1]],[a[0],h,a[1]],nx,0,nz,C)}
      var shape=pts.map(function(q){return new THREE.Vector2(q[0],q[1])}),idx;try{idx=THREE.ShapeUtils.triangulateShape(shape,[])}catch(e){idx=[]}
      idx.forEach(function(t){tri([pts[t[0]][0],h,pts[t[0]][1]],[pts[t[1]][0],h,pts[t[1]][1]],[pts[t[2]][0],h,pts[t[2]][1]],0,1,0,C)});n++});
    if(pos.length/3>v0)spans.push([v0,pos.length/3,p.i])});
  var g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));g.setAttribute("normal",new THREE.Float32BufferAttribute(nor,3));g.setAttribute("color",new THREE.Float32BufferAttribute(col,3));
  return {geom:g,n:n,spans:spans,byI:byI}}
/* v280 - which building a hit triangle belongs to (spans are in vertex order) */
function spanOf(spans,v){var lo=0,hi=spans.length-1;while(lo<=hi){var m=(lo+hi)>>1;if(v<spans[m][0])hi=m-1;else if(v>=spans[m][1])lo=m+1;else return spans[m][2]}return null}
function tapAt(o,x,y){if(S.state!=="blocks"||!S.mesh)return null;var THREE=o.THREE,ray=new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(x/innerWidth*2-1,-(y/innerHeight)*2+1),o.cam);var h=ray.intersectObject(S.mesh,false)[0];
  return h&&h.faceIndex!=null?spanOf(S.spans,h.faceIndex*3):null}
function tapCard(i){var f=S.byI&&S.byI[i],TC=window.__tapcards,DK=window.__tcPanel;if(!f||!TC||!DK)return;var p=f.properties||{},blk={n:p.n,h:p.h,hs:p.hs,a:p.a},my=++S.tap;
  var paint=function(m,page){DK.show(TC.html(m,{page:page?"/building/"+CFG.slug+"/"+i+"?key="+encodeURIComponent(CFG.key||"")+(window.__RKQ||""):""}));window.__lastTapcard=m};
  paint(TC.plain(blk),false);
  TC.card(CFG.slug,i,f.geometry,blk,CFG.key||"").then(function(m){if(my!==S.tap||m.kind==="fallback"){window.__lastTapcard=m;return}paint(m,m.page)}).catch(function(){})}
function pill(msg,t){if(!msg)return;msg.textContent=t;msg.style.cssText="position:fixed;inset:auto;left:50%;bottom:calc(84px + env(safe-area-inset-bottom));transform:translateX(-50%);display:block;padding:6px 12px;border-radius:999px;background:rgba(19,31,29,.9);border:1px solid rgba(197,165,106,.4);color:#C5A56A;font:12px 'IBM Plex Mono',monospace;letter-spacing:.04em;white-space:nowrap;pointer-events:none;z-index:9"}
// the camera: from the URL (the spot she was looking at on the map), else from the south over the whole district like /blocks
function place(o,F){var THREE=o.THREE,cam=o.cam,ctl=o.ctl,q=null;try{q=tbCamFromParams(new URLSearchParams(location.search))}catch(e){}
  var b=S.box,w=b.max.x-b.min.x,d=b.max.z-b.min.z,tgt,dist,bear,pitch;
  if(q){var s=toScene(F,q.lon,q.lat);tgt=new THREE.Vector3(s[0],0,s[1]);dist=tbDistForZoom(q.zoom,q.lat,innerHeight);bear=q.bearing;pitch=q.pitch;ctl.autoRotate=false;S.cam=q}
  else{tgt=new THREE.Vector3((b.min.x+b.max.x)/2,0,(b.min.z+b.max.z)/2);var asp=innerWidth/Math.max(1,innerHeight),t24=Math.tan(24*Math.PI/180);
    dist=Math.max(d/(2*t24),w/(2*t24*asp))*1.1;bear=0;pitch=(innerWidth<560&&innerHeight>innerWidth)?50:55}
  dist=Math.max(60,dist);var th=(bear+180)*Math.PI/180,pr=pitch*Math.PI/180;
  cam.position.set(tgt.x+Math.sin(th)*dist*Math.sin(pr),tgt.y+dist*Math.cos(pr),tgt.z-Math.cos(th)*dist*Math.sin(pr));
  ctl.target.copy(tgt);cam.lookAt(tgt);ctl.update();S.held=true}
window.__twinBlocksMount=function(o){if(!CFG.have||!o||!o.THREE){S.state="off";return}var THREE=o.THREE;
  fetch("/img/blocks_"+CFG.slug).then(function(r){if(!r.ok)throw new Error("status "+r.status);return r.json()}).then(function(fc){
    if(S.state==="handed")return;   // the tile beat the blocks: nothing to draw
    var F=frameOf(fc),made=build(THREE,fc,F);if(!made.n)throw new Error("no blocks");
    var mesh=new THREE.Mesh(made.geom,new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:0.9,metalness:0,side:THREE.DoubleSide}));
    mesh.castShadow=true;mesh.receiveShadow=true;var group=new THREE.Group();group.name="tb_blocks";group.add(mesh);
    S.box=new THREE.Box3().setFromObject(group);var R=Math.max(S.box.max.x-S.box.min.x,S.box.max.z-S.box.min.z);
    var ground=new THREE.Mesh(new THREE.CircleGeometry(R*1.4,64),new THREE.MeshStandardMaterial({color:GROUND,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.set((S.box.min.x+S.box.max.x)/2,-0.3,(S.box.min.z+S.box.max.z)/2);ground.receiveShadow=true;group.add(ground);
    o.scene.add(group);S.group=group;S.ground=ground;S.F=F;S.n=made.n;S.mesh=mesh;S.spans=made.spans;S.byI=made.byI;
    /* v280 - a tap on a block (a tap, not a drag; on the model, not on the chrome) shows its card */
    var pd=null,cv=o.ren&&o.ren.domElement;
    addEventListener("pointerdown",function(e){pd=[e.clientX,e.clientY]});
    addEventListener("pointerup",function(e){var d=pd;pd=null;if(!d||Math.hypot(e.clientX-d[0],e.clientY-d[1])>6||S.state!=="blocks")return;
      if(cv&&e.target!==cv)return;var i=tapAt(o,e.clientX,e.clientY);if(i==null){if(window.__tcPanel)window.__tcPanel.hide();return}tapCard(i)});
    if(o.scene.fog){o.scene.fog.near=R*1.3;o.scene.fog.far=R*3.6}o.cam.far=Math.max(o.cam.far,R*8);o.cam.updateProjectionMatrix();
    place(o,F);pill(o.msg,made.n+" buildings · digital footprint, detail loading…");S.state="blocks";
  }).catch(function(e){S.state="off";S.err=String(e&&e.message||e)})};
window.__twinBlocks={
  // the detailed tile has landed (root is positioned and in the scene): take the blocks away and carry the camera across by
  // the difference between the two models' footprints, so what she was looking at stays under the same pixel
  tileArrived:function(root,THREE,cam,ctl){var held=S.held;
    if(S.group&&S.group.parent){try{var mb=new THREE.Box3().setFromObject(root),bb=S.box;
        var dx=(mb.min.x+mb.max.x)/2-(bb.min.x+bb.max.x)/2,dy=mb.min.y-bb.min.y,dz=(mb.min.z+mb.max.z)/2-(bb.min.z+bb.max.z)/2;
        if(held&&isFinite(dx)&&isFinite(dy)&&isFinite(dz)){cam.position.x+=dx;cam.position.y+=dy;cam.position.z+=dz;ctl.target.x+=dx;ctl.target.y+=dy;ctl.target.z+=dz;ctl.update();S.delta=[dx,dy,dz]}}catch(e){}
      S.group.parent.remove(S.group);S.group.traverse(function(m){if(m.geometry)m.geometry.dispose();if(m.material)m.material.dispose()})}
    S.state="handed";return held},
  holdsCamera:function(){return S.held},
  tapAt:function(o,x,y){return tapAt(o,x,y)},tap:function(i){tapCard(i)},   /* v280 */
  state:function(){return S}};
})();
`;

// ---- the city of blocks (/skyline?all=1) ----------------------------------------------------------------------------------------
// A plain script before the city's module. The module mounts it once its districts are built (window.__cityBlocksMount) and
// calls window.__cityArrive(slug) where it used to navigate at the end of a search fly.
export const CITY_BLOCKS_JS = String.raw`
/* v278 - the city of blocks keeps you: a search flies to the district and stays; zooming right in hands over, with the camera */
(function(){
"use strict";
` + SHARED_JS + String.raw`
var HAND=` + TB_CITY_HANDOVER_M + String.raw`,O=null,NAV=false;
function ix(slug){for(var k=0;k<O.D.districts.length;k++)if(O.D.districts[k].slug===slug)return k;return -1}
function near(){var t=O.ctl.target,best=-1,bd=1e9;O.D.districts.forEach(function(d,i){var dd=(d.x-t.x)*(d.x-t.x)+(d.z-t.z)*(d.z-t.z);if(dd<bd){bd=dd;best=i}});return bd<=2500*2500?best:-1}
// the city frame is UTM 40 N metres about D.origin (x = easting - e, z = -(northing - n)); the twin wants lon/lat + zoom
function camNow(){var c=O.cam.position,t=O.ctl.target,og=O.D.origin;if(!og||og.e==null)return null;
  var ll=utm40ToLl(t.x+og.e,og.n-t.z),dx=c.x-t.x,dy=c.y-t.y,dz=c.z-t.z,hd=Math.sqrt(dx*dx+dz*dz),dist=Math.sqrt(hd*hd+dy*dy);
  var bear=((Math.atan2(dx,-dz)*180/Math.PI-180)%360+360)%360,pitch=Math.atan2(hd,Math.max(1,dy))*180/Math.PI;
  return {lon:ll[0],lat:ll[1],zoom:Math.min(17,Math.max(13,tbZoomForDist(dist,ll[1],innerHeight))),bearing:bear,pitch:Math.min(70,pitch)}}
function go(i){if(NAV||i<0)return;NAV=true;var d=O.D.districts[i],cam=camNow();
  location.href="/skyline/"+d.slug+"?key="+encodeURIComponent(O.KEY||"")+(window.__RKQ||"")+(cam?tbCamToQuery(cam):"")}
window.__cityArrive=function(slug){if(!O)return;var i=ix(slug);if(i<0)return;O.labels.forEach(function(l,k){l.e.classList.toggle("on",k===i)});
  if(O.tipFor){O.tip.style.display="block";O.tip.innerHTML=O.tipFor(i)}};
window.__cityBlocksMount=function(o){O=o;
  o.ctl.addEventListener("change",function(){if(NAV)return;var d=o.cam.position.distanceTo(o.ctl.target);if(d<=HAND)go(near())})};
window.__cityBlocks={go:go,camNow:camNow};
})();
`;
