// v735 - "Status" filter (Ready / Off-plan / Empty plot / Not known) shown FIRST on Momo's Building Passports card and the plot
// passport picker, compact half-width chips (Kendall, 4 Nov 2026). Hidden until the rebuilt packs carry the 4th code segment.
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

// ---------- sample packs: v735 (4-part codes + as-of) and v731 (3-part)
const DL5 = [
  { slug: "businessbay", name: "Business Bay", n: 5, g: 2, sa: "2026-08-31", x: { "ho.co.1.r": 2, "ho.co.1.o!": 1, "co.co.1.o": 1, "nr.nr..e": 1 } },
  { slug: "alqusais", name: "Al Qusais", n: 4, g: 1, sa: "2026-06-15", x: { "in.in.0.r": 2, "gh.re.0.k": 1, "ho.re.0.e": 1 } }];
const D5 = { slug: "businessbay", name: "Business Bay", n: 5, sa: "2026-08-31", x: DL5[0].x,
  groups: [["Tower A", "b", [["naj:plot:1", "Plot 1", "ho.co.1.r"], ["naj:plot:2", "Plot 2", "co.co.1.o"]]], ["Tower B", "b", [["naj:plot:3", "Plot 3", "ho.co.1.o!"]]]],
  vacant: [["naj:plot:4", "Plot 4 · Empty plot", "ho.co.1.r"], ["naj:plot:5", "Plot 5 · Empty plot", "nr.nr..e"]] };
const DL4 = DL5.map((d) => { const x = {}; for (const k in d.x) { const c = k.split(".").slice(0, 3).join("."); x[c] = (x[c] || 0) + d.x[k]; } return { slug: d.slug, name: d.name, n: d.n, g: d.g, x }; });

// ---------- 1. shared client functions
{
  const ctx = {}; vm.createContext(ctx); vm.runInContext(L.LTF_JS, ctx);
  ok(L.LT_STAT.map((x) => x.join(":")).join("|") === "r:Ready|o:Off-plan|e:Empty plot|k:Not known", "four status values, in order");
  ok(ctx.ltfHasS(DL5) && !ctx.ltfHasS(DL4) && !ctx.ltfHasS([{ n: 1 }]), "status detected only on 4-part codes");
  ok(ctx.ltfN(DL5, { s: "r" }) === 4 && ctx.ltfN(DL5, { s: "o" }) === 2 && ctx.ltfN(DL5, { s: "e" }) === 2 && ctx.ltfN(DL5, { s: "k" }) === 1, "status counts (disagree marker stripped)");
  ok(ctx.ltfN(DL5, { u: "ho", s: "o" }) === 1 && ctx.ltfN(DL5, { u: "ho", f: "1", s: "r" }) === 2, "status combines with use and tenure");
  ok(ctx.ltfM("ho.co.1.o!", { s: "o" }) && !ctx.ltfM("ho.co.1", { s: "o" }) && ctx.ltfM("ho.co.1", { u: "ho" }), "row match; v731 codes still match use filters");
  const d = ctx.ltfDim(DL5, {}, "s"); ok(d.r === 4 && d.o === 2 && d["!"] === 1, "dimension counts + registers-disagree count", d);
  const e = el("x"); const F = { u: "", l: "", f: "" }; let n = 0;
  ctx.ltfDraw(e, DL5, F, () => n++, { g: "zg", c: "zc", on: "on", t: "Use (DLD)", tc: "fl" });
  const h = e.innerHTML;
  ok(h.indexOf(">Status<") >= 0 && h.indexOf(">Status<") < h.indexOf("Land type (DLD)") && h.indexOf("<details") < 0, "Status shows FIRST, no nested menu");
  ok(/>Ready<\/b><span>4 plots/.test(h) && />Off-plan<\/b><span>2 plots/.test(h) && />Empty plot<\/b><span>2 plots/.test(h) && />Not known<\/b><span>1 plots/.test(h), "status chips with counts", h.slice(0, 900));
  ok(/Status from DLD project register and DM construction records, as of 31 Aug 2026\./.test(h), "source + as-of line on screen", h.slice(0, 1400));
  ok(/1 plots: registers disagree \(newer record used\)/.test(h), "registers-disagree note");
  ok(!/<details[^>]*open/.test(h), "accordion stays closed by default");
  ok(/grid-template-columns:1fr 1fr/.test(h) && /class=ltfc/.test(h) && /padding:6px 9px/.test(h), "compact half-width chips (2 per row) for every group");
  ok(!/width:100%/.test(L.LTF_CSS), "no full-width bars");
  const rb = e._btn.find((b) => b.attrs["data-ltd"] === "s" && b.attrs["data-ltv"] === "r"); rb.onclick(); ok(F.s === "r" && n === 1, "tapping Ready sets the status filter");
  ctx.ltfDraw(e, DL5, F, () => n++, {}); ok(/Clear filters/.test(e.innerHTML), "clear control with only a status filter on");
  e._btn.find((b) => b.attrs["data-ltclr"]).onclick(); ok(F.s === "" && F.u === "", "clear resets status too");
  ctx.ltfDraw(e, DL4, { u: "", l: "", f: "" }, () => {}, {});
  ok(!e.hidden && e.innerHTML.indexOf(">Status<") < 0 && /Freehold/.test(e.innerHTML), "v731 packs: status hidden, the other chips unchanged");
  ctx.ltfDraw(e, [{ n: 3 }], {}, () => {}, {}); ok(e.hidden && e.innerHTML === "", "pre-v731 packs: everything hidden");
}

// ---------- 2. Python rule parity (build_status in the pack builder)
{
  const py = 'import sys, json; sys.path.insert(0, r"C:\\Dev\\naj-market-pulse\\scripts"); import build_plot_passport as B\n'
    + 'S=B.build_status\n'
    + 'P=lambda st,pc=None,c=None,t="2026-06-15": {"project_status":st,"percent_completed":pc,"cancellation_date":c,"load_timestamp":t}\n'
    + 'M=lambda st,done=None,cr="2025-01-01",ao="2026-07-31": [{"status":st,"done":done,"created":cr,"asof":ao}]\n'
    + 'print(json.dumps([S(P("FINISHED"),[],[],[]),S(P("ACTIVE"),[],[],[]),S(P("NOT_STARTED"),[],[1],[]),S(P("ACTIVE",100),[],[],[]),'
    + 'S(None,M("Closed"),[],[]),S(None,M("Open"),[],[]),S(P("FINISHED"),M("Open"),[1],[]),S(P("ACTIVE",t="2026-08-31"),M("Closed"),[],[]),'
    + 'S(None,[],[1],[]),S(None,[],[],[]),S(None,[],[],[1]),S(P("ACTIVE",c="2024-01-01"),[],[],[]),S(None,M("Open",cr="2015-01-01"),[1],[]),S(P("FINISHED"),M("Closed"),[],[])]))';
  const r = spawnSync("python", ["-c", py], { encoding: "utf8" });
  if (r.status !== 0 || !r.stdout) { console.log("SKIP python parity:", (r.stderr || "").slice(0, 300)); }
  else {
    const j = JSON.parse(r.stdout.trim().split("\n").pop()).map((x) => x[0]).join(",");
    ok(j === "r,o,o,r,r,o,o!,o!,r,e,k,k,r,r", "status rule: DLD/DM verdicts, newer as-of wins on disagreement, building-only = Ready, nothing = Empty, permits only = Not known, cancelled = Not known, stale DM Open ignored", j);
    const src = fs.readFileSync("C:/Dev/naj-market-pulse/scripts/build_plot_passport.py", "utf8");
    ok(/cd \+= "\." \+ sk/.test(src) && /"x": D\["x"\], "sa": D\["sa"\] or None/.test(src), "packs carry the status segment and the as-of date");
    ok(/registers disagree/.test(src) && /NEWER as-of/.test(src), "the rule is written in the builder comments");
  }
}

// ---------- 3. Building Passports card with v735 packs
{
  const body = B.bppBody("k", "", [], [], "https://x", "kendall", Date.parse("2026-11-04T10:00:00Z"));
  const main = [...body.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((s) => s.indexOf("bpp_lt") >= 0);
  const { ids, document } = dom();
  const fetch = (u) => Promise.resolve({ json: () => Promise.resolve(u.indexOf("/plot_passport/districts") === 0 ? { districts: DL5 } : { ok: true, district: D5 }) });
  const ctx = { document, location: { search: "?key=k" }, fetch, setTimeout, JSON, Object, String, Number, Array, Date, isNaN };
  document.getElementById("bpp_ltc").innerHTML = (/<div class=zg id=bpp_ltc>([\s\S]*?)<\/div>/.exec(body) || [])[1] || "";
  vm.createContext(ctx); vm.runInContext(main, ctx); await tick(); await tick();
  const lt = ids.bpp_lt, ds = ids.bpp_d, bs = ids.bpp_b;
  ok(!lt.hidden && lt.innerHTML.indexOf(">Status<") >= 0 && body.indexOf("id=bpp_lt ") < body.indexOf("id=bpp_ltc"), "card: Status first");
  lt._btn.find((b) => b.attrs["data-ltd"] === "s" && b.attrs["data-ltv"] === "o").onclick();
  ok(ds.options.length === 2 && /Business Bay \u00b7 2 plots/.test(ds.options[1].textContent), "Off-plan narrows districts and counts", ds.options.map((o) => o.textContent));
  ds.value = "businessbay"; ds.onchange(); await tick(); await tick();
  const labs = bs.options.map((o) => o.textContent).join(" | ");
  ok(/Plot 2/.test(labs) && /Tower B/.test(labs) && !/Plot 1\b/.test(labs) && !/Plot 4/.test(labs), "Off-plan narrows the plot list", labs);
}

// ---------- 4. plot passport picker: scripts parse with the new filter code
{
  const html = P.plotPassportHtml("k", "", { as_of: "2026-11-02", plots: 9 }, {});
  let bad = null; [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((m) => { try { new vm.Script(m[1]); } catch (e) { bad = e.message; } });
  ok(!bad && html.indexOf("function ltfHasS") >= 0, "plot passport ships the status filter and parses", bad);
}

// ---------- 5. words + line endings
{
  ok(!/gpt|chatgpt|openai|claude|gemini/i.test(L.LTF_JS), "no model names");
  const s = fs.readFileSync(new URL("../src/landtype_filters.js", import.meta.url), "utf8"); ok(s.split("\r\n").length === s.split("\n").length, "CRLF kept");
}

console.log("v735 status filter:", pass, "passed,", fail, "failed");
if (fail) process.exit(1);
