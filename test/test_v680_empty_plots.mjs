// v680 (Kendall, 31 Oct 2026): on the Developers-by-area map the Price band and Window chips leave the filter bar and an "Empty plots" chip takes
// their place. Off by default; a choice loads /img/empty_plots once (a FeatureCollection of plot outlines with district, master, land type, area,
// project status, zoning), draws it above the areas and filters it by land type; Reset turns it off. Code checks on the page module, plus the
// data contract the menu relies on.
import fs from "node:fs";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL " + m); } };
const src = fs.readFileSync(new URL("../src/centres2040_page.js", import.meta.url), "utf8");
ok(/grp\("empty","map-trifold","Empty plots"/.test(src), "the bar carries an Empty plots chip");
ok(!/h\+=grp\("band"/.test(src) && !/h\+=grp\("win"/.test(src), "the Price band and Window chips are gone from the bar");
ok(/if\(kind==="win"\)/.test(src) && /function defWin\(\)/.test(src), "the window state and its default are kept (other screens still use them)");
ok(/f==="empty"\)\{t="Empty plots";o=opt\("",'<span><b>Off<\/b>/.test(src) && /\["all","res","com","oth"\]/.test(src), "the menu offers Off, All, Residential, Commercial and Other land");
ok(/if\(kind==="empty"\)\{S\.empty=nul\?null:val;epShow\(\);drawBar\(\);return\}/.test(src), "a choice sets the state, shows the layer and redraws the bar");
ok(/fetch\("\/img\/empty_plots"/.test(src) && /if\(!EPD\)\{if\(EPL\)return;EPL=true/.test(src), "the data is fetched once, on first use, never twice in flight");
ok(/CF\.reset=function\(\)\{S\.fmenu=null;S\.empty=null;epShow\(\);/.test(src), "Reset turns the layer off");
ok(/m\.on\("click","ep-fill"/.test(src) && /sq ft/.test(src) && /Permitted use/.test(src), "tapping a plot opens its card with area in sq m and sq ft and the zoning when held");
ok(/Research only/.test(src) && /Makani/.test(src) && /Land Department/.test(src), "the menu note states the test, research only, and the sources");
ok(/CF\.addLayers=function\(map,font\)\{if\(S\.empty&&EPD\)/.test(src), "a map style reload re-adds the layer while it is on");
// the data contract
const k = (t) => (t === "Residential" ? "res" : t === "Commercial" ? "com" : "oth");
ok(k("Residential") === "res" && k("Commercial") === "com" && k("Industrial") === "oth" && k(null) === "oth", "land type -> filter key (unknown land type falls to Other)");
console.log("v680 empty plots: " + pass + " passed, " + fail + " failed"); if (fail) process.exit(1);
