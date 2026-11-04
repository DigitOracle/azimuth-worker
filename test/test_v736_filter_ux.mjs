// v736 - filter UX on Momo Building Passports + plot passport picker (Kendall, 4 Nov 2026): every tap is one filter, tap again clears.
import fs from "fs";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
const L = await import("../src/landtype_filters.js");
const B = await import("../src/building_passports.js");
const P = await import("../src/plot_passport.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 600)); } };

// ---------- fake DOM, just enough for the two page scripts
function el(id) {
  const e = { id, hidden: false, value: "", disabled: false, textContent: "", children: [], options: [], className: "", attrs: {}, _h: "", onclick: null, onchange: null, oninput: null,
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k] == null ? null : this.attrs[k]; },
    appendChild(c) { this.children.push(c); if (c.tag === "option") this.options.push(c); if (c.tag === "optgroup") c.children.forEach((o) => this.options.push(o)); c.parent = this; return c; },
    addEventListener() {}, focus() {}, classList: { toggle() {}, contains() { return false; } },
    querySelector(s) { return this.querySelectorAll(s)[0] || null; },
    querySelectorAll(s) { if (s === "[data-ltd]") return this._btn.filter((b) => b.attrs["data-ltd"]); if (s === "[data-ltclr]") return this._btn.filter((b) => b.attrs["data-ltclr"]); if (s === "[data-ltl]") return this._btn.filter((b) => b.attrs["data-ltl"]); if (s === "[data-ltmore]") return this._btn.filter((b) => b.attrs["data-ltmore"]); if (s === "b") return []; if (s === "[data-ltu]") return this._btn.filter((b) => b.attrs["data-ltu"]); return []; },
    _btn: [] };
  Object.defineProperty(e, "innerHTML", { get() { return this._h; }, set(v) { this._h = v; this.children = []; this.options = [];
    this._btn = [...String(v).matchAll(/<button[^>]*>/g)].map((m) => { const b = el(); const d = /data-ltd="(\w+)" data-ltv="(\w+)"/.exec(m[0]); if (d) { b.attrs["data-ltd"] = d[1]; b.attrs["data-ltv"] = d[2]; } if (/data-ltclr=1/.test(m[0])) b.attrs["data-ltclr"] = "1"; const mo = /data-ltmore="([a-z]+)"/.exec(m[0]); if (mo) b.attrs["data-ltmore"] = mo[1]; const q = /data-lt([lu])="([\w,]+)"/.exec(m[0]); if (q) b.attrs["data-lt" + q[1]] = q[2]; return b; });
    } });
  return e;
}
function dom() {
  const ids = {};
  const document = { getElementById(id) { return ids[id] || (ids[id] = el(id)); }, createElement(t) { const e = el(); e.tag = t; return e; },
    querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {}, activeElement: null, documentElement: el() };
  return { ids, document };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

// ---------- v736 (Kendall, 4 Nov 2026): one tap = one filter; card = filter only; "Narrow <land type> by use" row; summary + See N
const DL6 = [
  { slug: "businessbay", name: "Business Bay", n: 10, g: 2, sa: "2026-08-31", x: { "ho.co.1.r": 3, "co.co.1.o": 2, "mx.co.1.o": 1, "in.co.0.r": 1, "cm.co.0.k": 1, "ut.co.0.k": 1, "nr.nr..e": 1 } },
  { slug: "alqusais", name: "Al Qusais", n: 4, g: 1, sa: "2026-06-15", x: { "in.in.0.r": 2, "gh.re.0.k": 1, "ho.re.0.e": 1 } }];
const D6 = { slug: "businessbay", name: "Business Bay", n: 9, sa: "2026-08-31", x: DL6[0].x,
  groups: [["Tower A", "b", [["naj:plot:1", "Plot 1", "ho.co.1.r"], ["naj:plot:2", "Plot 2", "co.co.1.o"]]]], vacant: [["naj:plot:9", "Plot 9 · Empty plot", "nr.nr..e"]] };
{
  const body = B.bppBody("k", "", [], [], "https://x", "kendall", Date.parse("2026-11-04T10:00:00Z"));
  const main = [...body.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((s) => s.indexOf("bpp_lt") >= 0);
  ok(!/id=bpp_ltp/.test(body) && !/lpp/.test(main), "v736: the sub-use pop-up panel is gone");
  ok(/class=lsum id=bpp_sum/.test(body) && /\.lsum\{position:sticky;top:0/.test(body) && body.indexOf("id=bpp_sum") < body.indexOf("id=bpp_ltc"), "sticky summary bar at the top of the card");
  ok(/All plots · 265,619/.test(body) && /See 265,619 plots/.test(body), "default text before data loads");
  ok(!/<details[^>]*open/.test(body), "sections stay closed by default");
  ok(body.indexOf("id=bpp_lt ") < body.indexOf("id=bpp_ltc") && body.indexOf("id=bpp_ltc") < body.indexOf("id=bpp_lsu") && body.indexOf("id=bpp_lsu") < body.indexOf("id=bpp_lt4"), "order: 1 Status, 2 land type, 3 use, 4 freehold");
  const { ids, document } = dom();
  const fetch = (u) => Promise.resolve({ json: () => Promise.resolve(u.indexOf("/plot_passport/districts") === 0 ? { districts: DL6 } : { ok: true, district: D6 }) });
  const ctx = { document, location: { search: "?key=k" }, fetch, setTimeout, JSON, Object, String, Number, Array };
  document.getElementById("bpp_ltc").innerHTML = (/<div class=zg id=bpp_ltc>([\s\S]*?)<\/div>/.exec(body) || [])[1] || "";
  let scrolled = 0; document.getElementById("bpp_dp").scrollIntoView = () => scrolled++;
  vm.createContext(ctx); vm.runInContext(main, ctx); await tick(); await tick();
  const card = (v) => ids.bpp_ltc._btn.find((c) => c.attrs["data-ltl"] === v);
  ok(ids.bpp_sumt.textContent === "All plots · 14" && ids.bpp_see.textContent === "See 14 plots" && ids.bpp_sumx.hidden === true, "default = nothing selected = all plots", ids.bpp_sumt.textContent);
  ok(ids.bpp_d.options.length === 3 && ids.bpp_lsu.hidden, "default: every district, no Use row");
  card("co").onclick();
  ok(/\bon\b/.test(card("co").className) && card("co").attrs["aria-pressed"] === "true", "tap a card = selected");
  ok(/Narrow Commercial by use/.test(ids.bpp_lsu.innerHTML) && !ids.bpp_lsu.hidden, "Use row appears only with a land type", ids.bpp_lsu.innerHTML.slice(0, 200));
  ok(ids.bpp_d.options.length === 2, "card filters districts and opens nothing else");
  const used = ids.bpp_lsu._btn.filter((b) => b.attrs["data-ltd"] === "u").map((b) => b.attrs["data-ltv"]);
  ok(used.join(",") === "ho,co,mx,in" && ids.bpp_lsu._btn.some((b) => b.attrs["data-ltmore"] === "u"), "biggest four uses + More...", used);
  ids.bpp_lsu._btn.find((b) => b.attrs["data-ltmore"] === "u").onclick();
  ok(ids.bpp_lsu._btn.filter((b) => b.attrs["data-ltd"] === "u").length === 6 && !/data-ltmore/.test(ids.bpp_lsu.innerHTML), "More expands the rest inline");
  ids.bpp_lt._btn.find((b) => b.attrs["data-ltd"] === "s" && b.attrs["data-ltv"] === "o").onclick();
  ids.bpp_lsu._btn.find((b) => b.attrs["data-ltd"] === "u" && b.attrs["data-ltv"] === "co").onclick();
  ok(ids.bpp_sumt.textContent === "Off-plan › Commercial › Commercial · 2 plots" && ids.bpp_see.textContent === "See 2 plots" && ids.bpp_sumx.hidden === false, "summary: Status › Land type › Use · N plots", ids.bpp_sumt.textContent);
  ids.bpp_lsu._btn.find((b) => b.attrs["data-ltd"] === "u" && b.attrs["data-ltv"] === "co").onclick();
  ok(ids.bpp_sumt.textContent === "Off-plan › Commercial · 3 plots", "tap the use again = removed", ids.bpp_sumt.textContent);
  ids.bpp_lt4._btn.find((b) => b.attrs["data-ltd"] === "f" && b.attrs["data-ltv"] === "1").onclick();
  ok(/Freehold · 3 plots$/.test(ids.bpp_sumt.textContent) && !/Tenure not recorded/.test(ids.bpp_lt4.innerHTML), "Freehold / Not freehold step", ids.bpp_sumt.textContent);
  ids.bpp_see.onclick();
  ok(ids.bpp_req.open === true && scrolled === 1 && ids.bpp_d.options.length === 2, "See N plots opens the request section and scrolls to the filtered list");
  card("co").onclick();
  ok(!/\bon\b/.test(card("co").className) && ids.bpp_lsu.hidden && ids.bpp_lsu.innerHTML === "", "tap the card again = cleared, Use row gone");
  ids.bpp_sumx.onclick();
  ok(ids.bpp_sumt.textContent === "All plots · 14" && ids.bpp_d.options.length === 3, "Clear = all plots again");
}
// ---------- shared module: the plot passport picker gets the same steps
{
  const ctx = {}; vm.createContext(ctx); vm.runInContext(L.LTF_JS, ctx);
  const F = { u: "", l: "", f: "", s: "" }, e = el("x"); let n = 0;
  ctx.ltfDraw(e, DL6, F, () => n++, { g: "zg", c: "zc", on: "on", tc: "fl" });
  const h = e.innerHTML;
  ok(h.indexOf(">Status<") < h.indexOf(">Land type (DLD)<") && h.indexOf(">Land type (DLD)<") < h.indexOf(">Freehold<") && !/data-ltd="u"/.test(h) && !/<details/.test(h), "picker: Status, Land type, Freehold; no Use until a land type; no nested menu");
  e._btn.find((b) => b.attrs["data-ltd"] === "l" && b.attrs["data-ltv"] === "co").onclick(); ok(F.l === "co" && n === 1, "tap once selects");
  ctx.ltfDraw(e, DL6, F, () => n++, { g: "zg", c: "zc", on: "on", tc: "fl" });
  ok(/Narrow Commercial by use/.test(e.innerHTML), "picker: Use row under the land type");
  e._btn.find((b) => b.attrs["data-ltd"] === "u" && b.attrs["data-ltv"] === "ho").onclick(); ok(F.u === "ho", "use selected");
  e._btn.find((b) => b.attrs["data-ltd"] === "l" && b.attrs["data-ltv"] === "co").onclick(); ok(F.l === "" && F.u === "", "tap again clears the land type and its use");
  ok(ctx.ltfSum({}, 265619) === "All plots · 265,619" && ctx.ltfSum({ s: "o", l: "co", u: "ho" }, 12340) === "Off-plan › Commercial › Homes · 12,340 plots", "summary text");
}
console.log("v736 filter ux: " + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
