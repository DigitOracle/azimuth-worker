// v399: the all-Dubai page, joined on the REAL file shapes. Live (7 Oct) it showed "Business Bay 901 rentals, 0 sales" and "Developer recorded for 0%":
// the filed rentals rows carry an AREA and no district, the sales rows carry both, and the Dubai sales rows hold no developer (per_developer does).
// NEGATIVE CONTROL: revert the key join in whereBothHtml (src/sales_view.js) to the district-or-"area:" keys and the Business Bay assertion fails.
import { ejariRoutes, ejariCacheReset } from "../src/ejari_page.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? " :: " + String(d).slice(0, 300) : "")); } };
const addD = (s, n) => new Date(Date.parse(s + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const ASOF = "2026-10-07", SA = "2026-10-06";
const rent = [], sales = [], dev = [];
for (let i = 0; i < 40; i++) {
  const d = addD(ASOF, -i);
  rent.push([d, "Business Bay", "Flat", "New", 60], [d, "Business Bay", "Flat", "Renew", 20], [d, "Marsa Dubai", "Flat", "New", 30]);
  const s = addD(SA, -i);   // the real sales row shape: date, area, district, kind, stage, beds, sub_type, sales, price_n, price_median, psm_median
  sales.push([s, "Business Bay", "businessbay", "sale", "offplan", "1", "Flat", 6, 6, null, null], [s, "Business Bay", "businessbay", "sale", "ready", "2", "Flat", 4, 4, null, null], [s, "Marsa Dubai", "dubaimarina", "sale", "ready", "studio", "Flat", 2, 2, null, null]);
  dev.push([s, "Business Bay", "businessbay", 77, "TEST DEVELOPER L.L.C", "offplan", 6], [s, "Marsa Dubai", "dubaimarina", 78, "OTHER DEVELOPER L.L.C", "ready", 1]);
}
const store = new Map();
store.set("img_ejari_filed_dubai", JSON.stringify({ as_of: ASOF, basis: "filed", source: "stub", caveat: "x", per_area: { fields: ["date", "area", "sub_type", "reg_type", "contracts"], rows: rent } }));
store.set("img_sales_filed_dubai", JSON.stringify({ as_of: SA, basis: "registered", source: "stub", caveat: "x",
  per_area: { fields: ["date", "area", "district", "kind", "stage", "beds", "sub_type", "sales", "price_n", "price_median", "psm_median"], rows: sales },
  per_developer: { fields: ["date", "area", "district", "developer_number", "developer", "stage", "sales"], rows: dev }, projects: { fields: ["key", "name", "name_ar", "project_number", "district", "area", "developer_number", "developer", "sales", "land", "mortgage"], rows: [] } }));
const env = { MEETINGS: { async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); return t === "arrayBuffer" ? new TextEncoder().encode(v).buffer : v; } } };
const H = { clientOk: () => true, clientResp: (e, u, h, i) => new Response(h, i), residentsKeyOf: () => "", najNav: () => "", NAJ_NAV_CSS: "", NAJ_FONTS: "" };
ejariCacheReset();
const u = new URL("https://x/contracts?kind=dubai&range=week");
const h = await (await ejariRoutes(new Request(u), env, u, H)).text();
const where = (h.match(/<table class=two id=ejwhere2>.*?<\/table>/s) || [""])[0];
const cells = (name) => { const m = where.match(new RegExp("<tr><td>(?:<a[^>]*>)?" + name + "(?:</a>)?</td><td><b>([\\d,]+)</b></td><td class=s><b>([\\d,]+)</b>")); return m ? [m[1], m[2]] : null; };
const bb = cells("Business Bay"), md = cells("Marsa Dubai");
ok(bb && bb[0] === "560" && bb[1] === "60", "Business Bay: rentals and a NONZERO sales figure side by side (7 x 80 rentals, 6 days x 10 sales)", JSON.stringify(bb));
ok(md && md[1] === "12", "Marsa Dubai sales joined on the area name (6 days x 2)", JSON.stringify(md));
ok((where.match(/>Business Bay</g) || []).length === 1, "each place once: no separate sales-only duplicate row");
const attr = (h.match(/id=ejattr>(.*?)<\/div>/) || [, ""])[1];
ok(/Developer recorded for (\d+)% of these sales/.test(attr) && !/for 0%/.test(attr), "a nonzero developer share on the Dubai view", attr);
const m = /recorded for (\d+)%/.exec(attr);
ok(m && Number(m[1]) === 58, "58% = 7 of the 12 sales a day have a developer (from per_developer)", attr);
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
