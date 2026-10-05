// v353 - the EXECUTIVE SUMMARY page of the investor PDF: "Should you invest here? What the register says". Answer first (pyramid principle): an action title that states the
// reading, a reading chip, three reasons and three cautions (one key number each), five key numbers, what would change the view, questions to ask, where the evidence is.
//
// THE READING IS RULE-BASED AND PRINTED ON THE PAGE. No model, no hidden score, no weights. Five dimensions are each rated Supportive, Mixed or Cautionary from numbers that
// are already on pages 2 to 7; a dimension whose number is missing is "Not rated" and is not counted. The thresholds below are editorial choices, not market facts.
//   INCOME     gross yield g, the area's gross yield a, 5%.   Supportive: g >= 5% and g >= a - 0.25 points.  Cautionary: g < 4%.  Mixed: otherwise.
//              If the register holds a service charge, the yield after it (net) is also tested: net < 4% moves the rating one step down (Supportive -> Mixed, Mixed -> Cautionary).
//   GROWTH     three-year change c3 of the median price per sq ft (full years), the compound yearly rate r over the longest run, against the area's.
//              Supportive: c3 > 0 and (r >= the area's r or c3 >= the area's c3).  Cautionary: c3 < 0.  Mixed: otherwise.
//   LIQUIDITY  last-12-month sales n, and n against the busiest full year's sales.  Supportive: n >= 200 and n >= 50% of the peak year.  Cautionary: n < 60 or n < 20% of the peak.
//              Mixed: otherwise. If 70% or more of the last 12 months' registrations are off-plan, one step down.
//   SUPPLY     homes registered under construction in the area / the area's last-12-month sales = years of current sales.  Below 1.5 Supportive, 1.5 to 3 Mixed, above 3 Cautionary.
//   DOWNSIDE   the five-year return (IRR) in the stress case, with no price growth.  Above 4% Supportive, 0 to 4% Mixed, below 0 Cautionary.
//   OVERALL    2 or more Cautionary -> "Weak case on the register".  Else 3 or more Supportive and no Cautionary -> "A case worth a closer look".  Else "Mixed: depends on what you value".
// It is a reading of PAST register figures. It never says what to do.
import { scenario } from "./devmap_irr.js";

export const T = { yieldHi: 0.05, yieldLo: 0.04, yieldTol: 0.0025, netLo: 0.04, salesHi: 200, peakHi: 0.5, salesLo: 60, peakLo: 0.2, offStep: 0.7, supplyLo: 1.5, supplyHi: 3, downHi: 0.04, downLo: 0 };
export const LABEL = { sup: "Supportive", mix: "Mixed", cau: "Cautionary", na: "Not rated" };
export const OVERALL = { worth: "A case worth a closer look", mixed: "Mixed: depends on what you value", weak: "Weak case on the register" };
export const HOW = "How this reading is made: five checks on past register figures, each Supportive, Mixed or Cautionary. Income: gross yield against 5% and the area. Growth: three-year price change against the area. Liquidity: sales in the last 12 months against the busiest year. Supply: homes under construction over a year of area sales (under 1.5 supportive, 1.5 to 3 mixed, over 3 cautionary; editorial thresholds). Downside: five-year return with no price growth (over 4% supportive, 0 to 4% mixed, under 0 cautionary). Two or more cautionary is a weak case; three or more supportive and none cautionary is a case worth a closer look; anything else is mixed. No score, no model.";

const fmt = (n) => (n == null || !isFinite(n) ? "" : Math.round(n).toLocaleString("en-US"));
const aed = (n) => "AED " + fmt(n);
const p1 = (x) => (Math.round(Math.abs(x) * 1000) / 10).toFixed(1) + "%";
const sg = (x) => (Math.abs(x) < 0.0005 ? "" : x < 0 ? "−" : "+") + p1(x);
const ok = (x) => typeof x === "number" && isFinite(x);
const down = (v) => (v === "sup" ? "mix" : v === "mix" ? "cau" : v);

// ---- the five ratings. n = the numbers object (see numbersFrom). Each returns { key, label, verdict, number, text } or a "na" row.
export function rate(n) {
  const dims = [];
  // INCOME
  if (ok(n.gross)) {
    let v = n.gross >= T.yieldHi && (!ok(n.areaYield) || n.gross >= n.areaYield - T.yieldTol) ? "sup" : n.gross < T.yieldLo ? "cau" : "mix";
    const net = ok(n.net) ? n.net : null;
    let tail = "";
    if (net != null && net < T.netLo) { v = down(v); tail = "; after the register service charge " + p1(net); }
    else if (net != null) tail = "; after the register service charge " + p1(net);
    dims.push({ key: "income", label: "Income", verdict: v, number: p1(n.gross), text: "Gross yield " + p1(n.gross) + (ok(n.areaYield) ? " against " + p1(n.areaYield) + " for the area" : "") + tail });
  } else dims.push({ key: "income", label: "Income", verdict: "na", number: "n/a", text: "Not enough rent contracts for a yield" });
  // GROWTH
  if (n.g3 && ok(n.g3.change)) {
    const c3 = n.g3.change;
    const better = (ok(n.cagr) && ok(n.areaCagr) && n.cagr >= n.areaCagr) || (n.areaG3 && ok(n.areaG3.change) && c3 >= n.areaG3.change);
    const v = c3 < 0 ? "cau" : c3 > 0 && better ? "sup" : "mix";
    dims.push({ key: "growth", label: "Growth", verdict: v, number: sg(c3), text: "Median price per sq ft " + sg(c3) + " over three years (" + n.g3.from + " to " + n.g3.to + ")" + (n.areaG3 && ok(n.areaG3.change) ? ", the area " + sg(n.areaG3.change) : "") });
  } else dims.push({ key: "growth", label: "Growth", verdict: "na", number: "n/a", text: "Not enough full years for a three-year change" });
  // LIQUIDITY
  if (ok(n.sales)) {
    const ratio = ok(n.peakSales) && n.peakSales > 0 ? n.sales / n.peakSales : null;
    let v = n.sales >= T.salesHi && (ratio == null || ratio >= T.peakHi) ? "sup" : n.sales < T.salesLo || (ratio != null && ratio < T.peakLo) ? "cau" : "mix";
    let tail = "";
    if (ok(n.offShare) && n.offShare >= T.offStep) { v = down(v); tail = "; " + Math.round(n.offShare * 100) + "% of them off-plan"; }
    dims.push({ key: "liquidity", label: "Liquidity", verdict: v, number: fmt(n.sales), text: fmt(n.sales) + " sales in the last 12 months" + (ratio != null ? (ratio >= 1 ? ", at or above the busiest full year (" + n.peakYear + ": " + fmt(n.peakSales) + ")" : ", " + Math.round(ratio * 100) + "% of the busiest full year (" + n.peakYear + ")") : "") + tail });
  } else dims.push({ key: "liquidity", label: "Liquidity", verdict: "na", number: "n/a", text: "No sales count" });
  // SUPPLY
  if (ok(n.supplyYears)) {
    const y = n.supplyYears, v = y < T.supplyLo ? "sup" : y <= T.supplyHi ? "mix" : "cau";
    dims.push({ key: "supply", label: "Supply", verdict: v, number: y.toFixed(1) + " yrs", text: fmt(n.supplyHomes) + " homes under construction in the area are " + y.toFixed(1) + " years of current sales" });
  } else dims.push({ key: "supply", label: "Supply", verdict: "na", number: "n/a", text: "No project register figures for this area" });
  // DOWNSIDE
  if (ok(n.stressIrr)) {
    const r = n.stressIrr, v = r > T.downHi ? "sup" : r >= T.downLo ? "mix" : "cau";
    dims.push({ key: "downside", label: "Downside", verdict: v, number: p1(r), text: "With no price growth the modeled five-year return is " + (r < 0 ? "−" : "") + p1(r) });
  } else dims.push({ key: "downside", label: "Downside", verdict: "na", number: "n/a", text: "Scenario inputs are not on the register" });
  return dims;
}
export function overall(dims) {
  const c = { sup: 0, mix: 0, cau: 0, na: 0 }; for (const d of dims) c[d.verdict]++;
  const key = c.cau >= 2 ? "weak" : c.sup >= 3 && c.cau === 0 ? "worth" : "mixed";
  return { key, label: OVERALL[key], counts: c };
}

// ---- the sentences. All templates: nothing is invented, every number comes from n.
const byKey = (dims) => Object.fromEntries(dims.map((d) => [d.key, d]));
export function growthSolve(base, target) {   // the yearly price growth at which the five-year return equals the target, by bisection
  const f = (g) => { const r = scenario(Object.assign({}, base, { growth: g })).irr; return r == null ? NaN : r - target; };
  let lo = -0.25, hi = 0.40, flo = f(lo), fhi = f(hi);
  if (!isFinite(flo) || !isFinite(fhi) || flo * fhi > 0) return null;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2, fm = f(mid); if ((fm < 0) === (flo < 0)) { lo = mid; flo = fm; } else { hi = mid; } }
  return (lo + hi) / 2;
}
const ORDER_SUP = ["income", "growth", "liquidity", "supply", "downside"], ORDER_CAU = ["downside", "supply", "liquidity", "income", "growth"];

function reasonCard(d, n) {
  switch (d.key) {
    case "income": return { title: "Rent against price", number: p1(n.gross), text: "Registered rent contracts point to a gross yield of " + p1(n.gross) + (ok(n.areaYield) ? ", with " + p1(n.areaYield) + " for the whole area" : "") + "." };
    case "growth": return { title: "Price history", number: sg(n.g3.change), text: "The median price per sq ft moved " + sg(n.g3.change) + " over the last three full years" + (n.areaG3 && ok(n.areaG3.change) ? ", against " + sg(n.areaG3.change) + " for the area" : "") + "." };
    case "liquidity": return { title: "Depth of sales", number: fmt(n.sales), text: fmt(n.sales) + " sales were registered in the last 12 months, enough for a median to mean something." };
    case "supply": return { title: "Supply coming", number: n.supplyYears.toFixed(1) + " yrs", text: fmt(n.supplyHomes) + " homes under construction in the area are " + n.supplyYears.toFixed(1) + " years of current sales." };
    case "downside": return { title: "Return with no price growth", number: p1(n.stressIrr), text: "Even if the price did not move for five years, the modeled return from rent and the sale is " + p1(n.stressIrr) + " a year." };
  }
}
function cautionCard(d, n) {
  switch (d.key) {
    case "income": return { title: "Rent against price", number: p1(n.gross), text: "A gross yield of " + p1(n.gross) + (ok(n.areaYield) ? " against " + p1(n.areaYield) + " for the area" : "") + (d.verdict === "cau" ? " is thin before any cost." : " leaves little room once costs are taken off.") };
    case "growth": return { title: "Price history", number: sg(n.g3.change), text: "The median price per sq ft moved " + sg(n.g3.change) + " over three full years" + (n.areaG3 && ok(n.areaG3.change) ? ", the area " + sg(n.areaG3.change) : "") + "." };
    case "liquidity": return { title: d.verdict === "cau" ? "Sales have cooled" : "Sales against the busiest year", number: fmt(n.sales), text: fmt(n.sales) + " sales in the last 12 months" + (ok(n.peakSales) && n.sales < n.peakSales ? ", against " + fmt(n.peakSales) + " in " + n.peakYear : "") + (ok(n.offShare) && n.offShare >= T.offStep ? "; most registrations are off-plan" : "") + "." };
    case "supply": return { title: "Homes still to arrive", number: n.supplyYears.toFixed(1) + " yrs", text: fmt(n.supplyHomes) + " homes are registered under construction in the area, " + n.supplyYears.toFixed(1) + " years of current sales; planned dates are the register's and some are old." };
    case "downside": return { title: "If the price does not rise", number: (n.stressIrr < 0 ? "−" : "") + p1(n.stressIrr), text: "With no price growth the modeled five-year return is " + (n.stressIrr < 0 ? "−" : "") + p1(n.stressIrr) + " a year." };
  }
}
function standingCautions(n) {   // -> { specific: the ones drawn from this pair's numbers, generic: the ones that always apply }
  const out = [];
  if (!ok(n.svcPsf)) out.push({ title: "Service charge not on the register", number: "n/a", text: "The register holds no service charge for these buildings" + (ok(n.stressIrr) ? ": the " + p1(n.histYearOne != null ? n.histYearOne : n.yearOne) + " year-one cash return is before it" : ": every return shown is before it") + "." });
  if (ok(n.exitShare) && n.exitShare >= 0.5) out.push({ title: "Return rests on price growth", number: Math.round(n.exitShare * 100) + "%", text: "About " + Math.round(n.exitShare * 100) + "% of the modeled gain in the historical case comes from the sale price, the rest from rent." });
  if (ok(n.offShare) && n.offShare >= 0.3) out.push({ title: "Off-plan share", number: Math.round(n.offShare * 100) + "%", text: Math.round(n.offShare * 100) + "% of the last 12 months' registrations are off-plan, priced at contract rather than resale." });
  const specific = out.slice(), generic = [];
  generic.push({ title: "Vacancy, fees and costs are not in any register", number: "n/a", text: "Empty months, management, fees and selling costs are assumptions" + (n.pg && n.pg.scen ? " on page " + n.pg.scen : "") + "; replace them with your own." });
  generic.push({ title: "Attribution by developer", number: "n/a", text: "Sales are matched to a developer through the project; some cannot be matched and are left out." });
  return { specific, generic };
}

// numbers -> everything the page needs. Pure.
export function assess(n) {
  const dims = rate(n), by = byKey(dims), ov = overall(dims);
  // reasons: Supportive dims first, then Mixed dims with a positive number, then plain facts about the evidence
  const rs = [];
  for (const k of ORDER_SUP) if (by[k].verdict === "sup") rs.push(reasonCard(by[k], n));
  for (const k of ORDER_SUP) if (rs.length < 3 && by[k].verdict === "mix" && !(k === "growth" && n.g3 && n.g3.change <= 0)) rs.push(reasonCard(by[k], n));
  if (rs.length < 3 && ok(n.rentCagr) && n.rentCagr > 0) rs.push({ title: "Rent history", number: sg(n.rentCagr), text: "The median rent on registered contracts moved " + sg(n.rentCagr) + " a year over " + n.rentFrom + " to " + n.rentTo + "." });
  if (rs.length < 3 && ok(n.rents)) rs.push({ title: "Evidence behind the figures", number: fmt(n.rents), text: fmt(n.rents) + " rent contracts and " + fmt(n.sales) + " sales in the last 12 months stand behind the yield and the price." });
  while (rs.length < 3) rs.push({ title: "Register coverage", number: fmt(n.sales), text: "The figures come from " + fmt(n.sales) + " registered sales in the last 12 months." });
  // cautions: Cautionary dims first, then the standing cautions that apply, then Mixed dims
  const cs = [];
  for (const k of ORDER_CAU) if (by[k].verdict === "cau") cs.push(cautionCard(by[k], n));
  const st = standingCautions(n);
  for (const c of st.specific) if (cs.length < 3) cs.push(c);
  for (const k of ORDER_CAU) if (cs.length < 3 && by[k].verdict === "mix") cs.push(cautionCard(by[k], n));
  for (const c of st.generic) if (cs.length < 3) cs.push(c);
  // what would change this view
  const ch = [];
  const g = n.gross, psf = n.psf;
  if (ok(g) && ok(psf)) {
    const x = Math.max(0, (g - T.netLo) * psf);
    if (g > T.netLo) ch.push({ title: "A higher service charge", number: "AED " + x.toFixed(1), text: "A service charge above AED " + x.toFixed(1) + " per sq ft a year would take the " + p1(g) + " gross yield below 4%. " + (ok(n.svcPsf) ? "The register shows AED " + n.svcPsf.toFixed(1) + "." : "The register has none for this pair.") });
    else ch.push({ title: "A yield above 4%", number: p1(g), text: "A gross yield above 4% would lift the income reading; it is " + p1(g) + " today." });
  }
  if (n.base) {
    const gs = growthSolve(n.base, T.downHi);
    if (gs != null) ch.push({ title: "Slower price growth", number: sg(gs), text: "If prices rose slower than about " + p1(gs) + " a year, the modeled five-year return would fall below 4%" + (ok(n.histG) ? " (the historical case assumes " + p1(n.histG) + ")" : "") + "." });
  }
  if (ok(n.supplyYears)) ch.push({ title: "Supply arriving faster", number: n.supplyYears.toFixed(1) + " yrs", text: "Above 3 years of current sales the supply reading turns cautionary; it is " + n.supplyYears.toFixed(1) + " today, so a sales slowdown or earlier handovers would move it." });
  else if (ok(n.peakSales) && ok(n.sales)) ch.push({ title: "A further fall in sales", number: Math.round(100 * n.sales / n.peakSales) + "%", text: "Sales below 20% of the busiest year would turn the liquidity reading cautionary; it is " + Math.round(100 * n.sales / n.peakSales) + "% today." });
  // questions
  const q = [];
  q.push({ title: "Service charge for the exact building", text: ok(n.svcPsf) ? "The register median is AED " + n.svcPsf.toFixed(1) + " per sq ft for " + n.svcN + " of " + n.svcOf + " buildings; ask for this building's current budget." : "Not on the register for these buildings; ask the developer or the managing company for the current budget." });
  q.push({ title: "Handover date", text: ok(n.pastHomes) && n.pastHomes > 0 ? fmt(n.pastHomes) + " homes in the area are past their registered planned date; ask for the current handover date in writing." : "Ask for the current handover date in writing; the register's planned dates are the developer's own and some are old." });
  q.push({ title: "Payment plan", text: "Payment plans and rent at delivery are not in any register; ask for the plan and what it costs over time." });
  q.push({ title: "Comparable recent sales", text: ok(n.topBedSales) ? fmt(n.topBedSales) + " sales of " + n.topBedName + " homes were registered in the last 12 months; ask for recent sales in the same building and of the same size." : "Ask for recent registered sales in the same building and of the same size." });
  // the five key numbers
  const key = [
    { label: "Median price per sq ft", value: ok(psf) ? aed(psf) : "n/a", sub: "last 12 months" },
    { label: "Gross yield", value: ok(g) ? p1(g) : "n/a", sub: n.yieldScope === "area" ? "area figure, before costs" : "before costs" },
    { label: "Price change, 3 years", value: n.g3 ? sg(n.g3.change) : "n/a", sub: n.g3 ? n.g3.from + " to " + n.g3.to : "not enough years" },
    { label: "Supply coming", value: ok(n.supplyYears) ? n.supplyYears.toFixed(1) + " yrs" : "n/a", sub: "of current area sales" },
    { label: "Five-year return, no price growth", value: ok(n.stressIrr) ? (n.stressIrr < 0 ? "−" : "") + p1(n.stressIrr) : "n/a", sub: "modeled yearly return" },
  ];
  // the action title
  const art = (s) => (/^(8|11|18)/.test(s) ? "an " : "a ") + s;
  const ratioPct = ok(n.peakSales) && n.peakSales > 0 && ok(n.sales) ? Math.round(100 * n.sales / n.peakSales) : null;
  const clause = (d) => ({
    income: art(p1(n.gross) + " gross yield"),
    growth: n.g3 ? (n.g3.change >= 0 ? "a price rise of " : "a price fall of ") + p1(n.g3.change) + " over three years" : "",
    liquidity: fmt(n.sales) + " sales in the last 12 months",
    supply: n.supplyYears != null ? n.supplyYears.toFixed(1) + " years of supply coming" : "",
    downside: ok(n.stressIrr) ? art(p1(n.stressIrr) + " five-year return with no price growth") : "",
  }[d.key]);
  const pickStrong = ORDER_SUP.map((k) => by[k]).find((d) => d.verdict === "sup") || ORDER_SUP.map((k) => by[k]).find((d) => d.verdict === "mix" && (d.key === "income" || d.key === "growth" && n.g3 && n.g3.change > 0));
  const liqConcern = (ok(n.offShare) && n.offShare >= T.offStep) || (ratioPct != null && ratioPct < 100);
  const pickWeak = ORDER_CAU.map((k) => by[k]).find((d) => d.verdict === "cau") || ORDER_CAU.map((k) => by[k]).find((d) => d.verdict === "mix" && (d.key !== "liquidity" || liqConcern));
  const lead = { worth: "a case worth a closer look", mixed: "a mixed case", weak: "a weak case on the register" }[ov.key];
  let headline = n.name + " in " + n.areaName + ": " + lead + ": ";
  const c1 = pickStrong && pickStrong.verdict !== "na" ? clause(pickStrong) : "";
  const c2 = pickWeak ? ({
    income: "the yield is " + (ok(n.gross) ? p1(n.gross) : "thin") + (ok(n.net) ? " (" + p1(n.net) + " after the service charge)" : ""),
    growth: n.g3 && n.g3.change < 0 ? "prices fell " + p1(n.g3.change) + " over three years" : "the price change over three years is " + (n.g3 ? sg(n.g3.change) : "small"),
    liquidity: ok(n.offShare) && n.offShare >= T.offStep ? Math.round(n.offShare * 100) + "% of the last 12 months' registrations are off-plan" : ratioPct != null && ratioPct < 100 ? "sales are " + ratioPct + "% of the busiest full year" : "sales are thin",
    supply: n.supplyYears != null ? "the supply coming is " + n.supplyYears.toFixed(1) + " years of sales" : "supply is large",
    downside: "with no price growth the five-year return is " + (ok(n.stressIrr) ? (n.stressIrr < 0 ? "\u2212" : "") + p1(n.stressIrr) : "low"),
  }[pickWeak.key]) : "";
  headline += c1 ? c1 + (c2 ? ", but " + c2 : "") : (c2 || "the register gives a limited picture");
  if (!/\.$/.test(headline)) headline += ".";
  return { dims, overall: ov, reasons: rs.slice(0, 3), cautions: cs.slice(0, 3), changers: ch.slice(0, 3), questions: q, key, headline, chip: ov.label };
}

// ---- the numbers object, from the record and the model. ctx = { g3, areaG3, cagr, areaCagr, lastSales, pg }
export function numbersFrom(rec, area, m, S, ctx) {
  const L = rec.liq || {}, peak = L.peak || null, y = m.yield || rec.yield || null;
  const gross = y ? y.rate : null, psf = m.l12 && m.l12.psf ? m.l12.psf : rec.pct ? rec.pct.p50 : null;
  const svcPsf = rec.svc && rec.svc.n > 0 ? rec.svc.median : null, sales = m.l12 && m.l12.sales ? m.l12.sales : rec.sales_l12;
  const off = (L.off_l12 != null && (L.off_l12 + (L.existing_l12 || 0)) > 0) ? L.off_l12 / (L.off_l12 + (L.existing_l12 || 0)) : null;
  const sup = area.supply || {}, bed = rec.most_sales_bed || null, BN = ["studio", "1 bed", "2 bed", "3+ bed"];
  return {
    name: m.name, areaName: area.name, psf, gross, yieldScope: m.yield ? m.yield.scope : (rec.yield ? "developer" : null), areaYield: area.yield ? area.yield.rate : null,
    svcPsf, svcN: rec.svc ? rec.svc.n : 0, svcOf: rec.svc ? rec.svc.of : 0, net: gross != null && svcPsf != null && psf ? gross - svcPsf / psf : null,
    g3: ctx.g3 || null, areaG3: ctx.areaG3 || null, cagr: ctx.cagr, areaCagr: ctx.areaCagr, sales, offShare: off, peakSales: peak ? peak.n : null, peakYear: peak ? peak.year : null,
    supplyYears: sup.years_of_sales != null ? sup.years_of_sales : null, supplyHomes: sup.homes || null, pastHomes: sup.buckets ? sup.buckets.past[1] : null,
    stressIrr: S ? S.stress.r.irr : null, histIrr: S ? S.hist.r.irr : null, histG: S ? S.hist.g : null, base: S ? S.base : null, exitShare: S && S.hist.r.split ? S.hist.r.split.exit : null,
    histYearOne: S ? S.hist.r.cashOnCash1 : null, yearOne: S ? S.hist.r.cashOnCash1 : null,
    rentCagr: rec.rent_cagr ? rec.rent_cagr.rate : null, rentFrom: rec.rent_cagr ? rec.rent_cagr.from : null, rentTo: rec.rent_cagr ? rec.rent_cagr.to : null, rents: rec.rents_l12 || (y ? y.contracts : null),
    topBedSales: bed ? bed.sales : null, topBedName: bed ? BN[bed.bed] : null, pg: ctx.pg || { scen: 6 },
  };
}
