// Provenance: every input can carry where it came from; every result carries its formula id, its inputs and the engine version.
// A material input that is missing makes the result PRELIMINARY. Nothing is ever silently defaulted.

export const ENGINE_VERSION = "NFE-1.0.0 (2026-11-04)";
export const DISCLAIMER =
  "Automated estimate aligned with RICS and IVS methods; not a certified valuation. Not for lending, purchase or sale decisions without review by a qualified valuer.";

// An input is a plain number or { value, unit, basis, source, date, confidence, observed, override }.
export function inp(value, meta = {}) {
  return { value, unit: meta.unit ?? null, basis: meta.basis ?? null, source: meta.source ?? null, date: meta.date ?? null,
    confidence: meta.confidence ?? null, observed: meta.observed ?? false, override: meta.override ?? null };
}
export const isInput = (x) => x !== null && typeof x === "object" && "value" in x;
export const val = (x) => (isInput(x) ? x.value : x);
export const present = (x) => { const v = val(x); return typeof v === "number" && Number.isFinite(v); };

function describe(name, x) {
  if (isInput(x)) return { name, ...x };
  return { name, value: x ?? null, unit: null, source: null, date: null, confidence: null, observed: false, override: null };
}

// Build a result. inputs = { name: inputOrNumber }. material = names that must be present.
export function result(formulaId, value, inputs = {}, opts = {}) {
  const material = opts.material ?? Object.keys(inputs);
  const missing = material.filter((k) => !present(inputs[k]));
  const list = Object.entries(inputs).map(([k, x]) => describe(k, x));
  const assumed = list.filter((i) => present(i.value) && !i.observed).map((i) => i.name);
  const status = missing.length ? "preliminary" : assumed.length ? "estimate" : "observed-inputs";
  return {
    formula_id: formulaId, formula: opts.formula ?? null, value: missing.length ? null : value,
    unit: opts.unit ?? null, status, missing_inputs: missing, assumed_inputs: assumed,
    inputs: list, flags: opts.flags ?? [], engine_version: ENGINE_VERSION, note: DISCLAIMER,
  };
}

// Throw-free guard used by engines before computing: returns the list of missing material inputs.
export const missingOf = (inputs, names) => names.filter((k) => !present(inputs[k]));
