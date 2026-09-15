// v152 - DEWA screens, offline (14 Sep 2026): the private Residents data and page for Kendall and Naj only, and the TWIN "Colour by"
// menu. Through the real worker with KV and fetch stubbed; the residents page script runs on a stand-in DOM with the worker answering its
// data call; the twin's colour logic is lifted out of the page and run on stand-in buildings. Nothing leaves this machine.
import worker from "../src/index.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const READ = "client_read_key_in_links_123";
const RES = "residents_private_key_0123456789abcdef";
const store = new Map();
const KV = {
  async get(k, t) { const v = store.has(k) ? store.get(k) : null; return v; },
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
const parses = (code, ext) => { const f = path.join(os.tmpdir(), "v152_" + Math.random().toString(36).slice(2) + ext); fs.writeFileSync(f, code); try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); return true; } catch (e) { console.log(String(e.stderr || e.message).slice(0, 600)); return false; } finally { try { fs.unlinkSync(f); } catch (e) {} } };

const mix = { generated: "2026-09-14T15:44:24", source: "DEWA customer register via Dubai Data", audience: "Kendall and Naj only.", notes: ["Nationality of the account holder."],
  rules: { minResidentialAccounts: 500, minSharePct: 5, shares: "whole percent, rounded", accounts: "rounded to the nearest 100", filterBands: [5, 10, 20, 40] }, nationalities: ["India", "Pakistan", "United Arab Emirates", "Bangladesh"],
  communities: [{ comm: 126, name: "ABU HAIL", accounts: 1800, noNationalityPct: 18, mix: [["United Arab Emirates", 29.4], ["India", 21], ["Pakistan", 15], ["Bangladesh", 9]], other: 26, bands: { Pakistan: 10, "United Arab Emirates": 20, Bangladesh: 5, India: 20, Nowhere: 7 }, lon: 55.330144, lat: 25.285091, onMap: true },
    { comm: 914, name: "AL BARSHA SOUTH FOURTH", label: "Jumeirah Village Circle", official: "Al Barsha South Fourth", known: ["Jumeirah Village Circle", "Al Barsha South Fourth", "JVC"], accounts: 5200, noNationalityPct: 4, mix: [["India", 44], ["Pakistan", 12]], other: 44, bands: { India: 40, Pakistan: 10 }, lon: 55.36, lat: 24.97, onMap: true }],
  names: { "126": { label: "Abu Hail", official: "Abu Hail" }, "101": { label: "Palm Deira", official: "Nakhlat Deira" } },
  outlines: { "126": [[55.33, 25.28], [55.34, 25.28], [55.34, 25.29], [55.33, 25.29]], "914": [[55.3648, 24.9643], [55.3634, 24.964], [55.3633, 24.9643]], "101": [[55.30, 25.30], [55.31, 25.30], [55.31, 25.31]] } };

// 1. the private push: token, name and shape checked; counts dropped; never under img_
let r = await call("/ingest_private", { method: "POST", body: JSON.stringify({ name: "community_resident_mix", json: mix }) });
ok(r.status === 401, "private push: no token, 401");
r = await call("/ingest_private", { method: "POST", headers: { "X-Azimuth-Ingest": "ING" }, body: JSON.stringify({ name: "building_activity", json: mix }) });
ok(r.status === 400, "private push: an unknown dataset name is refused");
r = await call("/ingest_private", { method: "POST", headers: { "X-Azimuth-Ingest": "ING" }, body: JSON.stringify({ name: "community_resident_mix", json: mix }) });
const pushed = await r.json().catch(() => ({}));
ok(r.status === 200 && pushed.communities === 2 && pushed.outlines === 3, "private push: accepted, two communities and three outlines");
const kept = JSON.parse(store.get("priv_community_resident_mix") || "{}");
ok(!!kept.communities && kept.communities.every(c => !("accounts" in c)) && !JSON.stringify(kept).includes("1800") && !JSON.stringify(kept).includes("5200") && !("accounts" in kept.rules) && kept.rules.minResidentialAccounts === 500, "private push: counts are dropped, whatever the push carried; only the thresholds stay");
ok(kept.communities[0].mix[0][1] === 29 && kept.communities[0].bands.Nowhere === undefined && kept.communities[0].bands.India === 20, "private push: shares rounded, only the 5/10/20/40 bands kept");
ok(kept.communities[1].label === "Jumeirah Village Circle" && kept.communities[1].official === "Al Barsha South Fourth" && kept.communities[1].known.includes("JVC") && kept.names["101"].official === "Nakhlat Deira", "private push: common, official and known names are kept for search");
ok(![...store.keys()].some(k => k.startsWith("img_")), "private push: nothing written under img_");
r = await call("/img/community_resident_mix");
ok(r.status === 404, "the public /img route cannot serve it");

// 2. the private page: only its own key opens it
for (const [label, q, e] of [["no key", "/residents", null], ["wrong key", "/residents?rk=nope", null], ["the client link key", "/residents?rk=" + READ, null], ["key= from a client link", "/residents?key=" + READ, null], ["RESIDENTS_KEY not set", "/residents?rk=" + RES, Object.assign({}, env, { RESIDENTS_KEY: "" })], ["a short RESIDENTS_KEY", "/residents?rk=short", Object.assign({}, env, { RESIDENTS_KEY: "short" })], ["data without the key", "/residents/data?key=" + READ, null]]) {
  r = await call(q, {}, e || env);
  ok(r.status === 404, "residents: " + label + " gets 404");
}
r = await call("/residents?rk=" + RES);
const page = await r.text();
ok(r.status === 200 && page.includes("Residents by community") && page.includes("Private: Kendall and Naj only"), "residents: its own key opens the private page");
ok(r.headers.get("Referrer-Policy") === "no-referrer" && /no-store/.test(r.headers.get("Cache-Control") || "") && /noindex/.test(r.headers.get("X-Robots-Tag") || "") && page.includes('name=referrer content=no-referrer'), "residents: no-store, noindex, and no referrer (the key never leaks to the map tiles)");
ok(/href="\/map\?key=[^"]+&rk=[^"]+">&larr; the map<\/a>/.test(page) && /href="\/skyline\?all=1&key=[^"]+&rk=[^"]+">the twin<\/a>/.test(page) && (page.match(new RegExp(RES, "g")) || []).length === 2 && !/najnav|\/homes|\/find/i.test(page), "residents: the keys appear only in its two ways back, to the private MAP and TWIN; no client page is linked");
ok(page.includes("@media(max-width:760px)") && page.includes("id=grab") && page.includes("#side.max{height:86vh}") && ["#1f5f58", "#2f8a7f", "#58b5a8", "#a9e2da"].every(c => page.includes(c)), "residents: the template's teal ramp, and a bottom sheet on phones");
ok(!/\.accounts\b|toLocaleString/.test(page), "residents: the page has no way to show an account count");
const script = (page.match(/<script>\(function\(\)\{([\s\S]*?)\}\)\(\);<\/script>/) || [])[1] || "";
ok(script.length > 1000 && parses("(function(){" + script + "})();", ".js"), "residents: the page script parses");
r = await call("/residents/data?rk=" + RES);
const data = await r.json().catch(() => null);
ok(r.status === 200 && data && data.communities.length === 2 && !JSON.stringify(data).includes('"accounts"') && r.headers.get("Referrer-Policy") === "no-referrer", "residents: the data route serves the cleaned shares to its own key only");

// 2b. the page running: a stand-in DOM and map, with the worker answering the page's own data call
async function runPage(width) {
  const ids = {};
  const mk = (id) => ({ id, innerHTML: "", textContent: "", style: {}, scrollTop: 7, children: [], attrs: {}, handlers: {}, rows: [], onclick: null,
    classList: { s: new Set(), add(c) { this.s.add(c); }, remove(c) { this.s.delete(c); }, toggle(c, on) { if (on === undefined) on = !this.s.has(c); on ? this.s.add(c) : this.s.delete(c); return on; }, contains(c) { return this.s.has(c); } },
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    appendChild(x) { this.children.push(x); return x; }, addEventListener(t, f) { this.handlers[t] = f; },
    querySelectorAll(sel) { if (sel !== ".row") return []; this.rows = [...this.innerHTML.matchAll(/data-comm="([^"]+)"/g)].map(m => ({ comm: m[1], getAttribute: () => m[1], onclick: null })); return this.rows; } });
  for (const id of ["map", "side", "grab", "source", "detail2", "nats", "mins", "q", "listhead", "list", "legend", "rules", "detail"]) ids[id] = mk(id);
  const doc = { getElementById: (id) => ids[id] || null, createElement: () => mk(""), querySelectorAll: (sel) => sel === "#nats .chip" ? ids.nats.children : sel === "#mins button" ? ids.mins.children : [] };
  const M = { fits: [], handlers: {}, sources: {}, layers: [], asked: [] };
  class FakeMap { constructor(o) { M.opts = o; } addControl() {} on(ev, a, b) { M.handlers[ev + (b ? ":" + a : "")] = b || a; } getStyle() { return { layers: [{ id: "place", type: "symbol", layout: { "text-font": ["Open Sans Regular"] } }] }; }
    addSource(id, s) { M.sources[id] = s.data; } addLayer(l) { M.layers.push(l.id); } getSource(id) { return { setData: (d) => { M.sources[id] = d; } }; } getCanvas() { return { style: {} }; } fitBounds(b, o) { M.fits.push([b, o]); } }
  class Popup { setLngLat() { return this; } setHTML(h) { M.popup = h; return this; } addTo() { return this; } remove() {} }
  const ml = { Map: FakeMap, NavigationControl: class {}, Popup };
  const pageFetch = (u) => { M.asked.push(String(u)); return call(String(u)); };
  new Function("location", "document", "fetch", "window", "maplibregl", "innerWidth", "innerHeight", "(function(){" + script + "})();")({ search: "?rk=" + RES }, doc, pageFetch, { maplibregl: ml }, ml, width, 800);
  for (let i = 0; i < 40 && !ids.list.innerHTML; i++) await new Promise(res => setTimeout(res, 5));
  return { ids, M };
}
const everything = (ids) => Object.values(ids).map(e => e.innerHTML + " " + e.textContent + " " + e.children.map(c => c.textContent).join(" ")).join(" ");
let P = await runPage(1280);
ok(P.M.asked.length === 1 && P.M.asked[0] === "/residents/data?rk=" + encodeURIComponent(RES) && P.ids.source.textContent.includes("Names from the Land Department"), "page: reads its data from the private route with its own key");
ok(P.ids.nats.children.length === 4 && P.ids.nats.children[0].getAttribute("aria-pressed") === "true" && P.ids.nats.children.slice(1).every(b => b.getAttribute("aria-pressed") === "false") && P.ids.mins.children.map(b => b.textContent).join(" ") === "5%+ 10%+ 20%+ 40%+", "page: nationality chips (first one on) and the minimum share buttons");
ok(P.ids.list.rows.map(x => x.comm).join() === "914,126" && /40%\+<\/span>[\s\S]*20-40%<\/span>/.test(P.ids.list.innerHTML) && P.ids.listhead.textContent === "2 communities where India reach 5%+", "page: the list ranks communities by band, strongest first");
ok(P.ids.legend.innerHTML.includes("fewer than 500 accounts: not shown") && P.ids.rules.textContent.startsWith("Communities with at least 500 residential accounts"), "page: legend and rules carry the thresholds from the data");
P.M.handlers.load();
const feats = P.M.sources.comm.features;
ok(P.M.layers.join() === "comm-fill,comm-line,comm-label" && feats.length === 3 && feats.every(f => f.geometry.coordinates[0][0].join() === f.geometry.coordinates[0].slice(-1)[0].join()), "page: the map gets the three layers and closed community outlines");
const f101 = feats.find(f => f.properties.comm === "101");
ok(f101.properties.label === "Palm Deira" && f101.properties.official === "Nakhlat Deira" && f101.properties.shown === false && f101.properties.band === 0, "page: a community with an outline but no mix is named, not shaded");
P.ids.mins.children[3].onclick();
ok(P.ids.list.rows.map(x => x.comm).join() === "914", "page: 40%+ keeps only the communities that reach it");
P.ids.nats.children[1].onclick(); P.ids.mins.children[1].onclick();
ok(P.ids.list.rows.length === 2 && P.ids.listhead.textContent === "2 communities where India or Pakistan reach 10%+", "page: two nationalities at 10%+");
P.ids.q.handlers.input({ target: { value: "JVC" } });
ok(P.ids.list.rows.map(x => x.comm).join() === "914" && P.M.sources.comm.features.filter(f => !f.properties.dim).length === 1, "page: search finds a community by a name it is known by, and dims the rest on the map");
P.ids.q.handlers.input({ target: { value: "" } });
P.M.handlers["click:comm-fill"]({ features: [{ properties: { comm: "126" } }] });
const det = P.ids.detail.innerHTML;
ok(det.includes("ABU HAIL") && det.includes("United Arab Emirates") && det.includes("29%") && det.includes("Other") && det.includes("18% of accounts record no nationality") && det.includes("Account holders, not every resident") && P.ids.detail2.innerHTML === det && P.ids.detail2.style.display === "" && P.M.fits.length === 0, "page: tapping the map opens the detail with bars, and does not move the map");
ok(P.M.sources.comm.features.find(f => f.properties.comm === "126").properties.sel === true, "page: the tapped community takes the gold outline");
P.M.handlers["click:comm-fill"]({ features: [{ properties: { comm: "101" } }] });
ok(P.ids.detail.innerHTML.includes("Palm Deira") && P.ids.detail.innerHTML.includes("Nakhlat Deira") && P.ids.detail.innerHTML.includes("Fewer than 500 residential accounts"), "page: a community with no mix says why");
P.ids.list.rows[0].onclick();
ok(P.M.fits.length === 1 && P.M.fits[0][1].padding === 60, "page: tapping a row flies the map to that community");
ok(!/1800|5200|1,800|5,200/.test(everything(P.ids) + JSON.stringify(P.M.sources)), "page: no account count appears anywhere on it");
P = await runPage(390);
P.M.handlers.load();
P.ids.grab.onclick();
ok(P.ids.side.classList.contains("max") && P.ids.grab.getAttribute("aria-expanded") === "true", "phone: the grab bar lifts the sheet");
P.ids.list.rows[0].onclick();
ok(!P.ids.side.classList.contains("max") && P.ids.side.scrollTop === 0 && P.M.fits[0][1].padding.bottom === Math.round(800 * 0.44) + 20, "phone: a row drops the sheet, shows the detail at its top, and keeps the community above the sheet");
const nasty = JSON.parse(JSON.stringify(mix)); nasty.communities[0].name = '<img src=x onerror=alert(1)>'; nasty.communities[0].mix[0][0] = '"><script>1</script>';
await call("/ingest_private", { method: "POST", headers: { "X-Azimuth-Ingest": "ING" }, body: JSON.stringify({ name: "community_resident_mix", json: nasty }) });
P = await runPage(1280);
P.ids.nats.children[2].onclick();
P.M.handlers.load(); P.M.handlers["click:comm-fill"]({ features: [{ properties: { comm: "126" } }] });
ok(P.ids.list.innerHTML.includes("&lt;img") && !/<img|<script/.test(P.ids.list.innerHTML + P.ids.detail.innerHTML), "page: names from the data are escaped, never run as markup");
await call("/ingest_private", { method: "POST", headers: { "X-Azimuth-Ingest": "ING" }, body: JSON.stringify({ name: "community_resident_mix", json: mix }) });

// 3. the TWIN page carries the colour menu, and its module script still parses
r = await call("/skyline/jabalalifirst?key=" + READ);
const sky = await r.text();
ok(r.status === 200 && sky.includes('sel.id="colsel"') && sky.includes("/img/building_activity") && sky.includes("colour by: filling up") && sky.includes("colour by: move-ins vs Dubai"), "twin: the page carries the Colour by menu and reads /img/building_activity");
const mod = (sky.match(/<script type="module">([\s\S]*?)<\/script><\/body><\/html>/) || [])[1] || "";
ok(mod.length > 20000 && parses(mod, ".mjs"), "twin: the page's module script parses");
ok(!sky.includes("community_resident_mix") && !sky.includes("/residents"), "twin: nothing on it points at the private residents data");

// 4. the colour logic, run on stand-in buildings
class Color { constructor(h) { this.h = typeof h === "string" ? parseInt(h.slice(1), 16) : (h || 0); } copy(o) { this.h = o.h; return this; } clone() { return new Color(this.h); } setHex(h) { this.h = h; return this; } }
const el = () => ({ id: "", innerHTML: "", title: "", children: [], firstChild: null, parentNode: null, classList: { s: new Set(), add(c) { this.s.add(c); }, remove(c) { this.s.delete(c); }, toggle(c, on) { on ? this.s.add(c) : this.s.delete(c); }, has(c) { return this.s.has(c); } }, appendChild(x) { this.children.push(x); x.parentNode = this; return x; } });
const byId = {};
const body = el();
const document = { body, getElementById: (id) => byId[id] || null, createElement: () => { const e = el(); return new Proxy(e, { set(t, k, v) { t[k] = v; if (k === "id") byId[v] = t; return true; } }); } };
const mat = (map) => ({ color: new Color(0x8A857C), emissive: new Color(0), emissiveIntensity: 0, transparent: false, opacity: 1, map: map || null, needsUpdate: false });
const MESHES = [{ material: mat() }, { material: [mat(true), mat()] }, { material: mat() }, { material: mat() }, { material: mat() }];
const ANCH = { per_building_glb: true, anchors: [{ duid: "DXB-A", meshes: [0] }, { duid: "DXB-B", meshes: [1] }, { duid: "DXB-NONE", meshes: [2] }, { duid: null, meshes: [3] }] };   // mesh 4 belongs to no anchor
const BACTJ = { attribution: "Source: DEWA open data via Dubai Data", notes: ["DEWA keeps current accounts only."], modes: { fill: { label: "Filling up", bands: ["under 5 a month", "5-15 a month", "15-40 a month", "40+ a month"] }, residents: { label: "Residents against businesses", bands: ["mostly businesses", "mixed", "mostly residents"] }, activity: { label: "Activity", bands: ["behind Dubai", "in line with Dubai", "ahead of Dubai"] } },
  buildings: { "DXB-A": { fill: "40+ a month", residents: "mostly residents", activity: null }, "DXB-B": { fill: null, residents: "mostly businesses", activity: "ahead of Dubai" } } };
const src = sky.replace(/\r\n/g, "\n");
const a0 = src.indexOf("const CORIG=new Map(),CDIM=new Set();"), a1 = src.indexOf("\n", src.indexOf("function ghost(m,on)") + 1);
const ghostSrc = src.slice(a0, src.indexOf("\n", a1 + 1));
const c0 = src.indexOf("const COLBANDS="), c1 = src.indexOf("window.__twinColour=");
const lift = new Function("THREE", "document", "fetch", "setTimeout", "MESHES", "ANCH", "DEVORIG", "MATS",
  ghostSrc + "\n" + src.slice(c0, c1) + "\nreturn { applyColour, loadBact, ghost, CDIM };");
const DEVORIG = new Map();
const T = lift({ Color }, document, async () => new Response(JSON.stringify(BACTJ), { status: 200 }), (fn) => 0, MESHES, ANCH, DEVORIG, (m) => Array.isArray(m.material) ? m.material : [m.material]);
await T.loadBact(); await new Promise(res => setTimeout(res, 20));
ok(!!byId.colsel && byId.colsel.innerHTML.includes("colour by: move-ins vs Dubai"), "colour: the menu appears once the district has buildings with a record");
const before = JSON.stringify(MESHES.map(m => [].concat(m.material).map(x => [x.color.h, x.emissive.h, x.emissiveIntensity, x.transparent, x.opacity])));
T.applyColour("fill");
ok(MESHES[0].material.color.h === 0xb7d3f6 && MESHES[0].material.transparent === false, "filling up: 40+ a month takes the lightest step of the ramp");
ok([2, 3, 4].every(i => MESHES[i].material.opacity === 0.45 && MESHES[i].material.transparent) && MESHES[1].material.every(x => x.opacity === 0.45), "filling up: buildings with no record for it recede (no band, no duid, no anchor)");
ok(byId.clegend.innerHTML.includes("Filling up") && byId.clegend.innerHTML.includes("Source: DEWA open data via Dubai Data") && /40\+ a month<i>1<\/i>/.test(byId.clegend.innerHTML) && /no record<i>3<\/i>/.test(byId.clegend.innerHTML), "filling up: the legend names the look, counts each band and the buildings with no record, and credits the source");
T.applyColour("activity");
ok(byId.clegend.innerHTML.includes("Move-ins vs Dubai") && MESHES[1].material.every(x => x.opacity === 1), "move-ins vs Dubai: named as the brief asks, and the building with a record comes forward");
T.applyColour("residents");
ok(MESHES[1].material.every(x => x.color.h === 0xd95926) && MESHES[1].material[0].emissiveIntensity === 0.35 && MESHES[0].material.color.h === 0x3987e5, "residents: businesses and residents take the two poles; a photo-textured facade glows more");
T.ghost(MESHES[2], false);
ok(MESHES[2].material.opacity === 0.45, "a developer filter clearing its ghosts keeps the no-record buildings receded");
T.applyColour("");
const after = JSON.stringify(MESHES.map(m => [].concat(m.material).map(x => [x.color.h, x.emissive.h, x.emissiveIntensity, x.transparent, x.opacity])));
ok(after === before && T.CDIM.size === 0 && !byId.clegend.classList.has("on"), "standard colours: every building is back exactly as it was, legend hidden");
T.ghost(MESHES[2], false);
ok(MESHES[2].material.opacity === 1 && MESHES[2].material.transparent === false, "after going back, a developer filter restores full opacity, not the receded look");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
