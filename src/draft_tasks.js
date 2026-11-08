// v812 DRAFT TASKS FROM A MEETING (Kendall approved 8 Nov 2026): the action points of a recording's minutes (and of a huddle's Close) become DRAFT tasks
// on the meeting record (m.draft_tasks), shown as cards she can Add, Edit or Dismiss, or Add all. Nothing becomes a task without her tap: Add goes through
// the same quick-task path as a typed Quick task (work_log.js quickTaskAdd -> work_naj_task_<slug>, {name, owners, due, quick}). No new model call: the
// minutes the auto-file / Minutes button already writes (one claudeJSON call, schema actions[{action, owner, due, due_stated}]) are the extraction.
// An action with no owner who is on her roster is flagged in gold "owner needed" (the organogram gap); she can still add it with an owner chosen.
// Draft shape: { id, text, owner, owner_said, due, owner_needed, state: "draft" | "added" | "dismissed", task?: name }. Never logged.

const clip = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
const okDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ""));
const hid = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return "d" + (h >>> 0).toString(36); };

// owner said -> a roster name (exact, or the first name), else "" (owner needed)
export function matchOwner(said, names) {
  const s = clip(said, 60).replace(/\[to confirm\]|\(proposed\)/gi, "").trim().toLowerCase(); if (!s || /^(tbc|tbd|to confirm|unassigned|team|everyone|all|n\/a|none)$/.test(s)) return "";
  const ns = names || [];
  return ns.find((n) => n.toLowerCase() === s) || ns.find((n) => n.split(/\s+/)[0].toLowerCase() === s.split(/\s+/)[0]) || "";
}
// items: [{ action|text|what, owner, due }] (minutes.actions, notes.actions, or huddle actions); prev keeps her earlier decisions (a dismissed draft stays dismissed)
export function draftTasksFrom(items, names, prev) {
  const old = Object.fromEntries((Array.isArray(prev) ? prev : []).map((d) => [d.id, d])), out = [], seen = new Set();
  for (const a of Array.isArray(items) ? items : []) {
    const text = clip(a && (a.action || a.text || a.what), 200); if (text.length < 3) continue;
    const id = hid(text.toLowerCase()); if (seen.has(id)) continue; seen.add(id);
    if (old[id]) { out.push(old[id]); continue; }
    const said = clip(a.owner, 60), owner = matchOwner(said, names), due = okDate(a.due) ? a.due : "";
    out.push({ id, text, owner, owner_said: owner ? "" : said, due, owner_needed: !owner, state: "draft" });
  }
  for (const d of Array.isArray(prev) ? prev : []) if (!seen.has(d.id) && d.state !== "draft") out.push(d);   // keep what she already added or dismissed
  return out.slice(0, 40);
}
// after minutes are written (auto-file or by hand): the drafts ride on the record; nothing else happens
export function attachDraftTasks(m, names) {
  const items = m && m.minutes && Array.isArray(m.minutes.actions) && m.minutes.actions.length ? m.minutes.actions : m && m.notes && Array.isArray(m.notes.actions) ? m.notes.actions : [];
  m.draft_tasks = draftTasksFrom(items, names, m.draft_tasks); return m;
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
  return '<style>.dg{display:grid;grid-template-columns:1fr;gap:10px}.dk{border:1px solid #E3DDD1;border-radius:16px;background:#FFFDF9;padding:12px}.dk.on{background:#2F7D5B;border-color:#2F7D5B;color:#fff}.dk.off{opacity:.55}.dk b{display:block;font:600 .95rem "IBM Plex Sans",sans-serif;overflow-wrap:anywhere}'
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
  return '<div class="dk'+(on?" on":off?" off":"")+'" data-d="'+e(d.id)+'"><b>'+e(d.text)+'</b><div class=mt>'+(d.owner?'<span class=chip>'+e(d.owner)+'</span>':'<span class="chip gold">owner needed'+(d.owner_said?" · said: "+e(d.owner_said):"")+'</span>')+(d.due?'<span class=chip>due '+e(d.due)+'</span>':'')+(on?'<span class=chip>added to your tasks</span>':off?'<span class=chip>dismissed</span>':'')+'</div>'
  +(d.state==="draft"?'<div class=dbt><button type=button class=pr data-op=add>Add</button><button type=button data-op=edit>Edit</button><button type=button data-op=dismiss>Dismiss</button></div><div class=ed><input data-f=text value="'+e(d.text)+'"><select data-f=who><option value="">Owner</option>'+DT.names.map(function(n){return '<option'+(n===d.owner?" selected":"")+'>'+e(n)+'</option>'}).join("")+'</select><input data-f=due type=date value="'+e(d.due)+'"><button type=button class=pr data-op=save>Save</button></div>':'')+'</div>'}).join("")+'</div>';
 if(!L.length)h='<p class=nt>No action points in these minutes.</p>';
 $("dtw").innerHTML=h;
 if($("dall"))$("dall").onclick=function(){api({op:"add_all"})};
 $("dtw").querySelectorAll(".dk button[data-op]").forEach(function(b){b.onclick=function(){var k=b.closest(".dk"),did=k.getAttribute("data-d"),op=b.getAttribute("data-op");
  if(op==="edit"){k.querySelector(".ed").classList.toggle("on");return}
  var v=function(f){var x=k.querySelector('[data-f="'+f+'"]');return x?x.value:undefined};
  api({op:op,did:did,text:v("text"),who:v("who"),due:v("due")})}})}
draw()})();`;
