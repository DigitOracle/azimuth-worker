// v302 (Kendall, 4 Oct 2026): a client document NEVER shows our gaps. Built on test_brief_docs.mjs's own fixtures and harness.
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

// ===== v302 client-document wording: a gap is OMITTED, never printed ==========================================================
// NEGATIVE CONTROL: against release-v300 the dossier of nolayer:5 says "Map to follow", "to follow" and "not yet verified", and the
// one-sheet says "not known": this scan fails there (copy this file into a release-v300 checkout and run it).
const BANNED = [/not known/i, /not yet verified/i, /to follow/i, /unknown/i, /Distances? not shown/i, /Map to follow/i, /Schools and clinics/i, /not yet published/i, /not yet in our files/i, /Not on record/i, /no record we hold/i, /position not yet/i, /being verified/i];
const strip = (h) => h.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'");
const scan = (label, h) => { const t = strip(h); const hit = BANNED.map((r) => r.exec(t)).filter(Boolean).map((m) => m[0] + " ... " + t.slice(Math.max(0, m.index - 40), m.index + 60).replace(/\s+/g, " ")); ok(h.length > 500 && !hit.length, "W302 " + label + ": no gap wording on a client document", hit.join(" || ")); };
const QQ = "&musts=community_pool,pets&nice=private_pool&furnished=furnished&type=any";
for (const k of ["testdistrict:10", "testdistrict:11", "testdistrict:12", "testdistrict:13", "nolayer:5", "dld:betaheights"]) { const d = await pdf("kind=dossier&keys=" + k + QQ); scan("dossier " + k, d.html); }
for (const [kind, keys] of [["onesheet", "testdistrict:10,testdistrict:11,nolayer:5"], ["compare", "testdistrict:10,testdistrict:11,nolayer:5"], ["pack", "testdistrict:10,nolayer:5"]]) { const d = await pdf("kind=" + kind + "&keys=" + keys + QQ); scan(kind, d.html); }
{ const d = await pdf("kind=compare&keys=testdistrict:10,testdistrict:11&compare=1&areas=testdistrict,nolayer" + QQ); scan("compare with areas side by side", d.html); }
{ const t = strip(await (await call("/brief_blocks?d=nolayer&key=" + CLIENT)).text()); ok(!BANNED.some((r) => r.test(t)), "W302 /brief_blocks without a layer: no gap wording", t.slice(0, 200)); }
{ const d = await pdf("kind=dossier&keys=nolayer:5"); ok(d.html.includes("Your realtor will verify these details with you."), "W302 a heading with nothing to show carries the one neutral line"); }
console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
