// v810 MONDAY HUDDLE CARD (Kendall 8 Nov 2026; spec "FN Realty - Monday Huddle Card - Handover to DigitAlchemy", 8 Nov 2026, v1 draft).
// Najjuko prepares, approves and runs the weekly 30-minute huddle from her phone. The DNA keeps the design (15 slide layouts, render_edition.py,
// brand rules); Momo is only the form, the approval and the presenter. The slide design is never rebuilt here.
// Defaults until Najjuko answers the handover's questions: Thursday creates the card, Sunday is build and approve; she pastes the other sections
// herself (v1); build runs through the bridge (option A): her Claude reads the form, builds on the Mac, and posts the PDF/PPTX back.
//
// PRIVATE: only Najjuko's key opens the card, its files and its bridge routes (not Kendall's). Birthdays are HR data (UAE PDPL): they live only in
// the card's form; this module never logs a form value, and the bridge log keeps only person, route and status.
// APPROVAL FIRST: only her tap on the card sets Approved. The bridge can never set it (a bridge call that tries is refused, 403 approval_is_hers).
// Momo never sends the deck to anyone.
//
// KV (MEETINGS, her own keys): hud_card_<YYYY-MM-DD> (one card per Monday: status, form, sections, market, build, presenter),
// hud_index ([dates], newest last), hud_file_<date>_pdf / hud_file_<date>_pptx / hud_file_<date>_slide_<nn> (the build's files, binary).
// Close writes a meeting record into her Momo Meetings store: recw_<id> + recs_<id>_000 (the segment notes as its text), status "transcribed" with
// auto_file_off, so nothing goes into her work log by itself; the standard minutes come from the record's existing Minutes action (/momo/work/rec/minutes).

// v812 (Kendall approved 8 Nov): (1) MOMO PREPARES THE HUDDLE - on creation the card carries Momo's drafts (c.momo), each accepted with one tap like
// "drafted by Claude": market topics ranked and the top 4 pre-ticked with a one-line why; recognition counts and first names from her own work log and
// campaign replies; the UAE days of the week (birthdays stay hers to paste); the schedule from her read-only Google Calendar when it is connected;
// three theme directions from last week's notes and numbers (deterministic, no model call). (2) LAST WEEK'S ACTIONS FIRST - Close keeps the actions;
// the next card opens presenter mode on them (done / not done / carry forward; carried items join this week's actions; no owner = gold "owner needed").
// (3) ONE INPUT, THREE OUTPUTS - her 4 market picks also make a DRAFT Monday market-research item in her Content Planner (never published) and are
// exposed on the bridge as market_for_pdf for her Claude's team market PDF.
import { applyAction as plannerSave } from "./content_planner.js";
import { SEED as PLAN_SEED } from "./work_plan.js";
import { BRIDGE_LOG as WL, PEOPLE as WL_PEOPLE, BROKER_TASKS } from "./work_log.js";
import { draftTasksFrom } from "./draft_tasks.js";
import { withRoster, rosterMatch } from "./work_log.js";   // v815 - organogram first names for the birthdays
import { readBirthdays, birthdaysFor, birthdayAction, birthdaysPage } from "./huddle_birthdays.js";   // v815
import { MOMO_TOAST_JS } from "./momo_toast.js";

export const HUD = "hud_card_", HUD_IDX = "hud_index", HUD_FILE = "hud_file_";
export const STATUSES = ["Draft", "Filling", "Ready to build", "Built", "Approved", "Presented", "Closed"];
export const MAX_FILE = 15 * 1024 * 1024, MAX_SLIDES = 15, MAX_TOPICS = 20, PICKS = 4, MAX_FORM_BYTES = 200000;

// ---- THE SECTION MAP (v822: filled from Najjuko's huddle-form-fields.json, 146 fields; src/huddle_fields.js keeps the list in her edition order) -----------
// Every field has its card section, slide label, source, type and a maximum of about 1.3 x the longest used so far. Fixed / Auto / team-mantra fields are
// read-only on the card. A key she adds that is not in the list still rides along in the form and is listed under "Other fields"; the edition the bridge
// hands to render_edition.py is exactly her field list, in her order, empty = "" (her gold [placeholder]).
import { HUDDLE_FIELDS } from "./huddle_fields.js";
export const FIELD_META = Object.fromEntries(HUDDLE_FIELDS.map((r) => [r[0], { slide: r[1], label: r[2], section: r[3], source: r[4], type: r[5], longest: r[6], max: r[7], editable: r[8] }]));
export const FIELD_SECTION = Object.fromEntries(HUDDLE_FIELDS.filter((r) => r[3]).map((r) => [r[0], r[3]]));
export const DATE_FIELDS = ["huddle_date"];          // rewritten for the new Monday when a card is copied
export const AUTO_NEXT = "next_huddle";               // "Auto: next Monday"
export const THEME_TITLE_KEY = "cover_title_line1";   // names the meeting record on Close
export const fieldsOf = (sid) => HUDDLE_FIELDS.filter((r) => r[3] === sid).map((r) => r[0]);
export const SECTIONS = [
  { id: "theme", name: "Theme & clip", slides: [1, 3], prefixes: ["theme", "clip", "motivation", "video", "youtube"], source: "Najjuko (Ali sometimes suggests the clip)" },
  { id: "market", name: "Market", slides: [4, 5, 6, 7], prefixes: ["market"], source: "Najma (read-only) + public sources" },
  { id: "recognition", name: "Recognition", slides: [8], prefixes: ["recognition", "recog", "top_performer", "award"], source: "Sales director" },
  { id: "announcements", name: "Announcements", slides: [9], prefixes: ["announcement", "announce", "update", "hr_"], source: "Management / HR" },
  { id: "celebrations", name: "Celebrations", slides: [10], prefixes: ["celebration", "celebrate", "birthday", "bday", "days_to_mark", "holiday"], source: "HR + UAE calendar" },
  { id: "tip", name: "Tip of the week", slides: [11], prefixes: ["tip"], source: "Najjuko or Ali" },
  { id: "schedule", name: "Schedule", slides: [12], prefixes: ["schedule", "week_", "day_", "focus"], source: "Weekly schedule" },
  { id: "mantra", name: "Mantra & close", slides: [14, 15], prefixes: ["mantra", "challenge", "close", "closing"], source: "Team mantra (fixed)" },
];
// v813 (Najjuko's walkthrough 8 Nov: "slide one and slide three" meant nothing to her) - each section says in plain words where it shows in the deck
export const WHERE = { theme: "the opening slide and the theme slide", market: "the four market slides", recognition: "the recognition slide", announcements: "the announcements slide",
  celebrations: "the celebrations slide", tip: "the tip-of-the-week slide", schedule: "the week-ahead slide", mantra: "the mantra and closing slides" };
export const FIXED_SLIDES = [2, 13];   // agenda and Q&A: locked, nothing to fill
// the run of show (about 30 minutes)
export const SEGMENTS = [
  { n: "01", name: "Motivation", min: 4, slides: [1, 2, 3] }, { n: "02", name: "Market", min: 7, slides: [4, 5, 6, 7] },
  { n: "03", name: "Recognition", min: 3, slides: [8] }, { n: "04", name: "Updates, celebrations & tip", min: 6, slides: [9, 10, 11] },
  { n: "05", name: "Weekly focus", min: 3, slides: [12] }, { n: "06", name: "Q&A", min: 3, slides: [13] },
  { n: "07", name: "Shout-outs", min: 3, slides: [13] }, { n: "08", name: "Mantra", min: 2, slides: [14, 15] },   // v822 - TEMPLATE.md: 13 = Q&A + shout-outs
];
export const HOSTS = ["Ali Kalhor", "Najjuko"];   // hierarchy: wherever people are shown, Ali Kalhor sits above Najjuko

const SEC = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));
const slideSection = (n) => (SECTIONS.find((s) => s.slides.includes(n)) || {}).id || "";
export function sectionOfKey(key) {
  const k = String(key || "");
  if (FIELD_SECTION[k]) return FIELD_SECTION[k];
  if (k === "skip_slides") return "";
  const lk = k.toLowerCase(), m = /^(?:s|slide_?)0?(\d{1,2})_/.exec(lk);
  if (m) return slideSection(Number(m[1]));
  for (const s of SECTIONS) if (s.prefixes.some((p) => lk.startsWith(p))) return s.id;
  return "";
}
export const keysOf = (sid, form) => Object.keys(form || {}).filter((k) => sectionOfKey(k) === sid);

// ---- dates (Dubai) -----------------------------------------------------------------------------------------------------------------------------------------
export const dubaiToday = (ms) => new Date((ms == null ? Date.now() : ms) + 4 * 3600e3).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const dow = (d) => new Date(d + "T00:00:00Z").getUTCDay();
export const dOk = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || "")) && !isNaN(Date.parse(d));
export function mondayFor(today) { const w = dow(today); return w === 1 ? today : addDays(today, (8 - w) % 7); }
export const inCreateWindow = (today) => (Date.parse(mondayFor(today)) - Date.parse(today)) / 864e5 <= 4;   // Thursday (4 days before) to Monday
const DOWN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// v816 - the huddle week, Monday to Sunday (Dubai): "Week of Mon 9 Nov 2026"; "Next week · " when the card is for a week that has not started
export const weekLabel = (d) => "Week of " + niceDate(d) + " " + d.slice(0, 4);
export function weekPrefix(d, nowMs) { const t = dubaiToday(nowMs), m = mondayFor(t), thisMon = dow(t) === 1 ? t : addDays(m, -7); return d === addDays(thisMon, 7) ? "Next week · " : d > thisMon ? "Coming · " : d < thisMon ? "Past · " : ""; }
export const niceDate = (d) => DOWN[dow(d)] + " " + Number(d.slice(8)) + " " + MON[Number(d.slice(5, 7)) - 1];

// ---- placeholders: an empty field shows as a gold [placeholder] on the slide ---------------------------------------------------------------------------
export function isEmpty(v) {
  if (v == null) return true;
  if (typeof v === "string") return !v.trim();
  if (Array.isArray(v)) return v.length === 0;
  return false;
}
function leaves(v, path, out) {
  if (Array.isArray(v) && v.length && v.every((x) => x && typeof x === "object" && !Array.isArray(x))) { v.forEach((x, i) => leaves(x, path + "[" + i + "]", out)); return out; }
  if (v && typeof v === "object" && !Array.isArray(v)) { const ks = Object.keys(v); if (!ks.length) out.push([path, null]); ks.forEach((k) => leaves(v[k], path + "." + k, out)); return out; }
  out.push([path, v]); return out;
}
// counts empty leaves; *_notes are speaker notes (never on the slide), skip_slides is the switch, and a skipped section's fields are not drawn
export function placeholders(form) {
  const f = form || {}, skip = new Set((Array.isArray(f.skip_slides) ? f.skip_slides : []).map(Number)), keys = [];
  for (const k of Object.keys(f)) {
    if (k === "skip_slides" || /_notes$/i.test(k)) continue;
    const sid = sectionOfKey(k); if (sid && SEC[sid] && SEC[sid].slides.every((n) => skip.has(n))) continue;
    if (FIELD_META[k] && !FIELD_META[k].editable) continue;   // v822 - fixed / auto fields are not hers to fill
    for (const [p, v] of leaves(f[k], k, [])) if (isEmpty(v)) keys.push(p);
  }
  return { count: keys.length, keys };
}

// v822 - the edition JSON, exactly her field list and order; empty = "" (skip_slides = []), the dates set by the week
const LONGDAY = (d) => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(d + "T00:00:00Z").getUTCDay()] + " " + Number(d.slice(8)) + " " + ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][Number(d.slice(5, 7)) - 1] + " " + d.slice(0, 4);
export function editionOf(c) {
  const o = {};
  for (const r of HUDDLE_FIELDS) {
    const k = r[0]; let v = c.form[k];
    if (k === "huddle_date" && (v == null || v === "")) v = c.date;
    if (k === AUTO_NEXT && (v == null || v === "")) v = LONGDAY(addDays(c.date, 7));
    if (v == null) v = k === "skip_slides" ? [] : "";
    o[k] = clone(v);
  }
  return o;
}
export const editionPlaceholders = (c) => placeholders(editionOf(c));
// ---- the card --------------------------------------------------------------------------------------------------------------------------------------------
const clone = (o) => JSON.parse(JSON.stringify(o == null ? null : o));
export async function getCard(env, date) { if (!dOk(date)) return null; try { return JSON.parse(await env.MEETINGS.get(HUD + date)); } catch (e) { return null; } }
async function putCard(env, c) {
  c.updated = new Date().toISOString(); await env.MEETINGS.put(HUD + c.date, JSON.stringify(c));
  let idx = []; try { idx = JSON.parse(await env.MEETINGS.get(HUD_IDX)) || []; } catch (e) {}
  if (!idx.includes(c.date)) { idx.push(c.date); idx.sort(); await env.MEETINGS.put(HUD_IDX, JSON.stringify(idx)); }
}
export async function cardIndex(env) { try { return JSON.parse(await env.MEETINGS.get(HUD_IDX)) || []; } catch (e) { return []; } }
async function prevCard(env, date) { const idx = (await cardIndex(env)).filter((d) => d < date); return idx.length ? getCard(env, idx[idx.length - 1]) : null; }

// a new card for Monday <date>, copied from last week's form, with the dates filled in
export async function createCard(env, date, nowIso, deps) {
  const have = await getCard(env, date); if (have) return have;
  const prev = await prevCard(env, date), form = prev ? clone(prev.form) || {} : {};
  for (const k of DATE_FIELDS) form[k] = date;
  form[AUTO_NEXT] = LONGDAY(addDays(date, 7));   // v822 - "Auto: next Monday"
  if (Array.isArray(form.skip_slides)) form.skip_slides = [];   // a skip is for one week only
  const c = { v: 1, date, status: "Draft", created: nowIso || new Date().toISOString(), prev_date: prev ? prev.date : "", form, sections: {}, drafted: {},
    market: { topics: [], picked: [], why: {}, momo_pending: false, by: "" }, build: null, build_requested: null, approved: null, presenter: { done: {}, notes: {} }, record_id: "", log: [],
    // v812 - last week's open actions, reviewed first in presenter mode; this week's actions (carried ones join automatically)
    last_actions: prev ? (prev.actions || []).filter((x) => x.status !== "done").map((x) => Object.assign({}, x, { review: "" })) : [], actions: [] };
  try { await prefill(env, c, prev, deps || {}); } catch (e) { c.momo = c.momo || { notes: ["Momo could not prepare the drafts this time."] }; }
  await putCard(env, c); return c;
}
// the minute tick: on Thursday (and through Monday, if it was missed) the card for the next Monday appears
export async function huddleTick(env, nowMs, deps) {
  const today = dubaiToday(nowMs); if (!inCreateWindow(today)) return null;
  const date = mondayFor(today); if (await env.MEETINGS.get(HUD + date)) return null;
  return createCard(env, date, new Date(nowMs || Date.now()).toISOString(), deps);
}

// ---- v812 MOMO PREPARES THE HUDDLE -----------------------------------------------------------------------------------------------------------------------
// market ranking (deterministic): newest data first, a figure in the line, not provisional, one topic per table among the top four
const KIND_RANK = ["sales", "off-plan", "offplan", "launch", "rent", "area", "developer"];
export function rankTopics(topics) {
  const sc = (t) => { let s = 0; const k = (t.kind + " " + t.table).toLowerCase(), i = KIND_RANK.findIndex((x) => k.includes(x));
    if (t.as_of) s += Date.parse(t.as_of) / 864e5 / 1000; if (/\d/.test(t.line)) s += 3; if (!t.provisional) s += 2; if (i >= 0) s += (KIND_RANK.length - i) * 0.3; return s; };
  const sorted = topics.slice().sort((a, b) => sc(b) - sc(a) || (a.id < b.id ? -1 : 1)), top = [], used = new Set();
  for (const t of sorted) { if (top.length < PICKS && !used.has(t.table)) { top.push(t); used.add(t.table); } }
  for (const t of sorted) if (top.length < PICKS && !top.includes(t)) top.push(t);
  const why = {};
  for (const t of top) why[t.id] = [t.as_of ? "newest data (" + t.as_of + ")" : "", /\d/.test(t.line) ? "has a figure" : "", t.provisional ? "provisional: check it" : "verified source", t.table ? "from " + t.table : ""].filter(Boolean).join(", ");
  return { order: sorted.map((t) => t.id), top: top.map((t) => t.id), why };
}
function momoMarket(c) {
  if (!c.market.topics.length || c.market.by === "her") return;
  const r = rankTopics(c.market.topics); c.market.picked = r.top; c.market.why = r.why; c.market.momo_pending = r.top.length > 0;
  c.market.topics = r.order.map((id) => c.market.topics.find((t) => t.id === id));
}
const firstName = (n) => String(n || "").trim().split(/\s+/)[0];
const DEAL_IDS = new Set(((BROKER_TASKS.find((g) => g.group === "Deals") || {}).items || []).map((i) => i[0]));
const VIEW_IDS = new Set(((BROKER_TASKS.find((g) => g.group === "Viewings") || {}).items || []).map((i) => i[0]));
async function campReplies(env) {
  let idx = []; try { idx = JSON.parse(await env.MEETINGS.get("camp_index")) || []; } catch (e) {}
  let n = 0; for (const id of idx) { try { n += Number((JSON.parse(await env.MEETINGS.get("camp_stats_" + id)) || {}).replies) || 0; } catch (e) {} }
  return { total: n, campaigns: idx.length };
}
async function prefill(env, c, prev, deps) {
  const M = { notes: [] }, from = addDays(c.date, -7), to = addDays(c.date, -1);
  // recognition: counts and first names already in her Momo work log, plus campaign replies since last week's card
  const es = await WL.listEntries(env, from, to), known = new Set(WL_PEOPLE.map((p) => p[0]));
  let deals = 0, views = 0, meets = 0; const ppl = {};
  for (const e of es) { const bt = Array.isArray(e.broker_tasks) ? e.broker_tasks : [];
    if (bt.some((x) => DEAL_IDS.has(x))) deals++; if (bt.some((x) => VIEW_IDS.has(x))) views++; if (e.type === "Meeting") meets++;
    for (const p of Array.isArray(e.people) ? e.people : []) if (known.has(p)) ppl[firstName(p)] = (ppl[firstName(p)] || 0) + 1; }
  const cr = await campReplies(env), prevTotal = prev && prev.momo_snap ? prev.momo_snap.camp_replies : null;
  c.momo_snap = { camp_replies: cr.total };
  const rec = [];
  if (es.length) rec.push(weekLabel(from) + " in Momo: " + deals + " deal step" + (deals === 1 ? "" : "s") + " logged, " + views + " viewing" + (views === 1 ? "" : "s") + ", " + meets + " meeting" + (meets === 1 ? "" : "s") + ".");
  if (cr.campaigns && prevTotal != null) rec.push((cr.total - prevTotal) + " campaign repl" + (cr.total - prevTotal === 1 ? "y" : "ies") + " this week.");
  else if (cr.campaigns) rec.push(cr.total + " campaign replies so far (weekly count starts next week).");
  const top = Object.entries(ppl).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 3).map((x) => x[0]);
  if (top.length) rec.push("Worked with most: " + top.join(", ") + ".");
  M.recognition = rec.length ? { lines: rec, accepted: false } : null;
  if (!rec.length) M.notes.push("No work-log entries last week, so no recognition draft.");
  // celebrations: only the UAE days of the week (birthdays are HR data: she pastes them)
  const end = addDays(c.date, 6), days = PLAN_SEED.filter((s) => s[1] <= end && s[2] >= c.date && (Date.parse(s[2]) - Date.parse(s[1])) / 864e5 <= 3).map((s) => s[3] + " (" + niceDate(s[1] < c.date ? c.date : s[1]) + ")");
  let bd = []; try { const people = (await withRoster(env, { people: WL_PEOPLE })).people; bd = birthdaysFor(await readBirthdays(env), c.date, prev ? prev.date : "", people, rosterMatch); } catch (e) {}
  M.celebrations = days.length || bd.length ? { lines: days, birthdays: bd, accepted: bd.length > 0, note: bd.length ? "Birthdays from your Birthdays list; untick anyone to leave them out." : "No birthdays this week on your Birthdays list." } : null;   // v815 - pre-accepted
  if (bd.length) c.sections.celebrations = { state: "momo", at: new Date().toISOString() };
  // schedule: her read-only Google Calendar, Monday to Thursday, when it is connected
  if (deps.cal) {
    const out = [];
    for (let i = 0; i < 4; i++) { const d = addDays(c.date, i); let v = null; try { v = await deps.cal(env, d); } catch (e) {}
      if (!v || !v.connected) { out.length = 0; M.notes.push("Calendar not connected: schedule left for you."); break; }
      const ev = (v.events || []).slice(0, 4).map((x) => (x.all_day ? "" : x.time + " ") + x.title); deps.calEvents = deps.calEvents || {}; deps.calEvents[d] = (v.events || []).filter((x) => !x.all_day);
      out.push(niceDate(d) + ": " + (ev.length ? ev.join("; ") : "nothing booked")); }
    M.schedule = out.length ? { lines: out, accepted: false } : null;
  } else { M.schedule = null; M.notes.push("Calendar not read here: schedule left for you."); }
  // theme: three directions from last week's notes and numbers (no model call; her Claude can refine them through the bridge)
  const th = [];
  if (es.length) th.push("Build on last week: " + views + " viewings and " + deals + " deal steps. What turned a viewing into an offer?");
  const open = c.last_actions.length; if (open) th.push("Finish what we started: " + open + " open action" + (open === 1 ? "" : "s") + " from last Monday.");
  const pn = prev && prev.presenter ? Object.values(prev.presenter.notes || {}).map(String).join(" ") : "";
  const q = /([^.?!]*\?)/.exec(pn); if (q) th.push("Answer last week's question: " + q[1].trim().slice(0, 120));
  for (const g of ["Speed wins: reply to every lead in 10 minutes.", "One client, one follow-up, every day.", "Know the market: one figure each before every call."]) if (th.length < 3) th.push(g);
  M.theme = { lines: th.slice(0, 3), accepted: false };
  c.momo = M; momoMarket(c);
  fillFromMomo(c, prev, deps.calEvents || null);
}

// v822 - Momo fills the edition fields it already knows, every week: celebrations (cel_bday_body, cel_days_body) and the schedule (week_range,
// day1-4_name/date, and event/time from her calendar when connected; otherwise the day's event fields start empty, last week's are not carried).
// Recognition (rec_*) is never touched: unchanged unless the sales director sends an update. A list field keeps the shape last week's used (array or lines).
const SHORT = (d) => Number(d.slice(8)) + " " + ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(d.slice(5, 7)) - 1];
export const weekRange = (d) => { const e = addDays(d, 6); return d.slice(5, 7) === e.slice(5, 7) ? Number(d.slice(8)) + "–" + SHORT(e) + " " + e.slice(0, 4) : SHORT(d) + " – " + SHORT(e) + " " + e.slice(0, 4); };
const asList = (lines, like) => (Array.isArray(like) ? lines.slice() : lines.join("\n"));
export function celebrationValues(c) {
  const md = (c.momo || {}).celebrations || {};
  return { cel_bday_body: (md.birthdays || []).filter((x) => x.on).map((x) => x.name + " · " + x.when), cel_days_body: (md.lines || []).slice() };
}
function fillFromMomo(c, prev, cal) {
  const f = c.form, filled = [], put = (k, v) => { f[k] = v; filled.push(k); };
  const cv = celebrationValues(c); put("cel_bday_body", asList(cv.cel_bday_body, prev && prev.form.cel_bday_body)); put("cel_days_body", asList(cv.cel_days_body, prev && prev.form.cel_days_body));
  put("week_range", weekRange(c.date));
  const DN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  for (let i = 0; i < 4; i++) { const d = addDays(c.date, i), ev = cal && cal[d] && cal[d][0];
    put("day" + (i + 1) + "_name", DN[new Date(d + "T00:00:00Z").getUTCDay()]); put("day" + (i + 1) + "_date", SHORT(d));
    for (const x of ["event", "place", "time", "purpose"]) f["day" + (i + 1) + "_" + x] = "";
    if (ev) { put("day" + (i + 1) + "_event", String(ev.title || "").slice(0, FIELD_META["day" + (i + 1) + "_event"].max)); if (ev.time) put("day" + (i + 1) + "_time", ev.time); } }
  c.momo_filled = filled;
}
// ---- v812 one input, three outputs: her 4 picks -> the Content Planner draft + the team market PDF list ----------------------------------------------------
async function marketOutputs(env, c) {
  if ((c.market.picked || []).length !== PICKS || c.market.momo_pending) return;
  const ts = c.market.picked.map((id) => c.market.topics.find((t) => t.id === id)).filter(Boolean);
  const b = { action: "save", kind: "feed", date: c.date, time: "10:00", format: "Carousel", series: "Market research", added: true,
    topic: ("Market research (" + weekLabel(c.date) + "): " + ts.map((t) => t.line).join(" | ")).slice(0, 400),
    note: ("DRAFT from the Monday Huddle " + c.date + ". Sources: " + ts.map((t) => "(" + t.table + ", data as of " + t.as_of + ")" + (t.provisional ? " provisional" : "")).join("; ") + ". Never published from here.").slice(0, 400) };
  if (c.cp_code) b.code = c.cp_code;
  try { const [s, o] = await plannerSave(env, b, "Najjuko"); if (s < 300 && o.item) c.cp_code = o.item.code; } catch (e) {}
  c.market.for_pdf = true;
}
// the card the bridge and the page call "next": this Monday's (or the coming one's) once it exists, else last Monday's while it is still open
export async function nextCard(env, nowMs, deps) {
  const today = dubaiToday(nowMs), date = mondayFor(today);
  if (inCreateWindow(today)) return (await getCard(env, date)) || (await createCard(env, date, undefined, deps));
  const idx = await cardIndex(env), last = idx.filter((d) => d < today).pop(), lc = last ? await getCard(env, last) : null;
  if (lc && lc.status !== "Closed") return lc;
  return { date, status: "Not created yet", creates_on: addDays(date, -4), stub: true };
}

const sectionDone = (c, sid) => sid === "market" ? (c.market.picked || []).length === PICKS && !c.market.momo_pending :!!(c.sections[sid] && c.sections[sid].state);
export function recompute(c) {
  if (["Approved", "Presented", "Closed"].includes(c.status) || c.status === "Built") return c;
  const touched = Object.keys(c.sections).length || (c.market.picked || []).length || Object.keys(c.drafted || {}).length;
  c.status = SECTIONS.every((s) => sectionDone(c, s.id)) ? "Ready to build" : touched ? "Filling" : "Draft";
  return c;
}
// a change after Built or Approved makes the preview stale: back to Ready to build / Filling, and the approval is withdrawn
function formChanged(c) {
  if (c.status === "Built" || c.status === "Approved") { c.status = "Filling"; c.approved = null; c.build_stale = true; }
  return recompute(c);
}
export function nextStep(c) {
  if (c.stub) return "The card appears on Thursday " + niceDate(c.creates_on || c.date);
  if (c.status === "Draft" || c.status === "Filling") {
    const s = SECTIONS.find((x) => !sectionDone(c, x.id));
    return s.id === "market" ? "pick " + PICKS + " market topics" : "fill " + s.name;
  }
  return { "Ready to build": "build the preview", "Built": "check the preview and approve", "Approved": "present on Monday", "Presented": "close the huddle", "Closed": "done" }[c.status] || "";
}
export function cardOut(c) {
  if (c.stub) return { date: c.date, status: c.status, next_step: nextStep(c), creates_on: c.creates_on };
  const ph = editionPlaceholders(c);   // v822 - every field of her edition, not only the ones in the form
  return { date: c.date, week_label: weekLabel(c.date), week_prefix: weekPrefix(c.date), week: { from: c.date, to: addDays(c.date, 6) }, status: c.status, next_step: nextStep(c), form: c.form, skip_slides: Array.isArray(c.form.skip_slides) ? c.form.skip_slides : [],
    sections: SECTIONS.map((s) => ({ id: s.id, name: s.name, slides: s.slides, done: sectionDone(c, s.id), state: (c.sections[s.id] || {}).state || "", keys: [...new Set(fieldsOf(s.id).concat(keysOf(s.id, c.form)))] })),
    unmapped_keys: Object.keys(c.form).filter((k) => k !== "skip_slides" && !sectionOfKey(k)),
    market: { topics: c.market.topics, picked: c.market.picked, why: c.market.why || {}, momo_pending: !!c.market.momo_pending, cp_code: c.cp_code || "" }, drafted_by_claude: Object.keys(c.drafted || {}),
    momo: c.momo || null, last_actions: c.last_actions || [], actions: c.actions || [],   // v812
    market_for_pdf: c.market.for_pdf ? c.market.picked.map((id) => c.market.topics.find((t) => t.id === id)).filter(Boolean) : [],   // v812 - her Claude builds the team market PDF from these
    placeholders: ph, build_requested: c.build_requested, build: c.build ? { at: c.build.at, placeholders: c.build.placeholders, has_pdf: !!c.build.pdf, has_pptx: !!c.build.pptx, slides: c.build.slides || 0 } : null,
    approved: !!c.approved, hosts: HOSTS, edition: editionOf(c), momo_filled: c.momo_filled || [] };   // v822 - the bridge hands her Claude the edition JSON
}
const logIt = (c, what) => { c.log = (c.log || []).concat({ at: new Date().toISOString(), what: String(what).slice(0, 60) }).slice(-60); };   // the action only, never a value

// ---- market topics: one line each, ending with its source; Najma is read-only ----------------------------------------------------------------------------
export const cleanLine = (s) => String(s == null ? "" : s).replace(/\bvacanc(y|ies)\b/gi, "units on the market").replace(/\s+/g, " ").trim().slice(0, 220);
export function cleanTopics(list) {
  const out = [], seen = new Set();
  for (const t of Array.isArray(list) ? list : []) {
    if (!t || typeof t !== "object") continue;
    const id = String(t.id || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 40) || "t" + (out.length + 1), line = cleanLine(t.line);
    if (!line || seen.has(id)) continue; seen.add(id);
    out.push({ id, line, table: cleanLine(t.table).slice(0, 80), as_of: dOk(t.as_of) ? t.as_of : "", provisional: !!t.provisional, kind: cleanLine(t.kind).slice(0, 30) });
    if (out.length >= MAX_TOPICS) break;
  }
  return out;
}

// ---- her actions on the card (her key only; the page answers them) ------------------------------------------------------------------------------------
export async function cardAction(env, b, nowIso) {
  const c = await getCard(env, b.date); if (!c) return [404, { ok: false, error: "There is no huddle card for that date." }];
  const now = nowIso || new Date().toISOString(), a = String(b.action || ""), sid = String(b.section || "");
  const locked = ["Presented", "Closed"].includes(c.status);
  const formActs = ["same", "edit", "skip", "pick", "accept", "accept_momo", "momo_edit", "bday_toggle"];
  if (locked && formActs.includes(a)) return [409, { ok: false, error: "This huddle has been presented; the form is closed." }];
  if (formActs.includes(a) && a !== "pick" && a !== "accept" && !SEC[sid]) return [400, { ok: false, error: "Which section?" }];
  if (a === "same") {
    const prev = c.prev_date ? await getCard(env, c.prev_date) : null, pf = (prev && prev.form) || {};
    for (const k of keysOf(sid, pf)) { if (!DATE_FIELDS.includes(k)) c.form[k] = clone(pf[k]); delete c.drafted[k]; }
    c.sections[sid] = { state: "same", at: now }; logIt(c, "same " + sid); formChanged(c);
  } else if (a === "edit") {
    const v = b.values && typeof b.values === "object" ? b.values : {};
    const long = Object.keys(v).filter((k) => FIELD_META[k] && FIELD_META[k].editable && String(Array.isArray(v[k]) ? v[k].join("\n") : v[k] == null ? "" : v[k]).length > FIELD_META[k].max);
    if (long.length) return [400, { ok: false, error: "Too long for the slide: " + long.map((k) => k + " (max " + FIELD_META[k].max + ")").join(", ") + "." }];
    if (sid === "tip") { const txt = Object.keys(v).map((k) => String(v[k] || "")).join(" "), who = WL_PEOPLE.map((p) => String(p[0]).replace(/\(.*?\)/g, "").trim().split(/\s+/)[0]).filter((n) => n.length > 2 && n !== "All");
      const hit = who.find((n) => new RegExp("\\b" + n + "\\b", "i").test(txt)); if (hit) return [400, { ok: false, error: "The tip is for everyone: leave out names (" + hit + "). Frame it as support, never aimed at one person." }]; }   // v822 - TEMPLATE.md
    for (const k of Object.keys(v)) { if (sectionOfKey(k) !== sid) continue; if (FIELD_META[k] && !FIELD_META[k].editable) continue; c.form[k] = clone(v[k]); delete c.drafted[k]; }
    if (JSON.stringify(c.form).length > MAX_FORM_BYTES) return [413, { ok: false, error: "That is too much text for one form." }];
    c.sections[sid] = { state: "edit", at: now }; logIt(c, "edit " + sid); formChanged(c);
  } else if (a === "skip") {
    const on = b.on !== false, set = new Set((Array.isArray(c.form.skip_slides) ? c.form.skip_slides : []).map(Number));
    SEC[sid].slides.forEach((n) => (on ? set.add(n) : set.delete(n)));
    c.form.skip_slides = [...set].sort((x, y) => x - y);
    if (on) c.sections[sid] = { state: "skip", at: now }; else delete c.sections[sid];
    logIt(c, (on ? "skip " : "unskip ") + sid); formChanged(c);
  } else if (a === "reopen") {
    if (!SEC[sid]) return [400, { ok: false, error: "Which section?" }];
    if (sid === "market") c.market.picked = []; else delete c.sections[sid];
    logIt(c, "reopen " + sid); formChanged(c);
  } else if (a === "pick") {
    const ids = (Array.isArray(b.ids) ? b.ids : []).map(String), known = new Set(c.market.topics.map((t) => t.id)), pick = [...new Set(ids)].filter((i) => known.has(i));
    if (pick.length > PICKS) return [400, { ok: false, error: "Pick " + PICKS + " topics." }];
    c.market.picked = pick; c.market.momo_pending = false; c.market.by = "her"; logIt(c, "pick " + pick.length); formChanged(c); await marketOutputs(env, c);
  } else if (a === "accept_momo") {   // v812 - one tap accepts Momo's draft for a section
    if (sid === "market") { if (!c.market.momo_pending) return [409, { ok: false, error: "Nothing to accept." }]; c.market.momo_pending = false; c.market.by = "her"; await marketOutputs(env, c); }
    else { const d = c.momo && c.momo[sid]; if (!d || !d.lines) return [404, { ok: false, error: "Momo has no draft for that section." }]; d.accepted = true; c.sections[sid] = { state: "momo", at: now }; }
    logIt(c, "accept momo " + sid); formChanged(c);
  } else if (a === "bday_toggle") {   // v815 - untick a name; the log keeps only the action, never the name
    const L = c.momo && c.momo.celebrations && c.momo.celebrations.birthdays; const x = L && L.find((y) => y.key === String(b.key || ""));
    if (!x) return [404, { ok: false, error: "Not on this week's list." }]; x.on = b.on !== false; logIt(c, "birthday toggle");
    c.form.cel_bday_body = asList(celebrationValues(c).cel_bday_body, c.form.cel_bday_body);   // v822
  } else if (a === "momo_edit") {   // v813 - her own wording for a section Momo drafted (or a section with no form fields yet): saved only when she taps Save
    if (sid === "market") return [400, { ok: false, error: "Change the market topics with the ticks." }];
    const lines = (Array.isArray(b.lines) ? b.lines : String(b.text || "").split("\n")).map((x) => String(x).replace(/\s+/g, " ").trim().slice(0, 300)).filter(Boolean).slice(0, 12);
    if (!lines.length) return [400, { ok: false, error: "Nothing to save: type the text first." }];
    c.momo = c.momo || {}; c.momo[sid] = Object.assign({}, c.momo[sid] || {}, { lines, accepted: true, edited: true });
    c.sections[sid] = { state: "edit", at: now }; logIt(c, "momo edit " + sid); formChanged(c);
  } else if (a === "review") {   // v812 - last week's action: done / notdone / carry (carried items join this week's actions)
    const x = (c.last_actions || []).find((y) => y.id === String(b.id || "")), v = String(b.verdict || "");
    if (!x || !["done", "notdone", "carry"].includes(v)) return [400, { ok: false, error: "Which action, and done, not done or carry?" }];
    x.review = v; if (b.owner != null) x.owner = String(b.owner).slice(0, 40);
    c.actions = (c.actions || []).filter((y) => y.id !== x.id);
    if (v === "carry") c.actions.push({ id: x.id, text: x.text, owner: x.owner || "", status: "open", from: "carried" });
    logIt(c, "review " + v);
  } else if (a === "action_add") {
    const t = String(b.text || "").trim().slice(0, 200); if (!t) return [400, { ok: false, error: "What is the action?" }];
    c.actions = (c.actions || []).concat({ id: "a" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), text: t, owner: String(b.owner || "").trim().slice(0, 40), status: "open", from: "huddle" });
    logIt(c, "action added");
  } else if (a === "accept") {
    const ks = b.key ? [String(b.key)] : Object.keys(c.drafted); ks.forEach((k) => delete c.drafted[k]); logIt(c, "accept drafts"); recompute(c);
  } else if (a === "request_build") {
    if (c.status !== "Ready to build" && c.status !== "Built") return [409, { ok: false, error: "Finish every section first: " + nextStep(c) + "." }];
    c.build_requested = { at: now, placeholders: placeholders(c.form).count }; logIt(c, "build requested");
  } else if (a === "approve") {
    if (c.status !== "Built") return [409, { ok: false, error: c.status === "Approved" ? "Already approved." : "Build the preview first." }];
    if (Object.keys(c.drafted).length) return [409, { ok: false, error: "Accept or edit the text drafted by Claude first." }];
    if (c.market.momo_pending) return [409, { ok: false, error: "Accept or change Momo's 4 market topics first." }];
    c.status = "Approved"; c.approved = { at: now, by: "najjuko" }; logIt(c, "approved");
  } else if (a === "seg") {
    const n = String(b.n || ""); if (!SEGMENTS.some((s) => s.n === n)) return [400, { ok: false, error: "Which segment?" }];
    if (b.done != null) c.presenter.done[n] = !!b.done;
    if (b.note != null) c.presenter.notes[n] = String(b.note).slice(0, 4000);
    if (c.status === "Approved" && SEGMENTS.every((s) => c.presenter.done[s.n])) c.status = "Presented";
  } else if (a === "presented") {
    if (c.status !== "Approved") return [409, { ok: false, error: "Only an approved huddle can be presented." }];
    c.status = "Presented"; logIt(c, "presented");
  } else if (a === "close") {
    if (c.status !== "Presented" && c.status !== "Approved") return [409, { ok: false, error: "Present the huddle first." }];
    const rid = await closeToRecord(env, c, now); c.record_id = rid; c.status = "Closed"; logIt(c, "closed");
  } else return [400, { ok: false, error: "Unknown action." }];
  await putCard(env, c); return [200, { ok: true, card: cardOut(c) }];
}

// ---- close: the meeting record in Momo Meetings (her recw_/recs_ store), from which the standard minutes are made --------------------------------------
async function closeToRecord(env, c, nowIso) {
  if (c.record_id) return c.record_id;
  const compact = c.date.replace(/-/g, ""), id = compact + "hud" + Math.random().toString(36).slice(2, 7);
  const theme = THEME_TITLE_KEY && typeof c.form[THEME_TITLE_KEY] === "string" ? c.form[THEME_TITLE_KEY].trim().slice(0, 60) : "";
  const lines = SEGMENTS.filter((s) => !segHidden(c, s)).map((s) => "Segment " + s.n + " " + s.name + (c.presenter.done[s.n] ? " (done)" : "") + ": " + (String(c.presenter.notes[s.n] || "").trim() || "no notes"));
  let text = "Monday Huddle " + c.date + (theme ? ", theme: " + theme : "") + ". Hosts: " + HOSTS.join(", ") + ".\n" + lines.join("\n");
  const m = { id, date: c.date, title: ("Monday Huddle" + (theme ? " · " + theme : "")).slice(0, 90), started_hm: "", started: nowIso, status: "transcribed", secs: 0,
    source: "huddle", huddle_date: c.date, auto_file_off: true, attendees: [], notes: null, minutes: null,
    added_notes: SEGMENTS.filter((s) => String(c.presenter.notes[s.n] || "").trim()).map((s) => ({ at: nowIso, text: s.n + " " + s.name + ": " + String(c.presenter.notes[s.n]).trim().slice(0, 2000) })) };
  // v812 - the actions: those added in the room (and carried), plus any "Action: ... @Owner" line in a segment note; they go to next Monday's review and,
  // as DRAFT tasks, onto the meeting record (the same draft-tasks step as a recording's minutes: nothing becomes a task without her tap)
  const have = new Set((c.actions || []).map((x) => x.text.toLowerCase()));
  for (const s of SEGMENTS) for (const ln of String(c.presenter.notes[s.n] || "").split(/\n|(?=Action:)/i)) {
    const mm = /^\s*action:\s*(.+?)(?:\s+@([A-Za-z][\w .'-]{0,30}))?\s*$/i.exec(ln); if (!mm || have.has(mm[1].toLowerCase())) continue;
    have.add(mm[1].toLowerCase()); c.actions = (c.actions || []).concat({ id: "a" + Math.random().toString(36).slice(2, 9), text: mm[1].slice(0, 200), owner: (mm[2] || "").trim(), status: "open", from: "notes" });
  }
  const names = WL_PEOPLE.map((p) => p[0]);
  m.draft_tasks = draftTasksFrom((c.actions || []).map((x) => ({ action: x.text, owner: x.owner, due: "" })), names, null);
  m.actions = (c.actions || []).map((x) => ({ text: x.text, owner: x.owner }));
  const al = (c.actions || []).map((x) => "Action: " + x.text + (x.owner ? " (" + x.owner + ")" : " (owner needed)"));
  if (al.length) text = text + "\n" + al.join("\n");
  await env.MEETINGS.put("recs_" + id + "_000", JSON.stringify({ n: 0, secs: 0, text }));
  await env.MEETINGS.put("recw_" + id, JSON.stringify(m));
  return id;
}
const segHidden = (c, s) => { const skip = new Set((c.form.skip_slides || []).map(Number)); return s.slides.length > 0 && s.slides.every((n) => skip.has(n)); };

// ---- the bridge side (called from work_bridge.js after its own key, rate and Idempotency-Key checks; najjuko only) -------------------------------------
const b64 = (s) => { try { const bin = atob(String(s || "").replace(/^data:[^,]+,/, "")); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; } catch (e) { return null; } };
const APPROVE_WORDS = /^approved?$/i;
function triesApproval(b) {
  if (!b || typeof b !== "object") return false;
  if ("status" in b || "approved" in b || "approve" in b || "approved_at" in b || "approval" in b) return true;   // the bridge never sets a status at all
  return false;
}
export async function huddleBridge(env, method, name, b, nowMs) {
  const m = /^huddle\/(next|\d{4}-\d{2}-\d{2})(?:\/(form|build))?$/.exec(name);
  if (!m) return [404, { ok: false, code: "not_found", error: "Unknown route." }];
  if (m[1] === "next") { const c = await nextCard(env, nowMs); return [200, { ok: true, data: { date: c.date, status: c.status, next_step: nextStep(c), placeholders: c.stub ? null : placeholders(c.form).count, build_requested: c.build_requested || null } }]; }
  const date = m[1];
  if (!m[2]) { const c = await getCard(env, date); return c ? [200, { ok: true, data: cardOut(c) }] : [404, { ok: false, code: "not_found", error: "No huddle card for that date." }]; }
  if (triesApproval(b) || (b && b.form && typeof b.form === "object" && APPROVE_WORDS.test(String(b.form.status || ""))))
    return [403, { ok: false, code: "approval_is_hers", error: "The bridge can never set Approved or any status. Only Najjuko's tap on the card approves the huddle." }];
  const c = await getCard(env, date); if (!c) return [404, { ok: false, code: "not_found", error: "No huddle card for that date." }];
  if (["Approved", "Presented", "Closed"].includes(c.status)) return [409, { ok: false, code: "locked", error: "This huddle is " + c.status.toLowerCase() + "; the bridge cannot change it." }];
  if (m[2] === "form") {
    const f = b.form && typeof b.form === "object" && !Array.isArray(b.form) ? b.form : null, topics = b.market_topics;
    if (!f && topics == null) return [400, { ok: false, code: "empty", error: "Send form (an object of DNA keys) and/or market_topics." }];
    if (f) {
      const long = Object.keys(f).filter((k) => FIELD_META[k] && FIELD_META[k].editable && String(Array.isArray(f[k]) ? f[k].join("\n") : f[k] == null ? "" : f[k]).length > FIELD_META[k].max);
      if (long.length) return [400, { ok: false, code: "too_long", error: "Over the slide's maximum: " + long.map((k) => k + " (max " + FIELD_META[k].max + ")").join(", ") }];
      for (const k of Object.keys(f)) { if (k === "skip_slides" || (FIELD_META[k] && !FIELD_META[k].editable)) continue; c.form[k] = clone(f[k]); c.drafted[k] = true; } }
    if (JSON.stringify(c.form).length > MAX_FORM_BYTES) return [413, { ok: false, code: "too_big", error: "The form is too large." }];
    if (topics != null) { c.market.topics = cleanTopics(topics); const ids = new Set(c.market.topics.map((t) => t.id)); c.market.picked = c.market.picked.filter((i) => ids.has(i)); momoMarket(c); }   // v812 - Momo ranks them and pre-ticks 4 unless she has chosen
    logIt(c, "bridge form"); if (f) formChanged(c); else recompute(c);
    await putCard(env, c); return [200, { ok: true, data: cardOut(c) }];
  }
  // build: the PDF and PPTX made on the Mac by render_edition.py, plus the placeholders it drew; optionally the slide images for presenter mode
  if (c.status !== "Ready to build" && c.status !== "Built") return [409, { ok: false, code: "not_ready", error: "The card is " + c.status + ": " + nextStep(c) + " first." }];
  const pdf = b.pdf_base64 ? b64(b.pdf_base64) : null, pptx = b.pptx_base64 ? b64(b.pptx_base64) : null;
  if (!pdf || pdf.length < 5 || String.fromCharCode(...pdf.slice(0, 5)) !== "%PDF-") return [400, { ok: false, code: "bad_pdf", error: "pdf_base64 must be a PDF." }];
  if (pptx && (pptx[0] !== 0x50 || pptx[1] !== 0x4b)) return [400, { ok: false, code: "bad_pptx", error: "pptx_base64 must be a PPTX." }];
  if (pdf.length > MAX_FILE || (pptx && pptx.length > MAX_FILE)) return [413, { ok: false, code: "too_big", error: "Each file at most 15 MB." }];
  const slides = (Array.isArray(b.slides_base64) ? b.slides_base64 : []).slice(0, MAX_SLIDES).map(b64);
  if (slides.some((u) => !u || !((u[0] === 0x89 && u[1] === 0x50) || (u[0] === 0xff && u[1] === 0xd8)))) return [400, { ok: false, code: "bad_slide", error: "slides_base64 are PNG or JPEG images, slide 1 first." }];
  await env.MEETINGS.put(HUD_FILE + date + "_pdf", pdf);
  if (pptx) await env.MEETINGS.put(HUD_FILE + date + "_pptx", pptx);
  for (let i = 0; i < slides.length; i++) await env.MEETINGS.put(HUD_FILE + date + "_slide_" + String(i + 1).padStart(2, "0"), slides[i]);
  const ph = Array.isArray(b.placeholders) ? b.placeholders.map((x) => String(x).slice(0, 120)).slice(0, 400) : placeholders(c.form).keys;
  c.build = { at: new Date(nowMs || Date.now()).toISOString(), pdf: true, pptx: !!pptx, slides: slides.length, placeholders: ph.length, placeholder_keys: ph, slide_type: slides.length && slides[0][0] === 0xff ? "image/jpeg" : "image/png" };
  c.status = "Built"; c.build_requested = null; c.build_stale = false; logIt(c, "built");
  await putCard(env, c); return [200, { ok: true, data: cardOut(c) }];
}

// ---- pages ---------------------------------------------------------------------------------------------------------------------------------------------
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const jsonIn = (o) => JSON.stringify(o).replace(/</g, "\\u003c");
const J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
const H = (h) => new Response(h, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
export const HUDDLE_ICON = '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/><path d="M7 9h6M7 12h10"/>';
const IC = { ok: '<svg viewBox="0 0 24 24" width=18 height=18 fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden=true><path d="M5 12l5 5 9-10"/></svg>',
  todo: '<svg viewBox="0 0 24 24" width=16 height=16 fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden=true><circle cx="12" cy="12" r="8"/></svg>',
  play: '<svg viewBox="0 0 24 24" width=18 height=18 fill="currentColor" aria-hidden=true><path d="M8 5v14l11-7z"/></svg>',
  warn: '<svg viewBox="0 0 24 24" width=16 height=16 fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden=true><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>' };
const CSS = '<style>:root{--gr:#2F7D5B;--ink:#1C2321;--gold:#C5A56A;--teal:#0A4F4A}.hc{border:1px solid #E3DDD1;border-radius:18px;background:#FFFDF9;padding:14px}.hs{font:600 .8rem "IBM Plex Sans",sans-serif;color:#8A6F3E;margin:2px 0 10px}.hosts{font:500 .78rem "IBM Plex Sans",sans-serif;color:#5F6B66;margin:0 0 12px}'
  + '.sg{display:grid;grid-template-columns:1fr 1fr;gap:8px}.sc{border:1px solid #E3DDD1;border-radius:14px;background:#fff;padding:10px;display:flex;flex-direction:column;gap:6px;min-width:0;cursor:pointer;text-align:left;font:inherit;color:inherit}.sc b{font-size:.88rem}.sc small{font-size:.72rem;color:#5F6B66}.sc .st{display:flex;align-items:center;gap:4px;font:600 .72rem "IBM Plex Mono",monospace;color:#8B918E}'
  + '.sc.done{background:var(--gr);border-color:var(--gr);color:#fff}.sc.done small,.sc.done .st{color:#E6F2EC}.sc.next{border:1.5px solid var(--gold)}.sc.next .st{color:#8A6F3E}.ph{display:flex;align-items:center;gap:6px;margin:12px 0 8px;font:600 .82rem "IBM Plex Sans",sans-serif;color:#8A6F3E}'
  + '.btn{display:block;box-sizing:border-box;width:100%;border:0;border-radius:12px;padding:13px;background:var(--teal);color:#fff;font:600 .95rem "IBM Plex Sans",sans-serif;cursor:pointer;text-align:center;text-decoration:none;margin-top:8px}.btn.alt{background:#fff;color:var(--teal);border:1.5px solid var(--teal)}.btn[disabled]{opacity:.45}'
  + '.sheet{position:fixed;inset:0;background:rgba(28,35,33,.35);display:none;align-items:flex-end;z-index:50}.sheet.on{display:flex}.sheet .in{background:#FAF7F1;border-radius:18px 18px 0 0;padding:16px 14px 28px;width:100%;max-height:86vh;overflow:auto;box-sizing:border-box}.sheet h2{font:600 1.15rem Fraunces,serif;color:var(--teal);margin:0 0 4px}'
  + '.fv{border:1px solid #E3DDD1;border-radius:12px;background:#fff;padding:8px 10px;margin:6px 0}.fv label{display:block;font:600 .7rem "IBM Plex Mono",monospace;color:#8A6F3E;margin-bottom:4px;overflow-wrap:anywhere}.fv textarea{width:100%;box-sizing:border-box;border:1px solid #E3DDD1;border-radius:8px;padding:8px;font:500 .88rem "IBM Plex Sans",sans-serif;min-height:44px;background:#FFFDF9}'
  + '.fv .lw{font-size:.82rem;color:#5F6B66;white-space:pre-wrap;overflow-wrap:anywhere}.dc{display:inline-block;background:#F6EEDC;color:#8A6F3E;border-radius:99px;padding:1px 8px;font:600 .66rem "IBM Plex Mono",monospace;margin-left:6px}.empty-f{color:var(--gold);font-weight:600}'
  + '.two{display:grid;grid-template-columns:1fr 1fr;gap:8px}.tp{display:grid;grid-template-columns:1fr;gap:8px}.tc{border:1px solid #E3DDD1;border-radius:14px;background:#fff;padding:10px 12px;display:flex;gap:10px;align-items:flex-start;cursor:pointer}.tc.on{background:var(--gr);border-color:var(--gr);color:#fff}.tc.on small{color:#E6F2EC}.tc .bx{flex:0 0 22px;height:22px;border-radius:7px;border:1.5px solid #C9C1B2;display:flex;align-items:center;justify-content:center}.tc.on .bx{border-color:#fff}.tc b{font:500 .88rem "IBM Plex Sans",sans-serif;display:block}.tc small{display:block;font:500 .72rem "IBM Plex Mono",monospace;color:#8A6F3E;margin-top:4px}.pv{background:#F6EEDC;color:#8A6F3E;border-radius:99px;padding:0 6px;margin-left:4px}'
  + '.mo{border:1px solid #C5A56A;border-radius:14px;background:#FBF6EA;padding:10px 12px;margin:8px 0}.mo label{display:block;font:600 .7rem "IBM Plex Mono",monospace;color:#8A6F3E;letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px}.mo p{margin:4px 0;font:500 .88rem "IBM Plex Sans",sans-serif}.mo .mn{color:#8A6F3E;font-size:.8rem}.tc small.why{color:#5F6B66;font-family:"IBM Plex Sans",sans-serif}.tc.on small.why{color:#E6F2EC}'
  + '.ag{display:grid;gap:8px;margin:8px 0}.ak{border:1px solid #E3DDD1;border-radius:14px;background:#fff;padding:10px 12px}.ak.ok{background:var(--gr);border-color:var(--gr);color:#fff}.ak b{display:block;font:600 .95rem "IBM Plex Sans",sans-serif}.mt{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}.chip{border-radius:99px;padding:2px 9px;font:600 .7rem "IBM Plex Mono",monospace;background:#F3EFE7;color:#5F6B66}.chip.gold{background:#F6EEDC;color:#8A6F3E;border:1px solid #C5A56A}.b3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}.b3 button{border:1.5px solid var(--teal);background:#fff;color:var(--teal);border-radius:10px;padding:8px 2px;font:600 .8rem "IBM Plex Sans",sans-serif}'
  + '.aa{display:grid;grid-template-columns:1fr 90px 64px;gap:6px;margin:10px 0}.aa input{border:1px solid #E3DDD1;border-radius:10px;padding:8px;font:500 .88rem "IBM Plex Sans",sans-serif;min-width:0;background:#fff}'
  + '</style><link rel=stylesheet href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;600&display=swap"><style>.pvg{display:grid;grid-template-columns:1fr;gap:8px}.pvw .pvt{display:flex;justify-content:space-between;align-items:center}.pvw .pve{font:600 .9em Inter,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#C9A97A}.pvw .pvp{font:600 .75em Inter,sans-serif;color:#1F2B44;background:#C9A97A;border-radius:3px;padding:.1em .5em;letter-spacing:.08em}.pvw .pvn{font:400 2.1em/1.05 Anton,Impact,sans-serif;color:#1F2B44;margin:.25em 0 .2em;text-transform:uppercase}.pvw .pvs{font:400 .75em Inter,sans-serif;color:#626B7C}.sl{font:500 .66rem "IBM Plex Mono",monospace;color:#8B918E;margin-left:4px}.fv.ro{background:#F7F3EA}.cc{text-align:right;font:500 .7rem "IBM Plex Mono",monospace;color:#8B918E;margin-top:2px}.cc.full{color:#B4533C}.fxs{border:1px dashed #C5A56A;border-radius:12px;padding:8px 12px;margin:12px 0 0;font-size:.82rem;color:#5F6B66}.fxs p{margin:3px 0}.fxs b{color:#0A4F4A}</style><style>'
  + '.pvw{aspect-ratio:16/9;background:#F9F1EF;border:1px solid #C9A97A;border-radius:10px;padding:8px 10px;box-sizing:border-box;overflow:hidden;cursor:zoom-in;display:flex;flex-direction:column;font-size:9px}.pvw .pvh{display:flex;justify-content:space-between;font:600 1em "IBM Plex Mono",monospace;color:#8A6F3E}.pvw ul{margin:.3em 0 0;padding-left:1.2em;flex:1;font:400 1.05em/1.35 Inter,sans-serif;color:#1F2B44;overflow:hidden}.pvw li{margin:.2em 0}.pvw .phd{color:#C5A56A}.pvw .pvf{font:400 .7em Inter,sans-serif;color:#626B7C;border-top:1px solid #C9A97A;padding-top:.3em}.pvw.big{font-size:13px;cursor:zoom-out;width:100%;aspect-ratio:auto;min-height:56vw;max-height:88vh;overflow:auto}'
  + '.pvo{position:fixed;inset:0;z-index:60;background:rgba(28,35,33,.6);display:flex;align-items:center;padding:12px;box-sizing:border-box}.pvi{display:grid;grid-template-columns:1fr 1fr;gap:6px}.pvi img{width:100%;border-radius:8px;border:1px solid #E3DDD1}.bdt{display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid #EFE6D6;font-size:.9rem}.bdt small{color:#8A6F3E;margin-left:auto}.mo label.bdt{display:flex;text-transform:none;letter-spacing:0;font:500 .9rem "IBM Plex Sans",sans-serif;color:#1C2321;margin:0}.mo label.bdt small{font:500 .78rem "IBM Plex Mono",monospace}'
  + '.sw{display:flex;align-items:center;justify-content:space-between;border:1px solid #E3DDD1;border-radius:12px;background:#fff;padding:10px 12px;margin:10px 0;font:500 .86rem "IBM Plex Sans",sans-serif}</style>';

export function cardPage(c, key) {
  const k = encodeURIComponent(key);
  if (!c || c.stub) return '<a class=back href="/momo?key=' + k + '">&#8592; Momo</a><div class=tag>MONDAY HUDDLE</div><h1>Huddle</h1><div class=hc><p class=hs>' + esc(c ? nextStep(c) : "No card yet.") + "</p></div>";
  const D = { card: cardOut(c), prev: null, key, weeks: (c.weeks || []), sections: SECTIONS.map((s) => ({ id: s.id, name: s.name, slides: s.slides, source: s.source, where: WHERE[s.id] || "" })), segs: SEGMENTS, hosts: HOSTS, meta: FIELD_META, slideFields: Object.fromEntries([...new Set(HUDDLE_FIELDS.map((r) => r[1]))].filter(Boolean).map((n) => [n, HUDDLE_FIELDS.filter((r) => r[1] === n).map((r) => r[0])])) };
  return '<a class=back href="/momo?key=' + k + '">&#8592; Momo</a><div class=tag>MONDAY HUDDLE · PRIVATE</div>' + CSS
    + '<div id=hud></div><div class=sheet id=sh><div class=in id=shi></div></div>'
    + '<script>var HD=' + jsonIn(D) + ';</script><script>' + CARD_JS + '</script>';
}
// the prev form travels in a separate fetch-free block so "last week's value" is visible offline
export function cardPageWithPrev(c, prev, key, weeks) {
  if (c && !c.stub && weeks) c = Object.assign({}, c, { weeks });
  const pf = prev && prev.form ? prev.form : {}, secOf = Object.fromEntries(Object.keys(pf).map((k) => [k, sectionOfKey(k)]));
  return cardPage(c, key).replace("var HD=", "var HP=" + jsonIn(pf) + ";var HSO=" + jsonIn(secOf) + ";var HD=").replace("var C=HD.card,", "HD.secOf=(typeof HSO!==\"undefined\"?HSO:{});var C=HD.card,");
}

const CARD_JS = String.raw`(function(){
var C=HD.card,P=(typeof HP!=="undefined"?HP:{}),$=function(i){return document.getElementById(i)};
var e=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
var MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],DW=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
var nd=function(d){var x=new Date(d+"T00:00:00Z");return DW[x.getUTCDay()]+" "+x.getUTCDate()+" "+MON[x.getUTCMonth()]};
var show=function(v){if(v==null||v==="")return '<span class=empty-f>[placeholder]</span>';if(typeof v==="string")return e(v);return e(JSON.stringify(v,null,1))};
function api(b,cb){b.date=C.date;fetch("/momo/work/huddle/api"+location.search,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)}).then(function(r){return r.json()}).then(function(j){if(j&&j.ok){C=j.card;draw();if(cb)cb()}else if(window.momoConfirm)momoConfirm(false,"Not saved",(j&&j.error)||"Try again.")}).catch(function(){})}
function sec(id){for(var i=0;i<C.sections.length;i++)if(C.sections[i].id===id)return C.sections[i]}
function draw(){
 var h='<h1 id=hwk>'+e(C.week_prefix||"")+e(C.week_label)+'</h1><div class=hc><p class=hs id=hnext>'+e(C.status)+' · next step: '+e(C.next_step)+'</p><p class=hosts>'+e(C.hosts.join(" · "))+'</p><div class=sg>';
 var firstUndone=null;C.sections.forEach(function(s){if(!s.done&&!firstUndone)firstUndone=s.id});
 C.sections.forEach(function(s){var lab=s.id==="market"?"Market ("+C.market.picked.length+" of 4)":s.name;var md=(C.momo||{})[s.id],mp=s.id==="market"?C.market.momo_pending:(md&&md.lines&&!md.accepted);var st=s.done?(s.state==="same"?"same":s.state==="skip"?"skipped":s.state==="momo"?"Momo's":"done"):mp?"Momo draft":(s.id===firstUndone?"Next":"");
  h+='<button type=button class="sc'+(s.done?" done":s.id===firstUndone?" next":"")+'" data-s="'+s.id+'" id="sec_'+s.id+'"><b>'+e(lab)+'</b><small>Slides '+s.slides.join(", ")+'</small><span class=st>'+(s.done?'${IC.ok}':'${IC.todo}')+e(st)+'</span></button>'});
 h+='</div><div class=ph id=hph>${IC.warn}'+C.placeholders.count+' placeholder'+(C.placeholders.count===1?"":"s")+' left</div>';
 if(C.drafted_by_claude.length)h+='<div class=sw><span>'+C.drafted_by_claude.length+' field'+(C.drafted_by_claude.length===1?"":"s")+' drafted by Claude</span><button type=button class="btn alt" style="width:auto;margin:0;padding:6px 12px" id=hacc>Accept all</button></div>';
 h+='<div class=fxs><b>Fixed slides</b><p>Slide 2 · Agenda: 8 segments'+((C.edition||{}).agenda_03?' · '+e(C.edition.agenda_03):'')+((C.edition||{}).agenda_04?' · '+e(C.edition.agenda_04):'')+'</p><p>Slide 13 · Q&amp;A and shout-outs</p><p class=sl>Locked in the template. Nothing to fill.</p></div>';   // v822
 if(C.status==="Ready to build"||C.status==="Built")h+='<button type=button class=btn id=hbuild>'+(C.build_requested?"Build asked for · waiting for your Claude":C.status==="Built"?"Build again":"Build preview")+'</button>';
 if(C.build&&C.build.has_pdf)h+='<a class="btn alt" id=hpdf href="/momo/work/huddle/file?date='+C.date+'&kind=pdf&'+location.search.slice(1)+'">Open the preview PDF</a>';
 if(C.status==="Built")h+='<button type=button class=btn id=happ>Approve</button>';
 if(C.status==="Approved"||C.status==="Presented")h+='<a class=btn id=hpres href="/momo/work/huddle/present?date='+C.date+'&'+location.search.slice(1)+'">Presenter mode</a>';
 if(C.status==="Approved"||C.status==="Presented")h+='<button type=button class="btn alt" id=hclose>Close the huddle</button>';
 if(C.status==="Closed")h+='<p class=hs>Closed. The meeting record is in Momo Meetings; make the minutes from it there.</p>';
 h+='</div>';
 if((HD.weeks||[]).length>1)h+='<div class=hc style="margin-top:12px"><p class=hs>All huddles</p>'+HD.weeks.map(function(w){return '<a href="?'+location.search.slice(1).replace(/(^|&)date=[^&]*/,"")+'&date='+w.date+'" style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid #EFE6D6;text-decoration:none;color:#0A4F4A;font-weight:600"><span>'+e(w.label)+'</span><span style="color:#8A6F3E;font-weight:500">'+e(w.status)+'</span></a>'}).join("")+'</div>';   // v816 - the week list
 $("hud").innerHTML=h;
 document.querySelectorAll(".sc").forEach(function(b){b.onclick=function(){openSec(b.getAttribute("data-s"))}});
 if($("hacc"))$("hacc").onclick=function(){api({action:"accept"})};
 if($("hbuild"))$("hbuild").onclick=function(){var n=C.placeholders.count;if(n&&!confirm(n+" placeholder"+(n===1?" is":"s are")+" still empty and will show in gold on the slides. Build anyway?"))return;api({action:"request_build"})};
 if($("happ"))$("happ").onclick=function(){if(confirm("Approve this huddle? Nothing is sent to anyone; you share the deck yourself."))api({action:"approve"})};
 if($("hclose"))$("hclose").onclick=function(){if(confirm("Close the huddle and make its meeting record?"))api({action:"close"})};
}
function closeSh(){$("sh").classList.remove("on")}
$("sh").onclick=function(ev){if(ev.target===$("sh"))closeSh()};
function openSec(id,fields){var s=sec(id),src=(HD.sections.filter(function(x){return x.id===id})[0]||{}).source||"";
 if(id==="market"&&!fields)return openMarket();
 var keys=s.keys.concat(Object.keys(P).filter(function(k){return ((HD.secOf||{})[k]===id)&&s.keys.indexOf(k)<0}));
 var skipped=(C.skip_slides||[]).length&&s.slides.every(function(n){return C.skip_slides.indexOf(n)>=0});
 var wh=(HD.sections.filter(function(x){return x.id===id})[0]||{}).where||"";var h='<h2>'+e(s.name)+'</h2><p class=hs>Shown on '+e(wh)+' (slide'+(s.slides.length>1?'s ':' ')+s.slides.join(" and ")+') · '+e(src)+'</p>';
 var md=(C.momo||{})[id];if(md&&md.lines)h+='<div class=mo><label>'+(md.accepted?"Momo's draft · accepted":"Drafted by Momo")+'</label>'+md.lines.map(function(l){return '<p>'+e(l)+'</p>'}).join("")+(md.note?'<p class=mn>'+e(md.note)+'</p>':'')+(md.accepted?'':'<button type=button class=btn id=bmomo>Accept</button>')+'</div>';
 h+=preview(id,keys);   // v815 - see the slide while filling it
 if(id==="celebrations"&&md&&(md.birthdays||[]).length)h+='<div class=mo><label>Birthdays this week</label>'+md.birthdays.map(function(x){return '<label class=bdt><input type=checkbox data-bd="'+e(x.key)+'"'+(x.on?" checked":"")+'> <b>'+e(x.name)+'</b> <small>'+e(x.when)+'</small></label>'}).join("")+'<p class=mn><a href="/momo/work/huddle/birthdays'+location.search+'">Birthdays list</a></p></div>';
 if(!keys.length)h+='<p class=hs>No fields of this section are in the form yet.</p>';
 keys.forEach(function(k){var M=(HD.meta||{})[k]||{},dr=C.drafted_by_claude.indexOf(k)>=0,mf=(C.momo_filled||[]).indexOf(k)>=0,val=C.form[k],txt=Array.isArray(val)?val.join("\n"):(val==null?"":typeof val==="string"?val:JSON.stringify(val));
  var tag=e(k)+(M.label?' <span class=sl>'+e(M.label)+'</span>':'')+(dr?'<span class=dc>drafted by Claude</span>':'')+(mf?'<span class=dc>filled by Momo</span>':'');
  if(M.editable===false){h+='<div class="fv ro"><label>'+tag+' <span class=sl>fixed</span></label><div class=lw>'+show(val)+'</div></div>';return}
  var multi=/notes|list/.test(M.type||"")||(M.max||0)>120;
  h+='<div class=fv><label>'+tag+'</label><div class=lw>Last week: '+show(P[k])+'</div><textarea data-k="'+e(k)+'" data-arr="'+(Array.isArray(val)||Array.isArray(P[k])?1:0)+'" maxlength="'+(M.max||4000)+'" rows='+(/notes/.test(M.type||"")?7:multi?4:1)+' style="display:none">'+e(txt)+'</textarea><div class=cc data-c="'+e(k)+'" style="display:none">'+txt.length+' / '+(M.max||"")+'</div></div>'});
 h+='<div class=two id=bsr><button type=button class=btn id=bsame>Same as last week</button><button type=button class="btn alt" id=bedit>Edit</button></div>';
 var mdl=(md&&md.lines)?md.lines.join("\n"):"";
 h+='<div id=bedw style="display:none"><p class=hs>'+(keys.length?'Change the text above, then tap Save.':'Write what goes on '+e(wh)+', one line per point, then tap Save.')+'</p>'+(keys.length?'':'<textarea id=bmed style="width:100%;box-sizing:border-box;min-height:120px;border:1px solid #E3DDD1;border-radius:10px;padding:8px;font:500 .9rem IBM Plex Sans,sans-serif;background:#FFFDF9">'+e(mdl)+'</textarea>')+'<div class=two><button type=button class=btn id=bsave>Save</button><button type=button class="btn alt" id=bcancel>Cancel</button></div></div>';
 h+='<div class=sw><span>Skip slide'+(s.slides.length>1?"s":"")+' this week</span><input type=checkbox id=bskip '+(skipped?"checked":"")+'></div>';
 if(s.done)h+='<button type=button class="btn alt" id=breo>Mark not done</button>';
 $("shi").innerHTML=h;$("sh").classList.add("on");
 $("shi").querySelectorAll("[data-bd]").forEach(function(x){x.onchange=function(){api({action:"bday_toggle",section:"celebrations",key:x.getAttribute("data-bd"),on:x.checked},function(){openSec("celebrations")})}});
 $("shi").querySelectorAll(".pvw").forEach(function(x){x.onclick=function(){var o=document.createElement("div");o.className="pvo";o.innerHTML=x.outerHTML;o.firstChild.classList.add("big");o.onclick=function(){o.remove()};document.body.appendChild(o)}});
 if($("bmomo"))$("bmomo").onclick=function(){api({action:"accept_momo",section:id},closeSh)};
 $("bsame").onclick=function(){api({action:"same",section:id},closeSh)};
 $("shi").querySelectorAll("textarea[data-k]").forEach(function(t){t.oninput=function(){var c=$("shi").querySelector('[data-c="'+t.getAttribute("data-k")+'"]');if(c){c.textContent=t.value.length+" / "+t.getAttribute("maxlength");c.className="cc"+(t.value.length>=+t.getAttribute("maxlength")?" full":"")}}});
 $("bedit").onclick=function(){$("shi").querySelectorAll("textarea[data-k]").forEach(function(t){t.style.display="block"});$("shi").querySelectorAll(".cc").forEach(function(c){c.style.display="block"});$("bsr").style.display="none";$("bedw").style.display="block";var f=$("shi").querySelector("textarea[data-k]")||$("bmed");if(f)f.focus()};   // v813 - Edit opens the text; only Save saves
 $("bcancel").onclick=function(){openSec(id)};
 $("bsave").onclick=function(){var tas=$("shi").querySelectorAll("textarea[data-k]");if(tas.length){var v={};tas.forEach(function(t){var k=t.getAttribute("data-k"),x=t.value,o=C.form[k];if(t.getAttribute("data-arr")==="1"){x=x.split("\n").map(function(y){return y.trim()}).filter(Boolean)}else if(o!=null&&typeof o!=="string"){try{x=JSON.parse(x)}catch(er){}}v[k]=x});api({action:"edit",section:id,values:v},closeSh)}else{var tx=$("bmed").value;if(!tx.trim()){$("bmed").focus();return}api({action:"momo_edit",section:id,text:tx},closeSh)}};
 $("bskip").onchange=function(){api({action:"skip",section:id,on:this.checked},closeSh)};
 if($("breo"))$("breo").onclick=function(){api({action:"reopen",section:id},closeSh)};
}
function preview(id,keys){var s=sec(id),md=(C.momo||{})[id],ed=C.edition||{},SF=HD.slideFields||{},M=HD.meta||{};   // v822 - FN palette: navy #1F2B44, gold #C9A97A, blush #F9F1EF, Anton + Inter
 var val=function(k){var v=ed[k];if(Array.isArray(v))return v.join(" · ");return v==null?"":String(v)};
 var ph=function(t){return t?e(t):'<span class=phd>[placeholder]</span>'};
 var thumbs=s.slides.map(function(n){var fs=(SF[n]||[]).filter(function(k){return !/_notes$/.test(k)}),lab=fs.length&&M[fs[0]]?M[fs[0]].label:("Slide "+n);
  var head=fs.filter(function(k){return /headline|title_line1|_title$|^mantra$/.test(k)})[0]||fs[0],eye=fs.filter(function(k){return /eyebrow|_theme$/.test(k)})[0];
  var rest=fs.filter(function(k){return k!==head&&k!==eye&&!/_bg$|_url$|_source$/.test(k)}).slice(0,6);
  var src=fs.filter(function(k){return /_source$/.test(k)})[0];
  return '<div class=pvw data-n='+n+'><div class=pvt><span class=pve>'+(eye?ph(val(eye)):e(lab))+'</span><span class=pvp>PREVIEW</span></div><div class=pvn>'+ph(val(head))+'</div><ul>'+rest.map(function(k){return '<li>'+ph(val(k))+'</li>'}).join("")+'</ul>'+(src?'<div class=pvs>'+ph(val(src))+'</div>':'')+'<div class=pvf>CONFIDENTIAL · FN Realty internal use only · '+e(C.week_label)+' · slide '+n+'</div></div>'});
 var h='<p class=hs style="margin:6px 0 4px">Preview of the slide'+(s.slides.length>1?'s':'')+' (tap to enlarge)</p><div class=pvg>'+thumbs.join("")+'</div>';
 if(C.build&&C.build.slides)h+='<p class=hs style="margin:8px 0 4px">Last built slide'+(s.slides.length>1?'s':'')+'</p><div class=pvi>'+s.slides.filter(function(n){return n<=C.build.slides}).map(function(n){return '<img alt="Slide '+n+'" src="/momo/work/huddle/file?date='+C.date+'&kind=slide&n='+n+'&'+location.search.slice(1)+'">'}).join("")+'</div>';
 return h}
function openMarket(){var T=C.market.topics,pick=C.market.picked.slice();
 function body(){var W=C.market.why||{},h='<h2>Market</h2><p class=hs id=mcount>Pick 4 topics · '+pick.length+' of 4</p>';
  if(C.market.momo_pending)h+='<div class=mo><label>Momo ranked the topics and pre-ticked 4</label><p>Change any tick, or accept them as they are.</p><button type=button class=btn id=macc>Accept Momo\'s 4</button></div>';
  if(C.market.cp_code||C.market_for_pdf.length)h+='<div class=mo><label>Also done with these 4</label>'+(C.market.cp_code?'<p>Draft market post in your Content Planner ('+e(C.market.cp_code)+'), not published</p>':'')+(C.market_for_pdf.length?'<p>Marked for the team market PDF</p>':'')+'</div>';
  h+=preview("market",[]);
  h+='<button type=button class="btn alt" id=mfields>Market slide text (slides 4-7)</button>';
  if(!T.length)h+='<p class=hs>No topics yet. Your Claude adds 15 to 20 from Najma before the build.</p>';
  h+='<div class=tp>';T.forEach(function(t){var on=pick.indexOf(t.id)>=0;h+='<div class="tc'+(on?" on":"")+'" data-t="'+e(t.id)+'"><span class=bx>'+(on?'${IC.ok}':'')+'</span><span><b>'+e(t.line)+'</b><small>('+e(t.table||"source")+', data as of '+e(t.as_of||"?")+')'+(t.provisional?'<span class=pv>provisional</span>':'')+'</small>'+(on&&W[t.id]?'<small class=why>Why: '+e(W[t.id])+'</small>':'')+'</span></div>'});
  h+='</div><button type=button class=btn id=msave '+(pick.length===4?"":"disabled")+'>Use these 4</button>';$("shi").innerHTML=h;
  $("shi").querySelectorAll(".tc").forEach(function(d){d.onclick=function(){var id=d.getAttribute("data-t"),i=pick.indexOf(id);if(i>=0)pick.splice(i,1);else if(pick.length<4)pick.push(id);body()}});
  $("msave").onclick=function(){api({action:"pick",ids:pick},closeSh)};
  $("shi").querySelectorAll(".pvw").forEach(function(x){x.onclick=function(){var o=document.createElement("div");o.className="pvo";o.innerHTML=x.outerHTML;o.firstChild.classList.add("big");o.onclick=function(){o.remove()};document.body.appendChild(o)}});
  if($("mfields"))$("mfields").onclick=function(){openSec("market",true)};
  if($("macc"))$("macc").onclick=function(){api({action:"accept_momo",section:"market"},closeSh)}}
 body();$("sh").classList.add("on")}
window.hudOpen=openSec;draw();
})();`;

// presenter mode: one screen per segment, everything embedded so a weak signal in the room does not matter (slides fetched up front, notes inline)
export function presenterPage(c, key) {
  const segs = SEGMENTS.filter((s) => !segHidden(c, s)).map((s) => {
    const secs = [...new Set(s.slides.map(slideSection).filter(Boolean))];
    const notes = Object.keys(c.form).filter((k) => /_notes$/i.test(k) && (secs.includes(sectionOfKey(k)) || s.slides.some((n) => new RegExp("^(?:s|slide_?)0?" + n + "_", "i").test(k))))
      .map((k) => String(c.form[k] == null ? "" : c.form[k])).filter((x) => x.trim());
    return { n: s.n, name: s.name, min: s.min, slides: s.slides.filter((n) => !(c.form.skip_slides || []).includes(n)), notes, done: !!c.presenter.done[s.n], note: c.presenter.notes[s.n] || "" };
  });
  const clipKey = Object.keys(c.form).find((k) => typeof c.form[k] === "string" && /^https:\/\/(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)\//.test(c.form[k].trim()));
  if ((c.last_actions || []).length) segs.unshift({ n: "00", name: "Last week's actions", min: 3, slides: [], notes: [], done: false, note: "", review: true });   // v812 - last week's actions first
  const D = { last: c.last_actions || [], actions: c.actions || [], date: c.date, segs, clip: clipKey ? c.form[clipKey].trim() : "", slides: (c.build && c.build.slides) || 0, hosts: HOSTS };
  return '<div class=tag>PRESENTER · ' + esc(weekLabel(c.date).toUpperCase()) + '</div>' + CSS
    + '<style>.pz{position:relative}.pz img{width:100%;border-radius:12px;border:1px solid #E3DDD1;background:#fff;display:block;margin:6px 0}.tm{font:600 2.2rem "IBM Plex Mono",monospace;color:var(--teal);text-align:center;margin:6px 0}.tm.over{color:#B4533C}.nt{font:500 1.35rem/1.45 "IBM Plex Sans",sans-serif;color:#1C2321;white-space:pre-wrap;margin:10px 0}.sn{display:flex;gap:6px;overflow-x:auto;margin:6px 0 10px}.sn button{flex:0 0 auto;border:1px solid #E3DDD1;background:#fff;border-radius:99px;padding:6px 10px;font:600 .72rem "IBM Plex Mono",monospace;color:#5F6B66}.sn button.cur{border:1.5px solid var(--teal);color:var(--teal)}.sn button.dn{background:var(--gr);border-color:var(--gr);color:#fff}.qn{width:100%;box-sizing:border-box;border:1px solid #E3DDD1;border-radius:12px;padding:10px;font:500 .95rem "IBM Plex Sans",sans-serif;min-height:80px;background:#FFFDF9}.ld{font:500 .75rem "IBM Plex Mono",monospace;color:#8A6F3E}</style>'
    + '<div id=pr></div><script>var PD=' + jsonIn(D) + ';</script><script>' + PRES_JS + '</script>';
}
const PRES_JS = String.raw`(function(){
var $=function(i){return document.getElementById(i)},S=PD.segs,cur=0,left=S.length?S[0].min*60:0,tick=null,imgs={},loaded=0;
var e=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
var q=location.search.replace(/^\?/,"").replace(/(^|&)date=[^&]*/,"");
for(var i=1;i<=PD.slides;i++){(function(n){var im=new Image();im.onload=im.onerror=function(){loaded++;var l=$("pld");if(l)l.textContent=loaded>=PD.slides?"Deck loaded · works without signal":"Loading the deck "+loaded+" of "+PD.slides};im.src="/momo/work/huddle/file?date="+PD.date+"&kind=slide&n="+n+"&"+q;imgs[n]=im})(i)}
var store=function(){try{return JSON.parse(localStorage.getItem("hud_q_"+PD.date)||"{}")}catch(x){return{}}},Q=store();
function send(b){b.date=PD.date;b.action="seg";return fetch("/momo/work/huddle/api"+location.search,{method:"POST",headers:{"Content-Type":"application/json","X-Momo-Confirm":"page"},body:JSON.stringify(b)}).then(function(r){return r.ok}).catch(function(){return false})}
function post(b){b.date=PD.date;return fetch("/momo/work/huddle/api"+location.search,{method:"POST",headers:{"Content-Type":"application/json","X-Momo-Confirm":"page"},body:JSON.stringify(b)}).then(function(r){return r.json()}).catch(function(){return null})}
function flush(){Object.keys(Q).forEach(function(n){var b=Q[n];send(b).then(function(ok){if(ok){delete Q[n];localStorage.setItem("hud_q_"+PD.date,JSON.stringify(Q))}})})}
function save(n,b){b.n=n;Q[n]=Object.assign(Q[n]||{},b);localStorage.setItem("hud_q_"+PD.date,JSON.stringify(Q));flush()}
var fmt=function(s){var a=Math.abs(s);return(s<0?"-":"")+Math.floor(a/60)+":"+String(a%60).padStart(2,"0")};
function draw(){var s=S[cur];if(!s){$("pr").innerHTML="<p>No segments.</p>";return}
 var h='<div class=sn>'+S.map(function(x,i){return '<button type=button data-i='+i+' class="'+(i===cur?"cur ":"")+(x.done?"dn":"")+'">'+x.n+'</button>'}).join("")+'</div>';
 h+='<h1 style="margin:2px 0 0">'+s.n+' '+e(s.name)+'</h1><p class=hosts>'+e(PD.hosts.join(" · "))+' · '+s.min+' min</p><div class=tm id=ptm>'+fmt(left)+'</div><div class=two><button type=button class=btn id=pgo>'+(tick?"Pause":"Start")+'</button><button type=button class="btn alt" id=prs>Reset</button></div>';
 if(s.review){h+='<div class=ag>'+PD.last.map(function(a,i){return '<div class="ak'+(a.review==="done"?" ok":"")+'"><b>'+e(a.text)+'</b><div class=mt>'+(a.owner?'<span class=chip>'+e(a.owner)+'</span>':'<span class="chip gold">owner needed</span>')+(a.review?'<span class=chip>'+({done:"done",notdone:"not done",carry:"carried forward"})[a.review]+'</span>':'')+'</div><div class=b3><button type=button data-v=done data-a='+i+'>Done</button><button type=button data-v=notdone data-a='+i+'>Not done</button><button type=button data-v=carry data-a='+i+'>Carry</button></div></div>'}).join("")+'</div>'}
 h+='<div class=pz>'+s.slides.filter(function(n){return n<=PD.slides}).map(function(n){return '<img alt="Slide '+n+'" src="'+(imgs[n]?imgs[n].src:"")+'">'}).join("")+'</div>';
 h+='<div class=nt id=pnt>'+(s.notes.length?s.notes.map(e).join("\n\n"):"No speaker notes for this segment.")+'</div>';
 if(PD.clip&&s.n==="01")h+='<a class=btn id=pclip href="'+e(PD.clip)+'" target=_blank rel=noopener>${IC.play} Play clip</a>';
 if(!s.review)h+='<textarea class=qn id=pq placeholder="Quick note: questions, shout-outs, actions">'+e(s.note)+'</textarea>';
 h+='<div class=aa><input id=paa placeholder="New action"><input id=pao placeholder="Owner"><button type=button class="btn alt" id=pab style="margin:0">Add</button></div>'+(PD.actions.length?'<p class=ld>'+PD.actions.length+' action'+(PD.actions.length===1?"":"s")+' this week</p>':'');
 h+='<button type=button class="btn'+(s.done?" alt":"")+'" id=pdone>'+(s.done?"Done · undo":"Mark segment done")+'</button><div class=two><button type=button class="btn alt" id=pprev>Back</button><button type=button class=btn id=pnext>Next</button></div><p class=ld id=pld>'+(PD.slides?(loaded>=PD.slides?"Deck loaded · works without signal":"Loading the deck"):"No slide images in this build")+'</p>';
 $("pr").innerHTML=h;
 $("pr").querySelectorAll(".sn button").forEach(function(b){b.onclick=function(){go(+b.getAttribute("data-i"))}});
 $("pgo").onclick=function(){if(tick){clearInterval(tick);tick=null}else tick=setInterval(function(){left--;var t=$("ptm");if(t){t.textContent=fmt(left);t.className="tm"+(left<0?" over":"")}},1000);$("pgo").textContent=tick?"Pause":"Start"};
 $("prs").onclick=function(){left=s.min*60;$("ptm").textContent=fmt(left);$("ptm").className="tm"};
 if($("pq"))$("pq").onchange=function(){s.note=this.value;save(s.n,{note:this.value})};
 $("pdone").onclick=function(){s.done=!s.done;if(!s.review)save(s.n,{done:s.done});draw()};
 $("pr").querySelectorAll("[data-v]").forEach(function(b){b.onclick=function(){var a=PD.last[+b.getAttribute("data-a")],v=b.getAttribute("data-v");a.review=v;post({action:"review",id:a.id,verdict:v}).then(function(j){if(j&&j.card)PD.actions=j.card.actions;draw()});draw()}});
 $("pab").onclick=function(){var t=$("paa").value.trim();if(!t)return;post({action:"action_add",text:t,owner:$("pao").value.trim()}).then(function(j){if(j&&j.card){PD.actions=j.card.actions;draw()}})};
 $("pprev").onclick=function(){go(cur-1)};$("pnext").onclick=function(){go(cur+1)};
}
function go(i){if(i<0||i>=S.length)return;var q=$("pq");if(q&&q.value!==S[cur].note){S[cur].note=q.value;save(S[cur].n,{note:q.value})}if(tick){clearInterval(tick);tick=null}cur=i;left=S[cur].min*60;draw();scrollTo(0,0)}
window.addEventListener("online",flush);draw();flush();
})();`;

// GET /momo/work/huddle, /momo/work/huddle/present, /momo/work/huddle/file; POST /momo/work/huddle/api. Najjuko's key only (index.js gates it too).
export async function huddleRoute(request, env, url, deps) {
  const p = url.pathname; if (!p.startsWith("/momo/work/huddle")) return null;
  if (deps.person(env, url) !== "najjuko") return new Response("not found", { status: 404 });
  const key = url.searchParams.get("key") || "", rk = url.searchParams.get("rk") || "";
  if (p === "/momo/work/huddle/api" && request.method === "POST") {
    let b = {}; try { b = await request.json(); } catch (e) {}
    if (/^bd_/.test(String(b.action || ""))) { const [s2, o2] = await birthdayAction(env, b); return J(o2, s2); }   // v815 - the Birthdays list
    const [s, o] = await cardAction(env, b); return J(o, s);
  }
  if (request.method !== "GET") return null;
  if (p === "/momo/work/huddle/birthdays") return H(deps.page(key, rk, birthdaysPage(await readBirthdays(env), key, MOMO_TOAST_JS)));   // v815
  if (p === "/momo/work/huddle") {
    const d = url.searchParams.get("date"), c = dOk(d) ? await getCard(env, d) : await nextCard(env, undefined, { cal: deps.cal });
    const prev = c && !c.stub && c.prev_date ? await getCard(env, c.prev_date) : null;
    const weeks = []; for (const d of (await cardIndex(env)).slice(-12).reverse()) { const x = await getCard(env, d); if (x) weeks.push({ date: d, label: weekPrefix(d) + weekLabel(d), status: x.status }); }
    return H(deps.page(key, rk, cardPageWithPrev(c, prev, key, weeks)));
  }
  if (p === "/momo/work/huddle/present") {
    const c = await getCard(env, url.searchParams.get("date")); if (!c || !["Approved", "Presented", "Closed"].includes(c.status)) return new Response("Approve the huddle first.", { status: 409 });
    return H(deps.page(key, rk, presenterPage(c, key)));
  }
  if (p === "/momo/work/huddle/file") {
    const d = url.searchParams.get("date"), kind = url.searchParams.get("kind"), n = Math.max(1, Math.min(MAX_SLIDES, parseInt(url.searchParams.get("n"), 10) || 1));
    const c = await getCard(env, d); if (!c || !c.build) return new Response("not found", { status: 404 });
    const kk = kind === "pdf" ? "_pdf" : kind === "pptx" ? "_pptx" : kind === "slide" ? "_slide_" + String(n).padStart(2, "0") : "";
    if (!kk) return new Response("not found", { status: 404 });
    const v = await env.MEETINGS.get(HUD_FILE + d + kk, "arrayBuffer"); if (!v) return new Response("not found", { status: 404 });
    const ct = kind === "pdf" ? "application/pdf" : kind === "pptx" ? "application/vnd.openxmlformats-officedocument.presentationml.presentation" : c.build.slide_type || "image/png";
    return new Response(v, { headers: { "Content-Type": ct, "Cache-Control": "private, max-age=86400", "X-Robots-Tag": "noindex", "Content-Disposition": (kind === "pptx" ? "attachment" : "inline") + '; filename="FN_Huddle_' + d + (kind === "slide" ? "_" + n + ".png" : "." + kind) + '"' } });
  }
  return null;
}
