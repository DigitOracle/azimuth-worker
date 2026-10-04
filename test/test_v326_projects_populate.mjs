// v326 - "we added Select Group, it said 26 projects, and the projects did not appear".
// Cause: a saved shortlist (and the browser copy) held ids from before the developer crosswalk ("select", "damac ( )"). The page used them as they were, so the row read
// "no sales on the map yet", counted as chosen, and drew nothing on the map. The fix moves each saved id to today's id through the index's alias map.
// Second fault: in the last-12-months window the project list could include an area the count skipped (azizi 78 shown, 80 listed).
//   node test/test_v326_projects_populate.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n          " + d : "")); } };
const root = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
// the OLD code (release-v323) from git, for the negative control
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "v326_old_"));
fs.mkdirSync(path.join(tmp, "src")); fs.mkdirSync(path.join(tmp, "scripts"));
for (const f of ["src/devmap_core.js", "src/devmap_page.js"]) fs.writeFileSync(path.join(tmp, f), execFileSync("git", ["-C", root, "show", "release-v323:" + f], { maxBuffer: 1e8 }));
const newCore = (await import(pathToFileURL(path.join(root, "src/devmap_core.js")).href)).DEVMAP_CORE_JS;
const oldCore = (await import(pathToFileURL(path.join(tmp, "src/devmap_core.js")).href)).DEVMAP_CORE_JS;
const mk = (src) => new Function(src + "; return DM;")();
const NEW = mk(newCore), OLD = mk(oldCore);
for (const D of [NEW, OLD]) D.TIER_CFG.bounds = [30000, 20000, 12000];

// a small index shaped like the live one: select-group (old spellings "select", "select global" in the alias map), damac, one area with a rental-only developer in the window
const mkDev = (n, b, c) => ({ n, h: 0, c, b, r: [] });
const IDX = { as_of: "2026-09-09", cuts: { bounds: [30000, 20000, 12000] },
  alias: { "select": "select-group", "select global": "select-group", "damac ( )": "damac" },
  devs: { "select-group": { name: "Select Group", areas: 2, n: 40, profile: { projects: 3, homes: 0 } }, damac: { name: "Damac", areas: 1, n: 20, profile: { projects: 1, homes: 0 } } },
  areas: {
    a: { name: "Area A", devs: { "select-group": mkDev("Select Group", [[10, 35000, "One"], [10, 25000, "Two"]], [[20, 30000, 1e6, 1]]), damac: mkDev("Damac", [[20, 15000, "D1"]], [[20, 15000, 1e6, 1]]) } },
    b: { name: "Area B", devs: { "select-group": mkDev("Select Group", [[20, 22000, "Three"]], [[20, 22000, 1e6, 1]]) } } } };

console.log("A - saved ids from before the crosswalk are moved to today's id");
const saved = ["omniyat", "select", "damac ( )", "select-group", "select global"];
ok(typeof NEW.resolveSaved === "function", "the core has resolveSaved");
const r = NEW.resolveSaved(IDX, saved);
ok(JSON.stringify(r) === JSON.stringify(["omniyat", "select-group", "damac"]), "select, select global and select-group become ONE select-group; damac ( ) becomes damac; unknown ids and order are kept", JSON.stringify(r));
ok(JSON.stringify(NEW.resolveSaved(IDX, ["damac", "select-group"])) === JSON.stringify(["damac", "select-group"]), "a list that is already current is unchanged");
ok(JSON.stringify(NEW.resolveSaved({ devs: {} }, ["x", null, "", 5, "x"])) === JSON.stringify(["x"]), "an index with no alias map, junk entries and repeats do not throw");
const mineNew = {}; r.forEach((k) => { mineNew[k] = true; });
const where = NEW.whereMine(IDX, mineNew);
ok(where.a >= 2 && where.b >= 1, "after the move, Select Group and Damac show on the map (whereMine counts them)", JSON.stringify(where));
const mineOldIds = {}; saved.forEach((k) => { mineOldIds[k] = true; delete mineOldIds.omniyat; });
const wOld = NEW.whereMine(IDX, { select: true, "damac ( )": true });
ok(!(wOld.a > 0) && !(wOld.b > 0), "NEGATIVE CONTROL (the data): the old ids on their own draw nothing, which is the fault the move cures", JSON.stringify(wOld));
ok(OLD.resolveSaved === undefined, "NEGATIVE CONTROL (release-v323): the live core has no way to move a saved id");
const page = fs.readFileSync(path.join(root, "src/devmap_page.js"), "utf8"), pageOld = fs.readFileSync(path.join(tmp, "src/devmap_page.js"), "utf8");
ok(/DM\.resolveSaved\(IDX,sl\)/.test(page) && !/resolveSaved/.test(pageOld), "the page runs the saved list through resolveSaved at load; release-v323 did not");
ok(/sl\.join\("\|"\)!==sl0\)saveMine\(\)/.test(page), "and saves the corrected list back so the server copy is fixed too");

console.log("B - the count shown and the projects listed agree in the last 12 months");
// developer q has 2 projects in area a (with sales) and 2 in area b where it has only rental rows in the window
const IDX2 = { as_of: "2026-09-09", cuts: { bounds: [30000, 20000, 12000] }, devs: { q: { name: "Q", areas: 2, n: 10, profile: { projects: 4, homes: 0 } } }, areas: {
  a: { name: "A", devs: { q: mkDev("Q", [[5, 35000, "A1"], [5, 25000, "A2"]], [[10, 30000, 1e6, 1]]) } },
  b: { name: "B", devs: { q: { n: "Q", h: 0, c: [], b: [[1, 35000, "B1"], [1, 25000, "B2"]], r: [[1, 1, 1]] } } } } };
const listed = (D) => { let n = 0; for (let t = 0; t < 4; t++) D.drillProjects(IDX2, "q", t, null).forEach((g) => { n += g.projects.length; }); return n; };
ok(NEW.devProfile(IDX2, "q").projects === 2 && listed(NEW) === 2, "fixed: count 2 = listed 2", NEW.devProfile(IDX2, "q").projects + " vs " + listed(NEW));
ok(OLD.devProfile(IDX2, "q").projects === 2 && listed(OLD) === 4, "NEGATIVE CONTROL (release-v323): shows 2, lists 4 (the azizi 78 / 80 fault)", OLD.devProfile(IDX2, "q").projects + " vs " + listed(OLD));
ok(/e\.profile\.projects\+=d\.c\.length\?\(d\.b\|\|\[\]\)\.length:0/.test(page), "the window developer list counts a project only where the developer has sales in the window");

console.log("C - the whole live index, every developer, both windows (when a copy of it is given)");
const live = process.env.DEVMAP_LIVE_INDEX;
if (live && fs.existsSync(live)) {
  const run = (pf) => { try { execFileSync("node", [path.join(root, "scripts/check_devmap_projects_populate.mjs"), live, "--quiet", "--page", pf], { encoding: "utf8" }); return 0; } catch (e) { return (e.stdout.match(/MISMATCH/g) || []).length; } };
  ok(run(path.join(root, "src/devmap_page.js")) === 0, "no developer with 5 or more projects shows a count its list does not match");
} else console.log("  (skipped: set DEVMAP_LIVE_INDEX to a copy of img_devmap_index to run it)");
fs.rmSync(tmp, { recursive: true, force: true });
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
