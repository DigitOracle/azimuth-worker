// v741 - building names + kind labels in the Building Passports picker (Kendall, 4 Nov 2026): names lead, aliases search, no silent truncation.
import fs from "fs";
import vm from "node:vm";
const B = await import("../src/building_passports.js");
const C = await import("../src/district_communities.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 600)); } };

function el(id) {
  const e = { id, hidden: false, value: "", disabled: false, textContent: "", children: [], options: [], className: "", attrs: {}, _h: "", onclick: null, onchange: null, oninput: null, _l: {},
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k] == null ? null : this.attrs[k]; },
    appendChild(c) { this.children.push(c); if (c.tag === "option") this.options.push(c); if (c.tag === "optgroup") c.children.forEach((o) => this.options.push(o)); c.parent = this; return c; },
    addEventListener(t, f) { this._l[t] = f; }, focus() {}, classList: { toggle() {}, contains() { return false; } },
    querySelector() { return null; }, querySelectorAll(s) { return s === ".pko" ? this.children.filter((c) => c.className && c.className.indexOf("pko") === 0) : []; }, _btn: [] };
  Object.defineProperty(e, "innerHTML", { get() { return this._h; }, set(v) { this._h = v; this.children = []; this.options = []; } });
  return e;
}
const ids = {};
const document = { getElementById(id) { return ids[id] || (ids[id] = el(id)); }, createElement(t) { const e = el(); e.tag = t; return e; },
  querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {}, activeElement: null };
const tick = () => new Promise((r) => setTimeout(r, 0));
const DL = C.withCommunities([{ slug: "naif", name: "Naif", n: 652 }]);
const un = []; for (let i = 0; i < 650; i++) un.push(["naj:plot:118" + (1000 + i), "Plot 118" + (1000 + i) + " · Not freehold · Commercial · 1 building", "x"]);
const D = { slug: "naif", name: "Naif", n: 652,
  groups: [["Sunshine 2", "b", [["naj:plot:1180106", "Sunshine 2 · Plot 1180106 · Not freehold · Commercial", "x", "Sunshine Two Deira Tower"]]],
           ["Buildings with no name on record · Naif", "u", un]],
  vacant: [["naj:plot:1189999", "Plot 1189999 · Empty plot", "x"]] };
const fetch = (u) => Promise.resolve({ json: () => Promise.resolve(u.indexOf("/plot_passport/districts") === 0 ? { districts: DL } : { ok: true, district: D }) });
const body = B.bppBody("k", "", [], [], "https://x", "kendall", Date.parse("2026-11-04T10:00:00Z"));
const main = [...body.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((s) => s.indexOf("bpp_ps") >= 0);
const ctx = { document, location: { search: "?key=k", reload() {} }, fetch, setTimeout, JSON, Object, String, Number, Array, history: { pushState() {}, back() {} } };
vm.createContext(ctx); vm.runInContext(main, ctx); await tick(); await tick();
ids.bpp_d.value = "naif"; ids.bpp_d.onchange(); await tick(); await tick(); await tick();
const labs = () => ids.bpp_b.options.map((o) => o.textContent);
const og = ids.bpp_b.children.filter((c) => c.tag === "optgroup").map((c) => c.label);
ok(og.join("|") === "Named buildings (1)|Built plots with no building name (650)|Empty plots (1)", "unnamed group counted in full (no 400 cap)", og);
ok(labs().some((t) => t === "Sunshine 2 · Plot 1180106 · Not freehold · Commercial"), "name leads once, not doubled", labs().filter((t) => /Sunshine/.test(t)));
ok(labs().some((t) => /^50 more not shown — type a building name or plot number to narrow$/.test(t)), "overflow beyond 600 is said, not silently dropped", labs().filter((t) => /more/.test(t)));
ids.bpp_bp.onclick(); ids.bpp_psq.value = "deira tower"; ids.bpp_psq.oninput();
const rows = ids.bpp_psl.children.filter((c) => c.className.indexOf("pko") === 0);
ok(rows.length === 1 && rows[0].attrs["data-v"] === "naj:plot:1180106", "alias (search-only) finds the building", rows.map((r) => r.textContent));
ids.bpp_psq.value = "1181649"; ids.bpp_psq.oninput();
const r2 = ids.bpp_psl.children.filter((c) => c.className.indexOf("pko") === 0);
ok(r2.length === 1, "a plot past 600 is still found by number", r2.map((r) => r.textContent));
console.log("v741 building names: %d passed, %d failed", pass, fail); if (fail) process.exit(1);
