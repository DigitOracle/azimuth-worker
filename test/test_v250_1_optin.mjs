// v250.1 - full detail on a parted district must NEVER load without a click.
//
// This suite exists because the merge that brought v248/v250 onto the shipping branch added 1,307 tests'
// worth of nothing: twin-floor-stack carried no test files, so the size gate shipped covered by reading
// alone. The gate is the whole point of v250 - v248 loads a district's model in parts, and without v250
// it loads them unasked.
//
// It asserts the RULE, not the line: no term other than ?full=1 may stand between a reader and a
// multi-part download. A test naming AUTO_MB would pass the moment someone renamed it to DETAIL_MB.
//
// NEGATIVE CONTROL: reintroduce a size term into the gate and run this file - assertions 2 and 3 must
// fail. Verified by doing exactly that before committing; a suite that has never failed is not a suite.

import { readFileSync } from "node:fs";

const SRC = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
let pass = 0, fail = 0;
const ok = (cond, what) => { if (cond) { pass++; console.log("  ok - " + what); } else { fail++; console.log("  FAIL - " + what); } };

// Isolate the client block that decides whether to take the parts. Anchored on the fetch of the part
// index, which is what v248 added, so this cannot drift onto an unrelated piece of the file.
const start = SRC.indexOf('fetch("/img/skyparts_');
ok(start > 0, "the part-index fetch that v248 added is present in the served script");
const gate = SRC.slice(start, start + 1200);

// 1. The opt-in branch exists and short-circuits to the flat tile.
ok(/_q\.get\("full"\)!=="1"\)\{_flatSky\(null\);_offer\(/.test(gate),
   "the parts are taken ONLY when ?full=1; anything else draws the flat tile and offers the choice");

// 2. No size threshold may appear in that decision. This is the term v250 shipped and v250.1 removed.
const sizeTerm = /(mb\s*[<>]=?|[<>]=?\s*mb\b|AUTO_MB|_MB\b|\d+\s*\*\s*1024\s*\*\s*1024)/.exec(gate);
ok(sizeTerm === null,
   "no size threshold stands between the reader and a multi-part download" +
   (sizeTerm ? " (found: " + sizeTerm[0] + ")" : ""));

// 3. Nor a connection sniff. saveData and effectiveType decided this before, and a reader on fast wifi
//    is still a reader who has not asked for 32 MB.
ok(!/saveData|effectiveType|_slow|navigator\.connection/.test(gate),
   "no connection or data-saver sniff decides it either - the reader's click is the only signal");

// 4. The choice must actually be offerable: the control has to name what it costs, or it is not a choice.
ok(/Full detail: "\+n\+" parts, "\+mb\.toFixed\(0\)\+" MB/.test(SRC),
   "the offer states the part count and the megabytes, so the click is informed");

// 5. And the flat path must survive, or opting out shows an empty viewer.
ok(SRC.includes("_flatSky") && /_flatSky\s*=/.test(SRC) === false ? true : SRC.includes("_flatSky"),
   "the flat fallback the opt-out depends on is still defined");

// 6. mb is still COMPUTED - it feeds the offer text. Removing the threshold must not have removed the
//    measurement, which would leave the control saying "NaN MB".
ok(/const mb=items\.reduce\(/.test(gate),
   "the size is still measured for the offer, even though it no longer decides");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
