// v401 - REGISTER-BUILT CARDS for projects with registered sales and no developer-page card. Offline: the built shard, real fixtures from the audit list MISSING_S3.csv, a stubbed browser; no network, no KV, no deploy.
//   node test/test_v401_regcards.mjs
import fs from "node:fs";
import { devmapHtml } from "../src/devmap_page.js";
import { DM } from "../scripts/build_devmap_index.mjs";
import { PHOSPHOR_LIGHT } from "../src/devmap_icons.js";
import { REGCARDS_JS } from "../src/regcards_page.js";
import { cleanRegcards } from "../src/regcards.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };
const EMOJI = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const LABEL = "Built from the Land Department register; no price card yet";
const FILE = JSON.parse(fs.readFileSync(new URL("../data/regcards/regcards.json", import.meta.url), "utf8"));
const all = []; for (const k of Object.keys(FILE.d)) for (const s of Object.keys(FILE.d[k])) for (const e of FILE.d[k][s]) all.push({ k, s, e });
const find = (p) => all.find((x) => x.e.p === p);

console.log("A - the built shard: five fixtures from the audit list MISSING_S3.csv");
{
  const fx = [[3772, "The LX", "_", "albarshaasouththird", true, true], [504, "Jumeirah Business Centre 4", "al-fajer-properties", "althanyahfifth", false, true],
    [485, "Clover Bay", "_", "businessbay", false, true], [4390, "Amali Residences", "_", "alwasl", false, false], [2971, "Barari Parkview by Al Mawared", "almawared-properties", "wadialsafa3", true, false]];
  const miss = new Set(fs.readFileSync("C:/Dev/naj-market-pulse/docs/COMPLETENESS_AUDIT_07OCT2026/MISSING_S3.csv", "utf8").split(/\r?\n/).map((l) => l.split(",")[2]));
  for (const [p, n, k, s, out, range] of fx) {
    const x = find(p);
    ok(x && x.e.n === n && x.k === k && x.s === s, n + " (project " + p + ") is under " + k + " / " + s, JSON.stringify(x));
    ok(miss.has(String(p)), n + " is in the audit list MISSING_S3.csv");
    ok(x && (!!x.e.o) === out, n + (out ? ": flagged as outside the 42 districts" : ": inside the 42 districts"));
    ok(x && (x.e.pmin != null) === range, n + (range ? ": has a price range" : ": has no price range"), JSON.stringify(x && x.e));
  }
  ok(find(2971).e.sc === 1 && find(2971).e.np === 1 && find(2971).e.pmin == null, "one priced sale: the count is shown, no range");
  ok(all.every((x) => x.e.pmin == null || x.e.np >= 5), "a price range exists only where five or more sales carry a price");
  ok(all.every((x) => !("ppsm" in x.e) && !("price" in x.e) && x.e.p > 0 && x.e.n), "no price-per-area field; every entry has a name and a register project number");
  ok(all.every((x) => ["REGISTER_VERIFIED", "NAME_ONLY", "UNVERIFIED"].includes(x.e.e)) && all.filter((x) => x.e.e === "NAME_ONLY").every((x) => x.e.br && x.e.de), "labels come from the register; NAME_ONLY shows brand and registered company");
  ok(all.length === FILE.meta.count && all.length >= 400, "the file holds " + all.length + " entries and says so");
  ok(fs.statSync(new URL("../data/regcards/regcards.json", import.meta.url)).size < 300 * 1024, "under 300 KB");
  ok(!EMOJI.test(JSON.stringify(FILE)), "no emoji in the data");
}

console.log("B - the server: clean");
{
  const c = cleanRegcards(FILE);
  ok(c && c.meta.count === all.length, "cleanRegcards keeps a valid file whole");
  ok(cleanRegcards(null) === null && cleanRegcards({}) === null && cleanRegcards({ d: { x: { y: [{ n: "A", e: "NAME_ONLY" }] } } }) === null && cleanRegcards({ d: { x: { y: [{ n: "A", e: "BAD", p: 5 }] } } }) === null, "absent or malformed = null (the page is v399)");
  const t = cleanRegcards({ d: { x: { y: [{ n: "A", e: "REGISTER_VERIFIED", p: 5, sc: 3, np: 3, pmin: 1, pmax: 9, junk: 1 }] } } }).d.x.y[0];
  ok(t.pmin === undefined && t.junk === undefined && t.sc === 3, "a price range with fewer than five priced sales and unknown fields are dropped");
  const core = fs.readFileSync(new URL("../src/devmap_core.js", import.meta.url), "utf8");
  ok(!/REGCARDS|regcards/i.test(core), "the numbers (core) never read the shard");
}

console.log("C - the page");
{
  const html = devmapHtml("k", { NAJ_NAV_CSS: "", NAJ_FONTS: "", najNav: () => "" });
  const js = html.slice(html.indexOf("<script>", html.indexOf("maplibre-gl.js")) + 8, html.lastIndexOf("</script>"));
  const cut = (a, b) => js.slice(js.indexOf(a), js.indexOf(b));
  let parses = true; try { new Function(js); } catch (e) { parses = false; console.log(String(e)); } ok(parses, "the whole page script parses");
  ok(!EMOJI.test(REGCARDS_JS) && !EMOJI.test(fs.readFileSync(new URL("../src/regcards.js", import.meta.url), "utf8")), "no emoji in the new code");
  ok(!/\$\{|`/.test(REGCARDS_JS), "the new module has no backtick or substitution (String.raw)");
  ok(/api\("regcards"\)\.catch/.test(js) && /REGCARDS\.load\(r\[12\]\)/.test(js) && /REGCARDS\.areaHtml\(slug/.test(js) && /REGCARDS\.otherHtml\(/.test(js) && /rcHtml\(k\)/.test(js), "the hooks are guarded and present (profile group, area card, Other Dubai areas)");
  const text = (h) => h.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&middot;/g, "-").replace(/\s+/g, " ").trim();
  DM.TIER_CFG.bounds = [30000, 20000, 12000];
  const IDX = { as_of: "2026-09-09", cuts: { bounds: [30000, 20000, 12000] }, devs: { "al-fajer-properties": { name: "Al Fajer Properties", areas: 1, n: 40, profile: { projects: 2, homes: 0 } } },
    areas: { althanyahfifth: { name: "Jumeirah Lakes Towers", devs: {} }, businessbay: { name: "Business Bay", devs: {} }, alwasl: { name: "Al Wasl", devs: {} } } };
  const s0 = cut("function esc(t)", "function api("), s1 = cut("function fmt(n)", "(function(){var b=new URLSearchParams(location.search).get(\"bounds\")");
  const body = REGCARDS_JS + "var DEFAULT_NAMES={};var $=function(id){return document.getElementById(id)};var KEY=\"k\";var fetch=function(){return new Promise(function(){})};" + s0 + s1
    + cut("function clipName", "function devHead(") + cut("function icoSvg", "function evidenceHtml")
    + cut("var BLK={}", "var PULSE=0") + cut("function showSnap(p,pin)", "function focusProject") + cut("function tipHtml", "function drillHtml")
    + cut("function ncHtml", "// v375 - DELIVERY RECORD card") + cut("function pdfUrl", "function pdfRowProf")
    + "; return {pdOpen:pdOpen,pjCard:pjCard,PDET:PDET,rcHtml:rcHtml,rcApi:rcApi,invIndex:invIndex,REGCARDS:REGCARDS,BLK:BLK,esc:esc,fetched:function(){return FETCHED}};";
  const mkEl = (id) => ({ id, innerHTML: "", style: {}, className: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, focus() {} });
  const els = {}, doc = { getElementById: (i) => els[i] || null, createElement: () => mkEl(""), body: { appendChild: (e) => { els[e.id] = e; } }, addEventListener: () => {} };
  const S = { evOpen: false, sel: null, unit: "sqft", win: "all", inv: null, mode: "buy", bud: {}, screen: 1, parea: null };
  const map = { flown: null, getSource: () => null, flyTo(o) { this.flown = o; }, isStyleLoaded: () => false };
  const P = new Function("DM", "IDX", "S", "TC", "document", "renderDetail", "updatePj", "EVI", "innerWidth", "map", "setSheet", body)(DM, IDX, S, ["#c5a56a"], doc, () => {}, () => {}, PHOSPHOR_LIGHT, 1200, map, () => {});
  for (const s of ["althanyahfifth", "businessbay", "alwasl"]) P.BLK[s] = { state: "ok", feats: [] };
  const api = P.rcApi();
  ok(P.rcHtml("al-fajer-properties") === "" && P.REGCARDS.areaHtml("businessbay", api) === "" && P.REGCARDS.otherHtml(api) === "", "no data loaded: every group is empty (v399 page)");
  P.REGCARDS.load(cleanRegcards(FILE));
  const g = P.rcHtml("al-fajer-properties");
  ok(/<details class="card nconf regcards" id=regcards>/.test(g) && !/<details[^>]*\bopen\b/.test(g) && /Registered sales, no price card yet/.test(text(g)), "the developer group is a collapsed details element");
  ok(text(g).includes(LABEL) && /Jumeirah Business Centre 4/.test(text(g)) && /Registered developer per the Land Department register: AL FAJER/.test(text(g)) && /413 unit sales registered/.test(text(g)) && /Sale prices AED/.test(text(g)), "the label, the register developer, the sales count and the price range are on the card", text(g).slice(0, 500));
  S.parea = "businessbay"; ok(P.rcHtml("al-fajer-properties") === "", "an area selected: the developer group shows only that area"); S.parea = null;
  const ag = P.REGCARDS.areaHtml("businessbay", api);
  ok(/id=rcarea/.test(ag) && !/<details[^>]*\bopen\b/.test(ag) && /Clover Bay/.test(text(ag)) && /outside the numbers/.test(text(ag)) && P.REGCARDS.areaHtml("nowhere", api) === "", "the area card group is collapsed, holds Clover Bay, and an area with none shows nothing");
  const og = P.REGCARDS.otherHtml(api);
  ok(/id=rcother/.test(og) && /Other Dubai areas/.test(text(og)) && /The LX/.test(text(og)) && !/Clover Bay/.test(text(og)) && !/Jumeirah Business Centre 4/.test(text(og)) && !/<details[^>]*\bopen\b/.test(og), "Other Dubai areas holds the projects outside the 42 (The LX), not the ones inside");
  ok(/Arjan/.test(text(og)) && /MULK PROPERTIES/.test(text(og)), "grouped by the register area name, with the registered developer");
  const dk = (h, n) => { const m = h.match(new RegExp("data-pd=\"([^\"]+)\"[^>]*aria-label=\"[^\"]*" + n)); return m && m[1]; };
  const tk = dk(og, "The LX");
  ok(tk, "each card is a button that opens Project details");
  P.pdOpen(tk, mkEl("f")); const t = text(els.pjdet.innerHTML);
  ok(/Register project number 3772/.test(t) && t.includes(LABEL) && /51 unit sales registered/.test(t) && /Sale prices/.test(t) && /MULK PROPERTIES/.test(t) && /REGISTER_VERIFIED/.test(t), "The LX panel: register number, label, sales, price range, developer, evidence label", t.slice(0, 600));
  ok(/Investor/.test(els.pjdet.innerHTML) && /Client/.test(els.pjdet.innerHTML) && /Broker/.test(els.pjdet.innerHTML), "the panel carries the three document buttons");
  ok(!/per sq/.test(t.slice(0, 200)) && /No price per area recorded/.test(t), "no price per area is shown");
  const ck = dk(ag, "Clover Bay"); P.pdOpen(ck, mkEl("f"));
  ok(/Register project number 485/.test(text(els.pjdet.innerHTML)), "an inside-the-42 card opens its panel too");
  const lk = dk(P.REGCARDS.areaHtml("alwasl", api), "Amali"); P.pdOpen(lk, mkEl("f")); const lt = text(els.pjdet.innerHTML);
  ok(/No registered unit sale; 1 land or building sale/.test(lt) && !/Sale prices/.test(lt), "land-only project: says so, no price range");
  ok(!EMOJI.test(g) && !EMOJI.test(ag) && !EMOJI.test(og) && !EMOJI.test(els.pjdet.innerHTML), "no emoji in the rendered groups or panel");
}
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
