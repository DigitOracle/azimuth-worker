// v826 - Plot Passport labels for building-level sales (audit fix 4, label half). Data: naj-market-pulse 450957a, nb.facts.bsales from lk_plot_building_sales.
// The bsales objects below are STORED rows of data/enrich/sale_building_bind/plot_building_sales.parquet (8 Nov 2026), shaped exactly as
// plot_passport_neighbourhood.py writes them (names cut to 8). The bind objects are fixtures in the lk_plot_project_bind shape.
// Live KV: no pp_nb bucket carried bsales on 8 Nov (the next pp_nb build carries it); re-run with LIVE=<path to a pp_nb bucket json> to check a stored one.
import fs from "node:fs";
const N = await import("../src/passport_neighbourhood.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 700)); } };

const MCU = { sales: 7680, sales_12m: 379, median_aed_per_m2: 8191.0, median_aed_per_m2_12m: 10279.0, last_sale: "2026-10-15", building_names_n: 46, measured_precision_min: 0.9995,
  names: ["ABBEY CRESCENT 1", "ABBEY CRESCENT 2", "BARTON HOUSE 1", "BARTON HOUSE 2", "BENNETT HOUSE 1", "BENNETT HOUSE 2", "CLAVERTON HOUSE 1", "CLAVERTON HOUSE 2"] };   // parcel 6740299, Motor City Uptown
const THIN = { sales: 23, sales_12m: 1, median_aed_per_m2: 12628.0, median_aed_per_m2_12m: 33056.0, last_sale: "2026-10-06", building_names_n: 1, measured_precision_min: 0.9995, names: ["THE RESIDENCES II - BOULEVARD VILLAS"] };   // parcel 3450823
const ONE = { sales: 1634, sales_12m: 73, median_aed_per_m2: 27166.0, median_aed_per_m2_12m: 45624.0, last_sale: "2026-10-15", building_names_n: 1, measured_precision_min: 0.9995, names: ["Burj Lake Hotel - The Address DownTown"] };   // parcel 3450827
const PROJ = { plot_level: false, plots_in_project: 12, project_sales: 9100, project_sales_12m: 410, project_median_aed_per_m2: 9050, last_sale: "2026-10-15" };
const lines = (facts) => { const f = N.plotFactLines({ nb: { facts } }); return f.lines.join("\n"); };

// 1. headline, 12-month count and median; building count and names (at most 8) when more than one building
{
  const v = N.bsalesView({ bsales: MCU });
  ok(v.plot && v.plot.headline === "Sales in buildings on this plot: 7,680 (last 12 months: 379), median AED 8,191/m²", "headline", v.plot);
  ok(v.plot.median_12m === 10279 && v.plot.buildings_line === "46 buildings on this plot", "12-month median shown at 379 sales; building count", v.plot);
  ok(v.plot.names.length === 8 && v.plot.names[0] === "Abbey Crescent 1" && v.plot.more === 38, "names: 8 at most, readable case, the rest counted", v.plot.names);
  const h = N.bsalesCardsHtml(v);
  ok(/data-bsales=plot/.test(h) && /46 buildings on this plot/.test(h) && /and 38 more/.test(h) && /AED 10,279\/m²/.test(h), "card shows count, names, 12-month median", h);
  ok(/Sales in buildings on this plot: 7,680 \(last 12 months: 379\), median AED 8,191\/m²\. Last 12 months median AED 10,279\/m²\. Last sale 15 Oct 2026\. 46 buildings on this plot \(Abbey Crescent 1,/.test(lines({ bsales: MCU })), "writer line", lines({ bsales: MCU }));
}
// 3. 12-month median hidden under 5 sales (the stored row HAS a 12-month median of 33,056 on 1 sale)
{
  const v = N.bsalesView({ bsales: THIN }), h = N.bsalesCardsHtml(v), t = lines({ bsales: THIN });
  ok(v.plot.median_12m === null && !/33,056/.test(h) && !/33,056/.test(t), "12-month median hidden at 1 sale", h);
  ok(/fewer than 5 sales/.test(h) && /fewer than 5 sales/.test(t), "says why it is hidden", t);
  ok(v.plot.buildings_line === "" && !/\d buildings on this plot/.test(h) && !/bnm/.test(h), "one building: no building count, no names", h);
  const v4 = N.bsalesView({ bsales: Object.assign({}, ONE, { sales_12m: 4 }) }), v5 = N.bsalesView({ bsales: Object.assign({}, ONE, { sales_12m: 5 }) });
  ok(v4.plot.median_12m === null && v5.plot.median_12m === 45624, "boundary: 4 hidden, 5 shown");
}
// 2. project figures stay "project average" and apart; both shown when both exist
{
  const v = N.bsalesView({ bsales: ONE, bind: PROJ }), h = N.bsalesCardsHtml(v), t = lines({ bsales: ONE, bind: PROJ });
  ok(v.project && v.project.label === "Project average" && /not this plot's own figure/.test(v.project.note), "project-level is a project average", v.project);
  ok(h.indexOf("data-bsales=plot") >= 0 && h.indexOf("data-bsales=project") > h.indexOf("data-bsales=plot"), "two separate cards, plot first", h);
  const proj = h.slice(h.indexOf("data-bsales=project"));
  ok(/Project average median/.test(proj) && /not this plot alone/.test(proj) && !/Sales in buildings on this plot/.test(proj), "project card never carries the plot label", proj);
  ok(/project average, project-level \(one of 12 plots\); print it SEPARATELY/.test(t) && /Sales in buildings on this plot: 1,634/.test(t), "writer lines: both, separated", t);
  const po = N.bsalesView({ bind: PROJ }), ho = N.bsalesCardsHtml(po);
  ok(!po.plot && /Project average/.test(ho) && !/Sales in buildings on this plot/.test(ho), "project only: never presented as the plot's own", ho);
  const pl = N.bsalesView({ bind: Object.assign({}, PROJ, { plot_level: true, plots_in_project: 1 }) });
  ok(pl.project.label === "Project on this plot", "plot-level project keeps its own label");
}
// nothing held: no card
ok(N.bsalesCardsHtml(N.bsalesView({})) === "" && N.bsalesCardsHtml(N.bsalesView({ bsales: { sales: 0 } })) === "", "no data, no card");
// escaping
ok(!/<b>x/.test(N.bsalesCardsHtml(N.bsalesView({ bsales: Object.assign({}, MCU, { names: ["<b>x"] }) }))), "names are escaped");

// optional: a stored pp_nb bucket from KV
if (process.env.LIVE) {
  const j = JSON.parse(fs.readFileSync(process.env.LIVE, "utf8")); let n = 0;
  for (const id in j) { const f = j[id].facts; if (!f || !f.bsales) continue; n++; const v = N.bsalesView(f);
    ok(v.plot && /^Sales in buildings on this plot: /.test(v.plot.headline), "live " + id, f.bsales);
    if (f.bsales.sales_12m < 5) ok(v.plot.median_12m === null, "live hidden 12m " + id); }
  console.log("live plots with bsales:", n);
}
console.log("v826 plot building sales:", pass, "pass,", fail, "fail");
if (fail) process.exit(1);
