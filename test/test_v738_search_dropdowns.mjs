// v738 - searchable pickers on Momo Building Passports (Kendall, 4 Nov 2026): "we need search in each of the drop downs".
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

const DL = C.withCommunities([{ slug: "damachills", name: "Al Hebiah Third", n: 3 }, { slug: "businessbay", name: "Business Bay", n: 2 }, { slug: "alqusais", name: "Al Qusais", n: 1 }]);
const D = { slug: "damachills", name: "Al Hebiah Third", n: 3,
  groups: [["Golf Promenade - 2", "b", [["naj:plot:6731001", "Plot 673-1001 · Freehold · Residential"], ["naj:plot:6731002", "Plot 673-1002 · Freehold · Residential"]]], ["Akoya Park", "b", [["naj:plot:6731003", "Plot 673-1003"]]], ["No registered name", "u", [["naj:plot:6731004", "Plot 673-1004 · Built"]]]],
  vacant: [["naj:plot:6731009", "Plot 673-1009 · Empty plot"]] };
let posted = null;
const fetch = (u, o) => { if (o && o.method === "POST") { posted = JSON.parse(o.body); return Promise.resolve({ json: () => Promise.resolve({ ok: true }) }); }
  return Promise.resolve({ json: () => Promise.resolve(u.indexOf("/plot_passport/districts") === 0 ? { districts: DL } : { ok: true, district: D }) }); };

const body = B.bppBody("k", "", [], [], "https://x", "kendall", Date.parse("2026-11-04T10:00:00Z"));
ok(/<select id=bpp_d hidden/.test(body) && /<select id=bpp_b disabled hidden/.test(body), "native selects hidden (value store only)");
ok(/<button type=button class=pk id=bpp_dp/.test(body) && /<button type=button class=pk id=bpp_bp/.test(body), "picker buttons for district and building");
ok(/id=bpp_ps hidden role=dialog/.test(body) && body.indexOf("id=bpp_pst") < body.indexOf("id=bpp_psq") && body.indexOf("id=bpp_psq") < body.indexOf("id=bpp_psl"), "search box is the first row, above the list");
ok(/placeholder="Type to search&#8230;"/.test(body), "Type to search placeholder");
ok(/\.pkl\{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch/.test(body) && /\.pkp\{[^}]*height:78vh/.test(body), "list scrolls inside a fixed-height panel");
ok(/\.pko\{[^}]*min-height:48px/.test(body) && /#bpp_psq\{[^}]*16px/.test(body), "48 px tap targets; 16 px input (no iOS zoom)");
const main = [...body.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((s) => s.indexOf("bpp_ps") >= 0);
let hist = 0;
const ctx = { document, location: { search: "?key=k", reload() {} }, fetch, setTimeout, JSON, Object, String, Number, Array, history: { pushState() { hist++; }, back() { hist--; } } };
vm.createContext(ctx); vm.runInContext(main, ctx); await tick(); await tick();
const rows = () => ids.bpp_psl.children.filter((c) => c.className.indexOf("pko") === 0);
const heads = () => ids.bpp_psl.children.filter((c) => c.className === "pkg").map((c) => c.textContent);
const type = (v) => { ids.bpp_psq.value = v; ids.bpp_psq.oninput(); };

// district picker
ids.bpp_dp.onclick();
ok(ids.bpp_ps.hidden === false && ids.bpp_pss.hidden === false && hist === 1, "tap opens the panel (and a history entry for back)");
ok(rows().length === 3 && heads()[0] === "Districts (3)", "all districts listed with a count", heads());
type("dam");
ok(rows().length === 1 && rows()[0].attrs["data-v"] === "damachills", "filter as you type: dam", rows().map((r) => r.textContent));
type("damac");
ok(rows().length === 1 && /^DAMAC Hills \(Al Hebiah Third\)/.test(rows()[0].textContent), "damac finds DAMAC Hills (Al Hebiah Third)", rows().map((r) => r.textContent));
type("BUSI");
ok(rows().length === 1 && rows()[0].attrs["data-v"] === "businessbay", "case-insensitive");
type("qus");
ok(rows().length === 1 && rows()[0].attrs["data-v"] === "alqusais", "matches anywhere in the label");
type("zzz");
ok(rows().length === 0 && /Nothing matches/.test(ids.bpp_psl.children.map((c) => c.textContent).join(" ")), "nothing-matches line");
ids.bpp_ps._l.keydown({ key: "Escape", preventDefault() {} });
ok(ids.bpp_ps.hidden === true && hist === 0, "Esc closes (and pops the history entry)");
ids.bpp_dp.onclick(); type("damac");
ids.bpp_ps._l.keydown({ key: "Enter", preventDefault() {} });
document.activeElement = ids.bpp_psq; ids.bpp_ps._l.keydown({ key: "Enter", preventDefault() {} });
await tick(); await tick();
ok(ids.bpp_d.value === "damachills" && ids.bpp_ps.hidden === true, "Enter picks the first match; district value set", ids.bpp_d.value);
ok(ids.bpp_b.options.length > 1 && ids.bpp_bp.disabled === false, "buildings load, building picker enabled");

// building picker
ids.bpp_bp.onclick();
ok(heads().join("|") === "Named buildings (3)|Built plots with no building name (1)|Empty plots (1)", "grouped sections with counts", heads());
type("golf prom");
ok(rows().length === 2 && rows().every((r) => /^Golf Promenade - 2/.test(r.textContent)) && heads().join("|") === "Named buildings (2)", "golf prom finds Golf Promenade plots", rows().map((r) => r.textContent));
ok(ids.bpp_q.value === "golf prom", "top search kept in sync with the picker search");
type("1004");
ok(rows().length === 1 && rows()[0].attrs["data-v"] === "naj:plot:6731004", "plot number search");
type("empty");
ok(rows().length === 1 && heads()[0] === "Empty plots (1)", "empty plots section");
type("golf prom");
const pick = rows()[1];
ids.bpp_psl.onclick({ target: { closest: () => pick } });
ok(ids.bpp_b.value === "naj:plot:6731002" && ids.bpp_ps.hidden === true, "tap a row selects it", ids.bpp_b.value);
// top search box still drives the select
ids.bpp_q.value = "akoya"; ids.bpp_q.oninput();
ok(ids.bpp_b.options.filter((o) => o.value).length === 1 && ids.bpp_b.options[1].value === "naj:plot:6731003", "top search still filters the building list");
ids.bpp_bp.onclick();
ok(ids.bpp_psq.value === "akoya" && rows().length === 1, "picker opens with the top search text");
ids.bpp_psl.onclick({ target: { closest: () => rows()[0] } });

// selection posts the same value
Object.defineProperty(ids.bpp_b, "selectedIndex", { get() { return this.options.findIndex((o) => o.value === this.value); } });
ids.bpp_f.onsubmit({ preventDefault() {} }); await tick();
ok(posted && posted.op === "request" && posted.text === "naj:plot:6731003" && /^Akoya Park/.test(posted.note), "selection posts the same id with op:request", posted);

const src = fs.readFileSync(new URL("../src/building_passports.js", import.meta.url), "utf8");
ok(src.split("\r\n").length - 1 === src.split("\n").length - 1, "CRLF kept");
console.log("v738 search dropdowns: " + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
