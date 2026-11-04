// Cost plan: lines with quantity x rate, benchmark metadata, escalation applied ONCE, contingency with no overlap, fees.
import { result, val } from "./provenance.js";

export const BENCHMARK_FIELDS = ["currency", "location", "base_date", "measurement_basis", "scope_included", "scope_excluded", "building_type", "source"];

export function checkBenchmark(b) {
  const missing = BENCHMARK_FIELDS.filter((k) => b?.[k] == null || b[k] === "");
  return { ok: missing.length === 0, missing };
}

// line = { code, element, quantity, unit, rate, benchmark?, specificRiskAllowance?, escalated? }
export function lineAmount(line) {
  if (line.amount != null) return val(line.amount);
  return val(line.quantity) * val(line.rate);
}

// Escalation: from the benchmark base date to the mid-point of construction, compounded annually.
// A line already escalated is never escalated again (throws).
export function escalate(lines, { annualRate, years }) {
  if (!Number.isFinite(annualRate) || !Number.isFinite(years)) throw new Error("escalate needs annualRate and years");
  return lines.map((l) => {
    if (l.escalated) throw new Error(`cost line ${l.code} already escalated: escalation is never applied twice`);
    const f = Math.pow(1 + annualRate, years);
    return { ...l, amount: lineAmount(l) * f, escalated: { annualRate, years, factor: f } };
  });
}

// Contingency on the base cost EXCLUDING lines that already carry their own specific risk allowance (no overlap).
export function contingency(lines, rate) {
  const base = lines.filter((l) => !l.specificRiskAllowance).reduce((s, l) => s + lineAmount(l), 0);
  const excluded = lines.filter((l) => l.specificRiskAllowance).map((l) => l.code);
  return result("COST.CONTINGENCY", base * val(rate), { contingencyRate: rate }, {
    formula: "contingency = rate x (cost lines without a specific risk allowance)", flags: excluded.length ? [`excluded (own risk allowance): ${excluded.join(", ")}`] : [],
  });
}

export function fees(constructionCost, rate) {
  return result("COST.FEES", val(constructionCost) * val(rate), { constructionCost, feeRate: rate }, { formula: "professional fees = rate x construction cost" });
}

export function costPlanTotal(lines) {
  const warnings = [];
  for (const l of lines) if (l.benchmark) { const c = checkBenchmark(l.benchmark); if (!c.ok) warnings.push(`${l.code}: benchmark missing ${c.missing.join(", ")}`); }
  const total = lines.reduce((s, l) => s + lineAmount(l), 0);
  return result("COST.PLAN_TOTAL", total, { total }, { formula: "sum of cost lines", flags: warnings });
}
