// v636 - Developers-by-area fixes: (1) the open-accordion minus sign was written as a doubled backslash inside String.raw CSS, so the page printed 2212 behind a backslash instead of a minus;
// (2) a building row in the rental-listings panel flies the map to the building (rows with no position do nothing quietly).
import { devmapHtml } from "../src/devmap_page.js";
let pass = 0, fail = 0; const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 300) : "")); } };
const html = devmapHtml("k", { NAJ_FONTS: "" }), bs = String.fromCharCode(92);
ok(html.includes('.pfacc[open] summary:after{content:"' + bs + '2212"}'), "the open accordion's symbol is a single-backslash CSS escape");
ok(!html.includes(bs + bs + "2212"), "no doubled backslash before 2212 is left anywhere in the page");
ok(/function pfFly\(b\)/.test(html) && /pfFly\(b\);pfOpen\(/.test(html), "a building row calls pfFly before opening its listings (the expansion is kept)");
ok(/data-lon="'\+\(\+x\.it\.lon\)\+'" data-lat="'\+\(\+x\.it\.lat\)/.test(html), "rows carry data-lon / data-lat from the building's own position");
ok(/isFinite\(\+lo\)\|\|!isFinite\(\+la\)/.test(html.replace(/\s+/g, "")) || /!isFinite\(\+lo\)/.test(html), "a row with no position returns without moving the map");
// run pfFly against a fake map: valid position eases; missing position does nothing
const m = html.match(/function pfFly\(b\)\{[^\n]*?\}\s*(?=\/\/ v636)/); ok(!!m, "pfFly source found");
if (m) {
  const calls = []; const map = { easeTo: (o) => calls.push(o), getZoom: () => 11 }; globalThis.innerWidth = 1200;
  const fn = new Function("map", "innerWidth", m[0] + ";return pfFly;")(map, 1200);
  fn({ getAttribute: (n) => ({ "data-lon": "55.27", "data-lat": "25.19" })[n] ?? null });
  ok(calls.length === 1 && calls[0].center[0] === 55.27 && calls[0].zoom === 15, "a row with a position eases the map to it at zoom 15", JSON.stringify(calls));
  fn({ getAttribute: () => null }); fn({ getAttribute: (n) => ({ "data-lon": "x", "data-lat": "25" })[n] ?? null });
  ok(calls.length === 1, "rows with no (or bad) position do nothing");
}
// v636 - the light/dark switch rebuilds the page's own layers (diff:false makes MapLibre fire style.load again), so the Places cards and every overlay survive it
ok(html.includes('map.setStyle(u,{diff:false})') && html.includes('map.once("style.load",buildLayers)'), "the theme switch swaps the style without a diff and rebuilds the layers");
// v636 - the project / building pop-up is switched off on every path (code kept behind NOPOP)
ok(html.includes('var NOPOP=(typeof location!=="undefined"&&typeof location.search==="string"&&!/[?&]popup=1(&|$)/.test(location.search));'), "NOPOP is on for every page load unless the address carries ?popup=1");
{ const expr = html.match(/var NOPOP=(\(.*?\));\s*\/\/ v636/)[1], run = (loc) => new Function("location", "return " + expr)(loc);
  ok(run({ search: "" }) === true && run({ search: "?key=x" }) === true, "in a real page (it has a location) the pop-up is off");
  ok(run({ search: "?key=x&popup=1" }) === false && run({ search: "?popup=1" }) === false, "?popup=1 in the address brings the pop-up back");
  ok(run(undefined) === false, "the offline tests (no location) still exercise the pop-up code"); }
ok(/function pdOpen\(dk,from\)\{if\(NOPOP\)return false;/.test(html), "pdOpen (the project details card, every row/search trigger) returns before building anything");
ok(/function showSnap\(p,pin\)\{var el=\$\("bsnap"\);if\(!el\)return;if\(NOPOP\)\{hideSnap\(\);return\}/.test(html), "showSnap (the map hover tip and the pinned card) never opens");
// v636 - the Reset pill in the top filter bar
ok(html.includes('data-f="reset"') && html.includes("<span class=fl>Reset</span>") && html.includes("#fbar #freset{order:5}"), "the filter bar carries a Reset pill with an inline SVG icon");
ok(html.includes('if(k2==="reset"){CF.reset();return}') && html.includes("CF.reset=function(){"), "the pill calls CF.reset");
ok(/CF\.reset=function\(\)\{S\.fmenu=null;S\.empty=null;epShow\(\);S\.cen=null;S\.coast=false;[^]*S\.band=null;[^]*S\.sel=null;[^]*S\.parea=null;[^]*S\.prof=null;[^]*c\.resetExtra\(\)[^]*c\.setWin\(defWin\(\)\)[^]*m\.flyTo\(\{center:DEF,zoom:9\.6/.test(html), "reset clears centre, coastal, developer, area, band, window and flies to the default view");
console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
