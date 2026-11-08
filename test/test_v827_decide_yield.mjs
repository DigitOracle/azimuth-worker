// v827: decide card, service charge + net yield. Fixtures are STORED rows read once from MotherDuck najma on 9 Nov 2026
// (lk_project_net_yield, built_on 2026-11-08; najma_service_charges is_latest Residential 2026 medians: 975 19.26, 1957 22.53, 1619 20.08).
import assert from "node:assert/strict";
import { decideFacts, decideCardHtml, YIELD_LABEL } from "../src/decide_card.js";

const row = (beds, status, sale, size, rent, sc_annual, gross, net, sales_n, rents_n) => ({ beds, status, sale, size, rent, sc_annual, gross, net, sales_n, rents_n });
const pack = (pn, sc, year, beds) => ({ service_charge: { aed_sqft: sc, year, project_number: pn, source: "Dubai Land Department Mollak" }, net_yield: { project_number: pn, sales_to: "2026-11-01", rents_to: "2026-10-30", beds } });

// REMRAAM 975: ok + thin
const REMRAAM = pack("975", 19.26, 2026, [row(0, "thin", 470000, 468, 42000, 9022, 8.94, 7.02, 29, 124), row(1, "ok", 680000, 755, 58000, 14541, 8.53, 6.39, 90, 417),
  row(2, "ok", 1095000, 1096, 82000, 21107, 7.49, 5.56, 69, 229), row(3, "thin", 1800000, 2206, 130000, 42493, 7.22, 4.86, 25, 49)]);
// Seventh Heaven 1619: withheld, thin, check (12.19% gross), withheld with no price
const SEVENTH = pack("1619", 20.08, 2026, [row(0, "withheld", 974801, 560, 95000, 11248, null, null, 15, 3), row(1, "thin", 1825179, 1057, 149000, 21231, 8.16, 7, 55, 26),
  row(2, "check", 2870705, 1651, 350000, 33147, 12.19, 11.04, 39, 32), row(3, "withheld", null, null, 540000, null, null, null, 0, 4)]);
// Park Gate Residences 1957: withheld (stored gross is null there), ok
const PARKGATE = pack("1957", 22.53, 2026, [row(1, "withheld", 1980000, 987, 105000, 22246, null, null, 9, 40), row(2, "ok", 2962500, 1611, 150000, 36287, 5.06, 3.84, 30, 114), row(3, "withheld", 4100000, 2163, 219410, 48725, null, null, 3, 15)]);

const quiet = { log: () => {} };

{ // ok and thin shown; thin tagged; every stored row accounted for (denominator = all rows)
  const f = decideFacts(REMRAAM);
  assert.equal(f.rows.length, 4);
  assert.deepEqual(f.rows.map((r) => r.shown), [true, true, true, true]);
  assert.deepEqual(f.rows.map((r) => r.thin), [true, false, false, true]);
  assert.equal(f.rows[1].net, 6.39);
  // the worker's annual charge agrees with the stored sc_annual_aed (rate x median size) within rounding
  for (const r of REMRAAM.net_yield.beds) assert.ok(Math.abs(f.rows.find((x) => x.beds === r.beds).sc_annual - r.sc_annual) <= 1, "sc_annual beds " + r.beds);
  assert.deepEqual(f.typical, { beds: 1, size: 755, aed: 14541 });   // the bedroom count with the most sales
  const h = decideCardHtml(REMRAAM, quiet);
  assert.ok(h.includes("AED 19.26 per sq ft per year"));
  assert.ok(h.includes("(2026 budget, Dubai Land Department Mollak)"));
  assert.ok(h.includes(YIELD_LABEL));
  assert.equal((h.match(/few rentals/g) || []).length, 2);
  assert.ok(h.includes("6.4%") && h.includes("8.5%"));
}
{ // withheld and check: no figure; check logged for review, never shown
  const logs = [];
  const h = decideCardHtml(SEVENTH, { log: (s) => logs.push(s) });
  assert.ok(!h.includes("12.2%") && !h.includes("11.0%"), "check row leaked");
  assert.equal((h.match(/not enough rentals/g) || []).length, 3);
  assert.equal(logs.length, 1);
  assert.ok(logs[0].includes("project 1619 beds 2"));
  assert.ok(h.includes("8.2%") && h.includes("7.0%"));   // the thin 1-bed is shown
}
{ // Park Gate: one ok, two withheld
  const f = decideFacts(PARKGATE);
  assert.deepEqual(f.rows.map((r) => r.shown), [false, true, false]);
  assert.equal(f.rows[1].gross, 5.06);
}
{ // gross_only: gross shown, no net; outlier or missing charge: no rate
  const f = decideFacts({ net_yield: { project_number: "x", beds: [row(1, "gross_only", 1e6, 800, 70000, null, 7, null, 40, 40)] } });
  assert.equal(f.rows[0].gross, 7); assert.equal(f.rows[0].net, null); assert.equal(f.sc, null);
  assert.ok(decideCardHtml({ service_charge: { aed_sqft: 140, year: 2026 } }, quiet).includes("No owners-association budget"));
  assert.ok(decideCardHtml(null, quiet).includes("not enough ready sales"));
}
{ // a withheld row that somehow carries numbers still shows nothing
  const f = decideFacts(pack("y", 15, 2026, [row(1, "withheld", 1e6, 800, 70000, 12000, 7, 5.8, 5, 5)]));
  assert.equal(f.rows[0].shown, false); assert.equal(f.rows[0].gross, null);
}
console.log("test_v827_decide_yield: ok");
