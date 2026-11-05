// v785 screenshots: the Thailand trip page at 375 px with the seeded trip (no network; fetch answered locally).
import fs from "fs";
import { execFileSync } from "child_process";
import { tripRoute, emptyTrip } from "../src/trip_card.js";
const OUT = "C:/Users/kwils/OneDrive/Desktop/DigitAlchemy_31MAY2026/Operations/Research/Thailand_Trip_Card_05NOV2026/";
fs.mkdirSync(OUT, { recursive: true });
const env = { MEETINGS: { get: async () => null, put: async () => {}, delete: async () => {} } };
const u = new URL("https://x/momo/work/trip?key=k");
const html = await (await tripRoute(new Request(u), env, u, { page: (k, r, b) => b, person: () => "kendall" })).text();
const t = emptyTrip();
t.items.flights.push({ id: "f1", traveller: "Kendall", airline: "Emirates", flight_no: "EK378", from: "DXB", to: "HKT", dep_date: "2026-12-02", dep_time: "09:40", dep_tz: "Dubai (GST)", arr_date: "2026-12-02", arr_time: "19:05", arr_tz: "Thailand (ICT, +3 h)", booking_ref: "", seat: "", baggage: "", notes: "Sample row for the screenshot" });
t.items.checklist.push({ id: "c1", what: "Check visa rules for UAE residents", who: "Both", by: "2026-11-20", done: false });
t.log = [{ at: new Date().toISOString(), who: "Kendall", what: "added to Flights: Kendall" }];
const shim = "<script>var __T=" + JSON.stringify(t) + ";window.fetch=function(u){return Promise.resolve(new Response(JSON.stringify({ok:true,trip:__T}),{headers:{'Content-Type':'application/json'}}))};</script>";
const page = "<!doctype html><html><head><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><link href='https://fonts.googleapis.com/css2?family=Fraunces:wght@600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@600&display=swap' rel=stylesheet>"
  + "<style>body{margin:0;background:#F7F3EA;color:#1C2826;font-family:'IBM Plex Sans',sans-serif;padding:20px 16px 40px}.tag{font:600 .68rem 'IBM Plex Mono',monospace;letter-spacing:.14em;color:#8A6F3E}h1{font:600 2rem Fraunces,serif;color:#0A4F4A;margin:6px 0 22px}.back{color:#5F6B66;text-decoration:none;font-size:.85rem}</style></head><body>" + shim + html + "</body></html>";
const file = OUT + "trip_page.html"; fs.writeFileSync(file, page);
const CH = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"].find((p) => fs.existsSync(p));
for (const [name, h] of [["thailand_top_375.png", 1400], ["thailand_full_375.png", 3400]]) {
  execFileSync(CH, ["--headless=old", "--disable-gpu", "--hide-scrollbars", "--window-size=375," + h, "--virtual-time-budget=4000", "--screenshot=" + OUT + name, "file:///" + file]);
  console.log("wrote", name);
}
