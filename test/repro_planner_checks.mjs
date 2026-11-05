// v782b - her real planner (saved data) + the new checks, rendered offline: chips on cards, day dots, the TO FIX box in a post, no JS errors
import fs from "fs";
import { plannerBody } from "../src/content_planner.js";
import { plannerChecks } from "../src/planner_checks.js";
const S = process.env.LOCALAPPDATA + "/Temp/claude/69ae2f9f80320527/dfdba7aa-873b-4c5f-b88e-7ca4eb14469d/scratchpad/";
const d = JSON.parse(fs.readFileSync(S + "planner_data.json", "utf8"));
d.checks = plannerChecks(d.items, d.settings, d.today, { nowHm: "16:00" });
let body = plannerBody("k", "", true);
const shim = "<script>window.__ERR=[];window.onerror=function(m,s,l,c){window.__ERR.push(m+' @'+l+':'+c)};window.addEventListener('unhandledrejection',function(e){window.__ERR.push('REJ '+(e.reason&&e.reason.message||e.reason))});var DATA=" + JSON.stringify(JSON.stringify(Object.assign({}, d, { ok: true }))) + ";window.fetch=function(u){return Promise.resolve(new Response(DATA,{headers:{'Content-Type':'application/json'}}))};</script>";
const probe = "<script>setTimeout(function(){var r={err:window.__ERR,chips:document.querySelectorAll('.pcc').length};document.querySelector('[data-v=week]').click();r.dots=document.querySelectorAll('.pdot').length;document.querySelector('[data-v=day]').click();var c=document.querySelector('[data-day=\"1\"]');if(c)c.click();r.daybox=(document.querySelector('.pcd')||{}).innerText||'';var o=document.querySelector('[data-open=\"FD-1106-1\"]');if(o)o.click();var fb=document.querySelector('#sheet .pcd');r.fixbox=fb?fb.innerText.slice(0,400):'NONE';r.timeBtns=document.querySelectorAll('#sheet [data-settime]').length;document.title='RESULT:'+JSON.stringify(r)},2500)</script>";
fs.writeFileSync("C:/Users/kwils/Downloads/repro_planner.html", "<!doctype html><html><head><meta charset=utf-8></head><body>" + shim + body + probe + "</body></html>");
console.log("written");
