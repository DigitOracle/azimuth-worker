// v799 - MOMO "NEW LAUNCHES" (Kendall, 7 Nov 2026), for Kendall and Najjuko. Reads the same snapshot the 05:00 feed reads (KV img_launches,
// written by the 04:00 refresh from the announced projects layer): one store, two views. Light cream, 2-up cards, icons not emojis. Each card:
// project, developer, area, from AED (as advertised), unit types, plan, handover, a confidence chip, sources count, last seen, links.
// Filters: This week / All / By developer. Nothing here is for a client sheet: prices are as advertised until the developer's sheet confirms.

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const svg = (d, s) => '<svg viewBox="0 0 24 24" width="' + (s || 14) + '" height="' + (s || 14) + '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>";
export const LAUNCH_ICONS = {
  launch: '<path d="M4 20l4-1 9-9a2.8 2.8 0 0 0-4-4l-9 9-1 4z"/><path d="M13.5 6.5l4 4"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
  bed: '<path d="M3 18V8M3 14h18v4M21 14v-3a3 3 0 0 0-3-3h-7v6"/>',
  plan: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  zone: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  size: '<path d="M3 21L21 3M3 21h6M3 21v-6M21 3h-6M21 3v6"/>',
  pdf: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M12 10v7M9 14l3 3 3-3"/>',
  wa: '<path d="M4 20l1.5-4.5A8 8 0 1 1 9 19z"/><path d="M9.5 9.5c.5 2 2 3.5 4 4"/>',
  report: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
};
const nf = (v) => Math.round(Number(v) || 0).toLocaleString("en-US");
const ago = (iso, today) => { const d = Math.round((Date.parse(today) - Date.parse(iso)) / 86400000); return isNaN(d) ? "" : d <= 0 ? "today" : d === 1 ? "yesterday" : d + " days ago"; };

// Kendall 7 Nov (on the 375 px preview): a picture on every card (the newest video's thumbnail, tap = open the video; an Instagram
// picture copied into KV; else the developer's initial), small "Image: <channel>" credit; only cards with an area or a starting price;
// registered launches too, one card per project, with a status chip; filter by Dubai 2040 zone.
import { safePic } from "./launch_report.js";   // v800 - only our own face-checked picture copies are ever shown (Kendall 7 Nov: no faces)
const shown = (r) => r && r.project && (r.area || r.from_aed);
const mq = (u) => String(u || "").replace("/hqdefault.jpg", "/mqdefault.jpg");
const seenOn = (k) => (k || []).filter((x) => x === "youtube" || x === "instagram" || x === "news").map((x) => x === "youtube" ? "YouTube" : x === "instagram" ? "Instagram" : "the news");

export function launchCards(rows, today, q) {
  q = q || "";
  return (rows || []).filter(shown).map((r) => {
    const line = (ic, v) => (v ? '<div class=ln>' + svg(LAUNCH_ICONS[ic]) + '<span>' + esc(v) + '</span></div>' : "");
    const links = (r.links || []).slice(0, 3).map((u, i) => '<a class=lk href="' + esc(u) + '" target=_blank rel="noopener noreferrer">' + svg(LAUNCH_ICONS.link, 12) + (/youtube|youtu\.be/.test(u) ? "Video" : /instagram/.test(u) ? "Post" : "Source") + (i ? " " + (i + 1) : "") + "</a>").join("");
    const ini = '<span class=pini>' + esc(String(r.developer || "?").slice(0, 1)) + '</span>';
    const pic = safePic(r.pic)
      ? '<a class=pic href="' + esc(r.pic_link || (r.links || [])[0] || "#") + '" target=_blank rel="noopener noreferrer"><img src="' + esc(r.pic) + '" alt="" loading=lazy data-alt="' + esc(mq(r.pic)) + '" onerror="if(this.dataset.alt&&this.src!==this.dataset.alt){this.src=this.dataset.alt}else{this.parentNode.classList.add(\'none\');this.remove()}">' + ini + (/youtube|youtu\.be/.test(r.pic_link || "") ? '<span class=play>' + svg('<path d="M8 5v14l11-7z" fill="currentColor"/>', 16) + '</span>' : "") + '</a>' + (r.pic_credit ? '<div class=cr>Image: ' + esc(r.pic_credit) + '</div>' : "")
      : '<div class="pic none">' + ini + '</div>';
    const seen = seenOn(r.kinds);
    const chip = r.registered ? "On the register" + (seen.length ? " &middot; seen on " + esc(seen.join(", ")) : "") : "Not yet registered";
    const rq = "/momo/work/launches/report" + q + (q ? "&" : "?") + "k=" + encodeURIComponent(r.key || "");
    const share = r.key ? '<div class=sh><a class=bt href="' + esc(rq) + '">' + svg(LAUNCH_ICONS.pdf, 13) + 'PDF</a><a class="bt wa" href="' + esc(rq + "&wa=1") + '">' + svg(LAUNCH_ICONS.wa, 13) + 'WhatsApp</a></div>' : "";   // v800
    return '<div class=lc data-key="' + esc(r.key || "") + '" data-project="' + esc(r.project) + '" data-dev="' + esc(r.developer) + '" data-first="' + esc(r.first_seen) + '" data-zone="' + esc(r.zone || "") + '" data-q="' + esc([r.project, r.developer, r.area, r.area_dld, r.district, r.zone].filter(Boolean).join(" ").toLowerCase()) + '">'
      + pic
      + '<div class=top><span class="st ' + (r.registered ? "st-on" : "st-off") + '">' + chip + '</span><span class="cf cf-' + esc(r.confidence) + '">' + esc(r.confidence || "low") + '</span></div>'
      + '<b class=pj>' + esc(r.project) + '</b><div class=dv>' + esc(r.developer) + '</div>'
      + line("pin", r.area) + line("zone", r.zone ? "Dubai 2040: " + r.zone : "") + line("tag", r.from_aed ? "from AED " + nf(r.from_aed) + " as advertised" : "") + line("bed", r.units)
      + line("size", r.sizes) + line("plan", r.plan ? r.plan + " plan" : "") + line("key", r.handover ? "handover " + r.handover : "")
      + '<div class=ft>' + svg(LAUNCH_ICONS.eye, 12) + '<span>seen ' + esc(ago(r.last_seen, today)) + ' &middot; ' + nf(r.sources_n) + ' source' + (r.sources_n === 1 ? "" : "s") + '</span></div>'
      + (links ? '<div class=lks>' + links + '</div>' : "") + share + '</div>';
  }).join("");
}

// v800 - MAKE A REPORT (Kendall 7 Nov: "could she say I need a report for this week, or this month"): period, developer, Dubai 2040 zone
// (the page's own two filters), and up to 10 launches she ticks; the worker lays the report out (src/launch_report.js)
const REPORT_PANEL = '<div class=rp><button type=button id=rpo class=rpo>' + svg(LAUNCH_ICONS.report, 15) + 'Make a report</button><div id=rpp hidden>'
  + '<div class=rpl>Period</div><div class=rpb><button type=button data-p=week class=on>This week</button><button type=button data-p=month>This month</button><button type=button data-p=30>Last 30 days</button><button type=button data-p=custom>Custom</button></div>'
  + '<div id=rpc hidden class=rpd><input type=date id=rpf aria-label=From><input type=date id=rpt aria-label=To></div>'
  + '<div class=rpl>Launches <span id=rpn></span> (up to 10; the developer and zone filters above apply)</div><div id=rpk class=rpk></div>'
  + '<div class=rpa><a id=rpm class=bt href="#">' + svg(LAUNCH_ICONS.report, 13) + 'Make the report</a><a id=rpw class="bt wa" href="#">' + svg(LAUNCH_ICONS.wa, 13) + 'Send on WhatsApp</a></div></div></div>';

export function launchesPage(key, rk, snap, today) {
  const q = "?key=" + encodeURIComponent(key) + (rk ? "&rk=" + encodeURIComponent(rk) : "");
  const rows = ((snap && snap.rows) || []).filter(shown);
  const devs = [...new Set(rows.map((r) => r.developer).filter(Boolean))].sort();
  const zones = [...new Set(rows.map((r) => r.zone).filter(Boolean))].sort();
  const week = new Date(Date.parse(today) - 7 * 86400000).toISOString().slice(0, 10);
  const qa = (snap && Array.isArray(snap.qa) && snap.qa.length) ? '<p class=qa>' + svg(LAUNCH_ICONS.eye, 12) + ' Check: ' + esc(snap.qa.join("; ")) + '</p>' : "";
  return '<a class=back href="/momo' + q + '">&#8592; Momo</a><div class=tag>MOMO &middot; MARKET</div><h1>New launches</h1>'
    + '<p class=ld>New projects on the Dubai Land Department register, and launches not yet registered. Prices as advertised (developer posts, broker videos, news) until the developer\'s sheet confirms them.</p>' + qa
    + '<div class=sr>' + svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>', 16) + '<input id=qs type=search autocomplete=off placeholder="Search project, developer, area or zone" aria-label="Search launches"><button type=button id=rs>Reset</button></div>'   // v800 (Kendall 7 Nov)
    + '<div class=fl><button class=on data-f=week>This week</button><button data-f=all>All</button>'
    + '<input id=dv list=dvl autocomplete=off placeholder="By developer" aria-label="By developer"><datalist id=dvl>' + devs.map((d) => '<option value="' + esc(d) + '">').join("") + '</datalist>'
    + '<select id=zn aria-label="By Dubai 2040 zone"><option value="">By Dubai 2040 zone</option>' + zones.map((z) => '<option>' + esc(z) + '</option>').join("") + '</select></div>'
    + REPORT_PANEL
    + '<div class=grid id=lg data-week="' + week + '">' + launchCards(rows, today, q) + '</div><div class=em id=le hidden>' + svg(LAUNCH_ICONS.launch, 28) + '<p>No new launches this week.</p></div>'
    + '<p class=nt>Updated ' + esc((snap && snap.generated) || "not yet") + ' by the 04:00 refresh.</p>'
    + '<style>.ld{color:#5F6B66;font-size:.88rem;margin:0 0 12px}.qa{font-size:.78rem;color:#8A6F3E;background:#F4E9D2;border-radius:10px;padding:6px 10px;margin:0 0 10px}.fl{display:flex;gap:8px;margin:0 0 12px;flex-wrap:wrap}.fl button,.fl select{border:1px solid #C5A56A;background:#FFFDF9;color:#0A4F4A;border-radius:999px;padding:7px 14px;font:600 .82rem "IBM Plex Sans",sans-serif;max-width:100%}.fl button.on{background:#0A4F4A;color:#fff;border-color:#0A4F4A}.fl input{border:1px solid #C5A56A;background:#FFFDF9;color:#0A4F4A;border-radius:999px;padding:7px 14px;font:600 .82rem "IBM Plex Sans",sans-serif;min-width:0;flex:1 1 140px}'
    + '.sr{display:flex;align-items:center;gap:8px;background:#FFFDF9;border:1px solid #C5A56A;border-radius:999px;padding:4px 6px 4px 12px;margin:0 0 10px;color:#8A6F3E}.sr input{flex:1;min-width:0;border:0;background:transparent;font:500 .9rem "IBM Plex Sans",sans-serif;color:#1C2321;outline:none;padding:6px 0}.sr button{border:0;background:#0A4F4A;color:#fff;border-radius:999px;padding:7px 12px;font:600 .78rem "IBM Plex Sans",sans-serif}'
    + '.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.lc{background:#FFFDF9;border:1px solid #E7E1D6;border-radius:16px;padding:0 0 12px;display:flex;flex-direction:column;gap:4px;min-width:0;overflow:hidden}.lc>*:not(.pic){margin-left:12px;margin-right:12px}'
    + '.pic{position:relative;display:block;aspect-ratio:16/9;background:#EFE6D4;overflow:hidden}.pic img{width:100%;height:100%;object-fit:cover;display:block}.pic .pini{display:none}.pic.none{display:flex;align-items:center;justify-content:center}.pic.none .pini{display:flex;width:44px;height:44px;border-radius:50%;background:#0A4F4A;color:#F3E7CF;align-items:center;justify-content:center;font:600 1.2rem Fraunces,serif}'
    + '.play{position:absolute;right:8px;bottom:8px;width:30px;height:30px;border-radius:50%;background:rgba(10,79,74,.85);color:#fff;display:flex;align-items:center;justify-content:center}.cr{font-size:.62rem;color:#8FA39B;margin-top:3px}'
    + '.top{display:flex;justify-content:space-between;align-items:flex-start;gap:4px;margin-top:6px}.st{font:600 .62rem "IBM Plex Sans",sans-serif;border-radius:999px;padding:2px 7px;line-height:1.3}.st-on{background:#DCEBE4;color:#0A4F4A}.st-off{background:#F3E7CF;color:#8A6F3E}'
    + '.cf{font:600 .6rem "IBM Plex Mono",monospace;letter-spacing:.06em;text-transform:uppercase;border-radius:999px;padding:2px 6px;flex:0 0 auto}.cf-high{background:#DCEBE4;color:#0A4F4A}.cf-medium{background:#F4E9D2;color:#8A6F3E}.cf-low{background:#EEE9E1;color:#5F6B66}'
    + '.pj{font:600 1rem/1.2 Fraunces,serif;color:#0A4F4A;margin-top:4px;overflow-wrap:anywhere}.dv{font-size:.78rem;color:#8A6F3E;font-weight:600;margin-bottom:4px}'
    + '.ln{display:flex;gap:6px;align-items:flex-start;font-size:.8rem;color:#1C2321}.ln svg{flex:0 0 14px;color:#C5A56A;margin-top:2px}.ln span{min-width:0;overflow-wrap:anywhere}'
    + '.ft{display:flex;gap:5px;align-items:center;font-size:.72rem;color:#5F6B66;margin-top:6px;border-top:1px solid #EFE9DE;padding-top:6px}.lks{display:flex;gap:6px;flex-wrap:wrap}.lk{display:inline-flex;gap:3px;align-items:center;font-size:.72rem;color:#0A4F4A;text-decoration:none;border:1px solid #D8CDB8;border-radius:999px;padding:2px 8px}'
    + '.sh{display:flex;gap:6px;margin-top:6px}.bt{display:inline-flex;gap:4px;align-items:center;font:600 .74rem "IBM Plex Sans",sans-serif;color:#fff;background:#0A4F4A;text-decoration:none;border-radius:999px;padding:5px 10px}.bt.wa{background:#FFFDF9;color:#0A4F4A;border:1px solid #0A4F4A}'
    + '.rp{margin:0 0 12px}.rpo{display:inline-flex;gap:6px;align-items:center;border:1px solid #0A4F4A;background:#FFFDF9;color:#0A4F4A;border-radius:999px;padding:8px 14px;font:600 .85rem "IBM Plex Sans",sans-serif}#rpp{background:#FFFDF9;border:1px solid #E7E1D6;border-radius:16px;padding:12px;margin-top:8px}#rpp[hidden],#rpc[hidden]{display:none}'
    + '.rpl{font:600 .72rem "IBM Plex Mono",monospace;letter-spacing:.08em;color:#8A6F3E;text-transform:uppercase;margin:6px 0}.rpb{display:flex;gap:6px;flex-wrap:wrap}.rpb button{border:1px solid #C5A56A;background:#fff;color:#0A4F4A;border-radius:999px;padding:6px 12px;font:600 .8rem "IBM Plex Sans",sans-serif}.rpb button.on{background:#0A4F4A;color:#fff}'
    + '.rpd{display:flex;gap:6px;margin-top:6px}.rpd input{flex:1;min-width:0;border:1px solid #C5A56A;border-radius:10px;padding:6px}.rpk{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.rpk label{display:flex;gap:6px;align-items:flex-start;font-size:.78rem;background:#fff;border:1px solid #EFE9DE;border-radius:10px;padding:6px;overflow-wrap:anywhere}.rpa{display:flex;gap:8px;margin-top:10px}'
    + '.em{display:flex;flex-direction:column;align-items:center;gap:8px;padding:40px 0;border:1px dashed #D8D1C4;border-radius:18px;color:#5F6B66}.em[hidden]{display:none}.em p{margin:0}.nt{font-size:.72rem;color:#8FA39B;margin-top:14px}</style>'
    + '<script>(function(){var g=document.getElementById("lg"),e=document.getElementById("le"),s=document.getElementById("dv"),z=document.getElementById("zn"),Q=document.getElementById("qs"),f="week",W=g.getAttribute("data-week");function has(c,a,v){return !v||String(c.getAttribute(a)||"").toLowerCase().indexOf(v.trim().toLowerCase())>=0}'
    + 'function run(){var n=0;[].forEach.call(g.children,function(c){var ok=(f==="all"||c.getAttribute("data-first")>=W)&&has(c,"data-dev",s.value)&&(!z.value||c.getAttribute("data-zone")===z.value)&&Q.value.trim().toLowerCase().split(/\\s+/).every(function(w){return has(c,"data-q",w)});c.style.display=ok?"":"none";if(ok)n++});e.hidden=n>0}'
    + '[].forEach.call(document.querySelectorAll(".fl button"),function(b){b.onclick=function(){f=b.getAttribute("data-f");[].forEach.call(document.querySelectorAll(".fl button"),function(x){x.classList.toggle("on",x===b)});run()}});s.oninput=run;s.onchange=run;z.onchange=run;Q.oninput=run;document.getElementById("rs").onclick=function(){Q.value="";s.value="";z.value="";f="week";[].forEach.call(document.querySelectorAll(".fl button"),function(x){x.classList.toggle("on",x.getAttribute("data-f")==="week")});run();s.dispatchEvent(new Event("change"))};run()})()</script>'
    + '<script>(function(){var o=document.getElementById("rpo"),P=document.getElementById("rpp"),g=document.getElementById("lg"),K=document.getElementById("rpk"),N=document.getElementById("rpn"),C=document.getElementById("rpc"),F=document.getElementById("rpf"),T=document.getElementById("rpt"),s=document.getElementById("dv"),z=document.getElementById("zn"),per="week",today=' + JSON.stringify(today) + ';'
    + 'function ago(n){return new Date(Date.parse(today)-n*864e5).toISOString().slice(0,10)}function range(){if(per==="month")return[today.slice(0,8)+"01",today];if(per==="30")return[ago(30),today];if(per==="custom"&&F.value&&T.value)return[F.value,T.value];return[ago(7),today]}'
    + 'function list(){var r=range(),out=[];[].forEach.call(g.children,function(c){var f=c.getAttribute("data-first");if(f>=r[0]&&f<=r[1]&&(!s.value||String(c.getAttribute("data-dev")||"").toLowerCase().indexOf(s.value.trim().toLowerCase())>=0)&&(!z.value||c.getAttribute("data-zone")===z.value))out.push(c)});'
    + 'K.innerHTML="";out.forEach(function(c,i){var l=document.createElement("label"),b=document.createElement("input");b.type="checkbox";b.value=c.getAttribute("data-key");b.checked=i<10;b.onchange=cap;l.appendChild(b);l.appendChild(document.createTextNode(c.getAttribute("data-project")));K.appendChild(l)});cap()}'
    + 'function cap(){var on=K.querySelectorAll("input:checked");if(on.length>10)this.checked=false;on=K.querySelectorAll("input:checked");N.textContent="("+on.length+" ticked)";var k=[].map.call(on,function(b){return b.value}).join(","),r=range(),u=' + JSON.stringify("/momo/work/launches/report" + q + (q ? "&" : "?")) + '+"k="+encodeURIComponent(k)+"&period="+per+(per==="custom"?"&from="+r[0]+"&to="+r[1]:"");document.getElementById("rpm").href=u;document.getElementById("rpw").href=u+"&wa=1"}'
    + 'o.onclick=function(){P.hidden=!P.hidden;if(!P.hidden)list()};[].forEach.call(document.querySelectorAll(".rpb button"),function(b){b.onclick=function(){per=b.getAttribute("data-p");[].forEach.call(document.querySelectorAll(".rpb button"),function(x){x.classList.toggle("on",x===b)});C.hidden=per!=="custom";list()}});F.onchange=list;T.onchange=list;s.addEventListener("change",function(){if(!P.hidden)list()});z.addEventListener("change",function(){if(!P.hidden)list()})})()</script>';
}

export async function launchesRoute(request, env, url, deps) {
  if (url.pathname !== "/momo/work/launches" || request.method !== "GET") return null;
  let snap = null; try { snap = await deps.kv(env, "launches"); } catch (e) {}
  const today = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
  return new Response(deps.page(url.searchParams.get("key") || "", url.searchParams.get("rk") || "", launchesPage(url.searchParams.get("key") || "", url.searchParams.get("rk") || "", snap, today)),
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
