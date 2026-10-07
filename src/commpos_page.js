// v387 - COMMUNITY CENTRES on the Developers-by-area page (the data is src/commpos.js + KV img_community_positions).
// THE LADDER, highest first: building outline (the page's own match) > plot centre (PLOTPOS, by register project number) > community centre (this module, by card key district|pkey(name)) > nothing.
// A card with neither a building outline nor a plot centre, whose own community is in the file, becomes "Show on the map": the map flies to the community at a wide zoom, draws a DASHED RING with a
// community-wide HALO (line layers only: never a pin, never a footprint, never a fill) and the Project details panel opens with the label and the DERIVED tag.
// A community-centre marker is the middle of the community. It is NOT the project and NOT the building, and the panel says so in words. When a better rung appears (an outline, a plot centre) the card
// moves up by itself: this module answers nothing for a card PLOTPOS already has.
// The page script gets this module ahead of its own script (COMMPOS_JS defines the global COMMPOS); src/devmap_page.js calls it through a handful of guarded hooks
// (every hook is typeof COMMPOS !== "undefined", and every answer is empty without data, so an old page, an absent file or a test stub changes nothing: v386 behaviour exactly).
//
// String.raw, no substitutions and no backticks (the rule src/devmap_page.js keeps); checked with node --check by test/test_v387_ladder.mjs.
export const COMMPOS_CSS = String.raw`.pjc.noloc.comm{opacity:1;border-style:dashed;border-color:var(--gold)}.pjc.noloc.comm:focus-visible,.pjc.noloc.comm:hover{background:#1c2827}`;

export const COMMPOS_JS = String.raw`
var COMMPOS=(function(){
  var C={},P={},CUR=null,PEND=null,SRC="commpos";
  function e2(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
  function pk(n){var s=String(n||"").toLowerCase().replace(/\s+by\s+.*$/,"");return s.replace(/[^a-z0-9؀-ۿ]+/g,"")}
  function key(slug,name){var k=pk(name);return slug&&k?slug+"|"+k:""}
  function load(d){C={};P={};CUR=null;if(!d||typeof d!=="object"||!d.c||typeof d.c!=="object"||!d.p||typeof d.p!=="object")return 0;
    Object.keys(d.c).forEach(function(k){var x=d.c[k];if(x&&typeof x.lon==="number"&&typeof x.lat==="number"&&x.evidence==="DERIVED"&&x.basis==="community_polygon")C[k]=x});
    var n=0;Object.keys(d.p).forEach(function(k){var x=d.p[k];if(x&&C[x.c]&&typeof x.l==="string"&&x.l){P[k]=x;n++}});return n}
  // a card that PLOTPOS already positions is higher on the ladder: no answer here
  function higher(ev){return typeof PLOTPOS!=="undefined"&&PLOTPOS.has&&PLOTPOS.has(ev)}
  function get(slug,name,ev){if(higher(ev))return null;var x=P[key(slug,name)];if(!x)return null;var c=C[x.c];return {lon:c.lon,lat:c.lat,bb:c.bb||null,km2:c.area_km2||null,label:x.l,evidence:"DERIVED",basis:"community_polygon",area:x.a||"",pn:x.pn||"",community:c.n||""}}
  function has(slug,name,ev){return !!get(slug,name,ev)}
  function why(d){var x=d?get(d.slug,d.name,d.ev):null;return x?x.label+" The marker shows the middle of the community, not the building.":""}
  function cardTag(slug,name,ev,ico){return has(slug,name,ev)?'<span class="tagl go">'+ico("map-pin","")+'Show on the map</span>':""}
  function rows(d,pdRow){var x=d?get(d.slug,d.name,d.ev):null;if(!x)return "";
    var sz=x.km2?" The community covers about "+(x.km2>=10?Math.round(x.km2):x.km2.toFixed(1))+" square km.":"";
    return pdRow("map-pin","Community centre",e2(x.label)+" ("+x.lat.toFixed(5)+", "+x.lon.toFixed(5)+")","Dubai Municipality community outline; the point is the middle of the community, computed by us. It is NOT the project and NOT the building."+sz,"DERIVED")
      +'<div class="pdr"><div><b>A community-centre marker is NOT the building.</b><span class="note pds">It shows which community the project is registered in. The exact plot is not in our data yet.</span></div></div>'}
  function ring(lon,lat,r,n){var kx=111320*Math.cos(lat*Math.PI/180),ky=110574,a=[],i;for(i=0;i<=n;i++){var t=2*Math.PI*i/n;a.push([+(lon+r*Math.cos(t)/kx).toFixed(6),+(lat+r*Math.sin(t)/ky).toFixed(6)])}return a}
  function radii(x){var bb=x.bb,w=500,h=500;if(bb&&bb.length===4){w=(bb[2]-bb[0])*111320*Math.cos(x.lat*Math.PI/180);h=(bb[3]-bb[1])*110574}var m=Math.max(1,Math.min(w,h));
    return {ring:Math.max(150,Math.min(700,m*0.08)),halo:Math.max(500,Math.min(4000,m*0.35))}}
  function fc(x){if(!x)return {type:"FeatureCollection",features:[]};var r=radii(x);
    return {type:"FeatureCollection",features:[
      {type:"Feature",geometry:{type:"LineString",coordinates:ring(x.lon,x.lat,r.halo,64)},properties:{k:"halo"}},
      {type:"Feature",geometry:{type:"LineString",coordinates:ring(x.lon,x.lat,r.ring,40)},properties:{k:"ring"}},
      {type:"Feature",geometry:{type:"Point",coordinates:[x.lon,x.lat]},properties:{k:"lab",label:"Community centre, not the building"}}]}}
  function addLayers(map,font){if(!map||!map.addSource||map.getSource(SRC))return;
    map.addSource(SRC,{type:"geojson",data:fc(PEND)});
    map.addLayer({id:"cp-halo",type:"line",source:SRC,filter:["==",["get","k"],"halo"],paint:{"line-color":"#c5a56a","line-width":10,"line-blur":8,"line-opacity":0.28}});
    map.addLayer({id:"cp-haloline",type:"line",source:SRC,filter:["==",["get","k"],"halo"],paint:{"line-color":"#c5a56a","line-width":1.2,"line-opacity":0.75,"line-dasharray":[1,3]}});
    map.addLayer({id:"cp-ring",type:"line",source:SRC,filter:["==",["get","k"],"ring"],paint:{"line-color":"#ffffff","line-width":2.6,"line-opacity":0.95,"line-dasharray":[2,2]}});
    if(font)map.addLayer({id:"cp-lab",type:"symbol",source:SRC,filter:["==",["get","k"],"lab"],layout:{"text-field":["get","label"],"text-font":font,"text-size":11.5,"text-offset":[0,0],"text-anchor":"center","text-max-width":12},paint:{"text-color":"#f5efe2","text-halo-color":"#0b0f0f","text-halo-width":1.4}})}
  function draw(map,x){PEND=x||null;if(!map)return;try{if(!map.getSource(SRC)&&map.isStyleLoaded&&map.isStyleLoaded())addLayers(map,null);var s=map.getSource&&map.getSource(SRC);if(s)s.setData(fc(x))}catch(err){}}
  function clear(map){CUR=null;draw(map,null)}
  function zoomFor(x,wide){var bb=x.bb,vw=Math.max(300,(typeof wide==="number"?wide:400)),z=13;
    if(bb&&bb.length===4){var span=Math.max(0.002,Math.max(bb[2]-bb[0],(bb[3]-bb[1])*1.1));z=Math.log(0.7*vw*360/(512*span))/Math.LN2}
    return Math.max(11,Math.min(14.5,Math.round(z*10)/10))}
  // open(ctx): ctx = {map, slug, name, ev, el (the detail panel), wide (window width), collapse}; true when a community marker was drawn
  function open(ctx){var x=ctx?get(ctx.slug,ctx.name,ctx.ev):null;if(!x){if(CUR)clear(ctx&&ctx.map);return false}
    CUR=key(ctx.slug,ctx.name);draw(ctx.map,x);
    if(ctx.wide<=760&&ctx.collapse)ctx.collapse();
    var map=ctx.map;if(map&&map.flyTo){var h=ctx.el&&ctx.el.offsetHeight?ctx.el.offsetHeight:0,hh=typeof innerHeight==="number"?innerHeight:800,
      pad=ctx.wide<=760?{top:40,left:30,right:30,bottom:Math.min(h||Math.round(hh*0.46),Math.round(hh*0.7))+20}:{top:60,left:60,right:460,bottom:60};
      try{map.flyTo({center:[x.lon,x.lat],zoom:zoomFor(x,ctx.wide),padding:pad,duration:800})}catch(err){}}
    return true}
  return {load:load,key:key,get:get,has:has,why:why,cardTag:cardTag,rows:rows,addLayers:addLayers,open:open,clear:clear,count:function(){return Object.keys(P).length},shown:function(){return CUR}}
})();
`;
