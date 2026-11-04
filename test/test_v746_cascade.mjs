// v746 (Kendall, 4 Nov 2026): "I chose Residential but it gives me all children; audit the cascading structure".
// Tree, sums (children + Other + not recorded == parent for every land type, district, status and freehold), percentages from live
// counts, Other grouping, top 4 + More - against the real browse packs (local copies of live pp_dl / pp_d_*).
import fs from "node:fs";
import vm from "node:vm";
import * as L from "../src/landtype_filters.js";
import * as B from "../src/building_passports.js";

let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL " + m + (x !== undefined ? " " + JSON.stringify(x).slice(0, 300) : "")); } };
const ctx = { JSON, Object, String, Number, Array, Date, isNaN };
vm.createContext(ctx); vm.runInContext(L.LTF_JS, ctx);

const DIR = process.env.PP_BROWSE || "C:/Users/kwils/AppData/Local/Temp/claude/C--Users-kwils-Downloads/dfdba7aa-873b-4c5f-b88e-7ca4eb14469d/scratchpad/pp_browse";
if (!fs.existsSync(DIR + "/pp_dl.json")) { console.log("SKIP real packs not found at " + DIR); }
else {
  const DL = JSON.parse(fs.readFileSync(DIR + "/pp_dl.json", "utf8"));
  // 0. pack integrity: every district's combo counts sum to its n, and pp_d_<slug>.x equals the pp_dl row
  let bad = [], miss = 0, diff = [];
  DL.forEach((d) => {
    const s = Object.values(d.x || {}).reduce((a, b) => a + b, 0); if (s !== d.n) bad.push([d.slug, d.n, s]);
    const f = DIR + "/pp_d_" + d.slug + ".json"; if (!fs.existsSync(f)) { miss++; return; }
    const D = JSON.parse(fs.readFileSync(f, "utf8")); if (JSON.stringify(D.x) !== JSON.stringify(d.x)) diff.push(d.slug);
  });
  ok(!bad.length, "pp_dl: sum(x) == n for every district", bad);
  ok(!diff.length, "pp_d_<slug>.x == pp_dl x", diff.slice(0, 10));
  ok(DL.reduce((a, d) => a + d.n, 0) === 265619, "265,619 plots in total");

  // 1. the tree: every land id with a rule is a real land id, every child a real use id; Residential has no Commercial / Community / Utilities child
  const U = new Set(L.LT_USE.map((x) => x[0])), LL = new Set(L.LT_LAND.map((x) => x[0]));
  ok(Object.keys(L.LT_TREE).every((k) => LL.has(k)) && Object.values(L.LT_TREE).every((r) => r.every((x) => U.has(x[0]) && x[0] !== "nr" && x[0] !== "ot")), "tree ids match LT_LAND / LT_USE");
  ok(L.LT_TREE.re.map((x) => x[0]).join(",") === "vi,ho,gh,mx", "Residential -> Villas, Apartments, Government housing, Mixed use");
  ok(L.LT_TREE.co.some((x) => x[0] === "ho" && /commercial-class land/.test(x[1])), "Commercial -> Homes on commercial-class land");
  ok(L.LT_USE.find((x) => x[0] === "ho")[1] === "Apartments / flats" && L.LT_USE.find((x) => x[0] === "nr")[1] === "Use not recorded by DLD", "labels renamed");

  // 2. sums at every level: whole city, each district, each status, each tenure
  const lands = L.LT_LAND.map((x) => x[0]).concat(["ed,wb,hs,hc"]);
  const scopes = [["all", DL]].concat(DL.map((d) => [d.slug, [d]]));
  const extra = [{}, { s: "r" }, { s: "o" }, { s: "e" }, { s: "k" }, { f: "1" }, { f: "0" }, { s: "o", f: "1" }];
  let checks = 0, sumBad = [];
  scopes.forEach(([nm, LS]) => lands.forEach((l) => extra.forEach((e) => {
    const F = Object.assign({ u: "", l, f: "", s: "" }, e), par = ctx.ltfN(LS, F); if (!par) return;
    const T = ctx.ltfTree(LS, F), s = T.kids.reduce((a, y) => a + y[2], 0) + T.oth.reduce((a, y) => a + y[2], 0) + T.nr;
    checks++; if (s !== par || T.total !== par) sumBad.push([nm, l, e, par, s]);
    // each child chip, when chosen, gives exactly its count
    T.kids.concat(T.oth).forEach((y) => { if (nm === "all" && ctx.ltfN(LS, Object.assign({}, F, { u: y[0] })) !== y[2]) sumBad.push([nm, l, e, y]); });
  })));
  ok(checks > 1000 && !sumBad.length, "children + Other + not recorded == parent (" + checks + " parents)", sumBad.slice(0, 5));

  // 3. Residential, whole city: only belonging uses are peers, the strays sit in ONE Other chip, not recorded last; at most 4 + More
  const FR = { u: "", l: "re", f: "", s: "" }, TR = ctx.ltfTree(DL, FR);
  ok(TR.kids.map((y) => y[0]).every((u) => ["vi", "ho", "gh", "mx"].includes(u)), "Residential children all belong", TR.kids);
  ok(TR.oth.map((y) => y[0]).sort().join(",") === "cm,co,ot,ut", "Residential strays: Commercial, Community, Utilities, Unclassified", TR.oth);
  const h = ctx.ltfUse(DL, FR, { g: "zg", c: "zc", on: "on" });
  const chips = [...h.matchAll(/<button[^>]*>/g)].map((m) => m[0]);
  ok(chips.filter((c) => /data-ltoth/.test(c)).length === 1 && /Other recorded uses \(2,389\)/.test(h), "one collapsed Other chip with the stray total", h.slice(0, 600));
  ok(!/data-ltv="co"/.test(h) && !/data-ltv="cm"/.test(h), "strays hidden until Other is tapped");
  ok(/data-ltv="nr"/.test(chips[chips.length - 1]) && /Use not recorded by DLD/.test(h), "not recorded comes last");
  ok(ctx.ltfUse(DL, Object.assign({}, FR, { mo: 1 }), { g: "zg", c: "zc", on: "on" }).match(/data-ltv="(co|cm|ut|ot)"/g).length === 4, "Other expands its uses");
  // 4. top 4 + More wherever a land type has 6+ belonging uses (no rule: Not recorded land); <= 4 + More + Other + nr chips everywhere
  let over = [];
  scopes.forEach(([nm, LS]) => lands.forEach((l) => { const F = { u: "", l, f: "", s: "" }; if (!ctx.ltfN(LS, F)) return; const hh = ctx.ltfUse(LS, F, { g: "g", c: "c", on: "on" });
    const n = (hh.match(/data-ltd="u"/g) || []).length; if (n > 5) over.push([nm, l, n]); }));
  ok(!over.length, "never more than 4 uses + not recorded before More / Other", over.slice(0, 5));
  const hn = ctx.ltfUse(DL, { u: "", l: "nr", f: "", s: "" }, { g: "g", c: "c", on: "on" });
  ok(/data-ltmore="u"/.test(hn) && (hn.match(/data-ltd="u"/g) || []).length === 5, "Not-recorded land: biggest 4 + More (+ not recorded)", hn.slice(0, 300));
  // the screenshot case (14,049 Residential plots for a selection): a district subset still sums
  console.log("Residential city tree:", JSON.stringify(TR));
}

// 5. land-type cards: share from the live counts of the current selection, zero cards hidden; no static 265,619 share on the client
{
  const body = B.bppBody("k", "", [], [], "https://x", "kendall", Date.parse("2026-11-04T10:00:00Z"));
  const m = /function lpct\(n,t\)\{[^}]*\}/.exec(body); ok(!!m, "lpct in the page");
  const f = new Function(m[0] + ";return lpct")();
  ok(f(16, 16) === "100.0%" && f(9, 14049) === "<0.1%" && f(0, 10) === "0.0%" && f(5, 0) === "0%", "share of the current selection");
  ok(/sp\.textContent=\(LTNM\[v\]\|\|""\)\+" (?:\\u00b7|·) "\+lpct\(n,lt\);c\.hidden=!n&&!on/.test(body), "cards rewrite their share and hide at 0");
}
console.log("v746 cascade: " + pass + " passed, " + fail + " failed"); if (fail) process.exitCode = 1;
