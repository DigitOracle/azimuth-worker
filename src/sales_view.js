// SALES ON THE CONTRACTS-SIGNED PAGE (v396, Kendall, 7 Oct 2026).
//
// "When we go into Contracts signed we are only looking at rentals. Why don't we have both? We have access to both, so we should be
// able to say Imtiaz, rentals AND sales for a particular week."
//
// src/ejari_page.js is the Ejari (rent) page. This module is the SALES half, with the smallest possible hooks in that page:
//   - the readers for img_sales_filed_<district> and img_sales_filed_dubai (built by scripts/build_sales_filed.py, published by
//     scripts/publish_sales_filed.py - Kendall's);
//   - salesAnswer(): the same subject (building / developer / district / all of Dubai) and the same window as the rentals answer,
//     counted from the Land Department's registered sales;
//   - the HTML: the Rentals | Sales | Both switch, the one-sentence headline, the two-colour daily chart, the tables.
// It imports nothing from ejari_page.js (that page imports this one); the page hands in the few helpers it shares.
//
// WHAT A SALE IS. A registered sale of ONE unit: the procedure 'Sale' (a finished unit) or 'Sell - Pre registration' (the off-plan
// registration), by the day the Land Department registered it. Plots (kind land) and mortgages (kind mortgage) are separate counters
// and are never in sales; they appear only as the small line "Also registered: N mortgages, M plot sales". For off-plan, a first sale
// and a resale cannot be told apart in this feed, and the page says so.
//
// NO FALSE ZERO (v394 rules, kept): a filter on a field the data mostly lacks never prints 0 over sales that exist - bedrooms are
// offered only where at least COVERAGE_MIN of the sales record one, and "0 match this filter; N were registered" says what happened.
// Absent files: salesAnswer returns null and the page is the v395 page, Rentals only, no switch.
import { COVERAGE_MIN, coverageOf, pctSay } from "./coverage_guard.js";

export const SALES_KV = { district: (d) => "img_sales_filed_" + d, dubai: "img_sales_filed_dubai" };
export const VIEWS = ["rentals", "sales", "both"];
export const VALUE_CAP = 500e6;          // v440: single deals above this are left out of the total value
export const MIN_PRICED = 5;            // a median is printed from five priced sales, never from fewer
const BANDS = ["studio", "1", "2", "3", "3+", "office", "shop", "other"];
const BAND_SAY = { studio: "Studio", "1": "1 bedroom", "2": "2 bedrooms", "3": "3 bedrooms", "3+": "4 bedrooms or more", office: "Office", shop: "Shop", other: "Other or not stated" };
const BAND_IN = { studio: "studio", "0": "studio", "1": "1", "2": "2", "3": "3", "3+": "3+", "4": "3+", office: "office", shop: "shop", retail: "shop", other: "other" };
const RES_BANDS = new Set(["studio", "1", "2", "3", "3+"]);
const STAGE_SAY = { offplan: "Off-plan", ready: "Ready" };

// ---- small helpers (the page's own, repeated here so this module stands alone) ---------------------------------------------
const present = (v) => v !== undefined && v !== null && !(typeof v === "string" && v.trim() === "");
const str = (v) => present(v) ? String(v).replace(/\s+/g, " ").trim() : "";
const num = (v) => { if (!present(v)) return null; const n = Number(v); return isFinite(n) ? n : null; };
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const DAY = 86400000;
const dms = (s) => Date.parse(String(s).slice(0, 10) + "T00:00:00Z");
const dstr = (ms) => new Date(ms).toISOString().slice(0, 10);
const addD = (s, n) => dstr(dms(s) + n * DAY);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dSay = (s, noYear) => { const d = new Date(dms(s)); return d.getUTCDate() + " " + MON[d.getUTCMonth()] + (noYear ? "" : " " + d.getUTCFullYear()); };
const fmt = (n) => Math.round(n || 0).toLocaleString("en-US");
const aed = (v) => v == null ? "—" : (v >= 1e6 ? "AED " + (v / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M" : "AED " + Math.round(v / 1e3) + "k");
const aedSqm = (v) => v == null ? "—" : "AED " + fmt(v);
const plural = (n, one, many) => fmt(n) + " " + (n === 1 ? one : many);
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9ء-ي]+/g, " ").trim();
const nk = (v) => String(v || "").toUpperCase().replace(/\s+/g, " ").trim();
const period = (from, to) => from === to ? "on " + dSay(to) : "between " + dSay(from, from.slice(0, 4) === to.slice(0, 4)) + " and " + dSay(to);

// ---- the files --------------------------------------------------------------------------------------------------------------
// one row of a district file (objects) or of the Dubai-wide files (arrays in the order of `fields`), into the names this module uses
export function salesRow(raw, fields) {
  let o = raw;
  if (Array.isArray(raw)) { o = {}; (fields || []).forEach((f, i) => { o[f] = raw[i]; }); }
  if (!o || typeof o !== "object") return null;
  const date = str(o.date).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const kind = o.kind === "land" || o.kind === "mortgage" ? o.kind : "sale";
  const bandRaw = o.beds;
  const prices = Array.isArray(o.prices) && o.prices.length ? o.prices : null, psm = Array.isArray(o.psm) && o.psm.length ? o.psm : null;
  const project = str(o.dld_project), key = str(o.key) || (project ? "dld:" + project.toLowerCase().replace(/[^a-z0-9]/g, "") : "");
  return {
    date, kind, district: str(o.district).toLowerCase(), area: str(o.area), project, projectAr: str(o.project_name_ar), projectNo: str(o.dld_project_number),
    key, devNo: str(o.developer_number), dev: str(o.developer), attr: str(o.attribution),
    stage: o.stage === "offplan" || o.stage === "ready" ? o.stage : "", band: BAND_IN[str(bandRaw).toLowerCase()] || "other", bandKnown: present(bandRaw),
    sub: str(o.sub_type) || null, n: Math.max(0, num(o.sales) || 0), pn: prices ? prices.length : (num(o.price_n) || 0),
    prices, psm, med: num(o.price_median), psmMed: num(o.psm_median),
    // v440 - total value: the sum of the priced sales (from the single prices where the file carries them, else the row's own sum); a deal over
    // AED 500M (a whole tower, a land bank) is left out so one transaction cannot swamp the total. null = this file carries no value.
    val: prices ? prices.reduce((s, p) => s + (p <= VALUE_CAP ? p : 0), 0) : num(o.price_sum), big: prices ? prices.filter((p) => p > VALUE_CAP).length : 0
  };
}
export function salesDoc(doc, part) {
  if (!doc || typeof doc !== "object") return null;
  const src = part ? doc[part] : doc;
  if (!src || !Array.isArray(src.rows)) return null;
  const rows = src.rows.map((r) => salesRow(r, src.fields || doc.fields)).filter(Boolean);
  let asOf = str(doc.as_of).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) asOf = rows.reduce((m, r) => (r.date > m ? r.date : m), "");
  const first = rows.reduce((m, r) => (!m || r.date < m ? r.date : m), "");
  return { district: str(doc.district).toLowerCase(), asOf, first, source: doc.source || "", rows };
}
// the developer rows of the Dubai-wide file: {date, area, district, devNo, dev, stage, n}
function devDoc(doc) {
  const src = doc && doc.per_developer;
  if (!src || !Array.isArray(src.rows)) return [];
  return src.rows.map((a) => { const o = {}; (src.fields || []).forEach((f, i) => { o[f] = a[i]; }); return { date: str(o.date).slice(0, 10), area: str(o.area), district: str(o.district).toLowerCase(), devNo: str(o.developer_number), dev: str(o.developer), stage: str(o.stage), n: num(o.sales) || 0 }; }).filter((r) => r.date);
}
// the suggestion index adds the buildings and developers that have sales and no rentals (KORE by Imtiaz, Chelsea Residences): [{key,en,ar,no,district}]
export async function salesIndexData(raw) {
  const d = await raw(SALES_KV.dubai);
  const out = { projects: [], devs: [] };
  if (!d || typeof d !== "object") return out;
  const p = d.projects;
  if (p && Array.isArray(p.rows)) for (const a of p.rows) { const o = {}; (p.fields || []).forEach((f, i) => { o[f] = a[i]; }); if (o.key && o.district) out.projects.push({ key: String(o.key), en: str(o.name), ar: str(o.name_ar), no: str(o.project_number), district: String(o.district).toLowerCase() }); }
  const seen = new Map();
  for (const r of devDoc(d)) { if (!r.devNo || !r.dev) continue; const x = seen.get(r.devNo) || { no: r.devNo, name: r.dev, ds: new Set() }; if (r.district) x.ds.add(r.district); seen.set(r.devNo, x); }
  out.devs = [...seen.values()].map((x) => ({ no: x.no, name: x.name, ds: [...x.ds] }));
  return out;
}

// ---- the window --------------------------------------------------------------------------------------------------------------
// The rentals window is A.from..A.to. Sales are registered to their own latest day (asOf), which can lag the rentals by a day, so the
// sales window is the same dates clamped to it; when the whole window is later than the sales record the window slides back to end on
// the sales' latest day. The comparison uses the same number of days before it, so a short week is never set against a full one.
export function salesWindow(st, A, asOf) {
  const len = Math.round((dms(A.to) - dms(A.from)) / DAY) + 1;
  let from = A.from, to = A.to, lag = false, slid = false;
  if (asOf && to > asOf) { lag = true; to = asOf; if (from > to) { slid = true; from = addD(to, -(len - 1)); } }
  const n = Math.round((dms(to) - dms(from)) / DAY) + 1;
  let prev = null;
  if (st.range === "day") prev = { from: addD(from, -7), to: addD(from, -1), days: 7, avg: true };
  else if (st.range === "week" || st.range === "month") { const d = lag && !slid ? n : (st.range === "week" ? 7 : 30); prev = { from: addD(from, -d), to: addD(from, -1), days: d }; }
  return { from, to, prev, lag, slid, days: n };
}

// ---- counting ------------------------------------------------------------------------------------------------------------------
const expandBeds = (beds) => { const s = new Set(beds || []); if (s.has("3+")) s.add("3"); return s; };   // the rentals chip "3+" means 3 or more
function keepSale(st, from, to, noBeds) {
  const bs = noBeds || !(st.beds && st.beds.length) ? null : expandBeds(st.beds);
  return (r) => r.date >= from && r.date <= to && (!bs || bs.has(r.band));
}
function quant(sorted, p) {
  const k = (sorted.length - 1) * p, f = Math.floor(k), c = Math.min(f + 1, sorted.length - 1);
  return sorted[f] + (sorted[c] - sorted[f]) * (k - f);
}
// the middle of the recorded prices: the exact median from the sales themselves (district, building, developer files carry them);
// the Dubai-wide file carries each row's own median where it had five, so there it is the middle of those, weighted by sales
function stats(rows, arrF, medF) {
  let arr = [], pairs = [], pairsN = 0;
  for (const r of rows) {
    if (r[arrF]) { for (let i = 0; i < r[arrF].length; i++) arr.push(r[arrF][i]); }
    else if (r[medF] != null && r.pn > 0) { pairs.push([r[medF], r.pn]); pairsN += r.pn; }
  }
  if (arr.length >= MIN_PRICED) { arr.sort((a, b) => a - b); return { n: arr.length, median: Math.round(quant(arr, .5)), q1: Math.round(quant(arr, .25)), q3: Math.round(quant(arr, .75)) }; }
  if (!arr.length && pairsN >= MIN_PRICED) {
    pairs.sort((a, b) => a[0] - b[0]); let c = 0, m = pairs[pairs.length - 1][0]; for (const x of pairs) { c += x[1]; if (c >= pairsN / 2) { m = x[0]; break; } }
    return { n: pairsN, median: m, q1: null, q3: null, approx: true };
  }
  return { n: arr.length + pairsN, median: null, q1: null, q3: null };
}
// v440 - the total value of the sales in the window: the same rows as the count, so it moves with every date range, filter and area.
// null when a priced row carries no value (a file built before v440): never a partial total shown as if it were whole.
export function valueOf(rows) {
  let v = 0, big = 0;
  for (const r of rows) { if (r.pn > 0 && r.val == null) return null; v += r.val || 0; big += r.big || 0; }
  return { sum: v, big };
}
export function salesCount(rows) {
  const t = { n: 0, off: 0, rdy: 0 }, days = {}, bandRows = {}, stageRows = { offplan: [], ready: [] };
  const sales = rows.filter((r) => r.kind === "sale");
  for (const r of sales) {
    t.n += r.n; if (r.stage === "offplan") t.off += r.n; else t.rdy += r.n;
    const d = days[r.date] || (days[r.date] = { o: 0, r: 0 }); if (r.stage === "offplan") d.o += r.n; else d.r += r.n;
    (bandRows[r.band] || (bandRows[r.band] = [])).push(r);
    (r.stage === "offplan" ? stageRows.offplan : stageRows.ready).push(r);
  }
  const sum = (a) => a.reduce((s, r) => s + r.n, 0);
  t.bands = BANDS.filter((b) => bandRows[b]).map((b) => ({ band: b, label: BAND_SAY[b], n: sum(bandRows[b]), price: stats(bandRows[b], "prices", "med"), psm: stats(bandRows[b], "psm", "psmMed"), value: valueOf(bandRows[b]) }));
  t.stages = ["offplan", "ready"].filter((k) => stageRows[k].length).map((k) => ({ stage: k, label: STAGE_SAY[k], n: sum(stageRows[k]), price: stats(stageRows[k], "prices", "med"), psm: stats(stageRows[k], "psm", "psmMed"), value: valueOf(stageRows[k]) }));
  t.price = stats(sales, "prices", "med"); t.psm = stats(sales, "psm", "psmMed"); t.value = valueOf(sales);
  t.days = days;
  t.mort = sum(rows.filter((r) => r.kind === "mortgage")); t.land = sum(rows.filter((r) => r.kind === "land"));
  const at = { RV: 0, NAME: 0, NONE: 0 };
  for (const r of sales) at[r.attr === "REGISTER_VERIFIED" ? "RV" : r.attr === "NAME_ONLY" ? "NAME" : "NONE"] += r.n;
  t.attr = at;
  return t;
}
function projectsOf(rows, names) {
  const g = new Map();
  for (const r of rows) {
    const k = r.key || (r.project ? "dld:" + norm(r.project) : ""); if (!k) continue;
    const x = g.get(k) || { key: k, en: r.project, ar: r.projectAr, no: r.projectNo, district: r.district, dname: (names && names[r.district]) || r.area || r.district, dev: r.dev, n: 0, off: 0, rdy: 0, land: 0, mort: 0 };
    if (r.kind === "sale") { x.n += r.n; if (r.stage === "offplan") x.off += r.n; else x.rdy += r.n; } else if (r.kind === "land") x.land += r.n; else x.mort += r.n;
    if (!x.en && r.project) x.en = r.project; if (!x.ar && r.projectAr) x.ar = r.projectAr; if (!x.no && r.projectNo) x.no = r.projectNo;
    g.set(k, x);
  }
  return [...g.values()].filter((x) => x.n > 0 || x.land > 0 || x.mort > 0).sort((a, b) => b.n - a.n || (a.en || "").localeCompare(b.en || ""));
}

// ---- the answer ----------------------------------------------------------------------------------------------------------------
// raw(key) -> parsed JSON or null (the page's memoised, gzip-aware reader); A = the rentals answer (its subject and window); names = district names.
// null when this place has no sales file and neither has Dubai: the caller then draws the v395 page.
export async function salesAnswer(raw, st, A, names) {
  if (!A || A.notFound || !A.from) return null;
  let rows = null, asOf = "", first = "", devExtra = null, missing = "", devAll = null, dub0 = null;
  const sub = { kind: A.kind, name: A.name };
  if (A.kind === "building" || A.kind === "district") {
    const slug = A.district || "";
    const d = slug ? salesDoc(await raw(SALES_KV.district(slug))) : null;
    if (d) { rows = d.rows; asOf = d.asOf; first = d.first; }
    else {
      const dub = salesDoc(await raw(SALES_KV.dubai), "per_area");
      if (!dub) return null;
      asOf = dub.asOf; first = dub.first; missing = "No sales are loaded for " + ((names && names[slug]) || A.dname || slug || "this place") + " yet.";
    }
    if (rows && A.kind === "building") {
      const no = A.no || "", en = norm(A.en || A.name || "");
      rows = rows.filter((r) => r.key === A.id || (no && r.projectNo === no) || (en && norm(r.project) === en));
    }
  } else if (A.kind === "developer") {
    const dub = await raw(SALES_KV.dubai);
    const dd = salesDoc(dub, "per_area");
    if (!dd) return null;
    asOf = dd.asOf; first = dd.first;
    const dev = devDoc(dub), name = nk(A.name), id = String(A.id);
    const g = A.group;   // a developer group (all the registered companies of one brand): the rentals answer names its members
    const mine = g ? (r) => (r.devNo ? g.ids.indexOf(r.devNo) >= 0 : g.names.indexOf(nk(r.dev)) >= 0) : (r) => (r.devNo ? r.devNo === id : !!name && nk(r.dev) === name);
    const slugs = new Map(); let unmapped = 0, unmappedPrev = 0;
    const w = salesWindow(st, A, asOf), lo = w.prev ? w.prev.from : w.from;
    for (const r of dev) { if (!mine(r) || r.date < lo || r.date > w.to) continue; if (r.district) slugs.set(r.district, (slugs.get(r.district) || 0) + r.n); else if (r.date >= w.from) unmapped += r.n; else unmappedPrev += r.n; }
    const top = [...slugs.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 25).map((x) => x[0]);
    const word = g ? String(id).slice(6) : norm(A.name).split(" ")[0];
    // the districts whose projects carry the brand word with no developer recorded are read too (for the separate line only)
    const bd = new Set(); const pj = dub && dub.projects;
    if (word && word.length >= 4 && pj && Array.isArray(pj.rows)) { const fi = (n) => (pj.fields || []).indexOf(n); for (const a of pj.rows) if (a[fi("developer")] == null && (" " + norm(a[fi("name")]) + " ").indexOf(" " + word + " ") >= 0 && a[fi("district")]) bd.add(String(a[fi("district")]).toLowerCase()); }
    const dists = [...new Set(top.concat([...bd]))];
    const filesAll = (await Promise.all(dists.map(async (s) => salesDoc(await raw(SALES_KV.district(s)))))).filter(Boolean);
    const files = filesAll.filter((f) => !f.district || top.indexOf(f.district) >= 0);
    rows = []; for (const f of files) for (const r of f.rows) if (mine(r)) rows.push(r);
    // sales whose project name carries the brand word but whose developer the register does not record: shown on their own line, never in the counts
    const brandRows = [];
    if (word && word.length >= 4) for (const f of filesAll) for (const r of f.rows) if (r.kind === "sale" && !r.dev && !r.devNo && (" " + norm(r.project) + " ").indexOf(" " + word + " ") >= 0) brandRows.push(r);
    devExtra = { unmapped, districts: top.length, word, brandRows };
    if (files.length) first = files.reduce((m, f) => (!m || f.first < m ? f.first : m), "");
  } else if (A.kind === "dubai") {
    dub0 = await raw(SALES_KV.dubai);
    const dd = salesDoc(dub0, "per_area");
    if (!dd) return null;
    rows = dd.rows; asOf = dd.asOf; first = dd.first;
    devAll = devDoc(dub0);
  } else return null;

  const w = salesWindow(st, A, asOf);
  const S = Object.assign(sub, { ok: true, asOf, first, from: w.from, to: w.to, lag: w.lag, slid: w.slid, days: w.days, missing, ignored: [] });
  if (missing) { S.n = 0; S.count = salesCount([]); S.allN = 0; return S; }
  const hasBed = (r) => RES_BANDS.has(r.band);
  const win = rows.filter(keepSale(st, w.from, w.to, true)).filter((r) => r.kind === "sale");
  const share = coverageOf(win, (r) => hasBed(r) || null), bedsOk = share === null || share >= COVERAGE_MIN;
  const effBeds = bedsOk ? (st.beds || []) : [], stE = Object.assign({}, st, { beds: effBeds });
  const inWin = rows.filter(keepSale(stE, w.from, w.to));
  // mortgages and plots carry no bedroom: they are counted for the place whatever the bedroom filter says
  const alsoRows = rows.filter(keepSale(st, w.from, w.to, true)).filter((r) => r.kind !== "sale");
  const count = salesCount(inWin.filter((r) => r.kind === "sale").concat(alsoRows));
  const sum = (a) => a.reduce((t, r) => t + r.n, 0);
  S.count = count; S.n = count.n;
  S.beds = { ok: bedsOk, share, min: COVERAGE_MIN, active: effBeds, ignored: bedsOk ? [] : (st.beds || []), windowN: sum(win), unknownN: sum(win.filter((r) => !hasBed(r))) };
  S.allN = sum(win);
  S.short = !!(first && first > w.from);
  if (w.prev) {
    if (!first || first > w.prev.from) S.cmp = { missing: true, days: w.prev.days, avg: !!w.prev.avg };
    else {
      const p = sum(rows.filter(keepSale(stE, w.prev.from, w.prev.to)).filter((r) => r.kind === "sale")), base = w.prev.avg ? p / w.prev.days : p;
      S.cmp = { n: p, base, pct: base > 0 ? Math.round(((count.n - base) / base) * 100) : null, days: w.prev.days, avg: !!w.prev.avg, from: w.prev.from, to: w.prev.to };
    }
  } else S.cmp = null;
  if (devAll) {   // the share of the window's sales that have a developer recorded, from the per_developer rows (all areas)
    const rec = devAll.filter((r) => r.date >= w.from && r.date <= w.to).reduce((t, r) => t + r.n, 0);
    S.devShare = S.allN > 0 ? Math.min(1, rec / S.allN) : null;
  }
  if (devExtra) {
    const br = devExtra.brandRows.filter(keepSale(stE, w.from, w.to));
    S.dev = { unmapped: devExtra.unmapped, districts: devExtra.districts };
    S.brand = { word: devExtra.word ? devExtra.word.charAt(0).toUpperCase() + devExtra.word.slice(1) : "", n: sum(br) };
  }
  const sale = inWin.filter((r) => r.kind === "sale");
  if (A.kind === "developer" || A.kind === "district") S.projects = projectsOf(inWin.concat(alsoRows), names).slice(0, 60);
  if (A.kind === "developer" || A.kind === "dubai") {
    const g = new Map();
    for (const r of sale) { const k = A.kind === "dubai" ? (r.district || ("area:" + r.area)) : r.area; if (!k) continue; const x = g.get(k) || { k, area: r.area, name: (names && names[r.district]) || r.area || r.district, district: r.district, n: 0 }; x.n += r.n; g.set(k, x); }
    S.areas = [...g.values()].sort((a, b) => b.n - a.n || String(a.area).localeCompare(String(b.area))).slice(0, 30);
  }
  Object.defineProperty(S, "_rows", { value: rows, enumerable: false });
  Object.defineProperty(S, "_win", { value: (f, t) => rows.filter(keepSale(stE, f, t)).filter((r) => r.kind === "sale"), enumerable: false });
  return S;
}

// the sales-only stand-in for a building the rentals know nothing about (KORE by Imtiaz): a rentals-shaped answer with no contracts
export async function salesOnlyBuilding(raw, st, id, d, names, rangeOf) {
  const slug = id.indexOf("dld:") === 0 ? d : id.split(":")[0];
  if (!slug) return null;
  const doc = salesDoc(await raw(SALES_KV.district(slug)));
  if (!doc) return null;
  const mine = doc.rows.filter((r) => r.key === id);
  if (!mine.length) return null;
  const last = mine.reduce((a, r) => (r.date > a.date ? r : a), mine[0]);
  const rg = rangeOf(doc.asOf);
  const dev = mine.find((r) => r.dev) || last;
  return { kind: "building", id, name: last.project || id, appName: null, identity: [last.project, last.projectNo ? "#" + last.projectNo : ""].filter(Boolean).join(" · "), en: last.project, ar: last.projectAr, no: last.projectNo,
    district: slug, dname: (names && names[slug]) || last.area || slug, dev: dev.dev || "", devNo: dev.devNo, appId: null, basis: "filed", fellBack: false, asOf: doc.asOf, from: rg.from, to: rg.to, range: st.range,
    short: false, noRentals: true, count: { n: 0, nw: 0, rn: 0, desk: 0, bands: [], subs: [], days: {} }, beds: { ok: true, share: null, min: COVERAGE_MIN, active: [], ignored: [], windowN: 0, unknownN: 0, allN: 0 }, subsAll: [], cmp: null };
}

// ---- the screens -------------------------------------------------------------------------------------------------------------------
export const SALES_CAVEAT = "Sales are the Land Department’s registered sales of one unit, counted by registration date. Off-plan rows are ‘Sell - Pre registration’, the off-plan registration: a first sale and a resale cannot be told apart. Plots and mortgages are never counted as sales.";
export const SALES_CSS = '.vsw{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #2E4540;border-radius:10px;overflow:hidden;margin:0 0 10px}.vsw a{display:flex;align-items:center;justify-content:center;gap:6px;min-height:42px;border-left:1px solid #2E4540;background:#0E1918;color:#C8D3CE;text-decoration:none;font-size:.84rem}.vsw a:first-child{border-left:0}.vsw a.on{background:#C5A56A;color:#0C1413;font-weight:600}.vsw svg{width:15px;height:15px;flex:0 0 auto}'
  + '.nr .cs{background:#6FA8DC}.nr .gap{display:inline-block;width:10px}.cmp b{font-weight:600}.also{font-size:.78rem;color:#A9B7B2;margin:4px 0 0;line-height:1.45}.also svg{width:13px;height:13px;vertical-align:-2px;margin:0 3px 0 0}'
  + '.hd2{font-family:"IBM Plex Mono",monospace;font-size:.58rem;letter-spacing:.11em;color:#8FA39B;margin:14px 0 2px}.hd2 small{letter-spacing:.02em;color:#6F837D;font-size:.58rem;margin-left:6px}'
  + '.rk .rc2{flex:0 0 auto;display:flex;gap:10px;text-align:right}.rk .rc2 div{min-width:46px;font-family:Fraunces,Georgia,serif;font-size:1.05rem;color:#C5A56A}.rk .rc2 div+div{color:#6FA8DC}.rk .rc2 small{display:block;font-family:"IBM Plex Sans",sans-serif;font-size:.58rem;color:#6F837D}'
  + 'table.two td.s,table.two th.s{color:#6FA8DC}';
const ICON_SALE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden=true><path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/></svg>';
const ICON_KEY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden=true><circle cx="8" cy="15" r="4"/><path d="m11 12 8-8"/><path d="m16 7 3 3"/></svg>';
const ICON_BOTH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden=true><rect x="3.5" y="5" width="7" height="14" rx="1"/><rect x="13.5" y="9" width="7" height="10" rx="1"/></svg>';
const ICON_NOTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden=true><path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10.5a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5Z"/><path d="M14 3.5V8h4"/></svg>';

// Rentals | Sales | Both, at the top of the results (a link each, so it works before any script loads)
export function viewSwitchHtml(st, link) {
  const V = [["rentals", "Rentals", ICON_KEY], ["sales", "Sales", ICON_SALE], ["both", "Both", ICON_BOTH]];
  return '<div class=vsw id=ejview role=group aria-label="rentals, sales or both">' + V.map((v) => '<a' + (st.view === v[0] ? " class=on" : "") + ' data-v=' + v[0] + ' href="' + esc(link({ view: v[0] })) + '">' + v[2] + v[1] + "</a>").join("") + "</div>";
}

const unitS = (n) => (n === 1 ? "sale" : "sales");
function lagNote(S) {
  if (!S || S.missing || !S.lag) return "";
  return '<div class=dk id=ejslag>Sales are registered with the Land Department up to ' + esc(dSay(S.asOf)) + ', so these sales are counted ' + esc(period(S.from, S.to)) + (S.slid ? " (the latest registered day)" : "") + ".</div>";
}
// the sales sentence part, with the v394 rule: never a bare 0 over sales that exist
function salesPart(S) {
  const zeroHid = S.n === 0 && S.allN > 0;
  return zeroHid ? "<b>0</b> sales match this filter (<b>" + fmt(S.allN) + "</b> " + (S.allN === 1 ? "was" : "were") + " registered with the Land Department)"
    : "<b>" + fmt(S.n) + "</b> " + unitS(S.n) + (S.count && S.count.value && S.count.value.sum > 0 ? " worth <b>" + esc(aedBig(S.count.value.sum)) + "</b>" : "") + " registered with the Land Department";   // v440
}
function rentalsPart(A) {
  if (A.noRentals) return "no rentals on record with Ejari";
  const b = A.beds || { allN: A.count.n }, zeroHid = A.count.n === 0 && b.allN > 0, n = A.count.n;
  if (zeroHid) return "<b>0</b> rentals match this filter (<b>" + fmt(b.allN) + "</b> " + (b.allN === 1 ? "was" : "were") + (A.basis === "filed" ? " filed with Ejari)" : " signed through Ejari)");
  return "<b>" + fmt(n) + "</b> " + (n === 1 ? "rental" : "rentals") + (A.basis === "filed" ? " filed with Ejari" : " signed through Ejari, by contract start date,");
}
function cmpLine(c, label) {
  if (!c) return "";
  const what = c.avg ? "the 7-day average before it" : "the " + c.days + " days before";
  if (c.missing) return '<div class=cmp>' + label + ": no comparison, " + esc(what) + " is not in the loaded record yet.</div>";
  const base = c.avg ? (Math.round(c.base * 10) / 10).toLocaleString("en-US") + " a day" : fmt(c.base);
  if (c.pct == null) return '<div class=cmp>' + label + ": none in " + esc(what) + ".</div>";
  const word = c.pct > 0 ? '<span class=up>Up ' + c.pct + "%</span>" : (c.pct < 0 ? '<span class=dn>Down ' + -c.pct + "%</span>" : "Level");
  return '<div class=cmp>' + label + ": " + word + " on " + esc(what) + " (" + esc(base) + ").</div>";
}
// "Also registered: N mortgages, M plot sales" - only when there is something, and only as a small line
function alsoLine(S) {
  if (!S || S.missing) return "";
  const m = S.count.mort, l = S.count.land;
  if (!m && !l) return "";
  const parts = [m ? plural(m, "mortgage", "mortgages") : "", l ? plural(l, "plot sale", "plot sales") : ""].filter(Boolean);
  return '<div class=also id=ejalso>' + ICON_NOTE + "Also registered: " + esc(parts.join(", ")) + ". These are not counted as sales.</div>";
}
function attrLine(S, kind) {
  if (!S || S.missing || !S.count.n) return "";
  if (S.devShare != null && kind === "dubai") return '<div class=dk id=ejattr>Developer recorded for ' + esc(pctSay(S.devShare)) + " of these sales; not recorded for " + esc(pctSay(1 - S.devShare)) + ".</div>";
  const a = S.count.attr, t = a.RV + a.NAME + a.NONE;
  if (!t) return "";
  const p = (v) => pctSay(v / t);
  if (kind === "developer") return '<div class=dk id=ejattr>Linked to this developer by the register’s project number for ' + esc(p(a.RV)) + " of these sales, and by the exact project name for " + esc(p(a.NAME)) + ".</div>";
  return '<div class=dk id=ejattr>Developer recorded for ' + esc(p(a.RV + a.NAME)) + " of these sales (" + esc(p(a.RV)) + " by the register’s project number, " + esc(p(a.NAME)) + " by exact project name); not recorded for " + esc(p(a.NONE)) + ".</div>";
}
const rentalsLegend = (A) => A.noRentals ? "" : '<i class=cn></i>' + plural(A.count.n, "rental", "rentals") + " (" + fmt(A.count.nw) + " new, " + fmt(A.count.rn) + " renewed)";
const salesLegend = (S) => '<i class=cs></i>' + plural(S.n, "sale", "sales") + " (" + fmt(S.count.off) + " off-plan, " + fmt(S.count.rdy) + " ready)";

// the daily chart: rentals (gold) and sales (blue), side by side per day, a week to a pair beyond three months
export function twoStripHtml(A, S, mode) {
  const from = mode === "sales" ? S.from : A.from, to = mode === "sales" ? S.to : A.to;
  const days = Math.round((dms(to) - dms(from)) / DAY) + 1;
  if (days < 2) return "";
  const step = days > 92 ? 7 : 1, bins = [];
  for (let end = to; end >= from; end = addD(end, -step)) {
    let r = 0, s = 0;
    for (let i = 0; i < step; i++) {
      const d = addD(end, -i); if (d < from) break;
      const x = A.count.days[d]; if (x) r += x.nw + x.rn;
      const y = S && !S.missing ? S.count.days[d] : null; if (y) s += y.o + y.r;
    }
    bins.unshift({ end, r, s });
  }
  if (!bins.some((b) => (mode === "sales" ? 0 : b.r) + (mode === "rentals" ? 0 : b.s) > 0)) return "";   // nothing to draw: no empty chart
  const both = mode === "both", max = Math.max(1, ...bins.map((b) => Math.max(mode === "sales" ? 0 : b.r, mode === "rentals" ? 0 : b.s))), W = bins.length * 12, H = 70, bw = both ? 4.5 : 8;
  const bar = (x, v, fill, tip) => { const h = Math.round((v / max) * (H - 2)); return h ? '<rect x="' + x + '" y="' + (H - h) + '" width="' + bw + '" height="' + h + '" fill="' + fill + '"><title>' + esc(tip) + "</title></rect>" : ""; };
  const bars = bins.map((b, i) => {
    const x0 = i * 12 + 1;
    return (mode !== "sales" ? bar(x0, b.r, "#C5A56A", dSay(b.end) + " rentals: " + b.r) : "") + (mode !== "rentals" ? bar(both ? x0 + bw + 0.5 : x0, b.s, "#6FA8DC", dSay(b.end) + " sales: " + b.s) : "");
  }).join("");
  const val = (b) => (mode === "sales" ? 0 : b.r) + (mode === "rentals" ? 0 : b.s);
  const peak = bins.reduce((a, b) => (val(b) > val(a) ? b : a), bins[0]);
  return '<div class=strip id=ejstrip2><svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio=none role=img aria-label="rentals and sales ' + (step === 7 ? "a week" : "a day") + '"><rect x=0 y=' + (H - 1) + ' width="' + W + '" height=1 fill="#24352F"></rect>' + bars + "</svg>"
    + '<div class=sl><span>' + esc(dSay(from, true)) + "</span><span>busiest " + esc(step === 7 ? "week to " : "") + esc(dSay(peak.end, true)) + ": " + fmt(val(peak)) + "</span><span>" + esc(dSay(to, true)) + "</span></div></div>";
}

// the sales tables: by off-plan and ready, by bedrooms (guarded), with the median price and the median price per sq m where five or more were priced
function priceCell(p) { return p && p.median != null ? esc(aed(p.median)) + (p.approx ? "*" : "") : "—"; }
function psmCell(p) { return p && p.median != null ? esc(aedSqm(p.median)) + (p.approx ? "*" : "") : "—"; }
export const aedBig = (v) => v == null ? "—" : v >= 1e9 ? "AED " + (v / 1e9).toFixed(v >= 1e11 ? 0 : 1) + "bn" : v >= 1e6 ? "AED " + Math.round(v / 1e6) + "M" : "AED " + Math.round(v / 1e3) + "k";
function salesTable(rows, head, withMed) {
  if (!rows.length) return "";
  const withVal = withMed && rows.every((b) => b.value);   // v440: the column appears only when every row has a whole total
  return '<table class=two><tr><th>' + head + '</th><th class=s>SALES</th>' + (withVal ? '<th>TOTAL VALUE</th>' : "") + (withMed ? '<th>TYPICAL PRICE</th><th>PER SQ M</th>' : "") + "</tr>"
    + rows.map((b) => "<tr><td>" + esc(b.label) + "</td><td class=s><b>" + fmt(b.n) + "</b></td>" + (withVal ? "<td><b>" + esc(aedBig(b.value.sum)) + "</b></td>" : "") + (withMed ? "<td>" + priceCell(b.price) + "</td><td>" + psmCell(b.psm) + "</td>" : "") + "</tr>").join("") + "</table>";
}
export function salesTablesHtml(S, st) {
  if (!S || S.missing) return "";
  let h = '<div class=hd2 id=ejshead>SALES REGISTERED WITH THE LAND DEPARTMENT<small>by registration date, to ' + esc(dSay(S.asOf)) + "</small></div>";
  if (!S.count.n) return h + '<div class=dk>' + (S.allN > 0 ? "None match the bedroom filter." : "No sales registered in this window.") + "</div>";
  h += salesTable(S.count.stages, "OFF-PLAN OR READY", true);
  if (S.beds.ok) h += salesTable(S.count.bands, "BEDROOMS", true);
  else h += '<div class=dk id=ejsbedsnote>Bedrooms are recorded for only ' + esc(pctSay(S.beds.share)) + " of these sales, so they are not split by bedrooms.</div>";
  const tv = S.count.value;
  if (tv) h += '<div class=dk id=ejsvalue>Total value: the sum of the registered prices of these sales, over the same dates as the count, so it rises and falls with the sales. ' +
    (tv.big ? fmt(tv.big) + " deal" + (tv.big === 1 ? "" : "s") + " over AED 500M each (a whole building or a land bank) " + (tv.big === 1 ? "is" : "are") + " left out so one transaction cannot swamp it." : "Single deals over AED 500M (a whole building or a land bank) are left out so one transaction cannot swamp it.") + "</div>";
  const any = S.count.price.median != null || S.count.psm.median != null;
  h += '<div class=dk>' + (any ? "Typical price: the middle sale" + (S.count.price.q1 != null ? ", with the middle half from " + esc(aed(S.count.price.q1)) + " to " + esc(aed(S.count.price.q3)) : "") + ". Shown only where five or more sales were priced." + (S.count.price.approx ? " * the middle of the daily middles, as the all-Dubai record carries no single prices." : "") : "Fewer than five sales were priced here, so no typical price is shown.") + "</div>";
  return h;
}
function sinceBeds(A, S, st) {   // the v394 bedroom note for the sales side
  const lines = [];
  if (S && !S.missing && S.beds && S.beds.active.length && S.beds.unknownN > 0) lines.push('<div class=dk id=ejsexcl>' + fmt(S.beds.unknownN) + " of " + fmt(S.beds.windowN) + " sales have no bedroom recorded and are not in this count.</div>");
  return lines.join("");
}

// ---- the developer's per-week, by-area and by-building tables, rentals and sales together ---------------------------------------------
function weeksHtml(A, S, weeks) {
  const to = A.to, rows = [];
  for (let i = 0; i < (weeks || 8); i++) {
    const t = addD(to, -7 * i), f = addD(t, -6);
    const r = A._win ? A._win(f, t).reduce((s, x) => s + x.n, 0) : 0;
    const s = S._win ? S._win(f, t).reduce((q, x) => q + x.n, 0) : 0;
    rows.push({ f, t, r, s });
  }
  if (!rows.some((x) => x.r || x.s)) return "";
  return '<div class=hd2>BY WEEK<small>7 days to ' + esc(dSay(to, true)) + (S.lag ? "; sales to " + esc(dSay(S.asOf, true)) : "") + "</small></div>"
    + '<table class=two id=ejweeks><tr><th>WEEK</th><th>RENTALS</th><th class=s>SALES</th></tr>'
    + rows.map((x) => "<tr><td>" + esc(dSay(x.f, true) + " to " + dSay(x.t, true)) + "</td><td><b>" + fmt(x.r) + '</b></td><td class=s><b>' + fmt(x.s) + "</b></td></tr>").join("") + "</table>";
}
function areasHtml(A, S, st) {
  const g = new Map();
  const add = (area, k, v) => { if (!area) return; const x = g.get(area.toLowerCase()) || { area, r: 0, s: 0 }; x[k] += v; g.set(area.toLowerCase(), x); };
  for (const r of (A._rows || [])) if (!r.desk) add(r.area, "r", r.n);
  for (const x of (S.areas || [])) add(x.area, "s", x.n);
  const list = [...g.values()].filter((x) => x.r || x.s).sort((a, b) => (b.r + b.s) - (a.r + a.s) || a.area.localeCompare(b.area)).slice(0, 12);
  if (!list.length) return "";
  return '<div class=hd2>BY AREA</div><table class=two id=ejareas><tr><th>AREA</th><th>RENTALS</th><th class=s>SALES</th></tr>'
    + list.map((x) => "<tr><td>" + esc(x.area) + "</td><td><b>" + fmt(x.r) + '</b></td><td class=s><b>' + fmt(x.s) + "</b></td></tr>").join("") + "</table>";
}
// buildings with both numbers: R.name(x) draws a building's name link; the rentals list and the sales list are merged on the key, then on the project number
function rankBothHtml(rentals, sales, R, limit) {
  const m = new Map(), byNo = new Map(), byName = new Map();
  const put = (x, side) => {
    let g = m.get(x.key) || (x.no && byNo.get(x.no)) || (x.en && byName.get(norm(x.en)));
    if (!g) { g = { key: x.key, en: x.en, ar: x.ar, no: x.no, district: x.district, dname: x.dname, app: x.app || "", r: 0, rn: 0, s: 0, off: 0, rdy: 0, land: 0, mort: 0 }; m.set(x.key, g); }
    if (x.no && !byNo.has(x.no)) byNo.set(x.no, g); if (x.en && !byName.has(norm(x.en))) byName.set(norm(x.en), g);
    if (!g.en && x.en) g.en = x.en; if (!g.ar && x.ar) g.ar = x.ar; if (!g.no && x.no) g.no = x.no; if (!g.app && x.app) g.app = x.app;
    if (side === "r") { g.r += x.n; g.rn += x.rn; } else { g.s += x.n; g.off += x.off; g.rdy += x.rdy; g.land += x.land; g.mort += x.mort; }
  };
  for (const x of rentals || []) put(x, "r");
  for (const x of sales || []) put(x, "s");
  const list = [...m.values()].filter((x) => x.r || x.s).sort((a, b) => (b.r + b.s) - (a.r + a.s) || (a.en || "").localeCompare(b.en || "")).slice(0, limit || 20);
  const max = Math.max(1, ...list.map((x) => Math.max(x.r, x.s)));
  return list.map((x, i) => {
    const sub = [R.withDistrict ? x.dname : "", x.no ? "#" + x.no : "", x.s ? fmt(x.off) + " off-plan, " + fmt(x.rdy) + " ready" : ""].filter(Boolean).join(" · ");
    return '<div class=rk><span class=no>' + (i + 1) + '</span><div class=rb><div class=rn>' + R.name(x) + "</div>"
      + '<div class=br><i style="width:' + Math.max(2, Math.round((Math.max(x.r, x.s) / max) * 100)) + '%"></i></div><div class=rs>' + esc(sub) + "</div></div>"
      + '<div class=rc2><div>' + fmt(x.r) + "<small>rentals</small></div><div>" + fmt(x.s) + "<small>sales</small></div></div></div>";
  }).join("");
}
function whereBothHtml(A, S, R) {
  const g = new Map();
  // v399: the live all-Dubai rentals rows carry an AREA and no district, the sales rows both: join on any key they share (district slug, area name, place name)
  const idx = new Map(), N = (v) => norm(v);
  const add = (keys, name, district, f, v) => {
    keys = keys.filter(Boolean);
    let x = null; for (const k of keys) if (idx.has(k)) { x = idx.get(k); break; }
    if (!x) { x = { k: keys[0], name, district, r: 0, s: 0 }; g.set(x.k, x); }
    if (!x.district && district) x.district = district;
    x[f] += v; for (const k of keys) idx.set(k, x);
  };
  for (const x of (A.where || [])) add([x.district ? "d:" + x.district : "", "n:" + N(x.name)], x.name, x.district, "r", x.n);
  for (const x of (S.areas || [])) add([x.district ? "d:" + x.district : "", "n:" + N(x.area), "n:" + N(x.name)], x.name, x.district, "s", x.n);
  const list = [...g.values()].filter((x) => x.r || x.s).sort((a, b) => (b.r + b.s) - (a.r + a.s) || a.name.localeCompare(b.name)).slice(0, R.top || 10);
  if (!list.length) return "";
  return '<div class=hd2>WHERE THE ACTIVITY IS<small>by district</small></div><table class=two id=ejwhere2><tr><th>DISTRICT</th><th>RENTALS</th><th class=s>SALES</th></tr>'
    + list.map((x) => "<tr><td>" + (x.district ? '<a href="' + esc(R.districtHref(x.district)) + '">' + esc(x.name) + "</a>" : esc(x.name)) + "</td><td><b>" + fmt(x.r) + '</b></td><td class=s><b>' + fmt(x.s) + "</b></td></tr>").join("") + "</table>";
}

// ---- the card body ------------------------------------------------------------------------------------------------------------------
// R: the page's own pieces {headline(subjectHtml, A), strip(A), bands(A), subs(A), cmp(c), name(x), districtHref(slug), withDistrict, top, names}
// mode 'sales' or 'both'. Returns the HTML that goes where the rentals-only card put headline + strip + tables (and, for a developer or a
// district, the building list).
export function salesBodyHtml(mode, subjectHtml, A, S, st, R) {
  const kind = A.kind;
  if (S.missing) {   // no sales file for this place yet: the rentals content as it is, with one honest line
    return (mode === "both" ? R.headline(subjectHtml, A) + R.strip(A) + R.bands(A) + R.subs(A) : "") + '<div class=dk id=ejsnone>' + esc(S.missing) + "</div>";
  }
  let h = "";
  if (mode === "sales") {
    h += '<div class=hl id=ejhl>' + subjectHtml + ": " + salesPart(S) + " " + esc(period(S.from, S.to)) + ".</div>";
  } else {
    // the one sentence: "X: N rentals filed with Ejari and M sales registered with the Land Department between 1 Oct and 7 Oct 2026."
    const rp = rentalsPart(A), sp = salesPart(S);
    h += '<div class=hl id=ejhl>' + subjectHtml + ": " + rp + " and " + sp + " " + esc(period(A.from, A.to)) + ".</div>";
  }
  h += lagNote(S) + sinceBeds(A, S, st);
  if (mode === "both") {
    if (!A.noRentals && A.beds && A.beds.active.length && A.beds.unknownN > 0) h += '<div class=dk id=ejexcl>' + fmt(A.beds.unknownN) + " of " + fmt(A.beds.windowN) + " rentals have no bedroom recorded and are not in this count.</div>";
    h += cmpLine(A.cmp, "Rentals") + cmpLine(S.cmp, "Sales");
    h += '<div class=nr>' + [rentalsLegend(A), salesLegend(S)].filter(Boolean).join(' <span class=gap></span> ') + "</div>";
    if (A.count.desk) h += '<div class=dk id=ejdesk>Plus ' + plural(A.count.desk, "flexi-desk licence", "flexi-desk licences") + " (office desks rented by the month), left out of the rentals and the rankings.</div>";
  } else {
    h += cmpLine(S.cmp, "Sales");
    h += '<div class=nr>' + salesLegend(S) + "</div>";
  }
  if (S.short) h += '<div class=dk>The loaded sales record for this place starts on ' + esc(dSay(S.first)) + ", so any earlier part of this window is empty.</div>";
  h += alsoLine(S);
  h += twoStripHtml(A, S, mode);
  if (mode === "both") {
    h += '<div class=hd2>RENTALS<small>' + (A.basis === "filed" ? "filed with Ejari" : "by contract start date") + "</small></div>" + (A.noRentals ? '<div class=dk>No rentals are on record with Ejari for this place in this window.</div>' : R.bands(A) + R.subs(A));
  }
  h += salesTablesHtml(S, st) + attrLine(S, kind);
  if (S.brand && S.brand.n > 0) h += '<div class=dk id=ejbrand>' + plural(S.brand.n, "more sale has", "more sales have") + " " + esc(S.brand.word) + " in the project name; the register records no developer for " + (S.brand.n === 1 ? "it" : "them") + ". Matched on the name only, and not in the counts above.</div>";
  if (kind === "developer") {
    if (S.dev && S.dev.unmapped > 0) h += '<div class=dk id=ejunmapped>Plus ' + plural(S.dev.unmapped, "sale", "sales") + " in areas the app has no district file for; they are in the all-Dubai figures but not in the lists below.</div>";
    if (mode === "both") h += weeksHtml(A, S) + areasHtml(A, S, st);
    h += '<div class=hd2>BY BUILDING</div>' + '<div id=ejproj>' + rankBothHtml(mode === "both" ? A.projects : [], S.projects, Object.assign({ withDistrict: true }, R), 20) + "</div>";
  } else if (kind === "district") {
    h += '<div class=hd2>BUILDINGS<small>most active first</small></div><div id=ejrank>' + rankBothHtml(mode === "both" ? A.ranking : [], S.projects, R, st.top || 5) + "</div>";
  } else if (kind === "dubai") {
    if (mode === "both") h += whereBothHtml(A, S, R);
  }
  return h;
}
