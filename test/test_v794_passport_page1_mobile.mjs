// v794 (Kendall 6 Nov 2026, on his phone): page 1 of a Building Passport was 210 mm wide on a phone and ran off the right edge; pages 2+
// already had a phone layout. The public page now carries a phone-only style, added when it is served (so passports already made are fixed).
import fs from "fs";
import { execFileSync } from "child_process";
import { withMobile, BPP_MOBILE_CSS, bppPublic } from "../src/building_passports.js";
let fail = 0; const ok = (c, m, x) => { if (!c) { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 500)); } else console.log("ok", m); };
// a page shaped like a stored passport: A4 page 1 with the hero, the dashboard grid, the absolute footer; then a .bd-page
const PAGE = '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}.page{position:relative;width:210mm;height:297mm;overflow:hidden}'
  + '.bpp-hero{height:72mm;display:grid;grid-template-columns:minmax(0,1fr) 78mm;column-gap:10mm}.bpp-title-block{height:58mm}.bpp-building-name{white-space:nowrap;overflow:hidden}'
  + '.footer{position:absolute;left:10mm;right:10mm;bottom:5mm;white-space:nowrap}.bpp-snap{position:absolute;left:0;right:0;bottom:0;white-space:nowrap;overflow:hidden}'
  + '@media screen and (max-width:800px){.bd-page{width:100%!important;height:auto!important}}</style></head><body>'
  + '<section data-bpp-p="1" class="page"><header class="bpp-hero"><div class="bpp-title-block"><h1 class="bpp-main-title">BUILDING PASSPORT</h1><p class="bpp-building-name">Binghatti Aquarise, Business Bay, Dubai</p></div>'
  + '<div class="bpp-photo" style="width:78mm;height:58mm"><figure class="bpp-hero" style="margin:0;width:100%;height:100%"></figure></div></header>'
  + '<div class="bpp-dash" style="width:100%;height:186mm;overflow:hidden"><div class="bpp-dash-in" style="width:100%;height:100%;overflow:hidden;display:flex;flex-direction:column">'
  + '<div style="display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:36mm;gap:2.6mm">' + [1, 2, 3, 4, 5, 6].map((i) => '<div class=card style="overflow:hidden"><div style="font:600 20pt Fraunces,serif;white-space:nowrap">AED 2,500 a figure ' + i + '</div></div>').join("") + '</div>'
  + '<div style="display:grid;grid-template-columns:1.05fr 1fr;gap:2.6mm"><div class=wide>chart</div><div class=wide>places</div></div></div></div>'
  + '<footer class="footer"><span>Curated by Najjuko · Dubai Decoded · WhatsApp +971 56 548 4397</span><span>page 1 of 4</span></footer><div class="bpp-snap">Snapshot made 2026-11-06 13:00 GST; listings change daily, generate a fresh one before sending.</div></section>'
  + '<section data-bpp-p="2" class="page bd-page">page two</section></body></html>';
const out = withMobile(PAGE);
ok(out.includes('id="bpp-mob"') && out.indexOf('id="bpp-mob"') < out.indexOf("</head>") && withMobile(out) === out, "the phone style goes in the head, once");
ok(withMobile("<html><head></head><body>a one-pager</body></html>").indexOf("bpp-mob") < 0, "a page without the passport dashboard is left alone");
ok(/@media screen and \(max-width:800px\)/.test(BPP_MOBILE_CSS) && !/@media print/.test(BPP_MOBILE_CSS), "it is a phone-screen rule only: the PDF is untouched");
const env = { MEETINGS: { get: async (k) => (k === "bpp_file_x-1_html" ? PAGE : null) } };
const res = await bppPublic(new Request("https://x.example/bp/x-1"), env, new URL("https://x.example/bp/x-1"));
ok(res && res.status === 200 && (await res.text()).includes('id="bpp-mob"'), "the public page is served with it");
const CH = "C:/Program Files/Google/Chrome/Application/chrome.exe";
if (!fs.existsSync(CH)) { console.log("skip browser part: no Chrome"); process.exit(fail ? 1 : 0); }
// measured inside a 375 px frame (headless Chrome cannot make a window that narrow)
const probe = "<script>addEventListener('load',function(){var p=document.querySelector('.page'),w=innerWidth;var over=[].filter.call(p.querySelectorAll('*'),function(e){var r=e.getBoundingClientRect();return r.width>0&&r.right>w+1}).length;"
  + "var g=getComputedStyle(document.querySelector('.bpp-dash-in>div')).gridTemplateColumns.split(' ').length;parent.postMessage({w:w,pw:Math.round(p.getBoundingClientRect().width),sw:document.documentElement.scrollWidth,over:over,cols:g,foot:getComputedStyle(document.querySelector('.footer')).position},'*')})</script>";
const frame = (h) => "<iframe style='width:375px;height:812px;border:0' srcdoc=\"" + h.replace("</body>", probe + "</body>").replace(/&/g, "&amp;").replace(/"/g, "&quot;") + "\"></iframe>";
const html = "<!doctype html><html><body>" + frame(PAGE) + frame(out) + "<script>var R=[];addEventListener('message',function(e){R.push(e.data);if(R.length===2)document.title='R:'+encodeURIComponent(JSON.stringify(R))})</script></body></html>";
const f = process.env.TEMP + "\\v794_mobile.html"; fs.writeFileSync(f, html);
const dom = execFileSync(CH, ["--headless=old", "--disable-gpu", "--window-size=1200,900", "--virtual-time-budget=8000", "--dump-dom", "file:///" + f.replace(/\\/g, "/")], { encoding: "utf8", timeout: 60000, stdio: ["ignore", "pipe", "ignore"], maxBuffer: 32e6 });
const m = /<title>R:([^<]*)<\/title>/.exec(dom); const R = m ? JSON.parse(decodeURIComponent(m[1])) : [];
const before = R.find((x) => x.pw > 400), after = R.find((x) => x.pw <= 400);
ok(before && before.pw > 700, "control: without the style page 1 is wider than the phone", R);
ok(after && after.pw === 375 && after.sw === 375 && after.over === 0, "with it page 1 is exactly the phone's width and nothing runs off the right edge", after);
ok(after && after.cols === 2 && after.foot === "static", "the six figures sit two across and the footer follows the content", after);
process.exit(fail ? 1 : 0);
