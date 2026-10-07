// v386 - register facts in the developer index, and PLOT POSITIONS for cards that have no building outline. Offline: fixtures and stubs only, no network, no KV, no deploy.
//   node test/test_v386_plots.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { devmapHtml } from "../src/devmap_page.js";
import { DM, attachRegFacts } from "../scripts/build_devmap_index.mjs";
import { PHOSPHOR_LIGHT } from "../src/devmap_icons.js";
import { PLOTPOS_JS } from "../src/plotpos_page.js";
import { cleanPlotPos } from "../src/plotpos.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 500) : "")); } };
const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.dirname(HERE);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "v386_"));
const py = (script, args) => spawnSync("python", [path.join(REPO, "scripts", script), ...args], { encoding: "utf8" });
const W = (f, t) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); };

console.log("A - register facts: present when the sources have them, absent otherwise (no placeholders)");
{
  const d = path.join(TMP, "facts"), land = path.join(d, "board");
  const hdr = "project_id,project_number,project_name,district,project_status,percent_completed,units_register,reg_units,project_end_date";
  W(path.join(d, "projects.csv"), [hdr,
    "10,100,Full Tower,Fixture Area,ACTIVE,62.4,120,120,2027-03-31",
    "11,101,Bare Tower,Other Area,,,,,",
    "12,102,Elsewhere Tower,Uncovered Area,NOT_STARTED,0,50,50,2029-12-31",
    "13,103,Parcelless Tower,Fixture Area,PENDING,0,40,40,2030-01-01"].join("\n"));
  W(path.join(d, "types.json"), JSON.stringify({ rows: [
    { project_number: 100, bedrooms: "studio", units: 10 }, { project_number: 100, bedrooms: "1", units: 50 }, { project_number: 100, bedrooms: "2", units: 30 },
    { project_number: 100, bedrooms: "5", units: 2 }, { project_number: 100, bedrooms: "6+", units: 1 }, { project_number: 100, bedrooms: null, units: 27 },
    { project_number: 102, bedrooms: null, units: 50 }] }));
  W(path.join(land, "land_registry_fixture.json"), JSON.stringify({ area: "Fixture Area", plots: [
    { parcel_id: "9001", project_id: "10", project_name_en: "Full Tower" }, { parcel_id: "9002", project_id: "10", project_name_en: "Full Tower" }, { parcel_id: "9003", project_id: null, project_name_en: "Other" }] }));
  const out = path.join(d, "rf.json");
  const r = py("build_register_facts.py", ["--csv", path.join(d, "projects.csv"), "--types", path.join(d, "types.json"), "--land", land, "--out", out]);
  ok(r.status === 0, "the facts builder runs on a fixture", r.stderr);
  const rf = JSON.parse(fs.readFileSync(out, "utf8")).p;
  ok(rf["100"] && rf["100"].st === "ACTIVE" && rf["100"].pc === 62 && rf["100"].pe === "2027-03-31" && rf["100"].u === 120 && rf["100"].pl === 2, "a full project carries status, percent, planned end, units and two parcels", JSON.stringify(rf["100"]));
  ok(JSON.stringify(rf["100"].mix) === "[10,50,30,0,3]", "mix is [studio, 1, 2, 3, 4+]: 5 and 6+ bedrooms join 4+, an unstated bedroom count is not counted", JSON.stringify(rf["100"].mix));
  ok(!rf["101"], "a project the register says nothing about gets no record at all (no placeholder)");
  ok(rf["102"] && !("mix" in rf["102"]) && !("pl" in rf["102"]), "no bedroom counts: no mix; a district with no land registry file: no pl (unknown stays absent)", JSON.stringify(rf["102"]));
  ok(rf["103"] && rf["103"].pl === 0, "pl is 0 only for a project in a district whose land registry we hold and which has no parcel", JSON.stringify(rf["103"]));
  ok(Object.values(rf).every((o) => Object.values(o).every((v) => v !== null && v !== "" && !Number.isNaN(v))), "no null, empty or NaN anywhere");
  const rf2 = path.join(d, "rf2.json"); py("build_register_facts.py", ["--csv", path.join(d, "projects.csv"), "--types", path.join(d, "types.json"), "--land", land, "--out", rf2]);
  ok(fs.readFileSync(out, "utf8") === fs.readFileSync(rf2, "utf8"), "re-running gives the same bytes");
}

console.log("B - the index builder adds the facts to bx and b12x, additively");
{
  const mk = () => ({ dist: { devs: { x: { bx: [{ p: 100, e: "REGISTER_VERIFIED", a: "A", h: 5 }, { p: null, e: "UNVERIFIED" }, { p: 101, e: "NAME_ONLY" }], b12x: [{ p: 100, e: "REGISTER_VERIFIED" }] }, "_": { bx: [{ p: 100, e: "X", pc: 99 }] } } } });
  const before = mk(), A = mk();
  attachRegFacts(A, { "100": { st: "ACTIVE", pc: 62, pe: "2027-03-31", u: 120, mix: [10, 50, 30, 0, 3], pl: 2 } });
  const x = A.dist.devs.x;
  ok(x.bx[0].st === "ACTIVE" && x.bx[0].pc === 62 && x.bx[0].pe === "2027-03-31" && x.bx[0].u === 120 && x.bx[0].pl === 2 && JSON.stringify(x.bx[0].mix) === "[10,50,30,0,3]", "bx[i] gets st, pc, pe, u, mix, pl");
  ok(x.b12x[0].st === "ACTIVE" && x.b12x[0].pl === 2, "b12x[i] (the last-12-month window) gets them too");
  ok(Object.keys(before.dist.devs.x.bx[0]).every((k) => x.bx[0][k] === before.dist.devs.x.bx[0][k]), "the old keys are unchanged");
  ok(JSON.stringify(x.bx[1]) === JSON.stringify(before.dist.devs.x.bx[1]) && JSON.stringify(x.bx[2]) === JSON.stringify(before.dist.devs.x.bx[2]), "a record with no project number, or a number the register file does not know, is left exactly as it was (no placeholder)");
  ok(A.dist.devs._.bx[0].pc === 99, "a key the record already has is never overwritten");
  const none = mk(); attachRegFacts(none, {}); ok(JSON.stringify(none) === JSON.stringify(before), "an empty facts file changes nothing");
  const real = path.join(HERE, "..", "data", "regfacts", "register_facts.json"), audit = "C:/Dev/naj-market-pulse/docs/CARD_MAP_POSITION_AUDIT_07OCT2026/idx.json";
  if (fs.existsSync(real) && fs.existsSync(audit)) {
    const idx = JSON.parse(fs.readFileSync(audit, "utf8")), n0 = Buffer.byteLength(JSON.stringify(idx));
    attachRegFacts(idx.areas, JSON.parse(fs.readFileSync(real, "utf8")).p);
    const n1 = Buffer.byteLength(JSON.stringify(idx));
    ok(n1 < 2.0 * 1024 * 1024, "the live-shaped index (" + n0 + " bytes) with the real facts is " + n1 + " bytes, under the 2,048 KB evidence check limit");
  } else console.log("  skip - audit copy of the live index or the real facts file not on this machine");
}

console.log("C - plot positions: computed from the held outlines");
const sqRing = (lon, lat, w, h) => [lon, lat, lon + w, lat, lon + w, lat + h, lon, lat + h, lon, lat].reduce((s, v, i) => s + (i ? (i % 2 ? "," : ", ") : "") + v, "");
const pp = (() => {
  const d = path.join(TMP, "pos"), plots = path.join(d, "plots");
  const hdr = "district,project_no,register_status,clickable,parcels,project";
  const par = (n, start) => Array.from({ length: n }, (_, i) => String(start + i));
  const rows = [hdr,
    "dist1,1,NOT_STARTED,no,7001,One Plot",
    "dist1,2,ACTIVE,no,7002;7003,Two Plots",
    "dist1,3,ACTIVE,no,7004,No Outline Held",
    "dist1,4,ACTIVE,no,7005;7006,Partly Held",
    "dist1,5,ACTIVE,yes,7007,Already On The Map",
    "dist2,6,FINISHED,no," + par(41, 8000).join(";") + ",Community",
    "dist1,7,PENDING,no,,No Parcel",
    "dist1,8,ACTIVE,no,7010;7011,Dispersed",
    "dist1,9,NOT_STARTED,no,7012,Shares A Plot",
    "dist1,10,ACTIVE,yes,7012,The Sibling",
    "dist1,11,ACTIVE,no,7013,Null Shape"];
  W(path.join(d, "ledger.csv"), rows.join("\n"));
  const rec = (id, shape, at) => JSON.stringify({ parcel_id: id, shape, buildings: [], makani: [], at: at || "2026-10-06T10:00:00" });
  const lines = [rec(7001, sqRing(55.1, 25.1, 0.01, 0.01)), rec(7002, sqRing(55.1, 25.1, 0.01, 0.01)), rec(7003, sqRing(55.12, 25.1, 0.005, 0.005), "2026-10-07T08:00:00"),
    rec(7005, sqRing(55.1, 25.1, 0.001, 0.001)), rec(7007, sqRing(55.1, 25.1, 0.001, 0.001)), rec(7010, sqRing(55.1, 25.1, 0.01, 0.01)), rec(7011, sqRing(55.2, 25.1, 0.01, 0.01)),
    rec(7012, sqRing(55.3, 25.2, 0.001, 0.001)), rec(7013, null)].concat(par(41, 8000).map((i) => rec(i, sqRing(55.1, 25.3, 0.001, 0.001))));
  W(path.join(plots, "makani_a.jsonl"), lines.join("\n") + "\n" + '{"parcel_id": 7004, "shape": "55.1,25.1, 55.1');   // the last line is half written, as a running crawl leaves it
  const out = path.join(d, "pos.json"), r = py("build_plot_positions.py", ["--ledger", path.join(d, "ledger.csv"), "--plots-dir", plots, "--out", out]);
  return { r, out, d, plots, J: r.status === 0 ? JSON.parse(fs.readFileSync(out, "utf8")) : null };
})();
ok(pp.r.status === 0, "the builder runs offline on fixtures", pp.r.stderr);
const P = pp.J.p;
ok(P["1"] && P["1"].lon === 55.105 && P["1"].lat === 25.105 && P["1"].n_plots === 1 && JSON.stringify(P["1"].parcels) === '["7001"]', "one square plot: the position is its centre, 5 decimals", JSON.stringify(P["1"]));
ok(P["2"] && P["2"].lon === 55.1085 && P["2"].lat === 25.1045 && P["2"].n_plots === 2, "two plots: the area-weighted centre of both (the centre of their union)", JSON.stringify(P["2"]));
ok(!P["3"], "a card whose parcel has no held outline gets NO position");
ok(!P["4"], "a project with only some of its outlines held waits (no position from part of the plots)");
ok(!P["5"] && !P["7"], "a card that is already clickable, or has no parcel, gets none");
ok(!P["6"], "more than 40 parcels (a community): no entry, not invented");
ok(!P["8"], "plots more than 3 km apart are not averaged into one point");
ok(!P["11"], "a parcel whose outline is null is not held");
ok(P["9"] && P["9"].shared && P["9"].shared.join() === "10" && /shared with another registered project/.test(P["9"].label), "a plot shared with a sibling project says so", JSON.stringify(P["9"]));
ok(P["1"].basis === "makani_plot_outline" && P["1"].evidence === "DERIVED" && P["1"].link === "REGISTER_VERIFIED", "basis, DERIVED position and REGISTER_VERIFIED link are stated on every entry");
ok(P["1"].label === "Plot position (centre of the registered plot), building not built yet", "NOT_STARTED label, exact words", P["1"].label);
ok(P["2"].label === "Plot position (centre of the registered plot); the building outline is not on our map yet", "built or under construction: the other label, exact words", P["2"].label);
ok(P["1"].as_of === "2026-10-06" && P["2"].as_of === "2026-10-07", "as_of is the newest outline record behind each entry (deterministic)");
ok(Object.keys(P).sort().join() === "1,2,9", "exactly the three honest entries", Object.keys(P).join());
ok(pp.J.meta.counts.awaiting_outlines === 3 && pp.J.meta.counts.community_over_40 === 1 && pp.J.meta.counts.dispersed === 1, "the counts name what waits", JSON.stringify(pp.J.meta.counts));
const again = path.join(pp.d, "pos2.json"); py("build_plot_positions.py", ["--ledger", path.join(pp.d, "ledger.csv"), "--plots-dir", pp.plots, "--out", again]);
ok(fs.readFileSync(pp.out, "utf8") === fs.readFileSync(again, "utf8"), "re-running gives the same bytes");
W(path.join(pp.plots, "makani_b.jsonl"), JSON.stringify({ parcel_id: 7004, shape: sqRing(55.14, 25.14, 0.002, 0.002), at: "2026-10-07T12:00:00" }) + "\n");
const grown = path.join(pp.d, "pos3.json"); py("build_plot_positions.py", ["--ledger", path.join(pp.d, "ledger.csv"), "--plots-dir", pp.plots, "--out", grown]);
ok(JSON.parse(fs.readFileSync(grown, "utf8")).p["3"], "more outlines arriving later: the next run adds the card (re-runnable)");
const L = [[55.1, 25.1], [55.102, 25.1], [55.102, 25.101], [55.101, 25.101], [55.101, 25.102], [55.1, 25.102], [55.1, 25.1]].map((q) => q.join(",")).join(", ");
W(path.join(pp.plots, "makani_c.jsonl"), JSON.stringify({ parcel_id: 7099, shape: L, at: "2026-10-07T12:00:00" }) + "\n");
W(path.join(pp.d, "ledger_l.csv"), "district,project_no,register_status,clickable,parcels\ndist1,99,ACTIVE,no,7099\n");
const lo = path.join(pp.d, "pos_l.json"); py("build_plot_positions.py", ["--ledger", path.join(pp.d, "ledger_l.csv"), "--plots-dir", pp.plots, "--out", lo]);
const Lp = JSON.parse(fs.readFileSync(lo, "utf8")).p["99"];
ok(Lp && Math.abs(Lp.lon - 55.10083) < 0.00002 && Math.abs(Lp.lat - 25.10083) < 0.00002, "an L-shaped plot: the centroid of the shape, not of its bounding box (3 squares: 55.10083, 25.10083)", JSON.stringify(Lp));
ok(cleanPlotPos(pp.J) && Object.keys(cleanPlotPos(pp.J).p).length === 3 && cleanPlotPos({}) === null && cleanPlotPos({ p: { 1: { lon: 1, lat: 1, evidence: "DERIVED", label: "x" } } }) === null && cleanPlotPos({ p: { 1: { lon: 55.1, lat: 25.1, evidence: "VERIFIED", label: "x" } } }) === null, "the route's shape check keeps real DERIVED positions and drops anything else; nothing valid = absent");

console.log("D - the publish script is a dry run by default, with a rollback line, and does not use a shell string for the put");
{
  const src = fs.readFileSync(path.join(REPO, "scripts", "publish_plot_positions.py"), "utf8");
  ok(/KEY = "img_plot_positions"/.test(src) && /if not a\.apply:[\s\S]*DRY RUN/.test(src), "key img_plot_positions; dry run unless --apply");
  ok(/already holds a value[\s\S]*--replace/.test(src) && /before_v386_/.test(src) && /ROLLBACK|roll back/i.test(src) && /240 <= mins < 375/.test(src), "refuses to overwrite without --replace, backs up, prints the rollback line, refuses 04:00-06:15 Dubai");
  ok(/subprocess\.run\(\[npx, "wrangler", "kv", "key", "put", KEY, "--path", a\.file/.test(src) && !/shell=True/.test(src) && !/cmd \/c/.test(src.replace(/KNOWN WINDOWS BUG[\s\S]*?\n"""/, "")), "the put is wrangler called with a LIST of arguments, no shell string, no cmd /c");
  ok(/json\.load\(open\(back[\s\S]*!= json\.load\(open\(a\.file/.test(src), "read-back compare");
  const h = spawnSync("python", [path.join(REPO, "scripts", "publish_plot_positions.py"), "--help"], { encoding: "utf8" });
  ok(h.status === 0, "the script parses and prints help (it was NOT run against KV)");
}

console.log("E - the page: the marker path only with a position; the panel shows the label and DERIVED; old data renders as v385");
const html = devmapHtml("k", { NAJ_NAV_CSS: "", NAJ_FONTS: "", najNav: () => "" });
const js = html.slice(html.indexOf("<script>", html.indexOf("maplibre-gl.js")) + 8, html.lastIndexOf("</script>"));
const cut = (a, b) => js.slice(js.indexOf(a), js.indexOf(b));
const text = (h) => h.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
ok(js.includes("var PLOTPOS=") && js.indexOf("var PLOTPOS=") < js.indexOf("function esc(t)"), "the page carries the PLOTPOS module ahead of its own script");
DM.TIER_CFG.bounds = [30000, 20000, 12000];
const IDX = { as_of: "2026-09-09", cuts: { bounds: [30000, 20000, 12000] }, devs: { x: { name: "X", areas: 1, n: 40, profile: { projects: 4, homes: 0 } } }, areas: {
  dist: { name: "Fixture District", devs: { x: { n: "X", h: 0, c: [[40, 21000, 1e6, 1]], b: [[10, 35000, "Tower One"], [8, 21000, "Plot Tower"], [7, 22000, "Plain Tower"], [6, 20000, "Built Tower"]], r: [] } } } } };
const EV = {
  plot: { p: 3719, di: 1, dn: "FIXTURE DEVELOPMENT L.L.C", m: "project_id", e: "REGISTER_VERIFIED", a: "Fixture District", st: "NOT_STARTED", pl: 1, u: 703, mix: [0, 544, 130, 29, 0], pc: 0, pe: "2029-12-31" },
  plain: { p: 5, di: 1, dn: "FIXTURE DEVELOPMENT L.L.C", m: "project_id", e: "REGISTER_VERIFIED", a: "Fixture District", st: "NOT_STARTED", pl: 1 },
  built: { p: 777, di: 1, dn: "FIXTURE DEVELOPMENT L.L.C", m: "project_id", e: "REGISTER_VERIFIED", a: "Fixture District", st: "ACTIVE" }
};
const POS = { meta: { as_of: "2026-10-06" }, p: {
  "3719": { lon: 55.1234, lat: 25.2345, parcels: ["3210129"], n_plots: 1, basis: "makani_plot_outline", evidence: "DERIVED", link: "REGISTER_VERIFIED", label: "Plot position (centre of the registered plot), building not built yet", as_of: "2026-10-06", st: "NOT_STARTED", d: "dist" },
  "777": { lon: 55.2, lat: 25.3, parcels: ["1", "2"], n_plots: 2, basis: "makani_plot_outline", evidence: "DERIVED", link: "REGISTER_VERIFIED", label: "Plot position (centre of the registered plot); the building outline is not on our map yet", as_of: "2026-10-06", st: "ACTIVE", d: "dist" } } };
const s0 = cut("function esc(t)", "function api("), s1 = cut("function fmt(n)", "(function(){var b=new URLSearchParams(location.search).get(\"bounds\")");
const body = (withPlot) => "var $=function(id){return document.getElementById(id)};var KEY=\"k\";var fetch=function(){return new Promise(function(){})};" + (withPlot ? PLOTPOS_JS : "") + s0 + s1
  + cut("function clipName", "function devHead(") + cut("function icoSvg", "function evidenceHtml")
  + cut("var BLK={}", "var PULSE=0") + cut("function showSnap(p,pin)", "function focusProject") + cut("function tipHtml", "function drillHtml")
  + cut("function invFromApi", "function pdfRowProf")
  + "; return {BLK:BLK,PJ:PJ,PDET:PDET,pjCard:pjCard,pdOpen:pdOpen,pdClose:pdClose,pdWhy:pdWhy,invIndex:invIndex,pjDetailHtml:pjDetailHtml,locate:locate" + (withPlot ? ",PLOTPOS:PLOTPOS" : "") + "};";
const mkEl = (id) => ({ id, innerHTML: "", style: {}, className: "", offsetHeight: 300, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, focus() { this.focused = true; } });
const mkMap = () => { const m = { src: {}, layers: [], flown: [], data: null, getSource(n) { return m.src[n] || null; }, addSource(n, o) { m.src[n] = { setData(d) { m.data = d; } }; m.data = o.data; }, addLayer(l) { m.layers.push(l); }, isStyleLoaded: () => true, flyTo(o) { m.flown.push(o); } }; return m; };
const make = (withPlot, data, map) => {
  const els = {}, doc = { getElementById: (i) => els[i] || null, createElement: () => mkEl(""), body: { appendChild: (e) => { els[e.id] = e; } }, addEventListener: () => {} };
  const S = { evOpen: false, sel: "dist", unit: "sqft", win: "all", inv: null }, sheet = [];
  const fn = new Function("DM", "IDX", "S", "TC", "document", "renderDetail", "updatePj", "EVI", "innerWidth", "map", "setSheet", body(withPlot));
  const Pg = fn(DM, IDX, S, ["#c5a56a", "#2f8a7f", "#3987e5", "#8a9a96"], doc, () => {}, () => {}, PHOSPHOR_LIGHT, 375, map, (v) => sheet.push(v));
  if (withPlot && data !== undefined) Pg.PLOTPOS.load(data);
  Pg.BLK.dist = { state: "ok", feats: [{ type: "Feature", geometry: { type: "Polygon", coordinates: [[[55.1, 25.1], [55.101, 25.1], [55.101, 25.101], [55.1, 25.101], [55.1, 25.1]]] }, properties: { i: 0, n: "Tower One", k: "towerone", a: 9000 } }] };
  return { Pg, els, sheet };
};
const cardOf = (Pg, name, ev) => Pg.pjCard("dist", name, 21000, 8, "", "x", ev);
const dkOf = (h) => (h.match(/data-pd="([^"]+)"/) || [])[1];
{
  const map = mkMap(), { Pg, els, sheet } = make(true, POS, map);
  const plot = cardOf(Pg, "Plot Tower", EV.plot), plain = cardOf(Pg, "Plain Tower", EV.plain), built = cardOf(Pg, "Built Tower", EV.built), tower = cardOf(Pg, "Tower One", EV.plain);
  ok(/class="pjc noloc plot"/.test(plot) && /Show on the map/.test(plot) && !/Project details/.test(plot) && /aria-label="Show the plot of Plot Tower on the map"/.test(plot), "a card with no outline but a plot position reads 'Show on the map' and has an accessible name");
  ok(/class="pjc noloc" data-pd/.test(plain) && /Project details/.test(plain) && !/Show on the map/.test(plain), "a no-outline card with NO plot position stays 'Project details'");
  ok(/class="pjc loc"/.test(tower), "a card with a building footprint is unchanged (real building path)");
  ok(map.layers.length === 0 && !map.flown.length, "nothing is drawn or flown before a tap");
  Pg.pdOpen(dkOf(plain), mkEl("f"));
  ok(map.flown.length === 0 && (!map.data || map.data.features.length === 0), "opening a card with no position never draws a marker or moves the map");
  Pg.pdOpen(dkOf(plot), mkEl("f"));
  const f = map.flown[0], ids = map.layers.map((l) => l.id);
  ok(f && f.center[0] === 55.1234 && f.center[1] === 25.2345 && f.zoom >= 16, "the tap flies to the plot centre");
  ok(map.data.features.length === 1 && map.data.features[0].geometry.type === "Point" && map.data.features[0].properties.label === "Plot position, not a building", "the marker is one POINT labelled 'Plot position, not a building'");
  const ring = map.layers.find((l) => l.id === "pp-ring");
  ok(ring && ring.type === "circle" && ring.paint["circle-opacity"] === 0 && ring.paint["circle-stroke-width"] >= 3 && !ids.some((i) => /fill|extrusion/.test(i)), "the marker is a hollow ring (no fill, no footprint polygon layer)", ids.join());
  ok(!map.layers.some((l) => l.type === "fill" || l.type === "fill-extrusion"), "no fill layer is added for a plot");
  ok(f.padding && f.padding.bottom > 100 && sheet[0] === false, "on a phone the sheet folds and the plot sits above the panel (bottom padding)");
  const t = text(els.pjdet.innerHTML);
  ok(/Plot position \(centre of the registered plot\), building not built yet/.test(t) && /DERIVED/.test(t) && /REGISTER_VERIFIED/.test(t) && /3210129/.test(t) && /25\.23450, 55\.12340/.test(t), "the panel shows the position line, its label, the DERIVED tag and the register link", t.slice(0, 900));
  ok(/Not built yet, so there is no building to show on the map\. The register holds its land parcel\./.test(t) && /Plot position \(centre of the registered plot\), building not built yet\./.test(t), "the 'why' line keeps its first meaning and adds the plot label");
  ok(/Registered units 703 units; 1 bed: 544, 2 bed: 130, 3 bed: 29/.test(t) || (/703 units/.test(t) && /1 bed: 544/.test(t)), "the unit mix array [studio, 1, 2, 3, 4+] is shown without zero entries", t);
  ok(!/building outline is on our map/.test(t) || /not on our map/.test(t), "never says a plot centre is a building");
  Pg.pdOpen(dkOf(plain), mkEl("f"));
  ok(map.data.features.length === 0, "opening another card clears the plot marker");
  const m2 = mkMap(), b = make(true, POS, m2); const bc = cardOf(b.Pg, "Built Tower", EV.built); b.Pg.pdOpen(dkOf(bc), mkEl("f"));
  const tb = text(b.els.pjdet.innerHTML);
  ok(/The building outline is not on our map yet\. Plot position \(centre of the registered plot\); the building outline is not on our map yet\./.test(tb) && /DERIVED/.test(tb), "an ACTIVE project: its own why line, then the plot label", tb.slice(0, 700));
  ok(!/Plot position/.test(text(Pg.pjDetailHtml(dkOf(tower) || dkOf(plain), true))), "the building snapshot (located) never carries a plot position");
}
{
  const a = make(false, undefined, null), b = make(true, {}, mkMap()), c = make(true, null, mkMap());
  const cases = [["Plot Tower", EV.plot], ["Plain Tower", EV.plain], ["Built Tower", EV.built], ["Tower One", EV.plain], ["Unknown", null]];
  const same = cases.every(([n, ev]) => { const ha = cardOf(a.Pg, n, ev), hb = cardOf(b.Pg, n, ev), hc = cardOf(c.Pg, n, ev); return ha.replace(/data-pd="[^"]*"/, "") === hb.replace(/data-pd="[^"]*"/, "") && ha.replace(/data-pd="[^"]*"/, "") === hc.replace(/data-pd="[^"]*"/, ""); });
  ok(same, "with no plot file (absent, empty or null) every card renders exactly as v385");
  const detail = (x, n, ev) => { const h = cardOf(x.Pg, n, ev); x.Pg.pdOpen(dkOf(h), mkEl("f")); return x.els.pjdet.innerHTML; };
  ok(detail(a, "Plot Tower", EV.plot) === detail(b, "Plot Tower", EV.plot) && detail(a, "Built Tower", EV.built) === detail(c, "Built Tower", EV.built), "and every detail panel is identical to v385 without plot data");
  const old = { p: 100, e: "REGISTER_VERIFIED", dn: "X" };
  ok(!/Plot position|DERIVED.*Plot/.test(text(detail(b, "Plain Tower", old))), "an old index (no st, pc, pe, u, mix, pl) with plot data present but no match: no plot line");
}
{
  const ok1 = (() => { try { new Function(js); return true; } catch (e) { return e.message; } })();
  ok(ok1 === true, "the whole page script parses", ok1);
  ok(/what === "plotpos"/.test(fs.readFileSync(path.join(REPO, "src", "devmap_page.js"), "utf8")) && /api\("plotpos"\)\.catch/.test(js), "the route what=plotpos exists and the page loads it, a failure meaning nothing");
  ok(!/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/u.test(PLOTPOS_JS), "no emoji in the plot module (icons come from the set)");
}
fs.rmSync(TMP, { recursive: true, force: true });
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
