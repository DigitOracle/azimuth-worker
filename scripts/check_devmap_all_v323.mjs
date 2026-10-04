// v323 - what a Developers-by-area index must carry before it is published (and again after it is read back from the live store). READ-ONLY.
//   node scripts/check_devmap_all_v323.mjs <index file> [--min-areas 40]
// Exit 0 = good, 1 = stop. It checks the profile fields (project counts, scale cut-offs), the evidence (yearly prices, last 12 months, last-12-month projects),
// the districts that joined the list (Ras Al Khor, Bukadra) and that every developer in the list has settled sales behind it.
import fs from "node:fs";
const file = process.argv[2];
const minAreas = Number((process.argv.indexOf("--min-areas") > 0 && process.argv[process.argv.indexOf("--min-areas") + 1]) || 40);
const j = JSON.parse(fs.readFileSync(file, "utf8"));
const bad = [];
const areas = Object.keys(j.areas || {});
if (areas.length < minAreas) bad.push("only " + areas.length + " areas (need " + minAreas + ")");
const devs = Object.entries(j.devs || {});
const withProjects = devs.filter(([, d]) => d.profile && d.profile.projects > 0).length;
if (withProjects < 100 || !j.scale) bad.push("project counts are on " + withProjects + " developers (need 100) and scale cut-offs " + (j.scale ? "are" : "are NOT") + " present");
const evAreas = areas.filter((s) => j.areas[s].ev && j.areas[s].ev.all && j.areas[s].ev.all[0] > 0).length;
if (!j.ev) bad.push("no evidence block (ev) at the top of the index");
if (evAreas < 30) bad.push("the evidence is on only " + evAreas + " areas (need 30)");
let b12 = 0, c12 = 0; for (const s of areas) for (const d of Object.values(j.areas[s].devs)) { if (d.b12) b12++; if (d.c12) c12++; }
if (!c12) bad.push("no last-12-month cells (c12)");
if (!b12) bad.push("no last-12-month projects (b12): the profile would not follow the window");
for (const s of ["rasalkhor", "bukadra"]) if (!j.areas[s]) bad.push("area " + s + " is missing");
const hasRent = new Set(); for (const s of areas) for (const [k, d] of Object.entries(j.areas[s].devs)) if ((d.r || []).length) hasRent.add(k);
const zero = devs.filter(([, d]) => !(d.n > 0)).map(([k]) => k);   // a developer with no settled sale is only allowed when it has rental contracts (the page says "rental contracts only")
const empty = zero.filter((k) => !hasRent.has(k));
if (empty.length) bad.push(empty.length + " developers have neither sales nor rental contracts: " + empty.slice(0, 10).join(", "));
const size = fs.statSync(file).size;
console.log("areas " + areas.length + " | developers " + devs.length + " | with project counts " + withProjects + " | areas with evidence " + evAreas + " | developer slots with last-12-month cells " + c12 + ", projects " + b12 + " | developers with sales count 0: " + zero.length + " (rental contracts only: " + (zero.length - empty.length) + ") | size " + Math.round(size / 1024) + " KB | rasalkhor " + !!j.areas.rasalkhor + " bukadra " + !!j.areas.bukadra);
if (bad.length) { console.error("PROBLEMS:\n  " + bad.join("\n  ")); process.exit(1); }
