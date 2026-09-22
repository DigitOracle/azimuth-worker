// v232 - a project's unit total is never shown as though it were this building's.
//
// Why this exists, and why v231 does not already cover it. v228 binds a plot to its building by
// footprint index. For 449 of 1,267 plots the record at that index is scoped to the PARCEL or the
// PROJECT, not the one building. REMRAAM's footprint is bound to a 92-unit building and the record
// there carries 11,444 units across 195 buildings - 124x.
//
// The trap is that these names AGREE. "URBANA III" against "Urbana III" (8 -> 696). "Dubai Lagoon
// Lily" against itself (179 -> 4,947). So corrob() passes them, and a "registered as" disclosure
// line would too: both are identity checks and this is a scope failure. They fail independently and
// need separate gates. Do not merge this into v231.
//
// The mix itself is real - the types, sizes and levels are the project's actual mix - so it still
// renders. What changes is that the headline total is labelled the project's and the building's own
// registered count is put beside it, instead of the two being silently conflated.
//
//   node test/test_v232_scope.mjs
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

// ---- wired, and wired in the right place ---------------------------------------------------------
const srcTable = lift("umxTable");
ok(!!srcTable && /^function umxTable\(r,bu\)\{/.test(srcTable), "umxTable takes the building's registered count");
const atCall = CHROME.indexOf("umxTable(ur,(p.units!=null&&p.units>0)?p.units:null)");
ok(atCall >= 0, "openPanel passes p.units from the plot feature", `indexOf returned ${atCall}`);
ok(/var wide=\(bu&&r\.total_units&&r\.total_units>bu\*1\.15\)\?bu:null/.test(CHROME), "the scope test compares the record against the building");

const PRELUDE = `function esc(s){return String(s==null?"":s);} function fmtM(n){return "AED "+n;}`;
const umxTable = new Function(PRELUDE + lift("umxHeld") + srcTable + "\nreturn umxTable;")();

// ---- behaviour, on a record shaped like the real ones ---------------------------------------------
const rec = (units, blds) => ({ status: "verified", name: "Al Thamam 3", total_units: units, floors: 8,
  asset_classes: { office: 0, retail: 0 }, dld: { buildings: blds },
  rows: [{ type: "1 b/r", units: 40, median_sqm: 70, levels: "1-8", median_aed: 800000 }] });

const wide = umxTable(rec(11444, 195), 92);
ok(/across the project/.test(wide), "an outsized record is labelled as the project's", wide.slice(0, 200));
ok(/registered at 92 units/.test(wide), "the building's own registered count is shown beside it");
ok(/195 buildings/.test(wide), "the number of buildings in the project is named");
ok(/<table>/.test(wide), "the mix still renders - the types and levels are real and are not withheld");

const tight = umxTable(rec(772, 1), 772);
ok(!/across the project/.test(tight), "a building-scoped record is not labelled");
ok(!/registered at/.test(tight), "a building-scoped record gains no disclosure line");

ok(!/across the project/.test(umxTable(rec(11444, 195), null)), "with no registered count there is no claim to make, so none is made");
ok(!/across the project/.test(umxTable(rec(100, 1), 95)), "a 5% difference is rounding, not a change of scope");
ok(/across the project/.test(umxTable(rec(200, 2), 100)), "a 2x difference is a change of scope");

// ---- the independence of the two gates -------------------------------------------------------------
// The point of the suite: v231 cannot see these, because the names match.
const srcCorrob = lift("corrob"), srcNtok = lift("ntok");
if (srcCorrob && srcNtok) {
  const corrob = new Function(srcNtok + srcCorrob + "\nreturn corrob;")();
  ok(corrob("URBANA III", "Urbana III") === true, "v231 PASSES Urbana III - identity is fine");
  ok(/across the project/.test(umxTable(rec(696, 101), 8)), "v232 catches it anyway - scope is not");
}

// ---- against the real files -------------------------------------------------------------------------
const rd = (f) => { try { return JSON.parse(fs.readFileSync(path.join(BOARD, f), "utf8")); } catch { return null; } };
const plots = rd("plots.json");
if (!plots) {
  console.log("  skip data checks - set NAJ_DATA to the naj-market-pulse data directory");
} else {
  const cache = {};
  const umx = (s) => (cache[s] ??= (rd("unitmix_" + s + ".json") || {}).buildings_by_id || {});
  let labelled = 0, plain = 0;
  let remraam = null;
  for (const f of plots.features) {
    const p = f.properties;
    const r = umx(p.district)[String(p.i)];
    if (!r || !(r.rows || []).length) continue;
    const h = umxTable(r, p.units != null && p.units > 0 ? p.units : null);
    if (/across the project/.test(h)) labelled++; else plain++;
    if (p.district === "alhebiahfifth" && p.i === 50) remraam = h;
  }
  console.log(`  ${labelled} plots labelled as project-scoped, ${plain} left plain`);
  ok(labelled > 300, `the gate bites at the scale the audit measured (${labelled})`);
  if (remraam) ok(/across the project/.test(remraam) && /registered at 92 units/.test(remraam),
    "REMRAAM shows 11,444 as the project's and 92 as the building's", remraam.slice(0, 220));
}

console.log(fails ? `\nv232: ${fails} failing` : "\nv232: all passing");
process.exit(fails ? 1 : 0);
