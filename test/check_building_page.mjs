// A hand check of /building/<district>/<id> against the real register files on disk (not part of npm test: it reads the pipeline's
// output, which only exists on the machine that builds it). node test/check_building_page.mjs [district] [id]
import worker from "../src/index.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const NAJ = "C:/Dev/naj-market-pulse/data";
const D = process.argv[2] || "businessbay", ID = process.argv[3] || "574";
const store = new Map();
const load = (kv, file) => { try { store.set("img_" + kv, fs.readFileSync(file, "utf8")); } catch (e) { console.log("(no " + kv + ")"); } };
load("stack_" + D, NAJ + "/board/stack_" + D + ".json");
load("unitmix_" + D, NAJ + "/board/unitmix_" + D + ".json");
load("bldgfacts_" + D, NAJ + "/board/bldgfacts_" + D + ".json");
load("anchors_" + D, NAJ + "/names/anchors_" + D + ".json");
const KV = {
  async get(k) { return store.has(k) ? store.get(k) : null; },
  async put(k, v) { store.set(k, v); },
  async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter(k => k.startsWith(p)).map(name => ({ name })) }; },
};
globalThis.fetch = async () => new Response("{}", { status: 200 });
const KEY = "client_read_key_in_links_123";
const env = { MEETINGS: KV, READ_KEY: KEY, INGEST_TOKEN: "ING" };
const r = await worker.fetch(new Request("https://x/building/" + D + "/" + ID + "?key=" + KEY), env, { waitUntil() {} });
console.log("status", r.status);
const h = await r.text();
let bad = 0;
const want = ["FILTERS", "Sold so far", "About the building", "Hide All", "the twin", String.fromCharCode(34) + "/img/sky_" + String.fromCharCode(34)];
for (const w of want) { const ok = h.includes(w); if (!ok) bad++; console.log((ok ? "ok   " : "MISS ") + w); }
const i = h.indexOf('<script type="module">'), j = h.lastIndexOf("</script>");
const mod = h.slice(i + 22, j);
const f = path.join(os.tmpdir(), "bp_mod.mjs");
fs.writeFileSync(f, mod);
try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); console.log("ok   the page module parses"); }
catch (e) { bad++; console.log("MISS module parse: " + String(e.stderr).slice(0, 500)); }
const title = (h.match(/<title>([^<]*)</) || [])[1];
const rows = (h.match(/<tr><td>/g) || []).length;
console.log("title:", title, "| register rows:", rows, "| page", (h.length / 1024).toFixed(0), "KB");
process.exit(bad ? 1 : 0);
