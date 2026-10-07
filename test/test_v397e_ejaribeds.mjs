// v397e: the filed feed now carries bedroom bands joined from the Ejari export (row field beds_src = "portal_join"; "rooms" = the gateway's own ROOMS).
// The Contracts page says so under a filed-basis view, and only then. Offline: KV stub, invented rows.
// NEGATIVE CONTROL: remove joinl from headline() in src/ejari_page.js and A/B below fail; drop the A.basis === "filed" test and C fails.
import { ejariAnswer, ejariPageHtml, ejariQuery, EJARI_JOIN_NOTE } from "../src/ejari_page.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? " :: " + d : "")); } };
const addD = (s, n) => new Date(Date.parse(s + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const ASOF = "2026-10-07", START_ASOF = "2026-10-05";
const NOTE = "Bedrooms on filed days come from matching the contract to the Ejari export; the latest 2 to 3 days have no bedroom split yet.";
const mkEnv = (store) => ({ MEETINGS: { async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); return t === "arrayBuffer" ? new TextEncoder().encode(v).buffer : v; } } });
const row = (date, n, beds, extra) => Object.assign({ date, contracts: n, reg_type: "New", district: "businessbay", area: "Business Bay", sub_type: "1bed room+Hall" }, beds == null ? {} : { beds }, extra || {});
const doc = (basis, asOf, rows) => JSON.stringify({ as_of: asOf, source: "stub", basis, rows });
const store = new Map();
// filed with join: 30 days; per day 40 joined 1-bed, 30 joined 2-bed, 10 own-rooms 1-bed, 20 unknown (80% known)
{ const rows = []; for (let i = 0; i < 30; i++) { const d = addD(ASOF, -i);
    rows.push(row(d, 40, "1", { beds_src: "portal_join" }), row(d, 30, "2", { beds_src: "portal_join" }), row(d, 10, "1", { beds_src: "rooms" }), row(d, 20, null)); }
  store.set("img_ejari_filed_businessbay", doc("filed", ASOF, rows)); }
// filed, v394-style (no beds_src, almost no beds)
{ const rows = []; for (let i = 0; i < 30; i++) { const d = addD(ASOF, -i); rows.push(row(d, 80, null, { district: "jvc", area: "JVC" })); if (i % 10 === 0) rows.push(row(d, 1, "1", { district: "jvc", area: "JVC" })); }
  store.set("img_ejari_filed_jvc", doc("filed", ASOF, rows)); }
// filed with only rooms-sourced bands (no join rows) at high coverage
{ const rows = []; for (let i = 0; i < 30; i++) rows.push(row(addD(ASOF, -i), 50, "2", { district: "marina", area: "Marina", beds_src: "rooms" }));
  store.set("img_ejari_filed_marina", doc("filed", ASOF, rows)); }
// start basis
{ const rows = []; for (let i = 0; i < 30; i++) { const d = addD(START_ASOF, -i); rows.push(row(d, 30, "1"), row(d, 28, "2"), row(d, 42, null)); }
  store.set("img_ejari_recent_businessbay", doc("start", START_ASOF, rows)); }
const env = mkEnv(store);
const page = async (qs) => { const st = ejariQuery(new URLSearchParams(qs)); const A = await ejariAnswer(env, st);
  return { st, A, html: ejariPageHtml({ st, key: "k", rk: "", answer: A, nav: "", navCss: "", fonts: "" }) }; };
const hl = (h) => (h.match(/<div class=hl id=ejhl>(.*?)<\/div>/) || [, ""])[1].replace(/<[^>]+>/g, "");

console.log("A. filed basis, join rows present");
ok(EJARI_JOIN_NOTE === NOTE, "the note is the agreed wording");
const a = await page("kind=district&id=businessbay&range=week");
ok(a.html.includes('id=ejjoin>' + NOTE + "<"), "caveat shown under the filed view");
ok(a.A.beds.ok && a.A.beds.share > 0.79 && a.A.beds.share < 0.81, "coverage 80% with join rows", a.A.beds.share);
ok(/Bedrooms known for 80% of these contracts\./.test(a.html), "coverage line says 80%");
ok(/id=ejbeds>/.test(a.html) && !/data-off=1/.test(a.html), "bedroom chips offered");

console.log("B. bedroom chip filter with join rows is not a false zero");
const b = await page("kind=district&id=businessbay&range=week&beds=1");
ok(b.A.count.n === 7 * 50, "1-bed = joined + own rooms, 50 a day x 7", b.A.count.n);
ok(!/match this filter/.test(b.html) && !/signed <b>0<\/b>/.test(b.html), "no zero line");
ok(b.html.includes("id=ejjoin"), "caveat still shown with the chip on");
const b2 = await page("kind=district&id=businessbay&range=week&beds=2");
ok(b2.A.count.n === 7 * 30, "2-bed = 30 a day x 7", b2.A.count.n);

console.log("C. contract-start basis unchanged");
const c = await page("kind=district&id=businessbay&range=week&basis=start&beds=1");
ok(!c.html.includes("id=ejjoin") && !c.html.includes("matching the contract to the Ejari export"), "no join caveat on contract start");
ok(c.A.count.n === 7 * 30 && /id=ejexcl>294 of 700/.test(c.html), "start basis counts as before", c.A.count.n);

console.log("D. absent beds_src = v394");
const d = await page("kind=district&id=jvc&range=week&beds=1");
ok(!d.html.includes("id=ejjoin"), "no caveat without beds_src");
ok(d.A.count.n > 400 && /data-off=1/.test(d.html), "v394 behaviour: chips off, not zero", d.A.count.n);
const m = await page("kind=district&id=marina&range=week");
ok(!m.html.includes("id=ejjoin") && /id=ejbeds>/.test(m.html), "rooms-only bands: no caveat, chips on");
ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(a.html + b.html), "no emoji");
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
