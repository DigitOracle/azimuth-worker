// v519 - the all-Dubai twin: #2 find a building by name, #6 only the buildings Property Finder advertises now (Kendall 11 Oct 2026);
// the building page's "Sales on record" resale multiples hidden ("not value added").
import fs from "node:fs";
import { advertisedItems, plotItems, mergeIndex, cityBldgRoute } from "../src/city_bldg.js";
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };

// 1. the index: names from the advert rows, positions from the footprint layer, merged onto the plots by register key
// the layer's affine maps (lon, lat) -> metres: x = 1e5 (lon - 55.2), y = 1e5 (lat - 25.1); the code inverts it
const layer = { ll: [1e5, 0, -55.2e5, 0, 1e5, -25.1e5], b: [[42, 30, [0, 0, 10, 0, 10, 10, 0, 10, 0, 0]]] };
const doc = { as_of: "2026-10-10", rows: [{ key: "businessbay:42", dld_project: "PENINSULA FOUR" }, { key: "businessbay:7", dld_project: "OTHER TOWER" }],
  adverts: { "bb-other": { "1": [{ lat: 25.2, lon: 55.3 }, { lat: 25.2002, lon: 55.3002 }, { lat: 25.9, lon: 55.9 }] } },
  advertised: { as_of: "2026-10-10", buildings: {
    "bb-peninsula-four": { key: "businessbay:42", bands: { studio: { flats: 28, adverts: 102 }, "1": { flats: 35, adverts: 123 } } },
    "bb-other": { key: "businessbay:7", bands: { "2": { flats: 3, adverts: 5 } } },
    "bb-none": { key: "businessbay:9", bands: {} } } } };
const items = advertisedItems(doc, layer, "businessbay");
const p4 = items.find((x) => x.k === "businessbay:42"), ot = items.find((x) => x.k === "businessbay:7");
ok(p4 && p4.n === "Peninsula Four" && p4.f === 63 && p4.b.studio === 28 && p4.b["1"] === 35, "advertised building: register name, flats per bedroom type", p4);
ok(p4 && Math.abs(p4.lat - 25.10005) < 1e-4 && Math.abs(p4.lon - 55.20005) < 1e-4, "position = the building's own footprint centre", p4);
ok(ot && Math.abs(ot.lat - 25.2002) < 1e-6 && Math.abs(ot.lon - 55.3002) < 1e-6, "no footprint: the median of its adverts' own pins (a stray pin cannot move it)", ot);
ok(!items.find((x) => x.k === "businessbay:9"), "a building with no flats and no adverts is left out");
const plots = { features: [{ geometry: { coordinates: [55.21, 25.11] }, properties: { name: "PENINSULA FOUR, THE PLAZA", district: "businessbay", i: 42 } },
  { geometry: { coordinates: [55.25, 25.15] }, properties: { name: "QUIET TOWER", district: "businessbay", i: 3 } }] };
const M = mergeIndex(plotItems(plots), [items]);
const m42 = M.filter((x) => x.k === "businessbay:42");
ok(m42.length === 1 && m42[0].n === "Peninsula Four, The Plaza" && m42[0].f === 63 && m42[0].lat === 25.11, "merge: one record per key, the plot's name and point, the advert figures", m42);
ok(M.find((x) => x.k === "businessbay:3" && !x.f) && M.find((x) => x.k === "businessbay:7" && x.f === 3), "named projects without adverts stay searchable; advertised buildings without a plot are added");

// 2. the route: keyed, cached in KV
const store = new Map([["img_plots", JSON.stringify(plots)], ["img_pf_supply_businessbay", JSON.stringify(doc)], ["img_brief_fp_businessbay", JSON.stringify(layer)]]);
const env = { MEETINGS: { get: async (k, t) => { const v = store.has(k) ? store.get(k) : null; if (v == null) return null; return t === "arrayBuffer" ? new TextEncoder().encode(v).buffer : v; },
  put: async (k, v) => { store.set(k, v); }, list: async ({ prefix }) => ({ keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })) }) } };
const deps = { clientOk: (e, u) => ["ok", "own"].includes(u.searchParams.get("key")), tier: (e, u) => ({ ok: "client", own: "admin" })[u.searchParams.get("key")] || "" };
let r = await cityBldgRoute(env, new URL("https://w.example/city_bldg"), deps);
ok(r.status === 401, "no key: refused");
r = await cityBldgRoute(env, new URL("https://w.example/city_bldg?key=ok"), Object.assign({ method: "POST" }, deps));
ok(r.status === 401, "POST with a client key: refused (GET only)");
r = await cityBldgRoute(env, new URL("https://w.example/city_bldg?key=ok"), deps);
ok(r.status === 200 && !store.has("city_bldg_idx"), "client key: the index, built in memory, nothing written");
r = await cityBldgRoute(env, new URL("https://w.example/city_bldg?key=own"), deps);
const j = await r.json();
ok(r.status === 200 && j.advertised === 2 && j.as_of === "2026-10-10" && j.items.length === 3 && store.has("city_bldg_idx"), "owner key: the merged index, counted and cached", j);

// 3. the twin wiring
const src = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
ok(/if \(url\.pathname === "\/city_bldg"\) return cityBldgRoute\(env, url, \{ clientOk, tier: keyTier, method: request\.method \}\);/.test(src) && /const CLIENT_PATHS = \[("\/adv_bldg", )?"\/city_bldg",/.test(src), "route mounted, client keys allowed, method and key tier passed");
ok(/CITY_PLACES_HTML \+ CITY_ADV_HTML \+ '<\/div><div id=panel><\/div>'/.test(src), "the ADVERTISED NOW panel sits in the city stack after PLACES");
ok(/q\.oninput=\(\)=>\{const v=norm\(q\.value\);/.test(src) && /function pickBuilding\(it\)\{/.test(src), "the search box finds buildings as well as districts");
ok(/pickBuilding\(it\)\{sr\.style\.display="none";q\.value=it\.n;q\.blur\(\);HILITE=it\.inst;if\(it\.dIx>=0\)\{AMDIST=it\.dIx;/.test(src), "picking a building focuses its district and lights it");
ok(/if\(i===HILITE\)continue;if\(di\[i\]!==AMDIST\|\|\(\(ks\.length\|\|ADV\.on\)&&!AMKEEP\.has\(i\)&&!ADVKEEP\.has\(i\)\)\)hide\(i\)/.test(src), "in a district: kinds and advertised buildings stand, the searched building always stands");
ok(/if\(ADV\.on\)for\(let i=0;i<n;i\+\+\)\{if\(i!==HILITE&&!ADVKEEP\.has\(i\)\)hide\(i\)\}/.test(src), "across Dubai with the filter on, only the advertised buildings stand");
ok(/c\.set\(0xC5A56A\);ADVKEEP\.forEach/.test(src), "advertised buildings are gold");
ok(/if\(ix!==AMDIST\)HILITE=-1;/.test(src) && /AMALL\.onclick=\(\)=>\{AMDIST=-1;HILITE=-1;/.test(src), "a new district or all Dubai clears the searched building");
ok(!/\\"/.test(src.slice(src.indexOf("// ===== v519 CITY BUILDINGS: #2"), src.indexOf("// ===== v519 CITY BUILDINGS - end"))), "no backslash-quote inside the template literal (it would reach the browser as a bare quote)");

// the wrong-place fly: never inside the handover, and the handover opens the chosen district
const tb = fs.readFileSync(new URL("../src/twin_blocks.js", import.meta.url), "utf8");
ok(/flyPoint\(p\[0\],p\[1\],Math\.max\(r\|\|1600,1400\)\)/.test(src), "a fly to a place stops outside the 1.7 km handover (1400 -> about 2 km)");
ok(/function amRecalc\(\)\{window\.__cityFocus=AMDIST;/.test(src) && /go\(window\.__cityFocus>=0\?window\.__cityFocus:near\(\)\)/.test(tb), "zooming in by hand opens the district chosen, not the nearest centre");

// 4. building page: the resale multiples are hidden
const bp = fs.readFileSync(new URL("../src/building_page.js", import.meta.url), "utf8");
ok(/'<div hidden><div class=grp>Sales on record <u id=soldtag><\/u><\/div><div id=sold><\/div>'/.test(bp), "Sales on record is hidden, its elements kept for the script");

console.log(`v519 city buildings: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
