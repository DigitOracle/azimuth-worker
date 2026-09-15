// v152.3 - the district twin, offline (15 Sep 2026): RESIDENTS drawn on the twin's ground for the private key only, the HOMES filters
// lighting up the buildings whose homes match, COLOUR BY always present (with the reason where a model cannot be coloured), and a
// RESIDENTS tab on private pages. Through the real worker; the page scripts run on stand-in DOM, scene and camera.
import worker from "../src/index.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const READ = "client_read_key_in_links_123";
const RES = "residents_private_key_0123456789abcdef";
const store = new Map();
const KV = {
  async get(k) { return store.has(k) ? store.get(k) : null; },
  async put(k, v) { store.set(k, v); },
  async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter(k => k.startsWith(p)).map(name => ({ name })) }; },
};
globalThis.fetch = async () => new Response("{}", { status: 200 });
const env = { MEETINGS: KV, READ_KEY: READ, INGEST_TOKEN: "ING", RESIDENTS_KEY: RES, WA_ALLOWED: "971565484397", MAILBOXES: "", ADD_TO: "", PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
const call = (p, init, e) => worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev" + p, init), e || env, { waitUntil() {} });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const parses = (code, ext) => { const f = path.join(os.tmpdir(), "v1523_" + Math.random().toString(36).slice(2) + ext); fs.writeFileSync(f, code); try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); return true; } catch (e) { console.log(String(e.stderr || e.message).slice(0, 600)); return false; } finally { try { fs.unlinkSync(f); } catch (e) {} } };
const settle = async () => { for (let i = 0; i < 30; i++) await new Promise(res => setTimeout(res, 5)); };

const mix = { generated: "2026-09-14T16:07:09", source: "DEWA customer register via Dubai Data", rules: { minResidentialAccounts: 500, minSharePct: 5 }, nationalities: ["India", "Pakistan"],
  communities: [{ comm: 126, name: "ABU HAIL", label: "Abu Hail", official: "Abu Hail", accounts: 1800, noNationalityPct: 18, mix: [["India", 21], ["Pakistan", 15]], other: 64, bands: { India: 20, Pakistan: 10 }, lon: 55.33, lat: 25.285, onMap: true },
    { comm: 500, name: "AL THANYAH FIFTH", label: "JLT", official: "Al Thanyah Fifth", known: ["JLT", "Al Thanyah Fifth", "Jumeirah Lake Towers"], noNationalityPct: 9, mix: [["India", 38], ["Pakistan", 9]], other: 53, bands: { India: 20, Pakistan: 5 }, lon: 55.142, lat: 25.071, onMap: true }],
  names: {}, outlines: { "126": [[55.33, 25.28], [55.34, 25.28], [55.34, 25.29], [55.33, 25.29]], "500": [[55.135, 25.065], [55.15, 25.065], [55.15, 25.078], [55.135, 25.078]] } };
let r = await call("/ingest_private", { method: "POST", headers: { "X-Azimuth-Ingest": "ING" }, body: JSON.stringify({ name: "community_resident_mix", json: mix }) });
ok(r.status === 200, "setup: the residents data is pushed");
store.set("img_sky_jltnorth", "glb");

// 1. what each page carries
r = await call("/skyline/jltnorth?key=" + READ);
const client = await r.text();
ok(!client.includes("id=rp") && !client.includes("window.__resTwin=") && !client.includes("var RK=") && !client.includes("/residents") && !client.includes("RESIDENTS</span>"), "client twin: no residents panel, renderer, key, route or tab");
ok(client.includes("window.__onHomes=") && client.includes("function homesFrom(m)") && client.includes("window.__onHomes(m)"), "client twin: HOMES can light up the buildings (that part is for everyone)");
r = await call("/skyline/jltnorth?key=" + READ + "&rk=" + RES);
const priv = await r.text();
ok(/<div id=hp class=hp>[\s\S]*?<\/div><\/div><\/div><div id=rp class="hp rp">/.test(priv) && priv.includes("window.__resTwin=") && priv.includes("var RK=") && priv.includes("#rtip{"), "private twin: RESIDENTS under HOMES in the stack, the ground renderer in the scene script");
const privMod = (priv.match(/<script type="module">([\s\S]*?)<\/script><\/body><\/html>/) || [])[1] || "";
ok(privMod.length > 20000 && parses(privMod, ".mjs"), "private twin: the scene script parses with the renderer in it");
const navP = [...(((priv.match(/<nav class=nnav>([\s\S]*?)<\/nav>/) || [])[1]) || "").matchAll(/href="([^"]+)"/g)].map(m => m[1]);
ok(navP.length === 10 && navP[navP.findIndex(h => h.startsWith("/map")) + 1] === "/residents?rk=" + encodeURIComponent(RES) && priv.includes("<span>RESIDENTS</span>"), "private twin: a RESIDENTS tab right after MAP opens the full residents view");
r = await call("/map?key=" + READ);
ok(!(await r.text()).includes("RESIDENTS</span>"), "client MAP: no RESIDENTS tab");

// 2. the residents panel on the twin: it hands drawing and flying to the scene
function mk(id, ids) {
  return { id, innerHTML: "", textContent: "", value: "", style: {}, attrs: {}, handlers: {}, onclick: null, kids: [],
    classList: { s: new Set(), add(c) { this.s.add(c); }, remove(c) { this.s.delete(c); }, toggle(c, on) { if (on === undefined) on = !this.s.has(c); on ? this.s.add(c) : this.s.delete(c); return on; }, contains(c) { return this.s.has(c); } },
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }, addEventListener(t, f) { this.handlers[t] = f; },
    querySelector(sel) { return sel === "#rpx" && this.innerHTML.includes("id=rpx") ? ids.rpx : null; },
    querySelectorAll(sel) {
      const from = (rx, attr) => { if (this._kidsFor === this.innerHTML) return this.kids; this.kids = [...this.innerHTML.matchAll(rx)].map(m => { const b = mk("", ids); b.attrs[attr] = m[1]; return b; }); this._kidsFor = this.innerHTML; return this.kids; };
      if (sel === "button" && this.id === "rnat") return from(/data-n="([^"]*)"/g, "data-n");
      if (sel === ".rrow") return from(/data-c="([^"]*)"/g, "data-c");
      return [];
    } };
}
const pids = {};
["rp", "rh", "rres", "rnat", "rlist", "rlh", "rmin", "rq", "rleg", "rclear", "rfull", "panel", "hint", "rpx"].forEach(k => pids[k] = mk(k, pids));
const pmin = [5, 10, 20, 40].map(v => { const b = mk("", pids); b.attrs["data-m"] = String(v); return b; });
const pdoc = { body: mk("body", pids), getElementById: (k) => pids[k] || null, querySelectorAll: (sel) => sel === "#rmin button" ? pmin : [] };
const FT = { inits: 0, draws: [], flies: [], cb: null, init(cb) { this.inits++; this.cb = cb; }, draw(fc, v) { this.draws.push([fc.features.length, v, fc.features.find(f => f.properties.comm === "500").properties]); return true; }, fly(comm, bb) { this.flies.push([comm, bb]); return true; } };
const pwin = { __twinDistrict: "jltnorth", __resTwin: FT, __stackOpen() {} };
const s0 = priv.indexOf("var RK="), s1 = priv.indexOf("})();</script>", s0);
new Function("document", "window", "map", "STYLE_READY", "esc", "maplibregl", "fetch", "location", "innerWidth", "innerHeight", "setInterval", "clearInterval", priv.slice(s0, s1))(
  pdoc, pwin, { getStyle() { throw new Error("the twin must not be drawn through the map"); } }, true, (t) => String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]), undefined,
  (u) => call(String(u)), { href: "" }, 1280, 800, (fn) => { fn(); return 1; }, () => {});
pids.rh.onclick(); await settle();
ok(FT.inits === 1 && FT.draws.length >= 1 && FT.draws.at(-1)[1] === false && FT.draws.at(-1)[0] === 2, "twin panel: opening RESIDENTS hands the communities to the scene, hidden until a nationality is picked");
pids.rnat.kids[0].onclick(); await settle();
ok(FT.draws.at(-1)[1] === true && FT.draws.at(-1)[2].band === 20 && pids.rres.textContent === "India · 2 communities", "twin panel: picking India shows the shading on the ground, with bands");
pids.rlist.querySelectorAll(".rrow").find(x => x.getAttribute("data-c") === "500").onclick(); await settle();
ok(FT.flies.length === 1 && FT.flies[0][0] === "500" && pids.panel.innerHTML.includes("JLT") && pids.panel.innerHTML.includes("38%") && FT.draws.at(-1)[2].sel === true, "twin panel: a row flies the camera to the community and opens its detail in the bottom panel");
FT.cb.pick("126"); await settle();
ok(FT.flies.length === 1 && pids.panel.innerHTML.includes("Abu Hail"), "twin panel: a community tapped on the ground opens its detail without moving the camera");

// 3. the ground renderer, on a stand-in scene
let RAYHITS = [];
class V2 { constructor(x, y) { this.x = x; this.y = y; } }
class V3 { constructor(x, y, z) { this.x = x; this.y = y; this.z = z; } }
class Mat { constructor(o) { Object.assign(this, o); const h = o.color; this.color = { hex: h, setHex(x) { this.hex = x; } }; } dispose() {} }
class Mesh { constructor(g, m) { this.geometry = g; this.material = m; this.position = { y: 0 }; this.userData = {}; this.visible = true; } }
const THREE = { Vector2: V2, Vector3: V3, DoubleSide: 2,
  Shape: class { constructor(p) { this.pts = p; } }, ShapeGeometry: class { constructor(s) { this.shape = s; } rotateX(a) { this.rx = a; return this; } },
  BufferGeometry: class { setFromPoints(p) { this.p = p; return this; } }, MeshBasicMaterial: Mat, LineBasicMaterial: Mat, Mesh, LineLoop: class extends Mesh {},
  Group: class { constructor() { this.children = []; this.visible = true; } add(o) { this.children.push(o); } },
  Raycaster: class { setFromCamera() {} intersectObjects(objs) { return RAYHITS.filter(h => objs.includes(h.object)); } } };
const handlers = {};
const twinWin = { __twinMap: { eases: [], easeTo(o) { this.eases.push(o); } } };
const added = [];
const ANCH = { anchors: [{ i: 1, lon: 55.14, lat: 25.07, x: 0, z: 0 }, { i: 2, lon: 55.145, lat: 25.075, x: 500, z: -550 }] };
const tower = new Mesh({}, {});
const gdoc = { body: { appendChild() {} }, createElement: () => ({ style: {}, innerHTML: "", id: "" }) };
let tnow = 1000;
const g0 = priv.indexOf("// ===== v152.3 RESIDENTS on the twin ground (private page) ====="), g1 = priv.indexOf("// ===== v152.3 RESIDENTS on the twin ground - end =====");
const G = new Function("THREE", "scene", "cam", "ANCH", "ROOTREF", "GROUND", "_fit", "_scene", "esc3", "window", "document", "addEventListener", "innerWidth", "innerHeight", "MESHES", "performance", "setTimeout",
  priv.slice(g0, g1) + "\nreturn { RES3 };")(THREE, { add: (o) => added.push(o) }, {}, ANCH, { position: { x: 0, y: 0, z: 0 } }, { position: { y: -1 } }, () => ({}), (lon, lat) => new V3((lon - 55.14) * 100000, 3, (lat - 25.07) * -110000),
  (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]), twinWin, gdoc, (t, f) => { handlers[t] = f; }, 1280, 800, [tower], { now: () => (tnow += 100) }, () => 0);
const ring = (o) => [...mix.outlines[o], mix.outlines[o][0]];
const fc = (props) => ({ type: "FeatureCollection", features: [["126", { band: 20, shown: true, dim: false, sel: false, label: "Abu Hail", official: "Abu Hail" }], ["500", Object.assign({ band: 20, shown: true, dim: false, sel: false, label: "JLT", official: "Al Thanyah Fifth" }, props)]].map(([c, p]) => ({ type: "Feature", geometry: { type: "Polygon", coordinates: [ring(c)] }, properties: Object.assign({ comm: c }, p) })) });
ok(twinWin.__resTwin.draw(fc({}), true) === true && G.RES3.byComm.size === 1 && G.RES3.byComm.has("500") && added.length === 1, "ground: only the communities around this model are built (JLT here, not Abu Hail across the city)");
const e500 = G.RES3.byComm.get("500");
ok(e500.fill.geometry.shape.pts.length === 4 && e500.fill.geometry.rx === -Math.PI / 2 && Math.abs(e500.fill.position.y - 0.2) < 1e-9 && e500.fill.material.depthWrite === false && e500.fill.material.toneMapped === false, "ground: the outline is laid flat just above the ground, closed ring deduplicated, colours not tone-mapped");
ok(e500.fill.material.color.hex === 0xc98500 && e500.fill.material.opacity === 0.38 && e500.line.material.opacity === 0.35, "ground: 20-40% takes the amber band colour");
twinWin.__resTwin.draw(fc({ sel: true, dim: true }), true);
ok(e500.line.material.color.hex === 0xC5A56A && e500.line.material.opacity === 1 && e500.fill.material.opacity === 0.1, "ground: the chosen community gets a solid gold outline; a search miss recedes");
RAYHITS = [{ object: e500.fill }];
handlers.pointermove({ clientX: 100, clientY: 100, pointerType: "mouse", target: { closest: () => null } });
ok(G.RES3.tip && G.RES3.tip.style.display === "block" && G.RES3.tip.innerHTML.includes("JLT") && G.RES3.tip.innerHTML.includes("Al Thanyah Fifth"), "ground: hovering a community names it");
let picked = null; twinWin.__resTwin.init({ pick: (c) => { picked = c; } });
handlers.pointerdown({ clientX: 100, clientY: 100 }); handlers.pointerup({ clientX: 101, clientY: 100, target: { closest: () => null } });
ok(picked === "500", "ground: tapping a community hands it to the panel");
picked = null; RAYHITS = [{ object: e500.fill }, { object: tower }];
handlers.pointerdown({ clientX: 100, clientY: 100 }); handlers.pointerup({ clientX: 100, clientY: 100, target: { closest: () => null } });
ok(picked === null, "ground: a tap on a tower keeps the tower's own panel");
handlers.pointerdown({ clientX: 100, clientY: 100 }); RAYHITS = [{ object: e500.fill }]; handlers.pointerup({ clientX: 100, clientY: 100, target: { closest: (s) => s.includes(".hstack") ? {} : null } });
ok(picked === null, "ground: taps on the stack or panels never reach the ground");
ok(twinWin.__resTwin.fly("500", [[55.135, 25.065], [55.15, 25.078]]) === true && twinWin.__twinMap.eases.length === 1 && Math.abs(twinWin.__twinMap.eases[0].center[0] - 55.1425) < 1e-9 && twinWin.__resTwin.fly("126", [[55.33, 25.28], [55.34, 25.29]]) === false, "ground: flying goes to communities where the model stands only");
twinWin.__resTwin.draw(fc({ label: "<img src=x>" }), true); tnow += 1000;
handlers.pointermove({ clientX: 120, clientY: 100, pointerType: "mouse", target: { closest: () => null } });
ok(!G.RES3.tip.innerHTML.includes("<img") && G.RES3.tip.innerHTML.includes("&lt;img"), "ground: hover names are escaped");
twinWin.__resTwin.draw(fc({}), false);
ok(G.RES3.grp.visible === false, "ground: no nationality picked, nothing drawn");

// 4. HOMES on the buildings, and COLOUR BY always there
class Color { constructor(h) { this.h = typeof h === "string" ? parseInt(h.slice(1), 16) : (h || 0); } copy(o) { this.h = o.h; return this; } clone() { return new Color(this.h); } setHex(h) { this.h = h; return this; } lerp(o, t) { this.h = t >= 0.45 ? 0xABCDEF : this.h; this.lerped = o.h; return this; } }
function liftColour(page, meshes, anch, els) {
  const src = page.replace(/\r\n/g, "\n");
  const a0 = src.indexOf("const CORIG=new Map(),CDIM=new Set();"), a1 = src.indexOf("\n", src.indexOf("function ghost(m,on)") + 1);
  const c0 = src.indexOf("const COLBANDS="), c1 = src.indexOf("window.__twinColour=");
  const el = (id) => { const e = { id, innerHTML: "", textContent: "", title: "", className: "", children: [], parentNode: null,
    classList: { s: new Set(), add(c) { this.s.add(c); }, remove(c) { this.s.delete(c); }, toggle(c, on) { if (on === undefined) on = !this.s.has(c); on ? this.s.add(c) : this.s.delete(c); return on; }, contains(c) { return this.s.has(c); } },
    appendChild(x) { this.children.push(x); x.parentNode = this; if (x.id) els[x.id] = x; return x; }, querySelector() { return { onclick: null }; }, querySelectorAll() { return []; } }; return e; };
  const doc = { body: el("body"), getElementById: (id) => els[id] || null, createElement: () => new Proxy(el(""), { set(t, k, v) { t[k] = v; if (k === "id") els[v] = t; return true; } }) };
  return new Function("THREE", "document", "fetch", "setTimeout", "MESHES", "ANCH", "DEVORIG", "MATS", "window",
    src.slice(a0, src.indexOf("\n", a1 + 1)) + "\n" + src.slice(c0, c1) + "\nreturn { applyColour, loadBact, homesFrom, colourCtl, get homes(){return HOMEN} };")(
    { Color }, doc, async () => new Response(JSON.stringify({ attribution: "Source: DEWA open data via Dubai Data", modes: { activity: { label: "Move-ins", bands: ["behind Dubai", "in line with Dubai", "ahead of Dubai"] } }, buildings: { "DXB-A": { activity: "ahead of Dubai" } } }), { status: 200 }),
    () => 0, meshes, anch, new Map(), (m) => [m.material], {});
}
const els1 = { hstack: { id: "hstack", children: [], appendChild(x) { this.children.push(x); x.parentNode = this; els1[x.id] = x; return x; } } };
const M1 = [{ material: { color: new Color(0x8A857C), emissive: new Color(0), emissiveIntensity: 0, transparent: false, opacity: 1, map: null } }];
const C1 = liftColour(client, M1, { per_building_glb: false, anchors: [] }, els1);
C1.colourCtl("merged");
ok(!!els1.colp && els1.colp.innerHTML.includes("<b id=colres>not in this district</b>") && (els1.colp.innerHTML.match(/ disabled>/g) || []).length === 3 && els1.colp.innerHTML.includes("one merged piece") && !els1.colsel, "colour by: on a merged model the panel still shows, says why, and only standard can be chosen");
const mat = (tex) => ({ color: new Color(0x8A857C), emissive: new Color(0), emissiveIntensity: 0, transparent: false, opacity: 1, map: tex ? {} : null, needsUpdate: false });
const M2 = [{ material: mat() }, { material: mat(true) }, { material: mat() }];
const A2 = { per_building_glb: true, anchors: [{ i: 7, duid: "DXB-A", meshes: [0] }, { i: 8, duid: null, meshes: [1] }, { i: 9, duid: null, meshes: [2] }] };
const els2 = {};
const C2 = liftColour(client, M2, A2, els2);
const snap = () => JSON.stringify(M2.map(m => [m.material.color.h, m.material.emissive.h, m.material.emissiveIntensity, m.material.transparent, m.material.opacity]));
const before = snap();
C2.homesFrom([{ it: { d: "jltnorth", i: 7 } }, { it: { d: "jltnorth", i: 9 } }, { it: { d: "dubaimarina", i: 8 } }, { it: { d: "jltnorth", i: -1 } }]);
ok(C2.homes === 2 && M2[0].material.color.h === 0xC5A56A && M2[0].material.emissive.h === 0xC5A56A && M2[2].material.color.h === 0xC5A56A && M2[1].material.opacity === 0.45 && M2[1].material.transparent === true, "homes: the buildings whose homes match light up gold; a home in another district never counts; the rest recede");
ok(els2.clegend && els2.clegend.innerHTML.includes("Homes in your budget") && /buildings with homes in your budget<i>2<\/i>/.test(els2.clegend.innerHTML) && els2.clegend.classList.contains("on"), "homes: the key says how many buildings match");
await C2.loadBact(); C2.applyColour("activity");
ok(M2[0].material.color.h === 0x3987e5 && M2[2].material.opacity === 1 && M2[2].material.color.h === 0x8A857C && M2[1].material.opacity === 0.45 && els2.clegend.innerHTML.includes("Move-ins vs Dubai") && els2.clegend.innerHTML.includes("buildings with homes in your budget<i>2</i>"), "homes + colour: matches keep their colour look (a match with no record stays plain, not receded), the rest recede, one key for both");
C2.applyColour(""); C2.homesFrom(null);
ok(snap() === before && !els2.clegend.classList.contains("on"), "homes cleared and colours standard: every building is back exactly as it was");
C2.homesFrom([{ it: { d: "jltnorth", i: 7 } }]);
const C3 = liftColour(client, M2, { per_building_glb: false, anchors: A2.anchors }, {});
C3.homesFrom([{ it: { d: "jltnorth", i: 7 } }]);
C2.homesFrom(null);
ok(snap() === before && C3.homes === 0, "homes: a merged model is left alone (its buildings are not separate pieces)");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
