// Unit and period conversions. Currency conversion always needs an explicit, dated rate: there is no built-in FX default.
export const SQM_TO_SQFT = 10.7639104; // 1 m2 = 10.7639104 ft2 (exact from 0.3048 m per ft)

export const m2ToFt2 = (m2) => m2 * SQM_TO_SQFT;
export const ft2ToM2 = (ft2) => ft2 / SQM_TO_SQFT;
export const perM2ToPerFt2 = (p) => p / SQM_TO_SQFT; // AED per m2 -> AED per ft2
export const perFt2ToPerM2 = (p) => p * SQM_TO_SQFT;

export function convertCurrency(amount, rate) {
  if (!rate || !Number.isFinite(rate.value) || !rate.from || !rate.to || !rate.date)
    throw new Error("convertCurrency needs { from, to, value, date }: no default exchange rate is assumed");
  return amount * rate.value;
}

// Effective (compound) rate conversions.
export const monthlyToAnnual = (rm) => Math.pow(1 + rm, 12) - 1;
export const annualToMonthly = (ra) => Math.pow(1 + ra, 1 / 12) - 1;
// Nominal convention (e.g. a bank quotes 8% p.a. payable monthly) -> monthly rate = 8%/12.
export const nominalAnnualToMonthly = (ra) => ra / 12;

// Rent conversions.
export const rentMonthlyToAnnual = (m) => m * 12;
export const rentAnnualToMonthly = (a) => a / 12;
// Quoted (headline) vs effective rent: spread rent-free months and other incentives over the lease term.
export function effectiveRent({ quotedAnnual, leaseMonths, rentFreeMonths = 0, otherIncentives = 0 }) {
  const total = (quotedAnnual / 12) * (leaseMonths - rentFreeMonths) - otherIncentives;
  return (total / leaseMonths) * 12;
}
