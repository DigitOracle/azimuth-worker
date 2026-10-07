// THE BRIEF - Contract A: GET /brief_api (spec v1, 30 Sep 2026; scratchpad BRIEF_SPEC.md "Contract A - search").
//
// A client of Naj's asked "three options in JVC, one bedroom, AED 65K rent". This is that question as an API: mode, bedrooms, a
// budget, districts, home type and non-negotiables in; a ranked list of buildings out, each with the evidence behind its number.
//
// Where every figure comes from (all read from the worker's own KV; nothing here is invented, and nothing is written):
//   rent   img_rent_index            naj-market-pulse scripts/build_rent_index.py - Ejari contracts per building per bedroom band,
//                                    each contract counted once, project names that share contracts merged ("also filed as").
//                                    The figure is the SAME one the HOMES panel's Rent mode shows (rentFig in HOMES_RENT_JS):
//                                    the median of NEW lettings where there are 3 or more, otherwise of all contracts.
//   buy    img_map_prices            what the HOMES panel's Buy mode reads (homeMatches) - used to find the candidates;
//          img_unitmix_<district>    the unit-mix card map_prices is folded from - the per-bedroom register median (DLD settled
//                                    sales) AND the per-bedroom sale count (dld_sales.sold_by_type). map_prices carries no count,
//                                    so a building is offered only where the card gives one (never an estimate, never an asking).
//   buy+   img_buy_extra             v314 - Brief-only Buy items (scripts/build_coverage_cards.py): projects the register sells that the map does
//                                    not place (Al Yelayiss 1, Bukadra, Al Yufrah 1, Wadi Al Safa 4-7, Palm Deira, Ras Al Khor, Liwan); their
//                                    cards sit in img_unitmix_<district> under ids 900000+ ("synthetic"). The public map reads none of them.
//   musts  img_amenities (metro stations, schools), img_unitmix_<district> (pools, car parks), img_brochure_* (developer amenities).
//          null = we do not know. A must is false only where a source says so.
//   T, R   img_unitmix_<district> (flats of the bedroom count in the DLD units register) and img_tenancy_<district> (Ejari tenancies
//          running on its as_at date). Only under the gates building_page.js already applies - see estLeft().
//
// Everything is in this file; src/index.js carries one import and one marked dispatch.
import { liveCtx, fillLive, LIVE_CRITS } from "./live_answers.js";   // v291 - gym, community pool and dog park asked of Google live where all else is not known

import { applyNearRule, completionFromFacts, evidenceSay, windowOf, sizeSane, nearestPlace, NEAR_FACT_M } from "./brief_rules.js";   // v310 - the DAMAC Hills rules
import { foldArea, communitySlugOfArea } from "./community_labels.js";   // v314 - the DLD area -> district map the community labels use
import { applyBrokerFacts, brokerFor, applyAnchorOverrides } from "./checklist_data.js";   // v291 CHECKLIST - Najjuko's on-site facts: below every register, above "not known"
// v374 (Kendall, 7 Oct 2026): only what a register can say, or a picture can show, is offered. PULLED from every question, chip, filter and
// placeholder: private pool, community pool, pet-friendly, newer or modern, long-term quality, furnished. The data stays; it is not offered.
export const BRIEF_MUSTS = ["balcony", "metro", "gym", "parking", "schools"];
// v282 (Kendall, 1 Oct 2026, a real client brief: "a furnished 2-3 bedroom townhouse, AED 240K a year, up to 300K for a modern,
// well-furnished home; a private pool preferred, or a community pool; a pet-friendly community with dog-walking routes and play
// areas; a quality home for a long stay"). Each item is asked three ways - must / nice to have / don't care - and answered per
// building as true (a source says yes), false (a source says no) or null (NOT KNOWN). A must leaves a building out only on a
// definite false; "not known" never filters; a nice-to-have only ranks. Every answer names its source.
export const BRIEF_CRITERIA = [
  ["metro", "near a metro"], ["schools", "schools nearby"], ["gym", "gym"], ["parking", "parking"], ["balcony", "balcony"],
];
// v374: what an old shared link may still carry. Dropped silently on the way in: it is never answered, never an error, never shown.
export const PULLED_CRITS = ["private_pool", "community_pool", "pets", "modern", "long_term", "pool", "new"];
const CRIT_KEYS = BRIEF_CRITERIA.map((c) => c[0]);
const CRIT_LABEL = Object.fromEntries(BRIEF_CRITERIA);
export const MODERN_FROM = 2018;
export const HOME_TYPES = ["apartment", "townhouse", "villa", "any"];
export const FURNISHED = ["furnished", "unfurnished", "either"];
// the advertised-supply rows (img_pf_supply_<district>, src/supply_page.js, v279) carry no furnishing field yet; these are the names
// the OWNER hint reads when the crawler adds one (adverts marked furnished, of listings_live). Until then the hint says so.
export const FURNISHED_FIELDS = ["furnished_live", "furnished"];
// v282 - areas the client asks for that are not among the app's 45 districts, but that the rent index covers by DLD area name
// (build_rent_index.py keeps AREA_EN on every record; DLD_AREA has no slug for these, so their records carry d = null). The DLD
// area is NOT the marketing community: Wadi Al Safa 6 holds Arabian Ranches villages (Alvorada, Aseel, Alma); Wadi Al Safa 7 holds
// Arabian Ranches 2 (Reem, Camelia), more Arabian Ranches villages (Palma, Rasha, Samara, Yasmin, Azalea, Rosa, Casa, Lila), and
// Serena, Rukan and The Sustainable City. The names on the chips say so. bbox: the Dubai Municipality community polygon
// (naj-market-pulse data/blocks_city/<slug>/boundary.geojson), used only to count the amenity layer's parks and schools inside it.
export const EXTRA_AREAS = {
  wadialsafa6: { name: "Arabian Ranches (Wadi Al Safa 6)", dld: ["Wadi Al Safa 6"], corridor: "South & Outer", bbox: [55.24939, 25.03537, 55.30117, 25.06588] },
  wadialsafa7: { name: "Arabian Ranches 2 & Serena (Wadi Al Safa 7)", dld: ["Wadi Al Safa 7"], corridor: "South & Outer", bbox: [55.26001, 25.02221, 55.3088, 25.05827] },
};
const EXTRA_BY_DLD = {}; for (const [s, x] of Object.entries(EXTRA_AREAS)) for (const a of x.dld) EXTRA_BY_DLD[a] = s;
export const areaSlugOf = (it) => (it && (it.d || EXTRA_BY_DLD[it.area])) || null;
// v314 (Kendall, 4 Oct 2026: "no page should drop a registered project"). 129 rent-index records carry no district (their Land Department
// area is not one of the app's districts: Al Warsan First, Warsan Fourth, Mirdif, Jumeirah First ...), so areas=<that area> never reached
// them and 46 of the audit's 410 query cells came back empty while the register held 48,679 lettings in them. An AREA SEARCH now also
// reaches a record by its Land Department area name, case-folded with the spaces dropped - the same fold community_labels.js uses to map
// a DLD area to a district. A record that has a district is matched exactly as before; nothing is matched by prefix or fuzzily.
// areaSlugOf stays the DISTRICT (null for these records): it drives the unit-mix cards, the building page and the amenity files.
export const searchAreaOf = (it) => areaSlugOf(it) || (it && it.area ? (communitySlugOfArea(it.area) || foldArea(it.area)) : null) || null;
const titleArea = (s) => String(s || "").toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
const BEDS = { studio: 0, "0": 0, "1": 1, "2": 2, "3": 3, "3+": 3 };
const BED_WORD = ["studio", "1-bed", "2-bed", "3+ bed"];
// v306 - a school's inspection line is shown only when it is a rating; "Not inspected due to COVID 19" / "not yet inspected" is left out of every client page
export const ratingOf = (x) => { const r = String(x || "").split(" \u00b7 ")[0].trim(); return !r || /inspect|covid|not rated|n\/a|unrated/i.test(r) ? "" : r; };
export const EVIDENCE_MIN = 3;          // spec: drop n < 3
// Verdicts (Kendall, 30 Sep 2026): within = min <= median <= max, strictly; a_little_above = over max by at most 5%; above = more
// than 5% over; below = under min. v302 (Kendall, 4 Oct 2026): the budget MINIMUM is a HARD FLOOR (a realtor's commission starts there) - nothing under it is offered, no
// below window. Above the top only to +15% (labelled a little over / over; the stretch keeps its meaning).
export const LITTLE_OVER = 0.05;
const ABOVE_CAP = 0.15;
const NEAR_M = 1000;                    // "near a metro" / "schools nearby": a straight-line kilometre (no walking or drive times)
export const TENANCY_MIN_SHARE = 0.5;   // the building page's own gate (building_page.js): below half coverage the tenancy count is not shown
const MAX_DISTRICT_CARDS = 12;          // unit-mix cards are ~1 MB each; an all-Dubai query reads the busiest districts' cards only
const TIER = { within: 0, stretch: 1, a_little_above: 2, below: 3, above: 4 };
// the ranking order (Kendall, 30 Sep 2026; v282 1 Oct): within the target, then within the stretch, then a_little_above, then the rest
// (below and above together); inside each group: musts met, then nice-to-haves met, then evidence (contracts or sales)
const rankTier = (c) => Math.min(TIER[c.verdict], 3);

// the rent index's own name key (build_rent_index.py fold/norm/stem/nkey), so "the same name" means the same thing here
const fold = (s) => String(s == null ? "" : s).normalize("NFKD").replace(/[^\x00-\x7f]/g, "");
const norm = (s) => fold(s).toLowerCase().replace(/[^a-z0-9]/g, "");
const stem = (s) => fold(s).toLowerCase().replace(/\b(by|the|tower|towers|residences?|residence|building|bldg|apartments?)\b/g, "");
export const nkey = (s) => norm(stem(s));
const snake = (s) => fold(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

export async function kvJson(env, name) {         // an img_* value: plain JSON, or gzipped JSON (the /img route passes 1f 8b through)
  return (await readJson(env, name, "arrayBuffer")).v;
}
async function readJson(env, name, opts) {        // -> {v, bytes}; bytes = the stored size, which the memo budgets by
  let v = null;
  try { v = await env.MEETINGS.get("img_" + name, opts); } catch (e) { return { v: null, bytes: 0 }; }
  if (v == null) return { v: null, bytes: 0 };
  try {
    if (typeof v === "string") return { v: JSON.parse(v), bytes: v.length };
    let u8 = new Uint8Array(v);
    const bytes = u8.length;
    if (u8.length > 2 && u8[0] === 0x1f && u8[1] === 0x8b) u8 = new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
    return { v: JSON.parse(new TextDecoder().decode(u8)), bytes };
  } catch (e) { return { v: null, bytes: 0 }; }
}

// ---- v292 (2 Oct 2026, "every search takes 45 s"): THE PER-ISOLATE MEMO for the files a search reads ----------------------------
// Measured on the live worker (wrangler tail): a single-district search is 0.1-0.5 s of wall time on the server; the 43-49 s was
// the laptop's own connection set-up (PowerShell's first request to ANY host, example.com included, took the same 43 s). What the
// server did have: every search read its files ONE AFTER ANOTHER - districts, rent index, unit-mix cards, the 1.1 MB amenity layer,
// the amenity facts, the developer sheets, the beds-left register, the Google district files, the advertised supply - eleven KV
// round trips in a row, each a cold read when the last search was more than a minute ago (KV's own edge cache keeps a value 60 s),
// and an all-Dubai search with must-haves read 258 values (40 MB) and took 7-13 s cold. Now: the reads that do not depend on each
// other start together (three waves, not eleven), each value asks KV's edge to keep it for KV_EDGE_TTL_S, and the parsed value is
// kept in this isolate for KV_MEMO_TTL_MS, so the next search in the same two minutes reads nothing. The memo is bounded by
// KV_MEMO_MAX_BYTES of stored size (least recently used out first); a value bigger than half of it is never kept. A miss (null)
// is kept too, for the same short time. The values kept are SHARED between searches: nothing in this file, live_answers.js or
// loadDevAvail() writes into them (candidates, criteria and indexes are new objects), and only those use the memo - the PDFs
// (brief_docs.js) still read through kvJson().
export const KV_MEMO_TTL_MS = 120000;           // 2 minutes: the pipelines publish these files at most a few times a day
export const KV_EDGE_TTL_S = 300;               // KV's edge cache (the cacheTtl read option; the default is 60 s)
export const KV_MEMO_MAX_BYTES = 12e6;          // stored size; a single-district search reads about 4 MB of it
const MEMO = new WeakMap();                     // KV binding -> Map(name -> {t, p, bytes}), in recency order
const memoBindings = new Set();
let memoNow = () => Date.now();
export function __setKvMemoClock(fn) { memoNow = fn || (() => Date.now()); }   // tests
export function __resetKvMemo() { for (const k of memoBindings) MEMO.delete(k); memoBindings.clear(); }
export function kvMemoStats(kv) { const m = kv && MEMO.get(kv); if (!m) return { entries: 0, bytes: 0 }; let b = 0; for (const e of m.values()) b += e.bytes; return { entries: m.size, bytes: b }; }
function memo(env, name, load) {                // load() -> Promise<{v, bytes}>
  const kv = env.MEETINGS;
  let m = MEMO.get(kv);
  if (!m) { m = new Map(); MEMO.set(kv, m); memoBindings.add(kv); }
  const now = memoNow(), hit = m.get(name);
  if (hit && now - hit.t < KV_MEMO_TTL_MS) { m.delete(name); m.set(name, hit); return hit.p; }   // most recently used goes last
  const e = { t: now, bytes: 0, p: null };
  e.p = load().then((r) => {
    e.bytes = r.bytes;
    if (m.get(name) === e) {
      if (r.bytes > KV_MEMO_MAX_BYTES / 2) m.delete(name);
      else { let tot = 0; for (const x of m.values()) tot += x.bytes; for (const [k, x] of m) { if (tot <= KV_MEMO_MAX_BYTES) break; if (x === e || !x.done) continue; m.delete(k); tot -= x.bytes; } }
    }
    e.done = true;
    return r.v;
  }, () => { if (m.get(name) === e) m.delete(name); return null; });
  m.set(name, e);                                // kept at once, as a promise: two readers at the same moment share one read
  return e.p;
}
export function kvJsonMemo(env, name) {
  if (!env || !env.MEETINGS) return kvJson(env, name);
  return memo(env, name, () => readJson(env, name, { type: "arrayBuffer", cacheTtl: KV_EDGE_TTL_S }));
}
const kvKeysMemo = (env, prefix, pages) => memo(env, "keys:" + prefix, async () => { const s = await kvKeys(env, prefix, pages); return { v: s, bytes: s.size * 40 }; });

async function kvKeys(env, prefix, pages) {     // every key under a prefix, a few pages at most
  const out = new Set(); let cursor;
  for (let p = 0; p < (pages || 5); p++) {
    let r; try { r = await env.MEETINGS.list(cursor ? { prefix, cursor } : { prefix }); } catch (e) { break; }
    for (const k of (r && r.keys) || []) out.add(k.name);
    if (!r || r.list_complete !== false || !r.cursor) break;
    cursor = r.cursor;
  }
  return out;
}

const metres = (a, b) => { const k = Math.cos(((a[1] + b[1]) / 2) * Math.PI / 180); const dx = (a[0] - b[0]) * k, dy = a[1] - b[1]; return Math.sqrt(dx * dx + dy * dy) * 111320; };

// ---- the query ----------------------------------------------------------------------------------------------------
export function parseBrief(sp) {
  const errs = [];
  const mode = String(sp.get("mode") || "rent").toLowerCase();
  if (mode !== "rent" && mode !== "buy") errs.push("mode must be rent or buy");
  // v282: bedrooms are a LIST (beds=2,3); one value still works
  const bedsRaw = String(sp.get("beds") || "1").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
  const bedsList = [...new Set(bedsRaw.map((b) => BEDS[b]))].sort();
  if (!bedsRaw.length || bedsList.some((b) => b == null)) errs.push("beds must be studio, 1, 2 or 3 (several may be given: beds=2,3)");
  const beds = bedsList.filter((b) => b != null);
  const num = (k) => { const s = sp.get(k); if (s == null || s === "") return null; const n = Number(String(s).replace(/[,_\s]/g, "")); if (!isFinite(n) || n < 0) { errs.push(k + " must be a number of AED"); return null; } return n; };
  let min = num("min"), max = num("max"), stretch = num("stretch");
  if (min != null && max != null && max < min) { const t = min; min = max; max = t; }
  if (stretch != null && (!stretch || max == null || stretch <= max)) stretch = null;   // a stretch is only ever above the target
  const areas = String(sp.get("areas") || "").split(",").map((s) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, "")).filter(Boolean);
  // v282: home type is a LIST too (type=townhouse,villa); apartment / townhouse / villa / any
  const typesRaw = String(sp.get("type") || "any").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
  if (typesRaw.some((t) => !HOME_TYPES.includes(t))) errs.push("type must be apartment, townhouse, villa or any (several may be given)");
  let types = [...new Set(typesRaw.filter((t) => HOME_TYPES.includes(t)))];
  if (!types.length || types.includes("any") || ["apartment", "townhouse", "villa"].every((t) => types.includes(t))) types = ["any"];
  const type = types.join(",");
  const furnished = "either";                                                   // v374: furnishing is not asked (no register records it); an old link's furnished= is ignored
  const listOf = (k) => String(sp.get(k) || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).filter((m) => !PULLED_CRITS.includes(m));
  const mustsIn = listOf("musts"), niceIn = listOf("nice");
  const bad = mustsIn.concat(niceIn).filter((m) => !CRIT_KEYS.includes(m));
  if (bad.length) errs.push("unknown musts or nice-to-haves: " + bad.join(", ") + " (allowed: " + CRIT_KEYS.join(", ") + ")");
  const musts = [...new Set(mustsIn.filter((m) => CRIT_KEYS.includes(m)))];
  const nice = [...new Set(niceIn.filter((m) => CRIT_KEYS.includes(m) && !musts.includes(m)))];
  let limit = parseInt(sp.get("limit") || "10", 10);
  if (!isFinite(limit) || limit < 1) limit = 10;
  limit = Math.min(limit, 50);
  const compare = sp.get("compare") === "1" && areas.length >= 2 && areas.length <= 3;
  const bedsOut = beds.length ? beds.map((b) => (b === 0 ? "studio" : String(b))).join(",") : bedsRaw.join(",");
  return { errs, q: { mode, beds: bedsOut, min, max, stretch, areas, type, furnished, musts, nice, compare, limit }, bed: beds[0], beds };
}

// v282: max is the TARGET; stretch (optional) is "up to". within <= target; stretch <= stretch; then Kendall's 30 Sep rule on the TOP
// (the stretch where there is one, else the target): up to 5% over is a_little_above, then above (listed to +15%).
export function verdictOf(v, min, max, stretch) {
  const lo = min || 0, hi = max == null ? Infinity : max, top = stretch != null && stretch > hi ? stretch : hi;
  if (v < lo) return null;                                  // v302: the minimum is a hard floor
  if (v <= hi) return "within";
  if (v <= top && top > hi) return "stretch";
  if (v <= top * (1 + LITTLE_OVER)) return "a_little_above";
  if (v <= top * (1 + ABOVE_CAP)) return "above";
  return null;
}
export const kindsOfType = (type) => { const t = String(type || "any").split(","); return t.includes("any") ? ["b", "v"] : [...new Set(t.map((x) => (x === "apartment" ? "b" : "v")))]; };

// v282 - the figure for one home kind and bedroom count. Apartments: the "b" band (bedrooms read from the size). Villas and
// townhouses: the register's OWN bedroom count where it gives 3+ contracts (rent index "vr", build_rent_index.py v282), else the "v"
// band, which is read from the size where the register is blank and where band 3 means "3 or more". The basis is carried.
export function rentStat(it, kind, bed) {
  if (kind === "b") { const s = it.b && it.b[String(bed)]; return s ? { s, basis: "size" } : null; }
  const r = it.vr && it.vr[String(bed)];
  if (r && r.n >= EVIDENCE_MIN) return { s: r, basis: "registered" };
  const s = it.v && it.v[String(bed)];
  return s ? { s, basis: bed === 3 ? "size_3plus" : "size" } : null;
}
export const BEDS_BASIS_SAY = { registered: "bedrooms as the register records them", size: "bedrooms read from the size", size_3plus: "3 or more bedrooms, read from the size (the register does not separate them here)" };

// ---- rent: one candidate per index record, on the SAME figure the HOMES panel shows -------------------------------
// v285 (Kendall, 1 Oct 2026, while filming: the Capital Bay A card said "typical rent AED 50k, middle half 49k-51k, 9 lettings (4 new)"
// and the PDF for the same brief said "AED 55,000, middle half 50,000-55,650"). The list read the median of NEW lettings (3 or more),
// the PDF read s.m / s.q1 / s.q3 - the median of ALL contracts. Same record, same window, same bedroom band, two bases. THE one figure
// is rentFigure(): /brief_api's evidence row and every number the PDFs print (card, dossier, layouts, budget line, appendix, the
// all-types table) come from it, and pickRent() is the one choice of home kind and bedroom count both make, as estimateLeft() is the
// one "left" estimate.
export function rentFigure(s, ctx) {
  if (!s) return null;
  const nb = s.nn >= 3 && !!s.mn;
  // v310 (R5): the size is kept only where it is possible for the home kind and bedroom count (ctx = {kind, bed}); without a ctx it is kept as it was
  const size_ok = ctx && ctx.kind != null ? sizeSane(s.s, ctx.kind, ctx.bed) : true;
  return { m: nb ? s.mn : s.m, q1: nb ? s.q1n : s.q1, q3: nb ? s.q3n : s.q3, n: s.n, nn: s.nn, nr: s.nr, s: size_ok ? s.s : null, size_ok, last: s.last,
    median_of: nb ? "new_lettings" : "all_contracts", median_all: s.m };
}
const rentFig = (s) => rentFigure(s).m;
// The /brief_api choice for one record: of the kinds and bedroom counts asked, the best verdict tier, then the most contracts; under
// EVIDENCE_MIN contracts or outside the offered window is no choice. q: {min, max, stretch} (null = none). -> {best, thin}
export function pickRent(it, kinds, beds, q) {
  let best = null, thin = 0, hid = false;
  for (const k of kinds) for (const bed of beds) {
    const rs = rentStat(it, k, bed);
    if (!rs) continue;
    const s = rs.s;
    if (s.n < EVIDENCE_MIN) { thin++; continue; }
    const fig = rentFigure(s, { kind: k, bed }), v = fig.m, verdict = verdictOf(v, q.min, q.max, q.stretch);
    if (!verdict) { if (q.min && v < q.min) hid = true; continue; }
    if (!best || TIER[verdict] < TIER[best.verdict] || (TIER[verdict] === TIER[best.verdict] && s.n > best.s.n)) best = { s, fig, v, verdict, kind: k, villa: k === "v", bed, basis: rs.basis };
  }
  return { best, thin, hid: !best && hid };
}
function rentCandidates(RI, q, beds) {
  const out = []; let thin = 0, hidden = 0;
  const kinds = kindsOfType(q.type);
  for (const it of (RI && RI.items) || []) {
    const d = areaSlugOf(it), sa = searchAreaOf(it);
    if (q.areas.length && !q.areas.includes(sa)) continue;
    const pr = pickRent(it, kinds, beds, q), best = pr.best; thin += pr.thin; if (pr.hid) hidden++;
    if (!best) continue;
    const s = best.s, f = best.fig;
    out.push({
      it, d, sa, i: it.i == null ? null : it.i, name: it.n, aliases: it.a || [], lon: it.lon, lat: it.lat, dldArea: it.area,
      key: candidateKey(it), bed: best.bed,
      verdict: best.verdict, v: best.v, n: s.n,
      evidence: { basis: "ejari", median: f.m, q1: f.q1, q3: f.q3, n: f.n, n_new: f.nn,
        median_of: f.median_of, median_all: f.median_all, sqm: f.s, latest: f.last, home: best.villa ? "villa" : "apartment",
        beds: best.bed, beds_basis: best.basis,
        // v310 - R4/R6/R7: how many lettings, over which dates, and whose evidence it is (the community's, where the record says so)
        few: f.n < 5, say: evidenceSay(f, it.ev_scope || null), window: windowOf(it, RI), scope: it.ev_scope || null },
    });
  }
  return { cands: out, thin, hidden };
}

// ---- v314 - THE AREA FIGURE (Kendall, 4 Oct 2026: "if the app says nothing while the register has the data that is our failure") -----
// The rent index holds two months of lettings; many buildings have fewer than three of a given size in that window although the area
// has plenty. Where an area was asked for and NO building of it can be listed, the area's own figure for the home type and bedroom count
// is offered instead: one row per area, named for the whole area (never for a building), with its own contract count, labelled as the
// area's. It is the same Ejari figure the area comparison shows (RI.areas: the whole Land Department area, named projects or not).
// It needs AREA_FIGURE_MIN contracts of that size and type. It is never attached to a building, has no building page and no map position.
export const AREA_FIGURE_MIN = 10;
export function areaFigureCands(RI, q, beds, covered, DN) {
  const out = [], kinds = kindsOfType(q.type);
  const W = RI && RI.window ? " between " + RI.window[0] + " and " + RI.window[1] : "";
  for (const a of q.areas) {
    if (covered.has(a)) continue;
    let best = null;
    for (const row of ((RI && RI.areas) || []).filter((r) => searchAreaOf(r) === a))
      for (const k of kinds) for (const bed of beds) {
        const rs = rentStat(row, k, bed);
        if (!rs || rs.s.n < AREA_FIGURE_MIN) continue;
        const fig = rentFigure(rs.s), verdict = verdictOf(fig.m, q.min, q.max, q.stretch);
        if (!verdict) continue;
        if (!best || TIER[verdict] < TIER[best.verdict] || (TIER[verdict] === TIER[best.verdict] && rs.s.n > best.s.n)) best = { row, s: rs.s, fig, verdict, kind: k, bed, basis: rs.basis };
      }
    if (!best) continue;
    const f = best.fig, area = DN[a] || titleArea(best.row.area), homeWord = best.kind === "v" ? "villa or townhouse" : "apartment";
    out.push({
      it: best.row, d: null, sa: a, i: null, areaFigure: true, name: area + " (whole area)", aliases: [], lon: null, lat: null, dldArea: best.row.area,
      key: "area:" + a, bed: best.bed, verdict: best.verdict, v: f.m, n: f.n,
      why: "Area figure, not one building: typical " + (best.bed === 0 ? "studio" : best.bed === 3 ? "3-bed" : best.bed + "-bed") + " " + homeWord + " rent across all of " + area + ", from " + f.n + " registered lettings" + W +
        ". No single building here has three lettings of this size in that window, so the area's own figure is shown instead of a building's.",
      evidence: { basis: "ejari_area", scope: "area", median: f.m, q1: f.q1, q3: f.q3, n: f.n, n_new: f.nn, median_of: f.median_of, median_all: f.median_all, sqm: f.s, latest: f.last,
        home: best.kind === "v" ? "villa" : "apartment", beds: best.bed, beds_basis: best.basis },
    });
  }
  return out;
}

// ---- buy: map_prices finds them (what Buy mode shows); the unit-mix card supplies the median AND the count ---------
const isVilla = (it) => !!(it.fl && it.fl <= 3 && it.b && !it.b["0"] && !it.b["1"]) || /villa|townhouse|town house|mansion/i.test(it.n || "");   // homeMatches' own test
const rowLabel = (b) => (b === 0 ? "studio" : b + " bedroom");
function buyPrelim(MP, q, beds) {
  const out = [], kinds = kindsOfType(q.type);
  for (const it of (MP && MP.items) || []) {
    if (it.i == null || it.i < 0 || !it.d) continue;                          // a launch placed by name only has no card to count from
    if (q.areas.length && !q.areas.includes(it.d)) continue;
    if (!kinds.includes("b") && !isVilla(it)) continue;
    if (!kinds.includes("v") && isVilla(it)) continue;
    const bs = Object.keys(it.b || {}).map(Number).filter((b) => b !== 9 && beds.some((bed) => (bed === 3 ? b >= 3 : b === bed)) && !(it.e || []).includes(b));
    if (bs.length) out.push({ it, bs });
  }
  return out;
}
function buyCandidates(pre, cards, q) {
  const out = []; let thin = 0, noCount = 0, noCard = 0, hidden = 0;
  for (const { it, bs } of pre) {
    const card = cards[it.d] && cards[it.d][String(it.i)];
    if (!card) { noCard++; continue; }
    const sold = (card.dld_sales && card.dld_sales.sold_by_type) || {};
    const soldOf = (b) => { for (const k of Object.keys(sold)) if (k.toLowerCase() === rowLabel(b)) return sold[k]; return null; };
    let best = null, hid = false;
    for (const b of bs) {
      const row = (card.rows || []).find((r) => String(r.type || "").toLowerCase() === rowLabel(b));
      if (!row || !row.median_aed) continue;                                   // an estimate (est_aed) is never a sale price
      const n = soldOf(b);
      if (n == null) { noCount++; continue; }
      if (n < EVIDENCE_MIN) { thin++; continue; }
      const verdict = verdictOf(row.median_aed, q.min, q.max, q.stretch);
      if (!verdict) { if (q.min && row.median_aed < q.min) hid = true; continue; }
      if (!best || TIER[verdict] < TIER[best.verdict] || (TIER[verdict] === TIER[best.verdict] && n > best.n)) best = { b, row, n, verdict };
    }
    if (!best) { if (hid) hidden++; continue; }
    const ds = card.dld_sales || {};
    const syn = !!(it.x || card.synthetic);                                    // v314 - built from the register by project: no footprint, no building page, no map position
    const cav = [];
    if (card.price_basis) cav.push(card.price_basis);
    if (card.plot_size_note) cav.push(card.plot_size_note + " No price per sq ft is given for it.");
    if (card.bedrooms_basis) cav.push("Bedrooms are as the Land Department register records them" + (ds.unspecified_bedroom_sales ? "; " + ds.unspecified_bedroom_sales + " sales here carry no bedroom count and are not in these figures" : "") + ".");
    out.push({
      syn, it, d: it.d, i: it.i, name: card.name || it.n, aliases: it.n && card.name && nkey(it.n) !== nkey(card.name) ? [it.n] : [], lon: it.lon, lat: it.lat,
      key: it.d + ":" + it.i, verdict: best.verdict, v: Math.round(best.row.median_aed), n: best.n, card, bed: Math.min(best.b, 3),
      evidence: { basis: "dld_sales", median: Math.round(best.row.median_aed), q1: null, q3: null, n: best.n, n_new: null, sqm: best.row.median_sqm || null,
        latest: ds.last || null, first: ds.first || null, beds: best.b, dates_are: syn && ds.window_from ? "this project's registered sales since " + ds.window_from : "the building's sales of every type",
        ...(syn ? { scope: "project", price_basis: card.price_basis || null, window_from: ds.window_from || null, caveats: cav } : {}) },
    });
  }
  return { cands: out, thin, noCount, noCard, hidden };
}

// ---- a name lookup must agree with the record (v231): a rent record bound to an app building named otherwise loses the bind -----
// "yes" - a register name and the app record's name are the same name; "part" - the record's name is one of those names plus a
// short tower/phase suffix (Bloom Towers -> Bloom Towers B, Fortunato -> Fortunato 1); "no" - anything else (Regent Court ->
// Palatium Residences). Two index records bound to one building keep the bind on the better-evidenced one only.
export function nameAgrees(names, recordName) {
  const r = nkey(recordName); if (!r) return "yes";
  const ks = names.map(nkey).filter(Boolean);
  if (ks.includes(r)) return "yes";
  return ks.some((k) => (r.startsWith(k) && r.length - k.length <= 2) || (k.startsWith(r) && k.length - r.length <= 2)) ? "part" : "no";
}
function unbind(c, why, recordName) {
  c.disputed = { district: c.d, app_id: c.i, record_name: recordName || null, why };
  c.i = null; c.key = "dld:" + (c.it.p || nkey(c.name)); c.lon = null; c.lat = null;   // the position came from the disputed footprint too
}
function unbindDisputed(cands, cards) {
  let n = 0;
  for (const c of cands) {
    if (c.i == null || !c.d || !cards[c.d]) continue;
    const card = cards[c.d][String(c.i)];
    if (!card || !card.name) continue;
    c.agree = nameAgrees([c.name].concat(c.aliases), card.name);
    if (c.agree === "no") { unbind(c, "the app building is named " + card.name, card.name); n++; }
  }
  const byKey = {};
  for (const c of cands.filter((x) => x.i != null).sort((a, b) => ((a.agree === "yes" ? 0 : 1) - (b.agree === "yes" ? 0 : 1)) || (b.n - a.n))) {   // the exact name keeps it (Chaimaa Avenue, not Chaimaa Avenue 2)
    if (byKey[c.key]) { unbind(c, "the same app building is already listed as " + byKey[c.key].name, byKey[c.key].name); n++; }
    else byKey[c.key] = c;
  }
  return n;
}

// ---- T minus R, the "estimated left" of the spec - only where both sources are scoped to this one building ---------
function tenancyType(b, byType) {
  let n = 0, hit = false;
  for (const k of Object.keys(byType || {})) {
    const m = /^(\d+)\s*bed/i.exec(k), t = /^studio$/i.test(k.trim()) ? 0 : m ? +m[1] : null;
    if (t == null) continue;
    if (b === 3 ? t >= 3 : t === b) { n += byType[k]; hit = true; }
  }
  return hit ? n : 0;                                                          // a building with running tenancies of other types has 0 of this one
}
export function estLeft(card, ten, i, bed) {
  const why = [];
  if (!card) return { withheld: "no unit-mix record for this building" };
  const d = card.dld || {};
  if (d.buildings !== 1) why.push("the units register property covers " + (d.buildings || "an unknown number of") + " buildings");
  const rows = (card.rows || []).filter((r) => r.basis === "DLD units register" && (() => { const t = String(r.type || "").toLowerCase(); const m = /^(\d+) bedroom/.exec(t); return t === "studio" ? bed === 0 : m ? (bed === 3 ? +m[1] >= 3 : +m[1] === bed) : false; })());
  const T = rows.length ? rows.reduce((a, r) => a + (+r.units || 0), 0) : null;
  if (!T) why.push("the units register gives no count of this bedroom type");
  const cov = ten && ten.coverage && ten.coverage.share_bound;
  const tr = ten && ten.buildings_by_id && ten.buildings_by_id[String(i)];
  if (!ten) why.push("no Ejari tenancy file for this district");
  else if (!(cov >= TENANCY_MIN_SHARE)) why.push("only " + Math.round((cov || 0) * 100) + "% of this district's running tenancies reach a building (the app shows a count from " + Math.round(TENANCY_MIN_SHARE * 100) + "%)");
  if (ten && !tr) why.push("no running tenancy on record for this building");
  if (tr && tr.scope !== "building") why.push("the tenancy count covers the whole project");
  if (tr && tr.bulk_registration) why.push("part of it is registered in bulk on single contracts");
  if (why.length) return { withheld: why.join("; ") };
  const R = tenancyType(bed, tr.by_type);
  return {                                                                     // the shape the /brief page reads: about N of T
    about: Math.max(0, Math.round((T - R) / 10) * 10), of: T, running: R, as_at: tr.as_at || ten.as_at || null,
    label: "an estimate, not a count",
    explain: "Flats of this type in the Land Department units list, less the Ejari tenancies of this type running on " + (tr.as_at || ten.as_at) +
      ". Owner-occupiers and renewals not registered are in it, so the real number is lower. It is never the number available.",
  };
}

// ---- the beds-left register (img_beds_left_<district>, built by the DDA session from the full government tenancy register):
// {as_of, source, rows: [{key | dld_project, name, beds, T, R}]} - T flats of the band in the Land Department units register, R tenancy
// contracts of the band running on as_of. Preferred over the coverage-gated path above; matched by our key, else by DLD project name.
const bandOf = (b) => { const t = String(b == null ? "" : b).trim().toLowerCase(); if (t === "studio" || t === "0") return 0; const m = /^(\d+)/.exec(t); return m ? Math.min(+m[1], 3) : null; };
export function bedsLeftRow(BL, c, bed) {
  if (!BL || !Array.isArray(BL.rows)) return null;
  const rows = BL.rows.filter((r) => bandOf(r.beds) === bed && +r.T > 0 && r.R != null && isFinite(+r.R));
  const names = [c.name].concat(c.aliases || []).map(nkey).filter(Boolean);
  return rows.find((r) => r.key && String(r.key).toLowerCase() === String(c.key).toLowerCase())
    || rows.find((r) => r.dld_project && names.includes(nkey(r.dld_project))) || null;
}
export function estFromBedsLeft(BL, row) {
  const T = +row.T, R = +row.R;
  return {
    about: Math.max(0, Math.round((T - R) / 10) * 10), of: T, running: R, as_at: BL.as_of || null, source: BL.source || null,
    label: "an estimate, not a count",
    explain: "Flats of this type in the Land Department units register, less the tenancy contracts of this type running on " + (BL.as_of || "the register date") +
      ". Owner-occupiers and renewals not registered are in it, so the real number is lower. It is never the number available.",
  };
}

// ---- THE one "estimated left" (Kendall 30 Sep): the /brief_api list row AND the /brief_pdf documents (src/brief_docs.js) both call
// this, so the list and the PDF can never disagree. BL = the district's beds-left register (img_beds_left_<district>) or null; card =
// its unit-mix record for the building; ten = the district's tenancy file (read only when BL is missing); c = {key, name, aliases, i}
// as candidateKey() / the rent index give them; bed = 0..3. Returns {about, of, running, as_at, ...} or {withheld: why}.
export function estimateLeft({ BL, card, ten, c, bed }) {
  if (BL) { const row = bedsLeftRow(BL, c, bed); return row ? estFromBedsLeft(BL, row) : { withheld: "not in the beds-left register for this district (" + (BL.as_of || "undated") + ")" }; }
  if (c.i != null) return estLeft(card, ten, c.i, bed);
  return { withheld: "no building record in the app to count the units register against" };
}
// the key a rent-index record is listed under (before the route's [a-z0-9_:-] clean-up, which estimateLeft's match ignores anyway)
export const candidateKey = (it) => (it.i != null && it.d ? it.d + ":" + it.i : "dld:" + (it.p || nkey(it.n)));

// ---- DEVELOPER AVAILABILITY (v277, Kendall 1 Oct 2026) ------------------------------------------------------------------------
// The register "left" estimate stays in the API (estimated_left, above) but is no longer on the client face. In its place the
// list row and the dossier's page 2 say what a DEVELOPER'S OWN SHEET says, where we hold one: the availability lists the
// developers post to Naj's WhatsApp group, read by naj-market-pulse scripts/extract_avail.py and published by
// build_avail_index.py as KV img_avail_index ({sheets:[{sheet, note, mapped, d}]}) and, per developer, img_drill_<d>.claimed
// ({as_of, source, rooms, detail:[{p, completion, plan, as_of, units:[[unit, type, sqft, aed, view], ...], types:[{t, n, ...}]}]}).
// A building matches a sheet project by NAME, exactly (nkey), against the record name and its "also filed as" names - never by
// prefix (a prefix fronting several sheets names a family, not a building). The two sources are never mixed: a row carries the
// developer figure OR nothing; the estimate is a separate field nothing on screen reads now.
const bandOfType = (t) => {
  const s = String(t == null ? "" : t).toLowerCase();
  if (/office|retail|shop|warehouse|showroom|hotel/.test(s)) return null;                 // not a home
  if (/studio/.test(s)) return 0;
  const m = /(\d+)\s*(?:b\/?r|br|bed|bhk)/.exec(s);
  return m ? Math.min(+m[1], 3) : null;
};
const bandFits = (band, bed) => band != null && (bed === "all" || (bed === 3 ? band >= 3 : band === bed));
export async function loadDevAvail(env, read) {         // read: kvJson (the PDFs) or kvJsonMemo (the search, v292)
  read = read || kvJson;
  const idx = await read(env, "avail_index");
  const sheets = (idx && Array.isArray(idx.sheets) ? idx.sheets : []).filter((s) => s && s.d);
  const out = [];
  await Promise.all(sheets.map(async (s) => {
    const dk = String(s.d).replace(/[^a-z0-9]/g, "");
    const drill = dk ? await read(env, "drill_" + dk) : null;
    const cl = drill && drill.claimed;
    if (!cl || !Array.isArray(cl.detail) || !cl.detail.length) return;
    const developer = String(cl.source || s.sheet || dk).replace(/\s+sheets?\b.*$/i, "").replace(/\s+\d{4}-\d{2}-\d{2}$/, "").trim() || dk;
    out.push({ d: dk, developer, as_of: cl.as_of || null, auto: /auto-read/i.test(String(cl.source || "")), projects: cl.detail.filter((p) => p && p.p) });
  }));
  return out.sort((a, b) => a.developer.localeCompare(b.developer));
}
// bed: 0..3 or "all". Returns null where no developer sheet names this building; otherwise {developer, as_of, project, count,
// units: [{unit, type, sqft, aed, view}] (unit rows of the band, when the sheet holds rows) or types: [{type, n}] (a type-level sheet)}.
export function devAvailFor(avail, c, bed) {
  if (!avail || !avail.length) return null;
  const names = [c.name].concat(c.aliases || []).map(nkey).filter(Boolean);
  if (!names.length) return null;
  for (const dev of avail) for (const p of dev.projects) {
    if (!names.includes(nkey(p.p))) continue;
    const units = (p.units || []).filter((u) => Array.isArray(u) && bandFits(bandOfType(u[1]), bed))
      .map((u) => ({ unit: String(u[0] == null ? "" : u[0]), type: String(u[1] == null ? "" : u[1]), sqft: isFinite(+u[2]) && +u[2] > 0 ? Math.round(+u[2]) : null, aed: isFinite(+u[3]) && +u[3] > 0 ? Math.round(+u[3]) : null, view: u[4] ? String(u[4]) : "" }));
    const types = (p.types || []).filter((t) => t && bandFits(bandOfType(t.t), bed) && isFinite(+t.n) && +t.n > 0).map((t) => ({ type: String(t.t), n: +t.n, from_aed: isFinite(+t.from_aed) ? +t.from_aed : null }));
    const count = units.length || types.reduce((a, t) => a + t.n, 0);
    return { developer: dev.developer, as_of: p.as_of || dev.as_of || null, auto: !!dev.auto, project: String(p.p), count, units: units.length ? units : undefined, types: !units.length && types.length ? types : undefined };
  }
  return null;
}

// ---- the non-negotiables: a source or null --------------------------------------------------------------------------
export function mustsOf(c, card, brochure, AM) {
  const am = ((brochure && brochure.amenities) || []).join(" | ");
  const pos = c.lon != null && c.lat != null ? [c.lon, c.lat] : null;
  let metro = null, nearest = null, schools = null;
  if (pos && AM && AM.items) {
    const stations = AM.items.filter((a) => a.k === "metro" && a.lon != null);
    if (stations.length) {
      for (const s of stations) { const m = metres(pos, [s.lon, s.lat]); if (!nearest || m < nearest.m) nearest = { name: s.n, line: s.x || null, m: Math.round(m) }; }
      metro = nearest.m <= NEAR_M;                                             // the RTA station list is the whole network: far is a real "no"
    }
    if (AM.items.some((a) => a.k === "school" && a.lon != null && metres(pos, [a.lon, a.lat]) <= NEAR_M)) schools = true;   // none found is not "none there"
  }
  return {
    musts: {
      balcony: /balcon/i.test(am) ? true : null,
      metro,
      gym: /\bgym|fitness/i.test(am) ? true : null,
      parking: /parking|car park/i.test(am) || (card && (card.car_parks > 0 || card.parking_allocated > 0)) ? true : null,
      schools,
    },
    nearest,
  };
}

// ---- v282: the client's criteria, one answer each, with its source -----------------------------------------------------------
// {v: true | false | null, src: "where the answer comes from, in plain English", detail?: "supporting facts"}. Shared with the PDFs
// (src/brief_docs.js), so the list and the documents give the same answer from the same sources.
const yearOf = (s) => { const m = /\b(19[5-9]\d|20[0-4]\d)\b/.exec(String(s == null ? "" : s)); return m ? +m[1] : null; };
export function completionOf(card, brochure) {
  const dm = card && card.dm;
  if (dm && (dm.construction_year || dm.completed)) { const y = +dm.construction_year || yearOf(dm.completed); if (y) return { year: y, src: "Dubai Municipality building record (completion " + (dm.completed || y) + ")" }; }
  if (brochure && brochure.completed && yearOf(brochure.completed)) return { year: yearOf(brochure.completed), src: "the developer's own project page" };
  return null;
}
// ---- v289 (Kendall, 2 Oct 2026: a DAMAC Hills brief came back "not known" for pool, pets and gym on every home - "we need to know if
// they have it, 99% do"). The amenity facts file, one per district: naj-market-pulse scripts/build_amenities.py ->
// data/amenities/amenities_<district>.json -> KV img_amenities_<district> (plain or gzipped JSON). Per home {key, keys, names, facts:
// {criterion: {v, level: building | cluster | community, say, source_name, as_of, quote?, url?, detail?}}}: the Land Department
// buildings and units registers, the developer's own pages, the owners' association budgets and OpenStreetMap, each naming its
// source, with a community's facts inherited by every home in it. A file answer fills only what the answers above leave open.
export const AMEN_CRITS = ["private_pool", "community_pool", "pets", "gym", "parking", "balcony"];
export function amenIndex(doc) {
  if (!doc || !Array.isArray(doc.homes)) return null;
  const byKey = new Map(), byName = new Map(), dup = new Set();
  for (const h of doc.homes) {
    for (const k of (h.keys || []).concat(h.key ? [h.key] : [])) if (k) byKey.set(String(k).toLowerCase(), h);
    for (const n of h.names || []) { const k = nkey(n); if (!k) continue; if (byName.has(k) && byName.get(k) !== h) dup.add(k); else byName.set(k, h); }
  }
  for (const k of dup) byName.delete(k);                                         // a name two homes share answers for neither
  return { doc, byKey, byName };
}
// c: {key?, d?, i?, it?: {p}, name, aliases} -> the file's home, by our key, then the rent record's DLD key, then the exact name (nkey)
export function amenFor(AX, c) {
  if (!AX || !c) return null;
  const ks = [];
  if (c.key) ks.push(String(c.key).toLowerCase());
  if (c.d && c.i != null) ks.push((c.d + ":" + c.i).toLowerCase());
  if (c.it && c.it.p) ks.push("dld:" + String(c.it.p).toLowerCase());
  for (const k of ks) if (AX.byKey.has(k)) return AX.byKey.get(k);
  for (const n of [c.name].concat(c.aliases || [])) { const h = AX.byName.get(nkey(n)); if (h) return h; }
  return null;
}
const LEVEL_SAY = { building: "a building fact", near: "a fact about a place close to this home", cluster: "a cluster fact", community: "a community fact" };
// "Community pools (DAMAC Hills: temperature-controlled swimming pools) - a community fact, per DAMAC's own DAMAC Hills page (2026-09-18)"
export function amenSrc(f) {
  return String(f.say || "") + " - " + (LEVEL_SAY[f.level] || "a fact") + ", per " + (f.source_name || "a named source") +
    (f.as_of ? " (" + f.as_of + ")" : "") + (f.quote ? ": “" + f.quote + "”" : "") + (f.src === "osm" ? ". © OpenStreetMap contributors" : "");
}
function applyAmen(out, af) {
  for (const k of AMEN_CRITS) {
    const cur = out[k];
    if (cur && cur.v != null && !cur.level) { cur.level = "building"; cur.src = cur.src + " (a building fact)"; }   // the developer page or the building record
  }
  if (!af || !af.facts) return out;
  for (const k of AMEN_CRITS) {
    const f = af.facts[k], cur = out[k];
    if (!f || typeof f.v !== "boolean" || (cur && cur.v != null)) continue;      // an answer already given stands; the file fills "not known"
    out[k] = { v: f.v, src: amenSrc(f), level: f.level || null, source: f.source_name || null, ...(f.url ? { url: f.url } : {}),
      ...((f.detail || (cur && cur.detail)) ? { detail: [f.detail, cur && cur.detail].filter(Boolean).join(". ") } : {}) };
  }
  return out;
}

// v310 R1 - the homes of a register sub-community (the footprints the district model attributes to its exact Land Department name, with the
// owner's map corrections), as [lon, lat] points: where "within 500 m" is measured from for a villa community with no position of its own
export function subOrigins(anchors, overrides, names) {
  const list = anchors && Array.isArray(anchors.anchors) ? anchors.anchors : null;
  if (!list) return null;
  const m = new Map();
  for (const a of list) { if (!a || !a.cluster || a.i == null) continue; const k = norm(a.cluster); if (!k) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(a.i); }
  const idx = overrides ? applyAnchorOverrides(m, overrides) : m;
  if (!idx) return null;
  const byId = new Map(list.map((a) => [a && a.i, a]));
  for (const n of names || []) {
    const ids = idx.get(norm(n)); if (!ids || !ids.length) continue;
    const pts = ids.map((i) => byId.get(i)).filter((a) => a && isFinite(+a.lon) && isFinite(+a.lat)).map((a) => [+a.lon, +a.lat]);
    if (pts.length) return pts;
  }
  return null;
}
const parksNear = (pos, AM, m) => !pos || !AM || !AM.items ? [] : AM.items.filter((a) => a.k === "park" && a.lon != null)
  .map((a) => ({ n: a.n, acc: a.acc || null, m: Math.round(metres(pos, [a.lon, a.lat])) })).filter((a) => a.m <= m).sort((a, b) => a.m - b.m);
export function criteriaOf({ c, card, brochure, AM, musts, villa, s, af, spots, origins }) {
  const am = ((brochure && brochure.amenities) || []).map(String);
  const has = (rx) => am.find((a) => rx.test(a)) || null;
  const DEV = "the developer's own project page" + (brochure && brochure.source_url ? " (" + brochure.source_url + ")" : "");
  const pos = c.lon != null && c.lat != null ? [c.lon, c.lat] : null;
  const out = {};
  const pp = has(/private\s+pool/i);
  out.private_pool = pp ? { v: true, src: DEV + ": “" + pp + "”" }
    : { v: null, src: "Not known: no register we hold records a private pool (Ejari, the Land Department units register and its property types do not), and no developer page we hold says so for this home." };
  const cp = has(/^(?!.*private).*pool/i);
  out.community_pool = cp ? { v: true, src: DEV + ": “" + cp + "”" }
    : card && card.pools >= 1 ? { v: true, src: "Land Department building record: " + card.pools + " swimming pool" + (card.pools === 1 ? "" : "s") }
    : { v: null, src: "Not known: no building record or developer page we hold lists a pool for it." };
  const pet = has(/\b(pets?|dogs?|pet[- ]friendly)\b/i), play = has(/play|kids|children/i), parks = parksNear(pos, AM, NEAR_M);
  const facts = [];
  if (parks.length) facts.push("park" + (parks.length === 1 ? "" : "s") + " within 1 km on the map's amenity layer (OpenStreetMap): " + parks.slice(0, 3).map((p) => p.n + " " + p.m + " m" + (p.acc ? ", " + p.acc : "")).join("; "));
  else if (pos) facts.push("no park within 1 km on the map's amenity layer (OpenStreetMap; none found is not proof of none)");
  else facts.push("no map position for it, so parks nearby are not counted");
  if (play) facts.push("play area on the developer's page: “" + play + "”");
  out.pets = pet ? { v: true, src: DEV + ": “" + pet + "”", detail: facts.join(". ") }
    : { v: null, src: "Not known: no register we hold records whether a community allows pets. Dog-walking space is shown as a fact, not as a yes.", detail: facts.join(". ") };
  const comp = completionOf(card, brochure) || completionFromFacts(af);        // v310 R3 - the Dubai Municipality year, for villa communities too
  out.modern = comp ? { v: comp.year >= MODERN_FROM, src: "completed " + comp.year + ", " + comp.src }
    : { v: null, src: "Not known: no completion year on file for it." };
  const lt = [];
  if (comp) lt.push("completed " + comp.year);
  if (s && s.n) lt.push((s.nr != null ? s.nr : s.n - (s.nn || 0)) + " of its " + s.n + " recent contracts were renewals (tenants staying on)");
  out.long_term = { v: null, src: "Not scored: no service-charge, maintenance or developer track-record figures are held per building, so no quality score is given.", detail: lt.join("; ") || "" };
  const near = (k, yes, unk) => (musts[k] === true ? { v: true, src: yes } : musts[k] === false ? { v: false, src: k === "metro" ? "RTA station list: the nearest station is over 1 km away in a straight line" : "a source says no" } : { v: null, src: unk });
  out.metro = near("metro", "RTA station list: a station within 1 km in a straight line", "Not known: no map position for it");
  out.schools = near("schools", "a school within 1 km on the map's amenity layer (KHDA register)", "Not known: none found within 1 km on the amenity layer, or no map position (none found is not proof of none)");
  out.gym = near("gym", DEV, "Not known: no developer page we hold lists a gym");
  out.parking = near("parking", "the developer's page or the Land Department building record", "Not known: no record we hold lists parking");
  out.balcony = near("balcony", DEV, "Not known: no record we hold lists balconies for it");
  if (villa) {
    const th = /town\s?-?houses?/i.test([c.name].concat(c.aliases || []).join(" "));
    out.townhouse = th ? { v: true, src: "the Land Department project name says townhouses" } : { v: null, src: "Not known: filed as Villa; the Ejari register does not separate villas from townhouses" };
  }
  applyAmen(out, af);                                                            // v289 - the amenity facts file fills what is left open
  // v310 R1 - a master-community fact is a yes for THIS home only within 500 m of it; further off it is the community's, with the distance
  return applyNearRule(out, { spots, origins: origins || (pos ? [pos] : null), community_name: af && af.community_name });
}
export const FURNISHED_UNKNOWN = "Not known: the Ejari register does not record whether a home is furnished.";
// OWNER ONLY (never on a client key, never in a PDF): what the listing sites' adverts say about furnishing, from the advertised-supply
// rows (img_pf_supply_<district>). Matched by our key, else the DLD project name, exactly. Says so when the data has no such field.
export function furnishedHint(PS, c, bed) {
  if (!PS || !Array.isArray(PS.rows)) return { none: "no advertised-supply data on file for this district" };
  const names = [c.name].concat(c.aliases || []).map(nkey).filter(Boolean);
  const band = bed >= 3 ? "3+" : bed === 0 ? "studio" : String(bed);
  const rows = PS.rows.filter((r) => (r.key && String(r.key).toLowerCase() === String(c.key).toLowerCase()) || (r.dld_project && names.includes(nkey(r.dld_project))));
  if (!rows.length) return { none: "no advertised-supply row matched to this building" };
  const rb = rows.filter((r) => String(r.beds_band == null ? r.beds : r.beds_band) === band);
  const use = rb.length ? rb : rows;
  const f = (r) => { for (const k of FURNISHED_FIELDS) if (r[k] != null && isFinite(+r[k])) return +r[k]; return null; };
  const fs = use.map(f);
  if (fs.every((x) => x == null)) return { none: "the advertised-supply data does not carry furnishing yet", as_of: PS.as_of || null };
  return { furnished: fs.reduce((a, x) => a + (x || 0), 0), of: use.reduce((a, r) => a + (+r.listings_live || 0), 0), as_of: PS.as_of || null,
    label: "Owner only: listing-site adverts marked furnished, of the live adverts. Adverts, not homes free; never shown to a client." };
}

const brochureKeys = (c) => {
  const ks = [];
  if (c.d && c.i != null) ks.push("img_brochure_" + c.d + "_" + c.i);
  for (const n of [c.name].concat(c.aliases || [])) { const s = snake(n); if (s) ks.push("img_brochure_name_" + s); }
  return [...new Set(ks)];
};

function whyOf(c, q) {
  const e = c.evidence, parts = [];
  parts.push(q.mode === "rent" ? e.n + " lettings on the register (" + e.n_new + " new)" : e.n + " " + BED_WORD[Math.min(e.beds, 3)] + " sales on the register" + (e.window_from ? " since " + e.window_from : ""));
  if (e.price_basis) parts.push(e.price_basis);
  parts.push({ within: "typical " + (q.mode === "rent" ? "rent" : "price") + " inside the budget", stretch: "typical figure above the target, inside the stretch", a_little_above: "typical figure a little above the budget",
    above: "typical figure above the budget", below: "typical figure below the budget" }[c.verdict]);
  if (c.completeness.layouts) parts.push("full layout data");
  if (c.completeness.photos) parts.push("developer photos on file");
  if (!c.completeness.record) parts.push("no building page in the app yet");
  // v289 - the must-haves and nice-to-haves met, each with its level and source
  for (const k of (q.musts || []).concat(q.nice || [])) {
    const a = c.crit && c.crit[k];
    if (a && a.v === true) parts.push(CRIT_LABEL[k] + ": yes (" + (a.level ? LEVEL_SAY[a.level] + ", " : "") + "per " + (a.source || (a.level === "building" ? "the building's own record or page" : "the source shown")) + ")");
  }
  return parts.join("; ");
}

// ---- v282: the area comparison (2 or 3 areas, compare=1) --------------------------------------------------------------
// One column per area, each cell {v: true | false | null, say, src}: the typical rent for the brief's home type and bedrooms (the
// rent index's whole-area figures, named projects or not), how many buildings match, the home types let there and the schools
// nearby. A cell is shown only where a source answers; a count of none found is never a "no" (v374: pools, parks and newest completion pulled).
const inBox = (b, lon, lat) => b && lon != null && lat != null && lon >= b[0] && lon <= b[2] && lat >= b[1] && lat <= b[3];
export function compareAreas({ q, RI, kept, cards, AM, DG, DN }) {
  const kinds = kindsOfType(q.type), beds = String(q.beds).split(",").map((b) => BEDS[b]).filter((b) => b != null);
  const W = RI && RI.window ? RI.window[0] + " to " + RI.window[1] : "the latest pull";
  const geo = {}; for (const d of (DG && DG.districts) || []) geo[d.slug] = d;
  const homeSay = (k) => (k === "b" ? "apartment" : "villa or townhouse");
  const bedSay = (b) => (b === 0 ? "studio" : b === 3 ? "3-bed" : b + "-bed");
  return q.areas.map((slug) => {
    const name = DN[slug] || slug, box = (EXTRA_AREAS[slug] && EXTRA_AREAS[slug].bbox) || (geo[slug] && geo[slug].bbox) || null;
    const areaRows = ((RI && RI.areas) || []).filter((a) => searchAreaOf(a) === slug);
    const items = ((RI && RI.items) || []).filter((it) => searchAreaOf(it) === slug);
    const col = { slug, name, dld_areas: areaRows.map((a) => a.area) };
    // typical rent, per home kind and bedroom count asked
    const figs = [];
    for (const k of kinds) for (const b of beds) {
      let best = null;
      for (const a of areaRows) { const rs = rentStat(a, k, b); if (rs && rs.s.n >= EVIDENCE_MIN && (!best || rs.s.n > best.rs.s.n)) best = { rs, a }; }
      if (best) figs.push({ home: homeSay(k), beds: b, median: rentFig(best.rs.s), n: best.rs.s.n, basis: best.rs.basis, dld_area: best.a.area });
      else figs.push({ home: homeSay(k), beds: b, median: null, n: 0 });
    }
    col.rent = { v: figs.some((f) => f.median) ? true : null, figures: figs,
      say: figs.map((f) => (f.median ? bedSay(f.beds) + " " + f.home + ": AED " + Math.round(f.median).toLocaleString("en-US") + " (" + f.n + " contracts)" : bedSay(f.beds) + " " + f.home + ": not known (under " + EVIDENCE_MIN + " contracts)")).join("; "),
      src: "Ejari rent contracts " + W + ", the whole Land Department area" + (areaRows.length ? " (" + areaRows.map((a) => a.area).join(", ") + ")" : "") + "; villas by the register's own bedroom count where it gives one" };
    if (!areaRows.length) col.rent = { v: null, figures: [], say: "not known: no Ejari contracts for this area in the rent index", src: "the rent index (" + W + ")" };
    // matches in budget / stretch
    const mine = kept.filter((c) => (c.sa || c.d) === slug && !c.areaFigure);
    const nIn = mine.filter((c) => c.verdict === "within").length, nSt = mine.filter((c) => c.verdict === "stretch").length;
    col.matches = { v: mine.length ? (nIn + nSt > 0 ? true : null) : false, within: nIn, stretch: nSt, total: mine.length,
      say: mine.length ? nIn + " in budget" + (q.stretch ? ", " + nSt + " in the stretch" : "") + " (" + mine.length + " listed in all)" : "none: no building here has " + EVIDENCE_MIN + "+ lettings of this type and size in the window", src: "this brief's list: buildings with " + EVIDENCE_MIN + "+ contracts of the type asked" };
    // home types let there
    const hasB = items.some((it) => it.b && Object.values(it.b).some((s) => s.n > 0)) || areaRows.some((a) => a.b && Object.keys(a.b).length);
    const hasV = items.some((it) => it.v && Object.values(it.v).some((s) => s.n > 0)) || areaRows.some((a) => a.v && Object.keys(a.v).length);
    const th = items.filter((it) => it.v && /town\s?-?houses?/i.test([it.n].concat(it.a || []).join(" "))).map((it) => it.n);
    col.types = {
      apartment: hasB ? { v: true, say: "apartments let here", src: "Ejari contracts " + W } : { v: null, say: "not known: no apartment lettings in the window", src: "Ejari contracts " + W },
      villa: hasV ? { v: true, say: "villas or townhouses let here", src: "Ejari contracts " + W } : { v: null, say: "not known: no villa or townhouse lettings in the window", src: "Ejari contracts " + W },
      townhouse: th.length ? { v: true, say: th.length + " project" + (th.length === 1 ? "" : "s") + " named as townhouses (" + th.slice(0, 2).join(", ") + ")", src: "Land Department project names" }
        : { v: null, say: "not known: the register files townhouses as villas", src: "Ejari contracts " + W },
    };
    // v374: pools, parks and dog-friendly spaces, and the newest completion are no longer compared (no register says them; no picture is shown). Schools stay.
    const inArea = (a) => a.d === slug || inBox(box, a.lon, a.lat);
    const schools = ((AM && AM.items) || []).filter((a) => a.k === "school" && inArea(a));
    col.schools = schools.length ? { v: true, n: schools.length, say: schools.length + " school" + (schools.length === 1 ? "" : "s") + ": " + schools.slice(0, 2).map((s) => s.n + (ratingOf(s.x) ? " (" + ratingOf(s.x) + ")" : "")).join(", "), src: "KHDA private schools register and the government schools map, on the amenity layer" }
      : { v: null, n: 0, say: "not known: none on the amenity layer here", src: "KHDA register on the amenity layer" };
    return col;
  });
}

const ctEq = (a, b) => { a = String(a); b = String(b); if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
// the OWNER key (READ_KEY) - the same test as index.js keyTier() === "admin"; a client key never passes it
export const isOwnerKey = (env, url, h) => (h && typeof h.keyTier === "function") ? h.keyTier(env, url) === "admin"
  : !!(env && env.READ_KEY && url.searchParams.get("key") && ctEq(url.searchParams.get("key"), env.READ_KEY));

// ---- v309 - plain-language summary and empty-state reasons (Kendall, 4 Oct 2026: nothing internal on the page; say why nothing matched) ----------------
const plainAed = (n) => "AED " + (n >= 1e6 ? +(n / 1e6).toFixed(2) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "k" : Math.round(n));
const plural = (n, one, many) => n + " " + (n === 1 ? one : many);
export function plainOf({ q, as_of, hiddenBelow, thin, droppedByMust, noData, DN, shown, comparison, market }) {
  const buy = q.mode === "buy", rec = buy ? "sales" : "lettings";
  const areaWord = q.areas.length ? q.areas.map((a) => DN[a] || a).join(" and ") : "Dubai";
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], dm = /^(\d{4})-(\d\d)-(\d\d)/.exec(String(as_of || ""));
  const day = dm ? " Evidence to " + (+dm[3]) + " " + MON[+dm[2] - 1] + " " + dm[1] + "." : "";
  const summary = [(buy ? "What homes here actually sold for, from the Land Department's registered sales." : "What homes here actually let for, from registered tenancy contracts (Ejari, Dubai's rent register).") + " This is not a list of homes on the market." + day];
  const left = [];
  if (hiddenBelow) left.push(plural(hiddenBelow, "building was", "buildings were") + " below your " + plainAed(q.min) + " minimum and " + (hiddenBelow === 1 ? "is" : "are") + " not shown.");
  if (thin) left.push(plural(thin, "building was", "buildings were") + " left out: fewer than three registered " + rec + " of this size.");
  if (droppedByMust) left.push(plural(droppedByMust, "building was", "buildings were") + " left out because a must-have is known to be missing.");
  if (shown) summary.push(...left);
  let empty = null;
  if (!shown && !comparison) {
    const reasons = [];
    const nd = noData.map((a) => DN[a] || a).join(" and ");
    if (noData.length) reasons.push(buy && noData.some((a) => EXTRA_AREAS[a]) ? "Sales for " + nd + " are not loaded into the Brief yet, so it cannot say what homes there sold for. That is a gap in the tool, not a sign that nothing sold." : "We do not have registered " + rec + " for " + nd + " yet.");
    for (const m of (market || [])) if (q.min && m.m && m.m * 1.5 < q.min) reasons.push((m.bed === 0 ? "Studios" : m.bed + "-bedroom homes") + " in " + (DN[m.slug] || m.slug) + " " + (buy ? "sell" : "let") + " for about " + plainAed(Math.round(m.m / 1000) * 1000) + " a year typically" + (m.q1 && m.q3 ? " (middle half " + plainAed(Math.round(m.q1 / 1000) * 1000) + " to " + plainAed(Math.round(m.q3 / 1000) * 1000) + ")" : "") + ", well below your " + plainAed(q.min) + " minimum.");
    reasons.push(...left);
    if (!reasons.length) reasons.push("No building in " + areaWord + " has registered " + rec + " of this size and type with a typical price inside your budget.");
    const next = noData.length ? (buy && noData.some((a) => EXTRA_AREAS[a]) ? "Choose another area for now, or check this one with your sales team." : "Choose another area, or ask the " + (buy ? "sales" : "leasing") + " team for the latest on " + (noData.length === 1 ? "this one" : "these") + ".")
      : hiddenBelow ? "Lower your minimum to see them."
      : thin ? "Try a nearby area, or another bedroom count."
      : droppedByMust ? "Untick a must-have to see more."
      : "Widen the budget, or try a nearby area.";
    empty = { title: "No " + (buy ? "homes to buy" : "homes to rent") + " in " + areaWord + " matched.", reasons, next };
  }
  return { summary, empty };
}

// ---- the route ------------------------------------------------------------------------------------------------------
export async function briefApi(request, env, url, h) {
  const hdr = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
  if (request.method !== "GET") return new Response("method", { status: 405 });   // before the key: a client key on a POST gets exactly what no key gets (v156)
  if (!h || typeof h.clientOk !== "function" || !h.clientOk(env, url)) return new Response("unauthorized", { status: 401 });
  const out = await briefSearch(env, url.searchParams, { owner: isOwnerKey(env, url, h) });
  return new Response(JSON.stringify(out.body), { status: out.status, headers: hdr });
}
// v282 - the search itself, shared by GET /brief_api and the PDFs (src/brief_docs.js reads the comparison from it, with owner: false,
// so a document can never carry an owner-only field). Returns {status, body}.
export async function briefSearch(env, sp, opts) {
  const J = (o, st) => ({ body: o, status: st || 200 });
  const { errs, q, beds } = parseBrief(sp);
  if (errs.length) return J({ error: errs }, 400);
  const owner = !!(opts && opts.owner);
  const notes = [];

  // v292 - every file is read once per search (rd: a per-search promise map over the per-isolate memo), and the reads that do not
  // depend on each other start together: wave 1 here (districts, the rent index or Buy data, the amenity layer, the developer sheets,
  // the brochure list), wave 2 as soon as the candidates' districts are known (unit-mix cards, amenity facts, beds-left register or
  // tenancy file, the Google district files when Google will be asked), then the brochures of the candidates kept.
  const local = new Map();
  const rd = (n) => { let p = local.get(n); if (!p) { p = kvJsonMemo(env, n); local.set(n, p); } return p; };
  const read = (e, n) => rd(n);
  const asked = [...new Set(q.musts.concat(q.nice))];
  const liveWanted = !(opts && opts.live === false) && !!(env && env.GOOGLE_MAPS_KEY) && asked.some((k) => LIVE_CRITS[k]);
  const pDG = rd("districts_geo"), pMain = rd(q.mode === "rent" ? "rent_index" : "map_prices"), pAM = rd("amenities");
  const pBX = q.mode === "buy" ? rd("buy_extra") : null;                     // v314 - the Brief-only Buy items
  const pAV = loadDevAvail(env, read), pHave = env && env.MEETINGS ? kvKeysMemo(env, "img_brochure_", 5) : kvKeys(env, "img_brochure_", 5);
  const pBRK = {};                                                            // v291 CHECKLIST - the broker's on-site facts, read fresh (the owner edits them) but started in wave 2
  const warm = (ds, anch) => {                                                // start wave 2; the awaits below pick the same promises up
    for (const d of new Set(ds.filter(Boolean))) {
      if (!pBRK[d]) pBRK[d] = kvJson(env, "broker_facts_" + d);
      rd("amenities_" + d);
      rd("amenity_spots_" + d);                                               // v310 R1 - the places with coordinates, for "within 500 m"
      if (anch && anch.has(d) && !liveWanted) { rd("anchors_" + d); rd("anchor_overrides_" + d); }   // and the homes of a villa community, where it has no position of its own (live Google reads anchors anyway)
      if (q.mode === "rent" && !EXTRA_AREAS[d]) rd("beds_left_" + d).then((bl) => (bl ? null : rd("tenancy_" + d)));
      if (liveWanted) { rd("amenity_counts_" + d); rd("anchors_" + d); }
    }
  };
  const DG = await pDG;
  const DN = {}; for (const d of (DG && DG.districts) || []) DN[d.slug] = d.name;
  for (const [s, x] of Object.entries(EXTRA_AREAS)) if (!DN[s]) DN[s] = x.name;
  if (q.mode === "rent") {                                                    // v314 - a Land Department area the index holds by name (no district) is named from its own record
    const R0 = await pMain;
    if (R0 && Array.isArray(R0.items)) for (const a of q.areas) if (!DN[a]) { const hit = R0.items.find((it) => searchAreaOf(it) === a) || (R0.areas || []).find((r) => searchAreaOf(r) === a); if (hit && hit.area) DN[a] = titleArea(hit.area); }
  }
  const unknownAreas = DG ? q.areas.filter((a) => !DN[a]) : [];
  if (unknownAreas.length) notes.push("not a district slug the app knows: " + unknownAreas.join(", "));
  if (q.areas.some((a) => EXTRA_AREAS[a])) notes.push("Arabian Ranches is not one of the app's districts: it is read from the rent register by its Land Department areas, which are not the marketing communities. Wadi Al Safa 6 holds Arabian Ranches villages (Alvorada, Aseel, Alma); Wadi Al Safa 7 holds Arabian Ranches 2 (Reem, Camelia), more Arabian Ranches villages (Palma, Rasha, Samara, Azalea, Casa ...), Serena, Rukan and The Sustainable City. Its homes have no building pages, map positions or building records in the app yet.");

  let hiddenBelow = 0;
  const diag = { thin: 0, noCount: 0, noCard: 0, noData: [], market: [] };                 // v309 - the counts the plain-language reasons are made from
  let cands = [], as_of = null, source = null, extra = {}, RI = null;
  const cards = {};
  const loadCards = async (ds) => {
    const byCount = {}; for (const d of ds) if (d) byCount[d] = (byCount[d] || 0) + 1;
    const want = Object.keys(byCount).sort((a, b) => byCount[b] - byCount[a]);
    if (want.length > MAX_DISTRICT_CARDS) notes.push("read the unit-mix records of the " + MAX_DISTRICT_CARDS + " districts with most matches only (" + want.length + " matched); name the districts to see every one");
    await Promise.all(want.slice(0, MAX_DISTRICT_CARDS).map(async (d) => { if (cards[d] !== undefined) return; const u = await rd("unitmix_" + d); cards[d] = (u && u.buildings_by_id) || null; }));
  };

  if (q.mode === "rent") {
    RI = await pMain;
    if (!RI || !Array.isArray(RI.items)) return J({ query: q, error: [owner ? "the rent index (KV img_rent_index) is not on file" : "Rent figures are not available right now. Please try again shortly."] }, 503);
    as_of = RI.as_of || null; source = "KV img_rent_index (" + (RI.source_file || "Ejari rent contracts") + ")";
    extra.window = RI.window || null;
    const r = rentCandidates(RI, q, beds); cands = r.cands; hiddenBelow = r.hidden; diag.thin = r.thin; diag.noData = q.areas.filter((a) => !RI.items.some((it) => searchAreaOf(it) === a) && !(RI.areas || []).some((r) => searchAreaOf(r) === a));
    if (q.min && beds.length === 1) for (const a of q.areas) { const rows = (RI.areas || []).filter((x) => searchAreaOf(x) === a); let best = null; for (const k of kindsOfType(q.type)) for (const row of rows) { const rs = rentStat(row, k, beds[0]); if (rs && rs.s.n >= EVIDENCE_MIN && (!best || rs.s.n > best.s.n)) best = rs; } if (best) { const f = rentFigure(best.s); diag.market.push({ slug: a, bed: beds[0], m: f.m, q1: f.q1, q3: f.q3 }); } }
    warm(cands.map((c) => c.d), new Set(cands.filter((c) => c.lon == null).map((c) => c.d)));
    await loadCards(cands.filter((c) => c.i != null).map((c) => c.d));
    const un = unbindDisputed(cands, cards);
    if (un) notes.push(un + " rent record" + (un === 1 ? " is" : "s are") + " bound in the index to an app building named otherwise, or to one already listed: shown by the register name only, with no building page (the name must agree with the record). See disputed_bind.");
    notes.push("Registered Ejari rent contracts" + (RI.window ? ", " + RI.window[0] + " to " + RI.window[1] : "") + ": what homes in these buildings actually let for, NOT live availability. Availability is confirmed with the leasing team.");
    notes.push("Bedrooms are read from each home's size - Ejari rarely records them" + (RI.bands && RI.bands.flat_accuracy_area ? " (right about " + Math.round(RI.bands.flat_accuracy_area * 100) + "% of the time on contracts that do carry the type)" : "") + ".");
    if (kindsOfType(q.type).includes("v")) notes.push("Villas and townhouses: the register files both as Villa (it has no townhouse type). Their figure uses the register's own bedroom count where it gives 3 or more contracts (evidence.beds_basis = registered); otherwise the bedrooms are read from the size, and a 3 then means 3 or more.");
    notes.push("The typical rent is the median of new lettings where there are 3 or more, otherwise of all contracts - the same figure the map's Rent mode shows. The middle half (q1-q3) is on the same basis.");
    notes.push("A contract filed under several building names is counted once; the other names are listed as aliases (also filed as).");
    if (r.thin) notes.push(r.thin + " building" + (r.thin === 1 ? "" : "s") + " with fewer than " + EVIDENCE_MIN + " contracts of this size left out.");
  } else {
    const MP0 = await pMain;
    if (!MP0 || !Array.isArray(MP0.items)) return J({ query: q, error: [owner ? "the Buy data (KV img_map_prices) is not on file" : "Sales figures are not available right now. Please try again shortly."] }, 503);
    const BX = await pBX;                                                       // v314 - Brief-only items; a map item with the same district and id wins
    const have = new Set(MP0.items.map((m) => m.d + ":" + m.i));
    const xs = BX && Array.isArray(BX.items) ? BX.items.filter((x) => x && x.d && x.i != null && !have.has(x.d + ":" + x.i)) : [];
    const MP = xs.length ? { ...MP0, items: MP0.items.concat(xs) } : MP0;
    const pre = buyPrelim(MP, q, beds);
    warm(pre.map((p) => p.it.d));
    await loadCards(pre.map((p) => p.it.d));
    const r = buyCandidates(pre, cards, q); cands = r.cands; hiddenBelow = r.hidden; diag.thin = r.thin; diag.noCount = r.noCount; diag.noCard = r.noCard; diag.noData = q.areas.filter((a) => !MP.items.some((it) => it.d === a && it.i != null && it.i >= 0));
    if (q.areas.some((a) => EXTRA_AREAS[a] && diag.noData.includes(a))) notes.push("Arabian Ranches buy: the Land Department does register villa and townhouse sales in Wadi Al Safa 5, 6 and 7, but the Brief holds no unit-mix cards for them (they are not among its districts), so it cannot answer. Caveats for when they are added: the register leaves bedrooms blank for Casa, Lila, Palma, Rasha, Samara, Azalea, Rosa, Yasmin, Alvorada, Aseel and La Avenida; about 10,000 older Arabian Ranches 1 sales carry no project name; a villa's area in the register is its plot size, so a price per sq ft there is per sq ft of plot.");
    if (cands.some((c) => c.syn)) notes.push(cands.filter((c) => c.syn).length + " project" + (cands.filter((c) => c.syn).length === 1 ? "" : "s") + " built from the Land Department sales register (img_buy_extra, cards under ids 900000+ in img_unitmix_<district>): counts and medians per bedroom type from the register's own bedroom count, sales since the window date shown, villas by plot size (no price per sq ft), off-plan prices are contract values. These have no building page, building outline or map position, so distances and must-haves from the map are not known for them.");
    as_of = String(MP.generated || "").slice(0, 10) || null; source = "KV img_map_prices (what the map's Buy mode shows) + img_unitmix_<district> (per-bedroom sale medians and counts)";
    notes.push("Buy figures are DLD registered sale medians per bedroom count over the building's whole sales record (the dates shown are the first and last sale of any type) - what homes here sold for, NOT what is for sale now.");
    notes.push("The Buy data has no middle half (q1, q3) and no new-versus-resale split: those fields are null. A developer's asking price and a size-based estimate are never used.");
    if (r.noCount) notes.push(r.noCount + " priced bedroom figure" + (r.noCount === 1 ? "" : "s") + " left out: the record carries no sale count for that bedroom type, so the evidence cannot be weighed.");
    if (r.thin) notes.push(r.thin + " left out with fewer than " + EVIDENCE_MIN + " sales of this bedroom type.");
    if (r.noCard) notes.push(r.noCard + " priced building" + (r.noCard === 1 ? "" : "s") + " left out: no unit-mix record read for it.");
  }

  // photos: which developer brochures exist (one listing), then read the few that do, for amenities
  const have = await pHave;
  await Promise.all(cands.map(async (c) => {
    const k = brochureKeys(c).find((x) => have.has(x));
    c.brochureKey = k || null;
    c.brochure = k ? await rd(k.slice(4)) : null;
  }));
  const AM = await pAM;
  const AMF = {};                                                              // v289 - the amenity facts per district (img_amenities_<district>)
  await Promise.all([...new Set(cands.map((c) => c.d).filter(Boolean))].map(async (d) => { AMF[d] = amenIndex(await rd("amenities_" + d)); }));
  const SPT = {}, ANC = {}, OVR = {};                                          // v310 R1 - the places with coordinates, and each sub-community's homes, for "within 500 m"
  await Promise.all([...new Set(cands.map((c) => c.d).filter(Boolean))].filter((d) => AMF[d]).map(async (d) => {
    const sp = await rd("amenity_spots_" + d); SPT[d] = sp && Array.isArray(sp.spots) ? sp.spots.filter((x) => x && !/bayut|propertyfinder|dubizzle/i.test(String(x.source_url || "") + " " + String(x.source || ""))) : null;   // a listing portal is never a source of a place
    if (cands.some((c) => c.d === d && c.lon == null)) { ANC[d] = await rd("anchors_" + d); OVR[d] = await rd("anchor_overrides_" + d); }
  }));
  const BRK = {};                                                              // v291 CHECKLIST - the broker's on-site facts (img_broker_facts_<district>); read fresh, not memoised: the owner edits them
  await Promise.all([...new Set(cands.map((c) => c.d).filter(Boolean))].map(async (d) => { BRK[d] = await (pBRK[d] || (pBRK[d] = kvJson(env, "broker_facts_" + d))); }));
  const AV = await pAV;                                                       // v277 - the developers' own sheets, where we hold them
  const tenancy = {};
  const bedsLeft = {};
  if (q.mode === "rent") await Promise.all([...new Set(cands.filter((c) => c.d && !EXTRA_AREAS[c.d]).map((c) => c.d))].map(async (d) => {
    bedsLeft[d] = await rd("beds_left_" + d);
    if (!bedsLeft[d]) tenancy[d] = await rd("tenancy_" + d);                       // the old gated path only where the register is missing
  }));

  let droppedByMust = 0;
  const kept = [];
  for (const c of cands) {
    const card = c.card || (c.d && c.i != null && cards[c.d] ? cards[c.d][String(c.i)] : null);
    const origins = c.lon != null && c.lat != null ? [[c.lon, c.lat]] : (ANC[c.d] ? subOrigins(ANC[c.d], OVR[c.d], [c.name].concat(c.aliases || [])) : null);
    // v310 - a villa community with mapped homes is placed at the middle of them for the straight-line answers (metro, schools): the RTA list is the whole network, so "no" is a real answer
    const cm = c.lon == null && origins && origins.length ? { ...c, lon: origins.reduce((t, p) => t + p[0], 0) / origins.length, lat: origins.reduce((t, p) => t + p[1], 0) / origins.length } : c;
    const mm = mustsOf(cm, card, c.brochure, AM);
    c.musts = mm.musts; c.nearest = mm.nearest;
    const st = q.mode === "rent" ? (rentStat(c.it, c.evidence.home === "villa" ? "v" : "b", c.bed) || {}).s : null;
    c.crit = criteriaOf({ c, card, brochure: c.brochure, AM, musts: c.musts, villa: c.evidence.home === "villa", s: st, af: amenFor(AMF[c.d], c), spots: SPT[c.d], origins });
    applyBrokerFacts(c.crit, brokerFor(BRK[c.d], [c.name, c.it && c.it.n].concat(c.aliases || [])));   // v291 CHECKLIST - fills only what is still not known
    c.comp = completionOf(card, c.brochure);
    if (q.musts.some((m) => c.crit[m] && c.crit[m].v === false)) { droppedByMust++; continue; }   // ONLY a definite no leaves it out
    c.completeness = {
      record: c.i != null && !!c.d && !c.syn,
      layouts: !!(card && (card.rows || []).some((r) => r.basis === "DLD units register" && /bedroom|studio/i.test(String(r.type || "")))),
      photos: !!(c.brochure && (c.brochure.photos || []).length),
    };
    c.recordName = card ? card.name : null;
    if (q.mode === "rent") {
      c.est = estimateLeft({ BL: c.d ? bedsLeft[c.d] : null, card, ten: c.d ? tenancy[c.d] : null, c, bed: c.bed });
    }
    c.avail = devAvailFor(AV, c, c.bed);                                       // v277 - null where no developer sheet names this building
    kept.push(c);
  }
  if (droppedByMust) notes.push(droppedByMust + " building" + (droppedByMust === 1 ? "" : "s") + " left out because a source says a must-have is missing.");
  if (q.musts.length || q.nice.length) notes.push("Must-haves and nice-to-haves: each is answered yes, no or not known, with its source. A building is left out only where a source says no; not known never leaves a building out. Nice-to-haves only change the order. " +
    "Metro: straight-line to the nearest RTA station, within 1 km. Schools and parks: the app's amenity layer within 1 km (none found is not proof of none). " +
    "Gym and parking: the developer's own project page or the Land Department building record. Balcony: the units register or the developer's page.");
  const amenDs = Object.keys(AMF).filter((d) => AMF[d]);
  if (amenDs.length && (q.musts.length || q.nice.length)) notes.push("Gym, parking and balconies are also answered from the amenity facts file for " + amenDs.map((d) => DN[d] || d).join(", ") +
    " (KV img_amenities_<district>): the Land Department buildings and units registers, the developer's own pages, owners' association budgets and OpenStreetMap. Each answer names its source and says whether it is a building fact (this building's own record or page) or a community fact (the master community's, which every home in it shares). Not known means no source we hold says.");

  // v291 - LIVE GOOGLE (src/live_answers.js): where registers, broker facts and the amenity file all leave gym, community pool or pets
  // not known, Google Places is asked now - first the community (one call per district per criterion), so the ranking counts it; then,
  // below, each shown home's own sub-community. Never a no, never stored; any miss stays not known.
  const LV = liveCtx(opts && opts.live === false ? null : env, { ...(opts || {}), read });   // live: false (the PDFs' area comparison) asks nothing
  const liveItem = (c) => ({ crit: c.crit, d: c.d, dn: DN[c.d], name: c.name, aliases: c.aliases, i: c.i, is: c.it && c.it.is, lat: c.lat, lon: c.lon, noSub: !!c.disputed });
  await fillLive(LV, kept.filter((c) => !c.areaFigure).map(liveItem), asked, { cluster: false });
  const score = (c) => (c.completeness.record ? 1 : 0) + (c.completeness.layouts ? 1 : 0) + (c.completeness.photos ? 1 : 0);
  const mid = q.max != null ? ((q.min || 0) + q.max) / 2 : (q.min || 0);
  const met = (c, ks) => ks.filter((m) => c.crit[m] && c.crit[m].v === true).length;
  kept.sort((a, b) => (rankTier(a) - rankTier(b)) || (met(b, q.musts) - met(a, q.musts)) || (met(b, q.nice) - met(a, q.nice)) || (b.n - a.n) || (score(b) - score(a)) || (Math.abs(a.v - mid) - Math.abs(b.v - mid)) || String(a.name).localeCompare(String(b.name)));

  // v314 - the area figure: an area asked for with no building to list gets its own (labelled) figure, after every building row
  let areaFigs = 0;
  if (q.mode === "rent" && q.areas.length && !(opts && opts.areaFigure === false)) {   // opts.areaFigure === false: the coverage replay's "before the area figure" run
    const covered = new Set(kept.map((c) => c.sa || c.d).filter(Boolean));
    const nullCrit = () => { const o = {}; for (const k of CRIT_KEYS) o[k] = { v: null, src: "This is the area's figure, not a building, so there is nothing to check this against." }; return o; };
    for (const c of areaFigureCands(RI, q, beds, covered, DN)) {
      c.musts = { balcony: null, metro: null, pool: null, gym: null, parking: null, new: null, schools: null }; c.nearest = null; c.crit = nullCrit();
      c.completeness = { record: null, layouts: null, photos: null }; c.est = null; c.avail = null; c.comp = null; c.recordName = null;
      kept.push(c); areaFigs++;
    }
    if (areaFigs) notes.push(areaFigs + " area" + (areaFigs === 1 ? "" : "s") + " shown as an area figure (evidence.basis = ejari_area): no building there has " + EVIDENCE_MIN + " lettings of this home type and size in the rent window, but the Land Department area has " + AREA_FIGURE_MIN + " or more. The row is named for the whole area, carries the area's own contract count, has no building page or map position, and is never a building's figure.");
  }
  const counts = { within: 0, stretch: 0, a_little_above: 0, above: 0, below: 0 };
  for (const c of kept) counts[c.verdict]++;
  const seenKeys = new Set();
  for (const c of kept) {
    c.key = String(c.key).toLowerCase().replace(/[^a-z0-9_:-]/g, "");         // the /brief page joins keys with commas (keys=, pick=): [a-z0-9_:-] only
    if (seenKeys.has(c.key)) c.key += "-" + norm(c.dldArea || c.d || "x"); seenKeys.add(c.key); }   // one DLD name in two areas
  const PS = {};
  // in a comparison each area gets its own top `limit`; otherwise one list
  const chosen = q.compare ? q.areas.flatMap((a) => kept.filter((c) => (c.sa || c.d) === a).slice(0, q.limit)) : kept.slice(0, q.limit);
  // v291 - the shown homes, each by its own sub-community; v292 - the owner's advertised-supply files are read at the same time
  await Promise.all([fillLive(LV, chosen.filter((c) => !c.areaFigure).map(liveItem), asked, { cluster: true }),
    null]);                                                                     // v374: the owner's advertised-supply (furnished) read is gone with the furnished question
  if (LV.used) notes.push("Gym, community pool and dog park: where no register, broker fact or amenity file answers, Google Maps was asked live when this list was made (Places, not kept): a gym, a community or residence pool, or a dog park inside the home's own sub-community (its mapped homes, plus 150 m) answers yes as a cluster fact; else one inside the community's boundary answers yes as a community fact, with how far it is. Google finding none is never a no: it stays not known.");
  const rankIn = {};
  const results = chosen.map((c) => {
    const g = q.compare ? c.d : "_"; rankIn[g] = (rankIn[g] || 0) + 1;
    const r = {
      rank: rankIn[g], key: c.key, name: c.name, aliases: c.aliases, district: c.d, district_name: c.d ? (DN[c.d] || c.d) : null,
      dld_area: c.dldArea || null, app_id: c.syn ? null : c.i, building_url: !c.syn && c.i != null && c.d && !EXTRA_AREAS[c.d] ? "/building/" + c.d + "/" + c.i : null,
      evidence: c.evidence, verdict: c.verdict, musts: c.musts, nearest_metro: c.nearest, completeness: c.completeness,
      why: c.why || whyOf(c, q),
    };
    if (c.areaFigure) r.area_figure = true;                                    // v314 - the row is the whole area's figure, not a building's
    // v282 - the client's own criteria, each with its answer and source (musts, then nice-to-haves, then home type and furnishing)
    const crit = q.musts.map((k) => ({ k, label: CRIT_LABEL[k], level: "must", ...c.crit[k] })).concat(q.nice.map((k) => ({ k, label: CRIT_LABEL[k], level: "nice", ...c.crit[k] })));
    if (c.crit.townhouse && String(q.type).includes("townhouse")) crit.push({ k: "townhouse", label: "townhouse", level: "asked", ...c.crit.townhouse });
    r.criteria = crit;
    if (c.recordName && c.i != null) r.record_name = { name: c.recordName, agrees: c.agree || nameAgrees([c.name].concat(c.aliases), c.recordName) };
    if (c.disputed) r.disputed_bind = c.disputed;
    if (c.brochureKey) r.brochure = "/img/" + c.brochureKey.slice(4);
    if (q.mode === "rent" && c.est) {                                          // present only when known; otherwise the reason, never a guess
      const e = c.est;
      if (e.withheld) r.estimated_left_withheld = e.withheld; else { r.estimated_left = e; r.estimate_as_of = e.as_at; }
    }
    if (c.avail) r.developer_availability = c.avail;                           // v277 - the developer's own sheet; the ONLY availability the screen shows
    return r;
  });
  if (results.some((r) => r.developer_availability)) notes.push("developer_availability is what the developer's own availability sheet, posted to the broker group, lists for this building on the sheet's date (count of this bedroom type, and the unit rows where the sheet holds them). It is the developer's claim, not register data, and it is never combined with estimated_left.");
  if (q.mode === "rent") notes.push("estimated_left is T minus R (flats of this type in the Land Department units list, less Ejari tenancies of this type running on the tenancy file's date), rounded to 10 and shown as {about, of} with estimate_as_of: an estimate, not a count, and never the number available. It is read from the beds-left register (KV img_beds_left_<district>, the full government tenancy register) where that is on file; otherwise it is given only where both are scoped to the one building and the district's tenancy coverage reaches " + Math.round(TENANCY_MIN_SHARE * 100) + "%, the gate the building page uses; otherwise it is omitted and estimated_left_withheld says why.");
  if (results.some((r) => r.record_name && r.record_name.agrees === "part")) notes.push("record_name.agrees = \"part\": the app's building record carries the register name plus a tower or phase suffix (e.g. Bloom Towers -> Bloom Towers B). The evidence may cover the whole project; check before the record's name goes on a client document.");
  notes.push("Ranking: within the budget first (typical figure at or above the minimum and at or below the target)" + (q.stretch ? ", then within the stretch (above the target, at or below AED " + q.stretch + ")" : "") + ", then a little above (up to " + Math.round(LITTLE_OVER * 100) + "% over the top of the budget), then above (listed up to " + Math.round(ABOVE_CAP * 100) + "% over); inside each group, the must-haves met, then the nice-to-haves met, then most evidence, then the most complete record. Fewer than " + EVIDENCE_MIN + " contracts or sales: left out.");
  if (q.min) notes.push("Budget minimum is a hard floor: only homes at AED " + q.min + " or more are offered. " + hiddenBelow + " option" + (hiddenBelow === 1 ? "" : "s") + " under the minimum hidden.");

  let comparison;
  if (q.compare && q.mode === "rent") {
    await loadCards(q.areas.filter((a) => !EXTRA_AREAS[a]));
    comparison = compareAreas({ q, RI, kept, cards, AM, DG, DN });
    notes.push("comparison: one column per area. Each cell is answered (v true) or not known (v null), with its source; a count of none found is never a no. Typical rents are the whole Land Department area's, named projects or not.");
  }
  // v309 - what a person sees: a short plain summary and, when nothing matched, the reasons and one next step. The technical notes and the
  // internal source name are OWNER ONLY (the page shows them under "Details for the team"); a client key never receives them.
  const plain = plainOf({ q, as_of, hiddenBelow, thin: diag.thin + diag.noCount + diag.noCard, droppedByMust, noData: diag.noData, DN, shown: kept.length, comparison: !!comparison, market: diag.market });
  return J({ query: q, as_of, source: owner ? source : null, ...extra, total_matched: kept.length, counts, ...(comparison ? { comparison } : {}), results, summary: plain.summary, ...(plain.empty ? { empty: plain.empty } : {}), notes: owner ? notes : [] });
}
