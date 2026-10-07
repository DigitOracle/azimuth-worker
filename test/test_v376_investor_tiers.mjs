// v376 - the tiered investor report: locked core, segments, contradiction rules, tiers, presets (researched taxonomy), selector, audit. Offline: inline fixtures only, nothing live.
//   node test/test_v376_investor_tiers.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generated } from "../scripts/build_investor_config.mjs";
import * as T from "../src/investor_tiers.js";
import { buildTiersHtml, selectorHtml, segmentContent } from "../src/investor_tiers_page.js";
import { parseParams, buildAreaPdf } from "../src/devmap_pdf.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 300) : "")); } };
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clone = (o) => JSON.parse(JSON.stringify(o));
const textOf = (html) => html.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<meta[^>]*>/g, " ").replace(/<svg[\s\S]*?<\/svg>/g, " ").replace(/<[^>]+>/g, " ").replace(/&middot;/g, ".").replace(/&ndash;/g, "-").replace(/&#0*39;|&#x27;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");

// ------------------------------------------------------------------------------------------------ fixtures
const BASE = {
  schema: 1, project: { id: "fx-tower", name: "Fixture Tower", brand_name: "Fixture Tower by Acme", area: "Test Area", register_area: "Test Area", master_project: "Test Area", project_number: 9001 },
  as_of: { sales: "2026-09-17", register: "2026-06-15", rents: null, built: "2026-10-07" }, window: { from: "2025-09-18", to: "2026-09-17" },
  developer: { brand: "Acme", legal_entity: "ACME DEVELOPMENT L.L.C", evidence: "REGISTER_VERIFIED", basis: "project number 9001 on the project register names developer id 1", registered: "2020-01-01", licence_number: "123", licence_authority: "DED", licence_expires: "2027-01-01" },
  delivery: { entity: { projects: 3, by_status: { FINISHED: 2, ACTIVE: 1 } }, brand_family: { matched_by: "company name starts with ACME (a name rule, not the register)", past_planned_end: 10, registered_finished: 9 } },
  status: { code: "ACTIVE", text: "Under construction", percent: 40, start: "2024-01-01", planned_end: "2028-06-30", completion: null, units: 200, buildings: 1, escrow: "Test Bank", zoning: "Trakhees", source: "Dubai Land Department project register" },
  sales: { all_time: 300, first: "2024-02-01", last: "2026-09-10", l12: 120, l12_median_price: 2150000, l12_median_psf: 2500, median_price: 1800000,
    by_year: [{ year: 2024, n: 100, psf: 2200 }, { year: 2025, n: 150, psf: 2400 }, { year: 2026, n: 50, psf: 2500 }],
    by_beds: [{ beds: "1 B/R", n: 200, sqft: 700, median_price: 1500000, psf: 2100 }, { beds: "2 B/R", n: 100, sqft: 1200, median_price: 2900000, psf: 2400 }], land_registrations_excluded: 0, all_off_plan: true },
  price_plan: { payment_plan: { text: "60/40", milestones: [{ label: "On signing", pct: 20, before_handover: true }, { label: "During construction", pct: 40, before_handover: true }, { label: "On handover", pct: 40, before_handover: false }] }, fees: [{ label: "Dubai Land Department registration fee", rate: 0.04, source: "published fixed fee on a sale" }], fees_unknown: "agent commission and service charges are not held" },
  rents: { project_contracts: 45, area_contracts: 90, yield_rate: 0.06 },
  market: { area_by_year: [{ year: 2020, n: 5, psf: 1400 }, { year: 2021, n: 2, psf: 1450 }, { year: 2025, n: 900, psf: 2400 }, { year: 2026, n: 400, psf: 2500 }], dubai_by_year: [{ year: 2020, n: 24000, psf: 1065 }, { year: 2021, n: 40000, psf: 1139 }, { year: 2025, n: 175000, psf: 1728 }, { year: 2026, n: 100000, psf: 1733 }] },
  comparables: [{ name: "Alpha", n: 300, psf: 2300 }, { name: "Beta", n: 200, psf: 2600 }, { name: "Gamma", n: 90, psf: 2450 }],
  neighbourhood: [{ label: "Nearest metro", value: "Test Metro", source: "Dubai Land Department sales register" }],
  city: { l12_sales: 150000, l12_psf: 1740, offplan_share: 0.74, area_l12_sales: 2000, area_l12_psf: 2450 },
  supply: { ACTIVE: { projects: 5, homes: 1000 }, NOT_STARTED: { projects: 2, homes: 500 } },
  amenities: ["Roof pool", "Gym"], resales: { separable: false, reason: "one procedure covers first sales and resales", project_rows: 300, project_resale_procedure_rows: 0, project_by_month: [{ month: "2026-01", n: 10 }, { month: "2026-02", n: 12 }], district_window: { from: "2025-09-18", to: "2026-09-17", pre_registration: 900, existing_property_sell: 40 } },
  unit_register: { source: "Dubai Land Department unit register, projects 9001", phase1: { name: "Fixture Tower", project_number: 9001, units: 200, studio: 0, b1: 150, b2: 50, b3: 0 }, phase2: { name: "Fixture Tower 2", project_number: 9002, units: 100, studio: 0, b1: 60, b2: 40, b3: 0 }, left_for_sale: "not known: the register does not record which homes are still for sale", unreconciled: "A sales extract shows a 4-bedroom sale although the unit register stops at 3 bedrooms. Not reconciled." },
};
const ZERO = clone(BASE);   // a project with ZERO registered sales, no rent, nothing started
Object.assign(ZERO.sales, { all_time: 0, first: null, last: null, l12: 0, l12_median_price: null, l12_median_psf: null, median_price: null, by_year: [], by_beds: [] });
ZERO.status = Object.assign({}, ZERO.status, { code: "NOT_STARTED", text: "Not started", percent: 0 });
ZERO.rents = { project_contracts: 0, area_contracts: 0 }; ZERO.comparables = []; ZERO.amenities = null; ZERO.amenities_reason = "no developer sheet on file";
ZERO.price_plan = { payment_plan: null, payment_plan_reason: "no developer sheet on file", fees: [], fees_unknown: "none held" }; ZERO.resales = Object.assign(clone(BASE.resales), { project_rows: 0 }); ZERO.delivery.entity = { projects: 1, by_status: { NOT_STARTED: 1 } };
ZERO.unit_register = undefined;

const CORE_TITLES = ["Who is the registered developer", "The developer's delivery record", "Status and handover date", "Sales so far", "Price, payment plan and fees"];
const render = (facts, o) => { const plan = T.buildPlan(Object.assign({ facts }, o)); const doc = buildTiersHtml(facts, plan, {}); return { plan, doc, text: textOf(doc.html) }; };

console.log("A - config: the generated module equals the JSON; presets load from config");
{
  const norm = (x) => x.split(String.fromCharCode(13)).join("");
  ok(norm(generated()) === norm(fs.readFileSync(path.join(ROOT, "src", "investor_config.generated.js"), "utf8")), "src/investor_config.generated.js is in step with config/investor_*.json (run scripts/build_investor_config.mjs)");
  const ids = T.PRESETS.map((p) => p.id);
  ok(ids.join() === "prime,yield,capital_growth,flipper,residency,first_timer,uae_resident,family,professional,tenant_to_owner,holiday", "11 presets in order: 7 investor types and 4 end-user types", ids.join());
  ok(T.PRESETS.filter((p) => p.group === "investment").length === 7 && T.PRESETS.filter((p) => p.group === "end_user").length === 4, "7 investment, 4 end-user");
  const tier = Object.fromEntries(T.PRESETS.map((p) => [p.id, p.tier]));
  ok(tier.prime === "standard" && tier.yield === "full" && tier.capital_growth === "standard" && tier.flipper === "full" && tier.residency === "standard" && tier.first_timer === "summary" && tier.uae_resident === "standard", "investor default tiers as approved");
  ok(tier.family === "summary" && tier.professional === "summary" && tier.tenant_to_owner === "standard" && tier.holiday === "summary", "end-user default tiers as approved");
  ok(["multi_unit", "portfolio", "hni", "diaspora", "returning_diaspora", "community", "school_led"].every((d) => !ids.includes(d)), "dropped types are absent");
  const draft = T.PRESETS.filter((p) => p.status === "draft").map((p) => p.id).sort().join();
  ok(draft === "flipper,residency,yield" && T.PRESETS.filter((p) => p.status === "draft").every((p) => p.needs_check), "draft state: yield, residency and flipper, each with its reason", draft);
  ok(T.PRESETS.find((p) => p.id === "capital_growth").title === "Capital growth, long hold", "capital growth is relabelled 'long hold' with the id unchanged");
  ok(T.ORDER_FLAGS.some((o) => o.id === "multi_unit"), "multi-unit is an order flag, not a type");
  ok(T.RULE_CARDS.golden_visa === null && T.RULE_CARDS.assignment === null, "the rule-card slots exist and are empty by default");
  ok(T.PRESETS.every((p) => p.segments.every((s) => T.SEGMENTS.some((x) => x.id === s)) && (p.full_sections || []).every((s) => p.segments.includes(s))), "every preset segment exists");
  ok(T.SEGMENTS.every((s) => T.THRESHOLDS && (s.claims || []).every((c) => typeof T.RULES[c] === "function")), "every segment claim has a rule");
  ok(Object.keys(T.RULES).every((c) => T.SEGMENTS.some((s) => (s.claims || []).includes(c))), "every rule is used by a segment");
  ok(T.STATS.every((t) => t.source && /^\d{4}/.test(t.date) && ["PUBLISHED", "OUR DATA"].includes(t.status) && !T.BANNED_STAT_STATUS.test(t.status)), "every stat has a source, a date and an allowed status");
  ok(!T.STATS.some((t) => ["S09", "S23", "S26", "S28", "S29", "S30", "R06"].includes(t.id)), "no SNIPPET ONLY, NO SOURCE FOUND or NOT IN OUR DATA row is in the stats");
  const s21 = T.STATS.find((t) => t.id === "S21");
  ok(s21 && /9\.1%/.test(s21.figure) && /19 months/.test(s21.figure) && /4\.1%/.test(s21.figure) && /Smart Bricks/.test(s21.source) && s21.date === "2026-07-26" && /not what any buyer/.test(s21.figure), "S21 is the exact Smart Bricks row, dated 26 Jul 2026, labelled past medians");
  ok(T.PRESETS.find((p) => p.id === "flipper").stats.includes("S21") && !T.PRESETS.find((p) => p.id === "capital_growth").stats.includes("S21"), "the cost statistic sits with the flipper, not the long hold");
}

console.log("B - negative controls: corrupted presets are rejected");
{
  const good = { id: "x_type", group: "investment", title: "X type", blurb: "b", tier: "standard", status: "ready", segments: ["price_charts"], stats: [] };
  ok(T.validatePreset(good).length === 0, "a clean preset passes");
  const bad = (o, rx, m) => { const e = T.validatePreset(Object.assign(clone(good), o)); ok(e.length > 0 && (!rx || rx.test(e.join(" "))), m, e.join(" | ")); };
  bad({ core: { sales: false } }, /locked core/, "a preset with a 'core' key that tries to switch the core off is rejected");
  bad({ omit: ["sales"] }, /locked core/, "a preset that omits a core item is rejected");
  bad({ hide_core: true }, /locked core/, "hide_core is rejected");
  bad({ segments: ["price_charts", "sales"] }, /locked core item/, "a segment list naming a core item (sales) is rejected");
  bad({ segments: ["core:developer"] }, /core/, "core: prefixed segment is rejected");
  bad({ segments: ["nonsense"] }, /unknown segment/, "an unknown segment is rejected");
  bad({ id: "multi_unit" }, /dropped/, "a preset naming a dropped type (multi_unit) is rejected");
  bad({ id: "returning_diaspora" }, /dropped/, "returning diaspora is rejected");
  bad({ id: "british_buyer", title: "British buyer" }, /nationality/, "a nationality-defined type is rejected");
  bad({ stats: ["S29"] }, /unknown stat/, "a preset using a banned stat (S29) is rejected");
  bad({ status: "draft" }, /official check/, "a draft preset without its reason is rejected");
  bad({ tier: "deluxe" }, /tier/, "an unknown tier is rejected");
  // the flipper, corrupted
  const flipper = clone(T.PRESETS.find((p) => p.id === "flipper"));
  ok(T.validatePreset(flipper).length === 0, "the real flipper preset is valid");
  const f1 = T.validatePreset(Object.assign(clone(flipper), { drop_core: ["delivery"] })); ok(f1.length > 0 && /locked core/.test(f1.join()), "a Flipper preset that tries to drop a core item (drop_core) is rejected", f1.join());
  const f2 = T.validatePreset(Object.assign(clone(flipper), { segments: flipper.segments.concat(["delivery"]) })); ok(f2.length > 0, "a Flipper preset whose segments include the core 'delivery' item is rejected", f2.join());
  const f3 = T.validatePreset(Object.assign(clone(flipper), { core_optional: { sales: true } })); ok(f3.length > 0, "a Flipper preset with core_optional is rejected");
  let threw = null; try { T.loadPresets({ presets: [good, Object.assign(clone(good), { id: "y_type", exclude_core: ["sales"] })] }); } catch (e) { threw = e; }
  ok(threw && /preset config rejected/.test(threw.message) && threw.errors.length === 1, "loadPresets fails closed: one corrupted preset rejects the file");
  ok(T.validateStats([{ id: "Z1", figure: "x", source: "s", date: "2026-01-01", status: "SNIPPET ONLY" }]).length > 0, "a SNIPPET ONLY stat is refused");
  ok(T.validateStats([{ id: "Z2", figure: "x", source: "", date: "", status: "PUBLISHED" }]).length > 0, "a stat without a source and date is refused");
  ok(T.validateStats([{ id: "Z3", figure: "x", source: "s", date: "2026-01-01", status: "NO SOURCE FOUND" }]).length > 0, "a NO SOURCE FOUND stat is refused");
}

console.log("C - the locked core is in every tier and every preset, and cannot be disabled; zero sales is stated plainly");
{
  let allCore = true, allCover = true, allCannot = true, zeroPlain = true, lintOk = true, lintMsg = "";
  for (const F of [BASE, ZERO]) for (const p of [null].concat(T.PRESETS.map((x) => x.id))) for (const tier of T.TIERS) {
    const r = render(F, { type: p, tier });
    if (!CORE_TITLES.every((t) => r.text.includes(t))) allCore = false;
    if (!/This version covers:/.test(r.text) || !/Not covered:/.test(r.text)) allCover = false;
    if (!r.text.includes("What this report cannot tell you") || !T.CANNOT_TELL.every((k) => r.text.includes(k[0]))) allCannot = false;
    if (F === ZERO && !(/Registered sales: none/.test(r.text) && /last 12 months[^.]*: 0 registered sales/.test(r.text))) zeroPlain = false;
    if (r.doc.lint.length) { lintOk = false; lintMsg += p + "/" + tier + ": " + r.doc.lint.join() + "; "; }
  }
  ok(allCore, "all five core items are in every preset at every tier (two fixtures, " + (T.PRESETS.length + 1) * 3 * 2 + " documents)");
  ok(allCover, "the 'This version covers ... Not covered' line is on every document");
  ok(allCannot, "the known-unknowns page ('What this report cannot tell you') is on every document, all items");
  ok(zeroPlain, "the zero-sales project says 'Registered sales: none' and the 12-month window count of 0 in every version");
  ok(lintOk, "no emoji and no forecast wording in any document", lintMsg);
  const r = T.buildPlan({ facts: BASE, type: "prime", tier: "standard", segments: ["sales", "developer", "price_charts"], disableCore: true });
  ok(r.core.length === 5 && CORE_TITLES.every((t) => r.core.some((c) => c.title === t)) && r.audit.core.some((c) => c.id === "cannot_tell"), "asking to disable core items changes nothing: the core is still all there");
  ok(r.warnings.some((w) => /locked core cannot be switched off/.test(w)), "and the attempt is reported as a warning");
  ok(r.audit.segments.sales === undefined && r.audit.segments.price_charts === "on", "core ids passed as segments are ignored, real segments kept");
  ok(T.CORE_IDS.length === 6, "the core has six items, none of them a segment id");
  ok(T.SEGMENTS.every((s) => !T.CORE_IDS.includes(s.id)), "no segment shares an id with a core item");
  const unknownDev = clone(BASE); unknownDev.developer = null; unknownDev.status = null; unknownDev.delivery = null; unknownDev.price_plan = null;
  const u = render(unknownDev, { type: "family", tier: "summary" });
  ok(/Registered developer: not on the register yet/.test(u.text) && /Status and handover date: not on the project register yet/.test(u.text) && /Delivery record: not available/.test(u.text), "an unknown core fact is one plain line with its reason, not hidden");
}

console.log("D - the contradiction rules, one by one (a fixture with ZERO registered sales and a healthy one)");
{
  const cz = T.checkSegments(ZERO), cb = T.checkSegments(BASE);
  ok(cz.demand_momentum.status === "blocked" && /sales in the last 12 months: 0/.test(cz.demand_momentum.reasons[0]), "strong-sales wording is BLOCKED when there are no registered sales, and the selector reason says why", cz.demand_momentum.reasons.join());
  ok(cb.demand_momentum.status === "ok", "and allowed with 120 sales in 12 months");
  const lowFx = clone(BASE); lowFx.sales.l12 = 12; ok(T.checkSegments(lowFx).demand_momentum.status === "blocked", "12 sales in 12 months is under the threshold: blocked");
  ok(cz.yield_rent.status === "blocked" && /Rent contracts behind a yield for this project: 0/.test(cz.yield_rent.reasons[0]), "a yield estimate is blocked with zero rent contracts (count shown)");
  ok(cb.yield_rent.status === "ok" && /45/.test(segmentContent("yield_rent", BASE, T.THRESHOLDS).story), "and allowed with 45 contracts, the count printed");
  ok(cz.delivery_progress.status === "annotated" && /not started, 0% complete/.test(cz.delivery_progress.notes[0]) && /does not say whether a project is on schedule/.test(cz.delivery_progress.notes[0]), "'on track' wording needs status evidence: a not-started project carries the contrary fact beside it");
  ok(cb.delivery_progress.status === "ok", "an active project at 40% passes the on-track rule");
  const off = (c) => c.status === "blocked" || c.status === "unavailable";
  ok(off(cz.comparables) && cb.comparables.status === "ok", "peer comparison needs 3 comparables");
  ok(off(cz.price_charts) && /needs 2/.test(cz.price_charts.reasons.join(" ")), "a price chart is blocked when fewer than 2 years have 30 sales");
  ok(cb.price_charts.status === "annotated" && /part of a year/.test(cb.price_charts.notes[0]), "a chart that includes the part year carries a part-year note");
  ok(cb.developer_detail.status === "ok" && cz.developer_detail.status === "annotated" && /completed no project of its own/.test(cz.developer_detail.notes[0]), "'reliable developer' wording: the contrary fact is beside it when the registered company has finished nothing");
  ok(cb.amenities.status === "annotated" && /Developer says/.test(cb.amenities.notes[0]), "a developer claim is always labelled 'Developer says', never presented as a register fact");
  ok(cz.amenities.status === "unavailable" && /no developer sheet on file/.test(cz.amenities.reasons[0]), "with no developer source, amenities say so with the reason");
  const html = render(BASE, { type: "family", tier: "standard" }).doc.html;
  ok(/Developer says\. This comes from the developer/.test(textOf(html)) && /Roof pool/.test(html), "the amenities card prints the claim with the label beside it");
  ok(cb.area_story.status === "annotated" && /straight line/.test(cb.area_story.notes[0]), "'near' wording is labelled straight line, not travel time");
  ok(cz.resale_activity.status === "annotated" && /does not separate a first sale from a resale/.test(cz.resale_activity.notes[0]), "strong-resale wording is not used when the register cannot separate resales (contrary fact beside it)");
  ok(cz.payment_plan_cash.status === "unavailable" && /no payment plan on file/.test(cz.payment_plan_cash.reasons.join(" ")), "the cash-before-handover figure needs a plan AND a price: with no plan the segment is unavailable with the reason");
  ok(cb.payment_plan_cash.status === "ok" && /AED 1,080,000/.test(segmentContent("payment_plan_cash", BASE, T.THRESHOLDS).story), "with plan and price it is derived: 60% of AED 1,800,000 = AED 1,080,000");
  const noPrice = clone(BASE); noPrice.sales.median_price = null; ok(T.checkSegments(noPrice).payment_plan_cash.status === "blocked", "a plan without a price is blocked");
  const strongFx = clone(BASE); strongFx.resales = { separable: true, reason: "", project_rows: 300, project_resale_procedure_rows: 80, resale_l12: 80, project_by_month: [{ month: "2026-01", n: 5 }], district_window: BASE.resales.district_window };
  ok(T.checkSegments(strongFx).resale_activity.status === "ok", "strong resale is allowed only when separable resales in 12 months reach the threshold");
  ok(cz.resale_conditions.status === "annotated" && /differ by developer and must be confirmed with the developer and the Dubai Land Department/.test(cz.resale_conditions.notes[0]), "with no rule card the resale conditions say they differ by developer and must be confirmed");
  const withCard = clone(BASE); withCard.rule_cards = { assignment: { text: "Example rule text.", source: "Official service page", url: "https://example.test", as_of: "2026-10-01" } };
  ok(T.checkSegments(withCard).resale_conditions.status === "ok" && /Example rule text/.test(segmentContent("resale_conditions", withCard, T.THRESHOLDS).story), "a dated, sourced assignment rule card is the only way rule text can appear");
  ok(T.checkSegments(BASE).residency_rule.status === "annotated", "residency rule with no card is annotated");
  ok(T.lintText("It will go up soon").length === 1 && T.lintText("a quick profit").length === 1 && T.lintText("guaranteed return").length === 1 && T.lintText("homes will sell fast").length === 1 && T.lintText("it will be late").length === 1, "the forecast guard catches 'will go up', 'quick profit', 'guaranteed', 'will sell', 'will be late'");
  ok(T.lintText("Registered sales rose from 2020 to 2021.").length === 0, "past-tense registered history passes the guard");
}

console.log("E - tiers, selected segments, omitted line, audit");
{
  const sum = render(BASE, { type: "family", tier: "summary" }), std = render(BASE, { type: "prime", tier: "standard" }), full = render(BASE, { type: null, tier: "full" });
  ok(sum.doc.pages < std.doc.pages && std.doc.pages <= full.doc.pages, "Summary is shorter than Standard, which is no longer than Full (" + sum.doc.pages + ", " + std.doc.pages + ", " + full.doc.pages + " pages)");
  ok(full.plan.included.length === T.SEGMENTS.filter((s) => full.plan.segments.find((r) => r.id === s.id).status !== "blocked" && full.plan.segments.find((r) => r.id === s.id).status !== "unavailable").length, "Full evidence includes every segment the evidence allows");
  ok(/Method:/.test(full.text) && !/Method:/.test(std.text) && !/Method:/.test(sum.text), "method lines only in Full evidence");
  const z = render(ZERO, { type: "prime", tier: "standard" });
  ok(/Not covered:[^]*comparable projects \(no data\)/.test(z.text) && /sales pace \(blocked/.test(z.text), "the omitted-segments line names what was left out and why", z.plan.coverage);
  ok(z.plan.audit.check.demand_momentum.status === "blocked" && z.plan.audit.segments.demand_momentum === "off", "the audit records the check result and the segment off");
  const a = std.plan.audit;
  ok(a.type === "prime" && a.tier === "standard" && a.as_of.sales === "2026-09-17" && a.version === 376 && Object.keys(a.segments).length === T.SEGMENTS.length && a.core.length === 6, "audit: type, tier, segments on/off, check results, as-of dates");
  ok(std.doc.html.includes('name="investor-audit"') && std.doc.html.includes('name="description"'), "the audit and coverage line are in the document's meta tags");
  const named = T.buildPlan({ facts: BASE, type: "prime", tier: "standard", segments: ["comparables"] });
  ok(named.included.length === 1 && named.included[0].id === "comparables", "explicit segment toggles override the preset");
  const l1 = render(BASE, { type: "family", tier: "summary", lang: "en" }).text, l2 = T.buildPlan({ facts: BASE, type: "family", tier: "summary", lang: "ar" });
  ok(l2.audit.language === "ar" && textOf(buildTiersHtml(BASE, l2, {}).html) === l1, "language is recorded but never changes the content");
}

console.log("F - the draft presets: yield, residency, flipper");
{
  const fl = render(BASE, { type: "flipper", tier: "full" }), flz = render(ZERO, { type: "flipper", tier: "full" });
  ok(/Draft, awaiting official check/.test(fl.text) && fl.plan.audit.preset_status === "draft" && /official check/.test(fl.plan.audit.draft_note), "the Flipper report carries the visible draft state and the audit says draft");
  ok(/commercial study/.test(fl.text) || /Smart Bricks/.test(fl.text), "the Flipper report prints the Smart Bricks figure with its source");
  ok(/9\.1%/.test(fl.text) && /26 Jul|2026-07-26/.test(fl.text.replace(/Date: 2026-07-26/, "26 Jul")) && /not what any buyer will get/.test(fl.text), "with its date and the 'historical, not what any buyer will get' label");
  ok(!/quick profit|guaranteed|will sell|fast money/i.test(fl.text + flz.text), "never uses 'quick profit', 'guaranteed' or 'will sell'");
  ok(/rows under a resale procedure: 0/.test(flz.text) && /do not separate|does not separate/.test(flz.text), "no registered resales is stated plainly with the reason the register cannot separate them");
  ok(/differ by developer and must be confirmed with the developer and the Dubai Land Department/.test(flz.text) && !/no-objection requirement is|minimum[- ]paid is|administration fee is/i.test(flz.text), "no assignment rule, minimum-paid threshold, fee or no-objection requirement is stated as fact");
  ok(/Payment plan and cash needed before handover/.test(fl.text) && /Not covered:[^]*payment plan and cash needed before handover/.test(flz.text), "cash needed appears only with a plan and a price; otherwise it is listed as not covered");
  ok(/Fees we can source:/.test(flz.text) || /Fees we can source:/.test(fl.text), "fees we can source are in the locked core");
  const rs = render(BASE, { type: "residency", tier: "standard" }), rsz = render(ZERO, { type: "residency", tier: "standard" });
  ok(/Draft, awaiting official check/.test(rs.text) && /dated official rule card/.test(rs.text), "residency report: draft state, and it says no dated rule card is on file");
  ok(!/2,000,000|AED 2 million|2 million/.test(rs.text + rsz.text) && !/\b(is|are|be|become) eligible\b|qualif(y|ies) for (a|the) (golden|10-year)/i.test(rs.text), "with the rule card empty the report states no eligibility and no threshold");
  const rc = clone(BASE); rc.rule_cards = { golden_visa: { text: "Example rule text from the official page.", threshold_aed: 2000000, source: "Official service page", url: "https://example.test", as_of: "2026-10-01" } };
  const rcr = render(rc, { type: "residency", tier: "standard" });
  ok(/Official rule as dated 1 October 2026/.test(rcr.text) && /does not say that any purchase qualifies/.test(rcr.text) && rcr.plan.audit.golden_visa_rule_card.as_of === "2026-10-01", "with a dated, sourced card the rule appears with its date, and the report says a price comparison is not eligibility");
  const yl = render(BASE, { type: "yield", tier: "full" });
  ok(yl.plan.tier === "full" && /Draft, awaiting official check/.test(yl.text) && /Thin evidence/.test(yl.text), "yield: Full evidence by default, draft with its reason");
  const ft = render(BASE, { type: "first_timer", tier: "summary" });
  ok(ft.plan.segments.find((r) => r.id === "buyer_protections").depth === "full" && /Method: The register names the escrow bank/.test(ft.text) && /Escrow bank/.test(ft.text), "overseas first-timer: Summary first, then the buyer protections at full-evidence depth");
  const stp = render(BASE, { type: "prime", tier: "standard" });
  ok(/Source: Knight Frank/.test(stp.text) && /Date: 2026-02/.test(stp.text), "every printed statistic carries its source and date (prime: Knight Frank)");
  const t2o = render(BASE, { type: "tenant_to_owner", tier: "standard" });
  ok(/4\.8 years/.test(t2o.text) && /Dubai Land Department, via Dubai Media Office/.test(t2o.text), "tenant converting to owner prints the 4.8 years figure with its source");
}

console.log("G - unit types and the developer, as the Chelsea brief asks");
{
  const CHELSEA = path.resolve(ROOT, "..", "naj-market-pulse", "docs", "INVESTOR_TIERS_CHELSEA_SAMPLES", "chelsea_facts.json");
  const F = fs.existsSync(CHELSEA) ? JSON.parse(fs.readFileSync(CHELSEA, "utf8")) : clone(BASE);
  const synthetic = !fs.existsSync(CHELSEA);
  const r = render(F, { type: "family", tier: "standard" });
  ok(/Unit register:/.test(r.text) && /Units left for sale: not known/.test(r.text) && /4-bedroom sale/.test(r.text) && /not been reconciled|Not reconciled/.test(r.text), "unit types are shown with 'units left for sale: not known' and the unreconciled 4-bedroom flag");
  if (!synthetic) {
    ok(/703 registered units, 544 one-bedroom \(77%\), 130 two-bedroom \(18%\), 29 three-bedroom \(4%\)/.test(r.text) && /958 units: 805, 124 and 29/.test(r.text) && /1,661/.test(r.doc.html.replace(/<[^>]+>/g, " ")) && /no studios are registered/.test(r.text), "Chelsea: 703 = 544/130/29 (77/18/4), 958 = 805/124/29, both 1,661, no studios");
    ok(/project number 3719/.test(r.text) && /DAMAC CREST DEVELOPMENT L\.L\.C/.test(r.text) && /master developer, a Dubai Maritime City entity/.test(r.text), "the developer is shown with its evidence label and register project number, with the master-developer note");
    const u = F.unit_register, p1 = u.phase1, p2 = u.phase2;
    ok(p1.b1 + p1.b2 + p1.b3 === p1.units && p2.b1 + p2.b2 + p2.b3 === p2.units && p1.units + p2.units === 1661 && p1.b1 + p2.b1 === 1349 && p1.b2 + p2.b2 === 254 && p1.b3 + p2.b3 === 58, "the unit counts add up");
  }
}

console.log("H - selector page and route hook");
{
  const html = selectorHtml(BASE, "/developers_pdf", "KEY123");
  const script = /<script>([\s\S]*)<\/script>/.exec(html)[1];
  let parsed = true; try { new Function(script); } catch (e) { parsed = false; ok(false, "selector script parses: " + e.message); }
  ok(parsed, "the selector's script parses");
  ok(/Draft, awaiting official check/.test(html) && /minmax\(150px/.test(html) && !T.EMOJI_RX.test(html), "draft state shown on cards; 2-up card grid works at 375 px; no emoji");
  ok(/1\. Who is it for/.test(html) && /2\. How deep/.test(html) && /3\. Segments/.test(html) && /Always included, in every version/.test(html), "order: type, tier, segments, the locked core, Generate");
  const data = JSON.parse(/var D=(\{[\s\S]*?\}),I=/.exec(script)[1]);
  ok(data.segments.find((s) => s.id === "demand_momentum").status === "ok" && data.presets.length === 11 && data.core.length === 5, "the selector carries every segment's check result, 11 presets and the 5 core cards");
  const dz = JSON.parse(/var D=(\{[\s\S]*?\}),I=/.exec(/<script>([\s\S]*)<\/script>/.exec(selectorHtml(ZERO, "/developers_pdf", ""))[1])[1]);
  ok(dz.segments.find((s) => s.id === "demand_momentum").status === "blocked" && dz.segments.find((s) => s.id === "demand_momentum").reasons.length === 1, "a blocked segment says why in the selector, not silently");
  ok(!/acronym|\bDLD\b|\bHNI\b/.test(textOf(html)), "no unexplained acronyms (DLD, HNI) on the selector");
  const u = new URL("https://x.test/developers_pdf?kind=investor_tiers&project=fx-tower&type=prime&tier=standard&segs=comparables,price_charts&flags=multi_unit&key=k");
  const p = parseParams(u);
  ok(p.kind === "investor_tiers" && p.inv.project === "fx-tower" && p.inv.type === "prime" && p.inv.segs.join() === "comparables,price_charts" && p.inv.flags.join() === "multi_unit", "parseParams carries the new parameters");
  const doc = await buildAreaPdf({}, p, { facts: BASE });
  ok(doc.status === 200 && /Fixture Tower/.test(doc.html) && doc.audit.tier === "standard" && /Order notes|Buying more than one home/.test(textOf(doc.html)), "buildAreaPdf routes kind=investor_tiers to the new builder (and the order flag prints)");
  const sel = await buildAreaPdf({}, parseParams(new URL("https://x.test/developers_pdf?kind=investor_selector&project=fx-tower")), { facts: BASE });
  ok(sel.status === 200 && sel.htmlOnly === true, "kind=investor_selector returns the page");
  const none = await buildAreaPdf({ MEETINGS: { get: async () => null } }, parseParams(new URL("https://x.test/developers_pdf?kind=investor_tiers&project=nope")), {});
  ok(none.status === 404 && /no facts record/.test(none.body.reason), "an unknown project is a plain 404");
  const noProj = await buildAreaPdf({}, parseParams(new URL("https://x.test/developers_pdf?kind=investor_tiers")), {});
  ok(noProj.status === 400, "no project is a plain 400");
}

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
