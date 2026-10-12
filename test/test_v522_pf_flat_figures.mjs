// v522 - the Property Finder SUMMARY card (Kendall 11 Oct 2026): typical asking rent = median over FLATS, the middle half of the flats,
// flats priced far from the rest flagged, days listed per flat, new flats - for the short places only (building page, Developers map pop-up).
// The Start menu's "What's advertised where" keeps every listing: it does not ask for the summary and its card is unchanged.
import fs from "node:fs";
import { advertisedDoc, advertisedForKey, advertisedHtml } from "../src/advertised.js";
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 400)); } };

const band = { flats: 28, adverts: 102, pmin: 75000, pmax: 145000, med_days: 16, new_wk: 35, gone_wk: 17, f_pmed: 89500, f_p25: 84249, f_p75: 105000, f_chk: 1, f_days: 30, f_new_wk: 6 };
const doc = { advertised: { as_of: "2026-10-10", buildings: { p4: { key: "businessbay:647", bands: { studio: band } } } } };
const a = advertisedForKey(advertisedDoc(doc), "businessbay:647");
const sum = advertisedHtml(a, { summary: true }), full = advertisedHtml(a);
ok(/AED 90k<small> typical a year/.test(sum) && /middle half AED 84k–105k/.test(sum), "summary: typical rent and the middle half of the flats", sum);
ok(!/75k–145k/.test(sum), "summary: never the cheapest-to-dearest advert range");
ok(/1 flat priced far from the rest: check the advert/.test(sum), "summary: the flat priced far from the rest is flagged, not used as the range");
ok(/30 days listed \(median per flat\)/.test(sum) && !/16 days/.test(sum), "summary: days listed per flat");
ok(/6 new flats/.test(sum) && /17 adverts<\/?\w*>? ?gone this week|17 adverts gone this week/.test(sum.replace(/<svg[\s\S]*?<\/svg>/g, "")), "summary: new FLATS and adverts gone, each labelled", sum.replace(/<svg[\s\S]*?<\/svg>/g, ""));
ok(/AED 75k–145k/.test(full) && /16 days listed \(median\)/.test(full) && /35 new/.test(full), "without the option the card is exactly as before (the Start menu page)");

// an older file (no per-flat figures): the summary falls back to the old card, unchanged
const old = advertisedForKey(advertisedDoc({ advertised: { as_of: "2026-10-09", buildings: { p4: { key: "businessbay:647", bands: { studio: { flats: 3, adverts: 5, pmin: 1, pmax: 2, med_days: 4, new_wk: 0, gone_wk: 0 } } } } } }), "businessbay:647");
const _cards = (h) => h.slice(h.indexOf("</summary>"), h.indexOf("<div class=avt>"));   // v527: the summary heading reads "Available to rent now"; compare the band cards
ok(_cards(advertisedHtml(old, { summary: true })) === _cards(advertisedHtml(old)), "an older file: the summary shows the old band cards (only the footer is the freshness line)");

// freshness: the summary ends on one line, how fresh the data is (Kendall: "a bit wordy ... how fresh is the data, that is all we need")
ok(/<div class=avt>Updated 10 Oct 2026 · \d+ days? ago|<div class=avt>Updated 10 Oct 2026 · today/.test(sum) && !/Adverts are not vacancy/.test(sum), "summary: one freshness line, no paragraph", sum.slice(-300));
ok(/Adverts are not vacancy/.test(full), "the full card (Start menu) keeps its note");
// Peninsula Five: listings filed under the project key are found by name
const cb2 = fs.readFileSync(new URL("../src/city_bldg.js", import.meta.url), "utf8");
ok(/advertisedForKey\(A, k\) \|\| \(nm \? advertisedForKey\(A, "dld:" \+ nm\) : null\)/.test(cb2), "/adv_bldg falls back to the project key dld:<name>");
const dm2 = fs.readFileSync(new URL("../src/devmap_page.js", import.meta.url), "utf8");
ok(/&n='\+encodeURIComponent\(PFN\[k\]\|\|''\)/.test(dm2), "the pop-up sends the project name");
// who asks for the summary
const ix = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const cb = fs.readFileSync(new URL("../src/city_bldg.js", import.meta.url), "utf8");
const sp = fs.readFileSync(new URL("../src/supply_page.js", import.meta.url), "utf8");
ok(/advertisedHtml\(_a, \{ summary: true \}\)/.test(ix), "the building page asks for the summary");
ok(/advertisedHtml\(a, \{ summary: true \}\)/.test(cb), "the Developers map pop-up (/adv_bldg) asks for the summary");
ok(/advertisedHtml\(b\.advertised\)/.test(sp) && !/summary: true/.test(sp), "the Start menu's 'What's advertised where' does not: every listing, unchanged");

console.log(`v522 Property Finder per-flat figures: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
