// v397c - COMMUNITY CENTRES BY REGISTER PROJECT NUMBER on the Developers-by-area page (data: src/commpos_p.js + KV img_community_positions_p).
// The v387 module (COMMPOS) answers for a card by its key district|name. A project with no card of its own (the no-sales group, the facts, a search result) or a card with no entry in that file has a
// register project number (ev.p) and nothing else to find it by. This module answers by that number: COMMPOSP.get(ev) returns the same record COMMPOS.get returns, so the card tag, the "why" line,
// the detail rows, the dashed ring and the fly-to all work unchanged. THE LADDER is untouched: a building outline wins (the page), a plot centre wins (COMMPOS.get asks PLOTPOS first), the card key
// wins over the project number, and this module only answers last.
// The only hook is one guarded line in COMMPOS.get (typeof COMMPOSP !== "undefined"); absent data answers null; absent module or absent file = v395 exactly.
// String.raw, no substitutions and no backticks; checked with node --check by test/test_v397c_commrung.mjs.
export const COMMPOSP_JS = String.raw`
var COMMPOSP=(function(){
  var C={},P={};
  function load(d){C={};P={};if(!d||typeof d!=="object"||!d.c||typeof d.c!=="object"||!d.p||typeof d.p!=="object")return 0;
    Object.keys(d.c).forEach(function(k){var x=d.c[k];if(x&&typeof x.lon==="number"&&typeof x.lat==="number"&&x.evidence==="DERIVED"&&x.basis==="community_polygon")C[k]=x});
    var n=0;Object.keys(d.p).forEach(function(k){var x=d.p[k];if(/^p:[0-9]+$/.test(k)&&x&&C[x.c]&&typeof x.l==="string"&&x.l){P[k]=x;n++}});return n}
  function entry(ev){if(!ev||ev.p==null||ev.p==="")return null;var s=String(ev.p).trim();return /^[0-9]+$/.test(s)?(P["p:"+s]||null):null}
  function get(ev){var x=entry(ev);if(!x)return null;var c=C[x.c];return {lon:c.lon,lat:c.lat,bb:c.bb||null,km2:c.area_km2||null,label:x.l,evidence:"DERIVED",basis:"community_polygon",area:x.a||"",pn:String(ev.p),community:c.n||""}}
  return {load:load,get:get,has:function(ev){return !!entry(ev)},count:function(){return Object.keys(P).length}}
})();
`;
