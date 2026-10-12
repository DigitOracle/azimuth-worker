// v530 - the area broker PDF (Snapshot and Detailed) gets an "Available to rent now" page: the buildings in the area with flats listed
// now, most first, with the typical asking rent per bedroom type (Kendall 12 Oct 2026: a broker for Business Bay wants to know which buildings).
import fs from "node:fs";
import { availablePage, AVAIL_MAX } from "../src/devmap_pdf.js";
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const C = { names: { plain: "Business Bay" } };
ok(availablePage(C, null) === null && availablePage(C, { rows: [] }) === null, "no listings, no page");
const row = (i, flats) => ({ name: "Tower " + i, flats, adverts: flats + 2, bands: [{ band: "1", flats, adverts: flats, typical: "AED 95k" }] });
const pg = availablePage(C, { asOf: "2026-10-11", rows: [row(1, 12), row(2, 3)] });
ok(pg && pg.sub === "Available to rent now" && /15 flats listed in 2 buildings in Business Bay/.test(pg.html), "the heading and the count", pg && pg.html.slice(0, 300));
ok(/<td>Tower 1<\/td>/.test(pg.html) && /12<br><span[^>]*>AED 95k<\/span>/.test(pg.html), "each building, flats and typical rent per bedroom type");
ok(/Updated 11 Oct 2026/.test(pg.html) && !/vacan/i.test(pg.html) && !/Property Finder/.test(pg.html), "the freshness line; never 'vacant'; no site name");
const many = availablePage(C, { asOf: "2026-10-11", rows: Array.from({ length: AVAIL_MAX + 4 }, (_, i) => row(i, 40 - i)) });
ok((many.html.match(/<tr><td>/g) || []).length === AVAIL_MAX && /And 4 more buildings/.test(many.html), "one page: the first ones, then how many more");
const src = fs.readFileSync(new URL("../src/devmap_pdf.js", import.meta.url), "utf8");
ok(/availablePage\(C, await districtAdvertised\(env, C\.slug\)\)/.test(src), "built for both Snapshot and Detailed, straight after the Snapshot page");
console.log(`v530 area available: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
