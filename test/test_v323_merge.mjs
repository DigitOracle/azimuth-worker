// v323 - the developer profile (v321) and the evidence window (v322) working together. Runs the real page script on a hand-worked index.
import fs from "node:fs";
import { devmapHtml } from "../src/devmap_page.js";
import { DM } from "../scripts/build_devmap_index.mjs";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n          " + d : "")); } };
const html = devmapHtml("k", { NAJ_NAV_CSS: "", NAJ_FONTS: "", najNav: () => "" });
const js = html.slice(html.indexOf("<script>", html.indexOf("maplibre-gl.js")) + 8, html.lastIndexOf("</script>"));
const cut = (a, b) => js.slice(js.indexOf(a), js.indexOf(b));
DM.TIER_CFG.bounds = [30000, 20000, 12000];
// developer x: 3 projects over all years (one top band, two middle), 1 of them in the last 12 months; area b has no yearly record
const IDX = { as_of: "2026-09-09", ev: { l12_from: "2025-09-01", l12_to: "2026-08-31", since: "2019-01-01" }, cuts: { bounds: [30000, 20000, 12000] }, devs: { x: { name: "X", areas: 2, n: 40, profile: { projects: 4, homes: 0 } } }, areas: {
  a: { name: "Area A", ev: { all: [1] }, devs: { x: { n: "X", h: 0, c: [[30, 21000, 1e6, 1]], c12: [[6, 33000, 2e6, 1]], b: [[10, 35000, "Tower One"], [10, 15000, "Tower Two"], [10, 14000, "Tower Three"]], b12: [[6, 33000, "Tower One"]], r: [] } } },
  b: { name: "Area B", devs: { x: { n: "X", h: 0, c: [[10, 25000, 1e6, 2]], b: [[10, 25000, "Block B"]], r: [] } } } } };
const s0 = cut("function esc(t)", "function api("), s1 = cut("function fmt(n)", "(function(){var b=new URLSearchParams(location.search).get(\"bounds\")");
const s4 = cut("var STATS={},IXC={};", "function features()") + cut("var MON=", "function barsSvg(");
const s3 = cut("var DRILLSET=null", "function devTier(k)");
const S = { prof: null, drill: null, sel: "a", unit: "sqft", win: "all" };
const fn = new Function("DM", "IDX", "S", "TC", "DEFAULT_NAMES", "setSheet", "renderDetail", "refreshMap", s0 + s1 + s4 + cut("function bar(arr", "function devRow(") + s3 + "; return {ixOf:ixOf,profileHtml:profileHtml,drillHtml:drillHtml,setDrill:setDrill,prof:prof,pickNote:pickNote};");
const P = fn(DM, IDX, S, ["a", "b", "c", "d"], {}, () => {}, () => {}, () => {});
const text = (h) => h.replace(/<title>[^<]*<\/title>/g, "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

console.log("A - the profile follows the window");
const allCard = text(P.profileHtml("x"));
ok(/Every settled sale since 1 Jan 2019/.test(allCard) && /4 of 4 projects|of 4 projects/.test(allCard), "all years: the all-years project count (4) and the all-years sentence", allCard.slice(0, 300));
S.win = "l12";
ok(P.ixOf("l12").areas.a.devs.x.b.length === 1 && P.ixOf("l12").areas.b.devs.x.b.length === 1, "last 12 months: projects come from the last-12-month list where evidence exists, from all years where it does not");
const l12Card = text(P.profileHtml("x"));
ok(/Sales settled 1 Sep 2025 to 31 Aug 2026 \(the last 12 months\)/.test(l12Card) && /of 2 projects/.test(l12Card) && /last 12 months/.test(l12Card.slice(l12Card.indexOf("Price by area"), l12Card.indexOf("Price by area") + 90)), "last 12 months: the card says the window, counts 2 projects, and labels the price-by-area table", l12Card.slice(0, 400));
ok(/Areas with no yearly record show all years: Area B/.test(l12Card), "an area with no yearly record is named as showing all years");
ok(/Last 12 months/.test(P.profileHtml("x")) && /id=wseg/.test(P.profileHtml("x")), "the profile carries the window toggle");
const lwin = P.ixOf("l12");
ok(lwin.devs.x.profile.projects === 2 && lwin.devs.x.n === 16, "the window index recounts the developer list (2 projects, 16 sales) so scale words use window counts", JSON.stringify(lwin.devs.x));
console.log("B - the drill-down follows the window");
S.win = "all"; const dAll = DM.drillProjects(P.ixOf("all"), "x", 2);
S.win = "l12"; P.setDrill({ k: "x", ar: null, t: 0 }); const dh = text(P.drillHtml());
ok(/Tower One/.test(dh) && !/Tower Two/.test(dh) && /Sales settled 1 Sep 2025 to 31 Aug 2026/.test(dh), "last 12 months drill-down lists the project sold in the window and says the window", dh.slice(0, 300));
ok(dAll.length > 0, "all years drill-down still lists the older projects");
console.log("C - wording");
ok(!/\b[0-9,]+ homes\b/.test(allCard + l12Card + dh), "no homes figure as a headline");
ok(!/\btier\b/i.test(allCard + l12Card + dh), "no old tier word on the card or the drill-down");
ok(/class=evtab/.test(js) && !/<table class=evt>/.test(js) && /\.evtab\{/.test(fs.readFileSync(new URL("../src/devmap_page.js", import.meta.url), "utf8")), "the evidence table has its own class (the profile's label class .evt is left alone)");
ok(P.pickNote("x", IDX.devs.x).indexOf("2 projects") === 0 || /2 project/.test(P.pickNote("x", IDX.devs.x)), "picker line follows the window", P.pickNote("x", IDX.devs.x));
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
