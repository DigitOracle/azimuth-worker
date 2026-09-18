// v177 — A REWRITE MAY NOT CHANGE A NUMBER (18 Sep 2026).
//
// Every hook goes through a second pass that rewrites it into her voice. That pass is TOLD "Keep every figure,
// source and fact exactly" — and until now that instruction was the only thing enforcing it. The acceptance test
// checked the rewritten hook for banned jargon and nothing else.
//
// Tonight's dry run, verbatim:
//     figure: "22 units (1 B/R) to 11 units"
//     hook:   "Twenty-two one-bedrooms became TEN, in two days, at W Residences Dubai Harbour."
// The 11 became "ten" — rounded down into a rounder story — and every numeral was spelled into words against the
// picker's own rule that figures are written as numerals. She reads these aloud to a client, so a hook that
// contradicts its own figure line is the worst thing this system can emit. It had been shipping unchecked.
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("ok - " + m); } else { fail++; console.log("not ok - " + m); } };

// lift the real helpers rather than restate them here
const numsLine = src.match(/const voiceNums = [^\n]+/);
const keepLine = src.match(/const voiceKeepsNumbers = [^\n]+/);
ok(!!numsLine && !!keepLine, "the number-fidelity helpers exist in the worker");
const voiceNums = eval("(" + numsLine[0].replace("const voiceNums = ", "") .replace(/;\s*$/, "") + ")");
const voiceKeepsNumbers = eval("(" + keepLine[0].replace("const voiceKeepsNumbers = ", "").replace(/;\s*$/, "") + ")");

// --- tonight's actual failure ---------------------------------------------------------------------
const before = "22 one-bedrooms became 11 in two days at W Residences Dubai Harbour.";
const after = "Twenty-two one-bedrooms became ten, in two days, at W Residences Dubai Harbour.";
ok(!voiceKeepsNumbers(before, after), "tonight's rewrite is REFUSED - it turned 11 into 'ten' and spelled the numerals into words");
ok(voiceNums(before).join(",") === "22,11", "the original's figures are read as 22 and 11");
ok(voiceNums(after).length === 0, "and the rewrite kept none of them, which is exactly why it must not be accepted");

// --- a rewrite that only changes WORDING must still be allowed through -----------------------------
ok(voiceKeepsNumbers("AED 34.9 billion moved in July.", "July moved AED 34.9 billion."),
   "a genuine voice rewrite passes - same figures, different words, which is all the pass is for");
ok(voiceKeepsNumbers("83% complete, handing over 2026-12-30.", "It is 83% built and hands over on 2026-12-30."),
   "percentages and dates survive reordering");
ok(voiceKeepsNumbers("No figures in this hook.", "Still no figures here."), "a hook with no numbers is unaffected");
ok(!voiceKeepsNumbers("2,964 homes changed hands.", "2,900 homes changed hands."), "and a figure quietly rounded is refused");
ok(!voiceKeepsNumbers("13.9% of all sales.", "14% of all sales."), "so is a percentage rounded up");

// --- the guard is actually wired into the acceptance, not just defined -----------------------------
ok(/if \(!voiceKeepsNumbers\(angles\[i\]\.hook, it\.hook\)\) \{ refused\.push\(i \+ 1\); continue; \}/.test(src),
   "the acceptance refuses the rewrite and keeps HER hook, rather than repairing or dropping the angle");
ok(/return \{ angles, repaired: done, refused \};/.test(src), "voiceGuard reports what it refused");
ok(/voice rewrite REFUSED on/.test(src), "and a refusal is written into the QA line, so it is visible rather than silent");

// the guard must sit INSIDE the jargon check, so a rewrite passing both tests is still the one accepted
const acc = src.slice(src.indexOf("if (out && Array.isArray(out.items))"), src.indexOf("const strip = (t) =>"));
ok(acc.indexOf("VOICE_BAN.test(it.hook)") < acc.indexOf("voiceKeepsNumbers"), "jargon is checked first, then figures - both must pass before a rewrite is taken");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
