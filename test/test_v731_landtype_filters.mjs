// v731 - DLD (Dubai Land Department) categories as high-level filters on Momo's Building Passports card and the plot passport picker
// (Kendall, 4 Nov 2026). USE from the DLD sub-type, DLD land type and tenure secondary; hidden until the v4 packs carry codes.
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
    querySelectorAll(s) { if (s === "[data-ltd]") return this._btn.filter((b) => b.attrs["data-ltd"]); if (s === "[data-ltclr]") return this._btn.filter((b) => b.attrs["data-ltclr"]); if (s === "[data-ltl]") return this._btn.filter((b) => b.attrs["data-ltl"]); if (s === "[data-ltu]") return this._btn.filter((b) => b.attrs["data-ltu"]); return []; },
    _btn: [] };
  Object.defineProperty(e, "innerHTML", { get() { return this._h; }, set(v) { this._h = v; this.children = []; this.options = [];
    this._btn = [...String(v).matchAll(/<button[^>]*>/g)].map((m) => { const b = el(); const d = /data-ltd="(\w+)" data-ltv="(\w+)"/.exec(m[0]); if (d) { b.attrs["data-ltd"] = d[1]; b.attrs["data-ltv"] = d[2]; } if (/data-ltclr=1/.test(m[0])) b.attrs["data-ltclr"] = "1"; const q = /data-lt([lu])="([\w,]+)"/.exec(m[0]); if (q) b.attrs["data-lt" + q[1]] = q[2]; return b; });
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

// ---------- sample district packs (v4 shape) and the pre-v731 shape
const DL4 = [
  { slug: "businessbay", name: "Business Bay", n: 5, g: 2, x: { "ho.co.1": 3, "co.co.1": 1, "nr.nr.": 1 } },
  { slug: "alqusais", name: "Al Qusais", n: 4, g: 1, x: { "in.in.0": 2, "gh.re.0": 1, "ho.re.0": 1 } }];
const D4 = { slug: "businessbay", name: "Business Bay", n: 5, x: DL4[0].x,
  groups: [["Tower A", "b", [["naj:plot:1", "Plot 1 · Freehold · Residential", "ho.co.1"], ["naj:plot:2", "Plot 2 · Freehold · Commercial", "co.co.1"]]],
           ["Tower B", "b", [["naj:plot:3", "Plot 3 · Freehold · Residential", "ho.co.1"]]]],
  vacant: [["naj:plot:4", "Plot 4 · Freehold · Residential · Empty plot", "ho.co.1"], ["naj:plot:5", "Plot 5 · Tenure not recorded · Empty plot", "nr.nr."]] };
const DLold = DL4.map((d) => ({ slug: d.slug, name: d.name, n: d.n, g: d.g }));

// ---------- 1. the shared client functions
{
  const ctx = {}; vm.createContext(ctx); vm.runInContext(L.LTF_JS, ctx);
  const F = { u: "", l: "", f: "" };
  ok(ctx.ltfHas(DL4) && !ctx.ltfHas(DLold) && !ctx.ltfHas([]), "packs with codes are detected; old packs are not");
  ok(ctx.ltfN(DL4, F) === 9, "no filter = every plot", ctx.ltfN(DL4, F));
  ok(ctx.ltfN(DL4, { u: "ho", l: "", f: "" }) === 4 && ctx.ltfN(DL4, { u: "ho", l: "", f: "1" }) === 3 && ctx.ltfN(DL4, { u: "ho", l: "re", f: "" }) === 1, "use, land type and tenure combine");
  ok(ctx.ltfN(DL4, { u: "nr", l: "", f: "" }) === 1 && ctx.ltfN(DL4, { u: "", l: "nr", f: "n" }) === 1, "v746: no sub-type counts as Use not recorded by DLD; no tenure counts as not recorded");
  const d = ctx.ltfDim(DL4, { u: "", l: "", f: "0" }, "u");
  ok(d.in === 2 && d.gh === 1 && d.ho === 1 && !d.co, "chip counts follow the other filters", d);
  ok(ctx.ltfM("ho.co.1", { u: "ho", l: "", f: "" }) && !ctx.ltfM("co.co.1", { u: "ho", l: "", f: "" }) && ctx.ltfM(undefined, F) && !ctx.ltfM(undefined, { u: "ho" }), "row match");
  const e = el("x"); let n = 0;
  ctx.ltfDraw(e, DLold, F, () => n++);
  ok(e.hidden === true && e.innerHTML === "", "hidden gracefully until the rebuilt packs are stored");
  ctx.ltfDraw(e, DL4, F, () => n++, { g: "zg", c: "zc", on: "on", t: "Use (DLD)", tc: "fl" });
  ok(!e.hidden && /DLD categories; land type and sub-type can disagree/.test(e.innerHTML), "the disagreement note is on screen");
  ok(!/data-ltd="u"/.test(e.innerHTML) && /data-ltd="l" data-ltv="co"/.test(e.innerHTML), "v736: no Use row until a land type is chosen; land-type chips show");
  ok(/>Freehold<\/b><span>4 plots/.test(e.innerHTML) && />Not freehold<\/b><span>4 plots/.test(e.innerHTML) && !/<details/.test(e.innerHTML), "v736: Freehold chips, no nested menu");
  ok(!/>Villas</.test(e.innerHTML) && !/>Labour camps</.test(e.innerHTML), "chips with no plots are not shown");
  ok(/class="zg"/.test(e.innerHTML) && /class="zc"/.test(e.innerHTML), "2-up card grid in the card's own classes");
  e._btn.find((b) => b.attrs["data-ltd"] === "l" && b.attrs["data-ltv"] === "co").onclick(); ok(F.l === "co" && n === 1, "tapping a land type sets it");
  ctx.ltfDraw(e, DL4, F, () => n++, { g: "zg", c: "zc", on: "on", tc: "fl" });
  ok(/Narrow Commercial by use/.test(e.innerHTML) && />Homes on commercial-class land<\/b><span>3 plots/.test(e.innerHTML), "v736: Use row under the land type", e.innerHTML.slice(0, 400));
  const hb = e._btn.find((b) => b.attrs["data-ltv"] === "ho" && b.attrs["data-ltd"] === "u"); hb.onclick(); ok(F.u === "ho" && n === 2, "tapping a chip sets the filter");
  hb.onclick(); ok(F.u === "", "tapping it again clears it");
  ok(L.LT_USE.length === 12 && L.LT_USE.map((x) => x[1]).join("|") === "Apartments / flats|Villas|Offices, shops & hotels|Mixed use|Industrial & warehouses|Government housing|Community|Utilities & infrastructure|Agricultural|Labour camps|Unclassified sub-type|Use not recorded by DLD", "v746: the twelve use categories, in order");
}

// ---------- 2. the Python pack builder classifies the DLD sub-types into the same ids
{
  const ids = new Set(L.LT_USE.map((x) => x[0]).concat(["nr"])), lids = new Set(L.LT_LAND.map((x) => x[0]));
  const py = 'import sys, json; sys.path.insert(0, r"C:\\Dev\\naj-market-pulse\\scripts"); import build_plot_passport as B\n'
    + 'S=["Residential","Residential Flats","Unit","Villa","Residential / Residential Villa","Residential / Attached Villas","Residential / Villas","Commercial","Shop","Commercial / Offices / Residential","Industrial","Warehouse","Government Housing","Mosque","School","Hospital","Sports Club","Electricity Station","Airport","Petrol Station","Ground Level Parcking","Parking","Railway Station","Agricultural","Labor Camp","Land","General Use",None]\n'
    + 'T=["Commercial","Residential",None,"Industrial","Public Facilities","Public Facility","Facilities","Government Authorities","Open Space","Utility","Agricultural","Future Development","Recreational","Transport","Transportation","Educational","Water Body","Hospitality","Healthcare"]\n'
    + 'print(json.dumps({"u":[B.use_cat(s) for s in S],"l":[B.land_cat(t) for t in T],"c":B.lt_code("Residential","Commercial",True),"c2":B.lt_code(None,None,None)}))';
  const r = spawnSync("python", ["-c", py], { encoding: "utf8" });
  if (r.status !== 0 || !r.stdout) { console.log("SKIP python parity (naj-market-pulse not readable here):", (r.stderr || "").slice(0, 200)); }
  else {
    const j = JSON.parse(r.stdout.trim().split("\n").pop());
    ok(j.u.join(",") === "ho,ho,ho,vi,vi,vi,vi,co,co,mx,in,in,gh,cm,cm,cm,cm,ut,ut,ut,ut,ut,ut,ag,lc,ot,ot,nr", "sub-type -> use category", j.u.join(","));
    ok(j.l.join(",") === "co,re,nr,in,pf,pf,pf,ga,os,ut,ag,fd,rc,tr,tr,ed,wb,hs,hc", "land type -> DLD land class, spelling variants merged", j.l.join(","));
    ok(j.u.every((x) => ids.has(x)) && j.l.every((x) => lids.has(x)), "every Python id has a worker label");
    ok(j.c === "ho.co.1" && j.c2 === "nr.nr.", "row code use.land.tenure", j);
    const src = fs.readFileSync("C:/Dev/naj-market-pulse/scripts/build_plot_passport.py", "utf8");
    ok(/g\["plots"\]\.append\(\[pid, tag, cd\]\)/.test(src) && /D\["vacant"\]\.append\(\[pid, tag, cd\]\)/.test(src) && /"g": len\(groups\), "x": D\["x"\]/.test(src), "packs carry the row code and district combo counts");
  }
}

// ---------- 3. Building Passports card: filters narrow districts, then buildings; old packs keep the card as it was
async function runBP(DL, D) {
  const body = B.bppBody("k", "", [], [], "https://x", "kendall", Date.parse("2026-11-04T10:00:00Z"));
  const scripts = [...body.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const main = scripts.find((s) => s.indexOf("bpp_lt") >= 0);
  const { ids, document } = dom();
  const fetch = (u) => Promise.resolve({ json: () => Promise.resolve(u.indexOf("/plot_passport/districts") === 0 ? { districts: DL } : { ok: true, district: D }) });
  const ctx = { document, location: { search: "?key=k" }, fetch, setTimeout, JSON, Object, String, Number, Array };
  document.getElementById("bpp_ltc").innerHTML = (/<div class=zg id=bpp_ltc>([\s\S]*?)<\/div>/.exec(body) || [])[1] || "";
  vm.createContext(ctx); vm.runInContext(main, ctx); await tick(); await tick();
  return { body, ids, ctx };
}
{
  const { body, ids } = await runBP(DL4, D4);
  ok(body.indexOf("function ltfDraw") >= 0 && /<div id=bpp_lt class=ltw hidden><\/div>/.test(body), "card ships the filter block");
  ok(!/<details[^>]*open/.test(body) && (body.match(/<details class="?[^>]*acc[^>]*name=bpa/g) || []).length === 2 && body.indexOf("id=bpp_sp") < body.indexOf("name=bpa"), "accordion: sections closed by default, one name group, stats row outside", (body.match(/<details[^>]*>/g) || []));
  ok(/details\.acc/.test(body) && /o\.open=false/.test(body), "opening one section closes the others (fallback)");
  ok(body.indexOf("id=bpp_lt ") < body.indexOf("<summary>Request a passport") && body.indexOf("id=bpp_lt ") < body.indexOf("id=bpp_ltc") && !/<form[\s\S]*id=bpp_lt class=ltw[\s\S]*<\/form>/.test(body), "v736: filters sit in the land-type card, before the form");
  const lt = ids.bpp_lt, ds = ids.bpp_d, bs = ids.bpp_b;
  ok(lt.hidden && !ids.bpp_lt4.hidden && /Freehold/.test(ids.bpp_lt4.innerHTML), "v731 packs: no Status row; Freehold chips show");
  ok(ds.options.length === 3, "both districts listed with no filter", ds.options.map((o) => o.textContent));
  ids.bpp_ltc._btn.find((c) => c.attrs["data-ltl"] === "in").onclick();
  ok(ds.options.length === 2 && /Al Qusais \u00b7 2 plots/.test(ds.options[1].textContent), "Industrial narrows the district list and its count", ds.options.map((o) => o.textContent));
  ok(ids.bpp_sumx.hidden === false, "clear control while a filter is on");
  ids.bpp_sumx.onclick();
  ok(ds.options.length === 3, "clear restores the list");
  ids.bpp_ltc._btn.find((c) => c.attrs["data-ltl"] === "co").onclick(); ids.bpp_lsu._btn.find((b) => b.attrs["data-ltv"] === "ho" && b.attrs["data-ltd"] === "u").onclick();
  ds.value = "businessbay"; ds.onchange(); await tick(); await tick();
  const labs = bs.options.map((o) => o.textContent).join(" | ");
  ok(/Plot 1/.test(labs) && /Tower B/.test(labs) && /Plot 4/.test(labs) && !/Plot 2/.test(labs) && !/Plot 5/.test(labs), "Homes narrows the building/plot list", labs);
  ok(/Homes on commercial-class land<\/b><span>3 plots/.test(ids.bpp_lsu.innerHTML), "chip counts follow the chosen district", ids.bpp_lsu.innerHTML.slice(0, 300));
}
{
  const { ids } = await runBP(DLold, { ...D4, x: undefined, groups: D4.groups.map((g) => [g[0], g[1], g[2].map((p) => p.slice(0, 2))]), vacant: D4.vacant.map((p) => p.slice(0, 2)) });
  ok(ids.bpp_lt.hidden === true && ids.bpp_lt4.hidden === true && ids.bpp_lsu.hidden === true, "old packs: filters stay hidden");
  ok(ids.bpp_d.options.length === 3 && /Business Bay \u00b7 5 plots/.test(ids.bpp_d.options[1].textContent), "old packs: districts list as before", ids.bpp_d.options.map((o) => o.textContent));
  ids.bpp_d.value = "businessbay"; ids.bpp_d.onchange(); await tick(); await tick();
  ok(ids.bpp_b.options.length === 6, "old packs: every plot still listed", ids.bpp_b.options.map((o) => o.textContent));
}

// ---------- 3b. the v730 land-type cards are the same filter, with a sub-type panel
{
  const { body, ids } = await runBP(DL4, D4);
  ok(/about 90,000 plots are "Commercial"/.test(body) && !/104,500/.test(body), "note uses the measured 90,000 figure");
  ok(/&lt;0\.1%/.test(body) || /<0\.1%/.test(body), "tiny shares read <0.1%");
  ok(!/0\.0%/.test(body), "no 0.0% shares");
  const cards = ids.bpp_ltc._btn, co = cards.find((c) => c.attrs["data-ltl"] === "co");
  ok(cards.length === 13 && cards.some((c) => c.attrs["data-ltl"] === "ed,wb,hs,hc"), "13 tappable land-type cards", cards.length);
  co.onclick();
  ok(/\bon\b/.test(co.className) && co.attrs["aria-pressed"] === "true", "tapped card highlighted");
  ok(!ids.bpp_lsu.hidden && /Narrow Commercial by use/.test(ids.bpp_lsu.innerHTML) && />Homes on commercial-class land<\/b><span>3 plots/.test(ids.bpp_lsu.innerHTML) && />Offices, shops &amp; hotels<\/b><span>1 plots/.test(ids.bpp_lsu.innerHTML), "v736: Use row shows the uses of that land type", ids.bpp_lsu.innerHTML.slice(0, 300));
  ok(ids.bpp_d.options.length === 2, "card filter narrows districts", ids.bpp_d.options.map((o) => o.textContent));
  ok(/^Commercial \u00b7 4 plots$/.test(ids.bpp_sumt.textContent), "summary shows the one land-type filter", ids.bpp_sumt.textContent);
  ids.bpp_lsu._btn.find((b) => b.attrs["data-ltv"] === "ho" && b.attrs["data-ltd"] === "u").onclick();
  ok(/aria-pressed="true" data-ltd="u" data-ltv="ho"/.test(ids.bpp_lsu.innerHTML), "use tap selects the use chip");
  ids.bpp_sumx.onclick();
  ok(!/\bon\b/.test(ids.bpp_ltc._btn.find((c) => c.attrs["data-ltl"] === "co").className) && ids.bpp_lsu.hidden, "clearing clears the card and removes the Use row");
  ids.bpp_ltc._btn.find((c) => c.attrs["data-ltl"] === "ed,wb,hs,hc").onclick();
  ok(ids.bpp_d.options.length === 1, "merged card filters on its four classes (none in sample)", ids.bpp_d.options.map((o) => o.textContent));
}
{
  const { ids } = await runBP(DLold, D4);
  ids.bpp_ltc._btn[0].onclick();
  ok(ids.bpp_lsu.hidden && ids.bpp_d.options.length === 3, "old packs: cards stay inert");
}

// ---------- 4. plot passport picker carries the same filters
{
  const html = P.plotPassportHtml("k", "", { as_of: "2026-11-02", plots: 9 }, {});
  ok(/<div id=ppltf class=ltw hidden><\/div>/.test(html) && html.indexOf("function ltfDraw") >= 0, "plot passport picker ships the filters");
  const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  let bad = null; js.forEach((s) => { try { new vm.Script(s); } catch (e) { bad = e.message; } });
  ok(!bad, "plot passport scripts parse", bad);
  const src = fs.readFileSync(new URL("../src/plot_passport.js", import.meta.url), "utf8");
  ok(/lM\(x\[2\],LF\)/.test(src) && /dN\(d\)>0/.test(src), "district list, buildings and plots are narrowed");
}

// ---------- 5. words
{
  const txt = L.LTF_JS + JSON.stringify(L.LT_USE) + JSON.stringify(L.LT_LAND);
  ok(!/gpt|chatgpt|openai|claude|gemini/i.test(txt), "no model names in the filter text");
  for (const f of ["../src/landtype_filters.js", "../src/building_passports.js", "../src/plot_passport.js"]) {
    const s = fs.readFileSync(new URL(f, import.meta.url), "utf8"); ok(s.indexOf("\r\n") >= 0 && s.split("\r\n").length - 1 === s.split("\n").length - 1, "CRLF kept in " + f);
  }
}

console.log("v731 landtype filters:", pass, "passed,", fail, "failed");
if (fail) process.exit(1);
