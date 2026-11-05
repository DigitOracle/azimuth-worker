// v764 MEETING SYNC (Kendall, 5 Nov 2026: "a sync button for every meeting ... it needs to go into that Google Sheet and figure out if
// something is changing ... it really needs to think about what it's doing"). A meeting can move a post, drop one or add one, not only touch tasks.
// Sync reads the meeting (the Work entry, or a recording's minutes), her open tasks and the Content planner items from 7 days back to 60 ahead,
// and asks the writer for PROPOSED changes. Nothing is applied here: she ticks each change on a review sheet, then "Apply selected".
// Rules held in code, not only in the prompt: a planner change must name a code that exists in the window (a code is never invented; no code =
// a question); every change cites a numbered line of the meeting and the line must contain the quote; "next week" and other vague timing is a
// question, not a date; a change is pre-ticked only when it is certain. Planner writes go through applyAction (the same path as the page and
// the bridge, so every change lands in the item's log). An item that came from the sheet is queued in cp_sheet_pending; with the Google
// connection it is pushed with sheetPush (the existing cell-by-cell preview, then write, then the Change log tab); without it her Claude Code
// reads planner/pending on the bridge, writes the sheet, and marks each one done.
import { readItems, applyAction, sheetPush, fmtDay } from "./content_planner.js";
import { matchMeeting } from "./meeting_match.js";   // v781 - the meeting -> planner matcher (no model)

const PEND = "cp_sheet_pending";
const okD = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ""));
const okT = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t || ""));
const addDays = (d, n) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const today = () => new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10);
const TYPES = ["planner_move", "planner_edit", "planner_new", "planner_hold", "task_update", "task_new", "planner_set"];
const EDITABLE = ["format", "topic", "developer", "who", "how", "story_type", "pillar", "series", "cta", "campaign", "note"];
const STAT = ["Started", "In progress", "Stuck", "Done"];

export const SYNC_SCHEMA = { type: "object", additionalProperties: false, required: ["changes"], properties: { changes: { type: "array", items: {
  type: "object", additionalProperties: false,
  required: ["type", "code", "task", "field", "value", "date", "time", "status", "percent", "item_kind", "format", "topic", "line", "quote", "certain", "question"],
  properties: { type: { type: "string", enum: TYPES }, code: { type: "string" }, task: { type: "string" }, field: { type: "string" }, value: { type: "string" },
    date: { type: "string" }, time: { type: "string" }, status: { type: "string" }, percent: { type: "integer" }, item_kind: { type: "string" }, format: { type: "string" },
    topic: { type: "string" }, line: { type: "integer" }, quote: { type: "string" }, certain: { type: "boolean" }, question: { type: "string" } } } } } };

// the meeting as numbered lines, so each change can point at the line it came from
export function meetingLines(src) {
  const parts = [];
  const push = (t) => String(t || "").split(/\n+|(?<=[.!?])\s+(?=[A-Z])/).map((x) => x.replace(/\s+/g, " ").trim()).filter((x) => x.length > 2).forEach((x) => parts.push(x.slice(0, 400)));
  if (src.kind === "entry") {
    const e = src.entry || {};
    push(e.title); push(e.summary); push(e.text);
    (e.deliverables || []).forEach((d) => push("Produced: " + d)); (e.next || []).forEach((d) => push("Next: " + d));
    (e.progress || []).forEach((p) => push("Task " + p.work + ": " + p.status + " " + p.percent + "%"));
  } else {
    const m = src.rec || {}, mn = m.minutes || {};
    push(m.title); if (m.notes && m.notes.summary) push(m.notes.summary);
    const walk = (v, depth) => { if (depth > 4 || v == null) return; if (typeof v === "string") push(v); else if (Array.isArray(v)) v.forEach((x) => walk(x, depth + 1)); else if (typeof v === "object") Object.keys(v).forEach((k) => walk(v[k], depth + 1)); };
    walk(mn, 0);
  }
  const seen = new Set(); return parts.filter((x) => { const k = x.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 220);
}

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// v773 PROACTIVE SYNC (Kendall, 5 Nov 2026: "when she mentions ... campaign, anything to do with posting ... a series of pop-ups ... during the
// meeting you said you were changing such and such to such and such. Is this the case? And I will update your content calendar").
// When she opens Work, each meeting of the last 3 days is read ONCE: if its record mentions content (the words below, a planner code that
// exists, a developer or topic from the planner, or a team member), the same Sync analysis runs and the certain, applicable changes are kept
// in ms_auto. Work then asks about them one at a time. Yes = the same syncApply path (planner log, sheet queue/write-back); No = remembered,
// never asked again; Change = opens the item. Nothing is applied without her Yes. In-app only: nothing is sent to anyone.
export const AUTO = "ms_auto";
const CONTENT_RX = /\b(campaigns?|post(s|ed|ing)?|reels?|stor(y|ies)|carousels?|feed|shoot(s|ing)?|shot|captions?|publish(ed|ing)?|schedul(e|ed|ing)|calendar|content|go(es)? live|instagram|tiktok|linkedin)\b/i;
const CODE_RX = /\b[A-Z]{2,4}-\d{1,4}\b/g;
export function contentHit(lines, items, team) {
  const text = (lines || []).join(" \n "), low = " " + norm(text) + " ", hits = [];
  const w = text.match(CONTENT_RX); if (w) hits.push(w[0].toLowerCase());
  const codes = new Set((items || []).map((i) => String(i.code || "").toUpperCase()));
  (text.match(CODE_RX) || []).forEach((c) => { if (codes.has(c.toUpperCase())) hits.push(c.toUpperCase()); });
  const names = new Set();
  (items || []).forEach((i) => { [i.developer, i.topic].forEach((v) => { const n = norm(v); if (n.length >= 5) names.add(n); }); });
  (team || []).forEach((t) => { const n = norm(t && t.name ? t.name : t); if (n.length >= 3) names.add(n); });
  for (const n of names) if (low.indexOf(" " + n + " ") >= 0) { hits.push(n); if (hits.length > 6) break; }
  return [...new Set(hits)];
}
async function getAuto(env) { try { return JSON.parse((await env.MEETINGS.get(AUTO)) || "{}") || {}; } catch (e) { return {}; } }
async function putAuto(env, o) {
  const ks = Object.keys(o).sort((a, b) => String(o[b].at || "").localeCompare(String(o[a].at || ""))).slice(0, 60), out = {};
  ks.forEach((k) => { out[k] = o[k]; }); await env.MEETINGS.put(AUTO, JSON.stringify(out));
}
// scan: meetings = [{key, src, title, date}] newest first. At most `max` new meetings are read per call (one writer call each).
export async function autoScan(env, deps, meetings, tasks, team, max) {
  const A = await getAuto(env), items = await readItems(env); let read = 0;
  for (const m of meetings) {
    const prev = A[m.key];
    const rec = m.src && m.src.entry && m.src.entry.rec ? String(m.src.entry.rec) : "";
    if (prev && (prev.v === 3 || (!rec && prev.v === 2))) continue;   // v782a - recordings read again once for meeting promises (answers kept)   // v781 - a recording's meeting read by the older scan is read again with the matcher
    if (read >= (max || 2)) continue;
    // v781 - the matcher reads what was SAID (the transcript), not the summary, so day words and names survive
    if (rec) {
      let text = ""; try { const ks = (await env.MEETINGS.list({ prefix: "recs_" + rec + "_" })).keys.map((k) => k.name).sort();
        for (const k of ks) { try { const d = JSON.parse((await env.MEETINGS.get(k)) || "null"); if (d && d.text) text += " " + d.text; } catch (x) {} } } catch (x) {}
      if (text.trim().length > 40) {
        read++;
        const P = matchMeeting(text, m.date, items, { team });
        A[m.key] = { v: 3, at: new Date().toISOString(), title: m.title, date: m.date, hits: ["matcher"], changes: P.map((x) => Object.assign({ type: "match", ok: true, certain: x.cls === "sure" }, x)), ans: (prev && prev.ans) || {} };
        continue;
      }
    }
    const lines = meetingLines(m.src), hits = contentHit(lines, items, team);
    if (!hits.length) { A[m.key] = { v: 2, at: new Date().toISOString(), title: m.title, date: m.date, hits: [], changes: [] }; continue; }
    read++;
    const r = await syncPropose(env, deps, m.src, tasks);
    if (!r.ok) continue;   // not stored: tried again next time Work opens
    const keep = (r.changes || []).filter((c) => c.ok && c.certain);
    A[m.key] = { v: 2, at: new Date().toISOString(), title: m.title, date: m.date, hits, changes: keep, ans: {} };
  }
  await putAuto(env, A);
  return autoOpen(A);
}
export function autoOpen(A) {
  const out = [];
  Object.keys(A).forEach((k) => { const a = A[k]; (a.changes || []).forEach((c) => { if (!(a.ans && a.ans[c.id])) out.push({ meeting: k, title: a.title, date: a.date, change: c }); }); });
  return out.sort((x, y) => String(y.date).localeCompare(String(x.date)));
}
export async function autoAnswer(env, meeting, id, answer) {
  const A = await getAuto(env), a = A[meeting]; if (!a) return [404, { ok: false, error: "That meeting is not waiting for an answer." }];
  const c = (a.changes || []).find((x) => x.id === id); if (!c) return [404, { ok: false, error: "That change is not waiting for an answer." }];
  if (a.ans && a.ans[id]) return [200, { ok: true, already: a.ans[id], change: c, meeting: a }];
  a.ans = a.ans || {}; a.ans[id] = ["yes", "replace", "move", "keep", "add", "repeat"].includes(answer) ? answer : "no"; await putAuto(env, A);
  return [200, { ok: true, change: c, meeting: a }];
}
export async function autoBadges(env) { const A = await getAuto(env), n = {}; autoOpen(A).forEach((x) => { n[x.meeting] = (n[x.meeting] || 0) + 1; }); return n; }
export function itemLine(it) { return [it.code, fmtDay(it.date), it.time, it.kind === "story" ? "story" : (it.format || "feed post"), it.topic, it.developer ? "(" + it.developer + ")" : ""].filter(Boolean).join(" · "); }

// the model's list, checked against what is really stored
export function checkChanges(raw, lines, items, tasks) {
  const byCode = {}; items.forEach((i) => { byCode[i.code] = i; });
  const tnames = {}; (tasks || []).forEach((t) => { tnames[norm(t.name)] = t.name; });
  return (Array.isArray(raw) ? raw : []).slice(0, 40).map((c, i) => {
    const x = { id: "c" + i, type: TYPES.includes(c.type) ? c.type : "", code: String(c.code || "").toUpperCase().trim(), task: String(c.task || "").slice(0, 80).trim(), field: String(c.field || ""), value: String(c.value || "").slice(0, 400),
      date: okD(c.date) ? c.date : "", time: okT(c.time) ? c.time : "", status: STAT.includes(c.status) ? c.status : "", percent: Math.max(0, Math.min(100, Math.round(+c.percent || 0))),
      item_kind: c.item_kind === "story" ? "story" : "feed", format: ["Reel", "Carousel", "Static"].includes(c.format) ? c.format : "", topic: String(c.topic || "").slice(0, 200),
      line: Math.round(+c.line || 0), quote: String(c.quote || "").slice(0, 300), question: String(c.question || "").slice(0, 300), certain: !!c.certain, problems: [] };
    if (!x.type) x.problems.push("Unknown kind of change.");
    const ln = lines[x.line - 1] || "";
    if (!ln) x.problems.push("It does not point at a line of the meeting.");
    else if (x.quote && norm(ln).indexOf(norm(x.quote).slice(0, 60)) < 0) x.problems.push("The quoted words are not on that line.");
    x.line_text = ln;
    if (/^planner_(move|edit|hold)$/.test(x.type)) {
      const it = byCode[x.code];
      if (!it) { x.problems.push(x.code ? "No planner item " + x.code + " in the window: Momo never makes up a code." : "No planner item named: which post is it?"); x.code = ""; }
      else x.match = itemLine(it);
      if (x.type === "planner_move") { if (!x.date && !x.time) x.problems.push("No new date or time given."); if (it) { x.from = [fmtDay(it.date), it.time].filter(Boolean).join(" "); } }
      if (x.type === "planner_edit" && !EDITABLE.includes(x.field)) x.problems.push("That field cannot be changed from a meeting.");
    }
    if (x.type === "planner_new") { x.code = ""; if (!x.date) x.problems.push("No date for the new post."); if (!x.topic) x.problems.push("No topic for the new post."); }
    if (x.type === "task_update") { const t = tnames[norm(x.task)]; if (!t) x.problems.push("No task called “" + x.task + "”."); else x.task = t; if (!x.status) x.problems.push("No status given."); }
    if (x.type === "task_new" && !x.task) x.problems.push("The new task has no name.");
    if (x.question) x.problems.push(x.question);
    x.certain = x.certain && !x.problems.length;
    x.ok = !x.problems.some((p) => p !== x.question) || (x.type === "planner_new" && !!x.date && !!x.topic) || (x.type === "task_new" && !!x.task);
    return x;
  }).filter((x) => x.type);
}

const SYS = "You read the record of ONE meeting held by Najjuko (marketing lead at FN Realty, a Dubai brokerage) and propose changes it implies to her content planner (posts and stories) and her task list. " +
  "Propose ONLY what the meeting actually says: a post moved to another day or time (planner_move), a post's detail changed (planner_edit: field is one of " + EDITABLE.join(", ") + "), a new post agreed (planner_new), a post dropped, paused or cancelled (planner_hold), a task's status changed (task_update: status is one of " + STAT.join(", ") + "), or a new task agreed (task_new). " +
  "MATCHING: a planner change must use the exact code of an item in the planner list given. Match by code if the meeting says it; otherwise by topic, developer, format and date together. If two items could fit, or none clearly fits, leave code empty and write the doubt in question. Never invent a code. " +
  "DATES: write dates as YYYY-MM-DD and times as HH:MM, Dubai time, only when the meeting makes them certain (today's date is given, so 'Thursday' means the next Thursday on or after today). 'Next week', 'later', 'soon' or 'after the launch' are not dates: leave date empty and ask in question. " +
  "Every change cites line = the number of the meeting line it comes from, and quote = a few words copied exactly from that line. certain = true only when the item match and the new value are both beyond doubt. Unused fields are empty strings, percent 0. If the meeting implies no change, return an empty list.";

export async function syncPropose(env, deps, src, tasks) {
  const lines = meetingLines(src); if (lines.length < 2) return { ok: false, error: "There is not enough in this meeting to read yet." };
  const t0 = today(), from = addDays(t0, -7), to = addDays(t0, 60);
  const items = (await readItems(env)).filter((i) => !i.date || (i.date >= from && i.date <= to));
  const open = (tasks || []).filter((t) => t.status !== "Done").slice(0, 80);
  const user = "Today: " + t0 + " (" + fmtDay(t0) + ").\n\nMEETING LINES:\n" + lines.map((l, i) => (i + 1) + ". " + l).join("\n")
    + "\n\nPLANNER ITEMS (" + from + " to " + to + "):\n" + (items.length ? items.map((i) => JSON.stringify({ code: i.code, kind: i.kind, date: i.date, time: i.time, format: i.format, topic: i.topic, developer: i.developer, who: i.who, how: i.how, note: String(i.note || "").slice(0, 80) })).join("\n") : "(none yet)")
    + "\n\nOPEN TASKS:\n" + (open.length ? open.map((t) => "- " + t.name + " (" + t.status + ", " + t.percent + "%)").join("\n") : "(none)");
  let x = null; try { x = await deps.claudeJSON(env, SYS, user, SYNC_SCHEMA, deps.model, 3000); } catch (e) {}
  if (!x) return { ok: false, error: "Momo could not read the meeting just now. Nothing was changed: try Sync again." };
  return { ok: true, lines, changes: checkChanges(x.changes, lines, items, tasks), window: { from, to, items: items.length } };
}

async function getPend(env) { try { return JSON.parse((await env.MEETINGS.get(PEND)) || "[]"); } catch (e) { return []; } }
async function putPend(env, a) { await env.MEETINGS.put(PEND, JSON.stringify(a.slice(-300))); }
async function sheetRef(env, code) { try { const sm = JSON.parse((await env.MEETINGS.get("cp_sheetmap")) || "null"); return sm && sm.ref && sm.ref[code] || null; } catch (e) { return null; } }

// apply only what she ticked. hooks: { taskUpdate(name, status, percent), taskNew(name) } come from work_log.js (its own task store)
// v781 - a matcher proposal + her answer -> the planner / task changes syncApply makes. Her edits (time 14:00 -> 16:00, topic, format, who,
// day) always win over what was read from the meeting.
const SETF = ["date", "time", "topic", "format", "story_type", "who", "series", "developer"];
export function matchToChanges(c, answer, edits, items) {
  const f = Object.assign({}, c.fields || {}), e = edits && typeof edits === "object" ? edits : {};
  SETF.forEach((k) => { if (e[k] != null && String(e[k]).trim() !== "") f[k] = String(e[k]).slice(0, 300); });
  const day = okD(e.date) ? e.date : c.date, out = [], quote = c.quote || "";
  const newItem = (d) => ({ type: "planner_new", item_kind: c.kind === "story" ? "story" : "feed", date: d, time: okT(f.time) ? f.time : "", format: f.format || "", topic: f.topic || "", quote });
  if (c.cls === "task") return [{ type: "task_new", task: String(e.task || c.task || "Follow up from the meeting").slice(0, 80), owner: String(e.owner || c.owner || "").slice(0, 40), due: okD(e.due) ? e.due : (okD(c.due) ? c.due : ""), quote }];
  if (c.cls === "new" || answer === "add") return [newItem(day)];
  if (c.cls === "recurring" || answer === "repeat") {
    const start = okD(c.date) ? c.date : today();
    for (let w = 0; w < 8; w++) {
      let d = addDays(start, 7 * w); if (c.weekday != null) { for (let i = 0; i < 7 && new Date(d + "T00:00:00Z").getUTCDay() !== c.weekday; i++) d = addDays(d, 1); }
      const slot = (items || []).find((i) => i.date === d && i.kind === (c.kind || "story") && (!f.story_type || i.story_type === f.story_type));
      if (slot) out.push({ type: "planner_set", code: slot.code, fields: Object.assign({}, f, { date: undefined }), quote }); else out.push(newItem(d));
    }
    return out;
  }
  if (c.skip) return [{ type: "planner_hold", code: c.code, quote }];
  if (answer === "keep") return [newItem(day)];
  if (answer === "move") { const md = okD(e.move_date) ? e.move_date : ""; if (!md) return []; return [{ type: "planner_move", code: c.code, date: md, quote }, newItem(day)]; }
  // yes / replace: the matched item takes the meeting's plan (and her edits)
  return [{ type: "planner_set", code: c.code, fields: Object.assign({}, f, okD(e.date) ? { date: e.date } : {}), quote }];
}
export async function syncApply(env, changes, why, hooks) {
  const who = "From meeting " + String(why || "").slice(0, 120), done = [], failed = [], pend = await getPend(env);
  for (const c of (Array.isArray(changes) ? changes : []).slice(0, 40)) {
    let r = null;
    try {
      if (c.type === "planner_set") { const fx = {}; Object.keys(c.fields || {}).forEach((k) => { if (c.fields[k] != null && (EDITABLE.includes(k) || k === "date" || k === "time")) fx[k] = String(c.fields[k]); }); if (fx.date && !okD(fx.date)) delete fx.date; if (fx.time && !okT(fx.time)) delete fx.time; r = await applyAction(env, Object.assign({ action: "save", code: String(c.code || "").toUpperCase() }, fx), who); }
      else if (c.type === "planner_move") r = await applyAction(env, Object.assign({ action: "save", code: c.code }, okD(c.date) ? { date: c.date } : {}, okT(c.time) ? { time: c.time } : {}), who);
      else if (c.type === "planner_edit" && EDITABLE.includes(c.field)) r = await applyAction(env, { action: "save", code: c.code, [c.field]: String(c.value || "") }, who);
      else if (c.type === "planner_hold") {
        const it = (await readItems(env)).find((i) => i.code === String(c.code || "").toUpperCase());
        r = it ? await applyAction(env, { action: "save", code: it.code, note: ("ON HOLD (" + String(why || "meeting").slice(0, 80) + "): " + String(c.quote || "").slice(0, 120) + (it.note ? " | " + it.note : "")).slice(0, 400) }, who) : [404, { error: "No item." }];
      } else if (c.type === "planner_new") r = await applyAction(env, { action: "save", kind: c.item_kind === "story" ? "story" : "feed", date: okD(c.date) ? c.date : "", time: okT(c.time) ? c.time : "", format: c.format || "", topic: String(c.topic || "").slice(0, 300), note: "Agreed in meeting " + String(why || "").slice(0, 120), added: true }, who);
      else if (c.type === "task_update") r = await hooks.taskUpdate(String(c.task || ""), c.status, c.percent);
      else if (c.type === "task_new") r = await hooks.taskNew(String(c.task || ""), String(c.owner || ""), String(c.due || ""));
    } catch (e) { r = [500, { error: String(e.message || e).slice(0, 120) }]; }
    const okk = r && r[0] < 300;
    (okk ? done : failed).push({ id: c.id, type: c.type, code: (okk && r[1] && r[1].item && r[1].item.code) || c.code || "", task: c.task || "", error: okk ? "" : (r && r[1] && r[1].error) || "Not applied." });
    if (okk && /^planner_/.test(c.type)) {
      const code = (r[1] && r[1].item && r[1].item.code) || c.code; const ref = code ? await sheetRef(env, code) : null;
      if (ref && !pend.some((p) => p.code === code)) pend.push({ code, tab: ref.tab, row: ref.row, why: String(why || "").slice(0, 160), at: new Date().toISOString() });
      if (!ref && c.type === "planner_new") done[done.length - 1].note = "New in Momo: add its row to the sheet.";
    }
  }
  await putPend(env, pend);
  return { ok: true, done, failed, pending: pend.map((p) => p.code) };
}

// the sheet side: preview / push one queued item (the existing write-back), or list the queue for the bridge
export async function syncSheet(env, code, apply, who) {
  code = String(code || "").toUpperCase(); const pend = await getPend(env), p = pend.find((x) => x.code === code);
  const r = await sheetPush(env, code, !!apply, who, p ? "From meeting " + p.why : "Changed in Momo");
  if (apply && r[0] < 300) await putPend(env, pend.filter((x) => x.code !== code));
  return r;
}
export async function pendingList(env) {
  const pend = await getPend(env), items = await readItems(env), by = {}; items.forEach((i) => { by[i.code] = i; });
  return pend.map((p) => ({ ...p, item: by[p.code] ? { code: p.code, kind: by[p.code].kind, date: by[p.code].date, time: by[p.code].time, format: by[p.code].format, topic: by[p.code].topic, developer: by[p.code].developer, who: by[p.code].who, how: by[p.code].how, note: by[p.code].note } : null }));
}
export async function pendingDone(env, code) {
  code = String(code || "").toUpperCase(); const pend = await getPend(env);
  if (!pend.some((p) => p.code === code)) return [404, { ok: false, code: "not_found", error: "Nothing pending for " + code + "." }];
  await putPend(env, pend.filter((p) => p.code !== code)); return [200, { ok: true, data: { code } }];
}

// the client: a Sync button on each Meeting entry (data-sy="<date>_<id>") and on the minutes page (?sync=rec:<id>); one review sheet
export const SYNC_JS = String.raw`;(function(){
var K=(new URLSearchParams(location.search)).get("key")||"";
function sapi(o){return fetch("/momo/work/api?key="+encodeURIComponent(K),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(o)}).then(function(r){return r.json()})}
function h(s){return String(s==null?"":s).replace(/[<>&"]/g,function(c){return {"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;"}[c]})}
var IC={move:'<path d="M5 12h14M13 6l6 6-6 6"/>',edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/>',add:'<path d="M12 5v14M5 12h14"/>',hold:'<path d="M9 5v14M15 5v14"/>',task:'<path d="M4 12l5 5L20 6"/>',q:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14M12 17.5v.01"/>',sync:'<path d="M20 11a8 8 0 0 0-14-4.5L4 9M4 13a8 8 0 0 0 14 4.5l2-2.5"/><path d="M4 4v5h5M20 20v-5h-5"/>'};
function ic(k){return '<svg viewBox="0 0 24 24" width=18 height=18 fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden=true>'+IC[k]+'</svg>'}
var css=document.createElement("style");css.textContent=".sys{position:fixed;inset:0;background:rgba(28,40,38,.35);z-index:80;display:flex;align-items:flex-end;justify-content:center}.syp{background:#FAF6EE;width:100%;max-width:560px;max-height:92vh;overflow:auto;border-radius:20px 20px 0 0;padding:18px 16px 22px;box-sizing:border-box;color:#1C2826;font-family:'IBM Plex Sans',sans-serif}.syp h2{font:600 1.25rem Fraunces,serif;color:#0A4F4A;margin:0 0 4px}.syp .sub{font-size:.82rem;color:#5F6B66;margin:0 0 12px}.syc{display:flex;gap:10px;border:1px solid #E7E1D6;background:#FFFDF9;border-radius:14px;padding:12px;margin:8px 0}.syc.q{border-color:#C5A56A}.syc input{width:22px;height:22px;flex:0 0 22px;accent-color:#0A4F4A;margin-top:2px}.syc .i{flex:0 0 30px;height:30px;border-radius:9px;background:#0A4F4A;color:#fff;display:flex;align-items:center;justify-content:center}.syc.q .i{background:#C5A56A}.syc b{display:block;font-size:.95rem;color:#0A4F4A}.syc .m,.syc .ln,.syc .pb{display:block}.syc .m{font-size:.8rem;color:#5F6B66;margin-top:3px}.syc .ln{font-size:.78rem;color:#8A6F3E;margin-top:5px;font-style:italic}.syc .pb{font-size:.8rem;color:#8A3E3E;margin-top:4px}.syb{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.syb button,.sybtn{border:1px solid #0A4F4A;background:#fff;color:#0A4F4A;border-radius:999px;padding:11px;font:600 .9rem 'IBM Plex Sans',sans-serif;cursor:pointer}.syb .go{background:#0A4F4A;color:#fff}.sybtn{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;font-size:.8rem;margin:8px 6px 2px 0}.syr{font-size:.86rem;margin:6px 0}.sye{text-align:center;color:#5F6B66;padding:26px 8px}";document.head.appendChild(css);
var SRC=null,CH=[],WHY="";
function close(){var s=document.getElementById("sy_s");if(s)s.remove()}
function shell(inner){close();var s=document.createElement("div");s.className="sys";s.id="sy_s";s.innerHTML='<div class=syp role=dialog aria-modal=true aria-label="Sync this meeting">'+inner+'</div>';s.onclick=function(e){if(e.target===s)close()};document.body.appendChild(s);return s}
var MO=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],DW=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];function fd(d){if(!d)return "";var x=new Date(d+"T00:00:00Z");return DW[x.getUTCDay()]+" "+x.getUTCDate()+" "+MO[x.getUTCMonth()]}
function title(c){var t=c.type;if(t==="planner_move")return "Move "+(c.code||"a post")+(c.from?" from "+c.from:"")+" to "+[fd(c.date),c.time].filter(Boolean).join(" ");if(t==="planner_edit")return "Change "+(c.code||"a post")+": "+c.field+" to “"+c.value+"”";if(t==="planner_new")return "New "+(c.item_kind==="story"?"story":(c.format||"post"))+(c.date?" on "+fd(c.date)+(c.time?" "+c.time:""):", day not set")+": "+c.topic;if(t==="planner_hold")return "Put "+(c.code||"a post")+" on hold";if(t==="task_update")return "Task “"+c.task+"”: "+c.status+(c.percent?" ("+c.percent+"%)":"");return "New task: “"+c.task+"”"}
function kind(c){return {planner_move:"move",planner_edit:"edit",planner_new:"add",planner_hold:"hold",task_update:"task",task_new:"task"}[c.type]||"q"}
function card(c,i){var q=!c.certain;return '<label class="syc'+(q?" q":"")+'"><input type=checkbox data-i='+i+(c.certain?" checked":"")+(c.ok?"":" disabled")+'><span class=i>'+ic(q?"q":kind(c))+'</span><span><b>'+h(title(c))+'</b>'+(c.match?'<span class=m>Matched: '+h(c.match)+'</span>':'')+(c.line_text?'<span class=ln>Line '+c.line+': “'+h(c.line_text)+'”</span>':'')+(c.problems&&c.problems.length?'<span class=pb>'+c.problems.map(h).join(" ")+'</span>':'')+'</span></label>'}
function review(j){CH=j.changes||[];var n=CH.length;shell('<h2>'+ic("sync")+' Sync this meeting</h2><p class=sub>'+(n?n+" change"+(n>1?"s":"")+" read from the meeting. Ticked ones are certain; tick the others only if you agree. Nothing changes until you tap Apply.":"")+'</p>'+(n?CH.map(card).join(""):'<p class=sye>This meeting does not change any post or task.</p>')+'<div class=syb><button type=button id=sy_x>Close</button>'+(n?'<button type=button class=go id=sy_go>Apply selected</button>':'')+'</div><p class=syr id=sy_m></p>');document.getElementById("sy_x").onclick=close;var g=document.getElementById("sy_go");if(g)g.onclick=apply}
function apply(){var pick=[].map.call(document.querySelectorAll("#sy_s input[type=checkbox]:checked"),function(x){return CH[+x.getAttribute("data-i")]});var m=document.getElementById("sy_m");if(!pick.length){m.textContent="Tick at least one change.";return}var g=document.getElementById("sy_go");g.disabled=true;g.textContent="Applying...";
sapi({action:"sync_apply",src:SRC,changes:pick}).then(function(j){if(!j.ok){g.disabled=false;g.textContent="Apply selected";m.textContent=j.error||"Not applied.";return}done(j)}).catch(function(){g.disabled=false;g.textContent="Apply selected";m.textContent="No connection. Nothing was changed."})}
function done(j){var html='<h2>'+ic("task")+' Applied</h2><p class=sub>'+j.done.length+' change'+(j.done.length===1?"":"s")+' made'+(j.failed.length?", "+j.failed.length+" not made":"")+'.</p>'+j.done.map(function(d){return '<p class=syr>'+ic("task")+' '+h(d.code||d.task)+' '+h(d.note||"")+'</p>'}).join("")+j.failed.map(function(d){return '<p class="syr" style="color:#8A3E3E">'+h(d.code||d.task)+': '+h(d.error)+'</p>'}).join("");
var P=j.pending||[];if(P.length){html+='<h2 style="font-size:1.05rem;margin-top:14px">The sheet</h2><p class=sub>'+P.length+' item'+(P.length>1?"s":"")+' came from the content calendar sheet. '+(j.connected?'Check each one, then write it to the sheet (each cell is logged in the Change log tab).':'Momo is not connected to the sheet, so your Claude Code will write these into it.')+'</p>'+(j.connected?P.map(function(c){return '<div class=syc><span class=i>'+ic("edit")+'</span><span style="flex:1"><b>'+h(c)+'</b><span class=m id="sy_p_'+h(c)+'">Not checked yet</span><button type=button class=sybtn data-pv="'+h(c)+'">Check the cells</button></span></div>'}).join(""):'')}
html+='<div class=syb><button type=button id=sy_x>Close</button><button type=button class=go id=sy_r>Done</button></div>';shell(html);document.getElementById("sy_x").onclick=close;document.getElementById("sy_r").onclick=function(){close();location.reload()};
[].forEach.call(document.querySelectorAll("#sy_s [data-pv]"),function(b){b.onclick=function(){var c=b.getAttribute("data-pv"),m=document.getElementById("sy_p_"+c);if(b.getAttribute("data-w")){b.disabled=true;sapi({action:"sync_sheet",code:c,apply:true}).then(function(r){m.textContent=r.ok?"Written to the sheet ("+(r.written||0)+" cell"+(r.written===1?"":"s")+")":(r.error||"Not written");b.remove()});return}
b.disabled=true;sapi({action:"sync_sheet",code:c,apply:false}).then(function(r){b.disabled=false;if(!r.ok){m.textContent=r.error==="not_connected"?"Not connected to the sheet.":(r.error||"Could not read the sheet");return}var C=r.changes||[];if(!C.length){m.textContent="The sheet already matches.";b.remove();return}m.innerHTML=C.map(function(x){return h(x.cell)+" "+h(x.field)+": “"+h(x.old)+"” to “"+h(x.new)+"”"}).join("<br>");b.textContent="Write "+C.length+" cell"+(C.length>1?"s":"")+" to the sheet";b.setAttribute("data-w","1")})}})}
function run(src){SRC=src;shell('<h2>'+ic("sync")+' Sync this meeting</h2><p class=sye>Reading the meeting against your tasks and the content planner...</p>');sapi({action:"sync_propose",src:src}).then(function(j){if(!j.ok){shell('<h2>Sync</h2><p class=sye>'+h(j.error||"Could not read the meeting.")+'</p><div class=syb><button type=button id=sy_x>Close</button></div>');document.getElementById("sy_x").onclick=close;return}review(j)}).catch(function(){shell('<h2>Sync</h2><p class=sye>No connection. Nothing was changed.</p><div class=syb><button type=button id=sy_x>Close</button></div>');document.getElementById("sy_x").onclick=close})}
document.addEventListener("click",function(e){var b=e.target.closest?e.target.closest("[data-sy]"):null;if(!b)return;e.preventDefault();var v=b.getAttribute("data-sy");run(v.indexOf("rec:")===0?{rec:v.slice(4)}:{entry:v})});
var qs=(new URLSearchParams(location.search)).get("sync");if(qs)setTimeout(function(){run(qs.indexOf("rec:")===0?{rec:qs.slice(4)}:{entry:qs})},600);
var AQ=[],AW=null;
function ask(){if(!AQ.length){close();return}var x=AQ[0],c=x.change,q=c.quote||c.line_text||"";if(c.type==="match"){askM(x);return}
shell('<h2>'+ic("sync")+' From your meeting</h2><p class=sub>'+h(x.title||"Meeting")+(x.date?" \u00b7 "+h(fd(x.date)):"")+(AQ.length>1?" \u00b7 1 of "+AQ.length:"")+'</p>'
+'<div class=syq>'+(q?'<p class=ln>During the meeting you said: \u201c'+h(q)+'\u201d</p>':'')+'<p><b>'+h(title(c))+'</b></p>'+(c.match?'<p class=m>Matched: '+h(c.match)+'</p>':'')+'<p>Is that right?</p></div>'
+'<p id=sy_m class=sye></p><div class="syb sya"><button type=button id=sy_no>No</button><button type=button id=sy_ch>Change it\u2026</button><button type=button class=go id=sy_yes>Yes, update the calendar</button></div>');
var m=document.getElementById("sy_m");
document.getElementById("sy_no").onclick=function(){sapi({action:"sync_auto_answer",meeting:x.meeting,id:c.id,answer:"no"}).then(function(){AQ.shift();ask()})};
document.getElementById("sy_ch").onclick=function(){if(c.code&&/^planner_/.test(c.type)){location.href="/momo/work/planner?key="+encodeURIComponent(K)+"&code="+encodeURIComponent(c.code);return}close();run({entry:x.meeting})};
document.getElementById("sy_yes").onclick=function(){var b=this;b.disabled=true;m.textContent="Updating\u2026";sapi({action:"sync_auto_answer",meeting:x.meeting,id:c.id,answer:"yes"}).then(function(j){if(!j.ok){b.disabled=false;m.textContent=j.error||"Not updated.";return}AQ.shift();if(j.pending&&j.pending.length&&!AQ.length){done(j);return}ask()}).catch(function(){b.disabled=false;m.textContent="No connection. Try again."})}}
// v781 - the matcher's card: what she said, the post it matches, the change with every field filled in and editable, and the right buttons
var DN=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];function dd(d){if(!d)return"";var x=new Date(d+"T00:00:00Z");return DN[x.getUTCDay()]+" "+x.getUTCDate()+" "+["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][x.getUTCMonth()]}
function fld(id,lab,v,type){return '<label class=sf><span>'+lab+'</span><input id="'+id+'" type="'+(type||"text")+'" value="'+h(v||"")+'"></label>'}
function askM(x){var c=x.change,f=c.fields||{},q=c.quote||"",cl=c.cls,cur=c.current||{};
var head={sure:"This matches a post",likely:"This looks like a post",conflict:"This changes something already planned",new:"Nothing is planned for this yet",task:"This is a task",recurring:"This sounds like a weekly rule"}[cl]||"From your meeting";
var it=c.code?'<p class=m>'+h(c.code)+' \u00b7 '+(c.kind==="story"?"Story":"Feed post")+' \u00b7 '+h(dd(c.date))+(cur.topic?' \u00b7 now: '+h(cur.topic)+(cur.time?' '+h(cur.time):''):'')+'</p>':(c.date?'<p class=m>'+(c.kind==="story"?"Story":"Feed post")+' \u00b7 '+h(dd(c.date))+'</p>':'');
var body='';
if(cl==="task")body=fld("mf_task","Task",c.task)+fld("mf_owner","Who",c.owner||"Najjuko")+fld("mf_due","Due",c.due||"","date");
else if(cl==="recurring")body='<p><b>'+h(c.rule||"")+'</b> for the next 8 weeks.</p>'+fld("mf_time","Time",f.time,"time");
else if(c.skip)body='<p><b>Leave '+h(c.code)+' empty (skip this day)?</b></p>';
else body='<p class=sub2>Change it to:</p>'+fld("mf_topic","Topic",f.topic)+'<div class=sf2>'+fld("mf_time","Time",f.time||cur.time,"time")+fld("mf_format",c.kind==="story"?"Story type":"Format",c.kind==="story"?(f.story_type||""):(f.format||cur.format))+'</div>'+fld("mf_who","Who",f.who)+(cl==="new"?fld("mf_date","Day",c.date,"date"):'')+(c.ask?'<p class=m>'+h(c.ask)+'</p>':'');
var btn=cl==="conflict"?'<button type=button class=go data-a=replace>Replace</button><button type=button data-a=move>Move the existing one\u2026</button><button type=button data-a=keep>Keep both</button><button type=button data-a=no>No</button>'
 :cl==="new"?'<button type=button class=go data-a=add>Add</button><button type=button data-a=no>No</button>'
 :cl==="task"?'<button type=button class=go data-a=add>Add task</button><button type=button data-a=no>No</button>'
 :cl==="recurring"?'<button type=button class=go data-a=repeat>Make it repeat</button><button type=button data-a=no>No</button>'
 :'<button type=button class=go data-a=yes>Yes, update</button><button type=button data-a=no>No</button><button type=button data-a=edit>Edit\u2026</button>';
shell('<h2>'+ic("sync")+' '+h(head)+'</h2><p class=sub>'+h(x.title||"Meeting")+(x.date?" \u00b7 "+h(fd(x.date)):"")+(AQ.length>1?" \u00b7 1 of "+AQ.length:"")+'</p>'
+'<div class=syq>'+(q?'<p class=ln>You said: \u201c'+h(q.length>220?q.slice(0,220)+"\u2026":q)+'\u201d</p>':'')+it+'<div id=mf_body'+(cl==="sure"||cl==="likely"?' class=ro':'')+'>'+body+'</div>'
+'<div id=mf_move hidden>'+fld("mf_mdate","Move "+h(c.code||"it")+" to","","date")+'<button type=button class=go data-a=movego>Move it and add this</button></div></div>'
+'<p id=sy_m class=sye></p><div class="syb sya mfa">'+btn+'</div>');
var m=document.getElementById("sy_m"),B=document.getElementById("mf_body");if(B&&B.className==="ro")[].forEach.call(B.querySelectorAll("input"),function(i){i.readOnly=true});
var val=function(id){var e=document.getElementById(id);return e?e.value:""};
var send=function(ans,btn){var fl={topic:val("mf_topic"),time:val("mf_time"),who:val("mf_who"),date:val("mf_date"),task:val("mf_task"),owner:val("mf_owner"),due:val("mf_due"),move_date:val("mf_mdate")};var fm=val("mf_format");if(c.kind==="story")fl.story_type=fm;else fl.format=fm;
if(btn)btn.disabled=true;m.textContent=ans==="no"?"":"Updating\u2026";
sapi({action:"sync_auto_answer",meeting:x.meeting,id:c.id,answer:ans,fields:fl}).then(function(j){if(btn)btn.disabled=false;if(!j.ok){m.textContent=j.error||"Not updated.";return}AQ.shift();if(j.pending&&j.pending.length&&!AQ.length){done(j);return}ask()}).catch(function(){if(btn)btn.disabled=false;m.textContent="No connection. Try again."})};
[].forEach.call(document.querySelectorAll("#sy_s [data-a]"),function(b){b.onclick=function(){var a=b.getAttribute("data-a");
if(a==="edit"){[].forEach.call(B.querySelectorAll("input"),function(i){i.readOnly=false});B.className="";var t=document.getElementById("mf_topic")||B.querySelector("input");if(t)t.focus();b.textContent="Save";b.setAttribute("data-a","yes");b.className="go";return}
if(a==="move"){document.getElementById("mf_move").hidden=false;var md=document.getElementById("mf_mdate");if(md)md.focus();return}
if(a==="movego"){if(!val("mf_mdate")){m.textContent="Pick the day to move it to.";return}send("move",b);return}
send(a,b)}})}
function autoRun(){if(!K||document.getElementById("sy_s"))return;sapi({action:"sync_auto"}).then(function(j){if(!j||!j.ok)return;var B=j.badges||{};[].forEach.call(document.querySelectorAll("[data-sy]"),function(b){var n=B[b.getAttribute("data-sy")];if(n&&!b.querySelector(".syd")){var d=document.createElement("span");d.className="syd";d.textContent=n;b.appendChild(d)}});AQ=j.open||[];if(AQ.length)ask()}).catch(function(){})}
var dcss=document.createElement("style");dcss.textContent=".syd{display:inline-block;min-width:16px;height:16px;line-height:16px;border-radius:999px;background:#C5A56A;color:#fff;font-size:.66rem;text-align:center;margin-left:4px;padding:0 4px}.sya{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.sya .go{grid-column:1/-1;order:-1}.sya button{min-width:0}.sf{display:block;margin:6px 0}.sf span{display:block;font:600 .7rem IBM Plex Mono,monospace;letter-spacing:.06em;color:#8A6F3E;text-transform:uppercase}.sf input{box-sizing:border-box;width:100%;border:1px solid #D8D1C4;border-radius:10px;padding:9px;font:500 .92rem IBM Plex Sans,sans-serif;background:#fff}.ro input{border-color:transparent;background:#F7F3EA}.sf2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.sub2{margin:8px 0 2px;font-weight:600}.mfa{grid-template-columns:1fr 1fr}.mfa .go{grid-column:1/-1}.syq{box-sizing:border-box;max-width:100%;overflow-wrap:anywhere;border:1px solid #E7E1D6;background:#FFFDF9;border-radius:14px;padding:12px;margin:8px 0}.syq p{margin:6px 0}.syq .ln{color:#5F6B66;font-style:italic}.syq .m{color:#8A6F3E;font-size:.82rem}";document.head.appendChild(dcss);
if(!(new URLSearchParams(location.search)).get("sync"))setTimeout(autoRun,1200);
window.momoSync=run;window.momoAuto=autoRun;
})();`;
