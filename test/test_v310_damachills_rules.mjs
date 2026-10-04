// v310 (Kendall, 4 Oct 2026: "100% of DAMAC Hills correct ... a realtor can run the full journey without 'unknown', blanks or wrong facts").
// The DAMAC Hills audit's defect list, one test per rule (src/brief_rules.js, used by src/brief.js, src/brief_docs.js, src/live_answers.js).
//
//   R1  a community fact (pool, dog park, gym) is a yes for a home only within 500 m of it; further off it is the community's, with the distance
//   R2  an address-like name ("Damac 307 Rochester") and a ladies-only club are not a gym
//   R3  "newer build" reads the Dubai Municipality completion year, villa communities included
//   R4  few lettings: "based on only N lettings", rent to the nearest AED 500, no middle half (and under 3 contracts there is no figure at all)
//   R5  an impossible size (a 680 m2 villa "3-bed", a 200 m2 studio) is never printed
//   R6  the rent window is labelled with its dates and what they are; no file name on a client document
//   R7  evidence that belongs to the whole community says so
//   W   the client documents carry none of the banned gap words (the list is test_v302_client_wording.mjs's own)
// NEGATIVE CONTROL (run by hand, 4 Oct 2026): make applyNearRule() return its input untouched - R1 fails; make isCountableGym() return true - R2 fails;
// make sizeSane() return true - R5 fails; make evidenceSay() return "" - R4 and R7 fail.
//
//   node test/test_v310_damachills_rules.mjs
import worker from "../src/index.js";
import { briefSearch, subOrigins, criteriaOf, rentFigure, __resetKvMemo } from "../src/brief.js";
import { NEAR_FACT_M, isCountableGym, isAddressLike, nearestPlace, applyNearRule, evidenceSay, shownRent, sizeSane, windowOf, completionFromFacts, distM } from "../src/brief_rules.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 700) : "")); } };

// ---- R2: what is a gym ---------------------------------------------------------------------------------------------------------
ok(isAddressLike("Damac 307 Rochester") && !isCountableGym("Damac 307 Rochester", "gym", ["rochester"]), "R2 'Damac 307 Rochester' is an address, not a gym (even typed gym, even naming the sub-community)");
ok(isCountableGym("Damac Hills - Gym", "gym", []) && isCountableGym("Carson Fitness Gym", "gym", []) && isCountableGym("Gold's Gym 360", "gym", []), "R2 a name that says gym or fitness is a gym, a number or not");
ok(!isCountableGym("Fitness First DAMAC Hills Dubai (Ladies Only)", "gym", []) && !isCountableGym("Yavuz Personal Training", "gym", []) && !isCountableGym("Aqua Gym Dubai", "fitness_center", []), "R2 ladies-only, a personal trainer and an aqua class are not 'a gym'");
ok(!isCountableGym("Villa 12", "gym", ["villa"]) && !isCountableGym("Plot 44 Street 6", "gym", []) && !isCountableGym("", "gym", []), "R2 villa, plot and street numbers, and an empty name, are not gyms");
ok(isCountableGym("Orchid Club", "gym", ["orchid"]) && !isCountableGym("Orchid Club", "restaurant", ["orchid"]), "R2 a name with no gym word counts only if Google types it gym and it names the community");

// ---- R1: within 500 m ---------------------------------------------------------------------------------------------------------
const SPOTS = [
  { type: "community_pool", name: "Malibu Bay", lat: 25.0220, lng: 55.2604 },
  { type: "community_pool", name: "Brookfield swimming pool", lat: 25.0250, lng: 55.2469 },
  { type: "dog_park", name: "Central Bark", lat: 25.0124, lng: 55.2555 },
  { type: "gym", name: "Damac 307 Rochester", lat: 25.0150, lng: 55.2601 },
  { type: "gym", name: "Fitness First DAMAC Hills (Ladies Only)", lat: 25.0150, lng: 55.2601 },
  { type: "gym", name: "Damac Hills - Gym", lat: 25.0188, lng: 55.2534 },
];
const comm = (k, say) => ({ v: true, src: say + " - a community fact, per OpenStreetMap", level: "community", source: "OpenStreetMap", say });
const mk = () => ({ community_pool: comm("community_pool", "Community pool (DAMAC Hills)"), pets: comm("pets", "Pet-friendly (DAMAC Hills)"), gym: comm("gym", "Gym (DAMAC Hills)"), parking: { v: true, level: "building", src: "register" } });
const at = (lat, lon) => [[lon, lat]];
{
  const o = applyNearRule(mk(), { spots: SPOTS, origins: at(25.0218, 55.2602), community_name: "DAMAC Hills" });      // ~25 m from Malibu Bay
  ok(o.community_pool.v === true && o.community_pool.level === "near" && o.community_pool.near.name === "Malibu Bay" && o.community_pool.near.m <= NEAR_FACT_M && /close by: Malibu Bay, about \d+ m from this home/.test(o.community_pool.src),
    "R1 a pool 25 m away: a yes, level near, named, with the distance", JSON.stringify(o.community_pool));
  ok(o.pets.v === null && o.pets.community_fact && o.pets.community_fact.name === "Central Bark" && o.pets.community_fact.m > 1000 && /^In DAMAC Hills: Central Bark, about [\d.]+ km away$/.test(o.pets.community_fact.say),
    "R1 the dog park 1.1 km away: NOT a yes for the home, kept as the community's with the distance", JSON.stringify(o.pets));
  ok(o.parking.v === true && o.parking.level === "building", "R1 a building-level fact (parking) is never touched");
}
{
  const o = applyNearRule(mk(), { spots: SPOTS, origins: at(25.0309, 55.2455), community_name: "DAMAC Hills" });         // 1 km+ from every place
  ok(o.community_pool.v === null && o.community_pool.community_fact.m > NEAR_FACT_M && o.gym.v === null && o.pets.v === null, "R1 a home 1 km from every pool, gym and dog park: none of them is a yes for it");
  ok(o.gym.community_fact.name === "Damac Hills - Gym", "R1+R2 the nearest gym named is a real gym (not the address-like 'Damac 307 Rochester', not the ladies-only club)", JSON.stringify(o.gym.community_fact));
}
{
  const o = applyNearRule(mk(), { spots: SPOTS, origins: null, community_name: "DAMAC Hills" });
  ok(o.community_pool.v === true && o.community_pool.level === "community" && o.community_pool.unplaced === true && /community's, not shown to be at this home/.test(o.community_pool.src),
    "R1 a home with no position: the community's fact stays, labelled as the community's, never as the home's", JSON.stringify(o.community_pool));
  const n = nearestPlace(SPOTS, "gym", at(25.0150, 55.2601));
  ok(n && n.name === "Damac Hills - Gym", "R2 the nearest-gym lookup skips the address-like name and the ladies-only club standing right on the origin", JSON.stringify(n));
  ok(Math.round(distM([55.2604, 25.0220], [55.2604, 25.0265])) >= 495 && Math.round(distM([55.2604, 25.0220], [55.2604, 25.0265])) <= 505, "R1 the distance function: 0.0045 degrees of latitude is 500 m");
}

// ---- subOrigins: a villa community's homes, by its exact Land Department name ------------------------------------------------------
{
  const A = (i, cluster, lat, lon) => ({ i, cluster, lat, lon });
  const anchors = { anchors: [A(1, "DAMAC HILLS -  TOPANGA", 25.0150, 55.2600), A(2, "DAMAC HILLS -  TOPANGA", 25.0155, 55.2610), A(3, "DAMAC HILLS - BROOKFIELD-2", 25.025, 55.247), A(4, null, 25.02, 55.25)] };
  const so = subOrigins(anchors, null, ["DAMAC HILLS - TOPANGA"]);
  ok(so && so.length === 2 && so[0][0] === 55.26, "R1 a villa community's own homes are the origins (exact name; spacing and case ignored)", JSON.stringify(so));
  ok(subOrigins(anchors, null, ["DAMAC HILLS - BROOKFIELD-1"]) === null, "R1 a name that is only a prefix of a family (Brookfield-1 vs Brookfield-2) gets no origins");
  const so2 = subOrigins(anchors, { "DAMAC HILLS - TOPANGA": { add: [3], remove: [] } }, ["DAMAC HILLS - TOPANGA"]);
  ok(so2 && so2.length === 3, "R1 the owner's map corrections (anchor overrides) move homes into the community's origins", JSON.stringify(so2));
}

// ---- R3: completion year ------------------------------------------------------------------------------------------------------------
{
  const af = (y) => ({ facts: { completion: { v: true, year: y, level: "community", source_name: "the Dubai Municipality building record" } } });
  ok(completionFromFacts(af(2016)).year === 2016 && /Dubai Municipality/.test(completionFromFacts(af(2016)).src) && completionFromFacts({ facts: {} }) === null && completionFromFacts(af(1800)) === null, "R3 the completion year comes from the amenity file's Dubai Municipality fact; nonsense years are refused");
  const c = (y) => criteriaOf({ c: { name: "DAMAC HILLS - ROCKWOOD", aliases: [] }, card: null, brochure: null, AM: null, musts: {}, villa: true, s: null, af: af(y) });
  ok(c(2016).modern.v === false && /completed 2016, the Dubai Municipality/.test(c(2016).modern.src) && c(2024).modern.v === true, "R3 a villa community: 2016 is not newer (2018 or later), 2024 is, and the sentence names the source");
  ok(criteriaOf({ c: { name: "X", aliases: [] }, card: null, brochure: null, AM: null, musts: {}, villa: true, s: null, af: null }).modern.v === null, "R3 no completion year anywhere: still just not answered");
}

// ---- R4/R5/R6/R7 on the figure ----------------------------------------------------------------------------------------------------------
{
  const f = (n, nn, m, s, kind, bed) => rentFigure({ n, nn, nr: n - nn, m, q1: m - 5000, q3: m + 5000, mn: m, q1n: m - 5000, q3n: m + 5000, s, last: "2026-09-10" }, { kind, bed });
  ok(evidenceSay(f(4, 3, 183000, 250, "v", 3), null) === "based on only 4 lettings" && evidenceSay(f(12, 8, 195000, 260, "v", 3), null) === "12 recent lettings (8 new)", "R4 the evidence sentence: under five 'based on only N lettings', else 'N recent lettings (K new)'");
  ok(evidenceSay(rentFigure({ n: 6, nn: 2, nr: 4, m: 100000, q1: 90000, q3: 110000, mn: 99000, q1n: 90000, q3n: 108000, s: 90, last: "x" }), null) === "6 recent lettings (2 new; the typical rent counts renewals too)", "R4 under three new lettings the typical rent counts renewals, and the sentence says so");
  const sh = shownRent(f(4, 3, 183120, 250, "v", 3));
  ok(sh.few && sh.m === 183000 && sh.q1 === null && sh.q3 === null, "R4 four lettings: rent rounded to AED 500, no middle half", JSON.stringify(sh));
  const sh2 = shownRent(f(9, 6, 183120, 250, "v", 3));
  ok(!sh2.few && sh2.m === 183120 && sh2.q1 === 178120, "R4 nine lettings: the exact figure and its middle half");
  ok(evidenceSay(f(6, 5, 300000, 354, "v", 3), "DAMAC Hills - Piccadilly Green") === "6 recent lettings (5 new), from the whole of DAMAC Hills - Piccadilly Green (not this home alone)", "R7 community evidence says whose it is");
  ok(sizeSane(264, "v", 3) && !sizeSane(680, "v", 3) && sizeSane(40, "b", 0) && !sizeSane(200, "b", 0) && !sizeSane(0, "b", 1) && !sizeSane(null, "b", 1) && sizeSane(217, "b", 3) && !sizeSane(900, "b", 3), "R5 sizes: possible ones stay, a 680 m2 villa, a 200 m2 studio, 0 and null do not");
  ok(f(5, 4, 552500, 680, "v", 3).s === null && f(5, 4, 552500, 680, "v", 3).size_ok === false && f(6, 5, 300000, 354.5, "v", 3).s === 354.5, "R5 rentFigure drops an impossible size and keeps a possible one");
  const w = windowOf({ win: ["2026-07-18", "2026-09-16"], win_basis: "contract start date" }, { window: ["2026-08-01", "2026-09-30"] });
  ok(w.basis === "start" && w.say === "lettings that started between 18 Jul 2026 and 16 Sep 2026", "R6 a record's own window and its basis win over the index's", JSON.stringify(w));
  const w2 = windowOf({}, { window: ["2026-08-01", "2026-09-30"] });
  ok(w2.basis === "registered" && w2.say === "lettings registered between 1 Aug 2026 and 30 Sep 2026" && windowOf({}, {}) === null, "R6 the index window is 'registered' unless it says contract starts; none -> null");
}

// ---- the list and the documents on a small DAMAC Hills -------------------------------------------------------------------------------------
const store = new Map();
const KV = {
  async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); if (t === "arrayBuffer" || (t && t.type === "arrayBuffer")) return typeof v === "string" ? new TextEncoder().encode(v).buffer : v; return typeof v === "string" ? v : new TextDecoder().decode(v); },
  async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter((k) => k.startsWith(p)).map((name) => ({ name })), list_complete: true }; },
};
globalThis.fetch = async () => new Response("{}", { status: 404 });
const READ = "owner_read_key_310", CLIENT = "client_key_310";
const ORIGIN = "https://azimuth-2.digitalchemy.workers.dev";
const env = { MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: CLIENT, INGEST_TOKEN: "ING", PUBLIC_ORIGIN: ORIGIN };
const J = (k, o) => store.set("img_" + k, JSON.stringify(o));
const D = "damachills";
const st = (n, nn, m, s, last) => ({ n, nn, nr: n - nn, m, q1: m - 8000, q3: m + 8000, mn: m, q1n: m - 8000, q3n: m + 8000, s, last: last || "2026-09-15" });
const WIN = { win: ["2026-07-18", "2026-09-16"], win_basis: "contract start date" };
J("rent_index", { as_of: "2026-09-30", source_file: "rents-secret-file-name.csv", window: ["2026-08-01", "2026-09-30"], items: [
  { p: "damachillstopanga", n: "DAMAC HILLS -  TOPANGA", area: "Al Hebiah Third", d: D, last: "2026-09-15", ...WIN, v: { "3": st(13, 5, 195000, 259.9) } },
  { p: "damachillsrichmond", n: "DAMAC HILLS -  RICHMOND", area: "Al Hebiah Third", d: D, last: "2026-09-15", ...WIN, v: { "3": st(4, 3, 183120, 264.4) } },
  { p: "damachillssilversprings", n: "DAMAC HILLS - SILVER SPRINGS", area: "Al Hebiah Third", d: D, last: "2026-09-15", ...WIN, v: { "3": st(5, 4, 552500, 680) } },
  { p: "damachillspiccadillygreenk015b", n: "Villa K015B, Land 740, DAMAC Hills - Piccadilly Green", area: "Al Hebiah Third", d: D, last: "2026-09-24", v: { "3": st(6, 5, 300000, 354.5) }, fp: [2001], ev_scope: "DAMAC Hills - Piccadilly Green", render_basis: "plot_outline" },
  { p: "damachillscarson", n: "DAMAC HILLS - CARSON", area: "Al Hebiah Third", d: D, i: 1003, lon: 55.2604, lat: 25.0218, last: "2026-09-30", b: { "0": st(68, 45, 40000, 37.9), "1": st(15, 10, 69000, 200) } },
] });
J("districts_geo", { districts: [{ slug: D, name: "DAMAC Hills" }] });
J("amenities", { items: [{ k: "metro", n: "Jumeirah Golf Estates Metro Station", line: "Red Metro line", lat: 25.0178, lon: 55.1634 }] });   // the RTA list: the nearest station is 8 km from every DAMAC Hills home
const fact = (say, level, extra) => ({ v: true, level, say, source_name: "OpenStreetMap via Overpass API, © OpenStreetMap contributors", as_of: "2026-10-02", ...extra });
const comm3 = () => ({ community_pool: fact("Community pool (DAMAC Hills)", "community"), pets: fact("Pet-friendly (DAMAC Hills)", "community"), gym: fact("Gym (DAMAC Hills)", "community") });
J("amenities_" + D, { district: D, homes: [
  { key: "dld:damachillstopanga", keys: ["dld:damachillstopanga"], names: ["DAMAC HILLS -  TOPANGA"], community_name: "DAMAC Hills", facts: { ...comm3(), completion: { v: true, year: 2017, level: "community", source_name: "the Dubai Municipality building record" } } },
  { key: "dld:damachillsrichmond", keys: ["dld:damachillsrichmond"], names: ["DAMAC HILLS -  RICHMOND"], community_name: "DAMAC Hills", facts: { ...comm3(), completion: { v: true, year: 2024, level: "community", source_name: "the Dubai Municipality building record" } } },
  { key: "dld:damachillssilversprings", keys: ["dld:damachillssilversprings"], names: ["DAMAC HILLS - SILVER SPRINGS"], community_name: "DAMAC Hills", facts: comm3() },
  { key: "damachills:1003", keys: ["damachills:1003"], names: ["DAMAC HILLS - CARSON"], community_name: "DAMAC Hills", facts: comm3() },
] });
J("amenity_spots_" + D, { district: D, spots: [
  { id: "p1", type: "community_pool", name: "Malibu Bay", lat: 25.0220, lng: 55.2604, community: "Longview", source: "OpenStreetMap" },
  { id: "d1", type: "dog_park", name: "Central Bark", lat: 25.0124, lng: 55.2555, community: "Orchid", source: "developer" },
  { id: "g1", type: "gym", name: "Damac 307 Rochester", lat: 25.0152, lng: 55.2602, source: "Google Places" },
  { id: "g2", type: "gym", name: "Damac Hills - Gym", lat: 25.0188, lng: 55.2534, source: "Google Places" },
] });
const A = (i, cluster, lat, lon) => ({ i, cluster, lat, lon, name: null });
J("anchors_" + D, { district: D, anchors: [A(4, "DAMAC HILLS -  TOPANGA", 25.0150, 55.2600), A(5, "DAMAC HILLS -  TOPANGA", 25.0155, 55.2610), A(6, "DAMAC HILLS - RICHMOND", 25.0221, 55.2606), A(7, "DAMAC HILLS - SILVER SPRINGS", 25.0300, 55.2400)] });

const run = async (qs, o) => { __resetKvMemo(); const r = await briefSearch(env, new URLSearchParams(qs), Object.assign({ owner: false, live: false }, o || {})); return r.body; };
const crit = (r, k) => (r.criteria || []).find((c) => c.k === k);
const Q = "mode=rent&beds=3&type=villa,townhouse&areas=damachills&limit=50&musts=&nice=community_pool,pets,gym,modern,metro&min=100000&max=600000";
const B = await run(Q);
const by = Object.fromEntries((B.results || []).map((r) => [r.name, r]));
ok((B.results || []).length === 4 && by["DAMAC HILLS -  TOPANGA"] && by["DAMAC HILLS -  RICHMOND"], "the list returns the four villa homes of the fixture (Carson is a flat)", JSON.stringify((B.results || []).map((r) => r.name)));

const top = by["DAMAC HILLS -  TOPANGA"], ric = by["DAMAC HILLS -  RICHMOND"], sil = by["DAMAC HILLS - SILVER SPRINGS"], k15 = by["Villa K015B, Land 740, DAMAC Hills - Piccadilly Green"];
// R1 on the list: Richmond's homes are 40 m from Malibu Bay (a yes, with the distance); Topanga's are 1 km+ from it (the community's)
ok(crit(ric, "community_pool").v === true && crit(ric, "community_pool").level === "near" && /Malibu Bay, about \d+ m from this home/.test(crit(ric, "community_pool").src), "R1 list: Richmond (homes 40 m from the pool) - community pool yes, close by, named", JSON.stringify(crit(ric, "community_pool")));
ok(crit(top, "community_pool").v === null && crit(top, "community_pool").community_fact && crit(top, "community_pool").community_fact.m > 500 && crit(top, "pets").v === null && crit(top, "pets").community_fact.name === "Central Bark", "R1 list: Topanga (1 km from the pool, 400 m from nothing) - pool and dog park are the community's, not yes", JSON.stringify([crit(top, "community_pool"), crit(top, "pets")]));
// R2 on the list: the address-like 'gym' 25 m from Topanga's homes is not counted; the real gym is 600 m off
ok(crit(top, "gym").v === null && crit(top, "gym").community_fact && crit(top, "gym").community_fact.name === "Damac Hills - Gym" && !/307/.test(JSON.stringify(crit(top, "gym"))), "R2 list: the address-like 'Damac 307 Rochester' is never Topanga's gym", JSON.stringify(crit(top, "gym")));
ok(crit(sil, "community_pool").v === true && crit(sil, "community_pool").level !== "near" && crit(sil, "community_pool").community_fact === undefined || crit(sil, "community_pool").v === null, "R1 list: Silver Springs is measured from its own homes", JSON.stringify(crit(sil, "community_pool")));
// metro: a villa community placed by its mapped homes gets the straight-line answer - no station within 1 km is a real "no" (the RTA list is the whole network)
ok(crit(top, "metro").v === false && crit(ric, "metro").v === false && crit(sil, "metro").v === false && crit(k15, "metro").v === null, "list: a villa community with mapped homes answers metro 'no' (8 km); an option with no position of its own stays unanswered", JSON.stringify([crit(top, "metro"), crit(k15, "metro")]));
// R3 on the list
ok(crit(top, "modern").v === false && /completed 2017/.test(crit(top, "modern").src) && /Dubai Municipality/.test(crit(top, "modern").src) && crit(ric, "modern").v === true, "R3 list: Topanga 2017 is not newer, Richmond 2024 is - villa communities answer from the Dubai Municipality year", JSON.stringify([crit(top, "modern"), crit(ric, "modern")]));
// R4 on the list
ok(ric.evidence.few === true && ric.evidence.say === "based on only 4 lettings" && top.evidence.few === false && top.evidence.say === "13 recent lettings (5 new)", "R4 list: four lettings says 'based on only 4 lettings'; thirteen says '13 recent lettings (5 new)'", JSON.stringify([ric.evidence.say, top.evidence.say]));
// R5 on the list
ok(sil.evidence.sqm === null && top.evidence.sqm === 259.9 && by["DAMAC HILLS - CARSON"] === undefined, "R5 list: Silver Springs' 680 m2 'villa' size is withheld; Topanga's 259.9 m2 stays", JSON.stringify([sil.evidence.sqm, top.evidence.sqm]));
const Q1 = "mode=rent&beds=1&type=apartment&areas=damachills&limit=50&min=1000&max=100000";
const B1 = await run(Q1);
ok(B1.results.length === 1 && B1.results[0].evidence.sqm === 200 === false, "R5 list: a 200 m2 one-bedroom flat is not possible (limit 190 m2) - the size is withheld", JSON.stringify(B1.results.map((r) => [r.name, r.evidence.sqm])));
// R6 on the list
ok(top.evidence.window && top.evidence.window.say === "lettings that started between 18 Jul 2026 and 16 Sep 2026" && k15.evidence.window.say === "lettings registered between 1 Aug 2026 and 30 Sep 2026", "R6 list: a record with its own dates says so (contract starts); one without says the index's registration window", JSON.stringify([top.evidence.window, k15.evidence.window]));
// R7 on the list
ok(k15.evidence.scope === "DAMAC Hills - Piccadilly Green" && /from the whole of DAMAC Hills - Piccadilly Green \(not this home alone\)$/.test(k15.evidence.say) && top.evidence.scope === null, "R7 list: the community's evidence says whose it is", JSON.stringify([k15.evidence.say, k15.evidence.scope]));
// the owner and the client see the same evidence block
ok(JSON.stringify((await run(Q, { owner: true })).results[0].evidence) === JSON.stringify(B.results[0].evidence), "the owner's list carries the same evidence as the client's");

// ---- the documents -----------------------------------------------------------------------------------------------------------------
const BANNED = [/not known/i, /not yet verified/i, /to follow/i, /unknown/i, /Distances? not shown/i, /Map to follow/i, /Schools and clinics/i, /not yet published/i, /not yet in our files/i, /Not on record/i, /no record we hold/i, /position not yet/i, /being verified/i];
const strip = (h) => h.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const call = (p) => worker.fetch(new Request(ORIGIN + p), env, { waitUntil() {} });
const doc = async (kind, keys, extra) => { __resetKvMemo(); const r = await call("/brief_pdf?kind=" + kind + "&keys=" + encodeURIComponent(keys) + "&mode=rent&beds=3&type=villa&min=100000&max=600000&areas=damachills&musts=community_pool,pets,gym&nice=modern&format=html&key=" + CLIENT + (extra || "")); return { s: r.status, h: await r.text() }; };
const gaps = (h) => BANNED.map((r) => r.exec(strip(h))).filter(Boolean).map((m) => m[0]);
for (const [k, label] of [["dld:damachillstopanga", "Topanga"], ["dld:damachillsrichmond", "Richmond"], ["dld:damachillssilversprings", "Silver Springs"], ["dld:damachillspiccadillygreenk015b", "K015B"]]) {
  const d = await doc("dossier", k);
  ok(d.s === 200 && gaps(d.h).length === 0, "W " + label + " dossier: no gap wording", d.s + " " + gaps(d.h).join(" | "));
}
{
  const t = strip((await doc("dossier", "dld:damachillstopanga")).h), r = strip((await doc("dossier", "dld:damachillsrichmond")).h), s = strip((await doc("dossier", "dld:damachillssilversprings")).h), c = strip((await doc("dossier", "dld:damachillspiccadillygreenk015b")).h);
  ok(/In the wider community: community pool \(nearest about [\d.]+ (km|m) away\)/.test(t) && !/&#10003; Community pool/.test(t) && !/\u2713 Community pool/.test(t), "R1 Topanga's dossier: the pool is 'in the wider community', with how far - not ticked as the home's own", (t.match(/AMENITIES.{0,300}/) || [])[0]);
  ok(/Community pool \(close by\) about \d+ m/.test(r.replace(/\s+/g, " ")) && /in the community.{0,40}Central Bark|Pet-friendly/.test(r), "R1 Richmond's dossier: 'Community pool (close by) about 50 m'", (r.match(/AMENITIES.{0,300}/) || [])[0]);
  ok(!/Damac 307/.test(t) && !/307 Rochester/.test(t + r), "R2 no dossier names the address-like 'gym'");
  ok(/based on only 4 lettings/.test(r) && !/MIDDLE HALF/.test(r.replace(/\s+/g, " ")) && /AED 183,000/.test(r) && !/AED 183,120/.test(r), "R4 Richmond's dossier: 'based on only 4 lettings', AED 183,000, no middle half", r.slice(r.indexOf("TYPICAL"), r.indexOf("TYPICAL") + 300));
  ok(/MIDDLE HALF/.test(t) && /13 \(5 new\)/.test(t) && /13 recent lettings \(5 new\)/.test(t), "R4 Topanga's dossier: the middle half and '13 (5 new)' stay", t.slice(t.indexOf("TYPICAL"), t.indexOf("TYPICAL") + 300));
  ok(!/sq ft/.test(s.slice(0, s.indexOf("Layouts") > 0 ? s.indexOf("Layouts") : 4000).replace(/\s+/g, " ").match(/TYPICAL SIZE[^A-Z]*/) || [""]) && !/680|7,3\d\d sq ft/.test(s), "R5 Silver Springs' dossier: no 680 m2 (7,319 sq ft) anywhere", (s.match(/[\d,]+ sq ft/g) || []).join(" "));
  ok(/lettings that started between 18 Jul 2026 and 16 Sep 2026/.test(t) && !/rents-secret-file-name/.test(t + r + s + c), "R6 dossiers: the window with its dates (contract starts); no file name on a client document", (t.match(/Rents:[^.]*/) || [])[0]);
  ok(/from the whole of DAMAC Hills - Piccadilly Green \(not this home alone\)/.test(c) && /community's rent evidence, not this home's own/.test(c), "R7 K015B's dossier: the evidence is the community's, said twice", (c.match(/whole of[^)]*\)/) || [])[0]);
  ok(/completed 2017|Newer build/.test(t) && !/not known/i.test(t), "R3 Topanga's dossier shows its newer-build answer from the Dubai Municipality year", (t.match(/Newer build[^·]{0,60}/) || [])[0]);
}
{
  const o = await doc("onesheet", "dld:damachillstopanga,dld:damachillsrichmond,dld:damachillssilversprings,dld:damachillspiccadillygreenk015b");
  const t = strip(o.h);
  ok(o.s === 200 && gaps(o.h).length === 0 && /based on only 4 lettings/.test(t) && /13 \(5 new\) recent lettings/.test(t), "W one-sheet of the four homes: no gap wording; few-lettings and normal cards each say their own", gaps(o.h).join(" | "));
  const p = await doc("pack", "dld:damachillstopanga,dld:damachillsrichmond");
  ok(p.s === 200 && gaps(p.h).length === 0 && !/rents-secret-file-name/.test(p.h), "W pack: no gap wording, no file name", gaps(p.h).join(" | "));
}
console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
