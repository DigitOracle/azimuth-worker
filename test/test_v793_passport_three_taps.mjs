// v793 (Kendall 6 Nov 2026, on his phone): "Once I've selected the building, I shouldn't have to do anything else... The filters are
// good, but if I can find the building straight away, I don't need them." Type the name -> tap the result -> tap One-pager or Full passport.
// Runs the real card script in headless Chrome with stand-in services.
import fs from "fs";
import { execFileSync } from "child_process";
import { bppBody } from "../src/building_passports.js";
let fail = 0; const ok = (c, m, x) => { if (!c) { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 600)); } else console.log("ok", m); };
const body = bppBody("k", "", [], [], "https://x.example", "kendall", Date.now());
ok(/id=bpp_ch /.test(body) && /Who is it for/.test(body) && /#bpp_f\.sel>\*\{display:none\}/.test(body), "the card has the chosen-building banner and the fold-away rule");
const CH = "C:/Program Files/Google/Chrome/Application/chrome.exe";
if (!fs.existsSync(CH)) { console.log("skip browser part: no Chrome"); process.exit(fail ? 1 : 0); }
const SEARCH = { q: "binghatti aquarise", total: 3, didYouMean: [],
  groups: [{ name: "Binghatti Aquarise", plots: 2, district: "Business Bay", districts: 1 }, { name: "Solo Tower", plots: 1, district: "Business Bay", districts: 1 }],
  results: [{ label: "Binghatti Aquarise \u00b7 Plot 3460188 \u00b7 Business Bay", id: "naj:plot:3460188" }, { label: "Binghatti Aquarise \u00b7 Plot 3460189 \u00b7 Business Bay", id: "naj:plot:3460189" }, { label: "Solo Tower \u00b7 Business Bay", id: "naj:plot:3460200" }] };
const stub = "<script>var POSTS=[];try{localStorage.removeItem('bpp_reader')}catch(e){}"
  + "window.fetch=function(u,o){u=String(u);var j={ok:true};if(u.indexOf('/plot_passport/search')===0)j=" + JSON.stringify(SEARCH) + ";"
  + "else if(u.indexOf('/plot_passport/districts')===0)j={ok:true,districts:[],zones:[]};"
  + "else if(o&&o.method==='POST'){var b=JSON.parse(o.body);POSTS.push(b);j={ok:false,error:'stub: not sent on'}}"
  + "return Promise.resolve(new Response(JSON.stringify(j),{status:200,headers:{'Content-Type':'application/json'}}))};"
  + "location.reload=function(){};</script>";
const drive = "<script>(function(){var R={},$=function(i){return document.getElementById(i)};"
  + "function vis(i){var e=$(i);return !!e&&getComputedStyle(e).display!=='none'}"
  + "function rows(){return [].map.call(document.querySelectorAll('#bpp_topr button'),function(b){return b.textContent.replace(/\\s+/g,' ').trim()})}"
  + "function tap(rx){var b=[].filter.call(document.querySelectorAll('#bpp_topr button'),function(x){return rx.test(x.textContent)})[0];if(b)b.click();return !!b}"
  + "function type(v){$('bpp_top').value=v;$('bpp_top').oninput()}"
  + "function done(){document.title='R:'+encodeURIComponent(JSON.stringify(R))}"
  + "setTimeout(function(){type('binghatti aquarise');setTimeout(function(){R.found=rows();"
  // a group with one plot: straight to the choice, filters folded
  + "R.tapSolo=tap(/^Solo Tower.*see them all/);setTimeout(function(){R.solo={sel:$('bpp_f').classList.contains('sel'),banner:vis('bpp_ch'),name:$('bpp_ch').firstChild.textContent,area:vis('bpp_z'),dist:vis('bpp_dp'),bld:vis('bpp_bp'),search:vis('bpp_q'),who:vis('bpp_r'),btns:vis('bpp_one'),plot:$('bpp_t').value,posts:POSTS.length,msg:$('bpp_m').textContent};"
  // Full passport: one tap, and the reader is remembered
  + "document.querySelector('#bpp_f button[type=submit]').click();setTimeout(function(){R.full={posts:POSTS.slice(),reader:(function(){try{return localStorage.getItem('bpp_reader')}catch(e){return 'x'}})()};"
  // "Use the filters instead" brings them back
  + "$('bpp_chx').click();R.back={sel:$('bpp_f').classList.contains('sel'),area:vis('bpp_z')};"
  // a group with several plots: listed inline with both buttons; Full passport on a row sends at once (reader remembered)
  + "type('binghatti aquarise');setTimeout(function(){tap(/^Binghatti Aquarise.*see them all/);setTimeout(function(){R.list=rows();var n0=POSTS.length;"
  + "var fp=[].filter.call(document.querySelectorAll('#bpp_topr .tpr'),function(w){return /3460189/.test(w.textContent)})[0];if(fp)fp.querySelectorAll('button')[2].click();"
  + "setTimeout(function(){R.row={sent:POSTS.slice(n0),sel:$('bpp_f').classList.contains('sel')};done()},300)},500)},500)},300)},500)},500)},400)})()</script>";
const html = "<!doctype html><html><body>" + stub + body + drive + "</body></html>";
const f = process.env.TEMP + "\\v793_passport.html"; fs.writeFileSync(f, html);
const dom = execFileSync(CH, ["--headless=old", "--disable-gpu", "--virtual-time-budget=20000", "--dump-dom", "file:///" + f.replace(/\\/g, "/")], { encoding: "utf8", timeout: 90000, stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64e6 });
const mm = /<title>R:([^<]*)<\/title>/.exec(dom); const R = mm ? JSON.parse(decodeURIComponent(mm[1])) : null;
ok(!!R, "the card script ran to the end", dom.slice(0, 300));
if (R) {
  ok(R.found.some((t) => /^Solo Tower/.test(t)) && R.tapSolo, "the search lists the building", R.found);
  ok(R.solo.sel && R.solo.banner && /Solo Tower/.test(R.solo.name) && R.solo.plot === "3460200", "tapping it chooses the plot and names it", R.solo);
  ok(!R.solo.area && !R.solo.dist && !R.solo.bld && !R.solo.search, "the Area, Search, District and Building filters fold away", R.solo);
  ok(R.solo.who && R.solo.btns && R.solo.posts === 0 && /Who is it for/.test(R.solo.msg), "only who it is for and the two buttons are left; nothing is sent yet", R.solo);
  ok(R.full.posts.length === 1 && R.full.posts[0].op === "request" && R.full.posts[0].text === "3460200" && R.full.posts[0].reader === "broker" && R.full.reader === "broker", "Full passport is one tap, and the reader is remembered", R.full);
  ok(!R.back.sel && R.back.area, "Use the filters instead brings the filters back", R.back);
  ok(R.list.filter((t) => /Binghatti Aquarise . Plot 34601(88|89)/.test(t)).length === 2 && R.list.filter((t) => t === "One-pager").length === 2 && R.list.filter((t) => t === "Full passport").length === 2, "several plots are listed inline, each with One-pager and Full passport", R.list);
  ok(R.row.sent.length === 1 && R.row.sent[0].op === "request" && R.row.sent[0].text === "3460189" && R.row.sel, "Full passport on a row sends at once: not pressed twice", R.row);
}
process.exit(fail ? 1 : 0);
