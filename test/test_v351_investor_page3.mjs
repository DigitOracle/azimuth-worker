// v351 - the investor PDF grows from two pages to as many as five: 3 The investor decision, 4 The evidence, 5 Scenarios.
// Synthetic index and a sample record with the shape of KV img_investor3 (built by scripts/investor3_build.py in the data repo). Nothing live is read or written.
import { buildAreaPdf, parseParams, devmapPdfRoute } from "../src/devmap_pdf.js";
import { irr, npv, backtest, replay, scenario, annual, cases, svcSensitivity, TRANSFER_FEE } from "../src/devmap_irr.js";
import { page3, page4, page5, page6, scenarioSet, figures, SCENARIO_DISCLAIMER, BACKTEST_NOTE, NA_SVC, WARN_SVC, NOT_FORECAST } from "../src/devmap_investor3.js";

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
  ok(S && S.stress.r.irr < S.moderate.r.irr && S.moderate.r.irr < S.firm.r.irr, "stress < moderate < firm");
  ok(S.stress.g === 0 && S.moderate.g === 0.03 && S.firm.g === 0.06, "the three fixed cases grow 0%, 3% and 6% a year");
  ok(S.hist.w.from === 2019 && near(S.hist.g, annual(0.3182, 5), 1e-12), "the historical case is the register's middle window (2019 to 2024)");
  ok(S.lower.g < S.hist.g && S.hist.g < S.upper.g, "the lower and upper historical windows bracket it");
  ok(S.sens.vac[0].irr > S.sens.vac[2].irr && S.sens.gro[0].irr < S.sens.gro[2].irr, "more vacancy lowers the IRR, more growth raises it");
  ok(scenarioSet(Object.assign(mkRec(), { size_sqft: null }), Object.assign({}, AREA3, { size_sqft: null }), DUBAI, META) == null, "no home size: no scenario inputs");
}

console.log("v351.2: the cases, the profit identity, the splits, the service charge sensitivity (hand-checked)");
{
  const a = { price: 1000000, feeTransfer: 0.04, feeOther: 0.02, rent0: 60000, rentGrowth: 0, svc: 0, vacancy: 0.05, mgmt: 0.05, sellCost: 0.02, years: 5 };
  const z = scenario(Object.assign({}, a, { growth: 0 }));
  // the 0% case by hand: in 1,060,000; income after vacancy and management 54,000 a year = 270,000; sale 1,000,000 less 2% = 980,000
  ok(near(z.cash0, 1060000) && near(z.cumInc, 270000) && near(z.cum, 270000) && near(z.exitGross, 1000000) && near(z.exitNet, 980000) && near(z.sellCost, 20000), "0% case: 1,060,000 in, 270,000 of income, 980,000 from the sale after 20,000 selling cost");
  ok(near(z.profit, 270000 + 980000 - 1060000) && near(z.profit, 190000), "0% case: modeled profit is 190,000");
  ok(near(z.profit, z.totalOut - z.totalIn) && near(z.totalOut, 1250000), "profit = total out - total in (1,250,000 - 1,060,000)");
  let sc = 0, sa = Infinity; for (let k = 0; k <= 100000; k++) { const x = k / 1e6, v = Math.abs([-1060000, 54000, 54000, 54000, 54000, 1034000].reduce((p, c, t) => p + c / Math.pow(1 + x, t), 0)); if (v < sa) { sa = v; sc = x; } }
  ok(near(z.irr, sc, 2e-6) && z.irr > 0.0369 && z.irr < 0.0370, "0% case IRR is 3.69%: -1,060,000, then 54,000 four times, then 54,000 + 980,000; a brute-force scan finds the same rate (" + (sc * 100).toFixed(3) + "%)");
  ok(near(z.cashOnCash1, 54000 / 1060000, 1e-12) && near(z.incomeReturn1, z.cashOnCash1, 1e-12), "year-one cash return = 54,000 / 1,060,000 with no service charge");
  ok(near(z.grossYield, 0.06) && near(z.afterCostsYield, 0.054), "waterfall: gross yield 6.0%, less vacancy and management 0.6 points, cash return before service charges 5.4%");
  ok(near(z.split.exit, 0) && near(z.split.rent, 1), "no appreciation: all of the gain comes from rent, none from the sale price");
  // a case with growth: split arithmetic by hand. price 1,000,000, 5% a year: exit 1,276,281.56; appreciation 276,281.56; income 270,000
  const g = scenario(Object.assign({}, a, { growth: 0.05 }));
  const app = 1000000 * (Math.pow(1.05, 5) - 1), tot = app + 270000;
  ok(near(g.appreciation, app, 1e-6) && near(g.split.exit, app / tot, 1e-12) && near(g.split.rent, 270000 / tot, 1e-12) && near(g.split.exit + g.split.rent, 1, 1e-12), "split: " + Math.round(g.split.exit * 100) + "% from the sale price, " + Math.round(g.split.rent * 100) + "% from rent (276,282 against 270,000)");
  ok(near(g.profit, g.cum + g.exitNet - g.cash0, 1e-6) && near(g.profit, g.totalOut - g.totalIn, 1e-6), "profit identity with growth");
  // a service charge lowers year one by exactly its amount and the profit by five times that
  const w = scenario(Object.assign({}, a, { growth: 0.05, svc: 10000 }));
  ok(near(g.rows[0].net - w.rows[0].net, 10000) && near(g.profit - w.profit, 50000, 1e-6), "a 10,000 service charge takes 10,000 off year one and 50,000 off the profit");
  ok(near(w.rows[0].inc, g.rows[0].inc), "income after vacancy and management does not move with the service charge");
  // cases() and the service charge sensitivity
  const rp = { slow: { change: 0.2, from: 2018, to: 2023 }, mid: { change: 0.3, from: 2019, to: 2024 }, fast: { change: 0.4, from: 2020, to: 2025 } };
  const K = cases(a, rp);
  ok(K.stress.g === 0 && K.moderate.g === 0.03 && K.firm.g === 0.06 && near(K.hist.g, annual(0.3, 5), 1e-12), "cases: 0%, 3%, 6% and the middle window");
  ok(near(K.lower.g, annual(0.2, 5), 1e-12) && near(K.upper.g, annual(0.4, 5), 1e-12), "lower and upper historical windows are the slowest and fastest past windows");
  ok(K.vac.length === 3 && near(K.vac[1].irr, K.hist.r.irr, 1e-12), "the 5% vacancy point of the strip is the historical case itself");
  ok(near(K.gro[1].irr, K.hist.r.irr, 1e-12) && K.gro[0].irr < K.gro[2].irr, "the zero-shift growth point is the historical case");
  const SS = svcSensitivity(a, 800, K.hist.g, null);
  ok(SS.map((r) => r.psf).join() === "0,15,20" && SS.every((r) => r.kind === "illustrative"), "no register figure: 0, 15 and 20 per sq ft, all illustrative");
  ok(near(SS[1].svc, 12000) && near(SS[1].cash1, (54000 - 12000) / 1060000, 1e-12), "15 per sq ft on 800 sq ft is 12,000 a year; year-one cash return (54,000 - 12,000) / 1,060,000");
  ok(near(SS[0].irr, K.hist.r.irr, 1e-12), "0 per sq ft equals the case with no service charge");
  const SR = svcSensitivity(Object.assign({}, a, { svc: 13440 }), 800, K.hist.g, 16.8);
  ok(SR.map((r) => r.psf).join() === "0,15,16.8,20" && SR.find((r) => r.psf === 16.8).kind === "register", "a register figure is added to the strip and marked register");
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
  ok(full.status === 200 && full.pages === 6, "full record: six pages (" + full.pages + ")");
  ok((full.html.match(/class="sheet page/g) || []).length === 6, "six A4 sheets");
  ok(/Page 1 of 6/.test(text(full.html)) && /Page 6 of 6/.test(text(full.html)), "the footers count to six");
  const none = await build(null);
  ok(none.pages === 2 && /Page 2 of 2/.test(text(none.html)), "no record on file: exactly the two pages, footers as before");
  const wrongPair = await build({ meta: META, dubai: DUBAI, areas: { testvillagecircle: AREA3 }, pairs: { "testvillagecircle|other": mkRec() } });
  ok(wrongPair.pages === 2, "a record without this pair: two pages");
  const noScen = mkRec(); noScen.size_sqft = null;
  const d4 = await build(mkInv3(noScen, Object.assign({}, AREA3, { size_sqft: null })));
  ok(d4.pages === 4, "scenario inputs missing: four pages (" + d4.pages + ")");
  const noEv = mkRec(); noEv.blds = []; noEv.rent_y = {}; noEv.liq_y = {};
  const d4b = await build(mkInv3(noEv, Object.assign({}, AREA3, { supply: null })));
  ok(d4b.pages === 5 && /scenarios/i.test(text(d4b.html)) && !/The evidence/.test(text(d4b.html)), "no evidence at all: the evidence page is left out, the two scenario pages stay (5)");
  const d3 = await build(mkInv3(Object.assign(noEv, { size_sqft: null }), Object.assign({}, AREA3, { supply: null, size_sqft: null })));
  ok(d3.pages === 3, "no evidence and no scenario inputs: three pages (" + d3.pages + ")");
  // the same code path serves the client key and the owner key: 5 pages for both, no owner gate
  for (const [nm, key] of [["client", "client_key_123456"], ["owner", "owner_key_abcdefgh"]]) {
    const r = await devmapPdfRoute(new Request(url({ key, format: "html" })), mkEnv(mkInv3(mkRec())), new URL(url({ key, format: "html" })), { keyOk: () => true });
    const h = await r.text();
    ok(r.status === 200 && r.headers.get("X-Brief-Pages") === "6" && /Scenarios/.test(text(h)), nm + " key: six pages and the scenarios pages");
    ok(!/INTERNAL|NOT FOR CLIENTS/i.test(h), nm + " key: no internal strip");
  }
}

console.log("what the pages say");
{
  const d = await build(mkInv3(mkRec()), { client: "Najjuko" });
  const t = text(d.html), p3 = text(d.html.split('class="sheet page')[3]), p4 = text(d.html.split('class="sheet page')[4]), p5 = text(d.html.split('class="sheet page')[5]), p6 = text(d.html.split('class="sheet page')[6]);
  ok(!EMOJI.test(d.html), "no emoji code points");
  ok(!BANNED.test(t), "none of the banned words appear (" + (BANNED.exec(t) || [""])[0] + ")");
  ok(/The investor decision/.test(p3) && /Income/.test(p3) && /Growth/.test(p3) && /Liquidity/.test(p3) && /Supply/.test(p3) && /Most activity/.test(p3), "page 3: the five boxes");
  ok(/Studio/.test(p3) && /1 bed/.test(p3) && /2 bed/.test(p3) && /3\+ bed/.test(p3) && /not enough sales/.test(p3), "page 3: the four unit types, the thin one says not enough sales");
  ok(/>1,400</.test(d.html) && />1,500</.test(d.html) && />1,700</.test(d.html) && /lower quarter/.test(d.html), "page 3: lower quarter, middle and upper quarter of the price (range bar)");
  ok(/Vacancy/.test(p3) && /Management fee/.test(p3) && /class="i3bl"/.test(d.html), "page 3: blank lines for vacancy and fees (no assumed percentages)");
  ok(/what the register shows for past windows, not a forecast/i.test(p3), "page 3: the replay card says it is not a forecast");
  ok(p3.includes(BACKTEST_NOTE), "page 3: the back-test note is printed verbatim");
  ok(/not financial advice and not an offer/.test(p3) && /no promised return/.test(p3), "page 3: the disclaimer block");
  ok(/Past five-year windows: the annualised return \(IRR\)/.test(p3) && /Of 4 five-year windows with price data/.test(p3) && /3 have a complete rent series/.test(p3) && /1 left out for missing rent years/.test(p3), "page 3: the back-test cards name the windows and the skipped one");
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
  ok(/Scenarios/.test(p5) && /Stress case/.test(p5) && /Moderate case/.test(p5) && /Firm case/.test(p5) && /Historical case/.test(p5), "page 5: the four cases by price growth");
  ok(!/Conservative|Upside|Base case/.test(t), "the old Conservative / Base / Upside labels are gone");
  ok(/0% a year: the property does not appreciate/.test(p5) && /Based on the 2019 to 2024 window/.test(p5), "page 5: the stress case and the historical window are named");
  ok(p5.includes(NOT_FORECAST), "page 5: 'These are scenarios, not forecasts.'");
  ok(/How much cash do I need\?/.test(p5) && /What does it generate while I own it\?/.test(p5) && /What has to happen for the historical-case return\?/.test(p5) && /What happens if it does not\?/.test(p5), "page 5: the four-answer box");
  ok(/With no price growth the five-year return is \d+\.\d%/.test(p5) && /The price must rise about \d+\.\d% a year/.test(p5) && /all-in/.test(p5), "page 5: the four answers carry numbers");
  ok(/IRR \d+\.\d%: the modeled yearly return across the whole five years, counting rent and the sale\./.test(p5), "page 5: the IRR in plain English");
  ok(/The money, historical case/.test(p5) && /Cash invested \(price \+ buying costs\)/.test(p5) && /Modeled profit/.test(p5) && /in, AED [\d,]+ out/.test(p5) && /Stress case \(no price growth\)/.test(p5), "page 5: the AED profit block and the stress line");
  ok(/Where the return comes from/.test(p5) && /of the modeled gain comes from the sale price/.test(p5) && /Gross yield \(rent over price\)/.test(p5) && /Cash return before service charges/.test(p5), "page 5: where the return comes from and the waterfall");
  ok(!/Net income/i.test(p5 + p6), "no 'Net income' anywhere: it is 'Income after vacancy and management'");
  const noSvcRec = mkRec(); noSvcRec.svc = { n: 0, of: 5 };
  const dn = await build(mkInv3(noSvcRec)), pn = dn.html.split('class="sheet page'), q5 = text(pn[5]), q6 = text(pn[6]);
  ok(q5.includes(WARN_SVC) && q6.includes(NA_SVC) && /before service charges/.test(q5), "no service charge on the register: the warning strip and NOT AVAILABLE");
  ok(!/Service charge[^A-Za-z]{0,12}(AED )?0\b/.test(q5 + q6) && !/Less service charge/.test(q6), "and never a printed 0 service charge");
  ok(/If the service charge were/.test(q6) && /15 \(illustrative\)/.test(q6) && /20 \(illustrative\)/.test(q6) && /not register data/.test(q6), "page 6: the service charge sensitivity, 15 and 20 labelled illustrative when the register has none");
  ok(!p5.includes(WARN_SVC), "a record that holds a service charge: no warning strip");
  ok(/From the register/.test(p6) && /Model assumptions/.test(p6) && /Not available/.test(p6) && /Maintenance/.test(p6) && /Financing/.test(p6) && /Furnishing/.test(p6), "page 6: the assumptions in three boxes");
  ok(/Income after vacancy and management/.test(p6) && /The historical case, year by year/.test(p6) && /Lower historical window/.test(p6) && /Upper historical window/.test(p6), "page 6: the table and the sensitivity strip with the lower and upper windows");
  ok(p5.includes(SCENARIO_DISCLAIMER) && p6.includes(SCENARIO_DISCLAIMER), "pages 5 and 6: the scenario disclaimer, verbatim");
  ok(/assumption/.test(p6) && (p6.match(/assumption/g) || []).length >= 4, "page 6: the assumed numbers are labelled assumption");
  ok(/This page is about Acme Developments in Test Village Circle/.test(p3) && /This page is about Acme Developments in Test Village Circle/.test(p4) && /This page is about Acme Developments in Test Village Circle/.test(p5) && /This page is about Acme Developments in Test Village Circle/.test(p6), "pages 3 to 6: the strip 'This page is about <developer> in <area>'");
  ok(/The middle scenario|Conservative/.test(t) === false, "no leftover old labels");
  // a record that holds a service charge: no warning, the figure is used and the sensitivity marks it
  const withS = text(d.html), hasSvc = withS.includes("Less service charge") && !withS.includes(WARN_SVC);
  ok(hasSvc && /\(register\)/.test(p6), "service charge on the register: used, no warning strip, marked register in the sensitivity");
  ok(/for discussion/i.test(p5), "page 5: the figures are for discussion");
  ok(!/–0|-0\b/.test(p5.replace(/-0\.\d/g, "")), "page 5: no minus zero");
  const none = await build(null);
  ok(!/Scenarios|The investor decision/.test(text(none.html)), "no record: none of the new text appears");
}
console.log("v351.1: headline basis, thin series, cap");
{
  // a pair whose own rent series is only 4 full years of 100+ contracts: the area's growth is used, and said so
  const thin = mkRec(); thin.rent_y = { 2022: { n: 185, rent: 74000, psf: 85 }, 2023: { n: 187, rent: 85000, psf: 93 }, 2024: { n: 394, rent: 100000, psf: 119 }, 2025: { n: 590, rent: 114571, psf: 130 }, 2026: { n: 419, rent: 110000, psf: 127 } };
  thin.rent_cagr = { from: 2022, to: 2025, rate: 0.1569 };
  const S = scenarioSet(thin, AREA3, DUBAI, META);
  ok(S.rentScope === "area" && S.rentShort && near(S.rentGrowth, 0.04), "own series too short: the area's rent growth (4%) is used, not the pair's 15.7%");
  const html = text(page6({ names: { plain: "T" } }, { name: "A" }, S));
  ok(/this developer's own rent series is too short/.test(html), "page 5 says the pair's own rent series is too short");
  const long = mkRec(); long.rent_y = {}; for (let y = 2020; y <= 2025; y++) long.rent_y[y] = { n: 150, rent: 50000 * Math.pow(1.2, y - 2020), psf: 100 };
  const S2 = scenarioSet(long, AREA3, DUBAI, META);
  ok(S2.rentCapped && near(S2.rentGrowth, 0.04), "a long series growing faster than the area is capped at the area's own rate");
  const slow = mkRec(); slow.rent_y = {}; for (let y = 2020; y <= 2025; y++) slow.rent_y[y] = { n: 150, rent: 50000 * Math.pow(1.02, y - 2020), psf: 100 };
  const S3 = scenarioSet(slow, AREA3, DUBAI, META);
  ok(S3.rentScope === "developer" && !S3.rentCapped && near(S3.rentGrowth, 0.02, 1e-9), "a long series growing slower than the area keeps its own rate");
  const fewp = mkRec(); fewp.price_y = { 2022: [100, 1000], 2023: [100, 1100], 2024: [100, 1200] };
  ok(replay(fewp, AREA3, DUBAI).scope === "dubai", "fewer than 5 solid years of its own price series: not its own windows");
  const m = { name: "Acme", asOf: "2026-08-31", l12: { sales: 933, psf: 2048 }, yield: { rate: 0.064, contracts: 1507 }, dev: { rows: [{ year: 2022, solid: true, partial: false, psf: 1000, sales: 100 }, { year: 2025, solid: true, partial: false, psf: 1100, sales: 1022 }] } };
  const d = text(page3({ names: { plain: "Test", title: "Test" } }, m, mkRec(), AREA3, DUBAI, META));
  ok(/933/.test(d) && /6\.4%/.test(d) && /1,507 rent contracts/.test(d) && !/>962</.test(d), "page 3 headline: 933 sales, 6.4%, 1,507 contracts (the index figures)");
  ok(/\+10\.0%/.test(d) && /1,022 sales in 2025/.test(d), "page 3 growth and last-year sales follow the page 1 series");
  ok(/small differences between the pages are normal/.test(d), "page 3 says the later figures are a recount");
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
