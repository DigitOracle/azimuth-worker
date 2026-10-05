// v351 - the arithmetic behind pages 3 and 5 of the investor PDF. Pure functions: no I/O, no clock, nothing assumed that is not passed in.
//
// 1. irr(cashflows): the rate that makes the net present value of yearly cash flows zero (t0 first), found by bisection (no starting guess, cannot diverge).
// 2. backtest(rec, area): the HISTORICAL back-test. For each five-year window the register covers for this developer in this area (else for the area):
//      t0      = minus the median price per sq ft of the first year x 1.04  (the Dubai Land Department transfer fee, a published fixed 4%; no other cost)
//      t1..t5  = that year's median annual rent per sq ft  minus  the register service charge per sq ft (held at today's budget for every year; if the register holds
//                none for the pair the figure is "before service charges" and says so)
//      t5     += the median price per sq ft of the fifth year (the exit)
//    No vacancy, no management fee, no selling cost. A window is used only when the first and fifth year have 30+ sales and each of the five rent years has 30+ contracts;
//    windows with an incomplete rent series are skipped and counted. Past windows only: this is not a forecast and no future figure comes out of it.
// 3. replay(rec, area, dubai): the slowest, middle and fastest rolling five-year change in the median price per sq ft that the register shows.
// 4. scenario(...): a stated-assumptions scenario for page 5 (assumptions in, cash flows and IRR out). Every assumed number is passed in and printed as an assumption.
export const TRANSFER_FEE = 0.04;       // Dubai Land Department registration fee on a sale: a published fixed percentage
export const MIN_N = 30;

export function npv(rate, cfs) { let v = 0; for (let t = 0; t < cfs.length; t++) v += cfs[t] / Math.pow(1 + rate, t); return v; }
export function irr(cfs) {
  if (!cfs || cfs.length < 2 || !cfs.every(Number.isFinite)) return null;
  let lo = -0.9999, hi = 10, flo = npv(lo, cfs), fhi = npv(hi, cfs);
  if (!(flo * fhi < 0)) return null;
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2, fm = npv(mid, cfs); if ((fm < 0) === (flo < 0)) { lo = mid; flo = fm; } else { hi = mid; fhi = fm; } if (hi - lo < 1e-12) break; }
  return (lo + hi) / 2;
}

const num = (x) => (typeof x === "number" && isFinite(x) ? x : null);
const yearsOf = (o) => Object.keys(o || {}).map(Number).filter((y) => isFinite(y)).sort((a, b) => a - b);

// one level (the developer's own series, or the area's)
function windowsFor(src, svcPsf, lastFull) {
  const py = src.price_y || {}, ry = src.rent_y || {}, out = [], skipped = [];
  for (const s of yearsOf(py)) {
    const e = s + 5;
    if (e > lastFull || !py[s] || !py[e] || py[s][0] < MIN_N || py[e][0] < MIN_N) continue;
    const rents = [];
    for (let y = s + 1; y <= e; y++) { const r = ry[y]; rents.push(r && r.n >= MIN_N && num(r.psf) ? r.psf : null); }
    if (rents.some((x) => x == null)) { skipped.push(s); continue; }
    const p0 = py[s][1], exit = py[e][1], fee = p0 * TRANSFER_FEE, svc = svcPsf || 0;
    const income = rents.map((r) => r - svc), cfs = [-(p0 + fee)].concat(income); cfs[5] += exit;
    out.push({ from: s, to: e, p0, fee, exit, rents, svc, income, cfs, irr: irr(cfs) });
  }
  return { windows: out, skipped };
}
export function backtest(rec, area, lastFull) {
  const svc = rec && rec.svc && rec.svc.n > 0 && num(rec.svc.median) ? rec.svc.median : null;
  const dev = windowsFor(rec || {}, svc, lastFull);
  let level = "developer", W = dev;
  if (!dev.windows.length) { W = windowsFor(area || {}, null, lastFull); level = "area"; }   // the area's service charge is not held per area: before service charges
  const windows = W.windows.filter((w) => w.irr != null).sort((a, b) => a.irr - b.irr);
  const pick = windows.length >= 3 ? [windows[0], windows[Math.floor(windows.length / 2)], windows[windows.length - 1]] : windows.slice();
  return { level, svcKnown: level === "developer" && svc != null, svc: level === "developer" ? svc : null, windows, pick, skipped: W.skipped, count: windows.length };
}

export function replay(rec, area, dubai) {
  const mk = (arr, scope) => { const w = (arr || []).filter((x) => num(x.change) != null).slice().sort((a, b) => a.change - b.change); return w.length >= 3 ? { scope, windows: w, slow: w[0], mid: w[Math.floor(w.length / 2)], fast: w[w.length - 1] } : null; };
  return mk(rec && rec.replay, "developer") || mk(area && area.replay, "area") || mk(dubai && dubai.replay, "dubai");
}

// ---- page 5: a scenario on stated assumptions. a = { price, feeTransfer, feeOther, rent0, rentGrowth, svc, vacancy, mgmt, growth, years, sellCost }
export function scenario(a) {
  const n = a.years || 5, cfs = [], rows = [];
  const cash0 = a.price * (1 + a.feeTransfer + a.feeOther);
  cfs.push(-cash0);
  let cum = 0;
  for (let t = 1; t <= n; t++) {
    const rent = a.rent0 * Math.pow(1 + a.rentGrowth, t - 1), vac = rent * a.vacancy, mg = rent * a.mgmt, sv = a.svc || 0;
    const net = rent - vac - mg - sv; cum += net;
    rows.push({ year: t, rent, vac, mg, sv, net });
    cfs.push(net);
  }
  const exitGross = a.price * Math.pow(1 + a.growth, n), exitNet = exitGross * (1 - a.sellCost);
  cfs[n] += exitNet;
  return { cash0, rows, cum, exitGross, exitNet, cfs, irr: irr(cfs), cashOnCash1: rows[0].net / cash0, netYield1: rows[0].net / a.price };
}
export const annual = (change, years) => Math.pow(1 + change, 1 / (years || 5)) - 1;
