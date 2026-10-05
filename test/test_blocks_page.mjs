// BLOCKS (30 Sep 2026) - /blocks, the LOD 100 view between the map (dots) and the twin (full detail). src/blocks_page.js.
//
// What this proves, through the real worker (worker.fetch, KV stubbed) and, where it is on disk, the REAL JVC blocks file
// (naj-market-pulse scripts/build_blocks.py -> data/ce/jumeirahvillagecircle/blocks.json) and the real unit-mix register:
//   1. the gate: no key 401, the owner key and a client key open it (it is an app page, like /map)
//   2. every inline script on the served page parses (node --check) and the page script is served exactly as written
//   3. the gold list: the default ten in make_map.py's order, 7 and 8 approximate; a link's own list, numbered as given;
//      junk skipped, never guessed; names cannot break out of the page
//   4. the data route: /img/blocks_<slug> serves the stored gzip as gzip, and it carries the ten footprints at the heights the
//      static map used; the page says "not ready" when the district has no blocks on file
//   5. building-page links only for gold ids the unit-mix register holds (what /building/ needs), none without the stack
// NEGATIVE CONTROL: put src/index.js back to origin/dewa-screens (git show origin/dewa-screens:src/index.js > src/index.js)
// and run this file - /blocks falls to the keyed catch-all and the gate, page and data checks fail.
//
//   node test/test_blocks_page.mjs
import worker from "../src/index.js";
import { parseGold, blocksPageHtml, BLOCKS_JS, BLOCKS_DEFAULT_GOLD } from "../src/blocks_page.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NAJ = process.env.NAJ_DATA || "C:/Dev/naj-market-pulse/data";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };
const parses = (code) => { const f = path.join(os.tmpdir(), "blocks_" + Math.random().toString(36).slice(2) + ".js"); fs.writeFileSync(f, code); try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); return true; } catch (e) { console.log(String(e.stderr || e.message).slice(0, 600)); return false; } finally { try { fs.unlinkSync(f); } catch (e) {} } };

// ---- the worker harness (v186 / v274 style) ---------------------------------------------------------------------------------
const READ = "owner_read_key_abcdefghijklmnop", CLIENT = "client_key_current_abcdefghij";
const store = new Map();
const KV = {
  async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); const ty = typeof t === "string" ? t : t && t.type;
    if (ty === "arrayBuffer") return typeof v === "string" ? new TextEncoder().encode(v).buffer : v;
    if (ty === "json") return JSON.parse(typeof v === "string" ? v : new TextDecoder().decode(v));
    return typeof v === "string" ? v : new TextDecoder().decode(v); },
  async put(k, v) { store.set(k, v); },
  async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter(k => k.startsWith(p)).map(name => ({ name })) }; },
};
globalThis.fetch = async () => new Response("{}", { status: 200 });
const env = { MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: CLIENT, INGEST_TOKEN: "ING", PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
const call = (p, init) => worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev" + p, init), env, { waitUntil() {} });
const scripts = (html) => [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter(m => !/\bsrc=/.test(m[1])).map(m => ({ attrs: m[1], code: m[2] }));
const cfgOf = (html) => { const m = /window\.__BLOCKS_CFG__=(\{[\s\S]*?\});<\/script>/.exec(html); return m ? JSON.parse(m[1]) : null; };

// the real JVC blocks file, when this machine has it; a small stand-in otherwise (the real-data checks then say so)
const SLUG = "jumeirahvillagecircle";
const REAL = path.join(NAJ, "ce", SLUG, "blocks.json");
const haveReal = fs.existsSync(REAL);
const TEN = { 1503: 78.2, 892: 153.0, 893: 115.6, 1490: 68.0, 1502: 119.0, 1499: 85.0, 1489: 67.2, 1137: 19.2 };   // make_map.py
const sq = (x, y) => ({ type: "Polygon", coordinates: [[[x, y], [x + 0.0004, y], [x + 0.0004, y + 0.0004], [x, y + 0.0004], [x, y]]] });
const blocksRaw = haveReal ? fs.readFileSync(REAL) : Buffer.from(JSON.stringify({ type: "FeatureCollection", meta: { slug: SLUG, bbox: [55.19, 25.05, 55.22, 25.07] },
  features: Object.entries(TEN).map(([i, h], k) => ({ type: "Feature", properties: { k: "b", i: +i, h, hs: "bldgfacts", n: "B" + i }, geometry: sq(55.2 + k * 0.001, 25.06) }))
    .concat([{ type: "Feature", properties: { k: "s", hw: "motorway", nm: "Sheikh Mohammed Bin Zayed Road" }, geometry: { type: "LineString", coordinates: [[55.19, 25.05], [55.22, 25.06]] } }]) }));
if (!haveReal) console.log("  note - " + REAL + " not on this machine: the real-data checks run on a stand-in (run build_blocks.py to use the real file)");

// ---- 1. the gate --------------------------------------------------------------------------------------------------------------
let r = await call("/blocks");
ok(r.status === 401, "/blocks with no key: 401");
r = await call("/blocks?key=not_a_key_at_all_xx");
ok(r.status === 401, "/blocks with a wrong key: 401");

// no blocks on file yet: the page opens and says so, rather than drawing an empty map
r = await call("/blocks?key=" + READ);
let html = await r.text();
ok(r.status === 200 && /text\/html/.test(r.headers.get("Content-Type") || ""), "/blocks with the owner key: 200 html");
ok(cfgOf(html) && cfgOf(html).have === false && BLOCKS_JS.includes("The digital footprint for this district is not ready yet."), "no img_blocks_<slug> on file: the page knows (have:false) and says the blocks are not ready");

// ---- stub KV with the real file, stored the way build_blocks.py --push stores it (gzip, application/json) ---------------------
store.set("img_blocks_" + SLUG, zlib.gzipSync(blocksRaw).buffer);
store.set("img_ct_blocks_" + SLUG, "application/json");

r = await call("/blocks?key=" + CLIENT);
html = await r.text();
ok(r.status === 200, "/blocks with a client key: 200 (an app page, like /map)");
ok(!html.includes(READ), "opened with a client key, the page carries no owner key");
const cfg = cfgOf(html);
ok(cfg && cfg.have === true && cfg.slug === SLUG && cfg.dataUrl === "/img/blocks_" + SLUG, "the page reads /img/blocks_" + SLUG, JSON.stringify(cfg && { have: cfg.have, slug: cfg.slug, dataUrl: cfg.dataUrl }));
ok(cfg && cfg.key === CLIENT, "the page keeps the key that opened it for its own links (building page, map)");

// ---- 2. the scripts parse, and the page script is served as written -----------------------------------------------------------
const sc = scripts(html);
ok(sc.length >= 2 && sc.every((s) => parses(s.code)), "every inline script on the served page parses (" + sc.length + ")");
ok(sc.some((s) => s.code === BLOCKS_JS), "the served page script is BLOCKS_JS exactly");
ok(!BLOCKS_JS.includes("${") && !/<\/script/i.test(BLOCKS_JS), "the page script has no template holes and no </script");
ok(html.includes('src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"'), "it loads the same MapLibre build /map uses (4.7.1)");
ok(/fill-extrusion-height":\["get","h"\]/.test(BLOCKS_JS) && /pitch:PITCH,bearing:0/.test(BLOCKS_JS), "blocks are fill-extrusions at their own height, opening pitched from the south (bearing 0)");
ok(/PITCH=\([^;]*\?50:55/.test(BLOCKS_JS), "the opening pitch is 50-55 degrees");
ok(/id=north/.test(html) && /aria-label="Point north"/.test(html), "there is a north indicator (and it resets the view to north)");
ok(BLOCKS_JS.includes('CTX_SEL,["==",["get","u"],1],CTX_UNK,CTX]') && BLOCKS_JS.includes('u:unknownH(p.hs)?1:0') && html.includes("Height not yet known"),
  "blocks whose height is not known draw lighter, and the key says so");

// ---- 3. the gold list ---------------------------------------------------------------------------------------------------------
const d = parseGold(BLOCKS_DEFAULT_GOLD[SLUG]);
ok(d.length === 10 && d.map((g) => g.num).join() === "1,2,3,4,5,6,7,8,9,10", "the default JVC set is ten, numbered 1-10");
ok([1503, 892, 893, 1490, 1502, 1499, null, null, 1489, 1137].every((i, k) => (i === null ? d[k].i === undefined : d[k].i === i)), "in make_map.py's order, with its footprint ids");
ok(d[6].approx && d[6].name === "Elysee III by Pantheon" && Math.abs(d[6].approx[0] - 55.1969305) < 1e-9 && d[6].s === 55 && Math.abs(d[6].h - 23.8) < 1e-9, "7 is Elysee III, approximate, 55 m square, 7 floors x 3.4 m");
ok(d[7].approx && d[7].name === "Binghatti Gardenia" && d[7].s === 34 && Math.abs(d[7].h - 132.6) < 1e-9, "8 is Binghatti Gardenia, approximate, 34 m square, 39 floors x 3.4 m");
ok(cfg && cfg.gold.length === 10 && cfg.gold[1].i === 892, "no gold parameter: the page gets the default ten");
const g2 = parseGold("892,  junk, approx=55.2,25.06,n=Test <b>\"x\",1503,892,approx=999,25,approx=55.1");
ok(g2.length === 3 && g2[0].i === 892 && g2[1].approx && g2[1].name === "Test bx" && g2[2].i === 1503 && g2[2].num === 3,
  "a link's own list is numbered as given; junk, repeats, an impossible lon and a half pair are skipped; a name loses < > \"", JSON.stringify(g2));
ok(parseGold(Array.from({ length: 50 }, (_, k) => k + 1).join()).length === 30, "at most 30 gold");
r = await call("/blocks?key=" + CLIENT + "&gold=");
ok(cfgOf(await r.text()).gold.length === 0, "gold= (empty): nothing gold");
r = await call("/blocks?key=" + CLIENT + "&gold=" + encodeURIComponent("1490,approx=55.21,25.058,h=40,n=</script><script>alert(1)</script>"));
html = await r.text();
ok(!/<script>alert/.test(html) && cfgOf(html).gold.length === 2 && cfgOf(html).gold[1].h === 40, "a hostile name cannot break out of the page");
const hx = blocksPageHtml({ slug: SLUG, gold: [{ num: 1, approx: [55.2, 25.06], h: 10, s: 10, name: "</script><b>" }], data: { type: "FeatureCollection", features: [{ properties: { n: "</script><img>" } }] } });
ok(!/<\/script><(b|img)>/.test(hx) && (hx.match(/<\/script>/g) || []).length === scripts(hx).length + 1, "inlined data (the standalone preview) cannot close its script either");
r = await call("/blocks?key=" + CLIENT + "&district=" + encodeURIComponent("../Jumeirah Village Circle!"));
ok(cfgOf(await r.text()).slug === SLUG, "the district is reduced to a slug");

// ---- 4. the data route --------------------------------------------------------------------------------------------------------
r = await call("/img/blocks_" + SLUG);
const body = Buffer.from(await r.arrayBuffer());
ok(r.status === 200 && r.headers.get("Content-Type") === "application/json" && r.headers.get("Content-Encoding") === "gzip", "/img/blocks_" + SLUG + " serves the stored gzip as gzip, typed JSON (keyless, like every /img/ asset)");
let fc = null; try { fc = JSON.parse(zlib.gunzipSync(body).toString("utf8")); } catch (e) {}
ok(fc && fc.type === "FeatureCollection", "it decodes to a GeoJSON FeatureCollection");
const bl = new Map(((fc && fc.features) || []).filter((f) => f.properties.k === "b").map((f) => [f.properties.i, f]));
ok(Object.entries(TEN).every(([i, h]) => bl.has(+i) && Math.abs(bl.get(+i).properties.h - h) < 0.05), (haveReal ? "REAL FILE: " : "stand-in: ") + "the eight footprinted buildings are there at the heights the static map used",
  Object.keys(TEN).map((i) => i + "=" + (bl.get(+i) || {}).properties?.h).join(" "));
if (haveReal) {
  ok(bl.size > 1500 && fc.features.some((f) => f.properties.k === "s" && f.properties.nm === "Sheikh Mohammed Bin Zayed Road"), "REAL FILE: all of JVC (" + bl.size + " footprints) and its streets, the main roads named");
  ok([...bl.values()].every((f) => f.properties.hs && f.properties.h > 0 && /Polygon$/.test(f.geometry.type)), "REAL FILE: every footprint has a height, a height source and a polygon");
  ok([...bl.values()].every((f) => f.properties.hs !== "unknown" || f.properties.h === 12), "REAL FILE: an unknown height is only ever the 12 m placeholder");
  ok(body.length < 5 * 1024 * 1024, "REAL FILE: gzipped it is under the 5 MB /ingest_market cap (" + Math.round(body.length / 1024) + " KB)");
}

// ---- 5. building-page links: only where /building/ would open -----------------------------------------------------------------
const UM = path.join(NAJ, "board", "unitmix_" + SLUG + ".json");
const umRaw = fs.existsSync(UM) ? fs.readFileSync(UM, "utf8") : JSON.stringify({ buildings_by_id: Object.fromEntries(Object.keys(TEN).filter((i) => i !== "1137").map((i) => [i, {}])) });
store.set("img_unitmix_" + SLUG, umRaw);
r = await call("/blocks?key=" + CLIENT);
ok(cfgOf(await r.text()).pages.length === 0, "no stack on file: no building-page links (the building page needs it)");
store.set("img_stack_" + SLUG, "{}");
r = await call("/blocks?key=" + CLIENT);
const pages = cfgOf(await r.text()).pages;
const um = JSON.parse(umRaw).buildings_by_id;
ok(pages.length > 0 && pages.every((i) => um[String(i)]) && Object.keys(TEN).filter((i) => um[i]).every((i) => pages.includes(+i)), "links exactly for the gold ids the unit-mix register holds (" + pages.join(",") + ")");
ok(/href="\/building\/'\+CFG\.slug\+'\/'\+g\.i\+keyQ\(\)\+'">Open the building page/.test(BLOCKS_JS), "the link is /building/<district>/<id> with the page's key");
r = await call("/building/" + SLUG + "/" + (pages[0] || 0) + "?key=" + CLIENT);
ok(r.status !== 401, "and the client key that opened /blocks opens that building route");

// ---- index.js carries only the marked dispatch --------------------------------------------------------------------------------
const SRC = fs.readFileSync(path.join(HERE, "..", "src", "index.js"), "utf8");
ok(/import \{ blocksRoute \} from "\.\/blocks_page\.js";/.test(SRC) && /\/\/ ---- BLOCKS[^\n]*\n\s*\{ const _blk = await blocksRoute\(request, env, url, \{ clientOk, clientResp \}\); if \(_blk\) return _blk; \}\n\s*\/\/ ---- \/BLOCKS/.test(SRC),
  "src/index.js: one import and one marked dispatch");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
