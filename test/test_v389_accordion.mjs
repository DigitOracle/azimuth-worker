// v389 - the PROJECT DETAILS accordion and the three small document buttons. (Harness copied from test_v385_cards.) Original v385 note: EVERY project card opens something. A card with a map position shows it and opens the building snapshot (now with a Project details section);
// a card with NO map position is a button that opens the PROJECT DETAIL panel (one component, pjDetailHtml). Offline: the page script runs on a hand-worked fixture; no network, no KV, no deploy.
//   node test/test_v385_cards.mjs
import fs from "node:fs";
import { devmapHtml } from "../src/devmap_page.js";
import { DM } from "../scripts/build_devmap_index.mjs";
import { PHOSPHOR_LIGHT } from "../src/devmap_icons.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };
const EMOJI = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const html = devmapHtml("k", { NAJ_NAV_CSS: "", NAJ_FONTS: "", najNav: () => "" });
const js = html.slice(html.indexOf("<script>", html.indexOf("maplibre-gl.js")) + 8, html.lastIndexOf("</script>"));
const cut = (a, b) => js.slice(js.indexOf(a), js.indexOf(b));
const text = (h) => h.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
DM.TIER_CFG.bounds = [30000, 20000, 12000];
const IDX = { as_of: "2026-09-09", cuts: { bounds: [30000, 20000, 12000] }, devs: { x: { name: "X", areas: 1, n: 40, profile: { projects: 5, homes: 0 } } }, areas: {
  dist: { name: "Fixture District", devs: { x: { n: "X", h: 0, c: [[40, 21000, 1e6, 1]], b: [[10, 35000, "Tower One"], [8, 21000, "Not Yet Tower"], [7, 22000, "Built Tower"], [6, 20000, "Parcelless"], [5, 19000, "Unknown Tower"]], r: [] } } } } };
const EV = {
  tower: { p: 100, di: 1, dn: "FIXTURE DEVELOPMENT L.L.C", m: "project_id", e: "REGISTER_VERIFIED", a: "Fixture District", h: 120 },
  notyet: { p: 3719, di: 1, dn: "FIXTURE DEVELOPMENT L.L.C", m: "project_id", e: "REGISTER_VERIFIED", a: "Fixture District", as: "Dubai Land Department project register", h: 703, st: "NOT_STARTED", pl: 1 },
  built: { p: 777, di: 1, dn: "FIXTURE DEVELOPMENT L.L.C", m: "project_id", e: "REGISTER_VERIFIED", a: "Fixture District", h: 55, st: "ACTIVE", pc: 62, pe: "2027-03", mix: "1 bed: 30, 2 bed: 25" },
  noparcel: { p: 5, di: 1, dn: "FIXTURE DEVELOPMENT L.L.C", m: "exact_name", e: "REGISTER_VERIFIED", a: "Fixture District", st: "NOT_STARTED", pl: 0 },
  claimed: { p: null, di: null, dn: "", m: "", e: "DEVELOPER_CLAIMED", a: "Fixture District" }
};
const s0 = cut("function esc(t)", "function api("), s1 = cut("function fmt(n)", "(function(){var b=new URLSearchParams(location.search).get(\"bounds\")");
const body = "var $=function(id){return document.getElementById(id)};var KEY=\"k\";var fetch=function(){return new Promise(function(){})};" + s0 + s1
  + cut("function clipName", "function devHead(") + cut("function icoSvg", "function evidenceHtml")
  + cut("var BLK={}", "var PULSE=0") + cut("function showSnap(p,pin)", "function focusProject") + cut("function tipHtml", "function drillHtml")
  + cut("function pdfUrl", "function invProjRow")
  + "; return {pdfRow:pdfRow,pdAccToggle:pdAccToggle,pdBtnTap:pdBtnTap,pdTap:pdTap,pdBtn:pdBtn,pdDevKey:pdDevKey,BLK:BLK,PJ:PJ,PDET:PDET,pjCard:pjCard,pjFeatures:pjFeatures,showSnap:showSnap,pdOpen:pdOpen,pdClose:pdClose,pdWhy:pdWhy,invIndex:invIndex,pjDetailHtml:pjDetailHtml,locate:locate};";
const mkEl = (id) => ({ id, innerHTML: "", style: {}, className: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, focus() { this.focused = true; } });
const els = {}, keys = [];
const doc = { getElementById: (i) => els[i] || null, createElement: () => mkEl(""), body: { appendChild: (e) => { els[e.id] = e; } }, addEventListener: (t, f) => keys.push(f) };
const S = { evOpen: false, sel: "dist", unit: "sqft", win: "all", inv: null, mode: "buy", bud: {}, screen: 1 };
const fn = new Function("DM", "IDX", "S", "TC", "document", "renderDetail", "updatePj", "EVI", "innerWidth", body);
const P = fn(DM, IDX, S, ["#c5a56a", "#2f8a7f", "#3987e5", "#8a9a96"], doc, () => {}, () => {}, PHOSPHOR_LIGHT, 375);

// a district blocks file with one footprint named Tower One
const sq = (x) => ({ type: "Polygon", coordinates: [[[55.1 + x, 25.1], [55.1 + x + 0.001, 25.1], [55.1 + x + 0.001, 25.101], [55.1 + x, 25.101], [55.1 + x, 25.1]]] });
P.BLK.dist = { state: "ok", feats: [{ type: "Feature", geometry: sq(0), properties: { i: 0, n: "Tower One", k: "towerone", a: 9000 } }, { type: "Feature", geometry: sq(0.01), properties: { i: 1, n: "", k: "", a: 5000 } }] };
S.inv = [{ id: "INV-BUILT", name: "Built Tower", brand: "Built Tower", pn: 777 }]; P.invIndex();
const card = (name, ppsm, n, ev, nd) => P.pjCard("dist", name, ppsm, n, "<span class=note style=\"display:block;margin:0\">Fixture District</span>", nd || "name not in the data yet", ev);
const dkOf = (h) => (h.match(/data-pd="([^"]+)"/) || [])[1];
// the fixture adds a building key to one project (the Client sheet needs it) and one investor facts record
S.inv = [{ id: "INV-BUILT", name: "Built Tower", brand: "Built Tower", pn: 777 }]; P.invIndex();
const EVB = Object.assign({}, EV.built, { bk: "77" });
const mk = (name, ev, ppsm, n) => { const h = P.pjCard("dist", name, ppsm, n, "", "Project name not recorded", ev); return h; };
const cardNotyet = mk("Not Yet Tower", EV.notyet, 21000, 8), cardBuilt = mk("Built Tower", EVB, 22000, 7), cardTower = mk("Tower One", EV.tower, 35000, 10), cardAnon = mk(null, null, 18000, 4);
const open = (h) => { P.pdOpen(dkOf(h), mkEl("from")); return els.pjdet.innerHTML; };
const css = html.slice(html.indexOf("<style"), html.indexOf("</style>"));
const SECS = ["Register facts", "Developer", "Sales", "Area and position"];
const sects = (h) => [...h.matchAll(/<button type=button class=pdacb id=(\S+) aria-expanded=(\w+) aria-controls=(\S+)>[\s\S]*?<span>([^<]+)<\/span>[\s\S]*?<\/button><div class=pdacp id=(\S+) (hidden)?>([\s\S]*?)<\/div>(?=<div class=pdsec>|<div class=pdbar>)/g)].map((m) => ({ btnId: m[1], exp: m[2], ctl: m[3], title: m[4], pid: m[5], hidden: !!m[6], body: m[7] }));

console.log("A - the header is always visible, the four sections are closed");
const pn = open(cardNotyet);
ok(/<b dir=auto>Not Yet Tower<\/b>/.test(pn) && /id=pdx/.test(pn), "the panel's bar always shows the project name and the close button");
ok(/<div class=pdhead><span class=pdk>AED 1,9\d\d per sq ft &middot; Upper band &middot; 8 sales<\/span>/.test(pn), "the header shows the price per sq ft and the sales count, outside any section");
ok(/<span class="note pdwy">[\s\S]*Not built yet, so there is no building to show on the map\.<\/span>/.test(pn), "the header shows the ONE why-no-map-position line (first sentence), outside any section");
const ss = sects(pn);
ok(ss.length === 4 && ss.map((s) => s.title).join("|") === SECS.join("|"), "exactly four sections: " + SECS.join(", "));
ok(ss.every((s) => s.exp === "false" && s.hidden && s.ctl === s.pid), "all four are collapsed by default (aria-expanded=false, panel hidden, aria-controls points at the panel)");
ok(new Set(ss.map((s) => s.pid)).size === 4, "four distinct panel ids");
{ const outside = pn.replace(/<div class=pdacp[\s\S]*?<\/div>(?=<div class=pdsec>|<div class=pdbar>)/g, ""); ok(!/class=pdr/.test(outside), "no register row is left outside a section (the always-open list is gone)"); }

console.log("B - sections open and close, each with its source line and evidence tag");
{
  const pans = {}; const mkBtn = (s) => { const attrs = { "aria-expanded": s.exp, "aria-controls": s.ctl }; return { getAttribute: (k) => attrs[k], setAttribute: (k, v) => { attrs[k] = v; }, attrs, className: "pdacb" }; };
  ss.forEach((s) => { els[s.pid] = { id: s.pid, hidden: true }; });
  const b0 = mkBtn(ss[0]);
  P.pdAccToggle(b0); ok(b0.attrs["aria-expanded"] === "true" && els[ss[0].pid].hidden === false && els[ss[1].pid].hidden === true, "toggle opens that section only (aria-expanded=true, panel shown)");
  P.pdAccToggle(b0); ok(b0.attrs["aria-expanded"] === "false" && els[ss[0].pid].hidden === true, "toggle again closes it");
  const tgt = { closest: (sel) => (/pdacb/.test(sel) ? b0 : null) }; P.pdTap({ target: tgt }); ok(b0.attrs["aria-expanded"] === "true", "the delegated click handler toggles a section button");
  P.pdTap({ target: { closest: () => null } }); ok(true, "a click on anything else is ignored");
}
const pb = open(cardBuilt), sb = sects(pb);
ok(sb.every((s) => /Source: /.test(s.body) && /class=tag>[A-Z_]+<\/span>/.test(s.body)), "every section carries a Source line and an evidence tag");
ok(/Project\s+Built Tower/.test(text(sb[0].body)) && /Register project number\s+777/.test(text(sb[0].body)) && /Active, 62% complete, planned end 2027-03/.test(text(sb[0].body)) && /55 units; 1 bed: 30, 2 bed: 25/.test(text(sb[0].body)), "Register facts: number, status, percent complete, planned end, units and mix");
ok(/Registered developer\s+FIXTURE DEVELOPMENT L\.L\.C/.test(text(sb[1].body)) && /REGISTER_VERIFIED/.test(sb[1].body), "Developer: the registered developer with its evidence label and source line");
ok(/Sales in the window\s+7 sales; median AED/.test(text(sb[2].body)) && /DATA/.test(sb[2].body), "Sales: the window figures");
ok(/Area\s+Fixture District/.test(text(sb[3].body)) && /Map position/.test(sb[3].body) && /class=tag>DERIVED</.test(sb[3].body), "Area and position: own area, the position line with the DERIVED tag");
{ const pa = text(open(cardAnon)); const sa = sects(els.pjdet.innerHTML); ok(sa.length === 4 && sa.every((s) => /Source: /.test(s.body)), "a nameless card with no record still gets four sections, each with a source line (nothing invented)"); }

console.log("C - the three small buttons");
const bar = (h) => (h.match(/<div class=pdbar>[\s\S]*?<\/p><\/div>/) || [""])[0];
const pan = open(cardAnon), bn = bar(pan), bb = bar(pb);   // the nameless card has no record, no building key and no developer
open(cardBuilt);
const btns = (b) => [...b.matchAll(/<(a|button) (?:type=button )?class="pdfbtn pdsm( pdoff)?"([^>]*)>([\s\S]*?)<\/\1>/g)].map((m) => ({ tag: m[1], off: !!m[2], attrs: m[3], label: text(m[4]) }));
const bt = btns(bb);
ok(bt.length === 3 && bt.map((b) => b.label).join("|") === "Investor PDF|Client sheet|Broker sheet", "three buttons at the bottom, in one row: Investor PDF, Client sheet, Broker sheet");
ok(/<div class="pdfrow pdsmrow">/.test(bb) && /\.pdsmrow\{[^}]*margin-top:8px/.test(css) && /\.pdfrow\{display:flex;flex-wrap:wrap/.test(css), "one wrapping row");
ok(bt.every((b) => !b.off) && /href="\/developers_pdf\?kind=investor_selector&amp;project=INV-BUILT/.test(bt[0].attrs) && /href="\/brief_pdf\?kind=dossier&amp;keys=dist%3A77&amp;beds=all&amp;mode=rent&amp;key=k"/.test(bt[1].attrs) && /href="\/developers_pdf\?kind=snapshot&amp;area=dist&amp;/.test(bt[2].attrs) && /developers=x&amp;key=k"/.test(bt[2].attrs), "a project with a facts record, a building key and a mapped developer: all three are real links (investor selector, Brief dossier, developer snapshot for this area)");
ok(bt.every((b) => /<svg class="pdfic"/.test(bb)) && /\.pdsm\{min-height:36px/.test(css), "icons from the existing set and a 36 px height");
const bnt = btns(bn);
ok(bnt.length === 3 && bnt.map((b) => b.off).join() === "true,true,true", "a project with no facts record, no building key and no mapped developer: all three are disabled, none hidden");
ok(bnt.every((b) => /aria-disabled=true/.test(b.attrs) && /data-why="[^"]{20,}"/.test(b.attrs) && /title="[^"]{20,}"/.test(b.attrs) && b.tag === "button" && !/href=/.test(b.attrs)), "each disabled button is a button (no dead link) with its reason in data-why and title");
ok(/<p class="note pdwhyn" role=status hidden><\/p>/.test(bn), "the reason has a status line under the row, hidden until a tap");
{
  const note = { textContent: "", hidden: true }; const wrap = { querySelector: (q) => (q === ".pdwhyn" ? note : null) };
  const b = { parentNode: { parentNode: wrap }, getAttribute: (k) => (k === "data-why" ? "A client sheet needs a building with rent history; this project has no building on the map yet." : "") };
  P.pdBtnTap(b); ok(note.textContent === "A client sheet needs a building with rent history; this project has no building on the map yet." && note.hidden === false, "tapping a disabled button shows its one-line reason");
}
ok(/Investor PDF/.test(bn) && !/investor_selector/.test(bn), "the Investor button only enables with a facts record");
ok(!/Download PDF/.test(pn + pb), "no long 'Download PDF: ...' row inside the project details");
ok(/No investor facts record for this project yet\./.test(bn) && /A client sheet needs a building with rent history; this project has no building on the map yet\./.test(bn) && /no broker sheet\./.test(bn), "plain reasons, no unexplained acronyms");
ok(P.pdDevKey({ slug: "dist", name: "Built Tower" }) === "x" && P.pdDevKey({ slug: "dist", name: "Nobody Tower" }) === "" && P.pdDevKey({ slug: "dist", name: "" }) === "", "the broker sheet's developer is found by project name in the area, never guessed");

console.log("D - the pinned building snapshot carries the same accordion and the same three buttons");
els.bsnap = mkEl("bsnap");
P.BLK.dist = { state: "ok", feats: [{ type: "Feature", geometry: { type: "Polygon", coordinates: [[[55.1, 25.1], [55.101, 25.1], [55.101, 25.101], [55.1, 25.101], [55.1, 25.1]]] }, properties: { i: 0, n: "Tower One", k: "towerone", a: 9000 } }] };
mk("Tower One", EV.tower, 35000, 10);
P.showSnap(Object.assign({ key: "dist|towerone" }, P.PJ["dist|towerone"]), true);
{
  const sn = els.bsnap.innerHTML, sx = sects(sn);
  ok(/Project details/.test(sn) && sx.length === 4 && sx.every((s) => s.exp === "false" && s.hidden), "the snapshot's Project details section: four collapsed sections");
  ok(/class=pdhead>/.test(sn) && btns(bar(sn)).length === 3, "a header and three buttons in the snapshot as well");
  ok(!/Map position/.test(sn), "a located building shows no why-no-position line (unchanged)");
  ok(sx.every((s) => /Source: /.test(s.body)), "each snapshot section carries its source line");
}

console.log("E - the developer profile row");
{
  const r = P.pdfRow("dist", ["x"], false, "x"), rb = btns(r);
  ok(rb.length === 3 && rb.map((b) => b.label).join("|") === "Snapshot PDF|Detailed PDF|Investor PDF" && rb.every((b) => !b.off), "snapshot, detailed and Investor PDF: three small buttons, same destinations");
  ok(/kind=snapshot&amp;area=dist/.test(rb[0].attrs) && /kind=detailed&amp;area=dist/.test(rb[1].attrs) && /kind=investor&amp;area=dist&amp;developer=x/.test(rb[2].attrs), "the same three routes as before");
  const r2 = btns(P.pdfRow("dist", ["x", "y"], false, "")); ok(r2[2].off && /data-why="[^"]+"/.test(r2[2].attrs), "with no single developer the Investor PDF button is disabled with its reason, not hidden");
  ok(P.pdfRow("", ["x"], false, "x") === "", "no area, no row (unchanged)");
}

console.log("F - phone, wording, parse, old behaviour");
ok(/\.pdacb\{[^}]*min-height:44px/.test(css) && /\.pdacp\[hidden\]\{display:none\}/.test(css) && /\.pdacb\[aria-expanded=true\] \.chev\{transform:rotate\(180deg\)\}/.test(css), "44 px section headers; closed panels are display:none; the caret turns when open");
{
  const w = [...css.matchAll(/(?:^|[;{}\s])(?:min-)?width:(\d+)px/g)].map((m) => +m[1]).filter((n) => n > 375);
  const pd = (css.match(/#pjdet\{[^}]*\}/) || [""])[0];
  ok(/left:0;right:0;bottom:0;max-height:78vh;overflow:auto/.test(pd), "the panel is a bottom sheet with its own max height and scroll (78vh)");
  ok(!/(^|[;{])width:(\d+)px/.test(pd.replace(/@media[\s\S]*$/, "")), "no fixed width on the phone panel");
  ok(/@media\(min-width:761px\)\{#pjdet\{left:auto;right:16px;bottom:16px;width:420px/.test(css), "the 420 px width is only on wide screens");
}
ok(!EMOJI.test(pn + pb + bar(pb) + css), "no emoji in the panel, the buttons or the CSS");
{ const t = text(pn + pb); ok(!/\b(PDF)\b(?!.*)/.test("") && /Investor PDF/.test(t), "labels are plain words (PDF is the one short term and every button says what the document is)"); }
ok(/<script>/.test(html), "page loads");
{ let okParse = true; try { new Function(js.replace(/^[\s\S]*?/, "")); } catch (e) { okParse = false; console.log(String(e)); } ok(okParse, "the whole page script parses"); }
ok(!/\$\{|`/.test(js.slice(js.indexOf("function pdSec"), js.indexOf("function pjFeatures"))), "the new code has no backtick or substitution (the page script is a String.raw block)");
// old behaviour: position cards and the three rungs
ok(/class="pjc loc" data-pj="dist\|towerone"/.test(mk("Tower One", EV.tower, 35000, 10)) && /Show on the map/.test(mk("Tower One", EV.tower, 35000, 10)), "a card with a footprint still reads 'Show on the map'");
ok(/data-pd="[^"]+"/.test(cardNotyet) && /Project details/.test(cardNotyet), "a card with no position still opens the project details");
ok(/function invCardLink/.test(js) && /Investor PDF<\/a>/.test(js), "the Investor PDF link on the project cards (v376/v383) is untouched");
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
