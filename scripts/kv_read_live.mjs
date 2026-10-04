// v314 - READ-ONLY: write one live KV value (plain or gzipped JSON) to a local file as plain JSON. Never writes to KV.
//   node scripts/kv_read_live.mjs <kv key, e.g. img_rent_index> <out file> [worker dir] [--allow-missing]   (a missing key is reported as MISSING, exit 0, no file)
import fs from "node:fs";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";

const NS = "2cdf36a27f834b5f9c726294d36770fb", ENVN = "azimuth2";
const args = process.argv.slice(2), allowMissing = args.includes("--allow-missing"), [key, out, dir] = args.filter((a) => a !== "--allow-missing");
if (!key || !out) { console.error("usage: node scripts/kv_read_live.mjs <key> <out file> [worker dir]"); process.exit(2); }
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
let raw;
try {
  raw = execFileSync(npx, ["wrangler", "kv", "key", "get", key, "--text", "--env", ENVN, "--namespace-id", NS], { cwd: dir || process.env.WORKER_DIR || "C:/Dev/azimuth-worker-dewa", maxBuffer: 512 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" });
} catch (e) {
  const msg = e.stderr ? e.stderr.toString() : e.message;
  if (allowMissing && /not found|does not exist|10009/i.test(msg)) { console.log(key + ": MISSING (no value on file)"); process.exit(0); }
  console.error("wrangler kv key get failed for " + key + ":\n" + msg); process.exit(1);
}
const buf = raw[0] === 0x1f && raw[1] === 0x8b ? zlib.gunzipSync(raw) : raw;
const txt = buf.toString("utf8"), at = txt.search(/[\[{]/);
if (at < 0 && allowMissing && /value not found/i.test(txt)) { console.log(key + ": MISSING (no value on file)"); process.exit(0); }
if (at < 0) { console.error(key + ": the value is not JSON (first 200 chars): " + txt.slice(0, 200)); process.exit(1); }
const v = JSON.parse(txt.slice(at));
fs.writeFileSync(out, JSON.stringify(v));
console.log(key + " -> " + out + " (" + fs.statSync(out).size + " bytes; " + (Array.isArray(v.items) ? v.items.length + " items" : Object.keys(v).slice(0, 8).join(",")) + ")");
