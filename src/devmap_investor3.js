// v351 - pages 3, 4 and 5 of the investor PDF (page 1 and 2 are in devmap_investor.js and are unchanged).
//   PAGE 3  The investor decision: five boxes "where the register shows", the unit types, the price spread, the net yield card (with blank lines for what no register holds),
//           the past five-year price changes and the historical back-test (what a buyer at the median would have had in past windows). Past figures only.
//   PAGE 4  The evidence: the buildings, the homes coming (supply and absorption), the rent history, liquidity (off-plan against existing-property registrations), off-plan context.
//   PAGE 5  Scenarios: what the register's past windows would imply under STATED assumptions (every assumed number is labelled "assumption").
// All of it is read from the precomputed record KV img_investor3 (scripts/investor3_build.py in the data repo). Nothing is invented here: vacancy, fees and loans are not in any register.
import { BRIEF_KIT, esc } from "./brief_docs.js";
import { icon, dateLong, shortName } from "./devmap_pdf.js";
import { backtest, replay, scenario, annual, TRANSFER_FEE, MIN_N } from "./devmap_irr.js";

const { NAVY, MUTED } = BRIEF_KIT;
const TEAL = "#0A4F4A", GOLDI = "#C5A56A", INK = "#22262B", HAIR = "#E6E1D8";
const FONT = "IBM Plex Sans, Segoe UI, Arial, sans-serif";
const BEDS = ["Studio", "1 bed", "2 bed", "3+ bed"];
const fmt = (n) => (n == null || !isFinite(n) ? "" : Math.round(n).toLocaleString("en-US"));
const aed = (n) => "AED " + fmt(n);
const p1 = (x) => (Math.round(Math.abs(x) * 1000) / 10).toFixed(1) + "%";
const p0 = (x) => Math.round(Math.abs(x) * 100) + "%";
const sg = (x) => (x < 0 ? "&minus;" : "+") + p1(x);
const sg0 = (x) => (x < 0 ? "&minus;" : "+") + p0(x);

export const ASSUMPTIONS = { feeOther: 0.02, vacancy: 0.05, mgmt: 0.05, sellCost: 0.02 };   // printed as assumptions on page 5; none of them is a register figure
export const SCENARIO_DISCLAIMER = "Scenarios built from past register figures and stated assumptions; not a forecast, not a promised return, not financial advice; vacancy, fees and selling costs are assumptions, not register data; the person using this document should replace them with their own. The figures are for discussion.";
export const BACKTEST_NOTE = "Past windows only. Not a forecast, not a promised return, before vacancy, fees and selling costs, which are in no register.";

const card = (ic, title, body, cls, style) => '<div class="i3c' + (cls ? " " + cls : "") + '"' + (style ? ' style="' + style + '"' : "") + '><div class="i3h">' + (ic ? icon(ic, 16, TEAL) : "") + '<span class="serif">' + title + "</span></div>" + body + "</div>";
const quiet = (title, text) => '<div class="i3c i3q"><div class="i3h">' + icon("info", 16, "#8A9A96") + '<span class="serif">' + title + '</span></div><div class="i3cap">' + text + "</div></div>";
const stat = (big, lab, sub) => '<div class="i3st"><b>' + big + "</b><span>" + lab + "</span>" + (sub ? '<em>' + sub + "</em>" : "") + "</div>";
const blank = (label, w) => '<span class="i3bl">' + label + ' <i style="width:' + (w || 46) + 'px"></i></span>';

// ------------------------------------------------------------------------------------------------ the figures taken from the record
export function figures(rec, area, dubai, meta) {
  const lastFull = meta.last_full_year, py = rec.price_y || {};
  const chg = (a, b) => (py[a] && py[b] && py[a][0] >= MIN_N && py[b][0] >= MIN_N ? { from: a, to: b, change: py[b][1] / py[a][1] - 1 } : null);
  const f = { lastFull, growth: [1, 3, 6].map((k) => ({ k, v: chg(lastFull - k, lastFull) })) };
  f.psf = rec.pct && rec.pct.p50 ? rec.pct.p50 : null;
  f.size = rec.size_sqft || area.size_sqft || null;
  f.gross = rec.yield ? rec.yield.rate : null;
  f.svcPsf = rec.svc && rec.svc.n > 0 ? rec.svc.median : null;
  f.net = f.gross != null && f.svcPsf != null && f.psf ? f.gross - f.svcPsf / f.psf : null;
  f.bt = backtest(rec, area, lastFull);
  f.rp = replay(rec, area, dubai);
  f.rentG = rec.rent_cagr ? { rate: rec.rent_cagr.rate, from: rec.rent_cagr.from, to: rec.rent_cagr.to, scope: "developer" } : area.rent_cagr ? { rate: area.rent_cagr.rate, from: area.rent_cagr.from, to: area.rent_cagr.to, scope: "area" } : null;
  return f;
}
// the scenario inputs for page 5, or null when the record cannot support them
export function scenarioSet(rec, area, dubai, meta) {
  const f = figures(rec, area, dubai, meta), y = rec.yield || area.yield;
  if (!f.psf || !f.size || !y || !f.rp) return null;
  const price = f.psf * f.size, rent0 = y.rate * price, svc = f.svcPsf != null ? f.svcPsf * f.size : 0;
  const rentGrowth = f.rentG ? f.rentG.rate : 0;
  const base = { price, feeTransfer: TRANSFER_FEE, feeOther: ASSUMPTIONS.feeOther, rent0, rentGrowth, svc, vacancy: ASSUMPTIONS.vacancy, mgmt: ASSUMPTIONS.mgmt, sellCost: ASSUMPTIONS.sellCost, years: 5 };
  const mk = (w) => { const g = annual(w.change, 5); return { w, g, r: scenario(Object.assign({}, base, { growth: g })) }; };
  const S = { f, base, size: f.size, psf: f.psf, price, rent0, svc, svcKnown: f.svcPsf != null, rentGrowth, rentScope: f.rentG ? f.rentG.scope : null, rentFrom: f.rentG ? f.rentG.from : null, rentTo: f.rentG ? f.rentG.to : null, yieldScope: rec.yield ? "developer" : "area", scope: f.rp.scope,
    cons: mk(f.rp.slow), mid: mk(f.rp.mid), up: mk(f.rp.fast) };
  S.sens = { vac: [0, 0.05, 0.10].map((v) => ({ v, irr: scenario(Object.assign({}, base, { growth: S.mid.g, vacancy: v })).irr })), gro: [-0.02, 0, 0.02].map((d) => ({ d, g: S.mid.g + d, irr: scenario(Object.assign({}, base, { growth: S.mid.g + d })).irr })) };
  return S;
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
  const lastN = rec.price_y && rec.price_y[f.lastFull] ? rec.price_y[f.lastFull][0] : null;
  const liqBox = box("chart-donut", "Liquidity", fmt(rec.sales_l12) + " <small>sales, last 12 months</small>", '<div class="i3cap">' + (lastN ? fmt(lastN) + " sales in " + f.lastFull + ". " : "") + "The register does not say who sold to whom, so resale against first sale is not shown. Page 4 splits off-plan from existing-property registrations.</div>", 2);
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
function netCard(rec, f) {
  const blanks = '<div class="i3blanks">' + blank("Vacancy", 40) + " % " + blank("Management fee", 40) + " % " + blank("Other costs", 60) + " AED</div>";
  let body;
  if (f.gross != null) {
    body = '<div class="i3rows"><div><span>Gross yield</span><b>' + p1(f.gross) + "</b></div>" +
      (f.svcPsf != null ? "<div><span>Register service charge</span><b>AED " + f.svcPsf.toFixed(1) + " /sq ft</b></div><div class=\"i3tot\"><span>Gross less service charge</span><b>" + p1(f.net) + "</b></div>" : "<div><span>Register service charge</span><b>not on the register</b></div>") + "</div>" +
      '<div class="i3cap">' + (f.svcPsf != null ? "Median of " + rec.svc.n + " of " + rec.svc.of + " buildings that carry the developer's name (range AED " + rec.svc.min.toFixed(1) + " to " + rec.svc.max.toFixed(1) + ", budget year " + rec.svc.year + "); service charge known for " + rec.svc.n + " of " + rec.svc.of + " buildings. " : "") + "Before vacancy, management fees and other costs, which are in no register: you add them.</div>" + blanks;
  } else body = '<div class="i3cap">Not enough rent contracts for a gross yield.</div>' + blanks;
  return card("calculator", "Income after the service charge", body);
}
function spreadCard(rec) {
  if (!rec.pct) return quiet("Price spread", "Not enough registered sales for a spread.");
  const q = rec.pct;
  return card("ruler", "Price spread, per sq ft", rangeBar(q) + '<div class="i3cap">Lower quarter, middle and upper quarter of the ' + fmt(q.n) + " sales in the last 12 months (AED per sq ft). The middle half of sales sit within " + p0((q.p75 - q.p25) / q.p50) + " of the middle price.</div>");
}
function replayCards(f) {
  const r = f.rp; if (!r) return quiet("Past five-year price changes", "Not enough years on the register for three five-year windows.");
  const scope = r.scope === "developer" ? "this developer in this area" : r.scope === "area" ? "all homes in this area" : "all of Dubai";
  const one = (lab, w) => '<div class="i3rp"><span>' + lab + "</span><b>" + sg0(w.change) + "</b><em>" + w.from + " to " + w.to + "</em></div>";
  return card("chart-bar", "Past five-year price changes: slowest, middle and fastest", '<div class="i3rps">' + one("Slowest", r.slow) + one("Middle", r.mid) + one("Fastest", r.fast) + '</div><div class="i3cap">What the register shows for past windows, not a forecast. Median price per sq ft, ' + scope + ", " + r.windows.length + " windows of five years.</div>");
}
function irrCards(f) {
  const b = f.bt;
  if (!b.count) return quiet("Past five-year windows: the annualised return", "Not enough years with 30 or more rent contracts and sales to run a five-year back-test" + (b.skipped.length ? " (" + b.skipped.length + " windows had an incomplete rent series)" : "") + ".");
  const lab = b.pick.length === 3 ? ["Slowest window", "Middle window", "Fastest window"] : b.pick.length === 1 ? ["The one window"] : b.pick.map((_, i) => (i === 0 ? "Slower window" : "Faster window"));
  const one = (l, w) => '<div class="i3rp"><span>' + l + "</span><b>" + p1(w.irr) + "</b><em>" + w.from + " to " + w.to + "</em></div>";
  const scope = b.level === "developer" ? "this developer in this area" : "all homes in this area";
  return card("calculator", "Past five-year windows: the annualised return (IRR) a buyer at the median would have had", '<div class="i3rps">' + b.pick.map((w, i) => one(lab[i], w)).join("") + '</div><div class="i3cap">' + b.count + (b.count === 1 ? " window" : " windows") + " of five years for " + scope + (b.skipped.length ? "; " + b.skipped.length + " skipped for an incomplete rent series" : "") + ". Bought at the median price per sq ft of the first year plus the 4% Dubai Land Department transfer fee, the median rent each year" + (b.svcKnown ? " less the register service charge held at today's figure" : ", before service charges (none on the register for these buildings)") + ", sold at the median of the fifth year. " + BACKTEST_NOTE + "</div>");
}
export function page3(C, m, rec, area, dubai, meta) {
  const f = figures(rec, area, dubai, meta), areaName = esc(C.names.plain);
  const title = '<div class="i3title"><div class="lbl" style="text-transform:uppercase">The investor decision</div><h1 class="serif" style="font-size:24px">Where the register shows: ' + esc(shortName(m.name, 30)) + " in " + areaName + '</h1><div class="i3cap">Past registered figures to ' + esc(dateLong(m.asOf)) + ". Sales counted as on pages 1 and 2, including registered delayed sales.</div></div>";
  const disc = '<div class="i3disc"><b>Please read.</b> Past figures only: no forecast, no promised return, not financial advice and not an offer. Vacancy, management fees, other running costs and any loan are not in any register; add your own. A developer\'s figures cover the buildings the register attributes to it in this area. Check each property and your own circumstances with a licensed adviser before buying.</div>';
  return title + fiveBoxes(rec, area, f, m) + unitCards(rec) + '<div class="i3two">' + spreadCard(rec) + netCard(rec, f) + '</div><div class="i3two">' + replayCards(f) + irrCards(f) + "</div>" + disc;
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
  if (c) t += "Compound yearly change " + c.from + " to " + c.to + ": <b>" + sg(c.rate) + "</b>. ";
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
  const f = figures(rec, area, dubai, meta);
  const title = '<div class="i3title"><h1 class="serif" style="font-size:20px;margin:0">The evidence: the figures behind the decision</h1></div>';
  const repeat = '<div class="i3rep">' + icon("info", 14, "#8A9A96") + "<span><b>Repeat sales of the same unit</b> are not in the register: a sale carries no unit number, so resale and flip rates cannot be shown.</span></div>";
  return title + buildingCards(rec) + '<div class="i3two">' + rentCard(rec, area, f, meta) + liqCard(rec, meta) + '</div><div class="i3two">' + supplyCard(rec, area) + offplanCards(rec) + "</div>" + repeat;
}

// ------------------------------------------------------------------------------------------------ page 5
const tag = (t) => '<em class="i3tag ' + (t === "assumption" ? "i3ta" : "") + '">' + t + "</em>";
export function page5(C, m, S) {
  const A = ASSUMPTIONS, f = S.f;
  const row = (l, v, t) => '<div class="i3ar"><span>' + l + "</span><b>" + v + "</b>" + tag(t) + "</div>";
  const assume = '<div class="i3c"><div class="i3h">' + icon("calculator", 16, TEAL) + '<span class="serif">Assumptions</span></div><div class="i3ag">' +
    row("Home size", fmt(S.size) + " sq ft", "register: typical home") + row("Purchase price", aed(S.price), "register: median price per sq ft x size") +
    row("Dubai Land Department transfer fee", p0(TRANSFER_FEE), "published fee") + row("Agent and other buying costs", p0(A.feeOther), "assumption") +
    row("Starting rent a year", aed(S.rent0), "register: " + (S.yieldScope === "developer" ? "gross yield" : "area gross yield") + " x price") +
    row("Service charge a year", S.svcKnown ? aed(S.svc) : "none on the register, left out", S.svcKnown ? "register: budget per sq ft x size" : "register") +
    row("Rent growth a year", S.rentScope ? sg(S.rentGrowth) : "held flat", S.rentScope ? "register: past compound change " + S.rentFrom + " to " + S.rentTo + ", " + (S.rentScope === "area" ? "area" : "this developer") : "assumption") +
    row("Empty months (vacancy)", p0(A.vacancy) + " of rent", "assumption") + row("Management fee", p0(A.mgmt) + " of rent", "assumption") + row("Selling cost at the end", p0(A.sellCost) + " of the price", "assumption") +
    row("Price growth a year", "from the past windows below", "register: slowest, middle, fastest five years") + "</div></div>";
  const sc = (lab, o) => '<div class="i3c i3sc"><div class="i3h"><span class="serif">' + lab + '</span></div><div class="i3scb"><b>' + p1(o.r.irr) + '</b><span>IRR (yearly return rate) on these cash flows</span></div><div class="i3rows">' +
    "<div><span>Price growth a year</span><b>" + sg(o.g) + "</b></div><div><span>Window used</span><b>" + o.w.from + " to " + o.w.to + "</b></div><div><span>Value after 5 years</span><b>" + aed(o.r.exitGross) + "</b></div><div><span>Net income, 5 years</span><b>" + aed(o.r.cum) + "</b></div><div><span>Cash return, year 1</span><b>" + p1(o.r.cashOnCash1) + "</b></div></div></div>";
  const R = S.mid.r;
  const trow = (l, arr, strong) => "<tr" + (strong ? ' class="i3tt"' : "") + "><td>" + l + "</td>" + arr.map((x) => "<td>" + (x == null ? "" : Math.round(x) === 0 ? "0" : fmt(x)) + "</td>").join("") + "</tr>";
  const yrs = R.rows;
  const table = '<div class="i3c"><div class="i3h">' + icon("chart-bar", 16, TEAL) + '<span class="serif">The middle scenario, year by year (AED)</span></div><table class="i3tb"><tr><th></th><th>Start</th>' + yrs.map((r) => "<th>Year " + r.year + "</th>").join("") + "</tr>" +
    trow("Rent", [null].concat(yrs.map((r) => r.rent))) + trow("Less vacancy", [null].concat(yrs.map((r) => -r.vac))) + trow("Less management fee", [null].concat(yrs.map((r) => -r.mg))) + trow("Less service charge", [null].concat(yrs.map((r) => -r.sv))) +
    trow("Net income", [null].concat(yrs.map((r) => r.net)), true) + trow("Price, fees and sale", [-R.cash0, null, null, null, null, R.exitNet]) + trow("Cash flow", R.cfs, true) + "</table>" +
    '<div class="i3cap">IRR is the yearly rate at which these cash flows add up to zero: ' + p1(R.irr) + ". The start is the price plus " + p0(TRANSFER_FEE + A.feeOther) + " buying costs; the last year includes the sale at " + aed(R.exitGross) + " less " + p0(A.sellCost) + " selling cost.</div></div>";
  const sens = '<div class="i3c"><div class="i3h">' + icon("stack", 16, TEAL) + '<span class="serif">How the middle scenario moves</span></div><div class="i3sens"><div><span>Vacancy</span>' + S.sens.vac.map((x) => "<b>" + p0(x.v) + ": " + p1(x.irr) + "</b>").join("") + "</div><div><span>Price growth a year</span>" + S.sens.gro.map((x) => "<b>" + (x.d === 0 ? "base" : (x.d < 0 ? "&minus;" : "+") + "2 points") + " (" + sg(x.g) + "): " + p1(x.irr) + "</b>").join("") + '</div></div><div class="i3cap">IRR on the middle scenario when one assumption changes.</div></div>';
  const title = '<div class="i3title"><div class="lbl" style="text-transform:uppercase">Scenarios</div><h1 class="serif" style="font-size:24px">What the register\'s past windows would imply under stated assumptions</h1><div class="i3cap">For discussion. Each scenario applies one of the register\'s past five-year price changes to ' + fmt(S.size) + " sq ft at " + aed(S.psf) + " per sq ft, " + (S.scope === "developer" ? "for this developer in this area" : S.scope === "area" ? "for all homes in this area" : "for Dubai as a whole") + ".</div></div>";
  return title + assume + '<div class="i3grid3">' + sc("Conservative", S.cons) + sc("Base", S.mid) + sc("Upside", S.up) + "</div>" + table + sens + '<div class="i3disc">' + SCENARIO_DISCLAIMER + "</div>";
}

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
`;
