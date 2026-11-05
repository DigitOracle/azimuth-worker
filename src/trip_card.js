// v785 (Kendall, 5 Nov 2026: "For Doli and Najjuko, we need to share the card for Thailand") - ONE shared trip card, the same record for
// Kendall's key and Najjuko's key (nobody else), for a conference trip to Thailand: dates and venue, flights per traveller, hotel,
// presentations, people and meetings, documents, a checklist and a budget. Both can view, edit and add; every change is logged with who.
// KV (MEETINGS): trip_thailand (the record), trip_thailand_file_<id> (an uploaded file: e-ticket, confirmation, slides), trip_thailand_fmeta_<id>.
// Passports: ONLY "valid until" and a note are stored. There is no field for a passport number, and a number-like value is refused.
// Rules for the client string: ES5, no backticks inside it, no template placeholders; __name shim first (served via toString-free strings).
export const TRIP_KEY = "trip_thailand", TRIP_PEOPLE = ["kendall", "najjuko"], TRIP_NAMES = { kendall: "Kendall", najjuko: "Najjuko" };
const MAX_FILE = 20 * 1024 * 1024;
const str = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n || 300);
const okDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) ? String(s) : "";
const okTime = (s) => /^\d{2}:\d{2}$/.test(String(s || "")) ? String(s) : "";
const okUrl = (s) => { const v = str(s, 600); return /^https?:\/\/\S+$/i.test(v) ? v : ""; };
const num = (s) => { const v = parseFloat(String(s == null ? "" : s).replace(/,/g, "")); return isFinite(v) ? Math.round(v * 100) / 100 : null; };
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// The sections and their fields (the client builds its forms from this; the server cleans with it)
export const TRIP_SECTIONS = [
  { id: "flights", title: "Flights", add: "Add a flight", fields: [["traveller", "Traveller", "pick", ["Kendall", "Najjuko"]], ["airline", "Airline"], ["flight_no", "Flight no."], ["from", "From (airport)"], ["to", "To (airport)"], ["dep_date", "Departure date", "date"], ["dep_time", "Departure time (local)", "time"], ["dep_tz", "Departure time zone", "pick", ["Dubai (GST)", "Thailand (ICT, +3 h)", "Other"]], ["arr_date", "Arrival date", "date"], ["arr_time", "Arrival time (local)", "time"], ["arr_tz", "Arrival time zone", "pick", ["Thailand (ICT, +3 h)", "Dubai (GST)", "Other"]], ["booking_ref", "Booking reference"], ["seat", "Seat"], ["baggage", "Baggage"], ["notes", "Notes", "long"]], file: "E-ticket (PDF)" },
  { id: "hotel", title: "Hotel", add: "Add a hotel", fields: [["name", "Hotel name"], ["address", "Address", "long"], ["check_in", "Check-in", "date"], ["check_out", "Check-out", "date"], ["booking_ref", "Booking reference"], ["room", "Room"], ["cost", "Cost"], ["link", "Link", "url"], ["notes", "Notes", "long"]], file: "Booking confirmation" },
  { id: "presentations", title: "Presentations", add: "Add a presentation", fields: [["title", "Title"], ["slot_date", "Date", "date"], ["slot_time", "Time (local)", "time"], ["room", "Room / stage"], ["presenter", "Who presents", "pick", ["Kendall", "Najjuko", "Both", "Other"]], ["status", "Status", "pick", ["Drafting", "Final"]], ["link", "Link to the slides", "url"], ["notes", "Notes", "long"]], file: "Slides (PDF or PowerPoint)" },
  { id: "people", title: "People & meetings", add: "Add a person or meeting", fields: [["name", "Name"], ["company", "Company"], ["role", "Role"], ["contact", "Email or phone"], ["meet_date", "Meeting date", "date"], ["meet_time", "Meeting time (local)", "time"], ["where", "Where"], ["notes", "Notes", "long"]] },
  { id: "documents", title: "Documents", add: "Add a document", fields: [["kind", "Kind", "pick", ["Visa", "Passport (valid until only)", "Insurance", "Receipt", "Other"]], ["who", "For", "pick", ["Kendall", "Najjuko", "Both"]], ["valid_until", "Valid until", "date"], ["notes", "Note (never a passport number)", "long"]], file: "File (not a passport scan)" },
  { id: "checklist", title: "Checklist", add: "Add to the checklist", fields: [["what", "What"], ["who", "Who", "pick", ["Kendall", "Najjuko", "Both"]], ["by", "By", "date"]], tick: true },
  { id: "budget", title: "Budget", add: "Add a cost", fields: [["item", "Item"], ["amount", "Amount", "money"], ["currency", "Currency", "pick", ["AED", "THB", "USD", "EUR"]], ["paid_by", "Paid by", "pick", ["Kendall", "Najjuko", "Company", "Organiser"]], ["notes", "Notes"]] },
];
const SEC = Object.fromEntries(TRIP_SECTIONS.map((s) => [s.id, s]));

// v785 (Kendall 5 Nov): the conference is known - Tech Horizons 2030 (Koncept Conference), 3-4 Dec 2026, DoubleTree by Hilton Phuket Banthai, Patong.
// This is the SEED: used only while no record exists; after the first save the stored record is the truth.
export const TRIP_TITLE = "Thailand \u00b7 Tech Horizons 2030 \u00b7 Phuket 3\u20134 Dec";
export const emptyTrip = () => ({ v: 1, conference: "Tech Horizons 2030 (Koncept Conference)",
  event: { start: "2026-12-03", end: "2026-12-04", city: "Patong, Phuket, Thailand", venue: "DoubleTree by Hilton Phuket Banthai Resort", address: "Patong, Phuket, Thailand",
    map: "https://www.google.com/maps/search/?api=1&query=DoubleTree+by+Hilton+Phuket+Banthai+Resort+Patong" },
  items: Object.assign(Object.fromEntries(TRIP_SECTIONS.map((s) => [s.id, []])), {
    presentations: [
      { id: "seedkeynote", title: "Keynote (Day 2)", slot_date: "2026-12-04", slot_time: "", room: "", presenter: "Kendall", status: "Drafting", link: "", notes: "Morning slot on Day 2." },
      { id: "seedpanel", title: "Panel", slot_date: "", slot_time: "", room: "", presenter: "Najjuko", status: "Drafting", link: "", notes: "Panellist; slot to be confirmed by the organisers." }],
    people: [
      { id: "seedkcmkt", name: "Koncept Conference (marketing)", company: "Koncept Conference", role: "Organiser", contact: "marketing@konceptconference.com", meet_date: "", meet_time: "", where: "", notes: "Thread: \"Participation Invitation - Koncept Conference 2026\"." },
      { id: "seedkcsanam", name: "Sanam", company: "Koncept Conference", role: "Organiser", contact: "sanam@konceptconference.com", meet_date: "", meet_time: "", where: "", notes: "Thread: \"Participation Invitation - Koncept Conference 2026\"." }],
    documents: [
      { id: "seedphotos", kind: "Other", who: "Kendall", valid_until: "", notes: "Speaker photos (6, HD, 24 Sep) are in the working folder Speaking_Engagements\\Tech_Horizons_2030_Phuket_3-4DEC2026\\." }] }),
  log: [], updatedAt: "" });

// a passport number must never be stored: refuse anything that looks like one in a document row
const PASSPORT_LIKE = /\b[A-Z]{1,2}\d{6,9}\b/i;
export function cleanItem(secId, x, prev) {
  const s = SEC[secId]; if (!s) return { error: "Unknown section." };
  const o = { id: (prev && prev.id) || rid() };
  for (const [k, , type, opts] of s.fields) {
    const v = x ? x[k] : undefined;
    if (type === "date") o[k] = okDate(v);
    else if (type === "time") o[k] = okTime(v);
    else if (type === "url") o[k] = okUrl(v);
    else if (type === "money") o[k] = num(v);
    else if (type === "pick") { const t = str(v, 60); o[k] = opts.includes(t) ? t : ""; }
    else o[k] = str(v, type === "long" ? 1200 : 200);
  }
  if (s.tick) o.done = !!(x && x.done);
  if (prev && prev.file) o.file = prev.file;
  if (secId === "documents" && PASSPORT_LIKE.test(String(o.notes || ""))) return { error: "Please don't store a passport number here. Keep only the valid-until date and a note." };
  return { item: o };
}
export function cleanEvent(x, prev) {
  const p = prev || {};
  return { start: x && "start" in x ? okDate(x.start) : (p.start || ""), end: x && "end" in x ? okDate(x.end) : (p.end || ""), city: x && "city" in x ? str(x.city, 80) : (p.city || ""),
    venue: x && "venue" in x ? str(x.venue, 160) : (p.venue || ""), address: x && "address" in x ? str(x.address, 300) : (p.address || ""), map: x && "map" in x ? okUrl(x.map) : (p.map || "") };
}
export async function readTrip(env) { let r = null; try { r = JSON.parse(await env.MEETINGS.get(TRIP_KEY)); } catch (e) {} if (!r) return emptyTrip(); const e = emptyTrip(); r.items = Object.assign(e.items, r.items || {}); r.event = Object.assign(e.event, r.event || {}); r.log = Array.isArray(r.log) ? r.log : []; return r; }
const label = (secId, it) => { const s = SEC[secId]; const k = s && s.fields[0] && s.fields[0][0]; return str((it && (it[k] || it.title || it.name || it.what || it.item)) || "", 60) || "item"; };

export async function tripApi(env, person, b) {
  const who = TRIP_NAMES[person] || person, now = new Date().toISOString(), r = await readTrip(env), a = String(b.action || "");
  const log = (what) => { r.log.unshift({ at: now, who, what: str(what, 160) }); r.log = r.log.slice(0, 300); };
  if (a === "conference") { r.conference = str(b.conference, 160); log("set the conference: " + (r.conference || "cleared")); }
  else if (a === "event") { r.event = cleanEvent(b.event || {}, r.event); log("updated dates & venue"); }
  else if (a === "add" || a === "edit") {
    const list = r.items[b.section]; if (!list) return { error: "Unknown section.", status: 400 };
    const i = a === "edit" ? list.findIndex((x) => x.id === b.id) : -1; if (a === "edit" && i < 0) return { error: "That item is not there any more.", status: 404 };
    const c = cleanItem(b.section, b.item || {}, i >= 0 ? list[i] : null); if (c.error) return { error: c.error, status: 400 };
    if (i >= 0) list[i] = c.item; else list.push(c.item);
    log((a === "add" ? "added to " : "edited in ") + SEC[b.section].title + ": " + label(b.section, c.item));
  } else if (a === "delete") {
    const list = r.items[b.section]; if (!list) return { error: "Unknown section.", status: 400 };
    const i = list.findIndex((x) => x.id === b.id); if (i < 0) return { error: "That item is not there any more.", status: 404 };
    const [gone] = list.splice(i, 1); if (gone && gone.file) { try { await env.MEETINGS.delete(TRIP_KEY + "_file_" + gone.file.id); await env.MEETINGS.delete(TRIP_KEY + "_fmeta_" + gone.file.id); } catch (e) {} }
    log("removed from " + SEC[b.section].title + ": " + label(b.section, gone));
  } else if (a === "tick") {
    const it = (r.items.checklist || []).find((x) => x.id === b.id); if (!it) return { error: "That item is not there any more.", status: 404 };
    it.done = !!b.done; log((it.done ? "ticked " : "unticked ") + label("checklist", it));
  } else return { error: "Unknown action.", status: 400 };
  r.updatedAt = now; await env.MEETINGS.put(TRIP_KEY, JSON.stringify(r));
  return { ok: true, trip: r };
}

export function daysToGo(start, todayIso) { if (!okDate(start)) return null; const d = Math.round((Date.parse(start + "T00:00:00Z") - Date.parse(todayIso + "T00:00:00Z")) / 864e5); return d; }

export const TRIP_ICON = '<path d="M2 16l20-8-8 12-2-5z"/><path d="M12 15l-4 5"/>';

const CSS = '<style>.tr{overflow-wrap:anywhere;max-width:100%}.tr *{box-sizing:border-box}.tr .g2>*{min-width:0}.tr .hero b{display:block}.tr h2{font:600 1.1rem Fraunces,serif;color:#0A4F4A;margin:20px 0 8px}.tr .cd{background:#FFFDF9;border:1px solid #E5DFD3;border-radius:16px;padding:12px 14px;margin:0 0 10px}'
  + '.tr .hero{background:#0A4F4A;color:#F7F3EA;border-radius:18px;padding:16px;margin:8px 0 14px}.tr .hero b{font:600 1.25rem Fraunces,serif}.tr .hero .k{font:600 .7rem IBM Plex Mono,monospace;letter-spacing:.08em;color:#C5A56A}.tr .hero .cnt{font:600 1.8rem Fraunces,serif;color:#C5A56A}'
  + '.tr .g2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}.tr .it{background:#fff;border:1px solid #E5DFD3;border-radius:14px;padding:10px 12px;cursor:pointer;min-width:0;overflow-wrap:anywhere}.tr .it b{display:block;font:600 .92rem IBM Plex Sans,sans-serif;color:#0A4F4A}.tr .it span{display:block;font:500 .78rem IBM Plex Sans,sans-serif;color:#5F6B66;margin-top:3px}'
  + '.tr .add{display:block;width:100%;border:1px dashed #C5A56A;background:none;color:#8A6F3E;border-radius:12px;padding:10px;font:600 .88rem IBM Plex Sans,sans-serif;margin-top:6px;cursor:pointer}.tr .em{color:#8FA39B;font-size:.85rem;margin:2px 0}'
  + '.tr .ck{display:flex;gap:10px;align-items:flex-start;background:#fff;border:1px solid #E5DFD3;border-radius:12px;padding:10px 12px;margin:0 0 6px}.tr .ck input{width:22px;height:22px;flex:0 0 22px;margin:1px 0 0}.tr .ck div{flex:1;min-width:0}.tr .ck.done b{text-decoration:line-through;color:#8FA39B}'
  + '.tr .file{display:inline-block;margin-top:6px;font:600 .78rem IBM Plex Sans,sans-serif;color:#0A4F4A}.tr .lg{font:500 .78rem IBM Plex Sans,sans-serif;color:#5F6B66;border-top:1px solid #EFE9DE;padding:6px 0}'
  + '#tsh{position:fixed;left:0;right:0;bottom:0;max-height:85vh;max-height:85dvh;max-width:560px;margin:0 auto;background:#fff;border-radius:22px 22px 0 0;box-shadow:0 -10px 30px rgba(0,0,0,.2);overflow-y:auto;padding:14px 16px 24px;z-index:61;display:none}#tsh.open{display:block}'
  + '#tscr{position:fixed;inset:0;background:rgba(0,0,0,.25);z-index:60;display:none}#tscr.open{display:block}#tsh label{display:block;font:600 .7rem IBM Plex Mono,monospace;letter-spacing:.06em;color:#8A6F3E;text-transform:uppercase;margin:10px 0 3px}'
  + '#tsh input,#tsh select,#tsh textarea{box-sizing:border-box;width:100%;border:1px solid #D8D1C4;border-radius:10px;padding:10px;font:400 .92rem IBM Plex Sans,sans-serif;background:#fff}#tsh textarea{min-height:70px}'
  + '#tsh .row{position:sticky;bottom:0;background:#fff;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px 0 calc(10px + env(safe-area-inset-bottom));margin-top:10px}#tsh .row button{border-radius:999px;padding:12px;font:600 .95rem IBM Plex Sans,sans-serif;cursor:pointer}'
  + '#tsh .sv{background:#0A4F4A;color:#fff;border:0}#tsh .dl{background:#fff;color:#B4533C;border:1px solid #B4533C}#tsh .note{font:500 .78rem IBM Plex Sans,sans-serif;color:#8A3E3E;margin-top:6px}</style>';

export const TRIP_BODY = CSS + '<div class=tr><a class=back href="/momo" id=tback>&#8592; Momo</a><div class=tag>MOMO · SHARED WITH NAJJUKO AND KENDALL</div><h1>Thailand</h1><p style="margin:-14px 0 10px;color:#5F6B66;font:500 .9rem IBM Plex Sans,sans-serif">Tech Horizons 2030 \u00b7 Phuket 3\u20134 Dec</p><div id=thero></div><div id=tsecs><p class=em>Loading the trip&#8230;</p></div><h2>Changes</h2><div id=tlog></div></div><div id=tscr></div><div id=tsh></div>';

export function tripJs(sectionsJson) {
  return "var __name=function(f){return f};var SECS=" + sectionsJson + ";" + String.raw`(function(){
var Q=location.search, T=null, $=function(i){return document.getElementById(i)};
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]})}
var bk=$("tback"); if(bk) bk.href="/momo"+Q;
function today(){return new Date(Date.now()+4*3600e3).toISOString().slice(0,10)}
function fd(d){if(!d)return "";var M=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],p=d.split("-");return (+p[2])+" "+M[+p[1]-1]+" "+p[0]}
function api(b){return fetch("/momo/work/trip/api"+Q,{method:"POST",headers:{"Content-Type":"application/json","X-Momo-Confirm":"page"},body:JSON.stringify(b)}).then(function(r){return r.json().then(function(j){if(!r.ok&&!j.error)j.error="Not saved ("+r.status+")";return j})})}
function done(j,okTitle,okLine){if(window.momoConfirm){if(j&&j.ok)window.momoConfirm(true,okTitle||"Saved",okLine||"Thailand trip");else window.momoConfirm(false,"Not saved",(j&&j.error)||"Something went wrong")}if(j&&j.ok){T=j.trip;draw()}}
function load(){fetch("/momo/work/trip/data"+Q).then(function(r){return r.json()}).then(function(j){T=j.trip;draw()}).catch(function(){$("tsecs").innerHTML='<p class=em>Could not load the trip. Pull down to try again.</p>'})}
function summary(s,it){var f=s.fields,a=[],first=it[f[0][0]]||"";
  f.slice(1,6).forEach(function(x){var v=it[x[0]];if(v!=null&&v!==""){if(x[2]==="date")v=fd(v);a.push(v)}});
  return '<b>'+esc(first||"(no name yet)")+'</b><span>'+esc(a.join(" · "))+'</span>'+(it.file?'<a class=file href="/momo/work/trip/file'+Q+'&f='+encodeURIComponent(it.file.id)+'" target=_blank rel=noopener>'+esc(it.file.name||"Open file")+'</a>':'')}
function draw(){if(!T)return;var e=T.event||{},d=null;
  if(e.start){d=Math.round((Date.parse(e.start+"T00:00:00Z")-Date.parse(today()+"T00:00:00Z"))/864e5)}
  $("thero").innerHTML='<div class=hero><div class=k>CONFERENCE</div><b id=tconf>'+esc(T.conference||"Conference: to be added")+'</b>'
    +'<div style="margin-top:8px;font:500 .88rem IBM Plex Sans,sans-serif">'+(e.start?esc(fd(e.start)+(e.end&&e.end!==e.start?" to "+fd(e.end):"")):"Dates: to be added")+(e.city||e.venue?" · "+esc([e.venue,e.city].filter(Boolean).join(", ")):"")+'</div>'
    +(d!=null?'<div class=cnt style="margin-top:6px">'+(d>0?d+(d===1?" day":" days")+" to go":(d===0?"Today":"Underway or done"))+'</div>':'')
    +(e.map?'<a style="color:#C5A56A;font:600 .82rem IBM Plex Sans,sans-serif" href="'+esc(e.map)+'" target=_blank rel=noopener>Open the map</a>':'')
    +'<div class=g2 style="margin-top:10px"><button type=button class=add style="color:#F7F3EA;border-color:#C5A56A" id=tcf>Edit conference</button><button type=button class=add style="color:#F7F3EA;border-color:#C5A56A" id=tev>Dates &amp; venue</button></div></div>';
  $("tcf").onclick=function(){openSheet("Conference",[["conference","Conference name"]],{conference:T.conference},function(v){return api({action:"conference",conference:v.conference})},null)};
  $("tev").onclick=function(){openSheet("Dates & venue",[["start","Starts","date"],["end","Ends","date"],["city","City"],["venue","Venue"],["address","Address","long"],["map","Map link","url"]],e,function(v){return api({action:"event",event:v})},null)};
  $("tsecs").innerHTML=SECS.map(function(s){var L=(T.items&&T.items[s.id])||[];
    var body=s.tick?L.map(function(it){return '<div class="ck'+(it.done?" done":"")+'" data-s="'+s.id+'" data-i="'+esc(it.id)+'"><input type=checkbox data-tk="'+esc(it.id)+'"'+(it.done?" checked":"")+' aria-label="Done"><div><b>'+esc(it.what||"")+'</b><span style="display:block;font:500 .78rem IBM Plex Sans,sans-serif;color:#5F6B66">'+esc([it.who,it.by?fd(it.by):""].filter(Boolean).join(" · "))+'</span></div></div>'}).join("")
      :(L.length?'<div class=g2>'+L.map(function(it){return '<div class=it data-s="'+s.id+'" data-i="'+esc(it.id)+'">'+summary(s,it)+'</div>'}).join("")+'</div>':'');
    if(!L.length)body='<p class=em>Nothing yet.</p>';
    var tot="";if(s.id==="budget"&&L.length){var by={};L.forEach(function(it){if(it.amount!=null){var c=it.currency||"AED";by[c]=(by[c]||0)+it.amount}});tot='<p class=em style="color:#0A4F4A;font-weight:600">Total: '+Object.keys(by).map(function(c){return c+" "+by[c].toLocaleString("en")}).join(" · ")+'</p>'}
    return '<h2>'+esc(s.title)+'</h2><div class=cd>'+body+tot+'<button type=button class=add data-add="'+s.id+'">+ '+esc(s.add)+'</button></div>'}).join("");
  $("tlog").innerHTML=(T.log||[]).slice(0,20).map(function(l){return '<div class=lg><b style="color:#0A4F4A">'+esc(l.who)+'</b> '+esc(l.what)+' · '+esc(new Date(l.at).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}))+'</div>'}).join("")||'<p class=em>No changes yet.</p>';
  Array.prototype.forEach.call(document.querySelectorAll("[data-add]"),function(b){b.onclick=function(){var s=SECS.filter(function(x){return x.id===b.getAttribute("data-add")})[0];itemSheet(s,null)}});
  Array.prototype.forEach.call(document.querySelectorAll(".it[data-i]"),function(c){c.onclick=function(){var s=SECS.filter(function(x){return x.id===c.getAttribute("data-s")})[0],it=(T.items[s.id]||[]).filter(function(x){return x.id===c.getAttribute("data-i")})[0];itemSheet(s,it)}});
  Array.prototype.forEach.call(document.querySelectorAll("[data-tk]"),function(x){x.onclick=function(ev){ev.stopPropagation();api({action:"tick",id:x.getAttribute("data-tk"),done:x.checked}).then(function(j){done(j,x.checked?"Ticked":"Unticked","Checklist")})}});
  Array.prototype.forEach.call(document.querySelectorAll(".ck[data-i]"),function(c){c.onclick=function(ev){if(ev.target.tagName==="INPUT")return;var it=(T.items.checklist||[]).filter(function(x){return x.id===c.getAttribute("data-i")})[0];itemSheet(SECS.filter(function(x){return x.id==="checklist"})[0],it)}});
}
function closeSheet(){$("tsh").className="";$("tscr").className="";$("tsh").innerHTML=""}
$("tscr").onclick=closeSheet;
function field(f,v){var k=f[0],lab=f[1],t=f[2]||"text",opts=f[3];v=v==null?"":v;
  if(t==="pick")return '<label for="tf_'+k+'">'+esc(lab)+'</label><select id="tf_'+k+'"><option value="">Choose</option>'+opts.map(function(o){return '<option'+(o===v?" selected":"")+'>'+esc(o)+'</option>'}).join("")+'</select>';
  if(t==="long")return '<label for="tf_'+k+'">'+esc(lab)+'</label><textarea id="tf_'+k+'">'+esc(v)+'</textarea>';
  var ty=t==="date"?"date":t==="time"?"time":t==="url"?"url":t==="money"?"number":"text";
  return '<label for="tf_'+k+'">'+esc(lab)+'</label><input id="tf_'+k+'" type='+ty+(t==="money"?' step=any inputmode=decimal':'')+' value="'+esc(v)+'">'}
function openSheet(title,fields,vals,saveFn,delFn,fileLabel,fileFor){var h='<div style="font:600 1.1rem Fraunces,serif;color:#0A4F4A">'+esc(title)+'</div>'+fields.map(function(f){return field(f,vals?vals[f[0]]:"")}).join("");
  if(fileLabel)h+='<label for=tf_file>'+esc(fileLabel)+'</label><input id=tf_file type=file accept=".pdf,.ppt,.pptx,.key,.png,.jpg,.jpeg,.doc,.docx">'+(fileFor&&fileFor.file?'<div class=em>Attached: '+esc(fileFor.file.name)+' (choose a new file to replace it)</div>':'');
  if(title==="Add a document"||title==="Documents")h+='<div class=note>Never put a passport number or a passport scan here. Keep only the valid-until date and a note.</div>';
  h+='<div class=row><button type=button class=sv id=tsv>Save</button>'+(delFn?'<button type=button class=dl id=tdl>Delete</button>':'<button type=button class=dl id=tcx style="color:#0A4F4A;border-color:#0A4F4A">Cancel</button>')+'</div>';
  $("tsh").innerHTML=h;$("tsh").className="open";$("tscr").className="open";
  $("tsv").onclick=function(){var b=this,v={};fields.forEach(function(f){var x=$("tf_"+f[0]);if(x)v[f[0]]=x.value});b.disabled=true;b.textContent="Saving\u2026";
    saveFn(v).then(function(j){var fl=$("tf_file");if(j&&j.ok&&fl&&fl.files&&fl.files[0]&&j.newId!==undefined){return upload(j.newId,j.newSection,fl.files[0]).then(function(k){if(k&&k.ok){j.trip=k.trip}else{j={ok:false,error:(k&&k.error)||"The item saved but the file did not upload. Try attaching it again."}}return j})}return j})
    .then(function(j){done(j);if(j&&j.ok)closeSheet();else{b.disabled=false;b.textContent="Save"}}).catch(function(){b.disabled=false;b.textContent="Save";done({ok:false,error:"No connection. Nothing was changed."})})};
  if(delFn)$("tdl").onclick=function(){if(!confirm("Delete this item?"))return;delFn().then(function(j){done(j,"Deleted","Thailand trip");if(j&&j.ok)closeSheet()})};
  var cx=$("tcx");if(cx)cx.onclick=closeSheet}
function upload(id,sec,file){if(file.size>20*1024*1024)return Promise.resolve({ok:false,error:"That file is over 20 MB."});
  return fetch("/momo/work/trip/upload"+Q+"&section="+encodeURIComponent(sec)+"&id="+encodeURIComponent(id)+"&name="+encodeURIComponent(file.name),{method:"POST",headers:{"Content-Type":file.type||"application/octet-stream","X-Momo-Confirm":"page"},body:file}).then(function(r){return r.json()})}
function itemSheet(s,it){openSheet(it?s.title:s.add,s.fields,it||{},function(v){return api({action:it?"edit":"add",section:s.id,id:it&&it.id,item:Object.assign({},v,s.tick&&it?{done:it.done}:{})}).then(function(j){if(j&&j.ok){var L=j.trip.items[s.id]||[];j.newSection=s.id;j.newId=it?it.id:(L.length?L[L.length-1].id:undefined)}return j})},
  it?function(){return api({action:"delete",section:s.id,id:it.id})}:null,s.file,it)}
load();setInterval(function(){if(!$("tsh").className)load()},60000);
})();`;
}

export async function tripRoute(request, env, url, deps) {
  const p = url.pathname; if (!p.startsWith("/momo/work/trip")) return null;
  const person = typeof deps.person === "function" ? deps.person(env, url) : "";
  if (!TRIP_PEOPLE.includes(person)) return new Response("not found", { status: 404 });   // Kendall's and Najjuko's keys only
  const key = url.searchParams.get("key") || "", rk = url.searchParams.get("rk") || "";
  const J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if ((p === "/momo/work/trip" || p === "/momo/work/trip/thailand") && request.method === "GET")
    return new Response(deps.page(key, rk, TRIP_BODY + "<script>" + tripJs(JSON.stringify(TRIP_SECTIONS)) + "</script>"), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  if (p === "/momo/work/trip/data" && request.method === "GET") return J({ ok: true, trip: await readTrip(env), sections: TRIP_SECTIONS });
  if (p === "/momo/work/trip/api" && request.method === "POST") {
    let b = {}; try { b = await request.json(); } catch (e) { return J({ ok: false, error: "Send JSON." }, 400); }
    const r = await tripApi(env, person, b || {}); return r.error ? J({ ok: false, error: r.error }, r.status || 400) : J(r);
  }
  if (p === "/momo/work/trip/upload" && request.method === "POST") {
    const sec = url.searchParams.get("section") || "", id = url.searchParams.get("id") || "", name = str(url.searchParams.get("name") || "file", 120);
    const r = await readTrip(env), list = r.items[sec]; if (!list || !SEC[sec].file) return J({ ok: false, error: "This section takes no files." }, 400);
    const it = list.find((x) => x.id === id); if (!it) return J({ ok: false, error: "Save the item first, then attach the file." }, 404);
    const buf = await request.arrayBuffer(); if (!buf.byteLength) return J({ ok: false, error: "The file was empty." }, 400); if (buf.byteLength > MAX_FILE) return J({ ok: false, error: "That file is over 20 MB." }, 413);
    if (sec === "documents" && /passport/i.test(name)) return J({ ok: false, error: "Please don't upload a passport scan. Keep only the valid-until date." }, 400);
    const fid = rid(), type = String(request.headers.get("Content-Type") || "application/octet-stream").slice(0, 100);
    if (it.file) { try { await env.MEETINGS.delete(TRIP_KEY + "_file_" + it.file.id); await env.MEETINGS.delete(TRIP_KEY + "_fmeta_" + it.file.id); } catch (e) {} }
    await env.MEETINGS.put(TRIP_KEY + "_file_" + fid, buf); await env.MEETINGS.put(TRIP_KEY + "_fmeta_" + fid, JSON.stringify({ name, type, size: buf.byteLength }));
    it.file = { id: fid, name, size: buf.byteLength };
    r.log.unshift({ at: new Date().toISOString(), who: TRIP_NAMES[person], what: "attached " + name + " to " + SEC[sec].title });
    r.updatedAt = new Date().toISOString(); await env.MEETINGS.put(TRIP_KEY, JSON.stringify(r));
    return J({ ok: true, trip: r });
  }
  if (p === "/momo/work/trip/file" && request.method === "GET") {
    const f = String(url.searchParams.get("f") || "").replace(/[^a-z0-9]/g, "").slice(0, 24);
    const meta = await env.MEETINGS.get(TRIP_KEY + "_fmeta_" + f, "json"), buf = meta ? await env.MEETINGS.get(TRIP_KEY + "_file_" + f, "arrayBuffer") : null;
    if (!buf) return new Response("not found", { status: 404 });
    return new Response(buf, { headers: { "Content-Type": meta.type || "application/octet-stream", "Content-Disposition": "inline; filename=\"" + String(meta.name || "file").replace(/["\\]/g, "") + "\"", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }
  return new Response("not found", { status: 404 });
}
