// v778: one shared save confirmation. Runs the real script in headless Chrome with a stand-in fetch:
// a save that works -> "Saved" card that closes after ~2 s; ok:false -> "Not saved" card with the reason that stays;
// no connection -> "Not saved", "No connection"; a read-only preview -> no card at all.
import fs from "fs";
import { execFileSync } from "child_process";
import { MOMO_CONFIRM_JS } from "../src/momo_confirm.js";
let fail = 0; const ok = (c, m, x) => { if (!c) { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x)); } else console.log("ok", m); };
try { new Function(MOMO_CONFIRM_JS); ok(true, "the shared script parses"); } catch (e) { ok(false, "the shared script parses", e.message); }
const CH = "C:/Program Files/Google/Chrome/Application/chrome.exe";
if (!fs.existsSync(CH)) { console.log("skip browser part: no Chrome"); process.exit(fail ? 1 : 0); }
const page = "<!doctype html><html><body><script>"
  + "window.fetch=function(u,o){var b=JSON.parse(o&&o.body||'{}');if(b.action==='net')return Promise.reject(new TypeError('Failed'));"
  + "var j=b.action==='bad'?{ok:false,error:'The sheet row moved. Import again first.'}:b.action==='push'?{ok:true,written:2,changes:[]}:{ok:true,item:{code:'FD-1106-1'}};"
  + "return Promise.resolve(new Response(JSON.stringify(j),{status:b.action==='bad'?400:200,headers:{'Content-Type':'application/json'}}))};</script>"
  + "<script>" + MOMO_CONFIRM_JS + "</script><script>"
  + "var R={};function card(){var c=document.querySelector('[role=status],[role=alert]');return c?{role:c.getAttribute('role'),text:c.innerText.replace(/\\s+/g,' ').trim()}:null}"
  + "function post(b){return fetch('/momo/work/planner/api?key=k',{method:'POST',body:JSON.stringify(b)}).catch(function(){})}"
  + "post({action:'save',code:'FD-1106-1'}).then(function(){setTimeout(function(){R.save=card();setTimeout(function(){R.saveLater=card();"
  + " post({action:'push',code:'FD-1106-1',apply:true}).then(function(){setTimeout(function(){R.push=card();"
  + " post({action:'bad'}).then(function(){setTimeout(function(){R.bad=card();setTimeout(function(){R.badLater=card();document.body.click&&document.querySelector('[role=alert]').parentNode.click();"
  + " post({action:'push',code:'X'}).then(function(){setTimeout(function(){R.read=card();"
  + " post({action:'net'}).then(function(){setTimeout(function(){R.net=card();document.title='R:'+JSON.stringify(R)},150)})},150)})},2600)},150)})},150)})},2600)},150)})"
  + "</script></body></html>";
const f = process.env.TEMP + "\\v778_confirm.html"; fs.writeFileSync(f, page);
const dom = execFileSync(CH, ["--headless=old", "--disable-gpu", "--virtual-time-budget=15000", "--dump-dom", "file:///" + f.replace(/\\/g, "/")], { encoding: "utf8", timeout: 60000, stdio: ["ignore", "pipe", "ignore"] });
const m = /<title>R:([^<]*)<\/title>/.exec(dom); const R = m ? JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&")) : {};
ok(R.save && R.save.role === "status" && /Saved/.test(R.save.text) && /FD-1106-1/.test(R.save.text), "a save shows a Saved card naming what was saved", R.save);
ok(!R.saveLater, "the Saved card closes by itself after about 2 seconds", R.saveLater);
ok(R.push && /2 cells updated in the workbook/.test(R.push.text), "a workbook write says how many cells changed and where", R.push);
ok(R.bad && R.bad.role === "alert" && /Not saved/.test(R.bad.text) && /sheet row moved/.test(R.bad.text), "a refused save shows Not saved with the reason", R.bad);
ok(R.badLater && R.badLater.role === "alert", "the failure card stays until it is tapped", R.badLater);
ok(!R.read, "a read-only preview shows no card", R.read);
ok(R.net && /No connection/.test(R.net.text), "a dropped connection is never silent", R.net);
process.exit(fail ? 1 : 0);
