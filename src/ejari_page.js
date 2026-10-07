// CONTRACTS SIGNED - EJARI (v279, Kendall's go, 1 Oct 2026).
//
// "If a broker wants to check a particular building or district, we should be able to say: this building / this developer,
// on this day, signed N contracts through Ejari."
//
// This module owns, and index.js only imports and dispatches:
//   - ejariStartCard()       the second card on /start, beside the Brief: one search box, "Who's letting, where, this week", and
//                            a Dubai-wide mini chart with a Day / Week / Month toggle (data from /contracts_api?pulse=1)
//   - ejariRoutes()          GET /contracts       the search; Day / Week / Month / Custom; New / Renewed; bedroom and property-type
//                                                 chips; the answer for a building, a developer, a district or all of Dubai
//                            GET /contracts_api   ?index=1 the suggestion list; ?pulse=1 the START chart; ?kind=&id= the answer as
//                                                 JSON; &panel=1 the 7 / 30 day summary the building page draws
//   - ejariBuildingPanel()   the "Contracts signed" block inside the building page's panel (src/building_page.js, one marked block)
//
// WHAT IT IS AND IS NOT. Tenancy contracts registered with Ejari: a lettings-activity signal. It is never called availability -
// a contract signed says a home was let, not that one is free. The date axis is the day each contract was FILED with Ejari
// (img_ejari_filed_*, within hours of signing) by default, with a switch to the contract START date (img_ejari_recent / daily),
// which is also the fallback when the filed files are missing. The caveat line always names the axis on screen.
//
// THE DATA (built by the DDA session; read only here - this module never writes to KV):
//   img_ejari_recent_<district>   the last 30 days          img_ejari_daily_<district>   the last 400 days
//   img_ejari_daily_dubai         per area and per developer per day
//   img_ejari_filed_<district>, img_ejari_filed_dubai   the same rows by FILING date ("basis": "filed")
//   img_ejari_projects_index      {project_number: {name_en, name_ar, area, district, key, developer}} - every project, Dubai-wide
// Each contract file is {as_of, source, fields:[...], rows:[...]}; a row may be an object or an array in the order of `fields`.
// EJARI_FIELDS / EJARI_PROJECT_FIELDS are the ONE place field names live: a rename in the files is a one-line change there.
//
// desk_like rows (office bands that are flexi-desk licences) are kept out of every count and every ranking and reported on
// their own line, so a business centre does not top "most let buildings" with desks rented by the month.
//
// Page scripts are String.raw blocks with no ${} and no backticks (the rule src/brief_page.js keeps), checked with node --check
// by test/test_v279_contracts.mjs.
import { BRIEF_DISTRICTS } from "./brief_page.js";
import { COVERAGE_MIN, coverageOf, pctSay } from "./coverage_guard.js";   // v394: never offer a bedroom filter the contracts cannot answer
export { COVERAGE_MIN, coverageOf };

// ---- the adapter: the one place the files' field names are written ---------------------------------------------------
// canonical name -> the field name(s) in the DDA files, first present wins. A rename in the files is a one-line change here.
// The DDA session's final row fields (1 Oct 2026) come first; the later names are the earlier spec's, kept as fallbacks.
export const EJARI_FIELDS = {
  date: ["date", "contract_start_date"],
  project: ["dld_project", "project_name_en"],           // = Ejari project_name_en: THE VOGUE
  projectAr: ["project_name_ar"],                         // the register's Arabic name
  projectNo: ["dld_project_number", "project_number"],    // = Ejari project_number: 444
  area: ["area", "area_name_en"], district: ["district"], key: ["key"],
  devNo: ["developer_number"], dev: ["developer", "developer_name"],
  band: ["beds", "beds_band"], reg: ["reg_type"], n: ["contracts"], props: ["props"],
  med: ["rent_median", "median_rent"], q1: ["rent_q1", "q1_rent"], q3: ["rent_q3", "q3_rent"], desk: ["desk_like"],
  sub: ["sub_type", "property_sub_type"],                 // the register's own words: "1bed room+Hall", "Hotel", "Villa", "Office"
  usage: ["usage", "property_usage"]                      // Residential / Commercial
};
// img_ejari_projects_index: {as_of, source, projects, index: {"<project_number>": {...}}}
export const EJARI_PROJECT_FIELDS = { en: ["name_en"], ar: ["name_ar"], area: ["area"], district: ["district"], key: ["key"], dev: ["developer"], devNo: ["developer_number"] };
// v279 refinement: the DLD gateway feed carries each contract's FILING date, within hours of signing. The filed_* files are the
// default date axis ("filed with Ejari on"); the start-date files (recent / daily) are the switch and the fallback.
export const EJARI_KV = { recent: (d) => "img_ejari_recent_" + d, daily: (d) => "img_ejari_daily_" + d, dubai: "img_ejari_daily_dubai",
  filed: (d) => "img_ejari_filed_" + d, filedDubai: "img_ejari_filed_dubai", projects: "img_ejari_projects_index" };
export const BANDS = ["studio", "1", "2", "3", "3+", "office", "shop", "other"];
const BAND_SAY = { studio: "Studio", "1": "1 bedroom", "2": "2 bedrooms", "3": "3 bedrooms", "3+": "3 bedrooms or more", office: "Office", shop: "Shop", other: "Other" };
const BAND_CHIP = { studio: "Studio", "1": "1", "2": "2", "3": "3", "3+": "3+", office: "Office", shop: "Shop", other: "Other" };
const BAND_IN = { studio: "studio", "0": "studio", "1": "1", "2": "2", "3": "3", "3+": "3+", "4": "3+", "4+": "3+", office: "office", shop: "shop", retail: "shop", other: "other" };
export const TOPS = [5, 10, 15, 20];
const RES_BANDS = new Set(["studio", "1", "2", "3", "3+"]);

const present = (v) => v !== undefined && v !== null && !(typeof v === "string" && v.trim() === "");
const pickF = (o, names) => { for (const f of names) if (present(o[f])) return o[f]; return null; };
const num = (v) => { if (!present(v)) return null; const n = Number(v); return isFinite(n) ? n : null; };
const str = (v) => present(v) ? String(v).replace(/\s+/g, " ").trim() : "";

// one row of a file, whatever its shape, into the names this module uses. Every field is optional except the date.
export function ejariRow(raw, fields) {
  let o = raw;
  if (Array.isArray(raw)) { o = {}; (fields || []).forEach((f, i) => { o[f] = raw[i]; }); }
  if (!o || typeof o !== "object") return null;
  const g = (c) => pickF(o, EJARI_FIELDS[c]);
  const date = str(g("date")).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const project = str(g("project")), district = str(g("district")).toLowerCase();
  let key = str(g("key"));
  if (!key && project) key = "dld:" + project.toLowerCase();
  const d = g("desk"), bandRaw = g("band");
  return {
    date, project, projectAr: str(g("projectAr")), projectNo: str(g("projectNo")), area: str(g("area")), district, key,
    devNo: str(g("devNo")), dev: str(g("dev")),
    band: BAND_IN[str(bandRaw).toLowerCase()] || "other", bandKnown: present(bandRaw),
    reg: /renew/i.test(str(g("reg"))) ? "Renew" : "New",
    n: Math.max(0, num(g("n")) || 0), props: num(g("props")), med: num(g("med")), q1: num(g("q1")), q3: num(g("q3")),
    desk: d === true || d === 1 || d === "true" || d === "1",
    sub: str(g("sub")) || null, usage: str(g("usage")) || null
  };
}
// a whole contract file: {asOf, source, basis, first, rows}. asOf is the file's as_of date, or the latest row date when the file
// has none; first is the earliest row date (how far back a file whose length is not fixed actually reaches).
export function ejariDoc(doc) {
  if (!doc || !Array.isArray(doc.rows)) return null;
  const rows = doc.rows.map((r) => ejariRow(r, doc.fields)).filter(Boolean);
  let asOf = str(doc.as_of).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) asOf = rows.reduce((m, r) => (r.date > m ? r.date : m), "");
  const first = rows.reduce((m, r) => (!m || r.date < m ? r.date : m), "");
  return { asOf, source: doc.source || "", basis: doc.basis === "filed" ? "filed" : "start", first, rows };
}
// the projects index, whatever its wrapper: {index:{...}} (the DDA file), {projects:{...}}, a bare map, or {fields, rows}
export function ejariProjects(doc) {
  const out = new Map();
  if (!doc || typeof doc !== "object") return out;
  const one = (no, o) => {
    if (!o || typeof o !== "object" || !present(no)) return;
    const g = (c) => pickF(o, EJARI_PROJECT_FIELDS[c]);
    out.set(String(no).trim(), { no: String(no).trim(), en: str(g("en")), ar: str(g("ar")), area: str(g("area")), district: str(g("district")).toLowerCase(), key: str(g("key")), dev: str(g("dev")), devNo: str(g("devNo")) });
  };
  if (Array.isArray(doc.rows)) {
    for (const r of doc.rows) { let o = r; if (Array.isArray(r)) { o = {}; (doc.fields || []).forEach((f, i) => { o[f] = r[i]; }); } one(pickF(o, EJARI_FIELDS.projectNo), o); }
    return out;
  }
  const isMap = (x) => x && typeof x === "object" && !Array.isArray(x);
  const map = isMap(doc.index) ? doc.index : isMap(doc.projects) ? doc.projects : doc;
  for (const k of Object.keys(map)) if (!["as_of", "source", "fields", "projects", "index"].includes(k)) one(k, map[k]);
  return out;
}
// a sub-type as a filter key, and as words on a chip. Hotel Apartment is its own type, never folded into flats.
export const subKey = (s) => s == null ? "not stated" : String(s).toLowerCase().replace(/\s+/g, " ").trim();
export function subSay(s) {
  if (s == null) return "Not stated";
  if (/hotel/i.test(s)) return "Hotel apartment";
  const t = String(s).replace(/\s*\+\s*/g, " + ").replace(/\s+/g, " ").trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
// the register's identity for a building: "THE VOGUE · <arabic> · #444"
// v360 - no raw Arabic on a client page that is not bilingual (Kendall): English name and number; Arabic-only says so without the characters
export function ejariIdentity(en, ar, no) { return [en || (ar ? "name in Arabic on the register" : ""), no ? "#" + no : ""].filter(Boolean).join(" \u00b7 "); }

// ---- small helpers --------------------------------------------------------------------------------------------------
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const safeJson = (o) => JSON.stringify(o).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
const DAY = 86400000;
const dms = (s) => Date.parse(String(s).slice(0, 10) + "T00:00:00Z");
const dstr = (ms) => new Date(ms).toISOString().slice(0, 10);
const addD = (s, n) => dstr(dms(s) + n * DAY);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dSay = (s, noYear) => { const d = new Date(dms(s)); return d.getUTCDate() + " " + MON[d.getUTCMonth()] + (noYear ? "" : " " + d.getUTCFullYear()); };
const fmt = (n) => Math.round(n || 0).toLocaleString("en-US");
const aed = (v) => v == null ? "\u2014" : (v >= 1e6 ? "AED " + (v / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M" : "AED " + Math.round(v / 1e3) + "k");
const plural = (n, one, many) => fmt(n) + " " + (n === 1 ? one : many);
export function ejariPeriod(from, to) {
  if (from === to) return "on " + dSay(to);
  return "between " + dSay(from, from.slice(0, 4) === to.slice(0, 4)) + " and " + dSay(to);
}
// the middle of the recorded rents: each day's median, weighted by its contracts
function wmed(pairs) {
  const p = pairs.filter((x) => x[0] != null && x[1] > 0).sort((a, b) => a[0] - b[0]);
  const tot = p.reduce((s, x) => s + x[1], 0); if (!tot) return null;
  let c = 0; for (const x of p) { c += x[1]; if (c >= tot / 2) return x[0]; }
  return p[p.length - 1][0];
}
const SAY_AS = { jumeirahvillagecircle: "jvc", jumeirahvillagetriangle: "jvt", jltnorth: "jlt", althanyahfifth: "jlt", burjkhalifa: "downtown", siliconoasis: "dso", dubaimarina: "marina", alyelayiss2: "town square", madinatalmataar: "dubai south" };
// search text: lower case, Arabic letter forms folded, everything else a space (Latin, digits and Arabic letters survive)
const AR_FOLD = { "\u0623": "\u0627", "\u0625": "\u0627", "\u0622": "\u0627", "\u0629": "\u0647", "\u0649": "\u064A", "\u0624": "\u0648", "\u0626": "\u064A" };
export const ejariNorm = (s) => String(s || "").toLowerCase().replace(/[\u064B-\u0652\u0640]/g, "").replace(/[\u0623\u0625\u0622\u0629\u0649\u0624\u0626]/g, (c) => AR_FOLD[c]).replace(/[^a-z0-9\u0621-\u064A]+/g, " ").trim();

// ---- the query a link carries; anything malformed is dropped, never guessed at ----------------------------------------
const KINDS = ["building", "developer", "district", "dubai"];
// Day = the latest day against the 7-day average before it; Week = the last 7 days against the 7 before; Month = the last 30
// against the 30 before; Custom = any span up to 400 days back, with no comparison. (Kendall, 1 Oct 2026)
const RANGES = ["day", "week", "month", "custom"];
const RANGE_OLD = { today: "day", "1": "day", "7": "week", "30": "month" };
export function ejariQuery(sp) {
  const g = (k) => String(sp.get(k) || "").trim();
  const iso = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "";
  const beds = g("beds").split(",").map((x) => x.trim()).filter((x) => BANDS.includes(x));
  const subs = g("sub").split(",").map((x) => subKey(x)).filter((x) => /^[a-z0-9 +\-\/&().]{1,40}$/.test(x)).slice(0, 12);
  const r = RANGE_OLD[g("range")] || g("range"), top = parseInt(g("top"), 10);
  const kind = KINDS.includes(g("kind")) ? g("kind") : "";
  return {
    q: g("q").slice(0, 80), kind, id: kind === "dubai" ? "dubai" : g("id").slice(0, 160), d: /^[a-z0-9]{2,40}$/.test(g("d")) ? g("d") : "",
    range: RANGES.includes(r) ? r : "week", from: iso(g("from")), to: iso(g("to")),
    reg: ["new", "renew"].includes(g("reg")) ? g("reg") : "both", beds: [...new Set(beds)], sub: [...new Set(subs)],
    top: TOPS.includes(top) ? top : 5,
    basis: g("basis") === "start" ? "start" : "filed",   // the date axis: filed with Ejari (default) or contract start
    lang: g("lang") === "ar" ? "ar" : (g("lang") === "en" ? "en" : "")   // project names in English or Arabic; "" = the viewer's remembered choice
  };
}
// the window, anchored on the register's latest day (asOf), never more than 400 days back, with the window it is compared to
export function ejariRange(st, asOf) {
  if (st.range === "day") return { from: asOf, to: asOf, prev: { from: addD(asOf, -7), to: addD(asOf, -1), days: 7, avg: true } };
  if (st.range === "week") return { from: addD(asOf, -6), to: asOf, prev: { from: addD(asOf, -13), to: addD(asOf, -7), days: 7 } };
  if (st.range === "month") return { from: addD(asOf, -29), to: asOf, prev: { from: addD(asOf, -59), to: addD(asOf, -30), days: 30 } };
  const floor = addD(asOf, -399);
  let to = st.to && st.to <= asOf ? st.to : asOf, from = st.from || addD(to, -29);
  if (from > to) { const t = from; from = to; to = t; }
  if (from < floor) from = floor;
  if (to < from) to = from;
  return { from, to, prev: null };
}

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
// ---- reading the files (read only), memoised per request -------------------------------------------------------------
function reader(env) {
  const memo = new Map();
  const raw = (k) => { if (!memo.has(k)) memo.set(k, kvJsonAny(env, k)); return memo.get(k); };   // v283.1 - gzip-aware
  const get = async (k) => ejariDoc(await raw(k));
  const docs = new Map();
  const doc = (k) => { if (!docs.has(k)) docs.set(k, get(k)); return docs.get(k); };
  doc.raw = raw;
  return doc;
}
// the rows of one district from `from` on: the 30-day file when it reaches back that far, the 400-day file otherwise.
// start = the first day the rows returned can hold, so a caller can tell a quiet day from a day it never read.
async function districtRows(get, slug, from) {
  const rec = await get(EJARI_KV.recent(slug));
  if (rec && rec.asOf && from >= addD(rec.asOf, -29)) return { asOf: rec.asOf, rows: rec.rows, start: addD(rec.asOf, -29), basis: "start" };
  const dly = await get(EJARI_KV.daily(slug));
  if (dly && dly.asOf) return { asOf: dly.asOf, rows: dly.rows, start: addD(dly.asOf, -399), basis: "start" };
  return rec ? { asOf: rec.asOf, rows: rec.rows, start: addD(rec.asOf, -29), basis: "start" } : null;
}
// One district on the basis asked for. FILED reads img_ejari_filed_<district>; when that file is not there (or START was asked
// for) it reads the start-date files. rangeOf(asOf) gives the window once the file's own latest day is known.
// fellBack says FILED was asked for and START is what came back, so the page can say so.
async function districtSource(get, slug, basis, rangeOf) {
  if (basis === "filed") {
    const f = await get(EJARI_KV.filed(slug));
    if (f && f.asOf) return { asOf: f.asOf, rows: f.rows, start: f.first || f.asOf, basis: "filed", rg: rangeOf(f.asOf) };
  }
  const rec = await get(EJARI_KV.recent(slug));
  const asOf = (rec && rec.asOf) || ((await get(EJARI_KV.daily(slug))) || {}).asOf;
  if (!asOf) return null;
  const rg = rangeOf(asOf), s = await districtRows(get, slug, need(rg));
  return s ? Object.assign(s, { rg, fellBack: basis === "filed" }) : null;
}
// the Dubai-wide file on the basis asked for, falling back to contract start
async function dubaiSource(get, basis) {
  if (basis === "filed") { const f = await get(EJARI_KV.filedDubai); if (f && f.asOf && f.rows.length) return Object.assign(f, { basis: "filed", start: f.first || f.asOf }); }
  const d = await get(EJARI_KV.dubai);
  return d && d.asOf ? Object.assign(d, { basis: "start", start: addD(d.asOf, -399), fellBack: basis === "filed" }) : null;
}
async function districtNames(env) {
  const out = {};
  for (const r of BRIEF_DISTRICTS) out[r[0]] = r[1];
  try {
    const raw = env && env.MEETINGS ? await env.MEETINGS.get("img_districts_geo") : null;
    const d = raw ? JSON.parse(raw) : null;
    if (d && Array.isArray(d.districts)) for (const x of d.districts) if (x && x.slug && x.name) out[x.slug] = x.name;
  } catch (e) {}
  out.liwan1 = "Liwan"; delete out.goldensymphony;
  return out;
}
// the app's own building names, from the rent index (items {d, i, is, n}): "<district>:<id>" -> name
async function appNames(get) {
  const out = new Map();
  const ri = await get.raw("img_rent_index");
  for (const it of (ri && ri.items) || []) {
    if (!it || !it.d || !it.n) continue;
    const ids = [it.i].concat(Array.isArray(it.is) ? it.is : []).filter((x) => x != null);
    for (const id of ids) if (!out.has(it.d + ":" + id)) out.set(it.d + ":" + id, String(it.n));
  }
  return out;
}

// ---- the suggestion index: every building, developer and district the files name -------------------------------------
// b: [key, title, district, district name, name_en, name_ar, project_number]   v: [number, name, [districts]]   d: [slug, name, said-as]
let IDX = null, IDX_T = 0;
const IDX_TTL = 10 * 60 * 1000;
export function ejariCacheReset() { IDX = null; IDX_T = 0; }
async function buildIndex(env) {
  if (IDX && Date.now() - IDX_T < IDX_TTL) return IDX;
  const get = reader(env), names = await districtNames(env), apps = await appNames(get);
  const dubai = await get(EJARI_KV.dubai), projects = ejariProjects(await get.raw(EJARI_KV.projects));
  const slugs = new Set(Object.keys(names));
  if (dubai) for (const r of dubai.rows) if (r.district) slugs.add(r.district);
  for (const p of projects.values()) if (p.district) slugs.add(p.district);
  const files = await Promise.all([...slugs].map(async (s) => [s, await get(EJARI_KV.recent(s))]));
  const b = new Map(), v = new Map(), d = new Map();
  const addDev = (no, name, ds, c) => { if (!no) return; const x = v.get(no) || { n: name, ds: new Set(), c: 0 }; if (!x.n && name) x.n = name; if (ds) x.ds.add(ds); x.c += c; v.set(no, x); };
  const addB = (key, en, ar, no, ds, c) => {
    if (!key || !ds) return;
    const x = b.get(key) || { en: "", ar: "", no: "", d: ds, c: 0 };
    x.en = x.en || en; x.ar = x.ar || ar; x.no = x.no || no; x.c += c; b.set(key, x);
  };
  let asOf = dubai ? dubai.asOf : "";
  for (const [s, f] of files) {
    if (!f || !f.rows.length) continue;
    if (f.asOf > asOf) asOf = f.asOf;
    d.set(s, names[s] || (f.rows[0] && f.rows[0].area) || s);
    for (const r of f.rows) { const c = r.desk ? 0 : r.n; addB(r.key, r.project, r.projectAr, r.projectNo, r.district || s, c); addDev(r.devNo, r.dev, r.district || s, c); }
  }
  // the projects index names every project, including the ones with no contract in the last 30 days
  for (const p of projects.values()) {
    const ds = p.district || (p.key && p.key.indexOf("dld:") !== 0 ? p.key.split(":")[0] : "");
    addB(p.key || (p.en ? "dld:" + p.en.toLowerCase() : ""), p.en, p.ar, p.no, ds, 0);
    if (ds && !d.has(ds) && names[ds]) d.set(ds, names[ds]);
  }
  if (dubai) for (const r of dubai.rows) { addDev(r.devNo, r.dev, r.district, r.desk ? 0 : r.n); if (r.district && !d.has(r.district)) d.set(r.district, names[r.district] || r.area || r.district); }
  IDX = {
    ok: true, as_of: asOf,
    b: [...b.entries()].sort((x, y) => y[1].c - x[1].c).map(([k, x]) => [k, apps.get(k) || x.en || x.ar || k, x.d, d.get(x.d) || names[x.d] || x.d, x.en, x.ar, x.no]),
    v: [...v.entries()].filter(([, x]) => x.n).sort((x, y) => y[1].c - x[1].c).map(([k, x]) => [k, x.n, [...x.ds]]),
    d: [["dubai", "All of Dubai", "dubai all"]].concat([...d.entries()].sort((x, y) => x[1].localeCompare(y[1])).map(([k, n]) => [k, n, SAY_AS[k] || ""]))
  };
  IDX_T = Date.now();
  return IDX;
}
function score(q, name, extra) {
  const n = ejariNorm(name), e = ejariNorm(extra);
  if (!q || !n) return 0;
  if (n === q) return 100;
  if (n.indexOf(q) === 0) return 60;
  if ((" " + n).indexOf(" " + q) >= 0 || (e && (" " + e + " ").indexOf(" " + q + " ") >= 0)) return 40;
  if (n.indexOf(q) >= 0) return 20;
  return 0;
}
// free text -> the things it could mean, best first. A building is found by the app's name, the register's English name, its
// Arabic name, or its project number ("444" or "#444").
export function ejariMatch(idx, text) {
  const raw = String(text || "").trim(), q = ejariNorm(raw), out = [];
  const qNo = /^#?\s*(\d{1,7})$/.exec(raw);
  if (!q || (q.length < 2 && !qNo)) return out;
  for (const x of idx.d) { const s = score(q, x[1], x[0] + " " + x[2]); if (s) out.push({ kind: x[0] === "dubai" ? "dubai" : "district", id: x[0], name: x[1], sub: x[0] === "dubai" ? "Every district" : "District", s: s + 3 }); }
  for (const x of idx.v) { const s = score(q, x[1]); if (s) out.push({ kind: "developer", id: x[0], name: x[1], sub: "Developer \u00b7 " + plural(x[2].length, "district", "districts"), s: s + 1 }); }
  for (const x of idx.b) {
    let s = Math.max(score(q, x[1]), score(q, x[4]), score(q, x[5]));
    if (qNo && x[6] === qNo[1]) s = 100;
    if (s) out.push({ kind: "building", id: x[0], d: x[2], name: x[1], en: x[4], ar: x[5], app: x[1] !== x[4] && x[1] !== x[5] && x[1] !== x[0] ? x[1] : "", sub: "Building \u00b7 " + x[3] + (x[6] ? " \u00b7 #" + x[6] : ""), s });
  }
  return out.sort((a, b) => b.s - a.s || a.name.localeCompare(b.name)).slice(0, 15);
}

// ---- counting -------------------------------------------------------------------------------------------------------
// every filter but the window; noSub leaves the property-type filter off (to list the types the chips can offer)
function keep(st, from, to, noSub) {
  return (r) => r.date >= from && r.date <= to && (st.reg === "both" || (st.reg === "new") === (r.reg === "New")) && (!st.beds.length || st.beds.includes(r.band))
    && (noSub || !st.sub.length || st.sub.includes(subKey(r.sub)));
}
function tally(map, k, r) {
  const b = map[k] || (map[k] = { n: 0, nw: 0, rn: 0, m: [] });
  b.n += r.n; if (r.reg === "Renew") b.rn += r.n; else b.nw += r.n; if (r.med != null) b.m.push([r.med, r.n]);
}
export function ejariCount(rows) {
  const t = { n: 0, nw: 0, rn: 0, desk: 0 }, bands = {}, subs = {}, subName = {}, days = {};
  for (const r of rows) {
    if (r.desk) { t.desk += r.n; continue; }
    t.n += r.n; if (r.reg === "Renew") t.rn += r.n; else t.nw += r.n;
    tally(bands, r.band, r);
    const sk = subKey(r.sub); tally(subs, sk, r); if (!subName[sk]) subName[sk] = subSay(r.sub);
    const d = days[r.date] || (days[r.date] = { nw: 0, rn: 0 }); if (r.reg === "Renew") d.rn += r.n; else d.nw += r.n;
  }
  t.bands = BANDS.filter((k) => bands[k] && bands[k].n).map((k) => ({ band: k, label: BAND_SAY[k], n: bands[k].n, nw: bands[k].nw, rn: bands[k].rn, median: wmed(bands[k].m) }));
  // property types (Ejari's sub_type), biggest first
  t.subs = Object.keys(subs).filter((k) => subs[k].n).sort((a, b) => subs[b].n - subs[a].n || a.localeCompare(b))
    .map((k) => ({ sub: k, label: subName[k], n: subs[k].n, nw: subs[k].nw, rn: subs[k].rn, median: wmed(subs[k].m) }));
  t.days = days;
  return t;
}
// buildings ranked by contracts; flexi-desk licences never earn a place in the ranking
export function ejariRank(rows, names, apps) {
  const g = new Map();
  for (const r of rows) {
    if (r.desk || !r.key) continue;
    const x = g.get(r.key) || { key: r.key, name: (apps && apps.get(r.key)) || r.project || r.projectAr || r.key, app: (apps && apps.get(r.key)) || "", en: r.project, ar: r.projectAr, no: r.projectNo, district: r.district, dname: (names && names[r.district]) || r.area || r.district, dev: r.dev, n: 0, nw: 0, rn: 0 };
    x.n += r.n; if (r.reg === "Renew") x.rn += r.n; else x.nw += r.n;
    g.set(r.key, x);
  }
  return [...g.values()].filter((x) => x.n > 0).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
}
// districts ranked by new leases (by renewals when only renewals are asked for)
export function ejariWhere(rows, names, by) {
  const g = new Map();
  for (const r of rows) {
    if (r.desk) continue;
    const k = r.district || (r.area ? "area:" + r.area.toLowerCase() : ""); if (!k) continue;
    const x = g.get(k) || { district: r.district, name: names[r.district] || r.area || r.district, n: 0, nw: 0, rn: 0 };
    x.n += r.n; if (r.reg === "Renew") x.rn += r.n; else x.nw += r.n;
    g.set(k, x);
  }
  const m = by === "rn" ? "rn" : by === "n" ? "n" : "nw";
  return [...g.values()].filter((x) => x[m] > 0).sort((a, b) => b[m] - a[m] || b.n - a.n || a.name.localeCompare(b.name)).map((x) => Object.assign(x, { v: x[m] }));
}
// "up 12% on the 7 days before" - the same filters, the window before
function compare(A, prevRows, rg, covered) {
  if (!rg.prev) return null;
  if (!covered) return { missing: true, days: rg.prev.days, avg: !!rg.prev.avg };
  const n = prevRows.reduce((s, r) => s + (r.desk ? 0 : r.n), 0);
  const base = rg.prev.avg ? n / rg.prev.days : n;
  const pct = base > 0 ? Math.round(((A.count.n - base) / base) * 100) : null;
  return { n, base, pct, days: rg.prev.days, avg: !!rg.prev.avg, from: rg.prev.from, to: rg.prev.to };
}

// ---- the answer: one building, one developer, one district or all of Dubai, for one window ----------------------------
function finish(base, subject, st, rg, anchor, srcs) {
  const covers = (day) => srcs.every((s) => !s || s.start <= day);
  // v394: how many of the window's contracts (under the other filters, bedrooms off) record a bedroom at all. Below COVERAGE_MIN the
  // bedroom chips are not offered and a remembered selection is ignored, so a stored chip can never zero the page.
  const win = subject.filter(keep(Object.assign({}, st, { beds: [] }), rg.from, rg.to)).filter((r) => !r.desk);
  // a bedroom is "known" when the band is Studio / 1 / 2 / 3 / 3+; an office, a shop or no band at all is not a bedroom (the register's
  // office and shop rows carry a band word, which is why 58% for Business Bay on contract start, not 100%)
  const hasBed = (r) => RES_BANDS.has(r.band);
  const share = coverageOf(win, (r) => hasBed(r) || null), bedsOk = share === null || share >= COVERAGE_MIN;
  const effBeds = bedsOk ? st.beds : [], stE = effBeds === st.beds ? st : Object.assign({}, st, { beds: effBeds });
  const sum = (a) => a.reduce((t, r) => t + r.n, 0);
  const rows = subject.filter(keep(stE, rg.from, rg.to));
  const A = Object.assign(base, { asOf: anchor, from: rg.from, to: rg.to, range: st.range, short: !covers(rg.from), count: ejariCount(rows) });
  A.beds = { ok: bedsOk, share, min: COVERAGE_MIN, active: effBeds, ignored: bedsOk ? [] : st.beds, windowN: sum(win),
    unknownN: sum(win.filter((r) => !hasBed(r))), allN: sum(subject.filter(keep({ reg: "both", beds: [], sub: [] }, rg.from, rg.to)).filter((r) => !r.desk)) };
  // the property types the chips offer: every type in the window under the other filters, whatever the type filter says
  A.subsAll = ejariCount(subject.filter(keep(st, rg.from, rg.to, true))).subs.map((s) => ({ sub: s.sub, label: s.label, n: s.n }));
  A.cmp = rg.prev ? compare(A, subject.filter(keep(stE, rg.prev.from, rg.prev.to)), rg, covers(rg.prev.from)) : null;
  Object.defineProperty(A, "_rows", { value: rows, enumerable: false });
  return A;
}
const need = (rg) => (rg.prev && rg.prev.from < rg.from ? rg.prev.from : rg.from);
export async function ejariAnswer(env, st) {
  const get = reader(env), names = await districtNames(env);
  st = Object.assign({ beds: [], sub: [], reg: "both", top: 5, basis: "filed" }, st);
  const rangeOf = (asOf) => ejariRange(st, asOf);
  const basisOf = (src) => ({ basis: src.basis, fellBack: !!src.fellBack });
  if (st.kind === "building") {
    const slug = st.id.indexOf("dld:") === 0 ? st.d : st.id.split(":")[0];
    if (!slug) return { notFound: true, why: "That building has no district on record." };
    const src = await districtSource(get, slug, st.basis, rangeOf);
    if (!src) return { notFound: true, why: "There is no contract record for " + (names[slug] || slug) + " yet." };
    const mine = src.rows.filter((r) => r.key === st.id);
    if (!mine.length) return { notFound: true, why: "No contracts on record for this building since " + dSay(src.start) + "." };
    const last = mine.reduce((a, r) => (r.date > a.date ? r : a), mine[0]);
    const proj = last.projectNo ? ejariProjects(await get.raw(EJARI_KV.projects)).get(last.projectNo) : null;
    const en = last.project || (proj && proj.en) || "", ar = last.projectAr || (proj && proj.ar) || "", no = last.projectNo || "";
    const bound = st.id.indexOf("dld:") !== 0, app = bound ? (await appNames(get)).get(st.id) : null;
    return finish(Object.assign({ kind: "building", id: st.id, name: app || en || st.id, appName: app || null, identity: ejariIdentity(en, ar, no), en, ar, no,
      district: slug, dname: names[slug] || last.area || slug, dev: last.dev || (proj && proj.dev) || "", devNo: last.devNo,
      appId: bound ? st.id.split(":").slice(1).join(":") : null }, basisOf(src)), mine, st, src.rg, src.asOf, [src]);
  }
  if (st.kind === "district") {
    const slug = /^[a-z0-9]{2,40}$/.test(st.id) ? st.id : "";
    const src = slug ? await districtSource(get, slug, st.basis, rangeOf) : null;
    if (!src) return { notFound: true, why: "There is no contract record for " + (names[slug] || "that district") + " yet." };
    const A = finish(Object.assign({ kind: "district", id: slug, name: names[slug] || (src.rows[0] && src.rows[0].area) || slug, district: slug }, basisOf(src)), src.rows, st, src.rg, src.asOf, [src]);
    A.ranking = ejariRank(A._rows, names, await appNames(get)).slice(0, 20);
    return A;
  }
  if (st.kind === "developer") {
    const dub = await dubaiSource(get, st.basis);
    let ds = new Set(), name = "";
    // v287: the filed files carry the developer's name but no number, so a row with no number is matched on the name
    const idx = await buildIndex(env); const ix = idx.v.find((y) => y[0] === st.id);
    if (ix) name = ix[1] || name;
    const nk = (v) => String(v || "").toUpperCase().replace(/\s+/g, " ").trim();
    const isMine = (r) => (r.devNo != null && r.devNo !== "" ? String(r.devNo) === String(st.id) : !!name && nk(r.dev) === nk(name));
    if (dub) for (const r of dub.rows) if (isMine(r)) { if (r.district) ds.add(r.district); if (!name && r.dev) name = r.dev; }
    if (ix) ix[2].forEach((s) => ds.add(s));
    if (!ds.size) return { notFound: true, why: "No contracts on record for that developer." };
    // every district on the same basis and the same window: the basis the Dubai-wide file came back on
    const basis = dub ? dub.basis : st.basis;
    let anchor = dub && dub.asOf;
    if (!anchor) { for (const s of ds) { const r = await districtSource(get, s, basis, rangeOf); if (r && r.asOf > (anchor || "")) anchor = r.asOf; } }
    const rg = ejariRange(st, anchor);
    const parts = (await Promise.all([...ds].slice(0, 25).map((s) => districtSource(get, s, basis, () => rg)))).filter(Boolean);
    let mine = [];
    for (const p of parts) mine = mine.concat(p.rows.filter(isMine));
    for (const r of mine) if (!name && r.dev) name = r.dev;
    const used = parts.some((p) => p.basis === "start") ? "start" : basis;
    const A = finish({ kind: "developer", id: st.id, name: name || "Developer " + st.id, districts: [...ds].map((s) => names[s] || s), basis: used, fellBack: st.basis === "filed" && used === "start" }, mine, st, rg, anchor, parts);
    A.projects = ejariRank(A._rows, names, await appNames(get));
    return A;
  }
  if (st.kind === "dubai") {
    // totals, the day strip, the comparison and "where" come from the Dubai-wide file; "most let buildings" from the district
    // files of the twenty districts with the most activity (where the busiest buildings are). A filter the Dubai-wide file cannot
    // split by is left off its figures, and the page says so.
    const dub = await dubaiSource(get, st.basis);
    if (!dub) return { notFound: true, why: "The all-Dubai contract record has not landed yet." };
    const anchor = dub.asOf, rg = ejariRange(st, anchor);
    const canBeds = dub.rows.some((r) => r.bandKnown), canSub = dub.rows.some((r) => r.sub != null);
    const st2 = Object.assign({}, st, { beds: canBeds ? st.beds : [], sub: canSub ? st.sub : [] });
    const A = finish({ kind: "dubai", id: "dubai", name: "Dubai", basis: dub.basis, fellBack: !!dub.fellBack, ignored: [].concat(!canBeds && st.beds.length ? ["bedrooms"] : [], !canSub && st.sub.length ? ["property type"] : []) },
      dub.rows, st2, rg, anchor, [dub]);
    const where = ejariWhere(A._rows, names, st.reg === "renew" ? "rn" : "nw");
    A.where = where.slice(0, 20);
    A.whereBy = st.reg === "renew" ? "renewals" : "new leases";
    const busiest = ejariWhere(dub.rows.filter((r) => r.date >= rg.from && r.date <= rg.to), names, "n").filter((x) => x.district).slice(0, 20).map((x) => x.district);
    const parts = (await Promise.all(busiest.map((s) => districtSource(get, s, dub.basis, () => rg)))).filter(Boolean);
    let brows = []; const stB = A.beds.ok ? st : Object.assign({}, st, { beds: [] });
    for (const p of parts) brows = brows.concat(p.rows.filter(keep(stB, rg.from, rg.to)));
    A.buildings = ejariRank(brows, names, await appNames(get)).slice(0, 20);
    if (!canSub) { let all = []; for (const p of parts) all = all.concat(p.rows.filter(keep(st, rg.from, rg.to, true))); A.subsAll = ejariCount(all).subs.map((s) => ({ sub: s.sub, label: s.label, n: s.n })); }
    return A;
  }
  return null;
}

// ---- the Dubai-wide pulse for the START card's mini chart -------------------------------------------------------------
// New leases (reg_type New, flexi-desk licences left out), from img_ejari_filed_dubai (or img_ejari_daily_dubai on the start
// basis, or when the filed file is missing). For each of Day / Week / Month: seven bars (seven days, seven weeks, seven 30-day
// spans - the last one gold), the latest one's count against the one before it (Day: against the 7-day average), and the
// districts with the most new leases in it. No file, no numbers: {ok:false}.
const SHORT = { jumeirahvillagecircle: "JVC", jumeirahvillagetriangle: "JVT", jltnorth: "JLT", althanyahfifth: "JLT 5", dubaimarina: "Marina", burjkhalifa: "Downtown", siliconoasis: "Silicon Oasis", dubaisportscity: "Sports City", alyelayiss2: "Town Square", madinatalmataar: "Dubai South", palmjumeirah: "Palm", dubaihills: "Dubai Hills", alkhairanfirst: "Creek Harbour", madinathind4: "DAMAC Hills 2" };
export async function ejariPulse(env, basis, nowMs) {
  const get = reader(env), dub = await dubaiSource(get, basis === "start" ? "start" : "filed");
  if (!dub || !dub.rows.length) return { ok: false };
  const names = await districtNames(env), a = dub.asOf, per = {}, perD = {};
  for (const r of dub.rows) {
    if (r.desk || r.reg !== "New") continue;
    per[r.date] = (per[r.date] || 0) + r.n;
    if (r.district) { const m = perD[r.date] || (perD[r.date] = {}); m[r.district] = (m[r.district] || 0) + r.n; }
  }
  const sum = (from, to) => { let s = 0; for (let d = from; d <= to; d = addD(d, 1)) s += per[d] || 0; return s; };
  const where = (from, to) => { const m = {}; for (let d = from; d <= to; d = addD(d, 1)) for (const k in (perD[d] || {})) m[k] = (m[k] || 0) + perD[d][k];
    return Object.keys(m).filter((k) => m[k] > 0).sort((x, y) => m[y] - m[x] || x.localeCompare(y)).slice(0, 8).map((k) => [k, SHORT[k] || names[k] || k, m[k]]); };
  const today = dstr((nowMs == null ? Date.now() : nowMs) + 4 * 3600000);   // Dubai's date
  const when = a === addD(today, -1) ? "yesterday" : a === today ? "today" : "on " + dSay(a, true);
  const mode = (len, avg) => {
    const bars = []; for (let i = 6; i >= 0; i--) { const to = addD(a, -i * len), from = addD(to, -(len - 1)); bars.push({ from, to, n: sum(from, to) }); }
    const cur = bars[6], pf = addD(cur.from, -(avg ? 7 : len)), pt = addD(cur.from, -1), p = sum(pf, pt), base = avg ? p / 7 : p;
    return { n: cur.n, from: cur.from, to: cur.to, prev: p, base: Math.round(base * 10) / 10, pct: base > 0 ? Math.round(((cur.n - base) / base) * 100) : null, bars, where: where(cur.from, cur.to) };
  };
  return { ok: true, as_of: a, basis: dub.basis, fell_back: !!dub.fellBack, when, day: mode(1, true), week: mode(7), month: mode(30) };
}

// ---- the screens ----------------------------------------------------------------------------------------------------
export const EJARI_CAVEAT = "Ejari records each contract\u2019s start date; it can be filed before or after that day. No unit numbers are published.";
export const EJARI_CAVEAT_FILED = "Counted by the day each contract was filed with Ejari, usually within hours of signing. No unit numbers are published.";
// the caveat line always matches the date axis on screen; a fallback says so
export function ejariCaveat(basis, fellBack) {
  return basis === "filed" ? EJARI_CAVEAT_FILED : EJARI_CAVEAT + (fellBack ? " Filing dates are not loaded for this yet, so these are contract start dates." : "");
}

const kq = (key, rk) => "key=" + encodeURIComponent(key || "") + (rk ? "&rk=" + encodeURIComponent(rk) : "");
// /start: the second card, beside the Brief. The search is a plain form (it works before any script loads); the mini chart and
// its Day / Week / Month toggle are drawn by EJARI_START_JS from /contracts_api?pulse=1.
// v279 look (Kendall's approved mock-up): a rule, then an icon card - "Who's letting, where", the search box, a 7-bar mini chart
// (the latest bar gold), a Day / Week / Month toggle and district chips with counts. The chart, toggle and chips are drawn by
// EJARI_START_JS only when /contracts_api?pulse=1 has data; with nothing in KV the card is the search box alone - no fake numbers.
const DOC_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="#7FC8A9" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden=true><path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10.5a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5Z"/><path d="M14 3.5V8h4"/><path d="m9 14 2 2 4-4.5"/></svg>';
const LENS_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#93A39E" stroke-width="2" stroke-linecap="round" aria-hidden=true><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
export function ejariStartCard(key, rk) {
  const boot = { key: key || "", rk: rk || "" };
  return '<div class=ejstart id=ejari0><div class=ejc>'   // the rule above it is drawn by src/start_page.js
    + '<div class=ejh><div class=ic>' + DOC_SVG + '</div><div><b>Who\u2019s letting, where</b><span id=ejsub>Tenancy contracts filed with Ejari</span></div></div>'
    + '<form class=ejf method=get action="/contracts">' + LENS_SVG + '<input type=hidden name=key value="' + esc(key || "") + '">' + (rk ? '<input type=hidden name=rk value="' + esc(rk) + '">' : "")
    + '<input type=hidden name=range value=week><input class=ejin type=search name=q autocomplete=off enterkeyhint=search placeholder="A building, a developer or a district" aria-label="search a building, a developer or a district">'
    + '<button type=submit class=ejgo aria-label="search">\u2192</button></form>'
    + '<div id=ejpulse hidden><div class=ejrow><div class=ejseg id=ejseg role=group aria-label="period"><button type=button data-m=day class=on>Day</button><button type=button data-m=week>Week</button><button type=button data-m=month>Month</button></div>'
    + '<div class=ejbas id=ejbas role=group aria-label="date counted"><button type=button data-b=filed class=on>Filed</button><button type=button data-b=start>Contract start</button></div></div>'
    + '<div class=spark id=ejspark></div><div class=chips id=ejchips></div></div>'
    + "</div><script>window.__EJS=" + safeJson(boot) + ";</script><script>" + EJARI_START_JS + "</script></div>";
}
export const EJARI_START_CSS = '.ejstart{position:relative;z-index:1;margin:0}'
  + '.ejc{background:#121D1B;border:1px solid #22302D;border-radius:22px;padding:16px;display:flex;flex-direction:column;gap:12px}'
  + '.ejh{display:flex;align-items:center;gap:12px}.ejh .ic{flex:0 0 auto;width:46px;height:46px;border-radius:14px;display:grid;place-items:center;background:rgba(44,140,128,.18)}.ejh .ic svg{width:28px;height:28px}'
  + '.ejh b{display:block;font:600 1.06rem "IBM Plex Sans",sans-serif;color:#EDE8DE}.ejh span{font-size:.78rem;color:#93A39E}'
  + '.ejf{display:flex;align-items:center;gap:10px;background:#0E1817;border:1px solid #22302D;border-radius:14px;padding:4px 6px 4px 14px}.ejf svg{flex:0 0 auto}'
  + '.ejin{flex:1 1 auto;min-width:0;min-height:42px;background:transparent;border:0;color:#EDE8DE;font-size:16px;font-family:inherit;outline:0}.ejin::placeholder{color:#93A39E}.ejf:focus-within{border-color:#C5A56A}'
  + '.ejgo{flex:0 0 auto;width:36px;height:36px;border:0;border-radius:10px;background:#1C2B28;color:#C5A56A;font-size:16px;cursor:pointer}'
  + '.ejrow{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;margin:0 0 10px}.ejbas{display:flex;gap:2px}.ejbas button{border:0;background:none;color:#6F837D;font:500 .66rem "IBM Plex Mono",monospace;letter-spacing:.04em;padding:6px 5px;cursor:pointer}.ejbas button.on{color:#C5A56A;text-decoration:underline;text-underline-offset:3px}.ejbas button[disabled]{opacity:.4;cursor:default}'
  + '.ejseg{display:inline-grid;grid-template-columns:repeat(3,auto);border:1px solid #22302D;border-radius:999px;overflow:hidden}.ejseg button{min-height:30px;padding:0 13px;border:0;background:transparent;color:#93A39E;font:500 .72rem "IBM Plex Sans",sans-serif;cursor:pointer}.ejseg button.on{background:#C5A56A;color:#0C1413;font-weight:600}'
  + '.spark{display:flex;align-items:flex-end;gap:4px;height:34px}.spark i{flex:1;border-radius:3px 3px 1px 1px;background:#1C5E56;min-height:2px}.spark i:last-child{background:#C5A56A}'
  + '.chips{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;margin-top:12px;-webkit-overflow-scrolling:touch}.chips::-webkit-scrollbar{display:none}'
  + '.chip{flex:none;border:1px solid #22302D;border-radius:999px;padding:6px 11px;font-size:.76rem;color:#EDE8DE;background:#0E1817;text-decoration:none}.chip b{color:#C5A56A;font-weight:600}';

const EJ_CSS = 'body{background:#0C1413;color:#E8E4D8;font-family:"IBM Plex Sans",system-ui,sans-serif;margin:0;padding:14px 14px 110px;max-width:560px;margin-inline:auto;-webkit-text-size-adjust:100%}'
  + '*{box-sizing:border-box}button{font:inherit;color:inherit}a{color:#C5A56A}[lang=ar]{font-family:"Segoe UI",Tahoma,"Noto Naskh Arabic",sans-serif}'
  + '.bk{display:inline-block;color:#8FA39B;text-decoration:none;font-family:"IBM Plex Mono",monospace;font-size:.64rem;letter-spacing:.1em;margin:0 0 8px}'
  + '.h{font-family:Fraunces,Georgia,serif;font-size:1.7rem;font-weight:600;margin:.1rem 0 .1rem;line-height:1.15}.h em{font-style:normal;color:#C5A56A}'
  + '.s{color:#8FA39B;font-size:.84rem;line-height:1.5;margin:0 0 12px}'
  + '.srch{position:relative;margin:0 0 12px}.srch form{display:flex;gap:7px}'
  + '.in{flex:1 1 auto;min-width:0;width:100%;min-height:46px;background:#0E1918;border:1px solid #2E4540;border-radius:9px;color:#E8E4D8;padding:9px 11px;font-size:16px;font-family:inherit}.in:focus{outline:2px solid #C5A56A;outline-offset:1px}'
  + '.gob{flex:0 0 auto;min-height:46px;border:0;border-radius:9px;background:#C5A56A;color:#0C1413;font-family:"IBM Plex Mono",monospace;font-size:.72rem;letter-spacing:.05em;font-weight:600;padding:0 13px;cursor:pointer}'
  + '.sug{background:#101D1B;border:1px solid #2E4540;border-radius:10px;margin:6px 0 0;overflow:hidden}.sug:empty{display:none}'
  + '.sug a{display:block;padding:10px 12px;border-top:1px solid #1B2E2A;text-decoration:none;color:#E8E4D8;font-size:.88rem}.sug a:first-child{border-top:0}.sug a small{display:block;color:#8FA39B;font-size:.7rem;margin-top:1px}.sx{padding:10px 12px;color:#8FA39B;font-size:.78rem}'
  + '.seg{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #2E4540;border-radius:10px;overflow:hidden;margin:0 0 10px}.seg a{display:flex;align-items:center;justify-content:center;min-height:42px;border-left:1px solid #2E4540;background:#0E1918;color:#C8D3CE;text-decoration:none;font-size:.84rem}.seg a:first-child{border-left:0}.seg a.on{background:#C5A56A;color:#0C1413;font-weight:600}'
  + '.bas{font-size:.74rem;color:#6F837D;margin:-2px 0 10px}.bas a{color:#8FA39B;text-decoration:none;padding:4px 2px}.bas a.on{color:#C5A56A;text-decoration:underline;text-underline-offset:3px}.bas span{color:#6F837D}'
  + '.pn .ar,html[data-lang=ar] .pn .en{display:none}html[data-lang=ar] .pn .ar{display:inline}.tgx{display:inline-block;margin:0 0 0 6px;padding:0 5px;border:1px solid #2E4540;border-radius:4px;font:500 .52rem "IBM Plex Mono",monospace;letter-spacing:.05em;color:#8FA39B;vertical-align:2px}'
  + '.lng{float:right;display:flex;border:1px solid #2E4540;border-radius:999px;overflow:hidden;margin:0 0 0 8px}.lng a{min-width:44px;padding:5px 10px;text-align:center;font-size:.72rem;color:#8FA39B;text-decoration:none}html:not([data-lang=ar]) .lng a[data-l=en],html[data-lang=ar] .lng a[data-l=ar]{background:#C5A56A;color:#0C1413;font-weight:600}'
  + '.flt{margin:0 0 12px}.fr{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 4px}'
  + '.ch{display:inline-flex;align-items:center;min-height:34px;border:1px solid #2E4540;background:#0E1918;border-radius:999px;padding:5px 11px;font-size:.78rem;color:#C8D3CE;text-decoration:none}.ch.dis{opacity:.4;cursor:not-allowed;pointer-events:none}.ch.on.dis{background:#6E6246;border-color:#6E6246}.ch.on{background:#C5A56A;border-color:#C5A56A;color:#0C1413;font-weight:600}'
  + '.fl{font-family:"IBM Plex Mono",monospace;font-size:.56rem;letter-spacing:.1em;color:#6F837D;margin:8px 0 5px}'
  + '.cus{display:grid;grid-template-columns:1fr 1fr auto;gap:7px;align-items:end;margin:0 0 4px}.cus label{font-size:.7rem;color:#8FA39B}.cus input{display:block;width:100%;margin-top:3px;min-height:40px;background:#0E1918;border:1px solid #2E4540;border-radius:8px;color:#E8E4D8;padding:6px 8px;font-size:15px;color-scheme:dark}'
  + '.card{background:#101D1B;border:1px solid #24352F;border-left:3px solid #3E8A7E;border-radius:12px;padding:13px;margin:0 0 12px}'
  + '.kt{font-family:"IBM Plex Mono",monospace;font-size:.58rem;letter-spacing:.11em;color:#8FA39B}'
  + '.nm{font-family:Fraunces,Georgia,serif;font-size:1.3rem;font-weight:600;color:#F0E4C8;line-height:1.2;margin:3px 0 2px}.idn{font-family:"IBM Plex Mono",monospace;font-size:.7rem;letter-spacing:.03em;color:#C5A56A;margin:2px 0 3px;line-height:1.5}.sb{color:#8FA39B;font-size:.78rem;line-height:1.4}'
  + '.hl{font-size:.98rem;line-height:1.45;margin:11px 0 3px;color:#E8E4D8}.hl b{font-family:Fraunces,Georgia,serif;font-size:1.9rem;color:#C5A56A;font-weight:600;vertical-align:-2px}'
  + '.cmp{font-size:.82rem;color:#C8D3CE;margin:0 0 5px}.cmp .up{color:#8FD3B9}.cmp .dn{color:#E0A080}'
  + '.nr{font-size:.8rem;color:#A9B7B2;margin:0 0 4px}.nr i{display:inline-block;width:9px;height:9px;border-radius:2px;margin:0 4px 0 0}.nr .cn{background:#C5A56A}.nr .cr{background:#3E8A7E}'
  + '.dk{font-size:.74rem;color:#8FA39B;line-height:1.45;margin:4px 0 0}'
  + '.strip{margin:10px 0 2px}.strip svg{display:block;width:100%;height:72px}.sl{display:flex;justify-content:space-between;gap:6px;font-family:"IBM Plex Mono",monospace;font-size:.56rem;color:#6F837D;margin:3px 0 0}'
  + 'table{width:100%;border-collapse:collapse;margin:10px 0 0;font-size:.8rem}th{text-align:right;font-family:"IBM Plex Mono",monospace;font-size:.52rem;letter-spacing:.07em;color:#6F837D;font-weight:500;padding:0 0 5px 4px}th:first-child,td:first-child{text-align:left;padding-left:0}'
  + 'td{text-align:right;padding:7px 0 7px 6px;border-top:1px solid #1B2E2A;color:#C8D3CE;vertical-align:top}td b{color:#F0E4C8;font-weight:600}'
  + '.lk{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0 0}.lk a{display:inline-flex;align-items:center;min-height:38px;border:1px solid #C5A56A;border-radius:9px;background:#0E1918;color:#E8E4D8;text-decoration:none;padding:6px 12px;font-size:.78rem}'
  + '.rk{display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-top:1px solid #1B2E2A}.rk .no{font-family:"IBM Plex Mono",monospace;font-size:.66rem;color:#6F837D;width:18px;flex:0 0 auto;padding-top:2px}'
  + '.rk .rb{flex:1 1 auto;min-width:0}.rk .rn{font-size:.9rem;color:#F0E4C8;line-height:1.3}.rk .rn a{color:inherit;text-decoration:none}.rk .rs{font-size:.72rem;color:#8FA39B;margin:1px 0 0;line-height:1.5}.rk .rs a{text-decoration:none;white-space:nowrap}'
  + '.rk .rc{flex:0 0 auto;text-align:right;font-family:Fraunces,Georgia,serif;font-size:1.15rem;color:#C5A56A;min-width:44px}.rk .rc small{display:block;font-family:"IBM Plex Sans",sans-serif;font-size:.6rem;color:#6F837D}'
  + '.br{height:5px;background:#1B2E2A;border-radius:3px;margin:5px 0 1px}.br i{display:block;height:100%;background:#C5A56A;border-radius:3px}'
  + '.hd{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-family:"IBM Plex Mono",monospace;font-size:.6rem;letter-spacing:.11em;color:#8FA39B;margin:16px 0 4px}.hd small{letter-spacing:.02em;color:#6F837D;font-size:.58rem}'
  + '.cav{color:#A9B7B2;font-size:.74rem;line-height:1.5;border:1px dashed #2E4540;border-radius:9px;padding:9px 11px;margin:12px 0 0}'
  + '.nt{color:#8FA39B;font-size:.8rem;line-height:1.5;margin:6px 0 10px}';

function linker(st, key, rk) {
  const base = { kind: st.kind, id: st.kind === "dubai" ? "" : st.id, d: st.d, range: st.range, from: st.range === "custom" ? st.from : "", to: st.range === "custom" ? st.to : "", reg: st.reg, beds: st.beds.join(","), sub: st.sub.join(","), top: String(st.top), basis: st.basis, lang: st.lang };
  return (over) => {
    const o = Object.assign({}, base, over || {}), p = [];
    for (const k of ["kind", "id", "d", "range", "from", "to", "reg", "beds", "sub", "top", "basis", "lang"]) if (o[k] && !(k === "reg" && o[k] === "both") && !(k === "top" && o[k] === "5") && !(k === "basis" && o[k] === "filed")) p.push(k + "=" + encodeURIComponent(o[k]));
    p.push(kq(key, rk));
    return "/contracts?" + p.join("&");
  };
}
const bpage = (slug, id, key, rk) => "/building/" + encodeURIComponent(slug) + "/" + encodeURIComponent(id) + "?" + kq(key, rk);
const blocks = (slug, id, key, rk) => "/blocks?district=" + encodeURIComponent(slug) + "&gold=" + encodeURIComponent(id) + "&" + kq(key, rk);
const appIdOf = (k) => (k && k.indexOf("dld:") !== 0 && k.indexOf(":") > 0) ? k.split(":").slice(1).join(":") : null;
const chip = (on, href, label, attrs) => '<a class="ch' + (on ? " on" : "") + '" href="' + esc(href) + '"' + (attrs || "") + ">" + esc(label) + "</a>";

// Day / Week / Month / Custom, at the top of the results
function toggleHtml(st, A, link, key, rk) {
  const R = [["day", "Day"], ["week", "Week"], ["month", "Month"], ["custom", "Custom"]];
  let h = '<div class=seg id=ejrange role=group aria-label="period">' + R.map((r) => '<a' + (st.range === r[0] ? " class=on" : "") + ' data-r=' + r[0] + ' href="' + esc(link({ range: r[0], from: "", to: "" })) + '">' + r[1] + "</a>").join("") + "</div>";
  // the date axis: filed with Ejari (default) or contract start. A fallback shows the switch on contract start, and says why.
  const used = A && A.basis ? A.basis : st.basis;
  h += '<div class=bas id=ejbasis>Dates: <a' + (used === "filed" ? " class=on" : "") + ' data-b=filed href="' + esc(link({ basis: "filed" })) + '">filed with Ejari</a> · <a' + (used === "start" ? " class=on" : "") + ' data-b=start href="' + esc(link({ basis: "start" })) + '">contract start</a>'
    + (A && A.fellBack ? ' <span>(filing dates not loaded yet)</span>' : "") + "</div>";
  if (st.range === "custom") {
    const anchor = A && A.asOf ? A.asOf : "", lim = anchor ? ' min="' + addD(anchor, -399) + '" max="' + anchor + '"' : "";
    const hid = (n, v) => v ? '<input type=hidden name=' + n + ' value="' + esc(v) + '">' : "";
    h += '<form class=cus method=get action="/contracts">' + hid("kind", st.kind) + hid("id", st.kind === "dubai" ? "" : st.id) + hid("d", st.d) + hid("reg", st.reg === "both" ? "" : st.reg)
      + hid("beds", st.beds.join(",")) + hid("sub", st.sub.join(",")) + hid("top", st.top === 5 ? "" : String(st.top)) + hid("basis", st.basis === "start" ? "start" : "") + '<input type=hidden name=range value=custom>' + hid("key", key || " ").replace(' value=" "', ' value=""') + hid("rk", rk)
      + '<label>From<input type=date name=from value="' + esc(A ? A.from : st.from) + '"' + lim + "></label>"
      + '<label>To<input type=date name=to value="' + esc(A ? A.to : st.to) + '"' + lim + "></label>"
      + '<button type=submit class=gob>SHOW</button></form><div class=sb style="margin:0 0 8px">Any span up to 400 days back. No comparison is drawn for a custom span.</div>';
  }
  return h;
}
function filtersHtml(st, A, link) {
  let h = '<div class=flt><div class=fl>NEW OR RENEWED</div><div class=fr id=ejreg>' + [["both", "Both"], ["new", "New"], ["renew", "Renewals"]].map((r) => chip(st.reg === r[0], link({ reg: r[0] }), r[1])).join("") + "</div>";
  const tog = (list, v, order) => { const s = new Set(list); if (s.has(v)) s.delete(v); else s.add(v); return (order ? order.filter((x) => s.has(x)) : [...s]).join(","); };
  const bd = A.beds || { ok: true, active: st.beds };
  if (bd.ok) h += '<div class=fl>BEDROOMS</div><div class=fr id=ejbeds>' + chip(!st.beds.length, link({ beds: "" }), "All") + BANDS.filter((b) => b !== "other").map((b) => chip(st.beds.includes(b), link({ beds: tog(st.beds, b, BANDS) }), BAND_CHIP[b])).join("") + "</div>";
  else {   // v394: not offered where the contracts do not record bedrooms: greyed, with the reason, and nothing remembered is applied
    h += '<div class=fl>BEDROOMS</div><div class=fr id=ejbeds data-off=1>' + '<span class="ch on dis" aria-disabled=true>All</span>'
      + BANDS.filter((b) => b !== "other").map((b) => '<span class="ch dis" aria-disabled=true>' + esc(BAND_CHIP[b]) + "</span>").join("") + "</div>"
      + '<div class=dk id=ejbedsnote>' + (A.basis === "filed" ? "Bedrooms are not recorded on contracts filed in the last days. Switch to contract start to split by bedrooms."
        : "Bedrooms are recorded for only " + esc(pctSay(bd.share)) + " of these contracts, so they cannot be split by bedrooms here.") + "</div>";
  }
  // property type, in Ejari's own words; a chosen type stays on the row even when the other filters leave it empty
  const subs = (A.subsAll || []).slice(0, 12), seen = new Set(subs.map((s) => s.sub));
  for (const s of st.sub) if (!seen.has(s)) subs.push({ sub: s, label: subSay(s), n: 0 });
  if (subs.length > 1 || st.sub.length) h += '<div class=fl>PROPERTY TYPE</div><div class=fr id=ejsub>' + chip(!st.sub.length, link({ sub: "" }), "All") + subs.map((s) => chip(st.sub.includes(s.sub), link({ sub: tog(st.sub, s.sub) }), s.label, " data-sub=\"" + esc(s.sub) + "\"")).join("") + "</div>";
  return h + "</div>";
}
// the daily bar strip: New in gold under Renewals in green; a week to a bar beyond three months
function stripHtml(A) {
  const days = Math.round((dms(A.to) - dms(A.from)) / DAY) + 1;
  if (days < 2) return "";
  const step = days > 92 ? 7 : 1, bins = [];
  for (let end = A.to; end >= A.from; end = addD(end, -step)) {
    let nw = 0, rn = 0;
    for (let i = 0; i < step; i++) { const d = addD(end, -i); if (d < A.from) break; const x = A.count.days[d]; if (x) { nw += x.nw; rn += x.rn; } }
    bins.unshift({ end, nw, rn });
  }
  const max = Math.max(1, ...bins.map((b) => b.nw + b.rn)), W = bins.length * 10, H = 70;
  const bars = bins.map((b, i) => {
    const hn = Math.round((b.nw / max) * (H - 2)), hr = Math.round((b.rn / max) * (H - 2));
    return '<rect x="' + (i * 10 + 1) + '" y="' + (H - hn) + '" width="8" height="' + hn + '" fill="#C5A56A"><title>' + esc(dSay(b.end) + ": " + (b.nw + b.rn)) + "</title></rect>"
      + (hr ? '<rect x="' + (i * 10 + 1) + '" y="' + (H - hn - hr) + '" width="8" height="' + hr + '" fill="#3E8A7E"></rect>' : "");
  }).join("");
  const peak = bins.reduce((a, b) => (b.nw + b.rn > a.nw + a.rn ? b : a), bins[0]);
  return '<div class=strip><svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio=none role=img aria-label="contracts ' + (step === 7 ? "a week" : "a day") + '"><rect x=0 y=' + (H - 1) + ' width="' + W + '" height=1 fill="#24352F"></rect>' + bars + "</svg>"
    + '<div class=sl><span>' + esc(dSay(A.from, true)) + "</span><span>busiest " + esc(step === 7 ? "week to " : "") + esc(dSay(peak.end, true)) + ": " + fmt(peak.nw + peak.rn) + "</span><span>" + esc(dSay(A.to, true)) + "</span></div></div>";
}
function table(rows, head) {
  if (!rows.length) return "";
  return '<table><tr><th>' + head + '</th><th>CONTRACTS</th><th>NEW</th><th>RENEWED</th><th>TYPICAL RENT A YEAR</th></tr>'
    + rows.map((b) => "<tr><td>" + esc(b.label) + "</td><td><b>" + fmt(b.n) + "</b></td><td>" + fmt(b.nw) + "</td><td>" + fmt(b.rn) + "</td><td>" + esc(aed(b.median)) + "</td></tr>").join("") + "</table>";
}
function cmpHtml(c) {
  if (!c) return "";
  const what = c.avg ? "the 7-day average before it" : "the " + c.days + " days before";
  if (c.missing) return '<div class=cmp id=ejcmp>No comparison: ' + esc(what) + " is not in the loaded record yet.</div>";
  const base = c.avg ? (Math.round(c.base * 10) / 10).toLocaleString("en-US") + " a day" : fmt(c.base);
  if (c.pct == null) return '<div class=cmp id=ejcmp>None in ' + esc(what) + ".</div>";
  const word = c.pct > 0 ? '<span class=up>Up ' + c.pct + "%</span>" : (c.pct < 0 ? '<span class=dn>Down ' + -c.pct + "%</span>" : "Level");
  return '<div class=cmp id=ejcmp>' + word + " on " + esc(what) + " (" + esc(base) + ").</div>";
}
// A project name in both languages; CSS shows the one the EN / AR toggle chose. Where only one exists it is shown, tagged
// "EN only" / "AR only". A name is never machine-translated. The app's own name, where there is one, is the English side.
export function pname(en, ar, app) {
  const e = app || en || "", a = ar || "";
  if (!e && !a) return "";
  const arS = (t) => '<span lang=ar dir=rtl>' + esc(t) + "</span>";
  return '<span class=pn><span class=en>' + (e ? esc(e) : arS(a) + '<small class=tgx>AR only</small>') + '</span><span class=ar>' + (a ? arS(a) : esc(e) + '<small class=tgx>EN only</small>') + "</span></span>";
}
function headline(subjectHtml, A) {
  const c = A.count, b = A.beds || { ok: true, active: [], allN: c.n, windowN: c.n, unknownN: 0 };
  const how = A.basis === "filed" ? ", filed with Ejari " : " through Ejari, by contract start date, ";
  // v394: never a bare 0 over contracts that exist: say how many there were, and that the filter is what emptied it
  const zeroHid = c.n === 0 && b.allN > 0;
  const lead = zeroHid
    ? subjectHtml + ": <b>0</b> match this filter; <b>" + fmt(b.allN) + "</b> " + (b.allN === 1 ? "contract was" : "contracts were") + (A.basis === "filed" ? " filed with Ejari " : " signed through Ejari, by contract start date, ") + esc(ejariPeriod(A.from, A.to)) + "."
    : subjectHtml + " signed <b>" + fmt(c.n) + "</b> " + (c.n === 1 ? "contract" : "contracts") + esc(how + ejariPeriod(A.from, A.to)) + ".";
  const excl = b.active.length && b.unknownN > 0
    ? '<div class=dk id=ejexcl>' + fmt(b.unknownN) + " of " + fmt(b.windowN) + " contracts have no bedroom recorded and are not in this count.</div>" : "";
  const covl = A.basis === "filed" && b.share !== null && b.share !== undefined
    ? '<div class=dk id=ejcov>Bedrooms known for ' + esc(pctSay(b.share)) + " of these contracts.</div>" : "";
  return '<div class=hl id=ejhl>' + lead + "</div>" + excl + covl
    + cmpHtml(A.cmp)
    + '<div class=nr><i class=cn></i>' + plural(c.nw, "new lease", "new leases") + " \u00a0 <i class=cr></i>" + plural(c.rn, "renewal", "renewals") + "</div>"
    + (c.desk ? '<div class=dk id=ejdesk>Plus ' + plural(c.desk, "flexi-desk licence", "flexi-desk licences") + " (office desks rented by the month), left out of these counts and the rankings.</div>" : "")
    + (A.short ? '<div class=dk>The loaded record for this place does not reach back to the start of this window, so the earlier part is empty.</div>' : "")
    + (A.ignored && A.ignored.length ? '<div class=dk>The all-Dubai figures are not split by ' + esc(A.ignored.join(" or ")) + "; that filter applies to the building list below.</div>" : "");
}
function topHtml(st, link) {
  return '<div class=fr id=ejtop role=group aria-label="how many">' + TOPS.map((t) => chip(st.top === t, link({ top: String(t) }), "Top " + t)).join("") + "</div>";
}
// a ranked list; the bars scale to the largest in view
function rankHtml(list, st, key, rk, opt) {
  const max = Math.max(1, ...list.map((x) => (opt.metric ? x[opt.metric] : x.n)));
  return list.map((x, i) => {
    const v = opt.metric ? x[opt.metric] : x.n;
    let name, more = "", sub;
    if (opt.where) {
      name = x.district ? '<a href="' + esc(linker(Object.assign({}, st, { kind: "district", id: x.district, d: "" }), key, rk)()) + '">' + esc(x.name) + "</a>" : esc(x.name);
      sub = esc(fmt(x.n) + " in all \u00b7 " + fmt(x.nw) + " new \u00b7 " + fmt(x.rn) + " renewed");
    } else {
      const id = appIdOf(x.key);
      if (id) more = ' \u00b7 <a href="' + esc(bpage(x.district, id, key, rk)) + '">building page \u2197</a> \u00b7 <a href="' + esc(blocks(x.district, id, key, rk)) + '">digital footprint \u2197</a>';
      name = '<a href="' + esc(linker(Object.assign({}, st, { kind: "building", id: x.key, d: id ? "" : x.district }), key, rk)()) + '">' + pname(x.en, x.ar, x.app) + "</a>";
      sub = esc([opt.withDistrict ? x.dname : "", x.no ? "#" + x.no : "", fmt(x.nw) + " new \u00b7 " + fmt(x.rn) + " renewed"].filter(Boolean).join(" \u00b7 "));
    }
    return '<div class=rk><span class=no>' + (i + 1) + '</span><div class=rb><div class=rn>' + name + "</div>"
      + '<div class=br><i style="width:' + Math.max(2, Math.round((v / max) * 100)) + '%"></i></div>'
      + '<div class=rs>' + sub + more + "</div></div>"
      + '<div class=rc>' + fmt(v) + "<small>" + esc(opt.unit || "contracts") + "</small></div></div>";
  }).join("");
}
function answerHtml(A, st, key, rk) {
  const link = linker(st, key, rk);
  const strip = stripHtml(A), bands = table(A.count.bands, "HOME"), subs = A.count.subs.some((s) => s.sub !== "not stated") ? '<div class=hd>BY PROPERTY TYPE</div>' + table(A.count.subs, "TYPE") : "";
  if (A.kind === "building") {
    return '<div class=card id=ejans data-kind=building><div class=kt>BUILDING</div><div class=nm id=ejname>' + (A.appName ? esc(A.appName) : pname(A.en, A.ar)) + "</div>"
      + (A.identity ? '<div class=idn id=ejid>' + [A.en ? esc(A.en) : "", A.ar ? '<span lang=ar dir=rtl>' + esc(A.ar) + "</span>" : "", A.no ? "#" + esc(A.no) : ""].filter(Boolean).join(" \u00b7 ") + "</div>" : "")
      + "<div class=sb>" + esc([A.dname, A.dev].filter(Boolean).join(" \u00b7 ")) + "</div>"
      + headline(A.appName ? esc(A.appName) : pname(A.en, A.ar), A) + strip + bands + subs
      + (A.appId ? '<div class=lk><a href="' + esc(bpage(A.district, A.appId, key, rk)) + '">Building page \u2197</a><a href="' + esc(blocks(A.district, A.appId, key, rk)) + '">See its digital footprint \u2197</a></div>' : "")
      + "</div>";
  }
  if (A.kind === "developer") {
    return '<div class=card id=ejans data-kind=developer><div class=kt>DEVELOPER</div><div class=nm>' + esc(A.name) + "</div><div class=sb>" + esc("Across " + plural(A.projects.length, "building", "buildings") + " that signed contracts in this window") + "</div>"
      + headline(esc(A.name), A) + strip + bands + subs
      + (A.projects.length ? '<div class=hd>BY BUILDING</div><div id=ejproj>' + rankHtml(A.projects, st, key, rk, { withDistrict: true }) + "</div>" : "") + "</div>";
  }
  if (A.kind === "district") {
    const list = A.ranking.slice(0, st.top);
    return '<div class=card id=ejans data-kind=district><div class=kt>DISTRICT</div><div class=nm>' + esc(A.name) + "</div>"
      + headline(esc(A.name), A) + strip + bands + subs
      + (A.ranking.length ? '<div class=hd>MOST LET BUILDINGS<small>flexi-desk licences left out</small></div>' + topHtml(st, link) + '<div id=ejrank>' + rankHtml(list, st, key, rk, {}) + "</div>" : "") + "</div>";
  }
  // all of Dubai: where the new leases are, and the most let buildings, under one Top 5 / 10 / 15 / 20 choice
  const where = A.where.slice(0, st.top), bl = A.buildings.slice(0, st.top);
  return '<div class=card id=ejans data-kind=dubai><div class=kt>ALL OF DUBAI</div><div class=nm>Dubai</div>'
    + headline("Dubai", A) + strip + bands + subs
    + '<div class=hd>SHOW</div>' + topHtml(st, link)
    + (where.length ? '<div class=hd>WHERE THE ' + (A.whereBy === "renewals" ? "RENEWALS" : "NEW LEASES") + ' ARE<small>by district</small></div><div id=ejwhere>' + rankHtml(where, st, key, rk, { where: true, metric: "v", unit: A.whereBy }) + "</div>" : "")
    + (bl.length ? '<div class=hd>MOST LET BUILDINGS<small>flexi-desk licences left out</small></div><div id=ejrank>' + rankHtml(bl, st, key, rk, { withDistrict: true }) + "</div>" : "")
    + "</div>";
}

export function ejariPageHtml(o) {
  const st = o.st, key = o.key || "", rk = o.rk || "", link = linker(st, key, rk);
  let main = "";
  if (o.answer && !o.answer.notFound) main = toggleHtml(st, o.answer, link, key, rk) + filtersHtml(st, o.answer, link) + answerHtml(o.answer, st, key, rk);
  else if (o.answer && o.answer.notFound) main = '<div class=nt id=ejnone>' + esc(o.answer.why) + "</div>";
  else if (o.matches) {
    if (!o.matches.length) main = '<div class=nt id=ejnone>Nothing in the contract record matches \u201c' + esc(st.q) + '\u201d. Try part of the name, the Arabic name, or the project number.</div>';
    else main = '<div class=hd>WHICH ONE?</div><div class=sug id=ejpick>' + o.matches.map((m) => '<a href="' + esc(linker(Object.assign({}, st, { kind: m.kind, id: m.id, d: m.d || "" }), key, rk)()) + '">' + (m.kind === "building" ? pname(m.en, m.ar, m.app) : esc(m.name)) + "<small>" + esc(m.sub) + "</small></a>").join("") + "</div>";
  }
  const boot = { key, rk, range: st.range, basis: st.basis, lang: st.lang };
  return '<!doctype html><html lang=en data-lang=' + (st.lang === "ar" ? "ar" : "en") + '><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">'
    + '<title>Contracts signed \u2014 Najma</title><link rel=icon href=/naj_icon.svg><meta name=theme-color content="#0C1413"><meta name=robots content=noindex>' + (o.fonts || "")
    + "<style>" + EJ_CSS + (o.navCss || "") + "</style></head><body>"
    + '<a class=bk href="/start?' + esc(kq(key, rk)) + '">\u2039 START</a>'
    + '<div class=lng id=ejlang role=group aria-label="names in"><a data-l=en href="' + esc(link({ lang: "en" })) + '">EN</a><a data-l=ar lang=ar href="' + esc(link({ lang: "ar" })) + '">\u0639\u0631\u0628\u064A</a></div>'
    + '<div class=h>Contracts <em>signed</em></div>'
    + '<div class=s>Tenancy contracts registered with Ejari, Dubai\u2019s rent register. Who is letting, and where.</div>'
    + '<div class=srch><form method=get action="/contracts" autocomplete=off><input type=hidden name=key value="' + esc(key) + '">' + (rk ? '<input type=hidden name=rk value="' + esc(rk) + '">' : "")
    + '<input type=hidden name=range value="' + esc(st.range === "custom" ? "week" : st.range) + '"><input class=in id=ejq type=search name=q value="' + esc(st.q) + '" placeholder="building, developer, district or project number" aria-label="search a building, developer, district or project number">'
    + '<button type=submit class=gob>SEARCH</button></form><div class=sug id=ejs role=listbox></div></div>'
    + main
    + '<div class=cav id=ejcav>' + esc(o.answer && !o.answer.notFound ? ejariCaveat(o.answer.basis, o.answer.fellBack) : ejariCaveat(st.basis)) + (o.answer && o.answer.asOf ? " Register as of " + esc(dSay(o.answer.asOf)) + "." : "") + "</div>"
    + "<script>window.__EJ=" + safeJson(boot) + ";</script><script>" + EJARI_JS + "</script>"
    + (o.nav || "") + "</body></html>";
}

// ---- the building page's panel (src/building_page.js draws this inside its FILTERS panel) -----------------------------
// It fetches /contracts_api?panel=1, so the building page itself stays synchronous and reads nothing new.
export function ejariBuildingPanel(slug, id, key, rk) {
  const boot = { k: slug + ":" + id, key: key || "", rk: rk || "" };
  return '<div class=grp>Contracts signed <u>Ejari</u></div><div id=ejp class=src style="font-size:.72rem">Counting the contracts\u2026</div>'
    + "<script>window.__EJP=" + safeJson(boot) + ";</script><script>" + EJARI_PANEL_JS + "</script>";
}

// ---- the routes -----------------------------------------------------------------------------------------------------
// h carries the app's gate and chrome from src/index.js: { clientOk, clientResp, residentsKeyOf, najNav, NAJ_NAV_CSS, NAJ_FONTS }
export async function ejariRoutes(request, env, url, h) {
  if (url.pathname !== "/contracts" && url.pathname !== "/contracts_api") return null;
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("method not allowed", { status: 405 });
  if (!h.clientOk(env, url)) return new Response("unauthorized", { status: 401 });
  const key = url.searchParams.get("key") || "", rk = h.residentsKeyOf(env, url), st = ejariQuery(url.searchParams);
  const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
  if (url.pathname === "/contracts_api") {
    if (url.searchParams.get("index") === "1") return json(await buildIndex(env));
    if (url.searchParams.get("pulse") === "1") return json(await ejariPulse(env, st.basis));
    if (st.kind === "building" && url.searchParams.get("panel") === "1") {
      const out = { ok: true };
      for (const w of [["d7", "week"], ["d30", "month"]]) {
        const A = await ejariAnswer(env, Object.assign({}, st, { range: w[1], reg: "both", beds: [], sub: [] }));
        if (!A || A.notFound) return json({ ok: false, why: A ? A.why : "" });
        out.name = A.name; out.identity = A.identity; out.as_of = A.asOf; out.basis = A.basis;
        out[w[0]] = { from: A.from, to: A.to, n: A.count.n, nw: A.count.nw, rn: A.count.rn, desk: A.count.desk, bands: A.count.bands.map((b) => ({ band: b.band, label: b.label, n: b.n })) };
      }
      out.see = "/contracts?kind=building&id=" + encodeURIComponent(st.id) + "&range=month" + (out.basis === "start" ? "&basis=start" : "") + "&" + kq(key, rk);
      return json(out);
    }
    if (!st.kind) return json({ ok: false, why: "say kind=building|developer|district|dubai and id" }, 400);
    const A = await ejariAnswer(env, st);
    if (!A || A.notFound) return json({ ok: false, why: A ? A.why : "" }, 404);
    return json(Object.assign({ ok: true }, A));
  }
  let answer = null, matches = null;
  if (st.kind && st.id) answer = await ejariAnswer(env, st);
  else if (st.q) {
    matches = ejariMatch(await buildIndex(env), st.q);
    // one clear best match: answer it straight away; otherwise ask which one
    if (matches.length && (matches.length === 1 || matches[0].s > matches[1].s + 15)) {
      const m = matches[0]; Object.assign(st, { kind: m.kind, id: m.id, d: m.d || "" });
      answer = await ejariAnswer(env, st); matches = null;
    }
  } else { st.kind = "dubai"; st.id = "dubai"; answer = await ejariAnswer(env, st); }   // no subject: all of Dubai
  const html = ejariPageHtml({ st, key, rk, answer, matches, nav: h.najNav(key, "start", rk), navCss: h.NAJ_NAV_CSS, fonts: h.NAJ_FONTS });
  return h.clientResp(env, url, html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}

// ---- the page script: suggestions as you type, from /contracts_api?index=1 ---------------------------------------------
// Plain ES5, no ${} and no backticks. The same matching as ejariMatch: app name, English name, Arabic name, project number.
export const EJARI_JS = String.raw`
(function(){
var B=window.__EJ||{};var KEY=B.key||"",RKQ=B.rk?"&rk="+encodeURIComponent(B.rk):"";
var inp=document.getElementById("ejq"),box=document.getElementById("ejs");
// EN / AR project names: a link's lang wins and is remembered; otherwise this viewer's remembered choice (browser storage only)
var LS="najma_ejari_lang";
function lang(){return document.documentElement.getAttribute("data-lang")==="ar"?"ar":"en"}
function setLang(l,save){document.documentElement.setAttribute("data-lang",l==="ar"?"ar":"en");if(save){try{localStorage.setItem(LS,l)}catch(e){}}if(box&&box.innerHTML&&IDX)draw()}
if(B.lang){try{localStorage.setItem(LS,B.lang)}catch(e){}}else{var SV=null;try{SV=localStorage.getItem(LS)}catch(e){}if(SV==="ar"||SV==="en")setLang(SV,false)}
var LG=document.getElementById("ejlang");if(LG){var LA=LG.getElementsByTagName("a");for(var li=0;li<LA.length;li++)LA[li].onclick=function(ev){if(ev&&ev.preventDefault)ev.preventDefault();setLang(this.getAttribute("data-l"),true);return false}}
if(!inp||!box)return;
var IDX=null,LOADING=false,T=null;
var FOLD={"\u0623":"\u0627","\u0625":"\u0627","\u0622":"\u0627","\u0629":"\u0647","\u0649":"\u064A","\u0624":"\u0648","\u0626":"\u064A"};
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function norm(s){return String(s||"").toLowerCase().replace(/[\u064B-\u0652\u0640]/g,"").replace(/[\u0623\u0625\u0622\u0629\u0649\u0624\u0626]/g,function(c){return FOLD[c]}).replace(/[^a-z0-9\u0621-\u064A]+/g," ").replace(/^\s+|\s+$/g,"")}
function score(q,n,e){n=norm(n);e=norm(e||"");if(!n)return 0;if(n===q)return 100;if(n.indexOf(q)===0)return 60;if((" "+n).indexOf(" "+q)>=0||(e&&(" "+e+" ").indexOf(" "+q+" ")>=0))return 40;if(n.indexOf(q)>=0)return 20;return 0}
function href(kind,id,d){return "/contracts?kind="+kind+(kind==="dubai"?"":"&id="+encodeURIComponent(id))+(d?"&d="+encodeURIComponent(d):"")+"&range="+encodeURIComponent(B.range==="custom"?"week":(B.range||"week"))+(B.basis==="start"?"&basis=start":"")+"&key="+encodeURIComponent(KEY)+RKQ}
function load(cb){if(IDX)return cb();if(LOADING)return;LOADING=true;box.innerHTML="<div class=sx>Looking\u2026</div>";
  fetch("/contracts_api?index=1&key="+encodeURIComponent(KEY)+RKQ,{credentials:"same-origin"}).then(function(r){if(!r.ok)throw r.status;return r.json()}).then(function(j){LOADING=false;IDX=(j&&j.ok)?j:{b:[],v:[],d:[]};cb()},
  function(){LOADING=false;box.innerHTML="<div class=sx>Suggestions did not load. Type the name and press SEARCH.</div>"})}
function find(text){var raw=String(text||"").replace(/^\s+|\s+$/g,""),q=norm(raw),no=/^#?\s*(\d{1,7})$/.exec(raw),out=[],i,x,s;
  if(!q||(q.length<2&&!no))return out;
  for(i=0;i<IDX.d.length;i++){x=IDX.d[i];s=score(q,x[1],x[0]+" "+(x[2]||""));if(s)out.push({s:s+3,h:href(x[0]==="dubai"?"dubai":"district",x[0]),n:x[1],t:x[0]==="dubai"?"Every district":"District"})}
  for(i=0;i<IDX.v.length;i++){x=IDX.v[i];s=score(q,x[1]);if(s)out.push({s:s+1,h:href("developer",x[0]),n:x[1],t:"Developer"})}
  for(i=0;i<IDX.b.length;i++){x=IDX.b[i];s=Math.max(score(q,x[1]),score(q,x[4]),score(q,x[5]));if(no&&x[6]===no[1])s=100;
    var ar=lang()==="ar",nm=ar?(x[5]||x[1]):(x[1]!==x[5]||!x[5]?x[1]:x[5]),only=ar&&!x[5]?" \u00b7 EN only":(!ar&&!x[4]&&x[5]&&x[1]===x[5]?" \u00b7 AR only":"");
    if(s)out.push({s:s,h:href("building",x[0],x[0].indexOf("dld:")===0?x[2]:""),n:nm,t:"Building \u00b7 "+x[3]+(x[6]?" \u00b7 #"+x[6]:"")+only})}
  out.sort(function(a,b){return b.s-a.s||(a.n<b.n?-1:1)});return out.slice(0,8)}
function draw(){var raw=inp.value;if(norm(raw).length<2&&!/^#?\s*\d+$/.test(raw.replace(/^\s+|\s+$/g,""))){box.innerHTML="";return}
  load(function(){var out=find(inp.value);
    box.innerHTML=out.length?out.map(function(o){return "<a href=\""+esc(o.h)+"\">"+esc(o.n)+"<small>"+esc(o.t)+"</small></a>"}).join(""):"<div class=sx>Nothing by that name in the contract record. Press SEARCH to look wider.</div>"})}
inp.oninput=function(){clearTimeout(T);T=setTimeout(draw,120)};
inp.onfocus=function(){load(function(){draw()})};
window.__ejari={draw:draw,find:function(t){return IDX?find(t):null},index:function(){return IDX}};
})();
`;

// the START card's mini chart: seven bars of new leases, all of Dubai, with the Day / Week / Month toggle and district chips.
// Nothing is drawn until the pulse answers with data; with none, the card stays the search box alone.
export const EJARI_START_JS = String.raw`
(function(){
var P=window.__EJS||{},wrap=document.getElementById("ejpulse"),seg=document.getElementById("ejseg"),sp=document.getElementById("ejspark"),ch=document.getElementById("ejchips"),sub=document.getElementById("ejsub");
if(!wrap||!seg||!sp||!ch)return;
var bas=document.getElementById("ejbas"),D={},BAS="filed",M="day",FELL=false,KQ="key="+encodeURIComponent(P.key||"")+(P.rk?"&rk="+encodeURIComponent(P.rk):"");
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function n(v){return Math.round(v||0).toLocaleString("en-US")}
function vs(w,what){if(w.pct==null)return "";return " \u00b7 "+(w.pct>0?"up "+w.pct+"%":(w.pct<0?"down "+(-w.pct)+"%":"level"))+" on "+what}
function marks(box,attr,v){var bs=box?box.getElementsByTagName("button"):[];for(var i=0;i<bs.length;i++)bs[i].className=bs[i].getAttribute(attr)===v?"on":""}
function draw(){
  marks(seg,"data-m",M);marks(bas,"data-b",BAS);
  var J=D[BAS];if(!J||!J.ok||!J[M]){wrap.hidden=true;return}
  var w=J[M],k,max=1,bq=J.basis==="start"?"&basis=start":"";
  sub.textContent=n(w.n)+(w.n===1?" new lease ":" new leases ")+(J.basis==="start"?"starting ":"filed ")+(M==="day"?J.when:(M==="week"?"in the last 7 days":"in the last 30 days"))+vs(w,M==="day"?"the 7-day average":(M==="week"?"the week before":"the 30 days before"));
  for(k=0;k<w.bars.length;k++)if(w.bars[k].n>max)max=w.bars[k].n;
  sp.innerHTML=w.bars.map(function(b){return "<i style=\"height:"+Math.max(4,Math.round(b.n/max*100))+"%\" title=\""+esc(b.to+": "+b.n)+"\"></i>"}).join("");
  ch.innerHTML=w.where.map(function(d){return "<a class=chip href=\"/contracts?kind=district&id="+encodeURIComponent(d[0])+"&range="+M+bq+"&"+KQ+"\">"+esc(d[1])+" <b>"+n(d[2])+"</b></a>"}).join("")
    +"<a class=chip href=\"/contracts?kind=dubai&range="+M+bq+"&"+KQ+"\">All of Dubai <b>\u2192</b></a>";
  wrap.hidden=false}
// FILED by default; the filed file missing falls back to contract start, and the Filed switch is then shown as not loaded
function load(b){if(D[b])return draw();
  fetch("/contracts_api?pulse=1&basis="+b+"&"+KQ,{credentials:"same-origin"}).then(function(r){return r.ok?r.json():{ok:false}}).then(function(j){j=j||{ok:false};
    if(j.ok&&j.basis!==b){FELL=true;D.start=j;BAS="start";var f=bas&&bas.querySelector("button[data-b=filed]");if(f){f.disabled=true;f.title="Filing dates are not loaded yet"}}else D[b]=j;draw()},function(){D[b]={ok:false};draw()})}
var bs=seg.getElementsByTagName("button");for(var i=0;i<bs.length;i++)bs[i].onclick=function(){M=this.getAttribute("data-m");draw()};
var bb=bas?bas.getElementsByTagName("button"):[];for(var j=0;j<bb.length;j++)bb[j].onclick=function(){if(this.disabled)return;BAS=this.getAttribute("data-b");load(BAS)};
load("filed");
window.__ejstart={mode:function(m){M=m;draw()},basis:function(b){BAS=b;load(b)},data:function(){return D[BAS]},fell:function(){return FELL}};
})();
`;

// the building page's panel script: 7 and 30 days, by bedroom, New vs Renewed, and "see all"
export const EJARI_PANEL_JS = String.raw`
(function(){
var P=window.__EJP||{},el=document.getElementById("ejp");if(!el)return;
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function noAr(s){var t=String(s==null?"":s),R=/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g;if(!R.test(t))return t;t=t.replace(R,"").replace(/(\s*[\u00b7|,\/]\s*){2,}/g," \u00b7 ").replace(/^[\s\u00b7|,\/-]+|[\s\u00b7|,\/-]+$/g,"").replace(/\s{2,}/g," ");return t||"name in Arabic on the register"}
function n(v){return Math.round(v||0).toLocaleString("en-US")}
var RKQ=P.rk?"&rk="+encodeURIComponent(P.rk):"";
fetch("/contracts_api?kind=building&panel=1&id="+encodeURIComponent(P.k)+"&key="+encodeURIComponent(P.key)+RKQ,{credentials:"same-origin"}).then(function(r){return r.json()}).then(function(j){
  if(!j||!j.ok){el.innerHTML="No Ejari contracts on record for this building in the last 30 days.";return}
  var w7=j.d7,w30=j.d30;
  el.innerHTML=(j.identity?"<div style=\"color:#C5A56A\">"+esc(noAr(j.identity))+"</div>":"")
    +"<div class=letn><b>"+n(w7.n)+"</b> in the last 7 days \u00b7 <b>"+n(w30.n)+"</b> in 30</div>"
    +"<div class=lett>Last 30 days: "+n(w30.nw)+" new \u00b7 "+n(w30.rn)+" renewed"+(w30.bands.length?"<br>"+w30.bands.map(function(b){return esc(b.label.toLowerCase())+" "+n(b.n)}).join(" \u00b7 "):"")+"</div>"
    +(w30.desk?"<div class=lett>Plus "+n(w30.desk)+" flexi-desk licences, not counted.</div>":"")
    +"<div style=\"margin-top:5px\">Counted by "+(j.basis==="filed"?"the day each was filed with Ejari":"contract start date")+", to "+esc(j.as_of)+". <a href=\""+esc(j.see)+"\" style=\"color:#C5A56A\">see all \u2192</a></div>"},
  function(){el.innerHTML="The contract count could not be loaded just now."});
})();
`;
