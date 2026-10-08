// v416 - KORE by Imtiaz ON THE MAP with its confirmed location: data, map card and panel, search, client sheet, investor report. Offline.
//   node test/test_v416_korepos.mjs
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { devmapHtml } from "../src/devmap_page.js";
import { DM } from "../scripts/build_devmap_index.mjs";
import { PHOSPHOR_LIGHT } from "../src/devmap_icons.js";
import { DEVSAYS_JS, devsaysApi, claimsFor, positionOf, locationLine } from "../src/dev_claims.js";
import { generate } from "../scripts/gen_dev_claims_js.mjs";
import { buildDocument, parseQuery } from "../src/brief_docs.js";
import { buildPlan, EMOJI_RX } from "../src/investor_tiers.js";
import { buildTiersHtml } from "../src/investor_tiers_page.js";
import { validateFacts } from "../src/investor_facts.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 500) : "")); } };
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const LIVE = "3217206";   // live v415
const text = (h) => h.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&ndash;/g, "-").replace(/&mdash;/g, "-").replace(/&rsquo;/g, "'").replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&middot;/g, ".").replace(/&#8226;/g, "-").replace(/\s+/g, " ").trim();
const hav = (lo1, la1, lo2, la2) => { const R = 6371008.8, r = Math.PI / 180, dp = (la2 - la1) * r, dl = (lo2 - lo1) * r, a = Math.sin(dp / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dl / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(a)); };
// Open Location Code, full 10-digit code -> cell centre (decoded here independently of the data file)
const olc = (code) => { const A = "23456789CFGHJMPQRVWX", s = code.replace("+", ""); let la = 0, lo = 0, r = 20, last = 20; for (let i = 0; i < 10; i += 2) { la += A.indexOf(s[i]) * r; lo += A.indexOf(s[i + 1]) * r; last = r; r /= 20; } return [lo - 180 + last / 2, la - 90 + last / 2]; };
const PHONE = /04[\s-]?897[\s-]?5222|897[\s-]?5222|\+?9714[\s-]?897|0489 75222/;

console.log("A - the position record and the 10 m check");
const CL = J("data/developer_claims/kore_launch_brochure.json"), L = CL.location;
ok(fs.readFileSync(path.join(ROOT, "src/dev_claims_data.js"), "utf8").replace(/\r\n/g, "\n") === generate(), "src/dev_claims_data.js is exactly what the claims files give");
ok(L && L.plot === "648-8592" && L.parcel === "6488592" && L.area_sqm === 3843.86 && L.district === "wadialsafa5" && L.master === "Dubai Land Residence Complex" && L.plot_centroid[0] === 55.3779511 && L.plot_centroid[1] === 25.088598, "plot 648-8592, parcel 6488592, 3,843.86 m2, plot centre 55.3779511 / 25.088598");
ok(Array.isArray(L.ring) && L.ring.length >= 4 && L.ring[0].join() === L.ring[L.ring.length - 1].join(), "the plot ring is a closed outline", L.ring && L.ring.length);
const dist = hav(L.plot_centroid[0], L.plot_centroid[1], L.corroboration.decoded[0], L.corroboration.decoded[1]);
ok(dist <= 15 && Math.abs(dist - 10) < 1, "the plot centre and the decoded plus code are within 15 m (haversine " + dist.toFixed(1) + " m; recorded as 10 m)");
const dc = olc("7HQQ39QH+F5");
ok(hav(dc[0], dc[1], L.plot_centroid[0], L.plot_centroid[1]) <= 15, "the plus code 7HQQ39QH+F5 decoded by the test itself is within 15 m of the plot centre", dc.join());
ok(/^Google Maps listing for Kore by IMTIAZ, seen 8 October 2026$/.test(L.corroboration.source) && /corroboration only/.test(L.corroboration.note) && L.label === "Plot position, not the building: parcel 648-8592", "the Google Maps listing is cited as corroboration only, with the honest plot label");
ok(!PHONE.test(JSON.stringify(CL)), "the claims file carries no telephone number from the listing");
ok(positionOf(claimsFor("kore")) === L || JSON.stringify(positionOf(claimsFor("kore"))) === JSON.stringify(L), "positionOf() reads the record");
{ const o = JSON.parse(JSON.stringify(claimsFor("kore"))); o.location.plot_centroid = [10, 10]; ok(positionOf(o) === null, "negative control: a position outside Dubai is refused"); }

console.log("B - the map: card, panel, marker and outline (page script on a fixture)");
const mkHarness = (devmapHtmlFn, djs) => {
  const html = devmapHtmlFn("k", { NAJ_NAV_CSS: "", NAJ_FONTS: "", najNav: () => "" });
  const js = html.slice(html.indexOf("<script>", html.indexOf("maplibre-gl.js")) + 8, html.lastIndexOf("</script>"));
  const cut = (a, b) => js.slice(js.indexOf(a), js.indexOf(b));
  DM.TIER_CFG.bounds = [30000, 20000, 12000];
  const IDX = { as_of: "2026-09-09", cuts: { bounds: [30000, 20000, 12000] }, devs: { x: { name: "X", areas: 1, n: 40, profile: { projects: 5, homes: 0 } } }, areas: {
    dist: { name: "Fixture District", devs: { x: { n: "X", h: 0, c: [[40, 21000, 1e6, 1]], b: [[10, 35000, "Tower One"], [7, 22000, "Built Tower"]], r: [] },
      imtiaz: { n: "Imtiaz", h: 0, c: [[30, 15000, 1e6, 1]], b: [[12, 15000, "The Archive"]], r: [] } } },
    lone: { name: "Lone District", devs: { y: { n: "Y", h: 0, c: [[5, 9000, 1e6, 1]], b: [[5, 9000, "Y Court"]], r: [] } } } } };
  const s0 = cut("function esc(t)", "function api("), s1 = cut("function fmt(n)", "(function(){var b=new URLSearchParams(location.search).get(\"bounds\")");
  const body = "var $=function(id){return document.getElementById(id)};var KEY=\"k\";var fetch=function(){return new Promise(function(){})};var ANNOUNCED={detail:function(d){return '<div class=pdet><div class=pdhead>announced stub</div></div>'}};" + djs + s0 + s1
    + cut("function clipName", "function devHead(") + cut("function icoSvg", "function evidenceHtml")
    + cut("var BLK={}", "var PULSE=0") + cut("function showSnap(p,pin)", "function focusProject") + cut("function tipHtml", "function drillHtml")
    + cut("function pdfUrl", "function pdfRowProf")
    + "; return {docRow:docRow,PDET:PDET,pjCard:pjCard,pjDetailHtml:pjDetailHtml,invIndex:invIndex,BLK:BLK" + ",DEVSAYS:DEVSAYS" + "};";
  const mkEl = (id) => ({ id, innerHTML: "", style: {}, className: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, focus() {} });
  const els = {};
  const doc = { getElementById: (i) => els[i] || null, createElement: () => mkEl(""), body: { appendChild: (e) => { els[e.id] = e; } }, addEventListener: () => {} };
  const S = { evOpen: false, sel: "dist", unit: "sqft", win: "all", inv: null, mode: "buy", bud: {}, screen: 1 };
  const P = new Function("DM", "IDX", "S", "TC", "document", "renderDetail", "updatePj", "EVI", "innerWidth", body)(DM, IDX, S, ["#c5a56a", "#2f8a7f", "#3987e5", "#8a9a96"], doc, () => {}, () => {}, PHOSPHOR_LIGHT, 375);
  P.BLK.dist = { state: "ok", feats: [] };
  P.DEVSAYS.load(devsaysApi());
  S.inv = [{ id: "INV-BUILT", name: "Built Tower", brand: "Built Tower", pn: 777 }, { id: "kore-by-imtiaz-offregister", name: "KORE by Imtiaz", brand: "KORE by Imtiaz", pn: 0 }]; P.invIndex();
  return P;
};
const EV = {
  kore: { p: null, e: "DEVELOPER_CLAIMED", dn: "Imtiaz", br: "Imtiaz", a: "Dubai Land Residence Complex", as: "register_master", ns: 1, off: 1 },
  built: { p: 777, di: 1, dn: "FIXTURE DEVELOPMENT L.L.C", m: "project_id", e: "REGISTER_VERIFIED", a: "Fixture District", h: 55, st: "ACTIVE", pc: 62, pe: "2027-03", bk: "77" },
  bare: { p: 5, di: 1, dn: "FIXTURE DEVELOPMENT L.L.C", m: "exact_name", e: "REGISTER_VERIFIED", a: "Fixture District", st: "NOT_STARTED", pl: 0 },
  nothing: { p: 9, e: "REGISTER_VERIFIED", a: "Fixture District", ns: 1 },
  other: { p: null, e: "DEVELOPER_CLAIMED", dn: "Someone", br: "Someone", a: "Fixture District", ns: 1, off: 1 },
  stated: { p: 11, e: "REGISTER_VERIFIED", a: "Fixture District", st: "ACTIVE" },
  ann: { an: 1, ann: { n: "Announced Tower", dn: "Imtiaz", a: "Fixture District" }, dk: "imtiaz", dsl: "dist", e: "DEVELOPER_CLAIMED" }
};
const P = mkHarness(devmapHtml, DEVSAYS_JS);
const card = (Pn, name, ev, ppsm, n) => Pn.pjCard("dist", name, ppsm, n, "", "Project name not recorded", ev);
const dkOf = (h) => (h.match(/data-pd="([^"]+)"/) || [])[1];
const panelOf = (Pn, h) => Pn.pjDetailHtml(dkOf(h), false);
const koreCard = card(P, "KORE by Imtiaz", EV.kore, null, null), korePanel = panelOf(P, koreCard), kt = text(korePanel);
ok(/class="pjc noloc plot"/.test(koreCard) && /Show on the map/.test(koreCard) && /aria-label="Show the plot of KORE by Imtiaz on the map, not the building"/.test(koreCard), "the KORE card says 'Show on the map' (a plot, not the building)", koreCard.slice(0, 200));
ok(/Plot position \(parcel 648-8592\); the building outline is not on our map yet\./.test(kt) && !/No building outline of this name is on our map yet\./.test(kt), "the 'no outline' line is replaced for KORE by 'Plot position (parcel 648-8592); the building outline is not on our map yet.'", kt.slice(0, 400));
ok(/Wadi Al Safa 5, Dubai Land Residence Complex/.test(kt), "panel line: Wadi Al Safa 5, Dubai Land Residence Complex");
ok(/Plot 648-8592, 3,843\.86 m2 \(Dubai Municipality plot outline\)/.test(kt), "panel line: Plot 648-8592, 3,843.86 m2 (Dubai Municipality plot outline)");
ok(/Plot position, not the building/.test(kt), "panel line: Plot position, not the building");
ok(/Also seen on Google Maps: pin about 10 m from the plot centre/.test(kt) && /Google Maps listing for Kore by IMTIAZ, seen 8 October 2026/.test(kt) && /corroboration only/.test(kt), "panel line: Also seen on Google Maps: pin about 10 m from the plot centre (cited, corroboration only)");
ok(korePanel.indexOf("Area and position") > 0 && korePanel.indexOf("Plot 648-8592") > korePanel.indexOf("Area and position") && korePanel.indexOf("Also seen on Google Maps") > korePanel.indexOf("Area and position") && korePanel.indexOf("Area and position") > korePanel.indexOf("Sales"), "the lines sit in the 'Area and position' accordion section");
ok(!/Cove/.test(kt) && L.neighbours.length === 0, "no neighbouring Imtiaz project is shown: their positions are not in our data");
ok(!PHONE.test(korePanel + koreCard), "no listing telephone number in the card or panel");
{
  // marker and outline on a stand-in map
  const calls = { src: [], layers: [], fly: [], data: [] };
  const map = { _s: null, isStyleLoaded: () => true, getSource() { return this._s; }, addSource(id, o) { calls.src.push(id); const self = this; this._s = { setData(d) { calls.data.push(d); } }; calls.data.push(o.data); }, addLayer(l) { calls.layers.push(l); }, flyTo(o) { calls.fly.push(o); } };
  const opened = P.DEVSAYS.open({ map, d: { name: "KORE by Imtiaz", ev: EV.kore }, el: { offsetHeight: 300 }, wide: 1200, collapse() {} });
  const last = calls.data[calls.data.length - 1], f = last.features;
  ok(opened === true && calls.fly.length === 1 && calls.fly[0].center[0] === 55.3779511 && calls.fly[0].center[1] === 25.088598, "'Show on the map' flies to the plot centre");
  ok(f.some((x) => x.properties.k === "pt" && x.geometry.coordinates.join() === "55.3779511,25.088598" && x.properties.label === "Plot position, not the building"), "a small marker is drawn at the plot centre, labelled 'Plot position, not the building'");
  ok(f.some((x) => x.properties.k === "ln" && x.geometry.type === "LineString" && x.geometry.coordinates.length === L.ring.length) && f.some((x) => x.properties.k === "ol" && x.properties.label === "plot outline, not the building"), "the plot outline is drawn as a line and labelled 'plot outline, not the building'");
  map.addLayers = null; const m2 = { _s: null, getSource() { return this._s; }, addSource() { this._s = { setData() {} }; }, addLayer(l) { calls.layers.push(l); } };
  P.DEVSAYS.addLayers(m2, ["Noto Sans Regular"]);
  const ln = calls.layers.find((l) => l.id === "ds-line");
  ok(ln && ln.type === "line" && ln.paint["line-width"] <= 1.5 && Array.isArray(ln.paint["line-dasharray"]) && !calls.layers.some((l) => l.type === "fill"), "the outline is a thin dashed line and nothing is filled", JSON.stringify(ln));
  const no = P.DEVSAYS.open({ map, d: { name: "Other Launch", ev: EV.other }, el: {}, wide: 1200 });
  ok(no === false && calls.data[calls.data.length - 1].features.length === 0, "opening another project clears the KORE marker and outline");
}

console.log("B2 - no other project's card or panel changes (byte-identical to the live v415 page)");
{
  const tmp = path.join(ROOT, "src", "_v416_old_devmap_page.mjs"), tmpc = path.join(ROOT, "src", "_v416_old_dev_claims.mjs");
  try {
    fs.writeFileSync(tmp, execFileSync("git", ["-C", ROOT, "show", LIVE + ":src/devmap_page.js"], { maxBuffer: 1 << 26 }).toString("utf8"));
    fs.writeFileSync(tmpc, execFileSync("git", ["-C", ROOT, "show", LIVE + ":src/dev_claims.js"], { maxBuffer: 1 << 26 }).toString("utf8"));
    const { devmapHtml: oldHtml } = await import("../src/_v416_old_devmap_page.mjs");
    const { DEVSAYS_JS: oldDJS } = await import("../src/_v416_old_dev_claims.mjs");
    const PO = mkHarness(oldHtml, oldDJS);
    for (const [k, ev, pp, n, lab] of [["Built Tower", EV.built, 22000, 7, "register-verified"], ["Bare Tower", EV.bare, 20000, 6, "register-verified, not started"], ["Some Tower", EV.nothing, null, null, "register-verified, nothing known"], ["Active Tower", EV.stated, null, null, "register-verified, status"],
      ["Other Launch", EV.other, null, null, "developer-says, another developer"], ["Announced Tower", EV.ann, null, null, "announced"], [null, null, 18000, 4, "no name"]]) {
      const a = card(P, k, ev, pp, n), b = card(PO, k, ev, pp, n);
      ok(a === b, "card byte-identical to live: " + lab);
      ok(panelOf(P, a) === panelOf(PO, b), "panel byte-identical to live: " + lab);
    }
    const a = panelOf(P, koreCard), b = panelOf(PO, card(PO, "KORE by Imtiaz", EV.kore, null, null));
    ok(a !== b && a.replace(/<div class=pdr>[\s\S]*?<\/div><\/div>/g, "").length > 0, "negative control: the KORE panel IS different from the live one (so the comparison can fail)");
  } finally { try { fs.unlinkSync(tmp); } catch (e) {} try { fs.unlinkSync(tmpc); } catch (e) {} }
}

console.log("C - search: the KORE entry carries the plot position");
{
  const S = J("data/search_extra/search_extra.json"), k = S.features.find((f) => f.properties.plot === "648-8592");
  ok(k && k.properties.name === "KORE by Imtiaz" && k.properties.pos === "plot" && k.properties.pos_label === "Plot position, not the building: parcel 648-8592" && k.geometry.coordinates.join() === "55.3779511,25.088598", "img_search_extra: KORE feature at the plot centre, labelled as a plot position", JSON.stringify(k));
  ok(hav(k.geometry.coordinates[0], k.geometry.coordinates[1], L.corroboration.decoded[0], L.corroboration.decoded[1]) <= 15, "the searched position is within 15 m of the decoded listing code");
  ok(S.features.length === 10 && S.features.filter((f) => f.properties.pos).length === 1, "no other search feature changed (10 features, one with a position label)");
  const py = fs.readFileSync(path.join(ROOT, "scripts/build_search_extra.py"), "utf8");
  ok(/def kore_position\(feats\)/.test(py) && /kore_position\(v392_features\(a, ns, pp, plots\)\)/.test(py), "the builder sets the position (scripts/build_search_extra.py: kore_position)");
}

console.log("D - the client sheet: Location line and developer-says travel times, no map picture");
const FK = J("test/fixtures/v416_kore_facts.json");
const mkEnv = () => { const store = { investor_tiers_index: { projects: [{ id: "kore-by-imtiaz-offregister", name: "KORE by Imtiaz", district: "wadialsafa5", project_number: null }] }, investor_tiers_facts_wadialsafa5: { projects: { "kore-by-imtiaz-offregister": FK } } };
  return { MEETINGS: { async get(k) { if (k.startsWith("img_") && store[k.slice(4)] !== undefined) return JSON.stringify(store[k.slice(4)]); return null; } } }; };
const doc = await buildDocument(mkEnv(), parseQuery(new URL("https://x/brief_pdf?kind=dossier&keys=dev:kore&mode=buy&beds=all&format=html")), { origin: "https://w.example" });
const H = doc.html || "", T = text(H);
const LOC = "Location: Dubai Land Residence Complex, Wadi Al Safa 5; plot 648-8592 (3,843.86 m2). The position is the plot, not the building. Corroborated by the developer's listing on Google Maps.";
ok(doc.status === 200 && doc.pages === 2, "the sheet is built (two pages)");
ok(T.includes(LOC), "the sheet carries the Location line", T.slice(0, 300));
ok(locationLine(L) === LOC, "one wording: locationLine() gives exactly the line");
ok(T.includes("Travel times (developer says; mode not stated)") && /not walking times/.test(T), "the travel-times heading, with 'not walking times'");
ok(CL.drive_times.rows.every((r) => T.includes(r.to + " - " + r.min + " min")) && CL.drive_times.rows.length === 15, "all fifteen developer-says travel times are printed as transcribed");
ok(!/<img /.test(H.replace(/<img class="najhead"[^>]*>/g, "")) && !/satellite|mapbox|maps\.googleapis|staticmap/i.test(H), "no map picture and no satellite imagery on the sheet");
ok(!PHONE.test(H) && !/0489|4 897/.test(T), "the sheet prints no telephone number from the listing");
ok(!EMOJI_RX.test(T), "no emoji on the sheet");

console.log("E - the investor report: Location line; the rebuilt facts record");
{
  const plan = (f) => buildPlan({ facts: f, type: "prime", tier: "standard", segments: ["market_history", "unit_mix_prices", "amenities"] });
  ok(validateFacts(FK).length === 0, "the rebuilt KORE record passes the schema validator", validateFacts(FK).join(" | "));
  const h = buildTiersHtml(FK, plan(FK), {}), t = text(h.html || h.text || String(h));
  ok(t.includes(LOC), "the investor report carries the Location line");
  ok(!PHONE.test(JSON.stringify(FK)) && !PHONE.test(t), "no listing telephone number in the facts or the report");
  ok(!EMOJI_RX.test(t) && !EMOJI_RX.test(JSON.stringify(FK)), "no emoji");
  const bad = (mut, re, label) => { const f = JSON.parse(JSON.stringify(FK)); mut(f); const e = validateFacts(f); ok(e.some((x) => re.test(x)), label, e.join(" | ")); };
  bad((f) => { f.location.plot_centre = [10, 10]; }, /inside Dubai/, "negative control: a position outside Dubai is refused");
  bad((f) => { f.location.text = "Location: the building is at this point."; }, /plot, not the building/, "negative control: a location that does not say 'plot, not the building' is refused");
  bad((f) => { f.location.corroboration.note = "call 04 897 5222"; }, /telephone/, "negative control: a telephone number is refused");
  const tmp = path.join(ROOT, "src", "_v416_old_tiers_page.mjs");
  try {
    fs.writeFileSync(tmp, execFileSync("git", ["-C", ROOT, "show", LIVE + ":src/investor_tiers_page.js"], { maxBuffer: 1 << 26 }).toString("utf8"));
    const { buildTiersHtml: oldB } = await import("../src/_v416_old_tiers_page.mjs");
    const REGS = J("test/fixtures/v411_registered_samples.json"), ANN = J("test/fixtures/v411_announced_sample.json"), OLDK = J("test/fixtures/v411_kore_facts.json");
    const same = (f, lab) => { const a = buildTiersHtml(f, plan(f), {}), b = oldB(f, plan(f), {}); ok((a.html || a) === (b.html || b), "investor report byte-identical to live: " + lab); };
    Object.values(REGS.records).slice(0, 3).forEach((f, i) => same(f, "register-verified sample " + (i + 1)));
    same(ANN, "announced sample"); same(OLDK, "KORE record without a location (older facts)");
  } finally { try { fs.unlinkSync(tmp); } catch (e) {} }
}

console.log("F - emoji and wording across everything new");
{
  const all = [kt, T, JSON.stringify(L), fs.readFileSync(path.join(ROOT, "src/dev_claims.js"), "utf8"), fs.readFileSync(path.join(ROOT, "scripts/build_search_extra.py"), "utf8")].join("\n");
  ok(!EMOJI_RX.test(all) && !/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(all), "no emoji in the new text");
  ok(!/digital twin|maquette/i.test(kt + T), "brand wording: no 'digital twin' or 'Maquette'");
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
