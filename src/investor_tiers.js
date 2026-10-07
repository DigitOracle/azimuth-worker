// v376 - THE TIERED INVESTOR REPORT: pure logic (no I/O, no clock). Kendall's brief, 7 Oct 2026.
//   LOCKED CORE  shown in every version, not switchable by anyone: the registered developer and its delivery record; status and handover date; sales so far, stated plainly (zero too);
//                price, payment plan (developer says) and sourceable fees; and a last page, what this report cannot tell you. An unknown core fact is said in one line with its reason.
//   SEGMENTS     config/investor_segments.json (via the generated module). Each makes claims; each claim has a deterministic rule (RULES below) that BLOCKS the segment or ANNOTATES it with the
//                contrary fact, from the project's own evidence. The selector shows why. No forecasts anywhere.
//   TIERS        summary, standard, full: depth, not truth.   PRESETS  config/investor_presets.json: a tier and segments only; a preset that touches the core is rejected.
import { SEGMENTS_CONFIG, PRESETS_CONFIG, STATS_CONFIG } from "./investor_config.generated.js";

export const VERSION = 376;
export const TIERS = ["summary", "standard", "full"];
export const CORE_IDS = ["developer", "delivery", "status", "sales", "price_plan", "cannot_tell"];
export const LABEL_TEXT = {
  REGISTER_VERIFIED: "confirmed by the Dubai Land Department register",
  NAME_ONLY: "matched by name only, not confirmed by the register",
  DEVELOPER_CLAIMED: "developer says (the register has no record of it)",
  UNVERIFIED: "not confirmed",
};
export const THRESHOLDS = SEGMENTS_CONFIG.thresholds;
export const SEGMENTS = SEGMENTS_CONFIG.segments;
const SEG_BY_ID = Object.fromEntries(SEGMENTS.map((s) => [s.id, s]));

// ---------------------------------------------------------------------------------------------------------- small helpers
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function dateLong(x) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(x || "")); return m ? Number(m[3]) + " " + MONTHS[Number(m[2]) - 1] + " " + m[1] : ""; }
export const fmt = (n) => (n == null || !isFinite(n) ? "" : Math.round(n).toLocaleString("en-US"));
export const aed = (n) => "AED " + fmt(n);
const plural = (n, one, many) => fmt(n) + " " + (n === 1 ? one : many || one + "s");
const BEDS = { "Studio": "Studio", "1 B/R": "1 bedroom", "2 B/R": "2 bedrooms", "3 B/R": "3 bedrooms", "4 B/R": "4 bedrooms", "5 B/R": "5 bedrooms" };
export const bedsWord = (b) => BEDS[b] || String(b);

// ---------------------------------------------------------------------------------------------------------- presets (config) and their validation
const PRESET_KEYS = ["id", "group", "title", "blurb", "tier", "status", "needs_check", "segments", "full_sections", "stats"];
const NATIONALITY_RX = /nationalit|indian|british|\buk\b|russian|chinese|saudi|pakistan|egypt|australian|italian|african|levant|\bcis\b/i;
export const DROPPED_TYPES = PRESETS_CONFIG.dropped_types || [];
export const BANNED_STAT_STATUS = /SNIPPET|NO SOURCE|NOT IN OUR DATA/i;
export const STATS = STATS_CONFIG.stats || [];
export function validateStats(list) {
  const errs = [], seen = new Set();
  for (const t of list || []) {
    if (!t.id || seen.has(t.id)) errs.push("stat id missing or duplicate: " + t.id);
    seen.add(t.id);
    if (!t.source || !/^\d{4}(-\d{2})?(-\d{2})?$/.test(String(t.date || ""))) errs.push("stat " + t.id + " has no source or no date");
    if (!["PUBLISHED", "OUR DATA"].includes(t.status) || BANNED_STAT_STATUS.test(String(t.status))) errs.push("stat " + t.id + " has status " + t.status + ", which may not be printed");
    if (!t.figure) errs.push("stat " + t.id + " has no figure");
  }
  return errs;
}
const CORE_WORDS = /core|omit|drop|hide|exclude|disable|remove|skip|off/i;
export function validatePreset(p, segIds, statIds) {
  const errs = [], ids = segIds || SEGMENTS.map((s) => s.id), sids = statIds || STATS.map((t) => t.id);
  if (!p || typeof p !== "object") return ["not an object"];
  for (const k of Object.keys(p)) {
    if (!PRESET_KEYS.includes(k)) errs.push(CORE_WORDS.test(k) ? "key '" + k + "' tries to switch off the locked core, which nobody can do" : "unknown key '" + k + "'");
  }
  if (!/^[a-z0-9_]+$/.test(String(p.id || ""))) errs.push("id missing or not simple");
  if (DROPPED_TYPES.includes(p.id)) errs.push("type '" + p.id + "' has been dropped from the taxonomy");
  if (NATIONALITY_RX.test(String(p.id || "") + " " + String(p.title || ""))) errs.push("a type may not be defined by nationality (nationality may pick the language only)");
  if (p.status != null && !["ready", "draft"].includes(p.status)) errs.push("status must be ready or draft");
  if (p.status === "draft" && !p.needs_check) errs.push("a draft preset must say what needs an official check");
  for (const t of p.stats || []) if (!sids.includes(t)) errs.push("unknown stat '" + t + "'");
  for (const t of p.full_sections || []) if (!(p.segments || []).includes(t)) errs.push("full section '" + t + "' is not one of the segments");
  if (!["investment", "end_user"].includes(p.group)) errs.push("group must be investment or end_user");
  if (!TIERS.includes(p.tier)) errs.push("tier must be summary, standard or full");
  if (!Array.isArray(p.segments)) errs.push("segments must be a list");
  else for (const s of p.segments) {
    if (CORE_IDS.includes(s) || /^core/i.test(String(s))) errs.push("segment '" + s + "' names a locked core item, which cannot be chosen or dropped");
    else if (!ids.includes(s)) errs.push("unknown segment '" + s + "'");
  }
  return errs;
}
// loadPresets fails closed: one bad preset rejects the whole file
export function loadPresets(cfg) {
  const list = (cfg && cfg.presets) || [], errors = [], seen = new Set();
  for (const p of list) {
    const e = validatePreset(p);
    if (seen.has(p && p.id)) e.push("duplicate id");
    seen.add(p && p.id);
    if (e.length) errors.push({ id: p && p.id, errors: e });
  }
  if (errors.length) { const err = new Error("preset config rejected: " + errors.map((x) => x.id + ": " + x.errors.join("; ")).join(" | ")); err.errors = errors; throw err; }
  return list;
}
export const PRESETS = loadPresets(PRESETS_CONFIG);
{
  const e = validateStats(STATS); if (e.length) throw new Error("stats config rejected: " + e.join("; "));
  for (const sg of SEGMENTS) for (const t of sg.stats || []) if (!STATS.some((x) => x.id === t)) throw new Error("segment " + sg.id + " names unknown stat " + t);
}
export const RULE_CARDS = PRESETS_CONFIG.rule_cards || {};
export const ORDER_FLAGS = PRESETS_CONFIG.order_flags || [];
export const validAssignmentCard = (c) => !!(c && c.text && c.source && c.url && /^\d{4}-\d{2}-\d{2}$/.test(String(c.as_of || "")));
const planOf = (f) => (f.price_plan && f.price_plan.payment_plan && typeof f.price_plan.payment_plan === "object" ? f.price_plan.payment_plan : null);
export const validRuleCard = (c) => !!(c && c.text && c.source && c.url && /^\d{4}-\d{2}-\d{2}$/.test(String(c.as_of || "")) && c.threshold_aed > 0);
const PRESET_BY_ID = Object.fromEntries(PRESETS.map((p) => [p.id, p]));

// ---------------------------------------------------------------------------------------------------------- the contradiction rules (one per claim id)
// rule(facts, th) -> { ok, action: "block" | "annotate", reason, contrary }. ok=true means the claim is supported by the project's own evidence.
const solidPeriods = (facts, th) => (facts.sales && facts.sales.by_year || []).filter((r) => r.n >= th.period_min_sales);
const hasPartialYear = (facts) => { const a = String(facts.as_of && facts.as_of.sales || ""); return a && !/-12-31$/.test(a) ? Number(a.slice(0, 4)) : null; };
export const RULES = {
  strong_sales: (f, th) => { const n = f.sales ? f.sales.l12 : 0; return n >= th.strong_sales_min_l12 ? { ok: true } : { ok: false, action: "block", reason: "Registered sales in the last 12 months: " + fmt(n) + ". Wording about demand or strong sales needs " + th.strong_sales_min_l12 + " or more.", contrary: "Registered sales in the last 12 months: " + fmt(n) + "." }; },
  yield_estimate: (f, th) => { const n = f.rents ? f.rents.project_contracts : 0; return n >= th.yield_min_contracts ? { ok: true } : { ok: false, action: "block", reason: "Rent contracts behind a yield for this project: " + fmt(n) + ". An estimate needs " + th.yield_min_contracts + " or more.", contrary: "Rent contracts for this project: " + fmt(n) + "." }; },
  on_track: (f) => { const s = f.status; if (s && (s.code === "FINISHED" || (s.code === "ACTIVE" && s.percent > 0))) return { ok: true }; return { ok: false, action: "annotate", reason: "No progress evidence for an on-track statement.", contrary: "Register status: " + (s ? s.text.toLowerCase() + ", " + Math.round(s.percent) + "% complete" : "not available") + ". The register records status; it does not say whether a project is on schedule, so this report does not say it." }; },
  area_history: (f) => ((f.market && f.market.area_by_year || []).length ? { ok: true } : { ok: false, action: "block", reason: "No registered sales by year for this area.", contrary: "" }),
  price_vs_peers: (f, th) => { const n = (f.comparables || []).length; return n >= th.peers_min ? { ok: true } : { ok: false, action: "block", reason: "Comparable projects with enough sales: " + n + ". A comparison needs " + th.peers_min + " or more.", contrary: "" }; },
  near_to: (f) => ((f.neighbourhood || []).length ? { ok: false, action: "annotate", reason: "", contrary: "These are the nearest places as recorded on the sales register, in a straight line. They are not travel times." } : { ok: false, action: "block", reason: "No nearby places are recorded for this project.", contrary: "" }),
  price_trend: (f, th) => {
    const n = solidPeriods(f, th).length;
    if (n < th.price_trend_min_solid_periods) return { ok: false, action: "block", reason: "Years with " + th.period_min_sales + " or more sales: " + n + ". A price chart needs " + th.price_trend_min_solid_periods + ".", contrary: "" };
    const py = hasPartialYear(f);
    return py && solidPeriods(f, th).some((r) => r.year === py) ? { ok: false, action: "annotate", reason: "", contrary: py + " is part of a year, to " + dateLong(f.as_of.sales) + ". Compare it with a full year only with care." } : { ok: true };
  },
  developer_reliable: (f) => {
    const e = f.delivery && f.delivery.entity, fin = e && e.by_status ? e.by_status.FINISHED || 0 : 0;
    return fin > 0 ? { ok: true } : { ok: false, action: "annotate", reason: "", contrary: "The registered company, " + (f.developer ? f.developer.legal_entity : "unknown") + ", has completed no project of its own on the register. Any wider record belongs to other registered companies matched by name." };
  },
  residency_rule: (f) => { const c = (f.rule_cards && f.rule_cards.golden_visa) || RULE_CARDS.golden_visa; return validRuleCard(c) ? { ok: true } : { ok: false, action: "annotate", reason: "", contrary: "No dated official rule card is on file, so this report states no residency rule, threshold or eligibility. Whether any purchase qualifies is decided by the authority." }; },
  cash_needed: (f) => { const pl = planOf(f), X = f.sales; return pl && pl.milestones && pl.milestones.length && X && X.median_price > 0 ? { ok: true } : { ok: false, action: "block", reason: "A cash figure needs both a payment plan and a price. Payment plan on file: " + (pl ? "yes" : "no") + ". Registered price: " + (X && X.median_price > 0 ? "yes" : "no") + ".", contrary: "" }; },
  strong_resale: (f, th) => { const R = f.resales; if (R && R.separable && R.resale_l12 >= th.strong_sales_min_l12) return { ok: true }; return { ok: false, action: "annotate", reason: "", contrary: R ? (R.separable ? "Registered resales in the last 12 months: " + fmt(R.resale_l12) + ", under the " + th.strong_sales_min_l12 + " this report needs before it describes resale as strong." : "The register does not separate a first sale from a resale for this project, so no resale count is known and resale is not described as strong.") : "No resale information is held for this project." }; },
  assignment_rule: (f) => { const c = (f.rule_cards && f.rule_cards.assignment) || RULE_CARDS.assignment; return validAssignmentCard(c) ? { ok: true } : { ok: false, action: "annotate", reason: "", contrary: "No dated official rule card is on file. The conditions for resale before handover differ by developer and must be confirmed with the developer and the Dubai Land Department; this report states no rule, minimum-paid threshold, fee or no-objection requirement." }; },
  claim_label: () => ({ ok: false, action: "annotate", reason: "", contrary: "Developer says. This comes from the developer, not from the Dubai Land Department register." }),
};
// data a segment needs before it can be drawn at all (not a contradiction: the data is simply not held)
const NEEDS = {
  delivery_progress: (f) => (f.status ? "" : "no registered project status"),
  developer_detail: (f) => (f.developer && f.developer.legal_entity && f.delivery ? "" : "no registered developer or delivery record"),
  demand_momentum: (f) => (f.sales ? "" : "the sales register could not be checked"),
  price_charts: (f) => (f.sales && f.sales.by_year && f.sales.by_year.length ? "" : "no registered sales by year for this project"),
  market_history: (f) => (f.market && f.market.area_by_year && f.market.area_by_year.length ? "" : "no registered sales by year for this area"),
  comparables: (f) => (f.comparables && f.comparables.length ? "" : "no comparable projects with enough sales"),
  yield_rent: (f) => (f.rents ? "" : "no rent register figures"),
  area_story: (f) => (f.neighbourhood && f.neighbourhood.length ? "" : "no nearby places recorded for this project"),
  residency_rule: (f) => (f.sales ? "" : "the sales register could not be checked"),
  resale_activity: (f) => (f.resales ? "" : "no resale figures held"),
  amenities: (f) => (f.amenities && f.amenities.length ? "" : (f.amenities_reason || "no developer source on file")),
  supply_nearby: (f) => (f.supply && Object.keys(f.supply).length ? "" : "no project-register supply figures for this area"),
  unit_mix_prices: (f) => (f.sales && f.sales.by_beds && f.sales.by_beds.length ? "" : "no registered sales by home size"),
  payment_plan_cash: (f) => (planOf(f) ? "" : (f.price_plan && f.price_plan.payment_plan_reason ? "no payment plan on file, because " + f.price_plan.payment_plan_reason : "no payment plan on file")),
  buyer_protections: (f) => (f.status && f.developer ? "" : "no registered project or developer to describe"),
  city_context: (f) => (f.city ? "" : "no Dubai-wide figures held"),
};
export function checkSegments(facts, th) {
  const T = th || THRESHOLDS, out = {};
  for (const s of SEGMENTS) {
    const r = { id: s.id, status: "ok", reasons: [], notes: [], claims: {} };
    const miss = (NEEDS[s.id] || (() => ""))(facts);
    if (miss) { r.status = "unavailable"; r.reasons.push("Not available: " + miss + "."); }
    for (const c of s.claims || []) {
      const rule = RULES[c]; if (!rule) throw new Error("segment " + s.id + " claims '" + c + "' but there is no rule for it");
      const v = rule(facts, T);
      r.claims[c] = v.ok ? "supported" : v.action;
      if (v.ok) continue;
      if (v.action === "block") { if (r.status !== "unavailable") r.status = "blocked"; r.reasons.push(v.reason); }
      else { if (r.status === "ok") r.status = "annotated"; r.notes.push(v.contrary); }
    }
    out[s.id] = r;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------- the locked core
const winText = (f) => dateLong(f.window.from) + " to " + dateLong(f.window.to);
export function buildCore(f) {
  const items = [], D = f.developer, S = f.status, X = f.sales, P = f.price_plan, DL = f.delivery;
  // 1 developer
  if (!D || !D.legal_entity) items.push({ id: "developer", title: "Who is the registered developer", icon: "buildings", known: false, label: "UNVERIFIED", lines: ["Registered developer: not on the register yet" + (D && D.reason ? ". " + D.reason : ", so the company behind the brand cannot be named from the register") + "."] });
  else {
    const lab = D.evidence || "UNVERIFIED";
    const lines = ["Brand: " + D.brand + ". Registered developer: " + D.legal_entity + " (" + LABEL_TEXT[lab] + (D.basis ? "; " + D.basis : "") + ")."];
    if (D.registered) lines.push("Registered with the Dubai Land Department on " + dateLong(D.registered) + (D.licence_number ? "; licence " + D.licence_number + " (" + D.licence_authority + ")" + (D.licence_expires ? ", expires " + dateLong(D.licence_expires) : "") : "") + ".");
    if (D.master_label_not_developer) lines.push(D.master_label_not_developer + ".");
    items.push({ id: "developer", title: "Who is the registered developer", icon: "buildings", known: true, label: lab, lines });
  }
  // 2 delivery record
  if (!DL) items.push({ id: "delivery", title: "The developer's delivery record", icon: "stack", known: false, label: "UNVERIFIED", lines: ["Delivery record: not available" + ", because the project register holds no projects for this developer."] });
  else {
    const e = DL.entity, st = e.by_status || {}, fin = st.FINISHED || 0, parts = Object.keys(st).map((k) => st[k] + " " + ({ NOT_STARTED: "not started", ACTIVE: "under construction", FINISHED: "handed over" }[k] || k.toLowerCase())).join(", ");
    const lines = ["This registered company (register): " + plural(e.projects, "project") + " (" + parts + ")" + (fin === 0 ? "; it has handed over none yet" : "") + "."];
    if (DL.brand_family) lines.push("The " + D.brand + " name across all its registered companies (" + DL.brand_family.matched_by + "): of " + plural(DL.brand_family.past_planned_end, "project") + " past their planned end date, " + fmt(DL.brand_family.registered_finished) + " are registered as handed over. The register records status, not whether a project was early or late.");
    items.push({ id: "delivery", title: "The developer's delivery record", icon: "stack", known: true, label: "REGISTER_VERIFIED", lines });
  }
  // 3 status and handover
  if (!S) items.push({ id: "status", title: "Status and handover date", icon: "ruler", known: false, label: "UNVERIFIED", lines: ["Status and handover date: not on the project register yet, so no registered status or date can be given."] });
  else items.push({ id: "status", title: "Status and handover date", icon: "ruler", known: true, label: "REGISTER_VERIFIED", lines: [
    "Status: " + S.text + ", " + Math.round(S.percent) + "% complete. Construction start on the register: " + dateLong(S.start) + ".",
    S.planned_end ? "Handover date on the register: planned end " + dateLong(S.planned_end) + (S.completion ? ", completed " + dateLong(S.completion) : ", not completed") + "." : "Handover date: the register holds no planned end date.",
    "Source: " + S.source + ", data to " + dateLong(f.as_of.register) + ". " + plural(S.units, "home") + " in " + plural(S.buildings, "building") + (S.escrow ? "; escrow bank " + S.escrow.replace(/\s*\(PUBLIC JOINT STOCK COMPANY\)/i, "") : "") + "." ] });
  // 4 sales
  if (!X) items.push({ id: "sales", title: "Sales so far", icon: "chart-donut", known: false, label: "UNVERIFIED", lines: ["Sales so far: the sales register could not be checked for this project, so no figure is given."] });
  else {
    const lines = [];
    if (X.all_time === 0) lines.push("Registered sales: none. No sale of any home in this project is on the Dubai Land Department register to " + dateLong(f.as_of.sales) + ".");
    else lines.push("Registered sales so far: " + fmt(X.all_time) + ", from " + dateLong(X.first) + " to " + dateLong(X.last) + ". In the last 12 months (" + winText(f) + "): " + fmt(X.l12) + ".");
    if (X.all_time === 0 || X.l12 === 0) lines.push("In the last 12 months (" + winText(f) + "): " + fmt(X.l12) + " registered sales.");
    lines.push("Source: Dubai Land Department sales register to " + dateLong(f.as_of.sales) + ". Homes registered in the project: " + fmt(S ? S.units : 0) + (X.all_time ? "; a home sold twice counts twice" : "") + (X.land_registrations_excluded ? ". " + X.land_registrations_excluded + " land registration excluded." : ".") + (X.all_off_plan && X.all_time ? " All are off-plan sales: the price agreed before the home is built." : ""));
    if (X.phase_two) lines.push("A separate registered project, " + X.phase_two.name + " (project " + X.phase_two.project_number + "), has its own sales (" + fmt(X.phase_two.sales) + "); they are not counted above.");
    items.push({ id: "sales", title: "Sales so far", icon: "chart-donut", known: true, label: "REGISTER_VERIFIED", lines });
  }
  // 5 price, payment plan, fees
  const pl = [];
  if (X && X.all_time) pl.push("Price (registered, off-plan): median " + aed(X.median_price) + " across all sales; " + aed(X.l12_median_price) + " in the last 12 months; " + aed(X.l12_median_psf) + " per sq ft in the last 12 months. These are prices agreed in sales, not today's asking prices.");
  else pl.push("Price: no registered sale to take a price from. Any price must come from the developer.");
  if (P && P.payment_plan) pl.push("Payment plan (developer says): " + (typeof P.payment_plan === "object" ? P.payment_plan.text : P.payment_plan) + ".");
  else pl.push("Payment plan (developer says): not on file, because " + (P && P.payment_plan_reason ? P.payment_plan_reason : "no developer source is held") + ".");
  const fee = P && P.fees && P.fees[0];
  if (fee && X && X.all_time) pl.push("Fees we can source: " + fee.label + ", " + Math.round(fee.rate * 100) + "% of the price (" + fee.source + "), about " + aed(X.median_price * fee.rate) + " at the median price. " + (P.fees_unknown ? "Not held: " + P.fees_unknown + "." : ""));
  else pl.push("Fees we can source: none for this project" + (P && P.fees_unknown ? ". Not held: " + P.fees_unknown : "") + ".");
  items.push({ id: "price_plan", title: "Price, payment plan and fees", icon: "wallet", known: !!(X && X.all_time), label: X && X.all_time ? "REGISTER_VERIFIED" : "UNVERIFIED", lines: pl });
  return items;
}

// ---------------------------------------------------------------------------------------------------------- what this report cannot tell you
export const CANNOT_TELL = [
  ["The future", "What later events, such as wars, pandemics or changes to rules, will do to prices, rents or building schedules. We do not comment on them."],
  ["Which way prices move next", "Every price here is a past registered sale. Past prices do not say what a home could sell for later."],
  ["Rent in the years ahead", "Rent figures, where shown, are contracts already registered. We do not say what rent will be."],
  ["Mortgage terms", "Whether a bank will lend, how much, at what rate and on what conditions."],
  ["Resale", "Whether, when and at what price you could sell, and what the contract and the developer allow before handover."],
  ["Whether the developer finishes", "The registers hold status and dates, not company accounts. We hold no measure of a developer's finances."],
  ["Law, tax and residency", "Whether a purchase qualifies for a visa or any other right, and the tax you would owe. Ask a licensed adviser or the authority."],
  ["Today's price and availability of a home", "Both must be confirmed with the developer."],
  ["Why registered numbers moved", "History appears here only as dated registered numbers. This report gives no reason for any rise or fall."],
];

// ---------------------------------------------------------------------------------------------------------- the plan
export function presetFor(id) { return PRESET_BY_ID[id] || null; }
export function buildPlan({ facts, type, tier, segments, disableCore, flags, lang }) {
  const warnings = [], pre = type ? PRESET_BY_ID[type] : null;
  if (type && !pre) warnings.push("Unknown investor type '" + type + "': no preset applied.");
  const useTier = TIERS.includes(tier) ? tier : (pre ? pre.tier : "standard");
  if (tier && !TIERS.includes(tier)) warnings.push("Unknown tier '" + tier + "': " + useTier + " used.");
  let want = Array.isArray(segments) ? segments.slice() : pre ? pre.segments.slice() : [];
  if (disableCore || want.some((s) => CORE_IDS.includes(s))) warnings.push("The locked core cannot be switched off; it is in every version.");
  want = want.filter((s) => { if (CORE_IDS.includes(s)) return false; if (!SEG_BY_ID[s]) { warnings.push("Unknown segment '" + s + "' ignored."); return false; } return true; });
  const check = checkSegments(facts);
  if (useTier === "full") want = SEGMENTS.map((s) => s.id);
  const rows = SEGMENTS.map((s) => {
    const c = check[s.id], chosen = want.includes(s.id), included = chosen && c.status !== "blocked" && c.status !== "unavailable";
    return { id: s.id, title: s.title, icon: s.icon, evidence: s.evidence, chosen, included, status: c.status, reasons: c.reasons, notes: c.notes, claims: c.claims };
  });
  const fullIds = pre ? pre.full_sections || [] : [];
  rows.forEach((r) => { r.depth = fullIds.includes(r.id) && !Array.isArray(segments) ? "full" : useTier; });
  const inc = rows.filter((r) => r.included), omit = rows.filter((r) => !r.included);
  const statIds = [...new Set(inc.flatMap((r) => SEG_BY_ID[r.id].stats || []).concat(pre ? pre.stats || [] : []))];
  const stats = statIds.map((i) => STATS.find((t) => t.id === i)).filter(Boolean);
  const orderFlags = (flags || []).map((x) => ORDER_FLAGS.find((o) => o.id === x)).filter(Boolean);
  const draft = pre && pre.status === "draft" ? pre.needs_check : null;
  const card = (facts.rule_cards && facts.rule_cards.golden_visa) || RULE_CARDS.golden_visa;
  const core = buildCore(facts);
  const audit = { version: VERSION, project: facts.project.id, project_number: facts.project.project_number, type: type || null, tier: useTier,
    segments: Object.fromEntries(rows.map((r) => [r.id, r.included ? "on" : "off"])),
    check: Object.fromEntries(rows.map((r) => [r.id, { status: r.status, reasons: r.reasons, notes: r.notes, claims: r.claims }])),
    core: core.map((c) => ({ id: c.id, known: c.known, label: c.label })).concat([{ id: "cannot_tell", known: true, label: "n/a" }]),
    as_of: facts.as_of, window: facts.window, warnings, thresholds: THRESHOLDS,
    preset_status: pre ? pre.status : null, draft_note: draft, language: lang || "en", order_flags: orderFlags.map((o) => o.id), stats: stats.map((t) => ({ id: t.id, source: t.source, date: t.date })), golden_visa_rule_card: validRuleCard(card) ? { as_of: card.as_of, source: card.source } : null };
  return { tier: useTier, type: type || null, core, segments: rows, included: inc, omitted: omit, warnings, audit, stats, orderFlags, draft, coverage: coverageLine({ included: inc, omitted: omit }) };
}
export function coverageLine(plan) {
  const t = (r) => r.title.toLowerCase();
  const why = (r) => t(r) + (r.status === "blocked" ? " (blocked: " + r.reasons[0].replace(/\.$/, "") + ")" : r.status === "unavailable" ? " (no data)" : "");
  return "This version covers: the locked core (developer, delivery record, status and handover date, sales so far, price, payment plan and fees, and what this report cannot tell you)" + (plan.included.length ? "; " + plan.included.map(t).join(", ") : "") +
    ". Not covered: " + (plan.omitted.length ? plan.omitted.map(why).join("; ") : "nothing") + ".";
}

// ---------------------------------------------------------------------------------------------------------- guards on the written text
export const EMOJI_RX = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B55}\u{FE0F}\u{200D}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{25A0}-\u{25FF}]/u;
export const FORECAST_RX = /\bquick (profit|win|flip|gain|money)s?\b|\bwill sell\b|\bfast money\b|\bwill (go up|rise|fall|drop|increase|decrease|appreciate|grow|be (late|delayed|early|on time|completed|delivered)|deliver|finish)\b|\b(expected|likely|set|poised|bound) to (rise|fall|grow|increase|appreciate|go up|be (late|delayed))\b|\bprojected (growth|return|yield|price)|\bguaranteed\b|\bis forecast\b/i;
export function lintText(text) {
  const out = []; if (EMOJI_RX.test(text)) out.push("emoji"); const m = FORECAST_RX.exec(text); if (m) out.push("forecast wording: " + m[0]); return out;
}
