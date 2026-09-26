// v258 - three city-life blocks are held OUT of the morning feed until their sources are re-verified.
//
// airport (per-hour figures understated), buses (median from an old partial pull), busStops (total predates the
// repeat fix). The rule is written as a RULE about ORDER, not as a line: the hold-out must happen right after
// mkt_latest is parsed and BEFORE anything reads d.cityLife, because two readers exist - the block handed to the
// model and the geo-guard that builds its list of real place names. Holding the blocks out of the prompt only would
// leave the guard accepting an invented airport angle as "named".
//
// NEGATIVE CONTROL: delete the loop line and run this file - assertions 3 and 4 must fail. Verified by doing so.

import { readFileSync } from "node:fs";

const SRC = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
let pass = 0, fail = 0;
const ok = (c, w) => { if (c) { pass++; console.log("  ok - " + w); } else { fail++; console.log("  FAIL - " + w); } };

// 1. the constant exists and names exactly the three, so a fourth cannot be added or dropped unnoticed
const m = /const FEED_CITYLIFE_HOLD = \[([^\]]*)\];/.exec(SRC);
ok(!!m, "the hold-out list is a named constant");
const held = m ? m[1].split(",").map(x => x.trim().replace(/["']/g, "")).filter(Boolean).sort() : [];
ok(JSON.stringify(held) === JSON.stringify(["airport", "buses", "busStops"].sort()),
   "it holds exactly airport, buses and busStops" + (m ? " (found: " + held.join(", ") + ")" : ""));

// 2. isolate the feed builder so an unrelated cityLife reader elsewhere cannot satisfy the order checks
const start = SRC.indexOf("async function dailyFeedTick(");
const feed = SRC.slice(start, start + 30000);
const iParse = feed.indexOf('JSON.parse(raw)');
const iLoop = feed.indexOf("for (const _k of FEED_CITYLIFE_HOLD) delete d.cityLife[_k]");
const iBuilder = feed.indexOf("cityLife: d.cityLife ?");
const iGuard = feed.indexOf("const c = d.cityLife || {}");

// 3. the delete happens after the data is parsed and before the block handed to the model is built
ok(iParse > 0 && iLoop > iParse && iBuilder > iLoop,
   "the hold-out runs after mkt_latest is parsed and BEFORE the block handed to the model is built");

// 4. and before the geo-guard reads it, or an invented airport/bus angle would still count as naming a real place
ok(iLoop > 0 && iGuard > iLoop,
   "the hold-out runs BEFORE the geo-guard builds its list of real place names from the same block");

// 5. the blocks that are NOT held must still reach the model - a hold-out that also drops metro is a regression
ok(/o\.metro = /.test(feed) && /o\.busCoverage = /.test(feed) && /o\.professions = /.test(feed),
   "metro, busCoverage and professions are still passed to the model");

// 6. the held keys are removed with delete, not by nulling, so the builder's `if (c.airport)` tests read them as absent
ok(/delete d\.cityLife\[_k\]/.test(feed) && !/d\.cityLife\[_k\] = null/.test(feed),
   "blocks are deleted, so the builder's existence checks see them as absent");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
