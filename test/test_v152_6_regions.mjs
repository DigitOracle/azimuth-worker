// v152.6 - residents by region, then country (Kendall, 15 Sep 2026: "continents, then a further breakdown"). The push keeps regions
// (names, whole %, countries only at 1%+, the rest pooled); the MAP/twin panel and the full residents page show region bars that open
// into their countries; data without regions falls back to the named groups.
import worker from "../src/index.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const READ = "client_read_key_in_links_123";
const RES = "residents_private_key_0123456789abcdef";
const store = new Map();
const KV = { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter(k => k.startsWith(p)).map(name => ({ name })) }; } };
globalThis.fetch = async () => new Response("{}", { status: 200 });
const env = { MEETINGS: KV, READ_KEY: READ, INGEST_TOKEN: "ING", RESIDENTS_KEY: RES };
const call = (p, init, e) => worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev" + p, init), e || env, { waitUntil() {} });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const parses = (code, ext) => { const f = path.join(os.tmpdir(), "v1526_" + Math.random().toString(36).slice(2) + ext); fs.writeFileSync(f, code); try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); return true; } catch (e) { console.log(String(e.stderr || e.message).slice(0, 600)); return false; } finally { try { fs.unlinkSync(f); } catch (e) {} } };

const mix = { rules: { minResidentialAccounts: 500, minSharePct: 5, regionCountryMinPct: 1, regionMinAccounts: 20 }, nationalities: ["United Kingdom", "India"],
  communities: [
    { comm: 777, label: "Dubai Hills Estate", official: "Hadaeq Sheikh Mohammed Bin Rashid", accounts: 9100, noNationalityPct: 8, mix: [["United Kingdom", 14], ["Russian Federation", 12], ["India", 7], ["United Arab Emirates", 6]], other: 61, bands: { "United Kingdom": 10, India: 5 },
      regions: [{ name: "Europe", pct: 31.4, countries: [["United Kingdom", 14], ["France", 4], ["Ireland", 1], ["Iceland", 0.4]], others: 4, accounts: 2800 },
        { name: "<b>Arab world</b>", pct: 22, countries: [["United Arab Emirates", 6], ["Egypt", 4]], others: 2 },
        { name: "", pct: 3, countries: [] }, "junk"] },
    { comm: 126, label: "Abu Hail", mix: [["India", 21]], other: 79, bands: { India: 20 } }],
  names: {}, outlines: { "777": [[55.24, 25.1], [55.26, 25.1], [55.26, 25.12]], "126": [[55.33, 25.28], [55.34, 25.28], [55.34, 25.29]] } };
let r = await call("/ingest_private", { method: "POST", headers: { "X-Azimuth-Ingest": "ING" }, body: JSON.stringify({ name: "community_resident_mix", json: mix }) });
ok(r.status === 200, "setup: the push with regions is accepted");
const kept = JSON.parse(store.get("priv_community_resident_mix"));
const dh = kept.communities.find(c => c.comm === "777");
ok(dh.regions.length === 2 && dh.regions[0].name === "Europe" && dh.regions[0].pct === 31 && dh.regions[0].others === 4 && dh.regions[0].countries.map(x => x[0]).join() === "United Kingdom,France,Ireland", "cleaner: regions kept with whole %, an under-1% country is never named, empty or malformed regions dropped");
ok(!JSON.stringify(kept).includes('"accounts"') && !JSON.stringify(kept).includes("2800") && !JSON.stringify(kept).includes("9100") && kept.rules.regionCountryMinPct === 1 && kept.rules.regionMinAccounts === 20, "cleaner: no counts at any level (a region's account count is dropped too); the thresholds stay");
ok(kept.communities.find(c => c.comm === "126").regions.length === 0, "cleaner: a community pushed without regions keeps an empty list");

// the MAP panel's detail: region bars that open into countries
function mk(id, ids) { return { id, innerHTML: "", textContent: "", value: "", style: {}, attrs: {}, handlers: {}, onclick: null, kids: [], hidden: false, classList: { s: new Set(), add(c) { this.s.add(c); }, remove(c) { this.s.delete(c); }, toggle(c, on) { if (on === undefined) on = !this.s.has(c); on ? this.s.add(c) : this.s.delete(c); return on; }, contains(c) { return this.s.has(c); } }, setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }, addEventListener(t, f) { this.handlers[t] = f; },
  querySelector(sel) { if (sel === "#rpx") return this.innerHTML.includes("id=rpx") ? ids.rpx : null; const m = sel.match(/^\.rsub\[data-g="(\d+)"\]$/); if (m) { this._subs = this._subs || {}; return this._subs[m[1]] || (this._subs[m[1]] = Object.assign(mk("", ids), { hidden: true })); } return null; },
  querySelectorAll(sel) { const from = (rx, attr) => { if (this._k === sel + this.innerHTML) return this.kids; this.kids = [...this.innerHTML.matchAll(rx)].map(m => { const b = mk("", ids); b.attrs[attr] = m[1]; return b; }); this._k = sel + this.innerHTML; return this.kids; }; if (sel === "button" && this.id === "rnat") return from(/data-n="([^"]*)"/g, "data-n"); if (sel === ".rrow") return from(/data-c="([^"]*)"/g, "data-c"); if (sel === ".rreg") return from(/class="rbar rreg" data-g="(\d+)"/g, "data-g"); return []; } }; }
r = await call("/map?key=" + READ + "&rk=" + RES);
const page = await r.text();
const script = (page.match(/<script>\(function\(\)\{([\s\S]*)\}\)\(\);<\/script><\/body><\/html>$/) || [])[1] || "";
ok(parses("(function(){" + script + "})();", ".js"), "MAP private: the page script parses with the region view");
const ids = {}, pwin = { __stackOpen() {} };
["rp", "rh", "rres", "rnat", "rlist", "rlh", "rmin", "rq", "rleg", "rclear", "rfull", "panel", "hint", "rpx"].forEach(k => ids[k] = mk(k, ids));
const M = { src: null, vis: {} };
const mapStub = { getStyle: () => ({ layers: [{ id: "l", type: "symbol", layout: { "text-font": ["F"] } }] }), addSource: () => {}, addLayer: (l) => { M.vis[l.id] = "none"; }, getSource: () => ({ setData: (d) => { M.src = d; } }), setLayoutProperty: (id, k, v) => { M.vis[id] = v; }, fitBounds: () => {}, on: () => {}, getLayer: () => null, queryRenderedFeatures: () => [] };
new Function("document", "window", "map", "STYLE_READY", "esc", "maplibregl", "fetch", "location", "innerWidth", "innerHeight", "setInterval", "clearInterval", script.slice(script.indexOf("var RK=")))(
  { body: mk("body", ids), getElementById: (k) => ids[k] || null, querySelectorAll: () => [] }, pwin, mapStub, true, (t) => String(t == null ? "" : t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]),
  { Popup: class { setLngLat() { return this; } setHTML() { return this; } addTo() { return this; } remove() {} } }, (u) => call(String(u)), { href: "" }, 1280, 800, (fn) => { fn(); return 1; }, () => {});
ids.rh.onclick(); for (let i = 0; i < 30; i++) await new Promise(res => setTimeout(res, 5));
ids.rnat.kids[0].onclick(); for (let i = 0; i < 10; i++) await new Promise(res => setTimeout(res, 5));
ids.rlist.querySelectorAll(".rrow").find(x => x.getAttribute("data-c") === "777").onclick(); for (let i = 0; i < 10; i++) await new Promise(res => setTimeout(res, 5));
const det = ids.panel.innerHTML;
ok(det.includes("by region · tap one for its countries") && det.includes('class="rbar rreg" data-g="0"') && det.includes("Europe") && det.includes("31%") && det.includes("&lt;b&gt;Arab world&lt;/b&gt;") && !det.includes("<b>Arab world"), "panel: the detail leads with region bars, names escaped");
ok(/<div class=rsub data-g="0" hidden><div class=rbar><span>United Kingdom<\/span>[\s\S]*France[\s\S]*others in Europe, each under 1%<\/span>/.test(det) && !det.includes("Iceland") && !det.includes("Others, each under 5%"), "panel: each region holds its countries and its pooled rest, closed until tapped; no 5% pool when regions exist");
const regRow = ids.panel.querySelectorAll(".rreg")[0];
regRow.onclick();
ok(ids.panel.querySelector('.rsub[data-g="0"]').hidden === false && regRow.classList.contains("open"), "panel: tapping a region opens its countries");
regRow.onclick();
ok(ids.panel.querySelector('.rsub[data-g="0"]').hidden === true && !regRow.classList.contains("open"), "panel: tapping it again closes them");
pwin.__res.select("126", false); for (let i = 0; i < 10; i++) await new Promise(res => setTimeout(res, 5));   // Abu Hail is not in the UK list: open it the way a tap on the map does
ok(ids.panel.innerHTML.includes("Others, each under 5%") && !ids.panel.innerHTML.includes("by region"), "panel: a community without regions still shows its named groups");

// the full residents page carries the same view
r = await call("/residents?rk=" + RES);
const rp = await r.text();
const rscript = (rp.match(/<script>\(function\(\)\{([\s\S]*?)\}\)\(\);<\/script>/) || [])[1] || "";
ok(parses("(function(){" + rscript + "})();", ".js") && rscript.includes("By region") && rscript.includes("wireRegions($(\"detail\"))") && rp.includes(".sub[hidden]{display:none}"), "residents page: the region view, wired on both detail panels, and closed regions really hide");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
