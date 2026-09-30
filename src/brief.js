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
//   musts  img_amenities (metro stations, schools), img_unitmix_<district> (pools, car parks), img_brochure_* (developer amenities).
//          null = we do not know. A must is false only where a source says so.
//   T, R   img_unitmix_<district> (flats of the bedroom count in the DLD units register) and img_tenancy_<district> (Ejari tenancies
//          running on its as_at date). Only under the gates building_page.js already applies - see estLeft().
//
// Everything is in this file; src/index.js carries one import and one marked dispatch.

export const BRIEF_MUSTS = ["balcony", "metro", "pool", "gym", "parking", "new", "schools"];
const BEDS = { studio: 0, "0": 0, "1": 1, "2": 2, "3": 3, "3+": 3 };
const BED_WORD = ["studio", "1-bed", "2-bed", "3+ bed"];
export const EVIDENCE_MIN = 3;          // spec: drop n < 3
export const WITHIN_OVER = 0.03;        // spec: within = median >= min and <= max * 1.03
const LITTLE_OVER = 0.10;               // a_little_above: up to max * 1.10; above: up to max * 1.15; beyond that it is not offered
const ABOVE_CAP = 0.15;
const BELOW_FLOOR = 0.10;               // below: down to min * 0.90; cheaper than that is not offered
const NEAR_M = 1000;                    // "near a metro" / "schools nearby": a straight-line kilometre (no walking or drive times)
export const TENANCY_MIN_SHARE = 0.5;   // the building page's own gate (building_page.js): below half coverage the tenancy count is not shown
const MAX_DISTRICT_CARDS = 12;          // unit-mix cards are ~1 MB each; an all-Dubai query reads the busiest districts' cards only
const TIER = { within: 0, a_little_above: 1, below: 2, above: 3 };
// the ranking order: strictly inside the budget first, then the +3% tolerance that still counts as "within", then the rest
const rankTier = (c, q) => (c.verdict === "within" ? (q.max == null || c.v <= q.max ? 0 : 1) : 1 + TIER[c.verdict]);

// the rent index's own name key (build_rent_index.py fold/norm/stem/nkey), so "the same name" means the same thing here
const fold = (s) => String(s == null ? "" : s).normalize("NFKD").replace(/[^\x00-\x7f]/g, "");
const norm = (s) => fold(s).toLowerCase().replace(/[^a-z0-9]/g, "");
const stem = (s) => fold(s).toLowerCase().replace(/\b(by|the|tower|towers|residences?|residence|building|bldg|apartments?)\b/g, "");
export const nkey = (s) => norm(stem(s));
const snake = (s) => fold(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

async function kvJson(env, name) {                // an img_* value: plain JSON, or gzipped JSON (the /img route passes 1f 8b through)
  let v = null;
  try { v = await env.MEETINGS.get("img_" + name, "arrayBuffer"); } catch (e) { return null; }
  if (v == null) return null;
  try {
    if (typeof v === "string") return JSON.parse(v);
    let u8 = new Uint8Array(v);
    if (u8.length > 2 && u8[0] === 0x1f && u8[1] === 0x8b) u8 = new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
    return JSON.parse(new TextDecoder().decode(u8));
  } catch (e) { return null; }
}

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
  const bedsRaw = String(sp.get("beds") || "1").toLowerCase();
  const beds = BEDS[bedsRaw];
  if (beds == null) errs.push("beds must be studio, 1, 2 or 3");
  const num = (k) => { const s = sp.get(k); if (s == null || s === "") return null; const n = Number(String(s).replace(/[,_\s]/g, "")); if (!isFinite(n) || n < 0) { errs.push(k + " must be a number of AED"); return null; } return n; };
  let min = num("min"), max = num("max");
  if (min != null && max != null && max < min) { const t = min; min = max; max = t; }
  const areas = String(sp.get("areas") || "").split(",").map((s) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, "")).filter(Boolean);
  const type = String(sp.get("type") || "any").toLowerCase();
  if (!["apartment", "villa", "any"].includes(type)) errs.push("type must be apartment, villa or any");
  const musts = String(sp.get("musts") || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const badM = musts.filter((m) => !BRIEF_MUSTS.includes(m));
  if (badM.length) errs.push("unknown musts: " + badM.join(", ") + " (allowed: " + BRIEF_MUSTS.join(", ") + ")");
  let limit = parseInt(sp.get("limit") || "10", 10);
  if (!isFinite(limit) || limit < 1) limit = 10;
  limit = Math.min(limit, 50);
  return { errs, q: { mode, beds: beds == null ? bedsRaw : (beds === 0 ? "studio" : String(beds)), min, max, areas, type, musts: [...new Set(musts)], limit }, bed: beds };
}

export function verdictOf(v, min, max) {
  const lo = min || 0, hi = max == null ? Infinity : max;
  if (v < lo) return v >= lo * (1 - BELOW_FLOOR) ? "below" : null;
  if (v <= hi * (1 + WITHIN_OVER)) return "within";
  if (v <= hi * (1 + LITTLE_OVER)) return "a_little_above";
  if (v <= hi * (1 + ABOVE_CAP)) return "above";
  return null;
}

// ---- rent: one candidate per index record, on the SAME figure the HOMES panel shows -------------------------------
const rentFig = (s) => (s.nn >= 3 && s.mn ? s.mn : s.m);
function rentCandidates(RI, q, bed) {
  const out = []; let thin = 0;
  const kinds = q.type === "apartment" ? ["b"] : q.type === "villa" ? ["v"] : ["b", "v"];
  for (const it of (RI && RI.items) || []) {
    if (q.areas.length && !q.areas.includes(it.d)) continue;
    let best = null;
    for (const k of kinds) {
      const s = it[k] && it[k][String(bed)];
      if (!s) continue;
      if (s.n < EVIDENCE_MIN) { thin++; continue; }
      const v = rentFig(s), verdict = verdictOf(v, q.min, q.max);
      if (!verdict) continue;
      if (!best || TIER[verdict] < TIER[best.verdict] || (TIER[verdict] === TIER[best.verdict] && s.n > best.s.n)) best = { s, v, verdict, villa: k === "v" };
    }
    if (!best) continue;
    const s = best.s, newBasis = s.nn >= 3 && !!s.mn;
    out.push({
      it, d: it.d || null, i: it.i == null ? null : it.i, name: it.n, aliases: it.a || [], lon: it.lon, lat: it.lat, dldArea: it.area,
      key: it.i != null && it.d ? it.d + ":" + it.i : "dld:" + (it.p || nkey(it.n)),
      verdict: best.verdict, v: best.v, n: s.n,
      evidence: { basis: "ejari", median: best.v, q1: newBasis ? s.q1n : s.q1, q3: newBasis ? s.q3n : s.q3, n: s.n, n_new: s.nn,
        median_of: newBasis ? "new_lettings" : "all_contracts", median_all: s.m, sqm: s.s, latest: s.last, home: best.villa ? "villa" : "apartment" },
    });
  }
  return { cands: out, thin };
}

// ---- buy: map_prices finds them (what Buy mode shows); the unit-mix card supplies the median AND the count ---------
const isVilla = (it) => !!(it.fl && it.fl <= 3 && it.b && !it.b["0"] && !it.b["1"]) || /villa|townhouse|town house|mansion/i.test(it.n || "");   // homeMatches' own test
const rowLabel = (b) => (b === 0 ? "studio" : b + " bedroom");
function buyPrelim(MP, q, bed) {
  const out = [];
  for (const it of (MP && MP.items) || []) {
    if (it.i == null || it.i < 0 || !it.d) continue;                          // a launch placed by name only has no card to count from
    if (q.areas.length && !q.areas.includes(it.d)) continue;
    if (q.type === "villa" && !isVilla(it)) continue;
    if (q.type === "apartment" && isVilla(it)) continue;
    const bs = Object.keys(it.b || {}).map(Number).filter((b) => b !== 9 && (bed === 3 ? b >= 3 : b === bed) && !(it.e || []).includes(b));
    if (bs.length) out.push({ it, bs });
  }
  return out;
}
function buyCandidates(pre, cards, q) {
  const out = []; let thin = 0, noCount = 0, noCard = 0;
  for (const { it, bs } of pre) {
    const card = cards[it.d] && cards[it.d][String(it.i)];
    if (!card) { noCard++; continue; }
    const sold = (card.dld_sales && card.dld_sales.sold_by_type) || {};
    const soldOf = (b) => { for (const k of Object.keys(sold)) if (k.toLowerCase() === rowLabel(b)) return sold[k]; return null; };
    let best = null;
    for (const b of bs) {
      const row = (card.rows || []).find((r) => String(r.type || "").toLowerCase() === rowLabel(b));
      if (!row || !row.median_aed) continue;                                   // an estimate (est_aed) is never a sale price
      const n = soldOf(b);
      if (n == null) { noCount++; continue; }
      if (n < EVIDENCE_MIN) { thin++; continue; }
      const verdict = verdictOf(row.median_aed, q.min, q.max);
      if (!verdict) continue;
      if (!best || TIER[verdict] < TIER[best.verdict] || (TIER[verdict] === TIER[best.verdict] && n > best.n)) best = { b, row, n, verdict };
    }
    if (!best) continue;
    const ds = card.dld_sales || {};
    out.push({
      it, d: it.d, i: it.i, name: card.name || it.n, aliases: it.n && card.name && nkey(it.n) !== nkey(card.name) ? [it.n] : [], lon: it.lon, lat: it.lat,
      key: it.d + ":" + it.i, verdict: best.verdict, v: Math.round(best.row.median_aed), n: best.n, card,
      evidence: { basis: "dld_sales", median: Math.round(best.row.median_aed), q1: null, q3: null, n: best.n, n_new: null, sqm: best.row.median_sqm || null,
        latest: ds.last || null, first: ds.first || null, beds: best.b, dates_are: "the building's sales of every type" },
    });
  }
  return { cands: out, thin, noCount, noCard };
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

// ---- the non-negotiables: a source or null --------------------------------------------------------------------------
function mustsOf(c, card, brochure, AM) {
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
      pool: /pool/i.test(am) || (card && card.pools >= 1) ? true : null,
      gym: /\bgym|fitness/i.test(am) ? true : null,
      parking: /parking|car park/i.test(am) || (card && (card.car_parks > 0 || card.parking_allocated > 0)) ? true : null,
      new: null,
      schools,
    },
    nearest,
  };
}

const brochureKeys = (c) => {
  const ks = [];
  if (c.d && c.i != null) ks.push("img_brochure_" + c.d + "_" + c.i);
  for (const n of [c.name].concat(c.aliases || [])) { const s = snake(n); if (s) ks.push("img_brochure_name_" + s); }
  return [...new Set(ks)];
};

function whyOf(c, q) {
  const e = c.evidence, parts = [];
  parts.push(q.mode === "rent" ? e.n + " lettings on the register (" + e.n_new + " new)" : e.n + " " + BED_WORD[Math.min(e.beds, 3)] + " sales on the register");
  parts.push({ within: "typical " + (q.mode === "rent" ? "rent" : "price") + " inside the budget", a_little_above: "typical figure a little above the budget",
    above: "typical figure above the budget", below: "typical figure below the budget" }[c.verdict]);
  if (c.completeness.layouts) parts.push("full layout data");
  if (c.completeness.photos) parts.push("developer photos on file");
  if (!c.completeness.record) parts.push("no building page in the app yet");
  return parts.join("; ");
}

// ---- the route ------------------------------------------------------------------------------------------------------
export async function briefApi(request, env, url, h) {
  const hdr = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
  const J = (o, st) => new Response(JSON.stringify(o), { status: st || 200, headers: hdr });
  if (request.method !== "GET") return new Response("method", { status: 405 });   // before the key: a client key on a POST gets exactly what no key gets (v156)
  if (!h || typeof h.clientOk !== "function" || !h.clientOk(env, url)) return new Response("unauthorized", { status: 401 });
  const { errs, q, bed } = parseBrief(url.searchParams);
  if (errs.length) return J({ error: errs }, 400);
  const notes = [];

  const DG = await kvJson(env, "districts_geo");
  const DN = {}; for (const d of (DG && DG.districts) || []) DN[d.slug] = d.name;
  const unknownAreas = DG ? q.areas.filter((a) => !DN[a]) : [];
  if (unknownAreas.length) notes.push("not a district slug the app knows: " + unknownAreas.join(", "));

  let cands = [], as_of = null, source = null, extra = {};
  const cards = {};
  const loadCards = async (ds) => {
    const byCount = {}; for (const d of ds) if (d) byCount[d] = (byCount[d] || 0) + 1;
    const want = Object.keys(byCount).sort((a, b) => byCount[b] - byCount[a]);
    if (want.length > MAX_DISTRICT_CARDS) notes.push("read the unit-mix records of the " + MAX_DISTRICT_CARDS + " districts with most matches only (" + want.length + " matched); name the districts to see every one");
    await Promise.all(want.slice(0, MAX_DISTRICT_CARDS).map(async (d) => { const u = await kvJson(env, "unitmix_" + d); cards[d] = (u && u.buildings_by_id) || null; }));
  };

  if (q.mode === "rent") {
    const RI = await kvJson(env, "rent_index");
    if (!RI || !Array.isArray(RI.items)) return J({ query: q, error: ["the rent index (KV img_rent_index) is not on file"] }, 503);
    as_of = RI.as_of || null; source = "KV img_rent_index (" + (RI.source_file || "Ejari rent contracts") + ")";
    extra.window = RI.window || null;
    const r = rentCandidates(RI, q, bed); cands = r.cands;
    await loadCards(cands.filter((c) => c.i != null).map((c) => c.d));
    const un = unbindDisputed(cands, cards);
    if (un) notes.push(un + " rent record" + (un === 1 ? " is" : "s are") + " bound in the index to an app building named otherwise, or to one already listed: shown by the register name only, with no building page (the name must agree with the record). See disputed_bind.");
    notes.push("Registered Ejari rent contracts" + (RI.window ? ", " + RI.window[0] + " to " + RI.window[1] : "") + ": what homes in these buildings actually let for, NOT live availability. Availability is confirmed with the leasing team.");
    notes.push("Bedrooms are read from each home's size - Ejari rarely records them" + (RI.bands && RI.bands.flat_accuracy_area ? " (right about " + Math.round(RI.bands.flat_accuracy_area * 100) + "% of the time on contracts that do carry the type)" : "") + ".");
    notes.push("The typical rent is the median of new lettings where there are 3 or more, otherwise of all contracts - the same figure the map's Rent mode shows. The middle half (q1-q3) is on the same basis.");
    notes.push("A contract filed under several building names is counted once; the other names are listed as aliases (also filed as).");
    if (r.thin) notes.push(r.thin + " building" + (r.thin === 1 ? "" : "s") + " with fewer than " + EVIDENCE_MIN + " contracts of this size left out.");
  } else {
    const MP = await kvJson(env, "map_prices");
    if (!MP || !Array.isArray(MP.items)) return J({ query: q, error: ["the Buy data (KV img_map_prices) is not on file"] }, 503);
    const pre = buyPrelim(MP, q, bed);
    await loadCards(pre.map((p) => p.it.d));
    const r = buyCandidates(pre, cards, q); cands = r.cands;
    as_of = String(MP.generated || "").slice(0, 10) || null; source = "KV img_map_prices (what the map's Buy mode shows) + img_unitmix_<district> (per-bedroom sale medians and counts)";
    notes.push("Buy figures are DLD registered sale medians per bedroom count over the building's whole sales record (the dates shown are the first and last sale of any type) - what homes here sold for, NOT what is for sale now.");
    notes.push("The Buy data has no middle half (q1, q3) and no new-versus-resale split: those fields are null. A developer's asking price and a size-based estimate are never used.");
    if (r.noCount) notes.push(r.noCount + " priced bedroom figure" + (r.noCount === 1 ? "" : "s") + " left out: the record carries no sale count for that bedroom type, so the evidence cannot be weighed.");
    if (r.thin) notes.push(r.thin + " left out with fewer than " + EVIDENCE_MIN + " sales of this bedroom type.");
    if (r.noCard) notes.push(r.noCard + " priced building" + (r.noCard === 1 ? "" : "s") + " left out: no unit-mix record read for it.");
  }

  // photos: which developer brochures exist (one listing), then read the few that do, for amenities
  const have = await kvKeys(env, "img_brochure_", 5);
  await Promise.all(cands.map(async (c) => {
    const k = brochureKeys(c).find((x) => have.has(x));
    c.brochureKey = k || null;
    c.brochure = k ? await kvJson(env, k.slice(4)) : null;
  }));
  const AM = await kvJson(env, "amenities");
  const tenancy = {};
  if (q.mode === "rent") await Promise.all([...new Set(cands.filter((c) => c.i != null && c.d).map((c) => c.d))].map(async (d) => { tenancy[d] = await kvJson(env, "tenancy_" + d); }));

  let droppedByMust = 0;
  const kept = [];
  for (const c of cands) {
    const card = c.card || (c.d && c.i != null && cards[c.d] ? cards[c.d][String(c.i)] : null);
    const mm = mustsOf(c, card, c.brochure, AM);
    c.musts = mm.musts; c.nearest = mm.nearest;
    if (q.musts.some((m) => c.musts[m] === false)) { droppedByMust++; continue; }
    c.completeness = {
      record: c.i != null && !!c.d,
      layouts: !!(card && (card.rows || []).some((r) => r.basis === "DLD units register" && /bedroom|studio/i.test(String(r.type || "")))),
      photos: !!(c.brochure && (c.brochure.photos || []).length),
    };
    c.recordName = card ? card.name : null;
    if (q.mode === "rent" && c.i != null) c.est = estLeft(card, tenancy[c.d], c.i, bed);
    kept.push(c);
  }
  if (droppedByMust) notes.push(droppedByMust + " building" + (droppedByMust === 1 ? "" : "s") + " left out because a source says a non-negotiable is missing.");
  if (q.musts.length) notes.push("Non-negotiables: a building is left out only where a source says no; null means we do not know, and those buildings stay in the list. " +
    "Metro: straight-line to the nearest RTA station, within 1 km. Schools: a school in the app's amenity layer within 1 km (none found is not proof of none). " +
    "Pool, gym, parking: the developer's own project page or the Land Department building record. Balcony and 'newer building (2020+)' have no source in the app yet: always null.");

  const score = (c) => (c.completeness.record ? 1 : 0) + (c.completeness.layouts ? 1 : 0) + (c.completeness.photos ? 1 : 0);
  const mid = q.max != null ? ((q.min || 0) + q.max) / 2 : (q.min || 0);
  const mustsMet = (c) => q.musts.filter((m) => c.musts[m] === true).length;
  kept.sort((a, b) => (rankTier(a, q) - rankTier(b, q)) || (b.n - a.n) || (score(b) - score(a)) || (mustsMet(b) - mustsMet(a)) || (Math.abs(a.v - mid) - Math.abs(b.v - mid)) || String(a.name).localeCompare(String(b.name)));

  const counts = { within: 0, a_little_above: 0, above: 0, below: 0 };
  for (const c of kept) counts[c.verdict]++;
  const seenKeys = new Set();
  for (const c of kept) {
    c.key = String(c.key).toLowerCase().replace(/[^a-z0-9_:-]/g, "");         // the /brief page joins keys with commas (keys=, pick=): [a-z0-9_:-] only
    if (seenKeys.has(c.key)) c.key += "-" + norm(c.dldArea || c.d || "x"); seenKeys.add(c.key); }   // one DLD name in two areas
  const results = kept.slice(0, q.limit).map((c, ix) => {
    const r = {
      rank: ix + 1, key: c.key, name: c.name, aliases: c.aliases, district: c.d, district_name: c.d ? (DN[c.d] || c.d) : null,
      dld_area: c.dldArea || null, app_id: c.i, building_url: c.i != null && c.d ? "/building/" + c.d + "/" + c.i : null,
      evidence: c.evidence, verdict: c.verdict, musts: c.musts, nearest_metro: c.nearest, completeness: c.completeness,
      why: whyOf(c, q),
    };
    if (c.recordName && c.i != null) r.record_name = { name: c.recordName, agrees: c.agree || nameAgrees([c.name].concat(c.aliases), c.recordName) };
    if (c.disputed) r.disputed_bind = c.disputed;
    if (c.brochureKey) r.brochure = "/img/" + c.brochureKey.slice(4);
    if (q.mode === "rent") {                                                   // present only when known; otherwise the reason, never a guess
      const e = c.est || { withheld: "no building record in the app to count the units register against" };
      if (e.withheld) r.estimated_left_withheld = e.withheld; else r.estimated_left = e;
    }
    return r;
  });
  if (q.mode === "rent") notes.push("estimated_left is T minus R (flats of this type in the Land Department units list, less Ejari tenancies of this type running on the tenancy file's date), rounded to 10 and shown as {about, of}: an estimate, not a count, and never the number available. It is given only where both are scoped to the one building and the district's tenancy coverage reaches " + Math.round(TENANCY_MIN_SHARE * 100) + "%, the gate the building page uses; otherwise it is omitted and estimated_left_withheld says why.");
  if (results.some((r) => r.record_name && r.record_name.agrees === "part")) notes.push("record_name.agrees = \"part\": the app's building record carries the register name plus a tower or phase suffix (e.g. Bloom Towers -> Bloom Towers B). The evidence may cover the whole project; check before the record's name goes on a client document.");
  notes.push("Ranking: inside the budget first (within = typical figure at or above the minimum and no more than " + Math.round(WITHIN_OVER * 100) + "% over the maximum), then a little above (to +" + Math.round(LITTLE_OVER * 100) + "%), below (to -" + Math.round(BELOW_FLOOR * 100) + "%), above (to +" + Math.round(ABOVE_CAP * 100) + "%); within each, most evidence first, then the most complete record. Fewer than " + EVIDENCE_MIN + " contracts or sales: left out.");

  return J({ query: q, as_of, source, ...extra, total_matched: kept.length, counts, results, notes });
}
