// v727 (Kendall, 4 Nov 2026): the Najma Financial Intelligence Engine wired into page 2 of the Building Passport, by reader.
// Order approved: (1) Investor and (2) Broker for COMPLETED buildings; (3) Developer for EMPTY plots (mostly "preliminary" until zoning floor-area data lands).
// Every formula comes from the vendored engine in ./finance (NFE-1.0.0, source commit 58542f7). Nothing here re-implements a yield, NOI, IRR or residual.
// The old devmap_irr.js definitions (net yield on PRICE, unlabelled IRR) are NOT used: net yield here is on TOTAL ACQUISITION COST and every IRR says
// "unlevered project" or "levered equity".
// Rules carried to the page: every figure has a source and an as-of date; observed vs assumed is said; a missing MATERIAL input makes the figure
// "preliminary" with no number (never a default); assumptions are listed with their values; "Estimate, not a certified valuation" on the page.
import { completedMode, landMode, noi, grossYield, netYield, capRate, incomeValue, scenarios, gfaFromFar, result, inp, val, present, ENGINE_VERSION, DISCLAIMER, SQM_TO_SQFT } from "./finance/index.js";
import { ENGINE_SOURCE } from "./finance/SOURCE.js";

export const BPP_READERS = {
  broker: { label: "Broker", line: "Passport for a broker: value range, yield and sales pace to quote clients" },
  investor: { label: "Investor", line: "Passport for an investor: income, yields, returns and three scenarios, with a schedule to download" },
  developer: { label: "Developer (empty plots)", line: "Passport for a developer: what the land can bear (mostly preliminary until floor-area rules are loaded)" },
};
// Najjuko's default is broker (Kendall, 4 Nov). Anything unknown falls back to broker.
export const readerFor = (asked) => (Object.prototype.hasOwnProperty.call(BPP_READERS, asked) ? asked : "broker");
export const EST_NOTE = "Estimate, not a certified valuation.";

const int = (n) => (n == null || !Number.isFinite(+n) ? "n/a" : Math.round(+n).toLocaleString("en-US"));
const pct = (x, d) => (x == null || !Number.isFinite(x) ? null : (x * 100).toFixed(d == null ? 1 : d) + "%");
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dt = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || "")); return m ? +m[3] + " " + MON[+m[2] - 1] + " " + m[1] : "date not recorded"; };
const BED = { Studio: "0", "1 B/R": "1", "2 B/R": "2", "3 B/R": "3", "4 B/R": "4" };
const BEDNAME = (b) => (b === "0" ? "studio" : b + " bed");

// ------------------------------------------------------------------ assumptions (shown on the page with their values; never presented as evidence)
// Each one is a Najma working assumption for an automated estimate. Change them in the schedule; they are not market data.
export const ASSUME = {
  vacancyRate: { value: 0.05, label: "Vacancy between tenants", basis: "5% of the year empty (about 18 days); no register records vacancy" },
  creditLossRate: { value: 0.01, label: "Rent not collected", basis: "1% of rent" },
  managementRate: { value: 0.05, label: "Letting and management fee", basis: "5% of rent, paid by the owner" },
  maintenanceRate: { value: 0.02, label: "Repairs and upkeep inside the flat", basis: "2% of rent, paid by the owner" },
  agencyFeeRate: { value: 0.02, label: "Buying agent fee", basis: "2% of price" },
  otherBuyingCosts: { value: 4200, label: "Trustee and title deed charges", basis: "AED 4,200 a purchase (approximate)" },
  marketCapRate: { value: 0.055, label: "Market capitalisation rate", basis: "5.5%: the net income yield a buyer of the income would accept; not measured from registered sales" },
  holdYears: { value: 5, label: "Holding period", basis: "5 years" },
  rentGrowth: { value: 0.02, label: "Rent growth", basis: "2% a year" },
  exitCapRate: { value: 0.0025, label: "Exit capitalisation rate", basis: "the entry cap rate on price (NOI / price) plus 0.25 point at the end of year 5" },
  sellingCostRate: { value: 0.02, label: "Selling costs at exit", basis: "2% of the exit price" },
  discountRate: { value: 0.08, label: "Discount rate", basis: "8% a year (the return an investor asks for)" },
  loanToValue: { value: 0.5, label: "Mortgage share of price", basis: "50% loan to value" },
  loanRate: { value: 0.0475, label: "Mortgage interest", basis: "4.75% a year" },
  loanYears: { value: 25, label: "Mortgage term", basis: "25 years, repaid monthly-equivalent as one yearly payment" },
  // developer (land) assumptions
  efficiency: { value: 0.8, label: "Saleable share of floor area", basis: "80% of gross floor area is saleable" },
  buildCostPerM2: { value: 5725, label: "Construction cost", basis: "AED 5,725 per m2 of gross floor area: midpoint of Turner & Townsend 2026 tall residential shell and core (AED 5,000 to 6,450), VERIFY BEFORE USE; excludes fit-out" },
  feesRate: { value: 0.1, label: "Design and professional fees", basis: "10% of construction" },
  approvalsRate: { value: 0.02, label: "Authority and approval fees", basis: "2% of construction" },
  contingencyRate: { value: 0.05, label: "Contingency", basis: "5% of construction" },
  marketingRate: { value: 0.03, label: "Marketing and sales", basis: "3% of sales value" },
  targetMargin: { value: 0.2, label: "Developer's target profit", basis: "20% of sales value" },
  landAcqRate: { value: 0.04, label: "Land transfer fee", basis: "4% of land price (Dubai Land Department)" },
  buildMonths: { value: 36, label: "Build programme", basis: "36 months, spend on an S-curve, sales received at completion" },
  devLoanRate: { value: 0.075, label: "Development loan interest", basis: "7.5% a year, charged monthly on the drawn balance" },
  devEquityShare: { value: 0.4, label: "Developer equity", basis: "40% of the build cost, then debt" },
};
const A = (k, extra) => inp(ASSUME[k].value, { source: "Najma assumption: " + ASSUME[k].basis, observed: false, ...(extra || {}) });
export function assumptionRows(keys) { return keys.map((k) => ({ key: k, label: ASSUME[k].label, value: ASSUME[k].value, basis: ASSUME[k].basis })); }
const INV_KEYS = ["vacancyRate", "creditLossRate", "managementRate", "maintenanceRate", "agencyFeeRate", "otherBuyingCosts", "marketCapRate", "holdYears", "rentGrowth", "exitCapRate", "sellingCostRate", "discountRate", "loanToValue", "loanRate", "loanYears"];
const DEV_KEYS = ["efficiency", "buildCostPerM2", "feesRate", "approvalsRate", "contingencyRate", "marketingRate", "targetMargin", "landAcqRate", "buildMonths", "devLoanRate", "devEquityShare"];
// a placeholder that the ENGINE marks preliminary (its own provenance rule): value withheld, the missing input named
const pend = (id, formula, inputs) => result(id, null, inputs, { formula });

// ------------------------------------------------------------------ what kind of asset this is (the asset type decides the mode)
export function assetKind(pp, pack) {
  pack = pack || {}; const pj = pack.project || {};
  if (/finish|complet/i.test(pj.status || "") || (pack.tenancies && pack.tenancies.total)) return "completed";
  if (pj.number) return "offplan";
  if (!(pp && pp.buildings && pp.buildings.length) && !(pack.units && pack.units.length) && !(pack.bldgs && pack.bldgs.length)) return "land";
  return "built-unregistered";
}

// homes by bedroom class, preferring the primary project's buildings (never a different project's flats)
function homeMix(pack) {
  const pj = pack.project || {}, bd = pack.bldgs || [];
  const own = pj.number ? bd.filter((b) => b.pn === pj.number) : [];
  const src = own.length ? own.flatMap((b) => b.mix || []) : (pack.units || []);
  const out = {};
  for (const u of src) { const b = BED[u.rooms]; if (b == null || !u.median_sqm) continue; const o = (out[b] = out[b] || { n: 0, sqmW: 0 }); o.n += u.n; o.sqmW += u.median_sqm * u.n; }
  for (const b of Object.keys(out)) out[b].sqm = Math.round(out[b].sqmW / out[b].n * 10) / 10;
  return { mix: out, scope: own.length ? [...new Set(own.map((b) => b.name || "building " + b.no))].join(", ") + (own.length > 1 ? " (" + own.length + " buildings)" : "") : "the plot" };
}
function evidence(pack) {
  const s = pack.sales || null, t = pack.tenancies || null, ready = s && s.kinds && s.kinds.ready;
  const sAsof = (pack.asof && pack.asof.lk_dld_transactions && pack.asof.lk_dld_transactions.date) || (s && s.to);
  const tAsof = (pack.asof && pack.asof.pp_dld__rent_contracts && pack.asof.pp_dld__rent_contracts.date) || (t && t.to);
  const uAsof = pack.asof && pack.asof.g_dld__units && pack.asof.g_dld__units.date;
  const sc = pack.service_charge && present(pack.service_charge.aed_sqft) ? pack.service_charge : null;   // RERA service charge index, when it lands
  return { s, t, ready, sAsof, tAsof, uAsof, sc };
}

// ------------------------------------------------------------------ INVESTOR (completed building, one typical unit)
function investorCase(unit, ev, scAedSqft) {
  const rent = unit.rent, sqft = unit.sqm * SQM_TO_SQFT;
  const gpr = inp(rent, { source: "tenancy register (Ejari), median of " + unit.contracts + " " + BEDNAME(unit.b) + " contracts, last 400 days, project level", date: ev.tAsof, observed: true, unit: "AED a year" });
  const price = inp(Math.round(unit.price), { source: "sales register (Dubai Land Department) ready median AED " + int(ev.ready.aed_m2) + " per m2 (" + ev.ready.deals + " deals, " + ev.s.year + ") x units register median size " + unit.sqm + " m2", date: ev.sAsof, observed: true, basis: "derived from two registers", unit: "AED" });
  const sc = scAedSqft == null ? null : scAedSqft * sqft;
  const c = {
    gpr, vacancyRate: A("vacancyRate"), creditLossRate: A("creditLossRate"),
    ownerOpex: {
      service_charge: inp(sc, ev.sc && scAedSqft === ev.sc.aed_sqft ? { source: ev.sc.source || "service charge index", date: ev.sc.date, observed: true } : { source: "ILLUSTRATIVE service charge AED " + scAedSqft + " per sq ft (not matched to this building)", observed: false }),
      management: inp(rent * ASSUME.managementRate.value, { source: "Najma assumption: " + ASSUME.managementRate.basis }),
      upkeep: inp(rent * ASSUME.maintenanceRate.value, { source: "Najma assumption: " + ASSUME.maintenanceRate.basis }),
    },
    price, acquisitionCosts: inp(Math.round(unit.price * (0.04 + ASSUME.agencyFeeRate.value) + ASSUME.otherBuyingCosts.value), { source: "Dubai Land Department transfer fee 4% (published) + Najma assumptions: agent 2%, AED 4,200 trustee and title deed", observed: false }),
    marketCapRate: A("marketCapRate"), holdYears: ASSUME.holdYears.value, rentGrowth: A("rentGrowth"), exitCapRate: null,
    sellingCostRate: A("sellingCostRate"), discountRate: A("discountRate"),
    loan: { amount: Math.round(unit.price * ASSUME.loanToValue.value), annualRate: ASSUME.loanRate.value, years: ASSUME.loanYears.value },
  };
  // exit cap: the entry cap rate on price from the engine's own NOI, plus the assumed spread (so the exit is not a hidden price crash or boom)
  const n0 = sc == null ? null : noi(c).noi.value;
  c.exitCapRate = inp(n0 == null ? null : n0 / val(price) + ASSUME.exitCapRate.value, { source: "Najma assumption: " + ASSUME.exitCapRate.basis, observed: false });
  return c;
}
const runCompleted = (c) => completedMode(c);
function pickUnit(pack) {
  const ev = evidence(pack), { mix, scope } = homeMix(pack);
  if (!ev.ready || !ev.t) return { ev, scope, mix, unit: null };
  const cands = Object.keys(ev.t.beds || {}).filter((b) => mix[b] && ev.t.beds[b][1] >= 5).sort((a, b) => ev.t.beds[b][1] - ev.t.beds[a][1]);
  const b = cands[0];
  if (b == null) return { ev, scope, mix, unit: null };
  return { ev, scope, mix, unit: { b, sqm: mix[b].sqm, rent: ev.t.beds[b][0], contracts: ev.t.beds[b][1], price: ev.ready.aed_m2 * mix[b].sqm } };
}

export function investorView(pp, pack) {
  pack = pack || {};
  const { ev, scope, unit } = pickUnit(pack);
  const missing = [], flags = [];
  if (!ev.ready) missing.push("ready sales in this building this year (sale price per m2)");
  if (!ev.t) missing.push("registered tenancies (rent)");
  if (!unit) return { reader: "investor", status: "preliminary", missing: missing.length ? missing : ["a bedroom class with both a registered rent (5+ contracts) and a recorded unit size"], flags, unit: null, assumptions: assumptionRows(INV_KEYS) };
  if (ev.ready.deals < 10) flags.push("THIN_EVIDENCE: " + ev.ready.deals + " ready sales this year behind the price per m2 (under 10)");
  if (unit.contracts < 10) flags.push("THIN_EVIDENCE: " + unit.contracts + " registered contracts behind the rent (under 10)");
  const scKnown = ev.sc ? ev.sc.aed_sqft : null;
  if (scKnown == null) missing.push("service-charge rate for this building (owner-borne running cost; the RERA service charge index is not matched yet)");
  const base = investorCase(unit, ev, scKnown);
  const gross = grossYield({ annualRent: base.gpr, price: base.price });
  let head;
  if (scKnown != null) {
    const r = runCompleted(base);
    head = { egi: r.egi, noi: r.noi, netYield: r.netYield, capRateOnPrice: r.capRateOnPrice, incomeValue: r.incomeValue, unleveredIrr: r.dcf.irr, leveredIrr: r.levered.irr, cashOnCash: r.levered.cashOnCash, dscr: r.levered.dscr, ltv: r.levered.ltv, dcf: r.dcf, levered: r.levered };
  } else {
    // the engine itself withholds these: the service charge is a material input and is missing
    const sc0 = inp(null, { source: "service charge not matched" });
    head = {
      noi: pend("INC.NOI", "NOI = EGI - owner-borne running costs (service charge, management, upkeep)", { gpr: base.gpr, vacancyRate: base.vacancyRate, creditLossRate: base.creditLossRate, serviceCharge: sc0 }),
      netYield: pend("YLD.NET", "net yield = NOI / total acquisition cost (price + transfer fee + other buying costs)", { netIncome: sc0, totalAcquisitionCost: val(base.price) + val(base.acquisitionCosts) }),
      capRateOnPrice: pend("YLD.CAP_RATE", "cap rate = stabilised NOI / value", { stabilisedNoi: sc0, value: base.price }),
      incomeValue: pend("YLD.INCOME_VALUE", "income value = NOI / market cap rate", { noi: sc0, marketCapRate: base.marketCapRate }),
      unleveredIrr: { irr: null, irrAnnual: null, basis: "unlevered project", flag: "PRELIMINARY", reason: "needs the service charge" },
      leveredIrr: { irr: null, irrAnnual: null, basis: "levered equity", flag: "PRELIMINARY", reason: "needs the service charge" },
      cashOnCash: pend("EQ.CASH_ON_CASH", "cash-on-cash = year-1 cash after debt service / equity invested", { annualCashAfterDebt: sc0, equity: val(base.price) + val(base.acquisitionCosts) - base.loan.amount }),
    };
  }
  // what the yield would be at three service-charge rates (clearly illustrative while the real one is missing)
  const illus = (scKnown != null ? [scKnown] : [10, 15, 20]).map((s) => { const r = runCompleted(investorCase(unit, ev, s)); return { scAedSqft: s, noi: r.noi.value, netYield: r.netYield.value, unleveredIrr: r.dcf.irr.irrAnnual, leveredIrr: r.levered.irr.irrAnnual, cashOnCash: r.levered.cashOnCash.value, dscr: r.levered.dscr.value, r }; });
  const scBase = scKnown != null ? scKnown : 15;
  const scen = scenarios((c) => { const r = runCompleted(c); return { noi: r.noi.value, netYield: r.netYield.value, unleveredIrr: r.dcf.irr.irrAnnual, leveredIrr: r.levered.irr.irrAnnual, incomeValue: r.incomeValue.value }; },
    investorCase(unit, ev, scBase), {
      downside: [{ path: "gpr", mode: "multiply", value: 0.9 }, { path: "vacancyRate", mode: "set", value: 0.1 }, { path: "exitCapRate", mode: "add", value: 0.005 }],
      base: [],
      upside: [{ path: "gpr", mode: "multiply", value: 1.05 }, { path: "vacancyRate", mode: "set", value: 0.03 }, { path: "exitCapRate", mode: "add", value: -0.0025 }],
    });
  const status = missing.length ? "preliminary" : "estimate";
  return { reader: "investor", status, missing, flags, scope, unit, case: base, gross, head, illus, scBase, scenarios: scen, scIllustrative: scKnown == null, assumptions: assumptionRows(INV_KEYS) };
}

// ------------------------------------------------------------------ BROKER (completed building: value range, yield, sales pace)
export function brokerView(pp, pack, today) {
  pack = pack || {};
  const ev = evidence(pack), { mix, scope } = homeMix(pack), missing = [], flags = [];
  if (!ev.ready) missing.push("ready sales this year (sale price per m2)");
  const classes = Object.keys(mix).sort().map((b) => {
    const price = ev.ready ? ev.ready.aed_m2 * mix[b].sqm : null, rent = ev.t && ev.t.beds[b] ? ev.t.beds[b][0] : null;
    const gy = price && rent ? grossYield({ annualRent: inp(rent, { source: "tenancy register (Ejari)", date: ev.tAsof, observed: true }), price: inp(price, { source: "sales register x units register", date: ev.sAsof, observed: true }) }) : null;
    return { b, homes: mix[b].n, sqm: mix[b].sqm, sqft: Math.round(mix[b].sqm * SQM_TO_SQFT), price, rent, contracts: ev.t && ev.t.beds[b] ? ev.t.beds[b][1] : 0, grossYield: gy };
  });
  const priced = classes.filter((c) => c.price);
  const range = priced.length ? { low: Math.min(...priced.map((c) => c.price)), high: Math.max(...priced.map((c) => c.price)) } : null;
  // sales pace: ready sales so far this year, per month, and as a share of the homes in the building
  let pace = null;
  if (ev.s && ev.ready) {
    const to = Date.parse(ev.s.to), from = Date.parse(ev.s.year + "-01-01"), months = Math.max(1, (to - from) / (30.4375 * 864e5));
    const homes = classes.reduce((s, c) => s + c.homes, 0);
    pace = { deals: ev.ready.deals, months: Math.round(months * 10) / 10, perMonth: ev.ready.deals / months, turnover: homes ? (ev.ready.deals / months * 12) / homes : null, homes, allTime: ev.s.all_time || null };
    if (ev.ready.deals < 10) flags.push("THIN_EVIDENCE: " + ev.ready.deals + " ready sales this year: quote the range as indicative");
  } else missing.push("sales pace (no ready sales this year)");
  const h = ev.t && ev.t.history;
  const letting = h ? { last12: h.last_12m, renewals: h.renewals_12m, perMonth: h.last_12m / 12 } : null;
  missing.push("net yield (needs the service-charge rate, not matched yet)");
  return { reader: "broker", status: ev.ready && ev.t ? "estimate" : "preliminary", missing, flags, scope, classes, range, pace, letting, ev };
}

// ------------------------------------------------------------------ DEVELOPER (empty plot: GDV, cost, profit, residual land value)
export function developerView(pp, pack) {
  pack = pack || {}; pp = pp || {};
  const missing = [], flags = [];
  const z = pack.zoning || null;   // the verified zoning collection, once loaded: { far, source, date }
  const plotArea = inp(pp.sqm || null, { source: "plot register (land area)", date: pack.asof && pack.asof.lk_plot_master ? pack.asof.lk_plot_master.date : null, observed: true, unit: "m2" });
  const far = inp(z && present(z.far) ? z.far : null, z ? { source: z.source || "zoning register", date: z.date, observed: true } : { source: "zoning floor-area ratio not loaded" });
  const dp = pack.district_price || null;   // { aed_m2, deals, kind, source, date } for a plot with no building of its own
  const pricePerM2 = inp(dp && present(dp.aed_m2) ? dp.aed_m2 : null, dp ? { source: dp.source || "sales register, district median", date: dp.date, observed: true } : { source: "no sale price per m2 in the data pack for this plot" });
  if (!present(plotArea)) missing.push("plot area");
  if (!present(far)) missing.push("permitted floor area (floor area ratio from the zoning plan, not loaded yet)");
  if (!present(pricePerM2)) missing.push("sale price per m2 for new homes in this district (not in this plot's data pack)");
  const gfa = gfaFromFar({ plotArea, far });
  if (missing.length) {
    const g0 = inp(null, { source: "needs " + missing.join(", ") });
    return { reader: "developer", status: "preliminary", missing, flags, plotArea, gfa,
      gdv: pend("DEV.GDV", "GDV = saleable area x sale price per m2", { saleableArea: g0, pricePerM2 }),
      totalCost: pend("DEV.TDC", "total cost = construction + fees + approvals + contingency + marketing + finance (+ land)", { gfa: g0 }),
      rlvStatic: pend("DEV.RLV_STATIC", "RLV = (net revenue - non-land cost - target profit) / (1 + land transfer fee)", { gdv: g0 }),
      rlvDynamic: pend("DEV.RLV_DYNAMIC", "land value at which monthly cash flow with interest reaches the target profit", { gdv: g0 }),
      profitOnCost: pend("DEV.PROFIT_ON_COST", "profit / total cost incl. land", { gdv: g0 }), profitOnGdv: pend("DEV.PROFIT_ON_GDV", "profit / GDV", { gdv: g0 }),
      breakeven: pend("DEV.BREAKEVEN_PRICE", "sale price per m2 at which profit = 0", { gdv: g0 }),
      hbu: { status: "preliminary", winner: null, why: "highest and best use needs the permitted uses and floor area from the zoning plan" },
      assumptions: assumptionRows(DEV_KEYS), schedule: null };
  }
  const G = val(gfa.value), S = G * ASSUME.efficiency.value, gdvV = S * val(pricePerM2), C = G * ASSUME.buildCostPerM2.value;
  const costs = { construction: inp(C, { source: "Najma assumption: " + ASSUME.buildCostPerM2.basis }), fees: inp(C * ASSUME.feesRate.value, { source: "Najma assumption: " + ASSUME.feesRate.basis }),
    approvals: inp(C * ASSUME.approvalsRate.value, { source: "Najma assumption" }), contingency: inp(C * ASSUME.contingencyRate.value, { source: "Najma assumption" }),
    marketing: inp(gdvV * ASSUME.marketingRate.value, { source: "Najma assumption" }) };
  const M = ASSUME.buildMonths.value, months = M + 1;
  const nonLand = C * (1 + ASSUME.feesRate.value + ASSUME.approvalsRate.value + ASSUME.contingencyRate.value) + gdvV * ASSUME.marketingRate.value;
  const dyn = { months, revenueLines: [{ name: "sales at completion", amount: gdvV, start: M, end: M, kind: "revenue" }],
    costLines: [{ name: "construction and fees", amount: nonLand - gdvV * ASSUME.marketingRate.value, start: 1, end: M - 1, profile: "scurve", kind: "cost" }, { name: "marketing", amount: gdvV * ASSUME.marketingRate.value, start: 1, end: M, kind: "cost" }],
    landMonth: 0, acquisitionRate: ASSUME.landAcqRate.value, equity: nonLand * ASSUME.devEquityShare.value, debt: { annualRate: ASSUME.devLoanRate.value }, targetMargin: ASSUME.targetMargin.value, targetBasis: "gdv" };
  const lm = landMode({ plotArea, far, efficiency: A("efficiency"), pricePerM2, costs, targetMargin: A("targetMargin"), acquisitionRate: A("landAcqRate"), dynamic: dyn,
    alternatives: [{ name: "build for sale as zoned", legallyPermissible: { ok: true, verified: !!(z && z.verified) }, physicallyPossible: { ok: true }, value: null, valuationDate: "today", basisOfValue: "market value" }] });
  // profit at the residual land value (land and its fee included in cost), from the engine's own appraisal
  const L = lm.rlvStatic.value;
  const atL = landMode({ plotArea, far, efficiency: A("efficiency"), pricePerM2, costs: { ...costs, land: inp(L, { source: "residual land value (static)" }), landAcquisition: inp(L * ASSUME.landAcqRate.value, { source: "4% of land" }) }, targetMargin: A("targetMargin"), acquisitionRate: A("landAcqRate") });
  const hb = lm.hbu; if (hb && hb.alternatives) { hb.alternatives[0].value = L; }
  const rows = lm.rlvDynamic && lm.rlvDynamic.at ? lm.rlvDynamic.at.funding.rows : [];
  const status = z && z.verified ? "estimate" : "preliminary";
  if (!(z && z.verified)) flags.push("Permitted use ASSUMED (residential for sale), not verified against the plot's entitlements");
  return { reader: "developer", status, missing, flags, plotArea, gfa, gdv: lm.gdv, totalCost: atL.totalDevelopmentCost, nonLandCost: lm.nonLandCost, rlvStatic: lm.rlvStatic, rlvDynamic: lm.rlvDynamic,
    profitOnCost: atL.profitOnCost, profitOnGdv: atL.profitOnGdv, breakeven: lm.breakevenPricePerM2, hbu: { status: "preliminary", winner: "build for sale as zoned", why: "only one alternative tested until the zoning plan lists the permitted uses" },
    assumptions: assumptionRows(DEV_KEYS), schedule: rows };
}

// ------------------------------------------------------------------ one entry point: reader + asset type -> the view, the passport lines, the schedule
export function bppFinance(pp, pack, reader, today) {
  const kind = assetKind(pp, pack);
  let r = readerFor(reader), note = null;
  if (kind === "land" && r !== "developer") { note = "This is an empty plot, so the " + BPP_READERS[r].label.toLowerCase() + " view does not apply; the developer view is shown."; r = "developer"; }
  else if (kind !== "land" && r === "developer") { note = "This plot has a building, so the developer view (for empty plots) does not apply; the broker view is shown."; r = "broker"; }
  const v = r === "investor" ? investorView(pp, pack) : r === "developer" ? developerView(pp, pack) : brokerView(pp, pack, today);
  v.kind = kind; v.note = note; v.engine = ENGINE_VERSION; v.engine_source = ENGINE_SOURCE;
  v.lines = financeLines(v);
  v.csv = r === "broker" ? null : scheduleCsv(v, pp);
  return v;
}

const aed = (n) => (n == null || !Number.isFinite(n) ? "preliminary" : "AED " + int(n));
const WORDS = { serviceCharge: "the service charge", netIncome: "net operating income, which needs the service charge", stabilisedNoi: "net operating income, which needs the service charge", noi: "net operating income, which needs the service charge",
  annualCashAfterDebt: "cash after the mortgage, which needs the service charge", far: "the floor area ratio from the zoning plan", plotArea: "the plot area", saleableArea: "the saleable area", pricePerM2: "a sale price per m2", gdv: "the sales value", gfa: "the permitted floor area" };
const needs = (x) => [...new Set(((x && x.missing_inputs) || []).map((k) => WORDS[k] || k))].join(", ");
const showRes = (x, fmt) => (x && x.value != null && Number.isFinite(x.value) ? fmt(x.value) : "preliminary (needs " + needs(x) + ")");
const showIrr = (o) => (o && o.irrAnnual != null ? pct(o.irrAnnual) + " (" + o.basis + ")" : "preliminary (" + (o && o.basis) + "; " + ((o && (o.reason || o.flag)) || "not available") + ")");

// the lines handed to the passport writer for page 2, section 07 (print exactly)
export function financeLines(v) {
  const L = [], who = BPP_READERS[v.reader].label;
  L.push("Reader: " + who + ". Section 07 on page 2 is titled \"Investment - for " + (v.reader === "investor" ? "an investor" : v.reader === "broker" ? "a broker" : "a developer") + "\" and carries the chip \"Calculated\". Status: " + v.status.toUpperCase() + (v.status === "preliminary" ? " (a material input is missing; figures marked preliminary have no number)" : "") + ". Print \"" + EST_NOTE + "\" in this section. Calculation engine " + v.engine + ".");
  if (v.note) L.push("Reader note: " + v.note);
  if (v.reader === "investor") {
    if (!v.unit) { L.push("Investor figures: preliminary - " + v.missing.join("; ") + "."); return L; }
    const u = v.unit, c = v.case, ev = c;
    L.push("Typical unit used (the bedroom class with the most registered lets): " + BEDNAME(u.b) + ", median size " + u.sqm + " m2 (" + int(u.sqm * SQM_TO_SQFT) + " sq ft) from the units register, " + v.scope + ".");
    L.push("Observed: price AED " + int(val(c.price)) + " (" + c.price.source + ", as of " + dt(c.price.date) + "); rent AED " + int(val(c.gpr)) + " a year (" + c.gpr.source + ", as of " + dt(c.gpr.date) + ").");
    L.push("Gross yield (observed inputs) " + showRes(v.gross, (x) => pct(x)) + " = rent / price.");
    L.push("Total acquisition cost AED " + int(val(c.price) + val(c.acquisitionCosts)) + " (price + " + c.acquisitionCosts.source + ").");
    const H = v.head;
    L.push("Income build-up (net operating income, NOI): rent AED " + int(val(c.gpr)) + " less vacancy " + pct(ASSUME.vacancyRate.value, 0) + " and rent not collected " + pct(ASSUME.creditLossRate.value, 0) + " (assumed), less owner running costs: service charge " + (v.scIllustrative ? "NOT MATCHED" : "AED " + val(c.ownerOpex.service_charge).toFixed(0)) + ", management " + pct(ASSUME.managementRate.value, 0) + " and upkeep " + pct(ASSUME.maintenanceRate.value, 0) + " of rent (assumed). NOI " + showRes(H.noi, aed) + ".");
    L.push("Net yield on total acquisition cost " + showRes(H.netYield, (x) => pct(x)) + "; cap rate on price " + showRes(H.capRateOnPrice, (x) => pct(x)) + "; income value at a " + pct(ASSUME.marketCapRate.value) + " market cap rate (assumed) " + showRes(H.incomeValue, aed) + ".");
    L.push("Returns over " + ASSUME.holdYears.value + " years: IRR (internal rate of return) " + showIrr(H.unleveredIrr) + "; IRR " + showIrr(H.leveredIrr) + " with a " + pct(ASSUME.loanToValue.value, 0) + " mortgage at " + pct(ASSUME.loanRate.value, 2) + " (assumed); cash-on-cash year 1 " + showRes(H.cashOnCash, (x) => pct(x)) + ".");
    L.push((v.scIllustrative ? "ILLUSTRATIVE ONLY (service charge not matched; print this label): if the service charge were " : "At the matched service charge ") + v.illus.map((i) => "AED " + i.scAedSqft + " per sq ft: NOI AED " + int(i.noi) + ", net yield " + pct(i.netYield) + ", unlevered IRR " + (pct(i.unleveredIrr) || "n/a") + ", levered IRR " + (pct(i.leveredIrr) || "n/a") + ", cash-on-cash " + pct(i.cashOnCash)).join("; ") + ".");
    const S = v.scenarios, sl = (n) => n + ": net yield " + pct(S[n].netYield) + ", unlevered IRR " + (pct(S[n].unleveredIrr) || "n/a") + ", levered IRR " + (pct(S[n].leveredIrr) || "n/a");
    L.push("Scenarios" + (v.scIllustrative ? " (ILLUSTRATIVE, service charge assumed AED " + v.scBase + " per sq ft)" : "") + ": downside (rent -10%, vacancy 10%, exit cap +0.5 point) " + sl("downside").replace(/^downside: /, "") + "; base " + sl("base").replace(/^base: /, "") + "; upside (rent +5%, vacancy 3%, exit cap -0.25 point) " + sl("upside").replace(/^upside: /, "") + ".");
    L.push("Assumptions (Najma working assumptions, not market evidence; print them as a small table with their values): " + v.assumptions.map((a) => a.label + " " + a.basis).join("; ") + ".");
    L.push("Schedule: the year-by-year cash flow with every input, source and assumption is a download (CSV, opens in Excel) at /bp/f/<this passport>.csv; print \"Download the schedule\" with that link.");
  } else if (v.reader === "broker") {
    L.push("Broker block (short, to quote clients; no workbook). Price per m2 is the project-level ready median (sales register, " + (v.ev.ready ? v.ev.ready.deals + " deals " + v.ev.s.year + ", as of " + dt(v.ev.sAsof) : "none this year") + ") applied to each bedroom class's median size (units register" + (v.ev.uAsof ? ", as of " + dt(v.ev.uAsof) : "") + ", " + v.scope + ").");
    if (v.range) L.push("Value range: AED " + int(v.range.low) + " to AED " + int(v.range.high) + " across the bedroom classes (AED " + int(v.ev.ready.aed_sqft) + " per sq ft).");
    else L.push("Value range: preliminary (no ready sales this year).");
    L.push("By bedroom class: " + v.classes.map((c) => BEDNAME(c.b) + " " + c.sqft + " sq ft, " + (c.price ? "about AED " + int(c.price) : "price preliminary") + ", rent " + (c.rent ? "AED " + int(c.rent) + " (" + c.contracts + " lets)" : "not registered") + ", gross yield " + (c.grossYield ? pct(c.grossYield.value) : "n/a")).join("; ") + ".");
    if (v.pace) L.push("Sales pace (absorption): " + v.pace.deals + " ready sales in " + v.pace.months + " months of " + v.ev.s.year + " = " + v.pace.perMonth.toFixed(1) + " a month" + (v.pace.turnover != null ? ", about " + pct(v.pace.turnover) + " of the " + int(v.pace.homes) + " homes a year" : "") + (v.pace.allTime ? "; " + int(v.pace.allTime) + " sales all time" : "") + ".");
    if (v.letting) L.push("Letting pace: " + int(v.letting.last12) + " tenancy contracts in the last 12 months (" + v.letting.perMonth.toFixed(1) + " a month), " + int(v.letting.renewals) + " of them renewals.");
    L.push("Net yield: not quoted - needs the service-charge rate (not matched yet).");
  } else {
    L.push("Developer view (empty plot). Plot area " + (present(v.plotArea) ? int(val(v.plotArea)) + " m2 (" + v.plotArea.source + ")" : "not recorded") + ". Permitted floor area " + showRes(v.gfa, (x) => int(x) + " m2") + ".");
    L.push("Sales value of the scheme (GDV, gross development value) " + showRes(v.gdv, aed) + "; total cost " + showRes(v.totalCost, aed) + "; profit on cost " + showRes(v.profitOnCost, (x) => pct(x)) + "; profit on GDV " + showRes(v.profitOnGdv, (x) => pct(x)) + ".");
    L.push("Residual land value (what the land can bear at a " + pct(ASSUME.targetMargin.value, 0) + " target profit): static " + showRes(v.rlvStatic, aed) + "; with a monthly cash flow and interest " + showRes(v.rlvDynamic, aed) + ". Break-even sale price " + showRes(v.breakeven, (x) => "AED " + int(x) + " per m2") + ".");
    L.push("Highest and best use: " + (v.hbu.winner ? v.hbu.winner + " (" + v.hbu.status + ": " + v.hbu.why + ")" : "preliminary - " + v.hbu.why) + ".");
    L.push("Assumptions (Najma working assumptions, print with values): " + v.assumptions.map((a) => a.label + " " + a.basis).join("; ") + ".");
    if (v.schedule && v.schedule.length) L.push("Schedule: the monthly cash flow (costs, sales, loan draws, interest, equity) is a download (CSV, opens in Excel) at /bp/f/<this passport>.csv.");
  }
  if (v.missing.length) L.push("Missing for this reader (grey chip \"Not available yet\"): " + v.missing.join("; ") + ".");
  if (v.flags.length) L.push("Evidence warnings (print small, amber): " + v.flags.join("; ") + ".");
  L.push("Valuation note (print exactly): " + EST_NOTE + " " + DISCLAIMER);
  return L;
}

// ------------------------------------------------------------------ the downloadable schedule (CSV; the Excel workbook needs Node, see the report)
const q = (x) => { const s = x == null ? "" : String(x); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const rowCsv = (a) => a.map(q).join(",");
export function scheduleCsv(v, pp) {
  const out = [["Najma Building Passport schedule", (pp && (pp.project || pp.parcel)) || ""], ["Reader", BPP_READERS[v.reader].label], ["Status", v.status], ["Engine", v.engine + " (source commit " + v.engine_source.commit + ")"], ["Note", EST_NOTE + " " + DISCLAIMER], []];
  out.push(["Assumptions (Najma working assumptions, not evidence)"], ["item", "value", "basis"]);
  for (const a of v.assumptions) out.push([a.label, a.value, a.basis]);
  out.push([]);
  if (v.reader === "investor" && v.unit) {
    const c = v.case;
    out.push(["Observed inputs"], ["item", "value", "source", "as of"], ["Price", val(c.price), c.price.source, c.price.date], ["Rent (a year)", val(c.gpr), c.gpr.source, c.gpr.date], ["Acquisition costs", val(c.acquisitionCosts), c.acquisitionCosts.source, ""], []);
    for (const i of v.illus) {
      const r = i.r, cf = r.dcf.cashflows, eq = r.levered.cashflows;
      out.push([(v.scIllustrative ? "ILLUSTRATIVE: service charge AED " : "Service charge AED ") + i.scAedSqft + " per sq ft"], ["year", "unlevered cash flow (project)", "levered cash flow (equity)"]);
      cf.forEach((x, t) => out.push([t, Math.round(x), Math.round(eq[t])]));
      out.push(["NOI", Math.round(i.noi)], ["net yield on total acquisition cost", i.netYield], ["IRR unlevered project", i.unleveredIrr], ["IRR levered equity", i.leveredIrr], ["cash-on-cash", i.cashOnCash], ["DSCR (debt service cover)", i.dscr], []);
    }
  }
  if (v.reader === "developer") {
    out.push(["Missing inputs", (v.missing || []).join("; ")]);
    if (v.schedule && v.schedule.length) {
      out.push(["month", "cost", "sales", "equity in", "loan draw", "interest", "loan repaid", "loan balance", "distribution"]);
      for (const r of v.schedule) out.push([r.t, Math.round(r.cost), Math.round(r.revenue), Math.round(r.equityIn), Math.round(r.draw), Math.round(r.interest), Math.round(r.repay), Math.round(r.close), Math.round(r.distribution)]);
    }
  }
  return out.map(rowCsv).join("\r\n") + "\r\n";
}
