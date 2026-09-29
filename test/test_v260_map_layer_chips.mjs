// v260 - two new /map chips, SUB-COMMUNITIES and PROPERTIES, both default off so the map opens empty.
// NEGATIVE CONTROL: revert the ON.plot swap on the addData() forEach line back to PLOTSON and run this file -
// assertion 6 must fail. Verified by doing so.
import { readFileSync } from "node:fs";
const SRC = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
let pass = 0, fail = 0;
const ok = (c, w) => { if (c) { pass++; console.log("  ok - " + w); } else { fail++; console.log("  FAIL - " + w); } };

// 1. icons exist for both new chips
ok(/"sub":\s*"<svg/.test(SRC), "MAP_ICONS has a sub icon");
ok(/"plot":\s*"<svg/.test(SRC), "MAP_ICONS has a plot icon");

// 2. the six default-hidden layer sites all carry visibility:none
const hideSites = [
  /addLayer\(\{id:"sub-bub",type:"circle",source:"subs",layout:\{"visibility":"none"\}/,
  /addLayer\(\{id:"sub-lab",type:"symbol",source:"subs",minzoom:12\.4,layout:\{"visibility":"none"/,
  /addLayer\(\{id:"plot-dot",type:"circle",source:"plots",minzoom:13\.5,layout:\{"visibility":"none"\}/,
  /addLayer\(\{id:"plot-lab",type:"symbol",source:"plots",minzoom:15\.4,layout:\{"visibility":"none"/,
];
hideSites.forEach((re, i) => ok(re.test(SRC), "layer-hide site " + (i + 1) + " of 4 (first sub/plot pair) carries visibility:none"));

// 3. the two new chips are prepended before the AMEN loop, with stable data-k values
const chipIdx = SRC.indexOf('h+=\\\'<div class=a data-k="sub"');
ok(chipIdx > 0, "SUB-COMMUNITIES chip HTML is built");
ok(SRC.indexOf('h+=\\\'<div class=a data-k="plot"') > chipIdx, "PROPERTIES chip HTML follows it, in order");
const amenLoopIdx = SRC.indexOf("Object.keys(AMEN).forEach(function(k){h+=");
ok(chipIdx < amenLoopIdx && amenLoopIdx > 0, "both new chips are emitted BEFORE the existing AMEN chip loop (hierarchy order)");

// 4. the click handler skips listKind() for sub/plot, so toggling them never opens an amenity list panel
ok(/if\(k==="sub"\|\|k==="plot"\)return;if\(ON\[k\]\)listKind\(k\)/.test(SRC), "click handler returns before listKind() for sub/plot");

// 5. drawAm() syncs the layers to ON.sub / ON.plot every redraw (not a one-time hide), independently -
//    no auto-hide-when-any-amenity-on logic should exist (that spec was superseded)
ok(/\["sub-bub","sub-lab"\]\.forEach\(function\(id\)\{if\(map\.getLayer\(id\)\)map\.setLayoutProperty\(id,"visibility",ON\.sub\?"visible":"none"\)\}\)/.test(SRC),
   "drawAm() syncs sub-bub/sub-lab to ON.sub on every redraw");
ok(/\["plot-dot","plot-lab","plot-name"\]\.forEach\(function\(id\)\{if\(map\.getLayer\(id\)\)map\.setLayoutProperty\(id,"visibility",ON\.plot\?"visible":"none"\)\}\)/.test(SRC),
   "drawAm() syncs plot-dot/plot-lab/plot-name to ON.plot on every redraw");
ok(!/any=Object\.keys\(ON\)\.some/.test(SRC), "the superseded auto-hide-when-any-amenity-on rule is NOT present");

// 6. the addData() plot-name trio (the naj-plots pair the video session flagged) is driven by ON.plot, not
//    the dead PLOTSON (localStorage key nothing ever writes) - this is the one the negative control targets
ok(/\["plot-dot","plot-lab","plot-name"\]\.forEach\(function\(id\)\{if\(!ON\.plot\)map\.setLayoutProperty\(id,"visibility","none"\)\}\)/.test(SRC),
   "addData()'s plot-dot/plot-lab/plot-name trio is gated on ON.plot");
ok(!/if\(!PLOTSON\)map\.setLayoutProperty/.test(SRC), "the dead PLOTSON check is gone from that line");

// 7. ordering inside drawAm(): the new sync/count block runs AFTER `var ref=refPoint();...AMEN...` (so ref
//    and dd already exist), and BEFORE the trailing `if(SEL)openPanel(SEL);}` - never before either
const refIdx = SRC.indexOf("var ref=refPoint();Object.keys(AMEN)");
const subSyncIdx = SRC.indexOf('["sub-bub","sub-lab"].forEach(function(id){if(map.getLayer(id))');
const openPanelIdx = SRC.indexOf("if(SEL)openPanel(SEL);}");
ok(refIdx > 0 && subSyncIdx > refIdx, "the new sync block runs after ref/dd are assigned, not before");
ok(openPanelIdx > subSyncIdx && openPanelIdx > 0, "the new sync block runs before the trailing openPanel call");

// 8. the count block for sub/plot reads from SUBS/PLOTS feature collections, not AM.items (a different
//    data source than every other amenity chip)
ok(/\[\["sub",SUBS\],\["plot",PLOTS\]\]\.forEach\(function\(pair\)/.test(SRC), "sub/plot counts iterate [SUBS, PLOTS], not AM.items");
ok(/var g=ft\.geometry&&ft\.geometry\.coordinates;if\(!g\)return;var i=\{lon:g\[0\],lat:g\[1\]\}/.test(SRC),
   "GeoJSON geometry.coordinates is mapped to the {lon,lat} shape inArea/inDist expect");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
