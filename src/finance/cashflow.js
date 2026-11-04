// Monthly cash-flow builder and funding (equity first, then debt; interest on the actual drawn balance, rolled up).
import { nominalAnnualToMonthly } from "./units.js";

function weights(n, profile) {
  if (n <= 1) return [1];
  let w;
  if (profile === "scurve") w = Array.from({ length: n }, (_, i) => Math.pow(Math.sin((Math.PI * (i + 0.5)) / n), 2));
  else w = Array(n).fill(1);
  const s = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / s);
}

// lines: [{ name, amount, start, end, profile: 'even'|'scurve', kind: 'cost'|'revenue' }]  months = number of periods (0..months-1)
export function buildCashflow({ months, lines }) {
  const cost = Array(months).fill(0), revenue = Array(months).fill(0), byLine = {};
  for (const l of lines) {
    if (l.end >= months || l.start < 0 || l.end < l.start) throw new Error(`cash-flow line ${l.name} outside 0..${months - 1}`);
    const w = weights(l.end - l.start + 1, l.profile), arr = Array(months).fill(0);
    w.forEach((x, i) => { arr[l.start + i] = l.amount * x; });
    byLine[l.name] = arr;
    const tgt = l.kind === "revenue" ? revenue : cost;
    arr.forEach((x, i) => { tgt[i] += x; });
  }
  return { months, cost, revenue, byLine, net: revenue.map((r, i) => r - cost[i]) };
}

// fund: equity (a committed amount, must be given explicitly; 0 allowed) goes in first, then debt up to maxDebt.
// debt = { annualRate (nominal, monthly compounding), maxDebt }. Interest is charged on the opening balance and capitalised.
export function fund({ costs, revenue, equity, debt }) {
  if (!Number.isFinite(equity)) throw new Error("fund: equity commitment must be stated (use 0 for fully debt funded)");
  const rm = debt ? nominalAnnualToMonthly(debt.annualRate) : 0, maxDebt = debt ? debt.maxDebt ?? Infinity : 0;
  const rows = []; let bal = 0, eqLeft = equity; const flags = [];
  for (let t = 0; t < costs.length; t++) {
    const open = bal, interest = open * rm; bal += interest;
    let need = costs[t] - revenue[t], equityIn = 0, draw = 0, repay = 0, distribution = 0, shortfall = 0;
    if (need > 0) {
      equityIn = Math.min(need, eqLeft); eqLeft -= equityIn; need -= equityIn;
      draw = Math.min(need, Math.max(0, maxDebt - bal)); bal += draw; need -= draw;
      if (need > 1e-9) { shortfall = need; equityIn += need; }
    } else {
      const cash = -need; repay = Math.min(cash, bal); bal -= repay; distribution = cash - repay;
    }
    if (shortfall) flags.push(`FUNDING_SHORTFALL month ${t}: ${shortfall.toFixed(0)} of extra equity needed beyond the commitment and debt limit`);
    rows.push({ t, cost: costs[t], revenue: revenue[t], open, interest, draw, repay, close: bal, equityIn, distribution, shortfall });
  }
  if (bal > 1e-6) flags.push(`DEBT_NOT_REPAID: ${bal.toFixed(0)} outstanding at the end of the cash flow`);
  const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
  const totals = { interest: sum("interest"), draws: sum("draw"), repaid: sum("repay"), equityIn: sum("equityIn"), distributions: sum("distribution"), closingDebt: bal,
    peakDebt: Math.max(0, ...rows.map((r) => r.close)) };
  const unlevered = rows.map((r) => r.revenue - r.cost);          // project: no debt draws or debt service
  const levered = rows.map((r) => r.distribution - r.equityIn);   // equity: with them
  let cum = 0, peakEquity = 0; for (const c of levered) { cum += c; peakEquity = Math.max(peakEquity, -cum); }
  return { rows, totals: { ...totals, peakEquity }, unlevered, levered, flags };
}

// Loan balance reconciliation: opening + draws + interest - repayments = closing, every period and in total.
export function reconcile(funding, tol = 1e-6) {
  const bad = funding.rows.filter((r) => Math.abs(r.open + r.interest + r.draw - r.repay - r.close) > tol).map((r) => r.t);
  const T = funding.totals, total = T.draws + T.interest - T.repaid - T.closingDebt;
  return { ok: bad.length === 0 && Math.abs(total) < tol * funding.rows.length, badPeriods: bad, totalGap: total };
}
