// v280 - TAP ANY BUILDING, GET ITS CARD (Kendall's go, 1 Oct 2026).
//
// What this proves, through the real worker (worker.fetch, KV stubbed) with the REAL slimmed JVC payload
// (naj-market-pulse data/tapcards/slim/tapcard_jumeirahvillagecircle.json, written by scripts/push_tapcards.py) and the REAL
// JVC blocks file (data/ce/jumeirahvillagecircle/blocks.json), both stored gzipped in KV exactly as /ingest_market stores them:
//   1. the payload: community facts once, no lon/lat/area per row, a centroid checksum per row, under 300 KB gzipped
//   2. the card logic over every JVC row: each of the 1,526 footprints passes its checksum against the footprint the page draws,
//      and lands in its tier's card; the cards say what Kendall asked (building: name, developer, floors, height with
//      "estimate" where the source says so, units, completion; community: the community's facts, labelled as the community's,
//      and the building's own height - never a developer, floors or units); "likely" only under 0.8; fallbacks for no payload,
//      no row, a moved footprint and a community with no facts
//   3. THE THREE TAP PATHS, each by running the page script AS SERVED in a sandbox whose fetch is the worker itself:
//      (a) /blocks: a tap on a grey block and on a gold one upgrades today's card in place; no payload leaves today's card
//      (b) /map: a tap on a block shows the card (with the building page and the hand-over to the twin at b=<i>); a moved
//          footprint falls back to today's name + height
//      (c) the twin's blocks-first state: a tap on the blocks mesh finds the footprint by its triangle and shows the card;
//          a drag, or a tap on the chrome, does nothing
//   4. the client key opens everything (pages, /tapcards/pages) and no page carries the owner key; /tapcards/pages refuses no key
//   5. every inline script on /blocks, /map and /skyline/<slug> parses; index.js carries one import, one marked dispatch and
//      /tapcards/pages on the client surface (CLIENT_PATHS; test_v156 APP_PAGES widened to match)
// NEGATIVE CONTROL: in src/tapcards.js tcModel, change `if (t === "c") {` to `if (false) {` and `if (t === "b") {` to
// `if (t === "b" || t === "c") {` (a community row then shows as a building card) and run this file - 10 checks fail, the
// community checks in 2 and in all three tap paths. Verified 1 Oct 2026 (63 passed, 10 failed), then restored (73 passed).
//
//   node test/test_v280_tapcards.mjs
import worker from "../src/index.js";
import { tcModel, tcHtml, tcCentroid, tcCheck, tcPlain, tcHeight, TAPCARD_JS } from "../src/tapcards.js";
import { BLOCKS_JS } from "../src/blocks_page.js";
import { MAP_BLOCKS_JS, TWIN_BLOCKS_JS } from "../src/twin_blocks.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(HERE, "..", "src", "index.js"), "utf8");
const NAJ = process.env.NAJ_DATA || "C:/Dev/naj-market-pulse/data";
const SLUG = "jumeirahvillagecircle";
const PAY = path.join(NAJ, "tapcards", "slim", "tapcard_" + SLUG + ".json");
const BLK = path.join(NAJ, "ce", SLUG, "blocks.json");
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 500) : "")); } };
const parses = (code, ext) => { const f = path.join(os.tmpdir(), "v280_" + Math.random().toString(36).slice(2) + (ext || ".js")); fs.writeFileSync(f, code); try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); return true; } catch (e) { console.log(String(e.stderr || e.message).slice(0, 600)); return false; } finally { try { fs.unlinkSync(f); } catch (e) {} } };

if (!fs.existsSync(PAY) || !fs.existsSync(BLK)) {
  console.log("  FAIL - the real JVC payload / blocks are not on this machine (" + PAY + "). Run: python scripts/push_tapcards.py " + SLUG + " in naj-market-pulse");
  process.exit(1);
}
const payRaw = fs.readFileSync(PAY), blkRaw = fs.readFileSync(BLK);
const T = JSON.parse(payRaw.toString("utf8")), FC = JSON.parse(blkRaw.toString("utf8"));
const BY = {}; FC.features.forEach((f) => { if (f.properties.k === "b") BY[f.properties.i] = f; });
const TODAY = "2026-10-01";
const card = (i, t) => { const f = BY[i]; return tcModel(t || T, i, f && f.properties, f && f.geometry, TODAY); };
const rowOf = (i) => { const r = T.rows[String(i)]; return Array.isArray(r) ? { t: "c" } : r; };
const textOf = (m) => [m.title].concat((m.lines || []).map((l) => l[1])).join(" | ");

// ---- the worker harness (v186 / v274 / v278 style) ----------------------------------------------------------------------------
const READ = "owner_read_key_abcdefghijklmnop", CLIENT = "client_key_current_abcdefghij";
const ORIGIN = "https://azimuth-2.digitalchemy.workers.dev";
const store = new Map();
const KV = {
  async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); const ty = typeof t === "string" ? t : t && t.type;
    if (ty === "arrayBuffer") { if (typeof v === "string") return new TextEncoder().encode(v).buffer; return v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength); }
    if (ty === "json") return JSON.parse(typeof v === "string" ? v : new TextDecoder().decode(v));
    return typeof v === "string" ? v : new TextDecoder().decode(v); },
  async put(k, v) { store.set(k, v); },
  async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter((k) => k.startsWith(p)).map((name) => ({ name })) }; },
};
globalThis.fetch = async () => new Response("{}", { status: 200 });
const env = { MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: CLIENT, INGEST_TOKEN: "ING", PUBLIC_ORIGIN: ORIGIN };
const call = (p, init) => worker.fetch(new Request(ORIGIN + p, init), env, { waitUntil() {} });
const scripts = (html) => [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter((m) => !/\bsrc=/.test(m[1]) && !/importmap/.test(m[1])).map((m) => ({ attrs: m[1], code: m[2] }));
const allParse = (html) => { const sc = scripts(html); return sc.length > 0 && sc.every((s) => parses(s.code, /type=.?module/.test(s.attrs) ? ".mjs" : ".js")); };
const putGz = (name, raw) => { store.set("img_" + name, new Uint8Array(zlib.gzipSync(raw))); store.set("img_ct_" + name, "application/json"); };
putGz("blocks_" + SLUG, blkRaw);
putGz("tapcard_" + SLUG, payRaw);
store.set("img_stack_" + SLUG, "{}");
store.set("img_unitmix_" + SLUG, JSON.stringify({ buildings_by_id: { "1503": { n: 1 }, "0": { n: 1 } } }));

// ---- 1. the payload -----------------------------------------------------------------------------------------------------------
const gz = zlib.gzipSync(payRaw, { level: 9 }).length;
ok(Object.keys(T.rows).length === 1526 && Object.keys(T.communities).length >= 1 && T.c0 != null, "REAL PAYLOAD: 1,526 JVC footprints, community facts stored once per community (" + Object.keys(T.communities).length + ")");
ok(!/"(lon|lat|area_m2|community_population|match_method)"/.test(payRaw.toString("utf8")), "no row carries lon/lat/area or the repeated community facts");
ok(Object.values(T.rows).every((r) => Array.isArray(r) ? r.length >= 2 && Number.isInteger(r[0]) && Number.isInteger(r[1]) : Array.isArray(r.k) && Number.isInteger(r.k[0])), "every row carries its centroid checksum (integer q-ths of a degree from o)");
ok(gz < 300 * 1024, "gzipped it is " + Math.round(gz / 1024) + " KB (target: under ~300 KB for the largest district)");
const tiers = {}; Object.values(T.rows).forEach((r) => { const t = Array.isArray(r) ? "c" : r.t; tiers[t] = (tiers[t] || 0) + 1; });
ok(tiers.c === 1305 && tiers.b === 210 && tiers.p === 9 && tiers.l === 2, "the tiers the DDA table holds: 1305 community, 210 building, 9 project, 2 plot", JSON.stringify(tiers));
ok(Object.values(T.rows).every((r) => Array.isArray(r) || r.cf == null || r.cf < 0.8), "confidence travels only where it is low (under 0.8)");

// ---- 2. the card logic over every real row -----------------------------------------------------------------------------------
const kinds = {}; let moved = 0;
for (const i of Object.keys(T.rows)) { const m = card(+i); kinds[m.kind] = (kinds[m.kind] || 0) + 1; if (m.why === "moved") moved++; }
ok(moved === 0, "REAL DATA: every one of the 1,526 cards passes its checksum against the footprint the page draws");
ok(kinds.community === 1305 && kinds.building === 210 && kinds.project === 9 && kinds.plot === 2, "and lands in its tier's card", JSON.stringify(kinds));
let maxOff = 0; for (const i of Object.keys(T.rows)) { const c = tcCentroid(BY[i].geometry), r = T.rows[i], k = Array.isArray(r) ? r : r.k; maxOff = Math.max(maxOff, Math.abs((c[0] - T.o[0]) * T.q - k[0]), Math.abs((c[1] - T.o[1]) * T.q - k[1])); }
ok(maxOff <= 1 && T.tol >= 2 && T.tol <= 6, "the page's centroid and the table's agree to " + maxOff.toFixed(2) + " units (~1 m) - the tolerance is " + T.tol);

const amber = card(1503);
ok(amber.kind === "building" && amber.title === "Binghatti Amber", "1503 is a building card: Binghatti Amber", textOf(amber));
ok(/Developer: Binghatti Developers FZE/.test(textOf(amber)) && /24 floors · 78 m tall/.test(textOf(amber)) && /658 units \(68 offices, 18 shops\)/.test(textOf(amber)) && /Completed June 2023/.test(textOf(amber)), "with developer, floors, height, units and completion", textOf(amber));
ok(amber.likely === true && rowOf(1503).cf === 0.68 && /class="tc-lk"[^>]*>likely</.test(tcHtml(amber)), "its match is 0.68: the card says 'likely', in words, and shows no number");
ok(!/0\.68|68%|confidence/i.test(tcHtml(amber)), "the confidence number itself never reaches the card");
const sure = Object.keys(T.rows).map(Number).find((i) => rowOf(i).t === "b" && rowOf(i).cf == null);
ok(sure != null && card(sure).likely === false && !/likely/.test(tcHtml(card(sure))), "a building matched at 0.8 or better carries no 'likely' (" + sure + ")");
const estB = Object.keys(T.rows).map(Number).find((i) => rowOf(i).t === "b" && !rowOf(i).h && /^(community_median|typical_)/.test(BY[i].properties.hs));
ok(estB == null || /an estimate/.test(textOf(card(estB))), "a building whose height is an estimate says so" + (estB == null ? " (none in JVC - checked on the function below)" : " (" + estB + ")"));
ok(/About 16 m tall \(an estimate/.test(tcHeight(16, "typical_villa")) && /About 6 m tall \(an estimate/.test(tcHeight(6, "small_footprint_cap(was community_median 6.0 m)")) && tcHeight(78.2, "bldgfacts") === "78 m tall" && tcHeight(12, "unknown") === "Height not yet known" && tcHeight(12, "typical_villa", 41) === "41 m tall",
  "heights: measured as measured, typical/median/capped as 'an estimate', the 12 m placeholder as not known, a register height first");

const commI = Object.keys(T.rows).map(Number).find((i) => Array.isArray(T.rows[String(i)]) && !BY[i].properties.n);
const comm = card(commI), ctext = textOf(comm);
ok(comm.kind === "community" && comm.title === "Al Barsha South Fourth", "a community-tier footprint (" + commI + ") is a community card, titled with the community's name", ctext);
ok(comm.lines.filter((l) => l[0] === "cm").every((l) => /^(The community: |Bus coverage across the community: )/.test(l[1])) && /The community: home to about 55,200 people, with 3,819 registered buildings and 98,608 registered units./.test(ctext), "its facts are in plain lines, each labelled as the COMMUNITY's", ctext);
ok(comm.lines.filter((l) => l[0] === "cm").length <= 2, "one or two lines of community facts");
ok(/This building: /.test(ctext), "and the building's own height, labelled as this building's", ctext);
ok(!/Developer|floors|units \(|Completed|Building page|likely/.test(ctext + tcHtml(comm)), "a community card never presents a developer, floors, units or completion as the building's own", ctext);
const commNamed = Object.keys(T.rows).map(Number).find((i) => Array.isArray(T.rows[String(i)]) && BY[i].properties.n);
if (commNamed != null) ok(card(commNamed).kind === "community" && card(commNamed).lines[0][1] === "In Al Barsha South Fourth", "a named footprint with only community facts keeps its own name and says which community it is in (" + commNamed + ")");

const proj = card(Object.keys(T.rows).map(Number).find((i) => rowOf(i).t === "p"));
ok(proj.kind === "project" && /The figures below are for the whole project, not this building alone\./.test(textOf(proj)) && /This building: /.test(textOf(proj)), "a project-tier card says its figures are the whole project's", textOf(proj));
const plot = card(Object.keys(T.rows).map(Number).find((i) => rowOf(i).t === "l"));
ok(plot.kind === "plot" && /shares its plot/.test(textOf(plot)) && !/floors/.test(textOf(plot)), "a plot-tier card gives the plot's facts, never a guessed building", textOf(plot));

ok(tcModel(null, 1503, BY[1503].properties, BY[1503].geometry).kind === "fallback" && tcModel(null, 1503).why === "none", "no payload: fallback");
ok(card(999999).kind === "fallback" && card(999999).why === "none", "no row for the footprint: fallback");
const shifted = JSON.parse(JSON.stringify(BY[1503].geometry)); shifted.coordinates[0].forEach((c) => { c[0] += 0.0001; });
ok(tcModel(T, 1503, BY[1503].properties, shifted, TODAY).why === "moved", "a footprint ~10 m from where the card's sat: fallback (the checksum refuses it)");
const T2 = JSON.parse(JSON.stringify(T)); T2.communities = {};
ok(card(commI, T2).why === "nofacts" && card(1503, T2).kind === "building", "a community card with no community facts falls back; a building card does not need them");
ok(tcPlain(BY[1503].properties).title === "Binghatti Amber" && tcPlain({ h: 12, hs: "unknown" }).title === "A building without a name on our map", "the fallback is today's card: the name (or 'without a name') and the height");
const evil = tcHtml({ title: '<img src=x onerror=alert(1)>', lines: [["f", "</script><b>"]] });
ok(!/<img|<\/script>/.test(evil) && (evil.match(/<b>/g) || []).length === 1 && evil.includes("&lt;img src=x") && evil.includes("&lt;/script&gt;&lt;b&gt;"), "names and lines are escaped", evil);

// ---- the sandbox: a page script run as served, its fetch going to the worker ---------------------------------------------------
class El {
  constructor(tag, id) { this.tagName = String(tag || "div").toUpperCase(); this.id = id || ""; this.style = {}; this.attrs = {}; this.children = []; this.hidden = false; this._h = ""; this._q = {}; this.on = {};
    const cl = new Set(); this.classList = { add: (c) => cl.add(c), remove: (c) => cl.delete(c), toggle: (c, f) => (f === undefined ? (cl.has(c) ? cl.delete(c) : cl.add(c)) : f ? cl.add(c) : cl.delete(c)), contains: (c) => cl.has(c) }; }
  set innerHTML(v) { this._h = String(v); this._q = {}; } get innerHTML() { return this._h; }
  set textContent(v) { this._h = String(v); } get textContent() { return this._h; }
  setAttribute(k, v) { this.attrs[k] = v; } getAttribute(k) { return this.attrs[k]; }
  appendChild(c) { this.children.push(c); return c; } remove() {}
  addEventListener(t, f) { (this.on[t] = this.on[t] || []).push(f); }
  getBoundingClientRect() { return { top: 0, left: 0, right: 390, bottom: 60, width: 390, height: 60 }; }
  querySelector(sel) { const cls = sel.replace(/^\./, "");
    if (this._q[sel]) return this._q[sel];
    for (const k in this._q) { const r = this._q[k].querySelector(sel); if (r) return r; }
    if (new RegExp("class=\"?[^\">]*\\b" + cls + "\\b").test(this._h)) return (this._q[sel] = new El("x"));
    return null; }
}
function sandbox(extra) {
  const byId = {}, winL = {};
  const document = { getElementById: (id) => byId[id] || (byId[id] = new El("div", id)), createElement: (t) => new El(t), head: new El("head"), body: new El("body"), querySelectorAll: () => [] };
  const ctx = {
    document, console, Math, JSON, Date, Promise, URLSearchParams, Object, Array, String, Number, isFinite, parseFloat, parseInt, encodeURIComponent, decodeURIComponent, Error, Set, Map,
    innerWidth: 390, innerHeight: 844, devicePixelRatio: 3, location: { href: "", search: "", hash: "" },
    setTimeout: (f, ms) => setTimeout(f, Math.min(ms || 0, 5)), clearTimeout, requestAnimationFrame: () => 0, performance: { now: () => Date.now() },
    addEventListener: (t, f) => { (winL[t] = winL[t] || []).push(f); },
    fetch: async (u) => { const r = await worker.fetch(new Request(ORIGIN + u), env, { waitUntil() {} });
      const b = new Uint8Array(await r.arrayBuffer()); const body = b[0] === 0x1f && b[1] === 0x8b ? zlib.gunzipSync(b) : b;
      return new Response(r.status === 204 ? null : body, { status: r.status, headers: { "Content-Type": r.headers.get("Content-Type") || "" } }); },
  };
  Object.assign(ctx, extra || {});
  ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  ctx.__fire = (t, e) => (winL[t] || []).forEach((f) => f(e));
  return ctx;
}
const until = async (f, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { const v = f(); if (v) return v; await new Promise((r) => setTimeout(r, 15)); } return null; };

// ---- 3a. /blocks ----------------------------------------------------------------------------------------------------------------
let r = await call("/blocks?district=" + SLUG + "&key=" + CLIENT);
let html = await r.text();
ok(r.status === 200 && !html.includes(READ), "/blocks with the client key: 200, and no owner key in the page");
ok(allParse(html), "every inline script on /blocks parses (" + scripts(html).length + ")");
ok(scripts(html).some((s) => s.code === TAPCARD_JS) && scripts(html).findIndex((s) => s.code === TAPCARD_JS) < scripts(html).findIndex((s) => s.code === BLOCKS_JS), "/blocks serves the tap-card client (TAPCARD_JS exactly) before its page script");

class FakeGL { constructor() { this.h = {}; FakeGL.last = this; }
  on(ev, a, b) { const k = typeof a === "string" ? ev + ":" + a : ev; (this.h[k] = this.h[k] || []).push(typeof a === "string" ? b : a); }
  getCanvas() { return { style: {} }; } setFeatureState() {} easeTo() {} jumpTo() {} cameraForBounds() { return null; }
  getZoom() { return 15; } getPitch() { return 50; } getBearing() { return 0; } getCenter() { return { lng: 55.2, lat: 25.06 }; }
  project() { return { x: 0, y: 0 }; } unproject() { return [55.2, 25.06]; } queryRenderedFeatures() { return []; } }
async function blocksSandbox(h) {
  const S = sandbox({ maplibregl: { Map: FakeGL } });
  for (const s of scripts(h)) vm.runInContext(s.code, S);
  await until(() => FakeGL.last && S.__blocksMap);
  (FakeGL.last.h.load || []).forEach((f) => f());
  return S;
}
let S = await blocksSandbox(html);
ok(S.__blocksReady === true && typeof S.__blocksSelect === "function" && typeof S.__tapcards === "object", "the /blocks page script runs as served, its blocks fetched from the worker");
const cb = () => S.document.getElementById("cb").innerHTML;
S.__lastTapcard = null; S.__blocksSelect({ kind: "ctx", i: commI });
ok(/Grey blocks are the other buildings/.test(cb()), "(a) a tap on a grey block shows today's card at once");
await until(() => S.__lastTapcard);
ok(S.__lastTapcard && S.__lastTapcard.kind === "community" && /The community: home to about 55,200 people/.test(cb()) && /This building: /.test(cb()) && !/Developer/.test(cb()), "(a) ...and the community card replaces it: the community's facts, the building's height", cb());
S.__lastTapcard = null; S.__blocksSelect({ kind: "gold", num: 1 });
await until(() => S.__lastTapcard);
ok(/<span class=n>1<\/span><b>Binghatti Amber<\/b>/.test(cb()) && /Developer: Binghatti Developers FZE/.test(cb()) && /likely/.test(cb()), "(a) gold 1 (footprint 1503): its number badge, then the building card - Binghatti Amber, developer, 'likely'", cb());
ok(new RegExp('href="/building/' + SLUG + '/1503\\?key=' + CLIENT + '">Building page').test(cb()), "(a) with the Building page link, carrying the client key", cb());
S.__lastTapcard = null; S.__blocksSelect({ kind: "ctx", i: 892 }); const first = S.__lastTapcard; S.__blocksSelect({ kind: "ctx", i: commI });
await until(() => S.__lastTapcard && /The community/.test(cb()));
ok(first === null && /The community/.test(cb()), "(a) a second tap before the first card lands: the card shown is the second building's");
// no payload: today's card stays
store.delete("img_tapcard_" + SLUG);
S = await blocksSandbox(html);
S.__lastTapcard = null; S.__blocksSelect({ kind: "ctx", i: commI });
await until(() => S.__lastTapcard);
ok(S.__lastTapcard && S.__lastTapcard.why === "none" && /Grey blocks are the other buildings/.test(cb()), "(a) no tap-card file for the district: today's name + height card stands", cb());
putGz("tapcard_" + SLUG, payRaw);

// ---- 3b. /map --------------------------------------------------------------------------------------------------------------------
r = await call("/map?key=" + CLIENT);
html = await r.text();
ok(r.status === 200 && !html.includes(READ), "/map with the client key: 200, and no owner key in the page");
ok(allParse(html), "every inline script on /map parses with the tap card in it (" + scripts(html).length + ")");
ok(html.includes(MAP_BLOCKS_JS) && MAP_BLOCKS_JS.startsWith(TAPCARD_JS), "/map serves the blocks layer with the tap-card client in front of it");
class FakeMap { constructor() { this.h = {}; this.src = {}; this.lay = {}; }
  on(ev, a, b) { const k = typeof a === "string" ? ev + ":" + a : ev; (this.h[k] = this.h[k] || []).push(typeof a === "string" ? b : a); }
  fire(k, e) { (this.h[k] || []).forEach((f) => f(e || {})); }
  isStyleLoaded() { return true; } loaded() { return true; } getZoom() { return 15; } getPitch() { return 55; } getBearing() { return 0; }
  getCenter() { return { lng: 55.2096, lat: 25.0627 }; } getBounds() { return { getWest: () => 55.19, getSouth: () => 25.045, getEast: () => 55.225, getNorth: () => 25.075 }; }
  easeTo() {} getCanvas() { return { style: {} }; } getSource(id) { return this.src[id]; } getLayer(id) { return this.lay[id]; }
  addSource(id, s) { this.src[id] = s; } addLayer(l) { this.lay[l.id] = l; } removeLayer(id) { delete this.lay[id]; } removeSource(id) { delete this.src[id]; } }
async function mapSandbox(payloadOn) {
  const mp = new FakeMap();
  const M = sandbox({ KEY: CLIENT, __BLOCKS_HAVE: [SLUG], __najmap2: mp });
  vm.runInContext(MAP_BLOCKS_JS, M);
  await until(() => mp.h["click:tb-" + SLUG]);
  return { M, mp };
}
let { M, mp } = await mapSandbox();
const mapTap = async (i) => { M.__lastTapcard = null; const f = BY[i]; mp.fire("click:tb-" + SLUG, { features: [{ properties: { i, h: f.properties.h, u: 0, n: f.properties.n || "" }, geometry: f.geometry }] }); mp.fire("click", {}); };
const tcb = () => { const e = M.__tcPanel && M.__tcPanel.el(); return e && !e.hidden ? e.querySelector(".tcbody").innerHTML : ""; };
ok(mp.h["click:tb-" + SLUG] && mp.lay["tb-" + SLUG], "(b) the blocks rise on /map from /img/blocks_" + SLUG + " and a tap handler is on them");
await mapTap(1503);
ok(/<b>Binghatti Amber<\/b>/.test(tcb()) && M.location.href === "", "(b) a tap shows a card at once (no jump to the twin)", tcb());
await until(() => M.__lastTapcard && M.__lastTapcard.kind !== "plain");
ok(M.__lastTapcard.kind === "building" && /Developer: Binghatti Developers FZE/.test(tcb()) && /24 floors · 78 m tall/.test(tcb()) && /likely/.test(tcb()), "(b) ...then the building card: developer, floors, height, 'likely'", tcb());
ok(new RegExp('href="/building/' + SLUG + '/1503\\?key=' + CLIENT).test(tcb()), "(b) with the Building page link, carrying the client key", tcb());
const btn = M.__tcPanel.el().querySelector(".tctw");
ok(btn && typeof btn.onclick === "function", "(b) the card carries 'Open the twin here'");
btn.onclick();
ok(new RegExp("^/skyline/" + SLUG + "\\?key=" + CLIENT + "&c=55\\.2\\d+,25\\.06\\d+&z=[\\d.]+&br=[\\d.]+&p=[\\d.]+&b=1503$").test(M.location.href), "(b) ...which hands over to the twin at that building, with the camera (b=1503)", M.location.href);
({ M, mp } = await mapSandbox());
await mapTap(commI);
await until(() => M.__lastTapcard && M.__lastTapcard.kind !== "plain");
ok(M.__lastTapcard.kind === "community" && /The community: /.test(tcb()) && !/Developer|floors/.test(tcb()) && !/Building page/.test(tcb()), "(b) a community-tier block: the community card, no developer, floors or building page", tcb());
// a moved footprint: the blocks drawn differ from the card's; today's card stands
const movedFc = JSON.parse(blkRaw.toString("utf8")); movedFc.features.forEach((f) => { if (f.properties.i === 1503) f.geometry.coordinates[0].forEach((c) => { c[1] += 0.0002; }); });
putGz("blocks_" + SLUG, Buffer.from(JSON.stringify(movedFc)));
({ M, mp } = await mapSandbox());
M.__lastTapcard = null; mp.fire("click:tb-" + SLUG, { features: [{ properties: { i: 1503 }, geometry: movedFc.features.find((f) => f.properties.i === 1503).geometry }] });
await until(() => M.__lastTapcard && M.__lastTapcard.kind === "fallback");
ok(M.__lastTapcard && M.__lastTapcard.why === "moved" && /<b>Binghatti Amber<\/b>/.test(tcb()) && /78 m tall/.test(tcb()) && !/Developer/.test(tcb()), "(b) a footprint that has moved: the checksum refuses the card; today's name + height stands", tcb());
putGz("blocks_" + SLUG, blkRaw);
mp.fire("click", {}); await new Promise((res) => setTimeout(res, 320)); mp.fire("click", {});
ok(M.__tcPanel.el().hidden === true, "(b) a tap off the blocks puts the card away");

// ---- 3c. the twin's blocks-first state ----------------------------------------------------------------------------------------
r = await call("/skyline/" + SLUG + "?key=" + CLIENT);
html = await r.text();
ok(r.status === 200 && !html.includes(READ), "/skyline/" + SLUG + " with the client key: 200, and no owner key in the page");
ok(allParse(html), "every inline script on the twin parses with the tap card in it (" + scripts(html).length + ")");
const twinSc = scripts(html).find((s) => s.code.includes("window.__TWIN_BLOCKS_CFG__="));
ok(twinSc && twinSc.code.includes(TWIN_BLOCKS_JS) && TWIN_BLOCKS_JS.startsWith(TAPCARD_JS), "the twin serves the blocks-first loader with the tap-card client in front of it");
let HIT = null;
const V3 = class { constructor(x, y, z) { this.x = x || 0; this.y = y || 0; this.z = z || 0; } copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; } set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } };
const THREE = {
  Color: class { constructor(h) { this.r = ((h >> 16) & 255) / 255; this.g = ((h >> 8) & 255) / 255; this.b = (h & 255) / 255; } },
  BufferGeometry: class { setAttribute(n, a) { this[n] = a; } dispose() {} }, Float32BufferAttribute: class { constructor(a, n) { this.array = a; this.itemSize = n; } },
  Vector2: class { constructor(x, y) { this.x = x; this.y = y; } }, Vector3: V3,
  ShapeUtils: { triangulateShape: (sh) => { const t = []; for (let k = 1; k < sh.length - 1; k++) t.push([0, k, k + 1]); return t; } },
  Mesh: class { constructor(g, m) { this.geometry = g; this.material = m; this.position = new V3(); this.rotation = {}; } },
  MeshStandardMaterial: class { dispose() {} }, CircleGeometry: class { dispose() {} },
  Group: class { constructor() { this.children = []; } add(c) { this.children.push(c); } traverse(f) { f(this); this.children.forEach(f); } },
  Box3: class { setFromObject() { this.min = { x: -1500, y: 0, z: -1500 }; this.max = { x: 1500, y: 120, z: 1500 }; return this; } },
  Raycaster: class { setFromCamera() {} intersectObject() { return HIT ? [HIT] : []; } },
};
const canvas = new El("canvas");
const W = sandbox({});
vm.runInContext(twinSc.code, W);
ok(W.__TWIN_BLOCKS_CFG__.have === true && W.__TWIN_BLOCKS_CFG__.key === CLIENT, "the twin is told it has blocks, and keeps the client key for its links");
const o3 = { THREE, scene: { add() {}, fog: null }, cam: { far: 1000, position: new V3(), lookAt() {}, updateProjectionMatrix() {} }, ctl: { target: new V3(), update() {} }, ren: { domElement: canvas }, msg: new El("div") };
W.__twinBlocksMount(o3);
await until(() => W.__twinBlocks.state().state === "blocks");
const st = W.__twinBlocks.state();
ok(st.state === "blocks" && st.spans.length === st.n && st.spans.length > 1500, "(c) the blocks are drawn, with a vertex span per building (" + st.spans.length + ")");
const spanFor = (i) => st.spans.find((s) => s[2] === i);
const tapTwin = (i, opt) => { const sp = spanFor(i); HIT = { faceIndex: sp[0] / 3 + 1 }; W.__lastTapcard = null; const tgt = (opt && opt.target) || canvas, dx = (opt && opt.drag) || 0;
  W.__fire("pointerdown", { clientX: 200, clientY: 400, target: tgt }); W.__fire("pointerup", { clientX: 200 + dx, clientY: 400, target: tgt }); };
const tw = () => { const e = W.__tcPanel && W.__tcPanel.el(); return e && !e.hidden ? e.querySelector(".tcbody").innerHTML : ""; };
HIT = null;
ok(W.__twinBlocks.tapAt(o3, 200, 400) === null, "(c) a tap that hits no block finds no footprint");
HIT = { faceIndex: spanFor(1503)[0] / 3 + 2 };
ok(W.__twinBlocks.tapAt(o3, 200, 400) === 1503, "(c) a hit triangle maps back to its footprint (1503)");
HIT = { faceIndex: spanFor(1503)[1] / 3 };
ok(W.__twinBlocks.tapAt(o3, 200, 400) !== 1503, "(c) ...and the triangle just past it does not");
tapTwin(1503);
await until(() => W.__lastTapcard && W.__lastTapcard.kind !== "plain");
ok(W.__lastTapcard.kind === "building" && /<b>Binghatti Amber<\/b>/.test(tw()) && /Developer: Binghatti Developers FZE/.test(tw()) && /likely/.test(tw()), "(c) a tap on the blocks shows the building card", tw());
ok(new RegExp('href="/building/' + SLUG + '/1503\\?key=' + CLIENT + '"').test(tw()), "(c) with the Building page link, carrying the client key", tw());
tapTwin(commI);
await until(() => W.__lastTapcard && W.__lastTapcard.kind !== "plain");
ok(W.__lastTapcard.kind === "community" && /The community: /.test(tw()) && /This building: /.test(tw()) && !/Developer|floors/.test(tw()), "(c) a community-tier block: the community card", tw());
W.__tcPanel.hide(); tapTwin(1503, { drag: 40 });
await new Promise((res) => setTimeout(res, 60));
ok(W.__lastTapcard === null && W.__tcPanel.el().hidden, "(c) a drag (orbiting the view) shows no card");
tapTwin(1503, { target: new El("button") });
await new Promise((res) => setTimeout(res, 60));
ok(W.__lastTapcard === null && W.__tcPanel.el().hidden, "(c) a tap on the page chrome, not the model, shows no card");
W.__twinBlocks.tileArrived(new THREE.Group(), THREE, o3.cam, o3.ctl);
tapTwin(1503);
await new Promise((res) => setTimeout(res, 60));
ok(W.__lastTapcard === null, "(c) once the detailed tile has landed, the blocks are gone and the twin's own taps take over");

// ---- 4. keys -----------------------------------------------------------------------------------------------------------------
r = await call("/tapcards/pages?district=" + SLUG + "&key=" + CLIENT);
const pj = r.status === 200 ? await r.json() : null;
ok(pj && pj.slug === SLUG && JSON.stringify(pj.ids) === "[0,1503]", "/tapcards/pages with the client key: the footprints with a building page", JSON.stringify(pj));
ok((await call("/tapcards/pages?district=" + SLUG)).status === 401 && (await call("/tapcards/pages?district=" + SLUG + "&key=nope")).status === 401, "/tapcards/pages with no key, or a wrong one: 401");
r = await call("/tapcards/pages?district=" + SLUG + "&key=" + READ);
ok(r.status === 200 && !(await r.text()).includes(READ), "the owner key works too, and the answer never echoes a key");
r = await call("/img/tapcard_" + SLUG);
ok(r.status === 200 && r.headers.get("Content-Type") === "application/json" && r.headers.get("Content-Encoding") === "gzip", "/img/tapcard_" + SLUG + " serves the stored gzip as JSON (keyless, like every /img/ asset - it holds register facts, no keys)");
store.delete("img_stack_" + SLUG);
r = await call("/tapcards/pages?district=" + SLUG + "&key=" + CLIENT);
ok(r.status === 200 && JSON.stringify((await r.json()).ids) === "[]", "no stack on file: no building pages (the building page needs it)");

// ---- 5. index.js -------------------------------------------------------------------------------------------------------------
ok(/import \{ tapcardsRoute \} from "\.\/tapcards\.js";/.test(SRC) && SRC.split("\n").filter((l) => /\/\/ v280/.test(l)).length === 3 && /const CLIENT_PATHS = \[[^\]]*"\/tapcards\/pages"[^\]]*\];\s*\/\/ v280/.test(SRC),
  "src/index.js: one import, one marked dispatch, and /tapcards/pages on the client surface - three lines, each marked // v280; the logic is in src/tapcards.js");
ok(!/\$\{/.test(TAPCARD_JS) && !/<\/script/i.test(TAPCARD_JS) && parses(TAPCARD_JS), "the tap-card client parses on its own, with no template holes and no </script");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
