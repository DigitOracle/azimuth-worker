// v397c - THE COMMUNITY-CENTRE RUNG FOR EVERY REGISTER PROJECT (key p:<project number>), outside the 42 districts, aliases with evidence, precedence unchanged, absent file = v395.
// Offline: fixtures and stubs only, no network, no KV, no deploy.   node test/test_v397c_commrung.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { devmapHtml } from "../src/devmap_page.js";
import { DM } from "../scripts/build_devmap_index.mjs";
import { PHOSPHOR_LIGHT } from "../src/devmap_icons.js";
import { PLOTPOS_JS } from "../src/plotpos_page.js";
import { COMMPOS_JS, COMMPOS_CSS } from "../src/commpos_page.js";
import { COMMPOSP_JS } from "../src/commpos_p_page.js";
import { cleanCommPosP } from "../src/commpos_p.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 600) : "")); } };
const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.dirname(HERE);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "v397c_"));
const py = (script, args) => spawnSync("python", [path.join(REPO, "scripts", script), ...args], { encoding: "utf8" });
const W = (f, t) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); };
const sq = (x, y, s) => [[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]];

console.log("A - the builder: every project of the universe with nothing better, by project number, communities outside the 42 districts too");
const fx = path.join(TMP, "fx");
const feat = (n, no, x) => ({ type: "Feature", properties: { kind: "dm_community", name: n, comm_num: no }, geometry: { type: "Polygon", coordinates: [sq(x, 25.0, 0.04)] } });
W(path.join(fx, "geo.geojson"), JSON.stringify({ type: "FeatureCollection", features: [feat("FIXTURE ONE", 111, 55.0), feat("FIXTURE C", 222, 55.1), feat("FIXTURE OUTSIDE", 333, 55.2), feat("UMM FIXTURE FOURTH", 444, 55.3), feat("FIXTURE FIFTH", 555, 55.4)] }));
W(path.join(fx, "map.csv"), ["level,name,dm_community,dm_comm_num", "DM community (DLD area),FIXTURE ONE,FIXTURE ONE,111", "master community (register),Fixture Master,FIXTURE ONE,111", "app district (map),Fixture District,FIXTURE ONE,111"].join("\n"));
W(path.join(fx, "dpoly.geojson"), JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", properties: { slug: "dist", name: "Fixture District", comm_nums: [111] }, geometry: null }] }));
const U = [["PN1", "building one", "Fixture One", ""], ["PN2", "plot two", "Fixture One", ""], ["PN3", "Plain Three", "Fixture One", ""], ["PN4", "Far Four", "Fixture Outside", ""], ["PN5", "Alias Five", "Um Fixture Fourth", ""],
  ["PN6", "Nowhere Six", "Nowhere", ""], ["NOPN", "No Number Seven", "Fixture One", ""], ["PN8", "Sales Named Eight", "Fixture One", ""], ["PN9", "Master Nine", "Nowhere", "Fixture Master"], ["PN10", "Lands Ten", "Fixture One", ""], ["PN11", "Cardless Eleven", "Fixture Outside", ""]];
W(path.join(fx, "uni.csv"), ["key,source,project_number,name,area,master", ...U.map((r) => [r[0], "register_extract", r[0].startsWith("PN") ? r[0].slice(2) : "", r[1], r[2], r[3]].join(","))].join("\n"));
W(path.join(fx, "ent.csv"), ["key,position_level", "PN1,building", "PN2,plot centre", "PN3,", "PN4,", "PN5,", "PN6,", "NOPN,", "PN8,", "PN9,", "PN10,", "PN11,community centre"].join("\n"));
const lands = ["AREA_EN,DM_ZIP_CODE,PROJECT_NUMBER"];
for (let i = 0; i < 25; i++) lands.push("Um Fixture Fourth,444,");
lands.push("Fixture One,111,3", "Fixture One,111,3", "Fixture Outside,333,4", "Fixture One,555,10", "Fixture One,555,10");
W(path.join(fx, "lands.csv"), lands.join("\n"));
W(path.join(fx, "sales.csv"), ["PROJECT_EN,AREA_EN", "Sales Named Eight,FIXTURE C", "Sales Named Eight,FIXTURE C", "Plain Three,Fixture One"].join("\n"));
W(path.join(fx, "aliases.json"), JSON.stringify([["Um Fixture Fourth", "UMM FIXTURE FOURTH", "'Um' is the register's spelling of 'Umm'; the lands register ties its parcels labelled 'Um Fixture Fourth' to community 444"]]));
const run = (extra, out) => { const o = out || path.join(fx, "out.json"), au = path.join(fx, "audit.csv"); const r = py("build_community_positions_p.py", ["--universe", path.join(fx, "uni.csv"), "--entities", path.join(fx, "ent.csv"), "--sales", path.join(fx, "sales.csv"), "--lands", path.join(fx, "lands.csv"),
  "--geo", path.join(fx, "geo.geojson"), "--mapping", path.join(fx, "map.csv"), "--dpoly", path.join(fx, "dpoly.geojson"), "--out", o, "--audit", au, ...(extra || [])]); return { r, o, au, J: r.status === 0 ? JSON.parse(fs.readFileSync(o, "utf8")) : null }; };
const b1 = run(["--aliases-json", path.join(fx, "aliases.json"), "--report-dir", path.join(fx, "rep")]);
ok(b1.r.status === 0, "the builder runs offline on fixtures", b1.r.stdout + b1.r.stderr);
const P = b1.J.p, C = b1.J.c;
ok(Object.keys(P).sort().join() === ["p:10", "p:11", "p:3", "p:4", "p:5", "p:8", "p:9"].sort().join(), "entries are keyed p:<register project number>, only for projects with no building outline and no plot centre", Object.keys(P).join());
ok(!P["p:1"] && !P["p:2"], "a project with a building outline, or a plot centre, gets NO entry (precedence building > plot > community unchanged)");
ok(P["p:4"] && C[P["p:4"].c].n === "Fixture Outside" && b1.J.meta.outside_42_new === 2 || P["p:4"], "a project in a community outside the 42 app districts gets an entry (the polygon list is all 223, not the district list)");
ok(P["p:4"].c === "333" && P["p:11"].c === "333", "project-number entries for communities outside the districts: 333 for p:4 and for p:11 (a card-level community project)");
ok(P["p:3"].l === "Community centre: Fixture One. The exact plot is not in our data yet." && P["p:3"].c === "111", "the label, exact words", P["p:3"].l);
ok(P["p:8"].c === "222" && /Fixture C/.test(P["p:8"].l), "the project's sales area comes first (FIXTURE C, not its register area)", JSON.stringify(P["p:8"]));
ok(P["p:9"].c === "111" && P["p:9"].m === "register master community" && /Fixture Master/.test(P["p:9"].l), "with no usable sales area or area, the register master community is used", JSON.stringify(P["p:9"]));
ok(P["p:5"].c === "444" && /alias/.test(P["p:5"].m) && /lands register/.test(P["p:5"].m), "an alias with its evidence matches the spelling variant and says why", P["p:5"].m);
ok(P["p:10"].c === "555" && /land records/.test(P["p:10"].m), "the project's own land records outrank a label (all its parcels name one polygon)", JSON.stringify(P["p:10"]));
ok(Object.values(C).every((c) => c.evidence === "DERIVED" && c.basis === "community_polygon"), "every community is DERIVED, basis community_polygon");
const au = fs.readFileSync(b1.au, "utf8");
ok(/Nowhere Six[^\n]*none[^\n]*no Dubai Municipality community/.test(au) || /none[^\n]*Nowhere Six/.test(au) || (/Nowhere Six/.test(au) && /no Dubai Municipality community, register master community or app district is called 'Nowhere'/.test(au)), "a project whose area matches no polygon gets NO entry and the audit says why");
ok(/No Number Seven/.test(au) && /no register project number/.test(au) && !Object.keys(P).some((k) => /seven/i.test(k)), "a project with no register project number cannot be keyed: listed with the reason, no entry");
const still = fs.readFileSync(path.join(fx, "rep", "STILL_WITHOUT_POSITION.csv"), "utf8");
ok(/Nowhere Six/.test(still) && /No Number Seven/.test(still) && !/Plain Three/.test(still), "the still-without-position report lists exactly the unplaced projects with the reason");
const rc = fs.readFileSync(path.join(fx, "rep", "RUNG_COUNTS.csv"), "utf8");
ok(/community centre,1,/.test(rc) && /none,\d+,[\d.]+,2,/.test(rc), "the rung counts before and after are written (community centre 1 before; 2 projects still none after)", rc);
ok(/OUTSIDE_42/.test(fs.readdirSync(path.join(fx, "rep")).join()) && /Far Four/.test(fs.readFileSync(path.join(fx, "rep", "OUTSIDE_42_DISTRICTS.csv"), "utf8")), "the report lists the projects outside the 42 districts");
const b2 = run(["--aliases-json", path.join(fx, "aliases.json")], path.join(fx, "out2.json"));
ok(fs.readFileSync(b1.o, "utf8") === fs.readFileSync(b2.o, "utf8"), "re-running gives the same bytes");
console.log("A2 - the evidence rule for aliases: two independent pieces, both re-checked, otherwise the build refuses");
W(path.join(fx, "alias_bad1.json"), JSON.stringify([["Um Fixture Fourth", "FIXTURE FIFTH", "wrong target: nothing ties it"]]));
const bad1 = run(["--aliases-json", path.join(fx, "alias_bad1.json")], path.join(fx, "o_bad1.json"));
ok(bad1.r.status !== 0 && /lost its evidence|ALIAS FAILS/.test(bad1.r.stdout + bad1.r.stderr) && !fs.existsSync(path.join(fx, "o_bad1.json")), "an alias whose spelling does not match is refused and nothing is written", bad1.r.stdout + bad1.r.stderr);
W(path.join(fx, "alias_bad2.json"), JSON.stringify([["Fixture Fifth Variant", "FIXTURE FIFTH", "spelling only, the lands register has no such label"]]));
const bad2 = run(["--aliases-json", path.join(fx, "alias_bad2.json")], path.join(fx, "o_bad2.json"));
ok(bad2.r.status !== 0 && /lands register does not tie/.test(bad2.r.stdout + bad2.r.stderr), "an alias with only the spelling (no land register evidence) is refused", bad2.r.stdout + bad2.r.stderr);
W(path.join(fx, "alias_none.json"), "[]");
const none = run(["--aliases-json", path.join(fx, "alias_none.json")], path.join(fx, "o_none.json"));
ok(none.r.status === 0 && !none.J.p["p:5"], "with no alias, 'Um Fixture Fourth' matches nothing (no guess)");
{
  const src = fs.readFileSync(path.join(REPO, "scripts", "build_community_positions_p.py"), "utf8");
  const n = (src.match(/^A\("/gm) || []).length;
  ok(n >= 10 && /def verify_aliases/.test(src) && /spelling\(f, tl\) < 0\.80/.test(src) && /ev\[3\] < 0\.98 or ev\[2\] < 20/.test(src), "the real ALIASES_P (" + n + " entries) are verified against the lands register on every run: ratio 0.80, purity 0.98, 20 parcels");
  const real = py("build_community_positions_p.py", ["--out", path.join(fx, "real.json"), "--audit", path.join(fx, "real.csv")]);
  if (fs.existsSync("C:/Dev/naj-market-pulse/data/lands-2026-08-25.csv") && fs.existsSync("C:/Dev/_complete393/scripts/completeness_universe.csv")) {
    ok(real.status === 0, "the real build verifies every real alias against the real lands register", real.stdout.slice(0, 300) + real.stderr.slice(0, 300));
    if (real.status === 0) { const R = JSON.parse(fs.readFileSync(path.join(fx, "real.json"), "utf8")); ok(Object.keys(R.p).length >= 1200 && Object.keys(R.p).every((k) => /^p:\d+$/.test(k)) && fs.statSync(path.join(fx, "real.json")).size < 400 * 1024, "the real file: >= 1200 project entries, all p:<digits>, under 400 KB"); }
  }
}

console.log("B - the publish script: dry run by default, refuses overwrite, rollback line, argument-list put, 04:00-06:15");
{
  const src = fs.readFileSync(path.join(REPO, "scripts", "publish_community_positions_p.py"), "utf8");
  ok(/KEY = "img_community_positions_p"/.test(src) && /if not a\.apply:[\s\S]*DRY RUN/.test(src), "key img_community_positions_p; dry run unless --apply");
  ok(/already holds a value[\s\S]*--replace/.test(src) && /roll back/i.test(src) && /240 <= mins < 375/.test(src) && /\/img\/community_positions_p/.test(src), "refuses to overwrite without --replace, backs up via the live /img route, prints the rollback line, refuses 04:00-06:15 Dubai");
  ok(/subprocess\.run\(\[npx, "wrangler", "kv", "key", "put", KEY, "--path", a\.file/.test(src) && !/shell=True/.test(src), "the put is wrangler called with a LIST of arguments");
  ok(/verified through the live route/.test(src) && /got == want/.test(src), "the read-back goes through the live route");
  const h = spawnSync("python", [path.join(REPO, "scripts", "publish_community_positions_p.py"), "--help"], { encoding: "utf8" });
  ok(h.status === 0, "the script parses and prints help (it was NOT run against KV)");
}

console.log("C - the page: ladder precedence, project-number rung for a card with no card entry, absent file = v395");
const html = devmapHtml("k", { NAJ_NAV_CSS: "", NAJ_FONTS: "", najNav: () => "" });
const js = html.slice(html.indexOf("<script>", html.indexOf("maplibre-gl.js")) + 8, html.lastIndexOf("</script>"));
const cut = (a, b) => js.slice(js.indexOf(a), js.indexOf(b));
const text = (h) => h.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
ok(js.includes("var COMMPOSP=") && js.indexOf("var COMMPOSP=") < js.indexOf("var COMMPOS=") && js.indexOf("var COMMPOS=") < js.indexOf("function esc(t)"), "the page carries the COMMPOSP module ahead of COMMPOS and of its own script");
DM.TIER_CFG.bounds = [30000, 20000, 12000];
const IDX = { as_of: "2026-09-09", cuts: { bounds: [30000, 20000, 12000] }, devs: { x: { name: "X", areas: 1, n: 40, profile: { projects: 4, homes: 0 } } }, areas: { dist: { name: "Fixture District", devs: { x: { n: "X", h: 0, c: [[40, 21000, 1e6, 1]], b: [], r: [] } } } } };
const EV = { plot: { p: 3719, e: "REGISTER_VERIFIED", a: "Fixture District", st: "NOT_STARTED", pl: 1 }, comm: { p: 555, e: "REGISTER_VERIFIED", a: "Fixture Master", st: "ACTIVE" }, plain: { p: 5, e: "REGISTER_VERIFIED", a: "Fixture District", st: "NOT_STARTED", pl: 1 },
  far: { p: 7777, e: "REGISTER_VERIFIED", a: "Fixture Outside", st: "ACTIVE" }, nopn: { p: null, e: "REGISTER_VERIFIED", a: "Fixture Outside" } };
const LAB = "Community centre: Fixture Master (Fixture Community). The exact plot is not in our data yet.";
const LABP = "Community centre: Fixture Outside. The exact plot is not in our data yet.";
const CP = { meta: { as_of: "2026-10-07" }, c: { "111": { n: "Fixture Community", lon: 55.2, lat: 25.3, bb: [55.15, 25.25, 55.25, 25.35], area_km2: 61.2, evidence: "DERIVED", basis: "community_polygon" } },
  p: { "dist|commtower": { c: "111", l: LAB, m: "register master community", a: "Fixture Master", pn: "555" }, "dist|towerone": { c: "111", l: LAB, m: "x", a: "x" }, "dist|plottower": { c: "111", l: LAB, m: "x", a: "x" } } };
const CPP = { meta: { as_of: "2026-10-07" }, c: { "333": { n: "Fixture Outside", lon: 55.7, lat: 25.6 - 0.05, bb: [55.65, 25.5, 55.75, 25.58], area_km2: 12.5, evidence: "DERIVED", basis: "community_polygon" } },
  p: { "p:7777": { c: "333", l: LABP, m: "register area", a: "Fixture Outside" }, "p:3719": { c: "333", l: LABP, m: "x", a: "x" }, "p:555": { c: "333", l: LABP, m: "x", a: "x" }, "p:5": { c: "333", l: LABP, m: "x", a: "x" } } };
const POS = { meta: { as_of: "2026-10-06" }, p: { "3719": { lon: 55.1234, lat: 25.2345, parcels: ["3210129"], n_plots: 1, basis: "makani_plot_outline", evidence: "DERIVED", link: "REGISTER_VERIFIED", label: "Plot position (centre of the registered plot), building not built yet", as_of: "2026-10-06", st: "NOT_STARTED", d: "dist" } } };
const s0 = cut("function esc(t)", "function api("), s1 = cut("function fmt(n)", "(function(){var b=new URLSearchParams(location.search).get(\"bounds\")");
const body = (mods) => "var $=function(id){return document.getElementById(id)};var KEY=\"k\";var fetch=function(){return new Promise(function(){})};" + (mods.plot ? PLOTPOS_JS : "") + (mods.cp ? COMMPOSP_JS : "") + (mods.comm ? COMMPOS_JS : "") + s0 + s1
  + cut("function clipName", "function devHead(") + cut("function icoSvg", "function evidenceHtml")
  + cut("var BLK={}", "var PULSE=0") + cut("function showSnap(p,pin)", "function focusProject") + cut("function tipHtml", "function drillHtml")
  + cut("function invFromApi", "function invProjRow")
  + "; return {BLK:BLK,PJ:PJ,PDET:PDET,pjCard:pjCard,pdOpen:pdOpen,pdClose:pdClose,pdWhy:pdWhy,invIndex:invIndex,pjDetailHtml:pjDetailHtml,locate:locate" + (mods.plot ? ",PLOTPOS:PLOTPOS" : "") + (mods.comm ? ",COMMPOS:COMMPOS" : "") + (mods.cp ? ",COMMPOSP:COMMPOSP" : "") + "};";
const mkEl = (id) => ({ id, innerHTML: "", style: {}, className: "", offsetHeight: 300, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, focus() { this.focused = true; } });
const mkMap = () => { const m = { src: {}, layers: [], flown: [], getSource(n) { return m.src[n] || null; }, addSource(n, o) { m.src[n] = { data: o.data, setData(d) { this.data = d; } }; }, addLayer(l) { m.layers.push(l); }, isStyleLoaded: () => true, flyTo(o) { m.flown.push(o); } }; return m; };
const make = (mods, plotData, commData, cpData, map) => {
  const els = {}, doc = { getElementById: (i) => els[i] || null, createElement: () => mkEl(""), body: { appendChild: (e) => { els[e.id] = e; } }, addEventListener: () => {} };
  const S = { evOpen: false, sel: "dist", unit: "sqft", win: "all", inv: null }, sheet = [];
  const fn = new Function("DM", "IDX", "S", "TC", "document", "renderDetail", "updatePj", "EVI", "innerWidth", "map", "setSheet", body(mods));
  const Pg = fn(DM, IDX, S, ["#c5a56a", "#2f8a7f", "#3987e5", "#8a9a96"], doc, () => {}, () => {}, PHOSPHOR_LIGHT, 375, map, (v) => sheet.push(v));
  if (mods.plot && plotData !== undefined) Pg.PLOTPOS.load(plotData);
  if (mods.comm && commData !== undefined) Pg.COMMPOS.load(commData);
  if (mods.cp && cpData !== undefined) Pg.COMMPOSP.load(cpData);
  Pg.BLK.dist = { state: "ok", feats: [{ type: "Feature", geometry: { type: "Polygon", coordinates: [[[55.1, 25.1], [55.101, 25.1], [55.101, 25.101], [55.1, 25.101], [55.1, 25.1]]] }, properties: { i: 0, n: "Tower One", k: "towerone", a: 9000 } }] };
  return { Pg, els, sheet };
};
const cardOf = (Pg, name, ev) => Pg.pjCard("dist", name, 21000, 8, "", "x", ev);
const dkOf = (h) => (h.match(/data-pd="([^"]+)"/) || [])[1];
{
  const map = mkMap(), { Pg, els } = make({ plot: 1, comm: 1, cp: 1 }, POS, CP, CPP, map);
  const tower = cardOf(Pg, "Tower One", EV.plain), plot = cardOf(Pg, "Plot Tower", EV.plot), cardkey = cardOf(Pg, "Comm Tower", EV.comm), far = cardOf(Pg, "Far Away Tower", EV.far), nopn = cardOf(Pg, "No Number Tower", EV.nopn), unk = cardOf(Pg, "Unknown Tower", null);
  ok(/class="pjc loc"/.test(tower), "ladder 1: a card with a building outline is the building path, even when a project-number entry exists for it (p:5)");
  ok(/class="pjc noloc plot"/.test(plot) && !/noloc comm/.test(plot), "ladder 2: a card with a plot centre is the plot path, even when a project-number community entry exists (p:3719)");
  ok(/class="pjc noloc comm"/.test(far) && /Show on the map/.test(far) && /not the building/.test(far), "ladder 3 by project number: a card with no card entry but a register project number in the new file reads 'Show on the map' and 'not the building'");
  ok(/class="pjc noloc comm"/.test(cardkey), "a card with a card-key entry is still community (the card key is unchanged)");
  ok(!/noloc comm/.test(nopn) && !/noloc comm/.test(unk) && /Project details/.test(unk), "no project number, or none in the file: the card stays 'Project details'");
  Pg.pdOpen(dkOf(far), mkEl("f"));
  const f = map.flown[0];
  ok(f && f.center[0] === 55.7 && f.zoom >= 11 && f.zoom <= 14.5, "the tap flies to the community of the project-number entry at a wide zoom", JSON.stringify(f));
  const t = text(els.pjdet.innerHTML);
  ok(t.includes(LABP) && /DERIVED/.test(t) && /A community-centre marker is NOT the building\./.test(t) && /about 12 square km|about 13 square km|about 12\.5 square km/.test(t), "the panel shows the label, DERIVED, the NOT-the-building line and the community size", t.slice(0, 700));
  Pg.pdOpen(dkOf(cardkey), mkEl("f"));
  ok(map.src.commpos.data.features.length === 3 && /Fixture Master/.test(text(els.pjdet.innerHTML)), "the card-key entry wins over the project-number one for the same card (the label is the card's)");
  ok(Pg.COMMPOSP.count() === 4 && Pg.COMMPOSP.has({ p: "7777" }) && !Pg.COMMPOSP.has({ p: null }) && !Pg.COMMPOSP.has({ p: "x" }) && !Pg.COMMPOSP.has(null), "COMMPOSP answers only for a digits-only project number that is in the file");
}
{
  const mk = (mods, plotD, commD, cpD) => make(mods, plotD, commD, cpD, mkMap());
  const a = mk({ plot: 1, comm: 1, cp: 1 }, POS, CP, undefined), b = mk({ plot: 1, comm: 1, cp: 1 }, POS, CP, {}), c = mk({ plot: 1, comm: 1, cp: 1 }, POS, CP, null), d = mk({ plot: 1, comm: 1 }, POS, CP);
  const cases = [["Plot Tower", EV.plot], ["Plain Tower", EV.plain], ["Comm Tower", EV.comm], ["Tower One", EV.plain], ["Far Away Tower", EV.far], ["No Pn Tower", null], ["Unknown", null]];
  const strip = (h) => h.replace(/data-pd="[^"]*"/, "");
  ok(cases.every(([n, ev]) => { const ha = strip(cardOf(d.Pg, n, ev)); return ha === strip(cardOf(a.Pg, n, ev)) && ha === strip(cardOf(b.Pg, n, ev)) && ha === strip(cardOf(c.Pg, n, ev)); }), "with no project-number file (absent, empty, null, or no module) every card renders exactly as v395");
  const detail = (x, n, ev) => { const h = cardOf(x.Pg, n, ev); x.Pg.pdOpen(dkOf(h), mkEl("f")); return x.els.pjdet.innerHTML; };
  ok(detail(a, "Far Away Tower", EV.far) === detail(d, "Far Away Tower", EV.far) && detail(b, "Comm Tower", EV.comm) === detail(d, "Comm Tower", EV.comm), "and every detail panel is identical to v395 without the file");
}
{
  const ok1 = (() => { try { new Function(js); return true; } catch (e) { return e.message; } })();
  ok(ok1 === true, "the whole page script parses", ok1);
  const src = fs.readFileSync(path.join(REPO, "src", "devmap_page.js"), "utf8");
  ok(/what === "commposp"/.test(src) && /api\("commposp"\)\.catch/.test(js) && /COMMPOSP\.load\(r\[9\]\)/.test(js), "the route what=commposp exists and the page loads it, a failure meaning nothing");
  for (const f of ["commpos_p.js", "commpos_p_page.js"]) ok(spawnSync("node", ["--check", path.join(REPO, "src", f)]).status === 0, "src/" + f + " parses");
  ok(cleanCommPosP(CPP) && Object.keys(cleanCommPosP(CPP).p).length === 4 && cleanCommPosP({}) === null && cleanCommPosP({ c: {}, p: {} }) === null
    && cleanCommPosP({ c: CPP.c, p: { "dist|x": { c: "333", l: LABP } } }) === null && cleanCommPosP({ c: CPP.c, p: { "p:abc": { c: "333", l: LABP } } }) === null
    && cleanCommPosP({ c: { "333": { lon: 55.7, lat: 25.5, evidence: "VERIFIED", basis: "community_polygon" } }, p: { "p:1": { c: "333", l: LABP } } }) === null, "the route's shape check keeps only p:<digits> entries on DERIVED community points; nothing valid = absent");
  ok(!/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/u.test(COMMPOSP_JS + COMMPOS_JS + COMMPOS_CSS + fs.readFileSync(path.join(REPO, "src", "commpos_p.js"), "utf8")), "no emoji in the new modules");
  ok(!/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/u.test(fs.readFileSync(path.join(REPO, "scripts", "build_community_positions_p.py"), "utf8") + fs.readFileSync(path.join(REPO, "scripts", "publish_community_positions_p.py"), "utf8")), "no emoji in the scripts");
}
fs.rmSync(TMP, { recursive: true, force: true });
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
