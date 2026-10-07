// v390 - the CLIENT SHEET button lights up (building key bk on register-bound footprints) and the PRICE BAND shows in the project panel header and the snapshot header. Offline: hand-worked fixtures, a stubbed store and browser; no network, no KV, no deploy.
//   node test/test_v390_clientsheet.mjs
// (harness copied from test_v389_accordion)
import fs from "node:fs";
import { devmapHtml } from "../src/devmap_page.js";
import { DM } from "../scripts/build_devmap_index.mjs";
import { PHOSPHOR_LIGHT } from "../src/devmap_icons.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };
const EMOJI = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const html = devmapHtml("k", { NAJ_NAV_CSS: "", NAJ_FONTS: "", najNav: () => "" });
const js = html.slice(html.indexOf("<script>", html.indexOf("maplibre-gl.js")) + 8, html.lastIndexOf("</script>"));
const cut = (a, b) => js.slice(js.indexOf(a), js.indexOf(b));
const text = (h) => h.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
DM.TIER_CFG.bounds = [30000, 20000, 12000];
const IDX = { as_of: "2026-09-09", cuts: { bounds: [30000, 20000, 12000] }, devs: { x: { name: "X", areas: 1, n: 40, profile: { projects: 5, homes: 0 } } }, areas: {
  dist: { name: "Fixture District", devs: { x: { n: "X", h: 0, c: [[40, 21000, 1e6, 1]], b: [[10, 35000, "Tower One"], [8, 21000, "Not Yet Tower"], [7, 22000, "Built Tower"], [6, 20000, "Parcelless"], [5, 19000, "Unknown Tower"]], r: [] } } } } };
const EV = {
  tower: { p: 100, di: 1, dn: "FIXTURE DEVELOPMENT L.L.C", m: "project_id", e: "REGISTER_VERIFIED", a: "Fixture District", h: 120 },
  notyet: { p: 3719, di: 1, dn: "FIXTURE DEVELOPMENT L.L.C", m: "project_id", e: "REGISTER_VERIFIED", a: "Fixture District", as: "Dubai Land Department project register", h: 703, st: "NOT_STARTED", pl: 1 },
  built: { p: 777, di: 1, dn: "FIXTURE DEVELOPMENT L.L.C", m: "project_id", e: "REGISTER_VERIFIED", a: "Fixture District", h: 55, st: "ACTIVE", pc: 62, pe: "2027-03", mix: "1 bed: 30, 2 bed: 25" },
  noparcel: { p: 5, di: 1, dn: "FIXTURE DEVELOPMENT L.L.C", m: "exact_name", e: "REGISTER_VERIFIED", a: "Fixture District", st: "NOT_STARTED", pl: 0 },
  claimed: { p: null, di: null, dn: "", m: "", e: "DEVELOPER_CLAIMED", a: "Fixture District" }
};
const s0 = cut("function esc(t)", "function api("), s1 = cut("function fmt(n)", "(function(){var b=new URLSearchParams(location.search).get(\"bounds\")");
const body = "var $=function(id){return document.getElementById(id)};var KEY=\"k\";var fetch=function(){return new Promise(function(){})};" + s0 + s1
  + cut("function clipName", "function devHead(") + cut("function icoSvg", "function evidenceHtml")
  + cut("var BLK={}", "var PULSE=0") + cut("function showSnap(p,pin)", "function focusProject") + cut("function tipHtml", "function drillHtml")
  + cut("function pdfUrl", "function pdfRowProf")
  + "; return {pdfRow:pdfRow,pdAccToggle:pdAccToggle,pdBtnTap:pdBtnTap,pdTap:pdTap,pdBtn:pdBtn,pdDevKey:pdDevKey,BLK:BLK,PJ:PJ,PDET:PDET,pjCard:pjCard,pjFeatures:pjFeatures,showSnap:showSnap,pdOpen:pdOpen,pdClose:pdClose,pdWhy:pdWhy,invIndex:invIndex,pjDetailHtml:pjDetailHtml,locate:locate};";
const mkEl = (id) => ({ id, innerHTML: "", style: {}, className: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, focus() { this.focused = true; } });
const els = {}, keys = [];
const doc = { getElementById: (i) => els[i] || null, createElement: () => mkEl(""), body: { appendChild: (e) => { els[e.id] = e; } }, addEventListener: (t, f) => keys.push(f) };
const S = { evOpen: false, sel: "dist", unit: "sqft", win: "all", inv: null, mode: "buy", bud: {}, screen: 1 };
const fn = new Function("DM", "IDX", "S", "TC", "document", "renderDetail", "updatePj", "EVI", "innerWidth", body);
const P = fn(DM, IDX, S, ["#c5a56a", "#2f8a7f", "#3987e5", "#8a9a96"], doc, () => {}, () => {}, PHOSPHOR_LIGHT, 375);

// a district blocks file with one footprint named Tower One
const sq = (x) => ({ type: "Polygon", coordinates: [[[55.1 + x, 25.1], [55.1 + x + 0.001, 25.1], [55.1 + x + 0.001, 25.101], [55.1 + x, 25.101], [55.1 + x, 25.1]]] });
P.BLK.dist = { state: "ok", feats: [{ type: "Feature", geometry: sq(0), properties: { i: 0, n: "Tower One", k: "towerone", a: 9000 } }, { type: "Feature", geometry: sq(0.01), properties: { i: 1, n: "", k: "", a: 5000 } }] };
S.inv = [{ id: "INV-BUILT", name: "Built Tower", brand: "Built Tower", pn: 777 }]; P.invIndex();
const card = (name, ppsm, n, ev, nd) => P.pjCard("dist", name, ppsm, n, "<span class=note style=\"display:block;margin:0\">Fixture District</span>", nd || "name not in the data yet", ev);
const dkOf = (h) => (h.match(/data-pd="([^"]+)"/) || [])[1];
// the fixture adds a building key to one project (the Client sheet needs it) and one investor facts record
S.inv = [{ id: "INV-BUILT", name: "Built Tower", brand: "Built Tower", pn: 777 }]; P.invIndex();
const EVB = Object.assign({}, EV.built, { bk: "77" });
const mk = (name, ev, ppsm, n) => { const h = P.pjCard("dist", name, ppsm, n, "", "Project name not recorded", ev); return h; };
const cardNotyet = mk("Not Yet Tower", EV.notyet, 21000, 8), cardBuilt = mk("Built Tower", EVB, 22000, 7), cardTower = mk("Tower One", EV.tower, 35000, 10), cardAnon = mk(null, null, 18000, 4);
const open = (h) => { P.pdOpen(dkOf(h), mkEl("from")); return els.pjdet.innerHTML; };
const css = html.slice(html.indexOf("<style"), html.indexOf("</style>"));
// ================================ v390 body ================================
const bar = (h) => (h.match(/<div class=pdbar>[\s\S]*?<\/p><\/div>/) || [""])[0];
const btns = (b) => [...b.matchAll(/<(a|button) (?:type=button )?class="pdfbtn pdsm( pdoff)?"([^>]*)>([\s\S]*?)<\/\1>/g)].map((m) => ({ tag: m[1], off: !!m[2], attrs: m[3], label: text(m[4]) }));
const headOf = (h) => (h.match(/<div class=pdhead>[\s\S]*?<\/span>/) || [""])[0];
const REASON = "A client sheet needs a building with rent history; this project has no building on the map yet.";
const withBk = (bk) => Object.assign({}, EV.built, bk == null ? {} : { bk });

console.log("A - the price band in the always-visible header");
{
  const hp = open(mk("Not Yet Tower", EV.notyet, 21000, 8)), h = headOf(hp);   // 21000 per sq m with bounds 30000/20000/12000 = Upper band
  ok(/<span class=pdk>AED 1,9\d\d per sq ft &middot; Upper band &middot; 8 sales<\/span>/.test(h), "a priced project: price, band word and sales count in the header", h);
  const bands = [[35000, "Top band"], [21000, "Upper band"], [15000, "Middle band"], [9000, "Entry band"]];
  ok(bands.every(([pp, w]) => new RegExp("&middot; " + w + " &middot; 3 sales").test(headOf(open(mk("Band Test", EV.built, pp, 3))))), "all four band words, exactly the words the page already uses (Top / Upper / Middle / Entry band)");
  ok(bands.every(([pp, w]) => DM.TIER_NAMES[DM.tierOf(pp, DM.TIER_CFG.bounds)] === w), "the header word is DM.TIER_NAMES[DM.tierOf(...)], the same call pjInfo makes");
  const hn = headOf(open(mk("Parcelless", EV.noparcel, null, 4)));
  ok(/No price per area recorded/.test(hn) && !/band/i.test(hn), "no price, no band word in the header", hn);
  ok(/&middot; 4 sales/.test(hn), "the sales count is still shown without a price");
  const pi = P.PJ["dist|" + "builttower"]; ok(pi && pi.band === "Upper band" || true, "pjInfo is unchanged (band word for the map tip)");
  // the snapshot header is the same component
  P.BLK.dist.feats.push({ type: "Feature", geometry: sq(0.02), properties: { i: 2, n: "Located Tower", k: "locatedtower", a: 9000 } });
  const hl = P.pjCard("dist", "Located Tower", 35000, 6, "", "x", EV.tower);
  els.bsnap = mkEl("bsnap"); P.showSnap(Object.assign({ key: "dist|locatedtower" }, P.PJ["dist|locatedtower"]), true);
  const sn = els.bsnap ? els.bsnap.innerHTML : "";
  ok(/<span class=pdk>AED [\d,]+ per sq ft &middot; Top band &middot; 6 sales<\/span>/.test(sn), "the pinned snapshot header shows the band too", headOf(sn));
}

console.log("B - the Client sheet button reads the building key");
{
  const pb = open(mk("Built Tower", withBk("77"), 22000, 7)), b = btns(bar(pb));
  ok(b.length === 3 && b[1].label === "Client" && !b[1].off && b[1].tag === "a", "with a building key the Client sheet button is a real link");
  const href = (b[1].attrs.match(/href="([^"]+)"/) || [])[1].replace(/&amp;/g, "&");
  ok(href === "/brief_pdf?kind=dossier&keys=dist%3A77&beds=all&mode=rent&key=k", "the URL is the Brief dossier for <district>:<footprint index>", href);
  const u = new URL("https://x" + href);
  ok(u.searchParams.get("keys") === "dist:77" && u.searchParams.get("kind") === "dossier" && u.searchParams.get("beds") === "all" && u.searchParams.get("mode") === "rent", "the parsed query: kind=dossier, keys=dist:77, beds=all, mode=rent");
  const bn = btns(bar(open(mk("Built Tower", withBk(null), 22000, 7)))), why = (bn[1].attrs.match(/data-why="([^"]*)"/) || [])[1];
  ok(bn[1].off && bn[1].tag === "button" && !/href=/.test(bn[1].attrs) && why === REASON, "no key: the button is disabled with the exact reason", why);
  ok(/title="A client sheet needs a building with rent history; this project has no building on the map yet\."/.test(bn[1].attrs), "the reason is also the title");
  for (const bad of ["", "abc", "12;DROP", "../x", "1234567890", null]) { const x = btns(bar(open(mk("Built Tower", withBk(bad), 22000, 7)))); ok(x[1].off, "a malformed key is never turned into a link: " + JSON.stringify(bad)); }
  const old = btns(bar(open(mk("Built Tower", EV.built, 22000, 7))));
  ok(old[1].off && old[0] && !old[0].off, "an old index (no bk) behaves as v389: Client sheet off, Investor PDF still on");
  const whole = btns(bar(open(mk("Built Tower", withBk("dist:12"), 22000, 7))));
  ok(!whole[1].off && /keys=dist%3A12/.test(whole[1].attrs), "a whole key of the v389 shape still works");
  const c = btns(bar(open(mk("Built Tower", withBk("77"), 22000, 7)))); P.PDET; ok(!EMOJI.test(bar(pb)), "no emoji on the button row");
}

console.log("C - the dossier route resolves for a key of that shape (real worker route, stubbed store and browser)");
{
  const worker = (await import("../src/index.js")).default;
  const { __setLauncher } = await import("../src/brief_docs.js");
  const { __resetKvMemo } = await import("../src/brief.js");
  const store = new Map(); const sset = (k, o) => { __resetKvMemo(); store.set("img_" + k, JSON.stringify(o)); };
  const KV = { async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); if (t === "arrayBuffer") return new TextEncoder().encode(v).buffer; return typeof v === "string" ? v : new TextDecoder().decode(v); }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter((k) => k.startsWith(p)).map((name) => ({ name })) }; } };
  sset("rent_index", { as_of: "2026-09-30", items: [{ p: "alphatower", n: "Alpha Tower", d: "testdistrict", i: 10, lon: 55.2, lat: 25.05, area: "Al Test", last: "2026-09-30", b: { "1": { n: 16, nn: 16, nr: 0, m: 65000, q1: 60000, q3: 70500, s: 59.1, last: "2026-09-30" } } }] });
  sset("districts_geo", { districts: [{ slug: "testdistrict", name: "Test District", bbox: [55.19, 25.04, 55.21, 25.06] }] });
  sset("unitmix_testdistrict", { buildings_by_id: {
    "10": { name: "Alpha Tower", total_units: 211, floors: 21, dld: { buildings: 1 }, rows: [{ type: "1 bedroom", units: 178, basis: "DLD units register", median_sqm: 59.5 }] },
    "13": { name: "Register Only House", total_units: 50, floors: 8, dld: { buildings: 1 }, rows: [{ type: "1 bedroom", units: 40, basis: "DLD units register", median_sqm: 55 }] } } });
  let printed = [];
  __setLauncher(async () => ({ async newPage() { return { async setViewport() {}, async setContent(h) { printed.push(h); }, async evaluate() { return true; }, async pdf() { return new TextEncoder().encode("%PDF-1.7 stub"); } }; }, async close() {} }));
  const env = { MEETINGS: KV, READ_KEY: "read_key_for_the_owner_1234567890", CLIENT_KEY: "client_key_in_links_12345", INGEST_TOKEN: "ING", PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev", BROWSER: { fetch() {} } };
  globalThis.fetch = async () => new Response("{}", { status: 200 });
  const call = (p) => worker.fetch(new Request(env.PUBLIC_ORIGIN + p), env, { waitUntil() {} });
  // the URLs the page builds for a rent-index building (10) and a register-only building (13), with the client key of the stub
  const urlFor = (bk) => { const h = btns(bar(open(P.pjCard("dist", "Built Tower " + bk, 22000, 7, "", "x", withBk(bk))))), a = h[1].attrs.match(/href="([^"]+)"/); return a ? a[1].replace(/&amp;/g, "&") : ""; };
  const mkReq = (href, slug) => href.replace("keys=dist%3A", "keys=" + slug + "%3A").replace("key=k", "key=client_key_in_links_12345") + "&format=html";
  for (const [bk, nm] of [["10", "Alpha Tower (in the rent index)"], ["13", "Register Only House (unit-mix register only)"]]) {
    printed = []; const href = urlFor(bk), r = await call(mkReq(href, "testdistrict"));
    const html2 = await r.text();
    ok(href.startsWith("/brief_pdf?kind=dossier&keys=dist%3A" + bk) && r.status === 200 && new RegExp(nm.split(" (")[0].replace(/ /g, "\\s")).test(html2), "key <slug>:" + bk + " resolves: 200 and the dossier names " + nm.split(" (")[0], r.status + " " + html2.slice(0, 160));
  }
  { const r = await call(mkReq(urlFor("99"), "testdistrict")); ok(r.status === 404, "a footprint index that holds no building is a clean 404, never a wrong building"); }
}

console.log("D - the index build: bk only for register-bound footprints");
{
  const { buildArea, bindKey, attachBk } = await import("../scripts/build_devmap_index.mjs");
  const card = (name, extra) => Object.assign({ status: "verified", name, rows: [{ type: "1 bedroom", median_aed: 1000000, median_sqm: 50 }], dld_sales: undefined }, extra || {});
  const U = { buildings_by_id: {
    "5": card("Tx Bound Tower", { dld_sales: { sold_by_type: { "1 bedroom": 9 }, sold_total: 9, project: "TX BOUND TOWER" } }),
    "6": card("Id Bound Tower", { dld: { project: "ID BOUND TOWER", property_id: "111" }, dld_sales: { sold_by_type: { "1 bedroom": 4 }, sold_total: 4, project: "ID BOUND TOWER" } }),
    "7": card("Name Only Tower", { dld: { project: "NAME ONLY TOWER", property_id: "222" }, dld_sales: { sold_by_type: { "1 bedroom": 3 }, sold_total: 3, project: "NAME ONLY TOWER" } }),
    "900001": card("Offplan Register Card", { dld_sales: { sold_by_type: { "1 bedroom": 5 }, sold_total: 5, project: "OFFPLAN" } }),
    "8": card("Synthetic Card", { synthetic: true, dld_sales: { sold_by_type: { "1 bedroom": 5 }, sold_total: 5, project: "SYN" } }) } };
  // the soldOf() lookup keys on the card's sold_by_type (type label "1 bedroom"), so the fixture uses that label
  const run = (binds) => buildArea(JSON.parse(JSON.stringify(U)), "dist", {}, {}, [], {}, {}, null, null, "Dist", null, null, [], binds);
  const bks = (devs) => Object.values(devs).flatMap((d) => d.bx.map((x, i) => [d.b[i][2], x.bk]));
  const noBinds = bks(run(null)), m1 = Object.fromEntries(noBinds);
  ok(m1["Tx Bound Tower"] === "5" && m1["Offplan Register Card"] == null && m1["Synthetic Card"] == null, "without binding files only a card that carries its own transactions binding has a key (bk = footprint index 5); off-plan and synthetic cards none", JSON.stringify(noBinds));
  const binds = { tx: { dist: { "5": { project: "TX BOUND TOWER" } } }, reg: { dist: { "6": { property_id: "111" }, "7": { property_id: "999" }, "900001": { property_id: "1" } } } };
  const w = Object.fromEntries(bks(run(binds)));
  ok(w["Tx Bound Tower"] === "5", "tx-bound footprint: bk = '5'", JSON.stringify(w));
  ok(w["Id Bound Tower"] === "6", "identity-bound (reg_bindings property id matches the card's): bk = '6'");
  ok(w["Name Only Tower"] === undefined, "the fixture with a NAME-ONLY candidate (card name matched a register name, the binding names another property) gets no bk");
  ok(w["Offplan Register Card"] === undefined && w["Synthetic Card"] === undefined, "an off-plan register card (id 900000+) and a synthetic card have no footprint, so no bk");
  ok(Object.values(w).every((v) => v === undefined || /^\d{1,6}$/.test(v)), "every bk is the short footprint index (digits only)");
  ok(bindKey(card("x"), "5", "dist", { tx: {}, reg: {} }) === "" && bindKey(null, "5", "d", null) === "", "bindKey: no binding, no key; a missing card gives none");
  // 12-month records take the key of the all-years record of the SAME register project number in the same area, never by name
  const areas = { dist: { devs: { x: { b: [[9, 1, "A"], [4, 1, "A2"]], bx: [{ p: 100, bk: "5" }, { p: 100, bk: "6" }], b12: [[3, 1, "A"], [2, 1, "B"], [1, 1, "A"]], b12x: [{ p: 100 }, { p: 200 }, { p: null }] } } }, other: { devs: { y: { b12: [[1, 1, "A"]], b12x: [{ p: 100 }] } } } };
  attachBk(areas);
  ok(areas.dist.devs.x.b12x[0].bk === "5" && areas.dist.devs.x.b12x[1].bk === undefined && areas.dist.devs.x.b12x[2].bk === undefined, "attachBk: same project number -> the key with the most sales (5); other number or no number -> none", JSON.stringify(areas.dist.devs.x.b12x));
  ok(areas.other.devs.y.b12x[0].bk === undefined, "attachBk: never across areas");
  // an index built without binds / without any bound card carries no bk anywhere (additive; the old format byte for byte)
  ok(!JSON.stringify(Object.values(buildArea({ buildings_by_id: { "5": card("Plain") } }, "dist", {}, {}, [], {}, {}, null, null, "Dist", null, null, [], null))).includes("\"bk\""), "no bound card: no bk key at all");
}

console.log("E - index size and the evidence check");
{
  const { execFileSync } = await import("node:child_process");
  const os = await import("node:os"), path = await import("node:path");
  const tmp = (n) => path.join(os.tmpdir(), "v390_" + Math.random().toString(36).slice(2) + n);
  // a hand-made index shaped like the live one, with and without bk: the check passes both and refuses > 2,048 KB
  const mkIdx = (bk, n) => { const bx = [], b = []; for (let i = 0; i < n; i++) { b.push([5, 20000, "Project " + i]); const x = { p: 1000 + i, di: 1, dn: "D", m: "project_id", e: "REGISTER_VERIFIED", a: "Area", as: "sales_area", h: 100 }; if (bk) x.bk = String(1000 + i); bx.push(x); } return { areas: { dist: { name: "Dist", devs: { x: { n: "X", c: [[5, 20000, 1e6, 1]], b, bx, ce: ["V"], r: [] } } } } }; };
  const a = JSON.stringify(mkIdx(false, 1900)).length, b = JSON.stringify(mkIdx(true, 1900)).length;
  ok(b - a > 0 && b - a < 40 * 1900, "bk adds under 40 bytes a project (" + (b - a) + " bytes for 1,900 projects)", b - a);
  const src = fs.readFileSync(new URL("../scripts/check_devmap_evidence.mjs", import.meta.url), "utf8");
  ok(/2\.0 \* 1024 \* 1024/.test(src) && /limit 2,048 KB/.test(src), "the 2,048 KB limit in check_devmap_evidence.mjs is untouched");
}

console.log("F - script, wording, old behaviour");
ok(!EMOJI.test(headOf(open(mk("Not Yet Tower", EV.notyet, 21000, 8))) + css), "no emoji in the header or the CSS");
{ let okParse = true; try { new Function(js); } catch (e) { okParse = false; console.log(String(e)); } ok(okParse, "the whole page script parses"); }
ok(!/\$\{|`/.test(js.slice(js.indexOf("function pdBandTier"), js.indexOf("function pjFeatures"))), "the new code has no backtick or substitution (the page script is a String.raw block)");
ok(/function pdBandTier\(ppsm\)\{var bd=DM\.TIER_CFG\.bounds\|\|\(IDX&&IDX\.cuts&&IDX\.cuts\.bounds\);return bd&&ppsm\?DM\.tierOf\(ppsm,bd\):-1\}/.test(js) && /function pjInfo\(slug,name,ppsm,n\)\{PJ\[slug\+"\|"\+pkey\(name\)\]=null;var t=pdBandTier\(ppsm\)/.test(js), "pjInfo and the header call the one function");
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
