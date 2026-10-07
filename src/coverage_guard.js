// v394 (Kendall, 7 Oct 2026): a filter on a field the data mostly does not carry must never print a false zero.
// The Ejari FILED feed has no bedroom count for almost every contract (0.3% known in Business Bay), so "1 bedroom" on that
// basis left nothing and the page said "signed 0 contracts". Any page can ask coverageOf(rows, field) how much of the data
// knows a field, and offer the filter only when the share is at least COVERAGE_MIN.
// Pure and offline: no imports, no clock, no KV. The completeness gate (branch completeness-v393) can reuse it as is.

export const COVERAGE_MIN = 0.5;   // below this share of contracts with the field known, the filter is not offered

const known = (v) => v !== undefined && v !== null && v !== false && !(typeof v === "string" && v.trim() === "");

// The share (0..1) of rows whose `field` is known. A row counts for its `n` (contracts) when it has one, else for 1.
// null when there are no contracts at all (nothing to measure). `field` is a property name or a function of the row.
export function coverageOf(rows, field) {
  let total = 0, got = 0;
  for (const r of rows || []) {
    if (!r) continue;
    const w = typeof r.n === "number" && isFinite(r.n) && r.n >= 0 ? r.n : 1;
    total += w;
    if (known(typeof field === "function" ? field(r) : r[field])) got += w;
  }
  return total > 0 ? got / total : null;
}

// true when the field is known for enough of the rows to filter on (an empty set is not a reason to switch a filter off)
export const coverageOk = (rows, field, min) => { const c = coverageOf(rows, field); return c === null || c >= (min == null ? COVERAGE_MIN : min); };

// "0.3%", "4.7%", "58%": one decimal under 10%, none above, and never "0%" for something above zero
export function pctSay(share) {
  if (share == null || !isFinite(share)) return "";
  const p = share * 100;
  if (p <= 0) return "0%";
  if (p < 0.05) return "under 0.1%";
  return (p < 10 ? String(Math.round(p * 10) / 10) : String(Math.round(p))) + "%";
}
