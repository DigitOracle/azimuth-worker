// v236 - WHY THERE ARE TWO SCOPE GATES AND WHY NEITHER MAY BE DELETED.
//
// Read this before removing either one. They agree on 449 of 1,254 plots and disagree on 9, so to
// anyone who was not here on 22 Sep 2026 they look like the same rule written twice. They are not.
//
//   MAGNITUDE  (v232 umxTable, v233 homeBlock)
//     "the record's total is materially bigger than THIS BUILDING's registered count" - a claim about
//     size, computed as total_units > plot.units * 1.15.
//     Catches: a SINGLE-building property carrying an inflated total. Structure cannot see this,
//     because structurally such a property looks like exactly what it claims to be.
//
//   STRUCTURAL (v234, building_page.js)
//     "this register property covers more than one building" - a claim about provenance, computed as
//     dld.buildings > 1. No magnitudes involved.
//     Catches: a property spanning several buildings whose total happens to sit close to this
//     building's. Magnitude cannot see this, because the numbers agree.
//
// THE DAY THEY WERE SEPARATELY NECESSARY. The magnitude gate was built first, for REMRAAM: a 92-unit
// building whose record carried 11,444 units across 195 buildings, 124x. Then thirteen features were
// found sharing one stranger's register row, and their plot.units was ITSELF a 47,782-unit community
// aggregate - so the magnitude gate's own reference was corrupt and it would have passed the bad
// figure through unlabelled. A gate measured against a corrupted reference is not a gate. The
// structural gate cannot be fooled that way because it never compares magnitudes.
//
// THE TRAP IN THE NUMBERS. The magnitude-only column is EMPTY on today's data - every inflated total
// currently sits on a multi-building property, so structure alone would appear to be sufficient. It
// is not sufficient, it is lucky. A guard that never fires on today's data is untested, not
// redundant. Delete it and the next REMRAAM on a single-building property goes out unlabelled.
//
//   node test/test_v236_gate_complement.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, "..", "src", "index.js");
const BOARD = path.join(process.env.NAJ_DATA || "C:/Dev/naj-market-pulse/data", "board");

let fails = 0;
const ok = (c, name, detail) => {
  if (c) return console.log("  ok   " + name);
  fails++;
  console.log("  FAIL " + name + (detail ? "\n         " + detail : ""));
};

const lines = fs.readFileSync(SRC, "utf8").split("\n");
const start = lines.findIndex((l) => /^const MAP_CHROME_JS\s*=\s*''\s*$/.test(l));
const cont = (l) => /^\s*\+/.test(l) || /^\s*\/\//.test(l) || /^\s*$/.test(l);
let end = start + 1;
while (end < lines.length && cont(lines[end])) end++;
const scope = new Proxy({}, { has: () => true, get: (t, k) => (k in t ? t[k] : k in globalThis ? globalThis[k] : ""), set: (t, k, v) => ((t[k] = v), true) });
const CHROME = new Function("scope", "with(scope){" + lines.slice(start, end).join("\n").replace(/^const /, "var ") + ";\nreturn MAP_CHROME_JS;}")(scope);

function lift(name) {
  const at = CHROME.indexOf("function " + name + "(");
  if (at < 0) return null;
  let d = 0;
  for (let i = CHROME.indexOf("{", at); i < CHROME.length; i++) {
    if (CHROME[i] === "{") d++;
    else if (CHROME[i] === "}" && --d === 0) return CHROME.slice(at, i + 1);
  }
  return null;
}
const PRELUDE = `function esc(s){return String(s==null?"":s);} function fmtM(n){return "AED "+n;}`;
const umxTable = new Function(PRELUDE + lift("umxHeld") + lift("umxTable") + "\nreturn umxTable;")();
const labels = (r, bu) => /across the project/.test(umxTable(r, bu) || "");

const rows = [{ type: "1 b/r", units: 40, median_sqm: 70, levels: "1-8", median_aed: 800000 }];
const rec = (units, blds) => ({ status: "verified", name: "X", total_units: units, floors: 8, asset_classes: {}, dld: { buildings: blds }, rows });

// ---- the two buildings that separate the gates -----------------------------------------------------
// A: ONE building, total 50x its registered count. Structure sees nothing - dld.buildings is 1.
const onlyMagnitude = { r: rec(5000, 1), bu: 100 };
// B: THE RESIDENCE | Burj Khalifa, burjkhalifa #67. Two buildings, totals 3.2% apart, under 1.15x.
const onlyStructure = { r: rec(1113, 2), bu: 1078 };

const mag = (r, bu) => !!(bu && r.total_units && r.total_units > bu * 1.15);
const str = (r) => !!(r.dld && r.dld.buildings > 1);

ok(mag(onlyMagnitude.r, onlyMagnitude.bu) && !str(onlyMagnitude.r),
   "A single-building property with an inflated total is seen ONLY by magnitude");
ok(str(onlyStructure.r) && !mag(onlyStructure.r, onlyStructure.bu),
   "A two-building property with close totals is seen ONLY by structure");

// The page must label BOTH. If it labels only one, a gate has been removed.
ok(labels(onlyMagnitude.r, onlyMagnitude.bu), "the panel labels the magnitude-only case");
ok(labels(onlyStructure.r, onlyStructure.bu), "the panel labels the structure-only case");

// Stated as the deletion test, which is the thing this file exists to prevent.
ok(!(str(onlyMagnitude.r)), "DELETING MAGNITUDE would miss the 5,000-on-a-100-unit-building case");
ok(!(mag(onlyStructure.r, onlyStructure.bu)), "DELETING STRUCTURE would miss THE RESIDENCE | Burj Khalifa");

// A property that is its own building with an honest total gets nothing from either gate.
ok(!labels(rec(772, 1), 772), "a single-building property with an honest total is left alone");

// ---- the real distribution, so the 449/9 ratio cannot surprise anyone later -------------------------
const rd = (f) => { try { return JSON.parse(fs.readFileSync(path.join(BOARD, f), "utf8")); } catch { return null; } };
const plots = rd("plots.json");
if (!plots) {
  console.log("  skip - set NAJ_DATA to the naj-market-pulse data directory");
} else {
  const cache = {};
  const umx = (s) => (cache[s] ??= (rd("unitmix_" + s + ".json") || {}).buildings_by_id || {});
  let both = 0, magOnly = 0, strOnly = 0, neither = 0;
  for (const f of plots.features) {
    const p = f.properties;
    const r = umx(p.district)[String(p.i)];
    if (!r) continue;
    const A = mag(r, p.units), B = str(r);
    if (A && B) both++; else if (A) magOnly++; else if (B) strOnly++; else neither++;
  }
  console.log(`  both ${both} · magnitude-only ${magOnly} · structure-only ${strOnly} · neither ${neither}`);
  ok(both > 400, `the gates agree on the bulk of cases (${both}) - which is why they look redundant`);
  ok(strOnly > 0, `structure still catches what magnitude misses (${strOnly}) - this is the 9`);
  // The point of the file, asserted rather than just written in the header.
  ok(magOnly === 0, `magnitude-only is EMPTY today (${magOnly}) - and that is why it must NOT be deleted: ` +
     "the column is empty because every current inflation sits on a multi-building property, which is luck, not sufficiency");
}

console.log(fails ? `\nv236: ${fails} failing` : "\nv236: all passing");
process.exit(fails ? 1 : 0);
