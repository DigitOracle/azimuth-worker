// v290 AMENITY CARDS - a local render, NOT a test (no test_ prefix, so run_all.mjs skips it): the Brief on a phone and the PDF's
// "Around the community" page, from test/v290_fixture.mjs, with every Google picture stubbed by a LOCAL image. Nothing leaves the
// machine except the page fonts; nothing is written to KV.
//
//   node test/render_v290_amenity_cards.mjs <out dir>
// needs playwright-core (C:/Dev/notebooklm-mcp/node_modules) and a local Chrome.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import worker from "../src/index.js";
import { makeKV, READ, CLIENT, GKEY, LIVE_COUNTS, LIVE_SCHOOLS } from "./v290_fixture.mjs";

const OUT = process.argv[2] || ".";
fs.mkdirSync(OUT, { recursive: true });
const PIC = {
  places: fs.readFileSync("C:/Dev/naj-market-pulse/data/video/unreal_damachills_c1_poster.jpg"),
  streetview: fs.readFileSync("C:/Dev/naj-market-pulse/data/video/unreal_damachills_c3_poster.jpg"),
  staticmap: fs.readFileSync("C:/Dev/naj-market-pulse/public/banners/sat_damachills.jpg"),
};
const realFetch = globalThis.fetch;
const asked = [];
globalThis.fetch = async (u, o) => {
  const s = String(u && u.url ? u.url : u);
  if (/(maps|places|areainsights)\.googleapis\.com/.test(s)) {
    asked.push(s.replace(/key=[^&]+/, "key=<secret>"));
    if (o && o.method === "POST") {   // the live answers, stubbed: Places Aggregate counts and Places Nearby Search (school names)
      const b = JSON.parse(o.body || "{}");
      if (/computeInsights/.test(s)) { const c = LIVE_COUNTS[b.filter.typeFilter.includedTypes[0]]; return Response.json(c == null || c === "0" ? {} : { count: c }); }
      return Response.json({ places: LIVE_SCHOOLS.map((t) => ({ displayName: { text: t } })) });
    }
    const k = /places\.googleapis/.test(s) ? "places" : /streetview/.test(s) ? "streetview" : "staticmap";
    return new Response(PIC[k], { headers: { "Content-Type": "image/jpeg" } });
  }
  return realFetch(u, o);
};
const { KV } = makeKV();
const env = { MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: CLIENT, GOOGLE_MAPS_KEY: GKEY, PUBLIC_ORIGIN: "http://127.0.0.1:8790" };

const server = http.createServer(async (req, res) => {
  try {
    const r = await worker.fetch(new Request("http://127.0.0.1:8790" + req.url, { method: req.method }), env, { waitUntil() {} });
    res.writeHead(r.status, Object.fromEntries(r.headers.entries()));
    res.end(Buffer.from(await r.arrayBuffer()));
  } catch (e) { res.writeHead(500); res.end(String(e && e.stack)); }
});
await new Promise((r) => server.listen(8790, "127.0.0.1", r));

const { chromium } = await import("file:///C:/Dev/notebooklm-mcp/node_modules/playwright-core/index.mjs");
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  // 1. the Brief on a phone: pets, community pool and gym as must-haves in DAMAC Hills
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage();
  await pg.goto("http://127.0.0.1:8790/brief?key=" + CLIENT + "&mode=rent&beds=1&min=60000&max=70000&areas=damachills&musts=pets,community_pool,gym,schools,metro&run=1", { waitUntil: "networkidle" });
  await pg.waitForSelector("#bamen .acard img", { timeout: 15000 });
  await pg.waitForTimeout(800);
  const m = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, cards: document.querySelectorAll("#bamen .acard").length,
    imgs: [...document.querySelectorAll("#bamen img")].map((i) => i.naturalWidth > 0), above: !!(document.querySelector("#bamen") && document.querySelector("#bamen").nextElementSibling && document.querySelector("#bamen").nextElementSibling.className === "sa"),
    html: document.documentElement.outerHTML }));
  const phone = path.join(OUT, "brief_phone_amenity_cards.png");
  const top = await pg.evaluate(() => document.getElementById("bamen").getBoundingClientRect().top + window.scrollY - 70);
  await pg.evaluate((y) => window.scrollTo(0, y), top);
  await pg.screenshot({ path: path.join(OUT, "brief_phone_amenity_cards_viewport.png") });
  await pg.screenshot({ path: phone, fullPage: true });
  console.log("phone:", phone, JSON.stringify({ scrollWidth: m.sw, clientWidth: m.cw, cards: m.cards, picturesLoaded: m.imgs, aboveHomesList: m.above, keyInPage: m.html.includes(GKEY) }));

  // 2. the Compare PDF with the "Around the community" page, through the worker's own document builder (format=html), printed by Chrome
  const r = await worker.fetch(new Request("http://127.0.0.1:8790/brief_pdf?kind=compare&keys=damachills:10,damachills:11&mode=rent&beds=1&min=60000&max=70000&areas=damachills&musts=pets,community_pool,gym,schools&format=html&key=" + CLIENT), env, { waitUntil() {} });
  const html = await r.text();
  fs.writeFileSync(path.join(OUT, "compare_amenity.html"), html);
  const dp = await browser.newPage();
  await dp.setViewportSize({ width: 1123, height: 794 });
  await dp.setContent(html, { waitUntil: "networkidle" });
  const pdfPath = path.join(OUT, "compare_with_amenity_cards.pdf");
  await dp.pdf({ path: pdfPath, printBackground: true, preferCSSPageSize: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } });
  const pages = await dp.evaluate(() => document.querySelectorAll(".sheet.page").length);
  const el = await dp.$(".sheet.page:has(.aroundpage)");
  const pagePng = path.join(OUT, "pdf_around_the_community_page.png");
  if (el) await el.screenshot({ path: pagePng });
  console.log("pdf:", pdfPath, "pages", pages, "| page png:", pagePng, "| key in pdf html:", html.includes(GKEY), "| status", r.status);
  console.log("google asked (stubbed):", asked.length, asked.slice(0, 3).join(" | "));
} finally { await browser.close(); server.close(); }
