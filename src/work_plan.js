// v590 - MOMO WORK · CONTENT PLAN (Kendall 14 Oct 2026: "you also folding this into Momo Work"; the FN content strategy: three pillars + Assign).
// Najjuko's private planning space for the content the FN team makes: the KNOWN calendar (dates that exist anyway), the MARKET calendar (launches, events, area
// stories from Najma research) and the TREND inbox (what the platforms reward now, expiring in 72 hours), each item with a format, an owner on the team and the
// day the artwork has to START (the lead time of its format). The team receives the plan as a one-page PDF (/momo/work/plan/week) - never a link into Momo Work.
// This is the Momo Work side of the plan; the development team's Content Planner service will later supply the same items through a feed (see
// Client_Engagements/FN_Realty/Strategy/FN_Content_Engine_Developer_Spec_14OCT2026.md section 8). Until then the items live in her own KV, so it works today.
import { FN_LOGO_B64 as FN_LOGO, FN_LATTICE_B64 as FN_LATTICE, FN_NAVY, FN_PEACH, FN_GOLD } from "./fn_logo.js";

const PLP = "work_naj_plan_", TRP = "work_naj_trend_", SEED_KEY = "work_naj_planseed";
export const LEAD = { story: 3, post: 7, carousel: 14, reel: 21 };            // days before publication that the artwork must start (team guide, section 3)
export const FORMATS = [["story", "Story"], ["post", "Post"], ["carousel", "Carousel"], ["reel", "Reel"]];
export const OWNERS = ["Graphic designer", "Videographer", "Social media manager", "Agent"];
export const STATES = ["Planned", "In design", "In review", "Approved", "Scheduled", "Posted"];
export const PILLARS = [["known", "Known calendar"], ["market", "Market calendar"], ["trend", "Trend"]];
export const CERT = ["Fixed", "Announced", "Expected", "Researched"];
export const PLATFORMS = ["Instagram", "TikTok", "YouTube", "LinkedIn", "X"];
const TREND_HOURS = 72;
const today = () => new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10);
const okD = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || "")) ? String(d) : "";
const addDays = (d, n) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const mondayOf = (d) => { const t = new Date(d + "T00:00:00Z"), g = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - g); return t.toISOString().slice(0, 10); };
export const artworkStart = (it) => addDays(it.start, -(LEAD[it.format] || 7));

// The Known calendar for the quarter, from the verified master list (every date marked fixed / announced / expected; moon-sighting dates are 'Expected').
// [id, start, end, title, pillar, certainty, format, owner, note]
export const SEED = [
  ["k_bcam_2026", "2026-10-01", "2026-10-31", "Breast Cancer Awareness Month", "known", "Fixed", "carousel", "Graphic designer", "Already running: one story a week, one carousel, one real act (decide which)"],
  ["k_dfc_2026", "2026-10-31", "2026-11-29", "Dubai Fitness Challenge (10th edition)", "known", "Announced", "carousel", "Graphic designer", "Active-lifestyle content: gyms, parks, cycling near our communities (Najma lifestyle sentences)"],
  ["k_flag_2026", "2026-11-03", "2026-11-03", "Flag Day", "known", "Fixed", "story", "Graphic designer", "Artwork should already be underway: use the fast lane"],
  ["k_movember_2026", "2026-11-01", "2026-11-30", "Movember (men's health)", "known", "Fixed", "carousel", "Graphic designer", "Decide: acknowledge or act"],
  ["k_diwali_2026", "2026-11-08", "2026-11-08", "Diwali", "known", "Fixed", "post", "Graphic designer", "Greeting for our Indian-community clients"],
  ["m_big5_2026", "2026-11-23", "2026-11-26", "Big 5 Global exhibition (Dubai World Trade Centre)", "market", "Announced", "reel", "Videographer", "Teaser, daily stories from the floor, wrap-up carousel. Organiser page still to be checked"],
  ["k_whitefri_2026", "2026-11-27", "2026-11-27", "White Friday (approximate)", "known", "Expected", "post", "Social media manager", "Only if FN has a real offer"],
  ["k_commem_2026", "2026-11-30", "2026-11-30", "Commemoration Day", "known", "Announced", "post", "Graphic designer", "Respectful single post; Managing Director approves; no sales content"],
  ["k_national_2026", "2026-12-02", "2026-12-03", "UAE National Day / Eid Al Etihad", "known", "Announced", "reel", "Videographer", "Biggest day of the quarter: film or carousel plus stories; Managing Director approves"],
  ["m_gitex_2026", "2026-12-07", "2026-12-11", "GITEX Global (Expo City Dubai)", "market", "Announced", "post", "Social media manager", "Technology and proptech angle"],
  ["k_winter_2026", "2026-12-14", "2027-01-03", "School winter break", "known", "Announced", "post", "Social media manager", "Families in Dubai; year-end market review carousel"],
  ["k_newyear_2027", "2027-01-01", "2027-01-01", "New Year's Day (three-day weekend)", "known", "Announced", "reel", "Videographer", "Year-in-review film and 2027 outlook, prepared in December"],
  ["k_marathon_2027", "2027-01-17", "2027-01-17", "Dubai Marathon", "known", "Announced", "story", "Graphic designer", "Active-lifestyle story"],
  ["k_ramadan_2027", "2027-02-08", "2027-03-09", "Ramadan begins (moon sighting, window 7-9 Feb)", "known", "Expected", "carousel", "Graphic designer", "Prepare two versions of every post until the announcement; tone and posting hours change"],
  ["k_eidfitr_2027", "2027-03-09", "2027-03-11", "Eid Al Fitr (moon sighting)", "known", "Expected", "reel", "Videographer", "Two versions ready; greeting film"],
  ["m_mipim_2027", "2027-03-15", "2027-03-19", "MIPIM property conference, Cannes", "market", "Announced", "post", "Social media manager", "International-investor content if FN attends"],
  ["k_mothers_2027", "2027-03-21", "2027-03-21", "Mother's Day in the UAE", "known", "Fixed", "story", "Graphic designer", "Homes-for-families story"],
  ["k_worldcup_2027", "2027-03-27", "2027-03-27", "Dubai World Cup", "known", "Announced", "story", "Graphic designer", "Luxury lifestyle story"],
];

function cleanItem(x, id) {
  const pick = (v, list, d) => (list.includes(v) ? v : d);
  const start = okD(x.start) || today(), end = okD(x.end) || start;
  return {
    id, title: String(x.title || "").slice(0, 120).trim(), start, end: end < start ? start : end,
    pillar: pick(x.pillar, PILLARS.map((p) => p[0]), "market"), certainty: pick(x.certainty, CERT, "Researched"),
    format: pick(x.format, FORMATS.map((f) => f[0]), "post"), owner: pick(x.owner, OWNERS, "Graphic designer"), agent: String(x.agent || "").slice(0, 80),
    state: pick(x.state, STATES, "Planned"), note: String(x.note || "").slice(0, 300), source: /^https?:\/\//.test(String(x.source || "")) ? String(x.source).slice(0, 300) : "",
  };
}
function cleanTrend(x, id, prev) {
  const now = Date.now();
  return {
    id, platform: PLATFORMS.includes(x.platform) ? x.platform : "Instagram", url: /^https?:\/\//.test(String(x.url || "")) ? String(x.url).slice(0, 300) : "",
    hook: String(x.hook || "").slice(0, 160).trim(), why: String(x.why || "").slice(0, 300).trim(), angle: String(x.angle || "").slice(0, 300).trim(),
    agent: String(x.agent || "").slice(0, 80), status: ["new", "assigned", "made", "dropped"].includes(x.status) ? x.status : "new",
    seen_at: (prev && prev.seen_at) || new Date(now).toISOString(), expires_at: (prev && prev.expires_at) || new Date(now + TREND_HOURS * 3600e3).toISOString(),
  };
}
async function listPrefix(env, prefix) {
  const out = []; let cursor;
  do { const r = await env.MEETINGS.list({ prefix, cursor }); cursor = r.list_complete ? null : r.cursor; for (const k of r.keys) out.push(k.name); } while (cursor);
  const recs = await Promise.all(out.map(async (k) => { try { return JSON.parse(await env.MEETINGS.get(k)); } catch (e) { return null; } }));
  return recs.filter((x) => x && typeof x === "object");
}
async function ensureSeed(env) {
  if (await env.MEETINGS.get(SEED_KEY)) return;
  for (const s of SEED) {
    const it = cleanItem({ title: s[3], start: s[1], end: s[2], pillar: s[4], certainty: s[5], format: s[6], owner: s[7], note: s[8], state: s[1] <= "2026-10-14" && s[2] >= "2026-10-14" ? "In design" : "Planned" }, s[0]);
    await env.MEETINGS.put(PLP + it.id, JSON.stringify(it));
  }
  await env.MEETINGS.put(SEED_KEY, "1");
}
export async function planItems(env) { return (await listPrefix(env, PLP)).sort((a, b) => (a.start + a.title).localeCompare(b.start + b.title)); }
const trendLeft = (t) => Math.round((Date.parse(t.expires_at) - Date.now()) / 3600e3);

function weekHtml(items, trends, mon) {
  const sun = addDays(mon, 6), fmt = (d) => { const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], p = d.split("-"); return (+p[2]) + " " + M[+p[1] - 1]; };
  const going = items.filter((i) => i.start <= sun && i.end >= mon && i.state !== "Posted").sort((a, b) => a.start.localeCompare(b.start));
  const startNow = items.filter((i) => { const a = artworkStart(i); return a >= mon && a <= sun && i.state === "Planned"; });
  const late = items.filter((i) => artworkStart(i) < mon && i.start > sun && i.state === "Planned");
  const row = (i) => '<tr><td><b>' + esc(i.title) + '</b>' + (i.note ? '<small>' + esc(i.note) + '</small>' : '') + '</td><td>' + esc(fmt(i.start) + (i.end !== i.start ? ' – ' + fmt(i.end) : '')) + '</td><td>' + esc((FORMATS.find((f) => f[0] === i.format) || [0, i.format])[1]) + '</td><td>' + esc(i.owner) + (i.agent ? '<small>for ' + esc(i.agent) + '</small>' : '') + '</td><td>' + esc(i.state) + '</td></tr>';
  const tbl = (rows) => '<table><tr><th>What</th><th>Date</th><th>Format</th><th>Who makes it</th><th>Status</th></tr>' + rows.map(row).join("") + '</table>';
  const live = trends.filter((t) => t.status === "assigned" && trendLeft(t) > 0);
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FN Weekly content plan ' + esc(fmt(mon)) + ' ' + mon.slice(0, 4) + '</title>'
    + '<link rel=stylesheet href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600&display=swap"><style>@page{size:A4;margin:12mm}@page{@top-left{content:none}@top-center{content:none}@top-right{content:none}@bottom-left{content:none}@bottom-center{content:none}@bottom-right{content:none}}'
    + 'body{margin:0;background:#F4F2EE;color:#1C2321;font-family:Inter,sans-serif;font-size:10pt;line-height:1.45}.pg{max-width:780px;margin:0 auto;background:#fff;padding:26px 30px 30px;border:1px solid ' + FN_GOLD + ';position:relative}'
    + '.latt{height:44px;margin:-26px -30px 16px;background:url("' + FN_LATTICE + '") center/auto 100% repeat-x;opacity:.85;border-bottom:1px solid ' + FN_GOLD + '}header{display:flex;justify-content:space-between;align-items:flex-start}'
    + 'h1{font-family:Anton,sans-serif;font-weight:400;font-size:24pt;color:' + FN_NAVY + ';margin:0;letter-spacing:.02em}h1 em{font-style:normal;color:' + FN_PEACH + '}header p{margin:4px 0 0;color:' + FN_NAVY + ';font-weight:500}header img{height:44px}'
    + 'h2{font-family:Anton,sans-serif;font-weight:400;color:' + FN_NAVY + ';font-size:12pt;letter-spacing:.04em;margin:16px 0 6px}table{width:100%;border-collapse:collapse;font-size:9pt}th{text-align:left;font-size:7.8pt;letter-spacing:.06em;text-transform:uppercase;color:#626B7C;padding:4px 6px;border-bottom:1px solid #E9EAEC}td{padding:6px;border-bottom:1px solid #EFE9DE;vertical-align:top}td small{display:block;color:#626B7C;font-size:8pt}'
    + '.note{margin-top:18px;padding-top:8px;border-top:1px solid #E9EAEC;font-size:7.8pt;color:#626B7C}.btns{position:fixed;right:14px;bottom:14px}.btn{background:' + FN_NAVY + ';color:' + FN_PEACH + ';border:0;border-radius:99px;padding:10px 16px;font:600 10pt Inter,sans-serif;cursor:pointer}@media print{body{background:#fff}.pg{border:0;padding:0}.btns{display:none}}</style></head><body><div class=pg><div class=latt></div>'
    + '<header><div><h1><em>Weekly</em> content plan</h1><p>' + esc(fmt(mon)) + ' – ' + esc(fmt(sun)) + ' ' + sun.slice(0, 4) + '</p></div><img src="' + FN_LOGO + '" alt="FN Realty"></header>'
    + '<h2>GOING OUT THIS WEEK</h2>' + (going.length ? tbl(going) : '<p>Nothing scheduled this week.</p>')
    + (startNow.length ? '<h2>ARTWORK STARTS THIS WEEK</h2>' + tbl(startNow) : '') + (late.length ? '<h2>ALREADY LATE TO START: USE THE FAST LANE</h2>' + tbl(late) : '')
    + (live.length ? '<h2>TRENDS TO MAKE (EACH EXPIRES 72 HOURS AFTER IT WAS SEEN)</h2><table><tr><th>Trend</th><th>Platform</th><th>For</th><th>Our angle</th></tr>' + live.map((t) => '<tr><td><b>' + esc(t.hook) + '</b><small>' + esc(t.why) + '</small></td><td>' + esc(t.platform) + '</td><td>' + esc(t.agent) + '</td><td>' + esc(t.angle) + '</td></tr>').join("") + '</table>' : '')
    + '<div class=note>Every number in a post comes from Najma with its date; reviews are summarised, never quoted; property advertisements carry the advertising permit number; the Managing Director approves sensitive items. Prepared by Serah Najjuko Ganyana for FN Realty. The method, templates and tools that produced this plan are her own (employment contract, clause 12.2) and are not part of what is provided.</div></div>'
    + '<div class=btns><button class=btn onclick="print()">Share / Save as PDF</button></div></body></html>';
}

const PLAN_JS = String.raw`
var KEY=new URLSearchParams(location.search).get("key")||"",D=null,VIEW="cal",SHEET=null;
function $(i){return document.getElementById(i)}
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]})}
function api(o){return fetch("/momo/work/plan/api?key="+encodeURIComponent(KEY),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(o)}).then(function(r){return r.json()})}
function today(){return new Date(Date.now()+4*3600e3).toISOString().slice(0,10)}
function addDays(d,n){var t=new Date(d+"T00:00:00Z");t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10)}
var MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fd(d){var p=d.split("-");return (+p[2])+" "+MON[+p[1]-1]}
function monday(d){var t=new Date(d+"T00:00:00Z"),g=(t.getUTCDay()+6)%7;t.setUTCDate(t.getUTCDate()-g);return t.toISOString().slice(0,10)}
function fmtName(f){var r=f;D.formats.forEach(function(x){if(x[0]===f)r=x[1]});return r}
function artStart(i){return addDays(i.start,-(D.lead[i.format]||7))}
function pil(p){var r="Trend";D.pillars.forEach(function(x){if(x[0]===p)r=x[1]});return r}
var STACK=[];function closeTop(){var c=STACK.pop();if(c)c();if(!STACK.length)load()}function SHEETALL(){while(STACK.length){STACK.pop()()}load()}
function sheet(title,html,onopen){var bg=document.createElement("div");bg.className="sheetbg";var s=document.createElement("div");s.className="sheet";s.innerHTML="<h4>"+title+"</h4>"+html+'<button type=button class="gold done">Done</button>';
 document.body.appendChild(bg);document.body.appendChild(s);STACK.push(function(){bg.remove();s.remove()});bg.onclick=closeTop;s.querySelector(".done").onclick=closeTop;if(onopen)onopen(s)}
function opts(list,cur,att){return list.map(function(v){var val=Array.isArray(v)?v[0]:v,nm=Array.isArray(v)?v[1]:v;return '<div class="opt'+(val===cur?' on':'')+'" data-v="'+esc(val)+'">'+esc(nm)+(val===cur?'<span style="margin-left:auto;color:#0A4F4A">&#10003;</span>':'')+'</div>'}).join("")}
function chip(t,c){return '<span class=chp style="border-color:'+c+';color:'+c+'">'+esc(t)+'</span>'}
var PC={known:"#15665C",market:"#D9782E",trend:"#6A4C93"};
function card(i){var as=artStart(i),t=today(),late=i.state==="Planned"&&as<t&&i.start>=t,span=fd(i.start)+(i.end!==i.start?" – "+fd(i.end):"");
 return '<div class=ent data-id="'+esc(i.id)+'" style="cursor:pointer"><h3>'+esc(i.title)+'</h3><div class=m>'+esc(span)+'</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0">'+chip(pil(i.pillar),PC[i.pillar]||"#15665C")+chip(i.certainty,i.certainty==="Expected"?"#B04A3A":"#626B78")+chip(fmtName(i.format),"#8A6F3E")+chip(i.state,i.state==="Posted"?"#15948A":"#626B78")+'</div>'
  +'<div class=line style="margin:2px 0">'+esc(i.owner)+(i.agent?' · for '+esc(i.agent):'')+'</div>'
  +(i.state==="Posted"?'':late?'<div class=line style="color:#B04A3A;margin:2px 0"><b>Artwork should have started '+esc(fd(as))+': use the fast lane.</b></div>':'<div class=line style="margin:2px 0">Artwork starts <b>'+esc(fd(as))+'</b></div>')
  +(i.note?'<div class=line style="margin:2px 0;color:#626B78">'+esc(i.note)+'</div>':'')+'</div>'}
function drawCal(){var t=today(),from=addDays(t,-3),to=addDays(t,60),L=D.items.filter(function(i){return i.end>=from&&i.start<=to&&i.state!=="Posted"||i.start>=from&&i.start<=to}),by={};
 L.sort(function(a,b){return a.start<b.start?-1:1}).forEach(function(i){var w=monday(i.start<from?from:i.start);(by[w]=by[w]||[]).push(i)});
 var ks=Object.keys(by).sort(),h=ks.map(function(w){return '<h2 style="font-size:.95rem;margin:16px 0 6px;color:#8A6F3E">Week of '+esc(fd(w))+(w===monday(t)?' · this week':'')+'</h2>'+by[w].map(card).join("")}).join("");
 $("pbody").innerHTML=(h||'<div class=empty><p>Nothing in the next eight weeks.</p></div>')
 +'<a class=ghost style="display:block;text-align:center;text-decoration:none;margin-top:14px" target=_blank href="/momo/work/plan/week?key='+encodeURIComponent(KEY)+'&from='+monday(t)+'">This week\'s plan for the team (PDF)</a>';
 document.querySelectorAll("[data-id]").forEach(function(e){e.onclick=function(){editItem(e.getAttribute("data-id"))}})}
function editItem(id){var i=D.items.filter(function(x){return x.id===id})[0];if(!i)return;
 var row=function(k,lab,val){return '<div class=fr id="e_'+k+'"><b>'+esc(lab)+'</b><span>'+esc(val||"tap to set")+'</span><i>&#8250;</i></div>'};
 sheet(esc(i.title),row("format","Format",fmtName(i.format))+row("owner","Who makes it",i.owner)+row("agent","For which agent",i.agent)+row("state","Status",i.state)+'<textarea id=e_note rows=2 style="width:100%;margin:8px 0" placeholder="Note">'+esc(i.note)+'</textarea><button type=button class=ghost id=e_del style="width:100%;margin-bottom:8px">Remove from the plan</button>',function(s){
  var pickOne=function(k,lab,list){s.querySelector("#e_"+k).onclick=function(){sheet(lab,opts(list,i[k]),function(s2){s2.querySelectorAll(".opt").forEach(function(o){o.onclick=function(){i[k]=o.getAttribute("data-v");api({action:"item_save",item:i}).then(SHEETALL)}})})}};
  s.querySelector("#e_format").onclick=function(){sheet("Format",opts(D.formats,i.format),function(s2){s2.querySelectorAll(".opt").forEach(function(o){o.onclick=function(){i.format=o.getAttribute("data-v");api({action:"item_save",item:i}).then(SHEETALL)}})})};
  pickOne("owner","Who makes it",D.owners);pickOne("state","Status",D.states);
  s.querySelector("#e_agent").onclick=function(){sheet("For which agent",opts([""].concat(D.agents),i.agent),function(s2){s2.querySelectorAll(".opt").forEach(function(o){o.onclick=function(){i.agent=o.getAttribute("data-v");api({action:"item_save",item:i}).then(SHEETALL)}})})};
  s.querySelector("#e_note").onchange=function(){i.note=this.value;api({action:"item_save",item:i})};
  s.querySelector("#e_del").onclick=function(){if(confirm("Remove this from the plan?"))api({action:"item_delete",id:i.id}).then(SHEETALL)}})}
function addItem(){var n={title:"",start:today(),pillar:"market",certainty:"Researched",format:"post",owner:"Graphic designer",agent:"",source:"",note:""};
 var draw=function(s){s.querySelector("#a_pil").innerHTML=D.pillars.map(function(p){return '<button type=button data-v="'+p[0]+'"'+(n.pillar===p[0]?' class=on':'')+'>'+esc(p[1])+'</button>'}).join("");
  s.querySelectorAll("#a_pil button").forEach(function(b){b.onclick=function(){n.pillar=b.getAttribute("data-v");draw(s)}});
  s.querySelector("#a_fmt").innerHTML=D.formats.map(function(f){return '<button type=button data-v="'+f[0]+'"'+(n.format===f[0]?' class=on':'')+'>'+esc(f[1])+'</button>'}).join("");
  s.querySelectorAll("#a_fmt button").forEach(function(b){b.onclick=function(){n.format=b.getAttribute("data-v");draw(s)}});
  s.querySelector("#a_art").textContent="Artwork starts "+fd(addDays(n.start,-(D.lead[n.format]||7)))};
 sheet("Add to the plan",'<input id=a_t class=sin placeholder="What is it? (a launch, an event, a cause)" style="width:100%;margin-bottom:8px"><div class=line>Date it goes out</div><input id=a_d type=date value="'+n.start+'" style="width:100%;margin-bottom:8px"><div class=line>Where it came from</div><div class=seg id=a_pil style="grid-template-columns:1fr 1fr 1fr"></div><div class=line>Format</div><div class=seg id=a_fmt style="grid-template-columns:repeat(4,1fr);gap:6px"></div><div class=line id=a_art style="margin:8px 0;font-weight:600"></div><input id=a_s class=sin placeholder="Source link (a launch needs one)" style="width:100%;margin-bottom:8px"><div class=line>You choose who makes it and which agent after saving.</div>',function(s){
  draw(s);s.querySelector("#a_d").onchange=function(){n.start=this.value||today();draw(s)};
  s.querySelector(".done").onclick=function(){n.title=s.querySelector("#a_t").value.trim();n.source=s.querySelector("#a_s").value.trim();if(!n.title){alert("Say what it is first.");return}
   if(n.pillar!=="known"&&!n.source&&!confirm("A market item should carry a source link. Save without one?"))return;api({action:"item_save",item:n}).then(SHEETALL)}})}
function trendCard(t){var left=Math.round((Date.parse(t.expires_at)-Date.now())/3600e3),dead=t.status==="dropped"||t.status==="made"||left<=0;
 return '<div class=ent data-tid="'+esc(t.id)+'" style="cursor:pointer;'+(dead?'opacity:.55':'')+'"><h3>'+esc(t.hook||"(no hook yet)")+'</h3><div class=m>'+esc(t.platform)+' · '+(t.status==="made"?'made':t.status==="dropped"?'dropped':left<=0?'expired':left+' h left')+'</div>'
  +(t.why?'<div class=line style="margin:2px 0">Why it works: '+esc(t.why)+'</div>':'')+(t.angle?'<div class=line style="margin:2px 0">Our angle: '+esc(t.angle)+'</div>':'')+(t.agent?'<div class=line style="margin:2px 0"><b>For '+esc(t.agent)+'</b></div>':'')+'</div>'}
function drawTrends(){var L=D.trends.slice().sort(function(a,b){return a.expires_at<b.expires_at?1:-1}),live=L.filter(function(t){return t.status!=="dropped"&&t.status!=="made"&&Date.parse(t.expires_at)>Date.now()}),dead=L.filter(function(t){return live.indexOf(t)<0}).slice(0,8);
 $("pbody").innerHTML='<div class=line>Each trend lives 72 hours. One not made in time is dropped, not carried forward.</div>'+(live.length?live.map(trendCard).join(""):'<div class=empty><p>No live trends. Add what you saw today.</p></div>')+(dead.length?'<h2 style="font-size:.9rem;margin:16px 0 6px;color:#8A6F3E">Done or expired</h2>'+dead.map(trendCard).join(""):'');
 document.querySelectorAll("[data-tid]").forEach(function(e){e.onclick=function(){editTrend(e.getAttribute("data-tid"))}})}
function editTrend(id){var t=D.trends.filter(function(x){return x.id===id})[0];if(!t)return;
 sheet(esc(t.hook||"Trend"),'<div class=fr id=t_agent><b>Give it to</b><span>'+esc(t.agent||"tap to choose")+'</span><i>&#8250;</i></div><div class=fr id=t_made><b>Mark as made</b><span></span><i>&#8250;</i></div><div class=fr id=t_drop><b>Drop it</b><span></span><i>&#8250;</i></div>'+(t.url?'<a class=ghost style="display:block;text-align:center;text-decoration:none;margin:8px 0" target=_blank rel=noopener href="'+esc(t.url)+'">Open the original</a>':''),function(s){
  s.querySelector("#t_agent").onclick=function(){sheet("Give it to",opts(D.agents,t.agent),function(s2){s2.querySelectorAll(".opt").forEach(function(o){o.onclick=function(){t.agent=o.getAttribute("data-v");t.status="assigned";api({action:"trend_save",trend:t}).then(SHEETALL)}})})};
  s.querySelector("#t_made").onclick=function(){t.status="made";api({action:"trend_save",trend:t}).then(SHEETALL)};
  s.querySelector("#t_drop").onclick=function(){t.status="dropped";api({action:"trend_save",trend:t}).then(SHEETALL)}})}
function addTrend(){var n={platform:"Instagram",url:"",hook:"",why:"",angle:""};
 sheet("A trend you saw",'<div class=seg id=n_pl style="grid-template-columns:repeat(5,1fr);gap:4px">'+D.platforms.map(function(p){return '<button type=button data-v="'+p+'"'+(p===n.platform?' class=on':'')+' style="padding:10px 2px;font-size:.72rem">'+p+'</button>'}).join("")+'</div><input id=n_u class=sin placeholder="Link to the post" style="width:100%;margin:8px 0"><input id=n_h class=sin placeholder="The hook: what it says or shows first" style="width:100%;margin-bottom:8px"><textarea id=n_w rows=2 style="width:100%;margin-bottom:8px" placeholder="Why is it working? (required)"></textarea><textarea id=n_a rows=2 style="width:100%" placeholder="Our angle: which true FN or Najma fact fits? (required)"></textarea>',function(s){
  s.querySelectorAll("#n_pl button").forEach(function(b){b.onclick=function(){n.platform=b.getAttribute("data-v");s.querySelectorAll("#n_pl button").forEach(function(x){x.classList.toggle("on",x===b)})}});
  s.querySelector(".done").onclick=function(){n.url=s.querySelector("#n_u").value.trim();n.hook=s.querySelector("#n_h").value.trim();n.why=s.querySelector("#n_w").value.trim();n.angle=s.querySelector("#n_a").value.trim();if(!n.hook||!n.why||!n.angle){alert("A trend needs its hook, why it works and our angle.");return}api({action:"trend_save",trend:n}).then(SHEETALL)}})}
function draw(){$("tcal").classList.toggle("on",VIEW==="cal");$("ttr").classList.toggle("on",VIEW==="tr");$("padd").textContent=VIEW==="cal"?"Add to the plan":"Add a trend";if(VIEW==="cal")drawCal();else drawTrends()}
function load(){fetch("/momo/work/plan/api?key="+encodeURIComponent(KEY)).then(function(r){return r.json()}).then(function(j){D=j;draw()})}
$("tcal").onclick=function(){VIEW="cal";draw()};$("ttr").onclick=function(){VIEW="tr";draw()};$("padd").onclick=function(){if(VIEW==="cal")addItem();else addTrend()};
$("pback").href="/momo/work?key="+encodeURIComponent(KEY);load();
`;

const PLAN_BODY = '<a class=back id=pback href="#">&#8592; Work log</a><div class=tag>MOMO · WORK</div><h1>Content plan</h1>'
  + '<div class=seg style="margin:8px 0 12px"><button type=button id=tcal class=on>Calendar</button><button type=button id=ttr>Trend inbox</button></div>'
  + '<button type=button id=padd class=gold style="width:100%;margin-bottom:10px">Add to the plan</button><div id=pbody></div>';

export async function planRoute(request, env, url, deps, ctx) {
  const p = url.pathname, key = url.searchParams.get("key") || "", rk = url.searchParams.get("rk") || "";
  const J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (p === "/momo/work/plan") return new Response(deps.page(key, rk, PLAN_BODY + "<script>" + PLAN_JS + "</script>"), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  if (p === "/momo/work/plan/week") {
    await ensureSeed(env);
    const mon = mondayOf(okD(url.searchParams.get("from")) || today());
    return new Response(weekHtml(await planItems(env), await listPrefix(env, TRP), mon), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }
  if (p === "/momo/work/plan/api") {
    await ensureSeed(env);
    if (request.method === "GET") return J({ today: today(), items: await planItems(env), trends: await listPrefix(env, TRP), agents: ctx.agents, formats: FORMATS, owners: OWNERS, states: STATES, pillars: PILLARS, certainty: CERT, platforms: PLATFORMS, lead: LEAD, trend_hours: TREND_HOURS });
    let b = {}; try { b = await request.json(); } catch (e) { return J({ error: "Send JSON." }, 400); }
    const rid = (v) => String(v || "").replace(/[^a-z0-9_]/gi, "").slice(0, 40) || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    if (b.action === "item_save") { const it = cleanItem(b.item || {}, rid((b.item || {}).id)); if (!it.title) return J({ error: "A title is needed." }, 400); await env.MEETINGS.put(PLP + it.id, JSON.stringify(it)); return J({ ok: true, item: it }); }
    if (b.action === "item_delete") { await env.MEETINGS.delete(PLP + rid(b.id)); return J({ ok: true }); }
    if (b.action === "trend_save") {
      const id = rid((b.trend || {}).id); let prev = null; try { prev = JSON.parse(await env.MEETINGS.get(TRP + id)); } catch (e) {}
      const t = cleanTrend(b.trend || {}, id, prev);
      if (!t.hook || !t.why || !t.angle) return J({ error: "A trend needs its hook, why it works and our angle." }, 400);
      await env.MEETINGS.put(TRP + id, JSON.stringify(t)); return J({ ok: true, trend: t });
    }
    return J({ error: "Unknown action." }, 400);
  }
  return null;
}
