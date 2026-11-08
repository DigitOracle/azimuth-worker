// v812 DRAFT TASKS FROM A MEETING (Kendall approved 8 Nov 2026): the action points of a recording's minutes (and of a huddle's Close) become DRAFT tasks
// on the meeting record (m.draft_tasks), shown as cards she can Add, Edit or Dismiss, or Add all. Nothing becomes a task without her tap: Add goes through
// the same quick-task path as a typed Quick task (work_log.js quickTaskAdd -> work_naj_task_<slug>, {name, owners, due, quick}). No new model call: the
// minutes the auto-file / Minutes button already writes (one claudeJSON call, schema actions[{action, owner, due, due_stated}]) are the extraction.
// An action with no owner who is on her roster is flagged in gold "owner needed" (the organogram gap); she can still add it with an owner chosen.
// Draft shape: { id, text, owner, owner_said, due, owner_needed, state: "draft" | "added" | "dismissed", task?: name }. Never logged.

import { MOMO_TOAST_JS } from "./momo_toast.js";   // v814
const clip = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
const okDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ""));
const hid = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return "d" + (h >>> 0).toString(36); };

// owner said -> a roster name (exact, or the first name), else "" (owner needed)
export function matchOwner(said, names) {
  const s = clip(said, 60).replace(/\[to confirm\]|\(proposed\)/gi, "").trim().toLowerCase(); if (!s || /^(tbc|tbd|to confirm|unassigned|team|everyone|all|n\/a|none)$/.test(s)) return "";
  const ns = names || [];
  return ns.find((n) => n.toLowerCase() === s) || ns.find((n) => n.split(/\s+/)[0].toLowerCase() === s.split(/\s+/)[0]) || "";
}
// v814 TASK QUALITY (Kendall, a must): a task is an ACTION VERB + what is made or done (+ for whom), with a START date and a DUE date.
// "Create the digital footprint plan for Sultan, start 10 Nov, due 20 Nov" is a task; "Brand and digital footprint" is a topic, not a task.
export const TASK_VERBS = ["add", "agree", "analyse", "analyze", "apply", "approve", "arrange", "ask", "audit", "book", "brief", "build", "buy", "call", "chase", "check", "clean", "close", "collect", "compile", "complete", "confirm",
  "contact", "coordinate", "create", "decide", "define", "deliver", "design", "draft", "edit", "email", "film", "finalise", "finalize", "find", "finish", "fix", "follow", "get", "hire", "inspect", "invite", "launch", "list", "make",
  "map", "measure", "meet", "move", "negotiate", "open", "order", "organise", "organize", "pay", "plan", "post", "prepare", "present", "print", "produce", "publish", "quote", "record", "register", "remove", "renew", "reply",
  "report", "research", "respond", "review", "run", "schedule", "send", "set", "share", "shoot", "sign", "source", "start", "submit", "test", "track", "train", "translate", "update", "upload", "visit", "write"];
const VSET = new Set(TASK_VERBS);
export const isAction = (text) => VSET.has(String(text || "").trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, "")) && String(text || "").trim().split(/\s+/).length >= 2;
// what a task still lacks: [] = good; otherwise any of "verb", "start", "due"
export function taskGaps(name, start, due) {
  const g = []; if (!isAction(name)) g.push("verb"); if (!okDate(start)) g.push("start"); if (!okDate(due)) g.push("due"); return g;
}
// items: [{ action|text|what, owner, due, due_stated, start }] (minutes.actions, notes.actions, or huddle actions); prev keeps her earlier decisions
// (a dismissed draft stays dismissed). Only a concrete action (starts with an action verb) becomes a draft task; anything else goes to topics (returned
// separately by splitActions). Dates are taken ONLY when the meeting said them (the minutes mark due_stated); never invented.
export function splitActions(items) {
  const acts = [], topics = [];
  for (const a of Array.isArray(items) ? items : []) { const t = clip(a && (a.action || a.text || a.what), 200); if (t.length < 3) continue; (isAction(t) ? acts : topics).push(a); }
  return { acts, topics: topics.map((a) => clip(a.action || a.text || a.what, 200)) };
}
export function draftTasksFrom(items, names, prev) {
  const old = Object.fromEntries((Array.isArray(prev) ? prev : []).map((d) => [d.id, d])), out = [], seen = new Set();
  for (const a of splitActions(items).acts) {
    const text = clip(a && (a.action || a.text || a.what), 200);
    const id = hid(text.toLowerCase()); if (seen.has(id)) continue; seen.add(id);
    if (old[id]) { const d = old[id]; if (d.state === "draft" && d.owner_needed) { const o2 = matchOwner(a.owner || d.owner_said, names); if (o2) { d.owner = o2; d.owner_said = ""; d.owner_needed = false; } } out.push(d); continue; }   // v814 - a name learned later fills the owner
    const said = clip(a.owner, 60), owner = matchOwner(said, names), stated = a.due_stated !== false;
    const due = stated && okDate(a.due) ? a.due : "", start = okDate(a.start) ? a.start : "";
    out.push({ id, text, owner, owner_said: owner ? "" : said, start, due, owner_needed: !owner, needs_dates: !(start && due), state: "draft" });
  }
  for (const d of Array.isArray(prev) ? prev : []) if (!seen.has(d.id) && d.state !== "draft") out.push(d);   // keep what she already added or dismissed
  return out.slice(0, 40);
}
// after minutes are written (auto-file or by hand): the drafts ride on the record, points that are not actions go to its topics; nothing else happens
export function attachDraftTasks(m, names) {
  const items = m && m.minutes && Array.isArray(m.minutes.actions) && m.minutes.actions.length ? m.minutes.actions : m && m.notes && Array.isArray(m.notes.actions) ? m.notes.actions : [];
  m.draft_tasks = draftTasksFrom(items, names, m.draft_tasks);
  const tp = splitActions(items).topics; if (tp.length) m.topics_discussed = [...new Set((m.topics_discussed || []).concat(tp))].slice(0, 30);
  return m;
}

// the page: /momo/work/rec/tasks?id=<recording id>; cards, cream, her key (the router gates it)
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export function draftTasksPage(m, names, key) {
  const D = { id: m.id, title: m.title || "Meeting", date: m.date, drafts: m.draft_tasks || [], names: names || [] };
  return '<a class=back href="/momo/work?key=' + encodeURIComponent(key) + '">&#8592; Work</a><div class=tag>DRAFT TASKS · ' + esc(m.date) + '</div><h1>' + esc(m.title || "Meeting") + '</h1>' + draftTasksWidget(m, names);
}
// the cards alone (the meeting page embeds them)
export function draftTasksWidget(m, names) {
  const D = { id: m.id, title: m.title || "Meeting", date: m.date, drafts: m.draft_tasks || [], names: names || [] };
  return '<script>' + MOMO_TOAST_JS + '</script><style>.dg{display:grid;grid-template-columns:1fr;gap:10px}.dk{border:1px solid #E3DDD1;border-radius:16px;background:#FFFDF9;padding:12px}.dk.on{background:#2F7D5B;border-color:#2F7D5B;color:#fff}.dk.off{opacity:.55}.dk b{display:block;font:600 .95rem "IBM Plex Sans",sans-serif;overflow-wrap:anywhere}'
    + '.dk .mt{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.chip{border-radius:99px;padding:2px 9px;font:600 .7rem "IBM Plex Mono",monospace;background:#F3EFE7;color:#5F6B66}.chip.gold{background:#F6EEDC;color:#8A6F3E;border:1px solid #C5A56A}.dk.on .chip{background:rgba(255,255,255,.2);color:#fff}'
    + '.dk .dbt{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}.dk button{border:1.5px solid #0A4F4A;background:#fff;color:#0A4F4A;border-radius:10px;padding:9px 4px;font:600 .82rem "IBM Plex Sans",sans-serif}.dk button.pr{background:#0A4F4A;color:#fff}'
    + '.dk .ed{display:none;margin-top:8px}.dk .ed.on{display:grid;gap:6px}.dk input,.dk select{border:1px solid #E3DDD1;border-radius:8px;padding:8px;font:500 .88rem "IBM Plex Sans",sans-serif;background:#fff;width:100%;box-sizing:border-box}'
    + '.all{display:block;width:100%;box-sizing:border-box;border:0;border-radius:12px;padding:13px;background:#0A4F4A;color:#fff;font:600 .95rem "IBM Plex Sans",sans-serif;margin:4px 0 14px}.nt{font-size:.82rem;color:#5F6B66;margin:0 0 12px}</style>'
    + '<p class=nt>From the minutes. Nothing is a task until you tap Add.</p><div id=dtw></div><script>var DT=' + JSON.stringify(D).replace(/</g, "\\u003c") + ';</script><script>' + DT_JS + '</script>';
}
const DT_JS = String.raw`(function(){
var $=function(i){return document.getElementById(i)},e=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
function api(b){b.action="draft_task";b.id=DT.id;return fetch("/momo/work/api"+location.search,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)}).then(function(r){return r.json()}).then(function(j){if(j&&j.drafts){DT.drafts=j.drafts;draw()}return j})}
function draw(){var L=DT.drafts,open=L.filter(function(d){return d.state==="draft"});
 var h=open.length>1?'<button type=button class=all id=dall>Add all '+open.length+'</button>':'';
 h+='<div class=dg>'+L.map(function(d){var on=d.state==="added",off=d.state==="dismissed";
  return '<div class="dk'+(on?" on":off?" off":"")+'" data-d="'+e(d.id)+'"><b>'+e(d.text)+'</b><div class=mt>'+(d.owner?'<span class=chip>'+e(d.owner)+'</span>':'<span class="chip gold">owner needed'+(d.owner_said?" · said: "+e(d.owner_said):"")+'</span>')+(d.start&&d.due?'<span class=chip>'+e(d.start)+' to '+e(d.due)+'</span>':'<span class="chip gold">Set dates</span>')+(on?'<span class=chip>added to your tasks</span>':off?'<span class=chip>dismissed</span>':'')+'</div>'
  +(d.state==="draft"?'<div class=dbt><button type=button class=pr data-op=add>Add</button><button type=button data-op=edit>Edit</button><button type=button data-op=dismiss>Dismiss</button></div><div class=ed><input data-f=text value="'+e(d.text)+'"><select data-f=who><option value="">Owner</option>'+DT.names.map(function(n){return '<option'+(n===d.owner?" selected":"")+'>'+e(n)+'</option>'}).join("")+'</select><label style="font-size:.75rem">Start<input data-f=start type=date value="'+e(d.start||"")+'"></label><label style="font-size:.75rem">Due<input data-f=due type=date value="'+e(d.due)+'"></label><button type=button class=pr data-op=save>Save</button></div>':'')+'</div>'}).join("")+'</div>';
 if(!L.length)h='<p class=nt>No action points in these minutes.</p>';
 $("dtw").innerHTML=h;
 if($("dall"))$("dall").onclick=function(){api({op:"add_all"})};
 $("dtw").querySelectorAll(".dk button[data-op]").forEach(function(b){b.onclick=function(){var k=b.closest(".dk"),did=k.getAttribute("data-d"),op=b.getAttribute("data-op");
  if(op==="edit"){k.querySelector(".ed").classList.toggle("on");return}
  var dd=(DT.drafts.filter(function(x){return x.id===did})[0]||{});if(op==="add"&&!(dd.start&&dd.due)){k.querySelector(".ed").classList.add("on");if(window.momoToast)momoToast("Set the start and due dates first, then Add.",{error:true});return}
  var v=function(f){var x=k.querySelector('[data-f="'+f+'"]');return x?x.value:undefined};
  api({op:op,did:did,text:v("text"),who:v("who"),start:v("start"),due:v("due")}).then(function(j){if(j&&j.error&&window.momoToast)momoToast(j.error,{error:true});else if(j&&j.ok&&window.momoToast)momoToast(op==="add"?"Added to your tasks":op==="dismiss"?"Dismissed":op==="add_all"?"Added: the ones with both dates":"Saved")})}})}
draw()})();`;
