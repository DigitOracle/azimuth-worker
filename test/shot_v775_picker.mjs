// screenshots of the v775 just-in-time picker and the optional Team numbers screen at 375 px (mocked answers, the real served script)
import fs from "fs"; import { execFileSync } from "child_process";
import { CK_JS } from "../src/checkin.js";
const OUT = "C:/Users/kwils/OneDrive/Desktop/DigitAlchemy_31MAY2026/Operations/Research/Meeting_Sync_05NOV2026/";
const CHROME = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"].find((p) => fs.existsSync(p));
const roster = [{ name: "Vishant Singh", role: "Editor / Head of Visuals", phone: "971500000001" }, { name: "Sousan Khatibzadeh", role: "Social Media Management", phone: "" }, { name: "Karim", role: "Video editing support", phone: "" }, { name: "Monaza", role: "Graphic Designer (remote)", phone: "971500000002" }];
const here = [roster[1], roster[0]];
function html(after) {
  return '<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=375"><style>body{margin:0;background:#F7F3EA;font-family:"IBM Plex Sans",Arial,sans-serif}</style></head><body><div style="padding:16px">Content planner</div>'
    + '<button data-ck="step|FD-1103-1|Caption" id=go>x</button>'
    + '<script>window.fetch=function(u,o){var b=JSON.parse(o&&o.body||"{}");return Promise.resolve({json:function(){return Promise.resolve({ok:true,roster:' + JSON.stringify(roster) + ',here:' + JSON.stringify(here) + '})}})};</script>'
    + "<script>" + CK_JS + "</script><script>setTimeout(function(){document.getElementById('go').click();" + after + "},50)</script></body></html>";
}
const shots = [["2_picker_jit_375.png", ""], ["2_team_numbers_375.png", "setTimeout(function(){document.getElementById('ck_set').click()},300)"]];
for (const [name, after] of shots) {
  const f = OUT + "_tmp_" + name + ".html"; fs.writeFileSync(f, html(after));
  execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--window-size=375,812", "--virtual-time-budget=2500", "--screenshot=" + OUT + name, "file:///" + f]);
  console.log("saved", OUT + name);
}
