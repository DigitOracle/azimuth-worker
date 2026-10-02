// v291 - LIVE GOOGLE ANSWERS for gym, community pool and dog park (Kendall, 2 Oct 2026: in DAMAC Hills the gym was answered for 2 of 45
// homes and the community pool only from OpenStreetMap, while Google Maps shows gyms and pools; then "run this for all of DAMAC
// sub-communities"). src/live_answers.js, called from src/brief.js (briefSearch) and src/brief_docs.js (loadContext). Google is stubbed
// here (__setLiveFetch); nothing leaves the machine.
//
//   L1  found inside the sub-community (its attributed footprints + 150 m, inside the district polygon): yes, level "cluster",
//       "Gym in Carson on Google Maps (asked live, <date>): Carson Fitness Gym"; a personal trainer Google tags "gym" is not a gym
//   L2  nothing in the sub-community: the community's answer, "Gym in DAMAC Hills on Google Maps ...: Damac Hills - Gym, about .. from Topanga"
//   L3  a sub-community with no attributed footprints (Bel Air): the community's answer only, and it says so
//   L4  pools: a hotel pool and a restaurant tagged swimming_pool never count; a pool named for a sub-community does
//   L5  a register answer is never overridden (Richmond: the units register's gym), and Google is not asked for it
//   L6  only places inside the district polygon: everything outside -> NOT KNOWN; none -> NOT KNOWN; a timeout (2 s) -> NOT KNOWN;
//       an HTTP error -> NOT KNOWN; never false, in any mode
//   L7  cost: one community call per criterion, at most 3 per sub-community, shared across homes; no key -> no call at all
//   L8  the key goes only in the X-Goog-Api-Key header: never in a URL, never in the list's JSON, never in a document
//   L9  the PDF rows and the one-sheet card carry the same source words and "Google Maps"
//   L10 the notes say Google was asked live and that its silence is never a no
// NEGATIVE CONTROL (run by hand, 2 Oct 2026): make fillLive() return 0 at its top - 13 fail (L1, L1b, L2, L3, L4, L4b, L7, L7d, L10,
// L9, L9b, L9c, L9d); the misses (L6), the register (L5), the key (L8) and no-key (L7c) pass either way, as they should; restored - 24 pass.
//
//   node test/test_v291_live_answers.mjs
import worker from "../src/index.js";
import { __setLiveFetch, inPoly } from "../src/live_answers.js";
import { loadContext, parseQuery, criteriaRows, oneSheetHtml } from "../src/brief_docs.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 700) : "")); } };

const READ = "owner_read_key_live_123", CLIENT = "client_key_live_456", GKEY = "AIzaTESTKEY_live_answers_9876543210";
const store = new Map();
const KV = {
  async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); if (t === "arrayBuffer") return typeof v === "string" ? new TextEncoder().encode(v).buffer : v; return typeof v === "string" ? v : new TextDecoder().decode(v); },
  async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter((k) => k.startsWith(p)).map((name) => ({ name })), list_complete: true }; },
};
globalThis.fetch = async () => new Response("{}", { status: 404 });            // nothing else answers
const env = { MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: CLIENT, INGEST_TOKEN: "ING", GOOGLE_MAPS_KEY: GKEY, PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
const call = (e, p) => worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev" + p), e, { waitUntil() {} });
const brief = async (qs, e) => { const r = await call(e || env, "/brief_api?" + qs + "&key=" + CLIENT); const t = await r.text(); try { return Object.assign(JSON.parse(t), { _raw: t }); } catch (x) { return { status: r.status, _raw: t }; } };
const crit = (r, k) => (r && r.criteria || []).find((c) => c.k === k);

// ---- a small DAMAC Hills -------------------------------------------------------------------------------------------------------
const D = "damachills";
const S = (n, m) => ({ n, nn: n, nr: 0, m, q1: m - 5000, q3: m + 5000, mn: m, q1n: m - 5000, q3n: m + 5000, s: 200, last: "2026-09-28" });
const home = (p, n) => ({ p, n, area: "Al Hebiah Third", d: D, last: "2026-09-30", v: { "3": S(8, 220000) } });
store.set("img_rent_index", JSON.stringify({ as_of: "2026-10-01", window: ["2026-08-01", "2026-09-30"], items: [
  home("damachillscarson", "DAMAC HILLS - CARSON"), home("damachillstopanga", "DAMAC HILLS -  TOPANGA"),
  home("damachillsbelair", "DAMAC HILLS-BEL AIR"), home("damachillsrichmond", "DAMAC HILLS -  RICHMOND"),
] }));
store.set("img_districts_geo", JSON.stringify({ districts: [{ slug: D, name: "DAMAC Hills" }] }));
// the district polygon (the counts file's request definition) and its centre
const RING = [[25.010, 55.240], [25.010, 55.268], [25.035, 55.268], [25.035, 55.240]];
store.set("img_amenity_counts_" + D, JSON.stringify({ district: D, name: "DAMAC Hills", area: { centroid: { lat: 25.0225, lng: 55.254 } },
  google_requests: { body: { insights: ["INSIGHT_COUNT"], filter: { locationFilter: { customArea: { polygon: { coordinates: RING.concat([RING[0]]).map(([a, b]) => ({ latitude: a, longitude: b })) } } } } } } }));
// the district model's attribution: Carson and Topanga have footprints, Bel Air has none
const A = (i, cluster, lat, lon) => ({ i, cluster, lat, lon, name: null });
store.set("img_anchors_" + D, JSON.stringify({ district: D, anchors: [
  A(1, "DAMAC HILLS - CARSON", 25.0300, 55.2450), A(2, "DAMAC HILLS - CARSON", 25.0310, 55.2460), A(3, "DAMAC HILLS - CARSON", 25.0305, 55.2470),
  A(4, "DAMAC HILLS -  TOPANGA", 25.0150, 55.2600), A(5, "DAMAC HILLS -  TOPANGA", 25.0155, 55.2610),
  A(6, "DAMAC HILLS - QUEENS MEADOW", 25.0324, 55.2599), A(7, null, 25.02, 55.25),
] }));
// the amenity facts file: Richmond's gym is on the units register; everything else is open
store.set("img_amenities_" + D, JSON.stringify({ district: D, homes: [
  { key: "dld:damachillsrichmond", keys: ["dld:damachillsrichmond"], names: ["DAMAC HILLS -  RICHMOND"], community_name: "DAMAC Hills",
    facts: { gym: { v: true, level: "building", say: "Gym in the building (1 gymnasium unit in the units register)", src: "dld_units", source_name: "the Land Department units register", as_of: "2026-09-25" } } },
] }));

// ---- the stubbed Google ----------------------------------------------------------------------------------------------------------
const P = (name, lat, lon, primaryType, types, status) => ({ id: "x" + name.length, displayName: { text: name }, location: { latitude: lat, longitude: lon }, businessStatus: status || "OPERATIONAL", primaryType, types: types || [primaryType] });
const near = (b, lat, lon) => Math.abs(b.locationRestriction.circle.center.latitude - lat) < 0.003 && Math.abs(b.locationRestriction.circle.center.longitude - lon) < 0.003;
let MODE = "normal", seen = [];
function places(b) {
  const t = b.includedTypes.join(",");
  const atCarson = near(b, 25.0305, 55.246), atTopanga = near(b, 25.01525, 55.2605), atCentre = near(b, 25.0225, 55.254);
  if (MODE === "outside") return [P("Fitness First Mudon", 25.040, 55.275, "gym"), P("Mudon Community Pool", 25.040, 55.275, "swimming_pool"), P("Mudon Dog Park", 25.041, 55.276, "dog_park", ["dog_park", "park"])];
  if (MODE === "none") return [];
  if (t === "gym,fitness_center") {
    if (atCarson) return [P("Yavuz Personal Training", 25.0304, 55.2461, "gym"), P("Aqua Gym Dubai", 25.03045, 55.24615, "fitness_center"), P("Fitness First Carson (Ladies Only)", 25.03055, 55.24618, "gym"), P("Carson Fitness Gym", 25.0306, 55.2462, "gym")];
    if (atTopanga) return [];
    if (atCentre) return [P("Fitness First Mudon", 25.0274, 55.2700, "gym"), P("Damac Hills - Gym", 25.0188, 55.2534, "gym"), P("Old Gym", 25.0200, 55.2500, "gym", null, "CLOSED_PERMANENTLY")];
  }
  if (t === "swimming_pool") {
    if (atCarson) return [P("Carson Hotel Pool", 25.0306, 55.2462, "swimming_pool", ["swimming_pool", "lodging"]), P("The Hills Pool Deck & Shisha Lounge", 25.0307, 55.2463, "restaurant", ["restaurant", "swimming_pool"])];
    if (atTopanga) return [P("Urban Swim Academy", 25.0152, 55.2604, "sports_school", ["swimming_pool", "sports_school", "school"])];
    if (atCentre) return [P("The Hills Pool Deck & Shisha Lounge", 25.0188, 55.2462, "restaurant", ["restaurant", "swimming_pool"]), P("Queens Meadow pool", 25.0324, 55.2599, "swimming_pool")];
  }
  if (t === "dog_park") return atCentre ? [P("Dog Park | Damac Hills", 25.0126, 55.2555, "dog_park", ["dog_park", "park"])] : [];
  return [];
}
__setLiveFetch(async (u, o) => {
  const b = JSON.parse(o.body);
  seen.push({ u: String(u), h: o.headers, b });
  if (MODE === "timeout") return new Promise((res) => setTimeout(() => res(new Response(JSON.stringify({ places: places(b) }), { status: 200 })), 4000));
  if (MODE === "error") return new Response(JSON.stringify({ error: { message: "API key not valid" } }), { status: 403 });
  return new Response(JSON.stringify({ places: places(b) }), { status: 200 });
});

console.log("v291 live Google answers (gym, community pool, dog park)");
ok(inPoly([25.02, 55.25], RING) && !inPoly([25.04, 55.275], RING), "L0 the polygon test: inside is inside, Mudon is out");
const Q = "mode=rent&beds=3&type=villa&max=240000&areas=" + D + "&musts=gym,community_pool,pets&limit=20";
seen = [];
const j = await brief(Q);
const by = {}; for (const r of j.results || []) by[r.name] = r;
const car = by["DAMAC HILLS - CARSON"], top = by["DAMAC HILLS -  TOPANGA"], bel = by["DAMAC HILLS-BEL AIR"], ric = by["DAMAC HILLS -  RICHMOND"];
const DAY = /asked live, \d{1,2} [A-Z][a-z]{2} 20\d\d\)/;
ok(car && crit(car, "gym").v === true && crit(car, "gym").level === "cluster" && /^Gym in Carson on Google Maps \(asked live, \d{1,2} [A-Z][a-z]{2} 20\d\d\): Carson Fitness Gym$/.test(crit(car, "gym").src),
  "L1 a gym inside Carson's own footprints (+150 m): yes, a cluster fact, named, Google Maps, the date", JSON.stringify(crit(car, "gym")));
ok(car && crit(car, "gym").attribution === "Google Maps" && crit(car, "gym").live === true && !/Yavuz|Aqua Gym|Ladies Only/.test(JSON.stringify(car)), "L1b attribution Google Maps; a personal trainer, an aqua-aerobics class and a ladies-only gym are not \"a gym\"");
ok(top && crit(top, "gym").v === true && crit(top, "gym").level === "community" && /^Gym in DAMAC Hills on Google Maps \(asked live, [^)]+\): Damac Hills - Gym, about [\d.]+ (km|m) from Topanga$/.test(crit(top, "gym").src),
  "L2 nothing in Topanga: the community's gym, inside the polygon, with how far it is from Topanga", JSON.stringify(crit(top, "gym")));
ok(!/Fitness First Mudon|Old Gym/.test(j._raw), "L2b a gym outside the district polygon, or closed, is never named");
ok(bel && crit(bel, "gym").level === "community" && /^Gym in DAMAC Hills on Google Maps \([^)]+\): Damac Hills - Gym\. No footprints are on file for Bel Air, so this is the community's answer$/.test(crit(bel, "gym").src),
  "L3 Bel Air (no attributed footprints): the community's answer only, and it says so", JSON.stringify(crit(bel, "gym")));
ok(car && crit(car, "community_pool").v === true && crit(car, "community_pool").level === "community" && /: Queens Meadow pool, about [\d.]+ (km|m) from Carson$/.test(crit(car, "community_pool").src)
  && !/Carson Hotel Pool|Shisha|Urban Swim/.test(j._raw),
  "L4 pools: a hotel pool, a restaurant and a swim academy never count; Queens Meadow's pool (a sub-community's own) does", JSON.stringify(crit(car, "community_pool")));
ok(ric && crit(ric, "gym").v === true && crit(ric, "gym").level === "building" && /units register/.test(crit(ric, "gym").src) && !crit(ric, "gym").live,
  "L5 a register answer is never overridden (Richmond: the units register's gymnasium)", JSON.stringify(crit(ric, "gym")));
ok(car && crit(car, "pets").v === true && /^Dog park in DAMAC Hills on Google Maps \([^)]+\): Dog Park \| Damac Hills, about [\d.]+ km from Carson$/.test(crit(car, "pets").src),
  "L4b pets: a dog park inside DAMAC Hills answers pets where nothing else does", JSON.stringify(crit(car, "pets")));
// cost: 3 community calls + 3 for Carson + 3 for Topanga (+ Queens Meadow never asked: no home there); Bel Air and Richmond: none of their own
const cl = (lat, lon) => seen.filter((s) => near(s.b, lat, lon)).length;
ok(seen.length === 9 && cl(25.0225, 55.254) === 3 && cl(25.0305, 55.246) === 3 && cl(25.01525, 55.2605) === 3,
  "L7 cost: one community call per criterion, at most 3 per sub-community: 9 in all for 4 homes and 3 criteria", seen.length + " calls: " + seen.map((s) => s.b.includedTypes[0] + "@" + s.b.locationRestriction.circle.center.latitude.toFixed(4) + "/" + s.b.locationRestriction.circle.radius).join(" "));
ok(seen.every((s) => s.b.locationRestriction.circle.radius <= 1500) && seen.filter((s) => !near(s.b, 25.0225, 55.254)).every((s) => s.b.locationRestriction.circle.radius <= 800),
  "L7b radius: the community at most 1500 m, a sub-community at most 800 m");
ok(seen.every((s) => s.h["X-Goog-Api-Key"] === GKEY && !s.u.includes(GKEY) && !s.b.toString().includes(GKEY)) && !j._raw.includes(GKEY),
  "L8 the key goes in the header only: not in a URL, not in the list's JSON");
ok((j.notes || []).some((n) => /Google Maps was asked live/.test(n) && /never a no/.test(n)), "L10 the notes say Google was asked live and its silence is never a no");
const allCrit = (jj) => (jj.results || []).flatMap((r) => r.criteria || []);
ok(!allCrit(j).some((c) => c.live && c.v !== true), "L6a never false: a live answer is only ever yes");

// ---- L6 the misses: outside, none, timeout, error -> NOT KNOWN, never false ----------------------------------------------------------
for (const m of ["outside", "none", "error", "timeout"]) {
  MODE = m; seen = [];
  const t0 = Date.now();
  const jm = await brief(Q);
  const ms = Date.now() - t0;
  const cm = (jm.results || []).find((r) => r.name === "DAMAC HILLS - CARSON");
  const lives = allCrit(jm).filter((c) => c.live);
  ok(cm && crit(cm, "gym").v === null && crit(cm, "community_pool").v === null && crit(cm, "pets").v === null && !lives.length && !allCrit(jm).some((c) => ["gym", "community_pool", "pets"].includes(c.k) && c.v === false)
    && (jm.results || []).length === 4 && (m !== "timeout" || ms < 6000),
    "L6 " + m + ": gym, community pool and pets stay NOT KNOWN (never no), all 4 homes still listed" + (m === "timeout" ? " - in " + ms + " ms (2 s per round)" : ""), JSON.stringify(cm && cm.criteria));
}
MODE = "normal";

// ---- L7c no key: no call at all -----------------------------------------------------------------------------------------------------
seen = [];
const envNo = Object.assign({}, env); delete envNo.GOOGLE_MAPS_KEY;
const jn = await brief(Q, envNo);
ok(seen.length === 0 && crit((jn.results || [])[0], "gym") && !allCrit(jn).some((c) => c.live), "L7c no GOOGLE_MAPS_KEY: Google is never asked, nothing is live");

// ---- L9 the PDF rows and the one-sheet --------------------------------------------------------------------------------------------
seen = [];
const pq = parseQuery(new URL("https://x/brief_pdf?kind=onesheet&keys=dld:damachillscarson,dld:damachillstopanga,dld:damachillsbelair&mode=rent&beds=3&type=villa&max=240000&musts=gym,community_pool,pets"));
const C = await loadContext(env, pq, { need: { avail: false } });
const rc = C.recs.find((r) => r.key === "dld:damachillscarson");
const rows = rc ? criteriaRows(rc, pq) : [];
const gymRow = rows.find((x) => x[0] === "gym");
ok(gymRow && gymRow[2].v === true && gymRow[2].src === crit(car, "gym").src, "L9 the PDF row gives the same answer and the same source words as the list", JSON.stringify(rows.map((x) => [x[0], x[2].v, x[2].src])));
const sheet = oneSheetHtml(C, pq);
const card1 = sheet.split('class="bcard"')[1] || "";
ok(/&#10003; gym \(Carson Fitness Gym, in Carson \(Google Maps, asked live \d{1,2} [A-Z][a-z]{2} 20\d\d\)\)/.test(card1) && /This cluster: gym/.test(card1),
  "L9b the one-sheet card names the gym, where, and Google Maps", card1.replace(/<img[^>]*>/g, "").slice(0, 1600));
ok(!sheet.includes(GKEY) && seen.length <= 9 && seen.length > 0, "L9c no key in the document; its own calls (" + seen.length + ") stay within 3 per criterion plus 3 per sub-community");

// ---- L9d the real document route (buildDocument: the live answers run alongside the amenity pages, then the page is drawn) -------------
seen = [];
const rd = await call(env, "/brief_pdf?kind=pack&keys=dld:damachillscarson,dld:damachillstopanga&mode=rent&beds=3&type=villa&max=240000&areas=" + D + "&musts=gym,community_pool,pets&format=html&key=" + CLIENT);
const dh = await rd.text();
ok(rd.status === 200 && dh.includes("Gym in Carson on Google Maps (asked live, ") && dh.includes("Carson Fitness Gym") && /Dog park in DAMAC Hills on Google Maps/.test(dh) && !dh.includes(GKEY),
  "L9d the Full pack (through /brief_pdf) prints the live answers with their source words and Google Maps, and no key", rd.status + " " + dh.replace(/<img[^>]*>/g, "").replace(/data:[^"']+/g, "").slice(0, 400));
// L7d a compare pack's area comparison (briefSearch with live: false) asks Google nothing of its own
seen = [];
const rc2 = await call(env, "/brief_pdf?kind=compare&keys=dld:damachillscarson&mode=rent&beds=3&type=villa&max=240000&areas=" + D + "&compare=1&musts=gym&format=html&key=" + CLIENT);
await rc2.text();
ok(rc2.status === 200 && seen.length === 2 && seen.every((s) => s.b.includedTypes[0] === "gym"), "L7d a Compare document asks only for its own homes (2 gym calls: Carson + the community), none for the area comparison", seen.length + " calls");

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
