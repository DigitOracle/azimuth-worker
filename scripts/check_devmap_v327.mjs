// v327 - the checks the combined Developers-by-area index must pass before it is published, plus the numbers Kendall reads. READ-ONLY.
//   node scripts/check_devmap_v327.mjs <new index> [--before <live index backup>] [--min-areas 40]
// Stops (exit 1) when: fewer than 40 areas; a developer slot has no sales and no rental contracts (a slot with rental contracts only is allowed and counted);
// rasalkhor or bukadra is missing; a slot's "how sure" field q is not [confirmed, matched by name] numbers.
// Prints: the spot counts for Select Group, Imtiaz and Omniyat before and after, and what Kendall's saved list of twelve resolves to (the page's own resolveSaved).
// The contradiction check (the register against the developers shown) is guard_devmap_attribution.py, run by the publish script next to this one.
import fs from "node:fs";
import { DM } from "../src/devmap_dm.js";
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const file = args.find((a) => !a.startsWith("--") && fs.existsSync(a));
if (!file) { console.error("usage: node scripts/check_devmap_v327.mjs <new index> [--before <index>] [--min-areas 40]"); process.exit(1); }
const before = opt("--before", null);
const minAreas = Number(opt("--min-areas", 40));
const j = JSON.parse(fs.readFileSync(file, "utf8"));
const jb = before && fs.existsSync(before) ? JSON.parse(fs.readFileSync(before, "utf8")) : null;
const bad = [];
const areas = Object.keys(j.areas || {});
if (areas.length < minAreas) bad.push("only " + areas.length + " areas (need " + minAreas + ")");
for (const s of ["rasalkhor", "bukadra"]) if (!j.areas[s]) bad.push("area " + s + " is missing");
const sum = (c) => (c || []).reduce((a, x) => a + (x[0] || 0), 0);
let slots = 0, rentalOnly = 0, empty = [], badQ = 0, inferredSlots = 0, matchedSales = 0, allSales = 0;
for (const s of areas) for (const [k, d] of Object.entries(j.areas[s].devs || {})) {
  if (k === "_") continue;
  slots++;
  const n = sum(d.c) || sum(d.c12) || (d.ev && d.ev.all && d.ev.all[0]) || sum(d.b), rent = (d.r || []).length > 0;
  if (!(n > 0)) { if (rent) rentalOnly++; else empty.push(s + "/" + k); }
  for (const f of ["q", "q12"]) if (d[f] != null && !(Array.isArray(d[f]) && d[f].length === 2 && d[f].every((x) => Number.isFinite(x) && x >= 0))) badQ++;
  if (d.q && d.q[1] > 0) { inferredSlots++; matchedSales += d.q[1]; }
  allSales += n;
}
if (empty.length) bad.push(empty.length + " developer slots have neither sales nor rental contracts: " + empty.slice(0, 8).join(", "));
if (badQ) bad.push(badQ + " slots carry a malformed q field");
console.log("areas " + areas.length + " | developers " + Object.keys(j.devs).length + " | developer slots " + slots + " (rental-only " + rentalOnly + ", with sales matched by project name " + inferredSlots + ", " + matchedSales + " of " + allSales + " listed sales) | " + Math.round(fs.statSync(file).size / 1024) + " KB");

const spot = (ix, id) => {
  const r = DM.resolveSaved(ix, [id])[0], d = ix.devs[r];
  if (!d) return { id: r, n: 0, areas: 0, projects: 0, here: false };
  return { id: r, n: d.n || 0, areas: d.areas || 0, projects: (d.profile && d.profile.projects) || 0, here: true };
};
console.log("Spot counts (sales | areas | projects), before -> after:");
for (const id of ["select-group", "imtiaz", "omniyat"]) {
  const a = jb ? spot(jb, id) : null, b = spot(j, id), f = (x) => x ? x.n + " | " + x.areas + " | " + x.projects : "(no earlier index)";
  console.log("  " + id.padEnd(13) + f(a) + "   ->   " + f(b));
}
const SAVED = ["omniyat", "nakheel", "meraas", "emaar", "imtiaz", "zaya", "ellington", "select group", "damac", "mered", "fakhruddin", "palma"];
console.log("Saved list of twelve, resolved through the index (page's resolveSaved):");
const res = DM.resolveSaved(j, SAVED);
SAVED.forEach((s) => { const r = DM.resolveSaved(j, [s])[0], d = j.devs[r]; console.log("  " + s.padEnd(13) + " -> " + r.padEnd(14) + (d ? d.n + " sales in " + d.areas + " areas" : "no sales on the map yet")); });
const missing = SAVED.filter((s) => !j.devs[DM.resolveSaved(j, [s])[0]]);
if (res.length !== new Set(res).size) bad.push("the saved list resolves to a duplicated id");
if (DM.resolveSaved(j, ["select group"])[0] !== "select-group") bad.push("'select group' does not resolve to select-group");
if (missing.length) console.log("  (shown honestly as 'no sales on the map yet': " + missing.join(", ") + ")");
if (bad.length) { console.error("PROBLEMS:\n  " + bad.join("\n  ")); process.exit(1); }
console.log("v327 checks OK");
