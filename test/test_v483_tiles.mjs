// v483 - the About card folds into tap tiles. Offline: build the page, then run bpTiles on a tiny DOM stand-in is not enough,
// so this writes a preview page (BP_PREVIEW=path) for a real browser and checks the shipped source carries the helper.
import { writeFileSync } from "node:fs";
import { buildingPageHtml, bpTiles, BP_TILES_CSS } from "../src/building_page.js";
import { pillarsCard } from "../src/pillars.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 300) : "")); } };
const DEV = { name: "DAMAC", projects: { total: 12, due: 12, delivered: 12, cancelled: 0, dated: 12, on_time: 11, late: 1 }, on_time_pct: 92 };
const D = {
  slug: "businessbay", id: "56", name: "Venetian", district: "Business Bay", register: [], types: [],
  floors: [{ l: "G", u: "R" }, { l: "1", u: "R" }, { l: "2", u: "R" }],
  facts: [["Units", "612 registered"], ["Completed", "2015-05-20"], ["Parking", "315 bays"]],
  around: [["Mall", "300 m"]], transit: [{ kind: "Metro", name: "Business Bay", m: 3200 }],
  openFrom: [0, 3, null, 5, 0, null, 2, 0], openRadius: 700,
  sold: { n: 561, first: "2009-01-01", psf: 837, offplan_pct: 33, name: "VENETIAN", recent: [{ date: "2026-08-24", rooms: "1 B/R", sqft: 1003, price: 850000 }, { date: "2026-08-17", rooms: "Studio", sqft: 456, price: 430000 }] },
  rent: { n: 210, scheme: "Venetian", by_type: { "1 bed": { n: 120, aed: 85000 }, "Studio": { n: 90, aed: 55000 } } },
  occupancy: { connections: 483, first: "2014-09", last: "2025-12", y2024: 81, y2025: 137, residential: 471, commercial: 12, by_year: { "2014": 6, "2015": null, "2016": 20, "2024": 81, "2025": 137 } },
  schools: [{ name: "School A", km: 1.2 }], schoolsAll: 26, healthN: 563, amenKm: 5,
  land: { freehold: true, area_sqm: 16559 },
  pillarsHtml: pillarsCard({ axes: [{ key: "location", label: "LOCATION", value: 25, railM: 3200, railKind: "Metro", schools: 26, health: 563, rank: 90, district: "Business Bay" }, { key: "track", label: "TRACK RECORD", value: 90 }, { key: "delivery", label: "DELIVERY RECORD", value: 100 }], dev: DEV, subtitle: "DAMAC", price: { why: "x" } }),
  asOf: "Registers as of Oct 2026",
};
const html = buildingPageHtml(D, "k", "");
const script = (html.match(/<script type="module">([\s\S]*)<\/script>/) || [])[1] || "";
ok(/function bpTiles\(/.test(script) && script.indexOf("bpTiles($(") > script.indexOf("function bpTiles("), "bpTiles travels with the view and is called from the About click");
ok(script.includes(".bp-tiles{"), "its CSS travels too");
ok(typeof bpTiles === "function" && BP_TILES_CSS.length > 200, "exports");
if (process.env.BP_PREVIEW) writeFileSync(process.env.BP_PREVIEW, html);
console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
