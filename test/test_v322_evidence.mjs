// v322 - the EVIDENCE VIEW on Developers by area: a window toggle (last 12 months by default / all years), the "sales behind this number" drawer, the compare-with-area line,
// and the index fields that feed them (ev, c12). Includes a NEGATIVE CONTROL: the same checks run against the v320 tree (branch legend-v320) and must FAIL there.
//   node test/test_v322_evidence.mjs
import { devmapHtml } from "../src/devmap_page.js";
import { buildIndex, DM } from "../scripts/build_devmap_index.mjs";
import { mergeDistricts } from "../scripts/merge_districts_geo.mjs";
import { labelledName, communitiesOf } from "../src/community_labels.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d !== undefined ? "\n         " + String(d).slice(0, 300) : "")); } };
DM.TIER_CFG.bounds = null;
const pageJs = (html) => html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
const NEW_JS = pageJs(devmapHtml("k", { NAJ_NAV_CSS: "", NAJ_FONTS: "", najNav: () => "" }));

// the feature detector: every claim the evidence view makes, as one list, so the negative control runs the very same checks
const features = (js, builderSrc) => ({
  "window toggle with last 12 months first": /id=wseg/.test(js) && /Last 12 months<\/button><button data-w=all>All years/.test(js),
  "default window is the last 12 months when the index has evidence": /if\(IDX&&IDX\.ev\)S\.win="l12"/.test(js),
  "drawer link text": /Show the sales behind this number/.test(js),
  "drawer shows year chart and year table": /function barsSvg/.test(js) && /Median '\+pul\(\)\+'<\/tr>/.test(js),
  "compare with the area line": /its area '\+/.test(js) && /\(all years\)/.test(js) && /\(last 12 months\)/.test(js),
  "plain sentence when far from the area": /function evWhy/.test(js) && /we cannot say how much of the gap each one explains/.test(js),
  "how the figure is calculated, in words": /How the figures are worked out/.test(js) && /never shown when fewer than 3 sales/.test(js),
  "date range stated": /Dates\.<\/b> Sales settled from/.test(js),
  "builder attaches evidence": /attachEvidence/.test(builderSrc) && /c12/.test(builderSrc),
});

console.log("A - the new tree has every feature");
const nf = features(NEW_JS, fs.readFileSync(new URL("../scripts/build_devmap_index.mjs", import.meta.url), "utf8"));
for (const [k, v] of Object.entries(nf)) ok(v, k);

console.log("B - negative control: the v320 tree has none of them (the checks can fail)");
{
  let oldPage = null, oldBuilder = null;
  try {
    const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")), "..");
    oldPage = execFileSync("git", ["-C", root, "show", "legend-v320:src/devmap_page.js"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    oldBuilder = execFileSync("git", ["-C", root, "show", "legend-v320:scripts/build_devmap_index.mjs"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch (e) { console.log("  (git or branch legend-v320 not available here: control skipped)"); }
  if (oldPage) {
    const of = features(oldPage, oldBuilder);
    ok(Object.values(of).every((v) => v === false), "every feature check fails on legend-v320", JSON.stringify(of));
  }
}

console.log("C - the page script parses");
{
  const f = path.join(os.tmpdir(), "dm322_" + Math.random().toString(36).slice(2) + ".js"); fs.writeFileSync(f, NEW_JS);
  let parsed = true; try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); } catch (e) { parsed = false; }
  ok(parsed, "node --check passes");
  ok(!/\bL12\b|\bYTD\b|\bn=\d/.test(NEW_JS.slice(NEW_JS.indexOf("THE SALES BEHIND THE NUMBER"), NEW_JS.indexOf("function areaHtml(slug)"))), "the drawer text uses no initials or short forms (no L12, YTD, n=)");
}

console.log("D - the window swaps building cells for last-12-month cells (page logic run on a hand-worked index)");
{
  const src = NEW_JS.slice(NEW_JS.indexOf("var STATS={},IXC={};"), NEW_JS.indexOf("function features()"));
  const IDX = { ev: { l12_from: "2025-09-01" }, cuts: { bounds: [30000, 20000, 12000] }, areas: {
    a: { name: "A", ev: { all: [1] }, devs: { x: { n: "X", h: 0, c: [[10, 20000, 1e6, 1]], c12: [[5, 30000, 1.5e6, 1]], r: [] }, y: { n: "Y", h: 0, c: [[8, 15000, 9e5, 1]], c12: [], r: [] } } },
    b: { name: "B", devs: { z: { n: "Z", h: 0, c: [[4, 25000, 1e6, 2]], r: [] } } } } };
  const S = { win: "l12" };
  const mk = new Function("IDX", "S", "DM", src + "; return {ixOf:ixOf,stats:stats};");
  const P = mk(IDX, S, DM);
  const l = P.stats("a", "l12"), al = P.stats("a", "all");
  ok(l.median === 30000 && l.n === 5, "last 12 months: the area median is the c12 cell (30,000 per sq m, 5 sales)", JSON.stringify([l.median, l.n]));
  ok(al.median === 20000 || al.median === 15000, "all years: the old cells are used (median from c)", al.median);
  ok(al.n === 18 && l.devCount === 1, "all years counts both developers (18 sales); the window drops a developer with no sale in the window", JSON.stringify([al.n, l.devCount]));
  ok(P.stats("b", "l12").median === 25000, "an area with no evidence is shown unchanged in either window");
  S.win = "all"; ok(P.ixOf("all") === IDX, "all years returns the index itself (old behaviour untouched)");
  const noEv = { cuts: IDX.cuts, areas: IDX.areas };
  const P2 = new Function("IDX", "S", "DM", src + "; return {stats:stats};")(noEv, { win: "l12" }, DM);
  ok(P2.stats("a").median === al.median, "an index without evidence falls back to all years even if the window says last 12 months");
}

console.log("E - the drawer text functions");
{
  const src = NEW_JS.slice(NEW_JS.indexOf("var MON=["), NEW_JS.indexOf("function evHtml("));
  const S = { unit: "sqft" };
  const mk = new Function("DM", "S", "fmt", "pu", "pul", "esc", src + "; return {barsSvg:barsSvg,evWhy:evWhy,dsay:dsay,sizeSay:sizeSay};");
  const fmt = (n) => n == null ? "-" : Math.round(n).toLocaleString("en-US"), pu = (p) => p == null ? null : Math.round(p / DM.SQFT), esc = (s) => String(s);
  const F = mk(DM, S, fmt, pu, () => "per sq ft", esc);
  ok(F.dsay("2026-08-31") === "31 Aug 2026", "dates are written out: 31 Aug 2026");
  const svg = F.barsSvg([[2019, 100, 16140], [2020, 2, 0], [2026, 50, 22000]], "X");
  ok(/<svg/.test(svg) && /role=img/.test(svg) && /under 3/.test(svg) && /2026\*/.test(svg) && (svg.match(/<rect/g) || []).length === 2, "chart: thin bars, a year with under 3 sales is words not a bar, the partial year is starred", svg.slice(0, 200));
  const W = (n, m, rn, on, an, vn, sz) => [n, m, n - on, m, on, m, an, m, vn, m, sz * 0.8, sz, sz * 1.5];
  const E = { all: W(100, 30000, 0, 0, 100, 0, 80), l12: W(80, 30000, 0, 80, 80, 0, 110) }, AE = { all: W(1000, 15000, 0, 100, 1000, 0, 60), l12: W(500, 20000, 0, 50, 500, 0, 60) };
  const why = F.evWhy(E, AE, false, 1);
  ok(/Why it is 50% above its area/.test(why) && /100% of its sales here are off-plan, against 10% for the area/.test(why) && /typically/.test(why) && /cannot say how much of the gap each one explains/.test(why), "far from the area (+50%): says why, only from the data (off-plan share, size), and does not claim to split the gap", why);
  const near = F.evWhy({ all: W(100, 21000, 0, 0, 100, 0, 60), l12: W(100, 21000, 0, 0, 100, 0, 60) }, AE, false, 1);
  ok(/within 20% of its area/.test(near), "within 20%: no explanation invented");
  ok(F.evWhy(E, AE, true, 1) === "", "an area drawer has no developer-versus-area sentence");
}

console.log("F - the index: old format untouched, evidence added");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dm322um_"));
  const um = { district: "t1", buildings_by_id: { 1: { name: "Tower One", developer: "Acme Developers", rows: [{ type: "1 B/R", median_aed: 1000000, median_sqm: 60 }], dld_sales: { sold_by_type: { "1 B/R": 12 } } } } };
  fs.writeFileSync(path.join(dir, "um_t1.raw"), JSON.stringify(um));
  const geo = { districts: [{ slug: "t1", name: "Test", corridor: "x", bbox: [55, 25, 55.1, 25.1], centre: [55.05, 25.05] }] };
  const base = { umDir: dir, prices: { items: [] }, rent: { items: [] }, geo, ejariProjects: null, outAsOf: "2026-10-04", shares: null, offplanDir: null, offplanSlugs: [], register: null };
  const plain = buildIndex({ ...base });
  const plain2 = buildIndex({ ...base, evidence: null, projdevOut: null });
  const strip = (i) => JSON.stringify({ ...i, generated: 0 });
  ok(strip(plain) === strip(plain2), "no evidence given: the index is exactly the old format (no ev, no c12)");
  ok(!JSON.stringify(plain).includes("c12") && !plain.ev, "no ev or c12 anywhere without evidence");
  const projdevOut = { slugs: {}, global: {} };
  buildIndex({ ...base, projdevOut });
  const dk = Object.keys(plain.areas.t1.devs)[0];
  ok(projdevOut.slugs.t1["tower one"] === dk, "the project-to-developer map names Tower One -> its developer id", JSON.stringify(projdevOut.slugs));
  const W13 = (n, m) => [n, m, 0, 0, n, m, n, m, 0, 0, 50, 70, 120];
  const evidence = { meta: { as_of: "2026-08-31", l12_from: "2025-09-01", l12_to: "2026-08-31" }, areas: { t1: { dld: ["Test Area"], shared: false, ev: { all: W13(40, 17000), l12: W13(10, 19000), y: [[2025, 20, 18000]], first: "2019-01-02", last: "2026-08-30" },
    devs: { [dk]: { ev: { all: W13(12, 16667), l12: W13(4, 19000) }, c12: [[4, 19000, 1100000, 1]] }, newdev: { c12: [[6, 21000, 1300000, 2]] } } } } };
  const withEv = buildIndex({ ...base, evidence });
  const d0 = withEv.areas.t1.devs[dk];
  ok(JSON.stringify(d0.c) === JSON.stringify(plain.areas.t1.devs[dk].c) && JSON.stringify(d0.h) === JSON.stringify(plain.areas.t1.devs[dk].h), "the developer's old building cells and homes are untouched");
  ok(d0.ev && d0.c12.length === 1 && withEv.areas.t1.ev.all[0] === 40 && withEv.ev.l12_to === "2026-08-31", "evidence is attached to the developer, the area and the index");
  ok(withEv.areas.t1.devs.newdev && withEv.areas.t1.devs.newdev.c.length === 0 && withEv.areas.t1.devs.newdev.c12.length === 1 && withEv.devs.newdev && withEv.devs.newdev.n === 6, "a developer with sales only in the last 12 months gets a slot with no old cells, and is counted");
  ok(JSON.stringify(withEv.cuts) === JSON.stringify(plain.cuts), "tier cuts are untouched");
}

console.log("G - the scripts");
{
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")), "..");
  let okPy = true; try { execFileSync("python", ["-m", "py_compile", path.join(root, "scripts", "build_area_evidence.py")], { stdio: "pipe" }); } catch (e) { okPy = false; }
  ok(okPy, "build_area_evidence.py compiles");
  const ps = fs.readFileSync(path.join(root, "scripts", "publish_devmap_evidence.ps1"), "utf8");
  ok(/Test-QuietWindow/.test(ps) && /devmap_index\.backup\.json/.test(ps) && /Stop-Here/.test(ps) && !/--remote/.test(ps.replace(/no --remote flag/g, "")), "publish script: quiet-window guard, backup of the live index, stops at first failure, no --remote flag");
  ok(/-DryRun/.test(ps) && /Put-Kv "img_devmap_index"/.test(ps) && ps.indexOf("if ($DryRun)") < ps.indexOf("Put-Kv"), "dry run exits before the put");
}

console.log("H - districts that had polygons but were missing from the district list (Ras Al Khor, Bukadra, Liwan)");
{
  const geo = { districts: [{ slug: "a", name: "A", bbox: [1, 1, 2, 2], centre: [1.5, 1.5] }] };
  const polys = { features: [
    { properties: { slug: "a", name: "A again" }, geometry: { type: "Polygon", coordinates: [[[1, 1], [2, 1], [2, 2], [1, 1]]] } },
    { properties: { slug: "rasalkhor", name: "Sobha One / Ras Al Khor" }, geometry: { type: "MultiPolygon", coordinates: [[[[55.30, 25.15], [55.34, 25.15], [55.34, 25.19], [55.30, 25.15]]], [[[55.31, 25.14], [55.32, 25.14], [55.32, 25.16], [55.31, 25.14]]]] } },
    { properties: { slug: "nogeometry", name: "x" } } ] };
  const m = mergeDistricts(geo, polys);
  const r = m.districts.find((d) => d.slug === "rasalkhor");
  ok(m.districts.length === 2 && m.added.join() === "rasalkhor", "a district already in the list is not added twice; one without an outline is skipped; Ras Al Khor is added", JSON.stringify(m.added));
  ok(r && r.name === "Sobha One / Ras Al Khor" && JSON.stringify(r.bbox) === JSON.stringify([55.3, 25.14, 55.34, 25.19]) && Math.abs(r.centre[0] - 55.32) < 1e-9, "its box and centre are worked out from the outline, name from the polygon file", JSON.stringify(r));
  ok(labelledName("rasalkhor", "x") === "x" && labelledName("bukadra", "x") === "x", "community labels (v373): Sobha One and Sobha Hartland II are mixed districts (92% and 82% of the sales), so the district shows its Land Department name only");
  const { COMMUNITY_LABELS } = await import("../src/community_labels.js");
  ok(/wildlife sanctuary/.test(COMMUNITY_LABELS.rasalkhor.why) && /82%/.test(COMMUNITY_LABELS.bukadra.why) && communitiesOf("bukadra").length === 1, "each new label carries its reason (the share of register sales that backs it)");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dm322nocards_"));
  const ev = { meta: { l12_to: "2026-08-31" }, areas: { rasalkhor: { dld: ["Ras Al Khor Industrial First"], shared: false, ev: { all: [10, 20000, 0, 0, 10, 20000, 10, 20000, 0, 0, 50, 70, 120], l12: [4, 21000, 0, 0, 4, 21000, 4, 21000, 0, 0, 50, 70, 120], y: [], first: "2024-03-19", last: "2026-08-27" }, devs: { sobha: { c12: [[4, 21000, 1.4e6, 1]], ev: { all: [10, 20000, 0, 0, 10, 20000, 10, 20000, 0, 0, 50, 70, 120], l12: [4, 21000, 0, 0, 4, 21000, 4, 21000, 0, 0, 50, 70, 120] } } } } } };
  const idx = buildIndex({ umDir: dir, prices: { items: [] }, rent: { items: [] }, geo: m, ejariProjects: null, outAsOf: "x", shares: null, offplanDir: null, offplanSlugs: [], register: null, evidence: ev });
  ok(idx.areas.rasalkhor && idx.areas.rasalkhor.label === undefined && idx.areas.rasalkhor.devs.sobha.c12.length === 1, "a district with register sales but no card file is built from the evidence alone (v373: no borrowed community label)");
  const idx0 = buildIndex({ umDir: dir, prices: { items: [] }, rent: { items: [] }, geo: m, ejariProjects: null, outAsOf: "x", shares: null, offplanDir: null, offplanSlugs: [], register: null });
  ok(!idx0.areas.rasalkhor, "without evidence and without cards the district is still left out (old behaviour)");
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
