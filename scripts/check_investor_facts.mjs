// v379 - the QUALITY GATES for the investor-PDF facts of every project. Offline; reads a folder of shards written by scripts/build_investor_facts.py (or any folder in that layout).
//   node scripts/check_investor_facts.mjs <folder> [--quick N] [--report out.json]
//   (a) every record passes the schema validation (src/investor_facts.js validateFacts) and the index agrees with the shards
//   (b) the HTML of EVERY record is built at all three tiers (every segment chosen) and for every non-dropped preset; the text guard and the locked-core check run on each one
//   (c) a project with zero registered sales says zero plainly in the core
//   (d) no record turns a printed payment-plan label into an amount, and no page prints a cash figure without a developer plan
//   (e) the distribution report: how many records have each core fact known and unknown
//   (f) negative controls: corrupted records must be rejected (and a clean one must pass), so the gate is shown to be able to fail
//   --quick N checks only every Nth record in (b) (development); the default checks all of them. Exit 1 on any violation.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPlan, PRESETS, SEGMENTS, TIERS, CANNOT_TELL, lintText } from "../src/investor_tiers.js";
import { buildTiersHtml } from "../src/investor_tiers_page.js";
import { validateFacts, districtSlug, shardKey } from "../src/investor_facts.js";

const args = process.argv.slice(2);
const folder = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--quick" && args[args.indexOf(a) - 1] !== "--report");
const quick = args.includes("--quick") ? Math.max(1, Number(args[args.indexOf("--quick") + 1]) || 1) : 1;
const reportPath = args.includes("--report") ? args[args.indexOf("--report") + 1] : null;
if (!folder) { console.error("usage: node scripts/check_investor_facts.mjs <folder> [--quick N] [--report out.json]"); process.exit(2); }

const violations = [];
const bad = (id, what) => { if (violations.length < 400) violations.push(id + ": " + what); else if (violations.length === 400) violations.push("... more violations not listed"); };
const decode = (t) => t.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&middot;/g, " | ").replace(/&ndash;/g, "-").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const CORE_TITLES = ["Who is the registered developer", "The developer's delivery record", "Status and handover date", "Sales so far", "Price, payment plan and fees", "What this report cannot tell you"];

// ------------------------------------------------------------------------------------------------ load
const index = JSON.parse(fs.readFileSync(path.join(folder, "index.json"), "utf8"));
const shards = {};
for (const f of fs.readdirSync(folder)) { const m = /^investor_tiers_facts_(.+)\.json$/.exec(f); if (m) shards[m[1]] = JSON.parse(fs.readFileSync(path.join(folder, f), "utf8")).projects; }
const records = [];
for (const [d, ps] of Object.entries(shards)) for (const [id, f] of Object.entries(ps)) records.push({ d, id, f });
console.log("records:", records.length, "| shards:", Object.keys(shards).length, "| index entries:", index.projects.length);

// ------------------------------------------------------------------------------------------------ (a) schema and index
let schemaOk = 0;
for (const { d, id, f } of records) {
  const e = validateFacts(f);
  if (e.length) bad(id, "schema: " + e.slice(0, 3).join(" | ")); else schemaOk++;
  if (f.project.id !== id) bad(id, "record key differs from project.id");
  if (districtSlug(f.project.register_area) !== d) bad(id, "record sits in the wrong shard (" + d + ")");
}
const seen = new Set();
for (const x of index.projects) {
  if (seen.has(x.id)) bad(x.id, "duplicate in the index"); seen.add(x.id);
  const f = shards[x.district] && shards[x.district][x.id];
  if (!f) bad(x.id, "index points to shard " + x.district + " which does not hold it");
  else if ((f.project.project_number ?? null) !== (x.project_number ?? null) || f.project.name !== x.name || f.project.brand_name !== x.brand_name) bad(x.id, "index entry differs from its record");
}
if (index.count !== index.projects.length || index.projects.length !== records.length) bad("index", "count " + index.count + ", entries " + index.projects.length + ", records " + records.length);
const pnSeen = new Map();
for (const { id, f } of records) if (f.project.project_number != null) { if (pnSeen.has(f.project.project_number)) bad(id, "register project number repeated with " + pnSeen.get(f.project.project_number)); pnSeen.set(f.project.project_number, id); }
console.log("(a) schema: " + schemaOk + " of " + records.length + " records pass; shard key names look like " + shardKey("abc"));

// ------------------------------------------------------------------------------------------------ (b) the HTML, tiers and presets, text guard, locked core; (c) zero; (d) no label turned into an amount
const stats = { docs: 0, tierDocs: 0, presetDocs: 0, maxPages: 0, lintHits: 0, coreMissing: 0, zeroChecked: 0, cashWithoutPlan: 0 };
const segAll = SEGMENTS.map((s) => s.id);
const jobs = [...TIERS.map((t) => ({ tier: t, segments: segAll, type: null, kind: "tier" })), ...PRESETS.map((p) => ({ tier: p.tier, segments: undefined, type: p.id, kind: "preset" }))];
console.log("(b) per record: " + TIERS.length + " tiers + " + PRESETS.length + " presets = " + jobs.length + " documents");
const t0 = Date.now();
let k = 0;
for (const { id, f } of records) {
  k++;
  const full = k % quick === 0 || quick === 1;
  if (!full) continue;
  for (const j of jobs) {
    let doc, plan;
    try {
      plan = buildPlan({ facts: f, type: j.type, tier: j.tier, segments: j.segments });
      doc = buildTiersHtml(f, plan, {});
    } catch (e) { bad(id, "building " + j.kind + " " + (j.type || j.tier) + " threw: " + String(e && e.stack || e).split("\n").slice(0, 2).join(" ")); continue; }
    stats.docs++; if (j.kind === "tier") stats.tierDocs++; else stats.presetDocs++;
    stats.maxPages = Math.max(stats.maxPages, doc.pages);
    const text = decode(doc.text);
    if (doc.lint.length || lintText(text).length) { stats.lintHits++; bad(id, j.kind + " " + (j.type || j.tier) + " text guard: " + doc.lint.concat(lintText(text)).join("; ")); }
    for (const t of CORE_TITLES) if (!text.includes(t)) { stats.coreMissing++; bad(id, j.kind + " " + (j.type || j.tier) + " is missing the locked core item '" + t + "'"); }
    for (const c of plan.core) if (!c.lines.length || c.lines.some((l) => !String(l).trim())) bad(id, "core item " + c.id + " has an empty line");
    if (CANNOT_TELL.some((x) => !text.includes(x[0]))) bad(id, "the last page lost an entry of what the report cannot tell you");
    if (/\bundefined\b|\bNaN\b|\bnull\b|\[object Object\]|AED\s*(?:\.|,|;|$)|AED\s{2,}/.test(text)) bad(id, j.kind + " " + (j.type || j.tier) + " prints a placeholder or an empty figure: " + (/\bundefined\b|\bNaN\b|\bnull\b|\[object Object\]|AED\s*(?:\.|,|;|$)|AED\s{2,}/.exec(text) || [""])[0]);
    if (/\(\s*\)|,\s*,|\.\s*\.(?!\.)(?<!\d\.\s*\.)/.test(text.replace(/\.\.\./g, ""))) bad(id, j.kind + " " + (j.type || j.tier) + " has a stray empty bracket, comma or full stop");
    if (j.kind === "tier" && j.tier === "full") {
      // (c) zero sales stated plainly in the core
      if (f.sales && f.sales.all_time === 0) { stats.zeroChecked++; const c = plan.core.find((x) => x.id === "sales"); if (!c || !/^Registered sales: none\./.test(c.lines[0]) || !/to \d{1,2} \w+ \d{4}\./.test(c.lines[0])) bad(id, "zero sales not stated plainly in the core: " + (c && c.lines[0])); }
      // (d) no cash amount without a developer plan with its own milestones
      const pl = f.price_plan && f.price_plan.payment_plan;
      if ((!pl || !(pl.milestones || []).length) && /Cash before handover|Share of the price due before handover/.test(text)) { stats.cashWithoutPlan++; bad(id, "prints a cash-before-handover figure without a stated plan"); }
    }
  }
}
console.log("(b) documents built: " + stats.docs + " (" + stats.tierDocs + " tier, " + stats.presetDocs + " preset) in " + Math.round((Date.now() - t0) / 1000) + " s; text-guard hits " + stats.lintHits + "; locked-core items missing " + stats.coreMissing + "; most pages in one document " + stats.maxPages);
console.log("(c) zero-sales records checked: " + stats.zeroChecked + "; (d) cash figures without a developer plan: " + stats.cashWithoutPlan);

// (d) at record level: a milestone never carries a figure that is not in the developer's own words; a printed code stays text
let planRecords = 0, labelOnly = 0;
for (const { id, f } of records) {
  const pl = f.price_plan.payment_plan;
  if (pl) { planRecords++; const q = new Set(((pl.source && pl.source.quote) || "").match(/\d+(?:\.\d+)?/g)?.map(Number) || []); for (const m of pl.milestones || []) if (!q.has(m.pct)) bad(id, "milestone " + m.label + " " + m.pct + "% is not in the developer's words"); }
  if (f.price_plan.payment_plan_label) { labelOnly++; if (pl && (pl.milestones || []).length && !/\d/.test(pl.source.quote)) bad(id, "label with milestones but no figures in the words"); }
  const lab = f.price_plan.payment_plan_label;
  if (lab && !pl && !String(f.price_plan.payment_plan_reason || "").includes(lab.split("; ")[0])) bad(id, "a printed code is held but the reason does not show it as a code");
}
console.log("(d) records with a developer plan: " + planRecords + "; records with only a printed code: " + labelOnly);

// ------------------------------------------------------------------------------------------------ (e) distribution
const dist = {};
const tally = (name, fn) => { let kn = 0, un = 0; for (const { f } of records) (fn(f) ? kn++ : un++); dist[name] = { known: kn, unknown: un }; };
tally("developer (registered company named)", (f) => !!(f.developer && f.developer.legal_entity));
tally("status", (f) => !!f.status);
tally("planned end date", (f) => !!(f.status && f.status.planned_end));
tally("percent complete", (f) => !!(f.status && f.status.percent != null));
tally("sales register checked", (f) => !!f.sales);
tally("sales so far above zero", (f) => !!(f.sales && f.sales.all_time > 0));
tally("price (median registered)", (f) => !!(f.sales && f.sales.median_price));
tally("payment plan (developer says)", (f) => !!f.price_plan.payment_plan);
tally("delivery record (handover history, 3+ finished projects)", (f) => !!(f.delivery && f.delivery.record));
tally("delivery (the company's projects)", (f) => !!f.delivery);
tally("unit register mix", (f) => !!f.unit_register);
tally("amenities (developer source)", (f) => !!f.amenities);
tally("rent contracts", (f) => !!f.rents);
console.log("(e) distribution, known / unknown:");
for (const [n, v] of Object.entries(dist)) console.log("    " + n.padEnd(58) + String(v.known).padStart(5) + " /" + String(v.unknown).padStart(5));

// ------------------------------------------------------------------------------------------------ (f) negative controls
const clone = (o) => JSON.parse(JSON.stringify(o));
const base = records.find((r) => r.f.sales && r.f.sales.all_time > 50 && r.f.developer.legal_entity && r.f.status).f;
const withPlan = clone(base);
withPlan.price_plan.payment_plan = { text: "20% on booking, 40% in instalments before handover, 40% on handover", evidence: "DEVELOPER_CLAIMED", milestones: [{ label: "On booking", pct: 20, before_handover: true }, { label: "Instalments before handover", pct: 40, before_handover: true }, { label: "On handover", pct: 40, before_handover: false }], source: { file: "x.json", quote: "20% on booking, 40% in instalments and 40% on completion" } };
delete withPlan.price_plan.payment_plan_reason;
const neg = [
  ["a clean record (control: must PASS)", (f) => f, true],
  ["a clean record with a stated plan (control: must PASS)", () => withPlan, true],
  ["missing developer evidence", (f) => { delete f.developer.evidence; return f; }],
  ["developer named without its basis", (f) => { delete f.developer.basis; return f; }],
  ["developer evidence outside the four labels", (f) => { f.developer.evidence = "TRUSTED"; return f; }],
  ["invented plan amount (a milestone figure not in the developer's words)", () => { const f = clone(withPlan); f.price_plan.payment_plan.milestones[1].pct = 55; return f; }],
  ["a printed code turned into milestones (no figures in the words)", () => { const f = clone(withPlan); f.price_plan.payment_plan.source.quote = "payment plan 60/40"; return f; }],
  ["a plan with no source", () => { const f = clone(withPlan); delete f.price_plan.payment_plan.source; return f; }],
  ["banned wording: a forecast", (f) => { f.amenities = ["Roof pool"]; f.amenities_source = "x"; f.amenities.push("prices will go up after launch"); return f; }],
  ["banned wording: guaranteed", (f) => { f.price_plan.payment_plan_reason = "guaranteed returns"; return f; }],
  ["an emoji", (f) => { f.project.name = f.project.name + " \u{1F3E0}"; return f; }],
  ["a placeholder instead of unknown", (f) => { f.price_plan.payment_plan_reason = "TBD"; return f; }],
  ["no register project number", (f) => { delete f.project.project_number; return f; }],
  ["zero sales that still carry a price", (f) => { f.sales.all_time = 0; f.sales.l12 = 0; return f; }],
  ["status unknown with no reason", (f) => { f.status = null; return f; }],
  ["resales claimed separable", (f) => { f.resales = { separable: true, reason: "x", project_rows: 1, project_resale_procedure_rows: 0, project_by_month: [] }; return f; }],
  ["rent contracts with no basis", (f) => { f.rents = { project_contracts: 12 }; return f; }],
  ["amenities with no developer source", (f) => { f.amenities = ["Pool"]; delete f.amenities_source; return f; }],
];
let negOk = 0;
for (const [name, mk, shouldPass] of neg) {
  const f = mk(clone(base)), e = validateFacts(f);
  const pass = e.length === 0;
  if (pass === !!shouldPass) negOk++; else bad("negative control", name + ": " + (shouldPass ? "was rejected: " + e.slice(0, 2).join(" | ") : "was NOT rejected"));
}
// the page-level text guard must also catch a banned word that got past the schema (defence in depth)
{
  const f = clone(base); f.amenities = ["Roof pool", "returns are guaranteed"]; f.amenities_source = "x";
  const plan = buildPlan({ facts: f, type: null, tier: "full", segments: segAll });
  const doc = buildTiersHtml(f, plan, {});
  if (doc.lint.length && validateFacts(f).length) negOk++; else bad("negative control", "a banned word in the amenities passed both the schema and the page guard");
}
console.log("(f) negative controls: " + negOk + " of " + (neg.length + 1) + " behave as required");

const summary = { records: records.length, schema_pass: schemaOk, documents: stats.docs, tier_documents: stats.tierDocs, preset_documents: stats.presetDocs, text_guard_hits: stats.lintHits, locked_core_missing: stats.coreMissing, zero_sales_checked: stats.zeroChecked,
  cash_without_plan: stats.cashWithoutPlan, distribution: dist, negative_controls: { passed: negOk, total: neg.length + 1 }, violations: violations.length, first_violations: violations.slice(0, 40) };
if (reportPath) fs.writeFileSync(reportPath, JSON.stringify(summary, null, 1));
if (violations.length) { console.log("\nVIOLATIONS: " + violations.length); violations.slice(0, 40).forEach((v) => console.log("  - " + v.slice(0, 300))); process.exit(1); }
console.log("\nALL GATES PASS");
