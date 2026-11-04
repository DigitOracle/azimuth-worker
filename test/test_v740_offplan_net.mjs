// v740 - off-plan passports cast a WIDER net (Kendall, 4 Nov 2026, on the HADO BY BEYOND passport, naj:plot:1011305, Palm Deira / Dubai Islands,
// which printed "Not available yet" 58 times). Before handover the DLD register IS the source: a registered project / buildings / units prove it
// is coming; off-plan sales ("Sell - Pre registration" / Oqood) are the project's market evidence. Never buyer names.
// Fixture: test/fixtures/v740_hado_1011305.json = the ACTUAL output of naj-market-pulse build_plot_passport.py --source lake --district palmdeira
// and plot_passport_neighbourhood.py on 4 Nov 2026 (pp = passport, pack = pp_pack_1011305, nb = its pp_nb record). No secrets in it.
import { readFileSync } from "node:fs";
const B = await import("../src/building_passports.js");
const N = await import("../src/passport_neighbourhood.js");
const F = JSON.parse(readFileSync(new URL("./fixtures/v740_hado_1011305.json", import.meta.url), "utf8"));
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : String(x).slice(0, 900)); } };
const f = B.bppFacts(F.pp, N.withNb(F.pack, { nb: F.nb, dna: null }), "2026-11-04");
const t = f.lines.join("\n"), miss = f.missing.join("; ");

// fixture is the real pack (the defect was upstream: project 842403212 is not in our 15 Jun 2026 projects-register copy -> no project number)
ok(F.pack.project && F.pack.project.number === 4210, "pack carries DLD project 4210 (from the project spine)", JSON.stringify(F.pack.project));
ok(F.pack.market && F.pack.market.kinds.offplan.deals === 626, "pack carries the 626 registered off-plan sales", JSON.stringify(F.pack.market));

// construction record, planned completion, % complete, registration date, with source and as-of
ok(/Project record source: Najma project spine .*as of 25 Aug 2026/.test(t), "project record names its source and as-of date", t);
ok(/registered with the Land Department on 9 Dec 2025/.test(t), "project registration date shown (proves it is coming)", t);
ok(/status NOT_STARTED, 0\.01% complete, start 30 Jun 2026, planned completion 30 Jun 2029/.test(t), "status, % complete, start and planned completion", t);
ok(/Units registered so far 692 of 692 planned/.test(t), "units registered so far vs planned", t);
ok(/SANDY SHORES REAL ESTATE/.test(t), "registered developer shown", t);
ok(/Buildings registered with the Land Department: 3, first on 4 Dec 2025/.test(t), "buildings register date shown", t);
ok(!/project register record/.test(miss), "project register record no longer missing", miss);

// off-plan market evidence, labelled registered / off-plan / project level
ok(/REGISTERED \(actual\) - OFF-PLAN sales .*project level.*626 deals all time, first 12 Jan 2026, latest 12 Oct 2026/.test(t), "off-plan sales count, first and latest date", t);
ok(/median AED 33,957 per m2 \(AED 3,155 per sq ft\) last 12 months/.test(t), "12-month median AED per m2", t);
ok(/pace 3\.3 \/ 7\.8 \/ 52\.2 deals a month over 3 \/ 6 \/ 12 months/.test(t), "sales pace 3 / 6 / 12 months", t);
ok(/1 bed 353 deals, median AED 33,338 per m2/.test(t) && /2 bed 207 deals/.test(t) && /3 bed 61 deals/.test(t), "off-plan sales by bedroom", t);
ok(/Ready vs off-plan split \(registered deals, last 12 months\): 0 ready, 626 off-plan/.test(t), "ready vs off-plan split", t);
ok(/no buyer names/.test(t) && !/buyer:/i.test(t), "no buyer names", t);

// units planned by bedroom (units register on the parcel, before handover)
ok(/Units register.*1 B\/R 373.*2 B\/R 226.*3 B\/R 74/.test(t), "unit mix by bedroom before handover", t);

// rents: none in the building -> same-community comparables, labelled registered and community level
ok(/Rents REGISTERED \(actual\), same-community comparables, Palm Deira \(community level, NOT this building/.test(t), "community rent fallback labelled", t);
ok(/1 bed median AED 120,000 a year \(7 contracts\)/.test(t), "community 1-bed registered rent", t);

// amenities: widening radius, honest band, own lists
ok(/Nearby places' \('Live from Google' chip; these are places within about 3 km/.test(t), "Google nearby places widened to the 3 km band and labelled", t);
ok(!/does not cover this area/.test(t), "no longer says our Google data does not cover the area", t);
ok(/Amenities from our own lists .*school Al Ittihad Private School 2\.1 km \(within 3 km, source khda\)/.test(t), "own amenity list with distance band and source", t);
ok(/area centre: middle of .* not this plot's own position/.test(t), "position basis stays honest (area centre)", t);

// far fewer gaps than the 58 'Not available yet' Kendall saw
ok(f.missing.length <= 12, "missing items cut down (was 58 grey chips on the page)", f.missing.length + ": " + miss);

// generic: a passport with no market block and no community rents behaves as before
{
  const g = B.bppFacts({ id: "naj:plot:x", buildings: [], flats: {} }, {}, "2026-11-04");
  ok(!/Market signal/.test(g.lines.join("\n")) && /registered tenancies in this building/.test(g.missing.join("; ")), "empty pack unchanged", g.lines.join("\n"));
}
// project-level label when the project spans several plots
{
  const g = B.bppFacts(F.pp, Object.assign({}, F.pack, { project_plots: 4 }), "2026-11-04");
  ok(/Project-level \(one of 4 plots\)/.test(g.lines.join("\n")), "project spanning several plots labelled 'one of N plots'");
}
// marketLines on a ready project
{
  const L = B.marketLines({ to: "2026-11-01", src: "DLD transactions register (Sales; no buyer names)", kinds: { ready: { first: "2019-01-01", latest: "2026-10-30", deals: 400, deals_12m: 60, deals_ytd: 50, year: "2026", aed_m2: 15000, aed_m2_12m: 16000, pace: { "3m": 5, "6m": 5.5, "12m": 5 } } } });
  ok(/READY sales \(existing properties\).*60 in the last 12 months, 50 in 2026/.test(L.join("\n")) && /60 ready, 0 off-plan/.test(L.join("\n")), "ready sales this year and split", L.join("\n"));
}
console.log(pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
