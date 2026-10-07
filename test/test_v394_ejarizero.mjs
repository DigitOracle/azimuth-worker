// v394 (Kendall, 7 Oct 2026): the EJARI "Contracts signed" page must never print a false ZERO.
// The filed feed carries no bedroom count for almost every contract (Business Bay 0.3% known, Dubai Maritime City 0%, Marina 0.9%, JVC 4.7%),
// the contract-start feed does (58% / 78% / 90% / 98%). A bedroom chip on the filed basis used to leave nothing, so the page said "signed 0".
// Offline: the KV is a stub, the fixtures mimic the two feeds. Fixture figures are the measured shares; the rows are invented.
// NEGATIVE CONTROL: in src/ejari_page.js set COVERAGE_MIN to 0 (import from coverage_guard.js) and the filed-basis assertions in A and B fail
// (the remembered chip zeroes the page again).
import fs from "fs";
import { ejariAnswer, ejariPageHtml, ejariQuery, COVERAGE_MIN, coverageOf } from "../src/ejari_page.js";
import { coverageOk, pctSay } from "../src/coverage_guard.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? " :: " + d : "")); } };
const addD = (s, n) => new Date(Date.parse(s + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const ASOF = "2026-10-07", START_ASOF = "2026-10-05";

const mkEnv = (store) => ({ MEETINGS: { async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); return t === "arrayBuffer" ? new TextEncoder().encode(v).buffer : v; } } });
const row = (date, n, beds, extra) => Object.assign({ date, contracts: n, reg_type: "New", district: "x", area: "A", sub_type: "1bed room+Hall" }, beds == null ? {} : { beds }, extra || {});
const doc = (basis, asOf, rows) => JSON.stringify({ as_of: asOf, source: "stub", basis, rows });

// ---- fixtures from the measured numbers ----
const store = new Map();
// Dubai Maritime City, filed: 5 contracts on 1 Oct, no bedroom on any; nothing in the week before
store.set("img_ejari_filed_dubaimaritimecity", doc("filed", ASOF, [row("2026-10-01", 5, null, { district: "dubaimaritimecity", area: "Dubai Maritime City" })]));
// Business Bay, filed: 80 a day for 30 days, a handful with a bedroom (0.3%)
{ const rows = []; for (let i = 0; i < 30; i++) { const d = addD(ASOF, -i); rows.push(row(d, i % 10 === 0 ? 79 : 80, null, { district: "businessbay", area: "Business Bay" })); if (i % 10 === 0) rows.push(row(d, 1, "1", { district: "businessbay", area: "Business Bay" })); }
  store.set("img_ejari_filed_businessbay", doc("filed", ASOF, rows)); }
// Business Bay, contract start: 58% of the contracts have a bedroom band (1 and 2), 42% do not
{ const rows = []; for (let i = 0; i < 30; i++) { const d = addD(START_ASOF, -i); rows.push(row(d, 30, "1", { district: "businessbay", area: "Business Bay" }), row(d, 28, "2", { district: "businessbay", area: "Business Bay" }), row(d, 42, null, { district: "businessbay", area: "Business Bay" })); }
  store.set("img_ejari_recent_businessbay", doc("start", START_ASOF, rows)); }
// a district with data only long ago: the window itself is empty
store.set("img_ejari_filed_arjan", doc("filed", ASOF, [row(addD(ASOF, -25), 7, null, { district: "arjan", area: "Arjan" })]));
store.set("img_ejari_filed_dubai", doc("filed", ASOF, [row("2026-10-06", 100, null, { district: "businessbay", area: "Business Bay" })]));
const env = mkEnv(store);

const page = async (qs) => {
  const st = ejariQuery(new URLSearchParams(qs));
  const A = await ejariAnswer(env, st);
  return { st, A, html: ejariPageHtml({ st, key: "k", rk: "", answer: A, nav: "", navCss: "", fonts: "" }) };
};
const hl = (h) => (h.match(/<div class=hl id=ejhl>(.*?)<\/div>/) || [, ""])[1].replace(/<[^>]+>/g, "");

// ---- A. Dubai Maritime City, filed basis, remembered chips Studio,1,2,3 ----
console.log("A. Maritime City, filed, remembered chips");
const a = await page("kind=district&id=dubaimaritimecity&range=week&beds=studio,1,2,3");
ok(a.A.count.n === 5, "the remembered chips do not zero it: 5 contracts counted", a.A.count.n);
ok(/signed 5 contracts, filed with Ejari/.test(hl(a.html)), "headline says 5 contracts", hl(a.html));
ok(!/signed 0 /.test(a.html), "no 'signed 0' anywhere");
ok(/Bedrooms known for 0% of these contracts\./.test(a.html), "coverage line: known for 0%");
ok(/id=ejbeds data-off=1/.test(a.html) && (a.html.match(/class="ch dis"/g) || []).length === 7, "all seven bedroom chips are disabled");
ok(a.html.includes("Bedrooms are not recorded on contracts filed in the last days. Switch to contract start to split by bedrooms."), "the one-line reason is shown");
ok(!/id=ejexcl/.test(a.html), "no excluded sentence when no bedroom filter is applied");
ok(a.A.beds.ignored.join() === "studio,1,2,3", "the remembered selection is recorded as ignored");

// ---- B. Business Bay, filed, remembered chip 1 ----
console.log("B. Business Bay, filed, remembered chip 1");
const b = await page("kind=district&id=businessbay&range=week&beds=1");
ok(b.A.count.n > 400, "about 80 a day over the week, not 0", b.A.count.n);
ok(/Bedrooms known for 0\.[0-9]% of these contracts\./.test(b.html), "coverage line shows the sub-1% share", (b.html.match(/Bedrooms known for [^<]*/) || [])[0]);
ok(b.html.includes("id=ejbedsnote") && !/id=ejexcl/.test(b.html), "chips off, reason on");
ok(!/match this filter/.test(b.html), "no 'match this filter' line when nothing was filtered out");
const b0 = await page("kind=district&id=businessbay&range=week");
ok(b0.A.count.n === b.A.count.n, "with and without the remembered chip the count is the same", b0.A.count.n + " vs " + b.A.count.n);

// ---- C. start basis: chips work and the excluded-unknown sentence appears ----
console.log("C. Business Bay, contract start, chip 1");
const c = await page("kind=district&id=businessbay&range=week&basis=start&beds=1");
ok(!/data-off=1/.test(c.html) && /id=ejbeds>/.test(c.html), "bedroom chips are offered");
ok(c.A.beds.ok && Math.abs(c.A.beds.share - 0.58) < 0.001, "coverage 58% on the start feed", c.A.beds.share);
ok(c.A.count.n === 7 * 30, "only the 1-bed contracts are counted (30 a day x 7)", c.A.count.n);
ok(/id=ejexcl>294 of 700 contracts have no bedroom recorded and are not in this count\./.test(c.html), "the excluded-unknown sentence: 294 of 700", (c.html.match(/id=ejexcl>[^<]*/) || [])[0]);
ok(!/id=ejcov/.test(c.html), "the filed-basis coverage line is not printed on the start basis");
const c3 = await page("kind=district&id=businessbay&range=week&basis=start&beds=3");
ok(c3.A.count.n === 0 && c3.A.beds.allN === 700, "bedroom 3 matches nothing, 700 contracts in the window", c3.A.count.n + "/" + c3.A.beds.allN);
ok(/0<\/b> match this filter; <b>700<\/b> contracts were signed through Ejari/.test(c3.html), "rule 3: '0 match this filter; 700 contracts ...', never a bare 0", hl(c3.html));

// ---- D. an empty window prints 0 honestly ----
console.log("D. an empty window");
const d = await page("kind=district&id=arjan&range=week");
ok(d.A.count.n === 0 && d.A.beds.allN === 0, "no contracts in the window");
ok(/signed <b>0<\/b> contracts, filed with Ejari/.test(d.html) && !/match this filter/.test(d.html), "prints '0 contracts' plainly", hl(d.html));
const d2 = await page("kind=district&id=arjan&range=week&beds=2");
ok(!/match this filter/.test(d2.html) && /signed <b>0<\/b>/.test(d2.html), "an empty window with a remembered chip is still an honest zero");

// ---- E. all of Dubai, and the page as a whole ----
console.log("E. Dubai-wide, markup");
const e = await page("kind=dubai&id=dubai&range=week&beds=1");
ok(e.A && !e.A.notFound && e.A.count.n === 100, "Dubai-wide filed with a remembered chip: 100, not 0", e.A && e.A.count && e.A.count.n);
const all = a.html + b.html + c.html + d.html + e.html;
ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u.test(all), "no emoji");
ok(/<\/html>$/.test(a.html), "page renders to the end");
const src = fs.readFileSync(new URL("../src/ejari_page.js", import.meta.url), "utf8");
ok(!/[\u{1F300}-\u{1FAFF}]/u.test(src), "no emoji in the source");

// ---- F. the guard ----
console.log("F. coverageOf");
ok(COVERAGE_MIN === 0.5, "threshold is 0.5");
ok(coverageOf([], "x") === null, "empty is null");
ok(Math.abs(coverageOf([{ n: 3, beds: "1" }, { n: 1, beds: null }, { n: 0, beds: "" }], "beds") - 0.75) < 1e-9, "weighted by n, null and empty are unknown");
ok(coverageOf([{ k: true }, { k: false }], "k") === 0.5, "a row without n counts 1; false is unknown");
ok(coverageOk([{ n: 1, a: 1 }, { n: 1 }], "a") === true && coverageOk([{ n: 1, a: 1 }, { n: 3 }], "a") === false, "coverageOk at the threshold");
ok(pctSay(0.003) === "0.3%" && pctSay(0.047) === "4.7%" && pctSay(0.58) === "58%" && pctSay(0) === "0%" && pctSay(0.0001) === "under 0.1%", "pctSay");
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
