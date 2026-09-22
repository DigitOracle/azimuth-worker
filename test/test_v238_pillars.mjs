// v238 — THE FOUR PILLARS (Kendall, 22 Sep 2026).
//
// Broker training says a buyer asks four things: where is it, who built it, can they finish it, what does
// it cost. Three the Land Department registers answer; the fourth — "can the developer fund itself" — they
// do not, because there are no balance sheets in them. These checks exist mostly to stop that honesty
// eroding, and to stop a missing value ever being drawn as a zero.
//
// A NOTE ON WHY GREPPING THE HTML IS FAIR HERE, because it is NOT fair a few hundred lines away. The About
// card is assembled in the browser inside a script string, so every branch's label sits in every page as
// source and a string search passes whatever you feed it — a sibling session found "The one sale on
// record" and "What the two sales fetched" both present on a building with 167 sales. The pillars card is
// built in the WORKER and handed down as a finished string, so what the page carries is the output and
// only the output. That is the whole reason it was built server-side, and these assertions depend on it.
import worker from "../src/index.js";
import { buildingPillars, developerCardAxes, spiderSvg, locationAxis, priceReading } from "../src/pillars.js";

const READ = "owner_admin_key_never_in_client_links_0001";
const SLUG = "businessbay", ID = "6";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };

const PILL = {
  floors: { areaMinSales: 200, developerMinProjects: 3 },
  areas: { "Business Bay": { aed_sqft: 1974, sales: 425 } },
  districts: { "Business Bay": { schools: 26, health: 563, radiusKm: 5, rank: 96 } },
  developers: {
    "907": { name: "DAMAC STAR PROPERTIES (L L C)", licensed: "2005-04-11", years: 21,
      projects: { total: 12, finished: 12, active: 0, not_started: 0, pending: 0, cancelled: 0, due: 12, delivered: 12, overdue: 0, dated: 12, on_time: 11, late: 1 },
      escrow_named_pct: 100, track: 90, delivery: 100, on_time_pct: 92 },
    "11": { name: "YOUNG PROGRAMME L.L.C", licensed: "2023-01-01", years: 3,
      projects: { total: 18, finished: 0, active: 18, not_started: 0, pending: 0, cancelled: 0, due: 0, delivered: 0, overdue: 0, dated: 0, on_time: 0, late: 0 },
      escrow_named_pct: 100, track: 40, delivery: null, delivery_why: "too early to judge - 0 of 18 projects have reached their due date",
      on_time_pct: null, on_time_why: "only 0 of this developer's projects carry both a due date and a completion date" },
  },
  by_name: { "damac star properties": ["907"] },
};

const stack = {
  district: SLUG, generated: "2026-09-22", sources: [], levels: {},
  district_amenities: { centre: { label: "Business Bay" }, radius_km: 5, schools: new Array(26).fill({ name: "s", km: 1 }), health_n: 563 },
  buildings_by_id: { [ID]: { name: "DAMAC Towers", basis: "dm_floors", uses: ["homes"], area_sqm: 17010, height_m: 200,
    floors: [{ l: "5", n: 5, u: "homes", k: 8, a: 1200, t: ["1 bedroom"] }, { l: "6", n: 6, u: "homes", k: 8, a: 1200, t: ["1 bedroom"] }],
    types: [{ t: "1 bedroom", c: "1", units: 164, lo: 5, hi: 14, sqm: 100, aed: 2712000, est: false }],
    transit: [{ kind: "Metro", name: "Business Bay", m: 3200, outside: false }],
    total_units: 760, project: { name: "DAMAC TOWERS", status: "FINISHED", pct: 100, escrow: "Bank", developer_no: "907", developer_name: "DAMAC STAR PROPERTIES (L L C)" } } },
};
const unitmix = { district: SLUG, generated: "2026-09-22",
  buildings_by_id: { [ID]: { status: "verified", name: "DAMAC Towers", total_units: 760, asset_classes: { residential: 338 }, floors: 37,
    rows: [{ type: "1 bedroom", median_sqm: 100, units: 164, median_aed: 2712000, basis: "DLD units register" }] } } };

const store = new Map();
store.set("img_stack_" + SLUG, JSON.stringify(stack));
store.set("img_unitmix_" + SLUG, JSON.stringify(unitmix));
store.set("img_pillars", JSON.stringify(PILL));
const KV = {
  async get(k) { return store.has(k) ? store.get(k) : null; },
  async put(k, v) { store.set(k, v); },
  async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter((k) => k.startsWith(p)).map((name) => ({ name })), list_complete: true }; },
};
globalThis.fetch = async () => new Response("{}", { status: 200 });
const env = { MEETINGS: KV, READ_KEY: READ, INGEST_TOKEN: "ING" };
const r = await worker.fetch(new Request("https://x/building/" + SLUG + "/" + ID + "?key=" + READ), env, { waitUntil() {} });
const html = await r.text();

ok(r.status === 200 && html.includes("The pillars"), "the card reaches the building page through the real route");
ok(html.includes("TRACK RECORD") && html.includes("DELIVERY RECORD") && html.includes("LOCATION"),
  "all three building spokes are named");

// 1. the fourth pillar is reported as unanswerable, not proxied
ok(html.includes("no balance sheets") && !/\bFINANCIAL STRENGTH\b/i.test(html),
  "the financing pillar is stated as unanswerable and no axis claims to measure it");

// 2. price is a signed reading beside the chart, not a spoke
ok(html.includes("+28%") && html.includes("1,974") && html.includes("425 registered sales"),
  "price reads as a signed deviation with the area median and the sale count behind it");
ok(!/<text class="splab[^"]*"[^>]*>(<tspan[^>]*>)?PRICE</.test(html),
  "price is not drawn as a spoke on the polygon");

// 3. a held score draws a point; a missing one must not
const held = buildingPillars({ district: "Business Bay", transit: [{ kind: "Metro", m: 400 }], schoolsAll: 26, healthN: 563, amenKm: 5,
  register: [{ median: 2000000, sqm: 100 }], project: { developer_no: "907" } }, PILL);
ok(held.axes.every((a) => a.value != null), "a building with a known developer scores all three");
const early = buildingPillars({ district: "Business Bay", transit: [{ kind: "Metro", m: 400 }], schoolsAll: 26, healthN: 563, amenKm: 5,
  register: [{ median: 2000000, sqm: 100 }], project: { developer_no: "11" } }, PILL);
ok(early.axes.find((a) => a.key === "delivery").value === null
  && /too early to judge/.test(early.axes.find((a) => a.key === "delivery").why),
  "a developer whose projects are not yet due is unscored with the reason, not scored zero");

const svg = spiderSvg(early.axes);
const dots = (svg.match(/class=spdot/g) || []).length;
ok(dots === early.axes.filter((a) => a.value != null).length && dots < early.axes.length,
  "the missing axis draws NO point - a dot at the origin would say scored zero, the opposite claim");
ok(/class="spoke miss"/.test(svg) && /not held/.test(svg), "the missing axis draws a dashed spoke labelled not held");
ok(!/<polygon class=spfill/.test(svg) && /class=spedge/.test(svg),
  "with a gap the shape is drawn open edge by edge, never closed through the middle");
ok(/<polygon class=spfill/.test(spiderSvg(held.axes)), "with every axis held the shape closes and fills");

// 4. the developer card is a DIFFERENT axis set on purpose
const devAxes = developerCardAxes(PILL.developers["907"]);
ok(devAxes.map((a) => a.key).join(",") === "track,delivery,ontime",
  "the developer card carries ON TIME in place of LOCATION - a developer has no location");
ok(!devAxes.some((a) => a.key === "location"),
  "so nobody can compare a developer's location score with a building's: there is not one");
ok(devAxes[2].value === 92 && /11 of 12 finished by the date they were due/.test(devAxes[2].read),
  "ON TIME reads as a rate over the projects that carry both dates");

// 5. floors hold
ok(locationAxis({ district: "Business Bay", schoolsAll: 26, healthN: 563 }, PILL).value === null,
  "no rail distance means no LOCATION score at all");
ok(/fewer than 200/.test(priceReading({ district: "Nowhere", register: [{ median: 1000000, sqm: 100 }] }, PILL).why || ""),
  "an area under the sales floor gets no median, and says why");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
