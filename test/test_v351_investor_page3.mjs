// v351 - the investor PDF grows from two pages to as many as five: 3 The investor decision, 4 The evidence, 5 Scenarios.
// Synthetic index and a sample record with the shape of KV img_investor3 (built by scripts/investor3_build.py in the data repo). Nothing live is read or written.
import { buildAreaPdf, parseParams, devmapPdfRoute } from "../src/devmap_pdf.js";
import { irr, npv, backtest, replay, scenario, annual, TRANSFER_FEE } from "../src/devmap_irr.js";
import { page3, page4, page5, scenarioSet, figures, SCENARIO_DISCLAIMER, BACKTEST_NOTE } from "../src/devmap_investor3.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-6);
const SQFT = 10.7639, sqm = (psf) => Math.round(psf * SQFT);
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B55}\u{FE0F}\u{200D}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{25A0}-\u{25FF}]/u;
const BANNED = /not known|to follow|crosswalk|\bKV\b|\bindex\b|claude|gpt|gemini|openai|anthropic|\bexpect|will earn|guarantee[sd]? (a|the|you)|best buy|buy this|\bINTERNAL\b|NOT FOR CLIENTS/i;
const text = (html) => html.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<svg[\s\S]*?<\/svg>/g, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ");

console.log("the IRR solver, against cases worked by hand");
{
  ok(near(irr([-100, 110]), 0.10, 1e-9), "-100 then 110 is exactly 10%");
  ok(near(irr([-100, 0, 121]), 0.10, 1e-9), "-100, 0, 121 is exactly 10% a year");
  ok(near(irr([-1000, 0, 0, 0, 0, 1000]), 0, 1e-9), "money back after five years is 0%");
  ok(irr([100, 100, 100]) == null && irr([-100, -100]) == null, "no sign change: no IRR, never a made-up number");
  // price 1000, transfer fee 4%, income 80 a year for 5 years, exit 1300 (nothing else): t0 = -1040, t5 = 80 + 1300
  const cfs = [-1000 * (1 + TRANSFER_FEE), 80, 80, 80, 80, 80 + 1300];
  const r = irr(cfs);
  // independent check: a brute-force scan for the rate that zeroes the net present value (not bisection)
  let best = 0, bestAbs = Infinity; for (let k = 0; k <= 200000; k++) { const x = k / 1e6, v = Math.abs(cfs.reduce((a, c, t) => a + c / Math.pow(1 + x, t), 0)); if (v < bestAbs) { bestAbs = v; best = x; } }
  ok(near(r, best, 2e-6), "1000 + 4% fee, 80 a year, exit 1300: IRR " + (r * 100).toFixed(3) + "% matches a brute-force scan (" + (best * 100).toFixed(3) + "%)");
  ok(Math.abs(npv(r, cfs)) < 1e-6, "the net present value at that rate is zero");
  // sanity by hand: 1040 in, 400 of income and 1300 back is about 7.7% income plus about 4.6% a year from the price: roughly 11.7%; the scan above gives the exact figure
  ok(r > 0.1165 && r < 0.1166, "and it is 11.65% (worked out separately by the scan)");
}

console.log("the historical back-test");
const mkRec = () => ({
  sales_l12: 400, size_sqft: 800, pct: { n: 400, p25: 1400, p50: 1500, p75: 1700 }, yield: { rate: 0.06, contracts: 300 },
  beds: { 0: { sales: 28, psf: 1500, price: 800000, rents: 40, rent: 55000, ok: false, yield: null }, 1: { sales: 200, psf: 1500, price: 1200000, rents: 400, rent: 80000, ok: true, yield: 0.0667 }, 2: { sales: 120, psf: 1450, price: 2000000, rents: 200, rent: 120000, ok: true, yield: 0.06 }, 3: { sales: 52, psf: 1400, price: 3000000, rents: 60, rent: 180000, ok: true, yield: 0.06 } },
  most_sales_bed: { bed: 1, sales: 200, of: 400 }, top_yield_bed: { bed: 1, yield: 0.0667 },
  price_y: { 2017: [100, 1000], 2018: [120, 1050], 2019: [150, 1100], 2020: [300, 1150], 2021: [800, 1250], 2022: [1500, 1400], 2023: [2000, 1350], 2024: [900, 1450], 2025: [500, 1500], 2026: [250, 1520] },
  replay: [{ from: 2017, to: 2022, change: 0.4 }, { from: 2018, to: 2023, change: 0.2857 }, { from: 2019, to: 2024, change: 0.3182 }, { from: 2020, to: 2025, change: 0.3043 }],
  rent_y: { 2019: { n: 90, rent: 60000, psf: 70 }, 2020: { n: 120, rent: 58000, psf: 68 }, 2021: { n: 300, rent: 60000, psf: 72 }, 2022: { n: 500, rent: 70000, psf: 85 }, 2023: { n: 700, rent: 80000, psf: 100 }, 2024: { n: 800, rent: 90000, psf: 110 }, 2025: { n: 900, rent: 95000, psf: 115 }, 2026: { n: 600, rent: 98000, psf: 118 } },
  rent_cagr: { from: 2019, to: 2025, rate: 0.0537 }, rent_l12: { n: 900, median: 96000, prior_n: 700, prior: 94000, change: 0.0213 }, rents_l12: 900, rent_flow: { new: 600, renew: 300, new_median: 98000, renew_median: 94000 },
  liq_y: { 2019: [150, 130], 2020: [300, 250], 2021: [800, 600], 2022: [1500, 1000], 2023: [2000, 1420], 2024: [900, 400], 2025: [500, 150], 2026: [250, 40] }, liq: { off_l12: 90, existing_l12: 310, peak: { year: 2023, n: 2000, off: 1420 }, iqr_pct: 0.2 },
  svc: { median: 15, min: 12, max: 18, n: 3, of: 5, year: 2026 },
  blds: [{ name: "Acme Tower", sales: 120, psf: 1500, change: 0.05, prior_sales: 90, off_share: 0, bed: 1, bed_sales: 70, rents: 200, rent: 80000, yield: 0.065, svc: 15, svc_year: 2026, net: 0.052 }, { name: "Acme Gardens", sales: 40, psf: 1400, off_share: 0.9, bed: 2, bed_sales: 15, rents: 0 }], blds_total: 2,
  offplan: [{ sales: 36, psf: 1400, bed: 2, bed_off: 15, off_psf: 1390, ready_psf: 1450, ready_n: 120, premium: -0.0414, end: "2027-03-30", pct: 55, status: "ACTIVE", units: 300, name: "Acme Gardens" }],
  pipeline: { register: "2026-10-02", projects: 1, homes: 300, buckets: { past: [0, 0], 2026: [0, 0], 2027: [1, 300], "2028+": [0, 0], none: [0, 0] }, pending: [0, 0] }, parity: { idx_l12: 390, register_l12: 400, ratio: 1.026 },
});
const AREA3 = { name: "Test Village Circle", sales_l12: 1250, size_sqft: 700, yield: { rate: 0.058, contracts: 900 }, price_y: {}, replay: [], rent_y: {}, rent_cagr: { from: 2019, to: 2025, rate: 0.04 }, supply: { register: "2026-10-02", projects: 9, homes: 2500, buckets: { past: [2, 600], 2026: [1, 200], 2027: [4, 1200], "2028+": [1, 300], none: [1, 200] }, pending: [1, 50], years_of_sales: 2 } };
const DUBAI = { price_y: {}, replay: [{ from: 2014, to: 2019, change: -0.08 }, { from: 2015, to: 2020, change: -0.09 }, { from: 2016, to: 2021, change: 0 }, { from: 2020, to: 2025, change: 0.8 }] };
const META = { as_of: "2026-08-31", l12_from: "2025-09-01", l12_to: "2026-08-31", last_full_year: 2025, min_sample: 30 };
const mkInv3 = (rec, area) => ({ meta: META, dubai: DUBAI, areas: { testvillagecircle: area || AREA3 }, pairs: { "testvillagecircle|acme": rec }, skipped: [] });
{
  const rec = mkRec(), bt = backtest(rec, AREA3, 2025);
  ok(bt.level === "developer" && bt.svcKnown && bt.svc === 15, "the developer's own series is used and the service charge is known");
  // price 2017..2022 has rent years 2018..2022: 2018 rent missing -> skipped. 2018 to 2023 needs rent 2019..2023 (all 30+): ok
  ok(bt.skipped.join() === "2017" && bt.count === 3, "windows 2018, 2019, 2020 run; 2017 is skipped for an incomplete rent series (" + bt.skipped + ", " + bt.count + ")");
  const w = bt.windows.find((x) => x.from === 2019);
  // 2019 to 2024: t0 = -1100 x 1.04 = -1144; income = rent psf 68,72,85,100,110 minus 15; exit = 1450 in year five
  const exp = [-1144, 68 - 15, 72 - 15, 85 - 15, 100 - 15, 110 - 15 + 1450];
  ok(w.cfs.every((c, i) => near(c, exp[i], 1e-9)), "the 2019 window's cash flows are exactly the hand-built ones: " + w.cfs.map((c) => c.toFixed(0)).join(", "));
  ok(near(w.irr, irr(exp), 1e-12), "and its IRR is the solver's on those flows");
  ok(bt.pick.length === 3 && bt.pick[0].irr <= bt.pick[1].irr && bt.pick[1].irr <= bt.pick[2].irr, "slowest, middle and fastest by IRR");
  const noSvc = mkRec(); noSvc.svc = { n: 0, of: 5 };
  const b2 = backtest(noSvc, AREA3, 2025);
  ok(!b2.svcKnown && b2.windows[0].income[0] === b2.windows[0].rents[0], "no service charge on the register: the back-test is before service charges, nothing deducted");
  const noRent = mkRec(); noRent.rent_y = {};
  const areaWith = Object.assign({}, AREA3, { price_y: noRent.price_y, rent_y: mkRec().rent_y });
  const b3 = backtest(noRent, areaWith, 2025);
  ok(b3.level === "area" && !b3.svcKnown && b3.count === 3, "a developer without a rent series falls back to the area, before service charges");
  const none = backtest(noRent, AREA3, 2025);
  ok(none.count === 0 && none.pick.length === 0, "no window at all: nothing is invented");
  const rp = replay(rec, AREA3, DUBAI);
  ok(rp.scope === "developer" && rp.slow.change === 0.2857 && rp.fast.change === 0.4, "replay: slowest and fastest past five-year change");
  const rd = replay({ replay: [] }, AREA3, DUBAI);
  ok(rd.scope === "dubai" && rd.slow.change === -0.09 || rd.slow.change === -0.09, "no windows for the developer or area: Dubai's, labelled");
}

console.log("the scenario arithmetic");
{
  const a = { price: 1000000, feeTransfer: 0.04, feeOther: 0.02, rent0: 60000, rentGrowth: 0, svc: 10000, vacancy: 0.05, mgmt: 0.05, sellCost: 0.02, years: 5, growth: 0.05 };
  const r = scenario(a);
  // each year: rent 60000 - 3000 vacancy - 3000 management - 10000 service = 44000; five years = 220000; start = 1,060,000; exit = 1,000,000 x 1.05^5 x 0.98
  ok(near(r.cash0, 1060000) && r.rows.every((x) => near(x.net, 44000)) && near(r.cum, 220000), "net income 44,000 a year, 220,000 over five years, 1,060,000 to start");
  ok(near(r.exitGross, 1000000 * Math.pow(1.05, 5), 1e-6) && near(r.exitNet, r.exitGross * 0.98, 1e-6), "exit value is the price grown five years, less 2% to sell");
  ok(near(r.cashOnCash1, 44000 / 1060000, 1e-12), "cash return in year one is the first year's net income over the cash put in");
  ok(Math.abs(npv(r.irr, r.cfs)) < 1e-4, "the scenario's IRR zeroes its own cash flows");
  ok(near(annual(0.4, 5), Math.pow(1.4, 0.2) - 1, 1e-12), "a five-year change becomes a yearly rate");
  const S = scenarioSet(mkRec(), AREA3, DUBAI, META);
  ok(S && S.cons.r.irr < S.mid.r.irr && S.mid.r.irr < S.up.r.irr, "conservative < base < upside");
  ok(S.sens.vac[0].irr > S.sens.vac[2].irr && S.sens.gro[0].irr < S.sens.gro[2].irr, "more vacancy lowers the IRR, more growth raises it");
  ok(scenarioSet(Object.assign(mkRec(), { size_sqft: null }), Object.assign({}, AREA3, { size_sqft: null }), DUBAI, META) == null, "no home size: no scenario inputs");
}

// ---------------------------------------------------------------- the whole document
const W = (n, med, rn, rm, on, om) => [n, sqm(med), rn, sqm(rm), on, sqm(om), n, sqm(med), 0, 0, 45, 75, 130];
const cell = (n, psf, bed) => [n, sqm(psf), Math.round(sqm(psf) * (bed ? 60 + 25 * bed : 34)), bed];
const ACME = [[2020, 12, sqm(900)], [2021, 40, sqm(1000)], [2022, 200, sqm(1100)], [2023, 250, sqm(1050)], [2024, 300, sqm(1200)], [2025, 100, sqm(1300)], [2026, 40, sqm(1250)]];
function mkIndex() {
  const c12 = [cell(300, 1500, 1), cell(200, 1450, 2), cell(40, 1400, 0), cell(30, 1350, 3)];
  const dev = { n: "Acme Developments", h: 500, c: c12, b: [[100, sqm(1500), "Acme Tower"]], c12, b12: [[100, sqm(1500), "Acme Tower"]], r: [[40, 1000, 90000, 1], [40, 900, 130000, 2]], ev: { all: W(1200, 1400, 800, 1400, 400, 1450), l12: W(570, 1500, 400, 1520, 170, 1450), y: ACME } };
  const areaY = [[2020, 400, sqm(950)], [2021, 700, sqm(1000)], [2022, 900, sqm(1050)], [2023, 1000, sqm(1100)], [2024, 1100, sqm(1150)], [2025, 1000, sqm(1200)], [2026, 500, sqm(1220)]];
  const area = { name: "Test Village Circle", bbox: [55.1, 25.0, 55.2, 25.1], register_sales_12m: 900, register_sales_all_time: 2400, ev: { all: W(5000, 1100, 3000, 1100, 2000, 1100), l12: W(1500, 1200, 1000, 1210, 500, 1180), y: areaY }, devs: { acme: dev } };
  return { as_of: "2026-09-09", generated: "2026-09-09", cuts: { bounds: [32292, 22604, 16684], shares: { bounds: [32292, 22604, 16684], window: ["2025-09-01", "2026-09-01"], sales: 1000, n: [9, 20, 35, 36], money: [26, 25, 26, 24] }, rule: "x" }, devs: { acme: { name: "Acme Developments", areas: 1, n: 570, profile: { projects: 1, homes: 500 } } }, alias: {}, areas: { testvillagecircle: area }, scale: { boutiqueMax: 2, midMax: 4 }, ev: { as_of: "2026-08-31", since: "2019-01-01", l12_from: "2025-09-01", l12_to: "2026-08-31", source_as_of: "2026-09-17", sales: 5000, filters: "Ordinary sales of homes." } };
}
function mkLayer() { const b = []; for (let i = 0; i < 40; i++) { const x = (i % 8) * 60, y = Math.floor(i / 8) * 60; b.push([i + 1, 20 + (i % 5) * 10, [x, y, x + 40, y, x + 40, y + 40, x, y + 40, x, y]]); } return { d: "testvillagecircle", b, s: [[6, [0, 0, 480, 0]]], rp: [], lab: [], ll: [1, 0, 0, 0, 1, 0] }; }
const mkEnv = (inv3) => {
  const store = { img_devmap_index: JSON.stringify(mkIndex()), img_brief_fp_testvillagecircle: JSON.stringify(mkLayer()), img_unitmix_testvillagecircle: JSON.stringify({ buildings_by_id: { 1: { name: "Acme Tower" } } }) };
  if (inv3) store.img_investor3 = JSON.stringify(inv3);
  const KV = { async get(k) { return store[k] == null ? null : store[k]; }, async put() {}, async delete() {}, async list() { return { keys: [] }; } };
  return { MEETINGS: KV, READ_KEY: "owner_key_abcdefgh", CLIENT_KEY: "client_key_123456" };
};
const url = (o) => "https://x/developers_pdf?kind=investor&area=testvillagecircle&window=12m&developer=acme&" + Object.entries(o || {}).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
const build = (inv3, o) => buildAreaPdf(mkEnv(inv3), parseParams(new URL(url(o))), { now: Date.parse("2026-10-05T08:00:00Z") });

console.log("page counts by data availability");
{
  const full = await build(mkInv3(mkRec()));
  ok(full.status === 200 && full.pages === 5, "full record: five pages (" + full.pages + ")");
  ok((full.html.match(/class="sheet page/g) || []).length === 5, "five A4 sheets");
  ok(/Page 1 of 5/.test(text(full.html)) && /Page 5 of 5/.test(text(full.html)), "the footers count to five");
  const none = await build(null);
  ok(none.pages === 2 && /Page 2 of 2/.test(text(none.html)), "no record on file: exactly the two pages, footers as before");
  const wrongPair = await build({ meta: META, dubai: DUBAI, areas: { testvillagecircle: AREA3 }, pairs: { "testvillagecircle|other": mkRec() } });
  ok(wrongPair.pages === 2, "a record without this pair: two pages");
  const noScen = mkRec(); noScen.size_sqft = null;
  const d4 = await build(mkInv3(noScen, Object.assign({}, AREA3, { size_sqft: null })));
  ok(d4.pages === 4, "scenario inputs missing: four pages (" + d4.pages + ")");
  const noEv = mkRec(); noEv.blds = []; noEv.rent_y = {}; noEv.liq_y = {};
  const d4b = await build(mkInv3(noEv, Object.assign({}, AREA3, { supply: null })));
  ok(d4b.pages === 4 && /scenarios/i.test(text(d4b.html)) && !/The evidence/.test(text(d4b.html)), "no evidence at all: the evidence page is left out, scenarios stay (4)");
  const d3 = await build(mkInv3(Object.assign(noEv, { size_sqft: null }), Object.assign({}, AREA3, { supply: null, size_sqft: null })));
  ok(d3.pages === 3, "no evidence and no scenario inputs: three pages (" + d3.pages + ")");
  // the same code path serves the client key and the owner key: 5 pages for both, no owner gate
  for (const [nm, key] of [["client", "client_key_123456"], ["owner", "owner_key_abcdefgh"]]) {
    const r = await devmapPdfRoute(new Request(url({ key, format: "html" })), mkEnv(mkInv3(mkRec())), new URL(url({ key, format: "html" })), { keyOk: () => true });
    const h = await r.text();
    ok(r.status === 200 && r.headers.get("X-Brief-Pages") === "5" && /Scenarios/.test(text(h)), nm + " key: five pages and the scenarios page");
    ok(!/INTERNAL|NOT FOR CLIENTS/i.test(h), nm + " key: no internal strip");
  }
}

console.log("what the pages say");
{
  const d = await build(mkInv3(mkRec()), { client: "Najjuko" });
  const t = text(d.html), p3 = text(d.html.split('class="sheet page')[3]), p4 = text(d.html.split('class="sheet page')[4]), p5 = text(d.html.split('class="sheet page')[5]);
  ok(!EMOJI.test(d.html), "no emoji code points");
  ok(!BANNED.test(t), "none of the banned words appear (" + (BANNED.exec(t) || [""])[0] + ")");
  ok(/The investor decision/.test(p3) && /Income/.test(p3) && /Growth/.test(p3) && /Liquidity/.test(p3) && /Supply/.test(p3) && /Most activity/.test(p3), "page 3: the five boxes");
  ok(/Studio/.test(p3) && /1 bed/.test(p3) && /2 bed/.test(p3) && /3\+ bed/.test(p3) && /not enough sales/.test(p3), "page 3: the four unit types, the thin one says not enough sales");
  ok(/>1,400</.test(d.html) && />1,500</.test(d.html) && />1,700</.test(d.html) && /lower quarter/.test(d.html), "page 3: lower quarter, middle and upper quarter of the price (range bar)");
  ok(/Vacancy/.test(p3) && /Management fee/.test(p3) && /class="i3bl"/.test(d.html), "page 3: blank lines for vacancy and fees (no assumed percentages)");
  ok(/what the register shows for past windows, not a forecast/i.test(p3), "page 3: the replay card says it is not a forecast");
  ok(p3.includes(BACKTEST_NOTE), "page 3: the back-test note is printed verbatim");
  ok(/not financial advice and not an offer/.test(p3) && /no promised return/.test(p3), "page 3: the disclaimer block");
  ok(/Past five-year windows: the annualised return \(IRR\)/.test(p3) && /3 windows of five years/.test(p3) && /1 skipped for an incomplete rent series/.test(p3), "page 3: the back-test cards name the windows and the skipped one");
  ok(/2018 to 2023/.test(p3) && /2019 to 2024/.test(p3) && /2020 to 2025/.test(p3), "page 3: each window is named by its years");
  const bt = backtest(mkRec(), AREA3, 2025);
  ok(p3.includes((Math.round(bt.pick[1].irr * 1000) / 10).toFixed(1) + "%"), "page 3: the middle window's IRR is the solver's value");
  ok((d.html.match(/class="i3bd"/g) || []).length >= 3, "page 4: building cards and off-plan cards are present");
  ok(/Acme Tower/.test(p4) && /Acme Gardens/.test(p4) && /Service charge: not on the register for this name/.test(p4), "page 4: buildings, with an honest service-charge line");
  ok(/2,500 incoming homes/.test(p4) && /1,250 sales/.test(p4) && /2\.0 years of current sales/.test(p4), "page 4: absorption = homes over the last 12 months' area sales (2,500 / 1,250 = 2.0)");
  ok(/Already past its planned date/.test(p4) && /Planned 2027/.test(p4) && /No date stated/.test(p4) && /some are old/.test(p4), "page 4: supply by planned year, dates called the register's");
  ok(/In 2023/.test(p4) && /71%/.test(p4), "page 4: 2023 was 71% off-plan (1,420 of 2,000)");
  ok(/Existing property includes the developer's own ready stock/.test(p4), "page 4: the limit on 'existing property' is stated");
  ok(/Repeat sales of the same unit/.test(p4) && /not in the register/.test(p4), "page 4: repeat sales are not in the register");
  ok(/Payment plans and rent at delivery are not in any register/.test(p4) && /Planned completion 30 March 2027/.test(p4), "page 4: off-plan context with the register's planned date");
  ok(/new contracts/.test(p4) && /renewals/.test(p4), "page 4: new and renewed contracts are split");
  ok(/Scenarios/.test(p5) && /Conservative/.test(p5) && /Base/.test(p5) && /Upside/.test(p5), "page 5: three scenario cards");
  ok(p5.includes(SCENARIO_DISCLAIMER), "page 5: the scenario disclaimer is printed verbatim");
  ok(/assumption/.test(p5) && (p5.match(/assumption/g) || []).length >= 4, "page 5: the assumed numbers are labelled assumption");
  ok(/The middle scenario, year by year/.test(p5) && /How the middle scenario moves/.test(p5), "page 5: worked cash-flow table and the sensitivity strip");
  ok(/for discussion/i.test(p5), "page 5: the figures are for discussion");
  ok(!/–0|-0\b/.test(p5.replace(/-0\.\d/g, "")), "page 5: no minus zero");
  const none = await build(null);
  ok(!/Scenarios|The investor decision/.test(text(none.html)), "no record: none of the new text appears");
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
