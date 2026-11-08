// v812 THE MEETING SUMMARY (Najjuko and Kendall's live review, 8 Nov 2026). One overall summary per recorded meeting, sized to the meeting, written from the
// WHOLE transcript (condensed first when it is long, so nothing after the first part is lost) through the worker's existing claudeJSON path. Stored on the
// record as m.summary_full = { paragraphs[], bullets[], topics[], decisions[], figures[], open_questions[], actions[{action, owner, due}], hr, unclear[], at, edited }.
// NAMES: the team glossary (her roster, the speakers she has named, people on her work-log entries, her remembered corrections) goes into the prompt; the
// model never guesses who said or asked something: unclear = "a team member (check name)". She taps a name to correct it: the summary, the minutes and the
// draft tasks change, and the correction is remembered (rec_namefix) for later meetings.
// CONFIDENTIAL HR: a summary touching performance, pay, visas, health or personal matters is flagged hr:true ("Confidential · HR"); the debrief and the
// daily/activity reports leave that content out unless she chooses to include it. No summary text is ever logged.

export const CHECK_NAME = "a team member (check name)";
export const NAMEFIX_KEY = "rec_namefix";   // { "heard or wrong name": "right name" }, hers
const clip = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
const arr = (a, k, n) => (Array.isArray(a) ? a : []).map((v) => clip(v, n || 400)).filter(Boolean).slice(0, k);
const strs = { type: "array", items: { type: "string" } };
export const SUMMARY_SCHEMA = { type: "object", additionalProperties: false, required: ["paragraphs", "bullets", "topics", "decisions", "figures", "open_questions", "actions", "hr", "unclear"],
  properties: { paragraphs: strs, bullets: strs, topics: strs, decisions: strs, figures: strs, open_questions: strs, unclear: strs, hr: { type: "boolean" },
    actions: { type: "array", items: { type: "object", additionalProperties: false, required: ["action", "owner", "due"], properties: { action: { type: "string" }, owner: { type: "string" }, due: { type: "string" } } } } } };

export async function readNameFix(env) { try { return JSON.parse(await env.MEETINGS.get(NAMEFIX_KEY)) || {}; } catch (e) { return {}; } }
// the glossary: roster names + named speakers + people on recent entries + her corrections; names only
export async function glossary(env, rosterNames, entries, m) {
  const set = new Set((rosterNames || []).map(String));
  for (const e of entries || []) for (const p of Array.isArray(e.people) ? e.people : []) set.add(String(p));
  for (const s of (m && Array.isArray(m.speakers) ? m.speakers : [])) if (s && s.name) set.add(String(s.name));
  for (const a of (m && Array.isArray(m.attendees) ? m.attendees : [])) if (a && a.n) set.add(String(a.n));
  const fix = await readNameFix(env);
  return { names: [...set].filter(Boolean).slice(0, 120), fixes: fix, line: [...set].filter(Boolean).slice(0, 120).join(", ") + (Object.keys(fix).length ? ". Corrections she made: " + Object.entries(fix).map(([a, b]) => '"' + a + '" is ' + b).join("; ") : "") };
}
export const NAME_RULE = "Never guess who said, asked or requested something: when the transcript does not make the person clear, write '" + CHECK_NAME + "' and list that point in unclear. A person discussed by name is named, spelled as in the glossary. ";

export function targetBullets(secs) { const mins = Math.round((secs || 0) / 60); return Math.max(4, Math.min(15, Math.round(mins / 2.5))); }
export function summarySys(g, secs) {
  const n = targetBullets(secs);
  return "You write the OVERALL SUMMARY of a meeting for Najjuko, the Strategic Lead at FN Realty (a Dubai real-estate brokerage), from an AUTOMATIC transcript. "
    + "Team glossary (people who may be in the room or discussed): " + g.line + ". " + NAME_RULE
    + "Never invent anything. Size it to the meeting: about " + n + " bullets and " + Math.max(2, Math.min(5, Math.round(n / 3))) + " short paragraphs. "
    + "paragraphs: what the meeting was and what happened; bullets: the key points; topics: subjects discussed; decisions: what was agreed; figures: every number or figure mentioned, with what it refers to; "
    + "open_questions: what is still open; actions: each follow-up (owner = a glossary name, or '' when unclear); unclear: points whose person is unclear. "
    + "hr = true when the meeting touches staff performance, pay or salary, visas, health or personal matters.";
}
export function normSummary(x) {
  if (!x || typeof x !== "object") return null;
  return { paragraphs: arr(x.paragraphs, 6, 900), bullets: arr(x.bullets, 18), topics: arr(x.topics, 15, 120), decisions: arr(x.decisions, 15), figures: arr(x.figures, 20), open_questions: arr(x.open_questions, 12),
    unclear: arr(x.unclear, 12), hr: !!x.hr, actions: (Array.isArray(x.actions) ? x.actions : []).slice(0, 25).map((a) => ({ action: clip(a && a.action, 300), owner: clip(a && a.owner, 60), due: clip(a && a.due, 30) })).filter((a) => a.action) };
}
// deps: { claudeJSON, model, condense(env, deps, transcript) }; transcript = the full joined text (every segment)
export async function buildSummaryFull(env, deps, m, transcript, g) {
  const t = String(transcript || ""), long = t.length > 40000;
  const input = long && deps.condense ? await deps.condense(env, deps, t) : t;
  let x = null;
  try { x = await deps.claudeJSON(env, summarySys(g, m.secs), "Meeting: " + (m.title || "untitled") + ", " + m.date + " (" + Math.round((m.secs || 0) / 60) + " minutes).\n\nTranscript" + (long ? " (condensed from the whole recording)" : "") + ":\n" + input, SUMMARY_SCHEMA, deps.model, 4000); } catch (e) { x = null; }
  const s = normSummary(x); if (!s) return null;
  s.at = new Date().toISOString(); s.chars = t.length; return s;
}
// a correction: every text of the summary, the minutes and the draft tasks; the owner of a draft task becomes the roster name
const swap = (s, from, to) => String(s).split(from).join(to);
function deep(v, from, to) { if (typeof v === "string") return swap(v, from, to); if (Array.isArray(v)) return v.map((x) => deep(x, from, to)); if (v && typeof v === "object") { const o = {}; for (const k of Object.keys(v)) o[k] = deep(v[k], from, to); return o; } return v; }
export function applyNameFix(m, from, to, rosterNames) {
  from = clip(from, 60); to = clip(to, 60); if (!from || !to || from === to) return m;
  if (m.summary_full) m.summary_full = deep(m.summary_full, from, to);
  if (m.minutes) m.minutes = deep(m.minutes, from, to);
  if (m.notes) m.notes = deep(m.notes, from, to);
  for (const d of Array.isArray(m.draft_tasks) ? m.draft_tasks : []) {
    d.text = swap(d.text, from, to);
    if (d.owner === from || d.owner_said === from || (from === CHECK_NAME && d.owner_needed && d.text.includes(to))) { if ((rosterNames || []).includes(to)) { d.owner = to; d.owner_said = ""; d.owner_needed = false; } else d.owner_said = to; }
  }
  return m;
}
export async function rememberNameFix(env, from, to) {
  from = clip(from, 60); to = clip(to, 60); if (!from || !to || from === CHECK_NAME) return;
  const f = await readNameFix(env); f[from] = to; await env.MEETINGS.put(NAMEFIX_KEY, JSON.stringify(f));
}
// HR-safe text for anything shareable: the debrief and the reports
export const HR_LINE = "Confidential · HR: details left out.";
export function shareSafeEntry(e, m, includeHr) {
  if (includeHr || !(e && (e.hr || (m && m.summary_full && m.summary_full.hr)))) return e;
  return Object.assign({}, e, { title: "Meeting (Confidential · HR)", summary: HR_LINE, text: "", next: [], works: [], deliverables: [], hr_hidden: true });   // the title can carry HR content too
}

// ---- the page parts (cream, cards) ---------------------------------------------------------------------------------------------------------------------------
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// names in the text are tappable (data-nm) so she can correct them; "a team member (check name)" is gold
export function markNames(text, names) {
  let h = esc(text);
  h = h.split(esc(CHECK_NAME)).join('<button type=button class="nm chk" data-nm="' + esc(CHECK_NAME) + '">' + esc(CHECK_NAME) + "</button>");
  for (const n of (names || []).filter((x) => x && x.length > 2).sort((a, b) => b.length - a.length)) {
    const re = new RegExp("(^|[^\\w>\"])(" + n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")(?![\\w])", "g");
    h = h.replace(re, (all, pre, nm) => pre + '<button type=button class=nm data-nm="' + esc(nm) + '">' + esc(nm) + "</button>");
  }
  return h;
}
export const SUMMARY_CSS = ".sf{border:1px solid #E3DDD1;border-radius:16px;background:#FFFDF9;padding:12px 14px;margin:10px 0}.sf h3{font:600 .72rem 'IBM Plex Mono',monospace;letter-spacing:.08em;color:#8A6F3E;margin:0 0 6px;text-transform:uppercase}.sf p{margin:6px 0}.sf ul{margin:4px 0;padding-left:20px}.sf li{margin:3px 0}"
  + ".hr{display:inline-block;background:#F6EEDC;color:#8A6F3E;border:1px solid #C5A56A;border-radius:99px;padding:2px 10px;font:600 .72rem 'IBM Plex Mono',monospace;margin:4px 0}"
  + ".nm{font:inherit;color:#0A4F4A;background:none;border:0;border-bottom:1px dashed #0A4F4A;padding:0;cursor:pointer}.nm.chk{color:#8A6F3E;border-bottom-color:#C5A56A;background:#F6EEDC;border-radius:4px;padding:0 3px}"
  + ".sgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.sgrid .sf{margin:0}.btr{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.btr a,.btr button{flex:1 1 140px;text-align:center;text-decoration:none;border:1.5px solid #0A4F4A;border-radius:12px;padding:10px;font:600 .88rem 'IBM Plex Sans',sans-serif;color:#0A4F4A;background:#fff}.btr .pr{background:#0A4F4A;color:#fff}"
  + "details.ex{border:1px solid #E3DDD1;border-radius:14px;background:#fff;margin:10px 0;padding:0 12px}details.ex summary{padding:12px 0;font-weight:600;cursor:pointer;color:#0A4F4A}@media(max-width:420px){.sgrid{grid-template-columns:1fr}}";
export function summaryBlock(s, names, opts) {
  if (!s) return "";
  const li = (a) => (a.length ? "<ul>" + a.map((t) => "<li>" + markNames(t, names) + "</li>").join("") + "</ul>" : "<p style='color:#5F6B66'>None.</p>");
  return (s.hr ? "<div class=hr>Confidential · HR</div>" : "") + (s.edited ? "<div style='font-size:.75rem;color:#5F6B66'>Edited by her</div>" : "")
    + "<div class=sf><h3>Summary</h3>" + s.paragraphs.map((p) => "<p>" + markNames(p, names) + "</p>").join("") + li(s.bullets) + "</div>"
    + "<div class=sgrid><div class=sf><h3>Topics</h3>" + li(s.topics) + "</div><div class=sf><h3>Decisions</h3>" + li(s.decisions) + "</div>"
    + "<div class=sf><h3>Figures mentioned</h3>" + li(s.figures) + "</div><div class=sf><h3>Open questions</h3>" + li(s.open_questions) + "</div></div>"
    + (s.unclear.length ? "<div class=sf><h3>Check these names</h3>" + li(s.unclear) + "</div>" : "");
}
// tap a name -> correct it; Edit summary -> plain text boxes; both POST to /momo/work/rec/api
export const SUMMARY_JS = String.raw`(function(){var K=new URLSearchParams(location.search),ID=K.get('id'),KY=K.get('key')||'';
function post(b){b.id=ID;return fetch('/momo/work/rec/api?key='+encodeURIComponent(KY),{method:'POST',headers:{'Content-Type':'application/json','X-Momo-Confirm':'page'},body:JSON.stringify(b)}).then(function(r){return r.json()})}
document.addEventListener('click',function(ev){var b=ev.target.closest&&ev.target.closest('.nm');if(!b)return;var from=b.getAttribute('data-nm'),to=prompt('Who is this? (Momo will remember it for later meetings)',from===${JSON.stringify(CHECK_NAME)}?'':from);if(!to||to===from)return;post({action:'name_fix',from:from,to:to}).then(function(j){if(j&&j.ok)location.reload();else alert((j&&j.error)||'Not saved.')})});
var ed=document.getElementById('sedit');if(ed)ed.onclick=function(){var w=document.getElementById('sedw');w.style.display=w.style.display==='block'?'none':'block'};
var sv=document.getElementById('ssave');if(sv)sv.onclick=function(){var g=function(i){return document.getElementById(i).value.split('\n').map(function(x){return x.trim()}).filter(Boolean)};post({action:'summary_edit',paragraphs:g('sp'),bullets:g('sb'),hr:document.getElementById('shr').checked}).then(function(j){if(j&&j.ok)location.reload()})};
var rf=document.getElementById('srefresh');if(rf)rf.onclick=function(){rf.disabled=true;rf.textContent='Writing the summary...';post({action:'summary_full'}).then(function(j){if(j&&j.ok)location.reload();else{rf.disabled=false;rf.textContent='Refresh summary';alert((j&&j.error)||'Try again.')}})};
var auto=document.getElementById('sauto');if(auto){auto.textContent='Writing the meeting summary from the whole recording...';post({action:'summary_full'}).then(function(j){if(j&&j.ok)location.reload();else auto.textContent='Momo could not write the summary just now. Tap Refresh summary.'})}
})();`;
export function editBox(s) {
  const s2 = s || { paragraphs: [], bullets: [], hr: false };
  return "<div id=sedw style='display:none' class=sf><h3>Edit summary</h3><label style='font-size:.8rem'>Paragraphs (one per line)</label><textarea id=sp style='width:100%;box-sizing:border-box;min-height:110px'>" + esc(s2.paragraphs.join("\n")) + "</textarea>"
    + "<label style='font-size:.8rem'>Key points (one per line)</label><textarea id=sb style='width:100%;box-sizing:border-box;min-height:140px'>" + esc(s2.bullets.join("\n")) + "</textarea>"
    + "<label style='display:flex;gap:8px;align-items:center;font-size:.85rem;margin:8px 0'><input type=checkbox id=shr" + (s2.hr ? " checked" : "") + "> Confidential · HR (kept out of the debrief and reports)</label><button type=button id=ssave class=pr style='width:100%;padding:11px;border-radius:12px;border:0;background:#0A4F4A;color:#fff;font-weight:600'>Save</button></div>";
}
