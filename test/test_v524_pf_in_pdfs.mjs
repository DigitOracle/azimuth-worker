// v524 - Property Finder cards in the client dossier and the broker building sheet, PDF included (Kendall 11 Oct 2026: "for client and for
// broker, the brief should include the property finder information ... in cards ... one bedroom, this many available, two bedroom, etc.").
import fs from "node:fs";
import { advertisedDoc, advertisedLookup, advertisedRows } from "../src/advertised.js";
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };

const doc = { advertised: { as_of: "2026-10-10", buildings: {
  p4: { key: "businessbay:647", bands: { studio: { flats: 28, adverts: 102, pmin: 75000, pmax: 145000, med_days: 16, f_pmed: 89500, f_p25: 84249, f_p75: 105000, f_chk: 1, f_days: 30 }, "1": { flats: 35, adverts: 123, pmin: 100000, pmax: 175000, med_days: 14, f_pmed: 139999, f_p25: 127000, f_p75: 157000, f_chk: 0, f_days: 37 } } },
  p5: { key: "dld:peninsulafive", bands: { "2": { flats: 9, adverts: 12, pmin: 200000, pmax: 500000, med_days: 20, f_pmed: 250000, f_p25: 230000, f_p75: 440000, f_chk: 3, f_days: 23 } } } } } };
const A = advertisedDoc(doc);
const rows = advertisedRows(advertisedLookup(A, "businessbay:647", "Peninsula Four"));
ok(rows.length === 2 && rows[0].label === "Studio" && rows[0].flats === 28 && rows[0].typical === "AED 90k" && rows[0].mid === "middle half 84k–105k" && rows[0].days === 30 && rows[0].chk === 1, "rows: one per bedroom type, typical rent, middle half, flats, days per flat", rows[0]);
ok(rows[1].label === "1 bedroom" && rows[1].flats === 35, "1 bedroom: 35 flats");
ok(advertisedRows(advertisedLookup(A, "businessbay:0", "Peninsula Five"))[0].flats === 9, "found by the project name when the building key has none (Peninsula Five)");
ok(advertisedRows(advertisedLookup(A, "businessbay:1", "Nowhere Tower")).length === 0, "nothing listed: no rows, no block");

const bd = fs.readFileSync(new URL("../src/brief_docs.js", import.meta.url), "utf8");
ok(/if \(q\.kind === "dossier" && !C\.buy\) \{ try \{ if \(!\(rec\.d in \(C\.pf \|\| \(C\.pf = \{\}\)\)\)\) C\.pf\[rec\.d\] = advertisedDoc\(await kvJson\(env, "pf_supply_" \+ rec\.d\)\); rec\.adv = advertisedLookup\(C\.pf\[rec\.d\], rec\.key, rec\.name\);/.test(bd), "the client dossier (rent) loads the district's listings once and finds the building");
ok(/cb \+ availBlock\(rec, q\) \+ pfBlock\(rec\) \+ \(more \? more\.html : ""\)/.test(bd) && /pkBox\("key", "Available on Property Finder", pkGrid\(tiles, Math\.min\(4, tiles\.length\)\), esc\(freshLine\(rec\.adv\.asOf\)\)/.test(bd), "page 2: an 'Available on Property Finder' box of cards, one freshness line");
ok(/: \(rec\.adv \? 520 : 700\);/.test(bd), "the map gives the cards room");
const bb = fs.readFileSync(new URL("../src/broker_building.js", import.meta.url), "utf8");
ok(/try \{ adv = advertisedLookup\(advertisedDoc\(await readOr\(env, "pf_supply_" \+ slug\)\)/.test(bb) && !/opts\.owner && p\.format === "html" && b\.bk != null\) \{ try \{ adv/.test(bb), "the broker sheet loads the listings for every key and format (no longer owner-only, web-only)");
ok(/secHead\("map-trifold", "Available on Property Finder", esc\(freshLine\(B\.adv\.asOf\)\)/.test(bb) && !/if \(!B\.owner \|\| !B\.adv\) return null;/.test(bb), "the broker sheet's section: cards, one freshness line, in the PDF too");

console.log(`v524 Property Finder in the PDFs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
