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

export const HUD = "hud_card_", HUD_IDX = "hud_index", HUD_FILE = "hud_file_";
export const STATUSES = ["Draft", "Filling", "Ready to build", "Built", "Approved", "Presented", "Closed"];
export const MAX_FILE = 15 * 1024 * 1024, MAX_SLIDES = 15, MAX_TOPICS = 20, PICKS = 4, MAX_FORM_BYTES = 200000;

// ---- THE SECTION MAP: the ONE place where her DNA form keys meet the card's sections ------------------------------------------------------------------
// TODO(v810, field list): huddle-form-fields.json (146 fields) and huddle/TEMPLATE.md are on Najjuko's Mac and were not sent. When they arrive:
//   1. put every key into FIELD_SECTION (exact key -> section id), taken from the "card section" column of huddle-form-fields.json;
//   2. trim the guessed PREFIXES below (they only catch keys FIELD_SECTION does not list);
//   3. fill DATE_FIELDS (the keys that hold the huddle's dates, rewritten when Thursday copies the card) and THEME_TITLE_KEY;
//   4. check SEGMENTS[].slides against TEMPLATE.md's run of show.
// Until then a key is placed by FIELD_SECTION, else by a slide-number prefix (s04_..., slide4_..., slide_04_...), else by a name prefix; a key that
// matches nothing is shown under "Other fields" so nothing is lost or hidden. The form itself is stored and returned exactly as her DNA JSON.
export const FIELD_SECTION = {
  // "theme_title": "theme",   <- one line per DNA key, e.g.
};
export const DATE_FIELDS = [];          // e.g. ["huddle_date", "date_display"]: rewritten for the new Monday when a card is copied (only keys already present)
export const THEME_TITLE_KEY = "";      // e.g. "theme_title": names the meeting record on Close
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
export const FIXED_SLIDES = [2, 13];   // agenda and Q&A: locked, nothing to fill
// the run of show (about 30 minutes)
export const SEGMENTS = [
  { n: "01", name: "Motivation", min: 4, slides: [1, 2, 3] }, { n: "02", name: "Market", min: 7, slides: [4, 5, 6, 7] },
  { n: "03", name: "Recognition", min: 3, slides: [8] }, { n: "04", name: "Updates, celebrations & tip", min: 6, slides: [9, 10, 11] },
  { n: "05", name: "Weekly focus", min: 3, slides: [12] }, { n: "06", name: "Q&A", min: 3, slides: [13] },
  { n: "07", name: "Shout-outs", min: 3, slides: [] }, { n: "08", name: "Mantra", min: 2, slides: [14, 15] },
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
    const sid = sectionOfKey(k); if (sid && SEC[sid].slides.every((n) => skip.has(n))) continue;
    for (const [p, v] of leaves(f[k], k, [])) if (isEmpty(v)) keys.push(p);
  }
  return { count: keys.length, keys };
}

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
export async function createCard(env, date, nowIso) {
  const have = await getCard(env, date); if (have) return have;
  const prev = await prevCard(env, date), form = prev ? clone(prev.form) || {} : {};
  for (const k of DATE_FIELDS) if (k in form) form[k] = date;
  if (Array.isArray(form.skip_slides)) form.skip_slides = [];   // a skip is for one week only
  const c = { v: 1, date, status: "Draft", created: nowIso || new Date().toISOString(), prev_date: prev ? prev.date : "", form, sections: {}, drafted: {},
    market: { topics: [], picked: [] }, build: null, build_requested: null, approved: null, presenter: { done: {}, notes: {} }, record_id: "", log: [] };
  await putCard(env, c); return c;
}
// the minute tick: on Thursday (and through Monday, if it was missed) the card for the next Monday appears
export async function huddleTick(env, nowMs) {
  const today = dubaiToday(nowMs); if (!inCreateWindow(today)) return null;
  const date = mondayFor(today); if (await env.MEETINGS.get(HUD + date)) return null;
  return createCard(env, date, new Date(nowMs || Date.now()).toISOString());
}
// the card the bridge and the page call "next": this Monday's (or the coming one's) once it exists, else last Monday's while it is still open
export async function nextCard(env, nowMs) {
  const today = dubaiToday(nowMs), date = mondayFor(today);
  if (inCreateWindow(today)) return (await getCard(env, date)) || (await createCard(env, date));
  const idx = await cardIndex(env), last = idx.filter((d) => d < today).pop(), lc = last ? await getCard(env, last) : null;
  if (lc && lc.status !== "Closed") return lc;
  return { date, status: "Not created yet", creates_on: addDays(date, -4), stub: true };
}

const sectionDone = (c, sid) => sid === "market" ? (c.market.picked || []).length === PICKS : !!(c.sections[sid] && c.sections[sid].state);
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
  const ph = placeholders(c.form);
  return { date: c.date, status: c.status, next_step: nextStep(c), form: c.form, skip_slides: Array.isArray(c.form.skip_slides) ? c.form.skip_slides : [],
    sections: SECTIONS.map((s) => ({ id: s.id, name: s.name, slides: s.slides, done: sectionDone(c, s.id), state: (c.sections[s.id] || {}).state || "", keys: keysOf(s.id, c.form) })),
    unmapped_keys: Object.keys(c.form).filter((k) => k !== "skip_slides" && !sectionOfKey(k)),
    market: { topics: c.market.topics, picked: c.market.picked }, drafted_by_claude: Object.keys(c.drafted || {}),
    placeholders: ph, build_requested: c.build_requested, build: c.build ? { at: c.build.at, placeholders: c.build.placeholders, has_pdf: !!c.build.pdf, has_pptx: !!c.build.pptx, slides: c.build.slides || 0 } : null,
    approved: !!c.approved, hosts: HOSTS };
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
  const formActs = ["same", "edit", "skip", "pick", "accept"];
  if (locked && formActs.includes(a)) return [409, { ok: false, error: "This huddle has been presented; the form is closed." }];
  if (formActs.includes(a) && a !== "pick" && a !== "accept" && !SEC[sid]) return [400, { ok: false, error: "Which section?" }];
  if (a === "same") {
    const prev = c.prev_date ? await getCard(env, c.prev_date) : null, pf = (prev && prev.form) || {};
    for (const k of keysOf(sid, pf)) { if (!DATE_FIELDS.includes(k)) c.form[k] = clone(pf[k]); delete c.drafted[k]; }
    c.sections[sid] = { state: "same", at: now }; logIt(c, "same " + sid); formChanged(c);
  } else if (a === "edit") {
    const v = b.values && typeof b.values === "object" ? b.values : {};
    for (const k of Object.keys(v)) { if (sectionOfKey(k) !== sid) continue; c.form[k] = clone(v[k]); delete c.drafted[k]; }
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
    c.market.picked = pick; logIt(c, "pick " + pick.length); formChanged(c);
  } else if (a === "accept") {
    const ks = b.key ? [String(b.key)] : Object.keys(c.drafted); ks.forEach((k) => delete c.drafted[k]); logIt(c, "accept drafts"); recompute(c);
  } else if (a === "request_build") {
    if (c.status !== "Ready to build" && c.status !== "Built") return [409, { ok: false, error: "Finish every section first: " + nextStep(c) + "." }];
    c.build_requested = { at: now, placeholders: placeholders(c.form).count }; logIt(c, "build requested");
  } else if (a === "approve") {
    if (c.status !== "Built") return [409, { ok: false, error: c.status === "Approved" ? "Already approved." : "Build the preview first." }];
    if (Object.keys(c.drafted).length) return [409, { ok: false, error: "Accept or edit the text drafted by Claude first." }];
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
  const text = "Monday Huddle " + c.date + (theme ? ", theme: " + theme : "") + ". Hosts: " + HOSTS.join(", ") + ".\n" + lines.join("\n");
  const m = { id, date: c.date, title: ("Monday Huddle" + (theme ? " · " + theme : "")).slice(0, 90), started_hm: "", started: nowIso, status: "transcribed", secs: 0,
    source: "huddle", huddle_date: c.date, auto_file_off: true, attendees: [], notes: null, minutes: null,
    added_notes: SEGMENTS.filter((s) => String(c.presenter.notes[s.n] || "").trim()).map((s) => ({ at: nowIso, text: s.n + " " + s.name + ": " + String(c.presenter.notes[s.n]).trim().slice(0, 2000) })) };
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
    if (f) { for (const k of Object.keys(f)) { if (k === "skip_slides") continue; c.form[k] = clone(f[k]); c.drafted[k] = true; } }
    if (JSON.stringify(c.form).length > MAX_FORM_BYTES) return [413, { ok: false, code: "too_big", error: "The form is too large." }];
    if (topics != null) { c.market.topics = cleanTopics(topics); const ids = new Set(c.market.topics.map((t) => t.id)); c.market.picked = c.market.picked.filter((i) => ids.has(i)); }
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
  + '.sw{display:flex;align-items:center;justify-content:space-between;border:1px solid #E3DDD1;border-radius:12px;background:#fff;padding:10px 12px;margin:10px 0;font:500 .86rem "IBM Plex Sans",sans-serif}</style>';

export function cardPage(c, key) {
  const k = encodeURIComponent(key);
  if (!c || c.stub) return '<a class=back href="/momo?key=' + k + '">&#8592; Momo</a><div class=tag>MONDAY HUDDLE</div><h1>Huddle</h1><div class=hc><p class=hs>' + esc(c ? nextStep(c) : "No card yet.") + "</p></div>";
  const D = { card: cardOut(c), prev: null, key, sections: SECTIONS.map((s) => ({ id: s.id, name: s.name, slides: s.slides, source: s.source })) };
  return '<a class=back href="/momo?key=' + k + '">&#8592; Momo</a><div class=tag>MONDAY HUDDLE · PRIVATE</div>' + CSS
    + '<div id=hud></div><div class=sheet id=sh><div class=in id=shi></div></div>'
    + '<script>var HD=' + jsonIn(D) + ';</script><script>' + CARD_JS + '</script>';
}
// the prev form travels in a separate fetch-free block so "last week's value" is visible offline
export function cardPageWithPrev(c, prev, key) {
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
 var h='<h1>Huddle · '+e(nd(C.date))+'</h1><div class=hc><p class=hs id=hnext>'+e(C.status)+' · next step: '+e(C.next_step)+'</p><p class=hosts>'+e(C.hosts.join(" · "))+'</p><div class=sg>';
 var firstUndone=null;C.sections.forEach(function(s){if(!s.done&&!firstUndone)firstUndone=s.id});
 C.sections.forEach(function(s){var lab=s.id==="market"?"Market ("+C.market.picked.length+" of 4)":s.name;var st=s.done?(s.state==="same"?"same":s.state==="skip"?"skipped":"done"):(s.id===firstUndone?"Next":"");
  h+='<button type=button class="sc'+(s.done?" done":s.id===firstUndone?" next":"")+'" data-s="'+s.id+'" id="sec_'+s.id+'"><b>'+e(lab)+'</b><small>Slides '+s.slides.join(", ")+'</small><span class=st>'+(s.done?'${IC.ok}':'${IC.todo}')+e(st)+'</span></button>'});
 h+='</div><div class=ph id=hph>${IC.warn}'+C.placeholders.count+' placeholder'+(C.placeholders.count===1?"":"s")+' left</div>';
 if(C.drafted_by_claude.length)h+='<div class=sw><span>'+C.drafted_by_claude.length+' field'+(C.drafted_by_claude.length===1?"":"s")+' drafted by Claude</span><button type=button class="btn alt" style="width:auto;margin:0;padding:6px 12px" id=hacc>Accept all</button></div>';
 if(C.status==="Ready to build"||C.status==="Built")h+='<button type=button class=btn id=hbuild>'+(C.build_requested?"Build asked for · waiting for your Claude":C.status==="Built"?"Build again":"Build preview")+'</button>';
 if(C.build&&C.build.has_pdf)h+='<a class="btn alt" id=hpdf href="/momo/work/huddle/file?date='+C.date+'&kind=pdf&'+location.search.slice(1)+'">Open the preview PDF</a>';
 if(C.status==="Built")h+='<button type=button class=btn id=happ>Approve</button>';
 if(C.status==="Approved"||C.status==="Presented")h+='<a class=btn id=hpres href="/momo/work/huddle/present?date='+C.date+'&'+location.search.slice(1)+'">Presenter mode</a>';
 if(C.status==="Approved"||C.status==="Presented")h+='<button type=button class="btn alt" id=hclose>Close the huddle</button>';
 if(C.status==="Closed")h+='<p class=hs>Closed. The meeting record is in Momo Meetings; make the minutes from it there.</p>';
 h+='</div>';$("hud").innerHTML=h;
 document.querySelectorAll(".sc").forEach(function(b){b.onclick=function(){openSec(b.getAttribute("data-s"))}});
 if($("hacc"))$("hacc").onclick=function(){api({action:"accept"})};
 if($("hbuild"))$("hbuild").onclick=function(){var n=C.placeholders.count;if(n&&!confirm(n+" placeholder"+(n===1?" is":"s are")+" still empty and will show in gold on the slides. Build anyway?"))return;api({action:"request_build"})};
 if($("happ"))$("happ").onclick=function(){if(confirm("Approve this huddle? Nothing is sent to anyone; you share the deck yourself."))api({action:"approve"})};
 if($("hclose"))$("hclose").onclick=function(){if(confirm("Close the huddle and make its meeting record?"))api({action:"close"})};
}
function closeSh(){$("sh").classList.remove("on")}
$("sh").onclick=function(ev){if(ev.target===$("sh"))closeSh()};
function openSec(id){var s=sec(id),src=(HD.sections.filter(function(x){return x.id===id})[0]||{}).source||"";
 if(id==="market")return openMarket();
 var keys=s.keys.concat(Object.keys(P).filter(function(k){return ((HD.secOf||{})[k]===id)&&s.keys.indexOf(k)<0}));
 var skipped=(C.skip_slides||[]).length&&s.slides.every(function(n){return C.skip_slides.indexOf(n)>=0});
 var h='<h2>'+e(s.name)+'</h2><p class=hs>Slides '+s.slides.join(", ")+' · '+e(src)+'</p>';
 if(!keys.length)h+='<p class=hs>No fields of this section are in the form yet.</p>';
 keys.forEach(function(k){var dr=C.drafted_by_claude.indexOf(k)>=0;h+='<div class=fv><label>'+e(k)+(dr?'<span class=dc>drafted by Claude</span>':'')+'</label><div class=lw>Last week: '+show(P[k])+'</div><textarea data-k="'+e(k)+'" style="display:none">'+e(typeof C.form[k]==="string"?C.form[k]:C.form[k]==null?"":JSON.stringify(C.form[k]))+'</textarea></div>'});
 h+='<div class=two><button type=button class=btn id=bsame>Same</button><button type=button class="btn alt" id=bedit>Edit</button></div>';
 h+='<div class=sw><span>Skip slide'+(s.slides.length>1?"s":"")+' this week</span><input type=checkbox id=bskip '+(skipped?"checked":"")+'></div>';
 if(s.done)h+='<button type=button class="btn alt" id=breo>Mark not done</button>';
 $("shi").innerHTML=h;$("sh").classList.add("on");
 $("bsame").onclick=function(){api({action:"same",section:id},closeSh)};
 $("bedit").onclick=function(){var tas=$("shi").querySelectorAll("textarea");if(tas.length&&tas[0].style.display==="none"){tas.forEach(function(t){t.style.display="block"});$("bedit").textContent="Save";return}var v={};tas.forEach(function(t){var k=t.getAttribute("data-k"),x=t.value,o=C.form[k];if(o!=null&&typeof o!=="string"){try{x=JSON.parse(x)}catch(er){}}v[k]=x});api({action:"edit",section:id,values:v},closeSh)};
 $("bskip").onchange=function(){api({action:"skip",section:id,on:this.checked},closeSh)};
 if($("breo"))$("breo").onclick=function(){api({action:"reopen",section:id},closeSh)};
}
function openMarket(){var T=C.market.topics,pick=C.market.picked.slice();
 function body(){var h='<h2>Market</h2><p class=hs id=mcount>Pick 4 topics · '+pick.length+' of 4</p>';
  if(!T.length)h+='<p class=hs>No topics yet. Your Claude adds 15 to 20 from Najma before the build.</p>';
  h+='<div class=tp>';T.forEach(function(t){var on=pick.indexOf(t.id)>=0;h+='<div class="tc'+(on?" on":"")+'" data-t="'+e(t.id)+'"><span class=bx>'+(on?'${IC.ok}':'')+'</span><span><b>'+e(t.line)+'</b><small>('+e(t.table||"source")+', data as of '+e(t.as_of||"?")+')'+(t.provisional?'<span class=pv>provisional</span>':'')+'</small></span></div>'});
  h+='</div><button type=button class=btn id=msave '+(pick.length===4?"":"disabled")+'>Use these 4</button>';$("shi").innerHTML=h;
  $("shi").querySelectorAll(".tc").forEach(function(d){d.onclick=function(){var id=d.getAttribute("data-t"),i=pick.indexOf(id);if(i>=0)pick.splice(i,1);else if(pick.length<4)pick.push(id);body()}});
  $("msave").onclick=function(){api({action:"pick",ids:pick},closeSh)}}
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
  const D = { date: c.date, segs, clip: clipKey ? c.form[clipKey].trim() : "", slides: (c.build && c.build.slides) || 0, hosts: HOSTS };
  return '<div class=tag>PRESENTER · ' + esc(niceDate(c.date).toUpperCase()) + '</div>' + CSS
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
function flush(){Object.keys(Q).forEach(function(n){var b=Q[n];send(b).then(function(ok){if(ok){delete Q[n];localStorage.setItem("hud_q_"+PD.date,JSON.stringify(Q))}})})}
function save(n,b){b.n=n;Q[n]=Object.assign(Q[n]||{},b);localStorage.setItem("hud_q_"+PD.date,JSON.stringify(Q));flush()}
var fmt=function(s){var a=Math.abs(s);return(s<0?"-":"")+Math.floor(a/60)+":"+String(a%60).padStart(2,"0")};
function draw(){var s=S[cur];if(!s){$("pr").innerHTML="<p>No segments.</p>";return}
 var h='<div class=sn>'+S.map(function(x,i){return '<button type=button data-i='+i+' class="'+(i===cur?"cur ":"")+(x.done?"dn":"")+'">'+x.n+'</button>'}).join("")+'</div>';
 h+='<h1 style="margin:2px 0 0">'+s.n+' '+e(s.name)+'</h1><p class=hosts>'+e(PD.hosts.join(" · "))+' · '+s.min+' min</p><div class=tm id=ptm>'+fmt(left)+'</div><div class=two><button type=button class=btn id=pgo>'+(tick?"Pause":"Start")+'</button><button type=button class="btn alt" id=prs>Reset</button></div>';
 h+='<div class=pz>'+s.slides.filter(function(n){return n<=PD.slides}).map(function(n){return '<img alt="Slide '+n+'" src="'+(imgs[n]?imgs[n].src:"")+'">'}).join("")+'</div>';
 h+='<div class=nt id=pnt>'+(s.notes.length?s.notes.map(e).join("\n\n"):"No speaker notes for this segment.")+'</div>';
 if(PD.clip&&s.n==="01")h+='<a class=btn id=pclip href="'+e(PD.clip)+'" target=_blank rel=noopener>${IC.play} Play clip</a>';
 h+='<textarea class=qn id=pq placeholder="Quick note: questions, shout-outs, actions">'+e(s.note)+'</textarea>';
 h+='<button type=button class="btn'+(s.done?" alt":"")+'" id=pdone>'+(s.done?"Done · undo":"Mark segment done")+'</button><div class=two><button type=button class="btn alt" id=pprev>Back</button><button type=button class=btn id=pnext>Next</button></div><p class=ld id=pld>'+(PD.slides?(loaded>=PD.slides?"Deck loaded · works without signal":"Loading the deck"):"No slide images in this build")+'</p>';
 $("pr").innerHTML=h;
 $("pr").querySelectorAll(".sn button").forEach(function(b){b.onclick=function(){go(+b.getAttribute("data-i"))}});
 $("pgo").onclick=function(){if(tick){clearInterval(tick);tick=null}else tick=setInterval(function(){left--;var t=$("ptm");if(t){t.textContent=fmt(left);t.className="tm"+(left<0?" over":"")}},1000);$("pgo").textContent=tick?"Pause":"Start"};
 $("prs").onclick=function(){left=s.min*60;$("ptm").textContent=fmt(left);$("ptm").className="tm"};
 $("pq").onchange=function(){s.note=this.value;save(s.n,{note:this.value})};
 $("pdone").onclick=function(){s.done=!s.done;save(s.n,{done:s.done});draw()};
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
    const [s, o] = await cardAction(env, b); return J(o, s);
  }
  if (request.method !== "GET") return null;
  if (p === "/momo/work/huddle") {
    const d = url.searchParams.get("date"), c = dOk(d) ? await getCard(env, d) : await nextCard(env);
    const prev = c && !c.stub && c.prev_date ? await getCard(env, c.prev_date) : null;
    return H(deps.page(key, rk, cardPageWithPrev(c, prev, key)));
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
