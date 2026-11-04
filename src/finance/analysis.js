// Breakevens, sensitivity matrices, scenarios, and Engine 6 highest and best use (HBU).
import { result } from "./provenance.js";

// Solve f(x) = target by bisection on [lo, hi]; f must be monotonic there.
export function solve(f, target, lo, hi, tol = 1e-9) {
  let flo = f(lo) - target, fhi = f(hi) - target;
  if (Math.sign(flo) === Math.sign(fhi)) return null;
  for (let i = 0; i < 300 && hi - lo > tol * Math.max(1, Math.abs(hi)); i++) {
    const m = (lo + hi) / 2, fm = f(m) - target;
    if (Math.sign(fm) === Math.sign(flo)) { lo = m; flo = fm; } else hi = m;
  }
  return (lo + hi) / 2;
}

const clone = (o) => JSON.parse(JSON.stringify(o));
export function setPath(obj, path, fn) {
  const o = clone(obj), ks = path.split("."); let cur = o;
  for (let i = 0; i < ks.length - 1; i++) cur = cur[ks[i]];
  const k = ks[ks.length - 1], old = cur[k];
  if (old && typeof old === "object" && "value" in old) cur[k] = { ...old, value: fn(old.value), override: "sensitivity" };
  else cur[k] = fn(old);
  return o;
}

// Two-way sensitivity matrix. model(case) -> number. x/y = { path, values, mode: 'multiply'|'add'|'set' }
export function matrix(model, base, x, y) {
  const ap = (mode, v) => (mode === "add" ? (o) => o + v : mode === "set" ? () => v : (o) => o * v);
  return {
    x: x.path, y: y.path, xValues: x.values, yValues: y.values,
    cells: y.values.map((yv) => x.values.map((xv) => model(setPath(setPath(base, x.path, ap(x.mode, xv)), y.path, ap(y.mode, yv))))),
  };
}

// Downside / base / upside. Each scenario is a list of { path, mode, value } overrides applied to the base case.
export function scenarios(model, base, defs) {
  const ap = (mode, v) => (mode === "add" ? (o) => o + v : mode === "set" ? () => v : (o) => o * v);
  const out = {};
  for (const name of ["downside", "base", "upside"]) {
    if (!defs[name] && name !== "base") throw new Error(`scenarios: '${name}' must be defined (downside / base / upside always)`);
    let c = base; for (const o of defs[name] || []) c = setPath(c, o.path, ap(o.mode, o.value));
    out[name] = model(c);
  }
  return out;
}

// HBU. alternatives: [{ name, legallyPermissible: {ok, verified, evidence}, physicallyPossible: {ok, evidence}, value, valuationDate, basisOfValue, riskNote }]
// value = residual land value (or existing-use value for 'hold existing'), all on ONE basis of value and ONE valuation date.
export function hbu(alternatives) {
  const dates = new Set(alternatives.map((a) => a.valuationDate)), bases = new Set(alternatives.map((a) => a.basisOfValue));
  if (dates.size > 1 || bases.size > 1) throw new Error("HBU: alternatives must share one basis of value and one valuation date");
  const flags = [];
  const tested = alternatives.map((a) => {
    const legal = !!a.legallyPermissible?.ok, physical = !!a.physicallyPossible?.ok, feasible = Number.isFinite(a.value) && a.value > 0;
    if (legal && !a.legallyPermissible.verified) flags.push(`${a.name}: legal permissibility ASSUMED, not verified against the plot's entitlements`);
    return { ...a, tests: { legallyPermissible: legal, physicallyPossible: physical, financiallyFeasible: feasible }, passes: legal && physical && feasible };
  });
  const passing = tested.filter((a) => a.passes).sort((p, q) => q.value - p.value);
  const winner = passing[0] ?? null;
  tested.forEach((a) => { a.tests.maximallyProductive = a === winner; });
  const r = result("HBU.FOUR_TESTS", winner ? winner.value : null, { alternatives: alternatives.length }, {
    formula: "HBU = legally permissible, physically possible, financially feasible alternative with the highest supportable land/asset value (not the biggest GDV or IRR)",
    flags, material: [] });
  if (!winner) { r.status = "preliminary"; r.flags.push("NO_FEASIBLE_ALTERNATIVE"); }
  else if (flags.length) r.status = "preliminary";
  r.winner = winner?.name ?? null; r.alternatives = tested;
  return r;
}
