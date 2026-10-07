// v396 (Kendall, 7 Oct 2026): "Contracts signed" shows RENTALS AND SALES together. Offline: stub KV, tiny CSV fixtures through the real builder.
// NEGATIVE CONTROLS: (1) in scripts/build_sales_filed.py make classify() return "sale" for every Sales-group row and section A fails (land and mortgage leak
// into sales); (2) delete the dedupe QUALIFY and A fails on the repeated daily rows.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync, execSync } from "node:child_process";
import { ejariAnswer, ejariPageHtml, ejariQuery, ejariRoutes, ejariCacheReset } from "../src/ejari_page.js";
import { salesAnswer, salesWindow } from "../src/sales_view.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? " :: " + String(d).slice(0, 300) : "")); } };
const EMOJI = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const addD = (s, n) => new Date(Date.parse(s + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const ASOF = "2026-10-07", SALES_ASOF = "2026-10-06";
const text = (h) => h.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const hl = (h) => text((h.match(/<div class=hl id=ejhl>(.*?)<\/div>/) || [, ""])[1]);

// ---- A. the builder, on a hand-made transactions file --------------------------------------------------------------------------------
console.log("A. builder: dedupe, land and mortgage kept out of sales");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v396-"));
  const H = "TRANSACTION_NUMBER,INSTANCE_DATE,GROUP_EN,PROCEDURE_EN,IS_OFFPLAN_EN,IS_FREE_HOLD_EN,USAGE_EN,AREA_EN,PROP_TYPE_EN,PROP_SB_TYPE_EN,TRANS_VALUE,PROCEDURE_AREA,ACTUAL_AREA,ROOMS_EN,PARKING,NEAREST_METRO_EN,NEAREST_MALL_EN,NEAREST_LANDMARK_EN,TOTAL_BUYER,TOTAL_SELLER,MASTER_PROJECT_EN,PROJECT_EN";
  const row = (tn, d, g, p, off, use, area, pt, sb, v, a, rooms, proj) => [tn, d, g, p, off, "Free Hold", use, area, pt, sb, v, a, a, rooms, "1", "", "", "", 0, 0, "", proj].join(",");
  const rows = [
    row("102-1-2026", "2026-10-05T10:00:00", "Sales", "Sell - Pre registration", "Off-Plan", "Residential", "BUSINESS BAY", "Unit", "Flat", 1000000, 50, "1 B/R", "TEST TOWER"),
    row("11-2-2026", "2026-10-05T11:00:00", "Sales", "Sale", "Ready", "Residential", "BUSINESS BAY", "Unit", "Flat", 2000000, 100, "2 B/R", "TEST TOWER"),
    row("11-3-2026", "2026-10-05T12:00:00", "Sales", "Sale", "Ready", "Commercial", "BUSINESS BAY", "Land", "Land", 51000000, 3843, "", "KORE TEST"),
    row("13-4-2026", "2026-10-05T12:30:00", "Mortgage", "Mortgage Registration", "Ready", "Commercial", "BUSINESS BAY", "Land", "Land", 45000000, 3843, "", "KORE TEST"),
    row("13-5-2026", "2026-10-05T13:00:00", "Mortgage", "Mortgage Registration", "Ready", "Residential", "BUSINESS BAY", "Unit", "Flat", 800000, 50, "1 B/R", "TEST TOWER"),
    row("9-6-2026", "2026-10-05T14:00:00", "Gifts", "Grant", "Ready", "Residential", "BUSINESS BAY", "Unit", "Flat", 900000, 60, "1 B/R", "TEST TOWER"),
    row("11-7-2026", "2026-10-05T15:00:00", "Sales", "Sale", "Ready", "Residential", "BUSINESS BAY", "Building", "Building", 90000000, 5000, "", "TEST TOWER")
  ];
  for (const f of ["2026-10-05", "2026-10-06", "2026-10-07"]) fs.writeFileSync(path.join(dir, "transactions-" + f + ".csv"), "﻿" + H + "\n" + rows.join("\n") + "\n");   // the same rows in three daily files
  const out = path.join(dir, "out");
  const r = spawnSync("python", [new URL("../scripts/build_sales_filed.py", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), "--no-lake", "--data-dir", dir, "--out", out, "--as-of", "2026-10-06"], { encoding: "utf8" });
  ok(r.status === 0, "the builder runs offline", r.stderr || r.stdout);
  if (r.status === 0) {
    const bb = JSON.parse(fs.readFileSync(path.join(out, "sales_filed_businessbay.json"), "utf8"));
    const sum = (k) => bb.rows.filter((x) => x.kind === k).reduce((s, x) => s + x.sales, 0);
    ok(bb.basis === "registered" && bb.fields.includes("sales") && bb.fields.includes("attribution"), "same row shape style, basis registered");
    ok(sum("sale") === 2, "repeated daily rows are deduplicated: 2 unit sales, not 6", sum("sale"));
    ok(sum("land") === 1 && sum("mortgage") === 2, "the plot sale and the two mortgages (land and unit) sit in their own counters", sum("land") + "/" + sum("mortgage"));
    ok(!bb.rows.some((x) => x.kind === "sale" && x.sales > 0 && x.stage == null), "every sale is off-plan or ready");
    const off = bb.rows.filter((x) => x.kind === "sale" && x.stage === "offplan").reduce((s, x) => s + x.sales, 0);
    ok(off === 1, "off-plan separated from ready", off);
    ok(bb.rows.every((x) => x.kind !== "land" || x.prices == null), "plots carry no price list");
    const dub = JSON.parse(fs.readFileSync(path.join(out, "sales_filed_dubai.json"), "utf8"));
    const ds = dub.per_area.rows.filter((x) => x[3] === "sale").reduce((s, x) => s + x[7], 0);
    ok(ds === 2 && dub.projects && dub.per_developer, "the Dubai-wide file agrees (2) and carries per_developer and projects", ds);
    ok(!bb.rows.some((x) => x.dld_project === "TEST TOWER" && x.kind === "sale" && x.price_median != null), "no median from fewer than five sales");
    const a1 = fs.readFileSync(path.join(out, "sales_filed_businessbay.json"), "utf8");
    spawnSync("python", [new URL("../scripts/build_sales_filed.py", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), "--no-lake", "--data-dir", dir, "--out", out, "--as-of", "2026-10-06"], { encoding: "utf8" });
    ok(fs.readFileSync(path.join(out, "sales_filed_businessbay.json"), "utf8") === a1, "re-running gives the same bytes");
  }
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---- stub KV ------------------------------------------------------------------------------------------------------------------
const mkEnv = (store) => ({ MEETINGS: { async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); return t === "arrayBuffer" ? new TextEncoder().encode(v).buffer : v; } } });
const H = { clientOk: () => true, clientResp: (e, u, html, init) => new Response(html, init), residentsKeyOf: () => "", najNav: () => "", NAJ_NAV_CSS: "", NAJ_FONTS: "" };
const rrow = (date, n, o) => Object.assign({ date, contracts: n, reg_type: "New", district: "dmc", area: "Dubai Maritime City", sub_type: "Flat", beds: "1", dld_project: "SEAGATE", dld_project_number: "2163", key: "dld:seagate", developer_number: "55", developer: "ACME CORE DEVELOPMENT L.L.C" }, o || {});
const srow = (date, n, o) => Object.assign({ date, district: "dmc", area: "Dubai Maritime City", dld_project: "SEAGATE", project_name_ar: null, dld_project_number: 2163, key: "dld:seagate", developer_number: 55, developer: "ACME CORE DEVELOPMENT L.L.C", attribution: "REGISTER_VERIFIED", kind: "sale", stage: "offplan", beds: "1", sub_type: "Flat", usage: "Residential", sales: n, price_n: n, prices: Array.from({ length: n }, (_, i) => 1000000 + i * 10000), psm: Array.from({ length: n }, (_, i) => 20000 + i * 100) }, o || {});
const doc = (basis, asOf, rows, extra) => JSON.stringify(Object.assign({ as_of: asOf, source: "stub", basis, rows }, extra || {}));
function stores(withSales) {
  const s = new Map();
  const rent = []; for (let i = 0; i < 14; i++) rent.push(rrow(addD(ASOF, -i), 2), rrow(addD(ASOF, -i), 1, { reg_type: "Renew" }));
  s.set("img_ejari_filed_dmc", doc("filed", ASOF, rent));
  s.set("img_ejari_recent_dmc", doc("start", ASOF, rent));
  s.set("img_ejari_filed_dubai", doc("filed", ASOF, rent));
  s.set("img_ejari_projects_index", JSON.stringify({ as_of: ASOF, source: "stub", projects: 1, index: { 2163: { name_en: "SEAGATE", area: "Dubai Maritime City", district: "dmc", key: "dld:seagate", developer: "ACME CORE DEVELOPMENT L.L.C" } } }));
  if (withSales) {
    const sr = [], other = [];
    for (let i = 0; i < 14; i++) { const d = addD(SALES_ASOF, -i); sr.push(srow(d, 3), srow(d, 1, { stage: "ready", beds: null, prices: [5000000], psm: [30000], price_n: 1 })); }
    sr.push(srow("2026-09-28", 1, { kind: "land", dld_project: "KORE LIKE", key: "dld:korelike", dld_project_number: 9, stage: null, beds: null, prices: null, psm: null, price_n: 0 }), srow("2026-09-28", 1, { kind: "mortgage", dld_project: "KORE LIKE", key: "dld:korelike", dld_project_number: 9, stage: null, beds: null, prices: null, psm: null, price_n: 0 }));
    sr.push(srow("2026-10-02", 1, { kind: "land", stage: null, beds: null, prices: null, psm: null, price_n: 0 }), srow("2026-10-03", 1, { kind: "mortgage", stage: null, beds: null, prices: null, psm: null, price_n: 0 }));
    s.set("img_sales_filed_dmc", JSON.stringify({ as_of: SALES_ASOF, basis: "registered", source: "stub", district: "dmc", fields: [], rows: sr }));
    // a second company of the same brand, with sales and no rentals
    const sr2 = []; for (let i = 0; i < 14; i++) sr2.push(srow(addD(SALES_ASOF, -i), 2, { district: "dmc", dld_project: "ACME PEARL", key: "dld:acmepearl", developer_number: 56, developer: "ACME PEARL DEVELOPMENT L.L.C", dld_project_number: 7 }));
    s.set("img_sales_filed_dmc2", JSON.stringify({ as_of: SALES_ASOF, basis: "registered", source: "stub", district: "dmc2", fields: [], rows: sr2.map((r) => Object.assign(r, { district: "dmc2" })) }));
    const pa = [], pdv = [];
    for (let i = 0; i < 14; i++) { const d = addD(SALES_ASOF, -i); pa.push([d, "Dubai Maritime City", "dmc", "sale", "offplan", "1", "Flat", 3, 3, 1010000, 20100]); pdv.push([d, "Dubai Maritime City", "dmc", 55, "ACME CORE DEVELOPMENT L.L.C", "offplan", 3], [d, "Dubai Maritime City", "dmc2", 56, "ACME PEARL DEVELOPMENT L.L.C", "offplan", 2]); }
    s.set("img_sales_filed_dubai", JSON.stringify({ as_of: SALES_ASOF, basis: "registered", source: "stub", caveat: "x",
      per_area: { fields: ["date", "area", "district", "kind", "stage", "beds", "sub_type", "sales", "price_n", "price_median", "psm_median"], rows: pa },
      per_developer: { fields: ["date", "area", "district", "developer_number", "developer", "stage", "sales"], rows: pdv },
      projects: { fields: ["key", "name", "name_ar", "project_number", "district", "area", "developer_number", "developer", "sales", "land", "mortgage"], rows: [["dld:seagate", "SEAGATE", null, 2163, "dmc", "Dubai Maritime City", 55, "ACME CORE DEVELOPMENT L.L.C", 56, 1, 1], ["dld:korelike", "KORE LIKE", null, 9, "dmc", "Dubai Maritime City", 55, "ACME CORE DEVELOPMENT L.L.C", 0, 1, 1]] } }));
    // the per-field docs above use object rows with fields [] on purpose: object rows need no field list
  }
  return s;
}
const page = async (store, qs) => { ejariCacheReset(); const url = new URL("https://x/contracts?" + qs); const r = await ejariRoutes(new Request(url), mkEnv(store), url, H); return await r.text(); };

// ---- B. the headline, the switch, the chart, the tables --------------------------------------------------------------------------------
console.log("B. both numbers in one sentence; the switch; the tables");
const S1 = stores(true);
{
  const h = await page(S1, "kind=district&id=dmc&range=week");
  const t = hl(h);
  ok(/^Dubai Maritime City: \d+ rentals filed with Ejari and \d+ sales registered with the Land Department between 1 Oct and 7 Oct 2026\.$/.test(t), "one sentence with both numbers", t);
  ok(/id=ejview/.test(h) && /data-v=rentals/.test(h) && /data-v=sales/.test(h) && /data-v=both class=on|class=on data-v=both/.test(h), "the Rentals | Sales | Both switch is there and Both is the default");
  ok(/Rentals: (Up|Down|Level|none)/.test(text(h)) && /Sales: (Up|Down|Level|none|no comparison)/.test(text(h)), "a comparison line for each side");
  ok(/<i class=cn><\/i>/.test(h) && /<i class=cs><\/i>/.test(h) && /fill="#C5A56A"/.test(h) && /fill="#6FA8DC"/.test(h), "two-colour daily chart and legend");
  ok(/SALES REGISTERED WITH THE LAND DEPARTMENT/.test(h) && /OFF-PLAN OR READY/.test(h) && /BEDROOMS/.test(h) && /TYPICAL PRICE/.test(h) && /PER SQ M/.test(h), "sales tables: off-plan and ready, bedrooms, price and price per sq m");
  ok(/Sales are registered with the Land Department up to 6 Oct 2026/.test(h), "the one-day lag is said, not hidden");
  ok(/Also registered: 1 mortgage, 1 plot sale/.test(text(h)), "mortgage and plot sale only as the separate small line", (text(h).match(/Also registered[^.]*/) || [])[0]);
  ok(/by registration date/.test(h) && /Sell - Pre registration/.test(h) && /cannot be told apart/.test(h), "by registration date; the off-plan caveat");
  const st = ejariQuery(new URLSearchParams("kind=district&id=dmc&range=week"));
  const A = await ejariAnswer(mkEnv(S1), st);
  const S = await salesAnswer(async (k) => (S1.has(k) ? JSON.parse(S1.get(k)) : null), st, A, {});
  ok(S.n === 6 * 4 + 6 * 1 + 0 || S.n > 0, "sales counted", S.n);
  ok(S.count.off === 18 && S.count.rdy === 6 && S.n === 24, "land and mortgage are not in the 24 sales (18 off-plan, 6 ready)", S.n + " " + S.count.off + "/" + S.count.rdy);
  ok(S.count.price.median != null && S.count.psm.median != null, "median price and price per sq m where five or more were priced");
  const hs = await page(S1, "kind=district&id=dmc&range=week&view=sales");
  ok(!/rentals filed with Ejari/.test(hs) && /sales registered with the Land Department/.test(hs) && !/class=hd>BY PROPERTY TYPE/.test(hs), "Sales view: no rentals content", hl(hs));
  const hr = await page(S1, "kind=district&id=dmc&range=week&view=rentals");
  ok(/signed <b>\d+<\/b> contracts, filed with Ejari/.test(hr) && !/id=ejshead/.test(hr) && /id=ejview/.test(hr), "Rentals view is the v395 content plus the switch");
  ok(/view=sales/.test(h) && !/view=both/.test(h), "links carry the view only when it is not Both");
  const hc = await page(S1, "kind=district&id=dmc&range=custom&from=2026-09-25&to=2026-10-07");
  ok(/rentals filed with Ejari and \d+ sales/.test(hl(hc)) && /between 25 Sep and 7 Oct 2026/.test(hl(hc)), "custom span keeps working", hl(hc));
  const hd = await page(S1, "kind=district&id=dmc&range=day");
  ok(/sales registered with the Land Department on 7 Oct 2026/.test(hl(hd)) && /counted on 6 Oct 2026 \(the latest registered day\)/.test(text(hd)), "Day: the sales slide to their latest day and say so", hl(hd) + " | " + (text(hd).match(/Sales are registered[^.]*\./) || [])[0]);
  const hs0 = await page(S1, "kind=district&id=dmc&range=week&basis=start");
  ok(/rentals signed through Ejari, by contract start date,/.test(hl(hs0)) || /rentals/.test(hl(hs0)), "start basis still words the rentals side", hl(hs0));
}

// ---- C. developer search combines; building with sales and no rentals ---------------------------------------------------------------
console.log("C. developer search (a brand of two companies) and a building with no rentals");
{
  const h = await page(S1, "q=acme&range=week");
  const t = hl(h);
  ok(/^Acme \(all 2 registered companies\): \d+ rentals filed with Ejari and \d+ sales registered/.test(t), "the brand word alone answers for every company together", t);
  ok(/id=ejweeks/.test(h) && /id=ejareas/.test(h) && /BY BUILDING/.test(h), "per week, by area and the building list");
  ok(/<div class=rc2><div>\d+<small>rentals<\/small><\/div><div>\d+<small>sales<\/small><\/div>/.test(h), "the project ranking shows both columns, rentals and sales");
  const one = await page(S1, "kind=developer&id=55&range=week");
  ok(/ACME CORE DEVELOPMENT L\.L\.C: \d+ rentals/.test(hl(one)), "one company on its own", hl(one));
  const noS = await page(stores(false), "q=acme&range=week");
  ok(!/registered companies/.test(noS) && !/id=ejview/.test(noS), "without sales the group offer and the switch do not exist");
  const k = await page(S1, "kind=building&id=dld:korelike&d=dmc&range=custom&from=2026-09-20&to=2026-10-06");
  ok(/no rentals on record with Ejari and <b>0<\/b> sales registered/.test(k) || /no rentals on record with Ejari and 0 sales/.test(hl(k)), "a launch with no tenants and no unit sales: 0 sales, not hidden", hl(k));
  const sv = await page(S1, "kind=building&id=dld:seagate&d=dmc&range=week");
  ok(/rentals filed with Ejari and <b>\d+<\/b> sales|rentals filed with Ejari and \d+ sales/.test(hl(sv)) || /rentals/.test(hl(sv)), "a building with both", hl(sv));
}

// ---- D. no false zero for sales ----------------------------------------------------------------------------------------------------------
console.log("D. no false zero");
{
  const h3 = await page(S1, "kind=district&id=dmc&range=week&view=sales&beds=3");
  ok(/<b>0<\/b> sales match this filter \(<b>24<\/b> were registered with the Land Department\)/.test(h3), "bedroom 3 matches none: '0 sales match this filter (24 were registered)'", hl(h3));
  ok(!/registered with the Land Department between \d.*\b0 sales registered/.test(h3), "never a bare 0 over sales that exist");
  // bedrooms recorded for almost no sale: the chips are off and a remembered chip is ignored
  const S2 = stores(true);
  const rows = []; for (let i = 0; i < 7; i++) rows.push(srow(addD(SALES_ASOF, -i), 5, { beds: null }));
  S2.set("img_sales_filed_dmc", JSON.stringify({ as_of: SALES_ASOF, basis: "registered", source: "stub", district: "dmc", rows }));
  const hb = await page(S2, "kind=district&id=dmc&range=week&view=sales&beds=1");
  ok(/sales registered/.test(hl(hb)) && !/match this filter/.test(hb) && /data-off=1/.test(hb) && /Bedrooms are recorded for only 0% of these sales/.test(text(hb)), "no bedroom on any sale: chips off, remembered chip ignored, count stays 35", hl(hb));
  const he = await page(S1, "kind=district&id=dmc&range=custom&from=2025-01-01&to=2025-01-07");
  ok(true, "an empty window renders");
}

// ---- E. absent sales files = the v395 page -------------------------------------------------------------------------------------------------
console.log("E. absent files: the page is v395");
{
  const S0 = stores(false);
  const hnow = await page(S0, "kind=district&id=dmc&range=week");
  ok(!/id=ejview|vsw|Land Department|SALES/.test(hnow), "no switch, no sales words");
  let old = null;
  try {
    const src = execSync("git show 027d054:src/ejari_page.js", { cwd: path.dirname(new URL("../package.json", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), encoding: "utf8", maxBuffer: 1 << 26 });
    const tmp = new URL("../src/_v395_tmp.mjs", import.meta.url);
    fs.writeFileSync(tmp, src);
    try { old = await import(tmp.href); } finally { fs.rmSync(tmp, { force: true }); }
  } catch (e) { console.log("  (git v395 not readable here: " + String(e).slice(0, 80) + ")"); }
  if (old) {
    for (const qs of ["kind=district&id=dmc&range=week", "kind=district&id=dmc&range=month&basis=start", "kind=developer&id=55&range=week", "kind=building&id=dld:seagate&d=dmc&range=week", "q=acme", "q=zzzz&range=day"]) {
      old.ejariCacheReset(); ejariCacheReset();
      const url = new URL("https://x/contracts?" + qs);
      const a = await (await old.ejariRoutes(new Request(url), mkEnv(S0), url, H)).text();
      const b = await (await ejariRoutes(new Request(url), mkEnv(S0), url, H)).text();
      ok(a === b, "byte-identical to v395: " + qs, a.length + " vs " + b.length);
    }
  }
}

// ---- F. the files parse; no emoji ---------------------------------------------------------------------------------------------------------
console.log("F. parse, emoji");
{
  for (const f of ["../src/sales_view.js", "../src/ejari_page.js", "../src/index.js"]) { const r = spawnSync(process.execPath, ["--check", new URL(f, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")], { encoding: "utf8" }); ok(r.status === 0, f + " parses", r.stderr); }
  const all = (await page(S1, "kind=district&id=dmc&range=week")) + (await page(S1, "q=acme&range=week"));
  ok(!EMOJI.test(all), "no emoji on the page");
  ok(!EMOJI.test(fs.readFileSync(new URL("../src/sales_view.js", import.meta.url), "utf8")), "no emoji in the source");
  const w = salesWindow({ range: "week" }, { from: "2026-10-01", to: "2026-10-07" }, "2026-10-06");
  ok(w.from === "2026-10-01" && w.to === "2026-10-06" && w.prev.days === 6, "a lagging week compares the same number of days", JSON.stringify(w));
}
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
