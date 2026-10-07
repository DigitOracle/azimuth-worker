// v392 - PROJECTS WITH NO REGISTERED SALES YET on the developer page, and the Najma map search. Offline: the built data file, hand-worked fixtures, a stubbed store and browser; no network, no KV, no deploy.
//   node test/test_v392_nosales.mjs
import fs from "node:fs";
import { devmapHtml } from "../src/devmap_page.js";
import { DM } from "../scripts/build_devmap_index.mjs";
import { PHOSPHOR_LIGHT } from "../src/devmap_icons.js";
import { NOSALES_JS } from "../src/nosales_page.js";
import { PLOTPOS_JS } from "../src/plotpos_page.js";
import { cleanNosales, addNosalesPlots, mergePlots } from "../src/nosales.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };
const EMOJI = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const FILE = JSON.parse(fs.readFileSync(new URL("../data/nosales/nosales.json", import.meta.url), "utf8"));
const EXTRA = JSON.parse(fs.readFileSync(new URL("../data/search_extra/search_extra.json", import.meta.url), "utf8"));
const all = []; for (const dev of Object.keys(FILE.d)) for (const ds of Object.keys(FILE.d[dev])) for (const e of FILE.d[dev][ds]) all.push({ dev, ds, e });

console.log("A - the builder's file");
{
  const arch = all.find((x) => x.e.p === 3781);
  ok(arch && arch.dev === "imtiaz" && arch.ds === "wadialsafa5", "The Archive by Imtiaz (project 3781) is under imtiaz / wadialsafa5");
  ok(arch && arch.e.n === "The Archive by Imtiaz" && arch.e.st === "PENDING" && arch.e.u === 310 && /ROSEWELL PARK/.test(arch.e.de), "its register facts: PENDING, 310 units, the registered company (Rosewell Park) kept");
  ok(arch && arch.e.e === "NAME_ONLY" && arch.e.br === "Imtiaz", "filed under the brand by its project name: labelled NAME_ONLY, brand Imtiaz");
  const kore = all.find((x) => x.e.off);
  ok(kore && kore.dev === "imtiaz" && kore.ds === "wadialsafa5" && kore.e.e === "DEVELOPER_CLAIMED" && kore.e.p === null && kore.e.u === 351, "KORE by Imtiaz is an explicit entry under imtiaz / wadialsafa5: DEVELOPER_CLAIMED, no project number, 351 units");
  ok(kore.e.a === "Dubai Land Residence Complex" && kore.e.plot === "648-8592" && kore.e.id === "kore-by-imtiaz-offregister" && kore.e.pp && Math.abs(kore.e.pp.lon - 55.37795) < 1e-4, "KORE: Dubai Land Residence Complex, plot 648-8592 with its position, the investor facts id");
  const kn = kore.e.notes.join(" ");
  ok(/not on the project register we hold/i.test(kn) && /dubairealestatedata\.com, unverified/.test(kn) && /UNVERIFIED until a fresh Land Department project register pull/.test(kn) && /351 units, start 15 Nov 2026, 0% complete/.test(kn), "KORE evidence: not on the register we hold; the third-party listing, marked UNVERIFIED");
  ok(/No registered unit sales yet/.test(kn) && /land purchase and its mortgage, not sales of homes/.test(kn) && !/sales after/i.test(kn), "KORE says no registered UNIT sales; the 10 Jul rows are the land purchase and mortgage");
  ok(all.filter((x) => x.e.off).length === 1, "exactly one off-register entry");
  // a project WITH sales is not in the file: Chelsea Residences 2 (project 3719) and the Cove projects that sell
  ok(!all.some((x) => [3719, 3743].includes(x.e.p)) && !all.some((x) => /^cove (living|edition|grand)/i.test(x.e.n)), "projects with registered sales (Chelsea 3719 / 3743, the Cove projects) are not in the file");
  ok(all.every((x) => !("sales" in x.e) && !("ppsm" in x.e) && !("n_sales" in x.e)), "no entry carries a sales or price field");
  ok(all.length === FILE.meta.count && all.length > 700, "the file holds " + all.length + " entries and says so");
  const im = all.filter((x) => x.dev === "imtiaz");
  ok(im.length === 3 && im.every((x) => x.e.e), "three entries under Imtiaz (Palace Estates, KORE, The Archive)");
  const w = FILE.d.imtiaz.wadialsafa5; ok(w[0].off === 1, "sorted: the off-register launch first, then the most recent start date");
  ok(Object.values(FILE.d).every((ds) => Object.values(ds).every((l) => { const sd = l.filter((e) => !e.off).map((e) => e.sd || ""); return sd.every((v, i) => !i || sd[i - 1] >= v); })), "every list is most recent launch first");
  ok(fs.statSync(new URL("../data/nosales/nosales.json", import.meta.url)).size < 250 * 1024, "under 250 KB");
  ok(!EMOJI.test(JSON.stringify(FILE)), "no emoji in the data");
  ok(all.every((x) => x.e.a && x.e.de !== "" || x.e.off), "every register entry has an area and a registered developer");
}

console.log("B - the server: clean, plot injection, search merge");
{
  const c = cleanNosales(FILE);
  ok(c && c.meta.count === all.length, "cleanNosales keeps a valid file whole");
  ok(cleanNosales(null) === null && cleanNosales({}) === null && cleanNosales({ d: { x: { y: [{ n: "", e: "NAME_ONLY" }] } } }) === null && cleanNosales({ d: { x: { y: [{ n: "A", e: "MADE_UP" }] } } }) === null, "absent or malformed = null (the route then answers {})");
  const pp = addNosalesPlots(null, c);
  ok(pp && pp.p.kore && pp.p.kore.evidence === "DERIVED" && pp.p.kore.parcels[0] === "6488592" && /not a building|building outline is not on our map/.test(pp.p.kore.label), "KORE's plot rides in the plot-position answer under its key");
  const base = { meta: { as_of: "x" }, p: { 3000: { lon: 55.2, lat: 25.1, evidence: "DERIVED", label: "L" } } };
  ok(addNosalesPlots(base, null) === base && Object.keys(addNosalesPlots(base, c).p).length === 2 && addNosalesPlots(base, c).p[3000], "an existing position is kept; without the file the answer is untouched");
  const plots = JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [55.3, 25.1] }, properties: { plot: "648-8534", name: "THE ARCHIVE BY IMTIAZ", district: "wadialsafa5" } }] });
  const m = JSON.parse(mergePlots(plots, JSON.stringify(EXTRA)));
  const names = m.features.map((f) => f.properties.name);
  ok(names[0] === "THE ARCHIVE BY IMTIAZ" && names.filter((n) => /archive/i.test(n)).length === 1, "a plot the list already has is never replaced or duplicated; the list keeps its order");
  ok(names.includes("KORE by Imtiaz") && m.features.find((f) => f.properties.name === "KORE by Imtiaz").properties.nb === 1, "KORE by Imtiaz is added, flagged nb (plot position, not a building)");
  ok(mergePlots(plots, null) === null && mergePlots(null, JSON.stringify(EXTRA)) === null && mergePlots(plots, JSON.stringify({ features: [] })) === null, "no extra file, no plots file or nothing new: null (the caller serves img_plots untouched)");
  ok(EXTRA.features.some((f) => f.properties.plot === "648-8592") && EXTRA.features.some((f) => f.properties.plot === "648-8534"), "the extra file holds KORE (648-8592) and The Archive (648-8534)");
  // the map search function, run on the merged list with the real searchAll source
  const idx = fs.readFileSync(new URL("../src/index.js", import.meta.url), "latin1");
  const a = idx.indexOf("function qnorm(t)"), b = idx.indexOf("function goDistrict");
  const src = idx.slice(a, b).split("\n").map((l) => l.replace(/^\s*\+ '/, "").replace(/'$/, "").replace(/\\'/g, "'").replace(/\\\\/g, "\\").replace(/\\u00b7/g, "-")).join("\n");
  const run = new Function("D", "SUBS", "PLOTS", "PR", "VIDS", "AM", "AMEN", "tc", "dName", "goDistrict", "openPlace", "devName", "listHomes", "map", "fmtAed", "openHome", "openVideo", "openAmenity", "ON", "drawAm", src + "; return searchAll;");
  const tc = (t) => String(t || "");
  const searchAll = run({ districts: [] }, { features: [] }, m, [], [], [], {}, tc, (s) => s, () => {}, () => {}, (x) => x, () => {}, {}, (x) => x, () => {}, () => {}, () => {}, {}, () => {});
  const r = searchAll("KORE by Imtiaz");
  ok(r.length >= 1 && r[0].n === "KORE by Imtiaz", "typing 'KORE by Imtiaz' lists KORE first", JSON.stringify(r.map((x) => x.n)));
  ok(r[0].t === "plot position, not a building", "the result is labelled 'plot position, not a building'", r[0].t);
  const r2 = searchAll("the archive");
  ok(r2.length === 1 && /ARCHIVE/i.test(r2[0].n) && /^plot 648-8534$/.test(r2[0].t), "The Archive by Imtiaz is found, with its plot number (it has a building outline on the live list)");
  ok(/p\.nb\?"plot position, not a building":"plot "\+p\.plot/.test(idx) && /nm === "plots"/.test(idx) && /mergePlots\(_pt, _xtra\)/.test(idx), "the worker route merges img_search_extra into /img/plots only for the plots list");
}

console.log("C - the page");
{
  const html = devmapHtml("k", { NAJ_NAV_CSS: "", NAJ_FONTS: "", najNav: () => "" });
  const js = html.slice(html.indexOf("<script>", html.indexOf("maplibre-gl.js")) + 8, html.lastIndexOf("</script>"));
  const cut = (a, b) => js.slice(js.indexOf(a), js.indexOf(b));
  let parses = true; try { new Function(js); } catch (e) { parses = false; console.log(String(e)); } ok(parses, "the whole page script parses");
  ok(!EMOJI.test(NOSALES_JS) && !EMOJI.test(fs.readFileSync(new URL("../src/nosales.js", import.meta.url), "utf8")), "no emoji in the new code");
  ok(!/\$\{|`/.test(NOSALES_JS), "the new module has no backtick or substitution (String.raw)");
  ok(/h\+=ncHtml\(k\);h\+=nsHtml\(k\);/.test(js) && /if\(!p\.areas\)return h\+nsHtml\(k\)\+/.test(js), "the group sits after the area cards and the not-confirmed group; a developer with no priced area gets it too");
  ok(/typeof NOSALES==="undefined"\)return ""/.test(js) && /api\("nosales"\)\.catch/.test(js), "every hook is guarded (absent file = v390)");
  const core = fs.readFileSync(new URL("../src/devmap_core.js", import.meta.url), "utf8");
  ok(!/NOSALES|nosales/i.test(core) && !/NOSALES|nosales/i.test(fs.readFileSync(new URL("../scripts/build_devmap_index.mjs", import.meta.url), "utf8")), "the numbers (core and index builder) never read the file: not in totals, price bands or scale");
  // harness (as test_v390_clientsheet)
  const text = (h) => h.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&middot;/g, "-").replace(/\s+/g, " ").trim();
  DM.TIER_CFG.bounds = [30000, 20000, 12000];
  const IDX = { as_of: "2026-09-09", cuts: { bounds: [30000, 20000, 12000] }, devs: { imtiaz: { name: "Imtiaz", areas: 1, n: 40, profile: { projects: 2, homes: 0 } } }, areas: {
    wadialsafa5: { name: "Dubai Land Residence Complex", comms: [], devs: { imtiaz: { n: "Imtiaz", h: 0, c: [[40, 21000, 1e6, 1]], b: [[10, 21000, "Cove Grand"]], r: [] } } },
    jumeirahvillagecircle: { name: "Jumeirah Village Circle", devs: {} } } };
  const s0 = cut("function esc(t)", "function api("), s1 = cut("function fmt(n)", "(function(){var b=new URLSearchParams(location.search).get(\"bounds\")");
  const body = NOSALES_JS + PLOTPOS_JS + "var $=function(id){return document.getElementById(id)};var KEY=\"k\";var fetch=function(){return new Promise(function(){})};" + s0 + s1
    + cut("function clipName", "function devHead(") + cut("function icoSvg", "function evidenceHtml")
    + cut("var BLK={}", "var PULSE=0") + cut("function showSnap(p,pin)", "function focusProject") + cut("function tipHtml", "function drillHtml")
    + cut("function nsHtml", "// v375 - DELIVERY RECORD card") + cut("function pdfUrl", "function invProjRow")
    + "; return {pdOpen:pdOpen,pjCard:pjCard,PDET:PDET,nsHtml:nsHtml,invIndex:invIndex,NOSALES:NOSALES,PLOTPOS:PLOTPOS,BLK:BLK};";
  const mkEl = (id) => ({ id, innerHTML: "", style: {}, className: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, focus() {} });
  const els = {}, doc = { getElementById: (i) => els[i] || null, createElement: () => mkEl(""), body: { appendChild: (e) => { els[e.id] = e; } }, addEventListener: () => {} };
  const S = { evOpen: false, sel: "wadialsafa5", unit: "sqft", win: "all", inv: null, mode: "buy", bud: {}, screen: 1, parea: null };
  const map = { flown: null, getSource: () => null, flyTo(o) { this.flown = o; }, isStyleLoaded: () => false };
  const P = new Function("DM", "IDX", "S", "TC", "document", "renderDetail", "updatePj", "EVI", "innerWidth", "map", "setSheet", body)(DM, IDX, S, ["#c5a56a"], doc, () => {}, () => {}, PHOSPHOR_LIGHT, 1200, map, () => {});
  P.BLK.wadialsafa5 = { state: "ok", feats: [] }; P.BLK.jumeirahvillagecircle = { state: "ok", feats: [] };
  // the data the page would get: the built file plus a fixture developer in another area
  const fx = JSON.parse(JSON.stringify(FILE));
  fx.d.imtiaz.jumeirahvillagecircle = [{ p: 1742, id: "palace-estates-1742", n: "Palace Estates", st: "FINISHED", pc: 100, pe: "2017-01-26", sd: "2015-05-01", a: "Jumeirah Village Circle", as: "register_master", de: "IMTIAZ REAL ESTATE INVESTMENT & DEVELOPMENT L.L.C", e: "REGISTER_VERIFIED" }];
  ok(P.nsHtml("imtiaz") === "" && P.nsHtml("nobody") === "", "no data loaded: the group is empty (v390 page)");
  P.NOSALES.load(cleanNosales(fx)); P.PLOTPOS.load(addNosalesPlots(null, cleanNosales(fx)));
  const g = P.nsHtml("imtiaz");
  ok(/<details class="card nconf nosales" id=nosales>/.test(g) && !/<details[^>]*\bopen\b/.test(g), "the group is a collapsed details element");
  const nImt = (fx.d.imtiaz.wadialsafa5.length + fx.d.imtiaz.jumeirahvillagecircle.length);
  ok(text(g).startsWith("Registered, no unit sales yet " + nImt + " projects, outside the numbers"), "titled 'Registered, no unit sales yet' with the count", text(g).slice(0, 120));
  ok((g.match(/class="pjc /g) || []).length === nImt, "one card per project of THAT developer (" + nImt + ")");
  ok(/The Archive by Imtiaz/.test(g) && /KORE by Imtiaz/.test(g) && /No registered sales yet/.test(g) && /Pending, planned end 2027-05-16|PENDING, planned end/i.test(text(g)), "cards: names, 'No registered sales yet', status and planned end", text(g));
  ok(/Not on the project register/.test(text(g)) && /No registered unit sales yet/.test(text(g)), "KORE's card says 'Not on the project register' and 'No registered unit sales yet'");
  ok(P.nsHtml("fakhruddin") === "", "another developer sees nothing");
  S.parea = "wadialsafa5"; const g2 = P.nsHtml("imtiaz");
  ok((g2.match(/class="pjc /g) || []).length === 2 && !/Palace Estates/.test(g2) && /1\d* project|2 projects/.test(text(g2)), "an area card selected: the group is filtered to that area (2 of " + nImt + ")");
  S.parea = "jumeirahvillagecircle"; const g3 = P.nsHtml("imtiaz");
  ok((g3.match(/class="pjc /g) || []).length === 1 && /Palace Estates/.test(g3), "another area: only its project");
  S.parea = null;
  // cards open the same detail panel
  const dkOf = (h, n) => { const m = h.match(new RegExp("<button[^>]*data-pd=\"([^\"]+)\"[^>]*aria-label=\"[^\"]*" + n + "[^\"]*\"")); return m && m[1]; };
  const kdk = dkOf(g, "KORE"), adk = dkOf(g, "Archive");
  ok(kdk && adk, "each card is a button that opens Project details");
  const kcard = g.match(/<button[^>]*data-pd="[^"]*"[^>]*KORE[^>]*>[\s\S]*?<\/button>/)[0];
  ok(/class="pjc noloc plot"/.test(kcard) && /Show on the map/.test(kcard), "KORE has its plot position: the card says Show on the map");
  P.pdOpen(kdk, mkEl("f")); const kp = els.pjdet.innerHTML, kt = text(kp);
  ok(/Not on the project register/.test(kt) && !/Register project number/.test(kt), "KORE panel: 'Not on the project register', and no invented project number");
  ok(/Imtiaz/.test(kt) && /Developer says/.test(kt) && /DEVELOPER_CLAIMED/.test(kt), "KORE panel: the developer-says label");
  ok(/No registered unit sales yet/.test(kt) && !/Not recorded/.test(kt.slice(kt.indexOf("Sales"), kt.indexOf("Sales") + 140)), "KORE panel: Sales row says 'No registered unit sales yet'");
  ok(/dubairealestatedata\.com, unverified/.test(kt) && /351 units/.test(kt) && /Plot position/.test(kt) && /648|6488592/.test(kt), "KORE panel: the unverified third-party note, 351 units and the plot position");
  ok(map.flown && Math.abs(map.flown.center[0] - 55.37795) < 1e-3, "opening KORE flies the map to its plot");
  P.pdOpen(adk, mkEl("f")); const at = text(els.pjdet.innerHTML);
  ok(/Register project number 3781/.test(at) && /Pending/.test(at) && /310 units/.test(at) && /ROSEWELL PARK/.test(at) && /Brand Imtiaz/.test(at), "The Archive panel: register facts (3781, Pending, 310 units), the registered company and the brand filed by name", at);
  ok(/No registered sales yet/.test(at) && !/Sales in the window/.test(at.replace("Sales No registered", "")) , "The Archive panel: no sales claimed");
  ok(!EMOJI.test(g) && !EMOJI.test(kp), "no emoji in the rendered group or panel");
}
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
