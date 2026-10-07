// v371 - AREA CARDS on the developer page. Near the top of a developer's page (after the window and unit toggles, above the Scale card) there is one
// card per area the developer sells in; tapping a card, or a row of the "Price by area" table, lists that developer's projects in that area at once.
// The list is built from DM.drillProjects, the same call the doughnut tap uses, so no data logic is invented. Offline: the page script runs on a hand-worked index.
//   node test/test_v371_areacards.mjs
import fs from "node:fs";
import { devmapHtml } from "../src/devmap_page.js";
import { DM } from "../scripts/build_devmap_index.mjs";
import { PHOSPHOR_LIGHT } from "../src/devmap_icons.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 300) : "")); } };
const EMOJI = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const html = devmapHtml("k", { NAJ_NAV_CSS: "", NAJ_FONTS: "", najNav: () => "" });
const js = html.slice(html.indexOf("<script>", html.indexOf("maplibre-gl.js")) + 8, html.lastIndexOf("</script>"));
const cut = (a, b) => js.slice(js.indexOf(a), js.indexOf(b));
DM.TIER_CFG.bounds = [30000, 20000, 12000];
const IDX = { as_of: "2026-09-09", cuts: { bounds: [30000, 20000, 12000] }, devs: { x: { name: "X", areas: 3, n: 61, profile: { projects: 5, homes: 0 } } }, areas: {
  a: { name: "Area A", devs: { x: { n: "X", h: 0, c: [[30, 21000, 1e6, 1]], b: [[10, 35000, "Tower One"], [10, 15000, "Tower Two"], [10, 14000, "Tower Three"]], r: [] } } },
  b: { name: "Area B", devs: { x: { n: "X", h: 0, c: [[10, 25000, 1e6, 2]], b: [[10, 25000, "Block B"]], r: [] } } },
  c: { name: "Area C", devs: { x: { n: "X", h: 0, c: [[2, 9000, 5e5, 1]], b: [[2, 9000, "Little One"]], r: [] } } } } };
const s0 = cut("function esc(t)", "function api("), s1 = cut("function fmt(n)", "(function(){var b=new URLSearchParams(location.search).get(\"bounds\")");
const s4 = cut("var STATS={},IXC={};", "function features()") + cut("var MON=", "function barsSvg(");
const s3 = cut("var DRILLSET=null", "function devTier(k)");
const S = { evOpen: false, prof: null, drill: null, parea: null, sel: "a", unit: "sqft", win: "all" };
const fn = new Function("DM", "IDX", "S", "TC", "DEFAULT_NAMES", "setSheet", "renderDetail", "refreshMap", "EVI", "var fetch=function(){return new Promise(function(){})};" + s0 + s1 + s4 + cut("function clipName", "function devHead(") + cut("function bar(arr", "function devRow(") + s3 + "; return {profileHtml:profileHtml,drillHtml:drillHtml,setDrill:setDrill,areaProjs:areaProjs};");
const P = fn(DM, IDX, S, ["#c5a56a", "#2f8a7f", "#3987e5", "#8a9a96"], {}, () => {}, () => {}, () => {}, PHOSPHOR_LIGHT);
const text = (h) => h.replace(/<title>[^<]*<\/title>/g, "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

console.log("A - the cards");
const h0 = P.profileHtml("x");
const cards = [...h0.matchAll(/<button type=button class="acard[^"]*" data-aslug="([^"]+)"[^>]*>(.*?)<\/button>/g)].map((m) => ({ slug: m[1], t: text(m[2]) }));
ok(cards.length === 3 && cards.map((c) => c.slug).join() === "b,a,c", "one card per area the developer sells in (a priced area each for A and B, and the thin area C)", JSON.stringify(cards.map((c) => c.slug)));
ok(/Area A 3 projects 30 sales/.test(cards[1].t) && /Area B 1 project 10 sales/.test(cards[0].t) && /Area C 1 project 2 sales/.test(cards[2].t), "each card says the area, its projects and its sales", cards.map((c) => c.t).join(" | "));
ok(/AED [\d,]+ per sq ft/.test(cards[0].t) && /Middle band|Upper band|Top band|Entry band/.test(cards[0].t), "a priced card carries the median price in the chosen unit and the price band", cards[0].t);
ok(/under 3 sales, no price/.test(cards[2].t), "a thin area is shown without a price");
ok(h0.indexOf("id=acards") > h0.indexOf("id=useg") && h0.indexOf("id=acards") < h0.indexOf("<p class=label>Scale</p>"), "the cards sit after the toggles and above the Scale card");
ok(h0.indexOf("id=acards") < h0.indexOf("Price by area") && h0.indexOf("id=acards") < h0.indexOf("Its projects by price band"), "and above the doughnut and the price table");
ok(/<svg class="evi"/.test(cards.length ? h0.slice(h0.indexOf("class=\"acard")) : ""), "each card carries an icon from the icon set");
ok(!/id=aprojs/.test(h0), "no project list until an area is tapped");
S.unit = "sqm";
ok(/AED [\d,]+ per sq m/.test(text(P.profileHtml("x").slice(P.profileHtml("x").indexOf("id=acards"), P.profileHtml("x").indexOf("Scale")))), "the cards follow the per sq m toggle");
S.unit = "sqft";

console.log("B - tapping an area");
S.parea = "a";
const ha = P.profileHtml("x"), pa = ha.slice(ha.indexOf("id=aprojs"), ha.indexOf("Scale"));
const names = [...pa.matchAll(/title="([^"]+)"/g)].map((m) => m[1]);
ok(/Tower One/.test(pa) && /Tower Two/.test(pa) && /Tower Three/.test(pa) && !/Block B/.test(pa) && !/Little One/.test(pa), "only Area A's projects are listed", names.join());
ok(/3 projects, biggest first/.test(text(pa)) && /Projects in Area A|projects in Area A/.test(text(pa)), "the list says how many and where");
ok(/aria-pressed="true"/.test(ha) && (ha.match(/aria-pressed="true"/g) || []).length === 1, "the tapped card is marked pressed, and only that one");
ok(/class="pjc noloc"|class="pjc loc"/.test(pa), "projects use the same project card as the doughnut list (tap to open when a footprint is on file)");
const fromDonut = [0, 1, 2, 3].flatMap((t) => DM.drillProjects(P.ixOfDummy || IDX, "x", t, "a").flatMap((g) => g.projects.map((q) => q.name))).sort().join();
ok(fromDonut === P.areaProjs("x", "a").map((q) => q.name).sort().join(), "the list is exactly what the doughnut taps resolve to for that area (all four bands together)", fromDonut);
ok(/id=aopen/.test(pa) && /id=aclose/.test(pa), "a button opens the area on the map, and one closes the list");
S.parea = "b"; ok(/Block B/.test(P.profileHtml("x")) && !/Tower One/.test(P.profileHtml("x").slice(P.profileHtml("x").indexOf("id=aprojs"), P.profileHtml("x").indexOf("Scale"))), "tapping another area swaps the list");
S.parea = "zzz"; ok(!/id=aprojs/.test(P.profileHtml("x")), "an area the developer does not sell in shows no list");
S.parea = null;

console.log("C - the doughnut still works");
P.setDrill({ k: "x", ar: null, t: 0 });
ok(/Tower One/.test(P.drillHtml()), "the doughnut drill-down still lists the top band's projects");
S.drill = null;
ok(/class=dseg/.test(h0) && /id="?useg|id=useg/.test(h0), "the doughnut segments are still in the profile");
ok(/\[\]\.forEach\.call\(el\.querySelectorAll\("\.dseg"\)/.test(js) && /setDrill\(\{k:g\.getAttribute\("data-dk"\)/.test(js), "and still wired to the same drill");

console.log("D - the price table rows and wiring");
ok(/<tr class=prow data-ap=1 tabindex=0 role=button[^>]*data-slug="a"[^>]*aria-label="Show the projects in Area A">/.test(h0), "price-by-area rows are tappable and named for what they do");
ok(/closest\("\.prow,\.acard"\)/.test(js) && /hasAttribute\("data-ap"\)\)\{toggleArea\(/.test(js) && /classList\.contains\("acard"\)\)\{if\(e\.type==="click"\)toggleArea/.test(js), "rowGo sends an area row or card to toggleArea (keyboard Enter and Space work on rows)");
ok(/function toggleArea\(s\)\{S\.parea=S\.parea===s\?null:s;renderDetail\(\)/.test(js), "tapping the open area again closes it");
ok(/S\.parea=null;S\.pj=null;S\.prof=k/.test(js), "opening another developer clears the open area");
ok(/id=aopen/.test(js) && /select\(ao\.getAttribute\("data-slug"\),true,ao\.getAttribute\("data-k"\)\)/.test(js), "Open on the map keeps the old action (select the area, developer filter on)");

console.log("E - phone and wording");
const css = html.slice(html.indexOf(".acg{"), html.indexOf(".acg{") + 700);
ok(/\.acg\{display:grid;grid-template-columns:1fr 1fr/.test(css), "cards are two across at every width, including 375 px");
const px = [...css.matchAll(/(?:width|min-width):\s*(\d+)px/g)].map((m) => Number(m[1]));
ok(px.every((n) => n <= 375), "no fixed width over 375 px in the card styles", px.join());
const vis = text(h0 + P.profileHtml("x"));
ok(!EMOJI.test(h0) && !EMOJI.test(pa) && !EMOJI.test(css), "no emoji in the cards, the list or the styles");
const lead = h0.slice(h0.indexOf("id=acards"), h0.indexOf("</div></div>", h0.indexOf("id=acards")));
ok(!/[^<>]\s·\s[^<>]*\s·\s/.test(text(lead).replace(/\(of \d+ projects?\)/, "")), "no 'a · b · c' run-on lists in the cards");
ok(!/\b(DLD|ppsm|KV|YoY)\b/.test(vis), "no shorthand");
ok(!/<pre|opacity:0/.test(css), "plain markup");
ok(/Where it sells: tap an area for its projects/.test(h0), "the heading tells the user to tap");

console.log("F - numbers untouched");
S.parea = null;
ok(/Price by area/.test(h0) && /AED [\d,]+<\/td><td class=r>30<\/td>/.test(h0), "the price table still prints the same median and sales", "");
ok(!/function pdf/.test(fs.readFileSync(new URL("../src/devmap_page.js", import.meta.url), "utf8").split("function areaProjs")[1].split("function profileHtml")[0] || ""), "the new code does not touch the PDFs");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
