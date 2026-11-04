// v728 - a local render, NOT a test (no test_ prefix): the real worker.fetch output of the main app pages with an in-memory KV,
// before (?theme=dark, the page as written) and after (the cream theme), screenshotted at 375 px in headless Chrome.
// node test/render_v728_cream.mjs <out dir>     needs playwright-core (C:/Dev/notebooklm-mcp/node_modules) and a local Chrome.
import worker from "../src/index.js";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const OUT = process.argv[2] || "./cream_out";
fs.mkdirSync(OUT, { recursive: true });
const store = new Map();
const KV = {
  async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter(k => k.startsWith(p)).map(name => ({ name })), list_complete: true }; },
};
globalThis.fetch = async () => new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
const KEY = "owner_key_fixture_123";
const env = { MEETINGS: KV, READ_KEY: KEY, INGEST_TOKEN: "ING", OWNER_KEY: KEY };
const pages = (process.argv[3] || "/start,/find,/market,/more,/map,/skyline?all=1,/momo,/versus,/building/businessbay/574").split(",");
const req = createRequire("C:/Dev/notebooklm-mcp/node_modules/");
const { chromium } = req("playwright-core");
const exe = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(p => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
for (const p of pages) {
  for (const mode of ["before", "after"]) {
    const u = "https://azimuth-2.local" + p + (p.includes("?") ? "&" : "?") + "key=" + KEY + (mode === "before" ? "&theme=dark" : "");
    let h = "", st = 0;
    try { const r = await worker.fetch(new Request(u), env, { waitUntil() {} }); st = r.status; h = await r.text(); } catch (e) { h = "<pre>" + String(e && e.stack) + "</pre>"; }
    const name = p.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "root";
    const file = path.join(OUT, name + "_" + mode + ".html");
    fs.writeFileSync(file, h);
    const pg = await ctx.newPage();
    await pg.route("**/*", r => r.request().url().startsWith("file:") ? r.continue() : r.abort());
    try { await pg.goto("file:///" + file.replace(/\\/g, "/"), { timeout: 8000 }); await pg.waitForTimeout(400); } catch (e) {}
    await pg.screenshot({ path: path.join(OUT, name + "_" + mode + ".png") });
    await pg.close();
    console.log(mode, p, st, h.length);
  }
}
await browser.close();
