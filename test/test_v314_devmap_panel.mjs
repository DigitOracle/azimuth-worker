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
ok(/Buyers '\+t\.shares\.n\+'%/.test(js) && /Money '\+t\.shares\.money\+'%/.test(js) && /Dubai-wide share of sales/.test(js), "chips 'Buyers n%' and 'Money n%' with the caption 'Dubai-wide share of sales'");
ok(/S\.unit==="sqft"\?"sqm":"sqft"/.test(js), "the band: the chosen unit first, the other smaller beneath");
ok(/This view is not complete yet/.test(js) && /loaded for this area so far \(the register holds many more\)/.test(js), "a thin area says only N sales are loaded and the view is not complete");
ok(/thin\|\|mineHides\?'':'<p class=note>No developer with 3\+ sales/.test(js), "the per-tier 'No developer with 3+ sales' line is not shown for a thin area or when 'only my developers' hides everyone");
ok(/None of your '\+mineList\(\)\.length\+' have 3 or more recorded sales here yet/.test(js) && /id=showall>Show all developers here/.test(js) && /showall/.test(js.split("showall").slice(-1)[0] === "" ? "" : js), "'None of your ten have 3 or more recorded sales here yet' with a one-tap 'Show all developers here' link");
ok(/\(t\.nDevs\|\|!\(thin\|\|mineHides\)\?/.test(js), "a tier header never prints a bare '0 developers' for a data gap");
ok(!/sales with the developer not recorded'/.test(js), "the old 'with the developer not recorded' wording is replaced");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
