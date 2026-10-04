// v290 - AMENITY CARDS for the Brief (Kendall, 2 Oct 2026: "in the brief, if dog parks is checked, we should show a card, with a
// picture, same for pool, and the other amenities").
//
// When the client marks a must-have, the results open with one card per amenity type per district searched:
//   "🐕 Dog parks in DAMAC Hills" - how many, their names, and a picture of one; "🏊 Community pools in DAMAC Hills"; "🏋️ Gyms";
//   "🌳 Parks"; "🏫 Schools"; "🚇 Metro" (with the nearest station where none is in the district, then "🚌 Bus stops").
// The same cards go into the Compare and Full-pack PDFs as a short "Around the community" page.
//
// DATA: KV img_amenity_spots_<district> (plain or gzipped JSON; naj-market-pulse scripts/build_amenity_spots.py writes
// data/amenities/spots_<district>.json - the schema agreed 2 Oct):
//   {district, district_name?, built, sources: [...], spots: [{id, type, name, lat, lng, community, source, source_url, name_is_generic?,
//    picture: {route: places_photo|street_view|satellite|none, place_id, photo_name, photo_authors?, pano_id, heading, distance_m, pano_date}}]}
// and, where present, KV img_amenity_counts_<district> (naj-market-pulse scripts/amenity_counts.py, data/amenities/counts_<district>.json):
//   google_requests  the Places Aggregate request (computeInsights, INSIGHT_COUNT) over the district polygon. The COUNTS ARE NOT STORED
//                    (Google Maps Platform Service Specific Terms s.13.2): they are asked for LIVE here, per card, under the same rules as
//                    the pictures (server-side key, short timeout, in parallel, nothing kept), and shown with "Google Maps" beside the
//                    number. District context only: never turned into a score about a client (s.13.3). google_counts in the file is
//                    ignored even if a number appears there.
//   schools          OpenStreetMap schools joined to the schools regulator's register (names added to the schools card)
//   stations, nearest_station   metro and tram stations in the district, and the nearest one with its straight-line distance
// Schools: OpenStreetMap is sparse for schools (JVC: Google counts 24, OpenStreetMap 0), so the schools card asks Google Places
// (Nearby Search, live, names only) for the schools around the district's middle and leads with those names and Google's count.
// A spot whose source is a listing portal is never counted, named or pictured (the same rule as brief_docs.js PORTAL_RX).
//
// PICTURES are fetched at RENDER time, server-side, with env.GOOGLE_MAPS_KEY, and never stored (Google's terms forbid caching):
//   places_photo  Places (New) photo media, shown with the photo's author attribution (photo_authors) and "Google Maps"
//   street_view   Street View Static, by pano id and heading, shown with "© Google" and the picture's month
//   satellite     Maps Static, satellite, centred on the spot, shown with "© Google"
// The page never sees the key: its <img> points at /amenity_photo?d=&id=, which checks the Brief's own key (owner or client), fetches
// from Google here and streams the picture back with Cache-Control: no-store. The PDF embeds the picture fetched here. Any error, a slow
// answer (a few seconds, all fetched in parallel) or a missing secret leaves the card without a picture; the page never breaks.
//
// Hooks (kept small so this merges cleanly with the other Brief branches):
//   src/index.js       one import, one marked dispatch after /brief_api, and the two paths on CLIENT_PATHS
//   src/brief_page.js  the CSS and the page script appended to the Brief page; one call at the end of drawRes()
//   src/brief_docs.js  one call in buildDocument() for Compare and Full pack
import { kvJson, EXTRA_AREAS } from "./brief.js";

// one emoji per type; `many` is the card's heading, `where` how the place relates to the district (the spot files take schools and
// metro stations from a buffer around the district, so they are "in and near")
export const AMENITY_TYPES = {
  dog_park: { emoji: "🐕", one: "dog park", many: "Dog parks", where: "in" },
  park: { emoji: "🌳", one: "park", many: "Parks", where: "in" },
  community_pool: { emoji: "🏊", one: "community pool", many: "Community pools", where: "in" },
  gym: { emoji: "🏋️", one: "gym", many: "Gyms", where: "in" },
  clubhouse: { emoji: "🏛️", one: "clubhouse", many: "Clubhouses", where: "in" },
  school: { emoji: "🏫", one: "school", many: "Schools", where: "in and near" },
  metro: { emoji: "🚇", one: "metro station", many: "Metro stations", where: "near" },
  bus: { emoji: "🚌", one: "bus stop", many: "Bus stops", where: "in" },
  supermarket: { emoji: "🛒", one: "supermarket", many: "Supermarkets", where: "in" },
  beach: { emoji: "🏖️", one: "beach", many: "Beaches", where: "near" },
};
// which cards a must-have opens. private_pool, parking, balcony, modern and long_term are about the home itself, not a place in the
// community, so they open no card. metro falls back to bus stops only where the district has no metro station on file.
export const MUST_TO_TYPES = { pets: ["dog_park", "park"], community_pool: ["community_pool"], gym: ["gym"], schools: ["school"], metro: ["metro"] };
const MAX_DISTRICTS = 3;
const NAMES_SHOWN = 5;
const PIC_TIMEOUT_MS = 3500;
const LIVE_TIMEOUT_MS = 2500;            // the live counts and school names: small JSON answers
const PIC_MAX_BYTES = 4 * 1024 * 1024;
const ROUTE_PREF = { places_photo: 0, street_view: 1, satellite: 2 };
// = src/brief_docs.js PORTAL_RX (test/test_v290_amenity_cards.mjs checks the two agree)
export const PORTAL_RX = /(propertyfinder|bayut|dubizzle|justproperty|houza|opensooq|zillow|rightmove|zoopla|propsearch|emirates\.estate|drivenproperties|betterhomes|allsoppandallsopp|hausandhaus|fam-?properties|luxhabitat|axcapital|metropolitan\.realestate|provident)/i;
// what each source is called on a client page (no acronyms)
const SOURCE_SAY = { OpenStreetMap: "© OpenStreetMap contributors", KHDA: "Dubai's schools regulator", RTA: "Roads and Transport Authority",
  "Dubai Municipality": "Dubai Municipality", developer: "the developer's own pages", "Google Places": "Google Maps" };

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
const slugOf = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthYear = (d) => { const m = /^(\d{4})-(\d{2})/.exec(String(d || "")); return m ? MON[+m[2] - 1] + " " + m[1] : ""; };

// the fetch used for Google; tests swap it (the default reads globalThis.fetch at call time, so a stubbed global works too)
let FETCH = (u, o) => globalThis.fetch(u, o);
export function __setAmenityFetch(fn) { FETCH = fn || ((u, o) => globalThis.fetch(u, o)); }

export const isPortalSpot = (sp) => PORTAL_RX.test(String((sp && sp.source_url) || "")) || PORTAL_RX.test(String((sp && sp.source) || ""));

// ---- the data ----------------------------------------------------------------------------------------------------------------------
// The usable spots of one district: known type, a position, a name, and never a portal source.
export async function loadSpots(env, d) {
  const doc = await kvJson(env, "amenity_spots_" + d);
  if (!doc || !Array.isArray(doc.spots)) return null;
  const spots = doc.spots.filter((s) => s && AMENITY_TYPES[s.type] && isFinite(+s.lat) && isFinite(+s.lng) && s.name && !isPortalSpot(s));
  return { doc, spots, refused: doc.spots.filter((s) => s && isPortalSpot(s)).length };
}
// ---- live Google answers (never stored) --------------------------------------------------------------------------------------------
// the Places Aggregate type(s) behind each card (bus and clubhouse have no count: bus_station is a station, not a stop)
export const GOOGLE_COUNT_TYPES = { dog_park: ["dog_park"], park: ["park"], community_pool: ["swimming_pool"], gym: ["gym"], school: ["school"],
  metro: ["subway_station"], supermarket: ["supermarket"] };
async function postJson(url, key, body, mask) {
  const ac = typeof AbortController !== "undefined" ? new AbortController() : null;
  const t = setTimeout(() => { try { ac && ac.abort(); } catch (e) {} }, LIVE_TIMEOUT_MS);
  try {
    const h = { "Content-Type": "application/json", "X-Goog-Api-Key": key };
    if (mask) h["X-Goog-FieldMask"] = mask;
    const r = await FETCH(url, { method: "POST", headers: h, body: JSON.stringify(body), signal: ac ? ac.signal : undefined });
    if (!r || !r.ok) return null;
    return await r.json();
  } catch (e) { return null; } finally { clearTimeout(t); }
}
// How many places of this type Google holds inside the district polygon, asked now. null on any failure, or with no key or request.
export async function liveCount(env, counts, type) {
  const req = counts && counts.google_requests, body = req && req.body;
  if (!env || !env.GOOGLE_MAPS_KEY || !GOOGLE_COUNT_TYPES[type] || !body || !body.filter || !body.filter.locationFilter) return null;
  const b = JSON.parse(JSON.stringify(body));
  b.filter.typeFilter = { includedTypes: GOOGLE_COUNT_TYPES[type] };
  const j = await postJson("https://areainsights.googleapis.com/v1:computeInsights", env.GOOGLE_MAPS_KEY, b);
  if (!j || typeof j !== "object") return null;
  const n = Number(j.count == null ? 0 : j.count);                 // Google leaves count out when it is zero
  return isFinite(n) && n >= 0 ? Math.round(n) : null;
}
// The schools Google Places knows around the district's middle, asked now: names only. [] on any failure.
export async function liveSchools(env, counts) {
  const c = counts && counts.area && counts.area.centroid;
  if (!env || !env.GOOGLE_MAPS_KEY || !c || !isFinite(+c.lat) || !isFinite(+c.lng)) return [];
  const poly = (((counts.google_requests || {}).body || {}).filter || {}).locationFilter;
  const pts = (poly && poly.customArea && poly.customArea.polygon && poly.customArea.polygon.coordinates) || [];
  let r = 0;
  for (const p of pts) { const dy = (p.latitude - c.lat) * 111320, dx = (p.longitude - c.lng) * 111320 * Math.cos(c.lat * Math.PI / 180); r = Math.max(r, Math.sqrt(dx * dx + dy * dy)); }
  r = Math.min(5000, Math.max(1500, r || 2500));
  const j = await postJson("https://places.googleapis.com/v1/places:searchNearby", env.GOOGLE_MAPS_KEY,
    { includedTypes: ["school", "primary_school", "secondary_school"], maxResultCount: 10, rankPreference: "DISTANCE", locationRestriction: { circle: { center: { latitude: +c.lat, longitude: +c.lng }, radius: Math.round(r) } } },
    "places.displayName,places.businessStatus");
  // v290.3 - Google tags sports clubs, tutors and mislabelled places as schools ("Skateraati Sports Club", a Spanish "Escuela Primaria" in
  // DAMAC Hills): keep only names that say they are a school, and not a club, coaching or tuition centre
  const SCHOOLISH = /\b(school|academy|nursery|kindergarten|college|montessori|early learning)\b/i;
  const NOT_SCHOOL = /\b(club|sports?|coaching|tuition|tutor|training|driving|swim|dance|music|skate|football|cricket|escuela|ecole|colegio)\b/i;
  return [...new Set(((j && j.places) || []).filter((p) => p && p.displayName && p.displayName.text && p.businessStatus !== "CLOSED_PERMANENTLY")
    .map((p) => String(p.displayName.text).trim()).filter((n) => n && SCHOOLISH.test(n) && !NOT_SCHOOL.test(n)))];
}

// The picture a spot can give, or null. Never a URL: the Google address is built only in googleUrl(), server-side.
export function pictureOf(sp, haveKey) {
  const p = sp && sp.picture;
  if (!haveKey || !p || !(p.route in ROUTE_PREF)) return null;
  if (p.route === "places_photo") {
    // v290.2 - a stored photo name expires and the spots files carry no authors: the photo and its author are fetched fresh from the
    // place id when the card is made (freshSpot); here a place id is enough to offer the picture
    if (!p.place_id || !/^[A-Za-z0-9_-]{4,}$/.test(String(p.place_id))) return null;
    const authors = (Array.isArray(p.photo_authors) ? p.photo_authors : []).filter((a) => typeof a === "string" && a.trim());
    return { route: "places_photo", credit: authors.length ? "Photo: " + authors.slice(0, 2).join(", ") + " · Google Maps" : "Google Maps" };
  }
  if (p.route === "street_view") {
    if (!p.pano_id) return null;
    const when = monthYear(p.pano_date);
    return { route: "street_view", credit: "© Google · Street View" + (when ? ", " + when : "") };
  }
  return null;   // v298 - no satellite route
}
// the Google request for a spot's picture (server-side only; it carries the key)
export function googleUrl(sp, key, w) {
  const p = sp.picture || {}, W = Math.min(800, w || 800), H = Math.round(W * 0.5625), k = encodeURIComponent(key);
  if (p.route === "places_photo") return "https://places.googleapis.com/v1/" + String(p.photo_name).split("/").map(encodeURIComponent).join("/") + "/media?maxWidthPx=" + W + "&key=" + k;
  const sw = Math.min(640, W), sh = Math.round(sw * 0.5625);
  if (p.route === "street_view") return "https://maps.googleapis.com/maps/api/streetview?size=" + sw + "x" + sh + "&pano=" + encodeURIComponent(p.pano_id) +
    (isFinite(+p.heading) && p.heading !== "" && p.heading != null ? "&heading=" + Math.round(+p.heading) : "") + "&fov=80&return_error_code=true&key=" + k;
  return null;   // v298 - there is no Maps Static / satellite address any more
}
// v290.2 - a spot ready to fetch: for a Places photo, the place's CURRENT first photo and its author (Place Details, photos field only),
// else the same spot as a satellite picture of its position (Google's terms: a Places photo is shown with its author, so none without)
export async function freshSpot(env, spot) {
  const p = (spot && spot.picture) || {};
  if (p.route !== "places_photo") return spot;
  try {
    const ac = typeof AbortController !== "undefined" ? new AbortController() : null;
    const t = setTimeout(() => { try { ac && ac.abort(); } catch (e) {} }, 2000);   // a small JSON answer: 2 s is ample
    let j = null;
    try {
      const r = await FETCH("https://places.googleapis.com/v1/places/" + encodeURIComponent(String(p.place_id)), {
        signal: ac ? ac.signal : undefined, headers: { "X-Goog-Api-Key": env.GOOGLE_MAPS_KEY, "X-Goog-FieldMask": "photos" } });
      j = r && r.ok ? await r.json() : null;
    } finally { clearTimeout(t); }
    const ph = j && Array.isArray(j.photos) ? j.photos.find((x) => x && x.name && Array.isArray(x.authorAttributions) && x.authorAttributions.some((a) => a && a.displayName)) : null;
    if (!ph) return null;   // v298 - no author, no Places photo; and never a satellite stand-in
    return Object.assign({}, spot, { picture: Object.assign({}, p, { photo_name: ph.name, photo_authors: ph.authorAttributions.map((a) => a && a.displayName).filter(Boolean) }) });
  } catch (e) { return null; }   // timed out or unreachable: no picture (a second slow try would blow the card's time budget)
}
// fetch one picture with a short timeout; null on any failure (never throws, never echoes the URL)
async function fetchPicture(url, stream) {
  if (!url) return null;   // v298
  const ac = typeof AbortController !== "undefined" ? new AbortController() : null;
  const t = setTimeout(() => { try { ac && ac.abort(); } catch (e) {} }, PIC_TIMEOUT_MS);
  try {
    const r = await FETCH(url, { signal: ac ? ac.signal : undefined, redirect: "follow" });
    const ct = String((r && r.headers && r.headers.get("Content-Type")) || "").toLowerCase();
    if (!r || !r.ok || !/^image\/(jpeg|png|webp|gif)/.test(ct)) return null;
    if (stream && r.body) { clearTimeout(t); return { body: r.body, ct: ct.split(";")[0] }; }
    const buf = await r.arrayBuffer();
    if (!buf || !buf.byteLength || buf.byteLength > PIC_MAX_BYTES) return null;
    return { buf, ct: ct.split(";")[0] };
  } catch (e) { return null; } finally { clearTimeout(t); }
}

async function districtNames(env) {
  const out = {};
  const DG = await kvJson(env, "districts_geo");
  for (const d of (DG && DG.districts) || []) if (d && d.slug) out[d.slug] = d.name;
  for (const [s, x] of Object.entries(EXTRA_AREAS)) if (!out[s]) out[s] = x.name;
  return out;
}

const sourceLine = (spots, more) => {
  const seen = []; for (const s of spots) { const w = SOURCE_SAY[s.source] || (s.source ? String(s.source) : ""); if (w && !seen.includes(w)) seen.push(w); }
  for (const w of more || []) if (!seen.includes(w)) seen.push(w);
  return seen.length ? "Places from " + seen.join(", ") + "." : "";
};

// One card: {d, district_name, type, emoji, title, count, count_from, names, names_from, more, google_count, picture: {d, id, route,
// credit, of} | null, sources, note?, instead_of?}. count_from is null for our own records, "Google Maps" where the headline is Google's
// live count (schools); google_count is Google's live count shown beside our own (null when not asked or not answered).
const fold = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
function cardOf(d, dn, type, spots, counts, haveKey) {
  const T = AMENITY_TYPES[type];
  const mine = spots.filter((s) => s.type === type);
  const named = mine.filter((s) => !s.name_is_generic).concat(mine.filter((s) => s.name_is_generic));
  let names = [...new Set(named.map((s) => String(s.name).trim()))];
  const extra = [];   // names from the counts file: schools (OpenStreetMap + the regulator's register), stations in the district
  if (type === "school") for (const s of (counts && Array.isArray(counts.schools) ? counts.schools : [])) if (s && s.name) extra.push(String(s.name).trim());
  if (type === "metro") for (const s of (counts && Array.isArray(counts.stations) ? counts.stations : [])) if (s && s.name) extra.push(String(s.name).trim() + (s.mode === "tram" ? " (tram)" : ""));
  for (const n of extra) if (!names.some((x) => fold(x) === fold(n) || fold(x) === fold(n.replace(/ \(tram\)$/, "")))) names.push(n);
  let pic = null;
  const ranked = named.map((s, i) => ({ s, i, p: pictureOf(s, haveKey) })).filter((x) => x.p)
    .sort((a, b) => (ROUTE_PREF[a.p.route] - ROUTE_PREF[b.p.route]) || ((a.s.name_is_generic ? 1 : 0) - (b.s.name_is_generic ? 1 : 0)) || (a.i - b.i));
  if (ranked.length) pic = { d, id: ranked[0].s.id, route: ranked[0].p.route, credit: ranked[0].p.credit, of: ranked[0].s.name };
  const sources = sourceLine(mine, !extra.length ? [] : type === "school" ? [SOURCE_SAY.OpenStreetMap, SOURCE_SAY.KHDA] : [SOURCE_SAY.RTA]);
  return {
    d, district_name: dn, type, emoji: T.emoji, title: T.many + " " + T.where + " " + dn,
    count: names.length, count_from: null, names, names_from: null, more: 0, google_count: null, picture: pic, sources,
  };
}
const trimNames = (c) => { c.more = Math.max(0, c.names.length - NAMES_SHOWN); c.names = c.names.slice(0, NAMES_SHOWN); return c; };
const kmSay = (m) => (m >= 1000 ? "about " + (Math.round(m / 100) / 10) + " km" : "about " + Math.round(m / 50) * 50 + " m");

// The cards for a search: musts (the Brief's keys) x districts (at most three). Districts with no spots file give no cards.
// Google's live answers (counts, school names) are asked in parallel, each with a short timeout; any failure leaves the card without them.
export async function amenityCards(env, o) {
  const musts = [...new Set((o && o.musts) || [])].filter((m) => MUST_TO_TYPES[m]);
  const areas = [...new Set(((o && o.areas) || []).map(slugOf).filter(Boolean))].slice(0, MAX_DISTRICTS);
  if (!musts.length || !areas.length) return { cards: [], missing: [] };
  const DN = await districtNames(env);
  const haveKey = !!(env && env.GOOGLE_MAPS_KEY);
  const per = [], missing = [], live = [];
  await Promise.all(areas.map(async (d) => {
    const [S, counts] = await Promise.all([loadSpots(env, d), kvJson(env, "amenity_counts_" + d)]);
    if (!S) { missing.push(d); return; }
    const dn = (S.doc && S.doc.district_name) || DN[d] || d;
    const out = [];
    for (const m of musts) for (const type of MUST_TO_TYPES[m]) {
      if (out.some((c) => c.type === type)) continue;
      const c = cardOf(d, dn, type, S.spots, counts, haveKey);
      out.push(c);
      if (type === "metro" && !c.count) {
        const ns = counts && counts.nearest_station;
        if (ns && ns.name && isFinite(+ns.distance_from_centroid_m))
          c.note = "None inside " + dn + ". The nearest " + (ns.mode === "tram" ? "tram stop" : "metro station") + " is " + ns.name + (ns.line ? " (" + ns.line + ")" : "") + ", " + kmSay(+ns.distance_from_centroid_m) + " from the middle of " + dn + " in a straight line.";
        if (S.spots.some((s) => s.type === "bus")) out.push(Object.assign(cardOf(d, dn, "bus", S.spots, counts, haveKey), { instead_of: "metro", note: "No metro station inside " + dn + ": these are the public transport stops in the district." }));
      }
      if (haveKey && counts) {
        live.push(liveCount(env, counts, type).then((n) => { c.google_count = n; }));
        if (type === "school") live.push(liveSchools(env, counts).then((ns) => { if (ns.length) { c.names = ns; c.names_from = "Google Maps"; } }));
      }
    }
    per.push({ d, out });
  }));
  // v290.2 - each card's Places photo: fresh name and author now, so the credit under the picture names the photographer
  const spotsBy = {};
  for (const x of per) for (const c of x.out) if (haveKey && c.picture && c.picture.route === "places_photo") live.push((async () => {
    if (!spotsBy[c.d]) spotsBy[c.d] = loadSpots(env, c.d);
    const S = await spotsBy[c.d], sp = S && S.spots.find((s) => s.id === c.picture.id);
    const f = sp ? await freshSpot(env, sp) : null, fp = f && pictureOf(f, true);
    if (!fp) { c.picture = null; return; }
    c.picture.route = fp.route; c.picture.credit = fp.credit;
  })());
  await Promise.all(live);
  for (const x of per) for (const c of x.out) {
    // schools: our records are sparse, so Google's live count leads where it answered
    if (c.type === "school" && c.google_count) { c.count = c.google_count; c.count_from = "Google Maps"; c.google_count = null; }
    if (c.names_from) c.sources = "Names" + (c.count_from ? " and count" : "") + " from Google Maps, asked when this was made and not kept.";
    if (!c.google_count) c.google_count = null;   // Google answering none is not shown beside our own count (the note covers a station-less district)
    trimNames(c);
  }
  // in the order the areas were asked for
  const ordered = areas.flatMap((d) => (per.find((x) => x.d === d) || { out: [] }).out);
  return { cards: ordered, missing };
}

// ---- the routes --------------------------------------------------------------------------------------------------------------------
// h: { clientOk } from src/index.js - the Brief's own test (the owner key or a client key). Returns null for any other path.
export async function amenityRoutes(request, env, url, h) {
  if (url.pathname !== "/amenity_cards" && url.pathname !== "/amenity_photo") return null;
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("method not allowed", { status: 405 });
  if (!h || typeof h.clientOk !== "function" || !h.clientOk(env, url)) return new Response("unauthorized", { status: 401 });
  const sp = url.searchParams;
  if (url.pathname === "/amenity_cards") {
    const list = (k) => String(sp.get(k) || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    const out = await amenityCards(env, { areas: list("areas"), musts: list("musts").map((m) => (m === "pool" ? "community_pool" : m)) });
    return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
  }
  const none = (why) => new Response(why, { status: 404, headers: { "Cache-Control": "no-store" } });
  const d = slugOf(sp.get("d")), id = String(sp.get("id") || "").slice(0, 200);
  if (!d || !id) return none("no picture");
  if (!env.GOOGLE_MAPS_KEY) return none("no picture");
  const S = await loadSpots(env, d);
  const spot = S && S.spots.find((s) => String(s.id) === id);
  if (!spot || !pictureOf(spot, true)) return none("no picture");
  const fsp = await freshSpot(env, spot);   // v290.2 - fresh photo name
  if (!fsp) return none("no picture");
  const pic = await fetchPicture(googleUrl(fsp, env.GOOGLE_MAPS_KEY, 800), true);
  if (!pic) return none("no picture");
  return new Response(pic.body, { headers: { "Content-Type": pic.ct, "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
}

// ---- the PDF: "Around the community" -----------------------------------------------------------------------------------------------
// chrome comes from src/brief_docs.js so this page wears the documents' own frame: { landPage(inner), footer, logo, today, fitImg, jpegSize }
const NAVY = "#17283F", GOLD = "#A8814A", MUTED = "#626B78", INK = "#22262B";   // = brief_docs.js
const b64 = (buf) => { const u = new Uint8Array(buf); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const PER_PAGE = 8, COLS = 4;

export async function amenityDocPages(env, q, recs, chrome) {
  const areas = (q.areas && q.areas.length ? q.areas : [...new Set((recs || []).map((r) => r.d).filter(Boolean))]).slice(0, MAX_DISTRICTS);
  const { cards } = await amenityCards(env, { areas, musts: q.musts || [] });
  if (!cards.length) return "";
  // the pictures, all at once, each with its own short timeout; a failure leaves that card without one
  const S = {};
  await Promise.all([...new Set(cards.filter((c) => c.picture).map((c) => c.d))].map(async (d) => { S[d] = await loadSpots(env, d); }));
  await Promise.all(cards.map(async (c) => {
    if (!c.picture || !env.GOOGLE_MAPS_KEY) { c.picture = null; return; }
    const spot = S[c.d] && S[c.d].spots.find((s) => s.id === c.picture.id);
    const fsp = spot ? await freshSpot(env, spot) : null;   // v290.2
    const got = fsp ? await fetchPicture(googleUrl(fsp, env.GOOGLE_MAPS_KEY, 640), false) : null;
    if (!got) { c.picture = null; return; }
    const dim = /jpe?g/.test(got.ct) && chrome && chrome.jpegSize ? chrome.jpegSize(got.buf) : null;
    c.picture.src = "data:" + got.ct + ";base64," + b64(got.buf);
    if (dim) { c.picture.w = dim.w; c.picture.h = dim.h; }
  }));
  const cardW = (1063 - 10 * (COLS - 1)) / COLS - 2, picH = 150;
  const cardHtml = (c) => {
    const pic = c.picture && c.picture.src
      ? (chrome && chrome.fitImg ? chrome.fitImg({ src: c.picture.src, w: c.picture.w, h: c.picture.h }, cardW, picH, c.picture.of || c.title)
        : '<img src="' + c.picture.src + '" alt="' + esc(c.title) + '" style="width:' + cardW + "px;height:" + picH + 'px;object-fit:cover;display:block;">') +
        '<div class="acredit" style="font-size:8px;color:' + MUTED + ';padding:2px 8px 0 8px;">' + esc(c.picture.credit) + "</div>" : "";
    const names = c.names.length ? esc(c.names.join(", ")) + (c.more ? " and " + c.more + " more" : "") : "";
    return '<div class="acard" style="border:1px solid #E6E1D8;background:#FFF;display:flex;flex-direction:column;overflow:hidden;min-height:0;">' + pic +
      '<div style="padding:7px 9px 8px 9px;display:flex;flex-direction:column;gap:3px;">' +
      '<div class="serif" style="font-size:15px;color:' + NAVY + ';line-height:1.15;">' + c.emoji + " " + esc(c.title) + "</div>" +
      '<div style="display:flex;align-items:baseline;gap:6px;"><span class="serif" style="font-size:22px;color:' + GOLD + ';">' + c.count + '</span><span style="font-size:9.5px;color:' + MUTED + ';">' +
      (c.count_from ? "in the district &middot; " + esc(c.count_from) : c.count ? "found" : "found in the records we hold, which is not proof there are none") + "</span></div>" +
      (names ? '<div style="font-size:9.8px;color:' + INK + ';line-height:1.3;">' + names + (c.names_from ? ' <span style="color:' + MUTED + ';font-size:8.5px;">(names: ' + esc(c.names_from) + ")</span>" : "") + "</div>" : "") +
      (c.note ? '<div style="font-size:9px;color:' + MUTED + ';line-height:1.3;">' + esc(c.note) + "</div>" : "") +
      (c.google_count != null ? '<div style="font-size:9px;color:' + MUTED + ';">' + c.google_count + " in the whole district &middot; Google Maps</div>" : "") +
      (c.sources ? '<div style="font-size:8px;color:' + MUTED + ';line-height:1.3;">' + esc(c.sources) + "</div>" : "") + "</div></div>";
  };
  const dn = [...new Set(cards.map((c) => c.district_name))];
  let out = "";
  for (let i = 0; i < cards.length; i += PER_PAGE) {
    const part = cards.slice(i, i + PER_PAGE), rows = Math.ceil(part.length / COLS);
    const inner = '<div style="height:74px;display:flex;align-items:center;justify-content:space-between;padding:0 30px;background:#FFF;border-bottom:1px solid #E6E1D8;flex-shrink:0;">' +
      '<div style="display:flex;flex-direction:column;gap:3px;"><div class="serif" style="font-size:24px;color:' + NAVY + ';line-height:1;">Around the community</div>' +
      '<div style="font-size:11px;color:' + MUTED + ';">' + ((chrome && chrome.today) || "") + " &middot; " + esc(dn.join(" · ")) + " &middot; what the client asked for, place by place</div></div>" + ((chrome && chrome.logo) || "") + "</div>" +
      '<div class="aroundpage" style="flex:1;display:grid;grid-template-columns:repeat(' + COLS + ',minmax(0,1fr));grid-template-rows:repeat(' + rows + ',minmax(0,auto));align-content:start;gap:10px;padding:12px 30px 4px 30px;min-height:0;overflow:hidden;">' +
      part.map(cardHtml).join("") + "</div>" +
      '<div style="padding:0 30px 4px 30px;font-size:8.3px;color:' + MUTED + ';line-height:1.3;">Counts are the places in the records we hold for each district; a place missing from them may still exist. Figures marked Google Maps are Google&#x27;s own count for the whole district, asked when this document was made. ' +
      "Pictures are fetched from Google when this document is made and are not kept.</div>" + ((chrome && chrome.footer) || "");
    out += chrome && chrome.landPage ? chrome.landPage(inner) : '<div class="sheet page land" style="width:1123px;height:794px;">' + inner + "</div>";
  }
  return out;
}
// Where the page goes: at the end of Compare; in a Full pack, before the appendix (the pack's last portrait page)
export async function withAmenityPages(env, q, C, html, chrome) {
  if (!(q && (q.kind === "compare" || q.kind === "pack") && (q.musts || []).some((m) => MUST_TO_TYPES[m]))) return html;
  let pages = "";
  try { pages = await amenityDocPages(env, q, (C && C.recs) || [], chrome); } catch (e) { return html; }
  if (!pages) return html;
  if (q.kind === "pack") { const at = html.lastIndexOf('<div class="sheet page">'); if (at > 0) return html.slice(0, at) + pages + html.slice(at); }
  return html + pages;
}

// ---- the page: CSS and script, appended to the Brief page (src/brief_page.js) -------------------------------------------------------
export const AMENITY_CARDS_CSS = '.amen{margin:12px 0 6px}.amen .lb{margin:0 0 8px}'
  + '.acard{background:#101D1B;border:1px solid #24352F;border-left:3px solid #0A4F4A;border-radius:12px;overflow:hidden;margin:0 0 10px}'
  + '.acard figure{margin:0;background:#0A4F4A}.acard img{display:block;width:100%;aspect-ratio:2/1;object-fit:cover;background:#0E1918}'
  + '.acard figcaption{font-size:.62rem;color:#8FA39B;padding:3px 12px 0;line-height:1.35}'
  + '.acard .ab{padding:9px 12px 11px;min-width:0}.acard .at{font-family:Fraunces,Georgia,serif;font-size:1rem;font-weight:600;color:#F0E4C8;line-height:1.25}'
  + '.acard .an{font-size:.8rem;color:#C8D3CE;margin:4px 0 0}.acard .an b{font-family:Fraunces,Georgia,serif;font-size:1.35rem;color:#C5A56A;margin-right:5px}'
  + '.acard .al{font-size:.8rem;line-height:1.45;color:#D8E1DD;margin:4px 0 0;overflow-wrap:anywhere}.acard .ao{font-size:.72rem;color:#A9B7B2;margin:4px 0 0;line-height:1.4}'
  + '.acard small{display:block;font-size:.64rem;color:#6F837D;margin:5px 0 0;line-height:1.4}'
  + '.acard .af{color:#8FA39B;font-size:.68rem}.acard .gc{color:#C5A56A;font-weight:600}'
  + '@media (min-width:540px){.amen .ag{display:grid;grid-template-columns:1fr 1fr;gap:10px}.amen .acard{margin:0}}';

// Plain ES5, no ${} and no backticks (the same rule as BRIEF_JS). Exposes window.__amenCards(st, res, key), which drawRes() calls.
export const AMENITY_CARDS_JS = String.raw`
(function(){
var CACHE={},SEQ=0;
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
var MUSTS={pets:1,community_pool:1,gym:1,schools:1,metro:1};
function areasOf(st,res){var a=(st.areas||[]).slice(0,3);if(a.length)return a;var out=[];((res&&res.results)||[]).forEach(function(r){if(r.district&&out.indexOf(r.district)<0&&out.length<3)out.push(r.district)});return out}
function cardHtml(c,key){var p=c.picture,img="";
  if(p&&p.id)img="<figure><img alt=\""+esc(p.of||c.title)+"\" loading=lazy src=\"/amenity_photo?key="+encodeURIComponent(key)+"&d="+encodeURIComponent(p.d)+"&id="+encodeURIComponent(p.id)+"\"><figcaption>"+esc(p.credit)+"</figcaption></figure>";
  var names=c.names&&c.names.length?esc(c.names.join(", "))+(c.more?" and "+c.more+" more":""):"";
  return "<div class=acard data-t=\""+esc(c.type)+"\" data-d=\""+esc(c.d)+"\">"+img+"<div class=ab><div class=at><span class=ic aria-hidden=true>"+esc(c.emoji)+"</span>"+esc(c.title)+"</div>"
    +"<div class=an><b>"+(+c.count||0)+"</b>"+(c.count_from?"in the district · "+esc(c.count_from):(c.count?"found":"found in the records we hold, which is not proof there are none"))+"</div>"
    +(names?"<div class=al>"+names+(c.names_from?" <span class=af>(names: "+esc(c.names_from)+")</span>":"")+"</div>":"")+(c.note?"<div class=ao>"+esc(c.note)+"</div>":"")
    +(c.google_count!=null?"<div class=ao><b class=gc>"+(+c.google_count)+"</b> in the whole district · Google Maps</div>":"")
    +(c.sources?"<small>"+esc(c.sources)+"</small>":"")+"</div></div>"}
function draw(box,j,key){if(!j||!j.cards||!j.cards.length){box.innerHTML="";box.hidden=true;return}
  box.hidden=false;box.innerHTML="<div class=lb>AROUND THE COMMUNITY <b>what they asked for</b></div><div class=ag>"+j.cards.map(function(c){return cardHtml(c,key)}).join("")+"</div>";
  var imgs=box.querySelectorAll("img");for(var i=0;i<imgs.length;i++)imgs[i].onerror=function(){var f=this.parentNode;if(f&&f.parentNode)f.parentNode.removeChild(f)}}
window.__amenCards=function(st,res,key){try{
  var bres=document.getElementById("bres");if(!bres||!st)return;
  var old=document.getElementById("bamen");if(old&&old.parentNode)old.parentNode.removeChild(old);
  var musts=(st.musts||[]).filter(function(m){return MUSTS[m]});var areas=areasOf(st,res);
  if(!musts.length||!areas.length)return;
  var box=document.createElement("div");box.id="bamen";box.className="amen";box.hidden=true;
  var at=bres.querySelector(".sa");if(at)bres.insertBefore(box,at);else return;
  var q="areas="+areas.map(encodeURIComponent).join(",")+"&musts="+musts.join(",");
  if(CACHE[q]){draw(box,CACHE[q],key);return}
  var my=++SEQ;
  fetch("/amenity_cards?key="+encodeURIComponent(key)+"&"+q).then(function(r){if(!r.ok)throw r.status;return r.json()}).then(function(j){CACHE[q]=j;if(my!==SEQ)return;var b=document.getElementById("bamen");if(b)draw(b,j,key)}).catch(function(){})
}catch(e){}};
})();
`;
