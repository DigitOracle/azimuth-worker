// v751 - pages 2 and 3 of every Building Passport, drawn by the worker as visuals (Kendall, 4 Nov 2026, Luma Park Views on his phone:
// "way too much text ... look at every section and try your best to make it a visualization. Tell the story through the infographics.
// You can't tell the story on a mobile with 6 lines of text.").
// Same rule as the page 1 dashboard (v748) and the 03A timeline (v745): the writer no longer lays these pages out, so a long section can
// never print over the next one or under the footer. Every figure comes from the plot record, the pack, the neighbourhood record or the
// finance engine; a missing figure is a grey "Not available yet" pill, never a guess. Text per card: a number, a label, one source line.
import { brokerView } from "./passport_finance.js";
import { storySvg, STORY_H_MM } from "./story_timeline.js";

const esc = (s) => String(s == null ? "" : s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
const num = (n) => Number.isFinite(+n) && n !== null && n !== "" ? +n : null;
const int = (n) => Math.round(+n).toLocaleString("en-US");
const aedK = (n) => (n >= 1e6 ? (Math.round(n / 1e4) / 100).toFixed(2) + "M" : int(Math.round(n / 1000)) + "K");
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dS = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || "")); return m ? +m[3] + " " + MON[+m[2] - 1] + " " + m[1] : ""; };
const dM = (iso) => { const m = /^(\d{4})-(\d{2})/.exec(String(iso || "")); return m ? MON[+m[2] - 1] + " " + m[1] : ""; };
const bedL = (b) => (String(b) === "0" ? "Studio" : b + " bed");
const T = "#0A4F4A", G = "#C5A56A", GD = "#8A6A2C", INK = "#1C2826", MUT = "#5F6B66", LINE = "#E4D8BF", BLUE = "#2F6F9F", PALE = "#EFE7D6";
export const STALE_DAYS = 45;
export const BPP_PAGES = 4;   // v766 (Kendall 5 Nov): page 4 is the community nationality mix

const ICON = {
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  bldg: '<path d="M4 21V7l8-4v18M12 9l8 3v9M2 21h20M7 10h2M7 14h2M15 14h2M15 18h2"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>', car: '<path d="M5 16V11l2-5h10l2 5v5"/><path d="M3 16h18v3H3z"/><circle cx="7.5" cy="16" r="1"/><circle cx="16.5" cy="16" r="1"/>',
  lift: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 9l3-3 3 3M9 15l3 3 3-3"/>', shop: '<path d="M4 9l1.5-5h13L20 9"/><path d="M4 9h16v11H4z"/><path d="M9 20v-6h6v6"/>',
  area: '<path d="M4 4h16v16H4z"/><path d="M4 9h16M9 4v16"/>', home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  crane: '<path d="M4 21V5h12M4 5l4-2v2M16 5v4M14 9h4v3h-4zM2 21h8"/>', sale: '<path d="M3 17l5-5 4 4 8-8"/><path d="M14 8h6v6"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>', ad: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15l2.5-6 2.5 6M7.8 13h3.4M15 9v6h1.5a2 2 0 0 0 0-6z"/>',
  renew: '<path d="M4 12a8 8 0 0 1 14-5l2 2M20 12a8 8 0 0 1-14 5l-2-2"/><path d="M20 4v5h-5M4 20v-5h5"/>', pace: '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>',
  metro: '<rect x="6" y="3" width="12" height="14" rx="3"/><path d="M6 11h12M9 21l1.5-4M15 21l-1.5-4"/>', mall: '<path d="M6 8h12l-1 13H7z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
  school: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>', clinic: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>',
  hospital: '<path d="M4 21V5h16v16"/><path d="M12 8v6M9 11h6M2 21h20"/>', park: '<path d="M12 3l5 8h-3l4 6H6l4-6H7z"/><path d="M12 17v4"/>',
  cart: '<path d="M3 4h2l2.5 11h11L21 7H7"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>', beach: '<path d="M3 20h18"/><path d="M12 20V9"/><path d="M5 9a7 7 0 0 1 14 0z"/>',
  pharmacy: '<rect x="3" y="8" width="18" height="8" rx="4"/><path d="M12 8v8"/>', clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
  ok: '<path d="M5 12l5 5 9-10"/>', warn: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>', check: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  bank: '<path d="M3 10l9-6 9 6"/><path d="M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18"/>', doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>', star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 20c.8-3.5 3.2-5 6-5s5.2 1.5 6 5"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.5c2.8 0 4.7 1.4 5.5 4.5"/>',
  leaf: '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19l7-7"/>', link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  coin: '<circle cx="12" cy="12" r="8"/><path d="M14.5 9.5c-.6-.9-1.5-1.3-2.5-1.3-1.5 0-2.5.8-2.5 1.9 0 2.7 5 1.4 5 4 0 1.1-1 1.9-2.5 1.9-1 0-2-.4-2.6-1.3M12 6.8v1.4M12 15.8v1.4"/>',
};
const ic = (k, s, c) => '<svg viewBox="0 0 24 24" width="' + (s || 14) + '" height="' + (s || 14) + '" fill="none" stroke="' + (c || G) + '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none">' + (ICON[k] || "") + "</svg>";
const NA = '<span class="bd-na">Not available yet</span>';
const CHIP = { reg: ["From the registers", "#E3F0EA", "#0F5A3F"], ads: ["From the adverts", "#F6EBD3", GD], calc: ["Calculated", "#E3ECF4", BLUE], google: ["Live from Google", "#F8E8CF", "#9A5E12"], dewa: ["From DEWA accounts", "#E3F0EA", "#0F5A3F"], dev: ["Developer source", "#EEE7F5", "#6B4A99"], na: ["Not available yet", "#ECEDEC", "#5F6B66"] };
const chip = (k) => { const c = CHIP[k]; return '<span class="bd-chip" style="background:' + c[1] + ";color:" + c[2] + '">' + c[0] + "</span>"; };

// ---------------------------------------------------------------------------------------------------- the figures (from stored rows only)
export function pageFigures(pp, pack, today, f) {
  pp = pp || {}; pack = pack || {}; f = f || {};
  const pj = pack.project || {}, nb = pack.nb || {}, dna = pack.dna || null, asof = pack.asof || {};
  const units = (pack.units || []).filter((u) => u.type !== "Building");
  const isHome = (u) => u.type === "Flat" || u.type === "Villa" || /B\/R|Studio/i.test(u.rooms || "");
  const homesU = units.filter(isHome), otherU = units.filter((u) => !isHome(u));
  const homes = homesU.reduce((s, u) => s + (u.n || 0), 0), other = otherU.reduce((s, u) => s + (u.n || 0), 0);
  const bd = (pack.bldgs || []).length ? pack.bldgs : (pp.buildings || []);
  const sumB = (k) => { const v = bd.map((b) => num(b[k])).filter((x) => x != null); return v.length ? v.reduce((s, x) => s + x, 0) : null; };
  const floorsV = bd.map((b) => num(b.floors)).filter((x) => x);
  const stale = (t) => { const a = asof[t]; return a && a.days != null && a.days > STALE_DAYS ? a.days : null; };
  const src = (t) => { const a = asof[t]; return a ? a.src.replace(/ \(.*\)$/, "") + " · " + dS(a.date) : ""; };
  const mk = ((pack.makani && pack.makani.numbers) || []).filter((x) => /^\d{10}$/.test(String(x))).map((x) => String(x).replace(/^(\d{5})(\d{5})$/, "$1 $2"));
  const identity = {
    name: f.name || pp.project || (bd[0] && bd[0].name) || "Plot " + (pp.parcel || pp.plot_no || ""), area: pp.area_name || "", master: pp.master || "",
    tenure: pp.freehold === true ? "Freehold" : pp.freehold === false ? "Leasehold / not freehold" : null, kind: pack.kind || null,
    plot: pp.plot_no || null, parcel: pp.parcel || null, project: pj.number || null, sqm: num(pp.sqm), land: [pp.land_type, pp.sub_type].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(" · ") || null,
    makani: mk, authority: pj.authority || (nb.facts && nb.facts.bind && nb.facts.bind.zoning_authority) || null,
  };
  const physical = { floors: floorsV.length ? Math.max(...floorsV) : null, buildings: bd.length, homes: homes || null, other: other || null, shops: sumB("shops"), offices: sumB("offices"), car_parks: sumB("car_parks"), lifts: sumB("lifts"), pools: sumB("pools"), bua: sumB("bua_sqm"), src: src("g_dld__buildings") || src("g_dld__units") };
  const mix = homesU.slice().sort((a, b) => (b.n || 0) - (a.n || 0)).map((u) => ({ label: String(u.rooms || u.type || "Other").replace(/ B\/R/i, " bed").replace(/^Studio$/i, "Studio"), n: u.n || 0, sqm: num(u.median_sqm) }));
  const construction = pj.number ? { status: pj.status || null, pct: num(pj.pct), start: pj.start || null, end: pj.end_planned || pj.completion || null, stale: stale("g_dld__projects"), src: src("g_dld__projects"), registered: (pack.buildings_registered && pack.buildings_registered.first) || null } : null;
  // sales: sale medians by bedroom and year (pp.prices), plus the 12-month register signal (pack.market)
  const pr = pp.prices || null, saleYears = [], saleBeds = ["1", "2", "3"];
  if (pr && pr.sale) for (const y of pr.years || []) { const row = { y, v: {} }; for (const b of saleBeds) { const c = (pr.sale[y] || {})[b]; if (c && c[2] !== "d") row.v[b] = { aed: c[0], n: c[1] }; } if (Object.keys(row.v).length) saleYears.push(row); }
  const mkt = (pack.market && pack.market.kinds) || {};
  const sales = { years: saleYears, ready: mkt.ready || null, offplan: mkt.offplan || null, all_time: pack.sales ? pack.sales.all_time : null, to: pack.market ? pack.market.to : null, src: src("lk_dld_transactions") };
  // rentals: registered (Ejari) vs asking (adverts) by bedroom
  const ten = pack.tenancies || null, fl = pp.flats || {}, ask = {};
  for (const x of (fl.items || []).filter((i) => i.mode === "rent")) { const b = x.beds == null ? null : String(x.beds); if (b != null && x.price) (ask[b] = ask[b] || []).push(+x.price); }
  const med = (a) => { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; };
  const rb = new Set([...Object.keys((ten && ten.beds) || {}), ...Object.keys(ask)]);
  const rents = [...rb].sort().map((b) => ({ b, reg: ten && ten.beds[b] ? ten.beds[b][0] : null, regN: ten && ten.beds[b] ? ten.beds[b][1] : 0, ask: ask[b] && ask[b].length ? med(ask[b]) : null, askN: ask[b] ? ask[b].length : 0 })).filter((r) => r.reg || r.ask);
  const h = ten && ten.history;
  const rentals = { contracts: ten ? ten.total : null, window: ten ? ten.window_days : null, to: ten ? ten.to : null, first: ten ? ten.first : null, renewals: h && h.last_12m ? { n: h.renewals_12m, of: h.last_12m } : null, adverts: fl.total ? { total: fl.total, rent: fl.rent || 0, sale: fl.sale || 0, on: fl.checked } : null, rows: rents, src: src("pp_dld__rent_contracts") };
  // occupancy (never a vacancy percentage): homes, let, advertised, no signal
  const let_ = ten ? ten.total || 0 : 0, adv = fl.rent || 0;
  const occupancy = homes && (let_ || adv) ? { homes, let: Math.min(let_, homes), adverts: Math.max(0, Math.min(adv, homes - Math.min(let_, homes))), rest: Math.max(0, homes - Math.min(let_, homes) - Math.min(adv, homes - Math.min(let_, homes))) } : null;
  // neighbourhood: one row per kind, straight line; drive times peak vs free-flowing
  const PL = [["metro", "Metro", nb.metro ? { n: nb.metro.n, km: nb.metro.km } : null], ["mall", "Mall"], ["school", "School"], ["clinic", "Clinic"], ["hospital", "Hospital"], ["park", "Park"], ["supermarket", "Grocery"], ["beach", "Beach"], ["pharmacy", "Pharmacy"]];
  const near = (nb.near || {}), own = (nb.own || {});
  const places = [];
  for (const [k, label, pre] of PL) {
    const g = pre || near[k] || (own[k] ? { n: own[k].n, km: own[k].km } : null);
    if (g && g.n && g.km != null) places.push({ k, label, n: g.n, km: +g.km, r: g.r != null ? +g.r : null, c: g.c != null ? +g.c : null });
  }
  const drive = [];
  if (nb.drive && nb.drive.d) for (const [k, v] of Object.entries(nb.drive.d)) { if (Array.isArray(v) && Number.isFinite(+v[0])) drive.push({ to: k, peak: +v[0], free: Number.isFinite(+v[1]) ? +v[1] : null }); }
  if (!drive.length && pack.access && pack.access.mins) { const N = { dubai_mall: "Dubai Mall", difc: "DIFC", dxb: "DXB airport", marina: "Dubai Marina", expo: "Expo City" }; for (const [k, m] of Object.entries(pack.access.mins)) if (Number.isFinite(m)) drive.push({ to: N[k] || k, peak: Math.round(m), free: null }); }
  drive.sort((a, b) => a.peak - b.peak);
  const neighbourhood = { places, drive: drive.slice(0, 5), driveFrom: nb.drive ? { from: nb.drive.from, when: nb.drive.when, as_of: nb.drive.as_of } : pack.access && pack.access.solved_on ? { from: "road network", when: "", as_of: pack.access.solved_on } : null, basis: nb.pt ? (/^area centre/.test(nb.pt.basis || "") ? "from the area centre" : "from the plot") : null };
  // Google: the building's own place, else nearby places
  const gp = ((pack.google && pack.google.places) || []).filter((p) => p && p.place_id && !p.sales_office);
  const google = gp.length ? { kind: "building", name: gp[0].name, rating: num(gp[0].rating), count: num(gp[0].count), as_of: gp[0].as_of, praise: gp[0].praise || [], complaint: gp[0].complaint || [], uri: gp[0].uri || null }
    : (nb.top || []).length ? { kind: "nearby", top: nb.top.slice(0, 3), tb: nb.tb || 1 } : null;
  // district DNA
  const DIM = { everyday: "Everyday shops", mobility: "Getting around", outdoors: "Outdoors", fitness: "Fitness", family: "Family & schools", health: "Health", food_social: "Food & social", maturity: "Established", value: "Value" };
  const PROF = { family: "Families", active: "Active", metro_commuter: "Metro commuters", dog_owner: "Dog owners", retiree: "Retirees" };
  const district = dna ? { name: dna.name || nb.district || "", overall: dna.live && dna.live.p ? num(dna.live.p.default) : null, version: dna.live ? dna.live.v : null, as_of: dna.live ? dna.live.as_of : null,
    dims: Object.keys(DIM).filter((k) => dna.dims && dna.dims[k] != null).map((k) => ({ k: DIM[k], v: +dna.dims[k] })),
    prof: Object.keys(PROF).filter((k) => dna.live && dna.live.p && dna.live.p[k] != null).map((k) => ({ k: PROF[k], v: +dna.live.p[k] })),
    pop: num(dna.pop), green: dna.green ? { share: +dna.green.share, src: dna.green.src, d: dna.green.d } : null } : null;
  const developer = pj.number ? { brand: pj.brand || pj.developer_en || null, legal: pj.developer_en || null, no: pj.developer_no ? Math.round(pj.developer_no) : null, escrow: pj.escrow_en || null, authority: pj.authority || null, stale: stale("g_dld__projects") } : null;
  const ev = pp.evidence || [];
  const evidence = { total: ev.length, direct: ev.filter((e) => e.s === "d").map((e) => e.label.replace(/\s*\(.*\)$/, "")), map: ev.filter((e) => e.s === "m").length };
  const brokers = (fl.items || []).filter((x) => x.agent || x.firm).slice(0, 4).map((x) => ({ agent: (x.agent || "").replace(/\s+/g, " ").trim(), firm: x.firm || "", phone: x.phone || "", beds: x.beds, sqft: x.sqft, price: x.price, mode: x.mode, portal: x.portal || "", date: x.date }));
  return { identity, physical, mix, construction, sales, rentals, occupancy, neighbourhood, google, district, developer, evidence, brokers, risks: (f.risks || []).slice(0, 2), opps: (f.opps || []).slice(0, 2), missing: f.missing || [] };
}

// ---------------------------------------------------------------------------------------------------- small visual parts
const card = (cls, head, body, foot) => '<div class="bd-card ' + (cls || "") + '">' + (head || "") + '<div class="bd-body">' + body + "</div>" + (foot ? '<div class="bd-src">' + foot + "</div>" : "") + "</div>";
const head = (no, title, ck, icon) => '<div class="bd-h">' + ic(icon || "doc", 13, G) + (no ? '<span class="bd-no">' + esc(no) + "</span>" : "") + '<span class="bd-t">' + esc(title) + "</span>" + (ck ? chip(ck) : "") + "</div>";
const stat = (icon, big, label, sub) => '<div class="bd-stat">' + ic(icon, 15, T) + '<div class="bd-sv">' + (big == null ? NA : big) + '</div><div class="bd-sl">' + esc(label) + "</div>" + (sub ? '<div class="bd-ss">' + sub + "</div>" : "") + "</div>";
const stalePill = (d) => (d ? '<span class="bd-stale">Register ' + d + " days old</span>" : "");

function donut(mix) {
  const tot = mix.reduce((s, m) => s + m.n, 0); if (!tot) return "";
  const C = [T, G, GD, "#6E9C93", "#B9A47A"], R = 15.9155; let off = 25, s = "";
  mix.forEach((m, i) => { const p = m.n / tot * 100; s += '<circle r="' + R + '" cx="21" cy="21" fill="none" stroke="' + C[i % C.length] + '" stroke-width="7" stroke-dasharray="' + p.toFixed(2) + " " + (100 - p).toFixed(2) + '" stroke-dashoffset="' + off.toFixed(2) + '"/>'; off -= p; });
  return '<svg viewBox="0 0 42 42" class="bd-donut">' + s + '<text x="21" y="20.5" text-anchor="middle" font-family="Fraunces,Georgia,serif" font-size="7.2" font-weight="700" fill="' + INK + '">' + int(tot) + '</text><text x="21" y="26" text-anchor="middle" font-family="Inter,sans-serif" font-size="3.4" fill="' + MUT + '">homes</text></svg>'
    + '<div class="bd-leg">' + mix.slice(0, 5).map((m, i) => '<div><i style="background:' + C[i % C.length] + '"></i><b>' + esc(m.label) + "</b> " + int(m.n) + (m.sqm ? '<span class="bd-mut"> · ' + esc(Math.round(m.sqm * 10.7639).toLocaleString("en-US")) + " sq ft</span>" : "") + "</div>").join("") + "</div>";
}
function ring(pct, label) {
  const p = Math.max(0, Math.min(100, pct)), R = 15.9155;
  return '<svg viewBox="0 0 42 42" class="bd-ring"><circle r="' + R + '" cx="21" cy="21" fill="none" stroke="' + PALE + '" stroke-width="5"/><circle r="' + R + '" cx="21" cy="21" fill="none" stroke="' + T + '" stroke-width="5" stroke-linecap="round" stroke-dasharray="' + p.toFixed(2) + " " + (100 - p).toFixed(2) + '" stroke-dashoffset="25"/>'
    + '<text x="21" y="22.5" text-anchor="middle" font-family="Fraunces,Georgia,serif" font-size="8" font-weight="700" fill="' + INK + '">' + (Math.round(p * 10) / 10) + '%</text><text x="21" y="28" text-anchor="middle" font-family="Inter,sans-serif" font-size="3.3" fill="' + MUT + '">' + esc(label) + "</text></svg>";
}
// grouped vertical bars: groups = [{label, bars:[{v, c, t}]}]
function groupBars(groups, legend, fmt) {
  const all = groups.flatMap((g) => g.bars.map((b) => b.v)).filter((v) => v); if (!all.length) return "";
  const mx = Math.max(...all), W = 200, H = 70, gw = W / groups.length, nb = Math.max(...groups.map((g) => g.bars.length)), bw = Math.min(16, (gw - 10) / nb);
  let s = '<svg viewBox="0 0 ' + W + " " + (H + 14) + '" class="bd-bars" preserveAspectRatio="xMidYMid meet"><line x1="0" y1="' + H + '" x2="' + W + '" y2="' + H + '" stroke="' + LINE + '" stroke-width="0.8"/>';
  groups.forEach((g, i) => {
    const x0 = i * gw + (gw - bw * g.bars.length - 2 * (g.bars.length - 1)) / 2;
    g.bars.forEach((b, j) => { if (!b.v) return; const h = Math.max(2, b.v / mx * (H - 12)), x = x0 + j * (bw + 2);
      s += '<rect x="' + x.toFixed(1) + '" y="' + (H - h).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="1.4" fill="' + b.c + '"/>'
        + '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - h - 2).toFixed(1) + '" text-anchor="middle" font-family="Inter,sans-serif" font-size="5.6" font-weight="700" fill="' + INK + '">' + esc(fmt(b.v)) + "</text>"; });
    s += '<text x="' + (i * gw + gw / 2).toFixed(1) + '" y="' + (H + 9) + '" text-anchor="middle" font-family="Inter,sans-serif" font-size="6.4" font-weight="600" fill="' + T + '">' + esc(g.label) + "</text>";
  });
  return s + "</svg>" + (legend ? '<div class="bd-key">' + legend.map((l) => '<span><i style="background:' + l[1] + '"></i>' + esc(l[0]) + "</span>").join("") + "</div>" : "");
}
const hbar = (label, v, mx, c, right) => '<div class="bd-hb"><span class="bd-hl">' + esc(label) + '</span><span class="bd-ht"><span style="width:' + Math.max(3, Math.round(v / mx * 100)) + "%;background:" + (c || T) + '"></span></span><span class="bd-hv">' + (right == null ? esc(Math.round(v)) : right) + "</span></div>";
const ST1 = ic("star", 8, G).replace('fill="none"', 'fill="' + G + '"').replace('style="flex:none"', 'style="vertical-align:-.3mm"');   // an icon, never the star character
const stars = (r) => { let s = ""; for (let i = 1; i <= 5; i++) s += ic("star", 12, i <= Math.round(r) ? G : "#D9CFBC").replace('fill="none"', 'fill="' + (i <= Math.round(r) ? G : "none") + '"'); return '<span class="bd-stars">' + s + "</span>"; };
const short = (s, n) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, t.lastIndexOf(" ", n - 1)) + "…" : t; };
const mkPage = (n, title, sub, logo, inner, foot) => '<section class="page bd-page" data-bpp-det="' + n + '"><div class="bd-top">' + (logo ? '<img src="najma_logo.png" alt="Najma" class="bd-logo">' : "")
  + '<div class="bd-tt"><div class="bd-kick">' + esc(sub) + '</div><div class="bd-title">' + esc(title) + "</div></div></div>"
  + '<div class="bd-main">' + inner + "</div>"
  + '<div class="footer bd-foot"><span>Curated by Najjuko · Dubai Decoded · WhatsApp +971 56 548 4397</span><span>Najma Building Passport · ' + esc(foot) + " · page " + n + " of " + BPP_PAGES + "</span></div></section>";

// ---------------------------------------------------------------------------------------------------- page 2: the building and its market
export function page2(F, story, dateText) {
  const I = F.identity, P = F.physical, C = F.construction, S = F.sales, R = F.rentals;
  const idChips = [I.tenure, I.kind, I.master || I.area, I.plot ? "Plot " + I.plot : null, I.project ? "DLD project " + I.project : null, I.makani.length ? "Makani " + I.makani.join(", ") : null, I.authority].filter(Boolean)
    .map((t, i) => '<span class="bd-idc' + (i === 0 ? " bd-idc1" : "") + '">' + esc(t) + "</span>").join("");
  const ident = card("bd-c-id", head("01", "The building", "reg", "pin"), '<div class="bd-idrow">' + idChips + "</div>"
    + '<div class="bd-stats bd-s6">' + stat("layers", P.floors, "Floors") + stat("home", P.homes != null ? int(P.homes) : null, "Homes") + stat("shop", P.shops || P.offices ? int((P.shops || 0) + (P.offices || 0)) : P.other ? int(P.other) : null, "Shops & offices")
    + stat("car", P.car_parks != null ? int(P.car_parks) : null, "Car parks") + stat("lift", P.lifts != null ? int(P.lifts) : null, "Lifts") + stat("area", I.sqm ? int(I.sqm) + '<small> m²</small>' : null, "Plot area", P.bua ? "built-up " + int(P.bua) + " m²" : "") + "</div>",
    esc(P.src ? P.src : "Land Department registers") + (P.buildings > 1 ? " · " + P.buildings + " buildings on the plot, each counted on its own" : ""));
  const inv = card("bd-c-inv", head("03", "Apartment inventory", "reg", "home"), F.mix.length ? '<div class="bd-donutrow">' + donut(F.mix) + "</div>" : NA, "units register · median size per type");
  const con = card("bd-c-con", head("08", "Construction", "reg", "crane"), C ? '<div class="bd-conrow">' + (C.pct != null ? ring(C.pct, "built") : "") + '<div class="bd-conr">'
    + '<span class="bd-status">' + esc(C.status || "Status not recorded") + "</span>" + stalePill(C.stale)
    + '<div class="bd-tl"><div><b>' + esc(dM(C.start) || "-") + '</b><span>start</span></div><div class="bd-tlline"></div><div><b>' + esc(dM(C.end) || "-") + "</b><span>planned completion</span></div></div>"
    + "</div></div>" : NA, C ? esc(C.src) + " · a % is progress at the register date, not completion" : "projects register");
  const storyCard = card("bd-c-story", head("03A", "Building story", "reg", "clock"), '<div class="bpp-story" style="height:' + (STORY_H_MM - 16) + 'mm"><div class="bpp-story-in" style="width:100%;height:100%;overflow:hidden">' + (story || NA) + "</div></div>");
  // sales: sale medians by bedroom by year, plus three tiles
  const YC = ["#DCCDA9", G, T];
  const sg = S.years.length ? groupBars(["1", "2", "3"].map((b) => ({ label: bedL(b), bars: S.years.map((y, i) => ({ v: y.v[b] ? y.v[b].aed : null, c: YC[(i + 3 - S.years.length) % 3] })) })), S.years.map((y, i) => [y.y, YC[(i + 3 - S.years.length) % 3]]), aedK) : "";
  const rd = S.ready, op = S.offplan;
  const salesC = card("bd-c-sales", head("04", "Sales", "reg", "sale"), '<div class="bd-stats bd-s3">'
    + stat("sale", rd ? int(rd.deals_12m) : null, "Ready sales, 12 mo", rd && rd.aed_m2_12m ? "AED " + int(rd.aed_m2_12m / 10.7639) + "/sq ft" : "")
    + stat("pace", rd && rd.pace ? (Math.round(rd.pace["12m"] * 10) / 10).toFixed(1) : null, "Sales a month", rd && rd.pace ? "3 mo: " + rd.pace["3m"] : "")
    + stat("crane", op ? int(op.deals_12m) : null, "Off-plan, 12 mo", op && op.aed_m2_12m ? "AED " + int(op.aed_m2_12m / 10.7639) + "/sq ft" : "") + "</div>"
    + (sg ? '<div class="bd-cap">Median sale price by bedroom (AED)</div>' + sg : NA),
    esc(S.src || "sales register") + (S.all_time ? " · " + int(S.all_time) + " sales all time" : ""));
  const rg = R.rows.length ? groupBars(R.rows.slice(0, 4).map((r) => ({ label: bedL(r.b), bars: [{ v: r.reg, c: T }, { v: r.ask, c: G }] })), [["Registered (Ejari)", T], ["Asking (adverts)", G]], aedK) : "";
  const rentC = card("bd-c-rent", head("05", "Rentals", "reg", "key"), '<div class="bd-stats bd-s3">'
    + stat("key", R.contracts != null ? int(R.contracts) : null, "Tenancies", R.window ? "last " + R.window + " days" : "")
    + stat("ad", R.adverts ? int(R.adverts.rent) : null, "Rent adverts", R.adverts ? "live " + dS(R.adverts.on) : "")
    + stat("renew", R.renewals ? Math.round(R.renewals.n / R.renewals.of * 100) + "%" : null, "Renewals", R.renewals ? R.renewals.n + " of " + R.renewals.of : "") + "</div>"
    + (rg ? '<div class="bd-cap">Rent a year by bedroom (AED)</div>' + rg : NA),
    esc(R.src || "tenancy register") + " · adverts are asking prices and can repeat a unit");
  return mkPage(2, I.name, "The building and its market", true,
    ident + '<div class="bd-row bd-r2">' + inv + con + "</div>" + storyCard + '<div class="bd-row bd-r2">' + salesC + rentC + "</div>", dateText);
}

// ---------------------------------------------------------------------------------------------------- page 3: what it means
export function page3(F, fin, dateText) {
  const O = F.occupancy, N = F.neighbourhood, Gg = F.google, D = F.district, V = F.developer, E = F.evidence;
  const occ = card("bd-c-occ", head("06", "Occupancy signals", "reg", "people"), O ? '<div class="bd-stack"><span style="flex:' + O.let + ";background:" + T + '"></span><span style="flex:' + O.adverts + ";background:" + G + '"></span><span style="flex:' + O.rest + ';background:#D9D4C7"></span></div>'
    + '<div class="bd-key bd-key3"><span><i style="background:' + T + '"></i><b>' + int(O.let) + "</b> let (tenancies)</span><span><i style=\"background:" + G + '"></i><b>' + int(O.adverts) + "</b> advertised to let</span><span><i style=\"background:#D9D4C7\"></i><b>" + int(O.rest) + "</b> no signal</span><span class=\"bd-mut\">of " + int(O.homes) + " homes</span></div>" : NA,
    "no register says which homes are empty; \"no signal\" = owner-occupied, empty or not advertised");
  // investment: per bedroom class price, rent, gross yield
  const cls = (fin && fin.classes) || [];
  const ys = cls.map((c) => c.grossYield && c.grossYield.value).filter((x) => Number.isFinite(x)), ymx = ys.length ? Math.max(...ys, 0.08) : 0.08;
  const invest = card("bd-c-inv7", head("07", "Investment", "calc", "coin"), cls.length ? '<div class="bd-ycls">' + cls.slice(0, 3).map((c) => {
    const y = c.grossYield && Number.isFinite(c.grossYield.value) ? c.grossYield.value : null;
    return '<div class="bd-ycl"><div class="bd-ycb">' + esc(bedL(c.b)) + (c.sqft ? '<span class="bd-mut"> · ' + int(c.sqft) + " sq ft</span>" : "") + "</div>"
      + '<div class="bd-ykv"><span>Value</span><b>' + (c.price ? "AED " + aedK(c.price) : "-") + '</b></div><div class="bd-ykv"><span>Rent</span><b>' + (c.rent ? "AED " + aedK(c.rent) : "-") + "</b></div>"
      + '<div class="bd-yg"><span style="width:' + (y ? Math.round(y / ymx * 100) : 0) + '%"></span></div><div class="bd-yv">' + (y ? (y * 100).toFixed(1) + "% gross" : NA) + "</div></div>";
  }).join("") + "</div>" + '<div class="bd-ynote"><span class="bd-est">' + esc(fin.status === "estimate" ? "Estimate" : fin.status || "Estimate") + "</span> Not a certified valuation · net yield " + NA + "</div>"
    : '<div class="bd-ynote">' + NA + " A value needs registered sales and rents in this building.</div>", "price per m² (sales register) × median size (units register); rent from the tenancy register");
  const ro = card("bd-c-ro", head("", "Risks and opportunities", "calc", "warn"), '<div class="bd-ro"><div>' + (F.opps.length ? F.opps : ["Nothing computable yet"]).map((t) => '<div class="bd-roi">' + ic("ok", 13, "#0F5A3F") + "<span>" + esc(short(t, 100)) + "</span></div>").join("") + "</div><div>"
    + (F.risks.length ? F.risks : ["Nothing flagged"]).map((t) => '<div class="bd-roi">' + ic("warn", 13, GD) + "<span>" + esc(short(t, 100)) + "</span></div>").join("") + "</div></div>"
    + (F.missing.length ? '<div class="bd-next">' + ic("check", 13, T) + "<b>Verify next:</b> " + F.missing.slice(0, 4).map((m) => '<span class="bd-nx">' + esc(short(String(m).replace(/\s*\(.*$/, ""), 40)) + "</span>").join("") + "</div>" : ""));
  const PI = { metro: "metro", mall: "mall", school: "school", clinic: "clinic", hospital: "hospital", park: "park", supermarket: "cart", beach: "beach", pharmacy: "pharmacy" };
  const pl = N.places.slice(0, 8).map((p) => '<div class="bd-pl">' + ic(PI[p.k] || "pin", 16, T) + '<div class="bd-plt"><div class="bd-pln">' + esc(p.label) + '<b>' + (p.km < 1 ? int(p.km * 1000) + " m" : (Math.round(p.km * 10) / 10) + " km") + '</b></div><div class="bd-pls">' + esc(short(p.n, 34)) + (p.r != null ? " · " + p.r + ST1 : "") + "</div></div></div>").join("");
  const dmx = N.drive.length ? Math.max(...N.drive.map((d) => d.peak)) : 1;
  const dr = N.drive.map((d) => hbar(d.to, d.peak, dmx, T, d.peak + " min" + (d.free != null ? '<span class="bd-mut"> / ' + d.free + "</span>" : ""))).join("");
  const nbh = card("bd-c-nb", head("10", "Neighbourhood", "calc", "pin"), (pl ? '<div class="bd-pls8">' + pl + "</div>" : NA) + (dr ? '<div class="bd-cap">' + ic("car", 12, T) + " Drive time" + (N.drive.some((d) => d.free != null) ? ", weekday peak / free-flowing" : "") + "</div>" + dr : ""),
    "Distances are straight lines " + (N.basis || "") + "; drive times by road" + (N.driveFrom && N.driveFrom.as_of ? " (" + esc(dS(N.driveFrom.as_of)) + ")" : "") + ".");
  const goo = Gg && Gg.kind === "building" ? card("bd-c-g", head("", "Google", "google", "star"), '<div class="bd-gbig">' + (Gg.rating != null ? Gg.rating.toFixed(1) : "-") + "</div>" + (Gg.rating != null ? stars(Gg.rating) : "") + '<div class="bd-gc">' + (Gg.count != null ? int(Gg.count) + " reviews" : "") + "</div>"
      + (Gg.praise.length ? '<div class="bd-tags">' + Gg.praise.slice(0, 3).map((p) => '<span class="bd-tag bd-tagok">' + esc(p) + "</span>").join("") + Gg.complaint.slice(0, 2).map((p) => '<span class="bd-tag bd-tagw">' + esc(p) + "</span>").join("") + "</div>" : ""),
      "Google Maps · " + esc(dS(Gg.as_of)) + " · at most 5 reviews held, not every review")
    : Gg && Gg.kind === "nearby" ? card("bd-c-g", head("", "Nearby places", "google", "star"), Gg.top.map((t) => '<div class="bd-gn"><b>' + esc(short(t.n, 26)) + "</b><span>" + t.r + ST1 + " · " + int(t.c) + " · " + int(t.m) + " m</span></div>").join(""), "Google Maps · places, not reviews of this building")
    : card("bd-c-g", head("", "Google", "na", "star"), NA, "no Google place matched to this building yet");
  const dna = D ? card("bd-c-dna", head("", "District DNA · " + D.name, "calc", "leaf"), '<div class="bd-dna"><div class="bd-dnab"><div class="bd-dnav">' + (D.overall != null ? Math.round(D.overall) : "-") + '</div><div class="bd-dnal">Najma liveability<br>0 to 100</div>'
    + (D.pop ? '<div class="bd-dnam">' + ic("people", 12, T) + int(D.pop) + " people</div>" : "") + (D.green ? '<div class="bd-dnam">' + ic("leaf", 12, T) + D.green.share + "% green</div>" : "") + '</div><div class="bd-dnag">'
    + D.dims.map((d) => hbar(d.k, d.v, 100, d.v >= 66 ? T : d.v >= 40 ? G : "#B9785F")).join("") + "</div></div>",
    "district level, not this building · rank among the districts we study · index " + esc(D.version || "") + (D.green ? " · green cover " + esc(D.green.src) : ""))
    : card("bd-c-dna", head("", "District DNA", "na", "leaf"), NA, "this district is not in our district studies yet");
  const dev = card("bd-c-dev", head("11", "Developer", "dev", "bldg"), V ? '<div class="bd-kv"><b>' + esc(short(V.brand || "Not recorded", 46)) + "</b>" + (V.no ? "<span>DLD developer " + V.no + "</span>" : "") + "</div>"
    + (V.escrow ? '<div class="bd-kv2">' + ic("bank", 12, T) + esc(short(V.escrow, 34)) + "</div>" : "") + stalePill(V.stale) : NA, "projects register");
  const ops = card("bd-c-ops", head("09", "Service charge", "", "coin"), '<div class="bd-kv"><b>' + NA + "</b></div>" + '<div class="bd-kv2">Net yield waits for it</div>', "service-charge index not matched yet");
  const evd = card("bd-c-ev", head("12", "Evidence", "reg", "link"), '<div class="bd-evn"><b>' + int(E.total) + "</b> linked records</div>" + '<div class="bd-evd">' + E.direct.slice(0, 4).map((l) => '<span class="bd-tag">' + esc(short(l, 22)) + "</span>").join("") + (E.map ? '<span class="bd-tag bd-tagm">+' + E.map + " by map</span>" : "") + "</div>", "");
  const bro = F.brokers.length ? card("bd-c-bro", head("", "Brokers advertising now", "ads", "phone"), '<div class="bd-bros">' + F.brokers.map((b) => '<div class="bd-bro"><b>' + esc(short(b.agent || b.firm, 26)) + '</b><span>' + esc(short(b.firm, 30)) + "</span>"
      + (b.phone ? '<span class="bd-ph">' + ic("phone", 10, T) + esc(b.phone) + "</span>" : "") + '<span class="bd-mut">' + esc((b.beds === 0 ? "Studio" : b.beds != null ? b.beds + " bed" : "") + (b.price ? " · AED " + aedK(b.price) + (b.mode === "rent" ? "/yr" : "") : "") + (b.date ? " · " + dS(b.date) : "")) + "</span></div>").join("") + "</div>", "adverts on " + esc(F.brokers[0].portal || "the portals") + ", broker details as published · Research use only; not a valuation, legal title or offer") : "";
  return mkPage(3, "What it means", F.identity.name + " · detail and evidence", true,
    occ + invest + ro + '<div class="bd-row bd-r21">' + nbh + goo + "</div>" + dna + '<div class="bd-row bd-r3">' + dev + ops + evd + "</div>" + bro
    + (F.brokers.length ? "" : '<div class="bd-disc">Research use only. Not a valuation, legal title or offer. Registered deals are actual prices; adverts are asking prices.</div>'), dateText);
}

// ---------------------------------------------------------------------------------------------------- styles and the splice

// ---------------------------------------------------------------------------------------------------- page 4: who lives in the community
// v766 (Kendall 5 Nov: "a donut chart ... really list out what all those nationalities are"). Source: priv_community_resident_mix, the same
// community-grain DEWA aggregate the /residents page serves publicly (floored at 500 residential accounts, banded, no counts, no address).
// The plot's community is the first three digits of its plot number (676-8698 -> community 676 = Al Hebiah Third, DAMAC HILLS). Never invented:
// a community that is not in the file, or has no mix, gets a plain sentence and no chart.
export function communityMix(file, plotId) {
  const code = String(plotId || "").replace(/^naj:plot:/i, "").split("-")[0];
  const list = (file && Array.isArray(file.communities)) ? file.communities : [];
  return list.find((c) => String(c.comm) === code) || null;
}
const RC = [T, G, "#2F6F9F", GD, "#6E9C93", "#B4533C", "#7A6A9A", "#B9A47A", "#3E7E6A", "#9AA9A5"];
function regionDonut(regs) {
  const tot = regs.reduce((a, r) => a + (+r.pct || 0), 0); if (!tot) return "";
  const R = 15.9155; let off = 25, s = "";
  regs.forEach((r, i) => { const p = r.pct / tot * 100; s += '<circle r="' + R + '" cx="21" cy="21" fill="none" stroke="' + RC[i % RC.length] + '" stroke-width="8" stroke-dasharray="' + p.toFixed(2) + " " + (100 - p).toFixed(2) + '" stroke-dashoffset="' + off.toFixed(2) + '"/>'; off -= p; });
  return '<svg viewBox="0 0 42 42" class="bd-donut bd-donut4">' + s + '<text x="21" y="20" text-anchor="middle" font-family="Fraunces,Georgia,serif" font-size="5.2" font-weight="700" fill="' + INK + '">' + regs.length + '</text><text x="21" y="25" text-anchor="middle" font-family="Inter,sans-serif" font-size="3" fill="' + MUT + '">regions</text></svg>';
}
export function page4(C, name, dateText) {
  const nm = name || (C && (C.label || C.official)) || "this community";
  if (!C || !(Array.isArray(C.mix) && C.mix.length || Array.isArray(C.regions) && C.regions.length)) {
    return mkPage(4, "Who lives here", nm + " · nationality mix", true,
      card("bd-c-nat", head("11", "Nationality mix", "na", "people"), '<div class="bd-ynote">This community has too few residential accounts with a nationality on record, so no mix is shown. We never estimate one.</div>', "DEWA residential accounts, community level"), dateText);
  }
  const regs = (C.regions || []).filter((r) => +r.pct > 0);
  const top = (C.mix || []).map((m) => '<div class="bd-n4t"><b>' + esc(m[1]) + '%</b><span>' + esc(m[0]) + "</span></div>").join("")
    + (C.other ? '<div class="bd-n4t bd-n4o"><b>' + esc(C.other) + '%</b><span>Others, each under 5%</span></div>' : "");
  const leg = regs.map((r, i) => {
    const cs = (r.countries || []).map((c) => '<span class="bd-n4c">' + esc(c[0]) + " <b>" + esc(c[1]) + "%</b></span>").join("")
      + (r.others ? '<span class="bd-n4c bd-mut">other ' + esc(r.name) + " <b>" + esc(r.others) + "%</b></span>" : "");
    return '<div class="bd-n4r"><div class="bd-n4h"><i style="background:' + RC[i % RC.length] + '"></i><b>' + esc(r.name) + '</b><span>' + esc(r.pct) + '%</span></div>' + (cs ? '<div class="bd-n4cs">' + cs + "</div>" : "") + "</div>";
  }).join("");
  const inner = card("bd-c-nat", head("11", "Nationality mix · " + (C.label || C.official || nm), "dewa", "people"),
      '<div class="bd-n4top">' + top + "</div>"
      + (regs.length ? '<div class="bd-n4grid"><div class="bd-n4d">' + regionDonut(regs) + '</div><div class="bd-n4leg">' + leg + "</div></div>" : ""),
      "DEWA residential accounts in " + esc(C.official || C.name || nm) + ", community level" + (C.noNationalityPct ? " · " + esc(C.noNationalityPct) + "% of accounts record no nationality" : ""))
    + card("bd-c-natcav", "", '<div class="bd-ynote">' + ic("people", 13, T) + " These are account holders, not every resident. Shown for market understanding and planning content, never for recommending a home to anyone.</div>");
  return mkPage(4, "Who lives here", nm + " · nationality mix", true, inner, dateText);
}

export const PAGES_CSS = '<style id="bpp-det">'
  + ".bd-page{position:relative;background:#F6F2E9;padding:7mm 9mm 14mm;font-family:Inter,Arial,sans-serif;color:" + INK + "}"
  + ".bd-top{display:flex;align-items:center;gap:3mm;border-bottom:.3mm solid " + G + ";padding-bottom:2mm;margin-bottom:2.6mm}.bd-logo{height:10mm;width:auto}"
  + ".bd-kick{font:600 6.6pt 'IBM Plex Mono',monospace;letter-spacing:.14em;text-transform:uppercase;color:" + GD + "}.bd-title{font:700 15pt Fraunces,Georgia,serif;color:#0F3D33;letter-spacing:-.02em;line-height:1.05}"
  + ".bd-main{display:flex;flex-direction:column;gap:2mm}.bd-row{display:grid;gap:2mm}.bd-r2{grid-template-columns:1fr 1fr}.bd-r21{grid-template-columns:1.9fr 1fr}.bd-r3{grid-template-columns:1.2fr 1fr 1fr}"
  + ".bd-card{background:#fff;border:.3mm solid " + LINE + ";border-radius:3mm;padding:2.2mm 2.8mm;min-width:0;overflow:hidden;break-inside:avoid}"
  + ".bd-h{display:flex;align-items:center;gap:1.4mm;margin-bottom:1.6mm}.bd-no{font:700 7pt 'IBM Plex Mono',monospace;color:" + GD + "}.bd-t{font:700 9pt Inter,sans-serif;color:#0F3D33;letter-spacing:.01em;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
  + ".bd-chip{font:600 5.6pt Inter,sans-serif;padding:.6mm 1.8mm;border-radius:3mm;white-space:nowrap}.bd-na{display:inline-block;font:600 6.4pt Inter,sans-serif;color:#5F6B66;background:#ECEDEC;border-radius:3mm;padding:.5mm 1.8mm;white-space:nowrap}"
  + ".bd-src{margin-top:1.4mm;font:500 5.6pt Inter,sans-serif;color:" + MUT + ";line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bd-mut{color:" + MUT + ";font-weight:500}"
  + ".bd-idrow{display:flex;flex-wrap:wrap;gap:1.2mm;margin-bottom:2mm}.bd-idc{font:600 7pt Inter,sans-serif;color:" + T + ";background:#E6EFEE;border-radius:3mm;padding:.8mm 2.2mm}.bd-idc1{background:#F6EBD3;color:" + GD + "}"
  + ".bd-stats{display:grid;gap:1.6mm}.bd-s6{grid-template-columns:repeat(6,1fr)}.bd-s3{grid-template-columns:repeat(3,1fr);margin-bottom:1.6mm}"
  + ".bd-stat{background:#FBF8F1;border:.25mm solid " + LINE + ";border-radius:2.2mm;padding:1.6mm 1.8mm;min-width:0}.bd-sv{font:700 13pt Fraunces,Georgia,serif;color:" + INK + ";line-height:1.1;margin-top:.6mm;white-space:nowrap}.bd-sv small{font:600 7pt Inter,sans-serif;color:" + MUT + "}"
  + ".bd-sl{font:600 6.4pt Inter,sans-serif;color:" + T + ";white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bd-ss{font:500 5.8pt Inter,sans-serif;color:" + MUT + ";white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
  + ".bd-donutrow{display:flex;align-items:center;gap:3mm}.bd-donut{width:30mm;height:30mm;flex:none}.bd-leg{display:flex;flex-direction:column;gap:1.2mm;font:500 7.4pt Inter,sans-serif}.bd-leg i,.bd-key i{display:inline-block;width:2.4mm;height:2.4mm;border-radius:.6mm;margin-right:1.2mm;vertical-align:-.2mm}"
  + ".bd-conrow{display:flex;align-items:center;gap:3mm}.bd-ring{width:28mm;height:28mm;flex:none}.bd-conr{flex:1;display:flex;flex-direction:column;gap:1.6mm;align-items:flex-start;min-width:0}"
  + ".bd-status{font:700 8pt Inter,sans-serif;color:#fff;background:" + T + ";border-radius:3mm;padding:.8mm 2.4mm}.bd-stale{font:600 5.8pt Inter,sans-serif;color:#8A5A12;background:#FBEBCB;border:.2mm solid #E6C27A;border-radius:3mm;padding:.4mm 1.6mm}"
  + ".bd-tl{display:flex;align-items:center;gap:1.6mm;width:100%}.bd-tl div:not(.bd-tlline){display:flex;flex-direction:column;font:500 5.8pt Inter,sans-serif;color:" + MUT + "}.bd-tl b{font:700 8.4pt Inter,sans-serif;color:" + INK + "}.bd-tlline{flex:1;height:.5mm;background:linear-gradient(90deg," + T + " 70%," + G + ")}"
  + ".bd-cap{display:flex;align-items:center;gap:1.2mm;font:600 6.6pt Inter,sans-serif;color:" + T + ";margin:.6mm 0 .4mm}.bd-bars{width:100%;height:36mm;display:block}.bd-key{display:flex;flex-wrap:wrap;gap:3mm;font:500 6.4pt Inter,sans-serif;color:" + INK + "}"
  + ".bd-stack{display:flex;height:6mm;border-radius:2mm;overflow:hidden;margin:.6mm 0 1.6mm}.bd-key3{gap:4mm;font-size:7.4pt}"
  + ".bd-ycls{display:grid;grid-template-columns:repeat(3,1fr);gap:1.8mm}.bd-ycl{background:#FBF8F1;border:.25mm solid " + LINE + ";border-radius:2.2mm;padding:1.6mm 2mm}.bd-ycb{font:700 8pt Inter,sans-serif;color:" + T + ";margin-bottom:.8mm}"
  + ".bd-ykv{display:flex;justify-content:space-between;font:500 6.8pt Inter,sans-serif;color:" + MUT + "}.bd-ykv b{font:700 8pt Inter,sans-serif;color:" + INK + "}.bd-yg{height:2.2mm;background:" + PALE + ";border-radius:1.1mm;overflow:hidden;margin:1.2mm 0 .6mm}.bd-yg span{display:block;height:100%;background:" + G + "}"
  + ".bd-yv{font:700 9.4pt Fraunces,Georgia,serif;color:" + INK + "}.bd-ynote{display:flex;align-items:center;gap:1.6mm;margin-top:1.6mm;font:500 6.4pt Inter,sans-serif;color:" + MUT + "}.bd-est{font:700 6.4pt Inter,sans-serif;color:#fff;background:" + BLUE + ";border-radius:3mm;padding:.5mm 1.8mm}"
  + ".bd-ro{display:grid;grid-template-columns:1fr 1fr;gap:2.4mm}.bd-roi{display:flex;gap:1.4mm;align-items:flex-start;font:500 7pt Inter,sans-serif;line-height:1.3;margin-bottom:1.2mm}.bd-roi span{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}"
  + ".bd-next{display:flex;flex-wrap:wrap;align-items:center;gap:1.2mm;font:600 6.8pt Inter,sans-serif;color:" + T + ";border-top:.25mm dashed " + LINE + ";padding-top:1.4mm;margin-top:.4mm}.bd-nx{font:600 6.2pt Inter,sans-serif;color:" + INK + ";background:#F3EEE2;border-radius:3mm;padding:.5mm 1.8mm}"
  + ".bd-pls8{display:grid;grid-template-columns:repeat(4,1fr);gap:1.4mm 2mm;margin-bottom:1.4mm}.bd-pl{display:flex;gap:1.4mm;align-items:flex-start;min-width:0}.bd-plt{min-width:0}.bd-pln{font:600 6.4pt Inter,sans-serif;color:" + T + ";display:flex;gap:1.2mm;align-items:baseline}.bd-pln b{font:700 8.4pt Inter,sans-serif;color:" + INK + "}"
  + ".bd-pls{font:500 5.6pt Inter,sans-serif;color:" + MUT + ";white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
  + ".bd-hb{display:flex;align-items:center;gap:1.6mm;font:500 6.4pt Inter,sans-serif;margin:.5mm 0}.bd-hl{width:24mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:" + INK + "}.bd-ht{flex:1;height:2.4mm;background:" + PALE + ";border-radius:1.2mm;overflow:hidden}.bd-ht span{display:block;height:100%;border-radius:1.2mm}.bd-hv{width:15mm;text-align:right;font-weight:700;white-space:nowrap}"
  + ".bd-gbig{font:700 26pt Fraunces,Georgia,serif;color:" + INK + ";line-height:1}.bd-stars{display:flex;gap:.4mm;margin:.8mm 0}.bd-gc{font:600 7.4pt Inter,sans-serif;color:" + MUT + "}.bd-tags,.bd-evd{display:flex;flex-wrap:wrap;gap:1mm;margin-top:1.4mm}"
  + ".bd-tag{font:600 6pt Inter,sans-serif;background:#F3EEE2;color:" + INK + ";border-radius:3mm;padding:.5mm 1.8mm}.bd-tagok{background:#E3F0EA;color:#0F5A3F}.bd-tagw{background:#FBEBCB;color:#8A5A12}.bd-tagm{background:#E3ECF4;color:" + BLUE + "}"
  + ".bd-gn{display:flex;flex-direction:column;font:600 6.8pt Inter,sans-serif;margin-bottom:1.2mm}.bd-gn span{font-weight:500;color:" + MUT + "}"
  + ".bd-dna{display:flex;gap:3mm}.bd-dnab{flex:none;width:30mm;display:flex;flex-direction:column;gap:.8mm}.bd-dnav{font:700 26pt Fraunces,Georgia,serif;color:" + T + ";line-height:1}.bd-dnal{font:600 6.2pt Inter,sans-serif;color:" + MUT + "}.bd-dnam{display:flex;gap:1mm;align-items:center;font:600 6.6pt Inter,sans-serif}"
  + ".bd-dnag{flex:1;display:grid;grid-template-columns:1fr 1fr;column-gap:4mm;align-content:start}"
  + ".bd-kv{display:flex;flex-direction:column;font:500 6.4pt Inter,sans-serif;color:" + MUT + "}.bd-kv b{font:700 7.8pt Inter,sans-serif;color:" + INK + ";line-height:1.2}.bd-kv2{display:flex;gap:1mm;align-items:center;font:600 6.6pt Inter,sans-serif;margin:1mm 0}"
  + ".bd-evn{font:500 7pt Inter,sans-serif}.bd-evn b{font:700 13pt Fraunces,Georgia,serif}"
  + ".bd-bros{display:grid;grid-template-columns:repeat(4,1fr);gap:1.6mm}.bd-bro{display:flex;flex-direction:column;gap:.3mm;background:#FBF8F1;border:.25mm solid " + LINE + ";border-radius:2.2mm;padding:1.4mm 1.8mm;font:500 6.2pt Inter,sans-serif;min-width:0}.bd-bro b{font:700 7.2pt Inter,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bd-bro span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bd-ph{display:flex;gap:.8mm;align-items:center;font-weight:700;color:" + T + "}"
  + ".bd-disc{font:500 5.6pt Inter,sans-serif;color:" + MUT + "}"
  + ".bd-foot{position:absolute;left:9mm;right:9mm;bottom:5mm;display:flex;justify-content:space-between;border-top:.25mm solid " + G + ";padding-top:1.4mm;font:500 6.2pt 'IBM Plex Mono',monospace;color:#50605b}"
  // phone: one column, the footer below the content (never over it), no fixed heights
  + "@media screen and (max-width:800px){.bd-page{width:100%!important;height:auto!important;min-height:0!important;overflow:visible!important;padding:16px 12px 28px!important;margin:0 0 18px!important}"
  + ".bd-r2,.bd-r21,.bd-r3{grid-template-columns:1fr}.bd-s6{grid-template-columns:repeat(3,1fr)}.bd-pls8{grid-template-columns:repeat(2,1fr)}.bd-bros{grid-template-columns:1fr 1fr}.bd-ycls{grid-template-columns:repeat(3,1fr)}.bd-ro{grid-template-columns:1fr}"
  + ".bd-dna{flex-direction:column}.bd-dnab{width:auto;flex-direction:row;flex-wrap:wrap;align-items:baseline;gap:2mm}.bd-dnag{grid-template-columns:1fr}"
  + ".bd-foot{position:static!important;flex-direction:column;gap:4px;margin-top:12px;font-size:10px}.bd-src{white-space:normal}.bd-card{padding:10px 12px}"
  + ".bd-t{font-size:15px}.bd-sv{font-size:20px}.bd-sl{font-size:11px}.bd-ss,.bd-src,.bd-pls{font-size:10px}.bd-leg,.bd-key,.bd-key3,.bd-roi,.bd-kv,.bd-kv2,.bd-gn,.bd-bro,.bd-hb,.bd-ykv{font-size:12px}.bd-chip,.bd-na,.bd-tag,.bd-nx,.bd-stale{font-size:10px}"
  + ".bd-pln{font-size:11px}.bd-pln b{font-size:14px}.bd-title{font-size:22px}.bd-kick{font-size:10px}.bd-hl{width:40%}.bd-hv{width:auto}.bd-bars{height:auto}.bd-donut,.bd-ring{width:120px;height:120px}.bd-cap,.bd-next{font-size:11px}.bd-yv{font-size:15px}.bd-idc{font-size:11px}.bd-stack{height:16px}.bd-disc{font-size:10px}"
  + ".bpp-story{height:auto!important}.bpp-story-in{height:auto!important;overflow-x:auto!important}.bpp-story-in svg{min-width:640px;max-height:none!important}.bd-ycls{grid-template-columns:1fr}.bd-ycl{display:grid;grid-template-columns:1fr 1fr;column-gap:10px}.bd-ycb,.bd-yg{grid-column:1/-1}.bd-ykv b{font-size:13px}}"
  + ".bd-n4top{display:grid;grid-template-columns:repeat(3,1fr);gap:2mm;margin-bottom:3mm}.bd-n4t{background:#F6F2E9;border-radius:2.4mm;padding:2.4mm 3mm;display:flex;flex-direction:column;gap:.6mm}.bd-n4t b{font:700 15pt Fraunces,Georgia,serif;color:" + T + "}.bd-n4t span{font:600 7.6pt Inter,sans-serif;color:" + INK + "}.bd-n4o b{color:" + GD + "}"
  + ".bd-n4grid{display:grid;grid-template-columns:62mm 1fr;gap:5mm;align-items:start}.bd-donut4{width:60mm;height:60mm}.bd-n4leg{display:flex;flex-direction:column;gap:2.2mm}.bd-n4h{display:flex;align-items:center;gap:1.6mm;font:600 8.6pt Inter,sans-serif;color:" + INK + "}.bd-n4h i{width:3mm;height:3mm;border-radius:.7mm;display:inline-block}.bd-n4h span{margin-left:auto;font:700 9pt Inter,sans-serif;color:" + T + "}.bd-n4cs{display:flex;flex-wrap:wrap;gap:1mm 2.4mm;margin:1mm 0 0 4.6mm}.bd-n4c{font:500 7.2pt Inter,sans-serif;color:" + MUT + "}.bd-n4c b{color:" + INK + "}"
  + "@media screen and (max-width:800px){.bd-n4top{grid-template-columns:1fr 1fr}.bd-n4grid{grid-template-columns:1fr}.bd-donut4{width:200px;height:200px;margin:0 auto;display:block}.bd-n4t b{font-size:20px}.bd-n4t span,.bd-n4h{font-size:13px}.bd-n4c{font-size:12px}}"
  + "</style>";

// keep the writer's page 1 (header, photo, dashboard), drop whatever it wrote after it, put pages 2 and 3 in
const PAGE_OPEN = /<(section|div)\b[^>]*\bclass=["']?[^"'>]*(?<![\w-])page(?![\w-])[^>]*>/gi;
export function placePages(html, p2, p3, p4) {
  let h = String(html || "");
  if (!p2 || !p3) return h;
  h = h.replace(/<style id="bpp-det">[\s\S]*?<\/style>/g, "");
  h = /<\/head>/i.test(h) ? h.replace(/<\/head>/i, PAGES_CSS + "</head>") : PAGES_CSS + h;
  const starts = []; let m; PAGE_OPEN.lastIndex = 0;
  while ((m = PAGE_OPEN.exec(h))) starts.push(m.index);
  const bodyEnd = h.search(/<\/body>/i), end = bodyEnd >= 0 ? bodyEnd : h.length;
  h = h.replace(/page (\d) of 3\b/g, "page $1 of " + (p4 ? 4 : 3));   // the writer's page 1 footer
  if (starts.length >= 2) return h.slice(0, starts[1]) + p2 + p3 + (p4 || "") + h.slice(end);
  return h.slice(0, end) + p2 + p3 + (p4 || "") + h.slice(end);
}

// the two pages for one plot, from the same rows the facts and the dashboard read
export function pagesBlocks(pp, pack, today, f, dateText, mixFile) {
  const F = pageFigures(pp, pack, today, f);
  const st = storySvg(pp, pack, today);
  const story = st ? st.svg.replace(/<svg /, '<svg style="width:100%;height:auto;max-height:' + (STORY_H_MM - 6) + 'mm" ') + '<div style="font:500 5.6pt Inter,sans-serif;color:#5F6B66;margin-top:.6mm">Diamonds = milestones · bars = construction (dashed = planned) · Land Department and Ejari registers</div>' : "";
  let fin = null; try { fin = brokerView(pp, pack, today); } catch (e) { fin = null; }
  const plotId = (pp && (pp.id || pp.plot_id)) || "";
  return { p2: page2(F, story, dateText), p3: page3(F, fin || { classes: [] }, dateText), p4: page4(communityMix(mixFile, plotId), F.identity && F.identity.name, dateText), F };
}
