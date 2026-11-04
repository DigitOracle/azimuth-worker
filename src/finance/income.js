// Engine 3 NOI and Engine 4 yields / cap rate, plus debt and equity metrics.
import { result, val, present } from "./provenance.js";

const NOT_OPEX = /interest|principal|mortgage|depreciation|amorti[sz]ation|income.?tax|capex|capital/i;

// GPR -> EGI -> NOI. ownerOpex: { name: amount } borne by the owner. recoveries: amounts recovered from tenants (tenant-borne).
export function noi({ gpr, vacancyRate, creditLossRate, concessions = 0, otherIncome = 0, ownerOpex = {}, recoveries = 0 }) {
  for (const k of Object.keys(ownerOpex)) if (NOT_OPEX.test(k)) throw new Error(`'${k}' is not an operating expense: NOI excludes debt service, depreciation, income tax and major capex`);
  const G = val(gpr), vac = G * val(vacancyRate), cl = G * val(creditLossRate);
  const egi = G - vac - cl - val(concessions) + val(otherIncome);
  const opex = Object.values(ownerOpex).reduce((s, x) => s + val(x), 0), netOpex = opex - val(recoveries);
  const inputs = { gpr, vacancyRate, creditLossRate, concessions, otherIncome, recoveries, ...Object.fromEntries(Object.entries(ownerOpex).map(([k, v]) => ["opex_" + k, v])) };
  const material = ["gpr", "vacancyRate", "creditLossRate"];
  return {
    egi: result("INC.EGI", egi, inputs, { material, formula: "EGI = GPR - vacancy - credit loss - concessions + other income" }),
    noi: result("INC.NOI", egi - netOpex, inputs, { material, formula: "NOI = EGI - (owner-borne opex - tenant recoveries); excludes debt service, depreciation, income tax, major capex" }),
    ownerOpex: opex, netOwnerOpex: netOpex, vacancyLoss: vac, creditLoss: cl,
    opexRatio: result("INC.OPEX_RATIO", netOpex / egi, inputs, { material, formula: "opex ratio = net owner opex / EGI" }),
  };
}

export const grossYield = ({ annualRent, price }) => result("YLD.GROSS", val(annualRent) / val(price), { annualRent, price }, { formula: "gross yield = annual rent / price" });
export const netYield = ({ netIncome, totalAcquisitionCost }) =>
  result("YLD.NET", val(netIncome) / val(totalAcquisitionCost), { netIncome, totalAcquisitionCost }, { formula: "net yield = defined net income / total acquisition cost (price + transfer fee + other buying costs)" });
export const capRate = ({ stabilisedNoi, value }) => result("YLD.CAP_RATE", val(stabilisedNoi) / val(value), { stabilisedNoi, value }, { formula: "cap rate = stabilised NOI / value" });
export const incomeValue = ({ noi: n, marketCapRate }) => result("YLD.INCOME_VALUE", val(n) / val(marketCapRate), { noi: n, marketCapRate }, { formula: "income value = NOI / market cap rate" });
export const pricePerM2 = ({ price, area }) => result("YLD.PRICE_PER_M2", val(price) / val(area), { price, area }, { formula: "price per m2 = price / area" });
export const breakevenOccupancy = ({ opex, debtService, gpr }) =>
  result("INC.BREAKEVEN_OCC", (val(opex) + val(debtService)) / val(gpr), { opex, debtService, gpr }, { formula: "breakeven occupancy = (opex + debt service) / GPR" });

// Debt
export const dscr = ({ noi: n, debtService }) => result("DEBT.DSCR", val(n) / val(debtService), { noi: n, debtService }, { formula: "DSCR = NOI / annual debt service" });
export const ltv = ({ loan, value }) => result("DEBT.LTV", val(loan) / val(value), { loan, value }, { formula: "LTV = loan / value" });
export const ltc = ({ loan, totalCost }) => result("DEBT.LTC", val(loan) / val(totalCost), { loan, totalCost }, { formula: "LTC = loan / total cost" });
export const interestCover = ({ noi: n, interest }) => result("DEBT.ICR", val(n) / val(interest), { noi: n, interest }, { formula: "interest cover = NOI / interest" });
export const debtYield = ({ noi: n, loan }) => result("DEBT.DEBT_YIELD", val(n) / val(loan), { noi: n, loan }, { formula: "debt yield = NOI / loan" });
// Level annuity payment per period.
export function annuityPayment(principal, ratePerPeriod, n) { return ratePerPeriod === 0 ? principal / n : (principal * ratePerPeriod) / (1 - Math.pow(1 + ratePerPeriod, -n)); }

// Equity
export function equityMultiple(cfs) {
  const inn = cfs.filter((c) => c < 0).reduce((s, c) => s - c, 0), out = cfs.filter((c) => c > 0).reduce((s, c) => s + c, 0);
  return result("EQ.MULTIPLE", inn ? out / inn : null, { equityIn: inn, cashOut: out }, { formula: "equity multiple = total cash returned / total equity invested" });
}
export const cashOnCash = ({ annualCashAfterDebt, equity }) =>
  result("EQ.CASH_ON_CASH", val(annualCashAfterDebt) / val(equity), { annualCashAfterDebt, equity }, { formula: "cash-on-cash = annual pre-tax cash flow after debt service / equity invested" });
export function peakEquity(cfs) { let cum = 0, peak = 0; for (const c of cfs) { cum += c; peak = Math.max(peak, -cum); } return peak; }
export { present };
