// v261 - the SUB-COMMUNITIES / PROPERTIES "in community" chip count must read the same field the district
// header already uses (d.subs / d.plots), not recompute independently via inArea()'s bbox test, which can
// disagree with the header near a district's edge.
// NEGATIVE CONTROL: revert the nA line back to using inArea() and run this file - assertions 1-3 must fail.
// Verified by doing so.
import { readFileSync } from "node:fs";
const SRC = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
let pass = 0, fail = 0;
const ok = (c, w) => { if (c) { pass++; console.log("  ok - " + w); } else { fail++; console.log("  FAIL - " + w); } };

const idx = SRC.indexOf('[["sub",SUBS],["plot",PLOTS]].forEach(function(pair){');
ok(idx > 0, "the sub/plot count block still exists");
const block = SRC.slice(idx, idx + 700);

// 1. the "in community" count is read from the district's own precomputed field - the exact source the
//    header (v7224: d.name+" - "+d.subs+" sub-communities - "+d.plots+" plots...") already uses
ok(/var nA=dd\?\(k==="sub"\?\(dd\.subs\|\|0\):\(dd\.plots\|\|0\)\)/.test(block),
   'nA reads dd.subs / dd.plots directly when a district is selected');
ok(!/if\(inArea\(i,dd\)\)nA\+\+/.test(block),
   'the old inArea()-based nA accumulation is gone from this block');

// 2. the header itself reads d.subs/d.plots - confirming the fix targets the same field the header uses,
//    not a coincidentally similar one
ok(/d\.name\+" . "\+d\.subs\+" sub-communities . "\+d\.plots\+" plots/.test(SRC),
   "the district header (#st) is confirmed to read d.subs/d.plots - the fix's target field is verified, not assumed");

// 3. citywide fallback (no district selected) sums the same per-district fields, so it never falls back to
//    a bbox test either
ok(/\(D&&D\.districts\|\|\[\]\)\.reduce\(function\(a,x\)\{return a\+\(\(k==="sub"\?x\.subs:x\.plots\)\|\|0\)\},0\)/.test(block),
   "with no district selected, the citywide count sums d.subs/d.plots across all districts, not a bbox scan");

// 4. the distance-mode ("within X km") measure is untouched - it's a genuinely different, legitimate measure
//    (radius around a point), not something this fix should also change
ok(/if\(inDist\(i,ref,RKM\)\)nD\+\+/.test(block), 'the within-X-km distance count still uses inDist(), unchanged');
ok(/MODE==="area"\?nD\+" within "\+RKM\+" km"/.test(block), 'the distance-mode label text is unchanged');

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
