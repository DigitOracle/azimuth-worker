// v297 (Kendall, 3 Oct 2026): photos of Naj rotate through the WHOLE colour bank, never repeat yesterday's, history is recorded
// (automatic and her own picks), and the chooser shows every photo with a list that pages.
//   P  scenePhotoPick: skips yesterday and today, least-recently-used first, flags a short bank
//   H  history records her own pick (mp:)
//   C  chooser: tiles for every photo, 9 rows + "More photos", More shows the rest
// NEGATIVE CONTROL: P fails against v294 (function absent); C fails (3 buttons, no list).
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 300) : "")); } };

// P - pull the pure function out of the source and run it
const m = src.match(/function scenePhotoPick\(pool, hist, today, count\) \{[\s\S]*?\n\}\n/);
ok(!!m, "scenePhotoPick exists");
const pick = new Function(m[0] + "; return scenePhotoPick;")();
const pool = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m"];
let r = pick(pool, { "2026-10-02": ["a", "b", "c", "d", "e"] }, "2026-10-03", 5);
ok(r.picks.join("") === "fghij" || r.picks.every(k => !"abcde".includes(k)), "none of yesterday's five come back", r.picks.join());
ok(r.picks.length === 5 && !r.short, "five picks, not short");
r = pick(pool, { "2026-10-02": ["f", "g", "h", "i", "j"], "2026-10-01": ["a", "b", "c", "d", "e"] }, "2026-10-03", 5);
ok(r.picks.join("") === "klmab" || (r.picks.slice(0, 3).join("") === "klm" && r.picks.every(k => !"fghij".includes(k))), "never-used first, then least recent", r.picks.join());
r = pick(["a", "b", "c"], { "2026-10-02": ["a"] }, "2026-10-03", 5);
ok(r.short && r.picks.join("") === "bc", "a bank too small is reported short, still excludes yesterday");
r = pick(pool, { "2026-10-03": ["a", "b"] }, "2026-10-03", 5);
ok(!r.picks.includes("a") && !r.picks.includes("b"), "a photo used earlier today is not repeated today");
// the weekday case Kendall named
let tue = pick(pool, {}, "2026-10-06", 5).picks, wed = pick(pool, { "2026-10-06": tue }, "2026-10-07", 5).picks;
ok(wed.every(k => !tue.includes(k)), "Tuesday's photos never appear on Wednesday", tue.join() + " | " + wed.join());

// code checks
ok(/await scenePhotoNote\(env, _mk\)/.test(src), "her own pick is recorded in the history");
ok(/_pickd && _pickd\.picks\[i\]/.test(src), "feedScenes uses the history-aware pick");
ok(/more photos/i.test(src) && /mpm:/.test(src), "chooser pages with a More photos row");
ok(/_pile\.filter\(r => r && r\.kind === "me"/.test(src), "pool includes photos never judged");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
