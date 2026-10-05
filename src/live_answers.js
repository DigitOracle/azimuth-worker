// v291 - LIVE GOOGLE ANSWERS for the Brief's must-haves (Kendall, 2 Oct 2026: in DAMAC Hills the gym was answered for 2 of 45 homes and
// the community pool only from OpenStreetMap, while Google Maps plainly shows gyms and pools there; then "run this for all of DAMAC
// sub-communities").
//
// Where every other source leaves gym, community pool or pets (dog park) "not known", Google Places is asked NOW, at render time:
//   1. the sub-community: a register community the district model attributes footprints to (KV img_anchors_<d>, anchors[].cluster -
//      the same attribution brief_docs.js areaIndex() uses), searched around the centre of those footprints with a radius of their
//      extent plus 150 m, capped at 800 m. A place found inside that circle AND inside the district polygon answers v true at level
//      "cluster": "Gym in Carson on Google Maps (asked live, 2 Oct 2026): Damac Hills - Gym".
//   2. else the community: one search around the district's centre (radius up to 1500 m); a place inside the district polygon (the
//      counts file's request definition, KV img_amenity_counts_<d>.google_requests) answers v true at level "community", naming how
//      far it is from the sub-community or home. A sub-community with no attributed footprints gets this answer only, and says so.
//   3. else it stays not known. Google never answers "no": an absence on Google Maps is not proof of absence.
// Order of sources (the callers keep it): official registers > broker facts > live Google > not known. Only an answer still null is
// filled, so a register (or broker) answer is never overridden.
//
// Google's terms: Places content may not be cached or stored. Nothing here is written anywhere; each request has its own in-memory
// cache (one call per district per criterion, one per sub-community per criterion), all calls run in parallel with a 2 s timeout, and
// any failure, timeout or missing key leaves the answer not known. The key travels only in the X-Goog-Api-Key header, never in output.
import { kvJson } from "./brief.js";
import { isCountableGym, NEAR_FACT_M } from "./brief_rules.js";   // v310 R1/R2 - an address-like name is not a gym; a community answer only within 500 m

export const LIVE_TIMEOUT_MS = 2000;
export const COMMUNITY_RADIUS_MAX = 1500;
export const CLUSTER_PAD_M = 150;
export const CLUSTER_RADIUS_MAX = 800;
export const MAX_CALLS = 45;                 // a hard ceiling per request, whatever the brief asks
const NEARBY = "https://places.googleapis.com/v1/places:searchNearby";
const MASK = "places.id,places.displayName,places.location,places.businessStatus,places.types,places.primaryType";

// the criteria Google can answer, the Places types asked, and how a place must look to count
const fold = (s) => String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const RESIDENTIAL = /\b(community|residen\w*|cluster|villas?|town\s?houses?|apartments?|towers?|buildings?|lagoon)\b/i;
export const LIVE_CRITS = {
  gym: {
    label: "Gym", types: ["gym", "fitness_center"],
    // a gym, not a personal trainer, a festival, an aqua-aerobics class or a club tagged "gym" (all seen in DAMAC Hills, 2 Oct 2026);
    // a ladies-only gym does not answer "gym" for every client, so it is not counted
    // v310 R2: a name that reads like a villa or unit address ("Damac 307 Rochester") is not a gym unless the name itself says gym or fitness
    ok: (p, toks) => isCountableGym(p.name, p.primaryType, toks),
  },
  community_pool: {
    label: "Community pool", types: ["swimming_pool"],
    // "swimming_pool" on Google includes public, hotel and club pools: only a pool whose name says it is the community's or a
    // residence's (or names the community or sub-community) counts; a hotel, club, school or lounge never does
    ok: (p, toks) => {
      const n = p.name, ty = p.types || [];
      if (p.primaryType !== "swimming_pool") return false;
      if (ty.some((t) => /^(lodging|hotel|resort_hotel|sports_club|sports_school|school|gym|fitness_center|restaurant|bar)$/.test(t))) return false;
      if (/\b(hotel|resort|club|academy|school|lessons?|coach\w*|spa|beach|lounge|bar|shisha)\b/i.test(n)) return false;
      return RESIDENTIAL.test(n) || toks.some((t) => fold(n).includes(t));
    },
  },
  pets: {
    label: "Dog park", types: ["dog_park"],
    ok: (p) => (p.types || []).includes("dog_park") && !/\b(shop|store|groom\w*|vet\w*|clinic|hotel|boarding|daycare|kennels?)\b/i.test(p.name),
  },
};

// the fetch used for Google; tests swap it (the default reads globalThis.fetch at call time)
let FETCH = (u, o) => globalThis.fetch(u, o);
export function __setLiveFetch(fn) { FETCH = fn || ((u, o) => globalThis.fetch(u, o)); }

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayOf = (d) => d.getUTCDate() + " " + MON[d.getUTCMonth()] + " " + d.getUTCFullYear();
const metres = (a, b) => { const R = 6371000, la = (a[0] + b[0]) / 2 * Math.PI / 180; return R * Math.hypot((b[0] - a[0]) * Math.PI / 180, (b[1] - a[1]) * Math.PI / 180 * Math.cos(la)); };
const kmSay = (m) => (m >= 1000 ? "about " + (Math.round(m / 100) / 10) + " km" : "about " + Math.max(50, Math.round(m / 50) * 50) + " m");
// ray casting; poly [[lat, lon], ...]
export function inPoly(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i], [yj, xj] = poly[j];
    if ((yi > pt[0]) !== (yj > pt[0]) && pt[1] < (xj - xi) * (pt[0] - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const titleCase = (s) => String(s).toLowerCase().replace(/(^|[\s(\/-])([a-z])/g, (m, a, b) => a + b.toUpperCase());

// One per request: the in-memory cache (promises, so parallel askers share one call) and the call count.
export function liveCtx(env, opts) {
  const now = (opts && opts.now) ? new Date(opts.now) : new Date();
  return { env, read: (opts && opts.read) || kvJson, key: env && env.GOOGLE_MAPS_KEY, day: dayOf(now), iso: now.toISOString().slice(0, 10), cache: new Map(), calls: 0, failed: 0, used: 0 };
}
const once = (ctx, k, fn) => { if (!ctx.cache.has(k)) ctx.cache.set(k, fn()); return ctx.cache.get(k); };

async function nearby(ctx, types, centre, radius) {
  if (!ctx.key || ctx.calls >= MAX_CALLS) return null;
  ctx.calls++;
  const ac = typeof AbortController !== "undefined" ? new AbortController() : null;
  let timer;
  const timeout = new Promise((res) => { timer = setTimeout(() => { try { ac && ac.abort(); } catch (e) {} res(null); }, LIVE_TIMEOUT_MS); });
  const ask = (async () => {
    try {
      const r = await FETCH(NEARBY, { method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": ctx.key, "X-Goog-FieldMask": MASK },
        body: JSON.stringify({ includedTypes: types, maxResultCount: 20, rankPreference: "DISTANCE",
          locationRestriction: { circle: { center: { latitude: centre[0], longitude: centre[1] }, radius: Math.round(radius) } } }),
        signal: ac ? ac.signal : undefined });
      if (!r || !r.ok) return null;
      const j = await r.json();
      return j && typeof j === "object" ? (Array.isArray(j.places) ? j.places : []) : null;
    } catch (e) { return null; }
  })();
  try {
    const out = await Promise.race([ask, timeout]);
    if (out == null) ctx.failed++;
    return out;
  } finally { clearTimeout(timer); }
}
const placeOf = (p) => p && p.displayName && p.displayName.text && p.location && isFinite(+p.location.latitude) && isFinite(+p.location.longitude)
  ? { name: String(p.displayName.text).trim(), at: [+p.location.latitude, +p.location.longitude], status: p.businessStatus, types: p.types || [], primaryType: p.primaryType || null }
  : null;

// ---- the district: its polygon, centre and name (the counts file), and its sub-communities (the anchors file) -------------------------
function district(ctx, d, dn) {
  return once(ctx, "d:" + d, async () => {
    const [counts, anchors] = await Promise.all([ctx.read(ctx.env, "amenity_counts_" + d), ctx.read(ctx.env, "anchors_" + d)]);   // v292 - the search's reader (memo)
    const coords = (((((counts || {}).google_requests || {}).body || {}).filter || {}).locationFilter || {}).customArea;
    const ring = coords && coords.polygon && Array.isArray(coords.polygon.coordinates)
      ? coords.polygon.coordinates.filter((p) => p && isFinite(+p.latitude) && isFinite(+p.longitude)).map((p) => [+p.latitude, +p.longitude]) : [];
    if (ring.length < 3) return null;                                        // no polygon: "inside the district" cannot be checked
    const c = counts.area && counts.area.centroid;
    const centre = c && isFinite(+c.lat) && isFinite(+c.lng) ? [+c.lat, +c.lng]
      : [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length];
    const name = dn || counts.name || d;
    const subs = new Map(), byId = new Map();
    for (const a of (anchors && Array.isArray(anchors.anchors) ? anchors.anchors : [])) {
      if (!a || !a.cluster || !isFinite(+a.lat) || !isFinite(+a.lon)) continue;
      const k = fold(a.cluster); if (!k) continue;
      if (!subs.has(k)) subs.set(k, { cluster: a.cluster, pts: [] });
      subs.get(k).pts.push([+a.lat, +a.lon]);
      if (a.i != null) byId.set(+a.i, k);
    }
    const dk = fold(name);
    for (const s of subs.values()) {
      s.c = [s.pts.reduce((t, p) => t + p[0], 0) / s.pts.length, s.pts.reduce((t, p) => t + p[1], 0) / s.pts.length];
      s.r = Math.min(CLUSTER_RADIUS_MAX, Math.max(...s.pts.map((p) => metres(s.c, p))) + CLUSTER_PAD_M);
      s.pretty = shortName(s.cluster, dk);
    }
    // name tokens that make a place "the community's": the district, and every sub-community's own short name (4+ letters)
    const toks = [dk].concat([...subs.values()].map((s) => fold(s.pretty).replace(/^the/, ""))).filter((t) => t && t.length >= 4);
    return { d, name, ring, centre, radius: Math.min(COMMUNITY_RADIUS_MAX, Math.max(...ring.map((p) => metres(centre, p)))), subs, byId, dk, toks };
  });
}
// "DAMAC HILLS - CARSON" -> "Carson"; "DAMAC HILLS-PARK RESIDENCES 1" -> "Park Residences 1"
function shortName(cluster, dk) {
  const raw = String(cluster || "");
  let cut = 0, acc = "";
  for (let i = 0; i < raw.length && acc.length < dk.length; i++) { acc += fold(raw[i]); cut = i + 1; }
  const rest = acc === dk ? raw.slice(cut).replace(/^[\s\-–:]+/, "").trim() : raw.trim();
  return titleCase(rest || raw).replace(/\s+/g, " ");
}
// the sub-community a home belongs to: its own name (or an alias) as an attributed cluster, else its app building's cluster;
// a register name under the district's own name with no footprints is still a sub-community, without a search circle
function subOf(D, item) {
  if (!D || item.noSub) return null;
  for (const n of [item.name].concat(item.aliases || [])) { const s = D.subs.get(fold(n)); if (s) return s; }
  for (const i of [item.i].concat(item.is || [])) if (i != null && D.byId.has(+i)) return D.subs.get(D.byId.get(+i));
  const n = String(item.name || "");
  if (fold(n).startsWith(D.dk) && fold(n).length > D.dk.length) return { cluster: n, pts: [], none: true, pretty: shortName(n, D.dk) };
  return null;
}

// the places of one criterion inside the district polygon (community) or inside a sub-community's circle (cluster), nearest first
function communityHits(ctx, D, k) {
  return once(ctx, "c:" + D.d + ":" + k, async () => {
    const C = LIVE_CRITS[k], ps = await nearby(ctx, C.types, D.centre, D.radius);
    if (!ps) return null;
    return ps.map(placeOf).filter((p) => p && p.status === "OPERATIONAL" && inPoly(p.at, D.ring) && C.ok(p, D.toks));
  });
}
function clusterHits(ctx, D, s, k) {
  return once(ctx, "s:" + D.d + ":" + fold(s.cluster) + ":" + k, async () => {
    const C = LIVE_CRITS[k], ps = await nearby(ctx, C.types, s.c, s.r);
    if (!ps) return null;
    const toks = [fold(s.pretty).replace(/^the/, "")].filter((t) => t.length >= 4).concat(D.toks);
    return ps.map(placeOf).filter((p) => p && p.status === "OPERATIONAL" && metres(s.c, p.at) <= s.r && inPoly(p.at, D.ring) && C.ok(p, toks))
      .sort((a, b) => metres(s.c, a.at) - metres(s.c, b.at));
  });
}

// items: [{crit, d, dn?, name, aliases?, i?, is?, lat?, lon?, noSub?}]; crits: the criteria asked (others are never looked up).
// opts.cluster: also search each sub-community (the shown results); false = the community answer only (ranking a long list).
// Fills crit[k] only where it is null (or an earlier live answer); returns the number of answers given.
export async function fillLive(ctx, items, crits, opts) {
  const ks = [...new Set(crits || [])].filter((k) => LIVE_CRITS[k]);
  if (!ctx || !ctx.key || !ks.length || !items || !items.length) return 0;
  const cluster = !(opts && opts.cluster === false);
  const open = (c, k) => c && (!c[k] || c[k].v == null || c[k].live === true);
  const jobs = [];
  for (const it of items) for (const k of ks) {
    if (!it || !it.d || !open(it.crit, k) || (it.crit[k] && it.crit[k].v === false)) continue;
    jobs.push((async () => {
      const D = await district(ctx, it.d, it.dn);
      if (!D) return null;
      const s = subOf(D, it);
      const [sub, com] = await Promise.all([cluster && s && !s.none ? clusterHits(ctx, D, s, k) : null, communityHits(ctx, D, k)]);
      return { it, k, D, s, sub, com };
    })());
  }
  const done = await Promise.all(jobs);
  let n = 0;
  for (const j of done) {
    if (!j || !open(j.it.crit, j.k)) continue;
    const { it, k, D, s, sub, com } = j, L = LIVE_CRITS[k].label, prev = it.crit[k] || {};
    const base = { v: true, source: "Google Maps", attribution: "Google Maps", live: true, asked: ctx.iso, ...(prev.detail ? { detail: prev.detail } : {}) };
    let ans = null;
    if (sub && sub.length) {
      const p = sub[0];
      ans = { ...base, level: "cluster", place: p.name,
        src: L + " in " + s.pretty + " on Google Maps (asked live, " + ctx.day + "): " + p.name,
        say: p.name + ", in " + s.pretty + " (Google Maps, asked live " + ctx.day + ")" };
    } else if (com && com.length) {
      const from = s && !s.none ? { at: s.c, n: s.pretty } : Number.isFinite(it.lat) && Number.isFinite(it.lon) ? { at: [it.lat, it.lon], n: s ? s.pretty : (it.name ? titleCase(it.name) : "this home") } : null;
      const p = from ? com.slice().sort((a, b) => metres(from.at, a.at) - metres(from.at, b.at))[0] : com[0];
      const dm = from ? metres(from.at, p.at) : null;
      const far = from ? kmSay(dm) + " from " + from.n : "";
      // v310 R1: a community place counts as a yes for the home only within 500 m of it; further off it is kept as the community's own fact (with how
      // far it is), never as a yes for this home. With nothing to measure from it stays the community's answer, labelled as the community's.
      if (dm != null && dm > NEAR_FACT_M) {
        if (!prev.community_fact) it.crit[k] = { ...(it.crit[k] || { v: null }), v: it.crit[k] && it.crit[k].v != null ? it.crit[k].v : null,
          community_fact: { k, what: L.toLowerCase(), name: p.name, m: dm == null ? null : Math.round(dm), community: D.name, say: "In " + D.name + ": " + p.name + (dm != null ? ", " + kmSay(dm) + " away" : ""), source: "Google Maps", asked: ctx.iso } };
        continue;
      }
      ans = { ...base, level: dm == null ? "community" : "near", place: p.name,
        src: L + " in " + D.name + " on Google Maps (asked live, " + ctx.day + "): " + p.name + (far ? ", " + far : "") +
          (s && s.none ? ". No building outlines are on file for " + s.pretty + ", so this is the community's answer" : ""),
        say: p.name + ", in " + D.name + (far ? ", " + far : "") + " (Google Maps, asked live " + ctx.day + ")" };
    }
    if (ans) { it.crit[k] = ans; n++; }
    else if (prev.live) it.crit[k] = prev;                                   // an earlier live answer stands; never turned into a no
  }
  ctx.used += n;
  return n;
}
