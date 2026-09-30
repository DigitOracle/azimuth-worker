// THE BRIEF, part C - the documents. GET /brief_pdf?kind=onesheet|compare|dossier|pack&keys=<key,key,...>&mode=&beds=&min=&max=
//
// Kendall, 30 Sep 2026: a client of Naj's asked for "three options in JVC, one bedroom, AED 65K rent" and answering it took a session of
// hand work. The documents that session made were approved as they stand (scratchpad build_pack11.py + make_map.py; the outputs in
// Downloads/JVC_1BR_individual and JVC_1BR_one_sheet_v2.pdf). This module rebuilds THOSE layouts inside the Worker, for any district and
// any bedroom count, from what the app already keeps in KV. It is a reproduction, not a redesign: the CSS, sizes, wording and the order
// of things on each page are the reference build's.
//
//   dossier   ONE building per request, 3 pages A4 portrait: the building / "Where it is" (single-building LOD 100 map + the
//             ESTIMATED ... LEFT box) / photos and the layouts table. Several keys -> 400 with one link per building (see below).
//   onesheet  A4 landscape: page 1 every chosen building as a card (up to 10); page 2 the overall LOD 100 map, numbered to match.
//   compare   the same two pages (the approved one-sheet already carries the overview map).
//   pack      the one-sheet, the map, a dossier per building, and an appendix table of every building the brief matches.
//
// WHY ONE PDF PER DOSSIER REQUEST, NOT A ZIP. The contract is "-> application/pdf", and Kendall's rule is that "Individual PDFs" go out
// one building at a time, never bundled. A zip changes the response type every caller has to handle, and ten dossiers in one request
// is ten browser renders inside one Worker invocation - the slow path most likely to time out. So a dossier request with several keys
// answers 400 with {dossiers:[{key,url}]}: one link per building, each of which is a normal one-building PDF request.
//
// THE MAPS. make_map.py cannot run here (matplotlib). The Worker draws the same view as SVG - the same 50-degree oblique projection
// from the south, the same palette, badges, north arrow, scale bar and side panel - from a compact footprint layer per district
// (KV img_brief_fp_<district>, published by scripts/brief_map_layers.py). One layer serves every building and every chosen SET of
// buildings, which pre-rendered pictures cannot (a picture per building per district, and the overview changes with every choice).
// A missing layer, or a building with no map position, shows "Map to follow" - never a broken image, never a guessed pin.
//
// Data, all already in KV except the two layers this part adds (img_brief_fp_<d>, img_brochure_*):
//   img_rent_index           the evidence: median / middle half / count per building per bedroom band (build_rent_index.py)
//   img_unitmix_<d>          floors, homes, and flats per bedroom type (Land Department units register)
//   img_units_<d>            flat by flat (size, balcony, floor) - the layouts table, where the register covers the building
//   img_beds_left_<d>        the beds-left register (T and R per building per bedroom band) - read FIRST for the "left" estimate
//   img_tenancy_<d>          tenancy contracts running, per bedroom type - the old gated path, only where the register is missing
//                            (both through estimateLeft() in src/brief.js, the one function /brief_api uses too)
//   img_amenities            RTA metro, KHDA schools, DHA clinics - straight-line distances only
//   img_districts_geo        district names
//   img_brochure_<dir>       the developer's own page: amenities + photos (naj-market-pulse scripts/push_brochures.py)
//   img_brand_najjuko_n      the header picture: Najjuko leaning on the Najma N
//
// Rules carried from the spec (every one comes from a past incident or an explicit instruction): footer ONLY "Curated by Najjuko ·
// Dubai Decoded" + WhatsApp + +971 56 548 4397; photos and amenities only from the developer's own page, never a listing portal; the
// building's name must agree with the record; straight-line distances only, no walking or driving times; rents are what homes let
// for, never availability; the "left" figure is always "an estimate, not a count".
import puppeteer from "@cloudflare/puppeteer";
import { estimateLeft, candidateKey, kvJson as kvJsonGz } from "./brief.js";   // the ONE "left" estimate, shared with /brief_api

export const FOOTER_TEXT = "Curated by Najjuko &middot; Dubai Decoded";
export const WHATSAPP_NUMBER = "+971 56 548 4397";
export const HEADER_IMG_KEY = "brand_najjuko_n";
const NAVY = "#17283F", GOLD = "#A8814A", MUTED = "#626B78", INK = "#22262B";
const SQFT = 10.7639;
const MAX_KEYS = 10;

// Test seam: the tests replace the browser with a stub that records the HTML. Production never calls this.
let LAUNCH = (binding) => puppeteer.launch(binding);
export function __setLauncher(fn) { LAUNCH = fn || ((binding) => puppeteer.launch(binding)); }

// ------------------------------------------------------------------------------------------------ small helpers
export const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
export const money = (n) => Math.round(Number(n) || 0).toLocaleString("en-US");
function km(a, b) {
  const p = Math.PI / 180, x = Math.sin((b[0] - a[0]) * p / 2) ** 2 + Math.cos(a[0] * p) * Math.cos(b[0] * p) * Math.sin((b[1] - a[1]) * p / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(x));
}
const norm = (s) => String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const stemKey = (s) => norm(String(s || "").normalize("NFKD").toLowerCase().replace(/\b(by|the|tower|towers|residences?|building|bldg|apartments?)\b/g, ""));
const slug = (s) => String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 50);
function pretty(n) {           // a register name in capitals reads as shouting on a client page; a mixed-case name is left as the developer wrote it
  const s = String(n || "");
  return s && s === s.toUpperCase() ? s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : s;
}
// FNV-1a (two seeds) - the SAME function is in naj-market-pulse scripts/push_brochures.py. POST /ingest_market cuts imageName at 40
// characters, so a brochure folder whose KV name would be longer is stored under a short hash instead of being silently truncated.
export function fnv16(s) {
  const h = (seed) => { let x = seed >>> 0; for (const ch of new TextEncoder().encode(s)) { x ^= ch; x = Math.imul(x, 16777619) >>> 0; } return x.toString(16).padStart(8, "0"); };
  return h(2166136261) + h(0x811c9dc5 ^ 0x5bd1e995);
}
export const brochureKvName = (dir) => ("brochure_" + dir).length <= 40 ? "brochure_" + dir : "brochure_h" + fnv16(dir);
function b64(buf) {
  const u = new Uint8Array(buf); let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}
function todayLong(now) {
  const d = new Date((now || Date.now()) + 4 * 3600e3);   // Dubai time
  return d.getUTCDate() + " " + ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][d.getUTCMonth()] + " " + d.getUTCFullYear();
}
const NUMWORD = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const DISTRICT_SHORT = { jumeirahvillagecircle: "JVC", jumeirahvillagetriangle: "JVT", jltnorth: "JLT", jltsouth: "JLT" };

// Listing portals are never a picture source (a portal brochure once put another building's pictures on a live sheet).
const PORTAL_RX = /(propertyfinder|bayut|dubizzle|justproperty|houza|opensooq|zillow|rightmove|zoopla|propsearch|emirates\.estate|drivenproperties|betterhomes|allsoppandallsopp|hausandhaus|fam-?properties|luxhabitat|axcapital|metropolitan\.realestate|provident)/i;
export const isPortal = (u) => PORTAL_RX.test(String(u || ""));

export const BEDS = {
  studio: { band: "0", word: "studio", upper: "STUDIO", pl: "STUDIOS", short: "studios", tn: (k) => k === "Studio", uc: (c) => c === "studio" },
  "1": { band: "1", word: "one-bedroom", upper: "ONE BEDROOM", pl: "ONE-BEDROOMS", short: "1-beds", tn: (k) => k === "1 bedroom", uc: (c) => c === "1" },
  "2": { band: "2", word: "two-bedroom", upper: "TWO BEDROOMS", pl: "TWO-BEDROOMS", short: "2-beds", tn: (k) => k === "2 bedroom", uc: (c) => c === "2" },
  "3": { band: "3", word: "three-bedroom-or-larger", upper: "THREE BEDROOMS OR MORE", pl: "THREE-OR-MORE-BEDROOMS", short: "3-beds and larger", tn: (k) => /^([3-9]|\d\d) bedroom/.test(k), uc: (c) => /^\d+$/.test(c) && +c >= 3 },
};

// Reference points for the straight-line distances (RTA tram / metro registers), exactly those the approved dossiers use.
const REF = [["Dubai Marina", 25.080803, 55.146909], ["Media City", 25.094499, 55.151983], ["Downtown", 25.2014, 55.269518]];

// ------------------------------------------------------------------------------------------------ the house look (build_client_sheet.CSS)
const CSS = `
  html, body { margin: 0; padding: 0; background: #6B6F76; }
  .sheet { font-family: "IBM Plex Sans", "Segoe UI", Arial, sans-serif; font-variant-numeric: tabular-nums;
           width: 794px; height: 1123px; background: #FBFAF7; color: #22262B;
           display: flex; flex-direction: column; overflow: hidden; }
  .serif { font-family: Newsreader, Georgia, "Times New Roman", serif; }
  .page { margin: 22px auto; box-shadow: 0 6px 26px rgba(0,0,0,0.34); width: 794px; height: 1123px; }
  .land { width: 1123px; height: 794px; }
  .lbl { font-size: 11px; font-weight: 600; color: #A8814A; letter-spacing: 1.1px; }
  .h2 { font-size: 25px; font-weight: 400; color: #17283F; }
  .sub { font-size: 14px; color: #626B78; }
  .card { border: 1px solid #E6E1D8; background: #FFFFFF; padding: 13px;
          display: flex; flex-direction: column; gap: 8px; }
  .prov { font-size: 11.5px; line-height: 1.34; color: #626B78; }
  table { border-collapse: collapse; width: 100%; }
  @page { size: A4; margin: 0; }
  @page land { size: A4 landscape; margin: 0; }
  .land { page: land; }
  @media print {
    html, body { background: #FFFFFF; }
    .page { margin: 0; box-shadow: none; page-break-after: always; break-after: page; }
    .page:last-child { page-break-after: auto; break-after: auto; }
  }
`;
const HEAD = (title, body) => '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>' + esc(title) + '</title>' +
  '<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400&display=swap" rel="stylesheet">' +
  "<style>" + CSS + "</style></head><body>" + body + "</body></html>";

const WA_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" aria-label="WhatsApp" style="vertical-align:-3px;">' +
  '<path fill="#25D366" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z"/>' +
  '<path fill="#FFFFFF" d="M9.1 7.2c-.2-.5-.4-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.2 5 4.4 ' +
  "2.5 1 3 .8 3.5.7.5-.1 1.7-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.4l-2-1c-.3-.1-.5-.1-.7.2l-.9 1.1c-.2.2-.3.2-.6.1" +
  '-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.6c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.8-2.2z"/></svg>';
const CURATOR = FOOTER_TEXT + " " + WA_SVG + " " + WHATSAPP_NUMBER;

function logo(C, h) {
  return C.logo ? '<img class="najhead" src="' + C.logo + '" alt="Najma" style="height:' + h + 'px;width:auto;display:block;">'
    : '<div class="serif" style="font-size:' + Math.round(h * 0.4) + 'px;color:' + GOLD + ';">Najma</div>';   // header picture not yet published
}
function header(C, sub) {
  return '<div style="height:122px;display:flex;align-items:center;justify-content:space-between;padding:0 46px;' +
    'background:#FFFFFF;border-bottom:1px solid #E6E1D8;flex-shrink:0;">' +
    '<div style="display:flex;flex-direction:column;gap:4px;"><div class="lbl">' + sub + '</div>' +
    '<div style="font-size:12px;color:' + MUTED + ';">' + C.today + "</div></div>" + logo(C, 112) + "</div>";
}
function footer(small) {
  return '<div style="padding:8px 46px 16px 46px;display:flex;flex-direction:column;gap:6px;">' + (small || "") +
    '<div style="font-size:10.5px;color:' + MUTED + ';line-height:1.35;">Availability, the rent and the actual flat must be ' +
    "confirmed with the building's leasing team or the listing broker. Rents shown are rents already agreed, " +
    "not asking prices or an offer.</div>" +
    '<div style="height:1px;background:#DED9D0;margin-top:2px;"></div>' +
    '<div class="curator" style="display:flex;justify-content:center;align-items:center;gap:8px;font-size:12px;color:' + NAVY + ';' +
    'letter-spacing:.3px;">' + CURATOR + "</div></div>";
}
const smallPrint = (items) => '<div class="prov" style="display:flex;flex-direction:column;gap:3px;font-size:9px;line-height:1.35;">' +
  items.filter(Boolean).map((i) => "<div>" + i + "</div>").join("") + "</div>";
function page(C, sub, body, small) {
  C.pages++;
  return '<div class="sheet page">' + header(C, sub) + '<div style="flex:1;display:flex;flex-direction:column;padding:16px 46px 0 46px;' +
    'gap:12px;overflow:hidden;">' + body + "</div>" + footer(small) + "</div>";
}
function tbl(head, rows) {
  const th = head.map(([al, t]) => '<th style="text-align:' + al + ';font-size:8.8px;font-weight:600;letter-spacing:.6px;color:#FBFAF7;padding:6px 5px;">' + t + "</th>").join("");
  const tr = rows.map((r, k) => '<tr style="' + (k % 2 === 0 ? "background:#F1EEE8;" : "") + '">' + r.map((v, j) =>
    '<td style="text-align:' + head[j][0] + ';padding:4px 5px;font-size:10.8px;border-bottom:1px solid #E6E1D8;vertical-align:middle;line-height:1.28;">' + v + "</td>").join("") + "</tr>").join("");
  return '<table><thead><tr style="background:' + NAVY + ';">' + th + "</tr></thead><tbody>" + tr + "</tbody></table>";
}
const img = (src, style, alt) => '<img src="' + src + '" alt="' + esc(alt || "") + '" style="' + style + '">';
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } };

// ------------------------------------------------------------------------------------------------ query
export function parseQuery(url) {
  const sp = url.searchParams;
  const num = (v) => { const n = Number(String(v || "").replace(/[^0-9.]/g, "")); return isFinite(n) && n > 0 ? n : 0; };
  const beds = String(sp.get("beds") || "1").toLowerCase();
  return {
    kind: String(sp.get("kind") || "dossier").toLowerCase(),
    keys: String(sp.get("keys") || "").split(",").map((k) => k.trim()).filter(Boolean),
    mode: String(sp.get("mode") || "rent").toLowerCase(),
    beds: BEDS[beds] ? beds : (beds === "0" ? "studio" : "1"),
    min: num(sp.get("min")), max: num(sp.get("max")),
    type: String(sp.get("type") || "apartment").toLowerCase(),
    areas: String(sp.get("areas") || "").split(",").map((a) => a.trim().toLowerCase().replace(/[^a-z0-9]/g, "")).filter(Boolean),
    num: Math.max(0, parseInt(sp.get("num") || "0", 10) || 0), of: Math.max(0, parseInt(sp.get("of") || "0", 10) || 0),
    format: String(sp.get("format") || "pdf").toLowerCase(),
  };
}

// ------------------------------------------------------------------------------------------------ data
async function kvJson(env, name) { try { const t = await env.MEETINGS.get("img_" + name); return t ? JSON.parse(typeof t === "string" ? t : new TextDecoder().decode(t)) : null; } catch (e) { return null; } }
// A picture for the document. With an origin (the live route) it is a link to the Worker's own public /img/ route, so a ten-building
// pack stays a few hundred KB of HTML instead of megabytes of base64 pushed through the browser session; it is linked only when the
// picture is actually stored (its img_ct_ key, written with every ingest), so a document never carries a broken image. Without an
// origin (tests, the local preview) it is embedded.
async function kvDataUrl(env, name, origin) {
  try {
    if (origin) return (await env.MEETINGS.get("img_ct_" + name)) ? origin + "/img/" + name : null;
    const buf = await env.MEETINGS.get("img_" + name, "arrayBuffer");
    if (!buf || !buf.byteLength) return null;
    const ct = (await env.MEETINGS.get("img_ct_" + name)) || "image/jpeg";
    return "data:" + ct + ";base64," + b64(buf);
  } catch (e) { return null; }
}

// A key is "<district>:<appId>" or "dld:<normalised DLD project name>" (Contract A). Both resolve against the rent index, the one
// record that carries the evidence; a key the index does not know is refused rather than drawn from somewhere else.
export function findItem(ri, key) {
  const items = (ri && ri.items) || [];
  const m = /^([a-z0-9]+):(.+)$/.exec(String(key || "").toLowerCase());
  if (!m) return null;
  if (m[1] === "dld") { const p = norm(m[2]); return items.find((it) => it.p === p) || items.find((it) => norm(it.n) === p) || null; }
  const id = parseInt(m[2], 10);
  if (!isFinite(id)) return null;
  return items.find((it) => it.d === m[1] && (it.i === id || (Array.isArray(it.is) && it.is.includes(id)))) || null;
}

const PHOTO_ORDER = ["pool", "gym", "interior.jpg", "interior_bedroom", "interior_kitchen", "lobby", "courtyard"];
export function photoRank(p) {
  const f = String(p.file || "");
  if (f === "pool_2.jpg" || p.client === false) return 99;   // pool_2: a developer's name laid in the pool mosaic (reference build rule)
  for (let k = 0; k < PHOTO_ORDER.length; k++) { const pre = PHOTO_ORDER[k]; if (f === pre || (!pre.endsWith(".jpg") && f.startsWith(pre))) return k; }
  return 50;
}

async function loadBrochure(env, it, recName) {
  const dirs = [];
  if (it.d && it.i != null) dirs.push(it.d + "_" + it.i);
  if (it.d && Array.isArray(it.is)) for (const i of it.is) if (!dirs.includes(it.d + "_" + i)) dirs.push(it.d + "_" + i);
  for (const n of [it.n].concat(it.a || [])) dirs.push("name_" + slug(n));
  const names = [it.n].concat(it.a || []).map(stemKey);
  for (const dir of dirs) {
    const br = await kvJson(env, brochureKvName(dir));
    if (!br) continue;
    // the name on the brochure must agree with the record, or the brochure belongs to another building
    if (br.name && !names.includes(stemKey(br.name))) return { dir, refused: "the brochure is for " + br.name + ", not " + recName };
    if (isPortal(br.source_url)) return { dir, refused: "the brochure's source is a listing portal" };
    br.photos = (br.photos || []).filter((p) => p && p.key && !isPortal(p.source_url) && !isPortal(p.page_url));
    return { dir, br };
  }
  return null;
}

export async function loadContext(env, q, opts) {
  const need = (opts && opts.need) || {};
  const C = { today: todayLong(opts && opts.now), pages: 0, logo: await kvDataUrl(env, HEADER_IMG_KEY, opts && opts.origin), district: {}, recs: [], missing: [] };
  C.ri = await kvJson(env, "rent_index");
  if (!C.ri || !Array.isArray(C.ri.items)) return Object.assign(C, { error: "the rent index (img_rent_index) is not in storage" });
  const geo = await kvJson(env, "districts_geo");
  C.dname = {}; for (const d of ((geo && geo.districts) || [])) C.dname[d.slug] = d.name;
  C.amen = need.amen === false ? null : await kvJson(env, "amenities");
  const B = BEDS[q.beds];
  for (const key of q.keys) {
    const it = findItem(C.ri, key);
    if (!it) { C.missing.push(key); continue; }
    const set = q.type === "villa" ? it.v : it.b;
    const st = (set && set[B.band]) || null;
    const d = it.d || null;
    if (d && !C.district[d]) {
      C.district[d] = {
        name: C.dname[d] || pretty(it.area) || d,
        unitmix: await kvJson(env, "unitmix_" + d),
        bedsLeft: q.mode === "rent" ? await kvJsonGz(env, "beds_left_" + d) : null,   // read exactly as /brief_api reads it (plain or gzipped)
        tenancy: await kvJson(env, "tenancy_" + d),
        units: need.units ? await kvJson(env, "units_" + d) : null, layer: need.map ? await kvJson(env, "brief_fp_" + d) : null,
      };
    }
    const D = d ? C.district[d] : null;
    const um = D && D.unitmix && D.unitmix.buildings_by_id && it.i != null ? D.unitmix.buildings_by_id[String(it.i)] : null;
    const tn = D && D.tenancy && D.tenancy.buildings_by_id && it.i != null ? D.tenancy.buildings_by_id[String(it.i)] : null;
    const un = D && D.units && D.units.buildings_by_id && it.i != null ? D.units.buildings_by_id[String(it.i)] : null;
    const bro = await loadBrochure(env, it, it.n);
    const br = bro && bro.br;
    const name = br && br.name ? br.name : pretty(it.n);
    const pos = isFinite(it.lat) && isFinite(it.lon) ? [it.lat, it.lon] : null;
    const rec = { key, it, st, d, dist: D ? D.name : pretty(it.area), um, tn, un, br, brRefused: bro && bro.refused, brDir: bro && bro.dir,
                  name, aliases: (it.a || []).map(pretty).filter((a) => stemKey(a) !== stemKey(name)), pos, exact: it.i != null && !!pos, n: C.recs.length + 1 };
    if (br) {
      const ext = br.photos.find((p) => /^exterior/.test(p.file || ""));
      rec.hero = ext ? await kvDataUrl(env, ext.key, opts && opts.origin) : null;
      rec.heroPhoto = ext || null;
      if (need.photos) {
        const extra = br.photos.filter((p) => !/^exterior/.test(p.file || "") && photoRank(p) < 99).sort((a, b) => photoRank(a) - photoRank(b)).slice(0, 4);
        rec.photos = [];
        for (const p of extra) { const u = await kvDataUrl(env, p.key, opts && opts.origin); if (u) rec.photos.push(Object.assign({ src: u }, p)); }
      }
    }
    C.recs.push(rec);
  }
  return C;
}

// ------------------------------------------------------------------------------------------------ facts and figures
function nearestMetro(C, pos) {
  let best = null;
  for (const i of ((C.amen && C.amen.items) || [])) {
    if (i.k !== "metro" || i.ap) continue;
    const d = km(pos, [i.lat, i.lon]);
    if (!best || d < best.d) best = { d, n: String(i.n || "").replace(/\s+Metro Station$/i, "") };
  }
  return best;
}
const roughPoint = (i) => i.ap || (Math.abs(i.lat * 100 - Math.round(i.lat * 100)) < 1e-9 && Math.abs(i.lon * 100 - Math.round(i.lon * 100)) < 1e-9);
function nearest(C, pos, k, n) {
  return ((C.amen && C.amen.items) || []).filter((i) => i.k === k && !roughPoint(i) && isFinite(i.lat) && isFinite(i.lon))
    .map((i) => ({ i, d: km(pos, [i.lat, i.lon]) })).sort((a, b) => a.d - b.d).slice(0, n);
}
const cleanName = (s) => pretty(String(s || "").replace(/\s*[-,]?\s*\b(L\.?\s?L\.?\s?C\.?|FZ-?LLC|FZE|Br(anch)? of.*)\s*$/i, "").trim());
const kmTxt = (d) => d.toFixed(1) + " km";

function facts(rec) {
  const out = [];
  if (rec.br && rec.br.developer) out.push(["DEVELOPER", rec.br.developer]);
  if (rec.br && rec.br.completed) out.push(["COMPLETED", rec.br.completed]);
  // the unit-mix record can be one tower of a multi-building project (Bloom Towers is filed as "Bloom Towers B"): its floors are that
  // tower's, its homes the project's, and the record's own name is never printed
  const nb = rec.um && rec.um.dld && rec.um.dld.buildings > 1 ? rec.um.dld.buildings : 0;
  if (rec.um && rec.um.floors) out.push(["HEIGHT", rec.um.floors + " floors" + (nb ? " (one of " + nb + " buildings)" : "")]);
  if (rec.um && rec.um.total_units) out.push(["HOMES", rec.um.total_units + " homes" + (nb ? " in " + nb + " buildings" : "")]);
  return out;
}
function strap(rec) {
  if (rec.br && rec.br.strap) return rec.br.strap;
  const nb = rec.um && rec.um.dld && rec.um.dld.buildings > 1 ? rec.um.dld.buildings : 0;
  if (nb) return (NUMWORD[nb] || nb) + " residential buildings in " + rec.dist;
  const f = rec.um && rec.um.floors;
  return (f ? (f >= 12 ? "A " + f + "-floor residential tower" : "A " + f + "-floor residential building") : "A residential building") + " in " + rec.dist;
}
// The "left" estimate is NOT computed here. It is estimateLeft() in src/brief.js - the one function the /brief_api list row calls - so
// the figure on the document is the figure on the list, always: the beds-left register (img_beds_left_<district>) first, matched by
// key then by DLD project name including the "also filed as" names; the old gated tenancy path only where the register is missing.
// This adapter only turns its answer into what the boxes print: {T, R, est, as_at} or {why}.
export function leftFigures(rec, beds, district) {
  const D = district || {}, B = BEDS[beds];
  const e = estimateLeft({ BL: D.bedsLeft || null, card: rec.um || null, ten: D.tenancy || null,
    c: { key: candidateKey(rec.it), name: rec.it.n, aliases: rec.it.a || [], i: rec.it.i == null ? null : rec.it.i }, bed: +B.band });
  if (!e || e.withheld) return { why: (e && e.withheld) || "no estimate could be read" };
  // never print "about 0": rounded to ten, nothing left means the register shows a tenancy on nearly every one
  if (!e.about) return { T: e.of, R: e.running, why: "the register shows a running tenancy for nearly every one of its " + e.of + " " + B.word + " flats" };
  return { T: e.of, R: e.running, est: e.about, as_at: e.as_at || "" };
}
const leftOf = (C, rec, q) => leftFigures(rec, q.beds, rec.d ? C.district[rec.d] : null);

function leftBlock(C, rec, q) {
  const B = BEDS[q.beds], L = leftOf(C, rec, q);
  const head = '<div class="lbl" style="font-size:9.5px;">ESTIMATED ' + B.pl + " LEFT</div>";
  if (L.est == null) {
    return '<div class="leftbox" style="border:1px solid #E6E1D8;background:#FFFFFF;padding:12px 14px;display:flex;flex-direction:column;gap:6px;">' + head +
      '<div class="serif" style="font-size:20px;color:' + NAVY + ';line-height:1.1;">No estimate yet for this building</div>' +
      '<div style="font-size:11.5px;color:' + INK + ';line-height:1.45;">We give this figure only where the government registers can be read for this one building, and here they cannot yet: ' +
      esc(L.why) + ". Where it is given it is an estimate, not a count: no government source records vacancy, so the leasing team confirms what is on the market.</div></div>";
  }
  return '<div class="leftbox" style="border:1px solid #E6E1D8;background:#FFFFFF;padding:12px 14px;display:flex;flex-direction:column;gap:6px;">' + head +
    '<div style="display:flex;align-items:baseline;gap:10px;"><span class="serif" style="font-size:29px;color:' + GOLD + ';line-height:1;">about ' + L.est +
    '</span><span style="font-size:12px;color:' + MUTED + ';">of ' + L.T + " " + B.word + " flats in the building</span></div>" +
    '<div style="font-size:11.5px;color:' + INK + ';line-height:1.45;">An estimate, not a count. Of the building\'s ' + L.T + " " + B.word + " flats, " + L.R +
    " have a tenancy contract running today on the government register, so about " + L.est + " do not. That group includes flats to let, but also owners living " +
    "in their own flat and renewals not yet registered, so the number actually free to rent is lower. No government source records vacancy; " +
    "the leasing team confirms what is on the market.</div></div>";
}

function budgetLine(st, q, B) {
  const X = q.max, m = st.m, q1 = st.q1, q3 = st.q3;
  const where = X < q1 ? "below most rents here" : X < m ? "just under the typical rent here" : X === m ? "right at the typical rent here" : X <= q3 ? "a little above the typical rent here" : "above most rents here";
  const share = X >= q3 ? "about three in four or more" : X >= m ? "at least half" : X >= q1 ? "between a quarter and a half" : "fewer than one in four";
  return "AED " + money(X) + " a year is " + where + ": " + share + " of the " + st.n + " " + B.word + " flats let here recently went for AED " + money(X) +
    " or less, typically about " + money(st.s * SQFT) + " sq ft.";
}

function rentSource(C, q, rec) {
  const ri = C.ri, B = BEDS[q.beds];
  return "Rents: Dubai Land Department tenancy contracts (Ejari), the pull of " + esc(ri.as_of || "") + (ri.source_file ? " (" + esc(ri.source_file) + ")" : "") +
    (rec && rec.it.area ? ", " + esc(pretty(rec.it.area)) : "") + ", " + B.word + " " + (q.type === "villa" ? "homes" : "flats") +
    " (bedrooms are read from the size - the register rarely records them), new and renewed contracts, each contract counted once. Where the record " +
    "files the same contracts under two names they are one building here." + (rec && rec.aliases.length ? " This building's contracts are also filed as &ldquo;" +
    rec.aliases.map(esc).join("&rdquo;, &ldquo;") + "&rdquo;." : "") + " Typical rent is the median; the middle half is the range the middle 50% of rents fall in.";
}

// ------------------------------------------------------------------------------------------------ the dossier: three pages
function thumb(rec, w, h) {
  if (rec.hero) return img(rec.hero, "width:" + w + "px;height:" + h + "px;object-fit:cover;display:block;", rec.name);
  return '<div style="width:' + w + "px;height:" + h + "px;background:#E9E5DD;display:flex;align-items:center;justify-content:center;font-size:9px;color:" + MUTED + ';text-align:center;">photos<br>to follow</div>';
}

function dossierSub(rec, q, i, of) {
  const B = BEDS[q.beds];
  return (i && of ? "OPTION " + i + " OF " + of : "OPTION") + " &middot; " + B.upper + " &middot; " + esc(rec.dist).toUpperCase();
}

function whereLines(C, rec) {
  if (!rec.pos) return ["Distances not shown: our map position for this building is not yet verified"];
  const out = [];
  const m = nearestMetro(C, rec.pos);
  if (m) out.push("Nearest metro: " + esc(m.n) + ", " + kmTxt(m.d));
  for (const [n, la, lo] of REF) out.push(n + ": " + kmTxt(km(rec.pos, [la, lo])));
  out.push("All straight-line distances" + (rec.exact ? "" : ", from an approximate position"));
  return out;
}
function nearbyLines(C, rec) {
  if (!rec.pos) return ["Schools and clinics: to follow, once the building's position is verified"];
  const sc = nearest(C, rec.pos, "school", 3), cl = nearest(C, rec.pos, "clinic", 3);
  const out = [];
  if (sc.length) out.push("Schools: " + sc.map((s) => esc(cleanName(s.i.n)) + " (" + (s.i.x ? esc(String(s.i.x).split(" · ")[0]) + ", " : "") + kmTxt(s.d) + ")").join(", "));
  if (cl.length) out.push("Clinics: " + cl.map((s) => esc(cleanName(s.i.n)) + " (" + kmTxt(s.d) + ")").join(", "));
  return out.length ? out : ["Schools and clinics: none in the registers we hold near this building"];
}

function dossierPage1(C, rec, q, sub) {
  const B = BEDS[q.beds], st = rec.st;
  const hero = rec.hero ? img(rec.hero, "width:702px;height:300px;object-fit:cover;display:block;object-position:center 38%;", rec.name)
    : '<div style="width:702px;height:120px;background:#E9E5DD;display:flex;align-items:center;justify-content:center;font-size:13px;color:' + MUTED + ";\">Photos to follow &mdash; the developer's own pictures are being verified</div>";
  const F = facts(rec);
  const factHtml = F.length ? '<div style="display:grid;grid-template-columns:' + (F.length === 4 ? "0.9fr 0.9fr 1.4fr 0.8fr" : "repeat(" + F.length + ",minmax(0,1fr))") + ';gap:12px;">' +
    F.map(([k, v]) => '<div style="display:flex;flex-direction:column;gap:3px;"><div class="lbl" style="font-size:10px;">' + k + '</div><div style="font-size:13px;">' + esc(v) + "</div></div>").join("") + "</div>" : "";
  const stat = (v, l) => '<div style="display:flex;flex-direction:column;gap:3px;"><div class="lbl" style="font-size:9.5px;">' + l + '</div><div style="font-size:15px;font-weight:500;color:' + NAVY + ';white-space:nowrap;">' + v + "</div></div>";
  const rentLbl = "TYPICAL " + (q.beds === "studio" ? "STUDIO" : q.beds === "3" ? "3+ BED" : q.beds + "-BED") + " RENT A YEAR";
  const rent = st ? '<div style="display:grid;grid-template-columns:1.3fr 1.2fr 0.8fr 0.9fr;gap:12px;align-items:end;border:1px solid #E6E1D8;background:#FFFFFF;padding:11px 14px;">' +
    '<div style="display:flex;flex-direction:column;gap:3px;"><div class="lbl" style="font-size:9.5px;">' + rentLbl + '</div><div class="serif" style="font-size:29px;color:' + GOLD + ';line-height:1;white-space:nowrap;">AED ' + money(st.m) + "</div></div>" +
    stat("AED " + money(st.q1) + " &ndash; " + money(st.q3), "MIDDLE HALF") + stat(String(st.n), "RECENT LETTINGS") + stat(money(st.s * SQFT) + " sq ft", "TYPICAL SIZE") + "</div>" +
    (q.max ? '<div style="font-size:12px;color:' + INK + ';line-height:1.45;"><b>What AED ' + money(q.max) + " gets you here.</b> " + budgetLine(st, q, B) + "</div>" : "")
    : '<div style="border:1px solid #E6E1D8;background:#FFFFFF;padding:11px 14px;font-size:12px;color:' + INK + ';">No ' + B.word + " lettings for this building in the latest pull of the tenancy register, so no typical rent is shown.</div>";
  const amen = ((rec.br && rec.br.amenities) || []).map((a) => '<div style="font-size:11.5px;color:' + NAVY + ';line-height:1.35;">&#8226; ' + esc(a) + "</div>").join("") ||
    '<div style="font-size:11.5px;color:' + MUTED + ';">To follow</div>';
  const lines = (xs) => xs.map((x) => '<div style="font-size:11.5px;color:' + NAVY + ';line-height:1.35;">' + x + "</div>").join("");
  const cards = '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px;">' +
    '<div class="card" style="padding:10px;"><div class="lbl" style="font-size:9.5px;">AMENITIES</div>' + amen + "</div>" +
    '<div class="card" style="padding:10px;"><div class="lbl" style="font-size:9.5px;">WHERE IT IS</div>' + lines(whereLines(C, rec)) + "</div>" +
    '<div class="card" style="padding:10px;"><div class="lbl" style="font-size:9.5px;">NEARBY</div>' + lines(nearbyLines(C, rec)) + "</div></div>";
  const title = '<div style="display:flex;flex-direction:column;gap:4px;"><div class="serif" style="font-size:33px;color:' + NAVY + ';line-height:1;">' + esc(rec.name) +
    '</div><div style="font-size:13px;color:' + MUTED + ';">' + esc(strap(rec)) + "</div></div>";
  return page(C, sub, hero + title + factHtml + rent + cards, "");   // page 1 carries no sources in the approved layout; they are on page 3
}
function buildingSource(rec) {
  const bits = [];
  if (rec.um) bits.push("floors and homes from the Dubai Land Department units register" + (rec.um.as_of ? " (" + esc(rec.um.as_of) + ")" : ""));
  if (rec.br && rec.br.developer) bits.push("developer from the developer's own project page");
  return bits.length ? "The building: " + bits.join("; ") + "." : "";
}
const nearbySource = () => "Metro: RTA station register. Schools (with their KHDA inspection rating) and clinics (Dubai Health Authority licence register): the nearest to this building, straight-line distances, not walking or driving times.";
function pictureSource(rec) {
  if (!rec.br) return rec.brRefused ? "Pictures and amenities: not shown - " + esc(rec.brRefused) + "." : "Pictures and amenities: to follow from the developer's own project page.";
  return "Pictures and amenities: the developer's own project page, " + esc(rec.br.source_url || "not yet verified") + (rec.br.retrieved ? ", retrieved " + esc(rec.br.retrieved) : "") + ". " +
    esc(rec.br.amenities_note || rec.br.photos_note || "");
}

const MAP_TO_FOLLOW = (h) => '<div class="maptofollow" style="height:' + h + 'px;border:1px dashed #DED9D0;display:flex;align-items:center;justify-content:center;font-size:14px;color:' + MUTED + ';">Map to follow</div>';

function dossierPage2(C, rec, q, sub) {
  const D = C.district[rec.d] || {};
  const mark = markOf(rec, D.layer);
  const svg = D.layer && mark.placed ? briefMapSvg(D.layer, [mark], { single: true, district: rec.dist, districtSlug: rec.d }) : "";
  const map = svg ? '<div style="width:702px;border:1px solid #E6E1D8;line-height:0;">' + svg.replace("<svg ", '<svg style="width:700px;height:auto;display:block;" ') + "</div>" : MAP_TO_FOLLOW(468);
  const body = '<div class="serif" style="font-size:24px;color:' + NAVY + ';">Where it is</div><div class="sub">The building in gold on its own plot, among the other buildings of ' + esc(rec.dist) +
    ". Simple blocks, heights to scale, seen from the south.</div>" + map + leftBlock(C, rec, q);
  const L = leftOf(C, rec, q);
  return page(C, sub, body, smallPrint([
    svg ? "Map: footprints and streets &copy; OpenStreetMap contributors; building position from the app's district model" + (mark.approx ? " (this one approximate, from a public map listing)" : "") + "." : "Map: to follow - " + (D.layer ? "this building has no verified map position yet" : "the district map layer is not yet published") + ".",
    (L.est == null ? "Estimate: none given for this building. Where one is given it is " : "Estimate: ") + "Dubai Land Department units list and tenancy register" + (L.as_at ? " (contracts running on " + esc(L.as_at) + ")" : "") + " - " +
    BEDS[q.beds].word + " flats in this building less the " + BEDS[q.beds].word + " contracts running, rounded to the nearest ten. Contracts that do not name the building never reach it, so the count of running contracts is a minimum."]));
}

function groupLayouts(rec, B) {
  const flats = [];
  for (const [fl, us] of Object.entries(rec.un.floors)) for (const u of us) if (B.uc(String(u.c)) && u.sqft) flats.push({ fl: +fl, sqft: u.sqft, bal: u.bal || 0 });
  if (!flats.length) return null;
  // flats of the same size and balcony share a layout; sizes within 3 sq ft are the same layout measured twice
  const groups = [];
  for (const f of flats.sort((a, b) => a.sqft - b.sqft || a.bal - b.bal)) {
    const g = groups.find((x) => Math.abs(x.sqft - f.sqft) <= 3 && Math.abs(x.bal - f.bal) <= 3);
    if (g) { g.n++; g.lo = Math.min(g.lo, f.sqft); g.hi = Math.max(g.hi, f.sqft); g.blo = Math.min(g.blo, f.bal); g.bhi = Math.max(g.bhi, f.bal); g.fl.push(f.fl); }
    else groups.push({ sqft: f.sqft, bal: f.bal, n: 1, lo: f.sqft, hi: f.sqft, blo: f.bal, bhi: f.bal, fl: [f.fl] });
  }
  groups.sort((a, b) => b.n - a.n);
  return { total: flats.length, top: groups.filter((g) => g.n > 1).slice(0, 8), other: groups.length - Math.min(8, groups.filter((g) => g.n > 1).length) };
}
function layoutsBlock(rec, q) {
  const B = BEDS[q.beds], st = rec.st;
  const rng = (a, b) => a === b ? String(a) : a + "&ndash;" + b;
  let table = "", intro = "";
  const G = rec.un && rec.un.floors ? groupLayouts(rec, B) : null;
  if (G && G.top.length) {
    const rows = G.top.map((g, k) => { const fl = g.fl.sort((a, b) => a - b); return ["Layout " + String.fromCharCode(65 + k), String(g.n), rng(fl[0], fl[fl.length - 1]), rng(g.lo, g.hi), g.bhi ? rng(g.blo, g.bhi) : "none"]; });
    if (G.other > 0) rows.push([G.other + " other " + B.word + " layout" + (G.other > 1 ? "s" : ""), "&mdash;", "&mdash;", "&mdash;", "&mdash;"]);
    table = tbl([["left", "LAYOUT"], ["right", "FLATS"], ["left", "FLOORS"], ["right", "SIZE, SQ FT"], ["right", "BALCONY, SQ FT"]], rows);
    intro = esc(rec.name) + " has " + G.total + " " + B.word + " flats. Flats of the same size and balcony share a layout; the commonest are listed. Sizes include the balcony. " +
      (st ? "The rent register does not say which layout was let, so the typical rent above covers all of them (AED " + money(st.m) + ", " + st.n + " recent lettings)." : "");
  } else if (rec.um && Array.isArray(rec.um.rows) && rec.um.rows.some((r) => B.tn(r.type))) {
    const rows = rec.um.rows.filter((r) => B.tn(r.type)).map((r) => [esc(pretty(r.type)), String(r.units || "&mdash;"), esc(r.levels || "&mdash;"), r.median_sqm ? money(r.median_sqm * SQFT) : "&mdash;",
      st ? "AED " + money(st.m) + " &middot; " + st.n + " let" : "none let recently"]);
    table = tbl([["left", "TYPE"], ["right", "FLATS"], ["left", "FLOORS"], ["right", "TYPICAL SIZE, SQ FT"], ["right", "RENTED RECENTLY"]], rows);
    intro = "A flat-by-flat list of this building's layouts is not yet in our files, so here is its " + B.word + " count from the Land Department units register, with the typical size. Sizes include the balcony.";
  } else if (st) {
    table = tbl([["left", "SIZE THAT WAS LET"], ["right", "TYPICAL RENT"], ["right", "HOW MANY"], ["right", "MIDDLE HALF, AED"]],
      [["about " + money(st.s * SQFT) + " sq ft", "AED " + money(st.m), String(st.n), money(st.q1) + " &ndash; " + money(st.q3)]]);
    intro = "A flat-by-flat list of this building's layouts is not yet in our files, so here is what the " + B.word + " flats that were actually let this month were like. Sizes include the balcony.";
  } else {
    intro = "A flat-by-flat list of this building's layouts is not yet in our files, and no " + B.word + " lettings are on record for it in the latest pull.";
  }
  return '<div style="display:flex;flex-direction:column;gap:6px;"><div class="serif" style="font-size:20px;color:' + NAVY + ';">The ' + B.word + " layouts</div>" +
    '<div style="font-size:11.5px;color:' + MUTED + ';line-height:1.42;">' + intro + "</div>" + table + "</div>";
}
function dossierPage3(C, rec, q, sub) {
  const ph = rec.photos || [];
  const photos = ph.length ? '<div style="display:grid;grid-template-columns:repeat(' + Math.min(4, ph.length) + ',minmax(0,1fr));gap:8px;">' + ph.map((p) =>
    '<div style="display:flex;flex-direction:column;gap:2px;">' + img(p.src, "width:100%;height:112px;object-fit:cover;display:block;", p.caption) +
    '<div style="font-size:9.5px;color:' + MUTED + ';">' + esc(String(p.caption || "").split(" (")[0].split(" - ").pop()) + "</div>" +
    '<div style="font-size:8px;color:#8C887C;">' + esc(hostOf(p.page_url || (rec.br && rec.br.source_url)) || "developer's page") + "</div></div>").join("") + "</div>"
    : '<div style="font-size:11px;color:' + MUTED + ";border:1px dashed #DED9D0;padding:8px 10px;\">The developer's page publishes no pictures of the pool, gym or lobby and no floor plans. Ask the leasing team or listing broker for photographs of the actual flat.</div>";
  return page(C, sub, '<div class="serif" style="font-size:24px;color:' + NAVY + ';">' + esc(rec.name) + "</div>" + photos + layoutsBlock(rec, q),
    smallPrint([rentSource(C, q, rec), buildingSource(rec), rec.un ? "Layouts: Dubai Land Department units register, flat by flat." : "", nearbySource(), pictureSource(rec)]));
}
export function dossierHtml(C, rec, q, i, of) {
  const sub = dossierSub(rec, q, i, of);
  return dossierPage1(C, rec, q, sub) + dossierPage2(C, rec, q, sub) + dossierPage3(C, rec, q, sub);
}

// ------------------------------------------------------------------------------------------------ the one-sheet (A4 landscape)
function titleOf(C, q) {
  const B = BEDS[q.beds], n = C.recs.length;
  const ds = [...new Set(C.recs.map((r) => r.dist))];
  const where = ds.length === 1 ? ds[0] : ds.length === 2 ? ds.join(" and ") : ds.length + " districts";
  const count = n <= 10 ? NUMWORD[n] : String(n);
  const budget = q.min && q.max && q.min < q.max ? ", AED " + money(q.min) + "&ndash;" + money(q.max) + " a year" : q.max ? ", around AED " + money(q.max) + " a year" : "";
  return count + " " + B.word + " option" + (n === 1 ? "" : "s") + " in " + esc(where) + budget;
}
// the card's "Still filling" line shows whenever the dossier's box gives an estimate (the same estimateLeft figure), never otherwise
function stillFilling(C, rec, q) {
  return leftOf(C, rec, q).est != null;
}
function oneSheetCards(C, q) {
  const B = BEDS[q.beds];
  let anyFill = false;
  const cards = C.recs.map((rec) => {
    const st = rec.st;
    const metro = rec.pos ? (() => { const m = nearestMetro(C, rec.pos); return m ? esc(m.n) + " metro, " + kmTxt(m.d) : "Metro distance to follow"; })() : "Metro distance to follow";
    const amen = ((rec.br && rec.br.amenities) || []).slice(0, 3).map((a) => esc(a.split(" (")[0])).join(", ") || "Amenities to follow";
    const fill = stillFilling(C, rec, q); anyFill = anyFill || fill;
    return '<div class="bcard" style="border:1px solid #E6E1D8;background:#FFF;display:flex;flex-direction:column;overflow:hidden;min-height:0;">' +
      '<div style="position:relative;">' + thumb(rec, 199, 136).replace("width:199px", "width:100%") + '<div style="position:absolute;left:6px;top:6px;width:24px;height:24px;border-radius:12px;background:' + NAVY +
      ';color:#FFF;font-weight:600;font-size:13px;display:flex;align-items:center;justify-content:center;">' + rec.n + "</div></div>" +
      '<div style="padding:7px 9px 8px 9px;display:flex;flex-direction:column;gap:3px;">' +
      '<div class="serif" style="font-size:16px;color:' + NAVY + ';line-height:1.05;">' + esc(rec.name) + "</div>" +
      (st ? '<div style="display:flex;align-items:baseline;gap:6px;"><span class="serif" style="font-size:20px;color:' + GOLD + ';">AED ' + money(st.m) + '</span><span style="font-size:9.5px;color:' + MUTED + ';">typical a year</span></div>' +
        '<div style="font-size:10px;color:' + INK + ';">Middle half AED ' + money(st.q1) + "&ndash;" + money(st.q3) + "</div>" +
        '<div style="font-size:10px;color:' + INK + ';">' + st.n + " recent lettings &middot; about " + money(st.s * SQFT) + " sq ft</div>"
        : '<div style="font-size:10px;color:' + INK + ';">No ' + B.word + " lettings in the latest pull</div>") +
      '<div style="font-size:9.8px;color:' + MUTED + ';line-height:1.25;">' + amen + "</div>" +
      '<div style="font-size:9.8px;color:' + NAVY + ';line-height:1.25;">' + metro + "</div>" +
      (fill ? '<div style="font-size:9.5px;color:' + GOLD + ';line-height:1.25;border-top:1px solid #EFEBE4;padding-top:3px;">Still filling: most of its ' + B.short + " have no running tenancy on the government register*</div>" : "") +
      "</div></div>";
  }).join("");
  const cols = Math.min(5, Math.max(3, C.recs.length));
  return { anyFill, html: '<div style="flex:1;display:grid;grid-template-columns:repeat(' + cols + ',minmax(0,1fr));grid-template-rows:repeat(' + Math.ceil(C.recs.length / cols) + ',minmax(0,1fr));min-height:0;gap:9px;padding:10px 30px 6px 30px;">' + cards + "</div>" };
}
const landFooter = () => '<div class="curator" style="border-top:1px solid #DED9D0;margin:0 30px;padding:5px 0 9px 0;display:flex;justify-content:center;align-items:center;gap:8px;font-size:12px;color:' + NAVY + ';">' + CURATOR + "</div>";
function landPage(C, inner) { C.pages++; return '<div class="sheet page land" style="width:1123px;height:794px;">' + inner + "</div>"; }

export function oneSheetHtml(C, q) {
  const B = BEDS[q.beds];
  const { html, anyFill } = oneSheetCards(C, q);
  const p1 = landPage(C, '<div style="height:74px;display:flex;align-items:center;justify-content:space-between;padding:0 30px;background:#FFF;border-bottom:1px solid #E6E1D8;flex-shrink:0;">' +
    '<div style="display:flex;flex-direction:column;gap:3px;"><div class="serif" style="font-size:26px;color:' + NAVY + ';line-height:1;">' + titleOf(C, q) + "</div>" +
    '<div style="font-size:11px;color:' + MUTED + ';">' + C.today + " &middot; numbers match the map &middot; rents are rents recently agreed, not asking prices</div></div>" + logo(C, 68) + "</div>" +
    html +
    '<div style="padding:0 30px 4px 30px;font-size:8.3px;color:' + MUTED + ';line-height:1.3;">Rents: Dubai Land Department tenancy contracts, the pull of ' + esc(C.ri.as_of || "") + ", " + B.word +
    "-sized " + (q.type === "villa" ? "homes" : "flats") + ", each contract counted once. Metro distances are straight lines. Pictures: each developer's own project page." +
    (anyFill ? " *Dubai Land Department units list and tenancy register: in each building marked, most " + B.word + " flats have no tenancy contract running today &mdash; the buildings are still filling. " +
      "That is not a count of flats to let (owners living in them and late renewals look the same)." : "") +
    " Availability, the rent and the actual flat must be confirmed with the leasing team or listing broker.</div>" + landFooter());
  return p1 + overviewMapPages(C, q);
}

// one overview page per district the chosen buildings sit in (a map is one district's layer; the numbers still match the cards)
function overviewMapPages(C, q) {
  const byD = {};
  for (const r of C.recs) (byD[r.d || "_"] = byD[r.d || "_"] || []).push(r);
  return Object.entries(byD).map(([d, recs]) => {
    const D = C.district[d] || {};
    const marks = recs.map((r) => markOf(r, D.layer));
    const svg = D.layer && marks.some((m) => m.placed) ? briefMapSvg(D.layer, marks, { single: false, district: recs[0].dist, districtSlug: d, q }) : "";
    return landPage(C, '<div style="flex:1;display:flex;align-items:center;justify-content:center;padding:14px 30px 4px 30px;">' +
      (svg ? svg.replace("<svg ", '<svg style="width:1040px;max-height:700px;height:auto;display:block;" ') : '<div style="width:1040px;">' + MAP_TO_FOLLOW(640) + "</div>") + "</div>" + landFooter());
  }).join("");
}

// ------------------------------------------------------------------------------------------------ the pack's appendix
export function matchAll(C, q) {
  const B = BEDS[q.beds];
  const ds = q.areas.length ? q.areas : [...new Set(C.recs.map((r) => r.d).filter(Boolean))];
  const lo = q.min || 0, hi = q.max ? q.max * 1.03 : Infinity;   // Contract A's "within": median within +3% of max and >= min
  return C.ri.items.filter((it) => (!ds.length || ds.includes(it.d))).map((it) => ({ it, st: ((q.type === "villa" ? it.v : it.b) || {})[B.band] }))
    .filter((x) => x.st && x.st.n >= 3 && x.st.m >= lo && x.st.m <= hi).sort((a, b) => b.st.n - a.st.n);
}
function appendixHtml(C, q) {
  const all = matchAll(C, q), CAP = 30;
  const rows = all.slice(0, CAP).map(({ it, st }) => [esc(pretty(it.n)) + ((it.a || []).length ? ' <span style="color:' + MUTED + ';font-size:9.5px;">(also filed as ' + esc(it.a.map(pretty).join(", ")) + ")</span>" : ""),
    "AED " + money(st.m), money(st.q1) + "&ndash;" + money(st.q3), String(st.n), money(st.s * SQFT) + " sq ft", esc(st.last || it.last || "")]);
  const B = BEDS[q.beds];
  const body = '<div style="display:flex;flex-direction:column;gap:3px;"><div class="serif" style="font-size:24px;color:' + NAVY + ';">Appendix &mdash; every building this brief matches</div>' +
    '<div class="sub">Every building whose typical ' + B.word + " rent in the latest pull is" + (q.min ? " at least AED " + money(q.min) + " and" : "") + (q.max ? " within 3% of AED " + money(q.max) : " on record") +
    " (" + all.length + " buildings" + (all.length > CAP ? ", the " + CAP + " with most lettings shown" : "") + "), most lettings first. Buildings with few lettings give a less certain figure.</div></div>" +
    tbl([["left", "BUILDING"], ["right", "TYPICAL RENT"], ["right", "MIDDLE HALF, AED"], ["right", "LETTINGS"], ["right", "TYPICAL SIZE"], ["right", "LATEST LETTING"]], rows);
  return page(C, "APPENDIX &middot; " + B.upper + (C.recs[0] ? " &middot; " + esc(C.recs[0].dist).toUpperCase() : ""), body, smallPrint([rentSource(C, q, null)]));
}
export function packHtml(C, q) {
  return oneSheetHtml(C, q) + C.recs.map((r) => dossierHtml(C, r, q, r.n, C.recs.length)).join("") + appendixHtml(C, q);
}

// ------------------------------------------------------------------------------------------------ the LOD 100 map (make_map.py, as SVG)
// View: camera looks north, tilted 50 degrees down; heights to scale. A 1500 x 1000 canvas stands for make_map's 15 x 10 inch figure
// (100 px per inch), so a matplotlib size of s points is s * 100 / 72 px here.
const ELEV = 50 * Math.PI / 180, KY = Math.sin(ELEV), KH = Math.cos(ELEV), PT = 100 / 72;
const MAPC = { TEAL: "#0A4F4A", GOLD: "#C5A56A", GOLD_WALL: "#A98A4F", GOLD_EDGE: "#7A6230", BG: "#F6F4EE", CTX_ROOF: "#E9E9E4", CTX_WALL: "#D3D4CE", CTX_EDGE: "#BFC1BA", STREET: "#FFFFFF", CASE: "#D9D5CA" };
const CLS_W = [0.6, 0.8, 1.3, 1.0, 1.0, 1.0, 2.0, 2.6, 2.8, 3.2];   // residential ... motorway, the order brief_map_layers.py writes

// where a building goes on its district's layer: its own footprint (exact), else an indicative block at a map-listing pin (approximate)
export function markOf(rec, layer) {
  const base = { n: rec.n, name: rec.name, placed: false, approx: false };
  if (!layer) return base;
  const ids = [rec.it.i].concat(rec.it.is || []).filter((x) => x != null);
  if (ids.length && layer.b.some((b) => ids.includes(b[0]))) return Object.assign(base, { placed: true, ids });
  if (rec.pos && Array.isArray(layer.ll)) {
    const [a, b, c, d, e, f] = layer.ll, lat = rec.pos[0], lon = rec.pos[1];
    const floors = rec.um && rec.um.floors;
    return Object.assign(base, { placed: true, approx: true, xy: [a * lon + b * lat + c, d * lon + e * lat + f], side: 40, h: floors ? floors * 3.4 : 30 });
  }
  return base;
}

export function briefMapSvg(layer, marks, o) {
  const pairs = (f) => { const r = []; for (let k = 0; k + 1 < f.length; k += 2) r.push([f[k], f[k + 1]]); return r; };
  const hiById = new Map();
  for (const m of marks) if (m.placed && m.ids) for (const i of m.ids) hiById.set(i, m);
  const blds = layer.b.map(([i, h, f]) => ({ r: pairs(f), h, kind: hiById.has(i) ? "hi" : "ctx", m: hiById.get(i) || null }));
  for (const m of marks) if (m.placed && m.approx) {
    const [cx, cy] = m.xy, s = m.side / 2;
    blds.push({ r: [[cx - s, cy - s], [cx + s, cy - s], [cx + s, cy + s], [cx - s, cy + s], [cx - s, cy - s]], h: m.h, kind: "approx", m });
  }
  let X0 = Infinity, X1 = -Infinity, Y0 = Infinity, Y1 = -Infinity;
  for (const b of blds) for (const [x, y] of b.r) { if (x < X0) X0 = x; if (x > X1) X1 = x; if (y < Y0) Y0 = y; if (y > Y1) Y1 = y; }
  X0 -= 150; X1 += 150; Y0 -= 150; Y1 += 150;
  const OX = (X0 + X1) / 2, OY = Y0;
  const P = (x, y, h) => [x - OX, (y - OY) * KY + (h || 0) * KH];
  // the axes box: fig.add_axes([0.02, 0.03, 0.70, 0.84]) with an equal aspect, centred in the box
  const xmin = X0 - OX, xmax = X1 - OX, ymin = -20, ymax = (Y1 - OY) * KY + 260;
  const AX = 30, AY = 130, AW = 1050, AH = 840;
  const sc = Math.min(AW / (xmax - xmin), AH / (ymax - ymin));
  const bx = AX + (AW - (xmax - xmin) * sc) / 2, by = AY + (AH - (ymax - ymin) * sc) / 2;
  const S = ([u, v]) => [bx + (u - xmin) * sc, by + (ymax - v) * sc];
  const f1 = (n) => Math.round(n * 10) / 10;
  // whole canvas units (a canvas unit prints at 0.47 px on the dossier, 0.69 px on the one-sheet): a ten-building pack carries eleven
  // district maps, and this keeps each near half a megabyte instead of three quarters
  const path = (pts, close) => "M" + pts.map((p) => { const [a, b] = S(p); return Math.round(a) + " " + Math.round(b); }).join("L") + (close ? "Z" : "");
  const inBox = (x, y) => X0 < x && x < X1 && Y0 < y && y < Y1;
  const out = [];
  out.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 1000" width="1500" height="1000" font-family="DejaVu Sans, Arial, sans-serif">');
  out.push('<rect width="1500" height="1000" fill="' + MAPC.BG + '"/>');
  out.push('<clipPath id="ax"><rect x="' + f1(bx) + '" y="' + f1(by) + '" width="' + f1((xmax - xmin) * sc) + '" height="' + f1((ymax - ymin) * sc) + '"/></clipPath><g clip-path="url(#ax)">');
  // streets: casing under fill, minor classes first
  const st = (layer.s || []).map(([c, f]) => ({ c, r: pairs(f) })).filter((s) => s.r.some(([x, y]) => inBox(x, y)));
  for (const pass of [0, 1]) for (let c = 0; c < CLS_W.length; c++) {
    const d = st.filter((s) => s.c === c).map((s) => path(s.r.map(([x, y]) => P(x, y)), false)).join("");
    if (d) out.push('<path d="' + d + '" fill="none" stroke="' + (pass ? MAPC.STREET : MAPC.CASE) + '" stroke-width="' + f1((CLS_W[c] + (pass ? 0 : 1)) * PT) + '" stroke-linecap="round" stroke-linejoin="round"/>');
  }
  const rp = (layer.rp || []).map(pairs).filter((r) => r.some(([x, y]) => inBox(x, y)));
  if (rp.length) out.push('<path d="' + rp.map((r) => path(r.map(([x, y]) => P(x, y)), true)).join("") + '" fill="' + MAPC.STREET + '" stroke="' + MAPC.CASE + '" stroke-width="0.8" fill-rule="nonzero"/>');
  for (const [nm, f] of (layer.lab || [])) {
    const r = pairs(f); if (r.length < 3 || !r.every(([x, y]) => X0 + 250 < x && x < X1 - 250 && Y0 + 120 < y && y < Y1 - 120)) continue;
    const a = S(P(...r[0])), b = S(P(...r[2])), m = S(P(...r[1]));
    let ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
    out.push('<text x="' + f1(m[0]) + '" y="' + f1(m[1]) + '" transform="rotate(' + f1(ang) + " " + f1(m[0]) + " " + f1(m[1]) + ')" font-size="' + f1(6.5 * PT) + '" font-style="italic" fill="#8C887C" text-anchor="middle" dominant-baseline="middle" stroke="' + MAPC.BG + '" stroke-width="3" paint-order="stroke">' + esc(nm) + "</text>");
  }
  // blocks, painter's order: far (north) first
  const area = (r) => { let s = 0; for (let k = 0; k + 1 < r.length; k++) s += r[k][0] * r[k + 1][1] - r[k + 1][0] * r[k][1]; return s / 2; };
  blds.sort((a, b) => Math.min(...b.r.map((p) => p[1])) - Math.min(...a.r.map((p) => p[1])));
  for (const b of blds) {
    let r = b.r; if (area(r) < 0) r = r.slice().reverse();
    const [roof, wall, edge, lw] = b.kind === "ctx" ? [MAPC.CTX_ROOF, MAPC.CTX_WALL, MAPC.CTX_EDGE, 0.25] : b.kind === "hi" ? [MAPC.GOLD, MAPC.GOLD_WALL, MAPC.GOLD_EDGE, 0.5] : ["#E6D6B2", "#CDB684", MAPC.GOLD_EDGE, 0.6];
    const dash = b.kind === "approx" ? ' stroke-dasharray="4 2.5"' : "";
    const walls = [];
    for (let k = 0; k + 1 < r.length; k++) { const [x0, y0] = r[k], [x1, y1] = r[k + 1]; if (x1 - x0 > 0) walls.push([(y0 + y1) / 2, [P(x0, y0), P(x1, y1), P(x1, y1, b.h), P(x0, y0, b.h)]]); }
    walls.sort((a, c) => c[0] - a[0]);
    const cls = b.kind === "ctx" ? "" : ' class="' + (b.kind === "hi" ? "hiblock" : "approxblock") + '"';
    if (walls.length) out.push("<path" + cls + ' d="' + walls.map((w) => path(w[1], true)).join("") + '" fill="' + wall + '" stroke="' + edge + '" stroke-width="' + f1(lw * PT) + '" stroke-linejoin="round"' + dash + "/>");
    out.push("<path" + cls + ' d="' + path(r.map(([x, y]) => P(x, y, b.h)), true) + '" fill="' + roof + '" stroke="' + edge + '" stroke-width="' + f1(lw * PT) + '" stroke-linejoin="round"' + dash + "/>");
  }
  out.push("</g>");
  // badges: one per placed mark, lifted 110 m above its roof and pushed apart so none overlap
  const anch = new Map();
  for (const b of blds) {
    if (b.kind === "ctx") continue;
    const pts = b.r.slice(0, -1), cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    const cur = anch.get(b.m.n); if (!cur || cur[2] < b.h) anch.set(b.m.n, [cx, cy, b.h, b.m]);
  }
  const R = 38, pos = new Map(), roofPt = new Map();
  for (const [n, [cx, cy, h]] of anch) { const p = P(cx, cy, h); pos.set(n, [p[0], p[1] + 110]); roofPt.set(n, p); }
  const ns = [...pos.keys()];
  for (let it = 0; it < 400; it++) {
    let moved = false;
    for (const a of ns) for (const b of ns) {
      if (a >= b) continue;
      const pa = pos.get(a), pb = pos.get(b), dx = pb[0] - pa[0], dy = pb[1] - pa[1], d = Math.hypot(dx, dy) || 1e-6;
      if (d < 2 * R + 30) { const push = (2 * R + 30 - d) / 2 + 1, ux = dx / d, uy = dy / d; pa[0] -= ux * push; pa[1] -= uy * push; pb[0] += ux * push; pb[1] += uy * push; moved = true; }
    }
    if (!moved) break;
  }
  for (const [n, [bxd, byd]] of pos) {
    const m = anch.get(n)[3], rp2 = S(roofPt.get(n)), c = S([bxd, byd]), top = S([bxd, byd - R * 0.95]), rr = R * sc;
    out.push('<g class="badge"><line x1="' + f1(rp2[0]) + '" y1="' + f1(rp2[1]) + '" x2="' + f1(top[0]) + '" y2="' + f1(top[1]) + '" stroke="' + MAPC.TEAL + '" stroke-width="' + f1(0.9 * PT) + '" stroke-linecap="round"/>' +
      '<circle cx="' + f1(rp2[0]) + '" cy="' + f1(rp2[1]) + '" r="' + f1(Math.max(1.5, 7 * sc)) + '" fill="' + MAPC.TEAL + '"/>' +
      (m.approx ? '<circle cx="' + f1(c[0]) + '" cy="' + f1(c[1]) + '" r="' + f1(rr) + '" fill="#FFFFFF" stroke="' + MAPC.TEAL + '" stroke-width="' + f1(1.6 * PT) + '" stroke-dasharray="3 2"/>'
        : '<circle cx="' + f1(c[0]) + '" cy="' + f1(c[1]) + '" r="' + f1(rr) + '" fill="' + MAPC.TEAL + '" stroke="' + MAPC.GOLD + '" stroke-width="' + f1(1.8 * PT) + '"/>') +
      '<text x="' + f1(c[0]) + '" y="' + f1(c[1]) + '" font-size="' + f1(Math.min(11 * PT, rr * 1.2)) + '" font-weight="bold" fill="' + (m.approx ? MAPC.TEAL : "#FFFFFF") + '" text-anchor="middle" dominant-baseline="central">' + n + "</text></g>");
  }
  // scale bar (east-west is true scale in this view) and north arrow
  const sb = (u, v) => S([xmin + 120 + u, 40 + v]);
  const q0 = sb(0, 14), q1 = sb(250, 0), q2 = sb(500, 0);
  out.push('<rect x="' + f1(q0[0]) + '" y="' + f1(q0[1]) + '" width="' + f1(q1[0] - q0[0]) + '" height="' + f1(14 * sc) + '" fill="' + MAPC.TEAL + '"/>' +
    '<rect x="' + f1(q1[0]) + '" y="' + f1(q0[1]) + '" width="' + f1(q2[0] - q1[0]) + '" height="' + f1(14 * sc) + '" fill="#FFFFFF" stroke="' + MAPC.TEAL + '" stroke-width="1.1"/>');
  for (const [v, t] of [[0, "0"], [250, "250"], [500, "500 m"]]) { const p = sb(v, 30); out.push('<text x="' + f1(p[0]) + '" y="' + f1(p[1]) + '" font-size="' + f1(7 * PT) + '" fill="' + MAPC.TEAL + '" text-anchor="middle">' + t + "</text>"); }
  const cap = sb(0, -16); out.push('<text x="' + f1(cap[0]) + '" y="' + f1(cap[1] + 8) + '" font-size="' + f1(5.8 * PT) + '" fill="#8C887C">Scale applies east-west; north-south is foreshortened by the 50&#176; view.</text>');
  const nb = S([xmax - 110, (Y1 - OY) * KY + 60]), nt = S([xmax - 110, (Y1 - OY) * KY + 260]), aw = 9 * sc, hw = 30 * sc, hl = 60 * sc;
  out.push('<path d="M' + f1(nb[0] - aw) + " " + f1(nb[1]) + "L" + f1(nb[0] - aw) + " " + f1(nt[1] + hl) + "L" + f1(nb[0] - hw) + " " + f1(nt[1] + hl) + "L" + f1(nb[0]) + " " + f1(nt[1]) + "L" + f1(nb[0] + hw) + " " + f1(nt[1] + hl) +
    "L" + f1(nb[0] + aw) + " " + f1(nt[1] + hl) + "L" + f1(nb[0] + aw) + " " + f1(nb[1]) + 'Z" fill="' + MAPC.TEAL + '"/>' +
    '<text x="' + f1(nb[0]) + '" y="' + f1(nt[1] - 15 * sc - 4) + '" font-size="' + f1(13 * PT) + '" font-weight="bold" fill="' + MAPC.TEAL + '" text-anchor="middle">N</text>');
  // title, side panel, key
  const single = !!o.single, first = marks[0] || {};
  const dShort = DISTRICT_SHORT[o.districtSlug] || o.district || "";
  const B = o.q ? BEDS[o.q.beds] : null;
  const none = !marks.length;
  const title = single ? first.name + " · where it is in " + dShort
    : none ? dShort + " · every building as a simple block"
    : dShort + " · " + (B ? B.word + " rentals" : "the chosen buildings") + (o.q && o.q.max ? " around AED " + money(o.q.max) : "");
  const cnt = marks.length <= 10 ? NUMWORD[marks.length].toLowerCase() : String(marks.length);
  out.push('<text x="45" y="55" font-size="' + f1(22 * PT) + '" font-weight="bold" fill="' + MAPC.TEAL + '">' + esc(title) + "</text>");
  out.push('<text x="45" y="90" font-size="' + f1(10.5 * PT) + '" fill="#5E5B52">' + esc((o.district || "") + ", Dubai  ·  " + (single ? "the building on its own plot as a simple massing block, among its neighbours" : none ? "every footprint raised to its height" : cnt + " rental options, each dropped on its own plot as a simple massing block")) + "</text>");
  out.push('<rect x="1099.5" y="130" width="382.5" height="820" fill="#FFFFFF" stroke="#E2DED3" stroke-width="1.1"/>');
  out.push('<text x="1117.5" y="165" font-size="' + f1(14 * PT) + '" font-weight="bold" fill="' + MAPC.TEAL + '">' + (single ? "This building" : none ? "This district" : "Rental options") + "</text>");
  out.push('<text x="1117.5" y="188" font-size="' + f1(8.6 * PT) + '" fill="#5E5B52">' + esc(single ? "Numbered " + first.n + ", as on the one-sheet" : none ? "No building chosen" : "1–" + marks.length + " = rental options" + (B ? ", " + B.short.replace(/s$/, "") + (o.q && o.q.max ? " around AED " + money(o.q.max) : "") : "")) + "</text>");
  let yy = 235;
  for (const m of marks) {
    const ap = m.approx, cx = 1135.5, cy = yy - 4;
    out.push(ap ? '<circle cx="' + cx + '" cy="' + cy + '" r="11" fill="#FFFFFF" stroke="' + MAPC.TEAL + '" stroke-width="1.9" stroke-dasharray="3 2"/>' : '<circle cx="' + cx + '" cy="' + cy + '" r="11" fill="' + MAPC.TEAL + '" stroke="' + MAPC.GOLD + '" stroke-width="1.9"/>');
    out.push('<text x="' + cx + '" y="' + cy + '" font-size="' + f1(9 * PT) + '" font-weight="bold" fill="' + (ap ? MAPC.TEAL : "#FFFFFF") + '" text-anchor="middle" dominant-baseline="central">' + m.n + "</text>");
    const nm = m.name.length > 34 ? m.name.slice(0, 33) + "…" : m.name;
    out.push('<text x="1165.5" y="' + yy + '" font-size="' + f1(9.6 * PT) + '" fill="#2B2A26">' + esc(nm + (ap ? "  (approximate position)" : m.placed ? "" : "  (no map position yet)")) + "</text>");
    yy += 52;
  }
  const key = (y, fc, ec, dash, label) => '<rect x="1117.5" y="' + (y - 16) + '" width="33" height="16" fill="' + fc + '" stroke="' + ec + '" stroke-width="1.2"' + (dash ? ' stroke-dasharray="3 2"' : "") + '/><text x="1165.5" y="' + (y - 4) + '" font-size="' + f1(8.3 * PT) + '" fill="#2B2A26">' + label + "</text>";
  out.push('<text x="1117.5" y="755" font-size="' + f1(10.5 * PT) + '" font-weight="bold" fill="' + MAPC.TEAL + '">Key</text>');
  out.push(key(785, MAPC.GOLD, MAPC.GOLD_EDGE, false, single ? "This building, on its plot" : "Rental option, building on its plot"));
  if (marks.some((m) => m.approx)) out.push(key(815, "#E6D6B2", MAPC.GOLD_EDGE, true, "Approximate position, indicative block"));
  out.push(key(845, MAPC.CTX_ROOF, MAPC.CTX_EDGE, false, "Other " + esc(dShort) + " buildings"));
  out.push('<line x1="1117.5" y1="867" x2="1150.5" y2="867" stroke="' + MAPC.CASE + '" stroke-width="4"/><line x1="1117.5" y1="867" x2="1150.5" y2="867" stroke="#FFFFFF" stroke-width="2.2"/>' +
    '<text x="1165.5" y="871" font-size="' + f1(8.3 * PT) + '" fill="#2B2A26">Streets</text>');
  ["Simple massing (LOD 100): each footprint raised to its", "height with a flat roof; heights to scale. View from", "the south, looking north."].forEach((t, k) =>
    out.push('<text x="1117.5" y="' + (897 + 14 * k) + '" font-size="' + f1(7.2 * PT) + '" fill="#8C887C">' + t + "</text>"));
  out.push('<text x="45" y="988" font-size="' + f1(6.5 * PT) + '" fill="#8C887C">Footprints and streets: &#169; OpenStreetMap contributors (district model). Positions: the app\'s district model' +
    (marks.some((m) => m.approx) ? "; dashed blocks are approximate, from a public map listing" : "") + ".</text>");
  out.push("</svg>");
  return out.join("");
}

// ------------------------------------------------------------------------------------------------ rendering and the route
async function renderPdf(env, html) {
  const browser = await LAUNCH(env.BROWSER);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1123, height: 1123, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 45000 });
    try { await page.evaluate(() => document.fonts.ready.then(() => true)); } catch (e) {}
    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    return pdf;
  } finally { try { await browser.close(); } catch (e) {} }
}

const J = (o, status) => new Response(JSON.stringify(o, null, 1), { status: status || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

// Build the whole document for a request. Exported so the tests and the local preview build exactly what the route renders.
export async function buildDocument(env, q, opts) {
  if (!["dossier", "onesheet", "compare", "pack"].includes(q.kind)) return { status: 400, body: { ok: false, reason: "kind must be dossier, onesheet, compare or pack" } };
  if (q.mode !== "rent") return { status: 501, body: { ok: false, reason: "buy-mode documents are not built yet: the approved layouts are for rentals; the Buy evidence comes from Contract A when it lands" } };
  if (!q.keys.length) return { status: 400, body: { ok: false, reason: "keys= is required (one key per building, from /brief_api)" } };
  if (q.keys.length > MAX_KEYS) return { status: 400, body: { ok: false, reason: "at most " + MAX_KEYS + " buildings per document" } };
  if (q.kind === "dossier" && q.keys.length > 1) {
    // one building per dossier: Individual PDFs go out one at a time, never bundled (see the head of this file)
    const base = (opts && opts.base) || "";
    return { status: 400, body: { ok: false, reason: "one building per dossier request - open each link below", dossiers: q.keys.map((k, i) => {
      const u = new URL(base || "https://x/brief_pdf"); for (const [a, b] of ((opts && opts.params) || [])) if (a !== "keys" && a !== "num" && a !== "of") u.searchParams.set(a, b);
      u.searchParams.set("keys", k); u.searchParams.set("num", String(i + 1)); u.searchParams.set("of", String(q.keys.length));
      return { key: k, url: base ? u.pathname + u.search : "/brief_pdf" + u.search };
    }) } };
  }
  const dossierish = q.kind === "dossier" || q.kind === "pack";
  const C = await loadContext(env, q, { now: opts && opts.now, origin: opts && opts.origin, need: { units: dossierish, photos: dossierish, map: true } });
  if (C.error) return { status: 503, body: { ok: false, reason: C.error } };
  if (C.missing.length) return { status: 404, body: { ok: false, reason: "not in the rent index", keys: C.missing } };
  let html, title, fname;
  const B = BEDS[q.beds], tag = (q.beds === "studio" ? "Studio" : q.beds + "BR");
  if (q.kind === "dossier") {
    const rec = C.recs[0];
    html = dossierHtml(C, rec, q, q.num, q.of);
    title = rec.name + " - " + B.word;
    fname = (q.num ? String(q.num).padStart(2, "0") + "_" : "") + rec.name.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "") + "_" + tag + ".pdf";
  } else if (q.kind === "pack") {
    html = packHtml(C, q); title = "Rental options - " + B.word; fname = "Rental_options_" + tag + ".pdf";
  } else {
    html = oneSheetHtml(C, q); title = "One-sheet - " + B.word; fname = "One_sheet_" + tag + ".pdf";
  }
  return { status: 200, html: HEAD(title, html), pages: C.pages, fname, C };
}

export async function briefPdfRoute(request, env, url, deps) {
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("method not allowed", { status: 405 });
  if (!deps || !deps.keyOk || !deps.keyOk(env, url)) return new Response("unauthorized", { status: 401 });
  const q = parseQuery(url);
  const doc = await buildDocument(env, q, { base: url.origin + url.pathname, params: [...url.searchParams.entries()], origin: q.format === "html" ? url.origin : String(env.PUBLIC_ORIGIN || url.origin).replace(/\/+$/, "") });
  if (doc.status !== 200) return J(doc.body, doc.status);
  const hdr = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "X-Brief-Pages": String(doc.pages) };
  if (q.format === "html") return new Response(doc.html, { headers: Object.assign({ "Content-Type": "text/html; charset=utf-8" }, hdr) });
  if (!env.BROWSER) return J({ ok: false, reason: "no Browser Rendering binding on this Worker; add format=html to see the document" }, 503);
  let pdf;
  try { pdf = await renderPdf(env, doc.html); } catch (e) {
    const m = String((e && e.message) || e);   // Browser Rendering refuses a new browser with 429 when the account's browsers are all in use
    return J({ ok: false, reason: (/429|too many|rate.?limit/i.test(m) ? "busy: " : "render failed: ") + m.slice(0, 160) }, /429|too many|rate.?limit/i.test(m) ? 429 : 502);
  }
  if (!pdf || !pdf.byteLength) return J({ ok: false, reason: "the renderer returned nothing" }, 502);
  return new Response(pdf, { headers: Object.assign({ "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="' + doc.fname + '"' }, hdr) });
}

// ------------------------------------------------------------------------------------------------ /brief_blocks - the same map as an app view
// Kendall, 30 Sep 2026: the LOD 100 blocks look is to become a view IN the app too, the middle layer between the map (dots) and the twin
// (full detail). It is the SAME component as the PDF's map: briefMapSvg, the same function over the same district layer, so the view and
// the document cannot drift apart. The PDF embeds the SVG directly (vector, sharp in print) rather than screenshotting this page.
//   /brief_blocks?keys=<key,...>&beds=&max=     the chosen buildings, numbered as on the one-sheet (one map per district)
//   /brief_blocks?d=<district>                  the district alone
// No script on the page, so there is nothing to fail to parse on a phone.
export async function briefBlocksPage(env, url) {
  const q = parseQuery(url);
  const d = String(url.searchParams.get("d") || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const svgs = [];
  let title = "Blocks";
  if (q.keys.length) {
    if (q.keys.length > MAX_KEYS) return J({ ok: false, reason: "at most " + MAX_KEYS + " buildings" }, 400);
    const C = await loadContext(env, q, { need: { map: true, amen: false } });
    if (C.error) return J({ ok: false, reason: C.error }, 503);
    if (C.missing.length) return J({ ok: false, reason: "not in the rent index", keys: C.missing }, 404);
    const byD = {};
    for (const r of C.recs) (byD[r.d || "_"] = byD[r.d || "_"] || []).push(r);
    for (const [dd, recs] of Object.entries(byD)) {
      const D = C.district[dd] || {}, marks = recs.map((r) => markOf(r, D.layer));
      svgs.push(D.layer && marks.some((m) => m.placed) ? briefMapSvg(D.layer, marks, { single: recs.length === 1, district: recs[0].dist, districtSlug: dd, q }) : "");
    }
    title = "Blocks · " + C.recs.map((r) => r.name).join(", ");
  } else if (d) {
    const layer = await kvJson(env, "brief_fp_" + d), geo = await kvJson(env, "districts_geo");
    const nm = (((geo && geo.districts) || []).find((x) => x.slug === d) || {}).name || d;
    svgs.push(layer ? briefMapSvg(layer, [], { single: false, district: nm, districtSlug: d }) : "");
    title = "Blocks · " + nm;
  } else return J({ ok: false, reason: "keys= or d= is required" }, 400);
  const body = svgs.map((s) => s ? '<div class="blk">' + s.replace("<svg ", '<svg style="width:100%;height:auto;display:block;" ') + "</div>"
    : '<div class="blk"><div class="maptofollow" style="aspect-ratio:3/2;border:1px dashed #DED9D0;display:flex;align-items:center;justify-content:center;font:14px Arial,sans-serif;color:' + MUTED + ';">Map to follow</div></div>').join("");
  return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + esc(title) + "</title>" +
    "<style>:root{color-scheme:light}html,body{margin:0;background:#F6F4EE}.blk{max-width:1500px;margin:0 auto 12px auto;overflow:auto}</style></head><body>" + body + "</body></html>",
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
}

export async function briefDocsRoute(request, env, url, deps) {
  if (url.pathname === "/brief_blocks") {
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("method not allowed", { status: 405 });
    if (!deps || !deps.keyOk || !deps.keyOk(env, url)) return new Response("unauthorized", { status: 401 });
    return briefBlocksPage(env, url);
  }
  return briefPdfRoute(request, env, url, deps);
}
