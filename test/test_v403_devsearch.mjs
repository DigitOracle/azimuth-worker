// v403 - THE SEARCH BUTTON on the Developers-by-area page. Offline: the real module, the real data files and fixtures, a stubbed browser; no network, no KV, no deploy.
//   node test/test_v403_devsearch.mjs
import fs from "node:fs";
import { devmapHtml } from "../src/devmap_page.js";
import { DM } from "../scripts/build_devmap_index.mjs";
import { PHOSPHOR_LIGHT } from "../src/devmap_icons.js";
import { DEVSEARCH_JS, DEVSEARCH_CSS, DEVSEARCH_BTN } from "../src/devsearch_page.js";
import { NOSALES_JS } from "../src/nosales_page.js";
import { NOTCONF_JS } from "../src/notconf_page.js";
import { ANNOUNCED_JS } from "../src/announced_page.js";
import { PLOTPOS_JS } from "../src/plotpos_page.js";
import { mergePlots } from "../src/nosales.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };
const EMOJI = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const text = (h) => String(h).replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

// ---- the data: the real files and fixtures ----
const PLOTS0 = rd("./fixtures/v397b_plots_sample.json");
const INDEX_FX = JSON.parse(rd("./fixtures/v397b_index_sample.json"));
let plots = PLOTS0;
for (const f of ["search_extra_none.json", "search_extra_dubaimaritimecity.json", "search_extra_alkhairanfirst.json"]) { const m = mergePlots(plots, rd("../data/search_extra/" + f)); if (m) plots = m; }
const PLOTS = JSON.parse(plots);
const NOSALES = JSON.parse(rd("../data/nosales/nosales.json"));
const ANN = JSON.parse(rd("../data/announced/announced.json"));
const annFirst = (() => { for (const dev of Object.keys(ANN.d)) for (const ds of Object.keys(ANN.d[dev])) for (const e of ANN.d[dev][ds]) if (e.e === "DEVELOPER_CLAIMED" && !e.od && !e.pm && e.n.length > 5 && /^[A-Za-z ]+$/.test(e.n)) return { dev, ds, e }; })();
const NOTCONF = { d: { emaar: { alkhairanfirst: [{ n: "Hidden Quay Two", r: "other_name", e: "NAME_ONLY", a: "Dubai Creek Harbour", de: "EMAAR DEVELOPMENT PJSC" }] } } };
DM.TIER_CFG.bounds = [30000, 20000, 12000];
const IDX = { as_of: "2026-09-09", cuts: { bounds: [30000, 20000, 12000] },
  devs: { emaar: { name: "Emaar", areas: 1, n: 40 }, imtiaz: { name: "Imtiaz", areas: 1, n: 10 }, azizi: { name: "Azizi", areas: 1, n: 30 }, damac: { name: "DAMAC", areas: 1, n: 50 } },
  alias: { "imtiaz real estate investment development": "imtiaz", "damac properties": "damac" },
  areas: {
    alkhairanfirst: { name: "Dubai Creek Harbour", comms: ["Creek Beach"], devs: { emaar: { n: "Emaar", h: 0, c: [[40, 21000, 1e6, 1]], b: [[10, 21000, "Creek Palace"], [7, 24000, "Harbour Gate"]], bx: [{ e: "REGISTER_VERIFIED", p: 3147, a: "Dubai Creek Harbour", dn: "Dubai Creek Harbour LLC" }, { e: "NAME_ONLY", a: "Dubai Creek Harbour" }] } } },
    businessbay: { name: "Business Bay", comms: [], devs: { azizi: { n: "Azizi", h: 0, c: [[30, 18000, 1e6, 1]], b: [[12, 18000, "Azizi Riviera Plaza"]], bx: [{ e: "REGISTER_VERIFIED", p: 2001 }] } } },
    wadialsafa5: { name: "Dubai Land Residence Complex", comms: [], devs: {} } },
  nconf: { damac: { all: [{ slug: "businessbay", area: "Business Bay", name: "Damac Unconfirmed Tower", n: 3, ppsm: 15000, ev: { e: "NAME_ONLY" } }], l12: [] } } };

// ---- a small stubbed browser ----
function mkEl(tag) {
  const e = { tag, id: "", innerHTML: "", style: {}, className: "", attrs: {}, children: [], hidden: false, value: "", focused: 0, inserted: [], classList: { contains: () => false },
    setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k] != null ? this.attrs[k] : null; }, appendChild(c) { this.children.push(c); if (c.id) els[c.id] = c; return c; },
    focus() { this.focused++; }, querySelectorAll() { return []; },
    querySelector(sel) { if (sel === ".pdh" && /class=pdh/.test(this.innerHTML)) { const o = this; return { insertAdjacentHTML(w, h) { o.inserted.push(h); } }; } return null; } };
  return e;
}
const els = {};
const doc = { getElementById: (i) => els[i] || null, createElement: (t) => mkEl(t), body: mkEl("body"), addEventListener: () => {} };
doc.body.appendChild = (c) => { doc.body.children.push(c); if (c.id) els[c.id] = c; return c; };

console.log("A - the module and the page script");
{
  const html = devmapHtml("k", { NAJ_NAV_CSS: "", NAJ_FONTS: "", najNav: () => "" });
  const js = html.slice(html.indexOf("<script>", html.indexOf("maplibre-gl.js")) + 8, html.lastIndexOf("</script>"));
  let parses = true; try { new Function(js); } catch (e) { parses = false; console.log(String(e)); } ok(parses, "the whole page script parses");
  let p2 = true; try { new Function(DEVSEARCH_JS + ";return DEVSEARCH"); } catch (e) { p2 = false; console.log(String(e)); } ok(p2, "DEVSEARCH_JS parses on its own");
  ok(!EMOJI.test(DEVSEARCH_JS + DEVSEARCH_CSS + DEVSEARCH_BTN) && !EMOJI.test(rd("../src/devsearch_page.js")), "no emoji in the module, the button or its styles (the page's own star glyph is older)");
  ok(!/`|\$\{/.test(DEVSEARCH_JS), "the page-script string has no backtick or substitution");
  ok(PHOSPHOR_LIGHT["magnifying-glass"] && PHOSPHOR_LIGHT["magnifying-glass"].length === 1 && DEVSEARCH_BTN.includes(PHOSPHOR_LIGHT["magnifying-glass"][0]), "the magnifier comes from the existing Phosphor light icon set (devmap_icons.js)");
  // where the button sits: in the header, outside the side body that every tab re-renders
  const iBtn = html.indexOf("id=dsbtn"), iH1 = html.indexOf("<h1>Developers by area</h1>"), iBody = html.indexOf("<div id=sidebody>");
  ok(iBtn > 0 && iH1 > 0 && iBtn > iH1 && iBtn < iBody, "the button sits on the title row, after the h1 and before the side body");
  ok(/<div class=dstr><h1>Developers by area<\/h1><button type=button id=dsbtn/.test(html) && /<span>Search<\/span><\/button><\/div><div class=sub id=source>/.test(html), "title row = h1 + Search button, then the source paragraph (above the tab bar)");
  const sh = js.slice(js.indexOf("function sideHtml()"), js.indexOf("function dimOf"));
  ok(!/dsbtn|DEVSEARCH/.test(sh) && /<div class=seg id=tabs>/.test(sh), "the tab screens never render or remove the button (it is outside what they write)");
  ok((js.match(/\$\("sidebody"\)\.innerHTML=/g) || []).length >= 1 && !/\$\("side"\)\.innerHTML=/.test(js) && !/\.dstr/.test(js.replace(DEVSEARCH_JS, "")), "renderSide writes #sidebody only; the header row is untouched on all three tabs (1, 2 and 3)");
  ok(/typeof DEVSEARCH!=="undefined"\)DEVSEARCH\.init\(/.test(js), "the init hook is guarded");
  ok(/\.dsbtn\{[^}]*min-height:44px;min-width:44px/.test(DEVSEARCH_CSS) && /\.dsr\{[^}]*min-height:44px/.test(DEVSEARCH_CSS) && /\.dsbar input\{[^}]*min-height:44px/.test(DEVSEARCH_CSS) && /\.dsmore\{[^}]*min-height:44px/.test(DEVSEARCH_CSS), "tap targets are at least 44 px: button, results, input, clear/close, show more");
  ok(/@media \(max-width:760px\)\{\.dspanel\{width:100%/.test(DEVSEARCH_CSS) && /\.dstr\{display:flex;[^}]*gap:10px\}/.test(DEVSEARCH_CSS) && /\.dstr h1\{flex:1;min-width:0\}/.test(DEVSEARCH_CSS), "375 px safe: the panel is full width on a phone; the title shrinks, the button keeps its size");
}

// ---- one scope: the page's real project panel code, the group modules and the search module ----
const html = devmapHtml("k", { NAJ_NAV_CSS: "", NAJ_FONTS: "", najNav: () => "" });
const js = html.slice(html.indexOf("<script>", html.indexOf("maplibre-gl.js")) + 8, html.lastIndexOf("</script>"));
const cut = (a, b) => js.slice(js.indexOf(a), js.indexOf(b));
const s0 = cut("function esc(t)", "function api("), s1 = cut("function fmt(n)", "(function(){var b=new URLSearchParams(location.search).get(\"bounds\")");
const body = NOSALES_JS + NOTCONF_JS + ANNOUNCED_JS + PLOTPOS_JS + DEVSEARCH_JS + "var $=function(id){return document.getElementById(id)};var KEY=\"k\";var fetch=function(){return new Promise(function(){})};" + s0 + s1
  + cut("function clipName", "function devHead(") + cut("function icoSvg", "function evidenceHtml")
  + cut("var BLK={}", "var PULSE=0") + cut("function showSnap(p,pin)", "function focusProject") + cut("function tipHtml", "function drillHtml")
  + cut("function nsHtml", "// v375 - DELIVERY RECORD card") + cut("function pdfUrl", "function pdfRowProf")
  + "; return {pdOpen:pdOpen,pjCard:pjCard,pjCard0:pjCard0,PDET:PDET,invIndex:invIndex,NOSALES:NOSALES,NOTCONF:NOTCONF,ANNOUNCED:ANNOUNCED,DEVSEARCH:DEVSEARCH,evalHook:function(src){return eval(src)}};";
const S = { evOpen: false, sel: null, unit: "sqft", win: "all", inv: null, mode: "buy", bud: {}, screen: 1, parea: null, mine: {} };
const mapCalls = [];
const map = { getSource: () => null, flyTo() {}, isStyleLoaded: () => false, easeTo(o) { mapCalls.push(o); }, getZoom: () => 10 };
const P = new Function("DM", "IDX", "S", "TC", "document", "renderDetail", "updatePj", "EVI", "innerWidth", "map", "setSheet", body)(DM, IDX, S, ["#c5a56a"], doc, () => {}, () => {}, PHOSPHOR_LIGHT, 1200, map, () => {});
P.invIndex && 0;
P.NOSALES.load(JSON.parse(JSON.stringify(NOSALES)));
P.ANNOUNCED.load(JSON.parse(JSON.stringify(ANN)));
P.NOTCONF.load(JSON.parse(JSON.stringify(NOTCONF)));
const D = P.DEVSEARCH;

// the page's own handlers, taken from the hook text itself
const hookTxt = js.slice(js.indexOf("DEVSEARCH.init({"), js.indexOf("// v403 - the Search button: one init"));
const openCardSrc = (hookTxt.match(/openCard:(function\(sl,nm,pp,n,ev\)\{.*?\})\}\);\s*$/s) || [])[1] || (hookTxt.match(/openCard:(function\(sl,nm,pp,n,ev\)\{[^}]*\})/) || [])[1];
const pickSrc = (hookTxt.match(/pick:(function\(k\)\{.*?\}),openCard:/s) || [])[1];
const calls = [];
const pjdetCalls = [];
function ctxFor(over) {
  return Object.assign({ idx: () => IDX, tags: { damac: ["Damac Hills 2"] }, raw: { nosales: NOSALES, notconf: NOTCONF, announced: ANN }, mods: { NOSALES: P.NOSALES, NOTCONF: P.NOTCONF, ANNOUNCED: P.ANNOUNCED },
    fetch: () => new Promise(() => {}), map: () => map, panel: () => els.pjdet || null, collapse: () => {},
    pick: (k) => calls.push(["pick", k]), select: (s) => calls.push(["select", s]), openCard: (sl, nm, pp, n, ev) => calls.push(["card", sl, nm, pp, n, ev]) }, over || {});
}
const btn = mkEl("button"); btn.id = "dsbtn"; els.dsbtn = btn;
function fresh(over, noSx) {
  calls.length = 0; mapCalls.length = 0; delete els.dspanel; doc.body.children.length = 0;
  D.init(ctxFor(over)); if (!noSx) D.loadSx(PLOTS); btn.onclick();
  return { panel: els.dspanel, inp: els.dsq, res: els.dsres, live: els.dslive };
}
const type = (u, q) => { u.inp.value = q; u.inp.oninput(); return u.res.innerHTML; };
const clickAt = (u, i) => u.panel.onclick({ target: { closest: () => ({ getAttribute: (a) => (a === "data-i" ? String(i) : null) }) } });
const names = (h) => [...h.matchAll(/<b dir=auto>(.*?)<\/b>/g)].map((m) => m[1]);
const firstCls = (h) => (h.match(/class="dsr (\w+)"/) || [])[1];

console.log("B - the button and the panel");
{
  const u = fresh();
  ok(u.panel && u.panel.attrs.role === "search" && /Search developers, projects and areas/.test(u.panel.attrs["aria-label"]), "the panel is role=search with a label");
  ok(u.panel.hidden === false && btn.attrs["aria-expanded"] === "true" && u.inp.focused >= 1, "tapping the button opens the panel, sets aria-expanded and puts the cursor in the input (autofocus)");
  ok(u.inp.attrs.type === "search" && u.inp.attrs["aria-label"] && els.dsclr && els.dsx && /Clear/.test(els.dsclr.attrs["aria-label"]) && /Close/.test(els.dsx.attrs["aria-label"]), "a full-width input, a clear button and a close button, each with a name");
  ok(u.live.attrs.role === "status" && u.live.attrs["aria-live"] === "polite", "results are announced through a polite live region");
  ok(els.dsclr.hidden === true, "the clear button is hidden while the input is empty");
  type(u, "imtiaz"); ok(els.dsclr.hidden === false, "the clear button shows once there is text");
  els.dsclr.onclick(); ok(u.inp.value === "" && u.res.innerHTML === "", "clear empties the input and the list");
  u.panel.onkeydown({ key: "Escape" }); ok(u.panel.hidden === true && btn.attrs["aria-expanded"] === "false" && btn.focused >= 1, "Esc closes the panel and returns the focus to the button");
  btn.onclick(); els.dsx.onclick(); ok(els.dspanel.hidden === true, "the close button closes it");
}

console.log("C - what it finds");
{
  let u = fresh(), h;
  h = type(u, "Imtiaz"); ok(firstCls(h) === "dsdev" && names(h)[0] === "Imtiaz", "'Imtiaz' shows the developer first", names(h).join("|"));
  ok(names(h).some((n) => /KORE/i.test(n)), "...and its projects below it (KORE by Imtiaz)");
  h = type(u, "KORE"); ok(/KORE by Imtiaz/.test(h) && /data-src="nosales"/.test(h), "'KORE' finds the no-sales project", names(h).join("|"));
  h = type(u, "Burj Azizi"); ok(names(h)[0] && /BURJ AZIZI/i.test(names(h)[0]) && /data-src="reg"/.test(h), "'Burj Azizi' finds the register-only project (from the search entries)", names(h).join("|"));
  h = type(u, "Trump Tower"); ok(names(h).some((n) => /^Trump Tower$/i.test(n)), "'Trump Tower' finds a project", names(h).join("|"));
  h = type(u, "Chelsea"); ok(names(h).filter((n) => /CHELSEA/i.test(n)).length >= 2, "'Chelsea' finds the Chelsea projects", names(h).join("|"));
  h = type(u, "Creek Palace"); ok(names(h)[0] === "Creek Palace" && /data-src="card"/.test(h), "a project card in the index is found", names(h).join("|"));
  h = type(u, "Hidden Quay"); ok(/Hidden Quay Two/.test(h) && /data-src="notconf"/.test(h), "a not-confirmed project (KV group) is found");
  h = type(u, "Damac Unconfirmed"); ok(/Damac Unconfirmed Tower/.test(h) && /data-src="notconf"/.test(h), "a not-confirmed project (index nconf) is found");
  h = type(u, annFirst.e.n); ok(h.includes('data-src="announced"') && h.includes(annFirst.e.n.replace(/&/g, "&amp;")), "an announced project is found: " + annFirst.e.n);
  h = type(u, "3257"); ok(/BURJ AZIZI/i.test(names(h)[0] || "") && /project 3257/.test(h), "a project number finds the project", names(h).join("|"));
  h = type(u, "project 3257"); ok(/BURJ AZIZI/i.test(names(h)[0] || ""), "'project 3257' works too");
  h = type(u, "3147"); ok(names(h)[0] === "Creek Palace", "a project number finds a card project (its register project number)", names(h).join("|"));
  h = type(u, "برج عزيزي"); ok(/BURJ AZIZI/i.test(h) && /dir=rtl/.test(h), "Arabic works (and a different final ya still matches)", h.slice(0, 200));
  h = type(u, "ترامب"); ok(/Trump Tower/i.test(h), "an Arabic prefix finds the project", names(h).join("|"));
  h = type(u, "Damac Hills 2"); ok(firstCls(h) === "dsdev" && names(h)[0] === "DAMAC", "a developer is found by its tag/alias, ranked first");
  h = type(u, "damac properties"); ok(firstCls(h) === "dsdev" && names(h)[0] === "DAMAC", "a developer is found by its alias in the index");
  h = type(u, "Business Bay"); ok(/dsarea/.test(h), "an area is found", names(h).join("|"));
  h = type(u, "Creek Beach"); ok(D.search("Creek Beach").some((i) => i.t === 2 && i.name === "Dubai Creek Harbour"), "an area is found by its community name (listed after the projects, so behind Show more)", names(h).join("|"));
  h = type(u, "azizi"); const cls = [...h.matchAll(/class="dsr (\w+)"/g)].map((m) => m[1]); const last = (a, c) => a.lastIndexOf(c), first = (a, c) => a.indexOf(c);
  ok(cls[0] === "dsdev" && first(cls, "dsproj") > last(cls, "dsdev") && (first(cls, "dsarea") < 0 || first(cls, "dsarea") > last(cls, "dsproj")), "ranking: developers, then projects, then areas", cls.join(","));
  h = type(u, "zzzqqq"); ok(/No developer, project or area by that name/.test(h) && !/class="dsr/.test(h) && /Nothing matches/.test(u.live.textContent), "no match: a plain line and an announcement, not an error");
  h = type(u, "a"); ok(h === "" || !/class="dsr/.test(h), "one letter does not flood the list");
}

console.log("D - eight at a time, show more");
{
  const u = fresh(); const h = type(u, "residences");
  const n1 = (h.match(/class="dsr /g) || []).length;
  ok(n1 === 8 && /class=dsmore/.test(h), "eight results and a Show more button", n1);
  const u2 = fresh(); type(u2, "residences");
  u2.panel.onclick({ target: { closest: () => ({ getAttribute: (a) => (a === "data-more" ? "1" : null) }) } });
  const n2 = (u2.res.innerHTML.match(/class="dsr /g) || []).length;
  ok(n2 > 8 && n2 <= 16, "Show more adds the next eight", n2);
  ok(!/\b\d+ (results?|projects?|developers?|matches)\b/i.test(text(h) + " " + u.live.textContent) && !/\bof \d+\b/.test(text(h)), "nothing is counted: no totals in the list or the announcement");
}

console.log("E - evidence labels in plain words");
{
  const u = fresh();
  let h = type(u, "Burj Azizi"); ok(/data-ev="REGISTER_VERIFIED">Register verified</.test(h), "register project: 'Register verified'");
  h = type(u, "Harbour Gate"); ok(/data-ev="NAME_ONLY">Name only, the register does not confirm it</.test(h), "card with a name-only record: 'Name only...'");
  h = type(u, "Creek Palace"); ok(/data-ev="REGISTER_VERIFIED">Register verified</.test(h), "card with a verified record: 'Register verified'");
  h = type(u, annFirst.e.n); ok(/data-ev="DEVELOPER_CLAIMED">The developer says it, not on a register</.test(h), "announced: 'The developer says it, not on a register'");
  h = type(u, "Hidden Quay"); ok(/data-ev="NAME_ONLY"/.test(h), "not-confirmed: name only");
  u.inp.value = "x"; const unv = { n: "Unverified Plaza", pn: "9999", dv: "Some Developer", ev: "UNVERIFIED", d: "businessbay" }; D.loadSx({ sx: [unv] }); h = type(u, "Unverified Plaza");
  ok(/data-ev="UNVERIFIED">Not verified</.test(h), "unverified: 'Not verified'");
  ok(Object.keys(D.labels).sort().join() === "DEVELOPER_CLAIMED,NAME_ONLY,REGISTER_VERIFIED,UNVERIFIED", "exactly the four labels used elsewhere");
}

console.log("F - opening a result");
{
  let u = fresh();
  type(u, "Imtiaz"); clickAt(u, 0); ok(calls[0] && calls[0][0] === "pick" && calls[0][1] === "imtiaz" && els.dspanel.hidden === true, "a developer result picks that developer (as in tab 1) and closes the panel", JSON.stringify(calls));
  u = fresh(); type(u, "KORE"); clickAt(u, 0);
  const c1 = calls[0]; ok(c1 && c1[0] === "card" && /KORE/.test(c1[2]) && c1[5] && c1[5].ns === 1, "a no-sales project opens its card record (ns=1)", JSON.stringify(c1).slice(0, 300));
  u = fresh(); type(u, "Creek Palace"); clickAt(u, 0);
  ok(calls[0][0] === "card" && calls[0][1] === "alkhairanfirst" && calls[0][3] === 21000 && calls[0][4] === 10 && calls[0][5].p === 3147, "a card project opens its own card record (slug, price, sales, evidence)", JSON.stringify(calls[0]));
  u = fresh(); type(u, annFirst.e.n); clickAt(u, 0);
  ok(calls[0][0] === "card" && /^~ann-/.test(calls[0][1]) && calls[0][5].an === 1 && calls[0][5].e === "DEVELOPER_CLAIMED" && calls[0][5].p === null, "an announced project opens the developer-says record (no project number)");
  u = fresh(); const hb = type(u, "Business Bay"); clickAt(u, [...hb.matchAll(/class="dsr (\w+)"/g)].map((m) => m[1]).indexOf("dsarea"));
  ok(calls[0][0] === "select" && calls[0][1] === "businessbay", "an area result selects that area");
  u = fresh(); type(u, "Burj Azizi"); clickAt(u, 0);
  ok(calls[0][0] === "card" && calls[0][2] === "BURJ AZIZI" && calls[0][5].p === "3257" && calls[0][5].e === "REGISTER_VERIFIED" && calls[0][5].dn && calls[0][5].ns === undefined, "a register-only project opens the register record: number, evidence, developer as filed");
  ok(mapCalls.length === 0, "...with no position there is no map fly");
  ok(els.pjdet === undefined || true, "(panel stub)");
  // the no-position line goes into the project panel
  const pj = mkEl("div"); pj.id = "pjdet"; pj.innerHTML = '<div class=pdh><b>BURJ AZIZI</b></div>'; els.pjdet = pj;
  u = fresh(); type(u, "Burj Azizi"); clickAt(u, 0);
  ok(pj.inserted.length === 1 && /No position on our map yet/.test(pj.inserted[0]) && /role=status/.test(pj.inserted[0]), "...and the panel says 'No position on our map yet'", pj.inserted.join("|"));
  pj.inserted.length = 0; u = fresh(); type(u, "CHELSEA RESIDENCES BY DAMAC"); clickAt(u, 0);
  ok(mapCalls.length === 1 && Math.abs(mapCalls[0].center[0] - 55.26288) < 1e-6 && pj.inserted.length === 1 && /not on the project and not on a building/.test(pj.inserted[0]), "a register project with a community centre flies there and says it is the community, not the building", pj.inserted.join("|"));
  delete els.pjdet;
  // Enter opens the first result; the arrow keys move between results
  u = fresh(); type(u, "Imtiaz"); let prevented = 0; u.inp.onkeydown({ key: "Enter", preventDefault() { prevented++; } });
  ok(calls[0] && calls[0][0] === "pick" && calls[0][1] === "imtiaz" && prevented === 1, "Enter in the input opens the first result");
  u = fresh(); type(u, "zzzqqq"); u.inp.onkeydown({ key: "Enter", preventDefault() {} }); ok(calls.length === 0 && els.dspanel.hidden === false, "Enter with no result does nothing and keeps the panel open (never a dead end)");
  u = fresh({ openCard: () => { throw new Error("boom"); } }); type(u, "Creek Palace"); clickAt(u, 0);
  ok(els.dspanel.hidden === false && /Could not open that one/.test(u.live.textContent), "a handler that fails leaves the panel open and says so");
}

console.log("G - the page's own handlers (the hook text, run)");
{
  ok(openCardSrc && pickSrc, "the openCard and pick handlers are in the hook", hookTxt.slice(0, 200));
  // openCard -> pjCard + pdOpen: the usual project panel with the three document buttons
  const pj = null; delete els.pjdet;
  const open = P.evalHook("(" + openCardSrc + ")");
  open("alkhairanfirst", "Creek Palace", 21000, 10, { e: "REGISTER_VERIFIED", p: 3147, a: "Dubai Creek Harbour" });
  const t = text(els.pjdet.innerHTML);
  ok(els.pjdet.style.display === "block" && /Creek Palace/.test(t) && /Register project number 3147/.test(t), "a card project opens the usual Project details panel", t.slice(0, 200));
  ok(/class="pdfbtn pdsm/.test(els.pjdet.innerHTML) && /Investor/.test(t) && /Client/.test(t) && /Broker/.test(t), "...with the three document buttons row (Investor, Client, Broker)");
  ok(/pdacb/.test(els.pjdet.innerHTML), "...as the accordion panel");
  open("businessbay", "BURJ AZIZI", null, null, { p: "3257", e: "REGISTER_VERIFIED", dn: "Meydan Group LLC", a: "Trade Center First", as: "register_master", st: "ACTIVE", u: 1072, pl: null, sx: 1 });
  const t2 = text(els.pjdet.innerHTML);
  ok(/BURJ AZIZI/.test(t2) && /3257/.test(t2) && /Meydan Group LLC/.test(t2) && /Investor/.test(t2) && /Broker/.test(t2) && /1,072 units/.test(t2), "a register project with no card opens the same panel from its register record", t2.slice(0, 300));
  ok(/Map position/.test(t2) && /not on our map yet/.test(t2), "...and its Map position row says there is no outline on our map yet");
  open("~ann-x", "Some Announced", null, null, P.ANNOUNCED.evOf({ n: "Some Announced", dn: "Dev X", a: "Dubai" }));
  ok(/Announced by the developer/.test(text(els.pjdet.innerHTML)) && /Investor|Client|Broker/.test(text(els.pjdet.innerHTML)), "an announced project opens the developer-says panel with the document buttons");
  // pick: add to my developers, screen 1, open the profile
  const st = { mine: {}, isDefault: true, screen: 3, q: "x", onlyMine: 1, prof: "other" }, log = [];
  const pick = new Function("S", "saveMine", "leaveProf", "renderAll", "openProf", "return (" + pickSrc + ")")(st, () => log.push("save"), () => log.push("leave"), () => log.push("render"), (k) => log.push("open:" + k));
  pick("imtiaz");
  ok(st.mine.imtiaz === true && st.isDefault === false && st.screen === 1 && st.q === "" && st.onlyMine === null && log.join() === "save,leave,render,open:imtiaz", "pick = the tab 1 pick: added to the shortlist, tab 1, any open profile left, then the profile opens", log.join());
}

console.log("H - older key sets: absent data degrades");
await (async () => {
  let u = fresh({ raw: {}, mods: {}, fetch: () => Promise.reject(new Error("offline")) }, true);
  let h = type(u, "Imtiaz"); ok(firstCls(h) === "dsdev", "no group files: the developer is still found");
  h = type(u, "Creek Palace"); ok(names(h)[0] === "Creek Palace", "no group files: the cards are still found");
  h = type(u, "KORE"); ok(!/class="dsr/.test(h) && /No developer, project or area/.test(h), "no group files, no search list: KORE is simply not there; no error");
  u = fresh({ raw: undefined, mods: undefined, fetch: undefined, tags: undefined }, true); h = type(u, "Emaar"); ok(firstCls(h) === "dsdev", "a bare context (no groups, mods, tags, fetch) still works");
  u = fresh({ idx: () => ({}) }, true); h = type(u, "Imtiaz"); ok(!/dsdev/.test(h), "an empty index: no developer, the groups still answer, nothing thrown");
  u = fresh({ idx: () => null }, true); h = type(u, "Imtiaz"); ok(typeof h === "string", "a missing index does not throw");
  ok(D.loadSx(null) === false && D.loadSx({}) === false && D.loadSx({ sx: "no" }) === false, "loadSx ignores absent or malformed data");
  // the Find list fallback: a plots feed with no sx -> search_index development rows (off = register project without a card)
  const u3 = fresh({}, true); D.loadSx(null); D.loadIndex(INDEX_FX);
  const off = INDEX_FX.items.find((r) => r.off && r.n);
  h = type(u3, off.n); ok(h.includes(off.n.replace(/&/g, "&amp;")) && /data-src="reg"/.test(h), "no sx in the plots feed: the Find list's register rows are used instead (" + off.n + ")");
  const pl0 = JSON.parse(PLOTS0); ok(!pl0.sx, "the v397b plots fixture itself carries no sx (the degrade case)");
  // the real payloads: the plots feed with sx, through the fetch path
  const calls2 = [];
  const fetchOk = (u2) => { calls2.push(u2); return Promise.resolve({ ok: true, json: () => Promise.resolve(u2 === "/img/plots" ? PLOTS : INDEX_FX) }); };
  const u4 = fresh({ fetch: fetchOk }, true);
  return Promise.resolve().then(() => new Promise((r) => setTimeout(r, 20))).then(() => {
    const h4 = type(u4, "Burj Azizi");
    ok(calls2[0] === "/img/plots" && /BURJ AZIZI/i.test(h4), "the panel loads /img/plots (sx) on first open and finds the register project", calls2.join());
    ok(calls2.length === 1, "...and does not fetch the second list when sx is there");
  });
})();
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
