// ADVERTISED SUPPLY (v279, Kendall, 1 Oct 2026) - the third card on START, beside the Brief and CONTRACTS SIGNED.
//
// OWNER ONLY. Drawn on START for the owner key (READ_KEY, keyTier "admin") and nothing else; every /supply route answers 404 to a
// client key, to no key and to anything that is not the owner key. It is never put in a PDF, a card a client sees, a share link
// or a message. The label everywhere: "Advertised supply · live rental adverts from listing sites, not vacancy", with the fetch time.
//
// It is ADVERTS, not homes free: one home can be advertised on several sites and by several agents (listings_live is the total
// after de-duplication across sites), an advert can outlive the letting, and a home can let without ever being advertised.
// "Delisted since last crawl" is a rough sign of letting and is labelled that way.
//
// THE DATA (built by the DDA session's crawler on the office laptop; this worker never crawls):
//   img_pf_supply_<district>  {as_of, measure, rows:[{key, dld_project, building_slug, pf_name, beds_band, listings_live, sources:{site:n},
//                              median_price, median_days_listed, delisted_since_last, first_seen_min, crawled_at, pf_url}]}
// SUPPLY_FIELDS is the one place the field names live (a rename is a one-line change); `sources` is read as whatever sites it
// names, so a listing site added later is no code change. A row with no `key` is a listing site's building that is NOT matched to
// ours: it is shown under the site's own name only, and never matched by guess.
//
// ON-DEMAND REFRESH (the worker cannot crawl, and must not). The contract with the DDA session's poller on the office laptop:
//   POST /supply/request?district=<slug>[&slug=<building_slug>]  owner key only; writes
//        pf_req_<uuid>  = {district, building_slug (the listing site's SEO tail, or null for the whole district), requested_at}
//   the poller takes it:   pf_take_<uuid> = {taken_at, host}
//   and finishes it:       pf_done_<uuid> = {status: ok | held_by_daily_chain | error, as_of, district, building_slug, image, seconds, note}
//   GET /supply/status?id=<uuid> turns those into one state:
//        done ok -> done (the page reloads the fresh copy) · held_by_daily_chain -> deferred "available after the morning refresh"
//        error -> error (offer re-request) · taken, not done, 30 min on -> failed (offer re-request) · taken -> fetching
//        not taken while another request is running -> queued · not taken 90 s on, nothing running -> offline
//        ("the office computer is offline; showing the last saved copy")
// One request runs at a time. A building takes up to about 5 minutes, a whole district about 35, so the page says "this takes a
// while, we'll keep it here", remembers the request in this browser and picks the polling back up when the page is reopened.
// The button is never dead: every state ends on a sentence, and the failures offer "Request again".
import { BRIEF_DISTRICTS } from "./brief_page.js";
import { advertisedDoc, advertisedFor, advertisedHtml, permitLink, ADV_CSS, IC_PERMIT } from "./advertised.js";   // v444 ADVERTISED NOW (Property Finder): flats, adverts, gone - beside developer availability, never added

export const SUPPLY_LABEL = "Advertised supply \u00b7 live rental adverts from listing sites, not vacancy";
export const SUPPLY_KV = { file: (d) => "img_pf_supply_" + d, prefix: "img_pf_supply_", req: (id) => "pf_req_" + id, take: (id) => "pf_take_" + id, done: (id) => "pf_done_" + id, queue: "pf_queue" };
// canonical name -> the field name(s) in the crawler's rows, first present wins
export const SUPPLY_FIELDS = {
  key: ["key"], project: ["dld_project"], slug: ["building_slug"], siteName: ["listing_name", "pf_name"], band: ["beds_band", "beds"],
  live: ["listings_live"], sources: ["sources"], price: ["median_price"], days: ["median_days_listed"], delisted: ["delisted_since_last"],
  firstSeen: ["first_seen_min"], crawled: ["crawled_at"], urls: ["urls", "source_urls"], pfUrl: ["pf_url"]
};
const BANDS = ["studio", "1", "2", "3+"];
const BAND_SAY = { studio: "Studio", "1": "1 bedroom", "2": "2 bedrooms", "3+": "3 or more" };
const BAND_IN = { studio: "studio", "0": "studio", "1": "1", "2": "2", "3": "3+", "3+": "3+", "4": "3+", "4+": "3+", "5": "3+" };
const SITE_SAY = { propertyfinder: "Property Finder", pf: "Property Finder", bayut: "Bayut", dubizzle: "Dubizzle" };
export const siteSay = (s) => SITE_SAY[String(s).toLowerCase().replace(/[^a-z]/g, "")] || String(s).replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const present = (v) => v !== undefined && v !== null && !(typeof v === "string" && v.trim() === "");
const pickF = (o, names) => { for (const f of names) if (present(o[f])) return o[f]; return null; };
const num = (v) => { if (!present(v)) return null; const n = Number(v); return isFinite(n) ? n : null; };
const str = (v) => present(v) ? String(v).replace(/\s+/g, " ").trim() : "";
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const safeJson = (o) => JSON.stringify(o).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
const fmt = (n) => Math.round(n || 0).toLocaleString("en-US");
const aed = (v) => v == null ? "\u2014" : (v >= 1e6 ? "AED " + (v / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M" : "AED " + Math.round(v / 1e3) + "k");
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// a crawl time in Dubai time: "1 Oct, 09:40"
export function dubaiTime(iso) {
  const t = Date.parse(iso || ""); if (!isFinite(t)) return "";
  const d = new Date(t + 4 * 3600000);
  return d.getUTCDate() + " " + MON[d.getUTCMonth()] + ", " + String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0");
}
const httpUrl = (u) => /^https:\/\/[^\s"<>]+$/.test(String(u || "")) ? String(u) : "";

// one row, whatever the crawler calls things
export function supplyRow(raw) {
  if (!raw || typeof raw !== "object") return null;
  const g = (c) => pickF(raw, SUPPLY_FIELDS[c]);
  const src = g("sources"), sources = {};
  if (src && typeof src === "object" && !Array.isArray(src)) for (const k of Object.keys(src)) { const n = num(src[k]); if (n != null && n > 0) sources[k] = n; }
  const urls = {}, u = g("urls");
  if (u && typeof u === "object" && !Array.isArray(u)) for (const k of Object.keys(u)) { const h = httpUrl(u[k]); if (h) urls[k] = h; }
  const pf = httpUrl(g("pfUrl")); if (pf && !Object.keys(urls).some((k) => /property ?finder|^pf$/i.test(siteSay(k)) || /^pf$/i.test(k))) urls.propertyfinder = pf;
  let live = num(g("live"));
  if (live == null) { const v = Object.values(sources); live = v.length ? Math.max(...v) : 0; }   // no de-duplicated total: the biggest single site, never the sum
  return {
    key: str(g("key")), project: str(g("project")), slug: str(g("slug")), siteName: str(g("siteName")),
    band: BAND_IN[str(g("band")).toLowerCase()] || null, live, sources, urls,
    price: num(g("price")), days: num(g("days")), delisted: num(g("delisted")), firstSeen: str(g("firstSeen")), crawled: str(g("crawled"))
  };
}
// v288 - how much of the district the bound listing-site locations cover (the crawler's `coverage`, additive), and the adverts by
// home type (`home_types`, {Villa: n, Townhouse: n, Apartment: n, ...}). Both optional: a file without them draws as before.
export function supplyCoverage(c) {
  if (!c || typeof c !== "object" || Array.isArray(c)) return null;
  const total = num(c.register_total), bound = num(c.register_bound);
  if (total == null || bound == null || total <= 0 || bound < 0 || bound > total) return null;
  const ca = c.community_adverts && typeof c.community_adverts === "object" ? c.community_adverts : null;
  const shown = ca ? num(ca.total) : null, captured = ca ? num(ca.captured) : null;
  return { total, bound, withAdverts: num(c.register_with_adverts), outside: num(c.bound_locations_outside_register) || 0,
    siteTotal: shown != null && shown > 0 && captured != null ? shown : null, captured: shown != null && shown > 0 ? captured : null,
    community: ca ? str(ca.community_name) : "" };
}
export function supplyHomeTypes(h) {
  if (!h || typeof h !== "object" || Array.isArray(h)) return [];
  return Object.keys(h).map((t) => ({ type: str(t), n: num(h[t]) })).filter((x) => x.type && x.n != null && x.n > 0).sort((a, b) => b.n - a.n || a.type.localeCompare(b.type));
}
export function supplyDoc(doc) {
  if (!doc || !Array.isArray(doc.rows)) return null;
  return { asOf: str(doc.as_of), measure: str(doc.measure), rows: doc.rows.map(supplyRow).filter(Boolean),
    coverage: supplyCoverage(doc.coverage), homeTypes: supplyHomeTypes(doc.home_types),
    sourceSay: str(doc.source_say), sites: num(doc.sites) > 0 ? num(doc.sites) : 0, srcs: supplySources(doc.sources), adverts: supplyAdverts(doc.adverts), advertised: advertisedDoc(doc) };
}
// v414 - the individual adverts behind each count (pf_listings.py `adverts`, 9 Oct 2026): {slug: {band: [{id, p, sq, t, f, d, lat, lon, u}]}}.
// Additive: an old file has none and the card shows the counts table only. u is kept only when it is an https page on propertyfinder.ae.
const PF_HOST = /^https:\/\/www\.propertyfinder\.ae\/[^\s"'<>]*$/;
const UAE_TEL = /^\+971\d{8,9}$/;
export function supplyAdverts(a) {
  const out = {};
  if (!a || typeof a !== "object") return out;
  for (const slug of Object.keys(a)) {
    const bs = a[slug]; if (!bs || typeof bs !== "object") continue;
    for (const band of Object.keys(bs)) {
      const l = Array.isArray(bs[band]) ? bs[band] : [];
      const xs = l.filter((x) => x && typeof x === "object").map((x) => ({
        id: str(x.id), price: num(x.p), sqft: num(x.sq), type: str(x.t), furnished: str(x.f), listed: str(x.d),
        lat: num(x.lat), lon: num(x.lon), url: typeof x.u === "string" && PF_HOST.test(x.u) ? x.u : "",
        // v442 - the listing broker (Kendall 9 Oct 2026): only a well-formed UAE number becomes a button
        agent: str(x.an).slice(0, 80), agency: str(x.ag).slice(0, 80), phone: UAE_TEL.test(str(x.ph)) ? str(x.ph) : "", wa: UAE_TEL.test(str(x.wa)) ? str(x.wa) : "",
        // v444 - the advert's own DLD permit check (https dubailand.gov.ae only) and its distinct-flat number in the building
        permit: permitLink(x.ck), flat: num(x.fl) }));
      if (xs.length) (out[slug] || (out[slug] = {}))[band] = xs;
    }
  }
  return out;
}
// attach each building's adverts by band (a building can group several site slugs) and the district frame for the mini map
export function attachAdverts(buildings, adverts) {
  let s = 90, w = 180, n = -90, e = -180;
  for (const b of buildings) {
    const ads = {};
    for (const slug of b.slugs || (b.slug ? [b.slug] : [])) {
      const bs = adverts[slug]; if (!bs) continue;
      for (const band in bs) (ads[band] || (ads[band] = [])).push(...bs[band]);
    }
    for (const band in ads) { ads[band].sort((x, y) => (x.price == null) - (y.price == null) || (x.price || 0) - (y.price || 0)); for (const x of ads[band]) if (x.lat != null && x.lon != null) { s = Math.min(s, x.lat); n = Math.max(n, x.lat); w = Math.min(w, x.lon); e = Math.max(e, x.lon); } }
    b.ads = ads;
  }
  return n >= s ? { s, w, n, e } : null;
}
// v313 - where the data come from. The crawler's `sources` [{site, url, what, fetched, method}] and `source_say` are additive: an old
// file has neither, and then the line says what we can know (Property Finder, the crawl time) and never a number of sites.
export function supplySources(a) {
  if (!Array.isArray(a)) return [];
  return a.filter((x) => x && typeof x === "object" && str(x.site)).map((x) => ({ site: str(x.site), url: httpUrl(x.url), what: str(x.what), fetched: str(x.fetched) }));
}
export function sourceLine(D) {
  if (!D) return "";
  if (D.sourceSay) return D.sourceSay;
  const l = D.srcs || [];
  if (l.length) {
    const names = [...new Set(l.map((x) => siteSay(x.site)))], f = l.map((x) => x.fetched).find(Boolean) || D.asOf || dubaiTime(D.crawled);
    const what = l.map((x) => x.what).find(Boolean);
    return names.join(" and ") + " rental adverts, fetched " + f + (what ? "; " + what : "") + ". Not vacancy; research only.";
  }
  const t = dubaiTime(D.crawled) || D.asOf;
  return "Property Finder rental adverts" + (t ? ", fetched " + t : "");
}
// v313 - the registered projects with no advert location matched (img_pf_unbound_<district>, owner only, optional)
export function unboundDoc(doc) {
  if (!doc || !Array.isArray(doc.projects)) return null;
  const ps = doc.projects.filter((p) => p && typeof p === "object" && str(p.project)).map((p) => ({
    name: str(p.project), plots: num(p.land_plots), sales: num(p.sales_all_time), sales12: num(p.sales_last_12m), salesMed: num(p.sales_median_price_last_12m),
    contracts: num(p.ejari_contracts_all_time), lets12: num(p.ejari_new_lettings_last_12m), letMed: num(p.ejari_new_median_annual_rent_last_12m) }));
  return ps.length ? { asOf: str(doc.as_of), why: str(doc.why_not_listed), projects: ps } : null;
}
const aedM = (v) => v >= 1e6 ? "AED " + (v / 1e6).toFixed(1) + "m" : "AED " + fmt(v);
export function unboundSay(p) {
  const n = (v) => v || 0, out = [];
  if (!n(p.sales)) out.push("no sales recorded");
  else out.push(fmt(p.sales) + (p.sales === 1 ? " sale" : " sales") + " recorded, " + (n(p.sales12) ? fmt(p.sales12) + " in the last 12 months" + (p.salesMed != null ? " at a median " + aedM(p.salesMed) : "") : "none in the last 12 months"));
  if (n(p.lets12)) out.push(fmt(p.lets12) + (p.lets12 === 1 ? " new letting" : " new lettings") + " in 12 months" + (p.letMed != null ? " at a median AED " + fmt(p.letMed) : ""));
  else if (n(p.contracts)) out.push("no new lettings in the last 12 months (" + fmt(p.contracts) + " rental contracts on record)");
  else out.push("no lettings recorded");
  return out.join("; ");
}
export function unboundHtml(u) {
  if (!u) return "";
  return '<div class=hd id=suunb>Registered here, no advert location matched</div>'
    + '<div class=dk>' + fmt(u.projects.length) + " registered " + (u.projects.length === 1 ? "project" : "projects") + " with no advert location matched, so no advert count is shown. They are still sold and let; these figures come from the Dubai Land Department register"
    + (u.asOf ? " (as of " + esc(u.asOf) + ")" : "") + ". Research only.</div>"
    + u.projects.map((p) => '<div class=card><div class=nm>' + esc(p.name) + "</div>"
      + (p.plots ? '<div class=sb>' + fmt(p.plots) + (p.plots === 1 ? " land plot" : " land plots") + "</div>" : "")
      + '<div class=dk>' + esc(unboundSay(p)) + ".</div></div>").join("");
}
const HOME_SAY = { villa: "Villas", townhouse: "Townhouses", apartment: "Apartments", penthouse: "Penthouses", duplex: "Duplexes", "hotel apartment": "Hotel apartments" };
const homeSay = (t) => HOME_SAY[String(t).toLowerCase()] || String(t);
// "Covers 35 of 46 registered projects in this district · 1,180 of the 1,433 adverts the listing site shows for Damac Hills"
export function coverageHtml(cv) {
  if (!cv) return "";
  return '<div class=dk id=sucov>Covers <b>' + fmt(cv.bound) + "</b> of " + fmt(cv.total) + " registered projects in this district (Dubai Land Department register)"
    + (cv.siteTotal ? " · " + fmt(cv.captured) + " of the " + fmt(cv.siteTotal) + " adverts the listing site shows for " + esc(cv.community || "the community") : "") + ".</div>";
}
export function homeTypesHtml(hs) {
  if (!hs || !hs.length) return "";
  return '<div class=st id=suhome>' + hs.map((h) => "<span>" + esc(homeSay(h.type)) + " <b>" + fmt(h.n) + "</b></span>").join("") + "</div>";
}
// the median of per-band medians, weighted by adverts
function wmed(pairs) {
  const p = pairs.filter((x) => x[0] != null && x[1] > 0).sort((a, b) => a[0] - b[0]);
  const tot = p.reduce((s, x) => s + x[1], 0); if (!tot) return null;
  let c = 0; for (const x of p) { c += x[1]; if (c >= tot / 2) return x[0]; }
  return p[p.length - 1][0];
}
// rows -> buildings. A matched building groups on our key; an unmatched one on the site's own name, and stays that name.
export function supplyBuildings(rows, district, names) {
  const g = new Map();
  for (const r of rows) {
    const k = r.key || (r.siteName ? "site:" + r.siteName.toLowerCase() : (r.slug ? "slug:" + r.slug : ""));
    if (!k) continue;
    const b = g.get(k) || { id: k, matched: !!r.key, key: r.key, slug: r.slug, name: (r.key && names && names.get(r.key)) || r.project || r.siteName || r.slug, siteName: r.siteName, project: r.project,
      district, live: 0, sources: {}, urls: {}, bands: {}, crawled: "", delisted: 0, slugs: [] };
    if (r.slug && !b.slugs.includes(r.slug)) b.slugs.push(r.slug);
    b.live += r.live || 0; b.delisted += r.delisted || 0;
    for (const s in r.sources) b.sources[s] = (b.sources[s] || 0) + r.sources[s];
    for (const s in r.urls) if (!b.urls[s]) b.urls[s] = r.urls[s];
    if (r.crawled > b.crawled) b.crawled = r.crawled;
    if (r.band) { const x = b.bands[r.band] || (b.bands[r.band] = { live: 0, price: [], days: [], delisted: 0, sources: {} }); x.live += r.live || 0; x.delisted += r.delisted || 0;
      if (r.price != null) x.price.push([r.price, r.live || 1]); if (r.days != null) x.days.push([r.days, r.live || 1]); for (const s in r.sources) x.sources[s] = (x.sources[s] || 0) + r.sources[s]; }
    g.set(k, b);
  }
  return [...g.values()].map((b) => Object.assign(b, {
    bandRows: BANDS.filter((k) => b.bands[k]).map((k) => ({ band: k, label: BAND_SAY[k], live: b.bands[k].live, price: wmed(b.bands[k].price), days: wmed(b.bands[k].days), delisted: b.bands[k].delisted })),
    siteCount: Object.keys(b.sources).length
  })).sort((a, b) => b.live - a.live || a.name.localeCompare(b.name));
}

// ---- reading ----
async function kvJsonAny(env, k) {   // v283.1 - plain or gzipped (1f 8b) JSON; push_ejari gzips values over 1 MB
  if (!env || !env.MEETINGS) return null;
  let v = null; try { v = await env.MEETINGS.get(k, "arrayBuffer"); } catch (e) { return null; }
  if (v == null) return null;
  try {
    if (typeof v === "string") return JSON.parse(v);
    let u8 = new Uint8Array(v);
    if (u8.length > 2 && u8[0] === 0x1f && u8[1] === 0x8b) u8 = new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
    return JSON.parse(new TextDecoder().decode(u8));
  } catch (e) { return null; }
}
async function readJson(env, k) { return kvJsonAny(env, k); }
async function supplyDistricts(env) {
  try { const l = await env.MEETINGS.list({ prefix: SUPPLY_KV.prefix }); return ((l && l.keys) || []).map((k) => k.name.slice(SUPPLY_KV.prefix.length)).filter((s) => /^[a-z0-9]{2,40}$/.test(s)); } catch (e) { return []; }
}
function districtNames() { const o = {}; for (const r of BRIEF_DISTRICTS) o[r[0]] = r[1]; return o; }
async function appNames(env) {
  const out = new Map(), ri = await readJson(env, "img_rent_index");
  for (const it of (ri && ri.items) || []) { if (!it || !it.d || !it.n) continue; for (const id of [it.i].concat(Array.isArray(it.is) ? it.is : [])) if (id != null && !out.has(it.d + ":" + id)) out.set(it.d + ":" + id, String(it.n)); }
  return out;
}
async function loadDistrict(env, slug, names) {
  const doc = supplyDoc(await readJson(env, SUPPLY_KV.file(slug)));
  if (!doc) return null;
  const bs = supplyBuildings(doc.rows, slug, names);
  const frame = attachAdverts(bs, doc.adverts || {});
  for (const b of bs) { b.frame = frame; b.advertised = advertisedFor(doc.advertised, b.slugs, Object.fromEntries(b.bandRows.map((r) => [r.band, { live: r.live, days: r.days }]))); }
  const crawled = bs.reduce((m, b) => (b.crawled > m ? b.crawled : m), "") || doc.asOf;
  return { slug, asOf: doc.asOf, crawled, buildings: bs, coverage: doc.coverage, homeTypes: doc.homeTypes, sourceSay: doc.sourceSay, sites: doc.sites, srcs: doc.srcs };
}
async function withUnbound(env, D) { if (D) D.unbound = unboundDoc(await readJson(env, "img_pf_unbound_" + D.slug)); return D; }
// one summary for the START card: the latest crawl and the adverts on record
export async function supplySummary(env) {
  const ds = await supplyDistricts(env);
  if (!ds.length) return { ok: false };
  let crawled = "", live = 0, sites = new Set(), buildings = 0, say = "", nsites = 0;
  for (const d of ds) { const x = await loadDistrict(env, d, null); if (!x) continue; if (x.crawled > crawled) { crawled = x.crawled; say = sourceLine(x); } nsites = Math.max(nsites, x.sites || 0); for (const b of x.buildings) { live += b.live; buildings++; Object.keys(b.sources).forEach((s) => sites.add(s)); } }
  return { ok: !!buildings, crawled, crawled_say: dubaiTime(crawled), live, sites: Math.max(sites.size, nsites), source_say: say, buildings, districts: ds.length };
}

// ---- the START card (owner only: index.js draws it only for the owner key) ----
const SUPPLY_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="#E3C88F" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden=true><path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/><path d="M2.5 20h19"/><circle cx="18.5" cy="5.5" r="2.2" fill="#E3C88F" stroke="none"/></svg>';
export function supplyStartCard(key) {
  const boot = { key: key || "" };
  return '<div class=sustart id=supply0><div class="ejc suc">'   // the rule above it is drawn by src/start_page.js (owner key only)
    + '<div class=ejh><div class="ic suic">' + SUPPLY_SVG + '</div><div><b>What\u2019s advertised, where</b><span id=susub>' + esc(SUPPLY_LABEL) + '</span><span id=susrc style="display:block;margin-top:3px"></span></div></div>'
    + '<form class=ejf method=get action="/supply"><input type=hidden name=key value="' + esc(key || "") + '"><input class=ejin type=search name=q autocomplete=off enterkeyhint=search placeholder="A building or a district" aria-label="search a building or a district"><button type=submit class=ejgo aria-label="search">\u2192</button></form>'
    + "</div><script>window.__SUS=" + safeJson(boot) + ";</script><script>" + SUPPLY_START_JS + "</script></div>";
}
export const SUPPLY_START_CSS = '.sustart{position:relative;z-index:1;margin:0}.suc{border-color:#3A3222}.suic{background:rgba(197,165,106,.16)!important}';
export const SUPPLY_START_JS = String.raw`
(function(){
var P=window.__SUS||{},el=document.getElementById("susub"),sr=document.getElementById("susrc");if(!el)return;
fetch("/supply/summary?key="+encodeURIComponent(P.key||""),{credentials:"same-origin"}).then(function(r){return r.ok?r.json():{ok:false}}).then(function(j){
  if(!j||!j.ok){el.textContent="Advertised supply \u00b7 live rental adverts from listing sites, not vacancy \u00b7 nothing fetched yet";return}
  el.textContent=Math.round(j.live).toLocaleString("en-US")+" adverts"+(j.sites>0?" across "+j.sites+(j.sites===1?" site":" sites"):"")+" \u00b7 fetched "+j.crawled_say+" \u00b7 live rental adverts from listing sites, not vacancy";if(sr&&j.source_say)sr.textContent="Source: "+j.source_say},function(){});
})();
`;

// ---- the page ----
const SU_CSS = 'body{background:#0C1413;color:#E8E4D8;font-family:"IBM Plex Sans",system-ui,sans-serif;margin:0;padding:14px 14px 110px;max-width:560px;margin-inline:auto;-webkit-text-size-adjust:100%}'
  + '*{box-sizing:border-box}button{font:inherit;color:inherit}a{color:#C5A56A}'
  + '.bk{display:inline-block;color:#8FA39B;text-decoration:none;font-family:"IBM Plex Mono",monospace;font-size:.64rem;letter-spacing:.1em;margin:0 0 8px}'
  + '.h{font-family:Fraunces,Georgia,serif;font-size:1.7rem;font-weight:600;margin:.1rem 0 .1rem;line-height:1.15}.h em{font-style:normal;color:#C5A56A}'
  + '.lab{display:inline-block;font-family:"IBM Plex Mono",monospace;font-size:.62rem;letter-spacing:.05em;color:#E3C88F;border:1px solid #5A4A2C;border-radius:6px;padding:4px 8px;margin:6px 0 4px;line-height:1.45}'
  + '.s{color:#8FA39B;font-size:.8rem;line-height:1.5;margin:4px 0 12px}'
  + '.srch form{display:flex;gap:7px;margin:0 0 12px}.in{flex:1 1 auto;min-width:0;min-height:46px;background:#0E1918;border:1px solid #2E4540;border-radius:9px;color:#E8E4D8;padding:9px 11px;font-size:16px;font-family:inherit}'
  + '.gob{flex:0 0 auto;min-height:46px;border:0;border-radius:9px;background:#C5A56A;color:#0C1413;font-family:"IBM Plex Mono",monospace;font-size:.72rem;letter-spacing:.05em;font-weight:600;padding:0 13px;cursor:pointer}'
  + '.card{background:#101D1B;border:1px solid #24352F;border-left:3px solid #C5A56A;border-radius:12px;padding:13px;margin:0 0 12px}'
  + '.kt{font-family:"IBM Plex Mono",monospace;font-size:.58rem;letter-spacing:.11em;color:#8FA39B}.nm{font-family:Fraunces,Georgia,serif;font-size:1.2rem;font-weight:600;color:#F0E4C8;line-height:1.2;margin:3px 0 2px}'
  + '.sb{color:#8FA39B;font-size:.76rem;line-height:1.45}.tg{display:inline-block;font-family:"IBM Plex Mono",monospace;font-size:.54rem;letter-spacing:.05em;color:#E0A080;border:1px solid #6A4A3A;border-radius:4px;padding:1px 6px;margin-left:4px;vertical-align:2px}'
  + '.hl{font-size:.95rem;margin:9px 0 4px}.hl b{font-family:Fraunces,Georgia,serif;font-size:1.6rem;color:#C5A56A;font-weight:600}'
  + '.st{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 2px}.st a,.st span{display:inline-flex;align-items:center;gap:5px;min-height:30px;border:1px solid #2E4540;border-radius:999px;padding:3px 10px;font-size:.74rem;color:#C8D3CE;text-decoration:none}.st b{color:#C5A56A}'
  + 'table{width:100%;border-collapse:collapse;margin:10px 0 0;font-size:.78rem}th{text-align:right;font-family:"IBM Plex Mono",monospace;font-size:.5rem;letter-spacing:.06em;color:#6F837D;font-weight:500;padding:0 0 5px 4px}th:first-child,td:first-child{text-align:left;padding-left:0}'
  + 'td{text-align:right;padding:7px 0 7px 5px;border-top:1px solid #1B2E2A;color:#C8D3CE}td b{color:#F0E4C8}'
  + '.dk{font-size:.72rem;color:#8FA39B;line-height:1.45;margin:6px 0 0}'
  + '.rf{display:block;width:100%;min-height:42px;margin:10px 0 0;border:1px solid #C5A56A;border-radius:9px;background:#0E1918;color:#E8E4D8;font-size:.82rem;cursor:pointer}.rf[disabled]{opacity:.55;cursor:default}'
  + '.rs{font-size:.76rem;color:#E8D6AE;line-height:1.45;margin:6px 0 0}.rs:empty{display:none}'
  + '.hd{font-family:"IBM Plex Mono",monospace;font-size:.6rem;letter-spacing:.11em;color:#8FA39B;margin:16px 0 6px}'
  + '.pick a{display:block;padding:10px 12px;border:1px solid #2E4540;border-radius:10px;margin:0 0 6px;text-decoration:none;color:#E8E4D8}.pick small{display:block;color:#8FA39B;font-size:.7rem}'
  + '.nt{color:#8FA39B;font-size:.8rem;line-height:1.5;margin:6px 0 10px}'
  + '.adw{margin:10px 0 0}.adg{border:1px solid #24352F;border-radius:10px;margin:0 0 6px;background:#0E1918}.adg summary{list-style:none;display:flex;align-items:center;gap:7px;min-height:42px;padding:6px 11px;cursor:pointer;font-size:.84rem}'
  + '.adg summary::-webkit-details-marker{display:none}.adg summary b{color:#C5A56A;margin-left:auto}.adg summary small{color:#6F837D;font-size:.66rem}.chv{color:#8FA39B;transition:transform .15s}.adg[open] .chv{transform:rotate(90deg)}'
  + '.ad{display:flex;gap:10px;align-items:flex-start;border-top:1px solid #1B2E2A;padding:9px 11px}.mm{flex:0 0 auto}.adb{min-width:0;flex:1 1 auto}'
  + '.apr{font-family:Fraunces,Georgia,serif;font-size:1.02rem;color:#F0E4C8}.apr small{font-family:inherit;font-size:.68rem;color:#8FA39B}.af{font-size:.72rem;color:#8FA39B;line-height:1.4;margin:2px 0 0}'
  + '.smap{position:relative;height:230px;overflow:hidden;border-radius:12px;border:1px solid #24352F;margin:0 0 8px;background:#1b2a26}.smc{position:absolute!important;top:0;left:0;width:100%;height:100%}'   // MapLibre's .maplibregl-map sets position:relative, which collapsed an inset-only box to 0 px
  + '.smpin{width:34px;height:34px;border-radius:50%;border:2px solid #F0E4C8;box-shadow:0 0 0 2px rgba(14,25,24,.6)}'
  + '.smg{position:absolute;z-index:2;right:8px;top:8px;display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:999px;background:rgba(14,25,24,.88);color:#E3C88F;font-size:.72rem;text-decoration:none;border:1px solid #5A4A2C}'
  + '.ap{display:flex;align-items:center;gap:4px;font-family:"IBM Plex Mono",monospace;font-size:.6rem;color:#6F837D;margin:3px 0 0}'
  + '.ao{display:inline-flex;align-items:center;gap:6px;min-height:34px;margin:6px 0 0;padding:4px 11px;border:1px solid #5A4A2C;border-radius:999px;font-size:.76rem;text-decoration:none;color:#E3C88F}'
  + '.abk{display:flex;gap:6px;flex-wrap:wrap}.abk .ao{border-color:#2F6B55;color:#BFE5D2}';

function sitesHtml(b) {
  const sites = Object.keys(b.sources).sort((x, y) => b.sources[y] - b.sources[x]);
  if (!sites.length) return "";
  return '<div class=st>' + sites.map((s) => { const u = b.urls[s]; const inner = esc(siteSay(s)) + " <b>" + fmt(b.sources[s]) + "</b>"; return u ? '<a href="' + esc(u) + '" target=_blank rel="noopener noreferrer">' + inner + " \u2197</a>" : "<span>" + inner + "</span>"; }).join("") + "</div>";
}
// v414 - drill-down by bedroom: one closed <details> per band (no script), each advert a small card with a link to the advert on
// Property Finder (pictures and the broker's own contact button live there) and a mini map: the advert's position in the frame of
// all adverts of the district. Small inline SVG icons, never emojis.
const IC_LINK = '<svg viewBox="0 0 24 24" width=14 height=14 fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden=true><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';
const IC_PIN = '<svg viewBox="0 0 24 24" width=13 height=13 fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden=true><path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/></svg>';
const IC_CHEV = '<svg class=chv viewBox="0 0 24 24" width=14 height=14 fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden=true><path d="M9 6l6 6-6 6"/></svg>';
export function miniMap(a, frame, others) {
  if (a.lat == null || a.lon == null || !frame) return "";
  const W = 64, H = 64, pad = 6, dx = frame.e - frame.w || 1e-4, dy = frame.n - frame.s || 1e-4, k = Math.min((W - 2 * pad) / dx, (H - 2 * pad) / (dy * 1.1));
  const px = (lon) => (pad + (lon - frame.w) * k + ((W - 2 * pad) - dx * k) / 2).toFixed(1), py = (lat) => (H - pad - (lat - frame.s) * k * 1.1 - ((H - 2 * pad) - dy * k * 1.1) / 2).toFixed(1);
  const dots = "";   // the other adverts' dots were tried and made a 30-building page ~300 KB per building; the frame alone is enough
  const x = px(a.lon), y = py(a.lat);
  return '<svg class=mm viewBox="0 0 ' + W + " " + H + '" width=' + W + " height=" + H + ' role=img aria-label="Where this advert sits in the district (' + a.lat.toFixed(5) + ", " + a.lon.toFixed(5) + ')"><rect x=".5" y=".5" width="' + (W - 1) + '" height="' + (H - 1) + '" rx="8" fill="#0E1918" stroke="#24352F"/>'
    + '<path d="M0 ' + H / 2 + "H" + W + "M" + W / 2 + " 0V" + H + '" stroke="#16251F" stroke-width="1"/>' + dots
    + '<path transform="translate(' + x + " " + y + ')" d="M0 0c-3.2-3.6-5-6-5-8.4a5 5 0 0 1 10 0C5-6 3.2-3.6 0 0z" fill="#C5A56A"/><circle cx="' + x + '" cy="' + (y - 8.4) + '" r="1.7" fill="#0E1918"/></svg>';
}
const IC_TEL = '<svg viewBox="0 0 24 24" width=14 height=14 fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden=true><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>';
const IC_WA = '<svg viewBox="0 0 24 24" width=14 height=14 fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden=true><path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.4z"/><path d="M9 9.5c.3 1.8 2.2 4 4.5 4.6l1.2-1.1 1.6.8c-.2 1-1 1.7-2 1.7-3.1-.2-6.4-3.4-6.6-6.5 0-1 .7-1.8 1.7-2l.8 1.6z"/></svg>';
// v442 - the listing broker (Kendall 9 Oct 2026: "connect them with the broker quickly without having to go back and forth"):
// tap to call, or WhatsApp with a line that names the advert, so the broker knows which one at once
export function brokerHtml(a, ctx) {
  if (!a.phone && !a.wa) return "";
  const who = [a.agent, a.agency].filter(Boolean).join(" · ");
  const msg = "Hello" + (a.agent ? " " + a.agent.split(" ")[0] : "") + ", I'm interested in your Property Finder advert: " + [ctx && ctx.band, ctx && ctx.building ? "in " + ctx.building : ""].filter(Boolean).join(" ")
    + (a.price != null ? ", AED " + fmt(a.price) + " a year" : "") + ". Is it still available?" + (a.url ? " " + a.url : "");
  return (who ? '<div class=af>Listed by ' + esc(who) + "</div>" : "") + '<div class=abk>'
    + (a.phone ? '<a class=ao href="tel:' + esc(a.phone) + '">' + IC_TEL + "Call</a>" : "")
    + (a.wa ? '<a class=ao href="https://wa.me/' + esc(a.wa.replace(/\D/g, "")) + "?text=" + esc(encodeURIComponent(msg)) + '" target=_blank rel="noopener noreferrer">' + IC_WA + "WhatsApp</a>" : "") + "</div>";
}
function advertCard(a, frame, all, ctx) {
  const facts = [a.sqft ? fmt(a.sqft) + " sq ft" : "", a.type, a.furnished && a.furnished !== "NO" ? (a.furnished === "YES" ? "furnished" : a.furnished.toLowerCase()) : "", a.listed ? "listed " + a.listed : ""].filter(Boolean);
  const where = "";   // v446: the position is the building's own (one per building on Property Finder), shown once on the street map above
  return '<div class=ad><div class=adb><div class=apr>' + esc(a.price == null ? "—" : "AED " + fmt(a.price)) + "<small> a year</small></div>"
    + (facts.length ? '<div class=af>' + esc(facts.join(" · ")) + "</div>" : "") + where
    + (a.url ? '<a class=ao href="' + esc(a.url) + '" target=_blank rel="noopener noreferrer">' + IC_LINK + "Open on Property Finder</a>" : '<div class=af>No link stored for this advert yet</div>')
    + (a.permit ? '<a class=ck href="' + esc(a.permit) + '" target=_blank rel="noopener noreferrer">' + IC_PERMIT + "Check permit</a>" : "")
    + brokerHtml(a, ctx) + "</div></div>";
}
export function advertsHtml(b) {
  const ads = b.ads || {}, bands = BANDS.filter((k) => ads[k] && ads[k].length).concat(Object.keys(ads).filter((k) => !BANDS.includes(k) && ads[k].length));
  if (!bands.length) return "";
  const live = (k) => (b.bands && b.bands[k] && b.bands[k].live) || ads[k].length;
  // v446 (Kendall 9 Oct: "where is the map?"): one real street map per building, where it sits in the district
  const pos = {}; let best = null;
  for (const k of bands) for (const a of ads[k]) if (a.lat != null && a.lon != null) { const p = a.lat.toFixed(4) + "," + a.lon.toFixed(4); pos[p] = (pos[p] || 0) + 1; if (!best || pos[p] > pos[best]) best = p; }
  const map = best ? streetMap(Number(best.split(",")[0]), Number(best.split(",")[1]), b.name) : "";
  return '<div class=adw>' + map + bands.map((k) => '<details class=adg><summary>' + IC_CHEV + "<span>" + esc(BAND_SAY[k] || k) + "</span><b>" + fmt(live(k)) + "</b>"
    + (live(k) > ads[k].length ? "<small>cheapest " + ads[k].length + " shown</small>" : "") + "</summary>"
    + ads[k].map((a) => advertCard(a, b.frame, ads[k], { building: b.name, band: BAND_SAY[k] || k })).join("") + "</details>").join("")
    + '<div class=dk>Each advert opens on Property Finder, where its pictures and the agent’s contact button are. The map shows where the building sits; Property Finder gives one position per building.</div></div>';
}
// The building's street map: the same free vector map as the developers map (CARTO dark matter, MapLibre 4.7.1), drawn by SUPPLY_JS
// only when the card scrolls into view, so a 40-building page loads no map until one is looked at. (CARTO's raster tiles now
// answer "API KEY REQUIRED", 9 Oct 2026, so they are not used.) The Google Maps link works with or without the map.
export function streetMap(lat, lon, name) {
  if (!(Math.abs(lat) <= 85 && Math.abs(lon) <= 180)) return "";
  const g = "https://www.google.com/maps/search/?api=1&query=" + lat.toFixed(6) + "," + lon.toFixed(6);
  return '<div class=smap data-lat="' + lat.toFixed(6) + '" data-lon="' + lon.toFixed(6) + '" role=img aria-label="' + esc((name || "The building") + " on the map") + '"><div class=smc></div>'
    + '<a class=smg href="' + g + '" target=_blank rel="noopener noreferrer">' + IC_PIN + "Open in Google Maps</a></div>";
}
function buildingCard(b, key) {
  const siteN = b.siteCount || Object.keys(b.urls).length;
  return '<div class=card data-b="' + esc(b.id) + '"><div class=kt>' + (b.matched ? "BUILDING" : "LISTING SITE NAME") + '</div><div class=nm>' + esc(b.name)
    + (b.matched ? "" : '<span class=tg>not matched to the register</span>') + "</div>"
    + '<div class=sb>' + esc([b.matched && b.project && b.project !== b.name ? b.project : "", b.district].filter(Boolean).join(" \u00b7 ")) + "</div>"
    + '<div class=hl><b>' + fmt(b.live) + "</b> " + (b.live === 1 ? "advert" : "adverts") + (siteN ? " across " + siteN + (siteN === 1 ? " site" : " sites") : "") + "</div>"
    + sitesHtml(b)
    + advertisedHtml(b.advertised)
    + (b.bandRows.length ? '<table><tr><th>HOME</th><th>LIVE ADVERTS</th><th>MEDIAN ASKING RENT</th><th>MEDIAN DAYS LISTED</th><th>DELISTED SINCE LAST CRAWL</th></tr>'
      + b.bandRows.map((r) => "<tr><td>" + esc(r.label) + "</td><td><b>" + fmt(r.live) + "</b></td><td>" + esc(aed(r.price)) + "</td><td>" + (r.days == null ? "\u2014" : fmt(r.days)) + "</td><td>" + fmt(r.delisted) + "</td></tr>").join("") + "</table>" : "")
    + advertsHtml(b)
    + '<div class=dk>Delisted since last crawl is a rough sign of letting, nothing more. Last crawled ' + esc(dubaiTime(b.crawled) || "\u2014") + " (Dubai time).</div>"
    + '<button type=button class=rf data-district="' + esc(b.district) + '" data-slug="' + esc(b.slug || "") + '">' + (b.slug ? "Refresh now" : "Refresh the district") + '</button><div class=rs role=status></div></div>';
}
export function supplyPageHtml(o) {
  const key = o.key || "", nm = districtNames();
  let main = "";
  if (o.view === "district" && o.d) {
    const D = o.d, live = D.buildings.reduce((s, b) => s + b.live, 0), sites = new Set(); D.buildings.forEach((b) => Object.keys(b.sources).forEach((s) => sites.add(s)));
    const siteN = Math.max(sites.size, D.sites || 0);
    main = '<div class=card data-district="' + esc(D.slug) + '"><div class=kt>DISTRICT</div><div class=nm>' + esc(nm[D.slug] || D.slug) + "</div>"
      + '<div class=hl><b>' + fmt(live) + "</b> " + (live === 1 ? "advert" : "adverts") + (siteN > 0 ? " across " + siteN + (siteN === 1 ? " site" : " sites") : "") + ", in " + D.buildings.length + (D.buildings.length === 1 ? " building" : " buildings") + "</div>"
      + homeTypesHtml(D.homeTypes) + coverageHtml(D.coverage)
      + '<div class=dk>Fetched ' + esc(dubaiTime(D.crawled) || "\u2014") + " (Dubai time).</div>"
      + '<button type=button class=rf data-district="' + esc(D.slug) + '" data-slug="">Refresh the district</button><div class=rs role=status></div></div>'
      + '<div class=hd>BUILDINGS, MOST ADVERTISED FIRST</div>' + D.buildings.slice(0, 30).map((b) => buildingCard(b, key)).join("") + unboundHtml(D.unbound);
  } else if (o.view === "building" && o.b) main = buildingCard(o.b, key);
  else if (o.matches) main = o.matches.length ? '<div class=hd>WHICH ONE?</div><div class=pick id=supick>' + o.matches.map((m) => '<a href="/supply?' + (m.kind === "district" ? "d=" + encodeURIComponent(m.id) : "b=" + encodeURIComponent(m.id) + "&d=" + encodeURIComponent(m.d)) + "&key=" + esc(encodeURIComponent(key)) + '">' + esc(m.name) + "<small>" + esc(m.sub) + "</small></a>").join("") + "</div>"
    : '<div class=nt id=sunone>No building or district by that name in the advert record.</div>';
  else if (o.none) main = '<div class=nt id=sunone>' + esc(o.none) + "</div>"
    + (o.fetchDistrict ? '<div class=card><button type=button class=rf data-district="' + esc(o.fetchDistrict) + '" data-slug="">Fetch the adverts for ' + esc(nm[o.fetchDistrict] || o.fetchDistrict) + ' now</button><div class=rs role=status></div></div>' : "");
  return '<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">'
    + '<title>Advertised supply \u2014 Najma</title><meta name=robots content=noindex><meta name=theme-color content="#0C1413">' + (o.fonts || "")
    + "<style>" + SU_CSS + ADV_CSS + (o.navCss || "") + "</style></head><body>"
    + '<a class=bk href="/start?key=' + esc(encodeURIComponent(key)) + '">\u2039 START</a>'
    + '<div class=h>Advertised <em>supply</em></div><div class=lab id=sulabel>' + esc(SUPPLY_LABEL) + (o.fetched ? " \u00b7 fetched " + esc(dubaiTime(o.fetched)) : "") + "</div>"
    + (o.src ? '<div class=s id=susource>Source: ' + esc(o.src) + "</div>" : "")
    + '<div class=s>Owner only. Adverts are not homes free: one home can be on several sites, and a home can let without being advertised.</div>'
    + '<div class=srch><form method=get action="/supply"><input type=hidden name=key value="' + esc(key) + '"><input class=in type=search name=q value="' + esc(o.q || "") + '" placeholder="a building or a district" aria-label="search a building or a district"><button type=submit class=gob>SEARCH</button></form></div>'
    + main
    + "<script>window.__SU=" + safeJson({ key }) + ";</script><script>" + SUPPLY_JS + "</script>"
    + (o.nav || "") + "</body></html>";
}

const nrm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
// h: { keyTier, najNav, NAJ_NAV_CSS, NAJ_FONTS }. Anything but the owner key: 404, before any storage is touched.
export async function supplyRoutes(request, env, url, h) {
  const p = url.pathname;
  if (p !== "/supply" && p.indexOf("/supply/") !== 0) return null;
  const notFound = () => new Response("not found", { status: 404 });
  if (h.keyTier(env, url) !== "admin") return notFound();
  const key = url.searchParams.get("key") || "";
  const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
  if (p === "/supply/summary" && request.method === "GET") return json(await supplySummary(env));
  if (p === "/supply/request") {
    if (request.method !== "POST") return new Response("method not allowed", { status: 405 });
    let district = url.searchParams.get("district") || "", slug = url.searchParams.get("slug") || "";
    if (!district) { try { const b = await request.json(); district = String((b && b.district) || ""); slug = String((b && (b.building_slug || b.slug)) || ""); } catch (e) {} }
    district = district.trim().toLowerCase(); slug = slug.trim().toLowerCase();
    if (!/^[a-z0-9]{2,40}$/.test(district)) return json({ ok: false, why: "say which district to refresh" }, 400);
    if (slug && !/^[a-z0-9][a-z0-9-]{0,120}$/.test(slug)) return json({ ok: false, why: "that building's listing-site name is not one the crawler can use" }, 400);
    // one request runs at a time: the same building or district already waiting or running is not asked for twice
    const open = await openRequests(env);
    const same = open.find((o) => o.req.district === district && (o.req.building_slug || "") === slug);
    if (same) return json({ ok: true, id: same.id, existing: true, district, building_slug: slug || null, requested_at: same.req.requested_at });
    const id = crypto.randomUUID(), rec = { district, building_slug: slug || null, requested_at: new Date().toISOString() };
    await env.MEETINGS.put(SUPPLY_KV.req(id), JSON.stringify(rec), { expirationTtl: 3 * 86400 });
    const qids = await queueIds(env); if (!qids.includes(id)) { qids.push(id); await env.MEETINGS.put(SUPPLY_KV.queue, JSON.stringify(qids.slice(-200))); }   // the poller's index
    const running = open.find((o) => o.take);
    return json({ ok: true, id, district, building_slug: rec.building_slug, requested_at: rec.requested_at, queued_behind: running ? { district: running.req.district, building_slug: running.req.building_slug || null } : null });
  }
  if (p === "/supply/status" && request.method === "GET") return json(await supplyStatus(env, url.searchParams.get("id") || ""));
  if (p !== "/supply" || request.method !== "GET") return notFound();
  const names = await appNames(env), nm = districtNames(), q = (url.searchParams.get("q") || "").slice(0, 80);
  const d = (url.searchParams.get("d") || "").toLowerCase(), b = (url.searchParams.get("b") || "").slice(0, 160);
  const page = (o) => new Response(supplyPageHtml(Object.assign({ key, q, nav: h.najNav(key, "start", ""), navCss: h.NAJ_NAV_CSS, fonts: h.NAJ_FONTS }, o)),
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  if (/^[a-z0-9]{2,40}$/.test(d)) {
    const D = await withUnbound(env, await loadDistrict(env, d, names)), src = sourceLine(D);
    if (!D) return page({ none: "No adverts fetched for " + (nm[d] || d) + " yet.", fetchDistrict: nm[d] ? d : "" });
    if (b) { const one = D.buildings.find((x) => x.id === b || x.key === b); return one ? page({ view: "building", b: one, fetched: one.crawled, src }) : page({ none: "No adverts for that building in the last crawl.", fetched: D.crawled, src }); }
    return page({ view: "district", d: D, fetched: D.crawled, src });
  }
  const ds = await supplyDistricts(env);
  if (!ds.length) return page({ none: "No adverts have been fetched yet. The crawler on the office computer publishes them." });
  if (!q) return page({ matches: ds.map((s) => ({ kind: "district", id: s, name: nm[s] || s, sub: "District" })) });
  // search: a district by name, a building by our key, its register name, its app name, or a listing site's name
  const qq = nrm(q), out = [];
  for (const s of ds) { const n = nrm(nm[s] || s); if (n.indexOf(qq) >= 0 || s.indexOf(qq.replace(/ /g, "")) >= 0) out.push({ kind: "district", id: s, name: nm[s] || s, sub: "District", s: n === qq ? 100 : 50 }); }
  for (const s of ds) {
    const D = await loadDistrict(env, s, names); if (!D) continue;
    for (const x of D.buildings) {
      const hit = [x.name, x.project, x.siteName].map(nrm).some((n) => n && n.indexOf(qq) >= 0) || (x.key && x.key === q.trim().toLowerCase());
      if (hit) out.push({ kind: "building", id: x.id, d: s, name: x.name, sub: (x.matched ? "Building" : "Listing site name, not matched") + " · " + (nm[s] || s) + " · " + fmt(x.live) + " adverts", s: nrm(x.name) === qq ? 90 : 40 });
    }
  }
  if (!out.length) {   // v287.1: a real district we have not fetched adverts for yet - say so and offer to fetch it
    const known = Object.keys(nm).filter((s) => { const n = nrm(nm[s] || s); return n === qq || n.indexOf(qq) >= 0 || s === qq.replace(/ /g, ""); });
    const exact = known.find((s) => nrm(nm[s]) === qq || s === qq.replace(/ /g, ""));
    const one = exact || (known.length === 1 ? known[0] : "");
    if (one) return page({ none: "No adverts fetched for " + nm[one] + " yet. Adverts so far: " + ds.map((s) => nm[s] || s).join(", ") + ".", fetchDistrict: one });
  }
  out.sort((a, c) => c.s - a.s || a.name.localeCompare(c.name));
  if (out.length === 1 || (out.length > 1 && out[0].s >= 90 && out[1].s < out[0].s)) {
    const m = out[0], D = await loadDistrict(env, m.kind === "district" ? m.id : m.d, names), src = sourceLine(D);
    if (m.kind === "district") return page({ view: "district", d: await withUnbound(env, D), fetched: D.crawled, src });
    const one = D.buildings.find((x) => x.id === m.id); return page({ view: "building", b: one, fetched: one.crawled, src });
  }
  return page({ matches: out.slice(0, 15) });
}

const TAKE_LIMIT_MS = 30 * 60000, PICKUP_MS = 90000;
// the queue index the poller reads: pf_queue = a JSON list of request ids
async function queueIds(env) { const q = await readJson(env, SUPPLY_KV.queue); return Array.isArray(q) ? q.filter((x) => typeof x === "string" && UUID.test(x)) : []; }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// requests not yet done and not given up on: {id, req, take}
async function openRequests(env, nowMs) {
  const now = nowMs == null ? Date.now() : nowMs, out = [];
  const keys = await queueIds(env);
  for (const id of keys.slice(-50)) {
    if (await readJson(env, SUPPLY_KV.done(id))) continue;
    const req = await readJson(env, SUPPLY_KV.req(id)), take = await readJson(env, SUPPLY_KV.take(id));
    if (!req) continue;
    if (take && now - Date.parse(take.taken_at || 0) > TAKE_LIMIT_MS) continue;          // taken and never finished: failed
    if (!take && now - Date.parse(req.requested_at || 0) > 6 * 3600000) continue;          // never taken in six hours: abandoned
    out.push({ id, req, take });
  }
  return out;
}
// where a refresh request has got to (the contract with the laptop's poller is in the header)
export async function supplyStatus(env, id, nowMs) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, state: "unknown", why: "no such request" };
  const now = nowMs == null ? Date.now() : nowMs;
  const req = await readJson(env, SUPPLY_KV.req(id)), take = await readJson(env, SUPPLY_KV.take(id)), done = await readJson(env, SUPPLY_KV.done(id));
  const kind = req ? (req.building_slug ? "building" : "district") : (done && done.building_slug ? "building" : "district");
  const base = { ok: true, id, kind, district: (req && req.district) || (done && done.district) || "", building_slug: (req && req.building_slug) || (done && done.building_slug) || null };
  if (done) {
    const st = done.status === "ok" ? "done" : done.status === "held_by_daily_chain" ? "deferred" : "error";
    return Object.assign(base, { state: st, as_of: done.as_of || "", seconds: done.seconds == null ? null : done.seconds, note: st === "error" ? String(done.note || "").slice(0, 200) : "" });
  }
  if (!req) return { ok: false, state: "unknown", why: "no such request" };
  if (take) {
    const ran = now - Date.parse(take.taken_at || 0);
    if (ran > TAKE_LIMIT_MS) return Object.assign(base, { state: "failed", taken_at: take.taken_at });
    return Object.assign(base, { state: "fetching", taken_at: take.taken_at, expect_s: kind === "building" ? 300 : 2100, ran_s: Math.round(ran / 1000) });
  }
  const waited = now - Date.parse(req.requested_at || 0);
  const running = (await openRequests(env, now)).find((o) => o.id !== id && o.take);
  if (running) return Object.assign(base, { state: "queued", behind: { district: running.req.district, building_slug: running.req.building_slug || null }, waited_s: Math.round(waited / 1000) });
  return Object.assign(base, { state: waited > PICKUP_MS ? "offline" : "waiting", waited_s: Math.round(waited / 1000) });
}

// ---- the laptop poller's two routes (it talks only to the Worker: the Cloudflare account API takes ~127 s a call from there) ----
// Authenticated by the X-Azimuth-Ingest header against INGEST_TOKEN (the /ingest_market check), never by an owner or client URL key.
//   GET  /pf_queue   -> {pending:[{id, district, building_slug, requested_at}]}   every id in pf_queue with no pf_done_<id>
//   POST /pf_status  {id, stage:"take"|"done", result:{...}} -> pf_take_<id> or pf_done_<id>; "done" drops the id from pf_queue
// h: { ctEq }
export async function pollerRoutes(request, env, url, h) {
  if (url.pathname !== "/pf_queue" && url.pathname !== "/pf_status") return null;
  const tok = request.headers.get("X-Azimuth-Ingest");
  if (!env.INGEST_TOKEN || !tok || !h.ctEq(tok, String(env.INGEST_TOKEN))) return new Response("unauthorized", { status: 401 });
  const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
  if (url.pathname === "/pf_queue") {
    if (request.method !== "GET") return new Response("method not allowed", { status: 405 });
    const ids = await queueIds(env), pending = [], keep = [];
    for (const id of ids) {
      if (await readJson(env, SUPPLY_KV.done(id))) continue;          // finished: not pending, and drops out of the index
      const req = await readJson(env, SUPPLY_KV.req(id)); if (!req) continue;   // expired
      keep.push(id); pending.push({ id, district: req.district, building_slug: req.building_slug || null, requested_at: req.requested_at });
    }
    if (keep.length !== ids.length) await env.MEETINGS.put(SUPPLY_KV.queue, JSON.stringify(keep));
    return json({ pending });
  }
  if (request.method !== "POST") return new Response("method not allowed", { status: 405 });
  let b = null; try { b = await request.json(); } catch (e) { return json({ ok: false, why: "bad json" }, 400); }
  const id = String((b && b.id) || ""), stage = String((b && b.stage) || ""), result = b && b.result && typeof b.result === "object" && !Array.isArray(b.result) ? b.result : {};
  if (!UUID.test(id)) return json({ ok: false, why: "no such request id" }, 400);
  if (!(await readJson(env, SUPPLY_KV.req(id)))) return json({ ok: false, why: "no such request" }, 404);
  if (stage === "take") {
    const rec = Object.assign({}, result, { taken_at: result.taken_at || new Date().toISOString() });
    await env.MEETINGS.put(SUPPLY_KV.take(id), JSON.stringify(rec), { expirationTtl: 3 * 86400 });
    return json({ ok: true, id, stage });
  }
  if (stage === "done") {
    if (!["ok", "held_by_daily_chain", "error"].includes(result.status)) return json({ ok: false, why: "status must be ok, held_by_daily_chain or error" }, 400);
    await env.MEETINGS.put(SUPPLY_KV.done(id), JSON.stringify(result), { expirationTtl: 3 * 86400 });
    const ids = await queueIds(env); if (ids.includes(id)) await env.MEETINGS.put(SUPPLY_KV.queue, JSON.stringify(ids.filter((x) => x !== id)));
    return json({ ok: true, id, stage });
  }
  return json({ ok: false, why: "stage must be take or done" }, 400);
}

// The page script: Refresh now -> POST /supply/request -> poll /supply/status (every 5 s for a building, every 20 s for a
// district) until the request ends. The request is remembered in this browser, so reopening the page picks it back up.
export const SUPPLY_JS = String.raw`
(function(){
var S=window.__SU||{},KQ="key="+encodeURIComponent(S.key||""),LS="najma_supply_pending";
// v446 - building street maps: MapLibre is fetched once, the first time a map scrolls into view; each map is drawn once
(function(){var maps=document.querySelectorAll(".smap[data-lat]");if(!maps.length||!("IntersectionObserver" in window))return;var lib=null;
  function load(){if(lib)return lib;lib=new Promise(function(ok,no){var c=document.createElement("link");c.rel="stylesheet";c.href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";document.head.appendChild(c);
    var s=document.createElement("script");s.src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";s.onload=function(){ok(window.maplibregl)};s.onerror=no;document.head.appendChild(s)});return lib}
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting)return;io.unobserve(e.target);var el=e.target,ll=[Number(el.getAttribute("data-lon")),Number(el.getAttribute("data-lat"))];
    load().then(function(ml){var m=new ml.Map({container:el.querySelector(".smc"),style:"https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",center:ll,zoom:14,attributionControl:{compact:true},cooperativeGestures:true});
      // v447 (Kendall: "i do not need the dot if the building is a different color"): the ring only when the footprint cannot be drawn
      var pinned=false,pinIt=function(){if(pinned)return;pinned=true;var pin=document.createElement("div");pin.className="smpin";new ml.Marker({element:pin}).setLngLat(ll).addTo(m)};
      m.on("error",pinIt);
      m.on("load",function(){var a=el.querySelector(".maplibregl-ctrl-attrib");if(a)a.classList.remove("maplibregl-compact-show");
        // v446 (Kendall: "but in a block format as well"): the digital footprint - every building raised to its height, the advertised one in gold
        try{var src=Object.keys(m.getStyle().sources).find(function(k){return m.getStyle().sources[k].type==="vector"});
          if(src){var h=["coalesce",["get","render_height"],["get","height"],12];
            m.addLayer({id:"dfp",type:"fill-extrusion",source:src,"source-layer":"building",minzoom:13,paint:{"fill-extrusion-color":"#3d5a53","fill-extrusion-height":h,"fill-extrusion-base":["coalesce",["get","render_min_height"],0],"fill-extrusion-opacity":0.9}});
            // v449 (Kendall: "they are all green?"): the 'distance' expression lit scraps at the tile edges, not the building. Once drawn,
            // take the footprint(s) under the advert's point (else the nearest within ~25 px) and raise THAT building in gold on its own layer.
            m.once("idle",function(){try{var p=m.project(ll),hit=m.queryRenderedFeatures([[p.x-2,p.y-2],[p.x+2,p.y+2]],{layers:["dfp"]});
              // gold ONLY for one plain footprint exactly under the point; a new tower missing from the open map data, or a footprint
              // stored as many pieces, gets the ring instead - never a neighbour painted as if it were the building
              if(hit.length!==1||hit[0].geometry.type!=="Polygon")return pinIt();
              m.addSource("gold",{type:"geojson",data:{type:"FeatureCollection",features:hit.map(function(f){return {type:"Feature",geometry:f.geometry,properties:f.properties}})}});
              m.addLayer({id:"gold",type:"fill-extrusion",source:"gold",paint:{"fill-extrusion-color":"#C5A56A","fill-extrusion-height":["+",h,0.5],"fill-extrusion-base":["coalesce",["get","render_min_height"],0],"fill-extrusion-opacity":1}})}catch(x){pinIt()}});
            m.jumpTo({zoom:15.3});m.once("idle",function(){m.easeTo({pitch:50,bearing:-20,duration:900})})}else pinIt()}catch(x){pinIt()}})}).catch(function(){})})},{rootMargin:"200px"});
  for(var i=0;i<maps.length;i++)io.observe(maps[i])})();
var SAY={building:"Fetching this building: up to about 5 minutes.",district:"Fetching the whole district: this takes a while (about 35 minutes). We’ll keep it here.",
  queued:"Waiting for the crawl that is already running; this one is next. We’ll keep it here.",
  deferred:"Available after the morning refresh: the daily run is using the data right now.",
  offline:"The office computer is offline; showing the last saved copy.",
  done:"Fresh copy in. Reloading…",failed:"The crawl started but did not finish in 30 minutes. Showing the last saved copy.",
  error:"The crawl failed. Showing the last saved copy.",unknown:"That request was lost. Showing the last saved copy.",
  late:"Still no fresh copy. Showing the last saved copy; check back later."};
function each(l,f){for(var i=0;i<l.length;i++)f(l[i])}
function store(v){try{if(v)localStorage.setItem(LS,JSON.stringify(v));else localStorage.removeItem(LS)}catch(e){}}
function stored(){try{return JSON.parse(localStorage.getItem(LS)||"null")}catch(e){return null}}
function wire(btn){var box=btn.nextElementSibling||(btn.parentNode&&btn.parentNode.querySelector(".rs"));
  var dist=btn.getAttribute("data-district")||"",slug=btn.getAttribute("data-slug")||"",kind=slug?"building":"district";
  function say(t){if(box)box.textContent=t}
  function end(t,again){say(t);store(null);btn.disabled=false;btn.textContent=again?"Request again":"Refresh now"}
  function poll(id,t0){var every=kind==="building"?5000:20000,limit=kind==="building"?12*60000:50*60000;
    if(Date.now()-t0>limit)return end(SAY.late,true);
    setTimeout(function(){fetch("/supply/status?id="+encodeURIComponent(id)+"&"+KQ,{credentials:"same-origin"}).then(function(r){return r.json()}).then(function(s){
      var st=s&&s.state;
      if(st==="done"){say(SAY.done);store(null);setTimeout(function(){location.reload()},800);return}
      if(st==="deferred"||st==="offline")return end(SAY[st],false);
      if(st==="error")return end(SAY.error+(s.note?" ("+s.note+")":""),true);
      if(st==="failed"||st==="unknown")return end(SAY[st],true);
      say(st==="queued"?SAY.queued:SAY[kind]);poll(id,t0)},function(){say("No connection to check on it; still trying…");poll(id,t0)})},window.__SU_POLL_MS||every)}
  function follow(id,t0){btn.disabled=true;btn.textContent="Requested";say(SAY[kind]);store({id:id,district:dist,slug:slug,t0:t0});poll(id,t0)}
  btn.onclick=function(){if(btn.disabled)return;btn.disabled=true;btn.textContent="Asking…";say("");
    fetch("/supply/request?district="+encodeURIComponent(dist)+(slug?"&slug="+encodeURIComponent(slug):"")+"&"+KQ,{method:"POST",credentials:"same-origin"}).then(function(r){if(!r.ok)throw r.status;return r.json()}).then(function(j){
      if(!j||!j.ok||!j.id)throw 0;follow(j.id,Date.now())},
    function(e){end("The request did not go through"+(typeof e==="number"&&e?" (error "+e+")":"")+". Try again.",true)})};
  var p=stored();if(p&&p.id&&p.district===dist&&(p.slug||"")===slug)follow(p.id,p.t0||Date.now())}
each(document.querySelectorAll(".rf"),wire);
window.__supply={SAY:SAY};
})();
`;
