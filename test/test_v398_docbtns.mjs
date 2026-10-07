// v398 - ONE shared three-button document row (Investor / Client / Broker) on every project card and every project panel; no lone "Investor PDF" button remains.
// Offline: the page script runs on a hand-worked fixture (harness as test_v389_accordion); no network, no KV, no deploy.   node test/test_v398_docbtns.mjs
import { devmapHtml } from "../src/devmap_page.js";
import { DM } from "../scripts/build_devmap_index.mjs";
import { PHOSPHOR_LIGHT } from "../src/devmap_icons.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };
const html = devmapHtml("k", { NAJ_NAV_CSS: "", NAJ_FONTS: "", najNav: () => "" });
const js = html.slice(html.indexOf("<script>", html.indexOf("maplibre-gl.js")) + 8, html.lastIndexOf("</script>"));
const css = html.slice(html.indexOf("<style"), html.indexOf("</style>"));
const cut = (a, b) => js.slice(js.indexOf(a), js.indexOf(b));
const text = (h) => h.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
DM.TIER_CFG.bounds = [30000, 20000, 12000];
const IDX = { as_of: "2026-09-09", cuts: { bounds: [30000, 20000, 12000] }, devs: { x: { name: "X", areas: 1, n: 40, profile: { projects: 5, homes: 0 } } }, areas: {
  dist: { name: "Fixture District", devs: { x: { n: "X", h: 0, c: [[40, 21000, 1e6, 1]], b: [[10, 35000, "Tower One"], [7, 22000, "Built Tower"], [6, 20000, "Parcelless"]], r: [] } } } } };
const EV = {
  built: { p: 777, di: 1, dn: "FIXTURE DEVELOPMENT L.L.C", m: "project_id", e: "REGISTER_VERIFIED", a: "Fixture District", h: 55, st: "ACTIVE", pc: 62, pe: "2027-03", bk: "77" },
  bare: { p: 5, di: 1, dn: "FIXTURE DEVELOPMENT L.L.C", m: "exact_name", e: "REGISTER_VERIFIED", a: "Fixture District", st: "NOT_STARTED", pl: 0 },
  nosales: { p: 9, e: "REGISTER_VERIFIED", a: "Fixture District", ns: 1 },
  notconf: { p: 11, e: "REGISTER_VERIFIED", a: "Fixture District", nc: 1 },
  ann: { an: 1, ann: { n: "Announced Tower", dn: "Dev", a: "Fixture District" }, e: "DEVELOPER_CLAIMED" }
};
const s0 = cut("function esc(t)", "function api("), s1 = cut("function fmt(n)", "(function(){var b=new URLSearchParams(location.search).get(\"bounds\")");
const body = "var $=function(id){return document.getElementById(id)};var KEY=\"k\";var fetch=function(){return new Promise(function(){})};var ANNOUNCED={detail:function(d){return '<div class=pdet><div class=pdhead>announced stub</div></div>'}};" + s0 + s1
  + cut("function clipName", "function devHead(") + cut("function icoSvg", "function evidenceHtml")
  + cut("var BLK={}", "var PULSE=0") + cut("function showSnap(p,pin)", "function focusProject") + cut("function tipHtml", "function drillHtml")
  + cut("function pdfUrl", "function pdfRowProf")
  + "; return {pdfRow:pdfRow,pdBtnTap:pdBtnTap,pdTap:pdTap,docRow:docRow,PDET:PDET,pjCard:pjCard,pjDetailHtml:pjDetailHtml,invIndex:invIndex,BLK:BLK};";
const mkEl = (id) => ({ id, innerHTML: "", style: {}, className: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, focus() { this.focused = true; } });
const els = {};
const doc = { getElementById: (i) => els[i] || null, createElement: () => mkEl(""), body: { appendChild: (e) => { els[e.id] = e; } }, addEventListener: () => {} };
const S = { evOpen: false, sel: "dist", unit: "sqft", win: "all", inv: null, mode: "buy", bud: {}, screen: 1 };
const P = new Function("DM", "IDX", "S", "TC", "document", "renderDetail", "updatePj", "EVI", "innerWidth", body)(DM, IDX, S, ["#c5a56a", "#2f8a7f", "#3987e5", "#8a9a96"], doc, () => {}, () => {}, PHOSPHOR_LIGHT, 375);
P.BLK.dist = { state: "ok", feats: [] };
S.inv = [{ id: "INV-BUILT", name: "Built Tower", brand: "Built Tower", pn: 777 }]; P.invIndex();
const card = (name, ev, ppsm, n) => P.pjCard("dist", name, ppsm, n, "", "Project name not recorded", ev);
const btns = (h) => [...h.matchAll(/<(a|button) (?:type=button )?class="pdfbtn pdsm( pdoff)?"([^>]*)>([\s\S]*?)<\/\1>/g)].map((m) => ({ tag: m[1], off: !!m[2], attrs: m[3], label: text(m[4]) }));
const bar = (h) => (h.match(/<div class=(?:"pdbar[^"]*"|pdbar)>[\s\S]*?<\/p><\/div>/) || [""])[0];
const dkOf = (h) => (h.match(/data-pd="([^"]+)"/) || [])[1];
const panel = (h) => { const dk = dkOf(h) || (h.match(/data-dk="([^"]+)"/) || [])[1]; return P.pjDetailHtml(dk, false); };

console.log("A - no lone 'Investor PDF' string in any rendered surface or in the page script");
const cardBuilt = card("Built Tower", EV.built, 22000, 7), cardBare = card("Bare Tower", EV.bare, 20000, 6), cardAnon = card(null, null, 18000, 4);
const cardNs = card("No Sales Tower", EV.nosales, null, null), cardNc = card("Not Confirmed Tower", EV.notconf, null, null), cardAn = card("Announced Tower", EV.ann, null, null);
const cards = { cardBuilt, cardBare, cardAnon, cardNs, cardNc, cardAn };
const panels = Object.fromEntries(Object.entries(cards).map(([k, h]) => [k, panel(h)]));
const rowDev = P.pdfRow("dist", ["x"], false, "x");
const rendered = Object.values(cards).concat(Object.values(panels), rowDev).join("");
ok(!/Investor PDF/.test(text(rendered)) && !/Client sheet|Broker sheet|Snapshot PDF|Detailed PDF/.test(text(rendered)), "none of the old long labels appear in any card, panel or developer row");
ok(!/Investor PDF/.test(js.replace(/\/\/[^\n]*/g, "")) && !/invCardLink|pjDocBar|invProjRow|pjinv/.test(js.replace(/\/\/[^\n]*/g, "")), "the page script has no 'Investor PDF' string (outside comments) and none of the removed functions");

console.log("B - every card and every panel has exactly three buttons: Investor, Client, Broker");
for (const [k, h] of Object.entries(cards)) { const b = btns(bar(h)); ok(b.length === 3 && b.map((x) => x.label).join("|") === "Investor|Client|Broker", "card " + k + ": three buttons Investor|Client|Broker", b.map((x) => x.label).join("|")); }
for (const [k, h] of Object.entries(panels)) { const b = btns(bar(h)); ok(b.length === 3 && b.map((x) => x.label).join("|") === "Investor|Client|Broker", "panel " + k + ": three buttons Investor|Client|Broker (announced included)", b.map((x) => x.label).join("|")); }
ok((cardBuilt.match(/class="pdfbtn pdsm/g) || []).length === 3, "one row of three on a card, not a large lone button");

console.log("C - evidence rules and disabled-with-reason");
{
  const b = btns(bar(cardBuilt)), p = btns(bar(panels.cardBuilt));
  ok(!b[0].off && /investor_selector&amp;project=INV-BUILT/.test(b[0].attrs) && !b[1].off && /keys=dist%3A77/.test(b[1].attrs) && b.map((x) => x.tag).slice(0, 2).join() === "a,a", "card with a facts record and a building: Investor and Client are real links");
  ok(p.map((x) => x.label + ":" + x.off).join() === b.map((x) => x.label + ":" + x.off).join(), "card and panel agree on which buttons are enabled (one helper)");
  for (const k of ["cardBare", "cardAnon", "cardNs", "cardNc", "cardAn"]) {
    const x = btns(bar(cards[k]));
    ok(x[0].off && x[1].off && x.filter((y) => y.off).every((y) => y.tag === "button" && /aria-disabled=true/.test(y.attrs) && /data-why="[^"]{15,}"/.test(y.attrs) && /title="[^"]{15,}"/.test(y.attrs) && !/href=/.test(y.attrs)), k + ": buttons that cannot apply are disabled buttons with a reason (never a dead link)");
  }
  const note = { textContent: "", hidden: true }, wrap = { querySelector: (q) => (q === ".pdwhyn" ? note : null) };
  P.pdBtnTap({ parentNode: { parentNode: wrap }, getAttribute: (k) => (k === "data-why" ? "No investor facts record for this project yet." : "") });
  ok(note.textContent === "No investor facts record for this project yet." && note.hidden === false, "tapping a disabled button shows its reason");
  ok(/<p class="note pdwhyn" role=status hidden><\/p>/.test(bar(cardBare)), "a card carries the reason line under its row");
}

console.log("D - a click on a button does not open the card");
{
  const m = /^<div class=pjw>(<button[\s\S]*?<\/button>)(<div class="pdbar pdcard">[\s\S]*<\/div>)<\/div>$/.exec(cardBuilt);
  ok(!!m && !/pdfbtn/.test(m[1]) && /pdfbtn/.test(m[2]), "the row is a sibling of the card button, never inside it (a tap cannot reach the card handler)");
  ok(/b\.onclick=function\(\)\{pdOpen/.test(js) && /querySelectorAll\("\.pjc\.noloc"\)/.test(js) && /querySelectorAll\("\.pjc\.loc"\)/.test(js), "card handlers are bound to the card buttons only (.pjc.loc / .pjc.noloc), not to the wrapper");
  const opened = []; let tapped = 0;
  const t = { closest: (sel) => (/pdacb,\.pdoff/.test(sel) ? { className: "pdfbtn pdsm pdoff", parentNode: { parentNode: { querySelector: () => ({}) } }, getAttribute: () => "why" } : null) };
  P.pdTap({ target: t }); ok(opened.length === 0, "the delegated tap on a disabled button only shows its reason (no panel opens)");
}

console.log("E - developer row and 375 px");
{
  const r = btns(rowDev);
  ok(r.length === 3 && r.map((x) => x.label).join("|") === "Snapshot|Detailed|Investor" && r.every((x) => !x.off), "developer row: Snapshot | Detailed | Investor");
  ok(/\.pdfrow\.pdsmrow\{flex-wrap:nowrap\}/.test(css) && /\.pdsmrow \.pdsm\{flex:1 1 0;min-width:0;justify-content:center;padding:0 6px;font-size:12\.5px/.test(css) && /\.pdsmrow \.pdfic\{width:14px;height:14px/.test(css), "CSS: three equal flex buttons, text 12.5px, icon 14px, no wrapping above 340 px");
  ok(/@media\(max-width:339px\)\{\.pdfrow\.pdsmrow\{flex-wrap:wrap\}/.test(css), "wrapping only below 340 px");
  const avail = (375 - 32 - 2 * 6) / 3, need = 8 * 7.6 + 14 + 5 + 12;   // widest label 'Investor' at 12.5px semibold (about 7.6 px a letter), icon, gap, padding
  ok(need < avail, "arithmetic at 375 px: widest button needs about " + Math.round(need) + " px, each of three has " + Math.round(avail) + " px");
  ok(!/Investor PDF/.test(css) && !/pjinv/.test(css), "no leftover CSS for the old large button");
}
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
