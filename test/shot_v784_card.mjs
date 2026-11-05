// v784: render the passport "Available now" card (release code, real records) to a local HTML for a screenshot
import fs from "fs";
import { avFor, availCardPdf, AV_PDF_CSS } from "../src/avail_view.js";
import { PAGES_CSS } from "../src/passport_pages.js";
const bulk = JSON.parse(fs.readFileSync("C:/Dev/naj-market-pulse/data/avail/kv_avail_bulk.json", "utf8"));
const store = Object.fromEntries(bulk.map((x) => [x.key, x.value]));
const env = { MEETINGS: { get: async (k) => store[k] ?? null } };
const out = process.argv[2];
let body = "";
for (const [plot, reg] of [["naj:plot:3370875", 2610], ["naj:plot:3265633", null], ["naj:plot:681-7670", 1180]]) body += '<div style="margin:0 0 4mm">' + availCardPdf(await avFor(env, plot), reg, Date.parse("2026-11-05T12:00:00Z")) + "</div>";
fs.writeFileSync(out, '<!doctype html><html><head><meta charset=utf-8><link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Inter:wght@400;500;600;700&display=swap" rel=stylesheet>'
  + PAGES_CSS + AV_PDF_CSS + '</head><body style="margin:0;background:#F6F2E9"><div class="bd-page" style="width:auto;height:auto;padding:4mm">' + body + "</div></body></html>");
console.log("written", out);
