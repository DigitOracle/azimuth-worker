// v650 - MOMO GGU (Kendall, 27 Oct 2026: "make another card ... specific to GGU"): his Golden Gate University work in one place - roles,
// the doctoral candidates he chairs (stage, next milestone, what is due), programme deadlines, his own tasks, documents and portals,
// contacts (names and roles only, never emails on the page) and his own DBA. Kendall's key only (person 'kendall'); every other key 404s.
// One record per person in KV: ggu_rec_<person>. The real data is loaded from a seed kept OUTSIDE git (the GGU engagement folder).
// Same page patterns as Speaking (src/work_speaking.js), incl. the v647 rule: page scripts that embed server functions start with __name.
export const GGU_PREFIX = "ggu_rec_";
const S = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, n);
const day = (v) => { const d = S(v, 10).trim(); return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : ""; };
const slug = (v) => S(v, 60).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
const url = (v) => { const u = S(v, 500).trim(); return /^https?:\/\/[^\s]+$/i.test(u) ? u : ""; };
const arr = (a, n) => (Array.isArray(a) ? a : []).slice(0, n);
const noMail = (v, n) => S(v, n).replace(/[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}/gi, "[email removed]");   // names and roles only on this card

export const cleanTask = (t) => ({ what: noMail(t && t.what, 200).trim(), by: day(t && t.by), done: !!(t && t.done) });
export function cleanCandidate(c, prev) {
  const o = Object.assign({}, prev || {}), g = c && typeof c === "object" ? c : {}, has = (k) => g[k] !== undefined;
  [["name", 80], ["cohort", 40], ["mode", 40], ["topic", 300], ["stage", 120], ["nextMilestone", 200], ["feedbackOwed", 200]].forEach(([k, n]) => { if (has(k)) o[k] = noMail(g[k], n).trim(); else if (o[k] === undefined) o[k] = ""; });
  if (has("notes")) o.notes = noMail(g.notes, 2000); else if (o.notes === undefined) o.notes = "";
  if (has("meetings")) o.meetings = arr(g.meetings, 20).map((m) => ({ when: S(m && m.when, 40).trim(), what: noMail(m && m.what, 200).trim() })).filter((m) => m.what); else if (!Array.isArray(o.meetings)) o.meetings = [];
  if (has("due")) o.due = arr(g.due, 12).map(cleanTask).filter((t) => t.what); else if (!Array.isArray(o.due)) o.due = [];
  o.id = slug(g.id || o.id || o.name) || ("c" + Date.now().toString(36));
  return o;
}
export const emptyGgu = () => ({ v: 1, updatedAt: "", roles: [], candidates: [], deadlines: [], documents: [], portals: [], contacts: [], tasks: [], ownDba: { cohort: "", mode: "", completed: "", notes: "" }, log: [] });
export function cleanGgu(r) {
  const x = r && typeof r === "object" ? r : {}, e = emptyGgu();
  e.updatedAt = S(x.updatedAt, 30);
  e.roles = arr(x.roles, 12).map((q) => ({ title: noMail(q && q.title, 160).trim(), detail: noMail(q && q.detail, 600).trim(), source: S(q && q.source, 60).trim() })).filter((q) => q.title);
  e.candidates = arr(x.candidates, 40).map((c) => cleanCandidate(c)).filter((c) => c.name);
  e.deadlines = arr(x.deadlines, 40).map((d) => ({ date: day(d && d.date), what: noMail(d && d.what, 240).trim(), confirmed: !!(d && d.confirmed) })).filter((d) => d.date && d.what);
  e.documents = arr(x.documents, 60).map((d) => ({ label: S(d && d.label, 160).trim(), path_or_url: S(d && d.path_or_url, 400).trim() })).filter((d) => d.label && d.path_or_url);
  e.portals = arr(x.portals, 20).map((d) => ({ label: S(d && d.label, 120).trim(), url: url(d && d.url) })).filter((d) => d.label);
  e.contacts = arr(x.contacts, 30).map((c) => ({ name: noMail(c && c.name, 80).trim(), role: noMail(c && c.role, 200).trim() })).filter((c) => c.name);
  e.tasks = arr(x.tasks, 40).map(cleanTask).filter((t) => t.what);
  const d = x.ownDba && typeof x.ownDba === "object" ? x.ownDba : {};
  e.ownDba = { cohort: S(d.cohort, 40).trim(), mode: S(d.mode, 60).trim(), completed: S(d.completed, 40).trim(), notes: noMail(d.notes, 1500) };
  e.log = arr(x.log, 40).map((l) => ({ at: S(l && l.at, 30), text: S(l && l.text, 200) }));
  return e;
}
export async function readGgu(env, person) { let r = null; try { r = JSON.parse(await env.MEETINGS.get(GGU_PREFIX + person)); } catch (e) {} return r ? cleanGgu(r) : null; }
async function writeGgu(env, person, rec, line) {
  const now = new Date().toISOString(); rec.updatedAt = now;
  if (line) rec.log = [{ at: now, text: S(line, 200) }].concat(rec.log || []).slice(0, 40);
  await env.MEETINGS.put(GGU_PREFIX + person, JSON.stringify(rec)); return rec;
}
export async function gguApi(env, person, b) {
  const rec = (await readGgu(env, person)) || emptyGgu(), ci = (id) => rec.candidates.findIndex((c) => c.id === slug(id));
  switch (b.action) {
    case "save_all": case "import": {   // merge: candidates by id; the other lists are replaced when sent, kept when not
      const x = b.rec && typeof b.rec === "object" ? b.rec : {};
      const n = cleanGgu(Object.assign({}, rec, x, { candidates: [] }));
      ["roles", "deadlines", "documents", "portals", "contacts", "tasks"].forEach((k) => { if (Array.isArray(x[k])) rec[k] = n[k]; });
      if (x.ownDba) rec.ownDba = n.ownDba;
      let added = 0, merged = 0;
      for (const c of arr(x.candidates, 40)) { const i = ci(c && (c.id || c.name)); if (i >= 0) { rec.candidates[i] = cleanCandidate(c, rec.candidates[i]); merged++; } else { const k = cleanCandidate(c); if (k.name) { rec.candidates.push(k); added++; } } }
      await writeGgu(env, person, rec, "Imported: " + added + " new, " + merged + " updated candidates"); return { ok: true, added, merged, rec };
    }
    case "set_task_done": { const i = Number(b.index); if (!rec.tasks[i]) return { error: "Not found.", status: 404 }; rec.tasks[i].done = !!b.done; await writeGgu(env, person, rec, (b.done ? "Done: " : "Reopened: ") + rec.tasks[i].what); return { ok: true, rec }; }
    case "set_candidate_stage": {
      const i = ci(b.id); if (i < 0) return { error: "Not found.", status: 404 };
      rec.candidates[i] = cleanCandidate({ stage: b.stage, nextMilestone: b.nextMilestone !== undefined ? b.nextMilestone : rec.candidates[i].nextMilestone }, rec.candidates[i]);
      await writeGgu(env, person, rec, rec.candidates[i].name + ": " + rec.candidates[i].stage); return { ok: true, rec };
    }
    case "add_note": {
      const t = noMail(b.text, 600).trim(); if (!t) return { error: "Write the note first.", status: 400 };
      const i = b.id ? ci(b.id) : -1; const stamp = new Date().toISOString().slice(0, 10);
      if (b.id && i < 0) return { error: "Not found.", status: 404 };
      if (i >= 0) rec.candidates[i].notes = S((rec.candidates[i].notes ? rec.candidates[i].notes + "\n" : "") + stamp + ": " + t, 2000);
      await writeGgu(env, person, rec, "Note" + (i >= 0 ? " on " + rec.candidates[i].name : "") + ": " + t.slice(0, 80)); return { ok: true, rec };
    }
    case "toggle_due": {
      const i = ci(b.id), k = Number(b.index); if (i < 0 || !rec.candidates[i].due[k]) return { error: "Not found.", status: 404 };
      rec.candidates[i].due[k].done = !!b.done; await writeGgu(env, person, rec, rec.candidates[i].name + ": " + rec.candidates[i].due[k].what + (b.done ? " done" : " reopened")); return { ok: true, rec };
    }
  }
  return { error: "Unknown action.", status: 400 };
}

// ---- what is due (shared by the server tests and the page) ----
export const gguToday = (ms) => new Date((ms == null ? Date.now() : ms) + 4 * 3600e3).toISOString().slice(0, 10);
export function openItems(rec, today) {   // every open dated thing, soonest first: tasks, candidate due items, upcoming deadlines
  var t = today, out = [];
  (rec.tasks || []).forEach(function (x, i) { if (!x.done) out.push({ kind: "task", what: x.what, by: x.by || "", i: i }); });
  (rec.candidates || []).forEach(function (c) { (c.due || []).forEach(function (x, i) { if (!x.done) out.push({ kind: "due", what: c.name + ": " + x.what, by: x.by || "", id: c.id, i: i }); }); });
  (rec.deadlines || []).forEach(function (d) { if (d.date >= t) out.push({ kind: "deadline", what: d.what + (d.confirmed ? "" : " (unconfirmed)"), by: d.date }); });
  out.sort(function (a, b) { return (a.by || "9999") < (b.by || "9999") ? -1 : (a.by || "9999") > (b.by || "9999") ? 1 : 0; });
  return out;
}
export function chipFor(by, today) {   // red: today, past or within 2 days; amber: open; green handled by the caller when nothing is open
  if (!by) return "amber";
  var n = Math.round((Date.parse(by + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 864e5);
  return n <= 2 ? "red" : "amber";
}
export function nextDue(rec, today) {
  var o = openItems(rec, today); if (!o.length) return { cls: "ok", text: "Nothing due" };
  var f = o[0], c = chipFor(f.by, today); return { cls: c, text: (c === "red" ? "Due soon: " : "Due: ") + f.what + (f.by ? " (" + f.by + ")" : ""), item: f };
}
export function candidateChip(c, today) {
  var open = (c.due || []).filter(function (d) { return !d.done; });
  if (!open.length) return { cls: "ok", text: "Nothing due" };
  open.sort(function (a, b) { return (a.by || "9999") < (b.by || "9999") ? -1 : 1; });
  var cls = chipFor(open[0].by, today); return { cls: cls, text: (cls === "red" ? "Due soon: " : "Due: ") + open[0].what + (open.length > 1 ? " +" + (open.length - 1) + " more" : "") };
}

// ---- page ----
export const GGU_ICON = '<path d="M3 9l9-5 9 5-9 5z"/><path d="M7 11.5V16c0 1.5 2.2 3 5 3s5-1.5 5-3v-4.5"/><path d="M21 9v5"/>';
const GGU_CSS = '<style>.nx{background:#0A4F4A;color:#fff;border-radius:16px;padding:14px 16px;margin:0 0 14px}.nx b{display:block;font-family:Fraunces,serif;font-size:1.05rem;margin:4px 0}'
  + '.dc{display:inline-block;border-radius:999px;padding:3px 10px;font-weight:700;font-size:.76rem;margin-top:6px}.dc.ok{background:#DDEFE6;color:#1D5B3A}.dc.amber{background:#F6E7C8;color:#7A5B1E}.dc.red{background:#F6D5D0;color:#8A2A1E}'
  + 'h2{font-family:Fraunces,serif;font-size:1.05rem;color:#0A4F4A;margin:18px 0 8px}.gc{background:#fff;border:1px solid #E5DFD3;border-left:4px solid #C5A56A;border-radius:14px;padding:12px 14px;margin:0 0 10px}'
  + '.gc h3{margin:0 0 4px;font-size:.98rem}.gc p{margin:3px 0;color:#5F6B66;font-size:.82rem}.gc p b{color:#1C2321}.tl{border-left:2px solid #C5A56A;margin:0 0 0 6px;padding:0 0 0 12px}.tl div{margin:0 0 10px;font-size:.84rem}'
  + '.tl i{font-style:normal;font-size:.7rem;font-weight:700;border-radius:999px;padding:2px 8px;background:#F6EEDC;color:#7A5B1E;margin-left:4px}.tk label{display:flex;gap:8px;align-items:flex-start;background:#fff;border:1px solid #E5DFD3;border-radius:12px;padding:10px 12px;margin:0 0 8px;font-size:.86rem}'
  + '.tk input{margin-top:3px}.tk .done{opacity:.55;text-decoration:line-through}.tk small{display:block;color:#5F6B66}.dl{background:#fff;border:1px solid #E5DFD3;border-radius:12px;padding:10px 12px;margin:0 0 8px;font-size:.82rem;word-break:break-all}'
  + '.dl button,.gb a,.gb button{border:1px solid #0A4F4A;background:#fff;color:#0A4F4A;border-radius:999px;padding:5px 10px;font:600 .74rem "IBM Plex Sans",sans-serif;cursor:pointer;margin-top:6px;text-decoration:none;display:inline-block}'
  + '.gb{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}.gb .pri{background:#0A4F4A;color:#fff}.ct{font-size:.84rem;margin:0 0 6px}.ct b{color:#0A4F4A}.cd textarea{width:100%;box-sizing:border-box;border:1px solid #D8D1C4;border-radius:10px;padding:8px;font:400 .84rem "IBM Plex Sans",sans-serif;margin-top:6px}'
  + '.cd ul{margin:4px 0 0 18px;padding:0;font-size:.82rem}</style>';
export const GGU_BODY = GGU_CSS + '<a class=back href="/momo" id=gback>&#8592; Momo</a><div class=tag>MOMO</div><h1>GGU</h1><p class=sh id=gupd>Loading...</p><div id=gnext></div>'
  + '<div class=gb><a id=grep target=_blank rel=noopener>Brief (PDF)</a></div>'
  + '<h2>Candidates</h2><div id=gcand></div><h2>Deadlines</h2><div class=tl id=gdl></div><h2>My tasks</h2><div class=tk id=gtk></div>'
  + '<h2>Roles</h2><div id=groles></div><h2>Documents &amp; portals</h2><div id=gdocs></div><h2>Contacts</h2><div id=gct></div><h2>My DBA</h2><div id=gdba></div>';
export const GGU_JS = "var __name=function(f){return f};var gguToday=" + gguToday.toString() + ";var openItems=" + openItems.toString() + ";var chipFor=" + chipFor.toString() + ";var nextDue=" + nextDue.toString() + ";var candidateChip=" + candidateChip.toString() + ";" + String.raw`(function(){
var KEY=new URLSearchParams(location.search).get("key")||"",REC=null,$=function(i){return document.getElementById(i)};
$("gback").href="/momo?door=1&key="+encodeURIComponent(KEY);$("grep").href="/momo/work/ggu/report?key="+encodeURIComponent(KEY);
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function api(b){return fetch("/momo/work/ggu/api?key="+encodeURIComponent(KEY),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)}).then(function(r){return r.json()})}
function chip(c){return el("span","dc "+c.cls,c.text)}
function copyT(t,btn){var done=function(){var o=btn.textContent;btn.textContent="Copied";setTimeout(function(){btn.textContent=o},1500)};if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(done,function(){window.prompt("Copy:",t)})}else{window.prompt("Copy:",t)}}
function draw(){var T=gguToday();$("gupd").textContent=(REC.updatedAt?"Updated "+REC.updatedAt.slice(0,10):"No data yet");
var nx=$("gnext");nx.textContent="";var n=nextDue(REC,T),b=el("div","nx");b.appendChild(el("span","",n.cls==="ok"?"Nothing due":"Next due"));b.appendChild(el("b","",n.item?n.item.what:"You are up to date"));if(n.item&&n.item.by)b.appendChild(el("span","",n.item.by));b.appendChild(el("div"));b.lastChild.appendChild(chip(n));nx.appendChild(b);
var cd=$("gcand");cd.textContent="";if(!REC.candidates.length)cd.appendChild(el("p","sh","No candidates yet."));
REC.candidates.forEach(function(c){var x=el("div","gc cd");x.appendChild(el("h3","",c.name));x.appendChild(el("p","",[c.cohort,c.mode].filter(Boolean).join(" | ")));if(c.topic)x.appendChild(el("p","",c.topic));
var p1=el("p");p1.appendChild(el("b","","Stage: "));p1.appendChild(document.createTextNode(c.stage||"-"));x.appendChild(p1);var p2=el("p");p2.appendChild(el("b","","Next: "));p2.appendChild(document.createTextNode(c.nextMilestone||"-"));x.appendChild(p2);
if(c.feedbackOwed){var p3=el("p");p3.appendChild(el("b","","Feedback owed: "));p3.appendChild(document.createTextNode(c.feedbackOwed));x.appendChild(p3)}
x.appendChild(chip(candidateChip(c,T)));
if(c.meetings&&c.meetings.length){var ul=el("ul");c.meetings.forEach(function(m){ul.appendChild(el("li","",(m.when?m.when+": ":"")+m.what))});x.appendChild(ul)}
if(c.due&&c.due.length){var tk=el("div","tk");c.due.forEach(function(d,i){var lb=el("label"),cb=el("input");cb.type="checkbox";cb.checked=!!d.done;cb.onchange=function(){api({action:"toggle_due",id:c.id,index:i,done:cb.checked}).then(function(r){if(r.rec){REC=r.rec;draw()}})};lb.appendChild(cb);var s=el("span",d.done?"done":"",d.what);if(d.by)s.appendChild(el("small","",d.by));lb.appendChild(s);tk.appendChild(lb)});x.appendChild(tk)}
if(c.notes)x.appendChild(el("p","",c.notes));
var ta=el("textarea");ta.rows=2;ta.placeholder="Add a note";x.appendChild(ta);var sv=el("button","","Save note");sv.className="";sv.style.cssText="border:1px solid #0A4F4A;background:#fff;color:#0A4F4A;border-radius:999px;padding:5px 10px;margin-top:6px;font:600 .74rem IBM Plex Sans,sans-serif";sv.onclick=function(){if(!ta.value.trim())return;api({action:"add_note",id:c.id,text:ta.value}).then(function(r){if(r.rec){REC=r.rec;draw()}})};x.appendChild(sv);cd.appendChild(x)});
var dl=$("gdl");dl.textContent="";REC.deadlines.slice().sort(function(a,b){return a.date<b.date?-1:1}).forEach(function(d){var r=el("div");r.appendChild(el("b","",d.date+" "));r.appendChild(document.createTextNode(d.what));if(!d.confirmed)r.appendChild(el("i","","unconfirmed"));if(d.date<T)r.style.opacity=".55";dl.appendChild(r)});if(!REC.deadlines.length)dl.appendChild(el("div","","No deadlines yet."));
var tk2=$("gtk");tk2.textContent="";REC.tasks.forEach(function(t,i){var lb=el("label"),cb=el("input");cb.type="checkbox";cb.checked=!!t.done;cb.onchange=function(){api({action:"set_task_done",index:i,done:cb.checked}).then(function(r){if(r.rec){REC=r.rec;draw()}})};lb.appendChild(cb);var s=el("span",t.done?"done":"",t.what);s.appendChild(el("small","",t.by?"by "+t.by+(chipFor(t.by,T)==="red"&&!t.done?" (due soon)":""):"no date"));lb.appendChild(s);tk2.appendChild(lb)});
var ro=$("groles");ro.textContent="";REC.roles.forEach(function(q){var x=el("div","gc");x.appendChild(el("h3","",q.title));if(q.detail)x.appendChild(el("p","",q.detail));if(q.source)x.appendChild(el("p","","Source: "+q.source));ro.appendChild(x)});
var dc=$("gdocs");dc.textContent="";REC.portals.forEach(function(p){var x=el("div","dl");x.appendChild(el("b","",p.label));if(p.url){x.appendChild(el("br"));var a=el("a","",p.url);a.href=p.url;a.target="_blank";a.rel="noopener";x.appendChild(a)}dc.appendChild(x)});
REC.documents.forEach(function(d){var x=el("div","dl");x.appendChild(el("b","",d.label));x.appendChild(el("div","",d.path_or_url));if(/^https?:/.test(d.path_or_url)){var a=el("a","","Open");a.href=d.path_or_url;a.target="_blank";a.rel="noopener";x.appendChild(a)}else{var bt=el("button","","Copy path");bt.type="button";bt.onclick=function(){copyT(d.path_or_url,bt)};x.appendChild(bt)}dc.appendChild(x)});
var ct=$("gct");ct.textContent="";REC.contacts.forEach(function(c){var p=el("p","ct");p.appendChild(el("b","",c.name));p.appendChild(document.createTextNode(c.role?" | "+c.role:""));ct.appendChild(p)});
var db=$("gdba");db.textContent="";var o=REC.ownDba||{},x=el("div","gc");x.appendChild(el("h3","",["DBA",o.cohort?"Cohort "+o.cohort:"",o.mode].filter(Boolean).join(" | ")));if(o.completed)x.appendChild(el("p","","Completed: "+o.completed));if(o.notes)x.appendChild(el("p","",o.notes));db.appendChild(x)}
fetch("/momo/work/ggu/rec?key="+encodeURIComponent(KEY)).then(function(r){return r.json()}).then(function(d){REC=d.rec;draw()}).catch(function(){$("gupd").textContent="Could not load. Try again."})})();`;

const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const R_CSS = '@page{size:A4 portrait;margin:14mm}body{margin:0;background:#fff;color:#1C2321;font-family:"IBM Plex Sans",Arial,sans-serif;font-size:10.5pt}.bd{padding:0 2mm}h1{font-family:Georgia,serif;color:#0A4F4A;font-size:20pt;margin:0 0 2mm}'
  + '.rule{height:2px;background:#C5A56A;margin:0 0 5mm}h2{font-family:Georgia,serif;color:#0A4F4A;font-size:12.5pt;margin:6mm 0 2mm}table{width:100%;border-collapse:collapse;font-size:9.5pt}th,td{border-bottom:1px solid #E5DFD3;text-align:left;padding:4px 3px;vertical-align:top}'
  + 'th{color:#0A4F4A}.np{padding:8px 2mm}.np button{border:1px solid #0A4F4A;background:#0A4F4A;color:#fff;border-radius:999px;padding:7px 14px;font:600 10pt Arial;cursor:pointer}.ft{color:#5F6B66;font-size:8.5pt;margin-top:8mm}tr{page-break-inside:avoid}@media print{.np{display:none}}';
export function gguReport(rec, today) {
  const t = today || gguToday(), n = nextDue(rec, t), tr = (a) => "<tr>" + a.map((c) => "<td>" + esc(c) + "</td>").join("") + "</tr>";
  let b = '<div class=bd><h1>Golden Gate University</h1><div class=rule></div><p><b>Next due:</b> ' + esc(n.item ? n.item.what + (n.item.by ? " (" + n.item.by + ")" : "") : "Nothing due") + "</p>";
  b += "<h2>Roles</h2><table>" + rec.roles.map((q) => tr([q.title, q.detail])).join("") + "</table>";
  b += "<h2>Candidates</h2><table><tr><th>Name</th><th>Cohort</th><th>Topic</th><th>Stage</th><th>Next</th></tr>" + rec.candidates.map((c) => tr([c.name, c.cohort, c.topic, c.stage, c.nextMilestone])).join("") + "</table>";
  b += "<h2>Deadlines</h2><table>" + rec.deadlines.slice().sort((a, c) => (a.date < c.date ? -1 : 1)).map((d) => tr([d.date, d.what, d.confirmed ? "confirmed" : "unconfirmed"])).join("") + "</table>";
  b += "<h2>My tasks</h2><table>" + rec.tasks.map((x) => tr([x.done ? "done" : "open", x.what, x.by || ""])).join("") + "</table>";
  b += "<h2>Contacts</h2><table>" + rec.contacts.map((c) => tr([c.name, c.role])).join("") + "</table></div>";
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>GGU brief</title><style>' + R_CSS + '</style></head><body>'
    + '<div class=np><button type=button onclick="window.print()">Save as PDF</button></div>' + b + '<p class="ft bd">DigitAlchemy&reg; Tech Limited | prepared from the Momo GGU card | private</p>'
    + '<script>if(new URLSearchParams(location.search).get("print")==="1")setTimeout(function(){window.print()},400)</script></body></html>';
}

export async function gguRoute(request, env, url, deps) {
  const p = url.pathname, key = url.searchParams.get("key") || "", rk = url.searchParams.get("rk") || "";
  const J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  const person = typeof deps.person === "function" ? deps.person(env, url) : "";
  if (person !== "kendall") return new Response("not found", { status: 404 });   // Kendall's key only
  const H = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };
  if (p === "/momo/work/ggu" && request.method === "GET") return new Response(deps.page(key, rk, GGU_BODY + "<script>" + GGU_JS + "</script>"), { headers: H });
  if (p === "/momo/work/ggu/rec" && request.method === "GET") return J({ rec: (await readGgu(env, person)) || emptyGgu() });
  if (p === "/momo/work/ggu/report" && request.method === "GET") return new Response(gguReport((await readGgu(env, person)) || emptyGgu()), { headers: H });
  if (p === "/momo/work/ggu/api" && request.method === "POST") {
    let b = {}; try { b = await request.json(); } catch (e) { return J({ error: "Send JSON." }, 400); }
    const r = await gguApi(env, person, b || {}); return r.error ? J({ error: r.error }, r.status || 400) : J(r);
  }
  return new Response("not found", { status: 404 });
}
