// v751 - a local render, NOT a test: Luma Park Views (stored rows, test/fixtures_v751) with the deterministic pages 2 and 3, the writer's
// live page 1 kept. Prints to PDF in local Chrome (print media, the worker's fit CSS + FIT_JS), counts the physical pages, and screenshots
// every page at A4 print size and the whole passport at 375 px phone width. node test/render_v751_pages.mjs <out dir> [before]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pagesBlocks, placePages } from "../src/passport_pages.js";
import { withNb } from "../src/passport_neighbourhood.js";
const B = await import("../src/building_passports.js");
const OUT = process.argv[2] || "./v751_out", BEFORE = process.argv[3] === "before";
fs.mkdirSync(OUT, { recursive: true });
const d = JSON.parse(fs.readFileSync(new URL("./fixtures_v751/luma_park_views.json", import.meta.url), "utf8"));
const live = fs.readFileSync(new URL("./fixtures_v751/luma_live_v750.html", import.meta.url), "utf8");
const TODAY = "2026-11-04";
const pack = withNb(d.pack, { nb: d.nb, dna: d.dna });
const f = B.bppFacts(d.pp, pack, TODAY);
const { p2, p3 } = pagesBlocks(d.pp, pack, TODAY, f, B.bppDate(TODAY));
const logo = (/src="(data:image\/png;base64,[^"]+)"/.exec(live) || [])[1] || "";
// the live file already carries its fit / snapshot styling; strip the old snapshot bands so they are added once, like the tick does
const base = live.replace(/<div class="bpp-snap">[\s\S]*?<\/div>/g, "");
let html = BEFORE ? base : placePages(base, p2, p3).replace(/(["'])najma_logo\.png\1/g, '"' + logo + '"');
html = B.snapshotNote(html, "2026-11-04T09:47:00Z");
const name = BEFORE ? "before" : "after";
fs.writeFileSync(path.join(OUT, name + ".html"), html);
const req = createRequire("C:/Dev/notebooklm-mcp/node_modules/");
const { chromium } = req("playwright-core");
const exe = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: exe });
try {
  // print: A4, the worker's fit CSS, the in-page measure, the PDF
  const pr = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  await pr.emulateMedia({ media: "print" });
  await pr.setContent(B.withFit(html), { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  await pr.evaluate(() => document.fonts.ready.then(() => true)).catch(() => {});
  const fit = await pr.evaluate(B.FIT_JS);
  const inner = await pr.evaluate(`(() => [...document.querySelectorAll(".bd-page")].map((pg) => { const out = []; pg.querySelectorAll(".bd-card").forEach((c) => { if (c.scrollHeight > c.clientHeight + 2 || c.scrollWidth > c.clientWidth + 2) out.push((c.querySelector(".bd-t") || {}).innerText + " h+" + (c.scrollHeight - c.clientHeight) + " w+" + (c.scrollWidth - c.clientWidth)); });
    const m = pg.querySelector(".bd-main"), f = pg.querySelector(".bd-foot"); return { page: pg.dataset.bppDet, clipped: out, main_bottom_mm: m ? Math.round((m.getBoundingClientRect().bottom - pg.getBoundingClientRect().top) / (96 / 25.4)) : null, foot_top_mm: f ? Math.round((f.getBoundingClientRect().top - pg.getBoundingClientRect().top) / (96 / 25.4)) : null }; }))()`);
  const pdf = await pr.pdf({ printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  fs.writeFileSync(path.join(OUT, name + ".pdf"), pdf);
  const pages = B.pdfPages(pdf);
  const n = await pr.evaluate(() => document.querySelectorAll(".page").length);
  for (let i = 0; i < n; i++) { const el = (await pr.$$(".page"))[i]; await el.screenshot({ path: path.join(OUT, name + "_a4_page" + (i + 1) + ".png") }); }
  console.log(JSON.stringify({ name, pdf_pages: pages, page_boxes: n, fit: fit.map((p) => ({ page: p.page, over_mm: p.over_mm, sections: p.sections })), inner }, null, 1));
  // phone
  const ph = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  await ph.setContent(html, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  await ph.evaluate(() => document.fonts.ready.then(() => true)).catch(() => {});
  const boxes = await ph.$$(".page");
  for (let i = 0; i < boxes.length; i++) await boxes[i].screenshot({ path: path.join(OUT, name + "_phone_page" + (i + 1) + ".png") });
  const wide = await ph.evaluate(() => document.documentElement.scrollWidth);
  console.log("phone scrollWidth", wide);
} finally { await browser.close(); }
