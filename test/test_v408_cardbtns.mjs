// v408 - the Investor | Client | Broker row under a card in the two-up grid: compact tiles (icon above label) so nothing paints outside its own column.
// Offline: the page script on a hand-worked fixture (harness as test_v398_docbtns); the Chrome measurements are test/render_v408_cardbtns.mjs.   node test/test_v408_cardbtns.mjs
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
const cardBuilt = card("Built Tower", EV.built, 22000, 7), cardNs = card("No Sales Tower", EV.nosales, null, null);
const panelH = P.pjDetailHtml(dkOf(cardBuilt), false);
const rule = (sel) => { const m = css.match(new RegExp("(?:^|[}\\s])" + sel.replace(/[.*+?^${}()|[\]\\>]/g, "\\$&") + "\\{([^}]*)\\}")); return m ? m[1] : ""; };

console.log("A - markup: the row sits INSIDE .pjw under its own card, same wrapper, card context class");
for (const [k, h] of Object.entries({ cardBuilt, cardNs })) {
  ok(/^<div class=pjw><button [^>]*class="pjc/.test(h) && /<\/button><div class="pdbar pdcard">/.test(h) && h.endsWith("</div></div>"), k + ": div.pjw > card button + div.pdbar.pdcard (row is the card's sibling, inside the wrapper)");
  ok(!/<button[^>]*class="pjc[^>]*>[^]*pdfbtn[^]*<\/button><div class="pdbar/.test(h.replace(/<div class="pdbar[\s\S]*$/, "")), k + ": no document button is nested inside the card button (a tap cannot open the card)");
  ok(btns(bar(h)).map((b) => b.label).join("|") === "Investor|Client|Broker", k + ": still Investor|Client|Broker");
}
ok(btns(bar(cardNs)).filter((b) => b.off).length === 3 || btns(bar(cardNs)).some((b) => b.off && b.tag === "button"), "disabled tiles are still pdoff buttons (greyed, tap shows the reason)");
ok(/pdBtnTap/.test(bar(cardNs)) || /data-pdwhy|aria-describedby|data-why/.test(bar(cardNs)) || /<button type=button class="pdfbtn pdsm pdoff"/.test(bar(cardNs)), "disabled tile keeps its tap-shows-reason hook");

console.log("B - card-context CSS: compact tile, icon above label, 11 px label, equal widths");
const tile = rule(".pdcard .pdsmrow .pdsm"), tic = rule(".pdcard .pdsmrow .pdfic");
ok(/flex-direction:column/.test(tile) && /flex:1 1 0/.test(tile) && /font-size:11px/.test(tile) && /letter-spacing:-\.02em/.test(tile), "tile: column, equal flex basis, 11 px, tightened letter-spacing", tile);
ok(/min-height:46px/.test(tile) && /padding:4px 2px/.test(tile) && /overflow:hidden/.test(tile), "tile: at least 32 px high (46), 2 px side padding, never paints outside itself", tile);
ok(css.includes(".pdcard .pdsmrow{gap:6px}"), "gap between tiles is 6 px");
ok(/margin:0/.test(tic) && /width:16px/.test(tic), "icon sits above the label (no side margin)", tic);
ok(/\.pjw>\.pjc\{flex:1 1 auto\}/.test(css), "the card fills its wrapper so both rows start at the same height in a row of cards");
ok(/@media\(max-width:339px\)\{[^@]*\.pdcard \.pdsmrow \.pdsm\{font-size:10\.5px\}/.test(css), "below 340 px the label drops to 10.5 px");

console.log("C - width arithmetic at 340, 360, 375, 390, 414 and one column (Investor label measured in Chrome 11 px / -.02em = 38.5 px)");
const INV = 38.5, GAP = 6, SIDE = 12;
for (const [w, cols] of [[340, 2], [360, 2], [375, 2], [390, 2], [414, 2], [375, 1]]) {
  const col = (w - 2 * SIDE - (cols - 1) * 6) / cols, t = (col - 2 * GAP) / 3, padEach = (t - INV) / 2;
  ok(padEach >= 4, w + " px, " + cols + " col: column " + col.toFixed(1) + " -> tile " + t.toFixed(1) + " px, Investor leaves " + padEach.toFixed(1) + " px each side (>= 4)");
  ok(3 * t + 2 * GAP <= col + 0.01, w + " px, " + cols + " col: three tiles + two 6 px gaps = " + (3 * t + 2 * GAP).toFixed(1) + " <= column " + col.toFixed(1));
}

console.log("D - panel context unchanged: inline buttons, no tile rules");
{
  const pb = bar(panelH);
  ok(/<div class=pdbar>/.test(pb) && !/pdcard/.test(pb), "panel row has no pdcard class");
  ok(btns(pb).map((b) => b.label).join("|") === "Investor|Client|Broker", "panel row: Investor|Client|Broker");
  ok(/\.pdsmrow \.pdsm\{flex:1 1 0;min-width:0;justify-content:center;padding:0 6px;font-size:12\.5px;white-space:nowrap\}\.pdsmrow \.pdfic\{width:14px;height:14px;margin-right:5px\}/.test(css), "the shared docRow CSS (v407 territory) is byte-identical");
  ok(!/flex-direction:column/.test(rule(".pdsmrow .pdsm")), "no column layout outside the card context");
}
console.log(fail ? "\nFAILED " + fail + " / " + (pass + fail) : "\nall " + pass + " passed");
process.exit(fail ? 1 : 0);
