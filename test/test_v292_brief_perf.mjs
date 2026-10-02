// v292 - THE BRIEF SEARCH'S READS (Kendall, 2 Oct 2026: "every /brief_api search takes 43-49 s").
//
// What was measured first (live, read-only, wrangler tail on azimuth-2): a single-district search is 78-480 ms of wall time on the
// server, and the 43-49 s was the laptop's own connection set-up - PowerShell's first request in a process took 43 s to example.com
// and cloudflare.com as well, and the second request on the same connection took 0.4 s. What the server DID do badly: every search
// read its files one after another - eleven KV round trips in a row (districts, rent index, unit-mix, brochures, the amenity layer,
// the amenity facts, the developer sheets, the beds-left register, the Google district files, the advertised supply), each a cold
// read when the last search was over a minute ago, and it read and parsed every file again on every search. Locally, at 200 ms a
// cold read, that was 2.3 s for Business Bay and 3.2 s for DAMAC Hills with must-haves; an all-Dubai search read 258 values (40 MB).
//
// What this proves, against a KV stub that counts every read and answers after LAT ms:
//   P1 a cold search starts its reads in at most 4 waves (it was 9-10): the reads that do not depend on each other start together
//   P2 no file is read twice in one search
//   P3 the same search again, inside KV_MEMO_TTL_MS: no KV read at all, and the same answer
//   P4 a different search in the same district reads only what it has not read (here: nothing new)
//   P5 the memo ends: past KV_MEMO_TTL_MS the files are read again, and a value changed in KV is the one used
//   P6 the memo is bounded: a value over half of KV_MEMO_MAX_BYTES is never kept
//   P7 Google is asked for must-haves: its district files are read in the same wave as the unit-mix cards, not after
// NEGATIVE CONTROL (run 2 Oct 2026): BRIEF_SRC=C:/Dev/_live_v291/src/ node test/test_v292_brief_perf.mjs - the v291 code fails 5:
// P1 (10 waves, 1012 ms), P3 and P4 (10 reads again), P5 "inside the TTL" (nothing is kept) and P7 (11 waves, the Google district files
// read 930 ms in); P2 and P6 pass there too (v291 never read a file twice in one search, and kept nothing).
// In-test control: with the memo dropped between two searches the second one reads every file again (the counter counts).
//
//   node test/test_v292_brief_perf.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = process.env.BRIEF_SRC || path.join(HERE, "..", "src") + path.sep;
const B = await import(pathToFileURL(path.join(SRC, "brief.js")).href);
const L = await import(pathToFileURL(path.join(SRC, "live_answers.js")).href);
const reset = B.__resetKvMemo || (() => {});
const setClock = B.__setKvMemoClock || (() => {});
const TTL = B.KV_MEMO_TTL_MS || 120000, MAXB = B.KV_MEMO_MAX_BYTES || 12e6;

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };

// ---- the KV stub: every read counted, with its start time; LAT ms a read ------------------------------------------------------------
const LAT = 80;
const store = new Map();
let log = [], T0 = 0;
const KV = {
  async get(k, t) {
    const ty = t && typeof t === "object" ? t.type : t;
    log.push({ k, at: performance.now() - T0 });
    await new Promise((r) => setTimeout(r, LAT));
    if (!store.has(k)) return null;
    const v = store.get(k);
    if (ty === "arrayBuffer") return typeof v === "string" ? new TextEncoder().encode(v).buffer : v;
    return typeof v === "string" ? v : new TextDecoder().decode(v);
  },
  async list(o) { const p = (o && o.prefix) || ""; await new Promise((r) => setTimeout(r, LAT)); return { keys: [...store.keys()].filter((k) => k.startsWith(p)).map((name) => ({ name })), list_complete: true }; },
};
const env = { MEETINGS: KV };
const waves = () => { const w = []; for (const e of log) if (!w.some((s) => Math.abs(s - e.at) < LAT / 2)) w.push(e.at); return w.length; };
const reads = (k) => log.filter((e) => e.k === k).length;
const run = async (qs, o) => { log = []; T0 = performance.now(); const out = await B.briefSearch(o && o.env || env, new URLSearchParams(qs), { owner: true, ...(o || {}) }); return { out, ms: performance.now() - T0, n: log.length }; };

// ---- a small Business Bay in the real shapes ------------------------------------------------------------------------------------------
const D = "businessbay";
const S = (n, nn, m) => ({ n, nn, nr: n - nn, m, q1: m - 5000, q3: m + 5000, ...(nn >= 3 ? { mn: m, q1n: m - 5000, q3n: m + 5000 } : {}), s: 80, last: "2026-09-28" });
const RI = { as_of: "2026-10-01", window: ["2026-08-01", "2026-09-30"], items: [
  { p: "alpha", n: "Alpha Tower", area: "Business Bay", d: D, i: 10, lon: 55.27, lat: 25.18, b: { "2": S(12, 6, 110000) } },
  { p: "beta", n: "Beta Residences", area: "Business Bay", d: D, i: 11, lon: 55.271, lat: 25.181, b: { "2": S(8, 4, 115000) } },
  { p: "gamma", n: "Gamma Heights", area: "Business Bay", d: D, b: { "2": S(5, 3, 100000) } },
] };
const put = (k, o) => store.set("img_" + k, JSON.stringify(o));
put("districts_geo", { districts: [{ slug: D, name: "Business Bay", bbox: [55.25, 25.17, 55.29, 25.2] }] });
put("rent_index", RI);
put("unitmix_" + D, { buildings_by_id: { "10": { name: "Alpha Tower", rows: [], pools: 1, dld: { buildings: 1 } }, "11": { name: "Beta Residences", rows: [] } } });
put("amenities", { items: [{ k: "metro", n: "Business Bay", lon: 55.272, lat: 25.182 }, { k: "school", n: "A School", lon: 55.27, lat: 25.18 }] });
put("amenities_" + D, { homes: [{ key: D + ":10", keys: [D + ":10"], names: ["Alpha Tower"], facts: { gym: { v: true, level: "building", say: "Gym", source_name: "the units register" } } }] });
put("beds_left_" + D, { as_of: "2026-09-30", rows: [{ key: D + ":10", beds: "2", T: 100, R: 60 }] });
put("avail_index", { sheets: [{ sheet: "Dev sheet", d: "devco" }] });
put("drill_devco", { claimed: { as_of: "2026-09-20", source: "DevCo sheets", detail: [{ p: "Beta Residences", units: [["1201", "2 BR", 1200, 2100000, "sea"]] }] } });
put("brochure_" + D + "_10", { name: "Alpha Tower", amenities: ["Gym", "Swimming pool", "Balcony"] });
put("pf_supply_" + D, { as_of: "2026-10-01", rows: [] });
put("amenity_counts_" + D, { name: "Business Bay", area: { centroid: { lat: 25.18, lng: 55.27 } }, google_requests: { body: { filter: { locationFilter: { customArea: { polygon: { coordinates: [{ latitude: 25.17, longitude: 55.25 }, { latitude: 25.17, longitude: 55.29 }, { latitude: 25.2, longitude: 55.29 }, { latitude: 25.2, longitude: 55.25 }] } } } } } } });
put("anchors_" + D, { anchors: [] });

const Q = "mode=rent&beds=2&min=0&max=120000&areas=" + D + "&type=any&furnished=either&musts=&nice=&limit=10";
console.log("v292 brief search reads (KV " + LAT + " ms a read; source " + SRC + ")");

// P1 + P2 - cold
reset();
const cold = await run(Q);
ok(cold.out.status === 200 && cold.out.body.results.length === 3, "the search answers (3 buildings)", JSON.stringify(cold.out.body).slice(0, 300));
ok(waves() <= 4, "P1 a cold search reads in at most 4 waves (" + waves() + " waves, " + cold.n + " reads, " + Math.round(cold.ms) + " ms)", log.map((e) => Math.round(e.at) + " " + e.k).join(", "));
const twice = [...new Set(log.map((e) => e.k))].filter((k) => reads(k) > 1);
ok(!twice.length, "P2 no file is read twice in one search", twice.join(", "));

// P3 - again, inside the TTL
const warm = await run(Q);
ok(warm.n === 0, "P3 the same search again inside the TTL reads nothing from KV (" + warm.n + " reads, " + Math.round(warm.ms) + " ms)", log.map((e) => e.k).join(", "));
ok(JSON.stringify(warm.out.body) === JSON.stringify(cold.out.body), "P3b and gives the same answer, byte for byte");

// P4 - another search in the same district
const other = await run(Q.replace("max=120000", "max=200000").replace("limit=10", "limit=2"));
ok(other.out.status === 200 && other.n === 0, "P4 another search in the same district reads nothing new (" + other.n + " reads)", log.map((e) => e.k).join(", "));

// in-test control: the memo dropped, everything is read again (the counter counts)
reset();
const again = await run(Q);
ok(again.n === cold.n, "control: with the memo dropped the same search reads every file again (" + again.n + " of " + cold.n + ")");

// P5 - the memo ends at the TTL; a changed value is then the one used
let now = 1e12; setClock(() => now);
reset();
await run(Q);
const RI2 = JSON.parse(JSON.stringify(RI)); RI2.items[0].b["2"] = S(12, 6, 99000); put("rent_index", RI2);
now += TTL - 1000;
const inside = await run(Q);
const fig = (r) => { const x = r.out.body.results.find((y) => y.name === "Alpha Tower"); return x && x.evidence.median; };
ok(reads("img_rent_index") === 0 && fig(inside) === 110000, "P5 inside the TTL the kept rent index is used (no read; Alpha still AED 110,000)", "reads " + reads("img_rent_index") + ", figure " + fig(inside));
now += 2000;
const after = await run(Q);
ok(reads("img_rent_index") === 1 && fig(after) === 99000, "P5b past the TTL it is read again and the new figure is used (AED 99,000)", "reads " + reads("img_rent_index") + ", figure " + fig(after));
setClock(null); put("rent_index", RI);

// P6 - a value over half the budget is never kept
reset();
const big = { as_of: "2026-10-01", window: RI.window, pad: "x".repeat(Math.ceil(MAXB / 2) + 1000), items: RI.items };
put("rent_index", big);
await run(Q); const r1 = reads("img_rent_index");
await run(Q); const r2 = reads("img_rent_index");
ok(r1 === 1 && r2 === 1, "P6 a rent index over half of KV_MEMO_MAX_BYTES is read each time, never kept (" + r1 + ", " + r2 + ")");
ok(!B.kvMemoStats || B.kvMemoStats(KV).bytes <= MAXB, "P6b the memo stays inside its budget (" + (B.kvMemoStats ? B.kvMemoStats(KV).bytes : "n/a") + " bytes)");
put("rent_index", RI);

// P7 - Google asked for a must-have: its district files come with the unit-mix cards, not after them
reset();
L.__setLiveFetch(async () => { await new Promise((r) => setTimeout(r, LAT)); return new Response(JSON.stringify({ places: [] }), { status: 200 }); });
const genv = { MEETINGS: KV, GOOGLE_MAPS_KEY: "test" };
const live = await run(Q.replace("musts=", "musts=gym,community_pool"), { env: genv });
const at = (k) => { const e = log.find((x) => x.k === k); return e ? e.at : null; };
ok(live.out.status === 200 && at("img_anchors_" + D) != null && Math.abs(at("img_anchors_" + D) - at("img_unitmix_" + D)) < LAT / 2,
  "P7 with Google asked, the district files are read alongside the unit-mix card (" + waves() + " KV waves, " + Math.round(live.ms) + " ms)", log.map((e) => Math.round(e.at) + " " + e.k).join(", "));
L.__setLiveFetch(null);

console.log((fail ? "FAIL" : "PASS") + " - v292 brief perf: " + pass + " ok, " + fail + " failed");
process.exit(fail ? 1 : 0);
