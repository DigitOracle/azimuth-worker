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
import { withAmenityPages, loadSpots } from "./amenity_cards.js";
export const REALTOR_VERIFIES = "Your realtor will verify these details with you.";   // v302 - the ONE line a client document uses where a fact is missing; gaps live only in owner places (API notes, diagnostics)
import { liveCtx, fillLive } from "./live_answers.js";   // v291 - live Google answers for gym, community pool and dog park (never stored)   // v290 AMENITY CARDS - the "Around the community" page in Compare and Full pack
import { estimateLeft, candidateKey, kvJson as kvJsonGz, loadDevAvail, devAvailFor } from "./brief.js";   // the ONE "left" estimate (API only since v277) and the developers' own sheets, shared with /brief_api
// v282 (Kendall, 1 Oct 2026): the client's criteria and the area comparison come from the SAME functions /brief_api uses, so the list
// and the documents can never disagree. A document is a client document: the search is run with owner: false, and nothing here ever
// prints a listing-site (portal) figure - furnishing is "not known" on every page.
import { applyAnchorOverrides, applyBrokerFacts, brokerFor, ownPhotoFor, PHOTO_CREDIT, longDate } from "./checklist_data.js";   // v291 CHECKLIST - the owner's on-site corrections (map, broker facts, own photos)
import { canonicalOf, displayOf, resolve as devResolve, isCurated } from "./devcross.js";   // v306 - the developer's canonical name
import { labelledName } from "./community_labels.js";   // v307
import { evidenceSay, shownRent, windowOf, distSay, isCountableGym, FEW_LETTINGS } from "./brief_rules.js";   // v310 - the DAMAC Hills rules
import { subOrigins } from "./brief.js";   // v310 R1
import { amenIndex, amenFor, briefSearch, criteriaOf, mustsOf, rentStat, verdictOf, kindsOfType, BRIEF_CRITERIA, EXTRA_AREAS, areaSlugOf, BEDS_BASIS_SAY, rentFigure, pickRent, ratingOf, EVIDENCE_MIN } from "./brief.js";
// v277 (Kendall, 1 Oct 2026): the register "left" estimate is OFF the client face - no "ESTIMATED ... LEFT" box on page 2, no
// "Still filling" line on the one-sheet card. estimateLeft() stays in src/brief.js and the API still returns estimated_left; nothing
// here prints it. In its place page 2 carries DEVELOPER AVAILABILITY where a developer's own sheet names the building (loadDevAvail /
// devAvailFor in src/brief.js: the lists posted to the broker group), and nothing at all where none does. The two are never mixed.
// Also v277: a beds=all band (every home type in the building: figures per type, the layouts table across types, no per-band
// wording) for the building page's dossier button, and a key the rent index does not know but the unit-mix register does builds
// from the register alone (a building page exists for every such building, and its dossier must too).

export const FOOTER_TEXT = "Curated by Najjuko &middot; Dubai Decoded";
export const WHATSAPP_NUMBER = "+971 56 548 4397";
export const HEADER_IMG_KEY = "brand_najjuko_n";
// pack audit, 1 Oct 2026: the same picture flattened on the header's white, as a JPEG at the printed size x2 (push_brochures.py). The
// live 33-page pack carried the PNG 32 times (Flate + alpha, 99 KB each = 3.1 MB); a JPEG passes through at ~15 KB a copy. Preferred
// when stored; the PNG stays the fallback.
export const HEADER_JPG_KEY = "brand_najjuko_n_jpg";
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
  // v277 - every home type in the building (the building page's dossier when no bedroom is chosen)
  all: { band: "all", word: "home", upper: "ALL HOME TYPES", pl: "HOMES", short: "homes", tn: (k) => /^(studio|\d+ bedroom)/i.test(String(k || "")), uc: (c) => c === "studio" || /^\d+$/.test(c), all: true },
};
const BANDS = ["studio", "1", "2", "3"];
const bandLabel = (b) => (b === "studio" ? "Studio" : b === "3" ? "3+ bedrooms" : b + " bedroom");

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
function footer(small, buy) {
  return '<div style="padding:8px 46px 16px 46px;display:flex;flex-direction:column;gap:6px;">' + (small || "") +
    '<div style="font-size:10.5px;color:' + MUTED + ';line-height:1.35;">' + (buy ? "Availability, the price and the actual home must be confirmed with the developer's sales team or the listing broker. " +
    "Prices shown are sales recorded at the Land Department, not asking prices or an offer." : "Availability, the rent and the actual flat must be " +
    "confirmed with the building's leasing team or the listing broker. Rents shown are rents already agreed, " +
    "not asking prices or an offer.") + "</div>" +
    '<div style="height:1px;background:#DED9D0;margin-top:2px;"></div>' +
    '<div class="curator" style="display:flex;justify-content:center;align-items:center;gap:8px;font-size:12px;color:' + NAVY + ';' +
    'letter-spacing:.3px;">' + CURATOR + "</div></div>";
}
const smallPrint = (items) => '<div class="prov" style="display:flex;flex-direction:column;gap:3px;font-size:9px;line-height:1.35;">' +
  items.filter(Boolean).map((i) => "<div>" + i + "</div>").join("") + "</div>";
function page(C, sub, body, small) {
  C.pages++;
  return '<div class="sheet page">' + header(C, sub) + '<div style="flex:1;display:flex;flex-direction:column;padding:16px 46px 0 46px;' +
    'gap:12px;overflow:hidden;">' + body + "</div>" + footer(small, C.buy) + "</div>";
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
  // v282: beds may be a list (beds=2,3): q.beds is the first, q.bedsList all of them; each building uses the one its figure is for
  const one = (b) => (BEDS[b] ? b : (b === "0" ? "studio" : /^(any|every|\*)$/.test(b) ? "all" : null));
  const bl = [...new Set(String(sp.get("beds") || "1").toLowerCase().split(",").map((b) => one(b.trim())).filter(Boolean))];
  const bedsList = bl.includes("all") ? ["all"] : (bl.length ? bl : ["1"]);
  const list = (k) => String(sp.get(k) || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).filter((m) => BRIEF_CRITERIA.some((c) => c[0] === m));   // v374: an old link's pulled criteria (pool, pets, modern...) fall away
  const musts = [...new Set(list("musts"))];
  const areas = String(sp.get("areas") || "").split(",").map((a) => a.trim().toLowerCase().replace(/[^a-z0-9]/g, "")).filter(Boolean);
  return {
    kind: String(sp.get("kind") || "dossier").toLowerCase(),
    keys: String(sp.get("keys") || "").split(",").map((k) => k.trim()).filter(Boolean),
    mode: String(sp.get("mode") || "rent").toLowerCase(),
    beds: bedsList[0], bedsList,
    min: num(sp.get("min")), max: num(sp.get("max")), stretch: num(sp.get("stretch")),
    musts, nice: [...new Set(list("nice"))].filter((m) => !musts.includes(m)),
    compare: sp.get("compare") === "1" && areas.length >= 2 && areas.length <= 3,
    type: String(sp.get("type") || "apartment").toLowerCase(),
    areas,
    num: Math.max(0, parseInt(sp.get("num") || "0", 10) || 0), of: Math.max(0, parseInt(sp.get("of") || "0", 10) || 0),
    format: String(sp.get("format") || "pdf").toLowerCase(),
    hide: [...new Set(String(sp.get("hide") || "").toLowerCase().split(",").map((s) => s.trim()).filter((s) => ["amen", "photos", "layouts"].includes(s)))],   // v407 - the options page: sections of a dossier left out; none = today's document
    client: String(sp.get("client") || "").replace(/[<>&"\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60),   // v407 - the "prepared for" line; none = today's document
  };
}

// ------------------------------------------------------------------------------------------------ data
import { loadThread, threadView, aboutHtml, renderSuffixOfKey, communitySuffix, ABOUT_PRINT_CSS } from "./thread.js";   // v364 - the digital thread behind our own renders, and the community picture slot
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

// THE PHOTOS STAY JPEG (pack audit, 1 Oct 2026). Cloudflare's Browser Rendering is Chrome 128 (the live pack says "Skia/PDF m128").
// When it draws only PART of a picture - object-fit:cover, background-size:cover: a source-rectangle subset - its PDF writer decodes
// the picture and stores the raw pixels (FlateDecode); a ten-building pack came out at 30.8 MB, 26 MB of it pictures that are
// 150-300 KB JPEGs in KV. Drawn WHOLE (scaled) inside a box that clips it, the same picture is passed through as the JPEG it is
// (DCTDecode). Measured in Chrome 128: one 702 x 300 hero, object-fit:cover 1854 KB, clipped whole picture 288 KB. So a picture is
// drawn whole, at the size that covers its box, and the box clips it (fitImg). That needs the picture's pixel size: read from the
// stored JPEG's own header (jpegSize). A picture whose size cannot be read (not a JPEG) keeps the old object-fit:cover.
// Newer Chrome (145+) passes subsets through as JPEG too, so a local render with a current Chrome does NOT show the problem - test
// against Chrome 128 (test/test_pack_jpeg.mjs, CHROME128=<path>).
export function jpegSize(buf) {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf || new ArrayBuffer(0));
  if (u.length < 4 || u[0] !== 0xff || u[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < u.length) {
    if (u[i] !== 0xff) { i++; continue; }
    const m = u[i + 1];
    if (m === 0xff) { i++; continue; }
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd8)) { i += 2; continue; }
    if (m === 0xda || m === 0xd9) return null;                     // image data before any frame header: not a JPEG we can size
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      const h = (u[i + 5] << 8) | u[i + 6], w = (u[i + 7] << 8) | u[i + 8];
      return w > 0 && h > 0 ? { w, h } : null;
    }
    i += 2 + ((u[i + 2] << 8) | u[i + 3]);
  }
  return null;
}
// A stored picture for the document: {src, w, h} (w/h only for a JPEG whose header gives them). Same linking rule as kvDataUrl, and
// stricter: a picture is used only when its bytes are stored, not just its content type.
async function kvPic(env, name, origin) {
  if (!name) return null;
  try {
    const [buf, ct] = await Promise.all([env.MEETINGS.get("img_" + name, "arrayBuffer"), env.MEETINGS.get("img_ct_" + name)]);
    // v364 - our own renders (render_<key>, render_community-<d>-<n>) are NEVER linked: /img/ strips hyphens from the name (so the link 404ed in a live PDF)
    // and /render/ needs a key a PDF renderer must not carry. They are embedded as data URIs, in the page itself, whether or not there is an origin.
    const link = origin && !/^render_/.test(name);
    if (!buf || !buf.byteLength || (link && !ct)) return null;
    const type = ct || "image/jpeg";
    const dim = /jpe?g/i.test(type) ? jpegSize(buf) : null;
    return Object.assign({ src: link ? origin + "/img/" + name : "data:" + type + ";base64," + b64(buf) }, dim || {});
  } catch (e) { return null; }
}
async function firstPic(env, names, origin) {
  for (const n of names) { if (!n) continue; const p = await kvPic(env, n, origin); if (p) return p; }
  return null;
}
const r2 = (x) => Math.round(x * 100) / 100;
// Draw a picture to cover a w x h box (posY: 0 top .. 1 bottom, like object-position) WITHOUT a source-rectangle subset.
export function fitImg(pic, w, h, alt, posY) {
  if (!pic || !pic.src) return "";
  const py = posY == null ? 0.5 : posY;
  if (!(pic.w > 0 && pic.h > 0))
    return img(pic.src, "width:" + r2(w) + "px;height:" + r2(h) + "px;object-fit:cover;display:block;" + (posY != null ? "object-position:center " + Math.round(py * 100) + "%;" : ""), alt);
  const s = Math.max(w / pic.w, h / pic.h), dw = pic.w * s, dh = pic.h * s;
  if (Math.abs(dw - w) < 0.5 && Math.abs(dh - h) < 0.5) return img(pic.src, "width:" + r2(w) + "px;height:" + r2(h) + "px;display:block;", alt);
  return '<div class="pic" style="width:' + r2(w) + "px;height:" + r2(h) + 'px;overflow:hidden;position:relative;">' +
    img(pic.src, "position:absolute;left:" + r2((w - dw) / 2) + "px;top:" + r2((h - dh) * py) + "px;width:" + r2(dw) + "px;height:" + r2(dh) + "px;max-width:none;display:block;", alt) + "</div>";
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
  const C = { buy: q.mode === "buy", noEvidence: [], today: todayLong(opts && opts.now), pages: 0, logo: (await kvDataUrl(env, HEADER_JPG_KEY, opts && opts.origin)) || (await kvDataUrl(env, HEADER_IMG_KEY, opts && opts.origin)), district: {}, recs: [], missing: [] };
  C.ri = await kvJson(env, "rent_index");
  if (C.buy && !(C.ri && Array.isArray(C.ri.items))) C.ri = { items: [] };   // v306 - a purchase does not need the rent index
  if (C.buy) { C.mp = await kvJsonGz(env, "map_prices").catch(() => null); C.dmIdx = await kvJsonGz(env, "devmap_index").catch(() => null); }   // v306 - positions of register-only buildings; the Dubai-wide tier shares
  if (!C.ri || !Array.isArray(C.ri.items)) return Object.assign(C, { error: "the rent index (img_rent_index) is not in storage" });
  const geo = await kvJson(env, "districts_geo");
  C.dname = {}; for (const d of ((geo && geo.districts) || [])) C.dname[d.slug] = d.name;
  for (const [s, x] of Object.entries(EXTRA_AREAS)) if (!C.dname[s]) C.dname[s] = x.name;   // v282 - Arabian Ranches, by its Land Department areas
  C.amen = need.amen === false ? null : await kvJson(env, "amenities");
  C.avail = need.avail === false ? [] : await loadDevAvail(env);   // v277 - the developers' own sheets (img_avail_index -> img_drill_<d>.claimed)
  const B = BEDS[q.beds];
  const district = async (d, it) => {
    if (!C.district[d]) C.district[d] = {
      name: C.dname[d] || (it && pretty(it.area)) || d,
      unitmix: await kvJson(env, "unitmix_" + d),
      bedsLeft: null, tenancy: null,                 // v277 - the "left" estimate is no longer printed, so its sources are not read
      // v289 - the layer through the gzip-aware reader (src/brief.js kvJson): a layer published gzipped must not read as "no layer"
      units: need.units ? await kvJson(env, "units_" + d) : null, layer: need.map ? await kvJsonGz(env, "brief_fp_" + d) : null,
      areaIdx: undefined,                            // v289 - the register community -> footprints index (areaIndex), read on first need
      spots: await loadSpots(env, d).catch(() => null),   // v302 - gyms and the rest of the amenity-spots layer (same file as the Around-the-community page)
      amen: amenIndex(await kvJsonGz(env, "amenities_" + d)),   // v289 - the amenity facts file, plain or gzipped (src/brief.js), same answers as the list
      bf: await kvJsonGz(env, "broker_facts_" + d), own: await kvJsonGz(env, "ownphotos_" + d),   // v291 CHECKLIST - broker facts and own photos
    };
    return C.district[d];
  };
  for (const key of q.keys) {
    let it = findItem(C.ri, key);
    if (!it) {
      // v277 - not in the rent index: a <district>:<id> the unit-mix register holds still gets its document (no lettings figure,
      // the register's own name and counts). Anything else is refused, never drawn from somewhere else.
      const m = /^([a-z0-9]+):(\d{1,7})$/.exec(String(key || "").toLowerCase());
      const DD = m ? await district(m[1], null) : null;
      const card = DD && DD.unitmix && DD.unitmix.buildings_by_id ? DD.unitmix.buildings_by_id[m[2]] : null;
      if (card && card.name) {
        it = { d: m[1], i: parseInt(m[2], 10), n: card.name, a: [], area: null, b: {}, v: {}, synth: true };
        // v306 - a purchase: the position the Buy map holds for this building (img_map_prices), so the distances are exact
        const mpi = C.buy && C.mp && Array.isArray(C.mp.items) ? C.mp.items.find((x) => x.d === it.d && x.i === it.i) : null;
        if (mpi && Number.isFinite(mpi.lat) && Number.isFinite(mpi.lon)) { it.lat = mpi.lat; it.lon = mpi.lon; }
      }
      if (!it) { C.missing.push(key); continue; }
    }
    // v285 - a "dld:" key for a record the index binds to an app building is one /brief_api UNBOUND (unbindDisputed: the app building is
    // named otherwise - Capital Bay A is bound to "The Metropolis" - or is already listed under a better-evidenced record). The list shows
    // it with no building page and no position, so the document must not borrow that other building's footprint, position or card
    // either: the same record, without the disputed bind.
    if (/^dld:/i.test(key) && it.i != null) it = Object.assign({}, it, { i: null, is: undefined, lat: null, lon: null, unbound: true });
    // v282 - the home kind (apartment "b", villa or townhouse "v") and the bedroom count this building's figure is for.
    // v285 - THE choice /brief_api makes (pickRent in src/brief.js: the best verdict, then most contracts) and THE figure it prints
    // (rentFigure: the median of new lettings where there are 3 or more, else of all contracts, middle half on the same basis). Only a
    // building the list would not offer (under 3 contracts, or outside the window) falls back to the loose choice below - still on
    // rentFigure, so a number on a document is always the number on the screen.
    const kinds = kindsOfType(q.type), bedNums = (q.bedsList || [q.beds]).map((bb) => +BEDS[bb].band);
    const qv = { min: q.min || null, max: q.max || null, stretch: q.stretch || null };
    let pick = null;
    if (!B.all && !C.buy) {
      const ap = pickRent(it, kinds, bedNums, qv).best;
      if (ap) pick = { k: ap.kind, bb: ap.bed === 0 ? "studio" : String(ap.bed), s: ap.s, basis: ap.basis };
      else for (const k of kinds) for (const bb of (q.bedsList || [q.beds])) {
        const rs = rentStat(it, k, +BEDS[bb].band); if (!rs) continue;
        const vd = verdictOf(rentFigure(rs.s).m, qv.min, qv.max, qv.stretch);
        const tier = { within: 0, stretch: 1, a_little_above: 2, below: 3, above: 4 }[vd]; const t = tier == null ? 9 : tier;
        if (!pick || t < pick.t || (t === pick.t && rs.s.n > pick.s.n)) pick = { k, bb, s: rs.s, basis: rs.basis, t };
      }
    }
    const kind = pick ? pick.k : (kinds.includes("b") && it.b ? "b" : "v");
    const set = (kind === "v" ? it.v : it.b) || {};
    const st = B.all ? null : (pick ? rentFigure(pick.s, { kind: pick.k, bed: +BEDS[pick.bb].band }) : null);
    const sts = {}; for (const b of BANDS) if (set[BEDS[b].band]) sts[b] = rentFigure(set[BEDS[b].band], { kind, bed: +BEDS[b].band });   // v277 - every band, for the all-types document
    const d = areaSlugOf(it);
    const D = d ? await district(d, it) : null;
    const um = D && D.unitmix && D.unitmix.buildings_by_id && it.i != null ? D.unitmix.buildings_by_id[String(it.i)] : null;
    const tn = D && D.tenancy && D.tenancy.buildings_by_id && it.i != null ? D.tenancy.buildings_by_id[String(it.i)] : null;
    const un = D && D.units && D.units.buildings_by_id && it.i != null ? D.units.buildings_by_id[String(it.i)] : null;
    // v306 - a purchase is built from the building's own settled sales (the unit-mix card): no evidence of 3+ sales inside the budget, no option
    const buy = C.buy ? buyOf(um, q) : null;
    if (C.buy && !buy) { C.noEvidence.push(key); continue; }
    const bro = await loadBrochure(env, it, it.n);
    const br = bro && bro.br;
    const name = br && br.name ? br.name : pretty(C.buy && um && um.name ? um.name : it.n);
    const pos = Number.isFinite(it.lat) && Number.isFinite(it.lon) ? [it.lat, it.lon] : null;   // v285: Number.isFinite - an unbound record's null is not a position
    const rec = { key, it, st, sts, d, dist: D ? labelledName(d, D.name) : pretty(it.area), um, tn, un, br, brRefused: bro && bro.refused, brDir: bro && bro.dir,
                  name, aliases: (it.a || []).map(pretty).filter((a) => stemKey(a) !== stemKey(name)), pos, exact: it.i != null && !!pos, n: C.recs.length + 1 };
    if (C.buy) { const mpi = C.mp && Array.isArray(C.mp.items) ? C.mp.items.find((x) => x.d === d && x.i === it.i) : null; const dv = devOf(um, mpi && mpi.dev); Object.assign(rec, { buy, devId: dv.id, devName: dv.name }); }   // v306
    if (Array.isArray(it.fp) && it.fp.length) rec.exact = true;   // v298 - placed by its own footprint in the district layer; its centre is set below
    // v277 - what the developer's own sheet lists for this building, of this type (or every type): null where no sheet names it
    rec.beds = buy ? (BEDS[q.beds].all ? "all" : labelBed(buy.best.label)) : pick ? pick.bb : q.beds; rec.kind = kind; rec.bedsBasis = pick ? pick.basis : null;
    if (C.buy) { rec.avail = null; rec.st = null; rec.sts = {}; }   // v306 - no rent figure and no availability claim on a purchase document
    if (!C.buy) rec.avail = devAvailFor(C.avail, { name: it.n, aliases: (it.a || []).concat(um && um.name ? [um.name] : []) }, B.all ? "all" : +BEDS[rec.beds].band);
    // v282 - the client's criteria for this building: the same function and sources as the /brief list
    const cc = { name: it.n, aliases: it.a || [], lon: it.lon, lat: it.lat, key };
    rec.af = D ? amenFor(D.amen, { key, d, i: it.i, it, name: it.n, aliases: it.a || [] }) : null;   // v289
    rec._ca = { c: cc, card: um, brochure: br, AM: C.amen, musts: mustsOf(cc, um, br, C.amen).musts, villa: kind === "v", s: st, af: rec.af };   // v310 - kept: the criteria are answered again once a community's homes are placed (below)
    rec.crit = criteriaOf({ ...rec._ca, spots: D && D.spots && D.spots.spots, origins: pos ? [[pos[1], pos[0]]] : null });
    if (D) applyBrokerFacts(rec.crit, brokerFor(D.bf, [it.n].concat(it.a || [])));   // v291 CHECKLIST - the broker's on-site facts fill only what is still not known
    if (br) {
      const ext = br.photos.find((p) => /^exterior/.test(p.file || ""));
      // hero_key / card_key: the same picture pre-cropped by push_brochures.py to the print aspect (2.34:1 hero, 3:2 card and page-3
      // photo) - smaller, and drawn with no crop at all; the original key is the fallback (fitImg clips it whole)
      const o = opts && opts.origin;
      rec.heroPic = ext ? await firstPic(env, [ext.hero_key, ext.key], o) : null;
      rec.cardPic = ext ? await firstPic(env, [ext.card_key, ext.key], o) : null;
      rec.hero = rec.heroPic ? rec.heroPic.src : null;
      rec.heroPhoto = ext || null;
      if (need.photos) {
        const extra = br.photos.filter((p) => !/^exterior/.test(p.file || "") && photoRank(p) < 99).sort((a, b) => photoRank(a) - photoRank(b)).slice(0, 4);
        rec.photos = [];
        for (const p of extra) { const pic = await firstPic(env, [p.card_key, p.key], o); if (pic) rec.photos.push(Object.assign({ src: pic.src, pic }, p)); }
      }
    }
    // v285 - what the card's picture is: the developer's photograph, else the Blocks view of the building (see blocksThumb)
    // v289 - a register record with no app building and no position (every DAMAC Hills villa and townhouse community: "dld:" keys such
    // as DAMAC HILLS - TOPANGA) is located by its OWN name: the footprints the district model (img_anchors_<d>) attributes to the Land
    // Department sub-community of exactly that name. Exact name only - a prefix names a family (Brookfield-1 is not Brookfield-2) - and
    // never for a record /brief_api unbound from another building (it must not borrow that building's land).
    // v298 - a record with its own footprint (it.fp) is placed exactly (markOf); it never borrows a community's homes
    if (need.map && D && D.layer && it.i == null && !it.unbound && !rec.cardPic && !rec.heroPic && !(Array.isArray(it.fp) && it.fp.length)) {
      if (D.areaIdx === undefined) D.areaIdx = areaIndex(await kvJsonGz(env, "anchors_" + d), await kvJsonGz(env, "anchor_overrides_" + d));   // v291 CHECKLIST - the owner's map corrections merged
      if (D.areaIdx) for (const n of [it.n].concat(it.a || [])) { const ids = D.areaIdx.get(norm(n)); if (ids) { rec.areaIds = ids; break; } }
    }
    // v291 CHECKLIST - Najjuko's own photograph of the community (img_ownphotos_<d>) is the card picture FIRST, above the developer's
    {
      const own = D ? ownPhotoFor(D.own, [it.n].concat(it.a || []), d) : null;
      const op = own ? await kvPic(env, own.key, opts && opts.origin) : null;
      if (op) { rec.ownPic = Object.assign(op, { own: true, at: own.at || null }); rec.cardPic = rec.heroPic = rec.ownPic; rec.hero = op.src; }
    }
    rec.picSource = rec.cardPic || rec.heroPic ? "photo" : blocksKind(rec, D && D.layer);
    C.recs.push(rec);
  }
  // v290 - a community with no position of its own gets the centre of its attributed homes, for straight-line distances (metro)
  for (const r of C.recs) if (!r.pos) { const t = svTarget(r, (C.district[r.d] || {}).layer); if (t) { r.cpos = t.c; r.cpts = t.pts; if (Array.isArray(r.it.fp) && r.it.fp.length) r.pos = t.c; } }   // v298 - an own footprint IS a position (distances, no "not verified")
  // v310 R1 - a master-community fact answers yes for a home only within 500 m of it: measured from the building, or (a villa community) from the
  // nearest of the homes the district model attributes to it. Same function and sources as the /brief list.
  for (const r of C.recs) {
    const D = r.d ? C.district[r.d] : null;
    if (!r._ca || !D) continue;
    const own = Array.isArray(r.it.fp) && r.it.fp.length;
    let origins = r.exact && r.pos && !own ? [[r.pos[1], r.pos[0]]] : null;
    if (!origins && r.it.i == null && !own && D.spots) {   // a villa community: its own homes in the district model, as the list reads them
      if (D.anch === undefined) { D.anch = await kvJsonGz(env, "anchors_" + r.d); D.ovr = await kvJsonGz(env, "anchor_overrides_" + r.d); }
      origins = subOrigins(D.anch, D.ovr, [r.it.n].concat(r.it.a || []));
    }
    if (!origins) origins = r.cpts ? r.cpts.map((p) => [p[1], p[0]]) : r.pos ? [[r.pos[1], r.pos[0]]] : null;
    // a villa community placed by its mapped homes: the straight-line answers (metro, schools) read from the middle of them, as in the list
    const mid = !r._ca.c.lon && origins && origins.length ? { ...r._ca.c, lon: origins.reduce((t, p) => t + p[0], 0) / origins.length, lat: origins.reduce((t, p) => t + p[1], 0) / origins.length } : null;
    r.crit = criteriaOf({ ...r._ca, ...(mid ? { c: mid, musts: mustsOf(mid, r._ca.card, r._ca.brochure, r._ca.AM).musts } : {}), spots: D.spots && D.spots.spots, origins });
    applyBrokerFacts(r.crit, brokerFor(D.bf, [r.it.n].concat(r.it.a || [])));
  }
  // v298 - OUR OWN RENDER (Kendall, 4 Oct 2026): KV img_render_<key with ":" as "-">, a plain image of our own making (CityEngine / Unreal /
  // Blender), no Google terms. Drawn after the photo and Street View, before the Blocks view, labelled "Illustration" - never a photograph.
  for (const r of C.recs) { r.renderPic = await kvPic(env, "render_" + String(r.key).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), opts && opts.origin); if (r.renderPic) r.picSource = r.picSource === "photo" || r.picSource === "street_view" ? r.picSource : "render"; }
  // v364 - a register community (no app building, no footprint of its own) takes the community render
  // img_render_community-<district>-<name>, and every render carries its thread (KV thread_<suffix>) for the "About this picture" note.
  // No key in KV: nothing changes.
  for (const r of C.recs) {
    let suf = renderSuffixOfKey(r.key);
    if (!r.renderPic && r.it && r.it.i == null && r.d && !(Array.isArray(r.it.fp) && r.it.fp.length)) {
      const cs = communitySuffix(r.d, r.it.n);
      const cp = cs ? await kvPic(env, "render_" + cs, opts && opts.origin) : null;
      if (cp) { r.renderPic = cp; r.renderKind = "community"; suf = cs; r.picSource = r.picSource === "photo" || r.picSource === "street_view" ? r.picSource : "render"; }
    }
    if (r.renderPic) r.renderView = threadView(await loadThread(env, suf)) || (r.renderKind === "community" ? threadView({ kind: "render_community_illustration", caveats: ["illustration_not_as_built"] }) : null);
  }
  // v291 - LIVE GOOGLE (src/live_answers.js): gym, community pool and dog park asked of Google now where every other source leaves them
  // not known - the home's own sub-community first, then the community; the same function and words as /brief_api. Never stored. It
  // runs alongside the Street View search below (and, for a document, alongside the amenity pages: opts.deferLive leaves it on C.live
  // for buildDocument to await), so a slow Google costs a document no more time than before (2 s cap).
  const live = (async () => {
    if (!(env && env.GOOGLE_MAPS_KEY && C.recs.length)) return;
    const LV = liveCtx(env, opts);
    await fillLive(LV, C.recs.map((r) => { const p = r.pos || r.cpos || null;
      return { crit: r.crit, d: r.d, dn: labelledName(r.d, (C.district[r.d] || {}).name), name: r.it.n, aliases: r.it.a || [], i: r.it.i, is: r.it.is, lat: p ? p[0] : null, lon: p ? p[1] : null, noSub: !!r.it.unbound }; }),
      [...new Set((q.musts || []).concat(q.nice || []))], { cluster: true });
    C.liveCalls = LV.calls;
  })();
  // v290 - Street View for every card without a developer photograph, aimed at its own footprints; all at once, each with a short timeout

  if (need.map && env && env.GOOGLE_MAPS_KEY) {
    await Promise.all(C.recs.filter((r) => !r.cardPic && !r.heroPic).map(async (r) => {
      const t = svTarget(r, (C.district[r.d] || {}).layer);
      const sv = await streetViewFor(env, t);   // v298 - Street View only; NEVER a satellite stand-in (Kendall, 4 Oct 2026)
      if (sv) { r.svPic = sv; r.picSource = "street_view"; }
    }));
  }
  if (opts && opts.deferLive) C.live = live; else await live;
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
// v306 - a distance under 50 m would print "0.0 km": said "on site" only where the building's own position is exact, otherwise left out ("" - callers skip it)
const kmTxt = (d, exact) => (d < 0.05 ? (exact ? "on site" : "") : d.toFixed(1) + " km");
// v306 - a school's inspection line is shown only when it is a rating; "Not inspected due to COVID 19" / "not yet inspected" is left out
const isPharmacy = (i) => /pharmac|chemist|drug\s?store/i.test(String(i.n || "") + " " + String(i.x || ""));
// v307 - a client document never prints the developer's web address, and a "retrieved" date is printed only when it is a real date on or before today
const retrievedSay = (r) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(r || "")); if (!m) return ""; const t = Date.UTC(+m[1], +m[2] - 1, +m[3]); return isFinite(t) && t <= Date.now() + 4 * 3600e3 ? ", retrieved " + longDate(r) : ""; };
const join = (xs) => xs.filter(Boolean).join(", ");

function facts(rec) {
  const out = [];
  { const dv = rec.devName || (rec.br && rec.br.developer); if (dv) out.push(["DEVELOPER", dv]); }
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
  const an = (n) => (/^(8|11|18)$/.test(String(n)) || /^8\d/.test(String(n)) ? "An " : "A ");   // "An 8-floor", "An 11-floor", "An 18-floor", "An 80-floor"
  return (f ? (f >= 12 ? an(f) + f + "-floor residential tower" : an(f) + f + "-floor residential building") : "A residential building") + " in " + rec.dist;
}
// v277 - the register "left" estimate is no longer printed (estimateLeft and candidateKey stay imported so the API path and this
// module keep one source; nothing here calls them for the client face). leftFigures is kept, unused on any page, for the parity test
// and any later owner-only surface: it still returns exactly what estimateLeft gives.
export function leftFigures(rec, beds, district) {
  const D = district || {}, B = BEDS[beds];
  if (B.all) return { why: "no per-type estimate for all home types" };
  const e = estimateLeft({ BL: D.bedsLeft || null, card: rec.um || null, ten: D.tenancy || null,
    c: { key: candidateKey(rec.it), name: rec.it.n, aliases: rec.it.a || [], i: rec.it.i == null ? null : rec.it.i }, bed: +B.band });
  if (!e || e.withheld) return { why: (e && e.withheld) || "no estimate could be read" };
  if (!e.about) return { T: e.of, R: e.running, why: "the register shows a running tenancy for nearly every one of its " + e.of + " " + B.word + " flats" };
  return { T: e.of, R: e.running, est: e.about, as_at: e.as_at || "" };
}

// DEVELOPER AVAILABILITY (v277): what the developer's own sheet lists for this building - named, dated, the developer's claim. Drawn
// only where a sheet names the building (rec.avail); where none does, nothing: no box, no placeholder, no "to follow".
const typeCount = (B, n) => {
  if (B.all) return n + (n === 1 ? " home" : " homes");
  const w = { studio: ["studio", "studios"], "1": ["one-bedroom", "one-bedrooms"], "2": ["two-bedroom", "two-bedrooms"], "3": ["home of three or more bedrooms", "homes of three or more bedrooms"] }[B.band];
  return n + " " + (n === 1 ? w[0] : w[1]);
};
function availBlock(rec, q) {
  const a = rec.avail, B = BEDS[q.beds];
  if (!a || !a.count) return "";
  const head = '<div class="lbl" style="font-size:9.5px;">DEVELOPER AVAILABILITY</div>';
  const line = "Available now, per " + esc(a.developer) + "&rsquo;s sheet of " + esc(dayLong(a.as_of)) + ": " + esc(typeCount(B, a.count)) + ".";
  let rows = "";
  if (a.units && a.units.length) {
    const top = a.units.slice(0, 10);
    rows = tbl([["left", "UNIT"], ["left", "TYPE"], ["right", "SIZE, SQ FT"], ["right", "PRICE, AED"], ["left", "VIEW"]],
      top.map((u) => [esc(u.unit), esc(u.type), u.sqft ? money(u.sqft) : "&mdash;", u.aed ? money(u.aed) : "&mdash;", esc(u.view || "")])) +
      (a.units.length > top.length ? '<div style="font-size:9.5px;color:' + MUTED + ';">and ' + (a.units.length - top.length) + " more on the sheet</div>" : "");
  } else if (a.types && a.types.length) {
    rows = tbl([["left", "TYPE"], ["right", "ON THE SHEET"], ["right", "FROM, AED"]], a.types.map((t) => [esc(t.type), String(t.n), t.from_aed ? money(t.from_aed) : "&mdash;"]));
  }
  return '<div class="availbox" style="border:1px solid #E6E1D8;background:#FFFFFF;padding:12px 14px;display:flex;flex-direction:column;gap:6px;">' + head +
    '<div class="serif" style="font-size:18px;color:' + NAVY + ';line-height:1.2;">' + line + "</div>" + rows +
    '<div style="font-size:11px;color:' + INK + ';line-height:1.45;">The developer&rsquo;s own availability list' + (a.auto ? ", read by machine - check before quoting" : "") +
    ". It is the developer&rsquo;s statement on that date, not register data; the sales team confirms what is still free.</div></div>";
}
function dayLong(d) {
  const s = String(d || "");
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return s;
  return (+s.slice(8, 10)) + " " + ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][+s.slice(5, 7) - 1] + " " + s.slice(0, 4);
}

// "9 (4 new)" - the count the list on screen prints beside the same figure (/brief_api evidence.n, n_new)
const lettingsTxt = (st) => String(st.n) + (st.nn != null ? " (" + st.nn + " new)" : "");
// v310 R5 - a size that is not possible for the home (a 680 m2 "3-bed") is never printed: no text at all, so the line reads whole without it
const sqftBit = (st) => (st && st.s ? money(st.s * SQFT) + " sq ft" : "");
// v310 R4/R6/R7 - one muted line under every rent figure: how many lettings, whose they are, which dates
const evidenceLine = (st, rec, C) => {
  const w = windowOf(rec && rec.it, C && C.ri);
  return esc(evidenceSay(st, rec && rec.it && rec.it.ev_scope)) + (w ? " &middot; " + esc(w.say) : "");
};
function budgetLine(st, q, B) {
  const X = q.max, m = st.m, q1 = st.q1, q3 = st.q3;
  if (st.n < FEW_LETTINGS) {   // v310 R4 - a handful of lettings gives no "share of lettings": only where the budget sits against the typical rent, and how thin the record is
    const sh = shownRent(st);
    return "AED " + money(X) + " a year is " + (X < sh.m ? "just under" : X === sh.m ? "right at" : "above") + " the typical rent here (about AED " + money(sh.m) + "), but it rests on only " + st.n + " lettings, so treat it as a guide.";
  }
  const where = X < q1 ? "below most rents here" : X < m ? "just under the typical rent here" : X === m ? "right at the typical rent here" : X <= q3 ? "a little above the typical rent here" : "above most rents here";
  const share = X >= q3 ? "about three in four or more" : X >= m ? "at least half" : X >= q1 ? "between a quarter and a half" : "fewer than one in four";
  // v285: the quarters are those of the figure's own basis (rentFigure): the new lettings where there are 3 or more, else every contract
  const of = st.median_of === "new_lettings" ? st.nn + " " + B.word + " flats newly let here" : st.n + " " + B.word + " flats let here";
  return "AED " + money(X) + " a year is " + where + ": " + share + " of the " + of + " recently went for AED " + money(X) +
    " or less" + (st.s ? ", typically about " + money(st.s * SQFT) + " sq ft" : "") + ".";
}

function rentSource(C, q, rec) {
  const ri = C.ri, B = BEDS[q.beds];
  const win = windowOf(rec && rec.it, ri);   // v310 R6 - the dates, and what they are (contracts that started, or were registered); never a file name
  return "Rents: Dubai Land Department tenancy contracts (Ejari), " + (win ? esc(win.say) : "the pull of " + esc(ri.as_of || "")) +
    (rec && rec.it.area ? ", " + esc(pretty(rec.it.area)) : "") + ", " + (B.all ? "every size of " : B.word + " ") + ((rec ? rec.kind === "v" : !kindsOfType(q.type).includes("b")) ? "villas and townhouses" : "flats") +
    " (bedrooms are read from the size - the register rarely records them), new and renewed contracts, each contract counted once. Where the record " +
    "files the same contracts under two names they are one building here." + (rec && rec.aliases.length ? " This building's contracts are also filed as &ldquo;" +
    rec.aliases.map(esc).join("&rdquo;, &ldquo;") + "&rdquo;." : "") + " Typical rent is the median of the new lettings where there are three or more, otherwise of every contract - the same figure the list on screen shows; the middle half is the range the middle 50% of those rents fall in." +
    (rec && rec.it.ev_scope ? " The lettings counted are those of the whole community, " + esc(rec.it.ev_scope) + " (the register does not file them by home): this is the community's rent evidence, not this home's own." : "") +
    (rec && rec.kind === "v" && rec.bedsBasis ? " Villas and townhouses: the register files both as Villa; " + esc(BEDS_BASIS_SAY[rec.bedsBasis] || "") + "." : "");
}

// ------------------------------------------------------------------------------------------------ the dossier: three pages
// v291 CHECKLIST - an own photo carries its credit on the picture itself
function ownFigure(pic, w, h, alt) {
  return '<div class="ownpic" style="position:relative;width:' + r2(w) + "px;height:" + r2(h) + 'px;">' + fitImg(pic, w, h, alt) +
    '<div style="position:absolute;right:4px;bottom:4px;background:rgba(0,0,0,0.55);color:#FFF;font-size:8px;padding:1px 4px;border-radius:2px;">' + PHOTO_CREDIT + "</div></div>";
}
// v298 - our own render: an illustration, never a photograph. "modelled from the plot polygon and as-built outline" only where the record
// says so (it.render_basis === "plot_outline"); otherwise it claims nothing about being this building.
const renderBasis = (rec) => rec.it && rec.it.render_basis === "plot_outline";
const renderCaption = (rec) => rec.renderKind === "community" ? (rec.renderView ? rec.renderView.caption : "Illustration &middot; Najma render &middot; not as built") : "Illustration &middot; Najma render" + (renderBasis(rec) ? " &middot; modelled from the plot and as-built outline" : "") + (rec.renderView && rec.renderView.estimate ? " &middot; heights are an estimate" : "");   // v364
function renderFigure(rec, w, h) {
  return '<div class="renderpic" style="position:relative;width:' + r2(w) + "px;height:" + r2(h) + 'px;">' + fitImg(rec.renderPic, w, h, rec.name + " (illustration)") +
    '<div style="position:absolute;left:4px;bottom:4px;background:rgba(0,0,0,0.55);color:#FFF;font-size:8px;padding:1px 4px;border-radius:2px;">' + renderCaption(rec) + "</div>" +
    (rec.renderView && w >= 400 ? ABOUT_PRINT_CSS + aboutHtml(rec.renderView, { float: true }) : "") + "</div>";   // v364 - tap-to-open note on the large figure only; hidden in print
}
function thumb(rec, w, h, C) {
  if (rec.ownPic) return ownFigure(rec.ownPic, w, h, rec.name);   // v291 CHECKLIST
  if (rec.cardPic || rec.heroPic) return fitImg(rec.cardPic || rec.heroPic, w, h, rec.name);
  if (rec.svPic) return svFigure(rec.svPic, w, h, rec.name);   // v290 - Street View aimed at it, before the Blocks view
  if (rec.renderPic) return renderFigure(rec, w, h);   // v298 - then our own render, then the Blocks view
  // v285 - no developer photograph on file: the building's Blocks view (blocksThumb), never an empty box
  const D = (C && C.district[rec.d]) || {}, bv = blocksThumb(rec, D.layer, w, h, { district: rec.dist });
  if (bv) return bv.html;
  return '<div style="width:' + w + "px;height:" + h + "px;background:#E9E5DD;display:flex;align-items:center;justify-content:center;font-size:9px;color:" + MUTED + ';text-align:center;">Najma</div>';
}

function dossierSub(rec, q, i, of) {
  const B = BEDS[q.beds];
  return (i && of ? "OPTION " + i + " OF " + of : "OPTION") + " &middot; " + B.upper + " &middot; " + esc(rec.dist).toUpperCase() + (rec.buy ? " &middot; PURCHASE" : "") + (q.client ? " &middot; PREPARED FOR " + esc(q.client).toUpperCase() : "");
}

function whereLines(C, rec) {
  const pos = rec.pos || rec.cpos;
  if (!pos) return [];                                  // v302 - no position: the lines are left out, never a gap notice
  const out = [];
  const m = nearestMetro(C, pos);
  if (m && kmTxt(m.d, rec.exact)) out.push("Nearest metro: " + esc(m.n) + ", " + kmTxt(m.d, rec.exact));
  for (const [n, la, lo] of REF) { const t = kmTxt(km(pos, [la, lo])); if (t) out.push(n + ": " + t); }
  out.push("All straight-line distances" + (rec.exact ? "" : ", from an approximate position"));
  return out;
}
function nearbyLines(C, rec) {
  const pos = rec.pos || rec.cpos;
  if (!pos) return [];
  const sc = nearest(C, pos, "school", 40).filter((s) => ratingOf(s.i.x)).slice(0, 3), cl = nearest(C, pos, "clinic", 8).filter((s) => !isPharmacy(s.i)).slice(0, 3), gy = nearestGyms(C, rec, pos, 2);   // v306 - a pharmacy is not a clinic
  const out = [];
  if (sc.length) out.push("Schools: " + sc.map((s) => esc(cleanName(s.i.n)) + (join([esc(ratingOf(s.i.x)), kmTxt(s.d, rec.exact)]) ? " (" + join([esc(ratingOf(s.i.x)), kmTxt(s.d, rec.exact)]) + ")" : "")).join(", "));
  if (cl.length) out.push("Clinics: " + cl.map((s) => esc(cleanName(s.i.n)) + (kmTxt(s.d, rec.exact) ? " (" + kmTxt(s.d, rec.exact) + ")" : "")).join(", "));
  if (gy.length) out.push("Gyms: " + gy.map((s) => esc(s.n) + (kmTxt(s.d, rec.exact) ? " (" + kmTxt(s.d, rec.exact) + ")" : "")).join(", "));
  return out;
}
// v302 - gyms from the amenity-spots layer of the home's district (the layer behind the Around-the-community page): named places, straight-line
function nearestGyms(C, rec, pos, n) {
  const sp = ((C.district[rec.d] || {}).spots || {}).spots || [];
  return sp.filter((s) => s.type === "gym" && isCountableGym(s.name, "gym", [])).map((s) => ({ n: cleanName(s.name), d: km(pos, [+s.lat, +s.lng]) })).sort((a, b) => a.d - b.d).slice(0, n);   // v310 R2
}

function dossierPage1(C, rec, q, sub) {
  const B = BEDS[q.beds], st = rec.st;
  const bvHero = (rec.heroPic || rec.renderPic) ? null : blocksThumb(rec, (C.district[rec.d] || {}).layer, 702, 300, { district: rec.dist, fs: 9.5 });   // v285
  const hero = rec.ownPic ? ownFigure(rec.ownPic, 702, 300, rec.name) : rec.heroPic ? fitImg(rec.heroPic, 702, 300, rec.name, 0.38) : rec.svPic ? svFigure(rec.svPic, 702, 300, rec.name) : rec.renderPic ? renderFigure(rec, 702, 300) : bvHero ? bvHero.html
    : '<div style="width:702px;height:120px;background:#E9E5DD;display:flex;align-items:center;justify-content:center;font-size:13px;color:' + MUTED + ";\">Najma</div>";
  const F = facts(rec);
  const factHtml = F.length ? '<div style="display:grid;grid-template-columns:' + (F.length === 4 ? "0.9fr 0.9fr 1.4fr 0.8fr" : "repeat(" + F.length + ",minmax(0,1fr))") + ';gap:12px;">' +
    F.map(([k, v]) => '<div style="display:flex;flex-direction:column;gap:3px;"><div class="lbl" style="font-size:10px;">' + k + '</div><div style="font-size:13px;">' + esc(v) + "</div></div>").join("") + "</div>" : "";
  const stat = (v, l) => '<div style="display:flex;flex-direction:column;gap:3px;"><div class="lbl" style="font-size:9.5px;">' + l + '</div><div style="font-size:15px;font-weight:500;color:' + NAVY + ';white-space:nowrap;">' + v + "</div></div>";
  const rentLbl = "TYPICAL " + (q.beds === "studio" ? "STUDIO" : q.beds === "3" ? "3+ BED" : q.beds + "-BED") + " RENT A YEAR";
  const bands = Object.keys(rec.sts || {});
  // v277 - every home type: one row per type the register has lettings for, no budget line (a budget is for one type)
  const rent = rec.buy ? buyBox(C, rec, q) : B.all ? (bands.length ? '<div style="border:1px solid #E6E1D8;background:#FFFFFF;padding:9px 14px 6px 14px;display:flex;flex-direction:column;gap:5px;">' +
      '<div class="lbl" style="font-size:9.5px;">TYPICAL RENT A YEAR, BY TYPE</div>' +
      tbl([["left", "TYPE"], ["right", "TYPICAL RENT"], ["right", "MIDDLE HALF, AED"], ["right", "RECENT LETTINGS"], ["right", "TYPICAL SIZE"]],
        bands.map((b) => { const s = rec.sts[b]; return [esc(bandLabel(b)), "AED " + money(s.m), money(s.q1) + " &ndash; " + money(s.q3), String(s.n), sqftBit(s) || "&mdash;"]; })) + "</div>"
    : "")
    : st ? (() => {   // v310 R4/R5: under five lettings the rent is rounded to AED 500, there is no middle half, and the box says "based on only N lettings"; no impossible size
      const sh = shownRent(st), stats = (sh.few ? [stat("based on only " + st.n + " lettings", "HOW MANY")] : [stat("AED " + money(st.q1) + " &ndash; " + money(st.q3), "MIDDLE HALF"), stat(lettingsTxt(st), "RECENT LETTINGS")])
        .concat(st.s ? [stat(sqftBit(st), "TYPICAL SIZE")] : []);
      return '<div style="display:grid;grid-template-columns:1.3fr ' + stats.map(() => "1fr").join(" ") + ';gap:12px;align-items:end;border:1px solid #E6E1D8;background:#FFFFFF;padding:11px 14px;">' +
        '<div style="display:flex;flex-direction:column;gap:3px;"><div class="lbl" style="font-size:9.5px;">' + rentLbl + '</div><div class="serif" style="font-size:29px;color:' + GOLD + ';line-height:1;white-space:nowrap;">AED ' + money(sh.m) + "</div></div>" +
        stats.join("") + "</div>" + '<div style="font-size:10px;color:' + MUTED + ';line-height:1.35;">' + evidenceLine(st, rec, C) + "</div>";
    })() +
    (q.max ? '<div style="font-size:12px;color:' + INK + ';line-height:1.45;"><b>What AED ' + money(q.max) + " gets you here.</b> " + budgetLine(st, q, B) + "</div>" : "")
    : "";
  // v292 (Kendall, 2 Oct: "unacceptable" - the building page said "Amenities: To follow"): the developer's list where there is one, then every
  // sourced must-have answer (yes AND no), each with its level - never "to follow" while a register, the facts file, the broker or Google says
  const AM_ROWS = [["gym", "Gym"], ["parking", "Parking"], ["balcony", "Balcony"]];   // v374: pools, pets and newer-build are not offered
  const LVL = { community: "community", near: "close by", cluster: "this cluster", building: "this building", broker: "checked on site" };
  const row = (t, c) => '<div style="font-size:11.5px;color:' + c + ';line-height:1.35;">' + t + "</div>";
  const critRows = AM_ROWS.filter(([k]) => rec.crit && rec.crit[k] && (rec.crit[k].v === true || rec.crit[k].v === false))
    .map(([k, lab]) => { const c = rec.crit[k], lv = c.level ? LVL[c.level] || c.level : ""; return row((c.v ? "&#10003; " : "&#10007; ") + esc(lab) + (lv ? ' <span style="color:' + MUTED + ';">(' + esc(lv) + ")</span>" : "") +
      (c.level === "near" && c.near && c.near.m != null ? ' <span style="color:' + MUTED + ';">' + esc(distSay(c.near.m)) + "</span>" : ""), NAVY); })
    .concat(AM_ROWS.filter(([k]) => rec.crit && rec.crit[k] && rec.crit[k].v == null && rec.crit[k].community_fact)   // v310 R1 - the community has it, this home is not shown to be near it: labelled as the community's
      .map(([k, lab]) => { const f = rec.crit[k].community_fact; return row("In the wider community: " + esc(lab.toLowerCase()) + (f.m != null ? " (nearest " + esc(distSay(f.m)) + " away)" : ""), MUTED); }));
  const amen = ((rec.br && rec.br.amenities) || []).map((a) => row("&#8226; " + esc(a), NAVY)).join("") + critRows.join("") ||
    row(REALTOR_VERIFIES, MUTED);
  const lines = (xs) => xs.map((x) => '<div style="font-size:11.5px;color:' + NAVY + ';line-height:1.35;">' + x + "</div>").join("");
  const cards = '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px;">' +
    '<div class="card" style="padding:10px;"><div class="lbl" style="font-size:9.5px;">AMENITIES</div>' + amen + "</div>" +
    '<div class="card" style="padding:10px;"><div class="lbl" style="font-size:9.5px;">WHERE IT IS</div>' + (lines(whereLines(C, rec)) || row(REALTOR_VERIFIES, MUTED)) + "</div>" +
    '<div class="card" style="padding:10px;"><div class="lbl" style="font-size:9.5px;">NEARBY</div>' + (lines(nearbyLines(C, rec)) || row(REALTOR_VERIFIES, MUTED)) + "</div></div>";
  const title = '<div style="display:flex;flex-direction:column;gap:4px;"><div class="serif" style="font-size:33px;color:' + NAVY + ';line-height:1;">' + esc(rec.name) +
    '</div><div style="font-size:13px;color:' + MUTED + ';">' + esc(strap(rec)) + "</div></div>";
  return page(C, sub, hero + title + factHtml + rent + ((q.hide || []).includes("amen") ? "" : cards), "");   // page 1 carries no sources in the approved layout; they are on page 3
}
function buildingSource(rec) {
  const bits = [];
  if (rec.um) bits.push("floors and homes from the Dubai Land Department units register" + (rec.um.as_of ? " (" + esc(rec.um.as_of) + ")" : ""));
  if (rec.br && rec.br.developer) bits.push("developer from the developer's own project page");
  return bits.length ? "The building: " + bits.join("; ") + "." : "";
}
const BV_SAY = "A digital footprint view is the building as a simple model on the app's district digital footprint (building outlines and streets &copy; OpenStreetMap contributors), heights to scale, seen from the south - a picture of where and how tall it is, not a photograph.";
const nearbySource = () => "Metro: RTA station register. Schools (with their KHDA inspection rating) and clinics (Dubai Health Authority licence register): the nearest to this building, straight-line distances, not walking or driving times. Gyms: the community's mapped places (OpenStreetMap and Google Maps listings).";
function pictureSource(rec) {
  if (rec.picSource === "render" && !rec.ownPic) return "Picture on page 1: an illustration, Najma's own render, not a photograph" + (renderBasis(rec) ? " - modelled from the plot polygon and the as-built outline." : " - it does not claim to show this building as built.") + (rec.br ? " Amenities: the developer's own project page." : "");
  const bv = rec.picSource && rec.picSource !== "photo" && rec.picSource !== "none" && rec.picSource !== "street_view" ? " The picture on page 1 is a digital footprint of the buildings, not a photograph: " + BV_SAY +
    (rec.picSource === "blocks_area" ? " This record is a community of homes, not one building: the homes in gold are those the district digital footprint places in its Land Department sub-community - an approximate area." : "") : "";
  if (rec.ownPic) return "Picture on page 1: Najjuko's own photograph, taken on site" + (rec.ownPic.at ? " (" + esc(longDate(rec.ownPic.at)) + ")" : "") + " - " + PHOTO_CREDIT + "." +   // v291 CHECKLIST
    (rec.br ? " Amenities: the developer's own project page." : "");
  if (!rec.br) return bv.trim();
  return "Pictures and amenities: the developer's own project page" + retrievedSay(rec.br.retrieved) + ". " +
    esc(rec.br.amenities_note || rec.br.photos_note || "");
}

// ------------------------------------------------------------------------------------------------ v282: the client's brief, answered
// Each criterion the client named (must, then nice to have, then the home type and furnishing they asked for): yes / no / not known,
// with where the answer comes from, in plain English. "Not known" is said as such, never left blank and never turned into a no.
const CRIT_NAME = Object.fromEntries(BRIEF_CRITERIA);
export const briefAsked = (q) => !!((q.musts && q.musts.length) || (q.nice && q.nice.length) || /townhouse/.test(String(q.type || "")));
export function criteriaRows(rec, q) {
  const rows = [];
  for (const k of q.musts || []) if (rec.crit && rec.crit[k]) rows.push([CRIT_NAME[k], "must", rec.crit[k]]);
  for (const k of q.nice || []) if (rec.crit && rec.crit[k]) rows.push([CRIT_NAME[k], "nice to have", rec.crit[k]]);
  if (/townhouse/.test(String(q.type || "")) && rec.crit && rec.crit.townhouse) rows.push(["townhouse", "asked", rec.crit.townhouse]);
  return rows;
}
export const markWord = (v) => (v === true ? "&#10003; yes" : v === false ? "&#10007; no" : "");
function criteriaBlock(rec, q) {
  if (!briefAsked(q)) return "";
  const all = criteriaRows(rec, q), rows = all.filter((r) => r[2].v === true || r[2].v === false || (r[2].v == null && r[2].community_fact));   // v302 - a gap is left out, not printed; v310 - the community's own fact is printed as the community's
  if (!rows.length) return "";
  return '<div class="critbox" style="border:1px solid #E6E1D8;background:#FFFFFF;padding:10px 14px;display:flex;flex-direction:column;gap:5px;">' +
    '<div class="lbl" style="font-size:9.5px;">HOW IT MEETS THE BRIEF</div>' +
    tbl([["left", "WHAT THEY ASKED FOR"], ["left", "ANSWER"], ["left", "WHERE THE ANSWER COMES FROM"]],
      rows.map(([label, level, c]) => [esc(label) + ' <span style="color:' + MUTED + ';font-size:9.5px;">(' + level + ")</span>",
        '<b style="color:' + (c.v === true ? "#2F6B55" : c.v === false ? "#9A3B3B" : MUTED) + ';white-space:nowrap;">' + (c.v == null && c.community_fact ? "in the community" : markWord(c.v)) + "</b>",
        '<span style="font-size:9.6px;">' + esc(c.v == null && c.community_fact ? c.community_fact.say + ". The community's, not shown to be at this home." : c.src || "") + (c.detail && c.v != null ? " " + esc(c.detail) + "." : "") + "</span>"])) +
    (rows.length < all.length ? '<div style="font-size:9.5px;color:' + MUTED + ';">' + REALTOR_VERIFIES + "</div>" : "") + "</div>";
}
// one line of marks for a one-sheet card
function criteriaLine(rec, q) {
  if (!briefAsked(q)) return "";
  const rows = criteriaRows(rec, q).filter((r) => r[2].v === true || r[2].v === false);
  return rows.length ? '<div class="critline" style="font-size:9.2px;color:' + INK + ';line-height:1.3;">' + rows.map(([label, , c]) =>
    (c.v === true ? "&#10003; " + esc(label) + (c.live && c.say ? " (" + esc(c.say) + ")" : "") : "&#10007; " + esc(label))).join(" &middot; ") + "</div>" : "";
}

// ------------------------------------------------------------------------------------------------ v282: the areas side by side
// Compare and Full pack open with this page when 2 or 3 areas were chosen with "Compare these areas side by side": the SAME block the
// /brief page shows (briefSearch -> compareAreas in src/brief.js, run as a client: owner false), one column per area.
export async function comparisonFor(env, q) {
  if (!q.compare || q.mode !== "rent") return null;
  const sp = new URLSearchParams();
  sp.set("mode", "rent"); sp.set("beds", (q.bedsList || [q.beds]).join(",")); if (q.min) sp.set("min", String(q.min)); if (q.max) sp.set("max", String(q.max));
  if (q.stretch) sp.set("stretch", String(q.stretch)); sp.set("areas", q.areas.join(",")); sp.set("type", q.type);
  sp.set("musts", (q.musts || []).join(",")); sp.set("nice", (q.nice || []).join(",")); sp.set("compare", "1"); sp.set("limit", "1");
  const out = await briefSearch(env, sp, { owner: false, live: false });   // v291 - the comparison reads no per-home answer: no Google call
  return out.status === 200 && out.body.comparison ? { cols: out.body.comparison, window: out.body.window, as_of: out.body.as_of } : null;
}
const CMP_ROWS = [["matches", "Homes that match"], ["rent", "Typical rent, last 60 days"], ["types", "Home types"], ["schools", "Schools nearby"]];
export function comparisonPage(C, q, cmp) {
  const cols = cmp.cols;
  const cell = (c) => !c || (c.v !== true && c.v !== false) ? "" : '<b style="color:' + (c.v === true ? "#2F6B55" : c.v === false ? "#9A3B3B" : MUTED) + ';">' + markWord(c.v) + "</b> " + esc(c.say || "") +
    (c.src ? '<div style="font-size:8.4px;color:' + MUTED + ';margin-top:2px;">' + esc(c.src) + "</div>" : "");
  const cellHtml = (a, k) => { const c = a[k]; return k === "types" ? ["apartment", "townhouse", "villa"].some((t) => cell(c && c[t])) : !!cell(c); };
  const body = CMP_ROWS.filter(([k]) => cols.some((a) => cellHtml(a, k))).map(([k, label]) => '<tr><td style="padding:6px 8px;border-bottom:1px solid #E6E1D8;font-size:10.5px;font-weight:600;color:' + NAVY + ';vertical-align:top;width:150px;">' + label + "</td>" +
    cols.map((a) => {
      const c = a[k];
      const h = k === "types" ? ["apartment", "townhouse", "villa"].map((t) => cell(c && c[t]) ? "<div>" + (t === "villa" ? "villa or townhouse" : t) + ": " + cell(c && c[t]) + "</div>" : "").join("") : cell(c);
      return '<td style="padding:6px 8px;border-bottom:1px solid #E6E1D8;font-size:10px;line-height:1.35;vertical-align:top;">' + (h || "&mdash;") + "</td>";
    }).join("") + "</tr>").join("");
  const head = '<tr style="background:' + NAVY + ';"><th style="padding:7px 8px;"></th>' + cols.map((a) => '<th style="text-align:left;padding:7px 8px;color:#FBFAF7;font-size:11px;font-weight:600;">' + esc(a.name) + "</th>").join("") + "</tr>";
  const B = BEDS[q.beds];
  return landPage(C, '<div style="height:74px;display:flex;align-items:center;justify-content:space-between;padding:0 30px;background:#FFF;border-bottom:1px solid #E6E1D8;flex-shrink:0;">' +
    '<div style="display:flex;flex-direction:column;gap:3px;"><div class="serif" style="font-size:24px;color:' + NAVY + ';line-height:1;">The areas side by side</div>' +
    '<div style="font-size:11px;color:' + MUTED + ';">' + C.today + " &middot; " + esc(cols.map((a) => a.name).join(" · ")) + (B && !B.all ? " &middot; " + esc(bedsWordOf(q)) : "") + "</div></div>" + logo(C, 68) + "</div>" +
    '<div class="cmppage" style="flex:1;padding:10px 30px 4px 30px;overflow:hidden;"><table style="width:100%;border-collapse:collapse;">' + head + body + "</table>" +
    '<div style="font-size:8.6px;color:' + MUTED + ';line-height:1.35;margin-top:6px;">&#10003; a record says yes &middot; &#10007; a record says no. ' + REALTOR_VERIFIES + ' ' +
    "Rents are registered tenancy contracts (Ejari) " + esc(cmp.window ? cmp.window[0] + " to " + cmp.window[1] : "") + " for the whole Land Department area, named projects or not; what homes let for, not what is free. Furnishing is not recorded by the register.</div></div>" + landFooter());
}
const bedsWordOf = (q) => { const bl = (q.bedsList || [q.beds]).filter((b) => BEDS[b] && !BEDS[b].all); if (bl.length < 2) return BEDS[q.beds].word; const w = bl.map((b) => (b === "studio" ? "studio" : b === "3" ? "3+" : b)); return w.slice(0, -1).join(", ") + " or " + w[w.length - 1] + "-bedroom"; };

const MAP_TO_FOLLOW = (h) => '<div class="maptofollow" style="height:' + h + 'px;border:1px dashed #DED9D0;display:flex;align-items:center;justify-content:center;font-size:14px;color:' + MUTED + ';">' + REALTOR_VERIFIES + '</div>';

function dossierPage2(C, rec, q, sub, more) {   // v307 - more: a purchase puts the sales table under the map ({ html, small })
  const D = C.district[rec.d] || {};
  const mark = markOf(rec, D.layer);
  const svg = D.layer && mark.placed ? briefMapSvg(D.layer, [mark], { single: true, district: rec.dist, districtSlug: rec.d }) : "";
  const cb = criteriaBlock(rec, q);                    // v282 - how it meets the client's brief; the map shrinks to make room
  const mw = cb ? (rec.avail && rec.avail.count ? 470 : 560) : 700;
  const map = svg ? '<div style="width:' + (mw + 2) + 'px;border:1px solid #E6E1D8;line-height:0;">' + svg.replace("<svg ", '<svg style="width:' + mw + 'px;height:auto;display:block;" ') + "</div>" : MAP_TO_FOLLOW(cb ? 300 : 468);
  const body = '<div class="serif" style="font-size:24px;color:' + NAVY + ';">Where it is</div><div class="sub">' + (mark.area ? "The community&rsquo;s homes in gold (an approximate area), among the other buildings of " : "The building in gold on its own plot, among the other buildings of ") + esc(rec.dist) +
    ". Simple models, heights to scale, seen from the south.</div>" + map + cb + availBlock(rec, q) + (more ? more.html : "");
  return page(C, sub, body, smallPrint([
    svg ? "Map: building outlines and streets &copy; OpenStreetMap contributors; building position from the app's district digital footprint" + (mark.approx ? " (this one approximate, from a public map listing)" : "") +
      (mark.area ? " - here the homes the district model places in the Land Department sub-community of this name, an approximate area, not a surveyed boundary" : "") + "." : "",
    rec.avail && rec.avail.count ? "Availability: " + esc(rec.avail.developer) + "'s own availability sheet of " + esc(rec.avail.as_of || "") + ", as posted to the broker group; the developer's statement, not a register." : ""].concat(more ? more.small : [])));
}

function groupLayouts(rec, B) {
  const flats = [];
  for (const [fl, us] of Object.entries(rec.un.floors)) for (const u of us) if (B.uc(String(u.c)) && u.sqft) flats.push({ fl: +fl, sqft: u.sqft, bal: u.bal || 0, c: String(u.c) });
  if (!flats.length) return null;
  // flats of the same size and balcony share a layout; sizes within 3 sq ft are the same layout measured twice.
  // v277 - across every type (B.all), a layout is also one type: a 700 sq ft studio and a 700 sq ft one-bed are two layouts
  const groups = [];
  for (const f of flats.sort((a, b) => a.sqft - b.sqft || a.bal - b.bal)) {
    const g = groups.find((x) => (!B.all || x.c === f.c) && Math.abs(x.sqft - f.sqft) <= 3 && Math.abs(x.bal - f.bal) <= 3);
    if (g) { g.n++; g.lo = Math.min(g.lo, f.sqft); g.hi = Math.max(g.hi, f.sqft); g.blo = Math.min(g.blo, f.bal); g.bhi = Math.max(g.bhi, f.bal); g.fl.push(f.fl); }
    else groups.push({ sqft: f.sqft, bal: f.bal, c: f.c, n: 1, lo: f.sqft, hi: f.sqft, blo: f.bal, bhi: f.bal, fl: [f.fl] });
  }
  groups.sort((a, b) => b.n - a.n);
  return { total: flats.length, top: groups.filter((g) => g.n > 1).slice(0, 8), other: groups.length - Math.min(8, groups.filter((g) => g.n > 1).length) };
}
const typeOfC = (c) => (c === "studio" ? "Studio" : +c >= 3 ? c + " bedroom" : c + " bedroom");
function layoutsBlock(rec, q) {
  const B = BEDS[q.beds], st = rec.st;
  const rng = (a, b) => a === b ? String(a) : a + "&ndash;" + b;
  const flatsOf = B.all ? "flats" : B.word + " flats";
  let table = "", intro = "";
  const G = rec.un && rec.un.floors ? groupLayouts(rec, B) : null;
  if (G && G.top.length) {
    const rows = G.top.map((g, k) => { const fl = g.fl.sort((a, b) => a - b); return (B.all ? [esc(typeOfC(g.c))] : []).concat(["Layout " + String.fromCharCode(65 + k), String(g.n), rng(fl[0], fl[fl.length - 1]), rng(g.lo, g.hi), g.bhi ? rng(g.blo, g.bhi) : "none"]); });
    if (G.other > 0) rows.push((B.all ? [""] : []).concat([G.other + " other " + (B.all ? "" : B.word + " ") + "layout" + (G.other > 1 ? "s" : ""), "&mdash;", "&mdash;", "&mdash;", "&mdash;"]));
    table = tbl((B.all ? [["left", "TYPE"]] : []).concat([["left", "LAYOUT"], ["right", "FLATS"], ["left", "FLOORS"], ["right", "SIZE, SQ FT"], ["right", "BALCONY, SQ FT"]]), rows);
    intro = esc(rec.name) + " has " + G.total + " " + flatsOf + ". Flats of the same size and balcony share a layout; the commonest are listed. Sizes include the balcony. " +
      (st ? "The rent register does not say which layout was let, so the typical rent above covers all of them (AED " + money(st.m) + ", " + st.n + " recent lettings)." : "");
  } else if (rec.um && Array.isArray(rec.um.rows) && rec.um.rows.some((r) => B.tn(r.type))) {
    const letOf = (r) => { if (!B.all) return st ? "AED " + money(st.m) + " &middot; " + st.n + " let" : "&mdash;";
      const m = /^(\d+) bedroom/i.exec(String(r.type || "")), b = /^studio$/i.test(String(r.type || "")) ? "studio" : m ? (+m[1] >= 3 ? "3" : m[1]) : null, s = b && rec.sts ? rec.sts[b] : null;
      return s ? "AED " + money(s.m) + " &middot; " + s.n + " let" : "&mdash;"; };
    const rows = rec.um.rows.filter((r) => B.tn(r.type)).map((r) => [esc(pretty(r.type)), String(r.units || "&mdash;"), r.levels ? esc(r.levels) : "&mdash;", r.median_sqm ? money(r.median_sqm * SQFT) : "&mdash;", letOf(r)]);
    table = tbl([["left", "TYPE"], ["right", "FLATS"], ["left", "FLOORS"], ["right", "TYPICAL SIZE, SQ FT"], ["right", "RENTED RECENTLY"]], rows);
    intro = "Here is this building's " + (B.all ? "home" : B.word) + " count from the Land Department units register, with the typical size. Sizes include the balcony.";
  } else if (st) {
    const few = st.n < FEW_LETTINGS;   // v310 R4 - no middle half under five lettings: the column is left out, not left blank
    table = tbl([["left", st.s ? "SIZE THAT WAS LET" : "WHAT WAS LET"], ["right", "TYPICAL RENT"], ["right", "HOW MANY"]].concat(few ? [] : [["right", "MIDDLE HALF, AED"]]),
      [[st.s ? "about " + sqftBit(st) : "recent lettings", "AED " + money(shownRent(st).m), few ? "based on only " + st.n : String(st.n)].concat(few ? [] : [money(st.q1) + " &ndash; " + money(st.q3)])]);
    // pack audit, 1 Oct 2026: a building the units register does not yet list flat by flat gets this one row. The wording says what
    // the row IS (the flats actually let here), not what is missing, so a thin page does not read as an error.
    intro = "What " + (B.word === "home" ? "homes" : B.word + " flats") + " in " + esc(rec.name) + " actually let for in the latest pull of the tenancy register: their typical size and rent. " +
      "The leasing team can share the floor plans. Sizes include the balcony.";
  } else {
    intro = REALTOR_VERIFIES;
  }
  return '<div style="display:flex;flex-direction:column;gap:6px;"><div class="serif" style="font-size:20px;color:' + NAVY + ';">The ' + (B.all ? "layouts, every type" : B.word + " layouts") + "</div>" +
    '<div style="font-size:11.5px;color:' + MUTED + ';line-height:1.42;">' + intro + "</div>" + table + "</div>";
}
function dossierPage3(C, rec, q, sub) {
  const ph = rec.photos || [];
  const k = Math.min(4, ph.length), colW = (702 - 8 * (k - 1)) / Math.max(1, k);   // the grid's own column width: 702 px body, 8 px gaps
  const photos = ph.length ? '<div style="display:grid;grid-template-columns:repeat(' + k + ',minmax(0,1fr));gap:8px;">' + ph.map((p) =>
    '<div style="display:flex;flex-direction:column;gap:2px;">' + fitImg(p.pic || { src: p.src }, colW, 112, p.caption) +
    '<div style="font-size:9.5px;color:' + MUTED + ';">' + esc(String(p.caption || "").split(" (")[0].split(" - ").pop()) + "</div>" +
    '<div style="font-size:8px;color:#8C887C;">' + "The developer&rsquo;s page" + "</div></div>").join("") + "</div>"
    : '<div style="font-size:11px;color:' + MUTED + ";border:1px dashed #DED9D0;padding:8px 10px;\">The developer's page publishes no pictures of the pool, gym or lobby and no floor plans. Ask the leasing team or listing broker for photographs of the actual flat.</div>";
  return page(C, sub, '<div class="serif" style="font-size:24px;color:' + NAVY + ';">' + esc(rec.name) + "</div>" + ((q.hide || []).includes("photos") ? "" : photos) + ((q.hide || []).includes("layouts") ? "" : layoutsBlock(rec, q)),
    smallPrint([rentSource(C, q, rec), buildingSource(rec), rec.un ? "Layouts: Dubai Land Department units register, flat by flat." : "", nearbySource(), pictureSource(rec)]));
}
export function dossierHtml(C, rec, q, i, of) {
  const sub = dossierSub(rec, q, i, of);
  return dossierPage1(C, rec, q, sub) + dossierPage2(C, rec, q, sub, rec.buy ? { html: buySalesTable(rec, q), small: [buySource(C, q, rec)] } : null) + (rec.buy ? buyPages(C, rec, q, sub) : ((q.hide || []).includes("photos") && (q.hide || []).includes("layouts") ? "" : dossierPage3(C, rec, q, sub)));
}

// ------------------------------------------------------------------------------------------------ the one-sheet (A4 landscape)
function titleOf(C, q) {
  const B = BEDS[q.beds], n = C.recs.length;
  const ds = [...new Set(C.recs.map((r) => r.dist))];
  const where = ds.length === 1 ? ds[0] : ds.length === 2 ? ds.join(" and ") : ds.length + " districts";
  const count = n <= 10 ? NUMWORD[n] : String(n);
  const budget = q.min && q.max && q.min < q.max ? ", AED " + money(q.min) + "&ndash;" + money(q.max) + " a year" : q.max ? ", around AED " + money(q.max) + " a year" : "";
  return count + " " + (B.all ? "" : bedsWordOf(q) + " ") + "option" + (n === 1 ? "" : "s") + " in " + esc(where) + budget;
}
// v289 - where the developer's page lists no amenities, the card says what the amenity facts file answers (img_amenities_<district>,
// the same answers as the criteria), grouped by level: "Community (DAMAC Hills): community pool, pet-friendly, gym &middot; This building: parking"
const AMEN_SHORT = { gym: "gym", parking: "parking", balcony: "balconies" };   // v374: pools and pets are not offered
export function amenLine(rec) {
  const lv = { building: [], cluster: [], community: [], near: [] }, wide = [];
  for (const k of Object.keys(AMEN_SHORT)) {
    const c = rec.crit && rec.crit[k];
    if (c && c.v === true && lv[c.level || "building"]) lv[c.level || "building"].push(AMEN_SHORT[k] + (c.level === "near" && c.near && c.near.m != null ? " (" + distSay(c.near.m) + ")" : ""));
    else if (c && c.community_fact) wide.push(AMEN_SHORT[k] + (c.community_fact.m != null ? " (nearest " + distSay(c.community_fact.m) + " away)" : ""));   // v310 R1 - labelled as the community's, never a yes for the home
  }
  const where = rec.af && rec.af.community_name ? " (" + esc(rec.af.community_name) + ")" : "";
  const out = [];
  if (lv.near.length) out.push("Close by: " + lv.near.join(", "));
  if (wide.length) out.push("In the wider community" + where + ": " + wide.join(", "));
  if (lv.community.length) out.push("Community" + where + ": " + lv.community.join(", "));
  if (lv.cluster.length) out.push("This cluster: " + lv.cluster.join(", "));
  if (lv.building.length) out.push("This building: " + lv.building.join(", "));
  return out.join(" &middot; ");
}
// v289 - no map position (villa clusters): the file's metro fact, where a source gives one ("No metro nearby (DAMAC Hills)")
export function amenMetro(rec) {
  const f = rec.af && rec.af.facts && rec.af.facts.metro;
  return f && typeof f.v === "boolean" ? esc(f.say) + " - " + (f.level === "community" ? "a community fact" : "a building fact") + ", per " + esc(f.source_name || "a named source") : "";
}
// v277: the card carries no "Still filling" line any more (the register estimate is off the client face)
function oneSheetCards(C, q) {
  const B = BEDS[q.beds];
  // the card's own inner width (1123 px page - 2 x 30 px padding, 9 px gaps, 1 px border each side), so the picture can be clipped
  // to it whole (fitImg) instead of object-fit:cover
  const cols0 = Math.min(5, Math.max(3, C.recs.length)), cardW = (1063 - 9 * (cols0 - 1)) / cols0 - 2;
  const cards = C.recs.map((rec) => {
    const st = rec.st;
    // v290 - a community with no position of its own is measured from the centre of its homes (svTarget), said so; never "to follow" when known
    const mp = rec.pos || rec.cpos, mFrom = rec.pos ? "" : " (from the community's centre)";
    const metro = mp ? (() => { const m = nearestMetro(C, mp); return m && kmTxt(m.d, rec.exact) ? esc(m.n) + " metro, " + kmTxt(m.d, rec.exact) + mFrom : (m ? "" : amenMetro(rec) || ""); })() : amenMetro(rec) || "";
    const amen = ((rec.br && rec.br.amenities) || []).slice(0, 3).map((a) => esc(a.split(" (")[0])).join(", ") || amenLine(rec) || "";
    const perType = B.all ? Object.keys(rec.sts || {}).map((b) => '<div style="font-size:10px;color:' + INK + ';">' + esc(bandLabel(b)) + ": AED " + money(rec.sts[b].m) + " &middot; " + rec.sts[b].n + " let</div>").join("") : "";
    return '<div class="bcard" style="border:1px solid #E6E1D8;background:#FFF;display:flex;flex-direction:column;overflow:hidden;min-height:0;">' +
      '<div style="position:relative;">' + thumb(rec, cardW, 136, C) + '<div style="position:absolute;left:6px;top:6px;width:24px;height:24px;border-radius:12px;background:' + NAVY +
      ';color:#FFF;font-weight:600;font-size:13px;display:flex;align-items:center;justify-content:center;">' + rec.n + "</div></div>" +
      '<div style="padding:7px 9px 8px 9px;display:flex;flex-direction:column;gap:3px;">' +
      '<div class="serif" style="font-size:16px;color:' + NAVY + ';line-height:1.05;">' + esc(rec.name) + "</div>" +
      (st ? '<div style="display:flex;align-items:baseline;gap:6px;"><span class="serif" style="font-size:20px;color:' + GOLD + ';">AED ' + money(shownRent(st).m) + '</span><span style="font-size:9.5px;color:' + MUTED + ';">typical a year</span></div>' +
        (st.n < FEW_LETTINGS ? "" : '<div style="font-size:10px;color:' + INK + ';">Middle half AED ' + money(st.q1) + "&ndash;" + money(st.q3) + "</div>") +
        '<div style="font-size:10px;color:' + INK + ';">' + (st.n < FEW_LETTINGS ? esc(evidenceSay(st, rec.it.ev_scope)) : lettingsTxt(st) + (rec.it.ev_scope ? " recent lettings in " + esc(rec.it.ev_scope) + " (the community&rsquo;s, not this home&rsquo;s)" : " recent lettings")) + (st.s ? " &middot; about " + sqftBit(st) : "") + "</div>"
        : perType) +
      '<div style="font-size:9.8px;color:' + MUTED + ';line-height:1.25;">' + amen + "</div>" +
      '<div style="font-size:9.8px;color:' + NAVY + ';line-height:1.25;">' + metro + "</div>" + criteriaLine(rec, q) +
      "</div></div>";
  }).join("");
  const cols = Math.min(5, Math.max(3, C.recs.length));
  return { html: '<div style="flex:1;display:grid;grid-template-columns:repeat(' + cols + ',minmax(0,1fr));grid-template-rows:repeat(' + Math.ceil(C.recs.length / cols) + ',minmax(0,1fr));min-height:0;gap:9px;padding:10px 30px 6px 30px;">' + cards + "</div>" };
}
const landFooter = () => '<div class="curator" style="border-top:1px solid #DED9D0;margin:0 30px;padding:5px 0 9px 0;display:flex;justify-content:center;align-items:center;gap:8px;font-size:12px;color:' + NAVY + ';">' + CURATOR + "</div>";
function landPage(C, inner) { C.pages++; return '<div class="sheet page land" style="width:1123px;height:794px;">' + inner + "</div>"; }

export function oneSheetHtml(C, q) {
  if (C.buy) return buyOneSheetHtml(C, q);   // v306
  const B = BEDS[q.beds];
  const { html } = oneSheetCards(C, q);
  const p1 = landPage(C, '<div style="height:74px;display:flex;align-items:center;justify-content:space-between;padding:0 30px;background:#FFF;border-bottom:1px solid #E6E1D8;flex-shrink:0;">' +
    '<div style="display:flex;flex-direction:column;gap:3px;"><div class="serif" style="font-size:26px;color:' + NAVY + ';line-height:1;">' + titleOf(C, q) + "</div>" +
    '<div style="font-size:11px;color:' + MUTED + ';">' + C.today + " &middot; numbers match the map &middot; rents are rents recently agreed, not asking prices</div></div>" + logo(C, 68) + "</div>" +
    html +
    '<div style="padding:0 30px 4px 30px;font-size:8.3px;color:' + MUTED + ';line-height:1.3;">Rents: Dubai Land Department tenancy contracts, ' + ((w) => (w ? esc(w.say) : "the pull of " + esc(C.ri.as_of || "")))(windowOf(C.recs[0] && C.recs[0].it, C.ri)) + ", " + (B.all ? "every size of " : B.word + "-sized ") +
    (!kindsOfType(q.type).includes("b") ? "villas and townhouses" : kindsOfType(q.type).includes("v") ? "homes" : "flats") + ", each contract counted once; typical rent is the median of new lettings where there are three or more, else of every contract, as on screen. Metro distances are straight lines. Pictures: each developer's own project page" + (C.recs.some((r) => r.picSource && r.picSource !== "photo" && r.picSource !== "none" && r.picSource !== "street_view" && r.picSource !== "render") ? "; where none is on file, a digital footprint view: the building as a simple model on the district digital footprint (&copy; OpenStreetMap contributors), heights to scale - not a photograph." : ".") +
    (C.recs.some((r) => r.picSource === "street_view") ? " Street View: Google, aimed at the building, the month shown on the picture." : "") +
    (C.recs.some((r) => r.picSource === "render") ? " An illustration is Najma's own render, not a photograph." : "") +
    (C.recs.some((r) => r.it.ev_scope) ? " For a home with no lettings of its own in the register, the rent is the community's (" + [...new Set(C.recs.filter((r) => r.it.ev_scope).map((r) => esc(r.it.ev_scope)))].join(", ") + "): this is the community's rent evidence, not that home's own." : "") +
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
  const stOf = (set) => { set = set || {}; if (!B.all) return rentFigure(set[B.band]); let best = null; for (const b of BANDS) { const s = set[BEDS[b].band]; if (s && (!best || s.n > best.n)) best = s; } return rentFigure(best); };   // v277: every type - the best-evidenced band stands for the building; v285: on rentFigure, the list's own figure
  return C.ri.items.filter((it) => (!ds.length || ds.includes(it.d))).map((it) => ({ it, st: stOf(!kindsOfType(q.type).includes("b") ? it.v : it.b) }))
    .filter((x) => x.st && x.st.n >= 3 && x.st.m >= lo && x.st.m <= hi).sort((a, b) => b.st.n - a.st.n);
}
function appendixHtml(C, q) {
  const all = matchAll(C, q), CAP = 30;
  const rows = all.slice(0, CAP).map(({ it, st }) => [esc(pretty(it.n)) + ((it.a || []).length ? ' <span style="color:' + MUTED + ';font-size:9.5px;">(also filed as ' + esc(it.a.map(pretty).join(", ")) + ")</span>" : ""),
    "AED " + money(st.m), money(st.q1) + "&ndash;" + money(st.q3), String(st.n), sqftBit(st) || "&mdash;", esc(st.last || it.last || "")]);
  const B = BEDS[q.beds];
  const body = '<div style="display:flex;flex-direction:column;gap:3px;"><div class="serif" style="font-size:24px;color:' + NAVY + ';">Appendix &mdash; every building this brief matches</div>' +
    '<div class="sub">Every building whose typical ' + (B.all ? "" : B.word + " ") + "rent in the latest pull is" + (q.min ? " at least AED " + money(q.min) + " and" : "") + (q.max ? " within 3% of AED " + money(q.max) : " on record") +
    " (" + all.length + " buildings" + (all.length > CAP ? ", the " + CAP + " with most lettings shown" : "") + "), most lettings first. Buildings with few lettings give a less certain figure.</div></div>" +
    tbl([["left", "BUILDING"], ["right", "TYPICAL RENT"], ["right", "MIDDLE HALF, AED"], ["right", "LETTINGS"], ["right", "TYPICAL SIZE"], ["right", "LATEST LETTING"]], rows);
  return page(C, "APPENDIX &middot; " + B.upper + (C.recs[0] ? " &middot; " + esc(C.recs[0].dist).toUpperCase() : ""), body, smallPrint([rentSource(C, q, null)]));
}
export function packHtml(C, q) {
  return oneSheetHtml(C, q) + C.recs.map((r) => dossierHtml(C, r, Object.assign({}, q, { beds: r.beds || q.beds }), r.n, C.recs.length)).join("") + (C.buy ? "" : appendixHtml(C, q));   // v306 - a purchase has no rent appendix
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
  // v298 - fp: layer footprint ids a record carries for itself (a townhouse placed by its own plot, no app building id)
  const ids = [rec.it.i].concat(rec.it.is || []).concat(rec.it.fp || []).filter((x) => x != null);
  if (ids.length && layer.b.some((b) => ids.includes(b[0]))) return Object.assign(base, { placed: true, ids });
  if (rec.pos && Array.isArray(layer.ll)) {
    const [a, b, c, d, e, f] = layer.ll, lat = rec.pos[0], lon = rec.pos[1];
    const floors = rec.um && rec.um.floors;
    return Object.assign(base, { placed: true, approx: true, xy: [a * lon + b * lat + c, d * lon + e * lat + f], side: 40, h: floors ? floors * 3.4 : 30 });
  }
  // v289 - a register community (no app building, no position): the footprints the district model attributes to its own name (areaIds,
  // set in loadContext). Approximate by nature - the register geocodes a sub-community once - so it is drawn and labelled as such.
  if (Array.isArray(rec.areaIds) && rec.areaIds.length) {
    const want = new Set(rec.areaIds), got = layer.b.filter((b) => want.has(b[0])).map((b) => b[0]);
    if (got.length) return Object.assign(base, { placed: true, area: true, ids: got });
  }
  return base;
}
// v289 - the district model's register attribution: normalised sub-community name -> the layer footprint ids (anchor i = layer id,
// scripts/brief_map_layers.py writes the layer in the anchors' feature order). null when the district has no anchors.
export function areaIndex(anchors, overrides) {   // v291 CHECKLIST - overrides: img_anchor_overrides_<d>, merged over the anchors (checklist_data.js)
  const list = anchors && Array.isArray(anchors.anchors) ? anchors.anchors : null;
  if (!list) return overrides ? applyAnchorOverrides(null, overrides) : null;
  const m = new Map();
  for (const a of list) { if (!a || !a.cluster || a.i == null) continue; const k = norm(a.cluster); if (!k) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(a.i); }
  return overrides ? applyAnchorOverrides(m, overrides) : m;   // v291 CHECKLIST
}

// ------------------------------------------------------------------------------------------------ v290: the Street View picture
// Kendall, 2 Oct 2026 ("where is the actual picture of the building?" / "approve Street View in the report"): where no developer photograph
// is on file, the card shows Google Street View aimed at the building - or, for a register community (DAMAC Hills villas), at the centre of
// the homes the district model attributes to it. Fetched at render time and embedded in the document only, never stored (Google's terms);
// "© Google" and the capture month on the picture. Any miss - no secret, no panorama, too far, too old, an error or a timeout - falls back to
// the Blocks view, so a card is never worse than before. Buildings with only an approximate position, or none, never get Street View.
const SV = { radius: 150, maxDist: 120, minYear: 2019, metaMs: 3500, imgMs: 6000 };
function llOfXy(layer, x, y) {
  const [a, b, c, d, e, f] = layer.ll, det = a * e - b * d;
  if (!det) return null;
  return [(a * (y - f) - d * (x - c)) / det, (e * (x - c) - b * (y - f)) / det];   // [lat, lon]
}
const mDist = (p, q) => { const R = 6371000, la = (p[0] + q[0]) / 2 * Math.PI / 180; return R * Math.hypot((q[0] - p[0]) * Math.PI / 180, (q[1] - p[1]) * Math.PI / 180 * Math.cos(la)); };
const bearing = (p, q) => { const r = Math.PI / 180, y = Math.sin((q[1] - p[1]) * r) * Math.cos(q[0] * r), x = Math.cos(p[0] * r) * Math.sin(q[0] * r) - Math.sin(p[0] * r) * Math.cos(q[0] * r) * Math.cos((q[1] - p[1]) * r); return (Math.atan2(y, x) / r + 360) % 360; };
// what to aim at: the building's own footprint(s), or a community's attributed homes; else nothing (approximate or unknown position)
export function svTarget(rec, layer) {
  if (!layer || !Array.isArray(layer.ll) || !Array.isArray(layer.b)) return null;
  const m = markOf(rec, layer);
  if (!m.placed || m.approx || !Array.isArray(m.ids) || !m.ids.length) return null;
  const want = new Set(m.ids), pts = [];
  for (const [id, , f] of layer.b) if (want.has(id)) {
    const n = f.length >= 4 && f[0] === f[f.length - 2] && f[1] === f[f.length - 1] ? f.length - 2 : f.length;   // a closed ring repeats its first corner
    for (let k = 0; k + 1 < n; k += 2) { const ll = llOfXy(layer, f[k], f[k + 1]); if (ll) pts.push(ll); }
  }
  if (!pts.length) return null;
  const c = [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
  // where to look from: the centre, then (a community of many homes) up to four homes spread across it - Street View inside gated
  // villa communities is patchy, so the centre alone often finds nothing
  const homes = [];
  for (const [id, , f] of layer.b) if (want.has(id)) {
    let sx = 0, sy = 0, n = 0; for (let k = 0; k + 1 < f.length; k += 2) { sx += f[k]; sy += f[k + 1]; n++; }
    const ll = n ? llOfXy(layer, sx / n, sy / n) : null; if (ll) homes.push(ll);
  }
  const probes = [c];
  if (homes.length > 1) { const step = Math.max(1, Math.floor(homes.length / 4)); for (let k = 0; k < homes.length && probes.length < 5; k += step) probes.push(homes[k]); }
  return { c, pts, homes, probes, tall: !m.area && rec.um && rec.um.floors > 6 };
}
async function fetchTimed(url, ms) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms);
  try { return await fetch(url, { signal: ac.signal }); } finally { clearTimeout(t); }
}
export async function streetViewFor(env, tgt) {
  const key = env && env.GOOGLE_MAPS_KEY;
  if (!key || !tgt) return null;
  try {
    // the first panorama, from the centre then the spread homes, that is Google's own (not a public upload), 2019 or later, and within
    // SV.maxDist of the building or community; the metadata calls cost nothing
    let meta = null, pano = null;
    const until = Date.now() + 5000;   // the whole search, however many probes: a slow Google never stalls a document
    for (const p of (tgt.probes || [tgt.c])) {
      if (Date.now() > until) break;
      const mr = await fetchTimed("https://maps.googleapis.com/maps/api/streetview/metadata?location=" + p[0].toFixed(6) + "," + p[1].toFixed(6) +
        "&radius=" + SV.radius + "&source=outdoor&key=" + encodeURIComponent(key), SV.metaMs);
      if (!mr.ok) { console.log("sv meta http " + mr.status); continue; }
      const m = await mr.json();
      if (!m || m.status !== "OK" || !m.location || !m.pano_id) { console.log("sv meta " + (m && m.status) + " " + String((m && m.error_message) || "").slice(0, 120)); continue; }
      if (!/google/i.test(String(m.copyright || ""))) continue;
      if (!(parseInt(String(m.date || "").slice(0, 4), 10) >= SV.minYear)) continue;
      const at = [m.location.lat, m.location.lng];
      if (!(Math.min(...tgt.pts.map((q) => mDist(at, q))) <= SV.maxDist)) continue;
      meta = m; pano = at; break;
    }
    if (!meta) return null;
    const yr = parseInt(String(meta.date).slice(0, 4), 10);
    // aim: a building at its centre; a community at its nearest home (the centre of a large community is out of sight)
    const aimAt = tgt.homes && tgt.homes.length > 1 ? tgt.homes.reduce((b, h) => (mDist(pano, h) < mDist(pano, b) ? h : b)) : tgt.c;
    const heading = Math.round(bearing(pano, aimAt));
    const ir = await fetchTimed("https://maps.googleapis.com/maps/api/streetview?size=640x400&pano=" + encodeURIComponent(meta.pano_id) + "&heading=" + heading +
      "&fov=" + (tgt.tall ? 75 : 70) + "&pitch=" + (tgt.tall ? 10 : 3) + "&key=" + encodeURIComponent(key), SV.imgMs);
    const ct = ir.headers.get("Content-Type") || "";
    if (!ir.ok || !ct.startsWith("image/")) return null;
    const buf = await ir.arrayBuffer();
    if (buf.byteLength < 4000) return null;   // Google's grey "no imagery" tile is tiny
    const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][(parseInt(String(meta.date).slice(5, 7), 10) || 1) - 1];
    return { src: "data:" + ct + ";base64," + b64(buf), w: 640, h: 400, date: mon + " " + yr };
  } catch (e) { return null; }
}
function svFigure(pic, w, h, alt) {
  return '<div style="position:relative;width:' + r2(w) + "px;height:" + r2(h) + 'px;">' + fitImg(pic, w, h, alt) +
    '<div style="position:absolute;left:4px;bottom:4px;background:rgba(0,0,0,0.55);color:#FFF;font-size:8px;padding:1px 4px;border-radius:2px;">Street View &middot; &copy; Google &middot; ' + esc(pic.date) + "</div></div>";
}

// ------------------------------------------------------------------------------------------------ v285: the Blocks view picture
// Kendall, 1 Oct 2026, filming the Business Bay Compare 10: "you need the pictures in the .pdf" - all ten cards said "photos to follow"
// (15 brochure folders exist, mostly JVC). Where the developer's own photograph is not on file, the card (and the dossier's page-1 hero)
// shows the building's LOD 100 view instead: the same projection, palette and district layer as briefMapSvg (50 degrees from the south,
// heights to scale), cropped tight on the building - in gold, its neighbours in grey, the streets between. It is labelled "Blocks view"
// on the picture itself, so it is never taken for a photograph. Three cases, never an empty box:
//   blocks          the building's own footprint(s) on the layer (exact)
//   blocks_approx   no footprint, but a map position: an indicative dashed block at that position (a small locator map)
//   blocks_area     v289 - a register community with no building of its own (DAMAC Hills villas): the footprints the district model
//                   attributes to that community, in pale gold, "approximate area"
//   district        none of these: the district's blocks with nothing picked out, "position not yet verified"
// A district with no layer (or a building outside every layer) is "none": the plain "picture to follow" box, as before.
// v289 (Kendall, 2 Oct 2026): Naj's DAMAC Hills rent brief came out with "no pictures" - every villa and townhouse result is a "dld:"
// register community, so EVERY card was the same whole-district view with nothing picked out (and the map page "Map to follow").
export function blocksKind(rec, layer) {
  if (!layer || !Array.isArray(layer.b) || !layer.b.length) return "none";
  const m = markOf(rec, layer);
  return m.placed ? (m.area ? "blocks_area" : m.approx ? "blocks_approx" : "blocks") : "district";
}
export function blocksThumb(rec, layer, w, h, o) {
  const kind = blocksKind(rec, layer);
  if (kind === "none") return null;
  const mark = markOf(rec, layer);
  const pairs = (f) => { const r = []; for (let k = 0; k + 1 < f.length; k += 2) r.push([f[k], f[k + 1]]); return r; };
  const hiIds = new Set(kind === "blocks" || kind === "blocks_area" ? mark.ids : []);
  let tgt = layer.b.filter((b) => hiIds.has(b[0])).map(([, hh, f]) => ({ r: pairs(f), h: hh, kind: kind === "blocks_area" ? "area" : "hi" }));
  if (kind === "blocks_approx") { const [cx, cy] = mark.xy, s = mark.side / 2; tgt = [{ r: [[cx - s, cy - s], [cx + s, cy - s], [cx + s, cy + s], [cx - s, cy + s], [cx - s, cy - s]], h: mark.h, kind: "approx" }]; }
  // the frame, in the view's own units (metres across; metres up the picture after the 50-degree tilt)
  let gx0 = Infinity, gx1 = -Infinity, gy0 = Infinity, gy1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  const src = tgt.length ? tgt : layer.b.map(([, hh, f]) => ({ r: pairs(f), h: 0 }));
  for (const b of src) for (const [x, y] of b.r) {
    gx0 = Math.min(gx0, x); gx1 = Math.max(gx1, x); gy0 = Math.min(gy0, y); gy1 = Math.max(gy1, y);
    v0 = Math.min(v0, y * KY); v1 = Math.max(v1, y * KY + (b.h || 0) * KH);
  }
  const asp = h / w;
  let Wf;
  const uc = (gx0 + gx1) / 2, vc = (v0 + v1) / 2;
  if (tgt.length) {
    // v289 - a community is many small homes: frame the community itself with a margin, not three times its width
    Wf = kind === "blocks_area" ? Math.max(260, (gx1 - gx0) * 1.4, (gy1 - gy0) * 1.25) : Math.max(260, (gx1 - gx0) * 3.2, (gy1 - gy0) * 2.2);
    if ((v1 - v0) * 1.35 > Wf * asp) Wf = (v1 - v0) * 1.35 / asp;          // a tall tower: widen until its full height fits
  } else Wf = Math.max(gx1 - gx0, (v1 - v0) / asp) * 1.04;
  const Hf = Wf * asp, U0 = uc - Wf / 2, V0 = vc - Hf / 2, k = w / Wf;
  // the district view (a whole district on a card) is drawn coarse - whole pixels, roofs only, main roads only - so four of them on one
  // sheet stay a few tens of KB each instead of 450; the building views keep a tenth of a pixel and their walls
  const coarse = kind === "district", pr = coarse ? 1 : 10;
  const X = (x) => Math.round((x - U0) * k * pr) / pr, Y = (y, hh) => Math.round((h - (y * KY + (hh || 0) * KH - V0) * k) * pr) / pr;
  const path = (pts) => { const o2 = []; let last = ""; for (const [x, y, hh] of pts) { const t = X(x) + " " + Y(y, hh); if (t !== last) o2.push(t); last = t; } return o2.length < 3 ? "" : "M" + o2.join(" ") + "Z"; };
  // what can show: footprints whose picture reaches the frame (tall ones to the south can rise into it)
  const inFrame = (r, hh) => r.some(([x]) => x > U0 - 60 && x < U0 + Wf + 60) && r.some(([, y]) => y * KY + (hh || 0) * KH > V0 - 40 && y * KY < V0 + Hf + 40);
  const blds = layer.b.filter((b) => !hiIds.has(b[0])).map(([, hh, f]) => ({ r: pairs(f), h: hh, kind: "ctx" })).filter((b) => inFrame(b.r, b.h)).concat(tgt);
  const out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + r2(w) + " " + r2(h) + '" width="' + r2(w) + '" height="' + r2(h) + '" style="display:block;">',
    // v289 - the coarse district view's roofs in the wall grey with a darker edge: in roof grey on the page's off-white they all but vanished
    "<style>.bvw{fill:" + MAPC.CTX_WALL + ";stroke:" + MAPC.CTX_EDGE + ";stroke-width:0.4;stroke-linejoin:round}.bvr{fill:" + (coarse ? MAPC.CTX_WALL : MAPC.CTX_ROOF) + ";stroke:" + (coarse ? "#A9ABA3" : MAPC.CTX_EDGE) + ";stroke-width:" + (coarse ? 0.35 : 0.4) + ";stroke-linejoin:round}.bvg{fill-opacity:0.32;stroke-opacity:0.6}</style>",
    '<rect width="' + r2(w) + '" height="' + r2(h) + '" fill="' + MAPC.BG + '"/>'];
  const lw = Math.max(0.6, Math.min(3, k * 4));
  const streets = (layer.s || []).map(([c, f]) => ({ c, r: pairs(f) })).filter((s) => (!coarse || s.c >= 6) && inFrame(s.r, 0));
  for (const pass of [0, 1]) {
    const d = streets.map((s) => { const o2 = []; let last = ""; for (const [x, y] of s.r) { const t = X(x) + " " + Y(y, 0); if (t !== last) o2.push(t); last = t; } return o2.length > 1 ? "M" + o2.join(" ") : ""; }).join("");
    if (d) out.push('<path d="' + d + '" fill="none" stroke="' + (pass ? MAPC.STREET : MAPC.CASE) + '" stroke-width="' + r2(lw * (pass ? 1 : 1.6)) + '" stroke-linecap="round" stroke-linejoin="round"/>');
  }
  const area = (r) => { let s = 0; for (let q = 0; q + 1 < r.length; q++) s += r[q][0] * r[q + 1][1] - r[q + 1][0] * r[q][1]; return s / 2; };
  blds.sort((a, b) => Math.min(...b.r.map((p) => p[1])) - Math.min(...a.r.map((p) => p[1])));   // painter's order: far (north) first
  if (coarse) {
    const d = blds.map((b) => path(b.r.map(([x, y]) => [x, y, b.h]))).join("");
    if (d) out.push('<path class="bvr" d="' + d + '"/>');
  } else {
  // a neighbour standing in front of the building (south of it, and over it in the picture) is drawn see-through, so the gold block
  // is never hidden behind a taller tower in front
  const sb = (bb) => { let a = Infinity, c = -Infinity, e = Infinity, g = -Infinity; for (const [x, y] of bb.r) { a = Math.min(a, X(x)); c = Math.max(c, X(x)); e = Math.min(e, Y(y, bb.h)); g = Math.max(g, Y(y, 0)); } return [a, c, e, g]; };
  const T = tgt.map(sb), tSouth = Math.min(...tgt.map((t) => Math.min(...t.r.map((p) => p[1]))));
  const ghost = (bb) => { if (bb.kind !== "ctx" || !T.length || Math.min(...bb.r.map((p) => p[1])) >= tSouth) return false; const [a, c, e, g] = sb(bb); return T.some(([ta, tc, te, tg]) => a < tc && c > ta && e < tg && g > te); };
  for (const b of blds) {
    let r = b.r; if (area(r) < 0) r = r.slice().reverse();
    const ctx = b.kind === "ctx", gh = ghost(b) ? " bvg" : "";
    const [roof, wall, edge, sw] = b.kind === "hi" || b.kind === "area" ? [MAPC.GOLD, MAPC.GOLD_WALL, MAPC.GOLD_EDGE, b.kind === "area" ? 0.5 : 0.9] : ["#E6D6B2", "#CDB684", MAPC.GOLD_EDGE, 0.9];
    const dash = b.kind === "approx" ? ' stroke-dasharray="4 2.5"' : "";
    const paint = (c, fill) => ctx ? ' class="' + c + gh + '"' : ' class="' + (b.kind === "hi" ? "hiblock" : b.kind === "area" ? "areablock" : "approxblock") + '" fill="' + fill + '" stroke="' + edge + '" stroke-width="' + sw + '" stroke-linejoin="round"' + dash;
    const walls = [];
    for (let q = 0; q + 1 < r.length; q++) { const [x0, y0] = r[q], [x1, y1] = r[q + 1]; if (x1 - x0 > 0) walls.push([(y0 + y1) / 2, [[x0, y0, 0], [x1, y1, 0], [x1, y1, b.h], [x0, y0, b.h]]]); }
    walls.sort((a, c) => c[0] - a[0]);
    const wd = walls.map((x) => path(x[1])).join("");
    if (wd) out.push("<path" + paint("bvw", wall) + ' d="' + wd + '"/>');
    const rd = path(r.map(([x, y]) => [x, y, b.h]));
    if (rd) out.push("<path" + paint("bvr", roof) + ' d="' + rd + '"/>');
  }
  }
  out.push("</svg>");
  const say = kind === "blocks" ? "Digital footprint view" : kind === "blocks_approx" ? "Digital footprint view &middot; approximate position"
    : kind === "blocks_area" ? "Digital footprint view &middot; the community&rsquo;s homes, approximate area" : "Digital footprint view &middot; " + esc((o && o.district) || rec.dist || "") + "";
  return { kind, html: '<div class="blocksview" data-kind="' + kind + '" style="width:' + r2(w) + "px;height:" + r2(h) + 'px;overflow:hidden;position:relative;">' + out.join("") +
    '<div style="position:absolute;right:4px;bottom:3px;font-size:' + ((o && o.fs) || 7.5) + "px;line-height:1.2;color:#5E5B52;background:rgba(255,255,255,0.82);padding:1px 4px;letter-spacing:.2px;\">" + say + "</div></div>" };
}

export function briefMapSvg(layer, marks, o) {
  const pairs = (f) => { const r = []; for (let k = 0; k + 1 < f.length; k += 2) r.push([f[k], f[k + 1]]); return r; };
  const hiById = new Map();
  for (const m of marks) if (m.placed && m.ids) for (const i of m.ids) hiById.set(i, m);
  const blds = layer.b.map(([i, h, f]) => ({ r: pairs(f), h, kind: hiById.has(i) ? (hiById.get(i).area ? "area" : "hi") : "ctx", m: hiById.get(i) || null }));   // v289 - "area": a register community's homes
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
  // A point that rounds onto the one before it draws nothing (round joins), so it is dropped; after M the pairs are implicit line-tos.
  // Same picture, fewer bytes: a pack carries eleven of these maps through the renderer.
  const path = (pts, close) => {
    const o = []; let last = "";
    for (const p of pts) { const [a, b] = S(p), t = Math.round(a) + " " + Math.round(b); if (t !== last) o.push(t); last = t; }
    return "M" + o.join(" ") + (close ? "Z" : "");
  };
  const inBox = (x, y) => X0 < x && x < X1 && Y0 < y && y < Y1;
  const out = [];
  out.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 1000" width="1500" height="1000" font-family="DejaVu Sans, Arial, sans-serif">');
  out.push('<rect width="1500" height="1000" fill="' + MAPC.BG + '"/>');
  // the other buildings' walls and roofs (thousands of paths) share their paint through two classes instead of repeating it on each
  out.push("<style>.bmw{fill:" + MAPC.CTX_WALL + ";stroke:" + MAPC.CTX_EDGE + ";stroke-width:" + f1(0.25 * PT) + ";stroke-linejoin:round}.bmr{fill:" + MAPC.CTX_ROOF + ";stroke:" + MAPC.CTX_EDGE + ";stroke-width:" + f1(0.25 * PT) + ";stroke-linejoin:round}</style>");
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
    const [roof, wall, edge, lw] = b.kind === "ctx" ? [MAPC.CTX_ROOF, MAPC.CTX_WALL, MAPC.CTX_EDGE, 0.25] : b.kind === "hi" || b.kind === "area" ? [MAPC.GOLD, MAPC.GOLD_WALL, MAPC.GOLD_EDGE, 0.5] : ["#E6D6B2", "#CDB684", MAPC.GOLD_EDGE, 0.6];
    const dash = b.kind === "approx" ? ' stroke-dasharray="4 2.5"' : "";
    const walls = [];
    for (let k = 0; k + 1 < r.length; k++) { const [x0, y0] = r[k], [x1, y1] = r[k + 1]; if (x1 - x0 > 0) walls.push([(y0 + y1) / 2, [P(x0, y0), P(x1, y1), P(x1, y1, b.h), P(x0, y0, b.h)]]); }
    walls.sort((a, c) => c[0] - a[0]);
    const cls = b.kind === "ctx" ? "" : ' class="' + (b.kind === "hi" ? "hiblock" : b.kind === "area" ? "areablock" : "approxblock") + '"';
    if (b.kind === "ctx") {
      if (walls.length) out.push('<path class="bmw" d="' + walls.map((w) => path(w[1], true)).join("") + '"/>');
      out.push('<path class="bmr" d="' + path(r.map(([x, y]) => P(x, y, b.h)), true) + '"/>');
      continue;
    }
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
      (m.approx || m.area ? '<circle cx="' + f1(c[0]) + '" cy="' + f1(c[1]) + '" r="' + f1(rr) + '" fill="#FFFFFF" stroke="' + MAPC.TEAL + '" stroke-width="' + f1(1.6 * PT) + '" stroke-dasharray="3 2"/>'
        : '<circle cx="' + f1(c[0]) + '" cy="' + f1(c[1]) + '" r="' + f1(rr) + '" fill="' + MAPC.TEAL + '" stroke="' + MAPC.GOLD + '" stroke-width="' + f1(1.8 * PT) + '"/>') +
      '<text x="' + f1(c[0]) + '" y="' + f1(c[1]) + '" font-size="' + f1(Math.min(11 * PT, rr * 1.2)) + '" font-weight="bold" fill="' + (m.approx || m.area ? MAPC.TEAL : "#FFFFFF") + '" text-anchor="middle" dominant-baseline="central">' + n + "</text></g>");
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
    : none ? dShort + " · every building as a simple model"
    : dShort + " · " + (B ? (B.all ? "rentals" : B.word + " rentals") : "the chosen buildings") + (o.q && o.q.max ? " around AED " + money(o.q.max) : "");
  const cnt = marks.length <= 10 ? NUMWORD[marks.length].toLowerCase() : String(marks.length);
  out.push('<text x="45" y="55" font-size="' + f1(22 * PT) + '" font-weight="bold" fill="' + MAPC.TEAL + '">' + esc(title) + "</text>");
  out.push('<text x="45" y="90" font-size="' + f1(10.5 * PT) + '" fill="#5E5B52">' + esc((o.district || "") + ", Dubai  ·  " + (single ? "the building on its own plot as a simple massing model, among its neighbours" : none ? "every building outline raised to its height" : cnt + " rental options, each dropped on its own plot as a simple massing model")) + "</text>");
  out.push('<rect x="1099.5" y="130" width="382.5" height="820" fill="#FFFFFF" stroke="#E2DED3" stroke-width="1.1"/>');
  out.push('<text x="1117.5" y="165" font-size="' + f1(14 * PT) + '" font-weight="bold" fill="' + MAPC.TEAL + '">' + (single ? "This building" : none ? "This district" : "Rental options") + "</text>");
  out.push('<text x="1117.5" y="188" font-size="' + f1(8.6 * PT) + '" fill="#5E5B52">' + esc(single ? "Numbered " + first.n + ", as on the one-sheet" : none ? "No building chosen" : "1–" + marks.length + " = rental options" + (B && !B.all ? ", " + B.short.replace(/s$/, "") + (o.q && o.q.max ? " around AED " + money(o.q.max) : "") : "")) + "</text>");
  let yy = 235;
  for (const m of marks) {
    const ap = m.approx || m.area, cx = 1135.5, cy = yy - 4;   // v289 - a community: dashed, "approximate area"
    out.push(ap ? '<circle cx="' + cx + '" cy="' + cy + '" r="11" fill="#FFFFFF" stroke="' + MAPC.TEAL + '" stroke-width="1.9" stroke-dasharray="3 2"/>' : '<circle cx="' + cx + '" cy="' + cy + '" r="11" fill="' + MAPC.TEAL + '" stroke="' + MAPC.GOLD + '" stroke-width="1.9"/>');
    out.push('<text x="' + cx + '" y="' + cy + '" font-size="' + f1(9 * PT) + '" font-weight="bold" fill="' + (ap ? MAPC.TEAL : "#FFFFFF") + '" text-anchor="middle" dominant-baseline="central">' + m.n + "</text>");
    const nm = m.name.length > 34 ? m.name.slice(0, 33) + "…" : m.name;
    out.push('<text x="1165.5" y="' + yy + '" font-size="' + f1(9.6 * PT) + '" fill="#2B2A26">' + esc(nm + (m.area ? "  (approximate area)" : ap ? "  (approximate position)" : m.placed ? "" : "  (no map position yet)")) + "</text>");
    yy += 52;
  }
  const key = (y, fc, ec, dash, label) => '<rect x="1117.5" y="' + (y - 16) + '" width="33" height="16" fill="' + fc + '" stroke="' + ec + '" stroke-width="1.2"' + (dash ? ' stroke-dasharray="3 2"' : "") + '/><text x="1165.5" y="' + (y - 4) + '" font-size="' + f1(8.3 * PT) + '" fill="#2B2A26">' + label + "</text>";
  out.push('<text x="1117.5" y="755" font-size="' + f1(10.5 * PT) + '" font-weight="bold" fill="' + MAPC.TEAL + '">Key</text>');
  out.push(key(785, MAPC.GOLD, MAPC.GOLD_EDGE, false, single ? "This building, on its plot" : "Rental option, building on its plot"));
  if (marks.some((m) => m.approx)) out.push(key(815, "#E6D6B2", MAPC.GOLD_EDGE, true, "Approximate position, indicative model"));
  else if (marks.some((m) => m.area)) out.push(key(815, MAPC.GOLD, MAPC.GOLD_EDGE, true, "A community&#8217;s homes, approximate area"));
  out.push(key(845, MAPC.CTX_ROOF, MAPC.CTX_EDGE, false, "Other " + esc(dShort) + " buildings"));
  out.push('<line x1="1117.5" y1="867" x2="1150.5" y2="867" stroke="' + MAPC.CASE + '" stroke-width="4"/><line x1="1117.5" y1="867" x2="1150.5" y2="867" stroke="#FFFFFF" stroke-width="2.2"/>' +
    '<text x="1165.5" y="871" font-size="' + f1(8.3 * PT) + '" fill="#2B2A26">Streets</text>');
  ["Simple massing (LOD 100): each building outline raised to its", "height with a flat roof; heights to scale. View from", "the south, looking north."].forEach((t, k) =>
    out.push('<text x="1117.5" y="' + (897 + 14 * k) + '" font-size="' + f1(7.2 * PT) + '" fill="#8C887C">' + t + "</text>"));
  out.push('<text x="45" y="988" font-size="' + f1(6.5 * PT) + '" fill="#8C887C">Building outlines and streets: &#169; OpenStreetMap contributors (district model). Positions: the app\'s district model' +
    (marks.some((m) => m.approx) ? "; dashed models are approximate, from a public map listing" : "") +
    (marks.some((m) => m.area) ? "; a dashed number marks a community: the homes the district digital footprint places in that Land Department sub-community, approximate" : "") + ".</text>");
  out.push("</svg>");
  return out.join("");
}

// ------------------------------------------------------------------------------------------------ v306: THE BUY DOCUMENTS (mode=buy)
// Kendall, 4 Oct 2026: the realtor's flow is developers -> locations -> price -> a client PDF, BUYING first. Until v306 every buy document was
// a 501 and the journey stopped. These are the SAME layouts as the rent documents (the same CSS, pages, header, footer and maps), with the
// evidence of a purchase in place of a rent:
//   - price per sq ft = the building's typical price for that bedroom type divided by its typical size (the Developers map's own rule:
//     devmap_core.js), the price and the size being the register medians on the unit-mix card; the count is the sales recorded for that
//     type (dld_sales.sold_by_type) - the SAME numbers /brief_api reads in buy mode (buyCandidates), and a type with fewer than 3 sales is
//     never shown. A building has no middle half of its own (the cards carry medians, not single sales), so the middle half printed is
//     the one ACROSS the developer's buildings in the community (sale-weighted, devmap_core.js wquant) and it says so.
//   - never an asking price and never an estimate: a row with only est_aed has no median_aed and is not a sale.
//   - the budget is a TOTAL PRICE; its minimum is a hard floor (verdictOf, v302): an option under it is not in the document at all.
//   - NO availability claim of any kind: no developer-sheet box, no "left", no "for sale now" (nothing records vacancy).
//   - the developer is named as src/devcross.js names it (canonicalOf -> displayOf).
// The tier floors are TIER_CFG.bounds of src/devmap_core.js (AED per sq m); test/test_v306_buy_pdf.mjs reads them from that file so the two
// cannot drift. The Dubai-wide buyer share comes from the published Developers index (img_devmap_index cuts.shares) where it is on file,
// and the line is left out where it is not.
export const TIER_BOUNDS = [32292, 22604, 16684];
const TIER_NAME = ["Ultra-luxury", "Luxury", "Premium", "Budget"];
export const tierOfPpsm = (p) => (p >= TIER_BOUNDS[0] ? 0 : p >= TIER_BOUNDS[1] ? 1 : p >= TIER_BOUNDS[2] ? 2 : 3);
const edgeSqft = (i) => Math.round(TIER_BOUNDS[i] / SQFT);
export const tierBandSqft = (t) => (t === 0 ? "AED " + money(edgeSqft(0)) + " per sq ft and above" : t === 1 ? "AED " + money(edgeSqft(1)) + " to " + money(edgeSqft(0)) + " per sq ft" :
  t === 2 ? "AED " + money(edgeSqft(2)) + " to " + money(edgeSqft(1)) + " per sq ft" : "under AED " + money(edgeSqft(2)) + " per sq ft");
const FIT_SAY = { within: "Within the budget", stretch: "In the stretch", a_little_above: "A little over the budget", above: "Over the budget" };
const FIT_COL = { within: ["#2F6B55", "#E6F1EC"], stretch: ["#8A6A1F", "#F6EEDC"], a_little_above: ["#8A6A1F", "#F6EEDC"], above: ["#9A3B3B", "#F6E6E6"] };
const VERDICT_RANK = { within: 0, stretch: 1, a_little_above: 2, above: 3 };
const NWORD = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const typeLabel = (t) => String(t || "").toLowerCase();
const homeLabels = (card) => (card.rows || []).map((r) => typeLabel(r.type)).filter((l) => l === "studio" || /^\d+ bedroom$/.test(l));
const labelsFor = (card, b) => (b === "all" ? homeLabels(card) : b === "studio" ? ["studio"] : b === "3" ? homeLabels(card).filter((l) => +l.split(" ")[0] >= 3) : [b + " bedroom"]);
const labelWord = (l) => (l === "studio" ? "studio" : (NWORD[+l.split(" ")[0]] || l.split(" ")[0]) + "-bedroom");
const labelBed = (l) => (l === "studio" ? "studio" : +l.split(" ")[0] >= 3 ? "3" : l.split(" ")[0]);
const labelShort = (l) => (l === "studio" ? "Studio" : l.split(" ")[0] + "-bed");
const monthYear = (d) => { const s = String(d || ""); return /^\d{4}-\d{2}/.test(s) ? ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][+s.slice(5, 7) - 1] + " " + s.slice(0, 4) : ""; };

// one building, one type: the settled-sales figure, or null (no median price or size on the card, no count, or fewer than 3 sales)
export function buyFig(card, label) {
  if (!card) return null;
  const sold = (card.dld_sales && card.dld_sales.sold_by_type) || {};
  let n = null; for (const k of Object.keys(sold)) if (k.toLowerCase() === label) n = sold[k];
  const row = (card.rows || []).find((r) => typeLabel(r.type) === label);
  if (!row || !row.median_aed || !(row.median_sqm > 0) || n == null || n < EVIDENCE_MIN) return null;   // an estimate (est_aed) is never a sale price
  const ppsm = row.median_aed / row.median_sqm;
  return { label, n, aed: Math.round(row.median_aed), sqm: row.median_sqm, sqft: Math.round(row.median_sqm * SQFT), ppsm, ppsf: ppsm / SQFT, psf: Math.round(ppsm / SQFT), tier: tierOfPpsm(ppsm), homes: row.units || null };
}
// the building's figures for a query: every asked type that has evidence AND a verdict (the minimum is a hard floor: under it, nothing)
export function buyOf(card, q) {
  if (!card) return null;
  const seen = new Set(), figs = [];
  for (const b of (q.bedsList || [q.beds])) for (const l of labelsFor(card, b)) {
    if (seen.has(l)) continue; seen.add(l);
    const f = buyFig(card, l); if (!f) continue;
    f.verdict = verdictOf(f.aed, q.min || 0, q.max || null, q.stretch || null); if (!f.verdict) continue;
    figs.push(f);
  }
  if (!figs.length) return null;
  figs.sort((a, b) => (VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict]) || (b.n - a.n));
  const ds = card.dld_sales || {};
  return { figs, best: figs[0], first: ds.first || null, last: ds.last || null };
}
// the developer, as src/devcross.js names it: the card's developer, else the Buy map's, else (a curated brand only) the project's own name
function devOf(card, mpDev) {
  const raw = (card && card.developer) || mpDev || "";
  if (raw) { const id = canonicalOf(raw); return { id, name: displayOf(id) || pretty(raw) }; }
  const nm = card && (card.name || (card.dld && card.dld.project));
  if (nm) { const r = devResolve(nm, "project"); if (isCurated(r.id)) return { id: r.id, name: displayOf(r.id) }; }
  return { id: "", name: "" };
}
export function wquant(pairs, p) {
  const a = pairs.filter((x) => x[0] != null && x[1] > 0 && isFinite(x[0])).sort((x, y) => x[0] - y[0]);
  if (!a.length) return null;
  const t = a.reduce((s, x) => s + x[1], 0) * p; let c = 0;
  for (const x of a) { c += x[1]; if (c >= t) return x[0]; }
  return a[a.length - 1][0];
}
// the middle half ACROSS buildings: the developer's buildings in this community that sold this type (3+ sales each), sale-weighted; where the
// developer has fewer than two such buildings, every building of the community. Never presented as the middle half of single sales.
export function buyContext(D, rec) {
  const cards = D && D.unitmix && D.unitmix.buildings_by_id; if (!cards || !rec.buy) return null;
  const label = rec.buy.best.label;
  const gather = (id) => { const pairs = []; let n = 0, nb = 0;
    for (const c of Object.values(cards)) { if (!c || (id && devOf(c).id !== id)) continue; const f = buyFig(c, label); if (!f) continue; pairs.push([f.ppsf, f.n]); n += f.n; nb++; }
    return { pairs, n, nb }; };
  let g = rec.devId ? gather(rec.devId) : null, scope = rec.devName;
  if (!g || g.nb < 2) { g = gather(""); scope = ""; }
  if (g.nb < 2 || g.n < EVIDENCE_MIN) return null;
  return { q1: Math.round(wquant(g.pairs, 0.25)), med: Math.round(wquant(g.pairs, 0.5)), q3: Math.round(wquant(g.pairs, 0.75)), n: g.n, nb: g.nb, scope };
}

function buyBudgetLine(rec, q) {
  const f = rec.buy.best;
  const range = q.min && q.max ? "AED " + money(q.min) + " to " + money(q.max) : q.max ? "up to AED " + money(q.max) : "from AED " + money(q.min);
  const say = { within: "inside the budget", stretch: "above the budget but inside the stretch of AED " + money(q.stretch), a_little_above: "a little over the budget", above: "over the budget" }[f.verdict];
  return "A budget of " + range + ": the typical " + labelWord(f.label) + " home here sold for AED " + money(f.aed) + " (about " + money(f.sqft) + " sq ft), " + say + ".";
}
const fitChip = (v, sz) => { const [c, bg] = FIT_COL[v] || FIT_COL.within; return '<span class="fit" style="display:inline-block;background:' + bg + ';color:' + c + ';font-size:' + (sz || 10.5) + 'px;font-weight:600;padding:1px 7px;border-radius:9px;white-space:nowrap;">' + FIT_SAY[v] + "</span>"; };
const budgetAsked = (q) => !!(q.min || q.max);

// page 1: the price box, the tier and the community's middle half, and (when a budget was given) whether it fits
function buyBox(C, rec, q) {
  const b = rec.buy, f = b.best;
  const stat = (v, l) => '<div style="display:flex;flex-direction:column;gap:3px;"><div class="lbl" style="font-size:9.5px;">' + l + '</div><div style="font-size:15px;font-weight:500;color:' + NAVY + ';white-space:nowrap;">' + v + "</div></div>";
  const box = '<div style="display:grid;grid-template-columns:1.3fr 1.2fr 0.8fr 0.9fr;gap:12px;align-items:end;border:1px solid #E6E1D8;background:#FFFFFF;padding:11px 14px;">' +
    '<div style="display:flex;flex-direction:column;gap:3px;"><div class="lbl" style="font-size:9.5px;">TYPICAL ' + (f.label === "studio" ? "STUDIO" : f.label.split(" ")[0] + "-BED") + ' SALE PRICE</div><div class="serif" style="font-size:29px;color:' + GOLD + ';line-height:1;white-space:nowrap;">AED ' + money(f.aed) + "</div></div>" +
    stat("AED " + money(f.psf) + " per sq ft", "PRICE PER SQ FT") + stat(String(f.n), "SALES RECORDED") + stat(money(f.sqft) + " sq ft", "TYPICAL SIZE") + "</div>";
  const sh = C.dmIdx && C.dmIdx.cuts && C.dmIdx.cuts.shares;
  const share = sh && sh.n && sh.money && sh.n[f.tier] != null && sh.money[f.tier] != null ? " Dubai-wide, " + sh.n[f.tier] + "% of buyers and " + sh.money[f.tier] + "% of the money buy in this tier." : "";
  const ctx = buyContext(C.district[rec.d], rec);
  const tierCell = '<div style="display:flex;flex-direction:column;gap:3px;"><div class="lbl" style="font-size:9.5px;">PRICE TIER</div><div style="font-size:12px;color:' + INK + ';line-height:1.4;"><b style="color:' + NAVY + ';">' + TIER_NAME[f.tier] + "</b> &middot; " + tierBandSqft(f.tier) + "." + share + "</div></div>";
  const ctxCell = ctx ? '<div style="display:flex;flex-direction:column;gap:3px;"><div class="lbl" style="font-size:9.5px;">ACROSS ' + (ctx.scope ? esc(ctx.scope).toUpperCase() + "&rsquo;S " : "THE ") + ctx.nb + " BUILDINGS IN " + esc(rec.dist).toUpperCase() + '</div><div style="font-size:12px;color:' + INK + ';line-height:1.4;">Middle half of ' + labelWord(f.label) + " prices per sq ft: <b style=\"color:" + NAVY + ';">AED ' + money(ctx.q1) + " &ndash; " + money(ctx.q3) + "</b> (" + money(ctx.n) + " sales recorded).</div></div>" : "";
  const strip = '<div style="display:grid;grid-template-columns:' + (ctxCell ? "1fr 1fr" : "1fr") + ';gap:12px;border:1px solid #E6E1D8;background:#FFFFFF;padding:9px 14px;">' + tierCell + ctxCell + "</div>";
  const fit = budgetAsked(q) ? '<div style="font-size:12px;color:' + INK + ';line-height:1.45;">' + fitChip(f.verdict, 11) + " <b>What the budget buys here.</b> " + esc(buyBudgetLine(rec, q)) + "</div>" : "";
  return box + strip + fit;
}

// page 3: the sales by type (with the fit when a budget was given), then the flat-by-flat layouts where the register lists them
function buySalesTable(rec, q) {
  const bedN = (l) => (l === "studio" ? 0 : +l.split(" ")[0]);
  const figs = rec.buy.figs.slice().sort((a, b) => bedN(a.label) - bedN(b.label));
  const fit = budgetAsked(q);
  const head = [["left", "TYPE"], ["right", "TYPICAL PRICE, AED"], ["right", "PER SQ FT, AED"], ["right", "SALES RECORDED"], ["right", "TYPICAL SIZE"]].concat(fit ? [["left", "THE BUDGET"]] : []);
  const rows = figs.map((f) => [esc(typeOfC(f.label === "studio" ? "studio" : f.label.split(" ")[0])), money(f.aed), money(f.psf), String(f.n), money(f.sqft) + " sq ft"].concat(fit ? [fitChip(f.verdict, 9.5)] : []));
  const span = rec.buy.first && rec.buy.last ? " Sales recorded " + monthYear(rec.buy.first) + " to " + monthYear(rec.buy.last) + "." : "";
  return '<div style="display:flex;flex-direction:column;gap:6px;"><div class="serif" style="font-size:20px;color:' + NAVY + ';">What homes here sold for</div>' +
    '<div style="font-size:11.5px;color:' + MUTED + ';line-height:1.42;">Sales recorded at the Land Department for ' + esc(rec.name) + ', by home type: the typical price, the typical size and the price per sq ft (the typical price divided by the typical size). Sizes include the balcony.' + span + "</div>" + tbl(head, rows) + "</div>";
}
// v307 - page 2 carries the map and the sales table; a third page exists only when there are photographs or flat-by-flat layouts to put on it
function buyPages(C, rec, q, sub) {
  const B = BEDS[q.beds], G = rec.un && rec.un.floors ? groupLayouts(rec, B) : null;
  const hd = q.hide || [], needP3 = ((rec.photos && rec.photos.length) && !hd.includes("photos")) || ((G && G.top.length) && !hd.includes("layouts"));
  return needP3 ? buyPage3(C, rec, q, sub) : "";
}
function buyPage3(C, rec, q, sub) {
  const ph = rec.photos || [];
  const k = Math.min(4, ph.length), colW = (702 - 8 * (k - 1)) / Math.max(1, k);
  const photos = ph.length ? '<div style="display:grid;grid-template-columns:repeat(' + k + ',minmax(0,1fr));gap:8px;">' + ph.map((p) =>
    '<div style="display:flex;flex-direction:column;gap:2px;">' + fitImg(p.pic || { src: p.src }, colW, 112, p.caption) +
    '<div style="font-size:9.5px;color:' + MUTED + ';">' + esc(String(p.caption || "").split(" (")[0].split(" - ").pop()) + "</div>" +
    '<div style="font-size:8px;color:#8C887C;">' + "The developer&rsquo;s page" + "</div></div>").join("") + "</div>" : "";
  const B = BEDS[q.beds];
  const G = rec.un && rec.un.floors ? groupLayouts(rec, B) : null;
  const lay = G && G.top.length ? layoutsBlock(rec, q) : "";
  return page(C, sub, '<div class="serif" style="font-size:24px;color:' + NAVY + ';">' + esc(rec.name) + "</div>" + ((q.hide || []).includes("photos") ? "" : photos) + ((q.hide || []).includes("layouts") ? "" : lay),
    smallPrint([buySource(C, q, rec), buildingSource(rec), rec.un ? "Layouts: Dubai Land Department units register, flat by flat." : "", nearbySource(), pictureSource(rec)]));
}
function buySource(C, q, rec) {
  const f = rec ? rec.buy.best : null;
  return "Prices: Dubai Land Department registered sales (the transactions register)" + (rec && rec.buy.first && rec.buy.last ? ", " + esc(monthYear(rec.buy.first)) + " to " + esc(monthYear(rec.buy.last)) : "") + (rec ? ", " + esc(rec.name) : "") +
    ". Sales recorded at the Land Department, not asking prices: what homes here sold for, not what is for sale. The typical price is the median of the building's sales of that home type (three or more are needed to show one); the typical size is the median size; " +
    "the price per sq ft is the typical price divided by the typical size. The middle half is across the developer's buildings in the community, sale-weighted, not a spread of single sales." +
    (f ? " Price tiers are price bands per sq ft only (Budget under AED " + money(edgeSqft(2)) + ", Premium AED " + money(edgeSqft(2)) + " to " + money(edgeSqft(1)) + ", Luxury AED " + money(edgeSqft(1)) + " to " + money(edgeSqft(0)) + ", Ultra-luxury " + money(edgeSqft(0)) + " and above), not a rating." : "") +
    (rec && rec.devName ? " Developer: " + esc(rec.devName) + ", as the Land Department register names it." : "");
}

// ---- the one-sheet ----
function titleBuy(C, q) {
  const B = BEDS[q.beds], n = C.recs.length;
  const ds = [...new Set(C.recs.map((r) => r.dist))];
  const where = ds.length === 1 ? ds[0] : ds.length === 2 ? ds.join(" and ") : ds.length + " districts";
  const count = n <= 10 ? NUMWORD[n] : String(n);
  const budget = q.min && q.max && q.min < q.max ? ", AED " + money(q.min) + "&ndash;" + money(q.max) : q.max ? ", up to AED " + money(q.max) : q.min ? ", from AED " + money(q.min) : "";
  return count + " " + (B.all ? "" : bedsWordOf(q) + " ") + "option" + (n === 1 ? "" : "s") + " to buy in " + esc(where) + budget;
}
function buyOneSheetCards(C, q) {
  const cols0 = Math.min(5, Math.max(3, C.recs.length)), cardW = (1063 - 9 * (cols0 - 1)) / cols0 - 2;
  const cards = C.recs.map((rec) => {
    const f = rec.buy.best;
    const mp = rec.pos || rec.cpos, mFrom = rec.pos ? "" : " (from the community's centre)";
    const metro = mp ? (() => { const m = nearestMetro(C, mp); return m && kmTxt(m.d, rec.exact) ? esc(m.n) + " metro, " + kmTxt(m.d, rec.exact) + mFrom : (m ? "" : amenMetro(rec) || ""); })() : amenMetro(rec) || "";
    const amen = ((rec.br && rec.br.amenities) || []).slice(0, 3).map((a) => esc(a.split(" (")[0])).join(", ") || amenLine(rec) || "";
    return '<div class="bcard" style="border:1px solid #E6E1D8;background:#FFF;display:flex;flex-direction:column;overflow:hidden;min-height:0;">' +
      '<div style="position:relative;">' + thumb(rec, cardW, 136, C) + '<div style="position:absolute;left:6px;top:6px;width:24px;height:24px;border-radius:12px;background:' + NAVY +
      ';color:#FFF;font-weight:600;font-size:13px;display:flex;align-items:center;justify-content:center;">' + rec.n + "</div></div>" +
      '<div style="padding:7px 9px 8px 9px;display:flex;flex-direction:column;gap:3px;">' +
      '<div class="serif" style="font-size:16px;color:' + NAVY + ';line-height:1.05;">' + esc(rec.name) + "</div>" +
      (rec.devName ? '<div style="font-size:9.5px;color:' + MUTED + ';">' + esc(rec.devName) + "</div>" : "") +
      '<div style="display:flex;align-items:baseline;gap:6px;"><span class="serif" style="font-size:20px;color:' + GOLD + ';">AED ' + money(f.aed) + '</span><span style="font-size:9.5px;color:' + MUTED + ';">typical ' + labelShort(f.label).toLowerCase() + " price</span></div>" +
      '<div style="font-size:10px;color:' + INK + ';">AED ' + money(f.psf) + " per sq ft &middot; " + f.n + " sales recorded</div>" +
      '<div style="font-size:10px;color:' + INK + ';">about ' + money(f.sqft) + " sq ft &middot; " + TIER_NAME[f.tier] + " tier</div>" +
      (budgetAsked(q) ? "<div>" + fitChip(f.verdict, 9.5) + "</div>" : "") +
      '<div style="font-size:9.8px;color:' + MUTED + ';line-height:1.25;">' + amen + "</div>" +
      '<div style="font-size:9.8px;color:' + NAVY + ';line-height:1.25;">' + metro + "</div>" + criteriaLine(rec, q) +
      "</div></div>";
  }).join("");
  const cols = Math.min(5, Math.max(3, C.recs.length));
  return { html: '<div style="flex:1;display:grid;grid-template-columns:repeat(' + cols + ',minmax(0,1fr));grid-template-rows:repeat(' + Math.ceil(C.recs.length / cols) + ',minmax(0,1fr));min-height:0;gap:9px;padding:10px 30px 6px 30px;">' + cards + "</div>" };
}
function buyOneSheetHtml(C, q) {
  const { html } = buyOneSheetCards(C, q);
  const p1 = landPage(C, '<div style="height:74px;display:flex;align-items:center;justify-content:space-between;padding:0 30px;background:#FFF;border-bottom:1px solid #E6E1D8;flex-shrink:0;">' +
    '<div style="display:flex;flex-direction:column;gap:3px;"><div class="serif" style="font-size:26px;color:' + NAVY + ';line-height:1;">' + titleBuy(C, q) + "</div>" +
    '<div style="font-size:11px;color:' + MUTED + ';">' + C.today + " &middot; numbers match the map &middot; prices are sales recorded at the Land Department, not asking prices</div></div>" + logo(C, 68) + "</div>" +
    html +
    '<div style="padding:0 30px 4px 30px;font-size:8.3px;color:' + MUTED + ';line-height:1.3;">Prices: Dubai Land Department registered sales. The typical price is the median of the building\'s sales of that home type (three or more are needed to show one); the price per sq ft is the typical price divided by the typical size. ' +
    "Price tiers are price bands per sq ft, not a rating. Metro distances are straight lines. Pictures: each developer's own project page" + (C.recs.some((r) => r.picSource && r.picSource !== "photo" && r.picSource !== "none" && r.picSource !== "street_view" && r.picSource !== "render") ? "; where none is on file, a digital footprint view: the building as a simple model on the district digital footprint (&copy; OpenStreetMap contributors), heights to scale - not a photograph." : ".") +
    (C.recs.some((r) => r.picSource === "street_view") ? " Street View: Google, aimed at the building, the month shown on the picture." : "") +
    (C.recs.some((r) => r.picSource === "render") ? " An illustration is Najma's own render, not a photograph." : "") +
    " Availability, the price and the actual home must be confirmed with the developer's sales team or the listing broker.</div>" + landFooter());
  return p1 + overviewMapPages(C, q);
}
// the areas side by side, built from the chosen options themselves (the rent comparison reads the rent index; a purchase has none)
export function buyComparisonPage(C, q) {
  const byD = {}; for (const r of C.recs) (byD[r.d || "_"] = byD[r.d || "_"] || []).push(r);
  const ds = Object.keys(byD); if (ds.length < 2) return "";
  const rng = (xs, f) => { const a = xs.map(f).filter((x) => x != null).sort((x, y) => x - y); return !a.length ? "" : a[0] === a[a.length - 1] ? "AED " + money(a[0]) : "AED " + money(a[0]) + " &ndash; " + money(a[a.length - 1]); };
  const ROWS = [["Options in this brief", (rs) => rs.map((r) => esc(r.name) + (r.devName ? ' <span style="color:' + MUTED + ';">(' + esc(r.devName) + ")</span>" : "")).join("<br>")],
    ["Typical price", (rs) => rng(rs, (r) => r.buy.best.aed)], ["Price per sq ft", (rs) => rng(rs, (r) => r.buy.best.psf)],
    ["Price tier", (rs) => [...new Set(rs.map((r) => TIER_NAME[r.buy.best.tier]))].join(", ")], ["Sales recorded", (rs) => money(rs.reduce((s, r) => s + r.buy.best.n, 0)) + " across these options"]];
  const head = '<tr style="background:' + NAVY + ';"><th style="padding:7px 8px;"></th>' + ds.map((d) => '<th style="text-align:left;padding:7px 8px;color:#FBFAF7;font-size:11px;font-weight:600;">' + esc(byD[d][0].dist) + "</th>").join("") + "</tr>";
  const body = ROWS.map(([label, f]) => '<tr><td style="padding:6px 8px;border-bottom:1px solid #E6E1D8;font-size:10.5px;font-weight:600;color:' + NAVY + ';vertical-align:top;width:150px;">' + label + "</td>" +
    ds.map((d) => '<td style="padding:6px 8px;border-bottom:1px solid #E6E1D8;font-size:10px;line-height:1.35;vertical-align:top;">' + (f(byD[d]) || "&mdash;") + "</td>").join("") + "</tr>").join("");
  const B = BEDS[q.beds];
  return landPage(C, '<div style="height:74px;display:flex;align-items:center;justify-content:space-between;padding:0 30px;background:#FFF;border-bottom:1px solid #E6E1D8;flex-shrink:0;">' +
    '<div style="display:flex;flex-direction:column;gap:3px;"><div class="serif" style="font-size:24px;color:' + NAVY + ';line-height:1;">The areas side by side</div>' +
    '<div style="font-size:11px;color:' + MUTED + ';">' + C.today + " &middot; " + esc(ds.map((d) => byD[d][0].dist).join(" · ")) + (B && !B.all ? " &middot; " + esc(bedsWordOf(q)) : "") + "</div></div>" + logo(C, 68) + "</div>" +
    '<div class="cmppage" style="flex:1;padding:10px 30px 4px 30px;overflow:hidden;"><table style="width:100%;border-collapse:collapse;">' + head + body + "</table>" +
    '<div style="font-size:8.6px;color:' + MUTED + ';line-height:1.35;margin-top:6px;">Prices are sales recorded at the Land Department, not asking prices; the figures are those of the options in this brief, by area.</div></div>' + landFooter());
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
  if (q.mode !== "rent" && q.mode !== "buy") return { status: 400, body: { ok: false, reason: "mode must be rent or buy" } };
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
  const C = await loadContext(env, q, { now: opts && opts.now, origin: opts && opts.origin, need: { units: dossierish, photos: dossierish, map: true }, deferLive: true });
  if (C.error) return { status: 503, body: { ok: false, reason: C.error } };
  if (C.missing.length) return { status: 404, body: { ok: false, reason: C.buy ? "not found in the unit-mix register" : "not in the rent index", keys: C.missing } };
  if (C.buy && (C.noEvidence.length && q.kind === "dossier" || !C.recs.length)) return { status: 422, body: { ok: false, reason: "no settled-sales evidence (3 or more recorded sales of the asked home type, inside the budget) for this option", keys: C.noEvidence } };   // v306 - an owner message, never a client page
  // v290 AMENITY CARDS (src/amenity_cards.js): one card per ticked must-have per district, pictures fetched now and embedded, never stored.
  // v291 - started here, alongside the live Google answers (C.live), which the pages below need before they are drawn
  const chrome = { landPage: (inner) => landPage(C, inner), footer: landFooter(), logo: logo(C, 68), today: C.today, fitImg, jpegSize };
  const [amenPages] = await Promise.all([withAmenityPages(env, q, C, "", chrome), C.live]);
  let html, title, fname;
  const B = BEDS[q.beds], tag = (q.beds === "studio" ? "Studio" : q.beds === "all" ? "All" : q.beds + "BR");
  if (q.kind === "dossier") {
    const rec = C.recs[0];
    html = dossierHtml(C, rec, Object.assign({}, q, { beds: rec.beds || q.beds }), q.num, q.of);
    title = rec.name + " - " + B.word;
    fname = (q.num ? String(q.num).padStart(2, "0") + "_" : "") + rec.name.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "") + "_" + tag + ".pdf";
  } else if (q.kind === "pack") {
    html = packHtml(C, q); title = (C.buy ? "Purchase options - " : "Rental options - ") + B.word; fname = (C.buy ? "Purchase_options_" : "Rental_options_") + tag + ".pdf";
  } else {
    html = oneSheetHtml(C, q); title = "One-sheet - " + B.word; fname = "One_sheet_" + tag + ".pdf";
  }
  // v282 - Compare and Full pack open with the areas side by side when 2 or 3 areas were compared (the same block as the /brief page)
  if (q.kind === "compare" || q.kind === "pack") { const cmp = await comparisonFor(env, q); if (cmp) html = comparisonPage(C, q, cmp) + html; if (C.buy && q.compare) html = buyComparisonPage(C, q) + html; }
  // the amenity pages (withAmenityPages' own rule): at the end of Compare; in a Full pack, before the appendix (its last portrait page)
  if (amenPages) { const at = q.kind === "pack" ? html.lastIndexOf('<div class="sheet page">') : -1; html = at > 0 ? html.slice(0, at) + amenPages + html.slice(at) : html + amenPages; }
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
  let title = "Digital footprint";
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
    title = "Digital footprint · " + C.recs.map((r) => r.name).join(", ");
  } else if (d) {
    const layer = await kvJson(env, "brief_fp_" + d), geo = await kvJson(env, "districts_geo");
    const nm = (((geo && geo.districts) || []).find((x) => x.slug === d) || {}).name || d;
    svgs.push(layer ? briefMapSvg(layer, [], { single: false, district: nm, districtSlug: d }) : "");
    title = "Digital footprint · " + nm;
  } else return J({ ok: false, reason: "keys= or d= is required" }, 400);
  const body = svgs.map((s) => s ? '<div class="blk">' + s.replace("<svg ", '<svg style="width:100%;height:auto;display:block;" ') + "</div>"
    : '<div class="blk"><div class="maptofollow" style="aspect-ratio:3/2;border:1px dashed #DED9D0;display:flex;align-items:center;justify-content:center;font:14px Arial,sans-serif;color:' + MUTED + ';">' + REALTOR_VERIFIES + '</div></div>').join("");
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

// ------------------------------------------------------------------------------------------------ v324: the kit the Developers-by-area PDFs reuse (src/devmap_pdf.js)
// The same browser launcher, header picture, footer, fonts/CSS and map colours and projection as the Brief documents: one house look, one place to change it.
export const BRIEF_KIT = { renderPdf, footer, logo, kvDataUrl, todayLong, CSS, MAPC, KY, KH, PT, NAVY, GOLD, MUTED, CURATOR, WA_SVG, smallPrint };
