// v375 - the three gaps of the off-plan buying journey: PAYMENT PLANS (parser and data), CASH NEEDED UP TO HANDOVER (a derived card), PAST DELAYS (the developer page's Delivery record).
//   Offline: stubs and fixtures only. The payment-plan parser is Python (scripts/build_payment_plans.py) and is run here on a fixture file.
//   node test/test_v375_gaps.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { devmapHtml, devmapRoutes } from "../src/devmap_page.js";
import { DM } from "../scripts/build_devmap_index.mjs";
import { PHOSPHOR_LIGHT } from "../src/devmap_icons.js";
import { cashCardHtml, findRecord, usableOptions, cashFigures, normProject } from "../src/cash_card.js";
import { OFFPLAN_CONFIG } from "../src/config.js";
import worker from "../src/index.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1").replace(/%20/g, " "));
const ROOT = path.join(HERE, "..");
const EMOJI = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const text = (h) => h.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

// ---------------------------------------------------------------------------------------------------------- A. the payment-plan parser
console.log("A - the payment-plan parser (scripts/build_payment_plans.py), on developer sentences");
const py = spawnSync("python", [path.join(ROOT, "scripts", "build_payment_plans.py"), "--selftest", path.join(HERE, "fixtures", "payment_plan_texts.json")], { encoding: "utf8" });
let res = [];
try { res = JSON.parse(py.stdout); } catch (e) { /* reported below */ }
ok(py.status === 0 && res.length === 10, "the parser runs on the fixture file", py.stderr);
const by = Object.fromEntries(res.map((r) => [r.name, r]));
const o0 = (n) => (by[n] && by[n].options[0]) || {};
ok(by.simple && by.simple.options.length === 1 && o0("simple").on_booking_pct === 20 && o0("simple").instalments_pct === 40 && o0("simple").before_handover_pct === 60 && o0("simple").on_handover_pct === 40 && o0("simple").after_handover_pct === 0 && o0("simple").confidence === "high" && by.simple.handover_text === "June 2027",
  "'20% on booking, 40% in instalments, 40% on completion in June 2027' -> 20 / 40 / 40, before handover 60, high confidence, the handover words kept", JSON.stringify(by.simple));
ok(o0("before-handover total").before_handover_pct === 55 && o0("before-handover total").on_handover_pct === 10 && o0("before-handover total").after_handover_pct === 35 && o0("before-handover total").on_booking_pct === null, "'55% before handover, 10% upon handover, 35% after handover': three parts, no booking figure invented");
ok(o0("fee in brackets is not a step").on_booking_pct === 20 && o0("fee in brackets is not a step").on_handover_pct === 40 && o0("fee in brackets is not a step").before_handover_pct === 60 && o0("fee in brackets is not a step").derived_remainder === true && o0("fee in brackets is not a step").confidence === "medium",
  "a fee in brackets ('+4% DLD') is not a plan step; the one unquantified construction block is filled by arithmetic and flagged derived, medium confidence");
ok(by["two options"].options.length === 2 && by["two options"].options[0].label === "50/50" && by["two options"].options[0].before_handover_pct === 50 && by["two options"].options[0].on_handover_pct === 50 && by["two options"].options[1].after_handover_pct === 30 && by["two options"].options[1].before_handover_pct === 70, "two options in one answer are two plans: 50/50 and 70 before / 30 after handover");
ok(o0("instalment list").before_handover_pct === 60 && o0("instalment list").on_handover_pct === 40 && o0("instalment list").on_booking_pct === 20, "a list of instalments (5, 5, 10, 10, 5, 5) is read as 40% between booking and completion");
for (const n of ["AMBIGUOUS range", "AMBIGUOUS label with no breakdown", "AMBIGUOUS hides two payments", "AMBIGUOUS post-handover not quantified", "not a payment plan"]) {
  ok(by[n] && by[n].options.length === 0, "left out: " + n);
}
ok(by["AMBIGUOUS range"].excluded.some((x) => /range/.test(x)) && by["AMBIGUOUS hides two payments"].excluded.some((x) => /remainder/.test(x)) && by["AMBIGUOUS post-handover not quantified"].excluded.some((x) => /not quantified/.test(x)), "each ambiguous text carries its reason (for the audit file only, never on a screen)");

console.log("A2 - the data file the script wrote");
const PP = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "payment_plans", "payment_plans.json"), "utf8"));
const projs = Object.entries(PP.projects);
const withPlans = projs.filter(([, r]) => r.plans.length);
ok(PP.evidence === "DEVELOPER_CLAIMED" && withPlans.length >= 30 && PP.coverage.before_with_plan_label === 30 && PP.coverage.after_structured_plan > 30, "DEVELOPER_CLAIMED; structured plans " + PP.coverage.after_structured_plan + " of " + PP.coverage.projects_in_projfacts + " projects against 30 before", JSON.stringify(PP.coverage));
ok(withPlans.every(([, r]) => r.plans.every((o) => Math.abs(o.before_handover_pct + o.on_handover_pct + o.after_handover_pct - 100) < 0.01 && o.total_pct === 100 && o.source && o.source.kind && (o.source.file || o.source.url) && o.source.ref && ["high", "medium"].includes(o.confidence))), "every plan sums to 100 and carries its source (kind, file, row or page) and a confidence flag");
ok(withPlans.every(([, r]) => r.plans.every((o) => (o.steps || []).reduce((t, s) => t + s.pct, 0) > 99.9 || o.steps.some((s) => s.kind === "before_handover_total"))), "the steps of every plan add to 100");
ok(PP.projects["imtiaz|kore"] && PP.projects["imtiaz|kore"].plans.length === 2 && PP.projects["imtiaz|kore"].plans[1].after_handover_pct === 40 && PP.projects["imtiaz|kore"].plans[1].before_handover_pct === 55 && /brochure/.test(PP.projects["imtiaz|kore"].plans[0].source.kind) && PP.projects["imtiaz|kore"].prices && PP.projects["imtiaz|kore"].prices.by_type["1 B/R"].from_aed === 1100000, "KORE by Imtiaz: both brochure plans (50/50; 60/40 with 40% after handover), the brochure starting prices");
ok(!((PP.projects["imtiaz|coveedition2"] || {}).plans || []).length && !((PP.projects["imtiaz|cotierhouse2"] || {}).plans || []).length && !((PP.projects["imtiaz|cove"] || {}).plans || []).length, "the ambiguous Imtiaz texts (Cove Edition 2, Cotier House 2, Cove) are left out of the data, said nowhere");
ok(!((PP.projects["arada|inauradowntown"] || {}).plans || []).length, "Inaura: the web page and the newer sheet disagree on the last payment, so no structure is offered");
ok(projs.filter(([, r]) => r.labels.length && !r.plans.length).every(([, r]) => r.labels.every((l) => l.figures && Math.abs(l.figures.reduce((a, b) => a + b, 0) - 100) < 0.01 && l.source.file)), "a printed code (5/5/5/5/5/5/70) is kept as a label with its source and is never turned into a before-handover amount");
const aud = fs.readFileSync(path.join(ROOT, "data", "payment_plans", "payment_plans_audit.csv"), "utf8");
ok(/EXCLUDED/.test(aud) && /LABEL_ONLY/.test(aud) && /INCLUDED/.test(aud), "the audit CSV lists what was included, kept as a label and left out, with the reason");
ok(withPlans.filter(([, r]) => r.prices).length >= 5, "projects with a stated plan AND a developer price: " + withPlans.filter(([, r]) => r.prices).length);

// ---------------------------------------------------------------------------------------------------------- B. cash needed up to handover
console.log("B - the cash card");
const REC = { key: "windsor|manor", dev: "windsor", developer: "Windsor Developments", project: "Windsor Manor", aliases: ["Windsor Manor", "Windsor Manor by Windsor"], handover_text: "Q4 2028",
  plans: [{ label: "60/40", on_booking_pct: 20, instalments_pct: 40, before_handover_pct: 60, on_handover_pct: 40, after_handover_pct: 0, total_pct: 100, confidence: "high", source: { kind: "developer site", url: "https://windsor.example/manor" } }],
  prices: { source: "developer sheet", kind: "list price per unit on the developer's availability sheet", sheet_date: "2026-09-17", by_type: { "1 B/R": { n: 3, from_aed: 1000000 }, "2 B/R": { n: 2, from_aed: 2000000 } } } };
const on = (r, c) => cashCardHtml(r, { offplan: true }, c);
const card = on(REC);
const ct = text(card);
ok(/Cash needed up to handover/.test(ct) && /DERIVED/.test(ct), "plan AND price AND off-plan: the card appears, labelled DERIVED");
ok(/1 B\/R/.test(ct) && /AED 600,000/.test(ct) && /AED 400,000/.test(ct) && /AED 1,000,000/.test(ct) && /AED 1,200,000/.test(ct) && /AED 800,000/.test(ct) && /AED 2,000,000/.test(ct), "1 B/R at 1,000,000: 600,000 before handover, 400,000 on handover, 1,000,000 by the handover date; the 2 B/R doubles it", ct);
ok(/plan percentages/.test(ct) && /times the developer's list price/.test(ct) && /excludes fees/.test(ct) && /developer says/i.test(ct) && /Q4 2028/.test(ct), "the method is written on the card ('times the developer's list price', 'excludes fees'), and the handover date is the developer's words");
ok(/list price per unit on the developer's availability sheet, 2026-09-17/.test(ct) && /developer site/.test(ct), "both sources are named: where the plan came from and which sheet and date the price came from");
ok(!EMOJI.test(card) && /<svg/.test(card) && /class="cashi"/.test(card), "no emoji; the icon is from the existing icon set");
ok(!/will it|forecast|mortgage|resale/i.test(ct), "no mortgage, no resale value, no forecast");
ok(on(Object.assign({}, REC, { prices: null })) === "" && on(Object.assign({}, REC, { prices: { by_type: {} } })) === "", "a plan with no developer price: no card");
ok(on(Object.assign({}, REC, { plans: [] })) === "" && on(Object.assign({}, REC, { plans: [{ label: "60/40", before_handover_pct: null }] })) === "", "a price with no stated plan structure: no card");
ok(cashCardHtml(REC, { offplan: false }) === "" && cashCardHtml(REC, null) === "" && cashCardHtml(null, { offplan: true }) === "", "a project that is not off-plan, or no record: no card");
ok(OFFPLAN_CONFIG.SHOW_REGISTRATION_FEE === false && OFFPLAN_CONFIG.REGISTRATION_FEE_PCT === 4 && OFFPLAN_CONFIG.REGISTRATION_FEE_SOURCE === "", "src/config.js: the registration fee flag is OFF by default and its source is left empty for a person");
ok(!/registration fee|Land Department registration|4%|UNVERIFIED/i.test(card), "with the flag off the fee line is never printed");
const feeOn = text(on(REC, { SHOW_REGISTRATION_FEE: true, REGISTRATION_FEE_PCT: 4, REGISTRATION_FEE_SOURCE: "" }));
ok(/Dubai Land Department registration fee, 4% of the price/.test(feeOn) && /AED 40,000/.test(feeOn) && /UNVERIFIED/.test(feeOn) && /Source to be confirmed by a person/.test(feeOn) && /separate line/.test(feeOn), "with the flag on it is a separate line, 4% of the price, labelled UNVERIFIED, with 'source to be confirmed' while no source is written");
ok(/Source: the published schedule, read 7 Oct 2026\./.test(text(on(REC, { SHOW_REGISTRATION_FEE: true, REGISTRATION_FEE_PCT: 4, REGISTRATION_FEE_SOURCE: "the published schedule, read 7 Oct 2026" }))), "and carries the person's source once one is written");
// the record is found by exact name and a developer that agrees, never by a name alone
const DOC = { projects: { "windsor|manor": REC } };
ok(findRecord(DOC, ["Windsor Manor"], "Windsor Developments L.L.C") && findRecord(DOC, ["WINDSOR MANOR BY WINDSOR"], "Windsor") && findRecord(DOC, [null, "windsor manor"], "windsor developments"), "found by exact name (case and 'by <developer>' ignored) and an agreeing developer");
ok(findRecord(DOC, ["Windsor Manor"], "Another Developer") === null && findRecord(DOC, ["Windsor Manor"], null) === null && findRecord(DOC, ["Windsor Tower"], "Windsor Developments") === null && findRecord(DOC, [], "Windsor") === null, "a different developer, no developer stated, or another name: not found");
ok(normProject("Cove Edition Residence 6 By Imtiaz", ["imtiaz"]) === "cove edition 6" && normProject("Pearl House IV by Imtiaz", ["imtiaz"]) === "pearl house 4", "the name rule is the builder's (roman numerals as digits, 'by <developer>' dropped)");
ok(usableOptions({ plans: [{ before_handover_pct: 60, on_handover_pct: 30, after_handover_pct: 0 }] }).length === 0, "an option whose parts do not add to 100 is not used");
const KORE = PP.projects["imtiaz|kore"];
const korec = text(on(KORE));
ok(/1 B\/R/.test(korec) && /AED 1,100,000/.test(korec) && /AED 605,000/.test(korec) && /Q4 2028/.test(korec), "KORE (real data): the 60/40 post-handover plan on the brochure starting price of AED 1.1m shows 55% = AED 605,000 before handover, 5% on handover", korec.slice(0, 400));
const can = withPlans.filter(([, r]) => usableOptions(r).length && r.prices && Object.keys(r.prices.by_type || {}).length).map(([k]) => k);
console.log("     (projects that can show the card when they are off-plan today: " + can.length + " - " + can.join(", ") + ")");
ok(can.length >= 5, "the data holds " + can.length + " projects with a stated plan and a developer price");

console.log("B2 - on the building page (the real route)");
const SLUG = "businessbay", ID = "6", READ = "owner_admin_key_never_in_client_links_0001";
const stack = { district: SLUG, generated: "2026-10-07", sources: [], levels: {}, buildings_by_id: { [ID]: { name: "Windsor Manor", basis: "dm_floors", dm: 423650, basements: 2, label: "2B+ G +29 +1R", level_shift: 0, conflict: null, uses: ["homes"], mixed: false, podium: false, labour: false, staff: false, area_sqm: 17010, height_m: 110,
  floors: [{ l: "G", n: null, u: "hotel", k: 9, a: 1304, t: [] }, { l: "5", n: 5, u: "homes", k: 8, a: 1200, t: ["1 bedroom"] }],
  types: [{ t: "1 bedroom", c: "1", units: 164, lo: 5, hi: 14, sqm: 103.5, aed: 1256938, est: false, rent: 80000, yield: 6.4 }], total_units: 760, developer: "Windsor Developments",
  project: { name: "Windsor Manor", status: "ACTIVE", pct: 40, end: "2028-12-31" } } } };
const unitmix = { district: SLUG, generated: "2026-10-07", buildings_by_id: { [ID]: { status: "verified", name: "Windsor Manor", developer: "Windsor Developments", total_units: 760, asset_classes: { residential: 338 }, floors: 37, car_parks: 988, rows: [{ type: "1 bedroom", configuration: "102 m2 median", median_sqm: 103.5, levels: "5-14 (9 levels)", units: 164, basis: "DLD units register", median_aed: 1256938 }] } } };
const mkEnv = (extra) => {
  const store = new Map([["img_stack_" + SLUG, JSON.stringify(stack)], ["img_unitmix_" + SLUG, JSON.stringify(unitmix)]]);
  for (const [k, v] of Object.entries(extra || {})) store.set(k, JSON.stringify(v));
  return { MEETINGS: { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list() { return { keys: [], list_complete: true }; } }, READ_KEY: READ, CLIENT_KEY: "client_key_current_abcdefghij", RESIDENTS_KEY: "residents_key_long_enough_012345", INGEST_TOKEN: "ING" };
};
globalThis.fetch = async () => new Response("{}", { status: 200 });
const pageOf = async (extra, mut) => { if (mut) mut(); const r = await worker.fetch(new Request("https://x/building/" + SLUG + "/" + ID + "?key=" + READ), mkEnv(extra), { waitUntil() {} }); return { status: r.status, html: await r.text() }; };
const base = await pageOf({});
ok(base.status === 200 && base.html.includes("Windsor Manor") && !/Cash needed up to handover/.test(base.html), "the building renders; with no payment-plan file on file there is no cash card");
const other = await pageOf({ img_payment_plans: { projects: { "x|y": Object.assign({}, REC, { aliases: ["Somewhere Else"], developer: "Other" }) } } });
ok(other.html === base.html, "a payment-plan file with no record for this building: the page is byte-for-byte the page without the file");
const withCard = await pageOf({ img_payment_plans: DOC });
ok(withCard.status === 200 && /Cash needed up to handover/.test(withCard.html) && /AED 600,000/.test(withCard.html) && withCard.html.indexOf("Cash needed up to handover") < withCard.html.indexOf("Construction"), "an ACTIVE off-plan building with a record: the card sits above 'Construction - the register'");
ok(!/registration fee/i.test(withCard.html.slice(withCard.html.indexOf("Cash needed up to handover"), withCard.html.indexOf("Cash needed up to handover") + 3000)), "and prints no fee line (the flag is off)");
const fin = JSON.parse(JSON.stringify(stack)); fin.buildings_by_id[ID].project = { name: "Windsor Manor", status: "FINISHED", pct: 100, end: "2024-12-31" };
const stackSave = stack.buildings_by_id[ID].project;
stack.buildings_by_id[ID].project = fin.buildings_by_id[ID].project;
const done = await pageOf({ img_payment_plans: DOC });
stack.buildings_by_id[ID].project = stackSave;
ok(done.status === 200 && !/Cash needed up to handover/.test(done.html), "a FINISHED project (not off-plan): no card, even with a plan and a price on file");
delete unitmix.buildings_by_id[ID].developer;
const noDev = await pageOf({ img_payment_plans: DOC });
unitmix.buildings_by_id[ID].developer = "Windsor Developments";
ok(noDev.status === 200 && !/Cash needed up to handover/.test(noDev.html) && !/Windsor Developments/.test(noDev.html.split("Cash needed")[0].slice(0, 0)), "a building with no developer stated: not matched by name alone");

// ---------------------------------------------------------------------------------------------------------- C. the delivery record
console.log("C - the delivery record on the developer page");
const html = devmapHtml("k", { NAJ_NAV_CSS: "", NAJ_FONTS: "", najNav: () => "" });
const js = html.slice(html.indexOf("<script>", html.indexOf("maplibre-gl.js")) + 8, html.lastIndexOf("</script>"));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "v375_"));
fs.writeFileSync(path.join(tmp, "page.js"), js);
ok(spawnSync(process.execPath, ["--check", path.join(tmp, "page.js")], { encoding: "utf8" }).status === 0, "the page script is valid JavaScript (node --check)");
const cutOf = (src) => (a, b) => src.slice(src.indexOf(a), src.indexOf(b));
const harness = (jsSrc, IDXX, S, withDelay) => {
  const cut = cutOf(jsSrc);
  const s0 = cut("function esc(t)", "function api("), s1 = cut("function fmt(n)", "(function(){var b=new URLSearchParams(location.search).get(\"bounds\")");
  const s4 = cut("var STATS={},IXC={};", "function features()") + cut("var MON=", "function barsSvg(");
  const s3 = cut("var DRILLSET=null", "function devTier(k)");
  const fn = new Function("DM", "IDX", "S", "TC", "DEFAULT_NAMES", "setSheet", "renderDetail", "refreshMap", "EVI", "innerWidth", "var fetch=function(){return new Promise(function(){})};" + s0 + s1 + s4 + cut("function clipName", "function devHead(") + cut("function bar(arr", "function devRow(") + s3 +
    "; return {profileHtml:profileHtml,evidenceHtml:evidenceHtml" + (withDelay ? ",delayHtml:delayHtml,delayRow:delayRow" : "") + "};");
  return fn(DM, IDXX, S, ["#c5a56a", "#2f8a7f", "#3987e5", "#8a9a96"], {}, () => {}, () => {}, () => {}, PHOSPHOR_LIGHT, 1200);
};
DM.TIER_CFG.bounds = [30000, 20000, 12000];
const vx = (p, di, e) => ({ e: e || "REGISTER_VERIFIED", p, di, dn: "X", m: "project_id", a: "Area A", h: 0 });
const mkIdx = () => ({ as_of: "2026-09-09", cuts: { bounds: [30000, 20000, 12000] }, devs: { x: { name: "X", areas: 1, n: 30, profile: { projects: 3, homes: 0 } }, y: { name: "Y", areas: 1, n: 12, profile: { projects: 1, homes: 0 } }, w: { name: "W", areas: 1, n: 12, profile: { projects: 1, homes: 0 } }, z: { name: "Z", areas: 1, n: 12, profile: { projects: 1, homes: 0 } } }, areas: {
  a: { name: "Area A", devs: {
    x: { n: "X", h: 0, c: [[30, 21000, 1e6, 1]], b: [[10, 35000, "Tower One"], [10, 15000, "Tower Two"], [10, 14000, "Tower Three"]], bx: [vx(1, 111), vx(2, 111), vx(3, 222, "NAME_ONLY")], r: [] },
    y: { n: "Y", h: 0, c: [[12, 15000, 1e6, 1]], b: [[12, 15000, "Y Hall"]], bx: [vx(4, 333)], r: [] },
    w: { n: "W", h: 0, c: [[12, 15000, 1e6, 1]], b: [[12, 15000, "W Court"]], bx: [vx(5, 555, "NAME_ONLY")], r: [] },
    z: { n: "Z", h: 0, c: [[12, 15000, 1e6, 1]], b: [[12, 15000, "Z Plaza"]], bx: [vx(6, 333), vx(7, 444)], r: [] } } } } });
const DELAY = { version: 1, generated: "2026-10-07 08:00", min_projects: 3, by: {
  "111": { name: "X ONE REAL ESTATE L.L.C", n: 4, late: 1, m: [6.0] },
  "222": { name: "NAME ONLY CO", n: 9, late: 9, m: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  "333": { name: "SMALL CO", n: 2, late: 1, m: [3] }, "444": { name: "ONE MORE CO", n: 1, late: 0, m: [] },
  "555": { name: "CLAIMED CO", n: 8, late: 4, m: [2, 2, 2, 2] } } };
// the delivery record, in the shared logic
const rx = DM.delayRecord(DELAY, mkIdx(), "x");
ok(rx && rx.n === 4 && rx.late === 1 && rx.share === 25 && rx.median === 6 && rx.companies === 1, "developer X: only the register-confirmed company counts (4 projects, 1 late, 25%, median 6 months); the NAME_ONLY project's company (9 projects) is not counted", JSON.stringify(rx));
ok(DM.delayRecord(DELAY, mkIdx(), "w") === null, "a developer whose only project is matched by name has no delivery record, whatever the file holds for that company (8 projects)");
ok(DM.delayRecord(DELAY, mkIdx(), "y") === null, "a company with 2 projects that have both dates: nothing shown (under 3)");
const rz = DM.delayRecord(DELAY, mkIdx(), "z");
ok(rz && rz.n === 3 && rz.late === 1 && rz.companies === 2, "two register-confirmed companies together reach 3: shown (the threshold is exactly 3)", JSON.stringify(rz));
ok(DM.delayRecord(null, mkIdx(), "x") === null && DM.delayRecord({}, mkIdx(), "x") === null && DM.delayRecord(DELAY, { areas: { a: { devs: { x: { b: [[1, 1, "a"]] } } } } }, "x") === null && DM.delayRecord(DELAY, mkIdx(), "nobody") === null, "no file, an empty file, an index with no evidence, an unknown developer: null");
const idx12 = mkIdx(); const dd = idx12.areas.a.devs.x; dd.b12x = dd.bx; delete dd.bx;
ok(DM.delayRecord(DELAY, idx12, "x") && DM.delayRecord(DELAY, idx12, "x").n === 4, "the last-12-month evidence list is read too");
const med = DM.delayRecord({ by: { "1": { n: 4, late: 4, m: [1, 2, 3, 10] } } }, { areas: { a: { devs: { k: { bx: [vx(1, 1)] } } } } }, "k");
ok(med && med.median === 2.5 && med.share === 100, "the median of an even number of late projects is the middle pair's mean");

// the card on the page
const S = { evOpen: false, prof: null, drill: null, parea: null, sel: "a", unit: "sqft", win: "all", delay: DELAY };
const P = harness(js, mkIdx(), S, true);
const hx = P.profileHtml("x");
ok(/id=delay/.test(hx) && /Delivery record/.test(text(hx.slice(hx.indexOf("id=delay"), hx.indexOf("id=delay") + 400))) && /DERIVED/.test(hx.slice(hx.indexOf("id=delay"), hx.indexOf("id=delay") + 400)), "developer X's page has a 'Delivery record' card labelled DERIVED");
const dc = text(hx.slice(hx.indexOf("id=delay"), hx.indexOf("</div></div>", hx.indexOf("id=delay") + 300) + 20) + hx.slice(hx.indexOf("id=delay") + 400, hx.indexOf("id=delay") + 2200));
ok(/1 of its 4 finished projects \(25%\) were finished later than the planned end date/.test(dc) && /about 6 months late/.test(dc), "the sentence: 1 of its 4 finished projects (25%) finished later than the planned end date; about 6 months late", dc.slice(0, 500));
ok(/Developers can revise the planned end date on the register/.test(dc) && /This is history, not a forecast/.test(dc), "the caveat is on the screen: developers can revise the planned end date; history, not a forecast");
ok(/Dubai Land Department project register/.test(dc) && /X ONE REAL ESTATE L\.L\.C/.test(dc) && /read 2026-10-07/.test(dc) && /middle figure is taken over the late ones only/.test(dc), "source and method are on the card, with the register company counted and the date read");
ok(!/will it be late|will this be late|will be late|going to be late/i.test(hx) && !EMOJI.test(hx.slice(hx.indexOf("id=delay"), hx.indexOf("id=delay") + 2200)), "never 'will it be late'; no emoji");
ok(hx.indexOf("id=delay") > hx.indexOf("Positioning evidence") && /Shown in the Delivery record card on this page/.test(text(hx)) && !/Not in this data yet: it needs the register/.test(text(hx)), "the old 'not in this data yet' evidence row now points at the card, so the page does not contradict itself");
ok(!/id=delay/.test(P.profileHtml("y")) && !/id=delay/.test(P.profileHtml("w")), "developers with under 3 projects (Y), or only name-matched projects (W): no card, and no placeholder");
ok(!/Delivery record card|id=delay/.test(P.profileHtml("w")) && /Not in this data yet: it needs the register/.test(text(P.profileHtml("w"))), "for them the evidence row says exactly what it said before");
const allLate = Object.assign({}, DELAY, { by: { "111": { name: "X ONE", n: 3, late: 0, m: [] } } });
const P2 = harness(js, mkIdx(), Object.assign({}, S, { delay: allLate }), true);
ok(/None of its 3 finished projects was finished later than the planned end date/.test(text(P2.profileHtml("x"))) && !/months late/.test(text(P2.profileHtml("x"))), "none late: said plainly, no median");

// old data without the new keys renders exactly as before
console.log("C2 - old data renders exactly as before");
const arch = path.join(tmp, "old.tar");
const g = spawnSync("git", ["-C", ROOT, "archive", "fc821de", "src", "-o", arch], { encoding: "utf8" });
const x = spawnSync("tar", ["-xf", "old.tar"], { cwd: tmp, encoding: "utf8" });   // relative names: GNU tar reads "C:" as a remote host
ok(g.status === 0 && x.status === 0 && fs.existsSync(path.join(tmp, "src", "devmap_page.js")), "the v373 page source is recovered from git for comparison", g.stderr + x.stderr);
const old = await import(pathToFileURL(path.join(tmp, "src", "devmap_page.js")).href);
const oldHtml = old.devmapHtml("k", { NAJ_NAV_CSS: "", NAJ_FONTS: "", najNav: () => "" });
const oldJs = oldHtml.slice(oldHtml.indexOf("<script>", oldHtml.indexOf("maplibre-gl.js")) + 8, oldHtml.lastIndexOf("</script>"));
const Pold = harness(oldJs, mkIdx(), { evOpen: false, prof: null, drill: null, parea: null, sel: "a", unit: "sqft", win: "all" }, false);
const Pnew = harness(js, mkIdx(), { evOpen: false, prof: null, drill: null, parea: null, sel: "a", unit: "sqft", win: "all" }, true);
// v385: a card with no map position is now a 'Project details' button instead of a div; that one change is normalised away so every other character is still compared
const v385 = (h) => String(h).replace(/<button type=button class="pjc noloc"[^>]*>([^]*?)<\/button>/g, '<div class="pjc noloc">$1</div>').replace(/<span class="tagl pd">[^]*?<\/span>/g, "");
for (const k of ["x", "y", "w", "z"]) ok(v385(Pold.profileHtml(k)) === v385(Pnew.profileHtml(k)),"developer " + k + ": the profile with no delay file is identical, character for character, to v373's");
const Pnull = harness(js, mkIdx(), { evOpen: false, prof: null, drill: null, parea: null, sel: "a", unit: "sqft", win: "all", delay: {} }, true);
ok(v385(Pnull.profileHtml("x")) === v385(Pold.profileHtml("x")),"an empty delay file ({}) changes nothing either");
ok(js.includes('api("delay").catch(function(){return null})') && js.includes("S.delay=r[3]&&r[3].by?r[3]:null"), "the page asks for the delay file and a failure to load it leaves the page as it was");
// the route serves the file, or {} when it is not on file
const mkR = (store) => ({ MEETINGS: { async get(k) { return store[k] == null ? null : JSON.stringify(store[k]); } } });
const call = async (store) => { const r = await devmapRoutes(new Request("https://x/developers_map_api?what=delay&key=k"), mkR(store), new URL("https://x/developers_map_api?what=delay&key=k"), { clientOk: () => true }); return { status: r.status, body: await r.json() }; };
const r1 = await call({ img_devmap_delay: DELAY }), r2 = await call({});
ok(r1.status === 200 && r1.body.by && r1.body.by["111"].n === 4, "what=delay serves KV img_devmap_delay");
ok(r2.status === 200 && JSON.stringify(r2.body) === "{}", "and {} (not an error) when it is not on file yet");
// the delivery file the script wrote
const DR = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "delivery_record", "delivery_record.json"), "utf8"));
const rows = Object.values(DR.by);
ok(DR.label === "DERIVED" && /history, not a forecast/.test(DR.caveat) && rows.length > 100 && rows.every((r) => r.n >= r.late && r.late === r.m.length && r.m.every((v) => v > 0)), "the delivery file: DERIVED, caveat, " + rows.length + " register developer companies; late projects equal the months listed, each over 0", DR.generated);
ok(rows.filter((r) => r.n >= 3).length >= 50 && rows.reduce((t, r) => t + r.late, 0) > 50, "real data: " + rows.filter((r) => r.n >= 3).length + " companies have 3 or more projects with both dates; " + rows.reduce((t, r) => t + r.late, 0) + " late projects in all");
const sm = spawnSync("python", ["-c", "import sys; sys.path.insert(0, r'" + path.join(ROOT, "scripts") + "'); import build_delivery_record as b, datetime as d; D=d.date; t=D(2026,10,7); r=b.summarise([(1,D(2026,1,1),D(2026,1,1)),(2,D(2026,1,1),D(2026,3,2)),(3,D(2026,1,1),D(2027,1,1)),(4,None,D(2026,1,1)),(5,D(2026,1,1),None)], t); print(r['n'], r['late'], r['m'])"], { encoding: "utf8" });
ok(/^2 1 \[1\.97\]/.test(sm.stdout.trim()), "the rule on a tiny register: one on time and one 60 days late counted; a completion date in the future and a missing date left out (2 counted, 1 late, 1.97 months)", sm.stdout + sm.stderr);
fs.rmSync(tmp, { recursive: true, force: true });

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
