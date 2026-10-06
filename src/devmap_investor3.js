// v351 - pages 3, 4 and 5 of the investor PDF (page 1 and 2 are in devmap_investor.js and are unchanged).
//   PAGE 3  The investor decision: five boxes "where the register shows", the unit types, the price spread, the net yield card (with blank lines for what no register holds),
//           the past five-year price changes and the historical back-test (what a buyer at the median would have had in past windows). Past figures only.
//   PAGE 4  The evidence: the buildings, the homes coming (supply and absorption), the rent history, liquidity (off-plan against existing-property registrations), off-plan context.
//   PAGE 5  Scenarios: what the register's past windows would imply under STATED assumptions (every assumed number is labelled "assumption").
// All of it is read from the precomputed record KV img_investor3 (scripts/investor3_build.py in the data repo). Nothing is invented here: vacancy, fees and loans are not in any register.
import { BRIEF_KIT, esc } from "./brief_docs.js";
import { icon, dateLong, shortName } from "./devmap_pdf.js";
import { backtest, replay, scenario, annual, cases, svcSensitivity, TRANSFER_FEE, MIN_N } from "./devmap_irr.js";

const { NAVY, MUTED } = BRIEF_KIT;
const TEAL = "#0A4F4A", GOLDI = "#C5A56A", INK = "#22262B", HAIR = "#E6E1D8";
const FONT = "IBM Plex Sans, Segoe UI, Arial, sans-serif";
const BEDS = ["Studio", "1 bed", "2 bed", "3+ bed"];
const fmt = (n) => (n == null || !isFinite(n) ? "" : Math.round(n).toLocaleString("en-US"));
const aed = (n) => "AED " + fmt(n);
const p1 = (x) => (Math.round(Math.abs(x) * 1000) / 10).toFixed(1) + "%";
const p0 = (x) => Math.round(Math.abs(x) * 100) + "%";
const sg = (x) => (Math.abs(x) < 0.0005 ? "" : x < 0 ? "&minus;" : "+") + p1(x);
const sg0 = (x) => (x < 0 ? "&minus;" : "+") + p0(x);

export const ASSUMPTIONS = { feeOther: 0.02, vacancy: 0.05, mgmt: 0.05, sellCost: 0.02 };   // printed as assumptions on page 5; none of them is a register figure
export const SCENARIO_DISCLAIMER = "Scenarios built from past register figures and stated assumptions; not a forecast, not a promised return, not financial advice; vacancy, fees and selling costs are assumptions, not register data; the person using this document should replace them with their own. The figures are for discussion.";
export const BACKTEST_NOTE = "Past windows only. Not a forecast, not a promised return, before vacancy, fees and selling costs, which are in no register.";

const card = (ic, title, body, cls, style) => '<div class="i3c' + (cls ? " " + cls : "") + '"' + (style ? ' style="' + style + '"' : "") + '><div class="i3h">' + (ic ? icon(ic, 16, TEAL) : "") + '<span class="serif">' + title + "</span></div>" + body + "</div>";
const quiet = (title, text) => '<div class="i3c i3q"><div class="i3h">' + icon("info", 16, "#8A9A96") + '<span class="serif">' + title + '</span></div><div class="i3cap">' + text + "</div></div>";
const stat = (big, lab, sub) => '<div class="i3st"><b>' + big + "</b><span>" + lab + "</span>" + (sub ? '<em>' + sub + "</em>" : "") + "</div>";
const blank = (label, w) => '<span class="i3bl">' + label + ' <i style="width:' + (w || 46) + 'px"></i></span>';

// ------------------------------------------------------------------------------------------------ the figures taken from the record
// HEADLINE BASIS: pages 3 to 5 quote the same last-12-month sales, gross yield, median price and yearly growth as pages 1 and 2 (the index figures, m);
// the recount of the register (this record) supplies only the new fields: unit types, spread, buildings, rent history, liquidity, supply, back-test.
export function headRec(rec, m) {
  const r = Object.assign({}, rec);
  if (m && m.l12 && m.l12.sales > 0) r.sales_l12 = m.l12.sales;
  if (m && m.yield) r.yield = { rate: m.yield.rate, contracts: m.yield.contracts };
  r.head = m ? { psf: m.l12 && m.l12.psf ? m.l12.psf : null, rows: m.dev && m.dev.rows ? m.dev.rows.filter((x) => x.solid && !x.partial) : null, sales: m.l12 ? m.l12.sales : null } : null;
  return r;
}
// the longest run of consecutive full years that each hold 100 or more rent contracts, and its compound yearly change
function ownRentGrowth(rec, lastFull) {
  const ry = rec.rent_y || {}, ys = Object.keys(ry).map(Number).filter((y) => y <= lastFull && ry[y].n >= 100 && ry[y].rent > 0).sort((a, b) => a - b);
  let best = [], cur = [];
  for (const y of ys) { if (cur.length && y === cur[cur.length - 1] + 1) cur.push(y); else cur = [y]; if (cur.length >= best.length) best = cur.slice(); }
  if (best.length < 5) return null;
  const a = best[0], b = best[best.length - 1];
  return { rate: Math.pow(ry[b].rent / ry[a].rent, 1 / (b - a)) - 1, from: a, to: b, years: best.length };
}
export function figures(rec, area, dubai, meta) {
  const lastFull = meta.last_full_year, py = rec.price_y || {}, H = rec.head || null;
  const hy = H && H.rows ? new Map(H.rows.map((r) => [r.year, r])) : null;
  const chg = hy ? (a, b) => (hy.has(a) && hy.has(b) ? { from: a, to: b, change: hy.get(b).psf / hy.get(a).psf - 1 } : null)
    : (a, b) => (py[a] && py[b] && py[a][0] >= MIN_N && py[b][0] >= MIN_N ? { from: a, to: b, change: py[b][1] / py[a][1] - 1 } : null);
  const f = { lastFull, growth: [1, 3, 6].map((k) => ({ k, v: chg(lastFull - k, lastFull) })) };
  f.psf = H && H.psf ? H.psf : rec.pct && rec.pct.p50 ? rec.pct.p50 : null;
  f.size = rec.size_sqft || area.size_sqft || null;
  f.gross = rec.yield ? rec.yield.rate : null;
  f.svcPsf = rec.svc && rec.svc.n > 0 ? rec.svc.median : null;
  f.net = f.gross != null && f.svcPsf != null && f.psf ? f.gross - f.svcPsf / f.psf : null;
  f.bt = backtest(rec, area, lastFull);
  f.rp = replay(rec, area, dubai);
  // RENT GROWTH for page 5: the pair's own series only when it has 5 or more full years of 100+ contracts each, else the area's own; never above the area's long-run rate
  const own = ownRentGrowth(rec, lastFull), ac = area.rent_cagr ? { rate: area.rent_cagr.rate, from: area.rent_cagr.from, to: area.rent_cagr.to } : null;
  f.rentG = own ? Object.assign({ scope: "developer" }, own) : ac ? Object.assign({ scope: "area", short: true }, ac) : null;
  if (f.rentG && ac && f.rentG.rate > ac.rate) { f.rentG = Object.assign({}, f.rentG, { rate: ac.rate, capped: true, capFrom: ac.from, capTo: ac.to }); }
  f.rentGOld = rec.rent_cagr ? { rate: rec.rent_cagr.rate, from: rec.rent_cagr.from, to: rec.rent_cagr.to, scope: "developer" } : area.rent_cagr ? { rate: area.rent_cagr.rate, from: area.rent_cagr.from, to: area.rent_cagr.to, scope: "area" } : null;
  return f;
}
// the scenario inputs for page 5, or null when the record cannot support them
export function scenarioSet(rec0, area, dubai, meta, m) {
  const rec = m ? headRec(rec0, m) : rec0;
  const f = figures(rec, area, dubai, meta), y = rec.yield || area.yield;
  if (!f.psf || !f.size || !y || !f.rp) return null;
  const price = f.psf * f.size, rent0 = y.rate * price, svcKnown = f.svcPsf != null, svc = svcKnown ? f.svcPsf * f.size : 0;
  const rentGrowth = f.rentG ? f.rentG.rate : 0;
  const base = { price, feeTransfer: TRANSFER_FEE, feeOther: ASSUMPTIONS.feeOther, rent0, rentGrowth, svc, vacancy: ASSUMPTIONS.vacancy, mgmt: ASSUMPTIONS.mgmt, sellCost: ASSUMPTIONS.sellCost, years: 5 };
  const K = cases(base, f.rp);
  return { f, base, size: f.size, psf: f.psf, price, rent0, svc, svcKnown, svcPsf: f.svcPsf, gy: y.rate, rentGrowth, rentScope: f.rentG ? f.rentG.scope : null, rentFrom: f.rentG ? f.rentG.from : null, rentTo: f.rentG ? f.rentG.to : null,
    rentShort: !!(f.rentG && f.rentG.short), rentCapped: !!(f.rentG && f.rentG.capped), rentCapFrom: f.rentG && f.rentG.capFrom, rentCapTo: f.rentG && f.rentG.capTo,
    yieldScope: rec.yield ? "developer" : "area", scope: f.rp.scope, rp: f.rp, K, stress: K.stress, moderate: K.moderate, firm: K.firm, hist: K.hist, lower: K.lower, upper: K.upper,
    sens: { vac: K.vac, gro: K.gro }, svcSens: svcSensitivity(base, f.size, K.hist.g, svcKnown ? f.svcPsf : null) };
}

// ------------------------------------------------------------------------------------------------ small drawings
function rangeBar(pct) {
  const W = 320, H = 62, L = 10, R = 10, lo = pct.p25 * 0.9, hi = pct.p75 * 1.1, X = (v) => L + (v - lo) / (hi - lo) * (W - L - R);
  const lab = (v, t, up) => '<text x="' + X(v).toFixed(1) + '" y="' + (up ? 16 : 54) + '" font-size="9.4" font-weight="600" fill="' + (t === "Middle" ? TEAL : INK) + '" text-anchor="middle">' + fmt(v) + '</text><text x="' + X(v).toFixed(1) + '" y="' + (up ? 7 : 62) + '" font-size="7.8" fill="' + MUTED + '" text-anchor="middle"></text>';
  return '<svg viewBox="0 0 ' + W + " " + H + '" width="100%" role="img" aria-label="Price per sq ft: lower quarter, middle and upper quarter" font-family="' + FONT + '"><rect x="' + L + '" y="26" width="' + (W - L - R) + '" height="8" rx="4" fill="#F0ECE2"/>' +
    '<rect x="' + X(pct.p25).toFixed(1) + '" y="24" width="' + (X(pct.p75) - X(pct.p25)).toFixed(1) + '" height="12" rx="4" fill="#BBD5D0"/><line x1="' + X(pct.p50).toFixed(1) + '" x2="' + X(pct.p50).toFixed(1) + '" y1="20" y2="40" stroke="' + TEAL + '" stroke-width="2.4"/>' +
    '<text x="' + X(pct.p25).toFixed(1) + '" y="18" font-size="9.4" fill="' + INK + '" text-anchor="middle" font-weight="600">' + fmt(pct.p25) + '</text><text x="' + X(pct.p25).toFixed(1) + '" y="51" font-size="8" fill="' + MUTED + '" text-anchor="middle">lower quarter</text>' +
    '<text x="' + X(pct.p50).toFixed(1) + '" y="18" font-size="9.8" fill="' + TEAL + '" text-anchor="middle" font-weight="700">' + fmt(pct.p50) + '</text><text x="' + X(pct.p50).toFixed(1) + '" y="51" font-size="8" fill="' + MUTED + '" text-anchor="middle">middle</text>' +
    '<text x="' + X(pct.p75).toFixed(1) + '" y="18" font-size="9.4" fill="' + INK + '" text-anchor="middle" font-weight="600">' + fmt(pct.p75) + '</text><text x="' + X(pct.p75).toFixed(1) + '" y="51" font-size="8" fill="' + MUTED + '" text-anchor="middle">upper quarter</text></svg>';
}
function rentChart(ry, lastFull) {
  const ys = Object.keys(ry).map(Number).sort((a, b) => a - b); if (ys.length < 2) return "";
  const W = 330, H = 96, L = 8, R = 8, T = 16, B = 26, mx = Math.max(...ys.map((y) => ry[y].rent)), bw = Math.min(30, (W - L - R) / ys.length - 6), gap = (W - L - R - bw * ys.length) / Math.max(1, ys.length - 1);
  let s = '<svg viewBox="0 0 ' + W + " " + H + '" width="100%" role="img" aria-label="Median annual rent by year" font-family="' + FONT + '">';
  ys.forEach((y, i) => {
    const r = ry[y], x = L + i * (bw + gap), h = Math.max(2, (H - T - B) * r.rent / mx), yy = H - B - h, part = y > lastFull, few = r.n < MIN_N;
    s += '<rect x="' + x.toFixed(1) + '" y="' + yy.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2" fill="' + (part ? "#7FA9A4" : few ? "#CFC6AE" : TEAL) + '"/>' +
      '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (yy - 3).toFixed(1) + '" font-size="8.4" font-weight="600" fill="' + INK + '" text-anchor="middle">' + (r.rent >= 1000 ? Math.round(r.rent / 1000) + "k" : fmt(r.rent)) + '</text>' +
      '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 14) + '" font-size="8.6" fill="' + INK + '" text-anchor="middle">' + (part ? y + "*" : y) + '</text><text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 4) + '" font-size="7.4" fill="' + MUTED + '" text-anchor="middle"' + (few ? ' font-style="italic"' : "") + ">" + (few ? "few: " : "") + fmt(r.n) + "</text>";
  });
  return s + "</svg>";
}
function liqChart(liq, lastFull) {
  const ys = Object.keys(liq).map(Number).sort((a, b) => a - b).filter((y) => liq[y][0] >= 1); if (ys.length < 2) return "";
  const W = 330, H = 96, L = 8, R = 8, T = 16, B = 26, mx = Math.max(...ys.map((y) => liq[y][0])), bw = Math.min(30, (W - L - R) / ys.length - 6), gap = (W - L - R - bw * ys.length) / Math.max(1, ys.length - 1);
  let s = '<svg viewBox="0 0 ' + W + " " + H + '" width="100%" role="img" aria-label="Registrations per year: off-plan and existing property" font-family="' + FONT + '">';
  ys.forEach((y, i) => {
    const [n, off] = liq[y], x = L + i * (bw + gap), h = Math.max(2, (H - T - B) * n / mx), yy = H - B - h, ho = h * off / n;
    s += '<rect x="' + x.toFixed(1) + '" y="' + yy.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (h - ho).toFixed(1) + '" rx="2" fill="' + TEAL + '"/><rect x="' + x.toFixed(1) + '" y="' + (yy + h - ho).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + ho.toFixed(1) + '" fill="' + GOLDI + '"/>' +
      '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (yy - 3).toFixed(1) + '" font-size="8.2" font-weight="600" fill="' + INK + '" text-anchor="middle">' + fmt(n) + '</text>' +
      '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 14) + '" font-size="8.6" fill="' + INK + '" text-anchor="middle">' + (y > lastFull ? y + "*" : y) + '</text><text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 4) + '" font-size="7.6" fill="#8A6D2C" text-anchor="middle">' + Math.round(100 * off / n) + "%</text>";
  });
  return s + "</svg>";
}
function supplyBars(b) {
  const keys = [["past", "Already past its planned date"], ["2026", "Planned 2026"], ["2027", "Planned 2027"], ["2028+", "Planned 2028 and later"], ["none", "No date stated"]], mx = Math.max(1, ...keys.map(([k]) => b[k][1]));
  return keys.map(([k, l]) => '<div class="i3br"><span class="i3bln">' + l + '</span><span class="i3bt"><i style="width:' + Math.max(b[k][1] ? 2 : 0, Math.round(b[k][1] / mx * 100)) + "%;background:" + (k === "past" ? "#B8956A" : TEAL) + '"></i></span><span class="i3bv"><b>' + fmt(b[k][1]) + "</b> homes &middot; " + b[k][0] + (b[k][0] === 1 ? " project" : " projects") + "</span></div>").join("");
}

// ------------------------------------------------------------------------------------------------ page 3
function box(ic, title, big, body, span) { return '<div class="i3box" style="grid-column:span ' + span + '"><div class="i3h">' + icon(ic, 16, TEAL) + '<span class="serif">' + title + '</span></div><div class="i3big">' + big + "</div>" + body + "</div>"; }
function fiveBoxes(rec, area, f, m) {
  const S = area.supply || null, bs = rec.beds || {};
  // INCOME
  let inc = '<div class="i3cap">Gross: a year\'s rent over the purchase price, from ' + fmt(rec.yield ? rec.yield.contracts : 0) + " rent contracts.";
  if (f.net != null) inc += " Less the register service charge (AED " + f.svcPsf.toFixed(1) + " per sq ft a year, known for " + rec.svc.n + " of " + rec.svc.of + " buildings): <b>" + p1(f.net) + "</b>, before vacancy, management fees and other costs, which are in no register: you add them.";
  else inc += " The service charge is not on the register for these buildings, so no net figure is shown.";
  inc += "</div>";
  const incBox = box("wallet", "Income", rec.yield ? p1(rec.yield.rate) + " <small>gross</small>" : "&ndash;", inc, 2);
  // GROWTH
  const gr = f.growth.map((g) => g.v ? stat(sg(g.v.change), g.k + (g.k === 1 ? " year" : " years"), g.v.from + " to " + g.v.to) : stat("&ndash;", g.k + (g.k === 1 ? " year" : " years"), "not enough sales")).join("");
  const grBox = '<div class="i3box" style="grid-column:span 2"><div class="i3h">' + icon("chart-bar", 16, TEAL) + '<span class="serif">Growth</span></div><div class="i3sts">' + gr + '</div><div class="i3cap">Change in the median price per sq ft between full years. Past changes only.</div></div>';
  // LIQUIDITY
  const hr = rec.head && rec.head.rows ? rec.head.rows.find((r) => r.year === f.lastFull) : null;
  const lastN = hr ? hr.sales : rec.price_y && rec.price_y[f.lastFull] ? rec.price_y[f.lastFull][0] : null;
  const liqBox = box("chart-donut", "Liquidity", fmt(rec.sales_l12) + " <small>sales, last 12 months</small>", '<div class="i3cap">' + (lastN ? fmt(lastN) + " sales in " + f.lastFull + ". " : "") + "The register does not say who sold to whom, so resale against first sale is not shown. Page " + (4 + (PGOFF || 0)) + " splits off-plan from existing-property registrations.</div>", 2);
  // SUPPLY
  let sup;
  if (S && S.homes) {
    const b = S.buckets;
    sup = '<div class="i3cap"><b>' + fmt(S.homes) + "</b> homes in " + S.projects + " projects are registered under construction in " + esc(area.name) + ": " + fmt(b.past[1]) + " already past their planned date, " + fmt(b["2026"][1]) + " planned 2026, " + fmt(b["2027"][1]) + " in 2027, " + fmt(b["2028+"][1]) + " in 2028 and later, " + fmt(b.none[1]) + " with no date." + (S.years_of_sales ? " That is " + S.years_of_sales.toFixed(1) + " years of current area sales." : "") + " Planned dates are the register's; some are old.</div>";
  } else sup = '<div class="i3cap">No homes under construction are on the project register for this area.</div>';
  const supBox = box("buildings", "Supply", S && S.homes ? (S.years_of_sales ? S.years_of_sales.toFixed(1) + " <small>years of sales</small>" : fmt(S.homes) + " <small>homes</small>") : "&ndash;", sup, 3);
  // MOST ACTIVITY
  const ms = rec.most_sales_bed, ty = rec.top_yield_bed;
  let act = '<div class="i3cap">';
  if (ms) act += "Where the register shows the most sales: <b>" + BEDS[ms.bed] + "</b> homes, " + fmt(ms.sales) + " of " + fmt(ms.of) + " flat sales (" + p0(ms.sales / ms.of) + "). ";
  if (ty) act += "Where it shows the highest gross yield (30 or more sales and contracts): <b>" + BEDS[ty.bed] + "</b>, " + p1(ty.yield) + ". ";
  act += "A description of the register, not a recommendation.</div>";
  const actBox = box("star", "Most activity", ms ? BEDS[ms.bed] : "&ndash;", act, 3);
  return '<div class="i3grid6">' + incBox + grBox + liqBox + supBox + actBox + "</div>";
}
function unitCards(rec) {
  const bs = rec.beds || {};
  return '<div class="i3grid4">' + [0, 1, 2, 3].map((b) => {
    const e = bs[b]; if (!e || !e.sales) return '<div class="i3c i3u"><div class="i3h"><span class="serif">' + BEDS[b] + '</span></div><div class="i3cap">No sales in the last 12 months.</div></div>';
    const enough = e.sales >= MIN_N;
    return '<div class="i3c i3u"><div class="i3h"><span class="serif">' + BEDS[b] + "</span></div>" +
      (enough ? '<div class="i3ub"><b>' + aed(e.psf) + "</b> per sq ft</div>" : '<div class="i3ub"><b>&ndash;</b> not enough sales</div>') +
      '<div class="i3cap">' + fmt(e.sales) + " sales &middot; " + (e.rents >= MIN_N ? "rent " + aed(e.rent) + " a year (" + fmt(e.rents) + ")" : "rent: not enough contracts") + " &middot; gross yield " + (e.yield != null ? "<b>" + p1(e.yield) + "</b>" : "&ndash;") + "</div></div>";
  }).join("") + "</div>";
}
function occCap(rec) {
  const o = rec && rec.occ; if (!o || o.share == null || !o.units) return "";
  const nb = Array.isArray(o.buildings) ? o.buildings.length : 0;
  const when = o.as_of ? " (" + esc(dateLong(o.as_of)) + ")" : "";
  const sup = o.suppressed > 0 ? " " + fmt(o.suppressed) + (o.suppressed === 1 ? " building" : " buildings") + " with fewer than 10 homes " + (o.suppressed === 1 ? "is" : "are") + " left out." : "";
  return '<div class="i3cap"><b>DEWA connection proxy:</b> ' + Math.round(o.share * 100) + "% of " + fmt(o.units) + " registered homes" + (nb ? " in " + nb + " of this developer's buildings we could place" : "") + " have an active DEWA connection" + when + ". A lower bound: it is not a vacancy rate and not a household count, and it does not replace the vacancy you assume." + sup + " Source: Dubai Electricity and Water Authority customer premises data via Dubai Pulse open data.</div>";
}
function netCard(rec, f) {
  const blanks = '<div class="i3blanks">' + blank("Vacancy", 40) + " % " + blank("Management fee", 40) + " % " + blank("Other costs", 60) + " AED</div>";
  let body;
  if (f.gross != null) {
    body = '<div class="i3rows"><div><span>Gross yield</span><b>' + p1(f.gross) + "</b></div>" +
      (f.svcPsf != null ? "<div><span>Register service charge</span><b>AED " + f.svcPsf.toFixed(1) + " /sq ft</b></div><div class=\"i3tot\"><span>Gross less service charge</span><b>" + p1(f.net) + "</b></div>" : "<div><span>Register service charge</span><b>not on the register</b></div>") + "</div>" +
      '<div class="i3cap">' + (f.svcPsf != null ? "Median of " + rec.svc.n + " of " + rec.svc.of + " buildings that carry the developer's name (range AED " + rec.svc.min.toFixed(1) + " to " + rec.svc.max.toFixed(1) + ", budget year " + rec.svc.year + "); service charge known for " + rec.svc.n + " of " + rec.svc.of + " buildings. " : "") + "Before vacancy, management fees and other costs, which are in no register: you add them.</div>" + blanks;
  } else body = '<div class="i3cap">Not enough rent contracts for a gross yield.</div>' + blanks;
  return card("calculator", "Income after the service charge", body + occCap(rec));
}
function spreadCard(rec) {
  if (!rec.pct) return quiet("Price spread", "Not enough registered sales for a spread.");
  const q = rec.pct;
  return card("ruler", "Price spread, per sq ft", rangeBar(q) + '<div class="i3cap">Lower quarter, middle and upper quarter of the ' + fmt(q.n) + " sales in the recount of the last 12 months (AED per sq ft). The middle half of sales sit within " + p0((q.p75 - q.p25) / q.p50) + " of the middle price.</div>");
}
function replayCards(f) {
  const r = f.rp; if (!r) return quiet("Past five-year price changes", "Not enough years on the register for three five-year windows.");
  const scope = r.scope === "developer" ? "this developer in this area" : r.scope === "area" ? "all homes in this area" : "all of Dubai";
  const one = (lab, w) => '<div class="i3rp"><span>' + lab + "</span><b>" + sg0(w.change) + "</b><em>" + w.from + " to " + w.to + "</em></div>";
  return card("chart-bar", "Past five-year price changes: slowest, middle and fastest", '<div class="i3rps">' + one("Slowest", r.slow) + one("Middle", r.mid) + one("Fastest", r.fast) + '</div><div class="i3cap">What the register shows for past windows, not a forecast. Median price per sq ft, ' + scope + ", " + r.windows.length + " five-year windows with price data.</div>");
}
function irrCards(f) {
  const b = f.bt;
  if (!b.count) return quiet("Past five-year windows: the annualised return", "Not enough years with 30 or more rent contracts and sales to run a five-year back-test" + (b.skipped.length ? " (" + b.skipped.length + (b.skipped.length === 1 ? " window" : " windows") + " had an incomplete rent series)" : "") + ".");
  const lab = b.pick.length === 3 ? ["Slowest window", "Middle window", "Fastest window"] : b.pick.length === 1 ? ["The one window"] : b.pick.map((_, i) => (i === 0 ? "Slower window" : "Faster window"));
  const one = (l, w) => '<div class="i3rp"><span>' + l + "</span><b>" + p1(w.irr) + "</b><em>" + w.from + " to " + w.to + "</em></div>";
  const scope = b.level === "developer" ? "this developer in this area" : "all homes in this area";
  return card("calculator", "Past five-year windows: the annualised return (IRR) a buyer at the median would have had", '<div class="i3rps">' + b.pick.map((w, i) => one(lab[i], w)).join("") + '</div><div class="i3cap">' + "Of " + (b.count + b.skipped.length) + " five-year windows with price data for " + scope + ", " + b.count + (b.count === 1 ? " has" : " have") + " a complete rent series and " + (b.count === 1 ? "is" : "are") + " shown" + (b.skipped.length ? " (" + b.skipped.length + " left out for missing rent years)" : "") + ". Bought at the median price per sq ft of the first year plus the 4% Dubai Land Department transfer fee, the median rent each year" + (b.svcKnown ? " less the register service charge held at today's figure" : ", before service charges (none on the register for these buildings)") + ", sold at the median of the fifth year. " + BACKTEST_NOTE + "</div>");
}
let PGOFF = 0;   // v353: pages after the executive summary are numbered one higher
export function page3(C, m, rec, area, dubai, meta) {
  PGOFF = C.pgOff || 0;
  rec = headRec(rec, m);
  const f = figures(rec, area, dubai, meta), areaName = esc(C.names.plain);
  const title = '<div class="i3title"><h1 class="serif" style="font-size:21px;margin:0">The investor decision. Where the register shows: ' + esc(shortName(m.name, 30)) + " in " + areaName + '</h1><div class="i3cap">Past registered figures to ' + esc(dateLong(m.asOf)) + ". Sales counted as on pages " + (1 + PGOFF) + " and " + (2 + PGOFF) + ", including registered delayed sales. Headline sales, yield, price and growth are as on pages " + (1 + PGOFF) + " and " + (2 + PGOFF) + "; the unit types, spread, buildings and later pages are a full recount of the register, so small differences between the pages are normal.</div></div>";
  const disc = '<div class="i3disc"><b>Please read.</b> Past figures only: no forecast, no promised return, not financial advice and not an offer. Vacancy, management fees, other running costs and any loan are not in any register; add your own. A developer\'s figures cover the buildings the register attributes to it in this area. Check each property and your own circumstances with a licensed adviser before buying.</div>';
  return devStrip(m, C) + title + fiveBoxes(rec, area, f, m) + unitCards(rec) + '<div class="i3two">' + spreadCard(rec) + netCard(rec, f) + '</div><div class="i3two">' + replayCards(f) + irrCards(f) + "</div>" + disc;
}

// ------------------------------------------------------------------------------------------------ page 4
function buildingCards(rec) {
  const L = rec.blds || [];
  if (!L.length) return quiet("The buildings", "Not enough registered data: no building has five or more sales in the last 12 months.");
  const cards = L.map((b) => {
    const l1 = fmt(b.sales) + " sales &middot; " + aed(b.psf) + " per sq ft" + (b.change != null ? " &middot; " + sg(b.change) + " on the 12 months before" : "");
    const l2 = b.yield != null ? BEDS[b.bed] + " rent " + aed(b.rent) + " (" + fmt(b.rents) + " contracts) &middot; gross yield <b>" + p1(b.yield) + "</b>" : (b.bed != null ? BEDS[b.bed] + ": " + (b.rents ? "only " + fmt(b.rents) + " rent contracts, not enough for a yield" : "no rent contracts on the register") : "");
    const l3 = b.svc != null ? "Service charge AED " + b.svc.toFixed(1) + " per sq ft (budget " + b.svc_year + ")" + (b.net != null ? " &middot; gross less service charge <b>" + p1(b.net) + "</b>" : "") : "Service charge: not on the register for this name";
    return '<div class="i3bd"><div class="i3bdn">' + esc(shortName(b.name, 34)) + (b.off_share >= 0.5 ? ' <em class="i3tag">mostly off-plan</em>' : "") + '</div><div class="i3bdl">' + l1 + '</div><div class="i3bdl">' + l2 + '</div><div class="i3bdl">' + l3 + "</div></div>";
  });
  return '<div class="i3c"><div class="i3h">' + icon("buildings", 16, TEAL) + '<span class="serif">The buildings, ranked by sales in the last 12 months</span></div><div class="i3grid2">' + cards.join("") + '</div><div class="i3cap">' + L.length + " of " + rec.blds_total + " buildings with five or more sales are shown. Yield is for each building's busiest home size (30 or more rent contracts). Gross less service charge is before vacancy, management fees and other costs, which are in no register: you add them. Service charge known for " + rec.svc.n + " of " + rec.svc.of + " buildings (only where the building's own name carries the developer's).</div></div>";
}
function supplyCard(rec, area) {
  const S = area.supply; if (!S || !S.homes) return quiet("Homes coming in " + esc(area.name), "Not enough registered data: no project under construction is on the register for this area.");
  const P = rec.pipeline;
  const own = P && P.projects ? "This developer's own pipeline here: " + P.projects + (P.projects === 1 ? " project" : " projects") + ", " + fmt(P.homes) + " homes (" + fmt(P.buckets.past[1]) + " past their planned date, " + fmt(P.buckets["2027"][1] + P.buckets["2026"][1]) + " planned 2026 or 2027, " + fmt(P.buckets["2028+"][1]) + " later, " + fmt(P.buckets.none[1]) + " with no date)." : "No under-construction project of this developer could be attributed here.";
  const abs = S.years_of_sales ? fmt(S.homes) + " incoming homes &divide; " + fmt(area.sales_l12) + " sales in the last 12 months = <b>" + S.years_of_sales.toFixed(1) + " years of current sales</b>. " : "";
  return card("map-trifold", "Homes coming in " + esc(area.name) + ": by planned year", supplyBars(S.buckets) + '<div class="i3cap">' + abs + own + " Dates are the register's planned dates; some are old.</div>");
}
function rentCard(rec, area, f, meta) {
  const ry = (rec.rent_y && Object.keys(rec.rent_y).length >= 2 ? rec.rent_y : null), src = ry ? rec : null;
  if (!ry) return quiet("Rent history", "Not enough registered data: fewer than two years of rent contracts for this developer here.");
  const c = rec.rent_cagr, l = rec.rent_l12, fl = rec.rent_flow;
  let t = "";
  if (c) t += "Compound yearly change " + c.from + " to " + c.to + ": <b>" + sg(c.rate) + "</b>" + (c.to - c.from < 5 ? " (a short series)" : "") + ". ";
  if (l) t += "Last 12 months " + aed(l.median) + " against " + aed(l.prior) + " the 12 months before: <b>" + sg(l.change) + "</b>. ";
  if (fl && (fl.new || fl.renew)) t += "Last 12 months: " + fmt(fl.new) + " new contracts" + (fl.new_median ? " (median " + aed(fl.new_median) + ")" : "") + " and " + fmt(fl.renew) + " renewals" + (fl.renew_median ? " (median " + aed(fl.renew_median) + ")" : "") + ". ";
  return card("wallet", "Median annual rent, by year", rentChart(ry, meta.last_full_year) + '<div class="i3cap">' + t + "Flat rent contracts by start year, count under each bar; * part year. Contracts registered, not market rent.</div>");
}
function liqCard(rec, meta) {
  const ly = rec.liq_y; if (!ly || Object.keys(ly).length < 2) return quiet("Liquidity", "Not enough registered data for a yearly split.");
  const q = rec.liq || {}, pk = q.peak;
  let t = "";
  if (pk) t += "In " + pk.year + " (the busiest full year, " + fmt(pk.n) + " registrations), <b>" + p0(pk.off / pk.n) + "</b> were off-plan. ";
  const l12 = rec.sales_l12; if (l12) t += "Last 12 months: " + fmt(q.existing_l12) + " existing-property and " + fmt(q.off_l12) + " off-plan (" + p0(q.off_l12 / l12) + "). ";
  const comp = [0, 1, 2, 3].filter((b) => rec.beds && rec.beds[b] && rec.beds[b].sales).map((b) => BEDS[b] + " " + fmt(rec.beds[b].sales)).join(", ");
  if (comp) t += "Comparable sales in the last 12 months by size: " + comp + ". ";
  if (q.iqr_pct != null) t += "Middle half of prices spans " + p0(q.iqr_pct) + " of the median. ";
  return card("chart-donut", "Liquidity: off-plan and existing property", '<div class="i3leg"><span><i style="background:' + TEAL + '"></i>existing property</span><span><i style="background:' + GOLDI + '"></i>off-plan (share under each bar)</span></div>' + liqChart(ly, meta.last_full_year) + '<div class="i3cap">' + t + "Existing property includes the developer's own ready stock, not only resales.</div>");
}
function offplanCards(rec) {
  const L = rec.offplan || [];
  if (!L.length) return quiet("Off-plan context", "Not enough registered data: no project of this developer has five or more off-plan sales here in the last 12 months. Payment plans and rent at delivery are not in any register.");
  const cs = L.slice(0, 3).map((o) => {
    const vs = o.premium != null ? BEDS[o.bed] + ": AED " + fmt(o.off_psf) + " per sq ft against AED " + fmt(o.ready_psf) + " for existing-property homes of that size in the area (" + fmt(o.ready_n) + " sales), <b>" + p1(o.premium) + (o.premium < 0 ? " below" : " above") + "</b>" : "No comparable existing-property sales of the same size in the area";
    const when = o.end ? "planned completion " + esc(dateLong(o.end)) + " (the register's date)" : "no planned date on the register";
    return '<div class="i3bd"><div class="i3bdn">' + esc(shortName(o.name, 32)) + " <em class=\"i3tag\">" + fmt(o.sales) + " off-plan sales</em></div><div class=\"i3bdl\">" + vs + '</div><div class="i3bdl">' + when.charAt(0).toUpperCase() + when.slice(1) + (o.pct != null ? ", " + Math.round(o.pct) + "% built" : "") + "</div></div>";
  });
  return '<div class="i3c"><div class="i3h">' + icon("buildings", 16, TEAL) + '<span class="serif">Off-plan context</span></div><div class="i3stack">' + cs.join("") + '</div><div class="i3cap">Off-plan prices are the contract price, not what a home would fetch today. Payment plans and rent at delivery are not in any register.</div></div>';
}
export function page4(C, m, rec, area, dubai, meta) {
  rec = headRec(rec, m);
  const f = figures(rec, area, dubai, meta);
  const title = '<div class="i3title"><h1 class="serif" style="font-size:20px;margin:0">The evidence: the figures behind the decision</h1></div>';
  const repeat = '<div class="i3rep">' + icon("info", 14, "#8A9A96") + "<span><b>Repeat sales of the same unit</b> are not in the register: a sale carries no unit number, so resale and flip rates cannot be shown.</span></div>";
  return devStrip(m, C) + title + buildingCards(rec) + '<div class="i3two">' + rentCard(rec, area, f, meta) + liqCard(rec, meta) + '</div><div class="i3two">' + supplyCard(rec, area) + offplanCards(rec) + "</div>" + repeat;
}

// ------------------------------------------------------------------------------------------------ page 5
const tag = (t) => '<em class="i3tag ' + (t === "assumption" ? "i3ta" : "") + '">' + t + "</em>";
export const NA_SVC = "NOT AVAILABLE: excluded from the calculation";
export const WARN_SVC = "Return shown before service charges and maintenance";
export const NOT_FORECAST = "These are scenarios, not forecasts.";
export const IRR_PLAIN = (v) => "IRR " + p1(v) + ": the modeled yearly return across the whole five years, counting rent and the sale.";
const devStrip = (m, C) => '<div class="i3dev">' + icon("buildings", 14, TEAL) + "<span>This page is about <b>" + esc(shortName(m.name, 34)) + "</b> in <b>" + esc(C.names.plain) + "</b>.</span></div>";
function parts(C, m, S) {
  const A = ASSUMPTIONS, H = S.hist, R = H.r, ST = S.stress.r, f = S.f;
  const warn = S.svcKnown ? "" : '<div class="i3warn">' + icon("info", 14, "#8A4B1E") + "<span><b>" + WARN_SVC + ".</b> The register holds no service charge for these buildings.</span></div>";
  // (2) the four answers
  const ans = (q, big, sub) => '<div class="i3an"><span class="i3anq">' + q + '</span><b>' + big + "</b><em>" + sub + "</em></div>";
  const four = '<div class="i3ans">' +
    ans("How much cash do I need?", aed(R.cash0) + " all-in", "price " + aed(S.price) + " + " + p0(TRANSFER_FEE) + " transfer fee + " + p0(A.feeOther) + " agent and other (assumption)") +
    ans("What does it generate while I own it?", "About " + p1(R.cashOnCash1) + " in year one", S.svcKnown ? "after vacancy, management and the register service charge" : "before service charges") +
    ans("What has to happen for the historical-case return?", "The price must rise about " + p1(H.g) + " a year", "the register's middle past window, " + H.w.from + " to " + H.w.to) +
    ans("What happens if it does not?", "With no price growth the five-year return is " + p1(ST.irr), "the stress case: the property does not appreciate") + "</div>";
  // (1) the four cases
  const sc = (lab, sub, o, cls) => '<div class="i3c i3sc ' + (cls || "") + '"><div class="i3h"><span class="serif">' + lab + '</span></div><div class="i3cap" style="margin-top:-3px">' + sub + '</div><div class="i3scb"><b>' + p1(o.r.irr) + "</b><span>IRR, five years</span></div><div class=\"i3rows\">" +
    "<div><span>Price growth a year</span><b>" + sg(o.g) + "</b></div><div><span>Value after 5 years</span><b>" + aed(o.r.exitGross) + "</b></div><div><span>Cash return, year 1</span><b>" + p1(o.r.cashOnCash1) + "</b></div><div><span>Modeled profit</span><b>" + aed(o.r.profit) + "</b></div></div></div>";
  const cards = '<div class="i3grid4">' + sc("Stress case", "0% a year: the property does not appreciate", S.stress) + sc("Moderate case", "3% a year", S.moderate) + sc("Firm case", "6% a year", S.firm) +
    sc("Historical case", "Based on the " + H.w.from + " to " + H.w.to + " window", H, "i3hc") + "</div>" +
    '<div class="i3cap"><b>' + NOT_FORECAST + "</b> " + IRR_PLAIN(R.irr) + "</div>";
  // (8) profit block
  const line = (l, v, strong) => "<div" + (strong ? ' class="i3tot"' : "") + "><span>" + l + "</span><b>" + v + "</b></div>";
  const rentLbl = S.svcKnown ? "Rent kept over 5 years (after vacancy, management and service charge)" : "Rent received over 5 years (after vacancy and management)";
  const profit = '<div class="i3c"><div class="i3h">' + icon("wallet", 16, TEAL) + '<span class="serif">The money, historical case</span></div><div class="i3rows">' +
    line("Cash invested (price + buying costs)", aed(R.cash0)) + line(rentLbl, aed(R.cum)) + line("Sale value modeled", aed(R.exitGross)) + line("Selling cost (" + p0(A.sellCost) + ")", "&minus;" + aed(R.sellCost)) +
    line("Modeled profit", aed(R.profit), true) + "</div>" +
    '<div class="i3cap"><b>' + aed(R.totalIn) + " in, " + aed(R.totalOut) + " out.</b> Modeled profit = rent received + sale value &minus; selling cost &minus; cash invested." + (S.svcKnown ? "" : " " + WARN_SVC + ".") + "</div>" +
    '<div class="i3cap i3small">Stress case (no price growth): ' + aed(ST.totalIn) + " in, " + aed(ST.totalOut) + " out, modeled profit " + aed(ST.profit) + ".</div></div>";
  // (5) where the return comes from + (6) waterfall
  const sp = R.split;
  const sentence = sp ? "About " + p0(sp.exit) + " of the modeled gain comes from the sale price, " + p0(sp.rent) + " from rent (before buying and selling costs)." : "In this case the sale price adds nothing to the gain; rent is the only source.";
  const wf = (l, v, cls) => '<div class="i3wf ' + (cls || "") + '"><span>' + l + "</span><b>" + v + "</b></div>";
  const where = '<div class="i3c"><div class="i3h">' + icon("chart-donut", 16, TEAL) + '<span class="serif">Where the return comes from</span></div><div class="i3sts">' +
    stat(p1(R.incomeReturn1), "Income return, year one", S.svcKnown ? "before service charge" : "before service charges") + stat(sg(H.g), "Assumed price growth a year", "historical case") + stat(p1(R.irr), "Five-year modeled IRR", "rent and sale") + "</div>" +
    '<div class="i3cap"><b>' + sentence + "</b></div>" +
    '<div class="i3wfs">' + wf("Gross yield (rent over price)", p1(R.grossYield)) + '<i>&rarr;</i>' + wf("Less vacancy and management", "&minus;" + p1(R.grossYield - R.afterCostsYield)) + '<i>&rarr;</i>' + wf("Cash return before service charges", p1(R.afterCostsYield), "i3wfe") + "</div>" +
    '<div class="i3cap i3small">As a share of the price. On all the cash invested (price plus buying costs) the year-one cash return is ' + p1(R.cashOnCash1) + ".</div></div>";
  // (9) assumptions in three boxes
  const row = (l, v, t) => '<div class="i3ar"><span>' + l + "</span><b>" + v + "</b>" + (t ? tag(t) : "") + "</div>";
  const rp = S.rp, scope = rp.scope === "developer" ? "this developer here" : rp.scope === "area" ? "the area" : "Dubai";
  const rentSrc = S.rentScope ? "past compound change " + S.rentFrom + " to " + S.rentTo + ", " + (S.rentCapped ? "capped at the area's own long-run rate" : S.rentScope === "area" ? "the area's: this developer's own rent series is too short" : "this developer") : "assumption";
  const box3 = (title, cls, body) => '<div class="i3c i3as ' + cls + '"><div class="i3h"><span class="serif">' + title + "</span></div>" + body + "</div>";
  const reg = box3("From the register", "i3asr",
    row("Home size", fmt(S.size) + " sq ft", "typical home") + row("Purchase price", aed(S.price), "median per sq ft x size") + row("Starting rent a year", aed(S.rent0), "gross yield x price") +
    row("Gross yield (rent over price)", p1(S.gy), S.yieldScope === "developer" ? "this developer" : "area") + row("Transfer fee", p0(TRANSFER_FEE), "published fee") +
    row("Historical windows", rp.windows.length + " of five years", scope + ": " + sg(rp.slow.change) + " to " + sg(rp.fast.change) + " in total") +
    (S.svcKnown ? row("Service charge a year", aed(S.svc), "AED " + S.svcPsf.toFixed(1) + " per sq ft, budget") : ""));
  const mod = box3("Model assumptions", "i3asm",
    row("Vacancy", p0(A.vacancy) + " of rent", "assumption") + row("Management", p0(A.mgmt) + " of rent", "assumption") + row("Selling cost", p0(A.sellCost) + " of the price", "assumption") + row("Agent and other buying costs", p0(A.feeOther), "assumption") +
    row("Rent growth a year", S.rentScope ? sg(S.rentGrowth) : "held flat", rentSrc) + row("Hold", "5 years", "assumption"));
  const na = box3("Not available", "i3asn",
    (S.svcKnown ? "" : row("Service charge", NA_SVC)) + row("Maintenance", "not in any register") + row("Financing", "not included: no loan modeled") + row("Furnishing", "not included"));
  const assume = '<div class="i3grid3 i3as3">' + reg + mod + na + "</div>";
  // table: the historical case year by year
  const trow = (l, arr, strong) => "<tr" + (strong ? ' class="i3tt"' : "") + "><td>" + l + "</td>" + arr.map((x) => "<td>" + (x == null ? "" : Math.round(x) === 0 ? "0" : fmt(x)) + "</td>").join("") + "</tr>";
  const yrs = R.rows;
  const svcRow = S.svcKnown ? trow("Less service charge", [null].concat(yrs.map((r) => -r.sv))) : '<tr class="i3na"><td>Service charge</td><td colspan="6">' + NA_SVC + "</td></tr>";
  const table = '<div class="i3c"><div class="i3h">' + icon("chart-bar", 16, TEAL) + '<span class="serif">The historical case, year by year (AED)</span></div><table class="i3tb"><tr><th></th><th>Start</th>' + yrs.map((r) => "<th>Year " + r.year + "</th>").join("") + "</tr>" +
    trow("Rent", [null].concat(yrs.map((r) => r.rent))) + trow("Less vacancy", [null].concat(yrs.map((r) => -r.vac))) + trow("Less management fee", [null].concat(yrs.map((r) => -r.mg))) +
    trow("Income after vacancy and management", [null].concat(yrs.map((r) => r.inc)), true) + svcRow + trow("Price, fees and sale", [-R.cash0, null, null, null, null, R.exitNet]) + trow("Cash flow", R.cfs, true) + "</table>" +
    '<div class="i3cap">' + IRR_PLAIN(R.irr).replace(/^IRR/, "IRR") + " The start is the price plus " + p0(TRANSFER_FEE + A.feeOther) + " buying costs; year five includes the sale at " + aed(R.exitGross) + " less " + p0(A.sellCost) + " selling cost.</div></div>";
  // (3)(d) sensitivities
  const k = S.K, hv = (o) => p1(o.r.irr);
  const sens = '<div class="i3c"><div class="i3h">' + icon("stack", 16, TEAL) + '<span class="serif">How the historical case moves (IRR)</span></div><div class="i3sens">' +
    "<div><span>Vacancy</span>" + k.vac.map((x) => "<b>" + p0(x.v) + ": " + p1(x.irr) + "</b>").join("") + "</div>" +
    "<div><span>Price growth</span>" + k.gro.map((x) => "<b>" + (x.d === 0 ? "historical" : (x.d < 0 ? "&minus;" : "+") + "2 points") + " (" + sg(x.g) + "): " + p1(x.irr) + "</b>").join("") + "</div>" +
    "<div><span>Other windows</span><b>Lower historical window (" + sg(k.lower.g) + ", " + k.lower.w.from + " to " + k.lower.w.to + "): " + hv(k.lower) + "</b><b>Upper historical window (" + sg(k.upper.g) + ", " + k.upper.w.from + " to " + k.upper.w.to + "): " + hv(k.upper) + "</b></div></div></div>";
  const ssv = '<div class="i3c"><div class="i3h">' + icon("calculator", 16, TEAL) + '<span class="serif">If the service charge were...</span></div><div class="i3svs"><div class="i3svh"><span>AED per sq ft</span><span>Per year</span><span>Cash return, year 1</span><span>Five-year IRR</span></div>' +
    S.svcSens.map((r) => '<div class="' + (r.kind === "register" ? "i3svr" : "") + '"><span>' + r.psf.toFixed(r.psf % 1 ? 1 : 0) + (r.kind === "register" ? " (register)" : " (illustrative)") + "</span><span>" + aed(r.svc) + "</span><span>" + p1(r.cash1) + "</span><span>" + p1(r.irr) + "</span></div>").join("") + "</div>" +
    '<div class="i3cap">Historical case. ' + (S.svcKnown ? "The register's own figure is marked; the others are illustrative." : "The register holds no figure for this pair: 15 and 20 are illustrative, not register data.") + "</div></div>";
  const title = '<div class="i3title"><div class="lbl" style="text-transform:uppercase">Scenarios</div><h1 class="serif" style="font-size:22px">What the register\'s past windows would imply under stated assumptions</h1><div class="i3cap">For discussion. ' + fmt(S.size) + " sq ft at " + aed(S.psf) + " per sq ft, " + (S.scope === "developer" ? "for this developer in this area" : S.scope === "area" ? "for all homes in this area" : "for Dubai as a whole") + ".</div></div>";
  const disc = '<div class="i3disc">' + SCENARIO_DISCLAIMER + "</div>";
  const title2 = '<div class="i3title"><div class="lbl" style="text-transform:uppercase">Scenarios, continued</div><h1 class="serif" style="font-size:22px">The workings: assumptions, year by year, and what moves the return</h1></div>';
  return { p5: devStrip(m, C) + title + four + warn + cards + '<div class="i3two">' + profit + where + "</div>" + disc,
    p6: devStrip(m, C) + title2 + (S.svcKnown ? "" : warn) + assume + table + '<div class="i3two">' + sens + ssv + "</div>" + disc };
}
export const page5 = (C, m, S) => parts(C, m, S).p5;
export const page6 = (C, m, S) => parts(C, m, S).p6;

// ------------------------------------------------------------------------------------------------ css
export const I3_CSS = `
  .i3title { display:flex; flex-direction:column; gap:3px; }
  .i3c { border:1px solid ${HAIR}; border-radius:8px; background:#fff; padding:7px 11px 8px; display:flex; flex-direction:column; gap:5px; min-width:0; }
  .i3q { background:#FBFAF7; } .i3q .i3cap { color:#6b7a76; }
  .i3h { display:flex; gap:6px; align-items:center; font-size:13px; color:${NAVY}; line-height:1.2; }
  .i3cap { font-size:9.2px; color:${MUTED}; line-height:1.38; } .i3cap b { color:${INK}; font-weight:600; }
  .i3grid6 { display:grid; grid-template-columns:repeat(6,1fr); gap:8px; }
  .i3grid4 { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; } .i3grid3 { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; } .i3grid2 { display:grid; grid-template-columns:1fr 1fr; gap:7px; }
  .i3two { display:grid; grid-template-columns:1fr 1fr; gap:8px; align-items:stretch; }
  .i3box { border:1px solid ${HAIR}; border-top:3px solid ${GOLDI}; border-radius:6px; background:#fff; padding:6px 10px 7px; display:flex; flex-direction:column; gap:3px; min-width:0; }
  .i3big { font-family:Newsreader, Georgia, serif; font-size:21px; color:${NAVY}; line-height:1.1; white-space:nowrap; } .i3big small { font-family:${FONT}; font-size:9px; color:${MUTED}; }
  .i3sts { display:flex; gap:6px; } .i3st { flex:1; background:#F8F5EE; border-radius:5px; padding:4px 6px; display:flex; flex-direction:column; } .i3st b { font-family:Newsreader, Georgia, serif; font-size:16px; font-weight:400; color:${NAVY}; white-space:nowrap; } .i3st span { font-size:8.6px; color:#3d4249; } .i3st em { font-style:normal; font-size:8px; color:${MUTED}; }
  .i3u { gap:3px; } .i3ub { font-size:9.6px; color:#3d4249; } .i3ub b { font-family:Newsreader, Georgia, serif; font-size:17px; font-weight:400; color:${NAVY}; }
  .i3rows > div { display:flex; justify-content:space-between; gap:8px; font-size:10px; padding:2px 0; border-top:1px solid ${HAIR}; color:#3d4249; } .i3rows b { color:${INK}; font-weight:600; white-space:nowrap; } .i3rows .i3tot b { color:${TEAL}; }
  .i3blanks { font-size:10px; color:#3d4249; display:flex; gap:4px; flex-wrap:wrap; align-items:baseline; } .i3bl i { display:inline-block; border-bottom:1px solid #8A9A96; height:11px; vertical-align:baseline; margin-left:3px; }
  .i3rps { display:flex; gap:8px; } .i3rp { flex:1; background:#F8F5EE; border-radius:6px; padding:5px 8px; display:flex; flex-direction:column; } .i3rp span { font-size:8.8px; color:#3d4249; } .i3rp b { font-family:Newsreader, Georgia, serif; font-size:21px; font-weight:400; color:${NAVY}; line-height:1.15; } .i3rp em { font-style:normal; font-size:8.8px; color:${MUTED}; }
  .i3disc { font-size:8.8px; line-height:1.42; color:#3d4249; background:#FBFAF7; border:1px solid ${HAIR}; border-radius:6px; padding:6px 10px; } .i3disc b { color:${NAVY}; }
  .i3bd { border:1px solid ${HAIR}; border-left:3px solid ${GOLDI}; border-radius:5px; padding:3px 8px 3px; display:flex; flex-direction:column; gap:0; min-width:0; background:#fff; } .i3bdn { font-size:10px; font-weight:600; color:${NAVY}; } .i3bdl { font-size:8.3px; color:#3d4249; line-height:1.3; } .i3bdl b { color:${INK}; }
  .i3tag { font-style:normal; font-size:7.8px; color:#8A6D2C; background:#F6EEDC; border-radius:3px; padding:0 4px; margin-left:4px; font-weight:500; } .i3ta { color:#7A3B1E; background:#F8E4D8; }
  .i3br { display:grid; grid-template-columns:128px 1fr auto; gap:6px; align-items:center; font-size:8.8px; } .i3bln { color:#3d4249; } .i3bv { color:${MUTED}; white-space:nowrap; } .i3bv b { color:${INK}; font-weight:600; }
  .i3bt { height:8px; background:#F0ECE2; border-radius:4px; overflow:hidden; display:block; } .i3bt i { display:block; height:100%; border-radius:4px; }
  .i3leg { display:flex; gap:12px; font-size:8.6px; color:#3d4249; } .i3leg i { display:inline-block; width:10px; height:8px; margin-right:4px; vertical-align:middle; }
  .i3ag { display:grid; grid-template-columns:1fr 1fr; gap:0 16px; } .i3ar { display:grid; grid-template-columns:1fr auto; gap:1px 6px; padding:3px 0; border-top:1px solid ${HAIR}; font-size:9.6px; color:#3d4249; } .i3ar b { color:${INK}; font-weight:600; text-align:right; } .i3ar em { grid-column:1 / span 2; justify-self:start; margin:0; }
  .i3sc { gap:4px; } .i3scb { display:flex; flex-direction:column; } .i3scb b { font-family:Newsreader, Georgia, serif; font-size:26px; font-weight:400; color:${NAVY}; line-height:1.1; } .i3scb span { font-size:8.6px; color:${MUTED}; }
  .i3tb { width:100%; border-collapse:collapse; font-size:9px; } .i3tb th { text-align:right; color:${MUTED}; font-weight:500; padding:2px 4px; border-bottom:1px solid ${HAIR}; } .i3tb td { text-align:right; padding:2px 4px; border-bottom:1px solid #F0ECE2; color:#3d4249; } .i3tb td:first-child, .i3tb th:first-child { text-align:left; } .i3tt td { color:${INK}; font-weight:600; background:#F8F5EE; }
  .i3stack { display:flex; flex-direction:column; gap:5px; } .i3rep { display:flex; gap:7px; align-items:center; font-size:9px; color:#6b7a76; border:1px dashed ${HAIR}; border-radius:6px; padding:5px 9px; background:#FBFAF7; } .i3rep b { color:#4a5753; font-weight:600; }
  .i3sens { display:flex; flex-direction:column; gap:3px; } .i3sens > div { display:flex; gap:10px; align-items:baseline; font-size:9.6px; color:#3d4249; } .i3sens span { width:110px; color:${MUTED}; } .i3sens b { font-weight:600; color:${INK}; background:#F8F5EE; border-radius:4px; padding:2px 7px; }
  .i3dev { display:flex; gap:7px; align-items:center; font-size:10px; color:${NAVY}; background:#EEF4F2; border:1px solid #D3E3DF; border-radius:5px; padding:3px 10px; } .i3dev b { font-weight:600; }
  .i3ans { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; } .i3an { border:1px solid ${HAIR}; border-top:3px solid ${TEAL}; border-radius:6px; background:#fff; padding:6px 9px 7px; display:flex; flex-direction:column; gap:2px; min-width:0; }
  .i3anq { font-size:8.6px; color:${MUTED}; text-transform:uppercase; letter-spacing:.03em; } .i3an b { font-family:Newsreader, Georgia, serif; font-size:14.5px; font-weight:400; color:${NAVY}; line-height:1.18; } .i3an em { font-style:normal; font-size:8.2px; color:${MUTED}; line-height:1.3; }
  .i3warn { display:flex; gap:7px; align-items:center; font-size:9.6px; color:#6E3A18; background:#FBEEE2; border:1px solid #EBCDB4; border-radius:5px; padding:4px 10px; }
  .i3hc { border-color:${GOLDI}; border-top:3px solid ${GOLDI}; } .i3small { font-size:8.4px; }
  .i3wfs { display:flex; align-items:center; gap:5px; } .i3wfs i { font-style:normal; color:${MUTED}; font-size:12px; } .i3wf { flex:1; background:#F8F5EE; border-radius:5px; padding:3px 6px; display:flex; flex-direction:column; } .i3wf span { font-size:8px; color:#3d4249; line-height:1.25; } .i3wf b { font-family:Newsreader, Georgia, serif; font-weight:400; font-size:15px; color:${NAVY}; } .i3wfe { background:#E3EFEC; }
  .i3as .i3ar { grid-template-columns:1fr auto; } .i3as3 { align-items:stretch; } .i3asr { border-top:3px solid ${TEAL}; } .i3asm { border-top:3px solid ${GOLDI}; } .i3asn { border-top:3px solid #C9B6A4; background:#FBF6F1; }
  .i3na td { color:#7A3B1E; font-weight:600; text-align:left !important; background:#FBF6F1; }
  .i3svs > div { display:grid; grid-template-columns:1.3fr 1fr 1fr 1fr; gap:6px; font-size:9.2px; padding:2px 0; border-top:1px solid ${HAIR}; color:#3d4249; } .i3svs span:nth-child(n+2) { text-align:right; } .i3svh { color:${MUTED}; border-top:0 !important; font-size:8.4px !important; } .i3svr { background:#E3EFEC; font-weight:600; }
`;
