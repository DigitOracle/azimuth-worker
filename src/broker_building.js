// v450 - THE ONE-BUILDING BROKER SHEET (Kendall, 9 Oct 2026: "when I click here and get the report I get the whole district not the individual building").
//   GET /doc_broker?kind=building&area=<district slug>&project=<Land Department project number>&name=<register name>[&bk=<footprint index>][&window=12m|all]&key=...
//        -> the options page (src/doc_options_page.js shell); Generate opens
//   GET /developers_pdf?kind=building&area=..&project=..&name=..&bk=..&window=12m|all[&client=..][&contact=1][&format=html]&key=...
//        -> the sheet as a PDF (format=html: the same sheet as a web page, with a live 3D street map)
// The area sheet (kind=snapshot|detailed) is unchanged and stays on the area / district Snapshot and Detailed buttons.
//
// IDENTITY. The building is the Land Department project NUMBER the developers map already carries (ev.p). The name rides along only as a
// cross-check: when the number's own register name does not agree with it, the sheet is refused, never guessed. With no number, the record
// key the sales file itself carries ("dld:" + the register name, letters and digits) is used, and only when it names ONE project number.
// The footprint (bk) is the register-bound footprint index the map already holds; nothing here binds a footprint by name.
//
// DATA (read only, nothing written): img_sales_filed_<district> (registered sales: one row per day, project, bedrooms, stage, with each sale's
// price and price per sq m), img_ejari_filed_<district> (registered rent contracts), img_devmap_index (the area's typical price and the
// price bands, through loadData in src/devmap_pdf.js), img_brief_fp_<district> (the digital footprint), and - OWNER KEY ONLY, web page
// only, never in the PDF - img_pf_supply_<district>.advertised (Property Finder adverts; src/advertised.js).
import { DM } from "./devmap_dm.js";
import { kvJson } from "./brief.js";
import { BRIEF_KIT, esc } from "./brief_docs.js";
import { icon, secHead, loadData, dateLong, obliqueMap, pack, head, PERMIT_REMINDER } from "./devmap_pdf.js";
import { salesDoc, valueOf, VALUE_CAP, MIN_PRICED } from "./sales_view.js";
import { ejariDoc } from "./ejari_page.js";
import { advertisedDoc, advertisedForKey, ADV_LABEL, ADV_NOTE } from "./advertised.js";
import { positionOf, placement } from "./building_position.js";   // v452: img_bldg_pos_<district>, the multi-source position check

const { NAVY, MUTED } = BRIEF_KIT;
const TEAL = "#0A4F4A", GOLDI = "#C5A56A", HAIR = "#E6E1D8";
const SQFT = DM.SQFT;
export const RECENT_MAX = 15;
const BANDS = ["studio", "1", "2", "3", "3+", "office", "shop", "other"];
const BAND_SAY = { studio: "Studio", "1": "1 bedroom", "2": "2 bedrooms", "3": "3 bedrooms", "3+": "4 bedrooms or more", office: "Office", shop: "Shop", other: "Bedrooms not stated" };
const ADV_SAY = { studio: "Studio", "1": "1 bedroom", "2": "2 bedrooms", "3+": "3 bedrooms or more", unknown: "Bedrooms not stated" };
const fmt = (n) => (n == null || !isFinite(n) ? "" : Math.round(n).toLocaleString("en-US"));
const aed = (n) => (n == null ? "" : "AED " + fmt(n));
const aedBig = (v) => v >= 1e9 ? "AED " + (v / 1e9).toFixed(2) + "bn" : v >= 1e6 ? "AED " + (v / 1e6).toFixed(1) + "M" : "AED " + fmt(v);
const plural = (n, one, many) => fmt(n) + " " + (n === 1 ? one : many || one + "s");
const DAY = 86400000;
const dms = (s) => Date.parse(String(s).slice(0, 10) + "T00:00:00Z");
const dstr = (ms) => new Date(ms).toISOString().slice(0, 10);
export const recKey = (name) => "dld:" + String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const loose = (s) => String(s || "").toLowerCase().replace(/\s+by\s+.*$/, "").replace(/[^a-z0-9]/g, "");
function quant(a, p) { const k = (a.length - 1) * p, f = Math.floor(k), c = Math.min(f + 1, a.length - 1); return a[f] + (a[c] - a[f]) * (k - f); }
const med = (a) => (a.length >= MIN_PRICED ? Math.round(quant(a.slice().sort((x, y) => x - y), 0.5)) : null);

// ------------------------------------------------------------------------------------------------ the request
export function buildingParams(sp) {
  const project = String(sp.get("project") || "").replace(/[^0-9]/g, "").slice(0, 8);
  const name = String(sp.get("name") || "").replace(/[<>&"\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  const bk = /^\d{1,7}$/.test(String(sp.get("bk") || "")) ? Number(sp.get("bk")) : null;
  return { project, name, bk };
}

// ------------------------------------------------------------------------------------------------ which rows are this building (pure)
// -> { rows, refused?: reason }. rows: the sales (or rent) rows of the one project.
export function pickBuilding(rows, b) {
  if (b.project) {
    const mine = rows.filter((r) => String(r.projectNo) === b.project);
    if (mine.length && b.name) {
      const names = new Set(mine.map((r) => loose(r.project)).filter(Boolean));
      if (names.size && !names.has(loose(b.name))) return { rows: [], refused: "The project number " + b.project + " is " + [...new Set(mine.map((r) => r.project))].join(" / ") + " on the register, not " + b.name + ". Nothing is shown rather than the wrong building." };
    }
    return { rows: mine };
  }
  if (!b.name) return { rows: [], refused: "No project number or register name was given." };
  const k = recKey(b.name), mine = rows.filter((r) => r.key === k);
  const nos = new Set(mine.map((r) => String(r.projectNo || "")).filter(Boolean));
  if (nos.size > 1) return { rows: [], refused: "The name " + b.name + " is carried by " + nos.size + " different project numbers on the register; open the sheet from the project itself." };
  return { rows: mine };
}

// the window: last 12 months (365 days to the file's latest day) or every year in the file
export function windowOf(win, asOf, first) {
  if (win === "l12" && asOf) { const from = dstr(dms(asOf) - 364 * DAY); return { from, to: asOf, say: "Sales registered " + dateLong(from) + " to " + dateLong(asOf) + " (the last 12 months)" }; }
  return { from: first || "0000-00-00", to: asOf || "9999-12-31", say: "Every sale in the record, " + dateLong(first) + " to " + dateLong(asOf) + " (all years)" };
}

// ------------------------------------------------------------------------------------------------ the figures (pure)
export function salesFigures(rows, w) {
  const sales = rows.filter((r) => r.kind === "sale" && r.date >= w.from && r.date <= w.to);
  const by = {}, allP = [], allM = [];
  let n = 0, off = 0, rdy = 0;
  for (const r of sales) {
    n += r.n; if (r.stage === "offplan") off += r.n; else if (r.stage === "ready") rdy += r.n;
    const x = by[r.band] || (by[r.band] = { n: 0, p: [], m: [] }); x.n += r.n;
    for (const p of r.prices || []) { x.p.push(p); allP.push(p); }
    for (const m of r.psm || []) { x.m.push(m); allM.push(m); }
  }
  const bands = BANDS.filter((b) => by[b]).map((b) => {
    const x = by[b], mp = med(x.m);
    return { band: b, label: BAND_SAY[b], n: x.n, priced: x.p.length, price: med(x.p), psf: mp == null ? null : Math.round(mp / SQFT), psm: mp };
  });
  // recent sales: each sale on its own line. A size is shown only where the day's row holds ONE sale (the file sorts prices and
  // price-per-area separately, so with two or more sales the pairs cannot be matched).
  const recent = [];
  for (const r of sales) {
    const ps = r.prices || [], one = ps.length === 1 && (r.psm || []).length === 1 && r.n === 1;
    if (!ps.length) { for (let i = 0; i < r.n; i++) recent.push({ date: r.date, band: r.band, stage: r.stage, price: null, sqft: null }); continue; }
    for (const p of ps) recent.push({ date: r.date, band: r.band, stage: r.stage, price: p, sqft: one && r.psm[0] > 0 ? Math.round((p / r.psm[0]) * SQFT) : null });
  }
  recent.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.price || 0) - (a.price || 0)));
  const last = sales.reduce((a, r) => (!a || r.date > a.date ? r : a), null);
  const mAll = med(allM);
  return { n, off, rdy, bands, priced: allP.length, price: med(allP), psm: mAll, psf: mAll == null ? null : Math.round(mAll / SQFT),
    value: valueOf(sales), recent: recent.slice(0, RECENT_MAX), recentAll: recent.length, lastStage: last ? last.stage : "" };
}

// rent contracts: contracts and the typical yearly rent by bedrooms (each day's median weighted by its contracts; printed from 5 contracts)
export function rentFigures(rows, w) {
  const keep = rows.filter((r) => r.date >= w.from && r.date <= w.to), by = {};
  for (const r of keep) { const x = by[r.band] || (by[r.band] = { n: 0, pairs: [] }); x.n += r.n; if (r.med != null && r.n > 0) x.pairs.push([r.med, r.n]); }
  const wmed = (pairs) => { const p = pairs.slice().sort((a, b) => a[0] - b[0]), t = p.reduce((s, x) => s + x[1], 0); if (t < MIN_PRICED) return null; let c = 0; for (const x of p) { c += x[1]; if (c >= t / 2) return Math.round(x[0]); } return null; };
  const bands = BANDS.filter((b) => by[b]).map((b) => ({ band: b, label: BAND_SAY[b], n: by[b].n, rent: wmed(by[b].pairs) }));
  return { n: bands.reduce((s, b) => s + b.n, 0), bands };
}

// ------------------------------------------------------------------------------------------------ loading
async function readOr(env, name) { try { return await kvJson(env, name); } catch (e) { return null; } }
// v451 - the register-bound footprint as a map ring, for other pages (the advert card's map). layer = img_brief_fp_<district> (read once by the
// caller); bk = the footprint index carried in the register key "<district>:<bk>". Returns { c: [[lon,lat]...closed], h, ll: [lat,lon] } or null.
export function footprintRing(layer, bk) {
  const fp = layer && Array.isArray(layer.b) && Array.isArray(layer.ll) ? layer.b.find((x) => x[0] === bk) : null;
  if (!fp) return null;
  let sx = 0, sy = 0, k = 0; const f = fp[2], r = [];
  for (let i = 0; i + 1 < f.length; i += 2) { sx += f[i]; sy += f[i + 1]; k++; const q = llOfXy(layer, f[i], f[i + 1]); if (q) r.push([Math.round(q[1] * 1e6) / 1e6, Math.round(q[0] * 1e6) / 1e6]); }
  if (r.length < 3) return null;
  if (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1]) r.push(r[0]);
  return { c: r, h: Number(fp[1]) || 12, ll: k ? llOfXy(layer, sx / k, sy / k) : null };
}
export async function footprintLayer(env, slug) { return readOr(env, "brief_fp_" + slug); }
export async function positionsDoc(env, slug) { return readOr(env, "bldg_pos_" + slug); }   // v452: img_bldg_pos_<district>, null when not published
export async function loadBuilding(env, p, opts) {
  const b = p.bld || { project: "", name: "", bk: null };
  if (!b.project && !b.name) return { status: 400, body: { ok: false, reason: "project= (the Land Department project number) or name= is required" } };
  const L = await loadData(env, Object.assign({}, p, { devs: [] }), opts);
  if (L.status !== 200) return L;
  const C = L.C, slug = C.slug;
  const sd = salesDoc(await readOr(env, "sales_filed_" + slug));
  if (!sd) return { status: 404, body: { ok: false, reason: "no sales file is loaded for this area yet", area: slug } };
  const pick = pickBuilding(sd.rows, b);
  if (pick.refused) return { status: 409, body: { ok: false, reason: pick.refused } };
  if (!pick.rows.length) return { status: 404, body: { ok: false, reason: "no registered sale of this project is in the area's sales file", area: slug, project: b.project || null } };
  const rows = pick.rows, rec = rows.reduce((a, r) => (r.date > a.date ? r : a), rows[0]);
  const devRow = rows.slice().reverse().find((r) => r.dev) || rec;
  const w = windowOf(p.win, sd.asOf, sd.first);
  const S = salesFigures(rows, w);
  const ed = ejariDoc(await readOr(env, "ejari_filed_" + slug));
  const er = ed ? pickBuilding(ed.rows, { project: rec.projectNo || b.project, name: "" }).rows : [];
  const R = ed ? rentFigures(er, { from: w.from < ed.first ? ed.first : w.from, to: ed.asOf }) : null;
  // the footprint: only the register-bound index the map handed us
  const layer = b.bk != null ? await readOr(env, "brief_fp_" + slug) : null;
  // v452 - the position check: the consensus point of every source joined by id; the gold footprint is the one it names
  const pl = b.bk != null ? placement(positionOf(await readOr(env, "bldg_pos_" + slug), slug + ":" + b.bk), b.bk) : null;
  const gk = pl ? pl.bk : b.bk;
  const fp = layer && Array.isArray(layer.b) ? layer.b.find((x) => x[0] === gk) : null;
  let ll = null, ring = null;
  if (fp && Array.isArray(layer.ll)) { const fr = footprintRing(layer, gk); if (fr) { ring = { c: fr.c, h: fr.h }; ll = fr.ll; } }
  if (pl) ll = pl.ll;
  // OWNER ONLY, web page only: the adverts (never added to developer availability, never in the PDF)
  let adv = null;
  if (opts && opts.owner && p.format === "html" && b.bk != null) { try { adv = advertisedForKey(advertisedDoc(await readOr(env, "pf_supply_" + slug)), slug + ":" + b.bk); } catch (e) { adv = null; } }
  const st = C.st, tier = S.psm != null && st.enough && st.bounds ? DM.tierOf(S.psm, st.bounds) : -1;
  const B = { C, slug, rec, name: rec.project || b.name, projectNo: rec.projectNo || b.project, dev: devRow.dev || "", area: C.names.plain, subArea: rec.area || "",
    status: S.lastStage === "offplan" ? "Off-plan" : S.lastStage === "ready" ? "Ready" : "", asOf: sd.asOf, first: sd.first, w, S, R, rentAsOf: ed ? ed.asOf : "", rentFirst: ed ? ed.first : "",
    layer: fp ? layer : null, bk: fp ? gk : null, ll, ring, adv, posLine: pl && fp ? pl.line : "", posLineNoPf: pl && fp ? pl.lineNoPf : "", owner: !!(opts && opts.owner), tier, areaPsm: st.enough ? st.median : null };
  return { status: 200, B };
}
function llOfXy(layer, x, y) {   // the footprint layer's affine (the Brief's llOfXy, src/brief_docs.js) -> [lat, lon]
  const [a, b, c, d, e, f] = layer.ll, det = a * e - b * d;
  if (!det) return null;
  return [(a * (y - f) - d * (x - c)) / det, (e * (x - c) - b * (y - f)) / det];
}

// ------------------------------------------------------------------------------------------------ the sheet's parts (cards, never plain lists)
const card = (k, v, n) => '<div class="card2"><div class="ck">' + k + '</div><div class="cv">' + v + '</div>' + (n ? '<div class="cn">' + n + "</div>" : "") + "</div>";
function headerBlock(B) {
  const facts = [["Area", esc(B.area) + (B.subArea && B.subArea.toLowerCase() !== B.area.toLowerCase() ? " (" + esc(B.subArea) + ")" : "")], ["Developer", B.dev ? esc(B.dev) + '<span class="cn"> as the register gives it</span>' : "Not recorded on the register"],
    ["Status", B.status ? B.status + '<span class="cn"> (the latest registered sale is ' + (B.status === "Off-plan" ? "an off-plan registration" : "a completed home") + ")</span>" : "Not known"], ["Project number", "#" + esc(B.projectNo)]];
  return { h: 150, html: '<div class="ttl"><div><h1 class="serif">' + esc(B.name) + '</h1><div class="tsub">One building, from the Dubai Land Department sales register. ' + esc(B.w.say) + ".</div></div></div>" +
    '<div class="frs">' + facts.map((f) => "<div class=fr><b>" + f[0] + "</b><span>" + f[1] + "</span></div>").join("") + "</div>" };
}
function salesBlock(B) {
  const S = B.S, v = S.value;
  const tiles = '<div class="tiles">' +
    '<div class="tile"><div class="tk">Sales</div><div class="tv">' + fmt(S.n) + '</div><div class="tu">' + (S.off ? fmt(S.off) + " off-plan, " : "") + fmt(S.rdy) + " ready</div></div>" +
    '<div class="tile"><div class="tk">Typical price per sq ft</div><div class="tv">' + (S.psf != null ? aed(S.psf) : "Not shown") + '</div><div class="tu">' + (S.psf != null ? "the middle sale" : "fewer than " + MIN_PRICED + " priced sales") + "</div></div>" +
    '<div class="tile"><div class="tk">Total value</div><div class="tv">' + (v ? aedBig(v.sum) : "Not shown") + '</div><div class="tu">' + (v ? (v.big ? plural(v.big, "deal") + " over AED " + fmt(VALUE_CAP / 1e6) + "M left out" : "sum of the sale prices") : "this file carries no prices") + "</div></div></div>";
  const rowsH = S.bands.map((b) => "<tr><td>" + esc(b.label) + '</td><td class="r">' + fmt(b.n) + '</td><td class="r">' + (b.price != null ? aed(b.price) : "&ndash;") + '</td><td class="r">' + (b.psf != null ? aed(b.psf) : "&ndash;") + "</td></tr>").join("");
  const tbl = S.bands.length ? '<table class="tb"><tr><th>HOME</th><th class="r">SALES</th><th class="r">TYPICAL PRICE</th><th class="r">PER SQ FT</th></tr>' + rowsH + "</table>" +
    '<div class="mnote">A typical (middle) price is shown only where ' + MIN_PRICED + " or more priced sales stand behind it; a dash means fewer.</div>" : '<div class="note2">' + icon("info", 18, TEAL) + "<div>No sale of this building was registered in this window.</div></div>";
  return { h: 120 + 26 * S.bands.length + 40, keep: false, html: secHead("chart-bar", "Sales in this building", esc(B.w.say) + ".") + tiles + tbl };
}
function recentBlock(B) {
  const S = B.S;
  if (!S.recent.length) return null;
  const rows = S.recent.map((r) => "<tr><td>" + esc(dateLong(r.date)) + "</td><td>" + esc(BAND_SAY[r.band] || r.band) + (r.stage === "offplan" ? '<span class="cn"> off-plan</span>' : "") + '</td><td class="r">' + (r.sqft ? fmt(r.sqft) + " sq ft" : "&ndash;") + '</td><td class="r">' + (r.price != null ? aed(r.price) : "not recorded") + "</td></tr>").join("");
  return { h: 70 + 21 * S.recent.length, html: secHead("stack", "Recent sales, newest first", (S.recentAll > S.recent.length ? "The latest " + S.recent.length + " of " + fmt(S.recentAll) + ". " : "") + "A size is shown where the day's record holds one sale, so the price and the size belong together.") +
    '<table class="tb"><tr><th>DATE</th><th>HOME</th><th class="r">SIZE</th><th class="r">PRICE</th></tr>' + rows + "</table>" };
}
function rentBlock(B) {
  const R = B.R;
  if (!R || !R.n) {
    const why = B.status === "Off-plan" ? "No rent contract is registered for this building: it is sold off-plan and not yet handed over." : "No rent contract is registered for this building in this window.";
    return { h: 90, html: secHead("wallet", "Rents", "Registered rent contracts (Ejari).") + '<div class="note2">' + icon("info", 18, TEAL) + "<div>" + why + "</div></div>" };
  }
  const cards = '<div class="bgrid">' + R.bands.map((b) => card(esc(b.label), b.rent != null ? aed(b.rent) + '<span class="cn"> a year</span>' : "&ndash;", plural(b.n, "contract") + (b.rent == null ? ", fewer than " + MIN_PRICED + " to set a typical rent" : ""))).join("") + "</div>";
  return { h: 80 + 70 * Math.ceil(R.bands.length / 2), html: secHead("wallet", "Rents", "Registered rent contracts (Ejari), " + esc(dateLong(B.w.from < B.rentFirst ? B.rentFirst : B.w.from)) + " to " + esc(dateLong(B.rentAsOf)) + ". Rents already agreed, not asking rents.") + cards };
}
function positionBlock(B) {
  const S = B.S, a = B.areaPsm;
  let body;
  if (S.psm == null) body = '<div class="note2">' + icon("info", 18, TEAL) + "<div>Fewer than " + MIN_PRICED + " priced sales in this window, so the building is not placed against its area.</div></div>";
  else {
    const pct = a ? Math.round((S.psm / a - 1) * 100) : null;
    body = '<div class="two">' + card("This building, per sq ft", aed(S.psf), "the middle of " + plural(S.priced, "priced sale")) +
      (a ? card("The area, per sq ft", aed(a / SQFT), esc(B.area) + ", " + esc(B.C.winText)) : "") +
      (B.tier >= 0 ? card("Price band", DM.TIER_NAMES[B.tier], esc(DM.bandLine(B.tier, B.C.st.bounds, "sqft")) + ". Bands describe homes, from all Dubai sales.") : "") + "</div>" +
      (pct != null ? '<div class="mnote">This building sells ' + (pct === 0 ? "at the area's typical price per sq ft" : Math.abs(pct) + "% " + (pct > 0 ? "above" : "below") + " the area's typical price per sq ft") + ". The two figures can cover slightly different dates: the area figure is the developers map's own.</div>" : "");
  }
  return { h: 140, html: secHead("chart-donut", "Where it sits in the area", "Its price per sq ft against the area's typical, and its price band.") + body };
}
function advertBlock(B) {
  if (!B.owner || !B.adv) return null;   // owner key, web page only; never in the PDF
  const a = B.adv, ks = ["studio", "1", "2", "3+"].filter((k) => a.bands[k]).concat(Object.keys(a.bands).filter((k) => !["studio", "1", "2", "3+"].includes(k)));
  const kA = (n) => (n >= 1e6 ? (n / 1e6).toFixed(2) + "M" : Math.round(n / 1e3) + "k");
  const cards = '<div class="bgrid">' + ks.map((k) => { const x = a.bands[k], pr = x.pmin == null ? "" : x.pmin === x.pmax ? "AED " + kA(x.pmin) : "AED " + kA(x.pmin) + " to " + kA(x.pmax);
    return card(esc(ADV_SAY[k] || k), a.counted ? plural(x.flats, "flat") : plural(x.adverts, "advert"), (a.counted ? plural(x.adverts, "advert") + (pr ? ", " : "") : "") + (pr ? pr + " a year" : "")); }).join("") + "</div>";
  return { h: 90 + 70 * Math.ceil(ks.length / 2), html: secHead("map-trifold", ADV_LABEL, "Owner only. " + esc(ADV_NOTE) + " Shown beside the developer's availability, never added to it." + (a.asOf ? " As of " + esc(dateLong(a.asOf) || a.asOf) + "." : "")) + cards };
}
function mapBlock(B, live) {
  if (!B.layer) return { h: 80, html: secHead("map-pin", "On the map", "") + '<div class="note2">' + icon("info", 18, TEAL) + "<div>This project is not tied to a building outline on the map yet, so no map is drawn.</div></div>" };
  const gold = new Map([[B.bk, { fill: GOLDI, wall: "#A98A4F", edge: "#7A6230", n: 0 }]]);
  const pic = obliqueMap(B.layer, gold, { w: 700, h: 300, frame: "hi", label: B.name + " in gold among its neighbours" });
  const pline = live && B.owner ? B.posLine : B.posLineNoPf;   // Property Finder is named on the owner's web page only, never in the PDF
  const g = B.ll ? '<a class="smg" href="https://www.google.com/maps/search/?api=1&query=' + B.ll[0].toFixed(6) + "," + B.ll[1].toFixed(6) + '">Open in Google Maps</a>' : "";
  const liveMap = live && B.ll ? '<div class="smap" data-lat="' + B.ll[0].toFixed(6) + '" data-lon="' + B.ll[1].toFixed(6) + '"' + (B.ring ? " data-fp='" + JSON.stringify(B.ring) + "'" : "") + ' role="img" aria-label="' + esc(B.name) + ' on the street map, in gold"><div class="smc"></div></div>' : "";
  return { h: 380, html: secHead("map-pin", "On the map", "The digital footprint: buildings raised to their height, this one in gold. Building outlines and streets from OpenStreetMap contributors.") +
    (liveMap || '<div class="mapbox">' + pic + "</div>") + g + (pline ? '<div class="mnote">' + esc(pline) + "</div>" : "") };
}

// the live street map of the web page: the supply page's approach (MapLibre 4.7.1 from unpkg, CARTO dark-matter vector style, fill-extrusion
// on the vector "building" layer). The building in gold is OUR register-bound footprint (img_brief_fp_<district>, the same outline the PDF draws), raised
// on its own layer - not a distance rule over the vector tiles, which lit tile scraps on the supply page (v449 there). No raster tiles (CARTO's need an API key).
export const LIVE_MAP_CSS = ".smap{position:relative;height:340px;border:1px solid " + HAIR + ";border-radius:8px;overflow:hidden;background:#0E1918}.smc{position:absolute;inset:0}.smg{display:inline-block;margin-top:6px;font-size:11px;color:" + TEAL + "}" +
  "@media(max-width:640px){.sheet{width:auto!important;height:auto!important;min-height:0!important}.dmb{padding:12px 16px 0!important}.tiles,.bgrid{grid-template-columns:1fr 1fr!important}.two{flex-direction:column}.frs .fr{grid-template-columns:1fr!important;gap:2px}.ttl{flex-direction:column}table.tb{font-size:11px}}";
export const LIVE_MAP_JS = String.raw`(function(){var el=document.querySelector(".smap[data-lat]");if(!el)return;var ll=[Number(el.getAttribute("data-lon")),Number(el.getAttribute("data-lat"))];
var c=document.createElement("link");c.rel="stylesheet";c.href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";document.head.appendChild(c);
var s=document.createElement("script");s.src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";s.onload=function(){var ml=window.maplibregl;
var m=new ml.Map({container:el.querySelector(".smc"),style:"https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",center:ll,zoom:15,attributionControl:{compact:true},cooperativeGestures:true});
m.on("load",function(){try{var st=m.getStyle(),src=Object.keys(st.sources).find(function(k){return st.sources[k].type==="vector"});if(!src)return;
m.addLayer({id:"dfp",type:"fill-extrusion",source:src,"source-layer":"building",minzoom:13,paint:{"fill-extrusion-color":"#3d5a53","fill-extrusion-height":["coalesce",["get","render_height"],["get","height"],12],"fill-extrusion-base":["coalesce",["get","render_min_height"],0],"fill-extrusion-opacity":0.9}});
var fp=null;try{fp=JSON.parse(el.getAttribute("data-fp")||"null")}catch(x){}
if(fp&&fp.c){m.addSource("gold",{type:"geojson",data:{type:"Feature",geometry:{type:"Polygon",coordinates:[fp.c]},properties:{}}});
m.addLayer({id:"gold",type:"fill-extrusion",source:"gold",paint:{"fill-extrusion-color":"#C5A56A","fill-extrusion-height":fp.h+1,"fill-extrusion-base":0,"fill-extrusion-opacity":1}})}
m.easeTo({pitch:50,bearing:-20,zoom:15.5,duration:900})}catch(x){}})};document.head.appendChild(s)})();`;

// ------------------------------------------------------------------------------------------------ the document
function pageHtml(B, pg, i, total, p) {
  const C = B.C;
  const hdr = '<div style="height:96px;display:flex;align-items:center;justify-content:space-between;padding:0 46px;background:#FFFFFF;border-bottom:1px solid #E6E1D8;flex-shrink:0;"><div style="display:flex;flex-direction:column;gap:4px;max-width:560px;"><div class="lbl" style="text-transform:uppercase">' + esc(B.name) + " &middot; " + pg.sub + '</div><div style="font-size:10.5px;color:' + MUTED + ';line-height:1.35;">' + C.today + " &middot; " + esc(B.w.say) + (p.client ? " &middot; Prepared for " + esc(p.client) : "") + "</div></div>" + BRIEF_KIT.logo(C, 70) + "</div>";
  const small = BRIEF_KIT.smallPrint(["Sources: Dubai Land Department sales register to " + esc(dateLong(B.asOf)) + (B.R ? "; registered rent contracts (Ejari) to " + esc(dateLong(B.rentAsOf)) : "") + "; the developers map's area figures and price bands, " + esc(dateLong(C.IDX0.as_of)) + ". Past registered facts only: not an offer, not advice.",
    PERMIT_REMINDER + " &middot; Page " + (i + 1) + " of " + total, p.contact ? '<span style="font-size:10.5px;color:#22262B;">Broker contact, to fill in: name ______________ &nbsp; mobile ______________ &nbsp; email ______________</span>' : ""]);
  return '<div class="sheet page dm-body">' + hdr + '<div class="dmb" style="flex:1;display:flex;flex-direction:column;padding:14px 46px 0 46px;gap:12px;overflow:hidden;">' + pg.html + "</div>" + BRIEF_KIT.footer(small, true) + "</div>";
}
export function buildingHtml(B, p) {
  const live = p.format === "html";
  const blocks = [headerBlock(B), salesBlock(B), positionBlock(B), recentBlock(B), rentBlock(B), advertBlock(B), mapBlock(B, live)].filter(Boolean).map((b) => Object.assign({ sub: "Building sheet" }, b));
  const pages = pack(blocks);
  const body = pages.map((pg, i) => pageHtml(B, pg, i, pages.length, p)).join("");
  let html = head("Building sheet - " + B.name, body);
  if (live) html = html.replace("</style>", LIVE_MAP_CSS + "</style>").replace("<head>", '<head><meta name="viewport" content="width=device-width,initial-scale=1">').replace("</body>", "<script>" + LIVE_MAP_JS + "</script></body>");
  return { html, pages: pages.length };
}
export async function buildBuildingPdf(env, p, opts) {
  const L = await loadBuilding(env, p, opts);
  if (L.status !== 200) return L;
  const B = L.B, d = buildingHtml(B, p);
  const nm = String(B.name).replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return { status: 200, html: d.html, pages: d.pages, fname: "Building_" + nm + ".pdf", B };
}

// ------------------------------------------------------------------------------------------------ the options page (the same shell as the area sheet)
const PREP = "the reader of this sheet";
export function buildingConfig(B, o) {
  const p = B.C.p, win0 = p.win === "all" ? "all" : "12m";
  const sec = [];
  sec.push({ id: "win", title: "Sales window", type: "single", options: [
    { id: "12m", title: "Last 12 months", small: "Sales registered in the year to " + dateLong(B.asOf) + ".", icon: "chart-bar", set: { window: "12m" }, def: win0 === "12m" },
    { id: "all", title: "All years", small: "Every sale in the record since " + dateLong(B.first) + ".", icon: "chart-donut", set: { window: "all" }, def: win0 === "all" }] });
  sec.push({ id: "fmt", title: "Format", type: "single", options: [
    { id: "pdf", title: "PDF", small: "To send or print. The map is a drawing of the digital footprint.", icon: "stack", set: {}, def: true },
    { id: "html", title: "Web page", small: "To open on a phone. The map is a live 3D street map." + (B.owner ? " Adverts (owner only) appear here, never in the PDF." : ""), icon: "map-trifold", set: { format: "html" } }] });
  sec.push({ id: "add", title: "Add to the sheet", type: "multi", param: "contact", mode: "include", options: [
    { id: "contact", title: "Broker contact block", small: "Blank lines for your name, mobile and email, to fill in by hand.", icon: "chat-circle-text", val: "1", def: false }] });
  sec.push({ id: "prep", title: "Prepared for", type: "text", fields: [{ param: "client", title: "Name on the sheet", small: "Shown in the header. If left empty it reads: " + PREP + ".", ph: PREP, max: 60, always: PREP }] });
  const fixed = [["kind", "building"], ["area", B.slug], ["project", B.projectNo], ["name", B.name]].concat(B.bk != null ? [["bk", String(B.bk)]] : []);
  return {
    title: "Building broker sheet: choose the version", sub: esc(B.name) + " in " + esc(B.area) + ". One building. Sales data to " + esc(dateLong(B.asOf)) + ". The area sheet stays on the area's Snapshot and Detailed buttons.",
    sections: sec, base: "/developers_pdf", fixed, key: (o && o.key) || "", go: "Make the building sheet",
    coverNote: "The sheet states the window and the date of the register on every page.", icons: ["stack", "chart-bar", "chart-donut", "map-trifold", "chat-circle-text", "info"],
    core: [
      { title: "This building only", small: "The project's own registered sales, by its Land Department project number." },
      { title: "Sales and value", small: "Count, typical price and price per sq ft by bedrooms (from " + MIN_PRICED + " priced sales), recent sales, and the total value with deals over AED " + fmt(VALUE_CAP / 1e6) + "M left out." },
      { title: "Rents", small: "Registered rent contracts where the building has them; otherwise one line that says why." },
      { title: "Where it sits", small: "Its price per sq ft against the area's typical, its price band, and the map with the building in gold." },
      { title: "Legal footer", small: "The permit reminder and the page numbers. Past registered facts only: not an offer, not advice." }] };
}
