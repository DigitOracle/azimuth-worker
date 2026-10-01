// v278 - TWIN BLOCKS (Kendall, 1 Oct 2026): "Why can't I stay in that format with the blocks until I'm ready to zoom in?"
//
// What this proves, through the real worker (worker.fetch, KV stubbed) and, where it is on disk, the REAL JVC blocks file and
// the real JVC anchors (naj-market-pulse data/ce/<slug>/blocks.json, data/names/anchors_<slug>.json):
//   1. the auto-jump is gone: the city of blocks (/skyline?all=1) no longer navigates at the end of a search fly; it arrives
//      and stays (window.__cityArrive), and the explicit link / the zoom-in hand-over carry the camera
//   2. /map serves the blocks layer code (a MapLibre fill-extrusion from /img/blocks_<slug>, the /blocks palette, lazy per
//      district, the Detail pill, the >= 17 zoom hand-over), the served list of districts with blocks is exactly what KV holds,
//      and dots/prices code is untouched
//   3. /skyline/<slug> accepts the camera (c=lon,lat z= br= p=) and serves the blocks-first loader for a district with blocks;
//      a district without blocks is told so (have:false) and the loader stands down; the module mounts it and hands over once
//   4. every inline script on /map, /skyline/<slug> and /skyline?all=1 parses (node --check), and the page scripts are served
//      exactly as written, with no template holes
//   5. the geodesy the pages run: lon/lat -> UTM 40 N agrees with the real anchors to the metre, the inverse round-trips, and the
//      camera carried in the URL survives the trip (zoom -> distance -> zoom)
//   6. src/index.js carries only marked `// v278` edits and one import; all the logic is in src/twin_blocks.js
// NEGATIVE CONTROL: put the auto-jump back in renderCity (the tick line: `if(go)location.href="/skyline/"+go+...`) and run this
// file - checks 1 fail. Verified by doing so (see the v278 commit message).
//
//   node test/test_v278_twin_blocks.mjs
import worker from "../src/index.js";
import { llToUtm40, utm40ToLl, tbDistForZoom, tbZoomForDist, tbCamFromParams, tbCamToQuery, MAP_BLOCKS_JS, TWIN_BLOCKS_JS, CITY_BLOCKS_JS, TB_ZOOM_DETAIL, TB_ZOOM_BLOCKS } from "../src/twin_blocks.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(HERE, "..", "src", "index.js"), "utf8");
const NAJ = process.env.NAJ_DATA || "C:/Dev/naj-market-pulse/data";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };
const parses = (code, ext) => { const f = path.join(os.tmpdir(), "v278_" + Math.random().toString(36).slice(2) + (ext || ".js")); fs.writeFileSync(f, code); try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); return true; } catch (e) { console.log(String(e.stderr || e.message).slice(0, 600)); return false; } finally { try { fs.unlinkSync(f); } catch (e) {} } };

// ---- the worker harness (v186 / v274 / blocks style) --------------------------------------------------------------------------
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
const scripts = (html) => [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter(m => !/\bsrc=/.test(m[1]) && !/importmap/.test(m[1])).map(m => ({ attrs: m[1], code: m[2] }));
const allParse = (html) => { const sc = scripts(html); return sc.length > 0 && sc.every((s) => parses(s.code, /type=.?module/.test(s.attrs) ? ".mjs" : ".js")); };
const cfgOf = (html) => { const m = /window\.__TWIN_BLOCKS_CFG__=(\{[\s\S]*?\});/.exec(html); return m ? JSON.parse(m[1]) : null; };
const haveOf = (html) => { const m = /window\.__BLOCKS_HAVE=(\[[^\]]*\]);/.exec(html); return m ? JSON.parse(m[1]) : null; };

const SLUG = "jumeirahvillagecircle";
const REAL = path.join(NAJ, "ce", SLUG, "blocks.json");
const ANCH = path.join(NAJ, "names", "anchors_" + SLUG + ".json");
const haveReal = fs.existsSync(REAL) && fs.existsSync(ANCH);
if (!haveReal) console.log("  note - the real JVC blocks/anchors are not on this machine: the geodesy is checked on known points only");

// ---- 1. the auto-jump is gone ------------------------------------------------------------------------------------------------
ok(!/if\(go\)location\.href="\/skyline\/"\+go/.test(SRC), "renderCity's tick no longer navigates at the end of a search fly (the auto-jump line is gone)");
ok(/if\(go\)\{if\(window\.__cityArrive\)window\.__cityArrive\(go\);ctl\.autoRotate=true\}/.test(SRC), "a search fly arrives and stays: it lights the district and keeps turning (window.__cityArrive)");
ok(/function tipFor\(ix\)/.test(SRC) && /tip\.innerHTML=tipFor\(ix\)/.test(SRC) && /window\.__cityBlocksMount\(\{D,cam,ctl,labels,tip,tipFor,KEY\}\)/.test(SRC), "the city tip (with its explicit 'open the twin' link) is shared with the arrival, and the city mounts the hand-over");
ok(CITY_BLOCKS_JS.includes("window.__cityArrive=function(slug)") && CITY_BLOCKS_JS.includes('O.tip.innerHTML=O.tipFor(i)'), "__cityArrive shows the district's tip - the link is the explicit way in");
ok(/o\.ctl\.addEventListener\("change"/.test(CITY_BLOCKS_JS) && /if\(d<=HAND\)go\(near\(\)\)/.test(CITY_BLOCKS_JS) && /tbCamToQuery\(cam\)/.test(CITY_BLOCKS_JS), "zooming right in on the city hands over to the district twin with the camera");
ok((SRC.match(/flyTo\([^()]*,true\)/g) || []).length >= 2, "the search and the district picker still fly (flyTo(...,true)) - only the jump at the end went");

// ---- 2. /map serves the blocks layer -----------------------------------------------------------------------------------------
let r = await call("/map?key=" + READ);
let html = await r.text();
ok(r.status === 200 && haveOf(html) !== null && haveOf(html).length === 0, "/map with no blocks on file: the page is served with an empty district list (the layer code stands down)");
ok(allParse(html), "every inline script on /map parses with the blocks layer in it (" + scripts(html).length + ")");
ok(html.includes(MAP_BLOCKS_JS), "the served /map script carries MAP_BLOCKS_JS exactly");
ok(!MAP_BLOCKS_JS.includes("${") && !/<\/script/i.test(MAP_BLOCKS_JS) && !/<\/script/i.test(TWIN_BLOCKS_JS) && !/<\/script/i.test(CITY_BLOCKS_JS), "the page scripts have no template holes and no </script");

const sq = (x, y) => ({ type: "Polygon", coordinates: [[[x, y], [x + 0.0004, y], [x + 0.0004, y + 0.0004], [x, y + 0.0004], [x, y]]] });
const blocksRaw = haveReal ? fs.readFileSync(REAL) : Buffer.from(JSON.stringify({ type: "FeatureCollection", meta: { slug: SLUG, bbox: [55.19, 25.05, 55.22, 25.07] },
  features: [{ type: "Feature", properties: { k: "b", i: 0, h: 38.2, hs: "bldgfacts", n: "B0" }, geometry: sq(55.2, 25.06) }, { type: "Feature", properties: { k: "b", i: 1, h: 12, hs: "unknown" }, geometry: sq(55.201, 25.06) }] }));
store.set("img_blocks_" + SLUG, zlib.gzipSync(blocksRaw).buffer);
store.set("img_ct_blocks_" + SLUG, "application/json");
store.set("img_blocks_palmjumeirah", zlib.gzipSync(blocksRaw).buffer);
store.set("img_sky_" + SLUG, "glb");
store.set("img_sky_dubaimarina", "glb");

r = await call("/map?key=" + CLIENT);
html = await r.text();
ok(r.status === 200 && JSON.stringify(haveOf(html)) === JSON.stringify([SLUG, "palmjumeirah"]), "the served district list is exactly the img_blocks_<slug> keys KV holds (the ct keys do not leak in)", JSON.stringify(haveOf(html)));
ok(/fill-extrusion-height":\["get","h"\]/.test(MAP_BLOCKS_JS) && MAP_BLOCKS_JS.includes('CTX="#E4E4DE",CTX_UNK="#EFEEE8"') && MAP_BLOCKS_JS.includes('["case",["==",["get","u"],1],CTX_UNK,CTX]'), "the layer is a fill-extrusion at the blocks' own heights in the /blocks palette, paler where the height is not known");
ok(MAP_BLOCKS_JS.includes('fetch("/img/blocks_"+s)') && /function load\(s\)/.test(MAP_BLOCKS_JS) && /function unload\(s\)/.test(MAP_BLOCKS_JS) && /hits\(bb,V,2\.5\)\)unload\(s\)/.test(MAP_BLOCKS_JS), "a district's blocks load lazily as the view reaches it and unload when it is far away");
ok(new RegExp("minzoom:ZB").test(MAP_BLOCKS_JS) && MAP_BLOCKS_JS.includes("var ZB=" + TB_ZOOM_BLOCKS + ",ZD=" + TB_ZOOM_DETAIL) && TB_ZOOM_BLOCKS < 13.5 && TB_ZOOM_DETAIL >= 16.5, "blocks draw from district zoom (" + TB_ZOOM_BLOCKS + "); the hand-over waits for zoom " + TB_ZOOM_DETAIL);
ok(/function oblique\(\)/.test(MAP_BLOCKS_JS) && /pitch:\(innerWidth<560&&innerHeight>innerWidth\)\?50:55/.test(MAP_BLOCKS_JS), "the first blocks in view tilt the map oblique (50 on a portrait phone, 55 otherwise)");
ok(/mp\.on\("click","tb-"\+s/.test(MAP_BLOCKS_JS) && /go\(s,p\.i!=null\?"&b="\+encodeURIComponent\(p\.i\):""/.test(MAP_BLOCKS_JS), "tapping a block opens the twin at that building (b=<footprint id>)");
ok(/BTN\.id="tbdetail"/.test(MAP_BLOCKS_JS) && /if\(on&&z>=ZD\)\{var s=here\(\);if\(s\)go\(s,""\)\}/.test(MAP_BLOCKS_JS), "a small Detail pill, and zooming past the threshold, are the other two ways in");
ok(/location\.href="\/skyline\/"\+encodeURIComponent\(s\)\+keyQ\(\)\+tbCamToQuery\(cam\)/.test(MAP_BLOCKS_JS), "the hand-over URL carries the key and the camera (c,z,br,p)");
ok(/map\.addLayer\(\{id:"home-dot",type:"circle"/.test(SRC) && /map\.addLayer\(\{id:"plot-dot",type:"circle",source:"plots",minzoom:13\.5/.test(SRC) && !/\/\/ v278/.test(SRC.slice(SRC.indexOf("const MAP_CHROME_JS"), SRC.indexOf("const RES_PANEL_JS"))), "the map chrome's own layers (dots, prices, plots) are untouched - MAP_CHROME_JS carries no v278 edit");
ok(!html.includes(READ), "opened with a client key, /map carries no owner key");

// ---- 3. the twin accepts the camera and opens blocks-first --------------------------------------------------------------------
const CAMQ = "&c=55.2093,25.0612&z=15.2&br=35&p=55";
r = await call("/skyline/" + SLUG + "?key=" + CLIENT + CAMQ);
html = await r.text();
let cfg = cfgOf(html);
ok(r.status === 200 && cfg && cfg.slug === SLUG && cfg.have === true, "/skyline/<slug> with the camera in the URL: 200, and the page knows the district has blocks (have:true)", JSON.stringify(cfg));
ok(allParse(html), "every inline script on the twin parses with the blocks-first loader in it (" + scripts(html).length + ")");
ok(html.includes(TWIN_BLOCKS_JS), "the served twin script carries TWIN_BLOCKS_JS exactly");
ok(/window\.__twinBlocksMount\(\{THREE,scene,cam,ctl,ren,msg\}\)/.test(html), "the twin's module mounts the blocks after its controls exist");
ok(/const _tbHold=!!\(window\.__twinBlocks&&window\.__twinBlocks\.tileArrived\(root,THREE,cam,ctl\)\)/.test(html) && /if\(!_tbHold\)\{root\.updateMatrixWorld\(true\)/.test(html), "when the tile lands, onSky asks the blocks to hand over, and keeps her camera instead of the arrival framing when they do");
ok(TWIN_BLOCKS_JS.includes('fetch("/img/blocks_"+CFG.slug)') && /tbCamFromParams\(new URLSearchParams\(location\.search\)\)/.test(TWIN_BLOCKS_JS), "the loader reads /img/blocks_<slug> and the c/z/br/p camera from the URL");
ok(/THREE\.ShapeUtils\.triangulateShape/.test(TWIN_BLOCKS_JS) && TWIN_BLOCKS_JS.includes("var CTX=0xE4E4DE,CTX_UNK=0xEFEEE8") && /flatShading:true/.test(TWIN_BLOCKS_JS), "the blocks are flat-roofed prisms in the /blocks palette, in the twin's own frame");
ok(/S\.group\.parent\.remove\(S\.group\)/.test(TWIN_BLOCKS_JS) && /cam\.position\.x\+=dx;cam\.position\.y\+=dy;cam\.position\.z\+=dz;ctl\.target\.x\+=dx/.test(TWIN_BLOCKS_JS), "tileArrived removes the blocks and carries the camera across by the footprint offset - no jump");
ok(/if\(S\.state==="handed"\)return;/.test(TWIN_BLOCKS_JS), "if the tile beats the blocks, nothing is drawn over it");
ok(/if\(!CFG\.have\|\|!o\|\|!o\.THREE\)\{S\.state="off";return\}/.test(TWIN_BLOCKS_JS), "a district without blocks: the loader stands down and the twin behaves as today");

r = await call("/skyline/dubaimarina?key=" + CLIENT + CAMQ);
html = await r.text();
cfg = cfgOf(html);
ok(r.status === 200 && cfg && cfg.slug === "dubaimarina" && cfg.have === false, "a district with no blocks key is told so (have:false)", JSON.stringify(cfg));
r = await call("/skyline/" + SLUG + "?key=" + CLIENT + "&c=<script>alert(1)</script>&z=abc");
html = await r.text();
ok(r.status === 200 && !/<script>alert/.test(html) && tbCamFromParams(new URLSearchParams("c=<script>alert(1)</script>&z=abc")) === null, "hostile camera parameters never reach the page and never parse as a camera");
ok(!html.includes(READ), "opened with a client key, the twin carries no owner key");

r = await call("/skyline?all=1&key=" + CLIENT);
html = await r.text();
ok(r.status === 200 && html.includes(CITY_BLOCKS_JS) && allParse(html), "/skyline?all=1 (the city of blocks) serves CITY_BLOCKS_JS and every inline script parses (" + scripts(html).length + ")");

// ---- 4. (done above as each page was served) the scripts parse; also the module's own copies ---------------------------------
ok(parses(MAP_BLOCKS_JS) && parses(TWIN_BLOCKS_JS) && parses(CITY_BLOCKS_JS), "MAP_BLOCKS_JS, TWIN_BLOCKS_JS and CITY_BLOCKS_JS parse on their own");

// ---- 5. the geodesy and the camera --------------------------------------------------------------------------------------------
// a known point: the JVC v5 origin (data/ce/jumeirahvillagecircle/origin_v5.json) is UTM 40 N E 319324, N 2772770
const o = llToUtm40(55.2078, 25.0596);
ok(Math.abs(o[0] - 319324) < 400 && Math.abs(o[1] - 2772770) < 400, "lon/lat -> UTM 40 N lands on the JVC origin's block (E " + o[0].toFixed(0) + ", N " + o[1].toFixed(0) + ")");
const rt = utm40ToLl(o[0], o[1]);
ok(Math.abs(rt[0] - 55.2078) < 1e-7 && Math.abs(rt[1] - 25.0596) < 1e-7, "the inverse round-trips to a millimetre");
if (haveReal) {
  const A = JSON.parse(fs.readFileSync(ANCH, "utf8"));
  const ax = A.anchors.filter((a) => a.lon && a.x != null).slice(0, 200);
  const worst = ax.reduce((w, a) => { const u = llToUtm40(a.lon, a.lat); return Math.max(w, Math.hypot(u[0] - a.x, -u[1] - a.z)); }, 0);
  ok(ax.length >= 50 && worst < 1.5, "REAL ANCHORS: " + ax.length + " named buildings' lon/lat -> UTM agree with the anchors' CE-frame x/z within 1.5 m (worst " + worst.toFixed(2) + " m)");
  const gc = A.glb_center, blocks = JSON.parse(blocksRaw.toString("utf8")), bb = blocks.meta.bbox;
  const bc = llToUtm40((bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2);
  ok(Math.hypot(bc[0] - gc[0], -bc[1] - gc[1]) < 900, "REAL FILE: the blocks' bbox centre sits within the district of the anchors' glb_center (" + Math.hypot(bc[0] - gc[0], -bc[1] - gc[1]).toFixed(0) + " m) - the hand-over then measures the exact offset from the tile itself");
}
const z0 = 15.2, lat0 = 25.06, H = 844;
const d = tbDistForZoom(z0, lat0, H);
// 156543.03 x cos(25.06 deg) / 2^15.2 = 3.77 m per CSS px; a phone 844 px tall sees ~3.2 km, so the camera stands ~3.6 km off
ok(Math.abs(tbZoomForDist(d, lat0, H) - z0) < 1e-9 && d > 3300 && d < 3900, "zoom -> camera distance -> zoom round-trips (zoom " + z0 + " over JVC on a phone = " + d.toFixed(0) + " m)");
const cam = tbCamFromParams(new URLSearchParams("c=55.2093,25.0612&z=15.2&br=35&p=55"));
ok(cam && cam.lon === 55.2093 && cam.lat === 25.0612 && cam.zoom === 15.2 && cam.bearing === 35 && cam.pitch === 55, "the camera parameters read back as given");
const q2 = tbCamFromParams(new URLSearchParams(tbCamToQuery(cam).slice(1)));
ok(q2 && Math.abs(q2.lon - cam.lon) < 1e-6 && Math.abs(q2.zoom - cam.zoom) < 0.01 && q2.bearing === 35 && q2.pitch === 55, "and survive the trip through tbCamToQuery");
ok(tbCamFromParams(new URLSearchParams("c=55.2,25.06&z=99&p=-5&br=-30")).zoom === 22 && tbCamFromParams(new URLSearchParams("c=55.2,25.06&z=99&p=-5&br=-30")).pitch === 0 && tbCamFromParams(new URLSearchParams("c=55.2,25.06&br=-30")).bearing === 330, "out-of-range zoom, pitch and bearing are clamped or wrapped, never trusted");
ok(tbCamFromParams(new URLSearchParams("z=15")) === null && tbCamFromParams(new URLSearchParams("c=999,25")) === null, "no centre, or an impossible one: no camera");

// ---- 6. index.js carries only marked edits ------------------------------------------------------------------------------------
const marks = SRC.split("\n").filter((l) => /\/\/ v278/.test(l)).length;
ok(/import \{ MAP_BLOCKS_JS, CITY_BLOCKS_JS, twinBlocksTag, tbHaveList, tbHave \} from "\.\/twin_blocks\.js";/.test(SRC), "src/index.js: one import from twin_blocks.js");
ok(marks >= 12 && marks <= 16, "every index.js edit is marked // v278 (" + marks + " lines)");
ok(!/MAP_BLOCKS_JS[\s\S]{0,40}String\.raw|const TWIN_BLOCKS_JS|const CITY_BLOCKS_JS/.test(SRC), "the page scripts live in twin_blocks.js, not in index.js");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
