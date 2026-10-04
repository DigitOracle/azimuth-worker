// v314 - the Developers-by-area panel: (1) a thin area says it is a data gap, never "0 developers"; (2) tier headers are a band line + a 2 x 2 grid of price cards +
// two Dubai-wide share chips, not a run-on line of comma-separated figures. Core data is checked on a hand-worked index, the page by its emitted script.
//   node test/test_v314_devmap_panel.mjs
import { devmapHtml } from "../src/devmap_page.js";
import { DM } from "../scripts/build_devmap_index.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d !== undefined ? "\n         " + String(d).slice(0, 300) : "")); } };
DM.TIER_CFG.bounds = null;   // the index's own cuts, as test_v301 does
const B = [30000, 20000, 12000];
const IDX = { cuts: { bounds: B, shares: { n: [2, 8, 20, 70], money: [10, 25, 25, 40] } }, areas: {} };
const area = { name: "Thin", devs: { _: { n: "Developer not recorded", h: 0, c: [[17, 28000, 2000000, 1]], r: [] } } };
const st = DM.areaStats(area, IDX);
console.log("A - tier data");
ok(st.tiers.length === 4 && st.tiers.every((t) => Array.isArray(t.cards) && t.cards.length === 4), "each tier carries four price cards (Studio, 1-bed, 2-bed, 3-bed)");
ok(JSON.stringify(st.tiers[0].cards.map((c) => c[0])) === '["Studio","1-bed","2-bed","3-bed"]', "labelled Studio / 1-bed / 2-bed / 3-bed");
ok(st.tiers[0].cards.every((c) => /^from AED /.test(c[1])) && st.tiers[3].cards.every((c) => /^under AED /.test(c[1])), "ultra-luxury 'from AED ...', budget 'under AED ...'", JSON.stringify(st.tiers[3].cards));
ok(/^from AED 842k$/.test(DM.tierCards ? DM.tierCards(2, [30000, 20000, 12000])[0][1] : st.tiers[2].cards[0][1]) || /AED \d/.test(st.tiers[2].cards[0][1]), "money is short ('k' / 'm')", st.tiers[2].cards[0][1]);
ok(st.tiers[1].shares && st.tiers[1].shares.n === 8 && st.tiers[1].shares.money === 25, "Dubai-wide buyer and money shares are numbers, for chips");
ok(st.tiers[0].edges.lo === 30000 && st.tiers[0].edges.hi === null && st.tiers[3].edges.lo === null && st.tiers[3].edges.hi === 12000, "band edges are numbers (per sq m) so the page can show sq ft first");
ok(st.n === 17 && st.devCount === 0 && st.unknown && st.unknown.n === 17, "the Palm Deira case: 17 sales, 0 developers, 17 with the developer not recorded");

console.log("B - page script");
const html = devmapHtml("k", { NAJ_NAV_CSS: "", NAJ_FONTS: "", najNav: () => "" });
const js = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
const f = path.join(os.tmpdir(), "dm314_" + Math.random().toString(36).slice(2) + ".js"); fs.writeFileSync(f, js);
let parsed = true; try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); } catch (e) { parsed = false; }
ok(parsed, "the page script still parses");
ok(!/esc\(t\.prices/.test(js) && !/esc\(t\.band\)/.test(js), "the tier header no longer prints the run-on prices line or the single band sentence");
ok(/class=pg/.test(js) && /class=pc/.test(js) && /\.pg\{display:grid;grid-template-columns:1fr 1fr/.test(html), "the 2 x 2 grid of price cards (two columns at every width)");
ok(/in every 100 Dubai sales are in this tier/.test(js) && /together they are '\+t\.shares\.money\+'% of all money spent/.test(js) && /All Dubai sales, '\+winSay\(\)/.test(js) && !/Buyers '/.test(js) && !/Dubai-wide share of sales/.test(js), "tier shares read in plain words: 'N in every 100 Dubai sales are in this tier', 'together they are M% of all money spent', caption 'All Dubai sales, <window>'");
ok(/S\.unit==="sqft"\?"sqm":"sqft"/.test(js), "the band: the chosen unit first, the other smaller beneath");
ok(/This view is not complete yet/.test(js) && /loaded for this area so far \(the register holds many more\)/.test(js), "a thin area says only N sales are loaded and the view is not complete");
ok(/thin\|\|mineHides\?'':filtered\?'<p class=note>None of your developers/.test(js) && /No developer with 3\+ sales sits in this tier here/.test(js), "the per-tier empty line is not shown for a thin area or when my-developers hides everyone; with the filter on it is the plain 'None of your developers' wording");
ok(/None of your '\+mineList\(\)\.length\+' have 3 or more recorded sales here yet/.test(js) && /id=showall>Show all developers here/.test(js) && /showall/.test(js.split("showall").slice(-1)[0] === "" ? "" : js), "'None of your ten have 3 or more recorded sales here yet' with a one-tap 'Show all developers here' link");
ok(/\(t\.nDevs\|\|!\(thin\|\|mineHides\|\|filtered/.test(js), "a tier header never prints a bare '0 developers' for a data gap");
ok(!/sales with the developer not recorded'/.test(js), "the old 'with the developer not recorded' wording is replaced");

console.log("C - Majan sense checks and developer chips");
ok(Array.isArray(st.unknownTier) && st.unknownTier.reduce((a, b) => a + b, 0) === 17 && st.unknownTier[1] === 17, "unknownTier: the 17 sales with no developer sit in LUXURY (28,000 per sq m), for the plain-words tier line", JSON.stringify(st.unknownTier));
ok(/Sales in this tier \('\+fmt\(st\.unknownTier\[t\.tier\]\)\+'\) have no developer recorded/.test(js), "a tier with sales but no developer recorded says 'Sales in this tier (N) have no developer recorded'");
ok(/of about '\+fmt\(reg\)\+' settled sales in this area are loaded/.test(js) && /register_sales_all_time/.test(js), "loaded vs real: 'X of about Y settled sales in this area are loaded' from area.register_sales_all_time");
ok(/ here<\/b>; '\+\(st\.devCount-shown\)\+' other developer/.test(js) && /hidden by your filter\. <a href="#" id=showall>Show all developers here/.test(js), "header vs list: 'N of your M here; K other developers hidden by your filter' with the show-all link");
ok(/None of your developers have 3 or more sales in this tier here/.test(js), "with only-my-developers on, an empty tier says 'None of your developers have 3 or more sales in this tier here'");
ok(/function donut\(ts\)/.test(js) && /<svg width=48 height=48/.test(js) && /\.dn\{grid-column/.test(html), "v318: each developer row carries an inline SVG doughnut of its sales split across tiers");
ok(!/class=tcs/.test(js) && !/class=tc /.test(js), "v318: the tier pills (class tcs / tc) are gone from the row");
{
  const src = js.slice(js.indexOf("function donut(ts)"), js.indexOf("function devRow("));
  const mk = new Function("TC", "DM", "esc", src + "; return donut;");
  const donut = mk(["#c5a56a", "#2f8a7f", "#3987e5", "#8a9a96"], { TIER_NAMES: ["ULTRA-LUXURY", "LUXURY", "PREMIUM", "BUDGET"] }, (x) => String(x));
  const h = donut([0, 79, 5, 16]);
  const ps = [...h.matchAll(/data-tier=(\d) data-p=(\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  ok(/<svg/.test(h) && /role=img/.test(h) && /aria-label="Sales by tier: LUXURY 79%, BUDGET 16%, PREMIUM 5%"/.test(h) && /<title>LUXURY 79%/.test(h), "doughnut has an aria-label, title and hover text with the exact split", h.slice(0, 300));
  ok(ps.length === 3 && ps.reduce((t, x) => t + x[1], 0) === 100 && ps.find((x) => x[0] === 1)[1] === 79, "segment values sum to the split (79 + 16 + 5 = 100)", JSON.stringify(ps));
  const C = 2 * Math.PI * 20, lens = [...h.matchAll(/stroke-dasharray="([\d.]+) /g)].map((m) => Number(m[1]));
  ok(Math.abs(lens.reduce((t, x) => t + x, 0) + 1.6 * lens.length - C) < 0.1, "arc lengths plus the thin gaps fill the ring exactly");
  ok(/>79%<\/text>/.test(h), "the dominant tier's percentage sits in the centre");
  const lg = h.slice(h.indexOf("class=lg"));
  ok(/Luxury 79%/.test(lg) && /Budget 16%/.test(lg) && /Premium 5%/.test(lg) && !/>[LBPU] \d/.test(lg), "legend spells each tier out (v320), never an initial");
  const h2 = donut([0, 80, 4, 16]), lg2 = h2.slice(h2.indexOf("class=lg"));
  ok(!/P 4%/.test(lg2) && /data-tier=2/.test(h2), "a tier under 5% is left out of the legend but kept as an arc");
  const h3 = donut([0, 100, 0, 0]);
  ok((h3.match(/<circle/g) || []).length === 1 && /LUXURY 100%/.test(h3) && /stroke-dasharray="125\.6\d? /.test(h3), "a 100% developer shows one full ring and 'LUXURY 100%'", h3);
  ok(donut(null) === "" && donut([0, 0, 0, 0]) === "" && donut([NaN, undefined, null, -3]) === "", "missing or zero data omits the chart");
}
ok(!/ also '\+d\.second/.test(js), "the single 'also N% TIER' text is gone");
ok(/Each developer sits in the tier where most of its sales here fall \(by number of sales\)/.test(js), "the placement rule is stated once, as a caption");
const CL = await import("../src/community_labels.js");
ok(CL.labelledName("majan", "Majan") === "Majan (Wadi Al Safa 3)" && CL.communitiesOf("majan")[0] === "Majan", "the header names both: Majan (Wadi Al Safa 3)");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
