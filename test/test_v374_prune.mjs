// v374 - PRUNE (Kendall, 7 Oct 2026). In the Brief and the drill-down, anything we cannot say from a register or show with a
// picture is not offered: no question, chip, filter, comparison row or "not known" placeholder for it.
//   PULLED: private pool, community pool, pet-friendly, newer or modern, long-term quality, furnished
//   KEPT:   near a metro, schools nearby, gym, parking, balcony (and the register facts on the building page)
// Offline: stubbed KV, no network.   node test/test_v374_prune.mjs
import worker from "../src/index.js";
import { buildingData, buildingPageHtml } from "../src/building_page.js";
import { BRIEF_CRITERIA, BRIEF_MUSTS } from "../src/brief.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 500) : "")); } };

const READ = "client_read_key_in_links_123", CLIENT = "a_client_key_for_links_456";
const store = new Map();
const KV = { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter((k) => k.startsWith(p)).map((name) => ({ name })), list_complete: true }; } };
globalThis.fetch = async () => new Response("{}", { status: 200 });
const env = { MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: CLIENT, INGEST_TOKEN: "ING", PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
const call = (p) => worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev" + p), env, { waitUntil() {} });

const PULLED = ["private_pool", "community_pool", "pets", "modern", "long_term", "furnished"];
const KEPT = ["metro", "schools", "gym", "parking", "balcony"];
const PLACEHOLDER = /not known|unknown/i;
const PULLED_WORDS = /private pool|community pool|pet-friendly|pet friendly|furnished|newer or modern|long-term stay|dog park/i;

// ---- 1. the criteria list itself ----
ok(BRIEF_CRITERIA.map((c) => c[0]).join() === KEPT.join(), "T1 the Brief offers exactly metro, schools, gym, parking, balcony", BRIEF_CRITERIA.map((c) => c[0]).join());
ok(BRIEF_MUSTS.join() === "balcony,metro,gym,parking,schools", "T1b the musts list has no pool and no 'new'");

// ---- 2. the Brief page markup ----
const html = await (await call("/brief?key=" + READ)).text();
for (const k of PULLED) ok(!html.includes("data-k=" + k) && !html.includes("data-v=" + k), "T2 the Brief page offers no '" + k + "' chip or question");
for (const k of KEPT) ok(html.includes("data-k=" + k), "T2k the Brief page still offers '" + k + "'");
ok(!PULLED_WORDS.test(html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/\/\/.*$/gm, "")), "T2b no pulled wording anywhere in the page", (html.match(PULLED_WORDS) || [""])[0]);
ok(!PLACEHOLDER.test(html.replace(/<style[\s\S]*?<\/style>/g, "")), "T2c no 'not known' / 'unknown' placeholder strings in the page or its script", (html.match(PLACEHOLDER) || [""])[0]);
ok(!/id=s-furn|id=ffurn/.test(html) && /id=s-where/.test(html) && /id=s-musts/.test(html), "T2d the furnished step is gone, where and must-haves remain");
const old = await (await call("/brief?key=" + READ + "&musts=pool,pets,gym&nice=modern,long_term&furnished=furnished")).text();
ok(/\\"musts\\":\[\\"gym\\"\]|"musts":\["gym"\]/.test(old) && !/"furnished"/.test(old.slice(old.indexOf("__BRIEF"), old.indexOf("__BRIEF") + 600)), "T2e an old shared link: pulled chips and furnished fall away, gym stays");

// ---- 3. the search API, with an old link that still names the pulled things ----
const vS = (n, m) => ({ n, nn: n, nr: 0, m, q1: m - 5000, q3: m + 5000, mn: m, q1n: m - 5000, q3n: m + 5000, s: 60, last: "2026-09-28" });
store.set("img_rent_index", JSON.stringify({ as_of: "2026-09-30", window: ["2026-08-01", "2026-09-30"], items: [
  { p: "alpha", n: "ALPHA TOWER", area: "Test Area", d: "testd", i: 10, lon: 55.25, lat: 25.03, b: { "1": vS(10, 60000) } },
], areas: [{ area: "Test Area", d: "testd", b: { "1": vS(10, 60000) } }] }));
store.set("img_districts_geo", JSON.stringify({ districts: [{ slug: "testd", name: "Test District", bbox: [55.2, 25.0, 55.3, 25.05] }] }));
store.set("img_unitmix_testd", JSON.stringify({ buildings_by_id: { "10": { status: "verified", name: "Alpha Tower", pools: 2, car_parks: 240, dm: { construction_year: 2016 }, rows: [] } } }));
store.set("img_amenities", JSON.stringify({ items: [{ k: "park", n: "Park", lon: 55.251, lat: 25.031 }, { k: "school", n: "A School", lon: 55.252, lat: 25.031 }] }));
store.set("img_brochure_name_alpha_tower", JSON.stringify({ name: "Alpha Tower", amenities: ["Gym", "Swimming pool", "Pet park"], photos: [] }));
const r = await call("/brief_api?mode=rent&beds=1&max=70000&areas=testd&compare=1&musts=pets,community_pool,modern,parking&nice=private_pool,long_term,gym&furnished=furnished&key=" + READ);
const j = await r.json();
const res = (j.results || [])[0] || {};
ok(r.status === 200 && res.name === "ALPHA TOWER", "T3 the search still answers");
ok(j.query.musts.join() === "parking" && j.query.nice.join() === "gym", "T3a pulled musts and nice-to-haves are dropped; parking and gym stay", JSON.stringify(j.query));
ok((res.criteria || []).map((c) => c.k).sort().join() === "gym,parking", "T3b the row answers only gym and parking", JSON.stringify(res.criteria));
ok(res.criteria.find((c) => c.k === "parking").v === true && res.criteria.find((c) => c.k === "gym").v === true, "T3c parking (Land Department record) and gym (developer page) still answer yes");
ok(!("furnished_hint" in res) && !JSON.stringify(j).includes("furnished_hint") && !("pool" in res.musts) && !("new" in res.musts), "T3d no furnished hint, no pool or new in musts");
ok(!j.comparison, "T3e one area, no comparison"); // the comparison rows are covered with two areas in test_brief_api.mjs (V-A4)
const j2 = await (await call("/brief_api?mode=rent&beds=1&max=70000&areas=testd,testd2&compare=1&key=" + READ)).json();
ok(!j2.comparison || j2.comparison.every((a) => !("pools" in a) && !("parks" in a) && !("newest" in a)), "T3f the comparison carries no pools, parks or newest completion");
const notes = (j.notes || []).join(" ");
ok(!/private pools|pet rules|Newer or modern|Long-term quality|Furnished:/.test(notes), "T3g the owner notes no longer describe pulled questions", notes.slice(0, 300));

// ---- 4. the drill-down (building page) ----
const D = buildingData("testd", 10, {}, { buildings_by_id: { "10": { status: "verified", name: "Alpha Tower", pools: 2, car_parks: 240, dm: { construction_year: 2016, completed: "2016" },
  rows: [{ type: "1 bedroom", units: 100, basis: "DLD units register", median_aed: 700000, sqft: 700, bal: 90 }] } } }, null, null, null, "Test District", null, null, null, null);
if (!D) ok(false, "T4 buildingData returned nothing for the stub");
else {
  const bp = buildingPageHtml(D, READ);
  const body = bp.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<script[\s\S]*?<\/script>/g, (s) => s);
  ok(/Parking/.test(bp) && /240 bays/.test(bp), "T4 the building page still shows parking (Land Department record) - 240 bays");
  ok(!PULLED_WORDS.test(body), "T4b the building page carries no pulled wording", (body.match(PULLED_WORDS) || [""])[0]);
  ok(!/not known/i.test(bp), "T4c no 'not known' placeholder on the building page");
}

console.log((fail ? "FAIL" : "PASS") + " - v374 prune: " + pass + " ok, " + fail + " failed");
process.exit(fail ? 1 : 0);
