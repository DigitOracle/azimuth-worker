// v366 - the investor PDF page 3 prints one DEWA connection proxy caption under "Income after the service charge" when the pair record carries an occ block; nothing when it does not.
// Synthetic only. Negative control: the base (commit a5124d3) page3 output must be byte-identical to the new output when occ is absent. Nothing live is read or written.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { page3 } from "../src/devmap_investor3.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B55}\u{FE0F}\u{200D}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{25A0}-\u{25FF}]/u;
const text = (html) => html.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<svg[\s\S]*?<\/svg>/g, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ");
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

const C = { names: { plain: "Test", title: "Test" } };
const M = { name: "Acme", asOf: "2026-08-31", l12: { sales: 933, psf: 2048 }, yield: { rate: 0.064, contracts: 1507 }, dev: { rows: [{ year: 2022, solid: true, partial: false, psf: 1000, sales: 100 }, { year: 2025, solid: true, partial: false, psf: 1100, sales: 1022 }] } };
const OCC = { as_of: "2026-01-04", label: "DEWA connection proxy (not vacancy)", units: 833, connected: 470, share: 0.564, buildings: [{ name: "A", units: 784, connected: 432, share: 0.551 }, { name: "B", units: 49, connected: 38, share: 0.776 }], suppressed: 0, caveat: "internal caveat text", source: "internal source text" };
const withOcc = (o) => { const r = mkRec(); if (o) r.occ = o; return r; };
const run = (rec, fn) => (fn || page3)(C, M, rec, AREA3, DUBAI, META);
const countCap = (h) => (h.match(/DEWA connection proxy/g) || []).length;

console.log("with an occ block");
{
  const h = run(withOcc(OCC)), d = text(h);
  ok(countCap(h) === 1, "exactly one caption is printed");
  ok(/DEWA connection proxy: 56% of 833 registered homes in 2 of this developer's buildings we could place have an active DEWA connection \(4 January 2026\)/.test(d), "share, home count, buildings placed and the as-of date are in the caption");
  ok(/lower bound/i.test(d) && /not a vacancy rate/.test(d) && /not a household count/.test(d), "lower bound, not vacancy, not a household");
  ok(d.includes("Source: Dubai Electricity and Water Authority customer premises data via Dubai Pulse open data."), "the source line is verbatim");
  ok(h.indexOf("Income after the service charge") < h.indexOf("DEWA connection proxy") && h.indexOf("DEWA connection proxy") < h.indexOf("Median annual") + 1e9, "the caption sits in the Income after the service charge card");
  ok(/vacancy/i.test(d) && d.includes("Vacancy"), "the vacancy blank line is still there");
  ok(!EMOJI.test(h), "no emoji");
  ok(!/internal caveat|internal source|\bKV\b|Makani|claude|gpt|gemini|anthropic|household[s]? (are|is) |vacancy rate (is|of) \d/i.test(d), "no internal wording, no claim that it is a vacancy or household figure");
  ok(!/44%/.test(d), "the data repo's internal caveat is not copied into the client page");
}
console.log("without an occ block, and pairs that get none");
{
  const h0 = run(withOcc(null));
  ok(countCap(h0) === 0 && !/as_of|undefined|NaN|null/.test(text(h0)), "no occ: nothing printed, no undefined/NaN");
  for (const bad of [{}, { share: null, units: 0 }, { share: 0.5, units: 0 }]) ok(countCap(run(withOcc(bad))) === 0, "an empty or unusable occ block prints nothing: " + JSON.stringify(bad));
  ok(run(withOcc(OCC)).length > h0.length, "the page with occ is longer, the page without is the page as it was");
}
console.log("suppression note");
{
  const d1 = text(run(withOcc({ ...OCC, suppressed: 1 }))), d2 = text(run(withOcc({ ...OCC, suppressed: 3 })));
  ok(d1.includes("1 building with fewer than 10 homes is left out."), "one suppressed building");
  ok(d2.includes("3 buildings with fewer than 10 homes are left out."), "several suppressed buildings");
  ok(!text(run(withOcc(OCC))).includes("fewer than 10 homes"), "no note when nothing was suppressed");
}
console.log("other lines unchanged: the 5% vacancy assumption and every existing line");
{
  const a = run(withOcc(null)), b = run(withOcc(OCC));
  const strip = b.replace(/<div class="i3cap"><b>DEWA connection proxy:<\/b>[\s\S]*?<\/div>/, "");
  ok(strip === a, "removing the one caption from the occ page gives the no-occ page exactly");
}
console.log("negative control against the base commit a5124d3");
{
  const tmp = "src/__base_a5124d3_investor3.js";
  let basePage3 = null;
  try {
    fs.writeFileSync(tmp, execFileSync("git", ["show", "a5124d3:src/devmap_investor3.js"], { encoding: "utf8", maxBuffer: 1 << 26 }));
    basePage3 = (await import("../" + tmp)).page3;
    const rec = withOcc(null);
    ok(run(rec, basePage3) === run(rec), "occ absent: new page 3 is byte-identical to the base page 3");
    ok(run(withOcc(OCC), basePage3) !== run(withOcc(OCC)), "control: with occ the new page differs from the base (the comparison can fail)");
    ok(countCap(run(withOcc(OCC), basePage3)) === 0, "control: the base never prints the caption");
  } finally { try { fs.unlinkSync(tmp); } catch {} }
}
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
