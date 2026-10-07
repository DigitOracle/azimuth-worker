// v339 - the investor PDF (kind=investor in src/devmap_pdf.js, built by src/devmap_investor.js): one developer in one area, two A4 pages.
// Synthetic index with the shape of KV img_devmap_index; nothing live is read or written.
import fs from "node:fs";
import { buildAreaPdf, parseParams } from "../src/devmap_pdf.js";
import { seriesModel, trendSentences, growthFigures, yieldFigure, yieldChoice, stepsOf, investorModel, disclaimerText } from "../src/devmap_investor.js";
import { devmapHtml } from "../src/devmap_page.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const SQFT = 10.7639, sqm = (psf) => Math.round(psf * SQFT);
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B55}\u{FE0F}\u{200D}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{25A0}-\u{25FF}]/u;
const BANNED = /not known|to follow|crosswalk|\bKV\b|\bindex\b|claude|gpt|gemini|openai|anthropic/i;
const text = (html) => html.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<svg[\s\S]*?<\/svg>/g, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ");

console.log("the series: 30 sales to show a year, the part year named");
{
  const S = seriesModel([[2020, 12, sqm(900)], [2021, 40, sqm(1000)], [2022, 200, sqm(1100)], [2023, 250, sqm(1050)], [2024, 300, sqm(1200)], [2025, 100, sqm(1300)], [2026, 31, sqm(1250)]], "2026-08-31");
  ok(S.suppressed.join() === "2020", "2020 (12 sales) is suppressed and named");
  ok(!S.solid.some((r) => r.year === 2020) && S.solid.length === 6, "six solid years remain");
  ok(S.partialYear === 2026 && S.cutoff === "31 August 2026" && S.rows.find((r) => r.year === 2026).partial, "2026 is the part year, cut-off 31 August 2026");
  ok(seriesModel([[2025, 50, sqm(1000)]], "2025-12-31").partialYear == null, "a series that ends on 31 December has no part year");
  const area = seriesModel([[2021, 900, sqm(900)], [2022, 1200, sqm(950)], [2023, 1500, sqm(1000)], [2024, 1800, sqm(1100)], [2025, 1700, sqm(1150)], [2026, 900, sqm(1180)]], "2026-08-31");
  const out = trendSentences({ dev: S, area, devName: "Acme", areaName: "Test Area", offplanShare: null, yield: null, offplan: {} });
  const all = out.map((o) => o.text).join(" ");
  ok(/lower than the year before in 2023/.test(all), "the dip in 2023 is said");
  ok(!/every year/.test(all), "a series that dips never says up every year");
  ok(/2026 so far, to 31 August 2026/.test(all) || /So far in 2026 \(to 31 August 2026\)/.test(all), "the part year is labelled with its cut-off date in the words");
  ok(!/2020/.test(all), "the suppressed year is not used in any sentence");
  const g = growthFigures(S);
  ok(g.last.year === 2025 && g.three.from.year === 2022 && Math.abs(g.three.change - (1300 / 1100 - 1)) < 1e-3, "3-year change is 2022 to 2025 (full years only)");
  ok(g.cagr && g.cagr.from.year === 2021 && g.cagr.to.year === 2025 && Math.abs(g.cagr.rate - (Math.pow(1300 / 1000, 1 / 4) - 1)) < 1e-3, "compound rate runs over the longest solid run of full years");
  // a clean rise may say so, and only then
  const up = seriesModel([[2022, 100, sqm(1000)], [2023, 100, sqm(1100)], [2024, 100, sqm(1200)], [2025, 100, sqm(1300)]], "2025-12-31");
  const o2 = trendSentences({ dev: up, area: up, devName: "Acme", areaName: "Test Area", yield: null, offplan: {} });
  ok(/every year on the chart/.test(o2.map((o) => o.text).join(" ")), "a series that rises every year says so");
  ok(stepsOf(up).every((s) => s.change > 0), "steps agree with the claim");
}
console.log("the yield: 30 contracts or nothing for the developer");
{
  const sales = [[40, sqm(1500), 1500000, 1], [40, sqm(1400), 2400000, 2]];
  const few = yieldFigure(sales, [[10, 1, 90000, 1], [8, 1, 140000, 2]]);
  ok(few && few.contracts === 18 && !few.enough, "18 contracts is not enough");
  const many = yieldFigure(sales, [[30, 1, 90000, 1], [20, 1, 140000, 2]]);
  ok(many.enough && Math.abs(many.rate - (40 * 90000 + 40 * 140000) / (40 * 1500000 + 40 * 2400000)) < 1e-6, "50 contracts gives gross rent over price, weighted by sales");
  ok(yieldChoice(few, many).scope === "area", "under 30 for the developer falls back to the area figure, labelled as area");
  ok(yieldChoice(few, few) == null, "under 30 in both gives no figure");
  ok(yieldChoice(many, few).scope === "developer", "30 or more for the developer is used as such");
}

// ---------------------------------------------------------------- the fixture
const cell = (n, psf, bed) => [n, sqm(psf), Math.round(sqm(psf) * (bed ? 60 + 25 * bed : 34)), bed];
const W = (n, med, rn, rm, on, om) => [n, sqm(med), rn, sqm(rm), on, sqm(om), n, sqm(med), 0, 0, 45, 75, 130];
function devRec(name, years, rentN) {
  const c12 = [cell(300, 1500, 1), cell(200, 1450, 2), cell(40, 1400, 0), cell(30, 1350, 3)];
  return { n: name, h: 500, c: c12, b: [[100, sqm(1500), "Acme Tower"]], c12, b12: [[100, sqm(1500), "Acme Tower"]], r: rentN ? [[rentN, 1000, 90000, 1], [rentN, 900, 130000, 2]] : [], ev: { all: W(1200, 1400, 800, 1400, 400, 1450), l12: W(570, 1500, 400, 1520, 170, 1450), y: years } };
}
const ACME = [[2020, 12, sqm(900)], [2021, 40, sqm(1000)], [2022, 200, sqm(1100)], [2023, 250, sqm(1050)], [2024, 300, sqm(1200)], [2025, 100, sqm(1300)], [2026, 40, sqm(1250)]];
function mkIndex() {
  const areaY = [[2020, 400, sqm(950)], [2021, 700, sqm(1000)], [2022, 900, sqm(1050)], [2023, 1000, sqm(1100)], [2024, 1100, sqm(1150)], [2025, 1000, sqm(1200)], [2026, 500, sqm(1220)]];
  const area = { name: "Test Village Circle", bbox: [55.1, 25.0, 55.2, 25.1], register_sales_12m: 900, register_sales_all_time: 2400,
    ev: { all: W(5000, 1100, 3000, 1100, 2000, 1100), l12: W(1500, 1200, 1000, 1210, 500, 1180), y: areaY },
    devs: { acme: devRec("Acme Developments", ACME, 40), thin: devRec("Thin Builders", [[2025, 12, sqm(1000)], [2026, 9, sqm(1010)]], 0), brief: devRec("Brief Homes", [[2024, 60, sqm(1000)]], 5), norent: devRec("No Rent Co", ACME, 0), "_": { n: "Developer not recorded", h: 0, c: [cell(20, 1400, 1)], r: [] } } };
  return { as_of: "2026-09-09", generated: "2026-09-09", cuts: { bounds: [32292, 22604, 16684], shares: { bounds: [32292, 22604, 16684], window: ["2025-09-01", "2026-09-01"], sales: 1000, n: [9, 20, 35, 36], money: [26, 25, 26, 24] }, rule: "x" },
    devs: { acme: { name: "Acme Developments", areas: 1, n: 570, profile: { projects: 1, homes: 500 } } }, alias: {}, areas: { testvillagecircle: area }, scale: { boutiqueMax: 2, midMax: 4 },
    ev: { as_of: "2026-08-31", since: "2019-01-01", l12_from: "2025-09-01", l12_to: "2026-08-31", source_as_of: "2026-09-17", sales: 5000, filters: "Ordinary sales of homes." } };
}
function mkLayer() { const b = []; for (let i = 0; i < 40; i++) { const x = (i % 8) * 60, y = Math.floor(i / 8) * 60; b.push([i + 1, 20 + (i % 5) * 10, [x, y, x + 40, y, x + 40, y + 40, x, y + 40, x, y]]); } return { d: "testvillagecircle", b, s: [[6, [0, 0, 480, 0]]], rp: [], lab: [], ll: [1, 0, 0, 0, 1, 0] }; }
const DELIV = { as_of: "2026-10-02", by: { "testvillagecircle|acme": { done: [4, 900], active: [2, 600, 55.5], pending: [1, 120], top: [["Acme Tower", "active", 55, 400]] } }, area: { testvillagecircle: { done: [30, 8000], active: [9, 2500, 48], pending: [3, 700] } } };
function mkEnv(opts) {
  const store = { img_devmap_index: JSON.stringify(mkIndex()), img_brief_fp_testvillagecircle: JSON.stringify(mkLayer()), img_unitmix_testvillagecircle: JSON.stringify({ buildings_by_id: { 1: { name: "Acme Tower" } } }) };
  if (!(opts && opts.noDeliv)) store.img_devmap_delivery = JSON.stringify(DELIV);
  const KV = { async get(k) { return store[k] == null ? null : store[k]; }, async put() {}, async delete() {}, async list() { return { keys: [] }; } };
  return { MEETINGS: KV, READ_KEY: "owner_key_abcdefgh", CLIENT_KEY: "client_key_123456" };
}
const url = (o) => "https://x/developers_pdf?kind=investor&area=testvillagecircle&window=12m&" + Object.entries(o).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
const build = (o, e) => buildAreaPdf(mkEnv(e), parseParams(new URL(url(o))), { now: Date.parse("2026-10-04T08:00:00Z") });

console.log("the full case: two pages");
{
  const d = await build({ developer: "acme", client: "Ms. A. Investor" });
  ok(d.status === 200 && d.pages === 2, "two pages (" + d.pages + ")");
  const sheets = (d.html.match(/class="sheet page/g) || []).length;
  ok(sheets === 2, "two A4 sheets in the document");
  const t = text(d.html);
  ok(t.includes("Ms. A. Investor") && /Prepared for/.test(t), "prepared for the client name");
  ok(!EMOJI.test(d.html), "no emoji code points");
  ok(!BANNED.test(t), "none of the banned words appear (" + (BANNED.exec(t) || [""])[0] + ")");
  ok(/Curated by Najjuko/.test(t) && /\+971 56 548 4397/.test(t), "footer: Curated by Najjuko and the WhatsApp number");
  ok(/fewer than 30 sales, not shown|2020: fewer than 30 sales/.test(t) || /2020[^.]*fewer than 30 sales, not shown/.test(t), "the suppressed year is named under the chart");
  ok(/2026\* is part of a year, to 31 August 2026/.test(t), "the part year is labelled with its cut-off under the chart");
  ok(/gross, before fees and vacancy/.test(t), "the yield card says gross, before fees and vacancy");
  ok(/Delivery status of its projects here/.test(t) && /handed over/.test(t) && !/\b(late|delayed|on time|on schedule|behind schedule)\b/i.test(t.replace(/early or late/g, "")), "delivery shows status only, no delay or on-time claim");
  ok(/Sales per year/.test(t) && /Ready and off-plan/.test(t) && /Home sizes/.test(t) && /Price against the area and Dubai/.test(t), "page 2 cards present");
  ok(/not investment, financial, legal or tax advice/.test(t) && /Past prices do not guarantee future prices/.test(t) && /confirmed with the developer/.test(t), "the disclaimer is on the sheet");
  ok(/<svg[^>]*aria-label="Median price per sq ft by year/.test(d.html) && /stroke-width="2"/.test(d.html), "the price chart is an SVG with 2px lines");
  ok(/Acme Developments in Test Village Circle|Acme Developments/.test(t), "developer named");
  const blank = await build({ developer: "acme" });
  ok(/class="ul2"/.test(blank.html), "no client name: a blank line to write one");
  const nod = await build({ developer: "acme" }, { noDeliv: true });
  ok(nod.pages === 2 && !/Delivery status of its projects here/.test(text(nod.html)), "no project register on file: the delivery cards are left out, still two pages");
  const nrent = await build({ developer: "norent" });
  ok(nrent.pages === 2 && /not enough rent contracts yet|area-level/.test(text(nrent.html)), "no rent contracts for the developer: area-level label or the quiet card");
  ok(/area-level/.test(text(nrent.html)), "the area figure is labelled area-level");
  const m = d.model;
  ok(m.yield && m.yield.scope === "developer" && m.yield.contracts === 80, "40+40 contracts: the developer's own yield is used");
  const evil = await build({ developer: "acme", client: '<img src=x onerror=alert(1)>"' });
  ok(!/<img src=x/.test(evil.html), "the client name cannot inject markup");
}
console.log("the degraded page");
{
  const d = await build({ developer: "thin" });
  ok(d.status === 200 && d.pages === 1, "one page, not a thin chart");
  const t = text(d.html);
  ok(/Not enough registered sales yet for this developer in this area/.test(t), "the clear message is shown");
  ok(!/<svg[^>]*aria-label="Median price per sq ft by year/.test(d.html), "no chart on the degraded page");
  ok(!EMOJI.test(d.html) && !BANNED.test(t), "no emoji, no banned words on it");
  const one = await build({ developer: "brief" });
  ok(/Not enough registered sales yet/.test(text(one.html)), "one solid year only also degrades");
  const miss = await build({ developer: "nobody" });
  ok(miss.status === 404, "an unknown developer in this area is a 404");
  const none = await build({});
  ok(none.status === 400, "no developer is a 400");
}
console.log("the model and the request");
{
  const m = investorModel(mkIndex(), "testvillagecircle", "acme", DELIV);
  ok(m.enough && m.dev.suppressed.join() === "2020", "model: enough, 2020 suppressed");
  ok(m.l12.ready && m.l12.off && m.mix && m.mix.n === 570, "model: ready, off-plan and unit mix");
  ok(m.deliv && m.supply, "model: delivery and supply read from the register payload");
  ok(disclaimerText(m).includes("31 August 2026"), "the disclaimer carries the as-of date");
  const p = parseParams(new URL("https://x/developers_pdf?kind=investor&area=sobhaheartland&developer=Sobha&client=Dr%20X&key=k"));
  ok(p.kind === "investor" && p.developer === "sobha" && p.client === "Dr X" && p.area === "sobhaheartland", "parseParams reads developer and client");
  const bad = await buildAreaPdf(mkEnv(), parseParams(new URL("https://x/developers_pdf?kind=nonsense&area=testvillagecircle")), {});
  ok(bad.status === 400, "other kinds are still rejected");
  const snap = await buildAreaPdf(mkEnv(), parseParams(new URL("https://x/developers_pdf?kind=snapshot&area=testvillagecircle&developers=acme")), { now: Date.parse("2026-10-04T08:00:00Z") });
  ok(snap.status === 200 && snap.pages === 1, "the snapshot kind is unchanged");
}
console.log("the entry point on the page");
{
  const h = devmapHtml({}) + "";
  ok(/'Investor'/.test(h) && /kind=investor&area=/.test(h), "the Investor button is in the developers page script (v398: short label)");
  ok(/class=pdfbtn[^>]*>'\+icoSvg\('chart-bar','pdfic'\)\+'Investor'/.test(h) || /pdBtn\('chart-bar','Investor'/.test(h), "it carries an icon and the same button style (v398: pdBtn, short label)");
}
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
