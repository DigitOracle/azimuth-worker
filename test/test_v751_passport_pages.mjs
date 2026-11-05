// v751 - Building Passport pages 2 and 3 drawn by the worker as visuals (Kendall, 4 Nov 2026, Luma Park Views on the phone: "way too much
// text ... tell the story through the infographics"). Checked against the STORED rows for Luma Park Views (test/fixtures_v751, read from KV
// on 4 Nov 2026), never against a hand-made fixture. The real-Chrome 3-page print is test/render_v751_pages.mjs.
import fs from "fs";
import { pageFigures, pagesBlocks, placePages, PAGES_CSS } from "../src/passport_pages.js";
import { withNb } from "../src/passport_neighbourhood.js";
const B = await import("../src/building_passports.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 500)); } };
const d = JSON.parse(fs.readFileSync(new URL("./fixtures_v751/luma_park_views.json", import.meta.url), "utf8"));
const TODAY = "2026-11-04", pack = withNb(d.pack, { nb: d.nb, dna: d.dna }), f = B.bppFacts(d.pp, pack, TODAY);
const F = pageFigures(d.pp, pack, TODAY, f);

// 1. the figures are the stored figures
ok(F.physical.floors === 25 && F.physical.homes === 600 && F.physical.car_parks === 853 && F.physical.lifts === 6 && F.physical.shops === 6, "page 2 building tiles = buildings/units register", F.physical);
ok(F.mix.map((m) => m.label + " " + m.n).join(",") === "1 bed 445,3 bed 96,2 bed 59", "unit mix donut = units register", F.mix);
ok(F.construction.status === "ACTIVE" && F.construction.pct === 95.01 && F.construction.stale === 142, "construction ring 95.01%, register 142 days old", F.construction);
ok(F.rentals.contracts === 407 && F.rentals.adverts.rent === 173 && F.rentals.renewals.n === 0, "rentals tiles = tenancy register + adverts", F.rentals);
ok(F.rentals.rows.find((r) => r.b === "1").reg === 80000, "1 bed registered rent 80,000", F.rentals.rows);
ok(F.sales.ready.deals_12m === 243 && F.sales.years.length === 3, "sales: 243 ready in 12 months, three years of medians", F.sales.ready);
ok(F.occupancy.homes === 600 && F.occupancy.let === 407 && F.occupancy.adverts === 173 && F.occupancy.rest === 20, "occupancy bar 407 / 173 / 20 of 600, no vacancy %", F.occupancy);
ok(F.neighbourhood.places[0].k === "metro" && F.neighbourhood.places[0].km === 5.7 && F.neighbourhood.drive.length === 3, "neighbourhood: metro 5.7 km straight line, 3 drive times", F.neighbourhood);
ok(F.google.kind === "building" && F.google.rating === 4.8 && F.google.count === 330, "Google 4.8 from 330", F.google);
ok(F.district.overall === 60 && F.district.dims.length === 9, "district DNA 60, nine dimensions", F.district);
ok(F.brokers.length === 4 && F.brokers[0].agent && F.brokers[0].firm && F.brokers[0].phone, "broker cards keep agent, agency, phone", F.brokers[0]);

// 2. the pages: two .page boxes, numbered 2 and 3, own footer, no emoji, nothing invented
const { p2, p3 } = pagesBlocks(d.pp, pack, TODAY, f, B.bppDate(TODAY));
ok(/data-bpp-det="2"/.test(p2) && /page 2 of 4/.test(p2) && /data-bpp-det="3"/.test(p3) && /page 3 of 4/.test(p3), "pages 2 and 3 with their own footers");
ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(p2 + p3), "no emoji characters");
ok(/Not available yet/.test(p3) && /Service charge/.test(p3), "service charge stays a grey Not available yet pill");
ok(!/gpt|openai|claude|gemini/i.test(p2 + p3 + PAGES_CSS), "no AI model named");
ok(/@media screen and \(max-width:800px\)/.test(PAGES_CSS) && /\.bd-foot\{position:static!important/.test(PAGES_CSS), "phone: one column, the footer below the content, never over it");

// 3. the splice keeps the writer's page 1 and drops anything it wrote after it
const W = '<!doctype html><html><head><style>x</style></head><body><section class="page">ONE</section><section class="page">TWO</section><section class="page">THREE</section></body></html>';
const S = placePages(W, p2, p3);
ok((S.match(/class="page/g) || []).length === 3 && S.indexOf("ONE") > 0 && S.indexOf("TWO") < 0 && S.indexOf("THREE") < 0, "splice: writer page 1 kept, its pages 2-3 replaced");
ok(placePages(placePages(W, p2, p3), p2, p3).match(/id="bpp-det"/g).length === 1, "splice twice: one style block");
const S1 = placePages('<html><head></head><body><section class="page">ONE</section></body></html>', p2, p3);
ok((S1.match(/class="page/g) || []).length === 3, "a page-1-only writer document gets pages 2 and 3");

// 4. the tick draws the pages before the logo is inlined; the prompt asks the writer for page 1 only
const src = fs.readFileSync(new URL("../src/building_passports.js", import.meta.url), "utf8");
ok(/const pages = await bppPages\(env, r\.plot_id, now\)/.test(src) && /withLogo\(env, pages \? placePages\(html, pages\.p2, pages\.p3, pages\.p4\) : html\)/.test(src), "tick: pages placed, then the logo");
const pr = B.bppPrompt(f, "4 Nov 2026");
ok(/write ONLY page 1/.test(pr) && !/page 3 = the detail/.test(pr), "prompt: page 1 only");
console.log("v751 passport pages: " + pass + " passed, " + fail + " failed");
if (fail) process.exitCode = 1;
