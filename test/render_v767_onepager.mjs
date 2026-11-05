// v767/v768 - a local render, NOT a test: the real One-pager for DAMAC Hills - Orchid A (plot 676-8698) from the LIVE stored rows (read with
// wrangler, cached in <out>/kv/, shared with render_v766_orchid.mjs). Times the build, saves the HTML, prints it to PDF in local Chrome and
// screenshots it at A4 and at 375 px.   node test/render_v767_onepager.mjs <out dir>
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const B = await import("../src/building_passports.js");
const OUT = process.argv[2] || "./v767_out", KVD = path.join(OUT, "kv");
fs.mkdirSync(KVD, { recursive: true });
const NS = "2cdf36a27f834b5f9c726294d36770fb", PUT = {};
function kvGet(k) {
  const f = path.join(KVD, k.replace(/[^a-zA-Z0-9_.-]/g, "_") + ".txt");
  if (fs.existsSync(f)) { const v = fs.readFileSync(f, "utf8"); return v === "\u0000NULL" ? null : v; }
  let v = null;
  try { v = execFileSync("cmd", ["/c", "npx", "wrangler", "kv", "key", "get", k, "--namespace-id", NS, "--text"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 256 * 1024 * 1024, env: Object.assign({}, process.env, { NODE_OPTIONS: "--dns-result-order=ipv4first" }) }); } catch (e) { v = null; }
  if (v != null && /^\s*(\{"error|Value not found|$)/.test(v)) v = null;
  fs.writeFileSync(f, v == null ? "\u0000NULL" : v); return v;
}
const env = { MEETINGS: { get: async (k) => (k in PUT ? PUT[k] : (k === "bpp_index" ? "[]" : kvGet(k))), put: async (k, v) => { PUT[k] = v; }, delete: async () => {}, list: async () => ({ keys: [] }) } };
// warm the cache first (wrangler is slow); the timed run below is the worker's own work
await B.bppOnePager(env, "676-8698", "DAMAC Hills - Orchid A", Date.now());
for (const k of Object.keys(PUT)) delete PUT[k];
const t0 = Date.now();
const r = await B.bppOnePager(env, "676-8698", "DAMAC Hills - Orchid A", Date.now());
console.log("built in", Date.now() - t0, "ms", JSON.stringify(r));
const html = PUT["bpp_file_" + r.slug + "_html"];
fs.writeFileSync(path.join(OUT, "orchid_a_onepager.html"), html);
const req = createRequire("C:/Dev/notebooklm-mcp/node_modules/");
const { chromium } = req("playwright-core");
const exe = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: exe });
try {
  const pr = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  await pr.emulateMedia({ media: "print" });
  await pr.setContent(html, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  await pr.evaluate(() => document.fonts.ready.then(() => true)).catch(() => {});
  const pdf = await pr.pdf({ printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  fs.writeFileSync(path.join(OUT, "orchid_a_onepager.pdf"), pdf);
  console.log("pdf pages", B.pdfPages(pdf));
  await (await pr.$(".page")).screenshot({ path: path.join(OUT, "orchid_a_onepager_a4.png") });
  const ph = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  await ph.setContent(html, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  await ph.screenshot({ path: path.join(OUT, "orchid_a_onepager_phone.png"), fullPage: true });
  console.log("phone scrollWidth", await ph.evaluate(() => document.documentElement.scrollWidth));
} finally { await browser.close(); }
