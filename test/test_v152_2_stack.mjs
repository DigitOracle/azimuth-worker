// v152.2 - the top-right stack, offline (15 Sep 2026): RESIDENTS under HOMES on MAP for the private key only, COLOUR BY as a panel in the
// twin's stack, and the residents key kept on the MAP and TWIN links of a private page and nowhere else. Through the real worker with KV
// and fetch stubbed; the residents panel script runs on a stand-in DOM and map with the worker answering its data call.
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
const ctx = { waitUntil() {} };
const call = (p, init, e) => worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev" + p, init), e || env, ctx);
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const parses = (code, ext) => { const f = path.join(os.tmpdir(), "v1522_" + Math.random().toString(36).slice(2) + ext); fs.writeFileSync(f, code); try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); return true; } catch (e) { console.log(String(e.stderr || e.message).slice(0, 600)); return false; } finally { try { fs.unlinkSync(f); } catch (e) {} } };
const navHrefs = (html) => { const nav = (html.match(/<nav class=nnav>([\s\S]*?)<\/nav>/) || [])[1] || ""; return [...nav.matchAll(/href="([^"]+)"/g)].map(m => m[1]); };

const mix = { generated: "2026-09-14T16:07:09", source: "DEWA customer register via Dubai Data", audience: "Kendall and Naj only.", notes: ["Nationality of the account holder."],
  rules: { minResidentialAccounts: 500, minSharePct: 5 }, nationalities: ["India", "Pakistan", "United Arab Emirates", "Bangladesh"],
  communities: [{ comm: 126, name: "ABU HAIL", label: "Abu Hail", official: "Abu Hail", accounts: 1800, noNationalityPct: 18, mix: [["United Arab Emirates", 29], ["India", 21], ["Pakistan", 15]], other: 35, bands: { Pakistan: 10, "United Arab Emirates": 20, India: 20 }, lon: 55.33, lat: 25.285, onMap: true },
    { comm: 914, name: "AL BARSHA SOUTH FOURTH", label: "Jumeirah Village Circle", official: "Al Barsha South Fourth", known: ["Jumeirah Village Circle", "Al Barsha South Fourth", "JVC"], accounts: 5200, noNationalityPct: 4, mix: [["India", 44], ["Pakistan", 12]], other: 44, bands: { India: 40, Pakistan: 10 }, lon: 55.36, lat: 24.97, onMap: true }],
  names: { "101": { label: "Palm Deira", official: "Nakhlat Deira" } },
  outlines: { "126": [[55.33, 25.28], [55.34, 25.28], [55.34, 25.29], [55.33, 25.29]], "914": [[55.3648, 24.9643], [55.3634, 24.964], [55.3633, 24.9643]], "101": [[55.30, 25.30], [55.31, 25.30], [55.31, 25.31]] } };
let r = await call("/ingest_private", { method: "POST", headers: { "X-Azimuth-Ingest": "ING" }, body: JSON.stringify({ name: "community_resident_mix", json: mix }) });
ok(r.status === 200, "setup: the residents data is pushed");
store.set("img_sky_jltnorth", "glb");

// 1. MAP for a client link: the stack holds HOMES alone, and nothing private is in the page
const clientCases = [["the client key", "/map?key=" + READ], ["a wrong residents key", "/map?key=" + READ + "&rk=wrong_wrong_wrong_wrong_wrong"], ["the client key passed as rk", "/map?key=" + READ + "&rk=" + READ]];
for (const [label, q] of clientCases) {
  r = await call(q);
  const html = await r.text();
  ok(r.status === 200 && html.includes("<div class=hstack id=hstack><div id=hp class=hp>") && !html.includes("id=rp") && !/residents/i.test(html) && !html.includes("rk=") && !html.includes("__RKQ=") && !html.includes(RES) && !r.headers.get("X-Robots-Tag"), "MAP, " + label + ": HOMES alone in the stack, no residents panel, no residents key anywhere");
}
r = await call("/map?key=" + READ + "&rk=" + RES, {}, Object.assign({}, env, { RESIDENTS_KEY: "short" }));
ok(!(await r.text()).includes("id=rp"), "MAP: a short RESIDENTS_KEY on the worker never opens the panel");

// 2. MAP for the private link: RESIDENTS directly under HOMES, headers and nav as a private page
r = await call("/map?key=" + READ + "&rk=" + RES);
const mp = await r.text();
ok(r.status === 200 && /<div id=hp class=hp>[\s\S]*?<\/div><\/div><\/div><div id=rp class="hp rp">/.test(mp) && mp.indexOf("id=rp") > mp.indexOf("id=hp"), "MAP private: RESIDENTS sits directly under HOMES in the same stack");
ok(mp.includes("<b id=rres>pick a nationality</b>") && !/class="hp rp on"/.test(mp), "MAP private: RESIDENTS starts collapsed with its hint, like HOMES");
ok(r.headers.get("Referrer-Policy") === "strict-origin-when-cross-origin" && /noindex/.test(r.headers.get("X-Robots-Tag") || "") && mp.includes("<meta name=referrer content=strict-origin-when-cross-origin>") && !mp.includes("content=no-referrer>"), "MAP private: other sites get the origin only, never the key in the query (the basemap needs a referrer), noindex");
const nav = navHrefs(mp);
ok(nav.length === 9 && nav.filter(h => h.includes("rk=")).map(h => h.split("?")[0]).sort().join() === "/map,/skyline" && nav.filter(h => h.includes("rk=")).every(h => h.includes("&rk=" + encodeURIComponent(RES))), "MAP private: the key rides on the MAP and TWIN tabs only, never to FIND, HOMES, PULSE, PLANS, CHARTS, BOARD or TIME");
ok(!/"accounts"|1800|5200/.test(mp), "MAP private: the page carries no residents data and no counts; it reads them from the private route");
const mscript = (mp.match(/<script>\(function\(\)\{([\s\S]*)\}\)\(\);<\/script><\/body><\/html>$/) || [])[1] || "";
ok(mscript.length > 30000 && parses("(function(){" + mscript + "})();", ".js"), "MAP private: the page script parses");
r = await call("/map?key=" + READ);
ok(parses("(function(){" + (((await r.text()).match(/<script>\(function\(\)\{([\s\S]*)\}\)\(\);<\/script><\/body><\/html>$/) || [])[1] || "") + "})();", ".js"), "MAP client: the page script still parses");

// 3. the residents panel script running: a stand-in DOM and map, the worker answering its data call
const resSrc = mscript.slice(mscript.indexOf("var RK="));
function mk(id) {
  return { id, innerHTML: "", textContent: "", value: "", style: {}, attrs: {}, handlers: {}, onclick: null, kids: [],
    classList: { s: new Set(), add(c) { this.s.add(c); }, remove(c) { this.s.delete(c); }, toggle(c, on) { if (on === undefined) on = !this.s.has(c); on ? this.s.add(c) : this.s.delete(c); return on; }, contains(c) { return this.s.has(c); } },
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }, addEventListener(t, f) { this.handlers[t] = f; },
    querySelector(sel) { if (sel === "#rpx") return this.innerHTML.includes("id=rpx") ? ids.rpx : null; return null; },
    querySelectorAll(sel) {
      const from = (rx, attr) => { if (this._kidsFor === this.innerHTML) return this.kids; const list = [...this.innerHTML.matchAll(rx)].map(m => { const b = mk(""); b.attrs[attr] = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&"); return b; }); this.kids = list; this._kidsFor = this.innerHTML; return list; };   // the same markup gives back the same buttons, as a real DOM would
      if (sel === "button" && this.id === "rnat") return from(/data-n="([^"]*)"/g, "data-n");
      if (sel === ".rrow") return from(/data-c="([^"]*)"/g, "data-c");
      return [];
    } };
}
const ids = {};
["rp", "rh", "rres", "rnat", "rlist", "rlh", "rmin", "rq", "rleg", "rclear", "rfull", "panel", "hint", "rpx"].forEach(k => ids[k] = mk(k));
ids.rres.textContent = "pick a nationality";
const minBtns = [5, 10, 20, 40].map(v => { const b = mk(""); b.attrs["data-m"] = String(v); if (v === 5) b.classList.add("on"); return b; });
const docStub = { body: mk("body"), getElementById: (k) => ids[k] || null, querySelectorAll: (sel) => sel === "#rmin button" ? minBtns : sel === ".hstack .hp.on" ? [] : [] };
const M = { sources: {}, layers: [], vis: {}, fits: [], handlers: {}, qrf: [] };
const mapStub = { getStyle: () => ({ layers: [{ id: "bg", type: "background" }, { id: "place", type: "symbol", layout: { "text-font": ["Noto Sans Regular"] } }] }),
  addSource: (id, s) => { M.sources[id] = s.data; }, addLayer: (l, before) => { M.layers.push([l.id, before, l.layout && l.layout["text-font"]]); M.vis[l.id] = l.layout.visibility; },
  getSource: (id) => ({ setData: (d) => { M.sources[id] = d; } }), setLayoutProperty: (id, k, v) => { M.vis[id] = v; }, fitBounds: (b, o) => M.fits.push([b, o]),
  on: (ev, layer, fn) => { M.handlers[ev + ":" + layer] = fn; }, getLayer: (id) => ["sub-bub", "home-dot"].includes(id) ? { id } : null, queryRenderedFeatures: () => M.qrf, getCanvas: () => ({ style: {} }) };
class Popup { setLngLat() { return this; } setHTML(h) { M.popup = h; return this; } addTo() { return this; } remove() { M.popup = ""; } }
const asked = [];
const escChrome = (t) => String(t == null ? "" : t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const timers = [];
function runPanel(width) {
  const win = { __stackOpen: (p) => { win.opened = p.id; } };
  new Function("document", "window", "map", "STYLE_READY", "esc", "maplibregl", "fetch", "location", "innerWidth", "innerHeight", "setInterval", "clearInterval", resSrc)(
    docStub, win, mapStub, true, escChrome, { Popup }, (u) => { asked.push(String(u)); return call(String(u)); }, { href: "" }, width, 800, (fn) => { timers.push(fn); return timers.length; }, () => {});
  return win;
}
const W = runPanel(1280);
const settle = async () => { for (let i = 0; i < 30; i++) await new Promise(res => setTimeout(res, 5)); };
ok(asked.length === 0 && !M.layers.length, "panel: nothing is fetched or drawn until RESIDENTS is opened");
ids.rh.onclick(); await settle();
ok(ids.rp.classList.contains("on") && W.opened === "rp" && asked.length === 1 && asked[0] === "/residents/data?rk=" + encodeURIComponent(RES), "panel: opening it reads the private route with the key, once");
ok(M.layers.map(l => l[0]).join() === "res-fill,res-line,res-label" && M.layers[0][1] === "place" && M.layers[2][2].join() === "Noto Sans Regular" && Object.values(M.vis).every(v => v === "none"), "panel: shading layers go under the basemap labels, in the basemap's own font, hidden until a nationality is picked");
ok(ids.rnat.kids.length === 4 && ids.rres.textContent === "pick a nationality" && ids.rlh.textContent === "pick at least one nationality", "panel: four nationality chips, none picked, the header still asks");
ids.rnat.kids[0].onclick(); await settle();
ok(ids.rres.textContent === "India · 2 communities" && Object.values(M.vis).every(v => v === "visible") && M.sources.res.features.length === 3, "panel: picking India shades the map and the header says how many communities");
ok(ids.rlist.kids.map(k => k.getAttribute("data-c")).join() === "914,126" && ids.rlist.innerHTML.includes("40%+") && ids.rlist.innerHTML.includes("Al Barsha South Fourth"), "panel: the ranked list, strongest band first, with the official name under the common one");
minBtns[3].onclick(); await settle();
ok(ids.rlist.kids.map(k => k.getAttribute("data-c")).join() === "914" && M.sources.res.features.find(f => f.properties.comm === "126").properties.band === 0, "panel: 40%+ leaves only the community that reaches it, on the map too");
minBtns[0].onclick(); ids.rq.handlers.input({ target: { value: "JVC" } }); await settle();
ok(ids.rlist.kids.length === 1 && M.sources.res.features.filter(f => !f.properties.dim).length === 1, "panel: search by a known name narrows the list and dims the rest of the map");
ids.rq.handlers.input({ target: { value: "" } });
ids.rlist.querySelectorAll(".rrow")[1].onclick(); await settle();
ok(M.fits.length === 1 && M.fits[0][1].padding.bottom === 400 && M.fits[0][0][0][0] === 55.33, "panel: a row flies the map to that community, clear of the bottom panel");
const det = ids.panel.innerHTML;
ok(ids.panel.classList.contains("on") && det.includes("Abu Hail") && det.includes("18% of accounts record no nationality") && det.includes("United Arab Emirates") && det.includes("29%") && det.includes("Other") && !/1800|1,800/.test(det), "panel: the community's detail opens in the map's bottom panel, shares only");
ok(M.sources.res.features.find(f => f.properties.comm === "126").properties.sel === true, "panel: the chosen community takes the gold outline");
M.qrf = [{ layer: { id: "sub-bub" } }];
M.handlers["click:res-fill"]({ point: { x: 1, y: 1 }, features: [{ properties: { comm: "914" } }] });
ok(M.sources.res.features.find(f => f.properties.comm === "126").properties.sel === true, "panel: a tap on a sub-community bubble stays with the map's own panel, not residents");
M.qrf = [];
M.handlers["click:res-fill"]({ point: { x: 1, y: 1 }, features: [{ properties: { comm: "101" } }] }); await settle();
ok(ids.panel.innerHTML.includes("Palm Deira") && ids.panel.innerHTML.includes("Fewer than 500 residential accounts") && M.fits.length === 1, "panel: tapping a community on the map opens it without moving the map; one with no mix says why");
M.handlers["mousemove:res-fill"]({ lngLat: {}, features: [{ properties: { label: "<img src=x>", official: "x" } }] });
ok(M.popup.includes("&lt;img") && !M.popup.includes("<img"), "panel: hover names are escaped");
ids.rclear.onclick(); await settle();
ok(ids.rres.textContent === "pick a nationality" && Object.values(M.vis).every(v => v === "none") && !ids.panel.classList.contains("on") && !ids.rp.classList.contains("on"), "panel: clear hides the shading, closes its detail and folds the panel");
ids.rfull.onclick();

// 4. the twins: private pages keep the key on MAP/TWIN links only; client pages carry none of it
for (const [label, p] of [["district twin", "/skyline/jltnorth"], ["all-Dubai twin", "/skyline?all=1"]]) {
  r = await call(p + (p.includes("?") ? "&" : "?") + "key=" + READ);
  const cl = await r.text();
  ok(r.status === 200 && !cl.includes("rk=") && !cl.includes("__RKQ=") && !cl.includes(RES) && !r.headers.get("X-Robots-Tag"), label + ", client link: no residents key, no private headers");
  r = await call(p + (p.includes("?") ? "&" : "?") + "key=" + READ + "&rk=" + RES);
  const pr = await r.text();
  const nv = navHrefs(pr);
  ok(r.status === 200 && r.headers.get("Referrer-Policy") === "strict-origin-when-cross-origin" && pr.includes("window.__RKQ=") && nv.filter(h => h.includes("rk=")).map(h => h.split("?")[0]).sort().join() === "/map,/skyline", label + ", private link: origin-only referrer, and the key rides on the MAP and TWIN tabs only");
}
r = await call("/skyline/jltnorth?key=" + READ + "&rk=" + RES);
const tw = await r.text();
ok(/href="\/skyline\/jltnorth\?key=[^"]*&rk=/.test(tw) && tw.includes("(window.__RKQ||'')") && tw.includes('+(window.__RKQ||"")'), "district twin, private link: its district links and the map chrome's twin links keep the key");
r = await call("/skyline/jltnorth?key=" + READ);
const tc = await r.text();
ok(tc.includes("<div class=hstack id=hstack>") && tc.includes('p.id="colp";p.className="hp colp"') && tc.includes('<div class=cp id=cp></div>') && !tc.includes("id=rp"), "district twin, client link: the stack is there for COLOUR BY; no residents panel");
const mod = (tc.match(/<script type="module">([\s\S]*?)<\/script><\/body><\/html>/) || [])[1] || "";
ok(mod.length > 20000 && parses(mod, ".mjs"), "district twin: the module script parses");
r = await call("/skyline?all=1&key=" + READ + "&rk=" + RES);
const cityMod = ((await r.text()).match(/<script type="module">([\s\S]*?)<\/script>/) || [])[1] || "";
ok(cityMod.length > 3000 && parses(cityMod, ".mjs") && cityMod.includes('(window.__RKQ||"")'), "all-Dubai twin: the module script parses and its district links keep the key");

// 5. COLOUR BY as a panel in the stack, run on stand-in buildings
class Color { constructor(h) { this.h = typeof h === "string" ? parseInt(h.slice(1), 16) : (h || 0); } copy(o) { this.h = o.h; return this; } clone() { return new Color(this.h); } setHex(h) { this.h = h; return this; } }
const els = {};
const el2 = (id) => { const e = { id, innerHTML: "", textContent: "", title: "", className: "", children: [], parentNode: null,
  classList: { s: new Set(), add(c) { this.s.add(c); }, remove(c) { this.s.delete(c); }, toggle(c, on) { if (on === undefined) on = !this.s.has(c); on ? this.s.add(c) : this.s.delete(c); return on; }, contains(c) { return this.s.has(c); }, has(c) { return this.s.has(c); } },
  appendChild(x) { this.children.push(x); x.parentNode = this; if (x.id) els[x.id] = x; return x; },
  querySelector(sel) { if (sel === "#colh") { els.colh = els.colh || el2("colh"); return els.colh; } return null; },
  querySelectorAll(sel) { if (sel !== "#cseg button") return []; if (!this._btns) this._btns = [...this.innerHTML.matchAll(/data-c="([^"]*)"/g)].map(m => { const b = el2(""); b.attrs = { "data-c": m[1] }; b.getAttribute = (k) => b.attrs[k]; return b; }); return this._btns; } };
  return e; };
els.hstack = el2("hstack"); els.colres = el2("colres"); els.cp = el2("cp");   // the building card's own #cp is on the page
const document2 = { body: el2("body"), getElementById: (id) => els[id] || null, createElement: () => new Proxy(el2(""), { set(t, k, v) { t[k] = v; if (k === "id") els[v] = t; return true; } }) };
const mat = () => ({ color: new Color(0x8A857C), emissive: new Color(0), emissiveIntensity: 0, transparent: false, opacity: 1, map: null, needsUpdate: false });
const MESHES = [{ material: mat() }, { material: mat() }];
const ANCH = { per_building_glb: true, anchors: [{ duid: "DXB-A", meshes: [0] }, { duid: null, meshes: [1] }] };
const BACTJ = { attribution: "Source: DEWA open data via Dubai Data", modes: { fill: { label: "Filling up", bands: ["under 5 a month", "5-15 a month", "15-40 a month", "40+ a month"] }, residents: { label: "r", bands: ["mostly businesses", "mixed", "mostly residents"] }, activity: { label: "a", bands: ["behind Dubai", "in line with Dubai", "ahead of Dubai"] } }, buildings: { "DXB-A": { fill: "40+ a month", residents: "mixed", activity: "ahead of Dubai" } } };
const src = tc.replace(/\r\n/g, "\n");
const a0 = src.indexOf("const CORIG=new Map(),CDIM=new Set();"), a1 = src.indexOf("\n", src.indexOf("function ghost(m,on)") + 1);
const c0 = src.indexOf("const COLBANDS="), c1 = src.indexOf("window.__twinColour=");
const lift = new Function("THREE", "document", "fetch", "setTimeout", "MESHES", "ANCH", "DEVORIG", "MATS", "window",
  src.slice(a0, src.indexOf("\n", a1 + 1)) + "\n" + src.slice(c0, c1) + "\nreturn { applyColour, loadBact, get mode(){return CMODE} };");
const win2 = { __stackOpen: (p) => { win2.opened = p.id; } };
const T = lift({ Color }, document2, async () => new Response(JSON.stringify(BACTJ), { status: 200 }), () => 0, MESHES, ANCH, new Map(), (m) => [m.material], win2);
await T.loadBact(); await new Promise(res => setTimeout(res, 20));
const cp = els.colp;
ok(!!cp && cp.parentNode === els.hstack && cp.className === "hp colp" && !els.colsel && cp.innerHTML.includes("<b id=colres>standard</b>") && cp.querySelectorAll("#cseg button").length === 4, "colour by: a collapsed panel appended to the stack, four looks, no hidden dropdown");
cp.querySelector("#colh").onclick();
ok(cp.classList.contains("on") && win2.opened === "colp", "colour by: its header opens it like HOMES");
cp.querySelectorAll("#cseg button")[3].onclick();
ok(T.mode === "activity" && els.colres.textContent === "Move-ins vs Dubai" && MESHES[0].material.color.h === 0x3987e5 && cp.querySelectorAll("#cseg button")[3].classList.contains("on"), "colour by: choosing move-ins vs Dubai paints the buildings and names the look in the header");
cp.querySelectorAll("#cseg button")[0].onclick();
ok(T.mode === "" && els.colres.textContent === "standard" && MESHES[0].material.color.h === 0x8A857C && MESHES[1].material.opacity === 1, "colour by: standard puts every building back");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
