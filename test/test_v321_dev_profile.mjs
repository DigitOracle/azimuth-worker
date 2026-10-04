// v321 - THE DEVELOPER'S BRAND PROFILE. A developer is a brand first (its projects, its scale, its prices by area) and a price in one area second.
// Omniyat-style: ultra-luxury brand, but premium in Business Bay. The area row reads BOTH; tapping the name opens a profile card.
//   node test/test_v321_dev_profile.mjs
import { devmapHtml } from "../src/devmap_page.js";
import { DM, buildArea } from "../scripts/build_devmap_index.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d !== undefined ? "\n         " + String(d).slice(0, 400) : "")); } };
DM.TIER_CFG.bounds = null;
const B = [30000, 20000, 12000];   // ultra-luxury from 30,000 per sq m, luxury from 20,000, premium from 12,000
// a building = [sales, median price per sq m]; cells = [sales, price per sq m, price, bedrooms]
const cell = (n, ppsm) => [n, ppsm, ppsm * 100, 1];
const dev = (name, buildings, homes) => ({ n: name, h: homes || 0, c: buildings.map((b) => cell(b[0], b[1])), r: [], b: buildings.map((b, i) => [b[0], b[1], name + " " + (i + 1)]) });
const times = (k, b) => Array.from({ length: k }, () => b.slice());

// OMNIYAT-STYLE: 10 projects, 7 ultra-luxury (Downtown, Palm), 3 premium (Business Bay). Business Bay sales are all premium.
const IDX = { as_of: "2026-10-03", cuts: { bounds: B }, devs: {}, areas: {
  downtown: { name: "Downtown", devs: { omni: dev("Omniyat", times(4, [20, 52000]), 400), ellington: dev("Ellington", times(1, [15, 31000]).concat(times(5, [30, 16000])), 600) } },
  palm: { name: "Palm Jumeirah", devs: { omni: dev("Omniyat", times(3, [12, 41000]), 200), ellington: dev("Ellington", times(10, [9, 15000]), 900) } },
  bb: { name: "Business Bay", devs: { omni: dev("Omniyat", times(3, [30, 14000]), 500), ellington: dev("Ellington", times(8, [25, 13500]), 700), emaar: dev("Emaar", times(5, [40, 26000]).concat(times(4, [40, 14000])), 3000) } },
  jvc: { name: "Jumeirah Village Circle", devs: { ellington: dev("Ellington", times(1, [2, 12500]), 100), tiny: dev("Tiny Builder", [[2, 40000]], 10) } },
} };
const projCountOf = (k) => Object.values(IDX.areas).reduce((a, ar) => a + ((ar.devs[k] || { b: [] }).b.length), 0);
for (const k of ["omni", "ellington", "emaar", "tiny"]) IDX.devs[k] = { name: Object.values(IDX.areas).map((a) => a.devs[k]).find(Boolean).n, areas: Object.values(IDX.areas).filter((a) => a.devs[k]).length, n: 500, profile: { projects: projCountOf(k), homes: 0 } };
// 56 filler developers with 1 project each so the percentiles are meaningful: 60 developers in all
for (let i = 0; i < 56; i++) IDX.devs["f" + i] = { name: "Filler " + i, areas: 1, n: 500, profile: { projects: i < 40 ? 1 : i < 50 ? 3 : 6, homes: 5 } };
IDX.devs.small = { name: "Small Project Company", areas: 1, n: 12, profile: { projects: 80, homes: 1 } };   // under 100 sales: left out of the percentiles

console.log("A - brand tier by projects, and where it differs from where it sells");
const om = DM.devProfile(IDX, "omni");
ok(om.projects === 10 && JSON.stringify(om.tierProjects) === "[7,0,3,0]", "Omniyat-style: 10 projects, 7 ultra-luxury and 3 premium", JSON.stringify(om.tierProjects));
ok(om.brandTier === 0 && DM.brandLabel(om.brandTier) === "Ultra-luxury brand", "brand tier = the tier holding most projects: 'Ultra-luxury brand'", om.brandTier);
const bbStats = DM.areaStats(IDX.areas.bb, IDX);
const omBB = bbStats.tiers[2].devs.find((d) => d.k === "omni");
ok(!!omBB && bbStats.tiers[0].devs.every((d) => d.k !== "omni"), "in Business Bay the area panel still files it under PREMIUM (the doughnut / area split is unchanged)");
ok(om.priced.find((a) => a.slug === "bb").tierHere === 2 && om.brandTier === 0, "ultra-luxury brand but premium here: the profile carries both");
ok(Math.round(om.mixSales[0]) > 50 && om.mixProjects[0] === 70 && om.mixProjects[2] === 30, "mix by projects 70 / 30, by sales and by value are separate figures", JSON.stringify([om.mixProjects, om.mixSales, om.mixValue]));
// brand tier by projects vs by sales can differ
const el = DM.devProfile(IDX, "ellington");
ok(el.projects === 25 && el.brandTier === 2 && el.tierProjects[0] === 1, "Ellington-style: 25 projects, 24 premium and 1 ultra-luxury; the brand tier follows the projects", JSON.stringify(el.tierProjects) + " " + el.brandTier);
const X = { as_of: "x", cuts: { bounds: B }, devs: { x: { name: "X", areas: 1, n: 106, profile: { projects: 3, homes: 0 } } }, areas: { a: { name: "A", devs: { x: dev("X", [[3, 40000], [3, 38000], [100, 5000]], 0) } } } };
const px = DM.devProfile(X, "x");
ok(px.brandTier === 0 && px.mixSales[3] > px.mixSales[0] && px.mixSales[3] >= 90, "brand tier by PROJECTS (ultra-luxury, 2 of 3) can differ from the tier of its SALES (budget, 94%)", JSON.stringify([px.brandTier, px.mixSales]));
const T = { as_of: "x", cuts: { bounds: B }, devs: { t: { name: "T", areas: 1, n: 8, profile: { projects: 2, homes: 0 } } }, areas: { a: { name: "A", devs: { t: dev("T", [[4, 40000], [4, 25000]], 0) } } } };
ok(DM.devProfile(T, "t").brandTier === 0, "a tie between two tiers goes to the higher tier (the rule is stated on the card)");
const olds = { as_of: "x", cuts: { bounds: B }, devs: { o: { name: "O", areas: 1, n: 8 } }, areas: { a: { name: "A", devs: { o: { n: "O", h: 0, c: [[8, 40000, 4e6, 1]], r: [] } } } } };
const po = DM.devProfile(olds, "o");
ok(po.projects === null && po.basis === "sales" && po.brandTier === 0 && po.limits.some((l) => /Project counts are not in the data yet/.test(l)), "an index without project lists falls back to sales and says so");

console.log("B - scale words from percentiles of project counts");
const cuts = DM.scaleCuts(IDX);
ok(cuts && cuts.developers === 60 && cuts.boutiqueMax === 3 && cuts.midMax === 6 && cuts.midMax >= cuts.boutiqueMax, "cut-offs are computed from the developers' project counts, not typed in", JSON.stringify(cuts));
ok(DM.scaleWord(1, cuts) === "Boutique" && DM.scaleWord(cuts.midMax + 1, cuts) === "Large-scale" && DM.scaleWord(cuts.boutiqueMax + 1, cuts) === "Mid-size", "Boutique / Mid-size / Large-scale from the cut-offs (never the word Mass-market, which is a market view)");
ok(DM.scaleWord(25, cuts) === "Large-scale" && DM.scaleWord(10, cuts) === "Large-scale", "bigger developers read Large-scale (a developer with 80 projects but 12 sales did not move the cut-offs)");
ok(/Boutique: up to 3 projects/.test(DM.scaleSay(cuts)) && /Large-scale: more than 6/.test(DM.scaleSay(cuts)) && /100 or more settled sales/.test(DM.scaleSay(cuts)) && !/Mass-market/.test(DM.scaleSay(cuts)) && /in every 100/.test(DM.scaleSay(cuts)), "the cut-offs are written out in plain words for the page", DM.scaleSay(cuts));
ok(om.scale === DM.scaleWord(10, cuts) && px.scale === DM.scaleWord(3, DM.scaleCuts(X)), "the profile carries the scale word");
ok(DM.scaleCuts({ devs: {} }) === null && DM.scaleWord(5, null) === null, "no developers, no scale word");

console.log("C - price by area, ordering, honest limits, the sentence");
ok(om.priced.map((a) => a.name).join("|") === "Downtown|Palm Jumeirah|Business Bay", "price by area is ordered high to low", om.priced.map((a) => a.name + a.medianSqm).join(" "));
ok(om.spread.lo.name === "Business Bay" && om.spread.hi.name === "Downtown" && om.spread.several, "spread: lowest and highest area");
ok(DM.profileSentence(om, "sqft") === "Omniyat: 7 of 10 projects sit in the top band; prices run from AED " + Math.round(14000 / DM.SQFT).toLocaleString("en-US") + " per sq ft in Business Bay to AED " + Math.round(52000 / DM.SQFT).toLocaleString("en-US") + " in Downtown.", DM.profileSentence(om, "sqft"));
ok(/per sq m in Business Bay to AED 52,000 in Downtown/.test(DM.profileSentence(om, "sqm")), "the sentence follows the per sq m toggle");
const elj = el.thin.map((a) => a.name);
ok(elj.length === 1 && elj[0] === "Jumeirah Village Circle" && el.priced.length === 3 && !el.priced.some((a) => a.n < 3), "an area under 3 sales is listed as thin and never given a price");
const ti = DM.devProfile(IDX, "tiny");
ok(ti.priced.length === 0 && ti.limits.some((l) => /No area has 3 or more settled sales/.test(l)) && ti.limits.some((l) => /Only 1 project /.test(l)) && /no area has 3 or more settled sales yet/.test(DM.profileSentence(ti, "sqft")), "a developer with 1 project and no 3+ sales area says both limits in plain words", JSON.stringify(ti.limits));
const me = DM.devProfile(IDX, "mered");
ok(me.areas === 0 && me.brandTier === -1 && me.limits[0] === "No sales on the map yet." && DM.profileSentence(me, "sqft") === "mered: no sales on the map yet.", "Mered-style (no area): 'No sales on the map yet.'", JSON.stringify(me.limits));

console.log("D - the index builder writes one entry per building");
const U = { buildings_by_id: {
  1: { name: "Tower One", developer: "Omniyat", registered_homes: 100, dld_sales: { sold_by_type: { Studio: 5, "1 bed": 7 } }, rows: [{ type: "Studio", median_aed: 1000000, median_sqm: 40 }, { type: "1 bed", median_aed: 2000000, median_sqm: 70 }] },
  2: { name: "Tower Two", developer: "Omniyat", registered_homes: 50, dld_sales: { sold_by_type: { "1 bed": 4 } }, rows: [{ type: "1 bed", median_aed: 1500000, median_sqm: 60 }] },
} };
const bd = buildArea(U, "bb", {}, {}, [], {});
const k0 = Object.keys(bd).find((k) => k !== "_");
ok(k0 && bd[k0].b.length === 2 && bd[k0].b[0][0] === 12 && bd[k0].b[1][0] === 4 && bd[k0].c.length === 3, "buildArea: two buildings -> two project entries [sales, price per sq m]; existing cells unchanged", JSON.stringify(bd[k0]));
const wm = Math.round(DM.wmedian([[25000, 5], [28571, 7]]));
ok(bd[k0].b[0][1] === wm, "a building's price per sq m is the sale-weighted median of its bedroom types", bd[k0].b[0][1] + " vs " + wm);

ok(/e\.profile\.homes \+= d\.h \|\| 0; e\.n \+= /.test(fs.readFileSync(new URL("../scripts/build_devmap_index.mjs", import.meta.url), "utf8")), "the builder still adds each developer's sales total (a comment once swallowed it): n is not left at 0");
console.log("E - the page");
const html = devmapHtml("k", { NAJ_NAV_CSS: "", NAJ_FONTS: "", najNav: () => "" });
const js = html.slice(html.indexOf("<script>", html.indexOf("maplibre-gl.js")) + 8, html.lastIndexOf("</script>"));
const f = path.join(os.tmpdir(), "dm321_" + Math.random().toString(36).slice(2) + ".js"); fs.writeFileSync(f, js);
let parsed = true; try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); } catch (e) { parsed = false; }
ok(parsed, "the page script parses");
const cut = (a, b) => js.slice(js.indexOf(a), js.indexOf(b));
const mkPage = (script) => {
  const s0 = cut("function esc(t)", "function api(");
  const s1 = cut("function fmt(n)", "(function(){var b=new URLSearchParams(location.search).get(\"bounds\")");
  const s2 = cut("function bar(arr", "function devRow(");
  const s3 = cut("var DRILLSET=null", "function devTier(k)");
  const s4 = cut("var STATS={},IXC={};", "function features()") + cut("var MON=", "function barsSvg(");   // v323 - the window helpers the profile now reads
  const S = { prof: null, drill: null, sel: "bb", unit: "sqft", win: "all" };
  const TC = ["#c5a56a", "#2f8a7f", "#3987e5", "#8a9a96"];
  const fn = new Function("DM", "IDX", "S", "TC", "DEFAULT_NAMES", "setSheet", "renderDetail", "refreshMap", s0 + s1 + s4 + s2 + s3 + "; return {drillHtml:drillHtml,setDrill:setDrill,dimOf:dimOf,donut:donut,profileHtml:profileHtml,pickNote:pickNote,brandLine:brandLine,prof:prof};");
  return { S, ...fn(DM, IDX, S, TC, { mered: "Mered" }, () => {}, () => {}, () => {}) };
};
const P = mkPage(js);
const card = P.profileHtml("omni");
const text = card.replace(/<title>[^<]*<\/title>/g, "").replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ");
ok(!/brand/.test(card.slice(0, card.indexOf("Market view"))) && /Developer profile/.test(card) && /Omniyat: 7 of 10 projects sit in the top band; prices run from AED \d/.test(text), "profile card: no developer class from price alone, and the one plain sentence from the data", text.slice(0, 400));
ok(/Projects by price band:/.test(card) && /Top band 7 · Middle band 3 \(of 10 projects\)/.test(text), "mix by projects: a doughnut and spelled-out counts");
ok(/By number of sales Top band \d+% · Upper band \d+% · Middle band \d+% · Entry band \d+%/.test(text) && /By value Top band \d+% · Upper band \d+% · Middle band \d+% · Entry band \d+%/.test(text), "mix bars use spelled-out names", text);
ok(/10 projects · 3 areas/.test(text) && !/homes/.test(text.slice(text.indexOf("Scale"), text.indexOf("Price by area"))) && /Boutique|Mid-size|Large-scale/.test(text) && /Boutique: up to 3 projects/.test(text), "scale: projects, homes, areas, the scale word and its cut-offs shown on the page", text);
const rows = [...card.matchAll(/<tr><td>([^<]*)<\/td><td class=r>AED ([\d,]+)<\/td>/g)].map((m) => [m[1], Number(m[2].replace(/,/g, ""))]);
ok(rows.length === 3 && rows[0][0] === "Downtown" && rows[2][0] === "Business Bay" && rows[0][1] > rows[1][1] && rows[1][1] > rows[2][1], "the price-by-area table reads highest first (Downtown, Palm Jumeirah, Business Bay)", JSON.stringify(rows));
ok(/Price band here/.test(card) && /<td>Middle band<\/td>/.test(card), "the table says the price band in each area (Middle band in Business Bay)");
ok(/Source: Dubai Land Department settled sales to 2026-10-03\. Price bands are cut from all Dubai settled sales so that each holds about a quarter of the money spent; they describe homes, not developers\./.test(text), "source line: Dubai Land Department settled sales to <date>; tiers are price bands, not a view of any developer");
ok(/Back to Business Bay/.test(card), "a Back button returns to the area");
P.S.unit = "sqm";
ok(/Median price per sq m/.test(P.profileHtml("omni")) && /AED 52,000/.test(P.profileHtml("omni")), "the per sq m toggle changes the table");
const thin = P.profileHtml("tiny").replace(/<[^>]*>/g, " ");
ok(/Only 1 project/.test(thin) && /No area has 3 or more settled sales yet/.test(thin), "thin developer: both limits shown on the card");
ok(/no sales on the map yet/.test(P.profileHtml("mered")) && /Mered/.test(P.profileHtml("mered")), "Mered: 'no sales on the map yet'");
ok(P.brandLine({ k: "omni", tier: 2 }) === "<div class=ms>sells in the Middle band here</div>", "area row line without a market view: 'sells in the <band> here'", P.brandLine({ k: "omni", tier: 2 }));
ok(P.pickNote("omni", IDX.devs.omni) === "10 projects · " + DM.scaleWord(10, cuts).toLowerCase() + " · 3 areas · 500 sales" && P.pickNote("mered", { areas: 0 }) === "no sales on the map yet", "picker line: '10 projects · <scale> · 3 areas · N sales'; no area: 'no sales on the map yet'", P.pickNote("omni", IDX.devs.omni));
ok(/<div class=pk><span><a href="#" class=dlink/.test(js) && /tagText\(x\.k\)/.test(js) && !/DM\.TIER_NAMES\[t\]\+'<\/span>':''\)\+'<button type=button class="rm btn"/.test(js), "picker chosen rows: tappable name and a tag (market view, else the band most projects sit in)");
ok(/replace\(\/\\bJLT\\b\/g,"Jumeirah Lakes Towers"\)/.test(js), "an area the data names with an initial (JLT) is spelled out on the page");
ok(/brandLine\(d\)/.test(js) && /class=dlink data-k=/.test(js) && /openProf/.test(js), "area rows: brand line under a tappable name that opens the profile");
{ // plain language: no initials or shorthand anywhere a user can read
  const visible = (card + P.profileHtml("tiny") + P.profileHtml("mered") + P.brandLine({ k: "omni", tier: 2 })).replace(/<title>[^<]*<\/title>/g, "").replace(/<[^>]*>/g, " ").replace(/\bAED\b/g, "");
  const initials = visible.match(/\b[A-Z]{2,6}\b/g) || [];
  ok(initials.length === 0, "no initials in the profile card (only the currency code AED is allowed)", initials.join(","));
  ok(!/\b(DLD|ppsm|KV|YoY|p\.a\.|avg|approx|vs\.?)\b/.test(visible) && !/ULTRA-LUXURY|PREMIUM|BUDGET/.test(visible), "no shorthand, and the tiers are spelled out in words rather than capitals");
}

console.log("G - round 2: drill-down, projects not homes, price position, market view");
const dr = DM.drillProjects(IDX, "omni", 0);
ok(dr.length === 2 && dr[0].name === "Downtown" && dr[0].projects.length === 4 && dr[1].name === "Palm Jumeirah" && dr[1].projects.length === 3 && dr[0].projects[0].name === "Omniyat 1" && dr[0].projects[0].ppsm === 52000 && dr[0].n === 80, "tap the ultra-luxury segment: Omniyat's 7 projects grouped by location (Downtown 4, Palm Jumeirah 3), each with name, price, sales", JSON.stringify(dr).slice(0, 200));
ok(DM.drillProjects(IDX, "omni", 2, "bb").length === 1 && DM.drillProjects(IDX, "omni", 2, "bb")[0].projects.length === 3 && DM.drillProjects(IDX, "omni", 1).length === 0, "limited to one area it lists that area only; an empty tier lists nothing");
P.S.unit = "sqft"; P.setDrill({ k: "omni", ar: null, t: 0 });
const dh = P.drillHtml(), dt = dh.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
ok(/Omniyat: projects in the top band, by location/.test(dt) && /7 projects in 2 places/.test(dt) && /Downtown AED 4,831 per sq ft/.test(dt) && /Omniyat 1 · AED 4,831 per sq ft · 20 sales/.test(dt) && /id=dclear/.test(dh), "the drill list: area names, project names, price per sq ft, sales, and a Clear button", dt.slice(0, 400));
ok(P.dimOf("bb") === 1 && P.dimOf("downtown") === 0 && P.dimOf("palm") === 0, "map: areas outside the tapped segment are dimmed, the ones inside are not");
P.setDrill(null);
ok(P.dimOf("bb") === 0, "Clear returns the whole map");
P.S.unit = "sqm"; P.setDrill({ k: "omni", ar: null, t: 0 });
ok(/AED 52,000 per sq m/.test(P.drillHtml()), "the drill list follows the per sq m toggle"); P.setDrill(null); P.S.unit = "sqft";
const dn = P.donut([70, 0, 30, 0], "omni", "bb");
ok(/class=dseg[^>]*data-dk="omni" data-ar="bb"/.test(dn) && /<span class=dseg[^>]*data-tier=0[^>]*>/.test(dn) && !/dseg/.test(P.donut([70, 0, 30, 0])), "doughnut segments and legend entries are tappable when a developer is given, and plain without");
ok(!/homes not on record/.test(js) && !/fmt\(d\.homes\)/.test(js) && /' across '\+n\+' project'/.test(js), "developer rows: '889 sales across 7 projects', no homes figure");
const rk = DM.priceRanking(IDX);
ok(rk.map((x) => x.k).join() === "ellington,emaar,omni", "ranking: developers with 3+ sales, lowest to highest Dubai-wide median price (Ellington, Emaar, Omniyat); Tiny Builder (2 sales) is left out", rk.map((x) => x.k + x.ppsm).join(" "));
const ppE = DM.pricePosition(IDX, "emaar"), ppO = DM.pricePosition(IDX, "omni"), ppT = DM.pricePosition(IDX, "tiny"), ppM = DM.pricePosition(IDX, "mered");
ok(ppE.below.name === "Ellington" && ppE.above.name === "Omniyat" && ppO.below.name === "Emaar" && ppO.above === null && ppE.peers.length === 2, "'priced between Ellington and Omniyat' for Emaar; top of the list has nobody above", JSON.stringify([ppE.below, ppE.above]));
ok(ppM.ranked === false && ppM.limit === "no sales yet" && /under 3/.test(ppT.limit), "no sales: 'no sales yet'; under 3 sales: says so");
const card2 = P.profileHtml("emaar").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
ok(/Price position/.test(card2) && /Priced between Ellington \(AED [\d,]+ per sq ft\) and Omniyat \(AED [\d,]+ per sq ft\)\./.test(card2) && /ranked among 3 developers with 3 or more settled sales/.test(card2) && /Closest to compare with/.test(card2), "the card's Price position line and the nearest peers", card2.slice(0, 700));
ok(/Priced above Emaar \(AED [\d,]+ per sq ft\); no developer is priced higher/.test(P.profileHtml("omni").replace(/<[^>]*>/g, " ")) && /no sales on the map yet/.test(P.profileHtml("mered")), "Omniyat is priced above Emaar; Mered says it has no sales on the map yet");
ok(Object.keys(DM.BRAND_PERCEPTION).join() === "omniyat" && DM.BRAND_PERCEPTION.omniyat.tier === 0, "market view table: one config place, only Omniyat = ultra-luxury by default");
{
  const IDX2 = JSON.parse(JSON.stringify(IDX)); IDX2.devs.omniyat = IDX2.devs.omni; for (const a of Object.values(IDX2.areas)) if (a.devs.omni) a.devs.omniyat = a.devs.omni;
  const m = DM.devProfile(IDX2, "omniyat");
  ok(m.market === 0 && m.headline === 0 && m.brandTier === 0, "configured developer: headline is the market view");
  DM.BRAND_PERCEPTION.emaar = { tier: 0 };
  const e = DM.devProfile(IDX, "emaar");
  ok(e.market === 0 && e.headline === 0 && e.brandTier !== 0 && /Upper band|Middle band|Entry band|Top band/.test(DM.dataLine(e)) && /^\d+ of 9 projects in the /.test(DM.dataLine(e)), "market view sets the headline while the price line keeps the band mix", DM.dataLine(e));
  const c3 = P.profileHtml("emaar").replace(/<title>[^<]*<\/title>/g, "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
  ok(/Ultra-luxury brand \(market view\)/.test(c3) && /Market view: Ultra-luxury brand, as the market names it\./.test(c3) && /Where its projects sit on price: \d+ of 9 projects in the (Top|Upper|Middle|Entry) band/.test(c3) && !/What the data suggests/.test(c3) && /no class is given from price/.test(c3) && /no hidden score/.test(c3) && /Its projects by price band/.test(c3), "card: 'Ultra-luxury brand (market view)', the data beside it and a plain explanation of which is which", c3.slice(0, 500));
  ok(P.brandLine({ k: "emaar", tier: 2 }) === "<div class=ms><b>Ultra-luxury brand</b> (market view) · sells in the Middle band here</div>" && P.brandLine({ k: "ellington", tier: 3 }) === "<div class=ms>sells in the Entry band here</div>", "area rows use the headline label");
  delete DM.BRAND_PERCEPTION.emaar;
}
ok(!/(\d|,)\s*homes\b/.test(P.profileHtml("omni").replace(/<[^>]*>/g, " ")), "the units register total is never a headline on the card");

console.log("H - round 3: price bands vs positions, evidence factors, talking point, cards");
ok(JSON.stringify(DM.TIER_NAMES) === '["Top band","Upper band","Middle band","Entry band"]' && JSON.stringify(DM.POSITION_WORDS) === '["Ultra-luxury","Luxury","Premium","Mass-market"]' && DM.brandLabel(3) === "Mass-market brand", "price bands (homes) and positions (brands) are two separate vocabularies; 'Budget' is gone");
ok(!/ULTRA-LUXURY|PREMIUM|BUDGET|Tier mix|in this tier|Tier bands|Ejari tenancy|Ejari contracts|Tier here|Brand tier:/.test(js), "every old string is migrated out of the page script");
ok(DM.bandLine(0, B, "sqft") === "AED 2,787 and above per sq ft" && DM.bandLine(3, B, "sqft") === "under AED 1,115 per sq ft" && DM.bandLine(1, B, "sqm") === "AED 20,000 to 30,000 per sq m", "band ranges in AED per sq ft or per sq m");
DM.PRIME_AREAS.push("downtown", "palm");
const fc = DM.devFactors(IDX, "omni");
ok(fc.priceLevel.medianSqm === 41000 && fc.priceLevel.rank === 3 && fc.priceLevel.total === 3 && fc.priceLevel.pctBelow === 67 && fc.priceLevel.ratio > 1, "factor 1 price level: median, against the Dubai-wide median, and the percentile among developers", JSON.stringify(fc.priceLevel));
ok(fc.premium && fc.premium.areas === 3 && fc.premium.ratio > 1.5, "factor 2 price against its surroundings: median over the other developers in the same areas, weighted by sales (3 areas)", JSON.stringify(fc.premium));
const e2 = DM.devFactors(IDX, "ellington");
ok(e2.premium && e2.premium.ratio < 1.2, "a developer priced like its neighbours reads close to level (Ellington, or below)", JSON.stringify(e2.premium));
ok(fc.inventory.projects === 10 && fc.inventory.areas === 3 && fc.inventory.sales === 206 && fc.inventory.salesPerProject === 21 && fc.inventory.homesPerProject === 110, "factor 3 inventory and scale: projects, sales, areas, sales per project, registered homes per project", JSON.stringify(fc.inventory));
ok(fc.unitMix.studioOne === 100 && fc.unitMix.shares[2] === 0 && fc.unitMix.medianSqft === 1076, "factor 4 unit mix: share of studios and one-beds, larger homes, median home size", JSON.stringify(fc.unitMix));
ok(fc.location.primePct === 56 && fc.location.inlandPct === 44 && fc.location.primeAreas.join() === "Downtown,Palm Jumeirah", "factor 5 location mix from the explicit coastal and prime list", JSON.stringify(fc.location));
ok(fc.delivery.available === false && /completion dates/.test(fc.delivery.why), "factor 6 delivery record: honestly 'not in the data yet'");
ok(fc.quality === null, "quality note is empty by default");
DM.QUALITY_NOTES.omni = { note: "Branded residences with a hotel partner", source: "Developer sales brochure", date: "2026-09-30" };
ok(DM.devFactors(IDX, "omni").quality && /hotel partner/.test(DM.devFactors(IDX, "omni").quality.note), "a quality note shows once note, source and date are all filled");
DM.QUALITY_NOTES.omni = { note: "Lovely finish", source: "", date: "" };
ok(DM.devFactors(IDX, "omni").quality === null, "a note without source and date is never shown");
delete DM.QUALITY_NOTES.omni;
const ev = P.profileHtml("omni"), evt = ev.replace(/<title>[^<]*<\/title>/g, "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
ok(/Positioning evidence/.test(evt) && /There is no hidden score/.test(evt) && ["Price level", "Price against its surroundings", "Inventory and scale", "Unit mix", "Location mix", "Delivery record"].every((x) => evt.includes(x)) && /Curated judgement Quality, finish, design partners, branded residences Not filled in/.test(evt) && /coastal and prime areas/.test(evt), "the profile card shows every factor with its number and a plain label, data and curated judgement marked apart", evt.slice(evt.indexOf("Positioning"), evt.indexOf("Positioning") + 500));
ok(/Market view: not set yet\./.test(evt) && /Where its projects sit on price: 7 of 10 projects in the Top band, 3 Middle\./.test(evt) && !/What the data suggests|Ultra-luxury brand —|Mass-market brand/.test(evt), "two separate lines: 'Market view' and 'Where its projects sit on price' (band mix in band words, no developer class)");
ok(/Price bands \(per sq ft\)/.test(evt) && /Top band\s*: AED 2,787 and above per sq ft/.test(evt) && /describe homes, not developers/.test(evt), "price band key with the AED range and the caption that bands describe homes");
{
  const tp = DM.talkingPoint(IDX, "omni", "sqft");
  ok(tp.lines.length === 2 && /^Omniyat: 5\d% of sales sit in the Top band, median AED [\d,]+ per sq ft, \d+% above the other developers in the same areas, Dubai Land Department sales to 2026-10-03\.$/.test(tp.lines[0]) && /^When someone calls a developer luxury, is that price per square foot, quality, or who it is built for\?$/.test(tp.lines[1]), "talking point without a market view: the fact with number, source and date, then one open question; no perception line", tp.lines.join(" | "));
  DM.BRAND_PERCEPTION.omni = { tier: 0 };
  const tm = DM.talkingPoint(IDX, "omni", "sqft");
  ok(tm.lines.length === 3 && /^The market calls it Ultra-luxury\. Its sales sit mostly in the same band\.$/.test(tm.lines[1]), "with a market view: a perception line, worded as what the market calls it, never as a fact", tm.lines[1]);
  DM.BRAND_PERCEPTION.omni = { tier: 3 };
  ok(/The market calls it Mass-market\. Its sales sit mostly in the Top band\./.test(DM.talkingPoint(IDX, "omni", "sqft").lines[1]), "where the market view and the sales differ, it says so plainly");
  delete DM.BRAND_PERCEPTION.omni;
  ok(!/\b(safe|risky|best|return|yield|invest|guarantee|cheap|overpriced)\b/i.test(tm.text) && !/finish|craft/i.test(tm.text), "no safe / risky / best, no return or investment claims, no claims about finish");
  ok(DM.talkingPoint(IDX, "mered", "sqft").lines[0] === "mered: no sales on the map yet.", "no sales: one plain line");
  ok(/Talking point/.test(evt) && /id=tcopy data-t="Omniyat: /.test(ev) && />Copy</.test(ev) && /adverts need the permit number/.test(evt), "the talking point block has a Copy button and the permit-number reminder");
}
DM.PRIME_AREAS.length -= 2;
ok(!/(\d|,)\s*homes\b/.test(evt), "still no homes figure as a headline");
{ // the client meeting cards
  const s0 = cut("function esc(t)", "function api("), s1 = cut("function fmt(n)", "(function(){var b=new URLSearchParams(location.search).get(\"bounds\")"), s3 = cut("var DRILLSET=null", "function devTier(k)"), s4 = cut("function mny(", "function runMeeting(") + cut("var STATS={},IXC={};", "function features()") + cut("var MON=", "function barsSvg(");
  const SS = { prof: null, drill: null, sel: "jvc", unit: "sqft", win: "all" };
  const mk = new Function("DM", "IDX", "S", "TC", "DEFAULT_NAMES", "setSheet", "renderDetail", "refreshMap", s0 + s1 + s3 + s4 + "; return {locCards:locCards,mny:mny};")(DM, IDX, SS, ["a", "b", "c", "d"], {}, () => {}, () => {}, () => {});
  ok(mk.mny(1800000) === "AED 1.8m" && mk.mny(950000) === "AED 950k", "buyer figure reads 'AED 1.8m' / 'AED 950k'");
  const names = ["DAMAC", "Binghatti", "Samana", "Ellington", "Danube"], rents = [54000, 61000, 48000, 70000, 52000];
  const areas = [{ slug: "jvc", name: "Jumeirah Village Circle", devs: names.map((n, i) => ({ k: "x" + i, name: n, rent: rents[i], rpsf: 80 + i, n: 1113 + i })) }, { slug: "palm", name: "Palm Jumeirah", devs: names.slice(0, 4).map((n, i) => ({ k: "y" + i, name: n, rent: 150000 + i * 20000, rpsf: 160, n: 40 + i })) }];
  const h = mk.locCards(areas, (d) => ({ v: d.rent, big: "AED " + d.rent.toLocaleString("en-US") + " a year", small: "AED " + d.rpsf + " per sq ft", ev: d.n.toLocaleString("en-US") + " registered rental contracts" }));
  const cardsN = (h.match(/class=lc /g) || []).length, devN = (h.match(/class=dc>/g) || []).length;
  ok(cardsN === 2 && devN === 9 && /<b>Jumeirah Village Circle<\/b><span class=badge[^>]*>5</.test(h) && /<b>Palm Jumeirah<\/b><span class=badge[^>]*>4</.test(h), "rental view: one card per location with a count badge (five in Jumeirah Village Circle, four in Palm Jumeirah), one small card per developer");
  ok(/class=dcb>AED 54,000 a year</.test(h) && /class=dcs>AED 80 per sq ft</.test(h) && /class=dce>1,113 registered rental contracts</.test(h) && !/a year[^<]*a year/.test(h), "each developer card: big yearly figure, per sq ft underneath, the evidence line; no repeated 'a year'");
  const pos = [...h.matchAll(/<i style="left:(\d+)%">/g)].map((m) => Number(m[1]));
  ok(pos.includes(0) && pos.includes(100) && pos.length === 9, "the thin bar places each developer between the cheapest (0) and the dearest (100) of your developers in that location", pos.join());
  ok(/Your developers’ buildings that fit, by location"/.test(js) && /Registered rental contracts \(the Dubai rent register\), community level/.test(js) && !/Ejari contracts, community/.test(js) && /\.dg2\{display:grid;grid-template-columns:1fr 1fr/.test(html) && /@media\(max-width:340px\)\{\.dg2\{grid-template-columns:1fr\}\}/.test(html), "plain headings (no unexplained names) and a two-column grid that drops to one column below 340 pixels");
  ok(/None of your developers fit this budget with enough sales \(3\+\)/.test(js) && /named_dev_unused|n\.mine\?/.test(js) || /is not one of your developers/.test(js), "the budget logic and the 'not one of my developers' referral text are untouched");
}

{
  console.log("I - neighbours and peers come only from the well-known list");
  const J = JSON.parse(JSON.stringify(IDX));
  const obscure = [["اسم عربي ش.ذ.م.م", 3500], ["Little Project Company", 3700], ["Ahead Real Estate Development", 4500]];
  obscure.forEach(([nm, p], i) => { const k = "obs" + i; J.devs[k] = { name: nm, areas: 1, n: 900, profile: { projects: 2, homes: 0 } }; J.areas.bb.devs[k] = dev(nm, times(2, [450, p]), 0); });
  const pp = DM.pricePosition(J, "emaar");
  ok(DM.isKnown("emaar", "Emaar") && DM.isKnown("select-group", "Select Group") && !DM.isKnown("obs0", "اسم عربي ش.ذ.م.م") && !DM.isKnown("obs1", "Little Project Company"), "the curated list knows the ten and the major names, not project companies");
  ok(pp.below.name === "Ellington" && pp.above.name === "Omniyat" && pp.peers.every((x) => DM.isKnown(x.k, x.name)), "'priced between' names the next KNOWN developer above and below, skipping the obscure ones priced in between", JSON.stringify([pp.below.name, pp.above.name]));
  ok(DM.KNOWN_DEVELOPERS.includes("Omniyat") && DM.KNOWN_DEVELOPERS.includes("Majid Al Futtaim") && DM.KNOWN_DEVELOPERS.includes("Object 1") && DM.KNOWN_DEVELOPERS.length === 27, "the list is one config array (Kendall's ten plus the named list)");
  const po = DM.pricePosition(J, "obs1");
  ok(po.ranked && (po.below || po.above) && [po.below, po.above].filter(Boolean).every((x) => DM.isKnown(x.k, x.name)), "an obscure developer's own card still gets its position, between two known developers");
}
console.log("F - negative control against legend-v320");
let oldPage = "", oldCore = "";
try { oldPage = execFileSync("git", ["show", "legend-v320:src/devmap_page.js"], { cwd: path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")), ".."), encoding: "utf8", maxBuffer: 1 << 26 }); oldCore = execFileSync("git", ["show", "legend-v320:src/devmap_core.js"], { cwd: path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")), ".."), encoding: "utf8", maxBuffer: 1 << 26 }); } catch (e) { console.log("git show failed", e.message); }
ok(oldPage.length > 1000 && !/profileHtml|brandLine|openProf/.test(oldPage), "legend-v320 has no profile card and no brand line (the new checks can fail)");
const oldDM = new Function(oldCore.slice(oldCore.indexOf("var DM="), oldCore.lastIndexOf("`")).replace(/^/, "") + "; return DM;")();
ok(oldDM && typeof oldDM.devProfile !== "function" && typeof oldDM.scaleCuts !== "function", "legend-v320 core cannot compute a brand profile");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
