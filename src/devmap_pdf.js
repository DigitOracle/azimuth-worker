// DEVELOPERS BY AREA - THE TWO PDFs (v324, 4 Oct 2026).
//   GET /developers_pdf?kind=snapshot|detailed&area=<slug>&window=12m|all&developers=<ids, comma separated>&mode=buy|rent
//                      &budget=<from-to>&beds=<0..5>&basis=total|sqft|sqm&key=<client key or owner key>
//
// SNAPSHOT  one A4 page to leave with someone: the area, three headline figures, where it sits in Dubai, the four price bands as coloured
//           cards with the developers in each (the realtor's chosen developers first, with a star), and, when a client budget is given,
//           which of those developers fit it.
// DETAILED  several pages: the snapshot, then a section per price band (per-developer doughnuts, where each developer sits against the
//           others, the projects behind each share), the area map with project footprints coloured by price band, one map per chosen
//           developer, a profile page per chosen developer, the client's budget fit by location, and how the numbers are worked out.
//
// ONE SOURCE OF FIGURES: every figure comes from the same functions the Developers by area page runs (src/devmap_core.js, as real module code
// in src/devmap_dm.js) over the same published index (KV img_devmap_index); nothing here computes a price a second way. The window
// (last 12 months by default, or all years) drives every figure and is named on every page.
// ONE HOUSE LOOK: the Brief documents' browser, header picture, footer, fonts and map colours (BRIEF_KIT in src/brief_docs.js).
// RULES: a figure with fewer than 3 sales behind it is never printed; a missing fact is left out (never printed as "not known"); no
// emoji, no pictures (no photographs, satellite or renders), icons only (thin-line, inline, src/devmap_icons.js); no initials; a developer is
// never rated: price bands describe homes, and a developer is shown by the band most of its sales fall in.
import { DM } from "./devmap_dm.js";
import { COMMUNITY_LABELS, labelledName } from "./community_labels.js";
import { kvJson } from "./brief.js";
import { DEFAULT_SHORTLIST, shortlistName } from "./devmap_page.js";
import { PHOSPHOR_LIGHT } from "./devmap_icons.js";
import { BRIEF_KIT, esc, FOOTER_TEXT, WHATSAPP_NUMBER, HEADER_IMG_KEY, HEADER_JPG_KEY } from "./brief_docs.js";

const { NAVY, GOLD, MUTED, MAPC, KY, KH, PT } = BRIEF_KIT;
const TEAL = "#0A4F4A", GOLDI = "#C5A56A", INK = "#22262B", HAIR = "#E6E1D8";
const SQFT = DM.SQFT;
export const PERMIT_REMINDER = "Remember: adverts need the permit number.";
export const MAX_DEVELOPERS = 30;

// the four price bands in the page's own colours (the page's TC), with the tint and ink the paper needs
const BAND = [
  { name: "Top band", fill: "#C5A56A", wall: "#A98A4F", edge: "#7A6230", tint: "#F8F2E5", ink: "#6F5A2B" },
  { name: "Upper band", fill: "#2F8A7F", wall: "#23695F", edge: "#174A43", tint: "#E7F3F1", ink: "#1B6258" },
  { name: "Middle band", fill: "#3987E5", wall: "#2B69B3", edge: "#1D4A80", tint: "#E9F1FC", ink: "#1F5DB0" },
  { name: "Entry band", fill: "#8A9A96", wall: "#6C7B77", edge: "#4F5C59", tint: "#EEF1F0", ink: "#4E5B58" },
];
const BED_WORD = (b) => (b === 0 ? "studio" : b === 1 ? "1 bedroom" : b >= 5 ? "5 or more bedrooms" : b + " bedrooms");
const BED_CAP = (b) => { const w = BED_WORD(b); return w.charAt(0).toUpperCase() + w.slice(1); };

// ------------------------------------------------------------------------------------------------ small helpers
const fmt = (n) => (n == null || !isFinite(n) ? "" : Math.round(n).toLocaleString("en-US"));
const psf = (ppsm) => fmt(ppsm / SQFT);                       // AED per sq m -> AED per sq ft, printed
const aed = (n) => "AED " + fmt(n);
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function dateLong(x) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(x || "")); return m ? Number(m[3]) + " " + MONTHS[Number(m[2]) - 1] + " " + m[1] : ""; }
const norm = (s) => String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const loose = (s) => norm(String(s || "").replace(/\bby\b.*$/i, "").replace(/\b(the|tower|towers|residences?|building|apartments?)\b/gi, ""));
const plural = (n, one, many) => fmt(n) + " " + (n === 1 ? one : many || one + "s");
const cap1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// icons: thin-line, inline, one colour (src/devmap_icons.js, Phosphor light, MIT)
export function icon(name, size, color) {
  const ds = PHOSPHOR_LIGHT[name]; if (!ds) return "";
  return '<svg class="ic" viewBox="0 0 256 256" width="' + size + '" height="' + size + '" fill="' + (color || TEAL) + '" aria-hidden="true">' + ds.map((d) => '<path d="' + d + '"/>').join("") + "</svg>";
}
const secHead = (ic, title, sub) =>
  '<div class="sec"><span class="icw">' + icon(ic, 22, TEAL) + '</span><div><div class="serif sech">' + title + "</div>" + (sub ? '<div class="secs">' + sub + "</div>" : "") + "</div></div>";

// ------------------------------------------------------------------------------------------------ the window (the page's own ixOf, for the Worker)
export function windowText(IDX, win) {
  const M = IDX && IDX.ev;
  if (win === "l12" && M) return "Sales settled " + dateLong(M.l12_from) + " to " + dateLong(M.l12_to) + " (the last 12 months)";
  return M ? "Every settled sale since " + dateLong(M.since) + " (all years)" : "Every settled sale on record (all years)";
}
const hasEv = (a) => !!(a && a.ev && a.ev.all);
export function windowIndex(IDX, win) {
  const base = Object.assign({}, IDX);
  if (win !== "l12" || !IDX.ev) { base.window_say = windowText(IDX, "all") + "."; base.fellBack = []; return base; }
  const o = Object.assign({}, IDX), dl = {}, fb = [];
  o.areas = {};
  for (const s of Object.keys(IDX.areas)) {
    const a = IDX.areas[s];
    if (!hasEv(a)) { o.areas[s] = a; fb.push(a.name); continue; }
    const b = Object.assign({}, a); b.devs = {};
    for (const dk of Object.keys(a.devs)) {
      const d = a.devs[dk], e = Object.assign({}, d);
      e.c = d.c12 || []; e.b = d.b12 !== undefined ? d.b12 : (d.b || []);
      if (!e.c.length && !(d.r || []).length) continue;
      b.devs[dk] = e;
    }
    o.areas[s] = b;
  }
  for (const s of Object.keys(o.areas)) {
    const ds = o.areas[s].devs;
    for (const dk of Object.keys(ds)) {
      if (dk === "_") continue;
      const d = ds[dk]; if (!d.c.length && !(d.r || []).length) continue;
      const e = dl[dk] || (dl[dk] = { name: d.n, areas: 0, n: 0, profile: { projects: 0, homes: 0 } });
      e.areas++; e.profile.projects += (d.b || []).length; e.profile.homes += d.h || 0; for (const c of d.c) e.n += c[0];
    }
  }
  o.devs = dl; o.scale = DM.scaleCuts({ devs: dl }); o.window_say = windowText(IDX, "l12") + "."; o.fellBack = fb;
  return o;
}

// ------------------------------------------------------------------------------------------------ the request
export function parseMoney(t) {
  const m = /^\s*([0-9][0-9,]*\.?[0-9]*)\s*(k|thousand|m|mn|million)?\s*$/i.exec(String(t || "")); if (!m) return null;
  let v = Number(m[1].replace(/,/g, "")); if (!isFinite(v) || v <= 0) return null;
  const u = (m[2] || "").toLowerCase(); if (u === "k" || u === "thousand") v *= 1e3; else if (u) v *= 1e6;
  return Math.round(v);
}
export function parseBudget(sp) {
  let min = null, max = null;
  const b = String(sp.get("budget") || "").trim();
  if (b) { const parts = b.split(/\s*(?:-|–|:|\bto\b|\.\.)\s*/i).filter(Boolean); if (parts.length >= 2) { min = parseMoney(parts[0]); max = parseMoney(parts[1]); } else if (parts.length === 1) max = parseMoney(parts[0]); }
  if (sp.get("min") && parseMoney(sp.get("min"))) min = parseMoney(sp.get("min"));
  if (sp.get("max") && parseMoney(sp.get("max"))) max = parseMoney(sp.get("max"));
  if (min != null && max != null && min > max) { const t = min; min = max; max = t; }
  const bd = sp.get("beds"); let beds = null;
  if (bd != null && /^[0-5]$/.test(String(bd).trim())) beds = Number(bd);
  else if (bd != null && /^studio$/i.test(String(bd).trim())) beds = 0;
  return { min, max, beds, has: min != null || max != null };
}
export function parseParams(url) {
  const sp = url.searchParams;
  const kind = String(sp.get("kind") || "snapshot").toLowerCase();
  const mode = String(sp.get("mode") || "buy").toLowerCase();
  const win = /^(all|alltime|all-years)$/i.test(String(sp.get("window") || "")) ? "all" : "l12";
  const basis = ["total", "sqft", "sqm"].includes(String(sp.get("basis") || "").toLowerCase()) ? String(sp.get("basis")).toLowerCase() : "total";
  const devs = sp.get("developers") == null ? null : String(sp.get("developers")).split(",").map((s) => s.toLowerCase().replace(/[^a-z0-9 -]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60)).filter(Boolean).slice(0, MAX_DEVELOPERS);
  return { kind, mode, win, basis, area: String(sp.get("area") || "").toLowerCase().replace(/[^a-z0-9]/g, ""), devs, bud: parseBudget(sp), format: String(sp.get("format") || "pdf").toLowerCase(), key: sp.get("key") || "" };
}

// ------------------------------------------------------------------------------------------------ what the document is built from
async function chosenKeys(env, p, IDX) {
  let ids = p.devs;
  if (!ids) {
    let saved = null;
    try { const v = JSON.parse((await env.MEETINGS.get(await shortlistName(p.key))) || "null"); if (v && v.at && Array.isArray(v.devs)) saved = v.devs; } catch (e) {}
    ids = saved || DEFAULT_SHORTLIST.map((d) => d.id);
  }
  // v327 - the same resolution the page uses at load (saved ids from before the crosswalk, "select group" -> "select-group")
  const out = [];
  for (let k of DM.resolveSaved(IDX, ids.map((r) => String(r).toLowerCase()))) {
    if (!(IDX.devs && IDX.devs[k]) && IDX.devs && IDX.devs[k.replace(/ /g, "-")]) k = k.replace(/ /g, "-");
    if (!out.includes(k)) out.push(k);
  }
  return out;
}

const labelOf = (slug, name) => labelledName(slug, String(name || slug).replace(/\bJLT\b/g, "Jumeirah Lakes Towers"));

function budgetQuery(p) {
  const b = p.bud;
  if (!b.has) return null;
  return p.mode === "rent" ? { min: b.min, max: b.max, beds: b.beds } : { mode: p.basis, min: b.min, max: b.max, beds: b.beds };
}
export function budgetSay(p) {
  const b = p.bud; if (!b.has) return "";
  const u = p.mode === "rent" ? " a year" : p.basis === "sqft" ? " per sq ft" : p.basis === "sqm" ? " per sq m" : "";
  const range = b.min != null && b.max != null ? aed(b.min) + " to " + aed(b.max) : b.max != null ? "up to " + aed(b.max) : "from " + aed(b.min);
  return (b.beds != null ? BED_CAP(b.beds) + ", " : "") + range + u;
}

export async function loadData(env, p, opts) {
  const IDX0 = await kvJson(env, "devmap_index");
  if (!IDX0 || !IDX0.areas) return { status: 503, body: { ok: false, reason: "the developers index (KV img_devmap_index) is not on file yet" } };
  if (!p.area || !IDX0.areas[p.area]) return { status: 404, body: { ok: false, reason: "area not in the developers index", area: p.area } };
  const ix = windowIndex(IDX0, p.win);
  // a register name that is only Arabic letters in brackets (the company form, in Arabic initials) is dropped from a client page
  const cleanName = (s) => String(s || "").replace(/\s*[(（][^)）]*[؀-ۿ][^)）]*[)）]\s*/g, " ").replace(/\s+/g, " ").trim() || String(s || "");
  for (const dv of Object.values(ix.devs || {})) if (dv && dv.name) dv.name = cleanName(dv.name);
  for (const dv of Object.values(ix.areas[p.area].devs || {})) if (dv && dv.n) dv.n = cleanName(dv.n);
  const area = ix.areas[p.area], st = DM.areaStats(area, ix);
  const mine = {}; for (const k of await chosenKeys(env, p, IDX0)) mine[k] = true;
  const C = { p, IDX0, ix, slug: p.area, area, st, mine, buy: p.mode !== "rent", pages: 0 };
  C.today = BRIEF_KIT.todayLong(opts && opts.now);
  C.fell = p.win === "l12" && !hasEv(IDX0.areas[p.area]) && !!IDX0.ev;
  C.winText = C.fell ? windowText(IDX0, "all") + " (this area has no record by year, so the last 12 months cannot be shown)" : windowText(IDX0, p.win);
  C.names = { title: labelOf(p.area, area.name), plain: String(area.name || p.area).replace(/\bJLT\b/g, "Jumeirah Lakes Towers"), label: COMMUNITY_LABELS[p.area] || null };
  C.logo = (await BRIEF_KIT.kvDataUrl(env, HEADER_JPG_KEY, opts && opts.origin)) || (await BRIEF_KIT.kvDataUrl(env, HEADER_IMG_KEY, opts && opts.origin));
  C.geo = await kvJson(env, "district_polygons");
  C.bq = budgetQuery(p);
  if (C.bq) {
    try { C.meet = p.mode === "rent" ? DM.clientMeetingRent(ix, mine, C.bq) : DM.clientMeeting(ix, mine, C.bq, null).areas; } catch (e) { C.meet = []; }
  }
  C.wasHere = p.win === "l12" ? area.register_sales_12m : area.register_sales_all_time;
  C.registerTotal = (p.win === "l12" && hasEv(IDX0.areas[p.area]) && area.register_sales_12m != null) ? area.register_sales_12m : (area.register_sales_all_time || 0);
  return { status: 200, C };
}

// the projects (buildings with sales) of every developer in the area, with their price band; bound to footprints in loadMapData
function projectsOf(C) {
  const out = [], bounds = C.st.bounds;
  for (const k of Object.keys(C.area.devs || {})) {
    if (k === "_") continue;
    const d = C.area.devs[k];
    for (const b of d.b || []) {
      const enough = b[0] >= DM.EVIDENCE_MIN;
      out.push({ name: b[2] || null, ppsm: b[1], n: b[0], k, dev: d.n, mine: !!C.mine[k], enough, tier: enough ? DM.tierOf(b[1], bounds) : -1 });
    }
  }
  return out;
}

export async function loadMapData(env, C) {
  const slug = C.slug, projects = projectsOf(C);
  const [layer, um, mp, ri] = await Promise.all([kvJson(env, "brief_fp_" + slug), kvJson(env, "unitmix_" + slug), kvJson(env, "map_prices"), kvJson(env, "rent_index")]);
  const M = { layer: layer && Array.isArray(layer.b) && layer.b.length ? layer : null, projects, bound: 0 };
  if (!M.layer) return M;
  const have = new Set(M.layer.b.map((b) => b[0])), exact = new Map(), soft = new Map(), softBad = new Set();
  const put = (name, ids) => {
    const ok = ids.filter((i) => i != null && have.has(Number(i))).map(Number); if (!ok.length || !name) return;
    const k = norm(name); if (k && !exact.has(k)) exact.set(k, ok);
    const l = loose(name); if (l) { if (soft.has(l) && soft.get(l).join() !== ok.join()) softBad.add(l); else soft.set(l, ok); }
  };
  if (um && um.buildings_by_id) for (const [id, b] of Object.entries(um.buildings_by_id)) put(b && b.name, [Number(id)]);
  if (mp && Array.isArray(mp.items)) for (const it of mp.items) if (it.d === slug && it.i != null) put(it.n, [it.i]);
  if (ri && Array.isArray(ri.items)) for (const it of ri.items) if (it.d === slug && it.i != null) put(it.n, [it.i].concat(it.is || []));
  for (const pr of projects) {
    if (!pr.name) continue;
    const ids = exact.get(norm(pr.name)) || (softBad.has(loose(pr.name)) ? null : soft.get(loose(pr.name))) || null;
    if (ids) { pr.ids = ids; M.bound++; }
  }
  return M;
}

// ------------------------------------------------------------------------------------------------ vector outlines: where the area is in Dubai, and its own shape
function ringsOf(g) { if (!g) return []; if (g.type === "Polygon") return g.coordinates; if (g.type === "MultiPolygon") return [].concat(...g.coordinates); return []; }
export function outlinePanels(C) {
  const feats = C.geo && Array.isArray(C.geo.features) ? C.geo.features.filter((f) => f && f.geometry && f.properties) : [];
  let mine = feats.find((f) => f.properties.slug === C.slug), rings = mine ? ringsOf(mine.geometry) : null;
  let bb = C.area.bbox; if (!(rings && rings.length) && !(bb && bb.length === 4)) return "";
  const lat0 = 25.1, kx = Math.cos(lat0 * Math.PI / 180);
  const proj = (box, w, h, pad) => {
    const [x0, y0, x1, y1] = box, sx = (x1 - x0) * kx, sy = (y1 - y0), k = Math.min((w - 2 * pad) / sx, (h - 2 * pad) / sy);
    const ox = pad + ((w - 2 * pad) - sx * k) / 2, oy = pad + ((h - 2 * pad) - sy * k) / 2;
    return ([lon, lat]) => [Math.round((ox + (lon - x0) * kx * k) * 10) / 10, Math.round((oy + (y1 - lat) * k) * 10) / 10];
  };
  const pathOf = (rs, P) => rs.map((r) => { let last = ""; const o = []; for (const c of r) { const [a, b] = P(c), t = a + " " + b; if (t !== last) o.push(t); last = t; } return o.length > 2 ? "M" + o.join("L") + "Z" : ""; }).join("");
  const boxOf = (rs) => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const r of rs) for (const [x, y] of r) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); } return [a, b, c, d]; };
  // the locator: every area of the page as a pale silhouette of the city, this one in gold
  let loc = "";
  if (feats.length) {
    const all = [].concat(...feats.map((f) => ringsOf(f.geometry))), P = proj(boxOf(all), 190, 120, 6);
    const rest = feats.filter((f) => f.properties.slug !== C.slug).map((f) => pathOf(ringsOf(f.geometry), P)).join("");
    const me = mine ? pathOf(rings, P) : (bb ? pathOf([[[bb[0], bb[1]], [bb[2], bb[1]], [bb[2], bb[3]], [bb[0], bb[3]]]], P) : "");
    loc = '<svg class="loc" viewBox="0 0 190 120" width="190" height="120" role="img" aria-label="Where ' + esc(C.names.plain) + ' is in Dubai"><rect width="190" height="120" fill="#FBFAF7"/><path d="' + rest + '" fill="#E4E0D5" stroke="#CFC9B9" stroke-width="0.4" fill-rule="evenodd"/>' + (me ? '<path d="' + me + '" fill="' + GOLDI + '" stroke="' + TEAL + '" stroke-width="1" fill-rule="evenodd"/>' : "") + "</svg>";
  }
  const own = (rings && rings.length ? rings : [[[bb[0], bb[1]], [bb[2], bb[1]], [bb[2], bb[3]], [bb[0], bb[3]]]]);
  const Q = proj(boxOf(own), 120, 120, 8);
  const shape = '<svg class="loc" viewBox="0 0 120 120" width="120" height="120" role="img" aria-label="The outline of ' + esc(C.names.plain) + '"><rect width="120" height="120" fill="#FBFAF7"/><path d="' + pathOf(own, Q) + '" fill="' + GOLDI + '" fill-opacity="0.35" stroke="' + TEAL + '" stroke-width="1.3" stroke-linejoin="round" fill-rule="evenodd"/></svg>';
  return '<div class="locs">' + loc + shape + "</div>";
}

// ------------------------------------------------------------------------------------------------ the oblique footprint map (the Brief's view: 50 degrees, heights to scale)
// hi: Map(footprint id -> { fill, wall, edge, n }). frame "all": the whole district; "hi": the highlighted buildings with a margin.
export function obliqueMap(layer, hi, o) {
  const w = o.w, h = o.h, asp = h / w;
  const pairs = (f) => { const r = []; for (let k = 0; k + 1 < f.length; k += 2) r.push([f[k], f[k + 1]]); return r; };
  const all = layer.b.map(([id, hh, f]) => ({ id, h: hh, r: pairs(f) }));
  let src = o.frame === "hi" ? all.filter((b) => hi.has(b.id)) : all;
  if (!src.length) src = all;
  let gx0 = 1e12, gx1 = -1e12, v0 = 1e12, v1 = -1e12, gy0 = 1e12, gy1 = -1e12;
  for (const b of src) for (const [x, y] of b.r) { gx0 = Math.min(gx0, x); gx1 = Math.max(gx1, x); gy0 = Math.min(gy0, y); gy1 = Math.max(gy1, y); v0 = Math.min(v0, y * KY); v1 = Math.max(v1, y * KY + (b.h || 0) * KH); }
  const uc = (gx0 + gx1) / 2, vc = (v0 + v1) / 2;
  let Wf = o.frame === "hi" ? Math.max(320, (gx1 - gx0) * 1.5) : Math.max(gx1 - gx0, (v1 - v0) / asp) * 1.05;
  if (o.frame === "hi" && (v1 - v0) * 1.5 > Wf * asp) Wf = (v1 - v0) * 1.5 / asp;
  const Hf = Wf * asp, U0 = uc - Wf / 2, V0 = vc - Hf / 2, k = w / Wf;
  const X = (x) => Math.round((x - U0) * k * 10) / 10, Y = (y, hh) => Math.round((h - (y * KY + (hh || 0) * KH - V0) * k) * 10) / 10;
  const inFrame = (r, hh) => r.some(([x]) => x > U0 - 60 && x < U0 + Wf + 60) && r.some(([, y]) => y * KY + (hh || 0) * KH > V0 - 40 && y * KY < V0 + Hf + 40);
  const path = (pts) => { const q = []; let last = ""; for (const [x, y, hh] of pts) { const t = X(x) + " " + Y(y, hh); if (t !== last) q.push(t); last = t; } return q.length < 3 ? "" : "M" + q.join(" ") + "Z"; };
  const out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + " " + h + '" width="' + w + '" height="' + h + '" style="display:block;" role="img" aria-label="' + esc(o.label || "Map") + '">',
    "<style>.cr{fill:#E3E3DD;stroke:#C4C6BE;stroke-width:0.3;stroke-linejoin:round}</style>", '<rect width="' + w + '" height="' + h + '" fill="' + MAPC.BG + '"/>'];
  const coarse = o.frame !== "hi", lw = Math.max(0.5, Math.min(3, k * 4));
  const streets = (layer.s || []).map(([c, f]) => ({ c, r: pairs(f) })).filter((s) => (!coarse || s.c >= 4) && inFrame(s.r, 0));
  for (const pass of [0, 1]) {
    const d = streets.map((s) => { const q = []; let last = ""; for (const [x, y] of s.r) { const t = X(x) + " " + Y(y, 0); if (t !== last) q.push(t); last = t; } return q.length > 1 ? "M" + q.join(" ") : ""; }).join("");
    if (d) out.push('<path d="' + d + '" fill="none" stroke="' + (pass ? MAPC.STREET : MAPC.CASE) + '" stroke-width="' + Math.round(lw * (pass ? 1 : 1.6) * 100) / 100 + '" stroke-linecap="round" stroke-linejoin="round"/>');
  }
  const ctx = all.filter((b) => !hi.has(b.id) && inFrame(b.r, b.h));
  ctx.sort((a, b) => Math.min(...b.r.map((p) => p[1])) - Math.min(...a.r.map((p) => p[1])));
  const cd = ctx.map((b) => path(b.r.map(([x, y]) => [x, y, b.h]))).join("");
  if (cd) out.push('<path class="cr" d="' + cd + '"/>');
  const area = (r) => { let s = 0; for (let q = 0; q + 1 < r.length; q++) s += r[q][0] * r[q + 1][1] - r[q + 1][0] * r[q][1]; return s / 2; };
  const mine = all.filter((b) => hi.has(b.id) && inFrame(b.r, b.h));
  mine.sort((a, b) => Math.min(...b.r.map((p) => p[1])) - Math.min(...a.r.map((p) => p[1])));
  const anchors = new Map();
  for (const b of mine) {
    let r = b.r; if (area(r) < 0) r = r.slice().reverse();
    const c = hi.get(b.id), walls = [];
    for (let q = 0; q + 1 < r.length; q++) { const [x0, y0] = r[q], [x1, y1] = r[q + 1]; if (x1 - x0 > 0) walls.push([(y0 + y1) / 2, [[x0, y0, 0], [x1, y1, 0], [x1, y1, b.h], [x0, y0, b.h]]]); }
    walls.sort((a, d) => d[0] - a[0]);
    const wd = walls.map((x) => path(x[1])).join(""), rd = path(r.map(([x, y]) => [x, y, b.h]));
    if (wd) out.push('<path d="' + wd + '" fill="' + c.wall + '" stroke="' + c.edge + '" stroke-width="0.5" stroke-linejoin="round"/>');
    if (rd) out.push('<path d="' + rd + '" fill="' + c.fill + '" stroke="' + c.edge + '" stroke-width="0.6" stroke-linejoin="round"/>');
    if (c.n) { const pts = r.slice(0, -1), cx = pts.reduce((a, q) => a + q[0], 0) / pts.length, cy = pts.reduce((a, q) => a + q[1], 0) / pts.length, ex = anchors.get(c.n); if (!ex || ex.h < b.h) anchors.set(c.n, { x: X(cx), y: Y(cy, b.h), h: b.h }); }
  }
  // numbered badges, lifted above the roof and pushed apart so none overlap
  const R = o.badge || 9, pos = new Map();
  for (const [n, a] of anchors) pos.set(n, [a.x, a.y - 16]);
  const ns = [...pos.keys()];
  for (let it = 0; it < 300; it++) {
    let moved = false;
    for (const a of ns) for (const b of ns) {
      if (a >= b) continue; const pa = pos.get(a), pb = pos.get(b), dx = pb[0] - pa[0], dy = pb[1] - pa[1], d = Math.hypot(dx, dy) || 0.001;
      if (d < 2 * R + 3) { const push = (2 * R + 3 - d) / 2 + 0.5; pa[0] -= dx / d * push; pa[1] -= dy / d * push; pb[0] += dx / d * push; pb[1] += dy / d * push; moved = true; }
    }
    if (!moved) break;
  }
  for (const [n, [bx, by]] of pos) {
    const a = anchors.get(n), cx = Math.max(R, Math.min(w - R, bx)), cy = Math.max(R, Math.min(h - R, by));
    out.push('<g><line x1="' + a.x + '" y1="' + a.y + '" x2="' + Math.round(cx * 10) / 10 + '" y2="' + Math.round(cy * 10) / 10 + '" stroke="' + TEAL + '" stroke-width="0.8"/><circle cx="' + a.x + '" cy="' + a.y + '" r="1.8" fill="' + TEAL + '"/><circle cx="' + Math.round(cx * 10) / 10 + '" cy="' + Math.round(cy * 10) / 10 + '" r="' + R + '" fill="' + TEAL + '" stroke="' + GOLDI + '" stroke-width="1.2"/><text x="' + Math.round(cx * 10) / 10 + '" y="' + Math.round(cy * 10) / 10 + '" font-size="' + (R * 1.15) + '" font-weight="bold" fill="#FFFFFF" text-anchor="middle" dominant-baseline="central" font-family="IBM Plex Sans, Segoe UI, Arial, sans-serif">' + n + "</text></g>");
  }
  out.push("</svg>");
  return out.join("");
}

// ------------------------------------------------------------------------------------------------ pieces: doughnut, position bar, band cards
function donut(ts, size) {
  const v = [0, 1, 2, 3].map((i) => { const x = Number(ts && ts[i]); return isFinite(x) && x > 0 ? x : 0; }), tot = v[0] + v[1] + v[2] + v[3];
  if (!(tot > 0)) return { svg: "", legend: "" };
  const R = 20, Cc = 2 * Math.PI * R, live = v.filter((x) => x > 0).length, gap = live > 1 ? 1.6 : 0;
  let off = 0, segs = "", top = 0;
  for (let i = 1; i < 4; i++) if (v[i] > v[top]) top = i;
  for (let i = 0; i < 4; i++) { if (!(v[i] > 0)) continue; const len = v[i] / tot * Cc, d = Math.max(len - gap, 0.01); segs += '<circle cx="26" cy="26" r="' + R + '" fill="none" stroke="' + BAND[i].fill + '" stroke-width="6" stroke-dasharray="' + d.toFixed(2) + " " + (Cc - d).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '"/>'; off += len; }
  const split = [0, 1, 2, 3].filter((k) => v[k] > 0).sort((a, b) => v[b] - v[a]).map((k) => BAND[k].name + " " + v[k] + "%").join(", ");
  const svg = '<svg viewBox="0 0 52 52" width="' + size + '" height="' + size + '" role="img" aria-label="Sales by price band: ' + esc(split) + '"><g transform="rotate(-90 26 26)">' + segs + '</g><text x="26" y="29.5" text-anchor="middle" font-size="11" font-weight="600" fill="' + INK + '" font-family="IBM Plex Sans, Segoe UI, Arial, sans-serif">' + Math.round(v[top]) + "%</text></svg>";
  const legend = [0, 1, 2, 3].filter((k) => v[k] >= 5).sort((a, b) => v[b] - v[a]).map((k) => '<div class="lg"><i style="background:' + BAND[k].fill + '"></i>' + BAND[k].name + " " + v[k] + "%</div>").join("");
  return { svg, legend };
}

// "where this developer sits against the others in the area": a thin bar from the cheapest to the dearest developer price, one dot per developer
function positionBar(d, peers) {
  const vals = peers.map((x) => x.medianSqft), lo = Math.min(...vals), hi = Math.max(...vals);
  if (peers.length < 2 || !(hi > lo)) return "";
  const W = 300, x = (v) => 8 + (v - lo) / (hi - lo) * (W - 16);
  const dots = peers.filter((q) => q.k !== d.k).map((q) => '<circle cx="' + x(q.medianSqft).toFixed(1) + '" cy="12" r="2.6" fill="#B7BFBC"/>').join("");
  const below = peers.filter((q) => q.medianSqft < d.medianSqft).length, above = peers.filter((q) => q.medianSqft > d.medianSqft).length;
  return '<div class="pbar"><svg viewBox="0 0 ' + W + ' 34" width="100%" height="34" role="img" aria-label="Where ' + esc(d.name) + ' sits against the other developers here"><line x1="8" x2="' + (W - 8) + '" y1="12" y2="12" stroke="#D6D2C6" stroke-width="1.2"/>' + dots +
    '<circle cx="' + x(d.medianSqft).toFixed(1) + '" cy="12" r="5" fill="' + GOLDI + '" stroke="' + TEAL + '" stroke-width="1.2"/><text x="8" y="30" font-size="8.5" fill="' + MUTED + '" font-family="IBM Plex Sans, Segoe UI, Arial, sans-serif">AED ' + fmt(lo) + '</text><text x="' + (W - 8) + '" y="30" font-size="8.5" fill="' + MUTED + '" text-anchor="end" font-family="IBM Plex Sans, Segoe UI, Arial, sans-serif">AED ' + fmt(hi) + "</text></svg>" +
    '<div class="pcap">Against the other developers here, per sq ft: ' + plural(below, "is", "are") + " priced lower and " + above + " higher. The bar runs from the lowest to the highest developer price in this area.</div></div>";
}

function typicalPrices(t, bounds) {
  const edge = t === 0 ? bounds[0] : t === 1 ? bounds[1] : bounds[2], lab = ["Studio", "1 bedroom", "2 bedrooms", "3 bedrooms"];
  return DM.TYPICAL_SQFT.map((x, i) => [lab[i], (t === 3 ? "under " : "from ") + aed(Math.round(edge * x[1] / SQFT / 1000) * 1000)]);
}
const bandRange = (t, bounds) => {
  const e = DM.bandLine(t, bounds, "sqft");
  return e;                                   // "AED 3,000 and above per sq ft" / "AED 2,100 to 3,000 per sq ft" / "under AED 1,550 per sq ft"
};

// v327 - HOW SURE: q = [sales the register confirms, sales matched by project name] (the page's qNote, in words for print)
export function qWords(e) {
  const q = e && e.q; if (!q || !(q[1] > 0)) return "";
  const t = q[0] + q[1];
  return q[0] === 0 ? "matched by project name" : Math.round(100 * q[0] / t) + "% confirmed by the register, the rest matched by project name";
}
// a developer name, shortened at a word boundary: legal endings and generic words come off first, then whole words, never mid-word
export function shortName(name, max) {
  let s = String(name || "").replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const ends = /\s+(?:real estate development|real estate|properties|property|development|developments|developers|developer|investments?|holding|holdings|group|llc|l\.l\.c|fz-?llc|fze|co|company|limited|ltd|inc)\.?$/i;
  let guard = 0;
  while (s.length > max && ends.test(s) && s.replace(ends, "").trim().length >= 4 && guard++ < 4) s = s.replace(ends, "").trim();
  if (s.length <= max) return s;
  const w = s.split(" "); while (w.length > 1 && w.join(" ").length > max) w.pop();
  return w.join(" ");
}
function devLine(C, d) {
  const prj = ((C.area.devs[d.k] || {}).b || []).length;
  return '<div class="dl"><span class="st">' + (C.mine[d.k] ? icon("star", 11, GOLDI) : "") + '</span><span class="dn2">' + esc(shortName(d.name, 24)) + "</span><span>" + aed(d.medianSqft) + " per sq ft</span><span>" + plural(d.n, "sale") + "</span><span>" + (prj ? plural(prj, "project") : "") + "</span></div>" + (qWords(C.area.devs[d.k]) ? '<div class="qn2">' + esc(shortName(d.name, 24)) + ": " + qWords(C.area.devs[d.k]) + "</div>" : "");
}

function bandCard(C, t, lineCap) {
  const st = C.st, tr = st.tiers[t], B = BAND[t];
  const devs = tr.devs.slice().sort((a, b) => (C.mine[b.k] ? 1 : 0) - (C.mine[a.k] ? 1 : 0) || b.n - a.n);
  const nMine = devs.filter((d) => C.mine[d.k]).length, cap = Math.max(lineCap, nMine);
  const shown = devs.slice(0, cap), more = devs.length - shown.length;
  const prices = typicalPrices(t, st.bounds);
  return '<div class="bc" style="background:' + B.tint + ";border-left:5px solid " + B.fill + '"><div class="bch"><span class="bcn" style="color:' + B.ink + '">' + B.name + '</span><span class="bcr">' + esc(bandRange(t, st.bounds)) + "</span></div>" +
    '<div class="bcp">' + prices.map((c) => "<div><small>" + c[0] + "</small><b>" + c[1] + "</b></div>").join("") + "</div>" +
    '<div class="bcs"><b>' + st.mixN[t] + "%</b> of sales here &middot; <b>" + st.mixValue[t] + "%</b> of the money</div>" +
    (shown.length ? '<div class="bcl">' + shown.map((d) => devLine(C, d)).join("") + (more > 0 ? '<div class="more">and ' + plural(more, "more developer") + " in this band</div>" : "") + "</div>"
      : '<div class="more" style="margin-top:6px">No developer with 3 or more sales sits in this band here.</div>') + "</div>";
}

function budgetLineHtml(C) {
  if (!C.bq) return "";
  const here = (C.p.mode === "rent" ? C.meet : C.meet).find((a) => a.slug === C.slug), say = esc(budgetSay(C.p));
  let body;
  if (!here || !here.devs.length) body = "none fit this budget here with 3 or more sales behind the figure.";
  else body = "the ones that fit here are " + here.devs.map((d) => {
    const v = C.p.mode === "rent" ? aed(d.rent) + " a year" : (C.bq.mode === "total" && d.fitMedian ? aed(d.fitMedian) : aed(d.medianSqft) + " per sq ft");
    return "<b>" + esc(d.name) + "</b> (" + v + ")"; }).join(", ") + ".";
  return '<div class="bud">' + icon("wallet", 18, TEAL) + "<div><b>Client budget: " + say + ".</b> Your developers: " + body + "</div></div>";
}

// ------------------------------------------------------------------------------------------------ the snapshot page
function incompleteNote(C) {
  const st = C.st, reg = C.registerTotal, partial = !!(reg && st.n < reg * 0.7), thin = st.enough && (st.n < 100 || (st.unknown && st.unknown.n >= st.n * 0.5));
  if (!partial && !thin) return "";
  const t = partial ? plural(st.n, "settled sale") + " of about " + fmt(reg) + " in this area are loaded" + (st.unknown && st.unknown.n >= st.n * 0.3 ? ", and the developer is not recorded on " + fmt(st.unknown.n) + " of them" : "") + ". Read the figures as a first look, not as the whole market."
    : st.n < 100 ? "Only " + plural(st.n, "sale is", "sales are") + " loaded for this area so far. Read the figures as a first look, not as the market."
    : "The developer is not recorded on " + fmt(st.unknown.n) + " of the " + fmt(st.n) + " sales here, so the developer figures are partial. Read them as a first look, not as the whole market.";
  return '<div class="note2">' + icon("info", 16, TEAL) + "<div><b>This view is not complete yet.</b> " + esc(t) + "</div></div>";
}

function snapshotBody(C) {
  const st = C.st, lab = C.names.label;
  const head = '<div class="ttl"><div>' + '<div class="lbl" style="margin-bottom:3px;text-transform:uppercase">Developers by area</div><h1 class="serif">' + esc(C.names.title) + "</h1>" +
    '<div class="tsub">' + (lab ? "Market name " + esc(lab.labels.join(" / ")) + ". Land Department area " + esc(lab.dld) + "." : "Land Department area " + esc(C.names.plain) + ".") + "</div></div>" + outlinePanels(C) + "</div>";
  if (!st.enough) return head + '<div class="note2">' + icon("info", 16, TEAL) + "<div>Not enough sales: fewer than 3 settled sales with a price and a size are on the register for this area, so there is no price to show. " + esc(C.winText) + ".</div></div>";
  const tiles = '<div class="tiles"><div class="tile"><div class="tk">Median price</div><div class="tv">' + aed(st.medianSqft) + '</div><div class="tu">per sq ft</div></div>' +
    '<div class="tile"><div class="tk">Middle half of sales</div><div class="tv">' + fmt(st.q1 / SQFT) + " to " + fmt(st.q3 / SQFT) + '</div><div class="tu">AED per sq ft</div></div>' +
    '<div class="tile"><div class="tk">Sales loaded</div><div class="tv">' + fmt(st.n) + '</div><div class="tu">' + (C.registerTotal && st.n <= C.registerTotal ? "of " + fmt(C.registerTotal) + " in the register" : "settled sales") + "</div></div></div>";
  const cap = 7;
  const grid = '<div class="bgrid">' + [0, 1, 2, 3].map((t) => bandCard(C, t, cap)).join("") + "</div>";
  return head + tiles + incompleteNote(C) + grid + budgetLineHtml(C);
}

// ------------------------------------------------------------------------------------------------ the detailed pages
const LH = 13;                                         // a text line in the project lists, px
function projectsBehind(C, k, d) {
  const prs = projectsOf(C).filter((p) => p.k === k && p.name), groups = [[], [], [], []], rows = [];
  for (const p of prs) if (p.tier >= 0) groups[p.tier].push(p);
  let lines = 0, html = "";
  for (let t = 0; t < 4; t++) {
    const g = groups[t].sort((a, b) => b.n - a.n); if (!g.length) continue;
    const show = g.slice(0, 5), more = g.length - show.length;
    html += '<div class="pj"><div class="pjh" style="color:' + BAND[t].ink + '"><i style="background:' + BAND[t].fill + '"></i>' + BAND[t].name + " &middot; " + plural(g.length, "project") + "</div>" +
      show.map((p) => "<div>" + esc(p.name) + " &middot; " + aed(p.ppsm / SQFT) + " per sq ft &middot; " + plural(p.n, "sale") + "</div>").join("") + (more > 0 ? '<div class="more">and ' + plural(more, "more project") + "</div>" : "") + "</div>";
    lines += 1 + show.length + (more > 0 ? 1 : 0);
    rows.push(t);
  }
  const noprice = prs.filter((p) => p.tier < 0).length;
  if (noprice) { html += '<div class="more">plus ' + plural(noprice, "project") + " with under 3 sales, so no price.</div>"; lines += 1; }
  return { html, lines };
}

function devBlock(C, d, peers) {
  const dn = donut(d.tierShare, 74), pb = positionBar(d, peers), pj = projectsBehind(C, d.k, d), prof = DM.devProfile(C.ix, d.k);
  const html = '<div class="db"><div class="dbh"><div class="dbn">' + (C.mine[d.k] ? icon("star", 13, GOLDI) + " " : "") + esc(d.name) + "</div><div class=\"dbm\">" + aed(d.medianSqft) + " per sq ft &middot; " + plural(d.n, "sale") + (prof.projects ? " &middot; " + plural(prof.projects, "project") : "") + "</div></div>" +
    '<div class="dbg"><div class="dnw">' + dn.svg + '<div class="lgs">' + dn.legend + '</div></div><div>' + pb + "</div></div>" + (pj.html ? '<div class="pjs">' + pj.html + "</div>" : "") + "</div>";
  return { html, h: 30 + 82 + 12 + pj.lines * LH + (pj.lines ? 14 : 0) + 6 };
}

function compactDev(C, d) {
  const q = qWords(C.area.devs[d.k]), prof = DM.devProfile(C.ix, d.k), dn = donut(d.tierShare, 40);
  const html = '<div class="db" style="padding:6px 10px"><div style="display:flex;gap:10px;align-items:center">' + dn.svg + '<div><div class="dbn">' + (C.mine[d.k] ? icon("star", 12, GOLDI) + " " : "") + esc(shortName(d.name, 40)) + '</div><div class="dbm">' + aed(d.medianSqft) + " per sq ft &middot; " + plural(d.n, "sale") + (prof.projects ? " &middot; " + plural(prof.projects, "project") : "") + (q ? " &middot; " + q : "") + "</div></div></div></div>";
  return { html, h: 58 };
}
function denseList(C, devs, title, cont) {
  const per = 3 * 40, out = [];
  for (let i = 0; i < devs.length; i += per) {
    const ch = devs.slice(i, i + per), cols = [0, 1, 2].map((c) => ch.slice(c * 40, c * 40 + 40).map((d) => '<div class="ul"><span class="sp"></span><span class="un">' + esc(shortName(d.name, 24)) + (qWords(C.area.devs[d.k]) ? ' <i class="qn">(by project name)</i>' : "") + '</span><span class="uv">' + aed(d.medianSqft) + " &middot; " + d.n + "</span></div>").join(""));
    out.push({ h: 40 + Math.ceil(ch.length / 3) * 17, html: '<div class="otl"><div class="otlh">' + (i === 0 ? title : title + " (continued)") + '</div><div class="ulg">' + cols.map((c) => '<div class="ulc">' + c + "</div>").join("") + "</div></div>" });
  }
  return out;
}
function otherRows(C, devs) {
  if (!devs.length) return null;
  const rows = devs.map((d) => '<tr><td>' + esc(shortName(d.name, 44)) + (qWords(C.area.devs[d.k]) ? ' <span class="qn">' + qWords(C.area.devs[d.k]) + "</span>" : "") + "</td><td class=\"r\">" + aed(d.medianSqft) + "</td><td class=\"r\">" + fmt(d.n) + "</td><td class=\"r\">" + (((C.area.devs[d.k] || {}).b || []).length || "") + "</td></tr>");
  return rows;
}

function bandSections(C) {
  const blocks = [], peers = C.st.tiers.flatMap((t) => t.devs), nChosen = peers.filter((d) => C.mine[d.k]).length;
  for (let t = 0; t < 4; t++) {
    const tr = C.st.tiers[t], B = BAND[t];
    if (!tr.devs.length) continue;
    const devs = tr.devs.slice().sort((a, b) => (C.mine[b.k] ? 1 : 0) - (C.mine[a.k] ? 1 : 0) || b.n - a.n);
    let full = devs.filter((d) => C.mine[d.k]); if (!full.length) full = devs.slice(0, 4);
    const rest = devs.filter((d) => !full.includes(d));
    const sub = "Developers by price band";
    blocks.push({ sub, h: 70, keep: true, html: '<div class="bsh" style="border-left:5px solid ' + B.fill + ";background:" + B.tint + '">' + icon("stack", 22, B.ink) + '<div><div class="serif sech" style="color:' + B.ink + '">' + B.name + "</div><div class=\"secs\">" + esc(bandRange(t, C.st.bounds)) + " &middot; " + C.st.mixN[t] + "% of sales and " + C.st.mixValue[t] + "% of the money here &middot; " + plural(tr.devs.length, "developer") + ". Price bands describe homes, not developers.</div></div></div>" });
    for (const d of full) { const b = nChosen > 3 ? compactDev(C, d) : devBlock(C, d, peers); blocks.push({ sub, h: b.h, html: b.html }); }
    if (rest.length) for (const x of denseList(C, rest, "Other developers in the " + B.name.toLowerCase() + " here (name, median per sq ft, sales)")) blocks.push({ sub, h: x.h, html: x.html });
  }
  if (C.st.notEnough.length) blocks.push({ sub: "Developers by price band", h: 24 + Math.ceil(Math.min(C.st.notEnough.length, 60) * 28 / 115) * 14, html: '<div class="more">Developers with fewer than 3 sales here, so no price: ' + C.st.notEnough.slice(0, 60).map((d) => esc(shortName(d.name, 28)) + " (" + d.n + ")").join(", ") + (C.st.notEnough.length > 60 ? " and " + (C.st.notEnough.length - 60) + " more" : "") + ".</div>" });
  return blocks;
}

// the area map, and the projects that cannot be placed on it
function bandColour(t) { return t >= 0 ? BAND[t] : { fill: "#CFCBC0", wall: "#B5B0A3", edge: "#8F8A7B" }; }
function unboundList(M, C, title, items) {
  if (!items.length) return null;
  items = items.slice().sort((a, b) => (b.mine ? 1 : 0) - (a.mine ? 1 : 0) || b.n - a.n);
  const line = (p) => '<div class="ul">' + (p.mine ? icon("star", 9, GOLDI) : '<span class="sp"></span>') + "<span class=\"un\">" + esc(p.name || "Unnamed project") + "</span><span class=\"uv\">" + (p.enough ? aed(p.ppsm / SQFT) + " &middot; " : "") + plural(p.n, "sale") + "</span></div>";
  return { items, line, title };
}
function mapPages(C, M) {
  const pages = [];
  if (!M.projects.length) return pages;
  const bound = M.projects.filter((p) => p.ids), unbound = M.projects.filter((p) => !p.ids);
  const subA = "Where the projects are";
  if (M.layer && bound.length) {
    const hi = new Map(); let cnt = [0, 0, 0, 0, 0];
    for (const p of bound) { const c = bandColour(p.tier); cnt[p.tier < 0 ? 4 : p.tier]++; for (const id of p.ids) if (!hi.has(id)) hi.set(id, { fill: c.fill, wall: c.wall, edge: c.edge }); }
    const svg = obliqueMap(M.layer, hi, { w: 702, h: 600, frame: "all", label: "Map of " + C.names.plain + ": project footprints coloured by price band" });
    const key = [0, 1, 2, 3].filter((t) => cnt[t]).map((t) => '<div class="lg" style="font-size:10.5px"><i style="background:' + BAND[t].fill + '"></i>' + BAND[t].name + ": " + plural(cnt[t], "project") + "</div>").join("") + (cnt[4] ? '<div class="lg" style="font-size:10.5px"><i style="background:#CFCBC0"></i>Under 3 sales, no price: ' + plural(cnt[4], "project") + "</div>" : "");
    pages.push({ sub: subA, h: 640, html: secHead("map-trifold", "The area map", plural(bound.length, "project") + " with a building outline on the map, coloured by the price band its price per sq ft falls in") + '<div class="mapbox">' + svg + '</div><div class="mkey">' + key + '</div><div class="mnote">Buildings with no colour are other buildings. The picture is the Brief&rsquo;s map view: each outline raised to its height, seen from the south.</div>' });
  }
  const ul = unboundList(M, C, "", unbound);
  if (ul) {
    const per = 3 * 38, chunks = [];
    for (let i = 0; i < ul.items.length; i += per) chunks.push(ul.items.slice(i, i + per));
    chunks.forEach((ch, ci) => {
      const cols = [0, 1, 2].map((c) => ch.slice(c * 38, c * 38 + 38).map(ul.line).join(""));
      pages.push({ sub: subA, h: 70 + Math.ceil(ch.length / 3) * 16, html: (ci === 0 ? secHead("buildings", "Registered here, no map position yet", plural(unbound.length, "project") + " with sales on the register that cannot yet be placed on the map. Each is kept here with its sales and price.") : '<div class="otlh">Registered here, no map position yet (continued)</div>') + '<div class="ulg">' + cols.map((c) => '<div class="ulc">' + c + "</div>").join("") + "</div>" });
    });
  }
  return pages;
}

function developerMaps(C, M, chosen) {
  const out = [];
  for (const d of chosen) {
    const prs = M.projects.filter((p) => p.k === d.k && p.name || p.k === d.k && !p.name);
    if (!prs.length) continue;
    const bound = prs.filter((p) => p.ids).sort((a, b) => b.n - a.n), unb = prs.filter((p) => !p.ids).sort((a, b) => b.n - a.n);
    const sub = "Where " + esc(d.name) + " sits";
    let svg = "", n = 0; const numbered = new Map();
    if (M.layer && bound.length) {
      const hi = new Map();
      bound.forEach((p) => { n++; numbered.set(p, n); const c = bandColour(p.tier); for (const id of p.ids) if (!hi.has(id)) hi.set(id, { fill: c.fill, wall: c.wall, edge: c.edge, n }); });
      svg = obliqueMap(M.layer, hi, { w: 702, h: 400, frame: "hi", badge: 10, label: "Where " + d.name + " sits in " + C.names.plain });
    }
    const shown = bound.slice(0, 22), rows = [];
    for (const p of shown) rows.push('<tr><td class="num">' + numbered.get(p) + "</td><td>" + esc(p.name) + "</td><td class=\"r\">" + (p.enough ? aed(p.ppsm / SQFT) : "") + "</td><td class=\"r\">" + fmt(p.n) + "</td><td>" + (p.tier >= 0 ? '<span class="bd" style="background:' + BAND[p.tier].tint + ";color:" + BAND[p.tier].ink + '">' + BAND[p.tier].name + "</span>" : "") + "</td></tr>");
    const more = bound.length - shown.length;
    const unrows = unb.slice(0, 12).map((p) => '<tr><td class="num"></td><td>' + esc(p.name || "Unnamed project") + "</td><td class=\"r\">" + (p.enough ? aed(p.ppsm / SQFT) : "") + "</td><td class=\"r\">" + fmt(p.n) + "</td><td>" + (p.tier >= 0 ? '<span class="bd" style="background:' + BAND[p.tier].tint + ";color:" + BAND[p.tier].ink + '">' + BAND[p.tier].name + "</span>" : "") + "</td></tr>");
    const moreU = unb.length - Math.min(12, unb.length);
    const tbl = (rows.length || unrows.length) ? '<table class="tb"><thead><tr><th class="num"></th><th>Project</th><th class="r">Median per sq ft</th><th class="r">Sales</th><th>Price band</th></tr></thead><tbody>' + rows.join("") + "</tbody></table>" +
      (more > 0 ? '<div class="more">and ' + plural(more, "more project") + " on the map</div>" : "") +
      (unb.length ? '<div class="otlh" style="margin-top:8px">Registered here, no map position yet</div><table class="tb"><tbody>' + unrows.join("") + "</tbody></table>" + (moreU > 0 ? '<div class="more">and ' + plural(moreU, "more project") + "</div>" : "") : "") : "";
    out.push({ sub, h: 120 + (svg ? 410 : 0) + (rows.length + unrows.length) * 20 + (unb.length ? 36 : 0), html: secHead("map-pin", "Where " + esc(d.name) + " sits in " + esc(C.names.plain), plural(prs.length, "project") + " with sales here" + (bound.length ? ", " + bound.length + " on the map" : "") + ". " + aed(d.medianSqft) + " per sq ft across its sales here.") + (svg ? '<div class="mapbox">' + svg + "</div>" : "") + tbl });
  }
  return out;
}

// the developer profile pages (the page's own profile, in print)
function compactProfile(C, M, chosen) {
  const blocks = [], ix = C.ix;
  for (const d of chosen) {
    const k = d.k, p = DM.devProfile(ix, k), f = DM.devFactors(ix, k), tp = DM.talkingPoint(ix, k, "sqft");
    if (!p.areas) continue;
    const sub = "Developer profile &middot; " + esc(p.name), nm = esc(p.name);
    const dn = donut(p.basis === "projects" ? p.mixProjects : p.mixSales, 70);
    const market = p.market >= 0 ? '<div class="card2"><div class="ck">Market view</div><div class="cv" style="font-size:15px">' + esc(DM.brandLabel(p.market)) + "</div></div>" : "";
    const where = '<div class="card2" style="flex:1"><div class="ck">Where its projects sit on price</div><div class="cv" style="font-size:13px">' + esc(DM.dataLine(p)) + '</div><div class="dnw" style="margin-top:4px">' + dn.svg + '<div class="lgs">' + dn.legend + "</div></div></div>";
    const q = qWords(C.area.devs[k]);
    const rows = []; const row = (name, txt) => rows.push('<div class="fr"><b>' + name + "</b><span>" + txt + "</span></div>");
    const pl = f.priceLevel, iv = f.inventory, um = f.unitMix;
    if (pl) row("Price level", "Median " + aed(pl.medianSqft) + " per sq ft, " + Math.abs(Math.round(100 * (pl.ratio - 1))) + "% " + (pl.ratio >= 1 ? "above" : "below") + " the Dubai-wide median of " + aed(pl.dubaiSqft) + ".");
    if (iv) row("Inventory and scale", iv.projects != null ? plural(iv.projects, "project") + ", " + plural(iv.sales, "settled sale") + ", " + plural(iv.areas, "area") + "." : plural(iv.sales, "settled sale") + " in " + plural(iv.areas, "area") + ".");
    if (um) row("Unit mix", um.studioOne + "% studios and one-bedrooms, " + um.shares[2] + "% two-bedrooms, " + um.shares[3] + "% three bedrooms or more.");
    const prs = projectsOf(C).filter((x) => x.k === k).sort((a, b) => b.n - a.n), top = prs.slice(0, 6);
    const tbl = top.length ? '<table class="tb"><thead><tr><th>Project here</th><th class="r">Median per sq ft</th><th class="r">Sales</th><th>Price band</th></tr></thead><tbody>' + top.map((x) => "<tr><td>" + esc(x.name || "Unnamed project") + '</td><td class="r">' + (x.enough ? aed(x.ppsm / SQFT) : "") + '</td><td class="r">' + fmt(x.n) + "</td><td>" + (x.tier >= 0 ? '<span class="bd" style="background:' + BAND[x.tier].tint + ";color:" + BAND[x.tier].ink + '">' + BAND[x.tier].name + "</span>" : "") + "</td></tr>").join("") + "</tbody></table>" + (prs.length > top.length ? '<div class="more">and ' + plural(prs.length - top.length, "more project") + " here</div>" : "") : "";
    blocks.push({ sub, h: 600, html: '<div class="pf">' + icon("buildings", 24, TEAL) + '<div><h2 class="serif">' + nm + '</h2><div class="tsub">Developer profile &middot; ' + esc(C.winText) + (q ? " &middot; " + q : "") + '</div></div></div><div class="two">' + market + where + "</div>" +
      (rows.length ? '<div class="frs">' + rows.join("") + "</div>" : "") + tbl + '<div class="tpb">' + tp.lines.slice(0, 2).map((l) => "<p>" + esc(l) + "</p>").join("") + "</div>" });
  }
  return blocks;
}
function profileBlocks(C, chosen) {
  const blocks = [], bounds = C.st.bounds, ix = C.ix;
  for (const d of chosen) {
    const k = d.k, p = DM.devProfile(ix, k), f = DM.devFactors(ix, k), tp = DM.talkingPoint(ix, k, "sqft");
    const sub = "Developer profile &middot; " + esc(p.name);
    if (!p.areas) continue;
    const nm = esc(p.name);
    const market = p.market >= 0 ? '<div class="card2"><div class="ck">Market view</div><div class="cv">' + esc(DM.brandLabel(p.market)) + '</div><div class="cn">How the market names this brand. A person sets it; price alone does not say whether a developer is luxury.</div></div>' : "";
    const dn = donut(p.basis === "projects" ? p.mixProjects : p.mixSales, 84);
    const where = '<div class="card2" style="flex:1"><div class="ck">Where its projects sit on price</div><div class="cv" style="font-size:15px">' + esc(DM.dataLine(p)) + '</div><div class="dnw" style="margin-top:6px">' + dn.svg + '<div class="lgs">' + dn.legend + '</div></div><div class="cn">' + (p.basis === "projects" ? "A project is a building with settled sales on record, placed in a price band by that building&rsquo;s median price per sq ft." : "Project counts are not in the data yet, so this is where most of its sales fall.") + "</div></div>";
    const scale = p.scale ? '<div class="cn" style="margin-top:6px"><b>' + esc(p.scale) + "</b>: " + (p.projects != null ? plural(p.projects, "project") + " in " : "") + plural(p.areas, "area") + ". " + esc(DM.scaleSay(p.cuts)) + "</div>" : "";
    blocks.push({ sub, h: 96 + 190, html: '<div class="pf">' + icon("buildings", 24, TEAL) + '<div><h2 class="serif">' + nm + '</h2><div class="tsub">Developer profile &middot; ' + esc(C.winText) + "</div></div></div>" + '<div class="two">' + market + where + "</div>" + scale });
    // the factors, each a number as it is
    const rows = []; const row = (name, txt) => rows.push('<div class="fr"><b>' + name + "</b><span>" + txt + "</span></div>");
    const pl = f.priceLevel, pr = f.premium, iv = f.inventory, um = f.unitMix, lo = f.location;
    if (pl) row("Price level", "Median " + aed(pl.medianSqft) + " per sq ft, " + Math.abs(Math.round(100 * (pl.ratio - 1))) + "% " + (pl.ratio >= 1 ? "above" : "below") + " the Dubai-wide median of " + aed(pl.dubaiSqft) + ". Priced higher than " + pl.pctBelow + " in every 100 developers (" + pl.below + " of " + pl.total + " developers with 3 or more sales are priced lower).");
    if (pr) row("Price against its surroundings", "Across " + plural(pr.areas, "area") + " where it has 3 or more sales, its median is " + (Math.abs(Math.round(100 * (pr.ratio - 1))) === 0 ? "level with" : Math.abs(Math.round(100 * (pr.ratio - 1))) + "% " + (pr.ratio >= 1 ? "above" : "below")) + " the median of the other developers in the same areas (weighted by its sales).");
    if (iv) row("Inventory and scale", iv.projects != null ? plural(iv.projects, "project") + ", " + plural(iv.sales, "settled sale") + ", " + plural(iv.areas, "area") + (iv.salesPerProject ? ", about " + fmt(iv.salesPerProject) + " sales per project" : "") + (iv.homesPerProject ? " (about " + fmt(iv.homesPerProject) + " registered homes per project)" : "") + "." : plural(iv.sales, "settled sale") + " in " + plural(iv.areas, "area") + ".");
    if (um) row("Unit mix", um.studioOne + "% of sales are studios and one-bedrooms, " + um.shares[2] + "% two-bedrooms, " + um.shares[3] + "% three bedrooms or more." + (um.medianSqft ? " Median home size " + fmt(um.medianSqft) + " sq ft." : ""));
    if (lo) row("Location mix", lo.primePct + "% of its sales are in coastal and prime areas, " + lo.inlandPct + "% elsewhere. The coastal and prime list: " + DM.PRIME_AREAS.map((s) => esc((ix.areas[s] || {}).name || s)).join(", ") + ".");
    if (f.quality) row("Quality, finish and design partners", esc(f.quality.note) + " Source: " + esc(f.quality.source) + ", " + esc(f.quality.date) + ".");
    if (rows.length) blocks.push({ sub, h: 60 + rows.length * 52, html: secHead("chart-bar", "Positioning evidence", "Each factor is a number, shown as it is. There is no hidden score.") + '<div class="frs">' + rows.join("") + "</div>" });
    // price by area, highest to lowest
    if (p.priced.length) {
      const per = 24;
      for (let i = 0; i < p.priced.length; i += per) {
        const ch = p.priced.slice(i, i + per);
        blocks.push({ sub, h: 60 + ch.length * 18 + (i === 0 ? 36 : 0), html: (i === 0 ? secHead("map-pin", "Price by area, highest to lowest", "Areas where " + nm + " has 3 or more settled sales. " + esc(C.winText) + ".") : '<div class="otlh">Price by area (continued)</div>') +
          '<table class="tb"><thead><tr><th>Area</th><th class="r">Median per sq ft</th><th class="r">Sales</th><th>Price band here</th></tr></thead><tbody>' + ch.map((a) => "<tr><td>" + esc(labelOf(a.slug, a.name)) + '</td><td class="r">' + aed(a.medianSqft) + '</td><td class="r">' + fmt(a.n) + "</td><td>" + (a.tierHere >= 0 ? '<span class="bd" style="background:' + BAND[a.tierHere].tint + ";color:" + BAND[a.tierHere].ink + '">' + BAND[a.tierHere].name + "</span>" : "") + "</td></tr>").join("") + "</tbody></table>" + (i + per >= p.priced.length && p.thin.length ? '<div class="more">Also sold in, with under 3 sales so no price: ' + p.thin.map((a) => esc(labelOf(a.slug, a.name)) + " (" + a.n + ")").join(", ") + ".</div>" : "") });
      }
    }
    blocks.push({ sub, h: 70 + tp.lines.length * 44, html: secHead("chat-circle-text", "Talking point", "Facts from the register, with the source and the date.") + '<div class="tpb">' + tp.lines.map((l) => "<p>" + esc(l) + "</p>").join("") + "</div>" });
  }
  return blocks;
}

function budgetPages(C) {
  if (!C.bq || !C.meet || !C.meet.length) return C.bq ? [{ sub: "Your client&rsquo;s budget", h: 90, html: secHead("wallet", "Your client&rsquo;s budget, by location", esc(budgetSay(C.p)) + ". " + esc(C.winText) + ".") + '<div class="more">None of your developers fit this budget in any area with 3 or more sales behind the figure.</div>' }] : [];
  const rent = C.p.mode === "rent", rows = C.meet.slice(0, 30);
  const cards = rows.map((a) => '<tr><td>' + esc(labelOf(a.slug, (C.IDX0.areas[a.slug] || {}).name || a.name)) + '</td><td class="r">' + a.devs.length + "</td><td>" + a.devs.map((d) => esc(d.name) + " (" + (rent ? aed(d.rent) + " a year" : C.bq.mode === "total" && d.fitMedian ? aed(d.fitMedian) : aed(d.medianSqft) + " per sq ft") + ")").join(", ") + "</td></tr>").join("");
  return [{ sub: "Your client&rsquo;s budget", h: 120 + rows.length * 34, html: secHead("wallet", "Your client&rsquo;s budget, by location", esc(budgetSay(C.p)) + ". " + esc(C.winText) + ".") + '<table class="tb"><thead><tr><th>Location</th><th class="r">Your developers that fit</th><th>Who, and the price</th></tr></thead><tbody>' + cards + "</tbody></table>" + (C.meet.length > rows.length ? '<div class="more">and ' + plural(C.meet.length - rows.length, "more location") + "</div>" : "") + '<div class="mnote">' + (rent ? "Registered rental contracts, community level, 3 or more contracts behind each figure." : "A developer fits when the median price of its homes of that size (or its median price per sq ft) is inside the budget, with 3 or more sales behind it.") + "</div>" }];
}

function methodPage(C) {
  const ix0 = C.IDX0, M = ix0.ev || {}, b = C.st.bounds, cu = ix0.cuts || {}, sh = cu.shares || {};
  const items = [
    ["calculator", "The window", "Every figure in this document uses " + esc(C.winText) + ". The register itself runs to " + esc(dateLong(M.source_as_of || ix0.as_of)) + "; the last part month is left out so every month is whole. Dubai Land Department settled sales to " + esc(dateLong(ix0.as_of)) + "."],
    ["stack", "The four price bands", "Bands are cut from all Dubai settled sales so that each holds about a quarter of the money spent. Top band: " + esc(DM.bandLine(0, b, "sqft")) + ". Upper band: " + esc(DM.bandLine(1, b, "sqft")) + ". Middle band: " + esc(DM.bandLine(2, b, "sqft")) + ". Entry band: " + esc(DM.bandLine(3, b, "sqft")) + ". Across Dubai " + (sh.n ? sh.n.join(", ") + " in every 100 sales fall in the four bands in that order" : "the four bands hold different numbers of sales") + ". A band describes homes, not developers: a developer is shown in the band where most of its sales here fall, and never rated."],
    ["chart-bar", "Medians: the middle of building medians", "A price per sq ft is the weighted middle (median) of the building medians, each building weighted by the number of sales behind it. It is not the middle of every individual sale, so a large building counts more and a building with no sales is missing. A developer&rsquo;s figure is the same calculation over its buildings in the area. The middle half of sales runs from the quarter point to the three-quarter point."],
    ["buildings", "Off-plan sales and contract prices", "A home bought before it is finished (off-plan) is recorded at the contract price agreed with the developer, not at a price the home would fetch today. These sales are included at that contract price" + (C.area.offplan && C.area.offplan.note ? ": " + esc(C.area.offplan.note) : "") + "."],
    ["ruler", "Villas and plot size", "For villas and townhouses the size recorded may be the land plot or the built area, depending on how the sale was recorded, so a price per sq ft can mislead. Compare villas by total price and plot size with the developer&rsquo;s sales team. Sizes are in square feet (sq ft); 1 square metre is 10.76 sq ft."],
    ["info", "The 3 or more sales rule", "A price is only shown when 3 or more settled sales stand behind it. With fewer, the sales are counted but no price is printed. A project counts in the last 12 months when 3 or more of its sales settled in the window."],
    ["map-trifold", "The maps", "Footprints and streets are from OpenStreetMap contributors (the app&rsquo;s district model). A project is placed on the map only where it matches a building outline; every other project is listed under &ldquo;Registered here, no map position yet&rdquo; with its sales and price, and is never dropped."],
  ];
  const body = secHead("calculator", "How these numbers are worked out", "Sources: Dubai Land Department sales register" + (C.p.mode === "rent" ? "; registered rental contracts (the Dubai rent register, community level)" : "") + ", " + esc(dateLong(ix0.as_of)) + ".") +
    items.map((i) => '<div class="mth">' + icon(i[0], 20, TEAL) + "<div><b>" + i[1] + "</b><p>" + i[2] + "</p></div></div>").join("") + (M.filters ? '<div class="mnote">Which sales are counted: ' + esc(M.filters) + "</div>" : "");
  return { sub: "How these numbers are worked out", h: 140 + items.length * 76 + 50, html: body };
}

// ------------------------------------------------------------------------------------------------ assembling the document
const EXTRA_CSS = `
  .dm-body { color:${INK}; }
  .serif { font-family: Newsreader, Georgia, "Times New Roman", serif; }
  h1.serif { margin:0; font-size:30px; font-weight:400; color:${NAVY}; line-height:1.1; }
  h2.serif { margin:0; font-size:23px; font-weight:400; color:${NAVY}; }
  .ic { display:block; flex:none; }
  .ttl { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; }
  .tsub { font-size:11px; color:${MUTED}; margin-top:4px; line-height:1.35; }
  .locs { display:flex; gap:8px; flex:none; }
  .loc { display:block; border:1px solid ${HAIR}; }
  .tiles { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; }
  .tile { border:1px solid ${HAIR}; border-top:3px solid ${GOLDI}; background:#fff; padding:10px 14px 9px; }
  .tk { font-size:9.5px; letter-spacing:1px; text-transform:uppercase; color:${MUTED}; font-weight:600; }
  .tv { font-family:Newsreader, Georgia, serif; font-size:30px; color:${NAVY}; line-height:1.12; margin-top:2px; white-space:nowrap; }
  .tu { font-size:10.5px; color:${MUTED}; }
  .bgrid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .bc { padding:9px 12px 9px 11px; display:flex; flex-direction:column; gap:6px; min-width:0; }
  .bch { display:flex; flex-direction:column; gap:1px; }
  .bcn { font-family:Newsreader, Georgia, serif; font-size:19px; line-height:1.1; }
  .bcr { font-size:10.5px; color:#3d4249; font-weight:500; }
  .bcp { display:grid; grid-template-columns:1fr 1fr; gap:3px 8px; }
  .bcp div { background:rgba(255,255,255,0.7); padding:2px 6px; }
  .bcp small { display:block; font-size:8.8px; color:${MUTED}; }
  .bcp b { font-size:10.2px; font-weight:600; white-space:nowrap; }
  .bcs { font-size:10px; color:#3d4249; border-top:1px solid rgba(0,0,0,0.08); padding-top:5px; }
  .bcl { display:flex; flex-direction:column; border-top:1px solid rgba(0,0,0,0.08); }
  .dl { display:grid; grid-template-columns:12px minmax(0,1fr) 84px 44px 54px; gap:4px; align-items:center; font-size:9.2px; padding:2.2px 0; border-bottom:1px solid rgba(0,0,0,0.05); line-height:1.25; }
  .dl span { white-space:nowrap; } .dl .dn2 { white-space:normal; overflow-wrap:break-word; font-weight:500; font-size:9.6px; line-height:1.15; }
  .dl .st { display:flex; align-items:center; }
  .qn, .qn2 { color:${MUTED}; font-size:8.4px; font-style:italic; } .qn2 { padding:0 0 2px 16px; line-height:1.2; border-bottom:1px solid rgba(0,0,0,0.05); }
  .more { font-size:9.6px; color:${MUTED}; margin-top:3px; }
  .bud { display:flex; gap:9px; align-items:flex-start; border:1px solid ${HAIR}; background:#fff; padding:8px 12px; font-size:10.8px; line-height:1.4; }
  .note2 { display:flex; gap:8px; align-items:flex-start; border:1px solid ${HAIR}; background:#fff; padding:7px 11px; font-size:10.4px; line-height:1.35; }
  .sec { display:flex; gap:11px; align-items:center; padding-bottom:7px; border-bottom:1px solid ${GOLDI}; margin-bottom:2px; }
  .icw { width:36px; height:36px; border:1px solid ${GOLDI}; border-radius:50%; display:flex; align-items:center; justify-content:center; flex:none; background:#fff; }
  .sech { font-size:20px; color:${NAVY}; line-height:1.15; }
  .secs { font-size:10.4px; color:${MUTED}; margin-top:2px; line-height:1.35; }
  .bsh { display:flex; gap:12px; align-items:center; padding:10px 14px; }
  .db { border:1px solid ${HAIR}; background:#fff; padding:9px 14px 10px; display:flex; flex-direction:column; gap:7px; }
  .dbh { display:flex; justify-content:space-between; align-items:baseline; gap:10px; border-bottom:1px solid ${HAIR}; padding-bottom:5px; }
  .dbn { font-family:Newsreader, Georgia, serif; font-size:17px; color:${NAVY}; display:flex; gap:5px; align-items:center; }
  .dbm { font-size:10.4px; color:${MUTED}; }
  .dbg { display:grid; grid-template-columns:280px 1fr; gap:18px; align-items:center; }
  .dnw { display:flex; align-items:center; gap:12px; }
  .lgs { display:flex; flex-direction:column; gap:2px; }
  .lg { font-size:10px; color:#3d4249; white-space:nowrap; } .lg i { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:5px; }
  .pcap { font-size:9.4px; color:${MUTED}; line-height:1.35; margin-top:1px; }
  .pjs { display:grid; grid-template-columns:1fr 1fr; gap:2px 22px; font-size:9.4px; line-height:1.35; color:#3d4249; border-top:1px solid ${HAIR}; padding-top:6px; }
  .pj { display:flex; flex-direction:column; } .pjh { font-weight:600; font-size:9.8px; display:flex; align-items:center; margin-top:3px; } .pjh i { width:7px; height:7px; border-radius:50%; margin-right:5px; display:inline-block; }
  .otlh { font-size:11px; font-weight:600; color:${NAVY}; margin:2px 0 4px; }
  table.tb { width:100%; border-collapse:collapse; font-size:10px; }
  table.tb th { text-align:left; font-size:8.8px; letter-spacing:.5px; color:${MUTED}; font-weight:600; padding:4px 5px; border-bottom:1px solid ${GOLDI}; }
  table.tb td { padding:3.5px 5px; border-bottom:1px solid ${HAIR}; vertical-align:middle; line-height:1.25; }
  table.tb .r, table.tb th.r { text-align:right; } table.tb .num { width:22px; text-align:center; font-weight:600; color:${TEAL}; }
  .bd { display:inline-block; padding:0 7px; border-radius:9px; font-size:9px; font-weight:600; }
  .mapbox { border:1px solid ${HAIR}; background:${MAPC.BG}; } .mkey { display:flex; flex-wrap:wrap; gap:4px 16px; } .mnote { font-size:9.6px; color:${MUTED}; line-height:1.4; }
  .ulg { display:grid; grid-template-columns:1fr 1fr 1fr; gap:0 16px; }
  .ul { display:grid; grid-template-columns:11px minmax(0,1fr) auto; gap:4px; font-size:8.6px; line-height:1.25; padding:1.6px 0; border-bottom:1px solid ${HAIR}; align-items:center; }
  .ul .sp { width:9px; display:block; } .ul .uv { color:${MUTED}; white-space:nowrap; font-size:8.2px; } .ul .un { white-space:normal; overflow-wrap:break-word; }
  .pf { display:flex; gap:12px; align-items:center; padding-bottom:8px; border-bottom:1px solid ${GOLDI}; }
  .two { display:flex; gap:12px; align-items:stretch; }
  .card2 { border:1px solid ${HAIR}; background:#fff; padding:10px 14px; display:flex; flex-direction:column; gap:3px; min-width:0; }
  .ck { font-size:9.4px; letter-spacing:1px; text-transform:uppercase; color:${MUTED}; font-weight:600; } .cv { font-family:Newsreader, Georgia, serif; font-size:19px; color:${NAVY}; } .cn { font-size:9.8px; color:${MUTED}; line-height:1.4; }
  .frs { display:flex; flex-direction:column; } .fr { display:grid; grid-template-columns:150px 1fr; gap:14px; padding:6px 0; border-bottom:1px solid ${HAIR}; font-size:10.4px; line-height:1.4; } .fr b { color:${NAVY}; font-weight:600; }
  .tpb { border-left:3px solid ${GOLDI}; background:#fff; padding:8px 14px; font-size:11px; line-height:1.45; } .tpb p { margin:0 0 6px; }
  .mth { display:flex; gap:12px; align-items:flex-start; padding:7px 0; border-bottom:1px solid ${HAIR}; } .mth b { color:${NAVY}; font-size:11.5px; } .mth p { margin:2px 0 0; font-size:10.4px; line-height:1.45; color:#3d4249; }
`;
const TITLES = { snapshot: "Developers by area snapshot", detailed: "Developers by area, detailed" };
const head = (title, body) => '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>' + esc(title) + "</title>" +
  '<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400&display=swap" rel="stylesheet"><style>' + BRIEF_KIT.CSS + EXTRA_CSS + "</style></head><body>" + body + "</body></html>";

function pageHtml(C, pg, i, total) {
  const hdr = '<div style="height:96px;display:flex;align-items:center;justify-content:space-between;padding:0 46px;background:#FFFFFF;border-bottom:1px solid #E6E1D8;flex-shrink:0;"><div style="display:flex;flex-direction:column;gap:4px;max-width:560px;"><div class="lbl" style="text-transform:uppercase">' + esc(C.names.title) + " &middot; " + pg.sub + '</div><div style="font-size:10.5px;color:' + MUTED + ';line-height:1.35;">' + C.today + " &middot; " + esc(C.winText) + "</div></div>" + BRIEF_KIT.logo(C, 70) + "</div>";
  const small = BRIEF_KIT.smallPrint(["Sources: Dubai Land Department sales register, " + esc(dateLong(C.IDX0.as_of)) + ". " + esc(C.winText) + ". Price bands describe homes, not developers.", PERMIT_REMINDER + " &middot; Page " + (i + 1) + " of " + total]);
  return '<div class="sheet page dm-body">' + hdr + '<div class="dmb" style="flex:1;display:flex;flex-direction:column;padding:14px 46px 0 46px;gap:12px;overflow:hidden;">' + pg.html + "</div>" + BRIEF_KIT.footer(small, C.buy) + "</div>";
}

// the page-packer: blocks carry an estimated height (px); a page holds PAGE_H of them
export const PAGE_H = 830;
export const PDF_PAGE_TARGET = 12;
export function pack(blocks) {
  const pages = []; let cur = null;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i], nxt = blocks[i + 1];
    const need = b.h + 12 + (b.keep && nxt ? nxt.h + 12 : 0);   // a heading is never left alone at the foot of a page
    if (b.alone || !cur || cur.sub !== b.sub || cur.h + need > PAGE_H) { cur = { sub: b.sub, h: 0, parts: [] }; pages.push(cur); }
    cur.parts.push(b.html); cur.h += b.h + 12;
  }
  return pages.map((p) => ({ sub: p.sub, html: p.parts.join("") }));
}

export async function buildAreaPdf(env, p, opts) {
  if (!["snapshot", "detailed"].includes(p.kind)) return { status: 400, body: { ok: false, reason: "kind must be snapshot or detailed" } };
  if (p.mode !== "buy" && p.mode !== "rent") return { status: 400, body: { ok: false, reason: "mode must be buy or rent" } };
  const L = await loadData(env, p, opts);
  if (L.status !== 200) return L;
  const C = L.C, pages = [];
  pages.push({ sub: p.kind === "snapshot" ? "Snapshot" : "Snapshot", html: snapshotBody(C), alone: true });
  if (p.kind === "detailed" && C.st.enough) {
    const chosen = C.st.tiers.flatMap((t) => t.devs).filter((d) => C.mine[d.k]).sort((a, b) => b.n - a.n);
    const blocks = bandSections(C);
    const M = await loadMapData(env, C);
    for (const pg of pack(blocks)) pages.push(pg);
    // v327 - about 12 pages at most: the area map and ONE page of projects not yet on the map, then the full treatment (map, profile) for the chosen developers while it fits,
    // otherwise one page each for the chosen developers (the others stay in the compact lists above)
    const mp0 = mapPages(C, M); for (const m of mp0.slice(0, 2)) pages.push({ sub: m.sub, html: m.html });
    const dm = developerMaps(C, M, chosen), pf = pack(profileBlocks(C, chosen));
    if (pages.length + 1 + dm.length + pf.length <= PDF_PAGE_TARGET) { for (const m of dm) pages.push({ sub: m.sub, html: m.html }); for (const pg of pf) pages.push(pg); }
    else for (const pg of pack(compactProfile(C, M, chosen))) pages.push(pg);
    for (const b of budgetPages(C)) pages.push({ sub: b.sub, html: b.html });
    const mp = methodPage(C); pages.push({ sub: mp.sub, html: mp.html });
  } else if (p.kind === "detailed") {
    const mp = methodPage(C); pages.push({ sub: mp.sub, html: mp.html });
  }
  const html = pages.map((pg, i) => pageHtml(C, pg, i, pages.length)).join("");
  const nm = C.names.plain.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return { status: 200, html: head(TITLES[p.kind] + " - " + C.names.plain, html), pages: pages.length, fname: (p.kind === "snapshot" ? "Snapshot_" : "Detailed_") + nm + ".pdf", C };
}

// ------------------------------------------------------------------------------------------------ the route
const J = (o, status) => new Response(JSON.stringify(o, null, 1), { status: status || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
// deps.keyOk(env, url): the same key rule as /brief_pdf (a client key or the owner key in the query)
export async function devmapPdfRoute(request, env, url, deps) {
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("method not allowed", { status: 405 });
  if (!deps || !deps.keyOk || !deps.keyOk(env, url)) return new Response("unauthorized", { status: 401 });
  const p = parseParams(url);
  const doc = await buildAreaPdf(env, p, { origin: p.format === "html" ? url.origin : String(env.PUBLIC_ORIGIN || url.origin).replace(/\/+$/, "") });
  if (doc.status !== 200) return J(doc.body, doc.status);
  const hdr = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer", "X-Brief-Pages": String(doc.pages) };
  if (p.format === "html") return new Response(doc.html, { headers: Object.assign({ "Content-Type": "text/html; charset=utf-8" }, hdr) });
  if (!env.BROWSER) return J({ ok: false, reason: "no Browser Rendering binding on this Worker; add format=html to see the document" }, 503);
  let pdf;
  try { pdf = await BRIEF_KIT.renderPdf(env, doc.html); } catch (e) {
    const m = String((e && e.message) || e);
    return J({ ok: false, reason: (/429|too many|rate.?limit/i.test(m) ? "busy: " : "render failed: ") + m.slice(0, 160) }, /429|too many|rate.?limit/i.test(m) ? 429 : 502);
  }
  if (!pdf || !pdf.byteLength) return J({ ok: false, reason: "the renderer returned nothing" }, 502);
  return new Response(pdf, { headers: Object.assign({ "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="' + doc.fname + '"' }, hdr) });
}
