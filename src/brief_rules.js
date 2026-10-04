// v310 - THE BRIEF RULES for a community report (Kendall, 4 Oct 2026: "100% of DAMAC Hills correct ... a realtor can run the full journey
// without 'unknown', blanks or wrong facts"). Pure functions, no KV and no network: src/brief.js, src/brief_docs.js and
// src/live_answers.js call them, test/test_v310_damachills_rules.mjs proves each one.
//
//   R1  a community fact (a pool, a dog park, a gym that belongs to the master community) answers YES for a home only where the place
//       is within 500 m of the building (or of the nearest home of its sub-community). Further away, or with no position to measure
//       from, it is NOT a yes for that home: it is shown as the community's own, with the distance (community_fact).
//   R2  a gym is a gym by its name: an address-like name ("Damac 307 Rochester") and a ladies-only club are not counted.
//   R3  "newer build" reads the Dubai Municipality completion year, for villa communities too (facts.completion in the amenity file).
//   R4  few lettings: a figure always says how many lettings it rests on; under 5 it says "based on only N lettings" and shows no middle
//       half and no precision beyond AED 500 (under 3 contracts there is no figure at all: EVIDENCE_MIN in brief.js).
//   R5  a size is shown only if it is possible for the home type and bedroom count (a studio is not 200 m2, a villa is not 680 m2).
//   R6  the rent window is labelled with its dates and what the dates are (contracts that STARTED, or were REGISTERED).
//   R7  evidence that belongs to the whole community says so (evidence.scope).

export const NEAR_FACT_M = 500;

// ---- distance ---------------------------------------------------------------------------------------------------------------
export function distM(a, b) {             // a, b: [lon, lat]
  const R = 6371000, la = ((a[1] + b[1]) / 2) * Math.PI / 180;
  return R * Math.hypot(((b[0] - a[0]) * Math.PI / 180) * Math.cos(la), (b[1] - a[1]) * Math.PI / 180);
}
export const distSay = (m) => (m >= 1000 ? "about " + (Math.round(m / 100) / 10) + " km" : "about " + Math.max(50, Math.round(m / 50) * 50) + " m");

// ---- R2: what counts as a gym ---------------------------------------------------------------------------------------------
const fold = (s) => String(s == null ? "" : s).normalize("NFKD").replace(/[̀-ͯ]/g, "");
const GYM_WORD = /\b(gym|gymnasium|fitness|health\s+club|crossfit|workout)\b/i;
const NOT_A_GYM = /\b(personal\s+train\w*|trainer|coach\w*|festival|tennis|swimming|pool|aqua|yoga|dance|martial|karate|academy|physio\w*|outdoor)\b/i;
const LADIES_ONLY = /\b(ladies|women|womens|female)\b|\bmen\s+only\b/i;
// "Damac 307 Rochester", "Villa 12 Gym Road"-style names: a number standing alone in the name. Passes only when the name also says gym or fitness.
const HAS_NUMBER = /(^|[^a-z0-9])\d{1,4}[a-z]?([^a-z0-9]|$)/i;
export function isAddressLike(name) {
  const n = fold(name).trim();
  if (!n) return true;
  if (GYM_WORD.test(n)) return false;
  return HAS_NUMBER.test(n) || /\b(villa|unit|plot|bldg|apt|apartment|flat|street|road)\b\s*[-#]?\s*\d/i.test(n);
}
// typed: the type Google or the spots file gives the place ("gym", "fitness_center"); toks: name fragments of the community ("rochester", "carson")
export function isCountableGym(name, typed, toks) {
  const n = fold(name).trim();
  if (!n || NOT_A_GYM.test(n) || LADIES_ONLY.test(n) || isAddressLike(n)) return false;
  if (GYM_WORD.test(n)) return true;
  const key = n.toLowerCase().replace(/[^a-z0-9]/g, "");
  return (typed === "gym" || typed === "fitness_center") && (toks || []).some((t) => t && key.includes(t));
}

// ---- R1: community facts within 500 m ---------------------------------------------------------------------------------------
// the criteria that can rest on a place somewhere in the master community, and the spot type that place has in img_amenity_spots_<d>
export const SPOT_OF = { community_pool: "community_pool", pets: "dog_park", gym: "gym" };
const WHAT = { community_pool: "community pool", pets: "dog park", gym: "gym" };
// spots: the spots file's list ({type, name, lat, lng, community?}); origins: [[lon, lat], ...] = the building, or its sub-community's homes
export function nearestPlace(spots, type, origins) {
  if (!Array.isArray(spots) || !Array.isArray(origins) || !origins.length) return null;
  let best = null;
  for (const s of spots) {
    if (!s || s.type !== type || !isFinite(+s.lat) || !isFinite(+s.lng)) continue;
    if (type === "gym" && !isCountableGym(s.name, "gym", [])) continue;
    let m = Infinity; for (const o of origins) m = Math.min(m, distM(o, [+s.lng, +s.lat]));
    if (!best || m < best.m) best = { name: String(s.name || "").trim() || null, m: Math.round(m), community: s.community || null };
  }
  return best;
}
// out: the criteria answers (brief.js criteriaOf); community_name: "DAMAC Hills". Rewrites a community-level YES in place; returns out.
//   measurable and within 500 m  -> yes, level "near", with the place and the distance
//   measurable and further        -> NOT a yes for the home: v null + community_fact (the nearest place and how far it is)
//   not measurable (no position, or the spots file has no place of that type) -> stays the community's yes, labelled as the community's
export function applyNearRule(out, { spots, origins, community_name }) {
  const hasOrigin = Array.isArray(origins) && origins.length > 0;
  for (const k of Object.keys(SPOT_OF)) {
    const cur = out[k];
    if (!cur || cur.v !== true || cur.level !== "community") continue;
    const near = hasOrigin ? nearestPlace(spots, SPOT_OF[k], origins) : null;
    const what = WHAT[k], where = community_name || "the community";
    if (!near) {
      out[k] = { ...cur, unplaced: true, src: String(cur.src || "") + ". It is the community's, not shown to be at this home: how far it is from this home is not worked out" };
      continue;
    }
    if (near.m <= NEAR_FACT_M) {
      out[k] = { ...cur, level: "near", near, src: "A " + what + " close by: " + (near.name ? near.name + ", " : "") + distSay(near.m) + " from this home (" + (cur.source || "a named source") + ")",
        say: (near.name ? near.name + ", " : "") + distSay(near.m) + " from this home" };
      continue;
    }
    out[k] = { v: null, src: "Not a fact about this home: the nearest mapped " + what + (near.name ? " is " + near.name : "") + ", " + distSay(near.m) + " from this home. It is the community's, not this home's" + (cur.source ? " (" + cur.source + ")" : "") + ".",
      community_fact: { k, what, name: near.name, m: near.m, community: where, say: "In " + where + (near.name ? ": " + near.name + ", " + distSay(near.m) + " away" : "") },
      ...(cur.detail ? { detail: cur.detail } : {}) };
  }
  return out;
}

// ---- R3: the completion year the amenity file carries (Dubai Municipality), for homes with no building record ---------------------
export function completionFromFacts(af) {
  const f = af && af.facts && af.facts.completion;
  const y = f && (+f.year || +String(f.value || "").slice(0, 4));
  if (!y || y < 1950 || y > 2045) return null;
  return { year: y, src: (f.source_name || "Dubai Municipality building record") + " (completion " + y + (f.level === "community" ? ", the community's" : "") + ")" };
}

// ---- R4/R7: how a rent figure describes its own evidence -------------------------------------------------------------------
export const FEW_LETTINGS = 5;
export const roundTo = (v, step) => Math.round(v / step) * step;
// f: rentFigure(); scope: it.ev_scope ("DAMAC Hills - Piccadilly Green") or null. -> one plain sentence
export function evidenceSay(f, scope) {
  if (!f) return "";
  const n = f.n, nn = f.nn;
  const base = n < FEW_LETTINGS ? "based on only " + n + " lettings" : n + " recent lettings";
  const mix = f.median_of === "all_contracts" ? (nn ? " (" + nn + " new; the typical rent counts renewals too)" : " (the typical rent counts renewals too)") : (nn != null && n >= FEW_LETTINGS ? " (" + nn + " new)" : "");
  return base + mix + (scope ? ", from the whole of " + scope + " (not this home alone)" : "");
}
// what to print for the typical rent and the middle half: under FEW_LETTINGS the rent is rounded to AED 500 and the middle half is withheld
export function shownRent(f) {
  if (!f) return null;
  const few = f.n < FEW_LETTINGS;
  return { m: few ? roundTo(f.m, 500) : f.m, q1: few ? null : f.q1, q3: few ? null : f.q3, few };
}

// ---- R5: a size must be possible -------------------------------------------------------------------------------------------
// [min, max] m2 by home kind ("b" flat, "v" villa or townhouse) and bedroom band (0 studio ... 3 for 3 or more). Wide enough for every real
// DAMAC Hills / Dubai home, narrow enough to catch the 680 m2 villa "3-bed" and the 150 m2 placeholder on a 300 m2 plot.
export const SIZE_RANGE = { b: { 0: [15, 120], 1: [25, 190], 2: [45, 320], 3: [70, 650] }, v: { 0: [60, 300], 1: [60, 300], 2: [90, 450], 3: [120, 600] } };
export function sizeSane(sqm, kind, bed) {
  if (sqm == null || !isFinite(+sqm) || +sqm <= 0) return false;
  const r = (SIZE_RANGE[kind === "v" ? "v" : "b"] || {})[Math.min(Math.max(+bed || 0, 0), 3)];
  return !r || (+sqm >= r[0] && +sqm <= r[1]);
}

// ---- R6: the window's label ------------------------------------------------------------------------------------------------
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const dayName = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || "")); return m ? (+m[3]) + " " + MON[+m[2] - 1] + " " + m[1] : String(iso || ""); };
// it: a rent-index record (may carry win + win_basis: the DAMAC Hills rebuild); RI: the index ({window, window_basis}). -> {from, to, basis, say}
export function windowOf(it, RI) {
  const w = (it && Array.isArray(it.win) && it.win.length === 2 ? it.win : null) || (RI && Array.isArray(RI.window) && RI.window.length === 2 ? RI.window : null);
  if (!w) return null;
  const basis = String((it && it.win_basis) || (RI && RI.window_basis) || "registered");
  const started = /start/i.test(basis);
  return { from: w[0], to: w[1], basis: started ? "start" : "registered",
    say: "lettings " + (started ? "that started" : "registered") + " between " + dayName(w[0]) + " and " + dayName(w[1]) };
}
