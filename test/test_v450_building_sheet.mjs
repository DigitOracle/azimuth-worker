// v450 - the ONE-BUILDING broker sheet (Kendall 9 Oct 2026: "when I click here and get the report I get the whole district not the individual building").
// Offline: hand-made fixtures in a stubbed store; nothing live is read or written.   node test/test_v450_building_sheet.mjs
import fs from "node:fs";
import { pickBuilding, salesFigures, rentFigures, windowOf, buildingConfig, loadBuilding, buildingHtml, recKey, RECENT_MAX } from "../src/broker_building.js";
import { parseParams } from "../src/devmap_pdf.js";
import { salesDoc } from "../src/sales_view.js";
import { ejariDoc } from "../src/ejari_page.js";
import { __resetKvMemo } from "../src/brief.js";
import worker from "../src/index.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{FE0F}]/u;
const textOf = (h) => h.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<svg[\s\S]*?<\/svg>/g, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ");

// ------------------------------------------------------------------------------------------------ fixtures
const store = new Map();
const KV = { async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); return t === "arrayBuffer" || (t && t.type === "arrayBuffer") ? new TextEncoder().encode(v).buffer : v; }, async put() {}, async delete() {}, async list() { return { keys: [] }; } };
const J = (k, o) => store.set("img_" + k, JSON.stringify(o));
const BOUNDS = [32292, 22604, 16684];
const evv = (n, med) => [n, med, n, med, 0, 0, n, med, 0, 0, 50, 80, 120];
const cell = (n, psf, bed) => { const ppsm = Math.round(psf * 10.7639); return [n, ppsm, Math.round(ppsm * (60 + 25 * bed)), bed]; };
const dev = (name, psf, n, projects) => { const c = [cell(Math.ceil(n / 2), psf, 1), cell(Math.ceil(n / 2), psf * 1.02, 2)]; return { n: name, h: n * 3, c, c12: c, b: projects.map((nm) => [Math.ceil(n / projects.length), Math.round(psf * 10.7639), nm]), r: [], ev: { all: evv(n, Math.round(psf * 10.7639)), l12: evv(n, Math.round(psf * 10.7639)), y: [[2026, n, 1]], top: [] } }; };
const IDX = { as_of: "2026-10-01", generated: "2026-10-01", cuts: { bounds: BOUNDS, shares: { bounds: BOUNDS, window: ["2025-10-01", "2026-10-01"], sales: 1000, n: [9, 20, 35, 36], money: [26, 25, 26, 24] }, rule: "x" }, devs: {}, alias: {},
  areas: { testdist: { name: "Test Heartland", bbox: [55.1, 25.0, 55.2, 25.1], register_sales_12m: 400, register_sales_all_time: 900, ev: { all: evv(900, 20000), l12: evv(400, 21000), y: [[2026, 400, 21000]] },
    devs: { sobha: dev("Sobha", 2000, 120, ["Creek Heights", "Creek Two"]), other: dev("Other", 1600, 80, ["Other Tower"]) } } },
  scale: {}, ev: { as_of: "2026-09-30", since: "2019-01-01", l12_from: "2025-10-01", l12_to: "2026-09-30", source_as_of: "2026-10-01", sales: 5000, filters: "Ordinary sales." } };
for (const a of Object.values(IDX.areas)) for (const [k, d] of Object.entries(a.devs)) { const e = IDX.devs[k] || (IDX.devs[k] = { name: d.n, areas: 0, n: 0, profile: { projects: 0, homes: 0 } }); e.areas++; e.n += d.c.reduce((q, c) => q + c[0], 0); e.profile.projects += d.b.length; }
J("devmap_index", IDX);
const row = (date, beds, prices, psm, extra) => Object.assign({ date, district: "testdist", area: "Al Test", dld_project: "Creek Heights", dld_project_number: 2717, key: "dld:creekheights", developer_number: 966, developer: "SOBHA L.L.C", attribution: "REGISTER_VERIFIED", kind: "sale", stage: "offplan", beds, sales: prices.length, price_n: prices.length, prices, psm }, extra || {});
const SALES = { as_of: "2026-10-06", district: "testdist", rows: [
  row("2024-03-01", "1", [900000], [18000], { stage: "ready" }),                                  // outside the last 12 months
  row("2026-01-10", "1", [1400000, 1450000, 1500000], [24000, 24500, 25000]),
  row("2026-03-10", "1", [1420000, 1480000], [24200, 24800]),
  row("2026-09-30", "2", [2381079, 2412776], [20215, 20484]),
  row("2026-10-02", "1", [1468104], [25833]),
  row("2026-10-03", "2", [2050000], [22745]),
  row("2026-10-04", "2", [2100000, 2200000, 600e6], [21000, 21500, 22000]),                        // one deal over AED 500M: out of the value
  row("2026-10-05", "3", [], [], { sales: 2, price_n: 0, prices: null, psm: null }),               // two sales with no price recorded
  row("2026-10-05", "1", [1500000], [25000], { kind: "mortgage" }),                                  // a mortgage is never a sale
  row("2026-10-01", "1", [999], [1], { dld_project: "Other Tower", dld_project_number: 1111, key: "dld:othertower" }),
  row("2026-10-01", "1", [888], [1], { dld_project: "Twin Name", dld_project_number: 3001, key: "dld:twinname" }),
  row("2026-10-01", "1", [777], [1], { dld_project: "Twin Name", dld_project_number: 3002, key: "dld:twinname" })] };
J("sales_filed_testdist", SALES);
J("ejari_filed_testdist", { as_of: "2026-10-09", rows: [
  { date: "2026-09-01", district: "testdist", dld_project: "Other Tower", dld_project_number: 1111, key: "dld:othertower", beds: "1", contracts: 6, rent_median: 90000 }] });
const sq = (x, y, s) => [x, y, x + s, y, x + s, y + s, x, y + s, x, y];
J("brief_fp_testdist", { ll: [1, 0, 0, 0, 1, 0], b: [[42, 120, sq(55.15, 25.05, 0.001)], [43, 60, sq(55.152, 25.05, 0.001)], [44, 30, sq(55.15, 25.052, 0.001)]], s: [] });
J("pf_supply_testdist", { as_of: "2026-10-09", advertised: { as_of: "2026-10-09", buildings: { "creek-heights": { key: "testdist:42", bands: { "1": { flats: 3, adverts: 5, pmin: 95000, pmax: 120000 } } } } } });
const env = { MEETINGS: KV, READ_KEY: "owner_key_abcdefgh", CLIENT_KEY: "client_key_123456", PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
const call = (path) => worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev" + path), env, { waitUntil() {} });

// ------------------------------------------------------------------------------------------------ A - identity
console.log("A - which building: the project number, the name only as a cross-check, never a guess");
{
  const rows = salesDoc(SALES).rows;
  ok(pickBuilding(rows, { project: "2717", name: "Creek Heights" }).rows.length === 9, "the project number picks its own rows (nine, incl. the mortgage row)");
  const bad = pickBuilding(rows, { project: "2717", name: "Other Tower" });
  ok(!bad.rows.length && /not Other Tower/.test(bad.refused), "a number whose register name disagrees with the name: refused, nothing shown", bad.refused);
  ok(pickBuilding(rows, { project: "2717", name: "Creek Heights by Sobha" }).rows.length === 9, "the developer suffix ('by Sobha') does not count as a disagreement");
  ok(pickBuilding(rows, { project: "", name: "Creek Heights" }).rows.length === 9 && recKey("Creek Heights") === "dld:creekheights", "no number: the record key the file itself carries");
  const twin = pickBuilding(rows, { project: "", name: "Twin Name" });
  ok(!twin.rows.length && /2 different project numbers/.test(twin.refused), "a name carried by two project numbers: refused", twin.refused);
  ok(pickBuilding(rows, { project: "3002", name: "Twin Name" }).rows.length === 1, "with its number, one of the twins is found exactly");
}

// ------------------------------------------------------------------------------------------------ B - the figures
console.log("B - the figures: sales by bedroom, the five-priced rule, recent sales, value");
{
  const rows = pickBuilding(salesDoc(SALES).rows, { project: "2717" }).rows;
  const w12 = windowOf("l12", "2026-10-06", "2024-03-01"), wAll = windowOf("all", "2026-10-06", "2024-03-01");
  ok(w12.from === "2025-10-07" && w12.to === "2026-10-06" && /last 12 months/.test(w12.say) && /all years/.test(wAll.say), "the window: 365 days to the file's latest day, or every year");
  const S = salesFigures(rows, w12), A = salesFigures(rows, wAll);
  ok(S.n === 14 && A.n === 15, "count: 14 sales in 12 months (mortgage left out), 15 in all years", S.n + " / " + A.n);
  const b1 = S.bands.find((b) => b.band === "1"), b2 = S.bands.find((b) => b.band === "2"), b3 = S.bands.find((b) => b.band === "3");
  ok(b1.n === 6 && b1.price === 1459052 && b1.psf === Math.round(24650 / 10.7639), "1 bedroom: 6 priced sales, the middle price and price per sq ft", JSON.stringify(b1));
  ok(b2.n === 6 && b2.price === 2290540 && b2.psf != null, "2 bedrooms: six priced sales give a typical price", JSON.stringify(b2));
  ok(b3.n === 2 && b3.price === null && b3.psf === null, "3 bedrooms: no price recorded, so no typical price (never from fewer than five)");
  ok(S.value && S.value.big === 1 && S.value.sum === [1400000, 1450000, 1500000, 1420000, 1480000, 2381079, 2412776, 1468104, 2050000, 2100000, 2200000].reduce((a, b) => a + b, 0), "total value: the sum of the prices, the AED 600M deal left out and counted", JSON.stringify(S.value));
  ok(S.recent[0].date === "2026-10-05" && S.recent[0].price === null && S.recent.length === 14 && S.recent.every((r, i, a) => !i || a[i - 1].date >= r.date), "recent sales: newest first; a sale with no price says so");
  const one = S.recent.find((r) => r.price === 1468104), two = S.recent.find((r) => r.price === 2381079);
  ok(one.sqft === Math.round((1468104 / 25833) * 10.7639) && two.sqft === null, "a size only where the day's row holds one sale (prices and areas are sorted apart in the file)");
  ok(salesFigures(rows.concat(Array.from({ length: 30 }, (_, i) => Object.assign({}, rows[1], { date: "2026-02-" + String(i % 28 + 1).padStart(2, "0") }))), w12).recent.length === RECENT_MAX, "the recent list is capped at " + RECENT_MAX);
  const R = rentFigures([], w12);
  ok(R.n === 0 && !R.bands.length, "no rent contract: no rent figure");
  const R2 = rentFigures(ejariDoc({ rows: [{ date: "2026-09-01", beds: "1", contracts: 3, rent_median: 80000 }, { date: "2026-09-02", beds: "1", contracts: 3, rent_median: 90000 }, { date: "2026-09-02", beds: "2", contracts: 2, rent_median: 120000 }] }).rows, w12);
  ok(R2.bands[0].n === 6 && R2.bands[0].rent === 80000 && R2.bands[1].rent === null, "rents: contracts and the typical rent from five contracts; fewer gives none", JSON.stringify(R2.bands));
}

// ------------------------------------------------------------------------------------------------ C - the sheet
console.log("C - the sheet: page and PDF from one builder, owner-only adverts never in the PDF");
const P = (q) => parseParams(new URL("https://x/developers_pdf?kind=building&area=testdist&project=2717&name=Creek%20Heights&bk=42&" + q));
{
  __resetKvMemo();
  const L = await loadBuilding(env, P("window=12m&format=html"), { owner: true });
  ok(L.status === 200, "loads", JSON.stringify(L.body));
  const B = L.B;
  ok(B.name === "Creek Heights" && B.dev === "SOBHA L.L.C" && B.status === "Off-plan" && B.area === "Test Heartland" && B.projectNo === "2717", "header facts from the record: name, developer as the register gives it, off-plan, area");
  ok(B.tier >= 0 && B.areaPsm > 0, "placed in a price band against the area's typical");
  const page = buildingHtml(B, B.C.p).html, t = textOf(page);
  ok(/Advertised now \(Property Finder\)/.test(page) && /3 flats/.test(t) && /never added to it/.test(t), "owner, web page: the adverts by bedroom (flats, adverts, price range), never added to availability");
  ok(/class="smap" data-lat="25\.05\d+" data-lon="55\.15\d+"/.test(page) && /maplibre-gl@4\.7\.1/.test(page) && /data-fp='\{"c":\[\[55\.15/.test(page) && !/"distance"/.test(page) && /dark-matter-gl-style/.test(page) && /"#C5A56A"/.test(page) && /fill-extrusion/.test(page) && !/raster/.test(page), "web page: the live 3D street map (MapLibre 4.7.1, CARTO dark matter vector, the building in gold), no raster tiles");
  ok(/Sales in this building/.test(t) && /Recent sales, newest first/.test(t) && /Total value/.test(t) && /left out/.test(t) && /Where it sits in the area/.test(t), "every section is there");
  ok(/No rent contract is registered for this building: it is sold off-plan and not yet handed over/.test(t), "no rents: one honest line");
  ok(!EMOJI.test(page) && /<svg/.test(page), "icons, no emojis");
  ok(/Remember: adverts need the permit number/.test(t) && /listing broker/.test(t), "the house footer: permit reminder and the confirm-with-the-broker line");
  ok(!/\b(GPT|Claude|Gemini|OpenAI|Anthropic|DLD|OSM|PSF|AI)\b/.test(t), "no model named, no unexplained abbreviations");
  ok(/meta name="viewport"/.test(page) && /max-width:640px/.test(page), "phone: viewport and the narrow-screen rules");
  __resetKvMemo();
  const Lp = await loadBuilding(env, P("window=12m"), { owner: true });
  const pdf = buildingHtml(Lp.B, Lp.B.C.p).html;
  ok(!/Advertised now/.test(pdf) && !/Property Finder/.test(pdf) && !/maplibre/.test(pdf) && /<svg[^>]*aria-label="Creek Heights in gold/.test(pdf), "PDF: no adverts even for the owner; the map is the static digital-footprint drawing with the building in gold");
  __resetKvMemo();
  const Lc = await loadBuilding(env, P("window=12m&format=html"), { owner: false });
  ok(!/Advertised now/.test(buildingHtml(Lc.B, Lc.B.C.p).html), "client key, web page: no advert figure at all");
  __resetKvMemo();
  const Ln = await loadBuilding(env, parseParams(new URL("https://x/d?kind=building&area=testdist&project=2717&name=Creek%20Heights&window=all&format=html")), { owner: true });
  ok(/not tied to a building outline/.test(textOf(buildingHtml(Ln.B, Ln.B.C.p).html)) && !Ln.B.adv, "no footprint key: no map and no adverts (nothing bound by name)");
}

// ------------------------------------------------------------------------------------------------ D - the routes
console.log("D - the routes: /doc_broker?kind=building (choices) and /developers_pdf?kind=building");
{
  __resetKvMemo();
  const q = "kind=building&area=testdist&project=2717&name=Creek%20Heights&bk=42&window=12m";
  const r1 = await call("/doc_broker?" + q + "&key=client_key_123456");
  const h1 = await r1.text();
  ok(r1.status === 200 && /Building broker sheet: choose the version/.test(h1) && /Creek Heights in Test Heartland/.test(h1), "client key: the options page for the one building");
  const D = JSON.parse(/var D=(\{[\s\S]*?\}),I=/.exec(h1)[1]);
  ok(D.base === "/developers_pdf" && D.fixed.map((x) => x.join("=")).join("&") === "kind=building&area=testdist&project=2717&name=Creek Heights&bk=42", "Generate opens /developers_pdf?kind=building with the number, the name and the footprint", JSON.stringify(D.fixed));
  ok(!/Adverts \(owner only\)/.test(h1), "client: the options never mention adverts");
  __resetKvMemo();
  const h2 = await (await call("/doc_broker?" + q + "&key=owner_key_abcdefgh")).text();
  ok(/Adverts \(owner only\) appear here, never in the PDF/.test(h2), "owner: the web-page card says adverts appear there, never in the PDF");
  __resetKvMemo();
  const r3 = await call("/developers_pdf?" + q + "&format=html&key=client_key_123456"), h3 = await r3.text();
  ok(r3.status === 200 && /Sales in this building/.test(h3) && !/Advertised now/.test(h3), "client key: the web page renders, with no adverts");
  __resetKvMemo();
  const h4 = await (await call("/developers_pdf?" + q + "&format=html&key=owner_key_abcdefgh")).text();
  ok(/Advertised now/.test(h4), "owner key: the web page carries the adverts");
  __resetKvMemo();
  const r5 = await call("/developers_pdf?" + q + "&key=owner_key_abcdefgh");
  ok(r5.status === 503, "PDF without a Browser Rendering binding: the usual 503 (the route is the same as the area sheet's)");
  ok((await call("/developers_pdf?" + q + "&format=html")).status === 401 && (await call("/doc_broker?" + q)).status === 401, "no key: 401");
  __resetKvMemo();
  const r6 = await call("/doc_broker?kind=building&area=testdist&project=2717&name=Other%20Tower&key=client_key_123456");
  ok(r6.status === 409, "a number and a name that disagree: 409, never the wrong building");
  __resetKvMemo();
  const r7 = await (await call("/doc_broker?kind=snapshot&area=testdist&developers=sobha&key=client_key_123456")).text();
  ok(/Broker sheet: choose the version/.test(r7) && !/Building broker sheet/.test(r7), "the AREA sheet is unchanged on kind=snapshot");
}

// ------------------------------------------------------------------------------------------------ E - the real file, when it is on this computer (counts only)
const REAL = "C:/Dev/_rentsales396/data/sales_filed/sales_filed_sobhaheartland.json";
if (fs.existsSync(REAL)) {
  console.log("E - the real Sobha Heartland sales file (local copy): Sobha Creek Vistas Heights, project 2717");
  const sd = salesDoc(JSON.parse(fs.readFileSync(REAL, "utf8")));
  const rows = pickBuilding(sd.rows, { project: "2717", name: "Sobha Creek Vistas Heights" }).rows;
  const S12 = salesFigures(rows, windowOf("l12", sd.asOf, sd.first)), SA = salesFigures(rows, windowOf("all", sd.asOf, sd.first));
  console.log("    12 months: " + S12.n + " sales; by bedroom " + S12.bands.map((b) => b.label + " " + b.n + (b.price ? " (typical shown)" : "")).join(", ") + "; recent " + S12.recent.length + "; value deals over cap " + (S12.value && S12.value.big));
  console.log("    all years: " + SA.n + " sales; priced " + SA.priced + "; status " + SA.lastStage);
  ok(rows.length > 0 && S12.n > 0 && S12.bands.length > 0, "the real project is found by its number and its name agrees");
}
console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
