// v625 - Momo Work: the people in the room, and FN meeting minutes from a recording (Kendall, 24 Oct 2026).
// The roster is PRIVATE: it lives in KV (work_naj_people), never in this public repo. This file only knows its SHAPE
// (the fn-people-and-org.json of the FN Knowledge Pack). The minutes follow the FN Meeting Minutes playbook: fixed order, plain third person,
// [to confirm] for anything uncertain, owners and "(proposed)" dates, drafts only (nothing is sent; Najjuko hands them round herself).

export const PEOPLE_KEY = "work_naj_people", PEOPLE_USE_KEY = "work_naj_people_use";
export const MAX_ATTENDEES = 40;

// The speech engine hears her team's names wrongly; the notes and minutes writers are told these (from the Knowledge Pack).
export const NAME_FIXES = [["Nezuko", "Najjuko"], ["Notruco", "Najjuko"], ["Juco", "Najjuko"], ["Najuko", "Najjuko"], ["Fayez", "Faez"], ["FM", "FN"], ["Gauss News", "Gulf News"], ["Barbak", "Babak"]];
export const nameFixLine = () => NAME_FIXES.map((p) => '"' + p[0] + '" means ' + p[1]).join("; ");

const clip = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
const shortRole = (r) => clip(String(r || "").split(/[;(]/)[0], 44);
// "Ruzanna \"Rose\" Avanyan" -> Rose; "Monaza (Munazza)" -> Monaza; otherwise the first word
const shortName = (n) => { const q = /"([^"]+)"/.exec(n); if (q) return q[1]; return clip(String(n).replace(/\(.*?\)/g, "").trim().split(" ")[0], 20) || clip(n, 20); };

// raw = the parsed fn-people-and-org.json (or {people:[...]}); the roster she sees: current people only, never former staff or people whose status is unconfirmed
export function cleanRoster(raw) {
  const list = raw && Array.isArray(raw.people) ? raw.people : Array.isArray(raw) ? raw : [];
  const out = [], firsts = {};
  for (const p of list) {
    const name = clip(p && p.name, 60), st = String((p && p.status) || "").toLowerCase();
    if (!name || /left|former|to confirm/.test(st) || /former staff/i.test(String(p.role || ""))) continue;
    const g = p.sales_team ? clip(String(p.sales_team).replace(/\s*\(.*\)/, ""), 24) : /freelance, independent/i.test(String(p.role || "")) ? "Independent agents" : clip(String(p.department || "Other").replace(/\s*\(.*\)/, ""), 28);
    out.push({ n: name, f: shortName(name), r: shortRole(p.role), g, tmp: /^temporary/.test(st), nick: clip(((/Known as ([^.]+)\./.exec(p.notes || "") || [])[1]) || "", 40) });
    firsts[shortName(name)] = (firsts[shortName(name)] || 0) + 1;
  }
  out.forEach((x) => { if (firsts[x.f] > 1) x.f = x.n; });   // two people with one first name: show the full name
  return out;
}

// the picker: her six most-picked people first (by the counts she has built up), the rest behind "More people"
export function pickerData(roster, uses) {
  const u = uses && typeof uses === "object" ? uses : {};
  const usual = roster.filter((x) => u[x.n] > 0).sort((a, b) => u[b.n] - u[a.n] || (a.n < b.n ? -1 : 1)).slice(0, 6).map((x) => x.n);
  return { people: roster, usual };
}

// what the page sends at Start: { n, r? , guest? }; only roster names or typed guests survive
export function cleanAttendees(arr, roster) {
  const byName = new Map((roster || []).map((x) => [x.n, x])), out = [], seen = new Set();
  for (const a of Array.isArray(arr) ? arr.slice(0, MAX_ATTENDEES) : []) {
    const n = clip(a && a.n, 60); if (!n || seen.has(n.toLowerCase())) continue; seen.add(n.toLowerCase());
    const k = byName.get(n);
    out.push(k ? { n: k.n, r: k.r } : { n, r: "", guest: true });
  }
  return out;
}

export async function bumpUses(env, attendees) {
  const real = (attendees || []).filter((a) => !a.guest); if (!real.length) return;
  let u = {}; try { u = JSON.parse(await env.MEETINGS.get(PEOPLE_USE_KEY)) || {}; } catch (e) { u = {}; }
  for (const a of real) u[a.n] = (u[a.n] || 0) + 1;
  await env.MEETINGS.put(PEOPLE_USE_KEY, JSON.stringify(u));
}
export async function loadRoster(env) {
  let raw = null; try { raw = JSON.parse(await env.MEETINGS.get(PEOPLE_KEY)); } catch (e) { raw = null; }
  let uses = {}; try { uses = JSON.parse(await env.MEETINGS.get(PEOPLE_USE_KEY)) || {}; } catch (e) { uses = {}; }
  return pickerData(cleanRoster(raw), uses);
}

// ---------------------------------------------------------------- the minutes
export const MINUTES_SCHEMA = { type: "object", additionalProperties: false, required: ["title", "purpose", "decisions", "discussion", "actions", "open_questions"], properties: {
  title: { type: "string" }, purpose: { type: "string" },
  decisions: { type: "array", items: { type: "object", additionalProperties: false, required: ["headline", "detail"], properties: { headline: { type: "string" }, detail: { type: "string" } } } },
  discussion: { type: "array", items: { type: "object", additionalProperties: false, required: ["heading", "bullets"], properties: { heading: { type: "string" }, bullets: { type: "array", items: { type: "string" } } } } },
  actions: { type: "array", items: { type: "object", additionalProperties: false, required: ["action", "owner", "due", "due_stated"], properties: { action: { type: "string" }, owner: { type: "string" }, due: { type: "string" }, due_stated: { type: "boolean" } } } },
  open_questions: { type: "array", items: { type: "string" } } } };

export function attendeeLine(att) {
  if (!att || !att.length) return "[attendees to confirm]";
  return att.map((a) => a.n + " (" + (a.r || "[role to confirm]") + ")").join(" · ");
}
export const MINUTES_SYS = "You write FN Realty's internal MEETING MINUTES for Najjuko Ganyana (Strategic Lead; she is 'Minutes by'), from an AUTOMATIC transcript and her notes. FN Realty is a boutique real-estate advisory in Business Bay, Dubai. "
  + "Rules: (1) Never invent names, roles, figures, dates, decisions or quotes. Anything uncertain stays in the text as '[to confirm]' and is ALSO listed in open_questions. "
  + "(2) A key decision is something clearly AGREED; an idea that was only floated is written as 'proposed by <name>' in the discussion, not as a decision. "
  + "(3) Plain, formal English that is easy for non-native speakers; third person for decisions ('FN will...'); short enough to read in five minutes. "
  + "(4) Figures or claims said in the meeting (for example team numbers) are marked 'to verify before public use'. "
  + "(5) Personal, health, pay or private matters that are not business decisions stay OUT. "
  + "(6) The speech engine mishears names: " + nameFixLine() + ". Spell names as in the attendee list when they are close; a name not in the list stays as heard with '[surname / role to confirm]'. "
  + "Fill: title (the meeting topic, no 'Meeting Minutes:' prefix); purpose (one sentence); decisions (headline in a few words + one or two sentences); discussion (numbered-topic headings, each with short bullets); "
  + "actions (each starts with a verb; owner = a person's name or '' if not stated; due = the date as said, or your suggestion if none was given; due_stated = true only if the meeting itself gave the date); open_questions (what still needs an answer).";

const cap = (a, k, n) => (Array.isArray(a) ? a : []).slice(0, k).map((v) => clip(v, n)).filter(Boolean);
export function normMinutes(x) {
  if (!x || typeof x !== "object") return null;
  return { title: clip(x.title, 120), purpose: clip(x.purpose, 300),
    decisions: (Array.isArray(x.decisions) ? x.decisions : []).slice(0, 15).map((d) => ({ headline: clip(d && d.headline, 120), detail: clip(d && d.detail, 500) })).filter((d) => d.headline),
    discussion: (Array.isArray(x.discussion) ? x.discussion : []).slice(0, 12).map((d) => ({ heading: clip(d && d.heading, 120), bullets: cap(d && d.bullets, 10, 400) })).filter((d) => d.heading),
    actions: (Array.isArray(x.actions) ? x.actions : []).slice(0, 25).map((a) => ({ action: clip(a && a.action, 300), owner: clip(a && a.owner, 60), due: clip(a && a.due, 60), due_stated: !!(a && a.due_stated) })).filter((a) => a.action),
    open_questions: cap(x.open_questions, 15, 300) };
}

export async function buildMinutes(env, deps, m, notes, transcript) {
  const att = attendeeLine(m.attendees);
  const body = "Date: " + m.date + "\nAttendees: " + att + "\nMeeting: " + (m.title || "untitled") + " (" + Math.round((m.secs || 0) / 60) + " minutes)\n"
    + (notes ? "\nHer notes (already written from this recording):\nSummary: " + notes.summary + "\nDecisions: " + (notes.decisions || []).join("; ") + "\nTasks: " + (notes.actions || []).map((a) => a.what + (a.owner ? " (" + a.owner + ")" : "") + (a.due ? " by " + a.due : "")).join("; ") + "\n" : "")
    + "\nTranscript:\n" + String(transcript || "").slice(0, 60000);
  let x = null; try { x = await deps.claudeJSON(env, MINUTES_SYS, body, MINUTES_SCHEMA, deps.model, 6000); } catch (e) { x = null; }
  return normMinutes(x);
}

// ---------------------------------------------------------------- the page
const escH = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
const mark = (s) => escH(s).replace(/\[[^\]\n]{1,80}\]/g, (t) => "<mark>" + t + "</mark>");   // [to confirm] shows yellow so she can see what to check
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function longDate(iso) { const d = new Date(String(iso) + "T12:00:00Z"); return isNaN(d) ? String(iso || "") : DAYS[d.getUTCDay()] + " " + d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear(); }
export const FOOTER = "CONFIDENTIAL · FN Realty internal use only. Not to be copied, distributed, modified, reissued or shared outside FN Realty without prior written approval from FN Realty management. © 2026 FN Realty. All rights reserved.";
export const dueText = (a) => a.due_stated && a.due ? a.due : a.due ? a.due + " (proposed)" : "[to confirm]";

export function minutesPlainText(m, mn) {
  const L = ["Meeting Minutes: " + (mn.title || m.title || "Meeting"), "FN Realty · Internal", "", "Date: " + longDate(m.date), "Attendees: " + attendeeLine(m.attendees), "Purpose: " + mn.purpose, "Minutes by: Najjuko Ganyana", "", "1. Key decisions"];
  mn.decisions.forEach((d, i) => L.push((i + 1) + ". " + d.headline + ". " + d.detail));
  L.push("", "2. Discussion summary"); mn.discussion.forEach((d, i) => { L.push("2." + (i + 1) + " " + d.heading); d.bullets.forEach((b) => L.push("- " + b)); });
  L.push("", "3. Action items"); mn.actions.forEach((a, i) => L.push((i + 1) + ". " + a.action + " | " + (a.owner || "[to confirm]") + " | " + dueText(a)));
  L.push("", "4. Open questions"); mn.open_questions.forEach((q, i) => L.push((i + 1) + ". " + q));
  L.push("", FOOTER); return L.join("\n");
}

export function renderMinutes(m, mn, key) {
  const back = "/momo/work?key=" + encodeURIComponent(key || "");
  const row = (cells) => "<tr>" + cells.map((c) => "<td>" + c + "</td>").join("") + "</tr>";
  const sheet = "<h1>Meeting Minutes: " + mark(mn.title || m.title || "Meeting") + "</h1><div class=org>FN Realty · Internal</div>"
    + "<dl><dt>Date</dt><dd>" + escH(longDate(m.date)) + "</dd><dt>Attendees</dt><dd>" + mark(attendeeLine(m.attendees)) + "</dd><dt>Purpose</dt><dd>" + mark(mn.purpose) + "</dd><dt>Minutes by</dt><dd>Najjuko Ganyana</dd></dl>"
    + "<h2>1. Key decisions</h2>" + (mn.decisions.length ? "<table><tr><th class=n>#</th><th>Decision</th></tr>" + mn.decisions.map((d, i) => row([i + 1, "<b>" + mark(d.headline) + ".</b> " + mark(d.detail)])).join("") + "</table>" : "<p class=m>No decision was clearly agreed. [to confirm]</p>".replace(/\[[^\]]+\]/, (t) => "<mark>" + t + "</mark>"))
    + "<h2>2. Discussion summary</h2>" + mn.discussion.map((d, i) => "<h3>2." + (i + 1) + " " + mark(d.heading) + "</h3><ul>" + d.bullets.map((b) => "<li>" + mark(b) + "</li>").join("") + "</ul>").join("")
    + "<h2>3. Action items</h2>" + (mn.actions.length ? "<table><tr><th class=n>#</th><th>Action</th><th>Owner</th><th>Due</th></tr>" + mn.actions.map((a, i) => row([i + 1, mark(a.action), a.owner ? mark(a.owner) : "<mark>[to confirm]</mark>", mark(dueText(a))])).join("") + "</table>" : "<p class=m>No actions were set.</p>")
    + "<h2>4. Open questions</h2>" + (mn.open_questions.length ? "<ol>" + mn.open_questions.map((q) => "<li>" + mark(q) + "</li>").join("") + "</ol>" : "<p class=m>None.</p>");
  const bar = "<div class=bar><a class=bk href='" + back + "' onclick=\"if(history.length>1){history.back();return false}\">&#8592; Back</a><span class=sp></span><button class=bt id=ed>Edit</button><button class=bt id=sv>Share</button><button class='bt pr' onclick='print()'>Share / Save as PDF</button></div>";
  const note = "<div class=hint>A draft written from the recording. Yellow means Momo is not sure: check it, tap Edit to fix it, then save the PDF and send it round yourself. Momo sends nothing.</div>";
  const js = "<script>var T=" + JSON.stringify(minutesPlainText(m, mn)).replace(/</g, "\\u003c") + ";var e=document.getElementById('ed'),s=document.getElementById('sheet');e.onclick=function(){var on=s.getAttribute('contenteditable')==='true';s.setAttribute('contenteditable',on?'false':'true');e.textContent=on?'Edit':'Done';if(!on)s.focus()};document.getElementById('sv').onclick=function(){var t=s.innerText||T,d={title:document.title,text:t};if(navigator.share){navigator.share(d).catch(function(){})}else if(navigator.clipboard){navigator.clipboard.writeText(t).then(function(){alert('Copied. Paste it where you want it.')})}else{alert('Use Share / Save as PDF')}}</script>";
  const css = "body{font:15px/1.5 Inter,'IBM Plex Sans',system-ui,sans-serif;color:#202020;background:#F9F1EF;margin:0;padding:0 14px 90px}.w{max-width:760px;margin:0 auto}.bar{position:sticky;top:0;z-index:5;background:#F9F1EF;display:flex;align-items:center;gap:8px;padding:10px 0;max-width:760px;margin:0 auto;border-bottom:1px solid #E3D6CC}.sp{flex:1}.bk{color:#1F2B44;text-decoration:none;font-weight:600;padding:8px 10px}.bt{font:inherit;font-size:.88rem;padding:9px 12px;border-radius:12px;border:1px solid #1F2B44;background:#fff;color:#1F2B44}.bt.pr{background:#1F2B44;color:#fff}"
    + ".hint{background:#fff;border:1px solid #C9A97A;border-radius:12px;padding:10px 12px;font-size:.85rem;color:#626B78;margin:12px 0}#sheet{background:#fff;border:1px solid #E3D6CC;border-radius:6px;padding:22px 20px;margin-top:6px}#sheet[contenteditable=true]{outline:2px solid #C9A97A}"
    + "h1{font-size:1.35rem;color:#1F2B44;margin:0 0 2px}.org{color:#8A6F3E;font-size:.85rem;margin-bottom:12px}h2{font-size:1.05rem;color:#1F2B44;margin:22px 0 6px;border-bottom:1px solid #C9A97A;padding-bottom:3px}h3{font-size:.95rem;margin:14px 0 4px;color:#1F2B44}dl{margin:0}dt{font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;color:#8A6F3E;margin-top:8px}dd{margin:0}"
    + "table{width:100%;border-collapse:collapse}th{font-size:.75rem;text-align:left;color:#626B78;border-bottom:1px solid #C9A97A;padding:4px}td{border-bottom:1px solid #EFE6DD;padding:6px 4px;vertical-align:top}.n{width:28px}.m{color:#626B78}ul,ol{margin:4px 0;padding-left:20px}mark{background:#FFF1C9;border-radius:3px;padding:0 2px}.foot{font-size:.68rem;color:#8d939c;margin:18px 0 0;border-top:1px solid #E3D6CC;padding-top:8px}"
    + "@media print{body{background:#fff;padding:0 0 46px}.bar,.hint{display:none}#sheet{border:0;padding:0;margin:0}mark{background:none}h2,h3{break-after:avoid}tr{break-inside:avoid}.foot{position:fixed;left:0;right:0;bottom:0;margin:0;background:#fff}}";
  return "<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>" + escH("FN Realty – Meeting Minutes – " + (mn.title || m.title || "Meeting") + " – " + longDate(m.date)) + "</title><meta name=robots content=noindex><style>" + css + "</style></head><body>" + bar + "<div class=w>" + note + "<div id=sheet>" + sheet + "</div><div class=foot>" + escH(FOOTER) + "</div></div>" + js + "</body></html>";
}
