// v646 - MOMO - SPEAKING ENGAGEMENTS (Kendall, 27 Oct 2026: "a front end card that is speaking engagements, because there's quite a few"; part of his DNA).
// One record per person in KV, speaking_rec_kendall: every talk, masterclass, keynote, panel, webinar, lecture or award, with its date, venue, audience,
// objectives and session outline. Kendall's key only (personOfKey = "kendall"); anyone else gets "not found". THIS REPO IS PUBLIC: titles, organisers,
// venues and outlines live in the KV record (loaded once by a script kept outside git, then edited on the page); the code holds only the shape and the page.
export const SPK_PREFIX = "speaking_rec_";
export const TYPES = ["masterclass", "keynote", "talk", "panel", "webinar", "lecture", "award", "judge"];
export const FORMATS = ["in-person", "online", "hybrid"];
export const SPK_STATUSES = ["proposed", "confirmed", "delivered", "cancelled"];
export const MAX_ITEMS = 300;
const S = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, n);
const url = (v) => { const u = S(v, 500).trim(); return /^https?:\/\/[^\s]+$/i.test(u) ? u : ""; };
const day = (v) => { const d = S(v, 10).trim(); return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : ""; };
const hm = (v) => { const t = S(v, 5).trim(); return /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : ""; };
const int = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 ? Math.min(n, 100000) : 0; };
const slug = (v) => S(v, 60).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
const pick = (v, list, d) => (list.includes(v) ? v : d);
const strs = (a, n, m) => (Array.isArray(a) ? a : []).slice(0, n).map((x) => S(x, m).trim()).filter(Boolean);

export function cleanItem(x, prev) {
  const g = x && typeof x === "object" ? x : {}, o = Object.assign({}, prev || {}), has = (k) => g[k] !== undefined;
  [["title", 160], ["organiser", 120], ["venue", 120], ["city", 60], ["country", 60], ["audience", 600], ["summary", 1500], ["folder", 300], ["notes", 2000]]
    .forEach(([k, n]) => { if (has(k)) o[k] = S(g[k], n).trim(); else if (o[k] === undefined) o[k] = ""; });
  if (has("type")) o.type = pick(g.type, TYPES, "talk"); else if (!o.type) o.type = "talk";
  if (has("format")) o.format = pick(g.format, FORMATS, "in-person"); else if (!o.format) o.format = "in-person";
  if (has("status")) o.status = pick(g.status, SPK_STATUSES, o.status || "proposed"); else if (!o.status) o.status = "proposed";
  if (has("date")) o.date = day(g.date); else if (o.date === undefined) o.date = "";
  if (has("endDate")) o.endDate = day(g.endDate); else if (o.endDate === undefined) o.endDate = "";
  if (has("start")) o.start = hm(g.start); else if (o.start === undefined) o.start = "";
  if (has("end")) o.end = hm(g.end); else if (o.end === undefined) o.end = "";
  if (has("durationMins")) o.durationMins = int(g.durationMins); else if (o.durationMins === undefined) o.durationMins = 0;
  if (has("website")) o.website = url(g.website) || (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(S(g.website, 300).trim()) ? "https://" + S(g.website, 300).trim() : ""); else if (o.website === undefined) o.website = "";
  if (has("objectives")) o.objectives = strs(g.objectives, 20, 300); else if (!Array.isArray(o.objectives)) o.objectives = [];
  if (has("outline")) o.outline = (Array.isArray(g.outline) ? g.outline : []).slice(0, 40).map((s) => ({ time: S(s && s.time, 20).trim(), mins: int(s && s.mins), segment: S(s && s.segment, 160).trim(), covers: S(s && s.covers, 600).trim(), interactive: S(s && s.interactive, 400).trim() })).filter((s) => s.segment);
  else if (!Array.isArray(o.outline)) o.outline = [];
  if (has("materials")) o.materials = (Array.isArray(g.materials) ? g.materials : []).slice(0, 20).map((m) => ({ label: S(m && m.label, 120).trim(), url: url(m && m.url) })).filter((m) => m.label && m.url);
  else if (!Array.isArray(o.materials)) o.materials = [];
  o.id = slug(g.id || o.id) || ("s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
  return o;
}
export const emptySpk = () => ({ v: 1, updatedAt: "", items: [], log: [] });
export function cleanSpk(r) {
  const x = r && typeof r === "object" ? r : {}, seen = new Set(), items = [];
  (Array.isArray(x.items) ? x.items : []).slice(0, MAX_ITEMS).forEach((i) => { const c = cleanItem(i); c.updatedAt = S(i && i.updatedAt, 30); if (!seen.has(c.id)) { seen.add(c.id); items.push(c); } });
  return { v: 1, updatedAt: S(x.updatedAt, 30), items, log: (Array.isArray(x.log) ? x.log : []).slice(0, 40).map((l) => ({ at: S(l && l.at, 30), text: S(l && l.text, 200) })).filter((l) => l.text) };
}
export async function readSpk(env, person) { let r = null; try { r = JSON.parse(await env.MEETINGS.get(SPK_PREFIX + person)); } catch (e) {} return r ? cleanSpk(r) : null; }
async function writeSpk(env, person, rec, line) {
  const now = new Date().toISOString(); rec.updatedAt = now;
  if (line) rec.log = [{ at: now, text: S(line, 200) }].concat(rec.log || []).slice(0, 40);
  await env.MEETINGS.put(SPK_PREFIX + person, JSON.stringify(rec)); return rec;
}
export async function spkApi(env, person, b) {
  const rec = (await readSpk(env, person)) || emptySpk(), find = (id) => rec.items.findIndex((i) => i.id === slug(id)), now = new Date().toISOString();
  switch (b.action) {
    case "save_item": {
      const i = b.item && b.item.id ? find(b.item.id) : -1;
      if (i < 0 && rec.items.length >= MAX_ITEMS) return { error: "The list is full.", status: 400 };
      const c = cleanItem(b.item || {}, i >= 0 ? rec.items[i] : null); c.updatedAt = now;
      if (!c.title) return { error: "Give it a title.", status: 400 };
      if (i >= 0) rec.items[i] = c; else rec.items.push(c);
      await writeSpk(env, person, rec, (i >= 0 ? "Edited: " : "Added: ") + c.title); return { ok: true, rec };
    }
    case "delete_item": { const i = find(b.id); if (i < 0) return { error: "Not found.", status: 404 }; const t = rec.items[i].title; rec.items.splice(i, 1); await writeSpk(env, person, rec, "Removed: " + t); return { ok: true, rec }; }
    case "set_status": {
      const i = find(b.id); if (i < 0) return { error: "Not found.", status: 404 };
      if (!SPK_STATUSES.includes(b.status)) return { error: "Unknown status.", status: 400 };
      rec.items[i].status = b.status; rec.items[i].updatedAt = now; await writeSpk(env, person, rec, rec.items[i].title + ": " + b.status); return { ok: true, rec };
    }
    case "import_items": {   // merge by id: fields sent replace, fields not sent stay (so later refreshes keep the page's edits)
      const list = Array.isArray(b.items) ? b.items : []; let added = 0, merged = 0;
      for (const x of list) {
        const id = slug(x && x.id); const i = id ? find(id) : -1;
        if (i >= 0) { rec.items[i] = Object.assign(cleanItem(x, rec.items[i]), { updatedAt: now }); merged++; }
        else if (rec.items.length < MAX_ITEMS) { const c = cleanItem(x); c.updatedAt = now; if (c.title) { rec.items.push(c); added++; } }
      }
      await writeSpk(env, person, rec, "Imported " + added + " new, " + merged + " updated"); return { ok: true, added, merged, rec };
    }
    default: return { error: "Unknown action.", status: 400 };
  }
}

// Dubai's calendar day (UTC+4, no daylight saving) and the upcoming / past split: upcoming = ends today or later, soonest first; past = newest first.
export const dubaiDay = (ms) => new Date((ms == null ? Date.now() : ms) + 4 * 3600e3).toISOString().slice(0, 10);
export function splitItems(items, today) {
  const t = today || dubaiDay(), last = (i) => i.endDate || i.date;
  const tbc = (i) => !i.date && (i.status === "proposed" || i.status === "confirmed");   // date TBC: listed under Upcoming, after the dated ones
  const up = items.filter((i) => (i.date && last(i) >= t && i.status !== "cancelled") || tbc(i)).sort((a, b) => (a.date ? 0 : 1) - (b.date ? 0 : 1) || (a.date + a.start).localeCompare(b.date + b.start));
  const past = items.filter((i) => !up.includes(i)).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return { up, past };
}
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function whenLabel(i) {
  if (!i.date) return "Date TBC";
  const d = new Date(i.date + "T00:00:00Z"), a = WD[d.getUTCDay()] + " " + d.getUTCDate() + " " + MO[d.getUTCMonth()] + " " + d.getUTCFullYear();
  const e = i.endDate && i.endDate !== i.date ? " to " + Number(i.endDate.slice(8)) + " " + MO[Number(i.endDate.slice(5, 7)) - 1] : "";
  return a + e + (i.start ? ", " + i.start + (i.end ? "-" + i.end : "") + " GST" : "");
}
export function countdown(i, today) {
  if (!i || !i.date) return "";
  const n = Math.round((Date.parse(i.date + "T00:00:00Z") - Date.parse((today || dubaiDay()) + "T00:00:00Z")) / 864e5);
  return n < 0 ? "under way" : n === 0 ? "today" : n === 1 ? "tomorrow" : "in " + n + " days";
}

// ---- page ----
export const SPK_ICON = '<path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M8 21h8"/>';
const SPK_CSS = '<style>.sh{color:#5F6B66;font-size:.82rem;margin:0 0 10px}.nx{background:#0A4F4A;color:#fff;border-radius:16px;padding:14px 16px;margin:0 0 14px}.nx small{color:#C5A56A;font-family:"IBM Plex Mono",monospace;letter-spacing:.12em;font-size:.66rem}'
  + '.nx b{display:block;font-family:Fraunces,serif;font-size:1.1rem;margin:4px 0}.nx span{font-size:.85rem;opacity:.9}.ch{display:inline-block;background:#C5A56A;color:#0A4F4A;border-radius:999px;padding:3px 10px;font-weight:700;font-size:.78rem;margin-top:8px}'
  + '.sf{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}.sf select{border:1px solid #D8D1C4;border-radius:999px;padding:7px 10px;background:#fff;font:600 .8rem "IBM Plex Sans",sans-serif}'
  + 'h2{font-family:Fraunces,serif;font-size:1.05rem;color:#0A4F4A;margin:18px 0 8px}.sc{background:#fff;border:1px solid #E5DFD3;border-left:4px solid #C5A56A;border-radius:14px;padding:12px 14px;margin:0 0 10px;cursor:pointer}'
  + '.sc h3{margin:0 0 4px;font-size:.98rem}.sc p{margin:2px 0;color:#5F6B66;font-size:.82rem}.sc i{font-style:normal;font-size:.7rem;font-weight:700;border-radius:999px;padding:2px 8px;margin-right:5px;background:#E6F0EE;color:#0A4F4A}'
  + '.sc i.st{background:#F6EEDC;color:#7A5B1E}.sd{display:none;margin-top:10px;border-top:1px solid #EEE7DA;padding-top:10px;font-size:.84rem}.sc.open .sd{display:block}.sd table{width:100%;border-collapse:collapse;font-size:.76rem}'
  + '.sd th,.sd td{border-bottom:1px solid #EEE7DA;text-align:left;padding:5px 4px;vertical-align:top}.sd th{color:#0A4F4A}.sb{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}'
  + '.sb a,.sb button{border:1px solid #0A4F4A;background:#fff;color:#0A4F4A;border-radius:999px;padding:7px 12px;font:600 .78rem "IBM Plex Sans",sans-serif;text-decoration:none;cursor:pointer}'
  + '.sb .pri{background:#0A4F4A;color:#fff}.fm{display:none;background:#fff;border:1px solid #E5DFD3;border-radius:14px;padding:12px;margin:10px 0}.fm.on{display:block}.fm label{display:block;font-size:.74rem;color:#5F6B66;margin:8px 0 2px}'
  + '.fm input,.fm select,.fm textarea{width:100%;box-sizing:border-box;border:1px solid #D8D1C4;border-radius:10px;padding:8px;font:400 .86rem "IBM Plex Sans",sans-serif}.g2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.em{color:#5F6B66;font-size:.85rem;padding:16px 0}</style>';
export const SPK_BODY = SPK_CSS + '<a class=back href="/momo" id=sback>&#8592; Momo</a><div class=tag>MOMO</div><h1>Speaking</h1><p class=sh id=supd>Loading...</p><div id=snext></div>'
  + '<div class=sf><select id=fy><option value="">All years</option></select><select id=ft><option value="">All types</option></select><button type=button id=sadd style="border:1px solid #0A4F4A;background:#0A4F4A;color:#fff;border-radius:999px;padding:7px 12px;font:600 .8rem IBM Plex Sans,sans-serif">Add</button>'
  + '<a id=sall target=_blank rel=noopener style="border:1px solid #0A4F4A;color:#0A4F4A;border-radius:999px;padding:7px 12px;font:600 .8rem IBM Plex Sans,sans-serif;text-decoration:none">Download all</a></div>'
  + '<div class=fm id=sform><input type=hidden id=f_id><label>Title</label><input id=f_title><label>Organiser</label><input id=f_org>'
  + '<div class=g2><div><label>Type</label><select id=f_type></select></div><div><label>Status</label><select id=f_status></select></div></div>'
  + '<div class=g2><div><label>Date</label><input id=f_date type=date></div><div><label>End date</label><input id=f_end type=date></div></div>'
  + '<div class=g2><div><label>Start (GST)</label><input id=f_start type=time></div><div><label>End (GST)</label><input id=f_endt type=time></div></div>'
  + '<div class=g2><div><label>Venue</label><input id=f_venue></div><div><label>City</label><input id=f_city></div></div>'
  + '<div class=g2><div><label>Country</label><input id=f_country></div><div><label>Format</label><select id=f_format></select></div></div>'
  + '<label>Website</label><input id=f_web><label>Audience</label><textarea id=f_aud rows=2></textarea><label>Summary</label><textarea id=f_sum rows=3></textarea>'
  + '<label>Objectives (one per line)</label><textarea id=f_obj rows=3></textarea><label>Notes</label><textarea id=f_notes rows=2></textarea>'
  + '<div class=sb><button type=button class=pri id=f_save>Save</button><button type=button id=f_cancel>Cancel</button></div><p class=sh id=f_msg></p></div>'
  + '<h2>Upcoming</h2><div id=sup></div><h2>Past</h2><div id=spast></div>';
// v647 - wrangler's bundler wraps functions with __name(fn,"name"); embedding fn.toString() in the page carries that call, so the page must define __name or it throws before drawing (Speaking showed "Could not load", 27 Oct).
export const SPK_JS = "var __name=function(f){return f};var whenLabel=" + whenLabel.toString() + ";var countdown=" + countdown.toString() + ";var splitItems=" + splitItems.toString() + ";var dubaiDay=" + dubaiDay.toString() + ";var WD=" + JSON.stringify(WD) + ";var MO=" + JSON.stringify(MO)
  + ";var TYPES=" + JSON.stringify(TYPES) + ";var FORMATS=" + JSON.stringify(FORMATS) + ";var STS=" + JSON.stringify(SPK_STATUSES) + ";" + String.raw`(function(){
var KEY=new URLSearchParams(location.search).get("key")||"",REC={items:[]},$=function(i){return document.getElementById(i)};
$("sback").href="/momo?door=1&key="+encodeURIComponent(KEY);$("sall").href="/momo/work/speaking/report?key="+encodeURIComponent(KEY);
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function opts(id,list){var s=$(id);list.forEach(function(v){var o=el("option","",v);o.value=v;s.appendChild(o)})}
opts("f_type",TYPES);opts("f_status",STS);opts("f_format",FORMATS);opts("ft",TYPES);
function api(b){return fetch("/momo/work/speaking/api?key="+encodeURIComponent(KEY),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)}).then(function(r){return r.json()})}
function card(i){var c=el("div","sc");c.appendChild(el("h3","",i.title));c.appendChild(el("p","",(i.organiser||"")+(i.venue?" | "+i.venue:"")+(i.city?", "+i.city:"")));c.appendChild(el("p","",whenLabel(i)));
var t=el("p");var a=el("i","",i.type);t.appendChild(a);var b=el("i","st",i.status);t.appendChild(b);if(i.format)t.appendChild(el("i","",i.format));c.appendChild(t);
var d=el("div","sd");if(i.audience)d.appendChild(el("p","","Audience: "+i.audience));if(i.summary)d.appendChild(el("p","",i.summary));
if(i.objectives&&i.objectives.length){var ul=el("ul");i.objectives.forEach(function(o){ul.appendChild(el("li","",o))});d.appendChild(el("p","","Objectives"));d.appendChild(ul)}
if(i.outline&&i.outline.length){var tb=el("table"),h=el("tr");["Time","Min","Segment","What it covers","Interactive"].forEach(function(x){h.appendChild(el("th","",x))});tb.appendChild(h);
i.outline.forEach(function(s){var r=el("tr");[s.time,s.mins||"",s.segment,s.covers,s.interactive].forEach(function(x){r.appendChild(el("td","",x))});tb.appendChild(r)});d.appendChild(tb)}
if(i.website){var w=el("a","",i.website);w.href=i.website;w.target="_blank";w.rel="noopener noreferrer";var wp=el("p");wp.appendChild(w);d.appendChild(wp)}
(i.materials||[]).forEach(function(m){var mp=el("p"),ma=el("a","",m.label);ma.href=m.url;ma.target="_blank";ma.rel="noopener noreferrer";mp.appendChild(ma);d.appendChild(mp)});
if(i.folder)d.appendChild(el("p","","Folder: "+i.folder));if(i.notes)d.appendChild(el("p","","Notes: "+i.notes));
var sb=el("div","sb"),pdf=el("a","pri","Brief (PDF)");pdf.href="/momo/work/speaking/report?id="+encodeURIComponent(i.id)+"&key="+encodeURIComponent(KEY);pdf.target="_blank";sb.appendChild(pdf);
var ed=el("button","","Edit");ed.type="button";ed.onclick=function(e){e.stopPropagation();openForm(i)};sb.appendChild(ed);
var ss=el("select");STS.forEach(function(v){var o=el("option","",v);o.value=v;if(v===i.status)o.selected=true;ss.appendChild(o)});ss.onclick=function(e){e.stopPropagation()};
ss.onchange=function(){api({action:"set_status",id:i.id,status:ss.value}).then(function(r){if(r.rec){REC=r.rec;draw()}})};sb.appendChild(ss);d.appendChild(sb);c.appendChild(d);
c.onclick=function(){c.classList.toggle("open")};return c}
function draw(){$("supd").textContent=REC.items.length+" engagements"+(REC.updatedAt?" | updated "+REC.updatedAt.slice(0,10):"");
var ys={};REC.items.forEach(function(i){if(i.date)ys[i.date.slice(0,4)]=1});var fy=$("fy"),cur=fy.value;while(fy.options.length>1)fy.remove(1);Object.keys(ys).sort().reverse().forEach(function(y){var o=el("option","",y);o.value=y;fy.appendChild(o)});fy.value=cur;
var Y=fy.value,T=$("ft").value,list=REC.items.filter(function(i){return(!Y||(i.date||"").slice(0,4)===Y)&&(!T||i.type===T)});
var sp=splitItems(list,dubaiDay()),nx=$("snext");nx.textContent="";var all=splitItems(REC.items,dubaiDay());
if(all.up.length){var n=all.up[0],b=el("div","nx");b.appendChild(el("small","","NEXT"));b.appendChild(el("b","",n.title));b.appendChild(el("span","",whenLabel(n)+(n.venue?" | "+n.venue:"")));b.appendChild(el("div"));b.lastChild.appendChild(el("span","ch",countdown(n,dubaiDay())));nx.appendChild(b)}
[["sup",sp.up,"Nothing coming up."],["spast",sp.past,"Nothing yet."]].forEach(function(x){var box=$(x[0]);box.textContent="";if(!x[1].length)box.appendChild(el("p","em",x[2]));x[1].forEach(function(i){box.appendChild(card(i))})})}
function openForm(i){i=i||{};$("sform").classList.add("on");$("f_id").value=i.id||"";$("f_title").value=i.title||"";$("f_org").value=i.organiser||"";$("f_type").value=i.type||"talk";$("f_status").value=i.status||"proposed";
$("f_date").value=i.date||"";$("f_end").value=i.endDate||"";$("f_start").value=i.start||"";$("f_endt").value=i.end||"";$("f_venue").value=i.venue||"";$("f_city").value=i.city||"";$("f_country").value=i.country||"";
$("f_format").value=i.format||"in-person";$("f_web").value=i.website||"";$("f_aud").value=i.audience||"";$("f_sum").value=i.summary||"";$("f_obj").value=(i.objectives||[]).join("\n");$("f_notes").value=i.notes||"";$("f_msg").textContent="";window.scrollTo(0,$("sform").offsetTop-20)}
$("sadd").onclick=function(){openForm()};$("f_cancel").onclick=function(){$("sform").classList.remove("on")};$("fy").onchange=draw;$("ft").onchange=draw;
$("f_save").onclick=function(){var it={id:$("f_id").value||undefined,title:$("f_title").value,organiser:$("f_org").value,type:$("f_type").value,status:$("f_status").value,date:$("f_date").value,endDate:$("f_end").value,start:$("f_start").value,end:$("f_endt").value,venue:$("f_venue").value,city:$("f_city").value,country:$("f_country").value,format:$("f_format").value,website:$("f_web").value,audience:$("f_aud").value,summary:$("f_sum").value,objectives:$("f_obj").value.split("\n"),notes:$("f_notes").value};
api({action:"save_item",item:it}).then(function(r){if(r.error){$("f_msg").textContent=r.error;return}REC=r.rec;$("sform").classList.remove("on");draw()})};
fetch("/momo/work/speaking/rec?key="+encodeURIComponent(KEY)).then(function(r){return r.json()}).then(function(d){REC=d.rec||REC;draw()}).catch(function(){$("supd").textContent="Could not load. Try again."})})();`;

// ---- printable brief: one engagement (?id=) or the whole list; DigitAlchemy identity (teal #0A4F4A, gold #C5A56A) ----
const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const R_CSS = '@page{size:A4 portrait;margin:14mm}body{margin:0;background:#fff;color:#1C2321;font-family:"IBM Plex Sans",Arial,sans-serif;font-size:10.5pt}.top{background:#0A4F4A;color:#fff;padding:16px 18px;border-bottom:4px solid #C5A56A}'
  + '.top small{color:#C5A56A;letter-spacing:.14em;font-size:8pt}.top h1{font-family:Georgia,serif;font-size:18pt;margin:4px 0 2px}.top p{margin:0;font-size:9.5pt;opacity:.92}.bd{padding:14px 18px}h2{color:#0A4F4A;font-family:Georgia,serif;font-size:12pt;border-bottom:1px solid #C5A56A;padding-bottom:3px;margin:16px 0 6px}'
  + 'table{width:100%;border-collapse:collapse;font-size:9pt}th,td{border-bottom:1px solid #E5DFD3;text-align:left;padding:5px 4px;vertical-align:top}th{color:#0A4F4A}.it{page-break-inside:avoid;border-left:3px solid #C5A56A;padding:6px 10px;margin:0 0 10px}'
  + '.it b{color:#0A4F4A}.ft{color:#5F6B66;font-size:8pt;border-top:1px solid #E5DFD3;margin-top:18px;padding-top:6px}.np{margin:10px 18px}.np button{border:1px solid #0A4F4A;background:#0A4F4A;color:#fff;border-radius:999px;padding:8px 14px;font:600 10pt Arial;cursor:pointer}@media print{.np{display:none}}';
const MIC = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#C5A56A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px;margin-right:6px">' + SPK_ICON + '</svg>';
function rowsOf(i) {
  return [["When", whenLabel(i)], ["Organiser", i.organiser], ["Venue", [i.venue, i.city, i.country].filter(Boolean).join(", ")], ["Format", i.format + (i.durationMins ? ", " + i.durationMins + " minutes" : "")],
    ["Type", i.type], ["Status", i.status], ["Website", i.website]].filter((r) => r[1]).map((r) => "<tr><th>" + esc(r[0]) + "</th><td>" + esc(r[1]) + "</td></tr>").join("");
}
export function spkReport(rec, id) {
  const one = id ? rec.items.find((i) => i.id === slug(id)) : null;
  let body;
  if (one) {
    body = '<div class=top><small>' + MIC + 'SPEAKING ENGAGEMENT</small><h1>' + esc(one.title) + '</h1><p>' + esc(whenLabel(one)) + (one.venue ? " | " + esc(one.venue) : "") + '</p></div><div class=bd><table>' + rowsOf(one) + '</table>'
      + (one.audience ? "<h2>Audience</h2><p>" + esc(one.audience) + "</p>" : "") + (one.summary ? "<h2>Summary</h2><p>" + esc(one.summary) + "</p>" : "")
      + (one.objectives.length ? "<h2>Objectives</h2><ul>" + one.objectives.map((o) => "<li>" + esc(o) + "</li>").join("") + "</ul>" : "")
      + (one.outline.length ? "<h2>Session outline</h2><table><tr><th>Time</th><th>Min</th><th>Segment</th><th>What it covers</th><th>Interactive element</th></tr>" + one.outline.map((s) => "<tr><td>" + esc(s.time) + "</td><td>" + (s.mins || "") + "</td><td>" + esc(s.segment) + "</td><td>" + esc(s.covers) + "</td><td>" + esc(s.interactive) + "</td></tr>").join("") + "</table>" : "")
      + (one.notes ? "<h2>Notes</h2><p>" + esc(one.notes) + "</p>" : "") + "</div>";
  } else {
    const sp = splitItems(rec.items);
    const block = (i) => '<div class=it><b>' + esc(i.title) + '</b><br>' + esc(whenLabel(i)) + '<br>' + esc([i.organiser, i.venue, i.city].filter(Boolean).join(" | ")) + '<br>' + esc(i.type + " | " + i.status) + '</div>';
    body = '<div class=top><small>' + MIC + 'SPEAKING ENGAGEMENTS</small><h1>Talks, masterclasses and keynotes</h1><p>' + rec.items.length + ' engagements' + (rec.updatedAt ? ' | updated ' + esc(rec.updatedAt.slice(0, 10)) : '') + '</p></div><div class=bd>'
      + '<h2>Upcoming</h2>' + (sp.up.map(block).join("") || "<p>Nothing coming up.</p>") + '<h2>Past</h2>' + (sp.past.map(block).join("") || "<p>Nothing yet.</p>") + '</div>';
  }
  if (id && !one) body = '<div class=bd><p>Not found.</p></div>';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>' + esc(one ? one.title : "Speaking engagements") + '</title><style>' + R_CSS + '</style></head><body>'
    + '<div class=np><button type=button onclick="window.print()">Save as PDF</button></div>' + body + '<p class="ft bd">DigitAlchemy&reg; Tech Limited | prepared from the Momo speaking register</p>'
    + '<script>if(new URLSearchParams(location.search).get("print")==="1")setTimeout(function(){window.print()},400)</script></body></html>';
}

export async function speakingRoute(request, env, url, deps) {
  const p = url.pathname, key = url.searchParams.get("key") || "", rk = url.searchParams.get("rk") || "";
  const J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  const person = typeof deps.person === "function" ? deps.person(env, url) : "";
  if (person !== "kendall") return new Response("not found", { status: 404 });   // Kendall's key only
  const H = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };
  if (p === "/momo/work/speaking" && request.method === "GET") return new Response(deps.page(key, rk, SPK_BODY + "<script>" + SPK_JS + "</script>"), { headers: H });
  if (p === "/momo/work/speaking/rec" && request.method === "GET") return J({ rec: (await readSpk(env, person)) || emptySpk() });
  if (p === "/momo/work/speaking/report" && request.method === "GET") return new Response(spkReport((await readSpk(env, person)) || emptySpk(), url.searchParams.get("id") || ""), { headers: H });
  if (p === "/momo/work/speaking/api" && request.method === "POST") {
    let b = {}; try { b = await request.json(); } catch (e) { return J({ error: "Send JSON." }, 400); }
    const r = await spkApi(env, person, b || {}); return r.error ? J({ error: r.error }, r.status || 400) : J(r);
  }
  return new Response("not found", { status: 404 });
}
