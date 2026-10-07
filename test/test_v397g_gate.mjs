// v397g - the completeness gate as a HARD STOP in front of the publish scripts. The assertions live in test/test_v397g_gate.py (python unittest, synthetic data, no network, no KV);
// this wrapper lets the discovering runner (test/run_all.mjs) run it. Offline.
//   node test/test_v397g_gate.mjs
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const r = spawnSync("python", [path.join(here, "test_v397g_gate.py")], { encoding: "utf8", timeout: 300000 });
const out = (r.stdout || "") + (r.stderr || "");
process.stdout.write(out);
if (r.error) { console.log("  FAIL - could not run python: " + r.error.message); process.exit(1); }
const ok = r.status === 0;
console.log(ok ? "  ok - v397g completeness gate guard tests (python unittest)" : "  FAIL - v397g completeness gate guard tests exited " + r.status);
process.exit(ok ? 0 : 1);
