// v408 - a local render, NOT a test (no test_ prefix): the real page CSS and real pjCard/docRow output for two cards in the .pjg grid,
// measured in headless Chrome at several widths. Nothing leaves the machine.   node test/render_v408_cardbtns.mjs <out dir> [tag]
// needs playwright-core (C:/Dev/notebooklm-mcp/node_modules) and a local Chrome.
import fs from "node:fs";
import path from "node:path";
import { devmapHtml } from "../src/devmap_page.js";
import { DM } from "../scripts/build_devmap_index.mjs";
import { PHOSPHOR_LIGHT } from "../src/devmap_icons.js";
const _ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };
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
const OUT = process.argv[2] || "."; const TAG = process.argv[3] || "run"; fs.mkdirSync(OUT, { recursive: true });
const cards = [card("Kanyon By Beyond", EV.built, 22000, 7), card("Soulever By Beyond", EV.nosales, null, null)];
const docH = (one) => "<!doctype html><meta name=viewport content='width=device-width'><style>" + css.replace(/^<style[^>]*>/, "") + "body{margin:0;padding:0 12px;background:var(--ground);color:var(--ink);font-family:system-ui}</style><div id=g class=pjg" + (one ? " style='grid-template-columns:1fr'" : "") + ">" + cards.join("") + "</div>";
const { chromium } = await import("file:///C:/Dev/notebooklm-mcp/node_modules/playwright-core/index.mjs");
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const res = [];
for (const [w, one] of [[340, 0], [360, 0], [375, 0], [390, 0], [414, 0], [375, 1]]) {
  const pg = await browser.newPage({ viewport: { width: w, height: 700 }, deviceScaleFactor: 2 });
  await pg.setContent(docH(one)); await pg.waitForTimeout(100);
  const m = await pg.evaluate(() => {
    const r = (e) => { const b = e.getBoundingClientRect(); return { l: +b.left.toFixed(1), r: +b.right.toFixed(1), t: +b.top.toFixed(1), b: +b.bottom.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; };
    const ws = [...document.querySelectorAll(".pjw")].map((w) => ({ wrap: r(w), card: r(w.querySelector(".pjc")), bar: r(w.querySelector(".pdbar")), row: r(w.querySelector(".pdfrow")), btns: [...w.querySelectorAll(".pdsm")].map((b) => { const tn = [...b.childNodes].find((n) => n.nodeType === 3); const rg = document.createRange(); rg.selectNodeContents(tn); const tr = rg.getBoundingClientRect(); return { label: tn.textContent, box: r(b), text: { l: +tr.left.toFixed(1), r: +tr.right.toFixed(1), w: +tr.width.toFixed(1) }, fs: getComputedStyle(b).fontSize }; }) }));
    return { ws, scrollW: document.documentElement.scrollWidth, innerW: innerWidth };
  });
  m.w = w; m.one = !!one; res.push(m);
  await pg.screenshot({ path: path.join(OUT, TAG + "_" + w + (one ? "_one" : "") + ".png") });
  await pg.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT, TAG + "_measure.json"), JSON.stringify(res, null, 1));
for (const m of res) {
  console.log("viewport " + m.w + (m.one ? " (one column)" : "") + "  scrollWidth " + m.scrollW);
  m.ws.forEach((x, i) => { console.log("  card" + i + " col " + x.wrap.l + ".." + x.wrap.r + " (w " + x.wrap.w + ") bar " + x.bar.l + ".." + x.bar.r + " rowH " + x.row.h + " | " + x.btns.map((b) => b.label + " " + b.box.l + ".." + b.box.r + " h" + b.box.h + " txt" + b.text.w + "@" + b.fs).join(" ; ")); });
}
