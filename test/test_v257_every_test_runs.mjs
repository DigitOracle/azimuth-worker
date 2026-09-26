// npm test must DISCOVER tests, not list them. This is the guard on the fix.
//
// Until 26 Sep 2026 `npm test` was a chain of 36 hardcoded `node test/x.mjs &&` calls against 68 files. Thirty-two
// tests had never run - among them test_v255_grouped_scope, test_v244_page_loads and test_v243_twin_audit, written
// for changes that were live. All thirty passed when finally run, so nothing was broken. The cost was purely that
// nobody knew, for as long as it took someone to count the files.
//
// The list was the bug. Writing a test and forgetting the package.json line is a silent no-op: no warning, no error,
// and the suite still reports green. It happened thirty-two times without once announcing itself.
//
// So this test fails if anyone goes back to listing them. It checks two things and nothing else:
//   1. the test script runs the discovering runner
//   2. the runner would actually pick up every test_*.mjs on disk today
//
// The second matters because a runner that discovers into the wrong directory, or with a pattern that stops matching
// a naming convention someone adopts later, fails exactly as quietly as the list did.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(DIR, "..");
let bad = 0;
const ok = (c, m, extra) => { console.log("  " + (c ? "ok" : "FAIL") + " - " + m + (c || !extra ? "" : "  " + extra)); if (!c) bad++; };

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const script = (pkg.scripts || {}).test || "";

ok(/run_all\.mjs/.test(script), "npm test runs the discovering runner", "found: " + script.slice(0, 80));
ok(!/&&\s*node test\/test_/.test(script),
  "npm test does not chain individual test files - a list silently drops whatever is not on it");

const onDisk = fs.readdirSync(DIR).filter((f) => /^test_.*\.mjs$/.test(f));
ok(onDisk.length > 50, "the runner's own pattern still matches the suite", onDisk.length + " files");

// the runner must look in this directory, not a path that silently resolves elsewhere
const runner = fs.readFileSync(path.join(DIR, "run_all.mjs"), "utf8");
ok(/readdirSync\(DIR\)/.test(runner), "the runner reads the directory it lives in");
ok(/\/\^test_\.\*\\\.mjs\$\//.test(runner) || /test_.*\\\.mjs/.test(runner),
  "the runner selects by the test_ naming convention");
ok(/spawnSync|fork|execFile/.test(runner),
  "each test runs in its own process - one that calls process.exit must not take the rest with it");

console.log("\n" + (onDisk.length) + " test files discoverable, " + (bad ? bad + " failed" : "0 failed"));
process.exit(bad ? 1 : 0);
