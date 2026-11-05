// v766 - a local render, NOT a test: DAMAC Hills - Orchid A (plot 676-8698) with the worker's real pages 2, 3 and 4 built from the LIVE stored
// rows (every KV key the page builder asks for is read from the live namespace with wrangler and cached in <out>/kv/). Page 1 is the
// v751 fixture's writer page with the title swapped, only to check that the four pages print as 4 and nothing runs past a footer.
// node test/render_v766_orchid.mjs <out dir>
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { placePages } from "../src/passport_pages.js";
const B = await import("../src/building_passports.js");
const OUT = process.argv[2] || "./v766_out", KVD = path.join(OUT, "kv");
fs.mkdirSync(KVD, { recursive: true });
const NS = "2cdf36a27f834b5f9c726294d36770fb";
function kvGet(k) {
  const f = path.join(KVD, k.replace(/[^a-zA-Z0-9_.-]/g, "_") + ".txt");
  if (fs.existsSync(f)) { const v = fs.readFileSync(f, "utf8"); return v === "\u0000NULL" ? null : v; }
  let v = null;
  try { v = execFileSync("cmd", ["/c", "npx", "wrangler", "kv", "key", "get", k, "--namespace-id", NS, "--text"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 256 * 1024 * 1024, env: Object.assign({}, process.env, { NODE_OPTIONS: "--dns-result-order=ipv4first" }) }); } catch (e) { v = null; }
  if (v != null && /^\s*(\{"error|Value not found|$)/.test(v)) v = null;
  fs.writeFileSync(f, v == null ? "\u0000NULL" : v); return v;
}
const env = { MEETINGS: { get: async (k, t) => { const v = kvGet(k); if (v == null) return null; return t === "json" || (t && t.type === "json") ? JSON.parse(v) : v; }, put: async () => {}, list: async () => ({ keys: [] }) } };
const ID = "naj:plot:676-8698", NOW = Date.parse("2026-11-05T06:00:00Z");
const pages = await B.bppPages(env, ID, NOW);
if (!pages) { console.log("no passport data for", ID); process.exit(1); }
console.log("page4 has donut:", /bd-donut4/.test(pages.p4), "| community line:", (/Nationality mix · ([^<]+)/.exec(pages.p4) || [])[1]);
const live = fs.readFileSync(new URL("./fixtures_v751/luma_live_v750.html", import.meta.url), "utf8");
const logo = (/src="(data:image\/png;base64,[^"]+)"/.exec(live) || [])[1] || "";
const base = live.replace(/<div class="bpp-snap">[\s\S]*?<\/div>/g, "");
let html = placePages(base, pages.p2, pages.p3, pages.p4).replace(/(["'])najma_logo\.png\1/g, '"' + logo + '"');
html = B.snapshotNote(html, "2026-11-05T06:00:00Z");
fs.writeFileSync(path.join(OUT, "orchid_a.html"), html);
const req = createRequire("C:/Dev/notebooklm-mcp/node_modules/");
const { chromium } = req("playwright-core");
const exe = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: exe });
try {
  const pr = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  await pr.emulateMedia({ media: "print" });
  await pr.setContent(B.withFit(html), { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  await pr.evaluate(() => document.fonts.ready.then(() => true)).catch(() => {});
  const fit = await pr.evaluate(B.FIT_JS);
  const pdf = await pr.pdf({ printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  fs.writeFileSync(path.join(OUT, "orchid_a.pdf"), pdf);
  const n = await pr.evaluate(() => document.querySelectorAll(".page").length);
  for (let i = 0; i < n; i++) { const el = (await pr.$$(".page"))[i]; await el.screenshot({ path: path.join(OUT, "orchid_a_a4_page" + (i + 1) + ".png") }); }
  console.log(JSON.stringify({ pdf_pages: B.pdfPages(pdf), page_boxes: n, fits4: B.fitsPages(B.pdfPages(pdf), fit, 4), fit: fit.map((p) => ({ page: p.page, over_mm: p.over_mm, sections: p.sections })) }));
  const ph = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  await ph.setContent(html, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  const boxes = await ph.$$(".page");
  if (boxes[3]) await boxes[3].screenshot({ path: path.join(OUT, "orchid_a_phone_page4.png") });
  console.log("phone scrollWidth", await ph.evaluate(() => document.documentElement.scrollWidth));
} finally { await browser.close(); }
