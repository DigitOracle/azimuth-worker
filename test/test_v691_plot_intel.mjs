// v691 ACTIVITY RADAR (/plot_radar) + LAND SCANNER (/plot_land), through the real worker entry with an in-memory KV.
// Proves: key gate, both pages render from KV, the served script parses AND every id it reads exists in the served markup,
// the one-liners never say "started", project-level wording is labelled, freshness + "for sale is not known" on screen,
// no emoji, MORE lists both rooms, the empty state when KV is missing, ranking strong > medium > weak.
// NEGATIVE CONTROL: change oneLiner("permit") to say "Construction started" and check 4 fails.
//   node test/test_v691_plot_intel.mjs
import worker from "../src/index.js";
import { oneLiner, rankRadar, sizeBand } from "../src/plot_intel.js";
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import { execFileSync } from "node:child_process";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const READ = "owner_read_key_abcdefghijklmnop";
const store = new Map();
const KV = { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter((k) => k.startsWith(p)).map((name) => ({ name })) }; } };
globalThis.fetch = async () => new Response("{}", { status: 200 });
const env = { MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: "client_key_current_abcdefghij", INGEST_TOKEN: "ING", PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
const call = (p) => worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev" + p), env, { waitUntil() {} });
const scripts = (h) => [...h.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter((m) => !/\bsrc=/.test(m[1])).map((m) => m[2]);
const parses = (code) => { const f = path.join(os.tmpdir(), "pi_" + Math.random().toString(36).slice(2) + ".js"); fs.writeFileSync(f, code); try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); return true; } catch (e) { console.log(String(e.stderr)); return false; } finally { fs.unlinkSync(f); } };
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const idsRead = (js) => [...js.matchAll(/\$\("([a-z]+)"\)/g)].map((m) => m[1]);

// 1. gate
ok((await call("/plot_radar")).status === 401, "radar without a key: 401");
ok((await call("/plot_land?key=nope_nope_nope_nope")).status === 401, "scanner with a wrong key: 401");

// 2. empty KV: pages still render with an honest empty state
let h = await (await call("/plot_radar?key=" + READ)).text();
ok(/No new activity on file this week/.test(h) && /not yet built/.test(h), "radar with no KV file: empty state and 'not yet built'");

// 3. with data
store.set("plot_radar", JSON.stringify({ as_of: "2026-11-01", rows: [
  { id: "P1", no: "6457865", district: "Majan", type: "permit", strength: "weak", date: "2026-10-28", what: "G+12 residential" },
  { id: "P2", no: "6488707", district: "Dubailand", type: "building", strength: "strong", date: "2026-10-27" },
  { id: "P3", no: "3456001", district: "Al Barsha South", type: "project", strength: "medium", date: "2026-10-30", what: "Jade Tower" }] }));
store.set("plot_land", JSON.stringify({ as_of: "2026-11-01", rows: [
  { id: "P9", no: "111", district: "Majan", group: "none", land_type: "Residential", area_sqm: 800 },
  { id: "P8", no: "222", district: "Majan", group: "registered", land_type: "Commercial", area_sqm: 6000, why: "Project registered, not started" },
  { id: "P7", no: "333", district: "Dubailand", group: "permits", land_type: "Residential", area_sqm: 2500 },
  { id: "P6", no: "444", district: "Dubailand", group: "disagree", land_type: "Residential", area_sqm: 1200 }] }));
h = await (await call("/plot_radar?key=" + READ)).text();
const rs = scripts(h).join(";");
ok(parses(rs), "radar served script parses");
ok(idsRead(rs).every((i) => h.includes("id=" + i)), "radar: every element the script reads is in the markup (" + [...new Set(idsRead(rs))].join(",") + ")");
ok(!/construction (has )?start|work (has )?start|started/i.test(h.replace(/not proof that work has started/g, "")), "radar never says construction started");
ok(/Records checked up to <b>1 Nov 2026/.test(h), "radar shows the data date");
ok(h.indexOf("6488707") < h.indexOf("3456001") && h.indexOf("3456001") < h.indexOf("6457865"), "radar ranks strong, medium, weak");
ok(/project-level record/.test(h), "project registration labelled project-level");
ok(rs.includes('"pp":"/najma/plot"') && rs.includes('"?id="'), "rows open the Plot Passport by plot id");
ok(!EMOJI.test(h), "radar: no emoji");
h = await (await call("/plot_land?key=" + READ)).text();
const ls = scripts(h).join(";");
ok(parses(ls), "scanner served script parses");
ok(idsRead(ls).every((i) => h.includes("id=" + i)), "scanner: every element the script reads is in the markup");
ok(/for sale is not known/.test(h), "scanner says availability for purchase is unknown");
ok((h.match(/class=grp /g) || []).length === 4, "scanner: four group cards");
ok(/\/developers_map\?empty=all&amp;key=/.test(h), "scanner links to the map Empty plots layer");
ok(!EMOJI.test(h), "scanner: no emoji");

// 4. wording + helpers
ok(oneLiner({ type: "permit", date: "2026-10-28" }) === "New building permit filed on 28 Oct", "one-liner: 'New building permit filed on 28 Oct'");
ok(!/start/i.test(Object.keys({ permit: 1, building: 1, project: 1, register: 1 }).map((t) => oneLiner({ type: t, date: "2026-10-01" })).join(" ")), "no one-liner says start");
ok(rankRadar([{ strength: "weak" }, { strength: "strong" }])[0].strength === "strong", "rankRadar strong first");
ok(sizeBand(999) === "s" && sizeBand(5000) === "m" && sizeBand(5001) === "l", "size bands");

// 5. MORE lists both rooms
h = await (await call("/more?key=" + READ)).text();
ok(/\/plot_radar\?key=/.test(h) && /\/plot_land\?key=/.test(h), "MORE lists Activity radar and Land scanner");

console.log("\n" + pass + " passed, " + fail + " failed"); if (fail) process.exit(1);
