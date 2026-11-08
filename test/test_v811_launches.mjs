// v811 (Kendall 8 Nov 2026, "Go ahead"): truthful New launches. One card per project, the launch date by order of trust (first register sale
// ~ a news-stated launch > register start > developer post > first seen), a status pill from the register, sorted by launch_date, Hot this
// month, Coming soon, Area filter (register area / district; the 2040 zone is off the filter), developer + launch-date range, EOI / allocation.
import assert from "node:assert/strict";
import fs from "node:fs";
import { tidyLaunches, mergeLaunches, launchStatus, launchSay, statusSay, baseName, pickRows } from "../src/launch_report.js";
import { launchCards, launchesPage, selectLaunches, areaOptions } from "../src/launches_card.js";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; }; const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };
const TODAY = "2026-11-08";
const JA = { area: "Down Town Jabal Ali", area_dld: "Jabal Ali Industrial Second", district: "Jebel Ali Industrial 2" };
const row = (o) => Object.assign({ developer: "Imtiaz", from_aed: 900000, sources_n: 1, registered: true, confidence: "high", last_seen: "2026-11-07" }, o);

// ---- 1. the Raw District variants merge (an older snapshot, no project_id: the worker's own merge)
eq(baseName("RAW DISTRICT 2 TOWER C BY IMTIAZ", "Imtiaz"), ["raw district 2", "tower c"], "Tower C is a part of Raw District 2");
eq(baseName("Raw District II by Imtiaz (Sheikh Zayed Road)", "Imtiaz"), ["raw district 2", ""], "II = 2, the road suffix dropped");
eq(baseName("RAW DISTRICT BY IMTIAZ CR", "Imtiaz"), ["raw district", "cr"], "the register's CR part");
const raw = [
  row(Object.assign({ key: "ap_3bf74e9feebf", project: "RAW DISTRICT 2 BY IMTIAZ", dld_project_number: 4526, first_seen: "2026-11-07", sales_n: 448, planned_units: 770, first_sale_date: "2026-08-13", sales_30d: 259, start_date: "2026-12-01" }, JA)),
  row(Object.assign({ key: "ap_64ed03bed5a7", project: "RAW DISTRICT 2 TOWER C BY IMTIAZ", dld_project_number: 4555, first_seen: "2026-11-07", sales_n: 0, planned_units: 149, start_date: "2026-12-01" }, JA)),
  row({ key: "ap_5506c4fe62af", project: "Raw District II by Imtiaz (Sheikh Zayed Road)", registered: false, first_seen: "2026-09-02", area: "Sheikh Zayed Road" }),
  row(Object.assign({ key: "ap_941cc71285a9", project: "RAW DISTRICT BY IMTIAZ R", dld_project_number: 4500, first_seen: "2026-10-15", sales_n: 619, planned_units: 672, first_sale_date: "2026-07-10", sales_30d: 40 }, JA)),
  row(Object.assign({ key: "ap_5bb80e648951", project: "RAW DISTRICT BY IMTIAZ CR", dld_project_number: 4498, first_seen: "2026-10-15", sales_n: 543, planned_units: 610, first_sale_date: "2026-07-09", sales_30d: 24 }, JA)),
];
const kore = [row({ key: "ap_272fb4cad0d8", project: "KORE", dld_project_number: 4549, area: "Dubai Land Residence Complex", area_dld: "Wadi Al Safa 5", district: "Wadi Al Safa 5", first_seen: "2026-11-06", sales_n: 0, planned_units: 351, start_date: "2026-11-15", launch_date: "2026-11-15", launch_basis_kind: "register_start" }),
  row({ key: "ap_568a2a6bcabd", project: "KORE by Imtiaz", dld_project_number: 4549, area: "Dubai Land Residence Complex", area_dld: "Wadi Al Safa 5", district: "Wadi Al Safa 5", first_seen: "2026-11-15", sales_n: 0, planned_units: 0, start_date: "2026-11-15", launch_date: "2026-11-15", launch_basis_kind: "register_start" })];
const other = [row({ key: "ap_aaaaaaaaaaa1", project: "Old Imtiaz Tower", area: "Arjan", area_dld: "Al Barsha South Fourth", district: "Arjan", launch_date: "2025-03-01", launch_basis_kind: "register_sale", sales_n: 300, planned_units: 310 }),
  row({ key: "ap_aaaaaaaaaaa2", developer: "Binghatti", project: "Binghatti Skyterraces", area: "Motor City", area_dld: "Al Hebiah Fourth", district: "Motor City", launch_date: "2026-09-20", launch_basis_kind: "register_sale", sales_n: 500, planned_units: 900, sales_30d: 231 })];
const snap = { generated: TODAY, rows: [...raw, ...kore, ...other] };
const t = tidyLaunches(snap).rows;
const rd2 = t.filter((r) => /raw district 2/i.test(r.project)), rd = t.filter((r) => /^raw district$/i.test(r.project));
eq(rd2.length, 1, "Raw District 2, its Tower C and 'Raw District II (Sheikh Zayed Road)' are ONE card");
eq(rd2[0].project, "Raw District 2", "the card carries the scheme's name, not a tower's");
eq(rd2[0].merged_keys.sort(), ["ap_3bf74e9feebf", "ap_5506c4fe62af", "ap_64ed03bed5a7"], "every variant's key is kept");
eq(rd2[0].first_seen, "2026-09-02", "first_seen is the earliest over all variants");
eq(rd2[0].launch_date, "2026-08-13", "the launch date is the first register sale, not the 7 Nov tower row");
eq(rd.length, 1, "Raw District R and CR are one card");
eq(rd[0].launch_date, "2026-07-09", "Raw District launched 9 Jul (first sale of either part)");
ok(rd[0] !== rd2[0], "Raw District and Raw District 2 stay two projects (different names)");
eq(t.filter((r) => /kore/i.test(r.project)).length, 1, "KORE and KORE by Imtiaz are one card");
eq(pickRows(t, ["ap_64ed03bed5a7"])[0].project, "Raw District 2", "a merged variant's key opens its project's report");
// a different register area is never merged
const two = mergeLaunches([row({ key: "ap_b1", project: "Sky Gardens", area_dld: "Al Barsha South Fourth" }), row({ key: "ap_b2", project: "Sky Gardens", area_dld: "Business Bay" })]);
eq(two.length, 2, "the same name in two register areas is two projects");
// collector-merged rows (project_id) are left alone
eq(mergeLaunches([row({ key: "ap_c1", project: "X", project_id: "lp_1" })]).length, 1, "a project_id row passes through");

// ---- 2. Kore shows as Coming soon; statuses
const K = t.find((r) => /kore/i.test(r.project));
eq(launchStatus(K, TODAY).status, "coming_soon", "Kore: on the register, no sales, starts 15 Nov: Coming soon");
eq(launchSay(K, TODAY), "Register start 15 Nov 2026", "Kore's date says what it is");
eq(statusSay(rd[0], TODAY), "Nearly sold out · 91% sold", "Raw District 1,162 of 1,282: Nearly sold out");
eq(statusSay(rd2[0], TODAY), "Selling · 49% sold", "Raw District 2 448 of 919 (with Tower C): Selling 49%");
eq(launchSay(rd2[0], TODAY), "Launched 13 Aug 2026 · 448 sold", "the card's launch line");
eq(launchStatus({ registered: true, sales_n: 120, planned_units: 400, launch_date: "2026-10-25" }, TODAY).status, "just_launched", "first sale 2 weeks ago: Just launched");
eq(statusSay({ registered: true, sales_n: 50, planned_units: 0, launch_date: "2026-01-01" }, TODAY), "Selling", "no planned units: no percentage");
eq(launchSay({ launch_date: "2026-02-02", launch_basis_kind: "news", launch_source: "Khaleej Times" }, TODAY), "Launched 2 Feb 2026 (Khaleej Times)", "a news-stated launch");
eq(launchSay({}, TODAY), "Launch date unknown", "no evidence, no date");

// ---- 3. EOI / allocation (Kendall + Najjuko 8 Nov: 0 register sales is not unsold)
eq(launchStatus({ registered: true, sales_n: 0, planned_units: 300, start_date: "2026-12-01", eoi_note: "news:Gulf News mentions EOI; the register shows 0 sales" }, TODAY).label, "EOI / allocation pending", "EOI talk + 0 sales: EOI / allocation pending, not Coming soon");
eq(launchStatus({ registered: true, sales_n: 12, planned_units: 300, launch_date: "2026-10-01", eoi_note: "x mentions sold out" }, TODAY).status, "eoi", "sold out claimed, 12 register sales: EOI pending");
eq(launchStatus({ registered: true, sales_n: 280, planned_units: 300, launch_date: "2026-06-01", eoi_note: "x" }, TODAY).status, "nearly_sold_out", "after allocation the register decides");
const eoiCard = launchCards([row({ key: "ap_e1", project: "Allocation Tower", area: "JVC", sales_n: 12, planned_units: 300, launch_date: "2026-10-01", launch_basis_kind: "register_sale", eoi_note: "developer_site mentions sold out; the register shows 12 sales", dev_vs_register: "Developer: sold out (EOI) · Register: 12 sold so far" })], TODAY, "");
ok(eoiCard.includes("EOI / allocation pending") && eoiCard.includes("Developer statement (EOI) differs from the register · Register: 12 sales registered so far") && !/sold/i.test(eoiCard), "v824: both facts side by side, evidence wording, no 'sold'");
// v824: no "sold out" / "% sold" anywhere on a card; the register count with its date instead
{ const C = await import("../src/launches_card.js");
  const hi = C.cardStatus({ registered: true, sales_n: 1162, planned_units: 1282, launch_date: "2026-03-01", sales_as_of: "2026-10-15" }, TODAY);
  eq([hi.status, hi.label], ["high_sales", "1,162 sales registered to 15 Oct"], "v824: the old nearly_sold_out reads as registered sales");
  eq(C.cardStatus({ registered: true, sales_n: 0, planned_units: 300, launch_date: "2026-06-01", launch_basis_kind: "register_start" }, TODAY).label, "Registered · no sales yet", "v824: no sales");
  const cards = launchCards(rd.concat(rd2).map((x) => Object.assign({}, x, { sales_as_of: "2026-10-15" })), TODAY, "");
  ok(!/sold/i.test(cards.replace(/<style[\s\S]*?<\/style>/g, "")) && cards.includes("448 sales registered to 15 Oct"), "v824: no sold / sold-out / % sold wording on the cards", cards.match(/[^>]{0,40}sold[^<]{0,40}/gi)); }
const camp = launchCards([Object.assign({}, rd2[0], { campaign_note: "Seen in a campaign today, but already 448 sold on the register since 13 Aug 2026: not a new launch" })], TODAY, "");
ok(camp.includes("not a new launch"), "a campaign sighting of a selling project says so");

// ---- 4. sort order follows launch_date
const all = selectLaunches(t, {}, TODAY).map((r) => r.project);
eq(all, ["Binghatti Skyterraces", "Raw District 2", "Raw District", "Old Imtiaz Tower", "Kore"], "v811b: LAUNCHED first, newest launch_date first (never first_seen); Coming soon after");
eq(selectLaunches(t, { tab: "hot" }, TODAY).map((r) => r.project), ["Raw District 2", "Binghatti Skyterraces", "Raw District"], "Hot this month by register sales, last 30 days");
eq(selectLaunches(t, { tab: "soon" }, TODAY).map((r) => r.project), ["Kore"], "Coming soon");
const far = selectLaunches([...t, row({ key: "ap_f1", project: "Far Tower", area: "JVC", launch_date: "2027-09-30", launch_basis_kind: "register_start", sales_n: 0 })], {}, TODAY).map((r) => r.project);
ok(far.indexOf("Far Tower") === far.indexOf("Kore") + 1, "Coming soon after the launched ones, soonest first");
const ann = selectLaunches([...t, row({ key: "ap_n1", project: "Announced Only", area: "JVC", registered: false, launch_date: "2026-11-07", launch_basis_kind: "first_seen", sales_n: 0 })], {}, TODAY).map((r) => r.project);
eq(ann[ann.length - 1], "Announced Only", "announced, no date: at the bottom");
eq(launchStatus({ registered: false, launch_date: "2026-11-07", launch_basis_kind: "first_seen" }, TODAY).label, "Announced · no date yet", "no register start, no press date: not Coming soon");
eq(launchSay({ registered: false, launch_date: "2026-11-07", launch_basis_kind: "first_seen" }, TODAY), "No launch date yet", "and no date on the card");
eq(statusSay({ registered: true, sales_n: 0, planned_units: 80, launch_date: "2026-07-15", launch_basis_kind: "news" }, TODAY), "Registered · no sales yet", "Elinor: on the register 4 months, 0 sales: not Selling");
eq(launchSay(Object.assign({}, rd2[0], { sales_as_of: "2026-10-15" }), TODAY), "Launched 13 Aug 2026 · 448 sold to 15 Oct", "a sales count carries the register date");
eq(selectLaunches(t, { tab: "week" }, TODAY).length, 0, "nothing launched this week (Raw District 2's 7 Nov tower row does not make it new)");

// ---- 5. Area filter
eq(selectLaunches(t, { area: "Jebel Ali Industrial 2" }, TODAY).map((r) => r.project), ["Raw District 2", "Raw District"], "by district");
eq(selectLaunches(t, { area: "wadi al safa 5" }, TODAY).map((r) => r.project), ["Kore"], "by register area");
ok(areaOptions(t).includes("Jebel Ali Industrial 2") && areaOptions(t).includes("Wadi Al Safa 5"), "the districts in the data are offered");

// ---- 6. Imtiaz, last 4 months
eq(selectLaunches(t, { dev: "imtiaz", days: 122 }, TODAY).map((r) => r.project), ["Raw District 2", "Raw District", "Kore"], "Imtiaz last 4 months: Kore (coming), Raw District 2, Raw District; not a 2025 project, not Binghatti");
eq(selectLaunches(t, { dev: "imtiaz", from: "2026-08-01", to: "2026-11-08" }, TODAY).map((r) => r.project), ["Raw District 2"], "a custom range on launch_date");

// ---- 7. the page
const page = launchesPage("k", "", tidyLaunches(snap), TODAY);
ok(page.includes("for=zn>Area<") && !page.includes(">Dubai 2040 zone<"), "the filter says Area, the 2040 zone is off it");
ok(page.includes("data-f=hot>Hot this month") && page.includes("data-f=soon>Coming soon"), "Hot this month and Coming soon tabs");
ok(page.includes('data-r=122>Last 4 months'), "launch-date range presets");
ok(page.indexOf('data-project="Raw District 2"') < page.indexOf('data-project="Kore"'), "the page is served launched-first, in launch_date order");
const page2 = launchesPage("k", "", Object.assign(tidyLaunches(snap), { sales_as_of: "2026-10-15" }), TODAY);
ok(page2.includes("Off-plan sales in the last 30 days · Register sales to 15 Oct"), "Hot this month says how far the register runs");
ok(/data-launch=/.test(page) && /f=c\.getAttribute\("data-launch"\)/.test(page), "Make a report periods use launch_date");
const card = fs.readFileSync(new URL("../src/launches_card.js", import.meta.url), "utf8"), rep = fs.readFileSync(new URL("../src/launch_report.js", import.meta.url), "utf8");
ok(!/first seen " \+ dSay/.test(rep) && /\["note", "Launch", launchSay/.test(rep), "the report shows the launch date and status, not first seen");
ok(/launchStatus/.test(card), "the card uses the shared status rules");
console.log("v811 launches:", n, "checks passed");
