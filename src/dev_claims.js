// v414 - the developer's own launch material (data/developer_claims/*.json, bundled as src/dev_claims_data.js) for projects that are NOT on the project register.
// Everything here is DEVELOPER_CLAIMED: "developer says", with the source and the received date. Nothing is invented, nothing is a registered figure.
// Used by: the Project details panel (headline, Client and Broker buttons: DEVSAYS_JS below), the Client sheet built from a developer-says record (src/devsays_dossier.js),
// and the Broker sheet (src/devmap_pdf.js, the 'confirmed and developer says' note). Nothing here reads or writes KV.
//
// THE PICTURE PERMISSION GATE: a claims file carries render_permission {status, note, set_by, date}. A developer's render may be shown on any client-facing document
// (the Client sheet, the Broker sheet, any PDF the owner can send out) ONLY when status === "on_file". While it is "pending" the Client sheet is still built (a facts sheet)
// and says "Pictures withheld until the developer's written permission is on file." The render publisher (scripts/publish_dev_renders.py) refuses to write img_dev_render_* unless it is "on_file".
import { DEV_CLAIMS } from "./dev_claims_data.js";

export const PICTURES_WITHHELD = "Pictures withheld until the developer's written permission is on file.";
export const permissionOnFile = (c) => !!(c && c.render_permission && c.render_permission.status === "on_file");
export const claimsFor = (slug) => (DEV_CLAIMS[String(slug || "").toLowerCase().replace(/[^a-z0-9_-]/g, "")] || null);
export const allClaims = () => Object.values(DEV_CLAIMS);
export const nk = (s) => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]+/g, "");
export const money = (n) => Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// the lowest stated launch price: { aed, type, rows } (the cheapest row, whatever the type); null when the record states none
export function launchFrom(c) {
  const rows = c && c.price_from && Array.isArray(c.price_from.rows) ? c.price_from.rows.filter((r) => Number(r.from_aed) > 0) : [];
  if (!rows.length) return null;
  const lo = rows.reduce((a, r) => (r.from_aed < a.from_aed ? r : a), rows[0]);
  return { aed: lo.from_aed, type: lo.type, rows };
}
export const launchHeadline = (c) => { const l = launchFrom(c); return l ? "Launch price from AED " + money(l.aed) + " (developer says)" : ""; };
export const NOT_A_SALE = "Not a registered sale: no unit of this project has sold on the register";
export const receivedLong = (c) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(c && c.source && c.source.received || "")); const M = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]; return m ? Number(m[3]) + " " + M[Number(m[2]) - 1] + " " + m[1] : ""; };

// v416 - the position record of a claims file (the plot centre of the project's land parcel, the Dubai Municipality plot outline); null when the record has no valid position inside Dubai
export function positionOf(c) {
  const l = c && c.location;
  if (!l || !Array.isArray(l.plot_centroid) || l.plot_centroid.length !== 2) return null;
  const [lo, la] = l.plot_centroid;
  if (!(lo >= 54.5 && lo <= 56.6 && la >= 24 && la <= 25.6)) return null;
  return l;
}
// the Location line of a client sheet and an investor report (one wording, so the two cannot drift)
export function locationLine(l) {
  if (!l) return "";
  return "Location: " + l.master + ", " + l.area_name + "; plot " + l.plot + " (" + Number(l.area_sqm).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " m2). The position is the plot, not the building. Corroborated by the developer's listing on Google Maps.";
}

// the compact list the page loads (GET /developers_map_api?what=devsays): no pictures, no plan rows; only what the panel needs to name, price-head and route the project.
export function devsaysApi() {
  const p = [];
  for (const c of allClaims()) {
    const l = launchFrom(c), pr = c.project || {};
    if (!pr.name) continue;
    const row = { k: c.key, n: pr.name, b: pr.brand || "", f: l ? l.aed : 0, ft: l ? l.type : "", pid: pr.register_project_id || 0, i: pr.facts_id || "", r: receivedLong(c), x: ((c.renders || []).some((r) => r.exterior)) ? 1 : 0 };
    const lc = positionOf(c);   // v416 - the confirmed PLOT position (never a building): lon/lat of the plot centre, the plot ring, the plot facts and the corroboration distance
    if (lc) Object.assign(row, { pos: lc.plot_centroid, rg: lc.ring || [], pl: lc.plot, ar: lc.area_sqm, an: lc.area_name || "", ms: lc.master || "", g: lc.corroboration && lc.corroboration.distance_to_plot_centroid_m || 0, gs: lc.corroboration && lc.corroboration.source || "", lb: lc.label });
    p.push(row);
  }
  return { v: 1, p };
}

// ---------------------------------------------------------------------------------------------------------- the page module (String.raw, no backticks, no substitutions)
export const DEVSAYS_JS = String.raw`
var DEVSAYS=(function(){
  var D=null;
  function nk(s){return String(s==null?"":s).toLowerCase().replace(/[^a-z0-9]+/g,"")}
  function pk(s){return String(s==null?"":s).toLowerCase().replace(/\s+by\s+.*$/,"").replace(/[^a-z0-9]+/g,"")}
  function money(n){return String(Math.round(Number(n)||0)).replace(/\B(?=(\d{3})+(?!\d))/g,",")}
  function load(j){D=null;if(!j||!j.p||!j.p.length)return 0;D=j.p;return D.length}
  // the developer-says record of a card: never for a register-verified project; the name must match AND the brand (or the register project id) must agree
  function find(d){if(!D||!d||!d.name)return null;var e=d.ev||{};if(e.e==="REGISTER_VERIFIED")return null;var k=pk(d.name),i,x,b;
    for(i=0;i<D.length;i++){x=D[i];if(pk(x.n)!==k)continue;b=nk(e.br||e.dn||"");if((x.pid&&e.p!=null&&Number(e.p)===x.pid)||(b&&nk(x.b)&&(b===nk(x.b)||b.indexOf(nk(x.b))===0)))return x}
    return null}
  // the two lines under the panel title for a project with no price per area: the developer's launch price, and (only when nothing has sold) that it is not a sale
  function head(d){var x=find(d);if(!x||!x.f)return null;return {l1:"Launch price from AED "+money(x.f)+" (developer says)",l2:(d.n>0?"":"Not a registered sale: no unit of this project has sold on the register")}}
  // v416 - a PLOT POSITION for a project with no building outline (the confirmed plot centre; never a building). Ladder: after the register plot centre (PLOTPOS), before the community centre (COMMPOS).
  var SRC="dsloc",CUR=null,PEND=null;
  function e2(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
  function fm2(n){var s=Number(n).toFixed(2).split(".");return money(s[0])+"."+s[1]}
  function posOf(d){var x=find(d);return x&&x.pos&&x.pos.length===2&&typeof x.pos[0]==="number"&&typeof x.pos[1]==="number"?x:null}
  function has(d){return !!posOf(d)}
  function cardTag(d,ico){return has(d)?'<span class="tagl go">'+ico("map-pin","")+'Show on the map</span>':""}
  function why(d){var x=posOf(d);return x?"Plot position (parcel "+x.pl+"); the building outline is not on our map yet.":""}
  function rows(d,pdRow){var x=posOf(d);if(!x)return "";
    return pdRow("map-pin","Location",e2(x.an+", "+x.ms),"Dubai Municipality plot outline and the Dubai Land Department building and unit registers","DATA")
      +pdRow("map-pin","Plot","Plot "+e2(x.pl)+", "+fm2(x.ar)+" m2 (Dubai Municipality plot outline)","Dubai Municipality plot outline (Makani), parcel "+e2(String(x.pl).replace("-","")),"DATA")
      +pdRow("map-pin","Plot position","Plot position, not the building ("+x.pos[1].toFixed(5)+", "+x.pos[0].toFixed(5)+")","Centre of the plot outline, computed by us; the building outline is not on our map yet","DERIVED")
      +(x.g>0?pdRow("map-pin","Also seen on Google Maps","Also seen on Google Maps: pin about "+x.g+" m from the plot centre",e2(x.gs)+"; a third-party listing, used as corroboration only","THIRD_PARTY"):"")}
  function topVertex(rg){var t=null;(rg||[]).forEach(function(c){if(!t||c[1]>t[1])t=c});return t}
  function fc(x){if(!x)return {type:"FeatureCollection",features:[]};var f=[{type:"Feature",geometry:{type:"Point",coordinates:x.pos},properties:{k:"pt",label:"Plot position, not the building"}}],tv=topVertex(x.rg);
    if(x.rg&&x.rg.length>3){f.push({type:"Feature",geometry:{type:"LineString",coordinates:x.rg},properties:{k:"ln"}});if(tv)f.push({type:"Feature",geometry:{type:"Point",coordinates:tv},properties:{k:"ol",label:"plot outline, not the building"}})}
    return {type:"FeatureCollection",features:f}}
  function addLayers(map,font){if(!map||!map.addSource||map.getSource(SRC))return;
    map.addSource(SRC,{type:"geojson",data:fc(PEND)});
    map.addLayer({id:"ds-line",type:"line",source:SRC,filter:["==",["get","k"],"ln"],paint:{"line-color":"#ffffff","line-width":1.2,"line-opacity":0.9,"line-dasharray":[2,2]}});
    map.addLayer({id:"ds-dot",type:"circle",source:SRC,filter:["==",["get","k"],"pt"],paint:{"circle-radius":4,"circle-color":"#c5a56a","circle-stroke-color":"#0b0f0f","circle-stroke-width":1}});
    if(font){map.addLayer({id:"ds-lab",type:"symbol",source:SRC,filter:["==",["get","k"],"pt"],layout:{"text-field":["get","label"],"text-font":font,"text-size":11.5,"text-offset":[0,1.2],"text-anchor":"top","text-max-width":12},paint:{"text-color":"#f5efe2","text-halo-color":"#0b0f0f","text-halo-width":1.4}});
      map.addLayer({id:"ds-ol",type:"symbol",source:SRC,filter:["==",["get","k"],"ol"],layout:{"text-field":["get","label"],"text-font":font,"text-size":10.5,"text-offset":[0,-0.8],"text-anchor":"bottom","text-max-width":14},paint:{"text-color":"#f5efe2","text-halo-color":"#0b0f0f","text-halo-width":1.4}})}}
  function draw(map,x){PEND=x||null;if(!map)return;try{if(!map.getSource(SRC)&&map.isStyleLoaded&&map.isStyleLoaded())addLayers(map,null);var s=map.getSource&&map.getSource(SRC);if(s)s.setData(fc(x))}catch(err){}}
  function clear(map){CUR=null;draw(map,null)}
  // open(ctx): ctx = {map, d (the card record: name, ev), el (the detail panel), wide, collapse}; true when the plot position was drawn
  function open(ctx){var x=ctx?posOf(ctx.d):null;if(!x){if(CUR)clear(ctx&&ctx.map);return false}
    CUR=x.k;draw(ctx.map,x);
    if(ctx.wide<=760&&ctx.collapse)ctx.collapse();
    var map=ctx.map;if(map&&map.flyTo){var h=ctx.el&&ctx.el.offsetHeight?ctx.el.offsetHeight:0,hh=typeof innerHeight==="number"?innerHeight:800,
      pad=ctx.wide<=760?{top:40,left:30,right:30,bottom:Math.min(h||Math.round(hh*0.46),Math.round(hh*0.7))+20}:{top:60,left:60,right:460,bottom:60};
      try{map.flyTo({center:x.pos,zoom:17,padding:pad,duration:700})}catch(err){}}
    return true}
  function clientHref(x,key){return "/doc_client?keys="+encodeURIComponent("dev:"+x.k)+"&mode=buy&beds=all&key="+encodeURIComponent(key)}
  return {load:load,find:find,head:head,clientHref:clientHref,nk:nk,posOf:posOf,has:has,cardTag:cardTag,why:why,rows:rows,addLayers:addLayers,open:open,clear:clear,shown:function(){return CUR}}
})();
`;
