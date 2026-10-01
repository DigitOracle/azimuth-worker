// v278 - render /map zoomed into a district with the blocks layer, and /skyline/<slug> in its blocks-first state (and after the
// tile lands), with headless Chrome against a local server that runs the REAL worker with a stubbed KV.
//
//   node scripts/v278_preview.mjs [--district jumeirahvillagecircle] [--out <dir>] [--chrome <chrome.exe>] [--tile <glb>]
//
// KV stub: img_blocks_<slug> (gzip of naj-market-pulse data/ce/<slug>/blocks.json), img_districts_geo (data/board/districts_geo.json),
// img_sky_<slug> (a real GLB from data/ce/_glb, served after a delay so the blocks-first state can be captured first), img_anchors_<slug>.
// The basemap, MapLibre and three.js come from the network as on the phone. Chrome drives through the DevTools protocol (Node's WebSocket).
import worker from "../src/index.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import zlib from "node:zlib";
import { spawn } from "node:child_process";

const arg = (n, d) => { const i = process.argv.indexOf("--" + n); return i > 0 ? process.argv[i + 1] : d; };
const SLUG = arg("district", "jumeirahvillagecircle");
const NAJ = process.env.NAJ_DATA || "C:/Dev/naj-market-pulse/data";
const OUT = arg("out", path.join(process.cwd(), "scratchpad", "v278"));
const CHROME = arg("chrome", "C:/Program Files/Google/Chrome/Application/chrome.exe");
const TILE = arg("tile", path.join(NAJ, "ce", "_glb", "sky_" + SLUG + "_v3_0.merged.glb"));
const TILE_DELAY_MS = +arg("delay", 9000);
fs.mkdirSync(OUT, { recursive: true });

// ---- the worker with a stubbed KV ------------------------------------------------------------------------------------------
const READ = "owner_read_key_abcdefghijklmnop";
const store = new Map();
const KV = {
  async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); const ty = typeof t === "string" ? t : t && t.type;
    if (ty === "arrayBuffer") return typeof v === "string" ? new TextEncoder().encode(v).buffer : v;
    if (ty === "json") return JSON.parse(typeof v === "string" ? v : new TextDecoder().decode(v));
    return typeof v === "string" ? v : new TextDecoder().decode(v); },
  async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter(k => k.startsWith(p)).map(name => ({ name })) }; },
};
const env = { MEETINGS: KV, READ_KEY: READ, INGEST_TOKEN: "ING", PUBLIC_ORIGIN: "http://127.0.0.1" };
const toAB = (buf) => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
store.set("img_blocks_" + SLUG, toAB(zlib.gzipSync(fs.readFileSync(path.join(NAJ, "ce", SLUG, "blocks.json")))));
store.set("img_ct_blocks_" + SLUG, "application/json");
store.set("img_districts_geo", fs.readFileSync(path.join(NAJ, "board", "districts_geo.json"), "utf8"));
store.set("img_ct_districts_geo", "application/json");
if (fs.existsSync(path.join(NAJ, "names", "anchors_" + SLUG + ".json"))) { store.set("img_anchors_" + SLUG, fs.readFileSync(path.join(NAJ, "names", "anchors_" + SLUG + ".json"), "utf8")); store.set("img_ct_anchors_" + SLUG, "application/json"); }
if (fs.existsSync(TILE)) { store.set("img_sky_" + SLUG, toAB(fs.readFileSync(TILE))); store.set("img_ct_sky_" + SLUG, "model/gltf-binary"); console.log("tile: " + TILE + " (" + Math.round(fs.statSync(TILE).size / 1024) + " KB), served after " + TILE_DELAY_MS + " ms"); }
else console.log("no tile at " + TILE + ": the twin will stay on blocks");
const realFetch = globalThis.fetch;
globalThis.fetch = async () => new Response("{}", { status: 404 });   // nothing leaves this machine from the worker

const server = http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const url = "http://127.0.0.1" + req.url;
  if (req.url.startsWith("/img/sky_")) await new Promise((r) => setTimeout(r, TILE_DELAY_MS));
  try {
    const r = await worker.fetch(new Request(url, { method: req.method, headers: req.headers, body: chunks.length ? Buffer.concat(chunks) : undefined }), env, { waitUntil() {} });
    const h = {}; r.headers.forEach((v, k) => { h[k] = v; });
    const body = Buffer.from(await r.arrayBuffer());
    res.writeHead(r.status, h); res.end(body);
  } catch (e) { res.writeHead(500); res.end(String(e && e.stack || e)); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const PORT = server.address().port, ORIGIN = "http://127.0.0.1:" + PORT;
console.log("worker on " + ORIGIN);

// ---- headless Chrome through the DevTools protocol ---------------------------------------------------------------------------
const UDD = fs.mkdtempSync(path.join(os.tmpdir(), "v278chrome_"));
const DBG = 9333 + Math.floor(Math.random() * 400);
const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=" + DBG, "--user-data-dir=" + UDD, "--no-first-run", "--no-default-browser-check",
  "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--hide-scrollbars", "--window-size=390,844", "--lang=en", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets = null;
for (let i = 0; i < 60 && !targets; i++) { try { targets = await (await realFetch("http://127.0.0.1:" + DBG + "/json")).json(); } catch (e) { await sleep(250); } }
if (!Array.isArray(targets)) { console.error("Chrome did not open a debugging port"); process.exit(2); }
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pending = new Map(); const events = [];
ws.onmessage = (m) => { const j = JSON.parse(m.data); if (j.id && pending.has(j.id)) { pending.get(j.id)(j); pending.delete(j.id); } else if (j.method) events.push(j); };
const cdp = (method, params) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
const evalJs = async (expr) => { const r = await cdp("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); return r.result && r.result.result ? r.result.result.value : undefined; };
const waitFor = async (expr, ms, label) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await evalJs(expr); if (v) return v; await sleep(300); } console.log("  (timed out waiting for " + label + ")"); return null; };
const shot = async (name) => { const r = await cdp("Page.captureScreenshot", { format: "png" }); const f = path.join(OUT, name); fs.writeFileSync(f, Buffer.from(r.result.data, "base64")); console.log("wrote " + f); };
await cdp("Page.enable"); await cdp("Runtime.enable"); await cdp("Log.enable");
await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await cdp("Emulation.setUserAgentOverride", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" });
const errors = () => events.filter((e) => e.method === "Runtime.exceptionThrown").map((e) => (e.params.exceptionDetails.exception && e.params.exceptionDetails.exception.description) || e.params.exceptionDetails.text).slice(0, 6);

// ---- 1. /map zoomed into the district: the blocks layer ----------------------------------------------------------------------
console.log("\n/map");
await cdp("Page.navigate", { url: ORIGIN + "/map?key=" + READ });
await waitFor("!!(window.__najmap2&&window.__najmap2.isStyleLoaded&&window.__najmap2.isStyleLoaded())", 40000, "the basemap");
await evalJs("window.__najmap2.jumpTo({center:[55.2085,25.0605],zoom:14.4,pitch:0,bearing:0})");
await waitFor("(function(){var s=window.__tbMap&&window.__tbMap.state();return !!(s&&s['" + SLUG + "']&&s['" + SLUG + "'].state==='on')})()", 40000, "the blocks");
await sleep(1500);   // the oblique ease (700 ms) and the tiles
await waitFor("window.__najmap2.loaded()&&window.__najmap2.areTilesLoaded()", 20000, "the tiles");
await sleep(800);
console.log("  map state: " + JSON.stringify(await evalJs("(function(){var s=window.__tbMap.state();var o={};for(var k in s)o[k]={state:s[k].state,n:s[k].n};return {zoom:window.__najmap2.getZoom(),pitch:window.__najmap2.getPitch(),districts:o,detail:!!document.getElementById('tbdetail')&&!document.getElementById('tbdetail').hidden}})()")));
await shot("map_" + SLUG + "_blocks.png");
await evalJs("window.__najmap2.jumpTo({center:[55.2045,25.0565],zoom:16.2,pitch:55,bearing:20})");
await sleep(2500); await waitFor("window.__najmap2.loaded()&&window.__najmap2.areTilesLoaded()", 20000, "the tiles");
await shot("map_" + SLUG + "_blocks_close.png");
console.log("  page errors: " + JSON.stringify(errors()));
events.length = 0;

// ---- 2. the twin, blocks first, then the tile ------------------------------------------------------------------------------
console.log("\n/skyline/" + SLUG);
const CAM = "&c=55.2045,25.0565&z=16.2&br=20&p=55";
await cdp("Page.navigate", { url: ORIGIN + "/skyline/" + SLUG + "?key=" + READ + CAM });
const t0 = Date.now();
const st = await waitFor("(function(){var s=window.__twinBlocks&&window.__twinBlocks.state();return s&&s.state==='blocks'?s.state:(s&&s.state==='off'?'off:'+s.err:null)})()", 45000, "the blocks");
console.log("  blocks state after " + (Date.now() - t0) + " ms: " + st);
await sleep(1200);
console.log("  twin state: " + JSON.stringify(await evalJs("(function(){var s=window.__twinBlocks.state();return {state:s.state,n:s.n,held:s.held,cam:s.cam,msg:(document.getElementById('msg')||{}).textContent}})()")));
await shot("twin_" + SLUG + "_blocks_first.png");
const handed = await waitFor("(function(){var s=window.__twinBlocks&&window.__twinBlocks.state();return s&&s.state==='handed'})()", 90000, "the tile");
await sleep(2500);
console.log("  after the tile: " + JSON.stringify(await evalJs("(function(){var s=window.__twinBlocks.state();return {state:s.state,held:s.held,delta:s.delta,msg:!!document.getElementById('msg')}})()")));
await shot("twin_" + SLUG + "_detail.png");
console.log("  page errors: " + JSON.stringify(errors()));

ws.close(); chrome.kill(); server.close();
try { fs.rmSync(UDD, { recursive: true, force: true }); } catch (e) {}
console.log("\ndone" + (handed ? "" : " (the tile never landed - the detail screenshot shows the blocks)"));
process.exit(0);
