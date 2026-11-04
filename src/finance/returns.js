// NPV / IRR / XNPV / XIRR with edge-case handling. An IRR is only reported when exactly one root exists;
// otherwise the NPV and the cash flow take precedence and a flag says why.
import { monthlyToAnnual } from "./units.js";

export function npv(rate, cfs) {
  let v = 0;
  for (let t = 0; t < cfs.length; t++) v += cfs[t] / Math.pow(1 + rate, t);
  return v;
}
export function signChanges(cfs) {
  let n = 0, prev = 0;
  for (const c of cfs) { if (c === 0) continue; const s = Math.sign(c); if (prev && s !== prev) n++; prev = s; }
  return n;
}

// Find every root of f on (lo, hi) by scanning a dense grid and bisecting each bracket.
function roots(f, lo = -0.99, hi = 10, steps = 4000) {
  const out = [];
  let x0 = lo, f0 = f(x0);
  for (let i = 1; i <= steps; i++) {
    // denser near zero, where real-estate rates live
    const u = i / steps, x1 = lo + (hi - lo) * Math.pow(u, 2.5);
    const f1 = f(x1);
    if (f0 === 0) out.push(x0);
    else if (Math.sign(f0) !== Math.sign(f1) && Number.isFinite(f0) && Number.isFinite(f1)) {
      let a = x0, b = x1, fa = f0;
      for (let k = 0; k < 200 && b - a > 1e-14; k++) { const m = (a + b) / 2, fm = f(m); if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm; } else b = m; }
      out.push((a + b) / 2);
    }
    x0 = x1; f0 = f1;
  }
  return out.filter((r, i) => i === 0 || Math.abs(r - out[i - 1]) > 1e-9);
}

function irrOutcome(rs, sc, extra) {
  if (sc === 0) return { irr: null, flag: "NO_IRR", reason: "cash flow never changes sign: no rate makes NPV zero", roots: [], signChanges: 0, ...extra };
  if (rs.length === 0) return { irr: null, flag: "NO_IRR", reason: "no root found between -99% and 1000% per period", roots: [], signChanges: sc, ...extra };
  if (rs.length > 1) return { irr: null, flag: "MULTIPLE_IRR", reason: "more than one rate makes NPV zero: use NPV at a stated discount rate", roots: rs, signChanges: sc, ...extra };
  return { irr: rs[0], flag: null, reason: null, roots: rs, signChanges: sc, ...extra };
}

// Periodic IRR. periodsPerYear 12 for monthly; the annual equivalent is (1+irr_m)^12 - 1.
export function irr(cfs, { periodsPerYear = 1, basis } = {}) {
  if (!basis) throw new Error("irr needs basis: 'unlevered project' or 'levered equity' (an IRR is never reported without saying which)");
  const sc = signChanges(cfs);
  const o = irrOutcome(sc ? roots((r) => npv(r, cfs)) : [], sc, { basis, periodsPerYear });
  o.irrAnnual = o.irr == null ? null : periodsPerYear === 12 ? monthlyToAnnual(o.irr) : Math.pow(1 + o.irr, periodsPerYear) - 1;
  return o;
}

const DAY = 86400000;
const toDate = (d) => (d instanceof Date ? d : new Date(d + "T00:00:00Z"));
export function xnpv(rate, cfs, dates) {
  const d0 = toDate(dates[0]).getTime();
  return cfs.reduce((s, c, i) => s + c / Math.pow(1 + rate, (toDate(dates[i]).getTime() - d0) / DAY / 365), 0);
}
export function xirr(cfs, dates, { basis } = {}) {
  if (!basis) throw new Error("xirr needs basis: 'unlevered project' or 'levered equity'");
  if (cfs.length !== dates.length) throw new Error("xirr: cash flows and dates differ in length");
  const sc = signChanges(cfs);
  const o = irrOutcome(sc ? roots((r) => xnpv(r, cfs, dates)) : [], sc, { basis });
  o.irrAnnual = o.irr; // XIRR is already an annual effective rate
  return o;
}

// Payback: first period in which cumulative (optionally discounted) cash flow turns non-negative and stays so.
export function payback(cfs, rate = null) {
  let cum = 0, last = null;
  for (let t = 0; t < cfs.length; t++) {
    cum += rate == null ? cfs[t] : cfs[t] / Math.pow(1 + rate, t);
    if (cum >= 0 && last === null) last = t; else if (cum < 0) last = null;
  }
  return last;
}
