// v259 - the morning scene pictures rotate through KV feed_scene_photos; with no list they behave exactly as before.
// NEGATIVE CONTROL: revert the meKey line to `meKey: me, extra` and run this file - assertion 3 must fail. Verified by doing so.
import { readFileSync } from "node:fs";
const SRC = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
let pass = 0, fail = 0;
const ok = (c, w) => { if (c) { pass++; console.log("  ok - " + w); } else { fail++; console.log("  FAIL - " + w); } };

const a = SRC.indexOf("async function feedScenes(");
const fn = SRC.slice(a, a + 6000);

ok(/get\("feed_scene_photos"\)/.test(fn), "the rotation list is read from KV feed_scene_photos");
ok(/get\("feed_scene_photo"\)\) \|\| "style_ref_21"/.test(fn), "with no list, the single photo and the style_ref_21 default are unchanged");
ok(/meKey: \(_rot\.length \? _rot\[\(feedDayIndex\(\) \+ i\) % _rot\.length\] : me\)/.test(fn), "each angle takes its own photo from the list by day and position");
ok(/replace\(\/\[\^a-z0-9_\]\/gi, ""\)\)\.filter\(Boolean\)/.test(fn), "list entries are sanitised the same way as the single photo, and empties dropped");
ok(/photo: \(_rot\.length \? _rot\.join\(","\) : me\)/.test(fn), "feed_scenes_last records which photos were in play");

// behaviour: replay the selection rule for 5 angles over 4 photos on consecutive days
const pick = (rot, me, day, i) => rot.length ? rot[(day + i) % rot.length] : me;
const rot = ["style_ref_25", "style_ref_26", "style_ref_27", "style_ref_28"];
const d0 = Array.from({ length: 5 }, (_, i) => pick(rot, "style_ref_21", 100, i));
const d1 = Array.from({ length: 5 }, (_, i) => pick(rot, "style_ref_21", 101, i));
ok(new Set(d0).size === 4, "five pictures on one morning use all four photos, none skipped");
ok(JSON.stringify(d0) !== JSON.stringify(d1), "the next morning starts on a different photo");
ok(pick([], "style_ref_21", 100, 3) === "style_ref_21", "empty list falls back to the single photo");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
