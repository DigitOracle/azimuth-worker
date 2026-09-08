// v105 — card engine: five looks x two sizes, every look carries the same four facts (8 Sep 2026).
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const sx0 = src.indexOf("const _sx = "); const sx1 = src.indexOf("\n", sx0);
const e0 = src.indexOf("// v105 - CARD ENGINE."); const e1 = src.indexOf("// v90 - BRIDGE RECORDS.");
const E = new Function(src.slice(sx0, sx1) + "\n" + src.slice(e0, e1) + "\nreturn { angleCardSvg, figureParts, tplOf, fitLines, CARD_TPL };")();

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };

const angles = [
  { hook: "Treppan Living locked 572 sales across its active pipeline—an 83% off-plan concentration proving Fakhruddin Properties' buyer conviction now towers over the market's average", figure: "83%", source: "MEED Projects corpus, dldPulse register" },
  { hook: "JVC cleared 1,204 settled sales in August, the busiest month the register has shown this year", figure: "1204 sales", source: "Dubai Land Department (DLD) Open Data" },
  { hook: "Dubai Marina asks 2,410 AED/sqft where Business Bay settles at 1,980 — the gap is the whole story", figure: "2410 vs 1980", source: "DLD register, settled sales, last 90 days" },
  { hook: "A two-bed in Dubai Hills now rents for AED 165,000 a year", figure: "AED 165k", source: "DLD Ejari, registered contracts" },
  { hook: "Short one", figure: "Sold out", source: "Developer statement" },
];

for (const [i, a] of angles.entries()) {
  for (const t of [0, 1, 2, 3, 4]) for (const size of ["square", "story"]) {
    const svg = E.angleCardSvg(a, "Jumeirah Village Circle", "https://x/img/bg_market", i + 1, { t, size });
    const H = size === "story" ? 1920 : 1080;
    const label = `angle ${i + 1} ${E.CARD_TPL[t]} ${size}`;
    ok(svg.startsWith("<svg") && svg.includes(`height="${H}"`) && svg.includes(`data-tpl="${E.CARD_TPL[t]}"`), label + ": svg with right size and look");
    ok(svg.includes("THE DIGEST"), label + ": masthead");
    ok(svg.includes(a.hook.split(" ").slice(0, 2).join(" ")), label + ": hook present");   // narrow boxes wrap after two words
    ok(svg.includes("Source: "), label + ": source present");
    ok(!/y="(\d+)"/.test(svg) || Math.max(...[...svg.matchAll(/y="(\d+(?:\.\d+)?)"/g)].map(m => +m[1])) <= H, label + ": nothing drawn below the frame");
    ok(!/undefined|NaN/.test(svg), label + ": no undefined/NaN");
  }
}
// figure parsing drives the infographic
ok(E.figureParts("83%").kind === "pct" && E.figureParts("83%").val === 83, "83% -> ring");
ok(E.figureParts("2410 vs 1980").kind === "two", "a vs b -> bars");
ok(E.figureParts("1204 sales").kind === "num" && E.figureParts("1204 sales").num === "1,204" && E.figureParts("1204 sales").unit === "sales", "1204 sales -> number + unit, thousands separator");
ok(E.figureParts("AED 165k").kind === "num" && E.figureParts("AED 165k").num === "AED 165k", "AED 165k -> number");
ok(E.figureParts("Sold out").kind === "text", "words -> text");
// the look is stable per angle and covers all five across a set
ok(E.tplOf(angles[0]) === E.tplOf(angles[0]), "same hook -> same look");
ok(new Set(Array.from({ length: 40 }, (_, i) => E.tplOf({ hook: "hook number " + i }))).size === 5, "40 hooks spread over all five looks");
ok(E.tplOf({ hook: "x", tpl: 3 }) === 3 && E.tplOf({ hook: "x" }, 4) === 4, "explicit look wins");
// text fitting shrinks rather than overflowing
const big = E.fitLines("word ".repeat(60), 936, 72, 4);
ok(big.lines.length <= 4 && big.fz < 72, "long text shrinks and caps at 4 lines");
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
