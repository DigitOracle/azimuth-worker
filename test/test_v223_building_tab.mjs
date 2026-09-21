// v223 - THE BUILDING tab shows what we hold, and never dresses a modelled number as a register fact.
//
// Why this exists. The tab reported 2,019 of 66,714 buildings wired (3.0%), and the cause was not missing data:
// umxFor() dropped any record whose rows[] was empty, so floors (present on 66,714 of 66,714) and indicative
// homes (63,041) were fetched, parsed and then thrown away. Opening that gate is only safe if the numbers it
// lets through are labelled for what they are - floors_basis is present on just 160 records (0.2%), so 100%
// floors coverage is 0.2% SOURCED floors, and indicative_homes is footprint x storeys off our own massing.
//
// It runs the page's OWN umxFor/umxTable/umxHeld, lifted out of the MAP_CHROME_JS literal in src/index.js, so
// what it asserts is what the browser executes. The panel code is a chain of single-quoted JS strings that
// node --check cannot see inside; v181.1 shipped a ReferenceError that way.
//
//   node test/test_v223_building_tab.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, "..", "src", "index.js");
const NAJ = process.env.NAJ_DATA || "C:/Dev/naj-market-pulse/data";

let fails = 0;
const ok = (cond, name, detail) => {
  if (cond) return console.log("  ok   " + name);
  fails++;
  console.log("  FAIL " + name + (detail ? "\n         " + detail : ""));
};

// ---- lift the page's real functions out of the string chain ------------------------------------
const lines = fs.readFileSync(SRC, "utf8").split("\n");
const start = lines.findIndex((l) => /^const MAP_CHROME_JS\s*=\s*''\s*$/.test(l));
if (start < 0) throw new Error("MAP_CHROME_JS declaration not found in src/index.js");
const cont = (l) => /^\s*\+/.test(l) || /^\s*\/\//.test(l) || /^\s*$/.test(l);
let end = start + 1;
while (end < lines.length && cont(lines[end])) end++;

// Sibling constants interpolate into the chain; their values do not matter for these functions.
const scope = new Proxy(
  {},
  { has: () => true, get: (t, k) => (k in t ? t[k] : k in globalThis ? globalThis[k] : ""), set: (t, k, v) => ((t[k] = v), true) }
);
const decl = lines.slice(start, end).join("\n").replace(/^const /, "var ") + ";\nreturn MAP_CHROME_JS;";
const CHROME = new Function("scope", "with(scope){" + decl + "}")(scope);

// The whole chrome cannot be evaluated - its top level touches document and fetch. Take the three
// functions by brace balance instead, so we execute the shipped source and nothing else.
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

const srcHeld = lift("umxHeld");
const srcTable = lift("umxTable");
const srcFor = lift("umxFor");
ok(!!srcHeld, "umxHeld is defined in the page");
ok(!!srcTable && !!srcFor, "umxTable and umxFor are defined in the page");
if (!srcHeld || !srcTable || !srcFor) {
  console.log("\nv223: " + fails + " failing");
  process.exit(1);
}

// Stubs for the helpers these three call, matching the page's behaviour closely enough to assert on.
const PRELUDE = `
  var UMXC={};
  function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
  function fmtM(n){return "AED "+n;}
  function ntok(t){return String(t||"").toLowerCase().replace(/[^a-z0-9 ]+/g," ").split(" ")
    .filter(function(w){return w.length>2&&["the","by","at","residences","residence","tower","towers","dubai"].indexOf(w)<0});}
`;
const api = new Function(PRELUDE + srcHeld + srcTable + srcFor + "\nreturn {umxHeld:umxHeld,umxTable:umxTable,umxFor:umxFor,UMXC:UMXC};")();

// ---- fixtures ----------------------------------------------------------------------------------
const placeholder = { status: "placeholder", name: "DNATA", rows: [], floors: 4, car_parks: null, indicative_homes: 120, total_units: null, needs: ["a register name for this footprint (DLD units register then fills units, types and levels)"] };
const permitFloors = { status: "placeholder", name: "PERMIT BLOCK", rows: [], floors: 31, floors_basis: "Dubai Municipality permit", indicative_homes: 300, needs: [] };
const plateSuspect = { status: "placeholder", name: "PODIUM", rows: [], floors: 6, indicative_homes: null, needs: [] };
const withRows = { status: "verified", name: "BAY SQUARE B12", total_units: 100, asset_classes: { office: 10, retail: 5 }, floors: 12, rows: [{ type: "1 b/r", units: 40, median_sqm: 70, levels: "2-10", median_aed: 1200000, median_rent: 70000 }] };

// ---- (a) a record without unit rows is no longer discarded ---------------------------------------
api.UMXC.d = { 0: placeholder };
ok(api.umxFor("d", "DNATA", null) === placeholder, "umxFor returns a record that has no unit rows");
ok(api.umxFor("d", "DNATA", { i: 0 }) === placeholder, "umxFor honours the footprint index without requiring rows");

api.UMXC.e = { 0: placeholder, 1: { ...withRows, name: "DNATA" } };
ok(api.umxFor("e", "DNATA", null).rows.length > 0, "at equal name score, a record WITH rows still wins");

ok(!/if\(!r\|\|!r\.rows\|\|!r\.rows\.length\)return;/.test(CHROME), "the old rows-only guard is gone from umxFor");

// ---- (b) the modelled block, and what it may and may not claim -----------------------------------
const hHeld = api.umxTable(placeholder);
ok(hHeld && hHeld.indexOf("what we hold") >= 0, "umxTable renders a held block for a rows-less record", hHeld);
ok(/4 floors \(modelled\)/.test(hHeld), "floors with no floors_basis are labelled modelled", hHeld);
ok(/modelled from our own massing/.test(hHeld), "indicative homes carry their basis in the copy", hHeld);
ok(hHeld.indexOf("register count") >= 0, "the copy says explicitly it is not a register count");
ok(hHeld.indexOf("a register name for this footprint") >= 0, "the record's own needs[] says what would fill it");

const hPermit = api.umxTable(permitFloors);
ok(/31 floors/.test(hPermit) && !/31 floors \(modelled\)/.test(hPermit), "a permit floor count is NOT labelled modelled", hPermit);

const hPlate = api.umxTable(plateSuspect);
ok(!/homes/.test(hPlate), "a null indicative_homes stays absent - the builder's refusal is honoured", hPlate);

// ---- the source the UI must never assert ----------------------------------------------------------
const hRows = api.umxTable(withRows);
ok(hRows.indexOf("DLD units register") < 0, "a record with no basis does not get told it came from the DLD units register", hRows);
ok(hRows.indexOf("unit mix") >= 0 && hRows.indexOf("<table>") >= 0, "a record with rows still renders its table");
ok(CHROME.indexOf("r.basis||'DLD units register'") < 0, "the hardcoded basis default is gone from the page");

// ---- (c) PTAB is decided only once the unit mix has landed ----------------------------------------
ok(/var umxRdy=\(!slug\)\|\|!!UMXC\[slug\]/.test(CHROME), "openPanel waits for the unit-mix fetch before pinning PTAB");
ok(!/if\(PTAB==null\)PTAB=hasB\?'b':'a'/.test(CHROME), "PTAB is no longer pinned unconditionally on first paint");

// ---- (d) no dead control -------------------------------------------------------------------------
ok(/\+\(hasB\?'<button data-t=b/.test(CHROME), "the building button renders only when the tab has a body");

// ---- the lift, against the real register files ----------------------------------------------------
const umx = (() => { try { return JSON.parse(fs.readFileSync(path.join(NAJ, "board", "unitmix_businessbay.json"), "utf8")); } catch { return null; } })();
if (!umx) {
  console.log("  skip districts - set NAJ_DATA to the naj-market-pulse data directory to score the lift");
} else {
  const b = umx.buildings_by_id || {};
  const ids = Object.keys(b);
  const before = ids.filter((k) => (b[k].rows || []).length).length;
  const after = ids.filter((k) => { const h = api.umxTable(b[k]); return h && h.length > 0; }).length;
  console.log(`  businessbay: ${ids.length} footprints, ${before} rendered before, ${after} rendered after`);
  ok(after > before, `the tab renders more buildings than before (${before} -> ${after})`);
  // The ban is on ASSERTING a source, which only happens in the header slot ("N units · <basis>").
  // needs[] legitimately names the register as what WOULD fill the gap - that is a statement of
  // absence, not a claim of provenance, so it is allowed through.
  const claimed = ids.filter((k) => /units · DLD units register/.test(api.umxTable(b[k]) || "")).length;
  ok(claimed === 0, "no building is told its basis is the DLD units register", `${claimed} were`);
  const stillNeeds = ids.filter((k) => /not held yet/.test(api.umxTable(b[k]) || "")).length;
  console.log(`  ${stillNeeds} of ${ids.length} say plainly what they do not hold yet`);
  const mislabelled = ids.filter((k) => { const r = b[k]; const h = api.umxTable(r) || ""; return r.floors && !r.floors_basis && h.indexOf(r.floors + " floors") >= 0 && h.indexOf(r.floors + " floors (modelled)") < 0; }).length;
  ok(mislabelled === 0, "no massing floor count is printed as though it were sourced", `${mislabelled} were`);
}

console.log(fails ? `\nv223: ${fails} failing` : "\nv223: all passing");
process.exit(fails ? 1 : 0);
