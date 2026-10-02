// THE BRIEF part C - GET /brief_pdf (src/brief_docs.js) and the /brief_blocks view, through the real worker (index.js dispatch) with a
// stubbed KV and a stubbed Browser Rendering binding that records the HTML it is asked to print.
//
// What this proves:
//   1. the route is gated (no key 401, a client key opens it) and answers application/pdf with a filename
//   2. a dossier is exactly 3 pages; the footer is ONLY "Curated by Najjuko · Dubai Decoded" + the WhatsApp mark + +971 56 548 4397;
//      the header carries the Najjuko-with-the-N picture
//   3. v277: the register "left" estimate is NOT on the document (no ESTIMATED ... LEFT box, no "Still filling" card line). Page 2 carries
//      DEVELOPER AVAILABILITY where a developer's own sheet names the building (named, dated, the rows of that type) and nothing where none
//      does; beds=all renders every home type (figures per type, the layouts across types); a key the rent index lacks but the unit-mix
//      register holds still builds (the building page's dossier)
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
import { __resetKvMemo } from "../src/brief.js";
import { __setLauncher, fnv16, brochureKvName, isPortal, FOOTER_TEXT, WHATSAPP_NUMBER } from "../src/brief_docs.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 500) : "")); } };

// ---- KV ------------------------------------------------------------------------------------------------------------------------
// v292 - the search keeps what it reads in a per-isolate memo (src/brief.js kvJsonMemo); this test swaps stored values in place
// between requests, so a write here drops the memo (live, a new value is read within KV_MEMO_TTL_MS).
const store = new (class extends Map { set(k, v) { __resetKvMemo(); return super.set(k, v); } delete(k) { __resetKvMemo(); return super.delete(k); } })();
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
J("districts_geo", { districts: [{ slug: "testdistrict", name: "Test District", bbox: [55.19, 25.04, 55.21, 25.06] }, { slug: "nolayer", name: "No Layer Town" }] });
J("amenities", { items: [
  { k: "metro", n: "Test Metro Station", lat: 25.059, lon: 55.2 },
  { k: "school", n: "Test International School L.L.C", x: "Very good · British", lat: 25.0511, lon: 55.2013 },
  { k: "clinic", n: "TEST FAMILY CLINIC", lat: 25.0522, lon: 55.2031 },
  { k: "clinic", n: "Rough Point Clinic", lat: 25.05, lon: 55.2, ap: 1 },
] });
J("unitmix_testdistrict", { buildings_by_id: {
  "10": { name: "Alpha Tower", total_units: 211, floors: 21, as_of: "2026-09-29", dld: { buildings: 1 }, rows: [{ type: "1 bedroom", units: 178, basis: "DLD units register", median_sqm: 59.5, levels: "1–15" }, { type: "2 bedroom", units: 30, basis: "DLD units register" }] },
  "11": { name: "Delta Court B", total_units: 944, floors: 45, dld: { buildings: 3 }, rows: [{ type: "1 bedroom", units: 400, basis: "DLD units register" }] },
  "13": { name: "Register Only House", total_units: 50, floors: 8, dld: { buildings: 1 }, rows: [{ type: "1 bedroom", units: 40, basis: "DLD units register", median_sqm: 55 }, { type: "Studio", units: 10, basis: "DLD units register", median_sqm: 38 }] },   // v277: in the register, not in the rent index
} });
// v277: the developers' own sheets (img_avail_index -> img_drill_<d>.claimed), as build_avail_index.py publishes them
J("avail_index", { updated: "2026-09-30", sheets: [{ sheet: "Alpha Developments 2026-09-20", note: "4 units · 1 project", mapped: true, d: "alpha" }] });
J("drill_alpha", { title: "Alpha Developments (all projects)", claimed: { as_of: "2026-09-20", source: "Alpha Developments sheets", rooms: [], detail: [
  { p: "Alpha Tower", as_of: "2026-09-20", units: [["A-1203", "1 B/R", 741.1, 1250000, "Pool"], ["A-1403", "1 B/R", 741.1, 1262000, ""], ["A-0801", "2 B/R", 1100, 1900000, "Park"], ["A-OF1", "Office", 900, 1500000, ""]] } ] } });
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
ok(html.includes("AED 65,000</div>") && html.includes("AED 60,000 &ndash; 70,500") && html.includes(">16 (16 new)</div>"), "typical rent, middle half and lettings come from the rent index (v285: the count says how many were new, as the list does)");
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

// ---- 4. v277: no register estimate on the client face; DEVELOPER AVAILABILITY where a sheet names the building ------------------
const ESTIMATE_RX = /ESTIMATED [A-Z -]*LEFT|leftbox|an estimate, not a count|An estimate, not a count|no running tenancy|Still filling|rounded to the nearest ten/;
ok(!ESTIMATE_RX.test(html), "page 2 carries NO estimate box: no ESTIMATED ONE-BEDROOMS LEFT, no 'estimate, not a count', no tenancy wording (Alpha Tower has T=178, R=37 on file, and it is still not printed)");
const abox = (h) => { const m = /<div class="availbox"[\s\S]*?<\/div><\/div>/.exec(h); return m ? m[0] : ""; };
const a1 = abox(html);
ok(/DEVELOPER AVAILABILITY/.test(a1) && a1.includes("Available now, per Alpha Developments&rsquo;s sheet of 20 September 2026: 2 one-bedrooms."), "page 2: 'Available now, per Alpha Developments's sheet of 20 September 2026: 2 one-bedrooms' - the developer's own sheet, named and dated", a1.slice(0, 400));
ok(a1.includes("A-1203") && a1.includes("A-1403") && a1.includes("1,250,000") && a1.includes(">Pool<") && !a1.includes("A-0801") && !a1.includes("A-OF1"), "with the sheet's one-bedroom rows (unit, size, price, view) and neither the two-bedroom nor the office row");
ok(/developer&rsquo;s statement on that date, not register data/.test(a1) && /Availability: Alpha Developments's own availability sheet of 2026-09-20/.test(html), "it says whose statement it is, and the small print names the sheet");
({ html } = await pdf("kind=dossier&keys=nolayer:5"));
ok(!abox(html) && !ESTIMATE_RX.test(html) && !/availability to follow|Availability: to follow/i.test(html), "a building no developer sheet names: no availability box, no estimate box, no placeholder - nothing");
({ html } = await pdf("kind=dossier&keys=testdistrict:11"));
ok(!abox(html) && !ESTIMATE_RX.test(html), "a multi-building record, no sheet: nothing either");
ok(html.includes("45 floors (one of 3 buildings)") && html.includes("944 homes in 3 buildings") && !html.includes("Delta Court B"), "a tower record of a multi-building project: floors and homes say so, and its own name ('... B') is never printed");
// never mixed: a stubbed register estimate for Alpha (the parity test proves the API still returns it) does not reach the page
J("beds_left_testdistrict", { as_of: "2026-09-30", source: "stub", rows: [{ key: "testdistrict:10", name: "Alpha Tower", beds: "1", T: 178, R: 37 }] });
({ html } = await pdf("kind=dossier&keys=testdistrict:10"));
ok(!ESTIMATE_RX.test(html) && !/about 140|of 178/.test(html) && abox(html).includes("2 one-bedrooms"), "with the beds-left register on file too, the page still prints the developer sheet only - the two sources are never mixed");
store.delete("img_beds_left_testdistrict");
// 4b. beds=all: every home type in the building
let all;
({ r, html: all } = await pdf("kind=dossier&keys=testdistrict:10&beds=all"));
ok(r.status === 200 && pages(all) === 3 && /filename="Alpha_Tower_All\.pdf"/.test(r.headers.get("Content-Disposition") || ""), "beds=all: a 3-page dossier named ..._All.pdf", r.headers.get("Content-Disposition"));
ok(all.includes("OPTION &middot; ALL HOME TYPES &middot; TEST DISTRICT"), "the header says ALL HOME TYPES");
ok(all.includes("TYPICAL RENT A YEAR, BY TYPE") && />1 bedroom<\/td><td[^>]*>AED 65,000<\/td>/.test(all) && !all.includes("What AED 65,000 gets you here"), "page 1 gives the typical rent per type as a table, with no single-type budget line");
ok(all.includes("The layouts, every type") && /<th[^>]*>TYPE<\/th><th[^>]*>LAYOUT<\/th>/.test(all) && (all.match(/>1 bedroom<\/td><td[^>]*>Layout [AB]<\/td>/g) || []).length === 2 && /2 other layouts/.test(all) && /Alpha Tower has 7 flats\./.test(all),
  "page 3 lists the layouts of every type with a TYPE column: the two shared one-bedroom layouts, and the single studio and two-bedroom flats as '2 other layouts' (7 flats in all)");
ok(abox(all).includes("Available now, per Alpha Developments&rsquo;s sheet of 20 September 2026: 3 homes.") && abox(all).includes("A-0801") && !abox(all).includes("A-OF1"), "page 2's availability counts every home on the sheet (3: the office is not a home)");
ok(!ESTIMATE_RX.test(all) && !/one-bedroom flats/.test(all), "and no per-type 'left' wording anywhere");
// 4c. a key the rent index does not know, but the unit-mix register does (every building page has one): the dossier still builds
({ r, html } = await pdf("kind=dossier&keys=testdistrict:13&beds=all"));
ok(r.status === 200 && pages(html) === 3 && html.includes(">Register Only House</div>") && html.includes("No lettings for this building in the latest pull"), "testdistrict:13 (unit-mix only): 3 pages from the register, the name from the record, and it says there is no rent figure", r.status + " " + html.slice(0, 200));
ok(/>Studio<\/td><td[^>]*>10<\/td>/.test(html) && />1 bedroom<\/td><td[^>]*>40<\/td><td[^>]*>&mdash;<\/td>/.test(html) && html.includes("An 8-floor residential building"), "its layouts table is the register's per-type count (a missing floor range prints as a dash, not a broken entity)");

// ---- 5. the map -----------------------------------------------------------------------------------------------------------------
({ html } = await pdf("kind=dossier&keys=testdistrict:10"));
ok(/<svg style="width:700px;height:auto;display:block;" xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 1500 1000"/.test(html), "page 2 carries the LOD 100 block map as inline SVG (no picture to break)");
ok((html.match(/class="hiblock"/g) || []).length === 2 && html.includes("Alpha Tower · where it is in Test District") && !html.includes("Map to follow"), "the building is drawn in gold (walls + roof) with its own title; no 'Map to follow'");
ok(/fill="#C5A56A"/.test(html) && /fill="#E9E9E4"/.test(html) && /<g class="badge">/.test(html) && />N<\/text>/.test(html) && />500 m<\/text>/.test(html), "the approved palette, a numbered badge, a north arrow and a scale bar");
{
  const svg = (/<svg style="width:700px[\s\S]*?<\/svg>/.exec(html) || [""])[0];
  const ctx = svg.match(/<path class="bm[wr]" d="[^"]*"\/>/g) || [];
  const dup = (svg.match(/ d="[^"]*"/g) || []).some((d) => d.slice(4, -1).split(/[MZ]/).some((sub) => { const n = sub.trim().split(" "); for (let k = 2; k + 1 < n.length; k += 2) if (n[k] === n[k - 2] && n[k + 1] === n[k - 1]) return true; return false; }));
  ok(/\.bmw\{fill:#D3D4CE;stroke:#BFC1BA;[^}]*\}\.bmr\{fill:#E9E9E4;stroke:#BFC1BA;/.test(svg) && ctx.length >= 3 && !dup,
    "the map is slimmed without changing the picture: the other buildings share their paint through two classes, no point repeats the one before it", ctx.length + " ctx paths, dup " + dup);
}
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
ok(!html.includes("bph_portal") && html.includes("the brochure&#x27;s source is a listing portal") && !html.includes("Photos to follow") && /<div class="blocksview" data-kind="blocks" style="width:702px;height:300px;/.test(html), "a brochure from a listing portal is refused whole (v285: page 1 shows its Blocks view instead of an empty box)");
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
  ok(!/Still filling/.test(html) && !ESTIMATE_RX.test(html) && !/\*Dubai Land Department units list/.test(html), kind + ": no 'Still filling' line on any card and no asterisk small print (v277)");
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

// ---- v282 (Kendall, 1 Oct 2026): the client's criteria on the documents, and the areas side by side ------------------------------
{
  store.set("img_pf_supply_testdistrict", JSON.stringify({ as_of: "2026-10-01", rows: [{ key: "testdistrict:10", dld_project: "Alpha Tower", beds_band: "1", listings_live: 9, furnished_live: 4 }] }));
  const BQ = "&musts=pets&nice=private_pool,community_pool&furnished=furnished&type=apartment";
  let d = await pdf("kind=dossier&keys=testdistrict:10&beds=1,2" + BQ);
  ok(d.r.status === 200 && pages(d.html) === 3, "a dossier with the client's criteria is still exactly 3 pages", pages(d.html));
  ok(d.html.includes("HOW IT MEETS THE BRIEF") && d.html.includes("WHERE THE ANSWER COMES FROM"), "page 2 says how the building meets the brief, with where each answer comes from");
  ok(/community pool <span[^>]*>\(nice to have\)<\/span><\/td><td[^>]*><b[^>]*>&#10003; yes<\/b>/.test(d.html) && d.html.includes("the developer&#x27;s own project page"), "community pool: yes, from the developer's own page", (d.html.match(/community pool.{0,400}/) || [""])[0]);
  ok(/pet-friendly \(dog walks, play areas\) <span[^>]*>\(must\)<\/span><\/td><td[^>]*><b[^>]*>not known<\/b>/.test(d.html) && d.html.includes("Kids&#x27; play area"), "pet-friendly: not known (no register holds a pet policy), with the play area on the developer's page as a fact");
  ok(/private pool <span[^>]*>\(nice to have\)<\/span><\/td><td[^>]*><b[^>]*>not known<\/b>/.test(d.html), "private pool: not known, never a no");
  ok(/furnished <span[^>]*>\(asked\)<\/span><\/td><td[^>]*><b[^>]*>not known<\/b>/.test(d.html) && d.html.includes("does not record whether a home is furnished"), "furnished: not known, with the reason");
  ok(!/advert|listings_live|furnished_live|OWNER ONLY|4 of 9/i.test(d.html), "no listing-site (portal) furnishing figure on a client document, though the advertised-supply data carries one");
  printed = []; await call("/brief_pdf?kind=dossier&keys=testdistrict:10&beds=1" + BQ + Q + "&key=" + READ);
  ok(printed[0] && !/advert|furnished_live|OWNER ONLY|4 of 9/i.test(printed[0]), "not even when the OWNER key asks for the PDF: a document is always a client document");
  ok(/filename="Alpha_Tower_1BR\.pdf"/.test(d.r.headers.get("Content-Disposition") || "") && d.html.includes("TYPICAL 1-BED RENT A YEAR"), "beds=1,2 on a building with 1-bed lettings only: its document is for the 1-bed figure");
  d = await pdf("kind=dossier&keys=testdistrict:10");
  ok(!d.html.includes("HOW IT MEETS THE BRIEF"), "no criteria asked: no criteria box (the approved layout is unchanged)");
  // the one-sheet cards carry one line of marks
  d = await pdf("kind=compare&keys=testdistrict:10,dld:betaheights" + BQ);
  ok(d.html.includes('class="critline"') && /&#10003; community pool/.test(d.html) && /pet-friendly \(dog walks, play areas\): not known/.test(d.html), "each one-sheet card carries a line of yes / not known marks");
  ok(!d.html.includes("The areas side by side") && pages(d.html) === 2, "no compare=1: no comparison page (cards + map, as before)");
  // the areas side by side: Compare and Full pack open with it when 2 or 3 areas were compared
  d = await pdf("kind=compare&keys=testdistrict:10,dld:betaheights&areas=testdistrict,nolayer&compare=1" + BQ);
  ok(d.r.status === 200 && pages(d.html) === 3 && d.html.indexOf("The areas side by side") > -1 && d.html.indexOf("The areas side by side") < d.html.indexOf('class="bcard"'), "Compare with compare=1 and two areas opens with the comparison page (3 pages)", pages(d.html));
  const cp = d.html.slice(d.html.indexOf("The areas side by side"), d.html.indexOf('class="bcard"'));
  for (const row of ["Homes that match", "Typical rent, last 60 days", "Home types", "Pools", "Parks and dog-friendly spaces", "Schools nearby", "Newest completion"]) ok(cp.includes(row), "the comparison page has the row “" + row + "”");
  ok(cp.includes(">Test District</th>") && cp.includes(">No Layer Town</th>"), "one column per area");
  ok(/&#10003; yes<\/b> 1 school/.test(cp) && /not known<\/b> not known: no completion year/.test(cp) && cp.includes("KHDA"), "each cell is yes / no / not known with its words and its source", cp.slice(0, 300));
  ok(!/advert|furnished_live|OWNER ONLY/i.test(cp), "and no listing-site data");
  d = await pdf("kind=pack&keys=testdistrict:10,dld:betaheights&areas=testdistrict,nolayer&compare=1" + BQ);
  ok(d.r.status === 200 && d.html.indexOf("The areas side by side") > -1 && d.html.indexOf("The areas side by side") < d.html.indexOf('class="bcard"') && pages(d.html) === 1 + 2 + 3 * 2 + 1, "the Full pack opens with the same comparison page (1 + one-sheet 2 + 3 per building + appendix)", pages(d.html));
  d = await pdf("kind=dossier&keys=testdistrict:10&areas=testdistrict,nolayer&compare=1" + BQ);
  ok(!d.html.includes("The areas side by side") && pages(d.html) === 3, "an Individual PDF never carries the comparison");
  store.delete("img_pf_supply_testdistrict");
}

// ---- v285 (Kendall, 1 Oct 2026, filming): every card has a picture; the screen and the PDF give the same figures ------------------
// 1. "you need the pictures in the .pdf": no card is ever an empty "photos to follow" box. The developer's photograph where one is on
//    file; else the building's Blocks view (its footprint in gold among its neighbours, labelled "Blocks view"); a building with only a
//    map position gets an indicative dashed block there; an unplaced one the district's blocks, "position not yet verified". Only a
//    district with no layer at all keeps the plain box.
// 2. Capital Bay A: the list said AED 50k, middle half 49k-51k, 9 lettings (4 new); the PDF said AED 55,000, 50,000-55,650 - the PDF read
//    every contract, the list the new lettings. Both now read rentFigure() (src/brief.js), and a dld: key the list UNBOUND from an app
//    building named otherwise never borrows that building's footprint.
// NEGATIVE CONTROLS (run by hand, see the commit message): in loadContext put `st = pick.s` back (the raw all-contracts figures) and the
// parity checks fail; make thumb() return the old box and the picture checks fail.
{
  const RI0 = store.get("img_rent_index"), UM0 = store.get("img_unitmix_testdistrict");
  const ri = JSON.parse(RI0), um = JSON.parse(UM0);
  // new lettings 4 of 9: the median of the new ones (62,000) is the figure, not the median of all nine (66,000)
  ri.items.push({ p: "newbasis", n: "New Basis Tower", d: "testdistrict", i: 99, lon: 55.197, lat: 25.04818, area: "Al Test Fourth",
    b: { "1": { n: 9, nn: 4, nr: 5, m: 66000, q1: 61000, q3: 68000, s: 42.6, last: "2026-09-29", mn: 62000, q1n: 61500, q3n: 63000 } } });
  // bound in the index to footprint 98, whose app record is named otherwise: the list unbinds it (dld:wrongbind)
  ri.items.push({ p: "wrongbind", n: "Wrong Bind Court", d: "testdistrict", i: 98, lon: 55.204, lat: 25.05364, area: "Al Test Fourth",
    b: { "1": { n: 6, nn: 6, nr: 0, m: 63000, q1: 62000, q3: 64000, s: 50, last: "2026-09-28", mn: 63000, q1n: 62000, q3n: 64000 } } });
  um.buildings_by_id["98"] = { name: "Totally Different Tower", floors: 6, dld: { buildings: 1 }, rows: [] };
  // a map position but no footprint on the layer
  ri.items.push({ p: "pinonly", n: "Pin Only House", d: "testdistrict", i: 14, lon: 55.2005, lat: 25.0505, area: "Al Test Fourth",
    b: { "1": { n: 4, nn: 1, nr: 3, m: 61000, q1: 60500, q3: 61500, s: 48, last: "2026-09-27" } } });
  store.set("img_rent_index", JSON.stringify(ri)); store.set("img_unitmix_testdistrict", JSON.stringify(um));

  const list = await (await call("/brief_api?mode=rent&beds=1&min=60000&max=65000&areas=testdistrict&limit=10&key=" + CLIENT)).json();
  const rows = list.results || [];
  const nb = rows.find((x) => x.name === "New Basis Tower"), wb = rows.find((x) => x.name === "Wrong Bind Court");
  ok(nb && nb.evidence.median === 62000 && nb.evidence.q1 === 61500 && nb.evidence.q3 === 63000 && nb.evidence.n === 9 && nb.evidence.n_new === 4,
    "the list: New Basis Tower AED 62,000, middle half 61,500-63,000, 9 lettings (4 new) - the new lettings' figure", JSON.stringify(nb && nb.evidence));
  ok(wb && wb.key === "dld:wrongbind" && wb.disputed_bind && wb.app_id == null, "the list unbinds Wrong Bind Court from the app building named otherwise", JSON.stringify(wb && { key: wb.key, d: wb.disputed_bind }));
  const keys = rows.map((x) => x.key);
  const d = await pdf("kind=compare&keys=" + keys.map(encodeURIComponent).join(","));
  const cards = d.html.split('<div class="bcard"').slice(1).map((c) => c.split('class="sheet page')[0]);   // the last card ends where the map page starts
  ok(d.r.status === 200 && cards.length === rows.length && rows.length >= 6, "a compare PDF of the list's " + rows.length + " buildings, one card each", d.r.status + " " + cards.length);
  const money = (s) => Number(String(s).replace(/,/g, ""));
  rows.forEach((row, k) => {
    const c = cards[k] || "", e = row.evidence;
    const m = /AED ([\d,]+)<\/span><span[^>]*>typical a year/.exec(c), mh = /Middle half AED ([\d,]+)&ndash;([\d,]+)/.exec(c), n = /(\d+) \((\d+) new\) recent lettings/.exec(c);
    ok(m && mh && n && money(m[1]) === e.median && money(mh[1]) === e.q1 && money(mh[2]) === e.q3 && +n[1] === e.n && +n[2] === e.n_new,
      row.name + ": the card's typical / middle half / count equal the list row's (AED " + e.median + ", " + e.q1 + "-" + e.q3 + ", " + e.n + " (" + e.n_new + " new))", (m && m[1]) + " " + (mh && mh[0]) + " " + (n && n[0]));
    const pic = /<img [^>]*src="[^"]*\/img\/bph_/.test(c) ? "photo" : ((/<div class="blocksview" data-kind="(\w+)"/.exec(c) || [])[1] || "none");
    ok(pic !== "none" && !/photos<br>to follow/i.test(c) && (pic === "photo" || c.includes("Blocks view")), row.name + ": the card has a picture (" + pic + "), never 'photos to follow'", c.slice(0, 300));
  });
  const cardOf = (name) => cards.find((c) => c.includes(">" + name + "</div>")) || "";
  ok(/<img [^>]*\/img\/bph_alpha_ext/.test(cardOf("Alpha Tower")), "Alpha Tower keeps the developer's photograph");
  ok(/data-kind="blocks"/.test(cardOf("New Basis Tower")) && (cardOf("New Basis Tower").match(/class="hiblock"/g) || []).length === 2, "a footprinted building with no photo: its Blocks view, the building in gold (walls + roof)");
  ok(/data-kind="blocks_approx"/.test(cardOf("Pin Only House")) && /class="approxblock"/.test(cardOf("Pin Only House")) && cardOf("Pin Only House").includes("Blocks view &middot; approximate position"), "a map position but no footprint: an indicative dashed block, said to be approximate");
  ok(/data-kind="district"/.test(cardOf("Wrong Bind Court")) && !/class="hiblock"/.test(cardOf("Wrong Bind Court")) && cardOf("Wrong Bind Court").includes("position not yet verified"),
    "an unbound record: the district's blocks with nothing in gold - never the footprint of the building it was wrongly bound to");
  ok(!/>Totally Different Tower</.test(d.html) && d.html.includes("Wrong Bind Court  (no map position yet)"), "and the overview map lists it as unplaced, as the list has no position for it");
  ok(d.html.includes("a Blocks view: the building as a simple block on the district model") && d.html.includes("not a photograph"), "the small print says what a Blocks view is: not a photograph");
  // the dossier says the same numbers as the list row, on page 1
  const dn = await pdf("kind=dossier&keys=testdistrict:99");
  ok(dn.html.includes(">AED 62,000</div>") && dn.html.includes("AED 61,500 &ndash; 63,000") && dn.html.includes(">9 (4 new)</div>") && !dn.html.includes("66,000"),
    "New Basis Tower's dossier: AED 62,000, 61,500-63,000, 9 (4 new) - not the all-contracts 66,000");
  ok(dn.html.includes("of the 4 one-bedroom flats newly let here recently went for"), "its budget line counts the lettings the quarters are of (the 4 new ones)");
  ok(/<div class="blocksview" data-kind="blocks" style="width:702px;height:300px;/.test(dn.html) && !dn.html.includes("Photos to follow") && dn.html.includes("The picture on page 1 is a Blocks view, not a photograph"),
    "its page 1 shows the Blocks view as the hero, and page 3's small print says it is not a photograph");
  // only a district with no layer keeps the plain box
  const nl = await pdf("kind=compare&keys=nolayer:5,testdistrict:99");
  ok(/photos<br>to follow/.test(nl.html.split('<div class="bcard"')[1] || "") && /data-kind="blocks"/.test(nl.html.split('<div class="bcard"')[2] || ""), "no district layer at all: the plain box (nothing to draw); the footprinted card beside it has its Blocks view");
  store.set("img_rent_index", RI0); store.set("img_unitmix_testdistrict", UM0);
}

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
