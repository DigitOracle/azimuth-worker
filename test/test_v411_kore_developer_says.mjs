// v411 - the investor report for a project that is NOT on the Land Department project register but whose developer's own material gives facts: KORE by Imtiaz and the other announced projects.
// The five always-included cards show the developer's facts as DEVELOPER_CLAIMED with date and source line, never as register facts; register-verified projects are untouched. Offline: fixtures only.
//   node test/test_v411_kore_developer_says.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPlan, CANNOT_TELL, CANNOT_TELL_DEVELOPER, EMOJI_RX, lintText } from "../src/investor_tiers.js";
import { buildTiersHtml } from "../src/investor_tiers_page.js";
import { validateFacts } from "../src/investor_facts.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 500) : "")); } };
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const clone = (o) => JSON.parse(JSON.stringify(o));
const KORE = J("test/fixtures/v411_kore_facts.json"), ANN = J("test/fixtures/v411_announced_sample.json"), REGS = J("test/fixtures/v411_registered_samples.json"), CLAIMS = J("data/developer_claims/kore_launch_brochure.json");
const plan = (f, tier) => buildPlan({ facts: f, type: "prime", tier: tier || "standard", segments: ["market_history", "unit_mix_prices", "amenities"] });
const core = (f) => Object.fromEntries(plan(f).core.map((c) => [c.id, c]));
const all = (c) => c.lines.join(" ");

console.log("KORE: the five always-included cards");
const C = core(KORE);
ok(validateFacts(KORE).length === 0, "the KORE record passes the schema validator", validateFacts(KORE).join(" | "));
ok(C.developer.label === "DEVELOPER_CLAIMED" && C.developer.known, "card 1 carries the label developer says");
ok(/Brand name \(developer says\): Imtiaz\. Source: KORE launch brochure.*6 October 2026/.test(all(C.developer)), "card 1 names the brand as developer says with source and received date");
ok(/Registered developer: not on the register yet\..*the company behind it is not named by the register/.test(all(C.developer)), "card 1 still says the registered company is not named by the register");
ok(C.delivery.label === "NAME_ONLY" && C.delivery.known, "card 2 is labelled as matched by name only");
ok(/Delivery record: not available, because the project is not on the project register/.test(all(C.delivery)), "card 2 keeps the project's own delivery record honestly 'not available'");
ok(/Imtiaz group, as registered: 35 projects across 8 registered companies/.test(all(C.delivery)) && /5 handed over, 20 under construction, 8 not started, 2 pending/.test(all(C.delivery)), "card 2 shows the brand's registered record (by company id)");
ok(/This is the brand's record, not confirmed as the record of the company behind KORE/.test(all(C.delivery)), "card 2 says the group record is the brand's, not confirmed as KORE's company");
ok(/handover is Q4 2028 \(developer says; the register has no record of it\)/.test(all(C.status)) && /received 6 October 2026/.test(all(C.status)), "card 3 gives the handover as developer says with date and source");
ok(/asterisk/.test(all(C.status)), "card 3 says the asterisk on the date is unexplained and the date is indicative");
ok(/Homes in the unit register: 351 \(248 studios, 90 one-bedroom, 13 two-bedroom\)/.test(all(C.status)) && /loaded 18 September 2026/.test(all(C.status)) && /registered sales of them are none to 17 September 2026/.test(all(C.status)), "card 3 prints the 351 homes of the unit register with the load date and 'sales: none'");
ok(C.sales.lines[0] === "Registered sales: none. No sale of any home in this project is on the Dubai Land Department register to 17 September 2026.", "card 4 'Registered sales: none' is exactly as before");
ok(/Homes registered in the project: none recorded on the project register/.test(all(C.sales)) && C.sales.label === "REGISTER_VERIFIED", "card 4 keeps its other line and its register label");
ok(C.price_plan.label === "DEVELOPER_CLAIMED" && C.price_plan.known, "card 5 carries the label developer says");
const px = C.price_plan.lines.find((l) => /^Launch prices/.test(l)) || "";
ok(/developer says; KORE launch brochure, received 6 October 2026; no registered sale yet/.test(px), "card 5 launch prices carry date and source line and 'no registered sale yet'");
ok(/Studio from 406 sq ft, starting AED 679,000 \(printed 679K\)/.test(px) && /1 bedroom from 669 sq ft, starting AED 1,100,000/.test(px) && /2 bedrooms from 1,406 sq ft, starting AED 1,550,000/.test(px), "card 5 prints the three launch prices as printed");
ok(/not registered sales and not today's price/.test(px), "card 5 says the starting prices are not registered sales");
ok(/2 bedrooms 1,409 to 1,663 sq ft \(13 homes\)/.test(all(C.price_plan)), "the register's two-bedroom sizes are shown beside the developer's 1,406, never replacing it");
const pp = C.price_plan.lines.find((l) => /^Payment plan/.test(l)) || "";
ok(/Option 1 \(the 50\/50 plan\): 20% on booking; 5% on 15 February 2027\*/.test(pp) && /50% on completion \(Q4 2028\*\)/.test(pp), "card 5 prints the 50/50 schedule as the developer states it");
ok(/Option 2 \(the 60\/40 post-handover plan\).*40% after handover, quarterly over 3 years \(printed 3\.33% quarterly\)/.test(pp), "card 5 prints the 60/40 post-handover schedule as stated");
ok(/Dates marked \* are indicative: the brochure does not say what the asterisk means here/.test(pp) && /No cash amount is worked out/.test(pp), "the plan says its dates are indicative and derives no cash amount");
ok(!/not on file/.test(pp), "the plan is no longer 'not on file'");
ok(KORE.price_plan.payment_plan.milestones.length === 0, "no cash milestones are derived (the cash segment stays blocked)");
ok(/Fees we can source: none for this project/.test(all(C.price_plan)), "fees stay 'none' (no registered price, no invented fee)");

console.log("KORE: no invented figure, no portal, no emoji");
const claimNums = new Set();
const grab = (s) => (String(s).match(/\d+(?:,\d{3})*(?:\.\d+)?/g) || []).forEach((x) => claimNums.add(Number(x.replace(/,/g, ""))));
for (const r of CLAIMS.price_from.rows) { claimNums.add(r.from_aed); claimNums.add(r.size_sqft); grab(r.printed_price); }
for (const p of CLAIMS.payment_plans.plans) { grab(p.quote); p.steps.forEach((s) => { claimNums.add(s.pct); grab(s.when || ""); }); }
grab(CLAIMS.handover.text); grab(CLAIMS.source.received);
const ur = KORE.unit_register; [ur.single.units, ur.single.studio, ur.single.b1, ur.single.b2].forEach((n) => claimNums.add(n)); ur.sizes.forEach((z) => { claimNums.add(z.n); claimNums.add(z.min_sqft); claimNums.add(z.max_sqft); });
const rc = KORE.delivery_brand; [rc.projects, rc.companies, rc.companies_named, rc.companies_named - rc.companies, rc.past_planned_end, rc.registered_finished, ...Object.values(rc.by_status)].forEach((n) => claimNums.add(n));
[2026, 2027, 2028, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 17, 18, 25, 3.33, 50, 60, 40].forEach((n) => claimNums.add(n));   // dates of the register loads, ordinals, '2 plans', 'Option 1/2', 'Q4', 'in 3 years', the printed 50/50 and 60/40 labels
const untraced = [];
for (const k of ["developer", "delivery", "status", "price_plan"]) for (const l of C[k].lines) for (const m of l.match(/\d+(?:,\d{3})*(?:\.\d+)?/g) || []) { const n = Number(m.replace(/,/g, "")); if (!claimNums.has(n)) untraced.push(k + ": " + m + " in '" + l.slice(0, 60) + "'"); }
ok(untraced.length === 0, "every number on cards 1, 2, 3 and 5 traces to the brochure transcription, the unit register or the register's brand group", untraced.join(" | "));
ok(KORE.developer_says.price_from.every((r) => { const m = /^(\d+(?:\.\d+)?)\s*([KM])$/.exec(r.printed); return m && Math.round(Number(m[1]) * (m[2] === "K" ? 1e3 : 1e6)) === r.from_aed; }), "each launch price equals its printed figure (679K, 1.1 M, 1.55 M)");
ok(CLAIMS.payment_plans.plans.every((p) => p.steps.reduce((a, s) => a + s.pct, 0) === p.total_pct && p.total_pct === 100), "both stated plans add up to 100% (20+6x5+50; 20+5+10+5+10+5+5+40)");
const blob = JSON.stringify(KORE) + JSON.stringify(CLAIMS) + JSON.stringify(ANN);
ok(!/propertyfinder|bayut|dubizzle|property finder/i.test(blob), "no portal source appears in the KORE, claims or announced records");
const html = buildTiersHtml(KORE, plan(KORE), {}); html.text = html.text.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
ok(!EMOJI_RX.test(html.text) && lintText(html.text).length === 0 && html.lint.length === 0, "no emoji and no forecast wording in the rendered report");
ok(html.pages >= 3 && html.pages <= 6, "the report has a sane page count (" + html.pages + ")");
ok(CANNOT_TELL_DEVELOPER.some((x) => /Figures the developer states/.test(x[0]) && /not a Land Department register fact/.test(x[1])) && /Figures the developer states/.test(html.text), "the last page says developer-stated figures are not register facts");
const regHtml = buildTiersHtml(Object.values(REGS.records)[0], plan(Object.values(REGS.records)[0]), {});
ok(!/Figures the developer states/.test(regHtml.text), "the report of a registered project does not get the extra line (it reads as before)");
ok(["Who is the registered developer", "The developer's delivery record", "Status and handover date", "Sales so far", "Price, payment plan and fees", "What this report cannot tell you"].every((t) => html.text.includes(t)), "the locked core is all there");
const am = plan(KORE).included.find((r) => r.id === "amenities");
ok(!!am && KORE.amenities.some((a) => /Roof, outdoor: adults' leisure pool, sunset deck, wellness pool, rooftop kids' pool, outdoor shower area/.test(a)) && KORE.amenities.some((a) => /social padel court/.test(a)) && KORE.amenities.some((a) => /not on its amenity list by level.*does not say who provides these or whether any is included in the price/.test(a)), "the amenities segment is filled from the developer's list, the extra services only as listed, with no claim of inclusion");
ok(/developer says|Developer says/.test(html.text) && /the developer's material does not say here which of these are included in the price/.test(html.text), "the amenities page says developer says and makes no inclusion claim");

console.log("validator: the new fields are gated");
const bad = (mut, re, label) => { const f = clone(KORE); mut(f); const e = validateFacts(f); ok(e.some((x) => re.test(x)), label, e.join(" | ")); };
bad((f) => { f.developer_says.price_from[0].from_aed = 689000; }, /not the printed figure/, "a launch price that differs from its printed figure is rejected");
bad((f) => { f.developer_says.source.name = "PropertyFinder brochure"; }, /portal/, "a portal source is rejected");
bad((f) => { f.price_plan.payment_plan.schedule[0].steps[1].pct = 6; }, /not a figure in the developer's own words|add up/, "a schedule step that is not in the developer's words is rejected");
bad((f) => { f.price_plan.payment_plan.schedule[0].total_pct = 90; }, /add up/, "a schedule that does not add up to its total is rejected");
bad((f) => { f.delivery_brand.projects = 36; }, /does not add up/, "a brand group whose statuses do not add up is rejected");
bad((f) => { delete f.delivery_brand.matched_by; }, /matched_by/, "a brand group without its matching rule is rejected");
bad((f) => { f.developer.brand_source.as_of = "yesterday"; }, /brand_source/, "a brand source without a date is rejected");
const reg0 = clone(Object.values(REGS.records)[0]); reg0.delivery_brand = clone(KORE.delivery_brand); delete reg0.delivery;
ok(validateFacts(reg0).some((e) => /only for a project that is not on the project register/.test(e)), "a registered project may not carry a brand-level record");

console.log("register-verified projects are untouched");
for (const [id, f] of Object.entries(REGS.records)) {
  ok(validateFacts(f).length === 0, id + ": the v410 record still passes the validator", validateFacts(f).join(" | "));
  ok(JSON.stringify(plan(f, "full").core) === JSON.stringify(REGS.golden[id]), id + ": the locked core prints exactly what v410 printed");
}

console.log("another announced project (developer material only)");
ok(validateFacts(ANN).length === 0, "the announced-project record passes the validator", validateFacts(ANN).join(" | "));
const A = core(ANN);
ok(A.developer.label === "DEVELOPER_CLAIMED" && /the developer's own web page https:\/\//.test(all(A.developer)) && /\d{1,2} \w+ 2026\./.test(all(A.developer)), "its brand is developer says with the page and its date");
ok(A.delivery.label === "NAME_ONLY" && /group, as registered/.test(all(A.delivery)) && /not confirmed as the record of the company behind/.test(all(A.delivery)), "its delivery record is the brand's, labelled as such");
ok(/handover is .* \(developer says; the register has no record of it\)/.test(all(A.status)) && /Handover source \(developer says\)/.test(all(A.status)), "its handover is developer says with source and page date");
ok(/^Registered sales: none\./.test(A.sales.lines[0]), "its sales line is the register's own zero");
ok(!/AED \d/.test(all(A.price_plan)) || /Payment plan \(developer says\)/.test(all(A.price_plan)), "no price is invented where the developer gives none");

console.log("the publisher");
const pub = fs.readFileSync(path.join(ROOT, "scripts/publish_investor_facts_v411.ps1"), "utf8");
ok(/publish_investor_facts\.ps1/.test(pub) && /gate_guard/.test(fs.readFileSync(path.join(ROOT, "scripts/publish_investor_facts.ps1"), "utf8")), "the v411 publisher calls the existing publisher, which is wired with gate_guard");
ok(/if \(\$Apply\) \{ \$ia \+= "-Apply"; \$ia \+= "-Replace" \}/.test(pub) && /\$ia \+= "-SkipGate"/.test(pub), "the v411 publisher is a dry run unless -Apply is given, and passes -SkipGate through");
ok(/compare_investor_facts\.py/.test(pub), "the v411 publisher refuses if a register-verified record would change");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
