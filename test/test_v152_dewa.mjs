// v152 - DEWA screens, offline (14 Sep 2026): the private Residents data and page for Kendall and Naj only, and the TWIN "Colour by"
// menu. Through the real worker with KV and fetch stubbed; the twin's colour logic is lifted out of the page and run on stand-in
// buildings. Nothing leaves this machine.
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
  rules: { minResidentialAccounts: 500, minSharePct: 5 }, nationalities: ["India", "Pakistan", "United Arab Emirates", "Bangladesh"],
  communities: [{ comm: 126, name: "ABU HAIL", accounts: 1800, noNationalityPct: 18, mix: [["United Arab Emirates", 29.4], ["India", 21], ["Pakistan", 15], ["Bangladesh", 9]], other: 26, bands: { Pakistan: 10, "United Arab Emirates": 20, Bangladesh: 5, India: 20, Nowhere: 7 }, lon: 55.330144, lat: 25.285091, onMap: true },
    { comm: 914, name: "AL BARSHA SOUTH FOURTH", accounts: 5200, noNationalityPct: 4, mix: [["India", 44], ["Pakistan", 12]], other: 44, bands: { India: 40, Pakistan: 10 }, lon: 55.36, lat: 24.97, onMap: true }],
  outlines: { "126": [[55.33, 25.28], [55.34, 25.28], [55.34, 25.29], [55.33, 25.29]], "914": [[55.3648, 24.9643], [55.3634, 24.964], [55.3633, 24.9643]] } };

// 1. the private push: token, name and shape checked; counts dropped; never under img_
let r = await call("/ingest_private", { method: "POST", body: JSON.stringify({ name: "community_resident_mix", json: mix }) });
ok(r.status === 401, "private push: no token, 401");
r = await call("/ingest_private", { method: "POST", headers: { "X-Azimuth-Ingest": "ING" }, body: JSON.stringify({ name: "building_activity", json: mix }) });
ok(r.status === 400, "private push: an unknown dataset name is refused");
r = await call("/ingest_private", { method: "POST", headers: { "X-Azimuth-Ingest": "ING" }, body: JSON.stringify({ name: "community_resident_mix", json: mix }) });
const pushed = await r.json().catch(() => ({}));
ok(r.status === 200 && pushed.communities === 2 && pushed.outlines === 2, "private push: accepted, two communities and their outlines");
const kept = JSON.parse(store.get("priv_community_resident_mix") || "{}");
ok(!!kept.communities && kept.communities.every(c => !("accounts" in c)) && !JSON.stringify(kept).includes("1800") && !("rules" in kept), "private push: counts are dropped, whatever the push carried");
ok(kept.communities[0].mix[0][1] === 29 && kept.communities[0].bands.Nowhere === undefined && kept.communities[0].bands.India === 20, "private push: shares rounded, only the 5/10/20/40 bands kept");
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
ok(r.status === 200 && page.includes("Residents by nationality") && page.includes("for Kendall and Naj only"), "residents: its own key opens the private page");
ok(r.headers.get("Referrer-Policy") === "no-referrer" && /no-store/.test(r.headers.get("Cache-Control") || "") && /noindex/.test(r.headers.get("X-Robots-Tag") || "") && page.includes('name=referrer content=no-referrer'), "residents: no-store, noindex, and no referrer (the key never leaks to the map tiles)");
ok(!page.includes(READ) && !page.includes(RES) && !/najnav|\/homes|\/find/i.test(page), "residents: neither key is written into the page, and it links to no client page");
const script = (page.match(/<script>\(function\(\)\{([\s\S]*?)\}\)\(\);<\/script>/) || [])[1] || "";
ok(script.length > 1000 && parses("(function(){" + script + "})();", ".js"), "residents: the page script parses");
r = await call("/residents/data?rk=" + RES);
const data = await r.json().catch(() => null);
ok(r.status === 200 && data && data.communities.length === 2 && !JSON.stringify(data).includes('"accounts"') && r.headers.get("Referrer-Policy") === "no-referrer", "residents: the data route serves the cleaned shares to its own key only");

// 3. the TWIN page carries the colour menu, and its module script still parses
r = await call("/skyline/jabalalifirst?key=" + READ);
const sky = await r.text();
ok(r.status === 200 && sky.includes('sel.id="colsel"') && sky.includes("/img/building_activity") && sky.includes("colour by: filling up"), "twin: the page carries the Colour by menu and reads /img/building_activity");
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
ok(!!byId.colsel && byId.colsel.innerHTML.includes("colour by: activity vs Dubai"), "colour: the menu appears once the district has buildings with a record");
const before = JSON.stringify(MESHES.map(m => [].concat(m.material).map(x => [x.color.h, x.emissive.h, x.emissiveIntensity, x.transparent, x.opacity])));
T.applyColour("fill");
ok(MESHES[0].material.color.h === 0xb7d3f6 && MESHES[0].material.transparent === false, "filling up: 40+ a month takes the lightest step of the ramp");
ok([2, 3, 4].every(i => MESHES[i].material.opacity === 0.45 && MESHES[i].material.transparent) && MESHES[1].material.every(x => x.opacity === 0.45), "filling up: buildings with no record for it recede (no band, no duid, no anchor)");
ok(byId.clegend.innerHTML.includes("Filling up") && byId.clegend.innerHTML.includes("Source: DEWA open data via Dubai Data") && /40\+ a month<i>1<\/i>/.test(byId.clegend.innerHTML) && /no record<i>3<\/i>/.test(byId.clegend.innerHTML), "filling up: the legend names the look, counts each band and the buildings with no record, and credits the source");
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
