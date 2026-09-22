// v228 - the map resolves a plot to its building by ID, not by name.
//
// Why this exists. openPanel resolved a tapped place through ntok() name-token equality into
// map_prices, which left 120 of 1,254 plots (9.6%) resolving to nothing and, worse, allowed a
// same-named building in the WRONG DISTRICT to match because homeFor() is district-tolerant when
// the record's district is blank. A sibling session measured the lift from cleaning 41 project
// titles at +0: normalisation is not the fix for an id problem.
//
// plots.json now carries i (the footprint index, which is the key of unitmix_<slug>.buildings_by_id),
// pid (DLD property_id) and bldgs (buildings sharing the parcel) - all three proved by the same
// reg_bindings/tx_bindings that placed the label.
//
// THE CONDITION THIS SUITE EXISTS TO ENFORCE. A plot is not a building: 23.7% of plot features sit
// on a parcel holding more than one. A client sheet once carried pictures of the wrong building
// because a lookup picked a plausible neighbour, so:
//   - we bind through the FOOTPRINT index (a per-building binding), never through key_bridge's
//     dm_building_id, which is merely the tallest building on the plot;
//   - where bldgs > 1 the card must say so rather than letting one building read as the whole plot.
//
//   node test/test_v228_parcel_join.mjs
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

// ---- the page source, rebuilt from the string chain ---------------------------------------------
const lines = fs.readFileSync(SRC, "utf8").split("\n");
const start = lines.findIndex((l) => /^const MAP_CHROME_JS\s*=\s*''\s*$/.test(l));
const cont = (l) => /^\s*\+/.test(l) || /^\s*\/\//.test(l) || /^\s*$/.test(l);
let end = start + 1;
while (end < lines.length && cont(lines[end])) end++;
const scope = new Proxy({}, { has: () => true, get: (t, k) => (k in t ? t[k] : k in globalThis ? globalThis[k] : ""), set: (t, k, v) => ((t[k] = v), true) });
const CHROME = new Function("scope", "with(scope){" + lines.slice(start, end).join("\n").replace(/^const /, "var ") + ";\nreturn MAP_CHROME_JS;}")(scope);

// ---- the resolution path ------------------------------------------------------------------------
ok(/var pi=\(p\.i!=null&&p\.i>=0\)\?p\.i:null/.test(CHROME), "openPanel reads the plot's footprint index");
ok(/var ur=\(pi!=null&&UX&&UX\[pi\]\)\?UX\[pi\]:umxFor\(slug,p\.name,hm\)/.test(CHROME), "the index is tried BEFORE the name scan");
ok(/umxFor\(slug,p\.name,hm\)/.test(CHROME), "the name scan survives as the fallback for places with no index");
ok(/var twinI=\(pi!=null\)\?pi:/.test(CHROME), "the twin link uses the same index");
ok(CHROME.indexOf("dm_building_id") < 0, "the page does NOT bind through dm_building_id (tallest-on-plot)");

// ---- a plot is not a building ---------------------------------------------------------------------
ok(/\(p\.bldgs&&p\.bldgs>1\)\?/.test(CHROME), "a multi-building parcel is called out rather than passed off as the plot");
ok(/not the whole plot/.test(CHROME), "the copy says plainly that the card is one building, not the plot");

// ---- against the real files -----------------------------------------------------------------------
const rd = (f) => { try { return JSON.parse(fs.readFileSync(path.join(BOARD, f), "utf8")); } catch { return null; } };
const plots = rd("plots.json");
if (!plots) {
  console.log("  skip data checks - set NAJ_DATA to the naj-market-pulse data directory");
} else {
  const P = plots.features.map((f) => f.properties);
  const n = P.length;
  const withI = P.filter((p) => p.i != null).length;
  ok(withI === n, `every plot carries a footprint index (${withI}/${n})`);

  const cache = {};
  const umx = (slug) => {
    if (!(slug in cache)) cache[slug] = (rd("unitmix_" + slug + ".json") || {}).buildings_by_id || {};
    return cache[slug];
  };
  const resolved = P.filter((p) => p.i != null && umx(p.district)[String(p.i)]).length;
  console.log(`  ${n} plot features, ${resolved} resolve by index`);
  ok(resolved === n, `every plot resolves by index to a unit-mix record (${resolved}/${n})`);

  // The guard must be reachable: the data has to actually mark the multi-building cases.
  const multi = P.filter((p) => (p.bldgs || 0) > 1).length;
  ok(multi > 0, `the multi-building case is present in the data and will exercise the guard (${multi} plots)`);
  console.log(`  ${multi} of ${n} plots (${((100 * multi) / n).toFixed(1)}%) sit on a parcel with more than one building`);

  // The condition Azimuth Rings asked for, stated as something that can actually fail: where several
  // plot features share one parcel, they must resolve to DIFFERENT building records. If two of them
  // landed on the same record we would be doing exactly what dm_building_id does - picking one
  // building on the plot and serving it for its neighbours.
  const byParcel = new Map();
  for (const p of P) {
    if (!p.parcel) continue;
    const k = p.district + "|" + p.parcel;
    if (!byParcel.has(k)) byParcel.set(k, []);
    byParcel.get(k).push(p);
  }
  const shared = [...byParcel.entries()].filter(([, v]) => v.length > 1);
  const collided = shared.filter(([, v]) => new Set(v.map((p) => p.i)).size !== v.length);
  console.log(`  ${shared.length} parcels carry more than one plot feature`);
  ok(collided.length === 0, "plot features sharing a parcel resolve to distinct buildings, never the same one",
     collided.length ? collided.slice(0, 3).map(([k, v]) => k + " -> i=" + v.map((p) => p.i).join(",")).join("; ") : "");
}

console.log(fails ? `\nv228: ${fails} failing` : "\nv228: all passing");
process.exit(fails ? 1 : 0);
