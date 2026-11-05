// Audit: fetch each live Momo page and public link, then load it in headless Chrome with an error collector.
// The key comes from env AUDIT_KEY and is never printed.
import fs from "fs";
import { execFileSync } from "child_process";
const K = process.env.AUDIT_KEY || "";
const B = "https://azimuth-2.digitalchemy.workers.dev";
const CH = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = process.env.LOCALAPPDATA + "/Temp/claude/69ae2f9f80320527/dfdba7aa-873b-4c5f-b88e-7ca4eb14469d/scratchpad/audit/";
fs.mkdirSync(OUT, { recursive: true });
const keyed = ["/momo", "/momo/work", "/momo/work/planner", "/momo/work/planner/data", "/momo/work/passports", "/momo/work/products", "/momo/work/sheets",
  "/momo/work/brokers", "/momo/work/presentations", "/momo/work/reels", "/momo/campaigns", "/momo/work/calendar", "/fit", "/momo/work/jobs", "/momo/work/speaking", "/momo/work/ggu", "/momo/work/briefs"];
const open = [B + "/momo/checkin.js", B + "/dp/palm-springs?r=investor", B + "/dp/palm-jebel-ali?r=keeper&v=full", B + "/p/revkeep2", B + "/p/revsell2", B + "/p/revinvs2",
  "https://najma-passport.vercel.app/revkeep2", "https://fnrealty-dubai.vercel.app/kpv5nov7", "https://fnrealty.vercel.app"];
const COLLECT = "<script>window.__E=[];window.onerror=function(m,s,l,c){window.__E.push(String(m)+' @'+l+':'+c)};window.addEventListener('unhandledrejection',function(e){window.__E.push('REJ '+(e.reason&&(e.reason.message||e.reason)||e.reason))});setTimeout(function(){var b=getComputedStyle(document.body).backgroundColor;var empty=[].slice.call(document.querySelectorAll('[id]')).filter(function(x){return /^(w|bpp_|cp|pl)/.test(x.id)&&x.children.length===0&&!x.textContent.trim()&&!/input|select|textarea|button/i.test(x.tagName)&&getComputedStyle(x).display!=='none'}).map(function(x){return x.id}).slice(0,12);document.title='AUDIT:'+JSON.stringify({err:window.__E.slice(0,6),bg:b,empty:empty})},4000)</script>";
const rows = [];
async function one(url, label) {
  let st = 0, body = "", ct = "";
  try { const r = await fetch(url, { redirect: "manual" }); st = r.status; ct = r.headers.get("content-type") || ""; body = await r.text(); } catch (e) { st = "ERR " + e.message; }
  const row = { page: label, status: st, type: ct.split(";")[0] };
  const html = /html/.test(ct);
  row.rawFile = /\.(pdf|docx|xlsx)\b/i.test(body.replace(/<script[\s\S]*?<\/script>/g, "")) && /\d{10,}_/.test(body) ? "yes" : "";
  row.toConfirm = /to confirm/i.test(body.replace(/<script[\s\S]*?<\/script>/g, "")) ? "yes" : "";
  row.nameShim = /__name\(/.test(body) && !/__name=function/.test(body) ? "RISK" : "";
  if (html && st === 200) {
    const f = OUT + label.replace(/[^a-z0-9]+/gi, "_") + ".html";
    const base = url.replace(/(https?:\/\/[^/]+).*/, "$1");
    fs.writeFileSync(f, body.replace(/<head>/i, "<head><base href=\"" + base + "/\">" + COLLECT));
    try {
      const dom = execFileSync(CH, ["--headless=old", "--disable-gpu", "--virtual-time-budget=6000", "--dump-dom", "file:///" + f.replace(/\\/g, "/")], { encoding: "utf8", timeout: 60000, stdio: ["ignore", "pipe", "ignore"] });
      const m = /<title>AUDIT:([^<]*)<\/title>/.exec(dom);
      if (m) { const j = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")); row.jsErrors = j.err.join(" | "); row.bg = j.bg; row.empty = j.empty.join(","); }
      else row.jsErrors = "no audit result (page replaced title?)";
    } catch (e) { row.jsErrors = "chrome: " + String(e.message).slice(0, 80); }
  }
  rows.push(row);
}
for (const p of keyed) await one(B + p + (p.includes("?") ? "&" : "?") + "key=" + K, p);
for (const u of open) await one(u, u.replace(/^https?:\/\//, ""));
fs.writeFileSync(OUT + "live_pages.json", JSON.stringify(rows, null, 1));
for (const r of rows) console.log([r.status, r.page, r.type, r.bg || "", r.jsErrors ? "JSERR " + r.jsErrors.slice(0, 140) : "", r.empty ? "EMPTY " + r.empty : "", r.toConfirm ? "TO-CONFIRM" : "", r.rawFile ? "RAWFILE" : "", r.nameShim].filter(Boolean).join("  "));
