// v550 - EV and petrol station names in the twin: the building's register name when the station stands on a named footprint, else DEWA's
// label without its area prefix; the connector code never shows. Rows and tag share the rule. (Kendall 12 Oct 2026, film session)
import fs from "node:fs";
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x)); } };
const src = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const a = src.indexOf("let AMCB=false;"), b = src.indexOf("\nfunction amTagDraw", a);
let js = src.slice(a, b).replace(/\\\\/g, "\\");
// stand-ins for the page: one named footprint at the station, none elsewhere
const f = new Function("llx", "nearestInst", "instItem", "CB", js + "\nreturn { amClean, amExtra, amLabel };");
const named = f((lon, lat) => [lon, lat], (x) => (x === 55.14 ? 7 : -1), (j) => (j === 7 ? { n: "Marina Arcade Tower" } : null), { items: [1] });
const ev = { k: "ev", n: "J.ALI-Marina Arcade Tower", x: "DEWA · 2 bays · 62196-2", lon: 55.14, lat: 25.08 };
const l1 = named.amLabel(ev);
ok(l1.n === "Marina Arcade Tower" && l1.x === "DEWA · 2 bays", "on a named footprint: our building name; the DEWA label adds nothing, so it is not repeated; no connector code", l1);
const l2 = named.amLabel(Object.assign({}, ev, { lon: 55.2, n: "J.ALI-Jumeirah Lakes Parking B" }));
ok(l2.n === "Jumeirah Lakes Parking B" && !/62196/.test(l2.x), "no footprint match: DEWA's label without its area prefix", l2);
const l3 = named.amLabel(Object.assign({}, ev, { n: "BUR-Station 4" }));
ok(l3.n === "Marina Arcade Tower" && /Station 4/.test(l3.x), "a DEWA label that says something else falls to the second line", l3);
ok(named.amLabel({ k: "hotel", n: "J.ALI-Something", x: "5 star" }).n === "J.ALI-Something", "other kinds are untouched");
ok(named.amExtra({ x: "DEWA · Type 2 · 3 bays · 62196" }) === "DEWA · 3 bays", "connector types and codes are dropped");
ok(/const lb=amLabel\(i\),k1=String\(lb\.n/.test(src) && /const lb=amLabel\(i\);return'<div class=amrow/.test(src), "the tag and the panel rows both use the rule");
console.log(`v550 station names: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
