// v537 - six poster layouts, rotated and matched to the idea (Kendall 12 Oct 2026: "every picture looks exactly the same ... the same three cards")
import { POSTER_LAYOUTS, chooseLayout, layoutPrompt, layoutWords } from "../src/desk_post.js";
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : String(x).slice(0, 300)); } };
const c = { kicker: "COASTAL RECORDS", h1: "New coastline,", h2: "long memory", sub: "Every metre of new coast needs records that outlive the contract.", cards: [{ title: "A", text: "a", icon: "building" }, { title: "B", text: "b", icon: "clock" }, { title: "C", text: "c", icon: "map pin" }],
  close1: "Build it once", close2: "record it forever", big: "40%", big_label: "of handover files are incomplete", quote: "The drawings we sign today are tomorrow's evidence.", steps: ["Survey", "Reclaim", "Build", "Record"] };
const p = { idea: "Dubai Islands coastline needs 40% better records" };
ok(POSTER_LAYOUTS.length === 12, "twelve layouts (v540: six more)");
ok(chooseLayout(p.idea, null, null, c) === "bignum", "a figure in the idea: one big number");
ok(chooseLayout("the roadmap in four phases", null, null, Object.assign({}, c, { big: "" })) === "timeline", "steps in the idea: the timeline");
ok(chooseLayout(p.idea, "bignum", null, c) !== "bignum", "never the same layout twice running");
ok(chooseLayout("anything", null, "quote", c) === "quote", "a chosen layout wins");
const seen = new Set(); for (const idea of ["records matter", "digital twins for towers", "site safety culture", "handover quality", "smart city data", "coastal works", "metro extension", "BIM on site"]) seen.add(chooseLayout(idea, null, null, {}));
ok(seen.size >= 2 && !(seen.size === 1 && seen.has("cards")), "plain ideas spread across layouts, not always the cards", [...seen]);
const b = layoutPrompt("bleed", c, p, true);
ok(/FULL-BLEED/.test(b) && /no cards, no boxes/.test(b) && !/three stacked/.test(b), "full bleed: no cards, no panels");
ok(/'40%'/.test(layoutPrompt("bignum", c, p, false)), "the big figure is on the picture");
ok(layoutWords("quote", c).indexOf("tomorrow's evidence") >= 0 && layoutWords("quote", c).indexOf("COASTAL") < 0, "the spelling check reads only the words that layout puts on the picture");
ok(/three stacked rounded dark-teal cards/.test(layoutPrompt("cards", c, p, true)), "the original card poster is still one of the six");
const c2 = Object.assign({}, c, { before: "Paper handover files", after: "One live record", question: "Who will remember this coastline in 2050?", ticks: ["Surveyed", "Recorded", "Verified"], callout: "Phase two breakwater" });
for (const L of ["split", "question", "lowerthird", "checklist", "callout", "typeportrait"]) { const pr = layoutPrompt(L, c2, p, true); ok(pr.length > 200 && pr.indexOf("Dr. Kendall Wilson") >= 0 && !/three stacked/.test(pr), "v540 layout " + L + " has its own prompt with the byline"); ok(layoutWords(L, c2).length > 10, "v540 layout " + L + " has words to check"); }
ok(/BEFORE/.test(layoutPrompt("split", c2, p, true)) && /hard hat/.test(layoutPrompt("lowerthird", c2, p, true)) && /circular portrait/.test(layoutPrompt("typeportrait", c2, p, true)), "split, site shot and portrait each do their own thing");
ok(chooseLayout("before and after on site records", null, null, Object.assign({}, c2, { big: "" })) === "split", "a before/after idea gets the split");
console.log(`v537 poster layouts: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
