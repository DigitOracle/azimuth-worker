// Run every test in this directory, by discovering them rather than by listing them.
//
// Kendall, 26 Sep 2026, after the Rings session found it: "fix the npm test gap."
//
// `npm test` was a hardcoded chain of 36 `node test/x.mjs &&` calls against 68 files on disk. THIRTY-TWO TESTS HAD
// NEVER RUN IN CI, including test_v255_grouped_scope, test_v244_page_loads and test_v243_twin_audit - tests written
// for changes that are live right now. All thirty pass, so nothing was broken; the cost was that nobody knew.
//
// The hardcoded list IS the bug, not the 32 missing entries. Writing a test and forgetting the package.json line is a
// silent no-op with no warning at any point, and it had happened thirty-two times. Discovery cannot drift: a file
// named test_*.mjs in this directory runs, from the moment it is saved.
//
// Two files here are TOOLS, not tests - audit_building_pages.mjs takes district arguments and writes report files,
// check_building_page.mjs is a one-building probe. They are excluded by the naming rule rather than by a list, which
// is the same reason the rest is discovered: a list of exceptions decays the same way a list of includes does.
//
// Each test runs in its OWN process. They set globals, stub fetch and some call process.exit; one bad actor taking
// the runner down with it would hide every test after it, which is the failure mode this exists to prevent.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const files = fs.readdirSync(DIR)
  .filter((f) => /^test_.*\.mjs$/.test(f))
  .filter((f) => !only.length || only.some((o) => f.includes(o)))
  .sort();

if (!files.length) {
  console.error("no test files matched" + (only.length ? " " + only.join(", ") : ""));
  process.exit(1);
}

const t0 = Date.now();
let pass = 0;
const failed = [];
for (const f of files) {
  const r = spawnSync(process.execPath, [path.join(DIR, f)], { encoding: "utf8", timeout: 600000 });
  const out = (r.stdout || "") + (r.stderr || "");
  // a test is failed if it exits non-zero OR prints a FAIL line - some report and carry on rather than throwing
  const bad = r.status !== 0 || /^\s*FAIL\b/m.test(out);
  if (bad) {
    failed.push(f);
    process.stdout.write("\nFAIL  " + f + (r.status === null ? "  (timed out or killed)" : "  exit " + r.status) + "\n");
    // only the failing lines and enough around them to act on, not the whole successful log
    const lines = out.split("\n");
    const keep = lines.filter((l, i) => /FAIL|Error|error:|at .*\.mjs/.test(l) || (i && /FAIL/.test(lines[i - 1])));
    process.stdout.write((keep.length ? keep : lines).slice(0, 14).map((l) => "      " + l).join("\n") + "\n");
  } else {
    pass++;
    process.stdout.write(".");
  }
}

const secs = ((Date.now() - t0) / 1000).toFixed(0);
process.stdout.write("\n\n" + pass + " of " + files.length + " test files passed in " + secs + "s\n");
if (failed.length) {
  process.stdout.write("failed: " + failed.join(", ") + "\n");
  process.exit(1);
}
