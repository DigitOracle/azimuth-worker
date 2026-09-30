// THE BRIEF part C - GET /brief_pdf (src/brief_docs.js) and the /brief_blocks view, through the real worker (index.js dispatch) with a
// stubbed KV and a stubbed Browser Rendering binding that records the HTML it is asked to print.
//
// What this proves:
//   1. the route is gated (no key 401, a client key opens it) and answers application/pdf with a filename
//   2. a dossier is exactly 3 pages; the footer is ONLY "Curated by Najjuko · Dubai Decoded" + the WhatsApp mark + +971 56 548 4397;
//      the header carries the Najjuko-with-the-N picture
//   3. the "left" box says "an estimate, not a count", with T - R rounded to ten (178 - 37 -> about 140), and when the registers cannot be
//      read for the building (coverage under half, as in JVC today) it says plainly there is no estimate yet - never a blank, never a zero
//   4. the map: an SVG block map with the building in gold where the layer and a position exist; "Map to follow" - never a broken
//      image - where the layer is missing or the building has no position
//   5. photos and amenities only from the developer's own page: a portal brochure is refused, a brochure naming another building is
//      refused, the pool_2 picture is never used, and no picture is linked that is not stored
//   6. one-sheet / compare = 2 pages (cards + map, landscape); pack = 2 + 3 per building + appendix; several keys on a dossier -> 400
//      with one link per building; buy mode 501; unknown key 404; no binding 503; a busy browser 429
//   7. no walking or driving times anywhere; the brochure-name hash agrees with scripts/push_brochures.py; /brief_blocks has no script
// NEGATIVE CONTROL (run by hand, see the commit message): mutate the footer or the estimate wording in src/brief_docs.js, or drop the
// dispatch line from src/index.js, and this file fails.
//
//   node test/test_brief_docs.mjs
import worker from "../src/index.js";
import { __setLauncher, fnv16, brochureKvName, isPortal, FOOTER_TEXT, WHATSAPP_NUMBER } from "../src/brief_docs.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 500) : "")); } };

// ---- KV ------------------------------------------------------------------------------------------------------------------------
const store = new Map();
const KV = {
  async get(k, t) {
    if (!store.has(k)) return null;
    const v = store.get(k);
    if (t === "arrayBuffer") return typeof v === "string" ? new TextEncoder().encode(v).buffer : v;
    return typeof v === "string" ? v : new TextDecoder().decode(v);
  },
  async put(k, v) { store.set(k, v); writes.push(k); },
  async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter((k) => k.startsWith(p)).map((name) => ({ name })) }; },
};
let writes = [];
const J = (k, o) => store.set("img_" + k, JSON.stringify(o));
const BIN = (k, bytes, ct) => { store.set("img_" + k, new Uint8Array(bytes).buffer); store.set("img_ct_" + k, ct); };
const st = (n, m, q1, q3, s, last) => ({ n, nn: n, nr: 0, m, q1, q3, s, last });

J("rent_index", { as_of: "2026-09-30", source_file: "rents-test.csv", items: [
  { p: "alphatower", n: "Alpha Tower", d: "testdistrict", i: 10, lon: 55.2, lat: 25.05, area: "Al Test Fourth", last: "2026-09-30", b: { "1": st(16, 65000, 60000, 70500, 59.1, "2026-09-30") } },
  { p: "betaheights", n: "BETA HEIGHTS", a: ["GAMMA VIEWS"], d: "testdistrict", area: "Al Test Fourth", b: { "1": st(9, 64000, 62000, 66000, 60, "2026-09-20") } },
  { p: "deltacourt", n: "Delta Court", d: "testdistrict", i: 11, lon: 55.201, lat: 25.051, area: "Al Test Fourth", b: { "1": st(5, 90000, 85000, 95000, 70, "2026-09-10") } },
  { p: "portalhouse", n: "Portal House", d: "testdistrict", i: 12, lon: 55.202, lat: 25.052, area: "Al Test Fourth", b: { "1": st(7, 63000, 61000, 65000, 58, "2026-09-11") } },
  { p: "otherplace", n: "Other Place", d: "nolayer", i: 5, lon: 55.3, lat: 25.1, area: "Elsewhere", b: { "1": st(4, 61000, 60000, 62000, 55, "2026-09-12") } },
] });
J("districts_geo", { districts: [{ slug: "testdistrict", name: "Test District" }, { slug: "nolayer", name: "No Layer Town" }] });
J("amenities", { items: [
  { k: "metro", n: "Test Metro Station", lat: 25.059, lon: 55.2 },
  { k: "school", n: "Test International School L.L.C", x: "Very good · British", lat: 25.0511, lon: 55.2013 },
  { k: "clinic", n: "TEST FAMILY CLINIC", lat: 25.0522, lon: 55.2031 },
  { k: "clinic", n: "Rough Point Clinic", lat: 25.05, lon: 55.2, ap: 1 },
] });
J("unitmix_testdistrict", { buildings_by_id: {
  "10": { name: "Alpha Tower", total_units: 211, floors: 21, as_of: "2026-09-29", dld: { buildings: 1 }, rows: [{ type: "1 bedroom", units: 178, basis: "DLD units register", median_sqm: 59.5, levels: "1–15" }, { type: "2 bedroom", units: 30, basis: "DLD units register" }] },
  "11": { name: "Delta Court B", total_units: 944, floors: 45, dld: { buildings: 3 }, rows: [{ type: "1 bedroom", units: 400, basis: "DLD units register" }] },
} });
J("tenancy_testdistrict", { as_at: "2026-09-09", coverage: { share_bound: 0.6 }, buildings_by_id: {
  "10": { live: 45, by_type: { "1 bedroom": 37, "2 bedroom": 7 }, scope: "building", as_at: "2026-09-09" },
  "11": { live: 90, by_type: { "1 bedroom": 88 }, scope: "building", as_at: "2026-09-09" },
} });
J("units_testdistrict", { buildings_by_id: { "10": { floors: {
  "1": [{ c: "1", sqft: 700, bal: 100 }, { c: "1", sqft: 701, bal: 100 }, { c: "2", sqft: 1200, bal: 200 }],
  "2": [{ c: "1", sqft: 700, bal: 100 }, { c: "1", sqft: 640, bal: 85 }],
  "3": [{ c: "1", sqft: 640, bal: 85 }, { c: "studio", sqft: 400, bal: 0 }] } } } });
J("unitmix_nolayer", { buildings_by_id: { "5": { name: "Other Place", total_units: 80, floors: 7, dld: { buildings: 1 }, rows: [{ type: "1 bedroom", units: 60, basis: "DLD units register" }] } } });
J("tenancy_nolayer", { as_at: "2026-09-09", coverage: { share_bound: 0.3 }, buildings_by_id: { "5": { by_type: { "1 bedroom": 20 }, scope: "building" } } });
// the district layer: local metres; ll maps lon/lat onto it (x = (lon - 55.19) * 1e5, y = (lat - 25.04) * 1.1e5)
const sq = (cx, cy, s) => [cx - s, cy - s, cx + s, cy - s, cx + s, cy + s, cx - s, cy + s, cx - s, cy - s];
J("brief_fp_testdistrict", { d: "testdistrict", v: 1, o: [0, 0], ll: [100000, 0, -5519000, 0, 110000, -2754400],
  b: [[10, 68, sq(1000, 1100, 20)], [11, 150, sq(1100, 1210, 25)], [12, 30, sq(1200, 1320, 15)], [99, 12, sq(700, 900, 10)], [98, 20, sq(1400, 1500, 12)]],
  s: [[9, [500, 800, 1600, 1600]], [0, [600, 1400, 1500, 900]]], rp: [], lab: [["Test Road", [600, 900, 1000, 1200, 1500, 1500]]] });
// brochures: the developer's own page for Alpha; Beta by name; a portal one; one that names another building
J(brochureKvName("testdistrict_10"), { name: "Alpha Tower", developer: "Alpha Developments", source_url: "https://alphadev.example/alpha-tower", retrieved: "2026-09-30",
  amenities: ["Gym", "Swimming pool", "Kids' play area"], photos: [
    { file: "exterior.jpg", key: "bph_alpha_ext", caption: "Alpha Tower - developer's render", page_url: "https://alphadev.example/alpha-tower" },
    { file: "pool.jpg", key: "bph_alpha_pool", caption: "Alpha Tower - Pool deck", page_url: "https://alphadev.example/alpha-tower" },
    { file: "pool_2.jpg", key: "bph_alpha_pool2", caption: "Pool with the developer's name in the mosaic" },
    { file: "gym.jpg", key: "bph_alpha_gym_not_stored", caption: "Gym" }] });
BIN("bph_alpha_ext", [0xff, 0xd8, 0xff, 1, 2, 3], "image/jpeg");
BIN("bph_alpha_pool", [0xff, 0xd8, 0xff, 4, 5, 6], "image/jpeg");
BIN("bph_alpha_pool2", [0xff, 0xd8, 0xff, 7, 8, 9], "image/jpeg");
J(brochureKvName("name_beta_heights"), { name: "Beta Heights", developer: "Beta Properties", source_url: "https://beta.example/", amenities: ["Pool"], photos: [] });
J(brochureKvName("testdistrict_12"), { name: "Portal House", developer: "X", source_url: "https://www.bayut.com/property/details-123.html", amenities: ["Pool"], photos: [{ file: "exterior.jpg", key: "bph_portal" }] });
BIN("bph_portal", [0xff, 0xd8, 0xff, 1], "image/jpeg");
J(brochureKvName("testdistrict_11"), { name: "Somewhere Else Entirely", developer: "Y", source_url: "https://y.example/", amenities: ["Sauna"], photos: [{ file: "exterior.jpg", key: "bph_wrong" }] });
BIN("bph_wrong", [0xff, 0xd8, 0xff, 2], "image/jpeg");
BIN("brand_najjuko_n", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a], "image/png");

// ---- the browser stub ------------------------------------------------------------------------------------------------------------
let printed = [], launchError = null;
__setLauncher(async () => {
  if (launchError) throw new Error(launchError);
  return { async newPage() { return { async setViewport() {}, async setContent(h) { printed.push(h); }, async evaluate() { return true; },
    async pdf(o) { printed.opts = o; return new TextEncoder().encode("%PDF-1.7 stub"); } }; }, async close() {} };
});

const READ = "read_key_for_the_owner_1234567890", CLIENT = "client_key_in_links_12345";
const ORIGIN = "https://azimuth-2.digitalchemy.workers.dev";
const env = { MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: CLIENT, INGEST_TOKEN: "ING", PUBLIC_ORIGIN: ORIGIN, BROWSER: { fetch() {} } };
globalThis.fetch = async () => new Response("{}", { status: 200 });
const call = (p, e) => worker.fetch(new Request(ORIGIN + p), e || env, { waitUntil() {} });
const Q = "&mode=rent&beds=1&min=60000&max=65000";
const pages = (h) => (h.match(/class="sheet page/g) || []).length;
async function pdf(qs, e) { printed = []; const r = await call("/brief_pdf?" + qs + Q + "&key=" + CLIENT, e); return { r, html: printed[0] || "" }; }
const TIME_RX = /\b\d+\s*(?:min|mins|minute|minutes|hour|hours)\b/i;   // the house rule (build_client_sheet TIME_CLAIM_RX): no time claim with a number

// ---- 1. gate, type, filename ---------------------------------------------------------------------------------------------------
ok((await call("/brief_pdf?kind=dossier&keys=testdistrict:10")).status === 401, "no key -> 401");
ok((await call("/brief_pdf?kind=dossier&keys=testdistrict:10&key=wrong_key_000000000")).status === 401, "a wrong key -> 401");
let { r, html } = await pdf("kind=dossier&keys=testdistrict:10&num=4&of=10");
ok(r.status === 200 && r.headers.get("Content-Type") === "application/pdf", "a client key opens a dossier: 200 application/pdf", r.status + " " + (await r.clone().text()).slice(0, 200));
ok(/filename="04_Alpha_Tower_1BR\.pdf"/.test(r.headers.get("Content-Disposition") || ""), "the file is named like the approved ones (04_Alpha_Tower_1BR.pdf)", r.headers.get("Content-Disposition"));
ok((await r.text()).startsWith("%PDF"), "the body is the renderer's PDF");
ok(printed.opts && printed.opts.preferCSSPageSize === true && printed.opts.printBackground === true, "printed at the CSS page size with backgrounds");
ok((await call("/brief_pdf?kind=dossier&keys=testdistrict:10" + Q + "&key=" + READ)).status === 200, "the owner key opens it too");

// ---- 2. the dossier: pages, header, footer ---------------------------------------------------------------------------------------
ok(pages(html) === 3, "a dossier is exactly 3 pages", pages(html));
const foot = FOOTER_TEXT + " <svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" aria-label=\"WhatsApp\"";
ok(FOOTER_TEXT === "Curated by Najjuko &middot; Dubai Decoded" && WHATSAPP_NUMBER === "+971 56 548 4397", "the footer constants are Kendall's words and number");
ok((html.split(foot).length - 1) === 3 && (html.split("</svg> +971 56 548 4397</div>").length - 1) >= 3, "every page ends with the curator line: text + WhatsApp mark + +971 56 548 4397");
const curators = [...html.matchAll(/<div class="curator"[^>]*>([\s\S]*?)<\/div>/g)].map((m) => m[1].replace(/<svg[\s\S]*?<\/svg>/, "[WA]"));
ok(curators.length === 3 && curators.every((c) => c === "Curated by Najjuko &middot; Dubai Decoded [WA] +971 56 548 4397"), "the footer line carries nothing else", JSON.stringify(curators.slice(0, 2)));
ok(!/digitalabbot|contact@|\+971 58|\+971 56 227/i.test(html), "no other contact detail anywhere (no company email, no 58 number)");
ok((html.match(/<img class="najhead" src="https:\/\/azimuth-2\.digitalchemy\.workers\.dev\/img\/brand_najjuko_n" alt="Najma" style="height:112px/g) || []).length === 3, "each page's header carries the Najjuko-with-the-N picture at 112 px");
ok(html.includes("OPTION 4 OF 10 &middot; ONE BEDROOM &middot; TEST DISTRICT"), "the header line reads OPTION 4 OF 10 · ONE BEDROOM · TEST DISTRICT");

// ---- 3. page 1 figures ----------------------------------------------------------------------------------------------------------
ok(html.includes("AED 65,000</div>") && html.includes("AED 60,000 &ndash; 70,500") && html.includes(">16</div>"), "typical rent, middle half and lettings come from the rent index");
ok(html.includes("What AED 65,000 gets you here.</b> AED 65,000 a year is right at the typical rent here: at least half of the 16 one-bedroom flats"), "the budget line is worded from the quartiles, not invented counts");
ok(html.includes("Nearest metro: Test, 1.0 km") && /Dubai Marina: \d+\.\d km/.test(html) && html.includes("All straight-line distances"), "distances are straight lines from the building's position");
ok(html.includes("Test International School (Very good,") && html.includes("Test Family Clinic (") && !html.includes("Rough Point Clinic"), "nearby: KHDA rating kept, capitals softened, an approximate-position clinic left out");
ok(!TIME_RX.test(html.replace(/<svg[\s\S]*?<\/svg>/g, "")), "no walking or driving times anywhere");
ok(!html.includes(">COMPLETED<"), "the brochure has no 'completed': no COMPLETED line (never invented)");
ok(html.includes(">RECENT LETTINGS</div>"), "the lettings count is labelled RECENT LETTINGS, as in the approved JVC pack");
{
  const k = "img_" + brochureKvName("testdistrict_10"), orig = store.get(k);
  store.set(k, JSON.stringify(Object.assign(JSON.parse(orig), { completed: "2021" })));
  const h2 = (await pdf("kind=dossier&keys=testdistrict:10")).html;
  ok(/>COMPLETED<\/div><div[^>]*>2021<\/div>/.test(h2), "with brochure.json 'completed': 2021, the COMPLETED line reads 2021");
  store.set(k, orig);
}

// ---- 4. the estimate box -------------------------------------------------------------------------------------------------------
const box = (h) => { const m = /<div class="leftbox"[\s\S]*?<\/div><\/div>/.exec(h); return m ? m[0] : ""; };
const b1 = box(html);
ok(/ESTIMATED ONE-BEDROOMS LEFT/.test(b1) && /about 140<\/span>/.test(b1) && /of 178 one-bedroom flats/.test(b1), "the box reads ESTIMATED ONE-BEDROOMS LEFT: about 140 of 178 (178 - 37, rounded to ten)", b1.slice(0, 300));
ok(/An estimate, not a count\./.test(b1) && /owners living in their own flat and renewals not yet registered/.test(b1) && !/flats available|available flats|units available/i.test(html), "labelled an estimate, not a count; never stated as flats available");
ok(/rounded to the nearest ten/.test(html) && /is a minimum/.test(html), "the small print says how it is rounded and that the running count is a minimum");
({ html } = await pdf("kind=dossier&keys=nolayer:5"));
const b2 = box(html);
ok(/No estimate yet for this building/.test(b2) && /only 30% of this district&#x27;s running tenancies reach a building/.test(b2) && /estimate, not a count/.test(b2) && !/about \d/.test(b2), "coverage under half (JVC today): the box says plainly there is no estimate yet - no figure, no zero", b2.slice(0, 300));
({ html } = await pdf("kind=dossier&keys=testdistrict:11"));
ok(/No estimate yet/.test(box(html)) && /covers 3 buildings/.test(box(html)), "a units record covering 3 buildings is never divided");
ok(html.includes("45 floors (one of 3 buildings)") && html.includes("944 homes in 3 buildings") && !html.includes("Delta Court B"), "a tower record of a multi-building project: floors and homes say so, and its own name ('... B') is never printed");

// ---- 5. the map -----------------------------------------------------------------------------------------------------------------
({ html } = await pdf("kind=dossier&keys=testdistrict:10"));
ok(/<svg style="width:700px;height:auto;display:block;" xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 1500 1000"/.test(html), "page 2 carries the LOD 100 block map as inline SVG (no picture to break)");
ok((html.match(/class="hiblock"/g) || []).length === 2 && html.includes("Alpha Tower · where it is in Test District") && !html.includes("Map to follow"), "the building is drawn in gold (walls + roof) with its own title; no 'Map to follow'");
ok(/fill="#C5A56A"/.test(html) && /fill="#E9E9E4"/.test(html) && /<g class="badge">/.test(html) && />N<\/text>/.test(html) && />500 m<\/text>/.test(html), "the approved palette, a numbered badge, a north arrow and a scale bar");
({ html } = await pdf("kind=dossier&keys=dld:betaheights"));
ok(html.includes("Map to follow") && !/<svg[^>]*viewBox="0 0 1500 1000"/.test(html) && html.includes("this building has no verified map position yet"), "no position on record -> 'Map to follow', never a guessed pin");
ok(html.includes("Distances not shown: our map position for this building is not yet verified"), "and no distances are measured from nowhere");
({ html } = await pdf("kind=dossier&keys=nolayer:5"));
ok(html.includes("Map to follow") && html.includes("the district map layer is not yet published") && !/<img[^>]+src="[^"]*brief_fp/.test(html), "no district layer -> 'Map to follow', never a broken image");

// ---- 6. photos: the developer's own page only ------------------------------------------------------------------------------------
({ html } = await pdf("kind=dossier&keys=testdistrict:10"));
ok(html.includes(ORIGIN + "/img/bph_alpha_ext") && html.includes(ORIGIN + "/img/bph_alpha_pool"), "the hero and the pool picture come from the published brochure");
ok(!html.includes("bph_alpha_pool2") && !html.includes("bph_alpha_gym_not_stored"), "pool_2 is never used, and a picture that is not stored is not linked (no broken image)");
ok(html.includes("alphadev.example") && html.includes("Pictures and amenities: the developer's own project page, https://alphadev.example/alpha-tower"), "each picture is credited, and the small print names the developer's page");
({ html } = await pdf("kind=dossier&keys=testdistrict:12"));
ok(!html.includes("bph_portal") && html.includes("the brochure&#x27;s source is a listing portal") && html.includes("Photos to follow"), "a brochure from a listing portal is refused whole");
({ html } = await pdf("kind=dossier&keys=testdistrict:11"));
ok(!html.includes("bph_wrong") && !html.includes("Sauna") && html.includes("the brochure is for Somewhere Else Entirely, not Delta Court"), "a brochure naming another building is refused (the name must agree with the record)");
({ html } = await pdf("kind=dossier&keys=dld:beta-heights"));
ok(html.includes(">Beta Heights</div>") && html.includes("also filed as &ldquo;Gamma Views&rdquo;"), "a dld: key resolves by name; the brochure found by name agrees; the other filing name is said");
ok(isPortal("https://www.propertyfinder.ae/en/plp/1") && isPortal("https://www.bayut.com/x") && !isPortal("https://www.binghatti.com/en/projects/binghatti-nova"), "the portal rule");

// ---- 7. one-sheet, compare, pack -----------------------------------------------------------------------------------------------
const KEYS = "testdistrict:10,dld:betaheights,testdistrict:12";
for (const kind of ["onesheet", "compare"]) {
  ({ r, html } = await pdf("kind=" + kind + "&keys=" + KEYS));
  ok(r.status === 200 && pages(html) === 2 && (html.match(/class="sheet page land"/g) || []).length === 2, kind + ": 2 landscape pages (cards, then the overall map)", pages(html));
  ok((html.match(/class="bcard"/g) || []).length === 3 && html.includes("Three one-bedroom options in Test District, AED 60,000&ndash;65,000 a year"), kind + ": one card per building under the approved title");
  ok(html.includes("@page land { size: A4 landscape; margin: 0; }") && (html.match(/<div class="curator"/g) || []).length === 2, kind + ": A4 landscape, the curator line on both pages");
  ok(/<img class="najhead" src="[^"]+brand_najjuko_n" alt="Najma" style="height:68px/.test(html), kind + ": the one-sheet header picture is 68 px");
}
ok(html.includes("Beta Heights  (no map position yet)") && (html.match(/<g class="badge">/g) || []).length === 2, "the overall map numbers the placed buildings and lists the unplaced one as such");
({ r, html } = await pdf("kind=pack&keys=" + KEYS));
ok(r.status === 200 && pages(html) === 2 + 3 * 3 + 1, "pack: one-sheet (2) + three dossiers (9) + the appendix (1) = 12 pages", pages(html));
ok(html.includes("Appendix &mdash; every building this brief matches") && html.includes("Portal House") && !/<td[^>]*>Delta Court/.test(html), "the appendix lists every matched building, and not one outside the budget");
ok(html.includes("OPTION 2 OF 3 &middot; ONE BEDROOM"), "pack dossiers are numbered as on the one-sheet");

// ---- 8. refusals ----------------------------------------------------------------------------------------------------------------
({ r } = await pdf("kind=dossier&keys=testdistrict:10,dld:betaheights"));
const multi = await r.json();
ok(r.status === 400 && multi.dossiers && multi.dossiers.length === 2 && /keys=testdistrict%3A10/.test(multi.dossiers[0].url) && /num=2&of=2/.test(multi.dossiers[1].url), "several keys on a dossier -> 400 with one link per building", JSON.stringify(multi).slice(0, 300));
ok((await pdf("kind=dossier&keys=testdistrict:777")).r.status === 404, "a key the rent index does not know -> 404");
printed = []; ok((await call("/brief_pdf?kind=dossier&keys=testdistrict:10&mode=buy&key=" + CLIENT)).status === 501 && !printed.length, "buy mode -> 501 (not built yet), nothing rendered");
ok((await pdf("kind=poster&keys=testdistrict:10")).r.status === 400, "an unknown kind -> 400");
ok((await call("/brief_pdf?kind=dossier&keys=testdistrict:10&key=" + CLIENT, Object.assign({}, env, { BROWSER: undefined }))).status === 503, "no Browser Rendering binding -> 503");
launchError = "Unable to create new browser: code: 429: message: Too many browsers already running";
ok((await pdf("kind=dossier&keys=testdistrict:10")).r.status === 429, "the browser is busy -> 429");
launchError = null;
const h = await call("/brief_pdf?kind=dossier&keys=testdistrict:10&format=html" + Q + "&key=" + CLIENT);
ok(h.status === 200 && /text\/html/.test(h.headers.get("Content-Type")) && h.headers.get("X-Brief-Pages") === "3", "format=html returns the same document as HTML (3 pages)");
writes = [];
await pdf("kind=pack&keys=" + KEYS);
ok(writes.length === 0, "rendering writes nothing to KV");

// ---- 9. the header picture missing: a wordmark, never a broken image ---------------------------------------------------------------
const hdr = store.get("img_ct_brand_najjuko_n"); store.delete("img_ct_brand_najjuko_n");
({ html } = await pdf("kind=dossier&keys=testdistrict:10"));
ok(!html.includes("brand_najjuko_n") && html.includes('color:#A8814A;">Najma</div>'), "no header picture stored -> a Najma wordmark, not a broken image");
store.set("img_ct_brand_najjuko_n", hdr);

// ---- 10. the blocks view is the same component -----------------------------------------------------------------------------------
const bv = await call("/brief_blocks?keys=testdistrict:10,testdistrict:11&beds=1&max=65000&key=" + CLIENT);
const bvh = await bv.text();
ok(bv.status === 200 && /viewBox="0 0 1500 1000"/.test(bvh) && (bvh.match(/<g class="badge">/g) || []).length === 2 && !/<script/i.test(bvh), "/brief_blocks draws the same SVG map for the chosen buildings, with no script to fail on a phone");
const bd = await (await call("/brief_blocks?d=testdistrict&key=" + CLIENT)).text();
ok(bd.includes("every building as a simple block") && !bd.includes('class="hiblock"'), "/brief_blocks?d= draws the district alone");
ok((await call("/brief_blocks?d=testdistrict")).status === 401, "/brief_blocks is gated like the rest");
ok((await (await call("/brief_blocks?d=nolayer&key=" + CLIENT)).text()).includes("Map to follow"), "/brief_blocks without a layer -> 'Map to follow'");

// ---- 11. the brochure names agree with scripts/push_brochures.py ---------------------------------------------------------------------
ok(fnv16("jumeirahvillagecircle_1490/exterior.jpg") === "128f5165764ff4ce", "fnv16 matches push_brochures.py (value computed by the Python script)");
ok(brochureKvName("jumeirahvillagecircle_1490") === "brochure_jumeirahvillagecircle_1490" && brochureKvName("name_binghatti_amber") === "brochure_name_binghatti_amber", "short brochure names are stored as img_brochure_<dir>, the names Contract A reads");
ok(brochureKvName("name_a_very_long_building_name_that_overflows_forty") === "brochure_h209e7dce9131fa21", "a name over the 40-character ingest cap becomes a hash, not a truncation");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
