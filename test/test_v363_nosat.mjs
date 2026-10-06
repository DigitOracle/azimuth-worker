// v363 - NO SATELLITE IN MARKETING IMAGES (Kendall, 6 Oct 2026: never satellite images in anything client-facing).
// Proves the post-card, angle-card (square, story and /charts five-up) and client briefing hero generators in src/index.js no
// longer reference satellite imagery: no /img/sat_ url, no img_sat_ KV lookup, no Esri World Imagery credit.
// (The Studio only renders Esri VECTOR art styles, not imagery, and keeps its "basemap © Esri" credit.)
// NEGATIVE CONTROL: run this file against the base commit 23d22f6 (git show 23d22f6:src/index.js > src/index.js) - it fails.
//
//   node test/test_v363_nosat.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(HERE, "..", "src", "index.js"), "utf8");
let fails = 0;
const ok = (c, m) => { if (c) console.log("ok   " + m); else { fails++; console.log("FAIL " + m); } };

function body(startMarker, endMarker) {
  const a = src.indexOf(startMarker);
  if (a < 0) return null;
  const b = src.indexOf(endMarker, a + startMarker.length);
  return src.slice(a, b < 0 ? a + 8000 : b);
}
const BAD = [/\/img\/sat_/, /img_sat_/, /World Imagery/i, /Vantor|Earthstar/i, /imagery:\s*Esri/i];
const gens = {
  chPostcard: body("function chPostcard(", "\nfunction renderCharts("),
  angleCardHtml: body("async function angleCardHtml(", "\nfunction "),
  renderChartsAngles: body("function renderCharts(", "} else {"),
  renderReport: body("function renderReport(", "\nfunction renderStudio("),
};
for (const [name, code] of Object.entries(gens)) {
  ok(!!code && code.length > 200, name + " found");
  if (!code) continue;
  for (const re of BAD) ok(!re.test(code), name + " has no " + re);
}
ok(/#0A4F4A/.test(gens.chPostcard || ""), "post-card uses the flat brand teal panel");
ok(/bg_market/.test(gens.angleCardHtml || ""), "angle card falls back to the market background");
ok(/#0A4F4A/.test(gens.renderReport || ""), "briefing hero uses brand teal");

if (fails) { console.log(fails + " FAILED"); process.exit(1); }
console.log("all passed");
