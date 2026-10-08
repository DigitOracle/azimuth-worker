// v406 - the map legend box "The five centres (our grouping)" is removed from the Developers by area map. Offline.   node test/test_v406_nolegend.mjs
import fs from "node:fs";
import { devmapHtml } from "../src/devmap_page.js";
import { CENTRES_CSS, CENTRES_JS } from "../src/centres2040_page.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 300) : "")); } };
const NOTE = "Our grouping of districts; the plan names the centres, not their boundaries", SRC = "Dubai 2040 Urban Master Plan, UAE Government, 13 Mar 2021";
const src = fs.readFileSync(new URL("../src/centres2040_page.js", import.meta.url), "utf8");
const dev = fs.readFileSync(new URL("../src/devmap_page.js", import.meta.url), "utf8");
const all = CENTRES_JS + CENTRES_CSS + src;

console.log("A - the legend box is gone");
ok(!/cenlg/.test(all), "no #cenlg element, style or handler in the centres module");
ok(!/The five centres \(our grouping\)/.test(all) && !/The five centres \(our grouping\)/.test(dev), "the legend title is not in the source");
ok(!/Solid colour: core and adjacent areas/.test(all) && !/Light tint: peripheral in our grouping/.test(all), "the two swatch rows are not in the source");
ok(!/legendHtml|drawLegend/.test(all), "no legend builder or drawLegend call remains in the centres module");
let page = "";
try { page = String(devmapHtml({})); } catch (e) { page = ""; }
ok(!/cenlg/.test(page) && !/The five centres \(our grouping\)/.test(page), "the rendered page carries no legend box");

console.log("B - the other legends and the five-centres layer are untouched");
ok(/id=maplg|"maplg"/.test(dev) && /Price bands \(tap one to filter\)/.test(dev), "the Price bands legend (maplg) is still there");
ok(/Dubai 2040: the five centres/.test(CENTRES_JS) && /cencards/.test(CENTRES_JS), "the 'Dubai 2040: the five centres' side section is still built");
ok(/CF\.refresh=function\(\)\{ensureBar\(\);drawBar\(\);/.test(CENTRES_JS) && /applyMode\(m\)/.test(CENTRES_JS), "refresh still redraws the bar and the map colours");

console.log("C - the attribution sentence is still in the sidebar");
ok(/var NOTE="Our grouping of districts; the plan names the centres, not their boundaries"/.test(CENTRES_JS) && /SRC="Dubai 2040 Urban Master Plan, UAE Government, 13 Mar 2021"/.test(CENTRES_JS), "the sentence and its source are still defined: " + NOTE.slice(0, 20));
const m = CENTRES_JS.match(/return '<div class=card id=cencards>[^\n]*/);
ok(m && /X\(NOTE\)/.test(m[0]) && /X\(SRC\)/.test(m[0]) && /Dubai 2040: the five centres/.test(m[0]), "the sidebar section 'Dubai 2040: the five centres' prints NOTE and Source");

ok(/S\.coast\?'<p class=note id=coastnote[^>]*>Sea coast within 500 m \(Najma.s own layer, not part of the plan\)<\/p>':''/.test(CENTRES_JS), "the coast note sits next to the switch and only while the layer is on (not in a map box)");
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
