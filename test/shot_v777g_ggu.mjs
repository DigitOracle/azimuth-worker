// 375 px screenshots of the GGU Cohort 8 Chair section and one learner sheet (local page, real module code, mocked fetch)
import fs from "fs";
import { execFileSync } from "child_process";
import { emptyGgu, GGU_BODY, GGU_JS } from "../src/work_ggu.js";
const OUT = "C:/Users/kwils/OneDrive/Desktop/DigitAlchemy_31MAY2026/Operations/Research/GGU_Chair_Cohort8_05NOV2026/";
fs.mkdirSync(OUT, { recursive: true });
const CH = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"].find((p) => fs.existsSync(p));
const rec = emptyGgu(); rec.updatedAt = "2026-11-05T12:00:00Z";
const CSS = "body{margin:0;background:#F7F3EA;color:#1C2321;font-family:'IBM Plex Sans',Arial,sans-serif;padding:20px 16px}.w{max-width:560px;margin:0 auto}.tag{font:600 .68rem monospace;letter-spacing:.14em;color:#8A6F3E}h1{font-family:Georgia,serif;color:#0A4F4A;margin:4px 0 6px}.back{color:#5F6B66;text-decoration:none;font-size:.85rem}.sh{color:#5F6B66;font-size:.85rem}";
const page = (open) => "<!doctype html><html><head><meta charset=utf-8><meta name=viewport content='width=375'><style>" + CSS + "</style></head><body><div class=w>" + GGU_BODY + "</div><script>window.fetch=function(){return Promise.resolve(new Response(JSON.stringify({rec:" + JSON.stringify(rec) + "}),{headers:{'Content-Type':'application/json'}}))};</script><script>" + GGU_JS + "</script>"
  + (open ? "<script>setTimeout(function(){document.querySelectorAll('.lc')[" + open + "].click()},300)</script>" : "") + "</body></html>";
const shots = [["1_chair_section_375.png", 0, 1500], ["2_learner_sheet_noaman_375.png", "0", 1700], ["3_learner_sheet_abdullah_375.png", "2", 1700]];
for (const [name, open, h] of shots) {
  const f = OUT + "page_" + name.replace(".png", ".html"); fs.writeFileSync(f, page(open === 0 ? 0 : open));
  execFileSync(CH, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2", "--window-size=375," + h, "--virtual-time-budget=3000", "--screenshot=" + OUT + name, "file:///" + f]);
  console.log("shot", name);
}
