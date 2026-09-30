// v274 - RENT mode on the HOMES panel. A client asked Naj for "three options in JVC, one bedroom, AED 65K" (a yearly rent) and the
// panel only searched homes for sale. A Buy / Rent switch now sits at the top of the HOMES panel on /map and on the district twin's
// homes panel (#stkp); Rent reads /img/rent_index (naj-market-pulse scripts/build_rent_index.py) and lights / lists the buildings
// whose median registered rent for the chosen bedrooms falls in the budget.
//
// What this proves, through the real worker and the page's OWN functions (lifted out of HOMES_RENT_JS, as v223 does for the chrome):
//   1. the served /map and /skyline/<slug> scripts parse - a broken string chain blanks the whole map on phones
//   2. the matching: JVC, 1 bed, AED 60-70k/yr returns the JVC buildings whose median is in budget, never one under RENT_MIN
//      contracts, never a building outside the budget; the slider scale; "500k and up" is open-ended
//   3. the panel says what the numbers are: registered contracts, not live availability; bedrooms inferred from size
//   4. Buy mode is untouched: the rent code never writes HB, never redefines drawHomes, and the Buy markup and matcher are as before
//   5. against the real index (NAJ_DATA): the JVC 1-bed AED 65K question, and CANAL VIEWS / BLOOM HEIGHTS counted once
// NEGATIVE CONTROL: revert src/index.js to origin/dewa-screens (git stash) and run this file - it fails (no switch, no HOMES_RENT_JS).
//
//   node test/test_v274_rent_mode.mjs
import worker from "../src/index.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(HERE, "..", "src", "index.js"), "utf8");
const NAJ = process.env.NAJ_DATA || "C:/Dev/naj-market-pulse/data";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };
const parses = (code, ext) => { const f = path.join(os.tmpdir(), "v274_" + Math.random().toString(36).slice(2) + ext); fs.writeFileSync(f, code); try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); return true; } catch (e) { console.log(String(e.stderr || e.message).slice(0, 600)); return false; } finally { try { fs.unlinkSync(f); } catch (e) {} } };

// ---- the worker harness (v186) ----------------------------------------------------------------------
const READ = "client_read_key_in_links_123";
const store = new Map();
const KV = {
  async get(k) { return store.has(k) ? store.get(k) : null; },
  async put(k, v) { store.set(k, v); },
  async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter(k => k.startsWith(p)).map(name => ({ name })) }; },
};
globalThis.fetch = async () => new Response("{}", { status: 200 });
const env = { MEETINGS: KV, READ_KEY: READ, INGEST_TOKEN: "ING", PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
const call = (p, init) => worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev" + p, init), env, { waitUntil() {} });
const scripts = (html) => [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter(m => !/\bsrc=/.test(m[1])).map(m => ({ attrs: m[1], code: m[2] }));

// ---- 1. the served pages carry the switch and their scripts parse -------------------------------------
const mapHtml = await (await call("/map?key=" + READ)).text();
const mapChrome = scripts(mapHtml).find(s => s.code.includes("var RB="));
ok(!!mapChrome, "/map carries the rent block (var RB=) in its chrome script");
ok(mapChrome && parses(mapChrome.code, ".js"), "the whole /map chrome script (MAP_CHROME_JS with HOMES_RENT_JS) parses");
ok(mapHtml.includes('data-m=buy>buy</button><button type=button data-m=rent>rent</button>'), "the Buy / Rent switch is in the page");
ok(mapHtml.includes('j("/img/rent_index?v="'), "Rent mode reads /img/rent_index");

store.set("img_sky_jumeirahvillagecircle", "glb");
const twinHtml = await (await call("/skyline/jumeirahvillagecircle?key=" + READ)).text();
const twinScripts = scripts(twinHtml);
const twinChrome = twinScripts.find(s => s.code.includes("var RB="));
ok(!!twinChrome && parses(twinChrome.code, ".js"), "the twin's chrome script (with the rent block) parses");
const twinMain = twinScripts.find(s => s.code.includes("window.__rentMount({host:p"));
ok(!!twinMain, "the twin's homes panel (#stkp) mounts the Buy / Rent switch");
ok(twinMain && parses(twinMain.code, /type=.?module/.test(twinMain.attrs) ? ".mjs" : ".js"), "the twin's main script still parses with the mount in it");
ok(twinMain && /enter:\(\)=>\{STKON=false;[^}]*stkApply\(\)\}/.test(twinMain.code) && /leave:\(\)=>\{STKON=true;[^}]*stkApply\(\)\}/.test(twinMain.code),
  "on the twin, Rent sets the floor stack aside and Buy brings it back");

// ---- lift HOMES_RENT_JS and run the page's own functions ----------------------------------------------
const a0 = SRC.indexOf("const HOMES_RENT_JS = `");
const a1 = SRC.indexOf("\n`;", a0);
ok(a0 > 0 && a1 > a0, "HOMES_RENT_JS is declared in src/index.js");
const RENT = new Function("return `" + SRC.slice(a0 + "const HOMES_RENT_JS = `".length, a1 + 1) + "`")();
ok(!RENT.includes("${"), "the rent block interpolates nothing");
ok(mapChrome && mapChrome.code.includes(RENT.trim().slice(0, 200)), "the served /map chrome carries HOMES_RENT_JS as written");
function lift(name) {
  const at = RENT.indexOf("function " + name + "(");
  if (at < 0) return null;
  let d = 0;
  for (let i = RENT.indexOf("{", at); i < RENT.length; i++) {
    if (RENT[i] === "{") d++;
    else if (RENT[i] === "}" && --d === 0) return RENT.slice(at, i + 1);
  }
  return null;
}
const names = ["stepRent", "fmtRent", "rbLabel", "rbWord", "rentFig", "rentIqr", "rentDay", "rbText", "rbdText", "rentMatches", "rentNote", "rentArea", "rentHref", "rentRow", "listRent"];
const lifted = names.map(lift);
ok(lifted.every(Boolean), "every rent function lifts out of the block", names.filter((n, i) => !lifted[i]).join(","));
const panel = { innerHTML: "", classList: { add() {} }, querySelectorAll: () => [] };
const STATE = { mode: "rent", on: true, lo: 10, hi: 30, blo: 1, bhi: 2, type: "any" };   // RB: the page's own state object, mutated below
const api = new Function("RB", "RENT_MIN", "esc", "dName", "document", "KEY", "closePanel", "window",
  "var RI=null,LISTK=null;" + lifted.join(";") + ";return {" + names.join(",") + ",setRI:function(v){RI=v}}")(
  STATE, 2, (t) => String(t == null ? "" : t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]),
  (s) => ({ jumeirahvillagecircle: "Jumeirah Village Circle", dubaimarina: "Dubai Marina" })[s] || s,
  { getElementById: (id) => (id === "panel" ? panel : { onclick: null }) }, "k", () => {}, {});
const run = (o) => { Object.assign(STATE, o); return api.rentMatches(); };

// ---- 2. the slider scale and the matching -------------------------------------------------------------
ok(api.stepRent(0) === 20000 && api.stepRent(30) === 80000 && api.stepRent(50) === 200000 && api.stepRent(60) === 500000,
  "the rent slider runs 20k (2k steps) to 80k, (6k steps) to 200k, (30k steps) to 500k");
ok(api.stepRent(20) === 60000 && api.stepRent(25) === 70000, "AED 60k and 70k are exact slider stops (a 65K question sits between them)");

const S = (n, nn, m, mn, s, last) => ({ n, nn, nr: n - nn, m, q1: m - 5000, q3: m + 5000, ...(nn ? { mn, q1n: mn - 4000, q3n: mn + 4000 } : {}), s, last });
const FIX = {
  as_of: "2026-09-30", window: ["2026-08-01", "2026-09-30"],
  items: [
    { p: "binghattinova", n: "Binghatti Nova", area: "Al Barsha South Fourth", d: "jumeirahvillagecircle", i: 1490, lon: 55.2, lat: 25.05, b: { "1": S(16, 13, 65000, 65000, 59.1, "2026-09-30") } },
    { p: "bloomheights", n: "BLOOM HEIGHTS", a: ["CANAL VIEWS"], area: "Al Barsha South Fourth", d: "jumeirahvillagecircle", i: 893, b: { "1": S(15, 12, 65000, 66500, 69.7, "2026-09-30") } },
    { p: "binghattiamber", n: "Binghatti Amber", area: "Al Barsha South Fourth", d: "jumeirahvillagecircle", b: { "1": S(29, 27, 66000, 65817, 64.5, "2026-09-29") } },
    { p: "pricey", n: "PRICEY TOWER", area: "Al Barsha South Fourth", d: "jumeirahvillagecircle", i: 7, b: { "1": S(20, 20, 95000, 95000, 80, "2026-09-20") } },
    { p: "thin", n: "ONE CONTRACT", area: "Al Barsha South Fourth", d: "jumeirahvillagecircle", i: 8, b: { "1": S(1, 1, 65000, 65000, 60, "2026-09-20") } },
    { p: "renewals", n: "RENEWALS ONLY", area: "Al Barsha South Fourth", d: "jumeirahvillagecircle", i: 9, b: { "1": S(6, 1, 64000, 90000, 60, "2026-09-20") } },
    { p: "villa", n: "SOME VILLAS", area: "Al Barsha South Fourth", d: "jumeirahvillagecircle", i: 10, v: { "3": S(5, 5, 68000, 68000, 250, "2026-09-20") } },
    { p: "marina", n: "MARINA ONE", area: "Marsa Dubai", d: "dubaimarina", i: 3, b: { "1": S(9, 9, 69000, 69000, 70, "2026-09-25") } },
  ],
  areas: [{ area: "Al Barsha South Fourth", d: "jumeirahvillagecircle", b: { "1": S(1323, 988, 69000, 70000, 73.4, "2026-09-30") } }],
};
api.setRI(FIX);

let m = run({ lo: 20, hi: 25, blo: 1, bhi: 1, type: "apt" });
const got = m.map(x => x.r.n);
ok(got.includes("Binghatti Nova") && got.includes("BLOOM HEIGHTS") && got.includes("Binghatti Amber"), "JVC 1 bed at AED 60-70k/yr finds Binghatti Nova, Bloom Heights and Binghatti Amber", got.join(" | "));
ok(m.every(x => x.v >= 60000 && x.v <= 70000), "every match's median is inside the budget");
ok(!got.includes("PRICEY TOWER"), "a building renting at 95k is not in a 60-70k budget");
ok(!got.includes("ONE CONTRACT"), "a building with a single contract is never offered (RENT_MIN = 2)");
ok(m.some(x => x.r.n === "RENEWALS ONLY" && x.v === 64000), "a building with under 3 new lettings is judged on all its contracts (64k), never on one new let (90k)", got.join(" | "));
ok(got.includes("MARINA ONE") && m.filter(x => x.r.d === "jumeirahvillagecircle").length === 4, "the whole city matches; four of them are in JVC");
ok(!got.includes("SOME VILLAS"), "home type apartment leaves the villas out");
ok(got.indexOf("Binghatti Amber") === 0, "most contracts first: the best-evidenced building leads the list");
ok(run({ type: "villa", blo: 3, bhi: 3 }).map(x => x.r.n).join() === "SOME VILLAS", "villa & townhouse, 3+ bed, finds the villas only");
ok(run({ type: "any", blo: 1, bhi: 1, lo: 20, hi: 60 }).some(x => x.r.n === "PRICEY TOWER"), "the top stop is open-ended: 60k to '500k and up' includes 95k");
STATE.lo = 20; STATE.hi = 60; ok(api.rbText() === "from AED 60k to 500k and up", "the budget label says 'and up' at the top stop", api.rbText());
STATE.blo = 1; STATE.bhi = 1; ok(api.rbdText() === "1", "one bedroom reads '1'");
STATE.blo = 0; STATE.bhi = 3; ok(api.rbdText() === "from studio to 3+", "the bedroom label reads studio to 3+", api.rbdText());
ok(api.rentHref(FIX.items[0]) === "/building/jumeirahvillagecircle/1490?key=k", "a matched building opens its building page", api.rentHref(FIX.items[0]));

// ---- 3. the panel says what these numbers are ---------------------------------------------------------
m = run({ lo: 20, hi: 25, blo: 1, bhi: 1, type: "apt" });
api.listRent(m.filter(x => x.r.d === "jumeirahvillagecircle"), "jumeirahvillagecircle");
const L = panel.innerHTML;
ok(/NOT live availability/.test(L) && /Bedrooms are inferred from each home/.test(L), "the list says: registered contracts, not live availability; bedrooms inferred from size");
ok(/Registered Ejari contracts, 1 Aug to 30 Sep/.test(L), "the list names the contract window");
ok(/4 buildings in Jumeirah Village Circle/.test(L), "the list counts the JVC buildings", L.slice(0, 300));
ok(/1-bed AED 65k\/yr/.test(L) && /16 contracts \(13 new\)/.test(L) && /59 m\u00b2/.test(L) && /latest 30 Sep/.test(L), "each row shows median rent, contracts (new), size and the latest contract");
ok(/also filed as CANAL VIEWS/.test(L), "a building filed under two DLD names says so");
ok(/all of Jumeirah Village Circle, named buildings or not: 1-bed AED 70k/.test(L), "the district-wide median is on the list");
ok(/no building page yet/.test(L), "a building without a page says so rather than linking nowhere");
ok(RENT.includes("What homes actually rent for: registered Ejari contracts, not live availability. Bedrooms are inferred from size."), "the panel itself carries the same caveat above the sliders");

// ---- 4. Buy mode is untouched -------------------------------------------------------------------------
ok(!/\bHB\.[a-z]+\s*=[^=]/.test(RENT), "the rent code never writes the Buy state (HB)");
ok(!/drawHomes\s*=/.test(RENT) && !/function drawHomes/.test(RENT), "the rent code never redefines drawHomes");
ok(/if\(RB\.mode!=="rent"\)return hhBuy&&hhBuy\.call\(this,ev\)/.test(RENT), "in Buy mode the header click is the original handler");
ok(/leave:function\(\)\{[^}]*hl\.onclick=st\.hl\|\|null[^}]*if\(HB\.on\)drawHomes\(\)\}/.test(RENT), "leaving Rent restores the Buy list handler and redraws Buy as it was");
ok(mapHtml.includes('<input type=range id=hlo min=0 max=60 value=10 autocomplete=off><input type=range id=hhi min=0 max=60 value=30 autocomplete=off>') && mapHtml.includes("<span>developer stock only</span>"),
  "the Buy controls are served exactly as before");
ok(SRC.includes("+ 'function homeMatches(){var lo=stepAed(HB.lo),hi=stepAed(HB.hi);if(hi<lo){var t=lo;lo=hi;hi=t}var blo=Math.min(HB.blo,HB.bhi),bhi=Math.max(HB.blo,HB.bhi);var out=[];'"),
  "the Buy matcher is unchanged");
const city = await (await call("/skyline?all=1&key=" + READ)).text();
ok(city.includes("function homeMatches()") && !city.includes("var RB=") && !city.includes("data-m=rent"), "the all-Dubai twin keeps its Buy-only panel (it brings its own chrome)");

// ---- 5. the real index (naj-market-pulse data/board/rent_index.json) ----------------------------------
const real = (() => { try { return JSON.parse(fs.readFileSync(path.join(NAJ, "board", "rent_index.json"), "utf8")); } catch { return null; } })();
if (!real) {
  console.log("  skip real index - set NAJ_DATA to the naj-market-pulse data directory (needs data/board/rent_index.json)");
} else {
  api.setRI(real);
  const jm = run({ lo: 20, hi: 25, blo: 1, bhi: 1, type: "apt" }).filter(x => x.r.d === "jumeirahvillagecircle");
  console.log("  real index " + real.source_file + ": JVC 1-bed AED 60-70k -> " + jm.length + " buildings; top: " + jm.slice(0, 5).map(x => x.r.n + " " + x.v + " (" + x.s.n + ")").join(", "));
  ok(jm.length >= 3, "the client's question (JVC, 1 bed, AED 65K) has at least three answers", jm.length);
  ok(jm.every(x => x.v >= 60000 && x.v <= 70000 && x.s.n >= 2), "every real answer is in budget with 2+ contracts");
  const cv = real.items.filter(it => [it.n].concat(it.a || []).some(n => /^CANAL VIEWS$/i.test(n)));
  ok(cv.length === 1 && [cv[0].n].concat(cv[0].a || []).some(n => /^BLOOM HEIGHTS$/i.test(n)), "CANAL VIEWS and BLOOM HEIGHTS are one record, counted once", JSON.stringify(cv.map(c => [c.n, c.a])));
  const pt = real.items.filter(it => [it.n].concat(it.a || []).some(n => /^PREMIERS TWIN TOWER$/i.test(n)));
  ok(pt.length === 1 && [pt[0].n].concat(pt[0].a || []).some(n => /^Binghatti Corner$/i.test(n)), "PREMIERS TWIN TOWER and Binghatti Corner are one record");
  ok(real.items.every(it => it.i == null || (it.d && typeof it.i === "number")), "every bound building carries its district and anchor index");
}

console.log((fail ? "FAIL" : "PASS") + " - v274 rent mode: " + pass + " ok, " + fail + " failed");
process.exit(fail ? 1 : 0);
