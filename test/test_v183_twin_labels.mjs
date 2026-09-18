// v183 — THE DISTRICT TWIN NAMES ITS SUB-COMMUNITIES AND ITS AROUND-IT RINGS (Kendall, 18 Sep 2026, reviewing demo video 03).
//
// The map names every sub-community (its sub-lab layer); the twin drew only dots and rings through its map bridge, so in 3D
// nothing was named until a card was opened. Verified on a preview version against Madinat Al Mataar: 122 of the district's
// sub-communities, the selected one ("Terra Woods") labelled in gold, and nine AROUND IT rings carrying the panel's names.
// This test pins the pieces that make that work, on the rendered pages.
import worker from "../src/index.js";
import { writeFileSync, mkdtempSync } from "fs";
import { execFileSync } from "child_process";
import { tmpdir } from "os";
import { join } from "path";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("ok - " + m); } else { fail++; console.log("not ok - " + m); } };
globalThis.fetch = async () => new Response("{}", { status: 200 });
const store = new Map([["sky_madinatalmataar", "x"]]);
const KV = { async get(k) { return store.get(k) || null; }, async getWithMetadata(k) { return { value: store.get(k) || null, metadata: null }; }, async put() {}, async delete() {}, async list() { return { keys: [...store.keys()].map((name) => ({ name })), list_complete: true }; } };
const READ = "owner_admin_key_never_in_client_links_0001";
const page = async (p) => (await worker.fetch(new Request("https://x" + p + "?key=" + READ), { MEETINGS: KV, READ_KEY: READ }, { waitUntil() {} })).text();

const twin = await page("/skyline/madinatalmataar");
const mod = [...twin.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter((m) => /module/.test(m[1])).map((m) => m[2]).join("\n");
ok(/function _drawSubs\(\)/.test(mod) && /try\{_drawSubs\(\)\}catch/.test(mod), "the twin draws the sub-community names every frame");
ok(/_TL\["sub-lab"\]/.test(mod), "from the map's own sub-lab layer, so the names are the rail's names");
ok(/location\.pathname\.split\("\/skyline\/"\)/.test(mod), "limited to the twin's own district, read from its address (the chrome's currentDistrict is not reachable from the module)");
ok(/sel\?1e12:0/.test(mod) && /if\(!c\.sel\)\{if\(pick\.length>=12\)break/.test(mod), "the selected sub-community is always labelled, ahead of the 12-label limit and past any collision");
ok(/a\.lb,\.top,#hp,#panel,#ppanel,\.nnav/.test(mod), "labels avoid the building labels AND the chrome - search, rail, cards, open panel, tab bar");
ok(/if\(id==="near-ring"\)\{[^}]*pr\.n/.test(mod) && /d\._n!==nb/.test(mod), "AROUND IT rings show their place name, refreshed when the list changes");
ok(/window\.__twinSubs=/.test(mod), "the label counts are readable from the page for testing");
const dir = mkdtempSync(join(tmpdir(), "twin-"));
writeFileSync(join(dir, "m.mjs"), mod);
let parses = true; try { execFileSync(process.execPath, ["--check", join(dir, "m.mjs")], { stdio: "pipe" }); } catch (e) { parses = false; console.log(String(e.stderr).slice(0, 300)); }
ok(parses, "the twin's module script still parses");

const map = await page("/map");
ok(/properties:\{col:AMEN\[x\[1\]\.k\]\[2\],n:x\[1\]\.n\|\|""\}/.test(map), "the map passes each AROUND IT ring its name (the 2D map ignores it)");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
