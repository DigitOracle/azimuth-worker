// v518 - the building page's panel leads with Property Finder's "advertised now"; the register floor filters are hidden (kept in
// the page because the script wires them) and the tower is painted plain (no bedroom bands without their legend).
// Kendall 11 Oct 2026: "we are going by Property Finder ... what's available now, not just a blanket statement".
import fs from "node:fs";
import { buildingPageHtml } from "../src/building_page.js";
import { advertisedDoc, advertisedForKey, advertisedHtml } from "../src/advertised.js";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const bp = fs.readFileSync(new URL("../src/building_page.js", import.meta.url), "utf8");
const ix = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

ok(/<h1>AVAILABLE NOW<\/h1>/.test(bp) && /<div id=reopen>AVAILABLE NOW<\/div>/.test(bp), "the panel and its reopen pill are titled AVAILABLE NOW");
ok(/\(D\.advHtml \? '<style>' \+ ADV_CSS \+ '<\/style>' \+ D\.advHtml : ""\) \+\s*'<div id=bpfilt hidden>' \+\s*"<div id=count><\/div>"/.test(bp), "the adverts lead the panel; the register filters sit in a hidden block right after");
ok(/'<button id=hide>Hide All<\/button><\/div>'/.test(bp), "the hidden block ends after Hide All, so floors, plans, dossier, lets, contracts and sales stay visible");
ok(/if \(!D\.fits \|\| D\.plain\) \{/.test(bp), "a plain building takes the no-bands path");
ok(/_bd\.plain = true;/.test(ix), "the route asks for the plain tower");
ok(/advertisedForKey\(_adoc, _bs \+ ":" \+ _bi\)/.test(ix) && /briefKvJson\(env, "pf_supply_" \+ _bs\)/.test(ix), "the route reads the district's advert file and picks this building by its register key");
ok(/No Property Finder adverts for this building/.test(ix), "a district file without this building says so plainly");

// the card itself, on a stand-in advert file
const doc = { advertised: { as_of: "2026-10-11", buildings: { "pf-tower": { key: "businessbay:42", bands: { "1": { flats: 3, adverts: 5, pmin: 95000, pmax: 120000, med_days: 18, new_wk: 1, gone_wk: 2 } } } } } };
const a = advertisedForKey(advertisedDoc(doc), "businessbay:42");
const card = advertisedHtml(a).replace("<details class=avd>", "<details class=avd open>");
ok(a && a.flats === 3 && a.adverts === 5, "the building's flats and adverts are counted from its own slug");
ok(card.startsWith("<details class=avd open>") && /3 flats · 5 adverts/.test(card) && /AED 95k–120k/.test(card), "the card opens by default with flats, adverts and the asking range");
ok(advertisedForKey(advertisedDoc(doc), "businessbay:7") === null, "another building gets nothing from this one's adverts");

// the page renders with and without the card, and the panel still carries the facts below
const D = { name: "Test Tower", slug: "businessbay", id: "42", district: "Business Bay", floors: [{ n: 1, k: 4, u: "homes" }], register: [], plain: true, fits: true,
  advHtml: card, dossier: { key: "businessbay:42" }, dossierUrl: "/brief_pdf?kind=dossier&keys=businessbay:42" };
let h = "";
try { h = buildingPageHtml(D, "k", ""); } catch (e) { h = "ERR " + e.message; }
ok(h.includes("<details class=avd open>") && h.indexOf("avd open") < h.indexOf("id=bpfilt"), "rendered: the advertised card comes before the hidden filters", h.slice(0, 200));
ok(/<div id=bpfilt hidden>/.test(h) && /choose a floor/.test(h) && /The dossier · PDF/.test(h), "rendered: filters hidden, floor picker and dossier still there");
let h2 = ""; try { h2 = buildingPageHtml(Object.assign({}, D, { advHtml: null }), "k", ""); } catch (e) { h2 = "ERR " + e.message; }
ok(!h2.includes("ERR") && !h2.includes("class=avd"), "rendered with no advert file: no card, no error");

console.log(`v518 building advertised now: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
