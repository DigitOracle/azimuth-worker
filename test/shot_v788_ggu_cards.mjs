// v788: GGU page as clean cards. Renders the REAL page through the worker with a record fixture (in-memory KV, no network),
// writes static HTML files and takes 375 px + desktop screenshots in headless Chrome. Fails on any JS error or sideways overflow.
// usage: node test/shot_v788_ggu_cards.mjs <record.json> <outDir>      (the record stays outside git)
import fs from "fs";
import { execFileSync } from "child_process";
const FIX = process.argv[2], OUT = (process.argv[3] || ".").replace(/\\/g, "/").replace(/\/?$/, "/");
if (!FIX) { console.log("usage: node test/shot_v788_ggu_cards.mjs <record.json> <outDir>"); process.exit(2); }
const worker = (await import("../src/index.js")).default;
const KEN = "ins_kendall_TESTKEY0123456789abcd";
const store = new Map([["ggu_rec_kendall", fs.readFileSync(FIX, "utf8")]]);
const KV = { get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); }, list: async () => ({ keys: [], list_complete: true }) };
const env = { MEETINGS: KV, INSIDER_KEY: KEN }, ctx = { waitUntil() {}, passThroughOnException() {} };
const get = async (p) => (await worker.fetch(new Request("https://w" + p + "?key=" + KEN), env, ctx)).text();
// the web-font stylesheet must not block the page: on this laptop the IPv6 route drops and Chrome then waits a minute per shot
const page = (await get("/momo/work/ggu")).replace(/<link rel=stylesheet href="https:\/\/fonts\.googleapis\.com[^>]*>/, (m) => m.replace("<link ", '<link media=print onload="this.media=\'all\'" ')), rec = await get("/momo/work/ggu/rec");
const shim = (after) => "<script>window.__ERR=[];window.onerror=function(m,s,l,c){window.__ERR.push(m+' @'+l+':'+c)};window.addEventListener('unhandledrejection',function(e){window.__ERR.push('rejection '+(e.reason&&e.reason.message||e.reason))});"
  + "var __REC=" + JSON.stringify(rec) + ";window.__POST=[];window.fetch=function(u,o){if(o&&o.method==='POST')window.__POST.push(JSON.parse(o.body).action);return Promise.resolve(new Response(__REC,{headers:{'Content-Type':'application/json'}}))};"
  + "document.addEventListener('DOMContentLoaded',function(){setTimeout(function(){try{" + (after || "") + "}catch(e){window.__ERR.push('after '+e.message)}setTimeout(function(){window.__DONE=1},300)},400)});</script>";
// headless Chrome on Windows will not make a window narrower than about 500 px, so the page runs in a same-origin iframe of the exact width
const att = (h) => h.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
const wrap = (w, h, after) => "<!doctype html><html><head><meta charset=utf-8><style>html,body{margin:0;overflow:hidden}iframe{border:0;display:block}</style></head><body><iframe id=f width=" + w + " height=" + h + ' srcdoc="' + att(page.replace(/<head>/i, "<head>" + shim(after))) + '"></iframe>'
  + "<script>setTimeout(function(){var f=document.getElementById('f'),c=f.contentWindow,d=document.createElement('pre');d.id='__errs';d.style.display='none';d.textContent='ERRORS:'+JSON.stringify(c.__DONE?c.__ERR:['page did not finish loading'])+' OVERFLOW:'+(c.document.documentElement.scrollWidth-c.innerWidth)+' CARDS:'+c.document.querySelectorAll('.g-c,.g-tc,.lc,.g-tr').length+' POSTS:'+(c.__POST||[]).join('+')+' WIDE:'+[].slice.call(c.document.querySelectorAll('body *')).filter(function(e){return e.getBoundingClientRect().right>c.innerWidth+1}).slice(0,4).map(function(e){return e.tagName+'.'+e.className+'#'+e.id+':'+Math.round(e.getBoundingClientRect().right)}).join(',');document.body.appendChild(d)},3500)</script></body></html>";
const CH = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"].find((p) => fs.existsSync(p));
const ALL = "document.querySelectorAll('.gs').forEach(function(s){s.className='gs on'})";
const shots = [
  ["ggu_375", 375, 5600, ""],
  ["ggu_375_all", 375, 8200, ALL],
  ["ggu_desktop", 1280, 4300, ALL],
  ["ggu_375_learner", 375, 812, "document.querySelectorAll('.lc')[3].click()"],
  ["ggu_375_task", 375, 812, "document.querySelector('.g-tc .ed').click()"],
  // every write path still reaches the API: edit + save a task, tick a task, tick the allocation, open a learner sheet + save
  ["ggu_375_writes", 375, 812, "document.querySelector('.g-tc .ed').click();document.querySelector('#lsin .bt.pri').click();document.querySelector('.g-tc input').click();document.querySelector('.pend input').click();document.querySelector('.lc').click();document.querySelector('#lsin .bt.pri').click()", "save_all+set_task_done+chair_ack+learner_save"],
];
let bad = 0;
for (const [name, w, h, after, posts] of shots) {
  const f = OUT + name + ".html"; fs.writeFileSync(f, wrap(w, h, after));
  const a = ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--window-size=" + Math.max(w, 600) + "," + h, "--virtual-time-budget=8000"];
  execFileSync(CH, a.concat(["--force-device-scale-factor=" + (w < 500 ? 2 : 1), "--screenshot=" + OUT + name + "_full.png", "file:///" + f]), { stdio: "ignore" });
  const dom = execFileSync(CH, a.concat(["--dump-dom", "file:///" + f]), { maxBuffer: 256e6, stdio: ["ignore", "pipe", "ignore"] }).toString();
  const m = /<pre id="__errs"[^>]*>([^<]*)<\/pre>/.exec(dom); const line = m ? m[1].replace(/&quot;/g, '"') : "NO ERROR REPORT (script died?)";
  if (!/ERRORS:\[\] OVERFLOW:(0|-\d+) CARDS:[1-9]/.test(line) || (posts && !line.includes(" POSTS:" + posts + " "))) bad++;
  console.log(name, w + "px", line);
}
process.exit(bad ? 1 : 0);
