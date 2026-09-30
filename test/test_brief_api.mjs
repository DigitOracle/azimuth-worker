// THE BRIEF - Contract A: GET /brief_api (src/brief.js). Spec: BRIEF_SPEC.md v1, 30 Sep 2026.
//
// A client of Naj's asked "three options in JVC, one bedroom, AED 65K rent". /brief_api answers it from the worker's own KV:
// the rent index (img_rent_index), the Buy data (img_map_prices + img_unitmix_<district>), the amenity layer, the developer
// brochures and the Ejari tenancy file. What this proves, through the real worker.fetch:
//   1. the gate: READ_KEY or a client key opens it (/brief_api is in CLIENT_PATHS); no key, a wrong key, a POST and a bad query do not
//   2. rent: the budget filter, the n >= 3 floor, the SAME figure the map's Rent mode shows, "also filed as" counted once, the
//      ranking (strictly inside the budget first, then most evidence), the verdicts, areas and home type
//   3. a name must agree with the record: a bind to a building named otherwise is dropped, one building is never listed twice
//   4. musts: null unless a source answers; a source's "no" removes the building; metro is a straight-line kilometre
//   5. estimated left = T minus R: from the beds-left register (img_beds_left_<district>) when on file, matched by key then by DLD
//      project name; otherwise only under the building page's own tenancy gate; labelled an estimate; otherwise omitted with the reason
//   6. buy: register medians with a per-bedroom sale count; never an estimate; no count, no result
//   7. the only change to src/index.js is one import and one marked dispatch
//   8. against the real index (NAJ_DATA): the reference question - JVC, 1 bed, AED 60-68K
// NEGATIVE CONTROL on the verdict boundary (Kendall's verdicts, 30 Sep 2026): make "within" allow 1 AED over the maximum - the
// 68,000 / 68,001 edge check fails; restore - it passes.
// NEGATIVE CONTROL (run 30 Sep 2026): (a) sort by n ascending instead of descending in src/brief.js - the ranking checks and the
// reference top 10 fail; (b) remove the n >= 3 floor - "two contracts: left out" and the real-index floor check fail. Restored: all pass.
//
//   node test/test_brief_api.mjs
import worker from "../src/index.js";
import { nameAgrees, verdictOf, estLeft, nkey, bedsLeftRow } from "../src/brief.js";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(HERE, "..", "src", "index.js"), "utf8");
const NAJ = process.env.NAJ_DATA || "C:/Dev/naj-market-pulse/data";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 500) : "")); } };

// ---- the worker harness (v186 / v274) -------------------------------------------------------------------
const READ = "client_read_key_in_links_123", CLIENT = "a_client_key_for_links_456";
const store = new Map();
let writes = 0;
const KV = {
  async get(k) { return store.has(k) ? store.get(k) : null; },
  async put(k, v) { writes++; store.set(k, v); },
  async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter(k => k.startsWith(p)).map(name => ({ name })), list_complete: true }; },
};
globalThis.fetch = async () => new Response("{}", { status: 200 });
const env = { MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: CLIENT, INGEST_TOKEN: "ING", PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
const call = (p, init) => worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev" + p, init), env, { waitUntil() {} });
const brief = async (qs, key) => { const r = await call("/brief_api?" + qs + (key === "" ? "" : "&key=" + (key || READ))); return { status: r.status, j: r.status === 200 || r.status === 400 ? await r.json() : null, r }; };
const JVC = "jumeirahvillagecircle";

// ---- a small rent index in the real shape (rows copied from data/board/rent_index.json, 30 Sep 2026) ----------
const S = (n, nn, m, q1, q3, mn, q1n, q3n, s, last) => ({ n, nn, nr: n - nn, m, q1, q3, ...(nn ? { mn, q1n, q3n } : {}), s, last });
const RI = {
  generated: "2026-09-30T17:58:34", as_of: "2026-09-30", source_file: "rents-2026-09-30-api.csv", window: ["2026-08-01", "2026-09-30"], contracts: 38027,
  bands: { flat_city_cuts: [52, 92, 162], villa_cut: 90, flat_accuracy_city: 0.771, flat_accuracy_area: 0.826 },
  items: [
    { p: "binghattiamber", n: "Binghatti Amber", area: "Al Barsha South Fourth", d: JVC, last: "2026-09-29", b: { "1": S(29, 27, 66000, 65000, 70000, 65817, 64000, 70000, 64.5, "2026-09-29") } },
    { p: "bloom", n: "Bloom Towers", area: "Al Barsha South Fourth", d: JVC, i: 892, lon: 55.203689, lat: 25.066907, bind: "tx", last: "2026-09-29", b: { "1": S(24, 19, 68000, 62000, 70000, 65000, 60000, 70000, 62.3, "2026-09-29") } },
    { p: "bloomheights", n: "BLOOM HEIGHTS", a: ["CANAL VIEWS"], area: "Al Barsha South Fourth", d: JVC, i: 893, lon: 55.2036, lat: 25.0660, bind: "anchor", last: "2026-09-30", b: { "1": S(15, 12, 65000, 62000, 68000, 66500, 63000, 69000, 69.7, "2026-09-30") } },
    { p: "binghattinova", n: "Binghatti Nova", area: "Al Barsha South Fourth", d: JVC, i: 1490, lon: 55.2105, lat: 25.0590, bind: "anchor", last: "2026-09-30", b: { "1": S(16, 13, 65000, 60000, 70000, 65000, 60000, 72000, 59.1, "2026-09-30"), "2": S(4, 4, 90000, 88000, 95000, 90000, 88000, 95000, 91, "2026-09-20") } },
    { p: "havengarden", n: "THE HAVEN GARDEN", area: "Al Barsha South Fourth", d: JVC, last: "2026-09-30", b: { "1": S(37, 37, 70000, 68000, 72000, 70000, 68000, 72000, 70, "2026-09-30") } },
    { p: "lumaparkviews", n: "Luma Park Views", area: "Al Barsha South Fourth", d: JVC, i: 1416, last: "2026-09-30", b: { "1": S(30, 30, 84500, 80000, 88000, 84500, 80000, 88000, 75, "2026-09-30") } },
    { p: "empireresidence", n: "Empire Residence", area: "Al Barsha South Fourth", d: JVC, i: 711, last: "2026-09-05", b: { "1": S(2, 1, 67500, 63750, 71250, 60000, 60000, 60000, 65.5, "2026-09-05") } },
    { p: "dunesmarigold", n: "DUNES MARIGOLD", a: ["ZAREEN RESIDENCE 1"], area: "Al Barsha South Fourth", d: JVC, i: 279, last: "2026-09-18", b: { "1": S(6, 2, 60680, 58000, 62000, 56000, 55000, 57000, 60, "2026-09-18") } },
    { p: "regentcourt", n: "Regent Court", area: "Al Barsha South Fourth", d: JVC, i: 594, lon: 55.21, lat: 25.06, bind: "tx", last: "2026-09-19", b: { "1": S(6, 5, 61000, 60000, 64000, 60000, 60000, 63000, 60, "2026-09-19") } },
    { p: "chaimaaavenue", n: "Chaimaa Avenue", a: ["GIARADINO ROTONDO RESIDENCE"], area: "Al Barsha South Fourth", d: JVC, i: 1192, last: "2026-09-21", b: { "1": S(4, 4, 67000, 61500, 71250, 67000, 61500, 71250, 72, "2026-09-21") } },
    { p: "chaimaaavenue2", n: "Chaimaa Avenue 2", area: "Al Barsha South Fourth", d: JVC, i: 1192, last: "2026-09-29", b: { "1": S(6, 4, 72000, 70500, 74250, 71000, 68750, 72750, 74.5, "2026-09-29") } },
    { p: "cheapone", n: "CHEAP ONE", area: "Al Barsha South Fourth", d: JVC, i: 5000, last: "2026-09-20", b: { "1": S(9, 9, 55000, 54000, 56000, 55000, 54000, 56000, 55, "2026-09-20") } },
    { p: "binghattimirage", n: "Binghatti Mirage", a: ["AL FERDOWS"], area: "Al Barsha South Fourth", d: JVC, i: 1137, last: "2026-09-28", b: { "1": S(8, 7, 68250, 60000, 74844, 73500, 61500, 74896, 61.3, "2026-09-28") } },
    { p: "somevillas", n: "SOME VILLAS", area: "Al Barsha South Fourth", d: JVC, i: 6000, last: "2026-09-20", v: { "1": S(5, 5, 64000, 62000, 66000, 64000, 62000, 66000, 120, "2026-09-20") } },
    { p: "marinaone", n: "MARINA ONE", area: "Marsa Dubai", d: "dubaimarina", i: 3, lon: 55.14, lat: 25.08, last: "2026-09-25", b: { "1": S(9, 9, 66000, 64000, 69000, 66000, 64000, 69000, 70, "2026-09-25") } },
  ],
  areas: [{ area: "Al Barsha South Fourth", d: JVC, b: { "1": S(1323, 988, 69000, 62000, 75000, 70000, 63000, 76000, 73.4, "2026-09-30") } }],
};
const card = (name, o) => Object.assign({ status: "verified", name, rows: [], sources: [] }, o);
const UMX = { district: JVC, generated: "2026-09-29", buildings_by_id: {
  "892": card("Bloom Towers B", { pools: 1, car_parks: 900, dld: { buildings: 3 }, rows: [{ type: "1 bedroom", units: 463, basis: "DLD units register", median_aed: 687000 }] }),
  "893": card("BLOOM HEIGHTS", { pools: 2, dld: { buildings: 2 }, rows: [{ type: "1 bedroom", units: 316, basis: "DLD units register", median_aed: 705405 }] }),
  "1490": card("Binghatti Nova", { pools: 1, car_parks: 239, dld: { buildings: 1 }, dld_sales: { sold_by_type: { "1 bedroom": 283, "2 bedroom": 43 }, first: "2023-01-30", last: "2026-08-27" },
    rows: [{ type: "1 bedroom", units: 178, basis: "DLD units register", median_aed: 640000, median_sqm: 59.5 }, { type: "2 bedroom", units: 30, basis: "DLD units register", median_aed: 886050, median_sqm: 91.4 }, { type: "NA", units: 3, basis: "DLD units register", est_aed: 1226570 }] }),
  "594": card("Palatium Residences", { dld: { buildings: 1 }, rows: [{ type: "1 bedroom", units: 40, basis: "DLD units register", median_aed: 600000 }] }),
  "1192": card("CHAIMAA AVENUE", { dld: { buildings: 1 }, rows: [] }),
  "279": card("Dunes Marigold", { dld: { buildings: 1 }, rows: [] }),
  "1137": card("Binghatti Mirage", { dld: { buildings: 1 }, rows: [] }),
  "1416": card("Luma Park Views", { dld: { buildings: 1 }, rows: [] }),
  "5000": card("Cheap One", { dld: { buildings: 1 }, rows: [] }),
  // Buy-only records
  "7001": card("Villa Park", { dld: { buildings: 1 }, dld_sales: { sold_by_type: { "3 bedroom": 12, "4 bedroom": 30 }, first: "2024-01-01", last: "2026-09-01" },
    rows: [{ type: "3 bedroom", units: 20, basis: "DLD units register", median_aed: 2400000 }, { type: "4 bedroom", units: 40, basis: "DLD units register", median_aed: 2900000 }] }),
  "7002": card("No Count Tower", { dld: { buildings: 1 }, rows: [{ type: "1 bedroom", units: 50, basis: "DLD units register", median_aed: 700000 }] }),
  "7003": card("Guess Tower", { dld: { buildings: 1 }, dld_sales: { sold_by_type: { "1 bedroom": 40 } }, rows: [{ type: "1 bedroom", units: 50, basis: "DLD units register", est_aed: 700000 }] }),
  "7004": card("Thin Sales", { dld: { buildings: 1 }, dld_sales: { sold_by_type: { "1 bedroom": 2 } }, rows: [{ type: "1 bedroom", units: 50, basis: "DLD units register", median_aed: 690000 }] }),
} };
const TEN = { district: JVC, as_at: "2026-09-09", coverage: { share_bound: 0.459 }, buildings_by_id: {
  "1490": { live: 45, by_type: { "1 bedroom": 38, "2 bedroom": 7 }, as_at: "2026-09-09", scope: "building", buildings_in_project: 1 },
  "892": { live: 183, by_type: { "1 bedroom": 88, Studio: 81 }, as_at: "2026-09-09", scope: "building" },
} };
const DG = { districts: [{ slug: JVC, name: "Jumeirah Village Circle" }, { slug: "dubaimarina", name: "Dubai Marina" }] };
const AM = { items: [
  { k: "metro", n: "Near Station", lon: 55.2105, lat: 25.0560 },          // ~330 m south of Binghatti Nova, ~1.4 km from Bloom Towers
  { k: "metro", n: "Far Station", lon: 55.30, lat: 25.20 },
  { k: "school", n: "A School", lon: 55.2037, lat: 25.0672 },            // beside Bloom Towers
] };
const MP = { generated: "2026-09-09 14:58", items: [
  { p: "binghattinova", n: "Binghatti Nova", d: JVC, i: 1490, lon: 55.2105, lat: 25.059, u: 211, b: { "1": 640000, "2": 886050 }, fl: 21 },
  { p: "villapark", n: "Villa Park", d: JVC, i: 7001, lon: 55.2, lat: 25.05, b: { "3": 2400000, "4": 2900000 }, fl: 2 },
  { p: "nocount", n: "No Count Tower", d: JVC, i: 7002, lon: 55.2, lat: 25.05, b: { "1": 700000 } },
  { p: "guess", n: "Guess Tower", d: JVC, i: 7003, lon: 55.2, lat: 25.05, b: { "1": 700000 }, e: [1] },
  { p: "thin", n: "Thin Sales", d: JVC, i: 7004, lon: 55.2, lat: 25.05, b: { "1": 690000 } },
  { p: "launch", n: "A Launch", d: JVC, i: -1, lon: 55.2, lat: 25.05, b: { "1": 650000 } },
] };
// the beds-left register as the DDA session will publish it (JVC 1-bed T and R, given 30 Sep 2026). Nova by our key, the rest by DLD project name.
const BL_ROWS = [["Binghatti Amber", 502, 122], ["Bloom Towers", 463, 79], ["BLOOM HEIGHTS", 316, 66], ["Binghatti Nova", 178, 37], ["Binghatti Heights", 248, 57],
  ["Binghatti Emerald", 217, 61], ["Elysee III by Pantheon", 80, 21], ["Binghatti Gardenia", 180, 38], ["Binghatti Luna", 160, 28], ["Binghatti Mirage", 92, 16]];
const BEDS_LEFT = { as_of: "2026-09-30", source: "DLD units register + Ejari tenancy register (DDA iPaaS), stub for tests",
  rows: BL_ROWS.map(([name, T, R]) => (name === "Binghatti Nova" ? { key: JVC + ":1490", name, beds: "1", T, R } : { dld_project: name, name, beds: 1, T, R }))
    .concat([{ dld_project: "Binghatti Nova", name: "Binghatti Nova", beds: "2", T: 30, R: 7 }]) };
const setAll = () => {
  store.clear();
  store.set("img_rent_index", JSON.stringify(RI));
  store.set("img_unitmix_" + JVC, JSON.stringify(UMX));
  store.set("img_tenancy_" + JVC, JSON.stringify(TEN));
  store.set("img_districts_geo", JSON.stringify(DG));
  store.set("img_amenities", JSON.stringify(AM));
  store.set("img_map_prices", JSON.stringify(MP));
  store.set("img_brochure_" + JVC + "_1490", JSON.stringify({ name: "Binghatti Nova", amenities: ["Gym", "Swimming pool"], photos: [{ file: "p1.jpg" }] }));
  store.set("img_brochure_" + JVC + "_1490_p1jpg", "binary");
  store.set("img_brochure_name_binghatti_amber", JSON.stringify({ name: "Binghatti Amber", amenities: ["Gym (fitness facilities)", "Swimming pool"], photos: [{ file: "a.jpg" }] }));
};
setAll();
const REF = "mode=rent&beds=1&min=60000&max=68000&areas=" + JVC;

// ---- 1. the gate --------------------------------------------------------------------------------------------
ok((await brief(REF, "")).status === 401, "no key: 401");
ok((await brief(REF, "wrong_key_wrong_key_1")).status === 401, "a wrong key: 401");
ok((await brief(REF, READ)).status === 200, "the owner key (READ_KEY): 200");
ok((await brief(REF, CLIENT)).status === 200, "a client key: 200 (/brief_api is on the client surface)");
ok((await call("/brief_api?" + REF + "&key=" + READ, { method: "POST", body: "{}" })).status === 405 && (await call("/brief_api?" + REF, { method: "POST", body: "{}" })).status === 405, "POST: 405, with a key or without (so a client key gets no more than no key)");
let x = await brief("mode=lease&beds=9&type=castle&musts=helipad");
ok(x.status === 400 && x.j.error.length === 4, "a bad mode, bedrooms, type and must: 400 naming all four", JSON.stringify(x.j));
ok((await brief(REF)).r.headers.get("Cache-Control") === "no-store", "no-store: every answer is read fresh");

// ---- 2. rent: filter, figure, ranking, verdicts -------------------------------------------------------------
x = await brief(REF);
let j = x.j, R = j.results, names = R.map(r => r.name);
ok(j.as_of === "2026-09-30" && /img_rent_index/.test(j.source) && j.window[0] === "2026-08-01", "as_of, source and window come from the index", JSON.stringify([j.as_of, j.source]));
ok(JSON.stringify(j.query) === JSON.stringify({ mode: "rent", beds: "1", min: 60000, max: 68000, areas: [JVC], type: "any", musts: [], limit: 10 }), "the query is echoed", JSON.stringify(j.query));
ok(names.slice(0, 4).join("|") === "Binghatti Amber|Bloom Towers|Binghatti Nova|BLOOM HEIGHTS", "strictly inside the budget, most contracts first: Amber 29, Bloom Towers 24, Nova 16, Bloom Heights 15", names.join(" | "));
ok(names.indexOf("THE HAVEN GARDEN") > names.indexOf("Chaimaa Avenue"), "70K ranks after every building within 60-68K, despite 37 contracts", names.join(" | "));
ok(R.find(r => r.name === "THE HAVEN GARDEN").verdict === "a_little_above", "70K against a 68K ceiling (+2.9%) is 'a_little_above' - within is strict");
ok(R.filter(r => r.verdict === "within").every(r => r.evidence.median >= 60000 && r.evidence.median <= 68000), "every 'within' is inside 60-68K exactly");
{ const tiers = R.map(r => Math.min({ within: 0, a_little_above: 1, below: 2, above: 2 }[r.verdict], 2));
  ok(tiers.every((t, i) => !i || t >= tiers[i - 1]), "within first, then a_little_above, then the rest", R.map(r => r.verdict).join(",")); }
ok(!names.includes("Luma Park Views"), "84.5K (+24%) is not offered");
ok(!names.includes("Empire Residence"), "two contracts: left out (n < 3)");
ok(!names.includes("CHEAP ONE"), "55K, more than 10% under the minimum: left out");
ok(R.find(r => r.name === "Bloom Towers").evidence.median === 65000 && R.find(r => r.name === "Bloom Towers").evidence.median_all === 68000 && R.find(r => r.name === "Bloom Towers").evidence.median_of === "new_lettings",
  "the figure is the map's own: the new-lettings median (65K) where there are 3+ new, the all-contract median kept alongside (68K)");
const dm = R.find(r => r.name === "DUNES MARIGOLD");
ok(dm && dm.evidence.median === 60680 && dm.evidence.median_of === "all_contracts" && dm.evidence.q1 === 58000, "with under 3 new lettings the median and middle half are of all contracts, never of one or two new lets", JSON.stringify(dm && dm.evidence));
const mir = (await brief(REF + "&limit=50")).j.results.find(r => r.name === "Binghatti Mirage");
ok(mir && mir.verdict === "above" && mir.evidence.median === 73500, "73.5K on a 68K ceiling (+8%) is 'above' (more than 5% over)", JSON.stringify(mir && [mir.verdict, mir.evidence.median]));
ok(R.filter(r => r.name === "BLOOM HEIGHTS" || r.aliases.includes("CANAL VIEWS")).length === 1 && R.find(r => r.name === "BLOOM HEIGHTS").aliases[0] === "CANAL VIEWS", "BLOOM HEIGHTS / CANAL VIEWS: one record, the other name an alias");
const nova = R.find(r => r.name === "Binghatti Nova");
ok(nova.key === JVC + ":1490" && nova.app_id === 1490 && nova.building_url === "/building/" + JVC + "/1490" && nova.district_name === "Jumeirah Village Circle", "a bound building: key district:id, its building page, the district's name", JSON.stringify([nova.key, nova.building_url, nova.district_name]));
const amb = R.find(r => r.name === "Binghatti Amber");
ok(amb.key === "dld:binghattiamber" && amb.app_id === null && amb.building_url === null && amb.completeness.record === false, "an unbound building: key dld:<name>, no app id, no page");
ok(JSON.stringify(nova.evidence) === JSON.stringify({ basis: "ejari", median: 65000, q1: 60000, q3: 72000, n: 16, n_new: 13, median_of: "new_lettings", median_all: 65000, sqm: 59.1, latest: "2026-09-30", home: "apartment" }), "the evidence block", JSON.stringify(nova.evidence));
ok(R.every((r, i) => r.rank === i + 1), "ranks run 1..n");
ok(j.total_matched === Object.values(j.counts).reduce((a, b) => a + b, 0), "total_matched is the sum of the verdict counts", JSON.stringify(j.counts));
ok(j.notes.some(n => /NOT live availability/.test(n)) && j.notes.some(n => /read from each home's size - Ejari rarely records them/.test(n)), "the notes say: not availability; bedrooms read from size");
ok((await brief(REF + "&limit=3")).j.results.length === 3 && (await brief(REF + "&limit=500")).j.query.limit === 50, "limit: honoured, at most 50");
ok((await brief("mode=rent&beds=1&min=60000&max=68000")).j.results.some(r => r.name === "MARINA ONE"), "no areas: all of Dubai");
ok(!names.includes("MARINA ONE"), "areas=jumeirahvillagecircle: Dubai Marina is left out");
ok(names.includes("SOME VILLAS") && !(await brief(REF + "&type=apartment")).j.results.some(r => r.name === "SOME VILLAS") && (await brief(REF + "&type=villa")).j.results.map(r => r.name).join() === "SOME VILLAS", "home type: any includes the villas, apartment leaves them out, villa is villas only");
ok((await brief(REF + "&type=apartment")).j.results.every(r => r.evidence.home === "apartment"), "type=apartment: apartments only");
ok((await brief("mode=rent&beds=2&min=80000&max=100000&areas=" + JVC)).j.results.map(r => r.name).join() === "Binghatti Nova", "beds=2 reads the 2-bed band");
ok(verdictOf(68000, 60000, 68000) === "within" && verdictOf(68001, 60000, 68000) === "a_little_above", "the boundary: 68,000 is within, 68,001 is a_little_above on a 68K max",
  verdictOf(68000, 60000, 68000) + " / " + verdictOf(68001, 60000, 68000));
ok(verdictOf(60000, 60000, 68000) === "within" && verdictOf(59999, 60000, 68000) === "below" && verdictOf(71400, 60000, 68000) === "a_little_above" &&
  verdictOf(71401, 60000, 68000) === "above" && verdictOf(78200, 60000, 68000) === "above" && verdictOf(78201, 60000, 68000) === null &&
  verdictOf(54000, 60000, 68000) === "below" && verdictOf(53999, 60000, 68000) === null && verdictOf(900000, 0, null) === "within",
  "the other edges: min is within, +5% exactly is a_little_above, beyond +5% above (listed to +15%), under min below (listed to -10%)");

// ---- 3. names must agree with the record --------------------------------------------------------------------
const rc = R.find(r => r.name === "Regent Court");
ok(rc && rc.app_id === null && rc.building_url === null && rc.key === "dld:regentcourt" && rc.disputed_bind.record_name === "Palatium Residences",
  "Regent Court bound to a footprint named Palatium Residences: shown by its register name, no building page, the dispute reported", JSON.stringify(rc));
ok(rc && rc.musts.metro === null && rc.nearest_metro === null, "... and the disputed footprint's position is not used either");
const ca = R.find(r => r.name === "Chaimaa Avenue");
const all10 = (await brief(REF + "&limit=50")).j.results;
const ca2 = all10.find(r => r.name === "Chaimaa Avenue 2");
ok(ca && ca.key === JVC + ":1192" && ca2 && ca2.app_id === null, "two records on one building: the exact name (Chaimaa Avenue) keeps it, Chaimaa Avenue 2 is shown by name only", JSON.stringify([ca && ca.key, ca2 && ca2.key]));
ok(new Set(all10.map(r => r.key)).size === all10.length, "every key in the list is unique");
ok(all10.every(r => /^[a-z0-9_:-]+$/.test(r.key)), "no key carries a comma or anything outside [a-z0-9_:-] (the /brief page joins keys with commas)", all10.map(r => r.key).join(" "));
ok(R.find(r => r.name === "Bloom Towers").record_name.agrees === "part", "Bloom Towers -> record 'Bloom Towers B': flagged 'part', not silently the same");
ok(nameAgrees(["Binghatti Nova"], "Binghatti Nova") === "yes" && nameAgrees(["O 2"], "O2") === "yes" && nameAgrees(["Fortunato"], "Fortunato 1") === "part" &&
  nameAgrees(["Beverly Residence"], "Beverly Crown") === "no" && nameAgrees(["THE SQUARE"], "Hanover Square") === "no", "nameAgrees: yes / part / no");

// ---- 4. musts -------------------------------------------------------------------------------------------------
ok(nova.musts.metro === true && nova.nearest_metro.name === "Near Station" && nova.nearest_metro.m < 400, "metro within a straight-line km: true, with the station and distance", JSON.stringify(nova.nearest_metro));
const bt = R.find(r => r.name === "Bloom Towers");
ok(bt.musts.metro === false, "the nearest station 1 km+ away: false (the RTA list is the whole network)");
ok(bt.musts.schools === true && nova.musts.schools === null, "a school within 1 km: true; none found: null, never false");
ok(nova.musts.pool === true && nova.musts.gym === true && nova.musts.parking === true, "pool and gym from the developer's page, parking from the building record");
ok(amb.musts.metro === null && amb.musts.pool === true, "no position: metro unknown (null); pool from its brochure");
ok(R.every(r => r.musts.balcony === null && r.musts.new === null), "balcony and 'newer building' have no source: null everywhere");
ok(Object.keys(nova.musts).join() === "balcony,metro,pool,gym,parking,new,schools", "all seven musts are answered for every building");
let mx = (await brief(REF + "&musts=metro")).j;
ok(!mx.results.some(r => r.name === "Bloom Towers") && mx.results.some(r => r.name === "Binghatti Nova") && mx.results.some(r => r.name === "Binghatti Amber"),
  "musts=metro: Bloom Towers (a source says no) is left out; Nova (yes) and Amber (unknown) stay", mx.results.map(r => r.name).join(" | "));
ok(mx.notes.some(n => /left out because a source says a non-negotiable is missing/.test(n)), "and the notes say why");
ok(nova.completeness.record && nova.completeness.layouts && nova.completeness.photos && nova.brochure === "/img/brochure_" + JVC + "_1490", "completeness: record, layouts, developer photos", JSON.stringify(nova.completeness));
ok(!R.find(r => r.name === "BLOOM HEIGHTS").completeness.photos, "no brochure: photos false");

// ---- 5. estimated left --------------------------------------------------------------------------------------
ok(!("estimated_left" in nova) && /only 46% of this district's running tenancies reach a building/.test(nova.estimated_left_withheld), "JVC tenancy coverage 46% is under the building page's 50% gate: estimated_left omitted, and why", JSON.stringify(nova.estimated_left_withheld));
ok(estLeft(UMX.buildings_by_id["1490"], Object.assign({}, TEN, { coverage: { share_bound: 0.6 } }), 1490, 1).about === 140, "at 60% coverage: 178 one-beds in the units list less 38 running tenancies = about 140");
const e1 = estLeft(UMX.buildings_by_id["1490"], Object.assign({}, TEN, { coverage: { share_bound: 0.6 } }), 1490, 1);
ok(e1.about === 140 && e1.of === 178 && e1.running === 38 && e1.label === "an estimate, not a count" && /real number is lower/.test(e1.explain) && /never the number available/.test(e1.explain) && e1.as_at === "2026-09-09",
  "{about, of} as the /brief page reads it; labelled an estimate, says the real number is lower, never availability", JSON.stringify(e1));
ok(/3 buildings/.test(estLeft(UMX.buildings_by_id["892"], Object.assign({}, TEN, { coverage: { share_bound: 0.9 } }), 892, 1).withheld), "a units-register property of 3 buildings: withheld");
ok(/whole project/.test(estLeft(UMX.buildings_by_id["1490"], { coverage: { share_bound: 0.9 }, buildings_by_id: { "1490": { by_type: { "1 bedroom": 10 }, scope: "project" } } }, 1490, 1).withheld), "a project-wide tenancy count: withheld");
ok(/no Ejari tenancy file/.test(estLeft(UMX.buildings_by_id["1490"], null, 1490, 1).withheld), "no tenancy file: withheld");
ok(!("estimated_left" in amb) && /no building record/.test(amb.estimated_left_withheld), "an unbound building: omitted, and why");
store.set("img_tenancy_" + JVC, JSON.stringify(Object.assign({}, TEN, { coverage: { share_bound: 0.6 } })));
const hi = (await brief(REF)).j.results.find(r => r.name === "Binghatti Nova");
ok(hi.estimated_left && hi.estimated_left.about === 140 && hi.estimated_left.of === 178 && !("estimated_left_withheld" in hi), "through the route, over the gate: estimated_left {about: 140, of: 178}", JSON.stringify(hi.estimated_left));
setAll();
ok(j.notes.some(n => /estimated_left is T minus R/.test(n) && /an estimate, not a count/.test(n)), "the notes define it");
// the beds-left register, when on file, is preferred
store.set("img_beds_left_" + JVC, JSON.stringify(BEDS_LEFT));
let BLr = (await brief(REF + "&limit=50")).j.results;
const el = (n) => { const r = BLr.find(x => x.name === n); return r && r.estimated_left ? [r.estimated_left.about, r.estimated_left.of] : null; };
ok(JSON.stringify(el("Binghatti Nova")) === "[140,178]", "Nova, matched by key: about 140 of 178 (178 - 37 = 141, to the nearest 10) - the register wins over the 46% gate", JSON.stringify(el("Binghatti Nova")));
ok(JSON.stringify(el("Binghatti Amber")) === "[380,502]" && JSON.stringify(el("Bloom Towers")) === "[380,463]" && JSON.stringify(el("BLOOM HEIGHTS")) === "[250,316]" && JSON.stringify(el("Binghatti Mirage")) === "[80,92]",
  "matched by DLD project name, bound or not: Amber 380 of 502, Bloom Towers 380 of 463, Bloom Heights 250 of 316, Mirage 80 of 92", JSON.stringify(["Binghatti Amber", "Bloom Towers", "BLOOM HEIGHTS", "Binghatti Mirage"].map(el)));
const bn1 = BLr.find(x => x.name === "Binghatti Nova");
ok(bn1.estimate_as_of === "2026-09-30" && bn1.estimated_left.running === 37 && bn1.estimated_left.label === "an estimate, not a count" && /never the number available/.test(bn1.estimated_left.explain) && /DDA/.test(bn1.estimated_left.source),
  "estimate_as_of, R, the label and the source are carried", JSON.stringify(bn1.estimated_left));
ok(/not in the beds-left register/.test(BLr.find(x => x.name === "Regent Court").estimated_left_withheld) && !("estimated_left" in BLr.find(x => x.name === "Regent Court")),
  "a building the register does not list: omitted, and why - never filled from the gated path");
ok(String(JSON.stringify((await brief("mode=rent&beds=2&min=80000&max=100000&areas=" + JVC)).j.results[0].estimated_left)).includes('"about":20,"of":30'), "the bedroom band is matched: Nova 2-bed about 20 of 30");
ok(bedsLeftRow({ rows: [{ dld_project: "CANAL VIEWS", beds: "1", T: 10, R: 1 }] }, { key: "x", name: "BLOOM HEIGHTS", aliases: ["CANAL VIEWS"] }, 1).T === 10 &&
  bedsLeftRow({ rows: [{ dld_project: "Bloom", beds: "1", T: 10, R: 1 }] }, { key: "x", name: "Bloom Towers B", aliases: [] }, 1) === null &&
  bedsLeftRow({ rows: [{ key: "a:1", beds: "3+", T: 10, R: 1 }] }, { key: "a:1", name: "Z" }, 3).T === 10, "matching: an alias counts, a different name does not, '3+' is band 3");
setAll();

// ---- 6. buy -------------------------------------------------------------------------------------------------
let b = (await brief("mode=buy&beds=1&min=600000&max=700000&areas=" + JVC)).j;
ok(b.results.map(r => r.name).join() === "Binghatti Nova", "buy 1-bed AED 600-700K: Binghatti Nova only", b.results.map(r => r.name).join(" | "));
const bn = b.results[0];
ok(bn && bn.evidence.basis === "dld_sales" && bn.evidence.median === 640000 && bn.evidence.n === 283 && bn.evidence.q1 === null && bn.evidence.n_new === null && bn.evidence.latest === "2026-08-27",
  "the register median with its per-bedroom sale count; no middle half invented", JSON.stringify(bn && bn.evidence));
ok(!("estimated_left" in bn), "buy results carry no 'left' estimate");
ok(b.notes.some(n => /no sale count for that bedroom type/.test(n)) && b.notes.some(n => /fewer than 3 sales/.test(n)), "no count and thin counts are left out, and said so");
ok(!b.results.some(r => r.name === "Guess Tower") && !b.results.some(r => r.name === "A Launch"), "an estimated price and a launch without a record are never offered");
b = (await brief("mode=buy&beds=3&min=2000000&max=3000000&type=villa&areas=" + JVC)).j;
ok(b.results.length === 1 && b.results[0].name === "Villa Park" && b.results[0].evidence.beds === 4 && b.results[0].evidence.n === 30, "3+ beds: the bedroom count with most sales in budget (4-bed, 30 sales)", JSON.stringify(b.results.map(r => r.evidence)));

// ---- a gzipped value in KV reads the same --------------------------------------------------------------------
const gz = zlib.gzipSync(Buffer.from(JSON.stringify(RI)));
store.set("img_rent_index", gz.buffer.slice(gz.byteOffset, gz.byteOffset + gz.byteLength));
ok((await brief(REF)).j.results[0].name === "Binghatti Amber", "a gzipped rent index reads the same");
store.delete("img_rent_index");
ok((await brief(REF)).status === 503, "no rent index on file: 503, never an empty 'no buildings'");
setAll();
ok(writes === 0, "the route never writes to KV");

// ---- 7. the change to src/index.js ----------------------------------------------------------------------------
ok((SRC.match(/from "\.\/brief\.js"/g) || []).length === 1 && (SRC.match(/briefApi\(/g) || []).length === 1, "src/index.js: one import, one dispatch");
ok(/if \(keyTier\(env, url\) === "client" && !clientPathOk[^\n]*\n\s*\/\/ ==== BRIEF \(Contract A\)[\s\S]{0,400}if \(url\.pathname === "\/brief_api"\) return briefApi\(request, env, url, \{ clientOk \}\);/.test(SRC), "the dispatch is marked and sits directly below the client-path gate");
ok(/const CLIENT_PATHS = \[[^\]]*"\/brief_api"\]/.test(SRC), "/brief_api is in CLIENT_PATHS (and in APP_PAGES in test_v156, which checks the two agree)");

// ---- 8. the real index: the reference question ---------------------------------------------------------------
const real = (() => { try { return fs.readFileSync(path.join(NAJ, "board", "rent_index.json"), "utf8"); } catch { return null; } })();
if (!real) console.log("  skip real index - set NAJ_DATA to the naj-market-pulse data directory");
else {
  store.clear();
  store.set("img_rent_index", real);
  for (const f of ["districts_geo", "unitmix_" + JVC, "tenancy_" + JVC]) { try { store.set("img_" + f, fs.readFileSync(path.join(NAJ, "board", f + ".json"), "utf8")); } catch {} }
  const noBL = (await brief(REF + "&limit=50")).j.results;
  store.set("img_beds_left_" + JVC, JSON.stringify(BEDS_LEFT));
  const rj = (await brief(REF + "&limit=50")).j, rr = rj.results;
  console.log("  real " + rj.source + ": " + rj.total_matched + " matched " + JSON.stringify(rj.counts) + "; top 10: " + rr.slice(0, 10).map(r => r.name + " " + r.evidence.median + " (" + r.evidence.n + ")").join(", "));
  const top10 = rr.slice(0, 10).map(r => [r.name].concat(r.aliases).map(nkey)).flat();
  ok(["binghattiamber", "bloom", "bloomheights", "binghattinova"].every(k => top10.includes(k)), "the reference four - Binghatti Amber, Bloom Towers, Bloom Heights (Canal Views), Binghatti Nova - are all in the top 10");
  const strict = rr.filter(r => r.evidence.median >= 60000 && r.evidence.median <= 68000);
  ok(strict.length >= 26 && rr.slice(0, strict.length).every(r => r.evidence.median <= 68000), "at least 26 buildings strictly inside 60-68K, all ranked before anything over 68K", strict.length);
  ok(rr.every(r => r.evidence.n >= 3 && r.evidence.median >= 54000 && r.evidence.median <= 78200), "every real answer has 3+ contracts and sits in the offered window");
  ok(rr.filter(r => [r.name].concat(r.aliases).some(n => /^CANAL VIEWS$/i.test(n))).length === 1, "CANAL VIEWS appears once");
  ok(new Set(rr.map(r => r.key)).size === rr.length, "no key twice");
  ok(rr.filter(r => r.app_id != null).every(r => r.record_name && r.record_name.agrees !== "no"), "no bound result disagrees with its record's name");
  ok(noBL.every(r => !("estimated_left" in r) && r.estimated_left_withheld), "without the beds-left register (JVC tenancy coverage 46%): no estimate on any row, each says why");
  const est = Object.fromEntries(rr.filter(r => r.estimated_left).map(r => [r.name, r.estimated_left.about + "/" + r.estimated_left.of]));
  console.log("  real + beds-left stub, estimates: " + JSON.stringify(est));
  ok(est["Binghatti Amber"] === "380/502" && est["Bloom Towers"] === "380/463" && est["BLOOM HEIGHTS"] === "250/316" && est["Binghatti Nova"] === "140/178" && est["Binghatti Heights"] === "190/248" &&
     est["Binghatti Emerald"] === "160/217" && est["ROYALE GARDEN RESIDENCE"] === "60/80" && est["Binghatti Gardenia"] === "140/180" && est["Binghatti Luna"] === "130/160",
    "with the register: every stubbed building in the list carries its estimate (Elysee III by Pantheon through its alias on ROYALE GARDEN RESIDENCE)", JSON.stringify(est));
  setAll();
}

console.log((fail ? "FAIL" : "PASS") + " - brief api: " + pass + " ok, " + fail + " failed");
process.exit(fail ? 1 : 0);
