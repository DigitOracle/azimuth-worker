// Engine 1 GDV and net realisation; Engine 2 residual land value (static and dynamic DCF); development profit metrics.
import { result, val, present, missingOf } from "./provenance.js";
import { buildCashflow, fund } from "./cashflow.js";

// GDV = sum(saleable area_i x price per m2_i). Gross: never mixed with net realisation.
export function gdv(lines) {
  const ids = new Set();
  for (const l of lines) { const id = l.id ?? l.name; if (ids.has(id)) throw new Error(`revenue line ${id} appears twice: proceeds would be double counted`); ids.add(id); }
  const inputs = {};
  lines.forEach((l, i) => { inputs[`area_${l.id ?? i}`] = l.area; inputs[`price_${l.id ?? i}`] = l.pricePerM2; });
  const v = lines.reduce((s, l) => s + val(l.area) * val(l.pricePerM2), 0);
  return result("DEV.GDV", v, inputs, { formula: "GDV = sum(saleable area x sale price per m2)" });
}

// Net development revenue = GDV - discounts - concessions - selling costs deducted at realisation.
export function netRealisation(gdvValue, { discounts = 0, concessions = 0, sellingCosts = 0 } = {}) {
  const v = val(gdvValue) - val(discounts) - val(concessions) - val(sellingCosts);
  return result("DEV.NET_REALISATION", v, { gdv: gdvValue, discounts, concessions, sellingCosts }, {
    formula: "net realisation = GDV - discounts - concessions - selling costs", material: ["gdv"] });
}

export const LAND_KEYS = ["land", "landAcquisition"];

// Development appraisal. costs = { construction, infrastructure, fees, approvals, marketing, contingency, finance, land, landAcquisition, ... }
export function appraisal({ gdvValue, realisation = {}, costs, material = Object.keys(costs) }) {
  const flags = [];
  if (present(realisation.sellingCosts) && val(realisation.sellingCosts) > 0 && present(costs.marketing) && val(costs.marketing) > 0)
    flags.push("CHECK_DOUBLE_COUNT: selling costs deducted at realisation AND a marketing/selling cost line: confirm they are different items");
  const ndr = netRealisation(gdvValue, realisation);
  const missing = missingOf(costs, material);
  const tdc = Object.values(costs).reduce((s, c) => s + (present(c) ? val(c) : 0), 0);
  const landTotal = LAND_KEYS.reduce((s, k) => s + (present(costs[k]) ? val(costs[k]) : 0), 0);
  const profit = ndr.value - tdc;
  const inputs = { gdv: gdvValue, ...costs };
  const opt = (id, formula) => ({ formula, material: ["gdv", ...material], flags });
  const out = {
    gdv: result("DEV.GDV_IN", val(gdvValue), { gdv: gdvValue }),
    netRealisation: ndr,
    totalDevelopmentCost: result("DEV.TDC", tdc, inputs, opt("", "TDC = sum of all cost lines incl. land and finance")),
    nonLandCost: result("DEV.NON_LAND_COST", tdc - landTotal, inputs, opt("", "non-land cost = TDC - land - land acquisition costs")),
    profit: result("DEV.PROFIT", profit, inputs, opt("", "profit = net development revenue - TDC")),
    profitOnCost: result("DEV.PROFIT_ON_COST", profit / tdc, inputs, opt("", "profit on cost = profit / TDC (land INCLUDED in cost)")),
    profitOnGdv: result("DEV.PROFIT_ON_GDV", profit / val(gdvValue), inputs, opt("", "profit on GDV = profit / GDV (not interchangeable with profit on cost)")),
    missing,
  };
  return out;
}

// Static residual. Land acquisition costs are a % of land, so the land value is solved in closed form.
// targetBasis 'gdv': target = m x GDV.  'cost': target = m x TDC (incl. land).
export function staticResidual({ netRevenue, gdvValue, nonLandCost, targetMargin, targetBasis = "gdv", acquisitionRate }) {
  const inputs = { netRevenue, gdv: gdvValue, nonLandCost, targetMargin, acquisitionRate };
  const N = val(netRevenue), NL = val(nonLandCost), m = val(targetMargin), a = val(acquisitionRate);
  let v, target, formula;
  if (targetBasis === "gdv") { target = m * val(gdvValue); v = (N - NL - target) / (1 + a); formula = "RLV = (net revenue - non-land cost - m x GDV) / (1 + acquisition rate)"; }
  else if (targetBasis === "cost") { v = (N - NL * (1 + m)) / ((1 + m) * (1 + a)); target = m * (NL + v * (1 + a)); formula = "RLV = (net revenue - non-land cost x (1+m)) / ((1+m)(1+a)), profit on total cost incl. land"; }
  else throw new Error("targetBasis must be 'gdv' or 'cost'");
  const r = result("DEV.RLV_STATIC", v, inputs, { formula, material: targetBasis === "gdv" ? Object.keys(inputs) : ["netRevenue", "nonLandCost", "targetMargin", "acquisitionRate"] });
  r.targetProfit = target;
  return r;
}

// Dynamic DCF residual: finance and acquisition costs depend on the land value, so solve iteratively.
// spec = { months, revenueLines, costLines (non-land, NO finance line), landMonth, acquisitionRate, equity, debt:{annualRate, maxDebt}, targetMargin, targetBasis }
export function dynamicResidual(spec) {
  if ((spec.costLines || []).some((l) => /financ|interest/i.test(l.name)))
    throw new Error("dynamicResidual: remove the fixed finance line, finance is calculated period by period (no double-counted finance)");
  const evalAt = (L) => {
    const extra = [{ name: "land", amount: L, start: spec.landMonth ?? 0, end: spec.landMonth ?? 0, kind: "cost" },
      { name: "land acquisition costs", amount: L * spec.acquisitionRate, start: spec.landMonth ?? 0, end: spec.landMonth ?? 0, kind: "cost" }];
    const cf = buildCashflow({ months: spec.months, lines: [...spec.revenueLines, ...spec.costLines, ...extra] });
    const f = fund({ costs: cf.cost, revenue: cf.revenue, equity: spec.equity, debt: spec.debt });
    const rev = cf.revenue.reduce((s, x) => s + x, 0), cost = cf.cost.reduce((s, x) => s + x, 0);
    const tdc = cost + f.totals.interest, profit = rev - tdc;
    const target = spec.targetBasis === "cost" ? spec.targetMargin * tdc : spec.targetMargin * rev;
    return { L, rev, tdc, profit, target, gap: profit - target, finance: f.totals.interest, funding: f };
  };
  // gap falls as L rises (more land, more acquisition cost, more interest): bisection.
  let lo = 0, hi = Math.max(1, evalAt(0).rev), glo = evalAt(lo).gap;
  if (glo < 0) return { ...result("DEV.RLV_DYNAMIC", null, {}, { flags: ["NEGATIVE_RESIDUAL: scheme does not reach the target profit even with free land"] }), at: evalAt(0) };
  for (let i = 0; i < 200 && hi - lo > 0.01; i++) { const mid = (lo + hi) / 2; if (evalAt(mid).gap > 0) lo = mid; else hi = mid; }
  const at = evalAt((lo + hi) / 2);
  const r = result("DEV.RLV_DYNAMIC", at.L, { targetMargin: spec.targetMargin, acquisitionRate: spec.acquisitionRate, annualRate: spec.debt?.annualRate, equity: spec.equity },
    { formula: "land value L such that profit(L) = target, with acquisition cost = a x L and interest computed monthly on actual funding" });
  r.at = at;
  return r;
}
