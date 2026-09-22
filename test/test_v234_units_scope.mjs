// v234 — A PROJECT'S REGISTERED UNITS ARE NEVER PRINTED AS THIS BUILDING'S (Kendall, 22 Sep 2026).
//
// He opened /building/alhebiahfifth/50 on live. The title read "Al Thamam 3 · registered as REMRAAM" — the name was right, and
// disclosed. Directly beneath it the facts row read "Units: 11,444 registered", for a footprint the land registry binds as a
// 92-unit building. The number is real: it is REMRAAM's, the whole community, 195 buildings sharing one register property_id.
// The page was not showing a wrong number, it was showing the right number at the wrong scope, and the word "registered" made
// it an assertion about the register rather than a loose figure.
//
// This is the SAME CLASS as v232 and v233 on the map panel and a DIFFERENT SURFACE. v232 guards umxTable() and needs the new plots blob
// to do anything; this line is live today on every building page. Nothing that checks NAMES can see it — the name is correct.
//
//   node test/test_v234_units_scope.mjs
import { buildingData } from "../src/building_page.js";
import fs from "node:fs";

const NAJ = process.env.NAJ_DATA || "C:/Dev/naj-market-pulse/data";
const rd = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return null; } };

let fails = 0;
const ok = (c, name, detail) => {
  if (c) return console.log("  ok   " + name);
  fails++; console.log("  FAIL " + name + (detail ? "\n         " + detail : ""));
};
const unitsLine = (D) => { const f = (D && D.facts || []).find((x) => x[0] === "Units"); return f ? f[1] : null; };

const load = (slug) => ({
  stack: rd(NAJ + "/board/stack_" + slug + ".json"), umx: rd(NAJ + "/board/unitmix_" + slug + ".json"),
  bf: rd(NAJ + "/board/bldgfacts_" + slug + ".json"), anchors: rd(NAJ + "/names/anchors_" + slug + ".json"),
  units: rd(NAJ + "/board/units_" + slug + ".json"), plans: rd(NAJ + "/board/plans_index.json"),
  people: rd(NAJ + "/internal/community_resident_mix.json"),
});
const build = (slug, id) => {
  const L = load(slug);
  if (!L.stack || !L.umx) return null;
  return buildingData(slug, id, L.stack, L.umx, L.bf, L.anchors, L.people, L.stack.district || slug, L.plans,
    (L.units && L.units.buildings_by_id) ? L.units.buildings_by_id[id] : null, null);
};

// ---- the building Kendall opened ------------------------------------------------------------------------------------------
const rem = build("alhebiahfifth", "50");
if (!rem) {
  console.log("  skip - set NAJ_DATA to the naj-market-pulse data directory");
} else {
  const line = unitsLine(rem);
  console.log("  REMRAAM/Al Thamam 3 now reads: " + line);
  ok(/11,444/.test(line), "the register's figure is still shown - it is real and is not withheld", line);
  ok(!/^11,444 registered( —|$)/.test(line), "it is NOT presented as this building's registered count - the old line said exactly that", line);
  ok(/across 195 buildings/.test(line), "the line says across how many buildings the property runs", line);
  ok(/REMRAAM/.test(line), "and names the project it belongs to", line);
}

// ---- a building whose property is its own ----------------------------------------------------------------------------------
const one = build("businessbay", "574");
if (one) {
  const line = unitsLine(one);
  console.log("  Al Habtoor Tower reads: " + line);
  ok(line && !/across/.test(line), "a single-building property gains no scope wording - no noise where there is no doubt", line);
  ok(line && /registered/.test(line), "and still says the register holds it", line);
}

// ---- the per-building figure is used when the register holds one -------------------------------------------------------------
{
  const umx = { buildings_by_id: { 1: {
    name: "A tower", total_units: 4000, registered_homes: 120, asset_classes: null, rows: [],
    dld: { project: "A COMMUNITY", buildings: 12, units_registered: 4000 }, dm: {},
  } } };
  const stack = { district: "x", buildings_by_id: { 1: { name: "A tower", floors: [], types: [] } } };
  const D = buildingData("x", "1", stack, umx, null, null, null, "x", null, null, null);
  const line = unitsLine(D);
  ok(line && /across 12 buildings/.test(line), "a multi-building property is labelled whatever the numbers are", line);
  ok(line && /120 registered to this building/.test(line), "and this building's own registered count is printed beside it", line);
}
{
  const umx = { buildings_by_id: { 1: {
    name: "A tower", total_units: 300, registered_homes: null, asset_classes: null, rows: [],
    dld: { project: "A COMMUNITY", buildings: 1, units_registered: 300 }, dm: {},
  } } };
  const stack = { district: "x", buildings_by_id: { 1: { name: "A tower", floors: [], types: [] } } };
  const line = unitsLine(buildingData("x", "1", stack, umx, null, null, null, "x", null, null, null));
  ok(line === "300 registered", "one building, one property: the line is left exactly as it was", line);
}

// ---- scale, over every district on disk ---------------------------------------------------------------------------------------
{
  // The count is read from the data; the WORDING is then checked by running the page itself over a sample of the affected
  // buildings in every district that has one. Reconstructing the expected line here would only test this file against itself.
  let shown = 0, spanning = 0;
  const sample = [];
  for (const f of fs.readdirSync(NAJ + "/board").filter((x) => /^unitmix_.+\.json$/.test(x) && !/projects/.test(x))) {
    const slug = f.slice("unitmix_".length, -".json".length);
    const j = rd(NAJ + "/board/" + f); if (!j) continue;
    let takenHere = 0;
    for (const [id, r] of Object.entries(j.buildings_by_id || {})) {
      const dld = r.dld || {}, tot = r.total_units || dld.units_registered;
      if (!tot) continue;
      shown++;
      if (!(dld.buildings > 1)) continue;
      spanning++;
      if (takenHere < 3) { sample.push([slug, id, dld.buildings]); takenHere++; }
    }
  }
  console.log("  " + shown + " buildings show a Units line; " + spanning + " sit on a property spanning more than one building");
  ok(spanning > 500, "the defect is at the scale the audit measured, not a handful (" + spanning + ")");
  ok(shown - spanning > 0, "and the rest are untouched (" + (shown - spanning) + ")");
  const bad = [];
  let checked = 0;
  for (const [slug, id, nb] of sample) {
    const D = build(slug, id); if (!D) continue;
    const line = unitsLine(D); if (!line) continue;
    checked++;
    if (!new RegExp("across " + nb.toLocaleString("en-US") + " buildings").test(line)) bad.push(slug + " #" + id + " -> " + line);
  }
  console.log("  rendered " + checked + " of them through the page itself, across " + new Set(sample.map((s) => s[0])).size + " districts");
  ok(checked > 30, "enough of them actually rendered to mean something (" + checked + ")");
  ok(bad.length === 0, "every rendered one carries its scope in the line", bad.slice(0, 4).join("; "));
}

console.log(fails ? `\nv234: ${fails} failing` : "\nv234: all passing");
process.exit(fails ? 1 : 0);
