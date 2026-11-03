// v725 - Building Passport Release 1 blockers (Kendall, 4 Nov 2026; audit Operations/Research/Building_Passport_Coverage_Audit_04NOV2026.md section 10).
// Part A: fixture rules (building-level identity, as-of + old-register note, tenancy history, Google labelling + sales-office filter, access, adverts).
// Part B: STORED rows - test/fixtures/v725_stored_packs.json was built by plot_passport_market.packs_for against MotherDuck (read only) on 4 Nov 2026
//         for parcels 3265635 (Dubai Wharf) and 3466876 (U-Bora Towers); the checks below are the audit's own findings.
// Part C: the listing-history loader on a small local CSV (no lake, no MotherDuck), and its 04:00-08:00 Dubai refusal.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const B = await import("../src/building_passports.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 500)); } };
const pp = (o) => Object.assign({ id: "naj:plot:1-1", parcel: "1000001", project: "Test Tower", area_name: "Test Area", buildings: [], flats: {} }, o || {});
const all = (f) => f.lines.join("\n");

// ---------- A1 building-level identity
{
  const pack = { project: { number: 9001, status: "FINISHED", as_of: "2026-06-15" }, projects_on_plot: [9001, 9002],
    bldgs: [{ pid: 1, pn: 9001, no: "1", name: "Tower A", floors: 52, flats: 400, car_parks: 450, lifts: 8, units: 400, mix: [{ rooms: "1 B/R", n: 250 }, { rooms: "2 B/R", n: 150 }] },
            { pid: 2, pn: 9002, no: "2", name: "Tower B", floors: 3, flats: 20, units: 20, mix: [{ rooms: "Studio", n: 20 }] }],
    refs: { records: 1, filed: 2, default_height: 1 }, tenancies: { total: 100, beds: {}, to: "2026-10-30", window_days: 400 },
    units: [{ rooms: "1 B/R", type: "Flat", n: 250 }, { rooms: "2 B/R", type: "Flat", n: 150 }, { rooms: "Studio", type: "Flat", n: 20 }] };
  const f = B.bppFacts(pp(), pack, "2026-11-04"), t = all(f);
  ok(/Tower A \(building no\. 1\): 52 floors, 400 flats, 450 car parks, 8 lifts/.test(t), "per-building floors/flats/car parks/lifts", t);
  ok(/Tower B \(building no\. 2\): 3 floors, 20 flats, car parks not recorded, lifts not recorded/.test(t), "second building has its own figures, unknown said so");
  ok(!/\b55 floors\b|\b420 flats\b/.test(t), "never summed into one building");
  ok(/2 DLD projects share this plot/.test(t) && /project level/.test(t), "project-level label when projects share a plot");
  ok(f.missing.some((m) => /12 m figure .* default/.test(m)), "12 m default height flagged as unknown");
  ok(/Occupancy signals[^\n]*400 homes in Tower A \(DLD project 9001\)/.test(t), "occupancy bar uses the primary project's buildings only", t.match(/Occupancy[^\n]*/));
}
// ---------- A5 as-of dates and the old-register note
{
  const pack = { asof: { g_dld__projects: { src: "projects register (Dubai Land Department)", date: "2026-06-15", days: 141 }, g_dld__units: { date: "2026-10-15", days: 19 } },
    project: { number: 1, as_of: "2026-06-15" }, units: [{ rooms: "1 B/R", type: "Flat", n: 5 }] };
  const t = all(B.bppFacts(pp(), pack, "2026-11-04"));
  ok(/Project register \(projects register \(Dubai Land Department\), as of 15 Jun 2026; NOTE: this register is 141 days old/.test(t), "old register note", t);
  ok(/Units register \(units register \(Dubai Land Department\), as of 15 Oct 2026\)/.test(t), "fresh register: date, no note");
  ok(B.asOf({}, "g_dld__projects", "2026-08-25", "2026-11-04").includes("71 days old"), "age from the fallback date when no freshness row");
  ok(B.asOf({}, "g_dld__projects") === "", "no date known = nothing claimed");
}
// ---------- A3 tenancy history
{
  const pack = { project: { number: 1869 }, tenancies: { total: 171, beds: { "1": [76500, 34] }, to: "2026-10-30", window_days: 400, history: { all_time: 1496, last_12m: 148, renewals_12m: 96, first: "2017-01-29", to: "2026-10-30" } } };
  const t = all(B.bppFacts(pp(), pack, "2026-11-04"));
  ok(/1,496 residential contracts since 29 Jan 2017; 148 in the last 12 months, of which 96 renewals \(65% renewal rate, 96 of 148\)/.test(t), "full history with numerator and denominator", t);
}
// ---------- A6 Google
{
  const g = { places: [
    { place_id: "P1", name: "Tower A", rating: 4.2, count: 31, as_of: "2026-10-15", uri: "https://maps.google.com/?cid=1", held: 5, praise: ["location"], complaint: ["lifts"] },
    { place_id: "P1", name: "Tower A", rating: 4.2, count: 31, as_of: "2026-10-15" },
    { place_id: "P2", name: "Tower A Sales Centre", type: "real_estate_agency", rating: 5, count: 40, as_of: "2026-10-15", sales_office: "place type 'real_estate_agency' (often a sales office or agency)" }] };
  const L = B.googleLines(g), t = L.join("\n");
  ok(L.filter((l) => /P1/.test(l)).length === 1, "one Google place counted once");
  ok(/rating 4\.2 out of 5 from 31 reviews, retrieved 15 Oct 2026, place id P1, link https:\/\/maps\.google\.com\/\?cid=1/.test(t), "rating, count, place id, link, date", t);
  ok(/at most 5 review texts per place .*NOT every review/.test(t), "never implies full review coverage");
  ok(/not resident experience[^\n]*Sales Centre[^\n]*no stars/.test(t) && !/rating 5 out of 5/.test(t), "sales-office place left out of experience, no stars");
  const none = all(B.bppFacts(pp(), {}, "2026-11-04"));
  ok(/no Google place is matched to this building yet/.test(none) && !/NO numbers/.test(none), "no match said plainly");
  ok(/Google shows at most 5 reviews per place/.test(B.bppPrompt(B.bppFacts(pp(), {}, "2026-11-04"), "4 Nov 2026")), "prompt carries the 5-review line");
}
// ---------- A7 access
{
  ok(/straight-line distance on the map, not a drive time\): nearest metro station Al Jadaf/.test(B.accessLine({ kind: "straight", metro: "Al Jadaf Metro Station", metro_km: 0.6 })), "completed building: straight-line, labelled");
  const d = B.accessLine({ kind: "drive", solved_on: "2026-10-21", metro: "Business Bay", metro_min: 6.4, mins: { dubai_mall: 9.2, dxb: 14 } });
  ok(/drive times by road, worked out 21 Oct 2026\): nearest metro Business Bay 6 min drive; Dubai Mall 9 min, Dubai International Airport 14 min/.test(d), "drive times", d);
  ok(B.bppFacts(pp(), {}, "2026-11-04").missing.some((m) => /drive times/.test(m)), "no access = said missing");
}
// ---------- A4 adverts label / history
{
  const flats = { total: 2, rent: 1, sale: 1, checked: "2026-11-01", items: [{ mode: "rent", beds: 1, price: 80000, portal: "Property Finder", agent: "Test Agent", firm: "Test Firm", phone: "+971500000001", date: "2026-10-30" }] };
  const t = all(B.bppFacts(pp({ flats }), {}, "2026-11-04"));
  ok(/a sample of live adverts from one portal on one day/.test(t), "without history: labelled a sample");
  ok(/agent Test Agent, Test Firm, \+971500000001/.test(t), "agent, agency and phone STAY (Kendall change, 4 Nov: item 2 dropped)");
  ok(/broker cards: agent, agency, phone/.test(B.bppPrompt(B.bppFacts(pp({ flats }), {}, "2026-11-04"), "x")), "broker-card instruction unchanged");
  const h = all(B.bppFacts(pp({ flats }), { adverts_hist: { distinct_90d: 57, rent_90d: 40, last: "2026-11-03" } }, "2026-11-04"));
  ok(/Advert history \(Property Finder, last 90 days to 3 Nov 2026\): 57 different adverts seen, 40 of them for rent/.test(h), "with history: distinct adverts");
}

// ---------- B stored rows (built from MotherDuck, read only)
{
  const P = JSON.parse(fs.readFileSync(new URL("./fixtures/v725_stored_packs.json", import.meta.url), "utf8"));
  const w = P["naj:plot:326-5635"], u = P["naj:plot:346-6876"];
  ok(w && w.project && w.project.number === 1869, "Dubai Wharf plot (no project on its land record) now reaches DLD project 1869 through its buildings", w && w.project);
  ok(w.tenancies && w.tenancies.history && w.tenancies.history.last_12m >= 100, "Dubai Wharf Tower 2: 12-month contracts counted (audit: 0 in the old join)", w.tenancies && w.tenancies.history);
  const t2 = (w.bldgs || []).find((b) => /Tower 2/.test(b.name || ""));
  ok(t2 && t2.floors === 7 && t2.flats === 254 && t2.car_parks === 294 && t2.lifts === 8, "Tower 2 own figures from the buildings register", t2);
  ok((w.bldgs || []).length >= 4 && new Set(w.bldgs.map((b) => b.pid)).size === w.bldgs.length, "one row per building (parent property id)");
  const ub = u.bldgs || [];
  ok(ub.some((b) => b.floors === 53) && ub.some((b) => b.floors === 17) && !ub.some((b) => b.floors === 53 + 17), "U-Bora: 53- and 17-floor buildings kept apart");
  const gw = (w.google && w.google.places) || [];
  ok(gw.length === 1 && gw[0].rating === 3.1 && gw[0].count === 8 && gw[0].place_id, "Dubai Wharf T2 Google 3.1 from 8 (audit sample C1)", gw);
  for (const pk of [w, u]) {
    ok(pk.asof && pk.asof.g_dld__projects && pk.asof.g_dld__projects.days > 45, "stored as-of row for the projects register", pk.asof);
    ok(pk.access && (pk.access.kind === "drive" || pk.access.kind === "straight"), "stored access row, one per project", pk.access);
    const t = all(B.bppFacts({ id: pk.plot, parcel: pk.parcel, buildings: [], flats: {} }, pk, "2026-11-04"));
    ok(/NOTE: this register is \d+ days old/.test(t), "stored: old-register note printed");
    ok(/each with its own figures/.test(t) && /Access \(calculated/.test(t) && /Tenancy history/.test(t), "stored: building, access and tenancy lines present");
  }
}

// ---------- C the listing-history loader on a small local sample (python; skipped only if python is missing)
{
  const py = "C:/Dev/naj-market-pulse/scripts/load_listing_history_md.py";
  let out = null;
  try { out = execFileSync("python", ["-I", py, "--sample-csv", new URL("./fixtures/v725_listing_sample.csv", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")], { encoding: "utf8" }); } catch (e) { out = "ERR " + (e.stderr || e.message); }
  if (/ENOENT/.test(out)) console.log("skip C: python not found");
  else {
    ok(/'rows': 4, 'listings': 3, 'with_project': 3/.test(out) && /target rows: 4/.test(out), "loader: duplicate (listing, day) collapsed, project attached", out);
    const g = execFileSync("python", ["-I", "-c", "import sys;sys.path.insert(0,'C:/Dev/naj-market-pulse/scripts');import load_listing_history_md as L,datetime as d;u=d.timezone.utc;print([L.in_quiet_window(d.datetime(2026,11,4,h,m,tzinfo=u)) for h,m in ((0,0),(3,59),(4,0),(23,59))]); print('whatsapp' in L.COLS)"], { encoding: "utf8" });
    ok(/\[True, True, False, False\]/.test(g), "refused 04:00-07:59 Dubai, allowed 08:00 and 03:59", g);
    ok(/False/.test(g.split("\n")[1]), "shared WhatsApp column never copied");
  }
}
console.log((fail ? "FAILED " : "ok ") + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
