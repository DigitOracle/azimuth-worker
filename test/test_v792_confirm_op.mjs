// v792 (Kendall 6 Nov 2026, on his phone): the Building Passports card showed "Saved / Your change is saved" every few seconds while a
// passport was being made. Its progress check is a POST labelled {op:"status"}; the shared confirmation only looked at "action".
// A status check must show nothing; the real writes on that card (op "onepager", "request") must still confirm.
import fs from "fs";
import { execFileSync } from "child_process";
import { MOMO_CONFIRM_JS } from "../src/momo_confirm.js";
let fail = 0; const ok = (c, m, x) => { if (!c) { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x)); } else console.log("ok", m); };
ok(/body\.action\|\|body\.op/.test(MOMO_CONFIRM_JS), "the read test looks at op as well as action");
const CH = "C:/Program Files/Google/Chrome/Application/chrome.exe";
if (!fs.existsSync(CH)) { console.log("skip browser part: no Chrome"); process.exit(fail ? 1 : 0); }
const page = "<!doctype html><html><body><script>"
  + "window.fetch=function(u,o){return Promise.resolve(new Response(JSON.stringify({ok:true,requests:[]}),{status:200,headers:{'Content-Type':'application/json'}}))};</script>"
  + "<script>" + MOMO_CONFIRM_JS + "</script><script>"
  + "var R={};function card(){var c=document.querySelector('[role=status],[role=alert]');return c?c.innerText.replace(/\\s+/g,' ').trim():null}"
  + "function post(b){return fetch('/momo/work/passports/api?key=k',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)})}"
  + "post({op:'status',ids:['a']}).then(function(){setTimeout(function(){R.status=card();"
  + " post({op:'request',plot:'3260863'}).then(function(){setTimeout(function(){R.request=card();document.title='R:'+JSON.stringify(R)},150)})},150)})"
  + "</script></body></html>";
const f = process.env.TEMP + "\\v792_confirm.html"; fs.writeFileSync(f, page);
const dom = execFileSync(CH, ["--headless=old", "--disable-gpu", "--virtual-time-budget=8000", "--dump-dom", "file:///" + f.replace(/\\/g, "/")], { encoding: "utf8", timeout: 60000, stdio: ["ignore", "pipe", "ignore"] });
const m = /<title>R:([^<]*)<\/title>/.exec(dom); const R = m ? JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&")) : { none: true };
ok(!R.none && R.status === null, "a status check shows no card", R);
ok(R.request && /Saved/.test(R.request), "a real passport request still confirms", R);
process.exit(fail ? 1 : 0);
