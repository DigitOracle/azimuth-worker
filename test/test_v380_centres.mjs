// v380 - DUBAI 2040 CENTRES: the Developers-by-area map OPENS on the five centres (plus the coastal layer) and the filter bar lives in the upper-left of the map on every screen.
// Offline. The whole page script runs inside a small fake browser (a fake document, fetch, and a fake map that records its calls); no network, no KV, no deploy.
//   node test/test_v380_centres.mjs
import fs from "node:fs";
import { devmapHtml, devmapRoutes } from "../src/devmap_page.js";
import { CENTRES_CSS, CENTRES_JS } from "../src/centres2040_page.js";
import { cleanCentres } from "../src/centres2040.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };
const EMOJI = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const strip = (h) => String(h).replace(/<title>[^<]*<\/title>/g, "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const FILE = new URL("../data/centres2040/centres2040.json", import.meta.url);
const RAW = fs.readFileSync(FILE, "utf8"), DATA = JSON.parse(RAW);
const NOTE = "Our grouping of districts; the plan names the centres, not their boundaries", SRC = "Dubai 2040 Urban Master Plan, UAE Government, 13 Mar 2021";

console.log("A - the data file (scripts/build_centres2040.py)");
ok(RAW.length < 600 * 1024, "under 600 KB: " + Math.round(RAW.length / 1024) + " KB", RAW.length);
ok(DATA.tol_m === 15 && DATA.geo.features.length > 100, "simplified at " + DATA.tol_m + " m, " + DATA.geo.features.length + " drawn polygons");
ok(DATA.source === SRC && DATA.grouping === NOTE, "carries the source line and the 'our grouping' label");
const ce = DATA.centres;
ok(ce.length === 5 && ce.map((c) => c.id).join() === "1,2,3,4,5" && /Deira and Bur Dubai/.test(ce[0].name) && /Downtown and Business Bay/.test(ce[1].name) && /Dubai Marina and JBR/.test(ce[2].name) && /Expo 2020 Centre/.test(ce[3].name) && /Dubai Silicon Oasis Centre/.test(ce[4].name), "the five centres, in the plan's order");
ok(ce[0].units === 33952 && ce[1].units === 142384 && ce[2].units === 153501 && ce[4].units === 79184 && ce[0].units_all === 52433 && ce[1].units_all === 185187 && ce[2].units_all === 252335 && ce[4].units_all === 87553, "stock per centre matches the approved grouping note (core + adjacent, and with peripheral)", JSON.stringify(ce.map((c) => [c.units, c.units_all])));
ok(ce[3].units === 44141 && ce[3].units_all === 65168 && ce[3].nper === 14 && ce[3].ncomm === 1, "centre 4: Madinat Al Mataar alone is solid (44,141); the 13 communities that only touch it are in the lighter tint (all 65,168)");
ok(DATA.total_units === 778708 && ce.reduce((t, c) => t + c.units_all, 0) + DATA.outside_units === DATA.total_units, "every registered home is in a centre or in 'outside'");
ok(ce.every((c) => Math.abs(c.share - 100 * c.units / DATA.total_units) < 0.06), "shares are of Dubai's registered homes");
const byNum = Object.fromEntries(DATA.comms.map((c) => [c.cn, c]));
ok(byNum[648].c === 5 && byNum[648].t === "a" && /not one of the five centres/.test(byNum[648].cap), "Dubai Land Residence Complex's area (Wadi Al Safa 5) is adjacent to centre 5 and its caption says it is not one of the five");
ok(byNum[521].c === 4 && byNum[521].t === "c" && /Expo City, Dubai South and the airport district/.test(byNum[521].cap), "Madinat Al Mataar: centre 4 core, caption names Expo City, Dubai South and the airport district");
ok(byNum[626].c === 5 && /Dubai Silicon Oasis and Academic City/.test(byNum[626].cap), "Nadd Hessa: centre 5, Silicon Oasis and Academic City named");
const offshore = DATA.comms.filter((c) => c.t0 === "x");
ok(offshore.length === 4 && offshore.every((c) => c.c === 0) && offshore.every((c) => !DATA.geo.features.some((f) => f.properties.i === DATA.comms.indexOf(c))), "the four offshore polygons are not grouped and not drawn");
const outsideDrawn = DATA.geo.features.filter((f) => { const r = DATA.comms[f.properties.i]; return r.c === 0 && !r.sea; });
ok(outsideDrawn.length === 0, "outside-the-4-km communities are not drawn (neutral); only sea-coast ones outside the centres are, for the coastal layer");
const sea = DATA.comms.filter((c) => c.sea), wf = DATA.comms.filter((c) => c.wf && !c.sea);
ok(sea.length === 23 && sea.reduce((t, c) => t + c.u, 0) === 84333 && wf.length === 24 && wf.reduce((t, c) => t + c.u, 0) === 200619, "coastal layer: 23 sea-coast areas, 84,333 homes; waterfront badge: 24 more, 200,619");
ok(DATA.comms.filter((c) => c.c2).every((c) => c.c2 >= 1 && c.c2 <= 5 && c.c2 !== c.c && typeof c.d2 === "number"), "communities between two centres carry the second-nearest centre and its distance");
const named = ["Creek Harbour", "Palm Jumeirah", "Media City", "Maritime City", "JVC", "Sports City"];
ok(DATA.comms.filter((c) => c.c && c.e === "N").every((c) => c.t === "c"), "only core communities carry the 'named in the plan' evidence; everything else is DERIVED_NEAREST");
ok(["alkhairanfirst", "palmjumeirah", "dubaimaritimecity", "jumeirahvillagecircle", "dubaisportscity", "dubaihills", "sobhaheartland"].every((s) => { const r = DATA.comms[DATA.sl[s]]; return r && r.c && r.e === "D"; }), "Creek Harbour, Palm Jumeirah, Maritime City, JVC, Sports City, Dubai Hills, Sobha Hartland: all DERIVED_NEAREST, none official");
ok(fs.existsSync(new URL("../data/centres2040/centres2040_audit.csv", import.meta.url)) && fs.readFileSync(new URL("../data/centres2040/centres2040_audit.csv", import.meta.url), "utf8").trim().split("\n").length === 224, "the audit CSV has one row per community (223)");
ok(cleanCentres(DATA) === DATA && cleanCentres({}) === null && cleanCentres({ centres: [] }) === null && cleanCentres(null) === null, "cleanCentres accepts the file and refuses anything malformed");

console.log("B - the route (what=centres)");
const store = {};
const env = { MEETINGS: { async get(k) { return store[k] == null ? null : JSON.stringify(store[k]); } } };
const deps = { clientOk: () => true, najNav: () => "", NAJ_NAV_CSS: "", NAJ_FONTS: "" };
const callR = async (what) => { const u = "https://x/developers_map_api?what=" + what + "&key=k"; const r = await devmapRoutes(new Request(u), env, new URL(u), deps); return { status: r.status, body: await r.json() }; };
let r0 = await callR("centres");
ok(r0.status === 200 && JSON.stringify(r0.body) === "{}", "not on file: {} with status 200 (the page keeps the old opening)");
store.img_centres2040 = DATA; r0 = await callR("centres");
ok(r0.status === 200 && r0.body.centres.length === 5 && r0.body.geo.features.length === DATA.geo.features.length, "on file: the whole value");
store.img_centres2040 = { centres: [1] }; r0 = await callR("centres");
ok(JSON.stringify(r0.body) === "{}", "malformed: {}");

console.log("C - the page script and its styles");
const html = devmapHtml("k", deps);
const js = html.slice(html.indexOf("<script>", html.indexOf("maplibre-gl.js")) + 8, html.lastIndexOf("</script>"));
let parses = true; try { new Function(js); new Function(CENTRES_JS); } catch (e) { parses = false; console.log(String(e)); }
ok(parses, "the page script (with the centres module) parses");
ok(!CENTRES_JS.includes("`") && !CENTRES_JS.includes("${") && !CENTRES_CSS.includes("`"), "no backticks or substitutions in the injected text (the page's String.raw rule)");
ok(!EMOJI.test(CENTRES_JS) && !EMOJI.test(CENTRES_CSS), "no emoji in the module or its styles");
const px = [...CENTRES_CSS.matchAll(/(?:^|[;{\s])(?:min-)?width:\s*(\d+)px/g)].map((m) => Number(m[1]));
ok(px.every((n) => n <= 375), "no fixed width over 375 px in the new styles", px.join());
ok(/#fbar\{position:absolute;left:8px;top:8px;[^}]*max-width:calc\(100% - 64px\)/.test(CENTRES_CSS), "the bar is upper-left, 8 px in, and leaves room for the map's own buttons");
ok(/#fbar\{[^}]*flex-wrap:wrap/.test(CENTRES_CSS) && /\.fmenu\{[^}]*min-width:min\(300px,calc\(100vw - 80px\)\)/.test(CENTRES_CSS), "chips wrap; a menu is at most 300 px and never wider than the screen minus 80 px (375 px safe)");
ok(/body #bsnap,body\.locked #bsnap\{top:var\(--fbh,56px\)!important\}/.test(CENTRES_CSS), "the building snapshot card sits below the bar (it measures itself), so nothing overlaps on a phone");
ok(/@media\(max-width:360px\)\{.*\.cg2\{grid-template-columns:1fr\}/.test(CENTRES_CSS) && /#cenlg\{bottom:calc\(46vh \+ 10px\)/.test(CENTRES_CSS), "very narrow phones: one card across; the legend rises above the bottom sheet");
ok(html.includes("CENTRES2040.make({S:S") && html.includes('api("centres")') && html.includes("CF.addLayers(map,font)"), "the page wires the module, asks for what=centres and adds the map layers");
const lum = (h) => { const v = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((x) => x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
ok(ce.every((c) => cr(c.colour, "#0b1211") >= 4.5), "the number badge (dark text on the centre colour) passes 4.5:1 for all five", ce.map((c) => cr(c.colour, "#0b1211").toFixed(1)).join());
ok(ce.every((c) => cr(c.colour, "#0e1413") >= 3), "each centre colour against the map ground passes 3:1", ce.map((c) => cr(c.colour, "#0e1413").toFixed(1)).join());
ok(new Set(ce.map((c) => c.colour)).size === 5, "five different colours, and each centre is also told by a number and a name (never colour alone)");

// ---- the fake browser ----
const regs = new Set();
class El {
  constructor(id) { this.id = id || ""; this._h = ""; this.children = []; this.parentNode = null; this.attrs = {}; this.sets = {}; this.style = { setProperty: (k, v) => { this.sets[k] = v; } }; this.classes = new Set(); const self = this; this.classList = { toggle(c, on) { if (on) self.classes.add(c); else self.classes.delete(c); }, add(c) { self.classes.add(c); }, remove(c) { self.classes.delete(c); }, contains(c) { return self.classes.has(c); } }; this.offsetHeight = 40; this.textContent = ""; this.value = ""; this.className = ""; }
  set innerHTML(v) { this._h = String(v); }
  get innerHTML() { return this._h + this.children.map((c) => c.id ? "" : c.innerHTML).join(""); }
  appendChild(c) { c.parentNode = this; if (!this.children.includes(c)) this.children.push(c); if (c.id) regs.add(c); return c; }
  setAttribute(k, v) { this.attrs[k] = v; }
  addEventListener() {} querySelectorAll() { return []; } querySelector() { return null; } closest() { return null; } focus() {} setSelectionRange() {}
}
function boot({ search = "", centres, idx, mine = ["x", "y"], map = true }) {
  regs.clear();
  const byId = {}; const reg = (id) => { const e = new El(id); byId[id] = e; regs.add(e); return e; };
  ["map", "side", "grab", "source", "sidebody", "detail", "detail2"].forEach(reg);
  const all = () => [...regs];
  const doc = { body: new El(""), createElement: () => new El(""), getElementById(id) { const hit = all().find((e) => e.id === id); if (hit) return hit; const re = new RegExp("id=\"?" + id + "[\"\\s>]"); if (all().some((e) => re.test(e.innerHTML))) { const e = new El(id); regs.add(e); return e; } return null; }, querySelectorAll: () => [] };
  const win = {};
  const FM = { inst: null };
  class FakeMap {
    constructor(o) { FM.inst = this; this.layers = []; this.sources = {}; this.h = {}; this.paint = {}; this.layout = {}; this.calls = []; }
    on(ev, a, b) { const k = typeof a === "function" ? ev : ev + ":" + a; (this.h[k] = this.h[k] || []).push(typeof a === "function" ? a : b); }
    addControl() {} getStyle() { return { layers: [{ id: "lab", type: "symbol", layout: { "text-font": ["F"] } }] }; }
    addSource(id, o) { const s = { data: o.data, setData: (d) => { s.data = d; } }; this.sources[id] = s; } getSource(id) { return this.sources[id]; }
    addLayer(l, before) { this.layers.push({ l, before }); this.paint[l.id] = Object.assign({}, l.paint); this.layout[l.id] = Object.assign({}, l.layout); }
    getLayer(id) { return this.layers.find((x) => x.l.id === id); }
    getPaintProperty(id, p) { return this.paint[id] && this.paint[id][p]; } setPaintProperty(id, p, v) { this.paint[id][p] = v; }
    setLayoutProperty(id, p, v) { this.layout[id][p] = v; } fitBounds(b, o) { this.fit = [b, o]; } flyTo(o) { this.fly = o; } getCanvas() { return { style: {} }; } queryRenderedFeatures() { return []; }
  }
  class Popup { setLngLat() { return this; } setHTML() { return this; } addTo() { return this; } remove() { return this; } }
  const lib = { Map: FakeMap, Popup, NavigationControl: class {} };
  if (map) win.maplibregl = lib;
  const fetchStub = (u) => { const m = /what=(\w+)/.exec(u); const w = m && m[1]; const body = w === "index" ? idx : w === "geo" ? { features: [] } : w === "shortlist" ? { devs: mine, at: "2026-10-07" } : w === "centres" ? centres : w === "delay" ? {} : w === "inv" ? { projects: [] } : null; return Promise.resolve({ ok: true, json: () => Promise.resolve(body) }); };
  const loc = { search: "?key=k" + search };
  const ls = { getItem: () => null, setItem() {} };
  const f = new Function("window", "document", "location", "fetch", "localStorage", "innerWidth", "innerHeight", "getComputedStyle", "navigator", "maplibregl", "matchMedia", "requestAnimationFrame", js);
  f(win, doc, loc, fetchStub, ls, 1200, 800, () => ({ display: "none" }), {}, map ? lib : undefined, undefined, () => 0);
  return { win, doc, FM, byId, all, el: (id) => doc.getElementById(id) };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const mkArea = (name, bb, devs) => ({ name, bbox: bb, devs });
const cell = (n, p, label, dn) => ({ n: dn, h: 0, c: [[n, p, 1e6, 1]], b: [[n, p, label]], r: [] });
const [bx, by] = (() => { // an interior point of a drawn centre polygon, for the position fallback
  const f = DATA.geo.features.find((q) => DATA.comms[q.properties.i].cn === 392); const ring = f.geometry.type === "Polygon" ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
  const inR = (r, x, y) => { let o = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { if (((r[i][1] > y) !== (r[j][1] > y)) && (x < (r[j][0] - r[i][0]) * (y - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0])) o = !o; } return o; };
  const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
  for (let k = 0; k < 4000; k++) { const x = Math.min(...xs) + Math.random() * (Math.max(...xs) - Math.min(...xs)), y = Math.min(...ys) + Math.random() * (Math.max(...ys) - Math.min(...ys)); if (inR(ring, x, y)) return [x, y]; }
  return ring[0];
})();
const IDX = () => ({ as_of: "2026-09-09", cuts: { bounds: [30000, 20000, 12000] }, devs: { x: { name: "X Developments", areas: 3, n: 50, profile: { projects: 3, homes: 0 } }, y: { name: "Y Properties", areas: 2, n: 40, profile: { projects: 2, homes: 0 } } }, areas: {
  marsadubai: mkArea("Marsa Dubai", [55.13, 25.07, 55.15, 25.09], { x: cell(20, 35000, "Marina Tower X", "X"), y: cell(10, 25000, "Marina Y Hall", "Y") }),
  businessbay: mkArea("Business Bay", [55.26, 25.17, 55.29, 25.20], { x: cell(15, 28000, "Bay Tower X", "X") }),
  albarshasouthfourth: mkArea("Al Barsha South Fourth", [55.2, 25.05, 55.23, 25.07], { y: cell(30, 15000, "Circle Y Park", "Y") }),
  madinatalmataar: mkArea("Madinat Al Mataar", [55.1, 24.88, 55.2, 24.95], { y: cell(12, 14000, "South Y Row", "Y") }),
  mirdif: mkArea("Mirdif", [55.41, 25.2, 55.44, 25.23], { x: cell(15, 18000, "Mirdif X Villas", "X") }),
  zzposition: mkArea("Position Test Area", [bx - 0.00002, by - 0.00002, bx + 0.00002, by + 0.00002], { y: cell(5, 20000, "Pos Y Tower", "Y") }),
  nowhere: mkArea("Nowhere Land", [50.0, 20.0, 50.1, 20.1], { x: cell(5, 20000, "Far X Tower", "X") }) } });

console.log("D - it opens on the five centres");
let B = boot({ centres: DATA, idx: IDX() }); await wait(30);
let dm = B.win.__devmap, S = dm.state, CF = dm.cf;
ok(CF && CF.on() && S.screen === 1 && CF.fillMode() && CF.noBands(), "with the data present the page is in centre mode: screen 1, the opening, no price-band shading");
let side = B.el("sidebody").innerHTML, st = strip(side);
ok(/Dubai 2040: the five centres/.test(st) && [1, 2, 3, 4, 5].every((n) => side.includes('data-cen="' + n + '"')), "five cards, one per centre, in the side panel");
ok(st.includes(NOTE) && st.includes(SRC), "the 'our grouping' label and the source line are on screen");
ok(/Deira and Bur Dubai/.test(st) && /Downtown and Business Bay/.test(st) && /Dubai Marina and JBR/.test(st) && /Expo 2020 Centre/.test(st) && /Dubai Silicon Oasis Centre/.test(st) && /Historic: tradition and heritage/.test(st) && /technology and innovation hub/i.test(st), "each card carries number, name and one-line role");
ok(/33,952 registered homes, 4\.4% of Dubai/.test(st) && /142,384 registered homes, 18\.3% of Dubai/.test(st) && /44,141 registered homes, 5\.7% of Dubai/.test(st) && (side.match(/>DERIVED</g) || []).length >= 5, "per-centre registered stock and share of Dubai, each labelled DERIVED");
ok(/JBR means Jumeirah Beach Residence/.test(st), "no unexplained acronym: JBR is spelled out");
ok(/Sixth layer: coastal \(Najma.s own addition, not part of the plan\)/.test(st) && /Sea coast within 500 m/.test(st) && /23 areas, 84,333 registered homes \(10\.8% of Dubai\)/.test(st) && /inland waterfront/i.test(st) && /24 more areas, 200,619/.test(st), "the coastal layer is a switch, said to be Najma's own and not part of the plan, with the waterfront badge");
ok(/Outside the five centres: 136,032 registered homes/.test(st), "the rest of Dubai is said to be neutral and its stock is shown");
const bar0 = B.el("fbmain").innerHTML;
ok(["cen", "coast", "area", "dev", "band", "win"].every((f) => bar0.includes('data-f="' + f + '"')) && /All of Dubai/.test(bar0) && /All areas/.test(bar0) && /All developers/.test(bar0) && /All price bands/.test(bar0) && /Last 12 months|All years/.test(bar0), "the filter bar is there from the first screen with Centre, Coastal, Area, Developer, Price band and Window");
ok(B.el("fbar") && B.el("fbar").parentNode === B.el("map") && B.el("map").sets["--fbh"] === "56px", "the bar sits in the map frame and the map is told its height (56 px here) so the snapshot card sits below it");
let m = B.FM.inst; m.h.load.forEach((f) => f()); await wait(5);
const lid = (id) => m.layers.find((x) => x.l.id === id);
ok(["c-fill", "c-seafill", "c-line", "c-ol", "c-sea", "c-wf", "c-lab"].every((i) => lid(i)) && lid("c-fill").before === "a-fill" && lid("c-ol").before === "a-label", "the centre layers are added under the area layers");
ok(m.paint["a-fill"]["fill-opacity"] === 0.01 && m.paint["a-line"]["line-opacity"] === 0 && m.layout["a-label"].visibility === "none" && m.layout["c-lab"].visibility === "visible", "area shading, outlines and labels are off; the centre labels are on");
const feats = () => m.sources.cen.data.features;
const solid3 = feats().filter((f) => f.properties.c === 3 && f.properties.t !== "p"), per3 = feats().filter((f) => f.properties.c === 3 && f.properties.t === "p");
ok(solid3.length === 9 && solid3.every((f) => f.properties.fo === 0.5) && per3.length === 7 && per3.every((f) => f.properties.fo === 0.2 && f.properties.col === ce[2].colour), "centre 3: nine solid communities and seven in the lighter tint (the same colour, lower opacity)");
ok(feats().filter((f) => !f.properties.c).every((f) => f.properties.fo === 0), "everything else is neutral");
ok(m.sources.cenlab.data.features.map((f) => f.properties.t).join("|") === ce.map((c) => c.id + "  " + c.name).join("|"), "each centre is labelled on the map with its number and name");
ok((m.h["click:c-fill"] || []).length === 1 && (m.h["click:a-fill"] || []).length === 1, "a tap on a centre picks it; the area tap is held back until a centre is chosen");

console.log("E - choosing a centre filters areas, developers and projects; leaving returns to all");
CF.act("cen", 3);
ok(S.cen === 3 && !CF.fillMode() && !CF.noBands() && m.fit && m.fit[0][0][0] === ce[2].bbox[0], "a centre is chosen: bands appear, the map flies to it");
ok(m.paint["a-fill"]["fill-opacity"] !== 0.01 && Array.isArray(m.paint["a-fill"]["fill-opacity"]) && m.layout["c-lab"].visibility === "none" && m.layout["a-label"].visibility === "visible", "the area layer is restored (price bands are the optional layer now)");
const ar = m.sources.areas.data.features, dimOf = (s) => (ar.find((f) => f.properties.slug === s) || { properties: {} }).properties.dim, vOf = (s) => (ar.find((f) => f.properties.slug === s) || { properties: {} }).properties.v;
ok(dimOf("marsadubai") === 0 && dimOf("albarshasouthfourth") === 0 && dimOf("businessbay") === 1 && dimOf("madinatalmataar") === 1 && dimOf("mirdif") === 1 && dimOf("nowhere") === 1, "on the map, only the areas of that centre stay lit");
ok(vOf("marsadubai") > 0, "and they carry price-band shading");
side = B.el("sidebody").innerHTML; st = strip(side);
ok(/Dubai Marina and JBR/.test(st) && /Existing centre/.test(st) && /153,501/.test(st) && /252,335/.test(st), "the side panel shows the centre card with core + adjacent and with-peripheral stock");
ok(/data-carea="marsadubai"/.test(side) && /data-carea="albarshasouthfourth"/.test(side) && !/data-carea="businessbay"/.test(side) && !/data-carea="madinatalmataar"/.test(side) && !/data-carea="mirdif"/.test(side), "the area list holds only the areas of that centre");
ok(/data-carea="zzposition"/.test(side) && !/data-carea="nowhere"/.test(side), "an area with no key of its own is placed by its position; one outside every polygon is not in any centre");
ok(/data-k="x"/.test(side) && /data-k="y"/.test(side) && /Y Properties/.test(st) && /class="dlink dvc"/.test(side), "the developer list is built from the sales in those areas");
ok(/Peripheral in our grouping/.test(st) && /Core|Adjacent/.test(st), "each area card says core, adjacent or peripheral in our grouping");
// a locked developer: the project list, the area cards and the price table follow the centre
CF.act("cen", null); CF.act("dev", "x");
ok(S.prof === "x" && S.cen === null, "a developer chosen from the bar locks the page");
const detail = () => B.el("detail").innerHTML;
const pj0 = detail();
ok(/data-aslug="marsadubai"/.test(pj0) && /data-aslug="businessbay"/.test(pj0) && /data-aslug="mirdif"/.test(pj0), "unfiltered: X's three areas are listed");
CF.act("cen", 2);
const pj2 = detail();
ok(/data-aslug="businessbay"/.test(pj2) && !/data-aslug="marsadubai"/.test(pj2) && !/data-aslug="mirdif"/.test(pj2) && /Bay Tower X/.test(pj2) && !/Marina Tower X/.test(pj2) && !/Mirdif X Villas/.test(pj2), "locked on X and Downtown and Business Bay chosen: area cards, price table and project list show only Business Bay");
ok(/id=cfnote/.test(pj2) && /the price-band mix, scale and evidence below are for all of Dubai/.test(strip(pj2)), "and the page says which parts follow the choice and which are for all of Dubai");
CF.act("cen", 4);
ok(/No area in this choice has 3 or more settled sales/.test(strip(detail())) || /Showing only the areas/.test(strip(detail())), "a centre where X does not sell: the page says so rather than showing other areas");
ok(!/data-aslug="marsadubai"/.test(detail()), "and lists none of X's other areas");
CF.act("cen", null);
ok(/data-aslug="marsadubai"/.test(detail()) && /data-aslug="mirdif"/.test(detail()) && !/id=cfnote/.test(detail()), "leaving the centre brings every area back");
ok(B.el("lockchips") && B.el("lockchips").parentNode === B.el("fbar") && /chipdev/.test(B.el("lockchips").innerHTML), "the developer lock chips sit inside the same bar (the v371 chips, unchanged)");
const barL = B.el("fbmain").innerHTML;
ok(/data-f="cen"/.test(barL) && /data-f="coast"/.test(barL) && !/data-f="dev"/.test(barL) && !/data-f="win"/.test(barL), "while locked the bar shows Centre and Coastal and the lock chips stand for Developer, Area, Price band and Window (never twice)");
CF.act("dev", null);
ok(S.prof === null && /data-f="dev"/.test(B.el("fbmain").innerHTML), "x on the developer chip leaves the lock; the plain chips return");
// the developers on screen 1 follow the centre
CF.act("cen", 4);
side = B.el("sidebody").innerHTML;
ok(/Expo 2020 Centre: 1 area, 12 sales/.test(strip(side)) && /Expo 2020 Centre: no sales here/.test(strip(side)), "the developers list on screen 1 says, per developer, its sales in the centre or 'no sales here'");
ok(side.lastIndexOf('data-k="y"') < side.lastIndexOf('data-k="x"'), "and the developer with sales there comes first in the list");
CF.act("cen", null);

console.log("F - the bar on every screen, and state kept across them");
CF.act("cen", 3);
S.screen = 2; CF.act("shade", true);
ok(S.cen === 3 && ["cen", "coast", "area", "dev", "band", "win"].every((f) => B.el("fbmain").innerHTML.includes('data-f="' + f + '"')) && /3 Dubai Marina and JBR/.test(B.el("fbmain").innerHTML), "screen 2: the bar is there with the same choice");
ok(/id=cenfilt/.test(B.el("sidebody").innerHTML) && /only the areas in Dubai Marina and JBR/.test(strip(B.el("sidebody").innerHTML)), "screen 2 says the choice is on");
S.screen = 3; S.mode = "buy"; S.bud = { mode: "sqft", min: null, max: 40000, beds: null }; CF.act("shade", true);
ok(S.cen === 3 && ["cen", "coast", "area", "dev", "band", "win"].every((f) => B.el("fbmain").innerHTML.includes('data-f="' + f + '"')), "screen 3: the bar is there with the same choice");
ok(Array.isArray(S.meeting) && S.meeting.every((a) => CF.ok(a.slug)) && S.meeting.some((a) => a.slug === "marsadubai") && !S.meeting.some((a) => a.slug === "businessbay"), "screen 3: the client-meeting results by location are filtered to the centre", JSON.stringify((S.meeting || []).map((a) => a.slug)));
S.screen = 1; CF.act("shade", true);
ok(S.cen === 3 && /3 Dubai Marina and JBR/.test(B.el("fbmain").innerHTML), "back on screen 1 the choice is still there");
CF.act("cen", null);

console.log("G - the coastal switch");
S.screen = 1; CF.act("coast", true);
ok(S.coast && CF.fillMode(), "Coastal on at the opening keeps the five centres and adds the layer");
ok(m.paint["c-sea"]["line-opacity"] === 0.95 && m.paint["c-seafill"]["fill-opacity"] === 0.22 && m.paint["c-wf"]["line-opacity"] === 0.75, "sea-coast areas are outlined, the inland waterfront gets its dotted second badge");
ok(CF.ok("marsadubai") && !CF.ok("businessbay") && !CF.ok("albarshasouthfourth"), "the lists keep sea-coast areas only (Business Bay is waterfront, not sea coast)");
ok(/aria-checked="true"/.test(B.el("fbmain").innerHTML) && /\+ waterfront badge/.test(B.el("fbmain").innerHTML), "the chip is a switch, on, with the waterfront badge");
ok(/Sea coast within 500 m \(Najma.s own layer, not part of the plan\)/.test(CF.legendHtml()) && /id=coastsw/.test(B.el("sidebody").innerHTML) && /aria-checked="true"/.test(B.el("sidebody").innerHTML), "the legend names it as Najma's own layer; the switch in the side panel is on");
CF.act("cen", 3);
ok(CF.ok("marsadubai") && !CF.ok("albarshasouthfourth"), "a centre and Coastal together: both must hold");
dm.select("businessbay");
ok(S.cen === 2 && S.coast === false, "tapping an area outside the choice moves the choice to that area's centre (and drops Coastal when it is not sea coast)");
CF.act("cen", null); S.sel = null; CF.act("coast", false);
ok(!S.coast && CF.ok("businessbay") && CF.ok("mirdif"), "Coastal off: all areas again");

console.log("H - the area card: centre, evidence, second-nearest centre, captions");
const L = (s) => strip(CF.areaLine(s));
let l = L("marsadubai");
ok(/Centre 3: Dubai Marina and JBR/.test(l) && /Named in the plan \(the district; our list of its communities\)/.test(l) && /Sea coast within 500 m/.test(l) && l.includes(NOTE) && l.includes(SRC), "Marsa Dubai: centre 3, core, named district, sea coast, label and source");
l = L("albarshasouthfourth");
ok(/Centre 3/.test(l) && /Peripheral in our grouping/.test(l) && /Our grouping \(DERIVED_NEAREST\)/.test(l) && /Jumeirah Village Circle/.test(l), "the community that holds Jumeirah Village Circle: peripheral, our grouping (DERIVED_NEAREST), never official");
l = L("alsatwa");
ok(/Between two centres/.test(l) && /Deira and Bur Dubai/.test(l) && /Centre 2/.test(l), "Al Satwa sits between two centres: placed with the nearer, the second-nearest is named with its distance");
l = L("madinatalmataar");
ok(/Centre 4: Expo 2020 Centre/.test(l) && /Expo City, Dubai South and the airport district/.test(l) && /about 3\.5 square km/.test(l), "Madinat Al Mataar: centre 4 with the caption that it holds Expo City, Dubai South and the airport district");
l = L("siliconoasis");
ok(/Centre 5/.test(l) && /Silicon Oasis and Academic City/.test(l), "Nadd Hessa: centre 5, Silicon Oasis and Academic City named");
l = L("wadialsafa5");
ok(/Centre 5/.test(l) && /not one of the five centres/.test(l) && /Adjacent/.test(l), "Dubai Land Residence Complex: next to centre 5, said not to be one of the five");
l = L("alkhairanfirst");
ok(/Centre 1/.test(l) && /Our grouping \(DERIVED_NEAREST\)/.test(l) && /Dubai Creek Harbour/.test(l), "Creek Harbour: centre 1 by distance, DERIVED_NEAREST");
l = L("palmjumeirah");
ok(/Centre 3/.test(l) && /DERIVED_NEAREST/.test(l) && /Sea coast/.test(l), "Palm Jumeirah: derived, sea coast");
l = L("mirdif");
ok(/Outside the five centres/.test(l) && /More than 4 km/.test(l), "Mirdif: outside the five centres");
l = L("zzposition"); ok(/Centre 3/.test(l), "an area with no key is found by its position");
ok(CF.areaLine("nowhere") === "", "an area in no polygon at all gets no line");

console.log("I - ?bands=1 and the missing file keep the old opening");
B = boot({ search: "&bands=1", centres: DATA, idx: IDX() }); await wait(30);
dm = B.win.__devmap; S = dm.state; CF = dm.cf; m = B.FM.inst; m.h.load.forEach((f) => f()); await wait(5);
ok(CF.on() && S.bflag && !CF.fillMode() && !CF.noBands() && S.screen === 2, "?bands=1: no centre opening, no re-routing to screen 1 (the old opening, on screen 2 for a saved list), price-band shading on");
ok(!/five centres/.test(B.el("sidebody").innerHTML) && m.paint["a-fill"]["fill-opacity"] !== 0.01 && !/Price bands/.test("") , "no centre cards; the area layer is not hidden");
ok(["cen", "coast", "area", "dev", "band", "win"].every((f) => B.el("fbmain").innerHTML.includes('data-f="' + f + '"')), "the filter bar is there all the same");
ok(m.sources.cen.data.features.every((f) => f.properties.fo === 0), "the centre layer carries no fill in the old opening");
CF.act("cen", 2);
ok(S.cen === 2 && m.sources.cen.data.features.filter((f) => f.properties.c === 2).every((f) => f.properties.lo === 0.8) && /Downtown and Business Bay/.test(strip(B.el("sidebody").innerHTML)), "choosing a centre still works (outline, filter, card)");
B = boot({ centres: {}, idx: IDX() }); await wait(30);
dm = B.win.__devmap; S = dm.state; CF = dm.cf; m = B.FM.inst; m.h.load.forEach((f) => f()); await wait(5);
ok(CF && !CF.on() && !CF.fillMode() && !CF.noBands(), "no data file: not in centre mode");
ok(!m.layers.some((x) => x.l.id === "c-fill") && m.paint["a-fill"]["fill-opacity"] !== 0.01 && !/five centres/.test(B.el("sidebody").innerHTML), "no data file: the old opening, price bands, no centre cards, area layer untouched");
const barN = B.el("fbmain").innerHTML;
ok(!/data-f="cen"/.test(barN) && !/data-f="coast"/.test(barN) && ["area", "dev", "band", "win"].every((f) => barN.includes('data-f="' + f + '"')), "no data file: the bar still shows Area, Developer, Price band and Window (no Centre or Coastal chips to offer)");
ok(CF.ok("mirdif") && CF.areaLine("marsadubai") === "" && CF.cardsHtml() === "", "no data file: nothing is filtered, no centre lines");
B = boot({ centres: null, idx: IDX(), map: false }); await wait(30);
ok(B.win.__devmap.cf && !B.win.__devmap.cf.on() && /data-f="area"/.test(B.el("fbmain").innerHTML), "a failed centres request (null) and no map library: the lists and the bar still work");

console.log("J - the bar's choices (menus) and the existing page");
B = boot({ centres: DATA, idx: IDX() }); await wait(30);
dm = B.win.__devmap; S = dm.state; CF = dm.cf; m = B.FM.inst; m.h.load.forEach((f) => f()); await wait(5);
S.fmenu = "cen"; CF.refresh();
let mh = B.el("fbmain").innerHTML;
ok(/role=dialog/.test(mh) && /All of Dubai/.test(mh) && [1, 2, 3, 4, 5].every((n) => mh.includes('data-v="' + n + '"')) && /aria-expanded="true"/.test(mh) && /data-x="?menu/.test(mh), "tapping Centre opens its choices (All of Dubai and five) with a close button");
S.fmenu = "band"; CF.refresh(); mh = B.el("fbmain").innerHTML;
ok([0, 1, 2, 3].every((n) => mh.includes('data-v="' + n + '"')) && /Price bands appear on the map once you choose a centre, an area or a developer/.test(mh) && /data-sh="1"/.test(mh), "the Price band menu lists the four bands, says when bands appear, and has the shading switch");
CF.act("band", 1);
ok(S.band === 1 && !CF.fillMode() && !CF.noBands(), "choosing a price band brings the bands layer in at once");
CF.act("band", null, true);
ok(S.band === null && CF.fillMode(), "x clears it and the opening returns");
S.fmenu = "area"; CF.refresh(); mh = B.el("fbmain").innerHTML;
ok(["marsadubai", "businessbay", "mirdif"].every((s) => mh.includes('data-v="' + s + '"')) && /All areas/.test(mh), "the Area menu lists the areas");
CF.act("area", "businessbay");
ok(S.sel === "businessbay" && !CF.fillMode() && /Business Bay/.test(B.el("fbmain").innerHTML) && /data-x="area"/.test(B.el("fbmain").innerHTML), "choosing an area selects it; its chip shows the name with an x");
ok(/Centre 2: Downtown and Business Bay/.test(strip(B.el("detail").innerHTML)), "the area page opens with its centre line");
CF.act("area", null, true);
ok(S.sel === null && CF.fillMode(), "x on the area chip clears it");
CF.act("win", "all");
ok(S.win === "all", "the Window chip changes the window");
ok(/function select\(slug,fly,fk\)\{if\(S\.prof\)\{if\(!fset\(S\.prof\)\[slug\]\)return;if\(fly\)S\.parea=slug;fk=S\.prof\}/.test(js), "the v371 select() text is untouched");
ok(!EMOJI.test(strip(B.el("sidebody").innerHTML + B.el("fbmain").innerHTML + CF.legendHtml() + CF.areaLine("marsadubai"))), "no emoji anywhere in what the module draws");
const txt = strip(CF.cardsHtml() + CF.areaLine("alsatwa") + CF.legendHtml() + B.el("fbmain").innerHTML);
const caps = [...new Set(txt.match(/\b[A-Z]{2,6}\b/g) || [])].filter((w) => !["JBR", "DERIVED", "AED", "UAE"].includes(w));
ok(caps.length === 0, "no unexplained acronyms (only JBR, spelled out; DERIVED; AED; UAE in the source line)", caps.join());
ok(!/\b(DM|DLD|KV|ppsm)\b/.test(txt), "no shorthand");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
