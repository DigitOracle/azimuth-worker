// v397a - PROJECTS DROPPED BY A RULE stay visible in the Not-confirmed group. Offline: the built shard, hand-worked fixtures, a stubbed browser; no network, no KV, no deploy.
//   node test/test_v397a_dropped.mjs
import fs from "node:fs";
import { devmapHtml } from "../src/devmap_page.js";
import { DM, buildArea } from "../scripts/build_devmap_index.mjs";
import { PHOSPHOR_LIGHT } from "../src/devmap_icons.js";
import { NOTCONF_JS } from "../src/notconf_page.js";
import { cleanNotconf } from "../src/notconf.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };
const EMOJI = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const FILE = JSON.parse(fs.readFileSync(new URL("../data/notconf/notconf.json", import.meta.url), "utf8"));
const all = []; for (const k of Object.keys(FILE.d)) for (const s of Object.keys(FILE.d[k])) for (const e of FILE.d[k][s]) all.push({ k, s, e });
const find = (p) => all.find((x) => x.e.p === p);

console.log("A - the built shard: the dropped fixtures");
{
  const fx = [[22, "Tamani Arts Offices", "_", "businessbay", "non_residential_sales"], [1870, "Address Harbour Point", "emaar", "alkhairanfirst", "other_name"], [24, "Diamond Business Center", "diamond-developers", "arjan", "non_residential_sales"],
    [46, "Burlington Tower", "deyaar", "businessbay", "non_residential_sales"], [829, "Sondos Sage", "_", "wadialsafa5", "same_name"], [1644, "Oceana Hotel And Apartments", "_", "palmjumeirah", "other_name"],
    [615, "Schon Business Park", "_", "dubaiinvestmentparkfirst", "non_residential_sales"], [127, "Iris Bay", "_", "businessbay", "non_residential_sales"]];
  for (const [p, n, k, s, r] of fx) {
    const x = find(p);
    ok(x && x.e.n === n && x.k === k && x.s === s && x.e.r === r, n + " (project " + p + ") is under " + k + " / " + s + " as " + r, JSON.stringify(x));
    const want = p === 1870 ? "NAME_ONLY" : "REGISTER_VERIFIED";
    ok(x && x.e.e === want && x.e.de && (want === "NAME_ONLY" ? x.e.br : !x.e.br), n + ": label " + want + " (the register's developer " + (want === "NAME_ONLY" ? "differs from the brand named" : "agrees") + ") and the registered company shown", JSON.stringify(x && x.e));
  }
  ok(all.every((x) => !("sales" in x.e) && !("ppsm" in x.e) && !("n" in x.e && typeof x.e.n !== "string")), "no entry carries a sales or price field");
  ok(all.every((x) => x.e.e === "REGISTER_VERIFIED" || x.e.e === "NAME_ONLY") && all.some((x) => x.e.e === "NAME_ONLY") && all.every((x) => x.e.e !== "REGISTER_VERIFIED" || !x.e.br), "labels are REGISTER_VERIFIED (register agrees) or NAME_ONLY (differs or unknown); a verified entry names no other brand");
  ok(all.length === FILE.meta.count && all.length >= 99, "the file holds " + all.length + " entries and says so");
  ok(fs.statSync(new URL("../data/notconf/notconf.json", import.meta.url)).size < 300 * 1024, "under 300 KB (a shard, the index is untouched)");
  ok(!EMOJI.test(JSON.stringify(FILE)), "no emoji in the data");
}

console.log("B - the index builder: numbers unchanged, dropped cards collected");
{
  const card = (name, rows, sold) => ({ status: "verified", name, rows, dld_sales: { project: name.toUpperCase(), sold_by_type: sold, sold_total: Object.values(sold).reduce((a, b) => a + b, 0) }, total_units: 100 });
  const U = { buildings_by_id: {
    1: card("Test Flats", [{ type: "1 bedroom", median_aed: 1e6, median_sqm: 70 }], { "1 bedroom": 5 }),
    2: card("Test Offices", [{ type: "Office", median_aed: 4e5, median_sqm: 30 }], { Office: 9 }) } };
  const run = (dropped) => buildArea(JSON.parse(JSON.stringify(U)), "businessbay", {}, {}, [], {}, {}, null, null, "Business Bay", null, null, [], null, dropped);
  const a = run(null), dr = [], b = run(dr);
  ok(JSON.stringify(a) === JSON.stringify(b), "collecting dropped cards changes nothing in the built area (totals, price bands, scale)");
  ok(dr.some((x) => x.name === "Test Offices" && x.reason === "non_residential_sales") && !dr.some((x) => x.name === "Test Flats" && x.reason), "the office card is collected with its reason; the flat card is not dropped");
  const b0 = fs.readFileSync(new URL("../src/devmap_core.js", import.meta.url), "utf8");
  ok(!/NOTCONF|notconf/i.test(b0), "the numbers (core) never read the shard");
}

console.log("C - the server: clean");
{
  const c = cleanNotconf(FILE);
  ok(c && c.meta.count === all.length, "cleanNotconf keeps a valid file whole");
  ok(cleanNotconf(null) === null && cleanNotconf({}) === null && cleanNotconf({ d: { x: { y: [{ n: "A", e: "NAME_ONLY", r: "made_up" }] } } }) === null && cleanNotconf({ d: { x: { y: [{ n: "", e: "NAME_ONLY", r: "no_size" }] } } }) === null, "absent or malformed = null (the page is v395)");
}

console.log("D - the page");
{
  const html = devmapHtml("k", { NAJ_NAV_CSS: "", NAJ_FONTS: "", najNav: () => "" });
  const js = html.slice(html.indexOf("<script>", html.indexOf("maplibre-gl.js")) + 8, html.lastIndexOf("</script>"));
  const cut = (a, b) => js.slice(js.indexOf(a), js.indexOf(b));
  let parses = true; try { new Function(js); } catch (e) { parses = false; console.log(String(e)); } ok(parses, "the whole page script parses");
  ok(!EMOJI.test(NOTCONF_JS) && !EMOJI.test(fs.readFileSync(new URL("../src/notconf.js", import.meta.url), "utf8")), "no emoji in the new code");
  ok(!/\$\{|`/.test(NOTCONF_JS), "the new module has no backtick or substitution (String.raw)");
  ok(/api\("notconf"\)\.catch/.test(js) && /typeof NOTCONF!=="undefined"\?NOTCONF\.items/.test(js) && /NOTCONF\.areaHtml\(slug/.test(js), "the hooks are guarded and present (profile group and area card)");
  const text = (h) => h.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&middot;/g, "-").replace(/\s+/g, " ").trim();
  DM.TIER_CFG.bounds = [30000, 20000, 12000];
  const IDX = { as_of: "2026-09-09", cuts: { bounds: [30000, 20000, 12000] }, devs: { emaar: { name: "Emaar", areas: 1, n: 40, profile: { projects: 2, homes: 0 } } }, areas: { alkhairanfirst: { name: "Dubai Creek Harbour", devs: {} }, businessbay: { name: "Business Bay", devs: {} } } };
  const s0 = cut("function esc(t)", "function api("), s1 = cut("function fmt(n)", "(function(){var b=new URLSearchParams(location.search).get(\"bounds\")");
  const body = NOTCONF_JS + "var DEFAULT_NAMES={};var $=function(id){return document.getElementById(id)};var KEY=\"k\";var fetch=function(){return new Promise(function(){})};" + s0 + s1
    + cut("function clipName", "function devHead(") + cut("function icoSvg", "function evidenceHtml")
    + cut("var BLK={}", "var PULSE=0") + cut("function showSnap(p,pin)", "function focusProject") + cut("function tipHtml", "function drillHtml")
    + cut("function ncHtml", "// v375 - DELIVERY RECORD card") + cut("function pdfUrl", "function invProjRow")
    + "; return {pdOpen:pdOpen,pjCard:pjCard,PDET:PDET,ncHtml:ncHtml,invIndex:invIndex,NOTCONF:NOTCONF,BLK:BLK,esc:esc,pdWords:pdWords};";
  const mkEl = (id) => ({ id, innerHTML: "", style: {}, className: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, focus() {} });
  const els = {}, doc = { getElementById: (i) => els[i] || null, createElement: () => mkEl(""), body: { appendChild: (e) => { els[e.id] = e; } }, addEventListener: () => {} };
  const S = { evOpen: false, sel: "businessbay", unit: "sqft", win: "all", inv: null, mode: "buy", bud: {}, screen: 1, parea: null };
  const map = { flown: null, getSource: () => null, flyTo(o) { this.flown = o; }, isStyleLoaded: () => false };
  const P = new Function("DM", "IDX", "S", "TC", "document", "renderDetail", "updatePj", "EVI", "innerWidth", "map", "setSheet", body)(DM, IDX, S, ["#c5a56a"], doc, () => {}, () => {}, PHOSPHOR_LIGHT, 1200, map, () => {});
  P.BLK.alkhairanfirst = { state: "ok", feats: [] }; P.BLK.businessbay = { state: "ok", feats: [] };
  const api = { pjCard: P.pjCard, esc: P.esc, words: P.pdWords };
  ok(P.ncHtml("emaar") === "" && P.NOTCONF.areaHtml("businessbay", api) === "", "no data loaded: both groups are empty (v395 page)");
  P.NOTCONF.load(cleanNotconf(FILE));
  const g = P.ncHtml("emaar");
  ok(/<details class="card nconf" id=nconf>/.test(g) && !/<details[^>]*\bopen\b/.test(g), "the brand group is a collapsed Not-confirmed details element");
  ok(/Address Harbour Point/.test(text(g)) && /Register names: THE LAGOONS PHASE ONE/.test(text(g)) && /Matched by name only, not confirmed by the register/.test(text(g)), "Emaar's group holds Address Harbour Point with the NAME_ONLY line and the registered company", text(g).slice(0, 300));
  const ag = P.NOTCONF.areaHtml("businessbay", api);
  ok(/<details class="card nconf nconfarea" id=nconfarea>/.test(ag) && !/<details[^>]*\bopen\b/.test(ag) && /Projects whose developer is not recorded here/.test(text(ag)), "the area card group is collapsed and titled 'Projects whose developer is not recorded here'");
  ok(/Tamani Arts Offices/.test(text(ag)) && /Registered developer per the Land Department register: THE DEVELOPER PROPERTIES/.test(text(ag)) && /Not in the totals: its registered sales are offices, shops or hotel units/.test(text(ag)) && !/Matched by name only/.test(text(ag).slice(text(ag).indexOf("Tamani"), text(ag).indexOf("Tamani") + 200)) && /outside the numbers/.test(text(ag)), "Tamani Arts Offices is in the Business Bay area group with its registered company");
  ok(P.NOTCONF.areaHtml("wadialsafa5", api).includes("Sondos Sage") && P.NOTCONF.areaHtml("nowhere", api) === "", "another area shows its own entries; an area with none shows nothing");
  S.parea = "businessbay"; ok(!/Address Harbour Point/.test(P.ncHtml("emaar")), "an area card selected: the brand group is filtered to that area"); S.parea = null;
  const dk = (h, n) => { const m = h.match(new RegExp("data-pd=\"([^\"]+)\"[^>]*aria-label=\"[^\"]*" + n)); return m && m[1]; };
  const tk = dk(ag, "Tamani");
  ok(tk, "each card is a button that opens Project details");
  P.pdOpen(tk, mkEl("f")); const t = text(els.pjdet.innerHTML);
  ok(/Register project number 22/.test(t) && /Why it is outside the numbers/.test(t) && /Not in the totals: its registered sales are offices, shops or hotel units/.test(t) && /Not counted on this page/.test(t) && /REGISTER_VERIFIED/.test(t), "Tamani panel: register number, reason, 'Not counted', label REGISTER_VERIFIED", t.slice(0, 500));
  ok(!EMOJI.test(g) && !EMOJI.test(ag) && !EMOJI.test(els.pjdet.innerHTML), "no emoji in the rendered groups or panel");
}
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
