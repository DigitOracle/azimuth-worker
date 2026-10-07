// v386 - PLOT POSITIONS on the Developers-by-area page (the data is src/plotpos.js + KV img_plot_positions).
// A project card with NO building outline on our map used to open only the Project details panel. When the register ties the project to land parcels whose Dubai Municipality outline we hold,
// the file carries the CENTRE OF THE REGISTERED PLOT, and the card becomes "Show on the map": the map flies to the plot, draws a MARKER (a hollow white ring with a gold centre dot and the words
// "Plot position, not a building" - never a footprint, never a fill) and the Project details panel opens with the position line, its label and the DERIVED tag.
// Evidence: the project-to-parcel link is REGISTER_VERIFIED (Land Department land registry), the position is DERIVED (centre of the outline, computed by us). A plot centre is never presented as a building.
// The page script gets this module ahead of its own script (PLOTPOS_JS defines the global PLOTPOS); src/devmap_page.js calls it through a handful of guarded hooks
// (every hook is typeof PLOTPOS !== "undefined", and every answer is empty without data, so an old page, an absent file or a test stub changes nothing).
//
// String.raw, no substitutions and no backticks (the rule src/devmap_page.js keeps); checked with node --check by test/test_v386_plots.mjs.
export const PLOTPOS_CSS = String.raw`.pjc.noloc.plot{opacity:1;border-color:var(--gold)}.pjc.noloc.plot:focus-visible,.pjc.noloc.plot:hover{background:#1c2827}`;

export const PLOTPOS_JS = String.raw`
var PLOTPOS=(function(){
  var P={},CUR=null,PEND=null,SRC="plotpos";
  function e2(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
  function load(d){P={};CUR=null;if(!d||typeof d!=="object"||!d.p||typeof d.p!=="object")return 0;var n=0;
    Object.keys(d.p).forEach(function(k){var x=d.p[k];if(x&&typeof x.lon==="number"&&typeof x.lat==="number"&&x.evidence==="DERIVED"&&x.label){P[k]=x;n++}});return n}
  function get(ev){if(!ev||ev.p==null||ev.p==="")return null;return P[String(ev.p)]||null}
  function has(ev){return !!get(ev)}
  function why(ev){var x=get(ev);return x?x.label:""}
  function cardTag(ev,ico){return has(ev)?'<span class="tagl go">'+ico("map-pin","")+'Show on the map</span>':""}
  function rows(ev,pdRow){var x=get(ev);if(!x)return "";var ids=(x.parcels||[]).join(", "),n=x.n_plots||(x.parcels||[]).length||0;
    return pdRow("map-pin","Plot position",e2(x.label)+" ("+x.lat.toFixed(5)+", "+x.lon.toFixed(5)+")","Dubai Municipality plot outline; the centre is computed by us, it is not a surveyed building point","DERIVED")
      +pdRow("stack","Project to plot link",n+" registered land parcel"+(n===1?"":"s")+(ids?": "+e2(ids):""),"Dubai Land Department land registry (the project is registered on "+(n===1?"this parcel":"these parcels")+")","REGISTER_VERIFIED")}
  function fc(x){return {type:"FeatureCollection",features:x?[{type:"Feature",geometry:{type:"Point",coordinates:[x.lon,x.lat]},properties:{label:"Plot position, not a building"}}]:[]}}
  function addLayers(map,font){if(!map||!map.addSource||map.getSource(SRC))return;
    map.addSource(SRC,{type:"geojson",data:fc(PEND)});
    map.addLayer({id:"pp-ring",type:"circle",source:SRC,paint:{"circle-radius":15,"circle-color":"#ffffff","circle-opacity":0,"circle-stroke-color":"#ffffff","circle-stroke-width":3,"circle-stroke-opacity":0.95}});
    map.addLayer({id:"pp-dot",type:"circle",source:SRC,paint:{"circle-radius":3.5,"circle-color":"#c5a56a","circle-stroke-color":"#0b0f0f","circle-stroke-width":1}});
    if(font)map.addLayer({id:"pp-lab",type:"symbol",source:SRC,layout:{"text-field":["get","label"],"text-font":font,"text-size":11.5,"text-offset":[0,1.9],"text-anchor":"top","text-max-width":12},paint:{"text-color":"#f5efe2","text-halo-color":"#0b0f0f","text-halo-width":1.4}})}
  function draw(map,x){PEND=x||null;if(!map)return;try{if(!map.getSource(SRC)&&map.isStyleLoaded&&map.isStyleLoaded())addLayers(map,null);var s=map.getSource&&map.getSource(SRC);if(s)s.setData(fc(x))}catch(err){}}
  function clear(map){CUR=null;draw(map,null)}
  // open(ctx): ctx = {map, ev, el (the detail panel), wide (window width), collapse (function that folds the sheet on a phone)}; true when a plot marker was drawn
  function open(ctx){var x=get(ctx&&ctx.ev);if(!x){if(CUR)clear(ctx&&ctx.map);return false}
    CUR=String(ctx.ev.p);draw(ctx.map,x);
    if(ctx.wide<=760&&ctx.collapse)ctx.collapse();
    var map=ctx.map;if(map&&map.flyTo){var h=ctx.el&&ctx.el.offsetHeight?ctx.el.offsetHeight:0,hh=typeof innerHeight==="number"?innerHeight:800,
      pad=ctx.wide<=760?{top:40,left:30,right:30,bottom:Math.min(h||Math.round(hh*0.46),Math.round(hh*0.7))+20}:{top:60,left:60,right:460,bottom:60};
      try{map.flyTo({center:[x.lon,x.lat],zoom:16.5,padding:pad,duration:700})}catch(err){}}
    return true}
  return {load:load,get:get,has:has,why:why,cardTag:cardTag,rows:rows,addLayers:addLayers,open:open,clear:clear,count:function(){return Object.keys(P).length},shown:function(){return CUR}}
})();
`;
