// v263 - the opt-in "Full detail" district-twin loader reads v5 local-frame parts when they exist (an
// origin applied as a position, never baked into vertices), falling back to the v4 absolute-UTM parts
// unchanged when they don't. ?v4=1 forces the old path. The default (bare sky_<slug>) view is untouched.
// NEGATIVE CONTROL: revert the v5 fetch/fallback branch back to the plain v4-only fetch and run this file -
// assertions 1-3 must fail. Verified by doing so.
import { readFileSync } from "node:fs";
const SRC = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
let pass = 0, fail = 0;
const ok = (c, w) => { if (c) { pass++; console.log("  ok - " + w); } else { fail++; console.log("  FAIL - " + w); } };

const idx = SRC.indexOf('if(_q.get("flat")==="1"){_flatSky(null)}');
ok(idx > 0, "the flat-tile opt-out check still exists (unrelated, unchanged)");
const region = SRC.slice(idx, idx + 3000);

// 1. v5 is tried first, unless ?v4=1 forces the old path
ok(/_q\.get\("v4"\)==="1"\?Promise\.resolve\(null\):fetch\("\/img\/skyparts_\$\{slugName\}_v5"\)/.test(region),
   "v5 index is fetched first, unless ?v4=1 forces the fallback");

// 2. v5 is only used when it genuinely has items AND a usable origin - a v5 index with no origin (or no
//    parts) correctly falls through to the v4 fetch, never used half-formed
ok(/v5&&v5\.items&&v5\.items\.length&&v5\.origin&&Array\.isArray\(v5\.origin\.origin_ce_xyz\)\)\?v5/.test(region),
   "v5 is used only when items exist AND origin.origin_ce_xyz is a real array - never used partially formed");
ok(/:fetch\("\/img\/skyparts_\$\{slugName\}"\)\.then\(r=>r\.ok\?r\.json\(\):null\)\)\.then\(ix=>\{/.test(region),
   "the v4 fallback fetch is exactly the original one, unchanged");

// 3. the origin is applied as a POSITION on a container group, never baked into vertex data - the exact
//    rule agreed with the LOD3 session when this consumer was first traced
ok(/const inner=O\?new THREE\.Group\(\):group;if\(O\)\{inner\.position\.set\(O\[0\],O\[1\],O\[2\]\);group\.add\(inner\)\}/.test(region),
   "the origin is set as inner.position (float64 on the CPU), not merged into any vertex buffer");
ok(/loader\.loadAsync\("\/img\/"\+it\.key\)\.then\(p=>\{inner\.add\(p\.scene\)\}/.test(region),
   "each part is added to the inner (origin-positioned) group, not the outer group directly");

// 4. the "nothing arrived" empty-viewer guard now checks the group that parts are ACTUALLY added to
//    (inner), not the outer group, which would always look non-empty once O exists (it holds inner)
ok(/if\(!inner\.children\.length\)\{_flatSky\(null\);return\}/.test(region),
   'the "did anything load" guard checks inner.children, matching where parts are actually added');

// 5. onSky still receives the OUTER group (group), which is what actually holds the (possibly nested)
//    scene content - this is unchanged from before v258, just now group may contain inner as a child
ok(/onSky\(\{scene:group\}\)/.test(region), "onSky still receives {scene:group}, unchanged call shape");

// 6. when no origin exists (v4 path, or a v5 index that lacks one), inner===group, so parts add directly
//    to group and nothing changes from pre-v258 behaviour - a plain reading of the ternary, not an
//    execution test, but the shape is what matters: inner falls back to the exact same object as group
ok(/const inner=O\?new THREE\.Group\(\):group;/.test(region),
   "with no origin, inner is literally the same object as group - v4 behaviour is unchanged, not re-implemented");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
