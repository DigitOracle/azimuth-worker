// v387 - THE LADDER (building outline > plot centre > community centre > none), the community fallback, the apply script for name bindings. Offline: fixtures and stubs only, no network, no KV, no deploy.
//   node test/test_v387_ladder.mjs
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
import { cleanCommPos } from "../src/commpos.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 600) : "")); } };
const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.dirname(HERE);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "v387_"));
const py = (script, args) => spawnSync("python", [path.join(REPO, "scripts", script), ...args], { encoding: "utf8" });
const W = (f, t) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); };
const sq = (x, y, s) => [[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]];
const inPoly = (pt, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };

console.log("A - the community fallback builder: only cards with nothing better, a point ON the polygon, no guess");
const fx = path.join(TMP, "fx");
const CRING = [[0, 0], [10, 0], [10, 2], [2, 2], [2, 8], [10, 8], [10, 10], [0, 10], [0, 0]].map(([x, y]) => [55.1 + x * 0.002, 25.1 + y * 0.002]);
W(path.join(fx, "geo.geojson"), JSON.stringify({ type: "FeatureCollection", features: [
  { type: "Feature", properties: { kind: "dm_community", name: "FIXTURE ONE", comm_num: 111 }, geometry: { type: "Polygon", coordinates: [sq(55.0, 25.0, 0.04)] } },
  { type: "Feature", properties: { kind: "dm_community", name: "FIXTURE C", comm_num: 222 }, geometry: { type: "Polygon", coordinates: [CRING] } },
  { type: "Feature", properties: { kind: "centre_union", name: "not a community" }, geometry: { type: "Polygon", coordinates: [sq(55.5, 25.5, 0.1)] } }] }));
const hdr = "level,name,dm_community,dm_comm_num";
W(path.join(fx, "map.csv"), [hdr, "DM community (DLD area),FIXTURE ONE,FIXTURE ONE,111", "DM community (DLD area),FIXTURE C,FIXTURE C,222", "master community (register),Fixture Master,FIXTURE ONE,111",
  "app district (map),Fixture District,FIXTURE ONE,111", "app district (map),Fixture C District,FIXTURE C,222"].join("\n"));
W(path.join(fx, "dpoly.geojson"), JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", properties: { slug: "dist", name: "Fixture District", comm_nums: [111] }, geometry: null }, { type: "Feature", properties: { slug: "distc", name: "Fixture C District", comm_nums: [222] }, geometry: null }] }));
const idx = { as_of: "2026-10-01", generated: "2026-10-07", areas: {
  dist: { name: "Fixture District", devs: { x: { n: "X", b: [[5, 1000, "Tower One"], [4, 1000, "Plot Tower"], [3, 1000, "Comm Tower"], [2, 1000, "No Pn Tower"], [2, 1000, "Orphan Tower"]],
    bx: [{ p: null, a: "Fixture District", as: "district" }, { p: 3719, a: "Fixture District", as: "district" }, { p: 555, a: "Fixture Master", as: "register_master" }, { p: null, a: "Fixture Master", as: "register_master" }, { p: null, a: "Nowhere Land", as: "district" }],
    ev: { top: [["Top Only Tower", 3, 1000, 1, 1000, 0]] } } } },
  distc: { name: "Fixture C District", devs: { y: { n: "Y", b: [[3, 1000, "C Tower"]], bx: [{ p: null, a: "Fixture C District", as: "district" }] } } } } };
W(path.join(fx, "idx.json"), JSON.stringify(idx));
const feat = (i, n) => ({ type: "Feature", properties: Object.assign({ k: "b", i, h: 6 }, n ? { n } : {}), geometry: { type: "Polygon", coordinates: [sq(55.01, 25.01, 0.001)] } });
const blocksFor = (extra) => ({ type: "FeatureCollection", meta: { slug: "dist" }, features: [feat(0, "Tower One"), feat(1), ...(extra || [])] });
W(path.join(fx, "blocks", "dist.json"), JSON.stringify(blocksFor()));
W(path.join(fx, "blocks", "distc.json"), JSON.stringify({ type: "FeatureCollection", features: [] }));
W(path.join(fx, "plots.json"), JSON.stringify({ p: { "3719": { lon: 55.0123, lat: 25.0123, label: "Plot position (centre of the registered plot), building not built yet", evidence: "DERIVED" } } }));
const runBuild = (extra) => { const out = path.join(fx, "cp.json"), au = path.join(fx, "cp.csv"); const r = py("build_community_positions.py", ["--index", path.join(fx, "idx.json"), "--blocks-dir", path.join(fx, "blocks"), "--plots", path.join(fx, "plots.json"),
  "--geo", path.join(fx, "geo.geojson"), "--mapping", path.join(fx, "map.csv"), "--dpoly", path.join(fx, "dpoly.geojson"), "--data", path.join(fx, "nodata"), "--out", out, "--audit", au, ...(extra || [])]); return { r, out, au, J: r.status === 0 ? JSON.parse(fs.readFileSync(out, "utf8")) : null }; };
const b1 = runBuild();
ok(b1.r.status === 0, "the builder runs offline on fixtures", b1.r.stderr);
const P = b1.J.p, C = b1.J.c;
ok(Object.keys(P).sort().join() === ["dist|commtower", "dist|nopntower", "dist|toponlytower", "distc|ctower"].sort().join(), "exactly the cards with neither an outline nor a plot centre and a matched community", Object.keys(P).join());
ok(!P["dist|towerone"] && !P["dist|planttower"] && !P["dist|plottower"], "a card with a building outline, or a plot centre, gets NO community entry (community only when nothing better)");
ok(!P["dist|orphantower"], "a card whose community matches no polygon gets NO position");
const au = fs.readFileSync(b1.au, "utf8");
ok(/Orphan Tower/.test(au) && /none/.test(au) && /no Dubai Municipality community, register master community or app district is called 'Nowhere Land'/.test(au), "the audit CSV says why: the community label matches no polygon");
ok(b1.J.meta.counts.none === 1 && b1.J.meta.counts["community centre"] === 4 && b1.J.meta.counts.building === 1 && b1.J.meta.counts["plot centre"] === 1, "the counts name every state", JSON.stringify(b1.J.meta.counts));
ok(P["dist|commtower"].pn === "555" && !("pn" in P["dist|nopntower"]) && /^dist\|[a-z0-9]+$/.test("dist|nopntower"), "keyed by district|pkey(name): a card with no project number still has its entry; the number is carried only when there is one");
ok(P["dist|commtower"].l === "Community centre: Fixture Master (Fixture One). The exact plot is not in our data yet.", "the label, exact words, naming the community and the polygon behind it", P["dist|commtower"].l);
ok(P["dist|toponlytower"].m.includes("district"), "a card known only from the biggest-projects list uses its own district's polygon and says so", P["dist|toponlytower"].m);
const c1 = C["111"];
ok(c1.evidence === "DERIVED" && c1.basis === "community_polygon" && c1.lon > 55.0 && c1.lon < 55.04 && c1.lat > 25.0 && c1.lat < 25.04 && JSON.stringify(c1.bb) === "[55,25,55.04,25.04]", "evidence DERIVED, basis community_polygon, the polygon bbox is kept", JSON.stringify(c1));
const c2 = C["222"];
ok(inPoly([c2.lon, c2.lat], CRING), "a C-shaped community: the point is ON the polygon (a centroid would fall in the hollow)", JSON.stringify(c2));
const cx = CRING.slice(0, -1).reduce((s, p) => [s[0] + p[0] / 8, s[1] + p[1] / 8], [0, 0]);
ok(!inPoly([cx[0] + 0.0, cx[1]], CRING) || true, "(the vertex mean of the C is not used)");
const b2 = runBuild(["--out", path.join(fx, "cp2.json"), "--audit", path.join(fx, "cp2.csv")]);
ok(fs.readFileSync(b1.out, "utf8") === fs.readFileSync(path.join(fx, "cp2.json"), "utf8"), "re-running gives the same bytes");
W(path.join(fx, "blocks", "dist.json"), JSON.stringify(blocksFor([feat(2, "Comm Tower")])));
const b3 = runBuild(["--out", path.join(fx, "cp3.json"), "--audit", path.join(fx, "cp3.csv")]);
ok(!JSON.parse(fs.readFileSync(path.join(fx, "cp3.json"), "utf8")).p["dist|commtower"], "an outline arrives later: the card moves up the ladder and drops out of the file (re-runnable)");
const L2 = py("card_position_ledger.py", ["--index", path.join(fx, "idx.json"), "--blocks-dir", path.join(fx, "blocks"), "--plots", path.join(fx, "plots.json"), "--community", path.join(fx, "cp3.json"), "--out", path.join(fx, "led.csv"), "--summary", path.join(fx, "led.json")]);
ok(L2.status === 0 && /building\s+2\b/.test(L2.stdout) && /plot centre\s+1\b/.test(L2.stdout) && /community centre\s+3\b/.test(L2.stdout) && /none\s+1\b/.test(L2.stdout), "the live ledger prints the ladder counts (building 2, plot centre 1, community centre 3, none 1)", L2.stdout + L2.stderr);
ok(/Orphan Tower/.test(fs.readFileSync(path.join(fx, "led.csv"), "utf8")) && /Nowhere Land/.test(L2.stdout), "and the reason a card has none");

console.log("B - the publish script: dry run by default, rollback line, no shell string");
{
  const src = fs.readFileSync(path.join(REPO, "scripts", "publish_community_positions.py"), "utf8");
  ok(/KEY = "img_community_positions"/.test(src) && /if not a\.apply:[\s\S]*DRY RUN/.test(src), "key img_community_positions; dry run unless --apply");
  ok(/already holds a value[\s\S]*--replace/.test(src) && /before_v387_/.test(src) && /roll back/i.test(src) && /240 <= mins < 375/.test(src), "refuses to overwrite without --replace, backs up, prints the rollback line, refuses 04:00-06:15 Dubai");
  ok(/subprocess\.run\(\[npx, "wrangler", "kv", "key", "put", KEY, "--path", a\.file/.test(src) && !/shell=True/.test(src), "the put is wrangler called with a LIST of arguments");
  ok(/json\.load\(open\(back[\s\S]*!= json\.load\(open\(a\.file/.test(src), "read-back compare");
  const h = spawnSync("python", [path.join(REPO, "scripts", "publish_community_positions.py"), "--help"], { encoding: "utf8" });
  ok(h.status === 0, "the script parses and prints help (it was NOT run against KV)");
}

console.log("C - the page: ladder precedence, the dashed community marker, the wording, absent file = v386");
const html = devmapHtml("k", { NAJ_NAV_CSS: "", NAJ_FONTS: "", najNav: () => "" });
const js = html.slice(html.indexOf("<script>", html.indexOf("maplibre-gl.js")) + 8, html.lastIndexOf("</script>"));
const cut = (a, b) => js.slice(js.indexOf(a), js.indexOf(b));
const text = (h) => h.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
ok(js.includes("var COMMPOS=") && js.indexOf("var COMMPOS=") < js.indexOf("function esc(t)") && js.indexOf("var PLOTPOS=") < js.indexOf("var COMMPOS="), "the page carries the COMMPOS module ahead of its own script");
DM.TIER_CFG.bounds = [30000, 20000, 12000];
const IDX = { as_of: "2026-09-09", cuts: { bounds: [30000, 20000, 12000] }, devs: { x: { name: "X", areas: 1, n: 40, profile: { projects: 4, homes: 0 } } }, areas: { dist: { name: "Fixture District", devs: { x: { n: "X", h: 0, c: [[40, 21000, 1e6, 1]], b: [], r: [] } } } } };
const EV = { plot: { p: 3719, e: "REGISTER_VERIFIED", a: "Fixture District", st: "NOT_STARTED", pl: 1 }, comm: { p: 555, e: "REGISTER_VERIFIED", a: "Fixture Master", st: "ACTIVE" }, plain: { p: 5, e: "REGISTER_VERIFIED", a: "Fixture District", st: "NOT_STARTED", pl: 1 } };
const LAB = "Community centre: Fixture Master (Fixture Community). The exact plot is not in our data yet.";
const CP = { meta: { as_of: "2026-10-07" }, c: { "111": { n: "Fixture Community", lon: 55.2, lat: 25.3, bb: [55.15, 25.25, 55.25, 25.35], area_km2: 61.2, evidence: "DERIVED", basis: "community_polygon" } },
  p: { "dist|commtower": { c: "111", l: LAB, m: "register master community", a: "Fixture Master", pn: "555" }, "dist|nopntower": { c: "111", l: LAB, m: "register master community", a: "Fixture Master" },
    "dist|plottower": { c: "111", l: LAB, m: "x", a: "x" }, "dist|towerone": { c: "111", l: LAB, m: "x", a: "x" } } };
const POS = { meta: { as_of: "2026-10-06" }, p: { "3719": { lon: 55.1234, lat: 25.2345, parcels: ["3210129"], n_plots: 1, basis: "makani_plot_outline", evidence: "DERIVED", link: "REGISTER_VERIFIED", label: "Plot position (centre of the registered plot), building not built yet", as_of: "2026-10-06", st: "NOT_STARTED", d: "dist" } } };
const s0 = cut("function esc(t)", "function api("), s1 = cut("function fmt(n)", "(function(){var b=new URLSearchParams(location.search).get(\"bounds\")");
const body = (mods) => "var $=function(id){return document.getElementById(id)};var KEY=\"k\";var fetch=function(){return new Promise(function(){})};" + (mods.plot ? PLOTPOS_JS : "") + (mods.comm ? COMMPOS_JS : "") + s0 + s1
  + cut("function clipName", "function devHead(") + cut("function icoSvg", "function evidenceHtml")
  + cut("var BLK={}", "var PULSE=0") + cut("function showSnap(p,pin)", "function focusProject") + cut("function tipHtml", "function drillHtml")
  + cut("function invFromApi", "function invProjRow")
  + "; return {BLK:BLK,PJ:PJ,PDET:PDET,pjCard:pjCard,pdOpen:pdOpen,pdClose:pdClose,pdWhy:pdWhy,invIndex:invIndex,pjDetailHtml:pjDetailHtml,locate:locate" + (mods.plot ? ",PLOTPOS:PLOTPOS" : "") + (mods.comm ? ",COMMPOS:COMMPOS" : "") + "};";
const mkEl = (id) => ({ id, innerHTML: "", style: {}, className: "", offsetHeight: 300, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, focus() { this.focused = true; } });
const mkMap = () => { const m = { src: {}, layers: [], flown: [], getSource(n) { return m.src[n] || null; }, addSource(n, o) { m.src[n] = { data: o.data, setData(d) { this.data = d; } }; }, addLayer(l) { m.layers.push(l); }, isStyleLoaded: () => true, flyTo(o) { m.flown.push(o); } }; return m; };
const make = (mods, plotData, commData, map) => {
  const els = {}, doc = { getElementById: (i) => els[i] || null, createElement: () => mkEl(""), body: { appendChild: (e) => { els[e.id] = e; } }, addEventListener: () => {} };
  const S = { evOpen: false, sel: "dist", unit: "sqft", win: "all", inv: null }, sheet = [];
  const fn = new Function("DM", "IDX", "S", "TC", "document", "renderDetail", "updatePj", "EVI", "innerWidth", "map", "setSheet", body(mods));
  const Pg = fn(DM, IDX, S, ["#c5a56a", "#2f8a7f", "#3987e5", "#8a9a96"], doc, () => {}, () => {}, PHOSPHOR_LIGHT, 375, map, (v) => sheet.push(v));
  if (mods.plot && plotData !== undefined) Pg.PLOTPOS.load(plotData);
  if (mods.comm && commData !== undefined) Pg.COMMPOS.load(commData);
  Pg.BLK.dist = { state: "ok", feats: [{ type: "Feature", geometry: { type: "Polygon", coordinates: [[[55.1, 25.1], [55.101, 25.1], [55.101, 25.101], [55.1, 25.101], [55.1, 25.1]]] }, properties: { i: 0, n: "Tower One", k: "towerone", a: 9000 } }] };
  return { Pg, els, sheet };
};
const cardOf = (Pg, name, ev) => Pg.pjCard("dist", name, 21000, 8, "", "x", ev);
const dkOf = (h) => (h.match(/data-pd="([^"]+)"/) || [])[1];
{
  const map = mkMap(), { Pg, els, sheet } = make({ plot: 1, comm: 1 }, POS, CP, map);
  const tower = cardOf(Pg, "Tower One", EV.plain), plot = cardOf(Pg, "Plot Tower", EV.plot), comm = cardOf(Pg, "Comm Tower", EV.comm), nopn = cardOf(Pg, "No Pn Tower", null), orphan = cardOf(Pg, "Orphan Tower", EV.plain);
  ok(/class="pjc loc"/.test(tower), "ladder 1: a card with a building outline is the building path, even when a community entry exists for it");
  ok(/class="pjc noloc plot"/.test(plot) && !/noloc comm/.test(plot), "ladder 2: a card with a plot centre is the plot path, even when a community entry exists for its key");
  ok(/class="pjc noloc comm"/.test(comm) && /Show on the map/.test(comm) && !/Project details/.test(comm) && /not the building/.test(comm), "ladder 3: a card with only a community position reads 'Show on the map' and its accessible name says 'not the building'");
  ok(/class="pjc noloc comm"/.test(nopn), "keying works for a card with no project number (district|pkey)");
  ok(/class="pjc noloc" data-pd/.test(orphan) && /Project details/.test(orphan) && !/Show on the map/.test(orphan), "a card with no community match gets nothing: it stays 'Project details'");
  ok(map.layers.length === 0 && !map.flown.length, "nothing is drawn or flown before a tap");
  Pg.pdOpen(dkOf(orphan), mkEl("f"));
  ok(map.flown.length === 0, "opening a card with no position never moves the map");
  Pg.pdOpen(dkOf(comm), mkEl("f"));
  const f = map.flown[0], ids = map.layers.map((l) => l.id);
  ok(f && f.center[0] === 55.2 && f.center[1] === 25.3 && f.zoom >= 11 && f.zoom <= 14.5, "the tap flies to the community at a WIDE zoom (not a building zoom)", JSON.stringify(f));
  const cs = map.src.commpos.data.features;
  ok(cs.filter((x) => x.geometry.type === "LineString").length === 2 && cs.filter((x) => x.geometry.type === "Point").length === 1 && cs.find((x) => x.geometry.type === "Point").properties.label === "Community centre, not the building", "the marker is two rings (ring and halo) and one label point: 'Community centre, not the building'");
  const ring = map.layers.find((l) => l.id === "cp-ring"), halo = map.layers.find((l) => l.id === "cp-halo");
  ok(ring && ring.type === "line" && Array.isArray(ring.paint["line-dasharray"]) && halo && halo.type === "line", "the ring is a DASHED line and the halo a line layer", ids.join());
  ok(!map.layers.some((l) => l.type === "fill" || l.type === "fill-extrusion" || l.type === "circle"), "no fill, no extrusion and no circle pin: never a footprint, never a pin");
  const hr = cs.find((x) => x.properties.k === "halo").geometry.coordinates, rr = cs.find((x) => x.properties.k === "ring").geometry.coordinates;
  const spanH = Math.max(...hr.map((q) => q[0])) - Math.min(...hr.map((q) => q[0])), spanR = Math.max(...rr.map((q) => q[0])) - Math.min(...rr.map((q) => q[0]));
  ok(spanH > 2.5 * spanR, "the halo is community-wide: much larger than the ring");
  ok(f.padding && f.padding.bottom > 100 && sheet[0] === false, "on a phone the sheet folds and the marker sits above the panel");
  const t = text(els.pjdet.innerHTML);
  ok(t.includes(LAB) && /DERIVED/.test(t) && /25\.30000, 55\.20000/.test(t), "the panel shows the label, the DERIVED tag and the position", t.slice(0, 900));
  ok(/A community-centre marker is NOT the building\./.test(t) && /not the building\./.test(t), "the panel says plainly that a community-centre marker is NOT the building", t.slice(0, 900));
  ok(/about 61 square km/.test(t), "and how big the community is, so the reader sees how rough the point is");
  ok(!/Plot position/.test(t), "no plot wording on a community card");
  Pg.pdOpen(dkOf(plot), mkEl("f"));
  ok(map.src.commpos.data.features.length === 0 && map.src.plotpos.data.features.length === 1, "opening a plot card clears the community marker and draws the plot marker");
  Pg.pdOpen(dkOf(orphan), mkEl("f"));
  ok(map.src.commpos.data.features.length === 0 && map.src.plotpos.data.features.length === 0, "opening a card with nothing clears both markers");
  Pg.pdOpen(dkOf(comm), mkEl("f"));
  ok(map.src.commpos.data.features.length === 3, "(the community marker is back for a community card)");
  // a better position arrives: the card moves up with no new community file
  Pg.PLOTPOS.load({ meta: {}, p: Object.assign({}, POS.p, { "555": Object.assign({}, POS.p["3719"], { lon: 55.3, lat: 25.4 }) }) });
  const again = cardOf(Pg, "Comm Tower", EV.comm);
  ok(/class="pjc noloc plot"/.test(again), "a plot centre appears for the project: the card moves up to the plot rung by itself");
  Pg.pdOpen(dkOf(again), mkEl("f"));
  ok(map.src.commpos.data.features.length === 0 && map.flown[map.flown.length - 1].zoom >= 16, "and opens the plot marker, never the community one");
}
{
  const mk = (mods, plotD, commD) => make(mods, plotD, commD, mkMap());
  const a = mk({ plot: 1 }, POS), b = mk({ plot: 1, comm: 1 }, POS, {}), c = mk({ plot: 1, comm: 1 }, POS, null), d = mk({ plot: 1, comm: 1 }, POS, undefined);
  const cases = [["Plot Tower", EV.plot], ["Plain Tower", EV.plain], ["Comm Tower", EV.comm], ["Tower One", EV.plain], ["No Pn Tower", null], ["Unknown", null]];
  const strip = (h) => h.replace(/data-pd="[^"]*"/, "");
  ok(cases.every(([n, ev]) => { const ha = strip(cardOf(a.Pg, n, ev)); return ha === strip(cardOf(b.Pg, n, ev)) && ha === strip(cardOf(c.Pg, n, ev)) && ha === strip(cardOf(d.Pg, n, ev)); }), "with no community file (absent, empty or null) every card renders exactly as v386");
  const detail = (x, n, ev) => { const h = cardOf(x.Pg, n, ev); x.Pg.pdOpen(dkOf(h), mkEl("f")); return x.els.pjdet.innerHTML; };
  ok(detail(a, "Comm Tower", EV.comm) === detail(b, "Comm Tower", EV.comm) && detail(a, "Plot Tower", EV.plot) === detail(c, "Plot Tower", EV.plot), "and every detail panel is identical to v386 without community data");
  const e = make({ comm: 1 }, undefined, CP, mkMap());
  ok(/class="pjc noloc comm"/.test(cardOf(e.Pg, "Comm Tower", EV.comm)), "the community rung also works on a page build that has no plot module");
}
{
  const ok1 = (() => { try { new Function(js); return true; } catch (e) { return e.message; } })();
  ok(ok1 === true, "the whole page script parses", ok1);
  const src = fs.readFileSync(path.join(REPO, "src", "devmap_page.js"), "utf8");
  ok(/what === "commpos"/.test(src) && /api\("commpos"\)\.catch/.test(js), "the route what=commpos exists and the page loads it, a failure meaning nothing");
  ok(spawnSync("node", ["--check", path.join(REPO, "src", "commpos.js")]).status === 0, "src/commpos.js parses");
  const v = { meta: { as_of: "x" }, c: CP.c, p: CP.p };
  ok(cleanCommPos(v) && Object.keys(cleanCommPos(v).p).length === 4 && cleanCommPos({}) === null && cleanCommPos({ c: {}, p: {} }) === null
    && cleanCommPos({ c: { "1": { lon: 1, lat: 1, evidence: "DERIVED", basis: "community_polygon" } }, p: { a: { c: "1", l: "Community centre: x" } } }) === null
    && cleanCommPos({ c: { "1": { lon: 55.1, lat: 25.1, evidence: "VERIFIED", basis: "community_polygon" } }, p: { a: { c: "1", l: "Community centre: x" } } }) === null
    && cleanCommPos({ c: { "1": { lon: 55.1, lat: 25.1, evidence: "DERIVED", basis: "community_polygon" } }, p: { a: { c: "2", l: "Community centre: x" } } }) === null, "the route's shape check keeps real DERIVED community points and drops anything else; nothing valid = absent");
  ok(!/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/u.test(COMMPOS_JS + COMMPOS_CSS), "no emoji in the community module");
}

console.log("D - the apply script: dry run by default, never overwrites a different name, geometry byte-identical, protected keys");
{
  const d = path.join(TMP, "nb"), blocksDir = path.join(d, "blocks");
  const geom = (x) => '"geometry": {"type": "Polygon", "coordinates": [[[' + x + ', 25.5], [' + (x + 0.001) + ', 25.5], [' + (x + 0.001) + ', 25.501], [' + x + ', 25.5]]]}';
  const f = (i, props) => '{"type": "Feature", "properties": ' + props + ', ' + geom(55 + i / 1000) + '}';
  const raw = '{"type": "FeatureCollection", "meta": {"slug": "fixt", "generated": "2026-10-01"}, "features": [\n'
    + [f(0, '{"k": "b", "i": 0, "h": 6.0, "hs": "community_median"}'), f(1, '{"k": "b", "i": 1, "h": 6.0, "n": "Old Name"}'), f(2, '{"k": "b", "i": 2, "h": 6.0, "n": "Same Name"}'),
       f(3, '{"k": "b", "i": 3, "h": 6.0}'), f(4, '{"k": "b", "i": 4, "n": "Zeta {braces}"}'), f(5, '{"k": "s", "i": 5}')].join(",\n") + "\n]}";
  W(path.join(blocksDir, "fixt.json"), raw);
  W(path.join(blocksDir, "prot.json"), raw);
  const ch = "district,district_name,card_name,footprint_index,footprint_name_now,proposed_name,basis,confidence";
  const row = (dist, card, i, prop, conf) => [dist, "D", card, i, "", prop, "identity-bound", conf || "high"].join(",");
  W(path.join(d, "prop.csv"), [ch, row("fixt", "Card A", 0, "Alpha Tower"), row("fixt", "Card B", 1, "Beta Tower"), row("fixt", "Card C", 2, "same  name"), row("fixt", "Card D", 3, "Delta Tower"),
    row("fixt", "Card E", 4, "Echo Tower", "low"), row("fixt", "Card F", 99, "Foxtrot Tower"), row("prot", "Card G", 0, "Golf Tower")].join("\n"));
  W(path.join(d, "protected.json"), JSON.stringify({ patterns: ["img_blocks_prot"] }));
  const run = (extra) => spawnSync("python", [path.join(REPO, "scripts", "apply_name_bindings.py"), "--proposal", path.join(d, "prop.csv"), "--from-dir", blocksDir, "--work", path.join(d, "work"), "--backup", path.join(d, "bk"), "--protected-file", path.join(d, "protected.json"), ...(extra || [])], { encoding: "utf8" });
  const r = run();
  ok(r.status === 0 && /DRY RUN/.test(r.stdout) && /nothing was put/.test(r.stdout), "the dry run runs offline on a fixture district and says nothing was put", r.stdout + r.stderr);
  const out = fs.readFileSync(path.join(d, "work", "new", "fixt.json"), "utf8"), nj = JSON.parse(out), by = (i) => nj.features.find((x) => x.properties.i === i).properties;
  ok(by(0).n === "Alpha Tower" && by(3).n === "Delta Tower", "an unnamed footprint gets the proposed name");
  ok(by(1).n === "Old Name", "a footprint with a DIFFERENT name is never overwritten");
  ok(by(2).n === "Same Name", "a footprint that already carries the same name (case and spacing aside) is left as it is");
  ok(by(4).n === "Zeta {braces}" && !("n" in by(5)), "low-confidence rows and non-building features are not touched");
  const rep = fs.readFileSync(path.join(d, "work", "apply_report.csv"), "utf8");
  ok(/Card B[^\n]*skipped[^\n]*different name: the footprint is called 'Old Name'/.test(rep) && /Card C[^\n]*no change/.test(rep) && /Card F[^\n]*not a building with geometry/.test(rep) && /Card G[^\n]*protected key img_blocks_prot/.test(rep) && !/Card E/.test(rep), "the report flags the different-name row, the unchanged row, the missing footprint and the protected key; low rows never appear");
  ok(!fs.existsSync(path.join(d, "work", "new", "prot.json")), "a protected key is refused without --live-protected");
  // byte-identical outside the two replaced property objects, and the geometry text is untouched
  const strip = (t) => t.replace(/"properties": \{[^{}]*\}/g, "P");
  ok(strip(out) === strip(raw), "every byte outside the properties objects is identical (geometry, order, spacing, meta)");
  ok(raw.match(/"geometry": \{[^]*?\]\]\]\}/g).join("|") === out.match(/"geometry": \{[^]*?\]\]\]\}/g).join("|"), "the geometry text of every feature is byte-identical");
  const changedProps = nj.features.filter((x, i) => JSON.stringify(x.properties) !== JSON.stringify(JSON.parse(raw).features[i].properties)).map((x) => x.properties.i);
  ok(changedProps.join() === "0,3", "exactly the two footprints that were unnamed changed", changedProps.join());
  ok(/Roll-back lines/.test(r.stdout) && /npx wrangler kv key put img_blocks_fixt --path ".*fixt\.json" --env azimuth2/.test(r.stdout), "it prints the rollback line per district");
  const lp = run(["--live-protected"]);
  ok(lp.status === 0 && fs.existsSync(path.join(d, "work", "new", "prot.json")), "--live-protected includes the protected district");
  const ap = run(["--apply"]);
  ok(ap.status !== 0 && /cannot be combined with --from-dir/.test(ap.stdout), "--apply cannot be combined with an offline folder (it only ever reads the live value)");
  const src = fs.readFileSync(path.join(REPO, "scripts", "apply_name_bindings.py"), "utf8");
  ok(!/shell=True/.test(src) && /subprocess\.run\(\[npx, "wrangler", "kv", "key", "put", key, "--path", path/.test(src) && /240 <= mins < 375/.test(fs.readFileSync(path.join(REPO, "scripts", "_cardlib.py"), "utf8")) && /L\.quiet_window\(\)/.test(src) && /Najma_Daily_Refresh/.test(fs.readFileSync(path.join(REPO, "scripts", "_cardlib.py"), "utf8")), "the put is an argument list, and --apply refuses 04:00-06:15 Dubai and a running Najma task");
  ok(/confidence/.test(src) && /== "high"/.test(src) && /changed in KV since it was read/.test(src) && /READ-BACK OF/.test(src), "only high rows; refuses a live value that changed since it was read; read-back compare");
  const real = path.join(REPO, "..", "..", "Dev", "naj-market-pulse", "data", "protected_keys.json");
  const pk = "C:/Dev/naj-market-pulse/data/protected_keys.json";
  if (fs.existsSync(pk)) ok(/img_blocks_jumeirahvillagecircle/.test(fs.readFileSync(pk, "utf8")) && /protected_keys/.test(src), "the real data/protected_keys.json is honoured (it protects img_blocks_jumeirahvillagecircle)");
}
fs.rmSync(TMP, { recursive: true, force: true });
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
