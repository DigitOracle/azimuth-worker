// v262 - amenity chip counts, the amenity list panel, and the amenity pins on the map all use the item's
// true district tag (i.d), not a rectangular bounding-box test. Safe now because naj-market-pulse retags
// every amenity's "d" field from a real DM community polygon (in_district() is now a polygon test), not a
// bbox - confirmed by reading that script directly before this shipped, not assumed.
//
// NEGATIVE CONTROL: revert any one of the three inDistrict() call sites back to inArea(i,dd)/inArea(i,d) and
// run this file - the matching assertion must fail. Verified by doing so for all three.
import { readFileSync } from "node:fs";
const SRC = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
let pass = 0, fail = 0;
const ok = (c, w) => { if (c) { pass++; console.log("  ok - " + w); } else { fail++; console.log("  FAIL - " + w); } };

// 1. the one shared definition exists, right next to inArea (kept, now unused but harmless - smallest diff)
ok(/function inArea\(i,d\)\{if\(!d\)return true;var b=d\.bbox;.*\}function inDistrict\(i,d\)\{if\(!d\)return true;return i\.d===d\.slug\}/.test(SRC),
   "inDistrict(i,d) is defined right after inArea(i,d), and inArea itself is untouched");

// 2. within() - gates the amenity map pins AND the amenity list panel (listKind()'s row filter) - its
//    area-mode branch now defers to inDistrict(), not a bbox test
const withinIdx = SRC.indexOf("function within(i){var d=curD();");
ok(withinIdx > 0, "within() still exists");
const withinBody = SRC.slice(withinIdx, withinIdx + 250);
ok(/if\(MODE==="area"\)\{return inDistrict\(i,d\)\}/.test(withinBody),
   "within()'s area-mode branch now returns inDistrict(i,d), not the old bbox test");
ok(!/var b=d\.bbox;return i\.lon>=b\[0\]/.test(withinBody),
   "the old bbox comparison is gone from within()'s area-mode branch");
// the distance-mode branch of within() (used when MODE isn't "area") is untouched
ok(/var c=SEL\?SEL\.c:\(d\?d\.centre:null\);return !c\|\|m2\(c,\[i\.lon,i\.lat\]\)<=RKM\*1000\}/.test(withinBody),
   "within()'s distance-mode branch is unchanged");

// 3. the AMEN chip-count loop: both accumulators (main count, and the beach/park public sub-count) now use
//    inDistrict(i,dd); the distance accumulators (nD, nDp) are untouched, still inDist()
const loopIdx = SRC.indexOf("var ref=refPoint();Object.keys(AMEN).forEach(function(k){");
ok(loopIdx > 0, "the AMEN count loop still exists");
const loop = SRC.slice(loopIdx, loopIdx + 700);
ok(/if\(i\.k!==k\)return;if\(inDistrict\(i,dd\)\)nA\+\+;if\(inDist\(i,ref,RKM\)\)nD\+\+/.test(loop),
   "the main count (nA) uses inDistrict(); the distance count (nD) still uses inDist(), both unchanged in shape");
ok(/if\(i\.k!==k\|\|\(i\.acc&&i\.acc!=="public"\)\)return;if\(inDistrict\(i,dd\)\)nAp\+\+;if\(inDist\(i,ref,RKM\)\)nDp\+\+/.test(loop),
   "the beach/park public sub-count (nAp) uses inDistrict(); its distance count (nDp) still uses inDist()");

// 4. citywide fallback: with no district selected, inDistrict(i,null) returns true for every item (matching
//    the old inArea(i,null) behaviour of "count everyone") - a plain reading of the function body, not an
//    execution test, but the whole point is that the fallback line ("if(!d)return true") is identical in
//    shape to inArea's own citywide fallback, so this doesn't need re-deriving.
ok(/function inDistrict\(i,d\)\{if\(!d\)return true;/.test(SRC),
   "inDistrict(i,null) returns true, matching inArea's own citywide (no-district) behaviour");

// 5. v261's sub/plot fix (dd.subs/dd.plots) is untouched by this patch - different code path entirely
ok(/var nA=dd\?\(k==="sub"\?\(dd\.subs\|\|0\):\(dd\.plots\|\|0\)\)/.test(SRC),
   "v261's sub/plot count fix is still in place, untouched by this patch");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
