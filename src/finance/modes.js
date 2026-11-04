// The five calculation modes. Each takes a case object and returns labelled results; nothing is defaulted.
import { result, val, present, ENGINE_VERSION, DISCLAIMER } from "./provenance.js";
import { gfaFromFar, nsaFromEfficiency } from "./area.js";
import { gdv, appraisal, staticResidual, dynamicResidual } from "./development.js";
import { buildCashflow, fund } from "./cashflow.js";
import { irr, npv, payback } from "./returns.js";
import { noi, grossYield, netYield, capRate, incomeValue, dscr, ltv, annuityPayment, equityMultiple, cashOnCash } from "./income.js";
import { solve, hbu, matrix } from "./analysis.js";

const stamp = (mode, body) => ({ mode, engine_version: ENGINE_VERSION, note: DISCLAIMER, ...body });
const median = (xs) => { const s = [...xs].sort((a, b) => a - b), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };

// ---------- 1. Land development: GDV, RLV, HBU ----------
// c = { plotArea, far, efficiency, pricePerM2, costs:{...}, realisation, targetMargin, targetBasis, acquisitionRate, dynamic?, alternatives? }
export function landMode(c) {
  const gfa = gfaFromFar({ plotArea: c.plotArea, far: c.far });
  const nsa = nsaFromEfficiency({ gfa: gfa.value, efficiency: c.efficiency });
  const g = gdv([{ id: "main", area: nsa.value, pricePerM2: c.pricePerM2 }]);
  const ap = appraisal({ gdvValue: g.value, realisation: c.realisation, costs: c.costs });
  const rlv = staticResidual({ netRevenue: ap.netRealisation.value, gdvValue: g.value, nonLandCost: ap.nonLandCost.value,
    targetMargin: c.targetMargin, targetBasis: c.targetBasis ?? "gdv", acquisitionRate: c.acquisitionRate });
  const profitAt = (p) => appraisal({ gdvValue: nsa.value * p, realisation: c.realisation, costs: c.costs }).profit.value;
  const be = solve(profitAt, 0, 0, val(c.pricePerM2) * 10);
  const out = { gfa, nsa, gdv: g, ...ap, rlvStatic: rlv,
    breakevenPricePerM2: result("DEV.BREAKEVEN_PRICE", be, { pricePerM2: c.pricePerM2 }, { formula: "sale price per m2 at which profit = 0, costs held" }) };
  if (c.dynamic) out.rlvDynamic = dynamicResidual(c.dynamic);
  if (c.alternatives) out.hbu = hbu(c.alternatives);
  return stamp("land", out);
}

// ---------- 2. Off-plan: GDV, cost to complete, absorption, developer IRR ----------
// c = { months, units, unitArea, pricePerM2, launchMonth, unitsPerMonth, depositShare, completionMonth, budget, spentToDate,
//       buildStart, buildEnd, equity, debt, discountRateAnnual }
export function offPlanMode(c) {
  const need = ["units", "unitArea", "pricePerM2", "unitsPerMonth", "depositShare", "budget", "spentToDate", "discountRateAnnual"].filter((k) => !present(c[k]));
  const unitPrice = val(c.unitArea) * val(c.pricePerM2);
  const g = result("DEV.GDV", val(c.units) * unitPrice, { units: c.units, unitArea: c.unitArea, pricePerM2: c.pricePerM2 }, { formula: "GDV = units x unit area x price per m2" });
  const ctc = result("DEV.COST_TO_COMPLETE", val(c.budget) - val(c.spentToDate), { budget: c.budget, spentToDate: c.spentToDate }, { formula: "cost to complete = current budget - spent to date" });
  // absorption: units sold each month from launch until sold out; deposit on sale, balance at completion (handover)
  const revenue = Array(c.months).fill(0); let left = val(c.units), t = c.launchMonth, sellOut = null;
  while (left > 0 && t < c.months) { const s = Math.min(left, val(c.unitsPerMonth)); left -= s;
    revenue[t] += s * unitPrice * val(c.depositShare); revenue[Math.max(t, c.completionMonth)] += s * unitPrice * (1 - val(c.depositShare));
    if (left === 0) sellOut = t; t++; }
  const flags = left > 0 ? [`ABSORPTION: ${left} units unsold by month ${c.months - 1}`] : [];
  const cf = buildCashflow({ months: c.months, lines: [{ name: "cost to complete", amount: ctc.value, start: c.buildStart, end: c.buildEnd, profile: "scurve", kind: "cost" }] });
  const f = fund({ costs: cf.cost, revenue, equity: c.equity, debt: c.debt });
  const rm = Math.pow(1 + val(c.discountRateAnnual), 1 / 12) - 1;
  const un = irr(f.unlevered, { periodsPerYear: 12, basis: "unlevered project" }), lv = irr(f.levered, { periodsPerYear: 12, basis: "levered equity" });
  return stamp("off-plan", { status: need.length ? "preliminary" : "estimate", missing_inputs: need, flags: [...flags, ...f.flags],
    gdv: g, costToComplete: ctc, sellOutMonth: sellOut, revenueByMonth: revenue, funding: f,
    unleveredIrr: un, leveredIrr: lv, unleveredNpv: npv(rm, f.unlevered), leveredNpv: npv(rm, f.levered),
    equityMultiple: equityMultiple(f.levered), peakEquity: f.totals.peakEquity, paybackMonth: payback(f.levered) });
}

// ---------- 3. Completed building: NOI, value, cap rate, DCF, net yield ----------
// c = { gpr, vacancyRate, creditLossRate, concessions, otherIncome, ownerOpex, recoveries, price, acquisitionCosts, marketCapRate,
//       holdYears, rentGrowth, exitCapRate, sellingCostRate, discountRate, loan?:{amount, annualRate, years} }
export function completedMode(c) {
  const n = noi(c);
  const totalAcq = val(c.price) + val(c.acquisitionCosts);
  const years = c.holdYears, cfs = [-totalAcq];
  for (let y = 1; y <= years; y++) cfs.push(n.noi.value * Math.pow(1 + val(c.rentGrowth), y - 1));
  const exitNoi = n.noi.value * Math.pow(1 + val(c.rentGrowth), years), exitGross = exitNoi / val(c.exitCapRate), exitNet = exitGross * (1 - val(c.sellingCostRate));
  cfs[years] += exitNet;
  const out = { egi: n.egi, noi: n.noi, opexRatio: n.opexRatio,
    grossYield: grossYield({ annualRent: c.gpr, price: c.price }),
    netYield: netYield({ netIncome: n.noi.value, totalAcquisitionCost: totalAcq }),
    capRateOnPrice: capRate({ stabilisedNoi: n.noi.value, value: c.price }),
    incomeValue: incomeValue({ noi: n.noi.value, marketCapRate: c.marketCapRate }),
    dcf: { cashflows: cfs, exitGross, exitNet, npv: npv(val(c.discountRate), cfs), irr: irr(cfs, { basis: "unlevered project" }) } };
  if (c.loan) {
    const ds = annuityPayment(c.loan.amount, c.loan.annualRate, c.loan.years);
    let bal = c.loan.amount; for (let y = 1; y <= years; y++) bal = bal * (1 + c.loan.annualRate) - ds;
    const eq = cfs.map((x, i) => (i === 0 ? x + c.loan.amount : i === years ? x - ds - Math.max(0, bal) : x - ds));
    out.levered = { debtService: ds, dscr: dscr({ noi: n.noi.value, debtService: ds }), ltv: ltv({ loan: c.loan.amount, value: c.price }),
      cashflows: eq, irr: irr(eq, { basis: "levered equity" }), equityMultiple: equityMultiple(eq),
      cashOnCash: cashOnCash({ annualCashAfterDebt: cfs[1] - ds, equity: -eq[0] }) };
  }
  return stamp("completed building", out);
}

// ---------- 4. Individual unit: comparables, rent, charges, return ----------
// c = { area, price?, comparables:[{pricePerM2, kind:'sold'|'asking', status:'ready'|'off-plan', date, id}], annualRent, serviceChargePerM2, otherOwnerCosts, transferFeeRate, otherBuyingCosts, subjectStatus }
export function unitMode(c) {
  const flags = [], used = [], rejected = [];
  for (const k of c.comparables || []) {
    if (k.kind !== "sold") { rejected.push({ ...k, why: "asking price, not a sale (needs an adjustment before use)" }); continue; }
    if (c.subjectStatus && k.status !== c.subjectStatus) { rejected.push({ ...k, why: `${k.status} comparable for a ${c.subjectStatus} subject (not mixed without adjustment)` }); continue; }
    used.push(k);
  }
  if (used.length < 3) flags.push(`THIN_EVIDENCE: ${used.length} usable comparable sales`);
  const med = median(used.map((k) => k.pricePerM2));
  const indicative = med == null ? null : med * val(c.area);
  const price = present(c.price) ? val(c.price) : indicative;
  const svc = val(c.serviceChargePerM2) * val(c.area), net = val(c.annualRent) - svc - val(c.otherOwnerCosts ?? 0);
  const tac = price * (1 + val(c.transferFeeRate)) + val(c.otherBuyingCosts);
  return stamp("unit", { flags, comparablesUsed: used, comparablesRejected: rejected,
    medianPricePerM2: result("UNIT.COMP_MEDIAN", med, { comparables: used.length }, { formula: "median sold price per m2 of like-for-like comparables", material: [] }),
    indicativeValue: result("UNIT.INDICATIVE", indicative, { area: c.area }, { formula: "indicative value = median comparable price per m2 x area" }),
    grossYield: grossYield({ annualRent: c.annualRent, price }),
    netYield: netYield({ netIncome: net, totalAcquisitionCost: tac }), serviceCharge: svc, totalAcquisitionCost: tac });
}

// ---------- 5. Redevelopment: HBU, incremental value, demolition/refurb, RLV ----------
// c = { existingUse: { noi, marketCapRate } | { value }, scheme: landMode case (costs must include demolition), valuationDate, basisOfValue, legal: {...}, physical: {...} }
export function redevelopmentMode(c) {
  const evu = present(c.existingUse.value) ? val(c.existingUse.value) : val(c.existingUse.noi) / val(c.existingUse.marketCapRate);
  if (!c.scheme.costs.demolition && !c.scheme.costs.refurbishment) throw new Error("redevelopment: state a demolition or refurbishment cost line");
  const s = landMode(c.scheme);
  const alt = [
    { name: "hold existing", legallyPermissible: { ok: true, verified: true }, physicallyPossible: { ok: true }, value: evu, valuationDate: c.valuationDate, basisOfValue: c.basisOfValue },
    { name: "redevelop", legallyPermissible: c.legal, physicallyPossible: c.physical, value: s.rlvStatic.value, valuationDate: c.valuationDate, basisOfValue: c.basisOfValue },
  ];
  return stamp("redevelopment", { existingUseValue: evu, scheme: s,
    incrementalValue: result("REDEV.INCREMENTAL", s.rlvStatic.value - evu, { existingUseValue: evu, residual: s.rlvStatic.value }, { formula: "incremental value = redevelopment residual (after demolition) - existing use value" }),
    hbu: hbu(alt) });
}

export { matrix };
