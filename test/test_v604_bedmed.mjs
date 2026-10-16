// v604 - TYPICAL PRICES BY BEDROOM (median sale price and new-contract rent, 1-3 bed flats) in the right panel of the Developers-by-area page.
// Offline: the module's own script is evaluated, the route is called with a fake KV, the page text is checked for its wiring. No network, no KV, no deploy.
//   node test/test_v604_bedmed.mjs
import { devmapHtml, devmapRoutes } from "../src/devmap_page.js";
import { BEDMED_JS, BEDMED_CSS, BEDMED_KV_NAME, cleanBedmed } from "../src/devmap_bedmed.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };
const EMOJI = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const strip = (h) => String(h).replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

const cell = (n, median, extra) => Object.assign({ n, median, thin: n < 30 }, extra || {});
const FIX = {
  v: 1, built: "2026-10-16", min_n: 10, thin_n: 30,
  windows: { sale: { l12: ["2025-10-13", "2026-10-13"], all_to: "2026-10-13" }, rent: { l12: ["2025-10-10", "2026-10-10"], all_to: "2026-10-10" } },
  centres: {
    2: { l12: { sale: { 1: cell(9484, 1899282, { ready: cell(4000, 1700000), offplan: cell(5000, 2100000) }), 2: cell(6261, 3005834), 3: null }, rent: { 1: cell(16238, 90000), 2: cell(10848, 140000), 3: cell(12, 210000) } },
         all: { sale: { 1: cell(50000, 1500000) }, rent: { 1: cell(90000, 80000) } } },
    4: { l12: { sale: {}, rent: {} } },
  },
  areas: { businessbay: { l12: { sale: { 2: cell(1578, 3055744) }, rent: { 2: cell(2534, 135000) } } }, jumeirahisland: { l12: { sale: { 2: null }, rent: {} } } },
  city: { l12: { sale: { 1: cell(58053, 1252746), 2: cell(31975, 2214000), 3: cell(7613, 3950000) }, rent: { 1: cell(97342, 67000), 2: cell(59359, 95000), 3: cell(12750, 150190) } } },
};

console.log("A - the shape check (cleanBedmed)");
ok(BEDMED_KV_NAME === "devmap_bedmed", "reads KV img_devmap_bedmed through kvJson");
ok(cleanBedmed(FIX) === FIX, "the built file's shape passes");
ok([null, 5, "x", {}, { v: 2 }, { v: 1, centres: {}, areas: {}, city: {} }, { v: 1, centres: {}, areas: {}, windows: FIX.windows }].every((x) => cleanBedmed(x) === null), "anything else is treated as absent");

console.log("B - the boxes (BEDMED.boxes)");
const B = new Function(BEDMED_JS + "; return BEDMED;")();
ok(B.boxes("city", "", "l12", "All of Dubai") === "" && !B.has(), "no data loaded: no boxes");
ok(B.load(FIX) && B.has() && !B.load({ v: 9 }) && !B.has(), "load accepts the built shape and drops a bad one");
B.load(FIX);
const centre = B.boxes("centre", "2", "l12", "Centre 2: Downtown and Business Bay");
const t = strip(centre);
ok(/Typical prices: 1, 2 and 3 bedroom flats/.test(t) && /Centre 2: Downtown and Business Bay/.test(t), "centre boxes carry a heading and the centre's name");
ok(/last 12 months \(sales to 13 Oct 2026, rents to 10 Oct 2026\)/.test(t), "the window is in words with each data set's own date");
ok(/AED 3\.01M/.test(t) && /AED 140,000/.test(t) && /AED 1\.9M/.test(t), "sale in millions, rent in full dirhams", t);
ok(/ready 1\.7M\s+off-plan 2\.1M\s+9,484 sales/.test(t), "ready and off-plan medians shown where both exist, with the count behind the figure");
ok((centre.match(/class="bmb bmno"/g) || []).length === 1 && /No figure/.test(t) && /under 10 sales/.test(t), "a withheld figure says so (3 bed sale): no number, never zero");
ok(/12 contracts, few/.test(t), "under 30 rows is flagged few");
ok((centre.match(/class=bmb>|class="bmb"/g) || []).length + (centre.match(/bmno/g) || []).length === 6, "six boxes: 1, 2 and 3 bedroom, buy and rent");
ok(/Buy: median registered price/.test(t) && /Rent: median a year, new contracts/.test(t) && /not asking prices/.test(t) && /renewals left out/.test(t), "buy and rent are labelled and the basis is stated");
ok(/our grouping, not the plan/.test(t), "a centre says it is our grouping");
const area = B.boxes("area", "businessbay", "l12", "Business Bay");
ok(/AED 3\.06M/.test(strip(area)) && /AED 135,000/.test(strip(area)) && /2,534 contracts/.test(strip(area)), "an area's own figures", strip(area));
const none = B.boxes("area", "jumeirahisland", "l12", "Jumeirah Island");
ok(/Fewer than 10 registered sales or new rent contracts/.test(strip(none)) && !/bmg/.test(none), "an area with no figure says why instead of six empty boxes");
ok(/Fewer than 10/.test(strip(B.boxes("area", "nowhere", "l12", "Nowhere"))), "an unknown area key is the same message, not a crash");
const allY = strip(B.boxes("centre", "2", "all", "Centre 2"));
ok(/all years \(sales to 13 Oct 2026, rents to 10 Oct 2026\)/.test(allY) && /AED 1\.5M/.test(allY), "the all-years window reads the all-years figures");
ok(B.boxes("centre", "4", "l12", "Centre 4").includes("Fewer than 10"), "a centre with nothing says so");
ok(/All of Dubai/.test(strip(B.boxes("city", "", "l12", "All of Dubai"))) && /AED 2\.21M/.test(strip(B.boxes("city", "", "l12", "All of Dubai"))) && /AED 95,000/.test(strip(B.boxes("city", "", "l12", "All of Dubai"))), "all of Dubai");
ok(B.boxes("centre", "2", "l12", "x", "bmside").includes("bmcard bmside") && !centre.includes("bmside"), "the narrow-screen copy carries the bmside class, the right-panel copy does not");
ok(B.boxes("area", "businessbay", "l12", "<b>x</b>").includes("&lt;b&gt;x&lt;/b&gt;"), "names are escaped");

console.log("C - the route (what=bedmed)");
const store = {};
const env = { MEETINGS: { async get(k) { return store[k] == null ? null : JSON.stringify(store[k]); } } };
const deps = { clientOk: () => true, najNav: () => "", NAJ_NAV_CSS: "", NAJ_FONTS: "" };
const callR = async (what) => { const u = "https://x/developers_map_api?what=" + what + "&key=k"; const r = await devmapRoutes(new Request(u), env, new URL(u), deps); return { status: r.status, body: await r.json() }; };
let r0 = await callR("bedmed");
ok(r0.status === 200 && JSON.stringify(r0.body) === "{}", "not on file: {} with status 200 (the page shows no boxes)");
store.img_devmap_bedmed = FIX; r0 = await callR("bedmed");
ok(r0.status === 200 && r0.body.v === 1 && r0.body.centres["2"].l12.rent["2"].median === 140000, "on file: the whole value");
store.img_devmap_bedmed = { v: 1, centres: [] }; r0 = await callR("bedmed");
ok(r0.status === 200 && JSON.stringify(r0.body) === "{}", "malformed: {}");

console.log("D - the page");
const html = devmapHtml("k", deps);
ok(html.includes("var BEDMED=(function(){") && html.includes('api("bedmed")') && html.includes("BEDMED.load(r[14])"), "the page carries the module, asks for what=bedmed and loads it");
ok(html.includes('BEDMED.boxes("area",slug,S.win,area.name)') && html.includes('BEDMED.boxes("centre",String(e.id),S.win,"Centre "+e.id+": "+e.name,"bmside")') && html.includes("function bedHtml()"), "boxes under an area, for the chosen centre (with the narrow-screen copy) and for all of Dubai");
ok(html.includes(".bmcard.bmside{display:none}") && html.includes("@media(max-width:1100px){.bmcard.bmside{display:block}}"), "the left-sheet copy shows only where the right panel is hidden (1100 px)");
ok(!BEDMED_JS.includes("`") && !BEDMED_JS.includes("${") && !BEDMED_CSS.includes("`"), "no backticks or substitutions in the injected text (the page's String.raw rule)");
ok(!EMOJI.test(BEDMED_JS) && !EMOJI.test(BEDMED_CSS), "no emoji");
const px = [...BEDMED_CSS.matchAll(/(?:^|[;{\s])(?:min-)?width:\s*(\d+)px/g)].map((m) => Number(m[1]));
ok(px.every((n) => n <= 375), "no fixed width over 375 px in the new styles", px.join());
ok(/@media\(max-width:360px\)\{\.bmg\{grid-template-columns:1fr\}\}/.test(BEDMED_CSS), "very narrow phones: one box across");

console.log(fail ? "\n" + fail + " FAILED, " + pass + " passed" : "\nall " + pass + " passed");
process.exit(fail ? 1 : 0);
